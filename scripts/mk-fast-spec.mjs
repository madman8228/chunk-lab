/**
 * mk-fast-spec.mjs · 「切分定义」+ 书原文 → gen-fast-content 的 spec（2026-09-16 立）
 *
 * 为什么要它：
 *   铺节时要给上百条句子写 chunks/hints。**英文句子不能手抄**（漏空格/漏标点必翻车），
 *   所以流程反过来：我只写「怎么切」（chunks/hints 切分对），句子一律从 book.json 按序取。
 *   两条硬断言：
 *     ① parts 条数 === 该节应铺句数（防漏写/多写）
 *     ② norm(join(chunks)) === norm(书句)（防错序/漏词 —— 按序配对，错位必在此暴露）
 *
 * 用法：
 *   # 侦察：列该节应铺句清单（带中文、收录归属、单字句提示）
 *   node scripts/mk-fast-spec.mjs <章>.<节> --list
 *   # 生成 spec
 *   node scripts/mk-fast-spec.mjs <章>.<节> <输出spec.json> <partsA.json> [partsB.json ...]
 *
 * parts 文件格式（**按书序**，可拆多个文件分批写）：
 *   [ [ ["We are told","that..."], ["我们被告知","……"] ], ... ]
 *     └ chunks 数组            └ hints 数组（逐段，个数必须相同，由 gen-fast-content 校）
 *
 * 产物 spec 写到**入库位**（extra/），因为 gen-fast-content 的输入要在新 clone 可复现。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadBookSection, norm } from './book-section.mjs';
import CS from '../js/chunk-shape.js';

const ROOT = process.cwd();
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node scripts/mk-fast-spec.mjs <章>.<节> --list');
  console.error('      node scripts/mk-fast-spec.mjs <章>.<节> <输出spec.json> <partsA.json> [partsB.json ...]');
  process.exit(2);
}
const m = /^(\d+)\.(\d+)$/.exec(args[0]);
if (!m) { console.error('节号格式应为 <章>.<节>，如 1.4'); process.exit(2); }
const ch = Number(m[1]);
const sec = Number(m[2]);
const secArg = args[0];

const { bookSec, decks, dedup, continuations, cnByNorm } = loadBookSection(ROOT, ch, sec);
if (!bookSec.length) { console.error('书里没有第 ' + secArg + ' 节'); process.exit(1); }

const head = '第 ' + secArg + ' 节「' + bookSec[0].secTitle + (bookSec[0].topic ? ' · ' + bookSec[0].topic : '') + '」';
console.log(head);
console.log('  书内 ' + bookSec.length + ' 条 / 本节 deck ' + decks.map((d) => d.id).join('+')
  + ' 应铺 ' + dedup.length + ' 句');
/* 续行片段按口径不铺（判据见 book-section.mjs）—— 打印出来，别让这个跳过静默发生 */
if (continuations.length) {
  console.log('  [i] 续行片段 ' + continuations.length + ' 条（上一句的续写，不作独立练习单元 → 不计入应铺）：');
  continuations.forEach((s) => console.log('      ' + JSON.stringify(s)));
}

/* ---------- --list：侦察清单 ---------- */
if (args[1] === '--list') {
  const owner = new Map();
  decks.forEach((d) => d.sentences.forEach((s) => { if (!owner.has(norm(s))) owner.set(norm(s), d.id); }));
  const posOf = new Map(dedup.map((s, i) => [norm(s), i]));
  const seen = new Set();
  bookSec.forEach((r, i) => {
    const k = norm(r.en);
    const dup = seen.has(k);
    seen.add(k);
    const inS = posOf.has(k);
    const n = CS.wordCount(r.en);
    console.log([
      String(i + 1).padStart(3),
      inS ? String(posOf.get(k) + 1).padStart(3) : '  -',
      dup ? 'DUP' : '   ',
      n === 1 ? '单字句' : '     ',
      JSON.stringify(r.en),
      '| ' + (r.cn || '')
    ].join('\t'));
  });
  const extra = [];
  decks.forEach((d) => d.sentences.forEach((s) => { if (!bookSec.some((r) => norm(r.en) === norm(s))) extra.push(d.id + ' ' + JSON.stringify(s)); }));
  if (extra.length) { console.log('  [!] deck 收录但书里没有：'); extra.forEach((e) => console.log('      ' + e)); }
  const unresolved = dedup.filter((s) => CS.wordCount(s) === 1);
  if (unresolved.length) console.log('  [i] 单字句 ' + unresolved.length + ' 条（可切 1 段）：' + unresolved.join(' / '));
  process.exit(0);
}

/* ---------- 生成 spec ---------- */
const outPath = args[1];
const partFiles = args.slice(2);
if (!partFiles.length) { console.error('缺 parts 文件'); process.exit(2); }
let parts = [];
for (const f of partFiles) parts = parts.concat(JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8')));

if (parts.length !== dedup.length) {
  console.error('✗ parts 条数 ' + parts.length + ' ≠ 应铺句数 ' + dedup.length);
  const n = Math.min(parts.length, dedup.length);
  for (let i = Math.max(0, n - 3); i < Math.max(parts.length, dedup.length); i++) {
    console.error('  #' + i + ' parts=' + JSON.stringify(parts[i] && parts[i][0]) + '  书=' + JSON.stringify(dedup[i]));
  }
  process.exit(1);
}
let bad = 0;
parts.forEach((p, i) => {
  if (norm(p[0].join('')) !== norm(dedup[i])) {
    bad++;
    console.error('✗ #' + (i + 1) + ' 与书句不符');
    console.error('   parts: ' + JSON.stringify(p[0]) + ' → ' + norm(p[0].join('')));
    console.error('   书句 : ' + JSON.stringify(dedup[i]) + ' → ' + norm(dedup[i]));
  }
});
if (bad) { console.error('共 ' + bad + ' 处不符（按序配对，错位/漏词都会在这里暴露）'); process.exit(1); }

const spec = parts.map(([chunks, hints], i) => ({ sentence: dedup[i], chunks, hints }));
fs.writeFileSync(path.resolve(ROOT, outPath), JSON.stringify(spec, null, 1) + '\n', 'utf8');
console.log('✓ 已写 ' + outPath + '  ' + spec.length + ' 条（translation 由 gen-fast-content 从书里取）');
/* 顺带提示还未翻译的句子数（书里 cn 为空） */
const noCn = spec.filter((s) => !cnByNorm.get(norm(s.sentence))).length;
if (noCn) console.log('  ! 其中 ' + noCn + ' 条的书中译为空（gen-fast-content 会写空 translation）');
