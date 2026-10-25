// @ts-nocheck Generated CommonJS bundle; source modules are checked directly.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/learning-engine-entry.mjs
var learning_engine_entry_exports = {};
__export(learning_engine_entry_exports, {
  ASSESSMENT_POLICY_VERSION: () => ASSESSMENT_POLICY_VERSION,
  DELAYED_WAIT_MS: () => DELAYED_WAIT_MS,
  FAMILIAR_DELAY_MS: () => FAMILIAR_DELAY_MS,
  INITIAL_WAIT_MS: () => INITIAL_WAIT_MS,
  LEARNING_DAY_MS: () => LEARNING_DAY_MS,
  RELEARN_DELAY_MS: () => RELEARN_DELAY_MS,
  applyLearningEvent: () => applyLearningEvent,
  buildSentenceReviewModel: () => buildSentenceReviewModel,
  createAssessmentSession: () => createAssessmentSession,
  createLearningEvent: () => createLearningEvent,
  finalizeAssessment: () => finalizeAssessment,
  fingerprintAssessmentItem: () => fingerprintAssessmentItem,
  getAssessmentEligibility: () => getAssessmentEligibility,
  getExposureAt: () => getExposureAt,
  mergeLearningEvidence: () => mergeLearningEvidence,
  reducePracticeEvents: () => reducePracticeEvents,
  resolveLearningState: () => resolveLearningState,
  resolveMistakeState: () => resolveMistakeState,
  scheduleFamiliarity: () => scheduleFamiliarity,
  scheduleLearningResult: () => scheduleLearningResult,
  selectReviewBatch: () => selectReviewBatch,
  submitAssessmentAnswer: () => submitAssessmentAnswer
});
module.exports = __toCommonJS(learning_engine_entry_exports);

