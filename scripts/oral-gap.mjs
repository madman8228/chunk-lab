/**
 * oral-gap.mjs · 按「节」核书句缺口（只读盘点工具，2026-09-16 立）
 *
 * 为什么需要：
 *   判断「还剩哪些节没铺完」原先靠临时脚本（output/_gap.mjs），而 output/ 不进 git
 *   → 每次重建、每次重新发明，且口径可能与 book-section.mjs 漂移。
 *   本工具直接 import 唯一口径（loadBookSection），把盘点固化成一条命令：
 *     node scripts/oral-gap.mjs
 *
 * 口径：
 *   need = 该节应铺句数（book-section.mjs 的 dedup，唯一实现）
 *   have = extra/oral-book/content/oral-<ch>-<sec>.json 条数
 *   gap  = need - have
 *     gap > 0  该节还有书句未铺
 *     gap = 0  铺满
 *     gap < 0  ⚠️ 不是错：书里**跨节重复句**（同一句被两节的书序各收一次，
 *              deck 归属只挂其中一节，但两节 content 都含它）→ 无害冗余，别删
 *
 * ⚠️ 只看 need/have 的**总数**会被 gap<0 的节抵掉一点（1.7 / 6.31 各 -1）→
 *    与 output/oral-book-report.md 的「进度」段可能差 1~2 句，属正常。
 */
import fs from 'node:fs';
import { loadBookSection } from './book-section.mjs';

const ROOT = process.cwd();
const B = JSON.parse(fs.readFileSync('extra/oral-book/book.json', 'utf8'));
const keys = [...new Set(B.map((r) => r.ch + '.' + r.sec))];
const secTitle = new Map();
B.forEach((r) => { if (!secTitle.has(r.ch + '.' + r.sec)) secTitle.set(r.ch + '.' + r.sec, r.secTitle); });

let need = 0; let have = 0; const rows = [];
for (const k of keys) {
  const [ch, sec] = k.split('.').map(Number);
  const { dedup } = loadBookSection(ROOT, ch, sec);
  const f = 'extra/oral-book/content/oral-' + ch + '-' + sec + '.json';
  const n = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).length : 0;
  need += dedup.length;
  have += Math.min(n, dedup.length);
  rows.push({ k, title: secTitle.get(k), need: dedup.length, have: n, gap: dedup.length - n });
}

const full = rows.filter((r) => r.gap <= 0).length;
console.log('节数 ' + rows.length + ' / 已铺满 ' + full);
console.log('总计 need=' + need + ' have=' + have + ' 缺口=' + (need - have)
  + ' 完成度=' + (need ? (have / need * 100).toFixed(1) : '0') + '%');
console.log('');
console.log('未铺满的节（按缺口降序）：');
const pending = rows.filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap);
pending.forEach((r) => console.log('  ' + r.k.padEnd(6) + ' ' + String(r.gap).padStart(4) + ' 缺'
  + '  (应铺 ' + r.need + ' / 已铺 ' + r.have + ')  ' + (r.title || '')));
if (!pending.length) console.log('  （无）');
const odd = rows.filter((r) => r.gap < 0);
if (odd.length) {
  console.log('');
  console.log('冗余（gap<0，书内跨节重复，无害，别删）：');
  odd.forEach((r) => console.log('  ' + r.k + ' gap=' + r.gap + '  ' + (r.title || '')));
}
