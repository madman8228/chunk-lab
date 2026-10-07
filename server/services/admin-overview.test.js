'use strict';

const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createAdminOverview } = require('./admin-overview');

const local = { value: { mem: { decks: [{ name: 'private sentence content' }] } } };
const remote = { value: { mem: { decks: [{ name: 'other private content' }] } } };
let requestedLimit = null;
const db = {
  prepare(sql) {
    assert.match(sql, /user_recovery_sources/);
    assert.match(sql, /background-conflict-quarantine/);
    assert.match(sql, /json_extract\(s\.manifest_json, '\$\.verified'\)=1/);
    return {
      all(limit) {
        requestedLimit = limit;
        return [{
          user_id: 9,
          username: 'learner-nine',
          source_id: 'quarantine-source',
          source_hash: 'a'.repeat(64),
          created_at: '2026-10-05 12:00:00',
          manifest_json: JSON.stringify({ verified: true, syncConflict: {
            kind: 'background-conflict-quarantine', version: 1, entity: 'batch', batch: true,
            capturedAt: '2026-10-05T12:00:00.000Z', localHash: 'b'.repeat(64), remoteHash: 'c'.repeat(64),
            pair: { local, remote }
          } })
        }];
      }
    };
  }
};

const service = createAdminOverview({ db, admin: {}, shanghaiDay: () => '2026-10-05' });
const result = service.adminSyncQuarantines(999);
assert.equal(requestedLimit, 200, 'the admin list is bounded');
assert.deepEqual(result, [{
  userId: 9,
  username: 'learner-nine',
  sourceId: 'quarantine-source',
  sourceHash: 'a'.repeat(64),
  archivedAt: '2026-10-05 12:00:00',
  state: 'archived-unresolved',
  conflict: {
    entity: 'batch', batch: true, capturedAt: '2026-10-05T12:00:00.000Z',
    localHash: 'b'.repeat(64), remoteHash: 'c'.repeat(64)
  }
}], 'the operational index exposes only a verified archive summary, never either learning snapshot');
assert.equal(JSON.stringify(result).includes('private sentence content'), false);

const failureRows = [
  { code: 'ENTITY_CHANGED', status: 409, occurrences: 3, latest_at: '2026-10-06 12:00:00', trace_id: 'trace-safe-123' },
  { code: 'INTERNAL_ERROR', status: 500, occurrences: 1, latest_at: '2026-10-06 11:00:00', trace_id: 'trace-safe-456' }
];
const failureDb = {
  prepare(sql) {
    assert.match(sql, /user_operation_failures/);
    assert.match(sql, /GROUP BY code, status/);
    assert.match(sql, /created_at >= datetime\('now', '-7 days'\)/);
    return { all() { return failureRows; } };
  }
};
const failures = createAdminOverview({ db: failureDb, admin: {}, shanghaiDay: () => '2026-10-05' }).adminSaveFailures(999);
assert.equal(failures.length, 2);
assert.deepEqual(failures[0], {
  code: 'ENTITY_CHANGED', status: 409, occurrences: 3,
  latestAt: '2026-10-06 12:00:00', traceId: 'trace-safe-123'
});
assert.equal(JSON.stringify(failures).includes('private sentence content'), false);
const healthDb = {
  prepare(sql) {
    if (sql.includes('user_operation_receipts')) return { get() { return { count: 12 }; } };
    if (sql.includes('json_tree')) return { get() { return { count: 3 }; } };
    assert.match(sql, /user_client_save_health/);
    assert.match(sql, /COUNT\(DISTINCT user_id\)/);
    return { get(since) {
      assert.ok(Number.isFinite(since) && Date.now() - since >= 30 * 60 * 1000 - 50,
        'admin queue health is limited to the recent window');
      return { clients: 2, accounts: 1, pending: 4, blocked: 1, retry_attempts: 7,
        oldest_pending_at: Date.now() - 120000, latest_at: Date.now() };
    } };
  }
};
const health = createAdminOverview({ db: healthDb, admin: {}, shanghaiDay: () => '2026-10-05' }).adminSaveHealth();
assert.equal(health.activeClients, 2);
assert.equal(health.activeAccounts, 1);
assert.equal(health.pending, 4);
assert.equal(health.blocked, 1);
assert.equal(health.retryAttempts, 7);
assert.equal(health.successfulOperations, 12);
assert.equal(health.migrationRetainedItems, 3);
assert.equal(health.windowMinutes, 30);
const actualDb = new Database(':memory:');
actualDb.exec(`CREATE TABLE user_client_save_health(
  user_id INTEGER, client_id TEXT, pending INTEGER, blocked INTEGER, retry_attempts INTEGER,
  oldest_pending_at INTEGER, error_code TEXT, trace_id TEXT, updated_at INTEGER);
CREATE TABLE user_operation_receipts(created_at TEXT);
CREATE TABLE user_recovery_sources(manifest_json TEXT);`);
const now = Date.now();
actualDb.prepare('INSERT INTO user_client_save_health VALUES(1,?,?,?,?,?,?,?,?)')
  .run('client-a', 2, 1, 5, now - 60000, 'ENTITY_CHANGED', 'trace-a', now);
actualDb.prepare('INSERT INTO user_operation_receipts(created_at) VALUES(datetime(\'now\'))').run();
actualDb.prepare('INSERT INTO user_recovery_sources(manifest_json) VALUES(?)').run(JSON.stringify({ verified: true, migration: { items: {
  decks: [{ id: 'private-deck', status: 'retained-with-reason', reason: 'private reason' }, { id: 'safe-deck', status: 'applied' }]
} } }));
const actualHealth = createAdminOverview({ db: actualDb, admin: {}, shanghaiDay: () => '2026-10-05' }).adminSaveHealth();
assert.equal(actualHealth.pending, 2);
assert.equal(actualHealth.blocked, 1);
assert.equal(actualHealth.retryAttempts, 5);
assert.equal(actualHealth.successfulOperations, 1);
assert.equal(actualHealth.migrationRetainedItems, 1, 'retained migration counts inspect only manifest metadata');
actualDb.close();
console.log('admin-overview: verified conflict quarantine summary is bounded, admin-side, and excludes snapshot contents');
