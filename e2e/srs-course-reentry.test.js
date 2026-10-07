'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10480, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-srs-course-reentry-'));
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
    // This test deliberately injects in-memory schedules to exercise queue
    // filtering/source-index mapping. Server persistence has separate tests.
    await page.route('**/api/**', route => route.abort('failed'));
    await page.addInitScript(function () {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
        settings: { mode: 'choose', sound: false, skipMastered: true, batchSize: 10 }, progress: {}
      }));
    });
    await page.goto(BASE + '/main.html?direct=1&srs-course-reentry=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window._mainBooted && window.mem && window.CL; });
    const result = await page.evaluate(async function () {
      await window.ensurePracticeReady();
      const deckId = 'course-reentry-test';
      const items = ['one', 'two', 'three', 'four'].map(function (word) {
        return { cid: 'item-' + word, sentence: 'I remember ' + word + '.', chunks: ['I remember', word + '.'], hints: ['我记得', word] };
      });
      const deck = { id: deckId, name: 'SRS 重进测试', authoring: {
        template: 'sentence-practice', templateVersion: 1, contentForm: 'sentences',
        learning: { modes: ['chunkSelection'], defaultMode: 'chunkSelection' }
      }, items: items };
      startDeck(deck, 0);
      const firstSchedule = recordSentenceResult(items[0], true);
      const now = Date.now();
      mem.stats.bySentence[CL.cidKey(deckId, items[1])] = { deckId: deckId, cid: items[1].cid, times: 1, okTimes: 0, dueAt: now - 1000 };
      mem.stats.bySentence[CL.cidKey(deckId, items[3])] = { deckId: deckId, cid: items[3].cid, times: 1, okTimes: 1, dueAt: now + 86400000 };
      mem.mastered[CL.masteredKey(deckId, items[3])] = 1;
      startDeck(deck, 3);
      const ordinary = { ids: S.items.map(function (item) { return item.cid; }), index: S.idx,
        statKeys: Object.keys(mem.stats.bySentence), deckId: S.deck && S.deck.id,
        dueAt: firstSchedule.dueAt,
        statKey: CL.cidKey(deckId, items[0]) };
      nextQuestion();
      ordinary.savedSourceIndex = mem.progress[deckId] && mem.progress[deckId].idx;
      mem.stats.bySentence[CL.cidKey(deckId, items[0])].dueAt = Date.now() - 1;
      startDeck(deck, 0);
      const dueAgain = S.items.map(function (item) { return item.cid; });
      const preserveDeck = { id: 'preserve-dialogue-test', name: '顺序课程', authoring: {
        template: 'sentence-practice', templateVersion: 1, contentForm: 'dialogue',
        learning: { modes: ['chunkSelection'], defaultMode: 'chunkSelection' }
      }, items: items.slice(0, 3) };
      mem.stats.bySentence[CL.cidKey(preserveDeck.id, items[0])] = { deckId: preserveDeck.id, cid: items[0].cid, times: 1, okTimes: 1, dueAt: Date.now() + 86400000 };
      mem.stats.bySentence[CL.cidKey(preserveDeck.id, items[1])] = { deckId: preserveDeck.id, cid: items[1].cid, times: 1, okTimes: 0, dueAt: Date.now() - 1 };
      startDeck(preserveDeck, 0);
      const preserveOrder = S.items.map(function (item) { return item.cid; });
      startDeck(deck, 0, undefined, true);
      const forced = S.items.map(function (item) { return item.cid; }).sort();
      const emptyDeck = { id: 'empty-review-test', name: '暂未到期', items: items.slice(0, 3) };
      emptyDeck.items.forEach(function(item, index){
        mem.stats.bySentence[CL.cidKey(emptyDeck.id, item)] = { deckId: emptyDeck.id, cid: item.cid, times: 1, okTimes: 1, dueAt: Date.now() + 86400000 + index * 3600000 };
      });
      startDeck(emptyDeck, 0);
      return { ordinary: ordinary, dueAgain: dueAgain, preserveOrder: preserveOrder, forced: forced, emptyQueue: { count:S.items.length, message:document.querySelector('#zh').textContent } };
    });
    const expected = ['item-two', 'item-three'];
    if (JSON.stringify(result.ordinary.ids) !== JSON.stringify(expected) || result.ordinary.index !== 0) {
      throw new Error('重进应过滤未到期已答句，保留已到期与未练句，并映射断点：' + JSON.stringify(result));
    }
    if (JSON.stringify(result.forced) !== JSON.stringify(['item-four', 'item-one', 'item-three', 'item-two'])) {
      throw new Error('显式重练本课应保留完整课程：' + JSON.stringify(result));
    }
    if (result.ordinary.savedSourceIndex !== 2) throw new Error('断点应保存原课节位置而非过滤后的位置：' + JSON.stringify(result));
    if (!result.dueAgain.includes('item-one')) throw new Error('模拟间隔到期后，同一句子应重新进入课程队列：' + JSON.stringify(result.dueAgain));
    if (JSON.stringify(result.preserveOrder) !== JSON.stringify(['item-two', 'item-three'])) {
      throw new Error('对话课程过滤未来句后仍应保留顺序：' + JSON.stringify(result.preserveOrder));
    }
    if (result.emptyQueue.count !== 0 || result.emptyQueue.message.indexOf('本课 3 句都已安排复习') < 0 || result.emptyQueue.message.indexOf('最早可复习时间：') < 0) {
      throw new Error('全部句子均已排入未来复习时应说明句子数量和最早复习时间：' + JSON.stringify(result.emptyQueue));
    }
    console.log('srs-course-reentry.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
