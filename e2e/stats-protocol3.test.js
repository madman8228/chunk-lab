'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(10820, 100);
const base = 'http://127.0.0.1:' + port;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-stats-p3-'));
let server;
let browser;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      const request = http.get(base + '/api/health', response => {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      request.on('error', () => {});
      request.setTimeout(600, () => request.destroy());
      if (++attempts >= 200) { clearInterval(timer); reject(new Error('isolated stats protocol-3 server did not start')); }
    }, 100);
  });
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
    await waitForServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const legacyWrites = [];
    page.on('request', request => {
      if (['PUT', 'POST'].includes(request.method()) && /\/api\/(data|import|sync\/resolve|sync\/batch\/resolve)$/.test(new URL(request.url()).pathname)) {
        legacyWrites.push(request.method() + ' ' + new URL(request.url()).pathname);
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    });
    await page.goto(base + '/stats.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.getCloudConfig && CL.getCloudConfig().writeProtocol === 3 &&
      CL.serverPersistenceReady() && window.ServerStore, null, { timeout: 15000 });

    const seeded = await page.evaluate(async () => {
      const deck = { id: 'e2e-stats-p3', name: '统计页协议三测试', items: [
        { sentence: 'Could you help me?', chunks: ['Could you', 'help me?'], hints: ['', ''] },
      ] };
      await ServerStore.submitCommitted('deck.put', { deck }, { requestId: 'stats-p3-deck-create-01', expectedRev: null });
      const key = deck.id + '#sentence-1';
      const mistakeKey = deck.id + '::sentence-1';
      await ServerStore.submitCommitted('learning.answer', {
        eventId: 'stats-p3-answer-event-01', key, deckId: deck.id, generation: 0, ok: false,
        sessionId: 'stats-p3-session-01', answerOrder: 0, chunkRight: 0, chunkTotal: 2,
        mistake: { key: mistakeKey, row: {
          _key: mistakeKey, deckId: deck.id, deckName: deck.name, sentence: 'Could you help me?',
          translation: '你能帮我吗？', needsReview: true,
          mistakes: [{ chunk: 'help me?', userAnswer: 'help us?' }],
          history: [{ eventId: 'stats-p3-answer-event-01' }],
        } },
      }, { requestId: 'stats-p3-answer-request-01' });
      await ServerCache.refresh();
      return { deckId: deck.id, mistakeKey };
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => CL.serverPersistenceReady() && document.querySelector('#statsTabs'), null, { timeout: 15000 });
    await page.getByRole('button', { name: /错题本/ }).click();
    await page.getByText('Could you help me?', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      dialog.accept();
    });
    await context.setOffline(true);
    await page.locator('#btnClearWrongBook').click();
    await page.waitForFunction(() => {
      const button = document.querySelector('#btnClearWrongBook');
      return button && !button.disabled;
    }, null, { timeout: 10000 });
    await context.setOffline(false);
    assert.ok(dialogs.some(item => item.type === 'alert' && /请联网后再删除错题/.test(item.message)),
      'an offline clear explains the limitation without presenting a synchronization conflict');
    const offlineState = await page.evaluate(async key => {
      const data = await ChunkAPI.getData();
      const pending = await ServerStore.pending();
      return {
        stillPresent: (data.mem.reinforceBook || []).some(row => row && row._key === key),
        deletePending: pending.some(row => row.operation && row.operation.type === 'mistake.remove'),
      };
    }, seeded.mistakeKey);
    assert.equal(offlineState.stillPresent, true, 'offline failure leaves the confirmed mistake visible');
    assert.equal(offlineState.deletePending, false, 'offline failure does not enqueue an unconfirmed deletion');

    await page.locator('#btnClearWrongBook').click();
    await waitForAsync(page, async key => {
      const data = await ChunkAPI.getData();
      return !(data.mem.reinforceBook || []).some(row => row && row._key === key);
    }, seeded.mistakeKey, { timeout: 10000 });

    const result = await page.evaluate(async key => {
      const data = await ChunkAPI.getData();
      const rows = await ServerStore.pending();
      return {
        remaining: (data.mem.reinforceBook || []).filter(row => row && row._key === key).length,
        deletePending: rows.filter(row => row.operation && row.operation.type === 'mistake.remove').length,
      };
    }, seeded.mistakeKey);
    assert.equal(result.remaining, 0, 'the stats-page clear action removes the confirmed server mistake row');
    assert.equal(result.deletePending, 0, 'the UI completes only after the narrow delete receipt is applied');
    assert.deepEqual(legacyWrites, [], 'the protocol-3 stats page never writes a legacy whole-account snapshot');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => CL.serverPersistenceReady(), null, { timeout: 15000 });
    await page.getByRole('button', { name: /错题本/ }).click();
    await page.getByText('Could you help me?', { exact: true }).waitFor({ state: 'detached', timeout: 10000 });
    await context.close();
    console.log('[stats-protocol3] stats-page clear is a confirmed narrow write, survives reload, and makes no legacy writes');
  } catch (error) {
    console.error('[stats-protocol3] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => { server.once('close', resolve); server.kill('SIGTERM'); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
