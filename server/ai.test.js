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

/* ===== trimAiCache：LRU 裁剪 + TTL 清理（2026-09-11 从 index.js 迁入，独立覆盖 P0-1 迁移） ===== */
const Database = require('better-sqlite3');
const tdb = new Database(':memory:');
tdb.exec("CREATE TABLE ai_cache (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
const tins = tdb.prepare("INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES (?,?,datetime('now', ?))");
for (let i = 1; i <= 8; i++) tins.run('k' + i, '{}', '+' + i + ' seconds');

check('trim: 未超限不裁剪（8 条 <= max 20 原样保留）',
  (function () { ai.trimAiCache(tdb, 20, 0); return tdb.prepare('SELECT COUNT(*) AS n FROM ai_cache').get().n; })() === 8);
check('trim: 超限 LRU 裁剪（8 → 5，淘汰 updated_at 最旧 3 条）',
  (function () { ai.trimAiCache(tdb, 5, 0); return tdb.prepare('SELECT COUNT(*) AS n FROM ai_cache').get().n; })() === 5);
const kept = tdb.prepare('SELECT key FROM ai_cache ORDER BY updated_at ASC').all().map(function (r) { return r.key; });
check('trim: 保留最新 5 条（k4..k8）', kept.join(',') === 'k4,k5,k6,k7,k8', kept.join(','));

tdb.prepare("INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES ('old','{}',datetime('now','-3 days'))").run();
check('trim: TTL=1 清理 3 天前过期条目',
  (function () { ai.trimAiCache(tdb, 100, 1); return tdb.prepare("SELECT COUNT(*) AS n FROM ai_cache WHERE key='old'").get().n; })() === 0);
tdb.close();

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
