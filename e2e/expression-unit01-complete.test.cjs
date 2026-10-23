'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright-core');
const root = path.resolve(__dirname, '..');
const packageDir = path.join(root, 'output/expression-course-drafts/unit01-complete-v2');

async function fillWordSlots(page, answer) {
  const words = answer.trim().replace(/[.!?]+$/, '').split(/\s+/);
  const slots = page.getByRole('group', { name: '逐词输入英文表达' }).getByRole('textbox');
  for (const [index, word] of words.entries()) await slots.nth(index).fill(word);
}

test('five-lesson candidate completes in the formal player with real audio and optional text output', {timeout: 180000}, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'expression-unit01-complete-e2e-'));
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  const port = require('./lib/free-port').freePort(19400, 100), base = `http://127.0.0.1:${port}`;
  const appRoot = path.join(temp, 'app'); fs.mkdirSync(path.join(appRoot, 'content'), {recursive: true});
  fs.copyFileSync(path.join(root, 'content/manifest.json'), path.join(appRoot, 'content/manifest.json'));
  require('./lib/prepare-ui-root')(appRoot);
  const env = {...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), CHUNKLAB_DATA_DIR: path.join(temp, 'data'),
    CHUNKLAB_APP_ROOT: appRoot, EXPRESSION_COURSES_ENABLED: 'true', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
    JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_PASSWORD: 'isolated-unit01-complete-admin-pass',
    ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'), MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64')};
  let server, browser, logs = '';
  const log = data => { logs += data.toString(); };
  try {
    server = spawn(process.execPath, ['index.js'], {cwd: path.join(root, 'server'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout.on('data', log); server.stderr.on('data', log);
    for (let i = 0; i < 150; i++) {
      if (server.exitCode !== null) throw Error('isolated service exited: ' + logs);
      try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 100));
      if (i === 149) throw Error('isolated service did not start: ' + logs);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'course-package.json'), 'utf8'));
    const admin = await (await fetch(base + '/api/admin/login', {method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({password: env.ADMIN_PASSWORD})})).json();
    const headers = {authorization: 'Bearer ' + admin.token, 'content-type': 'application/json'};
    for (const asset of pkg.assets) {
      const uploaded = await fetch(base + '/api/admin/expression-assets', {method: 'POST', headers,
        body: JSON.stringify({assetId: asset.assetId, mimeType: asset.mimeType, base64: fs.readFileSync(path.join(packageDir, asset.localFile)).toString('base64')})});
      assert.equal(uploaded.status, 201);
      const receipt = await uploaded.json(); assert.equal(receipt.sha256, asset.sha256); assert.equal(receipt.size, asset.size);
    }
    const draft = await (await fetch(base + '/api/admin/expression-drafts', {method: 'POST', headers,
      body: JSON.stringify({package: pkg, requestId: 'unit01-complete-draft-001'})})).json();
    const checked = await (await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/validate`, {method: 'POST', headers})).json();
    assert.equal(checked.valid, true, JSON.stringify(checked.errors));
    await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/review`, {method: 'POST', headers,
      body: JSON.stringify({contentHash: checked.contentHash})});
    const published = await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/publish`, {method: 'POST', headers,
      body: JSON.stringify({expectedRevision: draft.revision, contentHash: checked.contentHash, requestId: 'unit01-complete-pub-001'})});
    assert.equal(published.status, 200, 'candidate is published only inside the disposable test service');

    const registration = await fetch(base + '/api/auth/register', {method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({username: 'unit01-complete-learner', password: 'unit01-complete-password'})});
    assert.equal(registration.status, 200); const learner = await registration.json();
    const context = await (await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath()}))
      .newContext({serviceWorkers: 'block', viewport: {width: 938, height: 932}});
    browser = context.browser();
    await context.addInitScript(token => localStorage.setItem('chunklab_token', token), learner.token);
    await context.addInitScript(() => {
      const NativeAudio = window.Audio;
      window.Audio = function(...args) { const audio = new NativeAudio(...args); window.__courseAudio = audio; return audio; };
      window.Audio.prototype = NativeAudio.prototype;
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let lastAction = null, sessionStart = null;
    page.on('request', request => { if (request.url().includes('/api/expression-sessions/') && request.url().endsWith('/actions')) lastAction = request.postDataJSON(); });
    page.on('request', request => { if (request.url().endsWith('/api/expression-sessions') && request.method() === 'POST') sessionStart = request.postDataJSON(); });
    await page.goto(base + '/main.html?view=discover');
    const card = page.locator(`#discoverBody .workspace-card[data-resource="course:${pkg.courseId}"]`);
    await card.waitFor({state: 'attached', timeout: 20000});
    await card.locator('.content-card-title').click();
    await page.waitForURL(/expression-learn\.html\?course=/);
    await page.locator('#courseDirectory:not([hidden])').waitFor();
    assert.equal(await page.locator('#lessonCards .catalog-lesson').count(), 5, 'all five units use shared lesson cards');
    assert.equal(await page.locator('.unit-quick-index button').count(),5);
    await page.locator('.unit-quick-index button').first().click();
    assert.equal(await page.locator('#lessonCards .catalog-lesson:visible').count(),1);
    await page.locator('.unit-quick-index button').first().click();
    assert.equal(await page.locator('#unitFilters [data-filter="all"]').innerText(),'全部（5）');
    assert.equal(await page.locator('#reviewWrongUnits').isEnabled(),false);
    await page.setViewportSize({width:360,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overview fits mobile');
    await page.setViewportSize({width:938,height:932});
    await page.locator('#unitSearch').fill('姓名');
    assert.equal(await page.locator('#lessonCards .catalog-lesson:visible').count(),1);
    await page.locator('#unitSearch').fill('');
    await page.locator('#unitFilters [data-filter="completed"]').click();
    await page.locator('#unitEmpty').waitFor({state:'visible'});
    await page.locator('#unitFilters [data-filter="all"]').click();
    assert.ok((await page.locator('.back-link').getAttribute('href')).includes('view=discover'));
    await page.locator('#lessonCards .catalog-lesson').first().click();
    await page.getByRole('button', {name:'开始学习',exact:true}).waitFor();
    await page.locator('.back-link').click();
    await page.locator('#courseDirectory:not([hidden])').waitFor();
    assert.equal(await page.locator('#lessonCards .catalog-lesson').count(),5,'unit returns to course directory');
    await page.route('**/api/expression-courses/'+pkg.courseId,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'隔离测试：课程服务暂不可用'})}));
    await page.reload();
    await page.locator('#retryCourse').waitFor({state:'visible'});
    assert.equal(await page.locator('#courseIntro').innerText(),'课程暂时未能加载。');
    await page.unroute('**/api/expression-courses/'+pkg.courseId);
    await page.locator('#retryCourse').click();
    await page.locator('#courseDirectory:not([hidden])').waitFor();
    await page.getByRole('button', {name: '开始学习', exact: true}).click();

    for (let lessonIndex = 0; lessonIndex < pkg.lessons.length; lessonIndex++) {
      const lesson = pkg.lessons[lessonIndex];
      await page.getByRole('heading', {name: new RegExp(lesson.title)}).waitFor();
      for (let activityIndex = 0; activityIndex < lesson.activities.length; activityIndex++) {
        const activity = lesson.activities[activityIndex];
        if (activity.type === 'meaning_intro') {
          await page.getByRole('button', {name: '播放示范', exact: true}).click();
          await page.getByText('音频播放完成，可以继续作答。', {exact: true}).waitFor();
          const played = await page.waitForFunction(() => {
            const audio = window.__courseAudio;
            return audio && audio.duration > 0 && audio.currentTime > 0 ? {duration: audio.duration, currentTime: audio.currentTime} : false;
          });
          const audio = await played.jsonValue();
          assert.ok(audio.duration > 0 && audio.currentTime > 0, `${lesson.lessonId} audio decoded and played`);
          await page.getByRole('button', {name: '继续', exact: true}).click();
        } else if (activity.type === 'listening_choice') {
          await page.getByRole('button', {name: '播放音频', exact: true}).click();
          await page.getByText('音频播放完成，可以继续作答。', {exact: true}).waitFor();
          const correct = activity.payload.options.find(option => option.id === activity.evaluation.correctOptionId);
          await page.locator('#activityBody .choice-button').nth(activity.payload.options.indexOf(correct)).click();
          await page.getByRole('button', {name: '检查答案', exact: true}).click();
          assert.equal(lastAction.action.response.optionId, correct.id);
        } else if (lesson.lessonId === 'L102' && activity.id === 'L102_A07') {
          await page.getByRole('button', {name: '暂时跳过', exact: true}).click();
          assert.equal(lastAction.action.type, 'skip_output');
          const Database = require('../server/node_modules/better-sqlite3');
          const db = new Database(path.join(temp, 'data', 'chunklab.db'), {readonly: true});
          const row = db.prepare("SELECT state_json FROM expression_sessions WHERE course_id=? AND lesson_id='L102'").get(pkg.courseId);
          const state = JSON.parse(row.state_json);
          assert.equal(state.evidence.greet_and_say_goodbye?.independent || false, false, 'skipping does not record independent output evidence');
          db.close();
        } else {
          await fillWordSlots(page, activity.evaluation.acceptedAnswers[0]);
          await page.getByRole('button', {name: '检查答案', exact: true}).click();
          assert.equal(lastAction.action.response.text, activity.evaluation.acceptedAnswers[0]);
        }
        if (activityIndex < lesson.activities.length - 1) {
          await page.waitForFunction(next => document.querySelector('#progressLabel')?.textContent === `第 ${next} 步`, activityIndex + 2);
          if (lesson.lessonId === 'L103' && activityIndex === 0) {
            await page.reload();
            await page.getByRole('button', {name: '开始学习', exact: true}).click();
            await page.waitForFunction(() => document.querySelector('#progressLabel')?.textContent === '第 2 步');
          }
        }
      }
      await page.getByRole('heading', {name: '这节完成了', exact: true}).waitFor();
      const summary = await page.evaluate(id => ChunkAPI.request('/api/expression-courses/' + id), pkg.courseId);
      assert.equal(summary.progress.completed, lessonIndex + 1, 'directory counts each completed unit once');
      const nextLesson = pkg.lessons[lessonIndex + 1];
      const nextLink = page.getByRole('link', {name: new RegExp(`下一课：${nextLesson?.title || '.*'}`)});
      if (nextLesson) {
        if (lesson.lessonId === 'L102') {
          const Database = require('../server/node_modules/better-sqlite3');
          const db = new Database(path.join(temp, 'data', 'chunklab.db'));
          db.prepare("UPDATE expression_skill_states SET due_at=0 WHERE course_id=? AND skill_id='greet_and_say_goodbye'").run(pkg.courseId);
          db.close();
        }
        await nextLink.waitFor();
        await nextLink.click();
        await page.waitForURL(new RegExp(`lesson=${nextLesson.lessonId}`));
        if (lesson.lessonId === 'L102') {
          await page.getByRole('button', {name: /^复习：/}).click();
          await fillWordSlots(page, 'Hello');
          await page.getByRole('button', {name: '检查答案', exact: true}).click();
          assert.equal(sessionStart.lessonId, 'L102', 'due review starts the lesson that owns the due skill');
          assert.equal(sessionStart.mode, 'review');
          await page.getByRole('heading', {name: '这节完成了', exact: true}).waitFor();
          await page.goto(`${base}/expression-learn.html?course=${encodeURIComponent(pkg.courseId)}&lesson=${nextLesson.lessonId}`);
          await page.getByRole('button', {name: '开始学习', exact: true}).click();
        } else {
          await page.getByRole('button', {name: '开始学习', exact: true}).click();
        }
      } else {
        assert.equal(await page.getByRole('link', {name: /^下一课/}).count(), 0, 'last lesson has no dangling next lesson');
      }
    }
    await page.setViewportSize({width: 360, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile player has no horizontal overflow');
    await page.goto(`${base}/expression-learn.html?course=${encodeURIComponent(pkg.courseId)}`);
    await page.getByText(/总进度 100%/).waitFor();
    assert.equal(await page.locator('#lessonCards .lesson-meta').filter({hasText: '已完成'}).count(), 5);
    await page.goto(base + '/main.html?view=home');
    await page.waitForFunction(() => window.CourseEnrollment && window.ChunkAPI?.isLoggedIn());
    await page.evaluate(id => CourseEnrollment.join(id), pkg.courseId);
    await page.reload();
    await page.locator('.home-completed-courses > summary').click();
    const homeCourse = page.getByRole('button', {name: new RegExp('学习 ' + pkg.title)});
    await homeCourse.getByText('已完成 5 / 5 单元', {exact: true}).waitFor().catch(async error => { error.message += '\nHome snapshot: ' + await page.locator('#homeBody').innerText(); throw error; });
    assert.equal(await homeCourse.locator('.home-progress-metric b').first().innerText(), '100%');
    await homeCourse.click();
    await page.waitForURL(/expression-learn\.html/);
    await page.locator('#courseDirectory:not([hidden])').waitFor();
    assert.ok((await page.locator('.back-link').getAttribute('href')).includes('view=home'),'home entry preserves its return destination');
    await page.goto(`${base}/main.html?protectedCourse=${encodeURIComponent(pkg.courseId)}&returnTo=main.html%3Fview%3Dhome`);
    await page.waitForURL(/expression-learn\.html/);
    await page.locator('#courseDirectory:not([hidden])').waitFor();
    await page.goto(base+'/main.html?view=my-learning');
    await page.locator('#myLearningBody .content-card-title').filter({hasText:pkg.title}).click();
    await page.waitForURL(/expression-learn\.html/);
    await page.locator('#courseDirectory:not([hidden])').waitFor();
    assert.deepEqual(errors, []);
    await page.close(); await context.close();
  } catch (error) { error.message += '\nIsolated service log:\n' + logs; throw error; }
  finally {
    if (browser) await browser.close().catch(() => {});
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    const target = path.resolve(temp), tmp = fs.realpathSync(os.tmpdir());
    assert.ok(target.startsWith(tmp + path.sep) && target !== tmp, 'cleanup is restricted to the allocated temporary test directory');
    fs.rmSync(target, {recursive: true, force: true});
  }
});
