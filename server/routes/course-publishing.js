'use strict';
function registerCoursePublishingRoutes({ app, adminOnly, publisher }) {
  app.get('/api/admin/membership/course-publications', adminOnly, (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json({ publications: publisher.list() }); } catch (_) { res.status(503).json({ error: '发布记录暂不可用' }); }
  });
  app.get('/api/admin/membership/course-publications/:id', adminOnly, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(publisher.inspect(req.params.id)); } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : '草稿暂不可用' }); }
  });
  for (const [path, action] of [['prepare', 'prepare'], ['publish', 'publish']]) {
    app.post('/api/admin/membership/course-publications/' + path, adminOnly, (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      try { res.json(publisher[action](req.body || {}, req.admin.id)); }
      catch (error) { res.status(error.status || 503).json({ code: error.code || 'SERVICE_UNAVAILABLE', error: error.status ? error.message : '课程发布服务暂时不可用，原课程保持不变', issues: error.issues }); }
    });
  }
}
module.exports = { registerCoursePublishingRoutes };
