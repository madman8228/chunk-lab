var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/membership-policies-entry.mjs
var membership_policies_entry_exports = {};
__export(membership_policies_entry_exports, {
  CourseAccessPolicy: () => CourseAccessPolicy,
  DAY_MS: () => DAY_MS,
  DEFAULT_PLAN_TERMS: () => DEFAULT_PLAN_TERMS,
  PlanCatalog: () => PlanCatalog,
  addUtcCalendarMonths: () => addUtcCalendarMonths,
  evaluateTrial: () => evaluateTrial,
  projectEntitlementPeriods: () => projectEntitlementPeriods,
  resolveEntitlement: () => resolveEntitlement,
  snapshotTrialSettings: () => snapshotTrialSettings,
  validateTrialSettings: () => validateTrialSettings
});
module.exports = __toCommonJS(membership_policies_entry_exports);

// src/membership/plan-catalog.mjs
var PLAN_TERMS = Object.freeze({ monthly: 1, quarterly: 3, yearly: 12 });
var PlanCatalog = class {
  /** @param {Record<string, number | ({ termMonths: number } & Record<string, unknown>)>} [plans] */
  constructor(plans = PLAN_TERMS) {
    const entries = Object.entries(plans);
    if (!entries.length) throw new TypeError("At least one membership plan is required");
    this.#plans = new Map(entries.map(([key, plan]) => {
      const termMonths = typeof plan === "number" ? plan : plan?.termMonths;
      if (!/^[a-z][a-z0-9_-]{0,39}$/.test(key) || !Number.isSafeInteger(termMonths) || termMonths < 1 || termMonths > 120) {
        throw new TypeError(`Invalid membership plan: ${key}`);
      }
      const value = typeof plan === "number" ? { termMonths } : Object.assign({}, plan, { termMonths });
      return [key, Object.freeze({ key, entitlementKey: "member_access", enabled: true, ...value })];
    }));
    Object.freeze(this);
  }
  #plans;
  get(planKey) {
    const plan = this.#plans.get(planKey);
    return plan && plan.enabled ? plan : null;
  }
  list() {
    return [...this.#plans.values()].filter((plan) => plan.enabled);
  }
};
var DEFAULT_PLAN_TERMS = PLAN_TERMS;

// src/membership/trial-policy.mjs
var DAY_MS = 24 * 60 * 60 * 1e3;
function validateTrialSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new TypeError("\u8BD5\u7528\u8BBE\u7F6E\u65E0\u6548");
  if (typeof settings.enabled !== "boolean") throw new TypeError("\u8BD5\u7528\u5F00\u5173\u5FC5\u987B\u662F\u5E03\u5C14\u503C");
  if (!Number.isSafeInteger(settings.trialDays) || settings.trialDays < 1 || settings.trialDays > 365) {
    throw new TypeError("\u4F53\u9A8C\u5929\u6570\u5FC5\u987B\u5728 1 \u81F3 365 \u4E4B\u95F4");
  }
  if (!Number.isSafeInteger(settings.dailyLimitSeconds) || settings.dailyLimitSeconds < 1 || settings.dailyLimitSeconds > 86400) {
    throw new TypeError("\u6BCF\u65E5\u4F53\u9A8C\u65F6\u957F\u5FC5\u987B\u5728 1 \u81F3 86400 \u79D2\u4E4B\u95F4");
  }
  if (!Number.isSafeInteger(settings.revision) || settings.revision < 1) throw new TypeError("\u4F53\u9A8C\u89C4\u5219\u7248\u672C\u65E0\u6548");
  return Object.freeze({ ...settings });
}
function snapshotTrialSettings(settings, startedAt) {
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) throw new TypeError("\u4F53\u9A8C\u5F00\u59CB\u65F6\u95F4\u65E0\u6548");
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
function evaluateTrial(snapshot, now, usage = { usedMs: 0, reservedMs: 0 }) {
  if (!snapshot || snapshot.enabled !== true || !Number.isSafeInteger(snapshot.startedAt) || !Number.isSafeInteger(snapshot.endsAt)) {
    return Object.freeze({ status: "disabled", dayIndex: -1, nextResetAt: null, remainingSeconds: 0 });
  }
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError("\u670D\u52A1\u7AEF\u65F6\u95F4\u65E0\u6548");
  if (now < snapshot.startedAt) return Object.freeze({ status: "clock_error", dayIndex: -1, nextResetAt: null, remainingSeconds: 0 });
  if (now >= snapshot.endsAt) return Object.freeze({ status: "expired", dayIndex: snapshot.trialDays, nextResetAt: null, remainingSeconds: 0 });
  const dayIndex = Math.floor((now - snapshot.startedAt) / DAY_MS);
  if (dayIndex >= snapshot.trialDays) return Object.freeze({ status: "expired", dayIndex, nextResetAt: null, remainingSeconds: 0 });
  const windowStart = snapshot.startedAt + dayIndex * DAY_MS;
  const nextResetAt = Math.min(windowStart + DAY_MS, snapshot.endsAt);
  const usedMs = Number(usage?.usedMs) || 0;
  const reservedMs = Number(usage?.reservedMs) || 0;
  if (!Number.isFinite(usedMs) || !Number.isFinite(reservedMs) || usedMs < 0 || reservedMs < 0) throw new TypeError("\u4F53\u9A8C\u7528\u91CF\u65E0\u6548");
  const remainingMs = Math.max(0, snapshot.dailyLimitSeconds * 1e3 - usedMs - reservedMs);
  if (remainingMs <= 0) return Object.freeze({ status: "daily_limit", dayIndex, nextResetAt, remainingSeconds: 0 });
  return Object.freeze({ status: "available", dayIndex, nextResetAt, remainingSeconds: Math.ceil(remainingMs / 1e3), trialEndsAt: snapshot.endsAt });
}

