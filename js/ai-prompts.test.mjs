/**
 * ai-prompts.test.mjs · AI prompt 构建单测（ADR-007 Step 3）
 *
 * 锁定 prompt 结构（防 AI 功能格式回归）：
 *   - buildExplainPrompt：含句子/中文/意群列表/字段规范/JSON 输出要求
 *   - buildBatchExplainPrompt：pending 列表一一对应、输出示例
 *   - buildPrompt：场景名/数量/难度/格式要求/示例 schema
 *   - buildSplitPrompt：行数统计、待拆分句列表
 *   - buildAppendPrompt：题库名、追加要求
 * Node 直跑（原生 ESM）：node js/ai-prompts.test.mjs
 */
'use strict';

import { buildExplainPrompt, buildBatchExplainPrompt, buildPrompt, buildSplitPrompt, buildAppendPrompt } from './ai-prompts.mjs';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ===== buildExplainPrompt ===== */
(function () {
  const it = { sentence: 'I am a student.', translation: '我是一个学生。', chunks: ['I am', 'a student'], hints: ['我是', '一名学生'] };
  const p = buildExplainPrompt(it);
  check('buildExplainPrompt: 含原句', p.indexOf('句子：I am a student.') >= 0);
  check('buildExplainPrompt: 含中文', p.indexOf('中文：我是一个学生。') >= 0);
  check('buildExplainPrompt: 意群按序列出', p.indexOf('1. I am（提示：我是）') >= 0 && p.indexOf('2. a student（提示：一名学生）') >= 0, p);
  check('buildExplainPrompt: 声明意群数量', p.indexOf('与意群数一致（2 个）') >= 0);
  check('buildExplainPrompt: JSON 输出要求', p.indexOf('不要 Markdown 代码块标记') >= 0);
  check('buildExplainPrompt: 无 hints 时不带提示', buildExplainPrompt({ sentence: 'X', chunks: ['X'] }).indexOf('（提示：') < 0);
})();

/* ===== buildBatchExplainPrompt ===== */
(function () {
  const pending = [
    { sentence: 'A1', translation: '甲', chunks: ['A1'] },
    { sentence: 'B1 B2', translation: '乙', chunks: ['B1', 'B2'] }
  ];
  const p = buildBatchExplainPrompt(pending);
  check('buildBatchExplainPrompt: 句数声明', p.indexOf('共 2 句') >= 0);
  check('buildBatchExplainPrompt: 逐句列出', p.indexOf('[1] A1') >= 0 && p.indexOf('[2] B1 B2') >= 0);
  check('buildBatchExplainPrompt: 意群拼接', p.indexOf('1.A1') >= 0 && p.indexOf('1.B1  /  2.B2') >= 0, p);
  check('buildBatchExplainPrompt: items 一一对应', p.indexOf('items 数组与句子列表一一对应（2 项）') >= 0);
  check('buildBatchExplainPrompt: 空列表安全', buildBatchExplainPrompt([]).indexOf('共 0 句') >= 0);
})();

/* ===== buildPrompt ===== */
(function () {
  const cat = { nm: '日常对话', focus: '日常生活对话' };
  const p = buildPrompt(cat, '15', '进阶', '2-5');
  check('buildPrompt: 场景名与数量难度', p.indexOf('「日常对话」场景生成 15 道') >= 0 && p.indexOf('难度：进阶') >= 0);
  check('buildPrompt: 聚焦点', p.indexOf('1. 场景聚焦：日常生活对话。') >= 0);
  check('buildPrompt: chunk 范围', p.indexOf('拆成 2-5 个意群') >= 0);
  check('buildPrompt: 格式要求', p.indexOf('chunks 数组用【单个空格】连接后') >= 0 && p.indexOf('不要 markdown 代码块围栏') >= 0);
  check('buildPrompt: 示例 schema 含 name', p.indexOf('"name": "日常对话"') >= 0);
  check('buildPrompt: 示例要求 items 数量', p.indexOf('items 里放 15 条') >= 0);
})();

/* ===== buildSplitPrompt ===== */
(function () {
  const p = buildSplitPrompt(['  Hello world.  ', '', '  How are you?  ']);
  check('buildSplitPrompt: 去空白统计句数', p.indexOf('以下 2 句英语口语') >= 0, p.split('\n')[0]);
  check('buildSplitPrompt: 待拆分列表', p.indexOf('【1】 Hello world.') >= 0 && p.indexOf('【2】 How are you?') >= 0);
  check('buildSplitPrompt: JSON 格式要求', p.indexOf('chunks 用单个空格连接后与原句完全一致') >= 0);
  check('buildSplitPrompt: 全空输入', buildSplitPrompt([]).indexOf('以下 0 句') >= 0);
})();

/* ===== buildAppendPrompt ===== */
(function () {
  const p = buildAppendPrompt('我的口语');
  check('buildAppendPrompt: 含题库名', p.indexOf('「我的口语」题库追加 10 条') >= 0);
  check('buildAppendPrompt: 去重要求', p.indexOf('不要与已有句子重复') >= 0);
  check('buildAppendPrompt: chunks 约束', p.indexOf('chunks 拼接必须与原句一致，2-4 个意群') >= 0);
})();

console.log('\n[ai-prompts.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