// src/learning/state.mjs
var DAY = 864e5;
var validEvents = (items) => (Array.isArray(items) ? items : []).filter((event) => event && event.id && Number.isFinite(event.at));
var stableOrder = (left, right) => left.at - right.at || String(left.id).localeCompare(String(right.id));
function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  const encoded = JSON.stringify(value);
  return encoded === void 0 ? String(value) : encoded;
}
function mergeLearningEvidence(...sources) {
  const byId = /* @__PURE__ */ new Map();
  sources.flat().forEach((event) => {
    if (!event || typeof event !== "object" || !event.id || !Number.isFinite(event.at)) return;
    const id = String(event.id);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...event, id });
      return;
    }
    const existingFailed = existing.ok === false || existing.assisted === true;
    const eventFailed = event.ok === false || event.assisted === true;
    const winner = existingFailed !== eventFailed ? existingFailed ? existing : event : stableJson(existing) <= stableJson(event) ? existing : event;
    byId.set(id, { ...winner, id });
  });
  return [...byId.values()].sort(stableOrder);
}
function usableEvidence(evidence, fingerprint) {
  return validEvents(evidence).filter((event) => !fingerprint || event.contentFingerprint === fingerprint).sort(stableOrder);
}
function resolveLearningState(options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const stat = options.stat && typeof options.stat === "object" ? options.stat : {};
  const record = stat.learningV1 && typeof stat.learningV1 === "object" ? stat.learningV1 : {};
  const familiarity = options.familiarity && typeof options.familiarity === "object" ? options.familiarity : null;
  const evidence = usableEvidence(record.evidence, options.contentFingerprint);
  const lastExposureAt = Math.max(
    Number(record.lastExposureAt) || 0,
    Number(record.baselineAt) || 0,
    ...evidence.filter((event) => event.type === "practice" || event.assisted).map((event) => event.at)
  );
  const assessments = evidence.filter((event) => event.type === "assessment" && event.ok === true && !event.assisted && event.firstAttempt === true && event.sessionId);
  const failures = evidence.filter((event) => (event.type === "assessment" || event.type === "practice") && (event.ok === false || event.assisted === true));
  let initial = null;
  let verified = null;
  let awaiting = null;
  assessments.forEach((event) => {
    if (event.stage === "initial") {
      initial = event;
      verified = null;
      awaiting = event;
      return;
    }
    if (event.stage === "delayed" || event.stage === "maintenance") {
      if (!initial || event.sessionId === initial.sessionId || event.at - initial.at < 7 * DAY || event.eligibleAt && event.at < event.eligibleAt) return;
      verified = event;
      awaiting = null;
    }
  });
  const latestFailure = failures[failures.length - 1] || null;
  if (latestFailure && (!verified || latestFailure.at >= verified.at)) {
    verified = null;
    awaiting = null;
  }
  const needsRevalidation = !!(latestFailure && (!verified || latestFailure.at >= verified.at) && assessments.some((event) => event.at < latestFailure.at && event.stage !== "initial"));
  const familiarityActive = !!familiarity;
  const phase = record.phase || (Number(record.dueAt) && Number(record.dueAt) <= now ? "review" : lastExposureAt ? "learning" : "new");
  const primary = phase === "relearning" || needsRevalidation ? "reinforce" : verified ? "mastered" : awaiting ? "initialPassed" : familiarityActive ? "familiar" : lastExposureAt ? "learning" : "new";
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
    initialPassedAt: awaiting ? awaiting.at : initial ? initial.at : 0,
    evidence
  };
}
function applyLearningEvent(learning, event) {
  const current = learning && typeof learning === "object" ? learning : { version: 1, evidence: [] };
  const added = mergeLearningEvidence(current.evidence, event ? [event] : []);
  return {
    ...current,
    version: 1,
    evidence: added,
    lastExposureAt: event && (event.type === "practice" || event.type === "exposure" || event.type === "assessment" || event.assisted) ? Math.max(Number(current.lastExposureAt) || 0, event.at || 0) : Number(current.lastExposureAt) || 0
  };
}
function createLearningEvent(options = {}) {
  const id = typeof options.makeId === "function" ? options.makeId() : "";
  if (!id || !options.key || !Number.isFinite(options.at)) throw new TypeError("learning event requires id, key, and timestamp");
  return {
    id: String(id),
    key: String(options.key),
    sessionId: String(options.sessionId || ""),
    at: options.at,
    type: options.type || "practice",
    mode: options.mode || "unknown",
    contentFingerprint: String(options.contentFingerprint || ""),
    policyVersion: Number(options.policyVersion) || 1,
    ok: options.ok === true,
    assisted: options.assisted === true,
    firstAttempt: options.firstAttempt === true,
    eligibleAt: Number(options.eligibleAt) || 0,
    ...typeof options.timeZone === "string" && options.timeZone ? { timeZone: options.timeZone } : {},
    ...options.stage ? { stage: options.stage } : {}
  };
}
var LEARNING_DAY_MS = DAY;

// src/learning/schedule-policy.mjs
var RELEARN_DELAY_MS = 10 * 60 * 1e3;
var FAMILIAR_DELAY_MS = 3 * LEARNING_DAY_MS;
function scheduleLearningResult(previous = {}, result = {}, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const record = previous && typeof previous === "object" ? previous : {};
  const dueAt = Number(record.dueAt) || 0;
  const isDue = !dueAt || dueAt <= now;
  if (!result.ok || result.assisted) {
    const reset = options.srs && typeof options.srs.recordResult === "function" ? options.srs.recordResult(record, false, now) : { ...record, interval: 1, repetition: 0 };
    return { ...record, ...reset, version: 1, phase: "relearning", dueAt: now + RELEARN_DELAY_MS, lastExposureAt: now };
  }
  if (result.earlyPractice && !isDue) {
    return { ...record, version: 1, phase: record.phase || "review", dueAt, lastExposureAt: now };
  }
  const srs = options.srs;
  if (!srs || typeof srs.recordResult !== "function") throw new TypeError("SRS scheduler is required for a due successful review");
  const next = srs.recordResult(record, true, now);
  return { ...record, ...next, version: 1, phase: "review", lastExposureAt: now };
}
function scheduleFamiliarity(previous = {}, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const record = previous && typeof previous === "object" ? previous : {};
  if (Number(record.dueAt)) return { ...record, version: 1 };
  const markedAt = Number(options.markedAt) || now;
  return { ...record, version: 1, phase: "review", dueAt: markedAt + FAMILIAR_DELAY_MS };
}
function getExposureAt(stat = {}, learning = {}) {
  return Math.max(Number(learning.lastExposureAt) || 0, Number(learning.baselineAt) || 0, Number(stat.lastAt) || 0);
}

