import assert from 'node:assert/strict';
import { computeTodaySummary } from '../src/main/home-summary.mjs';

const summary = computeTodaySummary({
  stats: { bySentence: {
    'd1#a': { deckId: 'd1', times: 1 },
    'd1#b': { deckId: 'd1', times: 2 },
    'd2#c': { deckId: 'd2', times: 1 },
    'd1#unused': { deckId: 'd1', times: 1 },
  } },
  knownDeckIds: ['d1'],
  reinforceBook: [{ deckId: 'd1' }, { deckId: 'd2' }],
  now: 123,
  isDue: (stat, now) => stat.times === 1 && now === 123,
  isDeleted: (_deckId, cid) => cid === 'unused',
});
assert.deepEqual(summary, { due: 1, book: 2 });
assert.deepEqual(computeTodaySummary({}), { due: 0, book: 0 });
console.log('main-home-summary.test.mjs passed');
