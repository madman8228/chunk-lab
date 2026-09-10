/**
 * sync-delta.test.js · 客户端增量上行端到端验证（Playwright）
 *
 * 目的（2026-09-10，8000 句扩容）：证明「练过 800 句之后再答一题，上行体积是 KB 级」，
 * 而不是现状的整份档案（实测 8000 句 7191KB/次）。
 *
 * 断言链条：
 *   1. 首轮同步（水位未知）→ 全量上行，体积随数据量增长
 *   2. 之后每次只改 1 条句子档案 + 追加 1 条事件 → 上行稳定在 KB 级
 *   3. 服务端最终仍持有完整数据（增量没有丢数据）
 *
 * 跑法：node e2e/sync-delta.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8942 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-syncdelta-'));
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
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
}

function getData() {
  return new Promise(function (resolve, reject) {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/data' }, function (r) {
      let raw = '';
      r.on('data', function (c) { raw += c; });
      r.on('end', function () { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
  });
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

(async function () {
  await startServer();
  console.log('[sync-delta e2e] server on ' + BASE + '  temp DB ' + TMP_DB);

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();

  /* 逐个记录 PUT /api/data 的请求体字节数 —— 这是本轮优化的核心指标 */
  const puts = [];
  p.on('request', function (req) {
    if (req.method() === 'PUT' && req.url().indexOf('/api/data') >= 0) {
      let n = -1;
      try { const b = req.postDataBuffer(); n = b ? b.length : 0; } catch (e) { n = -1; }
      puts.push(n);
    }
  });

  await p.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(function () {
    return !!(window.CL && window.CL.cloudSyncNow && window.CL.loadMem);
  }, { timeout: 15000 });
  await p.waitForTimeout(1800); /* 等 ensureCloud 首轮握手完成（_cloudOn 置位） */

  /* ---------- 1. 造「练过 800 句」的规模并首轮同步（水位未知 → 全量） ----------
     ★ 必须把 mastered / 错题本 / 用户导入题库一起造出来：
       第一轮只拆了 stats，这三个仍留在 kv blob 里，每答一题全量重传
       （mastered 8000 条约 227KB、错题本上限 200 条约 176KB、导入题库可达数百 KB）。
       只造 stats 的 fixture 会让「增量很小」这个结论变成假象。 */
  const first = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    if (!m.stats) m.stats = { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] };
    if (!m.stats.bySentence) m.stats.bySentence = {};
    if (!Array.isArray(m.stats.events)) m.stats.events = [];
    var SENT = function (i) { return 'This is a longer sample sentence used to measure sync payload number ' + i + '.'; };
    for (var i = 0; i < 800; i++) {
      m.stats.bySentence['freq-idioms#' + ('0000000' + i).slice(-8)] = {
        deckId: 'freq-idioms', deckName: '高频短语 · English Idioms',
        sentence: SENT(i), translation: '这是一个用来测量同步体积的较长示例句子。',
        times: 3, okTimes: 2, wrongTimes: 1, streak: 1, maxStreak: 2,
        lastAt: 1700000000000, interval: 4, ease: 2.5, dueAt: 1700003600000, repetition: 2
      };
    }
    for (var j = 0; j < 2000; j++) {
      m.stats.events.push({
        id: 'ev' + j, kind: 'answer', key: 'freq-idioms#00000000', deckId: 'freq-idioms',
        sentence: SENT(j % 800), ok: true, at: 1700000000000 + j
      });
    }
    /* 已标熟 800 条（shape 与 main.html 的 mastered 写入一致） */
    m.mastered = {};
    for (var k = 0; k < 800; k++) {
      m.mastered['freq-idioms#' + ('0000000' + k).slice(-8)] = {
        deckId: 'freq-idioms', sentence: SENT(k), markedAt: 1700000000000 + k
      };
    }
    /* 内置句删除登记 50 条 */
    m.deletedItems = {};
    for (var d = 0; d < 50; d++) m.deletedItems['freq-idioms#dead' + ('0000' + d).slice(-4)] = true;
    /* 错题本 200 条整题快照（客户端上限就是 200） */
    m.reinforceBook = [];
    for (var b = 0; b < 200; b++) {
      m.reinforceBook.push({
        _key: 'user-big::' + SENT(b), deckId: 'user-big', deckName: '导入的大题库',
        addedAt: '2026-09-10 12:00:00', sentence: SENT(b), translation: '错题快照',
        chunks: ['This', 'is', 'a', 'longer', 'sample', 'sentence', 'used', 'to', 'measure'],
        hints: ['这', '是', '一个', '较长', '示例'],
        grammar: { rule: 'sample', note: '为了测量体积' },
        mistakes: [{ chunkIdx: 0, chunk: 'This', userAnswer: 'that', hint: '这' }]
      });
    }
    /* 用户导入的大题库 300 条 */
    var items = [];
    for (var t = 0; t < 300; t++) {
      items.push({ sentence: SENT(t), translation: '导入题库第 ' + t + ' 句',
        chunks: ['This', 'is', 'a', 'longer', 'sample'], hints: ['这', '是', '一个', '较长', '示例'] });
    }
    m.decks = [{ id: 'user-big', name: '导入的大题库', builtin: false, items: items }];
    window.CL.saveMem(m);
    var ok = await window.CL.cloudSyncNow(m);
    return { ok: ok, sbs: Object.keys(m.stats.bySentence).length, events: m.stats.events.length,
      mastered: Object.keys(m.mastered).length, book: m.reinforceBook.length, decks: m.decks.length };
  });

  check('1.1 首轮同步成功', first.ok === true, JSON.stringify(first));
  check('1.2 本地已构造 800 条档案 / 2000 条事件', first.sbs === 800 && first.events === 2000, JSON.stringify(first));
  check('1.2b 本地已构造 800 标熟 / 200 错题 / 1 个导入题库',
    first.mastered === 800 && first.book === 200 && first.decks === 1, JSON.stringify(first));

  await p.waitForTimeout(500);
  const firstSize = puts.length ? puts[puts.length - 1] : 0;
  check('1.3 首轮为全量上行（>300KB）', firstSize > 300 * 1024, 'size=' + kb(firstSize));
  console.log('      · 首轮全量上行：' + kb(firstSize));

  /* ---------- 2. 之后每次只改 1 条 + 追加 1 条事件 ---------- */
  const deltas = [];
  for (let round = 0; round < 5; round++) {
    const before = puts.length;
    const r = await p.evaluate(async function (n) {
      var m = window.CL.loadMem();
      var key = 'freq-idioms#' + ('0000000' + n).slice(-8);
      m.stats.bySentence[key].times = m.stats.bySentence[key].times + 1;
      m.stats.events.push({
        id: 'ev-live-' + n, kind: 'answer', key: key, deckId: 'freq-idioms',
        sentence: 'This is a longer sample sentence used to measure sync payload number ' + n + '.',
        ok: true, at: 1700009990000 + n
      });
      m.stats.totalAnswered = (m.stats.totalAnswered || 0) + 1;
      window.CL.saveMem(m);
      return await window.CL.cloudSyncNow(m);
    }, round);
    await p.waitForTimeout(400);
    const size = puts.length > before ? puts[puts.length - 1] : -1;
    deltas.push(size);
    check('2.' + (round + 1) + ' 第 ' + (round + 1) + ' 次增量上行成功', r === true, 'ok=' + r);
  }

  const maxDelta = Math.max.apply(null, deltas);
  const minDelta = Math.min.apply(null, deltas);
  console.log('      · 增量上行体积：' + deltas.map(kb).join(' / '));
  check('2.6 每次增量都 < 20KB', maxDelta >= 0 && maxDelta < 20 * 1024, 'max=' + kb(maxDelta));
  check('2.7 增量远小于首轮全量（≥20×）', firstSize > 0 && maxDelta > 0 && firstSize / maxDelta >= 20,
    'first=' + kb(firstSize) + ' max=' + kb(maxDelta) + ' ratio=' + (maxDelta > 0 ? (firstSize / maxDelta).toFixed(1) : 'n/a'));
  check('2.8 各次增量体积稳定（无回退成全量）', minDelta >= 0 && maxDelta < 20 * 1024, 'min=' + kb(minDelta));

  /* ---------- 3. 服务端数据完整（增量没丢） ---------- */
  const data = await getData();
  const st = data && data.mem && data.mem.stats;
  check('3.1 服务端有全部 800 条句子档案', !!(st && Object.keys(st.bySentence).length === 800),
    'n=' + (st ? Object.keys(st.bySentence).length : 'n/a'));
  check('3.2 服务端事件数 = 2000 + 5 次增量', !!(st && st.events.length === 2005), 'n=' + (st ? st.events.length : 'n/a'));
  const bumped = st && st.bySentence['freq-idioms#00000000'];
  check('3.3 增量修改已落库（times 3 → 4）', !!(bumped && bumped.times === 4), 'times=' + (bumped && bumped.times));
  /* 初始 totalAnswered 为 0（事件是直接 push 进数组的），5 次增量各 +1 → 正是 5。
     这条同时证明「小字段随每次增量一起上行」没被拆表逻辑漏掉。 */
  check('3.4 stats 小字段随增量更新（5 次 +1 = 5）', !!(st && st.totalAnswered === 5), 'totalAnswered=' + (st && st.totalAnswered));

  /* ---------- 5. 行级实体增量：取消标熟只发 1 行 + 墓碑下发 ----------
     这三个对象（mastered / 错题本 / deletedItems）先前也塞在 kv blob 里，
     本段是「每答一题不再全量重传」的核心回归。 */
  const beforeUnmark = puts.length;
  const unmark = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    delete m.mastered['freq-idioms#00000042'];
    window.CL.saveMem(m);
    return await window.CL.cloudSyncNow(m);
  });
  await p.waitForTimeout(400);
  const unmarkSize = puts.length > beforeUnmark ? puts[puts.length - 1] : -1;
  check('5.1 取消标熟上行成功', unmark === true, 'ok=' + unmark);
  check('5.2 取消标熟只上行 1 行（<4KB）', unmarkSize > 0 && unmarkSize < 4096, 'size=' + kb(unmarkSize));
  console.log('      · 取消标熟上行：' + kb(unmarkSize));

  const data3 = await getData();
  check('5.3 服务端该 key 已消失', !data3.mem.mastered['freq-idioms#00000042'],
    'mastered n=' + Object.keys(data3.mem.mastered).length);
  check('5.4 其余 799 条标熟未受影响（不是整块替换）', Object.keys(data3.mem.mastered).length === 799,
    'n=' + Object.keys(data3.mem.mastered).length);
  check('5.5 删除墓碑随响应下发（他机才不会再把它写活）',
    !!(data3.entityGone && (data3.entityGone.mastered || []).indexOf('freq-idioms#00000042') >= 0),
    JSON.stringify(data3.entityGone && data3.entityGone.mastered));
  check('5.6 错题本 200 条完整落库', (data3.mem.reinforceBook || []).length === 200,
    'n=' + (data3.mem.reinforceBook || []).length);
  check('5.7 deletedItems 50 条完整落库（映射形态）',
    data3.mem.deletedItems && Object.keys(data3.mem.deletedItems).length === 50,
    'n=' + Object.keys(data3.mem.deletedItems || {}).length);

  /* ---------- 6. 删除 deck：必须真传到服务端（否则刷新会复活） ----------
     既有 bug：删除登记取自「上一次 saveMem 的 diff」，若 400ms 防抖窗口内又保存一次，
     登记被新的空 diff 覆盖 → 服务端永远收不到删除，而本机已无该 deck
     → 下次 syncFromCloud 把它从云端拉回来（复活）。 */
  const beforeDel = puts.length;
  const del = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    m.decks = m.decks.filter(function (d) { return d.id !== 'user-big'; });
    window.CL.saveMem(m);
    return await window.CL.cloudSyncNow(m);
  });
  await p.waitForTimeout(400);
  const delSize = puts.length > beforeDel ? puts[puts.length - 1] : -1;
  check('6.1 删除 deck 上行成功', del === true, 'ok=' + del);
  check('6.2 删除 deck 的上行体积很小（<8KB）', delSize > 0 && delSize < 8192, 'size=' + kb(delSize));
  const data4 = await getData();
  check('6.3 服务端该 deck 已软删',
    !(data4.mem.decks || []).some(function (d) { return d.id === 'user-big'; }),
    'decks=' + JSON.stringify((data4.mem.decks || []).map(function (d) { return d.id; })));
  check('6.4 删除 deck 不影响标熟行', Object.keys(data4.mem.mastered).length === 799,
    'n=' + Object.keys(data4.mem.mastered).length);

  /* ---------- 4. 刷新页面后不得回退为全量 ----------
     这是拆表最容易失效的地方：水位是**内存变量**，刷新即丢（重置为 null）。
     若不在 syncFromCloud 时把水位对齐到「云端实际内容」，刷新后的第一次上行
     就会把全部档案 + 全部事件重传一遍 —— 拆表省下的流量被这一个场景吃掉。 */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(function () {
    return !!(window.CL && window.CL.cloudSyncNow && window.CL.loadMem);
  }, { timeout: 15000 });
  await p.waitForTimeout(2500); /* 等 ensureCloud → syncFromCloud 完成并对齐水位 */

  const beforeReload = puts.length;
  const afterReload = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    var key = 'freq-idioms#00000005';
    m.stats.bySentence[key].times = m.stats.bySentence[key].times + 1;
    m.stats.events.push({
      id: 'ev-after-reload', kind: 'answer', key: key, deckId: 'freq-idioms',
      sentence: 'after reload', ok: true, at: 1700015000000
    });
    window.CL.saveMem(m);
    return await window.CL.cloudSyncNow(m);
  });
  await p.waitForTimeout(400);
  const reloadSize = puts.length > beforeReload ? puts[puts.length - 1] : -1;
  check('4.1 刷新后同步成功', afterReload === true, 'ok=' + afterReload);
  check('4.2 刷新后首次上行仍为 KB 级（未回退全量）', reloadSize > 0 && reloadSize < 20 * 1024,
    'size=' + kb(reloadSize) + '（全量应为 ~' + kb(firstSize) + '）');
  console.log('      · 刷新后首次上行：' + kb(reloadSize));

  const data2 = await getData();
  const st2 = data2 && data2.mem && data2.mem.stats;
  check('4.3 刷新后数据仍完整（800 条档案）', !!(st2 && Object.keys(st2.bySentence).length === 800),
    'n=' + (st2 ? Object.keys(st2.bySentence).length : 'n/a'));
  check('4.4 刷新后事件数 = 2006（未重复、未丢失）', !!(st2 && st2.events.length === 2006),
    'n=' + (st2 ? st2.events.length : 'n/a'));
  check('4.5 刷新后的修改已落库', !!(st2 && st2.bySentence['freq-idioms#00000005'].times === 4),
    'times=' + (st2 && st2.bySentence['freq-idioms#00000005'].times));
  /* 刷新后「服务端实况」没有被本机旧副本覆盖回来（复活） */
  check('4.6 已软删的 deck 未复活',
    !(data2.mem.decks || []).some(function (d) { return d.id === 'user-big'; }),
    'decks=' + JSON.stringify((data2.mem.decks || []).map(function (d) { return d.id; })));
  check('4.7 已取消标熟的 key 未复活', !data2.mem.mastered['freq-idioms#00000042'],
    'n=' + Object.keys(data2.mem.mastered).length);
  check('4.8 错题本仍为 200 条（未被清空）', (data2.mem.reinforceBook || []).length === 200,
    'n=' + (data2.mem.reinforceBook || []).length);

  await browser.close();
  stopServer();
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* noop */ }

  console.log('\n[sync-delta e2e] ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('[sync-delta e2e] FATAL', e);
  stopServer();
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (x) { /* noop */ }
  process.exit(1);
});