// src/learning/assessment.mjs
var ASSESSMENT_POLICY_VERSION = 1;
var INITIAL_WAIT_MS = LEARNING_DAY_MS;
var DELAYED_WAIT_MS = 7 * LEARNING_DAY_MS;
function normalize(text) {
  return String(text == null ? "" : text).trim().toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, "").replace(/\s+/g, " ");
}
function fingerprintAssessmentItem(item = {}) {
  const source = item._contentRef && item._contentRef.url ? { source: String(item._contentRef.url), cid: String(item.cid || "") } : {
    prompt: normalize(item.zh || item.translation || item.prompt || ""),
    chunks: Array.isArray(item.chunks) ? item.chunks.map(normalize) : [],
    alts: Array.isArray(item.alts) ? item.alts.map((list) => Array.isArray(list) ? list.map(normalize).sort() : []).slice() : []
  };
  const normalized = JSON.stringify(source);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) hash = Math.imul(hash ^ normalized.charCodeAt(index), 16777619) >>> 0;
  return "v1-" + hash.toString(16).padStart(8, "0");
}
function getAssessmentEligibility(item, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const stat = item && item.stat || {};
  const learning = stat.learningV1 || {};
  const fingerprint = fingerprintAssessmentItem(item || {});
  const evidence = mergeLearningEvidence(learning.evidence).filter((event) => event.contentFingerprint === fingerprint);
  const latestInitial = evidence.filter((event) => event.type === "assessment" && event.stage === "initial" && event.ok && !event.assisted).at(-1);
  const latestDelayed = evidence.filter((event) => event.type === "assessment" && ["delayed", "maintenance"].includes(event.stage) && event.ok && !event.assisted).at(-1);
  const latestFailure = evidence.filter((event) => (event.type === "assessment" || event.type === "practice") && (event.ok === false || event.assisted === true) && (!latestInitial || event.at >= latestInitial.at)).at(-1);
  const exposureAt = getExposureAt(stat, learning);
  const familiarAt = Number(item && item.familiarity && item.familiarity.markedAt) || 0;
  const baselineAt = exposureAt || familiarAt || (options.firstObservedAt || now);
  const initialAt = Math.max(baselineAt, exposureAt);
  if (!item || !item.key || !Array.isArray(item.chunks) || !item.chunks.length || !(item.zh || item.translation || item.prompt) || item.chunks.some((chunk) => !String(chunk || "").trim())) {
    return { eligible: false, reason: "missing-content", stage: null, eligibleAt: 0, fingerprint };
  }
  if (latestFailure) {
    const eligibleAt2 = Math.max(latestFailure.at + INITIAL_WAIT_MS, exposureAt + INITIAL_WAIT_MS);
    return { eligible: now >= eligibleAt2, reason: now >= eligibleAt2 ? "" : "retry-after-failure", stage: "initial", eligibleAt: eligibleAt2, fingerprint };
  }
  if (!latestInitial) {
    const eligibleAt2 = initialAt + INITIAL_WAIT_MS;
    return { eligible: now >= eligibleAt2, reason: now >= eligibleAt2 ? "" : "wait-after-exposure", stage: "initial", eligibleAt: eligibleAt2, fingerprint };
  }
  if (latestDelayed && latestDelayed.at >= latestInitial.at) {
    const eligibleAt2 = Math.max(latestDelayed.at + DELAYED_WAIT_MS, exposureAt + INITIAL_WAIT_MS);
    return { eligible: now >= eligibleAt2, reason: now >= eligibleAt2 ? "" : "maintenance-due", stage: "maintenance", eligibleAt: eligibleAt2, fingerprint };
  }
  const eligibleAt = Math.max(latestInitial.at + DELAYED_WAIT_MS, exposureAt + INITIAL_WAIT_MS);
  return { eligible: now >= eligibleAt, reason: now >= eligibleAt ? "" : "wait-for-delayed-retest", stage: "delayed", eligibleAt, fingerprint };
}
function createAssessmentSession(items, options = {}) {
  if (!Array.isArray(items) || !items.length) throw new TypeError("assessment requires at least one eligible item");
  if (typeof options.makeId !== "function") throw new TypeError("assessment requires an id generator");
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const sessionId = String(options.makeId());
  if (!sessionId) throw new TypeError("assessment session id is required");
  const sessionItems = items.map((item) => {
    const eligibility = getAssessmentEligibility(item, { now });
    if (!eligibility.eligible) throw new Error("assessment item is not eligible: " + eligibility.reason);
    return {
      key: String(item.key),
      fingerprint: eligibility.fingerprint,
      prompt: String(item.zh || item.translation || item.prompt),
      chunks: item.chunks.map(String),
      alts: (item.alts || []).map((list) => Array.isArray(list) ? list.map(String) : []),
      stage: eligibility.stage,
      eligibleAt: eligibility.eligibleAt,
      submitted: false,
      answer: null,
      correct: false
    };
  });
  return {
    id: sessionId,
    revision: 1,
    policyVersion: ASSESSMENT_POLICY_VERSION,
    status: "active",
    createdAt: now,
    items: sessionItems,
    currentIndex: 0,
    completedAt: 0,
    passedCount: 0,
    threshold: 0.8
  };
}
function submitAssessmentAnswer(session, itemIndex, answers, options = {}) {
  if (!session || session.status !== "active") throw new Error("assessment session is not active");
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= session.items.length) throw new RangeError("invalid assessment item index");
  const current = session.items[itemIndex];
  if (current.submitted) return session;
  const values = Array.isArray(answers) ? answers : [];
  const judge = typeof options.judge === "function" ? options.judge : (answer, correct2, alternatives) => [correct2].concat(alternatives || []).some((candidate) => normalize(answer) === normalize(candidate));
  const correct = current.chunks.every((chunk, index) => judge(values[index], chunk, current.alts[index]));
  const items = session.items.map((item, index) => index === itemIndex ? { ...item, submitted: true, answer: values.map((value) => String(value == null ? "" : value)), correct } : item);
  const nextIndex = items.findIndex((item, index) => index > itemIndex && !item.submitted);
  return { ...session, revision: session.revision + 1, items, currentIndex: nextIndex < 0 ? session.items.length : nextIndex };
}
function finalizeAssessment(session, options = {}) {
  if (!session || session.status !== "active") throw new Error("assessment session is not active");
  if (session.items.some((item) => !item.submitted)) throw new Error("all items must be submitted before finalizing");
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const events = session.items.map((item) => createLearningEvent({
    makeId: options.makeId,
    key: item.key,
    sessionId: session.id,
    at: now,
    type: "assessment",
    mode: "typing",
    contentFingerprint: item.fingerprint,
    policyVersion: session.policyVersion,
    ok: item.correct,
    assisted: false,
    firstAttempt: true,
    eligibleAt: item.eligibleAt,
    stage: item.stage
  }));
  const passedCount = session.items.filter((item) => item.correct).length;
  const passed = session.items.length > 0 && passedCount / session.items.length >= session.threshold;
  return {
    session: { ...session, revision: session.revision + 1, status: "completed", completedAt: now, passedCount },
    passed,
    passedCount,
    total: session.items.length,
    events
  };
}

