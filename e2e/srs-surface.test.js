/**
 * srs-surface.test.js · 练习页 SRS 提示移除后的端到端护栏
 *
 * 本用例守住：
 *   1. 出题态及答完一句后均不显示「下次复习」提示
 *   2. 练习卡片不再保留排期提示的空行
 * SRS 排期规则由 srs.test.js 单独验证。
 *
 * 运行：node e2e/srs-surface.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(8970, 60);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-srs-surface-'));
const BASE = 'http://127.0.0.1:' + PORT;

let server = null;
let browser = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const http = require('http');
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* retry */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

/* 句子档案 key = deckId#fnv8(sentence)（loadStore 会做 migrateCidKeys 规范化，
   显式 cid 不参与最终 key）。注入时必须自己算同一个 fnv8。 */
function makeInit() {
  return function (s) {
    function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
    localStorage.clear();
    localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    var now = Date.now();
    var cid = fnv8(s.sentence);
    var item = { sentence: s.sentence, translation: s.translation, chunks: s.chunks.slice(),
      hints: s.chunks.map(function () { return ''; }), cid: cid };
    var deck = { id: s.deckId, name: 'SRS 探针题库', items: [item] };
    var by = {};
    if (s.prior) {
      by[s.deckId + '#' + cid] = Object.assign({
        deckId: s.deckId, sentence: s.sentence, translation: s.translation,
        times: 1, okTimes: 1, wrongTimes: 0, streak: 0, maxStreak: 0, lastAt: now
      }, s.prior);
    }
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2, decks: [deck], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
      progress: {}, activeDeckId: s.deckId,
      stats: { totalRounds: 0, totalAnswered: 0, bySentence: by },
      settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
        sound: false, fxStack: false, celebrate: 'off', autoSpeak: false, darkMode: false }
    }));
    sessionStorage.setItem('_startDeck', JSON.stringify(deck));
  };
}

const SENTENCE = 'The committee finally approved the budget.';
const CHUNKS = ['The committee', 'finally approved', 'the budget.'];

function readReviewPrompt(page) {
  return page.evaluate(function () {
    var text = document.body.innerText || '';
    return {
      exists: !!document.getElementById('schedLine'),
      visible: /下次复习\s*[:：]/.test(text),
      stageHasPromptRow: !!document.querySelector('#stage .sched-line')
    };
  });
}

/* 答对当前句，直到答题结束（下一题按钮出现） */
async function answerSentence(page) {
  for (let guard = 0; guard < 60; guard++) {
    const st = await page.evaluate(function () {
      if (typeof cur !== 'function') return { booting: true };
      var it = cur();
      if (!it) return { booting: true };
      var nb = document.getElementById('btnNext');
      return {
        target: (S.chunkIdx < it.chunks.length) ? it.chunks[S.chunkIdx] : null,
        finished: !!(nb && !nb.classList.contains('hidden'))
      };
    });
    if (st.finished) return true;
    if (st.booting || st.target === null) { await page.waitForTimeout(150); continue; }
    const hit = await page.evaluate(function (t) {
      var btns = Array.prototype.slice.call(document.querySelectorAll('#stageChoices .choice'));
      var b = btns.filter(function (x) { return !x.disabled && x.dataset.v === t; })[0];
      if (b) { b.click(); return true; }
      return false;
    }, st.target);
    await page.waitForTimeout(hit ? 240 : 150);
  }
  return false;
}

async function boot(browser, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  await page.route('**/content/**', function (r) { r.abort('failed'); });
  await page.addInitScript(makeInit(seed), seed);
  await page.goto(BASE + '/main.html?answer-hint-test=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(function () { return window._mainBooted && window.mem && typeof window.startDeck === 'function'; });
  await page.evaluate(async function () {
    await CourseEnrollment.join('user-deck:' + window.mem.decks[0].id);
    startDeck(window.mem.decks[0], 0);
  });
  try { await page.waitForSelector('#stageChoices .choice', { timeout: 15000 }); }
  catch (e) {
    console.error('E2E bootstrap diagnostics:', JSON.stringify({ url: page.url(), errors: errs,
      text: (await page.locator('body').innerText().catch(function () { return ''; })).slice(0, 500) }));
    throw e;
  }
  await page.waitForTimeout(600);
  return { ctx: ctx, page: page, errs: errs };
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });

    /* ===== A：作答前后都不显示排期提示 ===== */
    console.log('【场景 A：练习界面不显示下次复习提示】');
    {
      const s = await boot(browser, { deckId: 'srs-probe', sentence: SENTENCE, translation: '委员会最终批准了预算。', chunks: CHUNKS });
      const before = await readReviewPrompt(s.page);
      check('A1 出题态没有排期提示元素或空行', !before.exists && !before.visible && !before.stageHasPromptRow,
        JSON.stringify(before));

      const answered = await answerSentence(s.page);
      const after = await readReviewPrompt(s.page);
      check('A2 答完一句后练习正常结束', answered === true);
      check('A3 答完后仍无排期提示元素或空行', !after.exists && !after.visible && !after.stageHasPromptRow,
        JSON.stringify(after));
      check('A4 无 JS 运行时错误', s.errs.length === 0, s.errs.join(' | '));
      await s.ctx.close();
    }

    await browser.close();
    stopServer();
    console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error(e);
    if (browser) { try { await browser.close(); } catch (x) {} }
    stopServer();
    process.exit(1);
  }
})();
