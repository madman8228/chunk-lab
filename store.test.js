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
assert(m.stats.bySentence['d1#Hello'], 'stats.bySentence 保留');
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

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
