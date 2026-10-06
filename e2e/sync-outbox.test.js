'use strict';
/* Real IndexedDB outbox boundaries for the current operation protocol. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const Database = require('../server/node_modules/better-sqlite3');
const { waitForAsync } = require('./lib/wait-for-async');
const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9400, 100), base = 'http://127.0.0.1:' + port;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-operation-outbox-'));
let server, browser;
async function boot(page) {
  await page.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CL && CL.serverPersistenceReady());
}
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
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage(), requests = [], legacy = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {
      const pathname = new URL(r.url()).pathname;
      if (pathname === '/api/operations' && r.method() === 'POST') requests.push(r.postDataJSON());
      if (r.method() !== 'GET' && /\/api\/(data|import|sync\/.*|courses|deck\/publish)$/.test(pathname)) legacy.push(pathname);
    });
    await boot(page);
    await page.evaluate(async () => {
      for (const id of ['delete-fixture', 'edit-fixture']) await ServerStore.submitCommitted('deck.put',
        { deck: { id, name: id, items: [] } }, { requestId: 'outbox-create-' + id, expectedRev: null });
    });
    await page.route('**/api/operations', route => route.abort());
    const deletion = await page.evaluate(() => ServerStore.submit('deck.delete', { deckId: 'delete-fixture' },
      { requestId: 'outbox-offline-delete', expectedRev: 1 }));
    assert.equal(deletion.durable, true);
    const originalDelete = await page.evaluate(async () => (await ServerStore.pending()).find(r => r.requestId === 'outbox-offline-delete').operation);
    await boot(page);
    const refreshedDelete = await page.evaluate(async () => (await ServerStore.pending()).find(r => r.requestId === 'outbox-offline-delete').operation);
    assert.deepEqual(refreshedDelete, originalDelete, 'refresh preserves the fixed deletion request');
    const beforeDelete = await page.evaluate(() => ChunkAPI.getData());
    assert.ok(beforeDelete.mem.decks.some(d => d.id === 'delete-fixture'), 'unacknowledged deletion has not changed server content');
    await page.unroute('**/api/operations');
    await page.evaluate(() => ServerStore.retryPending());
    await waitForAsync(page, async () => !(await ServerStore.pending()).some(r => r.requestId === 'outbox-offline-delete'));
    assert.ok(!(await page.evaluate(() => ChunkAPI.getData())).mem.decks.some(d => d.id === 'delete-fixture'));

    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    await page.route('**/api/operations', async route => {
      if (route.request().postDataJSON().requestId === 'outbox-fixed-edit') {
        entered(); await gate;
      }
      await route.continue();
    });
    await page.evaluate(async () => {
      window.outboxOriginalPayload = { deck: { id: 'edit-fixture', name: 'Fixed first edit', items: [] } };
      const queued = await ServerStore.submit('deck.put', window.outboxOriginalPayload,
        { requestId: 'outbox-fixed-edit', expectedRev: 1 });
      if (!queued.durable) throw new Error('first edit was not queued');
      window.outboxOriginalPayload.deck.name = 'Mutated caller object';
    });
    await started;
    await page.evaluate(() => ServerStore.submit('deck.put',
      { deck: { id: 'edit-fixture', name: 'Successor edit', items: [] } },
      { requestId: 'outbox-successor-edit', expectedRev: 2 }));
    const inFlight = await page.evaluate(async () => (await ServerStore.pending()).map(row => ({ id: row.requestId, operation: row.operation })));
    assert.equal(inFlight.find(r => r.id === 'outbox-fixed-edit').operation.payload.deck.name, 'Fixed first edit');
    assert.ok(inFlight.some(r => r.id === 'outbox-successor-edit'), 'successor remains durably queued while the first request is in flight');
    release();
    await waitForAsync(page, async () => (await ServerStore.pending()).length === 0);
    await page.unroute('**/api/operations');
    const updated = await page.evaluate(() => ChunkAPI.getData());
    assert.equal(updated.mem.decks.find(d => d.id === 'edit-fixture').name, 'Successor edit');
    assert.equal(updated.revs.decks['edit-fixture'], 3, 'each confirmed edit advances revision once');

    const invalid = await page.evaluate(async () => {
      try {
        await ServerStore.submit('deck.put', { deck: { id: 'uncloneable', name: 'Cannot persist', items: [], invalid: function () {} } },
          { requestId: 'outbox-uncloneable', expectedRev: null });
        return { failed: false };
      } catch (error) { return { failed: true, name: error.name, rows: await ServerStore.pending() }; }
    });
    assert.equal(invalid.failed, true, 'failed IndexedDB serialization rejects admission');
    assert.equal(invalid.name, 'DataCloneError', 'the test exercises the real IndexedDB clone failure');
    assert.deepEqual(invalid.rows, [], 'aborted admission leaves no partial queue row');
    assert.ok(!requests.some(r => r.requestId === 'outbox-uncloneable'), 'unpersisted request is never sent');
    assert.equal((await page.evaluate(() => ChunkAPI.getData())).mem.decks.find(d => d.id === 'edit-fixture').name, 'Successor edit');
    const db = new Database(path.join(temp, 'chunklab.db'), { readonly: true });
    try {
      for (const id of ['outbox-offline-delete', 'outbox-fixed-edit', 'outbox-successor-edit']) {
        assert.equal(db.prepare('SELECT count(*) n FROM user_operation_receipts WHERE request_id=?').get(id).n, 1);
      }
      assert.equal(db.prepare('SELECT count(*) n FROM user_decks WHERE id=?').get('uncloneable').n, 0);
    } finally { db.close(); }
    assert.deepEqual(legacy, []); assert.deepEqual(errors, []);
    console.log('[operation outbox] offline deletion survives reload; in-flight edits remain fixed; admission failure never sends');
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) { const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended; }
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('cl-operation-outbox-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
