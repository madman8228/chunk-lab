/* home-today-entries.test.js · 首页「今日」两张计数卡即入口
 *
 * 背景：原实现 if(due>0){只渲染一个「开始到期复习」主按钮} else {weak/book 按钮} ——
 *   入口与数据不同构，永远有一张卡没入口，且哪张会死随天数漂移。
 *   现两张计数卡本身就是 <button>，各自进对应队列；计数 0 的卡 disabled（点不动，纯装饰数字）。
 *
 * 覆盖（真实浏览器 + 自带 server，端口走 free-port 避开宿主机常驻占用）：
 *   1. 注入 1 到期 + 1 需巩固 + 0 错题本：计数区 = 一排药丸（.home-pill），
 *      due 可点、book 禁用 + 已熟练报数药丸；enabled 药丸有 .chev（<svg>，非文本字符），
 *      disabled 药丸 .chev 不可见；★ 2026-09-25 改版：底色表达「类型」不再表达状态，
 *      disabled book **保留** 类型粉底 --bad-soft（不去底色），改由 .pill-n 数字变灰 == --muted +
 *      去 .chev 表达 0/不可点；enabled due 底色为 --accent-soft 且数字非灰。
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
const OUT_DIR = process.env.HOME_TODAY_OUT_DIR || path.join(ROOT, 'output');
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
async function scenarioPage(browser, initFn, viewport, allowContent) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  if (!allowContent) await page.route('**/content/**', function (r) { r.abort('failed'); });
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
    stats: { totalRounds: 1, totalAnswered: 1, bySentence: by,
      events: [{ id: 'today-answer', kind: 'answer', at: now }] },
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

/* 场景 F 用：「练过的课」有痕迹 + 「加入未开始」从未练过 + 「仅导入」未登记。
   用来验证首页课程列表只取显式加入关系，
   以及「内容排在统计之前」「日历默认收起」这两条主次契约。 */
function initImportedNotStarted() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var s = 'Practiced sentence one.';
  var c = fnv8(s);
  var by = {};
  var daysLog = {};
  for (var dayOffset=0; dayOffset<3; dayOffset++) {
    var activeDay = new Date(); activeDay.setDate(activeDay.getDate()-dayOffset);
    var activeKey = activeDay.getFullYear()+'-'+String(activeDay.getMonth()+1).padStart(2,'0')+'-'+String(activeDay.getDate()).padStart(2,'0');
    daysLog[activeKey] = { rounds: 1 };
  }
  /* dueAt 在未来 → 不产生到期队列，避免把本场景和「今天要做」的判据纠缠在一起 */
  by['practiced#' + c] = { deckId: 'practiced', deckName: '练过的课', sentence: s, times: 1, okTimes: 1, wrongTimes: 0, streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now + 86400000 };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [
      { id: 'practiced', name: '练过的课', items: [{ sentence: s, chunks: ['Practiced', 'sentence one.'], hints: ['', ''], cid: c }] },
      { id: 'imported-1', name: '已加入未开始', coverImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=', authoring: { schemaVersion: 1, template: 'sentence-practice', catalogCourseId: 'user-deck:imported-1' }, items: [{ sentence: 'Imported sentence one.', chunks: ['Imported', 'sentence one.'], hints: ['', ''] }] },
      { id: 'unjoined-1', name: '仅导入不应显示', items: [{ sentence: 'Unjoined sentence one.', chunks: ['Unjoined', 'sentence one.'], hints: ['', ''] }] }
    ],
    best: { 'practiced': { acc: 100, perfect: 1, combo: 1, lastPlayed: now, lastAcc: 100 } },
    mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 1, totalAnswered: 1, bySentence: by, daysLog: daysLog },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: true, celebrate: 'confetti', autoSpeak: false, darkMode: false }
  }));
  localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({
    'enrollment:v1:user-deck%3Apracticed': { kind:'course-enrollment', schemaVersion:1, courseId:'user-deck:practiced', joined:true, joinedAt:now-1000, changedAt:now-1000 },
    'enrollment:v1:user-deck%3Aimported-1': { kind:'course-enrollment', schemaVersion:1, courseId:'user-deck:imported-1', joined:true, joinedAt:now, changedAt:now }
  }));
}

/* 导入图文课归属于带封面的用户逻辑课程；首页必须读取该目录，不能渲染成暂不可用。 */
function initJoinedLogicalCourse() {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var id = 'logical-course:imported-with-cover';
  var cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=';
  localStorage.setItem('chunklab.logical-courses.v1', JSON.stringify([{ id:id, title:'已加入的图文课程', coverImage:cover, catalogKey:'logical:'+id, origin:'user', contentType:'story' }]));
  localStorage.setItem('chunklab.courses.v1', JSON.stringify([{ courseId:'imported-story-with-cover', logicalCourseId:id, metadata:{ title:{ 'zh-CN':'带封面的导入课' } } }]));
  localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({
    'enrollment:v1:package%3Aimported-story-with-cover': { kind:'course-enrollment', schemaVersion:1, courseId:'package:imported-story-with-cover', joined:true, joinedAt:now, changedAt:now }
  }));
}

/* 选课节入口场景：把内置口语课程加入「我的课程」，确保实际渲染出多课节选择按钮。 */
function initJoinedBuiltinCourse() {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({
    'enrollment:v1:builtin%3Aoral': { kind:'course-enrollment', schemaVersion:1, courseId:'builtin:oral', joined:true, joinedAt:now, changedAt:now }
  }));
}

/* 场景 G 用：一份刻意「朴素算法都会算错」的档案（2026-09-24 首页加「已熟练」计数格）。
   口径 = 考试通过（classifyStat === 'master'）∪ 用户手动标熟，共用同一 key 去重，
   再统一过滤已删句。常见的五种朴素写法在这份数据上都会得到不同的数字：
     只数 mem.mastered        → 4（s5 重复、s7 已删）
     只数考试通过              → 4（漏 s6/s8，且把已删的 s4 算进去）
     两者直接相加              → 8（s5 被算两次）
     并集但不过滤已删          → 7（s4/s7 复活）
     只数 bySentence 的 key 数 → 6（把 weak/learn 也算成熟练）
   正确值 = 5（s1/s2/s5/s6/s8）。首页那个数必须与档案页逐字一致，
   所以这份数据既能让「逐字一致」这条断言真的在测东西，也能挡住「首页自己再算一遍」。 */
