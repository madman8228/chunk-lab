/**
 * gen-fast-content.mjs · 按「节」铺快档内容（可复用工具）
 *
 * 用途：把 extra/oral-book/book.json 的书原文 + 我给的 chunks/hints 定义，合成为
 *       extra/oral-book/content/oral-<章>-<节>.json（快档法定最小件：sentence/translation/chunks/hints）。
 *
 * 为什么要脚本而不是手写 JSON：
 *   ① translation 一律**从书里取**，不手抄 → 不会抄错、不会与原文漂移
 *   ② chunks 拼接 === sentence 当场校验 → 手写极易漏空格/漏标点，靠眼查必翻车
 *   ③ 「本节的应铺句清单」从 decks.json 反查 → 自动列出未铺句，不会静默漏句
 *
 * ⚠️ 输入/输出全部在**入库位** extra/oral-book/（不是 gitignore 的 output/）
 *    —— 新 clone 才能复现这条链。
 *
 * 用法：
 *   node scripts/gen-fast-content.mjs <章>.<节> <spec.json>
 *   spec.json = [{ "sentence": "...", "chunks": ["..",".."], "hints": ["..",".."] }, ...]
 *   未出现在 spec 里的句子 → 打印「未铺」清单（不报错，供分批推进）
 *
 * 退出码：0 = 写文件成功（可能带未铺提示）；1 = 有硬错误（拼接不符 / hints 数不符 / 句不属于本节）
 */
import fs from 'node:fs';
import path from 'node:path';
/* 「最少切几段」的唯一判据（含单字句例外）—— 同目录 */
import CS from './chunk-shape.js';
/* 「本节应铺哪些句」的唯一实现（侦察/配对脚本共用同一份口径） */
import { loadBookSection, norm } from './book-section.mjs';

const ROOT = process.cwd();
/* 书管线输入的入库根 */
const BOOK = 'extra/oral-book';
const [secArg, specPath] = process.argv.slice(2);
if (!secArg || !specPath) {
  console.error('用法: node scripts/gen-fast-content.mjs <章>.<节> <spec.json>');
  process.exit(2);
}
const m = /^(\d+)\.(\d+)$/.exec(secArg);
if (!m) { console.error('节号格式应为 <章>.<节>，如 6.34'); process.exit(2); }
const ch = Number(m[1]);
const sec = Number(m[2]);

const spec = JSON.parse(fs.readFileSync(path.resolve(ROOT, specPath), 'utf8'));

const joined = (a) => a.join('').replace(/\s+/g, '');

/* 本节在书里的全部句子（书序）+ 中文 + 应铺句清单 —— 口径唯一实现见 book-section.mjs */
const { bookSec, decks, inScope, dedup, cnByNorm } = loadBookSection(ROOT, ch, sec);
if (!bookSec.length) { console.error('书里没有第 ' + secArg + ' 节'); process.exit(1); }

console.log('第 ' + secArg + ' 节「' + bookSec[0].secTitle + (bookSec[0].topic ? ' · ' + bookSec[0].topic : '') + '」');
console.log('  书内 ' + bookSec.length + ' 句（去重 ' + new Set(bookSec.map((r) => norm(r.en))).size + '）'
  + ' / 本节的 deck ' + decks.map((d) => d.id).join('+') + ' 收录 ' + dedup.length + ' 句');

/* ---------- 校验 spec ---------- */
const errs = [];
const warns = [];
const out = [];
const seen = new Set();
spec.forEach((it, i) => {
  const tag = '#' + i + ' ' + (it.sentence || '?');
  if (!it.sentence) { errs.push(tag + ' 缺 sentence'); return; }
  const k = norm(it.sentence);
  if (!cnByNorm.has(k)) { errs.push(tag + ' 不在书第 ' + secArg + ' 节内'); return; }
  if (!inScope.has(k)) warns.push(tag + ' 不在本 deck 的句清单（book-dedup 归到别节了，装配时会忽略）');
  if (seen.has(k)) { errs.push(tag + ' 与前面某条重复'); return; }
  seen.add(k);
  if (!Array.isArray(it.chunks) || !it.chunks.length) { errs.push(tag + ' 缺 chunks'); return; }
  if (it.chunks.some((c) => typeof c !== 'string' || !c.trim())) { errs.push(tag + ' chunks 含空片'); return; }
  if (!Array.isArray(it.hints) || it.hints.length !== it.chunks.length) { errs.push(tag + ' hints 数与 chunks 不符'); return; }
  if (it.hints.some((h) => typeof h !== 'string' || !h.trim())) { errs.push(tag + ' hints 含空项'); return; }
  const chunkErr = CS.chunkCountError(it.sentence, it.chunks);
  if (chunkErr) { errs.push(tag + ' ' + chunkErr); return; }
  if (joined(it.chunks) !== joined([it.sentence])) {
    errs.push(tag + ' chunks 拼接 ≠ sentence\n       拼接: ' + JSON.stringify(joined(it.chunks)) + '\n       原文: ' + JSON.stringify(joined([it.sentence])));
    return;
  }
  out.push({ sentence: it.sentence, translation: cnByNorm.get(k), chunks: it.chunks, hints: it.hints });
});

const missing = dedup.filter((s) => !seen.has(norm(s)));

console.log('');
if (errs.length) {
  console.log('硬错误 ' + errs.length + ' 处：');
  errs.forEach((e) => console.log('  ✗ ' + e));
}
if (warns.length) {
  console.log('提示 ' + warns.length + ' 处：');
  warns.forEach((w) => console.log('  ! ' + w));
}
if (missing.length) {
  console.log('本节未铺 ' + missing.length + ' 句（按书序）：');
  missing.forEach((s) => {
    const nWords = CS.wordCount(s);
    console.log('  · ' + s + (nWords === 1 ? '   ← 单字句：可切 1 段（Help! → ["Help!"]）' : ''));
  });
}
if (errs.length) { console.log('\n未写文件（先修硬错误）'); process.exit(1); }

/* ---------- 按书序输出 ---------- */
const order = new Map(dedup.map((s, i) => [norm(s), i]));
out.sort((a, b) => (order.get(norm(a.sentence)) ?? 1e9) - (order.get(norm(b.sentence)) ?? 1e9));
const dest = path.join(ROOT, BOOK + '/content/oral-' + ch + '-' + sec + '.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n', 'utf8');
console.log('\n已写 ' + path.relative(ROOT, dest) + '  ' + out.length + ' 句');
