'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10330, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-ai-native-learning-'));
const COURSE_ID = 'ai-legacy-e2e-123456';
const BLOCKED_ID = 'ai-legacy-blocked-123456';
function oldCourse(courseId, { chunks = true } = {}) {
  const utterances = [
    { id: 'line-a', text: { en: 'We are ready.', 'zh-CN': '我们准备好了。' }, acceptedAnswers: { en: ['We are ready.'] }, imageAssetId: null, audioAssetId: null,
      chunks: chunks ? { items: [{ id: 'a-1', text: 'We are ' }, { id: 'a-2', text: 'ready.' }], correctOrder: ['a-1', 'a-2'], distractors: [{ id: 'a-d1', text: 'We ready' }] } : undefined },
    { id: 'line-b', text: { en: 'Let us begin.', 'zh-CN': '我们开始吧。' }, acceptedAnswers: { en: ['Let us begin.'] }, imageAssetId: null, audioAssetId: null,
      chunks: { items: [{ id: 'b-1', text: 'Let us ' }, { id: 'b-2', text: 'begin.' }], correctOrder: ['b-1', 'b-2'], distractors: [] } }
  ];
  return {
    schemaVersion: '2.0', courseId, version: '1.0.0',
    metadata: { title: { en: 'Legacy AI course', 'zh-CN': '旧 AI 对话课程' }, description: { en: '', 'zh-CN': '迁移验收' }, targetCefr: 'A2', estimatedDurationMinutes: 1, learningLocale: 'en', supportLocales: ['zh-CN'] },
    assets: [], roles: [], utterances, sequence: ['line-a', 'line-b'],
    capabilities: { text: true, audio: false, translation: true, chunkSelection: true, roleplay: false },
    capabilityReasons: { audio: [{ code: 'REAL_AUDIO_REQUIRED', message: '无音频' }] },
    authorNotes: { chunklabAuthoring: ['format=chunklab-ai-course', 'formatVersion=1.0', 'contentForm=article'] }
  };
}
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(ROOT, 'server'), env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test', REQUIRE_AUTH: 'true', JWT_SECRET: require('crypto').randomBytes(32).toString('hex'), PHONE_AUTH_ENABLED: 'false' }), stdio: 'ignore' });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get(BASE + '/api/health', function (res) { res.resume(); if (res.statusCode === 200) { clearInterval(timer); resolve(); } });
      req.on('error', function () {}); req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}
function stopServer() { if (server) try { server.kill('SIGKILL'); } catch (error) {} try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (error) {} }