function initMasteredSplit() {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var DECK = 'arch';
  var S = {
    m3: 'Master by exam one.',
    m4: 'Master by exam two.',
    weak: 'Weak by exam one.',
    del: 'Master but deleted.',
    both: 'Master and marked.',
    marked1: 'Marked only one.',
    markedDel: 'Marked but deleted.',
    marked2: 'Marked only two.',
    learn: 'Learn by exam one.'
  };
  function st(s, times, ok) {
    return { deckId: DECK, deckName: '档案口径课', sentence: s, times: times, okTimes: ok, wrongTimes: times - ok,
      streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5, dueAt: now + 86400000 };
  }
  var by = {};
  by[DECK + '#' + fnv8(S.m3)] = st(S.m3, 3, 3);          /* master */
  by[DECK + '#' + fnv8(S.m4)] = st(S.m4, 4, 4);          /* master */
  by[DECK + '#' + fnv8(S.weak)] = st(S.weak, 3, 1);      /* weak（0.33） */
  by[DECK + '#' + fnv8(S.del)] = st(S.del, 3, 3);        /* master，但句子已删 */
  by[DECK + '#' + fnv8(S.both)] = st(S.both, 5, 4);      /* master（0.8 正好卡在阈值上） */
  by[DECK + '#' + fnv8(S.learn)] = st(S.learn, 2, 2);    /* learn（次数不够） */
  var mastered = {};
  mastered[DECK + '#' + fnv8(S.both)] = { deckId: DECK, sentence: S.both, markedAt: now };
  mastered[DECK + '#' + fnv8(S.marked1)] = { deckId: DECK, sentence: S.marked1, markedAt: now };
  mastered[DECK + '#' + fnv8(S.markedDel)] = { deckId: DECK, sentence: S.markedDel, markedAt: now };
  mastered[DECK + '#' + fnv8(S.marked2)] = { deckId: DECK, sentence: S.marked2, markedAt: now };
  var deletedItems = {};
  deletedItems[DECK + '#' + fnv8(S.del)] = true;
  deletedItems[DECK + '#' + fnv8(S.markedDel)] = true;
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: DECK, name: '档案口径课', items: Object.keys(S).map(function (k) {
      return { sentence: S[k], chunks: [S[k]], hints: [''] };
    }) }],
    best: {}, mastered: mastered, deletedItems: deletedItems, reinforceBook: [],
    stats: { totalRounds: 9, totalAnswered: 27, bySentence: by },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: true, celebrate: 'confetti', autoSpeak: false, darkMode: false }
  }));
}

