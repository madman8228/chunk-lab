/* ============================================================
   validate_oral_book.js · 校验 oral-book.js（口语 8000 唯一内容源）与构建产物一致性
   ------------------------------------------------------------
   运行：node validate_oral_book.js
   （2026-09-15 由 validate_oral8000.js 改写：内容源从 oral8000.js 迁到 oral-book.js）

   规则：
    1) ORAL_BOOK.decks 非空；deck id 唯一且符合 oral-<章>-<节>[-n] / oral-basic 规范
    2) 每 deck 必有 name/short/items（items 非空 —— 没内容的 deck 不该注册）
    3) 每句必有 sentence/translation/chunks；hints 数 == chunks 数
    4) chunks 去空格拼接 == sentence（防脱字/多字）
    4b) chunk 形态：段数 1~5（**单字句允许 1 段**，其余 ≥2）、
        无纯标点段、不以标点开头、句末标点只在末段
        （段数判据的唯一实现在 scripts/chunk-shape.js，含单字句例外的完整说明）
        （自 validate_oral8000.js 移植，删旧脚本不丢覆盖）
    4c) alts（同义答案，可选）契约：与 chunks 等长、每项 null 或字符串数组、
        条目不得与对应 chunk 归一化后相同
    5) cid 存在、8-hex、合理；deck 内唯一，**全库内也不得重复**（跨 deck 重复 = key 冲突）
    6) 与 content/manifest.json 交叉核对：deck 集合一致、每 deck 条数一致
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
/* 「最少切几段」的**唯一**判据实现（含单字句例外），全库只此一份 */
const CS = require(path.join(__dirname, 'scripts', 'chunk-shape.js'));

/* chunk / alts 形态规则（自 validate_oral8000.js 移植） */
const PURE_PUNCT = /^[\s.?!,;:]+$/;   /* 纯标点/空白 */
const START_PUNCT = /^[\s.?!,;:]/;    /* 以标点/空白开头 */
const END_SENT_PUNCT = /[.?!]$/;      /* 以句末标点结尾 */

function fnv8(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}

const win = {};
new Function('window', fs.readFileSync(path.join(__dirname, 'oral-book.js'), 'utf8'))(win);
const book = win.ORAL_BOOK;
const decks = (book && book.decks) || [];

let issues = 0;
function report(msgs) { issues++; msgs.forEach((m) => console.log('   - ' + m)); }

if (!book || !decks.length) {
  console.error('❌ oral-book.js 没有 ORAL_BOOK.decks');
  process.exit(1);
}
console.log('源：oral-book.js   series=' + JSON.stringify(book.series || '') + '  deck ' + decks.length + ' 个');

/* 1) deck id 规范与唯一 */
const idSeen = {};
const ID_RE = /^oral-(\d+-\d+(-[0-9]+)?|basic)$/;
decks.forEach((d) => {
  if (!d || !d.id) { report(['有 deck 缺 id']); return; }
  if (!ID_RE.test(d.id)) report(['deck id 不符合规范：' + d.id]);
  if (idSeen[d.id]) report(['deck id 重复：' + d.id]);
  idSeen[d.id] = 1;
});

