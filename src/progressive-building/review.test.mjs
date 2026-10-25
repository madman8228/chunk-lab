import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewStore } from './review.mjs';
import { PREVIEW_STORAGE_KEY } from './runtime.mjs';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    values,
  };
}

test('review due dates use injected time and only independent correct answers advance schedule', () => {
  let current = 1_000_000;
  const store = createReviewStore(memoryStorage(), () => current);
  assert.equal(store.schedule({ lessonId: 'pb01', lessonVersion: 1, stepId: 's1', independentCorrect: false }), null);
  const first = store.schedule({ lessonId: 'pb01', lessonVersion: 1, stepId: 's1', independentCorrect: true });
  assert.equal(first.dueAt - current, 86_400_000);
  assert.equal(store.dueReviews().length, 0);
  current = first.dueAt;
  assert.equal(store.dueReviews().length, 1);
  const second = store.schedule({ lessonId: 'pb01', lessonVersion: 1, stepId: 's1', independentCorrect: true });
  assert.equal(second.dueAt - current, 3 * 86_400_000);
});

test('a supported correct answer can still be scheduled without counting as independent mastery', () => {
  let current = 2_000_000;
  const store = createReviewStore(memoryStorage(), () => current);
  const assisted = store.schedule({ lessonId: 'pb50', lessonVersion: 1, stepId: 's1', independentCorrect: false, allowAssisted: true });
  assert.equal(assisted.assisted, true);
  assert.equal(assisted.successfulIndependentReviews, 0);
  assert.equal(assisted.dueAt - current, 86_400_000);
  current = assisted.dueAt;
  assert.equal(store.dueReviews().length, 1);
  const independent = store.schedule({ lessonId: 'pb50', lessonVersion: 1, stepId: 's1', independentCorrect: true, allowAssisted: true });
  assert.equal(independent.assisted, false);
  assert.equal(independent.successfulIndependentReviews, 1);
  assert.equal(independent.dueAt - current, 86_400_000);
});

test('only the new preview namespace is read or written', () => {
  const storage = memoryStorage({ 'account-learning-records': 'keep', 'legacy-course': 'keep-too' });
  const store = createReviewStore(storage, () => 10);
  store.saveSession('pb01', { currentStepId: 's1' });
  assert.equal(storage.values.get('account-learning-records'), 'keep');
  assert.equal(storage.values.get('legacy-course'), 'keep-too');
  assert.ok(storage.values.has(PREVIEW_STORAGE_KEY));
});

test('corrupt preview data remains untouched and store falls back to memory', () => {
  const storage = memoryStorage({ [PREVIEW_STORAGE_KEY]: '{broken' });
  const store = createReviewStore(storage, () => 10);
  assert.equal(store.persistent, false);
  assert.match(store.warning, /原数据保留/);
  store.saveSession('pb01', { currentStepId: 's1' });
  assert.equal(storage.values.get(PREVIEW_STORAGE_KEY), '{broken');
});
