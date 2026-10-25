'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

(async () => {
  const instance = await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);
  try {
    const send = (token, payload, requestId = crypto.randomUUID()) => instance.request('/api/operations', token,
      { protocol: 3, type: 'daily-review.session', payload, requestId });
    const sessionId = 'daily-review-session-0001';
    const now = Date.now();
    const input = [
      { type: 'vocabulary', key: 'book-a#word-2#word-choice', dueAt: now - 2000,
        reference: { bookId: 'book-a', bookRevision: 'rev-a', itemId: 'word-2', contentRevision: 'item-r2', practiceType: 'word-choice' } },
      { type: 'sentence', key: 'deck-a#sentence-1', dueAt: now - 5000,
        reference: { deckId: 'deck-a', cid: 'sentence-1' } },
      { type: 'sentence', key: 'deck-a#sentence-1', dueAt: now - 5000,
        reference: { deckId: 'deck-a', cid: 'sentence-1' } },
      { type: 'sentence', key: 'deck-a#future', dueAt: now + 60_000,
        reference: { deckId: 'deck-a', cid: 'future' } },
      ...Array.from({ length: 10 }, (_, index) => ({ type: 'sentence', key: `deck-b#sentence-${index}`,
        dueAt: now - 1000 + index, reference: { deckId: 'deck-b', cid: `sentence-${index}` } })),
    ];
    const courseRoute = '/api/wordbooks/' + encodeURIComponent(instance.courseId) + '/state';
    const ordinaryBefore = await instance.request(courseRoute, instance.learnerToken);
    const started = await send(instance.learnerToken, { action: 'start', sessionId, items: input, expectedRevision: 0 });
    assert.equal(started.operation.status, 'in-progress');
    const state = await instance.request('/api/learning-archive/daily-review-sessions/' + sessionId, instance.learnerToken);
    assert.equal(state.confirmed, true);
    assert.equal(state.items.length, 10, 'the server caps one daily queue at ten unique, currently due items');
    assert.deepEqual(state.items.slice(0, 2).map(item => item.key), ['deck-a#sentence-1', 'book-a#word-2#word-choice'],
      'the mixed queue is ordered by due time and duplicate items collapse');
    assert.ok(state.items.every(item => item.dueAt <= now), 'not-yet-due mistakes do not enter the daily queue');
    assert.deepEqual(await instance.request(courseRoute, instance.learnerToken), ordinaryBefore,
      'creating a daily queue does not move ordinary course progress');

    const handoffSessionId = 'daily-review-session-handoff';
    await send(instance.learnerToken, { action: 'start', sessionId: handoffSessionId,
      items: [
        { type: 'sentence', key: 'deck-c#sentence-1', dueAt: now - 4000,
          reference: { deckId: 'deck-c', cid: 'sentence-1' } },
        { type: 'vocabulary', key: 'book-a#word-3#word-choice', dueAt: now - 3000,
          reference: { bookId: 'book-a', bookRevision: 'rev-a', itemId: 'word-3', contentRevision: 'item-r3', practiceType: 'word-choice' } },
      ], expectedRevision: 0 });
    const handoffState = await instance.request('/api/learning-archive/daily-review-sessions/' + handoffSessionId, instance.learnerToken);
    const completedSentence = { sessionId: 'sentence-child-session-0001', type: 'sentence', index: 1,
      total: 1, endIndex: 1, status: 'completed' };
    await send(instance.learnerToken, { action: 'progress', sessionId: handoffSessionId,
      expectedRevision: handoffState.revision, index: 1, childSession: completedSentence });
    const afterHandoff = await instance.request('/api/learning-archive/daily-review-sessions/' + handoffSessionId, instance.learnerToken);
    assert.equal(afterHandoff.index, 1, 'a completed sentence group advances the parent cursor to the next item');
    assert.deepEqual(afterHandoff.childSession, completedSentence, 'the completed child remains persisted across the handoff');
    assert.equal(afterHandoff.items[afterHandoff.index].type, 'vocabulary', 'the next mixed item is ready for the word player');

    const child = { sessionId: 'vocabulary-child-session-0001', type: 'vocabulary', index: 1, total: 3,
      endIndex: 2, status: 'in-progress' };
    await send(instance.learnerToken, { action: 'progress', sessionId, expectedRevision: state.revision,
      index: 1, childSession: child });
    const resumed = await instance.request('/api/learning-archive/daily-review-sessions/' + sessionId, instance.learnerToken);
    assert.equal(resumed.index, 1);
    assert.deepEqual(resumed.childSession, child, 'the parent restores the active child session position');
    await assert.rejects(() => send(instance.learnerToken, { action: 'progress', sessionId,
      expectedRevision: state.revision, index: 2, childSession: child }), /今日复习进度已变化/,
    'a stale parent revision cannot overwrite newer progress');
    const hiddenFromOtherAccount = await fetch(instance.base + '/api/learning-archive/daily-review-sessions/' + sessionId,
      { headers: { authorization: 'Bearer ' + instance.otherToken } });
    assert.equal(hiddenFromOtherAccount.status, 404, 'another account cannot read this parent queue');
  } finally {
    await instance.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
