'use strict';

const crypto = require('node:crypto');
const { DAY_MS, snapshotTrialSettings, evaluateTrial } = require('./policies.cjs');

const MAX_LEASE_MS = 30000;

function createTrialUsageMeter(options) {
  const db = options.db;
  const repository = options.repository;
  const entitlements = options.entitlements;
  const now = options.now || repository.now;
  const uuid = options.uuid || crypto.randomUUID;
  const currentSettings = db.prepare('SELECT revision,settings_json FROM membership_settings_revisions ORDER BY revision DESC LIMIT 1');

  function readWindow(userId, dayIndex) {
    return db.prepare('SELECT used_ms AS usedMs,reserved_ms AS reservedMs FROM user_trial_windows WHERE user_id=? AND day_index=?')
      .get(userId, dayIndex) || { usedMs: 0, reservedMs: 0 };
  }
  function ensureWindow(userId, dayIndex) {
    db.prepare('INSERT OR IGNORE INTO user_trial_windows(user_id,day_index) VALUES(?,?)').run(userId, dayIndex);
    return readWindow(userId, dayIndex);
  }
  function trialSnapshot(userId, timestamp, create) {
    let row = db.prepare(`SELECT status,started_at AS startedAt,ends_at AS endsAt,enabled,trial_days AS trialDays,
      daily_limit_seconds AS dailyLimitSeconds,policy_revision AS policyRevision FROM user_trial_state WHERE user_id=?`).get(userId);
    if (!row && create) {
      const settingsRow = currentSettings.get();
      const settings = { ...JSON.parse(settingsRow.settings_json), revision: settingsRow.revision };
      if (!settings.enabled) return { error: 'TRIAL_DISABLED' };
      const snapshot = snapshotTrialSettings(settings, timestamp);
      db.prepare(`INSERT INTO user_trial_state(user_id,status,started_at,ends_at,enabled,trial_days,daily_limit_seconds,policy_revision,revision)
        VALUES(?,'active',?,?,?,?,?,?,1)`).run(userId, snapshot.startedAt, snapshot.endsAt, 1,
        snapshot.trialDays, snapshot.dailyLimitSeconds, snapshot.policyRevision);
      row = { status: 'active', ...snapshot };
    }
    if (!row) return { error: 'TRIAL_NOT_STARTED' };
    return { ...row, enabled: !!row.enabled };
  }
  function settleActiveSession(userId, timestamp, finalStatus) {
    const session = db.prepare(`SELECT session_id AS sessionId,day_index AS dayIndex,status,started_at AS startedAt,
      last_settled_at AS lastSettledAt,lease_ends_at AS leaseEndsAt,heartbeat_sequence AS heartbeatSequence
      FROM user_trial_sessions WHERE user_id=? AND status='active'`).get(userId);
    if (!session) return null;
    if (timestamp < session.lastSettledAt) throw Object.assign(new Error('Server clock moved backwards'), { code: 'CLOCK_ERROR', status: 503 });
    const settlementAt = Math.min(timestamp, session.leaseEndsAt);
    const reservedMs = Math.max(0, session.leaseEndsAt - session.lastSettledAt);
    const usedMs = Math.max(0, settlementAt - session.lastSettledAt);
    db.prepare(`UPDATE user_trial_windows SET used_ms=used_ms+?,reserved_ms=MAX(0,reserved_ms-?),revision=revision+1
      WHERE user_id=? AND day_index=?`).run(usedMs, reservedMs, userId, session.dayIndex);
    const isLeaseExpired = timestamp >= session.leaseEndsAt;
    if (finalStatus || isLeaseExpired) {
      db.prepare('UPDATE user_trial_sessions SET status=?,last_settled_at=?,lease_ends_at=? WHERE session_id=? AND status=\'active\'')
        .run(finalStatus || 'expired', settlementAt, settlementAt, session.sessionId);
      return { ...session, status: finalStatus || 'expired', usedMs };
    }
    db.prepare('UPDATE user_trial_sessions SET last_settled_at=? WHERE session_id=?').run(settlementAt, session.sessionId);
    return { ...session, usedMs };
  }
  function assess(userId, timestamp, snapshot) {
    const dayIndex = Math.floor((timestamp - snapshot.startedAt) / DAY_MS);
    return evaluateTrial(snapshot, timestamp, dayIndex < 0 ? { usedMs: 0, reservedMs: 0 } : readWindow(userId, dayIndex));
  }
  function reserveLease(userId, courseId, sessionId, requestId, timestamp, dayIndex, snapshot, priorSequence) {
    const windowStart = snapshot.startedAt + dayIndex * DAY_MS;
    const windowEnd = Math.min(windowStart + DAY_MS, snapshot.endsAt);
    const limitMs = snapshot.dailyLimitSeconds * 1000;
    const window = ensureWindow(userId, dayIndex);
    const remainingMs = limitMs - window.usedMs - window.reservedMs;
    const leaseMs = Math.min(MAX_LEASE_MS, Math.max(0, remainingMs), windowEnd - timestamp);
    if (leaseMs <= 0) return { error: timestamp >= snapshot.endsAt ? 'TRIAL_EXPIRED' : 'TRIAL_DAILY_LIMIT', nextResetAt: windowEnd };
    db.prepare('UPDATE user_trial_windows SET reserved_ms=reserved_ms+?,revision=revision+1 WHERE user_id=? AND day_index=?')
      .run(leaseMs, userId, dayIndex);
    const leaseEndsAt = timestamp + leaseMs;
    db.prepare(`INSERT INTO user_trial_sessions(session_id,user_id,course_id,day_index,status,started_at,last_settled_at,lease_ends_at,heartbeat_sequence,request_id)
      VALUES(?,?,?,?,'active',?,?,?,? ,?)`).run(sessionId, userId, courseId, dayIndex, timestamp, timestamp,
      leaseEndsAt, priorSequence == null ? 0 : priorSequence, requestId);
    return { sessionId, leaseEndsAt, sequence: priorSequence == null ? 0 : priorSequence,
      remainingSeconds: Math.max(0, Math.ceil((limitMs - window.usedMs) / 1000)) };
  }

  const startTx = db.transaction((userId, courseId, requestId, timestamp, takeover) => {
    const existing = db.prepare('SELECT session_id AS sessionId,course_id AS courseId,status,lease_ends_at AS leaseEndsAt,last_settled_at AS lastSettledAt,heartbeat_sequence AS sequence FROM user_trial_sessions WHERE user_id=? AND request_id=?')
      .get(userId, requestId);
    if (existing && existing.courseId !== courseId) return { status: 409, code: 'IDEMPOTENCY_CONFLICT' };
    const entitlement = entitlements.get(userId);
    if (entitlement.active) return { status: 200, mode: 'member', endsAt: entitlement.endsAt };
    if (existing) {
      if (timestamp < existing.lastSettledAt) return { status: 503, code: 'CLOCK_ERROR' };
      if (existing.status !== 'active' || existing.leaseEndsAt <= timestamp) {
        if (existing.status === 'active') settleActiveSession(userId, timestamp);
        return { status: 409, code: 'SESSION_EXPIRED' };
      }
      return { status: 200, mode: 'trial', sessionId: existing.sessionId, sequence: existing.sequence,
        leaseEndsAt: existing.leaseEndsAt, replay: true };
    }
    const trial = trialSnapshot(userId, timestamp, true);
    if (trial.error) return { status: 403, code: trial.error };
    if (trial.status !== 'active') return { status: 403, code: trial.status === 'closed_by_redemption' ? 'MEMBERSHIP_REQUIRED' : 'TRIAL_EXPIRED' };
    const active = db.prepare("SELECT session_id AS sessionId,lease_ends_at AS leaseEndsAt FROM user_trial_sessions WHERE user_id=? AND status='active'").get(userId);
    if (active) {
      if (active.leaseEndsAt > timestamp && !takeover) return { status: 409, code: 'SESSION_IN_USE', leaseEndsAt: active.leaseEndsAt };
      settleActiveSession(userId, timestamp, takeover ? 'superseded' : undefined);
    }
    const assessment = assess(userId, timestamp, trial);
    if (assessment.status === 'clock_error') return { status: 503, code: 'CLOCK_ERROR' };
    if (assessment.status !== 'available') return { status: 403, code: assessment.status === 'daily_limit' ? 'TRIAL_DAILY_LIMIT' : 'TRIAL_EXPIRED', nextResetAt: assessment.nextResetAt };
    const sessionId = uuid();
    const reservation = reserveLease(userId, courseId, sessionId, requestId, timestamp, assessment.dayIndex, trial, 0);
    return reservation.error ? { status: 403, ...reservation } : { status: 200, mode: 'trial', ...reservation,
      dayIndex: assessment.dayIndex, trialEndsAt: trial.endsAt, nextResetAt: assessment.nextResetAt };
  });

  const heartbeatTx = db.transaction((userId, sessionId, sequence, timestamp, pause) => {
    const session = db.prepare(`SELECT session_id AS sessionId,course_id AS courseId,day_index AS dayIndex,status,
      last_settled_at AS lastSettledAt,lease_ends_at AS leaseEndsAt,heartbeat_sequence AS heartbeatSequence
      FROM user_trial_sessions WHERE session_id=? AND user_id=?`).get(sessionId, userId);
    if (!session) return { status: 404, code: 'SESSION_NOT_FOUND' };
    const prior = db.prepare('SELECT action,result_json FROM user_trial_session_receipts WHERE session_id=? AND sequence=?')
      .get(sessionId, sequence);
    const action = pause ? 'pause' : 'heartbeat';
    if (prior && prior.action !== action) return { status: 409, code: 'IDEMPOTENCY_CONFLICT' };
    if (prior && pause) return { ...JSON.parse(prior.result_json), replay: true };
    if (session.status !== 'active') return { status: 409, code: 'SESSION_EXPIRED' };
    if (timestamp < session.lastSettledAt) return { status: 503, code: 'CLOCK_ERROR' };
    if (timestamp >= session.leaseEndsAt) {
      settleActiveSession(userId, timestamp);
      return { status: 409, code: 'SESSION_EXPIRED' };
    }
    if (prior) return { status: 200, replay: true, sessionId, sequence: session.heartbeatSequence, leaseEndsAt: session.leaseEndsAt };
    if (!Number.isSafeInteger(sequence) || sequence !== session.heartbeatSequence + 1) return { status: 409, code: 'SEQUENCE_CONFLICT', expectedSequence: session.heartbeatSequence + 1 };
    const trial = trialSnapshot(userId, timestamp, false);
    if (!trial || trial.error || trial.status !== 'active') return { status: 403, code: 'TRIAL_EXPIRED' };
    const windowEnd = Math.min(trial.startedAt + (session.dayIndex + 1) * DAY_MS, trial.endsAt);
    const settleAt = Math.min(timestamp, session.leaseEndsAt, windowEnd);
    settleActiveSession(userId, settleAt);
    if (pause) {
      db.prepare('UPDATE user_trial_sessions SET status=\'paused\',lease_ends_at=?,heartbeat_sequence=? WHERE session_id=?').run(settleAt, sequence, sessionId);
      const result = { status: 200, paused: true, sessionId, sequence, usedMs: Math.max(0, settleAt - session.lastSettledAt) };
      db.prepare('INSERT INTO user_trial_session_receipts(session_id,user_id,sequence,action,result_json,created_at) VALUES(?,?,?,?,?,?)')
        .run(sessionId, userId, sequence, action, JSON.stringify(result), timestamp);
      return result;
    }
    const currentDay = Math.floor((timestamp - trial.startedAt) / DAY_MS);
    const assessment = assess(userId, timestamp, trial);
    if (currentDay !== session.dayIndex) return { status: 403, code: assessment.status === 'available' ? 'WINDOW_CHANGED' : 'TRIAL_DAILY_LIMIT', nextResetAt: assessment.nextResetAt };
    if (assessment.status !== 'available') {
      db.prepare('UPDATE user_trial_sessions SET status=\'ended\',heartbeat_sequence=? WHERE session_id=?').run(sequence, sessionId);
      return { status: 403, code: assessment.status === 'daily_limit' ? 'TRIAL_DAILY_LIMIT' : 'TRIAL_EXPIRED', nextResetAt: assessment.nextResetAt };
    }
    const window = ensureWindow(userId, currentDay);
    const limitMs = trial.dailyLimitSeconds * 1000;
    const windowEndNow = Math.min(trial.startedAt + (currentDay + 1) * DAY_MS, trial.endsAt);
    const leaseMs = Math.min(MAX_LEASE_MS, Math.max(0, limitMs - window.usedMs - window.reservedMs), windowEndNow - timestamp);
    if (leaseMs <= 0) {
      db.prepare('UPDATE user_trial_sessions SET status=\'ended\',heartbeat_sequence=? WHERE session_id=?').run(sequence, sessionId);
      return { status: 403, code: timestamp >= trial.endsAt ? 'TRIAL_EXPIRED' : 'TRIAL_DAILY_LIMIT', nextResetAt: windowEndNow };
    }
    db.prepare('UPDATE user_trial_windows SET reserved_ms=reserved_ms+?,revision=revision+1 WHERE user_id=? AND day_index=?')
      .run(leaseMs, userId, currentDay);
    const reservation = { leaseEndsAt: timestamp + leaseMs, remainingSeconds: Math.max(0, Math.ceil((limitMs - window.usedMs) / 1000)) };
    db.prepare(`UPDATE user_trial_sessions SET last_settled_at=?,lease_ends_at=?,heartbeat_sequence=? WHERE session_id=?`)
      .run(timestamp, reservation.leaseEndsAt, sequence, sessionId);
    const result = { status: 200, sessionId, sequence, leaseEndsAt: reservation.leaseEndsAt,
      remainingSeconds: reservation.remainingSeconds, nextResetAt: assessment.nextResetAt };
    db.prepare('INSERT INTO user_trial_session_receipts(session_id,user_id,sequence,action,result_json,created_at) VALUES(?,?,?,?,?,?)')
      .run(sessionId, userId, sequence, action, JSON.stringify(result), timestamp);
    return result;
  });

  const reconcileTx = db.transaction((userId, timestamp) => {
    const active = db.prepare(`SELECT session_id AS sessionId,course_id AS courseId,day_index AS dayIndex,last_settled_at AS lastSettledAt,
      lease_ends_at AS leaseEndsAt FROM user_trial_sessions WHERE user_id=? AND status='active'`).get(userId);
    if (active && timestamp >= active.leaseEndsAt) settleActiveSession(userId, timestamp);
    return db.prepare(`SELECT session_id AS sessionId,course_id AS courseId,day_index AS dayIndex,last_settled_at AS lastSettledAt,heartbeat_sequence AS sequence,
      lease_ends_at AS leaseEndsAt FROM user_trial_sessions WHERE user_id=? AND status='active'`).get(userId) || null;
  });

  function start(userId, courseId, requestId, takeover = false) {
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof courseId !== 'string' || !courseId || courseId.length > 160 || !/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '')) return { status: 400, code: 'INVALID_REQUEST' };
    return startTx.immediate(userId, courseId, requestId, now(), !!takeover);
  }
  function heartbeat(userId, sessionId, sequence, pause = false) {
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof sessionId !== 'string' || !Number.isSafeInteger(sequence) || sequence < 1) return { status: 400, code: 'INVALID_REQUEST' };
    return heartbeatTx.immediate(userId, sessionId, sequence, now(), !!pause);
  }
  function settleForRedemption(userId, timestamp = now()) {
    settleActiveSession(userId, timestamp, 'ended');
  }
  function reconcile(userId, timestamp = now()) { return reconcileTx.immediate(userId, timestamp); }
  return Object.freeze({ start, heartbeat, settleForRedemption, reconcile, maxLeaseMs: MAX_LEASE_MS });
}

module.exports = { createTrialUsageMeter, MAX_LEASE_MS };
