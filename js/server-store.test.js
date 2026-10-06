'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

async function main() {
  const pending = new Map();
  let failNext = true;
  let failStatus = 0;
  const permanentFailureIds = new Set();
  let retryAfterMs = null;
  let rejectUpgrade = false;
  let rejectAuth = false;
  let holdNetwork = false;
  let releaseNetwork = null;
  let persistenceReady = true;
  let apiBase = '';
  const sent = [];
  const largeSent = [];
  const queueLimits = [];
  let failLargeNext = false;
  let failAttemptMarker = false;
  let responseSeq = 1;
  const listeners = {};
  const timers = new Map();
  let timerId = 0;
  let cloudConfig = { persistenceMode: 'server-authoritative', writeProtocol: 3 };
  const window = {
    crypto: webcrypto,
    location: { origin: 'http://127.0.0.1:8787' },
    addEventListener(type, callback) { listeners[type] = callback; },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    Blob,
    navigator: {},
    document: { hidden: false },
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options && options.detail; },
    dispatchEvent(event) { if (listeners[event.type]) listeners[event.type](event); },
    CL: { getCloudConfig: () => cloudConfig, serverPersistenceReady: () => persistenceReady },
    AccountStorage: {
      owner: 'owner-a',
      assertCurrent() {},
    },
    IDBStore: {
      listPendingOperations: async () => Array.from(pending.values()),
      putPendingOperation: async (row, limits) => { queueLimits.push(limits); pending.set(row.requestId, row); },
      updatePendingOperation: async (id, patch) => {
        if (failAttemptMarker && patch && patch.attemptStartedAt) throw Object.assign(new Error('attempt marker storage failed'), { code: 'IDB_WRITE_FAILED' });
        const current = pending.get(id);
        if (current) {
          const updated = Object.assign({}, current, patch);
          pending.set(id, updated);
          return updated;
        }
        return null;
      },
      removePendingOperation: async (id) => { pending.delete(id); },
      markPendingAcknowledged: async (id, receipt) => {
        const row = pending.get(id);
        if (!row) return { retired: true, row: null };
        row.status = 'acked-awaiting-apply'; row.receipt = receipt;
        return { retired: false, row };
      },
    },
    ChunkAPI: {
      getBase: () => apiBase,
      submitOperation: async (operation) => {
        sent.push(operation);
        if (holdNetwork) await new Promise((resolve) => { releaseNetwork = resolve; });
        if (rejectUpgrade) throw Object.assign(new Error('client update required'), { status: 428, code: 'CLIENT_UPDATE_REQUIRED' });
        if (rejectAuth) throw Object.assign(new Error('NOT_AUTH'), { status: 401, code: 'NOT_AUTH' });
        if (permanentFailureIds.has(operation.requestId)) throw Object.assign(new Error('stale entity revision'), { status: 409, code: 'ENTITY_REVISION_CONFLICT' });
        if (failStatus) throw Object.assign(new Error('rate limited'), { status: failStatus, retryAfterMs });
        if (failNext) { failNext = false; throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }); }
        return { ok: true, requestId: operation.requestId, seq: responseSeq, outcome: 'applied', changes: [] };
      },
      importCourseContent: async (operation) => {
        largeSent.push(operation);
        if (failLargeNext) { failLargeNext = false; throw Object.assign(new Error('offline large import'), { code: 'NETWORK_ERROR' }); }
        return {ok:true,requestId:operation.requestId,seq:1,outcome:'applied',changes:[]};
      },
    },
    ServerCache: {
      refresh: async () => {
        const retired = [];
        for (const [id, row] of pending) {
          if (row.status === 'acked-awaiting-apply' && row.receipt.seq <= 1) {
            retired.push(row); pending.delete(id);
          }
        }
        return { cache: { appliedSeq: responseSeq }, retired };
      },
    },
  };
  const context = vm.createContext({ window, URL, Promise, Object, Array, Number, String, Date, Uint8Array });
  vm.runInContext(fs.readFileSync(require.resolve('./server-store.js'), 'utf8'), context);

  const accepted = await window.ServerStore.submit('learning.answer', { eventId: 'event-1234567890', ok: true });
  assert.equal(accepted.durable, true, 'the answer is accepted after its durable local enqueue');
  assert.equal(pending.size, 1, 'a failed network request remains durable in the queue');
  const requestId = Array.from(pending.keys())[0];
  assert.equal(pending.get(requestId).owner, 'owner-a');
  assert.equal(pending.get(requestId).scope, JSON.stringify(['http://127.0.0.1:8787', 'owner-a', 3]));
  assert.equal(pending.get(requestId).attempts, 0, 'durable enqueue does not wait for or misreport a network attempt');
  assert.equal(pending.get(requestId).status, 'pending');
  assert.equal(pending.get(requestId).attemptEvidenceVersion, 1, 'new queue rows declare the durable send-evidence contract');

  const scheduled = timers.entries().next().value;
  assert.ok(scheduled, 'a background send is scheduled after durable enqueue');
  timers.delete(scheduled[0]);
  scheduled[1].callback();
  for (let turn = 0; turn < 20 && sent.length < 1; turn++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 1, 'the first send is attempted in the background');
  assert.equal(sent[0].requestId, requestId);
  assert.ok(pending.get(requestId).attemptStartedAt, 'first network attempt is durably marked before the request is sent');
  assert.equal(pending.get(requestId).attempts, 1, 'failed attempt remains durable with retry metadata');

  const later = await window.ServerStore.submit('course.progress', { courseId: 'course-a' });
  assert.equal(later.durable, true, 'offline learning can continue while an earlier operation retries');
  assert.equal(pending.size, 2);

  failNext = false;
  const result = await window.ServerStore.retryPending();
  assert.equal(result.length, 2, JSON.stringify({ result, sent: sent.length, state: window.ServerStore.state(), pending: Array.from(pending.values()).map((row) => ({ id: row.requestId, status: row.status, error: row.lastError })) }));
  assert.equal(sent.filter((operation) => operation.requestId === requestId).length, 2,
    'retry preserves the original idempotency key');
  assert.equal(new Set(sent.map((operation) => operation.requestId)).size, 2,
    'different logical operations keep distinct request IDs');
  assert.equal(pending.size, 0, 'the queue is cleared only after server acknowledgement');
  assert.equal(window.ServerStore.state().phase, 'saved');

  const largeCourseCommit = window.ServerStore.submitCommitted('course.put',{course:{courseId:'large',blob:'x'.repeat(300000)}},
    {requestId:'durable_large_course_put',expectedRev:null});
  await window.ServerStore.retryPending();
  await largeCourseCommit;
  assert.equal(pending.size,0,'large course import is retired only after the server cache applies its receipt');
  assert.equal(largeSent.length,1,'oversized course.put is sent through the specialized content-import route');
  assert.equal(sent.length,3,'large content must not be sent through the 256 KiB operations endpoint');
  const largeDeckCommit = window.ServerStore.submitCommitted('deck.put',{deck:{id:'large-deck',name:'Large deck',items:[],blob:'x'.repeat(300000)}},
    {requestId:'durable_large_deck_put',expectedRev:null});
  await window.ServerStore.retryPending();
  await largeDeckCommit;
  assert.equal(pending.size,0,'large deck content is retired only after its confirmed cache delta applies');
  assert.equal(largeSent.length,2,'oversized deck.put also uses the durable specialized content-import route');
  assert.equal(largeSent[1].type,'deck.put');
  assert.equal(sent.length,3,'oversized deck content must not reach the limited normal operation endpoint');

  failLargeNext = true;
  const largeImport = window.ServerStore.submitCommitted('course.put', {
    course: { courseId: 'large-offline-course', blob: 'x'.repeat(20 * 1024 * 1024 + 1) },
  }, { requestId: 'durable_large_offline_course', expectedRev: null });
  await flushUntil(() => pending.has('durable_large_offline_course'));
  const largePending = pending.get('durable_large_offline_course');
  assert.equal(largePending.status, 'pending', 'an oversized import is durably queued before network delivery');
  assert.equal(queueLimits[queueLimits.length - 1].maxBytes, 100 * 1024 * 1024,
    'the explicit large-import queue allowance includes the regular 20 MiB learning budget');
  fireNextTimer();
  await flushUntil(() => largeSent.length === 3);
  assert.equal(pending.has('durable_large_offline_course'), true,
    'a lost large-import response keeps the exact operation in IndexedDB for retry');
  fireNextTimer();
  await flushUntil(() => !pending.has('durable_large_offline_course'));
  const largeImportReceipt = await largeImport;
  assert.equal(largeImportReceipt.requestId, 'durable_large_offline_course',
    'large-import retry reuses the original idempotency key');
  assert.equal(largeSent.length, 4, 'the offline large import is retried through the same content endpoint');

  const newEntityId = 'new_deck_expected_revision_null';
  await window.ServerStore.submit('deck.put', { deck: { id: 'new-deck', name: 'New deck', items: [] } },
    { requestId: newEntityId, expectedRev: null });
  const newEntity = pending.get(newEntityId);
  assert.ok(newEntity && Object.prototype.hasOwnProperty.call(newEntity.operation, 'expectedRev'),
    'the request preserves an explicit absent-entity revision');
  assert.equal(newEntity.operation.expectedRev, null, 'expectedRev null distinguishes creation from an omitted version guard');
  await window.ServerStore.retryPending();
  assert.equal(pending.has(newEntityId), false, 'the guarded create reaches an acknowledged state');

  await window.ServerStore.submit('learning.answer', { eventId: 'event-first-slow-12345', ok: true });
  holdNetwork = true;
  const slowDrain = window.ServerStore.retryPending();
  await flushUntil(() => typeof releaseNetwork === 'function');
  const sentWhileHeld = sent.length;
  const acceptedDuringSlowSend = await Promise.race([
    window.ServerStore.submit('learning.answer', { eventId: 'event-slow-send-12345', ok: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('durable enqueue waited behind network')), 250)),
  ]);
  assert.equal(acceptedDuringSlowSend.durable, true, 'a stalled network send does not block local enqueue');
  assert.equal(sent.length, sentWhileHeld, 'the held request does not prevent the next operation from being queued');
  holdNetwork = false;
  releaseNetwork();
  releaseNetwork = null;
  await slowDrain;
  await window.ServerStore.retryPending();
  assert.equal(pending.size, 0, 'the operation queued during the slow send is later acknowledged');

  persistenceReady = false;
  const sentBeforeStartupGate = sent.length;
  const acceptedBeforeStartupGate = await window.ServerStore.submit('settings.patch', { patch: { sound: true } });
  assert.equal(acceptedBeforeStartupGate.durable, true,
    'a supported protocol can durably queue learning while legacy preservation/cache startup is pending');
  await window.ServerStore.retryPending();
  assert.equal(sent.length, sentBeforeStartupGate, 'startup gate prevents network drain before preservation/cache success');
  assert.equal(pending.has(acceptedBeforeStartupGate.requestId), true, 'startup-gated work remains durable');
  persistenceReady = true;
  await window.ServerStore.retryPending();
  assert.equal(pending.has(acceptedBeforeStartupGate.requestId), false, 'queued work drains after startup gates pass');

  async function assertLateResponseFenced(changeIdentity, restoreIdentity, label) {
    holdNetwork = true;
    const acceptedLate = await window.ServerStore.submit('learning.answer', { eventId: 'late-response-' + label });
    const lateRowId = acceptedLate.requestId;
    const lateDrain = window.ServerStore.retryPending();
    await flushUntil(() => typeof releaseNetwork === 'function');
    changeIdentity();
    holdNetwork = false;
    releaseNetwork();
    releaseNetwork = null;
    await lateDrain;
    const retainedRow = (await window.IDBStore.listPendingOperations()).find((row) => row.requestId === lateRowId);
    assert.ok(retainedRow, label + ': a response from the previous identity cannot retire its queued operation');
    assert.equal(retainedRow.owner, 'owner-a', label + ': the original owner remains attached to the old operation');
    assert.equal((await window.ServerStore.pending()).some((row) => row.requestId === lateRowId), false,
      label + ': the old operation is hidden while a different identity is active');
    restoreIdentity();
    await window.ServerStore.retryPending();
    assert.equal((await window.IDBStore.listPendingOperations()).some((row) => row.requestId === lateRowId), false,
      label + ': restoring the original identity safely retries and retires the same request');
  }

  await assertLateResponseFenced(
    () => { window.AccountStorage.owner = 'owner-b'; },
    () => { window.AccountStorage.owner = 'owner-a'; },
    'account-switch');
  await assertLateResponseFenced(
    () => { apiBase = 'http://127.0.0.1:8787/alternate-api'; },
    () => { apiBase = ''; },
    'api-path-switch');

  pending.set('foreign-id', { requestId: 'foreign-id', owner: 'owner-b', scope: JSON.stringify(['http://127.0.0.1:8787', 'owner-b', 3]), createdAt: 1, operation: {} });
  assert.equal((await window.ServerStore.pending()).length, 0, 'another account operation is never exposed to the active account');

  async function flushUntil(predicate) {
    for (let turn = 0; turn < 50 && !predicate(); turn++) await new Promise((resolve) => setImmediate(resolve));
    assert.ok(predicate(), 'asynchronous queue work reaches the expected state');
  }
  function fireNextTimer() {
    const scheduledTimer = timers.entries().next().value;
    assert.ok(scheduledTimer, 'a retry timer is scheduled');
    timers.delete(scheduledTimer[0]);
    scheduledTimer[1].callback();
  }

  failNext = true;
  const sentBeforeCommit = sent.length;
  let committedReceipt = null;
  const committed = window.ServerStore.submitCommitted('course.progress', { courseId: 'course-committed' })
    .then((receipt) => { committedReceipt = receipt; return receipt; });
  await flushUntil(() => Array.from(pending.values()).some((row) => row.operation.type === 'course.progress' && row.operation.payload.courseId === 'course-committed'));
  const committedRow = Array.from(pending.values()).find((row) => row.operation.payload && row.operation.payload.courseId === 'course-committed');
  assert.ok(committedRow, 'submitCommitted first durably queues its operation');
  assert.equal(committedReceipt, null, 'durable enqueue is not misreported as server confirmation');

  fireNextTimer();
  await flushUntil(() => sent.length > sentBeforeCommit);
  assert.equal(sent[sent.length - 1].requestId, committedRow.requestId);
  assert.equal(committedRow.requestId, Array.from(pending.values()).find((row) => row.operation.payload && row.operation.payload.courseId === 'course-committed').requestId,
    'the retry keeps the queued request identity');
  assert.equal(committedReceipt, null, 'transient failure leaves the confirmation promise pending');
  assert.ok(pending.has(committedRow.requestId), 'transient failure does not remove the durable operation');

  failNext = false;
  fireNextTimer();
  await flushUntil(() => !pending.has(committedRow.requestId));
  const receipt = await committed;
  assert.equal(receipt.requestId, committedRow.requestId, 'the confirmation returns the matching server receipt');
  assert.equal(receipt.outcome, 'applied');
  assert.equal(committedReceipt, receipt);

  const legacyScope = JSON.stringify(['http://127.0.0.1:8787', 'owner-a', 3]);
  const upgradeRow = {
    requestId: 'preserved_protocol3_request',
    operation: { protocol: 3, requestId: 'preserved_protocol3_request', type: 'learning.answer', payload: { eventId: 'event-upgrade-test' } },
    owner: 'owner-a', sessionEpoch: '', base: 'http://127.0.0.1:8787', scope: legacyScope,
    createdAt: Date.now(), attempts: 0, status: 'pending', bytes: 120,
  };
  pending.set(upgradeRow.requestId, upgradeRow);
  const sendsBeforeLegacyMode = sent.length;
  cloudConfig = { persistenceMode: 'legacy', writeProtocol: 2 };
  await window.ServerStore.retryPending();
  assert.equal(sent.length, sendsBeforeLegacyMode, 'protocol 3 work is not sent to a server that has not advertised support');
  assert.equal(pending.get(upgradeRow.requestId).status, 'pending', 'an older server does not permanently block or discard the queued operation');
  assert.equal(window.ServerStore.state().phase, 'paused');
  await assert.rejects(window.ServerStore.submit('learning.answer', { eventId: 'event-not-ready' }), error => error.code === 'PROTOCOL_NOT_READY');

  cloudConfig = { persistenceMode: 'server-authoritative', writeProtocol: 3 };
  window.dispatchEvent(new window.CustomEvent('cloud-config-changed'));
  fireNextTimer();
  await flushUntil(() => !pending.has(upgradeRow.requestId));
  assert.equal(sent[sent.length - 1].requestId, upgradeRow.requestId, 'capability confirmation automatically resumes the original request');

  const staleConfigRow = Object.assign({}, upgradeRow, {
    requestId: 'stale_config_protocol3_request',
    operation: { protocol: 3, requestId: 'stale_config_protocol3_request', type: 'learning.answer', payload: { eventId: 'event-stale-config' } },
    status: 'pending', attempts: 0,
  });
  delete staleConfigRow.receipt;
  pending.set(staleConfigRow.requestId, staleConfigRow);
  rejectUpgrade = true;
  const sendsBefore428 = sent.length;
  await window.ServerStore.retryPending();
  assert.equal(sent.length, sendsBefore428 + 1, 'a stale advertised capability is reported by one request');
  assert.equal(pending.get(staleConfigRow.requestId).status, 'pending', 'HTTP 428 pauses without converting the operation to blocked');
  assert.equal(pending.get(staleConfigRow.requestId).attempts, 0, 'HTTP 428 does not spend retry attempts');
  assert.equal(window.ServerStore.state().error, 'CLIENT_UPDATE_REQUIRED');
  rejectUpgrade = false;
  await window.ServerStore.retryPending();
  assert.equal(pending.has(staleConfigRow.requestId), false, 'the unchanged operation can be retried after the server is upgraded');

  rejectAuth = true;
  const expiredSession = await window.ServerStore.submit('learning.answer', { eventId: 'event-auth-expired-12345' });
  fireNextTimer();
  await flushUntil(() => window.ServerStore.state().phase === 'paused');
  assert.equal(pending.has(expiredSession.requestId), true, 'an expired login keeps the original durable operation');
  assert.equal(window.ServerStore.state().error, 'NOT_AUTH', 'an expired login is exposed as an authentication pause');
  assert.equal(timers.size, 0, 'authentication failure does not schedule a blind retry loop');
  rejectAuth = false;
  const sendsBeforeReauthentication = sent.length;
  window.dispatchEvent(new window.CustomEvent('cloud-config-changed'));
  fireNextTimer();
  await flushUntil(() => !pending.has(expiredSession.requestId));
  assert.equal(sent.length, sendsBeforeReauthentication + 1,
    'the successful reauthentication/configuration event automatically resumes the queue');
  assert.equal(sent[sent.length - 1].requestId, expiredSession.requestId,
    'automatic authentication recovery reuses the durable request id');
  assert.equal(pending.has(expiredSession.requestId), false, 'after reauthentication, the same queued request can be confirmed');

  const sharedRequestId = 'committed_shared_request_0001';
  const firstWaiter = window.ServerStore.submitCommitted('course.progress', { courseId: 'shared-commit' }, { requestId: sharedRequestId });
  const secondWaiter = window.ServerStore.submitCommitted('course.progress', { courseId: 'shared-commit' }, { requestId: sharedRequestId });
  await flushUntil(() => timers.size > 0);
  fireNextTimer();
  const sharedReceipts = await Promise.all([firstWaiter, secondWaiter]);
  assert.equal(sharedReceipts[0].requestId, sharedRequestId);
  assert.equal(sharedReceipts[1].requestId, sharedRequestId, 'same-id committed callers both receive the receipt');
  failStatus = 429;
  retryAfterMs = 7000;
  const rateLimited = await window.ServerStore.submit('learning.answer', { eventId: 'event-rate-limit-12345' });
  fireNextTimer();
  await flushUntil(() => {
    const row = pending.get(rateLimited.requestId);
    return row && row.attempts === 1 && Array.from(timers.values()).some((timer) => timer.delay === 7000);
  });
  assert.equal(Array.from(timers.values()).some((timer) => timer.delay === 7000), true,
    'HTTP 429 honors the server-provided Retry-After delay rather than using local backoff');
  failStatus = 0;
  retryAfterMs = null;
  const newOperationDuringBackoff = await window.ServerStore.submit('learning.answer', { eventId: 'event-new-work-during-backoff' });
  assert.equal(Array.from(timers.values()).some((timer) => timer.delay === 0), true,
    'a new user action schedules an immediate queue drain instead of waiting behind an earlier Retry-After timer');
  fireNextTimer();
  await flushUntil(() => !pending.has(rateLimited.requestId) && !pending.has(newOperationDuringBackoff.requestId));

  const conflictScope = JSON.stringify(['http://127.0.0.1:8787', 'owner-a', 3]);
  pending.set('blocked-content-conflict', { requestId: 'blocked-content-conflict', scope: conflictScope,
    status: 'blocked', lastError: 'ENTITY_CHANGED', operation: { type: 'deck.put', payload: { deck: { id: 'conflict-deck' } } } });
  assert.equal(await window.ServerStore.discardBlockedContentConflict('blocked-content-conflict'), true,
    'a content conflict may be retired after its durable draft has been recovered');
  assert.equal(pending.has('blocked-content-conflict'), false);
  pending.set('blocked-other-error', { requestId: 'blocked-other-error', scope: conflictScope,
    status: 'blocked', lastError: 'INVALID_OPERATION', operation: { type: 'deck.put', payload: { deck: { id: 'invalid-deck' } } } });
  assert.equal(await window.ServerStore.discardBlockedContentConflict('blocked-other-error'), false,
    'the recovery action cannot discard unrelated permanent failures');
  assert.equal(pending.has('blocked-other-error'), true, 'unrelated blocked operations remain durable');
  pending.delete('blocked-other-error');

  const beforeMarkerFailure = sent.length;
  const markerGuard = await window.ServerStore.submit('learning.answer', { eventId: 'event-marker-write-guard' });
  failAttemptMarker = true;
  await window.ServerStore.retryPending();
  assert.equal(pending.get(markerGuard.requestId).attempts, 1, 'the failed marker write leaves a retryable queue record');
  assert.equal(sent.length, beforeMarkerFailure, 'a failed durable send marker prevents any network request');
  assert.equal(pending.get(markerGuard.requestId).attemptStartedAt, undefined,
    'the row remains provably unsubmitted when its first-attempt marker cannot be committed');
  failAttemptMarker = false;
  await window.ServerStore.retryPending();
  assert.equal(pending.has(markerGuard.requestId), false, 'after the marker store recovers, the original request can be sent and retired');

  const originalCacheRefresh = window.ServerCache.refresh;
  let cacheRefreshCalls = 0;
  responseSeq = 77;
  window.ServerCache.refresh = async () => {
    cacheRefreshCalls++;
    if (cacheRefreshCalls === 1) return { cache: { appliedSeq: 76 }, retired: [] };
    const retired = [];
    for (const [id, row] of pending) {
      if (row.status === 'acked-awaiting-apply' && row.receipt.seq <= responseSeq) {
        retired.push(row); pending.delete(id);
      }
    }
    return { cache: { appliedSeq: responseSeq }, retired };
  };
  const coalescedRefreshId = 'receipt_waits_for_cache_watermark';
  const coalescedRefreshCommit = window.ServerStore.submitCommitted('learning.resume',
    { sessionId: 'resume-after-coalesced-refresh' }, { requestId: coalescedRefreshId });
  await flushUntil(() => pending.has(coalescedRefreshId));
  fireNextTimer();
  await flushUntil(() => !pending.has(coalescedRefreshId));
  const coalescedRefreshReceipt = await coalescedRefreshCommit;
  assert.ok(cacheRefreshCalls >= 2, 'a shared refresh behind the receipt watermark is followed by a covering refresh');
  assert.equal(coalescedRefreshReceipt.seq, responseSeq);
  window.ServerCache.refresh = originalCacheRefresh;
  responseSeq = 1;

  function queueRow(requestId, type, payload, ordinal) {
    const operation = { protocol: 3, requestId, type, payload };
    return { requestId, operation, owner: 'owner-a', sessionEpoch: '', base: 'http://127.0.0.1:8787',
      scope: legacyScope, createdAt: Date.now() + ordinal, ordinal, attempts: 0, status: 'pending',
      attemptEvidenceVersion: 1, bytes: JSON.stringify(operation).length };
  }
  const blockedCourseId = 'blocked_course_put_0001';
  const dependentProgressId = 'blocked_course_progress_01';
  const independentProgressId = 'independent_course_progress_1';
  pending.set(blockedCourseId, queueRow(blockedCourseId, 'course.put', { course: { courseId: 'course-blocked' } }, 1001));
  pending.set(dependentProgressId, queueRow(dependentProgressId, 'course.progress', { courseId: 'course-blocked' }, 1002));
  pending.set(independentProgressId, queueRow(independentProgressId, 'course.progress', { courseId: 'course-independent' }, 1003));
  permanentFailureIds.add(blockedCourseId);
  const beforeTargetIsolation = sent.length;
  await window.ServerStore.retryPending();
  assert.equal(pending.get(blockedCourseId).status, 'blocked', 'a permanent entity failure is retained as a recovery item');
  assert.equal(pending.has(dependentProgressId), true, 'a later write to the same course cannot overtake its blocked content update');
  assert.equal(pending.has(independentProgressId), false, 'a blocked course does not prevent unrelated course progress from syncing');
  assert.deepEqual(sent.slice(beforeTargetIsolation).map(operation => operation.requestId), [blockedCourseId, independentProgressId]);
  assert.equal(window.ServerStore.state().pending, 1, 'dependent work remains pending and is not reported as saved');
  assert.equal(window.ServerStore.state().blocked, 1, 'only the permanently rejected request is counted as blocked');

  console.log('server-store durable queue tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
