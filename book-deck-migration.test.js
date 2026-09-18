/* ============================================================
   book-deck-migration.test.js · 口语 8000 合并（oral-book）的档案 key 迁移单测
   node book-deck-migration.test.js

   ★ 宪法级：含负向自证 —— 迁移必须「查表决定」，不能是「看到前缀就改写」。
     没有映射表 / cid 不在表里 时，key 必须原样保留（否则用户进度会被改写到不存在的库）。
   ★ 必须同时兼容三代 key：
       builtin-daily#cid（初版） / daily-*#cid（上一版 6 场景拆分） / oral-*#cid（当前，应保持不变）
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var builtinsSrc = fs.readFileSync(path.join(__dirname, 'builtins.js'), 'utf8');
var bookSrc = fs.readFileSync(path.join(__dirname, 'oral-book.js'), 'utf8');
var coreSrc = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');

var pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function assertEq(actual, expected, name) {
  if (actual === expected) { pass++; console.log('  ✓ ' + name + ' = ' + JSON.stringify(expected)); }
  else { fail++; console.log('  ✗ ' + name + ' → ' + JSON.stringify(actual) + '（期望 ' + JSON.stringify(expected) + '）'); }
}

/* 从真实源取迁移表与句子（不手搓映射，避免测试自证自话） */
var builtinsWindow = {};
new Function('window', builtinsSrc)(builtinsWindow);
var bookWindow = {};
new Function('window', bookSrc)(bookWindow);

var MIG = builtinsWindow.BUILTIN_MIGRATION;
var ALL_ITEMS = [];
(bookWindow.ORAL_BOOK.decks || []).forEach(function (d) {
  (d.items || []).forEach(function (it) { ALL_ITEMS.push({ deckId: d.id, it: it }); });
});
function sentenceOfCid(cid) {
  for (var i = 0; i < ALL_ITEMS.length; i++) if (ALL_ITEMS[i].it.cid === cid) return ALL_ITEMS[i].it.sentence;
  return null;
}

