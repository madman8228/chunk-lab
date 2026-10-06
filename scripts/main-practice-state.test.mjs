import assert from 'node:assert/strict';
import { buildRevealPlan, buildSentenceOutcome, createPracticeState } from '../src/main/practice-state.mjs';

const state = createPracticeState();
assert.equal(state.deck, null);
assert.deepEqual(state.items, []);
assert.equal(state.finished, false);
assert.equal(state._finishing, false);
assert.deepEqual(state.sessionByDeck, {});
assert.equal(state.sessionId, '');
assert.equal(state.generation, 0);
assert.equal(state.answerOrder, 0);
assert.equal(state._answerQueued, false);
assert.equal(state._pendingAnswerOperation, null);
assert.equal(state._pendingResumeOperation, null);
assert.equal(state._pendingRoundOperation, null);
assert.equal(state._resumeSubmitting, false);
assert.equal(state._roundSubmitting, false);
assert.equal(state._roundQueued, false);
assert.notStrictEqual(state.items, createPracticeState().items);
assert.deepEqual(createPracticeState({ idx: 3, deck: { id: 'demo' } }), {
  deck: { id: 'demo' },
  items: [], idx: 3, chunkIdx: 0, status: [], answers: [], wrongAttempts: [], wrongAnswers: [],
  combo: 0, maxCombo: 0, perfectCount: 0, chunkTotal: 0, chunkRight: 0, wrong: [], sessionByDeck: {}, sessionId: '', generation: 0,
  answerOrder: 0, answerChunkRightStart: 0, answerChunkTotalStart: 0, _answerQueued: false, _pendingAnswerOperation: null,
  _pendingResumeOperation: null, _pendingRoundOperation: null, _resumeSubmitting: false, _roundSubmitting: false,
  _roundQueued: false, _saveRetry: false,
  finished: false, _finishing: false, perfectThis: true, hinted: false, _hintedChunks: [], contentBatch: null,
  attemptId: '', attemptStartedAt: 0, hintedChunks: {},
  tempTotal: 0, tempStart: 0, tempEnd: 0,
});
console.log('main-practice-state.test.mjs passed');

const item = { cid: 'c1' };
const outcome = buildSentenceOutcome({
  item, wrongAttempts: [0, 2, 0], status: ['ok', 'pending', 'revealed'], hinted: false,
  answers: ['a', 'b', ''], wrongAnswers: [[], ['x'], []], existingWrong: [], attemptId: 'attempt-1', attemptStartedAt: 100, mode: 'choose',
});
assert.deepEqual(outcome, {
  totalWrong: 2, needsReview: true, hadIssue: true, wrongIdx: [1, 2], shouldRecord: true,
  wrongEntry: { it: item, eventId: 'attempt-1', at: 100, mode: 'chunkSelection', idx: [1, 2], answers: ['a', 'b', ''], wrongAnswers: [[], ['x'], []], wrongAttempts: [0, 2, 0], needsReview: true, hinted: false, revealed: true, hintedChunks: {} },
});
assert.equal(buildSentenceOutcome({ item, wrongAttempts: [1], status: ['ok'], attemptId: 'attempt-1', existingWrong: [{ it: item, eventId: 'attempt-1' }] }).shouldRecord, false);
assert.equal(buildSentenceOutcome({ item, wrongAttempts: [1], status: ['ok'], attemptId: 'attempt-2', existingWrong: [{ it: item, eventId: 'attempt-1' }] }).shouldRecord, true);
assert.equal(buildSentenceOutcome({ item, wrongAttempts: [0], status: ['ok'], hinted: false }).hadIssue, false);
assert.deepEqual(buildRevealPlan(['ok', 'pending', 'revealed'], 0), { indices: [1] });
assert.deepEqual(buildRevealPlan(['ok', 'pending', 'revealed'], 0, true), { indices: [1] });
assert.deepEqual(buildRevealPlan(['ok'], 0), { indices: [] });
