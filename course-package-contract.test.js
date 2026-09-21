'use strict';
const assert = require('node:assert/strict');
const contract = require('./js/course-package-contract.js');
const schemaValidator = require('./scripts/course-schema-validator-entry.js');

const typingCourse = {
  schemaVersion: '1.1', courseId: 'typing', version: '0.1.0', deliveryMode: 'typing_only', contentShape: 'article',
  courseSemantics: {
    fields: { learnerTarget: 'story.nodes[].sourceText' },
    roles: { speakerReference: 'story.nodes[].npcId' }
  }, story: { nodes: [{ type: 'interaction', id: 'n1', sourceText: { en: 'Excuse me!' }, npcMessage: { en: 'Excuse me!' } }] }
};
assert.equal(contract.detectProfile(typingCourse).id, 'typing-source-text-v1.1');
const v11Policy = { normalization: 'english-typing-v1' };
assert.equal(contract.answerMatches('EXCUSE  ME!', 'Excuse me!', v11Policy), true);
assert.equal(contract.answerMatches('  Excuse me!  ', 'Excuse me!', v11Policy), true);
assert.equal(contract.answerMatches('Excuse me', 'Excuse me!', v11Policy), false);
assert.equal(contract.answerMatches('Excuse you!', 'Excuse me!', v11Policy), false);
assert.equal(contract.answerMatches('“Excuse me!”', 'Excuse me!', v11Policy), false);
assert.equal(contract.isSortedUtf8([
  { path: 'COURSE_README.zh-CN.md' },
  { path: 'assets/story/中文_01.webp' },
  { path: 'course.json' },
  { path: '课程.txt' }
]), true);
assert.equal(contract.manifestContentText([
  { path: 'COURSE_README.zh-CN.md', sha256: 'a'.repeat(64), byteSize: 1 },
  { path: 'assets/story/中文_01.webp', sha256: 'b'.repeat(64), byteSize: 2 },
  { path: 'course.json', sha256: 'c'.repeat(64), byteSize: 3 },
  { path: '课程.txt', sha256: 'd'.repeat(64), byteSize: 4 }
]).endsWith('\n'), true);
assert.equal(contract.isSafePath('assets/audio/line.mp3'), true);
assert.equal(contract.isSafePath('../course.json'), false);
assert.equal(contract.isSafePath('assets/run.js'), false);
assert.ok(contract.validateManifestShape({ packageFormatVersion: '1.0.0', schemaVersion: '1.0', entries: [{ path: 'course.json', sha256: 'a'.repeat(64), byteSize: 2 }] }).length);
const validV11Manifest = { packageFormatVersion: '1.1.0', schemaVersion: '1.1', courseId: 'c', courseVersion: '0.1.0', courseSemanticsVersion: '0.2', contentHash: 'f'.repeat(64), entries: [{ path: 'COURSE_PROTOCOL.md', sha256: 'a'.repeat(64), byteSize: 2 }, { path: 'course.json', sha256: 'b'.repeat(64), byteSize: 2 }] };
assert.deepEqual(contract.validateManifestShape(validV11Manifest), []);
assert.ok(contract.validateManifestShape(Object.assign({}, validV11Manifest, { entries: [{ path: 'course.json', sha256: 'a'.repeat(64), byteSize: 2 }, { path: 'COURSE_PROTOCOL.md', sha256: 'b'.repeat(64), byteSize: 2 }] })).length);
assert.equal(contract.packageProfile({ packageFormatVersion: '1.1.0', schemaVersion: '1.1' }).id, 'course-package-1.1');
assert.equal(contract.packageProfile({ packageFormatVersion: '2.0.0', schemaVersion: '2.0' }).id, 'course-package-2.0');
assert.equal(contract.packageProfile({ packageFormatVersion: '1.0.0', schemaVersion: '1.0' }), null);
const validV2Manifest = { packageFormatVersion: '2.0.0', schemaVersion: '2.0', courseId: 'v2', courseVersion: '0.1.0', contentHash: 'f'.repeat(64), entries: [{ path: 'COURSE_PROTOCOL.md', sha256: 'a'.repeat(64), byteSize: 2 }, { path: 'course.json', sha256: 'b'.repeat(64), byteSize: 2 }] };
assert.deepEqual(contract.validateManifestShape(validV2Manifest), []);
const validV2Course = {
  schemaVersion: '2.0', courseId: 'v2', version: '0.1.0', metadata: { title: { en: 'V2', 'zh-CN': 'V2' } },
  assets: [{ id: 'a1', path: 'assets/a.mp3' }], roles: [{ id: 'r1', name: 'Speaker' }],
  utterances: [{ id: 'u1', text: { en: 'Hello', 'zh-CN': '你好' }, roleId: 'r1', audioAssetId: 'a1', acceptedAnswers: { en: ['Hello'] }, chunks: { items: [{ id: 'c1', text: 'Hello' }], correctOrder: ['c1'], distractors: [] } }],
  sequence: ['u1'], capabilities: { text: true, audio: true, translation: true, chunkSelection: true, roleplay: false }
};
assert.equal(contract.detectProfile(validV2Course).id, 'mode-neutral-sequence-v2.0');
assert.deepEqual(contract.validateCourseV2(validV2Course), []);
assert.ok(contract.validateCourseV2(Object.assign({}, validV2Course, { sequence: [] })).length);
assert.deepEqual(contract.validateCourseGraph({ story: { startNodeId: 'n1', nodes: [{ type: 'interaction', id: 'n1', transitions: [{ toNodeId: 'end', fallback: true }] }, { type: 'end', id: 'end' }] }, assets: [] }), []);
assert.equal(schemaValidator.validate({ type: 'object', required: ['name'], properties: { name: { type: 'string' } } }, { name: 'ok' }).valid, true);
console.log('course-package-contract.test.js passed');
