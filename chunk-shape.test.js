/* ============================================================
   chunk-shape.test.js · 「最少切几段」判据的单测 + 防散落护栏
   node chunk-shape.test.js

   ★ 背景：书里有 96 条单字句（Help! / Thief! / Thanks. …），去标点后只有 1 个词，
     物理上切不成 2 段。旧判据一刀切 `chunks.length >= 2` 把它们全挡在门外。
     现改为按**句子形态**判定：1 词句允许 1 段，其余仍 ≥2。

   ★ 这个判据曾散落在 7 个文件里（本项目反复踩「改一处必漏一处」）。
     所以本测试做两件事：
       1) 判据本身的正反例（含负向自证：2 词句切 1 段必须判红）
       2) **护栏**：扫描全部 git 跟踪的源文件，除白名单外不许再出现硬编码段数比较；
          并断言各校验器确实引用同一份实现 —— 防止判据再被复制回各处
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var CS = require('./js/chunk-shape.js');

var pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function assertEq(actual, expected, name) {
  if (actual === expected) { pass++; console.log('  ✓ ' + name + ' = ' + JSON.stringify(expected)); }
  else { fail++; console.log('  ✗ ' + name + ' → ' + JSON.stringify(actual) + '（期望 ' + JSON.stringify(expected) + '）'); }
}

console.log('== 1. wordCount：去标点后的词数 ==');
[['Help!', 1], ['Thief!', 1], ['Thanks.', 1], ['Hi!', 1], ['Really?', 1], ['Maybe.', 1],
 ['Sure.', 1], ["Don't.", 1], ['OK.', 1], ['U.S.', 1], ['Wow!', 1],          /* 单字句：撇号/缩写算 1 词 */
 ["I'm late!", 2], ["Let's go.", 2], ['Good morning.', 2], ['Mr. Smith', 2],  /* 2 词：必须切 2 段 */
 ['How are you?', 3], ['', 0], ['...', 0], ['   ', 0]
].forEach(function (c) { assertEq(CS.wordCount(c[0]), c[1], 'wordCount(' + JSON.stringify(c[0]) + ')'); });

console.log('\n== 2. minChunks：单字句例外只此一条路径 ==');
assertEq(CS.minChunks('Help!'), 1, "minChunks('Help!')");
assertEq(CS.minChunks("Don't."), 1, "minChunks(\"Don't.\")");
assertEq(CS.minChunks("I'm late!"), 2, "minChunks(\"I'm late!\")");
assertEq(CS.minChunks('Good morning.'), 2, "minChunks('Good morning.')");
assertEq(CS.minChunks(''), 1, "minChunks('') 空句按 1（无从判定词数，不额外施压）");
assertEq(CS.MAX_CHUNKS, 5, 'MAX_CHUNKS');

console.log('\n== 3. chunkCountOk：正例 ==');
[['Help!', ['Help!']], ['Thief!', ['Thief!']], ["Don't.", ["Don't."]],
 ["I'm late!", ["I'm", 'late!']], ['How are you?', ['How', 'are', 'you?']],
 ['a b c d e', ['a', 'b', 'c', 'd', 'e']]
].forEach(function (c) { assert(CS.chunkCountOk(c[0], c[1]) === true, JSON.stringify(c[1]) + ' → 合格（' + c[0] + '）'); });

console.log('\n== 4. chunkCountOk：负向自证（必须能判红）==');
assert(CS.chunkCountOk("I'm late!", ["I'm late!"]) === false, '双词句切 1 段 → 判红（例外不可滥用）');
assert(CS.chunkCountOk('Good morning.', ['Good morning.']) === false, '双词句切 1 段（另一形态）→ 判红');
assert(CS.chunkCountOk('How are you?', ['How']) === false, '三词句只切 1 段 → 判红');
assert(CS.chunkCountOk('Help!', []) === false, '空 chunks → 判红');
assert(CS.chunkCountOk('Help!', null) === false, 'chunks 非数组 → 判红');
assert(CS.chunkCountOk('a b c d e f', ['a', 'b', 'c', 'd', 'e', 'f']) === false, '6 段 > MAX_CHUNKS(5) → 判红');

console.log('\n== 5. chunkCountError：错误文案与判据同源 ==');
assertEq(CS.chunkCountError('Help!', ['Help!']), null, "chunkCountError('Help!') 合格时为 null");
assert(/2/.test(CS.chunkCountError("I'm late!", ["I'm late!"]) || ''), '双词句 1 段 → 提示需 2 段');
assert(/6/.test(CS.chunkCountError('a b c', ['a', 'b', 'c', 'd', 'e', 'f']) || ''), '超 5 段 → 提示段数');

