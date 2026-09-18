'use strict';
const assert = require('node:assert/strict');
const Catalog = require('./js/course-catalog.js');

const manifest = {
  series: '口语3000句',
  decks: [
    { id: 'oral-1', name: '口语3000句 · 在家中', short: '在家中', section: '1.1', sectionTitle: '在家中', chapter: 1, totalCount: 2 },
    { id: 'oral-2', name: '口语3000句 · 电话', short: '电话', section: '1.6', sectionTitle: '电话', chapter: 1, totalCount: 3 },
    { id: 'builtin-freq-idioms', name: '高频短语', totalCount: 4 }
  ]
};

const catalog = Catalog.buildCatalog({ manifest, userDecks: [{ id: 'mine', name: '我的句子', items: [{ sentence: 'a' }] }] });
assert.deepEqual(catalog.courses.map(c => c.id), ['builtin:oral', 'builtin:idioms', 'user-deck:mine']);
assert.equal(catalog.courses[0].lessonCount, 2);
assert.equal(catalog.courses[0].itemCount, 5);
assert.equal(catalog.courses[2].outline[0].contentRef.id, 'mine');
assert.equal(Catalog.resolveLesson(catalog.courses[0], 'lesson:oral-1').contentRef.id, 'oral-1');
assert.equal(catalog.diagnostics.length, 0);

const old = Catalog.buildCatalog({ manifest: { decks: manifest.decks } });
assert.equal(old.courses[0].id, 'builtin:oral');
assert.equal(old.courses[0].lessonCount, 2);

const broken = Catalog.buildCatalog({
  manifest: {
    decks: [{ id: 'oral-1', totalCount: 1 }],
    catalog: { schemaVersion: 1, courses: [{ id: 'x', title: '坏课程', outline: [{ id: 'l', kind: 'lesson', contentRef: { type: 'sentence-deck', id: 'missing' } }] }] }
  }
});
assert.equal(broken.courses[0].lessonCount, 1);
assert.equal(broken.diagnostics.length, 1);
assert.equal(broken.courses[0].available, false);

const unknownVersion = Catalog.buildCatalog({
  manifest: { decks: manifest.decks, catalog: { schemaVersion: 99, courses: [] } }
});
assert.equal(unknownVersion.courses[0].id, 'builtin:oral');
assert.equal(unknownVersion.diagnostics[0].level, 'error');

const story = Catalog.buildCatalog({
  manifest: { decks: [] },
  storyPackages: [{ courseId: 'story-1', metadata: { title: { 'zh-CN': '故事课' } }, story: { nodes: [{ id: 'n1' }] } }]
});
assert.equal(story.courses[0].id, 'package:story-1');
assert.equal(story.courses[0].contentType, 'story');
assert.equal(story.courses[0].lessons[0].contentRef.type, 'story-package');

const logicalDefinition = {
  id: 'logical-course:nce-book-1',
  title: '新概念英语第一册',
  coverImage: 'data:image/png;base64,cover',
  catalogKey: 'logical:logical-course:nce-book-1'
};
const noPresetNce = Catalog.buildCatalog({ manifest: { decks: [] } });
assert.equal(noPresetNce.courses.length, 0);
const nce = Catalog.buildCatalog({ manifest: { decks: [] }, logicalCourses: [logicalDefinition] });
assert.equal(nce.courses[0].id, logicalDefinition.id);
assert.equal(nce.courses[0].title, '新概念英语第一册');
assert.equal(nce.courses[0].coverImage, logicalDefinition.coverImage);
assert.equal(nce.courses[0].lessonCount, 0);
assert.equal(nce.courses[0].available, true);
assert.equal(nce.courses[0].lessons.length, 0);

const nceWithLesson = Catalog.buildCatalog({
  manifest: { decks: [] },
  logicalCourses: [logicalDefinition],
  storyPackages: [{
    courseId: 'lesson_1_excuse_me',
    logicalCourseId: logicalDefinition.id,
    metadata: {
      title: { 'zh-CN': '对不起！' },
      catalog: { primaryId: 'textbooks', secondaryId: 'nce_book_1', sequence: 1 }
    }
  }]
});
assert.equal(nceWithLesson.courses.length, 1);
assert.equal(nceWithLesson.courses[0].id, logicalDefinition.id);
assert.equal(nceWithLesson.courses[0].lessonCount, 1);
assert.equal(nceWithLesson.courses[0].lessons[0].contentRef.id, 'lesson_1_excuse_me');
assert.equal(nceWithLesson.courses[0].lessons[0].title, '对不起！');
assert.equal(nceWithLesson.courses[0].lessons[0].available, true);
assert.equal(nceWithLesson.courses[0].outline[0].kind, 'lesson');

const groupedPackages = Catalog.buildCatalog({
  manifest: { decks: [] },
  storyPackages: [
    { courseId: 'nce-1', metadata: { title: { 'zh-CN': '第一课' }, catalog: { primaryId: 'textbooks', secondaryId: 'nce_book_1', sequence: 1 } } },
    { courseId: 'nce-2', metadata: { title: { 'zh-CN': '第二课' }, catalog: { primaryId: 'textbooks', secondaryId: 'nce_book_1', sequence: 2 } } }
  ]
});
assert.equal(groupedPackages.courses.length, 2);
assert.deepEqual(groupedPackages.courses.map(c => c.id), ['package:nce-1', 'package:nce-2']);
assert.equal(groupedPackages.courses[0].lessonCount, 1);

console.log('course-catalog.test: 28 passed / 0 failed');
