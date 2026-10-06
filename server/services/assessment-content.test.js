'use strict';

const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createAssessmentContent } = require('./assessment-content');

const db = new Database(':memory:');
db.exec('CREATE TABLE user_decks(user_id INTEGER,id TEXT,items_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,id))');
const content = createAssessmentContent({ db });

const builtin = content.resolve(1, 'oral-1-1-1#575b1d3a');
assert.equal(builtin.sentence, 'Good morning.');
assert.deepEqual(builtin.chunks, ['Good', 'morning.']);
assert.equal(content.resolve(1, 'oral-1-1-1#not-a-real-item'), null);

db.prepare('INSERT INTO user_decks(user_id,id,items_json,deleted_at) VALUES(?,?,?,NULL)')
  .run(1, 'my-deck', JSON.stringify([{ cid: 'my-sentence', sentence: 'Server-owned.', translation: '服务器题目', chunks: ['Server-owned.'] }]));
assert.equal(content.resolve(1, 'my-deck#my-sentence').sentence, 'Server-owned.');
assert.equal(content.resolve(2, 'my-deck#my-sentence'), null, 'user content is account-isolated');
assert.equal(content.resolve(1, 'my-deck#missing'), null);

db.close();
console.log('assessment content resolver tests passed');
