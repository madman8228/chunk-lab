/* home-today-entries.test.js · 首页「今日」两张计数卡即入口
 *
 * 背景：原实现 if(due>0){只渲染一个「开始到期复习」主按钮} else {weak/book 按钮} ——
 *   入口与数据不同构，永远有一张卡没入口，且哪张会死随天数漂移。
 *   现两张计数卡本身就是 <button>，各自进对应队列；计数 0 的卡 disabled（点不动，纯装饰数字）。
 *
 * 覆盖（真实浏览器 + 自带 server，端口走 free-port 避开宿主机常驻占用）：
 *   1. 注入 1 到期 + 1 需巩固 + 0 错题本：只显示待复习/错题本两张卡，due 启用、book 禁用；
 *      enabled 卡有 .chev（<svg>，非文本字符），disabled 卡 .chev 不可见；
 *      disabled book 背景 == var(--surface)（去底色生效），enabled due 背景 != --surface。
 *   2. 点 #homeBtnDue → #deckName 含「到期复习」；需巩固不再作为独立入口。
 *   3. 负向自证（必需）：注入到期计数=0 → #homeBtnDue 必须 disabled；
 *      在旧 main.html（git worktree HEAD）上跑本文件必须变红（旧代码 due=0 时
 *      #homeBtnDue 根本不渲染 → 本断言抓不到它，证明测试真的在测东西）。
 *
 * ⚠ 注入 stats 必须走独立 browser context：stats 大对象已迁 IDB，localStorage.clear()
 *   不再能重置统计；每场景新建 context，互不污染。
 * ⚠ 自带 server 用 free-port 选端口（宿主机 8933 被占、9042/9128 僵尸监听）。
 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9500, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-home-today-'));
const OUT_DIR = path.join(ROOT, 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });
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

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

/* 逐场景独立 context 注入 stats（本地模式：abort /api，不拉云不覆盖注入数据）。
   /content 不 abort：ContentRepo 加载 manifest 后 ensureDeck('d1') 对「非内置 id」直接回退注入牌组，
   不会 404；且内置牌组无 bySentence，不会污染 due/weak 计数。 */
async function scenarioPage(browser, initFn, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  await page.route('**/content/**', function (r) { r.abort('failed'); });
  await page.addInitScript(initFn);
  await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#homeBody', { timeout: 10000 });
  await page.waitForTimeout(900);
  return { ctx: ctx, page: page };
}

/* 句子档案 key 在 loadStore 时会被规范为 deckId#cid(句子) = deckId#fnv8(sentence)
 * （migrateCidKeys），显式 cid 不参与最终 key。故注入时 bySentence 的 key 必须按
 * fnv8(sentence) 构造，且 deck item 的 cid 也用同一值，才能与 CL.cidKey 对齐、
 * 让 startTodayDue 的 items 匹配命中。（fnv8 已内联进每个 init 函数：
 * addInitScript 只序列化被传函数，模块级 helper 不会随之一起进浏览器。） */

function initOneDueOneWeak() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var sDue = 'Due sentence one.';
  var sWeak = 'Weak sentence one.';
  var cDue = fnv8(sDue), cWeak = fnv8(sWeak);
  var by = {};
  by['d1#' + cDue] = { deckId: 'd1', deckName: '测试题库', sentence: sDue, translation: '到期的句子一。', chunks: ['Due', 'sentence one.'], hints: ['', ''], times: 1, okTimes: 1, wrongTimes: 0, streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now - 10000 };
  by['d1#' + cWeak] = { deckId: 'd1', deckName: '测试题库', sentence: sWeak, translation: '需巩固的句子一。', chunks: ['Weak', 'sentence one.'], hints: ['', ''], times: 2, okTimes: 1, wrongTimes: 1, streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now + 86400000 };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '测试题库', items: [
      { sentence: sDue, translation: '到期的句子一。', chunks: ['Due', 'sentence one.'], hints: ['', ''], cid: cDue },
      { sentence: sWeak, translation: '需巩固的句子一。', chunks: ['Weak', 'sentence one.'], hints: ['', ''], cid: cWeak }
    ] }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 1, totalAnswered: 1, bySentence: by },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: true, celebrate: 'confetti', autoSpeak: false, darkMode: false }
  }));
}