function makeEnv(withMigration) {
  var storage = {};
  var win = {
    localStorage: {
      getItem: function (k) { return (k in storage) ? storage[k] : null; },
      setItem: function (k, v) { storage[k] = String(v); }
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
  if (withMigration) win.BUILTIN_MIGRATION = MIG;
  new Function('window', coreSrc)(win);
  return { win: win, storage: storage, CL: win.CL };
}

/* 全集自检：buitins 迁移表必须覆盖口语库里全部「原属老 deck」的句子 */
console.log('【迁移表（来自 builtins.js）】');
assert(!!MIG && typeof MIG === 'object', 'window.BUILTIN_MIGRATION 存在');
var migIds = Object.keys(MIG || {});
var migTotal = 0;
migIds.forEach(function (id) { migTotal += (MIG[id] || []).length; });
assertEq(migTotal, 496, '迁移表 cid 总数 == 现有库 496 句');
assert(migIds.every(function (id) { return /^oral-/.test(id); }), '迁移表键全部是新 oral-* deck id（' + migIds.length + ' 个）');

/* 迁入的 cid 必须真的落在这个 deck 里（防止「表与内容脱节」） */
(function () {
  var bad = [];
  migIds.forEach(function (id) {
    var deck = (bookWindow.ORAL_BOOK.decks || []).filter(function (d) { return d.id === id; })[0];
    if (!deck) { bad.push(id + '（库里没有这个 deck）'); return; }
    var cids = {};
    (deck.items || []).forEach(function (it) { cids[it.cid] = 1; });
    (MIG[id] || []).forEach(function (c) { if (!cids[c]) bad.push(id + '#' + c); });
  });
  assertEq(bad.length, 0, '迁移表每个 cid 都能在目标 deck 里找到' + (bad.length ? '（例：' + bad.slice(0, 3).join(', ') + '）' : ''));
})();

/* 取两个真实 cid：分属不同新 deck（跨 deck 验证不是「统一前缀」） */
var deckA = migIds[0];
var deckB = migIds.filter(function (id) { return id !== deckA && (MIG[id] || []).length; })[0];
var cidA = MIG[deckA][0];
var cidB = MIG[deckB][0];
var sentA = sentenceOfCid(cidA);
assert(!!sentA, deckA + ' 首个 cid 能反查到句子');

console.log('\n【正向 1：初版 builtin-daily#cid → 新 deck】');
(function () {
  var env = makeEnv(true);
  var KA = 'builtin-daily#' + cidA;
  var KB = 'builtin-daily#' + cidB;
  var seed = { version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 1, totalAnswered: 3, bySentence: {}, events: [] }, settings: {}, reinforceBook: [] };
  seed.mastered[KA] = { t: 1 };
  seed.mastered[KB] = { t: 2 };
  seed.deletedItems[KA] = true;
  seed.stats.bySentence[KA] = { times: 3, okTimes: 2, wrongTimes: 1, streak: 1 };
  seed.stats.events = [{ id: 'ev-1', kind: 'answer', key: KA, ok: true, at: 1000 }];
  seed.reinforceBook = [{ _key: 'builtin-daily::' + sentA, deckId: 'builtin-daily', sentence: sentA }];
  env.storage['chunklab.v1'] = JSON.stringify(seed);

  var m = env.CL.loadMem();
  assert(!!m.mastered[deckA + '#' + cidA], 'mastered → ' + deckA + '#cid');
  assert(!m.mastered[KA], 'mastered 老 key 已移除');
  assert(!!m.mastered[deckB + '#' + cidB], 'mastered → ' + deckB + '#cid（跨 deck 正确分流）');
  assert(!!m.deletedItems[deckA + '#' + cidA], 'deletedItems → 新 key');
  assert(!m.deletedItems[KA], 'deletedItems 老 key 已移除');
  assertEq(m.stats.bySentence[deckA + '#' + cidA].times, 3, 'bySentence 内容保留');
  assertEq(m.stats.events[0].key, deckA + '#' + cidA, 'stats.events[].key 已改写');
  assertEq(m.reinforceBook[0].deckId, deckA, '错题本 deckId 已改写');
  assertEq(m.reinforceBook[0]._key, deckA + '::' + sentA, '错题本 _key 已改写');

  console.log('\n【幂等：二次 loadMem 不再变化】');
  var m2 = env.CL.loadMem();
  assert(!!m2.mastered[deckA + '#' + cidA], '二次读仍是新 key');
  assertEq(Object.keys(m2.mastered).length, 2, 'mastered 键数不增长');
  assertEq(m2.reinforceBook[0]._key, deckA + '::' + sentA, '错题本 _key 仍正确');
})();

console.log('\n【正向 2：上一版 daily-*#cid → 新 deck（6 场景拆分版用户）】');
(function () {
  var env = makeEnv(true);
  var K1 = 'daily-home#' + cidA;
  var K2 = 'daily-work#' + cidB;
  var seed = { version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, settings: {}, reinforceBook: [] };
  seed.mastered[K1] = { t: 1 };
  seed.mastered[K2] = { t: 1 };
  seed.stats.bySentence[K2] = { times: 2, okTimes: 1, wrongTimes: 1, streak: 0 };
  seed.reinforceBook = [{ _key: 'daily-work::' + sentA, deckId: 'daily-work', sentence: sentA }];
  env.storage['chunklab.v1'] = JSON.stringify(seed);

  var m = env.CL.loadMem();
  assert(!!m.mastered[deckA + '#' + cidA], 'daily-home#cid → ' + deckA + '#cid');
  assert(!!m.mastered[deckB + '#' + cidB], 'daily-work#cid → ' + deckB + '#cid');
  assert(!m.mastered[K1] && !m.mastered[K2], '老 daily-* key 已移除');
  assertEq(m.reinforceBook[0].deckId, deckA, '错题本（daily-work::句子）已改写到正确 deck');
})();

console.log('\n【反向自证 A：无映射表 → key 必须原样保留】');
(function () {
  var env = makeEnv(false);
  var K = 'builtin-daily#' + cidA;
  var K2 = 'daily-home#' + cidA;
  var seed = { version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, settings: {}, reinforceBook: [] };
  seed.mastered[K] = { t: 1 };
  seed.mastered[K2] = { t: 1 };
  seed.reinforceBook = [{ _key: 'builtin-daily::' + sentA, deckId: 'builtin-daily', sentence: sentA }];
  env.storage['chunklab.v1'] = JSON.stringify(seed);
  var m = env.CL.loadMem();
  assert(!!m.mastered[K] && !!m.mastered[K2], '【守卫】无迁移表时老 key 全部保持不变');
  assert(!m.mastered[deckA + '#' + cidA], '【守卫】不会凭空改写到新 deck');
  assertEq(m.reinforceBook[0].deckId, 'builtin-daily', '【守卫】无表时错题本 deckId 不变');
})();

console.log('\n【反向自证 B：cid 不在表里 → 保持不变（不是「见前缀就改」）】');
(function () {
  var env = makeEnv(true);
  var UNKNOWN = 'builtin-daily#deadbeef';
  var UNKNOWN2 = 'daily-home#deadbeef';
  var seed = { version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, settings: {}, reinforceBook: [] };
  seed.mastered[UNKNOWN] = { t: 1 };
  seed.mastered[UNKNOWN2] = { t: 1 };
  env.storage['chunklab.v1'] = JSON.stringify(seed);
  var m = env.CL.loadMem();
  assert(!!m.mastered[UNKNOWN] && !!m.mastered[UNKNOWN2], '【守卫】未知 cid 的老 key 保持不变（不丢数据）');
})();

console.log('\n【反向自证 C：未拆分的自定义 deck → 不得被误改】');
(function () {
  var env = makeEnv(true);
  var MINE = 'my-own-deck#abcd1234';
  var seed = { version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, settings: {}, reinforceBook: [] };
  seed.mastered[MINE] = { t: 1 };
  seed.reinforceBook = [{ _key: 'my-own-deck::Hello.', deckId: 'my-own-deck', sentence: 'Hello.' }];
  env.storage['chunklab.v1'] = JSON.stringify(seed);
  var m = env.CL.loadMem();
  assert(!!m.mastered[MINE], '【守卫】用户自建 deck 的 key 不受影响');
  assertEq(m.reinforceBook[0].deckId, 'my-own-deck', '【守卫】用户自建 deck 的错题本不受影响');
})();

console.log('\n【兼容：云端混合快照必须归一化旧口语 key 与 deckId】');
(function () {
  var env = makeEnv(true);
  var canonical = deckA + '#' + cidA;
  var legacy = 'builtin-oral-8000#' + cidA;
  var seed = { version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 2, bySentence: {}, events: [] }, settings: {}, reinforceBook: [] };
  /* 这是线上曾出现过的混合形态：行 key 已迁到新 deck，但行内 deckId 仍是旧值，
     事件 key 还保留 builtin-oral-8000。loadMem 必须把三者收敛到同一个现行 deck。 */
  seed.stats.bySentence[canonical] = { deckId: 'builtin-daily', times: 0, okTimes: 0, wrongTimes: 0 };
  seed.stats.events = [
    { id: 'legacy-oral-1', kind: 'answer', key: legacy, ok: true, at: 1000 },
    { id: 'legacy-oral-2', kind: 'answer', key: legacy, ok: false, at: 2000 }
  ];
  env.storage['chunklab.v1'] = JSON.stringify(seed);

  var m = env.CL.loadMem();
  assertEq(m.stats.events[0].key, canonical, 'builtin-oral-8000 事件迁移到现行 deck');
  assertEq(m.stats.bySentence[canonical].deckId, deckA, '混合行 deckId 归一化到现行 deck');
  var normalized = env.CL.normalizeSyncedStats(seed.stats);
  assertEq(normalized.stats.bySentence[canonical].times, 2, '云端混合行按事件恢复答题次数');
  assert(!!normalized.repairedEventIds['legacy-oral-1'] && !!normalized.repairedEventIds['legacy-oral-2'], '旧事件标记为需要回写');
})();

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);
