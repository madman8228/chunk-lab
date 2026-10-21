import assert from 'node:assert/strict';
import { PlanCatalog } from './plan-catalog.mjs';
import { DAY_MS, evaluateTrial, snapshotTrialSettings, validateTrialSettings } from './trial-policy.mjs';
import { addUtcCalendarMonths, projectEntitlementPeriods, resolveEntitlement } from './entitlement-timeline.mjs';
import { CourseAccessPolicy } from './course-access-policy.mjs';

const plans = new PlanCatalog();
assert.deepEqual(plans.list().map(plan => [plan.key, plan.termMonths]), [['monthly', 1], ['quarterly', 3], ['yearly', 12]]);
assert.equal(plans.get('missing'), null);
assert.throws(() => validateTrialSettings({ enabled: true, trialDays: 0, dailyLimitSeconds: 1800, revision: 1 }));

const jan31 = Date.UTC(2024, 0, 31, 12, 34, 56, 789);
assert.equal(addUtcCalendarMonths(jan31, 1), Date.UTC(2024, 1, 29, 12, 34, 56, 789));
assert.equal(addUtcCalendarMonths(jan31, 2), Date.UTC(2024, 2, 31, 12, 34, 56, 789));
assert.equal(addUtcCalendarMonths(Date.UTC(2025, 0, 31), 1), Date.UTC(2025, 1, 28));

const grants = [
  { id: 'month', sequence: 1, redeemedAt: jan31, termMonths: 1 },
  { id: 'quarter', sequence: 2, redeemedAt: jan31 + 1000, termMonths: 3 },
  { id: 'year', sequence: 3, redeemedAt: Date.UTC(2025, 0, 1), termMonths: 12 }
];
let periods = projectEntitlementPeriods(grants);
assert.equal(periods.length, 2);
assert.equal(periods[0].endsAt, Date.UTC(2024, 4, 31, 12, 34, 56, 789));
assert.equal(resolveEntitlement(grants, periods[0].endsAt - 1).active, true);
assert.equal(resolveEntitlement(grants, periods[0].endsAt).active, false);
periods = projectEntitlementPeriods(grants.map(grant => grant.id === 'month' ? { ...grant, revokedAt: jan31 + 1 } : grant));
assert.equal(periods[0].grantIds.includes('month'), false);
assert.equal(periods[0].endsAt, addUtcCalendarMonths(jan31 + 1000, 3));

const trial = snapshotTrialSettings({ enabled: true, trialDays: 3, dailyLimitSeconds: 1800, revision: 4 }, jan31);
assert.equal(evaluateTrial(trial, jan31, { usedMs: 0, reservedMs: 0 }).status, 'available');
assert.equal(evaluateTrial(trial, jan31, { usedMs: 1_700_000, reservedMs: 100_000 }).status, 'daily_limit');
assert.equal(evaluateTrial(trial, jan31 + DAY_MS, { usedMs: 0, reservedMs: 0 }).dayIndex, 1);
assert.equal(evaluateTrial(trial, trial.endsAt).status, 'expired');
assert.equal(evaluateTrial(trial, jan31 - 1).status, 'clock_error');

const policy = new CourseAccessPolicy({ resolveEntitlement, resolveTrial: evaluateTrial });
assert.equal(policy.decide({ accessLevel: 'free', now: jan31 }).allowed, true);
assert.equal(policy.decide({ accessLevel: 'member', isPersonal: true, now: jan31 }).reasonCode, 'PERSONAL_COURSE');
assert.equal(policy.decide({ accessLevel: 'member', now: jan31, grants, trial }).reasonCode, 'MEMBER_ACCESS');
assert.equal(policy.decide({ accessLevel: 'unknown', now: jan31 }).reasonCode, 'SERVICE_UNAVAILABLE');

console.log('membership domain policy tests passed');
