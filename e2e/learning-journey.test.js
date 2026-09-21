/* learning-journey.test.js · 完成当前课节后进入同课程下一未完成课节 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10480, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-learning-journey-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;
let serverOutput = '';

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', function (chunk) { serverOutput += String(chunk); });
    server.stderr.on('data', function (chunk) { serverOutput += String(chunk); });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) {
        clearInterval(timer);
        reject(new Error('server exit ' + server.exitCode + '\n' + serverOutput.slice(-3000)));
        return;
      }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) {
          clearInterval(timer);
          resolve();
        }
      });
      req.on('error', function () {});
      req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) {
        clearInterval(timer);
        reject(new Error('server start timeout\n' + serverOutput.slice(-3000)));
      }
    }, 100);
  });
}

function stopServer() {
  if (!server) {
    fs.rmSync(TMP_DB, { recursive: true, force: true });
    return Promise.resolve();
  }
  return new Promise(function (resolve) {
    let settled = false;
    const finish = function () {
      if (settled) return;
      settled = true;
      try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
      resolve();
    };
    server.once('close', finish);
    try { server.kill('SIGKILL'); } catch (e) { finish(); }
    setTimeout(finish, 3000);
  });
}

async function seedSixCompletedSentences(page) {
  await page.waitForFunction(function () {
    return !!(window._mainBooted && window.mem && window.ContentRepo);
  });
  await page.evaluate(async function () {
    await window.ContentRepo.ready;
    var deck = await window.ContentRepo.ensureDeck('oral-7-38', window.mem);
    if (!deck || !deck.items || deck.items.length !== 7) throw new Error('结语课节未加载完整：' + (deck && deck.items && deck.items.length));
    var now = Date.now();
    var by = {};
    deck.items.slice(0, 6).forEach(function (item) {
      by[deck.id + '#' + item.cid] = {
        deckId: deck.id, cid: item.cid, sentence: item.sentence,
        times: 3, okTimes: 3, wrongTimes: 0, streak: 3, maxStreak: 3,
        lastAt: now - 86400000, dueAt: now + 86400000, interval: 3, ease: 2.5
      };
    });
    window.mem.stats.bySentence = by;
    window.mem.stats.totalAnswered = 6;
    window.mem.stats.totalRounds = 1;
    window.mem.stats.events = deck.items.slice(0, 6).map(function (item, index) {
      return { id: 'journey-' + index, kind: 'answer', key: deck.id + '#' + item.cid, ok: true, at: now - 86400000 };
    });
    await window.saveStore('local');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.route('**/api/**', function (route) { route.abort('failed'); });
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await seedSixCompletedSentences(page);

    await page.goto(BASE + '/decks.html?course=builtin%3Aoral', { waitUntil: 'domcontentloaded' });
    await page.locator('.catalog-lesson').filter({ hasText: '(商业信函用语)结语' }).click();
    try {
      await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    } catch (error) {
      throw new Error('进入结语课节后未生成题目：url=' + page.url() + '\n' + (await page.locator('body').innerText()).slice(0, 2000));
    }
    const firstSentence = await page.evaluate(function () {
      return { id: S.deck.id, chunks: S.items[S.idx].chunks.slice() };
    });
    if (firstSentence.id !== 'oral-7-38') throw new Error('继续入口进入了错误课节：' + firstSentence.id);
    for (const chunk of firstSentence.chunks) {
      const clicked = await page.evaluate(function (value) {
        var button = Array.prototype.find.call(document.querySelectorAll('#stageChoices .choice'), function (el) {
          return el.getAttribute('data-v') === value;
        });
        if (!button) return false;
        button.click();
        return true;
      }, chunk);
      if (!clicked) throw new Error('当前题目缺少正确词块：' + chunk);
      await page.waitForFunction(function (value) {
        return window.S && window.S.chunkIdx > 0 && window.S.status[window.S.chunkIdx - 1] === 'ok';
      }, chunk);
    }
    try {
      await page.waitForSelector('#btnNext:not(.hidden)', { timeout: 5000 });
    } catch (error) {
      const state = await page.evaluate(function () {
        var b = document.getElementById('btnNext');
        return { hidden: b && b.className, finished: S.finished, finishing: S._finishing, status: S.status, explain: !!document.querySelector('.explain-panel.current'), practice: !document.getElementById('pagePractice').classList.contains('hidden') };
      });
      throw new Error('完成课节题目后下一题按钮仍隐藏：' + JSON.stringify(state));
    }
    await page.locator('#btnNext').click();
    await page.waitForSelector('#result:not(.hidden) #btnNextCourse', { timeout: 10000 });
    const finish = await page.locator('#result').innerText();
    if (finish.indexOf('下一课') === -1 || finish.indexOf('口语3000句') === -1) {
      throw new Error('完成课节后缺少下一课提示：' + finish);
    }
    await page.locator('#btnNextCourse').click();
    await page.waitForSelector('#stageChoices .choice', { timeout: 15000 });
    const next = await page.evaluate(function () {
      return { id: S.deck.id, title: document.getElementById('deckName').textContent, practice: !document.getElementById('pagePractice').classList.contains('hidden') };
    });
    if (next.id !== 'oral-8-39' || next.title.indexOf('谚语') === -1 || !next.practice) {
      throw new Error('下一课入口未进入下一未完成课节：' + JSON.stringify(next));
    }
    await context.close();
    console.log('[learning-journey] 完成当前课节后进入下一未完成课节');
  } catch (error) {
    console.error('[learning-journey] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    await stopServer();
  }
})();
