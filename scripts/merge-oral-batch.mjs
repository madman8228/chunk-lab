/* merge-oral-batch.mjs · 把批次数据源合并进 oral8000.js
 *
 * ⚠️ 已废弃（2026-09-15）：口语 8000 的唯一内容源迁到 oral-book.js，oral8000.js 是空壳。
 *   本脚本因此 fail-closed 拒绝运行。新内容走
 *   extra/oral-book/content/oral-<章>-<节>.json → node output/gen-oral-book.mjs
 *   → node scripts/build-content.mjs → node validate_oral_book.js
 *
 * 运行：
 *   node scripts/merge-oral-batch.mjs --scene=h extra/oral-batch7-1.js --dry-run
 *   node scripts/merge-oral-batch.mjs extra/oral-batch7-1.js          # 由源文件声明场景
 *
 * 2026-09-15 起：oral8000.js 已按场景拆分，每条新句都要有场景归属 ——
 *   - 源文件顶部写 `var ORAL_BATCH_SCENE = 'h';`（一个文件一个场景），或
 *   - 命令行 `--scene=<h|s|c|b|e|w>` 统一指定（优先级高于源文件声明）
 *   场景 key：h 居家生活 / s 外出社交 / c 日常闲聊 / b 口头禅万能 / e 情感表达 / w 职场商务
 *
 * 设计要点：
 *   - 批数据源是 JS：`var ORAL_BATCH = [...]`（grammar 用无引号键，与 oral8000.js 一致）
 *   - 序列化复用既有 compact 风格；字符串里的真实换行还原为 \n 转义
 *   - cid 由 fnv8(sentence) 现算（与 core.js / add-cids.js 一致）
 *   - 去重：norm(sentence) 撞既有库或 cid 撞既有库 → 跳过并报告
 *   - 同时维护两个「等长」数组：DATA_ORAL8000（题目）与 DATA_ORAL8000_SCENES（场景 key）
 *   - 收尾用「括号配平扫描」定位：拆分后文件里有两处 `];`，不能再靠 `];` 唯一
 *
 * 幂等：重复跑不会重复插入（第二遍全部命中"已存在"而跳过）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm } from '../js/chunk-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'oral8000.js');
const DRY = process.argv.includes('--dry-run');
const sceneFlag = process.argv.find((a) => a.startsWith('--scene='));
const CLI_SCENE = sceneFlag ? sceneFlag.slice('--scene='.length).trim() : '';
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (!files.length) {
  console.error('用法: node scripts/merge-oral-batch.mjs [--scene=h] <batch.js> [...] [--dry-run]');
  process.exit(2);
}

const VALID_SCENES = {
  h: 'daily-home', s: 'daily-social', c: 'daily-chat',
  b: 'daily-basic', e: 'daily-emotion', w: 'daily-work',
};
if (CLI_SCENE && !VALID_SCENES[CLI_SCENE]) {
  console.error('--scene 只能是 h / s / c / b / e / w，收到：' + CLI_SCENE);
  process.exit(2);
}

function fnv8(str) {
  let h = 0x811c9dc5;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}

/* 双引号字符串：先转义反斜杠，再转义引号，最后把真实换行还原成 \n 转义 */
function dq(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n') + '"';
}
/* 单引号字符串（grammar 字段用） */
function sq(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
}
function dqList(arr) { return '[' + arr.map(dq).join(',') + ']'; }

function serialize(it) {
  const L = [];
  L.push('  {');
  L.push('    sentence: ' + dq(it.sentence) + ',');
  L.push('    cid: ' + dq(fnv8(it.sentence)) + ',');
  L.push('    translation: ' + dq(it.translation) + ',');
  L.push('    chunks: ' + dqList(it.chunks) + ',');
  L.push('    hints: ' + dqList(it.hints) + ',');
  if (it.alts) {
    L.push('    alts: [' + it.alts.map((a) => (a === null ? 'null' : dqList(a))).join(', ') + '],');
  }
  L.push('    grammar: [');
  it.grammar.forEach((g, i) => {
    L.push("      {role:" + sq(g.role) + ',color:' + sq(g.color) + ',phonetic:[' +
      g.phonetic.map(sq).join(',') + '],pos:' + sq(g.pos) + ',meaning:' + sq(g.meaning) + '}' +
      (i < it.grammar.length - 1 ? ',' : ''));
  });
  L.push('    ],');
  L.push('    explanations: [');
  it.explanations.forEach((e, i) => {
    L.push('      ' + dq(e) + (i < it.explanations.length - 1 ? ',' : ''));
  });
  L.push('    ],');
  L.push('    distractors: [' + it.distractors.map(dqList).join(',') + ']');
  L.push('  }');
  return L.join('\n');
}

