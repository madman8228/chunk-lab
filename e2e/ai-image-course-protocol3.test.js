'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');
const Database = require('../server/node_modules/better-sqlite3');
const { freePort } = require('./lib/free-port');

const root = path.resolve(__dirname, '..');
const port = freePort(10620, 100);
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-ai-image-p3-'));
const courseDraft = {
  format: 'chunklab-ai-image-text', formatVersion: '1.0', title: '图文点单持久化验证',
  description: '验证图片课程通过 protocol 3 保存并可在刷新后学习。', targetCefr: 'A2',
  learning: { template: 'image-text-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
  images: [{ key: 'cafe', fileName: 'cafe-counter.png', alt: '咖啡店柜台' }],
  items: [
    { imageKey: 'cafe', en: 'I would like a tea.', zh: '我想要一杯茶。', chunks: ['I would like', 'a tea.'] },
    { imageKey: 'cafe', en: 'Can I get the bill?', zh: '可以给我账单吗？', chunks: ['Can I get', 'the bill?'] },
  ],
};
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOs2PKBgYGBiQEMABkCAiDaYDR0AAAAAElFTkSuQmCC', 'base64');
let server;
let browser;

async function waitHealthy() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('isolated protocol-3 image-course service did not start');
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, {
        PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test', REQUIRE_AUTH: 'true',
        JWT_SECRET: require('crypto').randomBytes(32).toString('hex'), PHONE_AUTH_ENABLED: 'false', CHUNKLAB_WRITE_PROTOCOL: '3',
      }),
      stdio: 'ignore',
    });
    await waitHealthy();
    const registration = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'image-author-test', password: 'image-author-test-pass' }) });
    assert.equal(registration.status, 200, 'isolated browser owner is explicitly registered');
    const { token } = await registration.json();
    const formatDb = new Database(path.join(dataDir, 'chunklab.db'));
    formatDb.prepare("INSERT INTO user_learning_data_formats(user_id,format,migration_id) VALUES(?,'references-v1','ai-image-course-e2e')")
      .run(Number(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).uid));
    formatDb.close();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript((authToken) => {
      localStorage.setItem('chunklab_token', authToken);
      localStorage.setItem('chunklab.session.v1', JSON.stringify({ version: 1, base: '', token: authToken, epoch: 'image-author-fixture' }));
    }, token);
    const page = await context.newPage();
    const pageErrors = [];
    const operations = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return;
      try { operations.push(JSON.parse(request.postData() || '{}')); } catch (_) {}
    });

    await page.goto(`${base}/course-create.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => CL.getCloudConfig()?.writeProtocol === 3 && CL.serverPersistenceReady(), null, { timeout: 20000 });
    await page.locator('[name="courseType"][value="imageText"]').check();
    await page.locator('[data-action=copy-prompt]').click();
    if (await page.locator('[data-action=manual-copied]').count()) await page.locator('[data-action=manual-copied]').click();
    await page.locator('#rawResult').fill(JSON.stringify(courseDraft));
    await page.locator('[data-action=validate-result]').click();
    await page.waitForSelector('.issue-panel.has-error');
    await page.locator('#imageFiles').setInputFiles({ name: 'counter.png', mimeType: 'image/png', buffer: image });
    try { await page.waitForSelector('[data-image-binding="cafe"]', { timeout: 10000 }); }
    catch (error) { throw new Error('uploaded course image was not paired in the authoring UI: ' + (await page.locator('body').innerText()).slice(-1800)); }
    await page.locator('[data-image-binding="cafe"]').selectOption('counter.png');
    await page.waitForSelector('.course-summary', { timeout: 15000 });
    assert.equal(await page.locator('.image-course-preview').count(), 2, 'the same local image is materialized for both lesson items');
    assert.equal(await page.locator('.image-course-preview').first().evaluate((node) => node.naturalWidth), 2,
      'the authoring preview reads the uploaded local image before save');

    const authoringUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.course-summary', { timeout: 15000 });
    await page.waitForFunction((url) => location.href === url, authoringUrl);
    assert.equal(await page.locator('.image-course-preview').count(), 2,
      'an unsaved image-text draft restores both image references after refresh');
    assert.equal(await page.locator('.image-course-preview').first().evaluate((node) => node.naturalWidth), 2,
      'the uploaded image bytes remain available to the recovered authoring preview');

    await page.evaluate(() => {
      window.__originalCourseRequest = ChunkAPI.request;
      window.__failCourseImport = true;
      ChunkAPI.request = function (path, options) {
        if (path === '/api/course-library/import' && window.__failCourseImport) {
          window.__failCourseImport = false;
          return Promise.reject(new Error('测试导入失败'));
        }
        return window.__originalCourseRequest.apply(this, arguments);
      };
    });
    await page.locator('[data-action=save]').click();
    await page.waitForSelector('.issue-panel.has-error', { timeout: 15000 });
    assert.equal(await page.locator('.image-course-preview').count(), 2, 'failed independent import preserves the editable course draft');
    await page.evaluate(() => { ChunkAPI.request = window.__originalCourseRequest; });
    await page.locator('[data-action=save-and-join]').click();
    await page.waitForURL(/main\.html\?personalCourse=/, { timeout: 30000 });
    const courseId = new URL(page.url()).searchParams.get('personalCourse');
    assert.ok(courseId, 'the server assigns an independent course ID');
    const savedCourse = await page.evaluate(async (id) => ChunkAPI.request('/api/course-library/' + encodeURIComponent(id)), courseId);
    assert.equal(savedCourse.content.utterances.length, 2, 'both image-text items are in the independent course library');
    assert.equal(savedCourse.content.assets.length, 1, 'the independent course stores a separate asset reference');
    assert.equal(JSON.stringify(savedCourse).includes('base64'), false, 'course metadata contains no inline media bytes');
    assert.equal(operations.filter((operation) => /^(course|deck)\.put$/.test(operation.type)).length, 0,
      'course bodies never enter the personal learning operation stream');
    const learningData = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(JSON.stringify(learningData).includes('I would like a tea.'), false, 'learning data contains references, not course text');

    const database = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const row = database.prepare('SELECT kind,visibility FROM course_contents WHERE course_id=?').get(courseId);
      assert.deepEqual(row, { kind: 'course', visibility: 'private' }, 'course content is stored independently from user learning rows');
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM course_content_releases WHERE course_id=?').get(courseId).count, 1);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM course_content_release_assets WHERE course_id=?').get(courseId).count, 1);
    } finally { database.close(); }

    const start = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await start.waitFor({ timeout: 15000 });
    await start.click();
    await page.waitForFunction(() => document.querySelector('#courseLearningImage')?.naturalWidth === 2, null, { timeout: 15000 });
    const courseUrl = page.url();
    const imageAssetId = savedCourse.content.assets[0].id;
    let assetRequests = 0;
    page.on('request', (request) => { if (request.url().includes('/assets/' + encodeURIComponent(imageAssetId))) assetRequests++; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' }).waitFor({ timeout: 15000 });
    await page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' }).click();
    await page.waitForFunction(() => document.querySelector('#courseLearningImage')?.naturalWidth === 2, null, { timeout: 15000 });
    assert.equal(page.url(), courseUrl, 'refresh returns to the same independent personal course');
    assert.equal(assetRequests, 0, 'refresh reuses the account-scoped image cache');
    assert.deepEqual(pageErrors, [], 'image course creation and reload produce no uncaught browser errors');
    const freshContext = await browser.newContext({ serviceWorkers: 'block' });
    await freshContext.addInitScript((authToken) => {
      localStorage.setItem('chunklab_token', authToken);
      localStorage.setItem('chunklab.session.v1', JSON.stringify({ version: 1, base: '', token: authToken, epoch: 'image-author-fresh-fixture' }));
    }, token);
    const freshPage = await freshContext.newPage();
    const freshErrors = [];
    freshPage.on('pageerror', error => freshErrors.push(error.message));
    await freshPage.goto(courseUrl, { waitUntil: 'domcontentloaded' });
    const freshStart = freshPage.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await freshStart.waitFor({ timeout: 20000 });
    await freshStart.click();
    await freshPage.waitForFunction(() => document.querySelector('#courseLearningImage')?.naturalWidth === 2,
      null, { timeout: 15000 });
    assert.deepEqual(freshErrors, [], 'a fresh browser can recover the confirmed course and image without original draft storage');
    await freshContext.close();
    console.log('[ai-image-course-protocol3] independent authoring import/retry, separate learning reference, playback/reload and fresh-browser recovery passed');
    await context.close();
  } catch (error) {
    console.error('[ai-image-course-protocol3] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((error) => { console.error('[ai-image-course-protocol3] fatal:', error.stack || error); process.exitCode = 1; });
