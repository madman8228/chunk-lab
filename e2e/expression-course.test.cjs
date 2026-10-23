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

function wavTone() {
  const sampleRate = 16000, samples = sampleRate / 2, bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / sampleRate) * 5000), 44 + i * 2);
  return bytes;
}

async function waitForServer(base, server, getLogs) {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error('isolated server exited: ' + getLogs());
    try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated server timed out: ' + getLogs());
}

async function waitUntil(predicate, label) {
  for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error('timed out waiting for ' + label);
}

async function waitStep(page, index) {
  await page.waitForFunction(expected => document.getElementById('progressLabel')?.textContent === `第 ${expected} 步`, index);
}

async function fillWordSlots(page, answer) {
  const words = answer.trim().replace(/[.!?]+$/, '').split(/\s+/);
  const slots = page.getByRole('group', { name: '逐词输入英文表达' }).getByRole('textbox');
  for (const [index, word] of words.entries()) await slots.nth(index).fill(word);
}

test('synthetic expression course supports admin creation, playable audio, and safe action retry', { timeout: 120000 }, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'expression-course-e2e-'));
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep), 'all mutable test data stays in a new temporary directory');
  const port = require('./lib/free-port').freePort(18880, 100), base = `http://127.0.0.1:${port}`;
  const appRoot = path.join(temp, 'app'); fs.mkdirSync(path.join(appRoot, 'content'), { recursive: true });
  fs.copyFileSync(path.join(root, 'content/manifest.json'), path.join(appRoot, 'content/manifest.json'));
  require('./lib/prepare-ui-root')(appRoot);
  const serverEnv = { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), CHUNKLAB_DATA_DIR: path.join(temp, 'data'),
    CHUNKLAB_APP_ROOT: appRoot, EXPRESSION_COURSES_ENABLED: 'true', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
    JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_PASSWORD: 'isolated-expression-admin-pass',
    ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'), MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64') };
  let server, browser, logs = '';
  const append = chunk => { logs += chunk.toString(); };
  try {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'), env: serverEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', append); server.stderr.on('data', append);
    await waitForServer(base, server, () => logs);

    const adminLogin = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: serverEnv.ADMIN_PASSWORD }) });
    assert.equal(adminLogin.status, 200); const admin = await adminLogin.json();
    const adminContext = await (await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() })).newContext({ serviceWorkers: 'block' });
    browser = adminContext.browser();
    await adminContext.addInitScript(token => localStorage.setItem('chunklab_admin_token', token), admin.token);
    const adminPage = await adminContext.newPage();

    const courseId = 'expression-e2e-' + crypto.randomUUID().slice(0, 8);
    const lesson = JSON.parse(fs.readFileSync(path.join(root, 'src/expression-course/fixtures/L001-like.reference.json'), 'utf8'));
    lesson.audioAssets.forEach(item => { item.status = 'ready'; });
    const pkg = { format: 'chunklab-expression-course', formatVersion: '1.0', courseId, title: '隔离表达课验收',
      description: 'Synthetic test course. Tone audio validates decoding only; it is not teaching speech.', audience: 'adult_beginner',
      lessons: [lesson], assets: lesson.audioAssets.map(item => ({ assetId: item.assetId, mimeType: 'audio/wav', localFile: item.assetId + '.wav' })),
      reviewActivities: [{ lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A08' }, { lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A09' }] };
    const validTitle = pkg.title; pkg.title = 'X';
    const fixtureRoot = path.join(temp, 'fixture'); fs.mkdirSync(fixtureRoot);
    const packageFile = path.join(fixtureRoot, 'package.json'); fs.writeFileSync(packageFile, JSON.stringify(pkg));
    const tone = wavTone(), audioPaths = lesson.audioAssets.map(item => path.join(fixtureRoot, item.assetId + '.wav'));
    audioPaths.forEach(file => fs.writeFileSync(file, tone));

    await adminPage.goto(base + '/expression-create.html');
    await adminPage.getByRole('button', { name: /我还没有课程 JSON/ }).click();
    await adminPage.locator('#aiPath:not([hidden])').waitFor();
    assert.equal(await adminPage.locator('#directImportPath:not([hidden])').count(), 0, 'AI creation and direct import are not presented together');
    await adminPage.locator('#changeWorkflow').click();
    await adminPage.getByRole('button', { name: /我已经有课程 JSON/ }).click();
    await adminPage.locator('#directImportPath:not([hidden])').waitFor();
    assert.equal(await adminPage.locator('#aiPath:not([hidden])').count(), 0, 'direct import hides the AI prompt path');
    await adminPage.locator('#importPackage').setInputFiles(packageFile);
    await adminPage.locator('#packageWorkspace:not([hidden])').waitFor();
    await adminPage.locator('#packageEditor').evaluate(element => { element.open = true; });
    await adminPage.locator('#uploadAudio').setInputFiles(audioPaths);
    await adminPage.getByRole('button', { name: /只保存草稿/ }).click();
    await adminPage.getByText(/草稿已保存/).waitFor();
    await adminPage.getByRole('button', { name: '检查课程并保存', exact: true }).click();
    await adminPage.getByText('发现需要修正的问题，请按检查结果处理后重新检查。', { exact: true }).waitFor();
    const correctedPackage = JSON.parse(await adminPage.locator('#packageInput').inputValue());
    correctedPackage.title = validTitle;
    await adminPage.locator('#packageInput').fill(JSON.stringify(correctedPackage, null, 2));
    await adminPage.getByRole('button', { name: /只保存草稿/ }).click();
    await adminPage.getByText(/草稿已保存/).waitFor();
    await adminPage.getByRole('button', { name: '检查课程并保存', exact: true }).click();
    await adminPage.getByText(/检查通过并已保存草稿/).waitFor();
    await adminPage.getByRole('button', { name: '试听第一步', exact: true }).click();
    await adminPage.locator('#preview:not([hidden])').waitFor();
    await adminPage.getByRole('button', { name: '确认内容无误', exact: true }).click();
    await adminPage.getByText('内容确认完成，发布按钮已开放。', { exact: true }).waitFor();
    await adminPage.getByRole('button', { name: '发布到系统课程目录', exact: true }).click();
    await adminPage.getByText(new RegExp(`已发布到系统课程目录：${courseId}`)).waitFor();
    const registration = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'expression-e2e-learner', password: 'expression-test-password' }) });
    assert.equal(registration.status, 200); const learner = await registration.json();
    const draftsForLearner = await fetch(base + '/api/admin/expression-drafts', { headers: { authorization: 'Bearer ' + learner.token } });
    assert.equal(draftsForLearner.status, 401, 'ordinary learners cannot read private drafts');
    const learnerContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 360, height: 844 } });
    await learnerContext.addInitScript(token => {
      if (!localStorage.getItem('chunklab.session.v1')) localStorage.setItem('chunklab_token', token);
    }, learner.token);
    const page = await learnerContext.newPage();
    page.setDefaultTimeout(8000);
    const activityRequests = [], lostResponse = { value: false }, targetRequestBodies = [];
    let denyNextSubmit = false;
    await page.route('**/api/expression-sessions/*/actions', async route => {
      const body = route.request().postDataJSON(); activityRequests.push(body);
      if (denyNextSubmit && body.action?.type === 'submit') {
        denyNextSubmit = false;
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'AUTHORIZATION_EXPIRED' }) });
        return;
      }
      if (body.action?.type === 'submit' && body.action.response?.optionId === 'coffee') {
        targetRequestBodies.push(body);
        const response = await route.fetch();
        if (!lostResponse.value) { lostResponse.value = true; await route.abort('failed'); return; }
        await route.fulfill({ response }); return;
      }
      await route.continue();
    });
    let sessionId = '', startedReleaseId = '';
    page.on('response', async response => {
      if (response.url() === base + '/api/expression-sessions' && response.request().method() === 'POST' && response.status() === 201) {
        try { const data = await response.json(); sessionId = data.sessionId; startedReleaseId = data.releaseId; } catch (_) {}
      }
    });
    await page.goto(base + '/main.html?view=discover');
    const card = page.locator(`#discoverBody .workspace-card[data-resource="course:${courseId}"]`);
    await card.waitFor({ state: 'attached', timeout: 20000 });
    await card.locator('.content-card-title').click();
    await page.waitForURL(/expression-learn\.html\?course=/);
    await page.locator('#startButton').click();

    await page.getByRole('button', { name: '继续', exact: true }).click();
    await waitStep(page, 2);
    assert.equal(await page.getByRole('button', { name: '检查答案', exact: true }).count(), 0,
      'sentence-building activities auto-submit on the final required chunk and must not show a manual check button');
    for (const token of ['I', 'like', 'tea']) await page.getByRole('button', { name: '选择词块：' + token, exact: true }).click();
    await waitStep(page, 3);
    for (const token of ['I', 'like', 'coffee']) await page.getByRole('button', { name: '选择词块：' + token, exact: true }).click();
    await waitStep(page, 4);
    const learningProgress = await page.evaluate(id => ChunkAPI.request('/api/expression-courses/' + id), courseId);
    assert.equal(learningProgress.progress.lessons[0].status, 'in_progress');
    assert.ok(learningProgress.progress.percent > 0 && learningProgress.progress.percent < 100);
    await page.getByRole('button', { name: '显示答案', exact: true }).click();
    await page.getByText('参考答案：I like tea.', { exact: true }).waitFor();
    await page.reload();
    await page.locator('#startButton').click();
    await page.getByText('参考答案：I like tea.', { exact: true }).waitFor();
    const answerFields = page.getByRole('group', { name: '逐词输入英文表达' }).getByRole('textbox');
    assert.equal(await answerFields.count(), 3, 'substitution step uses one compact blank per configured word');
    await answerFields.nth(0).focus();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '第 1 个单词', 'word blanks are keyboard-focusable');
    for (const [index, word] of ['I', 'like', 'tea'].entries()) await answerFields.nth(index).fill(word);
    const answerText = async () => (await answerFields.evaluateAll(nodes => nodes.map(node => node.value.trim()).filter(Boolean).join(' ')));
    assert.equal(await answerText(), 'I like tea', 'word blanks build the same text answer sent to the evaluator');
    denyNextSubmit = true;
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await page.getByText(/学习权限已到期。已完成的步骤会保留；当前答案尚未提交，请恢复权限后继续。/).waitFor();
    assert.equal(await answerText(), 'I like tea', 'permission expiry does not clear the unsent answer');
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await waitStep(page, 5);
    for (const [index, word] of ['I', 'like', 'coffee'].entries()) await page.getByRole('group', { name: '逐词输入英文表达' }).getByRole('textbox').nth(index).fill(word);
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await waitStep(page, 6);

    const guidedState = await page.evaluate(id => ChunkAPI.request('/api/expression-sessions/' + encodeURIComponent(id)), sessionId);
    assert.equal(guidedState.state.index, 5, 'guided steps should have advanced to the first listening question');
    await page.getByText('第 6 步', { exact: true }).waitFor();
    assert.equal(await page.locator('#activityBody').innerText().then(text => text.includes('播放音频')), true,
      'the sixth lesson activity should render the listening player');
    await page.getByRole('button', { name: '播放音频', exact: true }).click();
    await waitUntil(() => activityRequests.some(item => item.action?.type === 'audio_played'), 'audio playback report');
    await page.getByRole('button', { name: '我喜欢咖啡。', exact: true }).click();
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('courseStatus')?.textContent.includes('Failed to fetch') || document.getElementById('courseStatus')?.textContent.includes('fetch'), null, { timeout: 10000 }).catch(() => {});
    const primary = page.getByRole('button', { name: '检查答案', exact: true });
    await primary.waitFor({ state: 'visible' }); await primary.waitFor({ state: 'attached' });
    await page.waitForFunction(() => { const button = document.querySelector('#activityActions button'); return button && !button.disabled; });
    await primary.click();
    await page.getByText('答对了', { exact: true }).waitFor();
    assert.equal(targetRequestBodies.length, 2, 'lost-response action was retried once');
    assert.equal(targetRequestBodies[0].requestId, targetRequestBodies[1].requestId, 'retry must reuse the original requestId');
    const audioReport = activityRequests.find(item => item.action?.type === 'audio_played');
    assert.ok(audioReport, 'successful audio playback start is reported to the server');
    assert.equal((await fetch(base + '/api/expression-courses/' + courseId, { headers: { authorization: 'Bearer ' + learner.token } })).status, 200);
    assert.ok(sessionId, 'learning session was created');
    await page.reload();
    await page.locator('#startButton').click();
    await page.getByText('第 7 步', { exact: true }).waitFor();
    await page.getByRole('button', { name: '播放音频', exact: true }).click();
    await waitUntil(() => activityRequests.filter(item => item.action?.type === 'audio_played').length === 2, 'second listening audio report');
    await page.getByRole('button', { name: '我喜欢茶。', exact: true }).click();
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await waitStep(page, 8);
    await fillWordSlots(page, 'I like tea.');
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await waitStep(page, 9);
    await fillWordSlots(page, 'I like milk.');
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await page.getByRole('heading', { name: '这节完成了', exact: true }).waitFor();
    const completedProgress = await page.evaluate(id => ChunkAPI.request('/api/expression-courses/' + id), courseId);
    assert.equal(completedProgress.progress.percent, 100);
    assert.equal(completedProgress.progress.lessons[0].status, 'completed');
    const db = new (require(require.resolve('better-sqlite3', { paths: [path.join(root, 'server')] })))(path.join(temp, 'data', 'chunklab.db'));
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM expression_attempts WHERE request_id=?').get(targetRequestBodies[0].requestId).count, 1,
        'server stores a single attempt after the duplicated delivery');
      assert.equal(db.prepare('SELECT revision FROM expression_sessions WHERE session_id=?').get(sessionId).revision, 12,
        'resume, answer reveal, audio reports, answers and the lost response retry advance the session exactly once each');
      db.prepare('UPDATE expression_skill_states SET due_at=0 WHERE course_id=? AND skill_id=?').run(courseId, 'express_like');
    } finally { db.close(); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'player fits a narrow mobile viewport');
    const dueResponse = await fetch(base + '/api/expression-reviews/due', { headers: { authorization: 'Bearer ' + learner.token } });
    assert.equal(dueResponse.status, 200); const due = await dueResponse.json();
    const dueItem = due.items.find(item => item.courseId === courseId);
    assert.ok(dueItem, 'completed synthetic skill is surfaced as due for review');
    await page.goto(base + '/expression-learn.html?course=' + encodeURIComponent(courseId));
    await page.getByRole('button', { name: '复习：隔离表达课验收', exact: true }).click();
    await page.getByText('第 1 步', { exact: true }).waitFor();
    const reviewAnswer = dueItem.activityId === 'L001_A09' ? 'I like milk.' : 'I like tea.';
    await fillWordSlots(page, reviewAnswer);
    await page.getByRole('button', { name: '检查答案', exact: true }).click();
    await page.getByRole('heading', { name: '这节完成了', exact: true }).waitFor();
    const reviewed = await fetch(base + '/api/expression-reviews/due', { headers: { authorization: 'Bearer ' + learner.token } });
    assert.equal((await reviewed.json()).items.some(item => item.courseId === courseId), false, 'successful review advances the due schedule');

    await page.goto(base + '/expression-learn.html?course=' + encodeURIComponent(courseId));
    await page.locator('#startButton').click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    for (const token of ['I', 'like', 'tea']) await page.getByRole('button', { name: '选择词块：' + token, exact: true }).click();
    for (const token of ['I', 'like', 'coffee']) await page.getByRole('button', { name: '选择词块：' + token, exact: true }).click();
    await page.getByText('第 4 步', { exact: true }).waitFor();
    const pinnedReleaseId = startedReleaseId;
    const adminCatalogResponse = await fetch(base + '/api/admin/expression-courses', { headers: { authorization: 'Bearer ' + admin.token } });
    assert.equal(adminCatalogResponse.status, 200);
    const catalogCourse = (await adminCatalogResponse.json()).courses.find(item => item.courseId === courseId);
    const originalPackage = structuredClone(catalogCourse.package);
    await adminPage.goto(base + '/expression-create.html');
    await adminPage.getByRole('button', { name: '复制为新草稿', exact: true }).click();
    await adminPage.getByText('已复制为新草稿；原发布版本不会被改动。', { exact: true }).waitFor();
    await adminPage.locator('#packageEditor').evaluate(element => { element.open = true; });
    const v2Package = JSON.parse(await adminPage.locator('#packageInput').inputValue());
    assert.deepEqual(v2Package, originalPackage, 'the revision draft starts as an exact copy of the active release');
    v2Package.lessons[0].activities.find(item => item.id === 'L001_A04').prompt = '新版提示：用茶造句';
    await adminPage.locator('#packageInput').fill(JSON.stringify(v2Package, null, 2));
    await adminPage.getByRole('button', { name: /只保存草稿/ }).click();
    await adminPage.getByText(/草稿已保存/).waitFor();
    await adminPage.getByRole('button', { name: '检查课程并保存', exact: true }).click();
    await adminPage.getByText(/检查通过并已保存草稿/).waitFor();
    await adminPage.getByRole('button', { name: '确认内容无误', exact: true }).click();
    await adminPage.getByText('内容确认完成，发布按钮已开放。', { exact: true }).waitFor();
    await adminPage.getByRole('button', { name: '发布到系统课程目录', exact: true }).click();
    await adminPage.getByText(new RegExp(`已发布到系统课程目录：${courseId}`)).waitFor();
    const revisionResponse = await fetch(base + '/api/admin/expression-courses', { headers: { authorization: 'Bearer ' + admin.token } });
    assert.equal(revisionResponse.status, 200);
    const activeAfterRevision = (await revisionResponse.json()).courses.find(item => item.courseId === courseId);
    const expectedPackage = structuredClone(originalPackage);
    expectedPackage.lessons[0].activities.find(item => item.id === 'L001_A04').prompt = '新版提示：用茶造句';
    assert.deepEqual(activeAfterRevision.package, expectedPackage, 'one activity can be revised without changing other course content');
    const v2Release = { releaseId: activeAfterRevision.releaseId };
    assert.notEqual(v2Release.releaseId, pinnedReleaseId);
    const revisionDb = new (require(require.resolve('better-sqlite3', { paths: [path.join(root, 'server')] })))(path.join(temp, 'data', 'chunklab.db'));
    try {
      const oldRelease = revisionDb.prepare('SELECT content_json FROM expression_releases WHERE course_id=? AND release_id=?').get(courseId, pinnedReleaseId);
      assert.deepEqual(JSON.parse(oldRelease.content_json), originalPackage, 'publishing the correction preserves the previous immutable release');
    } finally { revisionDb.close(); }
    await page.reload();
    await page.locator('#startButton').click();
    await page.getByText('第 4 步', { exact: true }).waitFor();
    assert.equal(startedReleaseId, pinnedReleaseId, 'the browser resumes the unfinished session on its original release');
    assert.equal(await page.locator('#activityBody .activity-prompt').textContent(), '换成‘茶’，自己输入一句话',
      'the original version activity is rendered after the newer release is published');

    const secondRegistration = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'expression-e2e-second', password: 'expression-test-password' }) });
    assert.equal(secondRegistration.status, 200); const secondLearner = await secondRegistration.json();
    await page.goto(base + '/expression-learn.html?course=' + encodeURIComponent(courseId));
    await page.locator('#startButton').click();
    await page.getByText('第 4 步', { exact: true }).waitFor();
    const sensitiveWordSlots = page.getByRole('group', { name: '逐词输入英文表达' }).getByRole('textbox');
    for (const [index, word] of ['SECRET', 'OLD', 'ACCOUNT'].entries()) await sensitiveWordSlots.nth(index).fill(word);
    const switchPage = await learnerContext.newPage();
    await switchPage.goto(base + '/main.html');
    const accountReload = page.waitForEvent('load', { timeout: 10000 });
    await switchPage.evaluate(token => ChunkAPI.setSession('', token), secondLearner.token);
    await accountReload;
    await page.locator('#startButton').waitFor();
    assert.equal(await page.locator('body').innerText().then(text => text.includes('SECRET OLD ACCOUNT')), false,
      'switching accounts reloads the player without exposing the previous account input');
    assert.equal(await page.evaluate(() => document.documentElement.style.visibility), '', 'reloaded player is visible for the new account');
    await switchPage.close();

    await learnerContext.close(); await adminContext.close();
  } catch (error) {
    error.message += '\nIsolated server log:\n' + logs;
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
