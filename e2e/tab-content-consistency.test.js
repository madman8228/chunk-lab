'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10250, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-tab-content-'));
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
      const req = http.get(BASE + '/api/health', function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    await page.goto(BASE + '/decks.html?e2e=tab-content-consistency', { waitUntil: 'networkidle' });
    await page.evaluate(function () {
      LogicalCourseStore.create({ title: '页签一致性回归目录', coverImage: 'data:image/png;base64,e2e-tab-cover' });
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#tabCourses').click();
    await page.locator('.course-card').filter({ hasText: '页签一致性回归目录' }).click();
    await page.waitForURL(/decks\.html\?.*course=logical-course%3A/);
    await page.locator('#decksBack').click();
    await page.waitForFunction(function () { return new URL(location.href).searchParams.get('course') === null; });
    if (!await page.locator('#tabCourses').evaluate(function (el) { return el.classList.contains('on'); })) throw new Error('返回后图文课程页签未保持选中');
    if ((await page.locator('#deckList .deck-section-title').innerText()) !== '图文课程（1 门）') throw new Error('返回后内容未恢复为图文课程');
    if (await page.locator('#deckList .course-card').filter({ hasText: '口语3000句' }).count()) throw new Error('图文课程页签混入句子课程');
    console.log('tab-content-consistency.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