// src/learning/persistence-reducer.mjs
var ordered = (events) => events.slice().sort((left, right) => left.at - right.at || String(left.id).localeCompare(String(right.id)));
function reducePracticeEvents(baseline = {}, events = [], options = {}) {
  const stat = { ...baseline && typeof baseline === "object" ? baseline : {} };
  const baseLearning = stat.learningV1 && typeof stat.learningV1 === "object" ? stat.learningV1 : {};
  let learning = {
    version: 1,
    evidence: [],
    baselineAt: Number(stat.lastAt) || 0,
    lastExposureAt: Number(stat.lastAt) || 0,
    interval: Number(stat.interval) || 1,
    ease: Number(stat.ease) || 2.5,
    repetition: Number(stat.repetition) || 0,
    ...baseLearning
  };
  let streak = Number(stat.streak) || 0;
  let maxStreak = Number(stat.maxStreak) || 0;
  let times = Number(stat.times) || 0;
  let okTimes = Number(stat.okTimes) || 0;
  let wrongTimes = Number(stat.wrongTimes) || 0;
  let lastAt = Number(stat.lastAt) || 0;
  const accepted = ordered(events);
  accepted.forEach((source) => {
    const event = createLearningEvent({
      makeId: () => source.id,
      key: source.key,
      sessionId: source.sessionId || source.id,
      at: source.at,
      type: ["exposure", "assessment"].includes(source.type) ? source.type : "practice",
      mode: source.mode || "unknown",
      contentFingerprint: source.contentFingerprint || "",
      policyVersion: source.policyVersion || 1,
      ok: source.ok === true,
      assisted: source.assisted === true,
      firstAttempt: source.firstAttempt === true,
      timeZone: source.timeZone,
      eligibleAt: source.eligibleAt,
      stage: source.stage
    });
    const before = learning;
    learning = applyLearningEvent(learning, event);
    if (event.type === "exposure") return;
    if (event.type === "assessment") {
      const schedule2 = event.ok ? {} : scheduleLearningResult(before, { ok: false, assisted: false }, { now: source.at, srs: options.srs });
      learning = {
        ...learning,
        ...schedule2,
        evidence: learning.evidence,
        lastExposureAt: Math.max(Number(learning.lastExposureAt) || 0, source.at)
      };
      return;
    }
    const schedule = scheduleLearningResult(before, {
      ok: event.ok,
      assisted: event.assisted,
      earlyPractice: source.earlyPractice === true
    }, { now: source.at, srs: options.srs });
    learning = { ...learning, ...schedule, evidence: learning.evidence, lastExposureAt: Math.max(Number(learning.lastExposureAt) || 0, source.at) };
    times += 1;
    if (event.ok) {
      okTimes += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      wrongTimes += 1;
      streak = 0;
    }
    lastAt = Math.max(lastAt, source.at);
  });
  return {
    stat: {
      ...stat,
      times,
      okTimes,
      wrongTimes,
      streak,
      maxStreak,
      lastAt,
      interval: Number(learning.interval) || Number(stat.interval) || 1,
      ease: Number(learning.ease) || Number(stat.ease) || 2.5,
      repetition: Number(learning.repetition) || 0,
      dueAt: Number(learning.dueAt) || 0,
      learningV1: learning
    },
    eventCount: accepted.length
  };
}

