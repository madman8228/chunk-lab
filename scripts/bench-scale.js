#!/usr/bin/env node
'use strict';
/**
 * bench-scale.js · 规模压测（题库扩容前的可行性基线）
 *
 * 为什么需要：项目目标是内置题库扩到数千~8000 句，但有几处数据结构的复杂度
 * 与「句子数 × 练习事件数」相关，句数一涨就会从"能跑"变成"卡死"。
 * 本脚本用真实 core.js（mock localStorage）在 Node 里量化这些成本，
 * 供扩容前后对比，避免上线后才发现。
 *
 * 测什么：
 *   1. mergeStats 耗时 —— 每次云同步启动都会跑（O(events + keys)，见 core.js）
 *   2. mem 序列化体积 —— 决定 localStorage 是否爆配额、每次 PUT /api/data 的传输量
 *   3. 到期队列构建耗时 —— main.html 的全库遍历（O(n)，应远小于 mergeStats）
 *   4. ★ saveMem 写入延迟 —— 用户每答一题都触发；localStorage 必须整块重写，
 *      故延迟 ≈ 全量 JSON.stringify 成本，是「答题手感」的直接决定因素
 *
 * 用法：node scripts/bench-scale.js [句数] [每句答题次数]
 *       默认 627（当前线上规模）与 8000（目标规模）各跑一遍。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ---------- 内存版 IndexedDB mock（接口同 js/idb.js），让压测跑在真实生产路径上：
   stats 大对象托管给 IDB 后，saveMem 只把小字段写 localStorage。---------- */
const _idb = { sentenceStats: {}, events: {}, courses: {}, progress: {} };
const _idbCalls = [];
function _bump(op, n) { _idbCalls.push({ op: op, n: n }); }
const IDBStore = {
  loadAll: function () {
    var ss = {}; Object.keys(_idb.sentenceStats).forEach(function (k) { ss[k] = _idb.sentenceStats[k].data; });
    return Promise.resolve({ courses: [], courseProgress: {}, sentenceStats: ss, events: Object.keys(_idb.events).map(function (k) { return _idb.events[k]; }) });
  },
  putCourses: function () { return Promise.resolve(); },
  putProgress: function () { return Promise.resolve(); },
  putSentenceStats: function (m) {
    var ks = Object.keys(m || {}); ks.forEach(function (k) { _idb.sentenceStats[k] = { key: k, data: m[k] }; });
    _bump('sentenceStats.put', ks.length); return Promise.resolve(ks.length);
  },
  deleteSentenceStats: function (ks) { (ks || []).forEach(function (k) { delete _idb.sentenceStats[k]; }); _bump('sentenceStats.delete', (ks || []).length); return Promise.resolve((ks || []).length); },
  replaceSentenceStats: function (m) { _idb.sentenceStats = {}; var ks = Object.keys(m || {}); ks.forEach(function (k) { _idb.sentenceStats[k] = { key: k, data: m[k] }; }); _bump('sentenceStats.replace', ks.length); return Promise.resolve(); },
  appendEvents: function (l) { (l || []).forEach(function (e) { _idb.events[e.id] = e; }); _bump('events.put', (l || []).length); return Promise.resolve((l || []).length); },
  replaceEvents: function (l) { _idb.events = {}; (l || []).forEach(function (e) { _idb.events[e.id] = e; }); _bump('events.replace', (l || []).length); return Promise.resolve(); }
};

