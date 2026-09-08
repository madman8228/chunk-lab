/**
 * chunk-engine.mjs · 核心练习纯逻辑（ADR-007 ESM 模块化，Step 1）
 *
 * 从 main.html 单体抽取的零依赖纯函数（无 DOM、无全局状态）：
 *   - 词性粗分类（S=小词 / C=内容词 / P=标点）与 chunk pattern
 *   - 候选答案生成（1 正确 + 干扰项，同模式/同长度三级择优）
 *   - 整池干扰项（choose 模式一次性大池）
 *   - chunk 作答判定（归一化 + 同义替换 alternatives）
 *
 * 设计要点：
 *   - 原 buildChoices/buildDistractors 依赖全局 S.items 与 allDecks()，
 *     此处改为参数注入（currentItems / allItems），纯函数、可单测。
 *   - norm 归一化规则与 main.html 内联版逐字符一致（行为零变化）。
 *
 * 浏览器：<script type="module" src="js/chunk-engine.mjs">
 * 单测：  node js/chunk-engine.test.mjs
 */
'use strict';

/* 单词词性粗分类：S=小词（介词/冠词/代词/be 动词/助动词等），C=内容词（名词/动词/形容词/副词等），P=纯标点 */
const SMALL_WORDS = 'a an the and or but if when where what who how which that is am are was were be been being do does did have has had in on at to for with by of about from into onto off out over under up down through across between among around after before during since until i you he she it we they me him her us them my your his its our their this these those there here so than as too also just very more most much some any no not only even still yet now then once'.split(' ');

export function classifyWord(w) {
  var clean = String(w == null ? '' : w).replace(/[.,!?;:]+$/, '').toLowerCase();
  if (!clean) return 'P';
  if (SMALL_WORDS.indexOf(clean) >= 0) return 'S';
  return 'C';
}

export function patternOf(chunk) {
  return String(chunk == null ? '' : chunk).trim().split(/\s+/).map(classifyWord).join('-');
}

export function normPattern(p) { return p.replace(/-P+/g, '-P').replace(/^-+|-+$/g, ''); }

/* 归一化：忽略大小写、标点、多余空格、撇号差异（与 main.html 内联 norm 逐字符一致） */
export function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 候选与正确答案的非停用词重叠数（语义相关性的轻量代理）：
   排除 SMALL_WORDS + 标点，纯字母数字词干交集；词性对位是更高优先信号（桶 A 单独按 pattern 匹配），
   桶 B 强制要求此值 ≥ 1 以过滤"词数相同但毫不相干"的整句片段（如 "meet a friend" vs "It looks like"）。 */
