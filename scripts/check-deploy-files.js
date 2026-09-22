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
 *          + sw.js 的 PRECACHE / PRECACHE_SOFT 资源（由 Service Worker 按 URL 运行时请求）
 *   等价类：
 *     ✗ 必需项不在 FILES          → exit 1（部署后会静默漂移）
 *     ✗ FILES 里有不存在的文件    → exit 1（tar 阶段直接失败）
 *     ⚠ FILES 里有非必需项        → 仅提示（可能是有意为之，如根 package.json）
 *       ⚠ 但**目录项不算非必需**：目录覆盖其下的必需文件（如 assets 覆盖 SW 预缓存里的 67 条图片）。
 *         把目录项误报成「非必需」会诱人删掉它 —— 2026-09-21 的封面全 404 + SW 装不上就是这么来的。
 *
 * 附带第二段护栏：deploy-prod.sh 的**部署安全顺序**（2026-09-10 加）
 *   服务端启动迁移是「有损」的——把 mastered/reinforceBook/deletedItems 从 user_kv 的
 *   blob 搬进 user_entity_rows 并删掉原 blob 行。于是回滚不再能只回代码，必须先有全库快照。
 *   这类安全约束和 FILES 清单一样会腐烂（有人重排步骤、或把快照失败改成 warn 放行），
 *   所以同样改成可计算的校验，而不是靠脚本里的注释提醒。
 *
 * 用法：node scripts/check-deploy-files.js   （npm test 串联自动跑；
 *        deploy-prod.sh 在打包前也会先跑一次，缺文件即中止，不带着缺口上线）
 */
const fs = require('fs');
const path = require('path');
const deps = require('./lib-deps.js');

const ROOT = deps.ROOT;
/* 允许指向别的脚本副本，供 scripts/deploy-safety.test.js 用篡改副本做负向验证，
   避免测试过程中写真实仓库文件。 */
const DEPLOY = process.env.CHUNKLAB_DEPLOY_SCRIPT
  ? path.resolve(process.env.CHUNKLAB_DEPLOY_SCRIPT)
  : path.join(ROOT, 'scripts', 'deploy-prod.sh');
const SH = fs.readFileSync(DEPLOY, 'utf8');

/* ---------- 解析 deploy-prod.sh 的 FILES 数组 ---------- */
function parseFiles() {
  const m = SH.match(/^FILES=\(([\s\S]*?)^\)/m);
  if (!m) {
    console.error('[check-deploy] ✗ 未能从 deploy-prod.sh 解析 FILES 数组（结构变了？）');
    process.exit(1);
  }
  return m[1].split(/\s+/).map(function (s) { return s.trim(); })
    .filter(function (s) { return s && s.charAt(0) !== '#'; });
}

/* ---------- 部署安全顺序校验 ---------- */
/* 部署不变量都必须是「结构上可判定」的，不能靠读注释：
     ① 存在迁移前快照（调 server/backup-db.js backup）
     ② 快照在重启服务之前（顺序反了等于没备份）
     ③ 快照失败要中止（拿不到成功标记 → exit 1），不能 warn 放行
     ④ 进度判定不能取原始输出的最后一行（backup-db.js 超出保留份数会打印
        「清理旧备份」，那是最后一行 —— tail -1 会在备份满 14 份后稳定误判）
     ⑤ 上传前必须跑本地完整回归（主套件、账号、批次、8000句移动专项）
     ⑥ 远端必须显式启用生产模式、鉴权、反向代理信任和强 JWT 密钥
     ⑦ 部署目标必须由操作者显式传入，不能有危险默认主机 */
