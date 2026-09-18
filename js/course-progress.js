/* course-progress.js · 课程级只读学习投影 */
(function (global) {
  'use strict';
  function refKey(ref) { return JSON.stringify([ref && ref.type || '', ref && ref.id || '']); }
  function lessonsOf(course) {
    if (course && Array.isArray(course.lessons)) return course.lessons;
    var out = [];
    function walk(nodes) {
      (nodes || []).forEach(function (node) {
        if (!node) return;
        if (node.kind === 'lesson') out.push(node);
        else walk(node.children);
      });
    }
    walk(course && course.outline);
    return out;
  }
  function statsFor(mem) {
    return mem && mem.stats && mem.stats.bySentence || {};
  }
  function deletedFor(mem) { return mem && mem.deletedItems || {}; }
  function prepareProgressInputs(course, options) {
    options = options || {};
    var lessons = lessonsOf(course), refs = {}, sentenceRefs = [];
    lessons.forEach(function (lesson) {
      var ref = lesson.contentRef;
      if (!ref || refs[refKey(ref)]) return;
      refs[refKey(ref)] = lesson;
      if (ref.type === 'sentence-deck') sentenceRefs.push(ref.id);
    });
    return { courseId: course && course.id || '', lessons: lessons, refs: refs,
      sentenceDeckIds: sentenceRefs, indexesByRef: options.indexesByRef || {} };
  }
  function summarizeCourse(course, options) {
    options = options || {};
    var prepared = options.prepared || prepareProgressInputs(course, options);
    var stats = statsFor(options.mem), deleted = deletedFor(options.mem);
    var indexReady = true, published = 0, effective = 0, practiced = 0, mastered = 0, due = 0;
    var isDue = options.isDue;
    var marked = options.isMarked;
    prepared.lessons.forEach(function (lesson) {
      var ref = lesson.contentRef || {};
      if (ref.type !== 'sentence-deck') return;
      var index = prepared.indexesByRef[ref.id];
      var items = Array.isArray(index) ? index : null;
      var count = Number(lesson.itemCount) || 0;
      published += count;
      if (!items) { indexReady = false; return; }
      items.forEach(function (item) {
        if (!item || !item.cid || deleted[ref.id + '#' + item.cid]) return;
        effective++;
        var key = ref.id + '#' + item.cid, stat = stats[key];
        if (stat && Number(stat.times) > 0) practiced++;
        if (marked ? marked(ref.id, item, stat) : false) mastered++;
        if (isDue && stat && isDue(stat, item, ref.id)) due++;
      });
    });
    var status = indexReady ? 'ready' : 'loading';
    var coverage = indexReady && effective ? practiced / effective : null;
    return {
      status: status, lessonCount: prepared.lessons.length, publishedCount: published,
      effectiveCount: indexReady ? effective : null, practicedCount: indexReady ? practiced : null,
      masteredCount: indexReady ? mastered : null, dueCount: indexReady ? due : null,
      coverage: coverage, courseRef: refKey({ type: 'course', id: course && course.id })
    };
  }
  var api = { prepareProgressInputs: prepareProgressInputs, summarizeCourse: summarizeCourse, refKey: refKey };
  global.CourseProgress = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
