import assert from 'node:assert/strict';
import { projectArchiveState, projectArchiveClassification, masteryConfirmation } from './archive-state.mjs';
const now = 10 * 86400000;
const assisted = { lastAt: 1000, dueAt: 2000, assistedCompletions: 2, mastered: false };
const original = JSON.stringify(assisted);
assert.equal(projectArchiveState({ source: 'vocabulary-book', progress: assisted, now }).state, 'learning');
assert.equal(projectArchiveState({ source: 'vocabulary-book', progress: { ...assisted, mastered: true }, now }).verifiedMastered, false);
assert.equal(projectArchiveState({ source: 'vocabulary-pilot', progress: { ...assisted, mastered: true }, now }).evidenceScope, 'word-recall');
const self = projectArchiveState({ source: 'vocabulary-book', progress: assisted, selfAssessment: { value: 'mastered' }, now });
assert.equal(self.state, 'self-mastered');
assert.equal(self.verifiedMastered, false);
assert.equal(self.due, true, 'self-mark cannot cancel review');
assert.equal(JSON.stringify(assisted), original, 'projection preserves source records');
assert.equal(projectArchiveState({ source: 'sentence', familiarity: { markedAt: 1000 }, now }).state, 'familiar');
assert.equal(projectArchiveState({ source: 'sentence', selfAssessment: { value: 'mastered', revoked: true }, now }).state, 'new');
const evidence = [
  { id: 'initial', at: 1000, type: 'assessment', stage: 'initial', sessionId: 'one', ok: true, firstAttempt: true, assisted: false, contentFingerprint: 'v1' },
  { id: 'delayed', at: 8 * 86400000, type: 'assessment', stage: 'delayed', sessionId: 'two', ok: true, firstAttempt: true, assisted: false, contentFingerprint: 'v1' },
];
const sentence = { source: 'sentence', stat: { learningV1: { evidence } }, contentFingerprint: 'v1', now };
assert.equal(projectArchiveState(sentence).legacyVerified, true);
assert.equal(projectArchiveState(sentence).verifiedMastered, false, 'old recall is not application mastery');
assert.equal(projectArchiveState({ ...sentence, contentFingerprint: 'v2' }).legacyVerified, false);
assert.equal(projectArchiveState({ ...sentence, stat: { learningV1: { evidence: [...evidence,
  { id: 'failed', at: 9 * 86400000, type: 'assessment', ok: false, contentFingerprint: 'v1' }] } } }).state, 'reinforce');
assert.equal(projectArchiveState({ source: 'unsupported' }).verifiedMastered, null, 'unavailable is not zero');
const resource = { title: '三年级雅思图文', kind: 'course', courseFormat: 'illustrated',
  knowledgeCategories: ['vocabulary', 'expression'], facets: { grades: ['三年级'], exams: ['雅思'], edition: '2024' } };
const classified = projectArchiveClassification(resource);
assert.deepEqual(classified.knowledgeCategories, ['vocabulary', 'expression']);
assert.deepEqual(classified.levels, []);
assert.deepEqual(projectArchiveClassification({ title: resource.title }).knowledgeCategories, []);
assert.equal(masteryConfirmation().assessmentAvailable, false);
assert.equal(masteryConfirmation({ assessmentAvailable: true }).assessmentAvailable, true);
console.log('archive state: legacy evidence, self assessment, review and orthogonal classifications passed');
