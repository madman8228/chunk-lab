'use strict';

const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { registerAdminRoutes } = require('../routes/admin');
const { createAdminOverview } = require('./admin-overview');
const { initializeUsageSchema, createUsageAnalytics, dayOf } = require('./usage-analytics');

// Completely isolated fixture: never load the application's database or env.
const db = new Database(':memory:');
const now = Date.parse('2026-10-16T10:00:00+08:00');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,created_at TEXT);
  INSERT INTO users VALUES
    (1,'__default__','2026-09-01'),(2,'guest_original','2026-09-01'),
    (3,'named_legacy','2026-09-01'),(4,'phone_new','2026-10-16');
  CREATE TABLE user_activity(user_id INTEGER,day TEXT,last_seen_at INTEGER,page_views INTEGER);
  CREATE TABLE user_events(user_id INTEGER,at INTEGER,data_json TEXT,deleted_at TEXT);
  CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,deleted_at TEXT);
`);
initializeUsageSchema(db);
db.prepare('INSERT INTO user_events VALUES(?,?,?,NULL)').run(2, now, JSON.stringify({ kind: 'answer', key: 'preserved#one' }));
db.prepare('INSERT INTO user_study_daily VALUES(?,?,?,?,?)').run(2, dayOf(now), 'sentence', 'preserved', 60000);
db.prepare('INSERT INTO user_entity_rows VALUES(?,?,NULL)').run(2, 'mastered');

const handlers = new Map();
registerAdminRoutes({
  app: { get(path, ...callbacks) { handlers.set(path, callbacks.at(-1)); }, post() {}, patch() {} },
  db, usageAnalytics: createUsageAnalytics({ db, now: () => now })
});
const overviewService = createAdminOverview({ db, admin: {}, shanghaiDay: dayOf, now: () => now });
function snapshot() {
  let list;
  handlers.get('/api/admin/users')({ query: {} }, {
    json(value) { list = value.users; },
    status(code) { throw new Error('Unexpected response ' + code); }
  });
  const accounts = overviewService.adminOverview(7).accounts;
  assert.equal(accounts.registered, list.filter(row => row.type === 'registered').length);
  assert.equal(accounts.guests, list.filter(row => row.type === 'guest').length);
  assert.equal(accounts.total, accounts.registered + accounts.guests);
  return { accounts, list };
}

const beforeSchema = snapshot();
assert.equal(beforeSchema.accounts.registered, 0, 'no identity table means no verified registrations');
assert.equal(beforeSchema.accounts.guests, 3);
assert.equal(beforeSchema.list.find(row => row.id === 1).type, 'default');

db.exec(`CREATE TABLE user_phone_identities(
  phone TEXT PRIMARY KEY,user_id INTEGER NOT NULL UNIQUE,verified_at INTEGER NOT NULL);`);
db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run('13800000004', 4, now);
const beforeBinding = snapshot();
assert.equal(beforeBinding.accounts.registered, 1);
assert.equal(beforeBinding.list.find(row => row.id === 3).type, 'guest', 'custom usernames do not prove verification');

db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run('13800000002', 2, now);
const afterBinding = snapshot();
const bound = afterBinding.list.find(row => row.id === 2);
const previous = beforeBinding.list.find(row => row.id === 2);
assert.equal(bound.type, 'registered', 'verified guest usernames must become formal accounts');
assert.deepEqual({ ...bound, type: previous.type }, previous, 'classification preserves identity, dates, and all learning totals');
assert.equal(bound.answers, 1);
assert.equal(bound.mastered, 1);
assert.equal(bound.studyTime.totalMs, 60000);
assert.equal(afterBinding.accounts.registered, 2);
assert.equal(afterBinding.accounts.guests, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4);
db.close();
console.log('admin account types: list/overview agree before and after phone binding; original learning records preserved');
