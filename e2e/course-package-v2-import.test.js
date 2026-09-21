'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
/* Chrome blocks 10080 as an unsafe port; keep the suite in an equivalent free range. */
const PORT = require('./lib/free-port').freePort(10150, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-course-package-v2-'));
const BASE = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.COURSE_ZIP_V2 || path.resolve(ROOT, '..', 'courser-creator', 'tests', 'fixtures', 'course-v2-complete.zip');
const COURSE_ID = 'course_d50da551';
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
  if (!fs.existsSync(ZIP)) throw new Error('缺少 2.0 课程包：' + ZIP);
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    var page = await browser.newPage();
    await page.goto(BASE + '/decks.html?e2e=course-package-v2', { waitUntil: 'networkidle' });
    var logicalId = await page.evaluate(function () { return LogicalCourseStore.create({ title: '2.0 回归目录', coverImage: 'data:image/png;base64,e2e-v2-cover' }).id; });
    await page.locator('#tabCourses').click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#ciLogicalCourse').selectOption(logicalId);
    await page.locator('#courseFileInput').setInputFiles(ZIP);
    await page.locator('#btnCourseImport').click();
    await page.waitForFunction(function () { return document.body.innerText.indexOf('导入完成') >= 0 || document.querySelector('#courseImpMsg.err'); }, { timeout: 45000 });
    var error = await page.locator('#courseImpMsg.err').count() ? await page.locator('#courseImpMsg').innerText() : '';
    if (error) throw new Error(error);
    var imported = await page.evaluate(async function () {
      await CL.preload();
      var item = CL.readCourses().find(function (course) { return course.courseId === 'course_d50da551'; });
      return item && item.schemaVersion === '2.0' && item.utterances.length === 2 && item.utterances[0].chunks.items.length === 2;
    });
    if (!imported) throw new Error('2.0 课程未按原始结构保存');
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID) + '&e2e=course-package-v2', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-action="select-v2-mode"]');
    if (await page.locator('[data-action="select-v2-mode"]').count() !== 5) throw new Error('2.0 未显示完整的五种练习方式');
    if (await page.locator('[data-action="select-v2-mode"]:disabled').count() !== 0) throw new Error('完整能力课程错误禁用了练习方式');
    await page.locator('[data-action="select-v2-mode"][data-mode="chunkSelection"]').click();
    await page.locator('[data-chunk-id="line-a:chunk:1"]').click();
    await page.locator('[data-chunk-id="line-a:chunk:2"]').click();
    await page.locator('[data-action="submit-v2"]').click();
    await page.waitForSelector('.node-feedback.ok');
    await page.locator('[data-action="advance-v2"]').click();
    await page.locator('[data-action="select-v2-mode"][data-mode="typing"]').click();
    await page.locator('#v2Answer').fill('Yes, it is.');
    await page.locator('[data-action="submit-v2"]').click();
    await page.waitForSelector('.node-feedback.ok');
    await page.locator('[data-action="advance-v2"]').click();
    await page.waitForSelector('.end-mark');
    if (await page.locator('#playerCount').innerText() !== '2') throw new Error('2.0 完成后进度计数不是 2');
    console.log('course-package-v2-import.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
