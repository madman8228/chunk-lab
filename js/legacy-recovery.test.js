'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const LegacyRecovery = require('./legacy-recovery');

async function main() {
  const saved = new Map();
  const payloadByHash = new Map();
  const counters = { captures: 0, uploads: 0, refreshes: 0 };
  let networkAvailable = false;
  let currentOwner = 'https://study.example|7';
  let unassigned = false;
  const recovery = LegacyRecovery.create({
    owner: () => currentOwner,
    isUnassigned: () => unassigned,
    assertCurrent: () => { if (currentOwner !== 'https://study.example|7') { const e = new Error('changed'); e.code = 'SESSION_CHANGED'; throw e; } },
    capture: async owner => {
      counters.captures++;
      return { capturedAt: '2026-10-02T00:00:00.000Z', localStorage: { state: 'legacy' }, stores: { pendingOperations: [{ requestId: 'old-pending-id' }] }, owner };
    },
    load: async owner => Array.from(saved.values()).find(row => row.owner === owner) || null,
    save: async row => { saved.set(row.sourceId, row); },
    digest: async raw => createHash('sha256').update(Buffer.from(raw)).digest('hex'),
    compress: async raw => gzipSync(Buffer.from(raw)),
    upload: async row => {
      counters.uploads++;
      payloadByHash.set(row.sourceHash, Buffer.from(row.gzip));
      if (!networkAvailable) throw new Error('offline');
      return { ok: true, state: 'archived', sourceId: row.sourceId, sourceHash: row.sourceHash,
        manifest: { state: 'archived-not-merged', sourceHash: row.sourceHash, verified: true,
          legacyReceipts: [{ requestId: 'old-pending-id', receipt: 'unknown', kind: 'unresolved', seq: null }] } };
    },
    refresh: async row => {
      counters.refreshes++;
      return { ok: true, sourceId: row.sourceId, sourceHash: row.sourceHash,
        manifest: { state: 'archived-not-merged', sourceHash: row.sourceHash, verified: true,
          legacyReceipts: [{ requestId: 'old-pending-id', receipt: 'found', kind: 'operation', seq: 4 }] } };
    },
  });

  await assert.rejects(recovery.archive(), /offline/);
  assert.equal(counters.captures, 1);
  assert.equal(saved.size, 1, 'the exact compressed source must be durable locally before upload');
  const firstSaved = Array.from(saved.values())[0];
  assert.equal(firstSaved.sourceId, 'legacy-' + firstSaved.sourceHash);
  assert.ok(payloadByHash.has(firstSaved.sourceHash));

  networkAvailable = true;
  const archived = await recovery.archive();
  assert.equal(archived.state, 'archived');
  assert.equal(counters.captures, 1, 'retry must not recapture a moving source');
  assert.equal(counters.uploads, 2);
  assert.equal(counters.refreshes, 1, 'a newly uploaded source refreshes receipts before startup migration preview');
  assert.equal(saved.get(firstSaved.sourceId).receipt.manifest.state, 'archived-not-merged');
  assert.equal(archived.receipt.manifest.legacyReceipts[0].receipt, 'found',
    'a receipt that appeared after archive ingestion is captured before preview');

  const alreadyArchived = await recovery.archive();
  assert.equal(alreadyArchived.state, 'already-archived');
  assert.equal(counters.uploads, 2, 'confirmed source must not be uploaded again on each boot');
  assert.equal(counters.refreshes, 2, 'an archived source refreshes legacy receipt status on a later startup');
  assert.equal(alreadyArchived.receipt.manifest.legacyReceipts[0].receipt, 'found',
    'the durable local manifest records a newly confirmed legacy receipt');

  const confirmed = LegacyRecovery.create({
    owner: () => currentOwner,
    isUnassigned: async () => true,
    capture: async () => { throw new Error('must not read unassigned data without confirmation'); },
    save: async () => {}, load: async () => null, upload: async () => {},
    digest: async () => '', compress: async () => new Uint8Array()
  });
  assert.equal((await confirmed.archive()).state, 'needs-owner-confirmation');

  const beforeUploads = counters.uploads;
  currentOwner = 'https://other.example|8';
  await assert.rejects(recovery.archive(), error => error.code === 'SESSION_CHANGED');
  assert.equal(counters.uploads, beforeUploads, 'a changed account must never receive the captured source');

  assert.equal(LegacyRecovery.canonical({ z: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"z":1}');
  const redactions = [];
  const privateSource = LegacyRecovery.redactPrivateSettings({ settings: { apiKey: 'secret', sound: true }, nested: [{ settings: { apiKey: 'another-secret' } }] }, 'source', redactions);
  assert.equal(privateSource.settings.apiKey, '');
  assert.equal(privateSource.settings.sound, true);
  assert.equal(privateSource.nested[0].settings.apiKey, '');
  assert.deepEqual(redactions, ['source.settings.apiKey', 'source.nested[0].settings.apiKey']);

  const quarantinedSource = LegacyRecovery.attachConflictPair({
    format: 'chunklab.recovery-source', version: 1, localStorage: { state: 'local' }, stores: {},
    syncResolution: { previous: 'journal' }, redactedPrivateFields: []
  }, { entity: 'batch', batch: true, id: 'request-1',
    local: { rev: 3, value: { mem: { settings: { apiKey: 'private-local' }, stats: { totalAnswered: 4 } } } },
    remote: { rev: 4, value: { mem: { settings: { apiKey: 'private-remote' }, stats: { totalAnswered: 5 } } } }
  }, '2026-10-05T00:00:00.000Z');
  assert.equal(quarantinedSource.syncResolution.kind, 'background-conflict-quarantine');
  assert.deepEqual(quarantinedSource.syncResolution.previousJournal, { previous: 'journal' });
  assert.equal(quarantinedSource.syncResolution.pair.local.value.mem.stats.totalAnswered, 4);
  assert.equal(quarantinedSource.syncResolution.pair.remote.value.mem.stats.totalAnswered, 5);
  assert.equal(quarantinedSource.syncResolution.pair.local.value.mem.settings.apiKey, '');
  assert.equal(quarantinedSource.syncResolution.pair.remote.value.mem.settings.apiKey, '');
  assert.equal(quarantinedSource.redactedPrivateFields.length, 2);
  assert.throws(() => LegacyRecovery.attachConflictPair({ stores: {} }, { entity: 'batch', local: {}, remote: null }), /快照不完整/);

  const chunkRequests = [];
  const uploaded = await LegacyRecovery.uploadSource({ sourceId: 'legacy-chunked', sourceHash: 'a'.repeat(64),
    uncompressedBytes: 25, gzip: new Blob([Buffer.from('0123456789')]) }, async (path, options) => {
    chunkRequests.push({ path, options });
    if (path.endsWith('/chunk')) return { state: 'staged' };
    return { ok: true, state: 'archived', sourceId: 'legacy-chunked', sourceHash: 'a'.repeat(64), manifest: { verified: true } };
  }, async bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex'), 4);
  assert.equal(uploaded.state, 'archived');
  assert.deepEqual(chunkRequests.map(request => request.path), [
    '/api/recovery/ingest/chunk', '/api/recovery/ingest/chunk', '/api/recovery/ingest/chunk', '/api/recovery/ingest/complete'
  ]);
  assert.deepEqual(chunkRequests.slice(0, 3).map(request => request.options.headers['X-ChunkLab-Recovery-Chunk-Index']), ['0', '1', '2']);
  assert.equal(JSON.parse(chunkRequests[3].options.body).chunkCount, 3);

  const importBackup = { __app: 'chunklab', __version: 2, mem: { decks: [{ id: 'saved-deck' }], stats: { totalAnswered: 2 },
    settings: { apiKey: 'do-not-upload' } },
    reinforceBook: [{ key: 'saved-deck#one' }], courses: [{ courseId: 'saved-course' }], courseProgress: { saved: { seen: ['one'] } },
    saveState: { unconfirmedOperations: [{ requestId: 'pending-import-01', operation: { type: 'learning.answer', payload: { key: 'saved-deck#one' } },
      settings: { apiKey: 'pending-secret' } }] } };
  const importedSource = LegacyRecovery.buildImportedBackupSource(importBackup);
  assert.deepEqual(JSON.parse(importedSource.localStorage['chunklab.v1']).decks, [{ id: 'saved-deck' }]);
  assert.deepEqual(JSON.parse(importedSource.localStorage.chunklab_reinforce), [{ key: 'saved-deck#one' }]);
  assert.deepEqual(importedSource.stores.pendingOperations, [{ requestId: 'pending-import-01',
    operation: { type: 'learning.answer', payload: { key: 'saved-deck#one' } }, settings: { apiKey: '' } }],
  'recovery archives preserve the full pending operation instead of retaining only its request id');
  assert.equal(JSON.parse(importedSource.localStorage['chunklab.v1']).settings.apiKey, '');
  assert.ok(importedSource.redactedPrivateFields.includes('backup.mem.settings.apiKey'));
  assert.ok(importedSource.redactedPrivateFields.includes('backup.saveState.unconfirmedOperations[0].settings.apiKey'));
  const importCalls = [];
  let activeImportOwner = 'https://study.example|7';
  const importFlow = LegacyRecovery.createImportRecovery({
    owner: () => activeImportOwner,
    assertCurrent: () => { if (activeImportOwner !== 'https://study.example|7') { const error = new Error('changed'); error.code = 'SESSION_CHANGED'; throw error; } },
    digest: async raw => createHash('sha256').update(Buffer.from(raw)).digest('hex'),
    compress: async raw => gzipSync(Buffer.from(raw)),
    upload: async row => {
      const source = JSON.parse(gunzipSync(Buffer.from(row.gzip)).toString('utf8'));
      importCalls.push({ phase: 'upload', row, source });
      return { ok: true, sourceHash: row.sourceHash, manifest: { verified: true } };
    },
    preview: async (sourceId, sourceHash) => {
      importCalls.push({ phase: 'preview', sourceId, sourceHash });
      return { sourceId, sourceHash, expectedSeq: 0, previewToken: 'a'.repeat(64), eligible: false, reason: 'server-not-empty' };
    },
    apply: async () => { importCalls.push({ phase: 'apply' }); return { state: 'applied' }; }
  });
  const preparedImport = await importFlow.prepare(importBackup);
  assert.equal(preparedImport.preview.eligible, false, 'server preview blocks restore into a non-empty account');
  assert.deepEqual(importCalls.map(call => call.phase), ['upload', 'preview'], 'prepare never applies data');
  await preparedImport.apply();
  assert.equal(importCalls.at(-1).phase, 'apply', 'apply is a separate explicit step after preview');
  activeImportOwner = 'https://other.example|8';
  await assert.rejects(preparedImport.apply(), error => error.code === 'SESSION_CHANGED');
  assert.equal(importCalls.filter(call => call.phase === 'apply').length, 1, 'account change prevents applying a stale preview');

  const fencedRows = new Map();
  let fencedOwner = 'owner-A';
  const fencedRecovery = LegacyRecovery.create({
    owner: () => fencedOwner,
    assertCurrent: () => { if (fencedOwner !== 'owner-A') { const error = new Error('session changed'); error.code = 'SESSION_CHANGED'; throw error; } },
    capture: async () => ({ localStorage: { state: 'keep' }, stores: {} }),
    load: async () => null,
    save: async row => { fencedRows.set(row.sourceId, row); },
    digest: async raw => createHash('sha256').update(Buffer.from(raw)).digest('hex'),
    compress: async raw => gzipSync(Buffer.from(raw)),
    upload: async row => ({ ok: true, state: 'archived', sourceId: row.sourceId, sourceHash: row.sourceHash,
      manifest: { state: 'archived-not-merged', sourceHash: row.sourceHash, verified: true } }),
    refresh: async row => {
      fencedOwner = 'owner-B';
      return { ok: true, sourceId: row.sourceId, sourceHash: row.sourceHash,
        manifest: { state: 'archived-not-merged', sourceHash: row.sourceHash, verified: true, legacyReceipts: [] } };
    }
  });
  await assert.rejects(fencedRecovery.archive(), error => error.code === 'SESSION_CHANGED');
  assert.equal(fencedRows.size, 1, 'account fencing preserves the already uploaded immutable source');
  assert.equal(fencedRows.values().next().value.receipt.ok, true,
    'a late manifest response from the previous account is not applied over its durable archive receipt');

  const handoverOwner = JSON.stringify(['https://study.example/api', '7']);
  const handoverOperation = { protocol: 3, requestId: 'recover-same-request-01', type: 'learning.answer',
    payload: { eventId: 'recover-event-01', key: 'deck#sentence', deckId: 'deck', generation: 0,
      sessionId: 'recover-session-01', answerOrder: 0, chunkRight: 1, chunkTotal: 1, ok: true } };
  const handoverWrites = [];
  const foreignBody = { ...handoverOperation, payload: { ...handoverOperation.payload, ok: false } };
  const handoverSources = [
    { sourceId: 'recovery-source-a', sourceHash: 'a'.repeat(64), verified: true, createdAt: '2026-10-02 00:00:00' },
    { sourceId: 'recovery-source-b', sourceHash: 'b'.repeat(64), verified: true, createdAt: '2026-10-03 00:00:00' }
  ];
  globalThis.location = { origin: 'https://study.example' };
  globalThis.AccountStorage = { owner: handoverOwner, sessionEpoch: 'epoch-1', assertCurrent: () => {} };
  globalThis.ChunkAPI = {
    getBase: () => 'https://study.example/api',
    request: async path => {
      if (path.startsWith('/api/recovery/sources')) return { ok: true, items: handoverSources, nextCursor: null };
      const sourceId = decodeURIComponent(path.split('/')[3].split('?')[0]);
      return { ok: true, sourceId, sourceHash: handoverSources.find(source => source.sourceId === sourceId).sourceHash,
        owner: handoverOwner, sourceCapturedAt: sourceId.endsWith('a') ? '2026-10-02T00:00:00.000Z' : '2026-10-03T00:00:00.000Z',
        items: [{ requestId: handoverOperation.requestId, operation: sourceId.endsWith('a') ? handoverOperation : foreignBody,
          base: 'https://study.example/api', createdAt: 100, ordinal: 1 }] };
    }
  };
  globalThis.IDBStore = { putPendingOperation: async row => { handoverWrites.push(row); return row; } };
  const handoverResult = await LegacyRecovery.handoverPendingOperations();
  assert.deepEqual(handoverResult, { queued: 0, retained: 2, conflicts: 2, queueFailures: 0, scopeSkipped: 0 },
    'two archived rows reusing one request id with different bodies are both held instead of arbitrarily selecting one');
  assert.deepEqual(handoverWrites, [], 'a conflicting archived request id never enters the durable queue');

  globalThis.ChunkAPI.request = async path => {
    if (path.startsWith('/api/recovery/sources')) return { ok: true, items: handoverSources, nextCursor: null };
    const sourceId = decodeURIComponent(path.split('/')[3].split('?')[0]);
    const source = handoverSources.find(item => item.sourceId === sourceId);
    return { ok: true, sourceId, sourceHash: source.sourceHash, owner: handoverOwner,
      sourceCapturedAt: source.createdAt, items: [{ requestId: handoverOperation.requestId, operation: handoverOperation,
        base: 'https://study.example/api', createdAt: 100, ordinal: 1 }] };
  };
  const duplicateSources = await LegacyRecovery.handoverPendingOperations();
  assert.deepEqual(duplicateSources, { queued: 1, retained: 0, conflicts: 0, queueFailures: 0, scopeSkipped: 0 },
    'identical immutable copies are deduplicated into one durable retry and do not look like a blocked handover');
  assert.equal(handoverWrites.length, 1, 'identical archived copies enqueue only once');
  handoverWrites.length = 0;

  globalThis.ChunkAPI.request = async path => {
    if (path.startsWith('/api/recovery/sources')) return { ok: true, items: [handoverSources[0]], nextCursor: null };
    return { ok: true, sourceId: handoverSources[0].sourceId, sourceHash: handoverSources[0].sourceHash,
      owner: handoverOwner, sourceCapturedAt: '2026-10-02T00:00:00.000Z',
      items: [{ requestId: handoverOperation.requestId, operation: handoverOperation,
        base: 'https://study.example/api', createdAt: 100, ordinal: 3 }] };
  };
  const successfulHandover = await LegacyRecovery.handoverPendingOperations();
  assert.deepEqual(successfulHandover, { queued: 1, retained: 0, conflicts: 0, queueFailures: 0, scopeSkipped: 0 });
  assert.equal(handoverWrites[0].requestId, handoverOperation.requestId);
  assert.deepEqual(handoverWrites[0].operation, handoverOperation, 'handover reuses the exact request id and operation body');
  assert.equal(handoverWrites[0].ordinal, undefined, 'IndexedDB allocates a fresh local queue ordinal atomically');
  assert.equal(handoverWrites[0].scope, JSON.stringify(['https://study.example/api', handoverOwner, 3]));
  assert.equal(handoverWrites[0].attemptStartedAt, undefined, 'the imported candidate has not been marked as a network attempt');
  assert.equal(handoverWrites[0].recoverySourceId, 'recovery-source-a', 'the queued retry retains its immutable archive provenance');

  const completeHandoverRequest = globalThis.ChunkAPI.request;
  globalThis.ChunkAPI.request = async path => {
    if (path.startsWith('/api/recovery/sources')) return { ok: true, items: handoverSources, nextCursor: null };
    throw new Error('temporary recovery endpoint failure');
  };
  await assert.rejects(LegacyRecovery.handoverPendingOperations(), /temporary recovery endpoint failure/,
    'an unreadable verified archive source fails handover instead of silently skipping its older operations');

  globalThis.ChunkAPI.request = async path => {
    if (path.startsWith('/api/recovery/sources')) return { ok:true, items:[handoverSources[0]], nextCursor:null };
    return { ok:true, sourceId:handoverSources[0].sourceId, sourceHash:handoverSources[0].sourceHash,
      owner:JSON.stringify(['https://another-study.example/api','local']), items:[], nextCursor:null };
  };
  const isolatedForeignScope = await LegacyRecovery.handoverPendingOperations();
  assert.deepEqual(isolatedForeignScope, { queued:0, retained:0, conflicts:0, queueFailures:0, scopeSkipped:1 },
    'verified sources from another account/service scope are preserved but do not block this account or get replayed');

  globalThis.ChunkAPI.request = async path => {
    if (path.startsWith('/api/recovery/sources')) return { ok:true, items:[handoverSources[0]], nextCursor:null };
    return { ok:true, sourceId:handoverSources[0].sourceId, sourceHash:handoverSources[0].sourceHash,
      owner:handoverOwner, sourceCapturedAt:'2026-10-02T00:00:00.000Z',
      items:[{requestId:handoverOperation.requestId,operation:handoverOperation,
        base:'https://study.example/api',createdAt:100,ordinal:1}] };
  };
  globalThis.IDBStore = { putPendingOperation: async () => { throw new Error('queue quota exceeded'); } };
  const queueFailure = await LegacyRecovery.handoverPendingOperations();
  assert.deepEqual(queueFailure, { queued:0, retained:1, conflicts:0, queueFailures:1, scopeSkipped:0 },
    'a durable queue write failure remains a startup blocker, distinct from an ambiguous item kept in the archive');
  assert.strictEqual(LegacyRecovery.assertHandoverDurable(handoverResult), handoverResult,
    'ambiguous operations stay archived while independent protocol-3 learning is allowed to start');
  assert.strictEqual(LegacyRecovery.assertHandoverDurable(duplicateSources), duplicateSources,
    'identical duplicate archives do not block protocol-3 startup');
  assert.throws(() => LegacyRecovery.assertHandoverDurable(queueFailure), error => error.code === 'PENDING_HANDOVER_INCOMPLETE',
    'a failed durable queue insertion still prevents accepting new learning');
  globalThis.ChunkAPI.request = completeHandoverRequest;

  const originalQueueStore = globalThis.IDBStore;
  globalThis.IDBStore = null;
  await assert.rejects(LegacyRecovery.handoverPendingOperations(), error => error.code === 'PENDING_HANDOVER_UNAVAILABLE',
    'missing durable queue capability is not reported as a successful empty handover');
  globalThis.IDBStore = originalQueueStore;

  console.log('legacy-recovery: durable-before-upload, immutable retry, acknowledged reuse, unassigned ownership gate, and account fencing passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
