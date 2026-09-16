/**
 * clean-book-punct.mjs · 清理英文字段里混入的 **CJK 标点**（书排版残留）
 *
 * 背景：原书是中文排版，个别英文句子末尾用了中文句号「。」；也有「……」（中文省略号）
 *       跟在句末标点之后、「，」（全角逗号）、「￥」（全角日元符）。这些字符进了 `en`
 *       字段 → 会原样进入练习题面（用户会看到 `I have to vacuum my room。`）。
 *
 * 什么**不**动（英文排版本来就合法，不是瑕疵）：
 *   · 弯引号 “ ” ‘ ’（U+201C/D/18/19）—— 英文印刷体标准引号
 *   · 省略号 …（U+2026 单个）—— 英文排版标准省略符
 *   · é 等带变音符字母
 *
 * 规则（幂等；只改英文字段，中文 cn 一律不动）：
 *   R1  句尾孤立的「……」（排版「待续」符，前面已有句末标点）→ 整段剥离
 *   R2  CJK 标点 → ASCII 等价：。→.  ，→,  ？→?  ！→!  ；→;  ：→:  、→,
 *   R3  全角 ￥ → ¥
 *
 * 覆盖对象（全部在**入库位**）：
 *   extra/oral-book/book.json          en
 *   extra/oral-book/content/*.json     sentence + chunks
 *   extra/fast-spec-*.json             sentence + chunks
 *   （chunks 逐段同规则；R1 只作用于**末段**，保证「chunks 拼接 === sentence」不被破坏）
 *
 * 用法：node scripts/clean-book-punct.mjs [--dry]
 * 退出码：0 = 无错（可能 0 改动）；1 = 破坏性检测失败（改后拼接 ≠ sentence）→ 不写盘
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

/* R2 映射表（键为 CJK 标点） */
const MAP = { '。': '.', '，': ',', '？': '?', '！': '!', '；': ';', '：': ':', '、': ',', '￥': '¥' };
const CJK_PUNCT = new RegExp('[' + Object.keys(MAP).join('') + ']', 'g');
/* ⚠️ test 必须用**不带 g** 的正则：带 g 的 .test() 会推进 lastIndex，连续调用结果会错乱 */
const CJK_TEST = new RegExp('[' + Object.keys(MAP).join('') + ']');
/* R1：句尾「空白 + 1 个以上 …」—— 只处理**前面隔着空白**的情形（如 `kindness. ……`，
   那是中文排版的「待续」残留）。紧跟标点、无空白的 `you,…` 是**语义省略号**，必须保留。 */
const TAIL_ELLIPSIS = /\s+…+\s*$/;

const hasPunct = (s) => CJK_TEST.test(s) || TAIL_ELLIPSIS.test(s);
const cleanOne = (s) => String(s).replace(TAIL_ELLIPSIS, '').replace(CJK_PUNCT, (c) => MAP[c]);

/* 收集改动明细 */
const changes = [];
const broken = [];

function fixStr(where, field, s) {
  if (typeof s !== 'string' || !hasPunct(s)) return s;
  const out = cleanOne(s);
  if (out !== s) changes.push({ where, field, from: s, to: out });
  return out;
}

/* ---------- 1. book.json（en） ---------- */
const BOOK = path.join(ROOT, 'extra/oral-book/book.json');
const book = JSON.parse(fs.readFileSync(BOOK, 'utf8'));
book.forEach((r, i) => {
  const en2 = fixStr('book.json', 'en#' + i, r.en);
  if (en2 !== r.en) {
    /* 同步 raw 里的同一子串，保持 raw 与 en 一致（raw = en + "(" + cn + ")"） */
    if (typeof r.raw === 'string' && r.raw.includes(r.en)) r.raw = r.raw.replace(r.en, en2);
    r.en = en2;
  }
});

/* ---------- 2. content/*.json（sentence + chunks） ---------- */
const CONTENT_DIR = path.join(ROOT, 'extra/oral-book/content');
const contentFiles = fs.existsSync(CONTENT_DIR)
  ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).map((f) => 'extra/oral-book/content/' + f)
  : [];

