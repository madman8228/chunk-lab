/* ============================================================
   validate_builtins.js · 校验 builtins.js（口语 8000 的档案迁移表）
   ------------------------------------------------------------
   运行：node validate_builtins.js

   2026-09-15 起 builtins.js 不再持有句子：
     - window.BUILTIN = []                    （deck 清单由 content/manifest.json 提供）
     - window.BUILTIN_MIGRATION = { 新deckId: [cid, ...] }  （老档案 key → 新 deck）

   规则：
    1) BUILTIN 必须是空数组（内容源已迁到 oral-book.js；非空说明有残留）
    2) 迁移表存在、非空；键全部是 oral-* 形态
    3) 每个 cid 为 8-hex；**不得跨 deck 重复**（否则迁移结果不确定）
    4) 与 oral-book.js 交叉核对：每个 cid 必须真的存在于目标 deck（防表与内容脱节）
    5) cid 总数必须等于「现有库并入句数」的声明值（496）
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const EXPECT_TOTAL = 496;

const win = {};
new Function('window', fs.readFileSync(path.join(__dirname, 'builtins.js'), 'utf8'))(win);
const decks = win.BUILTIN;
const MIG = win.BUILTIN_MIGRATION;

let issues = 0;
function report(msgs) { issues++; msgs.forEach((m) => console.log('   - ' + m)); }

/* 1) BUILTIN 为空 */
if (!Array.isArray(decks)) report(['window.BUILTIN 不是数组']);
else if (decks.length) report(['window.BUILTIN 应为空数组（内容已迁到 oral-book.js），实际 ' + decks.length + ' 项']);
else console.log('[1] window.BUILTIN = [] ✓');

/* 2) 迁移表形态 */
if (!MIG || typeof MIG !== 'object') {
  report(['缺少 window.BUILTIN_MIGRATION']);
  console.log('\n结果：' + issues + ' 处问题  ❌');
  process.exit(1);
}
const ids = Object.keys(MIG);
console.log('[2] 迁移表 ' + ids.length + ' 个 deck');
ids.forEach((id) => { if (!/^oral-/.test(id)) report(['迁移表键不是 oral-* 形态：' + id]); });

/* 3) cid 合法且不跨 deck 重复 */
const owner = {};
let total = 0;
ids.forEach((id) => {
  (MIG[id] || []).forEach((cid) => {
    total++;
    if (!/^[0-9a-f]{8}$/.test(cid)) report([id + ' 含非法 cid：' + cid]);
    if (owner[cid] && owner[cid] !== id) report(['cid 归属冲突：' + cid + ' → ' + owner[cid] + ' vs ' + id]);
    else owner[cid] = id;
  });
});
console.log('[3] cid 合计 ' + total + '，跨 deck 冲突 ' + Object.keys(owner).length + ' 个唯一值');

/* 4)(5) 与 oral-book.js 交叉核对 */
const bookWin = {};
new Function('window', fs.readFileSync(path.join(__dirname, 'oral-book.js'), 'utf8'))(bookWin);
const bookDecks = (bookWin.ORAL_BOOK && bookWin.ORAL_BOOK.decks) || [];
const bookById = {};
bookDecks.forEach((d) => {
  const cids = {};
  (d.items || []).forEach((it) => { cids[it.cid] = it.sentence; });
  bookById[d.id] = cids;
});
let miss = 0;
ids.forEach((id) => {
  const cids = bookById[id];
  if (!cids) { report(['迁移表指向 oral-book.js 中不存在的 deck：' + id]); return; }
  (MIG[id] || []).forEach((c) => {
    if (!cids[c]) { miss++; if (miss <= 5) report([id + '#' + c + ' 在目标 deck 里找不到（表与内容脱节）']); }
  });
});
if (miss > 5) report(['…共 ' + miss + ' 个 cid 在目标 deck 里找不到']);
console.log('[4] 交叉核对完成，脱节 ' + miss + ' 个');

if (total !== EXPECT_TOTAL) report(['迁移表 cid 总数 ' + total + ' ≠ 期望 ' + EXPECT_TOTAL]);

console.log('\n结果：' + (issues ? issues + ' 处问题  ❌' : '全部合规  ✅'));
process.exit(issues ? 1 : 0);
