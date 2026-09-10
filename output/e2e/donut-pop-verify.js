/**
 * donut-pop-verify.js · 熟练度分布圆环 hover popover 验证（2026-09-08）
 *
 * 根因：老板反馈"熟练度分布圆环内的数据（已学/总句数/练过次数/标熟）字号 6-6.5px 看不清，
 *      圆环本身 78x78 不够装"。
 * 修复：删圆环内小字冗余行（4 行→2 行，只保留大字"60"+ "/ 279"），
 *      hover/tap 弹 popover 显示完整数据（已学/总/练过次数 + 4 档分布 + 标熟数）。
 *
 * 验证点（沿用 main.html 圆环 popover 模式）：
 *   1. 圆环只显示核心大字（已学数）+"已学句数"+"/ N 句"—— 旧小字"练过 X 次"已删
 *   2. donut-wrap 有 role="button" tabindex="0" aria-label="熟练度分布详情"（可访问性）
 *   3. donut-wrap 有 cursor:pointer（视觉可交互指示）
 *   4. hover donut-wrap → popover 弹出，position:fixed + portal 到 body
 *   5. ★ popover 内容只有「练过次数 N 次」一行 —— 4 档分布/标熟/已学句数由静态 legend 承担，
 *      hover 不复述（2026-09-09 老板反馈去重）；全部学完时才补「已全部学完」title
 *   6. mouseleave → popover 关闭
 *   7. click 切下一题 / tab 切换 / 重渲染不残留
 *   8. 移动端 (390x800)：tap 弹出（无 mouseenter），位置 clamp 不溢出
 *   9. 零 pageerror / 零 console.error
 *
 * 依赖：playwright-core + chromium headless shell + 临时 server（同 icons-smoke）
 * 运行：node output/e2e/donut-pop-verify.js
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

const PORT = 9300 + Math.floor(Math.random() * 80);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-donut-'));
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
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + JSON.stringify(detail) : '')); }
}

/** 注入种子：4 题 mini deck（统计分布有意义：master/learn/weak/unseen 各占比例） */
const SEED = `
localStorage.clear();
localStorage.setItem('chunklab.v1', JSON.stringify({
  version: 2, reinforceBook: [],
  decks: [{ id: 'donut-mini', name: 'Donut 测试题库', items: [
    { sentence: 'I would like to check in please.', translation: '想', chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''], cid: 'a' },
    { sentence: 'Could you help me carry this.', translation: '能', chunks: ['Could you', 'help me', 'carry this.'], hints: ['', '', ''], cid: 'b' },
    { sentence: 'Where is the nearest subway station.', translation: '最近', chunks: ['Where is', 'the nearest', 'subway station.'], hints: ['', '', ''], cid: 'c' },
    { sentence: 'Have a nice weekend.', translation: '周末', chunks: ['Have a', 'nice weekend.'], hints: ['', ''], cid: 'd' }
  ] }],
  best: {}, mastered: { 'donut-mini#d': true }, deletedItems: {},
  stats: {
    totalRounds: 1, totalAnswered: 5, bySentence: {
      'donut-mini#a': { times: 3, okTimes: 3, wrongTimes: 0, streak: 3, maxStreak: 3, lastAt: Date.now() },
      'donut-mini#b': { times: 2, okTimes: 1, wrongTimes: 1, streak: 0, maxStreak: 1, lastAt: Date.now() },
      'donut-mini#c': { times: 1, okTimes: 0, wrongTimes: 1, streak: 0, maxStreak: 0, lastAt: Date.now() }
    }
  },
  settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false }
}));
`;

