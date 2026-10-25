import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateExpressionPackage } from './validate.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/L001-like.reference.json', import.meta.url), 'utf8'));
const makePackage = () => {
  const lesson = structuredClone(fixture);
  lesson.schemaVersion = '1.1';
  lesson.knowledgeIds = ['s0.greetings'];
  lesson.recommendedKnowledgeIds = [];
  return { format: 'chunklab-expression-course', formatVersion: '1.1', courseId: 'expression-beginner-fixture', title: '合成路线测试',
    description: '非教学内容，仅验证协议。', audience: 'adult_beginner', curriculum: { track: 'sentence-building', stage: 'S0', knowledgeMapVersion: '1.0' },
    lessons: [lesson], assets: [{ assetId: 'l001_coffee', mimeType: 'audio/mpeg', sha256: 'a'.repeat(64), size: 4, localFile: 'coffee.mp3' },
      { assetId: 'l001_tea', mimeType: 'audio/mpeg', sha256: 'b'.repeat(64), size: 4, localFile: 'tea.mp3' }],
    reviewActivities: [{ lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A08' }, { lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A09' }] };
};

test('1.1 validates explicit route, knowledge goals and a matching lesson protocol version', () => {
  const value = makePackage();
  assert.deepEqual(validateExpressionPackage(value).errors, []);
  value.lessons[0].schemaVersion = '1.0';
  assert.ok(validateExpressionPackage(value).errors.some(error => error.includes('协议版本必须一致')));
});

test('1.1 rejects unsupported route and dangling knowledge IDs without changing legacy validation', () => {
  const value = makePackage();
  value.curriculum.track = 'guess';
  value.lessons[0].knowledgeIds = ['s0.not-real'];
  const errors = validateExpressionPackage(value).errors.join('\n');
  assert.match(errors, /curriculum\/track/);
  assert.match(errors, /知识目录中不存在/);
  const legacy = { ...makePackage(), formatVersion: '1.0', lessons: [structuredClone(fixture)] };
  delete legacy.curriculum;
  assert.equal(validateExpressionPackage(legacy).valid, true);
});
