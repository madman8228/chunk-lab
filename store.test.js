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

console.log('\n【示例统计 demoStatsSample（2026-09-09 主动装入方案）】');
var demoDecks = [
  { id:'builtin-daily', name:'日常对话', builtin:true, items:[
    { sentence:'How are you?', translation:'你好吗？' },
    { sentence:'I am fine, thank you.', translation:'我很好，谢谢。' },
    { sentence:'Nice to meet you.', translation:'很高兴认识你。' },
    { sentence:'Where are you from?', translation:'你来自哪里？' },
    { sentence:'What do you do?', translation:'你是做什么的？' }
  ]},
  { id:'builtin-shopping', name:'购物英语', builtin:true, items:[
    { sentence:'How much is it?', translation:'多少钱？' },
    { sentence:'Can I try it on?', translation:'我可以试穿吗？' },
    { sentence:'I will take it.', translation:'我买了。' },
    { sentence:'Do you have a bigger size?', translation:'有大一号的吗？' },
    { sentence:'Is there a discount?', translation:'有折扣吗？' }
  ]},
  { id:'custom-deck', name:'我的导入', builtin:false, items:[
    { sentence:'Let us go home.', translation:'我们回家吧。' },
    { sentence:'Call me later.', translation:'晚点打给我。' },
    { sentence:'See you tomorrow.', translation:'明天见。' }
  ]}
];
var demo1 = CL.demoStatsSample(demoDecks);
assert(demo1 !== null, '正常题库 → 返回示例（非 null）');
assertEq(Object.keys(demo1.bySentence).length, 12, '12 个模板全部落地');
assertEq(demo1.rounds, 3, '示例完成轮次 = 3');
var dSum = 0, cls = { master:0, learn:0, weak:0 };
Object.keys(demo1.bySentence).forEach(function(k){
  var st = demo1.bySentence[k];
  assert(/^[^#]+#[0-9a-f]{8}$/.test(k), 'key 为 deckId#cid 格式 → ' + k);
  assertEq(typeof st.sentence, 'string', '条目含真实 sentence');
  assert(st.times === st.okTimes + st.wrongTimes, 'times=ok+wrong');
  assert(st.times >= 1 && st.okTimes >= 0, '计数合法');
  assert(typeof st.lastAt === 'number' && st.lastAt > 0, '含 lastAt 时间戳');
  dSum += st.times;
  cls[CL.classifyStat(st)]++;
});
assertEq(dSum, demo1.answered, 'totalAnswered 增量 = Σtimes');
assert(cls.master >= 3, '含 master 形态（≥3）');
assert(cls.learn >= 5, '含 learn 形态');
assert(cls.weak >= 1, '含 weak 形态');
assertEq(Object.keys(demo1.bySentence).filter(function(k){ return /^custom-deck#/.test(k); }).length >= 2, true, '线性插值覆盖导入 deck 尾部（≥2 句）');
assert(CL.demoStatsSample([]) === null, '空题库 → null');
assert(CL.demoStatsSample(null) === null, 'null 入参 → null');
assert(CL.demoStatsSample([{ id:'x', items:[{ sentence:'Only one sentence here.' }] }]) === null, '可练句 <3 → null');
var demo2 = CL.demoStatsSample(demoDecks);
var dKeys1 = Object.keys(demo1.bySentence).sort().join(',');
var dKeys2 = Object.keys(demo2.bySentence).sort().join(',');
assertEq(dKeys2, dKeys1, '同题库两次采样的句子集合一致（确定性采样）');
var stable = true;
Object.keys(demo1.bySentence).forEach(function(k){ if(demo1.bySentence[k].times !== demo2.bySentence[k].times) stable = false; });
assert(stable, '各句演示计数两次一致（仅 lastAt 时间戳随运行时刻变化）');

console.log('\n【streak chip 数据层 · CL.streakDays / CL.todayRounds / CL.bumpDaysLog / CL.ymd】');
/* 用 (mem, now) 双参形态可任意冻结时间，不依赖 node 系统时间 */
var streakNow = new Date(2026, 8, 9, 10, 0, 0); /* 2026-09-09 本地时间 */
/* ymd 格式 */
assertEq(CL.ymd(new Date(2026, 0, 1)), '2026-01-01', 'ymd 1月补零');
assertEq(CL.ymd(new Date(2026, 8, 9)), '2026-09-09', 'ymd 9月补零');
assertEq(CL.ymd(new Date(2026, 11, 31)), '2026-12-31', 'ymd 12月底');
/* 全空 mem */
var emptyMem = CL.loadMem();
assertEq(CL.streakDays(emptyMem, streakNow), 0, '全空 daysLog → streak=0');
assertEq(CL.todayRounds(emptyMem, streakNow), 0, '全空 daysLog → today=0');
/* 今天练了 3 次：streak=1 today=3 */
CL.bumpDaysLog(emptyMem, streakNow);
CL.bumpDaysLog(emptyMem, streakNow);
CL.bumpDaysLog(emptyMem, streakNow);
assertEq(CL.todayRounds(emptyMem, streakNow), 3, 'bumpDaysLog 三次 → today=3');
assertEq(CL.streakDays(emptyMem, streakNow), 1, '今天练了 → streak=1（仅今天）');
/* 构造"昨天也练了"的 daysLog */
var yMem = CL.loadMem();
yMem.stats.daysLog['2026-09-08'] = { rounds: 2 };
yMem.stats.daysLog['2026-09-07'] = { rounds: 1 };
CL.bumpDaysLog(yMem, streakNow);
assertEq(CL.todayRounds(yMem, streakNow), 1, '今天追加 1 → today=1');
assertEq(CL.streakDays(yMem, streakNow), 3, '今天+昨天+前天都练 → streak=3（含今天）');
/* 今天没练，昨天练了 → streak 看昨天开始 */
var yOnlyMem = CL.loadMem();
yOnlyMem.stats.daysLog['2026-09-08'] = { rounds: 4 };
yOnlyMem.stats.daysLog['2026-09-07'] = { rounds: 1 };
assertEq(CL.streakDays(yOnlyMem, streakNow), 2, '今天没练 + 昨天+前天练 → streak=2');
assertEq(CL.todayRounds(yOnlyMem, streakNow), 0, '今天没练 → today=0');
/* 今天练了 + 昨天断了 → streak=1（只看今天） */
var todayOnlyMem = CL.loadMem();
todayOnlyMem.stats.daysLog['2026-09-07'] = { rounds: 5 };
CL.bumpDaysLog(todayOnlyMem, streakNow);
assertEq(CL.streakDays(todayOnlyMem, streakNow), 1, '昨天有但前天才有 → streak=1（仅算今天）');
/* 跨月边界：8/30, 8/31, 9/1, 9/2 都练, 今天 9/3 也练 → 跨月连续 5 天（无间断） */
var crossMonthMem = CL.loadMem();
crossMonthMem.stats.daysLog['2026-08-30'] = { rounds: 1 };
crossMonthMem.stats.daysLog['2026-08-31'] = { rounds: 2 };
crossMonthMem.stats.daysLog['2026-09-01'] = { rounds: 1 };
crossMonthMem.stats.daysLog['2026-09-02'] = { rounds: 1 };
var streakSep3 = new Date(2026, 8, 3, 10, 0, 0); /* 2026-09-03 */
CL.bumpDaysLog(crossMonthMem, streakSep3);
assertEq(CL.streakDays(crossMonthMem, streakSep3), 5, '跨月连续 5 天（8/30-9/3）');
/* 跨月 + 今天没练：8/30-9/2 都练，今天 9/3 没练 → streak=4（不含今） */
var crossMonthNoToday = CL.loadMem();
crossMonthNoToday.stats.daysLog['2026-08-30'] = { rounds: 1 };
crossMonthNoToday.stats.daysLog['2026-08-31'] = { rounds: 2 };
crossMonthNoToday.stats.daysLog['2026-09-01'] = { rounds: 1 };
crossMonthNoToday.stats.daysLog['2026-09-02'] = { rounds: 1 };
assertEq(CL.streakDays(crossMonthNoToday, streakSep3), 4, '跨月连续 + 今天没练 → 4 天（不含今）');
/* 极端：存了 4000 天前的旧 log → streak 只算最近连续（防御回看上限） */
var wayOldMem = CL.loadMem();
wayOldMem.stats.daysLog['1985-01-01'] = { rounds: 100 }; /* 远古假数据 */
assertEq(CL.streakDays(wayOldMem, streakNow), 0, '今天没练 + 全远古假数据 → streak=0（防御回看断链）');
/* loadMem 白名单放行 daysLog（round-trip） */
storage['chunklab.v1'] = JSON.stringify({
  decks: [{ id:'d1', name:'test', items:[{ sentence:'hi', chunks:['hi'], hints:['嗨'] }] }],
  stats: { totalRounds:1, totalAnswered:1, bySentence:{}, events:[], daysLog: { '2026-09-08': { rounds: 3 } } }
});
var rt = CL.loadMem();
assertEq(rt.stats.daysLog['2026-09-08'].rounds, 3, 'loadMem 白名单保留 daysLog 数据');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
