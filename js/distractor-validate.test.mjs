/**
 * distractor-validate.test.mjs · D-pipeline 纯逻辑单测
 *
 * 覆盖：
 *   - buildDistractorPrompt：结构（含版本号、chunk 列表、逐条质量约束、JSON-only）
 *   - parseDistractorText：围栏/BOM/杂文容忍 + 缺 distractors 报错
 *   - cleanDistractors：类型/长度护栏、norm 撞 chunk 即丢（含目标位自身）、位内去重、
 *     chunk 位缺位合法空、cap 3、句内多 chunk 撞车
 *
 * 运行： node js/distractor-validate.test.mjs
 */
'use strict';

import { buildDistractorPrompt, DISTRACTOR_PROMPT_VERSION } from './ai-prompts.mjs';
import { parseDistractorText, cleanDistractors } from './distractor-validate.mjs';

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra !== undefined ? '\n    → ' + JSON.stringify(extra) : '')); }
}

const it = {
  sentence: 'The bus is almost here.',
  translation: '公交车快到了。',
  chunks: ['The bus is', 'almost here.'],
  hints: ['公交车', '快到了']
};

/* ========== buildDistractorPrompt ========== */
console.log('== buildDistractorPrompt ==');
const p = buildDistractorPrompt(it);
check('含句子原文', p.indexOf('The bus is almost here.') >= 0);
check('含中文', p.indexOf('公交车快到了') >= 0);
check('逐 chunk 列出（2 个）', p.indexOf('1. The bus is') >= 0 && p.indexOf('2. almost here.') >= 0);
check('含 chunk 提示', p.indexOf('公交车') >= 0);
check('要求 3 个/位', /3 个干扰项/.test(p));
check('禁止同义改写（判对歧义）', /同义改写/.test(p));
check('强调句内语境相关', /语境相关|似乎成立/.test(p));
check('输出 JSON-only', p.indexOf('只输出 JSON 本体') >= 0);
check('版本号已 export', DISTRACTOR_PROMPT_VERSION === 1);

/* ========== parseDistractorText ========== */
console.log('== parseDistractorText ==');
let r = parseDistractorText('```json\n{"distractors":[["a","b","c"],["d","e","f"]]}\n```');
check('代码块围栏内可解析', r.ok && r.data.distractors.length === 2, r);
r = parseDistractorText('\uFEFF{"distractors":[[\"a\"]]}');
check('BOM 容忍', r.ok && r.data.distractors.length === 1, r);
r = parseDistractorText('好的，这是结果：{"distractors":[["a"]]}');
check('前后杂文容忍', r.ok, r);
r = parseDistractorText('{"items":[1,2]}');
check('缺 distractors → 报错', !r.ok && /distractors/.test(r.error), r);
r = parseDistractorText('不是 JSON');
check('坏 JSON → 报错', !r.ok, r);

/* ========== cleanDistractors ========== */
console.log('== cleanDistractors ==');
/* 正常 2×3 全收 */
let c = cleanDistractors(it, [['The bus was', 'A bus is', 'The buses are'], ['already here.', 'soon here.', 'not here.']]);
check('正常 2×3 → 2×3 全收', c.distractors[0].length === 3 && c.distractors[1].length === 3, c);
check('dropped=0', c.stats.dropped === 0, c.stats);

/* 撞句内 chunk norm（含目标位自身）→ 丢 */
c = cleanDistractors(it, [['The bus is', 'X', 'Y'], ['almost here.', 'Z']]);
check('撞目标位自身 chunk → 丢', c.distractors[0].length === 2 && c.distractors[0][0] === 'X' && c.distractors[0][1] === 'Y', c);
c = cleanDistractors(it, [['Almost here.', 'X'], ['W']]);
check('撞其他位 chunk norm → 丢（大小写/标点不敏感）', c.distractors[0].length === 1 && c.distractors[0][0] === 'X', c);

/* 非字符串 / 空串 → 丢 */
c = cleanDistractors(it, [[null, 123, '', '   ', 'ok'], []]);
check('非字符串/空白 → 丢', c.distractors[0].length === 1 && c.distractors[0][0] === 'ok', c);

/* 位内去重（norm 同） */
c = cleanDistractors(it, [['Hello there', 'hello there', 'Hello  there!'], []]);
check('位内 norm 去重', c.distractors[0].length === 1, c);

/* cap 3 */
c = cleanDistractors(it, [['1', '2', '3', '4', '5'], ['a']]);
check('每位置至多 3 条', c.distractors[0].length === 3, c);

/* 长度契约：外层数组数 ≠ chunks 数 → 拒绝（防后续数组前移错位） */
let cMis = cleanDistractors(it, [['only one']]);
check('LLM 少给一位 → ok:false（防错位，杜绝灌错填空位）', !cMis.ok && /长度/.test(cMis.error), cMis);
cMis = cleanDistractors(it, null);
check('raw 非数组 → ok:false', !cMis.ok, cMis);
cMis = cleanDistractors(it, [['a'], ['b'], ['c']]);
check('多给一位 → ok:false', !cMis.ok, cMis);

/* 长度护栏 */
c = cleanDistractors(it, [['x'.repeat(200), 'ok'], []]);
check('超长(>120) → 丢', c.distractors[0].length === 1, c);

/* 3 chunk 句：3 个位置各不互撞 */
const it3 = { sentence: 'He left the party early.', chunks: ['He', 'left the party', 'early.'] };
c = cleanDistractors(it3, [['She', 'It', 'We'], ['stayed all night', 'missed the party', 'joined the game'], ['late.', 'tonight.', 'again.']]);
check('3-chunk 句全收', c.distractors[0].length === 3 && c.distractors[1].length === 3 && c.distractors[2].length === 3, c);

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
