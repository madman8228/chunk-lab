import assert from 'node:assert/strict';
import { groupText, lesson, sentenceText, wordIdsForGroups, validateLesson, wordForShortcut } from './lesson-v3.mjs';

validateLesson(lesson);

assert.deepEqual(
  lesson.groups.map(group => group.wordIds.map(id => lesson.words[id].en)),
  [['I', 'want'], ['to', 'learn', 'English'], ['with', 'you'], ['every', 'day']],
);
assert.deepEqual(
  lesson.sequence.map(step => wordIdsForGroups(lesson, step.groupIds)),
  [
    ['i', 'want'],
    ['to', 'learn', 'english'],
    ['i', 'want', 'to', 'learn', 'english'],
    ['i', 'want', 'to', 'learn', 'english', 'with', 'you'],
    ['i', 'want', 'to', 'learn', 'english', 'with', 'you', 'every', 'day'],
  ],
);
assert.equal(sentenceText(lesson), 'I want to learn English with you every day.');
assert.ok(lesson.groups.every(group => group.component && group.explanation));
assert.ok(Object.values(lesson.words).every(word => /^[A-Za-z]+$/.test(word.en) && word.zh && word.part && word.role && word.component));
assert.equal(lesson.words.i.component, '主语');
assert.equal(lesson.words.want.component, '谓语');
assert.equal(groupText(lesson, 'action'), 'to learn English');
const fullStep = lesson.sequence[4];
const keys = ['i', 'w', 't', 'l', 'e', 'w', 'y', 'e', 'd'];
const selectedByKey = [];
keys.forEach(key => selectedByKey.push(wordForShortcut(lesson, fullStep.groupIds, selectedByKey, key)));
assert.deepEqual(selectedByKey, lesson.sentence.wordIds);
assert.deepEqual(lesson.sequence.map(step => step.meaning), ['我想要', '学英语', '我想要学英语', '我想要和你学英语', '我想要每天和你学英语']);
const invalid = structuredClone(lesson);
invalid.sequence[1].groupIds = ['missing'];
assert.throws(() => validateLesson(invalid), /invalid semantic groups/);

console.log('progressive-building lesson structure: passed');
