'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { freePort } = require('./lib/free-port');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-admin-save-health-'));
const PORT = freePort(10880, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const ADMIN_PASSWORD = 'admin-save-health-test-password';
const JWT_SECRET = 'admin-save-health-test-jwt-secret-long-enough';
const PRIVATE_SENTENCE = 'PRIVATE_SENTENCE_MUST_NOT_LEAK_7d1c';

async function startServer() {
  const env = { ...process.env, NODE_ENV: 'test', PORT: String(PORT), CHUNKLAB_DATA_DIR: DATA_DIR,
    REQUIRE_AUTH: 'true', JWT_SECRET: 'save-health-user-test-secret-long-enough-32', ADMIN_PASSWORD,
    ADMIN_JWT_SECRET: JWT_SECRET, CHUNKLAB_WRITE_PROTOCOL: '3' };
  const child = spawn(process.execPath, ['index.js'], { cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let startupOutput = '';
  child.stdout.on('data', chunk => { startupOutput = (startupOutput + chunk.toString()).slice(-3000); });
  child.stderr.on('data', chunk => { startupOutput = (startupOutput + chunk.toString()).slice(-3000); });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error('isolated diagnostics server exited before startup: ' + startupOutput);
    try {
      const response = await fetch(BASE + '/api/health');
      if (response.ok) return child;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  child.kill();
  throw new Error('isolated diagnostics server did not start');
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
}

async function postJson(route, body, token) {
  const response = await fetch(BASE + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

(async function main() {
  let server;
  let browser;
  try {
    server = await startServer();
    const registered = await postJson('/api/auth/register', { username: 'health-e2e-learner', password: 'test-password' });
    assert.equal(registered.status, 200, 'the real isolated protocol-3 server creates a learner session');

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });

    const clientResults = await page.evaluate(async function ({ token, privateSentence }) {
      const send = (route, body) => fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      }).then(async response => ({ status: response.status, body: await response.json() }));
      const health = await send('/api/client-save-health', {
        version: 1, clientId: 'browser-client-install-12345678', pending: 4, blocked: 1,
        retryAttempts: 7, oldestPendingAt: Date.now() - 60000, errorCode: 'ENTITY_CHANGED', traceId: null
      });
      const deck = { id: 'admin-diagnostics-deck', name: 'Diagnostic test', items: [{ sentence: privateSentence }] };
      const create = await send('/api/operations', {
        protocol: 3, requestId: 'admin-diagnostics-create-deck-01', type: 'deck.put', expectedRev: null, payload: { deck }
      });
      const conflict = await send('/api/operations', {
        protocol: 3, requestId: 'admin-diagnostics-stale-deck-01', type: 'deck.put', expectedRev: null, payload: { deck }
      });
      return { health, create, conflict };
    }, { token: registered.body.token, privateSentence: PRIVATE_SENTENCE });

    assert.equal(clientResults.health.status, 200, 'the Chromium client reports bounded queue health over the real API');
    assert.equal(clientResults.create.status, 200, 'the client creates a server-owned entity before exercising a revision conflict');
    assert.equal(clientResults.conflict.status, 409);
    assert.equal(clientResults.conflict.body.code, 'ENTITY_CHANGED');
    assert.match(clientResults.conflict.body.traceId, /^[0-9a-f-]{36}$/i, 'the real write failure returns a trace ID');

    await page.locator('#adminPassword').fill(ADMIN_PASSWORD);
    await page.locator('#loginForm button[type="submit"]').click();
    await page.waitForFunction(function (traceId) {
      const health = document.querySelector('#saveHealthSummary').innerText;
      const failures = document.querySelector('#saveFailureList').innerText;
      return health.includes('待处理 4') && health.includes('阻塞 1') &&
        failures.includes('ENTITY_CHANGED') && failures.includes(traceId);
    }, clientResults.conflict.body.traceId);

    const healthText = await page.locator('#saveHealthSummary').innerText();
    assert.match(healthText, /1 个活跃设备/);
    assert.match(healthText, /待处理 4/);
    assert.match(healthText, /阻塞 1/);
    assert.match(healthText, /累计重试 7/);

    const failureText = await page.locator('#saveFailureList').innerText();
    assert.match(failureText, /ENTITY_CHANGED/);
    assert.match(failureText, /HTTP 409/);
    assert.ok(failureText.includes(clientResults.conflict.body.traceId), 'admin UI shows the trace ID from the same browser client failure');
    const renderedPage = await page.locator('body').innerText();
    assert.equal(renderedPage.includes(PRIVATE_SENTENCE), false, 'admin diagnostics never expose submitted learning/content text');

    console.log('admin-save-health-vertical: real Chromium client report and write failure persist to SQLite and appear as safe admin summaries');
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
