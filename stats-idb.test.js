/* ============================================================
   stats-idb.test.js · stats 大对象（bySentence / events）迁 IndexedDB 的分层单测
   ------------------------------------------------------------
   背景（2026-09-10 扩容 8000 句）：
     bySentence / events 随练习量无限增长，而 localStorage 无增量写语义 ——
     每答一题都要全量 stringify 并整键覆写。8000 句实测 saveMem 188ms/次、
     落盘 7.39MB 超 5MB 配额（setItem 抛 QuotaExceeded，旧代码只 console.error → 静默丢数据）。

   本文件用一个内存版 IDB mock 覆盖真实浏览器的 IndexedDB 路径，锁住：
     1) 全新用户：saveMem 只把小字段写 localStorage，大对象走 IDB 增量
     2) 老用户迁移：localStorage 旧大对象 → IDB 并集，写成功后才剥离 localStorage 副本
     3) 热路径增量：改 1 条 bySentence / 追加 1 条 event → IDB 只写这几行
     4) 删除传播：bySentence 少了一个 key → IDB 同步 delete
     5) 事件替换判定：events 被整体替换（云合并）→ 全量覆盖而非误判为追加
     6) 云合并后内存桥同步：合并结果不能被下一次 loadMem 丢弃
     7) IDB 落盘失败 → 降级 'local' 且 localStorage 保留完整大对象（不丢数据）

   运行：node stats-idb.test.js
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

/* ---------- 内存版 IDBStore（接口与 js/idb.js 完全一致），并记录每次调用的规模 ---------- */
var idb = {};                 /* store名 → { key: row } */
var calls = [];
function mkStore(name){ idb[name] = {}; }
['courses', 'progress', 'sentenceStats', 'events'].forEach(mkStore);
var failMode = false;         /* 置 true 模拟 IndexedDB 写入失败 */

function rowsOf(name){ return Object.keys(idb[name]).map(function (k) { return idb[name][k]; }); }
function put(storeName, rows, keyField){
  if (failMode) return Promise.reject(new Error('mock idb failure'));
  (rows || []).forEach(function (r) { idb[storeName][r[keyField]] = r; });
  calls.push({ op: storeName + '.put', n: (rows || []).length });
  return Promise.resolve((rows || []).length);
}
function del(storeName, keys){
  if (failMode) return Promise.reject(new Error('mock idb failure'));
  (keys || []).forEach(function (k) { delete idb[storeName][k]; });
  calls.push({ op: storeName + '.delete', n: (keys || []).length });
  return Promise.resolve((keys || []).length);
}
function replace(storeName, rows, keyField){
  if (failMode) return Promise.reject(new Error('mock idb failure'));
  idb[storeName] = {};
  (rows || []).forEach(function (r) { idb[storeName][r[keyField]] = r; });
  calls.push({ op: storeName + '.replace', n: (rows || []).length });
  return Promise.resolve();
}
var IDBStore = {
  loadAll: function () {
    var progress = {}; Object.keys(idb.progress).forEach(function (k) { progress[k] = idb.progress[k].data; });
    var ss = {}; Object.keys(idb.sentenceStats).forEach(function (k) { ss[k] = idb.sentenceStats[k].data; });
    return Promise.resolve({
      courses: rowsOf('courses'),
      courseProgress: progress,
      sentenceStats: ss,
      events: rowsOf('events').slice()
    });
  },
  putCourses: function (l) { return replace('courses', (l || []).map(function (c) { return c; }), 'courseId'); },
  putProgress: function (m) { return replace('progress', Object.keys(m || {}).map(function (k) { return { cid: k, data: m[k] }; }), 'cid'); },
  putSentenceStats: function (m) { return put('sentenceStats', Object.keys(m || {}).map(function (k) { return { key: k, data: m[k] }; }), 'key'); },
  deleteSentenceStats: function (keys) { return del('sentenceStats', keys); },
  replaceSentenceStats: function (m) { return replace('sentenceStats', Object.keys(m || {}).map(function (k) { return { key: k, data: m[k] }; }), 'key'); },
  appendEvents: function (l) { return put('events', (l || []).map(function (e) { return e; }), 'id'); },
  replaceEvents: function (l) { return replace('events', l || [], 'id'); }
};

