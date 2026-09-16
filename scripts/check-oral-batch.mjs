/* check-oral-batch.mjs · 口语新批数据入库前自检
 *
 * 运行：node scripts/check-oral-batch.mjs extra/oral-batch4-1.json [...]
 *
 * 与 validate_oral8000.js / validate_distractors.js 同规约（避免入库后才发现）：
 *   C1 chunks 数 2~5
 *   C2 chunks.join('') 去空格 == sentence 去空格
 *   C3 无纯标点 chunk / chunk 不以标点开头
 *   C4 句末标点(. ? !)只在最后一个 chunk
 *   C5 cid 与既有库冲突 / 与本批内重复
 *   C6 句 norm 与既有库重复
 *   D1-E6 干扰项：外层长度==chunks、每槽数组、string、1..120、norm 不撞句内任何 chunk、槽内 norm 不重复
 *   D7 每槽 ≥2 条（buildChoices pick(preset,2) 的最低要求）
 *   W3 句级可用量 >= max(4, 2×chunks)
 *   W4 固定搭配未拆分（黑名单扫描）
 *   F1 hints / grammar / explanations 长度 == chunks
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm } from '../js/chunk-engine.mjs';
/* 「最少切几段」的唯一判据（含单字句例外）—— 同目录 */
import CS from '../js/chunk-shape.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* cid 规则与 core.js fnv8 一致 */
function fnv8(str) {
  let h = 0x811c9dc5;
  str = String(str == null ? '' : str);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}

function loadExisting() {
  /* 2026-09-15 起口语 8000 = oral-book.js 唯一内容源；builtins.js 只剩迁移表、
     oral8000.js 为空壳。继续读它们会让入库自检对着**空库**跑 → 重复/撞库全漏检。 */
  global.window = { BUILTIN: [] };
  new Function('window', fs.readFileSync(path.join(ROOT, 'oral-book.js'), 'utf8'))(global.window);
  new Function('window', fs.readFileSync(path.join(ROOT, 'freq-idioms.js'), 'utf8'))(global.window);
  const out = [];
  const book = global.window.ORAL_BOOK;
  for (const d of (book && book.decks) || []) for (const it of d.items || []) out.push({ deck: d.id, it });
  for (const d of global.window.BUILTIN || []) {
    if (book && (book.decks || []).some((x) => x.id === d.id)) continue;
    for (const it of d.items || []) out.push({ deck: d.id, it });
  }
  if (!out.length) throw new Error('入库自检读到 0 条现有句（oral-book.js / freq-idioms.js 没加载上？）—— 拒绝空库通过');
  return out;
}

/* 不可拆分固定搭配（存疑即报，供人工确认） */
const IDIOMS = [
  'go for a run', 'sleep in', 'wake up', 'put up with', 'be down for', 'get up',
  'take your time', 'there is no', 'go out for', 'beat yourself up', 'keep going',
  'feel like', 'would like', 'want to', 'have to', 'be good at', 'a lot of',
];

const PURE_PUNCT = /^[\s.?!,;:]+$/;
const START_PUNCT = /^[\s.?!,;:]/;
const END_SENT_PUNCT = /[.?!]$/;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法: node scripts/check-oral-batch.mjs <batch.json> [...]');
  process.exit(2);
}

const existing = loadExisting();
const oldNorm = new Map();   /* norm(sentence) -> 出处 */
const oldCid = new Map();    /* cid -> 出处 */
for (const { deck, it } of existing) {
  const n = norm(it.sentence);
  if (n && !oldNorm.has(n)) oldNorm.set(n, deck + ':' + (it.cid || '?'));
  if (it.cid && !oldCid.has(it.cid)) oldCid.set(it.cid, deck + ':' + it.sentence);
}

let total = 0;
let bad = 0;
const seenNorm = new Map();
const seenCid = new Map();

/* 批数据文件是 JS（var ORAL_BATCH = [...]，与 oral8000.js 同风格：grammar 用无引号键） */
function loadBatch(abs) {
  const src = fs.readFileSync(abs, 'utf8');
  const fn = new Function(src + '\nreturn ORAL_BATCH;');
  return fn();
}

