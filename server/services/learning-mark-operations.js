'use strict';

const learningEngine = require('../../js/learning-engine.cjs');

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createLearningMarkOperations(options) {
  const db = options.db;
  const currentGeneration = options.currentGeneration;
  const upsertSentenceStat = options.upsertSentenceStat;
  const upsertEntityRow = options.upsertEntityRow;
  const deleteEntityRow = options.deleteEntityRow;
  const upsertEvent = options.upsertEvent;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    if (body.type !== 'learning.mark') return null;
    const payload = body.payload;
    if (!hasOnlyKeys(payload, ['eventId', 'key', 'deckId', 'courseId', 'generation', 'active', 'markedAt', 'sentence', 'legacyMigration']) ||
        typeof payload.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(payload.eventId) ||
        typeof payload.key !== 'string' || !payload.key.startsWith(payload.deckId + '#') || payload.key.length > 500 ||
        typeof payload.deckId !== 'string' || !payload.deckId || payload.deckId.length > 200 || typeof payload.active !== 'boolean' ||
        (payload.courseId !== undefined && (typeof payload.courseId !== 'string' || !payload.courseId || payload.courseId.length > 200)) ||
        (payload.generation !== undefined && (!Number.isSafeInteger(payload.generation) || payload.generation < 0)) ||
        (payload.markedAt !== undefined && (!Number.isFinite(payload.markedAt) || payload.markedAt <= 0)) ||
        (payload.sentence !== undefined && (typeof payload.sentence !== 'string' || payload.sentence.length > 1000)) ||
        (payload.legacyMigration !== undefined && (payload.legacyMigration !== true || !payload.active)) ||
        (payload.active && !upsertEntityRow) || (!payload.active && !deleteEntityRow)) {
      throw operationError('熟悉标记操作无效', 'INVALID_OPERATION', 400);
    }
    const scopeKey = 'course:' + (payload.courseId || payload.deckId);
    const activeGeneration = currentGeneration(userId, scopeKey);
    const generation = payload.generation === undefined ? 0 : payload.generation;
    if (generation !== activeGeneration) {
      return { entity: 'mastered', id: payload.key, active: payload.active, outcome: 'retained', generation: activeGeneration };
    }
    const at = Number(payload.markedAt) > 0 && payload.markedAt <= Date.now() + 5 * 60 * 1000 ? payload.markedAt : Date.now();
    if (payload.active) {
      const row = db.prepare('SELECT data_json,deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?')
        .get(userId, payload.key);
      const stat = row && !row.deleted_at ? JSON.parse(row.data_json) : {
        deckId: payload.deckId, times: 0, okTimes: 0, wrongTimes: 0, streak: 0, maxStreak: 0,
        lastAt: 0, interval: 1, ease: 2.5, dueAt: 0
      };
      stat.learningV1 = learningEngine.scheduleFamiliarity(stat.learningV1 || {
        version: 1, evidence: [], baselineAt: at, lastExposureAt: Number(stat.lastAt) || 0,
        interval: Number(stat.interval) || 1, ease: Number(stat.ease) || 2.5, repetition: Number(stat.repetition) || 0
      }, { markedAt: at });
      if (payload.legacyMigration) stat.learningV1.legacyFamiliarityMigrated = true;
      if (!Number(stat.dueAt)) stat.dueAt = stat.learningV1.dueAt;
      upsertSentenceStat(userId, payload.key, stat, seq);
      upsertEntityRow(userId, 'mastered', payload.key,
        { deckId: payload.deckId, sentence: payload.sentence || '', markedAt: at }, seq);
    } else {
      deleteEntityRow(userId, 'mastered', payload.key, seq);
    }
    const markEvent = { id: payload.eventId, kind: 'learning', type: 'familiaritySchedule', key: payload.key, at,
      active: payload.active, generation };
    if (payload.legacyMigration === true) markEvent.legacyMigration = true;
    upsertEvent(userId, markEvent, seq);
    return { entity: 'mastered', id: payload.key, active: payload.active };
  }

  return Object.freeze({ apply });
}

module.exports = { createLearningMarkOperations };
