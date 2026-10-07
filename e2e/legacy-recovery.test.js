/* Explicitly confirmed recovery of an unassigned legacy browser namespace. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const Database = require('../server/node_modules/better-sqlite3');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9850, 120);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-legacy-recovery-'));
const base = `http://127.0.0.1:${port}`;
let server;
let browser;
let page;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      const request = http.get(base + '/api/health', response => {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      request.on('error', () => {});
      if (++attempts > 200) { clearInterval(timer); reject(new Error('isolated recovery server did not start')); }
    }, 100);
  });
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, { PORT: String(port), CHUNKLAB_DATA_DIR: dataDir,
        NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3' }),
      stdio: 'ignore'
    });
    await waitForServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    page = await context.newPage();
    await page.goto(base + '/api/health');
    await page.evaluate(async () => {
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', 'legacy-unassigned');
      localStorage.setItem('chunklab.v1', JSON.stringify({ version: 2, decks: [{ id: 'old-deck', name: '旧题库' }],
        settings: { apiKey: 'private-key-must-stay-local', sound: true }, stats: { totalAnswered: 0 } }));
      localStorage.setItem('chunklab.courses.v1', '[]');
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('chunklab-idb', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('courses', { keyPath: 'courseId' });
          db.createObjectStore('progress', { keyPath: 'cid' });
          db.createObjectStore('sentenceStats', { keyPath: 'key' });
          db.createObjectStore('events', { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('courses', 'readwrite');
          tx.objectStore('courses').put({ courseId: 'old-course', name: '旧课程' });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = tx.onabort = () => reject(tx.error);
        };
      });
    });

    await page.goto(base + '/main.html');
    await require('./lib/legacy-recovery-fixture').mountRecoveryControls(page);
    await page.waitForFunction(() => window.LegacyRecovery && window.LegacyRecovery.archiveConfirmedUnassigned &&
      window.CL && CL.getCloudConfig() && CL.getCloudConfig().writeProtocol === 3, null, { timeout: 15000 });
    const archiveDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(archiveDb.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources').get().n, 0,
        'unassigned state is not uploaded silently during startup');
    } finally { archiveDb.close(); }

    await page.evaluate(() => {
      document.getElementById('btnRecoverLegacy').click();
      document.getElementById('legacyMine').checked = true;
      document.getElementById('legacyArchiveToAccount').click();
    });
    await page.waitForFunction(() => document.getElementById('legacyRecoveryStatus').textContent.includes('尚未合并'),
      null, { timeout: 15000 });

    const verifyDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const row = verifyDb.prepare('SELECT payload_blob,manifest_json FROM user_recovery_sources WHERE user_id=1').get();
      assert.ok(row, 'explicit user confirmation archives the exact source under the authenticated account');
      const manifest = JSON.parse(row.manifest_json);
      assert.equal(manifest.verified, true);
      assert.equal(manifest.state, 'archived-not-merged');
      assert.ok(manifest.redactedPrivateFields.some(field => field.endsWith('.settings.apiKey')));
      const sourceText = gunzipSync(row.payload_blob).toString('utf8');
      assert.ok(sourceText.includes('旧题库'));
      assert.ok(sourceText.includes('old-course'));
      assert.ok(!sourceText.includes('private-key-must-stay-local'), 'private API keys are excluded from uploaded recovery data');
    } finally { verifyDb.close(); }

    const original = await page.evaluate(async () => ({
      owner: localStorage.getItem('chunklab.storage-owner.v1'),
      legacyMem: JSON.parse(localStorage.getItem('chunklab.v1')),
      oldDatabaseStillReadable: (await indexedDB.databases()).some(db => db.name === 'chunklab-idb')
    }));
    assert.equal(original.owner, 'legacy-unassigned');
    assert.equal(original.legacyMem.settings.apiKey, 'private-key-must-stay-local');
    assert.equal(original.oldDatabaseStillReadable, true, 'archival does not clear or replace the source namespace');
    console.log('[legacy-recovery] unassigned source requires confirmation, archives with receipt, redacts private API key and preserves the original namespace');
  } catch (error) {
    console.error('[legacy-recovery] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }
})();
