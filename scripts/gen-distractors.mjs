/**
 * scripts/gen-distractors.mjs · D-pipeline：LLM 干扰项打包 CLI（2026-09-08）
 *
 * 目标：把「D-schema 预置干扰项 it.distractors[i]」从零生产变成一条可幂等重跑的打包管线。
 * 读种子库数据文件 → 找出缺 distractors 的句子 → 逐句调 LLM 生成每 chunk 近失干扰项
 * → 清洗校验（js/distractor-validate.mjs）→ 原位写回 .js/.json（.bak 备份 + git 可 diff）。
 *
 * 用法：
 *   node scripts/gen-distractors.mjs freq-idioms.js            # dry-run：只打印待生成计划
 *   node scripts/gen-distractors.mjs freq-idioms.js --limit 3 --go --key sk-xxx
 *   node scripts/gen-distractors.mjs extra/foo.json --go
 *   node scripts/gen-distractors.mjs oral8000.js --limit 5 --go --out /tmp/o.js   # 不写原位，输出新文件（审查用）
 *
 * 参数：
 *   <file>       目标数据文件（.js 沙箱解析 window.DATA_*；.json 需为数组）
 *   --limit N    最多处理 N 句（按文件顺序，跳过已具备 distractors 的句）
 *   --go         联网生成并写回；缺省 = dry-run（不联网不写）
 *   --out FILE   写回 FILE 而非原位（审查用；与原位同规则）
 *   --model M    LLM 模型名（默认 deepseek-chat）
 *   --key K      DeepSeek API Key（优先级：--key > env DEEPSEEK_API_KEY > server/.env）
 *   --mock JSON  短路返回该完整上游响应（测试用，等价 env AI_MOCK_RESPONSE）
 *   --seed FILE  作者直供模式：JSON 数组 [{sentence, distractors:[[...],...]}]，不调 LLM，
 *                逐句过 cleanDistractors 校验后走同一写回链路（离线命题/人工精修用；
 *                与 --go 互斥，给 seed 即生效）
 *
 * 幂等：句子级跳过 —— 已有 distractors 且至少一个非空 chunk 位即视为已生成。
 * 写回安全：.js 用「文本精确插行」（explanations 闭合 ] 后补字段），不改动其余字节；
 *           写后回读沙箱复解析确认仍可解析，写坏立即报错。
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildDistractorPrompt } from '../js/ai-prompts.mjs';
import { parseDistractorText, cleanDistractors } from '../js/distractor-validate.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(import.meta.dirname, '..');

/* ---------------- 参数与环境 ---------------- */
function parseArgs(argv) {
  const a = { file: null, limit: null, go: false, out: null, model: 'deepseek-chat', key: null, mock: null, seed: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--go') a.go = true;
    else if (v === '--limit') a.limit = parseInt(argv[++i], 10);
    else if (v === '--out') a.out = argv[++i];
    else if (v === '--model') a.model = argv[++i];
    else if (v === '--key') a.key = argv[++i];
    else if (v === '--mock') a.mock = argv[++i];
    else if (v === '--seed') a.seed = argv[++i];
    else if (v.startsWith('-')) { console.error('❌ 未知参数: ' + v); process.exit(2); }
    else a.file = v;
  }
  return a;
}

/* server/.env 简易解析（仅取 DEEPSEEK_API_KEY；不覆盖已存在的 env） */
function envFromDotEnv() {
  const p = path.join(ROOT, 'server', '.env');
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/^\s*DEEPSEEK_API_KEY\s*=\s*(.+?)\s*$/m);
  if (!m) return;
  if (process.env.DEEPSEEK_API_KEY) return;
  process.env.DEEPSEEK_API_KEY = m[1].replace(/^["']|["']$/g, '');
}

/* ---------------- 数据文件读取 ---------------- */
/* .js 种子库：沙箱执行取 window.DATA_* 数组（先例：inject-freq-idioms.js assertNoDup） */
function loadJsData(filePath) {
  const file = fs.readFileSync(filePath, 'utf8');
  try {
    new Function('window', file); /* 仅编译（parse check）防坏文件 */
  } catch (e) {
    console.error('❌ ' + filePath + ' 当前不可解析（' + e.message + '）。已中止——先修复目标文件。');
    process.exit(1);
  }
  const sandbox = { BUILTIN: { push() {} }, console };
  new Function('window', file)(sandbox);
  const keys = Object.keys(sandbox).filter(function (k) { return /^DATA_[A-Z0-9_]+$/.test(k) && Array.isArray(sandbox[k]); });
  if (!keys.length) {
    console.error('❌ ' + filePath + ' 沙箱执行后未取到 window.DATA_* 数组。已中止。');
    process.exit(1);
  }
  if (keys.length > 1) {
    console.error('❌ ' + filePath + ' 含多个 DATA_* 数组（' + keys.join(', ') + '）。请指定明确数据文件。');
    process.exit(1);
  }
  return { file: file, dataVar: keys[0], items: sandbox[keys[0]] };
}

/* .json：要求根为数组 */
function loadJsonData(filePath) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error('❌ ' + filePath + ' JSON 解析失败：' + e.message); process.exit(1); }
  if (!Array.isArray(arr)) { console.error('❌ ' + filePath + ' 根不是数组'); process.exit(1); }
  return { file: fs.readFileSync(filePath, 'utf8'), dataVar: null, items: arr };
}

