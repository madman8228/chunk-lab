/* Real page startup must not depend on legacy recovery, even on old diagnostic URLs. */
'use strict';
const { waitForAsync } = require('./lib/wait-for-async');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const Database = require('../server/node_modules/better-sqlite3');
const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(11200, 100);
const base = 'http://127.0.0.1:' + port;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-server-startup-'));
let server, browser;

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'),
      env: { ...process.env, PORT: String(port), CHUNKLAB_DATA_DIR: dataDir,
        NODE_ENV: 'test', REQUIRE_AUTH: 'false', CHUNKLAB_WRITE_PROTOCOL: '3' }, stdio: 'ignore' });
    let available = false;
    for (let i = 0; i < 100; i++) {
      available = await fetch(base + '/api/health').then(r => r.ok).catch(() => false);
      if (available) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(available, 'isolated server starts');
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const recoveryRequests = [];
    page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/recovery')) recoveryRequests.push(req.url()); });
    await page.route('**/api/recovery/**', route => route.fulfill({ status: 503, body: '{}' }));
    await page.addInitScript(() => {
      if (!localStorage.getItem('chunklab.v1')) {
        localStorage.setItem('chunklab.storage-owner.v1', 'legacy-unassigned');
        localStorage.setItem('chunklab.v1', JSON.stringify({ version: 2, decks: [],
          stats: { totalAnswered: 777 }, settings: {} }));
      }
    });
    await page.goto(base + '/main.html?recoveryArchiveOnly=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.getCloudConfig(), null, { timeout: 15000 });
    await page.evaluate(() => Promise.race([CL.ensureCloud(), new Promise(resolve => setTimeout(resolve, 1500))]));
    assert.equal(await page.evaluate(() => CL.serverPersistenceReady()), true,
      'server saving starts independently of unassigned legacy data and diagnostic query');
    assert.equal(await page.locator('#recoveryArchiveOnlyNotice').count(), 0);
    assert.equal(await page.locator('#btnRecoverLegacy,#legacyRecovery,#recoveryCenter').count(), 0,
      'ordinary settings contain no legacy recovery controls');
    assert.equal(await page.evaluate(() => typeof window.LegacyRecovery), 'undefined',
      'the optional backup module is not loaded by ordinary startup');
    assert.deepEqual(await page.evaluate(() => ['readSyncSnapshot','applySyncResolution','applySyncBatchResolution']
      .map(name=>typeof CL[name])),['undefined','undefined','undefined'],
      'the shared runtime no longer exposes whole-account conflict resolution');
    assert.deepEqual(recoveryRequests, [], 'normal startup does not archive, preview or apply old data');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('chunklab.v1')).stats.totalAnswered), 777,
      'unassigned old data remains untouched');

    // Fail uploads, persist a real answer, then reload before allowing the retry.
    await page.route('**/api/operations', route => route.abort());
    const answer = { eventId: 'startup-answer-000001', deckId: 'startup-deck',
      key: 'startup-deck#sentence-1', ok: true, mode: 'chunkSelection' };
    const queued = await page.evaluate(payload => ServerStore.submit('learning.answer', payload,
      { requestId: 'startup-request-000001' }), answer);
    assert.equal(queued.durable, true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady(), null, { timeout: 15000 });
    assert.ok(await page.evaluate(async () => (await IDBStore.listPendingOperations())
      .some(row => row.requestId === 'startup-request-000001')), 'pending answer survives page reload');
    await page.unroute('**/api/operations');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitForAsync(page, async () => {
      const cache = await ServerCache.read();
      return cache && !(await IDBStore.listPendingOperations()).some(row => row.requestId === 'startup-request-000001') &&
        (cache.snapshot.mem.stats.events || []).some(event => event.id === 'startup-answer-000001');
    }, null, { timeout: 15000 });
    await page.evaluate(payload => ChunkAPI.submitOperation({ protocol: 3, requestId: 'startup-request-000001',
      type: 'learning.answer', payload }), answer);
    await page.route('**/api/config', route => route.abort());
    await page.route('**/api/data*', route => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.getCloudConfig() && !CL.serverPersistenceReady(),
      null, { timeout: 15000 });
    const offlineAnswer = { ...answer, eventId: 'startup-answer-000002', ok: false };
    const offlineQueued = await page.evaluate(payload => ServerStore.submit('learning.answer', payload,
      { requestId: 'startup-request-000002' }), offlineAnswer);
    assert.equal(offlineQueued.durable, true, 'fully offline startup retains the server operation protocol');
    await page.unroute('**/api/config');
    await page.unroute('**/api/data*');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitForAsync(page, async () => CL.serverPersistenceReady() &&
      !(await IDBStore.listPendingOperations()).some(row => row.requestId === 'startup-request-000002'),
      null, { timeout: 15000 });
    await page.evaluate(() => ServerStore.submitCommitted('deck.put', { deck: { id: 'private-import',
      name: 'Private import', items: [{ cid: 'one', en: 'Hello.', zh: '你好。' }] } }, { expectedRev: null }));
    const db = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(db.prepare('SELECT count(*) AS n FROM user_learning_events WHERE event_id=?')
        .get(answer.eventId).n, 1, 'retries and reloads record the answer exactly once');
      assert.equal(db.prepare('SELECT count(*) AS n FROM user_learning_events WHERE event_id=?')
        .get(offlineAnswer.eventId).n, 1, 'answer queued during offline startup reaches the server');
      assert.equal(db.prepare('SELECT count(*) AS n FROM user_decks WHERE id=? AND deleted_at IS NULL')
        .get('private-import').n, 1, 'personal import is committed to server storage');
      assert.equal(db.prepare('SELECT count(*) AS n FROM user_recovery_sources').get().n, 0);
    } finally { db.close(); }
    const second = await context.newPage();
    await second.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
    await waitForAsync(second, async () => {
      if (!window.CL || !CL.serverPersistenceReady()) return false;
      const row = await ServerCache.read();
      return row.snapshot.mem.decks.some(deck => deck.id === 'private-import');
    }, null, { timeout: 15000 });
    await page.unroute('**/api/recovery/**');
    const importedBackup = await page.evaluate(async () => {
      const backup = await ChunkAPI.exportData();
      return new Promise(resolve => importAllData(JSON.stringify(backup), (ok,message) => resolve({ok,message})));
    });
    assert.equal(importedBackup.ok, false, 'explicit backup import does not overwrite a populated account');
    assert.match(importedBackup.message, /当前账号已有服务端数据/);
    assert.equal(await page.evaluate(() => typeof window.LegacyRecovery), 'object',
      'explicit backup import loads its optional module on demand');
    await context.close();
    const incompatibleContext=await browser.newContext({serviceWorkers:'block'});
    const incompatiblePage=await incompatibleContext.newPage();
    const legacyRequests=[];
    incompatiblePage.on('request',request=>{
      const url=new URL(request.url());
      if(url.pathname.startsWith('/api/sync') || /\/js\/(batch-sync|sync-resolution)/.test(url.pathname) ||
          (url.pathname==='/api/data' && request.method()!=='GET')) legacyRequests.push(url.pathname);
    });
    await incompatiblePage.route('**/api/config',route=>route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({writeProtocol:2,persistenceMode:'legacy',requireAuth:false})}));
    await incompatiblePage.goto(base+'/main.html');
    await incompatiblePage.waitForFunction(()=>window.CL&&CL.getPersistenceState()==='config-invalid',null,{timeout:15000});
    assert.equal(await incompatiblePage.evaluate(()=>CL.ensureCloud()),false);
    assert.equal(await incompatiblePage.evaluate(()=>CL.serverPersistenceReady()),false);
    assert.deepEqual(legacyRequests,[],'an unsupported server cannot reactivate legacy upload or conflict tools');
    await incompatibleContext.close();
    console.log('[server-authoritative-startup] startup, retry after reload, deduplication, server import and second page passed');
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) await new Promise(resolve => { server.once('close', resolve); server.kill('SIGTERM'); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
