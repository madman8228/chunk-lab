'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const http = require('node:http');
const express = require('express');
const Database = require('better-sqlite3');
const { gzipSync, gunzipSync } = require('node:zlib');
const { createRecoveryIngest } = require('./services/recovery-ingest');
const { createOperations } = require('./services/operations');
const { createDataWriters } = require('./services/data-writers');
const { reducePracticeEvents } = require('./services/learning-replay');
const { assertRevisionAccepted, batchHash } = require('./sync-conflict');
const { createSnapshotReader } = require('./services/data-snapshot');
const srs = require('../srs');
const { registerRecoveryRoutes } = require('./routes/recovery');
const validate = require('./validate');

function makeSource(extra) {
  return Buffer.from(JSON.stringify(Object.assign({
    format: 'chunklab.recovery-source',
    version: 1,
    capturedAt: '2026-10-02T00:00:00.000Z',
    localStorage: { 'chunklab.v1': '{"stats":{}}' },
    stores: {
      pendingOperations: [{ requestId: 'old_operation_request_01' }],
      syncMeta: [{ key: 'conditional-batch-v1', pending: { requestId: 'old_batch_request_01' } }],
      syncIntents: []
    }
  }, extra || {})));
}

function envelope(raw, sourceId) {
  return {
    sourceId: sourceId || 'legacy-source-001',
    sourceHash: createHash('sha256').update(raw).digest('hex'),
    codec: 'gzip',
    payload: gzipSync(raw)
  };
}