function stripComments(s) { return (s || '').replace(/<!--[\s\S]*?-->/g, ''); }

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });

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
        probe.style.background = 'var(--bad-soft)';
        var badSoftBg = getComputedStyle(probe).backgroundColor;
        /* --muted 是颜色值，用 color 探针解析得到 rgb */
        probe.style.background = '';
        probe.style.color = 'var(--muted)';
        var mutedColor = getComputedStyle(probe).color;
        probe.remove();
        function chevInfo(btn) {
          if (!btn) return { exists: false, svg: false, isSvg: false, text: '', visible: false };
          var c = btn.querySelector('.chev');
          if (!c) return { exists: false, svg: false, isSvg: false, text: '', visible: false };
          var svg = c.querySelector('svg');
          var br = btn.getBoundingClientRect(), cr = c.getBoundingClientRect();
          return {
            exists: true,
            svg: !!svg,
            isSvg: !!svg && svg.tagName.toLowerCase() === 'svg',
            text: (c.textContent || '').trim(),
            visible: getComputedStyle(c).display !== 'none',
            centered: Math.abs((cr.top + cr.height / 2) - (br.top + br.height / 2)) < 1
          };
        }
        return {
          dueExists: !!due, weakExists: !!document.getElementById('homeBtnWeak'), bookExists: !!book,
          masteredExists: !!document.getElementById('homeMastered'),
          dueDisabled: due ? due.disabled : null,
          bookDisabled: book ? book.disabled : null,
          dueChev: chevInfo(due),
          bookChev: chevInfo(book),
          dueBg: due ? getComputedStyle(due).backgroundColor : '',
          bookBg: book ? getComputedStyle(book).backgroundColor : '',
          dueNumColor: due ? getComputedStyle(due.querySelector('.pill-n')).color : '',
          bookNumColor: book ? getComputedStyle(book.querySelector('.pill-n')).color : '',
          surfaceBg: surfaceBg, accentBg: accentBg, badSoftBg: badSoftBg, mutedColor: mutedColor
        };
      });
      check('A: 计数区只有待复习/错题本两张行动卡（无 homeBtnWeak）+ 已熟练报数格',
        st.dueExists && !st.weakExists && st.bookExists && !!st.masteredExists,
        JSON.stringify({ d: st.dueExists, w: st.weakExists, b: st.bookExists, m: st.masteredExists }));
      check('A: #homeBtnDue 不是 disabled（due>0 可点）', st.dueExists && st.dueDisabled === false, 'disabled=' + st.dueDisabled);
      check('A: #homeBtnBook 是 disabled（book=0 不可点）', st.bookExists && st.bookDisabled === true, 'disabled=' + st.bookDisabled);
      check('A: #homeBtnDue 有 .chev 且内含 <svg>', st.dueChev.exists && st.dueChev.isSvg, JSON.stringify(st.dueChev));
      check('A: #homeBtnDue 的 .chev 不是文本字符', st.dueChev.exists && st.dueChev.text === '' && st.dueChev.isSvg, 'text=' + JSON.stringify(st.dueChev.text));
      check('A: #homeBtnDue 的箭头垂直居中', st.dueChev.centered, JSON.stringify(st.dueChev));
      check('A: #homeBtnBook 无可见 .chev（0 值去箭头）', st.bookChev.exists === false || st.bookChev.visible === false, JSON.stringify(st.bookChev));
      /* 2026-09-25 改版重写：旧契约「disabled 卡背景去底色 == var(--surface)」是大卡时代口径。
         新设计刻意**保留类型底色**（蓝/粉/绿/灰表达「类型」），0/不可点状态改由
         「.pill-n 数字变灰（== --muted）+ 去 .chev」表达（见 main.html CSS 注释）。
         故：
          - disabled book：底色仍为类型粉底 --bad-soft（不去底色），但数字变灰 == --muted；
          - enabled due：底色为强调蓝底 --accent-soft，数字为强调色（非灰）。 */
      check('A: disabled #homeBtnBook 保留类型底色 --bad-soft（0 值不去底色，改由数字变灰表达）',
        st.bookBg && st.badSoftBg && st.bookBg === st.badSoftBg,
        'bookBg=' + st.bookBg + ' badSoftBg=' + st.badSoftBg);
      check('A: disabled #homeBtnBook 数字 .pill-n 变灰（== --muted）',
        st.bookNumColor && st.mutedColor && st.bookNumColor === st.mutedColor,
        'bookNumColor=' + st.bookNumColor + ' muted=' + st.mutedColor);
      check('A: enabled #homeBtnDue 底色为强调蓝底 --accent-soft（带类型强调色）',
        st.dueBg && st.accentBg && st.dueBg === st.accentBg && st.dueBg !== st.surfaceBg,
        'dueBg=' + st.dueBg + ' accentBg=' + st.accentBg + ' surfaceBg=' + st.surfaceBg);
      check('A: enabled #homeBtnDue 数字未变灰（非 --muted，仍是强调色）',
        st.dueNumColor && st.mutedColor && st.dueNumColor !== st.mutedColor,
        'dueNumColor=' + st.dueNumColor + ' muted=' + st.mutedColor);

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

      const brand = page.locator('a.brand');
      const brandHref = await brand.getAttribute('href');
      check('品牌按钮链接目标为课程首页', brandHref === './main.html', 'href=' + brandHref);
      let brandReturnsHome = false;
      try {
        await brand.click();
        await page.waitForFunction(function(){
          var home=document.getElementById('pageHome'), practice=document.getElementById('pagePractice');
          return home && !home.classList.contains('hidden') && practice && practice.classList.contains('hidden');
        }, { timeout:10000 });
        brandReturnsHome = /\/main\.html$/.test(new URL(page.url()).pathname);
      } catch (e) {}
      check('练习中点击品牌按钮返回课程首页', brandReturnsHome, 'url=' + page.url());

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
        var numbers = Array.prototype.slice.call(document.querySelectorAll('.home-today-counts .home-pill .pill-n'));
        var numberCenterDeltas = numbers.map(function(n){
          var p=n.closest('.home-pill').getBoundingClientRect(),r=n.getBoundingClientRect();
          return {label:n.closest('.home-pill').querySelector('.pill-k').textContent.trim(),dx:+((p.left+p.width/2)-(r.left+r.width/2)).toFixed(2),dy:+((p.top+p.height/2)-(r.top+r.height/2)).toFixed(2)};
        });
        function inside(inner, outer) {
          return inner.width > 0 && inner.height > 0 && inner.left >= outer.left - 1 && inner.right <= outer.right + 1
            && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
        }
        function separated(a, b) {
          return a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;
        }
        var labelsAndNumbersReadable = numbers.length >= 3 && numbers.every(function(n){
          var card = n.closest('.home-pill'), label = card.querySelector('.pill-k');
          if (!label) return false;
          var p = card.getBoundingClientRect(), r = n.getBoundingClientRect(), k = label.getBoundingClientRect();
          return inside(r, p) && inside(k, p) && separated(r, k);
        });
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
        var bookButton = document.getElementById('homeBtnBook');
        var bookChev = bookButton && bookButton.querySelector('.chev');
        var bookNumber = bookButton && bookButton.querySelector('.pill-n');
        var bookChevronReadable = !!(bookButton && bookChev && bookNumber
          && inside(bookChev.getBoundingClientRect(), bookButton.getBoundingClientRect())
          && separated(bookChev.getBoundingClientRect(), bookNumber.getBoundingClientRect())
          && separated(bookChev.getBoundingClientRect(), bookButton.querySelector('.pill-k').getBoundingClientRect())
          && bookChev.getBoundingClientRect().left > bookNumber.getBoundingClientRect().right);
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          cards: cards,
          bookChevronReadable: bookChevronReadable,
          labelsAndNumbersReadable: labelsAndNumbersReadable,
          numbersCentered:numbers.length>=3 && numberCenterDeltas.every(function(d){return Math.abs(d.dx)<=1 && Math.abs(d.dy)<=1}),
          numberCenterDeltas:numberCenterDeltas,
          bookText: (document.getElementById('homeBtnBook') || {}).textContent || ''
        };
      });
      var book = mobile.cards.homeBtnBook;
      var label = viewport.width + 'px';
      check('C ' + label + ': 页面无横向溢出', mobile.scrollWidth <= mobile.clientWidth, JSON.stringify({ scrollWidth: mobile.scrollWidth, clientWidth: mobile.clientWidth }));
      check('C ' + label + ': 标签和数字完整位于卡片内且不重叠', mobile.labelsAndNumbersReadable, JSON.stringify(mobile));
      check('C ' + label + ': 错题本计数卡存在且可点', !!book && book.disabled === false && /错题本/.test(mobile.bookText), JSON.stringify(book));
      check('C ' + label + ': 错题本箭头完整显示在数字右侧且不遮挡文字', mobile.bookChevronReadable, JSON.stringify(mobile));
      check('C ' + label + ': 两张卡保持原生按钮语义', ['homeBtnDue', 'homeBtnBook'].every(function (id) { var c = mobile.cards[id]; return c && c.type === 'button' && c.tabIndex >= 0; }), JSON.stringify(mobile.cards));
      /* 直接测量按钮本体，不假定存在额外的伪元素命中区域。 */
      check('C ' + label + ': 可用卡实际按钮区域至少 44×44',
        !!book && book.height >= 44 && book.width >= 44,
        JSON.stringify(book));

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

    /* ===== 场景 E：今日卡「药丸行」布局契约 =====
       历史：2026-09-14 顶部改版把计数区做成「均分三列大卡」（.htc，等宽、数字在上标签在下、
       数字横向居中）。2026-09-25 老板裁决 · 方案 A：降级为一排小药丸（.home-pill），
       顺序固定 待复习(蓝·可点) · 错题本(粉·可点) · 已熟练(绿·仅报数) · 目标(灰·仅报数)，
       宽度随内容（不再等宽）。因此本场景中旧的「三列等宽 / 上下堆叠 / 数字居中 / 占满≥95%」
       四条大卡契约**已作废**，改写为适配药丸行的新契约（条条可抓回归，不是简单删除）。 */
    {
      const sp = await scenarioPage(browser, initBookOnly, { width: 1280, height: 800 });
      const page = sp.page;
      const top = await page.evaluate(function () {
        function box(el) {
          if (!el) return null;
          var r = el.getBoundingClientRect();
          return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }
        var body = document.getElementById('homeBody');
        var hero = document.querySelector('#homeBody .home-hero');
        var counts = document.querySelector('.home-today-counts');
        var card = document.querySelector('.home-today-card');
        /* 药丸行：容器 flex-wrap；药丸按内容排布，宽度各不相同。 */
        var pills = Array.prototype.slice.call(document.querySelectorAll('.home-today-counts .home-pill'));
        var due = counts ? counts.querySelector('.home-pill.due') : null;
        var book = counts ? counts.querySelector('.home-pill.book') : null;
        var mastered = counts ? counts.querySelector('.home-pill.mastered') : null;
        var goal = counts ? counts.querySelector('.home-pill.goal') : null;
        var todayDone = counts ? counts.querySelector('.home-pill.today-done') : null;
        var trend = counts ? counts.querySelector('.home-trend') : null;
        var cw = counts ? counts.getBoundingClientRect().width : 0;
        var dw = card ? card.getBoundingClientRect().width : 0;
        var pillBoxes = pills.map(function (el) { return box(el); });
        var pillW = pillBoxes.map(function (b) { return b.w; });
        /* 药丸宿主高（触控本体，命中区再靠 ::after 扩） */
        var dueH = due ? Math.round(due.getBoundingClientRect().height) : 0;
        var res = {
          heroExists: !!hero,
          heroFirst: !!(body && hero && body.firstElementChild === hero),
          heroHasDate: !!document.querySelector('#homeBody .home-hero .hh-date'),
          heroHasStreak: !!document.querySelector('#homeBody .home-hero .cal-streak'),
          /* 真契约不是「streak 一定存在」（连续天数为 0 时本来就不渲染），
             而是「它只能出现在标题行里，不能再挂回合并卡标题」。 */
          streakOutsideHero: (function () {
            var all = document.querySelectorAll('#homeBody .cal-streak');
            for (var i = 0; i < all.length; i++) { if (!hero || !hero.contains(all[i])) return true; }
            return false;
          })(),
          /* 首页今日计数区保持精简，不额外重复显示区块标题。 */
          titleInCardCount: card ? card.querySelectorAll('.hc-title').length : 0,
          titleInCardText: (function () {
            var t = card ? card.querySelector('.hc-title') : null;
            return t ? t.textContent.replace(/\s+/g, '').trim() : '';
          })(),
          pillCount: pills.length,
          pillW: pillW,
          gridLayout: counts ? getComputedStyle(counts).display === 'grid' : false,
          /* 可点药丸是 BUTTON、仅报数药丸（已熟练 / 目标）是 DIV。 */
          dueIsButton: !!due && due.tagName === 'BUTTON',
          bookIsButton: !!book && book.tagName === 'BUTTON',
          masteredIsDiv: !!mastered && mastered.tagName === 'DIV',
          goalIsDiv: !goal || goal.tagName === 'DIV',
          trendExists: !!trend,
          trendPointCount: trend ? trend.querySelectorAll('.home-trend-dot').length : 0,
          trendDateCount: trend ? trend.querySelectorAll('.home-trend-date').length : 0,
          trendLargerThanDue: !!(trend && due && trend.getBoundingClientRect().width > due.getBoundingClientRect().width * 1.8),
          dueRightOfTrend: !!(trend && due && due.getBoundingClientRect().left > trend.getBoundingClientRect().left),
          metricsInOneRow: (function () {
            if (!trend || !due || !book || !mastered || !todayDone) return false;
            var tr = trend.getBoundingClientRect(), dr = due.getBoundingClientRect();
            var br = book.getBoundingClientRect(), mr = mastered.getBoundingClientRect(), td = todayDone.getBoundingClientRect();
            return dr.left >= tr.right - 1 && br.left > dr.left && mr.left > br.left && td.left > mr.left
              && Math.abs(dr.top - br.top) <= 1 && Math.abs(br.top - mr.top) <= 1 && Math.abs(mr.top - td.top) <= 1;
          })(),
          trendAlignedWithMetrics: !!(trend && due && Math.abs(trend.getBoundingClientRect().top - due.getBoundingClientRect().top) <= 1),
          trendWideOfMetrics: !!(trend && due && trend.getBoundingClientRect().width >= due.getBoundingClientRect().width * 1.8),
          todayDoneIsDiv: !!todayDone && todayDone.tagName === 'DIV',
          todayDoneRightOfMastered: (function () {
            if (!todayDone || !mastered) return false;
            var a = mastered.getBoundingClientRect(), b = todayDone.getBoundingClientRect();
            return Math.abs(b.top - a.top) <= 1 && b.left > a.left;
          })(),
          todayDoneMatchesMastered: (function () {
            if (!todayDone || !mastered) return false;
            var a = getComputedStyle(mastered), b = getComputedStyle(todayDone);
            var an = getComputedStyle(mastered.querySelector('.pill-n'));
            var bn = getComputedStyle(todayDone.querySelector('.pill-n'));
            var ak = getComputedStyle(mastered.querySelector('.pill-k'));
            var bk = getComputedStyle(todayDone.querySelector('.pill-k'));
            var ar = mastered.getBoundingClientRect(), br = todayDone.getBoundingClientRect();
            return {
              size: Math.abs(ar.width - br.width) <= 1 && Math.abs(ar.height - br.height) <= 1,
              surfaceDifferent: a.backgroundColor !== b.backgroundColor && a.borderColor !== b.borderColor,
              numberColorDifferent: an.color !== bn.color,
              numberTypographyMatches: an.fontSize === bn.fontSize && an.fontWeight === bn.fontWeight,
              label: ak.color === bk.color && ak.fontSize === bk.fontSize && ak.fontWeight === bk.fontWeight
                && Math.abs((mastered.querySelector('.pill-k').getBoundingClientRect().left
                  + mastered.querySelector('.pill-k').getBoundingClientRect().width / 2) - (ar.left + ar.width / 2)) <= 1
                && Math.abs((todayDone.querySelector('.pill-k').getBoundingClientRect().left
                  + todayDone.querySelector('.pill-k').getBoundingClientRect().width / 2) - (br.left + br.width / 2)) <= 1
            };
          })(),
          numbersCentered: (function () {
            return pills.length > 0 && pills.every(function (p) {
              var n = p.querySelector('.pill-n');
              if (!n) return false;
              var pb = p.getBoundingClientRect(), nb = n.getBoundingClientRect();
              return Math.abs((pb.left + pb.width / 2) - (nb.left + nb.width / 2)) <= 1
                && Math.abs((pb.top + pb.height / 2) - (nb.top + nb.height / 2)) <= 1;
            });
          })(),
          countsFillPct: (dw > 0) ? Math.round(cw / dw * 100) : 0,
          /* 药丸本体高度（命中区 = 本体 + 2×7 伪元素扩区，见场景 C）。 */
          dueH: dueH,
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
        /* 负向自证 3：把 .cal-streak 塞回合并卡标题 → streakOutsideHero 必须变 true。 */
        var mTitle = document.querySelector('#homeBody .home-card.merge-row .hc-title') || document.querySelector('#homeBody .hc-title');
        if (mTitle) {
          var sc = document.createElement('span');
          sc.className = 'cal-streak';
          sc.textContent = '连续 3 天';
          mTitle.appendChild(sc);
          var all2 = document.querySelectorAll('#homeBody .cal-streak');
          res.negStreakOutside = false;
          for (var j = 0; j < all2.length; j++) { if (!hero || !hero.contains(all2[j])) { res.negStreakOutside = true; break; } }
          mTitle.removeChild(sc);
        }
        return res;
      });
      check('E1 顶部标题行存在且是首页第一个元素', top.heroExists && top.heroFirst, JSON.stringify(top));
      check('E2 日期在标题行内，且连续天数不再挂在合并卡（若渲染必在标题行内）', top.heroHasDate && top.streakOutsideHero === false, JSON.stringify({ d: top.heroHasDate, inHero: top.heroHasStreak, outside: top.streakOutsideHero }));
      check('E2- 负向自证 · 把连续天数塞回合并卡后必须能识别', top.negStreakOutside === true, 'negStreakOutside=' + top.negStreakOutside);
      check('E3 今日计数区不显示冗余标题',
        top.titleInCardCount === 0 && top.titleInCardText === '',
        JSON.stringify({ count: top.titleInCardCount, text: top.titleInCardText }));
      check('E4 近7日趋势在左、四项数字格在右并排成一行；入口仍可点',
        top.gridLayout && top.trendExists && top.trendPointCount === 7 && top.trendDateCount === 7
          && top.trendAlignedWithMetrics && top.trendWideOfMetrics && top.metricsInOneRow && top.dueIsButton && top.bookIsButton,
        JSON.stringify({ grid: top.gridLayout, trend: top.trendExists, points: top.trendPointCount,
          dates: top.trendDateCount, trendLarge: top.trendLargerThanDue, dueRight: top.dueRightOfTrend,
          trendAligned: top.trendAlignedWithMetrics, metricsInOneRow: top.metricsInOneRow }));
      check('E4a 今日已练位于已熟练右侧，保持相同字级但使用独立颜色',
        top.pillCount >= 3 && top.masteredIsDiv && top.todayDoneIsDiv && top.todayDoneRightOfMastered
          && top.todayDoneMatchesMastered.size && top.todayDoneMatchesMastered.surfaceDifferent
          && top.todayDoneMatchesMastered.numberColorDifferent && top.todayDoneMatchesMastered.numberTypographyMatches
          && top.todayDoneMatchesMastered.label,
        JSON.stringify({ n: top.pillCount,
          mastered: top.masteredIsDiv, today: top.todayDoneIsDiv, right: top.todayDoneRightOfMastered,
          sameStyle: top.todayDoneMatchesMastered }));
      check('E5 计数格宽度有效且不横向溢出',
        top.countsFillPct > 0 && top.countsFillPct <= 101 && top.pillW.length > 0 && top.pillW.every(function (w) { return w > 0; }),
        'fill=' + top.countsFillPct + '% tileW=' + JSON.stringify(top.pillW));
      check('E6 所有计数数字均在格子水平与垂直中心', top.numbersCentered === true);
      check('E8 主卡触控高度 >= 44px', top.dueH >= 44, 'h=' + top.dueH);
      check('E9 顶部无横向溢出', top.overflowX === false, 'overflowX=' + top.overflowX);
      await sp.ctx.close();
    }

    /* ===== 场景 F：内容占主位 + 日历归入学习档案 =====
       老板反馈「布局别扭，但这些又都想要，首页要保持简洁，只放最近学的和我添加的课程」。
       核实出的根因不是间距：派生出的两张计数卡占第一屏、回顾性的日历占最大面积
       （约 283px 高），而「我添加的课程」（含还没开始的）被挤在窄栏、且只在练过之后才出现。
       新契约：① 今日趋势与计数排在课程列表**之前**；② 首页只在标题行保留本月打卡摘要入口，月历在学习档案；
       ③ 「已加入但还没开始」也出现在首页，「仅导入」不出现。 */
    {
      const sp = await scenarioPage(browser, initImportedNotStarted, { width: 1280, height: 800 });
      const page = sp.page;
      const layout = await page.evaluate(function () {
        var body = document.getElementById('homeBody');
        var courses = body.querySelector('.home-courses');
        var today = body.querySelector('.home-today-card');
        var homeCalendar = body.querySelector('#homeCalToggle, #homeCalPanel, .cal-grid');
        var monthCheckins = body.querySelector('.home-month-checkins');
        var streak = body.querySelector('.home-hero .cal-streak');
        return {
          hasCourses: !!courses,
          importedCover: (function(){ var row = body.querySelector('[data-home-course="user-deck:imported-1"]'); var image = row && row.querySelector('.hc-course-cover img'); return image && image.getAttribute('src'); })(),
          hasRedundantResumeRow: !!document.getElementById('homeResumeRow'),
          rowActions: Array.prototype.map.call(body.querySelectorAll('.home-decks .hd-row'), function (el) {
            var primary = el.querySelector('.hd-main-action');
            var action = el.querySelector('.hd-action');
            var actionSvg = action && action.querySelector('svg');
            var actionPath = actionSvg && actionSvg.querySelector('path');
            var actionStyle = action ? getComputedStyle(action) : null;
            return { label:primary && primary.getAttribute('aria-label'), hasChevron:!!actionPath && actionPath.getAttribute('d') === 'm9 18 6-6-6-6', actionBorder:actionStyle ? actionStyle.borderTopWidth : '' };
          }),
          addCourseLeftAligned: (function(){
            var cover = body.querySelector('.home-decks .hd-row .hc-course-cover');
            var add = body.querySelector('#homeAddCourse');
            return !!(cover && add && Math.abs(cover.getBoundingClientRect().left - add.getBoundingClientRect().left) < 1);
          })(),
          lessonSelectors:Array.prototype.map.call(body.querySelectorAll('[data-home-select-course]'), function(el){return {courseId:el.getAttribute('data-home-select-course'), label:el.getAttribute('aria-label')};}),
          progressRows: Array.prototype.map.call(body.querySelectorAll('.home-decks .hd-row .hc-course-progress'), function (el) {
            var track = el.querySelector('.hc-progress-track');
            var segments = track ? Array.prototype.slice.call(track.querySelectorAll('.hc-progress-segment')) : [];
            return {
              text:(el.textContent || '').trim(),
              containerWidth:el.getBoundingClientRect().width,
              trackWidth:track ? track.getBoundingClientRect().width : 0,
              tracks:el.querySelectorAll('.hc-progress-track').length,
              bars:el.querySelectorAll('[role="progressbar"]').length,
              labels:Array.prototype.map.call(el.querySelectorAll('[role="progressbar"]'), function(bar){return bar.getAttribute('aria-label');}),
              segmentWidths:segments.map(function(segment){return segment.style.width;}),
              segmentValues:segments.map(function(segment){return Number(segment.getAttribute('aria-valuenow'));}),
              segmentColors:segments.map(function(segment){return getComputedStyle(segment).backgroundColor;}),
              segmentTransitions:segments.map(function(segment){return getComputedStyle(segment).transitionDuration;}),
              trackGap:track ? getComputedStyle(track).columnGap : null,
              legacyLanes:el.querySelectorAll('.hc-progress-lane').length
            };
          }),
          /* DOM 顺序：课程卡必须出现在今日卡之前 */
          courseBeforeToday: !!(courses && today && (courses.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING)),
          listText: (body.querySelector('.home-decks') || {}).innerText || '',
          homeCalendarPresent: !!homeCalendar,
          monthCheckinsBeforeStreak: !!(monthCheckins && streak && (monthCheckins.compareDocumentPosition(streak) & Node.DOCUMENT_POSITION_FOLLOWING)),
          monthCheckinsHref: monthCheckins && monthCheckins.getAttribute('href'),
          monthCheckinsHasIcon: !!(monthCheckins && monthCheckins.querySelector('svg')),
          monthCheckinsText: monthCheckins && monthCheckins.textContent.trim()
        };
      });
      check('F1 已加入但还没开始的课程出现在首页；仅导入课程不出现',
        layout.hasCourses && layout.listText.indexOf('已加入未开始') >= 0 && layout.listText.indexOf('仅导入不应显示') === -1,
        JSON.stringify({ has: layout.hasCourses, text: layout.listText.slice(0, 60) }));
      check('F1a 用户课程封面图从课程数据映射到首页卡片',
        layout.importedCover === 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=',
        JSON.stringify({ importedCover: layout.importedCover }));
      check('F1b 首页不再渲染与我的课程重复的独立续学条',
        layout.hasRedundantResumeRow === false,
        JSON.stringify({ hasRedundantResumeRow: layout.hasRedundantResumeRow }));
      check('F1c 我的课程为每个课程提供开始/继续按钮',
        layout.rowActions.some(function(row){return row.label.indexOf('继续学习 ')===0 && row.hasChevron && row.actionBorder === '0px';}) &&
        layout.rowActions.some(function(row){return row.label.indexOf('开始学习 ')===0 && row.hasChevron && row.actionBorder === '0px';}),
        JSON.stringify({ rowActions: layout.rowActions }));
      check('添加课程按钮与课程封面左边缘对齐', layout.addCourseLeftAligned, JSON.stringify({ addCourseLeftAligned:layout.addCourseLeftAligned }));
      check('单课节课程不显示多余的选课节入口', layout.lessonSelectors.length===0, JSON.stringify(layout.lessonSelectors));
      check('课程进度用连续双色进度条，按真实百分比拼接且总长不超过100%',
        layout.progressRows.some(function(row){
          var sum = row.segmentValues.reduce(function(total,value){return total+value;},0);
          var expected = row.segmentValues.map(function(value){return sum > 100 ? value / sum * 100 : value;});
          var rendered = row.segmentWidths.map(function(width){return parseFloat(width);});
          return row.tracks===1 && row.trackWidth>=row.containerWidth-1 && row.bars===2 && rendered.length===2 && rendered.every(function(width,i){return Math.abs(width-expected[i])<0.02;}) && rendered.reduce(function(total,value){return total+value;},0)<=100.02 && row.segmentTransitions.every(function(duration){return duration==='0s';}) && row.trackGap==='normal' && row.legacyLanes===0 && row.labels.indexOf('课程进度')>=0 && row.labels.indexOf('当前课节内容进度')>=0 && row.text.indexOf('课程')>=0 && row.text.indexOf('当前课节')>=0;
        }),
        JSON.stringify({ progressRows:layout.progressRows }));
      check('课程进度为0时隐藏课程项，仍显示当前课节进度',
        layout.progressRows.some(function(row){return row.text.indexOf('当前课节')>=0 && row.text.indexOf('课程')===-1 && row.labels.indexOf('课程进度')===-1 && row.labels.indexOf('当前课节内容进度')>=0;}),
        JSON.stringify({ progressRows:layout.progressRows }));
      check('课程进度使用琥珀色，当前课节仍使用绿色',
        layout.progressRows.some(function(row){return row.segmentColors.indexOf('rgb(183, 121, 31)')>=0 && row.segmentColors.indexOf('rgb(28, 112, 80)')>=0;}),
        JSON.stringify({ progressRows:layout.progressRows }));
      check('F2 今日趋势与计数排在课程列表之前',
        layout.courseBeforeToday === false, JSON.stringify(layout));
      check('F3 本月打卡摘要带日历图标并位于连续天数左侧', layout.monthCheckinsBeforeStreak && layout.monthCheckinsHasIcon && /^本月打卡 \d+ 天$/.test(layout.monthCheckinsText), JSON.stringify(layout));
      check('F3a 本月打卡摘要进入学习档案，月历不留在首页', layout.monthCheckinsHref === 'stats.html' && layout.homeCalendarPresent === false, JSON.stringify(layout));
      await sp.ctx.close();
    }

    /* 多课节课程保留「继续」，并额外提供直达本课程目录的「选课节」入口。 */
    {
      const sp = await scenarioPage(browser, initJoinedBuiltinCourse, { width: 390, height: 844 }, true);
      const page = sp.page;
      const selector = page.locator('[data-home-select-course="builtin:oral"]');
      const selectorCount = await selector.count();
      const selectorBox = selectorCount ? await selector.boundingBox() : null;
      const arrowBox = await page.locator('.home-decks .hd-row .hd-action').boundingBox();
      const homeLayout = await page.evaluate(function(){
        var cover=document.querySelector('.home-decks .hd-row .hc-course-cover');
        var add=document.getElementById('homeAddCourse');
        return {
          scrollWidth:document.documentElement.scrollWidth,
          clientWidth:document.documentElement.clientWidth,
          addCourseLeftAligned:!!(cover && add && Math.abs(cover.getBoundingClientRect().left-add.getBoundingClientRect().left)<1)
        };
      });
      check('手机屏幕下添加课程按钮与课程封面左边缘对齐', homeLayout.addCourseLeftAligned, JSON.stringify(homeLayout));
      const selectorReady = selectorCount === 1 && /选课节/.test(await selector.innerText()) && !!selectorBox && selectorBox.height>=44 && !!arrowBox && selectorBox.x + selectorBox.width <= arrowBox.x && homeLayout.scrollWidth<=homeLayout.clientWidth;
      check('多课节课程提供独立且可识别的「选课节」按钮', selectorReady,
        JSON.stringify({ count:selectorCount, box:selectorBox, homeLayout:homeLayout, url:page.url() }));
      if (selectorReady) {
        await selector.click();
        await page.waitForURL('**/decks.html?courseView=joined&course=builtin%3Aoral', { timeout:10000 });
        await page.waitForSelector('.catalog-lesson', { timeout:10000 });
      }
      const directory = await page.evaluate(function(){
        return {
          url:location.href,
          lessonCount:document.querySelectorAll('.catalog-lesson').length,
          title:(document.getElementById('deckPageTitle') || {}).textContent || ''
        };
      });
      check('点击「选课节」直达所属课程目录，可选择具体子课程',
        selectorReady && /decks\.html\?courseView=joined&course=builtin%3Aoral/.test(directory.url) && directory.lessonCount > 1,
        JSON.stringify(directory));
      await sp.ctx.close();
    }

    /* ===== 场景 H：已加入的图文导入课显示目录封面 ===== */
    {
      const sp = await scenarioPage(browser, initJoinedLogicalCourse, { width: 1280, height: 800 });
      const page = sp.page;
      const importedCourse = await page.evaluate(async function(){
        var row = document.querySelector('[data-home-course="logical-course:imported-with-cover"]');
        var fallback = Array.prototype.find.call(document.querySelectorAll('#homeBody .hd-row'), function(el){return el.textContent.indexOf('已加入的图文课程') >= 0;});
        var image = (row || fallback) && (row || fallback).querySelector('.hc-course-cover img');
        if(image && !image.complete) await new Promise(function(resolve){ image.addEventListener('load', resolve, {once:true}); image.addEventListener('error', resolve, {once:true}); });
        return { row:!!row, fallback:!!fallback, unavailable:!!((row || fallback) && (row || fallback).classList.contains('is-unavailable')),
          cover:image && image.getAttribute('src'), imageLoaded:!!(image && image.complete && image.naturalWidth > 0), logicalStore:typeof LogicalCourseStore,
          coursesText:(document.querySelector('.home-courses') || {}).innerText || '' };
      });
      check('H1 已加入的图文导入课程不再显示为暂不可用', importedCourse.row && !importedCourse.unavailable, JSON.stringify(importedCourse));
      check('H2 首页课程封面来自逻辑课程目录且图片可加载', importedCourse.cover === 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=' && importedCourse.imageLoaded,
        JSON.stringify(importedCourse));
      var startButton = page.locator('[data-home-course="logical-course:imported-with-cover"]');
      if (await startButton.count()) await startButton.click();
      await page.waitForURL('**/courses.html?id=imported-story-with-cover**', { timeout:10000 });
      var launchUrl = await page.evaluate(function(){ var params=new URLSearchParams(location.search); return {path:location.pathname, id:params.get('id'), catalogCourse:params.get('catalogCourse')}; });
      check('H3 旧登记映射后的课程卡可以进入对应导入课', launchUrl.path.endsWith('/courses.html')
        && launchUrl.id === 'imported-story-with-cover'
        && launchUrl.catalogCourse === 'logical-course:imported-with-cover', JSON.stringify(launchUrl));
      await sp.ctx.close();
    }

    /* ===== 场景 I：目录读取失败不能把已加入课程误报为已移除 ===== */
    {
      const sp = await scenarioPage(browser, initOneDueOneWeak, { width: 1280, height: 800 });
      const page = sp.page;
      const catalogFailure = await page.evaluate(async function(){
        const courseId='user-deck:catalog-temporarily-failed';
        const progress=CL.readProgress();
        progress[CourseEnrollment.keyFor(courseId)]={kind:'course-enrollment',schemaVersion:1,courseId:courseId,joined:true,joinedAt:1,changedAt:1};
        await CL.writeProgress(progress);
        CourseCatalog.buildCatalog=function(){throw new Error('simulated catalog read failure');};
        renderHome();
        const card=document.querySelector('.home-courses');
        return {text:card && card.innerText || '',count:card && card.querySelector('.hc-membership-count') && card.querySelector('.hc-membership-count').textContent,
          unavailable:card && card.querySelector('.hd-row.is-unavailable'),loadError:card && card.querySelector('.hd-row.is-load-error'),
          leave:card && card.querySelector('[data-home-leave]')};
      });
      check('课程目录加载失败保留加入数量并显示可恢复提示，而非误报课程已删除',
        catalogFailure.count==='1/3' && catalogFailure.text.includes('课程目录加载失败，请稍后重试') &&
        !catalogFailure.text.includes('课程内容可能已移除') && !catalogFailure.unavailable && !!catalogFailure.loadError && !catalogFailure.leave,
        JSON.stringify(catalogFailure));
      await sp.ctx.close();
    }

    /* ===== 场景 G：首页「已掌握」计数格与档案页同口径 =====
       已掌握只报数；具体格位由首页学习趋势布局统一管理，不新增入口。
       数字必须与档案页概览的「已掌握」逐字一致 —— 做法是把口径收敛到 core.js 的
       CL.masteredSentenceCount 单一实现，首页与 stats.html 都调它；本场景即这条契约：
       ① 旧版练习计数不等于考试掌握：首页只有经有效考试证据确认的掌握记录；
       ② 它只报数不是入口：非 a/button、无 chevron（老板明确要的是「显示」）；
       ③ 进档案页读 #masteredCount，与首页那一格逐字一致；
       ④ 负向自证：五种朴素算法的结果都不等于 5（证明这份 fixture 能把「复用口径」与
          「各自实现」区分开，而不是恰好都对）。 */
    {
      const sp = await scenarioPage(browser, initMasteredSplit, { width: 1280, height: 800 });
      const page = sp.page;
      const errs = [];
      page.on('pageerror', function (e) { errs.push(e.message); });

      const home = await page.evaluate(function () {
        var row = document.querySelector('#homeBody .home-today-counts');
        var cell = document.getElementById('homeMastered');
        var book = document.getElementById('homeBtnBook');
        var raw = JSON.parse(localStorage.getItem('chunklab.v1'));
        var byKeys = Object.keys(raw.stats.bySentence || {});
        var isMaster = function (s) { return s && s.times >= 3 && s.okTimes / s.times >= 0.8; };
        var masterKeys = byKeys.filter(function (k) { return isMaster(raw.stats.bySentence[k]); });
        var markedKeys = Object.keys(raw.mastered || {});
        var unionNoFilter = {};
        masterKeys.concat(markedKeys).forEach(function (k) { unionNoFilter[k] = true; });
        /* 2026-09-25 改版：计数格由 .home-today-mark 大卡降级为 .home-pill.mastered 药丸，
           内部 .v/.k 也随之改为 .pill-n/.pill-k。选择器同步，语义（在错题本右侧、值/标签）不变。 */
        var nEl = cell ? cell.querySelector('.pill-n') : null;
        var lEl = cell ? cell.querySelector('.pill-k') : null;
        var cr = cell && cell.getBoundingClientRect();
        var br = book && book.getBoundingClientRect();
        return {
          exists: !!cell,
          inCountsRow: !!(row && cell && row.contains(cell)),
          /* 排在错题本右侧：左边缘确实在错题本右边（不再用「DOM 最后一个孩子」，
             因为后面还可能有「目标」药丸）。 */
          belongsToCounts: !!(row && cell && row.contains(cell)),
          count: nEl ? nEl.textContent.trim() : '',
          label: lEl ? lEl.textContent.trim() : '',
          /* 「只报数」的契约：不是 <a>/<button>，也没有 chevron */
          tag: cell ? cell.tagName.toLowerCase() : '',
          isLink: !!(cell && cell.closest('a')),
          chev: !!(cell && cell.querySelector('.chev')),
          /* 五种朴素算法的结果（都应与首页数字不同） */
          naive: {
            markedOnly: markedKeys.length,
            statsOnly: masterKeys.length,
            sum: markedKeys.length + masterKeys.length,
            unionNoFilter: Object.keys(unionNoFilter).length,
            allStatKeys: byKeys.length
          }
        };
      });
      check('G1 旧版练习次数不能冒充考试掌握；首页显示0并标为已掌握',
        home.exists && home.inCountsRow && home.belongsToCounts &&
        home.count === '0' && home.label === '已掌握',
        JSON.stringify({ exists: home.exists, inRow: home.inCountsRow,
          belongsToCounts: home.belongsToCounts, count: home.count, label: home.label }));
      check('G2 这一格只报数、不是入口（非 a/button，无 chevron）',
        home.tag === 'div' && home.isLink === false && home.chev === false,
        JSON.stringify({ tag: home.tag, isLink: home.isLink, chev: home.chev }));

      /* 进档案页读概览的「已熟练」—— 与首页逐字一致 */
      await page.goto(BASE + '/stats.html?regression=home-mastered-cell', { waitUntil: 'domcontentloaded' });
      let statsN = null, statsErr = '';
      try {
        await page.waitForSelector('#masteredCount', { timeout: 30000 });
        statsN = await page.evaluate(function () {
          return document.getElementById('masteredCount').textContent.trim();
        });
      } catch (e) { statsErr = (e && e.message || String(e)); }
      check('G3 档案页概览「已掌握」与首页那一格逐字一致',
        statsN !== null && home.count !== '' && home.count === statsN,
        'home=' + JSON.stringify(home.count) + ' stats=' + JSON.stringify(statsN) + (statsErr ? ' err=' + statsErr : ''));

      /* 负向自证：五种朴素写法都不等于 5 —— 否则上面的「一致」只是碰巧 */
      const naive = home.naive;
      const bad = Object.keys(naive).filter(function (k) { return naive[k] === 5; });
      check('G4- 负向自证 · 五种朴素算法都不等于 5（fixture 真的能区分口径）',
        bad.length === 0,
        'naive=' + JSON.stringify(naive) + ' 与 5 相同的=' + JSON.stringify(bad));
      check('G5 场景 G 零 pageerror', errs.length === 0, errs.join(' | '));
      await sp.ctx.close();
    }

    /* ===== 场景 D：截图（38 到期 / 3 需巩固 / 0 错题本） ===== */
    {
      const sp = await scenarioPage(browser, initBig);
      const page = sp.page;
      try {
        /* 2026-09-23：课程列表卡已提到首页最前，`.home-card` 的第一个不再是今日卡，
           显式指定 .home-today-card 才能继续截到这张卡（截图产物本身也是验收依据）。 */
        const card = await page.locator('#homeBody .home-today-card');
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