(async function () {
  let browser;
  try {
    await startServer();
    const registration = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'native-course-test', password: 'native-course-test-pass' }) });
    if (!registration.ok) throw new Error('isolated migration owner registration failed: ' + await registration.text());
    const { token } = await registration.json();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await context.addInitScript((authToken) => {
      localStorage.setItem('chunklab_token', authToken);
      localStorage.setItem('chunklab.session.v1', JSON.stringify({ version: 1, base: '', token: authToken, epoch: 'native-course-fixture' }));
    }, token);
    const page = await context.newPage();
    await page.goto(BASE + '/main.html?e2e=ai-course-native-learning', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return !!window.CL && !!window.CourseEnrollment && !!window.CourseCatalog; }, null, { timeout: 15000 });
    const valid = oldCourse(COURSE_ID), blocked = oldCourse(BLOCKED_ID, { chunks: false });
    await page.waitForFunction(() => CL.serverPersistenceReady() && CL.getCloudConfig().writeProtocol === 3);
    await page.evaluate(async function (courses) {
      await CL.preload();
      for (const course of courses) {
        await ServerStore.submitCommitted('course.put', { course }, { requestId: 'native-seed-' + course.courseId, expectedRev: null });
      }
      await ServerStore.submitCommitted('course.progress', { courseId: courses[0].courseId,
        nodeId: 'line-a', passed: true, completed: false, currentNodeId: 'line-b', generation: 0 },
      { requestId: 'native-learning-progress-seed-001' });
      await CourseEnrollment.join('package:' + courses[0].courseId);
    }, [valid, blocked]);

    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID), { waitUntil: 'domcontentloaded' });
    await page.locator('[data-legacy-confirm]').waitFor({ state: 'visible', timeout: 15000 }).catch(async function (error) {
      throw new Error(error.message + ' URL=' + page.url() + ' 内容=' + (await page.locator('body').innerText()).slice(0, 1200));
    });
    const gateText = await page.locator('#playerContent').innerText();
    if (!gateText.includes('转换并开始练习') || !gateText.includes('词数提示')) throw new Error('旧课程入口没有清楚说明适配变化');
    for (const viewport of [{ width: 1200, height: 900 }, { width: 846, height: 932 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(function () { return { viewport: innerWidth, page: document.documentElement.scrollWidth }; });
      if (layout.page > layout.viewport) throw new Error('旧 AI 课程适配提示在 ' + viewport.width + 'px 出现横向溢出：' + JSON.stringify(layout));
    }
    await page.evaluate(function () {
      window.__nativeCourseRequest = ChunkAPI.request;
      window.__nativeImportFailure = true;
      ChunkAPI.request = function (path, options) {
        if (path === '/api/course-library/import' && window.__nativeImportFailure) {
          window.__nativeImportFailure = false;
          return Promise.reject(new Error('simulated independent-course import failure'));
        }
        return window.__nativeCourseRequest.apply(this, arguments);
      };
    });
    await page.locator('[data-legacy-confirm]').click();
    await page.locator('[data-legacy-retry]').waitFor({ state: 'visible', timeout: 10000 });
    if (await page.evaluate(function (id) { return CL.loadMem().decks.some(function (deck) { return deck.id === id; }); }, COURSE_ID)) throw new Error('保存失败时课程正文进入了个人学习数据');
    await page.evaluate(function () { ChunkAPI.request = window.__nativeCourseRequest; });
    await page.locator('[data-legacy-retry]').click();
    await page.waitForURL(/\/main\.html\?personalCourse=/, { timeout: 15000 });
    await page.locator('.course-access-panel button').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.course-access-panel button').click();
    await page.waitForSelector('#stage:not(.hidden)', { timeout: 15000 });
    await page.waitForFunction(function () { return Array.isArray(S.items) && S.items.length === 2 && cur(); }, null, { timeout: 10000 }).catch(async function (error) {
      throw new Error(error.message + ' URL=' + page.url() + ' BODY=' + (await page.locator('body').innerText()).slice(0, 900));
    });
    for (const viewport of [{ width: 1200, height: 900 }, { width: 846, height: 932 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(function () { return { viewport: innerWidth, page: document.documentElement.scrollWidth }; });
      if (layout.page > layout.viewport) throw new Error('原生课程学习页在 ' + viewport.width + 'px 出现横向溢出：' + JSON.stringify(layout));
    }
    const converted = await page.evaluate(async function (id) {
      const params = new URLSearchParams(location.search), courseId = params.get('personalCourse');
      const original = CL.readCourses().find(function (course) { return course.courseId === id; });
      const oldProgress = CL.readProgress()[id];
      const content = await ChunkAPI.request('/api/course-library/' + encodeURIComponent(courseId));
      const batch = await ChunkAPI.request('/api/course-library/' + encodeURIComponent(courseId) + '/batch?cursor=0');
      const snapshot = await ChunkAPI.getData();
      return { courseId, content, recordIdentity: batch.recordIdentity, items: batch.batch.items.map(function (item) { return item.cid; }),
        originalCount: CL.readCourses().filter(function (course) { return course.courseId === id; }).length,
        oldProgress, legacyJoined: CourseEnrollment.isJoined('package:' + id),
        newCourseJoined: CourseEnrollment.isJoined('personal-course:' + courseId),
        defaultMode: content.content.authoring.learning.defaultMode,
        learningHasImportedDeck: snapshot.mem.decks.some(function (deck) { return deck.id === courseId; }),
        noMigrationConflict: !document.querySelector('#syncBadge, #syncResolveMask, [data-sync-conflict]') };
    }, COURSE_ID);
    if (!converted.content.content.authoring.legacySource || converted.content.content.authoring.legacySource.courseId !== COURSE_ID || converted.items.join(',') !== 'line-a,line-b') throw new Error('独立课程迁移未保留旧来源和稳定条目 ID：' + JSON.stringify(converted));
    if (converted.originalCount !== 1 || !converted.oldProgress.passed.includes('line-a') || converted.oldProgress.completed || !converted.legacyJoined || !converted.newCourseJoined) throw new Error('迁移未保留旧课程/学习记录或没有建立新学习引用：' + JSON.stringify(converted));
    if (converted.recordIdentity.deckId !== COURSE_ID || converted.learningHasImportedDeck) throw new Error('迁移后的课程记录身份不兼容，或正文写回个人 deck：' + JSON.stringify(converted));
    if (!converted.noMigrationConflict) throw new Error('课程转换产生了同步冲突 UI');
    if (converted.defaultMode !== 'chunkSelection') throw new Error('转换课程内容没有保留默认练习方式：' + JSON.stringify(converted));

    const sequence = await page.evaluate(function () { return S.items.map(function (item) { return item.cid; }); });
    if (sequence.join(',') !== 'line-a,line-b') throw new Error('旧课程转换后原有教学顺序发生变化：' + sequence.join(','));
    const firstNativeItem = await page.evaluate(function () { return { cid: cur().cid, sentence: cur().sentence, chunks: cur().chunks.slice() }; });
    const footerAcceptance = process.env.PRACTICE_FOOTER_ACCEPTANCE === '1';
    if (footerAcceptance) {
      await page.getByRole('button', { name: '听全句朗读', exact: true }).click();
      await page.evaluate(function () { stopSentencePlayback(); });
      await page.waitForFunction(function () { return S._exposureQueued; }, null, { timeout: 10000 });
    }
    for (let chunkIndex = 0; chunkIndex < firstNativeItem.chunks.length; chunkIndex++) {
      const correct = firstNativeItem.chunks[chunkIndex];
      if (chunkIndex === 0) {
        await page.locator('#stageChoices .choice').evaluateAll(function (nodes, answer) {
          const wrong = nodes.find(function (button) { return button.dataset.v !== answer; });
          if (!wrong) throw new Error('原生选择练习没有可验证的错误选项');
          wrong.click();
        }, correct);
        await page.waitForFunction(function () { return S.wrongAttempts[0] === 1; }, null, { timeout: 7000 });
      }
      await page.locator('#stageChoices .choice').evaluateAll(function (nodes, answer) {
        const choice = nodes.find(function (button) { return button.dataset.v === answer; });
        if (!choice) throw new Error('原生选择练习缺少正确意群：' + answer);
        choice.click();
      }, correct);
      await page.waitForFunction(function (index) { return S.status[index] === 'ok'; }, chunkIndex, { timeout: 7000 });
      if (footerAcceptance && chunkIndex === 0) {
        const attempt = await page.evaluate(function () { return S.attemptId; });
        await page.getByRole('button', { name: '重置选择', exact: true }).click();
        const reset = await page.evaluate(function () { return { attempt:S.attemptId, errors:S.wrongAttempts[0], pending:S.status.every(value=>value==='pending'), assisted:S.hinted }; });
        if (reset.attempt !== attempt || reset.errors !== 1 || !reset.pending || !reset.assisted) throw new Error('重置丢失本题身份或错误/辅助证据：'+JSON.stringify(reset));
        await page.locator('#stageChoices .choice').evaluateAll(function (nodes, answer) { nodes.find(button=>button.dataset.v===answer).click(); }, correct);
        await page.waitForFunction(function () { return S.status[0] === 'ok'; });
      }
    }
    await page.waitForFunction(function () { return !$('btnNext').classList.contains('hidden'); }, null, { timeout: 7000 });
    await waitForAsync(page, async id => {
      const cache = await ServerCache.read();
      const row = (cache.snapshot.mem.stats.bySentence || {})[id + '#line-a'];
      return row && row.times === 1;
    }, COURSE_ID, { timeout: 15000 });
    const selectionStats = await page.evaluate(async function (id) {
      const cache = await ServerCache.read();
      const row = (cache.snapshot.mem.stats.bySentence || {})[id + '#line-a'];
      return { row, confirmedRows: cache.snapshot.mem.stats.bySentence,
        appliedSeq: cache.appliedSeq, confirmedDeleted: cache.snapshot.deleted,
        serverRows: (await ChunkAPI.getData()).mem.stats.bySentence,
        globalMode: CL.loadMem().settings.mode, answerLeaked: document.getElementById('zh').textContent.includes('We are ready.'), rightChunks: S.chunkRight, attempts: S.chunkTotal };
    }, COURSE_ID);
    if (!selectionStats.row || selectionStats.row.times !== 1 || selectionStats.row.wrongTimes !== 1 || !(selectionStats.row.dueAt > Date.now()) || selectionStats.globalMode !== 'choose' || selectionStats.answerLeaked || selectionStats.rightChunks !== (footerAcceptance ? 3 : 2) || selectionStats.attempts !== (footerAcceptance ? 4 : 3)) throw new Error('原生选择结果、错题/复习计划、全局模式或答题前答案隔离不正确：' + JSON.stringify(selectionStats));
    if (footerAcceptance && !await page.locator('#btnResetSelection').isDisabled()) throw new Error('完成后仍允许重置，存在重复计分风险');

    await page.setViewportSize({ width: 846, height: 932 });
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID), { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/main\.html\?personalCourse=/, { timeout: 15000 }).catch(async function (error) {
      throw new Error(error.message + ' URL=' + page.url() + ' BODY=' + (await page.locator('body').innerText()).slice(0, 900));
    });
    await page.locator('.course-access-panel button').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.course-access-panel button').click();
    await page.waitForSelector('#stage:not(.hidden)', { timeout: 15000 }).catch(async function (error) {
      throw new Error(error.message + ' URL=' + page.url() + ' BODY=' + (await page.locator('body').innerText()).slice(0, 900));
    });
    const oldRouteItems = await page.evaluate(function () { return S.items.map(function (item) { return item.cid; }); });
    if (oldRouteItems[0] !== 'line-b') throw new Error('旧课程链接没有恢复到尚未练习的题目：' + oldRouteItems.join(','));
    const oldRouteLayout = await page.evaluate(function () { return { viewport: innerWidth, page: document.documentElement.scrollWidth }; });
    if (oldRouteLayout.page > oldRouteLayout.viewport) throw new Error('846px 旧地址重定向后的学习页出现横向溢出');

    await page.goto(BASE + '/decks.html?courseView=joined', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      return !!window.CourseLearningLaunch && !!window.CL &&
        CL.serverPersistenceReady() && !!serverCatalogView;
    }, null, { timeout: 15000 });
    const membershipRemoval = await page.evaluate(async function (courseId) {
      await CourseEnrollment.leave('personal-course:' + courseId);
      const stillReadable = await ChunkAPI.request('/api/course-library/' + encodeURIComponent(courseId));
      const accountData = await ChunkAPI.getData();
      return { courseId, joined: CourseEnrollment.isJoined('personal-course:' + courseId), stillReadable: stillReadable.courseId === courseId,
        inLearningRows: Object.keys(accountData.mem.courseProgress || {}).some(function (key) {
          const row = accountData.mem.courseProgress[key]; return row && row.kind === 'course-enrollment' && row.courseId === 'personal-course:' + courseId && row.joined;
        }) };
    }, converted.courseId);
    if (membershipRemoval.joined || !membershipRemoval.stillReadable || membershipRemoval.inLearningRows) throw new Error('退出只应撤销账号课程引用，不应删除课程正文：' + JSON.stringify(membershipRemoval));

    await page.goto(BASE + '/course-create.html?convert=' + encodeURIComponent(BLOCKED_ID), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.issue-panel.has-error', { timeout: 15000 });
    const blockedText = await page.locator('body').innerText();
    if (!blockedText.includes('没有可复用的完整意群') || await page.locator('[data-action="save"], [data-action="save-and-join"]').count()) throw new Error('缺少意群的旧课程没有被明确阻断');
    if (await page.evaluate(function (id) { return CL.loadMem().decks.some(function (deck) { return deck.id === id; }); }, BLOCKED_ID)) throw new Error('不兼容旧课程被写成了原生课程');

    const isolatedContext = await browser.newContext();
    const isolatedPage = await isolatedContext.newPage();
    await isolatedPage.route('**/api/**', function (route) { route.abort('failed'); });
    await isolatedPage.goto(BASE + '/course-create.html?convert=' + encodeURIComponent(COURSE_ID), { waitUntil: 'domcontentloaded' });
    await isolatedPage.waitForFunction(function () { return document.body.innerText.includes('找不到要转换的旧 AI 课程') || !!document.querySelector('#course-create-root .global-error'); }, null, { timeout: 6000 }).catch(async function () { throw new Error('隔离账号访问旧课程时没有得到明确隔离结果：' + isolatedPage.url() + ' ' + (await isolatedPage.locator('body').innerText()).slice(0, 500)); });
    if (!(await isolatedPage.locator('#course-create-root .global-error').innerText()).includes('找不到要转换的旧 AI 课程')) throw new Error('另一账号可以读取或转换当前账号的旧课程');
    if (await isolatedPage.evaluate(function (id) { return CL.loadMem().decks.some(function (deck) { return deck.id === id; }); }, COURSE_ID)) throw new Error('旧课程跨账号泄漏到另一账号');
    await isolatedContext.close();
    console.log('[ai-course-native-learning] 旧课入口确认、独立库重试、加入/进度保留、退出仅撤销个人引用、阻断反馈及移动端布局通过');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
