'use strict';

const { evaluateTrial } = require('./policies.cjs');

function createMembershipService(options) {
  const db = options.db;
  const repository = options.repository;
  const entitlements = options.entitlements;
  const usageMeter = options.usageMeter || null;
  const now = options.now || repository.now;

  function getStatus(userId) {
    const activeSession = usageMeter ? usageMeter.reconcile(userId) : null;
    const settings = repository.getSettings();
    const entitlement = entitlements.get(userId);
    const state = db.prepare(`SELECT status,started_at AS startedAt,ends_at AS endsAt,enabled,trial_days AS trialDays,
      daily_limit_seconds AS dailyLimitSeconds,policy_revision AS policyRevision
      FROM user_trial_state WHERE user_id=?`).get(userId);
    let trial;
    if (!state) {
      trial = Object.freeze({ status: settings.enabled ? 'not_started' : 'disabled', remainingSeconds: 0,
        trialDays: settings.trialDays, dailyLimitSeconds: settings.dailyLimitSeconds,
        policyRevision: settings.revision, nextResetAt: null, endsAt: null });
    } else {
      const t = now();
      const dayIndex = Math.max(0, Math.floor((t - state.startedAt) / 86400000));
      const window = db.prepare('SELECT used_ms AS usedMs,reserved_ms AS reservedMs FROM user_trial_windows WHERE user_id=? AND day_index=?').get(userId, dayIndex) || { usedMs: 0, reservedMs: 0 };
      /** @type {Record<string, any>} */
      const assessment = state.status === 'active'
        ? { ...evaluateTrial({ enabled: !!state.enabled, startedAt: state.startedAt, endsAt: state.endsAt,
          trialDays: state.trialDays, dailyLimitSeconds: state.dailyLimitSeconds, policyRevision: state.policyRevision }, t, window) }
        : { status: state.status, dayIndex, nextResetAt: null, remainingSeconds: 0 };
      if (activeSession && activeSession.dayIndex === dayIndex && ['available', 'daily_limit'].includes(assessment.status)) {
        const elapsed = Math.max(0, Math.min(t, activeSession.leaseEndsAt) - activeSession.lastSettledAt);
        assessment.remainingSeconds = Math.ceil(Math.max(0, state.dailyLimitSeconds * 1000 - window.usedMs - elapsed) / 1000);
        if (assessment.remainingSeconds > 0) assessment.status = 'available';
      }
      trial = Object.freeze({ ...assessment, policyRevision: state.policyRevision,
        trialDays: state.trialDays, dailyLimitSeconds: state.dailyLimitSeconds, endsAt: state.endsAt });
    }
    return Object.freeze({ serverNow: now(), membershipRevision: entitlement.revision,
      entitlement: Object.freeze({ active: entitlement.active, entitlementKey: entitlement.entitlementKey,
        startsAt: entitlement.startsAt, endsAt: entitlement.endsAt }),
      trial, history: entitlements.listUserGrants(userId).slice(0, 100), plans: repository.listPlans(), salesUrl: settings.salesUrl });
  }
  return Object.freeze({ getStatus });
}

module.exports = { createMembershipService };
