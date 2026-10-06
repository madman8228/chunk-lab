/* Real main.html answer → durable queue → protocol-3 SQLite persistence. */
'use strict';
const { waitForAsync } = require('./lib/wait-for-async');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { gunzipSync, gzipSync } = require('node:zlib');
const { spawn } = require('node:child_process');
const Database = require('../server/node_modules/better-sqlite3');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9800, 100);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-main-persistence-'));
const base = 'http://127.0.0.1:' + port;
let server;
let browser;
let page;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      const req = http.get(base + '/api/health', response => {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      req.on('error', () => {});
      req.setTimeout(600, () => req.destroy());
      if (++attempts >= 200) { clearInterval(timer); reject(new Error('isolated protocol-3 server did not start')); }
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
    page = await context.newPage();
    const legacyWrites = [];
    const legacyFenceProbeWrites = [];
    let legacyFenceProbeActive = false;
    const protocolWrites = [];
    const failedRequests = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() !== 'GET' && ['/api/data', '/api/import'].includes(url.pathname)) {
        (legacyFenceProbeActive ? legacyFenceProbeWrites : legacyWrites).push({ method: request.method(), path: url.pathname });
      }
      if (request.method() === 'POST' && url.pathname === '/api/operations') {
        try { protocolWrites.push(JSON.parse(request.postData() || '{}')); } catch (_) { /* malformed requests fail their E2E assertions */ }
      }
    });
    page.on('requestfailed', request => failedRequests.push({url:request.url(),failure:request.failure() && request.failure().errorText}));
    page.on('pageerror', error => console.error('[main-persistence] page error:', error.message));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('main-persistence-fixture-seeded') === '1') return;
      sessionStorage.setItem('main-persistence-fixture-seeded', '1');
      const items = [
        { cid: 'server-answer-1', sentence: 'Say hello.', en: 'Say hello.', translation: '说你好。',
          chunks: ['Say hello.'], alts: [[]], hints: ['Say hello.'] },
        { cid: 'server-answer-2', sentence: 'Say hello again.', en: 'Say hello again.', translation: '再说一次你好。',
          chunks: ['Say hello again.'], alts: [[]], hints: ['Say hello again.'] },
      ];
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.sync-conflict.v1', JSON.stringify({
        conflicts:[{entity:'batch',id:'legacy-conflict-fixture'}], deleted:{}
      }));
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [{ id: 'server-answer', name: '服务端答题验收', items }],
        best: {}, mastered: {
          'server-answer#legacy-familiarity': {
            deckId: 'server-answer', sentence: 'Legacy familiar sentence.', markedAt: Date.now() - 86400000,
          },
          'server-answer#legacy-familiarity-without-time': {
            deckId: 'server-answer', sentence: 'Legacy sentence without a timestamp.',
          },
        }, deletedItems: {}, reinforceBook: [{
          _key: 'server-answer::legacy-wrong-entry', deckId: 'server-answer', sentence: 'Say hello.',
          translation: '说你好。', mistakes: [], history: [],
        }, {
          _key: 'server-answer::legacy-wrong-entry-2', deckId: 'server-answer', sentence: 'Say hello again.',
          translation: '再说一次你好。', mistakes: [], history: [],
        }],
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, daysLog: {}, events: [
          { id: 'legacy-round-for-days-log-backfill', kind: 'round', at: Date.now() - 86400000 },
        ] },
        settings: { mode: 'choose', sound: false, shuffle: false, batchSize: 10, apiKey: 'legacy-private-key-fixture' },
      }));
      localStorage.setItem('chunklab.logical-courses.v1', JSON.stringify([{
        id: 'logical-course:legacy-travel', title: '旧版旅行课程', coverImage: '',
        catalogKey: 'logical:logical-course:legacy-travel', origin: 'user', contentType: 'story',
        createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
      }]));
      const now = Date.now();
      localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({
        'enrollment:v1:user-deck%3Aserver-answer': {
          kind: 'course-enrollment', schemaVersion: 1, courseId: 'user-deck:server-answer',
          joined: true, joinedAt: now, changedAt: now,
        },
      }));
    });
    await require('./lib/legacy-recovery-fixture').seedArchivedAccount(page, base);
    await page.goto(base + '/main.html');
    await page.waitForFunction(() => {
      const config = window.CL && typeof CL.getCloudConfig === 'function' ? CL.getCloudConfig() : null;
      return !!config && Number(config.writeProtocol) === 3;
    }, null, { timeout: 15000 }).catch(async error => {
      const runtime = await page.evaluate(() => ({
        config: window.CL && typeof CL.getCloudConfig === 'function' ? CL.getCloudConfig() : null,
        apiBase: window.ChunkAPI && typeof ChunkAPI.getBase === 'function' ? ChunkAPI.getBase() : null,
        serverStoreLoaded: !!window.ServerStore,
        idbStoreLoaded: !!window.IDBStore,
      }));
      const failed = failedRequests.map(request => ({
        path: (() => { try { return new URL(request.url).pathname; } catch (_) { return '[invalid-url]'; } })(),
        failure: request.failure,
      }));
      console.error('[main-persistence] protocol config did not initialize:', JSON.stringify({ runtime, failed }));
      throw error;
    });
    await page.waitForFunction(() => {
      return !document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog,[data-sync-conflict]');
    }, null, { timeout: 10000 }).catch(async error => {
      console.error('[main-persistence] conflict UI state:', await page.evaluate(() => ({
        badge: document.getElementById('syncBadge') && {
          display: document.getElementById('syncBadge').style.display,
          ariaHidden: document.getElementById('syncBadge').getAttribute('aria-hidden'),
        },
        mask: !!document.getElementById('syncResolveMask'),
        script: !!document.getElementById('legacySyncResolutionScript'),
        config: CL.getCloudConfig(),
        serverPersistence: serverPersistenceEnabled(),
        protocol3: serverWriteProtocol3Enabled(),
        store: !!window.ServerStore,
        idb: !!window.IDBStore,
      })));
      throw error;
    });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('chunklab.sync-conflict.v1')).conflicts.length), 1,
      'protocol 3 keeps the legacy recovery journal while ordinary UI remains conflict-free');
    await waitForAsync(page, async () => {
      const snapshot = await ChunkAPI.getData();
      return snapshot.mem.decks.some(deck => deck.id === 'server-answer');
    }, null, { timeout: 15000 });
    await page.waitForFunction(() => CL.serverPersistenceReady && CL.serverPersistenceReady() === true,
      null, { timeout: 15000 });
    const protocol3LegacyWrongBook = await page.evaluate(async () => {
      const key = 'chunklab_reinforce';
      const original = businessStorage.getItem(key);
      const legacyRows = [{ _key:'legacy-p3-source-only', deckId:'legacy-deck', sentence:'Archived old mistake.' }];
      const beforeMem = JSON.stringify(mem.reinforceBook);
      const originalSave = CL.saveAndNotify;
      const originalToast = window.showSysToast;
      let saveCalls = 0, misleadingToasts = 0;
      businessStorage.setItem(key, JSON.stringify(legacyRows));
      CL.saveAndNotify = function () { saveCalls++; return originalSave.apply(this, arguments); };
      if (typeof originalToast === 'function') window.showSysToast = function (message) {
        if (/错题未确认保存/.test(String(message))) misleadingToasts++;
        return originalToast.apply(this, arguments);
      };
      try {
        migrateLegacyReinforce();
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
          sourcePreserved: businessStorage.getItem(key) === JSON.stringify(legacyRows),
          memUnchanged: JSON.stringify(mem.reinforceBook) === beforeMem,
          saveCalls, misleadingToasts,
        };
      } finally {
        CL.saveAndNotify = originalSave;
        if (typeof originalToast === 'function') window.showSysToast = originalToast;
        if (original === null) businessStorage.removeItem(key);
        else businessStorage.setItem(key, original);
      }
    });
    assert.deepEqual(protocol3LegacyWrongBook,
      { sourcePreserved:true, memUnchanged:true, saveCalls:0, misleadingToasts:0 },
      'protocol 3 leaves the archived legacy wrong-book source for recovery instead of pretending to merge it via a full snapshot');
    const p3DefaultSaveMode = await page.evaluate(async () => {
      const save = CL.saveAndNotify;
      let mode = null;
      CL.saveAndNotify = (value, syncMode) => { mode = syncMode; return Promise.resolve(true); };
      try { await saveStore(); } finally { CL.saveAndNotify = save; }
      return mode;
    });
    assert.equal(p3DefaultSaveMode, undefined, 'an unspecified homepage save does not silently authorize a local snapshot projection');
    assert.deepEqual(legacyWrites, [], 'the protocol-3 save wrapper does not call legacy snapshot/import endpoints');
    const pendingMainProjection = await page.evaluate(async () => {
      const row = await ServerCache.read();
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin);
      base.hash = ''; base.search = '';
      const normalizedBase = base.href.replace(/\/+$/, '');
      const scope = JSON.stringify([normalizedBase, AccountStorage.owner, 3]);
      const now = Date.now() - 1000, sessionId = 'projection-session-0001';
      const exposureId = 'projection-exposure-event-01', answerId = 'projection-answer-event-01', roundId = 'projection-round-event-001';
      const exposureRequestId = 'projection-exposure-request-01', markRequestId = 'projection-mark-request-001';
      const mistakeRequestId = 'projection-mistake-remove-001';
      const answerRequestId = 'projection-answer-request-01', roundRequestId = 'projection-round-request-001';
      const progressRequestId='projection-course-progress-01',enrollmentRequestId='projection-enrollment-request-01';
      const hideRequestId='projection-visibility-hide-01',showRequestId='projection-visibility-show-01';
      const restartRequestId='projection-course-restart-01';
      const logicalCourseRequestId='projection-logical-course-put-01';
      const deckPutRequestId='projection-deck-put-01';
      const assessmentStartRequestId='projection-assessment-start-01';
      const assessmentAnswerRequestId='projection-assessment-answer-01';
      const assessmentFinalizeRequestId='projection-assessment-finalize-01';
      const learningResetRequestId='projection-learning-reset-01';
      let releaseDrainLock;
      let drainLock;
      if (navigator.locks && typeof navigator.locks.request === 'function') {
        let acquired;
        const lockAcquired = new Promise(resolve => { acquired = resolve; });
        drainLock = navigator.locks.request('chunklab-operations:' + scope, {mode:'exclusive'}, () =>
          new Promise(resolve => { releaseDrainLock = resolve; acquired(); }));
        await lockAcquired;
      } else {
        throw new Error('navigator.locks is required to isolate the pending-projection fixture from the live queue drain');
      }
      const answer = { protocol:3, requestId:answerRequestId, type:'learning.answer', payload:{
        eventId:answerId, key:'server-answer#projection-test', deckId:'server-answer', generation:0,
        sessionId, occurredAt:now, timeZone:'UTC', mode:'typing', contentFingerprint:'projection-fingerprint',
        policyVersion:1, ok:true, assisted:false, firstAttempt:true, earlyPractice:false,
        chunkRight:1, chunkTotal:1, answerOrder:0,
      }};
      const round = { protocol:3, requestId:roundRequestId, type:'learning.roundComplete', payload:{
        eventId:roundId, sessionId, answerCount:1, deckId:'server-answer', recordBest:true, timeZone:'UTC', occurredAt:now+1,
      }};
      const exposure = { protocol:3, requestId:exposureRequestId, type:'learning.exposure', payload:{
        eventId:exposureId, key:'server-answer#projection-exposure', deckId:'server-answer', generation:0,
        sessionId, occurredAt:now, mode:'typing', contentFingerprint:'projection-fingerprint', policyVersion:1,
      }};
      const mark = { protocol:3, requestId:markRequestId, type:'learning.mark', payload:{
        eventId:markRequestId, key:'server-answer#projection-mark', deckId:'server-answer', courseId:'server-answer',
        generation:0, active:true, markedAt:now, sentence:'Projected familiarity mark',
      }};
      const mistakeRemoval = { protocol:3, requestId:mistakeRequestId, type:'mistake.remove', payload:{
        eventId:mistakeRequestId, key:'server-answer::legacy-wrong-entry',
      }};
      const courseProgress={protocol:3,requestId:progressRequestId,type:'course.progress',payload:{
        courseId:'projection-story-course',nodeId:'lesson-1',passed:true,completed:false,currentNodeId:'lesson-2',generation:0,
      }};
      const enrollment={protocol:3,requestId:enrollmentRequestId,type:'course.enrollment',payload:{courseId:'projection-extra-course',joined:true}};
      const hideItem={protocol:3,requestId:hideRequestId,type:'deck.itemsVisibility',payload:{
        eventId:'projection-visibility-hide-event',deckId:'server-answer',keys:['server-answer#visibility-projection'],hidden:true,expectedHidden:false,
      }};
      const showItem={protocol:3,requestId:showRequestId,type:'deck.itemsVisibility',payload:{
        eventId:'projection-visibility-show-event',deckId:'server-answer',keys:['server-answer#visibility-projection'],hidden:false,expectedHidden:true,
      }};
      const restart={protocol:3,requestId:restartRequestId,type:'course.restart',payload:{
        eventId:restartRequestId,courseId:'projection-restart-course',currentNodeId:'lesson-start',
      }};
      const logicalCourse={protocol:3,requestId:logicalCourseRequestId,type:'logicalCourse.put',payload:{expectedSeq:null,
        course:{id:'logical-course:projection-test',title:'Projected directory',coverImage:'',
          catalogKey:'logical:logical-course:projection-test',origin:'user',contentType:'story',
          createdAt:'2026-10-05T00:00:00.000Z',updatedAt:'2026-10-05T00:00:00.000Z'}}};
      const deckPut={protocol:3,requestId:deckPutRequestId,type:'deck.put',expectedRev:null,
        payload:{deck:{id:'projection-pending-deck',name:'Pending deck projection',items:[]}}};
      const assessmentStart={protocol:3,requestId:assessmentStartRequestId,type:'assessment.start',payload:{
        eventId:'projection-assessment-start-event',sessionId:'projection-assessment-session',
      }};
      const assessmentAnswer={protocol:3,requestId:assessmentAnswerRequestId,type:'assessment.answer',payload:{
        eventId:'projection-assessment-answer-event',sessionId:'projection-assessment-session',itemIndex:0,answers:['correct'],
      }};
      const assessmentFinalize={protocol:3,requestId:assessmentFinalizeRequestId,type:'assessment.finalize',payload:{
        eventId:'projection-assessment-finalize-event',sessionId:'projection-assessment-session',score:100,
      }};
      const learningReset={protocol:3,requestId:learningResetRequestId,type:'learning.reset',payload:{
        eventId:learningResetRequestId,courseId:'projection-reset-course',expectedGeneration:0,
      }};
      const makeRow = (requestId, operation) => ({ requestId, operation, owner:AccountStorage.owner,
        sessionEpoch:AccountStorage.sessionEpoch||'', base:normalizedBase, scope, createdAt:now,
        attempts:0, status:'pending', bytes:new Blob([JSON.stringify(operation)]).size });
      try {
        await IDBStore.putPendingOperation(makeRow(exposureRequestId,exposure));
        await IDBStore.putPendingOperation(makeRow(markRequestId,mark));
        await IDBStore.putPendingOperation(makeRow(mistakeRequestId,mistakeRemoval));
        await IDBStore.putPendingOperation(makeRow(answerRequestId,answer));
        await IDBStore.putPendingOperation(makeRow(roundRequestId,round));
        await IDBStore.putPendingOperation(makeRow(progressRequestId,courseProgress));
        await IDBStore.putPendingOperation(makeRow(enrollmentRequestId,enrollment));
        await IDBStore.putPendingOperation(makeRow(hideRequestId,hideItem));
        await IDBStore.putPendingOperation(makeRow(showRequestId,showItem));
        await IDBStore.putPendingOperation(makeRow(restartRequestId,restart));
        await IDBStore.putPendingOperation(makeRow(logicalCourseRequestId,logicalCourse));
        await IDBStore.putPendingOperation(makeRow(deckPutRequestId,deckPut));
        await IDBStore.putPendingOperation(makeRow(assessmentStartRequestId,assessmentStart));
        await IDBStore.putPendingOperation(makeRow(assessmentAnswerRequestId,assessmentAnswer));
        await IDBStore.putPendingOperation(makeRow(assessmentFinalizeRequestId,assessmentFinalize));
        await IDBStore.putPendingOperation(makeRow(learningResetRequestId,learningReset));
        const pending = await ServerStore.pending();
        const projection = ServerCache.projectMainMem(row,pending);
        if (!projection.ready) throw new Error('pending projection not ready: '+projection.reason+'; pending='+
          JSON.stringify(pending.map(row=>({type:row.operation&&row.operation.type,status:row.status,payload:row.operation&&row.operation.payload})))+
          '; generations='+JSON.stringify(row.snapshot.learningGenerations));
        await refreshServerHomeProjection();
        return { ready:projection.ready, totalAnswered:projection.mem.stats.totalAnswered,
          totalRounds:projection.mem.stats.totalRounds, sentenceTimes:projection.mem.stats.bySentence['server-answer#projection-test'].times,
          exposureAt:projection.mem.stats.bySentence['server-answer#projection-exposure'].learningV1.lastExposureAt,
          exposureTimes:projection.mem.stats.bySentence['server-answer#projection-exposure'].times,
          exposureEvent:projection.mem.stats.events.some(event=>event.id===exposureId&&event.type==='exposure'),
          mastered:projection.mem.mastered['server-answer#projection-mark'],
          familiarityDueAt:projection.mem.stats.bySentence['server-answer#projection-mark'].learningV1.dueAt,
          mistakeStillPresent:projection.mem.reinforceBook.some(row=>row&&row._key==='server-answer::legacy-wrong-entry'),
          mistakeRemovedEvent:projection.mem.stats.events.some(event=>event.id===mistakeRequestId&&event.kind==='mistakeRemoved'),
          courseProgress:projection.courseProgress['projection-story-course'],
          restartedCourse:projection.courseProgress['projection-restart-course'],
          restartEvent:projection.mem.stats.events.find(event=>event.id===restartRequestId),
          logicalCourse:projection.mem.logicalCourses['logical-course:projection-test'],
          logicalCourseAppliedToPage:!!mem.logicalCourses['logical-course:projection-test'],
          deckPut:projection.mem.decks.find(deck=>deck.id==='projection-pending-deck'),
          deckPutAppliedToPage:!!mem.decks.find(deck=>deck.id==='projection-pending-deck'),
          assessmentResultLeaked:Object.hasOwn(projection.mem,'assessmentResults')||projection.mem.stats.events.some(event=>event.id==='projection-assessment-finalize-event'),
          resetGeneration:projection.learningGenerations['course:projection-reset-course'],
          resetEvent:projection.mem.stats.events.some(event=>event.id===learningResetRequestId&&event.kind==='learningReset'),
          enrollment:projection.courseProgress['enrollment:v1:projection-extra-course'],
          visibilityHidden:Object.hasOwn(projection.mem.deletedItems,'server-answer#visibility-projection'),
          visibilityEvents:projection.mem.stats.events.filter(event=>event.kind==='deckItemsVisibility').map(event=>event.id),
          best:projection.mem.best['server-answer'], appliedToPage:mem.stats.totalAnswered===projection.mem.stats.totalAnswered };
      } finally {
        await IDBStore.removePendingOperation(exposureRequestId);
        await IDBStore.removePendingOperation(markRequestId);
        await IDBStore.removePendingOperation(mistakeRequestId);
        await IDBStore.removePendingOperation(answerRequestId);
        await IDBStore.removePendingOperation(roundRequestId);
        await IDBStore.removePendingOperation(progressRequestId);
        await IDBStore.removePendingOperation(enrollmentRequestId);
        await IDBStore.removePendingOperation(hideRequestId);
        await IDBStore.removePendingOperation(showRequestId);
        await IDBStore.removePendingOperation(restartRequestId);
        await IDBStore.removePendingOperation(logicalCourseRequestId);
        await IDBStore.removePendingOperation(deckPutRequestId);
        await IDBStore.removePendingOperation(assessmentStartRequestId);
        await IDBStore.removePendingOperation(assessmentAnswerRequestId);
        await IDBStore.removePendingOperation(assessmentFinalizeRequestId);
        await IDBStore.removePendingOperation(learningResetRequestId);
        await ServerCache.refresh();
        await refreshServerHomeProjection();
        if (releaseDrainLock) releaseDrainLock();
        if (drainLock) await drainLock;
      }
    });
    assert.equal(pendingMainProjection.ready,true);
    assert.equal(pendingMainProjection.totalAnswered,1,'the actual home projection rebuilds pending answer totals from durable IndexedDB rows');
    assert.equal(pendingMainProjection.totalRounds,1,'the actual home projection rebuilds a complete pending round');
    assert.equal(pendingMainProjection.sentenceTimes,1,'the pending answer reuses the shared learning reducer');
    assert.equal(pendingMainProjection.exposureAt > 0,true,'a durable hint exposure is visible before server confirmation');
    assert.equal(pendingMainProjection.exposureTimes,0,'a hint exposure does not inflate answer counts');
    assert.equal(pendingMainProjection.exposureEvent,true,'the pending exposure is represented as learning evidence');
    assert.equal(pendingMainProjection.mastered.sentence,'Projected familiarity mark','a pending familiarity mark is visible before confirmation');
    assert.equal(pendingMainProjection.familiarityDueAt > 0,true,'the pending mark uses the shared familiarity schedule');
    assert.equal(pendingMainProjection.mistakeStillPresent,false,'a pending mistake deletion is removed from the projected home view');
    assert.equal(pendingMainProjection.mistakeRemovedEvent,true,'a pending mistake deletion is represented in the event log');
    assert.equal(pendingMainProjection.assessmentResultLeaked,false,'durable assessment drafts and unconfirmed scores never leak into the home projection');
    assert.equal(pendingMainProjection.resetGeneration,1,'a durable reset advances the restored page generation prediction');
    assert.equal(pendingMainProjection.resetEvent,true,'a durable reset has one visible predicted event after reload');
    assert.deepEqual(pendingMainProjection.courseProgress,{seen:['lesson-1'],passed:['lesson-1'],completed:false,currentNodeId:'lesson-2'},
      'the pending course lesson is visible in the projected cross-device progress');
    assert.deepEqual(pendingMainProjection.restartedCourse,{generation:1,seen:[],passed:[],completed:false,history:[],currentNodeId:'lesson-start'},
      'a pending course restart remains visible in the actual homepage projection after reload');
    assert.equal(pendingMainProjection.restartEvent.generation,1,'the projected restart event matches the course generation');
    assert.equal(pendingMainProjection.logicalCourse.title,'Projected directory','the actual home projection includes a durable pending directory edit');
    assert.equal(pendingMainProjection.logicalCourseAppliedToPage,true,'the projected directory edit reaches the page runtime');
    assert.deepEqual(pendingMainProjection.deckPut,{id:'projection-pending-deck',name:'Pending deck projection',items:[]},
      'the actual home projection includes a durable pending deck creation');
    assert.equal(pendingMainProjection.deckPutAppliedToPage,true,'the projected deck is adopted by the page runtime');
    assert.equal(pendingMainProjection.enrollment.joined,true,'a pending course enrollment is visible before server confirmation');
    assert.equal(pendingMainProjection.visibilityHidden,false,'ordered hide/show operations restore the projected item visibility');
    assert.deepEqual(pendingMainProjection.visibilityEvents,['projection-visibility-hide-event','projection-visibility-show-event'],
      'pending item visibility changes retain ordered event evidence');
    assert.equal(pendingMainProjection.best.acc,100,'the pending round reconstructs server-equivalent best metrics');
    assert.equal(pendingMainProjection.appliedToPage,true,'the projected view is adopted by the actual main-page runtime');
    const pendingDeckDeleteProjection = await page.evaluate(async () => {
      const row=await ServerCache.read();
      const base=new URL(ChunkAPI.getBase()||location.origin,location.origin);base.hash='';base.search='';
      const normalizedBase=base.href.replace(/\/+$/,'');
      const scope=JSON.stringify([normalizedBase,AccountStorage.owner,3]);
      const requestId='projection-deck-delete-runtime-01';
      return navigator.locks.request('chunklab-operations:'+scope,async()=>{
        const expectedRev=row.snapshot.revs.decks['server-answer'];
        if(!Number.isSafeInteger(expectedRev))throw new Error('server-answer deck revision is unavailable');
        const operation={protocol:3,requestId,type:'deck.delete',expectedRev,payload:{deckId:'server-answer'}};
        await IDBStore.putPendingOperation({requestId,operation,owner:AccountStorage.owner,
          sessionEpoch:AccountStorage.sessionEpoch||'',base:normalizedBase,scope,createdAt:Date.now(),
          attempts:0,status:'pending',bytes:new Blob([JSON.stringify(operation)]).size});
        try {
          const pending=await ServerStore.pending();
          const projection=ServerCache.projectMainMem(row,pending);
          if(!projection.ready)throw new Error('pending deck-delete projection rejected: '+projection.reason);
          await refreshServerHomeProjection();
          return {ready:projection.ready,deckHidden:!mem.decks.some(deck=>deck.id==='server-answer'),
            bestHidden:!Object.hasOwn(mem.best,'server-answer'),generation:projection.learningGenerations['course:server-answer']};
        } finally {
          await IDBStore.removePendingOperation(requestId);
          await ServerCache.refresh();
          await refreshServerHomeProjection();
        }
      });
    });
    assert.equal(pendingDeckDeleteProjection.ready,true,'an isolated durable deck delete can be restored into the homepage projection');
    assert.equal(pendingDeckDeleteProjection.deckHidden,true,'the pending delete is reflected in the live page deck list');
    assert.equal(pendingDeckDeleteProjection.bestHidden,true,'the pending delete removes the deck-specific best score');
    assert.equal(pendingDeckDeleteProjection.generation,1,'the pending delete advances the learning generation');
    const legacyStatSentence = 'Say hello again.';
    const legacyStatKey = 'rev-server-answer-legacy#server-answer-2';
    const canonicalLegacyStat = 'server-answer#server-answer-2';
    const fixtureDb = new Database(path.join(dataDir, 'chunklab.db'));
    try {
      const user = fixtureDb.prepare("SELECT id FROM users WHERE username='__default__'").get();
      assert.ok(user, 'isolated browser account exists before seeding a legacy database row');
      const seedLegacyResolution = fixtureDb.prepare(`INSERT INTO user_sync_resolutions
        (user_id,request_id,request_hash,backup_json,result_json) VALUES(?,?, 'legacy-hash','{}','{}')`);
      for (let i = 0; i < 100; i++) {
        seedLegacyResolution.run(user.id, `e2e-legacy-resolution-${String(i).padStart(3, '0')}`);
      }
      assert.equal(fixtureDb.prepare('SELECT COUNT(*) AS n FROM user_sync_resolutions WHERE user_id=?').get(user.id).n, 100,
        'the real browser account starts learning with its legacy archive at the row cap');
      fixtureDb.prepare('UPDATE user_sync_resolutions SET backup_json=\'\' WHERE user_id=?').run(user.id);
      fixtureDb.prepare(`UPDATE user_sync_resolutions SET backup_json=zeroblob(?)
        WHERE user_id=? AND request_id=?`).run(64 * 1024 * 1024, user.id, 'e2e-legacy-resolution-000');
      assert.equal(fixtureDb.prepare(`SELECT SUM(length(CAST(backup_json AS BLOB))) AS bytes
        FROM user_sync_resolutions WHERE user_id=?`).get(user.id).bytes, 64 * 1024 * 1024,
      'the legacy archive simultaneously reaches the exact byte cap without allocating a large JavaScript string');
      const seq = fixtureDb.prepare('UPDATE user_change_seq SET seq=seq+1 WHERE user_id=? RETURNING seq').get(user.id).seq;
      fixtureDb.prepare(`INSERT INTO user_sentence_stats(user_id,sentence_key,deck_id,data_json,deleted_at,updated_at,seq)
        VALUES(?,?,?,?,NULL,datetime('now'),?) ON CONFLICT(user_id,sentence_key) DO UPDATE SET
        deck_id=excluded.deck_id,data_json=excluded.data_json,deleted_at=NULL,updated_at=datetime('now'),seq=excluded.seq`)
        .run(user.id, legacyStatKey, 'rev-server-answer-legacy',
          JSON.stringify({ deckId: 'rev-server-answer-legacy', times: 0, okTimes: 0, wrongTimes: 0,
            maxStreak: 0, lastAt: Date.now() - 5000, interval: 6 }), seq);
      assert.ok(fixtureDb.prepare('SELECT id FROM user_decks WHERE user_id=? AND id=? AND deleted_at IS NULL').get(user.id, 'server-answer'),
        'the canonical destination deck is present in the isolated server database');
    } finally { fixtureDb.close(); }
    const cappedArchiveUi = await page.evaluate(() => ({
      conflictUiAbsent: !document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog,[data-sync-conflict]'),
      journalConflictCount: JSON.parse(localStorage.getItem('chunklab.sync-conflict.v1') || '{"conflicts":[]}').conflicts.length,
    }));
    assert.deepEqual(cappedArchiveUi, {
      conflictUiAbsent: true, journalConflictCount: 1,
    }, 'at both legacy archive caps the real protocol-3 page has no conflict UI while retaining the local recovery journal');
    legacyFenceProbeActive = true;
    let legacyFenceResult;
    try {
      legacyFenceResult = await page.evaluate(async () => {
        const before = {
          legacyData: localStorage.getItem('chunklab.v1'),
          conflictJournal: localStorage.getItem('chunklab.sync-conflict.v1'),
        };
        let upgradeSignal = false;
        const onUpgrade = () => { upgradeSignal = true; };
        addEventListener('chunklab-upgrade-required', onUpgrade, { once: true });
        let error = null;
        // Deliberately probe the retired server route, not a product API method.
        try { await ChunkAPI.request('/api/data', {method:'PUT',body:before.legacyData || '{}'}); }
        catch (caught) { error = { status: caught.status, code: caught.code }; }
        removeEventListener('chunklab-upgrade-required', onUpgrade);
        return {
          error, upgradeSignal,
          legacyDataPreserved: localStorage.getItem('chunklab.v1') === before.legacyData,
          journalPreserved: localStorage.getItem('chunklab.sync-conflict.v1') === before.conflictJournal,
          conflictUiAbsent: !document.querySelector('#syncBadge,#syncResolveMask,#syncResolveDialog,[data-sync-conflict]'),
        };
      });
    } finally { legacyFenceProbeActive = false; }
    assert.deepEqual(legacyFenceProbeWrites, [{ method: 'PUT', path: '/api/data' }],
      'the legacy compatibility client really attempted the fenced full-snapshot route');
    assert.deepEqual(legacyFenceResult, {
      error: { status: 428, code: 'CLIENT_UPDATE_REQUIRED' }, upgradeSignal: true,
      legacyDataPreserved: true, journalPreserved: true,
      conflictUiAbsent: true,
    }, 'a legacy write is rejected with the refresh signal, preserves local sources, and does not expose conflict UI');
    const migrationRun = await page.evaluate(async migration => {
      await ServerCache.refresh();
      const mapped = MainLegacyStats.migrateLegacyStatKeys({ [migration.oldKey]: {
        deckId: migration.oldDeckId, sentence: migration.sentence, times: 0, okTimes: 0, wrongTimes: 0,
      } }, allDecks(), { normalizeSentence: normSent, hash: CL.fnv8 });
      const count = await ServerStatKeyMigration.run(mapped.migrations, () => mem);
      return { mappings: mapped.migrations, count };
    }, { oldKey: legacyStatKey, oldDeckId: 'rev-server-answer-legacy', sentence: legacyStatSentence });
    assert.equal(migrationRun.mappings.length, 1, 'the shared migration mapper resolves the old key to the canonical item ID');
    assert.equal(migrationRun.count, 1, 'the page helper applies the migration from the confirmed server snapshot');
    await waitForAsync(page, async key => {
      const snapshot = await ChunkAPI.getData();
      const rows = snapshot.mem.stats.bySentence;
      return !!rows[key] && !Object.keys(rows).includes('rev-server-answer-legacy#server-answer-2');
    }, canonicalLegacyStat, { timeout: 15000 });
    const statKeyMigration = protocolWrites.filter(operation => operation.type === 'learning.statKeyMigrate');
    assert.equal(statKeyMigration.length, 1, 'legacy sentence-stat keys use one idempotent narrow server operation');
    assert.equal(statKeyMigration[0].payload.newKey, canonicalLegacyStat);
    const migratedStatDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const userId = migratedStatDb.prepare("SELECT id FROM users WHERE username='__default__'").get().id;
      assert.notEqual(migratedStatDb.prepare('SELECT deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?')
        .get(userId, legacyStatKey).deleted_at, null, 'the server tombstones the legacy key only after a confirmed migration');
      const migratedRow = JSON.parse(migratedStatDb.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=?')
        .get(userId, canonicalLegacyStat).data_json);
      assert.equal(migratedRow.times, 0, 'the canonical row holds the migrated counter in SQLite');
      assert.equal(migratedRow.interval, 6, 'the canonical row preserves the most recent legacy schedule fields');
    } finally { migratedStatDb.close(); }
    await waitForAsync(page, async () => {
      const snapshot = await ChunkAPI.getData();
      return snapshot.mem.stats.bySentence['server-answer#legacy-familiarity']?.learningV1?.legacyFamiliarityMigrated === true &&
        snapshot.mem.stats.bySentence['server-answer#legacy-familiarity-without-time']?.learningV1?.legacyFamiliarityMigrated === true;
    }, null, { timeout: 15000 });
    const legacyMigrationCount = protocolWrites.filter(operation => operation.type === 'learning.mark' &&
      operation.payload.legacyMigration === true).length;
    const legacyMigrations = protocolWrites.filter(operation => operation.type === 'learning.mark' && operation.payload.legacyMigration === true);
    const timestampFreeMigration = legacyMigrations.find(operation => !Object.hasOwn(operation.payload, 'markedAt'));
    assert.equal(legacyMigrationCount, 2, 'legacy familiarity records are converted into durable server learning operations; captured='+
      JSON.stringify(legacyMigrations.map(operation=>({requestId:operation.requestId,payload:operation.payload}))));
    assert.ok(timestampFreeMigration, 'a legacy record without an event time sends no client-generated timestamp');
    assert.equal(Object.hasOwn(timestampFreeMigration.payload, 'markedAt'), false,
      'a legacy record without an event time lets the server assign time once, so retries keep an identical payload');
    await page.reload();
    await waitForAsync(page, async () => {
      const snapshot = await ChunkAPI.getData();
      return snapshot.mem.stats.bySentence['server-answer#legacy-familiarity']?.learningV1?.legacyFamiliarityMigrated === true &&
        snapshot.mem.stats.bySentence['server-answer#legacy-familiarity-without-time']?.learningV1?.legacyFamiliarityMigrated === true;
    }, null, { timeout: 15000 });
    assert.equal(protocolWrites.filter(operation => operation.type === 'learning.mark' &&
      operation.payload.legacyMigration === true).length, 2, 'reloading does not resubmit already migrated familiarity records');
    await page.waitForSelector('#chunklabSaveStatus', { timeout: 5000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('server-store-state', {
      detail:{phase:'idle',pending:0,blocked:0,error:null},
    })));
    await page.waitForFunction(() => document.getElementById('chunklabSaveStatus').getAttribute('data-visible') === 'false',
      null, { timeout: 2000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('server-store-state', {
      detail:{phase:'pending',pending:1,blocked:0,error:null},
    })));
    await page.waitForTimeout(4800);
    const briefPendingVisible = await page.evaluate(() => {
      const status=document.getElementById('chunklabSaveStatus');
      return !!status && status.getAttribute('data-visible') === 'true';
    });
    assert.equal(briefPendingVisible, false, 'a transient pending request stays quiet for the five-second grace period');
    await page.waitForFunction(() => {
      const status=document.getElementById('chunklabSaveStatus');
      return status && status.getAttribute('data-visible') === 'true' && /已安全保存在此设备/.test(status.textContent);
    }, null, { timeout: 1500 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('server-store-state', {
      detail:{phase:'idle',pending:0,blocked:0,error:null},
    })));
    await page.waitForFunction(() => document.getElementById('chunklabSaveStatus').getAttribute('data-visible') === 'false',
      null, { timeout: 2000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('server-store-state', {
      detail:{phase:'paused',pending:1,blocked:0,error:'NOT_AUTH'},
    })));
    await page.waitForFunction(() => {
      const status=document.getElementById('chunklabSaveStatus');
      return status && status.getAttribute('data-visible') === 'true' && /登录已过期，请重新登录/.test(status.textContent);
    }, null, { timeout: 2000 });
    await page.waitForFunction(() => mem.settings && mem.settings.apiKey === '', null, { timeout: 10000 }).catch(async error => {
      console.error('[main-persistence] API-key startup state:', await page.evaluate(() => ({
        apiKey:mem.settings&&mem.settings.apiKey, config:CL.getCloudConfig(), ready:CL.serverPersistenceReady(),
        hydrated:window.__chunklabServerHomeProjectionSeq, pending:window.__chunklabServerHomeProjectionPending,
        booted:window._mainBooted, claimed:window._mainEntryClaimed, sync:ServerStore.state(),
      })));
      throw error;
    });
    assert.deepEqual(legacyWrites, [], 'clearing a legacy private API key is a local-only cleanup, not an old snapshot write');
    await page.locator('[data-home-course="user-deck:server-answer"]').click();
    await page.waitForSelector('#stageChoices .choice', { timeout: 15000 });
    const firstValue = await page.locator('#stageChoices .choice').first().getAttribute('data-v');
    await page.evaluate(() => {
      window.__practiceOperations = [];
      const send = ChunkAPI.submitOperation;
      ChunkAPI.submitOperation = function (operation) {
        if (['learning.answer', 'learning.resume', 'learning.roundComplete', 'learning.exposure', 'learning.mark', 'course.enrollment', 'settings.patch', 'deck.put'].includes(operation.type)) window.__practiceOperations.push(operation);
        return send(operation);
      };
    });
    await page.evaluate(() => {
      S.courseLearning = { enabled: true, mode: 'choose', modes: ['choose', 'input'] };
      chooseCourseMode('input');
    });
    await waitForAsync(page, async () => {
      let snapshot;
      try { snapshot = await ChunkAPI.getData(); }
      catch (_) { return false; }
      const resume = snapshot.learningResumes[S.sessionId];
      const rows = await IDBStore.listPendingOperations();
      return resume && resume.practiceMode === 'input' && !rows.some(row =>
        row.operation && row.operation.type === 'learning.resume' &&
        row.operation.payload && row.operation.payload.sessionId === S.sessionId &&
        row.operation.payload.practiceMode === 'input');
    }, null, { timeout: 15000 });
    const remoteModeResume = await page.evaluate(async () => {
      const snapshot = await ChunkAPI.getData();
      return snapshot.learningResumes[S.sessionId] || null;
    });
    assert.equal(remoteModeResume && remoteModeResume.practiceMode, 'input', 'changing course practice mode durably updates the server resume state; captured=' + JSON.stringify({
      operations:protocolWrites.filter(item=>item.type==='learning.resume').slice(-5),
      pageOperations:await page.evaluate(()=>window.__practiceOperations.filter(item=>item.type==='learning.resume').slice(-5)),
      pendingRows:await page.evaluate(async()=> (await ServerStore.pending()).map(row=>({requestId:row.requestId,
        type:row.operation&&row.operation.type,payload:row.operation&&row.operation.payload,status:row.status,
        attempts:row.attempts,lastError:row.lastError,receipt:row.receipt&&row.receipt.seq}))),
      remoteResume:await page.evaluate(async()=>{const snapshot=await ChunkAPI.getData();return snapshot.learningResumes[S.sessionId]||null;}),
      state:await page.evaluate(()=>({courseLearning:S.courseLearning,sessionId:S.sessionId,deckId:S.deck&&S.deck.id,
        progress:mem.progress&&mem.progress[S.deck&&S.deck.id],toast:document.getElementById('sysToast')&&document.getElementById('sysToast').textContent,
        pending:ServerStore.state()})),
    }));
    const importedDeck = await page.evaluate(async () => {
      await commitImport([{sentence:'A durable imported sentence.',translation:'一条耐久导入的句子。',chunks:['A durable imported sentence.'],hints:[],grammar:[]}], 'E2E 首页导入');
      const snapshot = await ChunkAPI.getData();
      const local = mem.decks.find(item => item.name === 'E2E 首页导入');
      const remote = snapshot.mem.decks.find(item => item.name === 'E2E 首页导入');
      if (!local || !remote || remote.items[0].sentence !== 'A durable imported sentence.') throw new Error('首页题库导入没有等待服务器 deck.put 确认');
      const submit = ServerStore.submitCommitted;
      ServerStore.submitCommitted = function(type) {
        if (type === 'deck.put') return Promise.reject(new Error('e2e rejected content write'));
        return submit.apply(this, arguments);
      };
      try {
        let failed = false;
        try { await commitImport([{sentence:'Must not remain.',translation:'不得残留。',chunks:['Must not remain.'],hints:[],grammar:[]}], 'E2E 首页失败导入'); }
        catch (_) { failed = true; }
        if (!failed || mem.decks.some(item => item.name === 'E2E 首页失败导入')) throw new Error('服务器拒绝首页题库导入后仍残留未确认课程');
      } finally { ServerStore.submitCommitted = submit; }
      const saveAndNotify = CL.saveAndNotify;
      CL.saveAndNotify = function (value, mode) {
        if (mode === 'local') return Promise.resolve(false);
        return saveAndNotify.apply(this, arguments);
      };
      try {
        await commitImport([{sentence:'Committed despite local projection failure.',translation:'本机投影失败但服务器已确认。',
          chunks:['Committed despite local projection failure.'],hints:[],grammar:[]}], 'E2E 已确认投影故障');
      } finally { CL.saveAndNotify = saveAndNotify; }
      const projectionFailureSnapshot = await ChunkAPI.getData();
      if (!mem.decks.some(item => item.name === 'E2E 已确认投影故障') ||
          !projectionFailureSnapshot.mem.decks.some(item => item.name === 'E2E 已确认投影故障')) {
        throw new Error('本机投影失败错误地回滚了服务器已确认的课程');
      }
      return {id:local.id,operation:window.__practiceOperations.find(item => item.type === 'deck.put' && item.payload.deck.name === 'E2E 首页导入')};
    });
    assert.ok(importedDeck.operation, 'homepage import uses a narrow deck.put operation');
    await page.evaluate(() => {
      const target = mem.decks.find(item => item.id === 'server-answer');
      openExplain(target, 0);
      $('explainJsonBox').value = JSON.stringify([{ grammar: 'E2E confirmed explanation' }]);
      $('explainApply').click();
    });
    await page.waitForFunction(() => $('explainMsg').textContent.includes('已保存 1 条详解') ||
      $('explainMsg').textContent.includes('详解未确认保存'), null, { timeout: 15000 });
    const explanationStatus = await page.locator('#explainMsg').textContent();
    assert.match(explanationStatus, /已保存 1 条详解/, 'the explanation editor reports success only after its save contract completes');
    const explanation = await page.evaluate(async () => {
      const snapshot = await ChunkAPI.getData();
      const operation = window.__practiceOperations.find(item => item.type === 'deck.put' &&
        item.payload.deck.id === 'server-answer' &&
        item.payload.deck.items[0].explanations?.[0]?.grammar === 'E2E confirmed explanation');
      return { operation, saved: snapshot.mem.decks.find(item => item.id === 'server-answer').items[0].explanations };
    });
    assert.ok(explanation.operation, 'editing sentence explanations uses a narrow deck.put operation');
    assert.equal(explanation.saved[0].grammar, 'E2E confirmed explanation', 'explanation edits reach the authoritative SQLite-backed snapshot');

    await page.evaluate(() => {
      const target = mem.decks.find(item => item.id === 'server-answer');
      window.__explanationOriginal = JSON.stringify(target.items[0].explanations);
      openExplain(target, 0);
      $('explainJsonBox').value = JSON.stringify([{ grammar: 'must roll back' }]);
      window.__originalSubmitCommitted = ServerStore.submitCommitted;
      ServerStore.submitCommitted = function(type) {
        if (type === 'deck.put') return Promise.reject(new Error('e2e rejected explanation edit'));
        return window.__originalSubmitCommitted.apply(this, arguments);
      };
      $('explainApply').click();
    });
    await page.waitForFunction(() => $('explainMsg').textContent.includes('e2e rejected explanation edit'), null, { timeout: 15000 });
    const rejectedExplanation = await page.evaluate(() => {
      const target = mem.decks.find(item => item.id === 'server-answer');
      const result = { restored: JSON.stringify(target.items[0].explanations) === window.__explanationOriginal,
        message: $('explainMsg').textContent };
      closeExplain();
      ServerStore.submitCommitted = window.__originalSubmitCommitted;
      delete window.__originalSubmitCommitted;
      delete window.__explanationOriginal;
      return result;
    });
    assert.equal(rejectedExplanation.restored, true, 'a rejected content edit restores its previous in-memory value');
    assert.match(rejectedExplanation.message, /未确认保存/);
    const staleDeckEdit = await page.evaluate(async () => {
      await commitImport([{sentence:'A stale-edit fixture.',translation:'陈旧编辑测试。',chunks:['A stale-edit fixture.'],hints:[],grammar:[]}], 'E2E 已删除题库');
      const deck = mem.decks.find(item => item.name === 'E2E 已删除题库');
      const row = await ServerCache.read();
      const expectedRev = row.snapshot.revs.decks[deck.id];
      await ServerStore.submitCommitted('deck.delete', { deckId: deck.id },
        { requestId:'e2e-deck-delete-before-edit-001', expectedRev });
      await ServerCache.refresh();
      deck.items[0].translation = '陈旧页面不应复活已删除题库。';
      let message = '';
      try { await requireSaveCommit(deck, { requireExisting:true }); }
      catch (error) { message = error.message; }
      const snapshot = await ChunkAPI.getData();
      return { message, exists:snapshot.mem.decks.some(item => item.id === deck.id) };
    });
    assert.match(staleDeckEdit.message, /已被删除/,
      'editing a deleted stale deck is rejected instead of treating absence as a create');
    assert.equal(staleDeckEdit.exists, false, 'stale content cannot recreate a deleted server deck');
    await page.evaluate(() => CourseEnrollment.join('e2e-server-enrollment'));
    const enrollment = await page.evaluate(async () => {
      const operation = window.__practiceOperations.find(item => item.type === 'course.enrollment');
      const snapshot = await ChunkAPI.getData();
      return {operation, membership:snapshot.courseProgress['enrollment:v1:e2e-server-enrollment']};
    });
    assert.equal(enrollment.operation.payload.joined, true, 'joining a course uses the narrow enrollment operation');
    assert.equal(enrollment.membership.joined, true, 'membership is acknowledged in the server snapshot');
    await page.evaluate(() => CourseEnrollment.leave('e2e-server-enrollment'));
    const unenrollment = await page.evaluate(async () => {
      const operations = window.__practiceOperations.filter(item => item.type === 'course.enrollment');
      const snapshot = await ChunkAPI.getData();
      return {operation:operations[operations.length - 1], membership:snapshot.courseProgress['enrollment:v1:e2e-server-enrollment']};
    });
    assert.equal(unenrollment.operation.payload.joined, false, 'leaving a course uses the narrow enrollment operation');
    assert.equal(unenrollment.membership.joined, false, 'leave is confirmed by the server before local completion');
    await page.evaluate(() => CourseEnrollment.join('user-deck:server-answer'));
    await page.locator('#btnSettingsTop').click();
    await page.evaluate(() => {
      document.querySelector('#setShuffle').checked = true;
      document.querySelector('#setApiKey').value = 'local-only-secret-fixture';
    });
    await page.locator('#btnSaveSettings').click();
    await waitForAsync(page, async () => {
      const data = await ChunkAPI.getData();
      return data.mem.settings.shuffle === true;
    }, null, { timeout: 15000 });
    const settingsWrite = await page.evaluate(async () => {
      const snapshot = await ChunkAPI.getData();
      return {settings:snapshot.mem.settings,localKey:mem.settings.apiKey};
    });
    const settingsOperation = protocolWrites.findLast(item => item.type === 'settings.patch');
    assert.deepEqual(settingsOperation && settingsOperation.payload.patch, {shuffle:true}, 'only changed allowlisted settings are sent');
    assert.equal(settingsWrite.settings.apiKey || undefined, undefined, 'private API keys are not written to the server');
    assert.equal(settingsWrite.localKey, 'local-only-secret-fixture', 'private API key remains local to the device');
    await page.locator('#stageChoices .choice').first().click();
    await page.waitForFunction(() => window.__practiceOperations && window.__practiceOperations.filter(operation => operation.type === 'learning.answer').length === 1,
      null, { timeout: 10000 });
    await waitForAsync(page, async () => {
      const data = await ChunkAPI.getData();
      return data.mem.stats.totalAnswered === 1;
    }, null, { timeout: 15000 });

    const afterFirstAnswer = await page.evaluate(async () => {
      const operation = window.__practiceOperations.find(item => item.type === 'learning.answer');
      const snapshot = await ChunkAPI.getData();
      const state = await ServerStore.state();
      return { operation, totalAnswered:snapshot.mem.stats.totalAnswered,
        stat:snapshot.mem.stats.bySentence[operation.payload.key], state,
        projected:mem.stats.bySentence[operation.payload.key] };
    });
    assert.equal(afterFirstAnswer.operation.payload.sessionId.length >= 12, true);
    assert.equal(afterFirstAnswer.operation.payload.answerOrder, 0);
    assert.equal(afterFirstAnswer.operation.payload.chunkRight, 1);
    assert.equal(afterFirstAnswer.operation.payload.chunkTotal, 1);
    assert.equal(afterFirstAnswer.operation.payload.ok, true);
    assert.equal(afterFirstAnswer.totalAnswered, 1, 'one accepted answer is counted once in the isolated server database');
    assert.equal(afterFirstAnswer.stat.times, 1);
    assert.equal(afterFirstAnswer.projected.times, 1, 'the UI updates only after the answer is durably queued');
    const cappedArchiveDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(cappedArchiveDb.prepare('SELECT COUNT(*) AS n FROM user_sync_resolutions WHERE user_id=1').get().n, 100,
        'a real protocol-3 browser answer succeeds without deleting or trimming the full legacy archive');
      assert.equal(cappedArchiveDb.prepare('SELECT COUNT(*) AS n FROM user_recovery_sources WHERE user_id=1').get().n, 1,
        'the prior browser state remains archived while learning continues at the legacy archive cap');
    } finally { cappedArchiveDb.close(); }
    assert.equal((await page.evaluate(() => mem.progress['server-answer'].answerOrder)), 1,
      'the durable local checkpoint remembers accepted answer ordering');

    await page.locator('#btnMaster').click();
    await page.waitForFunction(() => window.__practiceOperations.some(operation => operation.type === 'learning.mark'),
      null, { timeout: 10000 });
    const familiarity = await page.evaluate(async () => {
      const operation = window.__practiceOperations.find(item => item.type === 'learning.mark');
      const snapshot = await ChunkAPI.getData();
      return {operation, marked:snapshot.mem.mastered[operation.payload.key]};
    });
    assert.equal(familiarity.operation.payload.active, true, 'marking familiar submits the narrow learning.mark operation');
    assert.equal(familiarity.operation.payload.generation, 0, 'familiarity is scoped to the active learning generation');
    assert.ok(familiarity.marked, 'the server-authoritative projection reflects the durable familiarity mark');
    await page.locator('#btnMaster').click();
    await waitForAsync(page, async () => {
      const operation = window.__practiceOperations.filter(item => item.type === 'learning.mark').at(-1);
      if (!operation || operation.payload.active) return false;
      const snapshot = await ChunkAPI.getData();
      return !snapshot.mem.mastered[operation.payload.key];
    }, null, { timeout: 15000 });

    await page.locator('#btnNext').click();
    await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    const secondValue = await page.locator('#stageChoices .choice').first().getAttribute('data-v');
    assert.notEqual(secondValue, firstValue, 'the next question is the other sentence in the session');
    await waitForAsync(page, async () => {
      const operation = (window.__practiceOperations || []).find(item => item.type === 'learning.resume');
      if (!operation) return false;
      const data = await ChunkAPI.getData();
      return !!data.learningResumes[operation.payload.sessionId];
    }, null, { timeout: 15000 });
    const checkpoint = await page.evaluate(async () => {
      const operation = window.__practiceOperations.filter(item => item.type === 'learning.resume').at(-1);
      const snapshot = await ChunkAPI.getData();
      return { operation, stored:snapshot.learningResumes[operation.payload.sessionId] };
    });
    const expectedSourceIndex = secondValue === 'Say hello.' ? 0 : 1;
    assert.equal(checkpoint.operation.payload.idx, expectedSourceIndex);
    assert.equal(checkpoint.stored.idx, expectedSourceIndex, 'the accepted resume checkpoint is visible in the server snapshot');
    const resumeQueueIndex = await page.evaluate(() => S.idx);
    assert.equal(resumeQueueIndex, 1, 'the UI has advanced to the second queue item');
    assert.equal((await page.evaluate(() => mem.progress['server-answer'].answerOrder)), 1);

    await page.evaluate(() => {
      window.__originalPendingOperationWrite = IDBStore.putPendingOperation.bind(IDBStore);
      window.__exposureKeyForFailureTest = CL.itemKey(S.deck.id, cur());
      window.__exposureBeforeFailureTest = Number(mem.stats.bySentence[window.__exposureKeyForFailureTest]?.learningV1?.lastExposureAt) || 0;
      IDBStore.putPendingOperation = function (row, limits) {
        if (row && row.operation && row.operation.type === 'learning.exposure') {
          const error = new Error('simulated durable queue failure'); error.code = 'STORAGE_UNAVAILABLE';
          return Promise.reject(error);
        }
        return window.__originalPendingOperationWrite(row, limits);
      };
    });
    await page.keyboard.press('Control+f');
    await page.waitForSelector('#answerHint.show', { timeout: 5000 });
    await page.waitForFunction(() => /提示使用记录暂未保存/.test(document.getElementById('sysToast').textContent),
      null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const status = document.getElementById('chunklabSaveStatus');
      return status && status.dataset.visible === 'true' && /此设备暂时无法安全保存/.test(status.textContent);
    }, null, { timeout: 5000 });
    const failedExposureProjection = await page.evaluate(() => ({
      before:window.__exposureBeforeFailureTest,
      after:Number(mem.stats.bySentence[window.__exposureKeyForFailureTest]?.learningV1?.lastExposureAt) || 0,
      queued:(window.__practiceOperations || []).some(operation => operation.type === 'learning.exposure')
    }));
    assert.equal(failedExposureProjection.after, failedExposureProjection.before,
      'a hint whose exposure event was not durably queued must not be projected as recorded');
    assert.equal(failedExposureProjection.queued, false,
      'failed local durability does not send the exposure to the server');
    await page.evaluate(() => { IDBStore.putPendingOperation = window.__originalPendingOperationWrite; });
    const exposureRequestPromise = page.waitForRequest(request => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return false;
      try { return JSON.parse(request.postData() || '{}').type === 'learning.exposure'; }
      catch (_) { return false; }
    }, { timeout: 15000 });
    await page.evaluate(() => showSentenceHint());
    const exposureRequest = await exposureRequestPromise;
    const hintedSentenceKey = await page.evaluate(() => CL.itemKey(S.deck.id, cur()));
    const exposureOperation = JSON.parse(exposureRequest.postData());
    await waitForAsync(page, async () => {
      const pending = await ServerStore.pending();
      if (pending.some(row => row.operation && row.operation.type === 'learning.exposure')) return false;
      const data = await ChunkAPI.getData();
      const stat = data.mem.stats.bySentence[CL.itemKey('server-answer', cur())];
      return stat && stat.learningV1 && stat.learningV1.lastExposureAt > window.__exposureBeforeFailureTest;
    }, null, { timeout: 15000 });
    assert.equal(exposureOperation.type, 'learning.exposure');
    assert.equal(exposureOperation.payload.key, hintedSentenceKey,
      'the actual HTTP request records exposure for the hinted sentence');

    const sessionIdBeforeReload = await page.evaluate(() => S.sessionId);
    await page.reload();
    await page.waitForSelector('#pageHome:not(.hidden)', { timeout: 15000 });
    await page.waitForFunction(() => CL.getCloudConfig && CL.getCloudConfig().writeProtocol === 3, null, { timeout:15000 });
    await page.evaluate(() => CL.ensureCloud());
    await page.waitForFunction(() => mem.progress && mem.progress['server-answer'] &&
      mem.progress['server-answer'].sessionId, null, { timeout: 10000 });
    const localProgressAfterReload = await page.evaluate(() => mem.progress['server-answer']);
    await page.evaluate(index => { showPracticePage(); startDeck(findDeck('server-answer'), index); }, expectedSourceIndex);
    await page.waitForSelector('#stageChoices .choice', { timeout: 15000 });
    const resumedLocalState = await page.evaluate(() => ({ idx:S.idx, answerOrder:S.answerOrder,
      chunkRight:S.chunkRight, chunkTotal:S.chunkTotal, sessionId:S.sessionId }));
    assert.equal(await page.evaluate(() => cur().sentence), secondValue,
      'reload resumes the server-confirmed sentence rather than a browser-specific shuffled position');
    assert.equal(resumedLocalState.answerOrder, 1, 'reload restores answer order for the current protocol-3 session ' + JSON.stringify({ localProgressAfterReload, resumedLocalState }));
    assert.equal(resumedLocalState.chunkRight, 1);
    assert.equal(resumedLocalState.chunkTotal, 1);
    assert.equal(resumedLocalState.sessionId, sessionIdBeforeReload);
    await page.evaluate(() => {
      window.__practiceOperations = [];
      const send = ChunkAPI.submitOperation;
      ChunkAPI.submitOperation = function (operation) {
        if (['learning.answer', 'learning.resume', 'learning.roundComplete', 'learning.exposure', 'settings.patch'].includes(operation.type)) window.__practiceOperations.push(operation);
        return send(operation);
      };
    });

    await page.locator('#stageChoices .choice').first().click();
    await page.waitForFunction(() => window.__practiceOperations.filter(operation => operation.type === 'learning.answer').length === 1,
      null, { timeout: 10000 });
    await waitForAsync(page, async () => {
      const data = await ChunkAPI.getData();
      return data.mem.stats.totalAnswered === 2;
    }, null, { timeout: 15000 });
    await page.locator('#btnNext').click();
    await page.waitForSelector('#result:not(.hidden)', { timeout: 10000 });
    await waitForAsync(page, async () => {
      const data = await ChunkAPI.getData();
      const pending = await ServerStore.pending();
      const practiceIds = window.__practiceOperations.filter(operation =>
        ['learning.answer','learning.resume','learning.roundComplete','learning.exposure'].includes(operation.type))
        .map(operation => operation.requestId);
      return data.mem.stats.totalRounds === 1 &&
        !pending.some(row => practiceIds.includes(row.requestId));
    }, null, { timeout: 15000 });

    const completed = await page.evaluate(async () => {
      const operation = window.__practiceOperations.find(item => item.type === 'learning.roundComplete');
      const exposure = window.__practiceOperations.find(item => item.type === 'learning.exposure');
      const snapshot = await ChunkAPI.getData();
      const state = await ServerStore.state();
      return { operation, stats:snapshot.mem.stats, best:snapshot.mem.best['server-answer'],
        resumes:snapshot.learningResumes, state, pending:(await ServerStore.pending()).map(row=>({requestId:row.requestId,type:row.operation.type})),
        exposure, legacyDeck:snapshot.mem.decks.find(deck => deck.id === 'server-answer'),
        legacySettings:snapshot.mem.settings, deckIds:snapshot.mem.decks.map(deck => deck.id),
        logicalCourse:snapshot.mem.logicalCourses['logical-course:legacy-travel'],
         resumedAnswerOrder:window.__practiceOperations.find(item => item.type === 'learning.answer').payload.answerOrder };
    });
    assert.equal(completed.operation.payload.answerCount, 2);
    assert.equal(exposureOperation.payload.key, hintedSentenceKey, 'the exposure is attached to the hinted sentence');
    assert.equal(completed.resumedAnswerOrder, 1, 'reloading mid-session preserves contiguous server answer ordering');
    assert.equal(completed.stats.totalAnswered, 2);
    assert.equal(completed.stats.totalRounds, 1);
    assert.equal(completed.best.acc, 100);
    assert.equal(completed.best.perfect, 2);
    assert.equal(completed.best.combo, 2);
    assert.deepEqual(completed.resumes, {}, 'round completion retires the server resume checkpoint');
    const practiceRequestIds = await page.evaluate(() => window.__practiceOperations.filter(operation =>
      ['learning.answer','learning.resume','learning.roundComplete','learning.exposure'].includes(operation.type))
      .map(operation => operation.requestId));
    assert.equal(completed.pending.some(row => practiceRequestIds.includes(row.requestId)), false,
      'all requests emitted by this practice session are retired even if an unrelated background operation remains queued');
    assert.equal(completed.legacyDeck && completed.legacyDeck.items.length, 2,
      'the pre-existing browser baseline is automatically present in the server account before the new answers; decks=' +
      JSON.stringify(completed.deckIds));
    assert.equal(completed.legacySettings.sound, false,
      'baseline migration retains the prior browser settings');
    assert.equal(completed.logicalCourse && completed.logicalCourse.title, '旧版旅行课程',
      'verified legacy logical directories are migrated into the server catalog');
    assert.equal(completed.legacySettings.shuffle, true,
      'the settings patch has converged into the account snapshot');
    const previousSound = await page.evaluate(() => !!mem.settings.sound);
    await page.locator('#btnSound').click();
    await waitForAsync(page, async expectedSound => {
      const operation = window.__practiceOperations.findLast(item => item.type === 'settings.patch' &&
        Object.prototype.hasOwnProperty.call(item.payload.patch, 'sound'));
      const data = await ChunkAPI.getData();
      return operation && operation.payload.patch.sound === expectedSound &&
        data.mem.settings.sound === expectedSound;
    }, !previousSound, { timeout: 15000 });
    const soundOperation = await page.evaluate(() => window.__practiceOperations.findLast(item => item.type === 'settings.patch' &&
      Object.prototype.hasOwnProperty.call(item.payload.patch, 'sound')));
    const soundSnapshot = await page.evaluate(async () => (await ChunkAPI.getData()).mem.settings.sound);
    assert.deepEqual(soundOperation && soundOperation.payload.patch,
      {sound:!previousSound},
      'the toolbar sound toggle persists through the same narrow settings operation as the settings panel');
    assert.equal(soundSnapshot, !previousSound,
      'the server-confirmed snapshot reflects the toolbar sound setting');
    assert.deepEqual(legacyWrites, [], 'ordinary answering does not call the legacy full-snapshot/import write routes');

    const inlineRestore = await page.evaluate(async () => {
      const manifest = ContentRepo.getManifest();
      const entry = manifest && manifest.decks && manifest.decks[0];
      if (!entry || !entry.id) throw new Error('隔离页面没有可用的内置题库目录');
      const deck = Object.assign({ builtin: true }, entry);
      const key = deck.id + '#main-inline-restore-test';
      await ServerStore.submitCommitted('deck.itemsVisibility', {
        eventId: 'visibility-test-hide-inline-main', deckId: deck.id, keys: [key], hidden: true, expectedHidden: false,
      }, { requestId: 'visibility-test-hide-inline-main' });
      await ServerCache.refresh();
      const restoredCount = await restoreHiddenBuiltinItems(deck);
      const snapshot = await ChunkAPI.getData();
      return { deckId: deck.id, key, restoredCount, hidden: !!snapshot.mem.deletedItems[key] };
    });
    assert.equal(inlineRestore.restoredCount, 1, 'the inline restore action submits a real protocol-3 visibility operation');
    assert.equal(inlineRestore.hidden, false, 'the restored built-in sentence is removed from the server tombstone view');
    assert.deepEqual(legacyWrites, [], 'inline restoration does not call legacy snapshot/import write routes');

    const legacySnapshotGuard = await page.evaluate(async () => {
      const wasDirty = CL.isDirty();
      const proposed = JSON.parse(JSON.stringify(mem));
      proposed.settings = Object.assign({},proposed.settings,{_e2eSnapshotGuard:'local-only'});
      let rejectedCode = null;
      try { await CL.saveAndNotify(proposed); }
      catch (error) { rejectedCode = error.code || null; }
      const dirtyAfterGuard = CL.isDirty();
      const rejectedValueWasNotStored = !Object.prototype.hasOwnProperty.call(CL.loadMem().settings,'_e2eSnapshotGuard');
      await CL.saveAndNotify(mem, 'local');
      return {wasDirty, dirtyAfterGuard, rejectedValueWasNotStored, rejectedCode, localSave:true};
    });
    assert.equal(legacySnapshotGuard.rejectedCode,'PROTOCOL3_NARROW_WRITE_REQUIRED',
      'an unlabelled snapshot write is refused instead of being mistaken for a local projection');
    assert.equal(legacySnapshotGuard.rejectedValueWasNotStored,true,
      'the refused full snapshot does not persist its proposed settings value');
    assert.equal(legacySnapshotGuard.localSave, true,
      'a legacy local projection save in protocol 3 remains durable');
    assert.equal(legacySnapshotGuard.dirtyAfterGuard, legacySnapshotGuard.wasDirty,
      'a refused full snapshot does not change pre-existing legacy dirty/conflict state');
    assert.deepEqual(legacyWrites, [], 'protocol-3 local projection saves do not invoke full-snapshot or import writes');

    const statsPage = await context.newPage();
    const statsOperations = [];
    statsPage.on('request', request => {
      const url = new URL(request.url());
      if (request.method() !== 'GET' && ['/api/data', '/api/import'].includes(url.pathname)) {
        legacyWrites.push({ method: request.method(), path: url.pathname });
      }
    });
    statsPage.on('request', request => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return;
      try { statsOperations.push(JSON.parse(request.postData() || '{}')); } catch (_) {}
    });
    statsPage.on('pageerror', error => console.error('[main-persistence stats] page error:', error.message));
    const statsLegacyKey = 'rev-server-answer-stats#server-answer-1';
    const statsDb = new Database(path.join(dataDir, 'chunklab.db'));
    try {
      const user = statsDb.prepare("SELECT id FROM users WHERE username='__default__'").get();
      const seq = statsDb.prepare('UPDATE user_change_seq SET seq=seq+1 WHERE user_id=? RETURNING seq').get(user.id).seq;
      statsDb.prepare(`INSERT INTO user_sentence_stats(user_id,sentence_key,deck_id,data_json,deleted_at,updated_at,seq)
        VALUES(?,?,?,?,NULL,datetime('now'),?)`).run(user.id, statsLegacyKey, 'rev-server-answer-stats',
          JSON.stringify({ deckId: 'rev-server-answer-stats', times: 2, okTimes: 1, wrongTimes: 1 }), seq);
    } finally { statsDb.close(); }
    await statsPage.goto(base + '/stats.html?protocol3-mistake-remove=1', { waitUntil: 'domcontentloaded' });
    await statsPage.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady(),
      null, { timeout: 15000 });
    const statsSnapshotGuard = await statsPage.evaluate(async () => {
      const before = JSON.stringify(mem);
      const pendingBefore = (await ServerStore.pending()).length;
      let rejected = false, code = '';
      try { await saveStore(); } catch (error) { rejected = true; code = error && error.code || ''; }
      const unchanged = before === JSON.stringify(mem);
      const pendingStable = pendingBefore === (await ServerStore.pending()).length;
      const localProjection = await saveStore('local');
      return { rejected, code, unchanged, pendingStable, localProjection };
    });
    assert.deepEqual(statsSnapshotGuard, {
      rejected:true, code:'PROTOCOL3_NARROW_WRITE_REQUIRED', unchanged:true,
      pendingStable:true, localProjection:true
    }, 'stats page rejects an unlabelled whole-mem write and permits only explicit local projection');
    const statsMigrationId = await statsPage.evaluate(oldKey =>
      'legacy_stat_key_' + CL.fnv8(oldKey + '|server-answer#server-answer-1'), statsLegacyKey);
    await waitForAsync(statsPage, async eventId => {
      try {
        const receipt = await ChunkAPI.getOperationReceipt(eventId);
        return receipt && receipt.outcome === 'retained' && receipt.changes && receipt.changes.delta === true &&
          receipt.operation && receipt.operation.reason === 'modern-learning-evidence';
      } catch (_) { return false; }
    }, statsMigrationId, { timeout: 15000 });
    assert.match(statsMigrationId, /^legacy_stat_key_[a-f0-9]+$/,
      'the stats migration has a stable, queryable operation identity');
    const statsRetainedDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      const userId = statsRetainedDb.prepare("SELECT id FROM users WHERE username='__default__'").get().id;
      assert.equal(statsRetainedDb.prepare('SELECT deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?')
        .get(userId, statsLegacyKey).deleted_at, null, 'the stats migration leaves its old row intact when modern evidence exists');
    } finally { statsRetainedDb.close(); }
    await waitForAsync(statsPage, async () => (await ChunkAPI.getData()).mem.reinforceBook.some(item =>
      item._key === 'server-answer::legacy-wrong-entry'), null, { timeout: 15000 });
    await statsPage.locator('[data-tab="wrong"]').click();
    await statsPage.locator('.wrong-del[data-key="server-answer::legacy-wrong-entry"]').waitFor({ timeout: 10000 });
    const pendingProjectionGuard = await statsPage.evaluate(async () => {
      const originalPending = ServerStore.pending;
      const sentinel = { _key:'local-pending-guard', deckId:'local', sentence:'Local pending row.', mistakes:[], history:[] };
      mem.reinforceBook.push(sentinel);
      ServerStore.pending = () => Promise.resolve([{ requestId:'pending-projection-guard' }]);
      try {
        const applied = await refreshConfirmedStatsProjection();
        return { applied, kept:mem.reinforceBook.some(item => item._key === sentinel._key) };
      } finally {
        ServerStore.pending = originalPending;
        mem.reinforceBook = mem.reinforceBook.filter(item => item._key !== sentinel._key);
      }
    });
    assert.deepEqual(pendingProjectionGuard, {applied:false,kept:true},
      'confirmed server projection never replaces page state while any durable operation is pending');
    await statsPage.locator('.wrong-del[data-key="server-answer::legacy-wrong-entry"]').click();
    await waitForAsync(statsPage, async () => {
      const snapshot = await ChunkAPI.getData();
      return !snapshot.mem.reinforceBook.some(item => item._key === 'server-answer::legacy-wrong-entry');
    }, null, { timeout: 15000 });
    await statsPage.waitForFunction(() => !mem.reinforceBook.some(item =>
      item._key === 'server-answer::legacy-wrong-entry'), null, { timeout: 10000 });
    const mistakeRemoval = await statsPage.evaluate(async () => ({
      operation: (await ServerStore.pending()).find(row => row.type === 'mistake.remove') || null,
      localBook: mem.reinforceBook.map(item => item._key),
      snapshot: await ChunkAPI.getData(),
    }));
    const removeOperation = statsOperations.find(operation => operation.type === 'mistake.remove');
    assert.ok(removeOperation, 'the stats page sends a narrow mistake.remove operation, not a full snapshot');
    assert.equal(removeOperation.payload.key, 'server-answer::legacy-wrong-entry');
    assert.equal(mistakeRemoval.snapshot.mem.reinforceBook.some(item => item._key === removeOperation.payload.key), false,
      'the server records the mistake tombstone');
    assert.equal(mistakeRemoval.localBook.includes(removeOperation.payload.key), false,
      'the stats page updates its local projection only after the server confirms the deletion: ' + JSON.stringify(mistakeRemoval.localBook));
    await statsPage.evaluate(async () => {
      mem.reinforceBook.push({ _key:'server-answer::legacy-wrong-entry', deckId:'server-answer',
        sentence:'Say hello.', translation:'说你好。', mistakes:[], history:[] });
      await ServerCache.refresh();
    });
    await statsPage.waitForFunction(() => !mem.reinforceBook.some(item =>
      item._key === 'server-answer::legacy-wrong-entry'), null, { timeout: 10000 });
    assert.equal(await statsPage.locator('.wrong-row').count(), 1,
      'a confirmed downlink removes a stale local wrong-book row while retaining the other live row');
    await statsPage.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable:true, value:false }));
    statsPage.once('dialog', dialog => dialog.accept());
    await statsPage.locator('.wrong-del[data-key="server-answer::legacy-wrong-entry-2"]').click();
    const offlineDelete = await statsPage.evaluate(async () => ({
      local:mem.reinforceBook.some(item => item._key === 'server-answer::legacy-wrong-entry-2'),
      server:(await ChunkAPI.getData()).mem.reinforceBook.some(item => item._key === 'server-answer::legacy-wrong-entry-2'),
    }));
    assert.deepEqual(offlineDelete, {local:true,server:true}, 'offline deletion is rejected without changing either projection');
    await statsPage.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable:true, value:true }));
    statsPage.once('dialog', dialog => dialog.accept());
    await statsPage.locator('#btnClearWrongBook').click();
    await waitForAsync(statsPage, async () => (await ChunkAPI.getData()).mem.reinforceBook.length === 0,
      null, { timeout: 15000 });
    await waitForAsync(statsPage, async () => (await ServerStore.pending()).length === 0,
      null, { timeout: 15000 });
    assert.ok(statsOperations.some(operation => operation.type === 'mistake.remove' &&
      operation.payload.key === 'server-answer::legacy-wrong-entry-2'),
    'clearing the wrong-book submits an ordered narrow removal for each remaining entry');
    await statsPage.reload();
    await statsPage.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady(),
      null, { timeout: 15000 });
    await statsPage.locator('[data-tab="wrong"]').click();
    assert.equal(await statsPage.locator('.wrong-row').count(), 0,
      'the removed mistake stays absent after page reload');
    const remoteSettingsRefresh=await statsPage.evaluate(async () => {
      const snapshot=await ChunkAPI.getData();
      const value=!snapshot.mem.settings.shuffle;
      const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({protocol:3,requestId:'e2e_remote_stats_setting_01',type:'settings.patch',payload:{patch:{shuffle:value}}})});
      return {status:response.status,value,body:await response.json()};
    });
    assert.equal(remoteSettingsRefresh.status,200,'the simulated second device commits a settings change');
    await statsPage.waitForTimeout(5100); // Honor the production focus-refresh throttle.
    await statsPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await statsPage.waitForFunction(value=>mem.settings.shuffle===value,remoteSettingsRefresh.value,{timeout:10000});
    assert.equal((await statsPage.evaluate(()=>mem.settings.shuffle)),remoteSettingsRefresh.value,
      'the stats page refreshes server-confirmed state when it returns to the foreground');
    assert.deepEqual(legacyWrites, [], 'stats mistake removal does not call legacy snapshot/import write routes');
    await statsPage.close();


    const resetPage = await page.context().newPage();
    const resetOperations = [];
    resetPage.on('request', request => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return;
      try { const operation = JSON.parse(request.postData() || '{}'); if (operation.type === 'learning.reset') resetOperations.push(operation); } catch (_) {}
    });
    await resetPage.goto(base + '/decks.html?courseView=joined', { waitUntil:'networkidle' });
    const resetDeckCard = resetPage.locator('.deck-item').filter({ hasText:'服务端答题验收' });
    await resetDeckCard.waitFor({ state:'visible', timeout:15000 });
    await resetDeckCard.locator('.course-manage-trigger').click();
    await resetDeckCard.getByRole('menuitem', { name:'清除本课程学习统计' }).click();
    await resetPage.locator('#courseConfirmOk').click();
    await waitForAsync(resetPage, async () => {
      const snapshot = await ChunkAPI.getData();
      return (await ServerStore.pending()).length === 0 &&
        snapshot.learningGenerations['course:server-answer'] === 1 &&
        Object.keys(snapshot.mem.stats.bySentence).filter(key => key.indexOf('server-answer#') === 0)
          .every(key => snapshot.mem.stats.bySentence[key].times === 0);
    }, null, { timeout:15000 });
    const resetWrites = resetOperations.concat(protocolWrites.filter(operation => operation.type === 'learning.reset'));
    const uniqueResetWrites = Array.from(new Map(resetWrites.map(operation => [operation.requestId, operation])).values());
    const resetEventDb = new Database(path.join(dataDir, 'chunklab.db'));
    const resetEventCount = resetEventDb.prepare(`SELECT COUNT(*) AS count FROM user_operation_events
      WHERE user_id=1 AND event_id LIKE 'learning-reset-%'`).get().count;
    resetEventDb.close();
    assert.equal(resetEventCount, 1, 'the visible reset action commits exactly one reset event in SQLite');
    if (uniqueResetWrites.length) {
      assert.equal(uniqueResetWrites.length, 1, 'captured browser requests contain one learning.reset operation');
      assert.equal(uniqueResetWrites[0].payload.expectedGeneration, 0, 'reset uses the confirmed prior generation');
    }
    const staleAnswer = protocolWrites.find(operation => operation.type === 'learning.answer');
    const retained = await resetPage.evaluate(async operation => {
      const stale = JSON.parse(JSON.stringify(operation));
      stale.requestId = 'stale-after-reset-request';
      stale.payload.eventId = 'stale-after-reset-event';
      stale.payload.generation = 0;
      const receipt = await ChunkAPI.submitOperation(stale);
      await ServerCache.refresh();
      const snapshot = await ChunkAPI.getData();
      return {receipt, times:snapshot.mem.stats.bySentence[stale.payload.key].times};
    }, staleAnswer);
    assert.equal(retained.receipt.outcome, 'retained', 'a delayed pre-reset answer is retained but never applied');
    assert.equal(retained.times, 0, 'a delayed answer cannot resurrect cleared statistics');
    await page.evaluate(async () => {
      await ServerCache.refresh();
      startDeck(findDeck('server-answer'), 0, undefined, true);
    });
    await page.waitForFunction(() => S.deck && S.deck.id === 'server-answer' && S.generation === 1,
      null, { timeout:10000 });
    await page.locator('#stageChoices .choice').first().click();
    await waitForAsync(page, async () => {
      const operation=window.__practiceOperations.find(item=>item.type==='learning.answer'&&item.payload.generation===1);
      if(!operation) return false;
      const snapshot=await ChunkAPI.getData();
      return snapshot.mem.stats.bySentence[operation.payload.key]?.times===1;
    }, null, { timeout:10000 });
    await waitForAsync(page, async () => (await ServerStore.pending()).length === 0, null, { timeout:10000 });
    await resetPage.close();

    // Learning remains available when optional historical recovery is unavailable.
    const gateContext = await browser.newContext({ serviceWorkers: 'block' });
    const gatePage = await gateContext.newPage();
    let unpreservedSnapshotReads = 0;
    let startupGatedOperationRequests = 0;
    await gatePage.route('**/js/legacy-recovery.js', route => route.abort());
    gatePage.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname === '/api/data') unpreservedSnapshotReads++;
      if (request.method() === 'POST' && url.pathname === '/api/operations') startupGatedOperationRequests++;
    });
    await gatePage.goto(base + '/main.html?missing-recovery-module=1');
    await gatePage.waitForFunction(() => window.CL && CL.getCloudConfig &&
      CL.getCloudConfig().persistenceMode === 'server-authoritative', null, { timeout: 15000 });
    const gatedStartup = await gatePage.evaluate(() => CL.ensureCloud());
    assert.ok(gatedStartup, 'optional recovery modules are not a startup dependency');
    const queuedWhileGated = await gatePage.evaluate(() => ServerStore.submit('settings.patch', { patch: { sound: false } }));
    assert.equal(queuedWhileGated.durable, true,
      'local IndexedDB enqueue remains available while recovery prevents server sends');
    assert.equal(await gatePage.evaluate(() => CL.serverPersistenceReady()), true);
    await gatePage.evaluate(() => ServerStore.retryPending());
    await waitForAsync(gatePage, async id => !(await IDBStore.listPendingOperations()).some(row=>row.requestId===id),
      queuedWhileGated.requestId, {timeout:15000});
    const pendingWhileGated = await gatePage.evaluate(async id =>
      (await IDBStore.listPendingOperations()).some(row => row.requestId === id), queuedWhileGated.requestId);
    assert.equal(pendingWhileGated, false, 'accepted operation is confirmed and retired');
    assert.ok(unpreservedSnapshotReads > 0, 'server cache loads without historical recovery');
    assert.ok(startupGatedOperationRequests > 0, 'new operations submit without historical recovery');
    await gateContext.close();

    // Keep the application document reachable while the learning-operation
    // endpoint is unavailable, so a real reload can prove the IndexedDB queue
    // (not merely in-memory state) is the recovery source.
    await page.evaluate(() => {
      sessionStorage.setItem('e2e-offline-operations', '1');
      Object.defineProperty(navigator, 'onLine', { configurable:true, get:() => false });
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-offline-operations') === '1') {
        Object.defineProperty(navigator, 'onLine', { configurable:true, get:() => false });
      }
    });
    const offlineDeckName = 'E2E 断网二十题';
    const offlineDeck = await page.evaluate(async name => {
      const items = Array.from({length:20}, (_, index) => {
        const sentence = 'Offline durable answer ' + (index + 1) + '.';
        return { cid:'offline-answer-' + (index + 1), sentence, en:sentence, translation:'离线答案 ' + (index + 1),
          chunks:[sentence], alts:[[]], hints:[] };
      });
      await commitImport(items, name);
      const deck = mem.decks.find(item => item.name === name);
      if (!deck || deck.items.length !== 20) throw new Error('离线答题夹具未写入服务器确认题库');
      mem.settings.shuffle = false;
      mem.settings.mode = 'choose';
      mem.settings.batchSize = 20;
      showPracticePage();
      startDeck(deck, 0);
      const confirmed = await ServerCache.read();
      if (!confirmed) throw new Error('离线答题前缺少服务器确认缓存');
      return {id:deck.id, initialTotal:confirmed.snapshot.mem.stats.totalAnswered};
    }, offlineDeckName);
    await page.waitForFunction(id => S.deck && S.deck.id === id && S.idx === 0 && S.items.length === 20,
      offlineDeck.id, { timeout:15000 }).catch(async error => {
      const state=await page.evaluate(() => ({deckId:S.deck&&S.deck.id,idx:S.idx,itemCount:S.items&&S.items.length,
        first:S.items&&S.items[0]&&S.items[0].sentence,stageHidden:$('stage').classList.contains('hidden'),
        practiceHidden:$('pagePractice').classList.contains('hidden'),config:CL.getCloudConfig(),ready:CL.serverPersistenceReady()}));
      throw new Error(error.message+'; offline start state='+JSON.stringify(state));
    });
    const offlineSentences = await page.evaluate(() => S.items.map(item => item.sentence));
    await page.route('**/api/operations', route => route.abort());
    for (let index = 0; index < 20; index++) {
      const sentence = offlineSentences[index];
      await page.waitForSelector('#stageChoices .choice', { timeout:10000 });
      await page.evaluate(value => {
        const choice = Array.from(document.querySelectorAll('#stageChoices .choice')).find(button => button.dataset.v === value);
        if (!choice) throw new Error('找不到离线题目正确选项：' + value + '；当前选项=' + JSON.stringify(Array.from(document.querySelectorAll('#stageChoices .choice')).map(button => button.dataset.v)));
        choice.click();
      }, sentence);
      await page.waitForSelector('#btnNext:not([disabled])', { timeout:10000 });
      await page.locator('#btnNext').click();
      if (index < 19) await page.waitForFunction(expected => S.idx === expected, index + 1, { timeout:10000 });
    }
    await page.waitForSelector('#result:not(.hidden)', { timeout:10000 });
    const offlineQueueBeforeReload = await page.evaluate(async id => {
      const pending = await IDBStore.listPendingOperations();
      const answers = pending.map(row => row.operation).filter(operation => operation.type === 'learning.answer' && operation.payload.deckId === id);
      return {answers:answers.length, uniqueEvents:new Set(answers.map(operation => operation.payload.eventId)).size,
        eventIds:answers.map(operation => operation.payload.eventId)};
    }, offlineDeck.id);
    assert.equal(offlineQueueBeforeReload.answers, 20,
      'all 20 answer actions are independently present in durable IndexedDB while the server is unreachable');
    assert.equal(offlineQueueBeforeReload.uniqueEvents, 20, 'each offline answer has its own idempotency event');
    await page.waitForFunction(() => {
      const status = document.getElementById('chunklabSaveStatus');
      return status && status.dataset.visible === 'true' && /已安全保存在此设备，联网后会自动同步/.test(status.textContent);
    }, null, { timeout:8000 });
    await page.reload({ waitUntil:'networkidle' });
    await page.waitForFunction(() => window.CL && CL.getCloudConfig && CL.getCloudConfig().writeProtocol === 3,
      null, { timeout:15000 });
    const durableAfterReload = await page.evaluate(async id => (await IDBStore.listPendingOperations())
      .map(row => row.operation).filter(operation => operation.type === 'learning.answer' && operation.payload.deckId === id).length, offlineDeck.id);
    assert.equal(durableAfterReload, 20, 'reloading before reconnect preserves each accepted answer in IndexedDB');
    await page.waitForFunction(() => CL.serverPersistenceReady(), null, { timeout:15000 });
    await page.unroute('**/api/operations');
    const reconnectRequest = page.waitForRequest(request => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/operations') return false;
      try { return JSON.parse(request.postData() || '{}').payload.deckId === offlineDeck.id; } catch (_) { return false; }
    }, { timeout:10000 });
    const onlineAfterReconnect = await page.evaluate(() => {
      sessionStorage.removeItem('e2e-offline-operations');
      Object.defineProperty(navigator, 'onLine', { configurable:true, value:true });
      window.dispatchEvent(new Event('online'));
      return navigator.onLine;
    });
    assert.equal(onlineAfterReconnect, true, 'the simulated reconnect restores the browser online signal');
    await reconnectRequest;
    const verificationDb = new Database(path.join(dataDir, 'chunklab.db'));
    const countAcceptedOfflineAnswers = () => verificationDb.prepare(`SELECT COUNT(*) AS count FROM user_operation_events
      WHERE user_id=1 AND event_id IN (${offlineQueueBeforeReload.eventIds.map(() => '?').join(',')})`)
      .get(...offlineQueueBeforeReload.eventIds).count;
    const convergenceDeadline = Date.now() + 30000;
    while (countAcceptedOfflineAnswers() !== 20 && Date.now() < convergenceDeadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const acceptedOfflineAnswers = countAcceptedOfflineAnswers();
    assert.equal(acceptedOfflineAnswers, 20, 'reconnected SQLite receives all offline answer events exactly once');
    await page.evaluate(() => { window.__offlineProjectionStable = null; });
    await waitForAsync(page, async ({id,name,baseline}) => {
      const rows = await IDBStore.listPendingOperations();
      const deckRows = rows.some(row => row.operation && row.operation.payload && row.operation.payload.deckId === id);
      const confirmed = await ServerCache.read();
      const snapshot = confirmed && confirmed.snapshot;
      const deck = snapshot && snapshot.mem.decks.find(item => item.id === id && item.name === name);
      const ready = !deckRows && deck && snapshot.mem.stats.totalAnswered-baseline === 20 &&
        deck.items.every(item => snapshot.mem.stats.bySentence[deck.id + '#' + item.cid]?.times === 1);
      if (!ready) { window.__offlineProjectionStable = null; return false; }
      const signature = JSON.stringify({seq:confirmed.appliedSeq,total:snapshot.mem.stats.totalAnswered,
        times:deck.items.map(item=>snapshot.mem.stats.bySentence[deck.id+'#'+item.cid]?.times||0)});
      const prior = window.__offlineProjectionStable;
      if (!prior || prior.signature !== signature) {
        window.__offlineProjectionStable = {signature,since:Date.now()};
        return false;
      }
      return Date.now()-prior.since >= 500;
    }, {id:offlineDeck.id,name:'E2E 断网二十题',baseline:offlineDeck.initialTotal}, { timeout:30000 });
    const offlineConvergence = await page.evaluate(async initialTotal => {
      const confirmed = await ServerCache.read();
      const snapshot = confirmed.snapshot;
      const deck = snapshot.mem.decks.find(item => item.name === 'E2E 断网二十题');
      return { total:snapshot.mem.stats.totalAnswered-initialTotal,
        times:deck.items.map(item => snapshot.mem.stats.bySentence[deck.id + '#' + item.cid]?.times || 0),
        pendingAnswers:(await IDBStore.listPendingOperations()).filter(row => row.operation && row.operation.type === 'learning.answer' &&
          row.operation.payload && row.operation.payload.deckId === deck.id).length,
        seq:confirmed.appliedSeq,initialTotal,
        confirmedTotal:snapshot.mem.stats.totalAnswered };
    }, offlineDeck.initialTotal);
    console.log('[main-persistence] offline convergence:', JSON.stringify(offlineConvergence));
    if (offlineConvergence.times.some(count => count !== 1)) {
      const diagnostics = verificationDb.prepare(`SELECT operation.event_id AS eventId, operation.operation_id AS requestId,
          JSON_EXTRACT(operation.result_json, '$.outcome') AS outcome, learning.generation AS generation,
          learning.sentence_key AS key
        FROM user_operation_events operation
        LEFT JOIN user_learning_events learning ON learning.user_id=operation.user_id AND learning.event_id=operation.event_id
        WHERE operation.user_id=1 AND operation.event_id IN (${offlineQueueBeforeReload.eventIds.map(() => '?').join(',')})
        ORDER BY operation.created_at, operation.event_id`).all(...offlineQueueBeforeReload.eventIds);
      const activeGeneration = verificationDb.prepare('SELECT generation FROM user_learning_generations WHERE user_id=1 AND scope_key=?')
        .get('course:' + offlineDeck.id);
      console.error('[main-persistence] offline answer replay diagnosis:', JSON.stringify({
        activeGeneration: activeGeneration && activeGeneration.generation,
        acceptedReceipts: diagnostics,
      }));
    }
    verificationDb.close();
    assert.deepEqual(offlineConvergence.times, Array(20).fill(1), 'no answer is lost or counted twice after reload and reconnect');
    assert.equal(offlineConvergence.total, 20, 'reconnected SQLite accepts the offline answer set exactly once');
    assert.equal(offlineConvergence.pendingAnswers, 0, 'all answer operations are retired only after confirmed cache application');

    const stagedExportId = 'e2e-export-pending-operation-01';
    await page.evaluate(async requestId => {
      const base = new URL(ChunkAPI.getBase() || location.origin, location.origin);
      base.hash = ''; base.search = '';
      const operation = { protocol:3, requestId, type:'settings.patch', payload:{patch:{shuffle:true}} };
      await IDBStore.putPendingOperation({ requestId, operation, owner:AccountStorage.owner,
        sessionEpoch:AccountStorage.sessionEpoch || '', base:base.href.replace(/\/+$/,''),
        scope:JSON.stringify([base.href.replace(/\/+$/,''),AccountStorage.owner,3]), createdAt:Date.now(),
        attempts:2, status:'pending', bytes:new Blob([JSON.stringify(operation)]).size });
      mem.decks.push({id:'local-only-export-fixture',name:'不得进入云端备份',items:[]});
    }, stagedExportId);
    await page.locator('#btnSettingsTop').click();
    await page.locator('#settingsMask').waitFor({state:'visible'});
    await page.locator('#backupHead').click();
    const exportDownloadPromise = page.waitForEvent('download',{timeout:8000}).catch(() => null);
    await page.locator('#btnExportAll').click();
    const exportDownload = await exportDownloadPromise;
    if(!exportDownload) throw new Error('server-authoritative export did not download a file: '+JSON.stringify(await page.evaluate(() => ({
      toast:$('sysToast')&&$('sysToast').textContent,settingsVisible:!$('settingsMask').classList.contains('hidden'),
      backupExpanded:!$('backupBody').classList.contains('hidden'),ready:CL.serverPersistenceReady(),
      persistence:CL.getCloudConfig(),store:ServerStore.state()
    }))));
    const exportPath = await exportDownload.path();
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    assert.equal(exported.saveState.source, 'server-confirmed', 'protocol-3 backups identify their authoritative source');
    assert.equal(exported.saveState.seq, (await page.evaluate(async () => (await ChunkAPI.exportData()).seq)),
      'backup watermark comes from the server snapshot');
    assert.ok(exported.mem.decks.some(deck => deck.name === 'E2E 断网二十题'), 'export contains server-confirmed learning content');
    assert.ok(!exported.mem.decks.some(deck => deck.id === 'local-only-export-fixture'),
      'unconfirmed local projection is never mislabeled as confirmed backup data');
    assert.equal(exported.saveState.unconfirmedOperations.length, 1, 'durable pending operations are exported in a separate section');
    assert.equal(exported.saveState.unconfirmedOperations[0].requestId, stagedExportId,
      'pending operation identity is preserved for later recovery tooling');
    assert.equal(await page.evaluate(() => typeof LegacyRestore), 'undefined',
      'ordinary export does not load historical restore modules');

    const serverResumeSeed=await page.evaluate(async () => {
      const cache=await ServerCache.read();
      const generation=Number(cache.snapshot.learningGenerations['course:server-answer'])||0;
      const payload={deckId:'server-answer',courseId:'server-answer',sessionId:'e2e_second_device_resume',
        generation,idx:1,practiceMode:'input'};
      const result=await ServerStore.submitCommitted('learning.resume',payload,{requestId:'e2e_second_device_resume'});
      await ServerCache.refresh();
      const confirmed=await ServerCache.read();
      return {result,payload,confirmedResume:confirmed.snapshot.learningResumes[payload.sessionId],allResumes:confirmed.snapshot.learningResumes};
    });
    assert.ok(serverResumeSeed.confirmedResume && serverResumeSeed.confirmedResume.idx===1,
      'the account has a confirmed resume position for the second-device check: '+JSON.stringify(serverResumeSeed));
    const serverCourseSeed=await page.evaluate(async () => {
      const snapshot=await ChunkAPI.getData();
      const course={courseId:'e2e-second-device-course',version:'v1',title:'第二设备课程投影',nodes:[]};
      const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({protocol:3,requestId:'e2e_second_device_course_seed',type:'course.put',payload:{course},expectedRev:null})});
      return {status:response.status,body:await response.json()};
    });
    assert.equal(serverCourseSeed.status,200,'a server-authored course is committed before opening the clean device');
    const handoverTemplate=protocolWrites.findLast(operation=>operation.type==='learning.answer');
    assert.ok(handoverTemplate,'a confirmed answer payload is available for the archived pending-operation handover fixture');
    const handoverRequestId='e2e_archived_handover_answer_01';
    const handoverOperation=JSON.parse(JSON.stringify(handoverTemplate));
    handoverOperation.requestId=handoverRequestId;
    handoverOperation.payload.eventId='e2e_archived_handover_event_01';
    handoverOperation.payload.sessionId='e2e_archived_handover_session_01';
    handoverOperation.payload.answerOrder=0;
    const handoverOwner=JSON.stringify([base,'local']);
    const handoverScope=JSON.stringify([base,handoverOwner,3]);
    const handoverSource={format:'chunklab.recovery-source',version:1,capturedAt:'2026-10-04T12:00:00.000Z',
      sourceKind:'account-local',owner:handoverOwner,localStorage:{'chunklab.v1':'{}'},stores:{pendingOperations:[{
        requestId:handoverRequestId,operation:handoverOperation,owner:handoverOwner,base,scope:handoverScope,
        createdAt:Date.now(),attempts:0,attemptEvidenceVersion:1,ordinal:1,
      }],syncMeta:[],syncIntents:[]}};
    const handoverRaw=Buffer.from(JSON.stringify(handoverSource));
    const handoverHash=createHash('sha256').update(handoverRaw).digest('hex');
    const handoverSourceId='e2e-archived-pending-handover';
    const totalBeforeHandover=await page.evaluate(async()=>(await ChunkAPI.getData()).mem.stats.totalAnswered);
    const handoverDb=new Database(path.join(dataDir,'chunklab.db'));
    try {
      const userId=handoverDb.prepare("SELECT id FROM users WHERE username='__default__'").get().id;
      const manifest={version:1,state:'archived-not-merged',sourceId:handoverSourceId,sourceHash:handoverHash,
        verified:true,legacyReceipts:[{requestId:handoverRequestId,receipt:'unknown',kind:'operation',seq:null,
          replayProof:'durable-not-started-at-capture',replayPolicy:'same-request-id-and-body-only'}]};
      handoverDb.prepare(`INSERT INTO user_recovery_sources
        (user_id,source_id,source_hash,codec,payload_blob,manifest_json) VALUES(?,? ,?,'gzip',?,?)`)
        .run(userId,handoverSourceId,handoverHash,gzipSync(handoverRaw),JSON.stringify(manifest));
    } finally { handoverDb.close(); }
    const libraryPage=await page.context().newPage();
    const libraryLegacyWrites=[];
    libraryPage.on('request',request=>{
      const url=new URL(request.url());
      if(request.method()!=='GET'&&['/api/data','/api/import'].includes(url.pathname))
        libraryLegacyWrites.push({method:request.method(),path:url.pathname});
    });
    await libraryPage.goto(base+'/decks.html?courseType=courses&courseView=all');
    await libraryPage.waitForFunction(()=>window.CL&&CL.serverPersistenceReady&&CL.serverPersistenceReady()&&window.Library);
    const libraryCourseProjection=await libraryPage.evaluate(async () => {
      const course=await Library.setLibMeta('e2e-second-device-course',{
        seriesId:'s-e2e',seriesName:'跨设备验收',volumeIndex:1,volumeName:'第 1 册',sortOrder:1});
      return {course,local:CL.readCourses().find(item=>item.courseId===course.courseId)};
    });
    assert.equal(libraryCourseProjection.local.lib.volumeName,'第 1 册',
      'confirmed library metadata updates the local read projection');
    assert.deepEqual(libraryLegacyWrites,[],
      'a confirmed library metadata write never calls the legacy full-snapshot or import routes');
    await libraryPage.close();

    const freshContext = await browser.newContext({ serviceWorkers:'block' });
    const freshPage = await freshContext.newPage();
    await freshPage.addInitScript(() => {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    });
    const freshErrors=[];
    freshPage.on('pageerror',error=>freshErrors.push(error.message));
    await freshPage.goto(base + '/main.html');
    await freshPage.waitForFunction(() => window.CL && CL.serverPersistenceReady && CL.serverPersistenceReady(),
      null,{timeout:15000});
    await freshPage.waitForSelector('#pageHome:not(.hidden)',{timeout:15000});
    const freshHome=await freshPage.evaluate(async () => {
      const cache=await ServerCache.read();
      const resumeRows=Object.values(cache.snapshot.learningResumes||{});
      const latest=resumeRows.filter(row=>row.deckId==='server-answer').sort((a,b)=>b.updatedAt-a.updatedAt)[0]||null;
      return {
        owner:AccountStorage.owner,
        localBusinessCache:localStorage.getItem('chunklab.v1'),
        cacheDeck:cache.snapshot.mem.decks.some(deck=>deck.id==='server-answer'),
        cacheMembership:cache.snapshot.courseProgress['enrollment:v1:user-deck%3Aserver-answer']||null,
        projectedMembership:CL.readProgress()['enrollment:v1:user-deck%3Aserver-answer']||null,
        cacheCourse:cache.snapshot.courses.find(course=>course.courseId==='e2e-second-device-course')||null,
        projectedCourse:CL.readCourses().find(course=>course.courseId==='e2e-second-device-course')||null,
        joinedCard:!!document.querySelector('[data-home-course="user-deck:server-answer"]'),
        projectedDeck:mem.decks.some(deck=>deck.id==='server-answer'),
        cacheAnswers:cache.snapshot.mem.stats.totalAnswered,
        projectedAnswers:mem.stats.totalAnswered,
        expectedResume:latest&&{idx:latest.idx,sessionId:latest.sessionId,generation:latest.generation},
        projectedResume:mem.progress&&mem.progress['server-answer']?{
          idx:mem.progress['server-answer'].idx,
          sessionId:mem.progress['server-answer'].sessionId,
          generation:mem.progress['server-answer'].generation,
        }:null,
        ready:CL.serverPersistenceReady(),
      };
    });
    assert.equal(freshHome.ready,true,'a clean second browser context completes the server startup gate');
    assert.equal(freshHome.localBusinessCache,null,'the second device begins without a legacy business snapshot');
    assert.equal(freshHome.cacheDeck,true,'the test account has server-confirmed learning content');
    assert.equal(freshHome.projectedDeck,true,'the home page projects server-confirmed decks on a clean device');
    assert.equal(freshHome.joinedCard,true,'the second device renders a course joined on the first device');
    assert.deepEqual(freshHome.projectedMembership,freshHome.cacheMembership,'joined course membership is hydrated from the confirmed server snapshot');
    assert.deepEqual(freshHome.projectedCourse,freshHome.cacheCourse,'authored course content is hydrated from the confirmed server snapshot');
    assert.equal(freshHome.projectedCourse.lib.volumeName,'第 1 册',
      'a server-confirmed library classification survives a clean-device launch');
    assert.equal(freshHome.projectedAnswers,freshHome.cacheAnswers,'the home page projects confirmed learning statistics');
    assert.deepEqual(freshHome.projectedResume,freshHome.expectedResume,'the home resume position comes from the latest server-confirmed session');
    const ignoredArchive=await freshPage.evaluate(async()=>({
      total:(await ChunkAPI.getData()).mem.stats.totalAnswered,
      pending:(await IDBStore.listPendingOperations()).some(row=>row.requestId==='e2e_archived_handover_answer_01'),
      receipt:await ChunkAPI.request('/api/operations/e2e_archived_handover_answer_01',{method:'GET'}).catch(error=>({status:error.status})),
    }));
    assert.equal(ignoredArchive.total,totalBeforeHandover,'normal startup does not replay an archived answer');
    assert.equal(ignoredArchive.pending,false,'normal startup does not import archived operations into the live queue');
    assert.equal(ignoredArchive.receipt.status,404,'archived work is never submitted automatically');
    await freshPage.reload();
    await freshPage.waitForFunction(()=>CL.serverPersistenceReady(),null,{timeout:15000});
    assert.equal(await freshPage.evaluate(async()=>(await ChunkAPI.getData()).mem.stats.totalAnswered),totalBeforeHandover,
      'later startup also leaves historical operations untouched');
    assert.deepEqual(freshErrors,[],'server-authoritative hydration has no browser exceptions');
    await new Promise(resolve=>setTimeout(resolve,5200));
    const remoteDeckName='E2E 跨设备题库更新';
    const remoteDeckWrite=await page.evaluate(async name=>{
      const snapshot=await ChunkAPI.getData();
      const deck=JSON.parse(JSON.stringify(snapshot.mem.decks.find(item=>item.id==='server-answer')));
      if(!deck) throw new Error('server-confirmed deck is missing from the simulated remote writer');
      deck.name=name;
      const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({protocol:3,requestId:'e2e_remote_deck_change_01',type:'deck.put',payload:{deck},
          expectedRev:snapshot.revs.decks[deck.id]})});
      return {status:response.status,body:await response.json()};
    },remoteDeckName);
    assert.equal(remoteDeckWrite.status,200,'a separate browser client commits the cross-device deck change to SQLite');
    await freshPage.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await freshPage.waitForFunction(name=>mem.decks.some(deck=>deck.id==='server-answer'&&deck.name===name),remoteDeckName,{timeout:10000});
    assert.equal(await freshPage.locator('[data-home-course="user-deck:server-answer"]').textContent().then(text=>text.includes(remoteDeckName)),true,
      'returning to the home tab refreshes the server cache and renders the other device content change');
    let releaseHeldOperation;
    const heldOperationStarted = new Promise(resolve => { releaseHeldOperation = resolve; });
    const heldRequestId = 'exit-delay-operation-0001';
    const exitStressRequestIds = Array.from({length:20}, (_, index) =>
      `exit-delay-operation-${String(index + 1).padStart(4, '0')}`);
    await freshPage.route('**/api/operations', async route => {
      let body;
      try { body = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      if (body && body.requestId === heldRequestId) {
        releaseHeldOperation();
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      await route.continue();
    });
    await freshPage.locator('[data-home-course="user-deck:server-answer"]').click();
    await freshPage.waitForSelector('#stageChoices .choice', { timeout: 15000 });
    const durableBeforeExit = await freshPage.evaluate(async requestId => {
      const accepted = await ServerStore.submit('settings.patch', { patch: { sound: true } }, { requestId });
      return { durable: accepted.durable, queued: (await ServerStore.pending()).some(row => row.requestId === requestId) };
    }, heldRequestId);
    assert.deepEqual(durableBeforeExit, { durable: true, queued: true },
      'the delayed operation is safely in IndexedDB before the user exits');
    await Promise.race([heldOperationStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('delayed operation was not sent')), 3000))]);
    const otherDurableOperations = await freshPage.evaluate(async requestIds => Promise.all(requestIds.slice(1).map(async requestId => {
      const result = await ServerStore.submit('settings.patch', { patch: { sound: true } }, { requestId });
      return result.durable;
    })), exitStressRequestIds);
    assert.equal(otherDurableOperations.length, 19);
    assert.equal(otherDurableOperations.every(Boolean), true,
      'nineteen additional valid operations remain durably enqueueable behind the held network response');
    const queuedExitOperations = await freshPage.evaluate(async ids => {
      const rows = await ServerStore.pending();
      return rows.filter(row => ids.includes(row.requestId)).length;
    }, exitStressRequestIds);
    assert.equal(queuedExitOperations, 20,
      'all twenty operations are retained before exit while the first HTTP response is still held');
    const exitStartedAt = Date.now();
    await freshPage.locator('#btnExitPractice').click();
    await freshPage.waitForFunction(() => {
      const home = document.getElementById('pageHome');
      const practice = document.getElementById('pagePractice');
      return home && !home.classList.contains('hidden') && practice && practice.classList.contains('hidden');
    }, null, { timeout: 1000 });
    const exitElapsedMs = Date.now() - exitStartedAt;
    assert.ok(exitElapsedMs < 1000, `practice exit should not wait for the 5-second server response (actual ${exitElapsedMs}ms)`);
    console.log(`[main-persistence] 20 operations were durable; practice exit returned home in ${exitElapsedMs}ms while HTTP was held for 5s`);
    await waitForAsync(freshPage, async ids => !(await ServerStore.pending()).some(row => ids.includes(row.requestId)),
      exitStressRequestIds, { timeout: 15000 });
    const secondDeviceBeforeAnswer=await freshPage.evaluate(async()=>{
      window.__secondDeviceSubmittedAnswers=[];
      const submit=ServerStore.submit;
      ServerStore.submit=function(type,payload,options){
        if(type==='learning.answer') window.__secondDeviceSubmittedAnswers.push({type,payload,options});
        return submit.apply(this,arguments);
      };
      return (await ChunkAPI.getData()).mem.stats.totalAnswered;
    });
    await freshPage.locator('[data-home-course="user-deck:server-answer"]').click();
    await freshPage.waitForSelector('#stageChoices .choice',{timeout:15000});
    await freshPage.locator('#stageChoices .choice').first().click();
    await waitForAsync(freshPage, async before=>(await ChunkAPI.getData()).mem.stats.totalAnswered===before+1,
      secondDeviceBeforeAnswer,{timeout:15000});
    const secondDeviceClientAnswers=await freshPage.evaluate(()=>window.__secondDeviceSubmittedAnswers||[]);
    const secondDeviceAnswer=secondDeviceClientAnswers.find(row=>row.payload&&row.payload.deckId==='server-answer');
    assert.ok(secondDeviceAnswer&&secondDeviceAnswer.options&&secondDeviceAnswer.options.requestId&&secondDeviceAnswer.payload.eventId,
      'the clean second browser submits its own ordinary answer through the protocol-3 client');
    const retriedAnswer=await freshPage.evaluate(async row=>{
      const operation={protocol:3,requestId:row.options.requestId,type:row.type,payload:row.payload};
      const first=await ChunkAPI.submitOperation(operation);
      await ServerStore.retryPending();
      const receipt=await ChunkAPI.request('/api/operations/'+encodeURIComponent(row.options.requestId),{method:'GET'});
      return {operation,first,receipt};
    },secondDeviceAnswer);
    assert.equal(retriedAnswer.first.requestId,secondDeviceAnswer.options.requestId,
      'a retry of the exact second-device answer receives its matching durable server receipt');
    assert.equal(retriedAnswer.receipt.requestId,secondDeviceAnswer.options.requestId,
      'the second-device answer receipt can be recovered by its original request id');
    const secondDeviceDb=new Database(path.join(dataDir,'chunklab.db'),{readonly:true});
    try{
      const receiptRows=secondDeviceDb.prepare('SELECT user_id FROM user_operation_receipts WHERE request_id=?')
        .all(secondDeviceAnswer.options.requestId);
      const eventRows=secondDeviceDb.prepare('SELECT user_id FROM user_operation_events WHERE event_id=?')
        .all(secondDeviceAnswer.payload.eventId);
      assert.equal(receiptRows.length,1,'the second-device answer has one authoritative SQLite receipt; requestId='+secondDeviceAnswer.options.requestId+
        '; users='+JSON.stringify(secondDeviceDb.prepare('SELECT id,username FROM users').all())+
        '; recent='+JSON.stringify(secondDeviceDb.prepare('SELECT user_id,request_id FROM user_operation_receipts ORDER BY rowid DESC LIMIT 5').all()));
      assert.equal(eventRows.length,1,'the second-device answer event reaches SQLite exactly once');
      assert.equal(eventRows[0].user_id,receiptRows[0].user_id,'receipt and answer event are committed to the same account');
    }finally{secondDeviceDb.close();}
    await freshContext.close();
    console.log('[main-persistence] direct server startup, online answer/resume/round commits, offline convergence, cross-device reads, and server-confirmed export passed on isolated protocol-3 SQLite');
  } catch (error) {
    console.error('[main-persistence] failed:', error && error.stack || error);
    if (page && !page.isClosed()) {
      try { console.error('[main-persistence] page diagnostics:', JSON.stringify(await page.evaluate(async () => ({
        index:S.idx, answerOrder:S.answerOrder, sessionId:S.sessionId, roundQueued:S._roundQueued,
        roundSubmitting:S._roundSubmitting, pending:S._pendingRoundOperation,
        result:document.querySelector('#result') && document.querySelector('#result').className,
        next:document.querySelector('#btnNext') && { text:document.querySelector('#btnNext').textContent, disabled:document.querySelector('#btnNext').disabled },
        toast:document.querySelector('#sysToast') && document.querySelector('#sysToast').textContent,
        explain:document.querySelector('#explainMsg') && {text:document.querySelector('#explainMsg').textContent,
          buttonDisabled:document.querySelector('#explainApply') && document.querySelector('#explainApply').disabled,
          handler:document.querySelector('#explainApply') && typeof document.querySelector('#explainApply').onclick,
          input:document.querySelector('#explainJsonBox') && document.querySelector('#explainJsonBox').value,
          maskHidden:document.querySelector('#explainMask') && document.querySelector('#explainMask').hidden,
          deck:window._explainDeck && window._explainDeck.id,index:window._explainIdx},
        online:navigator.onLine,ready:CL.serverPersistenceReady(),storeState:ServerStore.state(),
        cache:await ServerCache.read().then(row => row && {seq:row.appliedSeq,total:row.snapshot.mem.stats.totalAnswered}),
        queueSummary:(await ServerStore.pending()).map(row => ({type:row.operation.type,status:row.status,attempts:row.attempts,lastError:row.lastError,receiptSeq:row.receipt&&row.receipt.seq})),
        failedRequests
      })))); } catch (_) {}
    }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }
})();
