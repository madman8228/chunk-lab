'use strict';

/* F-002 regression: an existing-but-unversioned row (user_* .rev IS NULL) must not
 * make the account-level replacement fail with BASE_REV_MISMATCH.
 *
 * Root cause pinned here: services/data-snapshot.js:39 exposes NULL verbatim,
 * services/batch-replacement.js:16 turns a non-integer revision into a `null`
 * baseline, services/data-save.js:95 persists NULL for rev-less payloads, and the
 * guard in sync-conflict.js used to read `null` as "the entity must not exist".
 *
 * Negative self-proof: restoring `sync-conflict.js` line 25 to
 *   baseRev === null ? !current : ...
 * makes every `rev IS NULL` resolve below fail again (500 SYNC_CONFLICT / rows stay
 * NULL), so this file goes red. The contrast assertions (stale versioned base still
 * rejected) keep the guard from being blanket-disabled. */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { assertRevisionAccepted, assertBatchVersion } = require('./sync-conflict');
const { freePort } = require('../e2e/lib/free-port');
const Database = require('better-sqlite3');

/* ---------- unit: the judge itself ---------- */
/* Existing row, rev NULL, value differs -> accepted (was: BASE_REV_MISMATCH). */
for (const entity of ['decks', 'kv', 'courses', 'courseProgress']) {
  assert.doesNotThrow(
    () => assertRevisionAccepted(entity, 'nullrev-1', 1, false, { v: 'local' }, { rev: null, deleted: false, value: { v: 'cloud' } }, null),
    entity + ' existing-but-unversioned row must be accepted'
  );
}
/* Still rejected: existing row with a real revision and a stale baseline. */
assert.throws(
  () => assertRevisionAccepted('decks', 'd', 4, false, { name: 'local' }, { rev: 5, deleted: false, value: { name: 'cloud' } }, 3),
  (e) => e.code === 'SYNC_CONFLICT' && e.conflicts[0].reason === 'BASE_REV_MISMATCH'
);
/* Still rejected: baseRev=null against a VERSIONED row (creation guard intact). */
assert.throws(
  () => assertRevisionAccepted('kv', 'settings', 9, false, { v: 2 }, { rev: 5, deleted: false, value: { v: 1 } }, null),
  (e) => e.code === 'SYNC_CONFLICT' && e.conflicts[0].reason === 'BASE_REV_MISMATCH'
);
/* 409 status is carried so the sync routes stop answering 500. */
for (const [label, fn] of [
  ['BASE_REV_MISMATCH', () => assertRevisionAccepted('decks', 'd', 4, false, { name: 'x' }, { rev: 5, deleted: false, value: { name: 'y' } }, 3)],
  ['incomingRev conflict', () => assertRevisionAccepted('decks', 'd', 4, false, { name: 'x' }, { rev: 7, deleted: false, value: { name: 'y' } }, 7)],
  ['BASE_SEQ_MISMATCH', () => assertBatchVersion(1, 2)],
]) {
  try { fn(); assert.fail(label + ' should throw'); }
  catch (e) { assert.equal(e.code, 'SYNC_CONFLICT', label); assert.equal(e.status, 409, label + ' must carry status 409'); }
}

/* ---------- http: real route wrapper returns 409, not 500 ---------- */
async function assertResolveRouteMaps409() {
  const express = require('express');
  const { registerSyncRoutes } = require('./routes/sync');
  let realError;
  try { assertRevisionAccepted('kv', 'settings', 9, false, { v: 2 }, { rev: 5, deleted: false, value: { v: 1 } }, 3); }
  catch (e) { realError = e; }
  const app = express();
  app.use(express.json());
  registerSyncRoutes({
    app,
    auth: { authenticate: (req, res, next) => { req.userId = 1; next(); } },
    resolutions: { read() {}, resolve() {}, backup() {} },
    batchResolutions: {
      compare() {}, backup() {},
      resolve() { throw realError; } // the exact error the fixed judge produces
    }
  });
  const srv = app.listen(0);
  await new Promise((r) => srv.once('listening', r));
  const port = srv.address().port;
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/api/sync/batch/resolve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    const body = await res.json();
    assert.equal(res.status, 409, 'SYNC_CONFLICT must surface as 409, not 500');
    assert.equal(body.code, 'SYNC_CONFLICT');
  } finally { srv.close(); }
}

/* ---------- http: a reused requestId is a conflict (409), never a 500 ---------- */
/* QA reproduced this on the real server: a requestId first consumed by a successful
 * PUT leaves a user_batch_receipts row; feeding the SAME requestId to
 * /api/sync/batch/resolve carries different content, so saveData rejects the batch
 * with REQUEST_ID_REUSED. Before the status was carried it fell through
 * routes/sync.js -> resolutionResponse -> `e.status || 500` and answered 500. */
