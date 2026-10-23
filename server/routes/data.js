'use strict';

function registerDataRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const readMemSnapshot = options.readMemSnapshot;
  const readLearningSnapshot = options.readLearningSnapshot;
  const learningDataFormat = options.learningDataFormat || { forUser: () => 'legacy-v1' };

  app.get('/api/data', auth.authenticate, function (req, res) {
    try {
      if (learningDataFormat.forUser(req.userId) === 'references-v1') {
        return res.status(428).json({ error: '该账号已切换到独立学习数据格式，请更新客户端', code: 'LEARNING_DATA_FORMAT_UPGRADE_REQUIRED' });
      }
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
  if (Number(options.writeProtocol) === 3) {
    app.put('/api/data', auth.authenticate, function (req, res) {
      let code = 'CLIENT_UPDATE_REQUIRED';
      try { if (learningDataFormat.forUser(req.userId) === 'references-v1') code = 'LEARNING_DATA_FORMAT_UPGRADE_REQUIRED'; }
      catch (e) { return res.status(500).json({ error: e.message }); }
      res.status(428).json({ error: '整份学习数据写入已停用，请更新客户端；原记录未被覆盖', code: code });
    });
  }
  if (typeof readLearningSnapshot === 'function') {
    app.get('/api/learning-data/format', auth.authenticate, function (req, res) {
      try {
        const format = learningDataFormat.forUser(req.userId);
        res.set('X-Learning-Data-Format', format).json({ format: format });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.get('/api/learning-data', auth.authenticate, function (req, res) {
      try {
        const format = learningDataFormat.forUser(req.userId);
        if (format !== 'references-v1') {
          return res.status(409).json({ error: '该账号尚未完成学习数据格式迁移', code: 'LEARNING_DATA_FORMAT_NOT_ACTIVE' });
        }
        const raw = req.query.since;
        let since = null;
        if (raw !== undefined && raw !== '') {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'since 必须是 >=0 的数字' });
          since = Math.floor(n);
        }
        res.set('X-Learning-Data-Format', format).json(readLearningSnapshot(req.userId, since));
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
  }
}

module.exports = { registerDataRoutes };
