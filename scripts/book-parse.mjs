/**
 * book-parse.mjs —— 《英语口语 8000 句·简版》结构化解析（管线第 1 环）
 *
 * 输入：ref/英语口语8000句-简版 - 备份.txt   （⚠️ **原书不入库**：外部导入素材，见 .gitignore）
 * 输出：extra/oral-book/book.json            （入库：解析结果 = 后续所有环节的唯一书源）
 *   字段：n / line / ch / chTitle / sec / secTitle / topic / en / cn / note
 *
 * 层级：第X章 → N 节 → ●子场景 → 句子
 * 英文/中文切分优先级：
 *   ① 行尾括号，且括号前无中文 → en=(前) cn=(括号内)
 *   ② 首个中文字符处切开（前缀须含拉丁词）
 *   ③ 中文在前、英文在后
 * 清洗：en 去 [..] 音标注解 / 尾部悬空括号；cn 去包裹括号、抽 *注解 到 note
 *
 * ⚠️ 本脚本只在「换书源 / 改解析规则」时跑；跑完必须接着跑 book-decks.mjs 重出 decks.json，
 *    并复核 extra/oral-book/book.json 的 diff —— 清洗规则会改动原文，静默失真很难事后发现。
 * ⚠️ 缺 ref/ 原文时 **fail-closed**（不静默产出空库）。
 *
 * 用法：node scripts/book-parse.mjs
 */
import fs from 'node:fs';

const SRC = 'ref/英语口语8000句-简版 - 备份.txt';
const OUT = 'extra/oral-book/book.json';

if (!fs.existsSync(SRC)) {
  console.error('✗ 找不到原书：' + SRC);
  console.error('  原书是外部导入素材、不入库 → 新 clone 上本脚本不可用（这是设计如此）。');
  console.error('  extra/oral-book/book.json 已入库，正常铺节不需要原书。');
  process.exit(1);
}

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s);
const hasLatinWord = (s) => /[A-Za-z]{2,}/.test(s);
const CJK = /[\u4e00-\u9fff]/;

/* 残留补丁：解析规则覆盖不到的个别行（按原书行号→{en,cn,note}）
   这些行在前次人工校订的 book.json 中已有稳定值，必须让重新解析保持一致。
   L142 发音注记 [美 /skrʌb/] 位于句中，显式提取注记并恢复完整英文；
   L819 原书 "The clock says 3∶15 (three fifteen)." —— 读音提示保留在 note；
   L2608 原书英文缺少 "the end"，对应中文明确是“在这条路的尽头”，按上下文补全。 */
const PATCH = {
  123: { en: 'Peekaboo!', cn: '孩子们在玩藏猫游戏时常用。大人有时也半带玩乐地使用。', note: '' },
  142: { en: 'Please scrub the sink.', cn: '把厨房的池子洗干净。', note: '美 /skrʌb/' },
  143: { en: 'I have to vacuum my room.', cn: '我得用吸尘器吸吸我房间了。', note: '', raw: 'I have to vacuum my room. (我得用吸尘器吸吸我房间了。 )' },
  144: { en: 'Please dust the shelves.', cn: '掸掸柜子上的土。', note: '', raw: 'Please dust the shelves.(掸掸柜子上的土。 )' },
  159: { en: 'I usually work out after work.', cn: '我经常下班以后运动。', note: '', raw: 'I usually work out after work.(我经常下班以后运动。 )' },
  169: { en: 'I need to deposit five thousand yen in my savings account.', cn: '我要存5000日元(在我的账户上。)', note: '' },
  170: { en: 'I need to withdraw ¥5,000 from my savings account.', cn: '我要取5000日元(从我的账户上)。', note: '' },
  171: { en: 'I paid out of my own pocket.', cn: '我是自己掏的腰包。', note: '', raw: 'I paid out of my own pocket.( 我是自己掏的腰包。 )' },
  178: { en: "He didn't pay the debt and disappeared.", cn: '他因为还不上债而躲了起来。', note: '', raw: "He didn't pay the debt and disappeared.(他因为还不上债而躲了起来。 )" },
  247: { en: 'When do you have tickets?', cn: '有什么时候的票?', note: '' },
  819: { en: 'The clock says 3:15.', cn: '指针正指到3点15分。', note: '3:15 读作 three fifteen' },
  1210: { en: 'Would you repeat that, please?', cn: '您能再说一遍吗?', note: '' },
  1291: { en: "Let's talk in English.", cn: '咱们说英语吧。', note: '' },
  1379: { en: "Let's not jump the gun.", cn: '别操之过急。', note: '' },
  2529: { en: 'Business.', cn: '工作。', note: '', raw: 'Business.（工作。 ）' },
  2608: { en: "It's at the end of this street.", cn: '在这条路的尽头。', note: '' },
  3061: { en: '..., and wish to thank you for your kindness.', cn: '还有对贵方的友好表示感谢。', note: '', raw: '..., and wish to thank you for your kindness.(还有对贵方的友好表示感谢。)' },
  3173: { en: 'all along', cn: '始终/一直/一贯', note: '', raw: 'all along（ 始终/一直/一贯）', sourcePattern: /^all (?:long|along)[（(]/ }
};

let chapter = null, section = null, topic = null;
let chapterIdx = 0, lastSectionNo = 0;
const recs = [];
const skipped = [];

function push(en, cn, note, line, raw) {
  recs.push({
    n: recs.length,
    line: line,
    ch: chapter ? chapter.no : null,
    chTitle: chapter ? chapter.title : null,
    sec: section ? section.no : null,
    secTitle: section ? section.title : null,
    topic: topic ? topic.title : null,
    en: en,
    cn: cn,
    note: note || '',
    raw: raw,
    // Keep the exact input line separately from historical normalized/corrected raw.
    sourceRaw: lines[line - 1]
  });
}

/** 抽 *注解 / {注解}，返回 {text, note} */
function extractNote(s) {
  let note = '';
  const star = s.search(/\*/);
  if (star >= 0) {
    note = s.slice(star + 1);
    s = s.slice(0, star);
  }
  s = s.replace(/\{[^}]*\}/g, (m) => { note += m.slice(1, -1); return ''; });
  return { text: s, note: note };
}

