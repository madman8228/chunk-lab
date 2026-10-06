'use strict';
const { rejectLegacyWrite } = require('./protocol-guard');

/* Protocol 3 needs historical receipts, never the legacy replacement engine. */
function registerRetiredSyncRoutes({ app, auth, db }) {
  const receipt = db.prepare('SELECT backup_json, result_json FROM user_sync_resolutions WHERE user_id=? AND request_id=?');
  function readReceipt(req, res) {
    const row = receipt.get(req.userId, req.params.id);
    if (!row) return res.status(404).json({ error: '未找到这次处理记录' });
    try {
      res.json({ backup: JSON.parse(row.backup_json), result: JSON.parse(row.result_json) });
    } catch (error) {
      res.status(500).json({ error: '处理记录无法读取' });
    }
  }
  function retired(req, res) { rejectLegacyWrite(3, res, '旧版同步接口'); }
  app.get('/api/sync/batch/resolutions/:id', auth.authenticate, readReceipt);
  app.get('/api/sync/resolutions/:id', auth.authenticate, readReceipt);
  app.get('/api/sync/batch', auth.authenticate, retired);
  app.get('/api/sync/entity', auth.authenticate, retired);
  app.post('/api/sync/batch/resolve', auth.authenticate, retired);
  app.post('/api/sync/resolve', auth.authenticate, retired);
  app.put('/api/data', auth.authenticate, retired);
  app.post('/api/import', auth.authenticate, retired);
  app.post('/api/courses', auth.authenticate, retired);
  app.delete('/api/courses/:courseId', auth.authenticate, retired);
  app.post('/api/deck/publish', auth.authenticate, retired);
}

module.exports = { registerRetiredSyncRoutes };
