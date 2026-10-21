'use strict';

function registerMembershipRoutes(options) {
  const { app, auth, membership, redemption } = options;
  app.get('/api/membership', auth.authenticate, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(membership.getStatus(req.userId)); }
    catch (_) { res.status(503).json({ code: 'SERVICE_UNAVAILABLE', error: '会员状态暂时不可用' }); }
  });
  app.post('/api/membership/redeem', auth.authenticate, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const user = auth.readUser(req.userId);
    if (!user || user.username === '__default__' || /^guest_/.test(user.username)) return res.status(403).json({ code: 'ACCOUNT_BINDING_REQUIRED', error: '请先设置可重新登录的账号，再兑换会员码' });
    try {
      const result = redemption.redeem(req.userId, req.body && req.body.code, req.body && req.body.requestId, req.ip);
      if (result.status !== 200) {
        if (result.retryAfter) res.set('Retry-After', String(result.retryAfter));
        const messages = { CODE_UNAVAILABLE: '兑换码不可用，请检查兑换码或联系客服',
          RATE_LIMITED: '尝试次数较多，请稍后再试', CODE_KEYS_UNAVAILABLE: '兑换服务暂时不可用，请联系网站管理员' };
        return res.status(result.status).json({ code: result.code, error: messages[result.code] || result.code });
      }
      res.json({ ok: true, replay: !!result.replay, grantId: result.grantId, membership: membership.getStatus(req.userId) });
    } catch (_) { res.status(503).json({ code: 'SERVICE_UNAVAILABLE', error: '兑换暂时失败，请稍后重试相同请求' }); }
  });
}

module.exports = { registerMembershipRoutes };
