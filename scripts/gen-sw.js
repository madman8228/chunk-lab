#!/usr/bin/env node
/**
 * gen-sw.js · 自动生成 sw.js 的 CACHE 版本 + PRECACHE 清单（零依赖，node 内置模块）
 *
 * 解决的问题（根因）：CACHE 版本与 PRECACHE 此前手写维护（曾 v45 手工台账），
 * 业务代码变更漏 bump → 浏览器 cache-first 命中旧缓存，修复"改了像没改"。
 *
 * 做法：
 *   1. 以 sw.js 内现有 PRECACHE 为权威基准（保留维护者人工确认过的离线必需清单）；
 *   2. 自动补全：扫描 main/courses/decks/stats 四个 HTML 的 <script src> 与 <link href>
 *      同源静态引用（js/css/png/json/html），缺啥补啥，消灭"新增模块忘加预缓存"；
 *   3. CACHE 版本 = 全部清单文件内容 sha1 前 8 位 → 资源一变版本自动变，
 *      activate 清理旧缓存，无需任何手改。
 *
 * 用法：node scripts/gen-sw.js   （资源变更后跑一次即可，无 watch、无构建器）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');
const HTML_FILES = ['main.html', 'courses.html', 'decks.html', 'stats.html'];

/* ---------- 解析 sw.js 现有基准 ---------- */
let sw = fs.readFileSync(SW, 'utf8');
const cacheMatch = sw.match(/^const CACHE = '[^']*';\s*(\/\/.*)?$/m);
const listMatch = sw.match(/const PRECACHE = \[[\s\S]*?\n\];/);
if (!cacheMatch || !listMatch) {
  console.error('[gen-sw] 未能在 sw.js 找到 CACHE 常量或 PRECACHE 数组，中止（文件结构变了？）');
  process.exit(1);
}

const base = (listMatch[0].match(/'([^']+)'/g) || []).map(function (s) { return s.slice(1, -1); });

/* ---------- 扫描 HTML 引用，自动补全 ---------- */
const SRC_RE = /(?:src|href)="([^"]+)"/g;
const seen = new Set(base);
const added = [];
const skip = new Set();
for (const f of HTML_FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.warn('[gen-sw] 跳过不存在的 HTML: ' + f); continue; }
  const html = fs.readFileSync(p, 'utf8');
  let m;
  SRC_RE.lastIndex = 0;
  while ((m = SRC_RE.exec(html)) !== null) {
    let u = m[1];
    if (/^(https?:|data:|blob:|about:|#|\/\/)/i.test(u)) continue;   // 外链 / 内联 / iframe 占位跳过
    if (/^\/api\//.test(u)) continue;                          // API 不预缓存
    if (u.includes('..')) continue;                            // 越界引用跳过
    u = '/' + u.replace(/^\.?\//, '').split('?')[0];
    if (seen.has(u)) continue;
    seen.add(u);
    const fp = path.join(ROOT, u.replace(/^\//, ''));
    if (!fs.existsSync(fp)) { skip.add(u); continue; }
    added.push(u);
  }
}

/* ---------- 校验基准文件存在 ---------- */
const missing = base.filter(function (u) { return !fs.existsSync(path.join(ROOT, u.replace(/^\//, ''))); });
if (missing.length) console.warn('[gen-sw] 基准文件缺失（已从清单剔除）: ' + missing.join(', '));

const files = base.filter(function (u) { return !missing.includes(u); }).concat(added);

/* ---------- 内容 hash → CACHE 版本 ---------- */
const h = crypto.createHash('sha1');
for (const u of files) h.update(fs.readFileSync(path.join(ROOT, u.replace(/^\//, ''))));
const version = 'chunklab-' + h.digest('hex').slice(0, 8);

/* ---------- 重写 sw.js ---------- */
const newList = 'const PRECACHE = [\n' + files.map(function (u) { return "  '" + u + "',"; }).join('\n') + '\n];';
sw = sw.replace(listMatch[0], newList);
sw = sw.replace(cacheMatch[0], "const CACHE = '" + version + "'; // 由 scripts/gen-sw.js 按资源内容 hash 自动生成，勿手改");
fs.writeFileSync(SW, sw);

console.log('[gen-sw] CACHE = ' + version + '  (' + files.length + ' 个预缓存文件)');
if (added.length) console.log('[gen-sw] 自动补全: ' + added.join(', '));
if (missing.length) console.log('[gen-sw] 剔除缺失基准: ' + missing.join(', '));
if (skip.size) console.warn('[gen-sw] HTML 引用但文件缺失: ' + Array.from(skip).join(', '));
console.log('[gen-sw] 完成');
