/**
 * seo-pages.js · 内容页公开托管策略 + 启动新鲜度可见校验
 *
 * 背景：SEO 内容页（/s /c /g /about.html）由 `node scripts/build-seo-pages.mjs`
 * 预渲染为**纯静态文件**，落在仓库根，由 `express.static(仓库根)` 托管。
 * 因此「对未登录用户可达」是天然成立的（不经过任何鉴权路由）。
 *
 * 本中间件只做两件不改变访问语义的事：
 *   1. 命中内容页路径时补一个明确的公开缓存头（静态可再生，可缓存）；
 *   2. 提供 `freshnessCheck()`：启动时比对产出 `seo-version.json` 与
 *      `content/manifest.json` 的 contentVersion，不一致/缺失 → **可见 console.warn**（不静默）。
 *
 * ⚠️ 不做鉴权、不做重写、不做 404 兜底（T10 属 Y 类，本轮不做）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* 内容页路径前缀（均为 static-guard 非敏感前缀，见 server/middleware/static-guard.js）。 */
const PAGE_PREFIXES = ['/s/', '/c/', '/g/'];
const PAGE_EXACT = ['/about.html'];
/* 生成物版本戳（与 scripts/build-seo-pages.mjs 约定一致）。 */
const VERSION_FILE = 'seo-version.json';
const MANIFEST_REL = 'content/manifest.json';

function isSeoPagePath(pathname) {
  if (pathname === '/s' || pathname === '/c' || pathname === '/g') return true;
  for (let i = 0; i < PAGE_EXACT.length; i += 1) {
    if (pathname === PAGE_EXACT[i]) return true;
  }
  for (let i = 0; i < PAGE_PREFIXES.length; i += 1) {
    if (pathname.indexOf(PAGE_PREFIXES[i]) === 0) return true;
  }
  return false;
}

/**
 * Express 中间件：为内容页补公开缓存头后放行（不改变可达性）。
 * 必须挂在 express.static 之前；建议挂在 static-guard 之前（本文只管 /s /c /g /about.html）。
 * @param {{ rootDir?: string }} [options]
 */
function createSeoPagesMiddleware(options) {
  options = options || {};
  const rootDir = options.rootDir || path.join(__dirname, '..', '..');
  return function seoPages(req, res, next) {
    const method = req.method;
    if (method !== 'GET' && method !== 'HEAD') return next();
    if (!isSeoPagePath(req.path)) return next();
    /* 内容页是构建期再生的纯静态文件：公开可缓存（迁域/多实例均安全）。 */
    res.setHeader('Cache-Control', 'public, max-age=600');
    next();
  };
}

/**
 * 启动新鲜度校验：产出 contentVersion 与当前 manifest 是否一致。
 * 不一致或缺失 → 显式 console.warn（含两者版本号），不静默、不阻断启动。
 * @param {{ rootDir?: string, warn?: (msg:string)=>void }} [options]
 * @returns {{ ok: boolean, pagesVersion: string|null, manifestVersion: string|null, reason: string }}
 */
function freshnessCheck(options) {
  options = options || {};
  const rootDir = options.rootDir || path.join(__dirname, '..', '..');
  const warn = typeof options.warn === 'function' ? options.warn : console.warn;
  const versionPath = path.join(rootDir, VERSION_FILE);
  const manifestPath = path.join(rootDir, MANIFEST_REL);

  let pagesVersion = null;
  let manifestVersion = null;

  if (!fs.existsSync(versionPath)) {
    const reason = `SEO 内容页未生成（缺少 ${VERSION_FILE}）—— 请运行：node scripts/build-seo-pages.mjs`;
    warn('[seo] ' + reason);
    return { ok: false, pagesVersion: null, manifestVersion: null, reason };
  }
  try {
    pagesVersion = String(JSON.parse(fs.readFileSync(versionPath, 'utf8')).contentVersion || '') || null;
  } catch (err) {
    const reason = `SEO 版本戳无法解析（${VERSION_FILE}）：${err.message}`;
    warn('[seo] ' + reason);
    return { ok: false, pagesVersion: null, manifestVersion: null, reason };
  }

  if (!fs.existsSync(manifestPath)) {
    const reason = `内容 manifest 缺失：${MANIFEST_REL}`;
    warn('[seo] ' + reason);
    return { ok: false, pagesVersion, manifestVersion: null, reason };
  }
  try {
    manifestVersion = String(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).contentVersion || '') || null;
  } catch (err) {
    const reason = `内容 manifest 无法解析：${err.message}`;
    warn('[seo] ' + reason);
    return { ok: false, pagesVersion, manifestVersion: null, reason };
  }

  if (pagesVersion !== manifestVersion) {
    const reason = `SEO 内容页与当前内容不同步：pages=${pagesVersion} manifest=${manifestVersion}（请重跑：node scripts/build-seo-pages.mjs）`;
    warn('[seo] ' + reason);
    return { ok: false, pagesVersion, manifestVersion, reason };
  }
  return { ok: true, pagesVersion, manifestVersion, reason: '' };
}

module.exports = { createSeoPagesMiddleware, freshnessCheck, isSeoPagePath, VERSION_FILE };
