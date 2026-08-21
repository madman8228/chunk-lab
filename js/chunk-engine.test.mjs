/**
 * chunk-engine.test.mjs · 核心练习逻辑单测（ADR-007 Step 1）
 *
 * 覆盖此前零测试的 chunk 判定 / 干扰项生成 / 词性 pattern：
 *   - classifyWord / patternOf / normPattern
 *   - buildChoices：正确 + 干扰、去重、同模式优先、题库不足降级
 *   - buildDistractors：数量、排除正确答案、同模式优先
 *   - judgeChunk：大小写/标点/撇号归一化、alternatives 同义替换
 * Node 直跑（原生 ESM）：node js/chunk-engine.test.mjs
 */
'use strict';

import {
  classifyWord, patternOf, normPattern, norm,
  buildChoices, buildDistractors, judgeChunk
} from './chunk-engine.mjs';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ===== classifyWord / patternOf / normPattern ===== */
check('classifyWord: 小词 → S', classifyWord('the') === 'S');
check('classifyWord: 内容词 → C', classifyWord('student') === 'C');
check('classifyWord: 纯标点 → P', classifyWord(',') === 'P');
check('classifyWord: 大小写不敏感', classifyWord('THE') === 'S' && classifyWord('The') === 'S');
check('classifyWord: 去尾部标点', classifyWord('student.') === 'C');
check('patternOf: 结构模式', patternOf('a student') === 'S-C', patternOf('a student'));
check('patternOf: 多词', patternOf('is studying hard') === 'S-C-C', patternOf('is studying hard'));
check('normPattern: 归一化', normPattern('S-C-PP') === 'S-C-P' && normPattern('-S-C-') === 'S-C' && normPattern('S-C-P-P') === 'S-C-P-P', normPattern('S-C-P-P'));

/* ===== norm ===== */
check('norm: 大小写/标点/空格', norm('  Hello, World!!  ') === 'hello world');
check('norm: 撇号差异归一', norm("it's") === norm('its') && norm('it\u2019s') === norm("it's"));
check('norm: 空值安全', norm(null) === '' && norm(undefined) === '');

/* ===== buildChoices ===== */
const sentA = { chunks: ['I am', 'a student', 'in Beijing'] };
const sentB = { chunks: ['She is', 'a teacher', 'in Shanghai'] };
const sentC = { chunks: ['We are', 'good friends'] };
const items = [sentA, sentB, sentC];

(function () {
  const cs = buildChoices(sentA, 0, items, items); // 正确答案 'I am'
  check('buildChoices: 返回 3 个候选（1 正确 + 2 干扰）', cs.length === 3, 'len=' + cs.length + ' cs=' + JSON.stringify(cs));
  check('buildChoices: 包含正确答案', cs.indexOf('I am') >= 0);
  const wrongs = cs.filter(c => c !== 'I am');
  check('buildChoices: 干扰项与正确答案不同', wrongs.every(w => norm(w) !== norm('I am')));
  check('buildChoices: 干扰项无重复', new Set(cs.map(norm)).size === cs.length);
  check('buildChoices: 同模式优先（S-S 结构干扰）', wrongs.every(w => patternOf(w) === patternOf('I am')), JSON.stringify(wrongs.map(w => patternOf(w))));
})();

(function () {
  const cs = buildChoices(sentA, 2, items, items); // 正确答案 'in Beijing'（模式 P-C）
  check('buildChoices: 模式 P-C 的正确答案在列', cs.indexOf('in Beijing') >= 0);
  const wrongs = cs.filter(c => c !== 'in Beijing');
  check('buildChoices: P-C 干扰项同模式', wrongs.every(w => patternOf(w) === patternOf('in Beijing')), JSON.stringify(wrongs));
})();

(function () {
  // 题库太小（只剩 1 句）→ 只返回正确答案
  const tiny = buildChoices(sentA, 0, [sentA], [sentA]);
  check('buildChoices: 池子不足时只返回正确答案', tiny.length === 1 && tiny[0] === 'I am', JSON.stringify(tiny));
})();

/* ===== buildDistractors ===== */
(function () {
  const ds = buildDistractors(sentA, items, items);
  // 可用候选 = 其它两句的 5 个不同 chunk（'She is','a teacher','in Shanghai','We are','good friends'）
  // 首 chunk 'I am'(S-S，i/am 均小词) 的同模式候选 2 个（'She is','We are'）；池子取尽 → 5 个
  check('buildDistractors: 取尽可用候选', ds.length === 5, 'got=' + ds.length + ' ds=' + JSON.stringify(ds));
  const normSet = new Set(sentA.chunks.map(norm));
  check('buildDistractors: 不含整句的正确答案 chunk', ds.every(d => !normSet.has(norm(d))));
  check('buildDistractors: 无重复', new Set(ds.map(norm)).size === ds.length);
  const pat = patternOf(sentA.chunks[0]); // 'I am' = S-S
  const samePatternCount = ds.filter(d => patternOf(d) === pat).length;
  check('buildDistractors: 同模式优先（2 个 S-S 全在前）',
    samePatternCount === 2 && ds.slice(0, 2).every(d => patternOf(d) === pat), JSON.stringify(ds));
})();

