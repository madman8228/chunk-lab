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
assert.equal(result.reinforceBook.length, 2);
const mergedSame = result.reinforceBook.find((row) => row._key === 'same');
assert.equal(mergedSame.history.length, 2);
assert.ok(result.reinforceBook.some((row) => row._key === 'local-only'));
assert.deepEqual(CoreSyncMarks.mergeLearningMarks(null, null, null), {
  mastered: {}, deletedItems: {}, reinforceBook: [],
});

const localReMark = { mastered: { 'deck#item': { deckId: 'deck', markedAt: 200 } } };
const signatureOf = (row) => `${row.markedAt}:${row.deckId}`;
assert.deepEqual(CoreSyncMarks.findConflictingMasteredDeletes(
  localReMark, { 'deck#item': signatureOf(localReMark.mastered['deck#item']) },
  { mastered: ['deck#item'] }, signatureOf,
), [], 'a known unchanged cloud mark may accept the remote cancellation');
assert.deepEqual(CoreSyncMarks.findConflictingMasteredDeletes(
  localReMark, { 'deck#item': '100:deck' }, { mastered: ['deck#item'] }, signatureOf,
), ['deck#item'], 'a local re-mark newer than the acknowledged row must be protected');
assert.deepEqual(CoreSyncMarks.findConflictingMasteredDeletes(
  localReMark, null, { mastered: ['deck#item'] }, signatureOf,
), ['deck#item'], 'an unknown baseline must not erase a possibly pending local mark');
assert.deepEqual(CoreSyncMarks.findConflictingMasteredDeletes(
  { mastered: {} }, {}, { mastered: ['deck#item'] }, signatureOf,
), [], 'a remote cancellation with no local row is not a conflict');
assert.deepEqual(CoreSyncMarks.findConflictingMasteredDeletes(
  localReMark, { 'deck#item': '100:deck' }, { mastered: ['deck#item', 'deck#item'] }, signatureOf,
), ['deck#item'], 'duplicate tombstones produce one conflict key');

console.log('core-sync-learning-marks.test.mjs passed');
