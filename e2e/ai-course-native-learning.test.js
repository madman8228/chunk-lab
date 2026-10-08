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
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(ROOT, 'server'), env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }), stdio: 'ignore' });
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
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
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
    await page.evaluate(function () { window.__nativeSubmit = ServerStore.submitCommitted; ServerStore.submitCommitted = async function () { throw new Error('simulated pre-commit failure'); }; });
    await page.locator('[data-legacy-confirm]').click();
    await page.locator('[data-legacy-retry]').waitFor({ state: 'visible', timeout: 10000 });
    if (await page.evaluate(function (id) { return CL.loadMem().decks.some(function (deck) { return deck.id === id; }); }, COURSE_ID)) throw new Error('保存失败时产生了原生课程');
    await page.evaluate(function () { ServerStore.submitCommitted = window.__nativeSubmit; });
    await page.locator('[data-legacy-retry]').click();
    await page.waitForURL(new RegExp('/main\\.html\\?course=package%3A' + encodeURIComponent(COURSE_ID)), { timeout: 15000 });
    await page.waitForSelector('#stage:not(.hidden)');
    for (const viewport of [{ width: 1200, height: 900 }, { width: 846, height: 932 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(function () { return { viewport: innerWidth, page: document.documentElement.scrollWidth }; });
      if (layout.page > layout.viewport) throw new Error('原生课程学习页在 ' + viewport.width + 'px 出现横向溢出：' + JSON.stringify(layout));
    }
    const converted = await page.evaluate(function (id) {
      const deck = CL.findDeck(CL.loadMem(), id), packages = CL.readCourses(), progress = CL.readProgress()[id];
      const catalog = CourseCatalog.buildCatalog({ manifest: ContentRepo.getManifest(), userDecks: CL.allDecks(CL.loadMem()), storyPackages: packages });
      const matches = catalog.courses.filter(function (course) { return course.id === 'package:' + id; });
      return { deck: deck && { id: deck.id, catalogCourseId: deck.authoring.catalogCourseId, legacySource: deck.authoring.legacySource, cids: deck.items.map(function (item) { return item.cid; }) },
        packages: packages.filter(function (item) { return item.courseId === id; }).length, progress,
        joined: CourseEnrollment.isJoined('package:' + id), nativeMode: S.courseLearning && S.courseLearning.mode,
        catalogEntries: matches.length, catalogType: matches[0] && matches[0].contentType };
    }, COURSE_ID);
    if (!converted.deck || converted.deck.cids.join(',') !== 'line-a,line-b' || converted.deck.legacySource.courseId !== COURSE_ID) throw new Error('转换未保留旧课程身份和行 ID');
    if (converted.packages !== 1 || !converted.progress.passed.includes('line-a') || converted.progress.completed || !converted.joined) throw new Error('转换丢失原包、旧学习记录或原加入关系：' + JSON.stringify(converted));
    if (converted.catalogEntries !== 1 || converted.catalogType !== 'sentence') throw new Error('转换后目录没有合并为唯一的原生句子课程：' + JSON.stringify(converted));
    if (converted.nativeMode !== 'chunkSelection') throw new Error('转换课程默认练习方式与旧转换合同不符：' + JSON.stringify(converted));

    const sequence = await page.evaluate(function () { return S.items.map(function (item) { return item.cid; }); });
    if (sequence.join(',') !== 'line-a,line-b') throw new Error('旧课程转换后原有教学顺序发生变化：' + sequence.join(','));
    const firstNativeItem = await page.evaluate(function () { return { cid: cur().cid, sentence: cur().sentence, chunks: cur().chunks.slice() }; });
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
    if (!selectionStats.row || selectionStats.row.times !== 1 || selectionStats.row.wrongTimes !== 1 || !(selectionStats.row.dueAt > Date.now()) || selectionStats.globalMode !== 'choose' || selectionStats.answerLeaked || selectionStats.rightChunks !== 2 || selectionStats.attempts !== 3) throw new Error('原生选择结果、错题/复习计划、全局模式或答题前答案隔离不正确：' + JSON.stringify(selectionStats));

    await page.setViewportSize({ width: 846, height: 932 });
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID), { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/main\.html\?course=package%3A/, { timeout: 15000 });
    await page.waitForSelector('#stage:not(.hidden)');
    if (await page.evaluate(function (id) { return S.deck && S.deck.id === id; }, COURSE_ID) !== true) throw new Error('旧课程链接没有解析到同一原生课程');
    const oldRouteLayout = await page.evaluate(function () { return { viewport: innerWidth, page: document.documentElement.scrollWidth }; });
    if (oldRouteLayout.page > oldRouteLayout.viewport) throw new Error('846px 旧地址重定向后的学习页出现横向溢出');

    await page.goto(BASE + '/decks.html?courseView=joined', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      return !!window.CourseLearningLaunch && !!window.CL &&
        CL.serverPersistenceReady() && !!serverCatalogView;
    }, null, { timeout: 15000 });
    const deleteState = await page.evaluate(async function (id) {
      const before = Object.keys(CL.loadMem().deletedItems || {});
      // Only the synthetic course in this test's isolated server is removed.
      // Exercise the production narrow operation, not the retired snapshot writer.
      await deleteDeckContent(id);
      const current = CL.loadMem();
      const confirmed = (await ServerCache.read()).snapshot.mem;
      return { marker: CourseLearningLaunch.isRetired(id), before, keys: Object.keys(current.deletedItems || {}), rawDeckRestored: !!CL.findDeck(current, id), visibleDeckRestored: CL.allDecks(current).some(function (deck) { return deck.id === id; }), confirmedMarker: !!confirmed.deletedItems['ai-course-retired:' + id], confirmedDeck: confirmed.decks.some(function (deck) { return deck.id === id; }) };
    }, COURSE_ID);
    if (!deleteState.confirmedMarker || deleteState.confirmedDeck) throw new Error('服务器确认的删除结果不正确：' + JSON.stringify(deleteState));
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID), { waitUntil: 'domcontentloaded' });
    await page.locator('[data-legacy-confirm]').waitFor({ state: 'visible', timeout: 15000 });
    const retiredGateText = await page.locator('#playerContent').innerText();
    if (!retiredGateText.includes('之前删除过转换出的课程')) throw new Error('删除后的旧课程没有明确询问是否重新适配：' + JSON.stringify({ retired: await page.evaluate(function (id) { return CourseLearningLaunch.isRetired(id); }, COURSE_ID), text: retiredGateText }));
    const retiredAfterOpen = await page.evaluate(async function (id) {
      const confirmed = (await ServerCache.read()).snapshot.mem;
      return { marker: CourseLearningLaunch.isRetired(id, confirmed), deck: !!CL.findDeck(confirmed, id) };
    }, COURSE_ID);
    if (!retiredAfterOpen.marker || !new URL(page.url()).pathname.endsWith('/courses.html')) throw new Error('删除标记没有阻止旧链接自动跳入原生课程：' + JSON.stringify({ deleteState, retiredAfterOpen }));
    await page.locator('[data-legacy-confirm]').click();
    await page.waitForURL(/\/main\.html\?course=package%3A/, { timeout: 15000 });
    if (await page.evaluate(async function (id) { return !!(await ServerCache.read()).snapshot.mem.deletedItems['ai-course-retired:' + id]; }, COURSE_ID)) throw new Error('用户明确确认重新使用后，删除标记没有清除');

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
    console.log('[ai-course-native-learning] 旧课入口确认、保存失败重试、加入/进度保留、删除标记拦截自动跳转、阻断反馈及移动端布局通过');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
