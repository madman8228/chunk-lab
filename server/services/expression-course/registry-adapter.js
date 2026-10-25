'use strict';
const crypto = require('node:crypto');

function createExpressionRegistryAdapter({ base, repository }) {
  function expressionCourses(options) {
    try { return repository.registryCourses(options); }
    catch (error) { console.error('[expression-course] provider unavailable:', error?.message || 'unknown error'); return []; }
  }
  function isExpression(courseId) { try { return !!repository.findCourse(courseId); } catch (error) { console.error('[expression-course] lookup unavailable:', error?.message || 'unknown error'); return false; } }
  function expressionCourse(courseId) {
    return expressionCourses({ includeUnlisted: true }).find(course => course.courseId === courseId) || null;
  }
  function allCourses() { return [...base.snapshot().courses, ...expressionCourses({ includeUnlisted: true })]; }
  function snapshot() {
    const courses = allCourses();
    return { schemaVersion: 2, courses, version: crypto.createHash('sha256').update(JSON.stringify([base.snapshot().version,
      expressionCourses({ includeUnlisted: true }).map(item => [item.courseId, item.releaseId])])).digest('hex') };
  }
  function readExpression(courseId, unitId, cursor = 0) {
    const course = expressionCourse(courseId);
    if (!course) throw Object.assign(new Error('COURSE_NOT_FOUND'), { code: 'COURSE_NOT_FOUND', status: 404 });
    const unit = course.units.find(item => item.unitId === unitId);
    if (!unit) throw Object.assign(new Error('UNIT_NOT_FOUND'), { code: 'UNIT_NOT_FOUND', status: 404 });
    const active = repository.findCourse(courseId);
    const release = repository.release(courseId, active.releaseId);
    const lesson = release.package.lessons.find(item => item.lessonId === unit.contentRef.id);
    if (!lesson || !Number.isSafeInteger(cursor) || cursor < 0 || cursor >= lesson.activities.length) throw Object.assign(new Error('INVALID_CURSOR'), { code: 'INVALID_CURSOR', status: 400 });
    const activities = lesson.activities.map(activity => {
      const { evaluation, ...safe } = structuredClone(activity); void evaluation;
      const { correctTokens, referenceText, ...payload } = safe.payload || {}; void correctTokens; void referenceText;
      return { ...safe, payload };
    });
    return { payload: { courseId, unitId, contentType: 'expression', cursor, items: activities, nextCursor: null,
      assetIds: [...new Set(activities.flatMap(item => [item.payload.audioAssetId, ...(item.payload.segments || []).map(segment => segment.audioAssetId)].filter(Boolean)))], recordIdentity: { deckId: `expression:${courseId}:${unitId}`, generationScope: `expression:${courseId}`, resumeIdentity: `expression:${courseId}:${unitId}` } }, unit, course };
  }
  function list() {
    const baseList = base.list();
    const baseIds = new Set(baseList.courses.map(course => course.courseId));
    return { ...baseList, courses: baseList.courses.concat(expressionCourses().filter(course => !baseIds.has(course.courseId)).map(course => ({ ...course, protectionReady: true }))) };
  }
  function publicCourses() { return [...base.snapshot().courses, ...expressionCourses()].map(course => ({ courseId: course.courseId, title: course.title, contentType: course.contentType, curriculum: course.curriculum || null,
    units: course.units.map(unit => ({ unitId: unit.unitId, itemCount: unit.itemIds.length, ...(unit.fragments ? { contentVersion: unit.contentVersion, recordIdentity: unit.recordIdentity, itemIds: unit.itemIds } : {}) })) })); }
  return Object.freeze({
    protectedRoot: base.protectedRoot,
    snapshot,
    list,
    course: courseId => expressionCourse(courseId) || base.course(courseId),
    publicCourses,
    references: course => course.contentType === 'expression' ? course.units.flatMap(unit => unit.itemIds.map(id => JSON.stringify([unit.contentRef.type, unit.contentRef.id, id]))) : base.references(course),
    load: (courseId, unitId, cursor) => isExpression(courseId) ? readExpression(courseId, unitId, cursor) : base.load(courseId, unitId, cursor),
    asset: (courseId, unitId, assetId) => {
      if (!isExpression(courseId)) return base.asset(courseId, unitId, assetId);
      const course = expressionCourse(courseId), unit = course?.units.find(item => item.unitId === unitId);
      const active = repository.findCourse(courseId);
      if (!unit || !active) throw Object.assign(new Error('ASSET_NOT_FOUND'), { code: 'ASSET_NOT_FOUND', status: 404 });
      return repository.assetForRelease(courseId, active.releaseId, assetId);
    },
    fragmentScope: (courseId, unitId, position, purpose) => isExpression(courseId)
      ? (() => { throw Object.assign(new Error('EXPRESSION_RUNTIME_REQUIRED'), { code: 'EXPRESSION_RUNTIME_REQUIRED', status: 410 }); })()
      : base.fragmentScope(courseId, unitId, position, purpose),
    blockedPath: path => base.blockedPath(path), blockedDeck: id => base.blockedDeck(id), file: path => base.file(path),
    isExpression
  });
}

module.exports = { createExpressionRegistryAdapter };
