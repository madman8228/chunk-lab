/* 校验 freq-idioms.js 的数据质量
 * 运行: node validate_freq_idioms.js
 * 规则（与 validate_oral8000.js 完全一致，单文件聚焦 freq-idioms.js）：
 *  1) chunks 数 2~5
 *  2) 拼接(去空格) == sentence 原句, 防脱字/多字
 *  3) 无纯标点 chunk (如 "." "?" ",")
 *  4) chunk 不以标点开头
 *  5) 非最后一个 chunk 不以句末标点(. ? !)结尾, 句末标点只允许在最后一个 chunk
 *  6) alts(同义答案) 可选; 如有须是与 chunks 等长的数组, 每项为 null 或字符串数组
 *  7) cid 必须 8 位 hex 且等于 fnv8(sentence)
 *  8) 翻译机检（scripts/translation-rules.js）：errors 必拦；warnings 打印供人复核
 *
 * 用途：每次扩写 freq-idioms.js 之前自动跑一遍，发现 schema bug 当场修。
 */
const fs = require('fs');
const tr = require('./scripts/translation-rules');
/* cid 规则与 core.js fnv8 一致 */
function fnv8(str) {
  let h = 0x811c9dc5 >>> 0;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  }
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}
/* 预置 BUILTIN，让 freq-idioms.js 尾部自注册逻辑一并被校验 */
global.window = { BUILTIN: [] };
new Function('window', fs.readFileSync(__dirname + '/freq-idioms.js', 'utf8'))(global.window);
const arr = global.window.DATA_FREQ_IDIOMS || [];

/* 注册检查：deck 壳由 freq-idioms.js 自己 push 进 BUILTIN */
const reg = (global.window.BUILTIN || []).find((d) => d.id === 'builtin-freq-idioms');
if (!reg) {
  console.error('❌ builtin-freq-idioms 未注册进 window.BUILTIN（检查 freq-idioms.js 尾部自注册块）');
  process.exit(1);
}
if (reg.items !== arr) {
  console.error('❌ 注册 deck items 与 DATA_FREQ_IDIOMS 不是同一引用');
  process.exit(1);
}

const PURE_PUNCT = /^[\s.?!,;:]+$/;
const START_PUNCT = /^[\s.?!,;:]/;
const END_SENT_PUNCT = /[.?!]$/;

let issues = 0;
const cidSeen = {};
const warnBag = {};
arr.forEach((it, i) => {
  const msgs = [];
  if (!it.sentence) msgs.push('缺少 sentence');
  if (!it.cid) msgs.push('缺少 cid');
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
  /* alts 同义答案校验（可选） */
  if (it.alts) {
    if (!Array.isArray(it.alts)) msgs.push('alts 须是数组');
    else if (it.alts.length !== it.chunks.length)
      msgs.push('alts 长度(' + it.alts.length + ') ≠ chunks 长度(' + it.chunks.length + ')');
  }
  /* translation 必须存在（idiom deck 内置条目不允许空翻译） */
  if (!it.translation || !String(it.translation).trim()) {
    msgs.push('缺少 translation（idiom 必须配中文释义）');
  }
  /* 翻译机检：errors 报问题，warnings 收集到末尾统一打印供人复核 */
  const trRes = tr.checkTranslation(it);
  trRes.errors.forEach((e) => msgs.push('翻译机检: ' + e));
  if (trRes.warnings.length) {
    if (!warnBag[i]) warnBag[i] = [];
    warnBag[i] = warnBag[i].concat(trRes.warnings);
  }
  if (msgs.length) {
    issues++;
    console.log('[# ' + i + '] ' + (it.sentence || '?'));
    msgs.forEach((m) => console.log('   - ' + m));
  }
});
/* warnings 汇总（语义盲区 → 人工复核清单） */
const warnKeys = Object.keys(warnBag).map(Number).sort((a, b) => a - b);
if (warnKeys.length) {
  console.log('\n── 翻译复核清单（warnings，不阻塞，建议人工扫）──');
  warnKeys.forEach((k) => {
    console.log('#' + k + ' ' + (arr[k] && arr[k].sentence ? arr[k].sentence : '?'));
    warnBag[k].forEach((w) => console.log('   ~ ' + w));
  });
}
console.log('\n总题数: ' + arr.length + '，问题题数: ' + issues + (issues ? '  ❌' : '  ✅ 全部合规'));
process.exit(issues ? 1 : 0);
