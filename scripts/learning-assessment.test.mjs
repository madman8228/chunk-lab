import assert from 'node:assert/strict';
import { resolveLearningState } from '../src/learning/state.mjs';
import { createAssessmentSession, finalizeAssessment, fingerprintAssessmentItem, getAssessmentEligibility, submitAssessmentAnswer } from '../src/learning/assessment.mjs';
const day = 86_400_000;
const item = { key: 'd#1', zh: '你好', chunks: ['hello', 'there'], alts: [[], ['friend']], stat: { lastAt: 1000, learningV1: { lastExposureAt: 1000, evidence: [] } } };
assert.equal(fingerprintAssessmentItem(item), fingerprintAssessmentItem({ ...item, image: 'different' }));
assert.equal(getAssessmentEligibility(item, { now: 1000 + day - 1 }).eligible, false);
assert.equal(getAssessmentEligibility(item, { now: 1000 + day }).eligible, true);
const failedInitialAt = 1000 + day + 500;
const failedInitial = { ...item, stat: { lastAt: failedInitialAt, learningV1: { lastExposureAt: 1000, evidence: [
  { id: 'initial-fail', key: item.key, at: failedInitialAt, type: 'assessment', stage: 'initial', ok: false, assisted: false, contentFingerprint: fingerprintAssessmentItem(item) },
] } } };
assert.equal(getAssessmentEligibility(failedInitial, { now: failedInitialAt + day - 1 }).eligible, false,
  'an initial assessment failure must not be immediately repeatable');
assert.equal(getAssessmentEligibility(failedInitial, { now: failedInitialAt + day }).stage, 'initial');
const session = createAssessmentSession([item], { now: 1000 + day, makeId: () => 's1' });
const submitted = submitAssessmentAnswer(session, 0, ['hello', 'FRIEND']);
assert.equal(submitAssessmentAnswer(submitted, 0, ['wrong', 'wrong']), submitted);
const completed = finalizeAssessment(submitted, { now: 1000 + day + 1, makeId: () => 'event-1' });
assert.equal(completed.passed, true);
assert.equal(completed.events[0].stage, 'initial');
const withInitialPass = { ...item, stat: { ...item.stat, lastAt: 1000, learningV1: { ...item.stat.learningV1, evidence: completed.events } } };
assert.equal(getAssessmentEligibility(withInitialPass, { now: 1000 + day + 7 * day }).eligible, false);
assert.equal(getAssessmentEligibility(withInitialPass, { now: 1000 + day + 7 * day + 1 }).stage, 'delayed');
const practiceFailureAt = 1000 + day + 2 * day;
const practiceFailedAfterInitial = { ...withInitialPass, stat: { ...withInitialPass.stat, lastAt: practiceFailureAt,
  learningV1: { ...withInitialPass.stat.learningV1, lastExposureAt: practiceFailureAt,
    evidence: completed.events.concat({ id: 'practice-fail', key: item.key, at: practiceFailureAt, type: 'practice', ok: false, assisted: false, contentFingerprint: fingerprintAssessmentItem(item) }) } } };
const eligibilityAfterPracticeFailure = getAssessmentEligibility(practiceFailedAfterInitial, { now: practiceFailureAt + day - 1 });
assert.equal(eligibilityAfterPracticeFailure.stage, 'initial', 'practice failure after initial pass must restart initial assessment');
assert.equal(eligibilityAfterPracticeFailure.eligible, false, 'the failed sentence needs a fresh 24-hour exposure gap');
const assistedAfterInitial = { ...practiceFailedAfterInitial, stat: { ...practiceFailedAfterInitial.stat,
  learningV1: { ...practiceFailedAfterInitial.stat.learningV1, evidence: completed.events.concat({ id: 'assisted', key: item.key,
    at: practiceFailureAt, type: 'practice', ok: true, assisted: true, contentFingerprint: fingerprintAssessmentItem(item) }) } } };
assert.equal(getAssessmentEligibility(assistedAfterInitial, { now: practiceFailureAt + 2 * day }).stage, 'initial',
  'answer-assisted practice after an initial pass must restart the initial assessment');
const delayed = createAssessmentSession([withInitialPass], { now: 1000 + day + 7 * day + 1, makeId: () => 's3' });
const delayedDone = finalizeAssessment(submitAssessmentAnswer(delayed, 0, ['hello', 'there']), { now: 1000 + day + 7 * day + 2, makeId: () => 'event-2' });
const state = resolveLearningState({ stat: { learningV1: { evidence: completed.events.concat(delayedDone.events) } }, contentFingerprint: fingerprintAssessmentItem(item), now: 1000 + day + 8 * day });
assert.equal(state.verifiedMastered, true);
assert.equal(fingerprintAssessmentItem(item), fingerprintAssessmentItem({ ...item, translation: '你好', zh: undefined }));
const hydrated = { ...item, cid:'cid-1', _contentRef:{url:'content/deck/shard-a8f4.json',offset:10} };
assert.equal(fingerprintAssessmentItem(hydrated),fingerprintAssessmentItem({cid:'cid-1',_contentRef:{url:'content/deck/shard-a8f4.json',offset:10},translation:'我喜欢别的',chunks:[]}),'index and full content must share a release fingerprint');
assert.notEqual(fingerprintAssessmentItem(hydrated),fingerprintAssessmentItem({...hydrated,_contentRef:{url:'content/deck/shard-c202.json',offset:10}}),'edited content shard must invalidate old proof');
const incomplete = createAssessmentSession([item], { now: 1000 + day, makeId: () => 's2' });
assert.throws(() => finalizeAssessment(incomplete, { now: 1000 + day + 1, makeId: () => 'event-2' }), /all items/);
console.log('learning-assessment.test.mjs passed');
