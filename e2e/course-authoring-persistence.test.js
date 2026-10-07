'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10540, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-authoring-persistence-'));
const COURSE = {
  format: 'chunklab-ai-course', formatVersion: '1.1', title: '保存状态验证课程',
  description: '验证离线队列提示和恢复提交。', targetCefr: 'B1', contentForm: 'dialogue',
  learning: { template: 'sentence-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
  roles: [{ key: 'guest', name: '客人' }, { key: 'staff', name: '前台' }],
  items: [
    { en: "I'd like to check in.", zh: '我想办理入住。', role: 'guest', chunks: ["I'd like", 'to check in.'], hints: ['我想', '办理入住'] },
    { en: 'May I have your name?', zh: '请问您叫什么名字？', role: 'staff', chunks: ['May I have', 'your name?'], hints: ['请问我可以知道', '您的名字吗？'] }
  ]
};

let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, {
        CHUNKLAB_DATA_DIR: TMP_DB, CHUNKLAB_WRITE_PROTOCOL: '3', PORT: String(PORT), NODE_ENV: 'test'
      }),
      stdio: 'ignore'
    });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) {
        clearInterval(timer);
        reject(new Error('isolated server exited with ' + server.exitCode));
        return;
      }
      const request = http.get(BASE + '/api/health', function (response) {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      request.on('error', function () {});
      request.setTimeout(700, function () { request.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('isolated server start timed out')); }
    }, 100);
  });
}

function stopServer() {
  if (server) try { server.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (_) {}
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || chromium.executablePath()
    });
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const pageErrors = [];
    const operationIds = [];
    page.on('pageerror', function (error) { pageErrors.push(error.message); });
    page.on('request', function (request) {
      if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/api/operations')) return;
      try { operationIds.push(JSON.parse(request.postData() || '{}').requestId); } catch (_) {}
    });
    await page.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-action=copy-prompt]', { timeout: 15000 });
    await page.waitForFunction(function () {
      const config = CL.getCloudConfig();
      return config && config.writeProtocol === 3 && CL.serverPersistenceReady();
    }, null, { timeout: 15000 });

    await page.locator('[data-action=copy-prompt]').click();
    if (await page.locator('[data-action=manual-copied]').count()) await page.locator('[data-action=manual-copied]').click();
    await page.locator('#rawResult').fill(JSON.stringify(COURSE));
    await page.locator('[data-action=validate-result]').click();
    await page.waitForSelector('.course-summary', { timeout: 10000 });

    await page.route('**/api/operations', function (route) { return route.abort('failed'); });
    await page.locator('[data-action=save]').click();
    await page.waitForFunction(async function () {
      const rows = await ServerStore.pending();
      return rows.some(function (row) { return row.operation.type === 'deck.put'; });
    }, null, { timeout: 10000 });
    await page.waitForFunction(function () {
      const status = document.getElementById('chunklabSaveStatus');
      return status && status.dataset.visible === 'true' && status.textContent.includes('已安全保存在此设备');
    }, null, { timeout: 8000 });
    const queued = await page.evaluate(async function () {
      const rows = await ServerStore.pending();
      const row = rows.find(function (item) { return item.operation.type === 'deck.put'; });
      return { durable: !!(row && row.ordinal != null), requestId: row && row.requestId,
        deckId: row && row.operation.payload.deck.id, title: row && row.operation.payload.deck.name,
        visible: document.getElementById('chunklabSaveStatus').dataset.visible };
    });
    if (!queued.durable || queued.title !== COURSE.title || queued.visible !== 'true') {
      throw new Error('offline authoring save was not durably queued with visible, honest feedback: ' + JSON.stringify(queued));
    }

    await page.unroute('**/api/operations');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      const config = CL.getCloudConfig();
      return config && config.writeProtocol === 3 && CL.serverPersistenceReady();
    }, null, { timeout: 15000 });
    await page.waitForSelector('.course-summary', { timeout: 10000 });
    const restoredDraft = await page.locator('.preview-details').innerText();
    if (!restoredDraft.includes(COURSE.items[0].en) || !restoredDraft.includes(COURSE.items[1].en)) {
      throw new Error('refresh did not restore the same locally persisted authoring draft: ' + restoredDraft);
    }
    await page.waitForFunction(async function (title) {
      const snapshot = await ServerCache.read();
      return snapshot && snapshot.snapshot.mem.decks.some(function (deck) { return deck.name === title; }) &&
        (await ServerStore.pending()).length === 0;
    }, COURSE.title, { timeout: 15000 });
    const receipt = await page.evaluate(function (id) { return ChunkAPI.getOperationReceipt(id); }, queued.requestId);
    if (!receipt || receipt.requestId !== queued.requestId || receipt.outcome !== 'applied' ||
        receipt.operation?.id !== queued.deckId || !Number.isSafeInteger(receipt.seq)) {
      throw new Error('retry did not resolve through the original single-operation receipt: ' + JSON.stringify(receipt));
    }
    if (operationIds.length < 2 || operationIds.some(function (id) { return id !== queued.requestId; })) {
      throw new Error('offline retry did not reuse the exact durable request ID: ' + JSON.stringify(operationIds));
    }
    const serverCopies = await page.evaluate(async function (id) {
      const data = await ChunkAPI.getData();
      return data.mem.decks.filter(deck => deck.id === id).length;
    }, queued.deckId);
    if (serverCopies !== 1) throw new Error('retry must leave exactly one confirmed course entity, got ' + serverCopies);
    const result = await page.evaluate(function () {
      return { status: document.getElementById('chunklabSaveStatus')?.textContent || '',
        hasConflictUi: !!document.querySelector('#syncBadge, #syncResolutionModal, [data-sync-conflict]') };
    });
    if (result.hasConflictUi) throw new Error('course creation exposed an internal sync conflict UI');
    if (pageErrors.length) throw new Error('page errors: ' + pageErrors.join(' | '));
    console.log('[course-authoring-persistence] protocol 3 authoring queue stays durable offline, shows shared safe-save status, and commits exactly once after retry');
    await context.close();
  } catch (error) {
    console.error('[course-authoring-persistence] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(function () {});
    stopServer();
  }
})();
