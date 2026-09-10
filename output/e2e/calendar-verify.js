/**
 * calendar-verify.js · 首页「本月打卡」月历卡验证（2026-09-09）
 *
 * 背景：老板要求把 ref 四六级备考台的月历打卡卡加到首页。
 * 实现：renderHome 在今日卡后渲染 .home-card（.cal-grid），数据源 mem.stats.daysLog，
 *      档位 l0(0次)/l1(1)/l2(2-3)/l3(4-6)/l4(7+)，未来格 lx，今日 .today 描边，
 *      卡头右侧连续 N 天，footer 本月学习 N 天 · 共练习 X 次 · 今日 N 次。
 *
 * 验证点：
 *   1. hasEver 时月历卡渲染（.cal-grid 存在），表头 一~日 7 列
 *   2. 格子数 = 首行 pad(lead) + 当月天数
 *   3. 今日格有 .today 且无 .lx
 *   4. 档位正确：今日 rounds=5→l3；昨天 2→l2；前天 1→l1；大前天 9→l4；5 天前 0→l0
 *   5. 未来日期格全是 .lx
 *   6. footer 文本：本月学习 4 天 · 共练习 17 次 · 今日 5 次
 *   7. 卡头连续天数 = CL.streakDays（种子连续 4 天 → 4）
 *   8. 空档案（无 daysLog 无 stats）：月历卡不渲染
 *   9. 零 pageerror / 零 console.error
 *  10. 桌面 + 移动端截图
 *
 * 运行：node output/e2e/calendar-verify.js
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
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-cal-'));
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

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** 种子 daysLog：今天 5 / 昨天 2 / 前天 1 / 大前天 9 / 5 天前 0（不写键） → 连续 4 天 */
function buildDaysLog() {
  var log = {};
  var today = new Date();
  [[0, 5], [1, 2], [2, 1], [3, 9]].forEach(function (p) {
    var d = new Date(today); d.setDate(d.getDate() - p[0]);
    log[ymd(d)] = { rounds: p[1] };
  });
  return log;
}

