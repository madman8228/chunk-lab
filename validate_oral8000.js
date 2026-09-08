/* 校验 oral8000.js 的数据质量
 * 运行: node validate_oral8000.js
 * 规则:
 *  1) chunks 数 2~5
 *  2) 拼接(去空格) == sentence 原句, 防脱字/多字
 *  3) 无纯标点 chunk (如 "." "?" ",")
 *  4) chunk 不以标点开头
 *  5) 非最后一个 chunk 不以句末标点(. ? !)结尾, 句末标点只允许在最后一个 chunk
 *  6) alts(同义答案) 可选; 如有须是与 chunks 等长的数组, 每项为 null 或字符串数组
 */
const fs = require('fs');
/* cid 规则与 core.js fnv8 一致 */
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
/* 预置 BUILTIN（含 builtin-daily 桩），让 oral8000.js 尾部并入逻辑一并被校验。
   oral8000.js 自 2026-09-07 起不再注册独立 deck，而是把 50 句 concat 进 builtin-daily。 */
const dailyStub = { id: 'builtin-daily', items: [] };
global.window = { BUILTIN: [dailyStub] };
new Function('window', fs.readFileSync(__dirname + '/oral8000.js', 'utf8'))(global.window);
const arr = global.window.DATA_ORAL8000 || [];

/* 并入检查：builtin-daily.items 应包含 DATA_ORAL8000 全部句（先 builtins.js 定义静态句，再并入本文件 100 = 188） */
if (dailyStub.items.length < arr.length) {
  console.error('❌ builtin-daily.items 未并入 DATA_ORAL8000（当前 ' + dailyStub.items.length + ' < ' + arr.length + '，检查 oral8000.js 尾部并入块）');
  process.exit(1);
}
for (let i = 0; i < arr.length; i++) {
  if (dailyStub.items[i + dailyStub.items.length - arr.length] !== arr[i]) {
    console.error('❌ builtin-daily.items 尾部与 DATA_ORAL8000 引用不一致');
    process.exit(1);
  }
}

const PURE_PUNCT = /^[\s.?!,;:]+$/;        // 纯标点/空白
const START_PUNCT = /^[\s.?!,;:]/;          // 以标点/空白开头
const END_SENT_PUNCT = /[.?!]$/;            // 以句末标点结尾

let issues = 0;
const cidSeen = {};
arr.forEach((it, i) => {
  const msgs = [];
  if (!it.sentence) msgs.push('缺少 sentence');
  if (!it.cid) msgs.push('缺少 cid（跑 node scripts/add-cids.js 补齐）');
  else if (!/^[0-9a-f]{8}$/.test(it.cid)) msgs.push('cid 格式非法: ' + it.cid);
  else if (cidSeen[it.cid]) msgs.push('cid 与 #' + cidSeen[it.cid] + ' 重复');
  else cidSeen[it.cid] = i;
  if (it.sentence && it.cid && /^[0-9a-f]{8}$/.test(it.cid) && it.cid !== fnv8(it.sentence))
    msgs.push('cid ≠ fnv8(sentence)（内容修订保留 cid 属预期；若未修订请检查）');
  if (!it.chunks || it.chunks.length < 2 || it.chunks.length > 5)
    msgs.push('chunks 数 ' + (it.chunks ? it.chunks.length : '?') + ' (需 2-5)');
  if (it.chunks) {
    const joined = it.chunks.join('').replace(/\s+/g, '');
    const sent = String(it.sentence || '').replace(/\s+/g, '');
    if (joined !== sent)
      msgs.push('拼接≠原句: [' + joined + '] vs [' + sent + ']');
    it.chunks.forEach((c, j) => {
      if (PURE_PUNCT.test(c)) msgs.push('chunk#' + j + ' 纯标点: "' + c + '"');
      else if (START_PUNCT.test(c)) msgs.push('chunk#' + j + ' 以标点开头: "' + c + '"');
      if (j < it.chunks.length - 1 && END_SENT_PUNCT.test(c))
        msgs.push('chunk#' + j + ' 非末尾却以句末标点结尾: "' + c + '"');
    });
  }
  /* alts 同义答案校验（可选字段） */
  if (it.alts) {
    if (!Array.isArray(it.alts)) msgs.push('alts 须是数组');
    else if (it.alts.length !== it.chunks.length)
      msgs.push('alts 长度(' + it.alts.length + ') ≠ chunks 长度(' + it.chunks.length + ')');
    else {
      it.alts.forEach((a, j) => {
        if (a !== null && !Array.isArray(a))
          msgs.push('alts#' + j + ' 须是 null 或字符串数组, 实际: ' + typeof a);
        else if (Array.isArray(a)) {
          a.forEach((alt, k) => {
            if (typeof alt !== 'string')
              msgs.push('alts#' + j + '[' + k + '] 须是字符串');
            else {
              /* norm 后不能与标准答案完全相同（避免无意义重复） */
              const nAlt = alt.replace(/[^a-z0-9\s]/gi,'').toLowerCase().replace(/\s+/g,' ').trim();
              const nChunk = String(it.chunks[j]||'').replace(/[^a-z0-9\s]/gi,'').toLowerCase().replace(/\s+/g,' ').trim();
              if (nAlt === nChunk && nAlt.length > 0)
                msgs.push('alts#' + j + '[' + k + '] "' + alt + '" 与 chunk#' + j + ' norm 后相同，无需列入 alts');
              /* 标点规则同 chunks */
              if (/^[\s.?!,;:]+$/.test(alt)) msgs.push('alts#' + j + '[' + k + '] 纯标点: "' + alt + '"');
            }
          });
        }
      });
    }
  }
  if (msgs.length) {
    issues++;
    console.log('[# ' + i + '] ' + (it.sentence || '?'));
    msgs.forEach((m) => console.log('   - ' + m));
  }
});
console.log('\n总题数: ' + arr.length + '，问题题数: ' + issues + (issues ? '  ❌' : '  ✅ 全部合规'));
process.exit(issues ? 1 : 0);
