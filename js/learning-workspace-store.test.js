'use strict';
const assert = require('node:assert/strict');
global.AccountStorage = { owner: 'account:A' };
global.ChunkAPI = { getBase: () => 'http://isolated.test' };
let row = { owner: 'account:A', scope: 'scope:A', appliedSeq: 4, snapshot: { mem: { learningWorkspace: {
  'resource:missing': { itemType: 'resource', targetId: 'missing', selected: true }
} } } };
let pending = [];
global.ServerCache = { read: async () => row };
global.ServerStore = { pending: async () => pending, submitCommitted: async () => {} };
const store = require('./learning-workspace-store');
async function main() {
  pending = ['one', 'two'].map((id, ordinal) => ({ owner: row.owner, scope: row.scope, ordinal,
    operation: { type: 'workspace.select', payload: { itemType: 'resource', targetId: id, selected: true } } }));
  pending.push({ owner: 'account:B', scope: 'scope:B', ordinal: 3,
    operation: { type: 'workspace.select', payload: { itemType: 'resource', targetId: 'private', selected: true } } });
  const result = await store.read();
  assert.equal(result.pending, true);
  assert.deepEqual(Object.keys(result.confirmed), ['resource:missing']);
  assert.deepEqual(Object.keys(result.projected).sort(), ['resource:missing', 'resource:one', 'resource:two']);
  assert.equal(result.projected['resource:one'].pending, true);
  ServerStore.submitCommitted = async () => { throw new Error('offline'); };
  await assert.rejects(store.select('resource', 'one', true), /offline/);
  assert.equal((await store.read()).confirmed['resource:one'], undefined);
  ServerStore.submitCommitted = async () => { AccountStorage.owner = 'account:B'; };
  await assert.rejects(store.select('resource', 'one', true), /账号已切换/);
  await assert.rejects(store.read(), /尚未就绪/);
  AccountStorage.owner = 'account:A';
  pending[0].receipt = { seq: 4 };
  assert.equal((await store.read()).projected['resource:one'], undefined);
  console.log('workspace store: confirmed/pending separation, concurrent projection, failure and account isolation passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
