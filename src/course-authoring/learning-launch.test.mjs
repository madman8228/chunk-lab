import test from 'node:test';
import assert from 'node:assert/strict';
import { LegacyCourseLearningLauncher } from './learning-launch.mjs';
import chunkShape from '../../js/chunk-shape.js';

function course(id = 'ai-legacy-launch') {
  return { schemaVersion: '2.0', courseId: id, version: '1.0.0',
    metadata: { title: { 'zh-CN': '旧课程' }, description: { 'zh-CN': '' }, targetCefr: 'A2' },
    authorNotes: { chunklabAuthoring: ['format=chunklab-ai-course', 'formatVersion=1.0', 'contentForm=article'] },
    capabilities: { typing: true, chunkSelection: true }, roles: [], sequence: ['l1'],
    utterances: [{ id: 'l1', text: { en: 'We are ready.', 'zh-CN': '我们准备好了。' }, acceptedAnswers: { en: ['We are ready.'] },
      chunks: { items: [{ id: 'c1', text: 'We are' }, { id: 'c2', text: 'ready.' }], correctOrder: ['c1', 'c2'], distractors: [] } }] };
}

function fixture(source = course()) {
  let saved = null, retired = false, writes = 0, failSave = false;
  const scope = { account: 'test' };
  const gateway = {
    async loadLegacyAiCourse(id) { return id === source.courseId ? { course: structuredClone(source), progress: { seen: ['l1'], passed: ['l1'] } } : null; },
    async findNativeCourse() { return saved && structuredClone(saved); },
    async getLaunchReceipt(id) { return { storageKind: 'sentence-deck', contentId: id, catalogCourseId: saved.authoring.catalogCourseId, lessonId: 'lesson:user-deck:' + id }; },
    async saveSentenceCourse(deck, _scope, options = {}) { const rollback = options.beforeSave && options.beforeSave({}); if (failSave) { failSave = false; if (rollback) rollback(); throw new Error('simulated save failure'); } writes++; saved = structuredClone(deck); return { storageKind: 'sentence-deck', contentId: deck.id, catalogCourseId: deck.authoring.catalogCourseId, lessonId: 'lesson:user-deck:' + deck.id }; }
  };
  const validator = { chunkShape, validate() { return { valid: true, issues: [] }; } };
  const compiler = { compileDeck(draft, options) { return { id: options.deckId, name: draft.title, items: draft.items.map((item, i) => ({ cid: options.lineIds[i], sentence: item.en, translation: item.zh, chunks: item.chunks })), authoring: { legacySource: options.legacySource, catalogCourseId: options.catalogCourseId } }; } };
  const launcher = new LegacyCourseLearningLauncher({ gateway, validator, compiler,
    scopeGuard: { capture: () => scope, assert(value) { assert.equal(value, scope); } },
    retiredStore: { has: () => retired, mark: () => { retired = true; }, clear: () => { const wasRetired = retired; retired = false; return wasRetired; } } });
  return { launcher, gateway, get saved() { return saved; }, get writes() { return writes; }, retire() { retired = true; }, failNextSave() { failSave = true; } };
}

test('legacy launcher reports confirmation before saving and retains prior-history context', async () => {
  const f = fixture();
  const report = await f.launcher.inspect('ai-legacy-launch');
  assert.equal(report.kind, 'confirmation-required');
  assert.ok(report.warnings.some((issue) => issue.code === 'HINTS_GENERATED'));
  assert.deepEqual(report.history.passed, ['l1']);
  assert.equal(f.writes, 0);
});

test('legacy launcher saves once after confirmation and reuses a matching target idempotently', async () => {
  const f = fixture();
  const first = await f.launcher.launch('ai-legacy-launch', { confirmed: true });
  const retry = await f.launcher.launch('ai-legacy-launch', { confirmed: true });
  assert.equal(first.kind, 'launched');
  assert.equal(first.receipt.catalogCourseId, 'package:ai-legacy-launch');
  assert.equal(retry.kind, 'launched');
  assert.equal(f.writes, 1);
  assert.equal(f.saved.items[0].cid, 'l1');
});

test('legacy launcher blocks malformed chunk references and conflicting existing decks', async () => {
  const bad = course(); bad.utterances[0].chunks.correctOrder = ['missing'];
  const invalid = fixture(bad);
  assert.equal((await invalid.launcher.inspect(bad.courseId)).kind, 'blocked');
  assert.equal(invalid.writes, 0);

  const conflicting = fixture();
  conflicting.gateway.findNativeCourse = async () => ({ id: 'ai-legacy-launch', items: [], authoring: { legacySource: { courseId: 'other' } } });
  assert.equal((await conflicting.launcher.launch('ai-legacy-launch', { confirmed: true })).kind, 'blocked');
  assert.equal(conflicting.writes, 0);
});

test('legacy conversion blocks missing course metadata and unsupported media without throwing', async () => {
  const malformed = course(); delete malformed.metadata;
  const f = fixture(malformed);
  const report = await f.launcher.inspect(malformed.courseId);
  assert.equal(report.kind, 'blocked');
  assert.ok(report.blockers.some((issue) => issue.code === 'MISSING_TITLE'));
  assert.equal(f.writes, 0);
  const media = course(); media.utterances[0].audioAssetId = 'audio';
  const mediaReport = await fixture(media).launcher.inspect(media.courseId);
  assert.ok(mediaReport.blockers.some((issue) => issue.code === 'MEDIA_NOT_MAPPED'));
});

test('retired conversion requires explicit confirmation and clears the marker on recreate', async () => {
  const f = fixture(); f.retire();
  assert.equal((await f.launcher.inspect('ai-legacy-launch')).kind, 'confirmation-required');
  f.failNextSave();
  await assert.rejects(f.launcher.launch('ai-legacy-launch', { confirmed: true }), /simulated save failure/);
  assert.equal((await f.launcher.inspect('ai-legacy-launch')).retired, true);
  const result = await f.launcher.launch('ai-legacy-launch', { confirmed: true });
  assert.equal(result.kind, 'launched');
  assert.equal((await f.launcher.inspect('ai-legacy-launch')).retired, false);
});
