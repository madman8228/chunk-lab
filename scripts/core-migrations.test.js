'use strict';

const assert = require('node:assert/strict');

(async function () {
  const { CoreMigrations } = await import('../src/core/migrations.mjs');
  const mem = {
    mastered: { 'daily-home#hello': 1 },
    deletedItems: {},
    stats: { bySentence: { 'daily-home#hello': { times: 2 } }, events: [{ key: 'daily-home#hello' }] },
    reinforceBook: [{ deckId: 'daily-home', sentence: 'hello', _key: 'daily-home::hello' }],
  };
  assert.equal(CoreMigrations.migrateCidKeys(mem), true);
  assert.equal(mem.mastered['daily-home#4f9f2cab'], 1);
  assert.equal(mem.stats.events[0].key, 'daily-home#4f9f2cab');
  const map = { 'oral-1-1-1': ['4f9f2cab'] };
  assert.equal(CoreMigrations.migrateToBookDecks(mem, map), true);
  assert.equal(mem.mastered['oral-1-1-1#4f9f2cab'], 1);
  assert.equal(mem.reinforceBook[0]._key, 'oral-1-1-1::hello');
  assert.equal(CoreMigrations.migrateToBookDecks(mem, null), false);

  const aliasMem = {
    mastered: { 'daily-home#deadbeef': { at: 1 } },
    deletedItems: { 'daily-home#deadbeef': true },
    stats: {
      bySentence: {
        'daily-home#deadbeef': { times: 2 },
        'oral-1-1-1#4f9f2cab': { times: 1 },
      },
      events: [{ id: 'legacy-alias', key: 'daily-home#deadbeef' }],
    },
    reinforceBook: [],
  };
  const aliasMap = { deadbeef: { deckId: 'oral-1-1-1', cid: '4f9f2cab' } };
  assert.equal(CoreMigrations.migrateToBookDecks(aliasMem, map, aliasMap), true);
  assert.deepEqual(aliasMem.mastered['oral-1-1-1#4f9f2cab'], { at: 1 });
  assert.equal(aliasMem.deletedItems['oral-1-1-1#4f9f2cab'], true);
  assert.equal(aliasMem.stats.events[0].key, 'oral-1-1-1#4f9f2cab');
  assert.deepEqual(aliasMem.stats.bySentence['daily-home#deadbeef'], { times: 2 },
    'an alias collision is retained under its old key, never silently discarded');
  assert.deepEqual(aliasMem.stats.bySentence['oral-1-1-1#4f9f2cab'], { times: 1 });
  console.log('core-migrations.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
