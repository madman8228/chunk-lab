/**
 * stats-idb.test.js · stats 大对象分层持久化（IndexedDB）端到端验证
 *
 * 一键运行：CHROMIUM_PATH=... node e2e/stats-idb.test.js   （或 npm run e2e:all 自动纳入）
 *
 * 为什么需要真浏览器：单测（stats-idb.test.js 根目录那个）用的是内存版 IDB mock，
 * 只能证明「逻辑分支对」，证明不了真实 IndexedDB 的建库/事务/版本升级在浏览器里跑得通。
 * 本次改造（2026-09-10 扩容 8000 句）动的是用户全部学习档案的落点，必须在真浏览器验证。
 *
 * 覆盖：
 *   1. 老用户迁移：localStorage 里的 bySentence/events 迁进 IDB，且副本被剥离
 *   2. 迁移后刷新页面：loadMem 能从 IDB 内存桥还原（数据不丢）
 *   3. 真答题：答题后 localStorage 仍不含大对象（热路径不再整份重写）
 *   4. db 版本升级：v4 老库的统计原文、课程与统计值保留
 *
 * 自带服务器（spawn index.js），不依赖外部端口。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9400, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-statsidb-'));
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
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* 在页面里读 IDB 的辅助脚本（同源，页面内执行才有 IndexedDB 权限） */
const READ_IDB = function () {
  return new Promise(function (resolve) {
    /* 账户隔离开启后，数据库名可能包含 owner；始终读取应用实际使用的库。 */
    var req = indexedDB.open(window.AccountStorage ? window.AccountStorage.databaseName : 'chunklab-idb');
    req.onsuccess = function () {
      var db = req.result;
      var names = Array.prototype.slice.call(db.objectStoreNames);
      var out = { version: db.version, stores: names, sentenceStats: -1, events: -1 };
      var pending = 0, done = function () { if (--pending === 0) { db.close(); resolve(out); } };
      if (names.indexOf('sentenceStats') >= 0) {
        pending++;
        var t = db.transaction('sentenceStats', 'readonly').objectStore('sentenceStats').count();
        t.onsuccess = function () { out.sentenceStats = t.result; done(); };
        t.onerror = function () { done(); };
      }
      if (names.indexOf('events') >= 0) {
        pending++;
        var t2 = db.transaction('events', 'readonly').objectStore('events').count();
        t2.onsuccess = function () { out.events = t2.result; done(); };
        t2.onerror = function () { done(); };
      }
      if (pending === 0) { db.close(); resolve(out); }
    };
    req.onerror = function () { resolve({ error: 'open failed' }); };
  });
};

