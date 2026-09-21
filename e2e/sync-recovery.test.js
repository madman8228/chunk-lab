'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { freePort } = require('./lib/free-port');

const ROOT = path.resolve(__dirname, '..');
const Database = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));
const PORT = freePort(10250, 100);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sync-recovery-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;
function fakeToken(uid) {
  return 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ uid })).toString('base64url') + '.test';
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: { ...process.env, CHUNKLAB_DATA_DIR: DATA, PORT: String(PORT), NODE_ENV: 'test' },
      stdio: 'ignore'
    });
    let tries = 0;
    const timer = setInterval(async () => {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exited')); return; }
      try { if ((await fetch(BASE + '/api/health')).ok) { clearInterval(timer); resolve(); return; } } catch (_) {}
      /* 就绪窗口 300×100ms=30s。原为 100×100ms=10s，对宿主 node 冷启动实测 5.4s 只有 1.85× 余量，
         属临界带（同库 6s 窗口已实测会随负载翻红）。health 一旦 200 立即 resolve，成功路径不增加耗时。 */
      if (++tries > 300) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (_) {} }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {}
}
async function boot(page) {
  await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CL && window.BatchSync && window.SyncResolution, null, { timeout: 20000 });
  await page.evaluate(() => { window.__syncRecoveryBootTrace = [{ event: 'runtime-ready' }]; });
  await page.evaluate(async () => {
    window.__syncRecoveryBootTrace.push({ event: 'ensureCloud:start' });
    await CL.ensureCloud();
    window.__syncRecoveryBootTrace.push({ event: 'ensureCloud:done' });
    window.__syncRecoveryBootTrace.push({ event: 'waitForSync:start' });
    await CL.waitForSync();
    window.__syncRecoveryBootTrace.push({ event: 'waitForSync:done' });
  });
  await page.waitForFunction(async () => {
    try { const state = await BatchSync.state(); return Number.isSafeInteger(state.baseline) && state.baseline >= 0; }
    catch (_) { return false; }
  }, null, { timeout: 20000 });
  if (process.env.SYNC_TRACE) {
    console.log('[sync-trace] ' + JSON.stringify(await page.evaluate(() => window.__syncRecoveryBootTrace)));
  }
}
async function ensureBaseline(page) {
  await page.evaluate(() => CL.syncFromCloud());
  await page.waitForFunction(async () => {
    const state = await BatchSync.state();
    return Number.isSafeInteger(state.baseline) && state.baseline >= 0;
  }, null, { timeout: 20000 });
}
async function edit(page, name) {
  return page.evaluate(async (nextName) => {
    const mem = CL.loadMem();
    let deck = mem.decks.find((item) => item.id === 'recovery-deck');
    if (!deck) {
      deck = { id: 'recovery-deck', name: nextName, builtin: false, items: [{ sentence: 'Recovery test', translation: '', chunks: ['Recovery', 'test'], hints: [], alts: [] }] };
      mem.decks.push(deck);
    } else deck.name = nextName;
    if (CL.saveAndNotify(mem) === false) return false;
    return CL.cloudSyncNow(CL.loadMem());
  }, name);
}
async function editLocalOnly(page, name) {
  return page.evaluate((nextName) => {
    const mem = CL.loadMem();
    const deck = mem.decks.find((item) => item.id === 'recovery-deck');
    if (!deck) throw new Error('recovery deck missing');
    deck.name = nextName;
    return CL.saveAndNotify(mem) !== false;
  }, name);
}
async function editWithEvent(page, name, eventId) {
  return page.evaluate(async ({ nextName, id }) => {
    const mem = CL.loadMem();
    const deck = mem.decks.find((item) => item.id === 'recovery-deck');
    if (!deck) throw new Error('recovery deck missing');
    deck.name = nextName;
    mem.stats.events = Array.isArray(mem.stats.events) ? mem.stats.events : [];
    mem.stats.events.push({ id, kind: 'answer', key: 'recovery-deck#event', ok: true, at: Date.now() });
    if (await CL.saveAndNotify(mem) === false) return false;
    return CL.cloudSyncNow(CL.loadMem());
  }, { nextName: name, id: eventId });
}
async function editLocalOnlyNoSync(page, name, eventId) {
  return page.evaluate(async ({ nextName, id }) => {
    const mem = CL.loadMem();
    const deck = mem.decks.find((item) => item.id === 'recovery-deck');
    if (!deck) throw new Error('recovery deck missing');
    deck.name = nextName;
    if (id) {
      mem.stats.events = Array.isArray(mem.stats.events) ? mem.stats.events : [];
      mem.stats.events.push({ id, kind: 'answer', key: 'recovery-deck#event', ok: true, at: Date.now() });
    }
    if (CL.saveMem(mem) === false) return false;
    return (await CL.lastSave()) !== false;
  }, { nextName: name, id: eventId || null });
}
async function pull(page) {
  return page.evaluate(() => CL.syncFromCloud());
}
async function editAfterBaseline(page, name, eventId) {
  if (eventId) {
    if (await editWithEvent(page, name, eventId)) return true;
  } else if (await edit(page, name)) return true;
  /* A background pull may have advanced this fresh page while the scenario
     was being prepared. Rebase once, then retry the intended edit. */
  await pull(page);
  return eventId ? editWithEvent(page, name, eventId) : edit(page, name);
}
async function waitRemoteDeck(page, name) {
  await page.waitForFunction(async (expected) => {
    try {
      const remote = await ChunkAPI.getSyncBatch();
      return remote && remote.snapshot && remote.snapshot.mem &&
        remote.snapshot.mem.decks.some((deck) => deck.id === 'recovery-deck' && deck.name === expected);
    } catch (_) { return false; }
  }, name, { timeout: 20000 });
}
async function stagePendingForRecovery(page) {
  return page.evaluate(async () => {
    let state = await BatchSync.state();
    if (!Number.isSafeInteger(state.baseline) || state.baseline < 0) {
      const remote = await ChunkAPI.getSyncBatch();
      await BatchSync.observe(remote.seq, state.baseline);
      state = await BatchSync.state();
    }
    const pending = await BatchSync.stage({ mem: {} }, state.baseline, state.localGeneration, []);
    return pending.requestId;
  });
}
async function runInjectedReceiptActivationFailure(browser, kind) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await boot(page);
    await ensureBaseline(page);
    const snapshots = await page.evaluate(async (failureKind) => {
      const original = CL.readSyncSnapshot();
      const target = JSON.parse(JSON.stringify(original));
      if (failureKind === 'courses') {
        target.courses = Array.isArray(target.courses) ? target.courses : [];
        target.courses.push({ courseId: 'injected-course', title: 'Injected course' });
      } else {
        target.courseProgress = target.courseProgress && typeof target.courseProgress === 'object'
          ? target.courseProgress : {};
        target.courseProgress['injected-course'] = { step: 7 };
      }
      const state = await BatchSync.state();
      return { original, target, seq: state.baseline + 1 };
    }, kind);
    const view = {
      batch: true, entity: 'batch', id: 'synthetic-' + kind + '-activation',
      local: { rev: 0, deleted: false, value: snapshots.original },
      remote: { rev: snapshots.seq, deleted: false, value: snapshots.target },
      remoteToken: 'a'.repeat(64)
    };
    view.id = await stagePendingForRecovery(page);
    const patched = await page.evaluate((failureKind) => {
      const method = failureKind === 'courses' ? 'updateCourses' : 'updateProgress';
      window.__recoveryOriginalUpdate = IDBStore[method];
      IDBStore[method] = () => Promise.reject(new Error('injected ' + failureKind + ' persistence failure'));
      return method;
    }, kind);
    assert.equal(patched, kind === 'courses' ? 'updateCourses' : 'updateProgress');
    let posts = 0;
    await page.route('**/api/sync/batch/resolve', async (route) => {
      posts += 1;
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, kind: 'batch', requestId: body.requestId, choice: 'remote',
        seq: snapshots.seq, snapshot: snapshots.target
      }) });
    });
    await assert.rejects(() => page.evaluate((pendingView) => SyncResolution.resolve(pendingView, 'remote'), view));
    const failed = await page.evaluate(async () => ({
      view: await SyncResolution.preview(), batch: await BatchSync.state()
    }));
    assert.equal(failed.view.pendingState, 'applying', JSON.stringify(failed.view));
    assert.ok(failed.batch.pending);
    assert.equal(posts, 1);
    await page.unroute('**/api/sync/batch/resolve');
    await boot(page);
    assert.ok(await page.evaluate(() => SyncResolution.preview()), 'reload must retain the applying receipt');
    await page.evaluate(() => SyncResolution.retry());
    await page.waitForFunction(async () => {
      const view = await SyncResolution.preview();
      const state = await BatchSync.state();
      return !view && !state.pending && state.status === 'clean';
    }, null, { timeout: 20000 });
    const applied = await page.evaluate((failureKind) => ({
      courses: CL.readCourses().some((course) => course.courseId === 'injected-course'),
      progress: CL.readProgress()['injected-course']?.step === 7,
      kind: failureKind
    }), kind);
    assert.equal(kind === 'courses' ? applied.courses : applied.progress, true);
    assert.equal(posts, 1, 'receipt retry must not post a second resolve request');
  } finally {
    await page.close();
    await ctx.close();
  }
}
async function runInjectedBaselineFailure(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await boot(page);
    await ensureBaseline(page);
    const snapshots = await page.evaluate(async () => {
      const original = CL.readSyncSnapshot();
      const state = await BatchSync.state();
      return { original, seq: state.baseline + 1 };
    });
    const view = {
      batch: true, entity: 'batch', id: 'synthetic-baseline-activation',
      local: { rev: 0, deleted: false, value: snapshots.original },
      remote: { rev: snapshots.seq, deleted: false, value: snapshots.original },
      remoteToken: 'b'.repeat(64)
    };
    view.id = await stagePendingForRecovery(page);
    await page.evaluate(() => {
      window.__recoveryOriginalFinishResolution = BatchSync.finishResolution;
      BatchSync.finishResolution = () => Promise.reject(new Error('injected baseline confirmation failure'));
    });
    let posts = 0;
    await page.route('**/api/sync/batch/resolve', async (route) => {
      posts += 1;
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, kind: 'batch', requestId: body.requestId, choice: 'local',
        seq: snapshots.seq, snapshot: snapshots.original
      }) });
    });
    await assert.rejects(() => page.evaluate((pendingView) => SyncResolution.resolve(pendingView, 'local'), view));
    const failed = await page.evaluate(async () => ({
      view: await SyncResolution.preview(), batch: await BatchSync.state()
    }));
    assert.equal(failed.view.pendingState, 'applying', JSON.stringify(failed.view));
    assert.ok(failed.batch.pending);
    assert.equal(posts, 1);
    await page.unroute('**/api/sync/batch/resolve');
    await boot(page);
    assert.ok(await page.evaluate(() => SyncResolution.preview()), 'reload must retain a receipt whose baseline was not confirmed');
    await page.evaluate(() => SyncResolution.retry());
    await page.waitForFunction(async () => {
      const view = await SyncResolution.preview();
      const state = await BatchSync.state();
      return !view && !state.pending && state.status === 'clean';
    }, null, { timeout: 20000 });
    assert.equal(posts, 1, 'baseline retry must reuse the same receipt');
  } finally {
    await page.close();
    await ctx.close();
  }
}
async function runAutoReconcileGuard(browser, kind) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await boot(page);
    const result = await page.evaluate((guardKind) => {
      const base = CL.readSyncSnapshot();
      const changed = JSON.parse(JSON.stringify(base));
      const key = 'recovery-deck#guard-sentence';
      if (guardKind === 'mastered-cancel') {
        base.mem.mastered = Object.assign({}, base.mem.mastered, {
          [key]: { markedAt: 1, deckId: 'recovery-deck' }
        });
        delete changed.mem.mastered?.[key];
      } else {
        delete base.mem.deletedItems?.[key];
        changed.mem.deletedItems = Object.assign({}, changed.mem.deletedItems, { [key]: true });
      }
      const metadataOnly = JSON.parse(JSON.stringify(changed));
      metadataOnly.generation = (metadataOnly.generation || 0) + 1;
      metadataOnly.revs = { ...(metadataOnly.revs || {}), marker: 'sync-metadata-only' };
      return {
        businessDiff: CL.sameBatchBusiness(base, changed),
        metadataOnlyEqual: CL.sameBatchBusiness(changed, metadataOnly)
      };
    }, kind);
    assert.equal(result.businessDiff, false, kind + ' must remain a business difference');
    assert.equal(result.metadataOnlyEqual, true, kind + ' metadata-only changes may auto-reconcile');
  } finally {
    await page.close();
    await ctx.close();
  }
}
function archiveCount(requestId) {
  const db = new Database(path.join(DATA, 'chunklab.db'), { readonly: true, fileMustExist: true });
  try { return db.prepare('SELECT count(*) AS n FROM user_sync_resolutions WHERE request_id=?').get(requestId).n; }
  finally { db.close(); }
}

