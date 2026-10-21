import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildProtectedHistoryDecks } from './history-index.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const id = 'protected_' + digest(JSON.stringify(['course', 'unit']));
const stats = { [id + '#item-2']: { times: 3, deckId: id,learningV1:{evidence:[{type:'assessment',at:1,stage:'initial',ok:true}]} },
  'protected_missing#old': { times: 1, sentence: 'User owned history' }, 'personal#one': { times: 4 } };
const original = JSON.stringify(stats);
const result = await buildProtectedHistoryDecks({ courses: [{ courseId: 'course', title: '课程名', units: [{ unitId: 'unit' }] }], stats, digest });
assert.equal(result.length, 2);
assert.equal(result[0].id, id);
assert.match(result[0].items[0]._protectedReviewUrl, /reviewItem=item-2/);
assert.equal(result[0].items[0].chunks, undefined);
assert.match(result[0].items[0]._protectedAssessmentHistory,/初测通过/);
assert.match(result[0].items[0]._protectedAssessmentUrl,/assessmentItem=item-2/);
assert.equal(result[1].items[0].sentence, 'User owned history');
assert.equal(result[1].items[0]._protectedReviewUrl, undefined);
assert.equal(JSON.stringify(stats), original);
assert.deepEqual(await buildProtectedHistoryDecks({ courses: [], stats: {}, digest }), []);
const legacy = await buildProtectedHistoryDecks({ courses: [{ courseId: 'legacy', title: '原课程', units: [{ unitId: 'lesson', recordIdentity: { deckId: 'original-deck' } }] }],
  stats: { 'original-deck#original-item': { times: 2 }, 'personal#one': { times: 4 } }, digest });
assert.equal(legacy.length, 1); assert.equal(legacy[0].id, 'original-deck'); assert.match(legacy[0].items[0]._protectedReviewUrl, /protectedCourse=legacy/);
console.log('protected history: metadata join, stable identity, retained orphan facts, no lesson body or mutation passed');
