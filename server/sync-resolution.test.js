'use strict';

const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createBatchResolutionService, batchToken } = require('./sync-resolution');
const { MAX_BYTES } = require('./sync-diagnostics');

function snapshot(seq) {
  return { seq, mem: {
    decks: [], reinforceBook: [], best: {}, mastered: {}, settings: {},
    deletedItems: {}, stats: { bySentence: {}, events: [] }
  }, courses: [], courseProgress: {} };
}
function makeDb() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE user_sync_resolutions (user_id INTEGER, request_id TEXT PRIMARY KEY, request_hash TEXT, backup_json TEXT, result_json TEXT)');
  return db;
}
function runCapacityTest(expectedCount, seed) {
  const db = makeDb();
  const insert = db.prepare('INSERT INTO user_sync_resolutions VALUES (?,?,?,?,?)');
  seed(insert);
  let applied = false;
  const current = snapshot(4);
  const service = createBatchResolutionService(db, () => current, () => { applied = true; });
  const token = batchToken(7, current);
  assert.throws(() => service.resolve(7, {
    requestId: 'resolution-capacity-test', expectedToken: token, choice: 'local', local: current
  }), (error) => error.status === 507 && error.code === 'RESOLUTION_ARCHIVE_FULL');
  assert.equal(applied, false);
  assert.equal(db.prepare('SELECT count(*) AS n FROM user_sync_resolutions').get().n, expectedCount);
  db.close();
}

runCapacityTest(100, function (insert) {
  for (let i = 0; i < 100; i += 1) insert.run(7, 'seed-' + i, '{}', '{}', '{}');
});

const db = makeDb();
const insert = db.prepare('INSERT INTO user_sync_resolutions VALUES (?,?,?,?,?)');
insert.run(7, 'large-seed', '{}', 'x'.repeat(MAX_BYTES), '{}');
let applied = false;
const current = snapshot(4);
const service = createBatchResolutionService(db, () => current, () => { applied = true; });
assert.throws(() => service.resolve(7, {
  requestId: 'resolution-byte-test', expectedToken: batchToken(7, current), choice: 'local', local: current
}), (error) => error.status === 507 && error.code === 'RESOLUTION_ARCHIVE_FULL');
assert.equal(applied, false);
assert.equal(db.prepare('SELECT count(*) AS n FROM user_sync_resolutions').get().n, 1);
db.close();
console.log('[sync-resolution] capacity guards passed');