(async () => {
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  let tabCtx, c, d, freshCtx, e;
  try {
    await boot(a); await boot(b);
    assert.equal(await edit(a, 'baseline'), true);
    await pull(b);
    await edit(a, 'same-content');
    assert.equal(await edit(b, 'same-content'), false, '第二设备应先收到账号基线冲突');
    const result = await pull(b);
    const state = await b.evaluate(async (pullResult) => ({
      result: pullResult, conflict: CL.getSyncConflict(), batch: await BatchSync.state(),
      name: CL.loadMem().decks.find((item) => item.id === 'recovery-deck').name
    }), result);
    assert.ok(state.result);
    assert.equal(state.conflict, null);
    assert.equal(state.batch.pending, null);
    assert.equal(state.batch.status, 'clean');
    assert.equal(state.name, 'same-content');
    console.log('[sync-recovery] auto recovery uses one durable request and leaves a clean baseline');
    await pull(a);

    /* A committed response can disappear at the browser boundary. The next
       startup must reuse the journaled operation/receipt instead of creating
       a second archive or silently pulling over the local result. */
    assert.equal(await edit(a, 'lost-response-same'), true);
    assert.equal(await editLocalOnly(b, 'lost-response-same'), true);
    assert.equal(await b.evaluate(() => CL.cloudSyncNow(CL.loadMem())), false);
    let lostReceipt;
    await b.route('**/api/sync/batch/resolve', async (route) => {
      const response = await route.fetch();
      lostReceipt = await response.json();
      await route.abort('failed');
    });
    await pull(b);
    await b.unroute('**/api/sync/batch/resolve');
    assert.ok(lostReceipt, 'the recovery POST must reach the server before its response is dropped');
    assert.equal(archiveCount(lostReceipt.requestId), 1, 'server must archive the lost-response request once');
    await boot(b);
    await b.waitForFunction(async () => {
      try {
        const view = await SyncResolution.preview();
        const batch = await BatchSync.state();
        return !view && !CL.isDirty() && !batch.pending && batch.status === 'clean';
      } catch (_) { return false; }
    }, null, { timeout: 20000 });
    const resumed = await b.evaluate(async () => ({
      view: await SyncResolution.preview(), batch: await BatchSync.state(),
      name: CL.loadMem().decks.find((item) => item.id === 'recovery-deck').name
    }));
    assert.equal(resumed.view, null, 'startup should finish an auto pending journal');
    assert.equal(resumed.batch.pending, null);
    assert.equal(resumed.batch.status, 'clean');
    assert.equal(resumed.name, 'lost-response-same');
    assert.equal(archiveCount(lostReceipt.requestId), 1, 'refresh recovery must not create a duplicate archive');
    console.log('[sync-recovery] reload resumes a committed auto request without a duplicate archive');
    await boot(a);

    /* Two pages in one browser context share IDB. Only one may consume the
       durable recovery journal; the waiting page must not overwrite it. */
    tabCtx = await browser.newContext();
    c = await tabCtx.newPage();
    d = await tabCtx.newPage();
    await boot(c); await boot(d);
    /* The first two contexts have finished all of their assertions. Release
       them before opening the remaining multi-page recovery scenarios; the
       full browser manifest runs this test after several other Chromium
       suites and keeping idle renderers alive makes the later page creation
       sensitive to host resource pressure. */
    await ctxA.close();
    await ctxB.close();
    const parallelLocalCtx = await browser.newContext();
    const parallelLocal = await parallelLocalCtx.newPage();
    await boot(parallelLocal);
    assert.equal(await editAfterBaseline(parallelLocal, 'parallel-local'), true);
    await parallelLocalCtx.close();
    assert.equal(await editLocalOnly(d, 'parallel-remote'), true);
    assert.equal(await d.evaluate(() => CL.cloudSyncNow(CL.loadMem())), false);
    const parallelView = await d.evaluate(() => SyncResolution.preview());
    let parallelReceipt;
    await d.route('**/api/sync/batch/resolve', async (route) => {
      const response = await route.fetch();
      parallelReceipt = await response.json();
      await route.abort('failed');
    });
    await assert.rejects(() => d.evaluate((view) => SyncResolution.resolve(view, 'local'), parallelView));
    await d.unroute('**/api/sync/batch/resolve');
    const concurrent = await Promise.allSettled([
      c.evaluate(() => SyncResolution.retry()),
      d.evaluate(() => SyncResolution.retry())
    ]);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1, 'only one tab may consume the journal');
    assert.equal(archiveCount(parallelReceipt.requestId), 1);
    await c.close();
    console.log('[sync-recovery] same-account tabs serialize recovery through navigator.locks');

    /* Capacity is a blocked state, not a transient retry loop. Refreshing a
       blocked journal must not submit another resolution; an explicit retry
       is the only action that may send a new request. */
    freshCtx = await browser.newContext();
    e = await freshCtx.newPage();
    await boot(e);
    await e.evaluate(() => CL.syncFromCloud());
    await e.waitForFunction(async () => {
      const state = await BatchSync.state();
      return Number.isSafeInteger(state.baseline) && state.baseline >= 0;
    }, null, { timeout: 20000 });
    assert.equal(await edit(e, 'capacity-local'), true);
    assert.equal(await editLocalOnly(d, 'capacity-remote'), true);
    assert.equal(await d.evaluate(() => CL.cloudSyncNow(CL.loadMem())), false);
    const capacityView = await d.evaluate(() => SyncResolution.preview());
    let capacityPosts = 0;
    await d.route('**/api/sync/batch/resolve', async (route) => {
      capacityPosts += 1;
      await route.fulfill({ status: 507, contentType: 'application/json',
        body: JSON.stringify({ error: '服务器冲突归档空间已满', code: 'RESOLUTION_ARCHIVE_FULL' }) });
    });
    await assert.rejects(() => d.evaluate((view) => SyncResolution.resolve(view, 'local'), capacityView));
    assert.equal(capacityPosts, 1);
    await boot(d);
    await boot(d);
    const blocked = await d.evaluate(() => SyncResolution.preview());
    assert.equal(blocked.pendingState, 'blocked-capacity');
    assert.equal(capacityPosts, 1, 'refresh must not auto-submit a capacity-blocked request');
    await assert.rejects(() => d.evaluate(() => SyncResolution.retry()));
    assert.equal(capacityPosts, 2, 'explicit retry may submit the blocked request');
    await d.unroute('**/api/sync/batch/resolve');
    await e.close();
    await freshCtx.close();
    console.log('[sync-recovery] capacity blocks stay quiet across refresh until explicit retry');

    /* A learner may finish an answer while the resolution POST is still in
       flight. The committed receipt must be retained, but activation must
       stop at LOCAL_CHANGED so the new answer cannot be overwritten. */
    const answerCtx = await browser.newContext();
    const f = await answerCtx.newPage();
    const g = await answerCtx.newPage();
    await boot(f);
    await ensureBaseline(f);
    const answerBaselineEdited = await editAfterBaseline(f, 'answer-baseline');
    if (!answerBaselineEdited) {
      const diagnostic = await f.evaluate(async () => ({
        conflict: CL.getSyncConflict(), dirty: CL.isDirty(), batch: await BatchSync.state(),
        remote: await ChunkAPI.getSyncBatch(), name: CL.loadMem().decks.find((item) => item.id === 'recovery-deck')?.name
      }));
      assert.fail('answer baseline edit failed: ' + JSON.stringify(diagnostic));
    }
    await waitRemoteDeck(f, 'answer-baseline');
    await boot(g);
    await pull(g);
    await g.evaluate(() => CL.setResolutionPaused(true));
    await g.evaluate(() => CL.waitForSync());
    assert.equal(await editAfterBaseline(f, 'answer-remote'), true);
    await waitRemoteDeck(f, 'answer-remote');
    assert.equal(await editLocalOnlyNoSync(g, 'answer-local'), true);
    const answerView = await g.evaluate(() => {
      return ChunkAPI.getSyncBatch().then((remote) => ({
        batch: true, entity: 'batch', id: 'answer-during-resolution-1',
        local: { rev: 0, deleted: false, value: CL.readSyncSnapshot() },
        remote: { rev: remote.seq, deleted: false, value: remote.snapshot }, remoteToken: remote.token
      }));
    });
    answerView.id = await g.evaluate(async () => {
      const state = await BatchSync.state();
      const pending = await BatchSync.stage({ mem: {} }, state.baseline, state.localGeneration, []);
      return pending.requestId;
    });
    let releaseAnswer;
    const answerGate = new Promise((resolve) => { releaseAnswer = resolve; });
    await g.route('**/api/sync/batch/resolve', async (route) => {
      const response = await route.fetch();
      await answerGate;
      await route.fulfill({ response });
    });
    const answerRequest = g.waitForRequest('**/api/sync/batch/resolve', { timeout: 10000 });
    const answerResolution = g.evaluate((view) => SyncResolution.resolve(view, 'local'), answerView)
      .then(() => ({ ok: true }), (error) => ({ ok: false, code: error.code || error.message }));
    await answerRequest;
    const answerSave = await g.evaluate(async () => {
      const mem = CL.loadMem();
      mem.stats.events = Array.isArray(mem.stats.events) ? mem.stats.events : [];
      mem.stats.events.push({ id: 'answer-during-resolution', kind: 'answer', key: 'recovery-deck#event', ok: true, at: Date.now() });
      return await CL.saveAndNotify(mem);
    });
    assert.equal(answerSave, true, 'answer made while the resolution request is in flight must persist locally');
    releaseAnswer();
    const answerOutcome = await answerResolution;
    await g.unroute('**/api/sync/batch/resolve');
    const answerState = await g.evaluate(async () => ({
      outcome: null,
      view: await SyncResolution.preview(),
      event: CL.loadMem().stats.events.some((event) => event.id === 'answer-during-resolution'),
      batch: await BatchSync.state()
    }));
    answerState.outcome = answerOutcome;
    assert.match(answerState.outcome.code, /LOCAL_CHANGED|本机已有新修改/);
    assert.equal(answerState.view.pendingState, 'blocked-local-change');
    assert.equal(answerState.event, true);
    assert.ok(answerState.batch.pending, 'the committed receipt must not clear the pending batch');
    console.log('[sync-recovery] an answer during resolution is retained and blocks activation');
    await f.close(); await g.close(); await answerCtx.close();

    /* If local activation fails after the server has committed, refresh must
       replay the receipt and finish locally without posting a new request. */
    const storageCtx = await browser.newContext();
    const h = await storageCtx.newPage();
    const i = await storageCtx.newPage();
    await boot(h); await boot(i);
    await i.evaluate(() => CL.setResolutionPaused(true));
    await i.evaluate(() => CL.waitForSync());
    assert.equal(await editWithEvent(h, 'storage-baseline', 'storage-base-event'), true);
    await pull(i);
    assert.equal(await editAfterBaseline(h, 'storage-remote', 'storage-remote-event'), true);
    await waitRemoteDeck(h, 'storage-remote');
    assert.equal(await editLocalOnlyNoSync(i, 'storage-local', 'storage-local-event'), true);
    const storageView = await i.evaluate(() => {
      return ChunkAPI.getSyncBatch().then((remote) => ({
        batch: true, entity: 'batch', id: 'storage-failure-reload-1',
        local: { rev: 0, deleted: false, value: CL.readSyncSnapshot() },
        remote: { rev: remote.seq, deleted: false, value: remote.snapshot }, remoteToken: remote.token
      }));
    });
    const expectedStorage = {
      name: storageView.remote.value.mem.decks.find((item) => item.id === 'recovery-deck').name,
      event: storageView.remote.value.mem.stats.events.some((event) => event.id === 'storage-remote-event')
    };
    assert.equal(expectedStorage.name, 'storage-remote', 'storage failure scenario must capture the remote target');
    storageView.id = await i.evaluate(async () => {
      const state = await BatchSync.state();
      const pending = await BatchSync.stage({ mem: {} }, state.baseline, state.localGeneration, []);
      return pending.requestId;
    });
    const originalWriteStatsBatch = await i.evaluate(() => {
      window.__originalWriteStatsBatch = IDBStore.writeStatsBatch;
      IDBStore.writeStatsBatch = () => Promise.reject(new Error('injected stats persistence failure'));
      return true;
    });
    assert.equal(originalWriteStatsBatch, true);
    let storagePosts = 0;
    await i.route('**/api/sync/batch/resolve', async (route) => {
      storagePosts += 1;
      await route.continue();
    });
    await assert.rejects(() => i.evaluate((view) => SyncResolution.resolve(view, 'remote'), storageView));
    assert.equal(storagePosts, 1);
    const failedStorage = await i.evaluate(async () => ({
      view: await SyncResolution.preview(), batch: await BatchSync.state(),
      localEvent: CL.loadMem().stats.events.some((event) => event.id === 'storage-local-event')
    }));
    assert.equal(failedStorage.view.pendingState, 'applying', JSON.stringify(failedStorage.view));
    assert.ok(failedStorage.batch.pending);
    assert.equal(failedStorage.localEvent, true);
    await i.unroute('**/api/sync/batch/resolve');
    await boot(i);
    const pendingAfterStorageReload = await i.evaluate(() => SyncResolution.preview());
    if (pendingAfterStorageReload) {
      try { await i.evaluate(() => SyncResolution.retry()); }
      catch (error) {
        const debug = await i.evaluate(() => {
          return SyncResolution.preview().then((view) => ({
            current: CL.readSyncSnapshot(),
            pendingState: view && view.pendingState,
            original: view && view.pendingOriginal,
            receipt: view && view.pendingReceipt
          }));
        });
        throw new Error((error.message || error) + '\n' + JSON.stringify(debug));
      }
    }
    await i.waitForFunction(async () => {
      const view = await SyncResolution.preview();
      const batch = await BatchSync.state();
      return !view && !batch.pending && batch.status === 'clean';
    }, null, { timeout: 20000 });
    const recoveredStorage = await i.evaluate(() => ({
      name: CL.loadMem().decks.find((item) => item.id === 'recovery-deck').name,
      remoteEvent: CL.loadMem().stats.events.some((event) => event.id === 'storage-remote-event')
    }));
    assert.equal(recoveredStorage.name, expectedStorage.name);
    assert.equal(recoveredStorage.remoteEvent, expectedStorage.event);
    assert.equal(storagePosts, 1, 'refresh must reuse the receipt and never duplicate the resolve POST');
    console.log('[sync-recovery] storage failure leaves an applying receipt that reload completes');
    await h.close(); await i.close(); await storageCtx.close();

    /* Course rows, course progress, and the accepted conditional baseline are
       separate durable boundaries. Each injected failure must retain the same
       committed receipt and complete after reload without another POST. */
    await runInjectedReceiptActivationFailure(browser, 'courses');
    console.log('[sync-recovery] courses activation failure reloads from the receipt');
    await runInjectedReceiptActivationFailure(browser, 'progress');
    console.log('[sync-recovery] progress activation failure reloads from the receipt');
    await runInjectedBaselineFailure(browser);
    console.log('[sync-recovery] baseline confirmation failure reloads from the receipt');
    await runAutoReconcileGuard(browser, 'mastered-cancel');
    console.log('[sync-recovery] cancelling mastered state remains a manual conflict');
    await runAutoReconcileGuard(browser, 'deleted-items');
    console.log('[sync-recovery] deleted-item state remains a manual conflict');

    /* Switching identity while the HTTP request is in flight must not move
       the old account's journal into the new account's namespace. Switching
       back must reveal the still-unfinished old-account request. */
    const switchCtx = await browser.newContext();
    const j = await switchCtx.newPage();
    await boot(j);
    const switchView = await j.evaluate(() => {
      return ChunkAPI.getSyncBatch().then((remote) => ({
        batch: true, entity: 'batch', id: 'account-switch-in-flight-1',
        local: { rev: 0, deleted: false, value: CL.readSyncSnapshot() },
        remote: { rev: remote.seq, deleted: false, value: remote.snapshot }, remoteToken: remote.token
      }));
    });
    let releaseSwitch;
    const switchGate = new Promise((resolve) => { releaseSwitch = resolve; });
    await j.route('**/api/sync/batch/resolve', async (route) => {
      try {
        const response = await route.fetch();
        await switchGate;
        await route.fulfill({ response });
      } catch (_) { try { await route.abort('failed'); } catch (_) {} }
    });
    const switchRequest = j.waitForRequest('**/api/sync/batch/resolve', { timeout: 10000 });
    const inFlight = j.evaluate((view) => SyncResolution.resolve(view, 'local'), switchView)
      .catch(() => null);
    await switchRequest;
    const toB = j.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
    await j.evaluate((token) => ChunkAPI.setToken(token), fakeToken('recovery-account-b')).catch(() => {});
    await toB;
    await j.waitForFunction(() => window.CL && window.SyncResolution, null, { timeout: 20000 });
    const bView = await j.evaluate(() => SyncResolution.preview());
    assert.equal(bView, null, 'new account must not see the old account recovery journal');
    const toA = j.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
    await j.evaluate(() => ChunkAPI.clearToken()).catch(() => {});
    await toA;
    await j.waitForFunction(() => window.CL && window.SyncResolution, null, { timeout: 20000 });
    const aView = await j.evaluate(() => SyncResolution.preview());
    assert.ok(aView && aView.pending === true, 'switching back must reveal the old account recovery journal');
    releaseSwitch();
    await inFlight;
    await j.unroute('**/api/sync/batch/resolve');
    console.log('[sync-recovery] account switch isolates the in-flight recovery journal');
    await j.close(); await switchCtx.close();
  } finally {
    await a.close(); await b.close();
    if(c) await c.close(); if(d) await d.close(); if(e) await e.close();
    await ctxA.close(); await ctxB.close(); if(tabCtx) await tabCtx.close(); if(freshCtx) await freshCtx.close();
    await browser.close(); stopServer();
  }
})().catch((error) => { console.error(error.stack || error); stopServer(); process.exitCode = 1; });