function initZeroDue() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var sDue = 'Due sentence one.';
  var cDue = fnv8(sDue);
  var by = {};
  /* dueAt 设在未来 → 不到期；acc=1.0 → 非 weak。结果 due=0 / weak=0 / book=0 */
  by['d1#' + cDue] = { deckId: 'd1', deckName: '测试题库', sentence: sDue, times: 1, okTimes: 1, wrongTimes: 0, streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now + 86400000 };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '测试题库', items: [
      { sentence: sDue, chunks: ['Due', 'sentence one.'], hints: ['', ''], cid: cDue }
    ] }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 1, totalAnswered: 1, bySentence: by },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
  }));
}

function initBookOnly() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var sentence = 'Book sentence one.';
  var cid = fnv8(sentence);
  var by = {};
  by['d1#' + cid] = { deckId: 'd1', deckName: '测试题库', sentence: sentence, translation: '错题句子一。', chunks: ['Book', 'sentence one.'], hints: ['', ''], times: 1, okTimes: 0, wrongTimes: 1, streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now + 86400000 };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '测试题库', items: [
      { sentence: sentence, translation: '错题句子一。', chunks: ['Book', 'sentence one.'], hints: ['', ''], cid: cid }
    ] }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [{
      _key: 'd1::' + sentence, deckId: 'd1', deckName: '测试题库', sentence: sentence,
      translation: '错题句子一。', chunks: ['Book', 'sentence one.'], hints: ['', ''], mistakes: [{ chunkIdx: 0, chunk: 'Book', userAnswer: '', hint: '' }]
    }],
    stats: { totalRounds: 1, totalAnswered: 1, bySentence: by },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: true, celebrate: 'confetti', autoSpeak: false, darkMode: false }
  }));
}

/* 自包含（addInitScript 只序列化被传函数体，不能引用模块级变量/函数） */
function initBig() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  var dueN = 38, weakN = 3;
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var by = {};
  var i, s, c;
  for (i = 0; i < dueN; i++) {
    s = 'Due ' + i; c = fnv8(s);
    by['d1#' + c] = { deckId: 'd1', deckName: '测试题库', sentence: s, times: 3, okTimes: 3, wrongTimes: 0, streak: 3, maxStreak: 3, lastAt: now, interval: 1, ease: 2.5, dueAt: now - 10000 };
  }
  for (i = 0; i < weakN; i++) {
    s = 'Weak ' + i; c = fnv8(s);
    by['d1#' + c] = { deckId: 'd1', deckName: '测试题库', sentence: s, times: 2, okTimes: 1, wrongTimes: 1, streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now + 86400000 };
  }
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '测试题库', items: [{ sentence: 'Due 0', chunks: ['Due', '0'], hints: ['', ''], cid: fnv8('Due 0') }] }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 1, totalAnswered: 1, bySentence: by },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
  }));
}