/* 2~5) 逐 deck 逐句 */
const cidGlobal = {};
let total = 0;
decks.forEach((d, di) => {
  const items = Array.isArray(d.items) ? d.items : [];
  console.log(`[deck ${di + 1}] ${d.id} · ${d.name} · ${items.length} 句`);
  if (!d.name) report([d.id + ' 缺 name']);
  if (!d.short) report([d.id + ' 缺 short']);
  if (!items.length) report([d.id + ' items 为空（无内容的 deck 不应注册）']);

  const cidSeen = {};
  const sentSeen = {};
  items.forEach((it, i) => {
    total++;
    const tag = d.id + ' #' + i + ' ' + (it && it.sentence ? it.sentence : '?');
    const msgs = [];
    if (!it || !it.sentence) msgs.push(tag + ' 缺少 sentence');
    if (!it || !it.translation) msgs.push(tag + ' 缺少 translation');
    if (!it || !CS.chunkCountOk(it.sentence, it.chunks)) {
      msgs.push(tag + ' ' + CS.chunkCountError(it && it.sentence, it && it.chunks));
    }
    if (it && Array.isArray(it.hints) && Array.isArray(it.chunks) && it.hints.length !== it.chunks.length) {
      msgs.push(tag + ' hints 数 ' + it.hints.length + ' ≠ chunks 数 ' + it.chunks.length);
    }
    if (it && !Array.isArray(it.hints)) msgs.push(tag + ' 缺少 hints');
    if (it && it.cid) {
      if (!/^[0-9a-f]{8}$/.test(it.cid)) msgs.push(tag + ' cid 格式非法: ' + it.cid);
      else if (cidSeen[it.cid]) msgs.push(tag + ' deck 内 cid 与 #' + cidSeen[it.cid] + ' 重复: ' + it.cid);
      else cidSeen[it.cid] = i;
      if (cidGlobal[it.cid]) msgs.push(tag + ' cid 跨 deck 重复（与 ' + cidGlobal[it.cid] + '）: ' + it.cid);
      else cidGlobal[it.cid] = d.id;
    } else {
      msgs.push(tag + ' 缺少 cid');
    }
    if (it && it.sentence) {
      if (sentSeen[it.sentence]) msgs.push(tag + ' sentence 与 #' + sentSeen[it.sentence] + ' 重复');
      else sentSeen[it.sentence] = i;
    }
    if (it && it.chunks) {
      const joined = it.chunks.join('').replace(/\s+/g, '');
      const sent = String(it.sentence || '').replace(/\s+/g, '');
      if (joined !== sent) msgs.push(tag + ' 拼接≠原句: [' + joined + '] vs [' + sent + ']');
    }
    /* 4b) chunk 形态（移植自 validate_oral8000.js） */
    if (it && Array.isArray(it.chunks)) {
      if (it.chunks.length > CS.MAX_CHUNKS) msgs.push(tag + ' chunks 数 ' + it.chunks.length + ' (需 ≤' + CS.MAX_CHUNKS + ')');
      it.chunks.forEach((chnk, j) => {
        if (PURE_PUNCT.test(chnk)) msgs.push(tag + ' chunk#' + j + ' 纯标点: "' + chnk + '"');
        else if (START_PUNCT.test(chnk)) msgs.push(tag + ' chunk#' + j + ' 以标点开头: "' + chnk + '"');
        if (j < it.chunks.length - 1 && END_SENT_PUNCT.test(chnk)) {
          msgs.push(tag + ' chunk#' + j + ' 非末尾却以句末标点结尾: "' + chnk + '"');
        }
      });
    }
    /* 4c) alts（同义答案，可选）契约 —— 移植自 validate_oral8000.js */
    if (it && it.alts) {
      const nChunks = (it.chunks || []).length;
      if (!Array.isArray(it.alts)) msgs.push(tag + ' alts 须是数组');
      else if (it.alts.length !== nChunks) msgs.push(tag + ' alts 长度 ' + it.alts.length + ' ≠ chunks ' + nChunks);
      else {
        it.alts.forEach((a, j) => {
          if (a === null) return;
          if (!Array.isArray(a)) { msgs.push(tag + ' alts#' + j + ' 须是 null 或字符串数组'); return; }
          a.forEach((alt, k) => {
            if (typeof alt !== 'string') { msgs.push(tag + ' alts#' + j + '[' + k + '] 须是字符串'); return; }
            if (PURE_PUNCT.test(alt)) msgs.push(tag + ' alts#' + j + '[' + k + '] 纯标点: "' + alt + '"');
            const nAlt = alt.replace(/[^a-z0-9\s]/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
            const nChunk = String(it.chunks[j] || '').replace(/[^a-z0-9\s]/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (nAlt && nAlt === nChunk) msgs.push(tag + ' alts#' + j + '[' + k + '] "' + alt + '" 与 chunk 归一化后相同');
          });
        });
      }
    }
    if (msgs.length) report(msgs);
  });
});
console.log('\n合计 ' + total + ' 句');

/* 6) 与 manifest 交叉核对 */
const manPath = path.join(__dirname, 'content/manifest.json');
if (!fs.existsSync(manPath)) {
  report(['content/manifest.json 不存在（先跑 node scripts/build-content.mjs）']);
} else {
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  const manById = {};
  (man.decks || []).forEach((e) => { manById[e.id] = e; });
  const srcById = {};
  decks.forEach((d) => { srcById[d.id] = d.items.length; });
  /* 口语 deck：源 ⊆ manifest 且条数一致 */
  const missing = Object.keys(srcById).filter((id) => !manById[id]);
  if (missing.length) report(['manifest 缺少这些口语 deck：' + missing.join(', ')]);
  Object.keys(srcById).forEach((id) => {
    if (manById[id] && manById[id].totalCount !== srcById[id]) {
      report(['manifest ' + id + ' totalCount=' + manById[id].totalCount + ' ≠ 源 ' + srcById[id]]);
    }
  });
  /* 反向：manifest 里的口语 deck 不得多于源（freq 除外） */
  const extra = (man.decks || []).filter((e) => e.id !== 'builtin-freq-idioms' && !srcById[e.id]).map((e) => e.id);
  if (extra.length) report(['manifest 有源里不存在的 deck（陈旧产物）：' + extra.join(', ')]);
  console.log('manifest 交叉核对：' + Object.keys(srcById).length + ' 个口语 deck');
}

console.log('\n结果：' + (issues ? issues + ' 处问题  ❌' : '全部合规  ✅'));
process.exit(issues ? 1 : 0);
