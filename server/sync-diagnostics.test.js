'use strict';

const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { inspect, MAX_ROWS, MAX_BYTES } = require('./sync-diagnostics');

const db = new Database(':memory:');
db.exec('CREATE TABLE user_sync_resolutions (user_id INTEGER, request_id TEXT, backup_json TEXT, created_at TEXT)');
const insert = db.prepare('INSERT INTO user_sync_resolutions (user_id, request_id, backup_json, created_at) VALUES (?,?,?,?)');
const archive = (local, remote) => JSON.stringify({ kind: 'batch', local, remote });
insert.run(7, 'auto-reconcile-a', archive({ id: 1 }, { id: 2 }), '2026-09-20 10:00:00');
insert.run(7, 'manual-b', archive({ id: 1 }, { id: 2 }), '2026-09-20 11:00:00');
insert.run(7, 'manual-c', '{broken', '2026-09-21 11:00:00');
insert.run(8, 'other-user', archive({ id: 9 }, { id: 10 }), '2026-09-21 11:00:00');
let report = inspect(db, 7);
assert.equal(report.archiveRows, 3);
assert.equal(report.counts.autoReconcile, 1);
assert.equal(report.counts.historicalUnknown, 2);
assert.equal(report.counts.malformed, 1);
assert.equal(report.duplicateSnapshotRows, 1);
assert.equal(report.atCapacity, false);
assert.deepEqual(report.dates, { '2026-09-20': 2, '2026-09-21': 1 });

const fill = db.prepare('INSERT INTO user_sync_resolutions VALUES (?,?,?,?)');
for (let i = 0; i < MAX_ROWS - 3; i += 1) fill.run(7, 'fill-' + i, '{}', '2026-09-22 00:00:00');
report = inspect(db, 7);
assert.equal(report.archiveRows, MAX_ROWS);
assert.equal(report.atCapacity, true);
assert.equal(report.remaining.rows, 0);
assert.equal(report.archiveBytes < MAX_BYTES, true);
db.close();
console.log('[sync-diagnostics] passed');