function checkDeploySafety() {
  const problems = [];
  if (SH.indexOf('if [ "$#" -ne 1 ]') < 0 || SH.indexOf('HOST="$1"') < 0) {
    problems.push('部署脚本必须显式传入唯一目标主机，禁止使用默认公网主机');
  }
  const requiredPreflight = [
    ['npm test', '主测试套件'],
    ['npm run test:accounts', '账号隔离专项'],
    ['npm run test:batch-sync', '批次同步专项'],
    ['node e2e/mobile-8000.test.js', '8000句移动专项'],
  ];
  requiredPreflight.forEach(function (entry) {
    if (SH.indexOf(entry[0]) < 0) {
      problems.push('部署脚本缺少上传前的本地 ' + entry[1] + '（' + entry[0] + '）');
    }
  });
  if (requiredPreflight.some(function (entry) { return SH.indexOf(entry[0]) < 0; })) {
    problems.push('候选版本未经过完整发布回归，禁止上传');
  }
  if (SH.indexOf("grep -Eq '^NODE_ENV=production") < 0 ||
      SH.indexOf("grep -Eq '^REQUIRE_AUTH=true") < 0 ||
      SH.indexOf("grep -Eq '^TRUST_PROXY=true") < 0 ||
      !/JWT_SECRET[\s\S]*length\(\\?\$2\)>=32/.test(SH)) {
    problems.push('部署脚本缺少远端生产配置预检（NODE_ENV=production、REQUIRE_AUTH=true、TRUST_PROXY=true、JWT_SECRET≥32）');
  }
  const snapIdx = SH.indexOf('backup-db.js backup');
  const restartIdx = SH.indexOf('systemctl restart chunklab');

  if (snapIdx < 0) {
    problems.push('deploy-prod.sh 里找不到迁移前快照（server/backup-db.js backup）。' +
      '行级实体迁移会删掉 user_kv 的 blob 行，没有快照就无法回滚。');
  }
  if (restartIdx < 0) {
    problems.push('deploy-prod.sh 里找不到 `systemctl restart chunklab`（脚本结构变了，请同步本护栏）');
  }
  if (snapIdx >= 0 && restartIdx >= 0 && snapIdx > restartIdx) {
    problems.push('快照步骤排在重启之后（等于没备份）：快照必须在 systemctl restart 之前');
  }
  if (snapIdx >= 0) {
    const zone = restartIdx > snapIdx ? SH.slice(snapIdx, restartIdx) : SH.slice(snapIdx);
    /* 兼容两种写法：日志原样 '[backup-db] OK:' 与被 grep 转义过的 'backup-db\] OK:' */
    if (!/backup-db\\?\] OK:/.test(zone)) {
      problems.push('快照步骤没有校验 backup-db.js 的成功标记（backup-db] OK:），' +
        '无法判断快照是否真打成');
    }
    /* 逐行判定：凡是用到 `| tail -1` 的行，同一行必须先有 grep 收窄——
       否则就是"直接取原始输出最后一行"。 */
    const badTail = zone.split('\n').filter(function (l) {
      return l.indexOf('| tail -1') >= 0 && l.indexOf('grep') < 0;
    });
    if (badTail.length) {
      problems.push('快照结果疑似直接取原始输出最后一行：backup-db.js 超出保留份数会打印' +
        '「清理旧备份」，那是最后一行，备份满 14 份后会把成功误判为失败。请先 grep 成功标记。' +
        '（问题行：' + badTail[0].trim().slice(0, 60) + '）');
    }
    if (!/\bexit 1\b/.test(zone)) {
      problems.push('快照失败分支缺少 exit 1（快照拿不到却继续部署 = fail-open）');
    }
  }
  return problems;
}

const safetyProblems = checkDeploySafety();

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
const OUT_OF_GRAPH_REQUIRED = ['sw.js', 'server/loadenv.js', 'server/backup-db.js', 'content/manifest.json'];

/* Service Worker 资源不会出现在 HTML / require 依赖图里：
   - PRECACHE 由 install 阶段 addAll，漏传会直接造成安装失败；
   - PRECACHE_SOFT 由运行时尽力缓存，漏传会让课程封面/图片线上 404，
     但 check-sw.js 只检查工作区文件存在，无法发现部署白名单漏项。
   两类资源都必须被 deploy-prod.sh 的 FILES 覆盖。 */
