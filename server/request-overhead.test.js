'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Database = require('better-sqlite3');
const source = fs.readFileSync(require.resolve('./index'), 'utf8');
const start = source.indexOf('function shanghaiDay(');
// Include any formatter declared immediately before the function.
const formatter = source.lastIndexOf('const shanghaiDayFormatter', start);
const dateSource = source.slice(formatter >= 0 ? formatter : start, source.indexOf('\nconst { adminOnly', start));
const logStart = source.indexOf('function userIdFromReq(');
const logSource = source.slice(logStart, source.indexOf('\napp.use(', logStart));

function logIdentity() {
  let verifications = 0;
  const context = { auth: { REQUIRE_AUTH: true, verifyToken: token => { verifications++; return token === 'valid' ? { userId: 7 } : null; } } };
  vm.runInNewContext(logSource + '\nthis.identify=userIdFromReq;', context);
  assert.equal(context.identify({ userId: 7, headers: { authorization: 'Bearer valid' } }), '7');
  assert.equal(verifications, 0, 'authenticated requests must not verify JWT again just to log');
  assert.equal(context.identify({ headers: { authorization: 'Bearer valid' } }), '7');
  assert.equal(verifications, 1, 'unhandled routes preserve existing log attribution');
  assert.equal(context.identify({ headers: { authorization: 'Bearer invalid' } }), '?');
  assert.equal(context.identify({ headers: {} }), '-');
  assert.equal(context.identify({ userId: 7, headers: {} }), '-', 'no-token log semantics stay unchanged');
  context.auth.REQUIRE_AUTH = false;
  assert.equal(context.identify({ userId: 1, headers: { authorization: 'Bearer valid' } }), '7', 'open-mode default user does not override token log attribution');
}

function heartbeatWork() {
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE user_activity(user_id INTEGER,day TEXT,first_seen_at INTEGER,last_seen_at INTEGER,page_views INTEGER,
      PRIMARY KEY(user_id,day))`);
    let preparations = 0, formatters = 0, time = Date.parse('2026-10-17T15:59:59Z');
    const prepare = db.prepare.bind(db);
    db.prepare = (...args) => { preparations++; return prepare(...args); };
    class FixtureDate extends Date { static now() { return time; } }
    const context = { db, Date: FixtureDate, Intl: { DateTimeFormat: function (...args) {
      formatters++; return new Intl.DateTimeFormat(...args);
    } } };
    vm.runInNewContext(dateSource + '\nthis.touch=touchUserActivity;', context);
    for (let i = 0; i < 10; i++) context.touch(1);
    time += 2000; context.touch(1); context.touch(2);
    const rows = prepare('SELECT * FROM user_activity ORDER BY user_id,day').all();
    assert.equal(rows.length, 3);
    assert.equal(rows[0].day, '2026-10-17'); assert.equal(rows[0].page_views, 10);
    assert.equal(rows[1].day, '2026-10-18'); assert.equal(rows[1].page_views, 1);
    assert.equal(rows[1].last_seen_at, time); assert.equal(rows[2].user_id, 2);
    assert.equal(preparations, 1, 'all heartbeat writes reuse one SQL statement');
    assert.equal(formatters, 1, 'all Shanghai day calculations reuse one formatter');
  } finally { db.close(); }
}
let failures = 0;
for (const test of [logIdentity, heartbeatWork]) {
  try { test(); console.log('PASS ' + test.name); }
  catch (error) { failures++; console.error('FAIL ' + test.name + ': ' + error.message); }
}
if (failures) process.exitCode = 1;