/** 括号是否配平 */
function balanceOk(t) {
  let d = 0;
  for (const c of t) { if (c === '(' || c === '（') d++; else if (c === ')' || c === '）') d--; }
  return d === 0;
}

function cleanEn(s) {
  let t = s
    .replace(/\[[^\]]{1,30}\]/g, '')      /* 行内音标注解 [美 /skrʌb/] */
    /* 原书用括号标注可选词：`How's (your) married life?` / `Please write me (a letter).`
       → 展开括号（保留词），得到能直接朗读的完整句 */
    .replace(/\(\s*([A-Za-z][^()]{0,30})\s*\)/g, '$1')
    .replace(/[∶：]/g, ':')                 /* 全角/特殊冒号 → 半角（时间写法） */
        .replace(/\s+([,?!:;])/g, '$1')        /* 标点前不留空格 */
    /* ⚠️ 句点要排除省略号 `...`：原书用 `a ... bag.` 表示占位，
       用 `\s+([.])` 会把空格削掉、把句子改成 `a... bag.`（清洗规则改动原文 = 静默失真） */
    .replace(/\s+\.(?!\.)/g, '.')
    .replace(/[\s(（]+$/, '')               /* 尾部悬空括号/空格 */
    .replace(/\s{2,}/g, ' ')
    .trim();
  /* 展开括号可能留下多余空格，再收一次 */
  return t;
}

function cleanCn(s) {
  let t = s.trim();
  /* 尾部「补充变体」括号：仅当前文已以句末标点收尾时才剥掉，
     如 `你该休息一会儿。(你需要喘口气。)` → `你该休息一会儿。`
     ⚠️ 不可无条件剥：`为……(我们很遗憾。)` 的括号是正文，剥了就丢意思 */
  t = t.replace(/\s*[（(][^（()）]*[）)]\s*$/, (m) => {
    const head = t.slice(0, t.length - m.length);
    return /[。！？!?.]\s*$/.test(head) ? '' : m;
  });
  /* 冗余短前缀 + 括号正文，如「你(干得不错! )」→「干得不错!」 */
  t = t.replace(/^([\u4e00-\u9fff]{1,3})\s*[，,、]?\s*[（(]\s*([\s\S]*?)\s*[）)]\s*$/, '$2');
  /* 整行被括号包裹 → 脱壳 */
  t = t.replace(/^[（(]\s*([\s\S]*?)\s*[）)]\s*$/, '$1');
  /* ⚠️ 悬浮尾括号：**必须先判配平**，否则会削掉合法的 `我要存5000日元(在我的账户上。)` */
  while (/[)）]\s*$/.test(t) && !balanceOk(t)) t = t.replace(/[)）]\s*$/, '').trim();
  while (/^[)）]/.test(t)) t = t.replace(/^[)）]\s*/, '');
  t = t.replace(/[（(]\s*$/, '');                 /* 尾部悬空左括号 */
  t = t.replace(/\s+([)）。，、])/g, '$1');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

/**
 * 从行尾取出「最外层尾括号」内容。
 * ⚠️ 原书中文里**含嵌套括号**（如 `Let's go window-shopping.(我们去(商店)逛逛吧! )`），
 * 用正则 `[^()]*` 匹配会截在括号中间 → 必须**从行尾配平扫描**。
 * 返回 {en, cn} 或 null。
 */
function trailingParen(t) {
  let i = t.length - 1;
  while (i >= 0 && /\s/.test(t[i])) i--;
  if (i < 0 || !/[）)]/.test(t[i])) return null;
  const closeIdx = i;
  let depth = 0;
  for (let j = i; j >= 0; j--) {
    const c = t[j];
    if (c === ')' || c === '）') depth++;
    else if (c === '(' || c === '（') {
      depth--;
      if (depth === 0) {
        const en = t.slice(0, j).trim();
        const cn = t.slice(j + 1, closeIdx).trim();
        if (en && cn) return { en: en, cn: cn };
        return null;
      }
    }
  }
  return null;
}

/**
 * 切分 en/cn
 */