function serviceWorkerResources() {
  const file = path.join(ROOT, 'sw.js');
  if (!fs.existsSync(file)) return [];
  const source = fs.readFileSync(file, 'utf8');
  const resources = [];
  ['PRECACHE', 'PRECACHE_SOFT'].forEach(function (name) {
    const match = source.match(new RegExp('const\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\];'));
    if (!match) {
      if (name === 'PRECACHE') {
        console.error('[check-deploy] ✗ sw.js 缺少 PRECACHE 数组（结构变了？）');
        process.exit(1);
      }
      return;
    }
    match[1].split(',').forEach(function (entry) {
      const value = entry.trim().replace(/^['"]|['"]$/g, '').replace(/^\/+/, '');
      if (value) resources.push(value);
    });
  });
  return Array.from(new Set(resources));
}

const SERVICE_WORKER_REQUIRED = serviceWorkerResources();

/* 内容分片由 manifest 在运行时按需请求，HTML/require 依赖图无法看见它们。
   把 manifest 中声明的每个分片也纳入部署闭包，避免部署了 manifest 却漏传新题库。 */
function manifestContentFiles() {
  const file = path.join(ROOT, 'content', 'manifest.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (data.decks || []).reduce(function (all, deck) {
      return all.concat((deck.shards || []).concat(deck.indexShards || []).map(function (shard) {
        return String(shard.url || '').replace(/^\//, '');
      }));
    }, []).filter(Boolean);
  } catch (e) {
    return [];
  }
}

const required = Array.from(new Set(
  feFiles.concat(beFiles)
    .concat(OUT_OF_GRAPH_REQUIRED)
    .concat(SERVICE_WORKER_REQUIRED)
    .concat(manifestContentFiles())
)).sort();

/* ---------- 比对 ---------- */
/* FILES 允许用目录（当前 content/ 分片会随扩容持续增加），目录覆盖其下所有运行时文件。 */
const deployedDirs = deployed.filter(function (d) {
  try { return fs.statSync(path.join(ROOT, d)).isDirectory(); } catch (e) { return false; }
});
function isCovered(requiredPath) {
  if (deployedSet.has(requiredPath)) return true;
  return deployedDirs.some(function (dir) {
    const prefix = dir.replace(/[\\/]$/, '').replace(/\\/g, '/') + '/';
    return requiredPath.replace(/\\/g, '/').indexOf(prefix) === 0;
  });
}
const missing = required.filter(function (r) { return !isCovered(r); });
const absent = deployed.filter(function (d) { return !existsAny(d); });

/* 「非必需项」必须把**目录项**排除在外：目录（assets / content）自身不会出现在 required 里，
   但它**覆盖**了下游的必需文件。2026-09-21 的事故正是 assets 未进 FILES ⇒ 65 张课节封面线上 404，
   外加 lesson-placeholder.svg 404 让 SW 的原子 addAll 永久失败、离线能力全废。
   若把 assets 误报成「确认是有意保留的非必需项」，下一个读日志的人就可能顺手删掉它、原样复现该事故。
   ⇒ 判据改成：**覆盖 ≥1 个必需路径的目录项 = 必需项**。 */
function coverageCount(dir) {
  const prefix = dir.replace(/[\\/]$/, '').replace(/\\/g, '/') + '/';
  return required.filter(function (r) { return r.replace(/\\/g, '/').indexOf(prefix) === 0; }).length;
}
const dirCoverage = deployedDirs.map(function (d) { return { dir: d, count: coverageCount(d) }; })
  .filter(function (x) { return x.count > 0; });
const extra = deployed.filter(function (d) { return required.indexOf(d) < 0 && coverageCount(d) === 0; });

console.log('[check-deploy] FILES ' + deployed.length + ' 项 / 运行时必需 ' + required.length +
            ' 项（前端 ' + feFiles.length + ' + 后端依赖图 ' + beFiles.length + ' + 图外 ' +
            OUT_OF_GRAPH_REQUIRED.length + ' + Service Worker ' + SERVICE_WORKER_REQUIRED.length + '）');

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

if (safetyProblems.length) {
  console.error('[check-deploy] ✗ 部署安全顺序不满足（迁移有损，必须能回滚）:');
  safetyProblems.forEach(function (p) { console.error('    · ' + p); });
  console.error('[check-deploy] 中止：deploy-prod.sh 不得在无快照的前提下执行有损迁移');
  process.exit(1);
}

if (dirCoverage.length) {
  console.log('[check-deploy] 目录项覆盖的必需文件数: ' +
    dirCoverage.map(function (x) { return x.dir + '=' + x.count; }).join('、') +
    '（目录项本身不计入「非必需」，删了它们 = 下游这批文件会漏发）');
}
if (extra.length) {
  console.log('[check-deploy] ⚠ FILES 中的非运行时依赖项（确认是有意保留）: ' + extra.join(', '));
}
console.log('[check-deploy] ✓ 部署清单已覆盖全部运行时依赖；快照 → 重启 顺序正确且失败即中止');
