/* ux-audit-shots.js · UI/UX 实测截图 + 元素度量（只读，不改源码）
 *
 * 环境约定（务必遵守，否则白干）：
 *   - 用 e2e/lib/free-port 的 freePort 选端口（宿主机 8933 被占、9042/9128 僵尸监听）
 *   - 注入 stats 走「独立 browser context」：每场景新建 context，互不污染
 *   - server 用 server/index.js（同 home-today-entries.test.js 骨架）
 *   - 截图存 output/ux-audit/ ；元素度量存 output/ux-audit/metrics.json
 *
 * 覆盖：
 *   390px 手机视口：main 首页/练习/结算/设置弹层 + decks/stats/courses/diagnose 首屏
 *   1024px 桌面视口：main 首页 + decks/stats/courses/diagnose 首屏
 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'output', 'ux-audit');
fs.mkdirSync(OUT, { recursive: true });
/* 从 output/e2e/ 回仓库根要两级，再进 e2e/lib/ —— 原先写的 './lib/free-port'
   是 e2e/ 搬到 e2e/ 之前的位置，搬家后没跟着改（2026-09-16 修）。 */
const PORT = require('../../e2e/lib/free-port').freePort(9500, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-uxaudit-'));
const LOG = fs.createWriteStream(path.join(OUT, 'run.log'), { flags: 'w' });
function log() { const s = util_format(arguments); LOG.write(s + '\n'); console.log(s); }
function util_format(args) { return Array.prototype.map.call(args, function (a) { return typeof a === 'string' ? a : JSON.stringify(a); }).join(' '); }

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1024, height: 768 };

let server = null, browser = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 50) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

/* ===== 注入数据（每场景独立 context） ===== */

/* 主存储：2 个用户题库 + 一组 stats（含到期/需巩固/已熟）+ 错题本 3 条 */
function initMain() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  function mk(sentence, translation, chunks, dueAt, times, ok, wrong) {
    var cid = fnv8(sentence);
    return {
      item: { sentence: sentence, translation: translation, chunks: chunks, hints: chunks.map(function () { return ''; }), cid: cid },
      stat: { deckId: 'd1', deckName: '日常对话', sentence: sentence, translation: translation, chunks: chunks, hints: chunks.map(function () { return ''; }), times: times, okTimes: ok, wrongTimes: wrong, streak: ok >= 3 ? 3 : 0, maxStreak: ok >= 3 ? 3 : 0, lastAt: now, interval: 1, ease: 2.5, dueAt: dueAt }
    };
  }
  var items = [
    mk('How are you doing today?', '你今天过得怎么样？', ['How are', 'you doing today?'], now - 10000, 3, 3, 0),
    mk('I would like a cup of coffee.', '我想要一杯咖啡。', ['I would like', 'a cup of coffee.'], now - 10000, 3, 3, 0),
    mk('Could you please open the window?', '你能打开窗户吗？', ['Could you please', 'open the window?'], now - 10000, 2, 2, 0),
    mk('We should finish this report by Friday.', '我们应该周五前完成报告。', ['We should finish', 'this report by Friday.'], now - 10000, 4, 4, 0),
    mk('She has been working here for years.', '她在这里工作很多年了。', ['She has been', 'working here for years.'], now - 10000, 3, 3, 0),
    /* 需巩固（acc<1，但 dueAt 在未来 → 不计入首页 due） */
    mk('They decided to cancel the meeting.', '他们决定取消会议。', ['They decided', 'to cancel the meeting.'], now + 86400000, 2, 1, 1),
    mk('He forgot to bring his laptop.', '他忘了带笔记本。', ['He forgot', 'to bring his laptop.'], now + 86400000, 3, 2, 1),
    mk('We were surprised by the news.', '我们对这消息感到惊讶。', ['We were', 'surprised by the news.'], now + 86400000, 2, 1, 1),
    /* 已熟（streak>=3） */
    mk('Nice to meet you.', '很高兴见到你。', ['Nice to', 'meet you.'], now + 86400000, 5, 5, 0),
    mk('Thank you very much.', '非常感谢。', ['Thank you', 'very much.'], now + 86400000, 6, 6, 0),
    mk('See you later.', '回头见。', ['See you', 'later.'], now + 86400000, 4, 4, 0),
    mk('Have a good day.', '祝你有美好的一天。', ['Have a', 'good day.'], now + 86400000, 5, 5, 0)
  ];
  var by = {};
  var d1items = [];
  items.forEach(function (m) { by['d1#' + m.stat.sentence ? 'd1#' + fnv8(m.stat.sentence) : ''] = m.stat; d1items.push(m.item); });
  /* 上面写法键重复，重新用正确键 */
  by = {};
  items.forEach(function (m) { by['d1#' + fnv8(m.stat.sentence)] = m.stat; });
  var book = [
    { _key: 'd1::' + items[5].stat.sentence, deckId: 'd1', deckName: '日常对话', sentence: items[5].stat.sentence, translation: items[5].stat.translation, chunks: items[5].stat.chunks, hints: items[5].stat.hints, mistakes: [{ chunkIdx: 0, chunk: items[5].stat.chunks[0], userAnswer: '', hint: '' }] },
    { _key: 'd1::' + items[6].stat.sentence, deckId: 'd1', deckName: '日常对话', sentence: items[6].stat.sentence, translation: items[6].stat.translation, chunks: items[6].stat.chunks, hints: items[6].stat.hints, mistakes: [{ chunkIdx: 0, chunk: items[6].stat.chunks[0], userAnswer: '', hint: '' }] },
    { _key: 'd1::' + items[7].stat.sentence, deckId: 'd1', deckName: '日常对话', sentence: items[7].stat.sentence, translation: items[7].stat.translation, chunks: items[7].stat.chunks, hints: items[7].stat.hints, mistakes: [{ chunkIdx: 0, chunk: items[7].stat.chunks[0], userAnswer: '', hint: '' }] }
  ];
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [
      { id: 'd1', name: '日常对话', items: d1items },
      { id: 'd2', name: '口语口头禅', items: [
        { sentence: 'What a small world!', translation: '世界真小！', chunks: ['What a', 'small world!'], hints: ['', ''], cid: fnv8('What a small world!') },
        { sentence: 'Long time no see.', translation: '好久不见。', chunks: ['Long time', 'no see.'], hints: ['', ''], cid: fnv8('Long time no see.') }
      ] }
    ],
    best: { d1: { lastPlayed: now - 3600000, lastAcc: 92 }, d2: { lastPlayed: now - 86400000, lastAcc: 88 } },
    mastered: {}, deletedItems: {}, reinforceBook: book,
    stats: { totalRounds: 7, totalAnswered: 142, bySentence: by, events: [] },
    settings: { mode: 'choose', skipMastered: true, batchSize: 10, sound: true, fxStack: true, celebrate: 'confetti', autoSpeak: false, darkMode: false }
  }));
}

