#!/usr/bin/env node
/**
 * check-sw.js · SW 缓存版本一致性护栏
 *
 * 解决的问题（根因）：改 main.html 等被 PRECACHE 覆盖的业务文件后，忘跑
 * `node scripts/gen-sw.js` → sw.js 内 CACHE 仍是旧哈希 → 浏览器 cache-first
 * 命中旧缓存，"修复了像没改"（2026-09-08 三个 commit 全踩过，见 d9db3a6）。
 *
 * 判定语义（两档，避免合法 WIP 误报）：
 *   1. 工作区当前文件重算哈希 == sw.js CACHE        → 绿 ✓
 *   2. 不一致但 git 有未提交的业务文件改动（如 popover WIP）
 *      → 黄：提示「提交时记得 gen-sw」，exit 0（当前哈希代表 WIP，非漏跑）
 *   3. 不一致且工作区干净（无未提交改动）            → 红 ✗ exit 1（真漏跑）
 *
 * 用法：node scripts/check-sw.js     （npm test 串联自动跑）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');

let sw;
try { sw = fs.readFileSync(SW, 'utf8'); }
catch (e) { console.error('[check-sw] 找不到 sw.js，跳过'); process.exit(0); }

const cacheMatch = sw.match(/^const CACHE = '([^']*)';/m);
const listMatch = sw.match(/const PRECACHE = \[([\s\S]*?)\n\];/);
if (!cacheMatch || !listMatch) {
  console.error('[check-sw] 未能在 sw.js 找到 CACHE 常量或 PRECACHE 数组，跳过（文件结构变了？）');
  process.exit(0);
}

const files = listMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
const h = crypto.createHash('sha1');
const missing = [];
files.forEach(function (f) {
  try { h.update(fs.readFileSync(path.join(ROOT, f))); }
  catch (e) { missing.push(f); }
});
const calc = h.digest('hex').slice(0, 8);
const cur = cacheMatch[1];
/* gen-sw 写入带 'chunklab-' 前缀（PWA 缓存名语义）→ 比对须拼前缀，否则纯 hash8 永远 != 带前缀 cur */
const expect = 'chunklab-' + calc;

if (missing.length) {
  console.error('[check-sw] 预缓存清单含缺失文件: ' + missing.join(', '));
  process.exit(1);
}
if (cur === expect) {
  console.log('[check-sw] ✓ CACHE=' + cur + ' 与 ' + files.length + ' 个预缓存文件一致');
  process.exit(0);
}

/* 不一致：区分「真漏跑」与「有未提交 WIP」。
   只认已跟踪文件的修改（M/A/D/R/C 等），忽略 ?? 未跟踪（它们不影响 PRECACHE 资源哈希）。 */
let dirty = false;
try {
  const out = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
  dirty = out.split('\n').some(function (line) {
    if (!line.trim()) return false;
    if (line.slice(0, 2).trim() === '??') return false;   /* untracked 不算业务 WIP */
    const f = line.slice(3).trim();
    return f !== 'sw.js' && !f.startsWith('"sw.js"');       /* sw.js 自身差异不算 */
  });
} catch (e) { dirty = true; /* git 不可用，从严处理 */ }

if (dirty) {
  console.warn('[check-sw] ⚠ CACHE=' + cur + ' 与工作区哈希 ' + calc + ' 不一致，但检测到未提交的业务文件改动（WIP）');
  console.warn('[check-sw]   提交前请运行 `node scripts/gen-sw.js` 并一并提交，否则线上/缓存仍是旧版。');
  process.exit(0);
}
console.error('[check-sw] ✗ CACHE=' + cur + ' 与资源内容哈希 ' + calc + ' 不一致，且工作区干净 → 漏跑 gen-sw');
console.error('[check-sw] 运行 `node scripts/gen-sw.js` 重新生成后再提交');
process.exit(1);
