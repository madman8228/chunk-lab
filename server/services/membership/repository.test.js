'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createMembershipRepository } = require('./repository');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-membership-db-'));
let db;
try {
  db = new Database(path.join(dir, 'isolated.db'));
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT NOT NULL);
    CREATE TABLE user_courses(user_id INTEGER,course_id TEXT,course_json TEXT);
    INSERT INTO users VALUES(1,'fixture');
    INSERT INTO user_courses VALUES(1,'keep-course','{"title":"keep"}');`);
  const repository = createMembershipRepository(db, { now: () => 1234 });
  assert.deepEqual(repository.getSettings(), {
    enabled: true, trialDays: 3, dailyLimitSeconds: 1800, salesUrl: '', revision: 1, updatedAt: 1234
  });
  assert.deepEqual(repository.listPlans().map(plan => [plan.key, plan.termMonths]), [['monthly', 1], ['quarterly', 3], ['yearly', 12]]);
  const saved = repository.saveSettings(1, { enabled: true, trialDays: 5, dailyLimitSeconds: 900, salesUrl: '' }, 7);
  assert.equal(saved.status, 200);
  assert.equal(repository.getSettings().trialDays, 5);
  assert.equal(repository.saveSettings(1, { enabled: true, trialDays: 6, dailyLimitSeconds: 900 }, 7).status, 409);
  assert.equal(db.prepare('SELECT course_json FROM user_courses WHERE course_id=?').get('keep-course').course_json, '{"title":"keep"}');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='user_courses'").get().count, 1);
  console.log('membership repository isolated schema tests passed');
} finally {
  if (db) db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
