import test from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacyAiCourse, inspectLegacyAiCourse } from './legacy-conversion.mjs';

const shape = { chunkCountOk: (_sentence, chunks) => chunks.length >= 2 && chunks.length <= 5 };
function course() {
  return { schemaVersion: '2.0', courseId: 'ai-legacy-123', version: '1.0.0',
    metadata: { title: { 'zh-CN': '测试课程' }, description: { 'zh-CN': '' }, targetCefr: 'A2' },
    authorNotes: { chunklabAuthoring: ['format=chunklab-ai-course', 'formatVersion=1.0', 'contentForm=article'] },
    roles: [], sequence: ['line-a', 'line-b'], utterances: [
      { id: 'line-a', text: { en: 'We are ready.', 'zh-CN': '我们准备好了。' }, chunks: { items: [{ id: 'c1', text: 'We are' }, { id: 'c2', text: 'ready.' }], correctOrder: ['c1', 'c2'], distractors: [{ id: 'd1', text: 'We ready' }] } },
      { id: 'line-b', text: { en: 'Let us begin.', 'zh-CN': '我们开始吧。' }, chunks: { items: [{ id: 'c3', text: 'Let us' }, { id: 'c4', text: 'begin.' }], correctOrder: ['c3', 'c4'], distractors: [] } }
    ] };
}

test('legacy conversion requires trusted markers and stable compatible native identities', () => {
  const value = course();
  const report = inspectLegacyAiCourse(value, { chunkShape: shape });
  assert.equal(report.valid, true);
  assert.deepEqual(report.plan.lineIds, ['line-a', 'line-b']);
  assert.equal(report.plan.catalogCourseId, 'package:ai-legacy-123');
  assert.equal(report.warnings[0].code, 'DISTRACTORS_NOT_MAPPED');
  const converted = convertLegacyAiCourse(value, { chunkShape: shape });
  assert.deepEqual(converted.draft.items.map((item) => item.en), ['We are ready.', 'Let us begin.']);
  assert.equal(converted.report.history.importedAsNativeStats, false);
});

test('legacy conversion blocks noncanonical answers and unsafe chunk shapes without mutating source', () => {
  const value = course();
  value.utterances[0].acceptedAnswers = { en: ['We are ready.', 'We feel ready.'] };
  value.utterances[1].chunks.correctOrder = ['c3'];
  const original = structuredClone(value);
  const report = inspectLegacyAiCourse(value, { chunkShape: shape });
  assert.equal(report.valid, false);
  assert.ok(report.blockers.some((item) => item.code === 'ALTERNATE_ANSWER_UNSUPPORTED'));
  assert.deepEqual(value, original);
});
