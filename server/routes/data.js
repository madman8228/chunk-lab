'use strict';

function registerDataRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const readMemSnapshot = options.readMemSnapshot;

  app.get('/api/data', auth.authenticate, function (req, res) {
    try {
      /* ?since=N → 只回该用户 seq>N 的变更；不传 = 全量。 */
      const raw = req.query.since;
      let since = null;
      if (raw !== undefined && raw !== '') {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'since 必须是 >=0 的数字' });
        since = Math.floor(n);
      }
      res.json(readMemSnapshot(req.userId, since));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerDataRoutes };
