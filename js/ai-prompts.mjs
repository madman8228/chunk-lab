/**
 * ai-prompts.mjs · AI prompt 构建纯函数（ADR-007 ESM 模块化，Step 3）
 *
 * 从 main.html 单体抽取的 prompt 字符串构建逻辑（无 DOM、无全局状态）。
 * 单测锁定 prompt 结构（防 AI 功能格式回归）：
 *   - buildExplainPrompt：单句意群讲解
 *   - buildBatchExplainPrompt：批量讲解（入参改为 pending 列表，解耦 main.html 的 pendingExplains）
 *   - buildPrompt：AI 生成题库
 *   - buildSplitPrompt：口语句子拆分（去掉未使用的 deck 参数）
 *   - buildAppendPrompt：题库追加（改为接收 deckName 字符串）
 *
 * 浏览器：<script type="module" src="js/bridge.mjs">（内部挂 window.AIPrompts）
 * 单测：  node js/ai-prompts.test.mjs
 */
'use strict';

export function buildExplainPrompt(it) {
  var L = [];
  L.push('你是一位资深英语教师。请为下面句子的每个意群（chunk）撰写多维度中文讲解。');
  L.push('');
  L.push('句子：' + (it.sentence || it.en || ''));
  L.push('中文：' + (it.translation || it.cn || ''));
  L.push('意群：');
  it.chunks.forEach(function (c, i) {
    L.push((i + 1) + '. ' + c + ((it.hints && it.hints[i]) ? '（提示：' + it.hints[i] + '）' : ''));
  });
  L.push('');
  L.push('要求：');
  L.push('1. 输出一个 JSON 数组，元素数量与意群数一致（' + it.chunks.length + ' 个），每个元素是一个对象，字段如下：');
  L.push('   - "grammar"：语法讲解（时态/语态/词性/结构），30-60字');
  L.push('   - "syntax"：句法讲解（该意群在整句中的功能与成分关系），20-50字');
  L.push('   - "collocation"：固定搭配（有则写搭配与含义，无则省略该字段）');
  L.push('   - "pattern"：固定句型（有则写句型框架与例句，无则省略）');
  L.push('   - "oral"：口语/俚语用法（有则写，无则省略）');
  L.push('   - "words"：关键单词数组，每项为 {"w":"单词","p":"词性","m":"中文释义"}，1-3 个');
  L.push('2. 没有的维度不要编造，省略该字段即可。');
  L.push('3. 直接输出 JSON，不要 Markdown 代码块标记，不要任何多余文字。');
  L.push('');
  L.push('输出示例：');
  L.push('[{');
  L.push('  "grammar": "语法讲解...",');
  L.push('  "syntax": "句法讲解...",');
  L.push('  "collocation": "固定搭配...",');
  L.push('  "oral": "口语用法...",');
  L.push('  "words": [{"w":"call","p":"v.","m":"打电话"}]');
  L.push('}]');
  return L.join('\n');
}

/* pending = 待讲解句子数组（由调用方用 pendingExplains(deck, includeAll) 生成） */
export function buildBatchExplainPrompt(pending) {
  var L = [];
  L.push('你是一位资深英语教师。请为下面每个句子的每个意群（chunk）撰写多维度中文讲解。');
  L.push('');
  L.push('句子列表（共 ' + pending.length + ' 句）：');
  pending.forEach(function (it, idx) {
    L.push('[' + (idx + 1) + '] ' + (it.sentence || it.en || ''));
    L.push('    中文：' + (it.translation || it.cn || ''));
    L.push('    意群：' + it.chunks.map(function (c, k) { return (k + 1) + '.' + c; }).join('  /  '));
  });
  L.push('');
  L.push('要求：');
  L.push('1. 输出一个 JSON 对象：{"items": [...]}，items 数组与句子列表一一对应（' + pending.length + ' 项）。');
  L.push('2. 每项为 {"sentence": "原句原文（必须与列表一致）", "explanations": [...]}，explanations 是与该句意群数一致的数组，每项是一个对象：');
  L.push('   - "grammar"：语法讲解（30-60字）');
  L.push('   - "syntax"：句法讲解（20-50字）');
  L.push('   - "collocation"：固定搭配（无则省略该字段）');
  L.push('   - "pattern"：固定句型（无则省略）');
  L.push('   - "oral"：口语/俚语用法（无则省略）');
  L.push('   - "words"：关键单词数组，每项 {"w":"单词","p":"词性","m":"中文释义"}（1-3个）');
  L.push('3. 没有的维度不要编造，省略字段即可。');
  L.push('4. 直接输出 JSON，不要 Markdown 代码块标记，不要任何多余文字。');
  L.push('');
  L.push('输出示例：');
  L.push('{"items":[{"sentence":"原句...","explanations":[{"grammar":"...","syntax":"...","collocation":"...","oral":"...","words":[{"w":"call","p":"v.","m":"打电话"}]}]}]}');
  return L.join('\n');
}

