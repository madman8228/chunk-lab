'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');
const Database = require('../server/node_modules/better-sqlite3');
const learningEngine = require('../js/learning-engine.cjs');
const srs = require('../srs.js');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(15800, 100);
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-review-loop-'));
const username = `review-${randomBytes(5).toString('hex')}`;
const secondUsername = `review-other-${randomBytes(5).toString('hex')}`;
const thirdUsername = `review-unconfirmed-${randomBytes(5).toString('hex')}`;
const password = 'review-loop-isolated-test-password';
let server;
let browser;

async function waitHealthy() {
  for (let attempt = 0; attempt < 300; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated review server did not start');
}

async function operation(token, requestId, type, payload, expectedRev) {
  const response = await fetch(`${base}/api/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ protocol: 3, requestId, type, payload, ...(expectedRev !== undefined ? { expectedRev } : {}) }),
  });
  assert.equal(response.ok, true, `${type} seed operation failed: ${response.status} ${await response.text()}`);
}

async function accountData(token) {
  const response = await fetch(`${base}/api/data`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.ok, true, `isolated account snapshot failed: ${response.status}`);
  return response.json();
}

function seedFormalMasteryAfterOriginalMistake(userId, key, item) {
  const db = new Database(path.join(dataDir, 'chunklab.db'));
  try {
    const events = db.prepare('SELECT event_id,event_json FROM user_learning_events WHERE user_id=? AND sentence_key=? ORDER BY received_at,event_id')
      .all(userId, key).map(row => ({ eventId: row.event_id, ...JSON.parse(row.event_json) }));
    const priorMistakes = events.filter(event => event.type === 'practice' && event.ok === false);
    assert.ok(priorMistakes.length, 'isolated server has actual wrong-answer evidence');

    const now = Date.now();
    const initialAt = now - 10 * 86400000;
    const delayedAt = now - 2 * 86400000;
    const fingerprint = learningEngine.fingerprintAssessmentItem({ ...item, key });
    const assessments = [
      learningEngine.createLearningEvent({ makeId: () => 'e2e_formal_initial', key, sessionId: 'e2e_formal_session_initial',
        at: initialAt, type: 'assessment', mode: 'typing', contentFingerprint: fingerprint, ok: true, firstAttempt: true,
        eligibleAt: initialAt - 86400000, stage: 'initial' }),
      learningEngine.createLearningEvent({ makeId: () => 'e2e_formal_delayed', key, sessionId: 'e2e_formal_session_delayed',
        at: delayedAt, type: 'assessment', mode: 'typing', contentFingerprint: fingerprint, ok: true, firstAttempt: true,
        eligibleAt: delayedAt - 86400000, stage: 'delayed' }),
    ];

    priorMistakes.forEach((mistake, index) => {
      const movedMistake = { ...mistake, at: now - 12 * 86400000 + index * 1000 };
      db.prepare('UPDATE user_learning_events SET event_json=? WHERE user_id=? AND sentence_key=? AND event_id=?')
        .run(JSON.stringify(movedMistake), userId, key, mistake.eventId);
      const priorUserEvent = db.prepare('SELECT data_json FROM user_events WHERE user_id=? AND id=?').get(userId, mistake.eventId);
      if (priorUserEvent) {
        const data = JSON.parse(priorUserEvent.data_json);
        data.at = movedMistake.at;
        db.prepare('UPDATE user_events SET at=?,data_json=? WHERE user_id=? AND id=?')
          .run(data.at, JSON.stringify(data), userId, mistake.eventId);
      }
    });
    for (const event of assessments) {
      const persisted = { ...event, generation: 0, receivedAt: now };
      db.prepare('INSERT INTO user_learning_events(user_id,sentence_key,event_id,generation,event_json,received_at) VALUES(?,?,?,?,?,?)')
        .run(userId, key, event.id, 0, JSON.stringify(persisted), now);
      db.prepare('INSERT INTO user_events(user_id,id,at,data_json) VALUES(?,?,?,?)')
        .run(userId, event.id, event.at, JSON.stringify({ ...persisted, kind: 'learning' }));
    }

    const baseline = db.prepare('SELECT baseline_json FROM user_learning_baselines WHERE user_id=? AND sentence_key=?').get(userId, key);
    assert.ok(baseline, 'isolated test sentence has a replay baseline');
    const allEvents = db.prepare('SELECT event_json FROM user_learning_events WHERE user_id=? AND sentence_key=? AND generation=0')
      .all(userId, key).map(row => JSON.parse(row.event_json));
    const projection = learningEngine.reducePracticeEvents(JSON.parse(baseline.baseline_json), allEvents, { srs }).stat;
    projection.deckId = key.slice(0, key.indexOf('#'));
    db.prepare("UPDATE user_sentence_stats SET data_json=?,updated_at=datetime('now') WHERE user_id=? AND sentence_key=?")
      .run(JSON.stringify(projection), userId, key);
    const formalState = learningEngine.resolveLearningState({ stat: projection, contentFingerprint: fingerprint, now });
    assert.equal(formalState.verifiedMastered, true, 'fixture represents a formally mastered item under the production policy');
    return { fingerprint, verifiedMastered: formalState.verifiedMastered };
  } finally {
    db.close();
  }
}

async function switchTestAccount(page, token) {
  // Quiesce old-account requests before atomically replacing the same three
  // persisted session fields that a completed login writes.
  await page.goto(`${base}/api/health`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ nextToken, epoch }) => {
    localStorage.setItem('chunklab_api_base', '');
    localStorage.setItem('chunklab_token', nextToken);
    localStorage.setItem('chunklab.session.v1', JSON.stringify({ version: 1, base: '', token: nextToken, epoch }));
  }, { nextToken: token, epoch: randomBytes(12).toString('hex') });
  await page.goto(`${base}/main.html?view=my-learning`, { waitUntil: 'domcontentloaded' });
}

async function stop() {
  if (browser) { await browser.close(); browser = null; }
  if (server) {
    server.kill('SIGKILL');
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    server = null;
  }
  if (path.dirname(dataDir) === os.tmpdir() && path.basename(dataDir).startsWith('chunklab-review-loop-')) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      windowsHide: true,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', CHUNKLAB_DATA_DIR: dataDir,
        NODE_ENV: 'test', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
        JWT_SECRET: randomBytes(32).toString('hex'), CHUNKLAB_WRITE_PROTOCOL: '3' },
      stdio: 'ignore',
    });
    await waitHealthy();

    const registration = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(registration.status, 200, 'isolated test account registration succeeds');
    const account = await registration.json();
    const secondRegistration = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: secondUsername, password }),
    });
    assert.equal(secondRegistration.status, 200, 'second isolated test account registration succeeds');
    const secondAccount = await secondRegistration.json();
    const thirdRegistration = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: thirdUsername, password }),
    });
    assert.equal(thirdRegistration.status, 200, 'third isolated test account registration succeeds');
    const thirdAccount = await thirdRegistration.json();

    const deckId = 'review-loop-course';
    const cid = 'reviewloop01';
    const sentence = 'I need a little more time.';
    const item = { cid, sentence, en: sentence, translation: '我还需要一点时间。', chunks: ['I need', 'a little more time.'], hints: ['', ''] };
    const key = `${deckId}#${cid}`;
    await operation(account.token, 'review-loop-deck-create', 'deck.put', {
      deck: { id: deckId, name: '错题闭环隔离课程', items: [item] },
    }, null);
    await operation(account.token, 'review-loop-enrollment', 'course.enrollment', {
      courseId: `user-deck:${deckId}`, joined: true,
    });

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    const answerAttempts = [];
    let keepAnswersOffline = true;
    await page.route('**/api/operations', async route => {
      let operation;
      try { operation = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      if (operation && operation.type === 'learning.answer') {
        answerAttempts.push(operation);
        if (keepAnswersOffline) {
          await route.abort('internetdisconnected');
          return;
        }
      }
      await route.continue();
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(({ token, userId }) => {
      if (sessionStorage.getItem('review-loop-auth-fixture-seeded') === '1') return;
      sessionStorage.setItem('review-loop-auth-fixture-seeded', '1');
      localStorage.setItem('chunklab_token', token);
      localStorage.setItem('chunklab_manual', '1');
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, String(userId)]));
    }, { token: account.token, userId: account.user.id });

    await page.goto(`${base}/main.html?view=my-learning`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expectedDeckId => window._mainBooted && window.mem && window.CL &&
      window.mem.decks.some(deck => deck.id === expectedDeckId), deckId, { timeout: 20000 });
    await page.evaluate(expectedDeckId => {
      const deck = mem.decks.find(candidate => candidate.id === expectedDeckId);
      if (!deck) throw new Error('isolated ordinary course did not load');
      window.__reviewLoopRealNow = Date.now.bind(Date);
      Date.now = () => window.__reviewLoopRealNow() - 20 * 60 * 1000;
      startDeck(deck, 0);
    }, deckId);
    await page.locator('#stageChoices .choice').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => {
      hintFirst();
      const expected = S.items[S.idx].chunks[S.chunkIdx];
      const wrongChoice = Array.from(document.querySelectorAll('#stageChoices .choice'))
        .find(candidate => !candidate.hidden && candidate.dataset.v !== expected);
      if (!wrongChoice) throw new Error('a non-answer choice is required to produce a real wrong attempt');
      wrongChoice.click();
    });
    await page.waitForFunction(() => S.wrongAttempts && S.wrongAttempts[0] === 1, null, { timeout: 5000 });
    for (let chunk = 0; chunk < 2; chunk++) {
      await page.evaluate(() => {
        const expected = S.items[S.idx].chunks[S.chunkIdx];
        const button = Array.from(document.querySelectorAll('#stageChoices .choice'))
          .find(candidate => candidate.dataset.v === expected);
        if (!button) throw new Error('current correct chunk is missing from the choice pool');
        button.click();
      });
      if (chunk === 0) await page.waitForFunction(() => S.chunkIdx === 1, null, { timeout: 5000 });
    }
    await page.waitForFunction(() => S.finished === true && S._answerQueued === true, null, { timeout: 15000 });
    await page.evaluate(() => { Date.now = window.__reviewLoopRealNow; });
    await page.waitForFunction(() => ServerStore.pending().then(rows => rows.some(row => row.operation.type === 'learning.answer')), null, { timeout: 10000 });
    const offlineState = await page.evaluate(async () => {
      const rows = await ServerStore.pending();
      const answer = rows.find(row => row.operation.type === 'learning.answer');
      return { owner: AccountStorage.owner, requestId: answer && answer.requestId, row: answer && answer.operation };
    });
    assert.ok(answerAttempts.length >= 1, 'the real answer was attempted while the isolated browser was offline');
    assert.equal(offlineState.row.payload.key, key);
    assert.equal(offlineState.row.payload.ok, false);
    assert.ok(offlineState.row.payload.mistake, 'the offline answer retains genuine wrong-answer evidence');
    assert.ok(offlineState.row.payload.mistake.row.history.some(event => event.hinted === true),
      'the actual hinted mistake is retained in the durable historical evidence');
    assert.equal(offlineState.row.requestId, answerAttempts[0].requestId, 'the durable row retains the original request id');
    assert.ok(answerAttempts.every(item => item.requestId === offlineState.requestId &&
      JSON.stringify(item) === JSON.stringify(answerAttempts[0])), 'offline automatic retries reuse the exact answer operation');
    assert.equal((await accountData(account.token)).mem.stats.bySentence[key], undefined,
      'an offline answer is not displayed as server-confirmed evidence');

    const secondAccountSnapshot = await accountData(secondAccount.token);
    assert.equal(secondAccountSnapshot.mem.stats.bySentence[key], undefined, 'second test account begins without the first account sentence');
    await switchTestAccount(page, secondAccount.token);
    await page.waitForFunction(userId => window._mainBooted && JSON.parse(AccountStorage.owner)[1] === String(userId) &&
      CL.serverPersistenceReady && CL.serverPersistenceReady(), secondAccount.user.id, { timeout: 20000 });
    const secondScope = await page.evaluate(async () => ({
      queue: await ServerStore.pending(),
      owner: AccountStorage.owner,
      hasOriginalDeck: mem.decks.some(deck => deck.id === 'review-loop-course'),
    }));
    assert.equal(secondScope.queue.length, 0, 'the second account cannot see the first account pending queue');
    assert.equal(secondScope.hasOriginalDeck, false, 'the second account cannot see the first account course');
    assert.equal((await accountData(secondAccount.token)).mem.stats.bySentence[key], undefined,
      'the offline answer is not submitted to the second account');
    await page.goto(`${base}/main.html?view=stats&tab=wrong`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const root = document.querySelector('#statsPageHost')?.shadowRoot;
      return root?.querySelector('#wrongTabCount')?.textContent === '(0)' &&
        root.querySelector('#reviewTabCount')?.textContent === '(0)' && !!root.querySelector('.empty-tip');
    }, null, { timeout: 20000 });
    const emptyWrongState = await page.locator('#statsPageHost').evaluate(host => ({
      wrong: host.shadowRoot.querySelector('#wrongTabCount').textContent,
      due: host.shadowRoot.querySelector('#reviewTabCount').textContent,
      body: host.shadowRoot.querySelector('#statsBody')?.textContent || '',
      activeTab: host.ownerDocument.querySelector('#studyArchiveNav [aria-current="page"]')?.dataset.studyTab || '',
    }));
    assert.equal(emptyWrongState.wrong, '(0)');
    assert.equal(emptyWrongState.due, '(0)');
    assert.equal(emptyWrongState.activeTab, 'wrong');
    assert.match(emptyWrongState.body, /还没有学习记录|错题本是空的/,
      'a genuinely empty account has an explicit empty state, not a fabricated item');
    await page.locator('#studyArchiveNav [data-study-tab="review"]').click();
    await page.waitForFunction(() => !!document.querySelector('#statsPageHost')?.shadowRoot?.querySelector('.empty-tip'),
      null, { timeout: 10000 });
    await page.locator('#studyArchiveNav [data-study-tab="wrong"]').click();

    let unconfirmedDataRequests = 0;
    const rejectUnconfirmedRead = route => { unconfirmedDataRequests++; return route.abort('failed'); };
    await page.route('**/api/data', rejectUnconfirmedRead);
    await switchTestAccount(page, thirdAccount.token);
    await page.waitForFunction(userId => window._mainBooted && JSON.parse(AccountStorage.owner)[1] === String(userId),
      thirdAccount.user.id, { timeout: 20000 });
    await page.goto(`${base}/main.html?view=stats&tab=wrong`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => {
        const root = document.querySelector('#statsPageHost')?.shadowRoot;
        const notice = root?.querySelector('#statsSyncStatus');
        return notice && !notice.hidden && notice.textContent.includes('云端数据未确认');
      }, null, { timeout: 12000 });
    } catch (error) {
      console.error('[review-mistake-loop e2e] unconfirmed-read diagnostics:', await page.evaluate(() => {
        const root = document.querySelector('#statsPageHost')?.shadowRoot;
        return { owner: window.AccountStorage?.owner, text: root?.textContent.slice(0, 1000), notice: root?.querySelector('#statsSyncStatus')?.outerHTML,
          syncState: root?.querySelector('#statsSyncStatus')?.textContent, initialLoading: !!root?.querySelector('.archive-initial-loading'),
          wrongCount: root?.querySelector('#wrongTabCount')?.textContent, dueCount: root?.querySelector('#reviewTabCount')?.textContent };
      }), { unconfirmedDataRequests });
      throw error;
    }
    const unconfirmedState = await page.locator('#statsPageHost').evaluate(host => ({
      notice: host.shadowRoot.querySelector('#statsSyncStatus').textContent,
      wrong: host.shadowRoot.querySelector('#wrongTabCount').textContent,
      due: host.shadowRoot.querySelector('#reviewTabCount').textContent,
      empty: host.shadowRoot.querySelector('#statsBody .empty-tip')?.textContent || '',
    }));
    assert.equal(unconfirmedState.wrong, '');
    assert.equal(unconfirmedState.due, '');
    assert.match(unconfirmedState.notice, /云端数据未确认/);
    assert.match(unconfirmedState.empty, /服务器学习记录尚未确认/);
    assert.ok(unconfirmedDataRequests > 0, 'the unconfirmed state follows real failed server snapshot requests');
    await page.unroute('**/api/data', rejectUnconfirmedRead);

    await switchTestAccount(page, account.token);
    await page.waitForFunction(userId => window._mainBooted && JSON.parse(AccountStorage.owner)[1] === String(userId) &&
      CL.serverPersistenceReady && CL.serverPersistenceReady(), account.user.id, { timeout: 20000 });
    const restoredQueue = await page.evaluate(async requestId => (await ServerStore.pending())
      .filter(row => row.requestId === requestId), offlineState.requestId);
    assert.equal(restoredQueue.length, 1, 'returning to the original account restores its still-pending answer');
    assert.equal(JSON.stringify(restoredQueue[0].operation), JSON.stringify(answerAttempts[0]),
      'account switching does not alter the original answer payload');
    keepAnswersOffline = false;
    await page.evaluate(() => ServerStore.retryPending());
    await waitForAsync(page, async ({ requestId, key: sentenceKey }) => {
      const [snapshotResponse, rows] = await Promise.all([
        fetch('/api/data', { headers: { Authorization: `Bearer ${ChunkAPI.getToken()}` } }),
        ServerStore.pending(),
      ]);
      const snapshot = await snapshotResponse.json();
      return snapshot.mem.stats.bySentence[sentenceKey]?.times === 1 && !rows.some(row => row.requestId === requestId);
    }, { requestId: offlineState.requestId, key }, { timeout: 20000 });
    const recoveredAttempts = answerAttempts.filter(item => item.requestId === offlineState.requestId);
    assert.ok(recoveredAttempts.length >= 2, 'recovery retries the same durable answer request');
    assert.ok(recoveredAttempts.every(item => JSON.stringify(item) === JSON.stringify(answerAttempts[0])),
      'recovery reuses the exact operation id and payload');
    const afterInitialWrong = await accountData(account.token);
    assert.equal(afterInitialWrong.mem.stats.bySentence[key].times, 1, 'the ordinary-course answer is recorded once');
    assert.ok(afterInitialWrong.mem.stats.bySentence[key].dueAt <= Date.now(),
      `the isolated test answer should already be due: ${afterInitialWrong.mem.stats.bySentence[key].dueAt}`);
    assert.equal(afterInitialWrong.mem.reinforceBook.some(row => row.deckId === deckId && row.cid === cid), true,
      'the first real wrong answer creates the wrong-book row');

    await page.goto(`${base}/main.html?view=my-learning`, { waitUntil: 'domcontentloaded' });
    await page.locator('#myLearningBody .my-learning-dashboard').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('.learning-global-nav a').filter({ hasText: '首页' }).click();
    try {
      await page.waitForFunction(() => !!document.querySelector('.home-hero-actions a[href*="tab=review"]') &&
        !!document.querySelector('.home-hero-actions a[href*="tab=wrong"]'), null, { timeout: 20000 });
    } catch (error) {
      console.error('[review-mistake-loop e2e] home projection diagnostic', await page.evaluate(() => ({
        url: location.href,
        current: window._curPage,
        home: document.querySelector('#homeBody')?.textContent.slice(0, 500),
        myLearning: document.querySelector('#myLearningBody')?.textContent.slice(0, 200),
        routeView: window.LearningWorkspaceRuntime && document.querySelector('.learning-global-nav [aria-current="page"]')?.textContent,
      })));
      throw error;
    }
    const homeCounts = await page.evaluate(() => ({
      due: document.querySelector('.home-hero-actions a[href*="tab=review"]')?.textContent,
      wrong: document.querySelector('.home-hero-actions a[href*="tab=wrong"]')?.textContent,
    }));
    assert.ok(homeCounts.due && homeCounts.wrong, `home review counts are absent: ${JSON.stringify(homeCounts)}`);
    assert.match(homeCounts.due, /1/);
    assert.match(homeCounts.wrong, /1/);

    await page.goto(`${base}/main.html?view=my-learning`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('.my-learning-stat:not(.is-streak)') &&
      !!document.querySelector('.my-learning-review-link'));
    const myLearningCounts = await page.evaluate(() => ({
      due: document.querySelector('.my-learning-stat:not(.is-streak)').textContent.replace(/\s+/g, ''),
      launch: document.querySelector('.my-learning-review-link').textContent.replace(/\s+/g, ''),
    }));
    assert.match(myLearningCounts.due, /1/);
    assert.match(myLearningCounts.launch, /1/);

    await page.goto(`${base}/main.html?view=stats&tab=wrong`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const root = document.querySelector('#statsPageHost')?.shadowRoot;
      return root?.querySelector('#wrongTabCount')?.textContent === '(1)' &&
        root.querySelector('#reviewTabCount')?.textContent === '(1)';
    }, null, { timeout: 20000 });
    const crossSurfaceArchiveCounts = await page.locator('#statsPageHost').evaluate(host => ({
      due: host.shadowRoot.querySelector('#reviewTabCount').textContent,
      wrong: host.shadowRoot.querySelector('#wrongTabCount').textContent,
    }));
    assert.deepEqual([homeCounts.due.includes('1'), homeCounts.wrong.includes('1'),
      myLearningCounts.due.includes('1'), myLearningCounts.launch.includes('1'),
      crossSurfaceArchiveCounts.due, crossSurfaceArchiveCounts.wrong], [true, true, true, true, '(1)', '(1)'],
    'home, My Learning, and the learning archive use the same due/wrong sentence counts');

    await page.goto(`${base}/stats.html?tab=wrong`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const root = document.querySelector('#statsPageHost')?.shadowRoot;
      return root?.querySelector('#wrongTabCount')?.textContent === '(1)' &&
        root.querySelector('#reviewTabCount')?.textContent === '(1)';
    }, null, { timeout: 20000 });
    assert.match(page.url(), /main\.html\?view=stats(?:$|&)/,
      'the standalone stats entry redirects into the integrated learning archive');
    await page.locator('#studyArchiveNav [data-study-tab="wrong"]').click();
    await page.waitForFunction(() => document.querySelector('#statsPageHost')?.shadowRoot
      ?.querySelector('#statsBody')?.textContent.includes('I need a little more time.'));
    await page.evaluate(() => {
      window.__reviewLoopOriginalReadFormat = ChunkAPI.getLearningDataFormat;
      window.__reviewLoopOriginalReadData = ChunkAPI.getData;
      ChunkAPI.getLearningDataFormat = () => Promise.resolve('legacy-v1');
      ChunkAPI.getData = () => Promise.reject(Object.assign(new Error('isolated read failure'), { code: 'REQUEST_FAILED' }));
    });
    const staleRefreshResult = await page.evaluate(async () => {
      try { await ServerCache.refresh(); return 'resolved'; }
      catch (error) { return error && error.code || error && error.message || 'failed'; }
      finally {
        ChunkAPI.getLearningDataFormat = window.__reviewLoopOriginalReadFormat;
        ChunkAPI.getData = window.__reviewLoopOriginalReadData;
        delete window.__reviewLoopOriginalReadFormat;
        delete window.__reviewLoopOriginalReadData;
      }
    });
    try { await page.waitForFunction(() => {
      const root = document.querySelector('#statsPageHost')?.shadowRoot;
      return root?.querySelector('#statsSyncStatus')?.textContent.includes('上次已确认记录') &&
        root.querySelector('#wrongTabCount')?.textContent === '(1)' && root.querySelector('#reviewTabCount')?.textContent === '(1)';
    }, null, { timeout: 10000 }); } catch (error) {
      const staleDiagnostic = await page.locator('#statsPageHost').evaluate(async host => ({
        status: host.shadowRoot.querySelector('#statsSyncStatus')?.textContent,
        due: host.shadowRoot.querySelector('#reviewTabCount')?.textContent,
        wrong: host.shadowRoot.querySelector('#wrongTabCount')?.textContent,
        owner: AccountStorage.owner,
        cache: await ServerCache.read(),
      }));
      console.error('[review-mistake-loop e2e] cached refresh failure diagnostic', JSON.stringify({
        staleRefreshResult, staleDiagnostic,
      }));
      throw error;
    }
    const staleSnapshotState = await page.locator('#statsPageHost').evaluate(host => ({
      status: host.shadowRoot.querySelector('#statsSyncStatus').textContent,
      body: host.shadowRoot.querySelector('#statsBody').textContent,
      due: host.shadowRoot.querySelector('#reviewTabCount').textContent,
      wrong: host.shadowRoot.querySelector('#wrongTabCount').textContent,
    }));
    assert.match(staleSnapshotState.status, /上次已确认记录/);
    assert.match(staleSnapshotState.body, /I need a little more time\./);
    assert.deepEqual([staleSnapshotState.due, staleSnapshotState.wrong], ['(1)', '(1)']);
    assert.equal(staleRefreshResult, 'REQUEST_FAILED', 'the confirmed cache stays intact after a simulated snapshot read failure');

    let seededMastery;

    await page.goto(`${base}/main.html?view=stats&tab=wrong`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      const root = host && host.shadowRoot;
      const count = root && root.querySelector('#wrongTabCount');
      return !!count && !!root.querySelector('#reviewTabCount') && !!root.querySelector('[data-practice-wrong]');
    }, null, { timeout: 20000 });
    const archiveCounts = await page.locator('#statsPageHost').evaluate(host => ({
      wrong: host.shadowRoot.querySelector('#wrongTabCount').textContent,
      due: host.shadowRoot.querySelector('#reviewTabCount').textContent,
    }));
    assert.deepEqual(archiveCounts, { wrong: '(1)', due: '(1)' }, 'the actual error appears in both due and wrong counts');
    const archiveText = await page.locator('#statsPageHost').evaluate(host => host.shadowRoot.textContent);
    assert.match(archiveText, /I need a little more time\./,
      `the failed sentence is visible in the wrong-answer list: ${archiveText}`);
    await page.locator('#statsPageHost').locator('details.wrong-history summary').click();
    const openedHistory = await page.locator('#statsPageHost').locator('.wrong-history-event').allTextContents();
    assert.ok(openedHistory.some(text => text.includes('用过提示')),
      `the archived practice history displays its original hint detail: ${openedHistory.join(' | ')}`);
    await page.locator('#statsPageHost').locator('[data-wrong-filter="focus"]').focus();
    await page.keyboard.press('Tab');
    const focusState = await page.locator('#statsPageHost').evaluate(host => {
      const active = host.shadowRoot.activeElement;
      return { label: active?.textContent?.trim() || '', outline: active ? getComputedStyle(active).outlineStyle : 'none' };
    });
    assert.notEqual(focusState.outline, 'none', `keyboard navigation exposes a visible focus ring: ${JSON.stringify(focusState)}`);

    await page.locator('#statsPageHost').locator('[data-practice-wrong]').click();
    await page.waitForURL(/autostart=1&reviewHandoff=/, { timeout: 15000 });
    await page.waitForFunction(expectedDeckId => window.S && S.deck && Array.isArray(S.deck.items) &&
      S.deck.items.length === 1 && S.deck.items[0]._statsDeckId === expectedDeckId && S.deck.items[0].cid === 'reviewloop01',
    deckId, { timeout: 15000 });
    const queue = await page.evaluate(() => ({
      deckId: S.deck.id,
      sourceDeckId: S.deck.items[0]._statsDeckId,
      cid: S.deck.items[0].cid,
      count: S.deck.items.length,
    }));
    assert.equal(queue.sourceDeckId, deckId, 'temporary review preserves the original course identity');
    assert.equal(queue.count, 1, 'one recorded mistake starts as one practice item');
    assert.match(new URL(page.url()).searchParams.get('returnTo') || '', /view=stats&tab=wrong/,
      'practice handoff retains the originating wrong-book tab');

    await page.locator('#btnExitPractice').click();
    await page.waitForURL(/view=stats&tab=wrong/, { timeout: 15000 });
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      const count = host && host.shadowRoot && host.shadowRoot.querySelector('#wrongTabCount');
      return !!count && count.textContent === '(1)';
    }, null, { timeout: 20000 });

    await page.locator('#studyArchiveNav [data-study-tab="review"]').click();
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      const root = host && host.shadowRoot;
      const count = root && root.querySelector('#reviewTabCount');
      const button = root && root.querySelector('[data-practice-due]');
      return !!count && count.textContent === '(1)' && !!button && button.offsetParent !== null;
    }, null, { timeout: 15000 });
    await page.locator('#statsPageHost').locator('[data-practice-due]').click();
    await page.waitForURL(/autostart=1&reviewHandoff=/, { timeout: 15000 });
    await page.waitForFunction(expectedDeckId => window.S && S.deck && Array.isArray(S.deck.items) &&
      S.deck.items.length === 1 && S.deck.items[0]._statsDeckId === expectedDeckId && S.deck.items[0].cid === 'reviewloop01',
    deckId, { timeout: 15000 });
    await page.locator('#stageChoices .choice').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.evaluate(() => {
      const expected = S.items[S.idx].chunks[S.chunkIdx];
      const wrongChoice = Array.from(document.querySelectorAll('#stageChoices .choice'))
        .find(candidate => !candidate.hidden && candidate.dataset.v !== expected);
      if (!wrongChoice) throw new Error('a non-answer choice is required to record a real wrong attempt');
      wrongChoice.click();
    });
    await page.waitForFunction(() => S.wrongAttempts && S.wrongAttempts[0] === 1, null, { timeout: 5000 });
    for (let chunk = 0; chunk < 2; chunk++) {
      await page.evaluate(() => {
        const item = S.items[S.idx];
        const expected = item && item.chunks[S.chunkIdx];
        const button = Array.from(document.querySelectorAll('#stageChoices .choice'))
          .find(candidate => candidate.dataset.v === expected);
        if (!button) throw new Error('current correct chunk is missing from the choice pool');
        button.click();
      });
      if (chunk === 0) await page.waitForFunction(() => S.chunkIdx === 1, null, { timeout: 5000 });
    }
    await page.waitForFunction(() => S.finished === true && S._answerQueued === true, null, { timeout: 15000 });
    const uniqueAnswerRequests = Array.from(new Map(answerAttempts.map(item => [item.requestId, item])).values());
    assert.equal(uniqueAnswerRequests.length, 2, 'the original course answer and completed review use distinct requests');
    const submittedAnswer = uniqueAnswerRequests[1];
    assert.equal(submittedAnswer.type, 'learning.answer');
    assert.equal(submittedAnswer.payload.key, key);
    assert.equal(submittedAnswer.payload.ok, false, 'a self-corrected first mistake does not count as a clean first-try success');
    assert.ok(submittedAnswer.payload.mistake, 'the genuine submitted mistake includes durable evidence');
    const afterPractice = await accountData(account.token);
    const practicedStat = afterPractice.mem.stats.bySentence[key];
    assert.equal(practicedStat.times, 2, 'the original error and completed review are both reflected');
    assert.equal(practicedStat.learningV1.evidence.filter(event => event.type === 'practice').length, 2,
      'server replay retains both distinct practice attempts');
    assert.equal(practicedStat.learningV1.evidence.filter(event => event.type === 'assessment').length, 0,
      'practice before formal assessment creates no assessment evidence');
    assert.ok(practicedStat.learningV1.evidence.every(event => event.type === 'practice'),
      'review answers remain practice evidence and do not fabricate assessment events');
    assert.deepEqual(afterPractice.courseProgress, afterInitialWrong.courseProgress,
      'review practice does not change the source course progress');
    assert.equal(afterPractice.mem.decks.some(deck => /^(srs|book|wrong)-/.test(deck.id)), false,
      'temporary review queues are not persisted as user courses');
    assert.ok(Object.keys(afterPractice.mem.stats.bySentence).every(sentenceKey => sentenceKey.startsWith(`${deckId}#`)),
      'review statistics remain attributed to the original course identity');
    const replayResponse = await fetch(`${base}/api/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
      body: JSON.stringify(submittedAnswer),
    });
    assert.equal(replayResponse.ok, true, `replaying the same operation succeeds: ${replayResponse.status}`);
    assert.equal((await replayResponse.json()).duplicate, true, 'the same answer event is acknowledged idempotently');
    const afterReplay = await accountData(account.token);
    assert.equal(afterReplay.mem.stats.bySentence[key].times, 2, 'replay does not increment sentence practice twice');
    await page.locator('#btnExitPractice').click();
    await page.waitForURL(/view=stats&tab=review/, { timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      const count = host && host.shadowRoot && host.shadowRoot.querySelector('#reviewTabCount');
      return !!count && count.textContent === '(0)';
    }, null, { timeout: 20000 });
    seededMastery = seedFormalMasteryAfterOriginalMistake(account.user.id, key, item);
    await page.goto(`${base}/main.html?view=stats&tab=review&domain=sentence&formalReviewSeed=${Date.now()}`,
      { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      return !!(host && host.shadowRoot && host.shadowRoot.querySelector('#reviewTabCount'));
    }, null, { timeout: 20000 });
    const beforeWrongBookReview = await accountData(account.token);
    assert.equal(learningEngine.resolveLearningState({ stat: beforeWrongBookReview.mem.stats.bySentence[key],
      contentFingerprint: seededMastery.fingerprint, now: Date.now() }).verifiedMastered, true,
    'the server snapshot exposes the formally mastered sentence before wrong-book reinforcement practice');
    await page.locator('#studyArchiveNav [data-study-tab="wrong"]').click();
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      const count = host && host.shadowRoot && host.shadowRoot.querySelector('#wrongTabCount');
      return !!count && count.textContent === '(1)';
    }, null, { timeout: 15000 });

    await page.locator('#statsPageHost').locator('[data-practice-wrong]').click();
    await page.waitForURL(/autostart=1&reviewHandoff=/, { timeout: 15000 });
    await page.waitForFunction(expectedDeckId => window.S && S.deck && Array.isArray(S.deck.items) &&
      S.deck.items.length === 1 && S.deck.items[0]._statsDeckId === expectedDeckId && S.deck.items[0].cid === 'reviewloop01',
    deckId, { timeout: 15000 });
    await page.locator('#stageChoices .choice').first().waitFor({ state: 'visible', timeout: 10000 });
    for (let chunk = 0; chunk < 2; chunk++) {
      await page.evaluate(() => {
        const item = S.items[S.idx];
        const expected = item && item.chunks[S.chunkIdx];
        const button = Array.from(document.querySelectorAll('#stageChoices .choice'))
          .find(candidate => candidate.dataset.v === expected);
        if (!button) throw new Error('current correct chunk is missing from the choice pool');
        button.click();
      });
      if (chunk === 0) await page.waitForFunction(() => S.chunkIdx === 1, null, { timeout: 5000 });
    }
    await page.waitForFunction(() => S.finished === true && S._answerQueued === true, null, { timeout: 15000 });
    const allAnswerRequests = Array.from(new Map(answerAttempts.map(item => [item.requestId, item])).values());
    assert.equal(allAnswerRequests.length, 3, 'normal learning, due review, and wrong-book review each submit one distinct answer');
    const wrongBookAnswer = allAnswerRequests[2];
    assert.equal(wrongBookAnswer.type, 'learning.answer');
    assert.equal(wrongBookAnswer.payload.key, key, 'wrong-book review answer uses the source course sentence key');
    assert.equal(wrongBookAnswer.payload.ok, true, 'the clean wrong-book review is recorded as an independent success');
    const afterAllEntries = await accountData(account.token);
    const formalStateAfterReview = learningEngine.resolveLearningState({ stat: afterAllEntries.mem.stats.bySentence[key],
      contentFingerprint: seededMastery.fingerprint, now: Date.now() });
    assert.equal(formalStateAfterReview.verifiedMastered, true,
      'wrong-book reinforcement does not erase the formally mastered assessment marker');
    assert.equal(formalStateAfterReview.evidence.filter(event => event.type === 'assessment').length, 2,
      'both formal assessment events remain in the sentence evidence after reinforcement');
    assert.equal(afterAllEntries.mem.stats.bySentence[key].times, 3, 'all three entry paths update the same source sentence');
    assert.equal(afterAllEntries.mem.stats.bySentence[key].learningV1.evidence.filter(event => event.type === 'practice').length, 3,
      'all three entry paths append practice evidence to the original sentence identity');
    assert.equal(afterAllEntries.mem.stats.bySentence[key].learningV1.evidence.filter(event => event.type === 'assessment').length, 2,
      'review entry paths add no formal assessment events');
    assert.deepEqual(afterAllEntries.courseProgress, afterInitialWrong.courseProgress,
      'normal, due, and wrong-book practice leave course progress unchanged');
    assert.equal(afterAllEntries.mem.decks.some(deck => /^(srs|book|wrong)-/.test(deck.id)), false,
      'none of the review entry paths persists a temporary course');
    assert.ok(Object.keys(afterAllEntries.mem.stats.bySentence).every(sentenceKey => sentenceKey.startsWith(`${deckId}#`)),
      'all recorded practice remains under the original deck identity');
    const duplicateWrongReview = await fetch(`${base}/api/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
      body: JSON.stringify(wrongBookAnswer),
    });
    assert.equal(duplicateWrongReview.ok, true, `replaying wrong-book review succeeds: ${duplicateWrongReview.status}`);
    assert.equal((await duplicateWrongReview.json()).duplicate, true, 'wrong-book review replay is idempotent');
    assert.equal((await accountData(account.token)).mem.stats.bySentence[key].times, 3,
      'wrong-book review replay does not duplicate the source course statistic');
    const dueBeforeEarlyPractice = (await accountData(account.token)).mem.stats.bySentence[key].dueAt;
    assert.ok(dueBeforeEarlyPractice > Date.now(), 'the successful wrong-book review schedules the sentence in the future');
    await page.locator('#btnExitPractice').click();
    await page.waitForURL(/view=stats&tab=wrong/, { timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const host = document.querySelector('#statsPageHost');
      const root = host && host.shadowRoot;
      return !!root && root.querySelector('#wrongTabCount')?.textContent === '(1)' &&
        root.querySelector('#reviewTabCount')?.textContent === '(0)';
    }, null, { timeout: 20000 });

    for (const tabName of ['wrong', 'review']) {
      if (tabName === 'review') await page.locator('#studyArchiveNav [data-study-tab="review"]').click();
      for (const width of [375, 876]) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow, false, `${tabName} archive has no horizontal overflow at ${width}px`);
      }
    }

    await page.goto(`${base}/main.html?view=my-learning&earlyPractice=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expectedDeckId => window._mainBooted && window.mem &&
      window.mem.decks.some(deck => deck.id === expectedDeckId), deckId, { timeout: 20000 });
    await page.evaluate(expectedDeckId => {
      const deck = mem.decks.find(candidate => candidate.id === expectedDeckId);
      if (!deck) throw new Error('isolated course missing for early practice');
      startDeck(deck, 0, undefined, true);
    }, deckId);
    await page.locator('#stageChoices .choice').first().waitFor({ state: 'visible', timeout: 10000 });
    for (let chunk = 0; chunk < 2; chunk++) {
      await page.evaluate(() => {
        const expected = S.items[S.idx].chunks[S.chunkIdx];
        const button = Array.from(document.querySelectorAll('#stageChoices .choice'))
          .find(candidate => candidate.dataset.v === expected);
        if (!button) throw new Error('correct choice missing during early practice');
        button.click();
      });
      if (chunk === 0) await page.waitForFunction(() => S.chunkIdx === 1, null, { timeout: 5000 });
    }
    await page.waitForFunction(() => S.finished === true && S._answerQueued === true, null, { timeout: 15000 });
    const earlyPracticeRequest = Array.from(new Map(answerAttempts.map(row => [row.requestId, row])).values()).at(-1);
    assert.equal(earlyPracticeRequest.type, 'learning.answer');
    assert.equal(earlyPracticeRequest.payload.key, key);
    assert.equal(earlyPracticeRequest.payload.ok, true);
    assert.equal(earlyPracticeRequest.payload.earlyPractice, true,
      'full-course practice before due records the explicit earlyPractice marker');
    await waitForAsync(page, async ({ sentenceKey, priorDueAt }) => {
      const snapshot = await ChunkAPI.getData();
      const stat = snapshot.mem.stats.bySentence[sentenceKey];
      return stat && stat.times === 4 && stat.dueAt === priorDueAt;
    }, { sentenceKey: key, priorDueAt: dueBeforeEarlyPractice }, { timeout: 20000 });
    const afterEarlyPractice = await accountData(account.token);
    assert.equal(afterEarlyPractice.mem.stats.bySentence[key].dueAt, dueBeforeEarlyPractice,
      'early success leaves the existing future due time unchanged');
    const formalStateAfterEarlyPractice = learningEngine.resolveLearningState({ stat: afterEarlyPractice.mem.stats.bySentence[key],
      contentFingerprint: seededMastery.fingerprint, now: Date.now() });
    assert.equal(formalStateAfterEarlyPractice.verifiedMastered, true,
      'an early practice success also preserves the independent formal mastery marker');
    await page.locator('#btnExitPractice').click();
    await page.waitForURL(/view=my-learning/);
    assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
    console.log('[review-mistake-loop e2e] passed');
  } catch (error) {
    console.error('[review-mistake-loop e2e] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    await stop();
  }
})();
