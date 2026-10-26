import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lessons, validatePreviewLesson, matchesTransfer } from './lessons-v3.mjs';
import { visualScenes } from './visual-scenes.mjs';

const lesson = lessons.find(item => item.id === 'foundation-svc-preview');
test('PB03 introduces state words then teaches the predicative on first complete sentence', () => {
  validatePreviewLesson(lesson);
  assert.deepEqual(lesson.sequence[0].wordIds, ['happy']);
  assert.ok(!lesson.sequence.some(step => ['replace', 'teach'].includes(step.type)));
  assert.ok(!lesson.sequence.some(step => step.wordIds.join('|') === 'i|am'));
  const firstSentence = lesson.sequence[lesson.sentenceStepIndexes[0]];
  assert.deepEqual(firstSentence.wordIds, ['i', 'am', 'happy']);
  assert.equal(firstSentence.learningNote.term, '表语');
  assert.ok(firstSentence.wordLearningNotes.am.explanation.includes('不能说 I happy'));
  assert.ok(lesson.sequence.find(step => step.wordIds.join('|') === 'ready').clearSentenceResultOnComplete);
  for (const step of lesson.sequence) {
    const bank = step.bankWordIds ?? step.wordIds;
    assert.equal(new Set(bank.map(id => lesson.words[id].en[0].toLowerCase())).size, bank.length, 'no ambiguous first-letter selection is introduced');
  }
});

test('PB03 checks the state/object distinction and all three roles without teaching a fixed word role', () => {
  const reasoning = lesson.sequence.find(step => step.type === 'classify');
  assert.equal(reasoning.focusWordId, 'ready');
  assert.equal(reasoning.answer, 'state');
  assert.ok(reasoning.options.some(option => option.id === 'object'));
  const checks = lesson.sequence.find(step => step.type === 'identify').checks;
  assert.deepEqual(checks.map(check => check.wordId), ['happy', 'am', 'i']);
  assert.ok(checks.every(check => check.learningNote?.explanation));
  assert.ok(Object.values(lesson.words).every(word => !word.role));
});

test('PB03 uses valid fixed state images and diagrams for be rather than a literal object picture', () => {
  for (const id of ['happy', 'ready', 'youHappy', 'youReady']) {
    const asset = visualScenes.assets[id];
    const file = new URL('../../' + asset.src, import.meta.url);
    assert.ok(statSync(file).size < 20000);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), asset.sha256);
  }
  assert.equal(visualScenes.scenes[lesson.words.am.visualSceneId].linkWord, 'am');
  assert.equal(visualScenes.scenes[lesson.words.are.visualSceneId].linkWord, 'are');
  assert.deepEqual(visualScenes.scenes['you-are-ready'].assetIds, ['you', 'youReady']);
  assert.deepEqual(visualScenes.scenes['you-are-happy'].assetIds, ['you', 'youHappy']);
  for (const scene of Object.values(visualScenes.scenes).filter(s => ['am', 'are'].includes(s.linkWord) && s.assetIds.length === 2)) {
    const [person, state] = scene.assetIds.map(id => visualScenes.assets[id]);
    assert.ok(person.characterId);
    assert.equal(state.characterId, person.characterId, scene.alt + ': same person must carry the state');
  }
});

test('independent output uses an unpracticed combination and accepts reviewed contractions', () => {
  const transfer = lesson.sequence.at(-1);
  assert.equal(transfer.type, 'transfer');
  assert.ok(!lesson.sequence.slice(0, -1).some(step => step.wordIds.join('|') === transfer.wordIds.join('|')));
  assert.ok(matchesTransfer(transfer, 'YOU ARE HAPPY!'));
  assert.ok(matchesTransfer(transfer, "You're happy."));
  assert.ok(!matchesTransfer(transfer, 'You am happy'));
  assert.ok(!matchesTransfer(transfer, 'You happy'));
});
