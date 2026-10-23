'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('../server/node_modules/better-sqlite3');
const { ensureCourseLibrarySchema } = require('../server/services/course-library-schema');
const { buildManifest, applyManifest } = require('../server/services/course-library-migration');
const { activate, parseArgs } = require('./activate-learning-data-format.cjs');
const { digest } = require('./audit-browser-course-backup.cjs');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-format-activation-'));
const db = new Database(path.join(directory, 'isolated.sqlite'));
try {
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY);
    CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,items_json TEXT,builtin INTEGER,is_public INTEGER,authoring_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,id));
    CREATE TABLE user_courses(user_id INTEGER,course_id TEXT,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_course_progress(user_id INTEGER,course_id TEXT,data_json TEXT,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_learning_resumes(user_id INTEGER,session_id TEXT,course_id TEXT,PRIMARY KEY(user_id,session_id));
    CREATE TABLE user_change_seq(user_id INTEGER PRIMARY KEY,seq INTEGER NOT NULL);
    CREATE TABLE user_learning_data_formats(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,format TEXT NOT NULL CHECK(format='references-v1'),migration_id TEXT NOT NULL,activated_at TEXT NOT NULL DEFAULT(datetime('now')));`);
  ensureCourseLibrarySchema(db);
  db.prepare('INSERT INTO users(id) VALUES(37),(38)').run();
  db.prepare('INSERT INTO user_change_seq(user_id,seq) VALUES(37,9)').run();
  db.prepare('INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public) VALUES(37,?,?,?,?,0)')
    .run('legacy-deck', 'Legacy', JSON.stringify([{ cid: 'item-1', sentence: 'Hello.' }]), 0);
  const manifest = buildManifest(db, { createdAt: '2026-10-21T00:00:00.000Z' });
  applyManifest(db, manifest);

  const owner = JSON.stringify(['http://127.0.0.1:8787', '37']);
  function backupWith(appliedSeq = 9, pendingOperations = []) {
    const partition = { database: 'test-idb', stores: {
      courses: [], progress: [], sentenceStats: [], events: [], syncIntents: [],
      syncMeta: [{ key: 'server-cache-v3', owner, appliedSeq,
        snapshot: { mem: { decks: [{ id: 'legacy-deck', items: [{ cid: 'item-1' }] }] } } }],
      pendingOperations, assessmentDrafts: [], navigationHandoffs: []
    }, local: {} };
    return { format: 'chunklab-browser-partition-backup', version: 1, createdAt: '2026-10-21T00:00:00.000Z',
      uid: '37', owner, database: partition.database, fingerprint: digest(partition), partition };
  }

  const preview = activate(db, manifest, backupWith(), { userId: 37 });
  assert.equal(preview.applied, false);
  assert.equal(preview.confirmedSeq, 9);
  assert.equal(db.prepare('SELECT count(*) count FROM user_learning_data_formats').get().count, 0,
    'preview is strictly read-only');

  assert.throws(() => activate(db, manifest, backupWith(8), { userId: 37 }), /水位不一致/);
  assert.throws(() => activate(db, manifest, backupWith(9, [{ requestId: 'pending-1' }]), { userId: 37 }), /核对未通过/);
  assert.throws(() => activate(db, manifest, backupWith(), { userId: 38 }), /备份账号与指定账号不一致/);

  const applied = activate(db, manifest, backupWith(), { userId: 37, apply: true });
  assert.equal(applied.applied, true);
  assert.equal(db.prepare('SELECT format FROM user_learning_data_formats WHERE user_id=37').get().format, 'references-v1');
  assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=37').get().seq, 9,
    'format activation does not fabricate or advance learning sequence');
  assert.equal(activate(db, manifest, backupWith(), { userId: 37, apply: true }).replay, true,
    'same migration activation is idempotent');
  assert.throws(() => parseArgs(['--db', 'a', '--db', 'b', '--course-manifest', 'm', '--browser-backup', 'b', '--uid', '37']), /参数重复/);
  console.log('learning-data format activation: read-only preview, account/cache/queue gates, seq CAS, explicit apply and idempotency passed');
} finally {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
