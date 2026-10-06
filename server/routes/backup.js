'use strict';

function registerBackupRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const readMemSnapshot = options.readMemSnapshot;

  app.get('/api/export', auth.authenticate, function (req, res) {
    try {
      const data = readMemSnapshot(req.userId);
      res.json({
        __app: 'chunklab', __version: 2, exportedAt: new Date().toISOString(),
        seq: data.seq, mem: data.mem, courses: data.courses, courseProgress: data.courseProgress,
        reinforceBook: data.mem.reinforceBook
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerBackupRoutes };
