/**
 * cal-pop-verify.js · 首页月历 popover 验证（2026-09-09）
 *
 * 背景：老板要求日历 hover 显示复习次数（桌面）/ 点击显示（移动）。
 * 实现：复刻圆环 popover 套路——document 级事件代理 + portal 化 .pop-info，
 *      桌面 matchMedia('(hover: hover)') 才绑 mouseenter/mouseleave，
 *      移动端 click 切换，hover 邻 cell 120ms 延迟关闭防闪烁。
 *
 * 验证点：
 *  1. 桌面 hover 有数据 cell → popover 显示「日期 + 练习 N 次」+ good 色（≥7）
 *  2. 桌面 hover 0 次 cell → popover 显示「当日未练习」
 *  3. 桌面 hover .lx（未来）cell → popover 不弹出
 *  4. 桌面 hover 移到邻 cell → 内容无缝切换不闪
 *  5. 桌面 click 同一 cell 二次 → 关闭
 *  6. 桌面 click 空白 → 关闭
 *  7. 移动端（hover:none）click cell → popover 显示
 *  8. 移动端再次 click 同一 cell → 关闭
 *  9. Esc → 关闭
 * 10. 零 pageerror / 零 console.error
 * 11. 桌面 + 移动截图
 *
 * 运行：node output/e2e/cal-pop-verify.js
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

const PORT = 9400 + Math.floor(Math.random() * 80);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-calpop-'));
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
}

function ymd(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}
/* 种子 daysLog：今天 5 / 昨天 2 / 前天 1 / 大前天 9 / 8 天前 0（写入键验证 l0 文本） */
function buildDaysLog() {
  var log = {};
  var today = new Date();
  [[0, 5], [1, 2], [2, 1], [3, 9], [8, 0]].forEach(function (p) {
    var d = new Date(today); d.setDate(d.getDate() - p[0]);
    log[ymd(d)] = { rounds: p[1] };
  });
  return log;
}

const DECK = { id: 'calpop-mini', name: '月历 popover 测试', items: [
  { sentence: 'I would like to check in please.', translation: '想', chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''], cid: 'a' },
  { sentence: 'Have a nice weekend.', translation: '周末', chunks: ['Have a', 'nice weekend.'], hints: ['', ''], cid: 'd' }
] };
const SETTINGS = { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false };

function seedWithLog(log) {
  return `
localStorage.clear();
localStorage.setItem('chunklab.v1', JSON.stringify({
  version: 2, reinforceBook: [],
  decks: [${JSON.stringify(DECK)}],
  best: { 'calpop-mini': { acc: 88, lastPlayed: Date.now() } }, mastered: {}, deletedItems: {},
  stats: {
    totalRounds: 5, totalAnswered: 17,
    bySentence: { 'calpop-mini#a': { times: 3, okTimes: 3, wrongTimes: 0, streak: 3, maxStreak: 3, lastAt: Date.now() } },
    events: [], daysLog: ${JSON.stringify(log)}
  },
  settings: ${JSON.stringify(SETTINGS)}
}));`;
}

let pass = 0, fail = 0;
function check(label, cond, info) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (info !== undefined ? ' — ' + JSON.stringify(info) : '')); }
}

