'use strict';

function registerSystemRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const metrics = options.metrics;
  const aiEnabled = options.aiEnabled;
  const touchUserActivity = options.touchUserActivity;

  app.get('/api/stats', function (req, res) {
    const total = metrics.aiCacheHits + metrics.aiCacheMisses;
    res.json({
      ok: true,
      uptimeSec: Math.round((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
      aiCache: {
        hits: metrics.aiCacheHits,
        misses: metrics.aiCacheMisses,
        hitRate: total > 0 ? Math.round(metrics.aiCacheHits / total * 1000) / 1000 : null
      }
    });
  });

  app.get('/api/health', function (req, res) { res.json({ ok: true, ts: Date.now() }); });

  app.get('/api/config', function (req, res) {
    res.json({ requireAuth: auth.REQUIRE_AUTH, serverVersion: 1, authAvailable: true, aiEnabled: aiEnabled });
  });

  app.post('/api/usage/heartbeat', auth.authenticate, function (req, res) {
    try { touchUserActivity(req.userId); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: '活跃记录失败' }); }
  });
}

module.exports = { registerSystemRoutes };
