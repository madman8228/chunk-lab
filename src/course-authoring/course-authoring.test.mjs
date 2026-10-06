import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020Module from 'ajv/dist/2020.js';
import { DRAFT_SPEC } from './draft-spec.mjs';
import { CourseCapabilityCatalog } from './capabilities.mjs';
import { AiCoursePromptComposer } from './prompt-composer.mjs';
import { AiDraftCodec } from './draft-codec.mjs';
import { AiDraftValidator } from './draft-validator.mjs';
import { CourseDraftCompiler } from './draft-compiler.mjs';
import { AuthoringSession } from './session.mjs';
import { ResilientSessionRepository } from './adapters/resilient-session-repository.mjs';
import { CourseCreationPreferences } from './preferences.mjs';
import { CourseAuthoringService } from './service.mjs';

const Ajv2020 = /** @type {any} */ (Ajv2020Module);
const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaValidator = { validate(schema, value) { const check = ajv.compile(schema); return { valid: !!check(value), errors: check.errors || [] }; } };
const validator = new AiDraftValidator({ schemaValidator });
const compiler = new CourseDraftCompiler({ validator });

test('fixed draft schema accepts the example and rejects injected fields', () => {
  assert.equal(validator.validate(DRAFT_SPEC.examples[0]).valid, true);
  assert.equal(validator.validate({ ...DRAFT_SPEC.examples[0], courseId: 'overwrite-me' }).valid, false);
  const missing = structuredClone(DRAFT_SPEC.examples[0]);
  delete missing.items[0].zh;
  const required = validator.validate(missing).issues.find((item) => item.code === 'SCHEMA_INVALID');
  assert.equal(required.path, 'items[0].zh');
  assert.match(required.message, /缺少必填字段/);
});

test('codec accepts one JSON code block but rejects commentary and oversized content', () => {
  const codec = new AiDraftCodec();
  assert.deepEqual(codec.parseText('```json\n{"ok":true}\n```'), { ok: true, value: { ok: true } });
  assert.equal(codec.parseText('课程如下： {"ok":true}').error.code, 'INVALID_JSON');
  assert.equal(codec.parseText('x'.repeat(256 * 1024 + 1)).error.code, 'INPUT_TOO_LARGE');
});

test('semantic validation rejects broken chunks and missing dialogue roles', () => {
  const draft = structuredClone(DRAFT_SPEC.examples[0]);
  draft.items[0].chunks = ['not the sentence'];
  /** @type {any} */ (draft.items[1]).role = 'unknown';
  const result = validator.validate(draft);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((item) => item.code === 'CHUNK_TEXT_MISMATCH'));
  assert.ok(result.issues.some((item) => item.code === 'UNKNOWN_ROLE'));
});

test('authoring offers only supported text modes while runtime retains audio gates', () => {
  const prompt = new AiCoursePromptComposer({ spec: DRAFT_SPEC, capabilities: CourseCapabilityCatalog }).composeCreation();
  assert.match(prompt, /每轮只问一个/);
  assert.match(prompt, /3 到 5 个清楚编号的建议/);
  assert.match(prompt, /课程长度没有预设值/);
  assert.match(prompt, /先问用户想制作什么课程/);
  assert.doesNotMatch(prompt, /shadowing|dictation|跟读|听写/);
  const modes = CourseCapabilityCatalog.resolveRuntimeModes(compiler.compile(DRAFT_SPEC.examples[0], { courseId: 'ai-123456789012' }));
  assert.deepEqual(modes.filter((mode) => mode.enabled).map((mode) => mode.id), ['typing', 'chunkSelection', 'roleplay']);
  assert.equal(modes.find((mode) => mode.id === 'dictation').enabled, false);
});

test('creation preferences support multiple levels and migrate legacy single-level drafts', () => {
  const value = CourseCreationPreferences.normalize({ contentForm: 'sentences', targetCefrs: ['B1', 'C1', 'B1', 'invalid'], exerciseModes: ['typing', 'dictation', 'roleplay', 'typing'] });
  assert.deepEqual(value, { courseType: 'sentence', contentForm: 'sentences', targetCefrs: ['B1', 'C1'], exerciseModes: ['typing'] });
  assert.deepEqual(CourseCreationPreferences.describeOptions().forms.map((item) => item.id), ['sentence', 'imageText']);
  assert.equal(CourseCreationPreferences.normalize({ courseType: 'imageText' }).courseType, 'imageText');
  assert.deepEqual(CourseCreationPreferences.normalize({ targetCefr: 'C1' }).targetCefrs, ['C1']);
  assert.deepEqual(CourseCreationPreferences.normalize({}).targetCefrs, []);
  assert.deepEqual(CourseCreationPreferences.normalize({ ...value, exerciseModes: [] }).exerciseModes, ['typing']);
  assert.deepEqual(CourseCreationPreferences.describeOptions().exercises.map((item) => item.id), ['typing', 'chunkSelection']);
  assert.equal('topics' in CourseCreationPreferences.describeOptions(), false);
  assert.equal('lengths' in CourseCreationPreferences.describeOptions(), false);
});