function initCourses() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var course = {
    courseId: 'c1',
    metadata: { title: { 'zh-CN': '测试图文课程', en: 'Test Course' }, targetCefr: 'A2' },
    lib: { seriesId: 's-other', seriesName: '其他课程', volumeIndex: 1, volumeName: '第一册', sortOrder: 0 },
    story: {
      startNodeId: 'n1',
      nodes: [
        { id: 'n1', type: 'dialogue', speakerId: 'npc', npcMessage: 'Hello, how can I help you?', sourceText: '你好，我能帮你什么？', input: { prompt: '补全对话' }, clozeTemplate: 'Hello, how ___ I help you?', gaps: [{ id: 'g1', correctChoiceId: 'a', choices: [{ id: 'a', text: 'can' }, { id: 'b', text: 'may' }] }], transitions: [{ toNodeId: 'n2' }] },
        { id: 'n2', type: 'dialogue', speakerId: 'learner', npcMessage: 'What is your name?', sourceText: '你叫什么名字？', input: { prompt: '补全对话' }, clozeTemplate: 'What ___ your name?', gaps: [{ id: 'g1', correctChoiceId: 'a', choices: [{ id: 'a', text: 'is' }, { id: 'b', text: 'are' }] }], transitions: [] }
      ]
    }
  };
  localStorage.setItem('chunklab.courses.v1', JSON.stringify([course]));
  localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({ c1: { seen: ['n1'], completed: false } }));
}

function initDiag() {
  /* 复用主存储，外加 courses/progress/reinforce 以便 diagnose 各卡片有数据 */
  initMain.toString; /* noop */
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var course = { courseId: 'c1', metadata: { title: { 'zh-CN': '测试图文课程' } }, lib: { seriesId: 's-other', seriesName: '其他课程', volumeIndex: 1, volumeName: '第一册' }, story: { startNodeId: 'n1', nodes: [{ id: 'n1' }, { id: 'n2' }] } };
  localStorage.setItem('chunklab.courses.v1', JSON.stringify([course]));
  localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({ c1: { seen: ['n1'], completed: false } }));
  localStorage.setItem('chunklab_reinforce', JSON.stringify([{ sentence: 'x' }]));
  /* 主题库存储 */
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '日常对话', items: [{ sentence: 'Hi.', chunks: ['Hi.'], hints: [''], cid: fnv8('Hi.') }] }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 3, totalAnswered: 40, bySentence: {}, events: [] },
    settings: {}
  }));
}

/* ===== 度量收集 ===== */
async function collectMetrics(page, vp) {
  return await page.evaluate(function (vp) {
    const sels = 'a,button,[role="button"],input[type="checkbox"],select,.btn,.tab,.htc,.home-card button,.deck-item,.srow,.course-row,.action-button,.back,.icon-action';
    const out = [];
    document.querySelectorAll(sels).forEach(function (el) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      let cls = '';
      try { cls = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : (el.className || ''); } catch (e) { cls = ''; }
      out.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        cls: String(cls).slice(0, 48),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        inView: (r.top >= 0 && r.bottom <= vp.h && r.left >= 0 && r.right <= vp.w)
      });
    });
    const de = document.documentElement;
    return { els: out, overflow: de.scrollWidth - de.clientWidth, scrollW: de.scrollWidth, clientW: de.clientWidth };
  }, vp);
}

