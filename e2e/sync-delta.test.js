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

  /* ---------- 1. 造「练过 800 句」的规模并首轮同步（水位未知 → 全量） ---------- */
  const first = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    if (!m.stats) m.stats = { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] };
    if (!m.stats.bySentence) m.stats.bySentence = {};
    if (!Array.isArray(m.stats.events)) m.stats.events = [];
    for (var i = 0; i < 800; i++) {
      m.stats.bySentence['freq-idioms#' + ('0000000' + i).slice(-8)] = {
        deckId: 'freq-idioms', deckName: '高频短语 · English Idioms',
        sentence: 'This is a longer sample sentence used to measure sync payload number ' + i + '.',
        translation: '这是一个用来测量同步体积的较长示例句子。',
        times: 3, okTimes: 2, wrongTimes: 1, streak: 1, maxStreak: 2,
        lastAt: 1700000000000, interval: 4, ease: 2.5, dueAt: 1700003600000, repetition: 2
      };
    }
    for (var j = 0; j < 2000; j++) {
      m.stats.events.push({
        id: 'ev' + j, kind: 'answer', key: 'freq-idioms#00000000', deckId: 'freq-idioms',
        sentence: 'This is a longer sample sentence used to measure sync payload number ' + (j % 800) + '.',
        ok: true, at: 1700000000000 + j
      });
    }
    window.CL.saveMem(m);
    var ok = await window.CL.cloudSyncNow(m);
    return { ok: ok, sbs: Object.keys(m.stats.bySentence).length, events: m.stats.events.length };
  });

  check('1.1 首轮同步成功', first.ok === true, JSON.stringify(first));
  check('1.2 本地已构造 800 条档案 / 2000 条事件', first.sbs === 800 && first.events === 2000, JSON.stringify(first));

  await p.waitForTimeout(500);
  const firstSize = puts.length ? puts[puts.length - 1] : 0;
  check('1.3 首轮为全量上行（>100KB）', firstSize > 100 * 1024, 'size=' + kb(firstSize));
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
