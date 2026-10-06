'use strict';

const MAX_JOINED_COURSES = 3;

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createCourseEnrollmentOperations(options) {
  const db = options.db;
  const upsertCourseProgress = options.upsertCourseProgress;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    if (body.type !== 'course.enrollment') return null;
    const payload = body.payload;
    if (!hasOnlyKeys(payload, ['courseId', 'joined'])) {
      throw operationError('课程加入状态包含不支持的字段', 'INVALID_OPERATION', 400);
    }
    if (typeof payload.courseId !== 'string' || !payload.courseId || payload.courseId.length > 200 ||
        typeof payload.joined !== 'boolean') {
      throw operationError('课程加入状态无效', 'INVALID_OPERATION', 400);
    }
    const id = 'enrollment:v1:' + encodeURIComponent(payload.courseId);
    const row = db.prepare('SELECT data_json,rev FROM user_course_progress WHERE user_id=? AND course_id=? AND deleted_at IS NULL')
      .get(userId, id);
    const prior = row ? JSON.parse(row.data_json) : null;
    if (payload.joined && !(prior && prior.kind === 'course-enrollment' && prior.joined)) {
      const rows = db.prepare('SELECT course_id,data_json FROM user_course_progress WHERE user_id=? AND deleted_at IS NULL').all(userId);
      const joined = new Set();
      rows.forEach(item => {
        try {
          const membership = JSON.parse(item.data_json);
          if (membership && membership.kind === 'course-enrollment' && membership.schemaVersion === 1 &&
              membership.joined === true && typeof membership.courseId === 'string' &&
              item.course_id === 'enrollment:v1:' + encodeURIComponent(membership.courseId)) joined.add(membership.courseId);
        } catch (_) { /* Ignore unrelated or malformed progress rows. */ }
      });
      if (joined.size >= MAX_JOINED_COURSES) {
        throw operationError('最多加入 3 门课程；请先移出一门，再加入新课程。', 'COURSE_LIMIT_REACHED', 409);
      }
    }
    const timestamp = Date.now();
    const value = {
      kind: 'course-enrollment', schemaVersion: 1, courseId: payload.courseId, joined: payload.joined,
      joinedAt: prior && prior.joinedAt || timestamp,
      changedAt: timestamp
    };
    const rev = (row && row.rev != null ? row.rev : 0) + 1;
    upsertCourseProgress(userId, id, value, rev, false, seq, row && row.rev != null ? row.rev : null);
    return { entity: 'courseProgress', id, rev };
  }

  return Object.freeze({ apply });
}

module.exports = { createCourseEnrollmentOperations };
