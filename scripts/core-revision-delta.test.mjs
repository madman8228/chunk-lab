import assert from 'node:assert/strict';
import { calculateKeyedRevisionDelta, calculateRevisionDelta } from '../src/core/revision-delta.mjs';

const sigDeck = (deck) => `${deck.name}:${deck.items.length}`;
const kvSig = (_key, value) => JSON.stringify(value);
const baseOptions = {
  syncKvKeys: ['stats', 'settings'],
  sigDeck,
  kvSig,
};

const first = calculateRevisionDelta({
  ...baseOptions,
  mem: { decks: [{ id: 'd1', name: 'A', items: [] }], stats: { n: 1 } },
  revisions: {},
});
assert.deepEqual(first.revisions, { decks: { d1: 1 }, kv: { stats: 1 } });
assert.deepEqual(first.pending, { decks: ['d1'], gone: [] });

const changed = calculateRevisionDelta({
  ...baseOptions,
  previous: first.snapshot,
  revisions: first.revisions,
  mem: { decks: [{ id: 'd1', name: 'B', items: [] }], settings: { theme: 'dark' } },
});
assert.equal(changed.revisions.decks.d1, 2);
assert.equal(changed.revisions.kv.settings, 1);
assert.deepEqual(changed.pending, { decks: ['d1'], gone: [] });

const deleted = calculateRevisionDelta({
  ...baseOptions,
  previous: changed.snapshot,
  revisions: changed.revisions,
  mem: { decks: [], settings: { theme: 'dark' } },
});
assert.deepEqual(deleted.pending.gone, [{ id: 'd1', rev: 3 }]);
assert.deepEqual(deleted.deletes.decks, [{ id: 'd1', rev: 3 }]);

const courseFirst = calculateKeyedRevisionDelta({
  group: 'courses',
  current: [{ courseId: 'c1', title: 'A' }],
  revisions: {},
  keyOf: (course) => course.courseId,
});
assert.deepEqual(courseFirst.changed, ['c1']);
assert.equal(courseFirst.revisions.courses.c1, 1);

const courseChanged = calculateKeyedRevisionDelta({
  group: 'courses',
  current: [],
  previous: courseFirst.snapshot,
  revisions: courseFirst.revisions,
  keyOf: (course) => course.courseId,
});
assert.deepEqual(courseChanged.deleted, [{ id: 'c1', rev: 2 }]);

const progressChanged = calculateKeyedRevisionDelta({
  group: 'courseProgress',
  current: { c1: { completed: 2 } },
  previous: { c1: JSON.stringify({ completed: 1 }) },
  revisions: { courseProgress: { c1: 1 } },
  signature: (value) => JSON.stringify(value),
});
assert.deepEqual(progressChanged.changed, ['c1']);
assert.equal(progressChanged.revisions.courseProgress.c1, 2);
console.log('core-revision-delta.test.mjs passed');
