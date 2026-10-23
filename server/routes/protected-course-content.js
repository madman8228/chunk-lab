'use strict';
function registerProtectedCourseContentRoutes({ app, auth, courseAccess, usageMeter, adminOnly, registry, grants }) {
  function owner(req) {
    const header = String(req.headers.authorization || '');
    const identity = header.startsWith('Bearer ') ? auth.verifyToken(header.slice(7)) : null;
    return identity && auth.readUser(identity.userId) ? identity.userId : null;
  }
  function fail(res, error) {
    res.set('Cache-Control', 'private, no-store').status(error.status || 503).json({
      allowed: false, reasonCode: error.code || 'SERVICE_UNAVAILABLE',
      ...(error.conflicts ? { conflicts: error.conflicts } : {})
    });
  }
  const json = handler => (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const result = handler(req);
      res.status(result.allowed === false ? result.status || 403 : result.status || 200).json({ serverNow: Date.now(), ...result });
    } catch (error) { fail(res, error); }
  };
  function requireFragmentEntry(req) {
    const course=registry?.snapshot().courses.find(course=>course.courseId===req.params.courseId);
    if(course?.contentType==='expression')throw Object.assign(new Error('EXPRESSION_RUNTIME_REQUIRED'),{code:'EXPRESSION_RUNTIME_REQUIRED',status:410});
    if(course?.units.find(unit=>unit.unitId===req.params.unitId)?.fragments)throw Object.assign(new Error('UNIFIED_COURSE_ENTRY_REQUIRED'),{code:'UNIFIED_COURSE_ENTRY_REQUIRED',status:410});
  }
  app.get('/api/course-content/catalog', json(() => ({ courses: courseAccess.catalog() })));
  app.post('/api/learning-sessions/start', auth.authenticate, json(req => {
    const course = registry?.snapshot().courses.find(course => course.courseId === req.body?.courseId);
    const unit = course?.units.find(unit => unit.unitId === req.body?.unitId);
    if (!unit?.fragments || !grants) return courseAccess.start(req.body, req.userId);
    // Key/configuration or grant failures must roll back a first trial and its start receipt.
    grants.key();
    return courseAccess.start(req.body, req.userId, result => ({ ...result, ...grants.issue({ courseId: req.body.courseId,
      unitId: req.body.unitId, cursor: result.unit.cursor, purpose: req.body.purpose, sessionId: result.sessionId }, req.userId) }));
  }));
  for (const action of ['heartbeat', 'pause', 'end']) {
    app.post('/api/learning-sessions/:sessionId/' + action, auth.authenticate, json(req =>
      usageMeter.heartbeat(req.userId, req.params.sessionId, req.body?.sequence, action !== 'heartbeat')));
  }
  app.get('/api/course-content/:courseId/units/:unitId', json(req => {requireFragmentEntry(req);return courseAccess.read(req.params.courseId,
    req.params.unitId, req.query.cursor === undefined ? 0 : Number(req.query.cursor), owner(req), req.get('X-Learning-Session'));}));
  app.get('/api/course-content/:courseId/units/:unitId/assets/:assetId', (req, res) => {
    res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff');
    try {
      requireFragmentEntry(req);
      const result = courseAccess.asset(req.params.courseId, req.params.unitId, req.params.assetId, owner(req), req.get('X-Learning-Session'));
      if (!result.allowed) return res.status(result.status || 403).json(result);
      res.type(result.asset.mimeType).sendFile(result.asset.file, { cacheControl: false, lastModified: false, acceptRanges: false },
        error => { if (error && !res.headersSent) fail(res, error); });
    } catch (error) { fail(res, error); }
  });
  app.get('/api/admin/membership/course-access', adminOnly, json(() => courseAccess.list()));
  app.post('/api/admin/membership/course-access/preview', adminOnly, json(req => ({ ...courseAccess.preview(req.body?.changes, req.body?.registryVersion), status: 200 })));
  app.put('/api/admin/membership/course-access', adminOnly, json(req => courseAccess.publish(req.body, req.admin.id)));
}
module.exports = { registerProtectedCourseContentRoutes };
