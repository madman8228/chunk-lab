'use strict';

const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createAssessmentContent } = require('./assessment-content');
const { ensureCourseLibrarySchema } = require('./course-library-schema');
const { createCourseLibrary } = require('./course-library');

const db = new Database(':memory:');
db.exec('CREATE TABLE user_decks(user_id INTEGER,id TEXT,items_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,id))');
ensureCourseLibrarySchema(db);
const courseLibrary = createCourseLibrary({ db });
const content = createAssessmentContent({ db, courseLibrary });

const builtin = content.resolve(1, 'oral-1-1-1#575b1d3a');
assert.equal(builtin.sentence, 'Good morning.');
assert.deepEqual(builtin.chunks, ['Good', 'morning.']);
assert.equal(content.resolve(1, 'oral-1-1-1#not-a-real-item'), null);

db.prepare('INSERT INTO user_decks(user_id,id,items_json,deleted_at) VALUES(?,?,?,NULL)')
  .run(1, 'my-deck', JSON.stringify([{ cid: 'my-sentence', sentence: 'Server-owned.', translation: '服务器题目', chunks: ['Server-owned.'] }]));
assert.equal(content.resolve(1, 'my-deck#my-sentence').sentence, 'Server-owned.');
assert.equal(content.resolve(2, 'my-deck#my-sentence'), null, 'user content is account-isolated');
assert.equal(content.resolve(1, 'my-deck#missing'), null);

const imported = courseLibrary.importContent(1, { requestId: 'assessment-import-0001', kind: 'deck', content: {
  id: 'new-course-id', name: 'Independent', items: [{ cid: 'independent-item', sentence: 'Independent content.', chunks: ['Independent content.'] }]
} });
assert.equal(content.resolve(1, imported.courseId + '#independent-item').sentence, 'Independent content.');
assert.equal(content.resolve(2, imported.courseId + '#independent-item'), null, 'independent private content still enforces its access grant');

const migrated = courseLibrary.importContent(1, { requestId: 'assessment-import-0002', kind: 'deck', content: {
  id: 'migrated-source', name: 'Migrated', items: [{ cid: 'legacy-item', sentence: 'Independent migrated content.', chunks: ['Independent migrated content.'] }]
} });
db.prepare(`INSERT INTO course_content_legacy_mappings(source_user_id,source_kind,source_id,course_id,source_hash)
  VALUES(1,'deck','migrated-source',?,'${'a'.repeat(64)}')`).run(migrated.courseId);
db.prepare('INSERT INTO user_decks(user_id,id,items_json,deleted_at) VALUES(1,?,?,NULL)')
  .run('migrated-source', JSON.stringify([{ cid: 'legacy-item', sentence: 'Stale account-bound duplicate.' }]));
assert.equal(content.resolve(1, 'migrated-source#legacy-item').sentence, 'Independent migrated content.',
  'a migrated alias resolves from independent authoritative content, not the retained old duplicate');
assert.equal(content.resolve(2, 'migrated-source#legacy-item'), null, 'legacy mappings do not leak across accounts');

db.close();
console.log('assessment content resolver tests passed');
