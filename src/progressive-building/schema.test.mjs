import test from 'node:test';
import assert from 'node:assert/strict';
import { lesson } from './content/pb01.mjs';
import { lesson as objectLesson } from './content/pb02.mjs';
import { courses as gerundCourses } from './content/pb31.mjs';
import { validateLessonV3, validateCatalog } from './schema.mjs';

test('PB01 schema accepts stable occurrence ids and semantic practice phases', () => {
  assert.equal(validateLessonV3(lesson), lesson);
  assert.equal(validateLessonV3(objectLesson), objectLesson);
});

test('schema rejects target leakage during independent output', () => {
  const invalid = structuredClone(lesson);
  invalid.steps.find(step => step.id === 'pb01-transfer').revealTarget = true;
  assert.throws(() => validateLessonV3(invalid), /must not expose the target/);
});

test('schema rejects overlapping ids and unknown syntax token references', () => {
  const invalid = structuredClone(lesson);
  invalid.steps[2].syntax[0].segments = [['missing-token']];
  assert.throws(() => validateLessonV3(invalid), /references a token outside the step target/);
});

test('compose schema accepts a teaching distractor with targeted feedback', () => {
  const subjectLesson = structuredClone(gerundCourses[0]);
  const step = subjectLesson.steps[0];
  assert.equal(validateLessonV3(subjectLesson), subjectLesson);
  step.bankTokenIds = ['swimming'];
  assert.throws(() => validateLessonV3(subjectLesson), /each distractor must appear in the choice bank/);
  step.bankTokenIds = ['swim', 'swimming'];
  step.distractorFeedback = { unknown: '说明' };
  assert.throws(() => validateLessonV3(subjectLesson), /must reference a distractor/);
});

test('schema rejects cyclic syntax parents and overlapping annotation levels', () => {
  const cyclic = structuredClone(lesson);
  cyclic.steps[2].syntax[0].parentId = 'p1';
  cyclic.steps[2].syntax[0].level = 1;
  cyclic.steps[2].syntax[1].parentId = 's1';
  cyclic.steps[2].syntax[1].level = 2;
  assert.throws(() => validateLessonV3(cyclic), /parent relationships cannot contain cycles/);
  const overlap = structuredClone(lesson);
  overlap.steps[2].syntax[1].segments = [['i']];
  assert.throws(() => validateLessonV3(overlap), /same-level annotations cannot overlap/);
});

test('transform schema accepts anchored insert, delete and move operations', () => {
  const base = structuredClone(lesson);
  const step = base.steps.find(item => item.activity === 'transform');
  step.sourceTokenIds = ['i', 'work'];
  step.targetTokenIds = ['work', 'i'];
  step.syntax = [{ id: 'range', role: '句子成分', segments: [['work', 'i']], level: 0 }];
  step.operations = [{ type: 'move', from: ['i'], to: ['i'], anchorId: 'work', position: 'after' }];
  assert.equal(validateLessonV3(base), base);
  step.targetTokenIds = ['i', 'you', 'work'];
  step.syntax = [{ id: 'range', role: '句子成分', segments: [['i', 'you', 'work']], level: 0 }];
  step.operations = [{ type: 'insert', from: [], to: ['you'], anchorId: 'i', position: 'after' }];
  assert.equal(validateLessonV3(base), base);
  step.targetTokenIds = ['work'];
  step.syntax = [{ id: 'range', role: '句子成分', segments: [['work']], level: 0 }];
  step.operations = [{ type: 'delete', from: ['i'], to: [] }];
  assert.equal(validateLessonV3(base), base);
});

test('transform schema rejects unstable anchors and disjoint source ranges', () => {
  const invalid = structuredClone(lesson);
  const step = invalid.steps.find(item => item.activity === 'transform');
  step.sourceTokenIds = ['i', 'work', 'you'];
  step.targetTokenIds = ['i', 'work'];
  step.syntax = [{ id: 'range', role: '句子成分', segments: [['i', 'work']], level: 0 }];
  step.operations = [{ type: 'delete', from: ['i', 'you'], to: [] }];
  assert.throws(() => validateLessonV3(invalid), /contiguous source range/);
  step.operations = [{ type: 'insert', from: [], to: ['you'], anchorId: 'missing' }];
  assert.throws(() => validateLessonV3(invalid), /stable source anchor/);
});

test('catalog requires all 50 stable nodes and valid prerequisite references', () => {
  const catalog = Array.from({ length: 50 }, (_, index) => ({
    id: `PB${String(index + 1).padStart(2, '0')}`,
    title: `Node ${index + 1}`,
    subgoalIds: [`PB${String(index + 1).padStart(2, '0')}.a`],
    prerequisites: index ? [`PB${String(index).padStart(2, '0')}`] : [],
    status: index ? 'planned' : 'preview',
  }));
  assert.equal(validateCatalog(catalog), catalog);
  assert.throws(() => validateCatalog(catalog.slice(1)), /exactly 50/);
});
