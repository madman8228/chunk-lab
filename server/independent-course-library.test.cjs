'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createCourseLibrary } = require('./services/course-library');
const { registerCourseLibraryRoutes } = require('./routes/course-library');
const { registerDataRoutes } = require('./routes/data');
const { createLearningDataFormat } = require('./services/learning-data-format');
const { createWorkspaceOperations } = require('./services/workspace-operations');

const schemaDb = new (require('better-sqlite3'))(':memory:');
try {
  schemaDb.exec("CREATE TABLE course_contents(course_id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,active_release TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_by INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  require('./services/course-library-schema').ensureCourseLibrarySchema(schemaDb);
  require('./services/course-library-schema').ensureCourseLibrarySchema(schemaDb);
  assert(schemaDb.pragma('table_info(course_contents)').some(column => column.name === 'visibility'),
    'schema upgrades an already-created content table idempotently');
} finally {
  schemaDb.close();
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-independent-course-'));
let db, backupRoot;
try {
  const priorDataDir = process.env.CHUNKLAB_DATA_DIR;
  process.env.CHUNKLAB_DATA_DIR = dir;
  db = require('./db');
  if (priorDataDir === undefined) delete process.env.CHUNKLAB_DATA_DIR;
  else process.env.CHUNKLAB_DATA_DIR = priorDataDir;
  const library = createCourseLibrary({ db, now: () => '2026-10-21T00:00:00.000Z' });

  const imported = library.importContent(37, {
    requestId: 'fixture-request-0001', kind: 'course',
    content: { courseId: 'old-account-course', title: 'Fixture course', items: [
      { id: 'item-1', cid: 'line-1', sentence: 'Hello.' }, { id: 'item-2', cid: 'line-2', sentence: 'World.' }
    ] }
  });
  assert.match(imported.courseId, /^private-/);
  assert.equal(library.catalog(37).length, 1);
  assert.equal(library.catalog(37)[0].visibility, 'private');
  assert.equal(library.catalog(38).length, 0, 'other account must not discover private content');
  assert.equal(library.read(37, imported.courseId).content.items[0].id, 'item-1');
  assert.equal(library.read(37, imported.courseId).content.courseId, imported.courseId);
  assert.throws(() => library.read(38, imported.courseId), { code: 'COURSE_NOT_AVAILABLE' });

  const replay = library.importContent(37, {
    requestId: 'fixture-request-0001', kind: 'course',
    content: { courseId: 'old-account-course', title: 'Fixture course', items: [
      { id: 'item-1', cid: 'line-1', sentence: 'Hello.' }, { id: 'item-2', cid: 'line-2', sentence: 'World.' }
    ] }
  });
  assert.equal(replay.courseId, imported.courseId, 'retry must not create duplicate content');
  assert.equal(replay.replay, true);
  assert.throws(() => library.importContent(37, {
    requestId: 'fixture-request-0001', kind: 'course', content: { title: 'different' }
  }), { code: 'IDEMPOTENCY_CONFLICT' });

  const imageBytes = fs.readFileSync(path.resolve(__dirname, '../assets/vocab-g7-lower-u1-blind-wide-v1.webp'));
  const imageHash = require('node:crypto').createHash('sha256').update(imageBytes).digest('hex');
  const sourceCourseId = 'ai-image-source-1234567890', sourceAssetId = sourceCourseId + ':image:one', sourceLineId = sourceCourseId + ':line:001';
  const imageContent = { schemaVersion: '2.0', courseId: sourceCourseId, metadata: { title: { en: 'Image test', 'zh-CN': '图片测试' } },
    assets: [{ id: sourceAssetId, path: 'images/one.webp', fileName: 'one.webp', mimeType: 'image/webp' }],
    utterances: [{ id: sourceLineId, text: { en: 'A sentence.', 'zh-CN': '一个句子。' }, imageAssetId: sourceAssetId }], sequence: [sourceLineId] };
  const imageCourse = library.importContent(37, { requestId: 'image-course-import-001', kind: 'course', content: imageContent,
    assets: [{ assetId: sourceAssetId, mimeType: 'image/webp', bytes: imageBytes.length, sha256: imageHash, base64: imageBytes.toString('base64') }] });
  const storedImageCourse = library.read(37, imageCourse.courseId);
  const mappedAssetId = imageCourse.courseId + ':image:one';
  assert.equal(storedImageCourse.content.assets[0].id, mappedAssetId);
  assert.equal(storedImageCourse.content.utterances[0].imageAssetId, mappedAssetId);
  assert.deepEqual(library.readAsset(37, imageCourse.courseId, mappedAssetId).bytes, imageBytes);
  assert.throws(() => library.readAsset(38, imageCourse.courseId, mappedAssetId), { code: 'COURSE_ASSET_NOT_AVAILABLE' });
  const imageBatch = library.readBatch(37, imageCourse.courseId, { cursor: 0 });
  assert.equal(imageBatch.batch.contentType, 'image-text');assert.deepEqual(imageBatch.batch.assetIds, [mappedAssetId]);
  assert.equal(imageBatch.batch.items[0].sentence, 'A sentence.');
  assert.throws(() => library.importContent(37, { requestId: 'image-course-import-002', kind: 'course', content: imageContent,
    assets: [{ assetId: sourceAssetId, mimeType: 'image/webp', bytes: imageBytes.length, sha256: '0'.repeat(64), base64: imageBytes.toString('base64') }] }),
  { code: 'COURSE_ASSET_INTEGRITY_FAILURE' });

  const firstBatch = library.readBatch(37, imported.courseId, { cursor: 0 });
  assert.equal(firstBatch.batch.items.length, 2);
  assert.equal(firstBatch.batch.nextCursor, null);
  assert.equal(firstBatch.batch.recordIdentity.deckId, imported.courseId);
  assert.throws(() => library.readBatch(38, imported.courseId, { cursor: 0 }), { code: 'COURSE_NOT_AVAILABLE' });

  const convertedLegacyDeck = library.importContent(37, { requestId: 'legacy-course-import-001', kind: 'deck',
    sourceMapping: { kind: 'course', sourceId: 'old-ai-course-id' },
    content: { id: 'old-ai-course-id', name: 'Converted legacy course', items: [
      { cid: 'line-a', sentence: 'We are ready.' }, { cid: 'line-b', sentence: 'Let us begin.' }
    ], authoring: { template: 'sentence-practice', templateVersion: 1, contentForm: 'article',
      learning: { modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' }, roles: [] } } });
  const legacyDeckBatch = library.readBatch(37, convertedLegacyDeck.courseId, { cursor: 0 }).batch;
  assert.equal(legacyDeckBatch.recordIdentity.deckId, 'old-ai-course-id',
    'legacy conversion keeps the prior course learning identity without copying its content into account data');
  assert.equal(legacyDeckBatch.context.authoring.learning.defaultMode, 'chunkSelection');
  assert.equal(legacyDeckBatch.context.authoring.contentForm, 'article');
  assert.deepEqual(library.catalog(37).find(row => row.courseId === convertedLegacyDeck.courseId).legacyResourceIds,
    ['course:old-ai-course-id'], 'the old course resource resolves only for its owner');
  assert.throws(() => library.importContent(37, { requestId: 'legacy-course-import-002', kind: 'deck',
    sourceMapping: { kind: 'course', sourceId: 'old-ai-course-id' },
    content: { id: 'second-copy', name: 'Conflicting copy', items: [{ cid: 'one', sentence: 'Another.' }] } }),
  { code: 'COURSE_SOURCE_MAPPING_CONFLICT' }, 'a legacy source cannot silently point to two independent courses');

  db.prepare("INSERT INTO users(id,username,password_hash) VALUES(37,'content-owner','not-a-real-login')").run();
  db.prepare('INSERT INTO user_change_seq(user_id,seq) VALUES(37,4)').run();
  const updated = library.updateContent(37, { courseId: imported.courseId, requestId: 'fixture-release-0001',
    expectedRelease: imported.releaseId, kind: 'course',
    content: { courseId: 'client-id-is-ignored', title: 'Fixture course v2', items: [{ id: 'item-2', cid: 'line-2', sentence: 'World.' }] } });
  assert.equal(updated.changed, true);
  assert.equal(library.read(37, imported.courseId).content.items[0].id, 'item-2');
  assert.equal(library.read(37, imported.courseId, imported.releaseId).content.items[0].id, 'item-1', 'old release remains immutable');
  assert.equal(library.readBatch(37, imported.courseId, { cursor: 0, releaseId: imported.releaseId }).batch.items[0].sentence, 'Hello.');
  assert.throws(() => library.updateContent(37, { courseId: imported.courseId, requestId: 'fixture-release-0002',
    expectedRelease: imported.releaseId, kind: 'course', content: { title: 'stale', items: [] } }),
  { code: 'COURSE_RELEASE_CONFLICT' });
  db.prepare(`INSERT INTO course_content_legacy_mappings(source_user_id,source_kind,source_id,course_id,source_hash)
    VALUES(37,'course','legacy-story-id',?,?)`).run(imported.courseId,'a'.repeat(64));
  assert.deepEqual(library.catalog(37).find(row => row.courseId === imported.courseId).legacyResourceIds,['course:legacy-story-id'],
    'only the owning account receives its old resource alias');
  assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=37').get().seq, 4,
    'course content edits must not advance the personal learning sequence');

  // Content and its access audit are not cascaded from an accounts table.
  db.prepare("INSERT INTO users(id,username,password_hash) VALUES(38,'authorized-reader','not-a-real-login')").run();
  const publicCourse = library.importContent(37, { requestId: 'fixture-public-course-01', kind: 'course',
    content: { courseId: 'fixture-public-source', title: 'Public fixture', items: [{ id: 'public-line', sentence: 'Public.' }] } });
  db.prepare("UPDATE course_contents SET visibility='public' WHERE course_id=?").run(publicCourse.courseId);
  const publicCatalogEntry = library.catalog(38).find(row => row.courseId === publicCourse.courseId);
  assert.equal(publicCatalogEntry.visibility, 'public', 'catalog preserves public-vs-private visibility for clients');
  db.prepare("INSERT INTO course_content_access(course_id,subject_user_id,role) VALUES(?,38,'reader')").run(imported.courseId);
  db.prepare("INSERT INTO course_content_access(course_id,subject_user_id,role) VALUES(?,38,'reader')").run(imageCourse.courseId);
  assert.deepEqual(library.catalog(38).find(row => row.courseId === imported.courseId).legacyResourceIds,[],
    'content readers do not receive another account\'s legacy aliases');
  db.prepare('DELETE FROM users WHERE id=?').run(37);
  assert.equal(library.read(38, imported.courseId).content.title, 'Fixture course v2');
  assert.equal(library.read(38, publicCourse.courseId).content.title, 'Public fixture');
  assert.equal(db.prepare('SELECT count(*) AS n FROM course_contents').get().n, 4);
  assert.equal(db.prepare('SELECT count(*) AS n FROM course_content_releases').get().n, 5);
  assert.deepEqual(library.readAsset(38, imageCourse.courseId, mappedAssetId).bytes, imageBytes,
    'binary course content remains available after deleting its importing account');

  const enrolledCourseId = 'personal-course:' + imageCourse.courseId;
  const enrollmentId = 'enrollment:v1:' + encodeURIComponent(enrolledCourseId);
  const enrollment = { kind: 'course-enrollment', schemaVersion: 1, courseId: enrolledCourseId,
    joined: true, joinedAt: 100, changedAt: 100 };
  db.prepare(`INSERT INTO user_course_progress(user_id,course_id,data_json,rev,seq)
    VALUES(38,?,?,1,1)`).run(enrollmentId, JSON.stringify(enrollment));

  backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-independent-course-backup-'));
  const backupDir = path.join(backupRoot, 'snapshots');
  const backupResult = spawnSync(process.execPath, [path.join(__dirname, 'backup-db.js'), 'backup'], { cwd: __dirname, encoding: 'utf8', env: {
    ...process.env, CHUNKLAB_DATA_DIR: dir, BACKUP_DIR: backupDir, CHUNKLAB_APP_ROOT: path.join(backupRoot, 'empty-app')
  } });
  assert.equal(backupResult.status, 0, backupResult.stderr);
  const backupFile = fs.readdirSync(backupDir).find(name => /^chunklab_db_.*\.db$/.test(name));
  assert.ok(backupFile, 'the regular full database backup contains independent courses');
  const backupDb = new (require('better-sqlite3'))(path.join(backupDir, backupFile), { readonly: true, fileMustExist: true });
  try {
    assert.equal(backupDb.pragma('quick_check', { simple: true }), 'ok');
    const backedUp = backupDb.prepare(`SELECT b.content,b.sha256 FROM course_asset_blobs b
      JOIN course_content_release_assets a ON a.sha256=b.sha256 WHERE a.course_id=? AND a.asset_id=?`).get(imageCourse.courseId, mappedAssetId);
    assert.deepEqual(Buffer.from(backedUp.content), imageBytes, 'full SQLite disaster backup preserves the independent course media bytes');
  } finally { backupDb.close(); }

  const restoredDataDir = path.join(backupRoot, 'restored-data');
  fs.mkdirSync(restoredDataDir);
  const restoredDbPath = path.join(restoredDataDir, 'chunklab.db');
  fs.copyFileSync(path.join(backupDir, backupFile), restoredDbPath);
  const restoredDb = new (require('better-sqlite3'))(restoredDbPath);
  try {
    assert.equal(restoredDb.pragma('quick_check', { simple: true }), 'ok');
    const restoredLibrary = createCourseLibrary({ db: restoredDb });
    assert.equal(restoredLibrary.read(38, imageCourse.courseId).content.courseId, imageCourse.courseId,
      'restored course body remains addressable through the independent library');
    assert.deepEqual(restoredLibrary.readAsset(38, imageCourse.courseId, mappedAssetId).bytes, imageBytes,
      'restored authorized reader can retrieve the exact image bytes');
    assert.equal(restoredDb.prepare('SELECT 1 FROM users WHERE id=37').get(), undefined,
      'deleted account is not resurrected by restoring the database backup');
    assert.equal(restoredDb.prepare(`SELECT role FROM course_content_access
      WHERE course_id=? AND subject_user_id=38`).get(imageCourse.courseId).role, 'reader',
    'explicit reader authorization survives backup restoration');
    const { createSnapshotReader } = require('./services/data-snapshot');
    const restoredReferences = createSnapshotReader({ db: restoredDb, currentSeq: () => 0 }).readLearningSnapshot(38, null);
    assert.equal(restoredReferences.courseProgress[enrollmentId].courseId, enrolledCourseId,
      'restored account learning reference remains intact');
    assert.equal(JSON.stringify(restoredReferences).includes('A sentence.'), false,
      'restored account learning data still contains no course body');
  } finally { restoredDb.close(); }

  // Exercise the production schema and snapshot reader in this same temporary DB.
  db.prepare("INSERT INTO users(id,username,password_hash) VALUES(1,'fixture','not-a-real-login')").run();
  db.prepare('INSERT INTO user_change_seq(user_id,seq) VALUES(1,3)').run();
  db.prepare("INSERT INTO user_decks(user_id,id,name,items_json,builtin,rev,seq) VALUES(1,'fixture-deck','Private words','[{\"id\":\"word-1\"}]',0,1,3)").run();
  db.prepare("INSERT INTO user_courses(user_id,course_id,data_json,rev,seq) VALUES(1,'fixture-course','{\"courseId\":\"fixture-course\",\"title\":\"Private course body\",\"items\":[{\"id\":\"sentence-1\"}]}',1,3)").run();
  const { createSnapshotReader } = require('./services/data-snapshot');
  const snapshots = createSnapshotReader({ db, currentSeq: () => 3 });
  const references = snapshots.readLearningSnapshot(1, null);
  assert.equal(references.format, 'references-v1');
  assert.equal(Object.hasOwn(references, 'courses'), true);
  assert.equal(references.courses.length, 0);
  assert.equal(references.mem.decks.length, 0);
  assert.equal(JSON.stringify(references).includes('Private course body'), false);
  assert.equal(JSON.stringify(references).includes('sentence-1'), false);
  assert.equal(snapshots.readMemSnapshot(1, null).courses.length, 1, 'legacy endpoint remains unchanged until migration');

  const handlers = new Map();
  const app = { get: (url, ...fns) => handlers.set('GET ' + url, fns.at(-1)),
    post: (url, ...fns) => handlers.set('POST ' + url, fns.at(-1)),
    put: (url, ...fns) => handlers.set('PUT ' + url, fns.at(-1)) };
  const auth = { authenticate: (_req, _res, next) => next() };
  registerCourseLibraryRoutes({ app, auth, library, validate: { validateCourse: () => null, validateMem: () => null } });
  const learningDataFormat = createLearningDataFormat(db);
  registerDataRoutes({ app, auth, readMemSnapshot: snapshots.readMemSnapshot,
    readLearningSnapshot: snapshots.readLearningSnapshot, learningDataFormat });
  function response() {
    return { statusCode: 200, headers: {}, body: null,
      status(code) { this.statusCode = code; return this; },
      set(key, value) { this.headers[key] = value; return this; },
      json(value) { this.body = value; return this; } };
  }
  assert.equal(learningDataFormat.forUser(1), 'legacy-v1', 'unmarked accounts remain on the legacy format');
  const formatRes = response();
  handlers.get('GET /api/learning-data/format')({ userId: 1 }, formatRes);
  assert.equal(formatRes.body.format, 'legacy-v1');
  const inactiveLearningRes = response();
  handlers.get('GET /api/learning-data')({ userId: 1, query: {} }, inactiveLearningRes);
  assert.equal(inactiveLearningRes.statusCode, 409, 'unmigrated accounts cannot consume references-only snapshots');
  assert.equal(inactiveLearningRes.body.code, 'LEARNING_DATA_FORMAT_NOT_ACTIVE');
  db.prepare("INSERT INTO user_learning_data_formats(user_id,format,migration_id) VALUES(1,'references-v1','verified-fixture-migration')").run();
  assert.equal(learningDataFormat.forUser(1), 'references-v1');
  const learningRes = response();
  handlers.get('GET /api/learning-data')({ userId: 1, query: {} }, learningRes);
  assert.equal(learningRes.headers['X-Learning-Data-Format'], 'references-v1');
  assert.equal(learningRes.body.format, 'references-v1');
  const catalogRes = response();
  handlers.get('GET /api/course-library')({ userId: 37 }, catalogRes);
  assert.ok(catalogRes.body.courses.some(course => course.courseId === imported.courseId));
  const batchRes = response();
  handlers.get('GET /api/course-library/:courseId/batch')({ userId: 39, params: { courseId: imported.courseId }, query: { cursor: '0' } }, batchRes);
  assert.equal(batchRes.statusCode, 404, 'batch route enforces the same private-course ACL');
  const readerBatchRes = response();
  handlers.get('GET /api/course-library/:courseId/batch')({ userId: 38, params: { courseId: imported.courseId }, query: { cursor: '0', releaseId: imported.releaseId } }, readerBatchRes);
  assert.equal(readerBatchRes.body.contentVersion, imported.releaseId);
  assert.equal(readerBatchRes.body.batch.items[0].sentence, 'Hello.');
  const privateRes = response();
  handlers.get('GET /api/course-library/:courseId')({ userId: 39, params: { courseId: imported.courseId }, query: {} }, privateRes);
  assert.equal(privateRes.statusCode, 404);
  const workspace = createWorkspaceOperations({ db, library: null, courseLibrary: library,
    upsertEntityRow() {}, operationError: (message, code, status) => Object.assign(new Error(message), { code, status }) });
  assert.equal(workspace.apply(38, { type: 'workspace.select', payload: {
    itemType: 'resource', targetId: 'course:' + imported.courseId, selected: true
  } }, 5).entity, 'learningWorkspace');
  assert.throws(() => workspace.apply(39, { type: 'workspace.select', payload: {
    itemType: 'resource', targetId: 'course:' + imported.courseId, selected: true
  } }, 5), { code: 'RESOURCE_NOT_AVAILABLE' });
  console.log('independent course library isolated contract: ok');
} finally {
  if (db) db.close();
  fs.rmSync(dir, { recursive: true, force: true });
  if (backupRoot) fs.rmSync(backupRoot, { recursive: true, force: true });
}
