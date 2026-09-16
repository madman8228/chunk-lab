/**
 * book-section.mjs · 「书里某节应铺哪些句」的**唯一**实现（2026-09-16 立）
 *
 * 为什么存在：
 *   同一套口径（book 筛选 → 该节 deck 收录集合 inScope → 按书序去重）原本在
 *   gen-fast-content.mjs 里有一份、侦察/配对脚本里又要各写一份 —— 正是本项目
 *   反复踩过的「同一事实多处实现」。
 *   本模块只此一份，其余（gen-fast-content / mk-fast-spec）全部 import。
 *
 * 口径（逐字沿用 gen-fast-content 既有语义，改这里=改产物，务必复验）：
 *   bookSec  书里该节的全部条目（含 note/raw，按书序）
 *   decks    该节被拆成的 deck（大节会拆成 oral-1-1-1/2/3）
 *   inScope  decks 收录的句子集合（norm 后）
 *   dedup    该节**实际会装配**的句清单：书序 → 只留 inScope → 按 norm 去重（保留首个原文形式）
 *   cnByNorm norm(英文句) → 中文（书里第一条为准）
 */
import fs from 'node:fs';
import path from 'node:path';

/** 书管线输入的入库根（相对仓库根） */
export const BOOK_DIR = 'extra/oral-book';

/** 句子归一化：只留字母数字，用于「同一句」的判定 */
export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * 「续行片段」判据（2026-09-16 定，全库唯一实现）。
 *
 * 原书里有一类句子是上一句的**续写片段**，以标点开头，例如 ch7-36 的
 *   `..., and wish to thank you for your kindness.`
 * 它离开上文语义就不完整；而且句首标点必然撞「chunk 不得以标点开头」闸
 * （该规则在 4 个校验器里各有一份实现，不为单个条目去放宽）。
 *
 * ⇒ 口径：**不作独立练习单元**（不铺）。
 *   这个函数存在的意义不是「再加一条规则」，而是让这个跳过**可见** ——
 *   此前只靠铺节的人记得跳过（撞闸了才发现漏了一句）。
 * ⚠️ 判定只此一处，工具链按它过滤 + 打印；别在别处再写一遍正则。
 */
export const isContinuation = (s) => /^[.?!,;:]/.test(String(s == null ? '' : s).trim());

/**
 * @param {string} ROOT 仓库根
 * @param {number} ch 章
 * @param {number} sec 节
 */
export function loadBookSection(ROOT, ch, sec) {
  const B = JSON.parse(fs.readFileSync(path.join(ROOT, BOOK_DIR + '/book.json'), 'utf8'));
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, BOOK_DIR + '/decks.json'), 'utf8'));

  const bookSec = B.filter((r) => r.ch === ch && r.sec === sec);

  const cnByNorm = new Map();
  bookSec.forEach((r) => { if (!cnByNorm.has(norm(r.en))) cnByNorm.set(norm(r.en), r.cn); });

  const decks = D.decks.filter((d) => d.chapter === ch && Number(String(d.section).split('.')[1]) === sec);
  const inScope = new Set();
  decks.forEach((d) => d.sentences.forEach((s) => inScope.add(norm(s))));

  const scopedSentences = bookSec.map((r) => r.en).filter((en) => inScope.has(norm(en)));
  /* 续行片段必须在**去重之前**剔除：若先按 norm 去重、再 filter，末尾的 find()
     会按书序把那条续行片段取回来（去标点后 norm 可能与正常句相同）。 */
  const continuations = [...new Set(scopedSentences.filter(isContinuation))];
  const usable = scopedSentences.filter((s) => !isContinuation(s));
  const dedup = [...new Set(usable.map((s) => norm(s)))]
    .map((k) => usable.find((s) => norm(s) === k));

  return { bookSec, decks, inScope, dedup, continuations, cnByNorm };
}
