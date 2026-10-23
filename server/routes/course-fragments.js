'use strict';
function registerCourseFragmentRoutes({ app, auth, registry, grants }) {
  const fail = (res, error) => res.set('Cache-Control', 'private, no-store').status(error.status || 503).json({ allowed: false, reasonCode: error.code || 'CONTENT_UNAVAILABLE' });
  app.post('/api/learning-sessions/content-grant', auth.authenticate, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const input = req.body || {};
      if (!/^[A-Za-z0-9_-]{12,100}$/.test(input.requestId || '')) throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST', status: 400 });
      res.json(grants.issue({ courseId: input.courseId, unitId: input.unitId, cursor: input.cursor, purpose: input.purpose, sessionId: input.sessionId }, req.userId));
    } catch (error) { fail(res, error); }
  });
  app.post('/api/course-content/preview-grant', auth.authenticate, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const input = req.body || {};
      if (!/^[A-Za-z0-9_-]{12,100}$/.test(input.requestId || '')) throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST', status: 400 });
      res.json(grants.issue({ courseId: input.courseId, unitId: input.unitId, cursor: input.cursor, purpose: 'preview' }, req.userId));
    } catch (error) { fail(res, error); }
  });
  function deliver(type) {
    return (req, res) => {
      res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff');
      try {
        if (req.get('Range')) throw Object.assign(new Error('CONTENT_RANGE_UNSUPPORTED'), { code: 'CONTENT_RANGE_UNSUPPORTED', status: 416 });
        const resourceId = req.params.resourceId;
        if (!/^[A-Za-z0-9:._-]{1,160}$/.test(resourceId) || /\.(?:br|gz)$/i.test(resourceId)) throw Object.assign(new Error('INVALID_RESOURCE_ID'), { code: 'INVALID_RESOURCE_ID', status: 400 });
        const verified = grants.verify(req.get('X-Course-Grant'), { userId: req.userId, courseId: req.get('X-Course-Id'), unitId: req.get('X-Course-Unit'),
          purpose: req.get('X-Course-Purpose') || 'practice', resourceType: type, resourceId });
        const descriptor = type === 'fragment' ? verified.scope.fragments[0] : verified.scope.unit.assets.find(asset => asset.assetId === resourceId);
        if (!descriptor || type === 'asset' && !['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/wav'].includes(descriptor.mimeType)) throw Object.assign(new Error('INVALID_ASSET'), { code: 'INVALID_ASSET', status: 503 });
        // Authorization above runs even when the static byte cache is hot or the client asks for HEAD/304.
        const bytes = registry.staticStore.read(descriptor);
        res.type(type === 'fragment' ? 'application/json' : descriptor.mimeType).send(bytes);
      } catch (error) { fail(res, error); }
    };
  }
  app.get('/api/course-fragments/:resourceId', auth.authenticate, deliver('fragment'));
  app.get('/api/course-assets/:resourceId', auth.authenticate, deliver('asset'));
}
module.exports = { registerCourseFragmentRoutes };
