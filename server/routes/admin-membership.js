'use strict';

const { buildCodeCsv } = require('../services/membership/csv-code-delivery');

function registerAdminMembershipRoutes(options) {
  const { app, adminOnly, membershipAdmin, entitlements } = options;
  const prefix = '/api/admin/membership';
  app.get(prefix + '/settings', adminOnly, (_req, res) => res.set('Cache-Control', 'private, no-store').json({ settings: membershipAdmin.getSettings() }));
  app.put(prefix + '/settings', adminOnly, (req, res) => {
    const result = membershipAdmin.saveSettings(req.body && req.body.baseRevision, req.body, req.admin.id);
    res.set('Cache-Control', 'private, no-store').status(result.status).json(result);
  });
  app.get(prefix + '/plans', adminOnly, (_req, res) => res.set('Cache-Control', 'private, no-store').json({ plans: options.repository.listPlans() }));
  app.post(prefix + '/code-batches/issue-export', adminOnly, (req, res) => {
    try {
      const batch = membershipAdmin.issue(req.body, req.admin.id);
      const csv = buildCodeCsv(batch, batch.codes);
      res.set('Cache-Control', 'private, no-store');
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="membership-codes-' + batch.batchId + '.csv"');
      res.set('X-Membership-Batch-Id', batch.batchId);
      res.set('X-Membership-Batch-Status', batch.status);
      res.send(csv);
    } catch (error) {
      res.set('Cache-Control', 'private, no-store').status(error.status || 500).json({
        code: error.code || 'ISSUE_FAILED', error: error.status ? error.message : '生成兑换码失败，请检查服务密钥配置',
        ...(error.batchId ? { batchId: error.batchId } : {})
      });
    }
  });
  app.get(prefix + '/code-batches', adminOnly, (req, res) => res.set('Cache-Control', 'private, no-store')
    .json({ batches: membershipAdmin.listBatches(req.query && req.query.limit) }));
  app.post(prefix + '/code-batches/:batchId/action', adminOnly, (req, res) => {
    const result = membershipAdmin.changeBatch({ ...(req.body || {}), batchId: req.params.batchId }, req.admin.id);
    res.set('Cache-Control', 'private, no-store').status(result.status).json(result);
  });
  app.get(prefix + '/users/:userId/grants', adminOnly, (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ code: 'INVALID_USER' });
    res.set('Cache-Control', 'private, no-store').json({ userId, revision: entitlements.revision(userId), grants: entitlements.listUserGrants(userId) });
  });
  app.post(prefix + '/grants/:grantId/revoke-preview', adminOnly, (req, res) => {
    const result = entitlements.previewRevoke(req.params.grantId);
    res.set('Cache-Control', 'private, no-store').status(result.status).json(result);
  });
  app.post(prefix + '/grants/:grantId/revoke', adminOnly, (req, res) => {
    const result = entitlements.revoke({ ...(req.body || {}), grantId: req.params.grantId }, req.admin.id);
    res.set('Cache-Control', 'private, no-store').status(result.status).json(result);
  });
}

module.exports = { registerAdminMembershipRoutes };
