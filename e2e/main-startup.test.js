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

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
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
    await page.route('**/js/bridge.mjs', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 800); });
      await route.continue();
    });
    var practiceModuleRequested = false;
    await page.route('**/js/chunk-engine.mjs', async function (route) {
      practiceModuleRequested = true;
      await route.continue();
    });
    await page.goto(BASE + '/main.html', { waitUntil: 'commit' });
    await page.waitForSelector('#pagePractice', { state: 'attached' });
    var firstFrame = await page.evaluate(function () {
      return {
        practiceHidden: document.querySelector('#pagePractice').classList.contains('hidden'),
        bootVisible: !document.querySelector('#bootScreen').hidden,
        homeVisible: !document.querySelector('#pageHome').classList.contains('hidden')
      };
    });
    if (!firstFrame.practiceHidden || firstFrame.bootVisible) {
      throw new Error('首屏不应显示练习外壳：' + JSON.stringify(firstFrame));
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageHome:not(.hidden) #homeBody > *', { timeout: 2000 });
    if (practiceModuleRequested) throw new Error('首页启动不应请求练习引擎');
    await page.locator('[data-start="slow-start"]').click();
    await page.waitForSelector('#pagePractice:not(.hidden)');
    await page.waitForFunction(function () {
      return document.querySelector('#deckName') && document.querySelector('#deckName').textContent === '慢启动课程';
    }, undefined, { timeout: 10000 });
    var started = await page.locator('#deckName').innerText();
    if (started !== '慢启动课程') {
      var startState = await page.evaluate(function(){ return {
        href: location.href,
        deckName: document.querySelector('#deckName') && document.querySelector('#deckName').textContent,
        memDecks: window.mem && window.mem.decks && window.mem.decks.map(function(d){ return d.id; }),
        sDeck: window.S && window.S.deck && window.S.deck.id,
        lifecycle: window.MainLifecycle && window.MainLifecycle.createBootCoordinator ? 'ready' : 'missing'
      }; });
      throw new Error('本地首页开始课程失败：' + started + ' ' + JSON.stringify(startState));
    }
    await page.waitForSelector('#stageChoices .choice');
    var firstUse = await page.evaluate(function () {
      var hint = document.getElementById('chunkOnboardingHint');
      return { visible: !!hint && !hint.hidden, text: hint ? (hint.textContent || '').trim() : '' };
    });
    if (!firstUse.visible || firstUse.text.indexOf('点选词块作答') === -1) {
      throw new Error('首次词块提示未在第一次进入选择模式时出现：' + JSON.stringify(firstUse));
    }
    await page.locator('#stageChoices .choice[data-v="Slow startup"]').click();
    await page.waitForFunction(function () { return window.S && S.chunkTotal === 1 && S.idx === 0 && S.chunkIdx === 1; });
    var afterOnboarding = await page.evaluate(function () {
      var hint = document.getElementById('chunkOnboardingHint');
      var concept = document.getElementById('chunkConceptHint');
      return {
        onboardingGone: !hint,
        conceptVisible: !!concept && !concept.classList.contains('hidden'),
        persisted: !!(window.mem && mem.settings && mem.settings.chunkOnboardingSeen === true)
      };
    });
    if (!afterOnboarding.onboardingGone || !afterOnboarding.conceptVisible || !afterOnboarding.persisted) {
      throw new Error('首次词块提示状态未正确推进：' + JSON.stringify(afterOnboarding));
    }
    await page.waitForTimeout(1500);
    var after = await page.evaluate(function () {
      return { practice: !document.querySelector('#pagePractice').classList.contains('hidden'), deck: document.querySelector('#deckName').textContent };
    });
    if (!after.practice || after.deck !== '慢启动课程') {
      throw new Error('后台初始化覆盖了用户已开始的课程：' + JSON.stringify(after));
    }
    /* 普通刷新是回到首页的导航，不应被 activeDeckId 或遗留入口状态劫持回练习页。 */
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pageHome:not(.hidden)', { timeout: 3000 });
    await page.waitForTimeout(1200);
    var afterRefresh = await page.evaluate(function () {
      return {
        home: !document.querySelector('#pageHome').classList.contains('hidden'),
        practice: !document.querySelector('#pagePractice').classList.contains('hidden'),
        activeDeckId: window.mem && mem.activeDeckId
      };
    });
    if (!afterRefresh.home || afterRefresh.practice) {
      throw new Error('普通刷新被错误带回练习页：' + JSON.stringify(afterRefresh));
    }

    /* 基础 module 失败时必须给出可操作的错误，而不是永久停在“加载中”。 */
    var failedPage = await browser.newPage();
    await failedPage.route('**/js/bridge.mjs', function (route) { return route.abort(); });
    await failedPage.goto(BASE + '/main.html?bridge-failure-check=1', { waitUntil: 'commit' });
    await failedPage.waitForFunction(function () {
      var boot = document.querySelector('#bootScreen');
      var message = document.querySelector('#bootMessage');
      return !!boot && !boot.hidden && /基础模块未加载/.test(message && message.textContent || '');
    }, undefined, { timeout: 6000 });
    var failedState = await failedPage.evaluate(function () {
      return {
        visible: !document.querySelector('#bootScreen').hidden,
        message: document.querySelector('#bootMessage').textContent
      };
    });
    if (!failedState.visible || failedState.message.indexOf('基础模块未加载') === -1) {
      throw new Error('基础 module 失败未显示明确提示：' + JSON.stringify(failedState));
    }
    await failedPage.close();
    console.log('[main-startup] 云端初始化延迟时首页仍能显示');
  } catch (error) {
    console.error('[main-startup] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