test('creation prompt carries only chosen constraints and asks AI to clarify missing needs', () => {
  const prompt = new AiCoursePromptComposer({ spec: DRAFT_SPEC, capabilities: CourseCapabilityCatalog }).composeCreation({
    brief: '东京入住', preferences: { contentForm: 'dialogue', targetCefrs: ['A2', 'B1'], exerciseModes: ['typing', 'roleplay'] }
  });
  assert.doesNotMatch(prompt, /"topic"|"itemCount"/);
  assert.match(prompt, /"contentForm": "dialogue"/);
  assert.match(prompt, /"acceptableCefrLevels": \[\s+"A2",\s+"B1"/);
  assert.match(prompt, /只有无法合理判断时才追问/);
  assert.match(prompt, /长度没有预设值/);
  assert.match(prompt, /"userBrief": "东京入住"/);
  const imagePrompt = new AiCoursePromptComposer({ spec: DRAFT_SPEC, capabilities: CourseCapabilityCatalog }).composeCreation({ preferences: { courseType: 'imageText' } });
  assert.match(imagePrompt, /chunklab-ai-image-text/);
  assert.match(imagePrompt, /PNG、JPEG 或 WebP/);
  assert.match(imagePrompt, /不要把图片 base64 放进 JSON/);
});

test('compiler emits player data without fake media ranges and exports a validated draft', () => {
  const course = compiler.compile(DRAFT_SPEC.examples[0], { courseId: 'ai-123456789012' });
  assert.equal(course.schemaVersion, '2.0');
  assert.equal(course.capabilities.audio, false);
  assert.equal(Object.hasOwn(course.utterances[0], 'sourceRange'), false);
  const exported = compiler.projectForExport(course);
  assert.deepEqual(exported.items.map((item) => item.acceptedAnswers[0]), DRAFT_SPEC.examples[0].items.map((item) => item.en));
  assert.deepEqual(compiler.projectForExport(compiler.compile(exported, { courseId: 'ai-abcdefgh1234' })), exported);
});

test('native sentence adapter preserves teaching order, session capabilities and distinct repeated-line identities', () => {
  const source = /** @type {any} */ (structuredClone(DRAFT_SPEC.examples[0]));
  source.contentForm = 'sentences';
  source.roles = [];
  source.items = [source.items[0], structuredClone(source.items[0])];
  source.items.forEach((item) => { delete item.role; });
  const deck = compiler.compileDeck(source, { deckId: 'ai-native-repeat-123456' });
  assert.equal(deck.authoring.catalogCourseId, 'user-deck:ai-native-repeat-123456');
  assert.deepEqual(deck.authoring.learning.modes, ['typing', 'chunkSelection']);
  assert.notEqual(deck.items[0].cid, deck.items[1].cid);
  assert.deepEqual(deck.items.map((item) => item.sentence), source.items.map((item) => item.en));
  const exported = compiler.projectDeckForExport(deck);
  assert.equal(exported.targetCefr, source.targetCefr);
  assert.equal(exported.items[0].hints.length, exported.items[0].chunks.length);
  assert.equal(Object.hasOwn(exported, 'courseId'), false);
});

test('authoring session enforces stages and keeps revisions immutable', () => {
  const session = AuthoringSession.create({ sessionId: 'session-a', courseId: 'ai-123456789012', identity: { owner: 'user-a' } });
  assert.throws(() => session.transition('beginSave'), { code: 'INVALID_TRANSITION' });
  const copied = session.transition('copySucceeded');
  assert.equal(session.value().stage, 'setup');
  assert.equal(copied.value().stage, 'waiting-result');
  assert.equal(copied.value().revision, 1);
});

test('updating creation preferences creates a revision and invalidates prior generated content', () => {
  const base = AuthoringSession.create({ sessionId: 'session-pref', courseId: 'ai-123456789012', identity: { owner: 'user-a' } });
  const next = base.updatePreferences({ contentForm: 'dialogue', targetCefrs: ['B1', 'B2'], exerciseModes: ['typing', 'roleplay'] });
  assert.deepEqual(base.value().preferences.targetCefrs, []);
  assert.deepEqual(next.value().preferences.targetCefrs, ['B1', 'B2']);
  assert.equal(next.value().revision, 1);
  assert.equal(next.value().rawResult, '');
  assert.throws(() => new AuthoringSession({ ...next.value(), stage: 'saved' }).updatePreferences({}), /已保存/);
});

test('session storage failure falls back in memory without crossing account scopes', async () => {
  const primary = {
    async load() { throw new Error('IndexedDB unavailable'); },
    async save() { throw new Error('IndexedDB unavailable'); },
    async listRecent() { throw new Error('IndexedDB unavailable'); }
  };
  const repository = new ResilientSessionRepository({ primary });
  const scopeA = { owner: 'a', databaseName: 'db-a' }, scopeB = { owner: 'b', databaseName: 'db-b' };
  assert.equal(await repository.load('session-a', scopeA), null);
  const snapshot = { sessionId: 'session-a', revision: 0, updatedAt: 1, identity: scopeA, stage: 'setup' };
  await repository.save(snapshot, scopeA, 0);
  assert.equal((await repository.load('session-a', scopeA)).identity.owner, 'a');
  assert.equal(await repository.load('session-a', scopeB), null);
  assert.match(repository.persistenceWarning, /关闭页面后会丢失/);
  assert.deepEqual((await repository.listRecent(scopeB)), []);
});

test('mistake-review session reuses the validated workflow and injects trusted source metadata on save', async () => {
  const identity = { owner: 'review-user', databaseName: 'review-db' };
  const sessions = new Map();
  const sessionRepository = {
    async load(id) { return sessions.get(id) || null; },
    async save(snapshot, _scope, expectedRevision) {
      const current = sessions.get(snapshot.sessionId);
      assert.equal(current ? current.revision : 0, expectedRevision);
      sessions.set(snapshot.sessionId, snapshot); return snapshot;
    }
  };
  let savedCourse = null, sequence = 0;
  const courseGateway = { async saveSentenceCourse(course) { savedCourse = structuredClone(course); return { storageKind: 'sentence-deck', contentId: course.id }; } };
  const scopeGuard = { capture() { return identity; }, assert(scope) { assert.equal(scope.owner, identity.owner); } };
  const io = { newId() { sequence += 1; return `review-${sequence}-abcdefgh`; }, clipboard: { async write() {} } };
  const service = new CourseAuthoringService({
    sessionRepository, courseGateway, schemaValidator,
    promptComposer: new AiCoursePromptComposer({ spec: DRAFT_SPEC, capabilities: CourseCapabilityCatalog }),
    draftValidator: validator, compiler, io, scopeGuard,
  });
  const publicPack = { format: 'chunklab-mistake-evidence', version: 1, packId: 'pack-test', generatedAt: 123, records: [{ ref: 'R1', sentence: 'Where is it?', history: [] }] };
  const localSourceRefs = { R1: { deckId: 'source-deck', cid: 'source-cid', sentence: 'Where is it?' } };
  const snapshot = await service.open({ sessionId: 'review-session', brief: '针对 1 道错题', reviewContext: { version: 1, task: 'practice', publicPack, localSourceRefs, baseline: { R1: null } } });
  assert.equal((await service.createPrompt(snapshot.sessionId)).includes('pack-test'), true);
  await assert.rejects(service.updatePreferences(snapshot.sessionId, { courseType: 'imageText' }, snapshot.revision), /仅支持句子课程/);
  await service.acceptText(snapshot.sessionId, JSON.stringify(DRAFT_SPEC.examples[0]));
  const saved = await service.save(snapshot.sessionId);
  assert.equal(saved.stage, 'saved');
  const persistedCourse = /** @type {any} */ (savedCourse);
  assert.ok(persistedCourse);
  assert.equal(persistedCourse.authoring.reviewSource.packId, 'pack-test');
  assert.deepEqual(persistedCourse.items[0].authoring.reviewSource.sourceRefs, [{ deckId: 'source-deck', cid: 'source-cid' }]);
  assert.equal(JSON.stringify(persistedCourse).includes('Where is it?'), false);
});
