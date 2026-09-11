/**
 * home-counts-center-verify.js · 首页「今日概览」三张卡片（.htc）数字横向居中（2026-09-11）
 *
 * 老板截图要求：到期复习 / 需巩固 / 错题本 三张卡里的数字要横向居中。
 *
 * 根因：`.htc` 有 `min-width:110px`，而 `.n` / `.l` 都是**块级 div 默认贴左**。
 *   内容实际只有 ~46px 宽 → 数字孤零零缩在卡片左上角，和大片留白不成比例。
 *   修法：基础规则加 `text-align:center`（一次管住数字与标签）。
 *
 * ⚠️ 本套件的核心难点：**量"文字"而不是量"元素"**
 *   `.n` 是块级 div，本来就把卡片内容区撑满（element rect 的 cx 恒等于卡片 cx）——
 *   用 getBoundingClientRect 量元素，无论文字贴左还是居中都会"通过"，是个假绿的坑。
 *   必须用 Range.selectNodeContents() 取**文本盒**再比中线。
 *
 * 被本套件钉住的设计决策：
 *   - 数字**和**标签都要居中：只居中数字、标签仍贴左会立刻显歪（pairOff 断言）
 *   - 居中靠 text-align 继承，不给 .n / .l 单独写（避免两条规则日后走散）
 *
 * 运行：node output/e2e/home-counts-center-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

/* 端口：避开宿主机已占端口（共享工具，根因见 e2e/lib/free-port.js 头部注释） */
const PORT = require('../../e2e/lib/free-port').freePort(9020, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-htc-'));
let server = null;

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
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* retry */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server start timeout')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + detail : '')); }
}

const CHROMIUM = process.env.CHROMIUM_PATH ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';

/* 中线偏差容差：盒模型四舍五入 + 亚像素，1.5px 内视为居中 */
const TOL = 1.5;

/* 场景种子：对齐老板截图 —— 到期 7 / 需巩固 3 / 错题本 0
   · items[0..6]  → dueAt 已过期 = 到期（7 句）
   · items[0..2]  → 有错且正确率 0% = 需巩固（3 句，与 due 允许重叠）
   · items[7..9]  → dueAt 远期且全对 = 既不到期也不需巩固
   · reinforceBook=[] → 错题本 0（覆盖 .n.ok 绿色分支） */
const SEED = `
localStorage.clear();
(function(){
  var items = [];
  for(var i=0;i<10;i++){
    var c1='word'+(i*3+1), c2='word'+(i*3+2), c3='word'+(i*3+3);
    items.push({ sentence:c1+' '+c2+' '+c3+'.', translation:'句'+(i+1), chunks:[c1,c2,c3+'.'], hints:['','',''] });
  }
  /* cidKey = deckId + '#' + fnv8(sentence)（core.js cidKey）—— 必须在页面环境算，注入前拿不到 CL */
  function fnv8(str){
    var h = 0x811c9dc5;
    for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0; }
    return h.toString(16);
  }
  var now = Date.now(), by = {};
  for(var i=0;i<10;i++){
    var key = 'd1#' + fnv8(items[i].sentence);
    var due = i < 7;
    var weak = i < 3;
    by[key] = {
      deckId:'d1', sentence:items[i].sentence, translation:items[i].translation,
      times: weak ? 1 : 3,
      okTimes: weak ? 0 : 3,
      wrongTimes: weak ? 1 : 0,
      streak: weak ? 0 : 3, maxStreak: weak ? 0 : 3,
      interval:1, ease:2.5,
      dueAt: due ? now - 10000 : now + 30*86400000,
      lastAt: now - 100000
    };
  }
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, reinforceBook: [],
    decks: [{ id:'d1', name:'居中测试题库', items:items }],
    best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds:0, totalAnswered:10, bySentence: by, events:[], daysLog:{} },
    settings: { mode:'choose', shuffle:false, skipMastered:true, batchSize:10, fxStack:false, celebrate:'confetti', autoSpeak:false, sound:false }
  }));
})();`;