const STOP_WORDS_SET = new Set(SMALL_WORDS);
function overlapScore(a, b) {
  function tokens(s) {
    var set = new Set();
    String(s == null ? '' : s).toLowerCase().split(/\s+/).forEach(function (w) {
      var t = w.replace(/[^a-z0-9']/g, '');
      if (t && !STOP_WORDS_SET.has(t)) set.add(t);
    });
    return set;
  }
  var sa = tokens(a), sb = tokens(b);
  var n = 0; sa.forEach(function (t) { if (sb.has(t)) n++; });
  return n;
}

/* ★ 句内关联度（2026-09-08 修根因）：干扰项与整句语境的非停用词共享数。
   原算法只度量"干扰项 ↔ 正确答案"（pattern/词数/重叠），跨题库干扰与整句零语义关联
   → 学习者一眼排除，起不到干扰作用。干扰项是否有效取决于它与**整句**的语境关联。 */
function sentenceContextOf(it) {
  return (it && it.sentence) || (it && it.chunks || []).join(' ');
}

/* 生成候选：1 个正确答案 + 2 个干扰项（三档质量：同 pattern → 同长度+语义重叠 → 兜底）。
   currentItems = 当前题库 items（优先同语境）；allItems = 全部题库 items。
   ★ 候选池 = 当前题库 + 全题库合并：单题库 chunk 池稀疏（如 10 句 ≈ 25 chunks），
     若只在当前题库找，同 pattern / 同长度+重叠 的高质量干扰常不足 2 个 → 被迫兜底到零相关。
     跨题库找高质量干扰（同 pattern 或共享内容词）优于"同题库但零相关"。
   ★ 桶内排序（降级）：句内关联 → 正确答案关联。零句内关联的同 pattern 干扰排在后面，
     仅供题库过小时兜底。 */
export function buildChoices(it, i, currentItems, allItems) {
  var right = it.chunks[i], rn = norm(right);
  var rightPattern = patternOf(right);
  var sentCtx = sentenceContextOf(it);

  var pool = [];
  (currentItems || []).forEach(function (o) {
    if (o === it) return;
    (o.chunks || []).forEach(function (c) { pool.push(c); });
  });
  (allItems || []).forEach(function (o) {
    if (o === it) return;
    (o.chunks || []).forEach(function (c) { pool.push(c); });
  });

  /* 桶 A：词性模式完全相同（结构对位，内容词不同 → 高质量干扰） */
  var samePattern = [];
  var seen = {};
  pool.forEach(function (c) {
    var k = norm(c);
    if (!k || k === rn || seen[k]) return;
    if (normPattern(patternOf(c)) === normPattern(rightPattern)) {
      seen[k] = 1;
      samePattern.push(c);
    }
  });
  /* 桶 B：词数相同 + 与正确答案有非停用词重叠（同长度兜底太宽，加语义约束排除"句式像但不相关"的整句片段） */
  var rightWords = right.trim().split(/\s+/).length;
  var sameLenOverlap = [];
  var seen2 = {};
  pool.forEach(function (c) {
    var k = norm(c);
    if (!k || k === rn || seen[k] || seen2[k]) return;
    if (c.trim().split(/\s+/).length === rightWords && overlapScore(c, right) >= 1) {
      seen2[k] = 1;
      sameLenOverlap.push(c);
    }
  });

  /* 桶内排序：句内关联降序（主）→ 正确答案关联降序（次）。
     主排序修复根因：零句内关联的干扰项排最后，仅题库过小时兜底入选。 */
  function byCtxDesc(a, b) {
    return (overlapScore(b, sentCtx) - overlapScore(a, sentCtx)) || (overlapScore(b, right) - overlapScore(a, right));
  }
  samePattern.sort(byCtxDesc);
  sameLenOverlap.sort(byCtxDesc);
  /* 桶 C：句内关联 ≥1（任意 pattern/长度，主题相关的兜底前先吃掉） */
  var ctxRelated = [];
  var seen3 = {};
  pool.forEach(function (c) {
    var k = norm(c);
    if (!k || k === rn || seen[k] || seen2[k] || seen3[k]) return;
    if (overlapScore(c, sentCtx) >= 1) {
      seen3[k] = 1;
      ctxRelated.push(c);
    }
  });
  ctxRelated.sort(byCtxDesc);

  /* 四级选取：同模式 → 同长度+重叠 → 句内关联 → 任意不同（兜底，仅题库过小/无相关时启用） */
  var wrongs = [];
  var seen4 = {};
  function pick(source, cap) {
    for (var j = 0; j < source.length && wrongs.length < cap; j++) {
      var c = source[j];
      var k = norm(c);
      if (!k || k === rn || seen4[k]) continue;
      seen4[k] = 1;
      wrongs.push(c);
    }
  }
  pick(samePattern, 2);
  if (wrongs.length < 2) pick(sameLenOverlap, 2);
  if (wrongs.length < 2) pick(ctxRelated, 2);
  if (wrongs.length < 2) pick(pool, 2);
  /* 仍不足 2 个时（题库太小），只返回正确答案 */
  if (wrongs.length < 2) return [right];
  var choices = [right].concat(wrongs);
  /* 洗牌 */
  for (var k = choices.length - 1; k > 0; k--) {
    var j = Math.floor(Math.random() * (k + 1));
    var t = choices[k]; choices[k] = choices[j]; choices[j] = t;
  }
  return choices;
}

/* 收集整句的干扰项（一次性大池子，所有 chunks 共享，不逐 chunk 刷新）
   ★ 2026-09-08 修根因：原 pass-2 零过滤任意捞取 → 跨题库干扰与整句零语义关联（截图实证）。
     现三段式：同 pattern+句内关联 → 句内关联 → 兜底（题库过小时）。 */
export function buildDistractors(it, currentItems, allItems) {
  var correctCount = it.chunks.length;
  var distractorCount = Math.max(4, correctCount * 2);
  var sentCtx = sentenceContextOf(it);
  var pool = [];
  (currentItems || []).forEach(function (o) {
    if (o === it) return;
    (o.chunks || []).forEach(function (c) { pool.push(c); });
  });
  (allItems || []).forEach(function (o) {
    if (o === it) return;
    (o.chunks || []).forEach(function (c) { pool.push(c); });
  });
  var correctSet = {};
  it.chunks.forEach(function (v) { correctSet[norm(v)] = 1; });
  var picks = [];
  var seen = {};
  /* pass 1：同模式（chunk[0]）+ 句内关联 ≥1（高质量：结构对位且语境相关） */
  pool.forEach(function (c) {
    if (picks.length >= distractorCount) return;
    var nk = norm(c);
    if (!nk || correctSet[nk] || seen[nk]) return;
    if (normPattern(patternOf(c)) === normPattern(patternOf(it.chunks[0])) && overlapScore(c, sentCtx) >= 1) {
      seen[nk] = 1;
      picks.push(c);
    }
  });
  /* pass 2：句内关联 ≥1（任意 pattern，主题相关） */
  pool.forEach(function (c) {
    if (picks.length >= distractorCount) return;
    var nk = norm(c);
    if (!nk || correctSet[nk] || seen[nk]) return;
    if (overlapScore(c, sentCtx) >= 1) {
      seen[nk] = 1;
      picks.push(c);
    }
  });
  /* pass 3：同模式（保老算法语义：结构对位优先于任意兜底，零句内关联时仍排前） */
  pool.forEach(function (c) {
    if (picks.length >= distractorCount) return;
    var nk = norm(c);
    if (!nk || correctSet[nk] || seen[nk]) return;
    if (normPattern(patternOf(c)) === normPattern(patternOf(it.chunks[0]))) {
      seen[nk] = 1;
      picks.push(c);
    }
  });
  /* pass 4：兜底（题库过小时） */
  pool.forEach(function (c) {
    if (picks.length >= distractorCount) return;
    var nk = norm(c);
    if (!nk || correctSet[nk] || seen[nk]) return;
    seen[nk] = 1;
    picks.push(c);
  });
  return picks;
}

/* chunk 作答判定：归一化比较 + 同义替换 alternatives */
export function judgeChunk(val, right, alternatives) {
  return [right].concat(alternatives || []).some(function (a) { return norm(val) === norm(a); });
}
