/**
 * book-dedup.mjs —— 去重 + 规模统计（为分类/铺节方案提供准确数字）
 *
 * ⚠️ 只输出统计，**不写任何文件**（跑它是为了看数字，不是为了改数据）
 * ⚠️ 「现有库 496 句」必须从 extra/oral-book/base/ 读（迁移前基线）。
 *    绝不可读根目录的 builtins.js / oral8000.js —— 那两个现在是**空数组/空壳**，
 *    读它们会得到「与现有库重叠 0」，静默算错净新增（本项目经典坑：读空库）。
 *
 * 用法：node scripts/book-dedup.mjs
 */
import fs from 'node:fs';

const BOOK = 'extra/oral-book/book.json';
const BASE = 'extra/oral-book/base';

const recs = JSON.parse(fs.readFileSync(BOOK, 'utf8'));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* 与现有库对比 —— 读**迁移前基线**，不是根目录的空壳 */
const w = {};
new Function('window', fs.readFileSync(BASE + '/builtins.js', 'utf8'))(w);
const existSet = new Set();
(w.BUILTIN || []).forEach((d) => { if (d.builtin) (d.items || []).forEach((it) => existSet.add(norm(it.sentence))); });
const o = {};
new Function('window', fs.readFileSync(BASE + '/oral8000.js', 'utf8'))(o);
(o.DATA_ORAL8000 || []).forEach((it) => existSet.add(norm(it.sentence)));
/* 自我校验：基线读空即报错（防「读空库」静默算错） */
if (existSet.size < 400) {
  throw new Error('现有库基线只有 ' + existSet.size + ' 句 —— 是不是读到了空壳？基线应为 ~496 句（fail-closed）');
}

/* 全局去重：保留首次出现 */
const seen = new Map();
const keep = [];
const dropped = [];
recs.forEach((r) => {
  const k = norm(r.en);
  if (seen.has(k)) dropped.push({ first: seen.get(k), dup: r });
  else { seen.set(k, r); keep.push(r); }
});

console.log('原书句数:', recs.length);
console.log('书内归一化重复丢弃:', dropped.length);
console.log('书内去重后:', keep.length);
const hitExist = keep.filter((r) => existSet.has(norm(r.en)));
console.log('与现有库重叠:', hitExist.length);
console.log('净新增:', keep.length - hitExist.length);
console.log('入库后总量:', existSet.size + keep.length - hitExist.length);

console.log('\n=== 每节规模（去重后 / 与现有重叠）===');
const bySec = new Map();
keep.forEach((r) => {
  const key = r.ch + '.' + r.sec + ' ' + r.secTitle;
  if (!bySec.has(key)) bySec.set(key, { n: 0, dup: 0, ch: r.ch, sec: r.sec, title: r.secTitle, topics: new Set() });
  const e = bySec.get(key);
  e.n++;
  if (existSet.has(norm(r.en))) e.dup++;
  if (r.topic) e.topics.add(r.topic);
});
let total = 0;
bySec.forEach((e, k) => {
  total += e.n;
  console.log('  ' + String(e.n).padStart(4) + ' 句 (' + String(e.dup).padStart(3) + ' 已有)  ' + String(e.topics.size).padStart(2) + ' 个子场景  ' + k);
});
console.log('  合计 ' + total);

/* 跨节重复明细 */
console.log('\n=== 跨节重复（丢弃项）前 20 ===');
dropped.slice(0, 20).forEach((d) => console.log('   保留 L' + d.first.line + ' [' + d.first.sec + ' ' + d.first.secTitle + ']  ← 丢弃 L' + d.dup.line + ' [' + d.dup.sec + ' ' + d.dup.secTitle + ']  ' + d.dup.en.slice(0, 60)));
