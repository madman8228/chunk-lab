'use strict';

const { resolveEntitlement, projectEntitlementPeriods } = require('./policies.cjs');

function createEntitlementService(options) {
  const db = options.db;
  const now = options.now || Date.now;
  const listGrants = db.prepare(`SELECT grant_id AS id,sequence,term_months AS termMonths,
    redeemed_at AS redeemedAt,revoked_at AS revokedAt FROM user_entitlement_grants WHERE user_id=? ORDER BY sequence`);
  const upsertRevision = db.prepare(`INSERT INTO user_membership_revisions(user_id,revision,updated_at) VALUES(?,1,?)
    ON CONFLICT(user_id) DO UPDATE SET revision=user_membership_revisions.revision+1,updated_at=excluded.updated_at`);

  function grants(userId) { return listGrants.all(userId); }
  function get(userId) {
    const resolved = resolveEntitlement(grants(userId), now());
    const revisionRow = db.prepare('SELECT revision FROM user_membership_revisions WHERE user_id=?').get(userId);
    return Object.freeze({ ...resolved, revision: revisionRow ? revisionRow.revision : 0 });
  }
  function project(userId, bumpRevision = true) {
    const periods = projectEntitlementPeriods(grants(userId));
    const latest = db.prepare('SELECT COALESCE(MAX(revision),0) AS revision FROM user_entitlement_periods WHERE user_id=?').get(userId);
    const revision = Number(latest.revision) + 1;
    db.prepare('DELETE FROM user_entitlement_periods WHERE user_id=?').run(userId);
    const insert = db.prepare(`INSERT INTO user_entitlement_periods(user_id,period_index,starts_at,ends_at,anchor_at,cumulative_months,grant_ids_json,revision)
      VALUES(?,?,?,?,?,?,?,?)`);
    periods.forEach((period, index) => insert.run(userId, index, period.startsAt, period.endsAt,
      period.anchorAt, period.cumulativeMonths, JSON.stringify(period.grantIds), revision));
    if (bumpRevision) upsertRevision.run(userId, now());
    return periods;
  }
  function activeGrant(userId) {
    const t = now();
    return db.prepare(`SELECT g.grant_id AS grantId,g.plan_key AS planKey,g.display_name AS displayName,
      g.redeemed_at AS redeemedAt,p.ends_at AS endsAt
      FROM user_entitlement_grants g JOIN user_entitlement_periods p ON p.user_id=g.user_id
      WHERE g.user_id=? AND g.revoked_at IS NULL AND p.starts_at<=? AND p.ends_at>? ORDER BY g.sequence DESC LIMIT 1`)
      .get(userId, t, t) || null;
  }
  function revision(userId) {
    const row = db.prepare('SELECT revision FROM user_membership_revisions WHERE user_id=?').get(userId);
    return row ? row.revision : 0;
  }
  function listUserGrants(userId) {
    return db.prepare(`SELECT grant_id AS grantId,plan_key AS planKey,display_name AS displayName,term_months AS termMonths,
      redeemed_at AS redeemedAt,revoked_at AS revokedAt,revoke_reason AS revokeReason
      FROM user_entitlement_grants WHERE user_id=? ORDER BY sequence DESC`).all(userId);
  }
  function previewRevoke(grantId) {
    const row = db.prepare(`SELECT grant_id AS grantId,user_id AS userId,plan_key AS planKey,display_name AS displayName,
      term_months AS termMonths,redeemed_at AS redeemedAt,revoked_at AS revokedAt FROM user_entitlement_grants WHERE grant_id=?`).get(grantId);
    if (!row) return { status: 404, code: 'GRANT_NOT_FOUND' };
    if (row.revokedAt) return { status: 409, code: 'GRANT_ALREADY_REVOKED', revision: revision(row.userId) };
    const projected = grants(row.userId).map(grant => grant.id === grantId ? { ...grant, revokedAt: now() } : grant);
    return { status: 200, userId: row.userId, grant: row,
      current: resolveEntitlement(grants(row.userId), now()), proposedPeriods: projectEntitlementPeriods(projected),
      revision: revision(row.userId) };
  }
  function revoke(input, adminId) {
    const body = input || {};
    if (!body.grantId || !Number.isSafeInteger(body.baseRevision) || !/^[A-Za-z0-9_-]{12,100}$/.test(body.requestId || '') ||
        typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 200) return { status: 400, code: 'INVALID_REQUEST' };
    const payloadHash = require('node:crypto').createHash('sha256').update(JSON.stringify({
      grantId: body.grantId, baseRevision: body.baseRevision, reason: body.reason.trim()
    })).digest('hex');
    const prior = db.prepare('SELECT payload_hash,result_json FROM membership_admin_mutation_receipts WHERE admin_id=? AND request_id=?').get(adminId, body.requestId);
    if (prior) return prior.payload_hash === payloadHash ? { status: 200, ...JSON.parse(prior.result_json), replay: true } : { status: 409, code: 'IDEMPOTENCY_CONFLICT' };
    const transaction = db.transaction(() => {
      const grant = db.prepare('SELECT user_id AS userId,revoked_at AS revokedAt FROM user_entitlement_grants WHERE grant_id=?').get(body.grantId);
      if (!grant) return { status: 404, code: 'GRANT_NOT_FOUND' };
      const currentRevision = revision(grant.userId);
      if (currentRevision !== body.baseRevision) return { status: 409, code: 'REVISION_CONFLICT', currentRevision };
      if (grant.revokedAt) return { status: 409, code: 'GRANT_ALREADY_REVOKED', currentRevision };
      const timestamp = now();
      db.prepare('UPDATE user_entitlement_grants SET revoked_at=?,revoked_by=?,revoke_reason=? WHERE grant_id=? AND revoked_at IS NULL')
        .run(timestamp, adminId, body.reason.trim(), body.grantId);
      const periods = project(grant.userId, true);
      db.prepare(`INSERT INTO membership_admin_audit(admin_id,action,target_id,details_json,created_at) VALUES(?,?,?,?,?)`)
        .run(adminId, 'grant_revoked', body.grantId, JSON.stringify({ userId: grant.userId, reason: body.reason.trim(), periods }), timestamp);
      const result = { grantId: body.grantId, userId: grant.userId, revision: revision(grant.userId), periods };
      db.prepare(`INSERT INTO membership_admin_mutation_receipts(admin_id,request_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)`)
        .run(adminId, body.requestId, payloadHash, JSON.stringify(result), timestamp);
      return { status: 200, ...result };
    });
    return transaction.immediate();
  }
  return Object.freeze({ get, grants, project, activeGrant, revision, listUserGrants, previewRevoke, revoke });
}

module.exports = { createEntitlementService };
