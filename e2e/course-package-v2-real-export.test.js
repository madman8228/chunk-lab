'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10150, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-course-package-v2-real-'));
const BASE = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.COURSE_ZIP_V2_REAL || path.resolve(ROOT, '..', 'courser-creator', '.data', 'projects', '001-002－Excuse Me', 'exports', '0.1.0-1789772472558.zip');
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
  if (!fs.existsSync(ZIP)) throw new Error('缺少真实 2.0 导出包：' + ZIP);
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    var page = await browser.newPage();
    await page.goto(BASE + '/decks.html?e2e=course-package-v2-real', { waitUntil: 'networkidle' });
    var logicalId = await page.evaluate(function () { return LogicalCourseStore.create({ title: '真实 2.0 回归目录', coverImage: 'data:image/png;base64,e2e-real-cover' }).id; });
    await page.locator('#tabCourses').click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#ciLogicalCourse').selectOption(logicalId);
    await page.locator('#courseFileInput').setInputFiles(ZIP);
    await page.locator('#btnCourseImport').click();
    await page.waitForFunction(function () { return document.body.innerText.indexOf('导入完成') >= 0 || document.querySelector('#courseImpMsg.err'); }, { timeout: 45000 });
    var error = await page.locator('#courseImpMsg.err').count() ? await page.locator('#courseImpMsg').innerText() : '';
    if (error) throw new Error(error);
    var course = await page.evaluate(async function () { await CL.preload(); return CL.readCourses().find(function (item) { return item.schemaVersion === '2.0'; }); });
    if (!course || !course.courseId || course.utterances.length !== 7) throw new Error('真实 2.0 导出包未正确保存');
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(course.courseId) + '&e2e=course-package-v2-real', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-action="select-v2-mode"]');
    if (await page.locator('[data-action="select-v2-mode"]').count() !== 5) throw new Error('真实 2.0 包未显示五种模式入口');
    if (await page.locator('[data-mode="chunkSelection"]:disabled').count() !== 1 || await page.locator('[data-mode="roleplay"]:disabled').count() !== 1) throw new Error('真实包未按 capabilities 禁用不具备的模式');
    await page.locator('[data-action="select-v2-mode"][data-mode="typing"]').click();
    for (var i = 0; i < course.sequence.length; i++) {
      var answer = course.utterances.find(function (item) { return item.id === course.sequence[i]; }).acceptedAnswers.en[0];
      await page.locator('#v2Answer').fill(answer);
      await page.locator('[data-action="submit-v2"]').click();
      await page.waitForSelector('.node-feedback.ok');
      await page.locator('[data-action="advance-v2"]').click();
      if (i < course.sequence.length - 1) await page.waitForSelector('#v2Answer');
    }
    await page.waitForSelector('.end-mark');
    if (await page.locator('#playerCount').innerText() !== String(course.sequence.length)) throw new Error('真实 2.0 包完成后进度计数不正确');
    console.log('course-package-v2-real-export.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
