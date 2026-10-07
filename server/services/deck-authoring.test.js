'use strict';
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createDataWriters } = require('./data-writers');
const db = new Database(':memory:');
db.exec(`CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,items_json TEXT,builtin INTEGER,
  is_public INTEGER DEFAULT 0,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,
  authoring_json TEXT,PRIMARY KEY(user_id,id));`);
const writer = createDataWriters({ db, assertRevisionAccepted() {} });
const items = [{ cid: 'original-id', sentence: 'Keep this course.' }];
const authoring = { template: 'sentence-practice', learning: { defaultMode: 'chunkSelection' } };
writer.upsertDeck(1, { id: 'course', name: 'Course', items, authoring }, 1, false, 1);
writer.upsertDeck(1, { id: 'course', name: 'Course', items }, 2, false, 2);
let row = db.prepare('SELECT * FROM user_decks WHERE user_id=1 AND id=?').get('course');
assert.deepEqual(JSON.parse(row.items_json), items);
assert.deepEqual(JSON.parse(row.authoring_json), authoring, 'omission retains the learning contract');
writer.upsertDeck(1, { id: 'course', name: 'stale', items: [], authoring: null }, 1, false, 1);
row = db.prepare('SELECT * FROM user_decks WHERE user_id=1 AND id=?').get('course');
assert.deepEqual(JSON.parse(row.items_json), items, 'stale content cannot overwrite current items');
assert.deepEqual(JSON.parse(row.authoring_json), authoring, 'stale metadata cannot overwrite current contract');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_decks WHERE user_id=2').get().n, 0);
db.close();
console.log('deck authoring: metadata persists, omitted fields retain it, stale revisions cannot overwrite content');
