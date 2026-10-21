function validTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer timestamp`);
}

export function addUtcCalendarMonths(anchorAt, monthCount) {
  validTimestamp(anchorAt, 'anchorAt');
  if (!Number.isSafeInteger(monthCount) || monthCount < 1 || monthCount > 1200) throw new TypeError('monthCount is invalid');
  const anchor = new Date(anchorAt);
  const targetMonth = anchor.getUTCMonth() + monthCount;
  const year = anchor.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds());
}

export function projectEntitlementPeriods(grants) {
  if (!Array.isArray(grants)) throw new TypeError('grants must be an array');
  const ordered = grants.filter(grant => grant.revokedAt == null)
    .sort((a, b) => a.sequence - b.sequence);
  const periods = [];
  for (const grant of ordered) {
    validTimestamp(grant.redeemedAt, 'redeemedAt');
    if (!Number.isSafeInteger(grant.termMonths) || grant.termMonths < 1 || grant.termMonths > 120) throw new TypeError('grant termMonths is invalid');
    const prior = periods[periods.length - 1];
    if (prior && grant.redeemedAt <= prior.endsAt) {
      prior.cumulativeMonths += grant.termMonths;
      prior.endsAt = addUtcCalendarMonths(prior.anchorAt, prior.cumulativeMonths);
      prior.grantIds.push(grant.id);
    } else {
      periods.push({ anchorAt: grant.redeemedAt, startsAt: grant.redeemedAt,
        cumulativeMonths: grant.termMonths,
        endsAt: addUtcCalendarMonths(grant.redeemedAt, grant.termMonths), grantIds: [grant.id] });
    }
  }
  return Object.freeze(periods.map(period => Object.freeze({ ...period, grantIds: Object.freeze(period.grantIds.slice()) })));
}

export function resolveEntitlement(grants, now) {
  validTimestamp(now, 'now');
  const periods = projectEntitlementPeriods(grants);
  const active = periods.find(period => period.startsAt <= now && now < period.endsAt) || null;
  return Object.freeze({ active: !!active, entitlementKey: active ? 'member_access' : null,
    startsAt: active?.startsAt ?? null, endsAt: active?.endsAt ?? null, periods });
}
