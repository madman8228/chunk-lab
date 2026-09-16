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
  const dedup = [...new Set(scopedSentences.map((s) => norm(s)))]
    .map((k) => scopedSentences.find((s) => norm(s) === k));

  return { bookSec, decks, inScope, dedup, cnByNorm };
}