async function assertRequestIdReuseMaps409() {
  const requestId = 'reuse-request-0001';
  const before = await request('GET', '/api/sync/batch');
  assert.equal(before.status, 200);
  /* A successful conditional PUT consumes the requestId and leaves a
     user_batch_receipts row bound to that exact payload (validate.js requires
     requestId to travel with baseSeq). */
  const first = await request('PUT', '/api/data', {
    baseSeq: before.json.seq, requestId, mem: { settings: { reuse: 1 } }
  });
  assert.equal(first.status, 200, 'the receipt-seeding PUT must succeed: ' + JSON.stringify(first.json));
  const batch = await request('GET', '/api/sync/batch');
  assert.equal(batch.status, 200);
  const local = {
    mem: {
      decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
      settings: { reuse: 2 },
      stats: { bySentence: {}, events: [] }
    },
    courses: [], courseProgress: {}, revs: {}
  };
  const reused = await request('POST', '/api/sync/batch/resolve', {
    requestId, expectedToken: batch.json.token, choice: 'local', local
  });
  assert.equal(reused.status, 409, 'a reused requestId must surface as 409, not 500: ' + JSON.stringify(reused.json));
  assert.equal(reused.json.code, 'SYNC_CONFLICT');
  /* routes/sync.js resolutionResponse returns { error, code } only, so pin the
     specific conflict by its message (the REQUEST_ID_REUSED text). */
  assert.match(reused.json.error, /\u540c\u4e00\u8bf7\u6c42\u7f16\u53f7/, 'conflict must be the reused-requestId one, got: ' + reused.json.error);
}

/* ---------- http: four groups end to end ---------- */
const PORT = freePort(9650, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-nullrev-'));
let server;

function database() { return new Database(path.join(TMP, 'chunklab.db'), { readonly: true, fileMustExist: true }); }
function readRevs() {
  const db = database();
  try {
    const pick = (sql) => { const row = db.prepare(sql).get(); return row ? row.rev : 'MISSING'; };
    return {
      deck: pick("SELECT rev FROM user_decks WHERE id='nr-deck'"),
      kv: pick("SELECT rev FROM user_kv WHERE k='settings'"),
      course: pick("SELECT rev FROM user_courses WHERE course_id='nr-course'"),
      progress: pick("SELECT rev FROM user_course_progress WHERE course_id='nr-prog'")
    };
  } finally { db.close(); }
}
async function request(method, url, body) {
  const res = await fetch(BASE + url, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null; try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT), CHUNKLAB_DATA_DIR: TMP, NODE_ENV: 'test' },
      stdio: 'ignore'
    });
    let ready = false;
    for (let i = 0; i < 80; i++) { try { ready = (await fetch(BASE + '/api/health')).ok; } catch (_) {} if (ready) break; await new Promise((r) => setTimeout(r, 100)); }
    assert.ok(ready, 'server did not start');

    /* Legacy unconditional write (allowed under NODE_ENV=test) leaves rev = NULL for
     * all four groups — the exact precondition F-002 needs. */
    const seed = await request('PUT', '/api/data', {
      mem: { decks: [{ id: 'nr-deck', name: 'CLOUD', builtin: false, items: [{ sentence: 's', chunks: [] }] }], settings: { cloud: 1 } },
      courses: [{ courseId: 'nr-course', title: 'CLOUD', steps: [] }],
      courseProgress: { 'nr-prog': { step: 9 } }
    });
    assert.equal(seed.status, 200, 'seed write must succeed');
    const seeded = readRevs();
    assert.deepEqual(seeded, { deck: null, kv: null, course: null, progress: null }, 'seed must leave every group unversioned');

    const batch = await request('GET', '/api/sync/batch');
    assert.equal(batch.status, 200);
    const local = {
      mem: {
        decks: [{ id: 'nr-deck', name: 'LOCAL', builtin: false, items: [{ sentence: 's', chunks: [] }] }],
        best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
        settings: { local: 1 },
        stats: { bySentence: {}, events: [] }
      },
      courses: [{ courseId: 'nr-course', title: 'LOCAL', steps: [] }],
      courseProgress: { 'nr-prog': { step: 1 } },
      revs: {}
    };
    const resolved = await request('POST', '/api/sync/batch/resolve', {
      requestId: 'nullrev-batch-01', expectedToken: batch.json.token, choice: 'local', local
    });
    assert.equal(resolved.status, 200, 'account replacement over unversioned rows must succeed: ' + JSON.stringify(resolved.json));
    assert.equal(resolved.json.ok, true);

    const after = readRevs();
    for (const group of ['deck', 'kv', 'course', 'progress']) {
      assert.ok(Number.isSafeInteger(after[group]), group + ' rev must become an integer, got ' + after[group]);
      assert.ok(after[group] >= 1, group + ' rev must advance');
    }

    await assertResolveRouteMaps409();
    await assertRequestIdReuseMaps409();
    console.log('[sync-nullrev] rev=NULL rows accepted for all four groups; SYNC_CONFLICT maps to 409 (incl. REQUEST_ID_REUSED)');
  } finally {
    if (server && server.exitCode === null) { const ended = new Promise((r) => server.once('exit', r)); server.kill(); await ended; }
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
