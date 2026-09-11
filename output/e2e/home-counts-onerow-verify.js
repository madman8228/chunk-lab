/**
 * home-counts-onerow-verify.js · 首页「今日概览」三张卡（.htc）恒定 1 行 + 标签改「待复习」（2026-09-11）
 *
 * 老板截图：390/360 宽的手机上三张卡折成 2 行（7 待复习 / 3 需巩固 在第一行，
 *   0 错题本 掉到第二行），并要把卡片标签「到期复习」改成「待复习」。
 *
 * 根因（不是"间距大"，是**固定宽 + 折行容器**）：
 *   `.home-today-counts{display:flex;flex-wrap:wrap}` + `.htc{min-width:110px}`
 *   → 3 张卡需要 110×3 + gap 10×2 = **350px**，而窄屏容器只有
 *     332px（390 屏）/ 302px（360 屏）/ 262px（320 屏）→ 第三张必然换行。
 *
 * 修法：容器改 3 列等分网格 `repeat(3,minmax(0,1fr))`（卡片可压缩 ⇒ 永不折行），
 *   并把容器 `max-width:350px` 钉住 —— 宽屏下列宽正好回到 110px，
 *   即**桌面观感与改动前逐像素一致**，只在窄屏让出宽度。
 *
 * ⚠️ 本套件的两个易踩坑（都做了防呆）：
 *  1. 「1 行」必须用**卡片盒 top 分组**判定，不能看容器高度（卡片高度会随字体变化）。
 *  2. 断言必须能变红：内部会**注入旧 CSS**（flex+wrap+min-width:110px !important）
 *     自证探针有灵敏度，否则"恒定 1 行"可能只是探针瞎了（假绿）。
 *
 * 运行：node output/e2e/home-counts-onerow-verify.js
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
const PORT = require('../../e2e/lib/free-port').freePort(9060, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-onerow-'));
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

/* 场景种子：对齐老板截图 —— 待复习 7 / 需巩固 3 / 错题本 0
   （0 错题本 = 绿色 .n.ok 分支，数字位数也和截图一致：一位数） */
const SEED = `
localStorage.clear();
(function(){
  var items = [];
  for(var i=0;i<10;i++){
    var c1='word'+(i*3+1), c2='word'+(i*3+2), c3='word'+(i*3+3);
    items.push({ sentence:c1+' '+c2+' '+c3+'.', translation:'句'+(i+1), chunks:[c1,c2,c3+'.'], hints:['','',''] });
  }
  function fnv8(str){
    var h = 0x811c9dc5;
    for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0; }
    return h.toString(16);
  }
  var now = Date.now(), by = {};
  for(var i=0;i<10;i++){
    var key = 'd1#' + fnv8(items[i].sentence);
    by[key] = {
      deckId:'d1', sentence:items[i].sentence, translation:items[i].translation,
      times: i<3?1:3, okTimes: i<3?0:3, wrongTimes: i<3?1:0,
      streak: i<3?0:3, maxStreak: i<3?0:3, interval:1, ease:2.5,
      dueAt: i<7 ? now-10000 : now+30*86400000, lastAt: now-100000
    };
  }
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version:2, reinforceBook:[],
    decks:[{ id:'d1', name:'1行测试题库', items:items }],
    best:{}, mastered:{}, deletedItems:{},
    stats:{ totalRounds:0, totalAnswered:10, bySentence:by, events:[], daysLog:{} },
    settings:{ mode:'choose', shuffle:false, skipMastered:true, batchSize:10, fxStack:false, celebrate:'confetti', autoSpeak:false, sound:false }
  }));
})();`;

/* 旧 CSS（折行根因），用于自证探针灵敏度：注入后 360px 视口必须重新变 2 行 */
const OLD_CSS = `
.home-today-counts{display:flex !important;flex-wrap:wrap !important;max-width:none !important;grid-template-columns:none !important}
.htc{min-width:110px !important}
`;

