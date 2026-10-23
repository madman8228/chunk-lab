'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { ensureExpressionCourseSchema } = require('./schema');
const { createExpressionCourseRepository } = require('./repository');

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expression-course-'));
  const db = new Database(path.join(dir, 'isolated.sqlite'));
  ensureExpressionCourseSchema(db);
  const validatePackage = require('./validate.cjs').validateExpressionPackage;
  let counter = 0;
  const repository = createExpressionCourseRepository({ db, validatePackage, id: () => `draft-${++counter}` });
  t.after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { db, repository };
}

function packageFor(repository) {
  const lesson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../src/expression-course/fixtures/L001-like.reference.json'), 'utf8'));
  const assets = ['l001_tea', 'l001_coffee'].map(assetId => repository.uploadAsset({ assetId, mimeType: 'audio/mpeg', base64: Buffer.from('ID3x').toString('base64') }));
  lesson.audioAssets.forEach(item => { item.status = 'ready'; item.path = item.assetId + '.mp3'; });
  return { format: 'chunklab-expression-course', formatVersion: '1.0', courseId: 'expression-like', title: '表达喜欢', description: '合成测试课程', audience: 'adult_beginner', lessons: [lesson],
    assets: assets.map(asset => ({ ...asset, localFile: asset.assetId + '.mp3' })),
    reviewActivities: [{ lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A08' }, { lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A09' }] };
}

test('draft CRUD is revision-guarded and idempotent; content changes invalidate review', t => {
  const { repository } = setup(t); const pkg = packageFor(repository);
  const created = repository.createDraft(pkg, 1, 'create-request-0001');
  assert.deepEqual(repository.createDraft(pkg, 1, 'create-request-0001'), created);
  const checked = repository.validate(created.draftId, { forPublish: true });
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  repository.review(created.draftId, checked.contentHash);
  const changed = { ...pkg, description: 'updated' };
  repository.updateDraft(created.draftId, 1, changed, 1, 'update-request-0001');
  assert.throws(() => repository.publish(created.draftId, { expectedRevision: 2, contentHash: checked.contentHash, requestId: 'publish-request-001' }, 1), /未审核|变化/);
  assert.equal(repository.getDraft(created.draftId).reviewHash, null);
  assert.deepEqual(repository.deleteDraft(created.draftId, 2, 1, 'delete-request-001'), { deleted: true, draftId: created.draftId });
  assert.deepEqual(repository.deleteDraft(created.draftId, 2, 1, 'delete-request-001'), { deleted: true, draftId: created.draftId });
});

test('publish requires the exact uploaded audio, is immutable, and unlist retains releases', t => {
  const { repository } = setup(t); const pkg = packageFor(repository);
  const created = repository.createDraft(pkg, 1, 'create-request-0002');
  const checked = repository.validate(created.draftId, { forPublish: true });
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  repository.review(created.draftId, checked.contentHash);
  const result = repository.publish(created.draftId, { expectedRevision: 1, contentHash: checked.contentHash, requestId: 'publish-request-001' }, 1);
  assert.deepEqual(repository.publish(created.draftId, { expectedRevision: 1, contentHash: checked.contentHash, requestId: 'publish-request-001' }, 1), result);
  assert.equal(repository.catalog().length, 1);
  assert.equal(repository.unlist(pkg.courseId, { requestId: 'unlist-request-001' }, 1).unlisted, true);
  assert.equal(repository.catalog().length, 0);
  assert.equal(repository.release(pkg.courseId, result.releaseId).contentHash, checked.contentHash);
});

