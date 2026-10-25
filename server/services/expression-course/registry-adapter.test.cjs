'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createExpressionRegistryAdapter } = require('./registry-adapter');

test('expression registry load preserves the shared registry envelope', () => {
  const course = { courseId: 'expression-test', title: 'Test', contentType: 'expression', releaseId: 'r-test', curriculum: { track: 'phonics', stage: 'S0', status: 'available' },
    units: [{ unitId: 'lesson-L001', contentRef: { type: 'expression-lesson', id: 'L001' }, itemIds: ['A1'] }] };
  const lesson = { lessonId: 'L001', activities: [
    { id: 'A1', type: 'grapheme_build', payload: { audioAssetId: 'audio-1', correctTokens: ['m'] } },
    { id: 'A2', type: 'sound_demo', payload: { segments: [{ audioAssetId: 'audio-2' }] } },
    { id: 'A3', type: 'speaking_practice', payload: { audioAssetId: 'audio-3', referenceText: 'Do not expose.' } }
  ] };
  const repository = {
    registryCourses: () => [course],
    findCourse: () => ({ releaseId: 'r-test' }),
    release: () => ({ package: { lessons: [lesson] } })
  };
  const base = { snapshot: () => ({ courses: [], version: 'base' }), list: () => ({ courses: [] }) };
  const registry = createExpressionRegistryAdapter({ base, repository });

  const loaded = registry.load('expression-test', 'lesson-L001', 0);

  assert.deepEqual(loaded.payload.assetIds, ['audio-1', 'audio-2', 'audio-3']);
  assert.equal(loaded.payload.items[0].payload.correctTokens, undefined);
  assert.equal(loaded.payload.items[2].payload.referenceText, undefined);
  assert.deepEqual(registry.publicCourses()[0].curriculum, course.curriculum);
  assert.equal(loaded.payload.contentType, 'expression');
  assert.equal(loaded.unit.unitId, 'lesson-L001');
  assert.equal(loaded.course.courseId, 'expression-test');
});
