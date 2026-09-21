import assert from 'node:assert/strict';
import { migrateLegacyStatKeys } from '../src/main/legacy-stats.mjs';

const result = migrateLegacyStatKeys({
  old: { deckId: 'rev-source-123', sentence: 'Every Tom', times: 2, okTimes: 1, wrongTimes: 1, maxStreak: 1, lastAt: 10 },
  'source#hash': { deckId: 'source', sentence: 'Every Tom', times: 3, okTimes: 2, wrongTimes: 1, maxStreak: 2, lastAt: 20 },
}, [{ id: 'source', name: 'Source deck', items: [{ sentence: 'Every Tom' }] }], {
  normalizeSentence: (value) => value.toLowerCase(),
  hash: () => 'hash',
});
assert.equal(result.changed, true);
assert.deepEqual(result.by['source#hash'], {
  deckId: 'source', sentence: 'Every Tom', times: 5, okTimes: 3, wrongTimes: 2, maxStreak: 2, lastAt: 20,
});
assert.equal(result.by.old, undefined);

const ambiguous = migrateLegacyStatKeys({ old: { deckId: 'temp', sentence: 'same', deckName: 'No match', times: 1 } }, [
  { id: 'a', name: 'A', items: [{ sentence: 'same' }] },
  { id: 'b', name: 'B', items: [{ sentence: 'same' }] },
], { normalizeSentence: (value) => value });
assert.equal(ambiguous.changed, false);
assert.ok(ambiguous.by.old);
console.log('main-legacy-stats.test.mjs passed');
