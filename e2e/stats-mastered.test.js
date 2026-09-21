/* stats-mastered.test.js · 手动标熟应计入学习档案概览 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9620, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-stats-mastered-'));
let server = null;
let browser = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
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
      /* 就绪窗口 300×100ms=30s。原为 40×200ms=8s，对宿主 node 冷启动实测 5.4s 只有 1.48× 余量，
         属临界带（同库 6s 窗口已实测会随负载翻红）。health 一旦 200 立即 resolve，成功路径不增加耗时。 */
      if (++tries > 300) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function check(name, ok, detail) {
  if (!ok) throw new Error(name + (detail ? ' → ' + detail : ''));
  console.log('  ✓ ' + name);
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext();
    await context.route('**/api/**', function (route) { route.abort('failed'); });
    await context.addInitScript(function () {
      if (sessionStorage.getItem('__stats_mastered_seeded')) return;
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2,
        decks: [],
        best: {},
        mastered: { 'builtin-freq-idioms#7b9bfce3': {
          deckId: 'builtin-freq-idioms', sentence: 'The flood was an act of god.', markedAt: Date.now()
        }},
        deletedItems: {},
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
        settings: {}
      }));
      sessionStorage.setItem('__stats_mastered_seeded', '1');
    });
    const page = await context.newPage();
    await page.goto(BASE + '/stats.html?regression=manual-mastered', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#todayAnswered');
    await page.waitForFunction(function () {
      return Array.from(document.querySelectorAll('.ov-stat')).some(function (cell) {
        return cell.querySelector('.l') && cell.querySelector('.l').textContent.trim() === '已熟练';
      });
    });
    const result = await page.evaluate(function () {
      return Array.from(document.querySelectorAll('.ov-stat')).reduce(function (out, cell) {
        const label = cell.querySelector('.l');
        const value = cell.querySelector('.n');
        if (label && value) out[label.textContent.trim()] = value.textContent.trim();
        return out;
      }, {});
    });
    check('手动标熟计入学习档案概览', result['已熟练'] === '1', JSON.stringify(result));
    await page.locator('[data-tab="review"]').click();
    await page.waitForSelector('.review-row');
    const review = await page.evaluate(function () {
      return {
        dueCount: document.getElementById('reviewTabCount').textContent.trim(),
        heading: document.querySelector('#statsBody b') && document.querySelector('#statsBody b').textContent.trim(),
        preview: document.querySelector('.review-preview') && document.querySelector('.review-preview').textContent.trim(),
        rows: document.querySelectorAll('.review-row').length
      };
    });
    check('复测区明确区别于到期复习并显示具体句子',
      review.dueCount === '(0)' && review.heading.indexOf('不计入待复习') >= 0 &&
      review.preview.indexOf('The flood was an act of god.') >= 0 && review.rows === 1,
      JSON.stringify(review));
    await page.locator('[data-rev-deck="builtin-freq-idioms"]').click();
    await page.waitForURL(/\/main\.html\?autostart=1/);
    await page.waitForFunction(function () {
      var el = document.getElementById('deckName');
      return !!el && el.textContent.indexOf('复习') >= 0;
    }, null, { timeout: 12000 });
    check('复测按钮进入对应句子练习页', (await page.locator('#deckName').textContent()).indexOf('复习') >= 0);
    await browser.close();
    browser = null;
    stopServer();
    console.log('[stats-mastered e2e] passed');
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
    console.error('[stats-mastered e2e] failed:', err && err.stack || err);
    process.exitCode = 1;
  }
})();