async function shoot(page, name) {
  const p = path.join(OUT, name + '.png');
  await page.screenshot({ path: p, fullPage: false });
  log('  · 截图 ' + name + '.png');
}

/* ===== 场景定义 ===== */
const shots = [
  { name: 'm-main-home', url: '/main.html', vp: MOBILE, init: 'main', wait: '#homeBody', action: null },
  { name: 'm-main-practice', url: '/main.html', vp: MOBILE, init: 'main', wait: '#homeBody', action: 'due' },
  { name: 'm-main-result', url: '/main.html', vp: MOBILE, init: 'main', wait: '#homeBody', action: 'result' },
  { name: 'm-main-settings', url: '/main.html', vp: MOBILE, init: 'main', wait: '#homeBody', action: 'settings' },
  { name: 'm-decks', url: '/decks.html', vp: MOBILE, init: 'main', wait: '#deckList', action: null },
  { name: 'm-stats', url: '/stats.html', vp: MOBILE, init: 'main', wait: '#statsCards', action: null },
  { name: 'm-courses', url: '/courses.html', vp: MOBILE, init: 'courses', wait: '#coursePlayer', action: null },
  { name: 'm-diagnose', url: '/diagnose.html', vp: MOBILE, init: 'diag', wait: '#coursesList', action: null },
  { name: 'd-main-home', url: '/main.html', vp: DESKTOP, init: 'main', wait: '#homeBody', action: null },
  { name: 'd-decks', url: '/decks.html', vp: DESKTOP, init: 'main', wait: '#deckList', action: null },
  { name: 'd-stats', url: '/stats.html', vp: DESKTOP, init: 'main', wait: '#statsCards', action: null },
  { name: 'd-courses', url: '/courses.html', vp: DESKTOP, init: 'courses', wait: '#coursePlayer', action: null },
  { name: 'd-diagnose', url: '/diagnose.html', vp: DESKTOP, init: 'diag', wait: '#coursesList', action: null }
];

const inits = { main: initMain, courses: initCourses, diag: initDiag };

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const metrics = {};
    for (const s of shots) {
      log('== ' + s.name + ' (' + s.vp.width + 'x' + s.vp.height + ') ==');
      const ctx = await browser.newContext({ viewport: s.vp });
      const page = await ctx.newPage();
      await page.route('**/api/**', function (r) { r.abort('failed'); });
      await page.addInitScript(inits[s.init]);
      const errs = [];
      page.on('pageerror', function (e) { errs.push(e.message); });
      try {
        await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded' });
        try { await page.waitForSelector(s.wait, { timeout: 9000 }); } catch (e) { log('  ! wait ' + s.wait + ' 超时（继续截图）'); }
        await page.waitForTimeout(900);
        if (s.action === 'due') {
          try { await page.click('#homeBtnDue', { timeout: 6000 }); await page.waitForSelector('#pagePractice:not(.hidden)', { timeout: 8000 }); log('  · 已进入练习页'); }
          catch (e) { log('  ! due 点击失败: ' + (e && e.message)); }
        } else if (s.action === 'result') {
          try {
            await page.click('#homeBtnDue', { timeout: 6000 });
            await page.waitForSelector('#pagePractice:not(.hidden)', { timeout: 8000 });
            await page.evaluate(function () { try { if (window.finishSession) finishSession(); } catch (e) { console.error('finishSession', e); } });
            await page.waitForTimeout(500);
            const vis = await page.evaluate(function () { var r = document.getElementById('result'); return r && !r.classList.contains('hidden'); });
            log('  · 结算页可见=' + vis);
          } catch (e) { log('  ! result 失败: ' + (e && e.message)); }
        } else if (s.action === 'settings') {
          try { await page.click('#btnSettingsTop', { timeout: 6000 }); await page.waitForSelector('#settingsMask:not([hidden])', { timeout: 8000 }); log('  · 设置弹层已开'); }
          catch (e) { log('  ! settings 失败: ' + (e && e.message)); }
        }
        await page.waitForTimeout(400);
        await shoot(page, s.name);
        metrics[s.name] = await collectMetrics(page, s.vp);
        metrics[s.name].pageErrors = errs.slice(0, 5);
      } catch (e) {
        log('  ! 场景异常: ' + (e && e.stack || e));
      }
      await ctx.close();
    }
    fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2));
    log('[ux-audit] 完成，截图 ' + shots.length + ' 张，metrics.json 已写。');
    await browser.close(); browser = null; stopServer();
    process.exit(0);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
    log('[ux-audit] FAIL: ' + (err && err.stack || err));
    process.exit(1);
  }
})();
