'use strict';

function registerCourseLibraryRoutes({ app, auth, library, validate }) {
  const protect = (req, res, next) => auth.authenticate(req, res, () => {
    res.set('X-ChunkLab-Account-Id', String(req.userId)); next();
  });
  function sendError(res, error) {
    res.status(error.status || 500).json({ error: error.message, code: error.code || 'INTERNAL_ERROR' });
  }
  app.get('/api/course-library', protect, (req, res) => {
    try { res.set('Cache-Control', 'private, no-store').json({ courses: library.catalog(req.userId) }); }
    catch (error) { sendError(res, error); }
  });
  app.get('/api/course-library/:courseId/assets/:assetId', protect, (req, res) => {
    try {
      const asset = library.readAsset(req.userId, req.params.courseId, req.params.assetId, req.query.releaseId);
      res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff').type(asset.mimeType).send(asset.bytes);
    } catch (error) { sendError(res, error); }
  });
  app.get('/api/course-library/:courseId', protect, (req, res) => {
    try {
      res.set('Cache-Control', 'private, no-store').json(library.read(req.userId, req.params.courseId, req.query.releaseId));
    } catch (error) { sendError(res, error); }
  });
  app.get('/api/course-library/:courseId/batch', protect, (req, res) => {
    const cursor = req.query.cursor === undefined ? 0 : Number(req.query.cursor);
    if (!Number.isSafeInteger(cursor) || cursor < 0) return res.status(400).json({ error: '课程位置无效', code: 'INVALID_CURSOR' });
    try {
      res.set('Cache-Control', 'private, no-store').json(library.readBatch(req.userId, req.params.courseId,
        { cursor, releaseId: req.query.releaseId }));
    } catch (error) { sendError(res, error); }
  });
  app.post('/api/course-library/import', protect, (req, res) => {
    const body = req.body;
    if (!body || Object.keys(body).some(key => !['requestId', 'kind', 'content', 'assets', 'sourceMapping'].includes(key)) ||
        !['deck', 'course'].includes(body.kind) || !body.content || typeof body.content !== 'object') {
      return res.status(400).json({ error: '独立课程导入请求格式无效', code: 'INVALID_COURSE_IMPORT' });
    }
    const validationError = body.kind === 'deck'
      ? validate.validateMem({ decks: [body.content] })
      : validate.validateCourse(body.content);
    if (validationError) return res.status(400).json({ error: '课程内容校验失败：' + validationError, code: 'INVALID_COURSE_CONTENT' });
    try { res.status(201).json(library.importContent(req.userId, body)); }
    catch (error) { sendError(res, error); }
  });
  app.put('/api/course-library/:courseId/release', protect, (req, res) => {
    const body = req.body;
    if (!body || Object.keys(body).some(key => !['requestId', 'expectedRelease', 'kind', 'content', 'assets'].includes(key)) ||
        !['deck', 'course'].includes(body.kind) || !body.content || typeof body.content !== 'object') {
      return res.status(400).json({ error: '课程版本更新请求格式无效', code: 'INVALID_COURSE_UPDATE' });
    }
    const validationError = body.kind === 'deck'
      ? validate.validateMem({ decks: [{ ...body.content, id: req.params.courseId }] })
      : validate.validateCourse({ ...body.content, courseId: req.params.courseId });
    if (validationError) return res.status(400).json({ error: '课程内容校验失败：' + validationError, code: 'INVALID_COURSE_CONTENT' });
    try { res.json(library.updateContent(req.userId, { ...body, courseId: req.params.courseId })); }
    catch (error) { sendError(res, error); }
  });
}

module.exports = { registerCourseLibraryRoutes };
