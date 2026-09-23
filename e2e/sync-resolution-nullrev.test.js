'use strict';
/* F-002 regression (real browser). An account whose rows were persisted without a
 * revision (user_* .rev IS NULL, e.g. after a legacy unconditional write or a
 * restore) must survive the account-level "使用本机" replacement:
 *
 *   1. sync-conflict.js reads a `null` baseline as "absent OR unversioned", so an
 *      existing-but-unversioned row no longer fails with BASE_REV_MISMATCH;
 *   2. core.js keeps the confirmed revs in `_lastSyncMeta`, so the very next push
 *      reuses those revisions instead of sending an empty `revs` map that would
 *      make the server persist rev = NULL again (services/data-save.js:95).
 *
 * A third layer is pinned by the 409 assertions below: the SYNC_CONFLICT produced
 * by that judge must carry `status = 409`, otherwise routes/sync.js
 * (`resolutionResponse` -> `res.status(e.status || 500)`) answers 500 for a plain
 * conflict.
 *
 * Negative self-proof: reverting `sync-conflict.js` line 25 to
 *   baseRev === null ? !current : ...
 * makes the resolve below fail again (HTTP 500 / rows stay NULL), so the step-1
 * assertion goes red. The contrast checks (stale versioned baseline still rejected,
 * real conflict still 409) keep the guard from being blanket-disabled. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { freePort } = require('./lib/free-port');

const ROOT = path.resolve(__dirname, '..');
const Database = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));
const PORT = freePort(11860, 120);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sync-nullrev-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server, browser;

/* ---------- the judge itself carries 409 (single source of the 500 fix) ---------- */
{
  const { assertRevisionAccepted, assertBatchVersion } = require(path.join(ROOT, 'server', 'sync-conflict'));
  let revError = null;
  try { assertRevisionAccepted('kv', 'settings', 5, false, { v: 2 }, { rev: 7, deleted: false, value: { v: 1 } }, 3); }
  catch (e) { revError = e; }
  assert.equal(revError && revError.code, 'SYNC_CONFLICT', 'stale versioned baseline must still conflict');
  assert.equal(revError && revError.status, 409, 'SYNC_CONFLICT must carry 409, or routes/sync.js answers 500');
  let seqError = null;
  try { assertBatchVersion(1, 2); } catch (e) { seqError = e; }
  assert.equal(seqError && seqError.status, 409, 'BASE_SEQ_MISMATCH must also carry 409');
}

