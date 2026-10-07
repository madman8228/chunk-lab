'use strict';
/* Large confirmed dataset: single-answer operations stay small and partial
 * server deltas never remove untouched records from the browser cache. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(8942, 60), base = 'http://127.0.0.1:' + port;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-operation-delta-'));
let server, browser;
async function start(protocol) {
  server = spawn(process.execPath, [Number(protocol) === 2 ? 'testing/start-historical.js' : 'index.js'], { cwd: path.join(root, 'server'),
    env: { ...process.env, CHUNKLAB_DATA_DIR: temp, PORT: String(port), NODE_ENV: 'test',
      REQUIRE_AUTH: 'false', CHUNKLAB_WRITE_PROTOCOL: String(protocol) }, stdio: 'ignore' });
  for (let i = 0; i < 300; i++) {
    if (server.exitCode !== null) throw new Error('isolated server exited');
    if (await fetch(base + '/api/health').then(r => r.ok).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated server startup timed out');
}
async function stop() {
  if (server && server.exitCode === null) { const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended; }
  server = null;
}
async function boot(page) {
  await page.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CL && CL.serverPersistenceReady());
}
const keyFor = i => 'large-fixture#' + String(i).padStart(8, '0');
async function cache(page) { return page.evaluate(async () => (await ServerCache.read()).snapshot); }
async function delta(page) {
  const since = await page.evaluate(async () => (await ServerCache.read()).appliedSeq);
  const response = page.waitForResponse(r => {
    const url = new URL(r.url());
    return url.pathname === '/api/data' && url.searchParams.get('since') === String(since);
  });
  await page.evaluate(() => ServerCache.refresh());
  const received = await (await response).json();
  assert.equal(received.delta, true);
  return received;
}
function complete(snapshot, events, mastered = 800) {
  assert.equal(Object.keys(snapshot.mem.stats.bySentence).length, 800);
  assert.equal(snapshot.mem.stats.events.length, events);
  assert.equal(Object.keys(snapshot.mem.mastered).length, mastered);
  assert.equal(snapshot.mem.reinforceBook.length, 200);
  assert.equal(Object.keys(snapshot.mem.deletedItems).length, 50);
  assert.ok(snapshot.mem.decks.some(d => d.id === 'large-fixture' && d.items.length === 800));
}
(async () => {
  try {
    // Seed only this temporary database with a historical large dataset; normal
    // browser writes below must use protocol 3 and never upload this snapshot.
    await start(2);
    const bySentence = {}, mastered = {}, deletedItems = {}, items = [], events = [], reinforceBook = [];
    for (let i = 0; i < 800; i++) {
      const sentence = 'Long original learning sentence for payload measurement ' + i + '.';
      items.push({ cid: String(i).padStart(8, '0'), sentence, translation: '原始学习句子', chunks: [sentence] });
      bySentence[keyFor(i)] = { deckId: 'large-fixture', sentence, times: 3, okTimes: 2, wrongTimes: 1,
        lastAt: 1700000000000, interval: 4, ease: 2.5, dueAt: 1700003600000, repetition: 2,
        learningV1: { version: 1, evidence: [], legacyFamiliarityMigrated: true,
          lastExposureAt: 1700000000000, baselineAt: 1700000000000,
          interval: 4, ease: 2.5, dueAt: 1700003600000, repetition: 2 } };
      mastered[keyFor(i)] = { deckId: 'large-fixture', sentence, markedAt: 1700000000000 + i };
    }
    for (let i = 0; i < 2000; i++) events.push({ id: 'historical-event-' + i, kind: 'answer', key: keyFor(i % 800), ok: true, at: 1700000000000 + i });
    for (let i = 0; i < 200; i++) reinforceBook.push({ _key: 'large-fixture::wrong-' + i, deckId: 'large-fixture',
      sentence: 'Saved historical mistake ' + i, translation: '原始错题', addedAt: '2026-09-10 12:00:00',
      mistakes: [{ chunkIdx: 0, chunk: 'Saved', userAnswer: 'Other' }] });
    for (let i = 0; i < 50; i++) deletedItems[keyFor(1000 + i)] = true;
    const seeded = await fetch(base + '/api/data', { method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mem: { decks: [{ id: 'large-fixture', name: 'Large original fixture', items },
        { id: 'delete-fixture', name: 'Deletion sample', items: [] }],
        stats: { totalAnswered: 2000, totalRounds: 0, bySentence, events }, mastered, reinforceBook, deletedItems } }) });
    assert.equal(seeded.status, 200);
    await stop(); await start(3);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const contexts = await Promise.all([browser.newContext({ serviceWorkers: 'block' }), browser.newContext({ serviceWorkers: 'block' })]);
    const [a, b] = await Promise.all(contexts.map(c => c.newPage()));
    const writes = [], legacy = [], errors = [];
    for (const page of [a, b]) {
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => {
        const url = new URL(r.url());
        if (url.pathname === '/api/operations' && r.method() === 'POST') writes.push({ body: r.postDataJSON(), bytes: r.postDataBuffer().length });
        if (r.method() !== 'GET' && /\/api\/(data|import|sync\/.*|courses|deck\/publish)$/.test(url.pathname)) legacy.push(url.pathname);
      });
    }
    await Promise.all([boot(a), boot(b)]);
    const original = await cache(a), fullBytes = Buffer.byteLength(JSON.stringify(original));
    complete(original, 2000);
    assert.ok(fullBytes > 300 * 1024);
    for (let i = 0; i < 5; i++) {
      await a.evaluate(n => ServerStore.submitCommitted('learning.answer', {
        eventId: 'delta_answer_event_' + n, key: 'large-fixture#' + String(n).padStart(8, '0'),
        deckId: 'large-fixture', generation: 0, sessionId: 'delta-session-' + n, ok: true,
        occurredAt: Date.now(), mode: 'typing'
      }, { requestId: 'delta-answer-request-' + n }), i);
      const received = await delta(b);
      assert.equal(Object.keys(received.mem.stats.bySentence).length, 1, 'downlink contains only the changed sentence');
      assert.equal(received.mem.stats.events.length, 1);
      assert.equal(received.mem.decks.length, 0);
      const confirmed = await cache(b);
      complete(confirmed, 2001 + i);
      assert.equal(confirmed.mem.stats.bySentence[keyFor(i)].times, 4);
      assert.equal(confirmed.mem.stats.bySentence[keyFor(i)].sentence, original.mem.stats.bySentence[keyFor(i)].sentence);
    }
    await a.evaluate(() => ServerStore.submitCommitted('learning.mark', {
      eventId: 'delta_unmark_event_01', key: 'large-fixture#00000042', deckId: 'large-fixture', generation: 0, active: false
    }, { requestId: 'delta-unmark-request' }));
    const unmark = await delta(b);
    assert.ok(unmark.entityGone.mastered.includes(keyFor(42)));
    const unmarked = await cache(b);
    complete(unmarked, 2006, 799);
    assert.ok(!unmarked.mem.mastered[keyFor(42)]);
    await a.evaluate(() => ServerStore.submitCommitted('deck.delete', { deckId: 'delete-fixture' },
      { requestId: 'delta-delete-request', expectedRev: null }));
    const deletion = await delta(b);
    assert.ok(deletion.deleted.decks.includes('delete-fixture'));
    assert.ok(!deletion.deleted.decks.includes('large-fixture'), 'missing from delta does not mean deleted');
    assert.ok(!(await cache(b)).mem.decks.some(d => d.id === 'delete-fixture'));
    await boot(a);
    await a.evaluate(() => ServerStore.submitCommitted('learning.answer', {
      eventId: 'delta_after_reload_01', key: 'large-fixture#00000005', deckId: 'large-fixture', generation: 0,
      sessionId: 'delta-reloaded-session', ok: false, occurredAt: Date.now()
    }, { requestId: 'delta-after-reload-request' }));
    await delta(b);
    await boot(b);
    const final = await cache(b);
    complete(final, 2007, 799);
    assert.equal(final.mem.stats.totalAnswered, 2006);
    assert.equal(final.mem.stats.bySentence[keyFor(5)].times, 4);
    assert.ok(!final.mem.decks.some(d => d.id === 'delete-fixture'));
    assert.ok(!final.mem.mastered[keyFor(42)]);
    assert.equal(writes.length, 8);
    for (const write of writes) {
      assert.ok(write.bytes < 2048, 'ordinary operation stays below 2 KiB');
      assert.ok(!Object.hasOwn(write.body, 'mem') && !Object.hasOwn(write.body, 'statsDelta'));
    }
    assert.deepEqual(legacy, []); assert.deepEqual(errors, []);
    console.log('[protocol3 delta] 800 stats/2000 historical events retained; eight small writes, partial downlinks, tombstones and reload verified');
  } finally {
    if (browser) await browser.close();
    await stop();
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('cl-operation-delta-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
