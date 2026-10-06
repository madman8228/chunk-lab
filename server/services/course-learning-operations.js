'use strict';

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createCourseLearningOperations(options) {
  const db = options.db;
  const upsertCourseProgress = options.upsertCourseProgress;
  const upsertEvent = options.upsertEvent;
  const replaceSentenceStat = options.replaceSentenceStat;
  const currentGeneration = options.currentGeneration;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    const p = body.payload;

    if (body.type === 'course.restart') {
      if (!hasOnlyKeys(p, ['eventId', 'courseId', 'currentNodeId']) ||
          typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
          typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200 ||
          (p.currentNodeId !== undefined && (typeof p.currentNodeId !== 'string' || p.currentNodeId.length > 200))) {
        throw operationError('课程重学操作无效', 'INVALID_OPERATION', 400);
      }
      const removedCourse = db.prepare('SELECT deleted_at FROM user_courses WHERE user_id=? AND course_id=?').get(userId, p.courseId);
      if (removedCourse && removedCourse.deleted_at) {
        throw operationError('课程已删除，不能继续记录学习进度', 'COURSE_DELETED', 409);
      }
      const scopeKey = 'course:' + p.courseId;
      const generation = currentGeneration(userId, scopeKey) + 1;
      const row = db.prepare('SELECT data_json,rev FROM user_course_progress WHERE user_id=? AND course_id=?').get(userId, p.courseId);
      const previous = row && row.data_json ? JSON.parse(row.data_json) : {};
      const history = Array.isArray(previous.history) ? previous.history.slice() : [];
      if ((Array.isArray(previous.seen) && previous.seen.length) || (Array.isArray(previous.passed) && previous.passed.length) || previous.completed) {
        history.push({ generation: Number(previous.generation) || currentGeneration(userId, scopeKey),
          seen: Array.isArray(previous.seen) ? previous.seen.slice() : [],
          passed: Array.isArray(previous.passed) ? previous.passed.slice() : [], completed: previous.completed === true,
          completedAt: Number(previous.completedAt) || 0, restartedAt: Date.now() });
      }
      const progress = { generation, seen: [], passed: [], completed: false, history };
      if (p.currentNodeId) progress.currentNodeId = p.currentNodeId;
      const rev = (row && row.rev != null ? row.rev : 0) + 1;
      db.prepare("INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,?) ON CONFLICT(user_id,scope_key) DO UPDATE SET generation=excluded.generation,updated_at=datetime('now')")
        .run(userId, scopeKey, generation);
      upsertCourseProgress(userId, p.courseId, progress, rev, false, seq, row && row.rev != null ? row.rev : null);
      upsertEvent(userId, { id: p.eventId, kind: 'courseRestart', courseId: p.courseId, generation, at: Date.now() }, seq);
      return { entity: 'courseProgress', id: p.courseId, rev, generation };
    }

    if (body.type === 'learning.reset') {
      if (!hasOnlyKeys(p, ['eventId', 'courseId', 'expectedGeneration']) ||
          typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
          typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200 ||
          !Number.isSafeInteger(p.expectedGeneration) || p.expectedGeneration < 0) {
        throw operationError('学习记录重置请求无效', 'INVALID_OPERATION', 400);
      }
      const scopeKey = 'course:' + p.courseId;
      const activeGeneration = currentGeneration(userId, scopeKey);
      if (p.expectedGeneration !== activeGeneration) {
        throw operationError('学习记录已更新，请刷新后再重置', 'GENERATION_CHANGED', 409,
          [{ entity: 'learningGeneration', id: p.courseId, expectedGeneration: p.expectedGeneration, currentGeneration: activeGeneration }]);
      }
      const nextGeneration = activeGeneration + 1;
      const prefix = p.courseId + '#';
      const rows = db.prepare(`SELECT sentence_key,data_json FROM user_sentence_stats
        WHERE user_id=? AND deleted_at IS NULL AND substr(sentence_key,1,?)=? ORDER BY sentence_key`)
        .all(userId, prefix.length, prefix);
      const emptyBaseline = row => {
        let prior = {};
        try { prior = JSON.parse(row.data_json) || {}; } catch (_) { /* A reset replaces malformed projection with a clean state. */ }
        return { deckId: typeof prior.deckId === 'string' ? prior.deckId : p.courseId,
          times: 0, okTimes: 0, wrongTimes: 0, streak: 0, maxStreak: 0, lastAt: 0,
          interval: 1, ease: 2.5, dueAt: 0,
          learningV1: { version: 1, evidence: [], baselineAt: Date.now(), lastExposureAt: 0, interval: 1, ease: 2.5, repetition: 0 }
        };
      };
      db.prepare(`INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,?)
        ON CONFLICT(user_id,scope_key) DO UPDATE SET generation=excluded.generation,updated_at=datetime('now')`)
        .run(userId, scopeKey, nextGeneration);
      const saveBaseline = db.prepare(`INSERT INTO user_learning_generation_baselines
        (user_id,scope_key,sentence_key,generation,baseline_json) VALUES(?,?,?,?,?)`);
      rows.forEach(row => {
        const baseline = emptyBaseline(row);
        saveBaseline.run(userId, scopeKey, row.sentence_key, nextGeneration, JSON.stringify(baseline));
        replaceSentenceStat(userId, row.sentence_key, baseline, seq);
      });
      upsertEvent(userId, { id: p.eventId, kind: 'learningReset', courseId: p.courseId,
        generation: nextGeneration, resetSentenceCount: rows.length, at: Date.now() }, seq);
      return { entity: 'learningReset', id: p.courseId, generation: nextGeneration, resetSentenceCount: rows.length };
    }

    if (body.type === 'course.progress') {
      if (!hasOnlyKeys(p, ['courseId', 'nodeId', 'passed', 'completed', 'currentNodeId', 'courseVersion', 'runtimeProfile', 'generation'])) {
        throw operationError('课程进度包含不支持的字段', 'INVALID_OPERATION', 400);
      }
      if (typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200 ||
          (p.nodeId != null && (typeof p.nodeId !== 'string' || p.nodeId.length > 200)) ||
          (p.currentNodeId != null && (typeof p.currentNodeId !== 'string' || p.currentNodeId.length > 200)) ||
          (p.generation !== undefined && (!Number.isSafeInteger(p.generation) || p.generation < 0)) ||
          typeof p.passed !== 'boolean' || typeof p.completed !== 'boolean') {
        throw operationError('课程进度内容无效', 'INVALID_OPERATION', 400);
      }
      const removedCourse = db.prepare('SELECT deleted_at FROM user_courses WHERE user_id=? AND course_id=?').get(userId, p.courseId);
      if (removedCourse && removedCourse.deleted_at) {
        return { entity: 'courseProgress', id: p.courseId, outcome: 'retained', generation: currentGeneration(userId, 'course:' + p.courseId) };
      }
      const activeGeneration = currentGeneration(userId, 'course:' + p.courseId);
      if ((p.generation === undefined ? 0 : p.generation) !== activeGeneration) {
        return { entity: 'courseProgress', id: p.courseId, outcome: 'retained', generation: activeGeneration };
      }
      const row = db.prepare('SELECT data_json,rev,deleted_at FROM user_course_progress WHERE user_id=? AND course_id=?').get(userId, p.courseId);
      const progress = row && !row.deleted_at ? JSON.parse(row.data_json) : {};
      const seen = new Set(Array.isArray(progress.seen) ? progress.seen : []);
      const passed = new Set(Array.isArray(progress.passed) ? progress.passed : []);
      if (p.nodeId) {
        seen.add(p.nodeId);
        if (p.passed) passed.add(p.nodeId);
      }
      if (p.courseVersion != null && typeof p.courseVersion !== 'string') {
        throw operationError('课程版本无效', 'INVALID_OPERATION', 400);
      }
      progress.seen = Array.from(seen);
      progress.passed = Array.from(passed);
      progress.completed = !!progress.completed || p.completed;
      if (p.currentNodeId) progress.currentNodeId = p.currentNodeId;
      if (p.courseVersion) progress.courseVersion = p.courseVersion;
      if (p.runtimeProfile) progress.runtimeProfile = String(p.runtimeProfile).slice(0, 80);
      const rev = (row && row.rev != null ? row.rev : 0) + 1;
      upsertCourseProgress(userId, p.courseId, progress, rev, false, seq, row && row.rev != null ? row.rev : null);
      return { entity: 'courseProgress', id: p.courseId, rev };
    }

    if (body.type === 'course.progress.restore') {
      if (!hasOnlyKeys(p, ['courseId', 'progress', 'expectedGeneration']) || !Object.hasOwn(body, 'expectedRev') ||
          body.expectedRev !== null || typeof p.courseId !== 'string' || !p.courseId || p.courseId.length > 200 ||
          !object(p.progress) || Object.keys(p.progress).length > 50 || Buffer.byteLength(JSON.stringify(p.progress), 'utf8') > 64 * 1024 ||
          (p.expectedGeneration !== undefined && (!Number.isSafeInteger(p.expectedGeneration) || p.expectedGeneration < 0)) ||
          (p.progress.seen !== undefined && (!Array.isArray(p.progress.seen) || p.progress.seen.length > 5000 ||
            p.progress.seen.some(id => typeof id !== 'string' || id.length > 200))) ||
          (p.progress.passed !== undefined && (!Array.isArray(p.progress.passed) || p.progress.passed.length > 5000 ||
            p.progress.passed.some(id => typeof id !== 'string' || id.length > 200))) ||
          (p.progress.completed !== undefined && typeof p.progress.completed !== 'boolean') ||
          (p.progress.currentNodeId !== undefined && (typeof p.progress.currentNodeId !== 'string' || p.progress.currentNodeId.length > 200)) ||
          (p.progress.courseVersion !== undefined && (typeof p.progress.courseVersion !== 'string' || p.progress.courseVersion.length > 120)) ||
          (p.progress.runtimeProfile !== undefined && (typeof p.progress.runtimeProfile !== 'string' || p.progress.runtimeProfile.length > 80))) {
        throw operationError('恢复课程进度内容无效或超过安全限制', 'INVALID_OPERATION', 400);
      }
      const course = db.prepare('SELECT data_json,deleted_at FROM user_courses WHERE user_id=? AND course_id=?').get(userId, p.courseId);
      if (!course || course.deleted_at) {
        throw operationError('课程已不存在；原恢复进度仍保留', 'ENTITY_CHANGED', 409);
      }
      const activeGeneration = currentGeneration(userId, 'course:' + p.courseId);
      if ((p.expectedGeneration === undefined ? 0 : p.expectedGeneration) !== activeGeneration) {
        throw operationError('课程代次已变化；恢复进度未写入', 'ENTITY_CHANGED', 409);
      }
      const courseValue = JSON.parse(course.data_json || '{}');
      if (p.progress.courseVersion && courseValue.version && p.progress.courseVersion !== courseValue.version) {
        throw operationError('课程版本与恢复进度不一致；恢复进度未写入', 'ENTITY_CHANGED', 409);
      }
      const existing = db.prepare('SELECT rev,deleted_at FROM user_course_progress WHERE user_id=? AND course_id=?')
        .get(userId, p.courseId);
      if (existing) {
        throw operationError('课程进度已存在或有删除记录；不会覆盖或恢复该进度', 'ENTITY_CHANGED', 409,
          [{ entity: 'courseProgress', id: p.courseId, expectedRev: null,
            currentRev: existing.rev == null ? null : Number(existing.rev), deleted: !!existing.deleted_at }]);
      }
      const restored = Object.assign({}, p.progress, { generation: activeGeneration });
      upsertCourseProgress(userId, p.courseId, restored, 1, false, seq, null);
      return { entity: 'courseProgress', id: p.courseId, rev: 1, restored: true };
    }

    return null;
  }

  return Object.freeze({ apply });
}

module.exports = { createCourseLearningOperations };