for (const f of files) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  const items = loadBatch(abs);
  console.log('\n=== ' + path.basename(abs) + ' · ' + items.length + ' 条 ===');
  items.forEach((it, idx) => {
    total++;
    const msgs = [];
    const label = '#' + idx + ' ' + (it.sentence || '?');
    const chunks = it.chunks || [];

    /* ---- C1/C2/C3/C4 ---- */
    const chunkErr = CS.chunkCountError(it.sentence, chunks);
    if (chunkErr) msgs.push('C1 ' + chunkErr);
    if (chunks.join('').replace(/\s+/g, '') !== String(it.sentence || '').replace(/\s+/g, ''))
      msgs.push('C2 拼接≠原句: [' + chunks.join('') + '] vs [' + it.sentence + ']');
    chunks.forEach((c, j) => {
      if (PURE_PUNCT.test(c)) msgs.push('C3 chunk#' + j + ' 纯标点 "' + c + '"');
      else if (START_PUNCT.test(c)) msgs.push('C3 chunk#' + j + ' 以标点开头 "' + c + '"');
      if (j < chunks.length - 1 && END_SENT_PUNCT.test(c))
        msgs.push('C4 chunk#' + j + ' 非末尾却以句末标点结尾 "' + c + '"');
    });

    /* ---- C5/C6 与既有库、批内去重 ---- */
    const n = norm(it.sentence);
    if (oldNorm.has(n)) msgs.push('C6 与既有库重复 → ' + oldNorm.get(n));
    else if (seenNorm.has(n)) msgs.push('C6 批内重复 → ' + seenNorm.get(n));
    else seenNorm.set(n, label);
    const cid = fnv8(it.sentence);
    if (oldCid.has(cid)) msgs.push('C5 cid 撞既有库 → ' + oldCid.get(cid));
    else if (seenCid.has(cid)) msgs.push('C5 cid 批内重复 → ' + seenCid.get(cid));
    else seenCid.set(cid, label);

    /* ---- F1 配套数组长度 ---- */
    for (const k of ['hints', 'grammar', 'explanations']) {
      if (!Array.isArray(it[k])) msgs.push('F1 缺 ' + k);
      else if (it[k].length !== chunks.length) msgs.push('F1 ' + k + ' 长度 ' + it[k].length + ' ≠ chunks ' + chunks.length);
    }
    if (Array.isArray(it.grammar)) {
      it.grammar.forEach((g, j) => {
        for (const k of ['role', 'color', 'phonetic', 'pos', 'meaning'])
          if (g[k] == null) msgs.push('F1 grammar#' + j + ' 缺 ' + k);
        if (!Array.isArray(g.phonetic) || !g.phonetic.length) msgs.push('F1 grammar#' + j + ' phonetic 空');
      });
    }
    if (Array.isArray(it.translation) || !it.translation) msgs.push('F1 缺 translation');

    /* ---- D 干扰项 ---- */
    const correctSet = new Set(chunks.map((c) => norm(c)));
    const d = it.distractors;
    if (!Array.isArray(d)) msgs.push('D1 缺 distractors');
    else if (d.length !== chunks.length) msgs.push('D2 干扰项外层 ' + d.length + ' ≠ chunks ' + chunks.length);
    else {
      let available = 0;
      d.forEach((slot, i) => {
        if (!Array.isArray(slot)) { msgs.push('D3 槽[' + i + '] 非数组'); return; }
        if (slot.length < 2) msgs.push('D7 槽[' + i + '] 仅 ' + slot.length + ' 条（buildChoices 每槽取 2）');
        const seenSlot = new Set();
        slot.forEach((raw, j) => {
          if (typeof raw !== 'string') { msgs.push('D4 槽[' + i + ']#' + j + ' 非字符串'); return; }
          const t = raw.trim();
          if (!t) { msgs.push('D4 槽[' + i + ']#' + j + ' 空白'); return; }
          if (t.length > 120) { msgs.push('D4 槽[' + i + ']#' + j + ' 超长'); return; }
          if (raw !== t) msgs.push('W1 槽[' + i + ']#' + j + ' 未 trim');
          const nk = norm(t);
          if (correctSet.has(nk)) { msgs.push('E5 槽[' + i + ']#' + j + ' norm 撞句内 chunk：「' + t + '」'); return; }
          if (seenSlot.has(nk)) { msgs.push('E6 槽[' + i + ']#' + j + ' 槽内重复：「' + t + '」'); return; }
          seenSlot.add(nk);
          available++;
        });
      });
      const need = Math.max(4, 2 * chunks.length);
      if (available < need) msgs.push('W3 可用 ' + available + ' < 需求 ' + need);
    }

    /* ---- alts ---- */
    if (it.alts) {
      if (!Array.isArray(it.alts)) msgs.push('G1 alts 须是数组');
      else if (it.alts.length !== chunks.length) msgs.push('G1 alts 长度 ' + it.alts.length + ' ≠ chunks ' + chunks.length);
      else it.alts.forEach((a, j) => {
        if (a === null) return;
        if (!Array.isArray(a)) msgs.push('G1 alts#' + j + ' 须 null 或数组');
        else a.forEach((alt, k) => {
          if (norm(alt) === norm(chunks[j])) msgs.push('G1 alts#' + j + '[' + k + '] 与 chunk 相同');
        });
      });
    }

    /* ---- W4 固定搭配拆分扫描 ---- */
    const plain = chunks.join(' ').toLowerCase();
    for (const idm of IDIOMS) {
      if (!plain.includes(idm)) continue;
      /* 该搭配是否被 chunk 边界切断 */
      let pos = 0;
      const spans = chunks.map((c) => { const s = [pos, pos + c.length]; pos += c.length + 1; return s; });
      const at = plain.indexOf(idm);
      const cut = spans.some(([s, e]) => at < s && s < at + idm.length && e <= at + idm.length);
      if (cut) msgs.push('W4 固定搭配「' + idm + '」被 chunk 边界切断: ' + JSON.stringify(chunks));
    }

    if (msgs.length) {
      bad++;
      console.log('  ✗ ' + label);
      msgs.forEach((m) => console.log('      - ' + m));
    }
  });
}

console.log('\n总条数 ' + total + '，问题条数 ' + bad + (bad ? '  ❌' : '  ✅ 全部合规'));
process.exit(bad ? 1 : 0);