/* ---------------- 幂等判定 ---------------- */
/* 已有 distractors 且至少一个 chunk 位非空 → 已生成，跳过 */
function needGen(it) {
  return !Array.isArray(it.distractors) ||
    !it.distractors.some(function (slot) { return Array.isArray(slot) && slot.length > 0; });
}

/* ---------------- .js 精确插行写回 ---------------- */
/* 每条目 compact 布局（itemToJs 同构，explanations 恒为末字段）：
 *     explanations: [
 *       "..."
 *     ]
 *   },
 * 插点：explanations 闭合行（^    ]$）→ 加逗号 + 新 distractors 行。
 * 多条目从后往前应用，避免行号偏移。 */
function enrichJsText(fileText, generated /* [{sentence, distractors}] */) {
  const lines = fileText.split('\n');
  const edits = [];
  generated.forEach(function (g) {
    const needle = '    sentence: ' + JSON.stringify(g.sentence) + ',';
    let idx = lines.findIndex(function (l) { return l === needle; });
    if (idx === -1) { console.error('❌ 找不到句子行（跳过写回）: ' + g.sentence); return; }
    /* explanations 闭合锚点：条内首个 ^    ]$（4 空格 + ]；grammar 闭合带逗号不命中） */
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^    \]$/.test(lines[i])) {
        const json = JSON.stringify(g.distractors);
        edits.push({ at: i, text: lines[i] + ',\n    distractors: ' + json });
        return;
      }
      /* 越界护栏：500 行内找不到 = 条目结构异常，中止该条 */
      if (i - idx > 500) { console.error('❌ 句子条目结构异常（无 explanations 闭合）: ' + g.sentence); return; }
    }
  });
  /* 后往前应用 */
  edits.sort(function (a, b) { return b.at - a.at; });
  let out = fileText;
  edits.forEach(function (e) {
    const ls = out.split('\n');
    ls[e.at] = e.text;
    out = ls.join('\n');
  });
  return out;
}

/* 写回 + 回读校验（.js 沙箱复解析 + 条数核对；.json JSON.parse） */
function writeBack(filePath, text, items, expected /* [{sentence, distractors}] */) {
  /* 备份到 output/backups（gitignored） */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bkDir = path.join(ROOT, 'output', 'backups');
  fs.mkdirSync(bkDir, { recursive: true });
  fs.copyFileSync(filePath, path.join(bkDir, path.basename(filePath) + '.' + ts + '.bak'));
  fs.writeFileSync(filePath, text, 'utf8');

  /* 回读校验 */
  let okCount = 0;
  if (/\.js$/.test(filePath)) {
    const after = fs.readFileSync(filePath, 'utf8');
    try { new Function('window', after); }
    catch (e) { console.error('❌ 写回后文件解析失败（' + e.message + '）——立即 git 回滚！'); process.exit(1); }
    const sandbox = { BUILTIN: { push() {} }, console };
    new Function('window', after)(sandbox);
    const arr = Object.keys(sandbox).filter(function (k) { return Array.isArray(sandbox[k]); }).map(function (k) { return sandbox[k]; })[0] || [];
    expected.forEach(function (g) {
      const hit = arr.find(function (it) { return it.sentence === g.sentence; });
      if (hit && JSON.stringify(hit.distractors) === JSON.stringify(g.distractors)) okCount++;
      else console.error('❌ 回读未匹配: ' + g.sentence);
    });
  } else {
    const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expected.forEach(function (g) {
      const hit = arr.find(function (it) { return it.sentence === g.sentence; });
      if (hit && JSON.stringify(hit.distractors) === JSON.stringify(g.distractors)) okCount++;
      else console.error('❌ 回读未匹配: ' + g.sentence);
    });
  }
  if (okCount !== expected.length) {
    console.error('❌ 回读校验失败（' + okCount + '/' + expected.length + '）——立即 git 回滚！');
    process.exit(1);
  }
  console.log('✅ 写回完成并回读校验通过：' + okCount + ' 句 → ' + filePath);
}

