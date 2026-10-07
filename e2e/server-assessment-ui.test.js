/* A real main.html assessment must start, save answers, and reveal the score only after server ACK. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9600, 100);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-assessment-ui-'));
const base = 'http://127.0.0.1:' + port;
let server;
let browser;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const timer = setInterval(() => {
      const req = http.get(base + '/api/health', (res) => {
        res.resume();
        if (res.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      req.on('error', () => {});
      req.setTimeout(600, () => req.destroy());
      if (++tries >= 200) { clearInterval(timer); reject(new Error('isolated server did not start')); }
    }, 100);
  });
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, { PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3' }),
      stdio: 'ignore',
    });
    await waitForServer();
    const response = await fetch(base + '/api/operations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocol: 3, requestId: 'ui_exposure_request_01', type: 'learning.exposure', payload: {
        eventId: 'ui_exposure_event_01', key: 'oral-1-1-1#575b1d3a', deckId: 'oral-1-1-1',
        occurredAt: Date.now() - 8 * 24 * 60 * 60 * 1000, sessionId: 'ui_exposure_session_01', generation: 0,
      } }),
    });
    assert.equal(response.status, 200, 'the server accepts the old-enough exposure fixture');

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    });
    await page.goto(base + '/main.html?direct=1&assessmentKey=' + encodeURIComponent('oral-1-1-1#575b1d3a'));
    await page.waitForFunction(() => window.CL && CL.getCloudConfig && CL.getCloudConfig() && CL.getCloudConfig().writeProtocol === 3, null, { timeout: 15000 });
    await page.waitForSelector('#btnAssessmentSubmit', { timeout: 20000 });
    await page.locator('[data-assessment-answer="0"]').fill('Good');
    await page.locator('[data-assessment-answer="1"]').fill('morning.');
    await page.evaluate(() => {
      const original = ChunkAPI.submitOperation;
      window.__failAssessmentAnswerOnce = true;
      ChunkAPI.submitOperation = async (operation) => {
        if (operation.type === 'assessment.answer' && window.__failAssessmentAnswerOnce) {
          window.__failAssessmentAnswerOnce = false;
          throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
        }
        return original(operation);
      };
    });
    await page.locator('#btnAssessmentSubmit').click();
    await page.waitForSelector('#btnAssessmentFinalize', { timeout: 10000 });
    await page.waitForFunction(async () => (await IDBStore.listPendingOperations()).some(row => row.operation.type === 'assessment.answer'), null, { timeout: 5000 });
    await page.reload();
    await page.waitForSelector('#btnAssessmentFinalize', { timeout: 15000 });
    await page.waitForFunction(async () => !(await IDBStore.listPendingOperations()).some(row => row.operation.type.indexOf('assessment.') === 0), null, { timeout: 15000 });
    await page.evaluate(() => {
      const original = ChunkAPI.submitOperation;
      window.__releaseFinalizeAck = null;
      ChunkAPI.submitOperation = async (operation) => {
        const receipt = await original(operation);
        if (operation.type === 'assessment.finalize') {
          await new Promise((resolve) => { window.__releaseFinalizeAck = resolve; });
        }
        return receipt;
      };
    });
    await page.locator('#btnAssessmentFinalize').click();
    await page.waitForFunction(() => /正在保存测评/.test(document.querySelector('#result')?.textContent || ''), null, { timeout: 5000 });
    await page.waitForFunction(() => typeof window.__releaseFinalizeAck === 'function', null, { timeout: 5000 });
    assert.equal(await page.locator('#result').getByText('测评通过').count(), 0,
      'the page must not reveal a score before the final server receipt is delivered');
    await page.evaluate(() => window.__releaseFinalizeAck && window.__releaseFinalizeAck());
    await page.waitForFunction(() => /测评通过/.test(document.querySelector('#result')?.textContent || ''), null, { timeout: 15000 });

    const state = await page.evaluate(async () => ({
      visibleResult: document.querySelector('#result').textContent,
      drafts: await IDBStore.listAssessmentDrafts(),
      pending: await ServerStore.pending(),
    }));
    assert.match(state.visibleResult, /1 \/ 1 句独立答对/);
    assert.equal(state.drafts.length, 0, 'the completed draft is retired only after the server confirms the result');
    assert.equal(state.pending.length, 0, 'assessment operations have server receipts and leave no queued operations');
    console.log('[server-assessment-ui] main.html assessment reaches its server-confirmed result');
  } catch (error) {
    console.error('[server-assessment-ui] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }
})();