console.log('\n== 6. 护栏：判据必须只有一处实现 ==');
/* 各校验器 / 构建器必须引用同一份，而不是自己再写一遍 */
var MUST_REF = [
  'validate_oral_book.js',
  'validate_freq_idioms.js',
  'scripts/book-content-check.mjs',
  'scripts/build-content.mjs',
  'scripts/check-oral-batch.mjs',
  'scripts/gen-fast-content.mjs',
  'scripts/inject-freq-idioms.js'
];
MUST_REF.forEach(function (f) {
  var src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  assert(/chunk-shape/.test(src), f + ' 引用了 chunk-shape 判据');
});

/* 作者侧（两道 HTML 闸）也必须用同一判据 —— 2026-09-16 补：这 4 处原本硬编码
   `chunks.length 2-5`，导致库里 39 条单字句在编辑器/导入闸下存不进去。
   ⚠️ 只断言「引了脚本」不够：引入却不调用、照样自己硬编码，照样能过 → 两条都断言。
     调用处数用 ≥2（decks 2 处 / main 2 处），既拦「没接上」也拦「接了一处漏一处」。 */
['decks.html', 'main.html'].forEach(function (f) {
  var src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  assert(/<script src="js\/chunk-shape\.js">/.test(src), f + ' 引入了判据脚本 js/chunk-shape.js');
  var n = (src.match(/ChunkShape\.chunkCountOk\(/g) || []).length;
  assert(n >= 2, f + ' 的 ' + n + ' 处段数闸走 ChunkShape.chunkCountOk（应 ≥2）');
});

/* ★ 匹配前必须剥注释：判据的**旧写法**会被写进注释做说明（本文件第 6 行就复述了
   `chunks.length >= 2`），不剥就会把「说明」当成「违规」——假阳性会让护栏失去可信度，
   最后被人整体关掉（比没有护栏更糟）。本项目既有做法：策略类断言前先剥注释。
   引号状态只为不让字符串里的 `//`（如 URL）被当成注释起点；字符串内容本身保留
   （写死在字符串里的段数比较仍算违规，宁可保守）。 */
function stripComments(src) {
  var out = '', i = 0, n = src.length, quote = null;
  while (i < n) {
    var c = src[i], d = src[i + 1];
    if (quote) {
      if (c === '\\') { out += c + (d || ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && d === '*') { var e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { var f = src.indexOf('\n', i); i = f < 0 ? n : f; out += ' '; continue; }
    out += c; i++;
  }
  return out;
}

/* 白名单：这些文件里的段数比较是**已知豁免**，且都不是「判据的调用方」：
   - js/chunk-shape.js：判据的**唯一实现**，本来就该写段数比较
   - 本文件：判据自身的单测，负向自证的样例字面量（好样例 vs 坏样例）天然含这些写法
   ⚠️ decks.html / main.html **已移出白名单**（2026-09-16）：作者侧那 4 处硬编码已改为
      调用本判据 → 它们哪天退回 `chunks.length 2-5`，下面的散落检查会立刻报红。 */
var ALLOWED = ['js/chunk-shape.js', 'chunk-shape.test.js'];
var RE = /chunks\s*\.\s*length\s*[<>]=?\s*2|chunks\.length\s*[<>]=?\s*5/;

/* 负向自证：剥注释不许把护栏削钝 —— 真代码里的段数比较仍须被抓到，
   而同一句话只写在注释里则必须放行。两条缺一，剥注释就成了「关掉护栏」的借口。 */
assert(!RE.test(stripComments('/* 旧判据 chunks.length >= 2 一刀切 */')),
  '负向自证：只写在注释里的旧判据不算违规');
assert(RE.test(stripComments('if (it.chunks.length < 2) throw new Error("x");')),
  '负向自证：剥注释后仍能抓到真实代码里的段数比较（护栏未被削钝）');
assert(!RE.test(stripComments('var s = "a"; // chunks.length >= 5')),
  '负向自证：行尾注释里的段数比较被剥掉（避免把说明当违规）');
var tracked = [];
try {
  tracked = cp.execSync('git ls-files', { encoding: 'utf8', cwd: __dirname })
    .split(/\r?\n/).filter(function (f) { return /\.(js|mjs|html)$/.test(f); });
} catch (e) {
  tracked = [];
}
if (!tracked.length) {
  console.log('  ! SKIP：拿不到 git 文件清单（git 不可用？），散落检查未执行');
} else {
  var offenders = [];
  tracked.forEach(function (f) {
    if (ALLOWED.indexOf(f) >= 0) return;
    var src;
    try { src = fs.readFileSync(path.join(__dirname, f), 'utf8'); } catch (e) { return; }
    if (RE.test(stripComments(src))) offenders.push(f);
  });
  assert(offenders.length === 0,
    'git 跟踪的 ' + tracked.length + ' 个源文件中，除白名单外无硬编码段数比较' +
    (offenders.length ? '（违规：' + offenders.join(', ') + '）' : ''));
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