/* ---------------- LLM 调用 ---------------- */
async function callLlm(args, key, prompt) {
  const ai = require('../server/ai.js');
  const payload = {
    model: args.model,
    messages: [
      { role: 'system', content: '你是资深英语命题专家，只返回 JSON。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  };
  const r = await ai.callDeepSeekRetry(payload, key);
  if (r.status !== 200) throw new Error('上游返回 ' + r.status + '：' + String(r.raw).slice(0, 300));
  const data = JSON.parse(r.raw);
  const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  return String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
}

/* ---------------- main ---------------- */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('用法: node scripts/gen-distractors.mjs <file.js|file.json> [--limit N] [--go] [--out FILE] [--model M] [--key K] [--seed seed.json]');
    process.exit(2);
  }
  const filePath = path.resolve(ROOT, args.file);
  if (!fs.existsSync(filePath)) { console.error('❌ 文件不存在: ' + filePath); process.exit(2); }

  const isJs = /\.js$/.test(filePath);
  const loaded = isJs ? loadJsData(filePath) : loadJsonData(filePath);
  const items = loaded.items;

  /* 种子直供模式：不走 LLM/key/dry-run，直接清洗 + 写回 */
  if (args.seed) { await runSeed(args, loaded); return; }

  /* 计划：缺 distractors 的句子（按文件顺序，可 --limit 截取） */
  const todo = [];
  for (const it of items) {
    if (!it || !it.sentence || !Array.isArray(it.chunks) || !it.chunks.length) continue;
    if (!needGen(it)) continue;
    todo.push(it);
    if (args.limit && todo.length >= args.limit) break;
  }
  const chunkSlots = todo.reduce(function (n, it) { return n + it.chunks.length; }, 0);
  console.log('目标文件: ' + filePath + '（' + (isJs ? loaded.dataVar : 'JSON') + '，共 ' + items.length + ' 句）');
  console.log('待生成: ' + todo.length + ' 句 / ' + chunkSlots + ' 个 chunk 位' + (args.limit ? '（--limit ' + args.limit + '）' : ''));

  if (!args.go) {
    console.log('\n(dry-run) 未加 --go，不联网不写回。确认后加 --go 执行。');
    if (todo.length) {
      console.log('前 5 句预览:');
      todo.slice(0, 5).forEach(function (it, i) { console.log('  [' + (i + 1) + '] ' + it.sentence + '（chunks ' + it.chunks.length + '）'); });
    }
    process.exit(0);
  }

  /* Key 探测：--key > env > server/.env；mock 模式（--mock / env AI_MOCK_RESPONSE）无需 key */
  envFromDotEnv();
  const key = args.key || process.env.DEEPSEEK_API_KEY || '';
  if (args.mock) process.env.AI_MOCK_RESPONSE = args.mock;
  const hasMock = !!process.env.AI_MOCK_RESPONSE;
  if (!key && !hasMock) {
    console.error('❌ 未配置 DEEPSEEK_API_KEY（--key / env / server/.env 三选一）。');
    process.exit(2);
  }

  if (!todo.length) { console.log('🎉 全部句子已具备 distractors，无需生成。'); process.exit(0); }

  /* 逐句生成（串行 + 200ms 节流，避免撞上游限流） */
  const generated = [];
  const errors = [];
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    const prompt = buildDistractorPrompt(it);
    const tag = '[' + (i + 1) + '/' + todo.length + '] ' + it.sentence;
    try {
      const text = await callLlm(args, key, prompt);
      const parsed = parseDistractorText(text);
      if (!parsed.ok) throw new Error(parsed.error);
      const clean = cleanDistractors(it, parsed.data.distractors);
      const got = clean.stats.perChunk.reduce(function (a, b) { return a + b; }, 0);
      if (got === 0) throw new Error('清洗后 0 条（received ' + clean.stats.received + '，dropped ' + clean.stats.dropped + '）');
      it.distractors = clean.distractors;
      generated.push({ sentence: it.sentence, distractors: clean.distractors });
      console.log('  ✓ ' + tag + ' → ' + clean.stats.perChunk.join('/') + ' 条/位（丢 ' + clean.stats.dropped + '）');
    } catch (e) {
      errors.push({ sentence: it.sentence, error: e.message });
      console.log('  ✗ ' + tag + ' → ' + e.message);
    }
    await new Promise(function (res) { setTimeout(res, 200); });
  }

  console.log('\n生成完成：成功 ' + generated.length + ' / ' + todo.length + (errors.length ? '，失败 ' + errors.length + '（可原样重跑续传）' : ''));
  if (errors.length) errors.slice(0, 5).forEach(function (e) { console.log('    ✗ ' + e.sentence + ' :: ' + e.error); });

  if (!generated.length) { console.log('无成功条目，未写回。'); process.exit(1); }

  /* 写回：原位或 --out */
  const dest = args.out ? path.resolve(ROOT, args.out) : filePath;
  let text;
  if (isJs) text = enrichJsText(loaded.file, generated);
  else {
    const arr = JSON.parse(loaded.file);
    generated.forEach(function (g) {
      const hit = arr.find(function (it) { return it.sentence === g.sentence; });
      if (hit) hit.distractors = g.distractors;
    });
    text = JSON.stringify(arr, null, 2) + '\n';
  }
  writeBack(dest, text, items, generated);
}

