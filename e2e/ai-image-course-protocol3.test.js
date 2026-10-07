'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
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
        PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3',
      }),
      stdio: 'ignore',
    });
    await waitHealthy();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext();
    await context.addInitScript(() => {
      if (!localStorage.getItem('chunklab.storage-owner.v1')) {
        localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      }
    });
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

    await page.locator('[data-action=save]').click();
    await page.waitForSelector('[data-action=join]', { timeout: 30000 });
    await page.waitForFunction(async () => {
      const cache = await ServerCache.read();
      return cache?.snapshot.courses.some((course) => course.metadata?.title?.['zh-CN'] === '图文点单持久化验证');
    }, null, { timeout: 30000 });
    const savedCourse = await page.evaluate(async () => {
      const confirmed = await ServerCache.read();
      const course = confirmed.snapshot.courses.find((item) => item.authorNotes?.chunklabImageText);
      return {
        course,
        serverCourse: confirmed.snapshot.courses.find((item) => item.courseId === course?.courseId) || null,
        noConflictUi: !document.querySelector('#syncBadge, #syncResolveMask, [data-sync-conflict]'),
      };
    });
    assert.ok(savedCourse.course?.courseId, `image course was confirmed in the owner-scoped server projection: ${JSON.stringify({ state: await page.evaluate(async () => ({ body: document.body.innerText.slice(-500), store: ServerStore.state(), cache: await ServerCache.read(), pending: await ServerStore.pending() })), operations }).slice(0, 3000)}`);
    assert.equal(savedCourse.course.courseId, savedCourse.serverCourse?.courseId,
      'the course.put confirmation updated the owner-scoped protocol-3 cache');
    assert.equal(savedCourse.course.assets?.some((asset) => asset.type === 'story_image'), true,
      'the course stores an image asset reference');
    assert.equal(savedCourse.noConflictUi, true, 'the image-authoring screen exposes no sync-conflict UI');
    const coursePut = operations.filter((operation) => operation.type === 'course.put' && operation.payload.course.courseId === savedCourse.course.courseId);
    assert.equal(coursePut.length, 1, 'the authoring save is a single narrow course.put operation');
    const receipt = await page.evaluate((id) => ChunkAPI.getOperationReceipt(id), coursePut[0].requestId);
    assert.equal(receipt?.outcome, 'applied', 'the story course has a server receipt');

    const database = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const owner = database.prepare("SELECT id FROM users WHERE username='__default__'").get();
      const row = database.prepare('SELECT data_json FROM user_courses WHERE user_id=? AND course_id=? AND deleted_at IS NULL')
        .get(owner.id, savedCourse.course.courseId);
      assert.ok(row, 'the story course is persisted in the isolated SQLite entity table');
      const persisted = JSON.parse(row.data_json);
      assert.equal(persisted.courseId, savedCourse.course.courseId);
      assert.equal(persisted.assets.some((asset) => asset.type === 'story_image'), true);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=? AND request_id=?')
        .get(owner.id, coursePut[0].requestId).count, 1, 'SQLite commits exactly one course.put receipt');
    } finally { database.close(); }

    await page.locator('[data-action=join]').click();
    await page.waitForURL(new RegExp('/courses\\.html\\?id=' + encodeURIComponent(savedCourse.course.courseId)), { timeout: 15000 });
    await page.locator('[data-action="start-v2-learning"]').click();
    await page.waitForSelector('#playerImage img', { timeout: 15000 });
    assert.equal(await page.locator('#playerImage img').first().evaluate((node) => node.naturalWidth), 2,
      'the saved image asset is available in the real course player');
    const courseUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mode-guide', { timeout: 15000 });
    assert.equal(page.url(), courseUrl, 'refresh returns to the same course');
    await page.locator('[data-action="start-v2-learning"]').click();
    await page.waitForSelector('#playerImage img', { timeout: 15000 });
    assert.equal(await page.locator('#playerImage img').first().evaluate((node) => node.naturalWidth), 2,
      'the same local image and server course remain usable after refresh');
    assert.deepEqual(pageErrors, [], 'image course creation and reload produce no uncaught browser errors');
    const freshContext = await browser.newContext({ serviceWorkers: 'block' });
    const freshPage = await freshContext.newPage();
    const freshErrors = [];
    freshPage.on('pageerror', error => freshErrors.push(error.message));
    await freshPage.goto(courseUrl, { waitUntil: 'domcontentloaded' });
    await freshPage.waitForSelector('[data-action="start-v2-learning"]', { timeout: 20000 });
    await freshPage.locator('[data-action="start-v2-learning"]').click();
    await freshPage.waitForFunction(() => document.querySelector('#playerImage img')?.naturalWidth === 2,
      null, { timeout: 15000 });
    assert.deepEqual(freshErrors, [], 'a fresh browser can recover the confirmed course and image without original draft storage');
    await freshContext.close();
    console.log('[ai-image-course-protocol3] authoring → receipt/SQLite → playback/reload and fresh-browser image recovery passed');
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
