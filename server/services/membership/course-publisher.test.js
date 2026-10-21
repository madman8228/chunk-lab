'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { initializeMembershipSchema } = require('./schema');
const { ContentRegistry } = require('./content-registry');
const { createCourseAccessService } = require('./course-access-service');
const { createCoursePublisher } = require('./course-publisher');
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-publisher-'));
  const appRoot = path.join(temp, 'app'), protectedRoot = path.join(temp, 'private');
  fs.mkdirSync(appRoot);
  const db = new Database(path.join(temp, 'test.db'));
  try {
    initializeMembershipSchema(db);
    const registry = new ContentRegistry({ appRoot, protectedRoot,
      publishedCourses: () => db.prepare("SELECT registry_entry_json FROM membership_course_publications WHERE status='published'").all().map(row => JSON.parse(row.registry_entry_json)),
      requireManifest: () => !!db.prepare("SELECT 1 FROM membership_course_publications WHERE status='published' LIMIT 1").get() });
    const courseAccess = createCourseAccessService({ db, registry, entitlements: {}, membership: {}, usageMeter: {} });
    const publisher = createCoursePublisher({ db, registry, courseAccess });
    const { DRAFT_SPEC } = await import('../../../src/course-authoring/draft-spec.mjs');
    const prepared = publisher.prepare({ draft: DRAFT_SPEC.examples.at(-1), images: [], requestId: crypto.randomUUID() }, 1);
    assert.equal(prepared.registryVersion, 'empty');
    db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON course_access_revisions BEGIN SELECT RAISE(FAIL,'synthetic failure'); END");
    const input = { publicationId: prepared.publicationId, contentHash: prepared.contentHash, registryVersion: prepared.registryVersion,
      accessLevel: 'member', acceptWarnings: true, requestId: crypto.randomUUID() };
    assert.throws(() => publisher.publish(input, 1));
    assert.equal(registry.publicCourses().length, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM membership_content_publication_revisions').get().count, 0, 'audit pointer also rolls back');
    const filesBefore = fs.readdirSync(path.join(protectedRoot, 'published-' + prepared.publicationId));
    assert.ok(filesBefore.includes('content.json'), 'unreferenced private files are preserved after failure');
    db.exec('DROP TRIGGER fixture_failure');
    const restored = publisher.inspect(prepared.publicationId);
    const retried = { ...input, registryVersion: restored.registryVersion };
    const published = publisher.publish(retried, 1);
    assert.equal(published.published, true);
    assert.equal(publisher.publish(retried, 1).replay, true);
    assert.equal(registry.publicCourses().length, 1);
    const unit = registry.snapshot().courses[0].units[0];
    assert.ok(unit.fragments.length > 0);
    assert.equal(unit.recordIdentity.generationScope, 'course:' + prepared.publicationId);
    const audit = db.prepare('SELECT * FROM membership_content_publication_revisions').get();
    assert.equal(audit.revision, 1);
    assert.ok(JSON.parse(audit.files_json).every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.deepEqual(registry.load(prepared.publicationId, 'lesson-1', 0).payload.recordIdentity, unit.recordIdentity);
    const readFile = fs.readFileSync;
    let wholeCourseReads = 0;
    try {
      fs.readFileSync = function(file, ...options) { if (String(file) === registry.file(unit.file)) wholeCourseReads++; return readFile.call(fs, file, ...options); };
      registry.load(prepared.publicationId, 'lesson-1', 0);
      registry.load(prepared.publicationId, 'lesson-1', 0);
      assert.equal(wholeCourseReads, 0, 'v2 learning reads never parse the archived full course');
      assert.ok(registry.staticStore.metrics.hits >= 2);
    } finally { fs.readFileSync = readFile; }
    assert.deepEqual(fs.readdirSync(path.join(protectedRoot, 'published-' + prepared.publicationId)), filesBefore);
    assert.equal(courseAccess.list().courses[0].accessLevel, 'member');
    assert.equal(fs.readdirSync(appRoot).length, 0, 'no private content is written beneath static application root');
    console.log('publisher: first publication, rollback, retained files, draft recovery, idempotent retry, private storage passed');
  } finally {
    db.close(); assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
