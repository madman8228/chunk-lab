'use strict';

const assert = require('node:assert/strict');
const { createDataMigrations } = require('./data-migrations');

/* Sentence text belongs to the user's learning record. Startup migrations must
 * not silently erase it as a payload optimization. */
const originalRows = [{ user_id: 7, sentence_key: 'deck#cid-old',
  data_json: JSON.stringify({ deckId: 'deck', sentence: 'Original sentence', times: 4, dueAt: 1234 }) }];
const migration = createDataMigrations({ db: {}, allocSeq() { throw new Error('unexpected persistent write'); } });
assert.equal(migration.migrateSentenceText, undefined);
assert.deepEqual(JSON.parse(originalRows[0].data_json), {
  deckId: 'deck', sentence: 'Original sentence', times: 4, dueAt: 1234
});
console.log('data-migrations.test.js passed');