/* 括号配平定位数组字面量的起止（带字符串/转义状态），返回 `]` 的下标 */
function findArrayEnd(src, name) {
  const re = new RegExp('window\\.' + name + '\\s*=\\s*\\[');
  const m = re.exec(src);
  if (!m) throw new Error('找不到 window.' + name + ' = [');
  const start = src.indexOf('[', m.index);
  let depth = 0;
  let inStr = false;
  let quote = '';
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; quote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return i; }
  }
  throw new Error('window.' + name + ' 数组未闭合');
}

/* ---- 载入既有库（用真实 builtins.js，避免桩的 deck id 与实际脱节） ---- */
global.window = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'builtins.js'), 'utf8'))(global.window);
new Function('window', fs.readFileSync(TARGET, 'utf8'))(global.window);
const existing = global.window.DATA_ORAL8000;
const existingScenes = global.window.DATA_ORAL8000_SCENES;
if (!Array.isArray(existing)) throw new Error('oral8000.js 未导出 DATA_ORAL8000');
if (!Array.isArray(existingScenes) || existingScenes.length !== existing.length) {
  throw new Error('oral8000.js 的 DATA_ORAL8000_SCENES 缺失或长度与 DATA_ORAL8000 不一致');
}
/* ★ fail-closed（2026-09-15）：口语 8000 已迁到 oral-book.js 唯一内容源，
   oral8000.js 成了空壳。此时本脚本若继续跑，会把新句写进**空壳**、而 build-content
   只读 oral-book.js → 内容静默丢失（写成功但线上永远看不到）。宁可报错也不要静默写入。 */
if (!existing.length) {
  throw new Error(
    'oral8000.js 已是空壳（0 条）—— 口语 8000 的唯一内容源已迁到 oral-book.js。\n' +
    '  新内容请走：extra/oral-book/content/oral-<章>-<节>.json → node output/gen-oral-book.mjs' +
    ' → node scripts/build-content.mjs → node validate_oral_book.js'
  );
}

const oldNorm = new Map();
const oldCid = new Map();
for (const it of existing) {
  const n = norm(it.sentence);
  if (n && !oldNorm.has(n)) oldNorm.set(n, it.sentence);
  if (it.cid) oldCid.set(it.cid, it.sentence);
}

/* ---- 读批次并去重 ---- */
const fresh = [];      /* { it, scene } */
const skipped = [];
for (const f of files) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  const src = fs.readFileSync(abs, 'utf8');
  let scene = CLI_SCENE;
  if (!scene) {
    const m = /var\s+ORAL_BATCH_SCENE\s*=\s*['"]([a-zA-Z])['"]/.exec(src);
    if (!m) {
      throw new Error(path.basename(abs) + ' 未声明场景：请在源文件顶部加 var ORAL_BATCH_SCENE = \'h\'; 或命令行传 --scene=<h|s|c|b|e|w>');
    }
    scene = m[1];
  }
  if (!VALID_SCENES[scene]) throw new Error(path.basename(abs) + ' 场景 key 非法：' + scene);
  const items = new Function(src + '\nreturn ORAL_BATCH;')();
  console.log('[' + path.basename(abs) + '] ' + items.length + ' 条 → 场景 ' + scene + ' (' + VALID_SCENES[scene] + ')');
  for (const it of items) {
    const n = norm(it.sentence);
    const cid = fnv8(it.sentence);
    if (oldNorm.has(n)) { skipped.push({ why: 'norm 已存在于 ' + oldNorm.get(n), sentence: it.sentence }); continue; }
    if (oldCid.has(cid)) { skipped.push({ why: 'cid 已存在于 ' + oldCid.get(cid), sentence: it.sentence }); continue; }
    oldNorm.set(n, it.sentence);
    oldCid.set(cid, it.sentence);
    fresh.push({ it, scene });
  }
}

