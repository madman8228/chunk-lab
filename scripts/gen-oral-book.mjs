/**
 * gen-oral-book.mjs —— 生成 oral-book.js（「日常口语 8000」唯一内容源，build 期使用，页面不加载）
 *
 * ⚠️ 输入全部为**入库文件**（extra/oral-book/，随仓库分发）；输出 oral-book.js 是**构建产物、不入库**
 *    （否则「产物在库、输入不在库」＝ 假的可复现）。新 clone 由 `npm test` 的 pretest 自动补齐。
 *
 * 输入：
 *   extra/oral-book/book.json          —— 书的逐句清单（ch/sec/topic/en/cn，2898 条解析结果）
 *   extra/oral-book/decks.json         —— 64 个书 deck 的结构（含每 deck 的书句清单）
 *   extra/oral-book/content/*.json     —— 已产出的书内容（按节存放）
 *   extra/oral-book/assign.mjs         —— 现有 496 句的归入表
 *   extra/oral-book/base/*.js          —— 迁移前的 builtins.js / oral8000.js（现有 496 句的内容来源）
 * 输出：
 *   oral-book.js                       —— window.ORAL_BOOK = { series, chapters, decks }
 *   output/oral-book-report.md         —— 装配报告（逐 deck 统计 + 进度 + 待补缺口）
 *
 * 用法：node scripts/gen-oral-book.mjs   （之后必须再跑 gen-builtins-stub.mjs —— 它反查本文件的产物）
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { ASSIGN, validate } from '../extra/oral-book/assign.mjs';
import { cleanDistractors } from '../js/distractor-validate.mjs';

const ROOT = process.cwd();
/* 书管线的输入根：入库位（不再是 gitignore 的 output/） */
const SRC = 'extra/oral-book';
function run(file, win) {
  const ctx = { window: win || {}, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx.window;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function fnv8(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}

/* ---------- 1. 现有 496 句（从迁移前的基线读，源文件已改为空壳/迁移表） ---------- */
const bw = run(SRC + '/base/builtins.js');
const exist = [];
(bw.BUILTIN || []).forEach((d) => { if (d.builtin) (d.items || []).forEach((it) => exist.push(it)); });
const ow = run(SRC + '/base/oral8000.js', { BUILTIN: { push() {}, concat() { return []; } } });
(ow.DATA_ORAL8000 || []).forEach((it) => exist.push(it));
if (exist.length !== 496) throw new Error('现有句数应为 496，实际 ' + exist.length);

const { errs } = validate(496);
if (errs.length) throw new Error('归入表有问题：' + errs.join('; '));
const existByNorm = new Map();
exist.forEach((it) => { if (!existByNorm.has(norm(it.sentence))) existByNorm.set(norm(it.sentence), it); });

/* ---------- 2. deck 结构 ---------- */
const { chapters, decks: bookDecks } = JSON.parse(fs.readFileSync(SRC + '/decks.json', 'utf8'));

/* ---------- 3. 已产出的书内容（按节） ---------- */
const bookContent = {};
const contentDir = SRC + '/content';
for (const f of fs.readdirSync(contentDir)) {
  if (!f.endsWith('.json')) continue;
  const m = /^oral-(\d+)-(\d+)\.json$/.exec(f);
  if (!m) throw new Error('书内容文件名不符合 oral-<章>-<节>.json：' + f);
  bookContent[m[1] + '.' + m[2]] = JSON.parse(fs.readFileSync(contentDir + '/' + f, 'utf8'));
}

/* ---------- 3b. 书句认领表 ----------
   根因：同一句现有句有两条入库路径 —— 4a（书句命中现有句，保留现有 cid + 详解）
   与 4b（ASSIGN 把现有句归入某个 deck）。两条路径各自只查**本 deck 内**的 used 集合，
   于是同一句会被两个 deck 各收一次 → cid 跨 deck 重复。
   实例：It doesn't matter. 书属 4.23「不感兴趣时」，而 ASSIGN 把它归给 4.20「安慰时」。
   修法（根因）：**书句优先认领** —— 凡在书内已产出内容的句子，归属由书决定；
   ASSIGN 只负责收纳「书里没有、或该节尚未铺」的旧句。
   ⚠️ 必须在装配循环之前建表：否则先处理的 deck 会靠 4b 抢走归属。 */
const claimedByBook = new Set();
for (const bd of bookDecks) {
  const c = bookContent[bd.section] || [];
  if (!c.length) continue;
  const have = new Set(c.map((x) => norm(x.sentence)));
  bd.sentences.forEach((en) => { if (have.has(norm(en))) claimedByBook.add(norm(en)); });
}

/* ---------- 4. 装配 ---------- */
const decks = [];
const report = [];
let totalBook = 0, totalExist = 0, dupUse = 0;
/* 「归属让位书句」计数：4b/4c 因 claimedByBook 而跳过的旧句（必须可见，否则静默丢句无人发现） */
let yieldToBook = 0;

for (const bd of bookDecks) {
  const items = [];
  const used = new Set();

  /* 4a. 书里已产出的句子（按书序） */
  const content = bookContent[bd.section] || [];
  const contentByNorm = new Map();
  content.forEach((c) => { if (!contentByNorm.has(norm(c.sentence))) contentByNorm.set(norm(c.sentence), c); });
  let bookN = 0;
  bd.sentences.forEach((en) => {
    const c = contentByNorm.get(norm(en));
    if (!c) return;                       /* 尚无内容 → 待快档补 */
    const ex = existByNorm.get(norm(en));
    if (ex) {
      /* 与现有句重复：保留现有 cid + 现有详解（用户进度不丢） */
      items.push(Object.assign({}, ex));
      used.add(norm(en));
      dupUse++;
    } else {
      const it = Object.assign({}, c);
      if (!it.cid) it.cid = fnv8(it.sentence);
      items.push(it);
    }
    bookN++;
  });

  /* 4b. 归入本 deck 的现有句（去重后追加） */
  let existN = 0;
  const ranges = ASSIGN[bd.id] || [];
  ranges.forEach(([a, b]) => {
    for (let i = a; i <= b; i++) {
      const it = exist[i];
      if (!it) throw new Error('归入索引越界：' + bd.id + ' ' + i);
      const k = norm(it.sentence);
      if (used.has(k)) continue;          /* 已在书句部分用掉 */
      if (claimedByBook.has(k)) { yieldToBook++; continue; } /* 书内已认领该句 → 归属以书为准（防跨 deck cid 重复） */
      items.push(Object.assign({}, it));
      used.add(k);
      existN++;
    }
  });

  totalBook += bookN; totalExist += existN;
  /* cid 唯一性自检 */
  const cids = new Set();
  items.forEach((it) => { if (cids.has(it.cid)) throw new Error(bd.id + ' cid 重复：' + it.cid); cids.add(it.cid); });

  if (!items.length) { report.push({ bd, bookN, existN, n: 0, skip: true }); continue; }

  const owned = Math.max(0, bd.count - bookN);
  decks.push({
    id: bd.id,
    chapter: bd.chapter,
    section: bd.section,
    sectionTitle: bd.sectionTitle,
    topic: bd.topic || '',
    name: bd.name,
    short: bd.short,
    desc: bd.topic ? bd.topic : bd.sectionTitle,
    topics: bd.topics || [],
    items,
  });
  report.push({ bd, bookN, existN, n: items.length, skip: false, owned });
}

/* 4c. 自建 deck：万能表达（收纳无明确场景的口头禅） */
{
  const bd = {
    id: 'oral-basic', chapter: 0, section: '0', sectionTitle: '万能表达', topic: '',
    name: '日常口语 8000 · 万能表达', short: '万能表达', topics: [],
  };
  const items = [];
  const used = new Set();
  (ASSIGN['oral-basic'] || []).forEach(([a, b]) => {
    for (let i = a; i <= b; i++) {
      const it = exist[i];
      const k = norm(it.sentence);
      if (used.has(k)) continue;
      /* ⚠️ 4c 原先漏了这道守卫（4b 有、4c 没有）→ 书里出现同一句时跨 deck cid 重复。
         实例：No problem. 书属 3.13-2「接受请求和建议」，同时被 ASSIGN 收进万能表达。
         同一条规则必须两处都实现 —— 只补一处的教训（本项目「同一事实多处实现」家族）。 */
      if (claimedByBook.has(k)) { yieldToBook++; continue; }
      items.push(Object.assign({}, it));
      used.add(k);
    }
  });
  totalExist += items.length;
  decks.push({
    id: bd.id, chapter: 0, section: '0', sectionTitle: bd.sectionTitle, topic: '',
    name: bd.name, short: bd.short, desc: '没有固定场景、随时能用的万能句', topics: [], items,
  });
  report.push({ bd, bookN: 0, existN: items.length, n: items.length, skip: false, owned: 0 });
}
if (yieldToBook) {
  console.log('归属让位书句：' + yieldToBook + ' 句（书内已产出的句子一律按书归属，ASSIGN / 自建 deck 不再重复收入）');
}

/* ---------- 4d. 干扰项过写侧守门员（cleanDistractors） ----------
   根因：extra/oral-book/content/*.json 由批量生成直接落盘，未经写侧清洗 → 混入与句内
   chunk 归一化撞车的条目（如 chunk「It's」的干扰项「Its」：norm 去撇号后相同）。
   运行时 buildChoices 会按 norm 静默丢弃这类条目、写侧 cleanDistractors 也丢
   → 预置可用量无谓缩水。这里统一过闸，使 oral-book.js 只含合格干扰项。
   淘汰明细写入报告，供后续回头改进素材（不是静默吞掉）。 */
let distSlots = 0, distReceived = 0, distDropped = 0;
const distDroppedDetail = [];
decks.forEach((d) => d.items.forEach((it) => {
  if (!Array.isArray(it.distractors)) return;
  const r = cleanDistractors(it, it.distractors);
  if (!r.ok) throw new Error(d.id + ':' + it.cid + ' 干扰项外层长度错位 → ' + r.error);
  distSlots += r.stats.perChunk.length;
  distReceived += r.stats.received;
  if (r.stats.dropped) {
    distDropped += r.stats.dropped;
    distDroppedDetail.push(d.id + ':' + it.cid + '「' + it.sentence + '」丢 ' + r.stats.dropped + ' 条');
  }
  it.distractors = r.distractors;
}));
console.log('干扰项过闸：' + distSlots + ' 槽 / 收 ' + distReceived + ' 条，淘汰 ' + distDropped + ' 条（涉及 ' + distDroppedDetail.length + ' 句）');

/* ---------- 5. 输出 ---------- */
const chapterList = [{ no: 0, title: '万能表达（无固定场景）' }].concat(chapters);
const OUT = {
  series: '日常口语 8000',
  source: '《英语口语 8000 句·简版》(解析结果见 extra/oral-book/book.json)',
  chapters: chapterList,
  decks,
};
const body = '/* oral-book.js · 日常口语 8000 · 唯一内容源（构建期使用，页面不直接加载）\n'
  + '   生成脚本：scripts/gen-oral-book.mjs（改内容请改 extra/oral-book/content/ 后重跑，不要手改本文件）\n'
  + '   本文件是构建产物、**不入库**；新 clone 由 npm test 的 pretest 自动生成\n'
  + '   deck id 规范：oral-<章>-<节>[-子序号]；oral-basic = 自建「万能表达」\n'
  + '   页面只通过 content/manifest.json + 分片读取内容（见 js/content-repository.js）。 */\n'
  + 'window.ORAL_BOOK = ' + JSON.stringify(OUT, null, 1) + ';\n';
fs.writeFileSync('oral-book.js', body, 'utf8');
console.log('已写 oral-book.js  ' + (Buffer.byteLength(body) / 1024).toFixed(0) + ' KB  ' + decks.length + ' 个 deck');
console.log('书已产出句 ' + totalBook + ' / 现有句 ' + totalExist + '（其中 ' + dupUse + ' 句与书重复，已按现有 cid 落位）');

/* 报告
   进度口径（2026-09-16 老板拍板）：第一阶段目标 = **把《英语口语 8000 句·简版》这本书做完**，
   而不是凑满 8000 句。书内去重后共 2797 句，铺满 + 习语库 418 句 ≈ 3711 句 —— 到不了 8000，
   差额需第二内容源，属长期方向。
   ⚠️ 系列名「日常口语 8000」是产品名，**不作进度分母**（分母 = 书内总句数）。 */
/* ⚠️ 自建的「万能表达」deck（上面的 push）没有 count 字段，直接相加会得 NaN */
const bkAll = report.reduce((a, r) => a + (Number(r.bd.count) || 0), 0);
const bkLeft = report.reduce((a, r) => a + (Number(r.skip ? r.bd.count : r.owned) || 0), 0);
const bkDone = bkAll - bkLeft;
const bkPct = bkAll ? ((bkDone / bkAll) * 100).toFixed(1) : '0.0';
const now = new Date();
const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

const lines = [];
lines.push('# oral-book 装配报告（' + today + '）');
lines.push('');
lines.push('## 进度（第一阶段口径：把这本书做完）');
lines.push('');
lines.push('| 项 | 句数 |');
lines.push('|---|---|');
lines.push('| 书内总句数（去重后） | ' + bkAll + ' |');
lines.push('| 已铺进 deck | ' + bkDone + ' |');
lines.push('| **书内待铺** | **' + bkLeft + '** |');
lines.push('| 完成度 | ' + bkPct + '% |');
lines.push('');
lines.push('> **口径**：第一阶段目标 = 把《英语口语 8000 句·简版》做完（书 ' + bkAll + ' 句 + 习语库 418 句 ≈ 3711 句）。');
lines.push('> 系列名「日常口语 8000」保留为产品名，但**不作进度分母**——简体版全书仅 ' + bkAll + ' 句，');
lines.push('> 铺满也到不了 8000，差额需第二内容源（长期方向）。');
lines.push('');
lines.push('| # | deck id | 名称 | 书已产出 | 现有并入 | 合计 | 书待补 |');
lines.push('|---|---|---|---|---|---|---|');
report.forEach((r, i) => {
  if (r.skip) { lines.push('| - | ' + r.bd.id + ' | ' + r.bd.name + ' | 0 | 0 | **0（未上线）** | ' + r.bd.count + ' |'); return; }
  lines.push('| ' + (i + 1) + ' | `' + r.bd.id + '` | ' + r.bd.name + ' | ' + r.bookN + ' | ' + r.existN + ' | **' + r.n + '** | ' + r.owned + ' |');
});
const skipped = report.filter((r) => r.skip);
lines.push('');
lines.push('## 未上线的 deck（' + skipped.length + ' 个，等快档内容）');
lines.push('');
lines.push(skipped.map((r) => '- `' + r.bd.id + '` ' + r.bd.name + '（' + r.bd.count + ' 句）').join('\n'));
lines.push('');
lines.push('合计：上线 ' + decks.length + ' 个 deck / ' + decks.reduce((a, d) => a + d.items.length, 0) + ' 句；未上线 ' + skipped.length + ' 个。');
lines.push('');
lines.push('**书内待铺 ' + bkLeft + ' 句**（已铺 ' + bkDone + ' / ' + bkAll + '，完成度 ' + bkPct + '%）。');
lines.push('');
lines.push('## 干扰项过闸淘汰明细（写侧 cleanDistractors）');
lines.push('');
lines.push('共淘汰 ' + distDropped + ' 条（oral-book.js 已不含；运行时本也会按 norm 丢弃）。');
if (distDroppedDetail.length) {
  lines.push('');
  lines.push(distDroppedDetail.map((s) => '- ' + s).join('\n'));
}
fs.writeFileSync('output/oral-book-report.md', lines.join('\n') + '\n', 'utf8');
console.log('已写 output/oral-book-report.md');
