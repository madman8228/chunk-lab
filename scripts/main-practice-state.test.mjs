import assert from 'node:assert/strict';
import { buildRevealPlan, buildSentenceOutcome, createPracticeState } from '../src/main/practice-state.mjs';

const state = createPracticeState();
assert.equal(state.deck, null);
assert.deepEqual(state.items, []);
assert.equal(state.finished, false);
assert.equal(state._finishing, false);
assert.deepEqual(state.sessionByDeck, {});
assert.notStrictEqual(state.items, createPracticeState().items);
assert.deepEqual(createPracticeState({ idx: 3, deck: { id: 'demo' } }), {
  deck: { id: 'demo' },
  items: [], idx: 3, chunkIdx: 0, status: [], answers: [], wrongAttempts: [], wrongAnswers: [],
  combo: 0, maxCombo: 0, perfectCount: 0, chunkTotal: 0, chunkRight: 0, wrong: [], sessionByDeck: {},
  finished: false, _finishing: false, perfectThis: true, hinted: false, _hintedChunks: [], contentBatch: null,
  tempTotal: 0, tempStart: 0, tempEnd: 0,
});
console.log('main-practice-state.test.mjs passed');

const item = { cid: 'c1' };
const outcome = buildSentenceOutcome({
  item, wrongAttempts: [0, 2, 0], status: ['ok', 'pending', 'revealed'], hinted: false,
  answers: ['a', 'b', ''], wrongAnswers: [[], ['x'], []], existingWrong: [],
});
assert.deepEqual(outcome, {
  totalWrong: 2, needsReview: true, hadIssue: true, wrongIdx: [1, 2], shouldRecord: true,
  wrongEntry: { it: item, idx: [1, 2], answers: ['a', 'b', ''], wrongAnswers: [[], ['x'], []], needsReview: true },
});
assert.equal(buildSentenceOutcome({ item, wrongAttempts: [1], status: ['ok'], existingWrong: [{ it: item }] }).shouldRecord, false);
assert.equal(buildSentenceOutcome({ item, wrongAttempts: [0], status: ['ok'], hinted: false }).hadIssue, false);
assert.deepEqual(buildRevealPlan(['ok', 'pending', 'revealed'], 0), { indices: [1] });
assert.deepEqual(buildRevealPlan(['ok', 'pending', 'revealed'], 0, true), { indices: [1] });
assert.deepEqual(buildRevealPlan(['ok'], 0), { indices: [] });
