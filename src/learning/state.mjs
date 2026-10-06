const DAY = 86_400_000;
/** @param {any[]} items @returns {any[]} */
const validEvents = (items) => (Array.isArray(items) ? items : []).filter((event) => event && event.id && Number.isFinite(event.at));
const stableOrder = (left, right) => left.at - right.at || String(left.id).localeCompare(String(right.id));
function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}

export function mergeLearningEvidence(...sources) {
  const byId = new Map();
  sources.flat().forEach((event) => {
    if (!event || typeof event !== 'object' || !event.id || !Number.isFinite(event.at)) return;
    const id = String(event.id);
    const existing = byId.get(id);
    if (!existing) { byId.set(id, { ...event, id }); return; }
    // Event IDs are immutable. If two replicas disagree, resolve identically in either merge order and retain adverse evidence.
    const existingFailed = existing.ok === false || existing.assisted === true;
    const eventFailed = event.ok === false || event.assisted === true;
    const winner = existingFailed !== eventFailed ? (existingFailed ? existing : event)
      : (stableJson(existing) <= stableJson(event) ? existing : event);
    byId.set(id, { ...winner, id });
  });
  return [...byId.values()].sort(stableOrder);
}

/** @param {any} evidence @param {string} fingerprint @returns {any[]} */
function usableEvidence(evidence, fingerprint) {
  return validEvents(evidence).filter((event) => !fingerprint || event.contentFingerprint === fingerprint)
    .sort(stableOrder);
}

/** @param {any} options */
export function resolveLearningState(options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  /** @type {any} */
  const stat = options.stat && typeof options.stat === 'object' ? options.stat : {};
  /** @type {any} */
  const record = stat.learningV1 && typeof stat.learningV1 === 'object' ? stat.learningV1 : {};
  const familiarity = options.familiarity && typeof options.familiarity === 'object' ? options.familiarity : null;
  /** @type {any[]} */
  const evidence = usableEvidence(record.evidence, options.contentFingerprint);
  const lastExposureAt = Math.max(Number(record.lastExposureAt) || 0, Number(record.baselineAt) || 0,
    ...evidence.filter((event) => event.type === 'practice' || event.assisted).map((event) => event.at));
  /** @type {any[]} */
  const assessments = evidence.filter((event) => event.type === 'assessment' && event.ok === true && !event.assisted && event.firstAttempt === true && event.sessionId);
  /** @type {any[]} */
  const failures = evidence.filter((event) => (event.type === 'assessment' || event.type === 'practice') && (event.ok === false || event.assisted === true));
  /** @type {any} */
  let initial = null;
  /** @type {any} */
  let verified = null;
  /** @type {any} */
  let awaiting = null;
  assessments.forEach((event) => {
    if (event.stage === 'initial') {
      initial = event;
      verified = null;
      awaiting = event;
      return;
    }
    if (event.stage === 'delayed' || event.stage === 'maintenance') {
      if (!initial || event.sessionId === initial.sessionId || event.at - initial.at < 7 * DAY || (event.eligibleAt && event.at < event.eligibleAt)) return;
      verified = event;
      awaiting = null;
    }
  });
  const latestFailure = failures[failures.length - 1] || null;
  if (latestFailure && (!verified || latestFailure.at >= verified.at)) {
    verified = null;
    awaiting = null;
  }
  const needsRevalidation = !!(latestFailure && (!verified || latestFailure.at >= verified.at)
    && assessments.some((event) => event.at < latestFailure.at && event.stage !== 'initial'));
  const familiarityActive = !!familiarity;
  const phase = record.phase || (Number(record.dueAt) && Number(record.dueAt) <= now ? 'review' : (lastExposureAt ? 'learning' : 'new'));
  const primary = phase === 'relearning' || needsRevalidation ? 'reinforce'
    : verified ? 'mastered'
      : awaiting ? 'initialPassed'
        : familiarityActive ? 'familiar'
          : lastExposureAt ? 'learning' : 'new';
  return {
    primary,
    familiar: familiarityActive,
    verifiedMastered: !!verified,
    initialPassed: !!awaiting,
    needsRevalidation,
    phase,
    dueAt: Number(record.dueAt) || 0,
    lastExposureAt,
    masteredAt: verified ? verified.at : 0,
    initialPassedAt: awaiting ? awaiting.at : (initial ? initial.at : 0),
    evidence,
  };
}

export function applyLearningEvent(learning, event) {
  const current = learning && typeof learning === 'object' ? learning : { version: 1, evidence: [] };
  const added = mergeLearningEvidence(current.evidence, event ? [event] : []);
  return { ...current, version: 1, evidence: added,
    lastExposureAt: event && (event.type === 'practice' || event.type === 'exposure' || event.type === 'assessment' || event.assisted) ? Math.max(Number(current.lastExposureAt) || 0, event.at || 0) : (Number(current.lastExposureAt) || 0) };
}

export function createLearningEvent(options = {}) {
  const id = typeof options.makeId === 'function' ? options.makeId() : '';
  if (!id || !options.key || !Number.isFinite(options.at)) throw new TypeError('learning event requires id, key, and timestamp');
  return { id: String(id), key: String(options.key), sessionId: String(options.sessionId || ''), at: options.at,
    type: options.type || 'practice', mode: options.mode || 'unknown', contentFingerprint: String(options.contentFingerprint || ''),
    policyVersion: Number(options.policyVersion) || 1, ok: options.ok === true, assisted: options.assisted === true,
    firstAttempt: options.firstAttempt === true, eligibleAt: Number(options.eligibleAt) || 0,
    ...(options.stage ? { stage: options.stage } : {}) };
}

export const LEARNING_DAY_MS = DAY;
