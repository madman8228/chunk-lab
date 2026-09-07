/* scripts/preflight-batch.js · 注入前只读预检(不写任何文件)
 * 目的:把 extra/batch*.json 对 freq-idioms.js 已入库数据做去重 + 数量对账,
 *       在注入前暴露 句子重复 / cid 冲突 / 批内重复,避免收口时撞 cid 再事后清理
 *      (前科: v42 bug 就是 deletedItems 里 93 条重 key;v38 是数据文件叠加损坏)
 *
 * 用法:
 *   node scripts/preflight-batch.js                     # 自动扫 extra/batch*.json
 *   node scripts/preflight-batch.js extra/batch3.json ...   # 指定文件
 *
 * 退出码:0 = 无重复可注入;1 = 有重复(句子或 cid);2 = 参数/文件错误
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const IDIOMS_FILE = path.join(ROOT, 'freq-idioms.js');

/* fnv8 与 freq-idioms.js / core.js 一致 */
function fnv8(str) {
  let h = 0x811c9dc5 >>> 0;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  let x = (h >>> 0).toString(16);
  while (x.length < 8) x = '0' + x;
  return x;
}
const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();

/* 载入已入库数据(vm 执行,不污染进程) */
let existing = [];
try {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(IDIOMS_FILE, 'utf8'), ctx, { filename: 'freq-idioms.js' });
  existing = ctx.window.DATA_FREQ_IDIOMS || [];
} catch (e) {
  console.error('❌ freq-idioms.js 不可解析: ' + e.message);
  process.exit(2);
}
const existingCid = new Set(existing.map((x) => x.cid).filter(Boolean));
const existingSent = new Set(existing.map((x) => norm(x.sentence)));

/* 待注入批次 */
const args = process.argv.slice(2);
const files = args.length
  ? args
  : fs.readdirSync(path.join(ROOT, 'extra'))
      .filter((f) => /^batch\d+[ab]?\.json$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)[0], 10), nb = parseInt(b.match(/\d+/)[0], 10);
        return na - nb;
      })
      .map((f) => path.join('extra', f));
if (!files.length) { console.log('未找到 batch 文件(extra/batch*.json)'); process.exit(2); }

const dupExisting = [];   // 与已入库重复
const dupInBatch = [];    // 批次内部重复(同句)
const cidClash = [];      // cid 撞已入库但句子不同(理论不应发生)
let total = 0;
const seenSent = new Map(); // batch 内 sentence → 首个文件

for (const f of files) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) { console.error('文件不存在: ' + f); process.exit(2); }
  const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!Array.isArray(arr)) { console.error(f + ' 不是数组'); process.exit(2); }
  for (const it of arr) {
    total++;
    const cid = it.cid || fnv8(it.sentence);
    const s = norm(it.sentence);
    const tag = '#' + String(cid).slice(0, 8) + ' ' + String(it.sentence).slice(0, 46);
    if (existingCid.has(cid) || existingSent.has(s)) dupExisting.push(f + ' :: ' + tag);
    if (seenSent.has(s)) dupInBatch.push(seenSent.get(s) + ' ↔ ' + f + ' :: ' + tag);
    else seenSent.set(s, f);
  }
}

console.log('── 预检报告 ──────────────────────────────');
console.log('已入库 freq-idioms:', existing.length, '条');
console.log('待注入 batch:', files.length, '个文件,', total, '条');
console.log('与已入库重复:', dupExisting.length, '条' + (dupExisting.length ? '\n  ' + dupExisting.join('\n  ') : ''));
console.log('批内重复:', dupInBatch.length, '条' + (dupInBatch.length ? '\n  ' + dupInBatch.join('\n  ') : ''));
console.log('──────────────────────────────────────────');
if (!dupExisting.length && !dupInBatch.length) {
  console.log('✅ 无重复,' + total + ' 条可安全注入');
  process.exit(0);
}
console.log('⚠ 存在重复——先去重再注入(注入前自动算 cid,重复会撞 key)');
process.exit(1);
