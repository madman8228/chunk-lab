'use strict';

/* The protocol gate is stored in SQLite and survives a process restart. A
 * deploy-time/config rollback must never reopen snapshot writes to that DB. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { freePort } = require('../e2e/lib/free-port');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-write-protocol-'));
const port = freePort(9460, 100);
const base = 'http://127.0.0.1:' + port;
const secret = 'write-protocol-persistence-test-secret';

async function start(enableProtocol3) {
  const env = { ...process.env, NODE_ENV: 'test', PORT: String(port),
    CHUNKLAB_DATA_DIR: dataDir, REQUIRE_AUTH: 'true', JWT_SECRET: secret,
    ADMIN_PASSWORD: 'protocol-admin-password', ADMIN_JWT_SECRET: 'admin-write-protocol-test-secret-long-enough' };
  if (enableProtocol3) env.CHUNKLAB_WRITE_PROTOCOL = '3';
  else delete env.CHUNKLAB_WRITE_PROTOCOL;
  const child = spawn(process.execPath, [enableProtocol3 ? 'index.js' : 'testing/start-historical.js'], { cwd: __dirname, env, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('server exited before becoming ready');
    try { if ((await fetch(base + '/api/health')).ok) return child; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  child.kill();
  throw new Error('server did not become ready');
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
}

async function request(method, route, token, payload) {
  const response = await fetch(base + route, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  return { status: response.status, body: await response.json() };
}

async function paddedContentImportRequest(token, payload, totalBytes) {
  const body = Buffer.from(JSON.stringify(payload));
  if (body.length >= totalBytes) throw new Error('padded import fixture exceeds target length');
  return new Promise((resolve, reject) => {
    const req = http.request(base + '/api/content-import', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
        'Content-Length': String(totalBytes) }
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    (async () => {
      req.write(body);
      let remaining = totalBytes - body.length;
      const padding = Buffer.alloc(64 * 1024, 0x20);
      while (remaining > 0) {
        const part = padding.subarray(0, Math.min(remaining, padding.length));
        remaining -= part.length;
        if (!req.write(part)) await once(req, 'drain');
      }
      req.end();
    })().catch(error => req.destroy(error));
  });
}

(async function main() {
  let child;
  try {
    child = await start(true);
    const config = await request('GET', '/api/config');
    assert.equal(config.body.writeProtocol, 3);
    assert.equal(config.body.persistenceMode, 'server-authoritative');
    const registered = await request('POST', '/api/auth/register', null,
      { username: 'protocol-restart', password: 'test-password' });
    assert.equal(registered.status, 200);
    const token = registered.body.token;
    const beforeLegacyOperationGate = await request('GET', '/api/data', token);
    const legacy = await request('PUT', '/api/data', token, { mem: {} });
    assert.equal(legacy.status, 428);
    assert.equal(legacy.body.code, 'CLIENT_UPDATE_REQUIRED');
    const missingProtocol = await request('POST', '/api/operations', token, {
      requestId: 'protocol-missing-version-01', type: 'course.progress',
      payload: { courseId: 'legacy-course', nodeId: 'node-1', passed: true, completed: false }
    });
    assert.equal(missingProtocol.status, 428, 'protocol 3 server rejects operations without an explicit protocol version');
    assert.equal(missingProtocol.body.code, 'CLIENT_UPDATE_REQUIRED');
    const legacyProtocol = await request('POST', '/api/operations', token, {
      protocol: 2, requestId: 'protocol-legacy-operation-01', type: 'course.progress',
      payload: { courseId: 'legacy-course', nodeId: 'node-1', passed: true, completed: false }
    });
    assert.equal(legacyProtocol.status, 428, 'protocol 3 server rejects protocol 2 operation writes');
    assert.equal(legacyProtocol.body.code, 'CLIENT_UPDATE_REQUIRED');
    const afterLegacyOperationGate = await request('GET', '/api/data', token);
    assert.equal(afterLegacyOperationGate.body.seq, beforeLegacyOperationGate.body.seq,
      'operations rejected for protocol mismatch do not mutate confirmed account data');
    await stop(child);
    child = null;

    // No activation environment variable on this process: SQLite remains the
    // authority and continues to refuse legacy writes.
    child = await start(false);
    const restarted = await request('GET', '/api/config');
    assert.equal(restarted.body.writeProtocol, 3);
    assert.equal(restarted.body.persistenceMode, 'server-authoritative');
    const beforeRejectedLegacyWrites = await request('GET', '/api/data', token);
    const legacyWriteRoutes = [
      ['PUT', '/api/data', { mem: {} }],
      ['POST', '/api/import', { mem: {} }],
      ['POST', '/api/sync/resolve', {}],
      ['POST', '/api/sync/batch/resolve', {}],
      ['POST', '/api/courses', { course: { courseId: 'legacy-course', title: 'Legacy', nodes: [] } }],
      ['DELETE', '/api/courses/legacy-course'],
      ['POST', '/api/deck/publish', { deckId: 'legacy-deck', publish: true }]
    ];
    for (const [method, route, payload] of legacyWriteRoutes) {
      const rejected = await request(method, route, token, payload);
      assert.equal(rejected.status, 428, `${method} ${route} is closed after protocol 3 activation`);
      assert.equal(rejected.body.code, 'CLIENT_UPDATE_REQUIRED', `${method} ${route} tells old clients to update`);
    }
    const after = await request('GET', '/api/data', token);
    assert.equal(after.body.seq, beforeRejectedLegacyWrites.body.seq,
      'rejected legacy writes do not change the account sequence');
    const operation = await request('POST', '/api/operations', token, {
      protocol: 3,
      requestId: 'protocol-restart-progress-1',
      type: 'course.progress',
      payload: { courseId: 'protocol-restart-course', nodeId: 'node-1', passed: true, completed: false }
    });
    assert.equal(operation.status, 200, 'protocol 3 remains writable after restart');
    const healthReport = await request('POST', '/api/client-save-health', token, {
      version: 1, clientId: 'persisted-client-id-12345', pending: 1, blocked: 0, retryAttempts: 2,
      oldestPendingAt: Date.now() - 10000, errorCode: null, traceId: null
    });
    assert.equal(healthReport.status, 200, 'an authenticated protocol-3 browser can report aggregate queue health');
    assert.equal(healthReport.body.ok, true);
    const unauthenticatedAdminHealth = await request('GET', '/api/admin/save-health');
    assert.equal(unauthenticatedAdminHealth.status, 401, 'queue diagnostics remain private to administrators');
    const adminLogin = await request('POST', '/api/admin/login', null, { password: 'protocol-admin-password' });
    assert.equal(adminLogin.status, 200, 'the isolated server can authenticate its test administrator');
    const adminHealth = await request('GET', '/api/admin/save-health', adminLogin.body.token);
    assert.equal(adminHealth.status, 200);
    assert.equal(adminHealth.body.health.activeClients, 1, 'the administrator reads the client report persisted by this test');
    assert.equal(adminHealth.body.health.activeAccounts, 1);
    assert.equal(adminHealth.body.health.pending, 1);
    assert.equal(adminHealth.body.health.blocked, 0);
    assert.equal(adminHealth.body.health.retryAttempts, 2);
    assert.ok(adminHealth.body.health.oldestPendingAt <= Date.now() - 9000,
      'the admin view preserves the reported oldest-pending timestamp');

    const beforeContent = await request('GET', '/api/data', token);
    const deck = { id: 'protocol-restart-deck', name: 'Test deck', items: [{ sentence: 'Hello.' }] };
    const deckCreate = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-deck-create', type: 'deck.put', expectedRev: null,
      payload: { deck }
    });
    assert.equal(deckCreate.status, 200);
    assert.equal(deckCreate.body.operation.rev, 1);
    assert.equal(deckCreate.body.changes.delta, true, 'operation changes use the canonical sync delta envelope');
    assert.equal(deckCreate.body.changes.seq, deckCreate.body.seq, 'the delta and receipt share one sequence watermark');
    assert.equal(deckCreate.body.changes.mem.decks[0].id, deck.id, 'the canonical delta carries the committed deck row');
    assert.equal(deckCreate.body.changes.revs.decks[deck.id], 1, 'the canonical delta carries its revision');
    assert.equal(deckCreate.body.operation.value, undefined, 'large entity content is not duplicated in the compact operation metadata');
    const deckUpdate = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-deck-update', type: 'deck.put', expectedRev: 1,
      payload: { deck: { ...deck, name: 'Updated deck' } }
    });
    assert.equal(deckUpdate.status, 200);
    assert.equal(deckUpdate.body.operation.rev, 2);
    const staleDeck = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-deck-stale', type: 'deck.put', expectedRev: 1,
      payload: { deck }
    });
    assert.equal(staleDeck.status, 409);
    assert.equal(staleDeck.body.code, 'ENTITY_CHANGED');
    const publishDeck = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-deck-publish', type: 'deck.publish', expectedRev: 2,
      payload: { deckId: deck.id, publish: true }
    });
    assert.equal(publishDeck.status, 200);
    assert.equal(publishDeck.body.operation.rev, 3);
    assert.equal(publishDeck.body.operation.isPublic, true);
    const stalePublish = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-deck-publish-stale', type: 'deck.publish', expectedRev: 2,
      payload: { deckId: deck.id, publish: false }
    });
    assert.equal(stalePublish.status, 409);
    assert.equal(stalePublish.body.code, 'ENTITY_CHANGED');
    const currentDeck = await request('GET', '/api/data', token);
    assert.equal(currentDeck.body.mem.decks.find(item => item.id === deck.id).name, 'Updated deck');
    assert.equal(currentDeck.body.mem.decks.find(item => item.id === deck.id).isPublic, true);

    const course = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-course-create', type: 'course.put', expectedRev: null,
      payload: { course: { courseId: 'protocol-restart-user-course', title: 'Test course', nodes: [] } }
    });
    assert.equal(course.status, 200);
    assert.equal(course.body.operation.rev, 1);
    const largeCoursePayload = { course: { courseId: 'protocol-large-import-course',
      title: 'Large imported course', sourceNote: 'x'.repeat(300 * 1024), nodes: [] } };
    const largeCourseImport = await request('POST', '/api/content-import', token, {
      protocol: 3, requestId: 'protocol-large-course-import-01', type: 'course.put', expectedRev: null,
      payload: largeCoursePayload
    });
    assert.equal(largeCourseImport.status, 200, 'the dedicated import route accepts validated content larger than the normal operation ceiling');
    assert.equal(largeCourseImport.body.operation.rev, 1);
    const duplicateLargeImport = await request('POST', '/api/content-import', token, {
      protocol: 3, requestId: 'protocol-large-course-import-01', type: 'course.put', expectedRev: null,
      payload: largeCoursePayload
    });
    assert.equal(duplicateLargeImport.body.duplicate, true, 'large imports have the same durable idempotency receipt');
    const tooLargeAsNormalOperation = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-large-course-normal-01', type: 'course.put', expectedRev: 1,
      payload: largeCoursePayload
    });
    assert.equal(tooLargeAsNormalOperation.status, 413, 'large course payload cannot bypass the regular operation limit');
    const invalidLargeImport = await request('POST', '/api/content-import', token, {
      protocol: 3, requestId: 'protocol-large-course-invalid-01', type: 'course.put', expectedRev: null,
      payload: { course: { title: 'Missing course id', nodes: [] } }
    });
    assert.equal(invalidLargeImport.status, 400, 'dedicated import still validates course identity');
    assert.match(invalidLargeImport.body.traceId, /^[0-9a-f-]{36}$/, 'content import validation failures are traceable without returning diagnostic internals');
    const largeCourseReadback = await request('GET', '/api/data', token);
    assert.equal(largeCourseReadback.body.courses.find(item => item.courseId === 'protocol-large-import-course').sourceNote.length,
      300 * 1024, 'large imported content is stored as a single course entity');
    const paddedImport = await paddedContentImportRequest(token, {
      protocol: 3, requestId: 'protocol-import-json-limit-01', type: 'deck.put', expectedRev: null,
      payload: { deck: { id: 'protocol-import-json-limit-deck', name: 'JSON body limit', items: [] } }
    }, 80_000_001);
    assert.equal(paddedImport.status, 200,
      'the global JSON parser accepts a body larger than decimal 80 MB when it remains within the 80 MiB import contract');
    const paddedImportReadback = await request('GET', '/api/data', token);
    assert.equal(paddedImportReadback.body.mem.decks.some(deck => deck.id === 'protocol-import-json-limit-deck'), true,
      'the boundary-sized request reaches the validated content operation and persists its entity');
    const courseProgressBeforeDelete = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-delete-progress-seed', type: 'course.progress',
      payload: { courseId: 'protocol-restart-user-course', nodeId: 'node-1', passed: true, completed: true, generation: 0 }
    });
    assert.equal(courseProgressBeforeDelete.status, 200);
    const deleteDeck = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-deck-delete', type: 'deck.delete', expectedRev: 3,
      payload: { deckId: deck.id }
    });
    assert.equal(deleteDeck.status, 200);
    const deleteCourse = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-restart-course-delete', type: 'course.delete', expectedRev: 1,
      payload: { courseId: 'protocol-restart-user-course' }
    });
    assert.equal(deleteCourse.status, 200);
    const afterContent = await request('GET', '/api/data?since=' + beforeContent.body.seq, token);
    assert.ok(!afterContent.body.mem.decks.some(item => item.id === deck.id));
    assert.ok(afterContent.body.deleted.decks.includes(deck.id), 'incremental reads expose deck deletion tombstones');
    assert.ok(afterContent.body.deleted.courses.includes('protocol-restart-user-course'),
      'incremental reads expose course deletion tombstones');
    assert.ok(afterContent.body.deleted.courseProgress.includes('protocol-restart-user-course'),
      'incremental reads expose the deleted course progress tombstone');
    const lateDeletedCourseProgress = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-delete-progress-late', type: 'course.progress',
      payload: { courseId: 'protocol-restart-user-course', nodeId: 'late-node', passed: true, completed: true, generation: 0 }
    });
    assert.equal(lateDeletedCourseProgress.body.outcome, 'retained', 'late progress cannot recreate a deleted course');

    const answerBeforeReset = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-reset-answer-before', type: 'learning.answer',
      payload: { eventId: 'protocol_reset_answer_before_01', key: 'protocol-reset-course#sentence-0001',
        deckId: 'protocol-reset-course', courseId: 'protocol-reset-course', generation: 0, ok: true,
        sessionId: 'protocol-reset-session-01', answerOrder: 0, chunkRight: 1, chunkTotal: 1 }
    });
    assert.equal(answerBeforeReset.status, 200);
    assert.equal(answerBeforeReset.body.operation.stat.times, 1);
    assert.equal(answerBeforeReset.body.changes.delta, true);
    assert.equal(answerBeforeReset.body.changes.seq, answerBeforeReset.body.seq);
    assert.equal(answerBeforeReset.body.changes.mem.stats.bySentence['protocol-reset-course#sentence-0001'].times, 1,
      'learning-operation delta contains the committed sentence statistic');
    assert.ok(answerBeforeReset.body.changes.mem.stats.events.some(event => event.id === 'protocol_reset_answer_before_01'),
      'learning-operation delta contains its immutable answer event');
    const reset = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-reset-generation-01', type: 'learning.reset',
      payload: { eventId: 'protocol_learning_reset_01', courseId: 'protocol-reset-course', expectedGeneration: 0 }
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.operation.generation, 1);
    assert.equal(reset.body.operation.resetSentenceCount, 1);
    const staleAnswer = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-reset-stale-answer', type: 'learning.answer',
      payload: { eventId: 'protocol_reset_answer_stale_01', key: 'protocol-reset-course#sentence-0001',
        deckId: 'protocol-reset-course', courseId: 'protocol-reset-course', generation: 0, ok: true,
        sessionId: 'protocol-reset-session-02', answerOrder: 0, chunkRight: 1, chunkTotal: 1 }
    });
    assert.equal(staleAnswer.body.outcome, 'retained', 'pre-reset offline answers cannot resurrect reset progress');

    await stop(child);
    child = null;
    child = await start(false);
    const persistedReceipt = await request('GET', '/api/operations/protocol-reset-answer-before', token);
    assert.equal(persistedReceipt.status, 200);
    assert.equal(persistedReceipt.body.changes.delta, true, 'receipt lookup preserves the canonical delta across restart');
    assert.equal(persistedReceipt.body.changes.mem.stats.bySentence['protocol-reset-course#sentence-0001'].times, 1);
    const staleAfterRestart = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-reset-stale-after-restart', type: 'learning.answer',
      payload: { eventId: 'protocol_reset_answer_stale_02', key: 'protocol-reset-course#sentence-0001',
        deckId: 'protocol-reset-course', courseId: 'protocol-reset-course', generation: 0, ok: true,
        sessionId: 'protocol-reset-session-03', answerOrder: 0, chunkRight: 1, chunkTotal: 1 }
    });
    assert.equal(staleAfterRestart.body.outcome, 'retained', 'reset generation persists across process restart');
    const answerAfterReset = await request('POST', '/api/operations', token, {
      protocol: 3, requestId: 'protocol-reset-answer-after', type: 'learning.answer',
      payload: { eventId: 'protocol_reset_answer_after_01', key: 'protocol-reset-course#sentence-0001',
        deckId: 'protocol-reset-course', courseId: 'protocol-reset-course', generation: 1, ok: true,
        sessionId: 'protocol-reset-session-04', answerOrder: 0, chunkRight: 1, chunkTotal: 1 }
    });
    assert.equal(answerAfterReset.status, 200);
    assert.equal(answerAfterReset.body.operation.stat.times, 1,
      'post-reset answers start from a clean projection even after restart');
    console.log('[write-protocol-persistence] protocol gate and learning reset generations survive restart; legacy imports remain closed');
  } catch (error) {
    console.error('[write-protocol-persistence] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    await stop(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
