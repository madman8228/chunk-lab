/**
 * gen-builtins-stub.mjs —— 生成 builtins.js（只剩迁移表）与 oral8000.js（空壳占位）
 * 迁移表 = { 新deckId: [cid, ...] }，供 core.js 把老 key 改写到新 deck。
 * 同时核验：现有 496 句的显式 cid 是否等于 fnv8(sentence)（决定迁移表要覆盖哪些形态）
 *
 * ⚠️ 归属的**唯一真相 = oral-book.js**（gen-oral-book.mjs 的产物）→ 本脚本必须在其**之后**跑。
 * ⚠️ 输入为入库文件（extra/oral-book/）。
 *
 * 用法：node scripts/gen-builtins-stub.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { ASSIGN, validate } from '../extra/oral-book/assign.mjs';

const SRC = 'extra/oral-book';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function fnv8(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}
function run(file, win) {
  const ctx = { window: win || {}, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx.window;
}

/* ---------- 现有 496 句（从迁移前基线读） ---------- */
const bw = run(SRC + '/base/builtins.js');
const exist = [];
(bw.BUILTIN || []).forEach((d) => { if (d.builtin) (d.items || []).forEach((it) => exist.push(it)); });
const ow = run(SRC + '/base/oral8000.js', { BUILTIN: { push() {}, concat() { return []; } } });
(ow.DATA_ORAL8000 || []).forEach((it) => exist.push(it));

const { errs } = validate(496);
if (errs.length) throw new Error(errs.join('; '));

/* cid 与 fnv8 关系核验 */
let same = 0, diff = 0;
const diffSample = [];
exist.forEach((it) => { if (it.cid === fnv8(it.sentence)) same++; else { diff++; if (diffSample.length < 5) diffSample.push({ cid: it.cid, fnv: fnv8(it.sentence), s: it.sentence }); } });
console.log('cid == fnv8(sentence):', same, '  不等:', diff);
diffSample.forEach((d) => console.log('   ' + d.cid + ' vs ' + d.fnv + '  ' + JSON.stringify(d.s.slice(0, 50))));

/* ---------- 迁移映射（归属唯一真相 = oral-book.js） ----------
   旧实现拿 ASSIGN 的 i2deck 当归属 → 与 gen-oral-book 的**实际装配**会脱节。
   实测：It doesn't matter. 书属 4.23「不感兴趣时」，而 ASSIGN 把它归给 4.20「安慰时」；
   书句认领优先后它落在 oral-4-23，迁移表却仍指向 oral-4-20
   → validate_builtins 报「表与内容脱节」，且用户旧进度会被改写成指向一个不存在的句子。
   根因修法：归属只认 oral-book.js 的事实（cid → 所在 deck），不再自己推算一份。
   ⚠️ 本脚本必须在 gen-oral-book.mjs **之后**跑（先有 oral-book.js 才能反查）。 */
const ob = run('oral-book.js', {});
const cid2deck = new Map();
((ob.ORAL_BOOK || {}).decks || []).forEach((d) => {
  (d.items || []).forEach((it) => { if (it.cid && !cid2deck.has(it.cid)) cid2deck.set(it.cid, d.id); });
});
if (!cid2deck.size) throw new Error('oral-book.js 里没有任何 cid —— 是不是还没跑 scripts/gen-oral-book.mjs？');
const map = {};
const missing = [];
for (let i = 0; i < 496; i++) {
  const it = exist[i];
  /* 两种形态都收：显式 cid 与 fnv8(sentence)（老数据可能是后者） */
  const cands = it.cid === fnv8(it.sentence) ? [it.cid] : [it.cid, fnv8(it.sentence)];
  const deck = cands.map((c) => cid2deck.get(c)).find(Boolean);
  if (!deck) { missing.push(it.cid + ' / ' + fnv8(it.sentence) + ' 「' + it.sentence + '」'); continue; }
  if (!map[deck]) map[deck] = [];
  cands.forEach((c) => map[deck].push(c));
}
if (missing.length) throw new Error('以下现有句在 oral-book.js 里找不到归属（fail-closed，拒绝生成脱节的迁移表）：\n  ' + missing.join('\n  '));
Object.keys(map).forEach((k) => { map[k] = [...new Set(map[k])]; });
const cidTotal = Object.values(map).reduce((a, x) => a + x.length, 0);
console.log('迁移表：' + Object.keys(map).length + ' 个 deck / ' + cidTotal + ' 个 cid');

/* 自检：cid 唯一归属 */
const seen = new Map();
Object.entries(map).forEach(([d, list]) => list.forEach((c) => {
  if (seen.has(c) && seen.get(c) !== d) throw new Error('cid 归属冲突：' + c + ' ' + seen.get(c) + ' vs ' + d);
  seen.set(c, d);
}));
console.log('✓ cid 归属唯一');

/* ---------- builtins.js ---------- */
const lines = [];
lines.push('/* builtins.js · Chunk Lab 内置题库');
lines.push('   2026-09-15：口语 8000 系列改为唯一内容源 oral-book.js（构建期），');
lines.push('   页面不再直接持有句子，deck 清单由 content/manifest.json 提供。');
lines.push('   本文件只保留「老档案 key → 新 deck」的迁移映射，被三页无条件加载。 */');
lines.push('window.BUILTIN = [];');
lines.push('');
lines.push('/* window.BUILTIN_MIGRATION = { 新deckId: [cid, ...] }');
lines.push('   覆盖前两代 key：`builtin-daily#cid`（初版）与 `daily-*#cid`（场景拆分版）。');
lines.push('   由 core.js 的 migrateToBookDecks() 在 loadMem 时幂等执行。 */');
lines.push('window.BUILTIN_MIGRATION = {');
const keys = Object.keys(map).sort();
keys.forEach((k, i) => {
  const list = map[k].map((c) => JSON.stringify(c)).join(',');
  lines.push('  ' + JSON.stringify(k) + ': [' + list + ']' + (i === keys.length - 1 ? '' : ','));
});
lines.push('};');
const stub = lines.join('\n') + '\n';
fs.writeFileSync('builtins.js', stub, 'utf8');
console.log('已写 builtins.js  ' + (Buffer.byteLength(stub) / 1024).toFixed(1) + ' KB');

/* ---------- oral8000.js 空壳 ---------- */
const shell = [
  '/* oral8000.js · 历史源（已迁移，2026-09-15）',
  '   原 408 句扩展句已并入 oral-book.js（唯一内容源），本文件不再被页面或构建读取。',
  '   保留空壳仅为避免历史引用报错；相关内容改动请改 extra/oral-book/content/ 并按 scripts/gen-oral-book.mjs 重新装配。 */',
  'window.DATA_ORAL8000 = [];',
  'window.DATA_ORAL8000_SCENES = [];',
  '',
].join('\n');
fs.writeFileSync('oral8000.js', shell, 'utf8');
console.log('已写 oral8000.js（空壳）');
