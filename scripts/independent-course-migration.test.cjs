'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('../server/node_modules/better-sqlite3');
const { ensureCourseLibrarySchema } = require('../server/services/course-library-schema');
const { buildManifest, applyManifest } = require('../server/services/course-library-migration');
const { createCourseLibrary } = require('../server/services/course-library');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-course-migration-'));
const openDbs = [];
function fixture(name) {
  const db = new Database(path.join(dir, name));
  openDbs.push(db);
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY);
    CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,items_json TEXT,builtin INTEGER,is_public INTEGER,authoring_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,id));
    CREATE TABLE user_courses(user_id INTEGER,course_id TEXT,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_course_progress(user_id INTEGER,course_id TEXT,data_json TEXT,PRIMARY KEY(user_id,course_id));
    CREATE TABLE user_learning_resumes(user_id INTEGER,session_id TEXT,course_id TEXT,PRIMARY KEY(user_id,session_id));
    CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,deleted_at TEXT);
    CREATE TABLE personal_wordbook_versions(user_id INTEGER,book_id TEXT,version INTEGER,revision TEXT,package_json TEXT,created_at TEXT,PRIMARY KEY(user_id,book_id,version));`);
  ensureCourseLibrarySchema(db);
  return db;
}

try {
  const db = fixture('migration.sqlite');
  db.prepare('INSERT INTO users(id) VALUES(10),(11)').run();
  db.prepare('INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public,authoring_json) VALUES(?,?,?,?,?,?,?)')
    .run(10, 'same-id', 'Public owner copy', '[{"id":"a","sentence":"Hello."}]', 0, 1, null);
  db.prepare('INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public,authoring_json) VALUES(?,?,?,?,?,?,?)')
    .run(11, 'same-id', 'Private other copy', '[{"id":"b","sentence":"Goodbye."}]', 0, 0, null);
  db.prepare('INSERT INTO user_courses(user_id,course_id,data_json) VALUES(?,?,?)')
    .run(10, 'story-id', JSON.stringify({ courseId: 'story-id', title: 'Story',
      assets: [{ id: 'image-1', mimeType: 'image/webp', _dataUri: 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, '../assets/vocab-g7-lower-u1-blind-wide-v1.webp')).toString('base64') }], items: [
        { id: 's1', imageAssetId: 'image-1' }, { id: 's1' }
      ] }));
  db.prepare('INSERT INTO user_course_progress(user_id,course_id,data_json) VALUES(?,?,?),(?,?,?)')
    .run(10, 'enrollment:v1:user-deck%3Asame-id', JSON.stringify({ kind: 'course-enrollment', schemaVersion: 1, courseId: 'user-deck:same-id', joined: true }),
      10, 'enrollment:v1:story-id', JSON.stringify({ kind: 'course-enrollment', schemaVersion: 1, courseId: 'story-id', joined: true }));
  db.prepare('INSERT INTO user_learning_resumes(user_id,session_id,course_id) VALUES(?,?,?)').run(10, 'resume-1', 'story-id');
  const before = {
    decks: db.prepare('SELECT * FROM user_decks ORDER BY user_id,id').all(),
    courses: db.prepare('SELECT * FROM user_courses ORDER BY user_id,course_id').all()
  };
  const manifest = buildManifest(db, { createdAt: '2026-10-21T00:00:00.000Z' });
  assert.equal(manifest.entries.length, 3);
  assert.equal(manifest.idCollisions.length, 1);
  const storyEntry = manifest.entries.find(entry => entry.kind === 'course');
  assert.equal(storyEntry.inventory.itemCount, 2);
  assert.deepEqual(storyEntry.inventory.duplicateItemIds, ['s1']);
  assert.equal(storyEntry.inventory.mediaReferenceCount, 1);
  assert.deepEqual(storyEntry.inventory.unavailableAssetIds, []);
  assert.equal(manifest.totals.undeclaredMediaReferences, 0);
  assert.equal(manifest.totals.mappedLearningReferences, 3);
  assert.deepEqual(manifest.learningReferences.courseProgress.map(row => [row.sourceId, row.targetId, row.kind, row.keyMatchesValue]), [
    ['story-id', storyEntry.courseId, 'enrollment', true],
    ['user-deck:same-id', manifest.entries.find(row => row.kind === 'deck' && row.userId === 10).courseId, 'enrollment', true]
  ]);
  assert.deepEqual(manifest.learningReferences.learningResumes, [{ userId: 10, sessionId: 'resume-1', sourceId: 'story-id', targetId: storyEntry.courseId }]);
  assert.notEqual(manifest.entries[0].courseId, manifest.entries[1].courseId, 'same legacy ID across accounts must not collide');
  assert.equal(db.prepare('SELECT count(*) AS n FROM course_contents').get().n, 0, 'preview is read-only');

  const enrollmentKey = 'enrollment:v1:story-id';
  db.prepare('UPDATE user_course_progress SET data_json=? WHERE user_id=10 AND course_id=?')
    .run(JSON.stringify({ kind: 'course-enrollment', schemaVersion: 1, courseId: 'changed-id', joined: true }), enrollmentKey);
  assert.throws(() => applyManifest(db, manifest), { code: 'MIGRATION_SOURCE_CHANGED' },
    'a changed learning reference invalidates the preview before any course is copied');
  db.prepare('UPDATE user_course_progress SET data_json=? WHERE user_id=10 AND course_id=?')
    .run(JSON.stringify({ kind: 'course-enrollment', schemaVersion: 1, courseId: 'story-id', joined: true }), enrollmentKey);

  assert.deepEqual(applyManifest(db, manifest), { sourceDigest: manifest.sourceDigest, added: 3, alreadyApplied: 0, total: 3 });
  assert.deepEqual(applyManifest(db, manifest), { sourceDigest: manifest.sourceDigest, added: 0, alreadyApplied: 3, total: 3 });
  assert.equal(db.prepare("SELECT visibility FROM course_contents WHERE created_by=10 AND kind='deck'").get().visibility, 'public');
  assert.equal(db.prepare("SELECT visibility FROM course_contents WHERE created_by=11 AND kind='deck'").get().visibility, 'private');
  const library = createCourseLibrary({ db });
  const publicCourse = manifest.entries.find(row => row.userId === 10 && row.kind === 'deck');
  const privateCourse = manifest.entries.find(row => row.userId === 11 && row.kind === 'deck');
  assert.equal(library.read(99, publicCourse.courseId).content.name, 'Public owner copy');
  assert.equal(library.catalog(99).some(row => row.courseId === publicCourse.courseId), true);
  assert.equal(library.catalog(99).some(row => row.courseId === privateCourse.courseId), false);
  assert.throws(() => library.read(99, privateCourse.courseId), { code: 'COURSE_NOT_AVAILABLE' });
  const migratedDeckBatch = library.readBatch(10, publicCourse.courseId, { cursor: 0 }).batch;
  assert.equal(migratedDeckBatch.recordIdentity.deckId, 'same-id', 'legacy progress keys continue resolving to their original deck identity');
  assert.equal(migratedDeckBatch.items[0].cid, 'a');
  const migratedStory = manifest.entries.find(row => row.kind === 'course');
  const migratedAsset = library.readAsset(10, migratedStory.courseId, 'image-1');
  assert.equal(migratedAsset.mimeType, 'image/webp');
  assert.equal(migratedAsset.bytes.length, storyEntry.inventory.assets[0].bytes);
  assert.deepEqual(db.prepare('SELECT * FROM user_decks ORDER BY user_id,id').all(), before.decks);
  assert.deepEqual(db.prepare('SELECT * FROM user_courses ORDER BY user_id,course_id').all(), before.courses);
  db.prepare("UPDATE user_decks SET name='changed' WHERE user_id=10 AND id='same-id'").run();
  assert.throws(() => applyManifest(db, manifest), { code: 'MIGRATION_SOURCE_CHANGED' });
  db.close();

  const missingAssetDb = fixture('missing-asset.sqlite');
  missingAssetDb.prepare('INSERT INTO users(id) VALUES(14)').run();
  missingAssetDb.prepare('INSERT INTO user_courses(user_id,course_id,data_json) VALUES(?,?,?)').run(14, 'missing-course', JSON.stringify({
    courseId: 'missing-course', title: 'Missing media', assets: [{ id: 'picture', mimeType: 'image/webp', path: 'images/picture.webp' }],
    utterances: [{ id: 'line-1', text: { en: 'Hello.' }, imageAssetId: 'picture' }]
  }));
  const missingAssetManifest = buildManifest(missingAssetDb, { createdAt: '2026-10-21T00:00:00.000Z' });
  assert.deepEqual(missingAssetManifest.entries[0].inventory.unavailableAssetIds, ['picture']);
  assert.throws(() => applyManifest(missingAssetDb, missingAssetManifest), { code: 'MIGRATION_ASSET_BYTES_UNAVAILABLE' });
  assert.equal(missingAssetDb.prepare('SELECT count(*) AS n FROM course_contents').get().n, 0, 'missing legacy media blocks the whole migration transaction');
  missingAssetDb.close();

  const mimeInferenceDb = fixture('mime-inference.sqlite');
  mimeInferenceDb.prepare('INSERT INTO users(id) VALUES(17)').run();
  const imageBytes = fs.readFileSync(path.join(__dirname, '../assets/vocab-g7-lower-u1-blind-wide-v1.webp'));
  mimeInferenceDb.prepare('INSERT INTO user_courses(user_id,course_id,data_json) VALUES(?,?,?)').run(17, 'mime-inference', JSON.stringify({
    courseId: 'mime-inference', title: 'MIME inference', assets: [
      { id: 'wildcard-image', type: 'image', path: 'images/wildcard.webp', _dataUri: 'data:image/*;base64,' + imageBytes.toString('base64') },
      { id: 'untyped-image', type: 'image', path: 'images/untyped.webp', _dataUri: 'data:image/webp;base64,' + imageBytes.toString('base64') }
    ], utterances: [{ id: 'line-1', imageAssetId: 'wildcard-image' }, { id: 'line-2', imageAssetId: 'untyped-image' }]
  }));
  const mimeInferenceManifest = buildManifest(mimeInferenceDb, { createdAt: '2026-10-21T00:00:00.000Z' });
  assert.deepEqual(mimeInferenceManifest.entries[0].inventory.unavailableAssetIds, [],
    'the media signature safely supplies a missing or wildcard legacy MIME type');
  assert.deepEqual(mimeInferenceManifest.entries[0].inventory.assets.map(asset => asset.mimeType), ['image/webp', 'image/webp'],
    'the migration preview records the verified media type, not the legacy wildcard');
  assert.equal(mimeInferenceManifest.entries[0].inventory.migrationBlockers.length, 0);
  mimeInferenceDb.close();

  const mimeMismatchDb = fixture('mime-mismatch.sqlite');
  mimeMismatchDb.prepare('INSERT INTO users(id) VALUES(18)').run();
  mimeMismatchDb.prepare('INSERT INTO user_courses(user_id,course_id,data_json) VALUES(?,?,?)').run(18, 'mime-mismatch', JSON.stringify({
    courseId: 'mime-mismatch', title: 'MIME mismatch', assets: [
      { id: 'misleading-image', mimeType: 'image/png', path: 'images/misleading.png', _dataUri: 'data:image/webp;base64,' + imageBytes.toString('base64') }
    ], utterances: [{ id: 'line-1', imageAssetId: 'misleading-image' }]
  }));
  const mimeMismatchManifest = buildManifest(mimeMismatchDb, { createdAt: '2026-10-21T00:00:00.000Z' });
  assert.deepEqual(mimeMismatchManifest.entries[0].inventory.unavailableAssetIds, ['misleading-image'],
    'a declared type that conflicts with the data URI and actual bytes remains blocked');
  mimeMismatchDb.close();

  const legacyAudioDb = fixture('legacy-audio.sqlite');
  legacyAudioDb.prepare('INSERT INTO users(id) VALUES(19),(20)').run();
  const audioBytes = Buffer.from('ID3\\u0004\\u0000\\u0000');
  legacyAudioDb.prepare('INSERT INTO user_courses(user_id,course_id,data_json) VALUES(?,?,?),(?,?,?)').run(
    19, 'legacy-audio', JSON.stringify({ courseId: 'legacy-audio', title: 'Legacy audio', assets: [
      { id: 'line-audio', type: 'line_audio', path: 'audio/line.mp3', _dataUri: 'data:image/*;base64,' + audioBytes.toString('base64') }
    ], utterances: [{ id: 'line-1', audioAssetId: 'line-audio' }] }),
    20, 'audio-used-as-image', JSON.stringify({ courseId: 'audio-used-as-image', title: 'Audio used as image', assets: [
      { id: 'line-audio', type: 'line_audio', path: 'audio/line.mp3', _dataUri: 'data:image/*;base64,' + audioBytes.toString('base64') }
    ], utterances: [{ id: 'line-1', imageAssetId: 'line-audio' }] })
  );
  const legacyAudioManifest = buildManifest(legacyAudioDb, { createdAt: '2026-10-21T00:00:00.000Z' });
  const audioEntry = legacyAudioManifest.entries.find(entry => entry.legacyId === 'legacy-audio');
  const wrongReferenceEntry = legacyAudioManifest.entries.find(entry => entry.legacyId === 'audio-used-as-image');
  assert.deepEqual(audioEntry.inventory.unavailableAssetIds, [],
    'legacy wildcard data URI is corrected only when its audio type, audio reference, and MP3 signature agree');
  assert.equal(audioEntry.inventory.assets[0].mimeType, 'audio/mpeg');
  assert.deepEqual(wrongReferenceEntry.inventory.unavailableAssetIds, ['line-audio'],
    'a line-audio asset referenced as an image remains blocked');
  legacyAudioDb.close();

  const wordbookDb = fixture('wordbook-history.sqlite');
  wordbookDb.prepare('INSERT INTO users(id) VALUES(15),(16)').run();
  const bookId = 'personal-book:' + 'a'.repeat(32), itemId = 'personal-item:' + 'a'.repeat(32) + ':' + 'b'.repeat(32);
  const packageFor = (revision, items, itemRows) => JSON.stringify({ index: { books: [{ bookId, title: '私有词书', revision,
    itemCount: itemRows.length, items: itemRows.map(ref => ({ itemId: ref.itemId, contentRevision: ref.contentRevision })), units: [] }] }, items });
  const firstPackage = packageFor('1'.repeat(64), [{ itemId, word: 'sincere', images: { wide: ['assets/sincere.webp'], mobile: ['assets/sincere.webp'] } }],
    [{ itemId, contentRevision: 'c'.repeat(64) }]);
  const secondItemId = 'personal-item:' + 'a'.repeat(32) + ':' + 'd'.repeat(32);
  const secondPackage = packageFor('2'.repeat(64), [JSON.parse(firstPackage).items[0], { itemId: secondItemId, word: 'honest' }],
    [{ itemId, contentRevision: 'c'.repeat(64) }, { itemId: secondItemId, contentRevision: 'e'.repeat(64) }]);
  const insertWordbook = wordbookDb.prepare('INSERT INTO personal_wordbook_versions VALUES(15,?,?,?,?,?)');
  insertWordbook.run(bookId, 1, '1'.repeat(64), firstPackage, '2026-10-20T00:00:00.000Z');
  insertWordbook.run(bookId, 2, '2'.repeat(64), secondPackage, '2026-10-21T00:00:00.000Z');
  wordbookDb.prepare('INSERT INTO user_entity_rows VALUES(15,?,?,?,NULL)').run('vocabularyResume', bookId,
    JSON.stringify({ bookId, itemId, bookRevision: '1'.repeat(64), status: 'in-progress' }));
  const beforeWordbookRows = wordbookDb.prepare('SELECT * FROM personal_wordbook_versions ORDER BY version').all();
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets/sincere.webp'), Buffer.alloc(19999));
  const wordbookManifest = buildManifest(wordbookDb, { createdAt: '2026-10-21T00:00:00.000Z', assetRoot: dir });
  const wordbookEntry = wordbookManifest.entries[0];
  assert.equal(wordbookEntry.family, 'vocabulary-book');
  assert.equal(wordbookEntry.sourceVersions.length, 2, 'all immutable source revisions are represented in the manifest');
  assert.equal(wordbookEntry.inventory.itemCount, 2);
  assert.deepEqual(wordbookEntry.inventory.assets, [{ path: 'assets/sincere.webp', bytes: 19999,
    sha256: require('node:crypto').createHash('sha256').update(Buffer.alloc(19999)).digest('hex') }], 'asset hash and hard size limit are included in the source manifest');
  assert.equal(wordbookEntry.legacyId, 'wordbook:' + bookId, 'mapping namespace cannot collide with sentence-course IDs');
  assert.equal(wordbookManifest.learningReferences.vocabularyReferences[0].sourceId, bookId);
  assert.equal(wordbookManifest.learningReferences.vocabularyReferences[0].targetId, wordbookEntry.courseId,
    'learning resume identity is audited to the independent book without moving the learning row');
  assert.equal(wordbookDb.prepare('SELECT count(*) AS n FROM course_contents').get().n, 0, 'wordbook preview is read-only');
  assert.deepEqual(applyManifest(wordbookDb, wordbookManifest, { assetRoot: dir }), { sourceDigest: wordbookManifest.sourceDigest, added: 1, alreadyApplied: 0, total: 1 });
  assert.deepEqual(applyManifest(wordbookDb, wordbookManifest, { assetRoot: dir }), { sourceDigest: wordbookManifest.sourceDigest, added: 0, alreadyApplied: 1, total: 1 });
  const wordbookLibrary = createCourseLibrary({ db: wordbookDb });
  const wordbookReleases = wordbookDb.prepare('SELECT release_id FROM course_content_releases WHERE course_id=? ORDER BY rowid').all(wordbookEntry.courseId);
  assert.equal(wordbookReleases.length, 2, 'each historical vocabulary package remains an immutable release');
  assert.deepEqual(wordbookLibrary.read(15, wordbookEntry.courseId, wordbookReleases[0].release_id).content.package, JSON.parse(firstPackage));
  assert.deepEqual(wordbookLibrary.read(15, wordbookEntry.courseId).content.package, JSON.parse(secondPackage));
  assert.equal(wordbookLibrary.read(15, wordbookEntry.courseId).content.contentFamily, 'vocabulary-book');
  assert.throws(() => wordbookLibrary.read(16, wordbookEntry.courseId), { code: 'COURSE_NOT_AVAILABLE' });
  const wordbookAdapter = require('../server/services/personal-wordbooks').createPersonalWordbooks({ db: wordbookDb, appRoot: path.resolve(__dirname, '..'), library: wordbookLibrary });
  assert.equal(wordbookAdapter.book(bookId, 15).revision, '2'.repeat(64), 'the existing vocabulary reader resolves migrated content through its legacy ID');
  assert.equal(wordbookAdapter.versions(bookId, 15).length, 2);
  assert.equal(wordbookAdapter.resources(15)[0].resourceId, 'wordbook:' + bookId);
  assert.deepEqual(wordbookDb.prepare('SELECT * FROM personal_wordbook_versions ORDER BY version').all(), beforeWordbookRows,
    'migration leaves the account archive source intact');
  assert.deepEqual(JSON.parse(wordbookDb.prepare('SELECT data_json FROM user_entity_rows WHERE kind=?').get('vocabularyResume').data_json),
    { bookId, itemId, bookRevision: '1'.repeat(64), status: 'in-progress' }, 'learning progress is not rewritten by content migration');
  wordbookDb.close();

  const deliveryDb = fixture('wordbook-webp-delivery.sqlite');
  deliveryDb.prepare('INSERT INTO users(id) VALUES(15)').run();
  const deliveryBytes = fs.readFileSync(path.join(__dirname, '../assets/vocab-g7-lower-u1-blind-wide-v1.webp'));
  fs.writeFileSync(path.join(dir, 'assets/delivery.webp'), deliveryBytes);
  const originalImages = { wide: ['assets/delivery.avif', 'assets/delivery.webp'], mobile: ['assets/delivery.avif', 'assets/delivery.webp'] };
  const deliveryItem = { itemId, contentRevision: 'c'.repeat(64), word: 'sincere', meaning: '真诚的', images: originalImages };
  const deliveryPackage = packageFor('1'.repeat(64), [deliveryItem], [deliveryItem]);
  deliveryDb.prepare('INSERT INTO personal_wordbook_versions VALUES(15,?,?,?,?,?)')
    .run(bookId, 1, '1'.repeat(64), deliveryPackage, '2026-10-21T00:00:00.000Z');
  const deliveryManifest = buildManifest(deliveryDb, { assetRoot: dir });
  assert.equal(deliveryManifest.totals.migrationBlockers, 0, 'an explicitly paired valid WebP supplies delivery without the absent AVIF');
  assert.equal(deliveryManifest.entries[0].inventory.deliveryOverrides[0].removed.length, 2);
  assert.deepEqual(deliveryManifest.entries[0].inventory.assets.map(value => value.path), ['assets/delivery.webp']);
  applyManifest(deliveryDb, deliveryManifest, { assetRoot: dir });
  assert.equal(applyManifest(deliveryDb, deliveryManifest, { assetRoot: dir }).alreadyApplied, 1);
  const deliveryLibrary = createCourseLibrary({ db: deliveryDb });
  const deliveredContent = deliveryLibrary.read(15, deliveryManifest.entries[0].courseId).content;
  assert.deepEqual(deliveredContent.package, JSON.parse(deliveryPackage), 'canonical source revisions stay byte-semantically intact');
  const deliveryAdapter = require('../server/services/personal-wordbooks').createPersonalWordbooks({ db: deliveryDb, appRoot: dir, library: deliveryLibrary });
  const deliveredItem = deliveryAdapter.item(itemId, deliveryItem.contentRevision, 15);
  assert.deepEqual(deliveredItem, { ...deliveryItem, images: { wide: ['assets/delivery.webp'], mobile: ['assets/delivery.webp'] } },
    'actual item delivery changes only image format selection, preserving learning IDs and revisions');
  assert.equal(deliveryAdapter.versions(bookId, 15)[0].revision, '1'.repeat(64));
  assert.equal(deliveryDb.prepare('SELECT package_json FROM personal_wordbook_versions').get().package_json, deliveryPackage);
  fs.writeFileSync(path.join(dir, 'assets/delivery.webp'), Buffer.alloc(20000));
  const invalidDelivery = buildManifest(deliveryDb, { assetRoot: dir });
  assert.equal(invalidDelivery.entries[0].inventory.deliveryOverrides, undefined, 'invalid or oversized replacements cannot suppress AVIF validation');
  assert.ok(invalidDelivery.totals.migrationBlockers > 0);
  assert.throws(() => applyManifest(deliveryDb, deliveryManifest, { assetRoot: dir }), { code: 'MIGRATION_SOURCE_CHANGED' });
  fs.writeFileSync(path.join(dir, 'assets/delivery.webp'), Buffer.alloc(100));
  assert.equal(buildManifest(deliveryDb, { assetRoot: dir }).entries[0].inventory.deliveryOverrides, undefined,
    'a small file with a WebP extension but invalid image bytes is not a replacement');
  fs.writeFileSync(path.join(dir, 'assets/delivery.webp'), deliveryBytes);
  const unpairedPackage = JSON.parse(deliveryPackage);
  unpairedPackage.items[0].images.wide = ['assets/delivery.avif'];
  deliveryDb.prepare('UPDATE personal_wordbook_versions SET package_json=?').run(JSON.stringify(unpairedPackage));
  assert.ok(buildManifest(deliveryDb, { assetRoot: dir }).totals.migrationBlockers > 0,
    'a WebP in another slot cannot authorize removal of an unpaired AVIF');
  deliveryDb.close();

  const cliPath = path.join(__dirname, 'migrate-independent-course-library.cjs');
  const missingAssetCliDb = path.join(dir, 'missing-asset.sqlite'), missingAssetCliManifest = path.join(dir, 'missing-asset.preview.json');
  const missingAssetPreview = spawnSync(process.execPath, [cliPath, '--db', missingAssetCliDb, '--write-manifest', missingAssetCliManifest], { encoding: 'utf8' });
  assert.equal(missingAssetPreview.status, 0, missingAssetPreview.stderr);
  assert.match(missingAssetPreview.stdout, /"migrationBlockers": 1/);
  const missingAssetApply = spawnSync(process.execPath, [cliPath, '--db', missingAssetCliDb, '--apply-manifest', missingAssetCliManifest], { encoding: 'utf8' });
  const missingAssetError = JSON.parse(missingAssetApply.stderr);
  assert.equal(missingAssetApply.status, 1);
  assert.equal(missingAssetError.code, 'MIGRATION_ASSET_BYTES_UNAVAILABLE');
  assert.equal(missingAssetError.blockers[0].assetId, 'picture', 'CLI reports the exact blocking asset to the operator');

  const rollback = fixture('rollback.sqlite');
  rollback.prepare('INSERT INTO users(id) VALUES(12),(13)').run();
  rollback.prepare('INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public) VALUES(12,\'a\',\'A\',\'[]\',0,0),(13,\'b\',\'B\',\'[]\',0,0)').run();
  const rollbackManifest = buildManifest(rollback, { createdAt: '2026-10-21T00:00:00.000Z' });
  const conflictTarget = rollbackManifest.entries.at(-1).courseId;
  rollback.prepare(`INSERT INTO course_contents(course_id,kind,title,active_release,created_by)
    VALUES(?,'deck','occupied','hash',999)`).run(conflictTarget);
  const firstTarget = rollbackManifest.entries[0].courseId;
  assert.throws(() => applyManifest(rollback, rollbackManifest), { code: 'MIGRATION_TARGET_CONFLICT' });
  assert.equal(rollback.prepare('SELECT 1 FROM course_contents WHERE course_id=?').get(firstTarget), undefined,
    'a failure rolls back all newly copied rows');
  rollback.close();

  const cliFixture = fixture('cli.sqlite');
  cliFixture.prepare('INSERT INTO users(id) VALUES(21)').run();
  cliFixture.prepare("INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public) VALUES(21,'cli-deck','CLI','[]',0,0)").run();
  cliFixture.close();
  const cliDb = path.join(dir, 'cli.sqlite'), manifestPath = path.join(dir, 'preview.json');
  const command = cliPath;
  const preview = spawnSync(process.execPath, [command, '--db', cliDb, '--write-manifest', manifestPath], { encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /"mode": "dry-run"/);
  const applied = spawnSync(process.execPath, [command, '--db', cliDb, '--apply-manifest', manifestPath], { encoding: 'utf8' });
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /"added": 1/);
  const replay = spawnSync(process.execPath, [command, '--db', cliDb, '--apply-manifest', manifestPath], { encoding: 'utf8' });
  assert.equal(replay.status, 0, replay.stderr);
  assert.match(replay.stdout, /"alreadyApplied": 1/);
  console.log('independent course migration: preview, conflicts, idempotency, source guard and rollback passed');
} finally {
  openDbs.forEach(db => { if (db.open) db.close(); });
  fs.rmSync(dir, { recursive: true, force: true });
}
