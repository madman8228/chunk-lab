'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createMembershipRepository } = require('./repository');
const { createMembershipCodeIssuer } = require('./code-issuer');
const { createEntitlementService } = require('./entitlement-service');
const { createMembershipAdminService } = require('./admin-service');
const { createRedemptionService } = require('./redemption-service');
const { createMembershipService } = require('./membership-service');
const { createTrialUsageMeter } = require('./trial-usage-meter');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-membership-flow-'));
let db;
try {
  db = new Database(path.join(dir, 'isolated.db'));
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL);
    CREATE TABLE user_courses(user_id INTEGER,course_id TEXT,course_json TEXT);
    CREATE TABLE user_learning_events(user_id INTEGER,event_id TEXT);
    INSERT INTO users VALUES(1,'learner'); INSERT INTO users VALUES(2,'other');
    INSERT INTO user_courses VALUES(1,'saved-course','{"title":"keep"}');
    INSERT INTO user_learning_events VALUES(1,'old-event');`);
  let clockNow = Date.UTC(2026, 0, 31, 12);
  const clock = { now: () => clockNow };
  const repository = createMembershipRepository(db, clock);
  const secret = crypto.randomBytes(32);
  const keyring = { current: () => ({ version: 'v1', secret }), get: version => version === 'v1' ? { version, secret } : null,
    versions: () => ['v1'] };
  const issuer = createMembershipCodeIssuer({ repository, keyProvider: keyring });
  const entitlements = createEntitlementService({ db, now: clock.now });
  const adminService = createMembershipAdminService({ db, repository, issuer, now: clock.now });
  const meter = createTrialUsageMeter({ db, repository, entitlements, now: clock.now,
    uuid: (() => { let n = 0; return () => 'trial-session-' + String(++n).padStart(12, '0'); })() });
  const membership = createMembershipService({ db, repository, entitlements, usageMeter: meter, now: clock.now });
  const redemption = createRedemptionService({ db, repository, issuer, entitlements, trialMeter: meter, now: clock.now });

  let trial = meter.start(2, 'member-course-fixture', 'request_trial_start_001');
  assert.equal(trial.status, 200);
  assert.equal(trial.mode, 'trial');
  assert.equal(membership.getStatus(2).trial.remainingSeconds, 1800, 'reserved lease time is not displayed as already consumed');
  for (let sequence = 1; sequence <= 120; sequence++) {
    clockNow += 15000;
    trial = meter.heartbeat(2, trial.sessionId, sequence);
    if (sequence < 120) assert.equal(trial.status, 200, JSON.stringify({ sequence, trial }));
    if (sequence === 1) assert.equal(membership.getStatus(2).trial.remainingSeconds, 1785);
  }
  assert.equal(trial.status, 409, 'late heartbeat cannot extend an expired lease');
  assert.equal(db.prepare('SELECT used_ms AS used FROM user_trial_windows WHERE user_id=2 AND day_index=0').get().used, 1800000);
  assert.equal(meter.start(2, 'member-course-fixture', 'request_trial_start_002').code, 'TRIAL_DAILY_LIMIT', 'trial stops new study at the daily limit');

  const issued = adminService.issue({ planKey: 'monthly', quantity: 2, channelRef: '=unsafe', requestId: 'request_issue_0001' }, 1);
  assert.equal(issued.status, 'paused');
  assert.equal(issued.codes.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM redemption_codes WHERE code_digest LIKE ?').get(issued.codes[0].code).n, 0, 'plaintext code is not stored');
  assert.throws(() => adminService.issue({ planKey: 'monthly', quantity: 2, channelRef: '=unsafe', requestId: 'request_issue_0001' }, 1), error => error.code === 'EXPORT_UNAVAILABLE', 'repeat export is rejected instead of regenerating codes');
  const batch = adminService.listBatches()[0];
  assert.equal(batch.status, 'paused');
  assert.equal(adminService.changeBatch({ batchId: issued.batchId, action: 'activate', baseRevision: 1, requestId: 'request_activate_001' }, 1).status, 200);

  const result = redemption.redeem(1, issued.codes[0].code, 'request_redeem_0001', '127.0.0.1');
  assert.equal(result.status, 200);
  assert.equal(membership.getStatus(1).entitlement.active, true);
  const repeated = redemption.redeem(1, issued.codes[0].code, 'request_redeem_0002', '127.0.0.1');
  assert.equal(repeated.status, 200);
  assert.equal(repeated.replay, true);
  assert.equal(redemption.redeem(1, issued.codes[1].code, 'request_redeem_0001', '127.0.0.1').code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_entitlement_grants WHERE user_id=1').get().n, 1, 'same code cannot grant twice');
  assert.equal(redemption.redeem(2, issued.codes[0].code, 'request_redeem_0003', '127.0.0.1').code, 'CODE_UNAVAILABLE');
  assert.equal(adminService.changeBatch({ batchId: issued.batchId, action: 'pause', baseRevision: 2, requestId: 'request_pause_000001' }, 1).status, 200);
  assert.equal(adminService.changeBatch({ batchId: issued.batchId, action: 'revoke', baseRevision: 3, requestId: 'request_revoke_batch_001' }, 1).status, 200);
  assert.equal(db.prepare('SELECT status FROM redemption_codes WHERE code_id=?').get(issued.codes[0].codeId).status, 'redeemed');
  assert.equal(db.prepare('SELECT status FROM redemption_codes WHERE code_id=?').get(issued.codes[1].codeId).status, 'revoked');
  assert.equal(membership.getStatus(1).entitlement.active, true, 'revoking a batch does not revoke already redeemed membership');

  const nextBatch = adminService.issue({ planKey: 'quarterly', quantity: 1, requestId: 'request_issue_0002' }, 1);
  adminService.changeBatch({ batchId: nextBatch.batchId, action: 'activate', baseRevision: 1, requestId: 'request_activate_002' }, 1);
  clockNow += 1;
  assert.equal(redemption.redeem(1, nextBatch.codes[0].code, 'request_redeem_0004', '127.0.0.1').status, 200);
  const periods = entitlements.get(1).periods;
  assert.equal(periods.length, 1);
  assert.equal(new Date(periods[0].endsAt).toISOString(), '2026-05-31T12:30:00.000Z', 'consecutive renewal preserves month-end anchor');
  const firstGrantId = entitlements.listUserGrants(1).find(grant => grant.planKey === 'monthly').grantId;
  const revokePreview = entitlements.previewRevoke(firstGrantId);
  assert.equal(revokePreview.status, 200);
  assert.equal(new Date(revokePreview.proposedPeriods[0].endsAt).toISOString(), '2026-04-30T12:30:00.001Z', 'revoking an earlier grant recomputes the remaining term');
  const revoked = entitlements.revoke({ grantId: firstGrantId, baseRevision: revokePreview.revision,
    requestId: 'request_revoke_0001', reason: 'fixture check' }, 1);
  assert.equal(revoked.status, 200);
  assert.equal(new Date(entitlements.get(1).endsAt).toISOString(), '2026-04-30T12:30:00.001Z');
  clockNow = Date.UTC(2026, 4, 1, 12);
  assert.equal(meter.start(1, 'member-course-fixture', 'request_trial_after_expiry_001').code, 'MEMBERSHIP_REQUIRED',
    'redeeming before trial start permanently closes the later trial for that account');
  assert.equal(db.prepare("SELECT username FROM users WHERE id=1").get().username, 'learner');
  assert.equal(db.prepare('SELECT course_json FROM user_courses WHERE course_id=?').get('saved-course').course_json, '{"title":"keep"}');
  assert.equal(db.prepare('SELECT event_id FROM user_learning_events WHERE user_id=1').get().event_id, 'old-event');
  console.log('membership issue, redeem, renewal, and preservation tests passed');
} finally {
  if (db) db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
