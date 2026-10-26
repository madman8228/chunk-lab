import assert from 'node:assert/strict';
import { mixedReview } from './mixed-review-v3.mjs';
import { validatePreviewLesson, matchesTransfer } from './lessons-v3.mjs';
validatePreviewLesson(mixedReview);
assert.equal(mixedReview.review,true);
assert.equal(mixedReview.sequence.length,11);
assert.ok(!mixedReview.sequence.some(s=>s.type==='replace'));
for(const step of mixedReview.sequence.filter(s=>!s.type)) {
 assert.deepEqual(step.bankWordIds,step.wordIds);
 assert.equal(step.visual.show,'after-correct');
}
assert.deepEqual(mixedReview.sequence.filter(s=>s.type==='classify').map(s=>s.answer),['predicate','object','predicative','link','subject']);
const final=mixedReview.sequence.at(-1);
assert.equal(final.type,'transfer');
assert.ok(matchesTransfer(final,'You like tea.'));
assert.ok(!matchesTransfer(final,'You are like tea.'));
console.log('Mixed review checks passed');
