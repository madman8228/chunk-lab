'use strict';
const crypto = require('node:crypto');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bad = (code, status = 503) => Object.assign(new Error(code), { code, status });

function createCourseAccessService({ db, registry, entitlements, usageMeter, membership, now = Date.now,
  isAuthenticatedAccount = userId => { void userId; return false; }, hasPublicDeck = deckId => { void deckId; return false; } }) {
  const latest = db.prepare('SELECT revision,access_level AS accessLevel FROM course_access_revisions WHERE course_id=? ORDER BY revision DESC LIMIT 1');
  function policy(course) {
    const row = latest.get(course.courseId);
    return row || { revision: 0, accessLevel: 'free' };
  }
  function metadata(courseId) {
    const course = registry.course(courseId);
    if (!course) throw bad('COURSE_NOT_FOUND', 404);
    return { course, policy: policy(course) };
  }
  function identity(courseId, unitId) {
    const course = metadata(courseId).course, unit = course.units.find(unit => unit.unitId === unitId);
    if (!unit) throw bad('UNIT_NOT_FOUND', 404);
    const deckId = require('./assessment-content').deckIdentity(courseId, unitId);
    return unit.recordIdentity || { deckId, generationScope: 'course:' + courseId, resumeIdentity: deckId };
  }
  function envelope(result, coursePolicy, userId) {
    return { ...result, serverNow: now(), policyRevision: coursePolicy.revision,
      membershipRevision: userId ? entitlements.revision(userId) : 0 };
  }
  function authorize(courseId, userId, sessionId) {
    const { course, policy: current } = metadata(courseId);
    if (current.accessLevel === 'free') return envelope({ allowed: true, reasonCode: 'FREE_COURSE', mode: 'free' }, current, userId);
    if (!isAuthenticatedAccount(userId)) return envelope({ allowed: false, reasonCode: 'AUTH_REQUIRED', status: 401 }, current, userId);
    const entitlement = entitlements.get(userId);
    if (entitlement.active) return envelope({ allowed: true, reasonCode: 'MEMBER_ACCESS', mode: 'member', endsAt: entitlement.endsAt }, current, userId);
    const active = usageMeter.reconcile(userId);
    if (active && active.courseId === course.courseId && active.sessionId === sessionId) {
      if (now() < active.lastSettledAt) return envelope({ allowed: false, reasonCode: 'CLOCK_ERROR', status: 503 }, current, userId);
      const trial = membership.getStatus(userId).trial;
      return envelope({ allowed: true, reasonCode: 'TRIAL_ACCESS', mode: 'trial', sessionId, sequence: active.sequence,
        remainingSeconds: trial.remainingSeconds, nextResetAt: trial.nextResetAt,
        leaseEndsAt: active.leaseEndsAt }, current, userId);
    }
    const trial = membership.getStatus(userId).trial;
    const codes = { disabled: 'TRIAL_DISABLED', expired: 'TRIAL_EXPIRED', closed_by_redemption: 'MEMBERSHIP_REQUIRED', daily_limit: 'TRIAL_DAILY_LIMIT' };
    return envelope({ allowed: false, status: 403, reasonCode: codes[trial.status] || 'SESSION_REQUIRED', nextResetAt: trial.nextResetAt }, current, userId);
  }
  function scope(userId, sessionId, payload) {
    if (!sessionId) return;
    db.prepare(`INSERT INTO course_learning_session_scopes(session_id,user_id,course_id,unit_id,asset_ids_json,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET unit_id=excluded.unit_id,asset_ids_json=excluded.asset_ids_json,updated_at=excluded.updated_at`)
      .run(sessionId, userId, payload.courseId, payload.unitId, JSON.stringify(payload.assetIds), now());
  }
  function read(courseId, unitId, cursor, userId, sessionId) {
    const decision = authorize(courseId, userId, sessionId);
    if (!decision.allowed) return decision;
    const loaded = registry.load(courseId, unitId, cursor);
    if (decision.mode === 'trial') scope(userId, sessionId, loaded.payload);
    return { ...decision, unit: loaded.payload };
  }
  const startTx = db.transaction((input, userId, decorate) => {
    const { courseId, unitId, requestId, itemId, takeover = false } = input;
    let cursor = input.cursor === undefined ? 0 : input.cursor;
    if (itemId !== undefined) {
      if (typeof itemId !== 'string' || !itemId || itemId.length > 160) throw bad('INVALID_ITEM', 400);
      const course = metadata(courseId).course;
      cursor = course.units.find(unit => unit.unitId === unitId)?.itemIds.indexOf(itemId) ?? -1;
      if (cursor < 0) throw bad('ITEM_NOT_FOUND', 404);
    }
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '') || typeof takeover !== 'boolean') throw bad('INVALID_REQUEST', 400);
    const current = metadata(courseId).policy;
    const payloadHash = digest({ courseId, unitId, cursor, ...(itemId === undefined ? {} : { itemId }), takeover });
    const prior = db.prepare('SELECT payload_hash,session_id AS sessionId FROM course_learning_start_receipts WHERE user_id=? AND request_id=?').get(userId, requestId);
    if (prior && prior.payload_hash !== payloadHash) throw bad('IDEMPOTENCY_CONFLICT', 409);
    // Preflight content and referenced assets before committing a new trial.
    const loaded = registry.load(courseId, unitId, cursor);
    for (const id of loaded.payload.assetIds) registry.asset(courseId, unitId, id);
    let result = authorize(courseId, userId, prior?.sessionId);
    if (!prior && current.accessLevel === 'member') {
      if (!isAuthenticatedAccount(userId)) return result;
      const started = usageMeter.start(userId, courseId, requestId, takeover);
      if (started.status !== 200) return envelope({ allowed: false, reasonCode: started.code, status: started.status,
        nextResetAt: started.nextResetAt, leaseEndsAt: started.leaseEndsAt }, current, userId);
      result = envelope({ allowed: true, reasonCode: started.mode === 'member' ? 'MEMBER_ACCESS' : 'TRIAL_ACCESS', ...started }, current, userId);
    }
    if (!result.allowed) return result;
    if (userId && !prior) db.prepare('INSERT INTO course_learning_start_receipts(user_id,request_id,payload_hash,session_id,created_at) VALUES(?,?,?,?,?)')
      .run(userId, requestId, payloadHash, result.sessionId || null, now());
    if (result.mode === 'trial') scope(userId, result.sessionId, loaded.payload);
    const response = { ...result, replay: !!prior, unit: loaded.payload };
    return decorate ? decorate(response) : response;
  });
  function start(input, userId, decorate) { return startTx.immediate(input || {}, userId, decorate); }
  function asset(courseId, unitId, assetId, userId, sessionId) {
    const decision = authorize(courseId, userId, sessionId);
    if (!decision.allowed) return decision;
    if (decision.mode === 'trial') {
      const approved = db.prepare('SELECT unit_id,asset_ids_json FROM course_learning_session_scopes WHERE session_id=? AND user_id=? AND course_id=?')
        .get(sessionId, userId, courseId);
      if (!approved || approved.unit_id !== unitId || !JSON.parse(approved.asset_ids_json).includes(assetId)) throw bad('ASSET_NOT_AUTHORIZED', 403);
    }
    return { ...decision, asset: registry.asset(courseId, unitId, assetId) };
  }
  function list() {
    const snapshot = registry.list();
    return { version: snapshot.version, courses: snapshot.courses.map(course => ({
      courseId: course.courseId, title: course.title, contentType: course.contentType,
      protectionReady: course.protectionReady, ...policy(course)
    })) };
  }
  function preview(changes, expectedVersion) {
    if (!Array.isArray(changes) || !changes.length || changes.length > 500 || new Set(changes.map(change => change.courseId)).size !== changes.length) throw bad('INVALID_CHANGES', 400);
    const snapshot = registry.list();
    if (snapshot.version !== expectedVersion) throw bad('REGISTRY_CHANGED', 409);
    const proposed = new Map(snapshot.courses.map(course => [course.courseId, policy(course).accessLevel]));
    for (const change of changes) {
      const course = snapshot.courses.find(item => item.courseId === change.courseId);
      if (!course || !Number.isSafeInteger(change.baseRevision) || !['free', 'member'].includes(change.accessLevel)) throw bad('INVALID_CHANGES', 400);
      if (policy(course).revision !== change.baseRevision) throw bad('REVISION_CONFLICT', 409);
      if (change.accessLevel === 'member' && !course.protectionReady) throw bad('CONTENT_PROTECTION_REQUIRED', 422);
      proposed.set(course.courseId, change.accessLevel);
    }
    const conflicts = [];
    for (const course of snapshot.courses.filter(item => proposed.get(item.courseId) === 'member')) {
      for (const deckId of course.legacyDeckIds || []) {
        if (hasPublicDeck(deckId)) conflicts.push({ courseId: course.courseId, publicDeckId: deckId });
      }
      for (const unit of course.units || []) {
        registry.load(course.courseId, unit.unitId, 0);
        if (hasPublicDeck(unit.contentRef.id)) conflicts.push({ courseId: course.courseId, publicDeckId: unit.contentRef.id });
        for (const other of snapshot.courses.filter(item => item.courseId !== course.courseId && proposed.get(item.courseId) === 'free')) {
          for (const freeUnit of other.units || []) {
            const sameSource = freeUnit.contentRef.type === unit.contentRef.type && freeUnit.contentRef.id === unit.contentRef.id ||
              freeUnit.file && unit.file && registry.file(freeUnit.file) === registry.file(unit.file);
            if (sameSource &&
                (freeUnit.itemIds.includes('*') || freeUnit.itemIds.some(id => unit.itemIds.includes(id)))) {
              conflicts.push({ courseId: course.courseId, conflictingCourseId: other.courseId, contentRef: unit.contentRef });
            }
          }
        }
      }
    }
    return { allowed: conflicts.length === 0, version: snapshot.version, conflicts, changes };
  }
  function publish(input, adminId) {
    const { changes, registryVersion, requestId, reason = '' } = input || {};
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '') || typeof reason !== 'string' || reason.length > 200) throw bad('INVALID_REQUEST', 400);
    const payloadHash = digest({ changes, registryVersion, reason });
    return db.transaction(() => {
      const receipt = db.prepare('SELECT payload_hash,result_json FROM membership_admin_mutation_receipts WHERE admin_id=? AND request_id=?').get(adminId, requestId);
      if (receipt) {
        if (receipt.payload_hash !== payloadHash) throw bad('IDEMPOTENCY_CONFLICT', 409);
        return { ...JSON.parse(receipt.result_json), replay: true };
      }
      const inspected = preview(changes, registryVersion);
      if (!inspected.allowed) throw Object.assign(bad('PUBLIC_CONTENT_CONFLICT', 422), { conflicts: inspected.conflicts });
      const insert = db.prepare('INSERT INTO course_access_revisions(course_id,revision,access_level,registry_version,changed_by,reason,created_at) VALUES(?,?,?,?,?,?,?)');
      for (const change of changes) insert.run(change.courseId, change.baseRevision + 1, change.accessLevel, registryVersion, adminId, reason, now());
      const result = { changed: changes.map(change => ({ courseId: change.courseId, revision: change.baseRevision + 1, accessLevel: change.accessLevel })) };
      db.prepare('INSERT INTO membership_admin_audit(admin_id,action,target_id,details_json,created_at) VALUES(?,?,?,?,?)')
        .run(adminId, 'course_access_published', registryVersion, JSON.stringify(result), now());
      db.prepare('INSERT INTO membership_admin_mutation_receipts(admin_id,request_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)')
        .run(adminId, requestId, payloadHash, JSON.stringify(result), now());
      return result;
    }).immediate();
  }
  function catalog() { return registry.publicCourses().map(course => {
    const current = policy(course);
    return { ...course, accessLevel: current.accessLevel, policyRevision: current.revision };
  }); }
  function catalogResources() { return catalog().map(course => ({ resourceId: 'course:' + course.courseId,
    courseId: course.courseId, kind: 'course', title: course.title, description: '', origin: 'builtin', visibility: 'public',
    available: true, sourceRefs: [{ type: course.contentType === 'expression' ? 'expression-course' : 'protected-course', id: course.courseId }], facets: {},
    activities: [course.contentType === 'expression' ? 'expression' : 'chunks'],
    accessLevel: course.accessLevel, metadataRevision: course.policyRevision })); }
  return Object.freeze({ authorize, read, start, asset, list, preview, publish, catalog, catalogResources, identity });
}
module.exports = { createCourseAccessService };
