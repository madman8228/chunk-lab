#!/usr/bin/env node
/**
 * check-cross-source-dup.mjs · 跨内容源重复句的**口径护栏**（2026-09-16 立）
 *
 * 为什么存在（根因）：
 *   本站有两个**独立内容源**：
 *     · 口语场景库 oral-book.js      （window.ORAL_BOOK.decks，按书的章节/场景）
 *     · 惯用语库   freq-idioms.js    （window.DATA_FREQ_IDIOMS，按固定表达）
 *   句子文本相同 → **cid（fnv8(sentence)）相同**（两者共用一个 cid 空间）。
 *   于是「同一句话同时存在于两库」到底是允许还是缺陷，一直**没人定过**，也**没有任何闸**：
 *   2026-09-16 首次量化，实测 5 条（此前只知道 1 条 `Take it or leave it.`）。
 *
 * ⚠️ 事实校正（2026-09-16 晚复核代码后更正 —— 本头注此前把这一点写错了）：
 *   **cid 相同 ≠ 进度共享**。句子级档案 key = `deckId#cid`（core.js `cidKey` / `masteredKey` /
 *   `itemKey` 三者同源），而两库 deckId 不同（如 `oral-4-17-1` vs `builtin-freq-idioms`）
 *   ⇒ 跨库进度**始终各自独立**，与 cid 是否相同无关；即便把 punct-variant 的标点统一了，
 *     key 前缀仍不同，依旧各记一份（`book-deck-migration.test.js` 亦断言「跨 deck 正确分流」）。
 *   ⇒ 本闸只回答「同一句话是否在两个入口各出一遍」，**不管进度共享**。
 *     要让跨源同句共享进度是**另一个议题**（须改 key 构造），改标点解决不了。
 *
 * 口径（2026-09-16 定）：
 *   1. 跨源重复**允许** —— 两库入口语义不同（「这个场景怎么说」vs「这个惯用语怎么说」），
 *      同一句在两种语境下都值得出题，属**有意的重复**，不是缺陷。
 *   2. 但必须**显式登记**（extra/cross-source-allowlist.json）—— 允许 ≠ 不管：
 *      新增一条未登记的重复即报错，逼人做「这里该不该重复」的判断，而不是让它悄悄长出来。
 *   3. 登记里区分两类（kind），并**双向自洽校验**：
 *        identical     —— 两库句子文本逐字一致（cid 同）
 *        punct-variant —— 只有句末标点不同（如 `!` / `.`；cid 不同）
 *      若哪天有人把变体统一了，kind 与事实不符也会报错 → 登记表不会腐烂成谎言。
 *
 * 用法：node scripts/check-cross-source-dup.mjs
 *   ⚠️ 依赖 oral-book.js（构建产物、不入库）→ 新 clone 须先跑 scripts/gen-oral-book.mjs 自举。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST = 'extra/cross-source-allowlist.json';

/** 与装配链一致的句子归一化：只留字母数字（同一句的判定） */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** 浏览器全局量加载（`window.X = ...` 形态，不能用 JSON.parse） */
function loadWindow(file, names) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const win = {};
  new Function('window', src)(win);
  for (const n of names) if (win[n]) return win[n];
  throw new Error(`[cross-dup] ${file} 里找不到 window.{${names.join('|')}} —— 内容源结构变了？`);
}

/* ---- 读两库 ---- */
const builtinsSrc = fs.readFileSync(path.join(ROOT, 'builtins.js'), 'utf8');
const winB = {};
new Function('window', builtinsSrc)(winB);              /* freq-idioms.js 依赖 window.BUILTIN */
const winF = { BUILTIN: winB.BUILTIN };
new Function('window', fs.readFileSync(path.join(ROOT, 'freq-idioms.js'), 'utf8'))(winF);
const idioms = winF.DATA_FREQ_IDIOMS || [];

const book = loadWindow('oral-book.js', ['ORAL_BOOK']);
const oral = [];
(book.decks || []).forEach((d) => (d.items || []).forEach((it) => {
  oral.push({ deck: d.id, sentence: it.sentence, cid: it.cid, cn: it.translation });
}));

