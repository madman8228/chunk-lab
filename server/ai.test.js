/**
 * ai.test.js · AI 代理单测（缓存版本无关的决策函数 + 重试路径）
 * 覆盖：shouldRetry 判定 / callDeepSeekRetry 正常路径（MOCK 恒 200 不重试）
 * Node 直跑：node server/ai.test.js
 */
'use strict';
const ai = require('./ai');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ===== shouldRetry 决策 ===== */
check('retry: 5xx 上游错误 → 重试', ai.shouldRetry(500, null) === true);
check('retry: 502 → 重试', ai.shouldRetry(502, null) === true);
check('retry: 503 → 重试', ai.shouldRetry(503, null) === true);
check('retry: 429 限流 → 不重试（防放大雪崩）', ai.shouldRetry(429, null) === false);
check('retry: 400 → 不重试', ai.shouldRetry(400, null) === false);
check('retry: 200 → 不重试', ai.shouldRetry(200, null) === false);
check('retry: 网络错误（ECONNRESET）→ 重试', ai.shouldRetry(null, new Error('ECONNRESET')) === true);
check('retry: 超时错误 → 重试', ai.shouldRetry(null, new Error('AI 请求超时')) === true);

/* ===== callDeepSeekRetry 正常路径（AI_MOCK_RESPONSE 恒 200，不触发重试） ===== */
process.env.AI_MOCK_RESPONSE = '{"choices":[{"message":{"content":"{\\"ok\\":true}"}}]}';
ai.callDeepSeekRetry({ model: 'm', messages: [] }, 'sk-test').then(function (r) {
  check('retry: MOCK 200 直接返回（retried 未标记）', r.status === 200 && r.retried === undefined, JSON.stringify(r));
  check('retry: MOCK raw 可解析', typeof r.raw === 'string' && r.raw.indexOf('choices') >= 0);

  delete process.env.AI_MOCK_RESPONSE;
  console.log('\n[ai.test] passed=' + passed + ' failed=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}).catch(function (e) {
  console.error('FAIL: ' + e.message);
  process.exit(1);
});
