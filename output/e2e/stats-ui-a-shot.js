/**
 * stats-ui-a-shot.js · 「学习档案概览」方案 A 肉眼验收截图
 * 产出 output/e2e/stats-ui-a/：
 *   01-desktop.png  桌面概览（行动卡有计数）
 *   02-mobile.png   390 宽（行动卡 2 列 + 状态指标 2×2）
 *   03-zero.png     计数全 0（行动卡禁用态、数字显 --ok 绿）
 *   04-narrow.png   333 宽（最窄可用宽度，验证不折行/不溢出）
 * 运行：node output/e2e/stats-ui-a-shot.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'stats-ui-a');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8860, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-statsui-'));
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
      if (tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

/* 构造 7 条句子的统计：3 条到期（待复习）、2 条错得多（需巩固）、1 条标熟（已熟练） */
function seed(state) {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now(), DAY = 86400000;
  var sentences = [
    ['Could you tell me where the station is?', '你能告诉我车站在哪里吗？'],
    ['I need to get there before noon.', '我需要在中午前到那里。'],
    ['It looks like it is going to rain.', '看起来要下雨了。'],
    ['She has been working here for three years.', '她在这里工作三年了。'],
    ['We should leave as soon as possible.', '我们应该尽快离开。'],
    ['Let me know if you need any help.', '如果需要帮助就告诉我。'],
    ['The meeting was put off until next week.', '会议推迟到下周了。'],
    ['I would rather stay at home tonight.', '今晚我宁愿待在家里。']
  ];
  var items = sentences.map(function (s, i) {
    return { sentence: s[0], translation: s[1], chunks: [s[0]], hints: [''], cid: 'c' + (i + 1) };
  });
  var stats = !state.empty && {
    totalRounds: 12, totalAnswered: 89, /* = 82 条带日期 + 7 条无日期，让「未记录日期」精确显示 7 */
    bySentence: {
      /* 3 条到期（dueAt 已过）→ 待复习 3 */
      'd1#c1': { deckId: 'd1', deckName: '示例题库', sentence: sentences[0][0], translation: sentences[0][1], times: 6, okTimes: 5, wrongTimes: 1, streak: 2, maxStreak: 3, lastAt: now - 3 * DAY, interval: 3, ease: 2.5, dueAt: now - DAY },
      'd1#c2': { deckId: 'd1', deckName: '示例题库', sentence: sentences[1][0], translation: sentences[1][1], times: 4, okTimes: 3, wrongTimes: 1, streak: 1, maxStreak: 2, lastAt: now - 4 * DAY, interval: 3, ease: 2.5, dueAt: now - DAY },
      'd1#c3': { deckId: 'd1', deckName: '示例题库', sentence: sentences[2][0], translation: sentences[2][1], times: 5, okTimes: 2, wrongTimes: 3, streak: 0, maxStreak: 1, lastAt: now - 5 * DAY, interval: 3, ease: 2.5, dueAt: now - 2 * DAY },
      /* 2 条错得多 → 需巩固 */
      'd1#c4': { deckId: 'd1', deckName: '示例题库', sentence: sentences[3][0], translation: sentences[3][1], times: 3, okTimes: 0, wrongTimes: 3, streak: 0, maxStreak: 0, lastAt: now - 2 * DAY, interval: 1, ease: 2.3, dueAt: now + 2 * DAY },
      'd1#c5': { deckId: 'd1', deckName: '示例题库', sentence: sentences[4][0], translation: sentences[4][1], times: 2, okTimes: 0, wrongTimes: 2, streak: 0, maxStreak: 0, lastAt: now - 1 * DAY, interval: 1, ease: 2.3, dueAt: now + 3 * DAY },
      /* 1 条练得好的 → 学习中/已熟 */
      'd1#c6': { deckId: 'd1', deckName: '示例题库', sentence: sentences[5][0], translation: sentences[5][1], times: 9, okTimes: 9, wrongTimes: 0, streak: 9, maxStreak: 9, lastAt: now - DAY, interval: 30, ease: 2.8, dueAt: now + 29 * DAY }
    },
    /* 未带日期的答题 → 触发「未记录日期」warn 徽标 */
    events: (function () {
      var ev = [], i;
      var perDay = [38, 12, 0, 0, 11, 4, 17]; /* 近 7 天，最后一项是今天 */
      var id = 0;
      for (var d = 0; d < perDay.length; d++) {
        var at = now - (6 - d) * DAY;
        for (i = 0; i < perDay[d]; i++) ev.push({ id: 'e' + (id++), kind: 'answer', key: 'd1#k' + i, ok: true, at: at });
      }
      for (i = 0; i < 7; i++) ev.push({ id: 'u' + i, kind: 'answer', key: 'd1#k' + i, ok: true }); /* 无 at */
      return ev;
    })(),
    daysLog: {}
  };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '示例题库 · 观察用', items: items }],
    best: {},
    mastered: state.empty ? {} : { 'd1#c7': { sentence: sentences[6][0], markedAt: now - DAY } },
    deletedItems: {},
    reinforceBook: state.empty ? [] : [
      { _key: 'd1#c4', deckId: 'd1', sentence: sentences[3][0], translation: sentences[3][1], needsReview: true, mistakes: [{ userAnswer: 'She has worked here', chunk: 'has been working' }] },
      { _key: 'd1#c5', deckId: 'd1', sentence: sentences[4][0], translation: sentences[4][1], needsReview: true, mistakes: [{ userAnswer: 'leave soon', chunk: 'as soon as possible' }] }
    ],
    progress: {},
    stats: state.empty ? { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [], daysLog: {} } : stats,
    settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false }
  }));
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  await startServer();
  console.log('server: ' + BASE);

  const shots = [
    ['01-desktop.png', { empty: false }, { width: 1200, height: 900 }],
    ['02-mobile.png', { empty: false }, { width: 390, height: 844 }],
    ['03-zero.png', { empty: true }, { width: 1200, height: 900 }],
    ['04-narrow.png', { empty: false }, { width: 333, height: 800 }]
  ];
  for (const [file, seedState, viewport] of shots) {
    const ctx = await browser.newContext({ viewport: viewport, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.route('**/api/**', function (r) { r.abort('failed'); });
    await p.route('**/content/**', function (r) { r.abort('failed'); });
    await p.addInitScript(seed, seedState);
    await p.goto(BASE + '/stats.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#statsCards .overview-actions', { timeout: 12000 });
    await p.waitForTimeout(700);
    const probe = await p.evaluate(function () {
      function txt(sel) { var el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; }
      var acts = Array.prototype.map.call(document.querySelectorAll('.overview-actions > .ov-act'), function (el) {
        return {
          n: el.querySelector('.n') ? el.querySelector('.n').textContent.trim() : '',
          l: el.querySelector('.l') ? el.querySelector('.l').textContent.trim() : '',
          disabled: el.disabled,
          chev: !!el.querySelector('.chev svg'),
          nOk: el.querySelector('.n') ? el.querySelector('.n').classList.contains('ok') : false
        };
      });
      var bars = Array.prototype.map.call(document.querySelectorAll('.activity-day'), function (el) {
        var inner = el.querySelector('.activity-track > div');
        return el.querySelector('b').textContent.trim() + '→' + (inner ? inner.style.height : '?');
      });
      /* 柱宽实测：量每列 track 的实际盒宽（零值日不画柱，但 track 仍在，可量） */
      var tracks = Array.prototype.map.call(document.querySelectorAll('.activity-day .activity-track'), function (el) {
        return Math.round(el.getBoundingClientRect().width);
      });
      return {
        trackW: tracks.join('/'),
        acts: acts,
        stats: Array.prototype.map.call(document.querySelectorAll('.overview-status > .ov-stat'), function (el) {
          return el.querySelector('.l').textContent.trim() + '=' + el.querySelector('.n').textContent.trim();
        }),
        month: txt('.overview-month-summary'),
        chartTitle: txt('.activity-section h3'),
        avgLine: !!document.querySelector('.activity-avg'),
        bars: bars,
        labels: txt('.activity-week-labels'),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    await p.screenshot({ path: path.join(OUT, file), fullPage: true });
    console.log('\n=== ' + file + ' (' + viewport.width + 'px) ===');
    console.log('行动卡: ' + JSON.stringify(probe.acts));
    console.log('状态指标: ' + probe.stats.join(' | '));
    console.log('本月: ' + probe.month);
    console.log('图表标题: ' + probe.chartTitle + ' | 均值线: ' + probe.avgLine);
    console.log('柱高: ' + probe.bars.join('  '));
    console.log('柱宽: ' + probe.trackW);
    console.log('日期标签: ' + probe.labels);
    console.log('横向溢出: ' + probe.overflowX);
    await ctx.close();
  }
  await browser.close();
  stopServer();
  console.log('\n截图目录: output/e2e/stats-ui-a/');
})().catch(function (e) { console.error('失败：', e && e.stack || e); stopServer(); process.exit(1); });
