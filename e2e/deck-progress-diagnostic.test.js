/* deck-progress-diagnostic.test.js · 课程覆盖数量的最小真实流程回归 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9870, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-progress-diagnostic-'));
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    var tries = 0;
    var iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      /* 就绪窗口 300×100ms=30s。原为 40×100ms=4s，小于宿主普通 node 冷启动实测 5.4s ⇒ 必然假红。
         health 一旦 200 立即 resolve，放大窗口在成功路径上不增加任何耗时。 */
      if (++tries > 300) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 100);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function seed() {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now(), items = [], by = {};
  for (var i = 0; i < 5; i++) {
    var sentence = 'Progress diagnostic sentence ' + i + '.';
    var cid = ('0000000' + (i + 1)).slice(-8);
    items.push({ sentence: sentence, translation: '进度诊断句子 ' + i + '。', chunks: ['Answer'], hints: [''], alts: [[]], cid: cid });
    if (i < 2) by['progress-d1#' + cid] = {
      deckId: 'progress-d1', sentence: sentence, times: 1, okTimes: 1, wrongTimes: 0,
      streak: 1, maxStreak: 1, lastAt: now - 86400000, interval: 1, ease: 2.5, dueAt: now - 1000
    };
  }
  /* 旧内容中曾练过、但已经不属于当前题库的句子不能继续计入覆盖。 */
  by['progress-d1#retired-cid'] = {
    deckId: 'progress-d1', sentence: 'Retired sentence.', times: 1, okTimes: 1, wrongTimes: 0,
    streak: 1, maxStreak: 1, lastAt: now - 86400000, interval: 1, ease: 2.5, dueAt: now - 1000
  };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'progress-d1', name: '进度诊断', items: items }], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 1, totalAnswered: 2, bySentence: by, events: [] },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: false }
  }));
  sessionStorage.setItem('_startDeck', JSON.stringify({ id: 'progress-d1', name: '进度诊断', items: items.slice(2) }));
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.route('**/api/**', function (route) { route.abort('failed'); });
    await page.addInitScript(seed);
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    for (var i = 0; i < 2; i++) {
      await page.locator('#stageChoices .choice[data-v="Answer"]').click();
      await page.locator('#btnNext').click();
    }
    await page.locator('#btnExitPractice').click();
    await page.waitForSelector('#pageHome:not(.hidden) .home-deck-progress', { timeout: 10000 });
    var result = await page.evaluate(function () {
      var row = document.querySelector('#pageHome .home-deck-progress');
      return {
        text: row ? row.textContent : '',
        aria: row ? row.getAttribute('aria-label') : '',
        title: row && row.querySelector('[title]') ? row.querySelector('[title]').getAttribute('title') : '',
        keys: Object.keys((mem.stats && mem.stats.bySentence) || {}).filter(function (k) { return k.indexOf('progress-d1#') === 0; }).length
      };
    });
    if (result.keys !== 5 || result.text.indexOf('已覆盖 4 / 5 句') < 0 || result.text.indexOf('本次完成 2 句') < 0 || result.title.indexOf('重复练习不会增加') < 0) {
      throw new Error('新句答题后进度不符合预期：' + JSON.stringify(result));
    }
    console.log('[deck-progress-diagnostic] 新句答题写入统计，首页显示 4/5 与本次 2 句');
  } catch (error) {
    console.error('[deck-progress-diagnostic] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
