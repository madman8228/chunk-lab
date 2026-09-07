/* ============================================================
   store.test.js · 存储版本化单测（node store.test.js 运行）
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

/* 模拟浏览器环境加载 core.js */
var storage = {};
var window = {
  localStorage: {
    getItem: function(k){ return (k in storage) ? storage[k] : null; },
    setItem: function(k, v){ storage[k] = String(v); }
  },
  parent: null,
  document: {
    getElementById: function(){ return null; },
    createElement: function(){ return { value:'', style:{}, select:function(){}, classList:{add:function(){}} }; },
    body: { appendChild: function(){}, removeChild: function(){} },
    execCommand: function(){ return true; }
  },
  navigator: { clipboard: null },
  addEventListener: function(){}
};
var coreSrc = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
new Function('window', coreSrc)(window);
var CL = window.CL;

var pass = 0, fail = 0;
function assert(cond, name){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function assertEq(actual, expected, name){
  if(actual === expected){ pass++; console.log('  ✓ ' + name + ' = ' + expected); }
  else { fail++; console.log('  ✗ ' + name + ' → ' + JSON.stringify(actual) + '（期望 ' + JSON.stringify(expected) + '）'); }
}

console.log('【统一存储键】');
assertEq(CL.STORE_KEY, 'chunklab.v1', '存储键与主页面一致 chunklab.v1');
assertEq(CL.store.CURRENT_VERSION, 2, '当前版本 = 2');

console.log('【legacy 数据（无 version）→ 迁移到当前版本】');
storage['chunklab.v1'] = JSON.stringify({
  decks: [{ id:'d1', name:'旧题库', items:[{sentence:'Hello', chunks:['Hello','world'], hints:['你','好']}] }],
  best: { d1: { acc: 80 } },
  mastered: { 'd1#Hello': {} },
  stats: { totalRounds: 3, totalAnswered: 30, bySentence: { 'd1#Hello': { times:5, okTimes:4, streak:2 } } },
  settings: { mode:'choose' }
});
var m = CL.loadMem();
assertEq(m.version, 2, '读取后 version 升到 2');
assertEq(m.decks.length, 1, 'decks 保留');
assertEq(m.settings.mode, 'choose', 'settings 保留');
assertEq(m.settings.sound, true, 'settings 缺省合并（sound 默认 true）');
assertEq(m.settings.apiKey, '', 'settings 缺省合并（apiKey 默认空）');
assert(m.stats.bySentence['d1#' + CL.fnv8('Hello')], 'stats.bySentence 保留并迁移为 cid key');
assert(!m.stats.bySentence['d1#Hello'], '旧原文 key 已移除');
assertEq(m.stats.totalRounds, 3, 'stats.totalRounds 保留');

console.log('【保存时强制版本】');
CL.saveMem(m);
var raw = JSON.parse(storage['chunklab.v1']);
assertEq(raw.version, 2, '写入后 version = 2');

console.log('【已是最新版本 → 不再迁移】');
storage['chunklab.v1'] = JSON.stringify({ version: 2, decks: [{ id:'x' }] });
var m2 = CL.loadMem();
assertEq(m2.version, 2, 'v2 数据读取后仍为 2');
assertEq(m2.decks.length, 1, 'v2 decks 保留');
var migrated = CL.store.migrate({ version: 2, decks: [] });
assertEq(migrated.version, 2, 'migrate(v2) 直接返回');

console.log('【空存储 → 默认结构】');
delete storage['chunklab.v1'];
var m3 = CL.loadMem();
assertEq(m3.decks.length, 0, '默认 decks 空数组');
assert(m3.settings, '默认 settings 存在');
assert(m3.stats.bySentence, '默认 stats.bySentence 存在');

console.log('【reinforceBook / progress 保留（主页面数据兼容）】');
storage['chunklab.v1'] = JSON.stringify({
  version: 2,
  decks: [],
  reinforceBook: [{ sentence:'Bad one' }],
  progress: { 'd1': { idx: 3 } }
});
var m4 = CL.loadMem();
assertEq(m4.reinforceBook.length, 1, 'reinforceBook 保留');
assertEq(m4.progress['d1'].idx, 3, 'progress 保留');

console.log('【句子档案 key：原文 → cid 迁移（mastered / deletedItems / events）】');
storage['chunklab.v1'] = JSON.stringify({
  version: 2,
  decks: [],
  mastered: { 'd1#How are you?': { deckId:'d1', sentence:'How are you?', markedAt:1 } },
  deletedItems: { 'builtin-daily#I am fine.': true },
  stats: {
    totalRounds:1, totalAnswered:1,
    bySentence: { 'd1#How are you?': { times:2, sentence:'How are you?' } },
    events: [ { id:'e1', kind:'answer', key:'d1#How are you?', ok:true, at:1 } ]
  }
});
var m5 = CL.loadMem();
var newKey = 'd1#' + CL.fnv8('How are you?');
assert(m5.mastered[newKey], 'mastered 迁移到 cid key');
assert(!m5.mastered['d1#How are you?'], 'mastered 旧 key 移除');
assert(m5.deletedItems['builtin-daily#' + CL.fnv8('I am fine.')], 'deletedItems 迁移到 cid key');
assert(m5.stats.bySentence[newKey], 'bySentence 迁移到 cid key');
assertEq(m5.stats.events[0].key, newKey, 'events.key 同步迁移（与 bySentence 对齐）');
assertEq(m5.stats.events[0].id, 'e1', 'events 记录本身保留');
assertEq(m5.stats.totalAnswered, 1, '聚合计数保留');
/* 幂等：已迁移数据二次 loadMem 不再变更 */
var rawAfter = JSON.parse(storage['chunklab.v1']);
assert(!rawAfter.stats.bySentence['d1#How are you?'], '迁移结果已回写存储');
assert(rawAfter.stats.bySentence[newKey], '回写后 key 为新格式');
var m6 = CL.loadMem();
assertEq(Object.keys(m6.stats.bySentence).length, 1, '二次加载幂等（不重复产生 key）');
assert(m6.stats.bySentence[newKey], '二次加载数据仍正确');
/* cid 优先：显式 cid 字段的句子（内容修订保留 cid）key 不与文本 hash 绑定 */
var kExplicit = CL.cidKey('d1', { cid:'aaaa1111', sentence:'修订后的新文本' });
assertEq(kExplicit, 'd1#aaaa1111', '显式 cid 优先于文本 hash');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
