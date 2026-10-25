'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

(async () => {
  const instance = await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);
  try {
    const token = instance.learnerToken;
    const bookRoute = '/api/wordbooks/' + encodeURIComponent(instance.courseId);
    const page = await instance.request(bookRoute + '/items', token);
    const ref = page.items[0];
    const item = await instance.request('/api/vocabulary-items/' + encodeURIComponent(ref.itemId) + '?revision=' + ref.contentRevision, token);
    const mode = 'word-choice';
    const state = await instance.request(bookRoute + '/state?practiceType=' + mode, token);
    const regularStart = { bookId: instance.courseId, bookRevision: page.revision, itemId: ref.itemId,
      sessionId: 'targeted-review-regular', practiceType: mode, action: 'start', expectedResumeRev: state.resumeRev };
    const send = (type, payload, requestId = crypto.randomUUID()) => instance.request('/api/operations', token,
      { protocol: 3, type, payload, requestId });
    await send('vocabulary.session', regularStart);
    const wrongOption = item.learning.wordChoice.options.find(option => option.id !== item.learning.wordChoice.correctOptionId);
    await send('vocabulary.attempt', { bookId: instance.courseId, bookRevision: page.revision, itemId: ref.itemId,
      contentRevision: ref.contentRevision, sessionId: regularStart.sessionId, practiceType: mode,
      inputMode: 'choice', answers: { optionId: wrongOption.id } });
    const ordinaryAfterAttempt = await instance.request(bookRoute + '/state?practiceType=' + mode, token);

    const clozeStart = { ...regularStart, sessionId: 'targeted-review-cloze', practiceType: 'sentence-cloze', expectedResumeRev: 0 };
    await send('vocabulary.session', clozeStart);
    const wrongCloze = Object.fromEntries(item.exercise.parts.filter(part => part.id).map(part => [part.id, 'not-the-answer']));
    await send('vocabulary.attempt', { bookId: instance.courseId, bookRevision: page.revision, itemId: ref.itemId,
      contentRevision: ref.contentRevision, sessionId: clozeStart.sessionId, practiceType: 'sentence-cloze',
      inputMode: 'typing', answers: wrongCloze });

    const secondDraft = structuredClone(instance.draft);
    secondDraft.book.bookId = 'acceptance-second-wordbook';
    secondDraft.book.title = '第二本隔离验收词书';
    const secondSaved = await instance.request('/api/personal-wordbooks', token, { draft: secondDraft });
    const secondBookRoute = '/api/wordbooks/' + encodeURIComponent(secondSaved.bookId);
    const secondPage = await instance.request(secondBookRoute + '/items', token);
    const secondRef = secondPage.items[0];
    const secondItem = await instance.request('/api/vocabulary-items/' + encodeURIComponent(secondRef.itemId)
      + '?revision=' + secondRef.contentRevision, token);
    const secondWrongOption = secondItem.learning.wordChoice.options.find(option => option.id !== secondItem.learning.wordChoice.correctOptionId);
    const secondRegularStart = { bookId: secondSaved.bookId, bookRevision: secondPage.revision, itemId: secondRef.itemId,
      sessionId: 'targeted-review-second-book', practiceType: mode, action: 'start', expectedResumeRev: 0 };
    await send('vocabulary.session', secondRegularStart);
    await send('vocabulary.attempt', { bookId: secondSaved.bookId, bookRevision: secondPage.revision, itemId: secondRef.itemId,
      contentRevision: secondRef.contentRevision, sessionId: secondRegularStart.sessionId, practiceType: mode,
      inputMode: 'choice', answers: { optionId: secondWrongOption.id } });
    const secondBookWrong = await instance.request('/api/learning-archive/vocabulary/review?bookId='
      + encodeURIComponent(secondSaved.bookId) + '&practiceType=' + mode + '&kind=wrong', token);
    assert.deepEqual(secondBookWrong.items.map(row => row.itemId), [secondRef.itemId],
      'the second book exposes only its own practice evidence');

    const secondReviewSessionId = 'targeted-review-second-session';
    await send('vocabulary.review.session', { action: 'start', sessionId: secondReviewSessionId,
      bookId: secondSaved.bookId, bookRevision: secondPage.revision, practiceType: mode, kind: 'wrong', expectedSessionRev: 0 });
    const appendedDraft = structuredClone(secondDraft);
    appendedDraft.book.units.push({ unitId: 'acceptance-appended-unit', title: '追加验收单元' });
    appendedDraft.items.push({ ...structuredClone(appendedDraft.items[0]), itemId: 'acceptance-appended-item', unitId: 'acceptance-appended-unit' });
    await instance.request('/api/personal-wordbooks', token, { draft: appendedDraft, baseRevision: secondSaved.revision });
    const staleAfterContentAppend = await instance.request('/api/learning-archive/vocabulary/review-sessions/'
      + secondReviewSessionId, token);
    assert.equal(staleAfterContentAppend.status, 'stale', 'a real append-only book revision invalidates its old targeted queue');

    const ordinaryDefaultAfterAttempt = await instance.request(bookRoute + '/state', token);
    const byAbility = await instance.request('/api/learning-archive/vocabulary/review?bookId=' + encodeURIComponent(instance.courseId) + '&kind=wrong', token);
    assert.equal(byAbility.items.filter(row => row.itemId === ref.itemId).length, 2,
      'the same word appears as two independent review abilities when two exercise types were missed');
    assert.deepEqual(new Set(byAbility.items.map(row => row.practiceType)), new Set(['word-choice', 'sentence-cloze']));

    const query = '?bookId=' + encodeURIComponent(instance.courseId) + '&practiceType=' + mode;
    const review = await instance.request('/api/learning-archive/vocabulary/review' + query + '&kind=wrong', token);
    assert.equal(review.confirmed, true);
    assert.equal(review.items.length, 1);
    assert.equal(review.items[0].itemId, ref.itemId);
    assert.equal(review.items[0].practiceType, mode);
    assert.equal(review.items[0].state.status, 'needs-reinforcement');
    assert.equal(review.items[0].state.due, false, 'a new mistake is visible immediately but waits for the relearn delay');
    const otherReview = await instance.request('/api/learning-archive/vocabulary/review' + query + '&kind=wrong', instance.otherToken);
    assert.equal(otherReview.items.length, 0, 'another account cannot see the learner review queue');

    const reviewSessionId = 'targeted-review-session-01';
    const started = await send('vocabulary.review.session', { action: 'start', sessionId: reviewSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, kind: 'wrong', expectedSessionRev: 0,
      itemIds: [ref.itemId] });
    assert.equal(started.operation.action, 'start');
    const reviewState = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + reviewSessionId, token);
    assert.equal(reviewState.status, 'in-progress');
    assert.deepEqual(reviewState.queue.map(row => row.itemId), [ref.itemId]);

    const pauseSessionId = 'targeted-review-pause-resume';
    await send('vocabulary.review.session', { action: 'start', sessionId: pauseSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, kind: 'wrong', expectedSessionRev: 0,
      itemIds: [ref.itemId] });
    await send('vocabulary.review.session', { action: 'pause', sessionId: pauseSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, expectedSessionRev: 1 });
    const pausedState = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + pauseSessionId, token);
    assert.equal(pausedState.status, 'paused', 'leaving a mixed-review vocabulary child preserves its session');
    await send('vocabulary.review.session', { action: 'resume', sessionId: pauseSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, expectedSessionRev: pausedState.revision });
    const resumedState = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + pauseSessionId, token);
    assert.equal(resumedState.status, 'in-progress', 'returning to the queue resumes the same vocabulary child');
    assert.deepEqual(resumedState.queue.map(row => row.itemId), [ref.itemId]);
    assert.deepEqual(await instance.request(bookRoute + '/state?practiceType=' + mode, token), ordinaryAfterAttempt,
      'pause and resume do not move the ordinary course cursor or progress');

    const answer = { sessionId: reviewSessionId, bookId: instance.courseId, bookRevision: page.revision,
      itemId: ref.itemId, contentRevision: ref.contentRevision, practiceType: mode,
      inputMode: 'choice', answers: { optionId: wrongOption.id }, expectedIndex: 0, timeZone: 'America/Los_Angeles' };
    const reviewWrong = await send('vocabulary.review.attempt', answer);
    assert.equal(reviewWrong.operation.correct, false);
    const afterWrong = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + reviewSessionId, token);
    assert.equal(afterWrong.index, 0, 'a wrong answer leaves the current queue item available for retry');
    const answerId = crypto.randomUUID();
    answer.answers = { optionId: item.learning.wordChoice.correctOptionId };
    const first = await send('vocabulary.review.attempt', answer, answerId);
    const replay = await send('vocabulary.review.attempt', answer, answerId);
    assert.equal(first.operation.correct, true);
    assert.equal(first.operation.completion, false);
    assert.equal(first.seq, replay.seq, 'same operation ID replays without duplicate answer evidence');
    const afterReview = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + reviewSessionId, token);
    assert.equal(afterReview.status, 'completed');

    const staleSessionId = 'targeted-review-stale-02';
    await send('vocabulary.review.session', { action: 'start', sessionId: staleSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, kind: 'wrong', expectedSessionRev: 0 });
    const db = new (require('../server/node_modules/better-sqlite3'))(require('node:path').join(instance.dataDir, 'chunklab.db'));
    try {
      const stored = db.prepare("SELECT user_id,data_json FROM user_entity_rows WHERE kind='vocabularyReviewSession' AND item_key=?").get(staleSessionId);
      const staleValue = JSON.parse(stored.data_json); staleValue.bookRevision = 'stale-course-revision';
      db.prepare("UPDATE user_entity_rows SET data_json=? WHERE user_id=? AND kind='vocabularyReviewSession' AND item_key=?")
        .run(JSON.stringify(staleValue), stored.user_id, staleSessionId);
    } finally { db.close(); }
    const staleRead = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + staleSessionId, token);
    assert.equal(staleRead.status, 'stale', 'refresh detects a changed resource revision without silently replacing the queue');
    const staleItemSessionId = 'targeted-review-item-stale-04';
    await send('vocabulary.review.session', { action: 'start', sessionId: staleItemSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, kind: 'wrong', expectedSessionRev: 0 });
    const itemDb = new (require('../server/node_modules/better-sqlite3'))(require('node:path').join(instance.dataDir, 'chunklab.db'));
    try {
      const itemSession = itemDb.prepare("SELECT user_id,data_json FROM user_entity_rows WHERE kind='vocabularyReviewSession' AND item_key=?").get(staleItemSessionId);
      const itemSessionValue = JSON.parse(itemSession.data_json);
      itemSessionValue.queue[0].contentRevision = 'stale-item-revision';
      itemDb.prepare("UPDATE user_entity_rows SET data_json=? WHERE user_id=? AND kind='vocabularyReviewSession' AND item_key=?")
        .run(JSON.stringify(itemSessionValue), itemSession.user_id, staleItemSessionId);
    } finally { itemDb.close(); }
    const staleItemRead = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + staleItemSessionId, token);
    assert.equal(staleItemRead.status, 'stale', 'refresh rejects a queue item whose content revision no longer matches');
    const finishSessionId = 'targeted-review-finish-03';
    await send('vocabulary.review.session', { action: 'start', sessionId: finishSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, kind: 'wrong', expectedSessionRev: 0 });
    await send('vocabulary.review.session', { action: 'finish', sessionId: finishSessionId,
      bookId: instance.courseId, bookRevision: page.revision, practiceType: mode, expectedSessionRev: 1 });
    assert.equal((await instance.request('/api/learning-archive/vocabulary/review-sessions/' + finishSessionId, token)).status, 'completed');

    const sameOwnerState = await instance.request(bookRoute + '/state?practiceType=' + mode, token);
    const defaultAfterReview = await instance.request(bookRoute + '/state', token);
    assert.deepEqual(sameOwnerState.resume, ordinaryAfterAttempt.resume,
      'targeted practice leaves the separate ordinary practice cursor unchanged');
    assert.deepEqual(defaultAfterReview.resume, ordinaryDefaultAfterAttempt.resume,
      'targeted review leaves the default practice cursor unchanged');
    const otherResponse = await fetch(instance.base + '/api/learning-archive/vocabulary/review-sessions/' + reviewSessionId,
      { headers: { authorization: 'Bearer ' + instance.otherToken } });
    assert.equal(otherResponse.status, 404, 'another account cannot read this review session');

    const auditDb = new (require('../server/node_modules/better-sqlite3'))(require('node:path').join(instance.dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(auditDb.prepare('SELECT COUNT(*) AS n FROM vocabulary_attempt_events').get().n, 5);
      assert.equal(auditDb.prepare('SELECT COUNT(*) AS n FROM vocabulary_study_events').get().n, 0);
      assert.equal(auditDb.prepare('SELECT COUNT(*) AS n FROM vocabulary_item_progress').get().n, 0);
      const reviewEvent = JSON.parse(auditDb.prepare('SELECT data_json FROM vocabulary_attempt_events WHERE attempt_id=?').get(answerId).data_json);
      assert.equal(reviewEvent.reviewSessionId, reviewSessionId);
      assert.equal(reviewEvent.practiceRevision, item.learning.wordChoice.revision);
      assert.equal(reviewEvent.timeZone, 'America/Los_Angeles');
      assert.equal(reviewEvent.firstAttempt, false, 'correct retry after a mistake is not counted as first-try consolidation');
    } finally { auditDb.close(); }

    console.log('Targeted review HTTP: owner-scoped due/wrong list, independent session, server judgement, idempotent replay, unchanged course cursor/progress passed.');
  } finally { await instance.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
