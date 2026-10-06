'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function createStore(options) {
  const timers = [];
  const reports = [];
  const local = new Map();
  const base = 'https://study.example/api-root';
  const scope = JSON.stringify([base, 'owner-a', 3]);
  const rows = options.rows || [];
  const window = {
    crypto: webcrypto,
    location: { origin: 'https://study.example' },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {},
    Blob,
    localStorage: {
      getItem(key) { return local.get(key) || null; },
      setItem(key, value) { local.set(key, value); }
    },
    navigator: {},
    document: { hidden: false },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    dispatchEvent() {},
    CL: { getCloudConfig: () => options.protocol3 === false ? { persistenceMode: 'legacy', writeProtocol: 2 } :
      { persistenceMode: 'server-authoritative', writeProtocol: 3 }, serverPersistenceReady: () => true },
    AccountStorage: { owner: 'owner-a', assertCurrent() {} },
    IDBStore: { listPendingOperations: async () => rows },
    ChunkAPI: {
      getBase: () => base,
      reportSaveHealth: async report => { reports.push(report); if (options.rejectReport) throw new Error('offline'); }
    }
  };
  const context = vm.createContext({ window, URL, Promise, Object, Array, Number, String, Date, Uint8Array, Infinity });
  vm.runInContext(fs.readFileSync(require.resolve('./server-store.js'), 'utf8'), context);
  return { window, timers, reports, local, scope };
}

(async function () {
  const now = Date.now();
  const store = createStore({ rows: [
    { requestId: 'pending-health-0001', owner: 'owner-a', base: 'https://study.example/api-root',
      scope: JSON.stringify(['https://study.example/api-root', 'owner-a', 3]), status: 'pending', createdAt: now - 90000,
      attempts: 3, lastAttemptAt: now - 5000, lastError: 'ENTITY_CHANGED',
      lastTraceId: '12345678-1234-4234-8234-123456789abc', operation: { payload: { answer: 'private answer' } } },
    { requestId: 'blocked-health-0001', owner: 'owner-a', base: 'https://study.example/api-root',
      scope: JSON.stringify(['https://study.example/api-root', 'owner-a', 3]), status: 'blocked', createdAt: now - 120000,
      attempts: 2, operation: { payload: { sentence: 'private sentence' } } }
  ] });
  await store.window.ServerStore.refreshState();
  const timer = store.timers.find(item => item.delay === 1200);
  assert.ok(timer, 'a debounced aggregate health report is scheduled');
  timer.callback();
  for (let index = 0; index < 10 && store.reports.length === 0; index++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.reports.length, 1);
  assert.equal(store.reports[0].pending, 1);
  assert.equal(store.reports[0].blocked, 1);
  assert.equal(store.reports[0].retryAttempts, 5);
  assert.equal(store.reports[0].oldestPendingAt, now - 90000);
  assert.equal(store.reports[0].errorCode, 'ENTITY_CHANGED');
  assert.equal(store.reports[0].traceId, '12345678-1234-4234-8234-123456789abc');
  assert.match(store.reports[0].clientId, /^[A-Za-z0-9_-]{16,100}$/);
  assert.equal(JSON.stringify(store.reports[0]).includes('private answer'), false);
  assert.equal(JSON.stringify(store.reports[0]).includes('private sentence'), false);
  assert.ok(store.reports[0].clientId.startsWith(store.local.get('chunklab.save-health-client.v1') + '_'),
    'reports use a stable pseudonymous browser id scoped to the API base without disclosing the URL');

  const legacy = createStore({ protocol3: false, rows: [] });
  await legacy.window.ServerStore.refreshState();
  assert.equal(legacy.timers.some(item => item.delay === 1200), false, 'legacy mode does not report protocol-3 queue health');

  const offline = createStore({ rows: [], rejectReport: true });
  await offline.window.ServerStore.refreshState();
  const offlineTimer = offline.timers.find(item => item.delay === 1200);
  offlineTimer.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(offline.window.ServerStore.state().phase, 'idle', 'telemetry failure does not change save state');

  const switched = createStore({ rows: [] });
  await switched.window.ServerStore.refreshState();
  const switchedTimer = switched.timers.find(item => item.delay === 1200);
  switched.window.AccountStorage.owner = 'owner-b';
  switchedTimer.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(switched.reports.length, 0, 'a late diagnostic read is fenced when the account changes');
  console.log('server-store-save-health: only scoped aggregate counters are reported; legacy and telemetry failures are harmless');
})().catch(error => { console.error(error); process.exitCode = 1; });
