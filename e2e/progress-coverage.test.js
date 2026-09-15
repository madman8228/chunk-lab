/* progress-coverage.test.js · 课程覆盖与本次完成必须区分 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9850, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-progress-coverage-'));
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

/* 两个最先出现的句子已经练过，只是现在再次到期；其余 41 句从未练过。
   真实流程答完前两句并退出后，覆盖数应仍为 41，而“本次完成”应明确显示 2。 */
function seedRepeatedReview() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str || ''); for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; return ('00000000' + (h >>> 0).toString(16)).slice(-8); }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now(), items = [], by = {}, i, sentence, cid;
  for (i = 0; i < 43; i++) {
    sentence = 'Coverage sentence ' + i + '.';
    cid = fnv8(sentence);
    items.push({ sentence: sentence, translation: '覆盖测试句子 ' + i + '。', chunks: ['Answer'], hints: [''], alts: [[]], cid: cid });
    if (i < 41) by['progress-d1#' + cid] = {
      deckId: 'progress-d1', sentence: sentence, times: 1, okTimes: 1, wrongTimes: 0,
      streak: 1, maxStreak: 1, lastAt: now - 86400000, interval: 1, ease: 2.5, dueAt: now - 1000
    };
  }
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'progress-d1', name: '覆盖测试', items: items }], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 1, totalAnswered: 41, bySentence: by, events: [
      { id: 'seed-1', kind: 'answer', key: 'progress-d1#' + fnv8('Coverage sentence 0.'), ok: true, at: now - 86400000 },
      { id: 'seed-2', kind: 'answer', key: 'progress-d1#' + fnv8('Coverage sentence 1.'), ok: true, at: now - 86400000 }
    ] },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: false }
  }));
  sessionStorage.setItem('_startDeck', JSON.stringify({ id: 'progress-d1', name: '覆盖测试', items: items }));
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.route('**/api/**', function (route) { route.abort('failed'); });
    await page.addInitScript(seedRepeatedReview);
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    await page.locator('#stageChoices .choice[data-v="Answer"]').click();
    await page.locator('#btnNext').click();
    await page.locator('#stageChoices .choice[data-v="Answer"]').click();
    await page.locator('#btnNext').click();
    await page.locator('#btnExitPractice').click();
    await page.waitForSelector('#pageHome:not(.hidden) .home-deck-progress', { timeout: 10000 });
    const text = await page.locator('#pageHome .home-deck-progress').first().innerText();
    if (text.indexOf('41 / 43') < 0 || text.indexOf('本次完成 2 句') < 0) {
      throw new Error('进度文案不符合预期：' + text);
    }
    console.log('[progress-coverage] 重复复习不虚增覆盖数，并显示本次完成数');
    await ctx.close();
  } catch (error) {
    console.error('[progress-coverage] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