// src/learning/review-policy.mjs
var MAX_REVIEW_BATCH = 10;
function eventId(event) {
  return String(event?.id || event?.eventId || "");
}
function eventTime(event) {
  return Number(event?.at) || Number(event?.occurredAt) || 0;
}
function eventOrder(left, right) {
  return eventTime(left) - eventTime(right) || eventId(left).localeCompare(eventId(right));
}
function eventDay(event) {
  const at = eventTime(event);
  if (!at) return "";
  const zone = typeof event.timeZone === "string" && event.timeZone ? event.timeZone : "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const value = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch (_) {
    return "";
  }
}
function resolveMistakeState({ row, stat, contentFingerprint } = {}) {
  const learning = stat?.learningV1 && typeof stat.learningV1 === "object" ? stat.learningV1 : {};
  const fingerprintEvidence = (Array.isArray(learning.evidence) ? learning.evidence : []).filter((event) => event.contentFingerprint).slice().sort(eventOrder);
  const latestFingerprint = fingerprintEvidence.slice(-1)[0]?.contentFingerprint;
  const fingerprintMatches = !contentFingerprint || !latestFingerprint || latestFingerprint === contentFingerprint;
  const events = /* @__PURE__ */ new Map();
  const history = Array.isArray(row?.history) && row.history.length ? row.history : row ? [{
    eventId: `legacy-${String(row._key || row.deckId || "mistake")}`,
    at: typeof row.addedAt === "string" ? Date.parse(`${row.addedAt.replace(" ", "T")}Z`) : null,
    needsReview: row.needsReview === true,
    mistakes: Array.isArray(row.mistakes) ? row.mistakes : [],
    legacy: true
  }] : [];
  history.forEach((event) => {
    const id = eventId(event);
    if (!id) return;
    const issue = event.needsReview === true || event.hinted === true || event.revealed === true || Array.isArray(event.mistakes) && event.mistakes.length > 0;
    events.set(id, { ...event, id, at: eventTime(event), issue, assisted: event.hinted === true || event.revealed === true, legacy: event.legacy === true || id.startsWith("legacy-") });
  });
  (Array.isArray(learning.evidence) ? learning.evidence : []).forEach((event) => {
    const id = eventId(event);
    if (!id || events.has(id)) return;
    if (event.contentFingerprint && contentFingerprint && event.contentFingerprint !== contentFingerprint) return;
    events.set(id, {
      ...event,
      id,
      at: eventTime(event),
      issue: event.ok === false || event.assisted === true,
      assisted: event.assisted === true,
      legacy: false
    });
  });
  const ordered2 = [...events.values()].sort(eventOrder);
  const lastIssue = ordered2.filter((event) => event.issue || event.assisted || event.ok === false).slice(-1)[0];
  const recent = lastIssue ? ordered2.filter((event) => event.at > lastIssue.at) : ordered2;
  const successfulDays = /* @__PURE__ */ new Map();
  const successfulSessions = /* @__PURE__ */ new Set();
  recent.forEach((event) => {
    if (event.ok === true && event.assisted !== true && event.firstAttempt === true && event.sessionId && event.at) {
      const day = eventDay(event);
      const sessionId = String(event.sessionId);
      if (day && !successfulDays.has(day) && !successfulSessions.has(sessionId)) {
        successfulDays.set(day, event);
        successfulSessions.add(sessionId);
      }
    }
  });
  const successDays = [...successfulDays.keys()].sort();
  const status = fingerprintMatches && successDays.length >= 2 ? "mastered" : "needs-reinforcement";
  const mistakeCount = ordered2.filter((event) => event.issue || event.assisted || event.ok === false).length;
  const addedAt = typeof row?.addedAt === "string" ? Date.parse(`${row.addedAt.replace(" ", "T")}Z`) : 0;
  return {
    status,
    successDays: successDays.length,
    successfulDayKeys: successDays,
    lastIssueAt: lastIssue?.at || (Number.isFinite(addedAt) ? addedAt : 0),
    lastWrongAt: lastIssue?.at || 0,
    wrongCount: Math.max(mistakeCount, Number(row?.history?.length ? 0 : row?.wrongCount) || 0),
    historyIncomplete: row?.historyTruncated === true || ordered2.some((event) => event.legacy || !event.at),
    fingerprintMatches
  };
}
function buildSentenceReviewModel({ stats, reinforceBook, decks, isJoined, isDeleted, now = Date.now(), contentFingerprint, cidForItem } = {}) {
  const bySentence = stats?.bySentence && typeof stats.bySentence === "object" ? stats.bySentence : {};
  const deckRows = Array.isArray(decks) ? decks : [];
  const sources = /* @__PURE__ */ new Map();
  deckRows.forEach((deck) => {
    if (!deck?.id || typeof isJoined === "function" && !isJoined(deck)) return;
    const items = /* @__PURE__ */ new Map();
    (Array.isArray(deck.items) ? deck.items : []).forEach((item) => {
      const cid = String(item.cid || (typeof cidForItem === "function" ? cidForItem(item) : ""));
      if (cid) items.set(cid, item);
    });
    sources.set(deck.id, { deck, items });
  });
  const wrongRows = /* @__PURE__ */ new Map();
  const deckSentences = /* @__PURE__ */ new Map();
  sources.forEach(({ deck, items }) => {
    const byText = /* @__PURE__ */ new Map();
    items.forEach((item) => {
      const sentence = String(item.sentence || item.en || "");
      if (!byText.has(sentence)) byText.set(sentence, []);
      byText.get(sentence).push(item);
    });
    deckSentences.set(deck.id, byText);
  });
  (Array.isArray(reinforceBook) ? reinforceBook : []).forEach((row) => {
    if (!row?.deckId) return;
    const source = sources.get(row.deckId);
    const matched = source && (row.cid ? source.items.get(String(row.cid)) : null);
    const candidates = source && !matched ? deckSentences.get(row.deckId)?.get(String(row.sentence || "")) : null;
    const item = matched || (candidates?.length === 1 ? candidates[0] : null);
    const cid = item && String(item.cid || (typeof cidForItem === "function" ? cidForItem(item) : ""));
    const key = cid ? `${row.deckId}#${cid}` : `${row.deckId}#history:${String(row._key || row.addedAt || "unknown")}`;
    if (!source || !item) {
      if (!wrongRows.has(key)) wrongRows.set(key, { key, deck: null, item: null, row, stat: {}, unavailable: true, state: resolveMistakeState({ row }) });
      return;
    }
    if (typeof isDeleted === "function" && isDeleted(row.deckId, item)) return;
    if (!wrongRows.has(key)) wrongRows.set(key, { key, deck: source.deck, item, row, stat: bySentence[key] || {}, state: null });
  });
  const wrong = [...wrongRows.values()].map((entry) => {
    if (entry.unavailable) return entry;
    const fingerprint = typeof contentFingerprint === "function" ? contentFingerprint(entry.item) : "";
    entry.state = resolveMistakeState({ row: entry.row, stat: entry.stat, contentFingerprint: fingerprint });
    return entry;
  });
  const dueMap = /* @__PURE__ */ new Map();
  Object.entries(bySentence).forEach(([key, stat]) => {
    if (!stat || !stat.deckId || !Number(stat.dueAt) || Number(stat.dueAt) > now) return;
    const separator = key.indexOf("#"), cid = separator >= 0 ? key.slice(separator + 1) : "";
    const source = sources.get(stat.deckId), item = source?.items.get(cid);
    if (!item || typeof isDeleted === "function" && isDeleted(stat.deckId, item)) return;
    const row = wrongRows.get(key)?.row;
    dueMap.set(key, { key, deck: source.deck, item, stat, row, state: row ? wrong.find((entry) => entry.key === key)?.state : null, dueAt: Number(stat.dueAt) });
  });
  const due = [...dueMap.values()].sort((left, right) => left.dueAt - right.dueAt || left.key.localeCompare(right.key));
  wrong.sort((left, right) => (left.state.status === right.state.status ? 0 : left.state.status === "needs-reinforcement" ? -1 : 1) || right.state.wrongCount - left.state.wrongCount || right.state.lastWrongAt - left.state.lastWrongAt || left.key.localeCompare(right.key));
  return { due, wrong, counts: {
    due: due.length,
    needsReinforcement: wrong.filter((entry) => entry.state.status === "needs-reinforcement").length,
    mastered: wrong.filter((entry) => entry.state.status === "mastered").length
  } };
}
function selectReviewBatch(model, { kind = "due", limit = MAX_REVIEW_BATCH, status = "needs-reinforcement", courseId } = {}) {
  const source = kind === "wrong" ? (model?.wrong || []).filter((entry) => status === "all" || entry.state.status === status) : model?.due || [];
  return source.filter((entry) => !courseId || entry.deck && entry.deck.id === courseId).slice(0, Math.max(1, Math.min(MAX_REVIEW_BATCH, Number(limit) || MAX_REVIEW_BATCH)));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ASSESSMENT_POLICY_VERSION,
  DELAYED_WAIT_MS,
  FAMILIAR_DELAY_MS,
  INITIAL_WAIT_MS,
  LEARNING_DAY_MS,
  RELEARN_DELAY_MS,
  applyLearningEvent,
  buildSentenceReviewModel,
  createAssessmentSession,
  createLearningEvent,
  finalizeAssessment,
  fingerprintAssessmentItem,
  getAssessmentEligibility,
  getExposureAt,
  mergeLearningEvidence,
  reducePracticeEvents,
  resolveLearningState,
  resolveMistakeState,
  scheduleFamiliarity,
  scheduleLearningResult,
  selectReviewBatch,
  submitAssessmentAnswer
});
