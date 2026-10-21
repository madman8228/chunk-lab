'use strict';
const { deckIdentity } = require('./assessment-content');
const fail = (code, status = 503) => Object.assign(new Error(code), { code, status });

/** Compose existing authorization and assessment operations in one synchronous transaction. */
function createProtectedAssessmentService({ db, courseAccess, operations }) {
  const startTx = db.transaction((input, userId) => {
    const { courseId, unitId, itemId, assessmentId, requestId, takeover = false } = input || {};
    if ([courseId,unitId,itemId].some(value=>typeof value!=='string'||!/^[A-Za-z0-9:._-]{1,160}$/.test(value)) ||
        typeof assessmentId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(assessmentId)) throw fail('INVALID_REQUEST', 400);
    const identity = courseAccess.identity?.(courseId, unitId);
    const deckId = identity?.deckId || deckIdentity(courseId, unitId), key = deckId + '#' + itemId, scopeKey = identity?.generationScope || 'course:' + courseId;
    const generation = db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=? AND scope_key=?').get(userId, scopeKey)?.generation || 0;
    const prior = db.prepare('SELECT scope_key,generation,data_json FROM user_assessment_sessions WHERE user_id=? AND session_id=?').get(userId, assessmentId);
    if (prior && (prior.scope_key !== scopeKey || prior.generation !== generation ||
        JSON.parse(prior.data_json).items.length !== 1 || JSON.parse(prior.data_json).items[0].key !== key)) throw fail('ASSESSMENT_TARGET_CHANGED', 409);
    const authorization = courseAccess.start({ courseId, unitId, itemId, requestId, takeover }, userId);
    if (!authorization.allowed) return authorization;
    if (!prior) {
      const result = operations.execute(userId, { protocol: 3, requestId: assessmentId, type: 'assessment.start', payload: {
        eventId: assessmentId, sessionId: assessmentId, keys: [key], generation,
        ...(authorization.sessionId ? { learningSessionId: authorization.sessionId } : {})
      } });
      if (result.operation.outcome === 'retained') throw fail('ASSESSMENT_TARGET_CHANGED', 409);
    }
    // Do not include the normal study batch/answers in this new-content response.
    const { unit, ...decision } = authorization;
    void unit;
    return { ...decision, ...operations.getAssessmentSession(userId, assessmentId) };
  });
  return Object.freeze({ start(input, userId) { return startTx.immediate(input, userId); } });
}
module.exports = { createProtectedAssessmentService };