function splitPair(t) {
  /* ① 从行尾配平取尾括号，要求括号前无中文、且前缀含拉丁词 */
  const tp = trailingParen(t);
  if (tp && hasCJK(tp.cn) && !hasCJK(tp.en) && hasLatinWord(tp.en)) {
    return { en: tp.en, cn: tp.cn };
  }
  /* ② 首个中文处切开 */
  const idx = t.search(CJK);
  if (idx > 0) {
    const en = t.slice(0, idx);
    if (hasLatinWord(en)) return { en: en, cn: t.slice(idx) };
  }
  /* ③ 中文在前 */
  if (idx === 0) {
    const j = t.search(/[A-Za-z]/);
    if (j > 0) {
      const en = t.slice(j);
      if (hasLatinWord(en)) return { en: en, cn: t.slice(0, j) };
    }
  }
  return null;
}

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const t = raw.trim();
  const ln = i + 1;
  if (!t) continue;

  /* 章 */
  let m = t.match(/^第([一二三四五六七八九十]+)章\s*(.*)$/);
  if (m) {
    chapterIdx++;
    chapter = { no: chapterIdx, noCn: m[1], title: m[2].trim(), line: ln };
    section = null; topic = null; lastSectionNo = 0;
    continue;
  }

  /* 节：行首数字 + 中文开头 */
  m = t.match(/^(\d{1,2})\s*([^\sA-Za-z0-9].*)$/);
  if (m && chapter) {
    const no = Number(m[1]);
    if (hasCJK(m[2]) && no >= 1 && no <= 99 && no > lastSectionNo - 1) {
      section = { no: no, title: m[2].trim().replace(/\s+/g, ''), line: ln };
      lastSectionNo = no;
      topic = null;
      continue;
    }
  }

  /* ● 子场景 */
  if (/^[●○◦·]/.test(t)) {
    topic = { title: t.replace(/^[●○◦·]\s*/, '').trim(), line: ln };
    continue;
  }

  /* 补丁优先 */
  if (PATCH[ln]) {
    const p = PATCH[ln];
    if (p.sourcePattern && !p.sourcePattern.test(t)) {
      throw new Error('原书行与获批修订不匹配，停止解析：L' + ln);
    }
    push(p.en, p.cn, p.note, ln, p.raw == null ? t : p.raw);
    continue;
  }

  /* 句行 */
  if (/^[A-Za-z(“"'[.\u2026]/.test(t)) {
    const p = splitPair(t);
    if (p && p.en && p.cn) {
      const en = cleanEn(p.en);
      const c = extractNote(p.cn);
      const cn = cleanCn(c.text);
      if (en && cn) { push(en, cn, c.note.trim(), ln, t); continue; }
    }
  }

  /* 排版错位：本行纯中文译文（常整行带括号），下一行纯英文 */
  const wrappedCn = /^[（(][\s\S]*[）)]\s*$/.test(t) && hasCJK(t);
  if ((wrappedCn || (hasCJK(t) && !hasLatinWord(t))) && !/^(第|\d|[●○])/.test(t)) {
    const nx = (lines[i + 1] || '').trim();
    if (nx && /^[A-Za-z]/.test(nx) && !hasCJK(nx)) {
      const c = extractNote(t);
      push(cleanEn(nx), cleanCn(c.text), c.note.trim(), ln + 1, t + ' ⨯ ' + nx);
      i++;
      continue;
    }
  }

  skipped.push({ line: ln, t: t.slice(0, 120) });
}

/* 输出紧凑 JSON（入库文件，人读用 extra/oral-book/content/） */
fs.writeFileSync(OUT, JSON.stringify(recs) + '\n', 'utf8');

console.log('解析句数:', recs.length);
console.log('未解析行:', skipped.length);
skipped.forEach((s) => console.log('   跳过 ' + s.line + '| ' + s.t));
console.log('带 *注解(note) 的句:', recs.filter((r) => r.note).length);

/* 脏数据检查 */
const dirtyEn = recs.filter((r) => hasCJK(r.en));
console.log('en 含中文残留:', dirtyEn.length);
dirtyEn.forEach((r) => console.log('   L' + r.line + '| ' + r.en));
const dirtyCn = recs.filter((r) => !r.cn || r.cn.length < 1 || (hasLatinWord(r.cn) && r.cn.length > 40));
console.log('cn 可疑:', dirtyCn.length);
dirtyCn.slice(0, 10).forEach((r) => console.log('   L' + r.line + '| ' + r.cn));

/* 长度分布 */
const bucket = { '<=8': 0, '9-14': 0, '15-20': 0, '21-40': 0, '41-60': 0, '>60': 0 };
recs.forEach((r) => {
  const n = r.en.length;
  if (n <= 8) bucket['<=8']++;
  else if (n <= 14) bucket['9-14']++;
  else if (n <= 20) bucket['15-20']++;
  else if (n <= 40) bucket['21-40']++;
  else if (n <= 60) bucket['41-60']++;
  else bucket['>60']++;
});
console.log('英文长度分布:', JSON.stringify(bucket));
console.log('已写 ' + OUT);
