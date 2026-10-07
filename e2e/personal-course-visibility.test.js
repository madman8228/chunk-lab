'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9890, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-personal-courses-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      const request = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (response) {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      request.on('error', function () {});
      request.setTimeout(600, function () { request.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('server 启动超时')); }
    }, 100);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (error) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (error) {}
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    await page.goto(BASE + '/decks.html?courseView=joined&courseType=courses', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    await page.waitForFunction(() => CL.serverPersistenceReady() && CL.getCloudConfig().writeProtocol === 3);
    await page.evaluate(async function () {
      await CL.preload();
      await ServerStore.submitCommitted('deck.put', { deck: {
        id: 'private-sentence-fixture', name: '个人导入句子课回归测试',
        items: [{ sentence: 'A personal sentence.', chunks: ['A personal', 'sentence.'] }]
      } }, { requestId: 'personal-visibility-deck-001', expectedRev: null });
      await ServerStore.submitCommitted('course.put', { course: {
        schemaVersion: '1.1', courseId: 'private-story-fixture', version: '1.0.0',
        metadata: { title: { 'zh-CN': '个人导入图文课回归测试' } },
        story: { startNodeId: 'n1', nodes: [{ id: 'n1', npcMessage: 'Hello', sourceText: 'Hello' }] }
      } }, { requestId: 'personal-visibility-story-001', expectedRev: null });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    await page.waitForFunction(() => serverCatalogView && serverCatalogView.courses.some(course => course.courseId === 'private-story-fixture'));
    const persisted = await page.evaluate(async function () {
      const serverData = await ChunkAPI.getData();
      const confirmed = await ServerCache.read();
      const packages = serverCatalogView.courses;
      const catalog = currentCatalog();
      return {
        stored: packages.some(function (course) { return course.courseId === 'private-story-fixture'; }),
        catalogued: !!catalog.byCourseId['package:private-story-fixture'],
        origin: catalog.byCourseId['package:private-story-fixture'] && catalog.byCourseId['package:private-story-fixture'].origin,
        serverCourseIds: (serverData.courses || []).map(course => course.courseId),
        cacheCourseIds: ((confirmed && confirmed.snapshot && confirmed.snapshot.courses) || []).map(course => course.courseId),
        owner: AccountStorage.owner
      };
    });
    if (!persisted.stored || !persisted.catalogued || persisted.origin !== 'user') {
      throw new Error('导入包未持久化或未进入用户课程目录：' + JSON.stringify(persisted));
    }
    await page.goto(BASE + '/decks.html?courseView=discover&courseType=all', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    if (await page.locator('#deckList').getByText('个人导入句子课回归测试').count() ||
        await page.locator('#deckList .course-card').filter({ hasText: '个人导入图文课回归测试' }).count()) {
      throw new Error('个人导入的句子课或图文课不应出现在发现课程');
    }
    await page.goto(BASE + '/decks.html?courseView=joined&courseType=decks', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    if (!await page.locator('#deckList .deck-item').filter({ hasText: '个人导入句子课回归测试' }).count()) {
      throw new Error('个人导入的句子课未出现在“我的课程”');
    }
    if (await page.evaluate(function () { return CourseEnrollment.isJoined('user-deck:private-sentence-fixture'); })) {
      throw new Error('个人导入句子课不得被自动标记为加入学习');
    }
    await page.goto(BASE + '/decks.html?courseView=joined&courseType=courses', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    if (!await page.locator('#tabCourses').isVisible()) {
      throw new Error('课程包已持久化并进入个人目录，但“我的课程”隐藏了图文课程类型');
    }
    const personalStory = page.locator('#deckList .course-card').filter({ hasText: '个人导入图文课回归测试' });
    await personalStory.waitFor({ state: 'visible', timeout: 5000 });
    if (await page.evaluate(function () { return CourseEnrollment.isJoined('package:private-story-fixture'); })) {
      throw new Error('个人导入课程不得被自动标记为加入学习');
    }
    await personalStory.locator('.course-manage-trigger').click();
    if (await personalStory.locator('.course-manage-item').filter({ hasText: '加入学习' }).count() !== 1) {
      throw new Error('个人课程仍应保留独立的“加入学习”操作');
    }
    await personalStory.locator('.course-manage-item').filter({ hasText: '加入学习' }).click();
    await page.waitForFunction(function () { return CourseEnrollment.isJoined('package:private-story-fixture'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    if (!await page.locator('#deckList .course-card').filter({ hasText: '个人导入图文课回归测试' }).count()) {
      throw new Error('加入学习后，个人图文课程不应从“我的课程”消失');
    }
    const joinedStory = page.locator('#deckList .course-card').filter({ hasText: '个人导入图文课回归测试' });
    await joinedStory.locator('.course-manage-trigger').click();
    await joinedStory.locator('.course-manage-item').filter({ hasText: '移出学习' }).click();
    await page.waitForFunction(function () { return !CourseEnrollment.isJoined('package:private-story-fixture'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.decksReady === true && CL.serverPersistenceReady(); });
    if (!await page.locator('#deckList .course-card').filter({ hasText: '个人导入图文课回归测试' }).count()) {
      throw new Error('移出学习后，个人图文课程仍应保留在“我的课程”');
    }
    const serverPreserved = await page.evaluate(async () => {
      const data = await ChunkAPI.getData();
      return { deck: data.mem.decks.some(deck => deck.id === 'private-sentence-fixture'),
        course: data.courses.some(course => course.courseId === 'private-story-fixture') };
    });
    if (!serverPreserved.deck || !serverPreserved.course) throw new Error('移出学习不得删除服务器课程内容');
    console.log('[personal-course-visibility] protocol 3 confirmed imports stay in My Courses and on server after enrollment removal');
  } catch (error) {
    console.error('[personal-course-visibility] failed:', error && error.stack || error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (error) {} }
    stopServer();
  }
})();
