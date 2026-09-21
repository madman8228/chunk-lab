'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9950, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-course-package-'));
const BASE = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.COURSE_ZIP || path.join(ROOT, 'ref', '0.1.0-1789739161756.zip');
const COURSE_ID = 'course_fde7e455';
const EXPECT_IMPORT_ERROR = process.env.EXPECT_IMPORT_ERROR === '1';
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(ROOT, 'server'), env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }), stdio: 'ignore' });
    var tries = 0;
    var timer = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get(BASE + '/api/health', function (res) { res.resume(); if (res.statusCode === 200) { clearInterval(timer); resolve(); } });
      req.on('error', function () {}); req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}
function stopServer() { if (server) try { server.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {} }

(async function () {
  if (!fs.existsSync(ZIP)) throw new Error('缺少最新课程包：' + ZIP);
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    var context = await browser.newContext();
    var page = await context.newPage();
    await page.goto(BASE + '/decks.html?e2e=course-package', { waitUntil: 'networkidle' });
    var logicalId = await page.evaluate(function(){
      return LogicalCourseStore.create({ title: '导入归属回归目录', coverImage: 'data:image/png;base64,e2e-import-cover' }).id;
    });
    await page.locator('#tabCourses').click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#ciLogicalCourse').selectOption(logicalId);
    await page.locator('#courseFileInput').setInputFiles(ZIP);
    await page.locator('#btnCourseImport').click();
    await page.waitForFunction(function () { return document.body.innerText.indexOf('导入完成') >= 0 || document.querySelector('#courseImpMsg.err'); }, { timeout: 45000 });
    var importError = await page.locator('#courseImpMsg.err').count() ? await page.locator('#courseImpMsg').innerText() : '';
    if (EXPECT_IMPORT_ERROR) {
      if (!importError) throw new Error('预期课程包被拒绝，但导入成功了');
      console.log('course-package-import.test.js unsupported package rejected');
      return;
    }
    if (importError) throw new Error(importError);
    var importedAssociation = await page.evaluate(async function(id){
      await CL.preload();
      var courses = CL.readCourses();
      var imported = courses.find(function(item){ return item.courseId === 'course_fde7e455'; });
      return imported && imported.logicalCourseId === id;
    }, logicalId);
    if (!importedAssociation) throw new Error('导入课程未保存所选逻辑课程归属');
    await page.locator('#tabCourses').click();
    await page.waitForFunction(function(){ return document.querySelectorAll('#deckList .course-card').length > 0; });
    var logicalCard = page.locator('#deckList .course-card').filter({ hasText: '导入归属回归目录' });
    if (await logicalCard.count() !== 1 || (await logicalCard.innerText()).indexOf('1 个课节') === -1) throw new Error('导入课程未显示在所选目录内');
    var coverLabelStyle = await logicalCard.locator('.deck-cover-label').evaluate(function(el){
      var style = getComputedStyle(el);
      return { userSelect: style.userSelect, caretColor: style.caretColor, contentEditable: el.contentEditable };
    });
    if (coverLabelStyle.userSelect !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/i.test(coverLabelStyle.caretColor) || coverLabelStyle.contentEditable !== 'false') throw new Error('图文课程标题仍可能显示文本光标：' + JSON.stringify(coverLabelStyle) + ' flags=' + [coverLabelStyle.userSelect !== 'none', !/rgba\(0, 0, 0, 0\)|transparent/i.test(coverLabelStyle.caretColor), coverLabelStyle.contentEditable !== 'false'].join(','));
    /* 历史数据修复回归：未归类课节可以从平级卡片移入已有目录，无需重新上传 ZIP。 */
    var storyTitle = await page.evaluate(function(){
      var item = CL.readCourses().find(function(course){ return course.courseId === 'course_fde7e455'; });
      return item && item.metadata && item.metadata.title && (item.metadata.title['zh-CN'] || item.metadata.title.en);
    });
    await page.evaluate(async function(){
      var courses = CL.readCourses();
      var item = courses.find(function(course){ return course.courseId === 'course_fde7e455'; });
      delete item.logicalCourseId;
      await CL.writeCourses(courses);
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#tabCourses').click();
    await page.waitForFunction(function(){ return document.querySelectorAll('#deckList .course-card').length > 0; });
    var orphanCard = page.locator('#deckList .course-card').filter({ hasText: storyTitle });
    await orphanCard.locator('.course-manage-trigger').click();
    await orphanCard.getByRole('menuitem', { name: '移入目录' }).click();
    await page.locator('#moveStorySelect').selectOption(logicalId);
    await page.locator('#moveStoryConfirm').click();
    await page.waitForFunction(function(){ return !document.querySelector('#moveStoryMask') || document.querySelector('#moveStoryMask').hidden; });
    var repairedAssociation = await page.evaluate(function(id){
      var item = CL.readCourses().find(function(course){ return course.courseId === 'course_fde7e455'; });
      return item && item.logicalCourseId === id;
    }, logicalId);
    if (!repairedAssociation) throw new Error('历史平级课节未能移入所选目录');
    logicalCard = page.locator('#deckList .course-card').filter({ hasText: '导入归属回归目录' });
    if (await logicalCard.count() !== 1 || (await logicalCard.innerText()).indexOf('1 个课节') === -1) throw new Error('历史课节移入后目录未刷新');
    /* 用户真实路径回归：从“我的课程”卡片进入目录，再点击导入后的课节。 */
    await logicalCard.click();
    await page.waitForTimeout(300);
    if (!/decks\.html\?.*course=logical-course%3A/.test(page.url())) throw new Error('点击课程卡片后未进入课程目录：' + page.url() + '\n' + (await page.locator('#deckList').innerText()));
    var importedLesson = page.locator('#deckList .catalog-lesson').filter({ hasText: storyTitle });
    if (await importedLesson.count() !== 1) throw new Error('课程目录中找不到已导入课节');
    await importedLesson.click();
    await page.waitForURL(new RegExp('courses\\.html\\?id=' + COURSE_ID));
    await page.waitForSelector('#courseTyping');
    if (await page.locator('#coursePlayer.hidden').count()) throw new Error('点击导入课程后播放器仍未打开');
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID) + '&e2e=course-package', { waitUntil: 'networkidle' });
    await page.waitForSelector('#courseTyping');
    if (await page.locator('.chat-bubble.learner .bubble-en').count()) throw new Error('新版 sourceText 被重复渲染为学习者台词');
    if (await page.locator('.chat-bubble.npc .bubble-en').count()) throw new Error('1.1 npcMessage 在答题前泄露了学习目标');
    if (await page.locator('[data-action="play-audio"]').count() !== 1) throw new Error('音频播放按钮未接通');
    await page.locator('[data-action="play-audio"]').click();
    await page.waitForSelector('[data-action="play-audio"][data-audio-state="ready"]', { timeout: 10000 });
    var input = page.locator('#courseTyping');
    await input.fill('wrong');
    await page.locator('[data-action="submit-typing"]').click();
    await page.waitForSelector('.node-feedback.bad');
    if (await page.locator('#courseTyping').count() !== 1) throw new Error('答错后跳过了当前节点');
    await input.fill('EXCUSE  ME!');
    await page.locator('[data-action="submit-typing"]').click();
    await page.waitForSelector('#courseTyping');
    for (var attempt = 0; attempt < 6; attempt++) {
      var submit = page.locator('[data-action="submit-typing"]');
      var answers = JSON.parse(await submit.getAttribute('data-answers'));
      await page.locator('#courseTyping').fill(answers[0]);
      await submit.click();
      await page.waitForTimeout(150);
    }
    await page.waitForSelector('.end-mark', { timeout: 10000 });
    if (await page.locator('#courseTyping').count()) throw new Error('1.1 七句完成后仍停留在输入节点');
    if ((await page.locator('#playerCount').innerText()) !== '7') throw new Error('1.1 完成后进度计数不是 7');
    console.log('course-package-import.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
