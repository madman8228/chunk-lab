'use strict';

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createLearningEventOperations(options) {
  const db = options.db;
  const currentGeneration = options.currentGeneration;
  const srs = options.srs;
  const upsertSentenceStat = options.upsertSentenceStat;
  const replaceSentenceStat = options.replaceSentenceStat;
  const reducePracticeEvents = options.reducePracticeEvents;
  const upsertEntityRow = options.upsertEntityRow;
  const upsertEvent = options.upsertEvent;
  const upsertKv = options.upsertKv;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    const p = body.payload;
    if (body.type === 'learning.answer') {
      const answerFields = ['eventId', 'key', 'deckId', 'courseId', 'ok', 'sessionId', 'generation', 'occurredAt',
        'timeZone', 'mode', 'contentFingerprint', 'policyVersion', 'assisted', 'firstAttempt', 'earlyPractice',
        'chunkRight', 'chunkTotal', 'answerOrder', 'mistake'];
      if (!hasOnlyKeys(p, answerFields) ||
          typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
          typeof p.deckId !== 'string' || !p.deckId || p.deckId.length > 200 ||
          typeof p.key !== 'string' || !p.key.startsWith(p.deckId + '#') || p.key.length > 500 ||
          typeof p.ok !== 'boolean' || !srs || typeof srs.recordResult !== 'function') {
        throw operationError('答题记录内容无效', 'INVALID_OPERATION', 400);
      }
      if ((p.sessionId !== undefined && (typeof p.sessionId !== 'string' || !p.sessionId || p.sessionId.length > 160)) ||
          (p.courseId !== undefined && (typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200)) ||
          (p.generation !== undefined && (!Number.isSafeInteger(p.generation) || p.generation < 0)) ||
          (p.occurredAt !== undefined && (!Number.isFinite(p.occurredAt) || p.occurredAt <= 0)) ||
          (p.timeZone !== undefined && (typeof p.timeZone !== 'string' || !p.timeZone || p.timeZone.length > 80)) ||
          (p.mode !== undefined && (typeof p.mode !== 'string' || !p.mode || p.mode.length > 80)) ||
          (p.contentFingerprint !== undefined && (typeof p.contentFingerprint !== 'string' || p.contentFingerprint.length > 200)) ||
          (p.policyVersion !== undefined && (!Number.isSafeInteger(p.policyVersion) || p.policyVersion < 1)) ||
          (p.chunkRight !== undefined && (!Number.isSafeInteger(p.chunkRight) || p.chunkRight < 0 || p.chunkRight > 1000)) ||
          (p.chunkTotal !== undefined && (!Number.isSafeInteger(p.chunkTotal) || p.chunkTotal < 0 || p.chunkTotal > 1000)) ||
          (p.chunkRight !== undefined && p.chunkTotal === undefined) ||
          (p.chunkTotal !== undefined && p.chunkRight === undefined) ||
          (p.chunkRight !== undefined && p.chunkRight > p.chunkTotal) ||
          (p.answerOrder !== undefined && (!Number.isSafeInteger(p.answerOrder) || p.answerOrder < 0 || p.answerOrder > 1000000)) ||
          (p.mistake !== undefined && (!object(p.mistake) || typeof p.mistake.key !== 'string' || !p.mistake.key ||
            p.mistake.key.length > 600 || !object(p.mistake.row) || p.mistake.row._key !== p.mistake.key ||
            !upsertEntityRow)) ||
          ['assisted', 'firstAttempt', 'earlyPractice'].some(key => p[key] !== undefined && typeof p[key] !== 'boolean')) {
        throw operationError('答题记录包含无效学习字段', 'INVALID_OPERATION', 400);
      }
      const scopeKey = 'course:' + (p.courseId || p.deckId);
      const activeGeneration = currentGeneration(userId, scopeKey);
      if ((p.generation === undefined ? 0 : p.generation) !== activeGeneration) {
        return { entity: 'answer', id: p.eventId, key: p.key, outcome: 'retained', generation: activeGeneration };
      }
      const priorEvent = db.prepare('SELECT data_json,deleted_at FROM user_events WHERE user_id=? AND id=?').get(userId, p.eventId);
      if (priorEvent && !priorEvent.deleted_at) {
        const event = JSON.parse(priorEvent.data_json);
        if (event.kind !== 'answer' || event.key !== p.key || event.ok !== p.ok) {
          throw operationError('答题事件编号已用于其他内容', 'EVENT_ID_REUSED', 409);
        }
        const statRow = db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=? AND deleted_at IS NULL').get(userId, p.key);
        const statsRow = db.prepare("SELECT v_json FROM user_kv WHERE user_id=? AND k='stats' AND deleted_at IS NULL").get(userId);
        const stats = statsRow ? JSON.parse(statsRow.v_json) : {};
        return { entity: 'answer', id: p.eventId, key: p.key,
          stat: statRow ? JSON.parse(statRow.data_json) : null,
          totalAnswered: Number(stats.totalAnswered) || 0, alreadyRecorded: true };
      }
      const row = db.prepare('SELECT data_json,deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?').get(userId, p.key);
      const priorStat = row && !row.deleted_at ? JSON.parse(row.data_json) : {
        deckId: p.deckId, times: 0, okTimes: 0, wrongTimes: 0, streak: 0, maxStreak: 0,
        lastAt: 0, interval: 1, ease: 2.5, dueAt: 0
      };
      const receivedAt = Date.now();
      const suppliedAt = Number(p.occurredAt);
      const at = Number.isFinite(suppliedAt) && suppliedAt > 0 && suppliedAt <= receivedAt + 5 * 60 * 1000
        ? suppliedAt : receivedAt;
      const timeZone = typeof p.timeZone === 'string' && p.timeZone ? p.timeZone : 'UTC';
      let dayParts;
      try {
        dayParts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
      } catch (_) { throw operationError('时区名称无效', 'INVALID_OPERATION', 400); }
      const part = name => dayParts.find(value => value.type === name).value;
      const day = part('year') + '-' + part('month') + '-' + part('day');
      const sessionId = typeof p.sessionId === 'string' && p.sessionId.length <= 160 ? p.sessionId : p.eventId;
      const generation = Number.isSafeInteger(p.generation) && p.generation >= 0 ? p.generation : 0;
      const learningEvent = {
        id: p.eventId, key: p.key, deckId: p.deckId, sessionId, at, receivedAt,
        generation, type: 'practice', mode: typeof p.mode === 'string' ? p.mode.slice(0, 80) : 'unknown',
        contentFingerprint: typeof p.contentFingerprint === 'string' ? p.contentFingerprint.slice(0, 200) : '',
        policyVersion: Number.isSafeInteger(p.policyVersion) && p.policyVersion > 0 ? p.policyVersion : 1,
        ok: p.ok, assisted: p.assisted === true, firstAttempt: p.firstAttempt === true,
        earlyPractice: p.earlyPractice === true,
        ...(Number.isSafeInteger(p.chunkRight) && Number.isSafeInteger(p.chunkTotal)
          ? { chunkRight: p.chunkRight, chunkTotal: p.chunkTotal } : {}),
        ...(Number.isSafeInteger(p.answerOrder) ? { answerOrder: p.answerOrder } : {})
      };
      let stat;
      if (body.protocol === 3 && replaceSentenceStat && reducePracticeEvents) {
        db.prepare('INSERT OR IGNORE INTO user_learning_baselines(user_id,sentence_key,baseline_json) VALUES(?,?,?)')
          .run(userId, p.key, JSON.stringify(priorStat));
        db.prepare('INSERT INTO user_learning_events(user_id,sentence_key,event_id,generation,event_json,received_at) VALUES(?,?,?,?,?,?)')
          .run(userId, p.key, p.eventId, generation, JSON.stringify(learningEvent), receivedAt);
        const generationBaseline = db.prepare(`INSERT OR IGNORE INTO user_learning_generation_baselines
          (user_id,scope_key,sentence_key,generation,baseline_json) VALUES(?,?,?,?,?)`);
        const legacyBaseline = generation === 0
          ? db.prepare('SELECT baseline_json FROM user_learning_baselines WHERE user_id=? AND sentence_key=?').get(userId, p.key)
          : null;
        generationBaseline.run(userId, scopeKey, p.key, generation,
          legacyBaseline ? legacyBaseline.baseline_json : JSON.stringify(priorStat));
        const baselineRow = db.prepare(`SELECT baseline_json FROM user_learning_generation_baselines
          WHERE user_id=? AND scope_key=? AND sentence_key=? AND generation=?`).get(userId, scopeKey, p.key, generation);
        const acceptedRows = db.prepare('SELECT event_json FROM user_learning_events WHERE user_id=? AND sentence_key=? AND generation=?').all(userId, p.key, generation);
        const replay = reducePracticeEvents(JSON.parse(baselineRow.baseline_json), acceptedRows.map(item => JSON.parse(item.event_json)), { srs });
        stat = replay.stat;
      } else {
        stat = Object.assign({}, priorStat);
        stat.times = (Number(stat.times) || 0) + 1;
        stat.okTimes = (Number(stat.okTimes) || 0) + (p.ok ? 1 : 0);
        stat.wrongTimes = (Number(stat.wrongTimes) || 0) + (p.ok ? 0 : 1);
        stat.streak = p.ok ? (Number(stat.streak) || 0) + 1 : 0;
        stat.maxStreak = Math.max(Number(stat.maxStreak) || 0, stat.streak);
        Object.assign(stat, srs.recordResult(stat, p.ok, at));
        stat.lastAt = at;
      }
      stat.deckId = p.deckId;
      const statsRow = db.prepare("SELECT v_json,rev,deleted_at FROM user_kv WHERE user_id=? AND k='stats'").get(userId);
      const stats = statsRow && !statsRow.deleted_at ? JSON.parse(statsRow.v_json) : {};
      stats.totalAnswered = (Number(stats.totalAnswered) || 0) + 1;
      const statsRev = (statsRow && statsRow.rev != null ? statsRow.rev : 0) + 1;
      if (body.protocol === 3 && replaceSentenceStat && reducePracticeEvents) replaceSentenceStat(userId, p.key, stat, seq);
      else upsertSentenceStat(userId, p.key, stat, seq);
      if (p.mistake) upsertEntityRow(userId, 'reinforce', p.mistake.key, p.mistake.row, seq);
      const event = Object.assign({ id: p.eventId, kind: 'answer', key: p.key, ok: p.ok, at, day }, learningEvent);
      upsertEvent(userId, event, seq);
      upsertKv(userId, 'stats', stats, statsRev, false, seq, statsRow && statsRow.rev != null ? statsRow.rev : null);
      return { entity: 'answer', id: p.eventId, key: p.key, stat, totalAnswered: stats.totalAnswered };
    }

    if (body.type === 'learning.resume') {
      if (!hasOnlyKeys(p, ['deckId', 'courseId', 'sessionId', 'generation', 'idx', 'contentCursor', 'practiceMode']) ||
          typeof p.deckId !== 'string' || !p.deckId || p.deckId.length > 200 ||
          typeof p.sessionId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.sessionId) ||
          (p.courseId !== undefined && (typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200)) ||
          (p.generation !== undefined && (!Number.isSafeInteger(p.generation) || p.generation < 0)) ||
          !Number.isSafeInteger(p.idx) || p.idx < 0 || p.idx > 1000000 ||
          (p.contentCursor !== undefined && !['string', 'number'].includes(typeof p.contentCursor)) ||
          (typeof p.contentCursor === 'string' && p.contentCursor.length > 300) ||
          (p.practiceMode !== undefined && (typeof p.practiceMode !== 'string' || p.practiceMode.length > 80))) {
        throw operationError('续学位置无效', 'INVALID_OPERATION', 400);
      }
      const scopeKey = 'course:' + (p.courseId || p.deckId);
      const generation = p.generation === undefined ? 0 : p.generation;
      const activeGeneration = currentGeneration(userId, scopeKey);
      if (generation !== activeGeneration) {
        return { entity: 'learningResume', id: p.sessionId, outcome: 'retained', generation: activeGeneration };
      }
      db.prepare(`INSERT INTO user_learning_resumes(user_id,session_id,deck_id,course_id,generation,idx,content_cursor,practice_mode,updated_at,seq,deleted_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,NULL)
        ON CONFLICT(user_id,session_id) DO UPDATE SET deck_id=excluded.deck_id,course_id=excluded.course_id,
        generation=excluded.generation,idx=excluded.idx,content_cursor=excluded.content_cursor,
        practice_mode=excluded.practice_mode,updated_at=excluded.updated_at,seq=excluded.seq,deleted_at=NULL`)
        .run(userId, p.sessionId, p.deckId, p.courseId || null, generation, p.idx,
          p.contentCursor == null ? null : String(p.contentCursor), p.practiceMode || null, Date.now(), seq);
      return { entity: 'learningResume', id: p.sessionId, deckId: p.deckId, idx: p.idx, generation };
    }

    if (body.type === 'learning.roundComplete') {
      if (!hasOnlyKeys(p, ['eventId', 'timeZone', 'occurredAt', 'sessionId', 'answerCount', 'deckId', 'recordBest']) ||
          typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
          typeof p.timeZone !== 'string' || !p.timeZone || p.timeZone.length > 80 ||
          (p.occurredAt !== undefined && (!Number.isFinite(p.occurredAt) || p.occurredAt <= 0)) ||
          (p.sessionId !== undefined && (typeof p.sessionId !== 'string' || !p.sessionId || p.sessionId.length > 160)) ||
          (p.answerCount !== undefined && (!Number.isSafeInteger(p.answerCount) || p.answerCount < 1 || p.answerCount > 100000 || !p.sessionId)) ||
          (p.deckId !== undefined && (typeof p.deckId !== 'string' || !p.deckId || p.deckId.length > 200)) ||
          (p.recordBest !== undefined && typeof p.recordBest !== 'boolean') ||
          (p.recordBest === true && (!p.deckId || p.answerCount === undefined))) {
        throw operationError('练习轮次记录无效', 'INVALID_OPERATION', 400);
      }
      let metrics = null;
      if (p.answerCount !== undefined) {
        const sessionAnswers = db.prepare(`SELECT event_json FROM user_learning_events
          WHERE user_id=? AND json_extract(event_json, '$.type')='practice'
            AND json_extract(event_json, '$.sessionId')=?`).all(userId, p.sessionId)
          .map(row => JSON.parse(row.event_json));
        if (sessionAnswers.length !== p.answerCount) throw operationError('本轮答题尚未全部到达服务器', 'ROUND_INCOMPLETE', 409);
        const ordered = sessionAnswers.slice().sort((left, right) => left.answerOrder - right.answerOrder);
        let chunkRight = 0, chunkTotal = 0, combo = 0, maxCombo = 0, perfectCount = 0;
        for (let index = 0; index < ordered.length; index++) {
          const event = ordered[index];
          if (event.answerOrder !== index || !Number.isSafeInteger(event.chunkRight) ||
              !Number.isSafeInteger(event.chunkTotal) || event.chunkRight < 0 || event.chunkTotal < 0 ||
              event.chunkRight > event.chunkTotal) {
            throw operationError('本轮答题证据不完整，暂不能结算', 'ROUND_EVIDENCE_INCOMPLETE', 409);
          }
          chunkRight += event.chunkRight;
          chunkTotal += event.chunkTotal;
          combo = event.ok ? combo + 1 : 0;
          if (event.ok) perfectCount++;
          maxCombo = Math.max(maxCombo, combo);
        }
        metrics = { answerCount: ordered.length, chunkRight, chunkTotal,
          accuracy: chunkTotal ? Math.round(chunkRight / chunkTotal * 100) : 0, maxCombo, perfectCount };
      }
      const receivedAt = Date.now();
      const suppliedAt = Number(p.occurredAt);
      const now = Number.isFinite(suppliedAt) && suppliedAt > 0 && suppliedAt <= receivedAt + 5 * 60 * 1000
        ? suppliedAt : receivedAt;
      let parts;
      try {
        parts = new Intl.DateTimeFormat('en-CA', { timeZone: p.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      } catch (_) { throw operationError('时区名称无效', 'INVALID_OPERATION', 400); }
      const datePart = name => parts.find(part => part.type === name).value;
      const day = datePart('year') + '-' + datePart('month') + '-' + datePart('day');
      const statsRow = db.prepare("SELECT v_json,rev,deleted_at FROM user_kv WHERE user_id=? AND k='stats'").get(userId);
      const stats = statsRow && !statsRow.deleted_at ? JSON.parse(statsRow.v_json) : {};
      stats.totalRounds = (Number(stats.totalRounds) || 0) + 1;
      stats.daysLog = object(stats.daysLog) ? stats.daysLog : {};
      const slot = object(stats.daysLog[day]) ? stats.daysLog[day] : { rounds: 0 };
      slot.rounds = (Number(slot.rounds) || 0) + 1;
      stats.daysLog[day] = slot;
      const rev = (statsRow && statsRow.rev != null ? statsRow.rev : 0) + 1;
      let best = null;
      if (p.recordBest === true && metrics) {
        const bestRow = db.prepare("SELECT v_json,rev,deleted_at FROM user_kv WHERE user_id=? AND k='best'").get(userId);
        const bestMap = bestRow && !bestRow.deleted_at ? JSON.parse(bestRow.v_json) : {};
        const previous = object(bestMap[p.deckId]) ? bestMap[p.deckId] : {};
        const improved = metrics.accuracy > (Number(previous.acc) || 0) ||
          (metrics.accuracy === (Number(previous.acc) || 0) && metrics.maxCombo > (Number(previous.combo) || 0));
        best = {
          acc: improved ? metrics.accuracy : (Number(previous.acc) || 0),
          perfect: improved ? metrics.perfectCount : (Number(previous.perfect) || 0),
          combo: improved ? metrics.maxCombo : (Number(previous.combo) || 0),
          lastPlayed: now, lastAcc: metrics.accuracy
        };
        bestMap[p.deckId] = best;
        const bestRev = (bestRow && bestRow.rev != null ? bestRow.rev : 0) + 1;
        upsertKv(userId, 'best', bestMap, bestRev, false, seq, bestRow && bestRow.rev != null ? bestRow.rev : null);
      }
      upsertEvent(userId, Object.assign({ id: p.eventId, kind: 'round', at: now, receivedAt,
        sessionId: p.sessionId || p.eventId, day, ...(p.deckId ? { deckId: p.deckId } : {}) }, metrics || {}), seq);
      if (p.sessionId) db.prepare('UPDATE user_learning_resumes SET deleted_at=?,seq=? WHERE user_id=? AND session_id=? AND deleted_at IS NULL')
        .run(receivedAt, seq, userId, p.sessionId);
      upsertKv(userId, 'stats', stats, rev, false, seq, statsRow && statsRow.rev != null ? statsRow.rev : null);
      return Object.assign({ entity: 'round', id: p.eventId, day, totalRounds: stats.totalRounds,
        ...(best ? { deckId: p.deckId, best } : {}) }, metrics || {});
    }

    return null;
  }

  return Object.freeze({ apply });
}

module.exports = { createLearningEventOperations };
