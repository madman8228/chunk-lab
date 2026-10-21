'use strict';
/* Fast environment probe before the 20+ minute browser suite.
 * Verifies that Chromium launches, and that server/index.js starts in both
 * explicit auth and open test modes with an isolated temp directory. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const JWT_SECRET = 'browser-smoke-test-secret-0123456789abcdef0123456789abcdef';

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function ping(base) {
  return new Promise((resolve) => {
    const request = http.get(base + '/api/health', (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
  });
}

async function waitHealth(base, child) {
  for (let index = 0; index < 300; index++) {
    if (child.exitCode !== null) throw new Error('server exited with ' + child.exitCode);
    if (await ping(base)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server health timeout');
}

async function startServer(mode) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-browser-smoke-'));
  const port = await freePort();
  const env = {
    ...process.env,
    CHUNKLAB_DATA_DIR: dataDir,
    PORT: String(port),
    NODE_ENV: 'test',
    PHONE_AUTH_ENABLED: 'false',
    REQUIRE_AUTH: mode === 'auth' ? 'true' : 'false',
  };
  if (mode === 'auth') env.JWT_SECRET = JWT_SECRET;
  else delete env.JWT_SECRET;
  const child = spawn(process.execPath, [SERVER], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await waitHealth('http://127.0.0.1:' + port, child);
  } catch (error) {
    child.kill();
    throw new Error(mode + ' server failed: ' + error.message + (stderr ? '\n' + stderr.trim() : ''));
  }
  return { child, dataDir };
}

async function stopServer(server) {
  if (server.child.exitCode === null) {
    server.child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      server.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(server.dataDir, { recursive: true, force: true });
      return;
    } catch (_) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

(async () => {
  const servers = [];
  let browser;
  try {
    console.log('browser environment: starting auth/open test servers');
    servers.push(await startServer('auth'));
    servers.push(await startServer('open'));
    console.log('browser environment: launching chromium');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>probe</title><p id="ok">ok</p>');
    if (await page.textContent('#ok') !== 'ok') throw new Error('Chromium DOM probe failed');
    console.log('browser environment: chromium, auth server, open server passed');
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const server of servers) await stopServer(server);
  }
})().catch((error) => {
  console.error('browser environment: ' + error.message);
  process.exitCode = 1;
});
