'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const acceptanceDir = path.join(root, 'output/expression-course-drafts/unit01-acceptance-v1');

async function fillWordSlots(page, answer) {
  const words = answer.trim().replace(/[.!?]+$/, '').split(/\s+/);
  const slots = page.getByRole('group', { name: '逐词输入英文表达' }).getByRole('textbox');
  for (const [index, word] of words.entries()) await slots.nth(index).fill(word);
}

test('real unit01 package uploads and plays actual WAV audio in the isolated formal player', { timeout: 120000 }, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'expression-unit01-e2e-'));
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  const port = require('./lib/free-port').freePort(19300, 100), base = `http://127.0.0.1:${port}`;
  const appRoot = path.join(temp, 'app'); fs.mkdirSync(path.join(appRoot, 'content'), { recursive: true });
  fs.copyFileSync(path.join(root, 'content/manifest.json'), path.join(appRoot, 'content/manifest.json'));
  require('./lib/prepare-ui-root')(appRoot);
  const env = { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), CHUNKLAB_DATA_DIR: path.join(temp, 'data'),
    CHUNKLAB_APP_ROOT: appRoot, EXPRESSION_COURSES_ENABLED: 'true', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
    JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_PASSWORD: 'isolated-unit01-admin-pass',
    ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'), MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64') };
  let server, browser, logs = '';
  const log = data => { logs += data.toString(); };
  try {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', log); server.stderr.on('data', log);
    for (let i = 0; i < 150; i++) {
      if (server.exitCode !== null) throw Error('isolated service exited: ' + logs);
      try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 100));
      if (i === 149) throw Error('isolated service did not start: ' + logs);
    }
    const admin = await (await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: env.ADMIN_PASSWORD }) })).json();
    const headers = { authorization: 'Bearer ' + admin.token, 'content-type': 'application/json' };
    const dir = path.join(root, 'output/expression-course-drafts/unit01-formal-v1');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'course-package.json'), 'utf8'));
    for (const asset of pkg.assets) {
      const uploaded = await fetch(base + '/api/admin/expression-assets', { method: 'POST', headers,
        body: JSON.stringify({ assetId: asset.assetId, mimeType: asset.mimeType, base64: fs.readFileSync(path.join(dir, asset.localFile)).toString('base64') }) });
      assert.equal(uploaded.status, 201, 'actual course WAV uploads');
      const receipt = await uploaded.json(); assert.equal(receipt.sha256, asset.sha256); assert.equal(receipt.size, asset.size);
    }
    const draftResponse = await fetch(base + '/api/admin/expression-drafts', { method: 'POST', headers,
      body: JSON.stringify({ package: pkg, requestId: 'unit01e2e-draft-0001' }) });
    assert.equal(draftResponse.status, 201); const draft = await draftResponse.json();
    const validation = await (await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/validate`, { method: 'POST', headers })).json();
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/review`, { method: 'POST', headers,
      body: JSON.stringify({ contentHash: validation.contentHash }) });
    const published = await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/publish`, { method: 'POST', headers,
      body: JSON.stringify({ expectedRevision: draft.revision, contentHash: validation.contentHash, requestId: 'unit01e2e-pub-0001' }) });
    assert.equal(published.status, 200);

    const registration = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'unit01-e2e-learner', password: 'unit01-e2e-password' }) });
    assert.equal(registration.status, 200); const learner = await registration.json();
    const context = await (await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() }))
      .newContext({ serviceWorkers: 'block', viewport: { width: 938, height: 932 } });
    browser = context.browser();
    await context.addInitScript(token => localStorage.setItem('chunklab_token', token), learner.token);
    await context.addInitScript(() => {
      const NativeAudio = window.Audio;
      window.Audio = function(...args) { const audio = new NativeAudio(...args); window.__courseAudio = audio; return audio; };
      window.Audio.prototype = NativeAudio.prototype;
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let lastAction = null; page.on('request', request => { if (request.url().includes('/api/expression-sessions/') && request.url().endsWith('/actions')) lastAction = request.postDataJSON(); });
    let sessionStart = null, accessStart = null;
    page.on('request', request => {
      if (request.url().endsWith('/api/expression-sessions') && request.method() === 'POST') sessionStart = request.postDataJSON();
      if (request.url().endsWith('/api/learning-sessions/start')) accessStart = request.postDataJSON();
    });
    let rejectFirstDemo = true, rejectNextDemoNetwork = true;
    await page.route('**/assets/unit01_L101_0', async route => {
      if (rejectFirstDemo) {
        rejectFirstDemo = false;
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'ASSET_FORBIDDEN' }) });
      } else if (rejectNextDemoNetwork) {
        rejectNextDemoNetwork = false;
        await route.abort('internetdisconnected');
      } else await route.continue();
    });
    await page.goto(base + '/main.html?view=discover');
    const courseCard = page.locator(`#discoverBody .workspace-card[data-resource="course:${pkg.courseId}"]`);
    await courseCard.waitFor({ state: 'attached', timeout: 20000 });
    await courseCard.locator('.content-card-title').click();
    await page.waitForURL(/expression-learn\.html\?course=/);
    await page.getByRole('button', { name: '开始学习', exact: true }).click();
    await page.getByRole('button', { name: '播放示范', exact: true }).click();
    await page.getByText('音频暂时无法播放，请稍后重试。', { exact: true }).waitFor();
    assert.equal(await page.locator('#progressLabel').textContent(), '第 1 步', 'forbidden audio does not advance the lesson');
    assert.equal(lastAction, null, 'failed audio is not reported as heard');
    await page.getByRole('button', { name: '播放示范', exact: true }).click();
    await page.getByText('Failed to fetch', { exact: true }).waitFor();
    assert.equal(await page.locator('#progressLabel').textContent(), '第 1 步', 'a network interruption does not advance the lesson');
    assert.equal(lastAction, null, 'a network failure is not reported as heard');
    await page.getByRole('button', { name: '播放示范', exact: true }).click();
    const audioState = await page.waitForFunction(() => {
      const audio = window.__courseAudio;
      return audio && Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime > 0 ? { duration: audio.duration, currentTime: audio.currentTime } : false;
    }, null, { timeout: 10000 });
    const played = await audioState.jsonValue();
    assert.ok(played.duration > 0 && played.currentTime > 0, 'real browser decoded and played the lesson WAV');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.getByRole('button', { name: '检查答案', exact: true }).waitFor();
    for (const activity of pkg.lessons[0].activities.slice(3)) {
      await page.getByRole('button', { name: '播放音频', exact: true }).click();
      const choice = activity.payload.options.find(item => item.id === activity.evaluation.correctOptionId);
      const choiceIndex = activity.payload.options.indexOf(choice);
      await page.locator('#activityBody .choice-button').nth(choiceIndex).click();
      assert.equal(await page.locator('#activityBody .choice-button').nth(choiceIndex).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: '检查答案', exact: true }).click();
      assert.equal(lastAction.action.response.optionId, choice.id, 'the selected answer survives the audio playback report');
      await page.waitForTimeout(100);
      const observed = await page.evaluate(() => ({ progress: document.querySelector('#progressLabel')?.textContent,
        status: document.querySelector('#courseStatus')?.textContent, prompt: document.querySelector('.activity-prompt')?.textContent }));
      const last = activity === pkg.lessons[0].activities.at(-1);
      if (last ? observed.progress !== '本节完成' : !observed.progress.includes('第 ' + (pkg.lessons[0].activities.indexOf(activity) + 2)))
        throw Error('Answer did not advance: ' + JSON.stringify({choice, observed, lastAction}));
    }
    const Database = require('../server/node_modules/better-sqlite3');
    const isolatedDb = new Database(path.join(temp, 'data', 'chunklab.db'));
    isolatedDb.prepare('UPDATE expression_skill_states SET due_at=0 WHERE course_id=?').run(pkg.courseId);
    isolatedDb.close();
    await page.getByRole('link', { name: '下一课：没听清时请求重复', exact: true }).click();
    await page.waitForURL(/lesson=L103/);
    await page.getByRole('heading', { name: /没听清时请求重复/ }).waitFor();
    await page.getByRole('button', { name: /^复习：/ }).click();
    await page.locator('#activityBody .activity-prompt').waitFor();
    assert.equal(accessStart.unitId, 'lesson-L101', 'review access is bound to the due lesson, not the page lesson');
    assert.equal(sessionStart.lessonId, 'L101', 'review session starts the due lesson');
    assert.equal(sessionStart.mode, 'review');
    const reviewActivity = pkg.lessons[0].activities.find(activity => activity.id === 'L101_A08');
    await page.getByRole('button', { name: '播放音频', exact: true }).click();
    await page.getByText('音频播放完成，可以继续作答。', { exact: true }).waitFor();
    const reviewOption = reviewActivity.payload.options.find(item => item.id === reviewActivity.evaluation.correctOptionId);
    await page.locator('#activityBody .choice-button').nth(reviewActivity.payload.options.indexOf(reviewOption)).click();
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await page.getByRole('heading', { name: '这节完成了', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /^下一课/ }).count(), 0, 'review completion returns without advancing the teaching sequence');
    await page.goto(base + '/expression-learn.html?course=' + encodeURIComponent(pkg.courseId) + '&lesson=L103');
    await page.getByRole('button', { name: '开始学习', exact: true }).click();
    for (let index = 0; index < pkg.lessons[1].activities.length; index++) {
      const activity = pkg.lessons[1].activities[index];
      if (activity.type === 'meaning_intro') {
        if (activity.payload.audioAssetId) {
          await page.getByRole('button', { name: '播放示范', exact: true }).click();
          await page.getByText('音频播放完成，可以继续作答。', { exact: true }).waitFor();
        }
        await page.getByRole('button', { name: '继续', exact: true }).click();
      } else if (activity.type === 'listening_choice') {
        await page.getByRole('button', { name: '播放音频', exact: true }).click();
        const correct = activity.payload.options.find(item => item.id === activity.evaluation.correctOptionId);
        await page.locator('#activityBody .choice-button').nth(activity.payload.options.indexOf(correct)).click();
        await page.getByRole('button', { name: '检查答案', exact: true }).click();
        assert.equal(lastAction.action.response.optionId, correct.id);
      } else {
        await fillWordSlots(page, activity.evaluation.acceptedAnswers[0]);
        await page.getByRole('button', { name: '检查答案', exact: true }).click();
        assert.equal(lastAction.action.response.text, activity.evaluation.acceptedAnswers[0]);
      }
      if (index < pkg.lessons[1].activities.length - 1) {
        await page.waitForFunction(next => document.querySelector('#progressLabel')?.textContent === `第 ${next} 步`, index + 2);
        if (index === 0) {
          await page.reload();
          await page.getByRole('button', { name: '开始学习', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('#progressLabel')?.textContent === '第 2 步');
        }
      }
    }
    await page.getByRole('heading', { name: '这节完成了', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /^下一课/ }).count(), 0, 'last lesson has no dangling next-course link');
    await page.locator('#activityBody').getByRole('link', { name: '返回我的内容', exact: true }).waitFor();
    fs.mkdirSync(acceptanceDir, { recursive: true });
    await page.screenshot({ path: path.join(acceptanceDir, 'formal-player-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 360, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(acceptanceDir, 'formal-player-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 938, height: 932 });
    await page.goto(base + '/main.html?view=discover');
    const discoverCard = page.locator(`#discoverBody .workspace-card[data-resource="course:${pkg.courseId}"]`);
    await discoverCard.locator('.content-card-menu summary').click();
    await discoverCard.getByRole('button', { name: '加入学习', exact: true }).click();
    await page.waitForURL(/expression-learn\.html\?course=/);
    await page.goto(base + '/main.html?view=my-learning');
    const joinedCard = page.locator(`#myLearningBody .workspace-card[data-resource="course:${pkg.courseId}"]`);
    await joinedCard.waitFor({ state: 'attached', timeout: 20000 });
    assert.equal(await joinedCard.count(), 1, 'joined course appears once in the learner library');
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 360, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
    await context.close();
  } catch (error) { error.message += '\nIsolated service log:\n' + logs; throw error; }
  finally {
    if (browser) await browser.close().catch(() => {});
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    const target = path.resolve(temp), tmp = fs.realpathSync(os.tmpdir());
    assert.ok(target.startsWith(tmp + path.sep) && target !== tmp, 'cleanup is restricted to allocated temporary test directory');
    fs.rmSync(target, { recursive: true, force: true });
  }
});
