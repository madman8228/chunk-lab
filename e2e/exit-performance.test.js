'use strict';

/* 退出性能回归：本地保存完成后，退出不应等待云端同步尾队列。 */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9970, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-exit-performance-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3' }),
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
      if (++tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
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
    sentence: 'Exit performance should stay fast.',
    translation: '退出操作应该保持快速。',
    chunks: ['Exit performance', 'should stay fast.'],
    hints: ['', ''], alts: [[], []], cid: 'exit-performance-test'
  };
  const deck = { id: 'exit-performance-d1', name: '退出性能测试', items: [item] };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, decks: [deck], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: false }
  }));
  sessionStorage.setItem('_startDeck', JSON.stringify(deck));
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(seedExitCourse);
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    await page.waitForFunction(() => CL.getCloudConfig().writeProtocol === 3 && CL.serverPersistenceReady(), null,
      { timeout: 15000 });
    const deck = await page.evaluate(async () => {
      const items = Array.from({ length:20 }, (_, index) => {
        const sentence = 'Slow acknowledgement practice ' + (index + 1) + '.';
        return { cid:'slow-ack-' + (index + 1), sentence, en:sentence, translation:'慢回执练习 ' + (index + 1),
          chunks:[sentence], alts:[[]], hints:[] };
      });
      await commitImport(items, '退出性能 protocol 3');
      const imported = mem.decks.find(item => item.name === '退出性能 protocol 3');
      if (!imported || imported.items.length !== 20) throw new Error('20 题退出性能夹具未确认写入');
      mem.settings.shuffle = false;
      mem.settings.mode = 'choose';
      mem.settings.batchSize = 20;
      showPracticePage();
      startDeck(imported, 0);
      const confirmed = await ServerCache.read();
      return { id:imported.id, totalAnswered:confirmed.snapshot.mem.stats.totalAnswered };
    });
    await page.waitForFunction(id => S.deck && S.deck.id === id && S.idx === 0 && S.items.length === 20,
      deck.id, { timeout:10000 });
    let releaseAcknowledgement;
    let notifyHeldAcknowledgement;
    const heldAcknowledgement = new Promise(resolve => { notifyHeldAcknowledgement = resolve; });
    const acknowledgementGate = new Promise(resolve => { releaseAcknowledgement = resolve; });
    let acknowledgementHeldAt = 0;
    await page.evaluate(() => {
      window.__exitWaitForSyncCalls = 0;
      window.__answerEnqueueLatencies = [];
      const submit = ServerStore.submit;
      ServerStore.submit = function (type, payload) {
        const started = performance.now();
        return submit.apply(this, arguments).then(result => {
          if (type === 'learning.answer' && payload.deckId === S.deck.id) {
            window.__answerEnqueueLatencies.push(performance.now() - started);
          }
          return result;
        });
      };
      const waitForSync = CL.waitForSync;
      CL.waitForSync = function () {
        window.__exitWaitForSyncCalls++;
        return waitForSync.apply(this, arguments);
      };
    });
    await page.route('**/api/operations', async route => {
      let operation;
      try { operation = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      if (!acknowledgementHeldAt && operation && operation.type === 'learning.answer' &&
          operation.payload.deckId === deck.id) {
        const response = await route.fetch();
        acknowledgementHeldAt = Date.now();
        notifyHeldAcknowledgement();
        await acknowledgementGate;
        return route.fulfill({ response });
      }
      return route.continue();
    });
    const sentences = await page.evaluate(() => S.items.map(item => item.sentence));
    for (const sentence of sentences) {
      await page.waitForSelector('#stageChoices .choice', { timeout:10000 });
      await page.evaluate(value => {
        const correct = Array.from(document.querySelectorAll('#stageChoices .choice')).find(button => button.dataset.v === value);
        if (!correct) throw new Error('找不到正确答案：' + value);
        correct.click();
      }, sentence);
      await page.waitForSelector('#btnNext:not([disabled])', { timeout:10000 });
      await page.locator('#btnNext').click();
    }
    await heldAcknowledgement;
    await page.waitForSelector('#result:not(.hidden)', { timeout:10000 });
    const durableAnswers = await page.evaluate(async id => (await IDBStore.listPendingOperations())
      .map(row => row.operation).filter(operation => operation.type === 'learning.answer' && operation.payload.deckId === id).length,
    deck.id);
    if (durableAnswers !== 20) throw new Error('回执挂起时 IndexedDB 中仅有 ' + durableAnswers + '/20 条答案');
    const enqueueLatencies = await page.evaluate(() => window.__answerEnqueueLatencies.slice().sort((a,b)=>a-b));
    if (enqueueLatencies.length !== 20) throw new Error('仅测得 ' + enqueueLatencies.length + '/20 条答案的耐久入队耗时');
    const enqueueP95 = enqueueLatencies[Math.ceil(enqueueLatencies.length * .95) - 1];
    const enqueueMax = enqueueLatencies[enqueueLatencies.length - 1];
    if (enqueueMax >= 1000) throw new Error('答案耐久入队最大耗时 ' + enqueueMax.toFixed(1) + 'ms，超过 1 秒');
    const heldFor = Date.now() - acknowledgementHeldAt;
    if (heldFor < 5000) await new Promise(resolve => setTimeout(resolve, 5000 - heldFor));

    const before = Date.now();
    await page.locator('#btnExitPractice').click();
    await page.waitForFunction(function () {
      var home = document.getElementById('pageHome');
      var practice = document.getElementById('pagePractice');
      return home && !home.classList.contains('hidden') && practice && practice.classList.contains('hidden');
    }, null, { timeout: 3000 });
    const elapsed = Date.now() - before;
    const waitCalls = await page.evaluate(function () { return window.__exitWaitForSyncCalls; });
    if (elapsed >= 1000) throw new Error('退出耗时 ' + elapsed + 'ms，超过 1 秒；waitForSync 调用次数=' + waitCalls);
    if (waitCalls !== 0) throw new Error('退出操作调用了同步等待；次数=' + waitCalls);
    releaseAcknowledgement();
    await waitForAsync(page, async ({id,baseline}) => {
      const cache = await ServerCache.read();
      const snapshot = cache && cache.snapshot;
      const deck = snapshot && snapshot.mem.decks.find(item => item.id === id);
      const rows = await IDBStore.listPendingOperations();
      return snapshot && deck && snapshot.mem.stats.totalAnswered - baseline === 20 &&
        deck.items.every(item => snapshot.mem.stats.bySentence[deck.id + '#' + item.cid]?.times === 1) &&
        !rows.some(row => row.operation && row.operation.type === 'learning.answer' && row.operation.payload.deckId === id);
    }, { id:deck.id, baseline:deck.totalAnswered }, { timeout:30000 });
    console.log('[exit-performance] passed enqueueP95=' + enqueueP95.toFixed(1) + 'ms enqueueMax=' + enqueueMax.toFixed(1) +
      'ms exit=' + elapsed + 'ms durableAnswers=20 serverAckDelay>=5000ms waitForSyncCalls=' + waitCalls);
  } catch (error) {
    console.error('[exit-performance] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
