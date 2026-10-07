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

/* 一句最多一个干扰项，整句干扰总额随正确 chunk 数增长但封顶为 4。 */
export function getDistractorBudget(chunkCount) {
  return Number.isInteger(chunkCount) && chunkCount > 0 ? Math.min(4, chunkCount) : 0;
}

/* 所有可被判为正确的表达：句内 chunks 与逐 chunk alts。 */
export function collectCorrectAnswerSet(it) {
  var correct = new Set();
  (it && Array.isArray(it.chunks) ? it.chunks : []).forEach(function (value) {
    var key = norm(value);
    if (key) correct.add(key);
  });
  (it && Array.isArray(it.alts) ? it.alts : []).forEach(function (slot) {
    (Array.isArray(slot) ? slot : (typeof slot === 'string' ? [slot] : [])).forEach(function (value) {
      var key = norm(value);
      if (key) correct.add(key);
    });
  });
  return correct;
}

export function isValidDistractor(candidate, correctAnswers) {
  if (typeof candidate !== 'string' || !candidate.trim()) return false;
  var key = norm(candidate);
  return !!key && !(correctAnswers && correctAnswers.has(key));
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

/* 兼容逐 chunk 选择入口：1 个正确答案 + 至多 1 个结构或语境相关干扰项。
   currentItems = 当前题库 items（优先同语境）；allItems = 全部题库 items。
   ★ 候选池 = 当前题库 + 全题库合并：单题库 chunk 池稀疏（如 10 句 ≈ 25 chunks），
     若只在当前题库找，同 pattern / 同长度+重叠 的高质量干扰常不足 2 个 → 被迫兜底到零相关。
     跨题库找高质量干扰（同 pattern 或共享内容词）优于"同题库但零相关"。
   ★ 桶内排序（降级）：句内关联 → 正确答案关联。零句内关联的同 pattern 干扰排在后面，
     仅供题库过小时兜底。 */
export function buildChoices(it, i, currentItems, allItems) {
  var right = it.chunks[i];
  var correctAnswers = collectCorrectAnswerSet(it);
  var sentCtx = sentenceContextOf(it);
  var wrong = null;
  var seen = new Set();
  var preset = it.distractors && Array.isArray(it.distractors[i]) ? it.distractors[i] : [];
  for (var p = 0; p < preset.length; p++) {
    var pk = norm(preset[p]);
    if (!isValidDistractor(preset[p], correctAnswers) || seen.has(pk)) continue;
    wrong = preset[p]; seen.add(pk); break;
  }
  if (!wrong) {
    var pool = [];
    (currentItems || []).concat(allItems || []).forEach(function (o) {
      if (!o || o === it) return;
      (o.chunks || []).forEach(function (candidate) { pool.push(candidate); });
    });
    var rightPattern = normPattern(patternOf(right));
    var eligible = pool.filter(function (candidate) {
      var key = norm(candidate);
      var structuralNearMiss = normPattern(patternOf(candidate)) === rightPattern;
      return isValidDistractor(candidate, correctAnswers) && !seen.has(key)
        && (structuralNearMiss || overlapScore(candidate, sentCtx) >= 1);
    });
    eligible.sort(function (a, b) {
      return (Number(normPattern(patternOf(b)) === rightPattern) - Number(normPattern(patternOf(a)) === rightPattern))
        || (overlapScore(b, sentCtx) - overlapScore(a, sentCtx))
        || (overlapScore(b, right) - overlapScore(a, right));
    });
    if (eligible.length) wrong = eligible[0];
  }
  var choices = wrong ? [right, wrong] : [right];
  /* 洗牌 */
  for (var k = choices.length - 1; k > 0; k--) {
    var j = Math.floor(Math.random() * (k + 1));
    var t = choices[k]; choices[k] = choices[j]; choices[j] = t;
  }
  return choices;
}

/* 收集整句的干扰项（一次性大池子，所有 chunks 共享，不逐 chunk 刷新）。
   每槽最多贡献一条；不足预算时只接受同结构且与整句至少共享一个内容词的题库候选。 */
export function buildDistractors(it, currentItems, allItems) {
  var correctCount = it && Array.isArray(it.chunks) ? it.chunks.length : 0;
  var distractorCount = getDistractorBudget(correctCount);
  if (!distractorCount) return [];
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
  var correctSet = collectCorrectAnswerSet(it);
  var picks = [];
  var seen = new Set();
  var slots = Array.isArray(it.distractors) ? it.distractors : [];
  var selectedBySlot = new Array(correctCount).fill(null);
  /* 第一遍逐槽取第一条合法预置项：某个 chunk 不能独占整池名额。 */
  for (var slotIndex = 0; slotIndex < correctCount && picks.length < distractorCount; slotIndex++) {
    var slot = Array.isArray(slots[slotIndex]) ? slots[slotIndex] : [];
    for (var candidateIndex = 0; candidateIndex < slot.length; candidateIndex++) {
      var preset = slot[candidateIndex];
      var presetKey = norm(preset);
      if (!isValidDistractor(preset, correctSet) || seen.has(presetKey)) continue;
      selectedBySlot[slotIndex] = preset;
      seen.add(presetKey); picks.push(preset); break;
    }
  }
  /* 第二遍只为尚空的槽找候选，限定为该槽自身结构且与句境至少共享一个内容词；
     稳定排序不改变同分候选的来源顺序，也不做无关联的任意兜底。 */
  for (var fillIndex = 0; fillIndex < correctCount && picks.length < distractorCount; fillIndex++) {
    if (selectedBySlot[fillIndex]) continue;
    var target = it.chunks[fillIndex];
    var targetPattern = normPattern(patternOf(target));
    var candidates = pool.filter(function (candidate) {
      var key = norm(candidate);
      return isValidDistractor(candidate, correctSet) && !seen.has(key)
        && normPattern(patternOf(candidate)) === targetPattern && overlapScore(candidate, sentCtx) >= 1;
    });
    candidates = candidates.map(function (candidate, order) {
      return { candidate: candidate, order: order, context: overlapScore(candidate, sentCtx), target: overlapScore(candidate, target) };
    }).sort(function (a, b) { return (b.context - a.context) || (b.target - a.target) || (a.order - b.order); });
    if (candidates.length) {
      var chosen = candidates[0].candidate;
      var chosenKey = norm(chosen);
      seen.add(chosenKey); picks.push(chosen); selectedBySlot[fillIndex] = chosen;
    }
  }
  return picks;
}

/* 生成选择模式的一次性选项池。
   选项池只负责纯数据：正确项、干扰项和固定的展示顺序；页面负责保存题目引用、
   处理点击以及根据答题状态重新渲染。random 可注入，便于稳定测试和复现问题。 */
export function buildChoicePool(corrects, distractors, random) {
  var right = Array.isArray(corrects) ? corrects.slice() : [];
  var wrong = Array.isArray(distractors) ? distractors.slice() : [];
  var order = [];
  var rng = typeof random === 'function' ? random : Math.random;
  wrong.forEach(function (v) { order.push({ v: v, ci: -1 }); });
  right.forEach(function (v, i) { order.push({ v: v, ci: i }); });
  for (var i = order.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return { corrects: right, distractors: wrong, order: order };
}

/* 生成选择按钮 HTML。
   不包含 DOM 操作，也不把已答对的正确项重新展示；escapeHtml 由页面注入，
   使这个边界既能单测，又不会把安全策略复制到核心模块里。 */
export function buildChoiceMarkup(pool, status, escapeHtml) {
  var source = pool && Array.isArray(pool.order) ? pool.order : [];
  var states = Array.isArray(status) ? status : [];
  var esc = typeof escapeHtml === 'function' ? escapeHtml : function (v) { return String(v == null ? '' : v); };
  var html = '';
  source.forEach(function (entry) {
    if (!entry || (entry.ci >= 0 && states[entry.ci] === 'ok')) return;
    html += '<button class="choice' + (entry.ci < 0 ? ' distractor' : '')
      + '" type="button" data-v="' + esc(entry.v) + '">' + esc(entry.v) + '</button>';
  });
  return html;
}

/* chunk 作答判定：归一化比较 + 同义替换 alternatives */
export function judgeChunk(val, right, alternatives) {
  return [right].concat(alternatives || []).some(function (a) { return norm(val) === norm(a); });
}
