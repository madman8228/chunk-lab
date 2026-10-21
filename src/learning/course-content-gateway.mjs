const failure = code => Object.assign(new Error(code), { code });

/** One content boundary for native activities; sources own authorization, never grading or records. */
export class CourseContentGateway {
  constructor({ sources, captureScope }) {
    this.sources = sources; this.captureScope = captureScope;
    this.scope = captureScope(); this.epoch = 0; this.source = null; this.course = null;
    this.cache = new Map(); this.pending = new Map(); this.currentCursor = null;
  }
  guard(epoch = this.epoch) {
    if (epoch !== this.epoch) throw failure('SESSION_CHANGED');
    if (this.scope !== this.captureScope()) {
      this.dispose(); throw failure('SESSION_CHANGED');
    }
  }
  resolve(reference) {
    this.guard();
    const source = this.sources[reference?.origin];
    if (!source) throw failure('UNSUPPORTED_COURSE_SOURCE');
    return source;
  }
  async open(reference, options = {}) {
    const source = this.resolve(reference);
    if (this.source) await this.pause();
    this.epoch++; this.cache.clear(); this.pending.clear(); this.currentCursor = null;
    this.source = source; this.course = { ...reference };
    const epoch = this.epoch;
    try {
      const first = await source.open(reference, options); this.guard(epoch);
      if (!first?.batch || !first.contentVersion || !first.recordIdentity) throw failure('CONTENT_CONTRACT_INVALID');
      this.contentVersion = first.contentVersion; this.recordIdentity = Object.freeze({ ...first.recordIdentity });
      this.put(first.batch); this.currentCursor = first.batch.cursor;
      return { ...first, batch: structuredClone(first.batch), recordIdentity: this.recordIdentity };
    } catch (error) { if (epoch === this.epoch) this.dispose(); throw error; }
  }
  put(batch) {
    if (!Number.isSafeInteger(batch?.cursor) || !Array.isArray(batch.items) || !batch.items.length ||
        batch.items.length > (batch.contentType === 'image-text' ? 1 : 10)) throw failure('CONTENT_BATCH_INVALID');
    this.cache.set(batch.cursor, structuredClone(batch));
    this.trim();
  }
  trim() {
    // Current + one next batch only. Never cache an entire course or write to browser persistence.
    const current = this.cache.get(this.currentCursor), next = current?.nextCursor;
    for (const cursor of this.cache.keys()) {
      if (this.cache.size <= 2) break;
      if (cursor !== this.currentCursor && cursor !== next) this.cache.delete(cursor);
    }
  }
  checkAdvance() {
    this.guard();
    return !!this.source && !!this.cache.get(this.currentCursor) && this.source.checkAdvance(this.currentCursor);
  }
  async loadBatch(cursor, { prefetch = false } = {}) {
    this.guard(); if (!this.source || !this.contentVersion) throw failure('COURSE_NOT_OPEN');
    const epoch = this.epoch, source = this.source;
    if (prefetch) {
      const current = this.cache.get(this.currentCursor);
      if (!current || current.nextCursor !== cursor || !this.checkAdvance() || !source.canPrefetch()) return null;
    }
    const cached = this.cache.get(cursor);
    if (cached) {
      await source.authorizeCached(cursor); this.guard(epoch);
      if (!prefetch) { this.currentCursor = cursor; this.trim(); }
      return structuredClone(cached);
    }
    if (!this.pending.has(cursor)) {
      const promise = (async () => {
        const result = await source.loadBatch(cursor); this.guard(epoch);
        if (result.contentVersion !== this.contentVersion) throw failure('CONTENT_VERSION_CHANGED');
        if (result.batch.cursor !== cursor) throw failure('CONTENT_CURSOR_MISMATCH');
        if (!prefetch) this.currentCursor = cursor;
        this.put(result.batch); return result.batch;
      })();
      this.pending.set(cursor, promise);
    }
    let batch;
    try { batch = await this.pending.get(cursor); } finally { if (epoch === this.epoch) this.pending.delete(cursor); }
    this.guard(epoch);
    if (!prefetch) { this.currentCursor = cursor; this.trim(); }
    return structuredClone(batch);
  }
  async loadAssets(assetId) {
    this.guard();
    const batch = this.cache.get(this.currentCursor), epoch = this.epoch;
    if (!batch?.assetIds?.includes(assetId)) throw failure('ASSET_NOT_AUTHORIZED');
    const result = await this.source.loadAssets(assetId, this.currentCursor); this.guard(epoch); return result;
  }
  async pause() { this.guard(); if (this.source) await this.source.pause(); }
  dispose() {
    this.epoch++; this.cache.clear(); this.pending.clear(); this.currentCursor = null;
    const source = this.source; this.source = null; this.course = null; this.contentVersion = null; this.recordIdentity = null;
    source?.dispose();
  }
}

/** Owner-controlled personal content implements the same interface without member/trial calls. */
export class PersonalCourseSource {
  constructor({ repository, captureScope }) { this.repository = repository; this.captureScope = captureScope; this.active = false; }
  guard() { if (!this.active || this.scope !== this.captureScope()) throw failure('SESSION_CHANGED'); }
  async open(reference, options) {
    this.scope = this.captureScope(); this.active = true; this.reference = reference;
    const result = await this.repository.open(reference, options); this.guard(); return result;
  }
  checkAdvance() { return this.active && this.scope === this.captureScope(); }
  canPrefetch() { return this.checkAdvance(); }
  async authorizeCached() { this.guard(); }
  async loadBatch(cursor) { this.guard(); const result = await this.repository.loadBatch(this.reference, cursor); this.guard(); return result; }
  async loadAssets(id) { this.guard(); const result = await this.repository.loadAssets(this.reference, id); this.guard(); return result; }
  async pause() { this.active = false; }
  dispose() { this.active = false; this.reference = null; }
}