(async function () {
  await startServer();
  const base = 'http://127.0.0.1:' + PORT + '/';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  try {
    /* =================== Case 1: 桌面端 hover 弹 popover =================== */
    console.log('== Case 1: 桌面端 hover 弹 donut popover ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await ctx.addInitScript({ content: SEED });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'stats.html', { waitUntil: 'networkidle' });
      await page.waitForSelector('#donutWrap', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 1. 圆环核心：只显示大字 + /总数，无"练过 X 次"
      const center = await page.evaluate(function () {
        var wrap = document.getElementById('donutWrap');
        var texts = wrap ? Array.from(wrap.querySelectorAll('text')).map(function(t){ return t.textContent.trim(); }) : [];
        return { texts: texts };
      });
      check('圆环内只显示大字+总数（小字"练过 X 次"已删）',
        center.texts.length === 3 &&
        /^\d+$/.test(center.texts[0]) &&            // 已学（纯数字）
        center.texts[1] === '已学句数' &&
        /^\/ \d+ 句$/.test(center.texts[2]),
        center);

      // 2. 无障碍属性 + cursor:pointer
      const a11y = await page.evaluate(function () {
        var wrap = document.getElementById('donutWrap');
        if(!wrap) return null;
        var cs = getComputedStyle(wrap);
        return {
          role: wrap.getAttribute('role'),
          tabindex: wrap.getAttribute('tabindex'),
          ariaLabel: wrap.getAttribute('aria-label'),
          ariaDescribedby: wrap.getAttribute('aria-describedby'),
          cursor: cs.cursor
        };
      });
      check('donut-wrap role=button + tabindex=0 + aria-label + cursor:pointer',
        a11y.role === 'button' && a11y.tabindex === '0' && /熟练度/.test(a11y.ariaLabel) && a11y.ariaDescribedby === 'donutPop' && a11y.cursor === 'pointer',
        a11y);

      // 3. popover portal 到 body
      const portal = await page.evaluate(function () {
        var pop = document.getElementById('donutPop');
        if(!pop) return null;
        return { parent: pop.parentNode === document.body, position: getComputedStyle(pop).position };
      });
      check('donut-pop 已 portal 到 body + position:fixed',
        portal && portal.parent && portal.position === 'fixed',
        portal);

      // 4. hover 触发 popover 显示
      await page.hover('#donutWrap');
      await page.waitForTimeout(200);
      const hoverOpen = await page.evaluate(function () {
        var pop = document.getElementById('donutPop');
        var wrap = document.getElementById('donutWrap');
        return {
          open: pop && pop.classList.contains('open'),
          ariaHidden: pop && pop.getAttribute('aria-hidden'),
          wrapPopOpen: wrap && wrap.classList.contains('pop-open'),
          rect: pop && pop.getBoundingClientRect(),
          inViewport: pop && (function(r){ return r.top >= 0 && r.bottom <= window.innerHeight; })(pop.getBoundingClientRect())
        };
      });
      check('hover 触发 popover.open + aria-hidden=false',
        hoverOpen.open && hoverOpen.ariaHidden === 'false',
        { open: hoverOpen.open, ariaHidden: hoverOpen.ariaHidden });
      check('donut-wrap 加 .pop-open（视觉指示）',
        hoverOpen.wrapPopOpen,
        { wrapPopOpen: hoverOpen.wrapPopOpen });
      check('popover 完整在 viewport 内',
        hoverOpen.inViewport,
        { rect: hoverOpen.rect });

      // 5. popover 内容 = 唯一「练过次数」行；静态区已展示的内容不复述（2026-09-09 收敛）
      const popContent = await page.evaluate(function () {
        var pop = document.getElementById('donutPop');
        if(!pop) return null;
        var rows = Array.from(pop.querySelectorAll('.donut-pop-row')).map(function(r){ return r.textContent.trim().replace(/\s+/g, ' '); });
        var title = pop.querySelector('.donut-pop-title');
        var d = window._masteryPopData || {};
        return {
          titleText: title ? title.textContent.replace(/\s+/g, ' ').trim() : null,
          rows: rows,
          practiced: d.practiced || 0,
          allLearned: !!(d.total > 0 && d.studied === d.total),
          legendLabels: Array.from(document.querySelectorAll('#statsCards .donut-legend .donut-row .lbl')).map(function(x){ return x.textContent.trim(); })
        };
      });
      check('popover 只有 1 行（练过次数）',
        popContent && popContent.rows.length === 1,
        popContent && popContent.rows);
      check('popover 行 = "练过次数 N 次"（N 与 _masteryPopData.practiced 一致）',
        popContent && /^练过次数\s*\d+\s*次$/.test(popContent.rows[0] || '') &&
        (popContent.rows[0] || '').indexOf(String(popContent.practiced)) >= 0,
        popContent && { rows: popContent.rows, practiced: popContent.practiced });
      check('popover 不复述静态区：无「已学句数 / 熟练 / 学习中 / 需巩固 / 未练过 / 标熟」行',
        popContent && !popContent.rows.some(function(r){ return /已学句数|熟练|学习中|需巩固|未练过|标熟/.test(r); }),
        popContent && popContent.rows);
      check('静态 legend 已承担 4 档 + 标熟（popover 去重的前提条件）',
        popContent && ['熟练','学习中','需巩固','未练过','标熟'].every(function(l){ return popContent.legendLabels.indexOf(l) >= 0; }),
        popContent && popContent.legendLabels);
      check('title 仅在全部学完时出现「已全部学完」徽标（当前 allLearned=' + (popContent && popContent.allLearned) + '）',
        popContent && (popContent.allLearned
          ? /已全部学完/.test(popContent.titleText || '')
          : popContent.titleText === null),
        popContent && { title: popContent.titleText, allLearned: popContent.allLearned });

      // 截图：圆环 + popover 展开
      await page.screenshot({ path: path.join(SHOTS, 'donut-pop-desktop.png'), clip: { x: 0, y: 0, width: 700, height: 380 } });

      // 6. mouseleave → popover 关闭
      await page.mouse.move(10, 10);
      await page.waitForTimeout(250);
      const afterLeave = await page.evaluate(function () {
        var pop = document.getElementById('donutPop');
        var wrap = document.getElementById('donutWrap');
        return {
          open: pop && pop.classList.contains('open'),
          wrapPopOpen: wrap && wrap.classList.contains('pop-open')
        };
      });
      check('mouseleave 关闭 popover',
        !afterLeave.open && !afterLeave.wrapPopOpen,
        afterLeave);

      // 7. click toggle 状态翻转（避开 hover 设备的 mouseenter 干扰：用 JS 直接派发 click）
      // 直接派发 click 不带 mouseenter，先把 wrap 设为关闭态做基线
      await page.evaluate(function () {
        var pop = document.getElementById('donutPop');
        if(pop && pop.classList.contains('open')) hideMasteryPop();
      });
      await page.waitForTimeout(50);
      // 派发 click（不触发 mouseenter）
      await page.evaluate(function () {
        var wrap = document.getElementById('donutWrap');
        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(150);
      const afterClick1 = await page.evaluate(function () {
        return { open: document.getElementById('donutPop').classList.contains('open') };
      });
      check('click 1 切到 open（基线关闭）', afterClick1.open, afterClick1);
      // 再派发 click 切回关闭
      await page.evaluate(function () {
        var wrap = document.getElementById('donutWrap');
        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(150);
      const afterClick2 = await page.evaluate(function () {
        return { open: document.getElementById('donutPop').classList.contains('open') };
      });
      check('click 2 切回 close', !afterClick2.open, afterClick2);

      // 8. 切 tab 不残留（先 click 打开，再点 tab 切走，再切回，popover 应关闭）
      await page.evaluate(function () {
        var wrap = document.getElementById('donutWrap');
        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(150);
      const beforeTab = await page.evaluate(function () {
        return { open: document.getElementById('donutPop').classList.contains('open') };
      });
      check('切 tab 前 popover open（click 后）', beforeTab.open, beforeTab);
      // 点别的 tab（错题本）
      await page.click('[data-tab="wrong"]');
      await page.waitForTimeout(400);
      // 重新切回分布 tab，donutWrap 重建，popover 应保持关闭
      await page.click('[data-tab="sent"]');
      await page.waitForTimeout(400);
      const afterTab = await page.evaluate(function () {
        return {
          wrapExists: !!document.getElementById('donutWrap'),
          popOpen: document.getElementById('donutPop') && document.getElementById('donutPop').classList.contains('open'),
          popExists: !!document.getElementById('donutPop')
        };
      });
      check('切 tab 重建后 donutWrap 仍存在', afterTab.wrapExists, afterTab);
      check('切 tab 后 popover 关闭（无残留）', !afterTab.popOpen, afterTab);

      check('零 pageerror/console.error', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    /* =================== Case 2: 移动端 tap =================== */
    console.log('== Case 2: 移动端 tap 弹 donut popover ==');
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 800 },
        isMobile: true,
        hasTouch: true
      });
      await ctx.addInitScript({ content: SEED });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'stats.html', { waitUntil: 'networkidle' });
      await page.waitForSelector('#donutWrap', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 移动 tap（不触发 mouseenter）
      await page.tap('#donutWrap');
      await page.waitForTimeout(250);
      const mobile = await page.evaluate(function () {
        var pop = document.getElementById('donutPop');
        var wrap = document.getElementById('donutWrap');
        if(!pop || !wrap) return null;
        var pr = pop.getBoundingClientRect();
        var wr = wrap.getBoundingClientRect();
        return {
          open: pop.classList.contains('open'),
          inViewport: pr.top >= 0 && pr.bottom <= window.innerHeight && pr.left >= 0 && pr.right <= window.innerWidth,
          belowWrap: pr.top >= wr.bottom - 1,
          rect: { top: pr.top, left: pr.left, w: pr.width }
        };
      });
      check('移动端 tap 触发 popover.open', mobile && mobile.open, mobile);
      check('移动 popover clamp 不溢出 viewport',
        mobile && mobile.inViewport,
        mobile && { left: mobile.rect.left, right: mobile.rect.left + mobile.rect.w, vw: 390 });
      check('移动 popover 在圆环下方', mobile && mobile.belowWrap, mobile);

      // 截图
      await page.screenshot({ path: path.join(SHOTS, 'donut-pop-mobile.png'), fullPage: false });

      // 再 tap 切 close
      await page.tap('#donutWrap');
      await page.waitForTimeout(200);
      const mobile2 = await page.evaluate(function () {
        return { open: document.getElementById('donutPop').classList.contains('open') };
      });
      check('移动再 tap 切 close', !mobile2.open, mobile2);

      check('零 pageerror/console.error', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

  } finally {
    await browser.close();
    stopServer();
  }

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  process.exit(failed === 0 ? 0 : 1);
})();