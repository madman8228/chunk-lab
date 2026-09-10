/**
 * compress.js · 零依赖静态响应压缩（brotli / gzip 协商）
 *
 * 为什么需要（根因，2026-09-10 真浏览器实测）：
 *   8000 句题库 = 7.80 MB JS，且是渲染阻塞脚本 → 4G 下白屏数秒。
 *   线上 nginx 只做 proxy_pass、本地 express.static 均未开压缩，
 *   实测同一批资源压缩率 3.5~4.4×（brotli），即 7.80MB → ~1.8MB。
 *   这是「扩容到 8000 句」唯一真正卡用户的一项（内存 17.8MB / 解析 +228ms 都不是问题）。
 *
 * 为什么不用 `compression` 包：项目前端零构建、后端依赖也刻意保持最小；
 *   本需求只覆盖「静态文件」这一条路径，用 zlib 内置模块 30 行可覆盖，
 *   且原生支持 brotli（compression@1.7 只有 gzip/deflate）。
 *
 * 关键正确性决策：
 *   1. ETag 必须把编码写进去。响应带 `Vary: Accept-Encoding`，
 *      同一 URL 在 HTTP 缓存里按编码分桶；若两种编码共用同一 ETag，
 *      浏览器换编码协商时会因为 304 命中而拿到「另一个编码的已存 body」。
 *   2. 压缩结果按 (路径, mtime, 编码) 缓存并做字节预算 LRU ——
 *      否则每次请求都重压 7.8MB（brotli 单次数百毫秒，纯属浪费）。
 *   3. 并发去重：同一文件同时被多端请求时只压一次。
 *   4. 未命中编码协商、或请求带 Range → 直接放行给 express.static（不改变原行为）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* 只压文本类；png/ico/woff 已自带压缩，再压是纯浪费 CPU */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const MIN_BYTES = 1024;          /* 小文件压了没意义（HTTP 头开销可能更大） */
const BR_QUALITY = 5;            /* 5 已接近 gzip-9 体积，但快一个数量级；11 会把首请求拖到秒级 */
const GZ_LEVEL = 9;
const CACHE_BUDGET = 24 * 1024 * 1024;  /* 压缩体缓存上限（字节），LRU 淘汰 */

/** key → { etag, size, br, gzip, bytes } */
const cache = new Map();
let cacheBytes = 0;
/** key → Promise（并发去重） */
const inflight = new Map();

function extOf(p) { return path.extname(p).toLowerCase(); }
function compressible(p) { return Object.prototype.hasOwnProperty.call(TYPES, extOf(p)); }

/** 解析 Accept-Encoding，返回 'br' | 'gzip' | null（null = 客户端不接受压缩） */
function negotiate(header) {
  const raw = String(header || '');
  if (!raw) return null;
  let br = -1, gzip = -1, star = -1;
  raw.split(',').forEach(function (part) {
    const seg = part.trim().split(';');
    const token = seg[0].trim().toLowerCase();
    let q = 1;
    for (let i = 1; i < seg.length; i++) {
      const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(seg[i]);
      if (m) q = parseFloat(m[1]);
    }
    if (token === 'br') br = q;
    else if (token === 'gzip' || token === 'x-gzip') gzip = q;
    else if (token === '*') star = q;
  });
  if (br < 0 && star >= 0) br = star;
  if (gzip < 0 && star >= 0) gzip = star;
  /* 优先级：br 更小 → 但 q 值必须为正（q=0 是显式拒绝） */
  if (br > 0) return 'br';
  if (gzip > 0) return 'gzip';
  return null;
}

function etagFor(stat, enc) {
  return 'W/"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '-' + enc + '"';
}

function touch(key, entry) {
  /* LRU：删了再塞 = 移到队尾 */
  if (cache.has(key)) cache.delete(key);
  cache.set(key, entry);
  cacheBytes += entry.bytes;
  while (cacheBytes > CACHE_BUDGET && cache.size > 1) {
    const oldest = cache.keys().next().value;
    const e = cache.get(oldest);
    cache.delete(oldest);
    cacheBytes -= e.bytes;
  }
}

/** 生成（或复用）某文件某编码的压缩体 */
function encode(file, stat, enc) {
  const key = file + '|' + stat.mtimeMs + '|' + stat.size;
  let entry = cache.get(key);
  if (entry && entry[enc]) return Promise.resolve(entry);
  const jobKey = key + '|' + enc;
  if (inflight.has(jobKey)) {
    return inflight.get(jobKey).then(function (buf) {
      const e = cache.get(key) || { size: stat.size, bytes: 0, etag: {} };
      if (!e[enc]) { e[enc] = buf; e.bytes += buf.length; touch(key, e); }
      return e;
    });
  }

  const body = fs.readFileSync(file);
  const job = new Promise(function (resolve, reject) {
    const cb = function (err, buf) {
      if (err) return reject(err);
      resolve(buf);
    };
    if (enc === 'br') zlib.brotliCompress(body, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: BR_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length
      }
    }, cb);
    else zlib.gzip(body, { level: GZ_LEVEL }, cb);
  });

  inflight.set(jobKey, job);
  return job.then(function (buf) {
    const e = cache.get(key) || { size: stat.size, bytes: 0, etag: {} };
    if (!e[enc]) { e[enc] = buf; e.bytes += buf.length; }
    touch(key, e);
    return e;
  }).finally(function () { inflight.delete(jobKey); });
}

