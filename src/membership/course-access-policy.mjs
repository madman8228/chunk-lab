export class CourseAccessPolicy {
  constructor({ resolveEntitlement, resolveTrial }) {
    if (typeof resolveEntitlement !== 'function' || typeof resolveTrial !== 'function') throw new TypeError('Access policy resolvers are required');
    this.resolveEntitlement = resolveEntitlement;
    this.resolveTrial = resolveTrial;
    Object.freeze(this);
  }

  decide({ accessLevel, isPersonal = false, now, grants = [], trial = null, usage = null }) {
    if (isPersonal) return Object.freeze({ allowed: true, reasonCode: 'PERSONAL_COURSE' });
    if (accessLevel === 'free') return Object.freeze({ allowed: true, reasonCode: 'FREE_COURSE' });
    if (accessLevel !== 'member') return Object.freeze({ allowed: false, reasonCode: 'SERVICE_UNAVAILABLE' });
    if (this.resolveEntitlement(grants, now).active) return Object.freeze({ allowed: true, reasonCode: 'MEMBER_ACCESS' });
    const result = this.resolveTrial(trial, now, usage);
    if (result.status === 'available') return Object.freeze({ allowed: true, reasonCode: 'TRIAL_ACCESS', trial: result });
    const reasonCode = result.status === 'daily_limit' ? 'TRIAL_DAILY_LIMIT'
      : result.status === 'expired' ? 'TRIAL_EXPIRED'
        : result.status === 'disabled' ? 'TRIAL_DISABLED' : 'SERVICE_UNAVAILABLE';
    return Object.freeze({ allowed: false, reasonCode, trial: result });
  }
}
