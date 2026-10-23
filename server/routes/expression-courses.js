'use strict';

function registerExpressionCourseRoutes({ app, auth, adminOnly, repository, sessions, access }) {
  const id = /^[A-Za-z0-9_-]{12,100}$/;
  const sendError = (res, error) => res.status(error.status || 500).json({ code: error.code || 'EXPRESSION_COURSE_ERROR', error: error.status ? error.message : '课程服务暂时不可用' });
  const privateResponse = (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };
  app.use('/api/expression-courses', privateResponse);
  app.use('/api/expression-sessions', privateResponse);
  app.use('/api/expression-reviews', privateResponse);
  app.use('/api/admin/expression-drafts', privateResponse);
  app.use('/api/admin/expression-courses', privateResponse);
  app.use('/api/admin/expression-assets', privateResponse);

  app.get('/api/expression-courses', auth.authenticate, (req, res) => {
    try { res.json({ courses: repository.catalog().map(course => ({ ...course, progress: sessions.progress(course.courseId, req.userId) })) }); }
    catch (error) { sendError(res, error); }
  });
  app.get('/api/expression-courses/:courseId', auth.authenticate, (req, res) => {
    try {
      const course = repository.catalog().find(item => item.courseId === req.params.courseId);
      if (!course) return res.status(404).json({ code: 'EXPRESSION_COURSE_NOT_FOUND' });
      const release = repository.release(course.courseId, course.releaseId);
      res.json({ courseId: course.courseId, title: course.title, description: course.description, releaseId: course.releaseId,
        contentHash: release.contentHash, progress: sessions.progress(course.courseId, req.userId), lessons: release.package.lessons.map(lesson => ({ lessonId: lesson.lessonId, title: lesson.title, communicationGoal: lesson.communicationGoal, activityCount: lesson.activities.length })) });
    } catch (error) { sendError(res, error); }
  });
  app.post('/api/expression-sessions', auth.authenticate, (req, res) => {
    try { res.status(201).json(sessions.start(req.body || {}, req.userId)); }
    catch (error) { sendError(res, error); }
  });
  app.get('/api/expression-sessions/:sessionId', auth.authenticate, (req, res) => {
    try { res.json(sessions.get(req.params.sessionId, req.userId, req.get('X-Learning-Session'))); }
    catch (error) { sendError(res, error); }
  });
  app.post('/api/expression-sessions/:sessionId/actions', auth.authenticate, (req, res) => {
    try { res.json(sessions.act(req.params.sessionId, req.userId, req.body || {}, req.get('X-Learning-Session'))); }
    catch (error) { sendError(res, error); }
  });
  app.get('/api/expression-reviews/due', auth.authenticate, (req, res) => {
    try { res.json({ items: sessions.due(req.userId) }); } catch (error) { sendError(res, error); }
  });
  app.get('/api/expression-courses/:courseId/releases/:releaseId/assets/:assetId', auth.authenticate, (req, res) => {
    try {
      const permission = access.authorize(req.params.courseId, req.userId, req.get('X-Learning-Session'));
      if (!permission.allowed) return res.status(permission.status || 403).json({ code: permission.reasonCode });
      const file = repository.assetForRelease(req.params.courseId, req.params.releaseId, req.params.assetId);
      res.type(file.mimeType).set('X-Content-Type-Options', 'nosniff').send(file.bytes);
    } catch (error) { sendError(res, error); }
  });

  app.get('/api/admin/expression-drafts', adminOnly, (_req, res) => { try { res.json({ drafts: repository.listDrafts() }); } catch (error) { sendError(res, error); } });
  app.get('/api/admin/expression-courses', adminOnly, (_req, res) => { try { res.json({ courses: repository.adminCatalog() }); } catch (error) { sendError(res, error); } });
  app.post('/api/admin/expression-drafts', adminOnly, (req, res) => {
    try { res.status(201).json(repository.createDraft(req.body?.package, req.admin.id, req.body?.requestId)); } catch (error) { sendError(res, error); }
  });
  app.get('/api/admin/expression-drafts/:draftId', adminOnly, (req, res) => { try { res.json(repository.getDraft(req.params.draftId)); } catch (error) { sendError(res, error); } });
  app.put('/api/admin/expression-drafts/:draftId', adminOnly, (req, res) => {
    try { res.json(repository.updateDraft(req.params.draftId, req.body?.expectedRevision, req.body?.package, req.admin.id, req.body?.requestId)); } catch (error) { sendError(res, error); }
  });
  app.delete('/api/admin/expression-drafts/:draftId', adminOnly, (req, res) => {
    try { res.json(repository.deleteDraft(req.params.draftId, req.body?.expectedRevision, req.admin.id, req.body?.requestId)); } catch (error) { sendError(res, error); }
  });
  app.post('/api/admin/expression-drafts/:draftId/validate', adminOnly, (req, res) => { try { res.json(repository.validate(req.params.draftId)); } catch (error) { sendError(res, error); } });
  app.post('/api/admin/expression-drafts/:draftId/review', adminOnly, (req, res) => { try { res.json(repository.review(req.params.draftId, req.body?.contentHash)); } catch (error) { sendError(res, error); } });
  app.post('/api/admin/expression-drafts/:draftId/publish', adminOnly, (req, res) => {
    try { res.json(repository.publish(req.params.draftId, req.body || {}, req.admin.id)); } catch (error) { sendError(res, error); }
  });
  app.post('/api/admin/expression-courses/:courseId/unlist', adminOnly, (req, res) => {
    try {
      if (!id.test(req.body?.requestId || '')) return res.status(400).json({ code: 'INVALID_REQUEST' });
      res.json(repository.unlist(req.params.courseId, req.body, req.admin.id));
    } catch (error) { sendError(res, error); }
  });
  app.post('/api/admin/expression-assets', adminOnly, (req, res) => { try { res.status(201).json(repository.uploadAsset(req.body || {})); } catch (error) { sendError(res, error); } });
}

module.exports = { registerExpressionCourseRoutes };
