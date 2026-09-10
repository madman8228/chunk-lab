/**
 * ring-popover-verify.js · 圆环 hover 双 tooltip 回归验证（2026-09-08）
 *
 * 背景：main.html updateRing() 曾设置 wrap.title（原生 tooltip）+ 自定义 .pop-info
 * popover 同时弹出，造成双阴影。修复后只保留自定义 popover，title 属性不再存在。
 *
 * 验证点：
 *   1. 练习一次后圆环出现（hidden 被解除、数字=1）
 *   2. hover 圆环 → #ringPop 加 .open（自定义 popover 弹出）
 *   3. 关键：hover 期间 #ringWrap 的 title 属性恒为 null → 浏览器原生 tooltip 物理上不可能显示
 *   4. 长时间 hover（>1.6s，盖过原生 tooltip 最大延迟）后 title 依然为 null
 *
 * 依赖同 e2e.js：playwright-core + chromium headless shell + 临时 server。
 * 运行：node output/e2e/ring-popover-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 8902 + Math.floor(Math.random() * 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-ring-'));
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
      const http = require('http');
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
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  await startServer();
  console.log('ring-popover verify server: ' + BASE);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });

  /* 拦截云同步，纯本地验证，避免任何网络副作用 */
  await p.route('**/api/**', function (r) { r.abort('failed'); });
  /* 必须带 ?direct=1：默认入口已是今日首页（decideEntry），不带则落到首页、练习区不渲染 → ringWrap 不存在 */
  await p.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#track', { timeout: 12000 }).catch(function () {});
  await p.waitForTimeout(800);

  /* 空态（未练习）：圆环 hidden + popover 无内容。
     死代码回归护栏：曾有一段「还没练过此句/点圆环关闭」空态提示，但 ringWrap 在
     times===0 时必 hidden（updateRing 唯一 toggle 点），popover 无法打开 → 是死代码，
     2026-09-08 删除。此断言锁定：空态永远不可达 → popover 内容保持空 */
  const emptyState = await p.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    var pop = document.getElementById('ringPop');
    return {
      hiddenClass: wrap ? wrap.classList.contains('hidden') : null,
      noResidual: pop ? pop.innerHTML.trim() === '' : true,
      hasEmptyHint: pop ? pop.innerHTML.indexOf('还没练过此句') >= 0 || pop.innerHTML.indexOf('点圆环关闭') >= 0 : false
    };
  });
  check('空态：未练习时圆环 hidden（popover 不可达前置条件）',
    emptyState.hiddenClass === true, JSON.stringify(emptyState));
  check('空态：popover 内容为空且无死代码残留文案',
    emptyState.noResidual && !emptyState.hasEmptyHint, JSON.stringify(emptyState));

  /* 造一条练习统计：对当前句 cur() 真身做题（同 e2e.js 姿势），再显式 updateRing()
     让圆环出现（recordSentenceResult 本身不触发 updateRing，那是做题流程的职责） */
  await p.evaluate(function () {
    var it = cur();
    if (it && typeof recordSentenceResult === 'function') recordSentenceResult(it, true);
    if (typeof updateRing === 'function') updateRing();
    if (typeof saveStore === 'function') saveStore();
  });
  await p.waitForTimeout(400);

  const afterPractice = await p.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    if (!wrap) return null;
    var cs = getComputedStyle(wrap);
    return {
      hiddenClass: wrap.classList.contains('hidden'),
      display: cs.display,
      num: (document.getElementById('ringNum') || {}).textContent,
      hasTitle: wrap.hasAttribute('title')
    };
  });
  check('练习后圆环显示（hidden 解除、数字=1）',
    afterPractice && !afterPractice.hiddenClass && afterPractice.display !== 'none' && afterPractice.num === '1',
    JSON.stringify(afterPractice));
  check('练习后圆环 title 属性不存在', afterPractice && !afterPractice.hasTitle, 'title=' + afterPractice.hasTitle);

  /* hover 圆环：短悬停（popover 应弹出） */
  await p.locator('#ringWrap').hover();
  await p.waitForTimeout(250);
  const hoverShort = await p.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    var pop = document.getElementById('ringPop');
    var cs = pop ? getComputedStyle(pop) : null;
    var pr = pop && pop.getBoundingClientRect();
    var sr = wrap && wrap.getBoundingClientRect();
    return {
      popOpen: pop && pop.classList.contains('open'),
      popOpacity: cs ? cs.opacity : 'no-pop',
      popAriaHidden: pop ? pop.getAttribute('aria-hidden') : null,
      wrapTitle: wrap ? wrap.getAttribute('title') : 'no-wrap',
      wrapPopOpenCls: wrap ? wrap.classList.contains('pop-open') : false,
      /* popover 已移出 stage：断言 popover 实际位置在 stage 容器外（不受 stage overflow:hidden 约束） */
      popInBody: pop ? pop.parentNode === document.body : false,
      popInViewport: pr && pr.top >= 0 && pr.bottom <= window.innerHeight && pr.left >= 0 && pr.right <= window.innerWidth,
      popBelowRing: pr && sr && pr.top >= sr.bottom - 1,
      popNotClippedByStage: pr && (function () {
        var stage = wrap.closest('.stage');
        if (!stage) return true;
        var stR = stage.getBoundingClientRect();
        /* 允许底部超出 stage 8px（即 popover 顶部 + 8 偏移），但不能整个 popover 都在 stage 外 */
        return pr.top < stR.bottom + 8 && pr.bottom > stR.top - 8;
      })()
    };
  });
  check('短悬停：自定义 popover 弹出（.open + opacity=1 + aria-hidden=false）',
    hoverShort.popOpen && hoverShort.popOpacity === '1' && hoverShort.popAriaHidden === 'false' && hoverShort.wrapPopOpenCls,
    JSON.stringify(hoverShort));
  check('短悬停：wrap.title 为 null（无原生 tooltip 来源）',
    hoverShort.wrapTitle === null, 'title=' + JSON.stringify(hoverShort.wrapTitle));
  check('短悬停：popover 已脱离 stage 容器（parentNode === body）',
    hoverShort.popInBody, JSON.stringify(hoverShort));
  check('短悬停：popover 完整在 viewport 内（不被任何 ancestor 裁切）',
    hoverShort.popInViewport, JSON.stringify(hoverShort));
  check('短悬停：popover 位于圆环下方（不与圆环重叠）',
    hoverShort.popBelowRing, JSON.stringify(hoverShort));
  check('短悬停：popover 跨越 stage 边界可见（不再被 stage overflow 切）',
    hoverShort.popNotClippedByStage, JSON.stringify(hoverShort));

  /* 紧凑度断言：每行高度、整体高度都应控制在阈值内 */
  const compact = await p.evaluate(function () {
    var pop = document.getElementById('ringPop');
    if (!pop) return null;
    var rows = Array.from(pop.querySelectorAll('.pop-info-row'));
    var heights = rows.map(function (r) { return r.getBoundingClientRect().height; });
    var pr = pop.getBoundingClientRect();
    return {
      rowHeights: heights,
      maxRow: heights.length ? Math.max.apply(null, heights) : 0,
      popHeight: pr.height,
      rowCount: rows.length
    };
  });
  check('紧凑：每行 pop-info-row 高度 ≤ 17px（原 ~20px）',
    compact && compact.maxRow <= 17, JSON.stringify(compact));
  check('紧凑：popover 整体高度 ≤ 120px（3 行 + title，已删 hint/最近练习/当前连对）',
    compact && compact.popHeight <= 120, JSON.stringify(compact));
  check('紧凑：渲染行数 = 3（已练习/正确率/最佳连对，wrongTimes=0 时无答错行）',
    compact && compact.rowCount === 3, JSON.stringify(compact));

  /* 长悬停：盖过浏览器原生 tooltip 的最大显示延迟（~1.5s）后复查 */
  await p.waitForTimeout(1800);
  const hoverLong = await p.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    var pop = document.getElementById('ringPop');
    return {
      wrapTitle: wrap ? wrap.getAttribute('title') : 'no-wrap',
      popOpen: pop ? pop.classList.contains('open') : false,
      nativeTooltipLeaked: !!(wrap && wrap.getAttribute('title'))
    };
  });
  check('长悬停 2s：title 仍为 null（原生 tooltip 不可能出现）',
    hoverLong.wrapTitle === null && !hoverLong.nativeTooltipLeaked,
    JSON.stringify(hoverLong));
  check('长悬停 2s：自定义 popover 保持弹出', hoverLong.popOpen, JSON.stringify(hoverLong));

  /* 截一张 hover 态留档（人工目检：只应有 popover，无浏览器原生 tooltip） */
  await p.screenshot({ path: path.join(SHOTS, 'ring-popover-hover.png') });

  /* 移出后 popover 关闭 */
  await p.mouse.move(10, 400);
  await p.waitForTimeout(300);
  const afterLeave = await p.evaluate(function () {
    var pop = document.getElementById('ringPop');
    return { popOpen: pop ? pop.classList.contains('open') : false };
  });
  check('移出圆环：popover 关闭', !afterLeave.popOpen, JSON.stringify(afterLeave));

  /* 老版本残留清理：手动塞一个 title（模拟老缓存），触发一次 updateRing 后应被 removeAttribute */
  const cleanResidual = await p.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    wrap.setAttribute('title', '老版本残留的兜底提示');
    if (typeof updateRing === 'function') updateRing();
    return { title: wrap.getAttribute('title') };
  });
  check('老版本残留 title 被 updateRing 一次性清理', cleanResidual.title === null, 'title=' + JSON.stringify(cleanResidual.title));

  check('零 pageerror', errs.length === 0, errs.join('|'));

  /* ===== 移动端：tap 是圆环唯一交互（无 hover），须验证 tap 切换 + 定位 ===== */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await mctx.newPage();
  const merrs = [];
  mp.on('pageerror', function (e) { merrs.push(e.message); });
  await mp.route('**/api/**', function (r) { r.abort('failed'); });
  await mp.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await mp.waitForSelector('#track', { timeout: 12000 }).catch(function () {});
  await mp.waitForTimeout(800);

  /* 造一条练习统计（同 desktop） */
  await mp.evaluate(function () {
    var it = cur();
    if (it && typeof recordSentenceResult === 'function') recordSentenceResult(it, true);
    if (typeof updateRing === 'function') updateRing();
    if (typeof saveStore === 'function') saveStore();
  });
  await mp.waitForTimeout(300);

  const mAfterPractice = await mp.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    var cs = wrap ? getComputedStyle(wrap) : null;
    return {
      visible: wrap && !wrap.classList.contains('hidden') && cs.display !== 'none',
      hasTitle: wrap ? wrap.hasAttribute('title') : null
    };
  });
  check('移动端：练习后圆环可见且无 title', mAfterPractice.visible && !mAfterPractice.hasTitle, JSON.stringify(mAfterPractice));

  /* tap 圆环 → 弹出 */
  /* 诊断：记录 tap 派发的事件序列（验证 mouseenter/click 是否同时被合成） */
  await mp.evaluate(function () {
    window.__tapDiag = [];
    ['mouseenter', 'mouseleave', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'touchcancel']
      .forEach(function (t) {
        document.getElementById('ringWrap').addEventListener(t, function () { window.__tapDiag.push(t); }, true);
      });
  });
  await mp.locator('#ringWrap').tap();
  await mp.waitForTimeout(400);
  const mOpen = await mp.evaluate(function () {
    var wrap = document.getElementById('ringWrap');
    var pop = document.getElementById('ringPop');
    if (!wrap || !pop) return null;
    var pr = pop.getBoundingClientRect();
    var sr = wrap.getBoundingClientRect();
    return {
      popOpen: pop.classList.contains('open'),
      popInBody: pop.parentNode === document.body,
      inViewport: pr.top >= 0 && pr.bottom <= window.innerHeight && pr.left >= 0 && pr.right <= window.innerWidth,
      /* 圆环贴左边缘时"居中"与"不溢出"互斥：clamp 会把 popover 拉回安全区。
         断言下方对齐 + 完整可见即可（clamp 生效由 inViewport 覆盖） */
      belowRing: pr.top >= sr.bottom - 1,
      innerWidth: window.innerWidth,
      tapDiag: (window.__tapDiag || []).join(',')
    };
  });
  check('移动端 tap：popover 弹出', mOpen && mOpen.popOpen, JSON.stringify(mOpen));
  check('移动端 tap：popover 在 body 下且完整在 viewport 内', mOpen && mOpen.popInBody && mOpen.inViewport, JSON.stringify(mOpen));
  check('移动端 tap：popover 位于圆环下方且完整可见（≤390px viewport）', mOpen && mOpen.belowRing && mOpen.inViewport, JSON.stringify(mOpen));
  await mp.screenshot({ path: path.join(SHOTS, 'ring-popover-tap-mobile.png') });

  /* tap 圆环 → 关闭（toggle） */
  await mp.locator('#ringWrap').tap();
  await mp.waitForTimeout(300);
  const mToggle = await mp.evaluate(function () {
    var pop = document.getElementById('ringPop');
    return { popOpen: pop ? pop.classList.contains('open') : false };
  });
  check('移动端 tap：再点圆环关闭（toggle）', mToggle && !mToggle.popOpen, JSON.stringify(mToggle));

  /* tap 别处 → 关闭（需先打开） */
  await mp.locator('#ringWrap').tap();
  await mp.waitForTimeout(350);
  await mp.touchscreen.tap(20, 400); /* 点在正文空白处 */
  await mp.waitForTimeout(300);
  const mOutside = await mp.evaluate(function () {
    var pop = document.getElementById('ringPop');
    return { popOpen: pop ? pop.classList.contains('open') : false };
  });
  check('移动端 tap：点圆环外关闭', mOutside && !mOutside.popOpen, JSON.stringify(mOutside));

  check('移动端：零 pageerror', merrs.length === 0, merrs.join('|'));
  await mctx.close();

  await browser.close();
  stopServer();
  console.log(failed === 0 ? '\n[ring-popover] 全部通过 (' + passed + ')' : '\n[ring-popover] failed=' + failed + ' passed=' + passed);
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('ring-popover verify error:', e);
  stopServer();
  process.exit(1);
});
