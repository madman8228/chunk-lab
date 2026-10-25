'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright-core');
const Database = require('../server/node_modules/better-sqlite3');

(async () => {
  const instance = await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);
  let browser;
  try {
    const token = instance.learnerToken;
    const identityDb = new Database(path.join(instance.dataDir, 'chunklab.db'), { readonly: true });
    const userId = identityDb.prepare('SELECT id FROM users WHERE username=?').get(instance.learnerUsername).id;
    identityDb.close();
    const send = (type, payload, requestId = crypto.randomUUID(), expectedRev) => instance.request('/api/operations', token,
      { protocol: 3, type, payload, requestId, ...(expectedRev === undefined ? {} : { expectedRev }) });
    const now = Date.now();

    const deckId = 'daily-review-sentence-e2e';
    const sentence = { cid: 'daily01', sentence: 'I need a little more time.', en: 'I need a little more time.',
      translation: '我还需要一点时间。', chunks: ['I need', 'a little more time.'], hints: ['', ''] };
    const key = deckId + '#' + sentence.cid;
    await send('deck.put', { deck: { id: deckId, name: '隔离混合复习句子', items: [sentence] } }, crypto.randomUUID(), null);
    await send('course.enrollment', { courseId: 'user-deck:' + deckId, joined: true });
    await send('learning.answer', { eventId: 'daily-review-sentence-error', key, deckId, ok: false,
      sessionId: 'daily-review-sentence-session', occurredAt: now - 40 * 60 * 1000,
      mode: 'chunkSelection', firstAttempt: true, assisted: false });

    const draft = structuredClone(instance.draft);
    draft.book.bookId = 'daily-review-cross-player-wordbook';
    draft.book.title = '隔离混合复习词书';
    const savedBook = await instance.request('/api/personal-wordbooks', token, { draft });
    const bookRoute = '/api/wordbooks/' + encodeURIComponent(savedBook.bookId);
    const bookPage = await instance.request(bookRoute + '/items', token);
    const wordRef = bookPage.items[0];
    const word = await instance.request('/api/vocabulary-items/' + encodeURIComponent(wordRef.itemId)
      + '?revision=' + encodeURIComponent(wordRef.contentRevision), token);
    const mode = 'word-choice';
    const ordinaryInitial = await instance.request(bookRoute + '/state?practiceType=' + mode, token);
    await send('vocabulary.session', { bookId: savedBook.bookId, bookRevision: bookPage.revision,
      itemId: wordRef.itemId, sessionId: 'daily-review-seed-session', practiceType: mode,
      action: 'start', expectedResumeRev: ordinaryInitial.resumeRev });
    const wrongOption = word.learning.wordChoice.options.find(option => option.id !== word.learning.wordChoice.correctOptionId);
    await send('vocabulary.attempt', { bookId: savedBook.bookId, bookRevision: bookPage.revision,
      itemId: wordRef.itemId, contentRevision: wordRef.contentRevision, sessionId: 'daily-review-seed-session', practiceType: mode,
      inputMode: 'choice', answers: { optionId: wrongOption.id } });

    // The isolated server owns its clock. Age only this synthetic fixture event so the public due-list API
    // exposes it immediately; no real account, course, or learning record is involved.
    const db = new Database(path.join(instance.dataDir, 'chunklab.db'));
    try {
      db.prepare('UPDATE vocabulary_attempt_events SET occurred_at=? WHERE user_id=? AND item_id=? AND resource_id=?')
        .run(now - 20 * 60 * 1000, userId, wordRef.itemId, 'wordbook:' + savedBook.bookId);
    } finally { db.close(); }
    const dueWords = await instance.request('/api/learning-archive/vocabulary/review?bookId='
      + encodeURIComponent(savedBook.bookId) + '&practiceType=' + mode + '&kind=due', token);
    assert.deepEqual(dueWords.items.map(item => item.itemId), [wordRef.itemId], 'the isolated seed word is confirmed due');
    const ordinaryBefore = await instance.request(bookRoute + '/state?practiceType=' + mode, token);

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ sessionToken, userId }) => {
      localStorage.setItem('chunklab_token', sessionToken);
      localStorage.setItem('chunklab_manual', '1');
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, String(userId)]));
    }, { sessionToken: token, userId });
    await page.goto(instance.base + '/main.html?view=stats&tab=overview', { waitUntil: 'domcontentloaded' });
    await page.locator('#studyArchiveContent .study-mixed-review').waitFor();
    await page.waitForFunction(bookId => !!document.querySelector('#studyArchiveContent .study-mixed-review select[aria-label="选择词书"] option[value="' + bookId + '"]'), savedBook.bookId);
    const screenshots = path.resolve(__dirname, '..', 'output', 'playwright');
    fs.mkdirSync(screenshots, { recursive: true });
    for (const width of [390, 876]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('#studyArchiveContent .study-mixed-review');
        const button = Array.from(panel.querySelectorAll('button')).find(item => item.textContent.includes('开始今日混合复习'));
        const panelRect = panel.getBoundingClientRect(), buttonRect = button.getBoundingClientRect();
        return { viewport: innerWidth, document: document.documentElement.scrollWidth,
          panelLeft: panelRect.left, panelRight: panelRect.right,
          buttonLeft: buttonRect.left, buttonRight: buttonRect.right,
          gardenPosition: getComputedStyle(document.querySelector('.home-garden')).position };
      });
      assert.ok(layout.document <= width, `${width}px review overview has no horizontal page overflow: ${JSON.stringify(layout)}`);
      assert.ok(layout.panelLeft >= 0 && layout.panelRight <= width, `${width}px mixed-review panel stays in viewport: ${JSON.stringify(layout)}`);
      assert.ok(layout.buttonLeft >= 0 && layout.buttonRight <= width, `${width}px launch button stays in viewport: ${JSON.stringify(layout)}`);
      assert.equal(layout.gardenPosition, 'absolute', `${width}px archive scenery stays at the end of the document, not over viewport content`);
      await page.screenshot({ path: path.join(screenshots, `daily-review-overview-${width}.png`) });
    }
    await page.locator('#studyArchiveContent .study-mixed-review button').filter({ hasText: '开始今日混合复习' }).click();
    try { await page.waitForURL(/main\.html\?autostart=1&reviewHandoff=.*dailyReviewSession=/, { timeout: 5000 }); }
    catch (error) {
      console.error('mixed launcher diagnostics:', await page.locator('#studyArchiveContent .study-mixed-review').innerText(),
        await page.locator('#studyArchiveContent .study-mixed-review button').evaluateAll(buttons => buttons.map(button => ({ text: button.textContent, disabled: button.disabled }))));
      throw error;
    }
    await page.waitForFunction(expectedDeckId => window.S?.deck?.items?.length === 1
      && window.S.deck.items[0]._statsDeckId === expectedDeckId,
    deckId);
    const sentenceQueue = await instance.request('/api/learning-archive/daily-review-sessions/'
      + new URL(page.url()).searchParams.get('dailyReviewSession'), token);
    assert.deepEqual(sentenceQueue.items.map(item => item.type), ['sentence', 'vocabulary']);
    assert.equal(sentenceQueue.childSession.type, 'sentence');

    for (let attempt = 0; attempt < 8; attempt++) {
      await page.waitForFunction(() => window.S?.finished === true
        || !!document.querySelector('#stageChoices .choice:not([hidden])'));
      if (await page.evaluate(() => window.S?.finished === true)) break;
      await page.evaluate(() => {
        const expected = S.items[S.idx].chunks[S.chunkIdx];
        const choice = Array.from(document.querySelectorAll('#stageChoices .choice'))
          .find(button => !button.hidden && button.dataset.v === expected);
        if (!choice) throw new Error('the expected sentence chunk is not available');
        choice.click();
      });
    }
    await page.waitForFunction(() => window.S?.finished === true);
    await page.locator('#btnContinueDailyReview').click();
    try { await page.waitForURL(url => /wordbook\.html/.test(url.pathname) && url.searchParams.has('reviewSession'), { timeout: 8000 }); }
    catch (error) {
      const queueId = new URL(page.url()).searchParams.get('dailyReviewSession');
      console.error('sentence-to-word handoff diagnostics:', { url: page.url(),
        body: (await page.locator('body').innerText()).slice(-700),
        queue: queueId && await instance.request('/api/learning-archive/daily-review-sessions/' + queueId, token) });
      throw error;
    }

    const parentId = new URL(page.url()).searchParams.get('returnTo');
    const reviewSessionId = new URL(page.url()).searchParams.get('reviewSession');
    const childState = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + reviewSessionId, token);
    assert.equal(childState.status, 'in-progress');
    assert.deepEqual(childState.queue.map(row => row.itemId), [wordRef.itemId]);
    const activeQueueId = new URLSearchParams(parentId).get('dailyReview');
    assert.ok(activeQueueId, 'the word player carries a return link to its parent queue');
    const parentState = await instance.request('/api/learning-archive/daily-review-sessions/' + activeQueueId, token);
    assert.equal(parentState.index, 1);
    assert.equal(parentState.childSession.type, 'vocabulary');

    try { await page.getByRole('button', { name: '结束并返回' }).click({ timeout: 5000 }); }
    catch (error) {
      console.error('wordbook child diagnostics:', { url: page.url(), body: (await page.locator('body').innerText()).slice(-1200), errors });
      throw error;
    }
    await page.waitForURL(/main\.html\?view=stats&tab=overview&dailyReview=/);
    await page.waitForURL(url => /wordbook\.html/.test(url.pathname) && url.searchParams.has('reviewSession'));
    const resumedChild = await instance.request('/api/learning-archive/vocabulary/review-sessions/' + reviewSessionId, token);
    assert.equal(resumedChild.status, 'in-progress', 'returning from the paused word child resumes the same session');
    assert.deepEqual(resumedChild.queue.map(row => row.itemId), [wordRef.itemId]);
    assert.deepEqual(await instance.request(bookRoute + '/state?practiceType=' + mode, token), ordinaryBefore,
      'the mixed queue and child pause/resume leave ordinary wordbook progress unchanged');
    assert.deepEqual(errors, [], 'the real browser-to-isolated-service flow has no uncaught page errors');
    console.log('Daily mixed review E2E: real stats launch, persisted sentence group, vocabulary handoff, pause/resume and unchanged ordinary progress passed.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await instance.close();
    if (path.dirname(instance.temp) === os.tmpdir() && path.basename(instance.temp).startsWith('wordbook-acceptance-')) {
      fs.rmSync(instance.temp, { recursive: true, force: true });
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