/* 量卡片：数字/标签用 Range 取「文本盒」，不是元素盒（见文件头 ⚠️ 说明） */
async function cardMetrics(pg) {
  return pg.evaluate(function () {
    function textBox(el) {
      var r = document.createRange();
      r.selectNodeContents(el);
      var b = r.getBoundingClientRect();
      return { left: b.left, right: b.right, w: b.width, cx: b.left + b.width / 2 };
    }
    var wrap = document.querySelector('.home-today-counts');
    var cards = [].slice.call(document.querySelectorAll('.home-today-counts .htc'));
    return {
      wrapExists: !!wrap,
      count: cards.length,
      cardTa: cards.length ? getComputedStyle(cards[0]).textAlign : null,
      items: cards.map(function (c) {
        var cr = c.getBoundingClientRect();
        var ccx = cr.left + cr.width / 2;
        var n = c.querySelector('.n');
        var l = c.querySelector('.l');
        var nb = textBox(n);
        var lb = l ? textBox(l) : null;
        return {
          cls: c.className.replace(/\bhtc\b/, '').trim(),
          num: n.textContent.trim(),
          cardW: Math.round(cr.width),
          cardH: Math.round(cr.height),
          cardCx: ccx,
          numW: nb.w,
          numOff: Math.abs(nb.cx - ccx),
          labOff: lb ? Math.abs(lb.cx - ccx) : null,
          /* 数字与标签互相居中：防「只居中数字、标签贴左」的半成品 */
          pairOff: lb ? Math.abs(nb.cx - lb.cx) : null,
          nTa: getComputedStyle(n).textAlign,
          lTa: l ? getComputedStyle(l).textAlign : null,
          numInside: nb.left >= cr.left - 0.5 && nb.right <= cr.right + 0.5,
          /* 数字是否只占卡片内容区一小部分（证明"贴左"曾经真的会歪） */
          numFillRatio: nb.w / cr.width
        };
      })
    };
  });
}

