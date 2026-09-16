/**
 * book-content-check.mjs · 书内容自检（与项目 validate_* 同一套规则 + 覆盖核对）
 *   node scripts/book-content-check.mjs [--level=fast|full] [file...]
 *
 * --level=fast : 只查「法定最小件」—— sentence / translation / chunks / hints（快档）
 * --level=full : 再加上 grammar / explanations / distractors（精档，默认）
 *
 * chunks 段数：单字句（Help! / Thanks.）允许 1 段，其余 ≥2、≤5
 *   —— 判据唯一实现在 js/chunk-shape.js（本项目曾把这条判据散落在 7 个文件里）
 *
 * 输入在**入库位** extra/oral-book/（不是 gitignore 的 output/）
 */
import fs from 'node:fs';
import path from 'node:path';
/* 「最少切几段」的唯一判据（含单字句例外）—— 同目录 */
import CS from '../js/chunk-shape.js';

/* 书管线输入的入库根 */
const BOOK_DIR = 'extra/oral-book';
const CONTENT_DIR = BOOK_DIR + '/content';
const BOOK_PATH = BOOK_DIR + '/book.json';

const argv = process.argv.slice(2);
const lvArg = argv.find((a) => a.startsWith('--level='));
const LEVEL = (lvArg ? lvArg.split('=')[1] : (process.env.BOOK_LEVEL || 'auto')).toLowerCase();
if (!['auto', 'fast', 'full'].includes(LEVEL)) { console.error('--level 只接受 auto | fast | full'); process.exit(2); }
const explicit = argv.filter((a) => !a.startsWith('--'));
let files = explicit;
if (!files.length) {
  /* ⚠️ 内容目录可能不存在（异常仓库状态）→ 直接 readdirSync 会 ENOENT 抛栈、把测试链打断。
     按「无内容」处理（下面有自己的判定）。 */
  try {
    files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).map((f) => CONTENT_DIR + '/' + f);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    files = [];
  }
}

const BOOK = fs.existsSync(BOOK_PATH) ? JSON.parse(fs.readFileSync(BOOK_PATH, 'utf8')) : null;

/* 输入缺失的处置（不假装检过） */
if (!files.length) {
  console.log('SKIP: ' + CONTENT_DIR + '/ 下没有内容文件——无内容可检');
  process.exit(0);
}

console.log('档位: ' + LEVEL + '  文件数: ' + files.length);
console.log('');
if (!BOOK) {
  console.error('✗ 找不到 ' + BOOK_PATH + ' → 无法做「句子是否属于原书该节」的覆盖校验');
  console.error('  这不是「无内容可检」，而是**缺少校验依据** → 拒绝静默通过（fail-closed）');
  process.exit(1);
}

