/* exit-clears-choices.test.js · 离开课程后不得残留候选 chunks */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9950, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-exit-choices-'));
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
    const iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 100);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function seedExitCourse() {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  const item = {
    sentence: 'Exit cleanup should remove choices.',
    translation: '退出课程后应清理候选项。',
    chunks: ['Exit cleanup', 'should remove choices.'],
    hints: ['', ''],
    alts: [[], []],
    cid: 'exit-cleanup-test'
  };
  const deck = { id: 'exit-cleanup-d1', name: '退出清理测试', items: [item] };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [deck],
    best: {},
    mastered: {},
    deletedItems: {},
    reinforceBook: [],
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: false }
  }));
  sessionStorage.setItem('_startDeck', JSON.stringify(deck));
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', function (error) { errors.push(error.message); });
    await page.route('**/api/**', function (route) { route.abort('failed'); });
    await page.addInitScript(seedExitCourse);
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    const before = await page.locator('#stageChoices .choice').count();
    if (before < 1) throw new Error('测试前没有生成候选 chunks');

    await page.locator('#btnExitPractice').click();
    await page.waitForFunction(function () {
      var home = document.getElementById('pageHome');
      var practice = document.getElementById('pagePractice');
      return home && !home.classList.contains('hidden') && practice && practice.classList.contains('hidden');
    }, null, { timeout: 10000 });
    const after = await page.evaluate(function () {
      var home = document.getElementById('pageHome');
      var practice = document.getElementById('pagePractice');
      var choices = document.querySelectorAll('#stageChoices .choice');
      var stage = document.getElementById('stageChoices');
      return {
        homeVisible: !!(home && !home.classList.contains('hidden')),
        practiceHidden: !!(practice && practice.classList.contains('hidden')),
        choiceCount: choices.length,
        stageDisplay: stage ? getComputedStyle(stage).display : 'missing'
      };
    });
    if (!after.homeVisible || !after.practiceHidden || after.choiceCount !== 0 || after.stageDisplay !== 'none') {
      throw new Error('退出后候选 chunks 残留：' + JSON.stringify({ before: before, after: after }));
    }
    if (errors.length) throw new Error('pageerror: ' + errors.join('|'));
    console.log('[exit-clears-choices] 退出课程后回到首页且不残留候选 chunks');
  } catch (error) {
    console.error('[exit-clears-choices] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
