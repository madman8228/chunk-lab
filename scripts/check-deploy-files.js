#!/usr/bin/env node
'use strict';
/**
 * check-deploy-files.js · 「部署清单 vs 运行时依赖」一致性护栏
 *
 * 解决的问题（根因，2026-09-10）：
 *   scripts/deploy-prod.sh 的 FILES 是手写白名单。它漏掉了整个 js/ 目录，
 *   而 4 个页面都在引 js/idb.js + js/icons.js，main.html 还引 js/bridge.mjs。
 *   后果比普通缓存问题更隐蔽：部署脚本把新 sw.js 传上去 → 客户端 CACHE 版本变了、
 *   旧缓存被清 → 看起来"更新成功"，**实际拉到的是服务器上的旧 js/ 文件**，
 *   于是"改了 js/icons.js 但线上没变化"。
 *   脚本第 43 行写着 `chown ... $APP/js`，说明作者以为 js/ 早就在服务器上——
 *   这种"靠记忆维护清单"的模式必然再次漂移，所以改为**可计算的校验**。
 *
 * 判定：
 *   必需项 = 前端运行时资源（HTML 引用 + ESM import 递归闭包 + manifest 图标）
 *          + 后端运行时资源（server/index.js 的 require 闭包）
 *          + sw.js（浏览器 register('sw.js') 引入，不出现在任何 HTML 里）
 *   等价类：
 *     ✗ 必需项不在 FILES          → exit 1（部署后会静默漂移）
 *     ✗ FILES 里有不存在的文件    → exit 1（tar 阶段直接失败）
 *     ⚠ FILES 里有非必需项        → 仅提示（可能是有意为之，如根 package.json）
 *
 * 用法：node scripts/check-deploy-files.js   （npm test 串联自动跑；
 *        deploy-prod.sh 在打包前也会先跑一次，缺文件即中止，不带着缺口上线）
 */
const fs = require('fs');
const path = require('path');
const deps = require('./lib-deps.js');

const ROOT = deps.ROOT;
const DEPLOY = path.join(ROOT, 'scripts', 'deploy-prod.sh');

/* ---------- 解析 deploy-prod.sh 的 FILES 数组 ---------- */
function parseFiles() {
  const sh = fs.readFileSync(DEPLOY, 'utf8');
  const m = sh.match(/^FILES=\(([\s\S]*?)^\)/m);
  if (!m) {
    console.error('[check-deploy] ✗ 未能从 deploy-prod.sh 解析 FILES 数组（结构变了？）');
    process.exit(1);
  }
  return m[1].split(/\s+/).map(function (s) { return s.trim(); })
    .filter(function (s) { return s && s.charAt(0) !== '#'; });
}

const deployed = parseFiles();
const deployedSet = new Set(deployed);
const existsAny = function (p) { return fs.existsSync(path.join(ROOT, p)); };

/* ---------- 算出运行时必需项 ---------- */
const feRes = deps.runtimeAssets(deps.HTML_ENTRIES);
const feFiles = feRes.files;
const beClosure = deps.collectClosure(['server/index.js']);
const beFiles = Array.from(beClosure.files).sort();

/* 运行时必需、但不出现在任何依赖图里的文件（无法被自动推导，只能显式列出）：
     - sw.js                ：由 navigator.serviceWorker.register('sw.js') 引入，不被 HTML 引用
     - server/loadenv.js    ：`node -r ./loadenv.js index.js` 手动预加载，不在 require 图里
     - server/backup-db.js  ：cron 直接 `node server/backup-db.js backup` 调用，不被 require */
const OUT_OF_GRAPH_REQUIRED = ['sw.js', 'server/loadenv.js', 'server/backup-db.js'];

const required = Array.from(new Set(feFiles.concat(beFiles).concat(OUT_OF_GRAPH_REQUIRED))).sort();

/* ---------- 比对 ---------- */
const missing = required.filter(function (r) { return !deployedSet.has(r); });
const absent = deployed.filter(function (d) { return !existsAny(d); });
const extra = deployed.filter(function (d) { return required.indexOf(d) < 0; });

console.log('[check-deploy] FILES ' + deployed.length + ' 项 / 运行时必需 ' + required.length +
            ' 项（前端 ' + feFiles.length + ' + 后端依赖图 ' + beFiles.length + ' + 图外 ' +
            OUT_OF_GRAPH_REQUIRED.length + '）');

if (feRes.missingRefs.length) {
  console.error('[check-deploy] ✗ 前端引用了但不存在的文件: ' + feRes.missingRefs.join(', '));
}
if (beClosure.missing.length) {
  console.error('[check-deploy] ✗ 后端 require 了但不存在的文件: ' + Array.from(beClosure.missing).join(', '));
}

let fail = false;
if (missing.length) {
  fail = true;
  console.error('[check-deploy] ✗ 运行时必需但 FILES 未列（部署后会"看起来成功、线上是旧文件"）:');
  missing.forEach(function (f) { console.error('    ' + f); });
  console.error('[check-deploy]   → 把它们加进 scripts/deploy-prod.sh 的 FILES 数组');
}
if (absent.length) {
  fail = true;
  console.error('[check-deploy] ✗ FILES 列出但文件不存在（tar 会失败）: ' + absent.join(', '));
}
if (fail) {
  console.error('[check-deploy] 中止：部署清单与运行时依赖不一致');
  process.exit(1);
}

if (extra.length) {
  console.log('[check-deploy] ⚠ FILES 中的非运行时依赖项（确认是有意保留）: ' + extra.join(', '));
}
console.log('[check-deploy] ✓ 部署清单已覆盖全部运行时依赖');
