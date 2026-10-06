'use strict';

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createLearningExposureOperations(options) {
  const db = options.db;
  const currentGeneration = options.currentGeneration;
  const replaceSentenceStat = options.replaceSentenceStat;
  const reducePracticeEvents = options.reducePracticeEvents;
  const upsertEvent = options.upsertEvent;
  const srs = options.srs;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    if (body.type !== 'learning.exposure') return null;
    const p = body.payload;
    if (!hasOnlyKeys(p, ['eventId', 'key', 'deckId', 'courseId', 'sessionId', 'generation', 'occurredAt', 'contentFingerprint', 'policyVersion', 'mode']) ||
        typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
        typeof p.deckId !== 'string' || !p.deckId || p.deckId.length > 200 ||
        typeof p.key !== 'string' || !p.key.startsWith(p.deckId + '#') || p.key.length > 500 ||
        (p.courseId !== undefined && (typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200)) ||
        (p.sessionId !== undefined && (typeof p.sessionId !== 'string' || !p.sessionId || p.sessionId.length > 160)) ||
        (p.generation !== undefined && (!Number.isSafeInteger(p.generation) || p.generation < 0)) ||
        (p.occurredAt !== undefined && (!Number.isFinite(p.occurredAt) || p.occurredAt <= 0)) ||
        (p.contentFingerprint !== undefined && (typeof p.contentFingerprint !== 'string' || p.contentFingerprint.length > 200)) ||
        (p.policyVersion !== undefined && (!Number.isSafeInteger(p.policyVersion) || p.policyVersion < 1)) ||
        (p.mode !== undefined && (typeof p.mode !== 'string' || !p.mode || p.mode.length > 80)) ||
        !replaceSentenceStat || !reducePracticeEvents) {
      throw operationError('学习接触记录无效', 'INVALID_OPERATION', 400);
    }
    const scopeKey = 'course:' + (p.courseId || p.deckId);
    const activeGeneration = currentGeneration(userId, scopeKey);
    const generation = p.generation === undefined ? 0 : p.generation;
    if (generation !== activeGeneration) {
      return { entity: 'exposure', id: p.eventId, key: p.key, outcome: 'retained', generation: activeGeneration };
    }
    const row = db.prepare('SELECT data_json,deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?').get(userId, p.key);
    const baseline = row && !row.deleted_at ? JSON.parse(row.data_json) : {
      deckId: p.deckId, times: 0, okTimes: 0, wrongTimes: 0, streak: 0, maxStreak: 0,
      lastAt: 0, interval: 1, ease: 2.5, dueAt: 0
    };
    const receivedAt = Date.now();
    const suppliedAt = Number(p.occurredAt);
    const at = Number.isFinite(suppliedAt) && suppliedAt > 0 && suppliedAt <= receivedAt + 5 * 60 * 1000
      ? suppliedAt : receivedAt;
    const event = {
      id: p.eventId, key: p.key, deckId: p.deckId, sessionId: p.sessionId || p.eventId,
      at, receivedAt, generation, type: 'exposure', mode: p.mode || 'unknown',
      contentFingerprint: p.contentFingerprint || '', policyVersion: p.policyVersion || 1,
      ok: false, assisted: false, firstAttempt: false
    };
    db.prepare('INSERT OR IGNORE INTO user_learning_baselines(user_id,sentence_key,baseline_json) VALUES(?,?,?)')
      .run(userId, p.key, JSON.stringify(baseline));
    db.prepare('INSERT INTO user_learning_events(user_id,sentence_key,event_id,generation,event_json,received_at) VALUES(?,?,?,?,?,?)')
      .run(userId, p.key, p.eventId, generation, JSON.stringify(event), receivedAt);
    const base = db.prepare('SELECT baseline_json FROM user_learning_baselines WHERE user_id=? AND sentence_key=?').get(userId, p.key);
    const events = db.prepare('SELECT event_json FROM user_learning_events WHERE user_id=? AND sentence_key=? AND generation=?')
      .all(userId, p.key, generation);
    const reduced = reducePracticeEvents(JSON.parse(base.baseline_json), events.map(item => JSON.parse(item.event_json)), { srs });
    reduced.stat.deckId = p.deckId;
    replaceSentenceStat(userId, p.key, reduced.stat, seq);
    upsertEvent(userId, { id: p.eventId, kind: 'learning', type: 'exposure', key: p.key,
      sessionId: event.sessionId, at, receivedAt, generation }, seq);
    return { entity: 'exposure', id: p.eventId, key: p.key, lastExposureAt: reduced.stat.learningV1.lastExposureAt };
  }

  return Object.freeze({ apply });
}

module.exports = { createLearningExposureOperations };
