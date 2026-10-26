import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lessons, validatePreviewLesson, matchesTransfer } from './lessons-v3.mjs';
import { visualScenes } from './visual-scenes.mjs';

const lesson = lessons.find(item => item.id === 'foundation-svo-preview');

test('PB02 introduces the object in context, then practices direct recomposition', () => {
  validatePreviewLesson(lesson);
  assert.equal(lesson.sequence[0].meaning, '喜欢');
  assert.deepEqual(lesson.sequence[0].wordIds, ['like']);
  assert.ok(!lesson.sequence.some(step => ['replace', 'teach'].includes(step.type)));
  const firstObject = lesson.sequence.findIndex(step => step.annotations.some(item => item.label === '宾语'));
  assert.equal(lesson.sequence[firstObject].meaning, '我喜欢茶');
  assert.equal(lesson.sequence[firstObject].learningNote.term, '宾语');
  for (const index of lesson.sentenceStepIndexes) {
    const step = lesson.sequence[index];
    assert.equal(step.wordIds.length, 3);
    assert.ok(step.learningNote && step.visual);
    assert.deepEqual(step.annotations.map(item => item.label), ['主语', '谓语', '宾语']);
  }
});

test('PB02 distinguishes selected-word meanings from expression scenes', () => {
  for (const word of Object.values(lesson.words)) {
    const scene = visualScenes.scenes[word.visualSceneId];
    assert.ok(scene, word.en);
    for (const id of scene.assetIds) {
      const asset = visualScenes.assets[id];
      const path = new URL('../../' + asset.src, import.meta.url);
      assert.ok(statSync(path).size < 20000);
      assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), asset.sha256);
    }
  }
  const checks = lesson.sequence.find(step => step.type === 'identify').checks;
  assert.deepEqual(checks.map(check => check.wordId), ['coffee', 'i', 'like']);
  assert.ok(checks.every(check => check.learningNote?.explanation));
  assert.notDeepEqual(visualScenes.scenes['like-coffee'].assetIds, visualScenes.scenes['you-like-coffee'].assetIds);
});

test('PB02 independent output is a new combination of previously practiced vocabulary', () => {
  const transfer = lesson.sequence.at(-1);
  assert.equal(transfer.type, 'transfer');
  assert.equal(transfer.meaning, '你喜欢茶');
  assert.ok(!lesson.sequence.slice(0, -1).some(step => step.wordIds.join('|') === transfer.wordIds.join('|')));
  const learned = new Set(lesson.sequence.slice(0, -1).flatMap(step => step.wordIds));
  assert.ok(transfer.wordIds.every(id => learned.has(id)));
  assert.ok(matchesTransfer(transfer, '  YOU like tea!  '));
  assert.ok(!matchesTransfer(transfer, 'I like tea'));
});

test('local merging replaces its consumed second-level result rather than creating another level', () => {
  const merge = lesson.sequence.find(step => step.meaning === '我喜欢');
  assert.deepEqual(merge.replacesTrailIndexes.map(index => lesson.sequence[index].meaning), ['喜欢']);
  const invalid = structuredClone(lesson);
  invalid.sequence[1].replacesTrailIndexes = [2];
  assert.throws(() => validatePreviewLesson(invalid), /earlier dependencies/);
});

test('learning the changed object marks the end of the old sentence display', () => {
  const coffee = lesson.sequence.find(step => step.wordIds.join('|') === 'coffee');
  assert.equal(coffee.clearSentenceResultOnComplete, true);
  const invalid = structuredClone(lesson);
  invalid.sequence.find(step => step.wordIds.join('|') === 'coffee').clearSentenceResultOnComplete = 'yes';
  assert.throws(() => validatePreviewLesson(invalid), /explicit boolean/);
});
