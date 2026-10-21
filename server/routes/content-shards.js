/**
 * content-shards.js · T5：GET /api/content/shards（鉴权）返回**完整分片路径表**
 *
 * 背景（架构 §6.2）：公开的 `content/manifest.json` 已收紧为「仅元数据」的精简版
 * （不含 shards / indexShards），以过 T5「匿名不再枚举 66 包分片内部路径」。
 * 分片路径改由本接口返回；源文件 `server/content/shards.json` 位于 server/ 下，
 * 被 static-guard 的 `/server/` 规则（static-guard.js:44）天然 403，匿名无法直取磁盘文件。
 *
 * 鉴权：
 *   - REQUIRE_AUTH=true  → 无/无效 token → 401（fail-closed）；
 *   - REQUIRE_AUTH=false → 落到默认用户，本地开发零回归。
 *
 * 失败语义：分片表缺失/损坏 → 500 + 明确原因（**不静默返回空表**）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SHARDS_REL = path.join('content', 'shards.json');

function registerContentShardsRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const rootDir = options.rootDir || path.join(__dirname, '..', '..');
  const shardsPath = path.join(rootDir, 'server', SHARDS_REL);

  app.get('/api/content/shards', auth.authenticate, function (req, res) {
    /* 鉴权分片表属用户态数据：禁止任何共享/中间缓存。 */
    res.setHeader('Cache-Control', 'no-store');
    if (!fs.existsSync(shardsPath)) {
      return res.status(500).json({
        error: '内容分片表未生成（server/content/shards.json 缺失）',
        hint: '请运行：node scripts/build-content.mjs',
      });
    }
    let map;
    try {
      map = JSON.parse(fs.readFileSync(shardsPath, 'utf8'));
    } catch (e) {
      return res.status(500).json({ error: '内容分片表无法解析：' + e.message });
    }
    if (!map || map.schemaVersion !== 1 || !Array.isArray(map.decks)) {
      return res.status(500).json({ error: '内容分片表格式不受支持' });
    }
    try {
      if (options.contentRegistry) map = { ...map, decks: map.decks.map(deck => ({
        ...deck,
        shards: (deck.shards || []).filter(shard => !options.contentRegistry.blockedPath('/' + shard.url.replace(/^\//, ''))),
        indexShards: (deck.indexShards || []).filter(shard => !options.contentRegistry.blockedPath('/' + shard.url.replace(/^\//, '')))
      })) };
      res.json(map);
    } catch (_) { res.status(503).json({ code: 'SERVICE_UNAVAILABLE', error: '课程内容入口暂时不可用' }); }
  });
}

module.exports = { registerContentShardsRoutes, SHARDS_REL };
