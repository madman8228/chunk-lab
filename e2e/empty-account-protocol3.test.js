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
const port = require('./lib/free-port').freePort(11080, 100);
const base = 'http://127.0.0.1:' + port;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-empty-account-'));
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
      if (++attempts >= 200) { clearInterval(timer); reject(new Error('isolated empty-account server did not start')); }
    }, 100);
  });
}

async function answerFirstSentence(page, deckId) {
  await page.evaluate(async id => {
    showPracticePage();
    const deck = await ContentRepo.ensureDeckIndex(id, CL.loadMem());
    startDeck(deck, 0);
  }, deckId);
  await page.waitForSelector('#stageChoices .choice', { timeout: 15000 });
  const expectedChunks = await page.evaluate(() => cur().chunks.slice());
  const answerResponse = page.waitForResponse(response => {
    const request = response.request();
    if (response.status() !== 200) return false;
    if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return false;
    try { return JSON.parse(request.postData() || '{}').type === 'learning.answer'; }
    catch (_) { return false; }
  }, { timeout: 15000 });
  for (const chunk of expectedChunks) {
    await page.waitForFunction(value => Array.from(document.querySelectorAll('#stageChoices .choice')).some(button => button.dataset.v === value), chunk,
      { timeout: 10000 });
    await page.evaluate(value => {
      const button = Array.from(document.querySelectorAll('#stageChoices .choice')).find(item => item.dataset.v === value);
      if (!button) throw new Error('expected answer chunk is not available: ' + value);
      button.click();
    }, chunk);
  }
  const request = (await answerResponse).request();
  return JSON.parse(request.postData());
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
    const answerOperations = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() !== 'GET' && ['/api/data', '/api/import'].includes(url.pathname)) {
        legacyWrites.push({ method: request.method(), path: url.pathname });
      }
      if (request.method() === 'POST' && url.pathname === '/api/operations') {
        try {
          const operation = JSON.parse(request.postData() || '{}');
          if (operation.type === 'learning.answer') answerOperations.push(operation);
        } catch (_) { /* The SQLite and UI assertions below remain authoritative. */ }
      }
    });
    page.on('pageerror', error => console.error('[empty-account] page error:', error.message));
    await page.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const config = window.CL && CL.getCloudConfig && CL.getCloudConfig();
      return config && config.writeProtocol === 3 && CL.serverPersistenceReady && CL.serverPersistenceReady() &&
        window.ServerCache && window.ServerStore && window.AccountStorage && window.ContentRepo;
    }, null, { timeout: 20000 });
    await page.evaluate(() => ContentRepo.ready);
    await page.waitForFunction(() => allDecks().some(deck => deck && deck.builtin && deck._content && deck.itemCount > 0), null,
      { timeout: 20000 });

    const blank = await page.evaluate(async () => {
      const cache = await ServerCache.read();
      const pending = await ServerStore.pending();
      const snapshot = cache && cache.snapshot;
      const mem = snapshot && snapshot.mem || {};
      const deck = allDecks().find(item => item && item.builtin && item._content && item.itemCount > 0);
      return {
        owner: AccountStorage.owner,
        cacheOwner: cache && cache.owner,
        localDecks: (CL.loadMem().decks || []).filter(item => item && !item.builtin).map(item => item.id),
        remoteDecks: (mem.decks || []).filter(item => item && !item.builtin).map(item => item.id),
        recoverySources: snapshot && snapshot.recoverySources,
        pending: pending.length,
        deckId: deck && deck.id,
        conflictUiVisible: !!document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog,[data-sync-conflict]'),
      };
    });
    assert.equal(blank.cacheOwner, blank.owner, 'a new browser owner receives its own confirmed server cache');
    assert.deepEqual(blank.localDecks, [], 'a blank account does not invent user-owned local decks');
    assert.deepEqual(blank.remoteDecks, [], 'a blank account has no migrated user-owned decks');
    assert.equal(blank.pending, 0, 'a blank account does not manufacture pending recovery operations');
    assert.ok(blank.deckId, 'the account can still use shared built-in learning content');
    assert.equal(blank.conflictUiVisible, false, 'an empty account does not show legacy conflict UI');

    const answerOperation = await answerFirstSentence(page, blank.deckId);
    assert.equal(answerOperations.length, 1, 'one answer operation was emitted by the UI');
    const eventId = answerOperation.payload.eventId;
    const db = new Database(path.join(dataDir, 'chunklab.db'));
    try {
      const accepted = db.prepare('SELECT COUNT(*) AS count FROM user_operation_events WHERE event_id=?').get(eventId).count;
      assert.equal(accepted, 1, 'a real answer from a blank account is durably accepted exactly once');
      const user = db.prepare("SELECT id FROM users WHERE username='__default__'").get();
      assert.ok(user, 'the isolated open-mode test user exists');
      const sources = db.prepare('SELECT COUNT(*) AS count FROM user_recovery_sources WHERE user_id=?').get(user.id).count;
      assert.equal(sources, 0, 'an empty account does not create a fake legacy recovery archive');
    } finally { db.close(); }

    assert.deepEqual(legacyWrites, [], 'a blank-account learning flow never calls legacy full-snapshot or import writes');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => CL.serverPersistenceReady && CL.serverPersistenceReady(), null, { timeout: 20000 });
    const afterReloadDb = new Database(path.join(dataDir, 'chunklab.db'));
    try {
      const accepted = afterReloadDb.prepare('SELECT COUNT(*) AS count FROM user_operation_events WHERE event_id=?').get(eventId).count;
      assert.equal(accepted, 1, 'refreshing a blank account does not duplicate its first answer');
    } finally { afterReloadDb.close(); }
    assert.deepEqual(legacyWrites, [], 'refresh still does not emit legacy writes');
    await context.close();

    const conflictContext = await browser.newContext({ serviceWorkers: 'block' });
    const conflictPage = await conflictContext.newPage();
    const conflictLegacyWrites = [];
    const conflictAnswers = [];
    conflictPage.on('request', request => {
      const url = new URL(request.url());
      if (request.method() !== 'GET' && ['/api/data', '/api/import'].includes(url.pathname)) {
        conflictLegacyWrites.push({ method: request.method(), path: url.pathname });
      }
      if (request.method() === 'POST' && url.pathname === '/api/operations') {
        try {
          const operation = JSON.parse(request.postData() || '{}');
          if (operation.type === 'learning.answer') conflictAnswers.push(operation);
        } catch (_) { /* Verified below against SQLite. */ }
      }
    });
    const recoverySource = fs.readFileSync(path.join(root, 'js/legacy-recovery.js'), 'utf8');
    const recoveryFixture = `\n;(function(){var handover=window.LegacyRecovery.handoverPendingOperations;`+
      `window.LegacyRecovery.handoverPendingOperations=function(){return handover.call(this).then(function(result){`+
      `sessionStorage.setItem('__handoverConflictFixture','loaded');`+
      `return Object.assign({},result,{retained:2,conflicts:2,queueFailures:0});});};})();\n`;
    await conflictPage.route('**/js/legacy-recovery.js', route => route.fulfill({
      status: 200, contentType: 'application/javascript', body: recoverySource + recoveryFixture,
    }));
    await conflictPage.goto(base + '/main.html?archived-conflict-startup=1', { waitUntil: 'domcontentloaded' });
    await conflictPage.waitForFunction(() => CL.serverPersistenceReady && CL.serverPersistenceReady(), null, { timeout: 20000 });
    assert.equal(await conflictPage.evaluate(() => sessionStorage.getItem('__handoverConflictFixture')), null,
      'normal startup never invokes legacy handover');
    const conflictStartup = await conflictPage.evaluate(() => ({
      ready: CL.serverPersistenceReady(),
      conflictUiVisible: !!document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog,[data-sync-conflict]'),
    }));
    assert.deepEqual(conflictStartup, { ready: true, conflictUiVisible: false },
      'normal startup remains ready without invoking the routed legacy handover fixture or exposing conflict UI');
    const conflictAnswer = await answerFirstSentence(conflictPage, blank.deckId);
    const conflictDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const accepted = conflictDb.prepare('SELECT COUNT(*) AS count FROM user_operation_events WHERE event_id=?')
        .get(conflictAnswer.payload.eventId).count;
      assert.equal(accepted, 1, 'the real UI durably accepts new learning after normal startup bypasses legacy handover');
    } finally { conflictDb.close(); }
    assert.equal(conflictAnswers.length, 1, 'one new answer operation was emitted after conflict-tolerant startup');
    assert.deepEqual(conflictLegacyWrites, [], 'conflict-tolerant startup does not fall back to legacy snapshot writes');
    await conflictContext.close();
    console.log('[empty-account-protocol3] blank account saves answers exactly once; normal startup does not invoke legacy handover');
  } catch (error) {
    console.error('[empty-account-protocol3] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => { server.once('close', resolve); server.kill('SIGTERM'); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
