'use strict';

const validate = require('../validate');

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createContentOperations(options) {
  const db = options.db;
  const upsertCourseProgress = options.upsertCourseProgress;
  const upsertDeck = options.upsertDeck;
  const upsertCourse = options.upsertCourse;
  const upsertKv = options.upsertKv;
  const deleteSentenceStat = options.deleteSentenceStat;
  const upsertEntityRow = options.upsertEntityRow;
  const deleteEntityRow = options.deleteEntityRow;
  const currentGeneration = options.currentGeneration;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    const payload = body.payload;
    if (body.type === 'deck.put' || body.type === 'course.put') {
      const isDeck = body.type === 'deck.put';
      const key = isDeck ? 'deck' : 'course';
      const entity = isDeck ? 'decks' : 'courses';
      const id = isDeck ? payload[key] && payload[key].id : payload[key] && payload[key].courseId;
      const writer = isDeck ? upsertDeck : upsertCourse;
      if (!hasOnlyKeys(payload, isDeck ? [key, 'clearRetiredMarker'] : [key]) || !writer ||
          !Object.hasOwn(body, 'expectedRev') ||
          (body.expectedRev !== null && (!Number.isSafeInteger(body.expectedRev) || body.expectedRev < 0)) ||
          (Object.hasOwn(payload, 'clearRetiredMarker') && (typeof payload.clearRetiredMarker !== 'boolean' || !isDeck)) ||
          (payload.clearRetiredMarker === true && !deleteEntityRow) ||
          typeof id !== 'string' || !id || id.length > 200) {
        throw operationError('内容保存需要完整实体和预期版本', 'INVALID_OPERATION', 400);
      }
      if (isDeck) {
        const error = validate.validateMem({ decks: [payload.deck] });
        if (error) throw operationError('题库内容无效：' + error, 'INVALID_OPERATION', 400);
      } else {
        const error = validate.validateCourse(payload.course);
        if (error) throw operationError('课程内容无效：' + error, 'INVALID_OPERATION', 400);
      }
      const table = isDeck ? 'user_decks' : 'user_courses';
      const idColumn = isDeck ? 'id' : 'course_id';
      const current = db.prepare('SELECT rev,deleted_at' + (isDeck ? '' : ',data_json') + ' FROM ' + table +
        ' WHERE user_id=? AND ' + idColumn + '=?').get(userId, id);
      const currentRev = current && current.rev != null ? Number(current.rev) : null;
      if (currentRev !== body.expectedRev) {
        throw operationError('内容已在其他页面更新；本次修改未覆盖服务器版本', 'ENTITY_CHANGED', 409,
          [{ entity, id, expectedRev: body.expectedRev, currentRev, deleted: !!(current && current.deleted_at) }]);
      }
      const rev = (currentRev == null ? 0 : currentRev) + 1;
      writer(userId, payload[key], rev, false, seq, body.expectedRev);
      if (!isDeck && current && !current.deleted_at &&
          JSON.parse(current.data_json || '{}').version !== payload.course.version) {
        if (!upsertCourseProgress) throw operationError('课程版本更新时的进度保护暂不可用', 'OPERATION_NOT_SUPPORTED', 428);
        const scopeKey = 'course:' + id;
        const generation = currentGeneration(userId, scopeKey) + 1;
        const progressRow = db.prepare('SELECT data_json,rev,deleted_at FROM user_course_progress WHERE user_id=? AND course_id=?')
          .get(userId, id);
        const previous = progressRow && !progressRow.deleted_at ? JSON.parse(progressRow.data_json || '{}') : {};
        const history = Array.isArray(previous.history) ? previous.history.slice() : [];
        if ((Array.isArray(previous.seen) && previous.seen.length) || (Array.isArray(previous.passed) && previous.passed.length) || previous.completed) {
          history.push({ generation: Number(previous.generation) || currentGeneration(userId, scopeKey),
            seen: Array.isArray(previous.seen) ? previous.seen.slice() : [],
            passed: Array.isArray(previous.passed) ? previous.passed.slice() : [],
            completed: previous.completed === true, completedAt: Number(previous.completedAt) || 0,
            restartedAt: Date.now() });
        }
        const progress = { generation, seen: [], passed: [], completed: false, history, courseVersion: payload.course.version || '' };
        const progressRev = (progressRow && progressRow.rev != null ? Number(progressRow.rev) : 0) + 1;
        db.prepare(`INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,?)
          ON CONFLICT(user_id,scope_key) DO UPDATE SET generation=excluded.generation,updated_at=datetime('now')`)
          .run(userId, scopeKey, generation);
        upsertCourseProgress(userId, id, progress, progressRev, false, seq,
          progressRow && progressRow.rev != null ? Number(progressRow.rev) : null);
      }
      if (payload.clearRetiredMarker === true) deleteEntityRow(userId, 'deletedItem', 'ai-course-retired:' + id, seq);
      return { entity, id, rev, deleted: false,
        ...(payload.clearRetiredMarker === true ? { retiredMarkerCleared: true } : {}) };
    }

    if (body.type === 'deck.publish') {
      if (!hasOnlyKeys(payload, ['deckId', 'publish']) || typeof payload.deckId !== 'string' || !payload.deckId ||
          payload.deckId.length > 64 || typeof payload.publish !== 'boolean' ||
          !Number.isSafeInteger(body.expectedRev) || body.expectedRev < 0) {
        throw operationError('题库发布需要编号、发布状态和预期版本', 'INVALID_OPERATION', 400);
      }
      const current = db.prepare('SELECT rev,is_public,deleted_at FROM user_decks WHERE user_id=? AND id=?')
        .get(userId, payload.deckId);
      const currentRev = current && current.rev != null ? Number(current.rev) : null;
      if (!current || current.deleted_at || currentRev !== body.expectedRev) {
        throw operationError('题库已变化或已删除；发布状态未更改', 'ENTITY_CHANGED', 409,
          [{ entity: 'decks', id: payload.deckId, expectedRev: body.expectedRev, currentRev,
            deleted: !!(current && current.deleted_at) }]);
      }
      const rev = currentRev + 1;
      db.prepare("UPDATE user_decks SET is_public=?,rev=?,updated_at=datetime('now'),seq=? WHERE user_id=? AND id=? AND deleted_at IS NULL")
        .run(payload.publish ? 1 : 0, rev, seq, userId, payload.deckId);
      return { entity: 'decks', id: payload.deckId, rev, isPublic: payload.publish };
    }

    if (body.type === 'deck.delete' || body.type === 'course.delete') {
      const isDeck = body.type === 'deck.delete';
      const key = isDeck ? 'deckId' : 'courseId';
      const entity = isDeck ? 'decks' : 'courses';
      const writer = isDeck ? upsertDeck : upsertCourse;
      if (!hasOnlyKeys(payload, [key]) || !writer || !Object.hasOwn(body, 'expectedRev') ||
          (body.expectedRev !== null && (!Number.isSafeInteger(body.expectedRev) || body.expectedRev < 0)) ||
          typeof payload[key] !== 'string' || !payload[key] || payload[key].length > 200) {
        throw operationError('内容删除需要实体编号和预期版本', 'INVALID_OPERATION', 400);
      }
      const id = payload[key];
      const table = isDeck ? 'user_decks' : 'user_courses';
      const idColumn = isDeck ? 'id' : 'course_id';
      const current = db.prepare('SELECT rev,deleted_at FROM ' + table + ' WHERE user_id=? AND ' + idColumn + '=?')
        .get(userId, id);
      const currentRev = current && current.rev != null ? Number(current.rev) : null;
      if (!current || current.deleted_at || currentRev !== body.expectedRev) {
        throw operationError('内容已变化或已删除；本次删除未执行', 'ENTITY_CHANGED', 409,
          [{ entity, id, expectedRev: body.expectedRev, currentRev, deleted: !!(current && current.deleted_at) }]);
      }
      const rev = currentRev + 1;
      writer(userId, isDeck ? { id } : { courseId: id }, rev, true, seq, body.expectedRev);
      if (!deleteSentenceStat || !deleteEntityRow || !upsertCourseProgress) {
        throw operationError('内容学习记录清理暂不可用', 'OPERATION_NOT_SUPPORTED', 428);
      }
      const scopeKey = 'course:' + id;
      const generation = currentGeneration(userId, scopeKey) + 1;
      db.prepare(`INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,?)
        ON CONFLICT(user_id,scope_key) DO UPDATE SET generation=excluded.generation,updated_at=datetime('now')`)
        .run(userId, scopeKey, generation);
      const sentencePrefix = id + '#';
      const stats = db.prepare(`SELECT sentence_key FROM user_sentence_stats
        WHERE user_id=? AND deleted_at IS NULL AND substr(sentence_key,1,?)=?`)
        .all(userId, sentencePrefix.length, sentencePrefix);
      stats.forEach(row => deleteSentenceStat(userId, row.sentence_key, seq));
      const entityRows = db.prepare(`SELECT kind,item_key FROM user_entity_rows
        WHERE user_id=? AND deleted_at IS NULL AND ((kind='mastered' AND substr(item_key,1,?)=?) OR (kind='reinforce' AND substr(item_key,1,?)=?))`)
        .all(userId, sentencePrefix.length, sentencePrefix, (id + '::').length, id + '::');
      entityRows.forEach(row => deleteEntityRow(userId, row.kind, row.item_key, seq));
      db.prepare(`UPDATE user_learning_resumes SET deleted_at=datetime('now'),updated_at=?,seq=?
        WHERE user_id=? AND (course_id=? OR deck_id=?) AND deleted_at IS NULL`).run(Date.now(), seq, userId, id, id);
      const progressIds = isDeck ? ['enrollment:v1:' + encodeURIComponent(id)] :
        [id, 'enrollment:v1:' + encodeURIComponent(id)];
      progressIds.forEach(progressId => {
        const progressRow = db.prepare('SELECT rev,deleted_at FROM user_course_progress WHERE user_id=? AND course_id=?')
          .get(userId, progressId);
        if (!progressRow || progressRow.deleted_at) return;
        const progressRev = progressRow.rev == null ? null : Number(progressRow.rev);
        upsertCourseProgress(userId, progressId, null, (progressRev == null ? 0 : progressRev) + 1, true, seq, progressRev);
      });
      if (isDeck && upsertKv) {
        const bestRow = db.prepare("SELECT v_json,rev,deleted_at FROM user_kv WHERE user_id=? AND k='best'").get(userId);
        if (bestRow && !bestRow.deleted_at) {
          let best = {};
          try { best = JSON.parse(bestRow.v_json) || {}; } catch (_) { /* Keep malformed legacy best data safely empty. */ }
          if (Object.prototype.hasOwnProperty.call(best, id)) {
            delete best[id];
            const bestRev = bestRow.rev == null ? null : Number(bestRow.rev);
            upsertKv(userId, 'best', best, (bestRev == null ? 0 : bestRev) + 1, false, seq, bestRev);
          }
        }
      }
      return { entity, id, rev, deleted: true, generation, removedProgressRows: stats.length };
    }
    return null;
  }

  return Object.freeze({ apply });
}

module.exports = { createContentOperations };
