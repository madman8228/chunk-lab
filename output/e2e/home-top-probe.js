/**
 * home-top-probe.js · 首页顶部（今日卡）布局实测探针
 * 目的：在出方案前拿到每个元素的实际盒子，而不是靠读 CSS 推断。
 * 重点验证：「今日 …… 9月14日」之间那段空白到底是谁撑开的（.hc-title 的 auto 宽 + .grow）。
 * 运行：node output/e2e/home-top-probe.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'home-top');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8900, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-hometop-'));
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
      req.on('error', function () { });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { }
}

/* seed：造出「有学习记录」的首页 —— totalAnswered>0 触发 has-activity，
 * best.lastPlayed 让「最近练习」出现 2 行，daysLog 让月历有热度。 */
function init(opts) {
  var o = opts || {};
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now(), day = 86400000;
  var events = [], i;
  /* 「今日答题」= dailyActivity 里今天的 events 条数（core.js:2486 逐条累加；
     stats.daysLog[k].answered 会被初始化成 0 后忽略，只有 rounds 有效）。
     与老板截图对齐：今日 17 句。 */
  var _nToday = o.todayZero ? 0 : 17;
  for (i = 0; i < _nToday; i++) events.push({ id: 'e' + i, kind: 'answer', key: 'd1#k' + (i % 30), ok: true, at: now - i * 60000 });
  /* 造出与老板截图同规模的真实计数：38 待复习 + 12 错题本。
     due 口径见 main.html computeToday()：bySentence 中 CL.srs.isDue(st, now) 为真者才算到期。 */
  var bySentence = {};
  for (i = 0; i < 38; i++) bySentence['d1#p1-' + i] = { deckId: 'd1', times: 2, okTimes: 2, lastAt: now - 10 * day, dueAt: now - day, interval: 1, ease: 2.5, repetition: 1 };
  var book = [];
  for (i = 0; i < 12; i++) book.push('d1#p1-' + i);
  var mk = function (id, name, lp) {
    var items = [];
    for (var k = 0; k < 389; k++) items.push({ sentence: 'Probe sentence ' + k + '.', translation: '探针第 ' + k + ' 句。', chunks: ['Probe sentence', k + '.'], hints: ['', ''], cid: 'p1-' + k });
    return { id: id, name: name, items: items, lastPlayed: lp };
  };
  var d1 = mk('d1', '高频短语', now - 1000);
  var d2 = mk('d2', '日常对话', now - 5000);
  var best = {};
  best['d1'] = { lastPlayed: now - 1000, idx: 61, answered: 20, correct: 17 };
  best['d2'] = { lastPlayed: now - 5000, idx: 41, answered: 20, correct: 18 };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [d1, d2],
    best: best,
    mastered: {},
    deletedItems: {},
    reinforceBook: book,
    progress: {},
    stats: {
      totalRounds: 12, totalAnswered: 120, bySentence: bySentence, events: events,
      daysLog: {
        [ymd(now)]: { answered: 17, rounds: 1 },
        [ymd(now - day)]: { answered: 11, rounds: 1 },
        [ymd(now - day * 2)]: { answered: 4, rounds: 1 },
        [ymd(now - day * 5)]: { answered: 12, rounds: 1 },
        [ymd(now - day * 6)]: { answered: 38, rounds: 2 },
        [ymd(now - day * 7)]: { answered: 9, rounds: 1 }
      }
    },
    settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false, dailyGoal: o.noGoal ? 0 : 20 }
  }));
  function ymd(ts) {
    var d = new Date(ts), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  await startServer();
  console.log('server: ' + BASE);

  const views = [
    ['1200', { width: 1200, height: 900 }, {}],
    ['1000', { width: 1000, height: 900 }, {}],
    ['390', { width: 390, height: 844 }, {}],
    /* 未设每日目标 → 应渲染 .home-today-done（只报数），且 .home-goal 必须不存在 */
    ['1200-nogoal', { width: 1200, height: 900 }, { noGoal: true }],
    /* 未设目标 + 今日 0 句 → .home-today-done 也必须不渲染（不出现「今日已练 0 句」）。 */
    ['1200-today0', { width: 1200, height: 900 }, { noGoal: true, todayZero: true }]
  ];

  for (const [tag, viewport, seedOpts] of views) {
    const ctx = await browser.newContext({ viewport: viewport, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.route('**/api/**', function (r) { r.abort('failed'); });
    await p.route('**/content/**', function (r) { r.abort('failed'); });
    await p.addInitScript(init, seedOpts);
    await p.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#homeBody .home-today-card', { timeout: 12000 });
    await p.waitForTimeout(800);

    const probe = await p.evaluate(function () {
      function box(el) {
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
      }
      function cs(el, prop) { return el ? getComputedStyle(el)[prop] : null; }
      /* 文字盒必须用 Range 量：.n/.l 在 flex 列容器里会被 stretch 到全宽，
         直接量元素盒子得到的是「盒子」而不是「文字」→ 会误判居中。 */
      function textBox(el) {
        if (!el) return null;
        var rg = document.createRange();
        rg.selectNodeContents(el);
        var r = rg.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.left + r.width / 2) };
      }
      var hero = document.querySelector('.home-hero');
      var heroBox = box(hero);
      var heroDateBox = textBox(document.querySelector('.home-hero .hh-date'));
      var heroStreakEl = document.querySelector('.home-hero .cal-streak');
      var heroStreakBox = textBox(heroStreakEl);
      var card = document.querySelector('.home-today-card');
      var counts = document.querySelector('.home-today-counts');
      var htcs = Array.prototype.map.call(document.querySelectorAll('.home-today-counts .htc'), function (el) {
        var n = el.querySelector('.n'), l = el.querySelector('.l'), ch = el.querySelector('.chev');
        var cb = box(el), nb = textBox(n), lb = textBox(l);
        return {
          label: l ? l.textContent.trim() : '', box: cb, nBox: box(n), lBox: box(l),
          nText: nb, lText: lb,
          stacked: (nb && lb) ? (lb.y >= nb.y + nb.h - 1) : null,
          centerDelta: (nb && cb) ? Math.round(nb.cx - (cb.x + cb.w / 2)) : null,
          chev: !!ch, display: cs(el, 'display'), direction: cs(el, 'flexDirection'),
          nSize: cs(n, 'fontSize'), lSize: cs(l, 'fontSize'), lColor: cs(l, 'color'), nColor: cs(n, 'color')
        };
      });
      var merge = document.querySelector('.home-card.merge-row');
      return {
        pageW: document.documentElement.clientWidth,
        hero: heroBox,
        heroDate: heroDateBox,
        heroStreak: heroStreakBox,
        card: box(card),
        cardPad: cs(card, 'padding'),
        cardDisplay: cs(card, 'display'),
        counts: box(counts),
        countsDisplay: cs(counts, 'display'),
        htcs: htcs,
        goalPresent: !!document.querySelector('.home-goal'),
        goalBox: box(document.querySelector('.home-goal')),
        donePresent: !!document.querySelector('.home-today-done'),
        doneText: (document.querySelector('.home-today-done') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
        merge: box(merge),
        mergeCols: merge ? getComputedStyle(merge).gridTemplateColumns : null,
        streak: box(document.querySelector('.cal-streak')),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });

    console.log('\n=== ' + tag + 'px (视口 ' + viewport.width + ') ===');
    console.log('标题行      : ' + JSON.stringify(probe.hero));
    console.log('  日期       : ' + JSON.stringify(probe.heroDate));
    console.log('  连续天数   : ' + JSON.stringify(probe.heroStreak));
    console.log('今日卡      : ' + JSON.stringify(probe.card) + '  display=' + probe.cardDisplay + ' padding=' + probe.cardPad);
    console.log('计数区      : ' + JSON.stringify(probe.counts) + ' display=' + probe.countsDisplay);
    probe.htcs.forEach(function (h, i) {
      console.log('  [' + i + '] ' + h.label + ' 卡 ' + JSON.stringify(h.box) + ' chevron=' + h.chev + ' direction=' + h.direction
        + '\n      数字文字 ' + JSON.stringify(h.nText) + '  字号 ' + h.nSize + ' 色 ' + h.nColor
        + '\n      标签文字 ' + JSON.stringify(h.lText) + '  字号 ' + h.lSize + ' 色 ' + h.lColor
        + '\n      上下堆叠=' + h.stacked + '  数字居中偏差=' + h.centerDelta + 'px');
    });
    console.log('目标进度    : present=' + probe.goalPresent + ' ' + JSON.stringify(probe.goalBox));
    console.log('今日已练行  : present=' + probe.donePresent + ' "' + probe.doneText + '"');
    console.log('合并卡      : ' + JSON.stringify(probe.merge) + '  cols=' + probe.mergeCols);
    console.log('连续N天     : ' + JSON.stringify(probe.streak));
    console.log('横向溢出    : ' + probe.overflowX);
    await p.screenshot({ path: path.join(OUT, 'view-' + tag + '.png'), fullPage: true });
    await ctx.close();
  }

  await browser.close();
  stopServer();
  console.log('\n截图 -> ' + OUT);
})().catch(function (e) { console.error(e); stopServer(); process.exit(1); });
