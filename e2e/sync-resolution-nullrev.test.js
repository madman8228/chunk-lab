'use strict';
/* Historical unversioned rows must survive protocol 3. Retired conflict writes
 * cannot replace courses or progress, and ordinary pages offer no conflict UI. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const Database = require('../server/node_modules/better-sqlite3');
const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(11860, 120);
const base = 'http://127.0.0.1:' + port;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-nullrev-cutover-'));
let server, browser;
async function start(protocol) {
  server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'),
    env: { ...process.env, PORT: String(port), CHUNKLAB_DATA_DIR: temp,
      NODE_ENV: 'test', REQUIRE_AUTH: 'false', CHUNKLAB_WRITE_PROTOCOL: String(protocol) }, stdio: 'ignore' });
  for (let attempt = 0; attempt < 300; attempt++) {
    if (server.exitCode !== null) throw new Error('isolated server exited');
    if (await fetch(base + '/api/health').then(r => r.ok).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated server startup timed out');
}
async function stop() {
  if (server && server.exitCode === null) {
    const ended = new Promise(resolve => server.once('exit', resolve));
    server.kill(); await ended;
  }
  server = null;
}
async function request(method, endpoint, body) {
  const response = await fetch(base + endpoint, { method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function storedRows() {
  const db = new Database(path.join(temp, 'chunklab.db'), { readonly: true });
  try {
    return Object.fromEntries(['user_decks', 'user_kv', 'user_courses', 'user_course_progress',
      'user_sentence_stats', 'user_events', 'user_entity_rows', 'user_operation_receipts',
      'user_operation_events', 'user_learning_events'].map(table =>
      [table, db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]));
  } finally { db.close(); }
}
(async () => {
  try {
    // Only this new temporary database enables the historical seeding protocol.
    await start(2);
    const seeded = await request('PUT', '/api/data', {
      mem: { decks: [{ id: 'nr-deck', name: 'Original deck', items: [{ sentence: 'Original sentence.', chunks: [] }] }], settings: { original: 1 } },
      courses: [{ courseId: 'nr-course', title: 'Original course', steps: [] }],
      courseProgress: { 'nr-prog': { step: 9 } }
    });
    assert.equal(seeded.status, 200);
    await stop();
    const original = storedRows();
    for (const table of ['user_decks', 'user_kv', 'user_courses', 'user_course_progress']) {
      assert.ok(original[table].length > 0, table + ' fixture exists');
      assert.ok(original[table].every(row => row.rev === null), table + ' fixture is unversioned');
    }
    await start(3);
    assert.deepEqual(storedRows(), original, 'upgrade preserves stored records');
    for (const [method, endpoint] of [['PUT', '/api/data'], ['POST', '/api/import'],
      ['POST', '/api/sync/batch/resolve'], ['POST', '/api/sync/resolve'],
      ['POST', '/api/courses'], ['DELETE', '/api/courses/nr-course'], ['POST', '/api/deck/publish']]) {
      const rejected = await request(method, endpoint, { requestId: 'retired-nullrev-attempt', choice: 'local',
        local: { mem: { decks: [] }, courses: [] }, mem: { decks: [] }, deckId: 'nr-deck', publish: false });
      assert.equal(rejected.status, 428, endpoint + ' refuses retired writes');
      assert.deepEqual(storedRows(), original, endpoint + ' preserves original rows');
    }
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const originalBrowser = JSON.stringify({ version: 2, decks: [{ id: 'unowned-original', name: 'Original local course', items: [] }] });
    await context.addInitScript(raw => { localStorage.setItem('chunklab.v1', raw); }, originalBrowser);
    const page = await context.newPage(), errors = [], retired = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', r => {
      if (r.method() !== 'GET' && /\/api\/(data|import|sync\/.*|courses|deck\/publish)$/.test(new URL(r.url()).pathname)) retired.push(r.url());
    });
    await page.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.serverPersistenceReady());
    assert.equal(await page.evaluate(() => !!document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog,[data-sync-conflict]')), false);
    assert.equal(await page.evaluate(() => typeof window.BatchSync), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.SyncResolution), 'undefined');
    assert.equal(await page.evaluate(() => localStorage.getItem('chunklab.v1')), originalBrowser);
    const confirmed = await page.evaluate(async () => (await ServerCache.read()).snapshot);
    assert.ok(confirmed.mem.decks.some(deck => deck.id === 'nr-deck'));
    assert.ok(confirmed.courses.some(course => course.courseId === 'nr-course'));
    assert.deepEqual(confirmed.courseProgress['nr-prog'], { step: 9 });
    assert.deepEqual(storedRows(), original, 'page startup preserves unversioned records');
    assert.deepEqual(retired, []); assert.deepEqual(errors, []);
    console.log('[nullrev cutover] original rows/browser data preserved; retired writes refused; conflict UI absent');
  } finally {
    if (browser) await browser.close();
    await stop();
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('cl-nullrev-cutover-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
