/**
 * api-compress.js · 动态 API 响应压缩（brotli / gzip 协商，异步）
 *
 * 为什么需要（根因，2026-09-10 实测 output/probe-downstream-8000.log）：
 *   上行拆表解决后，`GET /api/data` 仍是**全量**：8000 句时响应体 7191KB，
 *   且每次启动都要完整拉一遍（syncFromCloud）。Slow 4G 下这是唯一卡用户的一项。
 *   brotli q=5 实测 7191KB → 648KB（11.1×），q=11 是陷阱（18.5s，见 compress.js 注释）。
 *
 * ★ 与 compress.js（静态文件）的关键差别：**必须异步**
 *   静态文件有缓存（压一次复用），API 响应则每个用户的数据都不同、压完即弃。
 *   实测（output/probe-api-compress.log）用 zlib.brotliCompressSync 时，
 *   并发 5 个请求的事件循环停顿 = 717ms —— 即所有其他用户的请求一起卡死。
 *   换成异步 zlib.brotliCompress（走 libuv 线程池）后停顿降到 13ms（55×）。
 *   这是本项目**唯一**必须异步的压缩路径，不能照抄 compress.js 的同步 read + 异步 encode 组合。
 *
 * 不做的事（有意）：
 *   - 不加 ETag / 304：学习档案每答一题就变，条件请求命中率极低，
 *     却要为每个响应算一次内容哈希（7MB 约 20ms），得不偿失。
 *   - 不缓存压缩体：同用户数据每次都不同，缓存命中率同样低，白占内存。
 *     （真正该做的是「行级增量下行」，属协议级改动，单独一轮。）
 */
'use strict';
const zlib = require('zlib');
const compress = require('./compress');

const negotiate = compress._internal.negotiate;
const CONSTS = zlib.constants;

/* 与静态压缩保持同一档位（见 compress.js：q=5 是体积/耗时拐点） */
const BR_QUALITY = 5;
/* API 用 gzip-6：响应压完即弃，不做缓存，level 6 与 9 体积差 <2% 但快约 3 倍 */
const GZ_LEVEL = 6;
/* 小响应（如 {ok:true}）压了反而可能更大，且 HTTP 头开销占比高 */
const MIN_BYTES = 1024;

/** 异步压缩。**不要改成 Sync** —— 见文件头注释。 */
function encode(buf, enc) {
  return new Promise(function (resolve, reject) {
    const cb = function (err, out) { if (err) reject(err); else resolve(out); };
    if (enc === 'br') {
      zlib.brotliCompress(buf, {
        params: {
          [CONSTS.BROTLI_PARAM_QUALITY]: BR_QUALITY,
          [CONSTS.BROTLI_PARAM_SIZE_HINT]: buf.length
        }
      }, cb);
    } else {
      zlib.gzip(buf, { level: GZ_LEVEL }, cb);
    }
  });
}

/**
 * 中间件工厂。挂在 `/api` 路由之前：`app.use('/api', apiCompress())`。
 * 只接管 `res.json`（本项目所有 API 都用它）；`res.send` / `res.end` 不受影响。
 */
function apiCompress() {
  return function (req, res, next) {
    /* HEAD 必须放行：压缩分支会 res.end(压缩体)，HEAD 不该带 body（协议错误） */
    if (req.method === 'HEAD') return next();
    const enc = negotiate(req.headers['accept-encoding']);
    if (!enc) return next();          /* 客户端不接受压缩 → 保持原行为 */

    const origJson = res.json;
    res.json = function (body) {
      if (res.writableEnded) return res;

      let buf;
      try {
        buf = Buffer.from(JSON.stringify(body), 'utf8');
      } catch (e) {
        /* 循环引用等序列化失败：交回 Express（它内部同样会抛，错误处理链一致） */
        return origJson.call(res, body);
      }
      if (buf.length < MIN_BYTES) return origJson.call(res, body);

      encode(buf, enc).then(function (out) {
        /* 异步期间响应可能已被结束（客户端断开/超时中间件），此时不能再写 */
        if (res.writableEnded || res.headersSent) return;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', enc);
        /* 必须声明 Vary：同一 URL 在不同编码下是不同表示，中间层缓存要按此分桶 */
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', String(out.length));
        res.end(out);
      }).catch(function (e) {
        /* 协议级降级（HTTP 允许服务端自行决定不压缩），**不是静默兜底**：
           失败必须留痕，且降级结果对客户端仍是语义正确的完整响应。 */
        console.warn('[api-compress] ' + enc + ' 压缩失败，降级为未压缩响应：' + (e && e.message));
        if (!res.writableEnded && !res.headersSent) origJson.call(res, body);
      });

      return res;   /* 保持 Express 链式语义 */
    };

    next();
  };
}

apiCompress._internal = { encode: encode, MIN_BYTES: MIN_BYTES, BR_QUALITY: BR_QUALITY, GZ_LEVEL: GZ_LEVEL };

module.exports = apiCompress;
