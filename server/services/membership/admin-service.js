'use strict';

const crypto = require('node:crypto');
const { validateTrialSettings } = require('./policies.cjs');

function createMembershipAdminService(options) {
  const db = options.db;
  const repository = options.repository;
  const issuer = options.issuer;
  const now = options.now || repository.now;
  const insertAudit = db.prepare(`INSERT INTO membership_admin_audit(admin_id,action,target_id,details_json,created_at)
    VALUES(?,?,?,?,?)`);

  function getSettings() { return repository.getSettings(); }
  function saveSettings(baseRevision, input, adminId) {
    let value;
    try { value = validateTrialSettings({ ...(input || {}), revision: baseRevision }); }
    catch (error) { return { status: 400, code: 'INVALID_SETTINGS', error: error.message }; }
    const salesUrl = String(input && input.salesUrl || '').trim();
    let parsedUrl;
    try { parsedUrl = salesUrl ? new URL(salesUrl) : null; } catch (_) { return { status: 400, code: 'INVALID_SETTINGS', error: '购买链接必须是有效的 HTTPS 地址' }; }
    if (salesUrl.length > 500 || (parsedUrl && (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password))) {
      return { status: 400, code: 'INVALID_SETTINGS', error: '购买链接必须是有效的 HTTPS 地址' };
    }
    return db.transaction(() => {
      const result = repository.saveSettings(baseRevision, { ...value, salesUrl }, adminId);
      if (result.status === 200) insertAudit.run(adminId, 'settings_updated', 'settings', JSON.stringify({ revision: result.settings.revision }), now());
      return result;
    }).immediate();
  }
  function listBatches(limit = 100) {
    const size = Number.isSafeInteger(Number(limit)) ? Math.max(1, Math.min(200, Number(limit))) : 100;
    return db.prepare(`SELECT b.batch_id AS batchId,b.status,b.quantity,b.redeem_by AS redeemBy,b.channel_ref AS channelRef,
      b.revision,b.created_at AS createdAt,b.activated_at AS activatedAt,
      json_extract(b.plan_snapshot_json,'$.key') AS planKey,
      SUM(CASE WHEN c.status='redeemed' THEN 1 ELSE 0 END) AS redeemedCount,
      SUM(CASE WHEN c.status='unused' THEN 1 ELSE 0 END) AS unusedCount
      FROM redemption_batches b LEFT JOIN redemption_codes c ON c.batch_id=b.batch_id
      GROUP BY b.batch_id ORDER BY b.created_at DESC LIMIT ?`).all(size);
  }
  function changeBatch(input, adminId) {
    const body = input || {};
    const { batchId, action, baseRevision, requestId } = body;
    if (!['activate', 'pause', 'revoke'].includes(action) || typeof batchId !== 'string' ||
        !Number.isSafeInteger(baseRevision) || !/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '')) {
      return { status: 400, code: 'INVALID_REQUEST' };
    }
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify({ batchId, action, baseRevision, reason: String(body.reason || '').slice(0, 200) })).digest('hex');
    const prior = db.prepare('SELECT payload_hash,result_json FROM membership_admin_mutation_receipts WHERE admin_id=? AND request_id=?').get(adminId, requestId);
    if (prior) return prior.payload_hash === payloadHash ? { status: 200, ...JSON.parse(prior.result_json), replay: true } : { status: 409, code: 'IDEMPOTENCY_CONFLICT' };
    const transaction = db.transaction(() => {
      const batch = db.prepare('SELECT status,revision FROM redemption_batches WHERE batch_id=?').get(batchId);
      if (!batch) return { status: 404, code: 'BATCH_NOT_FOUND' };
      if (batch.revision !== baseRevision) return { status: 409, code: 'REVISION_CONFLICT', currentRevision: batch.revision };
      const allowed = action === 'activate' ? batch.status === 'paused' : action === 'pause' ? batch.status === 'active' : batch.status !== 'revoked';
      if (!allowed) return { status: 409, code: 'INVALID_BATCH_TRANSITION', currentStatus: batch.status };
      const next = action === 'activate' ? 'active' : action === 'pause' ? 'paused' : 'revoked';
      db.prepare(`UPDATE redemption_batches SET status=?,revision=revision+1,
        activated_by=CASE WHEN ?='activate' THEN ? ELSE activated_by END,
        activated_at=CASE WHEN ?='activate' THEN ? ELSE activated_at END WHERE batch_id=? AND revision=?`)
        .run(next, action, adminId, action, now(), batchId, baseRevision);
      if (action === 'revoke') db.prepare("UPDATE redemption_codes SET status='revoked' WHERE batch_id=? AND status='unused'").run(batchId);
      const result = { batchId, batchStatus: next, revision: baseRevision + 1 };
      insertAudit.run(adminId, 'batch_' + action, batchId, JSON.stringify({ reason: String(body.reason || '').slice(0, 200) }), now());
      db.prepare(`INSERT INTO membership_admin_mutation_receipts(admin_id,request_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)`)
        .run(adminId, requestId, payloadHash, JSON.stringify(result), now());
      return { status: 200, ...result };
    });
    return transaction.immediate();
  }
  function issue(input, adminId) { return issuer.issue(input, adminId); }
  return Object.freeze({ getSettings, saveSettings, listBatches, changeBatch, issue });
}

module.exports = { createMembershipAdminService };
