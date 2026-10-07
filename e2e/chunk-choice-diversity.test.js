'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10580, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-chunk-choice-diversity-'));
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
    const page = await browser.newPage({ viewport: { width: 740, height: 932 } });
    await page.addInitScript(function () {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
        settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, sound: false }, progress: {}
      }));
    });
    await page.goto(BASE + '/main.html?direct=1&chunk-choice-diversity=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window._mainBooted && window.mem && window.CL; });
    const before = await page.evaluate(async function () {
      await window.ensurePracticeReady();
      const item = {
        cid: 'alarm-item', sentence: 'My alarm is set.', translation: '我的闹钟设定好了。',
        chunks: ['My alarm', 'is set.'], hints: ['我的闹钟', '设定好了'],
        alts: [['My alarms'], ['It is set.']],
        distractors: [['My alarms', "My alarm's", 'My alarm is'], ['It is set.', 'The alarm is']]
      };
      const deck = { id: 'choice-diversity-deck', name: '选项多样性测试', items: [item] };
      /* Synthetic choice rendering only; not a cloud persistence fixture. */
      showPracticePage();
      startDeck(deck, 0, undefined, false, 0);
      return {
        correct: S.choicesPool.corrects.slice(),
        distractors: S.choicesPool.distractors.slice(),
        order: S.choicesPool.order.map(function (entry) { return { value: entry.v, ci: entry.ci }; }),
        buttons: Array.prototype.map.call(document.querySelectorAll('#stageChoices .choice'), function (button) { return button.dataset.v; })
      };
    });
    if (before.correct.length !== 2 || before.distractors.length !== 2 || before.distractors.includes('My alarms') || before.distractors.includes('It is set.')) {
      throw new Error('实际页面候选池未按每槽一个干扰项构成，或混入合法答案：' + JSON.stringify(before));
    }
    const after = await page.evaluate(function () {
      const right = S.choicesPool.order.find(function (entry) { return entry.ci === 0; }).v;
      const button = Array.prototype.find.call(document.querySelectorAll('#stageChoices .choice'), function (node) { return node.dataset.v === right; });
      if (!button) throw new Error('首个正确 chunk 按钮未渲染');
      button.click();
      return {
        chunkIndex: S.chunkIdx,
        order: S.choicesPool.order.map(function (entry) { return { value: entry.v, ci: entry.ci }; }),
        buttons: Array.prototype.map.call(document.querySelectorAll('#stageChoices .choice'), function (node) { return node.dataset.v; })
      };
    });
    const expectedRemainder = before.order.filter(function (entry) { return entry.ci !== 0; }).map(function (entry) { return entry.value; });
    if (after.chunkIndex !== 1 || JSON.stringify(after.order) !== JSON.stringify(before.order) ||
        JSON.stringify(after.buttons) !== JSON.stringify(expectedRemainder)) {
      throw new Error('完成一个正确 chunk 后应保持池顺序且只隐藏已完成正确项：' + JSON.stringify({ before: before, after: after }));
    }
    await page.setViewportSize({ width: 375, height: 812 });
    const narrow = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll('#stageChoices .choice'), function (node) {
        const rect = node.getBoundingClientRect();
        return { value: node.dataset.v, width: rect.width, height: rect.height };
      });
    });
    if (narrow.length !== expectedRemainder.length || narrow.some(function (entry) { return entry.width <= 0 || entry.height <= 0; })) {
      throw new Error('375px 视口下剩余候选应正常渲染：' + JSON.stringify(narrow));
    }
    console.log('chunk-choice-diversity.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
