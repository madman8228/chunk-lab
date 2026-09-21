import assert from 'node:assert/strict';
import { CoreSyncReplay } from '../src/core/sync-replay.mjs';

function makeStore(records) {
  const calls = [];
  return {
    calls,
    async readSyncIntents() { return records; },
    async freezeSyncIntent(scope, key, operationId, payload) {
      calls.push(['freeze', scope, key, operationId, payload]);
      return { operationId, payload };
    },
    async confirmSyncIntent(scope, key, operationId) {
      calls.push(['confirm', scope, key, operationId]);
      records.shift();
    },
    async acknowledgeSyncIntents(scope, receipts) { calls.push(['ack', scope, receipts]); records.shift(); },
  };
}

const record = {
  key: 'course:c1', operationId: 'op-1', entity: 'courses', id: 'c1',
  deleted: false,
  original: { courseId: 'c1', version: 1 }, value: { courseId: 'c1', version: 2 },
};
const store = makeStore([record]);
const sent = [];
const remembered = [];
const protectedIds = [];
const result = await CoreSyncReplay.drainCourseIntents({
  store,
  api: {
    async getSyncEntity() { return { exists: true, rev: 4, deleted: false, value: record.original }; },
    async putData(payload) { sent.push(payload); return { ok: true }; },
  },
  getScope: () => 'user-1',
  markProtected: (group, id) => protectedIds.push([group, id]),
  loadRevs: () => ({ courses: { c1: 6 } }),
  rememberRevision: (group, id, rev) => remembered.push([group, id, rev]),
});
assert.equal(result, true);
assert.deepEqual(protectedIds, [['courses', 'c1']]);
assert.equal(sent[0].revs.courses.c1, 7);
assert.equal(sent[0].baseRevs.courses.c1, 4);
assert.deepEqual(remembered, [['courses', 'c1', 7]]);
assert.deepEqual(store.calls.map((call) => call[0]), ['freeze', 'confirm']);

const already = { ...record, value: record.original };
const alreadyStore = makeStore([already]);
const alreadyRemembered = [];
const alreadyResult = await CoreSyncReplay.drainCourseIntents({
  store: alreadyStore,
  api: { async getSyncEntity() { return { exists: true, rev: 9, deleted: false, value: record.original }; } },
  getScope: () => 'user-1',
  rememberRevision: (group, id, rev) => alreadyRemembered.push([group, id, rev]),
});
assert.equal(alreadyResult, true);
assert.deepEqual(alreadyRemembered, [['courses', 'c1', 9]]);
assert.equal(alreadyStore.calls[0][0], 'ack');

let failure;
const conflictResult = await CoreSyncReplay.drainCourseIntents({
  store: makeStore([record]),
  api: { async getSyncEntity() { return { exists: true, rev: 2, deleted: false, value: { courseId: 'c1', version: 99 } }; } },
  getScope: () => 'user-1',
  onFailure: (error) => { failure = error; return false; },
});
assert.equal(conflictResult, false);
assert.equal(failure.code, 'SYNC_CONFLICT');
assert.equal(failure.conflicts[0].reason, 'BASE_CONTENT_CHANGED');

console.log('core-sync-replay.test.mjs passed');