if (!oral.length || !idioms.length) {
  console.error(`[cross-dup] 内容源为空（口语 ${oral.length} / 习语 ${idioms.length}）→ 拒绝静默通过`);
  process.exit(1);
}

/* ---- 求跨源重复 ---- */
const idiomByNorm = new Map();
idioms.forEach((it) => {
  const k = norm(it.sentence);
  if (!idiomByNorm.has(k)) idiomByNorm.set(k, []);
  idiomByNorm.get(k).push(it);
});

const found = new Map();   /* norm → { oral:[], idiom:[] } */
oral.forEach((o) => {
  const k = norm(o.sentence);
  if (!idiomByNorm.has(k)) return;
  if (!found.has(k)) found.set(k, { oral: [], idiom: idiomByNorm.get(k) });
  found.get(k).oral.push(o);
});

/* ---- 读登记表 ---- */
const allowPath = path.join(ROOT, ALLOWLIST);
if (!fs.existsSync(allowPath)) {
  console.error(`[cross-dup] 找不到登记表 ${ALLOWLIST} → 拒绝静默通过`);
  process.exit(1);
}
const allowed = JSON.parse(fs.readFileSync(allowPath, 'utf8'));
const list = Array.isArray(allowed.entries) ? allowed.entries : [];
const byNorm = new Map(list.map((e) => [e.norm, e]));

/* ---- 双向校验 ---- */
const errs = [];
const rows = [];
let identical = 0, variant = 0;

found.forEach((v, k) => {
  const e = byNorm.get(k);
  const oralSentences = [...new Set(v.oral.map((x) => x.sentence))];
  const idiomSentences = [...new Set(v.idiom.map((x) => x.sentence))];
  /* 事实类别：两库文本集合是否完全一致 */
  const sameText = oralSentences.length === 1 && idiomSentences.length === 1
    && oralSentences[0] === idiomSentences[0];
  const kind = sameText ? 'identical' : 'punct-variant';

  rows.push({
    norm: k,
    kind,
    oral: oralSentences.join(' | '),
    idiom: idiomSentences.join(' | '),
    decks: [...new Set(v.oral.map((x) => x.deck))].join(', '),
    cidOral: [...new Set(v.oral.map((x) => x.cid))].join(','),
    cidIdiom: [...new Set(v.idiom.map((x) => x.cid))].join(','),
    registered: !!e,
  });

  if (!e) {
    errs.push(`未登记：${JSON.stringify(oralSentences[0])}（口语 ${v.oral.map((x) => x.deck).join('/')} 与惯用语库重复）→ 请判断该不该重复，并登记进 ${ALLOWLIST}`);
    return;
  }
  if (e.kind !== kind) {
    errs.push(`登记过期：${JSON.stringify(oralSentences[0])} 登记为 ${e.kind}，实测为 ${kind} → 更新登记（两库文本已变动？）`);
  }
  if (kind === 'identical') identical++; else variant++;
});

byNorm.forEach((e, k) => {
  if (!found.has(k)) errs.push(`登记失效：${JSON.stringify(e.oral)} 在白名单里，但两库已不再重复 → 从 ${ALLOWLIST} 删除`);
});

/* ---- 输出 ---- */
console.log(`[cross-dup] 口语 ${oral.length} 句 / 习语 ${idioms.length} 句 → 跨源重复 ${found.size} 条`
  + `（文本全同 ${identical} · 仅标点变体 ${variant}）`);
rows.sort((a, b) => (a.kind === b.kind ? a.norm.localeCompare(b.norm) : a.kind.localeCompare(b.kind)));
rows.forEach((r) => {
  console.log(`  [${r.kind}] ${JSON.stringify(r.oral)}`);
  if (r.kind === 'punct-variant') {
    console.log(`      习语库写作 ${JSON.stringify(r.idiom)} → cid 不同（${r.cidOral} vs ${r.cidIdiom}；仅标点差异，与进度无关）`);
  }
  console.log(`      口语 deck: ${r.decks}`);
});

if (errs.length) {
  console.error('\n[cross-dup] ✗ ' + errs.length + ' 处口径不符：');
  errs.forEach((e) => console.error('  · ' + e));
  process.exit(1);
}
console.log(`[cross-dup] ✓ 跨源重复 ${found.size} 条全部已登记（口径见脚本头注）`);