/* ---------- 以最小 mock 加载 core.js（与 store.test.js 同法） ---------- */
const storage = {};
const win = {
  localStorage: {
    getItem: function (k) { return (k in storage) ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  },
  IDBStore: IDBStore,
  parent: null,
  document: {
    getElementById: function () { return null; },
    createElement: function () { return { value: '', style: {}, select: function () {}, classList: { add: function () {} } }; },
    body: { appendChild: function () {}, removeChild: function () {} },
    execCommand: function () { return true; }
  },
  navigator: { clipboard: null },
  addEventListener: function () {}
};
/* 注意顺序：core.js 是 `global.CL = {...}` 直接赋值，srs.js 是 `CL = CL || {}` 追加，
   故必须先 core 后 srs，否则 srs 被 core 覆盖掉（HTML 里的加载顺序亦如此）。 */
new Function('window', fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8'))(win);
new Function('window', fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'))(win);
const CL = win.CL;

/* ---------- 造数据：贴近真实口径（2026-09-10 去冗余后） ----------
   bySentence[key] = { deckId, sentence, times, okTimes, wrongTimes,
                      streak, maxStreak, lastAt, interval, ease, dueAt, repetition }
   （deckName/translation 已去冗余：前者只在旧 key 迁移读、后者展示时由题库 item 重算）
   events[] = { id, kind:'answer', key, deckId, sentence, ok, at } */
function makeSentenceStat(deckId, i) {
  return {
    deckId: deckId,
    sentence: 'Could you do me a favor and pass me the salt please ' + i + '?',
    times: 3, okTimes: 2, wrongTimes: 1, streak: 1, maxStreak: 2,
    lastAt: 1757000000000 + i, interval: 3, ease: 2.35,
    dueAt: 1757000000000 + i + 259200000, repetition: 2
  };
}
function makeAnswerEvent(deckId, i, k) {
  return {
    id: (1757000000000 + i * 100 + k).toString(36) + '-abc' + k,
    kind: 'answer', key: deckId + '#' + i, deckId: deckId,
    sentence: 'Could you do me a favor and pass me the salt please ' + i + '?',
    ok: k !== 0, at: 1757000000000 + i * 100 + k
  };
}

function buildCase(n, perSentence) {
  /* deckId 带上 n：不同规模的用例 key 互不冲突，IDB mock 才能在同一进程里累积而不互相污染 */
  const deckId = 'builtin-scale-' + n;
  const byA = {}, byB = {}, evA = [], evB = [];
  for (let i = 0; i < n; i++) {
    const key = deckId + '#' + i;
    byA[key] = makeSentenceStat(deckId, i);
    byB[key] = makeSentenceStat(deckId, i);
    for (let k = 0; k < perSentence; k++) {
      /* 模拟两台设备各练一半，合并时走最坏路径（两侧都有事件） */
      (k % 2 === 0 ? evA : evB).push(makeAnswerEvent(deckId, i, k));
    }
  }
  const rounds = Math.ceil(n / 10);
  for (let r = 0; r < rounds; r++) evB.push({ id: 'r' + r.toString(36), kind: 'round', at: 1757000000000 + r });
  return {
    a: { totalRounds: rounds, totalAnswered: n * perSentence, bySentence: byA, events: evA, daysLog: { '2026-09-10': { rounds: rounds } } },
    b: { totalRounds: rounds, totalAnswered: n * perSentence, bySentence: byB, events: evB, daysLog: { '2026-09-10': { rounds: rounds } } }
  };
}

function mb(bytes) { return (bytes / 1024 / 1024).toFixed(2) + ' MB'; }
function kb(bytes) { return (bytes / 1024).toFixed(1) + ' KB'; }

function runCase(n, perSentence) {
  const c = buildCase(n, perSentence);
  const evTotal = c.a.events.length + c.b.events.length;

  /* 1. mergeStats（每次启动云同步都跑；O(events + keys)） */
  const t0 = Date.now();
  const merged = CL.mergeStats(c.a, c.b);
  const tMerge = Date.now() - t0;

  /* 2. 体积 */
  const memSize = Buffer.byteLength(JSON.stringify({ decks: [], best: {}, mastered: {}, deletedItems: {}, stats: merged, settings: {} }), 'utf8');
  const statsSize = Buffer.byteLength(JSON.stringify(merged), 'utf8');
  const evSize = Buffer.byteLength(JSON.stringify(merged.events), 'utf8');

  /* 3. 全库遍历（main.html 到期队列同构逻辑：O(n)） */
  const t1 = Date.now();
  let due = 0;
  const by = merged.bySentence;
  const now = 1757000000000 + 86400000 * 400;   /* 时间推到足够远，让大部分到期 */
  Object.keys(by).forEach(function (k) { if (CL.srs.isDue(by[k], now)) due++; });
  const tScan = Date.now() - t1;

  /* 4. ★ 写入延迟：用户每答一题都跑一次 saveMem。
     分两次测：
       cold  —— 首次落盘（含全量建档），只在首次启动/迁移出现
       hot   —— 改 1 条档案 + 追加 1 条事件（真实答题形态）；这是决定答题手感的值 */
  const memObj = {
    decks: [], best: {}, mastered: {}, deletedItems: {}, stats: merged, settings: {},
    reinforceBook: [], progress: {}
  };
  CL.saveMem(memObj);                                    /* 建立签名基线 */
  const coldRuns = [];
  for (let r = 0; r < 3; r++) {
    const t = Date.now();
    CL.saveMem(memObj);
    coldRuns.push(Date.now() - t);
  }
  coldRuns.sort(function (a, b) { return a - b; });
  const tCold = coldRuns[1];

  const firstKey = Object.keys(by)[0];
  return measureHot(memObj, by, merged, firstKey).then(function (hot) {
    const tWrite = hot.tWrite;
    const storedBytes = Buffer.byteLength(storage['chunklab.v1'] || '', 'utf8');

    console.log('');
    console.log('  ── ' + n + ' 句 × 每句 ' + perSentence + ' 次答题（events ' + evTotal + ' 条）──');
    console.log('    mergeStats        : ' + tMerge + ' ms' + (tMerge > 1000 ? '  ⚠️ 超过 1 秒，会明显卡顿' : tMerge > 200 ? '  ⚠ 偏慢' : '  ✓'));
    console.log('    合并后 bySentence : ' + Object.keys(merged.bySentence).length + ' 条');
    console.log('    合并后 events     : ' + merged.events.length + ' 条');
    console.log('    逻辑数据总量      : ' + mb(memSize) + '（其中 events ' + kb(evSize) + ' / 占比 ' + Math.round(evSize / memSize * 100) + '%）');
    console.log('    写入延迟 首次     : ' + tCold + ' ms' + (tCold > 100 ? '  ⚠（仅首启/迁移）' : '  ✓'));
    console.log('    ★ 写入延迟 答题  : ' + tWrite + ' ms' + (tWrite > 100 ? '  ⚠️ 每答一题都会卡' : tWrite > 30 ? '  ⚠ 可感知' : '  ✓') +
      '（每次答题 IDB 实际写 ' + hot.idbRows + ' 行）');
    console.log('    localStorage 落盘 : ' + kb(storedBytes) + (storedBytes > 5 * 1024 * 1024 ? '  ⚠️ 超常见 5MB 配额' : '  ✓ 在配额内') +
      '（大对象已托管 IDB，仅剩小字段）');
    console.log('    到期扫描（O(n)）  : ' + tScan + ' ms，命中 ' + due + ' 句');
    return { n: n, tMerge: tMerge, memSize: memSize, evSize: evSize, evTotal: evTotal, tWrite: tWrite, tCold: tCold, storedBytes: storedBytes, idbRows: hot.idbRows };
  });
}

/* 热路径写入测量：saveMem 是同步入口（localStorage 那一段），
   但它内部触发的 IDB 落盘是异步微任务 —— 必须等微任务跑完再统计写入行数，
   否则会把上一轮的行数算到下一轮（曾据此误读为「每次全量重写 24804 行」）。 */
async function measureHot(memObj, by, merged, firstKey) {
  const runs = [], rows = [];
  for (let r = 0; r < 5; r++) {
    by[firstKey].times += 1;                     /* 模拟 recordSentenceResult 就地改写 */
    merged.events.push({ id: 'hot' + r + '-x' + firstKey, kind: 'answer', key: firstKey, ok: true, at: Date.now() });
    _idbCalls.length = 0;
    const t = Date.now();
    CL.saveMem(memObj);
    runs.push(Date.now() - t);
    await new Promise(function (res) { setImmediate(res); });   /* 放行 persistStats 的微任务 */
    rows.push(_idbCalls.reduce(function (s, x) { return s + x.n; }, 0));
  }
  runs.sort(function (a, b) { return a - b; });
  return { tWrite: runs[2], idbRows: rows[rows.length - 1] };
}

console.log('【Chunk Lab 规模压测】以真实 core.js 的 mergeStats / 存储分层为准');
console.log('（mergeStats 每次启动云同步都跑；saveMem 每答一题都跑 —— 两者是扩容的首要瓶颈候选）');

const args = process.argv.slice(2).map(Number).filter(function (x) { return x > 0; });
const cases = args.length >= 2 ? [[args[0], args[1]]] : [[627, 3], [2000, 3], [8000, 3]];

/* 走真实启动路径：preload 把 stats 大对象托管给 IDB（生产行为），
   之后的 saveMem 才是用户真实感受到的那次写入 */
CL.preload().then(function () {
  /* 串行跑（runCase 现在是 async，含真实 IDB 微任务等待），保证每档数据都被完整测量 */
  return cases.reduce(function (p, c) {
    return p.then(function (acc) { return runCase(c[0], c[1]).then(function (r) { acc.push(r); return acc; }); });
  }, Promise.resolve([]));
}).then(function (results) {
  console.log('');
  console.log('【结论口径】');
  const base = results[0], last = results[results.length - 1];
  console.log('  stats 托管模式：' + CL.statsStoreMode() + '（idb = 大对象不进 localStorage 同步写路径）');
  console.log('  句数 ' + base.n + ' → ' + last.n + '（×' + (last.n / base.n).toFixed(1) + '）：' +
    'mergeStats ' + base.tMerge + 'ms → ' + last.tMerge + 'ms（×' + (last.tMerge / Math.max(1, base.tMerge)).toFixed(1) + '）' +
    '，答题写入 ' + base.tWrite + 'ms → ' + last.tWrite + 'ms（×' + (last.tWrite / Math.max(1, base.tWrite)).toFixed(1) + '）');
  console.log('  localStorage 常见配额 5 MB，且无增量写语义（setItem 必须整键覆写）。');
  console.log('  答题写入 > 100ms 即肉眼可感卡顿；落盘超配额时 setItem 抛 QuotaExceeded → 必须保证热路径不写大对象。');
});

