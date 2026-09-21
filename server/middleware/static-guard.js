/**
 * static-guard.js · 静态托管的敏感路径守卫（唯一实现）
 *
 * ── 为什么必须存在 ────────────────────────────────────────────────
 * 静态根是**项目根**（见 index.js 的 express.static(path.join(__dirname, '..'))），
 * 所以后端源码、SQLite 数据库、备份、运维脚本、架构文档全都落在
 * 「可被静态服务命中」的目录里 —— 本守卫是唯一防线。
 *
 * ── 2026-09-21 的 P0（线上实测确认，不是推测）────────────────────
 * 旧实现把正则直接打在 req.path 上，而 **req.path 是未解码的**
 * （express 经 parseurl 取 pathname，不做百分号解码），express.static 却会解码。
 * 于是黑名单全被绕过，且**朴素路径全部返回 403**，所以历次自检都是绿的：
 *
 *   GET /server/index.js              → 403（拦住了，自检只看这个）
 *   GET //server/index.js             → 200（双斜杠）   ← 真源码 57,156B
 *   GET /%73erver/index.js            → 200（编码 s）
 *   GET /%2Fserver/index.js           → 200（编码前导斜杠）
 *   GET /%73erver/data/chunklab%2Edb  → 200（SQLite 整库，魔数已核实）
 *   GET /%73erver/data/chunklab%2Edb-wal → 200（WAL，未 checkpoint 的最新提交）
 *
 * ⚠️ 教训不是「黑名单漏了几条」，而是**判定对象没有规范化** ——
 *    补条目永远只能证明「我列的那些没漏」。所以修法是：先规范化到唯一形态，再判定。
 *
 * ── 规范化做什么 ─────────────────────────────────────────────────
 *   1. 反复解码到不动点 —— 单次解码挡不住 `%252F` 这类二次编码；超过上限即判不可信
 *   2. 反斜杠按 `/` 处理（Windows 风格分隔符）
 *   3. 折叠空段（等价于合并重复斜杠）
 *   4. 解析 `.` / `..` —— 挡住 `/..%2Fserver/index.js` 这种穿越写法
 *   5. 解码失败或含 NUL → 返回 null，调用方**直接拒绝**（fail-closed，不猜、不降级）
 *
 * ── 维护须知 ─────────────────────────────────────────────────────
 *   ⚠️ 改本文件必须同步看 scripts/deploy-security-smoke.sh：
 *      它以「敏感路径的**变体族**必须被拒」自证，改完要能重新自证。
 *   ⚠️ 本文件在部署清单 scripts/deploy-prod.sh 的 FILES 里；
 *      scripts/check-deploy-files.js 按 require 闭包强制校验，漏了会中止部署。
 *   ⚠️ 回归测试：server/static-guard.test.js（含变体族与负向自证）。
 */
'use strict';

/* 解码轮数上限。正常请求 1 次就稳定；多层编码会在第 2 次之后暴露。 */
const MAX_DECODE_PASSES = 4;

/* 以下规则与 2026-09-09/09-10 的既有规则**语义等价**，只是改为作用于规范化后的路径。 */
const SENSITIVE_PREFIX = /^\/(server|node_modules|output|scripts|extra|e2e|deliverables|deploy|ref)\b/i;
const DOTFILE = /\/\./; /* 任意层级 dotfile/dotdir：/.git、/.env、/.workbuddy、/server/.env… */
const SENSITIVE_EXT = /\.(md|markdown|bak|tmp|log|db|sqlite|sqlite3|py|conf|ini|yml|yaml|sh|service)$/i;
const TEST_FILE = /\.test\.js$/i;
const DEP_MANIFEST = /^\/(package|package-lock)\.json$/i; /* 依赖清单：泄露版本→可直接查已知 CVE */
const ROOT_VALIDATOR = /^\/validate_[a-z0-9_]+\.js$/i;    /* 根目录数据校验脚本（构建期工具） */
const DEBUG_PAGE = /^\/diagnose\.html$/i;                 /* 调试页，不对公网开放 */

/**
 * 把请求路径规范化到唯一形态。
 * @param {string} raw 原始请求路径（通常是 req.path，未解码）
 * @returns {string|null} 规范化后的绝对路径；null = 输入不可信，调用方必须拒绝
 */
function normalizeRequestPath(raw) {
  let p = String(raw === undefined || raw === null ? '' : raw);
  if (p.indexOf('\0') !== -1) return null;

  for (let i = 0; i < MAX_DECODE_PASSES; i++) {
    let decoded;
    try {
      decoded = decodeURIComponent(p);
    } catch (e) {
      return null; /* 非法百分号编码：不猜它想表达什么，直接拒 */
    }
    if (decoded === p) break;
    if (decoded.indexOf('\0') !== -1) return null;
    p = decoded;
  }

  p = p.replace(/\\/g, '/');

  const segments = [];
  const parts = p.split('/');
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (seg === '' || seg === '.') continue; /* 折叠重复斜杠与当前目录 */
    if (seg === '..') { segments.pop(); continue; } /* 解析父目录，不逃出根 */
    segments.push(seg);
  }
  return '/' + segments.join('/');
}

/**
 * 判定「已规范化」的路径是否命中敏感规则。
 * @param {string} normalized normalizeRequestPath 的返回值
 * @returns {boolean} true = 必须拒绝
 */
function isSensitivePath(normalized) {
  if (SENSITIVE_PREFIX.test(normalized)) return true;
  if (DOTFILE.test(normalized)) return true;
  if (SENSITIVE_EXT.test(normalized) || TEST_FILE.test(normalized)) return true;
  if (DEP_MANIFEST.test(normalized)) return true;
  if (ROOT_VALIDATOR.test(normalized)) return true;
  if (DEBUG_PAGE.test(normalized)) return true;
  return false;
}

/**
 * Express 中间件。必须挂在 express.static 之前（压缩中间件之后）。
 * 命中即 403 并结束响应；不可信输入同样 403（fail-closed）。
 */
function createStaticGuard() {
  return function staticGuard(req, res, next) {
    const normalized = normalizeRequestPath(req.path);
    if (normalized === null || isSensitivePath(normalized)) {
      return res.status(403).end('Forbidden');
    }
    next();
  };
}

module.exports = { createStaticGuard, normalizeRequestPath, isSensitivePath };
