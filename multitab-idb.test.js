/**
 * multitab-idb.test.js · courses / progress（IDB 大对象）跨标签页三路合并单测
 *   （P0 数据可靠性加固，2026-09-11；由 QA 独立验证发现的两处源码缺陷回归）
 *
 * 背景（与 multitab.test.js 互补，后者只覆盖 chunklab.v1 小字段 mem 链路）：
 *   courses / progress 的大对象在 IndexedDB，写语义是「全量替换」（putCourses/putProgress）。
 *   两个标签页各自导入一门课，后写者整份替换 → 前者被静默覆盖丢掉。
 *   防护依赖「跨标签页写信号（notifyTabs）+ 读当前 IDB 实况比对基线」触发三路合并，
 *   因此 core.js 的 IDB 分支必须与 local 分支一样在写后发信号，且 js/idb.js 必须导出
 *   getCourses/getProgress 供比对。本文件专门回归这两点。
 *
 * 模型：两个「标签页」= 两份独立 core.js 实例（各自闭包、各自内存态），
 *   共享同一份 localStorage（含 beacon 键）与同一份「IDB」盘（disk 对象）——
 *   与真实双标签页同构。node 无 storage 事件，故捕获 addEventListener('storage')
 *   的监听器，手动投递 beacon（等价于浏览器把写信号投递给另一个标签页）。
 *
 * 覆盖：
 *   S0  负向前置：js/idb.js 必须导出 getCourses/getProgress（缺失则合并路径整次写入失败）
 *   S6  负向验证：不投递跨标签页写信号（≈ 旧版无 notifyTabs）→ 后写者整份覆盖，前者丢
 *   S7  正向验证：投递写信号 → 三路合合并集，A/B 的课程都在（后写者不丢前者）
 *   S7b 旧标签页（其 base 早于对方课程存在）写入自己的课程 → 对方课程被并集保留
 *   S8  progress（课程进度）同样的合并语义 + 负向对照
 *
 * 运行：node multitab-idb.test.js   （已纳入 npm test）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var CORE_SRC = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
var TAB_SYNC_KEY = 'chunklab_tabsync_v1';

var pass = 0, fail = 0;
function check(name, cond, detail){
  if(cond){ pass++; console.log('  \u2713 ' + name); }
  else{ fail++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }

/* ---------- S0 · js/idb.js 导出完整性（Bug 1 回归） ---------- */
console.log('【S0 · js/idb.js 导出 getCourses / getProgress】');
(function(){
  var ctx = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  ctx.indexedDB = undefined; /* 不触发真实打开；只在加载时断言导出 */
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'js', 'idb.js'), 'utf8'), ctx);
  var s = ctx.IDBStore || {};
  check('S0 IDBStore.getCourses 已导出且为函数', typeof s.getCourses === 'function', Object.keys(s).join(','));
  check('S0 IDBStore.getProgress 已导出且为函数', typeof s.getProgress === 'function', Object.keys(s).join(','));
})();

/* ---------- 共享存储 / 共享 IDB 盘 ---------- */
function makeShared(){
  return {
    storage: {},                          /* 共享 localStorage（同源） */
    disk: { courses: [], progress: {} }   /* 共享 IDB 盘（全量替换语义） */
  };
}
/* 内存版 IDBStore：接口与 js/idb.js 一致，课程/进度是「全量替换」语义（关键：能还原覆盖） */
function makeIDB(disk){
  return {
    loadAll: function(){ return Promise.resolve({ courses: clone(disk.courses), courseProgress: clone(disk.progress), sentenceStats: {}, events: [] }); },
    getCourses: function(){ return Promise.resolve(clone(disk.courses)); },
    getProgress: function(){ return Promise.resolve(clone(disk.progress)); },
    putCourses: function(list){ disk.courses = clone(list || []); return Promise.resolve(); },
    putProgress: function(map){ disk.progress = clone(map || {}); return Promise.resolve(); }
  };
}
/* 一个新「标签页」：独立闭包，共享 localStorage 与共享 IDB 盘；捕获 storage 监听器以便投递信号 */
function newTab(shared){
  var listeners = {};
  var ctx = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    IDBStore: makeIDB(shared.disk),
    localStorage: {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(shared.storage, k) ? shared.storage[k] : null; },
      setItem: function(k, v){ shared.storage[k] = String(v); },
      removeItem: function(k){ delete shared.storage[k]; }
    },
    addEventListener: function(t, fn){ (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: function(){},
    indexedDB: undefined
  };
  ctx.window = ctx;
  vm.runInNewContext(CORE_SRC, ctx);
  return {
    CL: ctx.CL,
    /* 把当前 beacon 键当作一个 storage 事件投递给本标签页（等价把写信号广播到本页） */
    deliverBeacon: function(){
      var msg = shared.storage[TAB_SYNC_KEY];
      if(msg == null) return false;
      (listeners['storage'] || []).forEach(function(fn){ fn({ key: TAB_SYNC_KEY, newValue: msg, oldValue: null }); });
      return true;
    }
  };
}
function courseIds(disk){ return (disk.courses || []).map(function(c){ return c.courseId; }).sort(); }

