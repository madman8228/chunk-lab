'use strict';
const assert = require('node:assert/strict');
const { identityForAttempt, deriveAbilityState } = require('./services/vocabulary-review-model');

const DAY = 86_400_000;
const base = { owner: 7, resourceId: 'wordbook:book-a', itemId: 'word:borrow', contentRevision: 'content-v1', practiceType: 'word-choice', practiceRevision: 'choice-v1' };
const event = (id, at, fields = {}) => ({ ...base, id, at, ...fields });

const firstIdentity = identityForAttempt(base);
assert.equal(identityForAttempt({ ...base, resourceId: 'wordbook:book-b' }) === firstIdentity, false, 'same item in another book has a separate identity');
assert.equal(identityForAttempt({ ...base, owner: 8 }) === firstIdentity, false, 'another account has a separate identity');
assert.equal(identityForAttempt({ ...base, practiceType: 'word-dictation' }) === firstIdentity, false, 'different practice abilities have separate identities');
assert.equal(identityForAttempt({ ...base, practiceRevision: 'choice-v2' }) === firstIdentity, false, 'changed practice content has a separate identity');
assert.equal(identityForAttempt({ ...base, contentRevision: 'content-v2' }) === firstIdentity, false, 'changed item content has a separate identity');
assert.equal(identityForAttempt({ ...base, practiceType: 'read-aloud' }), null, 'unverified read-aloud is not an automatic review ability');
assert.equal(identityForAttempt({ ...base, contentRevision: '' }), null, 'incomplete historical identity cannot seed ability state');

const mistakeAt = 1_800_000_000_000;
const afterMistake = deriveAbilityState([
  event('wrong-1', mistakeAt, { correct: false, sessionId: 'course-session' }),
], { now: mistakeAt + 600_000 });
assert.equal(afterMistake.dueAt, mistakeAt + 600_000, 'wrong answer schedules the existing 10-minute relearn delay');
assert.equal(afterMistake.status, 'needs-reinforcement');

const firstReviewAt = mistakeAt + DAY;
const sameDayReviewAt = firstReviewAt + 60_000;
const secondReviewAt = firstReviewAt + DAY;
const events = [
  event('wrong-1', mistakeAt, { correct: false, sessionId: 'course-session' }),
  event('review-1', firstReviewAt, { correct: true, firstAttempt: true, assisted: false, sessionId: 'review-session-1', reviewSessionId: 'review-session-1' }),
  event('review-1-again', sameDayReviewAt, { correct: true, firstAttempt: true, assisted: false, sessionId: 'review-session-2', reviewSessionId: 'review-session-2' }),
  event('review-2', secondReviewAt, { correct: true, firstAttempt: true, assisted: false, sessionId: 'review-session-3', reviewSessionId: 'review-session-3' }),
];
const consolidated = deriveAbilityState(events, { now: secondReviewAt + 1 });
assert.equal(consolidated.successDays, 2, 'same-day success cannot count twice');
assert.equal(consolidated.status, 'reinforced', 'two independent days consolidate the practice ability');
assert.equal(consolidated.dueAt, secondReviewAt + 3 * DAY, 'successful review advances the existing SRS interval sequence');

const reset = deriveAbilityState([...events, event('wrong-2', secondReviewAt + DAY, { correct: false, sessionId: 'review-session-4', reviewSessionId: 'review-session-4' })], { now: secondReviewAt + DAY + 1 });
assert.equal(reset.successDays, 0, 'a new wrong answer resets consecutive consolidation evidence');
assert.equal(reset.status, 'needs-reinforcement');

const assisted = deriveAbilityState([
  event('wrong-1', mistakeAt, { correct: false, sessionId: 'course-session' }),
  event('assisted-1', firstReviewAt, { correct: true, firstAttempt: true, assisted: true, sessionId: 'review-session-1', reviewSessionId: 'review-session-1' }),
], { now: firstReviewAt + 1 });
assert.equal(assisted.successDays, 0, 'assisted answers cannot consolidate');

console.log('Vocabulary review identity and policy: isolated abilities, relearn delay, cross-day consolidation, reset and assisted evidence passed.');
