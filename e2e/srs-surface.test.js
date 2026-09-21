/**
 * srs-surface.test.js · SRS 白盒化的端到端护栏
 *
 * 背景：`CL.srs.dueLabel` 早就写好还有单测，但**产品 UI 一次都没调用** ——
 * 用户答完一句后看不到「下次什么时候考、现在在记忆曲线第几格」，
 * 于是 SRS 在体验上是个黑盒（会误判成「怎么又考这句」）。
 * 本用例守住三个事实：
 *   1. 出题态不显示排期行（新句子开始时必须复位）
 *   2. 答完一句后显示「下次复习:X天后」，且天数由真实 SRS 状态推出
 *   3. 该行的可见性是真被测量的 —— 用 !important 隐藏它，断言必须变红（负向自证）
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
function makeInit(seed) {
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
    if (s.hideSched) {
      var css = '.sched-line{display:none !important}';
      var add = function () { var st = document.createElement('style'); st.setAttribute('data-negtest', '1'); st.textContent = css; (document.head || document.documentElement).appendChild(st); };
      if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    }
  };
}

const SENTENCE = 'The committee finally approved the budget.';
const CHUNKS = ['The committee', 'finally approved', 'the budget.'];

function readSchedLine(page) {
  return page.evaluate(function () {
    var el = document.getElementById('schedLine');
    if (!el) return { exists: false, visible: false, text: '' };
    return {
      exists: true,
      visible: el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none',
      text: (el.textContent || '').trim()
    };
  });
}

/* 答对当前句，直到排期行出现（或句子结束） */
async function answerUntilSched(page) {
  for (let guard = 0; guard < 60; guard++) {
    const line = await readSchedLine(page);
    if (line.visible) return line;
    const st = await page.evaluate(function () {
      if (!window.S) return { booting: true };
      if (S.finished) return { finished: true };
      if (typeof cur !== 'function') return { booting: true };
      var it = cur();
      if (!it) return { booting: true };
      var nb = document.getElementById('btnNext');
      return {
        target: (S.chunkIdx < it.chunks.length) ? it.chunks[S.chunkIdx] : null,
        nbVisible: !!(nb && !nb.classList.contains('hidden'))
      };
    });
    if (st.finished) break;
    if (st.booting || st.target === null) { await page.waitForTimeout(150); continue; }
    const hit = await page.evaluate(function (t) {
      var btns = Array.prototype.slice.call(document.querySelectorAll('#stageChoices .choice'));
      var b = btns.filter(function (x) { return !x.disabled && x.dataset.v === t; })[0];
      if (b) { b.click(); return true; }
      return false;
    }, st.target);
    await page.waitForTimeout(hit ? 240 : 150);
  }
  return readSchedLine(page);
}

async function boot(browser, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  await page.route('**/content/**', function (r) { r.abort('failed'); });
  await page.addInitScript(makeInit(seed), seed);
  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stageChoices .choice', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx: ctx, page: page, errs: errs };
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });

    /* ===== A：首次练这句（无历史） ===== */
    console.log('【场景 A：首次练这句，无历史 SRS 状态】');
    {
      const s = await boot(browser, { deckId: 'srs-probe', sentence: SENTENCE, translation: '委员会最终批准了预算。', chunks: CHUNKS });
      const before = await readSchedLine(s.page);
      check('A1 出题态不显示排期行（新句子已复位）', before.exists && before.visible === false,
        'exists=' + before.exists + ' visible=' + before.visible);

      const after = await answerUntilSched(s.page);
      check('A2 答完一句后显示排期行', after.visible === true, 'visible=' + after.visible + ' text="' + after.text + '"');
      check('A3 文案 = 下次复习:1天后', after.text === '下次复习:1天后', '实际 "' + after.text + '"');
      check('A4 文案结构恒为「下次复习:X天后」', /^下次复习:(\d+天后|今天|逾期\d+天)$/.test(after.text), '实际 "' + after.text + '"');
      check('A5 无 JS 运行时错误', s.errs.length === 0, s.errs.join(' | '));
      await s.ctx.close();
    }

    /* ===== B：已有 2 次连对（repetition=2 / interval=3）→ 再答对应进入第 3 阶段 7 天 ===== */
    console.log('【场景 B：已有重复次数 2，答对后应推进到第 3 阶段】');
    {
      const s = await boot(browser, {
        deckId: 'srs-probe', sentence: SENTENCE, translation: '委员会最终批准了预算。', chunks: CHUNKS,
        prior: { repetition: 2, interval: 3, ease: 2.5, dueAt: Date.now() - 3600000 }
      });
      const after = await answerUntilSched(s.page);
      check('B1 文案 = 下次复习:7天后', after.text === '下次复习:7天后', '实际 "' + after.text + '"');
      await s.ctx.close();
    }

    /* ===== C：负向自证 —— 用 !important 隐藏该行，可见性断言必须变红 ===== */
    console.log('【场景 C：负向自证（注入 .sched-line{display:none!important}）】');
    {
      const s = await boot(browser, {
        deckId: 'srs-probe', sentence: SENTENCE, translation: '委员会最终批准了预算。', chunks: CHUNKS,
        hideSched: true
      });
      const after = await answerUntilSched(s.page);
      const styleInjected = await s.page.evaluate(function () { return !!document.querySelector('style[data-negtest]'); });
      check('C1 覆盖样式确实注入了', styleInjected === true);
      check('C2 被隐藏后可见性断言变红（证明 A2 不是恒真）', after.visible === false,
        'visible=' + after.visible + '（若为 true 说明探针测不到隐藏，A2 无意义）');
      check('C3 文本仍在（说明 A2 测的是可见性、不是文本有无）', after.text.length > 0, 'text="' + after.text + '"');
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
