#!/usr/bin/env node
'use strict';
/**
 * lib-deps.js · 运行时依赖闭包收集器（零依赖，node 内置模块）
 *
 * 解决的问题（根因，2026-09-10）：
 *   项目没有构建器，静态清单全部手工维护，于是出现两类静默漂移：
 *     ① scripts/gen-sw.js 只扫 HTML 的 src/href，**不跟 ES module 的 import** →
 *        js/distractor-cause.mjs（bridge.mjs 的传递依赖）漏出 PRECACHE；
 *     ② scripts/deploy-prod.sh 的 FILES 是手写清单，漏掉整个 js/ 目录 →
 *        部署"看起来成功"，线上仍是旧文件（比普通缓存问题更隐蔽）。
 *   两者根因同一个：**依赖关系靠人脑维护**。本模块把"谁能引用到谁"变成可计算的，
 *   由 gen-sw.js（预缓存）与 check-deploy-files.js（部署清单）共用同一份事实。
 *
 * 边界（防止误判，2026-09-10 核实）：
 *   - `.test.mjs` 与其被 import 的模块**不算运行时资源**（如 js/distractor-validate.mjs
 *     仅被 scripts/*.mjs、validate_distractors.js 和它自己的单测引用，别把它塞进 PRECACHE）；
 *   - manifest.json 的 icons 不被 HTML 引用（浏览器按 manifest 自行拉取），需单独解析；
 *   - 裸 npm 包名（express 等）与越界路径（含 ..）不纳入。
 *
 * 能力：
 *   - htmlRefs(file)      ：HTML 的 src/href 同源静态引用（/api、外链、data:、越界跳过）
 *   - moduleRefs(file)    ：一个 JS 文件里的 ESM `import/export ... from`、动态 import()、
 *                           CJS `require()` 的相对说明符（裸 npm 包名跳过）
 *   - collectClosure()    ：从种子文件出发递归展开模块闭包（.test.mjs 视为非运行时，跳过）
 *   - runtimeAssets()     ：HTML 直接引用 + 其 JS 闭包 + manifest 图标 = 前端运行时必需资源全集
 *
 * 用法：const deps = require('./lib-deps.js'); deps.runtimeAssets(['main.html', ...]);
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ESM：from 'x' / import('x') / 副作用式 import 'x'；CJS：require('x') */
const ESM_RE = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g;
const CJS_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const HTML_ATTR_RE = /(?:src|href)="([^"]+)"/g;

