'use strict';
const crypto = require('node:crypto');
const fail = (code, status = 403) => Object.assign(new Error(code), { code, status });
const PURPOSES = new Set(['practice', 'review', 'assessment']);

class ContentGrantService {
  constructor({ keyProvider, resolveScope, authorize, now = Date.now }) {
    this.keyProvider = keyProvider; this.resolveScope = resolveScope; this.authorize = authorize; this.now = now;
  }
  key() {
    const value = this.keyProvider();
    if (!Buffer.isBuffer(value) || value.length < 32) throw fail('CONTENT_GRANT_KEY_UNAVAILABLE', 503);
    return value;
  }
  sign(body) { return crypto.createHmac('sha256', this.key()).update(body).digest('base64url'); }
  state(scope, userId, sessionId) {
    if (!(typeof userId === 'string' && userId || Number.isSafeInteger(userId) && userId > 0)) throw fail('AUTH_REQUIRED', 401);
    const decision = this.authorize(scope.courseId, userId, sessionId);
    if (!decision.allowed) throw fail(decision.reasonCode || 'CONTENT_ACCESS_DENIED', decision.status || 403);
    if (![decision.policyRevision, decision.membershipRevision].every(value => Number.isSafeInteger(value) && value >= 0)) throw fail('INVALID_ACCESS_REVISION', 503);
    return decision;
  }
  deadline(decision, now) {
    let end = now + 30000;
    if (decision.mode === 'member') end = Math.min(end, Number(decision.endsAt));
    else if (decision.mode === 'trial') end = Math.min(end, Number(decision.leaseEndsAt), Number(decision.nextResetAt), now + Number(decision.remainingSeconds) * 1000);
    else if (decision.mode !== 'free') throw fail('INVALID_ACCESS_DECISION', 503);
    if (!Number.isFinite(end) || Math.floor(end) <= now) throw fail('CONTENT_GRANT_EXPIRED');
    return Math.floor(end);
  }
  issue({ courseId, unitId, cursor = 0, purpose = 'practice', sessionId = null }, userId) {
    if (!PURPOSES.has(purpose)) throw fail('INVALID_CONTENT_PURPOSE', 400);
    // resolveScope accepts canonical IDs and cursor, never a caller-provided path or resource list.
    const scope = this.resolveScope(courseId, unitId, cursor, purpose);
    if (!scope || scope.courseId !== courseId || scope.unitId !== unitId || typeof scope.contentVersion !== 'string' || !Array.isArray(scope.fragments) || scope.fragments.length !== 1) throw fail('INVALID_GRANT_SCOPE', 503);
    const decision = this.state(scope, userId, sessionId), now = this.now(), expiresAt = this.deadline(decision, now);
    const fragment = scope.fragments[0];
    if (typeof fragment.fragmentId !== 'string' || !Array.isArray(fragment.assetIds)) throw fail('INVALID_GRANT_SCOPE', 503);
    const claims = { v: 1, sub: userId, courseId, unitId, purpose, sessionId, contentVersion: scope.contentVersion,
      policyRevision: decision.policyRevision, membershipRevision: decision.membershipRevision, mode: decision.mode,
      fragmentIds: [fragment.fragmentId], assetIds: fragment.assetIds, issuedAt: now, expiresAt };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { grant: body + '.' + this.sign(body), headerName: 'X-Course-Grant', expiresAt, serverNow: now,
      contentVersion: scope.contentVersion, policyRevision: claims.policyRevision, membershipRevision: claims.membershipRevision,
      fragments: scope.fragments.map(({ fragmentId, cursor, itemIds, assetIds }) => ({ fragmentId, cursor, itemIds, assetIds })) };
  }
  verify(token, { userId, courseId, unitId, purpose, resourceType, resourceId }) {
    if (typeof token !== 'string' || token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw fail('INVALID_CONTENT_GRANT');
    const [body, signature] = token.split('.'), expected = this.sign(body);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw fail('INVALID_CONTENT_GRANT');
    let claims;
    try { claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw fail('INVALID_CONTENT_GRANT'); }
    const now = this.now();
    if (claims.v !== 1 || !userId || claims.sub !== userId || claims.courseId !== courseId || claims.unitId !== unitId ||
        !PURPOSES.has(purpose) || claims.purpose !== purpose || !Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) ||
        claims.issuedAt > now || claims.expiresAt <= now || claims.expiresAt - claims.issuedAt > 30000) throw fail('CONTENT_GRANT_EXPIRED_OR_MISMATCH');
    const resources = resourceType === 'fragment' ? claims.fragmentIds : resourceType === 'asset' ? claims.assetIds : null;
    if (!Array.isArray(resources) || !resources.includes(resourceId)) throw fail('CONTENT_GRANT_SCOPE_MISMATCH');
    const scope = this.resolveScope(courseId, unitId, { fragmentId: claims.fragmentIds[0] }, purpose);
    if (scope.contentVersion !== claims.contentVersion || scope.fragments.length !== 1 || scope.fragments[0].fragmentId !== claims.fragmentIds[0] ||
        (resourceType === 'asset' && !scope.fragments[0].assetIds.includes(resourceId))) throw fail('CONTENT_VERSION_CHANGED');
    // Always query current access, including cache hits and HEAD requests. Never renew a lease here.
    const decision = this.state(scope, userId, claims.sessionId);
    if (decision.mode !== claims.mode || decision.policyRevision !== claims.policyRevision || decision.membershipRevision !== claims.membershipRevision) throw fail('CONTENT_GRANT_REVOKED');
    this.deadline(decision, now);
    return { claims, scope, decision };
  }
}
module.exports = { ContentGrantService };
