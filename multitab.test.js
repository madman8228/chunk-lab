/**
 * multitab.test.js · 多标签页旧快照覆盖防护单测（P0 数据可靠性加固，2026-09-11）
 *
 * 背景（根因）：mem 在页面加载时 loadMem() 读入内存后本进程内不再刷新，写路径
 *   saveAndNotify → saveMem → writeLocalMem 把整份 mem 直接写回 localStorage，
 *   写前无版本检查。两个标签页同时打开时：
 *     A 持旧 mem ─ B 答题写回 ─ A 再答题 saveMem → A 用旧整份快照覆盖掉 B 的改动。
 *   单机双标签页即触发，用户无感 = 静默丢数据。
 *
 * 本单测的模型：两个「标签页」= 两份独立的 core.js 实例（各自闭包、各自内存态），
 *   共享同一份 localStorage —— 与真实双标签页完全同构（同源共享存储，内存互不感知）。
 *
 * 覆盖：
 *   1. 负向验证：按改造前方式整份覆盖 → 确实丢数据（证明漏洞真实存在、护栏有用武之地）
 *   2. 正向验证：改造后 A 的旧快照不覆盖 B 的新数据（decks / mastered / 计数 / 打卡全保留）
 *   3. 本页自己的改动同样不丢（并集语义，双方都保留）
 *   4. settings 逐键合并、deletedItems 并集、rev 单调不回退
 *
 * 运行：node multitab.test.js   （已纳入 npm test）
 */
'use strict';
var fs = require('fs');
var path = require('path');