export function buildPrompt(cat, count, level, chunkRange) {
  var schema = [
    `{`,
    `  "name": "` + cat.nm + '",',
    `  "items": [`,
    `    {`,
    `      "sentence": "I would like to check in, please.",`,
    `      "translation": "我想办理入住，谢谢。",`,
    `      "chunks": ["I would like", "to check in,", "please."],`,
    `      "hints": ["我想要", "办理入住", "麻烦了"]`,
    `    }`,
    `  ]`,
    `}`
  ].join('\n');

  return [
    `你是资深英语教学设计专家。请为「` + cat.nm + '」场景生成 ' + count + ' 道英语句型「意群（chunk）拆分」练习题，难度：' + level + '。',
    ``,
    `内容要求：`,
    `1. 场景聚焦：` + cat.focus + '。',
    `2. 句子地道自然，长度适中，避免生僻词和中式英语；` + count + ' 句之间句型结构尽量不重复。',
    `3. 每句按语义拆成 ` + chunkRange + ' 个意群，拆分点必须落在自然停顿处（主谓之间、介词短语前、从句连接词前、不定式前等），不要在词组中间切断。',
    ``,
    `格式要求（非常重要，会被程序自动校验）：`,
    `A. chunks 数组用【单个空格】连接后，必须与 sentence 完全一致（忽略大小写和标点差异即算通过），标点请保留在所属 chunk 内。`,
    `B. chunks 数量必须在 2 到 5 之间。`,
    `C. hints 是每个 chunk 的中文提示，数量必须与 chunks 完全一致，只写该意群的意思，不要写整句翻译。`,
    `D. translation 是整句中文翻译。`,
    `E. 只输出 JSON 本体，不要任何解释文字，不要 markdown 代码块围栏。`,
    ``,
    `输出格式示例（items 里放 ` + count + ' 条）：',
    schema
  ].join('\n');
}

export function buildSplitPrompt(rawLines) {
  var lines = rawLines.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  var body = lines.map(function (s, i) { return '【' + (i + 1) + '】 ' + s; }).join('\n');
  return [
    '请将以下 ' + lines.length + ' 句英语口语句子拆分为意群（用于跟读练习），输出 JSON（不要输出任何其他文字）：',
    '',
    '要求：',
    '1. 每句 chunks 用单个空格连接后与原句完全一致（忽略大小写和标点）',
    '2. chunks 2-4 个；hints 是每个意群的中文提示',
    '3. translation 是整句中文翻译',
    '',
    '输出格式：',
    '[',
    '  { "sentence":"原句", "translation":"中文翻译", "chunks":["意群1","意群2"], "hints":["提示1","提示2"] }',
    ']',
    '',
    '待拆分句子：', body
  ].join('\n');
}

export function buildAppendPrompt(deckName) {
  return [
    '请为「' + deckName + '」题库追加 10 条新的英语口语练习句子（不要与已有句子重复），JSON 格式：',
    '[',
    '  { "sentence":"...", "translation":"...", "chunks":["...","..."], "hints":["...","..."] }',
    ']',
    'chunks 拼接必须与原句一致，2-4 个意群。'
  ].join('\n');
}
