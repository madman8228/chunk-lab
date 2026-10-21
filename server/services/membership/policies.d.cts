export const DAY_MS: number;
export const DEFAULT_PLAN_TERMS: Readonly<Record<string, number>>;
export function addUtcCalendarMonths(anchorAt: number, monthCount: number): number;
export function projectEntitlementPeriods(grants: Array<Record<string, any>>): ReadonlyArray<any>;
export function resolveEntitlement(grants: Array<Record<string, any>>, now: number): Readonly<Record<string, any>>;
export function evaluateTrial(snapshot: Record<string, any>, now: number, usage?: Record<string, number>): Readonly<Record<string, any>>;
export function snapshotTrialSettings(settings: Record<string, any>, startedAt: number): Readonly<Record<string, any>>;
export function validateTrialSettings(settings: Record<string, any>): Readonly<Record<string, any>>;
export class PlanCatalog {
  constructor(plans?: Record<string, any>);
  get(planKey: string): any;
  list(): any[];
}
export class CourseAccessPolicy {
  constructor(options: Record<string, any>);
  decide(input: Record<string, any>): Readonly<Record<string, any>>;
}
