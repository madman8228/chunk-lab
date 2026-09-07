/* ============================================================
   add-cids.js · 给内置句子数据注入稳定内容 ID（cid）
   ------------------------------------------------------------
   背景（P1 根因修复）：学习档案 key 曾用 deckId#原文，改一个词就丢用户进度。
   现在 key = deckId#cid。cid 规则（core.js cidOf）：
     - 显式 cid 字段优先（内容修订时保留 cid → 进度不丢）
     - 无 cid 时退化为 fnv8(sentence)（幂等）
   本脚本给句子对象注入 cid = fnv8(sentence)，**已有 cid 的句子跳过**（幂等，
   可反复跑；扩充新句后重跑即可自动补 cid）。

   实现：行级注入，保持各文件手写风格，diff 只增不改。
     - builtins.js：JSON 风格（"sentence": "..."），cid 行插在该键行后
     - oral8000.js：compact 风格（sentence: "..."），cid 行插在该键行后
   运行：node scripts/add-cids.js
   校验：node validate_builtins.js && node validate_oral8000.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

/* 与 core.js fnv8 完全一致的 FNV-1a（32bit → 8 hex） */
function fnv8(str) {
  let h = 0x811c9dc5;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  }
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}
function decodeEscaped(quotedBody) {
  try { return JSON.parse('"' + quotedBody.replace(/"/g, '\\"') + '"'); }
  catch (e) { return quotedBody.replace(/\\(.)/g, '$1'); }
}

/* 行级注入：在每句的 sentence 键行后插入 cid 行；已有 cid（紧邻下一行）则跳过（--force 时重算）。
   opts: { file, makeRe(force), makeCidLine(缩进+cid 行), comment }
   返回新增 cid 数量 */
const FORCE = process.argv.includes('--force');
function inject(file, makeRe, makeCidLine) {
  const p = path.join(__dirname, '..', file);
  let src = fs.readFileSync(p, 'utf8');
  if (FORCE) {
    /* 全量重算前，先移除所有旧 cid 键行（独立行），避免重复键后者覆盖导致旧值残留 */
    const before = src;
    src = src.replace(/^[ \t]*"?cid"?:[ \t]*"[0-9a-f]{8}",?[ \t]*\r?\n/gm, '');
    if (src !== before) console.log(`[${file}] 清除旧 cid 行`);
  }
  let added = 0;
  const out = src.replace(makeRe(FORCE), (m, indent, keyLine, valueRaw, nl) => {
    const sentence = decodeEscaped(valueRaw);
    const cid = fnv8(sentence);
    added++;
    return indent + keyLine + nl + makeCidLine(indent, cid);
  });
  fs.writeFileSync(p, out, 'utf8');
  console.log(`[${file}] ${FORCE ? '重算' : '注入'} cid × ${added}`);
}

/* builtins.js：JSON 风格，cid 行同缩进插在 "sentence" 键行后 */
inject('builtins.js',
  (force) => new RegExp('(^[ \\t]*)("sentence": "((?:[^"\\\\]|\\\\.)*)",?[ \\t]*)(\\n)' + (force ? '' : '(?![ \\t]*"cid":)'), 'gm'),
  (indent, cid) => `${indent}"cid": "${cid}",\n`
);

/* oral8000.js：compact 风格（键不带引号），只在数据区（window.DATA_ORAL8000 = [ 之后）注入。
   注意：捕获组必须与 builtins 完全对齐 —— 组1=缩进 组2=整键行 组3=值 组4=换行，
   String.replace 回调第 4 实参是 offset 数字，组数不一致会把 offset 当换行拼进文件（曾踩坑）。 */
inject('oral8000.js',
  (force) => new RegExp('(^[ \\t]*)(sentence: "((?:[^"\\\\]|\\\\.)*)",?[ \\t]*)(\\n)' + (force ? '' : '(?![ \\t]*cid:)'), 'gm'),
  (indent, cid) => `${indent}cid: "${cid}",\n`
);

console.log('完成。下一步：node validate_builtins.js && node validate_oral8000.js');
