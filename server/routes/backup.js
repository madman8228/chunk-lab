'use strict';

function registerBackupRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const readMemSnapshot = options.readMemSnapshot;
  const readLearningSnapshot = options.readLearningSnapshot;
  const learningDataFormat = options.learningDataFormat || { forUser: () => 'legacy-v1' };

  app.get('/api/export', auth.authenticate, function (req, res) {
    try {
      if (learningDataFormat.forUser(req.userId) === 'references-v1') {
        if (typeof readLearningSnapshot !== 'function') throw new Error('学习数据导出暂不可用');
        const data = readLearningSnapshot(req.userId);
        res.set('X-Learning-Data-Format', 'references-v1').json({
          __app: 'chunklab', __version: 3, format: 'references-v1', exportedAt: new Date().toISOString(),
          seq: data.seq, mem: data.mem, courseProgress: data.courseProgress,
          ...(options.personalWordbooks ? { personalWordbooks: options.personalWordbooks.archive(req.userId) } : {})
        });
        return;
      }
      const data = readMemSnapshot(req.userId);
      res.json({
        __app: 'chunklab', __version: 2, exportedAt: new Date().toISOString(),
        seq: data.seq, mem: data.mem, courses: data.courses, courseProgress: data.courseProgress,
        reinforceBook: data.mem.reinforceBook,
        ...(options.personalWordbooks?{personalWordbooks:options.personalWordbooks.archive(req.userId)}:{})
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerBackupRoutes };
