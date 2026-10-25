import assert from 'node:assert/strict';
import { buildSentenceReviewModel, resolveMistakeState, selectReviewBatch } from '../src/learning/review-policy.mjs';

const DAY = 86_400_000;
const day = Date.UTC(2026, 0, 1, 12);
const row = { _key: 'd::sentence', deckId: 'd', cid: 'c', sentence: 'A sentence.', history: [
  { eventId: 'wrong', at: day, mode: 'typing', mistakes: [{ chunk: 'A sentence.' }] },
] };
const event = (id, at, patch = {}) => ({ id, at, sessionId: id, type: 'practice', ok: true, assisted: false, firstAttempt: true, timeZone: 'UTC', contentFingerprint: 'v1', ...patch });
const stat = { deckId: 'd', dueAt: day - 1, learningV1: { evidence: [
  { id: 'wrong', at: day, sessionId: 'wrong', type: 'practice', ok: false, assisted: false, firstAttempt: true, timeZone: 'UTC', contentFingerprint: 'v1' },
  event('same-day', day + 1000), event('next-day', day + 86_400_000),
] } };

const oneDay = { ...stat, learningV1: { evidence: [...stat.learningV1.evidence.slice(0, 2), event('same-day-2', day + 2000)] } };
assert.equal(resolveMistakeState({ row, stat: oneDay, contentFingerprint: 'v1' }).status, 'needs-reinforcement');
assert.equal(resolveMistakeState({ row, stat: oneDay, contentFingerprint: 'v1' }).successDays, 1);
assert.equal(resolveMistakeState({ row, stat, contentFingerprint: 'v1' }).status, 'mastered');
const mastered = { ...stat, learningV1: { evidence: [...stat.learningV1.evidence, event('third-day', day + 2 * 86_400_000)] } };
assert.equal(resolveMistakeState({ row, stat: mastered, contentFingerprint: 'v1' }).status, 'mastered');
assert.equal(resolveMistakeState({ row, stat: mastered, contentFingerprint: 'v2' }).status, 'needs-reinforcement');
const oneSessionAcrossDays = { ...stat, learningV1: { evidence: [
  stat.learningV1.evidence[0], event('same-session-day-1', day + 1000, { sessionId: 'same-session' }),
  event('same-session-day-2', day + DAY, { sessionId: 'same-session' }),
] } };
assert.equal(resolveMistakeState({ row, stat: oneSessionAcrossDays, contentFingerprint: 'v1' }).successDays, 1,
  'one practice session cannot satisfy two-day consolidation across midnight');
assert.equal(resolveMistakeState({ row, stat: { learningV1: { evidence: [event('hint', day + 1, { assisted: true }), event('after-hint', day + 2 * 86_400_000)] } }, contentFingerprint: 'v1' }).successDays, 1);

const decks = [{ id: 'd', items: [{ cid: 'c', sentence: 'A sentence.' }] }, { id: 'other', items: [{ cid: 'c', sentence: 'A sentence.' }] }];
const model = buildSentenceReviewModel({ stats: { bySentence: { 'd#c': oneDay, 'other#c': { ...oneDay, deckId: 'other' } } }, reinforceBook: [row, row], decks, now: day + 1, cidForItem: (item) => item.cid });
assert.equal(model.counts.due, 2, 'same text in different courses has separate identity');
assert.equal(model.counts.needsReinforcement, 1);
assert.equal(model.wrong.length, 1, 'duplicate historical wrong rows resolve to one course/item identity');
assert.equal(model.due.filter((entry) => entry.key === 'd#c').length, 1, 'the sentence appears once in the due queue');
assert.equal(model.wrong.filter((entry) => entry.key === 'd#c').length, 1, 'the same sentence appears once in the wrong-book queue');
assert.equal(selectReviewBatch(model, { kind: 'wrong', status: 'mastered' }).length, 0);
const batchItems = Array.from({ length: 12 }, (_, index) => ({ cid: `batch-${index}`, sentence: `Batch sentence ${index}.` }));
const batchModel = buildSentenceReviewModel({ decks: [{ id: 'batch', items: batchItems }], reinforceBook: batchItems.map((item, index) => ({
  _key: `batch::${item.cid}`, deckId: 'batch', cid: item.cid, sentence: item.sentence,
  history: [{ eventId: `batch-wrong-${index}`, at: day, mistakes: [{ chunk: 'wrong' }] }],
})), isJoined: () => true, cidForItem: item => item.cid, now: day + DAY });
assert.equal(selectReviewBatch(batchModel, { kind: 'wrong', limit: 50 }).length, 10, 'review batches are capped at ten');
console.log('review-policy.test.mjs passed');
