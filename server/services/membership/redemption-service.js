'use strict';

const crypto = require('node:crypto');
const { normalizeCode } = require('./code-issuer');

function createRedemptionService(options) {
  const db = options.db;
  const repository = options.repository;
  const issuer = options.issuer;
  const entitlements = options.entitlements;
  const trialMeter = options.trialMeter || null;
  const now = options.now || repository.now;
  const uuid = options.uuid || crypto.randomUUID;
  const addAttempt = db.prepare('INSERT INTO redemption_attempts(account_key,ip_key,succeeded,attempted_at) VALUES(?,?,?,?)');
  const receipt = db.prepare(`INSERT INTO redemption_receipts(user_id,request_id,payload_hash,code_id,grant_id,outcome,created_at)
    VALUES(?,?,?,?,?,?,?)`);

  function recordAttempt(userId, ip, succeeded) {
    addAttempt.run(String(userId), String(ip || '').slice(0, 80), succeeded ? 1 : 0, now());
    db.prepare("DELETE FROM redemption_attempts WHERE attempted_at < ?").run(now() - 7 * 86400000);
  }

  const redeemTx = db.transaction((userId, code, requestId, ip) => {
    if (!Number.isSafeInteger(userId) || userId < 1 || !/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) {
      return { status: 400, code: 'INVALID_REQUEST' };
    }
    let canonical;
    try { canonical = normalizeCode(code); } catch (_) {
      return { status: 400, code: 'CODE_UNAVAILABLE' };
    }
    const payloadHash = crypto.createHash('sha256').update(canonical).digest('hex');
    const prior = db.prepare('SELECT payload_hash,grant_id,outcome FROM redemption_receipts WHERE user_id=? AND request_id=?').get(userId, requestId);
    if (prior) {
      if (prior.payload_hash !== payloadHash) return { status: 409, code: 'IDEMPOTENCY_CONFLICT' };
      return prior.grant_id ? { status: 200, grantId: prior.grant_id, replay: true } : { status: 400, code: 'CODE_UNAVAILABLE' };
    }
    const matches = [];
    for (const version of issuer.keyProvider.versions()) {
      const key = issuer.keyProvider.get(version);
      if (key) matches.push(db.prepare(`SELECT c.code_id,c.code_digest,c.key_version,c.status,c.redeemed_by,c.grant_id,
      b.status AS batch_status,b.redeem_by FROM redemption_codes c JOIN redemption_batches b ON b.batch_id=c.batch_id
      WHERE c.code_digest=? AND c.key_version=?`).get(issuer.digest(canonical, key), version));
    }
    const found = matches.find(Boolean);
    if (!found) {
      receipt.run(userId, requestId, payloadHash, null, null, 'unavailable', now());
      return { status: 400, code: 'CODE_UNAVAILABLE' };
    }
    if (found.status === 'redeemed' && Number(found.redeemed_by) === userId && found.grant_id) {
      receipt.run(userId, requestId, payloadHash, found.code_id, found.grant_id, 'already_redeemed_by_account', now());
      return { status: 200, grantId: found.grant_id, replay: true };
    }
    const timestamp = now();
    if (found.status !== 'unused' || found.batch_status !== 'active' || (found.redeem_by != null && found.redeem_by <= timestamp)) {
      receipt.run(userId, requestId, payloadHash, null, null, 'unavailable', timestamp);
      return { status: 400, code: 'CODE_UNAVAILABLE' };
    }
    const batch = db.prepare('SELECT plan_snapshot_json FROM redemption_batches WHERE batch_id=(SELECT batch_id FROM redemption_codes WHERE code_id=?)').get(found.code_id);
    const plan = JSON.parse(batch.plan_snapshot_json);
    const sequenceRow = db.prepare('SELECT COALESCE(MAX(sequence),0) AS sequence FROM user_entitlement_grants WHERE user_id=?').get(userId);
    const grantId = uuid();
    const consumed = db.prepare(`UPDATE redemption_codes SET status='redeemed',redeemed_by=?,redeemed_at=?,grant_id=?
      WHERE code_id=? AND status='unused'`).run(userId, timestamp, grantId, found.code_id);
    if (consumed.changes !== 1) {
      receipt.run(userId, requestId, payloadHash, null, null, 'unavailable', timestamp);
      return { status: 400, code: 'CODE_UNAVAILABLE' };
    }
    db.prepare(`INSERT INTO user_entitlement_grants(grant_id,user_id,sequence,source_code_id,plan_key,term_months,display_name,redeemed_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(grantId, userId, sequenceRow.sequence + 1, found.code_id,
      plan.key, plan.termMonths, plan.displayName, timestamp);
    if (trialMeter) trialMeter.settleForRedemption(userId, timestamp);
    const trial = db.prepare('SELECT status FROM user_trial_state WHERE user_id=?').get(userId);
    if (trial && trial.status === 'active') {
      db.prepare("UPDATE user_trial_state SET status='closed_by_redemption',revision=revision+1 WHERE user_id=? AND status='active'").run(userId);
      db.prepare("UPDATE user_trial_sessions SET status='ended',lease_ends_at=?,last_settled_at=? WHERE user_id=? AND status='active'")
        .run(timestamp, timestamp, userId);
    } else if (!trial) {
      const settings = repository.getSettings();
      db.prepare(`INSERT INTO user_trial_state(user_id,status,started_at,ends_at,enabled,trial_days,daily_limit_seconds,policy_revision,revision)
        VALUES(?,'closed_by_redemption',?,?,?,?,?,?,1)`).run(userId, timestamp, timestamp, settings.enabled ? 1 : 0,
        settings.trialDays, settings.dailyLimitSeconds, settings.revision);
    }
    entitlements.project(userId, true);
    receipt.run(userId, requestId, payloadHash, found.code_id, grantId, 'redeemed', timestamp);
    return { status: 200, grantId, replay: false };
  });

  function redeem(userId, code, requestId, ip) {
    const versions = issuer.keyProvider.versions();
    if (!versions.length || versions.some(version => !issuer.keyProvider.get(version))) return { status: 503, code: 'CODE_KEYS_UNAVAILABLE' };
    const unavailableVersion = db.prepare(`SELECT 1 AS missing FROM redemption_codes WHERE status='unused'
      AND code_id NOT IN (SELECT code_id FROM redemption_codes WHERE key_version IN (${versions.map(() => '?').join(',')})) LIMIT 1`).get(...versions);
    if (unavailableVersion) return { status: 503, code: 'CODE_KEYS_UNAVAILABLE' };
    const threshold = db.prepare(`SELECT
      SUM(CASE WHEN account_key=? AND succeeded=0 AND attempted_at>? THEN 1 ELSE 0 END) AS account_minute,
      SUM(CASE WHEN account_key=? AND succeeded=0 AND attempted_at>? THEN 1 ELSE 0 END) AS account_hour,
      SUM(CASE WHEN ip_key=? AND succeeded=0 AND attempted_at>? THEN 1 ELSE 0 END) AS ip_window,
      SUM(CASE WHEN account_key=? AND attempted_at>? THEN 1 ELSE 0 END) AS account_total,
      SUM(CASE WHEN ip_key=? AND attempted_at>? THEN 1 ELSE 0 END) AS ip_total
      FROM redemption_attempts`).get(String(userId), now() - 60000, String(userId), now() - 3600000,
      String(ip || '').slice(0, 80), now() - 600000, String(userId), now() - 60000,
      String(ip || '').slice(0, 80), now() - 60000);
    if (threshold.account_minute >= 5 || threshold.account_hour >= 20 || threshold.ip_window >= 30 ||
        threshold.account_total >= 60 || threshold.ip_total >= 300) {
      return { status: 429, code: 'RATE_LIMITED', retryAfter: 60 };
    }
    let result;
    try {
      result = redeemTx.immediate(userId, code, requestId, ip);
    } catch (error) {
      // Keep a failed attempt after the business transaction has rolled back.
      recordAttempt(userId, ip, false);
      throw error;
    }
    recordAttempt(userId, ip, result.status === 200);
    return result;
  }

  return Object.freeze({ recordAttempt, redeem });
}

module.exports = { createRedemptionService };
