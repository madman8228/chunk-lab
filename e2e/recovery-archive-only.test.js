'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const Database = require('../server/node_modules/better-sqlite3');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(11100, 100);
const base = 'http://127.0.0.1:' + port;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-recovery-archive-only-'));
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
      if (++attempts >= 200) { clearInterval(timer); reject(new Error('isolated archive-only server did not start')); }
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
    const recoveryActions = [];
    let archiveUploads = 0;
    let snapshotRefreshes = 0;
    page.on('request', request => {
      const url = new URL(request.url());
      if (/^\/api\/recovery\/[^/]+\/(preview|apply)$/.test(url.pathname) ||
          (url.pathname === '/api/recovery/ingest' && request.method() === 'POST')) {
        recoveryActions.push({ method: request.method(), path: url.pathname });
      }
      if (request.method() === 'POST' && url.pathname === '/api/recovery/ingest') archiveUploads++;
      if (request.method() === 'GET' && url.pathname === '/api/data') snapshotRefreshes++;
    });
    await page.addInitScript(() => {
      localStorage.setItem('chunklab.storage-owner.v1', 'legacy-unassigned');
      localStorage.setItem('chunklab.v1', JSON.stringify({ version: 2, decks: [],
        settings: { sound: true }, stats: { totalAnswered: 7 } }));
    });
    await page.goto(base + '/main.html?recoveryArchiveOnly=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady(), null, { timeout: 20000 });
    assert.equal(await page.locator('#recoveryArchiveOnlyNotice').count(), 0,
      'retired diagnostic query no longer adds a recovery prompt to the learning page');
    assert.equal(archiveUploads, 0, 'ordinary startup does not upload legacy data');
    assert.deepEqual(recoveryActions, [], 'ordinary startup never previews or applies old sources');
    assert.ok(snapshotRefreshes > 0, 'startup loads the current account server cache');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('chunklab.v1')).stats.totalAnswered), 7,
      'unassigned old data remains available locally');
    const db = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_recovery_sources').get().count, 0,
        'an old diagnostic URL does not create an archive or migrate records');
    } finally { db.close(); }

    await context.close();
    console.log('[recovery-archive-only] retired diagnostic URL starts normal server saving without legacy side effects');
  } catch (error) {
    console.error('[recovery-archive-only] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => { server.once('close', resolve); server.kill('SIGTERM'); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