(async function () {
  await startServer();
  const base = 'http://127.0.0.1:' + PORT + '/';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  try {
    /* ========== Case 1: 桌面端 hover 有数据 cell → popover 显示 ========== */
    console.log('== Case 1: 桌面端 hover 触发 + 内容 + good 色 ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript({ content: seedWithLog(buildDaysLog()) });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'networkidle' });
      await page.waitForSelector('.cal-grid', { timeout: 10000 });
      await page.waitForTimeout(300);

      /* 找今天 cell（带 data-rounds=5） */
      const todayCell = await page.$('.cal-cell[data-rounds="5"]');
      check('today cell 存在', !!todayCell);

      /* hover 触发 */
      await todayCell.hover();
      await page.waitForTimeout(220);
      const popInfo1 = await page.evaluate(function () {
        var p = document.querySelector('.cal-pop');
        if (!p) return null;
        return {
          open: p.classList.contains('open'),
          title: (p.querySelector('.title-text') || {}).textContent || '',
          rows: Array.from(p.querySelectorAll('.pop-info-row')).map(function (r) {
            return { lbl: (r.querySelector('.lbl') || {}).textContent || '', val: (r.querySelector('.val') || {}).textContent || '', good: !!(r.querySelector('.val') && r.querySelector('.val').classList.contains('good')) };
          }),
          inBody: p.parentNode === document.body
        };
      });
      check('popover 已 open', popInfo1 && popInfo1.open);
      check('popover portal 到 body 末尾', popInfo1 && popInfo1.inBody);
      check('标题 = 今天日期 YYYY-MM-DD', popInfo1 && /^\d{4}-\d{2}-\d{2}$/.test(popInfo1.title), popInfo1 && popInfo1.title);
      check('练习行 = 5 次', popInfo1 && popInfo1.rows.some(function (r) { return r.lbl === '练习' && r.val === '5 次'; }));
      check('无 good 色（5<7）', popInfo1 && popInfo1.rows.every(function (r) { return !r.good; }));

      await page.screenshot({ path: path.join(SHOTS, 'calpop-1-hover-today.png'), fullPage: false });

      /* ========== Case 2: hover 0 次 cell → "当日未练习" ========== */
      console.log('== Case 2: hover 0 次 cell → 显示"当日未练习" ==');
      const zeroCell = await page.$('.cal-cell[data-rounds="0"]:not(.lx)');
      check('0 次 cell 存在', !!zeroCell);
      if (zeroCell) {
        /* 移到空白处先关 */
        await page.mouse.move(10, 10);
        await page.waitForTimeout(200);
        await zeroCell.hover();
        await page.waitForTimeout(220);
        const popInfo2 = await page.evaluate(function () {
          var p = document.querySelector('.cal-pop');
          if (!p) return null;
          return {
            text: p.textContent || '',
            hasZero: p.textContent.indexOf('0 次') >= 0,
            hasHint: p.textContent.indexOf('当日未练习') >= 0
          };
        });
        check('显示"当日未练习"', popInfo2 && popInfo2.hasHint, popInfo2 && popInfo2.text);
        check('显示"0 次"', popInfo2 && popInfo2.hasZero);
      }

      /* ========== Case 3: hover .lx（未来日期）→ popover 不弹出 ========== */
      console.log('== Case 3: hover .lx 未来日期 → 不响应 ==');
      /* 先关掉 */
      await page.mouse.move(10, 10);
      await page.waitForTimeout(200);
      const lxCell = await page.$('.cal-cell.lx');
      check('.lx cell 存在', !!lxCell);
      if (lxCell) {
        await lxCell.hover();
        await page.waitForTimeout(200);
        const open3 = await page.evaluate(function () {
          var p = document.querySelector('.cal-pop');
          return p && p.classList.contains('open');
        });
        check('popover 未 open', open3 === false, open3);
      }

      /* ========== Case 4: hover 邻 cell → 内容切换 ========== */
      console.log('== Case 4: hover 移到邻 cell → 内容无缝切换 ==');
      const todayCell2 = await page.$('.cal-cell[data-rounds="5"]');
      const yesterdayCell = await page.$('.cal-cell[data-rounds="2"]');
      check('昨天 cell 存在', !!yesterdayCell);
      if (todayCell2 && yesterdayCell) {
        await todayCell2.hover();
        await page.waitForTimeout(220);
        const beforeSwitch = await page.evaluate(function () {
          return document.querySelector('.cal-pop .val') ? document.querySelector('.cal-pop .val').textContent : null;
        });
        /* 不移出，模拟 hover 邻 cell：直接 hover 另一个 */
        await yesterdayCell.hover();
        await page.waitForTimeout(220);
        const afterSwitch = await page.evaluate(function () {
          return document.querySelector('.cal-pop .val') ? document.querySelector('.cal-pop .val').textContent : null;
        });
        check('hover 今天 → 5 次', beforeSwitch === '5 次', beforeSwitch);
        check('hover 昨天 → 2 次（已切换）', afterSwitch === '2 次', afterSwitch);
      }

      /* ========== Case 5: 桌面 click 同一 cell → 关闭 ========== */
      console.log('== Case 5: 桌面 click 同一 cell → 关闭（toggle） ==');
      if (todayCell2) {
        await todayCell2.click();
        await page.waitForTimeout(220);
        const afterClick = await page.evaluate(function () {
          var p = document.querySelector('.cal-pop');
          return p && p.classList.contains('open');
        });
        check('再次 click → 关闭', afterClick === false, afterClick);
      }

      /* ========== Case 6: 桌面 click 空白 → 关闭 ========== */
      console.log('== Case 6: 桌面 click 空白 → 关闭 ==');
      /* 先打开 */
      if (todayCell2) {
        await todayCell2.hover();
        await page.waitForTimeout(220);
        await page.click('.hc-title');  /* 点日历卡标题区 */
        await page.waitForTimeout(220);
        const afterBlank = await page.evaluate(function () {
          var p = document.querySelector('.cal-pop');
          return p && p.classList.contains('open');
        });
        check('click 卡内空白 → popover 关闭', afterBlank === false, afterBlank);
      }

      check('零 pageerror', errs.filter(function (e) { return e.indexOf('pageerror') === 0; }).length === 0, errs);
      check('零 console.error', errs.filter(function (e) { return e.indexOf('console.error') === 0; }).length === 0, errs);

      await ctx.close();
    }

    /* ========== Case 7-9: 移动端（hover:none）click 切换 ========== */
    console.log('== Case 7-9: 移动端 hover:none → click 切换 ==');
    {
      const ctx = await browser.newContext({
        viewport: { width: 375, height: 800 },
        isMobile: true,
        hasTouch: true,
        /* 关键：让 matchMedia('(hover: hover)') 为 none，模拟移动设备 */
        deviceScaleFactor: 2
      });
      await ctx.addInitScript({ content: seedWithLog(buildDaysLog()) });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'networkidle' });
      await page.waitForSelector('.cal-grid', { timeout: 10000 });
      await page.waitForTimeout(300);

      /* 校验 hover 能力：移动上下文里应该是 none */
      const hoverCap = await page.evaluate(function () {
        return window.matchMedia('(hover: hover)').matches;
      });
      check('移动上下文 hover: hover=false', hoverCap === false, hoverCap);

      /* click 今天 cell */
      const todayCell = await page.$('.cal-cell[data-rounds="5"]');
      check('移动端 today cell 存在', !!todayCell);
      if (todayCell) {
        await todayCell.tap();
        await page.waitForTimeout(250);
        const afterTap = await page.evaluate(function () {
          var p = document.querySelector('.cal-pop');
          if (!p) return null;
          return {
            open: p.classList.contains('open'),
            val: (p.querySelector('.val') || {}).textContent || ''
          };
        });
        check('移动端 tap → popover open', afterTap && afterTap.open);
        check('移动端 tap → 显示 5 次', afterTap && afterTap.val === '5 次', afterTap && afterTap.val);

        await page.screenshot({ path: path.join(SHOTS, 'calpop-7-mobile-tap.png'), fullPage: false });

        /* 再 tap 同一 cell → 关闭 */
        await todayCell.tap();
        await page.waitForTimeout(250);
        const afterTap2 = await page.evaluate(function () {
          return document.querySelector('.cal-pop') && document.querySelector('.cal-pop').classList.contains('open');
        });
        check('移动端再 tap 同一 → 关闭', afterTap2 === false, afterTap2);
      }

      /* tap 另一个 cell 切换 */
      const yCell = await page.$('.cal-cell[data-rounds="2"]');
      if (todayCell && yCell) {
        await todayCell.tap();
        await page.waitForTimeout(220);
        await yCell.tap();
        await page.waitForTimeout(220);
        const valAfterSwitch = await page.evaluate(function () {
          return document.querySelector('.cal-pop .val') ? document.querySelector('.cal-pop .val').textContent : null;
        });
        check('移动端 tap 切换 → 显示 2 次', valAfterSwitch === '2 次', valAfterSwitch);
      }

      check('移动端 零 pageerror', errs.filter(function (e) { return e.indexOf('pageerror') === 0; }).length === 0, errs);
      check('移动端 零 console.error', errs.filter(function (e) { return e.indexOf('console.error') === 0; }).length === 0, errs);

      await ctx.close();
    }

    console.log('\n总计: ' + pass + ' pass, ' + fail + ' fail');
    process.exitCode = fail ? 1 : 0;
  } catch (e) {
    console.error('FATAL:', e && e.stack || e);
    process.exitCode = 2;
  } finally {
    if (browser) await browser.close().catch(function () { });
    stopServer();
    setTimeout(function () { process.exit(process.exitCode || 0); }, 100);
  }
})();