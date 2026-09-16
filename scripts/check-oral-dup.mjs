/* check-oral-dup.mjs · 批素材「入库前」粗筛：先看哪些句子其实已经在库里
 *
 * 用途：老板给的原始中英素材（只有 sentence + 中文，还没有 chunks/干扰项）先过这一关，
 *       避免为已存在的句子白写一整条数据。
 *
 * 输入格式（每行一句）：
 *   <英文句子> | <中文>
 *   （`|` 两侧空格可有可无；以 `#` 开头的行忽略）
 *
 * 运行：node scripts/check-oral-dup.mjs extra/oral-batch5-source.txt
 *
 * 判定：
 *   [已存在] norm(sentence) 命中 builtins.js / oral8000.js / freq-idioms.js
 *   [本批重复] 同一份素材里 norm 重复
 *   [新增]    可进入批数据源
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm } from '../js/chunk-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadExisting() {
  /* 2026-09-15 起口语 8000 = oral-book.js 唯一内容源；builtins.js 只剩迁移表、
     oral8000.js 为空壳。继续读它们会让去重预检对着**空库**跑 → 静默漏检重复。 */
  global.window = { BUILTIN: [] };
  new Function('window', fs.readFileSync(path.join(ROOT, 'oral-book.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(ROOT, 'freq-idioms.js'), 'utf8'))(global.window);
  const out = [];
  const book = global.window.ORAL_BOOK;
  for (const d of (book && book.decks) || []) for (const it of d.items || []) out.push({ deck: d.id, it });
  for (const d of global.window.BUILTIN || []) {
    if (book && (book.decks || []).some((x) => x.id === d.id)) continue;
    for (const it of d.items || []) out.push({ deck: d.id, it });
  }
  if (!out.length) throw new Error('去重预检读到 0 条现有句（oral-book.js / freq-idioms.js 没加载上？）—— 拒绝空库通过');
  return out;
}

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/check-oral-dup.mjs <source.txt>');
  process.exit(2);
}

const existing = loadExisting();
const oldNorm = new Map();
for (const { deck, it } of existing) {
  const n = norm(it.sentence);
  if (n && !oldNorm.has(n)) oldNorm.set(n, deck + ' · ' + it.sentence);
}

const lines = fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8')
  .split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));

const seen = new Map();
const dup = [];
const mine = [];
lines.forEach((line, i) => {
  const parts = line.split('|');
  const en = (parts[0] || '').trim();
  const zh = (parts.slice(1).join('|') || '').trim();
  const n = norm(en);
  if (!en) return;
  if (oldNorm.has(n)) dup.push({ i, en, zh, where: oldNorm.get(n) });
  else if (seen.has(n)) dup.push({ i, en, zh, where: '本批重复 → ' + seen.get(n) });
  else { seen.set(n, en); mine.push({ i, en, zh }); }
});

console.log('素材总行数 ' + lines.length + ' / 既有库 ' + existing.length + ' 句\n');
console.log('=== ✗ 已在库 / 重复（' + dup.length + '）===');
dup.forEach((d) => console.log('  ' + String(d.i + 1).padStart(3) + '. ' + d.en + '  | ' + d.zh + '   ← ' + d.where));
console.log('\n=== ✓ 新增（' + mine.length + '）===');
mine.forEach((m) => console.log('  ' + String(m.i + 1).padStart(3) + '. ' + m.en + '  | ' + m.zh));
console.log('\n合计：新增 ' + mine.length + '，落在库/重复 ' + dup.length);
