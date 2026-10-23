'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Database = require('./node_modules/better-sqlite3');
const draftModel = require('../js/wordbook-draft');
const { ensureCourseLibrarySchema } = require('./services/course-library-schema');
const { createCourseLibrary } = require('./services/course-library');
const { createPersonalWordbooks } = require('./services/personal-wordbooks');

function setup(appRoot = process.cwd()) {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE personal_wordbook_versions(user_id INTEGER,book_id TEXT,version INTEGER,revision TEXT,package_json TEXT,created_at TEXT DEFAULT (datetime('now')),PRIMARY KEY(user_id,book_id,version))");
  ensureCourseLibrarySchema(db);
  const library = createCourseLibrary({ db });
  const personal = createPersonalWordbooks({ db, appRoot, library });
  return { db, library, personal };
}

function draft(units = 1) {
  const first = { itemId: 'draft:first', unitId: 'unit:one', word: 'sincere', meaning: '真诚的', scene: '朋友认真倾听',
    translation: '朋友认真倾听。', exercise: draftModel.exercise('A [sincere] friend listens.'), images: { wide: [], mobile: [] } };
  const bookUnits = [{ unitId: 'unit:one', title: 'Unit 1' }];
  const items = [first];
  if (units > 1) {
    bookUnits.push({ unitId: 'unit:two', title: 'Unit 2' });
    items.push({ ...first, itemId: 'draft:second', unitId: 'unit:two', word: 'honest', meaning: '诚实的',
      exercise: draftModel.exercise('An [honest] student answers.'), translation: '诚实的学生回答。' });
  }
  return { schemaVersion: 1, book: { bookId: 'source-book', title: '私有词书', units: bookUnits }, items };
}

(async () => {
  const source = setup(), recovery = setup();
  try {
    const deliveryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-webp-restore-'));
    const deliveryRecovery = setup(deliveryRoot), secondRecovery = setup(deliveryRoot);
    try {
      fs.mkdirSync(path.join(deliveryRoot, 'assets'));
      fs.copyFileSync(path.join(__dirname, '../assets/vocab-g7-lower-u1-blind-wide-v1.webp'), path.join(deliveryRoot, 'assets/restore.webp'));
      const legacyDraft = draft();
      legacyDraft.book.bookId = 'personal-book:' + 'a'.repeat(32);
      legacyDraft.items[0].itemId = 'personal-item:' + 'a'.repeat(32) + ':' + 'b'.repeat(32);
      legacyDraft.items[0].images = { wide: ['assets/restore.avif', 'assets/restore.webp'], mobile: ['assets/restore.avif', 'assets/restore.webp'] };
      const pkg = await draftModel.compile(legacyDraft);
      const originalArchive = { format: 'personal-wordbooks-archive', version: 1, owner: 7, rows: [{
        book_id: legacyDraft.book.bookId, version: 1, revision: pkg.index.books[0].revision,
        package_json: JSON.stringify(pkg), created_at: '2026-10-21T00:00:00.000Z' }] };
      for (const target of [deliveryRecovery, secondRecovery]) {
        const preview = await target.personal.previewRestore(7, originalArchive);
        await target.personal.restore(7, originalArchive, preview.fingerprint, true);
        const item = target.personal.item(pkg.items[0].itemId, pkg.items[0].contentRevision, 7);
        assert.deepEqual(item, { ...pkg.items[0], images: { wide: ['assets/restore.webp'], mobile: ['assets/restore.webp'] } });
        assert.deepEqual(target.personal.archive(7), originalArchive, 'portable recovery preserves original canonical AVIF references while rebuilding verified WebP delivery');
        await assert.rejects(target.personal.restore(7, originalArchive, preview.fingerprint, true), /已有内容/);
      }
    } finally {
      deliveryRecovery.db.close(); secondRecovery.db.close();
      fs.rmSync(deliveryRoot, { recursive: true, force: true });
    }
    const saved = await source.personal.save(7, draft());
    assert.equal(source.db.prepare('SELECT COUNT(*) AS n FROM personal_wordbook_versions').get().n, 0,
      'new wordbook content is not written into account-owned content rows');
    assert.equal(source.db.prepare('SELECT COUNT(*) AS n FROM course_contents').get().n, 1);
    const independent = source.library.resolveLegacy(7, 'course', 'wordbook:' + saved.bookId);
    assert.ok(independent);
    assert.equal(source.library.read(7, independent).content.contentFamily, 'vocabulary-book');
    assert.equal(source.library.catalog(7).length, 0, 'the generic course catalog does not duplicate vocabulary resources');
    assert.throws(() => source.personal.book(saved.bookId, 8), { status: 404 }, 'private content is not readable by another account');
    assert.equal(source.personal.resources(7)[0].resourceId, 'wordbook:' + saved.bookId);

    const added = await source.personal.save(7, draft(2), saved.revision);
    assert.equal(source.personal.versions(saved.bookId, 7).length, 2, 'independent releases retain wordbook history');
    assert.equal(source.personal.historicalBook(saved.bookId, 7, saved.revision).itemCount, 1);
    const archive = source.personal.archive(7);
    assert.equal(archive.rows.length, 2, 'account export includes independent wordbook revisions');
    const preview = await recovery.personal.previewRestore(7, archive);
    assert.equal(preview.eligible, true);
    await recovery.personal.restore(7, archive, preview.fingerprint, true);
    assert.equal(recovery.db.prepare('SELECT COUNT(*) AS n FROM personal_wordbook_versions').get().n, 0,
      'restoring a current archive restores content to the independent library');
    assert.deepEqual(recovery.personal.archive(7), archive, 'archive export survives an independent-library round trip');
    assert.equal(recovery.personal.book(saved.bookId, 7).revision, added.revision);
    assert.throws(() => recovery.personal.book(saved.bookId, 8), { status: 404 });
    await assert.rejects(recovery.personal.restore(7, archive, preview.fingerprint, true), /已有内容/,
      'restore refuses to overwrite a nonempty account or content library');

    const legacy = setup();
    try {
      const legacyBook = { bookId: 'personal-book:' + 'f'.repeat(32), title: '旧词书', revision: '1'.repeat(64), itemCount: 0, items: [], units: [] };
      const legacyPackage = { index: { books: [legacyBook] }, items: [] };
      legacy.library.importContent(9, { requestId: 'legacy-wordbook-fixture-001', kind: 'course',
        sourceMapping: { kind: 'course', sourceId: 'wordbook:' + legacyBook.bookId },
        content: { contentFamily: 'vocabulary-book', contentFamilyVersion: 1, package: legacyPackage } });
      legacy.personal.setLibrary(legacy.library);
      assert.deepEqual(legacy.personal.book(legacyBook.bookId, 9), legacyBook);
      assert.equal(legacy.personal.resources(9)[0].resourceId, 'wordbook:' + legacyBook.bookId);
    } finally { legacy.db.close(); }

    console.log('Independent personal wordbooks: new saves/releases bypass account content rows; private reads, historical revisions, account export/restore and legacy alias reads passed.');
  } finally { source.db.close(); recovery.db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
