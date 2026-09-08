/**
 * scan-emoji.js · 扫项目 UI 文件的字符 icon 用法
 * 范围：根目录 *.html / js/*.js / js/*.mjs / server/*.js（除 node_modules/output/.git）
 * 输出：每文件按行号列出 emoji + 短上下文
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const EXCLUDE = new Set(['node_modules', 'output', '.git', '.workbuddy']);
const TARGETS = ['.html', '.js', '.mjs'];

/* 匹配 emoji 与常见装饰符号（ZWJ / variation selector 自动聚合）。
   覆盖区段说明：
   - 1F300-1FAFF / 1F100-1F2FF：emoji 主区 + 扩展
   - 2600-27BF：杂项符号 + 装饰符（含 ★ ✓ ✗ ⚠ ✦ 等）
   - 2300-23FF：Misc Technical（⏱ ⏎ 等）
   - 2190-21FF：箭头（← → ↻ ↺ 等，曾被用作按钮字符 icon）
   - 2200-22FF：数学运算符（⊇ ∈ 等，曾被用作文字说明里的符号）
   - 25A0-25FF：几何形状（▶ ● ■ 等，曾被用作按钮/状态 icon）
   - 00D7 / 00F7：× ÷（曾被用作删除按钮字符 icon）
   不含 · — 等纯文本标点分隔符（非 icon 用法，避免误报） */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{2200}-\u{22FF}\u{25A0}-\u{25FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{00D7}\u{00F7}](\u{FE0F}|\u{200D}[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{1F3FB}-\u{1F3FF})?/gu;

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    if (EXCLUDE.has(name)) return;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TARGETS.some(function (t) { return p.endsWith(t); })) out.push(p);
  });
}
const files = [];
walk(ROOT, files);

let totalHits = 0;
const summary = [];
files.forEach(function (fp) {
  const text = fs.readFileSync(fp, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach(function (line, i) {
    const re = new RegExp(EMOJI_RE.source, 'gu');
    let m;
    while ((m = re.exec(line))) {
      hits.push({ ln: i + 1, emoji: m[0], ctx: line.trim().slice(0, 100) });
    }
  });
  if (hits.length) {
    summary.push({ file: path.relative(ROOT, fp), count: hits.length, hits: hits });
    totalHits += hits.length;
  }
});
console.log('=== 项目 UI 字符 icon 扫描（emoji + Unicode 符号） ===');
summary.forEach(function (s) {
  console.log('\n# ' + s.file + '  (' + s.count + ' 处)');
  s.hits.forEach(function (h) {
    console.log('  L' + h.ln + '  ' + JSON.stringify(h.emoji) + '  | ' + h.ctx);
  });
});
console.log('\n=== 总计: ' + totalHits + ' 处（' + summary.length + ' 个文件）===');