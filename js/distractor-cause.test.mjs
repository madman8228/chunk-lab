/**
 * js/distractor-cause.test.mjs · 错因分类引擎单测（C2-I）
 * 运行：node js/distractor-cause.test.mjs
 */
import { classifyOne, classifySentence } from './distractor-cause.mjs';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

/* ===== classifyOne 分类正确性 ===== */
const CASES = [
  /* verb 动词形态 */
  ['How was', 'How is', 'verb'], ['How was', 'How has', 'verb'],
  ['My boss is', 'My boss was', 'verb'], ['meet a friend', 'meets a friend', 'verb'],
  ['I want', 'I wanted', 'verb'], ['He repeated', 'He repeats', 'verb'],
  ['He repeated', 'He had repeated', 'verb'], ["I'm going to", 'I going to', 'verb'],
  ["I'm going to", "I'm go to", 'verb'], ['go home', 'going home', 'verb'],
  ['Could you tell me', 'Could you told me', 'verb'], ['how to get', 'how getting', 'function'],
  ['The boys wrecked', 'The boy wrecked', 'form'],
  /* function 虚词 */
  ['your weekend?', 'you weekend?', 'function'], ['a friend', 'the friend', 'function'],
  ['the wrong way.', 'a wrong way.', 'function'], ['The flood was', 'A flood was', 'function'],
  ['meet a friend', 'meet friend', 'function'], ['a coffee', 'the coffee', 'function'],
  ['for lunch.', 'to lunch.', 'function'], ['Could you tell me', 'Could your tell me', 'function'],
  ['Could you tell me', 'Could you to tell me', 'function'], ['the deadline', 'a deadline', 'function'],
  ['Birds of a feather', 'Birds of different feather', 'function'],
  ['My boss is', 'My boss can be', 'function'], ["She's", "She'll be", 'function'],
  /* form 形近 */
  ['Pull', 'Put', 'form'], ['grab the chance!', 'grab the change!', 'form'],
  ['your weekend?', 'your weekends?', 'form'], ['you name it', 'you names it', 'form'],
  ['Make yourself at home', 'Take yourself at home', 'form'], ["Don't worry", "Don't hurry", 'form'],
  /* semantic 语义 */
  ['Pull', 'Calm', 'semantic'], ["She's", "He's", 'semantic'],
  ['an act of god.', 'an act of fate.', 'semantic'], ['going it alone', 'facing it alone', 'semantic'],
  ['peace', 'a break', 'semantic'], ["we've got it.", "we've seen it.", 'semantic'],
  ['Not much', 'Not many', 'semantic'], ["It's now or never", "It's now or later", 'semantic'],
  ['you two', 'you three', 'semantic'], ['Be there at three', 'Get there at three', 'semantic'],
  ['He runs the office', 'He owns the office', 'semantic'], ['Have fun', 'Make fun', 'semantic'],
  ['He holds', 'She holds', 'semantic'], ['He holds a grudge', 'She holds a grudge', 'semantic'],
  ['how to get', 'what to get', 'semantic'], ['the joke', 'the story', 'semantic']
];
console.log('classifyOne 分类正确性（' + CASES.length + ' 用例）');
CASES.forEach(function (t) {
  const got = classifyOne(t[0], t[1]);
  check('「' + t[0] + '」←「' + t[1] + '」→ ' + t[2], got === t[2], '实得 ' + got);
});

/* ===== classifySentence 结构 ===== */
console.log('\nclassifySentence 结构对齐');
const it = { sentence: 'How was your weekend?', chunks: ['How was', 'your weekend?'],
  distractors: [['How is', 'How are'], ['you weekend?', 'your weekends?']] };
const cs = classifySentence(it);
check('causes 与 distractors 同形（2 槽 × 2 条）', cs.length === 2 && cs[0].length === 2 && cs[1].length === 2);
check('slot0 全 verb', cs[0].every(function (e) { return e.c === 'verb'; }));
check('slot1 function+form', cs[1][0].c === 'function' && cs[1][1].c === 'form');
check('保留干扰原文', cs[0][0].d === 'How is');

/* ===== 极端输入不抛错 ===== */
console.log('\n极端输入容错');
['', ' ', null, undefined, 123, '!!!'].forEach(function (x) {
  try { classifyOne(x, 'How are'); passed++; }
  catch (e) { failed++; console.log('  ✗ classifyOne(' + JSON.stringify(x) + ') 抛错: ' + e.message); }
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
