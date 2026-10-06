import assert from 'node:assert/strict';
import { buildAnalysisSections, buildFallbackExplanation } from '../src/main/explanation.mjs';
const fallback = buildFallbackExplanation({
  explanation: {
    meaning: '一种**核心**含义',
    equivalents: [{ text: '中文表达', note: '对应语境' }],
    usage: '用于日常交流',
    examples: [{ en: 'Every Tom.', zh: '张三李四。' }],
  },
});
assert.deepEqual(fallback.map((section) => section.tag), ['核心含义', '中文对应表达', '常见使用场景', '经典例句']);
assert.match(fallback[0].html, /<b>核心<\/b>/);
assert.match(fallback[1].html, /中文表达/);
assert.match(fallback[3].html, /张三李四/);

const analysis = buildAnalysisSections({
  explanations: [{ grammar: '固定表达', words: [{ w: 'Every', p: 'det', m: '每个' }] }],
});
assert.equal(analysis.length, 1);
assert.equal(analysis[0].tag, '讲解 1');
assert.match(analysis[0].html, /固定表达/);
assert.match(analysis[0].html, /Every/);
/* 2026-09-23：无任何可展示字段时返回空数组，不再产出「说明 / 本句暂无补充讲解。」占位。
   空讲解由调用方 showExplanationPanel 判定为「不渲染」（整卡不出现）。 */
assert.deepEqual(buildFallbackExplanation({}), []);
assert.deepEqual(buildFallbackExplanation({ sentence: 'No explanation.', translation: '无讲解。' }), []);
assert.deepEqual(buildAnalysisSections({ sentence: 'No explanation.', translation: '无讲解。' }), []);
/* 只有译文时也不得凭空造出 section（旧的「核心含义」伪装已不复现） */
assert.deepEqual(buildAnalysisSections({ translation: '只有译文。' }).map((s) => s.tag), []);
const authoredBreakdown = buildAnalysisSections({
  sentence: 'How do we get there?',
  translation: '我们怎么去那里？',
  chunks: ['How do we get', 'there?'],
  hints: ['我们如何到达', '那里？'],
  grammar: [{ role: '疑问词+助动词+主语+谓语' }, { role: '状语' }],
});
assert.equal(authoredBreakdown.at(-1).tag, '句子拆解');
assert.match(authoredBreakdown.at(-1).html, /How do we get/);
assert.match(authoredBreakdown.at(-1).html, /我们如何到达/);
assert.match(authoredBreakdown.at(-1).html, /疑问词\+助动词\+主语\+谓语/);
console.log('main-explanation.test.mjs passed');
