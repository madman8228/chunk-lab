/* main-startup.test.js · 首页不应被云端初始化阻塞 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9750, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-main-startup-'));
const BASE = 'http://127.0.0.1:' + PORT;
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
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
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
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const page = await browser.newPage();
    await page.addInitScript(function () {
      var now = Date.now();
      var item = { cid: 'slow-start-1', sentence: 'Slow startup keeps this lesson open.', en: 'Slow startup keeps this lesson open.', translation: '慢启动时仍保持课程打开。', chunks: ['Slow startup', 'keeps', 'this lesson', 'open.'], hints: ['', '', '', ''] };
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [{ id: 'slow-start', name: '慢启动课程', items: [item] }],
        best: { 'slow-start': { lastPlayed: now } }, mastered: {}, deletedItems: {}, reinforceBook: [],
        stats: { totalRounds: 0, totalAnswered: 1, bySentence: {
          'slow-start#slow-start-1': { deckId: 'slow-start', cid: 'slow-start-1', sentence: item.sentence,
            times: 1, okTimes: 1, wrongTimes: 0, streak: 1, dueAt: now - 1000 }
        }, events: [] },
        settings: { mode: 'choose', sound: false, batchSize: 10 }
      }));
    });
    /* 模拟 /api/config 卡住：本地首页应先完成首屏绘制，不等待云端。 */
    await page.route('**/api/config', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 1200); });
      await route.continue();
    });
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pageHome:not(.hidden) #homeBody > *', { timeout: 2000 });
    await page.locator('[data-start="slow-start"]').click();
    await page.waitForSelector('#pagePractice:not(.hidden)');
    var started = await page.locator('#deckName').innerText();
    if (started !== '慢启动课程') throw new Error('本地首页开始课程失败：' + started);
    await page.waitForSelector('#stageChoices .choice');
    await page.locator('#stageChoices .choice[data-v="Slow startup"]').click();
    await page.waitForFunction(function () { return window.S && S.chunkTotal === 1 && S.idx === 0 && S.chunkIdx === 1; });
    await page.waitForTimeout(1500);
    var after = await page.evaluate(function () {
      return { practice: !document.querySelector('#pagePractice').classList.contains('hidden'), deck: document.querySelector('#deckName').textContent };
    });
    if (!after.practice || after.deck !== '慢启动课程') {
      throw new Error('后台初始化覆盖了用户已开始的课程：' + JSON.stringify(after));
    }
    console.log('[main-startup] 云端初始化延迟时首页仍能显示');
  } catch (error) {
    console.error('[main-startup] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