async function main() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE user_recovery_sources (
      user_id INTEGER NOT NULL,
      source_id TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      codec TEXT NOT NULL CHECK(codec='gzip'),
      payload_blob BLOB NOT NULL,
      manifest_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT(datetime('now')),
      PRIMARY KEY(user_id,source_id),
      UNIQUE(user_id,source_hash)
    );
    CREATE TABLE user_recovery_source_uploads(user_id INTEGER,source_id TEXT,source_hash TEXT,chunk_count INTEGER,uncompressed_bytes INTEGER,PRIMARY KEY(user_id,source_id));
    CREATE TABLE user_recovery_source_chunks(user_id INTEGER,source_id TEXT,chunk_index INTEGER,chunk_hash TEXT,chunk_blob BLOB,PRIMARY KEY(user_id,source_id,chunk_index));
    CREATE TABLE user_batch_receipts(user_id INTEGER,request_id TEXT,seq INTEGER,PRIMARY KEY(user_id,request_id));
    CREATE TABLE user_operation_receipts(user_id INTEGER,request_id TEXT,payload_hash TEXT,result_json TEXT,PRIMARY KEY(user_id,request_id));
    CREATE TABLE user_sync_resolutions(user_id INTEGER,request_id TEXT,request_hash TEXT,backup_json TEXT,result_json TEXT,PRIMARY KEY(user_id,request_id));
    INSERT INTO user_batch_receipts(user_id,request_id,seq) VALUES(1,'old_batch_request_01',17);
    INSERT INTO user_operation_receipts(user_id,request_id,payload_hash,result_json) VALUES(1,'old_operation_request_01','legacy-hash','{"ok":true,"seq":23}');
    CREATE TABLE user_operation_events(user_id INTEGER,event_id TEXT,payload_hash TEXT,operation_id TEXT,result_json TEXT,PRIMARY KEY(user_id,event_id));
    CREATE TABLE user_change_seq(user_id INTEGER PRIMARY KEY,seq INTEGER NOT NULL);
    CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,items_json TEXT,builtin INTEGER,is_public INTEGER DEFAULT 0,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,authoring_json TEXT,PRIMARY KEY(user_id,id));
    CREATE TABLE user_courses(user_id INTEGER,course_id TEXT,data_json TEXT,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_course_progress(user_id INTEGER,course_id TEXT,data_json TEXT,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_kv(user_id INTEGER,k TEXT,v_json TEXT,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,PRIMARY KEY(user_id,k));
    CREATE TABLE user_sentence_stats(user_id INTEGER,sentence_key TEXT,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,sentence_key));
    CREATE TABLE user_events(user_id INTEGER,id TEXT,at INTEGER,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,id));
    CREATE TABLE user_learning_baselines(user_id INTEGER,sentence_key TEXT,baseline_json TEXT,PRIMARY KEY(user_id,sentence_key));
    CREATE TABLE user_learning_generation_baselines(user_id INTEGER,scope_key TEXT,sentence_key TEXT,generation INTEGER,baseline_json TEXT,PRIMARY KEY(user_id,scope_key,sentence_key,generation));
    CREATE TABLE user_learning_events(user_id INTEGER,sentence_key TEXT,event_id TEXT,generation INTEGER,event_json TEXT,received_at INTEGER,PRIMARY KEY(user_id,sentence_key,event_id));
    CREATE TABLE user_learning_generations(user_id INTEGER,scope_key TEXT,generation INTEGER,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,scope_key));
    CREATE TABLE user_learning_resumes(user_id INTEGER,session_id TEXT,deck_id TEXT,course_id TEXT,generation INTEGER,idx INTEGER,content_cursor TEXT,practice_mode TEXT,updated_at INTEGER,seq INTEGER,deleted_at INTEGER,PRIMARY KEY(user_id,session_id));
    CREATE TABLE user_assessment_sessions(user_id INTEGER,session_id TEXT,scope_key TEXT,generation INTEGER,revision INTEGER,status TEXT,data_json TEXT,result_json TEXT,created_at INTEGER,updated_at INTEGER,PRIMARY KEY(user_id,session_id));
    CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,deleted_at TEXT,seq INTEGER,PRIMARY KEY(user_id,kind,item_key));
    CREATE INDEX idx_learning_events_session_order ON user_learning_events(user_id,json_extract(event_json,'$.sessionId'),json_extract(event_json,'$.answerOrder')) WHERE json_extract(event_json,'$.type')='practice';
  `);
  const service = createRecoveryIngest(db);
  const serverSeq = new Map();
  const appliedBaselines = [];
  const allocSeq = userId => db.prepare(`INSERT INTO user_change_seq(user_id,seq) VALUES(?,1)
    ON CONFLICT(user_id) DO UPDATE SET seq=seq+1 RETURNING seq`).get(userId).seq;
  const writers = createDataWriters({ db, assertRevisionAccepted });
  const upsertEntityRow = (userId, kind, key, value, seq) => {
    db.prepare(`INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,deleted_at,seq) VALUES(?,?,?,?,NULL,?)
      ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json,deleted_at=NULL,seq=excluded.seq`)
      .run(userId, kind, key, JSON.stringify(value), seq);
  };
  const deleteEntityRow = (userId, kind, key, seq) => db.prepare(`UPDATE user_entity_rows SET deleted_at=datetime('now'),seq=?
    WHERE user_id=? AND kind=? AND item_key=?`).run(seq, userId, kind, key);
  const upsertSentenceStat = (userId, key, value) => db.prepare(`INSERT INTO user_sentence_stats(user_id,sentence_key,data_json,deleted_at)
    VALUES(?,?,?,NULL) ON CONFLICT(user_id,sentence_key) DO UPDATE SET data_json=excluded.data_json,deleted_at=NULL`)
    .run(userId, key, JSON.stringify(value));
  const upsertEvent = (userId, event) => db.prepare(`INSERT INTO user_events(user_id,id,at,data_json,deleted_at)
    VALUES(?,?,?,?,NULL) ON CONFLICT(user_id,id) DO UPDATE SET at=excluded.at,data_json=excluded.data_json,deleted_at=NULL`)
    .run(userId, event.id, event.at || Date.now(), JSON.stringify(event));
  const upsertKv = (userId, key, value, rev, deleted, seq, baseRev) => writers.upsertKv(userId, key, value, rev, deleted, seq, baseRev);
  const operations = createOperations({ db, allocSeq, readChanges: (_userId, seq) => ({ seq, delta: true }), upsertDeck: writers.upsertDeck, upsertCourse: writers.upsertCourse,
    upsertCourseProgress: writers.upsertCourseProgress, upsertKv, upsertSentenceStat, replaceSentenceStat: upsertSentenceStat,
    deleteSentenceStat: (userId, key) => db.prepare('UPDATE user_sentence_stats SET deleted_at=datetime(\'now\') WHERE user_id=? AND sentence_key=?').run(userId, key),
    upsertEvent, upsertEntityRow, deleteEntityRow, srs, reducePracticeEvents, resolveAssessmentItem: () => null, hash: batchHash });
  const seedLegacyResolution = db.prepare(`INSERT INTO user_sync_resolutions
    (user_id,request_id,request_hash,backup_json,result_json) VALUES(1,?,?,?,?)`);
  for (let i = 0; i < 100; i++) {
    seedLegacyResolution.run(`legacy-resolution-${String(i).padStart(3, '0')}`, 'legacy-hash', '{}', '{}');
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_sync_resolutions WHERE user_id=1').get().n, 100,
    'the legacy conflict archive is already at its per-account row limit');
  const acceptedAtArchiveLimit = operations.execute(1, { protocol: 3, requestId: 'archive-cap-learning-01', type: 'learning.answer',
    payload: { eventId: 'archive-cap-event-01', key: 'cap-test#sentence-1', deckId: 'cap-test', generation: 0, ok: true,
      sessionId: 'archive-cap-session-01', answerOrder: 0, chunkRight: 1, chunkTotal: 1 } });
  assert.equal(acceptedAtArchiveLimit.outcome, 'applied', 'normal protocol-3 learning is independent of the legacy archive quota');
  db.prepare(`INSERT INTO user_sync_resolutions
    (user_id,request_id,request_hash,backup_json,result_json) VALUES(3,'legacy-resolution-byte-cap','legacy-hash',zeroblob(?),'{}')`)
    .run(64 * 1024 * 1024);
  assert.equal(db.prepare(`SELECT SUM(length(CAST(backup_json AS BLOB))) AS bytes
    FROM user_sync_resolutions WHERE user_id=3`).get().bytes, 64 * 1024 * 1024,
  'the separate byte-cap account is seeded at exactly 64 MiB without constructing a large JS string');
  const acceptedAtByteCap = operations.execute(3, { protocol: 3, requestId: 'archive-byte-learning-01', type: 'learning.answer',
    payload: { eventId: 'archive-byte-event-01', key: 'cap-test#sentence-3', deckId: 'cap-test', generation: 0, ok: true,
      sessionId: 'archive-byte-session-01', answerOrder: 0, chunkRight: 1, chunkTotal: 1 } });
  assert.equal(acceptedAtByteCap.outcome, 'applied', 'normal learning is independent of the legacy archive byte quota');
  const currentSeq = userId => {
    const row = db.prepare('SELECT seq FROM user_change_seq WHERE user_id=?').get(userId);
    return row ? Number(row.seq) : 1;
  };
  const snapshots = createSnapshotReader({ db, currentSeq });
  const migrationService = createRecoveryIngest(db, {
    legacyWritesFenced: true,
    validatePutPayload: validate.validatePutPayload,
    currentSeq,
    readCurrentSnapshot: snapshots.buildMemSnapshot,
    isAccountEmpty: userId => (serverSeq.get(userId) || 1) <= 1,
    executeRecoveryOperation: (userId, operation) => operations.execute(userId, operation),
    saveLegacyBaseline: (userId, candidate) => {
      appliedBaselines.push({ userId, candidate });
      const next = (serverSeq.get(userId) || 0) + 1;
      serverSeq.set(userId, next);
      return next;
    }
  });
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  registerRecoveryRoutes({
    app,
    express,
    recovery: migrationService,
    auth: { authenticate: (req, _res, next) => { req.userId = Number(req.get('X-Test-User') || 1); next(); } }
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const raw = makeSource();
    const first = envelope(raw);
    const send = (request, userId) => fetch(`${base}/api/recovery/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.chunklab.recovery+gzip',
        'X-ChunkLab-Recovery-Source': request.sourceId,
        'X-ChunkLab-Recovery-SHA256': request.sourceHash,
        ...(userId ? { 'X-Test-User': String(userId) } : {})
      },
      body: request.payload
    });

    let response = await send(first);
    assert.equal(response.status, 201);
    let body = await response.json();
    assert.equal(body.state, 'archived');
    assert.equal(body.manifest.verified, true);
    assert.equal(body.manifest.state, 'archived-not-merged');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 1,
      'recovery-source ingest succeeds while the separate legacy conflict archive is full');
    const byteCapSource = envelope(raw, 'legacy-byte-cap-source');
    response = await send(byteCapSource, 3);
    assert.equal(response.status, 201, 'recovery-source ingest succeeds when the legacy archive reaches its 64 MiB cap');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=3').get().n, 1);
    assert.deepEqual(body.manifest.legacyReceipts, [
      { requestId: 'old_batch_request_01', receipt: 'found', kind: 'legacy-batch', seq: 17 },
      { requestId: 'old_operation_request_01', receipt: 'found', kind: 'operation', seq: 23 }
    ]);

    response = await send(first);
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.state, 'already-present');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 1);

    const sameContentNewId = envelope(raw, 'legacy-source-alias');
    response = await send(sameContentNewId);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sourceId, first.sourceId);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 1);

    const changedContent = envelope(makeSource({ capturedAt: '2026-10-02T00:01:00.000Z' }));
    changedContent.sourceId = first.sourceId;
    response = await send(changedContent);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'SOURCE_ID_REUSED');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 1);

    const wrongHash = Object.assign({}, envelope(makeSource({ capturedAt: '2026-10-02T00:02:00.000Z' })), { sourceId: 'tampered', sourceHash: '0'.repeat(64) });
    response = await send(wrongHash);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'SOURCE_HASH_MISMATCH');

    const unknownSource = envelope(makeSource({ format: 'other' }), 'invalid-schema');
    response = await send(unknownSource);
    assert.equal(response.status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 1);

    const chunkRaw = makeSource({ capturedAt: '2026-10-02T00:00:30.000Z', filler: 'large-source-chunk'.repeat(300) });
    const chunked = envelope(chunkRaw, 'chunked-source');
    const chunks = [chunked.payload.subarray(0, 9), chunked.payload.subarray(9, 29), chunked.payload.subarray(29)];
    const stage = (index, payload) => fetch(`${base}/api/recovery/ingest/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.chunklab.recovery+gzip',
        'X-ChunkLab-Recovery-Source': chunked.sourceId,
        'X-ChunkLab-Recovery-SHA256': chunked.sourceHash,
        'X-ChunkLab-Recovery-Chunk-Index': String(index),
        'X-ChunkLab-Recovery-Chunk-Count': String(chunks.length),
        'X-ChunkLab-Recovery-Chunk-SHA256': createHash('sha256').update(payload).digest('hex'),
        'X-ChunkLab-Recovery-Uncompressed-Bytes': String(chunkRaw.length)
      }, body: payload
    });
    response = await stage(0, chunks[0]);
    assert.equal(response.status, 201);
    response = await stage(0, chunks[0]);
    assert.equal(response.status, 200, 'identical chunks are safely retryable');
    response = await fetch(`${base}/api/recovery/ingest/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: chunked.sourceId, sourceHash: chunked.sourceHash,
        chunkCount: chunks.length, uncompressedBytes: chunkRaw.length })
    });
    assert.equal(response.status, 409, 'an incomplete manifest cannot archive a truncated source');
    await stage(2, chunks[2]);
    await stage(1, chunks[1]);
    response = await fetch(`${base}/api/recovery/ingest/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: chunked.sourceId, sourceHash: chunked.sourceHash,
        chunkCount: chunks.length, uncompressedBytes: chunkRaw.length })
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).manifest.verified, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_recovery_source_chunks WHERE source_id='chunked-source'").get().n, 0,
      'staging chunks retire only after the full source was verified and archived');

    const failedRaw = makeSource({ capturedAt: '2026-10-02T00:00:45.000Z' });
    const failedUpload = envelope(failedRaw, 'chunk-commit-failure');
    const failedParts = [failedUpload.payload.subarray(0, 12), failedUpload.payload.subarray(12)];
    failedParts.forEach((part, index) => service.stageChunk({ userId: 1, sourceId: failedUpload.sourceId,
      sourceHash: failedUpload.sourceHash, chunkIndex: index, chunkCount: failedParts.length,
      uncompressedBytes: failedRaw.length, chunkHash: createHash('sha256').update(part).digest('hex'), payload: part }));
    db.exec("CREATE TRIGGER fail_chunked_archive BEFORE INSERT ON user_recovery_sources WHEN NEW.source_id='chunk-commit-failure' BEGIN SELECT RAISE(ABORT,'simulated disk failure'); END");
    assert.throws(() => service.complete({ userId: 1, sourceId: failedUpload.sourceId, sourceHash: failedUpload.sourceHash,
      chunkCount: failedParts.length, uncompressedBytes: failedRaw.length }));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_recovery_source_chunks WHERE source_id='chunk-commit-failure'").get().n, 2,
      'a failed final archive transaction keeps all previously received chunks for retry');
    db.exec('DROP TRIGGER fail_chunked_archive');
    assert.equal(service.complete({ userId: 1, sourceId: failedUpload.sourceId, sourceHash: failedUpload.sourceHash,
      chunkCount: failedParts.length, uncompressedBytes: failedRaw.length }).state, 'archived');


    const missingReceiptSource = makeSource({ stores: { pendingOperations: [{ requestId: 'not-yet-known-01' }] } });
    const missingReceipt = service.ingest(Object.assign({ userId: 1 }, envelope(missingReceiptSource), { sourceId: 'receipt-not-found' }));
    assert.equal(missingReceipt.manifest.legacyReceipts[0].receipt, 'unknown', 'a missing legacy receipt is not treated as proof of non-submission');

    const localOwner = JSON.stringify(['http://127.0.0.1:8787', '1']);
    const localScope = JSON.stringify(['http://127.0.0.1:8787', localOwner, 3]);
    const neverSentOperation = { protocol: 3, requestId: 'never-sent-operation-01', type: 'settings.patch',
      payload: { patch: { sound: false } } };
    const neverSentSource = JSON.parse(makeSource({ sourceKind: 'account-local', owner: localOwner,
      stores: { pendingOperations: [{ requestId: neverSentOperation.requestId, operation: neverSentOperation,
        owner: localOwner, base: 'http://127.0.0.1:8787', scope: localScope, attemptEvidenceVersion: 1,
        attemptStartedAt: null, ordinal: 1, attempts: 0, createdAt: 100 }], syncMeta: [], syncIntents: [] } }).toString('utf8'));
    const neverSentEnvelope = envelope(Buffer.from(JSON.stringify(neverSentSource)), 'known-never-sent-operation');
    const neverSentArchive = service.ingest(Object.assign({ userId: 1 }, neverSentEnvelope));
    assert.deepEqual(neverSentArchive.manifest.legacyReceipts, [{ requestId: neverSentOperation.requestId,
      receipt: 'unknown', kind: 'operation', seq: null, replayProof: 'durable-not-started-at-capture',
      replayPolicy: 'same-request-id-and-body-only' }],
    'an account-local operation with exact account/service scope and no send marker records a narrow safe-retry candidate without claiming it is committed or permanently fenced');
    const handoverPage = migrationService.listHandoverOperations({ userId: 1, sourceId: 'known-never-sent-operation' });
    assert.deepEqual(handoverPage.items.map(item => ({ requestId: item.requestId, operation: item.operation })),
      [{ requestId: neverSentOperation.requestId, operation: neverSentOperation }],
    'the authenticated handover read returns the exact archived operation body, not a regenerated action');
    assert.throws(() => migrationService.listHandoverOperations({ userId: 2, sourceId: 'known-never-sent-operation' }),
      error => error.status === 404, 'a different account cannot read archived handover bodies');
    response = await fetch(`${base}/api/recovery/known-never-sent-operation/pending-operations`);
    assert.equal(response.status, 200, 'the recovery handover is reachable through the authenticated HTTP route');
    assert.deepEqual((await response.json()).items.map(item => item.requestId), [neverSentOperation.requestId]);

    const attemptedOperation = Object.assign({}, neverSentSource, { stores: { pendingOperations: [
      Object.assign({}, neverSentSource.stores.pendingOperations[0], { attemptEvidenceVersion: 1, attemptStartedAt: 100 })
    ], syncMeta: [], syncIntents: [] } });
    assert.equal(service.ingest(Object.assign({ userId: 1 }, envelope(Buffer.from(JSON.stringify(attemptedOperation)), 'possibly-in-flight-operation')))
      .manifest.legacyReceipts[0].receipt, 'unknown', 'a durable send marker keeps a missing receipt ambiguous');
    const importedOperation = Object.assign({}, neverSentSource, { sourceKind: 'user-backup-import' });
    assert.equal(service.ingest(Object.assign({ userId: 1 }, envelope(Buffer.from(JSON.stringify(importedOperation)), 'foreign-backup-operation')))
      .manifest.legacyReceipts[0].receipt, 'unknown', 'an imported backup never inherits account-local never-sent proof');
    const wrongScopeOperation = Object.assign({}, neverSentSource, { stores: { pendingOperations: [
      Object.assign({}, neverSentSource.stores.pendingOperations[0], { scope: 'foreign-scope' })
    ], syncMeta: [], syncIntents: [] } });
    assert.equal(service.ingest(Object.assign({ userId: 1 }, envelope(Buffer.from(JSON.stringify(wrongScopeOperation)), 'wrong-scope-operation')))
      .manifest.legacyReceipts[0].receipt, 'unknown', 'a mismatched queue scope is never classified as safe to take over');
    const foreignOwner = JSON.stringify(['http://127.0.0.1:8787', '2']);
    const foreignOwnerSource = Object.assign({}, neverSentSource, { owner: foreignOwner, stores: {
      pendingOperations: [Object.assign({}, neverSentSource.stores.pendingOperations[0], { owner: foreignOwner,
        scope: JSON.stringify(['http://127.0.0.1:8787', foreignOwner, 3]) })], syncMeta: [], syncIntents: [] } });
    assert.equal(service.ingest(Object.assign({ userId: 1 }, envelope(Buffer.from(JSON.stringify(foreignOwnerSource)), 'foreign-owner-operation')))
      .manifest.legacyReceipts[0].receipt, 'unknown', 'source and queue owner must match the authenticated account');

    db.prepare('INSERT INTO user_operation_receipts(user_id,request_id,result_json) VALUES(1,?,?)')
      .run('not-yet-known-01', JSON.stringify({ ok: true, seq: 31 }));
    response = await fetch(`${base}/api/recovery/receipt-not-found/manifest`);
    assert.equal(response.status, 200);
    const refreshedManifest = await response.json();
    assert.deepEqual(refreshedManifest.manifest.legacyReceipts, [
      { requestId: 'not-yet-known-01', receipt: 'found', kind: 'operation', seq: 31 }
    ], 'a later server receipt upgrades unknown to found without replaying the archived operation');
    response = await fetch(`${base}/api/recovery/sources`);
    assert.equal(response.status, 200);
    const recoverySources = await response.json();
    assert.equal(recoverySources.items.some(item => item.sourceId === 'receipt-not-found'), true,
      'authenticated recovery source listing returns archived entries for the active account');
    assert.equal(Object.prototype.hasOwnProperty.call(recoverySources.items.find(item => item.sourceId === 'receipt-not-found'), 'payload'), false,
      'source listing exposes manifest status only and never returns the archived raw data');
    response = await fetch(`${base}/api/recovery/sources?limit=0`);
    assert.equal(response.status, 400, 'invalid page limits are rejected');
    const firstRecoveryPage = await (await fetch(`${base}/api/recovery/sources?limit=1`)).json();
    assert.equal(firstRecoveryPage.items.length, 1);
    assert.equal(typeof firstRecoveryPage.nextCursor, 'string', 'a bounded archive page includes a stable continuation cursor');
    const nextRecoveryPage = await (await fetch(`${base}/api/recovery/sources?limit=1&cursor=${encodeURIComponent(firstRecoveryPage.nextCursor)}`)).json();
    assert.equal(nextRecoveryPage.items.length, 1);
    assert.notEqual(nextRecoveryPage.items[0].sourceId, firstRecoveryPage.items[0].sourceId,
      'keyset pagination does not repeat archive entries');
    const otherAccountSources = await (await fetch(`${base}/api/recovery/sources`, { headers: { 'X-Test-User': '2' } })).json();
    assert.deepEqual(otherAccountSources.items, [], 'recovery source pages are isolated to the authenticated account');
    assert.equal(refreshedManifest.manifest.state, 'archived-not-merged', 'receipt refresh never claims the legacy data was merged');
    db.prepare('DELETE FROM user_operation_receipts WHERE user_id=1 AND request_id=?').run('not-yet-known-01');
    const receiptAfterPrune = service.refreshManifest({ userId: 1, sourceId: 'receipt-not-found' });
    assert.deepEqual(receiptAfterPrune.manifest.legacyReceipts, refreshedManifest.manifest.legacyReceipts,
      'once a receipt proves submission, later receipt cleanup cannot downgrade it to unknown/replayable');
    assert.throws(() => service.refreshManifest({ userId: 2, sourceId: 'receipt-not-found' }),
      error => error.status === 404, 'another account cannot inspect this recovery manifest');

    const handledResolutionId = 'already-handled-resolution-01';
    const handledResolutionSource = makeSource({ syncResolution: { request: { requestId: handledResolutionId } },
      stores: { pendingOperations: [], syncMeta: [], syncIntents: [] } });
    db.prepare(`INSERT INTO user_sync_resolutions(user_id,request_id,request_hash,backup_json,result_json)
      VALUES(1,?,'legacy-hash','{}',?)`).run(handledResolutionId, JSON.stringify({ ok: true, seq: 44 }));
    const handledResolution = service.ingest(Object.assign({ userId: 1 }, envelope(handledResolutionSource), {
      sourceId: 'handled-resolution-receipt'
    }));
    assert.deepEqual(handledResolution.manifest.legacyReceipts, [
      { requestId: handledResolutionId, receipt: 'found', kind: 'legacy-resolution', seq: 44 }
    ], 'the durable legacy conflict-resolution receipt takes precedence over the endpoint fence');
    db.prepare('DELETE FROM user_sync_resolutions WHERE user_id=1 AND request_id=?').run(handledResolutionId);
    assert.deepEqual(service.refreshManifest({ userId: 1, sourceId: 'handled-resolution-receipt' }).manifest.legacyReceipts,
      handledResolution.manifest.legacyReceipts,
      'a pruned conflict-resolution receipt remains authoritative in the immutable recovery manifest');

    const legacyMem = { decks: [{ id: 'legacy-deck', name: 'Legacy deck', items: [] }],
      stats: { totalRounds: 1, totalAnswered: 3, bySentence: { 'legacy-deck#old-item': { times: 3 } }, events: [{ id: 'legacy-event-0001' }] },
      mastered: {}, deletedItems: {}, best: {}, settings: { sound: false } };
    const baselineRaw = Buffer.from(JSON.stringify({ format: 'chunklab.recovery-source', version: 1,
      localStorage: { 'chunklab.v1': JSON.stringify(legacyMem), 'chunklab.courses.v1': '[]',
        'chunklab.course-progress.v1': '{}', 'chunklab.logical-courses.v1': JSON.stringify([
          { id: 'logical-course:legacy-travel', title: 'Legacy travel', coverImage: '',
            catalogKey: 'logical:logical-course:legacy-travel', origin: 'user', contentType: 'story',
            createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }
        ]), chunklab_reinforce: '[{"key":"legacy-deck#old-item","count":2}]', chunklab_revs_v1: '{}' },
      stores: { courses: [{ courseId: 'legacy-course', title: 'Legacy course', nodes: [] }],
        progress: [{ cid: 'legacy-progress', data: { seen: ['node-1'] } }],
        sentenceStats: [{ key: 'legacy-deck#old-item', data: { times: 4 } }],
        events: [{ id: 'legacy-event-0001', kind: 'answer' }, { id: 'legacy-event-0002', kind: 'round' }],
        pendingOperations: [], syncMeta: [], syncIntents: [] } }));
    const baselineEnvelope = envelope(baselineRaw, 'empty-account-baseline');
    migrationService.ingest(Object.assign({ userId: 10 }, baselineEnvelope));
    const baselinePreview = migrationService.previewMigration({ userId: 10, sourceId: 'empty-account-baseline', sourceHash: baselineEnvelope.sourceHash });
    assert.equal(baselinePreview.eligible, true);
    assert.equal(baselinePreview.counts.logicalCourses, 1);
    const migrated = migrationService.applyMigration({ userId: 10, sourceId: 'empty-account-baseline', sourceHash: baselinePreview.sourceHash,
      expectedSeq: baselinePreview.expectedSeq, previewToken: baselinePreview.previewToken });
    assert.equal(migrated.state, 'applied', 'a verified baseline migrates only when the account has no server writes');
    assert.equal(migrated.manifest.state, 'merged');
    assert.equal(migrated.manifest.migration.status, 'applied');
    assert.equal(migrationService.applyMigration({ userId: 10, sourceId: 'empty-account-baseline', sourceHash: baselinePreview.sourceHash,
      expectedSeq: baselinePreview.expectedSeq, previewToken: baselinePreview.previewToken }).state,
    'already-present', 'retrying the exact apply after a lost HTTP response is idempotent');
    assert.equal(appliedBaselines.length, 1);
    assert.equal(appliedBaselines[0].candidate.mem.stats.totalAnswered, 3);
    assert.deepEqual(appliedBaselines[0].candidate.mem.reinforceBook,
      [{ key: 'legacy-deck#old-item', count: 2 }], 'the separate legacy wrong-answer key is restored when mem has no embedded list');
    assert.equal(appliedBaselines[0].candidate.mem.stats.bySentence['legacy-deck#old-item'].times, 4,
      'durable IDB sentence stats take precedence over the localStorage copy');
    assert.deepEqual(appliedBaselines[0].candidate.mem.stats.events.map(event => event.id),
      ['legacy-event-0001', 'legacy-event-0002'], 'event rows merge by stable ID without duplication');
    assert.equal(appliedBaselines[0].candidate.courses[0].courseId, 'legacy-course');
    assert.deepEqual(appliedBaselines[0].candidate.courseProgress['legacy-progress'], { seen: ['node-1'] });
    assert.equal(appliedBaselines[0].candidate.logicalCourses[0].id, 'logical-course:legacy-travel',
      'legacy logical directories are included in the verified account baseline');
    const retryPreview = migrationService.previewMigration({ userId: 10, sourceId: 'empty-account-baseline', sourceHash: baselinePreview.sourceHash });
    assert.equal(migrationService.applyMigration({ userId: 10, sourceId: 'empty-account-baseline', sourceHash: retryPreview.sourceHash,
      expectedSeq: retryPreview.expectedSeq, previewToken: retryPreview.previewToken }).state,
      'already-present', 'retrying a committed baseline migration is idempotent');
    assert.equal(appliedBaselines.length, 1, 'idempotent retry does not write the baseline twice');

    serverSeq.set(13, 2);
    migrationService.ingest(Object.assign({ userId: 13 }, envelope(baselineRaw, 'written-sequence-baseline')));
    const retainedWrittenSequence = migrationService.previewMigration({ userId: 13, sourceId: 'written-sequence-baseline' });
    assert.equal(retainedWrittenSequence.reason, 'server-not-empty',
      'a prior server write remains evidence even if its business rows are no longer present');

    const mergeSource = JSON.parse(baselineRaw.toString('utf8'));
    const mergeMem = JSON.parse(mergeSource.localStorage['chunklab.v1']);
    mergeMem.decks.push({ id: 'new-deck', name: 'New deck', items: [] },
      { id: 'deleted-deck', name: 'Deleted deck', items: [] });
    mergeSource.localStorage['chunklab.v1'] = JSON.stringify(mergeMem);
    const mergeCourses = mergeSource.stores.courses.concat([
      { courseId: 'new-course', title: 'New course', version: 'v1', nodes: [] },
      { courseId: 'new-progress', title: 'Progress course', version: 'v1', nodes: [] },
      { courseId: 'deleted-progress', title: 'Deleted progress course', version: 'v1', nodes: [] }
    ]);
    mergeSource.stores.courses = mergeCourses;
    mergeSource.stores.progress[0].cid = 'legacy-course';
    mergeSource.stores.progress.push({ cid: 'new-progress', data: { seen: ['node-2'], passed: [], completed: false, courseVersion: 'v1' } },
      { cid: 'deleted-progress', data: { seen: ['node-old'], passed: [], completed: false, courseVersion: 'v1' } });
    const mergeLogical = JSON.parse(mergeSource.localStorage['chunklab.logical-courses.v1']);
    mergeLogical.push({ id: 'logical-course:new', title: 'New logical', coverImage: '',
      catalogKey: 'logical:logical-course:new', origin: 'user', contentType: 'story',
      createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' },
    { id: 'logical-course:deleted', title: 'Deleted logical', coverImage: '',
      catalogKey: 'logical:logical-course:deleted', origin: 'user', contentType: 'story',
      createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' });
    mergeSource.localStorage['chunklab.logical-courses.v1'] = JSON.stringify(mergeLogical);
    const mergeOwner = JSON.stringify(['http://127.0.0.1:8787', '11']);
    mergeSource.owner = mergeOwner;
    mergeSource.stores.syncIntents = [
      { scope: mergeOwner, operationId: 'legacy-new-course-intent', entity: 'courses', id: 'new-course',
        value: Object.assign({}, mergeCourses.find(course => course.courseId === 'new-course')),
        frozen: { operationId: 'legacy-old-frozen-course-intent',
          deleted: false,
          payload: { requestId: 'uncommitted-old-course-batch',
            courses: [{ courseId: 'new-course', title: 'Earlier frozen title', version: 'v1', nodes: [] }] },
          value: { courseId: 'new-course', title: 'Earlier frozen title', version: 'v1', nodes: [] } } },
      { scope: mergeOwner, operationId: 'legacy-new-progress-intent', entity: 'courseProgress', id: 'new-progress',
        value: { seen: ['node-2'], passed: [], completed: false, courseVersion: 'v1' } },
      { scope: mergeOwner, operationId: 'legacy-new-deck-intent', entity: 'decks', id: 'new-deck',
        value: { id: 'new-deck', name: 'New deck', items: [] } },
      { scope: mergeOwner, operationId: 'legacy-deleted-course-intent', entity: 'courses', id: 'deleted-progress', deleted: true }
    ];
    const nonEmptySource = envelope(Buffer.from(JSON.stringify(mergeSource)), 'non-empty-account-baseline');
    migrationService.ingest(Object.assign({ userId: 11 }, nonEmptySource));
    serverSeq.set(11, 5);
    const baselineCourse = JSON.parse(baselineRaw.toString('utf8')).stores.courses[0];
    const baselineProgress = JSON.parse(baselineRaw.toString('utf8')).stores.progress[0];
    const baselineLogical = JSON.parse(baselineRaw.toString('utf8')).localStorage['chunklab.logical-courses.v1'];
    const baselineDeck = JSON.parse(JSON.parse(baselineRaw.toString('utf8')).localStorage['chunklab.v1']).decks[0];
    db.prepare('INSERT INTO user_change_seq(user_id,seq) VALUES(11,5)').run();
    db.prepare(`INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public,rev,deleted_at,updated_at,seq)
      VALUES(11,?,?,?,0,0,1,NULL,datetime('now'),5)`).run(baselineDeck.id, 'Cloud-edited deck', JSON.stringify(baselineDeck.items));
    db.prepare(`INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public,rev,deleted_at,updated_at,seq)
      VALUES(11,'deleted-deck','Deleted deck','[]',0,0,3,datetime('now'),datetime('now'),5)`).run();
    db.prepare(`INSERT INTO user_courses(user_id,course_id,data_json,rev,deleted_at,updated_at,seq)
      VALUES(11,?,?,2,NULL,datetime('now'),5)`).run(baselineCourse.courseId, JSON.stringify(Object.assign({}, baselineCourse, { title: 'Cloud-edited title' })));
    db.prepare(`INSERT INTO user_courses(user_id,course_id,data_json,rev,deleted_at,updated_at,seq)
      VALUES(11,'deleted-progress','{}',4,datetime('now'),datetime('now'),5)`).run();
    db.prepare(`INSERT INTO user_course_progress(user_id,course_id,data_json,rev,deleted_at,seq)
      VALUES(11,'legacy-course',?,5,NULL,5)`).run(JSON.stringify({ seen: ['cloud-node'] }));
    db.prepare(`INSERT INTO user_course_progress(user_id,course_id,data_json,rev,deleted_at,seq)
      VALUES(11,'deleted-progress','{}',4,datetime('now'),5)`).run();
    const sourceLogicalCourse = JSON.parse(baselineLogical)[0];
    db.prepare(`INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,deleted_at,seq) VALUES(11,'logicalCourse',?,?,NULL,5)`)
      .run(sourceLogicalCourse.id, JSON.stringify(sourceLogicalCourse));
    db.prepare(`INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,deleted_at,seq)
      VALUES(11,'logicalCourse','logical-course:deleted','{}',datetime('now'),5)`).run();
    const retainedNonEmpty = migrationService.previewMigration({ userId: 11, sourceId: 'non-empty-account-baseline' });
    assert.equal(retainedNonEmpty.eligible, false);
    assert.equal(retainedNonEmpty.reason, 'server-not-empty');
    assert.deepEqual(retainedNonEmpty.merge.counts.decks, { add: 1, 'already-present': 0, retained: 2 });
    assert.deepEqual(retainedNonEmpty.merge.counts.courses, { add: 2, 'already-present': 0, retained: 2 });
    assert.deepEqual(retainedNonEmpty.merge.counts.courseProgress, { add: 1, 'already-present': 0, retained: 2 });
    assert.deepEqual(retainedNonEmpty.merge.counts.logicalCourses, { add: 1, 'already-present': 1, retained: 1 });
    assert.equal(retainedNonEmpty.merge.deferred.learningStatistics, 'aggregate-statistics-not-mergeable');
    assert.equal(appliedBaselines.length, 1, 'existing server history is never overwritten or added to as a guessed baseline');
    const retainedApply = migrationService.applyMigration({ userId: 11, sourceId: 'non-empty-account-baseline',
      sourceHash: retainedNonEmpty.sourceHash, expectedSeq: retainedNonEmpty.expectedSeq,
      previewToken: retainedNonEmpty.previewToken });
    assert.equal(retainedApply.state, 'retained', 'an explicit apply attempt with an ineligible preview does not touch account data');
    assert.equal(retainedApply.manifest.state, 'archived-not-merged', 'retained recovery data remains clearly unmerged');
    assert.equal(retainedApply.manifest.migration.status, 'retained-with-reason');
    assert.equal(retainedApply.manifest.migration.reason, 'server-not-empty');
    assert.equal(appliedBaselines.length, 1, 'recording a retained reason never writes a baseline into a non-empty account');
    const scopedPreview = migrationService.previewMigration({ userId: 11, sourceId: 'non-empty-account-baseline' });
    const selection = { decks: ['new-deck'], courses: ['new-course', 'new-progress'],
      courseProgress: ['new-progress'], logicalCourses: ['logical-course:new'] };
    assert.throws(() => migrationService.applyMigration({ userId: 11, sourceId: 'non-empty-account-baseline',
      sourceHash: scopedPreview.sourceHash, expectedSeq: scopedPreview.expectedSeq,
      previewToken: scopedPreview.previewToken, selection: { courseProgress: ['new-progress'] } }),
    error => error.code === 'RECOVERY_SELECTION_DEPENDENCY',
    'progress for a new course cannot be restored without the exact course content in the same atomic selection');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=11').get().count, 0,
      'a missing content dependency is rejected before any content operation is sent');
    db.exec(`CREATE TRIGGER fail_recovery_course BEFORE INSERT ON user_courses
      WHEN NEW.user_id=11 AND NEW.course_id='new-course' BEGIN SELECT RAISE(ABORT,'simulated operation failure'); END`);
    assert.throws(() => migrationService.applyMigration({ userId: 11, sourceId: 'non-empty-account-baseline',
      sourceHash: scopedPreview.sourceHash, expectedSeq: scopedPreview.expectedSeq,
      previewToken: scopedPreview.previewToken, selection }));
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_decks WHERE user_id=11 AND id=?').get('new-deck').count, 0,
      'a mid-merge failure rolls back earlier selected entities');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=11').get().count, 0,
      'operation receipts roll back with the source migration manifest');
    assert.equal(JSON.parse(db.prepare('SELECT manifest_json FROM user_recovery_sources WHERE user_id=11 AND source_id=?')
      .get('non-empty-account-baseline').manifest_json).migration.status, 'retained-with-reason');
    db.exec('DROP TRIGGER fail_recovery_course');
    const scopedApply = migrationService.applyMigration({ userId: 11, sourceId: 'non-empty-account-baseline',
      sourceHash: scopedPreview.sourceHash, expectedSeq: scopedPreview.expectedSeq,
      previewToken: scopedPreview.previewToken, selection });
    assert.equal(scopedApply.state, 'partially-applied', 'content commits do not imply that deferred learning history was merged');
    assert.equal(scopedApply.manifest.state, 'partially-merged', 'non-conflicting selected content can be recovered without replacing the active account');
    assert.equal(scopedApply.manifest.migration.status, 'partially-applied', 'conflicting source items remain individually retained');
    assert.equal(Object.values(scopedApply.manifest.migration.items).filter(item => item.status === 'applied').length, 5);
    assert.equal(Object.values(scopedApply.manifest.migration.items).filter(item => item.status === 'retained-with-reason').length, 9);
    assert.deepEqual(scopedApply.manifest.migration.sourceIntentMappings, [
      { operationId: 'legacy-deleted-course-intent', entity: 'courses', id: 'deleted-progress',
        status: 'retained-with-reason', proof: 'no-frozen-request', reason: 'server-deletion-evidence' },
      { operationId: 'legacy-new-course-intent', entity: 'courses', id: 'new-course', status: 'applied',
        proof: 'no-frozen-request', requestId: scopedApply.manifest.migration.items['courses/new-course'].requestId },
      { operationId: 'legacy-new-deck-intent', entity: 'decks', id: 'new-deck', status: 'applied',
        proof: 'no-frozen-request', requestId: scopedApply.manifest.migration.items['decks/new-deck'].requestId },
      { operationId: 'legacy-new-progress-intent', entity: 'courseProgress', id: 'new-progress', status: 'applied',
        proof: 'no-frozen-request', requestId: scopedApply.manifest.migration.items['courseProgress/new-progress'].requestId },
      { operationId: 'legacy-old-frozen-course-intent', entity: 'courses', id: 'new-course', status: 'applied',
        proof: 'protocol-3-write-fence', sourceRequestId: 'uncommitted-old-course-batch',
        requestId: scopedApply.manifest.migration.items['courses/new-course'].requestId }
    ], 'selected intents and their proven-uncommitted frozen predecessor map to deterministic operations while tombstones remain retained');
    assert.deepEqual(migrationService.listSources({ userId: 11 }).items.find(item => item.sourceId === 'non-empty-account-baseline').legacyIntentCounts,
      { 'retained-with-reason': 1, applied: 4 }, 'recovery listing reflects committed mappings and safely retained tombstones');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=11').get().count, 5,
      'selected disjoint deck/course/directory content uses narrow idempotent operations');
    assert.equal(db.prepare('SELECT name FROM user_decks WHERE user_id=11 AND id=? AND deleted_at IS NULL').get('new-deck').name, 'New deck');
    assert.equal(JSON.parse(db.prepare('SELECT data_json FROM user_courses WHERE user_id=11 AND course_id=? AND deleted_at IS NULL').get('new-course').data_json).title, 'New course');
    assert.ok(db.prepare(`SELECT 1 FROM user_entity_rows WHERE user_id=11 AND kind='logicalCourse' AND item_key=? AND deleted_at IS NULL`)
      .get('logical-course:new'));
    const restoredProgress = JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=11 AND course_id=? AND deleted_at IS NULL')
      .get('new-progress').data_json);
    assert.deepEqual(restoredProgress.seen, ['node-2']);
    assert.equal(restoredProgress.generation, 0, 'recovered progress is fenced to the live course generation');
    assert.equal(db.prepare('SELECT name FROM user_decks WHERE user_id=11 AND id=? AND deleted_at IS NULL').get('legacy-deck').name,
      'Cloud-edited deck', 'recovery never overwrites same-ID content that changed on the server');
    assert.ok(db.prepare(`SELECT deleted_at FROM user_decks WHERE user_id=11 AND id='deleted-deck'`).get().deleted_at,
      'recovery never resurrects a server tombstone');
    const scopedRetry = migrationService.applyMigration({ userId: 11, sourceId: 'non-empty-account-baseline',
      sourceHash: scopedPreview.sourceHash, expectedSeq: scopedPreview.expectedSeq,
      previewToken: scopedPreview.previewToken, selection });
    assert.equal(scopedRetry.state, 'partially-applied');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=11').get().count, 5,
      'retrying selected recovery does not create duplicate operations');
    assert.throws(() => migrationService.applyMigration({ userId: 11, sourceId: 'non-empty-account-baseline',
      sourceHash: scopedPreview.sourceHash, expectedSeq: scopedPreview.expectedSeq,
      previewToken: scopedPreview.previewToken, selection: { decks: ['new-deck'] } }),
    error => error.code === 'RECOVERY_PREVIEW_STALE', 'the original preview cannot be reused to broaden/change its selection');
    const afterScopedMerge = migrationService.previewMigration({ userId: 11, sourceId: 'non-empty-account-baseline' });
    assert.deepEqual(afterScopedMerge.merge.counts.decks, { add: 0, 'already-present': 1, retained: 2 },
      'a fresh preview recognizes recovered content while preserving conflicting and deleted source entries');
    assert.deepEqual(afterScopedMerge.merge.counts.courseProgress, { add: 0, 'already-present': 1, retained: 2 },
      'a fresh preview recognizes the restored course progress and still retains the cloud conflict and tombstone');

    const unresolvedRaw = Buffer.from(JSON.stringify({ format: 'chunklab.recovery-source', version: 1,
      localStorage: { 'chunklab.v1': JSON.stringify(legacyMem), 'chunklab.courses.v1': '[]', 'chunklab.course-progress.v1': '{}' },
      stores: { pendingOperations: [{ requestId: 'unresolved-operation-0001' }] } }));
    migrationService.ingest(Object.assign({ userId: 12 }, envelope(unresolvedRaw, 'unresolved-account-baseline')));
    const retainedUnresolved = migrationService.previewMigration({ userId: 12, sourceId: 'unresolved-account-baseline' });
    assert.equal(retainedUnresolved.eligible, false);
    assert.equal(retainedUnresolved.reason, 'legacy-receipt-unknown', 'unknown old operations are never replayed or merged into a baseline');
    assert.equal(appliedBaselines.length, 1);

    const selectiveUnknownSource = JSON.parse(baselineRaw.toString('utf8'));
    const selectiveUnknownMem = JSON.parse(selectiveUnknownSource.localStorage['chunklab.v1']);
    selectiveUnknownMem.decks.push({ id: 'unresolved-safe-deck', name: 'Disjoint safe restore', items: [] });
    selectiveUnknownSource.localStorage['chunklab.v1'] = JSON.stringify(selectiveUnknownMem);
    selectiveUnknownSource.stores.pendingOperations = [{ requestId: 'unknown-operation-safe-merge-01' }];
    const selectiveUnknownEnvelope = envelope(Buffer.from(JSON.stringify(selectiveUnknownSource)), 'unresolved-selective-merge');
    migrationService.ingest(Object.assign({ userId: 11 }, selectiveUnknownEnvelope));
    const selectiveUnknownPreview = migrationService.previewMigration({ userId: 11, sourceId: selectiveUnknownEnvelope.sourceId });
    assert.equal(selectiveUnknownPreview.reason, 'legacy-receipt-unknown');
    assert.equal(selectiveUnknownPreview.merge.items.decks.find(item => item.id === 'unresolved-safe-deck').status, 'add');
    const selectiveUnknownApply = migrationService.applyMigration({ userId: 11, sourceId: selectiveUnknownEnvelope.sourceId,
      sourceHash: selectiveUnknownPreview.sourceHash, expectedSeq: selectiveUnknownPreview.expectedSeq,
      previewToken: selectiveUnknownPreview.previewToken, selection: { decks: ['unresolved-safe-deck'] } });
    assert.equal(selectiveUnknownApply.state, 'partially-applied',
      'an unresolved old request does not block explicitly selected, disjoint, conflict-free content');
    assert.equal(db.prepare('SELECT name FROM user_decks WHERE user_id=11 AND id=? AND deleted_at IS NULL')
      .get('unresolved-safe-deck').name, 'Disjoint safe restore');
    assert.deepEqual(selectiveUnknownApply.manifest.legacyReceipts, [
      { requestId: 'unknown-operation-safe-merge-01', receipt: 'unknown', kind: 'operation', seq: null }
    ], 'selective content recovery neither upgrades nor discards the unresolved original operation');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=11 AND request_id=?')
      .get('unknown-operation-safe-merge-01').count, 0, 'the unresolved original operation is never replayed');

    const invalidDirectorySource = makeSource({ localStorage: {
      'chunklab.v1': JSON.stringify(legacyMem), 'chunklab.courses.v1': '[]', 'chunklab.course-progress.v1': '{}',
      'chunklab.logical-courses.v1': JSON.stringify([{ id: 'logical-course:bad', title: 'Bad', coverImage: '',
        catalogKey: 'logical:wrong-id', origin: 'user', contentType: 'story', createdAt: 'now', updatedAt: 'now' }])
    }, stores: { pendingOperations: [], syncMeta: [], syncIntents: [] } });
    migrationService.ingest(Object.assign({ userId: 14 }, envelope(invalidDirectorySource), { sourceId: 'invalid-logical-directory' }));
    const invalidPreview = migrationService.previewMigration({ userId: 14, sourceId: 'invalid-logical-directory' });
    assert.equal(invalidPreview.eligible, false);
    assert.equal(invalidPreview.reason, 'invalid-baseline', 'malformed legacy directories are preserved and never imported');

    migrationService.ingest(Object.assign({ userId: 1 }, envelope(baselineRaw, 'route-baseline-migration')));
    const routeSourceHash = createHash('sha256').update(baselineRaw).digest('hex');
    response = await fetch(`${base}/api/recovery/route-baseline-migration/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceHash: routeSourceHash })
    });
    assert.equal(response.status, 200, 'the account-scoped preview route describes a verified source without writing it');
    const routePreview = await response.json();
    assert.equal(routePreview.eligible, true);
    assert.equal(appliedBaselines.length, 1, 'preview does not alter account data');
    response = await fetch(`${base}/api/recovery/route-baseline-migration/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(routePreview)
    });
    assert.equal(response.status, 201, 'apply requires the exact preview, source hash and server sequence');
    assert.equal((await response.json()).state, 'applied');
    assert.equal(appliedBaselines.length, 2);
    const fencedLegacySource = JSON.parse(baselineRaw.toString('utf8'));
    const migrationOwner = JSON.stringify(['http://127.0.0.1:8787', '16']);
    fencedLegacySource.owner = migrationOwner;
    fencedLegacySource.stores.syncMeta = [{ key: 'conditional-batch-v1', pending: {
      requestId: 'unsubmitted-legacy-batch-01', baseSeq: 0, mem: { decks: [] }
    } }];
    fencedLegacySource.stores.courses[0] = Object.assign({}, fencedLegacySource.stores.courses[0],
      { title: 'Newer local course edit' });
    fencedLegacySource.stores.syncIntents = [
      { scope: migrationOwner, operationId: 'legacy-course-newer-intent', entity: 'courses', id: 'legacy-course',
        value: Object.assign({}, fencedLegacySource.stores.courses[0]),
        frozen: { operationId: 'legacy-course-frozen-intent', deleted: false,
          payload: { requestId: 'unsubmitted-legacy-intent-01',
            courses: [{ courseId: 'legacy-course', title: 'Frozen older course edit' }] },
          value: { courseId: 'legacy-course', title: 'Frozen older course edit' } } },
      { scope: migrationOwner, operationId: 'legacy-course-intent', entity: 'courses', id: 'legacy-course',
        value: Object.assign({}, fencedLegacySource.stores.courses[0]) },
      { scope: migrationOwner, operationId: 'legacy-deck-intent', entity: 'decks', id: 'legacy-deck',
        value: { id: 'legacy-deck', name: 'Legacy deck', items: [] } },
      { scope: migrationOwner, operationId: 'legacy-deck-mismatched-intent', entity: 'decks', id: 'legacy-deck',
        value: { id: 'legacy-deck', name: 'Unverified newer deck', items: [] } },
      { scope: migrationOwner, operationId: 'legacy-deck-frozen-intent', entity: 'decks', id: 'legacy-deck',
        value: { id: 'legacy-deck', name: 'Legacy deck', items: [] },
        frozen: { operationId: 'legacy-deck-frozen-intent', deleted: false,
          payload: { requestId: 'unsubmitted-legacy-deck-intent-01',
            decks: [{ id: 'legacy-deck', name: 'Legacy deck', items: [] }] },
          value: { id: 'legacy-deck', name: 'Legacy deck', items: [] } } },
      { scope: JSON.stringify(['http://127.0.0.1:8787', 'another-account']), operationId: 'foreign-course-intent',
        entity: 'courses', id: 'foreign-course', value: { title: 'Foreign course' } }
    ];
    const fencedEnvelope = envelope(Buffer.from(JSON.stringify(fencedLegacySource)), 'fenced-unsent-batch');
    migrationService.ingest(Object.assign({ userId: 16 }, fencedEnvelope));
    const fencedPreview = migrationService.previewMigration({ userId: 16, sourceId: fencedEnvelope.sourceId });
    assert.equal(fencedPreview.eligible, true,
      'protocol 3 endpoint fencing proves an unreceipted legacy snapshot batch cannot still commit, enabling safe empty-account migration');
    const fencedSourceManifest = migrationService.refreshManifest({ userId: 16, sourceId: fencedEnvelope.sourceId });
    assert.deepEqual(fencedSourceManifest.manifest.legacyReceipts, [
      { requestId: 'unsubmitted-legacy-batch-01', receipt: 'not-committed', kind: 'legacy-batch', seq: null, proof: 'protocol-3-write-fence' },
      { requestId: 'unsubmitted-legacy-deck-intent-01', receipt: 'not-committed', kind: 'legacy-batch', seq: null, proof: 'protocol-3-write-fence' },
      { requestId: 'unsubmitted-legacy-intent-01', receipt: 'not-committed', kind: 'legacy-batch', seq: null, proof: 'protocol-3-write-fence' }
    ], 'frozen intents are receipt-checked and fenced along with legacy batch saves');
    assert.deepEqual(fencedSourceManifest.manifest.legacyIntents, [
      { operationId: 'legacy-course-intent', entity: 'courses', id: 'legacy-course',
        status: 'not-committed', proof: 'no-frozen-request' },
      { operationId: 'legacy-course-newer-intent', entity: 'courses', id: 'legacy-course',
        status: 'not-committed', proof: 'no-frozen-request' },
      { operationId: 'legacy-deck-intent', entity: 'decks', id: 'legacy-deck',
        status: 'not-committed', proof: 'no-frozen-request' }
    ], 'a newer unsent edit is classified separately from its older frozen request; foreign-account data stays untouched');
    assert.equal(fencedPreview.counts.pendingOperations, 6,
      'the preview count includes both safe unsent entity intents and fenced frozen request IDs');
    assert.deepEqual(migrationService.listSources({ userId: 16 }).items.find(item => item.sourceId === fencedEnvelope.sourceId).receiptCounts,
      { 'not-committed': 3 }, 'recovery history exposes safely fenced old requests separately from unresolved operations');
    assert.deepEqual(migrationService.listSources({ userId: 16 }).items.find(item => item.sourceId === fencedEnvelope.sourceId).legacyIntentCounts,
      { 'not-committed': 3 }, 'recovery history exposes separately classified current same-account intents');
    const fencedApplied = migrationService.applyMigration({ userId: 16, sourceId: fencedEnvelope.sourceId,
      sourceHash: fencedPreview.sourceHash, expectedSeq: fencedPreview.expectedSeq, previewToken: fencedPreview.previewToken });
    assert.equal(fencedApplied.state, 'applied', 'only the safely fenced request is folded into the verified legacy baseline');
    assert.deepEqual(fencedApplied.manifest.migration.sourceIntentMappings, [
      { operationId: 'legacy-course-frozen-intent', entity: 'courses', id: 'legacy-course',
        sourceRequestId: 'unsubmitted-legacy-intent-01', requestId: fencedApplied.manifest.migration.requestId,
        status: 'applied', proof: 'protocol-3-write-fence' },
      { operationId: 'legacy-course-intent', entity: 'courses', id: 'legacy-course', status: 'applied',
        proof: 'no-frozen-request', requestId: fencedApplied.manifest.migration.requestId },
      { operationId: 'legacy-course-newer-intent', entity: 'courses', id: 'legacy-course', status: 'applied',
        proof: 'no-frozen-request', requestId: fencedApplied.manifest.migration.requestId },
      { operationId: 'legacy-deck-frozen-intent', entity: 'decks', id: 'legacy-deck', sourceRequestId: 'unsubmitted-legacy-deck-intent-01',
        requestId: fencedApplied.manifest.migration.requestId, status: 'applied', proof: 'protocol-3-write-fence' },
      { operationId: 'legacy-deck-intent', entity: 'decks', id: 'legacy-deck', status: 'applied',
        proof: 'no-frozen-request', requestId: fencedApplied.manifest.migration.requestId }
    ], 'fenced requests and never-frozen intents both map durably to the idempotent baseline request');
    assert.deepEqual(migrationService.listSources({ userId: 16 }).items.find(item => item.sourceId === fencedEnvelope.sourceId).legacyIntentCounts,
      { applied: 5 }, 'recovery history no longer labels old intents pending after their migration is committed');
    const conflictJournalSource = JSON.parse(baselineRaw.toString('utf8'));
    conflictJournalSource.syncResolution = { kind: 'background-conflict-quarantine', version: 1,
      pair: { entity: 'batch', id: 'legacy-batch', batch: true,
        local: { rev: 7, value: { mem: { stats: { totalAnswered: 12 } } } },
        remote: { rev: 8, value: { mem: { stats: { totalAnswered: 14 } } } } },
      request: { requestId: 'unsubmitted-legacy-resolution-01' } };
    const conflictJournalEnvelope = envelope(Buffer.from(JSON.stringify(conflictJournalSource)), 'fenced-resolution-journal');
    migrationService.ingest(Object.assign({ userId: 17 }, conflictJournalEnvelope));
    const conflictJournalPreview = migrationService.previewMigration({ userId: 17, sourceId: conflictJournalEnvelope.sourceId });
    assert.equal(conflictJournalPreview.reason, 'legacy-conflict-journal', 'a user conflict choice is never auto-selected even after its endpoint is fenced');
    const storedConflictSource = JSON.parse(gunzipSync(db.prepare('SELECT payload_blob FROM user_recovery_sources WHERE user_id=17 AND source_id=?')
      .get(conflictJournalEnvelope.sourceId).payload_blob).toString('utf8'));
    assert.deepEqual(storedConflictSource.syncResolution.pair,
      conflictJournalSource.syncResolution.pair, 'the verified recovery archive retains both full legacy conflict snapshots without applying either');
    const quarantinedManifest = migrationService.refreshManifest({ userId: 17, sourceId: conflictJournalEnvelope.sourceId }).manifest;
    assert.equal(quarantinedManifest.legacyReceipts[0].receipt,
      'not-committed', 'the journal request is recognized as fenced without treating its unresolved local/remote choice as resolved');
    assert.deepEqual(quarantinedManifest.syncConflict, {
      kind: 'background-conflict-quarantine', version: 1, entity: 'batch', batch: true,
      capturedAt: null,
      localHash: require('node:crypto').createHash('sha256').update(JSON.stringify(conflictJournalSource.syncResolution.pair.local)).digest('hex'),
      remoteHash: require('node:crypto').createHash('sha256').update(JSON.stringify(conflictJournalSource.syncResolution.pair.remote)).digest('hex')
    }, 'the manifest exposes only safe hashes and conflict type for privileged operational lookup');
    assert.equal(Object.hasOwn(quarantinedManifest.syncConflict, 'pair'), false,
      'the indexable manifest must not duplicate learning snapshots');
    response = await fetch(`${base}/api/recovery/route-baseline-migration/migrate-empty`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(response.status, 428, 'the legacy unpreviewed migration route can no longer write');

    operations.execute(1, { protocol: 3, requestId: 'route_recovery_cloud_seed_01', type: 'deck.put', expectedRev: null,
      payload: { deck: { id: 'route-cloud-deck', name: 'Cloud deck', items: [] } } });
    serverSeq.set(1, 2);
    const routeMergeRaw = Buffer.from(JSON.stringify({ format: 'chunklab.recovery-source', version: 1,
      localStorage: { 'chunklab.v1': JSON.stringify({ decks: [{ id: 'route-new-deck', name: 'Recovered deck', items: [] }],
        stats: { totalRounds: 0, totalAnswered: 0 }, settings: {}, best: {}, mastered: {}, deletedItems: {}, reinforceBook: [] }),
        'chunklab.courses.v1': '[]', 'chunklab.course-progress.v1': '{}',
        'chunklab.logical-courses.v1': '[]', chunklab_reinforce: '[]', chunklab_revs_v1: '{}' },
      stores: { courses: [], progress: [], sentenceStats: [], events: [], pendingOperations: [], syncMeta: [], syncIntents: [] } }));
    const routeMergeEnvelope = envelope(routeMergeRaw, 'route-nonempty-content-merge');
    migrationService.ingest(Object.assign({ userId: 1 }, routeMergeEnvelope));
    response = await fetch(`${base}/api/recovery/route-nonempty-content-merge/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceHash: routeMergeEnvelope.sourceHash })
    });
    assert.equal(response.status, 200);
    const routeMergePreview = await response.json();
    assert.equal(routeMergePreview.reason, 'server-not-empty');
    assert.deepEqual(routeMergePreview.merge.counts.decks, { add: 1, 'already-present': 0, retained: 0 });
    response = await fetch(`${base}/api/recovery/route-nonempty-content-merge/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, routeMergePreview, { selection: {
        decks: Array.from({ length: 501 }, (_, index) => `over-limit-deck-${index}`)
      } }))
    });
    assert.equal(response.status, 400, 'the recovery API rejects a selection above the per-group 500-item cap');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_decks WHERE user_id=1 AND id LIKE ? AND deleted_at IS NULL')
      .get('over-limit-deck-%').count, 0, 'an over-limit restore request cannot write any selected content');
    response = await fetch(`${base}/api/recovery/route-nonempty-content-merge/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, routeMergePreview, { selection: { decks: ['route-new-deck'] } }))
    });
    assert.equal(response.status, 201, 'the authenticated apply route commits a user-selected disjoint item');
    assert.equal((await response.json()).state, 'applied');
    assert.equal(db.prepare('SELECT name FROM user_decks WHERE user_id=1 AND id=? AND deleted_at IS NULL')
      .get('route-new-deck').name, 'Recovered deck');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=1 AND request_id LIKE ?')
      .get('recovery_' + routeMergeEnvelope.sourceHash.slice(0, 24) + '%').count, 1,
    'the public recovery route uses the same durable operation receipt and idempotent request ID');

    migrationService.ingest(Object.assign({ userId: 15 }, envelope(baselineRaw, 'stale-preview-baseline')));
    const stale = migrationService.previewMigration({ userId: 15, sourceId: 'stale-preview-baseline' });
    serverSeq.set(15, 2);
    assert.throws(() => migrationService.applyMigration({ userId: 15, sourceId: stale.sourceId, sourceHash: stale.sourceHash,
      expectedSeq: stale.expectedSeq, previewToken: stale.previewToken }),
    error => error.code === 'RECOVERY_PREVIEW_STALE', 'an account write between preview and apply cancels the restore');

    const otherAccount = Object.assign({ userId: 2 }, envelope(raw, 'account-two-source'));
    const otherResult = service.ingest(otherAccount);
    assert.equal(otherResult.state, 'archived');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=2').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 12);

    db.exec("CREATE TRIGGER fail_recovery_insert BEFORE INSERT ON user_recovery_sources WHEN NEW.source_id='disk-failure' BEGIN SELECT RAISE(ABORT,'simulated disk failure'); END");
    assert.throws(() => service.ingest(Object.assign({ userId: 1 }, envelope(makeSource({ capturedAt: '2026-10-02T00:03:00.000Z' }), 'disk-failure'))));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1 AND source_id='disk-failure'").get().n, 0);

    console.log('recovery-ingest: raw-gzip archive, receipt lookup, idempotent chunk staging/finalization, account isolation, and failed transaction retention passed');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
