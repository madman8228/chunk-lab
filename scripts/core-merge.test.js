'use strict';

const assert = require('node:assert/strict');

(async function () {
  const merge = (await import('../src/core/merge.mjs')).CoreMerge;
  assert.deepEqual(merge.keyedMap({ a: 1 }, { a: 2 }, { a: 3, b: 4 }), { a: 2, b: 4 });
  assert.deepEqual(merge.daysLog({}, { today: { rounds: 1 } }, { today: { rounds: 3 }, old: { rounds: 2 } }), { today: { rounds: 3 }, old: { rounds: 2 } });
  assert.deepEqual(merge.events([], [{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }]);
  const target = { decks: [{ id: 'd', name: 'ours' }], mastered: { 'd#1': 1 }, stats: { totalAnswered: 1, bySentence: {}, events: [] } };
  merge.memInto(target, { decks: [{ id: 'd2' }], mastered: { 'd2#1': 1 }, stats: { totalAnswered: 3, bySentence: {}, events: [] } }, {});
  assert.equal(target.decks.length, 2);
  assert.equal(target.stats.totalAnswered, 3);
  console.log('core-merge.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
