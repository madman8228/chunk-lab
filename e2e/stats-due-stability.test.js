'use strict';

/* 回归：首次同步期间不应把本地旧待复习数短暂展示给用户。 */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9630, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-stats-due-stability-'));
let server = null;
let browser = null;

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
    }, 400);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

async function putRemote(mem) {
  var response = await fetch(BASE + '/api/data', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mem: mem })
  });
  if (!response.ok) throw new Error('remote seed failed: ' + response.status + ' ' + await response.text());
}

function makeMem(count) {
  var items = [], bySentence = {};
  for (var i = 1; i <= 38; i++) {
    var sentence = 'Stability sentence ' + i + '.';
    items.push({ sentence: sentence, en: sentence, chunks: [sentence], hints: [''] });
    if (i <= count) bySentence['stability#s' + i] = {
      deckId: 'stability', sentence: sentence, times: 1, okTimes: 1, wrongTimes: 0,
      streak: 1, maxStreak: 1, lastAt: Date.now() - 86400000, interval: 1, ease: 2.5,
      dueAt: Date.now() - 1000
    };
  }
  return {
    version: 2,
    decks: [{ id: 'stability', name: '稳定性测试', items: items }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 0, totalAnswered: count, bySentence: bySentence, events: [] },
    settings: { mode: 'choose', sound: false, batchSize: 10 }
  };
}

(async function () {
  try {
    await startServer();
    await putRemote(makeMem(38));
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    var page = await browser.newPage();
    await page.addInitScript(function (localMem) {
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify(localMem));
    }, makeMem(24));
    await page.route('**/api/config', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 700); });
      await route.continue();
    });
    await page.route('**/api/data', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 700); });
      await route.continue();
    });
    await page.goto(BASE + '/stats.html', { waitUntil: 'domcontentloaded' });
    /* 探针必须等「同步中的 loading 状态」本身，而不是静态的 #statsCards/#reviewTabCount：
       后两者在 DOMContentLoaded 时就已存在，早于 renderStats() 插入 .stats-loading 的时机，
       若在此间隙读取会得到 {count:'', loading:false} 的假失败（全量跑红、单跑绿）。
       同步被刻意延迟 700ms，故 .stats-loading 一旦出现会稳定驻留，等它是确定性的。 */
    await page.waitForFunction(function () {
      return document.querySelector('#reviewTabCount') && document.querySelector('.stats-loading');
    });
    var first = await page.evaluate(function () {
      return { count: document.querySelector('#reviewTabCount').textContent, loading: !!document.querySelector('.stats-loading') };
    });
    await page.waitForFunction(function () {
      return document.querySelector('#reviewTabCount').textContent === '(38)';
    }, null, { timeout: 10000 });
    var finalCount = await page.locator('#reviewTabCount').innerText();
    if (first.count !== '' || !first.loading || finalCount !== '(38)') {
      throw new Error('首次同步状态不稳定：' + JSON.stringify({ first: first, final: finalCount }));
    }
    var slow = await browser.newPage();
    await slow.addInitScript(function (localMem) {
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify(localMem));
    }, makeMem(24));
    await slow.route('**/api/config', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 4000); });
      await route.continue();
    });
    await slow.route('**/api/data', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 4000); });
      await route.continue();
    });
    await slow.goto(BASE + '/stats.html', { waitUntil: 'domcontentloaded' });
    await slow.waitForSelector('#todayAnswered', { timeout: 3500 });
    var fallback = await slow.evaluate(function () {
      var note = document.querySelector('.stats-sync-status');
      return { count: document.querySelector('#reviewTabCount').textContent, note: note && note.textContent, loading: !!document.querySelector('.stats-loading') };
    });
    if (fallback.count !== '(24)' || !fallback.note || fallback.loading) {
      throw new Error('同步超时未降级到本地统计：' + JSON.stringify(fallback));
    }
    await slow.waitForFunction(function () { return document.querySelector('#reviewTabCount').textContent === '(38)'; }, null, { timeout: 10000 });
    var finalStatus = await slow.locator('.stats-sync-status').getAttribute('hidden');
    if (finalStatus === null) {
      throw new Error('同步完成后仍保留本地来源提示');
    }
    await slow.close();
    console.log('[stats-due-stability e2e] passed');
  } catch (err) {
    console.error('[stats-due-stability e2e] failed:', err && err.message || err);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
  }
})();
