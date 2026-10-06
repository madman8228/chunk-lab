'use strict';

const { randomUUID } = require('node:crypto');
const { MAX_CONTENT_IMPORT_BYTES } = require('../services/operations');

function registerContentImportRoutes(options) {
  const { app, auth, operations, validate } = options;
  const writeProtocol = options.writeProtocol || 2;
  app.post('/api/content-import', auth.authenticate, function (req, res) {
    if (writeProtocol !== 3) {
      res.status(428).json({ error: '客户端与服务端保存协议不匹配，请刷新后重试', code: 'CLIENT_UPDATE_REQUIRED' });
      return;
    }
    const body = req.body;
    if (!body || body.protocol !== 3 || !body.payload ||
        !(['course.put', 'deck.put'].includes(body.type))) {
      return fail(req, res, 'INVALID_CONTENT_IMPORT', 400, '大内容导入请求格式无效');
    }
    const isCourse = body.type === 'course.put';
    const content = body.payload[isCourse ? 'course' : 'deck'];
    if (!content) {
      return fail(req, res, 'INVALID_CONTENT_IMPORT', 400, '大内容导入请求缺少内容实体');
    }
    const contentError = isCourse ? validate.validateCourse(content) : validate.validateMem({ decks: [content] });
    if (contentError) {
      return fail(req, res, 'INVALID_CONTENT_IMPORT', 400, '内容校验失败：' + contentError);
    }
    try {
      const receipt = operations.executeContentImport(req.userId, body);
      res.json(receipt);
    } catch (error) {
      const code = typeof error.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'INTERNAL_ERROR';
      fail(req, res, code, error.status || 500, error.message, error.conflicts);
    }
  });

  function fail(req, res, code, status, message, conflicts) {
    const traceId = randomUUID();
    if (typeof options.recordSaveFailure === 'function') {
      try { options.recordSaveFailure(req.userId, code, status, traceId); }
      catch (recordError) { console.error('[content-import] failure diagnostic write failed:', recordError.message); }
    }
    res.status(status).json({ error: message, code, traceId, conflicts });
  }
}

module.exports = { registerContentImportRoutes, MAX_CONTENT_IMPORT_BYTES };
