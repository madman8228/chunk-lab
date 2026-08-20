/* ============================================================
   srs.test.js · SRS 调度单测（node srs.test.js 运行）
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

/* 在 Node 沙箱中加载 srs.js（模拟 window） */
var window = {};
var src = fs.readFileSync(path.join(__dirname, 'srs.js'), 'utf8');
new Function('window', src)(window);
var srs = window.CL.srs;

var pass = 0, fail = 0;
function assert(cond, name){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function assertEq(actual, expected, name){
  if(actual === expected){ pass++; console.log('  ✓ ' + name + ' = ' + expected); }
  else { fail++; console.log('  ✗ ' + name + ' → ' + actual + '（期望 ' + expected + '）'); }
}

var NOW = 1700000000000;
console.log('【SRS 间隔序列：连对 9 次】');
var card = srs.normalize({});
var expectedSeq = [1, 3, 7, 14, 30, 60, 120, 180, 365];
for(var i = 0; i < 9; i++){
  card = srs.recordResult(card, true, NOW);
  assertEq(card.interval, expectedSeq[i], '第 ' + (i+1) + ' 次答对间隔');
}
assertEq(card.ease, 2.5, 'ease 封顶 2.5');

console.log('【答错重置】');
var bad = srs.recordResult(card, false, NOW);
assertEq(bad.repetition, 0, '答错 repetition 归零');
assertEq(bad.interval, 1, '答错 interval 回到 1');
assertEq(bad.ease, 2.3, '答错 ease 降 0.2（2.5→2.3）');
assertEq(bad.dueAt, NOW + 86400000, '答错 dueAt = 1 天后');

console.log('【ease 下限保护】');
var lowEase = { interval:5, ease:1.3, repetition:3, dueAt:0 };
var low = srs.recordResult(lowEase, false, NOW);
assertEq(low.ease, 1.3, 'ease 下限 1.3（不再降）');

console.log('【旧数据兼容】');
var legacy = srs.normalize({ times:2 }); /* 缺 interval/ease/repetition */
assertEq(legacy.interval, 1, '缺失 interval → 默认 1');
assertEq(legacy.ease, 2.5, '缺失 ease → 默认 2.5');
assertEq(legacy.repetition, 0, '缺失 repetition → 默认 0');

console.log('【到期判定】');
assert(!srs.isDue({}, NOW), '空卡 not due');
assert(!srs.isDue({ dueAt: 0 }, NOW), 'dueAt=0 not due');
assert(srs.isDue({ dueAt: NOW - 1000 }, NOW), '已逾期 → due');
assert(!srs.isDue({ dueAt: NOW + 86400000 }, NOW), '明天到期 → not due');
assertEq(srs.dueRank({ dueAt: NOW - 1 }, NOW), 0, '到期排 0（优先）');
assertEq(srs.dueRank({ dueAt: NOW + 1 }, NOW), 1, '未到期排 1');

console.log('【dueLabel 展示】');
assertEq(srs.dueLabel({ dueAt: NOW + 3*86400000 }, NOW), '还有 3 天', '3 天后');
assertEq(srs.dueLabel({ dueAt: NOW - 2*86400000 }, NOW), '已逾期 2 天', '逾期 2 天');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
