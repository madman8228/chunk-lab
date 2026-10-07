/* Exercises the real account-scoped IndexedDB queue against an isolated SQLite server. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');
const Database = require('../server/node_modules/better-sqlite3');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9500, 100);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-op-queue-'));
let server;
let browser;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const req = http.get('http://127.0.0.1:' + port + '/api/health', (res) => {
        res.resume();
        if (res.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      req.on('error', () => {});
      req.setTimeout(600, () => req.destroy());
      if (attempts >= 100) { clearInterval(timer); reject(new Error('temporary server did not start')); }
    }, 100);
  });
}

async function loadClient(page) {
  for (const file of ['js/account-storage.js', 'js/idb.js', 'api.js']) {
    await page.addScriptTag({ path: path.join(root, file) });
  }
  await page.evaluate(async () => {
    const config = await fetch('/api/config').then((response) => response.json());
    window.CL = { getCloudConfig: () => config };
  });
  await page.addScriptTag({ path: path.join(root, 'js/server-cache.js') });
  await page.addScriptTag({ path: path.join(root, 'js/server-store.js') });
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, { PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3' }),
      stdio: 'ignore',
    });
    await waitForServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + port + '/api/health');
    const config = await page.evaluate(async () => (await fetch('/api/config')).json());
    assert.equal(config.writeProtocol, 3);
    assert.equal(config.persistenceMode, 'server-authoritative');
    await loadClient(page);

    const queued = await page.evaluate(async () => {
      const send = ChunkAPI.submitOperation;
      let sendEvidenceAtTransport = null;
      ChunkAPI.submitOperation = async operation => {
        const row = (await IDBStore.listPendingOperations()).find(item => item.requestId === operation.requestId);
        sendEvidenceAtTransport = row && { evidenceVersion:row.attemptEvidenceVersion, attemptStartedAt:row.attemptStartedAt };
        throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
      };
      let errorCode;
      try {
        const accepted = await ServerStore.submit('learning.answer', {
          eventId: 'queue-event-000001', key: 'queue-deck#sentence-1', deckId: 'queue-deck', ok: true,
        });
        if (!accepted || !accepted.durable) errorCode = 'NOT_DURABLE';
      } catch (error) { errorCode = error.code; }
      for (let turn = 0; turn < 30 && !sendEvidenceAtTransport; turn++) await new Promise(resolve => setTimeout(resolve, 10));
      ChunkAPI.submitOperation = send;
      const stableId = 'idb-immutable-request-0001';
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin).href.replace(/\/+$/, '');
      const scope = JSON.stringify([base, AccountStorage.owner, 3]);
      const operation = { protocol: 3, requestId: stableId, type: 'settings.patch', payload: { patch: { sound: false } } };
      const row = { requestId: stableId, operation, owner: AccountStorage.owner, sessionEpoch: AccountStorage.sessionEpoch || '',
        base, scope, createdAt: Date.now(), attempts: 0, status: 'pending', bytes: new Blob([JSON.stringify(operation)]).size };
      const first = await IDBStore.putPendingOperation(row, { maxCount: 10000, maxBytes: 20 * 1024 * 1024 });
      const retry = await IDBStore.putPendingOperation(Object.assign({}, row, { operation: {
        payload: { patch: { sound: false } }, type: 'settings.patch', requestId: stableId, protocol: 3,
      } }), { maxCount: 10000, maxBytes: 20 * 1024 * 1024 });
      let reusedError = null;
      try {
        await IDBStore.putPendingOperation(Object.assign({}, row, { operation: Object.assign({}, operation, { payload: { patch: { sound: true } } }) }),
          { maxCount: 10000, maxBytes: 20 * 1024 * 1024 });
      } catch (error) { reusedError = error.code; }
      let scopeReuseError = null;
      try {
        await IDBStore.putPendingOperation(Object.assign({}, row, { scope: JSON.stringify([base + '/other', AccountStorage.owner, 3]) }),
          { maxCount: 10000, maxBytes: 20 * 1024 * 1024 });
      } catch (error) { scopeReuseError = error.code; }
      const preserved = (await IDBStore.listPendingOperations()).find(item => item.requestId === stableId);
      await IDBStore.removePendingOperation(stableId);
      const rows = await IDBStore.listPendingOperations();
      return { errorCode, rows, sendEvidenceAtTransport, ordinal: first.ordinal, retryOrdinal: retry.ordinal, reusedError, scopeReuseError,
        preservedValue: preserved.operation.payload.patch.sound };
    });
    assert.equal(queued.errorCode, undefined);
    assert.equal(queued.ordinal, queued.retryOrdinal, 'an identical request keeps its transactional queue ordinal');
    assert.equal(queued.reusedError, 'REQUEST_ID_REUSED', 'the same request id cannot overwrite a different operation');
    assert.equal(queued.scopeReuseError, 'REQUEST_ID_REUSED', 'the same request id cannot be reused under a different API scope');
    assert.equal(queued.preservedValue, false, 'a mismatched retry leaves the original payload intact');
    assert.equal(queued.sendEvidenceAtTransport && queued.sendEvidenceAtTransport.evidenceVersion, 1,
      'real IndexedDB send-evidence metadata is committed before the transport call');
    assert.ok(queued.sendEvidenceAtTransport && Number.isFinite(queued.sendEvidenceAtTransport.attemptStartedAt),
      'the first-attempt timestamp exists in IndexedDB before the transport call');
    assert.equal(queued.rows.length, 1, 'offline operation is durably queued in real IndexedDB');
    assert.equal(queued.rows[0].owner, await page.evaluate(() => AccountStorage.owner));
    const requestId = queued.rows[0].requestId;

    await page.reload();
    await loadClient(page);
    await waitForAsync(page, async () => (await IDBStore.listPendingOperations()).length === 0, null, { timeout: 10000 });
    await page.waitForFunction(() => ServerStore.state().pending === 0 && ServerStore.state().phase !== 'sending', null, { timeout: 10000 });
    const receipt = await page.evaluate(id => ChunkAPI.getOperationReceipt(id), requestId);
    assert.equal(receipt.requestId, requestId, 'startup recovery preserves the original idempotency key');
    assert.equal(await page.evaluate(() => ServerStore.state().phase), 'saved');
    const confirmedCache = await page.evaluate(async () => {
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin); base.hash = ''; base.search = '';
      const scope = JSON.stringify([base.href.replace(/\/+$/, ''), AccountStorage.owner, 3]);
      return IDBStore.readServerCache(scope, AccountStorage.owner);
    });
    assert.ok(confirmedCache, 'server data is stored in the account-scoped IndexedDB cache');
    assert.ok(confirmedCache.appliedSeq >= receipt.seq, 'the applied watermark covers the acknowledged operation');
    assert.equal(confirmedCache.snapshot.mem.stats.bySentence['queue-deck#sentence-1'].times, 1,
      'the ACK is retired only after its confirmed learning result is in the same cache transaction');

    // Large content must use the bounded import allowance, survive a browser
    // reload in real IndexedDB, and keep its request identity while offline.
    let largeImportAttempts = 0;
    await page.route('**/api/content-import', async route => {
      largeImportAttempts++;
      await route.abort('failed');
    });
    const largeRequestId = 'e2e_large_import_durable_0001';
    const largeQueued = await page.evaluate(async requestId => {
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin).href.replace(/\/+$/, '');
      const scope = JSON.stringify([base, AccountStorage.owner, 3]);
      const operation = { protocol: 3, requestId, type: 'course.put', payload: {
        course: { courseId: 'large-idb-import-fixture', payload: 'x'.repeat(20 * 1024 * 1024 + 1) },
      } };
      const row = { requestId, operation, owner: AccountStorage.owner,
        sessionEpoch: AccountStorage.sessionEpoch || '', base, scope, createdAt: Date.now(),
        attempts: 0, status: 'pending', bytes: new Blob([JSON.stringify(operation)]).size };
      const saved = await IDBStore.putPendingOperation(row, { maxCount: 10000, maxBytes: 100 * 1024 * 1024 });
      return { ordinal: saved.ordinal, bytes: saved.bytes };
    }, largeRequestId);
    assert.ok(largeQueued.bytes > 20 * 1024 * 1024, 'the fixture exercises the large-import capacity allowance');
    await page.reload();
    await loadClient(page);
    await waitForAsync(page, async id => {
      const rows = await IDBStore.listPendingOperations();
      return rows.some(row => row.requestId === id && row.status === 'pending');
    }, largeRequestId, { timeout: 10000 });
    await page.evaluate(() => ServerStore.retryPending());
    assert.ok(largeImportAttempts > 0, 'the restored durable large import is retried through the dedicated endpoint');
    const restoredLarge = await page.evaluate(async id => (await IDBStore.listPendingOperations()).find(row => row.requestId === id), largeRequestId);
    assert.equal(restoredLarge.operation.requestId, largeRequestId, 'reload preserves the large import idempotency key');
    assert.equal(restoredLarge.ordinal, largeQueued.ordinal, 'reload preserves the large import ordering position');
    await page.evaluate(id => IDBStore.removePendingOperation(id), largeRequestId);
    await page.unroute('**/api/content-import');

    // The server commits the operation but the first response is deliberately
    // lost. A retry must reuse the same request/event identity and not count twice.
    const lostAckRequestId = 'e2e_lost_ack_request_0001';
    const lostAckEventId = 'e2e_lost_ack_event_0001';
    let lostAckRequests = 0;
    const loseFirstAck = async route => {
      let operation;
      try { operation = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      if (!operation || operation.requestId !== lostAckRequestId) return route.continue();
      lostAckRequests++;
      const response = await route.fetch();
      if (lostAckRequests === 1) return route.abort('failed');
      return route.fulfill({ response });
    };
    await page.route('**/api/operations', loseFirstAck);
    const lostAckAccepted = await page.evaluate(async ({requestId,eventId}) => ServerStore.submit('learning.answer', {
      eventId, key:'queue-deck#sentence-lost-ack', deckId:'queue-deck', ok:true,
      firstAttempt:true, occurredAt:Date.now(), mode:'choose',
    }, {requestId}), {requestId:lostAckRequestId,eventId:lostAckEventId});
    assert.equal(lostAckAccepted.durable, true, 'the operation is durably queued before its server ACK can be lost');
    const receiptDb = new Database(path.join(dataDir, 'chunklab.db'));
    const receiptCount = () => receiptDb.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=1 AND request_id=?')
      .get(lostAckRequestId).count;
    const eventCount = () => receiptDb.prepare('SELECT COUNT(*) AS count FROM user_operation_events WHERE user_id=1 AND event_id=?')
      .get(lostAckEventId).count;
    const firstCommitDeadline = Date.now() + 10000;
    while ((!receiptCount() || lostAckRequests < 1) && Date.now() < firstCommitDeadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(receiptCount(), 1, 'SQLite committed the operation before its first ACK was dropped');
    assert.equal(eventCount(), 1, 'the original logical event is recorded once before retry');
    await page.evaluate(() => ServerStore.retryPending());
    await waitForAsync(page, async id => !(await IDBStore.listPendingOperations()).some(row => row.requestId === id),
      lostAckRequestId, { timeout:10000 });
    assert.equal(lostAckRequests, 2, 'the original idempotency request is retried exactly once in this scenario');
    assert.equal(receiptCount(), 1, 'retry reuses the one durable server receipt');
    assert.equal(eventCount(), 1, 'retry does not create a second logical learning event');
    const lostAckStat = receiptDb.prepare(`SELECT data_json FROM user_sentence_stats
      WHERE user_id=1 AND sentence_key=? AND deleted_at IS NULL`).get('queue-deck#sentence-lost-ack');
    assert.equal(JSON.parse(lostAckStat.data_json).times, 1, 'the lost-ACK retry increments the sentence only once');
    receiptDb.close();

    // The server may commit just before credentials change, while its response
    // is still in flight. Keep the response held after SQLite has committed,
    // switch the active owner, then prove the old IDB row is fenced and can be
    // recovered under its original owner without duplicating the server event.
    await page.unroute('**/api/operations', loseFirstAck);
    const switchRequestId = 'account-switch-late-request-01';
    const switchEventId = 'account-switch-late-event-01';
    let releaseSwitchResponse;
    let signalSwitchCommitted;
    const switchCommitted = new Promise(resolve => { signalSwitchCommitted = resolve; });
    const switchResponseRelease = new Promise(resolve => { releaseSwitchResponse = resolve; });
    const holdAfterCommit = async route => {
      let operation;
      try { operation = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      if (!operation || operation.requestId !== switchRequestId) return route.continue();
      const response = await route.fetch();
      signalSwitchCommitted();
      await switchResponseRelease;
      return route.fulfill({ response });
    };
    await page.route('**/api/operations', holdAfterCommit);
    const switchAccepted = await page.evaluate(async ({ requestId, eventId }) => {
      const owner = AccountStorage.owner;
      const accepted = await ServerStore.submit('learning.answer', {
        eventId, key:'queue-deck#account-switch-late', deckId:'queue-deck', ok:true,
        firstAttempt:true, occurredAt:Date.now(), mode:'choose',
      }, {requestId});
      return { owner, accepted };
    }, { requestId:switchRequestId, eventId:switchEventId });
    assert.equal(switchAccepted.accepted.durable, true, 'the operation is durable before its server response is released');
    await Promise.race([switchCommitted, new Promise((_, reject) => setTimeout(() => reject(new Error('late-response fixture was not committed')), 10000))]);
    const switchDb = new Database(path.join(dataDir, 'chunklab.db'));
    const switchReceiptCount = () => switchDb.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=1 AND request_id=?')
      .get(switchRequestId).count;
    const switchEventCount = () => switchDb.prepare('SELECT COUNT(*) AS count FROM user_operation_events WHERE user_id=1 AND event_id=?')
      .get(switchEventId).count;
    assert.equal(switchReceiptCount(), 1, 'SQLite committed the operation before the account switch');
    await page.evaluate(owner => { AccountStorage.owner = 'switched-' + owner; }, switchAccepted.owner);
    releaseSwitchResponse();
    await page.waitForFunction(() => ServerStore.state().phase === 'paused' && ServerStore.state().error === 'SESSION_CHANGED', null, { timeout:10000 });
    const fencedRow = await page.evaluate(async requestId => {
      const rows = await IDBStore.listPendingOperations();
      return { visible:(await ServerStore.pending()).some(row => row.requestId === requestId),
        row:rows.find(row => row.requestId === requestId) };
    }, switchRequestId);
    assert.equal(fencedRow.visible, false, 'the previous owner cannot see its pending row while another owner is active');
    assert.equal(fencedRow.row.owner, switchAccepted.owner, 'the delayed response cannot relabel or retire the old-owner operation');
    assert.equal(fencedRow.row.status, 'pending', 'the unconfirmed local operation remains durably recoverable');
    await page.evaluate(owner => { AccountStorage.owner = owner; }, switchAccepted.owner);
    await page.evaluate(() => ServerStore.retryPending());
    await waitForAsync(page, async requestId => !(await IDBStore.listPendingOperations()).some(row => row.requestId === requestId),
      switchRequestId, { timeout:10000 });
    assert.equal(switchReceiptCount(), 1, 'same-request recovery reuses the single SQLite receipt');
    assert.equal(switchEventCount(), 1, 'same-request recovery applies the learning event exactly once');
    const switchStat = switchDb.prepare(`SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=? AND deleted_at IS NULL`)
      .get('queue-deck#account-switch-late');
    assert.equal(JSON.parse(switchStat.data_json).times, 1, 'a response racing an account switch never duplicates the answer');
    switchDb.close();
    await page.unroute('**/api/operations', holdAfterCommit);

    // IndexedDB transactions, not wall-clock timestamps or tab-local counters,
    // assign the order used to replay operations from multiple tabs.
    const secondTab = await context.newPage();
    await secondTab.goto('http://127.0.0.1:' + port + '/api/health');
    await loadClient(secondTab);
    const tabOwners = await Promise.all([page.evaluate(() => AccountStorage.owner), secondTab.evaluate(() => AccountStorage.owner)]);
    assert.equal(tabOwners[1], tabOwners[0], 'both tabs resolve to the same account owner');
    const concurrentIds = ['cross_tab_same_time_request_0001', 'cross_tab_same_time_request_0002'];
    const concurrentOrdinals = await Promise.all([page, secondTab].map((tab, index) => tab.evaluate(async (requestId) => {
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin).href.replace(/\/+$/, '');
      const operation = { protocol: 3, requestId, type: 'settings.patch', payload: { patch: { sound: false } } };
      const row = { requestId, operation, owner: AccountStorage.owner,
        sessionEpoch: AccountStorage.sessionEpoch || '', base,
        scope: JSON.stringify([base, AccountStorage.owner, 3]), createdAt: Date.now(),
        attempts: 0, status: 'pending', bytes: new Blob([JSON.stringify(operation)]).size };
      const saved = await IDBStore.putPendingOperation(row, { maxCount: 10000, maxBytes: 20 * 1024 * 1024 });
      return saved.ordinal;
    }, concurrentIds[index])));
    assert.notEqual(concurrentOrdinals[0], concurrentOrdinals[1],
      'concurrent writes from two tabs receive distinct queue ordinals');
    const concurrentRows = await page.evaluate(async (ids) => {
      const rows = await IDBStore.listPendingOperations();
      return rows.filter(row => ids.includes(row.requestId)).sort((a, b) => a.ordinal - b.ordinal);
    }, concurrentIds);
    assert.deepEqual(concurrentOrdinals.slice().sort((a, b) => a - b), [1, 2],
      'same-time operations receive consecutive ordinals from the shared durable queue');
    assert.deepEqual(concurrentRows.map(row => row.ordinal), [1, 2],
      'both tabs observe the same strictly ordered durable queue');
    await page.evaluate(async (ids) => Promise.all(ids.map(id => IDBStore.removePendingOperation(id))), concurrentIds);

    const drainIds = ['cross_tab_drain_request_0001', 'cross_tab_drain_request_0002'];
    const drainEvents = ['cross_tab_drain_event_0001', 'cross_tab_drain_event_0002'];
    const wireRequests = new Map();
    const observeConcurrentDrain = async route => {
      let operation;
      try { operation = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      if (operation && drainIds.includes(operation.requestId)) {
        wireRequests.set(operation.requestId, (wireRequests.get(operation.requestId) || 0) + 1);
      }
      return route.continue();
    };
    await Promise.all([page.route('**/api/operations', observeConcurrentDrain),
      secondTab.route('**/api/operations', observeConcurrentDrain)]);
    await Promise.all([page, secondTab].map((tab, index) => tab.evaluate(async ({requestId,eventId,index}) => {
      const operation = {protocol:3,requestId,type:'learning.answer',payload:{
        eventId,key:'queue-deck#cross-tab-'+index,deckId:'queue-deck',ok:true,firstAttempt:true,
        occurredAt:Date.now(),mode:'choose',
      }};
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin).href.replace(/\/+$/, '');
      await IDBStore.putPendingOperation({requestId,operation,owner:AccountStorage.owner,
        sessionEpoch:AccountStorage.sessionEpoch||'',base,scope:JSON.stringify([base,AccountStorage.owner,3]),
        createdAt:Date.now(),attempts:0,status:'pending',bytes:new Blob([JSON.stringify(operation)]).size},
      {maxCount:10000,maxBytes:20*1024*1024});
    }, {requestId:drainIds[index],eventId:drainEvents[index],index:index+1})));
    await Promise.all([page,secondTab].map(tab=>tab.evaluate(()=>ServerStore.retryPending())));
    await waitForAsync(page, async ids => !(await IDBStore.listPendingOperations()).some(row=>ids.includes(row.requestId)),
      drainIds,{timeout:10000});
    await Promise.all([page.unroute('**/api/operations',observeConcurrentDrain),
      secondTab.unroute('**/api/operations',observeConcurrentDrain)]);
    assert.deepEqual(drainIds.map(id=>wireRequests.get(id)),[1,1],
      'simultaneous drains across two tabs send each ordered operation once');
    const drainDb = new Database(path.join(dataDir,'chunklab.db'));
    try {
      drainEvents.forEach((eventId,index)=>{
        assert.equal(drainDb.prepare('SELECT COUNT(*) AS count FROM user_operation_events WHERE user_id=1 AND event_id=?').get(eventId).count,1,
          'each concurrent-tab logical event commits once');
        const stat=drainDb.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=? AND deleted_at IS NULL')
          .get('queue-deck#cross-tab-'+(index+1));
        assert.equal(JSON.parse(stat.data_json).times,1,'concurrent drains do not duplicate the sentence statistic');
      });
    } finally { drainDb.close(); }
    await secondTab.close();

    const enqueueFailureRequestId = 'local_enqueue_failure_001';
    let enqueueFailureRequestCount = 0;
    await page.route('**/api/operations', async route => {
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.requestId === enqueueFailureRequestId) enqueueFailureRequestCount++;
      } catch (_) {}
      await route.continue();
    });
    const enqueueFailure = await page.evaluate(async requestId => {
      const original = IDBStore.putPendingOperation;
      IDBStore.putPendingOperation = function () {
        return Promise.reject(Object.assign(new Error('simulated IndexedDB quota failure'), { code: 'QUOTA_EXCEEDED' }));
      };
      try {
        await ServerStore.submit('learning.answer', { eventId: 'enqueue-failure-answer' }, { requestId });
        return { rejected: false, state: ServerStore.state() };
      } catch (error) {
        return { rejected: true, code: error.code, state: ServerStore.state(), rows: await IDBStore.listPendingOperations() };
      } finally {
        IDBStore.putPendingOperation = original;
      }
    }, enqueueFailureRequestId);
    await page.waitForTimeout(150);
    assert.equal(enqueueFailure.rejected, true, 'an IndexedDB enqueue failure is returned to the learner');
    assert.equal(enqueueFailure.code, 'QUOTA_EXCEEDED');
    assert.equal(enqueueFailure.rows.some(row => row.requestId === enqueueFailureRequestId), false,
      'failed durability does not leave a phantom queued save');
    assert.equal(enqueueFailureRequestCount, 0, 'the operation is never sent before durable local enqueue succeeds');

    const recoveredRequestId = 'ack_cache_failure_reload_001';
    let recoveredRequestCount = 0;
    await page.route('**/api/operations', async route => {
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.requestId === recoveredRequestId) recoveredRequestCount++;
      } catch (_) {}
      await route.continue();
    });
    await page.evaluate(async requestId => {
      const original = IDBStore.commitServerCache.bind(IDBStore);
      let failed = false;
      IDBStore.commitServerCache = function () {
        if (!failed) { failed = true; return Promise.reject(Object.assign(new Error('simulated cache write failure before reload'), { code: 'SIMULATED_CACHE_FAILURE' })); }
        return original.apply(null, arguments);
      };
      await ServerStore.submit('settings.patch', { patch: { sound: false } }, { requestId });
    }, recoveredRequestId);
    await waitForAsync(page, async requestId => {
      const row = (await IDBStore.listPendingOperations()).find(item => item.requestId === requestId);
      return !!row && row.status === 'acked-awaiting-apply';
    }, recoveredRequestId, { timeout: 10000 });
    await page.reload();
    await loadClient(page);
    await waitForAsync(page, async requestId => !(await IDBStore.listPendingOperations()).some(item => item.requestId === requestId),
      recoveredRequestId, { timeout: 10000 });
    const recoveredReceiptHandle = await waitForAsync(page, async id => {
      try {
        const receipt = await ChunkAPI.getOperationReceipt(id);
        return receipt && receipt.requestId === id ? receipt : false;
      } catch (error) {
        if (error && error.code === 'OPERATION_NOT_FOUND') return false;
        throw error;
      }
    }, recoveredRequestId, { timeout: 5000 });
    const recoveredReceipt = recoveredReceiptHandle;
    assert.equal(recoveredReceipt.requestId, recoveredRequestId, 'the server receipt is recoverable after a page reload');
    assert.equal(recoveredRequestCount, 1, 'an ACKed operation is refreshed from the cache instead of being sent again');

    const assessment = await page.evaluate(async () => {
      const key = 'oral-1-1-1#575b1d3a';
      const now = Date.now();
      await ChunkAPI.submitOperation({ protocol: 3, requestId: 'e2e_assessment_exposure_01', type: 'learning.exposure', payload: {
        eventId: 'e2e_exposure_event_01', key, deckId: 'oral-1-1-1', occurredAt: now - 8 * 24 * 60 * 60 * 1000,
        sessionId: 'e2e_exposure_session_01', generation: 0,
      } });
      await ChunkAPI.submitOperation({ protocol: 3, requestId: 'e2e_assessment_start_0001', type: 'assessment.start', payload: {
        eventId: 'e2e_assessment_start_event_01', sessionId: 'e2e_assessment_session_01', keys: [key], generation: 0,
      } });
      const started = await ChunkAPI.getAssessmentSession('e2e_assessment_session_01');
      const expected = started.session.items[0].chunks;
      await ChunkAPI.submitOperation({ protocol: 3, requestId: 'e2e_assessment_answer_0001', type: 'assessment.answer', payload: {
        eventId: 'e2e_assessment_answer_event_01', sessionId: started.session.id, itemIndex: 0, answers: expected,
      } });
      const commitCache = IDBStore.commitServerCache.bind(IDBStore);
      let failCacheCommit = true;
      IDBStore.commitServerCache = function () {
        if (failCacheCommit) {
          failCacheCommit = false;
          return Promise.reject(Object.assign(new Error('simulated cache transaction failure'), { code: 'SIMULATED_CACHE_FAILURE' }));
        }
        return commitCache.apply(null, arguments);
      };
      const finalPromise = ServerStore.submitCommitted('assessment.finalize', {
        eventId: 'e2e_assessment_final_event_01', sessionId: started.session.id,
      });
      let awaitingApply = null;
      for (let turn = 0; turn < 100 && !awaitingApply; turn++) {
        awaitingApply = (await IDBStore.listPendingOperations()).find(row => row.operation.type === 'assessment.finalize');
        if (awaitingApply && awaitingApply.status !== 'acked-awaiting-apply') awaitingApply = null;
        if (!awaitingApply) await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (!awaitingApply) throw new Error('server ACK was not durably retained while the cache transaction failed');
      const beforeRetry = (await IDBStore.listPendingOperations()).find(row => row.requestId === awaitingApply.requestId);
      if (!beforeRetry || beforeRetry.status !== 'acked-awaiting-apply') throw new Error('ACK state was not retained for safe recovery');
      await ServerStore.retryPending();
      const final = await finalPromise;
      IDBStore.commitServerCache = commitCache;
      const restored = await ChunkAPI.getAssessmentSession(started.session.id);
      const finalSnapshot = await ChunkAPI.getData();
      const cache = await IDBStore.readServerCache(JSON.stringify([new URL(ChunkAPI.getBase() || location.origin, location.origin).origin, AccountStorage.owner, 3]), AccountStorage.owner);
      return { expected, passed: final.operation.result.passed, finalRequestId: final.requestId, status: restored.session.status,
        verified: restored.session.items[0].correct, times: finalSnapshot.mem.stats.bySentence[key].times,
        appliedSeq: cache.appliedSeq, serverSeq: finalSnapshot.seq, pending: await IDBStore.listPendingOperations() };
    });
    assert.deepEqual(assessment.expected, ['Good', 'morning.']);
    assert.equal(assessment.passed, true, 'the server scores the submitted answers against its own content');
    assert.match(assessment.finalRequestId, /^[0-9a-f-]{36}$/i, 'the result is displayed only after a durable operation receives its server receipt');
    assert.equal(assessment.status, 'completed', 'the completed session survives a fresh HTTP read');
    assert.equal(assessment.verified, true);
    assert.equal(assessment.times, 0, 'assessment does not inflate practice-only answer totals');
    assert.ok(assessment.appliedSeq >= assessment.serverSeq, 'the refreshed cache watermark is current after recovery');
    assert.equal(assessment.pending.length, 0, 'the acknowledged operation retires after the atomic cache retry');

    const draftIsolation = await page.evaluate(async () => {
      const originalOwner = AccountStorage.owner;
      await IDBStore.putAssessmentDraft({ id: 'assessment_draft_owner_a', status: 'active', items: [] });
      AccountStorage.owner = 'other-owner';
      await IDBStore.putAssessmentDraft({ id: 'assessment_draft_owner_b', status: 'active', items: [] });
      AccountStorage.owner = originalOwner;
      const visible = await IDBStore.listAssessmentDrafts();
      await IDBStore.deleteAssessmentDraft('assessment_draft_owner_a');
      AccountStorage.owner = 'other-owner';
      const otherVisible = await IDBStore.listAssessmentDrafts();
      AccountStorage.owner = originalOwner;
      return { visible: visible.map(row => row.sessionId), otherVisible: otherVisible.map(row => row.sessionId) };
    });
    assert.deepEqual(draftIsolation.visible, ['assessment_draft_owner_a'], 'only the active account can read its local assessment drafts');
    assert.deepEqual(draftIsolation.otherVisible, ['assessment_draft_owner_b'], 'draft deletion and reads are account-scoped');
    console.log('server-store IndexedDB retry test passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }
})();
