'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');
const Database = require('better-sqlite3');
const { createCourseAccessService } = require('./services/membership/course-access-service');
const { initializeUsageSchema, createUsageAnalytics } = require('./services/usage-analytics');

async function compressionAccounting() {
  const sandboxModule = { exports: {} };
  let reads = 0, encodes = 0;
  let brBytes = 100;
  const fakeZlib = { constants: zlib.constants,
    brotliCompress: (_body, _opts, callback) => { encodes++; setImmediate(() => callback(null, Buffer.alloc(brBytes))); },
    gzip: (_body, _opts, callback) => { encodes++; setImmediate(() => callback(null, Buffer.alloc(150))); } };
  // Execute the actual encode/touch implementation with deterministic compressed
  // buffers. No filesystem writes or application database are involved.
  vm.runInNewContext(fs.readFileSync(require.resolve('./compress'), 'utf8') +
    '\nmodule.exports.probe={encode,cache,getBytes:()=>cacheBytes};', {
    module: sandboxModule, Buffer, console,
    require: name => name === 'fs' ? { readFileSync: () => { reads++; return Buffer.alloc(4096); } }
      : name === 'zlib' ? fakeZlib : require(name)
  });
  const p = sandboxModule.exports.probe, stat = { size: 4096, mtimeMs: 1 };
  const actualBytes = () => Array.from(p.cache.values()).reduce((sum, entry) => sum + entry.bytes, 0);
  await p.encode('/synthetic-a', stat, 'br');
  await p.encode('/synthetic-a', stat, 'gzip');
  assert.equal(p.getBytes(), 250, 'adding a second encoding counts only new bytes');
  await Promise.all(Array.from({ length: 8 }, () => p.encode('/synthetic-b', stat, 'br')));
  assert.equal(p.getBytes(), actualBytes(), 'concurrent subscribers do not inflate accounting');
  await Promise.all([p.encode('/synthetic-c', stat, 'br'), p.encode('/synthetic-c', stat, 'gzip')]);
  assert.equal(p.getBytes(), actualBytes(), 'concurrent different encodings retain correct total');
  const previousReads = reads, previousEncodes = encodes;
  await p.encode('/synthetic-a', stat, 'br'); await p.encode('/synthetic-a', stat, 'gzip');
  assert.equal(reads, previousReads); assert.equal(encodes, previousEncodes, 'warm entries need no recompression');
  brBytes = 10 * 1024 * 1024;
  for (const file of ['/synthetic-large-a', '/synthetic-large-b', '/synthetic-large-c']) await p.encode(file, stat, 'br');
  assert.equal(p.getBytes(), actualBytes(), 'eviction removes exactly the evicted bytes');
  assert.ok(p.getBytes() <= 24 * 1024 * 1024, 'multiple entries respect the unchanged 24 MiB budget');
  const afterEviction = encodes;
  await p.encode('/synthetic-large-b', stat, 'br');
  assert.equal(encodes, afterEviction, 'retained entry still avoids recompression after eviction');
}

function catalogReads() {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE course_access_revisions(course_id TEXT,revision INTEGER,access_level TEXT)');
    const courses = Array.from({ length: 66 }, (_, i) => ({ courseId: 'synthetic-' + i, title: 'Fixture ' + i }));
    const prepare = db.prepare.bind(db); let reads = 0;
    db.prepare = sql => {
      const statement = prepare(sql);
      const get = statement.get.bind(statement);
      statement.get = (...args) => { reads++; return get(...args); };
      return statement;
    };
    const service = createCourseAccessService({ db, registry: { publicCourses: () => courses } });
    const first = service.catalog();
    assert.equal(reads, 66, 'one current policy read per course');
    assert.ok(first.every(course => course.accessLevel === 'free' && course.policyRevision === 0));
    db.exec("INSERT INTO course_access_revisions VALUES('synthetic-0',1,'member')");
    reads = 0;
    const changed = service.catalog();
    assert.equal(reads, 66);
    assert.equal(changed[0].accessLevel, 'member'); assert.equal(changed[0].policyRevision, 1);
    assert.equal(first[0].accessLevel, 'free', 'previous response remains independent');
  } finally { db.close(); }
}

function usagePreparation() {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY);INSERT INTO users VALUES(1),(2)');
    initializeUsageSchema(db);
    const prepare = db.prepare.bind(db); let preparations = 0, time = 1000000;
    db.prepare = (...args) => { preparations++; return prepare(...args); };
    const usage = createUsageAnalytics({ db, now: () => time });
    const initialPreparations = preparations;
    assert.equal(initialPreparations, 5, 'exactly five pulse statements are prepared once per service');
    const pulse = (sequence, user = 1) => usage.pulse(user, { sessionId: 'synthetic-session-123', sequence,
      elapsedMs: 10000, kind: 'sentence', resourceId: 'synthetic-course' });
    for (let sequence = 1; sequence <= 10; sequence++) { time += 10000; pulse(sequence); }
    assert.equal(preparations, initialPreparations, 'study pulses reuse SQL prepared at service initialization');
    assert.equal(usage.userTime(1).totalMs, 90000);
    assert.equal(pulse(10).replay, true, 'retries still deduplicate');
    pulse(1, 2); time += 10000; pulse(2, 2);
    assert.equal(usage.userTime(2).totalMs, 10000);
    assert.equal(usage.userTime(1).totalMs, 90000, 'accounts remain isolated');
    const preparedSummary = preparations;
    for (let i = 0; i < 5; i++) usage.userTime(1);
    assert.equal(preparations, preparedSummary, 'warm summaries reuse their three SQL statements');
    time += 10000; pulse(11);
    assert.equal(usage.userTime(1).totalMs, 100000, 'summary executes again and sees newly written time');
  } finally { db.close(); }
}

(async () => {
  let failures = 0;
  for (const test of [compressionAccounting, catalogReads, usagePreparation]) {
    try { await test(); console.log('PASS ' + test.name); }
    catch (error) { failures++; console.error('FAIL ' + test.name + ': ' + error.message); }
  }
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
