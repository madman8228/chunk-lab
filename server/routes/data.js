'use strict';

function registerDataRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const rejectUnconditional = options.rejectUnconditional;
  const validate = options.validate;
  const readMemSnapshot = options.readMemSnapshot;
  const saveData = options.saveData;

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

  app.put('/api/data', auth.authenticate, function (req, res) {
    try {
      if (rejectUnconditional(req.body, res, '数据写入')) return;
      const verr = validate.validatePutPayload(req.body);
      if (verr) return res.status(400).json({ error: '数据校验失败：' + verr });
      const seq = saveData(req.userId, req.body || {});
      res.json(req.body.baseSeq === undefined ? { ok: true } : { ok: true, seq });
    } catch (e) {
      if (e.code === 'SYNC_CONFLICT') return res.status(409).json({ error: e.message, code: e.code, conflicts: e.conflicts });
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerDataRoutes };
