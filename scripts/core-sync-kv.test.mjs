import assert from 'node:assert/strict';
import { CoreSyncKv } from '../src/core/sync-kv-merge.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const deps = {
  cloneJSON: clone,
  mergeStats: (left, right) => ({ totalAnswered: (left.totalAnswered || 0) + (right.totalAnswered || 0) }),
  mergeBest: (left, right) => ({ ...(left || {}), ...(right || {}) }),
  eqJson: (left, right) => JSON.stringify(left) === JSON.stringify(right),
};

const pending = CoreSyncKv.mergeSyncKv(
  { stats: { totalAnswered: 2 }, best: { streak: 1 } },
  { stats: { totalAnswered: 3 }, best: { streak: 2 } },
  { kv: { stats: 1, best: 4 } },
  { kv: { stats: 2, best: 4 } },
  ['stats', 'best'],
  [{ entity: 'events', id: 'e1' }],
  false,
  deps,
);
assert.deepEqual(pending.mem.stats, { totalAnswered: 5 });
assert.deepEqual(pending.mem.best, { streak: 2 });
assert.equal(pending.localRevs.kv.stats, 3);
assert.equal(pending.localRevs.kv.best, 5);
assert.equal(pending.dirty, true);

const emptyRemote = CoreSyncKv.mergeSyncKv(
  { stats: { totalAnswered: 2 } },
  { stats: {} },
  { kv: {} },
  { kv: {} },
  ['stats'],
  [],
  false,
  deps,
);
assert.deepEqual(emptyRemote.mem.stats, { totalAnswered: 2 });
assert.equal(emptyRemote.dirty, true);

console.log('core-sync-kv.test.mjs passed');
