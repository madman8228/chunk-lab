'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10580, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-mobile-learning-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: ['ignore', 'ignore', 'ignore']
    });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) {
        clearInterval(timer);
        reject(new Error('server exit ' + server.exitCode));
        return;
      }
      const req = http.get(BASE + '/api/health', function (res) {
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
        reject(new Error('server start timeout'));
      }
    }, 100);
  });
}

function stopServer() {
  if (server) {
    try { server.kill('SIGKILL'); } catch (e) {}
  }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function localMem() {
  return {
    version: 2,
    decks: [{
      id: 'oral-8-39',
      name: '口语3000句 · 谚语、惯用语',
      builtin: true,
      items: [{
        sentence: "All's fair in love and war.",
        translation: '恋爱和战争都是不择手段的。',
        chunks: ["All's fair", 'in love and war.'],
        hints: ['都是公平的', '在爱情和战争中'],
        cid: '441327b0'
      }]
    }],
    activeDeckId: 'oral-8-39',
    best: { 'oral-8-39': { lastPlayed: Date.now() } },
    mastered: {},
    deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
    settings: { mode: 'choose', sound: false, skipMastered: false },
    progress: {}
  };
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(function () {
    return { width: document.documentElement.scrollWidth, viewport: window.innerWidth };
  });
  if (result.width > result.viewport + 1) throw new Error(label + ' 出现横向溢出：' + JSON.stringify(result));
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route('**/api/**', function (route) { route.abort('failed'); });
    await page.addInitScript(function (value) {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify(value));
    }, localMem());
    await page.goto(BASE + '/main.html?direct=1&mobile-learning-evidence=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stageChoices .choice', { timeout: 15000 });
    await assertNoHorizontalOverflow(page, '题目初始态');

    const chunks = await page.evaluate(function () {
      /* 让证据覆盖真实长讲解路径；内容仍通过真实 renderAnalysis 渲染。 */
      S.items[0].explanations = Array.from({ length: 8 }, function (_, index) {
        return '移动端长讲解第 ' + (index + 1) + ' 节：这是一段用于验证面板内部滚动的说明，帮助学习者理解句意、使用条件和迁移方式。';
      });
      return S.items[0].chunks.slice();
    });
    for (const chunk of chunks) {
      const clicked = await page.evaluate(function (value) {
        const button = Array.prototype.find.call(document.querySelectorAll('#stageChoices .choice'), function (el) {
          return el.getAttribute('data-v') === value;
        });
        if (!button) return false;
        button.click();
        return true;
      }, chunk);
      if (!clicked) throw new Error('移动端当前题目缺少正确词块：' + chunk);
      await page.waitForFunction(function () {
        return window.S && window.S.chunkIdx > 0 && window.S.status[window.S.chunkIdx - 1] === 'ok';
      });
    }

    const panel = page.locator('.explain-panel.current');
    await panel.waitFor({ state: 'visible', timeout: 10000 });
    const topState = await panel.evaluate(function (el) {
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollTop: el.scrollTop };
    });
    if (topState.scrollHeight <= topState.clientHeight) {
      throw new Error('移动端长讲解没有形成面板内部滚动：' + JSON.stringify(topState));
    }
    await page.screenshot({ path: path.join(ROOT, 'output', 'test-results', 'mobile-learning-explanation-top.png'), fullPage: false });

    const bottomState = await panel.evaluate(function (el) {
      el.scrollTop = el.scrollHeight;
      const last = el.querySelector('.exp-section:last-child');
      const panelRect = el.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      return {
        scrollTop: el.scrollTop,
        bottomReached: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
        lastVisible: lastRect.top >= panelRect.top - 1 && lastRect.bottom <= panelRect.bottom + 1
      };
    });
    if (!bottomState.bottomReached || !bottomState.lastVisible) {
      throw new Error('移动端讲解无法滚动到底部：' + JSON.stringify(bottomState));
    }
    await page.screenshot({ path: path.join(ROOT, 'output', 'test-results', 'mobile-learning-explanation-bottom.png'), fullPage: false });
    await assertNoHorizontalOverflow(page, '长讲解滚动后');

    await panel.locator('.explain-close').click();
    await panel.waitFor({ state: 'detached', timeout: 3000 });
    const beforeNext = await page.evaluate(function () { return S.idx; });
    await page.locator('#btnNext:not(.hidden)').click();
    await page.waitForFunction(function (previous) {
      return window.S && S.idx > previous && !document.getElementById('pagePractice').classList.contains('hidden');
    }, beforeNext, { timeout: 10000 });
    await page.waitForSelector('#stageChoices .choice', { timeout: 10000 });
    await assertNoHorizontalOverflow(page, '完成题目后');
    await context.close();
    console.log('[mobile-learning-explanation] 移动端学习、长讲解滚动、关闭和下一步通过');
  } catch (error) {
    console.error('[mobile-learning-explanation] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
