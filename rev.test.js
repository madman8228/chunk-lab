/**
 * rev.test.js · 前端 rev 维护单测（ADR-005 的本地侧）
 *
 * 仅验证 core.js 的 maintainRevs（在 saveMem 内触发）：
 *   - 新增实体 → rev=1
 *   - 修改实体 → rev 递增
 *   - 删除实体 → rev 递增（软删标记），本地不再含该实体
 *   - kv 变更 → rev 递增；kv 未变 → rev 不递增（避免过度 bump）
 * 用最小 localStorage mock 在 Node 直跑，不依赖浏览器。
 *
 * 运行：node rev.test.js
 */
'use strict';

var store = {};
global.window = global;
global.localStorage = {
  getItem: function (k) { return (k in store) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};

require('./core.js');
var CL = global.CL;

var passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
function getRevs() { try { return JSON.parse(store['chunklab_revs_v1'] || '{}'); } catch (e) { return {}; } }

var m = CL.loadMem();

// 1. 新增 deck → rev=1
m.decks = [{ id: 'd1', name: 'A', items: [{ sent: 'a' }], builtin: false }];
CL.saveMem(m);
var revs = getRevs();
check('rev: 新增 deck d1 → rev=1', revs.decks && revs.decks.d1 === 1, 'revs=' + JSON.stringify(revs));

// 2. 改 deck → rev 递增到 2
m.decks[0].name = 'A2';
CL.saveMem(m);
revs = getRevs();
check('rev: 修改 deck d1 → rev=2', revs.decks.d1 === 2, 'rev=' + revs.decks.d1);

// 3. 删除 deck → rev 递增（软删标记），本地不再含 d1
m.decks = [];
CL.saveMem(m);
revs = getRevs();
check('rev: 删除 deck d1 → rev 递增且本地移除',
  revs.decks.d1 === 3 && CL.loadMem().decks.length === 0,
  'rev=' + revs.decks.d1 + ' decks=' + CL.loadMem().decks.length);

// 4. kv 变更 → rev 递增
var b4 = getRevs().kv.best;
m.best = { s1: 5 };
CL.saveMem(m);
var a4 = getRevs().kv.best;
check('rev: kv.best 变更 → rev 递增', a4 === b4 + 1, 'before=' + b4 + ' after=' + a4);

// 5. kv 未变 → rev 不递增（避免误 bump）
var b5 = getRevs().kv.best;
m.best = { s1: 5 };
CL.saveMem(m);
var a5 = getRevs().kv.best;
check('rev: kv.best 未变 → rev 不递增', a5 === b5, 'before=' + b5 + ' after=' + a5);

console.log('\n[rev.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