let totalErr = 0;
for (const f of files) {
  const items = JSON.parse(fs.readFileSync(f, 'utf8'));
  const errs = [];
  const warns = [];
  const joined = (a) => a.join('').replace(/\s+/g, '');

  /* 该文件对应的节（由文件名 oral-<ch>-<sec>.json 推出）
     ⚠️ 命名不符时必须**报错**，不能静默跳过覆盖校验（fail-closed） */
  const m = path.basename(f).match(/^oral-(\d+)-(\d+)\.json$/);
  const sec = m ? { ch: Number(m[1]), sec: Number(m[2]) } : null;
  if (!sec) errs.push('文件名不符合 oral-<章>-<节>.json，覆盖校验被跳过（fail-closed）');

  items.forEach((it, i) => {
    const tag = '#' + i + ' ' + (it.sentence || '?');
    /* 档位：auto = 按条目自身判定（有 grammar 就按精档要求） */
    const full = LEVEL === 'full' || (LEVEL === 'auto' && 'grammar' in it);
    if (!it.sentence) errs.push(tag + ' 缺 sentence');
    if (!it.translation) errs.push(tag + ' 缺 translation');
    /* 段数下限按句子形态定：单字句（Help! / Thanks.）允许 1 段，其余 ≥2 —— 见 chunk-shape.js */
    if (!CS.chunkCountOk(it.sentence, it.chunks)) errs.push(tag + ' ' + CS.chunkCountError(it.sentence, it.chunks));
    if (it.chunks && (it.chunks.some((c) => typeof c !== 'string' || !c.trim()))) errs.push(tag + ' chunks 含空片');
    if (!Array.isArray(it.hints) || it.hints.length !== (it.chunks || []).length) errs.push(tag + ' hints 数与 chunks 不符');
    if (joined(it.chunks || []) !== joined([it.sentence || ''])) errs.push(tag + ' chunks 拼接 ≠ sentence');
    if (full) {
      if (!Array.isArray(it.grammar) || it.grammar.length !== (it.chunks || []).length) errs.push(tag + ' grammar 数与 chunks 不符');
      (it.grammar || []).forEach((g, gi) => {
        if (!g.role) errs.push(tag + ' grammar[' + gi + '] 缺 role');
        if (!/^#[0-9a-f]{6}$/i.test(g.color || '')) errs.push(tag + ' grammar[' + gi + '] color 非法: ' + g.color);
        if (!Array.isArray(g.phonetic) || !g.phonetic.length) errs.push(tag + ' grammar[' + gi + '] 缺 phonetic');
        if (!g.pos) errs.push(tag + ' grammar[' + gi + '] 缺 pos');
        if (!g.meaning) errs.push(tag + ' grammar[' + gi + '] 缺 meaning');
      });
      const D = it.distractors;
      if (!Array.isArray(D) || D.length !== (it.chunks || []).length) {
        errs.push(tag + ' distractors 槽数 ≠ chunks');
      } else {
        D.forEach((slot, si) => {
          if (!Array.isArray(slot) || slot.length < 2) errs.push(tag + ' 槽[' + si + '] 干扰项 <2');
          slot.forEach((d) => {
            if (typeof d !== 'string' || !d.trim()) errs.push(tag + ' 槽[' + si + '] 空干扰项');
            if (d.length > 120) errs.push(tag + ' 槽[' + si + '] 干扰项超长');
            /* 负向：干扰项不得等于正确 chunk（去空格比较） */
            if (joined([d]) === joined([it.chunks[si]])) errs.push(tag + ' 槽[' + si + '] 干扰项与正确项相同: ' + d);
          });
          /* 槽内自重复 */
          const s = new Set(slot.map((x) => joined([x])));
          if (s.size !== slot.length) errs.push(tag + ' 槽[' + si + '] 干扰项内部重复');
        });
      }
      if (!Array.isArray(it.explanations) || it.explanations.length < 1) errs.push(tag + ' 缺 explanations');
    }
  });

  /* 重复 sentence */
  const seen = new Set();
  items.forEach((it, i) => { if (seen.has(it.sentence)) errs.push('#' + i + ' sentence 重复: ' + it.sentence); seen.add(it.sentence); });

  /* 覆盖：该节的每句是否都有内容 */
  if (sec) {
    const bookSec = BOOK.filter((r) => r.ch === sec.ch && r.sec === sec.sec);
    const have = new Set(items.map((x) => x.sentence));
    const missing = bookSec.filter((r) => !have.has(r.en));
    if (missing.length) warns.push('该节 ' + bookSec.length + ' 句，本文件 ' + items.length + ' 句，未覆盖 ' + missing.length + ' 句');
    const extra = items.filter((x) => !bookSec.some((r) => r.en === x.sentence));
    if (extra.length) errs.push('有 ' + extra.length + ' 句不在原书该节内: ' + extra.map((x) => x.sentence).join(' | '));
  }

  console.log('### ' + f + ' — ' + items.length + ' 句');
  console.log('   错误 ' + errs.length + ' / 提示 ' + warns.length);
  errs.slice(0, 20).forEach((e) => console.log('   ✗ ' + e));
  warns.forEach((w) => console.log('   ! ' + w));
  totalErr += errs.length;
}
console.log('');
console.log(totalErr ? '结果：' + totalErr + ' 处错误 ❌' : '结果：全部通过 ✅');
process.exit(totalErr ? 1 : 0);
