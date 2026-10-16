'use strict';

function registerSystemRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const metrics = options.metrics;
  const aiEnabled = options.aiEnabled;
  const touchUserActivity = options.touchUserActivity;
  const writeProtocol = options.writeProtocol || 2;

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
    res.json({ requireAuth: auth.REQUIRE_AUTH, serverVersion: 1, authAvailable: true,
      authMode: process.env.PHONE_AUTH_ENABLED === 'true' ? 'phone' : 'password',
      legacyPasswordLoginAllowed: process.env.PHONE_AUTH_ENABLED === 'true' && process.env.ALLOW_LEGACY_PASSWORD_LOGIN === 'true',
      aiEnabled: aiEnabled, writeProtocol: writeProtocol,
      persistenceMode: writeProtocol === 3 ? 'server-authoritative' : 'legacy' });
  });

  app.post('/api/usage/heartbeat', auth.authenticate, function (req, res) {
    try { touchUserActivity(req.userId); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: '活跃记录失败' }); }
  });

  app.post('/api/usage/study', auth.authenticate, function (req, res) {
    try { res.json(options.usageAnalytics.pulse(req.userId, req.body)); }
    catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : '学习计时暂不可用' }); }
  });
}

module.exports = { registerSystemRoutes };