/* ---------------- 种子直供（--seed，离线命题/人工精修） ---------------- */
/* seed JSON: [{ sentence, distractors:[[...],[...],...] }] —— 不调 LLM，
   逐条 cleanDistractors 清洗后与 LLM 路径共用写回。 */
async function runSeed(args, loaded) {
  const seedPath = path.resolve(ROOT, args.seed);
  let seed;
  try { seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')); }
  catch (e) { console.error('❌ seed JSON 解析失败：' + e.message); process.exit(1); }
  if (!Array.isArray(seed)) { console.error('❌ seed 根必须是数组'); process.exit(1); }

  const bySentence = new Map(loaded.items.map(function (it) { return [it.sentence, it]; }));
  const generated = [];
  const errors = [];
  seed.forEach(function (s, i) {
    const it = bySentence.get(s.sentence);
    const tag = '[' + (i + 1) + '/' + seed.length + '] ' + s.sentence;
    if (!it) { errors.push({ sentence: s.sentence, error: '目标文件无此句' }); console.log('  ✗ ' + tag + ' → 目标文件无此句'); return; }
    if (!needGen(it)) { console.log('  - ' + tag + ' → 已具备 distractors，跳过'); return; }
    const clean = cleanDistractors(it, s.distractors);
    const got = clean.stats.perChunk.reduce(function (a, b) { return a + b; }, 0);
    if (got === 0) { errors.push({ sentence: s.sentence, error: '清洗后 0 条（received ' + clean.stats.received + '，dropped ' + clean.stats.dropped + '）' }); console.log('  ✗ ' + tag + ' → 清洗后 0 条（dropped ' + clean.stats.dropped + '）'); return; }
    it.distractors = clean.distractors;
    generated.push({ sentence: it.sentence, distractors: clean.distractors });
    console.log('  ✓ ' + tag + ' → ' + clean.stats.perChunk.join('/') + ' 条/位（丢 ' + clean.stats.dropped + '）');
  });

  console.log('\nseed 处理完成：成功 ' + generated.length + ' / ' + seed.length + (errors.length ? '，失败/跳过 ' + errors.length + '（见上）' : ''));
  if (!generated.length) { console.log('无成功条目，未写回。'); process.exit(1); }

  /* 与 LLM 路径共用写回 */
  const filePath = path.resolve(ROOT, args.file);
  const isJs = /\.js$/.test(filePath);
  const dest = args.out ? path.resolve(ROOT, args.out) : filePath;
  let text;
  if (isJs) text = enrichJsText(loaded.file, generated);
  else {
    const arr = JSON.parse(loaded.file);
    generated.forEach(function (g) {
      const hit = arr.find(function (it) { return it.sentence === g.sentence; });
      if (hit) hit.distractors = g.distractors;
    });
    text = JSON.stringify(arr, null, 2) + '\n';
  }
  writeBack(dest, text, loaded.items, generated);
}

main().catch(function (e) { console.error('❌ 未捕获异常: ' + (e && e.stack || e)); process.exit(1); });
