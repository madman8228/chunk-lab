'use strict';

function registerContentStudioRoutes(options) {
  const app = options.app;
  const adminOnly = options.adminOnly;
  const studio = options.studio;
  const prefix = '/api/admin/content';

  app.get(prefix + '/courses', adminOnly, function (req, res) {
    try { res.json({ projectId: 'chunk-practice', courses: studio.catalog() }); }
    catch (error) { res.status(500).json({ error: '课程清单读取失败：' + error.message }); }
  });

  app.get(prefix + '/courses/:courseId', adminOnly, function (req, res) {
    try {
      const result = studio.getCourse(req.params.courseId);
      if (!result) return res.status(404).json({ error: '课程不存在' });
      res.json(result);
    } catch (error) { res.status(500).json({ error: '课程读取失败：' + error.message }); }
  });

  app.get(prefix + '/courses/:courseId/draft', adminOnly, function (req, res) {
    try { res.json(studio.readDraft(req.params.courseId)); }
    catch (error) { res.status(500).json({ error: '草稿读取失败：' + error.message }); }
  });

  app.put(prefix + '/courses/:courseId/draft', adminOnly, function (req, res) {
    try {
      const body = req.body || {};
      const result = studio.saveDraft(req.params.courseId, body.baseRevision, body.course);
      if (result.status !== 200) return res.status(result.status).json(result);
      res.json(result);
    } catch (error) { res.status(500).json({ error: '草稿保存失败：' + error.message }); }
  });

  app.post(prefix + '/courses/:courseId/validate', adminOnly, function (req, res) {
    try { res.json(studio.validateCourse(req.params.courseId, req.body && req.body.course)); }
    catch (error) { res.status(500).json({ error: '课程校验失败：' + error.message }); }
  });

  app.post(prefix + '/courses/:courseId/publish', adminOnly, function (req, res) {
    try {
      const result = studio.publish(req.params.courseId, req.body && req.body.revision);
      if (result.status !== 200) return res.status(result.status).json(result);
      res.json(result);
    } catch (error) { res.status(500).json({ error: '课程发布失败：' + error.message }); }
  });
}

module.exports = { registerContentStudioRoutes };
