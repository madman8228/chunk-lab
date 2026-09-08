/**
 * js/distractor-cause.mjs · 干扰项错因分类引擎（C2-I，ADR-007 纯逻辑）
 *
 * 4 类错因 schema（与 D-pipeline 命题宪法对齐，供答错近失提示 UI 消费）：
 *   verb     动词形态错误：时态/主谓一致/非谓语/助动词屈折
 *            （How was→How is, tell→told, meet→meets, go→going, want→wanted…）
 *   function 虚词错误：冠词/介词/代词/情态动词/结构性增减
 *            （a→the, you→your, for→to/at, the 缺失, can be 增删…）
 *   form     词形/拼写错误：复数/所有格/形近词（weekend→weekends, chance→change）
 *   semantic 语义替换：换实词/换主语指代/指向词/反义/语境不符
 *            （god→fate, joke→story, She's→He's, here→there, stop to do→stop doing…）
 *
 * 判定原理：干扰项 d 与所在槽正确 chunk c 的文本差异即错因。按
 * 「代词/指示 → 词干屈折 → 指向替换 → 虚词 → 形近 → 语义」优先级裁定。
 * 纯函数、零 DOM/全局状态，可单测。
 *
 * C2-III（2026-09-08）semantic 盲区治理（全库 2353 条复核后确定性修复）：
 *   ① 指示代词数错（this↔these, that↔those 等跨单复数）不再归 semantic → function；
 *      this↔that 等「同数远近指」保持 semantic（句意确实变化）。
 *   ② 词干屈折判定前移至指向词短路之前：today→todays / now→nows / yesterday→yesterdays
 *      这类可屈折时间名词的复数误加此前被 POINTERS 截胡成 semantic → 现归 form；
 *      now→later / here→there 等词干不同的纯指向替换保持 semantic。
 */
'use strict';

