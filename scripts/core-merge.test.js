'use strict';

const assert = require('node:assert/strict');

(async function () {
  const merge = (await import('../src/core/merge.mjs')).CoreMerge;
  assert.deepEqual(merge.keyedMap({ a: 1 }, { a: 2 }, { a: 3, b: 4 }), { a: 2, b: 4 });
  assert.deepEqual(merge.daysLog({}, { today: { rounds: 1 } }, { today: { rounds: 3 }, old: { rounds: 2 } }), { today: { rounds: 3 }, old: { rounds: 2 } });
  assert.deepEqual(merge.events([], [{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }]);
  const baseStat={times:1,learningV1:{version:1,lastExposureAt:10,dueAt:20,evidence:[{id:'same',at:5,ok:true},{id:'base',at:6,ok:true}]}};
  const oursStat={times:2,learningV1:{version:1,lastExposureAt:30,dueAt:40,evidence:[{id:'same',at:5,ok:true},{id:'ours',at:7,ok:true}]}};
  const theirsStat={times:3,learningV1:{version:1,lastExposureAt:25,dueAt:35,evidence:[{id:'same',at:5,ok:false},{id:'theirs',at:8,ok:false}]}};
  const mergedStats=merge.bySentence({ item:baseStat },{ item:oursStat },{ item:theirsStat });
  assert.deepEqual(mergedStats.item.learningV1.evidence.map(event=>event.id),['same','ours','theirs']);
  assert.equal(mergedStats.item.learningV1.evidence[0].ok,false,'same-id simultaneous failure wins');
  assert.equal(mergedStats.item.learningV1.dueAt,40,'most recent schedule wins');
  const target = { decks: [{ id: 'd', name: 'ours' }], mastered: { 'd#1': 1 }, stats: { totalAnswered: 1, bySentence: {}, events: [] } };
  merge.memInto(target, { decks: [{ id: 'd2' }], mastered: { 'd2#1': 1 }, stats: { totalAnswered: 3, bySentence: {}, events: [] } }, {});
  assert.equal(target.decks.length, 2);
  assert.equal(target.stats.totalAnswered, 3);
  console.log('core-merge.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