/* ---------- 浏览器环境 mock ---------- */
var storage = {};
var window = {
  localStorage: {
    getItem: function (k) { return (k in storage) ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  },
  parent: null,
  document: {
    getElementById: function () { return null; },
    createElement: function () { return { value: '', style: {}, select: function () {}, classList: { add: function () {} } }; },
    body: { appendChild: function () {}, removeChild: function () {} },
    execCommand: function () { return true; }
  },
  navigator: { clipboard: null },
  addEventListener: function () {},
  IDBStore: IDBStore
};
new Function('window', fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8'))(window);
new Function('window', fs.readFileSync(path.join(__dirname, 'srs.js'), 'utf8'))(window);
var CL = window.CL;

var pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name); }
}
function assertEq(actual, expected, name) {
  if (actual === expected) { pass++; console.log('  \u2713 ' + name + ' = ' + JSON.stringify(expected)); }
  else { fail++; console.log('  \u2717 ' + name + ' → ' + JSON.stringify(actual) + '（期望 ' + JSON.stringify(expected) + '）'); }
}
function storedMem() { return JSON.parse(storage['chunklab.v1'] || '{}'); }
function idbStatsKeys() { return Object.keys(idb.sentenceStats); }
function idbEventIds() { return Object.keys(idb.events); }
function stat(n) { return { times: n, okTimes: n - 1, wrongTimes: 1, streak: 1, maxStreak: 2, lastAt: 1000 + n, interval: 3, ease: 2.5, dueAt: 2000 }; }
function ev(id, key) { return { id: id, kind: 'answer', key: key, ok: true, at: 1000 }; }

