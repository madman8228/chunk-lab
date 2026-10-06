'use strict';

const { randomUUID } = require('node:crypto');

function registerOperationRoutes(options) {
  const writeProtocol = options.writeProtocol || 2;
  options.app.get('/api/operations/:id', options.auth.authenticate, function (req, res) {
    try { res.json(options.operations.receipt(req.userId, req.params.id)); }
    catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code });
    }
  });
  options.app.get('/api/assessment-sessions/:id', options.auth.authenticate, function (req, res) {
    try { res.json(options.operations.getAssessmentSession(req.userId, req.params.id)); }
    catch (error) { res.status(error.status || 500).json({ error: error.message, code: error.code }); }
  });
  options.app.post('/api/operations', options.auth.authenticate, function (req, res) {
    if (Number(writeProtocol) === 3 ? !req.body || req.body.protocol !== 3 : req.body && req.body.protocol === 3) {
      res.status(428).json({ error: '客户端与服务端保存协议不匹配，请刷新后重试', code: 'CLIENT_UPDATE_REQUIRED' });
      return;
    }
    try {
      res.json(options.operations.execute(req.userId, req.body));
    } catch (error) {
      const traceId = randomUUID();
      const code = typeof error.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'INTERNAL_ERROR';
      if (typeof options.recordSaveFailure === 'function') {
        try { options.recordSaveFailure(req.userId, code, error.status || 500, traceId); }
        catch (recordError) { console.error('[operations] failure diagnostic write failed:', recordError.message); }
      }
      res.status(error.status || 500).json({
        error: error.message,
        code,
        traceId,
        conflicts: error.conflicts
      });
    }
  });
}

module.exports = { registerOperationRoutes };