/* 预热阈值：小于此值现场压也很快，不值得常驻内存 */
const WARM_MIN_BYTES = 200 * 1024;

/**
 * 中间件工厂。root = 静态根目录（与 express.static 一致）。
 * 放在 security 过滤之后、express.static 之前。
 * 返回的函数额外带 warm()：启动后后台预热大文件，消除「第一个访客等压缩」的毛刺。
 */
function compression(root) {
  const ROOT = path.resolve(root);

  const mw = function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.headers.range) return next();             /* Range 请求交给 static 处理 */
    if (!compressible(req.path)) return next();

    let rel;
    try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
    const file = path.resolve(ROOT, '.' + rel);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return next();  /* 防目录穿越 */

    const enc = negotiate(req.headers['accept-encoding']);
    if (!enc) return next();                          /* 客户端不要压缩 → 原样返回 */

    let stat;
    try {
      stat = fs.statSync(file);
      if (!stat.isFile()) return next();
    } catch (e) { return next(); }
    if (stat.size < MIN_BYTES) return next();

    encode(file, stat, enc).then(function (entry) {
      const etag = etagFor(stat, enc);
      res.setHeader('Content-Type', TYPES[extOf(file)] || 'application/octet-stream');
      res.setHeader('Content-Encoding', enc);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', new Date(stat.mtimeMs).toUTCString());
      res.setHeader('Cache-Control', 'public, max-age=0');
      res.setHeader('Content-Length', String(entry[enc].length));

      /* 304 必须带同一套 Vary/ETag/Cache-Control，否则缓存语义会错乱 */
      if (String(req.headers['if-none-match'] || '').split(',').map(function (s) { return s.trim(); }).indexOf(etag) >= 0) {
        res.removeHeader('Content-Length');
        return res.status(304).end();
      }
      if (req.method === 'HEAD') return res.status(200).end();
      res.status(200).end(entry[enc]);
    }).catch(function () {
      next();  /* 压缩失败绝不能变成错误页：放行给 static 原样返回 */
    });
  };

  /**
   * 后台预热：把根的下一层大文本文件预先压好。
   * 不预热的话，第一个访客要等现场压缩（实测 8000 句 gzip-9 约 250ms、brotli 约 100ms 起，
   * 真实内容更久），属于「冷启动毛刺」。异步串行执行，不阻塞 listen。
   * 只扫根目录一层（题库/HTML/core.js 都在这一层；深层 js/ 都是小文件）。
   */
  mw.warm = function () {
    let names;
    try { names = fs.readdirSync(ROOT); } catch (e) { return Promise.resolve([]); }
    const todo = [];
    names.forEach(function (name) {
      const file = path.join(ROOT, name);
      if (!compressible(name)) return;
      let stat;
      try { stat = fs.statSync(file); } catch (e) { return; }
      if (!stat.isFile() || stat.size < WARM_MIN_BYTES) return;
      todo.push({ file: file, stat: stat });
    });
    /* 串行：避免并发压缩同时占满 CPU（预热是后台任务，慢一点没关系） */
    return todo.reduce(function (chain, t) {
      return chain.then(function () {
        return encode(t.file, t.stat, 'br').then(function () { return encode(t.file, t.stat, 'gzip'); });
      }).then(function () {
        const e = cache.get(t.file + '|' + t.stat.mtimeMs + '|' + t.stat.size);
        const br = e && e.br ? e.br.length : 0, gz = e && e.gzip ? e.gzip.length : 0;
        console.log('[compress] 预热 ' + path.basename(t.file) + ' ' + Math.round(t.stat.size / 1024) + 'KB → br '
          + Math.round(br / 1024) + 'KB / gzip ' + Math.round(gz / 1024) + 'KB');
      }).catch(function (e) { console.warn('[compress] 预热失败 ' + path.basename(t.file) + '：' + (e && e.message)); });
    }, Promise.resolve());
  };

  return mw;
}

/* 供测试/诊断使用 */
compression._internal = { negotiate: negotiate, etagFor: etagFor, TYPES: TYPES, MIN_BYTES: MIN_BYTES, WARM_MIN_BYTES: WARM_MIN_BYTES };

module.exports = compression;