const SKIP_SCHEME = /^(https?:|data:|blob:|about:|mailto:|tel:|javascript:|#|\/\/)/i;
const JS_RE = /\.(m?js)$/i;
const TEST_RE = /\.test\.mjs$/i;

/* 前端入口 HTML（与 gen-sw.js / deploy 清单同源，改这里即三处生效） */
const HTML_ENTRIES = ['main.html', 'courses.html', 'decks.html', 'stats.html'];

function abs(rel) { return path.join(ROOT, rel); }

function readIfExists(rel) {
  const p = abs(rel);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

/* HTML 属性值 → 归一化相对路径（不可用引用返回 null） */
function normalizeRef(u) {
  if (SKIP_SCHEME.test(u)) return null;
  if (u.indexOf('/api/') === 0) return null;
  if (u.indexOf('..') >= 0) return null;              /* 本项目不越界引用 */
  let s = u.split('#')[0].split('?')[0];
  s = s.replace(/^\/+/, '').replace(/^\.\//, '');
  return s || null;
}

/* 一个 JS 文件里的相对依赖说明符（裸 npm 包名 / 越界路径跳过） */
function moduleRefs(rel) {
  const src = readIfExists(rel);
  if (src == null) return [];
  const out = [];
  let m;
  ESM_RE.lastIndex = 0;
  while ((m = ESM_RE.exec(src)) !== null) {
    const spec = m[1] || m[2] || m[3];
    if (spec) out.push(spec);
  }
  CJS_RE.lastIndex = 0;
  while ((m = CJS_RE.exec(src)) !== null) { if (m[1]) out.push(m[1]); }
  return out;
}

/* 说明符 → 归一化相对路径；仅接受同项目内的相对引用 */
function resolveSpecifier(spec, fromRel) {
  if (!/^\.{1,2}\//.test(spec)) return null;          /* 裸模块（npm 依赖）不算运行时静态资源 */
  if (spec.indexOf('..') >= 0) return null;
  const dir = path.posix.dirname(fromRel.split(path.sep).join('/'));
  const joined = path.posix.join(dir === '.' ? '' : dir, spec);
  return joined.replace(/^\/+/, '') || null;
}

/* 归一化路径 → 实际存在的文件（处理 CJS 的无扩展名 require 与目录 index 约定） */
function resolveToFile(rel) {
  const candidates = [rel];
  if (!/\.(m?js|json|html?|css|png|ico|webp|svg|woff2?|txt)$/i.test(rel)) {
    candidates.push(rel + '.js', rel + '.mjs', rel + '.json',
                    rel + '/index.js', rel + '/index.mjs');
  }
  for (const c of candidates) { if (readIfExists(c) != null) return c; }
  return null;
}

/* PWA manifest 的资源引用（icons + start_url）——浏览器直接按 manifest 拉取，不经 HTML */
function manifestRefs(rel) {
  const src = readIfExists(rel);
  if (src == null) return [];
  let j;
  try { j = JSON.parse(src); } catch (e) { return []; }
  const out = [];
  (j.icons || []).forEach(function (ic) { if (ic && ic.src) out.push(ic.src); });
  if (j.start_url) out.push(j.start_url);
  return out.map(normalizeRef).filter(Boolean);
}

/* 递归展开模块闭包。返回 { files:Set, missing:Set } */
function collectClosure(seeds) {
  const files = new Set();
  const missing = new Set();
  const queue = [];
  (seeds || []).forEach(function (s) { if (s) queue.push(s); });
  while (queue.length) {
    const rel = queue.shift();
    if (files.has(rel)) continue;
    if (TEST_RE.test(rel)) continue;                   /* 测试文件不属运行时资源 */
    const src = readIfExists(rel);
    if (src == null) { missing.add(rel); continue; }
    files.add(rel);
    if (!JS_RE.test(rel)) continue;                    /* 只跟 JS 类文件的依赖 */
    moduleRefs(rel).forEach(function (spec) {
      const r = resolveSpecifier(spec, rel);
      if (r) queue.push(resolveToFile(r) || r);       /* CJS 无扩展名 require 补全为真实文件 */
    });
  }
  return { files: files, missing: missing };
}

/**
 * 前端运行时必需资源全集。
 * @param {string[]} htmlFiles 入口 HTML（相对项目根）
 * @param {string[]} [extraSeeds] 额外种子（如 'sw.js'）
 * @returns {{files:string[], missingRefs:string[], entryHtml:string[]}}
 */
function runtimeAssets(htmlFiles, extraSeeds) {
  const direct = new Set();
  const missingRefs = new Set();
  (htmlFiles || []).forEach(function (f) {
    const src = readIfExists(f);
    if (src == null) { missingRefs.add(f); return; }
    direct.add(f);
    let m;
    HTML_ATTR_RE.lastIndex = 0;
    while ((m = HTML_ATTR_RE.exec(src)) !== null) {
      const r = normalizeRef(m[1]);
      if (r) direct.add(r);
    }
  });

  /* manifest.json 的图标/start_url 补进引用集（HTML 里看不到） */
  if (direct.has('manifest.json')) {
    manifestRefs('manifest.json').forEach(function (r) { direct.add(r); });
  }

  /* 只把真实存在的引用算作资源；HTML 里指向不存在文件的引用单独报出来 */
  const seeds = new Set();
  direct.forEach(function (r) {
    if (readIfExists(r) != null) seeds.add(r);
    else missingRefs.add(r);
  });
  (extraSeeds || []).forEach(function (r) { if (r) seeds.add(r); });

  const closure = collectClosure(Array.from(seeds));
  closure.missing.forEach(function (r) { missingRefs.add(r); });

  return {
    files: Array.from(closure.files).sort(),
    missingRefs: Array.from(missingRefs).sort(),
    entryHtml: Array.from(direct).filter(function (r) { return /\.html?$/i.test(r) && readIfExists(r) != null; })
  };
}

module.exports = {
  ROOT: ROOT,
  HTML_ENTRIES: HTML_ENTRIES,
  readIfExists: readIfExists,
  normalizeRef: normalizeRef,
  moduleRefs: moduleRefs,
  manifestRefs: manifestRefs,
  resolveSpecifier: resolveSpecifier,
  resolveToFile: resolveToFile,
  collectClosure: collectClosure,
  runtimeAssets: runtimeAssets
};

/* 直接执行时作为诊断工具：打印前端运行时资源全集（可传 HTML 文件名覆盖） */
if (require.main === module) {
  const entries = process.argv.slice(2).filter(function (a) { return !a.startsWith('-'); });
  const res = runtimeAssets(entries.length ? entries : HTML_ENTRIES);
  console.log('[lib-deps] 前端运行时资源 ' + res.files.length + ' 个:');
  res.files.forEach(function (f) { console.log('  ' + f); });
  if (res.missingRefs.length) console.warn('[lib-deps] 引用了但不存在的文件: ' + res.missingRefs.join(', '));
}