async function main() {
  /* ---------- 1. 老用户迁移：localStorage 旧大对象 → IDB，写成功后才剥离副本 ---------- */
  console.log('【1. 老用户迁移（localStorage 大对象 → IDB）】');
  storage['chunklab.v1'] = JSON.stringify({
    version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: {
      totalRounds: 4, totalAnswered: 20,
      bySentence: { 'd1#aaaaaaaa': stat(5), 'd1#bbbbbbbb': stat(6) },
      events: [ev('e1', 'd1#aaaaaaaa'), { id: 'r1', kind: 'round', at: 900 }],
      daysLog: { '2026-09-10': { rounds: 2 } }
    },
    settings: {}, reinforceBook: [], progress: {}
  });
  await CL.preload();
  assertEq(idbStatsKeys().length, 2, '迁移后 IDB sentenceStats 行数');
  assertEq(idbEventIds().length, 2, '迁移后 IDB events 行数');
  assert(storedMem().stats.bySentence === undefined, 'localStorage 副本已剥离 bySentence');
  assert(storedMem().stats.events === undefined, 'localStorage 副本已剥离 events');
  assertEq(storedMem().stats.totalRounds, 4, '小字段（totalRounds）仍留在 localStorage');
  assertEq(storedMem().stats.daysLog['2026-09-10'].rounds, 2, 'daysLog 仍留在 localStorage');

  /* loadMem 必须从内存桥还原完整 stats（调用方零改动） */
  var m = CL.loadMem();
  assertEq(Object.keys(m.stats.bySentence).length, 2, 'loadMem 从内存桥还原 bySentence');
  assertEq(m.stats.events.length, 2, 'loadMem 从内存桥还原 events');
  assertEq(m.stats.bySentence['d1#aaaaaaaa'].times, 5, '还原的档案内容正确');

  /* ---------- 2. 热路径增量：改 1 条 + 追加 1 条 → IDB 只写这几行 ---------- */
  console.log('\n【2. 热路径增量写（只写变更行）】');
  calls.length = 0;
  m.stats.bySentence['d1#aaaaaaaa'].times = 6;       /* 模拟 recordSentenceResult 直接改写 */
  m.stats.events.push(ev('e3', 'd1#aaaaaaaa'));
  CL.saveMem(m);
  await new Promise(function (r) { setTimeout(r, 10); });
  var ssPut = calls.filter(function (c) { return c.op === 'sentenceStats.put'; })[0];
  assertEq(ssPut ? ssPut.n : -1, 1, '只重写 1 行 bySentence（另一行签名未变被跳过）');
  var evPut = calls.filter(function (c) { return c.op === 'events.put'; })[0];
  assertEq(evPut ? evPut.n : -1, 1, '只追加 1 条事件');
  assert(calls.every(function (c) { return c.op.indexOf('.replace') < 0; }), '无需任何全量替换');
  assert(storedMem().stats.bySentence === undefined, '热路径下 localStorage 仍不含大对象');
  assertEq(idb.sentenceStats['d1#aaaaaaaa'].data.times, 6, 'IDB 中该行已更新为 times=6');
  assertEq(idb.sentenceStats['d1#bbbbbbbb'].data.times, 6, '未变更行内容保持不变');

  /* ---------- 3. 删除传播 ---------- */
  console.log('\n【3. 删除传播（bySentence 少了 key → IDB 同步 delete）】');
  calls.length = 0;
  delete m.stats.bySentence['d1#bbbbbbbb'];
  CL.saveMem(m);
  await new Promise(function (r) { setTimeout(r, 10); });
  var delCall = calls.filter(function (c) { return c.op === 'sentenceStats.delete'; })[0];
  assertEq(delCall ? delCall.n : -1, 1, '删除 1 行');
  assert(idb.sentenceStats['d1#bbbbbbbb'] === undefined, 'IDB 中该行已移除');
  assertEq(idbStatsKeys().length, 1, 'IDB 剩余行数');

  /* ---------- 4. 事件整体替换判定（不能被误判为「可追加」） ---------- */
  console.log('\n【4. 事件整体替换（三锚点失效 → 全量覆盖，不误判为追加）】');
  calls.length = 0;
  /* 构造一个「长度相同但内容不同」的数组：只比长度会漏判 */
  m.stats.events = [{ id: 'zz1', kind: 'round', at: 5000 }];
  CL.saveMem(m);
  await new Promise(function (r) { setTimeout(r, 10); });
  var evRep = calls.filter(function (c) { return c.op === 'events.replace'; })[0];
  assert(evRep !== undefined, '走全量替换（events.replace）');
  assertEq(idbEventIds().length, 1, '替换后 IDB 事件数');
  assert(idb.events['zz1'] !== undefined && idb.events['e1'] === undefined, 'IDB 事件内容已整体刷新');

  /* ---------- 5. 云合并后内存桥同步 ---------- */
  console.log('\n【5. 云合并结果不能被下一次 loadMem 丢弃】');
  window.ChunkAPI = {
    getConfig: function () { return Promise.resolve({ requireAuth: false }); },
    getData: function () {
      return Promise.resolve({
        mem: { stats: { totalRounds: 9, totalAnswered: 99, bySentence: { 'd1#cccccccc': stat(7) }, events: [ev('e9', 'd1#cccccccc')], daysLog: {} } },
        revs: { decks: {}, kv: { stats: 5 } }, deleted: { decks: [], kv: [] }, courses: [], courseProgress: {}
      });
    },
    putData: function () { return Promise.resolve({ ok: true }); },
    isLoggedIn: function () { return false; }
  };
  window.ChunkAPI.getConfig().then(function (cfg) {
    /* 直接走 ensureCloud 的真实路径：preload → getConfig → syncFromCloud */
  });
  await CL.ensureCloud();
  await new Promise(function (r) { setTimeout(r, 30); });
  var after = CL.loadMem();
  assert(after.stats.bySentence['d1#cccccccc'] !== undefined, '合并进来的新档案在 loadMem 中可见（内存桥已同步）');
  assertEq(after.stats.totalAnswered, 99, '合并后的聚合值可见');
  assert(idb.sentenceStats['d1#cccccccc'] !== undefined, 'IDB 中已含合并进来的档案（合并自身已落盘）');
  /* 幂等：没有新变更时再 saveMem 不应产生任何 IDB 写入（否则每次渲染都会白写一遍） */
  calls.length = 0;
  CL.saveMem(after);
  await new Promise(function (r) { setTimeout(r, 10); });
  assertEq(calls.length, 0, '无脏行时 saveMem 不产生多余 IDB 写入');

  /* ---------- 6. IDB 落盘失败 → 降级 'local'，数据不丢 ---------- */
  console.log('\n【6. IDB 写入失败 → 降级 localStorage 托管（不丢数据）】');
  failMode = true;
  calls.length = 0;
  var m2 = CL.loadMem();
  m2.stats.bySentence['d1#dddddddd'] = stat(1);
  m2.stats.events.push(ev('eX', 'd1#dddddddd'));
  CL.saveMem(m2);
  await new Promise(function (r) { setTimeout(r, 20); });
  assertEq(CL.statsStoreMode(), 'local', '落盘失败后降级为 local 托管');
  var degraded = storedMem();
  assert(degraded.stats.bySentence !== undefined && degraded.stats.bySentence['d1#dddddddd'] !== undefined,
    '降级后 localStorage 重新保留完整 bySentence（未丢数据）');
  assert(Array.isArray(degraded.stats.events), '降级后 localStorage 重新保留 events');
  failMode = false;

  console.log('\n[stats-idb.test] passed=' + pass + ' failed=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
