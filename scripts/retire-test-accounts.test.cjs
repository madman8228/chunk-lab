'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Database = require('../server/node_modules/better-sqlite3');
const { inspect, apply } = require('./retire-test-accounts.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-retire-test-'));
const db = new Database(path.join(dir, 'fixture.db'));
try {
  db.pragma('foreign_keys=ON');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT);
    CREATE TABLE user_change_seq(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,seq INTEGER);
    CREATE TABLE user_kv(user_id INTEGER REFERENCES users(id),k TEXT,v_json TEXT,deleted_at TEXT);
    CREATE TABLE user_courses(user_id INTEGER REFERENCES users(id),course_id TEXT,data_json TEXT);
    CREATE TABLE user_phone_identities(user_id INTEGER REFERENCES users(id),phone TEXT);
    INSERT INTO users VALUES(1,'__default__'),(2,'smoke_empty'),(3,'guest_content'),(37,'phone_current');
    INSERT INTO user_change_seq VALUES(2,0);
    INSERT INTO user_kv VALUES(2,'stats','{"totalRounds":0,"totalAnswered":0,"daysLog":{}}',NULL);
    INSERT INTO user_courses VALUES(3,'valuable-course','{"courseId":"valuable-course","content":"irreplaceable"}');
    INSERT INTO user_phone_identities VALUES(37,'synthetic-phone');`);
  assert.throws(() => inspect(db, [1]), /above 1/);
  assert.throws(() => inspect(db, [3]), /protected data/);
  assert.throws(() => inspect(db, [37]), /not an explicit/);
  const manifest = inspect(db, [2]), backup = path.join(dir, 'consistent.db');
  db.exec('VACUUM INTO ' + "'" + backup.replaceAll("'", "''") + "'");
  const tampered = structuredClone(manifest);
  tampered.accounts[0].related[0].table = 'user_courses';
  assert.throws(() => apply(db, tampered, backup), /changed/);
  db.prepare('UPDATE user_change_seq SET seq=1 WHERE user_id=2').run();
  assert.throws(() => apply(db, manifest, backup), /changed/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4);
  db.prepare('UPDATE user_change_seq SET seq=0 WHERE user_id=2').run();
  assert.deepEqual(apply(db, manifest, backup), { deletedIds: [2], deletedCount: 1, courseContentUnchanged: true });
  assert.equal(JSON.parse(db.prepare('SELECT data_json FROM user_courses').get().data_json).content, 'irreplaceable');
  assert.equal(db.prepare('SELECT username FROM users WHERE id=37').get().username, 'phone_current');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_kv').get().n, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  const restored = new Database(backup, { readonly: true });
  try { assert.equal(restored.pragma('integrity_check', { simple: true }), 'ok'); assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4); }
  finally { restored.close(); }
  assert.throws(() => inspect(db, [3], { discardLearning: true }), /protected data/);
  const raw = db.prepare('SELECT data_json FROM user_courses').get().data_json;
  const digest = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
  fs.writeFileSync(path.join(dir, 'course.json'), raw);
  const archive = path.join(dir, 'archive.json');
  fs.writeFileSync(archive, JSON.stringify({ kind: 'system-course-source-archive', ownership: 'system', courseId: 'valuable-course',
    sources: [{ originalUserId: 3, file: 'course.json', bytes: Buffer.byteLength(raw), sha256: digest(raw) }], assets: [] }));
  const preserved = inspect(db, [3], { discardLearning: true, sourceArchive: archive });
  fs.writeFileSync(path.join(dir, 'course.json'), 'broken');
  assert.throws(() => apply(db, preserved, backup), /integrity failed/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_courses').get().n, 1);
  fs.writeFileSync(path.join(dir, 'course.json'), raw);
  assert.equal(apply(db, preserved, backup).archivedCourseRows, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_courses').get().n, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'), raw);
  console.log('test account retirement: protected data refusal, source guards, backup recovery, transaction and course preservation passed');
} finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
