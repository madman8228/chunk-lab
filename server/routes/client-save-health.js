'use strict';

const ALLOWED_KEYS = ['version', 'clientId', 'pending', 'blocked', 'retryAttempts', 'oldestPendingAt', 'errorCode', 'traceId'];
const CLIENT_ID = /^[A-Za-z0-9_-]{16,100}$/;
const ERROR_CODE = /^[A-Z0-9_]{1,64}$/;
const TRACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUEUE = 10000;
const MAX_ATTEMPTS = 1000000;

function boundedInteger(value, max) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function validReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !ALLOWED_KEYS.includes(key))) return false;
  if (body.version !== 1 || typeof body.clientId !== 'string' || !CLIENT_ID.test(body.clientId) ||
      !boundedInteger(body.pending, MAX_QUEUE) || !boundedInteger(body.blocked, MAX_QUEUE) ||
      !boundedInteger(body.retryAttempts, MAX_ATTEMPTS)) return false;
  if (body.oldestPendingAt !== null && (!Number.isSafeInteger(body.oldestPendingAt) || body.oldestPendingAt <= 0 || body.oldestPendingAt > Date.now() + 60000)) return false;
  if (body.errorCode !== null && (typeof body.errorCode !== 'string' || !ERROR_CODE.test(body.errorCode))) return false;
  if (body.traceId !== null && (typeof body.traceId !== 'string' || !TRACE_ID.test(body.traceId))) return false;
  return true;
}

function registerClientSaveHealthRoutes(options) {
  options.app.post('/api/client-save-health', options.auth.authenticate, function (req, res) {
    if (Number(options.writeProtocol) !== 3) return res.status(428).json({ error: '客户端与服务端保存协议不匹配', code: 'CLIENT_UPDATE_REQUIRED' });
    const body = req.body;
    if (!validReport(body)) return res.status(400).json({ error: '保存状态摘要格式无效', code: 'INVALID_SAVE_HEALTH' });
    const now = Date.now();
    try {
      options.db.prepare(
        'INSERT INTO user_client_save_health(user_id,client_id,pending,blocked,retry_attempts,oldest_pending_at,error_code,trace_id,updated_at) ' +
        'VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,client_id) DO UPDATE SET pending=excluded.pending,blocked=excluded.blocked,' +
        'retry_attempts=excluded.retry_attempts,oldest_pending_at=excluded.oldest_pending_at,error_code=excluded.error_code,' +
        'trace_id=excluded.trace_id,updated_at=excluded.updated_at'
      ).run(req.userId, body.clientId, body.pending, body.blocked, body.retryAttempts, body.oldestPendingAt,
        body.errorCode, body.traceId, now);
      options.db.prepare('DELETE FROM user_client_save_health WHERE updated_at < ?').run(now - 30 * 24 * 60 * 60 * 1000);
      options.db.prepare('DELETE FROM user_client_save_health WHERE user_id=? AND client_id NOT IN ' +
        '(SELECT client_id FROM user_client_save_health WHERE user_id=? ORDER BY updated_at DESC LIMIT 50)').run(req.userId, req.userId);
      return res.json({ ok: true });
    } catch (error) {
      console.error('[save-health] report write failed:', error.message);
      return res.status(500).json({ error: '保存状态摘要暂不可用', code: 'SAVE_HEALTH_UNAVAILABLE' });
    }
  });
}

module.exports = { registerClientSaveHealthRoutes, validReport, MAX_QUEUE, MAX_ATTEMPTS };
