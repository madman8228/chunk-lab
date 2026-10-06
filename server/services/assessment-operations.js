'use strict';

const assessmentEngine = require('../../js/learning-engine.cjs');

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createAssessmentOperations(options) {
  const db = options.db;
  const currentGeneration = options.currentGeneration;
  const assessmentSession = options.assessmentSession;
  const resolveAssessmentItem = options.resolveAssessmentItem;
  const replaceSentenceStat = options.replaceSentenceStat;
  const reducePracticeEvents = options.reducePracticeEvents;
  const upsertEvent = options.upsertEvent;
  const srs = options.srs;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    const p = body.payload;
    if (body.type === 'assessment.start') {
      if (!hasOnlyKeys(p, ['eventId', 'sessionId', 'keys', 'generation']) ||
          typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
          typeof p.sessionId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.sessionId) ||
          !Array.isArray(p.keys) || p.keys.length < 1 || p.keys.length > 100 ||
          p.keys.some(key => typeof key !== 'string' || key.length > 500) || new Set(p.keys).size !== p.keys.length ||
          (p.generation !== undefined && (!Number.isSafeInteger(p.generation) || p.generation < 0)) ||
          typeof resolveAssessmentItem !== 'function') {
        throw operationError('测评开始请求无效', 'INVALID_OPERATION', 400);
      }
      const deckIds = new Set(p.keys.map(key => key.slice(0, key.indexOf('#'))));
      if (deckIds.size !== 1 || deckIds.has('')) throw operationError('一次测评只能包含同一题库的句子', 'INVALID_OPERATION', 400);
      const scopeKey = 'course:' + deckIds.values().next().value;
      const generation = p.generation === undefined ? 0 : p.generation;
      if (generation !== currentGeneration(userId, scopeKey)) {
        return { entity: 'assessmentSession', id: p.sessionId, outcome: 'retained', generation: currentGeneration(userId, scopeKey) };
      }
      if (assessmentSession(userId, p.sessionId)) throw operationError('测评会话编号已存在', 'ASSESSMENT_SESSION_EXISTS', 409);
      const now = Date.now();
      const items = p.keys.map(key => {
        const content = resolveAssessmentItem(userId, key);
        if (!content || !Array.isArray(content.chunks) || !content.chunks.length) {
          throw operationError('测评题目已不存在或内容不完整', 'ASSESSMENT_CONTENT_CHANGED', 409);
        }
        const statRow = db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=? AND deleted_at IS NULL').get(userId, key);
        const familiarRow = db.prepare("SELECT data_json,deleted_at FROM user_entity_rows WHERE user_id=? AND kind='mastered' AND item_key=?").get(userId, key);
        const item = Object.assign({}, content, { key, zh: content.translation || content.zh,
          stat: statRow ? JSON.parse(statRow.data_json) : {},
          familiarity: familiarRow && !familiarRow.deleted_at ? JSON.parse(familiarRow.data_json) : null });
        const eligibility = assessmentEngine.getAssessmentEligibility(item, { now });
        if (!eligibility.eligible) throw operationError('这条内容暂不符合测评时间要求', 'ASSESSMENT_NOT_ELIGIBLE', 409,
          [{ key, reason: eligibility.reason, eligibleAt: eligibility.eligibleAt }]);
        return item;
      });
      const session = assessmentEngine.createAssessmentSession(items, { now, makeId: () => p.sessionId });
      db.prepare(`INSERT INTO user_assessment_sessions(user_id,session_id,scope_key,generation,revision,status,data_json,created_at,updated_at)
        VALUES(?,?,?,?,?,'active',?,?,?)`).run(userId, p.sessionId, scopeKey, generation, session.revision, JSON.stringify(session), now, now);
      return { entity: 'assessmentSession', id: p.sessionId, revision: session.revision, status: session.status, scopeKey, generation };
    }

    if (body.type === 'assessment.answer') {
      if (!hasOnlyKeys(p, ['eventId', 'sessionId', 'itemIndex', 'answers']) ||
          typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
          typeof p.sessionId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.sessionId) ||
          !Number.isSafeInteger(p.itemIndex) || p.itemIndex < 0 || !Array.isArray(p.answers) || p.answers.length > 100 ||
          p.answers.some(value => typeof value !== 'string' || value.length > 300)) {
        throw operationError('测评答案无效', 'INVALID_OPERATION', 400);
      }
      const stored = assessmentSession(userId, p.sessionId);
      if (!stored) throw operationError('测评会话不存在', 'ASSESSMENT_SESSION_NOT_FOUND', 404);
      if (stored.row.status !== 'active') return { entity: 'assessmentSession', id: p.sessionId, revision: stored.row.revision, status: 'completed' };
      if (currentGeneration(userId, stored.row.scope_key) !== Number(stored.row.generation)) {
        return { entity: 'assessmentSession', id: p.sessionId, outcome: 'retained', generation: currentGeneration(userId, stored.row.scope_key) };
      }
      const updated = assessmentEngine.submitAssessmentAnswer(stored.session, p.itemIndex, p.answers);
      if (updated !== stored.session) {
        const now = Date.now();
        db.prepare("UPDATE user_assessment_sessions SET revision=?,data_json=?,updated_at=? WHERE user_id=? AND session_id=? AND status='active'")
          .run(updated.revision, JSON.stringify(updated), now, userId, p.sessionId);
      }
      return { entity: 'assessmentSession', id: p.sessionId, revision: updated.revision, status: updated.status,
        itemIndex: p.itemIndex, submitted: !!updated.items[p.itemIndex].submitted };
    }

    if (body.type === 'assessment.finalize') {
      if (!hasOnlyKeys(p, ['eventId', 'sessionId']) || typeof p.eventId !== 'string' ||
          !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) || typeof p.sessionId !== 'string' ||
          !/^[A-Za-z0-9_-]{12,100}$/.test(p.sessionId) || !replaceSentenceStat || !reducePracticeEvents) {
        throw operationError('测评提交请求无效', 'INVALID_OPERATION', 400);
      }
      const stored = assessmentSession(userId, p.sessionId);
      if (!stored) throw operationError('测评会话不存在', 'ASSESSMENT_SESSION_NOT_FOUND', 404);
      if (stored.row.status === 'completed') {
        const result = JSON.parse(stored.row.result_json || '{}');
        return { entity: 'assessmentResult', id: p.sessionId, outcome: 'already-applied', result };
      }
      if (currentGeneration(userId, stored.row.scope_key) !== Number(stored.row.generation)) {
        return { entity: 'assessmentSession', id: p.sessionId, outcome: 'retained', generation: currentGeneration(userId, stored.row.scope_key) };
      }
      const now = Date.now();
      let eventNumber = 0;
      const finalized = assessmentEngine.finalizeAssessment(stored.session, { now,
        makeId: () => 'assessment:' + p.sessionId + ':item:' + (++eventNumber) });
      finalized.events.forEach(event => {
        const prior = db.prepare('SELECT baseline_json FROM user_learning_baselines WHERE user_id=? AND sentence_key=?').get(userId, event.key);
        if (!prior) {
          const statRow = db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=? AND deleted_at IS NULL').get(userId, event.key);
          db.prepare('INSERT INTO user_learning_baselines(user_id,sentence_key,baseline_json) VALUES(?,?,?)')
            .run(userId, event.key, statRow ? statRow.data_json : JSON.stringify({ deckId: event.key.slice(0, event.key.indexOf('#')), times: 0,
              okTimes: 0, wrongTimes: 0, streak: 0, maxStreak: 0, lastAt: 0, interval: 1, ease: 2.5, dueAt: 0 }));
        }
        const learningEvent = Object.assign({}, event, { generation: Number(stored.row.generation), receivedAt: now });
        db.prepare('INSERT INTO user_learning_events(user_id,sentence_key,event_id,generation,event_json,received_at) VALUES(?,?,?,?,?,?)')
          .run(userId, event.key, event.id, Number(stored.row.generation), JSON.stringify(learningEvent), now);
        const baseline = db.prepare('SELECT baseline_json FROM user_learning_baselines WHERE user_id=? AND sentence_key=?').get(userId, event.key);
        const eventRows = db.prepare('SELECT event_json FROM user_learning_events WHERE user_id=? AND sentence_key=? AND generation=?')
          .all(userId, event.key, Number(stored.row.generation));
        const reduced = reducePracticeEvents(JSON.parse(baseline.baseline_json), eventRows.map(row => JSON.parse(row.event_json)), { srs });
        reduced.stat.deckId = event.key.slice(0, event.key.indexOf('#'));
        replaceSentenceStat(userId, event.key, reduced.stat, seq);
        upsertEvent(userId, Object.assign({ id: event.id, kind: 'learning', key: event.key }, learningEvent), seq);
      });
      const result = { passed: finalized.passed, passedCount: finalized.passedCount, total: finalized.total,
        completedAt: finalized.session.completedAt, revision: finalized.session.revision };
      db.prepare("UPDATE user_assessment_sessions SET revision=?,status='completed',data_json=?,result_json=?,updated_at=? WHERE user_id=? AND session_id=? AND status='active'")
        .run(finalized.session.revision, JSON.stringify(finalized.session), JSON.stringify(result), now, userId, p.sessionId);
      return { entity: 'assessmentResult', id: p.sessionId, result };
    }

    return null;
  }

  return Object.freeze({ apply });
}

module.exports = { createAssessmentOperations };
