/* scripts/apply-translation-review.js
 * 把 output/idioms-translation-review.csv 里改过的「译文」列批量写回 freq-idioms.js。
 * 用法：
 *   1. 用 Excel/WPS 打开 output/idioms-translation-review.csv（UTF-8 BOM，中文正常）
 *   2. 只改「译文（可改这列）」列，保存（保持制表符分隔 / 或另存为同一 CSV）
 *   3. node scripts/apply-translation-review.js
 * 行为：按 序号→cid 找到条目，仅覆盖 translation 列；跳过空/未改；写回前跑翻译机检硬拦。
 */
'use strict';
const fs = require('fs');
const tr = require('./translation-rules');

/* 载入当前数据 */
global.window = { BUILTIN: [] };
new Function('window', fs.readFileSync(__dirname + '/../freq-idioms.js', 'utf8'))(global.window);
const arr = global.window.DATA_FREQ_IDIOMS;

const csvPath = __dirname + '/../output/idioms-translation-review.csv';
const lines = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
const header = lines.shift();
const cols = header.split('\t'); // 序号 sentence 译文 idiom块 hints
const zhCol = cols.indexOf('译文（可改这列）');
const seqCol = cols.indexOf('序号');
if (zhCol < 0 || seqCol < 0) { console.error('CSV 列结构不符：需含「序号」「译文（可改这列）」列'); process.exit(1); }

let changed = 0;
let failed = [];
lines.forEach((line, li) => {
  if (!line.trim()) return;
  const cells = line.split('\t');
  const seq = parseInt(cells[seqCol], 10);
  const newZh = (cells[zhCol] || '').trim();
  if (!seq || seq < 1 || seq > arr.length) return;
  const it = arr[seq - 1];
  if (!newZh || newZh === it.translation) return; // 空/未改跳过
  it.translation = newZh;
  const r = tr.checkTranslation(it);
  if (r.errors.length) { failed.push('#' + seq + ' ' + it.sentence + ' → 被拦: ' + r.errors.join('; ')); return; }
  if (r.warnings.length) console.log('⚠ #' + seq + ' 提示: ' + r.warnings.join('; '));
  changed++;
});

if (failed.length) {
  console.error('❌ 以下行被翻译机检拦截，未写入：\n' + failed.join('\n'));
  process.exit(1);
}
if (!changed) { console.log('无改动（CSV 译文列与原数据一致或为空）'); process.exit(0); }

/* 写回：以 fnv8 保持 cid，重建文件体 */
function jsStr(v) { return JSON.stringify(v); }
function itemToJs(it) {
  const L = ['  {'];
  L.push('    sentence: ' + jsStr(it.sentence) + ',');
  L.push('    cid: fnv8(' + jsStr(it.sentence) + '),');
  L.push('    translation: ' + jsStr(it.translation) + ',');
  L.push('    chunks: ' + jsStr(it.chunks) + ',');
  L.push('    hints: ' + jsStr(it.hints) + ',');
  L.push('    grammar: [');
  it.grammar.forEach((g, i) => L.push('      {' + [
    'role:' + jsStr(g.role), 'color:' + jsStr(g.color), 'phonetic:' + jsStr(g.phonetic),
    'pos:' + jsStr(g.pos), 'meaning:' + jsStr(g.meaning)
  ].join(', ') + '}' + (i < it.grammar.length - 1 ? ',' : '')));
  L.push('    ],');
  L.push('    explanations: [');
  it.explanations.forEach((e, i) => L.push('      ' + jsStr(e) + (i < it.explanations.length - 1 ? ',' : '')));
  L.push('    ]');
  L.push('  }');
  return L.join('\n');
}
const header2 = fs.readFileSync(__dirname + '/../freq-idioms.js', 'utf8').split('window.DATA_FREQ_IDIOMS = [')[0] + 'window.DATA_FREQ_IDIOMS = [\n';
const footer2 = '\n];\n\n/* 注册到 BUILTIN（文件尾自注册，须 builtins.js → oral8000.js → freq-idioms.js 顺序加载） */\n(function(){\n  if(!window.BUILTIN){\n    console.error("[freq-idioms.js] 未找到 window.BUILTIN：builtins.js 须在 freq-idioms.js 之前加载");\n    return;\n  }\n  window.BUILTIN.push({\n    id: "builtin-freq-idioms",\n    builtin: true,\n    name: "高频短语 · English Idioms",\n    desc: "高频英语 idiom 短语：每个 idiom 嵌入完整例句，练习时填 idiom 短语本身",\n    items: window.DATA_FREQ_IDIOMS\n  });\n})();\n';
fs.writeFileSync(__dirname + '/../freq-idioms.js', header2 + arr.map(itemToJs).join(',\n') + footer2, 'utf8');
console.log('✅ 已写回 freq-idioms.js：更新 ' + changed + ' 条翻译');
console.log('下一步：node validate_freq_idioms.js 校验；前端硬刷（Ctrl+Shift+R）生效');