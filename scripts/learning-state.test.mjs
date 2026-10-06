import assert from 'node:assert/strict';
import { applyLearningEvent, mergeLearningEvidence, resolveLearningState } from '../src/learning/state.mjs';
import { scheduleLearningResult } from '../src/learning/schedule-policy.mjs';
const day = 86_400_000;
const ev = (id, at, fields = {}) => ({ id, key: 'd#1', sessionId: id, at, type: 'assessment', stage: 'initial', ok: true, firstAttempt: true, assisted: false, contentFingerprint: 'fp', ...fields });
const initial = ev('initial', 1000);
const delayed = ev('delayed', 1000 + 7 * 86_400_000, { stage: 'delayed' });
assert.deepEqual(mergeLearningEvidence([initial], [initial, delayed]).map((entry) => entry.id), ['initial', 'delayed']);
assert.equal(mergeLearningEvidence([initial], [{ ...initial, ok: false }])[0].ok, false);
const conflictingEventA = { ...initial, at: 1000, ok: true, assisted: false };
const conflictingEventB = { ...initial, at: 2000, ok: false, assisted: false };
assert.deepEqual(mergeLearningEvidence([conflictingEventA], [conflictingEventB]), mergeLearningEvidence([conflictingEventB], [conflictingEventA]),
  'same-ID conflicts must resolve identically regardless of replica order');
assert.equal(mergeLearningEvidence([conflictingEventA], [conflictingEventB])[0].ok, false,
  'a conflicting adverse event wins even when timestamps differ');
assert.equal(resolveLearningState({ stat: { learningV1: { evidence: [initial] } }, contentFingerprint: 'fp', now: delayed.at }).primary, 'initialPassed');
assert.equal(resolveLearningState({ stat: { learningV1: { evidence: [initial, delayed] } }, contentFingerprint: 'fp', now: delayed.at }).primary, 'mastered');
const failed = ev('failed', delayed.at + 10, { type: 'assessment', stage: 'maintenance', ok: false });
assert.equal(resolveLearningState({ stat: { learningV1: { evidence: [initial, delayed, failed] } }, contentFingerprint: 'fp', now: failed.at }).primary, 'reinforce');
assert.equal(resolveLearningState({ stat: { learningV1: { evidence: [initial, delayed] } }, familiarity: { markedAt: 10 }, contentFingerprint: 'fp', now: delayed.at }).familiar, true);
assert.equal(resolveLearningState({ stat: { learningV1: { evidence: [initial, delayed] } }, contentFingerprint: 'changed', now: delayed.at }).verifiedMastered, false);
assert.equal(applyLearningEvent({ version: 1, evidence: [initial] }, ev('practice', 2000, { type: 'practice' })).evidence.length, 2);
const failedSchedule = scheduleLearningResult({ interval: 180, repetition: 7, ease: 2.3, dueAt: delayed.at }, { ok: false }, {
  now: delayed.at + 1, srs: { recordResult: (card, ok, now) => ok
    ? { ...card, repetition: card.repetition + 1, interval: 60, dueAt: now + 60 * day }
    : { ...card, repetition: 0, interval: 1, ease: card.ease - 0.2, dueAt: now + day } },
});
assert.equal(failedSchedule.interval, 1);
assert.equal(failedSchedule.repetition, 0);
assert.equal(failedSchedule.dueAt, delayed.at + 1 + 10 * 60 * 1000);
let relearnedInterval = 0;
const relearnedSchedule = scheduleLearningResult(failedSchedule, { ok: true }, { now: failedSchedule.dueAt,
  srs: { recordResult: (card, ok, now) => { relearnedInterval = card.interval; return { ...card, repetition: card.repetition + 1, interval: 1, dueAt: now + day }; } } });
assert.equal(relearnedInterval, 1, 'successful relearning must resume from the first SRS interval');
assert.equal(relearnedSchedule.dueAt, failedSchedule.dueAt + day);
console.log('learning-state.test.mjs passed');