/* ---------- 共享 localStorage + 独立 core.js 实例 ---------- */
var storage = {};
function makeStorage(){
  return {
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem: function(k, v){ storage[k] = String(v); },
    removeItem: function(k){ delete storage[k]; }
  };
}
var coreSrc = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
/* 一个新「标签页」：独立 window（独立闭包状态），localStorage 指向同一份 storage */
function newTab(){
  var w = {
    localStorage: makeStorage(),
    parent: null,
    addEventListener: function(){},
    removeEventListener: function(){},
    document: {
      getElementById: function(){ return null; },
      createElement: function(){ return { value:'', style:{}, select:function(){}, classList:{ add:function(){} } }; },
      body: { appendChild: function(){}, removeChild: function(){} },
      execCommand: function(){ return true; }
    },
    navigator: { clipboard: null }
  };
  new Function('window', coreSrc)(w);
  return w.CL;
}
var pass = 0, fail = 0;
function check(name, cond, detail){
  if(cond){ pass++; console.log('  \u2713 ' + name); }
  else{ fail++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
function readDisk(){ try{ return JSON.parse(storage['chunklab.v1'] || '{}'); }catch(e){ return {}; } }
function readRevs(){ try{ return JSON.parse(storage['chunklab_revs_v1'] || '{}'); }catch(e){ return {}; } }
function deckIds(){ return (readDisk().decks || []).map(function(d){ return d.id; }).sort(); }
function mkDeck(id){
  return { id:id, name:'题库 ' + id, builtin:false, items:[{ sentence:'Sentence ' + id, cid:'c' + id, translation:'', chunks:[], hints:[], alts:[] }] };
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }

console.log('【S1 · 负向验证：改造前的「整份覆盖」确实会丢数据】');
(function(){
  storage = {};
  var A = newTab(), B = newTab();
  A.loadMem(); B.loadMem();
  /* 标签页 A 答题：新增 deckA 并落盘 */
  var ma = A.loadMem();
  ma.decks.push(mkDeck('deckA'));
  A.saveAndNotify(ma);
  /* ★ A 的旧内存快照（此刻只含 deckA）—— 这就是 P0 里那个「旧快照」 */
  var staleARaw = JSON.stringify(Object.assign({}, ma, { version: 2 }));
  /* 标签页 B 答题：新增 deckB 并落盘 */
  var mb = B.loadMem();
  mb.decks.push(mkDeck('deckB'));
  B.saveAndNotify(mb);
  check('S1 前置：B 写入后磁盘同时含 deckA + deckB（B 的写入已受保护）',
    deckIds().join(',') === 'deckA,deckB', JSON.stringify(deckIds()));
  /* 按改造前的方式整份覆盖（等价于旧 writeLocalMem：不含任何写前检查） */
  storage['chunklab.v1'] = staleARaw;
  check('S1 负向验证：无保护的整份覆盖 → deckB 静默消失（漏洞真实存在）',
    deckIds().indexOf('deckB') < 0, JSON.stringify(deckIds()));
})();

console.log('\n【S2 · 正向验证：改造后 A 的旧快照不覆盖 B 的新数据】');
(function(){
  storage = {};
  var A = newTab(), B = newTab();
  A.loadMem(); B.loadMem();

  /* A 答题：新增 deckA + 记一条自己的档案 */
  var ma = A.loadMem();
  ma.decks.push(mkDeck('deckA'));
  A.saveAndNotify(ma);
  /* A 的旧快照（含 deckA），稍后 A 会拿它再写一次 */
  var staleA = clone(ma);
  /* 第三个标签页 C：在 deckB 出现之前就已加载（base = 只有 deckA 的旧磁盘态），
     之后一直没刷新 —— 典型的「另一个被遗忘的旧标签页」 */
  var C = newTab();
  var mcOld = C.loadMem();

  /* B 答题：新增 deckB + 两套自己的练习记录（deck / 档案 / 计数 / 打卡） */
  var mb = B.loadMem();
  mb.decks.push(mkDeck('deckB'));
  mb.mastered = mb.mastered || {};
  mb.mastered['deckB#cb'] = { deckId:'deckB', sentence:'Sentence deckB', markedAt: 111 };
  mb.stats.totalRounds = 2;
  mb.stats.totalAnswered = 50;
  mb.stats.daysLog = { '2026-09-11': { rounds: 2 } };
  B.saveAndNotify(mb);

  check('S2 前置：B 写入后 deckA 仍在（B 写入未覆盖 A）',
    deckIds().join(',') === 'deckA,deckB', JSON.stringify(deckIds()));

  /* ★ 核心场景：A 拿「旧快照」再写一次（旧快照里没有 deckB / 没有 B 的档案与计数） */
  staleA.mastered = staleA.mastered || {};
  staleA.mastered['deckA#ca'] = { deckId:'deckA', sentence:'Sentence deckA', markedAt: 222 };
  staleA.stats.totalAnswered = 7;              /* A 自己的计数（比 B 小，取 max 后应为 50） */
  staleA.stats.daysLog = { '2026-09-10': { rounds: 3 } };  /* A 自己的打卡日 */
  var ok = A.saveAndNotify(staleA);

  var disk = readDisk();
  check('S2 saveAndNotify 返回可等待的提交结果', !!ok && typeof ok.then === 'function', String(ok));
  check('S2 ★ A 的旧快照没有覆盖 B 的新 deck（deckB 仍在）',
    deckIds().join(',') === 'deckA,deckB', JSON.stringify(deckIds()));
  check('S2 ★ B 的标熟档案没被 A 的旧快照抹掉',
    !!(disk.mastered && disk.mastered['deckB#cb']), JSON.stringify(disk.mastered));
  check('S2 ★ A 自己的标熟档案也保留了（并集语义）',
    !!(disk.mastered && disk.mastered['deckA#ca']), JSON.stringify(disk.mastered));
  check('S2 计数单调不回退：totalAnswered = 50（取 max，不退回 A 的旧值 7）',
    disk.stats && disk.stats.totalAnswered === 50, JSON.stringify(disk.stats && disk.stats.totalAnswered));
  check('S2 打卡逐天合并：A 的 09-10 与 B 的 09-11 都在',
    disk.stats && disk.stats.daysLog['2026-09-10'] && disk.stats.daysLog['2026-09-11'],
    JSON.stringify(disk.stats && disk.stats.daysLog));

  /* 再来一个更狠的：那个「早于 deckB 存在」的旧标签页 C 现在写入它自己的旧视图 */
  check('S2 前置：C 的旧视图里没有 deckB（它加载时 deckB 还不存在）',
    (mcOld.decks || []).map(function(d){ return d.id; }).indexOf('deckB') < 0,
    JSON.stringify((mcOld.decks || []).map(function(d){ return d.id; })));
  C.saveAndNotify(mcOld);
  check('S2 ★ 第三个旧标签页写入后，deckB 依旧不丢（反复覆盖也不丢）',
    deckIds().indexOf('deckB') >= 0, JSON.stringify(deckIds()));
})();

console.log('\n【S3 · settings 逐键合并 / rev 单调不回退】');
(function(){
  storage = {};
  var A = newTab(), B = newTab();
  A.loadMem(); B.loadMem();

  var ma = A.loadMem();
  ma.decks.push(mkDeck('deckA'));
  ma.settings.darkMode = true;                 /* A 改了一个设置 */
  A.saveAndNotify(ma);

  var mb = B.loadMem();
  mb.decks.push(mkDeck('deckB'));
  mb.settings.autoSpeak = true;                /* B 改了另一个设置 */
  B.saveAndNotify(mb);
  /* B 连续修改 deckB 三次 → deckB 的 rev 随真实变更单调抬升（rev 不随「无变化的重复写」递增） */
  for(var vi = 2; vi <= 4; vi++){
    var mv = B.loadMem();
    var dv = (mv.decks || []).filter(function(d){ return d.id === 'deckB'; })[0];
    if(dv){ dv.name = '题库 deckB v' + vi; }
    B.saveAndNotify(mv);
  }

  var revBefore = (readRevs().decks || {}).deckB || 0;
  check('S3 前置：B 多次修改后 deckB rev >= 4', revBefore >= 4, 'rev=' + revBefore);

  /* A 拿旧快照写入（会触发合并 + 重算 rev） */
  var stale = { decks:[mkDeck('deckA')], settings:{ darkMode:true, autoSpeak:false }, stats:{ totalRounds:0, totalAnswered:0, bySentence:{}, events:[], daysLog:{} } };
  A.saveAndNotify(stale);

  var disk = readDisk();
  check('S3 settings 逐键合并：darkMode 保留 A 的 true',
    disk.settings && disk.settings.darkMode === true, JSON.stringify(disk.settings));
  check('S3 settings 逐键合并：autoSpeak 保留 B 的 true（未被 A 的旧快照覆盖成 false）',
    disk.settings && disk.settings.autoSpeak === true, JSON.stringify(disk.settings));
  check('S3 rev 单调不回退：合并后 deckB rev 不低于合并前',
    ((readRevs().decks || {}).deckB || 0) >= revBefore, 'rev=' + ((readRevs().decks || {}).deckB || 0));
  check('S3 两个 deck 都在', deckIds().join(',') === 'deckA,deckB', JSON.stringify(deckIds()));
})();

console.log('\n【S4 · deletedItems 并集（删除意图不互相抹掉）】');
(function(){
  storage = {};
  var A = newTab(), B = newTab();
  A.loadMem(); B.loadMem();
  /* 用合法 cid 形态的 key（8 位 hex），避免触发 loadMem 的「原文→cid」迁移干扰断言 */
  var KA = 'builtin-daily#aaaaaaaa';
  var KB = 'builtin-daily#bbbbbbbb';

  var ma = A.loadMem();
  ma.deletedItems = {}; ma.deletedItems[KA] = true;
  A.saveAndNotify(ma);

  var mb = B.loadMem();
  mb.deletedItems = {}; mb.deletedItems[KB] = true;   /* B 只登记自己删的那句 */
  B.saveAndNotify(mb);

  var beforeA1 = (readDisk().deletedItems || {})[KA] === true;
  check('S4 前置：A 的 a1 已在磁盘（B 写入未抹掉它）', beforeA1, JSON.stringify(readDisk().deletedItems));

  /* A 用旧快照（只有 a1）再写 → 不许把 B 的 b1 抹掉 */
  A.saveAndNotify({ decks:[], deletedItems: (function(){ var d = {}; d[KA] = true; return d; })(), stats:{ totalRounds:0, totalAnswered:0, bySentence:{}, events:[], daysLog:{} } });

  var di = readDisk().deletedItems || {};
  check('S4 deletedItems 并集：A 的 a1 仍保留', di[KA] === true, JSON.stringify(di));
  check('S4 deletedItems 并集：B 的 b1 没被 A 的旧快照抹掉', di[KB] === true, JSON.stringify(di));
})();

console.log('\n【S5 · 纯函数级：mergeKeyedMap 的三路语义】');
(function(){
  var tab = newTab();
  var mk = tab.__crossTab.mergeKeyedMap;
  /* base 有 x,y；ours 改了 x、删了 y；theirs 改了 y、新增 z */
  var res = mk({ x:{ v:1 }, y:{ v:1 } }, { x:{ v:2 } }, { y:{ v:9 }, z:{ v:1 } });
  check('S5 theirs 改过的 y 被采纳（本页删了但不覆盖对方改动）', res.y && res.y.v === 9, JSON.stringify(res));
  check('S5 theirs 新增的 z 被采纳', !!res.z, JSON.stringify(res));
  check('S5 ours 改过的 x 胜出（同 key 双方都改 → 后写者胜）', res.x && res.x.v === 2, JSON.stringify(res));
  /* base 有 k；双方都没动 → 结果保留 k（等价空操作） */
  var res2 = mk({ k:{ v:5 } }, { k:{ v:5 } }, { k:{ v:5 } });
  check('S5 双方都没动 → 结果不变', res2.k && res2.k.v === 5, JSON.stringify(res2));
  /* ours 新增的键一定进结果 */
  var res3 = mk({}, { n:{ v:1 } }, {});
  check('S5 ours 新增的键一定保留', res3.n && res3.n.v === 1, JSON.stringify(res3));
})();

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