console.log('\n本次合并 ' + fresh.length + ' 条；跳过 ' + skipped.length + ' 条');
skipped.forEach((s) => console.log('  ⤵ 跳过「' + s.sentence + '」 — ' + s.why));
if (!fresh.length) {
  console.log('无新增，未改动目标文件（幂等）。');
  process.exit(0);
}
const sceneCount = {};
fresh.forEach(({ scene }) => { sceneCount[scene] = (sceneCount[scene] || 0) + 1; });
console.log('场景分布：' + Object.entries(sceneCount).map(([k, v]) => k + '×' + v).join('  '));

/* ---- 插入 ---- */
let text = fs.readFileSync(TARGET, 'utf8');
const EOL = text.includes('\r\n') ? '\r\n' : '\n';
console.log('目标文件行尾: ' + (EOL === '\r\n' ? 'CRLF' : 'LF'));

/* 两个数组分别定位（拆分后有 DATA_ORAL8000 与 DATA_ORAL8000_SCENES 两处 `]`）。
   ⚠️ 必须「先改靠后的 SCENES，再改靠前的 DATA」—— 否则前一次插入会让后一个下标失准。 */
const scenesEnd = findArrayEnd(text, 'DATA_ORAL8000_SCENES');
const dataEnd = findArrayEnd(text, 'DATA_ORAL8000');
if (!(scenesEnd > dataEnd)) throw new Error('数组位置异常：SCENES 应在 DATA 之后');

function insertBeforeClose(src, endIdx, block) {
  /* 在 `]` 之前的最后一个换行处断开，保证「前一项补逗号 + 新块」语义正确 */
  const head = src.slice(0, endIdx);
  const nlAt = head.lastIndexOf('\n');
  if (nlAt < 0) throw new Error('数组收尾格式异常（找不到换行）');
  return src.slice(0, nlAt) + block + src.slice(nlAt);
}

/* ① 场景数组：一行 40 个 key 追加 */
const sceneKeys = fresh.map(({ scene }) => scene);
const sceneLines = [];
for (let i = 0; i < sceneKeys.length; i += 40) {
  sceneLines.push('  ' + sceneKeys.slice(i, i + 40).map((k) => "'" + k + "'").join(', '));
}
text = insertBeforeClose(text, scenesEnd, ',' + EOL + sceneLines.join(',' + EOL));

/* ② 题目数组：插入新条目（重新定位 DATA 的收尾——前面没动它，但仍以配平结果为准） */
const dataEnd2 = findArrayEnd(text, 'DATA_ORAL8000');
const block = fresh.map(({ it }) => serialize(it)).join(',' + EOL).replace(/\n/g, EOL);
text = insertBeforeClose(text, dataEnd2, ',' + EOL + block);

/* ---- 同步文件头说明 ----
   ⚠️ 原实现把「种子库 v2，150 句」写死，只在第一次合并时命中；
   第二次起静默变成 no-op（报告「文件头命中：false」但没人看）→ 句数说明长期漂移。
   这里改成版本/句数无关的两处替换，并分别报告命中结果，避免再次静默失效。 */
const newTotal = existing.length + fresh.length;
let hitHead = false;
let hitDesc = false;
text = text.replace(/种子库 v\d+，\d+ 句/, (m) => {
  hitHead = true;
  return m.replace(/，\d+ 句$/, '，' + newTotal + ' 句');
});
text = text.replace(/window\.DATA_ORAL8000（\d+ 句/, () => {
  hitDesc = true;
  return 'window.DATA_ORAL8000（' + newTotal + ' 句';
});
const headerAdded = hitHead && hitDesc;
const headerNote = '（文件头：句数 ' + (hitHead ? '✓' : '✗') + ' / 说明 ' + (hitDesc ? '✓' : '✗') + '）';

if (DRY) {
  console.log('\n[--dry-run] 将新增 ' + fresh.length + ' 条，句数 ' + existing.length + ' → ' + newTotal +
    headerNote);
  console.log('预览第一条：\n' + serialize(fresh[0].it));
  console.log('预览场景数组尾：\n' + sceneLines.join('\n'));
  process.exit(0);
}

fs.writeFileSync(TARGET, text, 'utf8');
console.log('\n✓ 已写入 oral8000.js：' + existing.length + ' → ' + newTotal + ' 条（同步追加 ' + fresh.length + ' 个场景 key）' + headerNote);
if (!headerAdded) {
  console.warn('⚠️ 未命中文件头说明的任一处 —— 请手工补齐句数与批次说明');
}
console.log('下一步：node scripts/add-cids.js && node validate_oral8000.js && node validate_distractors.js && node scripts/build-content.mjs');
