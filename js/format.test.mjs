/**
 * format.test.mjs · 工具函数单测（ADR-007 Step 2）
 *
 * 覆盖从 main.html 抽取的 esc / norm / normSent / wordCount / timeAgo。
 * Node 直跑（原生 ESM）：node js/format.test.mjs
 */
'use strict';

import { esc, norm, normSent, wordCount, timeAgo } from './format.mjs';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ===== esc ===== */
check('esc: HTML 特殊字符', esc('<a href="x">&</a>') === '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;', esc('<a>'));
check('esc: 空值安全', esc(null) === '' && esc(undefined) === '' && esc('') === '');
check('esc: 单引号不转义（与 main.html 内联一致）', esc("it's") === "it's");

/* ===== norm ===== */
check('norm: 大小写/标点/空格', norm('  Hello, World!!  ') === 'hello world', norm('  Hello, World!!  '));
check('norm: 撇号差异归一', norm("it's") === norm('its') && norm('it\u2019s') === norm("it's"));
check('norm: 数字保留', norm('Lesson 5') === 'lesson 5');
check('norm: 空值安全', norm(null) === '' && norm(undefined) === '');

/* ===== normSent ===== */
check('normSent: 与 norm 一致', normSent('  I am  a STUDENT.  ') === 'i am a student');

/* ===== wordCount ===== */
check('wordCount: 常规', wordCount('I am a student') === 4);
check('wordCount: 多余空格', wordCount('  a   b  ') === 2);
check('wordCount: 空串', wordCount('') === 0 && wordCount('   ') === 0);

/* ===== timeAgo ===== */
check('timeAgo: 刚刚', timeAgo(Date.now() - 5000) === '刚刚');
check('timeAgo: 分钟前', timeAgo(Date.now() - 5 * 60000) === '5 分钟前');
check('timeAgo: 小时前', timeAgo(Date.now() - 3 * 3600000) === '3 小时前');
check('timeAgo: 天前', timeAgo(Date.now() - 2 * 86400000) === '2 天前');
check('timeAgo: 无时间显示占位（修 t=0 错误显示为“天前”的 bug）', timeAgo(0) === '—' && timeAgo(null) === '—');

console.log('\n[format.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