(function () {
  // 单句题库 → 干扰为空（不崩、不返回正确答案）
  const ds = buildDistractors(sentA, [sentA], [sentA]);
  check('buildDistractors: 题库不足不崩溃', Array.isArray(ds) && ds.length === 0);
})();

/* ===== buildChoices 语义相关度过滤（修根因：原算法仅按词性/词数匹配，零语义重叠的长句片段会被选中） ===== */
(function () {
  // 用户截图场景：句子 "It looks like it's going to rain."，对 chunk "It looks like"
  const target = { sentence: "It looks like it's going to rain.", chunks: ['It looks like', "it's going to", 'rain.'] };
  // 池子含高质量干扰（共享 "it"/"going"/"to"）+ 零相关整句片段
  const pool = [
    { sentence: "I'm going to school.", chunks: ["I'm going to"] },               // 与 target.chunks[0] 共享 "going"/"to"（"to" 虽是停用词但词形保留作降级依据可能不足——"It" "to" 跨 stop 词时 overlap 主要看 "going"）
    { sentence: "It's going to rain.",      chunks: ["It's going to"] },               // 高质量（同 pattern S-C-S-C，共享 it/going）
    { sentence: "I meet a friend.",         chunks: ['meet a friend'] },              // 长度同 3 词但零相关
    { sentence: "How was your weekend?",    chunks: ['How was your weekend?'] },     // 长度同 3 词但零相关
    { sentence: 'I like eating apples.',    chunks: ['I like eating'] }              // 长度 3，"like" 与 "like" 重叠（同长度+overlap）
  ];
  const cs = buildChoices(target, 0, pool, pool);
  check('buildChoices: 包含正确答案', cs.includes('It looks like'));
  check('buildChoices: 零相关的整句片段被排除（meet a friend / How was your weekend?）',
    !cs.some(c => c === 'meet a friend' || c === 'How was your weekend?'),
    'cs=' + JSON.stringify(cs));
  check('buildChoices: 至少一个高质量干扰（共享 "going"/"like" 等）',
    cs.some(c => c === "It's going to" || c === 'I like eating' || c === "I'm going to"),
    'cs=' + JSON.stringify(cs));
})();

// 桶 A（同 pattern）优先于桶 B：保证高质量干扰即使 overlap 较低也入选
(function () {
  const target = { sentence: 'She walks.', chunks: ['She walks'] }; // pattern S-C
  const pool = [
    { sentence: 'He runs.',    chunks: ['He runs'] },       // 同 pattern S-C，零重叠
    { sentence: 'It looks like', chunks: ['It looks like'] }, // 同长度 3 词，但 norm 后重排零 stop 重叠
    { sentence: 'She eats.',   chunks: ['She eats'] }        // 同 pattern S-C 且重叠 "she"
  ];
  const cs = buildChoices(target, 0, pool, pool);
  check('buildChoices: 桶 A 同 pattern 优先（pattern 强信号即使 overlap=0 也入选）',
    cs.filter(c => c !== 'She walks').includes('He runs') || cs.filter(c => c !== 'She walks').includes('She eats'),
    'cs=' + JSON.stringify(cs));
})();

/* ===== 跨题库高质量候选（修根因：单题库 chunk 池稀疏 → 高质量干扰不足 → 桶 C 零相关兜底） ===== */
(function () {
  // 当前题库只有零相关候选；全题库池才有同长度+重叠 / 同 pattern 的候选
  const target = { sentence: "It looks like it's going to rain.", chunks: ['It looks like'] }; // 3 词 S-C-C
  const curItems = [
    { chunks: ['meet a friend'] },         // 同长度 3 词但零相关（当前题库仅此可用）
    { chunks: ['How was your weekend?'] }  // 零相关
  ];
  const allItems = curItems.concat([
    { chunks: ['I like eating'] },         // 跨题库高质量：共享 "like"
    { chunks: ['She looks happy'] }        // 跨题库同 pattern S-C-C（looks 重叠）
  ]);
  const cs = buildChoices(target, 0, curItems, allItems);
  check('buildChoices: 跨题库取高质量干扰（共享 like / 同 pattern S-C-C）',
    cs.some(c => c === 'I like eating' || c === 'She looks happy'),
    'cs=' + JSON.stringify(cs));
  check('buildChoices: 跨题库后仍含正确答案', cs.includes('It looks like'));
})();

/* ===== judgeChunk ===== */
check('judgeChunk: 精确匹配', judgeChunk('I am', 'I am', []) === true);
check('judgeChunk: 大小写/标点归一', judgeChunk('i am!', 'I am', []) === true);
check('judgeChunk: 撇号差异', judgeChunk("it's ok", 'its ok', []) === true);
check('judgeChunk: 错误答案拒绝', judgeChunk('she is', 'I am', []) === false);
check('judgeChunk: alternatives 接受同义替换', judgeChunk('I\'m', 'I am', ['I\'m']) === true);
check('judgeChunk: alternatives 为空数组安全', judgeChunk('x', 'y', []) === false);
check('judgeChunk: 空值安全', judgeChunk(null, 'a', []) === false && judgeChunk('', 'a', []) === false);

console.log('\n[chunk-engine.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
