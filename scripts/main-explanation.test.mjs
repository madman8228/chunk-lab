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
assert.deepEqual(buildFallbackExplanation({}), [{ tag: '说明', html: '<div class="explain-overview">本句暂无补充讲解。</div>', variant: 'info' }]);
console.log('main-explanation.test.mjs passed');
