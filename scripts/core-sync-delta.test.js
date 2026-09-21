'use strict';

const assert = require('node:assert/strict');

(async function () {
  const { CoreSyncDelta } = await import('../src/core/sync-delta.mjs');
  const mem = {
    stats: { totalRounds: 1, bySentence: { a: { times: 1 } }, events: [{ id: 'e1' }], },
    mastered: { a: true },
    reinforceBook: [],
    deletedItems: {},
    settings: { mode: 'choose' },
  };
  const light = CoreSyncDelta.memForCloud(mem);
  assert.equal(light.mastered, undefined);
  assert.deepEqual(light.stats, { totalRounds: 1 });
  assert.equal(mem.stats.bySentence.a.times, 1);
  const first = CoreSyncDelta.buildStatsDelta(mem, { bsSig: null, evIds: null });
  assert.deepEqual(Object.keys(first.sbs), ['a']);
  assert.deepEqual(first.evs, [{ id: 'e1' }]);
  const second = CoreSyncDelta.buildStatsDelta(mem, first.mark);
  assert.deepEqual(second.sbs, {});
  assert.deepEqual(second.evs, []);
  assert.equal(CoreSyncDelta.sameValue({ b: 2, a: { d: 4, c: 3 } }, { a: { c: 3, d: 4 }, b: 2 }), true);
  assert.equal(CoreSyncDelta.sameValue([1, 2], [2, 1]), false);

  const pending = CoreSyncDelta.createPendingSet();
  CoreSyncDelta.markPending(pending, 'a');
  CoreSyncDelta.markGone(pending, 'b', 3);
  assert.deepEqual(CoreSyncDelta.pendingList(pending, [{ id: 'a' }, { id: 'c' }], (item) => item.id), [{ id: 'a' }, { id: 'c' }]);
  assert.deepEqual(CoreSyncDelta.pendingGone(pending, [{ id: 'c', rev: 4 }]), {
    list: [{ id: 'b', rev: 3 }, { id: 'c', rev: 4 }], sent: { b: 1, c: 1 },
  });
  CoreSyncDelta.ackPending(pending, { a: 1 }, { b: 1 });
  assert.deepEqual(pending, { all: false, dirty: {}, gone: {} });
  CoreSyncDelta.markPending(pending, 'c');
  assert.deepEqual(CoreSyncDelta.pendingMap(pending, { a: 1, c: 2 }), { c: 2 });
  const superseded = { list: [{ id: 'c', rev: 4 }, { id: 'd', rev: 2 }], sent: { c: 1, d: 1 } };
  CoreSyncDelta.markGone(pending, 'c', 4);
  CoreSyncDelta.discardSupersededDeletes(pending, superseded, { c: 1 }, { c: 5, d: 2 });
  assert.deepEqual(superseded, { list: [{ id: 'd', rev: 2 }], sent: { d: 1 } });
  assert.deepEqual(pending.gone, {});
  assert.deepEqual(CoreSyncDelta.idsOf([{ id: 'a' }, { id: 'b' }], (item) => item.id), { a: 1, b: 1 });
  assert.deepEqual(CoreSyncDelta.entitiesNeedingPush(
    [{ id: 'new' }, { id: 'changed' }, { id: 'same' }],
    (item) => item.id,
    { changed: 3, same: 2 },
    { changed: 2, same: 2 },
  ), { new: 1, changed: 1 });
  console.log('core-sync-delta.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
