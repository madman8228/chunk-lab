'use strict';
const assert = require('node:assert/strict');
const Progress = require('./js/course-progress.js');
assert.equal(Progress.isComplete({ready:true,done:199,total:200,pct:100}),false);
assert.equal(Progress.isComplete({ready:true,done:200,total:200}),true);
assert.equal(Progress.isComplete({ready:true,done:0,total:0}),false);
assert.equal(Progress.isComplete({ready:false,done:200,total:200}),false);
assert.equal(Progress.completionState([]),'unknown');
assert.equal(Progress.completionState([{ready:false}]),'unknown');
assert.equal(Progress.completionState([{ready:true,done:1,total:2}]),'in-progress');
assert.equal(Progress.completionState([{ready:true,done:2,total:2}]),'completed');
assert.equal(Progress.completionState([Progress.storyProgress({seen:['first']})]),'in-progress');
assert.equal(Progress.completionState([Progress.storyProgress({completed:true})]),'completed');
assert.equal(Progress.completionState([Progress.storyProgress({completed:true},false)]),'unknown');

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
/* 课节级：lesson a 全练完（a#1 练过、a#2 已删），lesson b 半练（b#1 练过） */
assert.equal(summary.lessonsTotal, 2);
assert.equal(summary.lessonsPracticed, 1);

const loading = Progress.summarizeCourse(course, { mem, indexesByRef: { a: [] } });
assert.equal(loading.status, 'loading');
assert.equal(loading.effectiveCount, null);
assert.equal(loading.coverage, null);

console.log('course-progress.test: 12 passed / 0 failed');