(async function main() {
  const BASE = 'http://127.0.0.1:' + PORT;
  let browser = null;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });

    /* ---------- [1] 源码守卫 ---------- */
    console.log('[1] 源码守卫：居中规则在位 + 不给 .n/.l 单独写（防规则走散）');
    const src = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const htcLine = (src.match(/^\.htc\{[^}]*\}/m) || [''])[0];
    const wrapLine = (src.match(/^\.home-today-counts\{[^}]*\}/m) || [''])[0];
    check('.htc 基础规则含 text-align:center', /text-align:center/.test(htcLine), htcLine.slice(0, 120));
    check('防回流：宽度约束在容器上（grid 3 等分 + max-width:350px ⇒ 宽屏列宽仍 110px）',
      /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(wrapLine) && /max-width:350px/.test(wrapLine),
      wrapLine.slice(0, 160));
    check('防回流：.htc 不写死固定宽（固定 min-width 正是手机折行根因；grid 项必须可压缩）',
      /min-width:0/.test(htcLine) && !/min-width:1[0-9][0-9]px/.test(htcLine), htcLine.slice(0, 160));
    check('.htc .n 未单独覆盖 text-align（居中靠继承，避免两处规则走散）',
      !/^\.htc \.n\{[^}]*text-align/m.test(src));
    check('.htc .l 未单独覆盖 text-align', !/^\.htc \.l\{[^}]*text-align/m.test(src));

    /* ---------- [2] 运行时：三张卡片的文字中线 ---------- */
    console.log('[2] 运行时：数字/标签文字盒相对卡片中线');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript({ content: SEED });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', function (e) { errs.push(String(e)); });
    page.on('console', function (m) {
      /* 本套件**故意** abort 了 /api/**（隔离云同步噪声）→ net::ERR_FAILED 是我们自己造成的 */
      if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text());
    });
    await page.route('**/api/**', function (r) { r.abort('failed'); });
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home-today-counts .htc', { timeout: 10000 });
    await page.waitForTimeout(300);

    const m = await cardMetrics(page);
    check('三张卡片都渲染出来了', m.count === 3, JSON.stringify({ count: m.count }));
    check('卡片计算样式 text-align:center', m.cardTa === 'center', m.cardTa);

    const byCls = {};
    m.items.forEach(function (it) { byCls[it.cls] = it; });
    const names = { due: '待复习', weak: '需巩固', book: '错题本' };

    /* 场景对齐老板截图，顺带确认种子真的生效（否则下面全是空卡片空断言） */
    check('种子生效：待复习 = 7', byCls.due && byCls.due.num === '7', byCls.due && byCls.due.num);
    check('种子生效：需巩固 = 3', byCls.weak && byCls.weak.num === '3', byCls.weak && byCls.weak.num);
    check('种子生效：错题本 = 0', byCls.book && byCls.book.num === '0', byCls.book && byCls.book.num);

    ['due', 'weak', 'book'].forEach(function (k) {
      const it = byCls[k];
      if (!it) { check(names[k] + '：卡片存在', false, 'missing'); return; }
      check(names[k] + '：数字横向居中（文字盒中线偏差 ≤ ' + TOL + 'px）',
        it.numOff <= TOL, JSON.stringify({ num: it.num, numOff: +it.numOff.toFixed(2), cardW: it.cardW }));
      check(names[k] + '：标签横向居中（同一 text-align 继承）',
        it.labOff !== null && it.labOff <= TOL,
        JSON.stringify({ labOff: it.labOff === null ? null : +it.labOff.toFixed(2) }));
      check(names[k] + '：数字与标签互相对齐（防"只居中数字、标签贴左"）',
        it.pairOff !== null && it.pairOff <= TOL,
        JSON.stringify({ pairOff: it.pairOff === null ? null : +it.pairOff.toFixed(2) }));
      check(names[k] + '：数字未溢出卡片', it.numInside, JSON.stringify(it));
      check(names[k] + '：数字宽度只占卡片一小部分（证明"贴左"确实会明显歪）',
        it.numFillRatio > 0 && it.numFillRatio < 0.4,
        'ratio=' + it.numFillRatio.toFixed(3));
      /* .n / .l 应继承 center（而不是被别处规则改回 left） */
      check(names[k] + '：.n / .l 计算样式继承 center',
        it.nTa === 'center' && it.lTa === 'center', JSON.stringify({ nTa: it.nTa, lTa: it.lTa }));
    });

    /* 卡片高度未被居中改动破坏（居中只应影响水平，不该把卡片压扁/撑高） */
    const heights = m.items.map(function (i) { return i.cardH; });
    check('三张卡片高度一致（居中只影响水平，不该改纵向）',
      heights.length === 3 && Math.max.apply(null, heights) - Math.min.apply(null, heights) <= 2,
      JSON.stringify(heights));
    check('宽屏（1280）下列宽仍为 110px —— 1 行网格改造后桌面观感逐像素不变',
      m.items.every(function (i) { return i.cardW >= 108 && i.cardW <= 112; }),
      JSON.stringify(m.items.map(function (i) { return i.cardW; })));

    /* ---------- [3] 截图（老板验收要看的就是这块） ---------- */
    console.log('[3] 截图');
    await page.locator('.home-today-counts').screenshot({ path: path.join(SHOTS, 'home-counts-center.png') });
    await page.screenshot({ path: path.join(SHOTS, 'home-counts-center-full.png') });
    console.log('  截图 → shots/home-counts-center.png（卡片特写）/ home-counts-center-full.png（整页）');

    check('零 pageerror / console.error', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  } finally {
    if (browser) { try { await browser.close(); } catch (e) { /* noop */ } }
    stopServer();
  }

  console.log('\n全部通过：通过 ' + passed + ' / ' + failed + ' 失败');
  if (failed) process.exitCode = 1;
})();