/* 量「卡片盒 top 分组」+ 文字盒是否越界（用 Range 取文本盒，不用元素盒） */
async function rowMetrics(pg) {
  return pg.evaluate(function () {
    function textBox(el) {
      if (!el) return null;
      var r = document.createRange();
      r.selectNodeContents(el);
      var b = r.getBoundingClientRect();
      return { left: b.left, right: b.right, w: b.width };
    }
    var wrap = document.querySelector('.home-today-counts');
    if (!wrap) return { wrapExists: false };
    var wr = wrap.getBoundingClientRect();
    var cards = [].slice.call(wrap.querySelectorAll('.htc'));
    var items = cards.map(function (c) {
      var r = c.getBoundingClientRect();
      var n = c.querySelector('.n'), l = c.querySelector('.l');
      var nb = textBox(n), lb = textBox(l);
      return {
        cls: c.className.replace(/\bhtc\b/, '').trim(),
        num: n ? n.textContent.trim() : null,
        label: l ? l.textContent.trim() : null,
        w: +r.width.toFixed(1), left: +r.left.toFixed(1), top: +r.top.toFixed(1),
        right: +r.right.toFixed(1),
        numFits: !!nb && nb.left >= r.left - 0.5 && nb.right <= r.right + 0.5,
        labFits: !!lb && lb.left >= r.left - 0.5 && lb.right <= r.right + 0.5
      };
    });
    /* 行数 = 不同 top 分组数（1px 容差） */
    var tops = [];
    items.forEach(function (it) {
      if (!tops.some(function (t) { return Math.abs(t - it.top) <= 1; })) tops.push(it.top);
    });
    return {
      wrapExists: true,
      vw: window.innerWidth,
      wrapW: +wr.width.toFixed(1),
      wrapRight: +wr.right.toFixed(1),
      rows: tops.length,
      items: items,
      /* 横向溢出：容器/卡片/文档都不该超出视口右边 */
      cardOverflowRight: Math.max.apply(null, [0].concat(items.map(function (it) { return it.right - wr.right; }))),
      docOverflow: document.documentElement.scrollWidth - window.innerWidth
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
    console.log('[1] 源码守卫：3 列等分网格 + 容器封顶 + 标签文案');
    const src = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const wrapLine = (src.match(/^\.home-today-counts\{[^}]*\}/m) || [''])[0];
    const htcLine = (src.match(/^\.htc\{[^}]*\}/m) || [''])[0];
    check('容器是 3 列等分网格（minmax(0,1fr) ⇒ 卡片可压缩，永不再折行）',
      /display:grid/.test(wrapLine) && /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(wrapLine),
      wrapLine.slice(0, 160));
    check('容器 max-width:350px（宽屏列宽钉回 110px，桌面观感不变）',
      /max-width:350px/.test(wrapLine), wrapLine.slice(0, 160));
    check('防回流：容器不再有 flex-wrap:wrap（那正是折行机制）',
      !/flex-wrap:wrap/.test(wrapLine), wrapLine.slice(0, 160));
    check('防回流：.htc 无固定 min-width（固定宽是折行根因），且显式 min-width:0（grid 项压缩必备）',
      /min-width:0/.test(htcLine) && !/min-width:[1-9][0-9]*px/.test(htcLine), htcLine.slice(0, 160));
    check('标签文案 = 待复习（不再是「到期复习」）',
      /<div class="l">待复习<\/div>/.test(src) && !/<div class="l">到期复习<\/div>/.test(src));

    /* ---------- [2] 运行时：多视口恒定 1 行 ---------- */
    console.log('[2] 运行时：1280 / 430 / 390 / 360 / 320 五个视口都必须 1 行');
    const VIEWS = [[1280, 900], [430, 900], [390, 844], [360, 800], [320, 700]];
    const seen = {};
    for (const [vw, vh] of VIEWS) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
      await ctx.addInitScript({ content: SEED });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', function (e) { errs.push(String(e)); });
      page.on('console', function (m) {
        /* 本套件**故意** abort 了 /api/**（隔离云同步噪声）→ net::ERR_FAILED 是自己造成的 */
        if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text());
      });
      await page.route('**/api/**', function (r) { r.abort('failed'); });
      await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.home-today-counts .htc', { timeout: 10000 });
      await page.waitForTimeout(250);

      const m = await rowMetrics(page);
      seen[vw] = m;
      const tag = '@' + vw + 'px';
      check(tag + ' 三张卡都渲染', m.wrapExists && m.items.length === 3,
        JSON.stringify({ wrapExists: m.wrapExists, n: m.items && m.items.length }));
      check(tag + ' 恒定 1 行（不是 2 行）', m.rows === 1,
        'rows=' + m.rows + ' tops=' + JSON.stringify(m.items.map(function (i) { return i.top; })));
      const ws = m.items.map(function (i) { return i.w; });
      check(tag + ' 三张卡等宽（网格平分，差 ≤ 1px）',
        Math.max.apply(null, ws) - Math.min.apply(null, ws) <= 1, JSON.stringify(ws));
      check(tag + ' 数字/标签都没溢出卡片（窄屏压缩后仍放得下）',
        m.items.every(function (i) { return i.numFits && i.labFits; }),
        JSON.stringify(m.items.map(function (i) { return { w: i.w, numFits: i.numFits, labFits: i.labFits }; })));
      check(tag + ' 无横向溢出（卡片不超出容器、文档不出现横向滚动）',
        m.cardOverflowRight <= 0.5 && m.docOverflow <= 0, JSON.stringify({ cardOverflowRight: m.cardOverflowRight, docOverflow: m.docOverflow }));
      check(tag + ' 第一张卡标签 = 待复习，且全场不再出现「到期复习」',
        (function () {
          const due = m.items.filter(function (i) { return i.cls === 'due'; })[0];
          return !!due && due.label === '待复习' && m.items.every(function (i) { return i.label !== '到期复习'; });
        })(),
        JSON.stringify(m.items.map(function (i) { return i.cls + ':' + i.label; })));
      check(tag + ' 零 pageerror / console.error', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
      await ctx.close();
    }

    /* 桌面观感未变：1280 下每张卡仍是 110px（与改造前逐像素一致） */
    const wide = seen[1280];
    check('桌面（1280）列宽仍 110px —— 改造只影响窄屏，桌面观感零变化',
      wide && wide.items.every(function (i) { return i.w >= 108 && i.w <= 112; }),
      JSON.stringify(wide && wide.items.map(function (i) { return i.w; })));
    check('桌面（1280）容器宽度 == 350px（= 110×3 + 10×2）',
      wide && Math.abs(wide.wrapW - 350) <= 1, wide && wide.wrapW);
    /* 窄屏确实让出了宽度（证明压缩路径真的被走到，而不是没生效） */
    check('360px 视口卡片确实被压缩（< 110px）—— 证明 1 行是靠让宽换来的',
      seen[360] && seen[360].items.every(function (i) { return i.w < 110; }),
      JSON.stringify(seen[360] && seen[360].items.map(function (i) { return i.w; })));

    /* ---------- [3] 负向自证：探针必须能变红 ---------- */
    console.log('[3] 负向自证：注入旧 CSS（flex-wrap + min-width:110px）后必须重新变 2 行');
    {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
      await ctx.addInitScript({ content: SEED });
      const page = await ctx.newPage();
      await page.route('**/api/**', function (r) { r.abort('failed'); });
      await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.home-today-counts .htc', { timeout: 10000 });
      await page.waitForTimeout(200);
      const before = await rowMetrics(page);
      await page.addStyleTag({ content: OLD_CSS });
      await page.waitForTimeout(120);
      const after = await rowMetrics(page);
      check('注入前 1 行', before.rows === 1, 'rows=' + before.rows);
      check('注入旧 CSS 后变 2 行（⇒ [2] 里的 1 行断言不是假绿，探针能看见折行）',
        after.rows === 2, 'rows=' + after.rows + ' tops=' + JSON.stringify(after.items.map(function (i) { return i.top; })));
      await ctx.close();
    }

    /* ---------- [4] 截图（老板验收要看的就是这块） ---------- */
    console.log('[4] 截图');
    for (const [vw, vh, name] of [[360, 800, 'home-counts-onerow-360.png'], [1280, 900, 'home-counts-onerow-1280.png']]) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
      await ctx.addInitScript({ content: SEED });
      const page = await ctx.newPage();
      await page.route('**/api/**', function (r) { r.abort('failed'); });
      await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.home-today-counts .htc', { timeout: 10000 });
      await page.waitForTimeout(250);
      await page.locator('.home-today-counts').screenshot({ path: path.join(SHOTS, name) });
      await ctx.close();
    }
    console.log('  截图 → shots/home-counts-onerow-360.png（手机）/ home-counts-onerow-1280.png（桌面）');
  } finally {
    if (browser) { try { await browser.close(); } catch (e) { /* noop */ } }
    stopServer();
  }

  console.log('\n全部通过：通过 ' + passed + ' / ' + failed + ' 失败');
  if (failed) process.exitCode = 1;
})();