/* ---------- 虚词表 ---------- */
const FUNC_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'so', 'because', 'if', 'when', 'while', 'after', 'before',
  'to', 'for', 'at', 'on', 'in', 'of', 'from', 'with', 'by', 'about', 'into', 'over', 'under', 'out', 'off',
  'not', 'no', 'just', 'very', 'really', 'too', 'than', 'as',
  'can', 'could', 'may', 'might', 'shall', 'should', 'must', 'will', 'would'
]);
/* 代词/指示/所有格：替换 = 指代对象变化 → semantic */
const PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'we', 'they', 'it', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their', 'its', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those', 'someone', 'somebody', 'everyone', 'nobody', 'anyone', 'who', 'what'
]);
/* 指向性副词：替换 = 语境指向变化 → semantic */
const POINTERS = new Set(['here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'tonight', 'soon', 'later', 'away']);

/* be/do/have 三系词位（助动词/系动词系统） */
const BE_DO_HAVE = new Set(['be', 'have', 'do']);
/* 代词按「人」分组：同组替换=格/所有格错误→function；跨组=指代对象变→semantic */
const PRONOUN_GROUPS = [
  ['i', 'me', 'my', 'mine'],
  ['you', 'your', 'yours'],
  ['he', 'him', 'his'],
  ['she', 'her', 'hers'],
  ['we', 'us', 'our', 'ours'],
  ['they', 'them', 'their', 'theirs'],
  ['it', 'its']
];
const PRONOUN_GROUP_OF = {};
PRONOUN_GROUPS.forEach(function (g, gi) { g.forEach(function (w) { PRONOUN_GROUP_OF[w] = gi; }); });
/* 指示代词：远近指/对象变化 → semantic */
const DEMO_PRONOUNS = new Set(['this', 'that', 'these', 'those', 'someone', 'somebody', 'everyone', 'nobody', 'anyone', 'who', 'what']);
/* 指示代词「数」：this/that=单(1)，these/those=复(2)。
   数不一致（this↔these 等限定词数错，名词常未同步复数）→ function；同数（this↔that 远近指）→ semantic */
const DEMO_NUM = { this: 1, that: 1, these: 2, those: 2 };

/* be/do/have 三系词位变化（is/was→be, did→do, has→have）→ verb */
const IRREG = {
  'is': 'be', 'are': 'be', 'am': 'be', 'was': 'be', 'were': 'be', 'been': 'be', 'being': 'be',
  'has': 'have', 'had': 'have', 'having': 'have',
  'do': 'do', 'does': 'do', 'did': 'do', 'done': 'do', 'doing': 'do',
  'told': 'tell', 'telling': 'tell', 'tells': 'tell',
  'saw': 'see', 'seen': 'see', 'seeing': 'see', 'sees': 'see',
  'went': 'go', 'gone': 'go', 'goes': 'go', 'going': 'go',
  'got': 'get', 'getting': 'get', 'gets': 'get', 'gotten': 'get',
  'made': 'make', 'making': 'make', 'makes': 'make',
  'said': 'say', 'saying': 'say', 'says': 'say',
  'came': 'come', 'coming': 'come', 'comes': 'come',
  'took': 'take', 'taking': 'take', 'takes': 'take',
  'knew': 'know', 'known': 'know', 'knowing': 'know', 'knows': 'know',
  'left': 'leave', 'leaving': 'leave', 'leaves': 'leave',
  'felt': 'feel', 'feeling': 'feel', 'feels': 'feel',
  'thought': 'think', 'thinking': 'think', 'thinks': 'think',
  'found': 'find', 'finding': 'find', 'finds': 'find',
  'gave': 'give', 'given': 'give', 'giving': 'give', 'gives': 'give',
  'kept': 'keep', 'keeping': 'keep', 'keeps': 'keep',
  'let': 'let', 'lets': 'let', 'letting': 'let',
  'put': 'put', 'putting': 'put', 'puts': 'put',
  'ran': 'run', 'running': 'run', 'runs': 'run',
  'sat': 'sit', 'sitting': 'sit', 'sits': 'sit',
  'spoke': 'speak', 'speaking': 'speak', 'speaks': 'speak',
  'wrote': 'write', 'writing': 'write', 'writes': 'write',
  'drove': 'drive', 'driving': 'drive', 'drives': 'drive',
  'ate': 'eat', 'eating': 'eat', 'eats': 'eat',
  'broke': 'break', 'breaking': 'break', 'breaks': 'break',
  'chose': 'choose', 'choosing': 'choose', 'chooses': 'choose',
  'bought': 'buy', 'buying': 'buy', 'buys': 'buy',
  'caught': 'catch', 'catching': 'catch', 'catches': 'catch',
  'taught': 'teach', 'teaching': 'teach', 'teaches': 'teach',
  'won': 'win', 'winning': 'win', 'wins': 'win',
  'lost': 'lose', 'losing': 'lose', 'loses': 'lose',
  'met': 'meet', 'meeting': 'meet', 'meets': 'meet',
  'held': 'hold', 'holding': 'hold', 'holds': 'hold',
  'stood': 'stand', 'standing': 'stand', 'stands': 'stand',
  'showed': 'show', 'shown': 'show', 'showing': 'show', 'shows': 'show',
  'began': 'begin', 'beginning': 'begin', 'begins': 'begin',
  'paid': 'pay', 'paying': 'pay', 'pays': 'pay',
  'sent': 'send', 'sending': 'send', 'sends': 'send',
  'spent': 'spend', 'spending': 'spend', 'spends': 'spend',
  'repeated': 'repeat', 'repeats': 'repeat', 'repeating': 'repeat',
  'wanted': 'want', 'wants': 'want', 'wanting': 'want'
};
function lemmatize(w) { return IRREG[w] || w; }

const INFLECT = [
  [/ing$/, ''], [/ed$/, ''], [/es$/, ''], [/s$/, ''], [/ies$/, 'y'], [/ied$/, 'y'], [/er$/, ''], [/est$/, '']
];
function stem(w) {
  w = w.replace(/[^a-z']/g, '');
  for (const [re, rep] of INFLECT) {
    if (re.test(w)) { const s = w.replace(re, rep); if (s.length >= 3) return s; }
  }
  return w;
}

function editDist(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = new Uint16Array((m + 1) * (n + 1));
  for (let i = 0; i <= m; i++) dp[i * (n + 1)] = i;
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    dp[i * (n + 1) + j] = Math.min(
      dp[(i - 1) * (n + 1) + j] + 1,
      dp[i * (n + 1) + j - 1] + 1,
      dp[(i - 1) * (n + 1) + j - 1] + cost);
  }
  return dp[m * (n + 1) + n];
}

/* 共享任一连续 2 字符子串 → 形近（chance/change 有 ch/ha/an，be/get 无）。
   排除纯词尾 -s 类共享（runs/owns 共享 'ns' 是屈折尾巴，非真形近） */
function sharesBigram(a, b) {
  if (a.length < 2 || b.length < 2) return false;
  const set = new Set();
  for (let i = 0; i < a.length - 1; i++) if (!a.endsWith('s') || i < a.length - 2) set.add(a.slice(i, i + 2));
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    if (bg.endsWith('s') && i === b.length - 2) continue;
    if (set.has(bg)) return true;
  }
  return false;
}

/* 缩写展开 → 完整词（i'm→[i,am], we're→[we,are], i'll→[i,will], i've→[i,have]…）
   使「I'm going」vs「I going」的 am 缺失可被 diff 检出（be 系 → verb） */
const APOS_EXPAND = {
  "i'm": ['i', 'am'], "you're": ['you', 'are'], "he's": ['he', 'is'], "she's": ['she', 'is'],
  "we're": ['we', 'are'], "they're": ['they', 'are'], "it's": ['it', 'is'], "that's": ['that', 'is'],
  "there's": ['there', 'is'], "here's": ['here', 'is'], "what's": ['what', 'is'], "who's": ['who', 'is'],
  "let's": ['let', 'us'], "don't": ['do', 'not'], "doesn't": ['do', 'not'], "didn't": ['do', 'not'],
  "isn't": ['be', 'not'], "aren't": ['be', 'not'], "wasn't": ['be', 'not'], "weren't": ['be', 'not'],
  "haven't": ['have', 'not'], "hasn't": ['have', 'not'], "hadn't": ['have', 'not'],
  "can't": ['can', 'not'], "couldn't": ['can', 'not'], "won't": ['will', 'not'], "wouldn't": ['will', 'not'],
  "shouldn't": ['should', 'not'], "i'll": ['i', 'will'], "you'll": ['you', 'will'], "he'll": ['he', 'will'],
  "she'll": ['she', 'will'], "we'll": ['we', 'will'], "they'll": ['they', 'will'], "it'll": ['it', 'will'],
  "i've": ['i', 'have'], "you've": ['you', 'have'], "we've": ['we', 'have'], "they've": ['they', 'have'],
  "i'd": ['i', 'would'], "you'd": ['you', 'would'], "he'd": ['he', 'would'], "she'd": ['she', 'would'],
  "we'd": ['we', 'would'], "they'd": ['they', 'would'], "it'd": ['it', 'would'],
  "could've": ['can', 'have'], "would've": ['will', 'have'], "should've": ['should', 'have']
};
function expandTokens(raw) {
  const out = [];
  String(raw).toLowerCase().trim().split(/[\s—–-]+/).forEach(function (w) {
    if (!w) return;
    const ex = APOS_EXPAND[w];
    if (ex) out.push.apply(out, ex); else out.push(w);
  });
  return out;
}

/* ---------- 单条判定 ---------- */
function canon(w) { return w.replace(/[^a-z]/g, ''); }

function classifyOne(c, d) {
  const ct = expandTokens(c);
  const dt = expandTokens(d);

  if (ct.length !== dt.length) {
    /* 净增减 diff → 先做词位配对抵消（getting↔get 同词干屈折替换 → verbHint），
       剩余净词按 be/do/have 系 → 虚词/代词 → 实词 归类 */
    const count = {};
    ct.forEach(function (w) { count[w] = (count[w] || 0) + 1; });
    dt.forEach(function (w) { count[w] = (count[w] || 0) - 1; });
    const extraC = [], extraD = [];
    Object.keys(count).forEach(function (w) {
      const n = count[w];
      if (n > 0) for (let k = 0; k < n; k++) extraC.push(w);
      else if (n < 0) for (let k = 0; k < -n; k++) extraD.push(w);
    });
    let verbHint = 0;
    /* 配对抵消：一方删词与另一方增词同词位/同词干 → 屈折替换 */
    const usedC = {}, usedD = {};
    extraC.forEach(function (cw, ci) {
      if (usedC[ci]) return;
      const lc = lemmatize(cw), sc = stem(cw);
      for (let j = 0; j < extraD.length; j++) {
        if (usedD[j]) continue;
        const ld = lemmatize(extraD[j]), sd = stem(extraD[j]);
        if (lc === ld || (sc === sd && sc.length >= 3)) { usedC[ci] = usedD[j] = 1; verbHint++; break; }
      }
    });
    let aux = 0, func = 0, real = 0;
    extraC.forEach(function (w, idx) {
      if (usedC[idx]) return;
      const k = canon(w);
      const lk = lemmatize(k);
      if (BE_DO_HAVE.has(lk)) { aux++; return; }
      if (FUNC_WORDS.has(k) || FUNC_WORDS.has(lk) || PRONOUNS.has(k) || DEMO_PRONOUNS.has(k) || POINTERS.has(k)) { func++; return; }
      real++;
    });
    extraD.forEach(function (w, idx) {
      if (usedD[idx]) return;
      const k = canon(w);
      const lk = lemmatize(k);
      if (BE_DO_HAVE.has(lk)) { aux++; return; }
      if (FUNC_WORDS.has(k) || FUNC_WORDS.has(lk) || PRONOUNS.has(k) || DEMO_PRONOUNS.has(k) || POINTERS.has(k)) { func++; return; }
      real++;
    });
    if (real > 0) return 'semantic';
    if (aux > 0 && func > 0) return 'function';  /* can be 情态+be 结构增删 */
    if (aux > 0) return 'verb';                  /* be/do/have 纯增减（am 缺失等） */
    if (func > 0) return 'function';             /* 结构词主导（含屈折配对连带 to） */
    if (verbHint > 0) return 'verb';             /* 纯屈折配对（go→going 无结构词） */
    return 'semantic';
  }

  let verbHits = 0, funcHits = 0, formHits = 0, semHits = 0;
  for (let i = 0; i < ct.length; i++) {
    const a0 = canon(ct[i]), b0 = canon(dt[i]);
    if (a0 === b0) continue;
    /* ① 人称代词：同「人」不同格 → function（you↔your 所有格）；跨人 → semantic */
    const ga = PRONOUN_GROUP_OF[a0], gb = PRONOUN_GROUP_OF[b0];
    if (ga !== undefined || gb !== undefined) {
      if (ga !== undefined && ga === gb) funcHits++;
      else semHits++;
      continue;
    }
    /* ② 指示代词 this/that/these/those：数不一致 → function（限定词数错，
       种子生成器常「this 复数化但名词未同步」）；同数远近指（this↔that）→ semantic */
    if (DEMO_PRONOUNS.has(a0) || DEMO_PRONOUNS.has(b0)) {
      const na = DEMO_NUM[a0], nb = DEMO_NUM[b0];
      if (na && nb) { if (na === nb) semHits++; else funcHits++; }
      else semHits++;
      continue;
    }
    /* ③ 词位/词干屈折（先于指向词与虚词短路：was↔has、meet↔meets、run↔runs、
       today↔todays 等在此落定，不被下方 POINTERS 截胡成 semantic） */
    const la = lemmatize(a0), lb = lemmatize(b0);
    if (BE_DO_HAVE.has(la) && BE_DO_HAVE.has(lb)) { verbHits++; continue; }
    if (la === lb) { verbHits++; continue; }
    const sa = stem(a0), sb = stem(b0);
    if (sa === sb && sa.length >= 3) {
      if (/(ed|ing)$/.test(a0) || /(ed|ing)$/.test(b0)) verbHits++;
      else formHits++;
      continue;
    }
    /* ④ 指向词替换（到此处词干必不等：here↔there、now↔later 语境指向）→ semantic */
    if (POINTERS.has(a0) || POINTERS.has(b0)) { semHits++; continue; }
    /* ⑤ 虚词替换 → function */
    if (FUNC_WORDS.has(a0) || FUNC_WORDS.has(b0)) { funcHits++; continue; }
    /* ⑥ 纯形近：编辑距离 ≤2 且共享 bigram（排除 be/get、make/have 等
       不同词碰巧距离近；chance/change、worry/hurry、pull/put 保留） */
    if (editDist(a0, b0) <= 2 && Math.abs(a0.length - b0.length) <= 1 && sharesBigram(a0, b0)) { formHits++; continue; }
    semHits++;
  }

  if (semHits > 0) return 'semantic';
  if (verbHits > 0) return 'verb';
  if (funcHits > 0) return 'function';
  if (formHits > 0) return 'form';
  return 'semantic';
}

/* 句子级：给整句 distractors 逐槽分类，返回与 distractors 同形的 causes 二维数组 */
function classifySentence(it) {
  const chunks = it.chunks || [];
  const raw = it.distractors || [];
  return raw.map(function (slot, i) {
    const c = chunks[i] || '';
    return (slot || []).map(function (d) { return { d: d, c: classifyOne(c, d) }; });
  });
}

/* 错因类 → 中文展示文案（C2-II 答错 Toast 消费） */
const CAUSE_INFO = {
  verb: { name: '动词形态', tip: '时态 / 主谓一致 / 非谓语形式与正确表达不同' },
  function: { name: '虚词搭配', tip: '冠词、介词、代词或助词与正确表达不同' },
  form: { name: '形近词', tip: '拼写或词形与正确表达接近，注意区分' },
  semantic: { name: '语义偏移', tip: '换词改变了句意，与语境不符' }
};
function causeInfo(c) { return CAUSE_INFO[c] || CAUSE_INFO.semantic; }

export { classifyOne, classifySentence, causeInfo, CAUSE_INFO, FUNC_WORDS, PRONOUNS, POINTERS, IRREG };
