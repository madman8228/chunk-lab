'use strict';

function registerBackupRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const readMemSnapshot = options.readMemSnapshot;
  const rejectUnconditional = options.rejectUnconditional;
  const validate = options.validate;
  const saveData = options.saveData;

  app.get('/api/export', auth.authenticate, function (req, res) {
    try {
      const data = readMemSnapshot(req.userId);
      res.json({
        __app: 'chunklab', __version: 2, exportedAt: new Date().toISOString(),
        mem: data.mem, courses: data.courses, courseProgress: data.courseProgress,
        reinforceBook: data.mem.reinforceBook
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/import', auth.authenticate, function (req, res) {
    try {
      const body = req.body || {};
      if (rejectUnconditional(body, res, '备份导入')) return;
      const verr = validate.validatePutPayload(body);
      if (verr) return res.status(400).json({ error: '备份数据校验失败：' + verr });
      saveData(req.userId, body);
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'SYNC_CONFLICT') return res.status(409).json({ error: e.message, code: e.code, conflicts: e.conflicts });
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerBackupRoutes };
