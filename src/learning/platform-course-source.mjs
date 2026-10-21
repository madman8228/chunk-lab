const failure = code => Object.assign(new Error(code), { code });

/** Reads immutable fragments using short grants; injected session controller retains trial ownership. */
export class PlatformCourseSource {
  constructor({ client, controller, fetchResource, newRequestId, imageCache, captureImageScope, monotonicNow = () => performance.now() }) {
    this.client = client; this.controller = controller; this.fetchResource = fetchResource;
    this.newRequestId = newRequestId; this.now = monotonicNow; this.grants = new Map(); this.epoch = 0;
    this.imageCache = imageCache; this.captureImageScope = captureImageScope;
  }
  remember(result, sentAt, cursor = result.fragments?.[0]?.cursor) {
    if (!result.grant || result.headerName !== 'X-Course-Grant' || !Number.isFinite(result.expiresAt) || !Number.isFinite(result.serverNow) || result.fragments?.length !== 1) throw failure('CONTENT_GRANT_INVALID');
    if (this.contentVersion && result.contentVersion !== this.contentVersion) throw failure('CONTENT_VERSION_CHANGED');
    const fragment = result.fragments[0];
    const { unit, session, ...metadata } = result; void unit; void session;
    this.grants.set(cursor, { ...metadata, fragment, deadline: sentAt + Math.min(30000, Math.max(0, result.expiresAt - result.serverNow)) });
    while (this.grants.size > 2) this.grants.delete(this.grants.keys().next().value);
  }
  async open(reference, options = {}) {
    this.grants.clear(); this.contentVersion = null; this.reference = reference; this.purpose = options.purpose || 'practice';
    const epoch = ++this.epoch, sentAt = this.now();
    const result = await this.controller.start({ courseId: reference.courseId, unitId: reference.unitId, cursor: options.cursor || 0, purpose: this.purpose });
    if (epoch !== this.epoch) throw failure('SESSION_CHANGED');
    this.remember(result, sentAt, result.unit?.cursor); this.contentVersion = result.contentVersion;
    return { batch: result.unit, contentVersion: result.contentVersion, recordIdentity: result.unit.recordIdentity };
  }
  checkAdvance(cursor) { return this.controller.canAdvance() && this.now() < (this.grants.get(cursor)?.deadline || 0); }
  canPrefetch() { return this.controller.canAdvance() && Math.max(0, ...[...this.grants.values()].map(grant => grant.deadline - this.now())) >= 5000; }
  async grantFor(cursor) {
    if (!this.controller.canAdvance()) throw failure('AUTHORIZATION_EXPIRED');
    let grant = this.grants.get(cursor);
    if (grant && this.now() < grant.deadline) return grant;
    const epoch = this.epoch, sentAt = this.now();
    const result = await this.client.contentGrant({ ...this.reference, cursor, purpose: this.purpose, sessionId: this.controller.current?.sessionId, requestId: this.newRequestId() });
    if (epoch !== this.epoch) throw failure('SESSION_CHANGED');
    this.remember(result, sentAt, cursor); grant = this.grants.get(cursor);
    if (!grant || !this.checkAdvance(cursor)) throw failure('AUTHORIZATION_EXPIRED');
    return grant;
  }
  async authorizeCached(cursor) { await this.grantFor(cursor); }
  headers(grant) {
    return { 'X-Course-Grant': grant.grant, 'X-Course-Id': this.reference.courseId, 'X-Course-Unit': this.reference.unitId, 'X-Course-Purpose': this.purpose };
  }
  async loadBatch(cursor) {
    const epoch = this.epoch, grant = await this.grantFor(cursor);
    const batch = await this.fetchResource('/api/course-fragments/' + encodeURIComponent(grant.fragment.fragmentId), this.headers(grant), 'json');
    if (epoch !== this.epoch || !this.checkAdvance(cursor)) throw failure('AUTHORIZATION_EXPIRED');
    batch.items = batch.items.slice(cursor - batch.cursor); batch.cursor = cursor;
    return { batch, contentVersion: grant.contentVersion };
  }
  async loadAssets(assetId, cursor) {
    const epoch = this.epoch, grant = await this.grantFor(cursor);
    if (!grant.fragment.assetIds.includes(assetId)) throw failure('ASSET_NOT_AUTHORIZED');
    const guard = () => { if (epoch !== this.epoch || !this.checkAdvance(cursor)) throw failure('AUTHORIZATION_EXPIRED'); };
    const download = () => this.fetchResource('/api/course-assets/' + encodeURIComponent(assetId), this.headers(grant), 'blob');
    const result = this.imageCache ? await this.imageCache.load({ scope: this.captureImageScope(), courseId: this.reference.courseId,
      contentVersion: grant.contentVersion, assetId, download, guard }) : await download();
    guard();
    return result;
  }
  async pause() { this.grants.clear(); await this.controller.pause(); }
  dispose() {
    const epoch = ++this.epoch; this.grants.clear();
    this.controller.pause().catch(() => {}).finally(() => { if (epoch === this.epoch) this.controller.reset(); });
  }
}
