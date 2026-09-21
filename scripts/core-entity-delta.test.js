'use strict';

const assert = require('node:assert/strict');

(async function () {
  const { CoreEntityDelta } = await import('../src/core/entity-delta.mjs');
  const initial = { mastered: { a: { markedAt: 1, deckId: 'd' } }, reinforceBook: [{ _key: 'r', addedAt: 2, sentence: 'hello' }], deletedItems: {} };
  const marks = CoreEntityDelta.alignEntityMarks(initial);
  const unchanged = CoreEntityDelta.buildEntityDelta(initial, marks);
  assert.deepEqual(unchanged.mastered.up, {});
  assert.deepEqual(unchanged.reinforceBook.gone, []);
  const changed = { mastered: { a: { markedAt: 2, deckId: 'd' }, b: { markedAt: 1, deckId: 'd2' } }, reinforceBook: [], deletedItems: {} };
  const delta = CoreEntityDelta.buildEntityDelta(changed, marks);
  assert.deepEqual(Object.keys(delta.mastered.up).sort(), ['a', 'b']);
  assert.deepEqual(delta.reinforceBook.gone, ['r']);
  assert.equal(CoreEntityDelta.strHash('hello'), CoreEntityDelta.strHash('hello'));
  console.log('core-entity-delta.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