/* ---------- S6 · 负向验证：无跨标签页写信号 → 后写者整份覆盖 ---------- */
async function s6(){
  console.log('\n【S6 · 负向验证：不投递写信号（≈ 旧版缺 notifyTabs）→ 前者被整份覆盖】');
  var shared = makeShared();
  var A = newTab(shared), B = newTab(shared);
  await A.CL.preload(); await B.CL.preload();

  await A.CL.writeCourses([{ courseId: 'courseA' }]);
  check('S6 前置：A 写入后盘上只有 courseA',
    courseIds(shared.disk).join(',') === 'courseA', JSON.stringify(courseIds(shared.disk)));

  /* 故意不投递 A 的写信号给 B —— 等价于旧版 IDB 分支从不 notifyTabs */
  await B.CL.writeCourses([{ courseId: 'courseB' }]);
  check('S6 ★ 负向：无写信号 → B 整份覆盖，courseA 静默丢失（漏洞真实存在）',
    courseIds(shared.disk).join(',') === 'courseB', JSON.stringify(courseIds(shared.disk)));
}

/* ---------- S7 · 正向验证：投递写信号 → 合并不丢 ---------- */
async function s7(){
  console.log('\n【S7 · 正向验证：投递写信号 → 三路合合并集，双方课程都在】');
  var shared = makeShared();
  var A = newTab(shared), B = newTab(shared);
  await A.CL.preload(); await B.CL.preload();

  await A.CL.writeCourses([{ courseId: 'courseA' }]);
  /* 关键：把 A 的写信号投递给 B（真实浏览器里由 BroadcastChannel / storage 事件投递） */
  var delivered = B.deliverBeacon();
  check('S7 前置：A 的写信号已投递到 B', delivered === true);

  await B.CL.writeCourses([{ courseId: 'courseB' }]);
  check('S7 ★ 有写信号 → 三路合合并集，courseA + courseB 都在（后者不覆盖前者）',
    courseIds(shared.disk).join(',') === 'courseA,courseB', JSON.stringify(courseIds(shared.disk)));
}

/* ---------- S7b · 旧标签页（base 早于对方课程存在）写入自己的课程 ---------- */
async function s7b(){
  console.log('\n【S7b · 旧标签页写入自己的课程 → 对方课程被并集保留】');
  var shared = makeShared();
  /* 旧标签页 E 先打开：此刻盘为空，E 的 base = []（它永远没见过 courseA） */
  var E = newTab(shared);
  await E.CL.preload();
  /* 另一个标签页 A 打开并导入 courseA */
  var A = newTab(shared);
  await A.CL.preload();
  await A.CL.writeCourses([{ courseId: 'courseA' }]);
  check('S7b 前置：A 导入后盘上只有 courseA',
    courseIds(shared.disk).join(',') === 'courseA', JSON.stringify(courseIds(shared.disk)));

  /* E 收到 A 的写信号后，导入自己的 courseE —— E 的旧视图里没有 courseA */
  E.deliverBeacon();
  await E.CL.writeCourses([{ courseId: 'courseE' }]);
  check('S7b ★ 旧标签页写入后 courseA 与 courseE 都在（对方课程被并集保留，不丢）',
    courseIds(shared.disk).join(',') === 'courseA,courseE', JSON.stringify(courseIds(shared.disk)));
}

/* ---------- S8 · progress 跨标签页合并 ---------- */
async function s8(){
  console.log('\n【S8 · progress（课程进度）跨标签页合并】');
  var shared = makeShared();
  var A = newTab(shared), B = newTab(shared);
  await A.CL.preload(); await B.CL.preload();

  await A.CL.writeProgress({ courseA: { seen: ['n1'] } });
  B.deliverBeacon();
  await B.CL.writeProgress({ courseB: { seen: ['n2'] } });
  var p = shared.disk.progress || {};
  check('S8 ★ progress 合并不丢：courseA 与 courseB 的进度都在', !!p.courseA && !!p.courseB, JSON.stringify(p));

  /* 负向对照：不投递信号的标签页写入会整份覆盖 */
  var shared2 = makeShared();
  var A2 = newTab(shared2), B2 = newTab(shared2);
  await A2.CL.preload(); await B2.CL.preload();
  await A2.CL.writeProgress({ courseA: { seen: ['n1'] } });
  await B2.CL.writeProgress({ courseB: { seen: ['n2'] } });   /* 不投递信号 */
  var p2 = shared2.disk.progress || {};
  check('S8 负向对照：无写信号 → courseA 进度被整份覆盖丢失', !p2.courseA && !!p2.courseB, JSON.stringify(p2));
}

s6().then(s7).then(s7b).then(s8).then(function(){
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
}).catch(function(e){
  console.error('测试执行异常：', e);
  process.exit(1);
});
