import assert from 'node:assert/strict';
import { CoreSyncStats } from '../src/core/sync-stats-normalize.mjs';

const calls = { cid: 0, decks: 0, merge: 0 };
const dependencies = {
  migrateCidKeys(holder) {
    calls.cid += 1;
    const event = holder.stats.events && holder.stats.events[0];
    if (event) event.key = 'oral-new#hello';
    return true;
  },
  migrateToBookDecks() {
    calls.decks += 1;
    return false;
  },
  mergeStats(left) {
    calls.merge += 1;
    return { ...left, bySentence: { 'oral-new#hello': { times: 1 } } };
  },
};

const invalid = CoreSyncStats.normalizeSyncedStats(null, dependencies);
assert.deepEqual(invalid, { stats: null, changed: false, repairedEventIds: {} });

const repaired = CoreSyncStats.normalizeSyncedStats({
  bySentence: { 'oral-new#hello': { times: 0 } },
  events: [{ id: 'e1', kind: 'answer', key: 'old#hello' }],
}, dependencies);
assert.equal(repaired.changed, true);
assert.deepEqual(repaired.repairedEventIds, { e1: 1 });
assert.equal(repaired.stats.bySentence['oral-new#hello'].times, 1);
assert.deepEqual(calls, { cid: 1, decks: 0, merge: 1 });

const normal = CoreSyncStats.normalizeSyncedStats({
  bySentence: { 'oral-new#hello': { times: 2 } },
  events: [{ id: 'e2', kind: 'answer', key: 'oral-new#hello' }],
}, {
  migrateCidKeys: () => false,
  migrateToBookDecks: () => false,
  mergeStats: () => { throw new Error('normal snapshot must not rebuild'); },
});
assert.equal(normal.changed, false);
assert.deepEqual(normal.repairedEventIds, {});

console.log('core-sync-stats-normalize.test.mjs passed');