// src/membership/entitlement-timeline.mjs
function validTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer timestamp`);
}
function addUtcCalendarMonths(anchorAt, monthCount) {
  validTimestamp(anchorAt, "anchorAt");
  if (!Number.isSafeInteger(monthCount) || monthCount < 1 || monthCount > 1200) throw new TypeError("monthCount is invalid");
  const anchor = new Date(anchorAt);
  const targetMonth = anchor.getUTCMonth() + monthCount;
  const year = anchor.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds());
}
function projectEntitlementPeriods(grants) {
  if (!Array.isArray(grants)) throw new TypeError("grants must be an array");
  const ordered = grants.filter((grant) => grant.revokedAt == null).sort((a, b) => a.sequence - b.sequence);
  const periods = [];
  for (const grant of ordered) {
    validTimestamp(grant.redeemedAt, "redeemedAt");
    if (!Number.isSafeInteger(grant.termMonths) || grant.termMonths < 1 || grant.termMonths > 120) throw new TypeError("grant termMonths is invalid");
    const prior = periods[periods.length - 1];
    if (prior && grant.redeemedAt <= prior.endsAt) {
      prior.cumulativeMonths += grant.termMonths;
      prior.endsAt = addUtcCalendarMonths(prior.anchorAt, prior.cumulativeMonths);
      prior.grantIds.push(grant.id);
    } else {
      periods.push({
        anchorAt: grant.redeemedAt,
        startsAt: grant.redeemedAt,
        cumulativeMonths: grant.termMonths,
        endsAt: addUtcCalendarMonths(grant.redeemedAt, grant.termMonths),
        grantIds: [grant.id]
      });
    }
  }
  return Object.freeze(periods.map((period) => Object.freeze({ ...period, grantIds: Object.freeze(period.grantIds.slice()) })));
}
function resolveEntitlement(grants, now) {
  validTimestamp(now, "now");
  const periods = projectEntitlementPeriods(grants);
  const active = periods.find((period) => period.startsAt <= now && now < period.endsAt) || null;
  return Object.freeze({
    active: !!active,
    entitlementKey: active ? "member_access" : null,
    startsAt: active?.startsAt ?? null,
    endsAt: active?.endsAt ?? null,
    periods
  });
}

// src/membership/course-access-policy.mjs
var CourseAccessPolicy = class {
  constructor({ resolveEntitlement: resolveEntitlement2, resolveTrial }) {
    if (typeof resolveEntitlement2 !== "function" || typeof resolveTrial !== "function") throw new TypeError("Access policy resolvers are required");
    this.resolveEntitlement = resolveEntitlement2;
    this.resolveTrial = resolveTrial;
    Object.freeze(this);
  }
  decide({ accessLevel, isPersonal = false, now, grants = [], trial = null, usage = null }) {
    if (isPersonal) return Object.freeze({ allowed: true, reasonCode: "PERSONAL_COURSE" });
    if (accessLevel === "free") return Object.freeze({ allowed: true, reasonCode: "FREE_COURSE" });
    if (accessLevel !== "member") return Object.freeze({ allowed: false, reasonCode: "SERVICE_UNAVAILABLE" });
    if (this.resolveEntitlement(grants, now).active) return Object.freeze({ allowed: true, reasonCode: "MEMBER_ACCESS" });
    const result = this.resolveTrial(trial, now, usage);
    if (result.status === "available") return Object.freeze({ allowed: true, reasonCode: "TRIAL_ACCESS", trial: result });
    const reasonCode = result.status === "daily_limit" ? "TRIAL_DAILY_LIMIT" : result.status === "expired" ? "TRIAL_EXPIRED" : result.status === "disabled" ? "TRIAL_DISABLED" : "SERVICE_UNAVAILABLE";
    return Object.freeze({ allowed: false, reasonCode, trial: result });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CourseAccessPolicy,
  DAY_MS,
  DEFAULT_PLAN_TERMS,
  PlanCatalog,
  addUtcCalendarMonths,
  evaluateTrial,
  projectEntitlementPeriods,
  resolveEntitlement,
  snapshotTrialSettings,
  validateTrialSettings
});