function database() { return new Database(path.join(DATA, 'chunklab.db'), { readonly: true, fileMustExist: true }); }
/* Read the persisted revision for one representative id in each of the four groups. */
function groupRevs() {
  const db = database();
  try {
    const pick = (sql) => { const row = db.prepare(sql).get(); return row ? row.rev : 'MISSING'; };
    return {
      decks: pick("SELECT rev FROM user_decks WHERE id='nr-deck'"),
      kv: pick("SELECT rev FROM user_kv WHERE k='settings'"),
      courses: pick("SELECT rev FROM user_courses WHERE course_id='nr-course'"),
      courseProgress: pick("SELECT rev FROM user_course_progress WHERE course_id='nr-prog'")
    };
  } finally { db.close(); }
}
function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: { ...process.env, PORT: String(PORT), CHUNKLAB_DATA_DIR: DATA, NODE_ENV: 'test' },
      stdio: 'ignore'
    });
    let tries = 0;
    const timer = setInterval(async () => {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exited')); return; }
      try { if ((await fetch(BASE + '/api/health')).ok) { clearInterval(timer); resolve(); return; } } catch (_) {}
      /* 300×100ms=30s readiness window: host node cold start measures ~5.4s and a
         smaller window is a flaky environment failure, not a real one. Success
         path returns as soon as health is 200, so the larger budget costs nothing. */
      if (++tries > 300) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}
function stopServer() {
  if (server && server.exitCode === null) { try { server.kill('SIGKILL'); } catch (_) {} }
  server = null;
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {}
}
async function request(method, url, body) {
  const res = await fetch(BASE + url, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null; try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

(async () => {
  await startServer();
  try {
    /* ---------- 0. precondition: every group is unversioned ---------- */
    /* The legacy unconditional write is accepted under NODE_ENV=test and leaves
       rev = NULL for each group it carries — exactly the state F-002 needs. */
    const seed = await request('PUT', '/api/data', {
      mem: { decks: [{ id: 'nr-deck', name: 'CLOUD', builtin: false, items: [{ sentence: 's', chunks: [] }] }], settings: { cloud: 1 } },
      courses: [{ courseId: 'nr-course', title: 'CLOUD', steps: [] }],
      courseProgress: { 'nr-prog': { step: 9 } }
    });
    assert.equal(seed.status, 200, 'seed write must succeed');
    assert.deepEqual(groupRevs(), { decks: null, kv: null, courses: null, courseProgress: null },
      'seed must leave all four groups unversioned (rev = NULL)');

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    /* A restored namespace is deliberately held locally and must go through the
       account-level comparison before cloud sync resumes; that is the entry point
       that reaches /api/sync/batch/resolve -> makeBatchReplacement. */
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
        localStorage.setItem('chunklab.restore-cloud-hold', '1');
      } catch (_) {}
    });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
    const resolveCalls = [];
    await page.route('**/api/sync/batch/resolve', async (route) => {
      const body = route.request().postData();
      const response = await route.fetch();
      resolveCalls.push({ body, status: response.status(), bodyText: await response.text() });
      await route.fulfill({ response });
    });

    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && window.BatchSync && window.SyncResolution && window.SyncResolutionUI, null, { timeout: 20000 });

    /* ---------- 1. "使用本机" over rev = NULL must succeed (was HTTP 500) ---------- */
    await page.evaluate(() => window.SyncResolutionUI.open());
    await page.waitForFunction(() => { const m = document.getElementById('syncResolveMask'); return m && !m.hidden; }, null, { timeout: 10000 });
    await page.waitForFunction(() => { const b = document.getElementById('syncKeepLocal'); return b && !b.hidden && !b.disabled; }, null, { timeout: 10000 });
    const resolveResponse = page.waitForResponse((r) => r.url().includes('/api/sync/batch/resolve'), { timeout: 20000 });
    await page.click('#syncKeepLocal');
    await resolveResponse;
    /* The dialog reports success only after the follow-up cloud push settles, so
       waiting for it also covers the "恢复 -> 紧随同步" boundary. */
    await page.waitForFunction(() => { const m = document.getElementById('syncResolveMessage'); return m && /\u5df2\u5904\u7406|\u540c\u6b65\u5df2\u5b8c\u6210/.test(m.textContent); }, null, { timeout: 20000 }).catch(() => {});

    const call = resolveCalls[resolveCalls.length - 1];
    assert.ok(call, 'the account-level replacement request must be sent');
    assert.equal(call.status, 200, 'rev = NULL account must accept "使用本机" (was 500): status=' + call.status + ' body=' + (call && call.bodyText));
    assert.equal(JSON.parse(call.bodyText).ok, true);

    /* ---------- 2. after "恢复 -> 紧随同步", every group keeps an integer rev ---------- */
    /* This is the Wave-2 tail: courses / courseProgress must not revert to NULL
       once the recovery's follow-up push reuses the confirmed base revisions. */
    await page.waitForFunction(async () => {
      try { const s = await BatchSync.state(); return !s.pending && s.status === 'clean'; } catch (_) { return false; }
    }, null, { timeout: 20000 }).catch(() => {});
    const afterResolve = groupRevs();
    for (const group of ['decks', 'kv', 'courses', 'courseProgress']) {
      assert.ok(Number.isSafeInteger(afterResolve[group]) && afterResolve[group] >= 1,
        group + ' rev must stay an integer after recovery + follow-up sync, got ' + afterResolve[group]);
    }

    /* ---------- 3. the NEXT edit is pushed against the confirmed baseline ---------- */
    /* Without candidate a (`_lastSyncMeta` nulled) the successor payload sends an
       empty revs map and the server writes rev = NULL for every kv key it carries
       (services/data-save.js:95), so the rows below would fall back to NULL. */
    const putBodies = [];
    await page.route('**/api/data', async (route) => {
      if (route.request().method() === 'PUT') { try { putBodies.push(JSON.parse(route.request().postData() || '{}')); } catch (_) {} }
      await route.continue();
    });
    const pushed = await page.evaluate(async () => {
      const mem = CL.loadMem();
      mem.settings = Object.assign({}, mem.settings, { f002Edited: Date.now() });
      if (await CL.saveAndNotify(mem) === false) return false;
      return CL.cloudSyncNow(CL.loadMem());
    });
    await page.waitForFunction(async () => {
      try { const s = await BatchSync.state(); return !s.pending && s.status === 'clean' && !CL.isDirty(); } catch (_) { return false; }
    }, null, { timeout: 20000 }).catch(() => {});
    assert.ok(putBodies.length > 0, 'the edit must be pushed upstream (captured PUT /api/data)');
    assert.ok(pushed !== false, 'cloudSyncNow must acknowledge the edit');
    const carried = putBodies.find((body) => body.revs && body.revs.kv && Object.keys(body.revs.kv).length);
    assert.ok(carried, 'the successor push must carry the confirmed rev baseline, not an empty revs map');
    const afterPush = groupRevs();
    for (const group of ['decks', 'kv', 'courses', 'courseProgress']) {
      assert.ok(Number.isSafeInteger(afterPush[group]) && afterPush[group] >= 1,
        group + ' rev must not fall back to NULL after the follow-up push, got ' + afterPush[group]);
    }

    /* ---------- 4. a genuine conflict on the same route is still 409, not 500 ---------- */
    /* The fixed null-rev path can no longer self-produce SYNC_CONFLICT (baseRevs
       always mirror the current snapshot), so the route-level 409 contract is
       proven with a real stale-token conflict; the SYNC_CONFLICT -> 409 mapping
       itself is pinned by the in-process assertions at the top of this file. */
    const stale = await page.evaluate(async () => {
      const res = await fetch('/api/sync/batch/resolve', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: 'stale-' + Date.now().toString(36), expectedToken: '0'.repeat(64), choice: 'local', local: CL.readSyncSnapshot() })
      });
      let body = null; try { body = await res.json(); } catch (_) {}
      return { status: res.status, code: body && body.code };
    });
    assert.equal(stale.status, 409, 'a genuine conflict must surface as 409, not 500');
    assert.equal(stale.code, 'RESOLUTION_STALE');

    assert.deepEqual(pageErrors, [], 'the page must not raise uncaught errors');
    console.log('[sync-resolution-nullrev e2e] "使用本机" accepted rev=NULL rows; four groups kept integer revs after recovery + follow-up push; conflicts still answer 409');
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} browser = null; }
    stopServer();
  }
})().catch((error) => { console.error(error.stack || error); stopServer(); process.exitCode = 1; });
