/**
 * multitab-stale.test.js · 多标签页旧快照覆盖防护 端到端验证（P0 数据可靠性加固）
 *
 * 一键运行：CHROMIUM_PATH=... node e2e/multitab-stale.test.js   （npm run e2e:all 自动纳入）
 *
 * 为什么必须真浏览器：本问题只在「同一 browser context 里的两个真实标签页」出现 ——
 * 两个文档共享同一份 localStorage，却各持一份永不自动刷新的内存态。JsDOM/单测能验证合并
 * 语义，但证明不了真实的共享存储与广播通道（BroadcastChannel / storage 事件）在浏览器里跑得通。
 *
 * 关键约束：两个 page 必须来自**同一个 context**（同 context 才共享 localStorage）。
 *   const ctx = await browser.newContext(); const pageA = await ctx.newPage(); const pageB = await ctx.newPage();
 *
 * 覆盖：
 *   1. 负向验证：按改造前方式（无写前检查的整份覆盖）→ B 的新 deck 静默消失（漏洞真实存在）
 *   2. 正向验证：A 的旧快照经真实写入入口落盘 → B 的新 deck / 标熟 / 计数 / 打卡全保留
 *   3. 跨标签页广播：B 写入后 A 无需刷新页面即收到 memExternal 并采纳磁盘态
 *   4. CL.refreshExternal()：A 能重新从 IDB 载入另一个标签页刚写的句子档案
 *
 * 自带服务器（spawn index.js），不依赖外部端口；/api/** 一律 abort → 纯本地模式，结果确定。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9500, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-mtab-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
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
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ---------- 页面内脚本（注入后在页面上下文执行） ---------- */
/* 标签页 B 答题：新增 deckB + 标熟一句 + 记计数与打卡 */
function PAGE_ADD_DECK_B() {
  var m = window.CL.loadMem();
  m.decks = (m.decks || []).filter(function (d) { return d.id !== 'deckB'; });
  m.decks.push({
    id: 'deckB', name: 'B 的题库', builtin: false,
    items: [{ sentence: 'Sentence deckB', cid: 'bbbbbbbb', translation: '', chunks: [], hints: [], alts: [] }]
  });
  m.mastered = m.mastered || {};
  m.mastered['deckB#bbbbbbbb'] = { deckId: 'deckB', sentence: 'Sentence deckB', markedAt: 111 };
  m.stats = m.stats || {};
  m.stats.bySentence = m.stats.bySentence || {};
  m.stats.bySentence['deckB#bbbbbbbb'] = {
    deckId: 'deckB', sentence: 'Sentence deckB',
    times: 3, okTimes: 2, wrongTimes: 1, streak: 2, maxStreak: 2,
    lastAt: Date.now(), interval: 1, ease: 2.5, dueAt: Date.now() + 86400000
  };
  m.stats.events = m.stats.events || [];
  m.stats.events.push({ id: 'ev-b-1', kind: 'answer', key: 'deckB#bbbbbbbb', deckId: 'deckB', sentence: 'Sentence deckB', ok: true, at: Date.now() });
  m.stats.totalAnswered = (Number(m.stats.totalAnswered) || 0) + 3;
  m.stats.totalRounds = (Number(m.stats.totalRounds) || 0) + 1;
  m.stats.daysLog = m.stats.daysLog || {};
  m.stats.daysLog['2026-09-11'] = { rounds: 1 };
  return window.CL.saveAndNotify(m);
}
/* 读磁盘观测值（不经过任何内存态） */
function PAGE_READ_STATE() {
  var o = {};
  try { o = JSON.parse(window.AccountStorage.storage.getItem('chunklab.v1') || '{}'); } catch (e) { o = {}; }
  return {
    deckIds: (o.decks || []).map(function (d) { return d.id; }).sort(),
    hasBMarked: !!(o.mastered && o.mastered['deckB#bbbbbbbb']),
    totalAnswered: (o.stats && Number(o.stats.totalAnswered)) || 0,
    rounds: (o.stats && Number(o.stats.totalRounds)) || 0,
    daysLog: (o.stats && o.stats.daysLog) || {},
    version: o.version
  };
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || require('playwright-core').chromium.executablePath()
  });
  console.log('multitab-stale server: ' + BASE);

  /* 同一 context = 共享 localStorage（两个标签页的必要条件）；SW 关掉、/api 断开 → 纯本地、确定 */
  async function newCtx() {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('**/api/**', function (route) { return route.abort(); });
    return ctx;
  }
  async function boot(page) {
    page.on('pageerror', function (e) { console.log('  [pageerror] ' + e.message); });
    await page.goto(BASE + '/main.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(function () { return !!(window.CL && window.CL.saveMem && window.CL.__crossTab); }, null, { timeout: 20000 });
    /* 等启动段（bootMain → showHomePage）结束、启动期的落盘全部尘埃落定 */
    await page.waitForFunction(function () { var h = document.getElementById('pageHome'); return !!h && !h.classList.contains('hidden'); }, null, { timeout: 20000 });
    await page.waitForTimeout(500);
  }
  /* 提交一次「内容不变」的写：把本页基线对齐到当前磁盘态（之后本页才算「有基线」） */
  async function settle(page) {
    return page.evaluate(function () { return window.CL.saveAndNotify(window.CL.loadMem()); });
  }

  /* ================= 1. 负向验证：改造前的整份覆盖会丢数据 ================= */
  console.log('\n【1. 负向验证：无写前检查的整份覆盖 → 其他标签页的新数据静默消失】');
  const ctxNeg = await newCtx();
  const nA = await ctxNeg.newPage();
  const nB = await ctxNeg.newPage();
  await boot(nA);
  await boot(nB);
  await settle(nA);
  await settle(nB);
  /* A 记下自己此刻的「旧快照」原始串（这是 P0 里那个会覆盖别人的旧快照） */
  await nA.evaluate(function () {
    window.__staleRaw = window.AccountStorage.storage.getItem('chunklab.v1');
    window.__stale = window.CL.loadMem();
  });
  check('前置：A 的旧快照里没有 deckB',
    (await nA.evaluate(function () { return JSON.parse(window.__staleRaw).decks.map(function (d) { return d.id; }); })).indexOf('deckB') < 0);
  /* B 答题（真实写入入口） */
  await nB.evaluate(PAGE_ADD_DECK_B);
  const negBefore = await nA.evaluate(PAGE_READ_STATE);
  check('前置：B 的 deckB 已落盘（B 的写入正常生效）',
    negBefore.deckIds.indexOf('deckB') >= 0, JSON.stringify(negBefore.deckIds));
  /* A 按改造前的方式整份覆盖（等价旧 writeLocalMem：写前不做任何版本检查） */
  await nA.evaluate(function () { window.AccountStorage.storage.setItem('chunklab.v1', window.__staleRaw); });
  const negAfter = await nA.evaluate(PAGE_READ_STATE);
  check('★ 负向验证：无保护的整份覆盖 → B 的 deckB 静默消失（漏洞真实存在，护栏有的放矢）',
    negAfter.deckIds.indexOf('deckB') < 0, JSON.stringify(negAfter.deckIds));
  await ctxNeg.close();

  /* ================= 2. 正向验证：改造后 A 的旧快照不覆盖 B 的新数据 ================= */
  console.log('\n【2. 正向验证：A 的旧快照经真实写入入口落盘 → B 的新数据全保留】');
  const ctx = await newCtx();
  const pA = await ctx.newPage();
  const pB = await ctx.newPage();
  await boot(pA);
  await boot(pB);
  await settle(pA);
  await settle(pB);
  /* A 记下旧快照 + 挂上跨标签页监听（用于验证广播） */
  await pA.evaluate(function () {
    window.__stale = window.CL.loadMem();
    window.__ext = { n: 0, last: null };
    window.CL.on('memExternal', function (ev) { window.__ext.n++; window.__ext.last = ev && ev.area; });
  });
  /* B 答题：真实写入入口（含新 deck / 标熟 / 计数 / 打卡） */
  await pB.evaluate(PAGE_ADD_DECK_B);

  /* 2a. 跨标签页广播：A 无需刷新页面即收到 memExternal */
  await pA.waitForFunction(function () { return window.__ext && window.__ext.n >= 1; }, null, { timeout: 5000 })
    .then(function () { check('★ B 写入后 A 立即收到跨标签页通知（无需刷新页面）', true); },
      function () { check('★ B 写入后 A 立即收到跨标签页通知（无需刷新页面）', false, '超时未收到 memExternal'); });

  /* 2b. 核心：A 用旧快照写入（真实入口，有防护） */
  const okPos = await pA.evaluate(async function () { return await window.CL.saveAndNotify(window.__stale); });
  const pos = await pA.evaluate(PAGE_READ_STATE);
  check('正向：saveAndNotify 返回成功', okPos === true, String(okPos));
  check('★ A 的旧快照没有覆盖 B 的新 deck（deckB 仍在）',
    pos.deckIds.indexOf('deckB') >= 0, JSON.stringify(pos.deckIds));
  check('★ B 的标熟档案没被 A 的旧快照抹掉', pos.hasBMarked === true, JSON.stringify(pos));
  check('★ 计数单调不回退：totalAnswered 保留 B 的 +3（不回退）',
    pos.totalAnswered >= 3, 'totalAnswered=' + pos.totalAnswered);
  check('★ 打卡合并：B 的 09-11 仍在', !!(pos.daysLog && pos.daysLog['2026-09-11']), JSON.stringify(pos.daysLog));
  const ct = await pA.evaluate(function () { return window.CL.crossTabState(); });
  check('★ A 的这次写入确实走了「跨标签页三路合并」（merges >= 1）',
    ct && ct.merges >= 1, JSON.stringify(ct));

  /* 2c. A 与 B 各自再写一次，反复覆盖仍不丢 */
  await pA.evaluate(function () { return window.CL.saveAndNotify(window.CL.loadMem()); });
  await pB.evaluate(function () { var m = window.CL.loadMem(); m.settings = m.settings || {}; m.settings.darkMode = true; return window.CL.saveAndNotify(m); });
  await pA.evaluate(function () {
    var m = window.CL.loadMem();
    m.decks = (m.decks || []).filter(function (d) { return d.id !== 'deckA'; });
    m.decks.push({ id: 'deckA', name: 'A 的题库', builtin: false, items: [] });
    return window.CL.saveAndNotify(m);
  });
  const pos2 = await pB.evaluate(PAGE_READ_STATE);
  check('★ 反复写入后两边的 deck 都在（deckA + deckB）',
    pos2.deckIds.join(',') === 'deckA,deckB', JSON.stringify(pos2.deckIds));

  /* 2d. refreshExternal：A 重新从 IDB 载入另一个标签页刚写的句子档案 */
  const refreshed = await pA.evaluate(async function () {
    var m = await window.CL.refreshExternal();
    var by = (m.stats && m.stats.bySentence) || {};
    var hasB = Object.keys(by).some(function (k) { return by[k] && by[k].sentence === 'Sentence deckB'; });
    return { mode: window.CL.statsStoreMode(), rows: Object.keys(by).length, hasB: hasB };
  });
  check('★ refreshExternal：A 能看到 B 刚写的句子档案（statsStoreMode=' + refreshed.mode + '）',
    refreshed.mode === 'idb' ? refreshed.hasB === true : true,
    JSON.stringify(refreshed));

  await ctx.close();
  await browser.close();
  stopServer();

  console.log('\n[multitab-stale e2e] passed=' + passed + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('[multitab-stale] fatal:', e);
  stopServer();
  process.exit(1);
});
