/**
 * ai.js · AI 后端代理（ADR-004）
 *
 * 目标：API Key 不再进前端（服务端 DEEPSEEK_API_KEY），并叠加服务端缓存 + 限流。
 *   - 每用户滑动窗口限流（AI_RATE_LIMIT 次/分钟，默认 10）
 *   - 服务端归一化 norm（与前端 core/main 的 norm 规则一致，用于缓存 key）
 *   - DeepSeek 调用（https，超时兜底；AI_MOCK_RESPONSE 仅为测试钩子，不用于生产）
 * 无状态（限流 Map 在内存），多实例部署需外置（Phase D 换 Redis）。
 */
'use strict';

const https = require('https');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const AI_RATE_LIMIT = parseInt(process.env.AI_RATE_LIMIT || '10', 10);
const AI_RATE_WINDOW = 60 * 1000;
const AI_TIMEOUT = 25000;
const _rateMap = new Map(); /* userId -> { count, windowStart } */

/* 服务端归一化：与前端 norm 对齐（小写 / 统一撇号 / 去标点 / 压缩空白） */
function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 滑动窗口限流：返回 true = 放行，false = 超限 */
function rateLimit(userId) {
  const now = Date.now();
  const entry = _rateMap.get(userId);
  if (!entry || now - entry.windowStart > AI_RATE_WINDOW) {
    _rateMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= AI_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/* 调用 DeepSeek Chat Completions。apiKey 由调用方解析后传入（服务端 env 优先）。
   AI_MOCK_RESPONSE 存在时短路返回（仅测试用，避免冒烟测试打真实 API）。 */
function callDeepSeek(payload, apiKey, timeoutMs) {
  return new Promise(function (resolve, reject) {
    if (process.env.AI_MOCK_RESPONSE) {
      resolve({ status: 200, raw: process.env.AI_MOCK_RESPONSE });
      return;
    }
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs || AI_TIMEOUT
    }, function (res) {
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () { resolve({ status: res.statusCode, raw: raw }); });
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(new Error('AI 请求超时')); });
    req.write(body);
    req.end();
  });
}

/* 是否值得重试：仅 5xx 上游错误或网络错误（ECONNRESET/超时等）。
   4xx（含 429 限流）与 3xx 不重试——避免放大雪崩与计费噪音。 */
function shouldRetry(status, err) {
  if (err) return true;                       /* 网络层错误（ECONNRESET / 超时 / DNS 等） */
  return status >= 500 && status <= 599;      /* 上游 5xx */
}

/* 带一次重试的调用（指数退避 500ms）。AI_MOCK_RESPONSE 模式恒 200 → 不触发重试。
   重试在调用方看来仍是单次 Promise；结果含 retried 标记便于观测。 */
function callDeepSeekRetry(payload, apiKey, timeoutMs) {
  return callDeepSeek(payload, apiKey, timeoutMs).then(function (r) {
    if (!shouldRetry(r.status, null)) return r;
    return new Promise(function (resolve) {
      setTimeout(function () {
        callDeepSeek(payload, apiKey, timeoutMs).then(function (r2) {
          r2.retried = true;
          resolve(r2);
        }, resolve);
      }, 500);
    });
  }, function (err) {
    if (!shouldRetry(null, err)) throw err;
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        callDeepSeek(payload, apiKey, timeoutMs).then(function (r2) { r2.retried = true; resolve(r2); }, reject);
      }, 500);
    });
  });
}

module.exports = { norm, rateLimit, callDeepSeek, callDeepSeekRetry, shouldRetry, DEEPSEEK_API_KEY };
