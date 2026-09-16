/**
 * book-decks.mjs —— 生成最终 deck 结构（管线第 2 环）
 *
 * 输入：extra/oral-book/book.json     （解析结果，入库）
 * 输出：extra/oral-book/decks.json    （入库：装配层唯一的结构真相）
 *
 * 规则（原 book-plan.md 第六节修正）：
 *   - 节 ≤ 70 句 → 一个 deck
 *   - 节 > 70 句 → 按 ● 子场景「连续同 topic 段」贪心装箱，每箱 ≤ MAX
 *   - 末箱不足 MIN 时并入前一箱（宁可略超 MAX，也不留碎课）
 * id 规范：oral-<章>-<节>；拆分子 deck 追加 -<k>
 * 去重口径与 book-dedup.mjs 一致（归一化 en，保留首次出现）
 *
 * 用法：node scripts/book-decks.mjs
 */
import fs from 'node:fs';
/* 「续行片段」判据的唯一实现（同目录）——书里以标点开头的续写片段不作独立练习单元。
   此前本脚本不剔除它，于是 decks.json 的 count/sentences 仍含那 1 条（ch7-36），
   而下游 mk-fast-spec / gen-fast-content 会跳过它 → 报告永远显示「待铺 1 句」、到不了 100%。
   口径与 book-section.mjs 保持一致，一处判定、全链共用。 */
import { isContinuation } from './book-section.mjs';

const MAX = 70;
const MIN_TAIL = 15;
const BOOK = 'extra/oral-book/book.json';
const OUT = 'extra/oral-book/decks.json';

const recs = JSON.parse(fs.readFileSync(BOOK, 'utf8'));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* 全局去重（保留首次出现）；续行片段先剔除 —— 跳过数必须可见，否则等于静默丢句 */
const seen = new Set();
const keep = [];
let contSkip = 0;
recs.forEach((r) => {
  if (isContinuation(r.en)) { contSkip += 1; return; }
  const k = norm(r.en);
  if (seen.has(k)) return;
  seen.add(k);
  keep.push(r);
});
if (contSkip) console.log('续行片段（以标点开头，不作独立练习单元）跳过 ' + contSkip + ' 句');

/* 章节标题（按首次出现顺序） */
const chapters = [];
keep.forEach((r) => {
  if (!chapters.some((c) => c.no === r.ch)) chapters.push({ no: r.ch, title: r.chTitle });
});
chapters.sort((a, b) => a.no - b.no);

/* 按节分组 */
const sections = [];
keep.forEach((r) => {
  const key = r.ch + '-' + r.sec;
  let e = sections.find((s) => s.key === key);
  if (!e) { e = { key, ch: r.ch, sec: r.sec, title: r.secTitle, chTitle: r.chTitle, items: [] }; sections.push(e); }
  e.items.push(r);
});
sections.sort((a, b) => (a.ch - b.ch) || (a.sec - b.sec));

/* 把一节的句子切成「连续同 topic」段 */
function topicRuns(items) {
  const runs = [];
  items.forEach((it) => {
    const t = it.topic || '';
    const last = runs[runs.length - 1];
    if (last && last.topic === t) last.items.push(it);
    else runs.push({ topic: t, items: [it] });
  });
  return runs;
}

/* 贪心装箱 */
function packRuns(runs, max) {
  const boxes = [];
  let cur = { runs: [], n: 0 };
  runs.forEach((run) => {
    if (cur.n && cur.n + run.items.length > max) { boxes.push(cur); cur = { runs: [], n: 0 }; }
    cur.runs.push(run);
    cur.n += run.items.length;
  });
  if (cur.n) boxes.push(cur);
  /* 末箱过碎 → 并入前一箱 */
  if (boxes.length > 1 && boxes[boxes.length - 1].n < MIN_TAIL) {
    const tail = boxes.pop();
    const prev = boxes[boxes.length - 1];
    prev.runs = prev.runs.concat(tail.runs);
    prev.n += tail.n;
  }
  return boxes;
}

const decks = [];
const report = [];
sections.forEach((sec) => {
  const baseId = `oral-${sec.ch}-${sec.sec}`;
  if (sec.items.length <= MAX) {
    decks.push({
      id: baseId,
      chapter: sec.ch,
      chapterTitle: sec.chTitle,
      section: `${sec.ch}.${sec.sec}`,
      sectionTitle: sec.title,
      topic: '',
      topics: [...new Set(sec.items.map((x) => x.topic).filter(Boolean))],
      name: `日常口语 8000 · ${sec.title}`,
      short: sec.title,
      count: sec.items.length,
      sentences: sec.items.map((x) => x.en),
    });
    report.push(`  ${String(sec.items.length).padStart(4)}  ${baseId.padEnd(12)} ${sec.title}（整节）`);
    return;
  }
  const runs = topicRuns(sec.items);
  const boxes = packRuns(runs, MAX);
  boxes.forEach((box, k) => {
    const topics = [...new Set(box.runs.map((r) => r.topic).filter(Boolean))];
    const label = topics.length ? (topics.length === 1 ? topics[0] : `${topics[0]}～${topics[topics.length - 1]}`) : `第${k + 1}部分`;
    decks.push({
      id: `${baseId}-${k + 1}`,
      chapter: sec.ch,
      chapterTitle: sec.chTitle,
      section: `${sec.ch}.${sec.sec}`,
      sectionTitle: sec.title,
      topic: label,
      topics,
      name: `日常口语 8000 · ${sec.title} · ${label}`,
      short: label,
      count: box.n,
      sentences: box.runs.flatMap((r) => r.items.map((x) => x.en)),
    });
    report.push(`  ${String(box.n).padStart(4)}  ${(baseId + '-' + (k + 1)).padEnd(12)} ${sec.title} · ${label}`);
  });
});

console.log(`原书去重后 ${keep.length} 句 → ${decks.length} 个 deck（原 ${sections.length} 节）`);
console.log('');
report.forEach((r) => console.log(r));
console.log('');
console.log('deck 总句数:', decks.reduce((a, d) => a + d.count, 0));
console.log('deck 名最长:', Math.max(...decks.map((d) => d.name.length)), '字符 →', decks.map((d) => d.name).sort((a, b) => b.length - a.length)[0]);
console.log('short 最长:', Math.max(...decks.map((d) => d.short.length)), '字符 →', decks.map((d) => d.short).sort((a, b) => b.length - a.length)[0]);
console.log('句数分布: <10:' + decks.filter((d) => d.count < 10).length + '  10-70:' + decks.filter((d) => d.count >= 10 && d.count <= 70).length + '  >70:' + decks.filter((d) => d.count > 70).length);

fs.writeFileSync(OUT, JSON.stringify({ chapters, decks }, null, 1) + '\n', 'utf8');
console.log('\n已写 ' + OUT);
