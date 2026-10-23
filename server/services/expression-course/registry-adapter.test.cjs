'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createExpressionRegistryAdapter } = require('./registry-adapter');

test('expression registry load preserves the shared registry envelope', () => {
  const course = { courseId: 'expression-test', title: 'Test', contentType: 'expression', releaseId: 'r-test',
    units: [{ unitId: 'lesson-L001', contentRef: { type: 'expression-lesson', id: 'L001' }, itemIds: ['A1'] }] };
  const lesson = { lessonId: 'L001', activities: [{ id: 'A1', type: 'listening_choice', payload: { audioAssetId: 'audio-1' } }] };
  const repository = {
    registryCourses: () => [course],
    findCourse: () => ({ releaseId: 'r-test' }),
    release: () => ({ package: { lessons: [lesson] } })
  };
  const base = { snapshot: () => ({ courses: [], version: 'base' }), list: () => ({ courses: [] }) };
  const registry = createExpressionRegistryAdapter({ base, repository });

  const loaded = registry.load('expression-test', 'lesson-L001', 0);

  assert.deepEqual(loaded.payload.assetIds, ['audio-1']);
  assert.equal(loaded.payload.contentType, 'expression');
  assert.equal(loaded.unit.unitId, 'lesson-L001');
  assert.equal(loaded.course.courseId, 'expression-test');
});
