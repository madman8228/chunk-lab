import assert from 'node:assert/strict';
import { CoreSyncBatchMerge } from '../src/core/sync-batch-merge.mjs';

const identity = (value) => JSON.parse(JSON.stringify(value));
const result = CoreSyncBatchMerge.mergeBatchSnapshots({
  mem: {
    decks: [{ id: 'd1', name: 'local' }],
    best: { streak: 1 },
    settings: { voice: 'local' },
    stats: { totalAnswered: 1, bySentence: { a: { times: 1 } }, events: [{ id: 'e1' }] },
    mastered: { a: { markedAt: 1 } },
    deletedItems: { old: true },
    reinforceBook: [{ _key: 'r1', sentence: 'local' }],
  },
  courses: [{ courseId: 'c1', title: 'local' }],
  courseProgress: { c1: { done: 1 } },
  revs: {
    decks: { d1: 2 }, kv: { settings: 2 }, courses: { c1: 1 }, courseProgress: { c1: 1 },
  },
  generation: 7,
}, {
  mem: {
    decks: [{ id: 'd1', name: 'remote' }, { id: 'd2', name: 'remote' }],
    best: { streak: 2 },
    settings: { voice: 'remote' },
    stats: { totalAnswered: 2, bySentence: { b: { times: 2 } }, events: [{ id: 'e2' }] },
    mastered: { b: { markedAt: 2 } },
    deletedItems: { gone: true },
    reinforceBook: [{ _key: 'r1', sentence: 'remote' }, { _key: 'r2' }],
  },
  courses: [{ courseId: 'c1', title: 'remote' }, { courseId: 'c2', title: 'remote' }],
  courseProgress: { c1: { done: 2 }, c2: { done: 1 } },
  revs: {
    decks: { d1: 1, d2: 1 }, kv: { settings: 3 }, courses: { c1: 2, c2: 1 }, courseProgress: { c1: 2, c2: 1 },
  },
  generation: 2,
}, {
  cloneJSON: identity,
  normalizeSyncedStats: (stats) => ({ stats, changed: false }),
  mergeBest: (left, right) => ({ ...(left || {}), ...(right || {}) }),
  mergeStats: (left, right) => ({ totalAnswered: (left.totalAnswered || 0) + (right.totalAnswered || 0) }),
  migrateCidKeys: () => {},
  migrateToBookDecks: () => {},
  currentVersion: 9,
});

assert.equal(result.mem.version, 9);
assert.deepEqual(result.mem.decks, [{ id: 'd1', name: 'local' }, { id: 'd2', name: 'remote' }]);
assert.deepEqual(result.courses, [
  { courseId: 'c1', title: 'remote' },
  { courseId: 'c2', title: 'remote' },
]);
assert.deepEqual(result.courseProgress, { c1: { done: 2 }, c2: { done: 1 } });
assert.deepEqual(result.mem.reinforceBook, [
  { _key: 'r1', sentence: 'remote' },
  { _key: 'r2' },
]);
assert.equal(result.generation, 7);

const business = CoreSyncBatchMerge.buildBusinessSnapshot({
  mem: {
    decks: [{ id: 'd2', builtin: 1, isPublic: 0 }, { id: 'd1' }],
    stats: { totalAnswered: 3 },
    best: { streak: 2 },
  },
  courses: [{ courseId: 'c2' }, { courseId: 'c1' }],
  courseProgress: { c1: { done: 1 } },
}, {
  cloneJSON: identity,
  normalizeSyncedStats: (stats) => ({ stats }),
});
assert.deepEqual(business.mem.decks.map((deck) => deck.id), ['d1', 'd2']);
assert.equal(business.mem.decks[1].builtin, true);
assert.equal(business.mem.decks[1].isPublic, false);
assert.deepEqual(business.courses.map((course) => course.courseId), ['c1', 'c2']);
assert.deepEqual(business.courseProgress, { c1: { done: 1 } });

console.log('core-sync-batch-merge.test.mjs passed');
