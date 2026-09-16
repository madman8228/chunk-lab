/**
 * scripts/enrich-builtins-seed.mjs · 内置题库干扰项种子写回工具（2026-09-08 建；2026-09-15 适配 6 场景 deck）
 *
 * 为什么独立于 gen-distractors.mjs：
 *   gen-distractors.mjs 的 enrichJsText 针对「window.DATA_* 顶层数组 + 单引号 key + 4 空格」布局
 *   （freq-idioms.js / oral8000.js）；builtins.js 是「window.BUILTIN = [...] JSON 数组区间 +
 *   双引号 key + 2 空格」，文本插行锚点全部不匹配。
 *   但 builtins.js 的数组区间是标准 JSON（已实测 parse 后 JSON.stringify(arr,null,2)
 *   与原文件逐字节一致）→ 用「JSON 手术」：区间 parse → 命中条目写 distractors →
 *   整体 stringify 还原。diff 仅含新增的 distractors 行，零噪音。
 *
 * 用法：
 *   node scripts/enrich-builtins-seed.mjs --seed output/d-c1.json
 *
 * seed JSON: [{ sentence, distractors:[[...],[...],...] }]（与 gen-distractors --seed 同构）
 *   - sentence 必须在内置题库 items 中（6 个场景 deck 任一，否则报错跳过）
 *   - 每句过 cleanDistractors 硬校验（外层长度=chunks、norm 撞车丢弃、位内去重、≤3/位）
 *   - 命中即覆盖（作者直供 = 权威）
 * 安全：写前 .bak 备份到 output/backups（gitignored）；写后回读沙箱复解析 + 条数核对。
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { cleanDistractors } from '../js/distractor-validate.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'builtins.js');

function parseArgs(argv) {
  const a = { seed: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--seed') a.seed = argv[++i];
    else { console.error('❌ 未知参数: ' + v); process.exit(2); }
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.seed) {
    console.error('用法: node scripts/enrich-builtins-seed.mjs --seed <seed.json>');
    process.exit(2);
  }
  const seedPath = path.resolve(ROOT, args.seed);
  let seed;
  try { seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')); }
  catch (e) { console.error('❌ seed JSON 解析失败：' + e.message); process.exit(1); }
  if (!Array.isArray(seed)) { console.error('❌ seed 根必须是数组'); process.exit(1); }

  const fileText = fs.readFileSync(FILE, 'utf8');

  /* 数组区间定位（2026-09-15 起用括号配平）：尾部新增 window.BUILTIN_MIGRATION 后，
     原先的 lastIndexOf('];') 不再可靠；配平扫描带字符串/转义状态，注释或代码里的 ]; 也不会误判。 */
  const assignMatch = /window\.BUILTIN\s*=\s*\[/.exec(fileText);
  if (!assignMatch) { console.error('❌ 找不到 window.BUILTIN = ['); process.exit(1); }
  const arrStart = fileText.indexOf('[', assignMatch.index);
  let arrEnd = -1;
  {
    let depth = 0, inStr = false, quote = '';
    for (let i = arrStart; i < fileText.length; i++) {
      const c = fileText[i];
      if (inStr) { if (c === '\\') { i++; continue; } if (c === quote) inStr = false; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = true; quote = c; continue; }
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
    }
  }
  if (arrEnd < 0) { console.error('❌ BUILTIN 数组未闭合'); process.exit(1); }

  let arr;
  try { arr = JSON.parse(fileText.slice(arrStart, arrEnd + 1)); }
  catch (e) { console.error('❌ BUILTIN 数组区间 JSON 解析失败：' + e.message); process.exit(1); }

  /* ★ 单一数据源：直接以 arr 内 items 为写回对象（JSON 手术 stringify 的就是 arr，
     若另用沙箱解析出 itemsBySentence 会得到不同对象引用 → 写进沙箱对象、序列化 arr 时丢改动）。
     2026-09-15：句子已按场景分布在 6 个 deck → 建「sentence → item」跨 deck 索引。 */
  const itemsBySentence = new Map();
  arr.forEach(function (d) { (d.items || []).forEach(function (it) { if (!itemsBySentence.has(it.sentence)) itemsBySentence.set(it.sentence, it); }); });

  /* 逐句清洗 + 写内存 */
  const applied = []; /* {sentence, distractors:清洗后实际写入值} */
  let okCount = 0;
  seed.forEach(function (s, i) {
    const it = itemsBySentence.get(s.sentence);
    const tag = '[' + (i + 1) + '/' + seed.length + '] ' + s.sentence;
    if (!it) { console.log('  ✗ ' + tag + ' → 内置题库（6 个场景 deck）中无此句'); return; }
    const clean = cleanDistractors(it, s.distractors);
    if (!clean.ok) { console.log('  ✗ ' + tag + ' → ' + clean.error); return; }
    const got = clean.stats.perChunk.reduce(function (a, b) { return a + b; }, 0);
    if (got === 0) { console.log('  ✗ ' + tag + ' → 清洗后 0 条（dropped ' + clean.stats.dropped + '）'); return; }
    it.distractors = clean.distractors;
    applied.push({ sentence: s.sentence, distractors: clean.distractors });
    okCount++;
    console.log('  ✓ ' + tag + ' → ' + clean.stats.perChunk.join('/') + ' 条/位（丢 ' + clean.stats.dropped + '）');
  });

  console.log('\n处理完成：成功 ' + okCount + ' / ' + seed.length);
  if (!okCount) { console.log('无成功条目，未写回。'); process.exit(1); }

  /* 备份 */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bkDir = path.join(ROOT, 'output', 'backups');
  fs.mkdirSync(bkDir, { recursive: true });
  fs.copyFileSync(FILE, path.join(bkDir, 'builtins.js.' + ts + '.bak'));

  /* JSON 手术：整体 stringify 还原（arr 内层对象属性序 = 插入序，distractors 落条目末尾） */
  const newArrText = JSON.stringify(arr, null, 2);
  const newText = fileText.slice(0, arrStart) + newArrText + fileText.slice(arrEnd + 1);
  fs.writeFileSync(FILE, newText, 'utf8');

  /* 回读校验：重新从文件解析，逐句比对 distractors 内容已入库 */
  try {
    const after = fs.readFileSync(FILE, 'utf8');
    const ctx = vm.createContext({ window: {} });
    new vm.Script(after).runInContext(ctx);
    const afterMap = new Map();
    (ctx.window.BUILTIN || []).forEach(function (d) { (d.items || []).forEach(function (it) { if (!afterMap.has(it.sentence)) afterMap.set(it.sentence, it); }); });
    const ok = applied.filter(function (g) {
      const hit = afterMap.get(g.sentence);
      return hit && JSON.stringify(hit.distractors) === JSON.stringify(g.distractors);
    }).length;
    if (ok !== okCount) { console.error('❌ 回读校验失败（' + ok + '/' + okCount + '）——立即 git 回滚！'); process.exit(1); }
  } catch (e) {
    console.error('❌ 写回后解析失败：' + e.message + '——立即 git 回滚！');
    process.exit(1);
  }
  console.log('✅ 写回完成并回读校验通过：' + okCount + ' 句 → ' + FILE);
}

main();
