'use strict';

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createLogicalCourseOperations(options) {
  const db = options.db;
  const upsertEntityRow = options.upsertEntityRow;
  const deleteEntityRow = options.deleteEntityRow;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    const p = body.payload;

    if (body.type === 'logicalCourse.put') {
      const course = p.course;
      if (!hasOnlyKeys(p, ['course', 'expectedSeq']) || !course || typeof course !== 'object' || Array.isArray(course) ||
          (p.expectedSeq !== null && (!Number.isSafeInteger(p.expectedSeq) || p.expectedSeq < 0)) ||
          !hasOnlyKeys(course, ['id', 'title', 'coverImage', 'catalogKey', 'origin', 'contentType', 'createdAt', 'updatedAt']) ||
          typeof course.id !== 'string' || !course.id.startsWith('logical-course:') || course.id.length > 200 ||
          typeof course.title !== 'string' || !course.title.trim() || course.title.length > 120 ||
          typeof course.coverImage !== 'string' || course.coverImage.length > 2 * 1024 * 1024 ||
          typeof course.catalogKey !== 'string' || course.catalogKey !== 'logical:' + course.id ||
          course.origin !== 'user' || course.contentType !== 'story' ||
          typeof course.createdAt !== 'string' || course.createdAt.length > 50 ||
          typeof course.updatedAt !== 'string' || course.updatedAt.length > 50 || !upsertEntityRow) {
        throw operationError('逻辑课程目录内容无效', 'INVALID_OPERATION', 400);
      }
      const current = db.prepare("SELECT seq,deleted_at FROM user_entity_rows WHERE user_id=? AND kind='logicalCourse' AND item_key=?")
        .get(userId, course.id);
      const currentSeq = current ? (current.seq == null ? null : Number(current.seq)) : null;
      if (currentSeq !== p.expectedSeq) {
        throw operationError('逻辑课程目录已在其他页面更新；本次修改未覆盖服务器版本', 'ENTITY_CHANGED', 409,
          [{ entity: 'logicalCourses', id: course.id, expectedSeq: p.expectedSeq, currentSeq,
            deleted: !!(current && current.deleted_at) }]);
      }
      upsertEntityRow(userId, 'logicalCourse', course.id, course, seq);
      return { entity: 'logicalCourses', id: course.id, seq, value: course };
    }

    if (body.type === 'logicalCourse.delete') {
      if (!hasOnlyKeys(p, ['courseId', 'expectedSeq']) || typeof p.courseId !== 'string' ||
          !p.courseId.startsWith('logical-course:') || p.courseId.length > 200 ||
          !Number.isSafeInteger(p.expectedSeq) || p.expectedSeq < 0 || !deleteEntityRow) {
        throw operationError('逻辑课程目录删除参数无效', 'INVALID_OPERATION', 400);
      }
      const current = db.prepare("SELECT seq,deleted_at FROM user_entity_rows WHERE user_id=? AND kind='logicalCourse' AND item_key=?")
        .get(userId, p.courseId);
      if (!current || current.deleted_at || Number(current.seq) !== p.expectedSeq) {
        throw operationError('逻辑课程目录已变化或已删除；本次删除未执行', 'ENTITY_CHANGED', 409,
          [{ entity: 'logicalCourses', id: p.courseId, expectedSeq: p.expectedSeq,
            currentSeq: current && current.seq != null ? Number(current.seq) : null, deleted: !!(current && current.deleted_at) }]);
      }
      deleteEntityRow(userId, 'logicalCourse', p.courseId, seq);
      return { entity: 'logicalCourses', id: p.courseId, seq, deleted: true };
    }

    return null;
  }

  return Object.freeze({ apply });
}

module.exports = { createLogicalCourseOperations };
