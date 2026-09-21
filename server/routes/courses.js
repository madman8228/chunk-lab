'use strict';

function registerCourseRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const validate = options.validate;
  const db = options.db;
  const upsertCourse = options.upsertCourse;
  const allocSeq = options.allocSeq;
  const strictConditionalWrites = options.strictConditionalWrites;

  app.post('/api/courses', auth.authenticate, function (req, res) {
    if (strictConditionalWrites) return res.status(428).json({ error: '课程写入已迁移到条件同步批次，请升级客户端', code: 'CLIENT_UPGRADE_REQUIRED' });
    const course = req.body && req.body.course;
    const verr = validate.validateCourse(course);
    if (verr) return res.status(400).json({ error: '数据校验失败：' + verr });
    try {
      upsertCourse(req.userId, course, null, false, allocSeq(req.userId));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/courses/:courseId', auth.authenticate, function (req, res) {
    if (strictConditionalWrites) return res.status(428).json({ error: '课程删除已迁移到条件同步批次，请升级客户端', code: 'CLIENT_UPGRADE_REQUIRED' });
    try {
      const cid = req.params.courseId;
      const row = db.prepare('SELECT rev FROM user_courses WHERE user_id=? AND course_id=?').get(req.userId, cid);
      const rev = ((row && row.rev != null) ? row.rev : 0) + 1;
      upsertCourse(req.userId, { courseId: cid }, rev, true, allocSeq(req.userId));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerCourseRoutes };
