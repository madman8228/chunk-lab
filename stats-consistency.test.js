/* stats-consistency.test.js · 累计答题与日期活动的统计口径回归测试
   运行：node stats-consistency.test.js */
'use strict';
var fs = require('fs');

var window = {
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  parent: null,
  document: {
    getElementById: function () { return null; },
    createElement: function () { return { value: '', style: {}, select: function () {} }; },
    body: { appendChild: function () {}, removeChild: function () {} },
    execCommand: function () { return true; }
  },
  navigator: { clipboard: null },
  addEventListener: function () {},
  __CL_DISABLE_CROSSTAB__: true
};
new Function('window', fs.readFileSync('core.js', 'utf8'))(window);
var CL = window.CL;
var pass = 0, fail = 0;

function check(value, name) {
  if (value) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function eq(actual, expected, name) {
  check(actual === expected, name + ' = ' + JSON.stringify(actual) + '（期望 ' + JSON.stringify(expected) + '）');
}

/* 模拟当前用户：146 次累计答题，其中 138 次有日期，8 次来自旧版本只留下聚合值。 */
var by = {};
for (var i = 0; i < 146; i++) {
  by['daily#' + i] = { times: 1, okTimes: 1, wrongTimes: 0 };
}
var events = [];
for (i = 0; i < 138; i++) {
  events.push({ id: 'answer-' + i, kind: 'answer', key: 'daily#' + i,
    ok: true, at: Date.UTC(2026, 8, 8) + i });
}
var mem = { stats: { totalAnswered: 146, bySentence: by, events: events, daysLog: {} } };
var audit = CL.answerStatsAudit(mem);
var activity = CL.dailyActivity(mem);
var dated = Object.keys(activity).reduce(function (sum, key) { return sum + activity[key].answered; }, 0);

console.log('【累计、档案、日期事件三种口径】');
eq(audit.totalAnswered, 146, '累计答题保持真实总数');
eq(audit.sentenceAnswered, 146, '句子档案答题次数');
eq(audit.eventAnswered, 138, '事件答题次数');
eq(audit.datedAnswered, 138, '有日期答题次数');
eq(audit.undatedAnswered, 8, '未记录日期答题次数');
eq(dated, 138, '日历活动答题次数');

console.log('【同步合并不放大偏差】');
var merged = CL.mergeStats(mem.stats, mem.stats);
eq(merged.totalAnswered, 146, '同一份统计重复合并后累计答题');
eq(merged.events.length, 138, '同一份统计重复合并后事件数');
eq(Object.keys(merged.bySentence).reduce(function (sum, key) {
  return sum + (merged.bySentence[key].times || 0);
}, 0), 146, '同一份统计重复合并后句子次数');

console.log('\n[stats-consistency] passed=' + pass + ' failed=' + fail);
process.exit(fail ? 1 : 0);
