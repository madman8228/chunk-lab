import { LEARNING_DAY_MS, createLearningEvent, mergeLearningEvidence } from './state.mjs';
import { getExposureAt } from './schedule-policy.mjs';

export const ASSESSMENT_POLICY_VERSION = 1;
export const INITIAL_WAIT_MS = LEARNING_DAY_MS;
export const DELAYED_WAIT_MS = 7 * LEARNING_DAY_MS;

function normalize(text) { return String(text == null ? '' : text).trim().toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' '); }

export function fingerprintAssessmentItem(item = {}) {
  const source = item._contentRef && item._contentRef.url
    ? { source: String(item._contentRef.url), cid: String(item.cid || '') }
    : { prompt: normalize(item.zh || item.translation || item.prompt || ''), chunks: Array.isArray(item.chunks) ? item.chunks.map(normalize) : [],
      alts: Array.isArray(item.alts) ? item.alts.map((list) => Array.isArray(list) ? list.map(normalize).sort() : []).slice() : [] };
  const normalized = JSON.stringify(source);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) hash = Math.imul(hash ^ normalized.charCodeAt(index), 0x01000193) >>> 0;
  return 'v1-' + hash.toString(16).padStart(8, '0');
}

export function getAssessmentEligibility(item, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const stat = item && item.stat || {};
  const learning = stat.learningV1 || {};
  const fingerprint = fingerprintAssessmentItem(item || {});
  const evidence = mergeLearningEvidence(learning.evidence).filter((event) => event.contentFingerprint === fingerprint);
  const latestInitial = evidence.filter((event) => event.type === 'assessment' && event.stage === 'initial' && event.ok && !event.assisted).at(-1);
  const latestDelayed = evidence.filter((event) => event.type === 'assessment' && ['delayed', 'maintenance'].includes(event.stage) && event.ok && !event.assisted).at(-1);
  const latestFailure = evidence.filter((event) => (event.type === 'assessment' || event.type === 'practice')
    && (event.ok === false || event.assisted === true) && (!latestInitial || event.at >= latestInitial.at)).at(-1);
  const exposureAt = getExposureAt(stat, learning);
  const familiarAt = Number(item && item.familiarity && item.familiarity.markedAt) || 0;
  const baselineAt = exposureAt || familiarAt || (options.firstObservedAt || now);
  const initialAt = Math.max(baselineAt, exposureAt);
  if (!item || !item.key || !Array.isArray(item.chunks) || !item.chunks.length || !(item.zh || item.translation || item.prompt)
    || item.chunks.some((chunk) => !String(chunk || '').trim())) {
    return { eligible: false, reason: 'missing-content', stage: null, eligibleAt: 0, fingerprint };
  }
  if (latestFailure) {
    const eligibleAt = Math.max(latestFailure.at + INITIAL_WAIT_MS, exposureAt + INITIAL_WAIT_MS);
    return { eligible: now >= eligibleAt, reason: now >= eligibleAt ? '' : 'retry-after-failure', stage: 'initial', eligibleAt, fingerprint };
  }
  if (!latestInitial) {
    const eligibleAt = initialAt + INITIAL_WAIT_MS;
    return { eligible: now >= eligibleAt, reason: now >= eligibleAt ? '' : 'wait-after-exposure', stage: 'initial', eligibleAt, fingerprint };
  }
  if (latestDelayed && latestDelayed.at >= latestInitial.at) {
    const eligibleAt = Math.max(latestDelayed.at + DELAYED_WAIT_MS, exposureAt + INITIAL_WAIT_MS);
    return { eligible: now >= eligibleAt, reason: now >= eligibleAt ? '' : 'maintenance-due', stage: 'maintenance', eligibleAt, fingerprint };
  }
  const eligibleAt = Math.max(latestInitial.at + DELAYED_WAIT_MS, exposureAt + INITIAL_WAIT_MS);
  return { eligible: now >= eligibleAt, reason: now >= eligibleAt ? '' : 'wait-for-delayed-retest', stage: 'delayed', eligibleAt, fingerprint };
}

export function createAssessmentSession(items, options = {}) {
  if (!Array.isArray(items) || !items.length) throw new TypeError('assessment requires at least one eligible item');
  if (typeof options.makeId !== 'function') throw new TypeError('assessment requires an id generator');
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const sessionId = String(options.makeId());
  if (!sessionId) throw new TypeError('assessment session id is required');
  const sessionItems = items.map((item) => {
    const eligibility = getAssessmentEligibility(item, { now });
    if (!eligibility.eligible) throw new Error('assessment item is not eligible: ' + eligibility.reason);
    return { key: String(item.key), fingerprint: eligibility.fingerprint, prompt: String(item.zh || item.translation || item.prompt),
      chunks: item.chunks.map(String), alts: (item.alts || []).map((list) => Array.isArray(list) ? list.map(String) : []),
      stage: eligibility.stage, eligibleAt: eligibility.eligibleAt, submitted: false, answer: null, correct: false };
  });
  return { id: sessionId, revision: 1, policyVersion: ASSESSMENT_POLICY_VERSION, status: 'active', createdAt: now,
    items: sessionItems, currentIndex: 0, completedAt: 0, passedCount: 0, threshold: 0.8 };
}

export function submitAssessmentAnswer(session, itemIndex, answers, options = {}) {
  if (!session || session.status !== 'active') throw new Error('assessment session is not active');
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= session.items.length) throw new RangeError('invalid assessment item index');
  const current = session.items[itemIndex];
  if (current.submitted) return session;
  const values = Array.isArray(answers) ? answers : [];
  const judge = typeof options.judge === 'function' ? options.judge : (answer, correct, alternatives) => [correct].concat(alternatives || []).some((candidate) => normalize(answer) === normalize(candidate));
  const correct = current.chunks.every((chunk, index) => judge(values[index], chunk, current.alts[index]));
  const items = session.items.map((item, index) => index === itemIndex ? { ...item, submitted: true, answer: values.map((value) => String(value == null ? '' : value)), correct } : item);
  const nextIndex = items.findIndex((item, index) => index > itemIndex && !item.submitted);
  return { ...session, revision: session.revision + 1, items, currentIndex: nextIndex < 0 ? session.items.length : nextIndex };
}

export function finalizeAssessment(session, options = {}) {
  if (!session || session.status !== 'active') throw new Error('assessment session is not active');
  if (session.items.some((item) => !item.submitted)) throw new Error('all items must be submitted before finalizing');
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const events = session.items.map((item) => createLearningEvent({ makeId: options.makeId, key: item.key, sessionId: session.id, at: now,
    type: 'assessment', mode: 'typing', contentFingerprint: item.fingerprint, policyVersion: session.policyVersion,
    ok: item.correct, assisted: false, firstAttempt: true, eligibleAt: item.eligibleAt, stage: item.stage }));
  const passedCount = session.items.filter((item) => item.correct).length;
  const passed = session.items.length > 0 && passedCount / session.items.length >= session.threshold;
  return { session: { ...session, revision: session.revision + 1, status: 'completed', completedAt: now, passedCount },
    passed, passedCount, total: session.items.length, events };
}
