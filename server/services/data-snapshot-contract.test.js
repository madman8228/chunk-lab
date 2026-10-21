'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
// Allocate before importing db.js: never use the running application's database.
const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-snapshot-contract-'));
process.env.CHUNKLAB_DATA_DIR = isolatedDir;
const db = require('../db');
const { createSnapshotReader } = require('./data-snapshot');
const window = {};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../js/server-cache.js'), 'utf8'),
  { window, Date, JSON, Object, Array, Number, Set, Error, Promise, URL, Intl });
let seq = 1;
const reader = createSnapshotReader({ db, currentSeq: () => seq });
try {
  db.prepare('INSERT INTO users(id,username,password_hash) VALUES(1,?,?)').run('fixture-one', 'not-a-password');
  db.prepare('INSERT INTO users(id,username,password_hash) VALUES(2,?,?)').run('fixture-two', 'not-a-password');
  const insert = db.prepare('INSERT INTO user_kv(user_id,k,v_json,rev,seq) VALUES(?,?,?,?,?)');
  insert.run(1, 'settings', JSON.stringify({sound:false,dailyGoal:17}), 1, 1);
  insert.run(1, 'best', JSON.stringify({course:{acc:100}}), 1, 1);
  insert.run(2, 'settings', JSON.stringify({sound:true,dailyGoal:99}), 1, 1);
  const merge = window.ServerCache.mergeSnapshot;
  let cache = merge(null, reader.readMemSnapshot(1, null));
  const unchanged = reader.readMemSnapshot(1, 1);
  for (const key of ['settings', 'best']) assert.equal(Object.hasOwn(unchanged.mem, key), false);
  cache = merge(cache, unchanged);
  assert.equal(cache.snapshot.mem.settings.dailyGoal, 17);
  assert.equal(cache.snapshot.mem.best.course.acc, 100);
  seq = 2;
  db.prepare("UPDATE user_kv SET v_json=?,rev=2,seq=2 WHERE user_id=1 AND k='settings'")
    .run(JSON.stringify({sound:false,dailyGoal:17,shuffle:false}));
  const changed = reader.readMemSnapshot(1, 1);
  assert.equal(changed.mem.settings.dailyGoal, 17, 'changed settings send the complete current map');
  assert.equal(Object.hasOwn(changed.mem, 'best'), false);
  cache = merge(cache, changed);
  assert.equal(cache.snapshot.mem.settings.shuffle, false);
  assert.equal(cache.snapshot.mem.best.course.acc, 100);
  assert.equal(reader.readMemSnapshot(2, null).mem.settings.dailyGoal, 99, 'accounts remain isolated');
  seq = 3;
  // Tombstones affect only newly allocated synthetic fixtures, not real records.
  db.prepare("UPDATE user_kv SET deleted_at=datetime('now'),seq=3,rev=3 WHERE user_id=1 AND k='settings'").run();
  const deleted = reader.readMemSnapshot(1, 2);
  assert.deepEqual(deleted.deleted.kv, ['settings']);
  cache = merge(cache, deleted);
  assert.equal(Object.hasOwn(cache.snapshot.mem, 'settings'), false);
  assert.equal(cache.snapshot.mem.best.course.acc, 100, 'deletion does not clear unrelated state');
  assert.deepEqual(reader.readMemSnapshot(1, null).mem.settings, {}, 'full snapshot retains an empty baseline for absent settings');
  // Warm both finite SQL shapes before counting; no actual rows are cached.
  reader.readMemSnapshot(1, null); reader.readMemSnapshot(1, 0);
  const originalPrepare = db.prepare.bind(db), originalTransaction = db.transaction.bind(db);
  let preparations = 0, wrappers = 0;
  db.prepare = (...args) => { preparations++; return originalPrepare(...args); };
  db.transaction = (...args) => { wrappers++; return originalTransaction(...args); };
  for (let i = 0; i < 5; i++) {
    assert.equal(reader.readMemSnapshot(2, null).mem.settings.dailyGoal, 99);
    assert.deepEqual(reader.readMemSnapshot(1, 2).deleted.kv, ['settings']);
  }
  assert.equal(preparations, 0, 'warm full/delta snapshots must reuse compiled SQL');
  assert.equal(wrappers, 0, 'snapshot reads reuse one transaction wrapper while executing a fresh transaction');
  originalPrepare("UPDATE user_kv SET v_json=? WHERE user_id=2 AND k='settings'").run(JSON.stringify({dailyGoal:42}));
  assert.equal(reader.readMemSnapshot(2, null).mem.settings.dailyGoal, 42, 'prepared queries do not cache result rows');
  assert.equal(reader.readMemSnapshot(1, 999).delta, false, 'ahead-of-server cursor still falls back to full');
  let failRead = true;
  const guarded = createSnapshotReader({ db, currentSeq: () => {
    assert.equal(db.inTransaction, true, 'every call retains the SQLite snapshot boundary');
    if (failRead) throw Error('synthetic read failure');
    return seq;
  } });
  assert.throws(() => guarded.readMemSnapshot(1, null), /synthetic read failure/);
  assert.equal(db.inTransaction, false, 'read failure ends its transaction');
  failRead = false;
  assert.equal(guarded.readMemSnapshot(2, null).mem.settings.dailyGoal, 42, 'transaction wrapper remains usable after failure');
  console.log('[snapshot-contract] full/delta/change/tombstone/account isolation preserve confirmed state');
} finally { db.close(); }
