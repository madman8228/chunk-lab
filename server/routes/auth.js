'use strict';

function registerAuthRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const rateBlocked = options.rateBlocked;
  const rateHit = options.rateHit;
  const rateClear = options.rateClear;
  const send429 = options.send429;
  const limits = options.limits;
  const phoneEnabled = process.env.PHONE_AUTH_ENABLED === 'true';
  const phoneAuth = phoneEnabled ? (options.phoneAuth || require('../services/phone-auth').createPhoneAuth({ db: options.db })) : null;

  if (phoneAuth) {
    function owner(req, purpose) {
      if (purpose !== 'bind') return null;
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const identity = auth.verifyToken(token);
      if (!identity || !auth.readUser(identity.userId)) {
        throw Object.assign(new Error('请重新登录后绑定手机号'), { status: 401, code: 'NOT_AUTH' });
      }
      return identity.userId;
    }
    function failure(res, e) {
      if (e.status === 429) res.set('Retry-After', '60');
      res.status(e.status || 503).json({ code: e.code || 'SMS_UNAVAILABLE', error: e.status ? e.message : '登录服务暂时不可用，请稍后再试' });
    }
    app.post('/api/auth/phone/code', async function (req, res) {
      try {
        if (!auth.REQUIRE_AUTH) return res.status(503).json({ error: '登录服务尚未启用' });
        if (!rateHit(req.ip, 'phoneSend', 20)) return send429(res);
        const body = req.body || {};
        const purpose = body.purpose || 'login';
        res.json(await phoneAuth.send({ phone: body.phone, ip: req.ip, purpose, ownerId: owner(req, purpose) }));
      } catch (e) { failure(res, e); }
    });
    app.post('/api/auth/phone/login', async function (req, res) {
      try {
        if (!auth.REQUIRE_AUTH) return res.status(503).json({ error: '登录服务尚未启用' });
        if (!rateHit(req.ip, 'phoneVerify', 30)) return send429(res);
        auth.assertSecure();
        const body = req.body || {};
        const purpose = body.purpose || 'login';
        const result = await phoneAuth.verify({ phone: body.phone, code: body.code,
          challengeId: body.challengeId, purpose, ownerId: owner(req, purpose), password: body.password });
        if (result.error) throw result.error;
        const user = auth.readUser(result.id);
        user.phone = phoneAuth.ownerPhone(result.id);
        res.json({ token: auth.signToken(user.id, user.username), user });
      } catch (e) { failure(res, e); }
    });
    app.post('/api/auth/phone/password', async function(req, res) {
      try {
        if (!auth.REQUIRE_AUTH) return res.status(503).json({error:'登录服务尚未启用'});
        if (rateBlocked(req.ip, 'loginFail', limits.loginFail)) return send429(res);
        if (!rateHit(req.ip, 'phonePassword', 30)) return send429(res);
        auth.assertSecure();
        const body = req.body || {};
        const result = await phoneAuth.passwordLogin(body.phone, body.password);
        rateClear(req.ip, 'loginFail');
        const user = auth.readUser(result.id); user.phone = phoneAuth.ownerPhone(result.id);
        res.json({token:auth.signToken(user.id,user.username),user});
      } catch(e) { rateHit(req.ip, 'loginFail', limits.loginFail); failure(res,e); }
    });
  }

  app.post('/api/auth/register', function (req, res) {
    if (phoneEnabled) return res.status(403).json({ error: '请使用手机号验证码登录，首次登录会自动注册' });
    if (!auth.REQUIRE_AUTH) return res.status(403).json({ error: '开放模式无需注册' });
    if (!rateHit(req.ip, 'register', limits.register)) return send429(res);
    try {
      const u = auth.register(req.body.username, req.body.password);
      const token = auth.signToken(u.id, u.username);
      res.json({ token: token, user: { id: u.id, username: u.username } });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/auth/login', function (req, res) {
    if (phoneEnabled && process.env.ALLOW_LEGACY_PASSWORD_LOGIN !== 'true') {
      return res.status(403).json({ error: '请使用手机号验证码登录' });
    }
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
    if (phoneAuth) user.phone = phoneAuth.ownerPhone(req.userId);
    res.json({ user: user });
  });

  app.post('/api/auth/credentials', auth.authenticate, function (req, res) {
    if (phoneEnabled) return res.status(403).json({ error: '请在账号设置中绑定手机号' });
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
