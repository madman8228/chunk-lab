'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(10650, 100);
const base = 'http://127.0.0.1:' + port;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-enrollment-p3-'));
let server;
let browser;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      const request = require('node:http').get(base + '/api/health', response => {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      request.on('error', () => {});
      request.setTimeout(600, () => request.destroy());
      if (++attempts >= 200) { clearInterval(timer); reject(new Error('isolated enrollment server did not start')); }
    }, 100);
  });
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, {
        PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3',
      }),
      stdio: 'ignore',
    });
    await waitForServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const enrollmentWrites = [];
    page.on('request', request => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return;
      try {
        const operation = JSON.parse(request.postData() || '{}');
        if (operation.type === 'course.enrollment') enrollmentWrites.push(operation);
      } catch (_) { /* Assertions below use server state as the source of truth. */ }
    });
    await page.addInitScript(() => {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    });
    await page.goto(base + '/decks.html?courseView=joined&courseType=decks', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.getCloudConfig && CL.getCloudConfig().writeProtocol === 3 &&
      CL.serverPersistenceReady() && window.CourseEnrollment, null, { timeout: 15000 });

    const legacyCourseWriteFence = await page.evaluate(async () => {
      const coursesBefore = CL.readCourses();
      const progressBefore = CL.readProgress();
      const memBefore = JSON.stringify(CL.loadMem());
      const pendingBefore = await IDBStore.listPendingOperations();
      const failures = [];
      for (const [kind, invoke] of [
        ['courses', () => CL.writeCourses([{ courseId:'legacy-whole-list-write', title:'must not save' }])],
        ['progress', () => CL.writeProgress({ 'legacy-whole-list-course': { completed:true } })],
        ['snapshot', () => CL.saveAndNotify(Object.assign({},CL.loadMem(),{totalAnswered:999999}))],
      ]) {
        try { await invoke(); failures.push({ kind, code:null }); }
        catch (error) { failures.push({ kind, code:error.code || null }); }
      }
      return { failures, coursesUnchanged:JSON.stringify(CL.readCourses())===JSON.stringify(coursesBefore),
        progressUnchanged:JSON.stringify(CL.readProgress())===JSON.stringify(progressBefore),
        memUnchanged:JSON.stringify(CL.loadMem())===memBefore,
        pendingUnchanged:(await IDBStore.listPendingOperations()).length===pendingBefore.length };
    });
    assert.deepEqual(legacyCourseWriteFence.failures.map(item=>item.code),
      ['PROTOCOL3_NARROW_WRITE_REQUIRED','PROTOCOL3_NARROW_WRITE_REQUIRED','PROTOCOL3_NARROW_WRITE_REQUIRED'],
      'protocol 3 rejects legacy whole-list course, progress and mem-snapshot writes');
    assert.equal(legacyCourseWriteFence.coursesUnchanged,true,'a rejected legacy course write cannot alter local state');
    assert.equal(legacyCourseWriteFence.progressUnchanged,true,'a rejected legacy progress write cannot alter local state');
    assert.equal(legacyCourseWriteFence.memUnchanged,true,'a rejected legacy full snapshot cannot alter local state');
    assert.equal(legacyCourseWriteFence.pendingUnchanged,true,'a rejected legacy write cannot create a stale sync intent');

    const seeded = await page.evaluate(async () => {
      const deck = { id: 'e2e-course-limit-candidate', name: '加入上限候选课程', items: [
        { sentence: 'A test sentence.', chunks: ['A test', 'sentence.'], hints: ['', ''] },
      ] };
      await ServerStore.submitCommitted('deck.put', { deck }, { requestId: 'e2e-course-limit-deck-001', expectedRev: null });
      for (let index = 1; index <= 3; index++) {
        await ServerStore.submitCommitted('course.enrollment', { courseId: 'e2e-existing-course-' + index, joined: true },
          { requestId: 'e2e-course-limit-join-00' + index });
      }
      await ServerCache.refresh();
      const cache = await ServerCache.read();
      const progress = ServerCache.projectCourseProgress(cache, await ServerStore.pending());
      await CL.adoptServerProgressProjection(progress);
      return { deckId: deck.id, joined: CourseEnrollment.joinedCount(),
        courseIds: Object.values(progress).filter(row => row && row.kind === 'course-enrollment' && row.joined).map(row => row.courseId) };
    });
    assert.equal(seeded.joined, 3, 'server-confirmed projection contains three joined courses before reopening the UI');
    assert.equal(seeded.courseIds.length, 3);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => CL.serverPersistenceReady() && document.querySelector('#deckList'), null, { timeout: 15000 });
    const candidate = page.locator('#deckList .deck-item').filter({ hasText: '加入上限候选课程' });
    await candidate.waitFor({ state: 'visible', timeout: 10000 });
    await candidate.locator('.course-manage-trigger').click();
    const blockedJoin = candidate.getByRole('menuitem', { name: '已达 3 门上限' });
    await blockedJoin.waitFor({ state: 'visible' });
    assert.equal(await blockedJoin.isDisabled(), true, 'the fourth course is visibly disabled after server-confirmed membership reaches three');
    assert.match(await blockedJoin.getAttribute('title'), /最多加入 3 门课程/);

    const finalState = await page.evaluate(async () => {
      const data = await ChunkAPI.getData();
      return {
        joined: Object.values(data.courseProgress || {}).filter(row => row && row.kind === 'course-enrollment' && row.joined).length,
        deckPresent: (data.mem.decks || []).some(deck => deck.id === 'e2e-course-limit-candidate'),
      };
    });
    assert.equal(finalState.joined, 3, 'the blocked UI action creates no fourth membership');
    assert.equal(finalState.deckPresent, true, 'the candidate course remains available in the local course library');
    assert.equal(enrollmentWrites.length, 3, 'opening the blocked action does not send another enrollment write');
    await context.close();
    console.log('[course-enrollment-protocol3] three joined courses persist across reload and disable a fourth join in the real UI');
  } catch (error) {
    console.error('[course-enrollment-protocol3] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => { server.once('close', resolve); server.kill('SIGTERM'); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
