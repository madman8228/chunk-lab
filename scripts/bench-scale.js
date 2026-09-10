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
 *   1. mergeStats 耗时 —— 每次云同步启动都会跑（O(keys × events)，见 core.js 523+）
 *   2. mem 序列化体积 —— 决定 localStorage 是否爆配额、每次 PUT /api/data 的传输量
 *   3. 到期队列构建耗时 —— main.html 的全库遍历（O(n)，应远小于 mergeStats）
 *
 * 用法：node scripts/bench-scale.js [句数] [每句答题次数]
 *       默认 627（当前线上规模）与 8000（目标规模）各跑一遍。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ---------- 以最小 mock 加载 core.js（与 store.test.js 同法） ---------- */
const storage = {};
const win = {
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
  addEventListener: function () {}
};
/* 注意顺序：core.js 是 `global.CL = {...}` 直接赋值，srs.js 是 `CL = CL || {}` 追加，
   故必须先 core 后 srs，否则 srs 被 core 覆盖掉（HTML 里的加载顺序亦如此）。 */
new Function('window', fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8'))(win);
new Function('window', fs.readFileSync(path.join(ROOT, 'srs.js'), 'utf8'))(win);
const CL = win.CL;

/* ---------- 造数据：贴近真实口径 ----------
   bySentence[key] = { deckId, deckName, sentence, translation, times, okTimes, wrongTimes,
                      streak, maxStreak, lastAt, interval, ease, dueAt, repetition }
   events[] = { id, kind:'answer', key, deckId, sentence, ok, at } */
function makeSentenceStat(deckId, i) {
  return {
    deckId: deckId,
    deckName: '日常口语 · Daily Talk',
    sentence: 'Could you do me a favor and pass me the salt please ' + i + '?',
    translation: '能不能帮个忙，把盐递给我好吗？',
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
  const deckId = 'builtin-daily';
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

  /* 1. mergeStats（每次启动云同步都跑；O(keys × events)） */
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

  console.log('');
  console.log('  ── ' + n + ' 句 × 每句 ' + perSentence + ' 次答题（events ' + evTotal + ' 条）──');
  console.log('    mergeStats        : ' + tMerge + ' ms' + (tMerge > 1000 ? '  ⚠️ 超过 1 秒，会明显卡顿' : tMerge > 200 ? '  ⚠ 偏慢' : '  ✓'));
  console.log('    合并后 bySentence : ' + Object.keys(merged.bySentence).length + ' 条');
  console.log('    合并后 events     : ' + merged.events.length + ' 条');
  console.log('    序列化总大小      : ' + mb(memSize) + '（其中 events ' + kb(evSize) + ' / 占比 ' + Math.round(evSize / memSize * 100) + '%）');
  console.log('    到期扫描（O(n)）  : ' + tScan + ' ms，命中 ' + due + ' 句');
  return { n: n, tMerge: tMerge, memSize: memSize, evSize: evSize, evTotal: evTotal };
}

console.log('【Chunk Lab 规模压测】以真实 core.js 的 mergeStats / 数据结构为准');
console.log('（mergeStats 在每次云同步启动时运行，是扩容的首要瓶颈候选）');

const args = process.argv.slice(2).map(Number).filter(function (x) { return x > 0; });
const cases = args.length >= 2 ? [[args[0], args[1]]] : [[627, 3], [2000, 3], [8000, 3]];
const results = cases.map(function (c) { return runCase(c[0], c[1]); });

console.log('');
console.log('【结论口径】');
const base = results[0], last = results[results.length - 1];
console.log('  句数 ' + base.n + ' → ' + last.n + '（×' + (last.n / base.n).toFixed(1) + '）：' +
  'mergeStats ' + base.tMerge + 'ms → ' + last.tMerge + 'ms（×' + (last.tMerge / Math.max(1, base.tMerge)).toFixed(1) + '）');
console.log('  localStorage 常见配额 5 MB；mem 序列化超 2 MB 即需换存储层（IndexedDB）。');
