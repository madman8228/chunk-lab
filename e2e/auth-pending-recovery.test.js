'use strict';

/* A durable protocol-3 operation survives 401, same-account login, and automatic replay. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const Database = require('../server/node_modules/better-sqlite3');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');
const { freePort } = require('./lib/free-port');

const root = path.resolve(__dirname, '..');
const port = freePort(9860, 100);
const base = 'http://127.0.0.1:' + port;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-auth-pending-'));
const username = 'auth-pending-' + randomBytes(5).toString('hex');
const password = 'test-only-auth-recovery-password';
const requestId = 'auth-recovery-' + randomBytes(10).toString('hex');
let server;
let browser;

async function waitHealthy() {
  for (let i = 0; i < 300; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated authenticated service did not start');
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, {
        PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test',
        CHUNKLAB_WRITE_PROTOCOL: '3', REQUIRE_AUTH: 'true',
        PHONE_AUTH_ENABLED: 'false',
        JWT_SECRET: randomBytes(32).toString('hex'),
      }),
      stdio: 'ignore',
    });
    await waitHealthy();
    const registration = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(registration.status, 200, 'isolated account registration succeeds');
    const account = await registration.json();

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const sentOperations = [];
    let injected401 = false;
    await page.route('**/api/operations', async route => {
      const operation = JSON.parse(route.request().postData() || '{}');
      if (operation.requestId === requestId) sentOperations.push(operation);
      if (!injected401 && operation.requestId === requestId) {
        injected401 = true;
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'expired test session' }) });
        return;
      }
      await route.continue();
    });
    await page.addInitScript(({ token, userId }) => {
      if (sessionStorage.getItem('auth-pending-fixture-seeded') === '1') return;
      sessionStorage.setItem('auth-pending-fixture-seeded', '1');
      localStorage.setItem('chunklab_token', token);
      localStorage.setItem('chunklab_manual', '1');
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, String(userId)]));
    }, { token: account.token, userId: account.user.id });
    await page.goto(base + '/main.html');
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady(), null, { timeout: 20000 });

    const databaseName = await page.evaluate(() => AccountStorage.databaseName);
    const accepted = await page.evaluate(id => ServerStore.submit('settings.patch', { patch: { sound: true } }, { requestId: id }), requestId);
    assert.equal(accepted.durable, true, 'operation is durably queued before sending');
    await page.waitForFunction(() => window.ChunkAPI && !ChunkAPI.getToken() &&
      document.getElementById('btnSettingsTop').textContent === '登录', null, { timeout: 20000 });
    assert.equal(await page.locator('#chunkauth-mask').count(), 0, 'expired login returns to the signed-out homepage without a forced dialog');
    assert.equal(await page.evaluate(() => CL.serverPersistenceReady()), false, 'signed-out state is not a confirmed account projection');
    await waitForAsync(page, async ({ id, name }) => {
      if (!(await indexedDB.databases()).some(database => database.name === name)) return false;
      return new Promise((resolve, reject) => {
        const opening = indexedDB.open(name);
        opening.onupgradeneeded = () => { opening.transaction.abort(); reject(new Error('Existing queue database unexpectedly missing')); };
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result;
          const transaction = db.transaction('pendingOperations', 'readonly');
          const request = transaction.objectStore('pendingOperations').get(id);
          let found = false;
          request.onsuccess = () => { found = !!request.result && request.result.status === 'pending'; };
          transaction.oncomplete = () => { db.close(); resolve(found); };
          transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
      });
    }, { id: requestId, name: databaseName }, { timeout: 10000 });
    assert.equal(injected401, true, 'the first real protocol request received the injected 401');
    await page.locator('#btnSettingsTop').click();
    await page.locator('#chunkauth-mask').waitFor();

    await page.locator('#chunkauth-mask input[placeholder="用户名"]').fill(username);
    await page.locator('#chunkauth-mask input[type="password"]').fill(password);
    await page.locator('#chunkauth-mask button').click();
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady() &&
      !document.getElementById('chunkauth-mask'), null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => AccountStorage.databaseName), databaseName,
      'same-account login restores the original durable storage scope');
    await waitForAsync(page, async id => {
      const [receipt, rows] = await Promise.all([
        ChunkAPI.getOperationReceipt(id).catch(() => null), ServerStore.pending(),
      ]);
      return receipt && receipt.ok === true && !rows.some(row => row.requestId === id);
    }, requestId, { timeout: 20000 });

    assert.equal(sentOperations.length, 2, 'login resumes the durable operation exactly once after the injected 401');
    assert.deepEqual(sentOperations[0], sentOperations[1], 'retry reuses the exact request id and body');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady(), null, { timeout: 20000 });
    assert.equal(await page.evaluate(async id => (await ServerStore.pending()).some(row => row.requestId === id), requestId), false,
      'confirmed operation does not return to the queue after reload');
    assert.equal(sentOperations.length, 2, 'reload does not resubmit the confirmed operation');
    const db = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const receipt = db.prepare('SELECT result_json FROM user_operation_receipts WHERE user_id=? AND request_id=?')
        .get(account.user.id, requestId);
      assert.ok(receipt, 'the authenticated operation receipt is committed in isolated SQLite');
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=? AND request_id=?')
        .get(account.user.id, requestId).count, 1);
    } finally { db.close(); }
    console.log('[auth-pending-recovery] 401 → same-account login → automatic same-request replay and SQLite receipt pass');
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