function stripComments(s) { return (s || '').replace(/<!--[\s\S]*?-->/g, ''); }

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

    /* ===== 场景 A：1 到期 + 1 需巩固 + 0 错题本 ===== */
    {
      const sp = await scenarioPage(browser, initOneDueOneWeak);
      const page = sp.page;
      const errs = [];
      page.on('pageerror', function (e) { errs.push(e.message); });
      const st = await page.evaluate(function () {
        var due = document.getElementById('homeBtnDue');
        var book = document.getElementById('homeBtnBook');
        /* 用探针把 CSS 变量解析成 rgb，避免硬编码颜色（--surface 实为 #fffdfa，非纯白） */
        var probe = document.createElement('div');
        document.body.appendChild(probe);
        probe.style.background = 'var(--surface)';
        var surfaceBg = getComputedStyle(probe).backgroundColor;
        probe.style.background = 'var(--accent-soft)';
        var accentBg = getComputedStyle(probe).backgroundColor;
        probe.remove();
        function chevInfo(btn) {
          if (!btn) return { exists: false, svg: false, isSvg: false, text: '', visible: false };
          var c = btn.querySelector('.chev');
          if (!c) return { exists: false, svg: false, isSvg: false, text: '', visible: false };
          var svg = c.querySelector('svg');
          return {
            exists: true,
            svg: !!svg,
            isSvg: !!svg && svg.tagName.toLowerCase() === 'svg',
            text: (c.textContent || '').trim(),
            visible: getComputedStyle(c).display !== 'none'
          };
        }
        return {
          dueExists: !!due, weakExists: !!document.getElementById('homeBtnWeak'), bookExists: !!book,
          dueDisabled: due ? due.disabled : null,
          bookDisabled: book ? book.disabled : null,
          dueChev: chevInfo(due),
          bookChev: chevInfo(book),
          dueBg: due ? getComputedStyle(due).backgroundColor : '',
          bookBg: book ? getComputedStyle(book).backgroundColor : '',
          surfaceBg: surfaceBg, accentBg: accentBg
        };
      });
      check('A: 只显示待复习和错题本两张卡', st.dueExists && !st.weakExists && st.bookExists, JSON.stringify({ d: st.dueExists, w: st.weakExists, b: st.bookExists }));
      check('A: #homeBtnDue 不是 disabled（due>0 可点）', st.dueExists && st.dueDisabled === false, 'disabled=' + st.dueDisabled);
      check('A: #homeBtnBook 是 disabled（book=0 不可点）', st.bookExists && st.bookDisabled === true, 'disabled=' + st.bookDisabled);
      check('A: #homeBtnDue 有 .chev 且内含 <svg>', st.dueChev.exists && st.dueChev.isSvg, JSON.stringify(st.dueChev));
      check('A: #homeBtnDue 的 .chev 不是文本字符', st.dueChev.exists && st.dueChev.text === '' && st.dueChev.isSvg, 'text=' + JSON.stringify(st.dueChev.text));
      check('A: #homeBtnBook 无可见 .chev（0 值去箭头）', st.bookChev.exists === false || st.bookChev.visible === false, JSON.stringify(st.bookChev));
      check('A: disabled #homeBtnBook 背景 == var(--surface)（去底色生效）',
        st.bookBg && st.surfaceBg && st.bookBg === st.surfaceBg,
        'bookBg=' + st.bookBg + ' surfaceBg=' + st.surfaceBg);
      check('A: enabled #homeBtnDue 背景 != var(--surface)（仍带强调色）',
        st.dueBg && st.surfaceBg && st.dueBg !== st.surfaceBg,
        'dueBg=' + st.dueBg + ' surfaceBg=' + st.surfaceBg);

      /* 点击 due → 进入到期复习队列（#deckName 含「到期复习」） */
      let dueOk = false;
      let dueDbg = {};
      try {
        await page.click('#homeBtnDue', { timeout: 5000 });
        await page.waitForFunction(function () {
          var d = document.getElementById('deckName');
          return d && /到期复习/.test(d.textContent.replace(/<!--[\s\S]*?-->/g, ''));
        }, { timeout: 8000 });
        dueOk = true;
      } catch (e) { dueOk = false; }
      dueDbg = await page.evaluate(function () {
        var d = document.getElementById('deckName');
        var pp = document.getElementById('pagePractice');
        return {
          deckName: d ? d.textContent.replace(/<!--[\s\S]*?-->/g, '') : 'missing',
          practiceHidden: pp ? pp.classList.contains('hidden') : 'missing',
          zh: (document.getElementById('zh') || {}).textContent || ''
        };
      });
      check('A: 点 #homeBtnDue → #deckName 含「到期复习」', dueOk, JSON.stringify(dueDbg));

      check('A: 需巩固不再生成独立首页入口', await page.evaluate(function () { return !document.getElementById('homeBtnWeak'); }), 'homeBtnWeak=' + !!(await page.$('#homeBtnWeak')));
      check('A: 零 pageerror', errs.length === 0, errs.join(' | '));
      await sp.ctx.close();
    }

    /* ===== 场景 B：负向自证（due=0 → #homeBtnDue 必须 disabled） ===== */
    {
      const sp = await scenarioPage(browser, initZeroDue);
      const page = sp.page;
      const st = await page.evaluate(function () {
        var due = document.getElementById('homeBtnDue');
        return { dueExists: !!due, dueDisabled: due ? due.disabled : null };
      });
      /* 新代码：due=0 → disabled 且存在（绿）。
         旧代码：due=0 走 else 分支，#homeBtnDue 根本不渲染 → dueExists=false（红，证明测试抓得住回归）。 */
      check('B: 负向自证 · due=0 时 #homeBtnDue 必须存在且 disabled',
        st.dueExists && st.dueDisabled === true, JSON.stringify(st));
      await sp.ctx.close();
    }

    /* ===== 场景 C：移动端入口/可访问性（360 + 390，book>0） ===== */
    for (const viewport of [{ width: 360, height: 740 }, { width: 390, height: 844 }]) {
      const sp = await scenarioPage(browser, initBookOnly, viewport);
      const page = sp.page;
      const errors = [];
      const rangeErrors = [];
      page.on('pageerror', function (e) {
        errors.push(e.message);
        if (/Range|selectNodeContents/i.test(e.message)) rangeErrors.push(e.message);
      });
      page.on('console', function (msg) {
        if (/Range|selectNodeContents/i.test(msg.text())) rangeErrors.push(msg.text());
      });
      const mobile = await page.evaluate(function () {
        var root = document.documentElement;
        var ids = ['homeBtnDue', 'homeBtnBook'];
        var cards = {};
        ids.forEach(function (id) {
          var el = document.getElementById(id);
          var r = el && el.getBoundingClientRect();
          cards[id] = el ? {
            disabled: el.disabled,
            type: el.getAttribute('type'),
            tabIndex: el.tabIndex,
            width: r ? r.width : 0,
            height: r ? r.height : 0,
            text: (el.textContent || '').trim()
          } : null;
        });
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          cards: cards,
          bookText: (document.getElementById('homeBtnBook') || {}).textContent || ''
        };
      });
      var book = mobile.cards.homeBtnBook;
      var label = viewport.width + 'px';
      check('C ' + label + ': 页面无横向溢出', mobile.scrollWidth <= mobile.clientWidth, JSON.stringify({ scrollWidth: mobile.scrollWidth, clientWidth: mobile.clientWidth }));
      check('C ' + label + ': 错题本计数卡存在且可点', !!book && book.disabled === false && /错题本/.test(mobile.bookText), JSON.stringify(book));
      check('C ' + label + ': 两张卡保持原生按钮语义', ['homeBtnDue', 'homeBtnBook'].every(function (id) { var c = mobile.cards[id]; return c && c.type === 'button' && c.tabIndex >= 0; }), JSON.stringify(mobile.cards));
      check('C ' + label + ': 可用卡点击区域至少 44×44', !!book && book.width >= 44 && book.height >= 44, JSON.stringify({ width: book && book.width, height: book && book.height }));

      var keyboardOk = false;
      var keyboardDbg = {};
      try {
        await page.locator('#homeBtnBook').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(function () {
          var d = document.getElementById('deckName');
          return d && /错题/.test(d.textContent.replace(/<!--[\s\S]*?-->/g, ''));
        }, { timeout: 8000 });
        keyboardOk = true;
      } catch (e) {}
      keyboardDbg = await page.evaluate(function () {
        var d = document.getElementById('deckName');
        var p = document.getElementById('pagePractice');
        return { deckName: d ? d.textContent.replace(/<!--[\s\S]*?-->/g, '') : 'missing', practiceHidden: p ? p.classList.contains('hidden') : 'missing' };
      });
      check('C ' + label + ': 错题本卡支持键盘 Enter 进入练习', keyboardOk, JSON.stringify(keyboardDbg));
      check('C ' + label + ': 无 Range/selectNodeContents 错误', rangeErrors.length === 0, rangeErrors.join(' | '));
      check('C ' + label + ': 无页面脚本异常', errors.length === 0, errors.join(' | '));
      await sp.ctx.close();
    }

    /* ===== 场景 D：截图（38 到期 / 3 需巩固 / 0 错题本） ===== */
    {
      const sp = await scenarioPage(browser, initBig);
      const page = sp.page;
      try {
        const card = await page.locator('.home-card').first();
        await card.screenshot({ path: path.join(OUT_DIR, 'home-today.png') });
        console.log('  · 截图已存 output/home-today.png');
      } catch (e) {
        console.log('  ✗ 截图失败 → ' + (e && e.message || e));
      }
      await sp.ctx.close();
    }

    await browser.close();
    browser = null;
    stopServer();
    console.log('\n[home-today-entries e2e] passed=' + passed + ' failed=' + failed);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
    console.error('[home-today-entries e2e] FAIL: ' + (err && err.stack || err));
    process.exit(1);
  }
})();
