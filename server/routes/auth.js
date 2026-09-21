'use strict';

function registerAuthRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const rateBlocked = options.rateBlocked;
  const rateHit = options.rateHit;
  const rateClear = options.rateClear;
  const send429 = options.send429;
  const limits = options.limits;

  app.post('/api/auth/register', function (req, res) {
    if (!auth.REQUIRE_AUTH) return res.status(403).json({ error: '开放模式无需注册' });
    if (!rateHit(req.ip, 'register', limits.register)) return send429(res);
    try {
      const u = auth.register(req.body.username, req.body.password);
      const token = auth.signToken(u.id, u.username);
      res.json({ token: token, user: { id: u.id, username: u.username } });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/auth/login', function (req, res) {
    if (!auth.REQUIRE_AUTH) return res.status(403).json({ error: '开放模式无需登录' });
    const ip = req.ip;
    if (rateBlocked(ip, 'loginFail', limits.loginFail)) return send429(res);
    try {
      const u = auth.login(req.body.username, req.body.password);
      rateClear(ip, 'loginFail');
      const token = auth.signToken(u.id, u.username);
      res.json({ token: token, user: { id: u.id, username: u.username } });
    } catch (e) {
      rateHit(ip, 'loginFail', limits.loginFail);
      res.status(401).json({ error: e.message });
    }
  });

  app.get('/api/auth/me', auth.authenticate, function (req, res) {
    const user = auth.readUser(req.userId);
    if (!user) return res.status(401).json({ error: '账号不存在或已注销' });
    res.json({ user: user });
  });

  app.post('/api/auth/credentials', auth.authenticate, function (req, res) {
    if (!auth.REQUIRE_AUTH) return res.status(403).json({ error: '开放模式无账号概念' });
    if (!rateHit(req.ip, 'credChange', limits.credChange)) return send429(res);
    try {
      const body = req.body || {};
      const user = auth.setCredentials(req.userId, { username: body.username, password: body.password });
      res.json({ ok: true, user: user });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
}

module.exports = { registerAuthRoutes };
