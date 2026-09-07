/* ============================================================
   validate_builtins.js · 校验 builtins.js 数据质量（cid 资产规范）
   ------------------------------------------------------------
   运行：node validate_builtins.js
   规则：
    1) BUILTIN 恰为 1 个内置 deck（builtin-daily 静态 88 句 = 日常58 + 口头禅30；
       oral8000.js 的 50 句 2026-09-07 起并入 → 运行态 daily=138 句。
       builtin-freq-idioms 由 freq-idioms.js 自注册，不在此文件）
    2) 每句必有 sentence / translation / chunks
    3) cid：存在、8-hex、deck 内唯一（脚本 scripts/add-cids.js 自动维护）
    4) 每句去空格拼接 == sentence（防脱字/多字）
    5) sentence 在 deck 内唯一（防 key=deckId#cid 混淆）
   ============================================================ */
'use strict';
const fs = require('fs');

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

global.window = {};
new Function('window', fs.readFileSync(__dirname + '/builtins.js', 'utf8'))(global.window);
const decks = global.window.BUILTIN || [];

let issues = 0;
function report(msgs) {
  issues++;
  msgs.forEach((m) => console.log('   - ' + m));
}

/* 1) 1 个内置 deck */
if (decks.length !== 1) {
  report(['BUILTIN deck 数 = ' + decks.length + '（期望 1：builtin-daily 静态 88 句）']);
}
decks.forEach((d, di) => {
  const name = (d && d.name) || '?';
  const items = (d && Array.isArray(d.items)) ? d.items : [];
  console.log(`[deck ${di + 1}] ${d && d.id} · ${name} · ${items.length} 句`);

  if (!items.length) return;
  const cidSeen = {};
  const sentSeen = {};
  items.forEach((it, i) => {
    const msgs = [];
    const tag = '#' + i + ' ' + (it && it.sentence ? it.sentence : '?');
    if (!it || !it.sentence) msgs.push(tag + ' 缺少 sentence');
    if (!it || !it.translation) msgs.push(tag + ' 缺少 translation');
    if (!it || !Array.isArray(it.chunks) || it.chunks.length < 2) msgs.push(tag + ' chunks 缺失/不足 2');
    /* cid 规则 */
    if (!it.cid) msgs.push(tag + ' 缺少 cid（跑 node scripts/add-cids.js 补齐）');
    else if (!/^[0-9a-f]{8}$/.test(it.cid)) msgs.push(tag + ' cid 格式非法: ' + it.cid);
    else if (cidSeen[it.cid]) msgs.push(tag + ' cid 与 #' + cidSeen[it.cid] + ' 重复: ' + it.cid);
    else cidSeen[it.cid] = i;
    if (it.sentence) {
      if (sentSeen[it.sentence]) msgs.push(tag + ' sentence 与 #' + sentSeen[it.sentence] + ' 重复');
      else sentSeen[it.sentence] = i;
      if (it.cid && it.cid !== fnv8(it.sentence))
        msgs.push(tag + ' cid ≠ fnv8(sentence)（内容修订保留 cid 属预期；若未修订请检查）');
    }
    if (it.chunks) {
      const joined = it.chunks.join('').replace(/\s+/g, '');
      const sent = String(it.sentence || '').replace(/\s+/g, '');
      if (joined !== sent) msgs.push(tag + ' 拼接≠原句: [' + joined + '] vs [' + sent + ']');
    }
    if (msgs.length) { issues++; console.log('[#' + i + '] ' + (it && it.sentence ? it.sentence : '?')); msgs.forEach((m) => console.log('   - ' + m)); }
  });
});
console.log('\n结果：' + (issues ? issues + ' 处问题  ❌' : '全部合规  ✅'));
process.exit(issues ? 1 : 0);
