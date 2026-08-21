/**
 * backup.test.mjs · 存储/备份纯逻辑单测（ADR-007 Step 4）
 *
 * 覆盖 buildReinforceJson / buildReinforceTxt / buildExportPayload / parseExport
 * 与 ai-prompts 的 extractJSON（AI 输出解析）。
 * Node 直跑（原生 ESM）：node js/backup.test.mjs
 */
'use strict';

import { buildReinforceJson, buildReinforceTxt, buildExportPayload, parseExport } from './backup.mjs';
import { extractJSON } from './ai-prompts.mjs';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ===== buildReinforceJson ===== */
(function () {
  const wrong = [
    { it: { sentence: 'I am a student.', translation: '我是学生。', chunks: ['I am', 'a student'], hints: ['我是', '学生'] }, idx: [1], answers: ['', 'a teacher'] }
  ];
  const stats = { totalQuestions: 10, perfectCount: 8, reinforceCount: 1, accuracy: 75 };
  const d = buildReinforceJson(wrong, 'Test Deck', stats);
  check('reinforceJson: 顶层结构', d.name === 'Test Deck · 巩固清单' && d.source === 'Chunk Lab 错题导出' && d.total === 1);
  check('reinforceJson: 统计', d.stats.totalQuestions === 10 && d.stats.perfectCount === 8 && d.stats.accuracy === 75);
  check('reinforceJson: 错题条目', d.items[0].sentence === 'I am a student.' && d.items[0].chunks.join(' ') === 'I am a student');
  check('reinforceJson: 错误记录含用户答案', d.items[0]._mistakes[0].correct === 'a student' && d.items[0]._mistakes[0].user === 'a teacher');
  check('reinforceJson: 无错误下标时为 []', buildReinforceJson([{ it: { sentence: 'X', chunks: ['X'] } }], 'D', stats).items[0]._mistakes.length === 0);
})();

/* ===== buildReinforceTxt ===== */
(function () {
  const wrong = [
    { it: { sentence: 'I am a student.', translation: '我是学生。', chunks: ['I am', 'a student'] }, idx: [0], answers: { 0: 'I is' } }
  ];
  const stats = { totalQuestions: 3, perfectCount: 2, reinforceCount: 1, accuracy: 66 };
  const t = buildReinforceTxt(wrong, 'Deck', stats);
  check('reinforceTxt: 头部统计', t.indexOf('题库：Deck') >= 0 && t.indexOf('共 3 题 | PERFECT 2 题 | 需巩固 1 句') >= 0);
  check('reinforceTxt: 句子与意群', t.indexOf('英文：I am a student.') >= 0 && t.indexOf('意群：I am │ a student') >= 0);
  check('reinforceTxt: 错误明细', t.indexOf('[I am] 你写的：I is') >= 0);
  check('reinforceTxt: 尾部统计', t.indexOf('共 1 句需要巩固') >= 0);
})();

/* ===== buildExportPayload ===== */
(function () {
  const mem = { decks: [{ id: 'd1' }], best: {} };
  const book = [{ sentence: 'X' }];
  const p = buildExportPayload(mem, book, [{ courseId: 'c1' }], { c1: { done: 1 } });
  check('exportPayload: 应用标识与版本', p.__app === 'chunklab' && p.__version === 2 && typeof p.exportedAt === 'string');
  check('exportPayload: 各数据段', p.mem === mem && p.reinforceBook === book && p.courses[0].courseId === 'c1' && p.courseProgress.c1.done === 1);
})();

/* ===== parseExport ===== */
(function () {
  let r = parseExport('not json');
  check('parseExport: 非法 JSON', r.ok === false && r.error.indexOf('JSON 解析失败') === 0);
  r = parseExport(JSON.stringify({ __app: 'other' }));
  check('parseExport: 非本应用备份', r.ok === false && r.error === '非 Chunk Lab 备份文件');
  r = parseExport(JSON.stringify({ __app: 'chunklab', mem: null }));
  check('parseExport: mem 缺失', r.ok === false && r.error === '备份数据格式不正确');

  const good = {
    __app: 'chunklab',
    mem: { decks: [{ id: 'a' }, { id: 'b' }], mastered: { x: 1 }, stats: { bySentence: { s: 1, t: 2 } }, settings: { sound: true } },
    reinforceBook: [{ sentence: 'X' }, { sentence: 'Y' }],
    courses: [{ courseId: 'c1' }],
    courseProgress: { c1: { done: 2 } }
  };
  r = parseExport(JSON.stringify(good));
  check('parseExport: 正常解析', r.ok === true && r.data.mem.decks.length === 2 && r.data.book.length === 2 && r.data.courses.length === 1);
  check('parseExport: 摘要统计', r.data.summary.indexOf('· 题库 2 个') >= 0 && r.data.summary.indexOf('· 标熟 1 句') >= 0 && r.data.summary.indexOf('· 统计 2 句') >= 0 && r.data.summary.indexOf('· 错题本 2 条') >= 0 && r.data.summary.indexOf('· 图文课程 1 个') >= 0);
  check('parseExport: 摘要含覆盖警示', r.data.summary.indexOf('覆盖') >= 0);
})();

/* ===== extractJSON ===== */
(function () {
  check('extractJSON: 纯 JSON', extractJSON('{"a":1}').a === 1);
  check('extractJSON: 代码块围栏', extractJSON('```json\n{"a":1}\n```').a === 1);
  check('extractJSON: 前后噪音', extractJSON('好的：\n{"a":1}\n以上。').a === 1);
  check('extractJSON: 数组', extractJSON('结果如下：[1,2,3]')[2] === 3);
  check('extractJSON: BOM', extractJSON('\uFEFF{"a":1}').a === 1);
  check('extractJSON: 全角引号替代语法引号', extractJSON('{"a": \u201Cok\u201D}').a === 'ok');
  check('extractJSON: 尾逗号修复', extractJSON('{"a":1,}').a === 1);
})();

console.log('\n[backup.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