async function main() {
  await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || require('playwright-core').chromium.executablePath()
  });
  const BASE = 'http://127.0.0.1:' + PORT;

  /* ---------- 1. 老用户迁移 ---------- */
  console.log('【1. 老用户迁移：localStorage 大对象 → IndexedDB 并剥离副本】');
  const ctx = await browser.newContext();
  /* 用 addInitScript 在页面任何脚本执行前注入 legacy localStorage ——
     模拟「升级前的老用户」。若改用 evaluate 事后写入，会与首屏 ensureCloud 的写盘竞态。 */
  await ctx.addInitScript(function () {
    // This suite tests an already-owned legacy database. Unknown ownership is
    // deliberately quarantined and tested separately in account-isolation.test.js.
    localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
    if (localStorage.getItem('chunklab.v1')) return;
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
      stats: {
        totalRounds: 7, totalAnswered: 30,
        bySentence: {
          'builtin-daily#11111111': { deckId: 'builtin-daily', sentence: 'Legacy A', times: 3, okTimes: 2, wrongTimes: 1, lastAt: 1000, interval: 1, ease: 2.5, dueAt: 2000 },
          'builtin-daily#22222222': { deckId: 'builtin-daily', sentence: 'Legacy B', times: 5, okTimes: 4, wrongTimes: 1, lastAt: 1100, interval: 1, ease: 2.5, dueAt: 2100 }
        },
        events: [{ id: 'ev-1', kind: 'answer', key: 'builtin-daily#11111111', ok: true, at: 1000 }],
        daysLog: { '2026-09-10': { rounds: 3 } }
      },
      settings: {}, reinforceBook: [], progress: {}
    }));
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/main.html', { waitUntil: 'load' });
  await page.waitForFunction(function () { return window.CL && window.CL.statsStoreMode() === 'idb'; }, null, { timeout: 15000 });

  const idb1 = await page.evaluate(READ_IDB);
  check('IDB 已建 sentenceStats / events store',
    idb1.stores && idb1.stores.indexOf('sentenceStats') >= 0 && idb1.stores.indexOf('events') >= 0,
    JSON.stringify(idb1.stores));
  check('DB 版本为 9', idb1.version === 9, 'version=' + idb1.version);
  check('同步元数据 store 已建立', idb1.stores.indexOf('syncMeta') >= 0, JSON.stringify(idb1.stores));
  check('迁移后 sentenceStats 行数 = 2', idb1.sentenceStats === 2, 'got=' + idb1.sentenceStats);
  check('迁移后 events 行数 = 1', idb1.events === 1, 'got=' + idb1.events);
  const compactedLegacyStats = await page.evaluate(async function () {
    var data = await IDBStore.loadAll();
    var first = data.sentenceStats['builtin-daily#11111111'];
    var second = data.sentenceStats['builtin-daily#22222222'];
    return {
      firstHasSentence: !!(first && Object.prototype.hasOwnProperty.call(first, 'sentence')),
      secondHasSentence: !!(second && Object.prototype.hasOwnProperty.call(second, 'sentence')),
      firstTimes: first && first.times,
      secondTimes: second && second.times
    };
  });
  check('旧统计行迁移后保留 sentence 与统计值',
    compactedLegacyStats.firstHasSentence && compactedLegacyStats.secondHasSentence
      && compactedLegacyStats.firstTimes === 3 && compactedLegacyStats.secondTimes === 5,
    JSON.stringify(compactedLegacyStats));

  const ls1 = await page.evaluate(function () {
    var o = JSON.parse(localStorage.getItem('chunklab.v1') || '{}');
    return { hasBS: !!(o.stats && o.stats.bySentence), hasEv: !!(o.stats && o.stats.events), rounds: o.stats && o.stats.totalRounds };
  });
  check('localStorage 副本已剥离 bySentence / events', !ls1.hasBS && !ls1.hasEv, JSON.stringify(ls1));
  check('小字段 totalRounds 仍留在 localStorage', ls1.rounds === 7, 'got=' + ls1.rounds);

  /* ---------- 2. 刷新后 loadMem 能从 IDB 还原 ---------- */
  console.log('\n【2. 迁移后刷新：loadMem 从 IDB 内存桥还原（不丢数据）】');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(function () { return window.CL && window.CL.statsStoreMode() === 'idb'; }, null, { timeout: 15000 });
  /* reload 后先等初始化/迁移写入排空，避免本测试的增量提交与首屏全量水合竞争同一写入队列。 */
  await page.evaluate(function () { return window.CL.waitForSync(); });
  const restored = await page.evaluate(function () {
    var m = window.CL.loadMem();
    return {
      n: Object.keys(m.stats.bySentence).length,
      times: m.stats.bySentence['builtin-daily#11111111'] ? m.stats.bySentence['builtin-daily#11111111'].times : -1,
      ev: m.stats.events.length,
      answered: m.stats.totalAnswered
    };
  });
  check('刷新后 bySentence 仍为 2 条', restored.n === 2, JSON.stringify(restored));
  check('刷新后档案内容正确（times=3）', restored.times === 3, JSON.stringify(restored));
  check('刷新后 events 仍为 1 条', restored.ev === 1, JSON.stringify(restored));
  check('刷新后聚合值保留（totalAnswered=30）', restored.answered === 30, JSON.stringify(restored));

  /* ---------- 3. 真答题：热路径不再整份重写 localStorage ---------- */
  console.log('\n【3. 真答题：大对象不进 localStorage 写路径】');
  const practice = await page.evaluate(function () {
    /* 直接走真实写入入口：CL.saveMem 是 main.html saveStore 的落点 */
    var m = window.CL.loadMem();
    m.stats.bySentence['builtin-daily#11111111'].times = 4;
    m.stats.bySentence['builtin-daily#11111111'].okTimes = 3;
    m.stats.events.push({ id: 'ev-2', kind: 'answer', key: 'builtin-daily#11111111', ok: true, at: 1200 });
    var ok = window.CL.saveMem(m);
    var raw = JSON.parse(localStorage.getItem('chunklab.v1') || '{}');
    return { ok: ok, hasBS: !!(raw.stats && raw.stats.bySentence), hasEv: !!(raw.stats && raw.stats.events) };
  });
  check('saveMem 返回成功', practice.ok === true, JSON.stringify(practice));
  check('答题后 localStorage 仍不含 bySentence / events', !practice.hasBS && !practice.hasEv, JSON.stringify(practice));
  /* saveMem 保持同步返回值，但 IDB 事务通过 CL.lastSave() 异步提交。
     固定 sleep 在 Windows 慢机器上会早于事务完成，读到旧 events 数量。 */
  await page.evaluate(function () { return window.CL.lastSave(); });
  const idb2 = await page.evaluate(READ_IDB);
  check('答题已增量落盘（sentenceStats 仍 2 行）', idb2.sentenceStats === 2, 'got=' + idb2.sentenceStats);
  check('答题已增量落盘（events 增至 2 条）', idb2.events === 2, 'got=' + idb2.events);

  /* 让下一段交错夹具从一次真实刷新后的 IDB 水合状态开始，避免使用仍停留在迁移前的
     内存桥快照；这也顺便保留“保存后刷新继续答题”的真实入口。 */
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(function () { return window.CL && window.CL.statsStoreMode() === 'idb'; }, null, { timeout: 15000 });
  await page.evaluate(function () { return window.CL.waitForSync(); });

  /* ---------- 3b. 受控交错：首批提交等待时追加后继事件 ---------- */
  console.log('\n【3b. 慢事务交错：后继事件不能被已提交水位跳过】');
  const interleaved = await page.evaluate(async function () {
    var original = IDBStore.writeStatsBatch;
    var release;
    var firstStartedResolve;
    var gate = new Promise(function (resolve) { release = resolve; });
    var firstStarted = new Promise(function (resolve) { firstStartedResolve = resolve; });
    var calls = 0;
    IDBStore.writeStatsBatch = function () {
      calls++;
      if (calls === 1) {
        var args = arguments;
        firstStartedResolve();
        return gate.then(function () { return original.apply(IDBStore, args); });
      }
      return original.apply(IDBStore, arguments);
    };
    try {
      var m = window.CL.loadMem();
      m.stats.events.push({ id: 'ev-race-1', kind: 'answer', key: 'builtin-daily#11111111', ok: true, at: 1300 });
      window.CL.saveMem(m);
      await firstStarted;
      m.stats.events.push({ id: 'ev-race-2', kind: 'answer', key: 'builtin-daily#11111111', ok: true, at: 1400 });
      window.CL.saveMem(m);
      release();
      await window.CL.waitForSync();
      var persisted = await window.IDBStore.loadAll();
      var ids = (persisted.events || []).map(function (event) { return event.id; });
      return {
        calls: calls,
        ids: ids,
        count: ids.length,
        memCount: m.stats.events.length,
        times: m.stats.bySentence['builtin-daily#11111111'].times,
        hasFirst: ids.indexOf('ev-race-1') >= 0,
        hasSecond: ids.indexOf('ev-race-2') >= 0
      };
    } finally {
      release();
      IDBStore.writeStatsBatch = original;
    }
  });
  check('慢事务交错后两条后继事件都已落盘',
    interleaved.hasFirst && interleaved.hasSecond,
    JSON.stringify(interleaved));
  /* 计数不变量：交错后 IDB 事件数必须等于内存事件数。
     只断言「两条 id 都在」时，「第二批 eventRows 为空但仍侥幸命中」这类改写不会被发现；
     这条把 A1 的失效形态（水位虚高 → 下一批切片为空 → 静默丢事件）钉成显式等式。 */
  check('交错后 IDB 事件数 == 内存事件数（水位未虚高）',
    interleaved.count === interleaved.memCount,
    'idb=' + interleaved.count + ' mem=' + interleaved.memCount + ' ' + JSON.stringify(interleaved));
  console.log('  [交错落盘状态] ' + JSON.stringify(interleaved));

  /* 小字段 localStorage 投影损坏时，只从同 owner 的已提交 IDB 投影重建，
     不覆盖有效投影，也不伪造未进入投影的题库内容。 */
  await page.evaluate(function () { localStorage.removeItem('chunklab.v1'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(function () { return window.CL && window.CL.statsStoreMode() === 'idb'; }, null, { timeout: 15000 });
  const projectionRecovery = await page.evaluate(function () {
    var m=window.CL.loadMem(), raw=JSON.parse(localStorage.getItem('chunklab.v1')||'{}');
    return { rounds:m.stats.totalRounds, events:m.stats.events.length, hasStorage:!!raw.stats };
  });
  check('小字段投影损坏后可从同账号 IDB 重建', projectionRecovery.hasStorage && projectionRecovery.events === 4,
    JSON.stringify(projectionRecovery));

  /* 刷新后新写入的答题记录仍在 */
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(function () { return window.CL && window.CL.statsStoreMode() === 'idb'; }, null, { timeout: 15000 });
  const afterReload = await page.evaluate(function () {
    var m = window.CL.loadMem();
    return { times: m.stats.bySentence['builtin-daily#11111111'].times, ev: m.stats.events.length };
  });
  check('刷新后增量写入的档案保留（times=4）', afterReload.times === 4, JSON.stringify(afterReload));
  check('刷新后增量写入的事件保留（4 条）', afterReload.ev === 4, JSON.stringify(afterReload));

  await ctx.close();

  /* ---------- 4. v4 老库升级并保留原始统计行 ---------- */
  console.log('\n【4. IndexedDB v4 老库升级到 v9 并保留句子原文】');
  const ctx2 = await browser.newContext();
  /* 必须在页面脚本执行前造出 v4 旧行：应用打开 v8 后，低版本库无法再复现。 */
  await ctx2.addInitScript(function () {
    if (localStorage.getItem('__seeded_v4')) return;
    localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
    localStorage.setItem('__seeded_v4', '1');
    return new Promise(function (resolve) {
      var req = indexedDB.open('chunklab-idb', 4);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'courseId' });
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'cid' });
        if (!db.objectStoreNames.contains('sentenceStats')) db.createObjectStore('sentenceStats', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('syncIntents')) db.createObjectStore('syncIntents', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('syncMeta')) db.createObjectStore('syncMeta', { keyPath: 'key' });
      };
      req.onsuccess = function () {
        var db = req.result;
        /* 页面加载后 js/idb.js 会升级到 v9；这里保存旧库 store 清单供前置条件断言。 */
        window.__v4Stores = Array.prototype.slice.call(db.objectStoreNames);
        var tx = db.transaction(['courses', 'sentenceStats'], 'readwrite');
        tx.objectStore('courses').put({ courseId: 'legacy-course', title: '老课程' });
        tx.objectStore('sentenceStats').put({ key: 'legacy-course#old-cid', data: {
          deckId: 'legacy-course', sentence: 'Old sentence copy', times: 6, okTimes: 4, wrongTimes: 2, dueAt: 1234
        } });
        tx.oncomplete = function () { db.close(); resolve(); };
      };
      req.onerror = function () { resolve(); };
    });
  });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', function (e) { console.log('  [pageerror] ' + e.message); });
  await page2.goto(BASE + '/main.html', { waitUntil: 'load' });
  /* 前置条件自检：init 阶段记录 v4 store 清单；页面脚本之后已经将其升级到 v9。 */
  const built = await page2.evaluate(function () { return window.__v4Stores || []; });
  check('已建出包含 sentenceStats 的 v4 旧库',
    built.indexOf('sentenceStats') >= 0 && built.indexOf('syncMeta') >= 0, JSON.stringify(built));

  await page2.reload({ waitUntil: 'load' });
  await page2.waitForFunction(function () { return window.CL && window.CL.statsStoreMode() === 'idb'; }, null, { timeout: 15000 });
  const up = await page2.evaluate(READ_IDB);
  check('升级后版本为 9', up.version === 9, 'version=' + up.version);
  check('升级后补齐 sentenceStats / events store',
    up.stores.indexOf('sentenceStats') >= 0 && up.stores.indexOf('events') >= 0 && up.stores.indexOf('syncMeta') >= 0, JSON.stringify(up.stores));
  const courseKept = await page2.evaluate(function () {
    var m = window.CL.readCourses();
    return m.length;
  });
  check('升级不清空既有 courses 数据', courseKept === 1, 'got=' + courseKept);
  const compactedV4 = await page2.evaluate(async function () {
    var data = await IDBStore.loadAll();
    var statKey = Object.keys(data.sentenceStats).find(function (key) { return key.indexOf('legacy-course#') === 0; });
    var stat = statKey && data.sentenceStats[statKey];
    return {
      hasStat: !!stat,
      hasSentence: !!(stat && Object.prototype.hasOwnProperty.call(stat, 'sentence')),
      times: stat && stat.times,
      okTimes: stat && stat.okTimes,
      dueAt: stat && stat.dueAt
    };
  });
  check('v4 旧统计行升级时保留原文与统计字段',
    compactedV4.hasSentence && compactedV4.times === 6 && compactedV4.okTimes === 4 && compactedV4.dueAt === 1234,
    JSON.stringify(compactedV4));

  await ctx2.close();
  await browser.close();

  console.log('\n[stats-idb e2e] passed=' + passed + ' failed=' + failed);
  stopServer();
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error(e);
  stopServer();
  process.exit(1);
});
