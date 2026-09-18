'use strict';
const assert = require('node:assert/strict');
const Progress = require('./js/course-progress.js');

const course = {
  id: 'builtin:oral',
  lessons: [
    { id: 'lesson:a', contentRef: { type: 'sentence-deck', id: 'a' }, itemCount: 2 },
    { id: 'lesson:b', contentRef: { type: 'sentence-deck', id: 'b' }, itemCount: 2 }
  ]
};
const mem = {
  stats: { bySentence: { 'a#1': { times: 2 }, 'a#2': { times: 1 }, 'b#1': { times: 1 } } },
  deletedItems: { 'a#2': true }
};
const prepared = Progress.prepareProgressInputs(course, {
  indexesByRef: {
    a: [{ cid: '1' }, { cid: '2' }],
    b: [{ cid: '1' }, { cid: '2' }]
  }
});
const summary = Progress.summarizeCourse(course, {
  mem,
  prepared,
  isMarked: function (deckId, item, stat) { return !!(stat && stat.times > 1); },
  isDue: function (stat) { return stat.times === 1; }
});
assert.equal(summary.status, 'ready');
assert.equal(summary.publishedCount, 4);
assert.equal(summary.effectiveCount, 3);
assert.equal(summary.practicedCount, 2);
assert.equal(summary.masteredCount, 1);
assert.equal(summary.dueCount, 1);
assert.equal(summary.coverage, 2 / 3);

const loading = Progress.summarizeCourse(course, { mem, indexesByRef: { a: [] } });
assert.equal(loading.status, 'loading');
assert.equal(loading.effectiveCount, null);
assert.equal(loading.coverage, null);

console.log('course-progress.test: 10 passed / 0 failed');
