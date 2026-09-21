import assert from 'node:assert/strict';
import { CoreSyncMarks } from '../src/core/sync-learning-marks.mjs';

const result = CoreSyncMarks.mergeLearningMarks({
  mastered: { keep: { markedAt: 1 }, gone: { markedAt: 1 } },
  deletedItems: { local: true, ignored: false },
  reinforceBook: [{ _key: 'same', source: 'local' }, { _key: 'local-only' }],
}, {
  mastered: { remote: { markedAt: 2 }, keep: { markedAt: 2 } },
  deletedItems: { remote: true },
  reinforceBook: [{ _key: 'same', source: 'remote' }, { _key: 'remote-only' }],
}, {
  mastered: ['gone'],
  reinforce: ['remote-only'],
  deletedItem: ['remote'],
});

assert.deepEqual(result.mastered, {
  keep: { markedAt: 2 },
  remote: { markedAt: 2 },
});
assert.deepEqual(result.deletedItems, { local: true });
assert.deepEqual(result.reinforceBook, [
  { _key: 'same', source: 'remote' },
  { _key: 'local-only' },
]);
assert.deepEqual(CoreSyncMarks.mergeLearningMarks(null, null, null), {
  mastered: {}, deletedItems: {}, reinforceBook: [],
});

console.log('core-sync-learning-marks.test.mjs passed');
