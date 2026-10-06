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

    const accepted = await page.evaluate(id => ServerStore.submit('settings.patch', { patch: { sound: true } }, { requestId: id }), requestId);
    assert.equal(accepted.durable, true, 'operation is durably queued before sending');
    try { await page.waitForSelector('#chunkauth-mask', { timeout: 20000 }); }
    catch (error) {
      const diagnostic = await page.evaluate(async () => ({
        url:location.href, token:ChunkAPI.getToken(), ready:CL.serverPersistenceReady(),
        status:ServerStore.state(), pending:await ServerStore.pending(),
        authMask:!!document.getElementById('chunkauth-mask'),
      })).catch(() => null);
      console.error('[auth-pending-recovery] diagnostic:', JSON.stringify({ injected401, sentOperations, diagnostic }));
      throw error;
    }
    await page.waitForFunction(async id => {
      const rows = await ServerStore.pending();
      return rows.some(row => row.requestId === id && row.status === 'pending');
    }, requestId, { timeout: 10000 });
    assert.equal(injected401, true, 'the first real protocol request received the injected 401');
    await page.waitForFunction(function () {
      const message = document.querySelector('#chunkauth-mask [data-auth-message]');
      return message && message.textContent.includes('登录已过期，请重新登录；未提交记录会保留');
    }, null, { timeout: 5000 });

    await page.locator('#chunkauth-mask input[placeholder="用户名"]').fill(username);
    await page.locator('#chunkauth-mask input[type="password"]').fill(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.locator('#chunkauth-mask button').click(),
    ]);
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady() &&
      !document.getElementById('chunkauth-mask'), null, { timeout: 20000 });
    await page.waitForFunction(async id => {
      const [receipt, rows] = await Promise.all([
        ChunkAPI.getOperationReceipt(id).catch(() => null), ServerStore.pending(),
      ]);
      return receipt && receipt.ok === true && !rows.some(row => row.requestId === id);
    }, requestId, { timeout: 20000 });

    assert.equal(sentOperations.length, 2, 'login resumes the durable operation exactly once after the injected 401');
    assert.deepEqual(sentOperations[0], sentOperations[1], 'retry reuses the exact request id and body');
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
