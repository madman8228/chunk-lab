'use strict';
/* Two independent browser devices, one account, protocol-3 persistence. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const Database = require('../server/node_modules/better-sqlite3');
const { waitForAsync } = require('./lib/wait-for-async');
const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9000, 100), base = 'http://127.0.0.1:' + port;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sync-operations-'));
let server, browser;
async function boot(page) {
  await page.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CL && CL.serverPersistenceReady());
}
async function submit(page, type, payload, requestId, expectedRev) {
  return page.evaluate(async input => ServerStore.submitCommitted(input.type, input.payload,
    Object.assign({ requestId: input.requestId }, input.expectedRev === undefined ? {} : { expectedRev: input.expectedRev })),
  { type, payload, requestId, expectedRev });
}
async function pull(page) {
  return page.evaluate(async () => { await ServerCache.refresh(); return (await ServerCache.read()).snapshot; });
}
const deck = (id, name) => ({ id, name, items: [{ cid: 'sentence-1', sentence: 'Hello there.', translation: '你好。', chunks: ['Hello', 'there.'] }] });
const answer = (id, session, ok, at) => ({ eventId: id, key: 'learn-deck#sentence-1', deckId: 'learn-deck',
  courseId: 'learn-deck', generation: 0, sessionId: session, answerOrder: 0,
  occurredAt: at, timeZone: 'UTC', mode: 'typing', ok, firstAttempt: true, chunkRight: ok ? 2 : 0, chunkTotal: 2 });
(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'),
      env: { ...process.env, PORT: String(port), CHUNKLAB_DATA_DIR: temp,
        NODE_ENV: 'test', REQUIRE_AUTH: 'false', CHUNKLAB_WRITE_PROTOCOL: '3' }, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 300; i++) {
      if (server.exitCode !== null) throw new Error('isolated server exited');
      ready = await fetch(base + '/api/health').then(r => r.ok).catch(() => false);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const contexts = await Promise.all([browser.newContext({ serviceWorkers: 'block' }), browser.newContext({ serviceWorkers: 'block' })]);
    const [a, b] = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [], legacy = [];
    for (const page of [a, b]) {
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', r => {
        if (r.method() !== 'GET' && /\/api\/(data|import|sync\/.*|courses|deck\/publish)$/.test(new URL(r.url()).pathname)) legacy.push(r.url());
      });
    }
    await Promise.all([boot(a), boot(b)]);
    await Promise.all([
      submit(a, 'deck.put', { deck: deck('deck-a', 'Device A') }, 'device-a-create-01', null),
      submit(b, 'deck.put', { deck: deck('deck-b', 'Device B') }, 'device-b-create-01', null)
    ]);
    for (const snapshot of await Promise.all([pull(a), pull(b)])) {
      assert.ok(snapshot.mem.decks.some(d => d.id === 'deck-a'));
      assert.ok(snapshot.mem.decks.some(d => d.id === 'deck-b'));
    }
    await submit(a, 'deck.put', { deck: deck('deck-a', 'Confirmed edit') }, 'device-a-edit-0001', 1);
    const blockedCode = await b.evaluate(async payload => {
      try { await ServerStore.submitCommitted('deck.put', { deck: payload }, { requestId: 'device-b-stale-001', expectedRev: 1 }); }
      catch (error) { return error.code; }
      return null;
    }, deck('deck-a', 'Unsaved device B draft'));
    assert.equal(blockedCode, 'ENTITY_CHANGED', 'stale content edit is rejected');
    assert.equal((await pull(b)).mem.decks.find(d => d.id === 'deck-a').name, 'Confirmed edit');
    const retainedDraft = await b.evaluate(async () => (await ServerStore.pending()).find(row => row.requestId === 'device-b-stale-001'));
    assert.equal(retainedDraft.status, 'blocked');
    assert.equal(retainedDraft.operation.payload.deck.name, 'Unsaved device B draft');

    await submit(a, 'deck.delete', { deckId: 'deck-b' }, 'device-a-delete-01', 1);
    const deleted = await pull(b);
    assert.ok(!deleted.mem.decks.some(d => d.id === 'deck-b'), 'deletion propagates');
    const deletedRevision = deleted.revs.decks['deck-b'];
    await submit(b, 'deck.put', { deck: deck('deck-b', 'Recreated') }, 'device-b-recreate1', deletedRevision);
    assert.equal((await pull(a)).mem.decks.find(d => d.id === 'deck-b').name, 'Recreated');

    await submit(a, 'course.put', { course: { courseId: 'progress-course', title: 'Progress fixture', steps: [] } }, 'progress-course-create', null);
    await pull(b);
    await Promise.all([
      submit(a, 'course.progress', { courseId: 'progress-course', nodeId: 'node-a', passed: true, completed: false, generation: 0 }, 'progress-device-a'),
      submit(b, 'course.progress', { courseId: 'progress-course', nodeId: 'node-b', passed: true, completed: false, generation: 0 }, 'progress-device-b')
    ]);
    for (const snapshot of await Promise.all([pull(a), pull(b)])) {
      assert.deepEqual(snapshot.courseProgress['progress-course'].passed.slice().sort(), ['node-a', 'node-b']);
      assert.deepEqual(snapshot.courseProgress['progress-course'].seen.slice().sort(), ['node-a', 'node-b']);
    }

    await submit(a, 'deck.put', { deck: deck('learn-deck', 'Learning fixture') }, 'learning-deck-create', null);
    await pull(b);
    const at = Date.now() - 60000;
    const first = answer('multi_answer_event_01', 'device-a-session', true, at);
    const second = answer('multi_answer_event_02', 'device-b-session', false, at + 1000);
    await Promise.all([
      submit(a, 'learning.answer', first, 'multi-answer-request-01'),
      submit(b, 'learning.answer', second, 'multi-answer-request-02')
    ]);
    for (const snapshot of await Promise.all([pull(a), pull(b)])) {
      const stat = snapshot.mem.stats.bySentence[first.key];
      assert.equal(stat.times, 2); assert.equal(stat.okTimes, 1); assert.equal(stat.wrongTimes, 1);
      assert.ok(snapshot.mem.stats.events.some(e => e.id === first.eventId));
      assert.ok(snapshot.mem.stats.events.some(e => e.id === second.eventId));
    }
    await b.route('**/api/operations', route => route.abort());
    const delayed = answer('multi_answer_event_03', 'device-b-offline', true, at + 2000);
    const queued = await b.evaluate(payload => ServerStore.submit('learning.answer', payload,
      { requestId: 'multi-offline-request' }), delayed);
    assert.equal(queued.durable, true);
    await submit(a, 'learning.answer', answer('multi_answer_event_04', 'device-a-online', true, at + 3000), 'multi-online-request');
    await b.unroute('**/api/operations');
    await b.evaluate(() => ServerStore.retryPending());
    await waitForAsync(b, async () => !(await ServerStore.pending()).some(row => row.requestId === 'multi-offline-request'));
    const merged = await pull(a);
    assert.equal(merged.mem.stats.bySentence[first.key].times, 4);
    assert.equal(merged.mem.stats.totalAnswered, 4);
    await submit(a, 'learning.answer', delayed, 'multi-duplicate-event');
    assert.equal((await pull(b)).mem.stats.bySentence[first.key].times, 4, 'same event on another device counts once');

    let committed;
    const lostCommit = new Promise(resolve => { committed = resolve; });
    await a.route('**/api/operations', async route => {
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort(); committed();
    });
    await a.evaluate(payload => ServerStore.submit('learning.answer', payload,
      { requestId: 'multi-lost-receipt' }), answer('multi_answer_event_05', 'device-a-lost', true, at + 4000));
    await lostCommit;
    await a.unroute('**/api/operations');
    await boot(a);
    await a.evaluate(() => ServerStore.retryPending());
    await waitForAsync(a, async () => !(await ServerStore.pending()).some(row => row.requestId === 'multi-lost-receipt'));
    assert.equal((await pull(b)).mem.stats.bySentence[first.key].times, 5);
    const db = new Database(path.join(temp, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(db.prepare('SELECT count(*) n FROM user_operation_receipts WHERE request_id=?').get('multi-lost-receipt').n, 1);
      assert.equal(db.prepare('SELECT count(*) n FROM user_learning_events WHERE event_id=?').get('multi_answer_event_05').n, 1);
    } finally { db.close(); }
    for (const page of [a, b]) assert.equal(await page.evaluate(() => !!document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog')), false);
    assert.deepEqual(legacy, []); assert.deepEqual(errors, []);
    console.log('[two-device protocol3] content convergence, retained stale draft, deletion/recreation, concurrent answers, offline replay and lost-receipt dedup passed');
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) { const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended; }
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('cl-sync-operations-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
