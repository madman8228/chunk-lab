import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCourseLearning, resolvePracticeMode, shouldPreserveOrder } from '../src/main/course-learning-policy.mjs';

test('course template chooses a session mode without changing the global fallback', () => {
  const learning = resolveCourseLearning({ template: 'sentence-practice', templateVersion: 1, contentForm: 'dialogue', roles: [{ key: 'a' }], learning: { modes: ['typing', 'chunkSelection'], defaultMode: 'typing' } });
  assert.equal(resolvePracticeMode(learning, 'choose'), 'type');
  learning.mode = 'chunkSelection';
  assert.equal(resolvePracticeMode(learning, 'type'), 'choose');
  assert.equal(resolvePracticeMode(null, 'type'), 'type');
  assert.equal(shouldPreserveOrder(learning), true);
});

test('unknown templates fall back to ordinary course behavior and sentence sets keep adaptive ordering', () => {
  const unknown = resolveCourseLearning({ template: 'future-player', templateVersion: 9, contentForm: 'article' });
  assert.equal(unknown.enabled, false);
  assert.equal(shouldPreserveOrder(unknown), false);
  const sentences = resolveCourseLearning({ template: 'sentence-practice', templateVersion: 1, contentForm: 'sentences', learning: { modes: ['chunkSelection'], defaultMode: 'chunkSelection' } });
  assert.equal(shouldPreserveOrder(sentences), false);
});
