'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inspect, validateCatalog } = require('./lib/vocabulary-illustrations.cjs');

const root = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

test('progressive scene catalog contains only valid, approved sample assets', async () => {
  const catalog = validateCatalog(readJson('output/vocabulary-illustrations/catalog-progressive-scenes-20261025-v1.json'));
  const approval = readJson('output/progressive-building/visuals-20261025/like-sample-user-approval.json');
  const bindings = catalog.bindings.filter(binding => binding.course === approval.courseId);

  assert.equal(approval.decision, 'pass');
  assert.equal(bindings.length, approval.assets.length);
  for (const binding of bindings) {
    const actual = inspect(root, binding.path);
    assert.equal(actual.assetId, binding.assetId);
    assert.equal(actual.sha256, binding.reviewEvidence.approvalSha256 ? approval.assets.find(asset => asset.path === binding.path)?.sha256 : '');
    assert.ok(actual.bytes < 20000);
    assert.equal(actual.width * 9, actual.height * 16);
    assert.equal(binding.review, 'pass');
    assert.equal(binding.reviewEvidence.approvalSha256, require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'output/progressive-building/visuals-20261025/like-sample-user-approval.json'))).digest('hex'));
  }
});

test('preview expressions reuse the same word images as individual selections', async () => {
  const [{ lessons, validatePreviewLesson }, { visualScenes }] = await Promise.all([
    import('../src/progressive-building/lessons-v3.mjs'),
    import('../src/progressive-building/visual-scenes.mjs'),
  ]);
  const course = lessons.find(lesson => lesson.id === 'like-transfer-preview');
  assert.ok(course);
  validatePreviewLesson(course);

  const expected = ['i', 'like', 'like-person', 'apple', 'like-apple', 'coffee', 'like-coffee', 'tea', 'like-tea'];
  assert.deepEqual(course.sequence.map(step => step.wordIds.length === 1 ? course.words[step.wordIds[0]].visualSceneId : step.visual.sceneId), expected);
  const personPath = visualScenes.assets.i.src;
  for (const sceneId of ['like-apple', 'like-coffee', 'like-tea']) {
    assert.equal(visualScenes.scenes[sceneId].kind, 'object-pair');
    assert.equal(visualScenes.assets[visualScenes.scenes[sceneId].assetIds[0]].src, personPath);
    assert.equal(visualScenes.scenes[sceneId].assetIds[1], 'like');
  }
  assert.deepEqual(visualScenes.scenes['you-like-coffee'].assetIds, ['you', 'like', 'coffee']);
  assert.deepEqual(visualScenes.scenes['i-work'].assetIds, ['i', 'work']);
  assert.deepEqual(course.sentenceStepIndexes, [2, 4, 6, 8]);
});
