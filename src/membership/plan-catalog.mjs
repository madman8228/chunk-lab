const PLAN_TERMS = Object.freeze({ monthly: 1, quarterly: 3, yearly: 12 });

export class PlanCatalog {
  /** @param {Record<string, number | ({ termMonths: number } & Record<string, unknown>)>} [plans] */
  constructor(plans = PLAN_TERMS) {
    const entries = Object.entries(plans);
    if (!entries.length) throw new TypeError('At least one membership plan is required');
    this.#plans = new Map(entries.map(([key, plan]) => {
      const termMonths = typeof plan === 'number' ? plan : plan?.termMonths;
      if (!/^[a-z][a-z0-9_-]{0,39}$/.test(key) || !Number.isSafeInteger(termMonths) || termMonths < 1 || termMonths > 120) {
        throw new TypeError(`Invalid membership plan: ${key}`);
      }
      const value = typeof plan === 'number' ? { termMonths } : Object.assign({}, plan, { termMonths });
      return [key, Object.freeze({ key, entitlementKey: 'member_access', enabled: true, ...value })];
    }));
    Object.freeze(this);
  }

  #plans;

  get(planKey) {
    const plan = this.#plans.get(planKey);
    return plan && plan.enabled ? plan : null;
  }

  list() { return [...this.#plans.values()].filter(plan => plan.enabled); }
}

export const DEFAULT_PLAN_TERMS = PLAN_TERMS;
