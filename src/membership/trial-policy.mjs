export const DAY_MS = 24 * 60 * 60 * 1000;

export function validateTrialSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new TypeError('试用设置无效');
  if (typeof settings.enabled !== 'boolean') throw new TypeError('试用开关必须是布尔值');
  if (!Number.isSafeInteger(settings.trialDays) || settings.trialDays < 1 || settings.trialDays > 365) {
    throw new TypeError('体验天数必须在 1 至 365 之间');
  }
  if (!Number.isSafeInteger(settings.dailyLimitSeconds) || settings.dailyLimitSeconds < 1 || settings.dailyLimitSeconds > 86400) {
    throw new TypeError('每日体验时长必须在 1 至 86400 秒之间');
  }
  if (!Number.isSafeInteger(settings.revision) || settings.revision < 1) throw new TypeError('体验规则版本无效');
  return Object.freeze({ ...settings });
}

export function snapshotTrialSettings(settings, startedAt) {
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) throw new TypeError('体验开始时间无效');
  const snapshot = validateTrialSettings(settings);
  return Object.freeze({
    enabled: snapshot.enabled,
    startedAt,
    endsAt: startedAt + snapshot.trialDays * DAY_MS,
    trialDays: snapshot.trialDays,
    dailyLimitSeconds: snapshot.dailyLimitSeconds,
    policyRevision: snapshot.revision
  });
}

export function evaluateTrial(snapshot, now, usage = { usedMs: 0, reservedMs: 0 }) {
  if (!snapshot || snapshot.enabled !== true || !Number.isSafeInteger(snapshot.startedAt) || !Number.isSafeInteger(snapshot.endsAt)) {
    return Object.freeze({ status: 'disabled', dayIndex: -1, nextResetAt: null, remainingSeconds: 0 });
  }
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('服务端时间无效');
  if (now < snapshot.startedAt) return Object.freeze({ status: 'clock_error', dayIndex: -1, nextResetAt: null, remainingSeconds: 0 });
  if (now >= snapshot.endsAt) return Object.freeze({ status: 'expired', dayIndex: snapshot.trialDays, nextResetAt: null, remainingSeconds: 0 });
  const dayIndex = Math.floor((now - snapshot.startedAt) / DAY_MS);
  if (dayIndex >= snapshot.trialDays) return Object.freeze({ status: 'expired', dayIndex, nextResetAt: null, remainingSeconds: 0 });
  const windowStart = snapshot.startedAt + dayIndex * DAY_MS;
  const nextResetAt = Math.min(windowStart + DAY_MS, snapshot.endsAt);
  const usedMs = Number(usage?.usedMs) || 0;
  const reservedMs = Number(usage?.reservedMs) || 0;
  if (!Number.isFinite(usedMs) || !Number.isFinite(reservedMs) || usedMs < 0 || reservedMs < 0) throw new TypeError('体验用量无效');
  const remainingMs = Math.max(0, snapshot.dailyLimitSeconds * 1000 - usedMs - reservedMs);
  if (remainingMs <= 0) return Object.freeze({ status: 'daily_limit', dayIndex, nextResetAt, remainingSeconds: 0 });
  return Object.freeze({ status: 'available', dayIndex, nextResetAt, remainingSeconds: Math.ceil(remainingMs / 1000), trialEndsAt: snapshot.endsAt });
}
