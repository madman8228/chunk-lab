import assert from 'node:assert/strict';
import { buildDeckProgressMarkup, calculateDeckLearningProgress } from '../src/main/deck-progress.mjs';

assert.deepEqual(calculateDeckLearningProgress({ deckId: 'd1', total: 3, items: null }), {
  done: null, total: 3, pct: null, ready: false,
});
assert.deepEqual(calculateDeckLearningProgress({
  deckId: 'd1',
  total: 3,
  items: [{ cid: 'a' }, { cid: 'b' }, { cid: 'c' }],
  stats: { bySentence: {
    'd1#a': { times: 1 },
    'd1#b': { times: 2 },
    'd1#old': { times: 5 },
    'other#a': { times: 9 },
  } },
}), { done: 2, total: 3, pct: 67, ready: true });
assert.deepEqual(calculateDeckLearningProgress({
  deckId: 'd1',
  total: 2,
  items: [{ cid: 'a' }, { cid: 'b' }],
  stats: { bySentence: { 'd1#a': { times: 1 }, 'd1#b': { times: 1 } } },
  isDeleted: (_deckId, cid) => cid === 'b',
}), { done: 1, total: 2, pct: 50, ready: true });
assert.match(buildDeckProgressMarkup({ progress: { done: 1, total: 2, pct: 50, ready: true } }), /已覆盖 1 \/ 2 句/);
assert.match(buildDeckProgressMarkup({
  progress: { done: 2, total: 2, pct: 100, ready: true },
  resumeIdx: 4,
  best: { lastAcc: 86 },
  sessionCount: 2,
}), /当前第 2 句/);
assert.match(buildDeckProgressMarkup({ progress: { ready: false } }), /正在核对进度/);
console.log('main-deck-progress.test.mjs passed');
