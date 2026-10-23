'use strict';
const crypto = require('node:crypto');

function createExpressionSessionService({ db, repository, runtime, authorize, now = Date.now, id = () => crypto.randomUUID() }) {
  const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });
  const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const parse = value => JSON.parse(value);
  function read(sessionId, userId) {
    const row = db.prepare('SELECT * FROM expression_sessions WHERE session_id=? AND user_id=?').get(sessionId, userId);
    if (!row) throw fail('EXPRESSION_SESSION_NOT_FOUND', 404);
    const release = repository.release(row.course_id, row.release_id);
    const state = parse(row.state_json);
    return { row, release, state, lesson: lessonFor(row, release) };
  }
  function lessonFor(row, release) {
    const original = release.package.lessons.find(item => item.lessonId === row.lesson_id);
    if (!original) throw fail('EXPRESSION_LESSON_NOT_FOUND', 404);
    if (row.mode !== 'review') return original;
    const activity = original.activities.find(item => item.id === row.review_activity_id && item.skillIds?.includes(row.review_skill_id));
    if (!activity || !['independent_output', 'transfer_test', 'listening_choice'].includes(activity.type)) throw fail('EXPRESSION_REVIEW_NOT_FOUND', 404);
    return { ...original, activities: [activity] };
  }
  function response(row, release, state, result = null) {
    return { sessionId: row.session_id, courseId: row.course_id, releaseId: row.release_id, lessonId: row.lesson_id,
      revision: row.revision, stepCount: state.activities.length, mode: row.mode || 'learn', result, state: runtime.publicExpressionState(state), title: release.package.title };
  }
  function start({ courseId, lessonId, releaseId, mode = 'learn', accessSessionId, requestId, reviewSkillId, reviewActivityId }, userId) {
    if (!userId || !['learn', 'review'].includes(mode)) throw fail('INVALID_EXPRESSION_SESSION');
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '')) throw fail('INVALID_EXPRESSION_REQUEST');
    const payloadHash = hash({ courseId, lessonId, releaseId: releaseId || null, mode, reviewSkillId: reviewSkillId || null, reviewActivityId: reviewActivityId || null });
    const course = db.prepare('SELECT active_release AS releaseId,status FROM expression_courses WHERE course_id=?').get(courseId);
    if (!course) throw fail('EXPRESSION_COURSE_NOT_FOUND', 404);
    const permission = authorize(courseId, userId, accessSessionId);
    if (!permission.allowed) throw Object.assign(fail(permission.reasonCode, permission.status || 403), permission);
    const priorStart = db.prepare('SELECT * FROM expression_sessions WHERE user_id=? AND start_request_id=?').get(userId, requestId);
    if (priorStart) {
      if (priorStart.start_payload_hash !== payloadHash) throw fail('IDEMPOTENCY_CONFLICT', 409);
      return response(priorStart, repository.release(priorStart.course_id, priorStart.release_id), parse(priorStart.state_json));
    }
    if (!releaseId && mode === 'learn') {
      const unfinished = db.prepare("SELECT * FROM expression_sessions WHERE user_id=? AND course_id=? AND lesson_id=? AND mode='learn' ORDER BY updated_at DESC")
        .all(userId, courseId, lessonId).find(row => !parse(row.state_json).completed);
      if (unfinished) {
        return response(unfinished, repository.release(unfinished.course_id, unfinished.release_id), parse(unfinished.state_json));
      }
    }
    if (course.status === 'unlisted' && !releaseId) throw fail('EXPRESSION_COURSE_NOT_FOUND', 404);
    const selectedRelease = releaseId || course.releaseId;
    const release = repository.release(courseId, selectedRelease);
    const lesson = release.package.lessons.find(item => item.lessonId === lessonId);
    if (!lesson) throw fail('EXPRESSION_LESSON_NOT_FOUND', 404);
    let selectedLesson = lesson;
    if (mode === 'review') {
      const ref = release.package.reviewActivities.find(item => item.lessonId === lessonId && item.skillId === reviewSkillId && item.activityId === reviewActivityId);
      const activity = ref && lesson.activities.find(item => item.id === ref.activityId);
      if (!activity || !['independent_output', 'transfer_test', 'listening_choice'].includes(activity.type)) throw fail('EXPRESSION_REVIEW_NOT_FOUND', 404);
      selectedLesson = { ...lesson, activities: [activity] };
    }
    const existing = db.prepare("SELECT * FROM expression_sessions WHERE user_id=? AND course_id=? AND release_id=? AND lesson_id=? AND mode=? ORDER BY updated_at DESC LIMIT 1")
      .get(userId, courseId, selectedRelease, lessonId, mode);
    if (existing && !parse(existing.state_json).completed && existing.review_skill_id === (reviewSkillId || null) && existing.review_activity_id === (reviewActivityId || null)) return response(existing, release, parse(existing.state_json));
    const sessionId = id();
    const state = runtime.createExpressionState(selectedLesson);
    db.prepare(`INSERT INTO expression_sessions(session_id,user_id,course_id,release_id,lesson_id,mode,review_skill_id,review_activity_id,start_request_id,start_payload_hash,revision,state_json,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?)`).run(sessionId, userId, courseId, selectedRelease, lessonId, mode, reviewSkillId || null, reviewActivityId || null, requestId, payloadHash, JSON.stringify(state), new Date(now()).toISOString());
    return response({ session_id: sessionId, course_id: courseId, release_id: selectedRelease, lesson_id: lessonId, mode, revision: 0 }, release, state);
  }
  function get(sessionId, userId, accessSessionId) {
    const { row, release, state } = read(sessionId, userId);
    const permission = authorize(row.course_id, userId, accessSessionId);
    if (!permission.allowed) throw Object.assign(fail(permission.reasonCode, permission.status || 403), permission);
    return response(row, release, state);
  }
  function act(sessionId, userId, { requestId, expectedRevision, action }, accessSessionId) {
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '') || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw fail('INVALID_EXPRESSION_ACTION');
    const payloadHash = hash({ sessionId, expectedRevision, action });
    const tx = db.transaction(() => {
      const prior = db.prepare('SELECT payload_hash,result_json FROM expression_attempts WHERE user_id=? AND request_id=?').get(userId, requestId);
      if (prior) {
        if (prior.payload_hash !== payloadHash) throw fail('IDEMPOTENCY_CONFLICT', 409);
        const { row, release, state } = read(sessionId, userId);
        return response(row, release, state, parse(prior.result_json));
      }
      const { row, release, state } = read(sessionId, userId);
      if (row.revision !== expectedRevision) throw fail('REVISION_CONFLICT', 409);
      const permission = authorize(row.course_id, userId, accessSessionId);
      if (!permission.allowed) throw Object.assign(fail(permission.reasonCode, permission.status || 403), permission);
      const outcome = runtime.transitionExpression(state, action, { now: now() });
      const revision = row.revision + 1, timestamp = new Date(now()).toISOString();
      db.prepare('UPDATE expression_sessions SET revision=?,state_json=?,updated_at=? WHERE session_id=? AND revision=?')
        .run(revision, JSON.stringify(outcome.state), timestamp, sessionId, row.revision);
      for (const skillId of outcome.result.masteredSkills || []) {
        const priorState = db.prepare('SELECT review_step AS reviewStep FROM expression_skill_states WHERE user_id=? AND course_id=? AND release_id=? AND skill_id=?')
          .get(userId, row.course_id, row.release_id, skillId);
        const step = priorState ? priorState.reviewStep : -1;
        const interval = release.package.lessons.find(lesson => lesson.lessonId === row.lesson_id)?.reviewPlan.intervalDays || [1,3,7,14,30];
        const nextStep = Math.min(step + 1, interval.length - 1), dueAt = now() + interval[nextStep] * 86400000;
        db.prepare(`INSERT INTO expression_skill_states(user_id,course_id,release_id,skill_id,status,due_at,review_step,evidence_json)
          VALUES(?,?,?,?,'mastered',?,?,?) ON CONFLICT(user_id,course_id,release_id,skill_id) DO UPDATE SET status='mastered',due_at=excluded.due_at,review_step=excluded.review_step,evidence_json=excluded.evidence_json`)
          .run(userId, row.course_id, row.release_id, skillId, dueAt, nextStep, JSON.stringify(outcome.state.evidence[skillId]));
      }
      if (row.mode === 'review' && ['answer', 'skipped'].includes(outcome.result.kind)) {
        const priorState = db.prepare('SELECT review_step AS reviewStep FROM expression_skill_states WHERE user_id=? AND course_id=? AND release_id=? AND skill_id=?')
          .get(userId, row.course_id, row.release_id, row.review_skill_id);
        const reviewSuccess = !!outcome.result.independent && !!outcome.result.correct;
        const review = runtime.nextReview({ success: reviewSuccess, step: priorState?.reviewStep || 0, now: now(),
          intervals: release.package.lessons.find(item => item.lessonId === row.lesson_id)?.reviewPlan.intervalDays || [1,3,7,14,30] });
        db.prepare(`INSERT INTO expression_skill_states(user_id,course_id,release_id,skill_id,status,due_at,review_step,evidence_json)
          VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,course_id,release_id,skill_id) DO UPDATE SET
          status=excluded.status,due_at=excluded.due_at,review_step=excluded.review_step,evidence_json=excluded.evidence_json`)
          .run(userId, row.course_id, row.release_id, row.review_skill_id, reviewSuccess ? 'mastered' : 'needs_practice', review.dueAt, review.step, JSON.stringify({ lastReviewCorrect: !!outcome.result.correct, activityId: row.review_activity_id }));
      }
      const activity = state.activities[state.index];
      const needsPractice = outcome.result.kind === 'skipped' || outcome.result.kind === 'answer' &&
        (!outcome.result.correct || activity?.stage === 'independent' && !outcome.result.independent);
      if (needsPractice && row.mode !== 'review') {
        for (const skillId of activity.skillIds || []) db.prepare(`INSERT INTO expression_skill_states(user_id,course_id,release_id,skill_id,status,due_at,review_step,evidence_json)
          VALUES(?,?,?,?,'needs_practice',?,0,'{}') ON CONFLICT(user_id,course_id,release_id,skill_id) DO UPDATE SET status='needs_practice',due_at=excluded.due_at,review_step=0`)
          .run(userId, row.course_id, row.release_id, skillId, now() + 86400000);
      }
      if (row.mode !== 'review' && !state.completed && outcome.state.completed) {
        const lesson = release.package.lessons.find(item => item.lessonId === row.lesson_id);
        const firstInterval = lesson.reviewPlan.intervalDays[0];
        for (const skillId of lesson.taughtSkillIds) db.prepare(`INSERT INTO expression_skill_states(user_id,course_id,release_id,skill_id,status,due_at,review_step,evidence_json)
          VALUES(?,?,?,?,'needs_practice',?,0,?) ON CONFLICT(user_id,course_id,release_id,skill_id) DO NOTHING`)
          .run(userId, row.course_id, row.release_id, skillId, now() + firstInterval * 86400000, JSON.stringify(outcome.state.evidence[skillId] || {}));
      }
      const result = { ...outcome.result, completed: outcome.state.completed };
      db.prepare('INSERT INTO expression_attempts(user_id,request_id,session_id,payload_hash,result_json) VALUES(?,?,?,?,?)')
        .run(userId, requestId, sessionId, payloadHash, JSON.stringify(result));
      return response({ ...row, revision }, release, outcome.state, result);
    });
    return tx.immediate();
  }
  function due(userId) {
    const states = db.prepare(`SELECT s.course_id AS courseId,s.release_id AS releaseId,s.skill_id AS skillId,s.due_at AS dueAt,c.title
      FROM expression_skill_states s JOIN expression_courses c USING(course_id)
      WHERE s.user_id=? AND s.due_at<=? ORDER BY s.due_at LIMIT 100`).all(userId, now());
    return states.flatMap(state => {
      const release = repository.release(state.courseId, state.releaseId);
      return release.package.reviewActivities.filter(item => item.skillId === state.skillId).slice(0, 1).map(item => ({ ...state, lessonId: item.lessonId, activityId: item.activityId }));
    });
  }
  function progress(courseId, userId) {
    const course = repository.findCourse(courseId);
    if (!course) throw fail('EXPRESSION_COURSE_NOT_FOUND', 404);
    const release = repository.release(courseId, course.releaseId);
    const rows = db.prepare("SELECT lesson_id,state_json FROM expression_sessions WHERE user_id=? AND course_id=? AND mode='learn' ORDER BY updated_at DESC").all(userId, courseId);
    const lessons = release.package.lessons.map(lesson => {
      const states = rows.filter(row => row.lesson_id === lesson.lessonId).map(row => parse(row.state_json));
      const completed = states.some(state => state.completed);
      const latest = states[0];
      const percent = completed ? 100 : latest ? Math.min(99, Math.floor(latest.index / Math.max(1, latest.activities.length) * 100)) : 0;
      return { lessonId: lesson.lessonId, status: completed ? 'completed' : latest ? 'in_progress' : 'not_started', percent };
    });
    const completed = lessons.filter(lesson => lesson.status === 'completed').length;
    const wrongLessonIds = [...new Set(db.prepare("SELECT s.lesson_id,a.result_json FROM expression_attempts a JOIN expression_sessions s ON s.session_id=a.session_id WHERE a.user_id=? AND s.course_id=?").all(userId,courseId).filter(row=>parse(row.result_json).correct===false).map(row=>row.lesson_id))].filter(id=>lessons.some(lesson=>lesson.lessonId===id));
    return { lessons, wrongLessonIds, completed, total: lessons.length, percent: lessons.length ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.percent, 0) / lessons.length) : 0,
      nextLessonId: (lessons.find(lesson => lesson.status === 'in_progress') || lessons.find(lesson => lesson.status === 'not_started') || lessons[0])?.lessonId };
  }
  return { start, get, act, due, progress };
}

module.exports = { createExpressionSessionService };