/* ---------- 3. extra/fast-spec-*.json（sentence + chunks） ---------- */
const specFiles = fs.readdirSync(path.join(ROOT, 'extra'))
  .filter((f) => /^fast-spec-.*\.json$/.test(f))
  .map((f) => 'extra/' + f);

const itemFiles = [...contentFiles, ...specFiles];
const itemData = new Map();

/* 原格式探测：写回必须**逐字节保持原格式**，否则一个标点修复会炸出全文件重排的 diff */
function detectFmt(raw, parsed) {
  for (const [name, ind] of [['compact', 0], ['indent1', 1], ['indent2', 2], ['tab', '\t']]) {
    if (JSON.stringify(parsed, null, ind) + '\n' === raw) return { name, ind };
  }
  return null;
}

for (const rel of itemFiles) {
  const abs = path.join(ROOT, rel);
  const raw = fs.readFileSync(abs, 'utf8');
  const items = JSON.parse(raw);
  const fmt = detectFmt(raw, items);
  const snapBefore = JSON.stringify(items);
  items.forEach((it, i) => {
    const sentence2 = fixStr(rel, 'sentence#' + i, it.sentence);
    /* chunks：R1 只作用于末段 */
    if (Array.isArray(it.chunks)) {
      it.chunks = it.chunks.map((c, ci) => {
        const last = ci === it.chunks.length - 1;
        return fixStr(rel, 'chunks#' + i + '.' + ci, last ? c : String(c).replace(CJK_PUNCT, (x) => MAP[x]));
      });
    }
    if (sentence2 !== it.sentence) it.sentence = sentence2;
    /* 破坏性自检：拼接必须仍等于 sentence（去空白比较） */
    const j = (a) => a.join('').replace(/\s+/g, '');
    if (Array.isArray(it.chunks) && j(it.chunks) !== j([it.sentence])) {
      broken.push(rel + ' #' + i + ' ' + JSON.stringify(it.sentence) + ' vs ' + JSON.stringify(it.chunks));
    }
  });
  itemData.set(rel, { items, fmt, dirty: snapBefore !== JSON.stringify(items) });
}

/* ---------- 报告 ---------- */
console.log('扫描：book.json + ' + contentFiles.length + ' 个内容文件 + ' + specFiles.length + ' 个 spec');
if (!changes.length) console.log('\n无 CJK 标点混入，无需改动 ✅');
changes.forEach((c) => {
  console.log('  · ' + c.where + ' [' + c.field + ']');
  console.log('      - ' + JSON.stringify(c.from));
  console.log('      + ' + JSON.stringify(c.to));
});
if (broken.length) {
  console.log('\n✗ 破坏性自检失败 ' + broken.length + ' 处（改后 chunks 拼接 ≠ sentence）→ 不写盘：');
  broken.forEach((b) => console.log('   ' + b));
  process.exit(1);
}

if (DRY) { console.log('\n--dry：共 ' + changes.length + ' 处，未写盘'); process.exit(0); }

/* ---------- 写盘（只写真正有改动的文件；格式无法识别则拒绝） ---------- */
if (changes.length) {
  fs.writeFileSync(BOOK, JSON.stringify(book) + '\n', 'utf8');
  let n = 0;
  const refuse = [];
  for (const [rel, rec] of itemData) {
    if (!rec.dirty) continue;
    if (!rec.fmt) { refuse.push(rel); continue; }
    fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(rec.items, null, rec.fmt.ind) + '\n', 'utf8');
    n++;
  }
  console.log('\n已写盘：book.json + ' + n + ' 个条目文件（共 ' + changes.length + ' 处改动）');
  if (refuse.length) {
    console.log('✗ 以下文件有改动但原格式无法识别 → 拒绝写回（fail-closed，避免全文件重排）：');
    refuse.forEach((r) => console.log('   ' + r));
    process.exit(1);
  }
} else {
  console.log('\n无改动，未写盘');
}