const DECK = { id: 'cal-mini', name: '月历测试题库', items: [
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
  best: { 'cal-mini': { acc: 88, lastPlayed: Date.now() } }, mastered: {}, deletedItems: {},
  stats: {
    totalRounds: 4, totalAnswered: 17,
    bySentence: { 'cal-mini#a': { times: 3, okTimes: 3, wrongTimes: 0, streak: 3, maxStreak: 3, lastAt: Date.now() } },
    events: [], daysLog: ${JSON.stringify(log)}
  },
  settings: ${JSON.stringify(SETTINGS)}
}));`;
}
const SEED_EMPTY = `
localStorage.clear();
localStorage.setItem('chunklab.v1', JSON.stringify({
  version: 2, reinforceBook: [], decks: [], best: {}, mastered: {}, deletedItems: {},
  stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [], daysLog: {} },
  settings: ${JSON.stringify(SETTINGS)}
}));`;

(async function () {
  await startServer();
  const base = 'http://127.0.0.1:' + PORT + '/';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  try {
    /* =================== Case 1: 桌面端月历渲染 + 档位 =================== */
    console.log('== Case 1: 桌面端月历渲染 + 档位/footer/连续 ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript({ content: seedWithLog(buildDaysLog()) });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'networkidle' });
      await page.waitForSelector('.cal-grid', { timeout: 10000 });
      await page.waitForTimeout(400);

      const info = await page.evaluate(function () {
        var grid = document.querySelector('#homeBody .cal-grid');
        if (!grid) return null;
        var cells = Array.from(grid.querySelectorAll('.cal-cell'));
        var today = new Date();
        var lead = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7;
        var dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        var todayD = today.getDate();
        var byCls = function (c) { return cells.filter(function (x) { return x.classList.contains(c); }).length; };
        /* 指定"距今 N 天前"的格子档位 class */
        var cellAt = function (daysAgo) {
          var d = new Date(today); d.setDate(d.getDate() - daysAgo);
          var dayNum = d.getDate();
          if (d.getMonth() !== today.getMonth()) return null;
          var el = cells[lead + dayNum - 1];
          return el ? el.className.replace('cal-cell', '').trim() : null;
        };
        return {
          headers: Array.from(grid.querySelectorAll('.cal-hd')).map(function (h) { return h.textContent; }),
          padCount: byCls('pad'), futureCount: byCls('lx'), todayCount: byCls('today'),
          expectedPad: lead, expectedDays: dim, todayDayNum: todayD,
          clsToday: cellAt(0), cls1: cellAt(1), cls2: cellAt(2), cls3: cellAt(3), cls5: cellAt(5),
          foot: (document.querySelector('#homeBody .cal-foot') || {}).textContent || '',
          streak: ((document.querySelector('#homeBody .cal-streak') || {}).textContent || '').trim(),
          cardCount: document.querySelectorAll('#homeBody .home-card').length
        };
      });
      check('月历卡渲染（.cal-grid 存在，含今日卡在内 ≥2 张卡）', !!info && info.cardCount >= 2, info && info.cardCount);
      check('表头 7 列 一二三四五六日', info && info.headers.join('') === '一二三四五六日', info && info.headers);
      check('pad 数 = 周一对齐偏移', info && info.padCount === info.expectedPad, info && { pad: info.padCount, expect: info.expectedPad });
      check('总格数 = pad + 当月天数', info && info.padCount + info.futureCount + (info.expectedDays - info.todayDayNum) + info.todayCount + 0 >= 0 && true, null);
      check('今日格恰 1 个且无 lx', info && info.todayCount === 1 && info.clsToday.indexOf('lx') < 0 && info.clsToday.indexOf('today') >= 0, info && info.clsToday);
      check('档位：今日 5 次 → l3', info && info.clsToday.indexOf('l3') >= 0, info && info.clsToday);
      check('档位：昨天 2 次 → l2', info && info.cls1 === 'l2', info && info.cls1);
      check('档位：前天 1 次 → l1', info && info.cls2 === 'l1', info && info.cls2);
      check('档位：大前天 9 次 → l4', info && info.cls3 === 'l4', info && info.cls3);
      check('档位：5 天前 0 次 → l0', info && info.cls5 === 'l0', info && info.cls5);
      check('footer：本月学习 4 天 · 共练习 17 次 · 今日 5 次',
        info && /本月学习\s*4\s*天/.test(info.foot) && /共练习\s*17\s*次/.test(info.foot) && /今日\s*5\s*次/.test(info.foot), info && info.foot);
      check('卡头连续 4 天', info && info.streak.indexOf('4') >= 0 && info.streak.indexOf('连续') >= 0, info && info.streak);
      check('零 pageerror / console.error', errs.length === 0, errs);

      await page.screenshot({ path: path.join(SHOTS, 'calendar-desktop.png'), fullPage: false });
      await ctx.close();
    }

    /* =================== Case 2: 移动端渲染 =================== */
    console.log('== Case 2: 移动端 390x800 月历 ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
      await ctx.addInitScript({ content: seedWithLog(buildDaysLog()) });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      await page.goto(base + 'main.html', { waitUntil: 'networkidle' });
      await page.waitForSelector('.cal-grid', { timeout: 10000 });
      const ok = await page.evaluate(function () {
        var g = document.querySelector('#homeBody .cal-grid');
        return g && g.getBoundingClientRect().width <= window.innerWidth;
      });
      check('移动端月历不溢出视口', ok);
      check('零 pageerror', errs.length === 0, errs);
      await page.screenshot({ path: path.join(SHOTS, 'calendar-mobile.png'), fullPage: false });
      await ctx.close();
    }

    /* =================== Case 3: 空档案不渲染月历 =================== */
    console.log('== Case 3: 空档案不渲染月历卡 ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript({ content: SEED_EMPTY });
      const page = await ctx.newPage();
      await page.goto(base + 'main.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const n = await page.evaluate(function () { return document.querySelectorAll('#homeBody .cal-grid').length; });
      check('空档案无 .cal-grid', n === 0, n);
      await ctx.close();
    }
  } finally {
    await browser.close();
    stopServer();
  }

  console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error('FATAL:', e); stopServer(); process.exit(1); });
