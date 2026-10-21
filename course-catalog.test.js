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

const convertedLegacy = Catalog.buildCatalog({
  manifest: { decks: [] },
  userDecks: [{ id: 'story-1', name: '故事课', items: [{ cid: 'line-a' }], authoring: { catalogCourseId: 'package:story-1', legacySource: { courseId: 'story-1', version: '1.0.0' } } }],
  storyPackages: [{ courseId: 'story-1', metadata: { title: { 'zh-CN': '故事课' } } }]
});
assert.equal(convertedLegacy.courses.length, 1);
assert.equal(convertedLegacy.courses[0].id, 'package:story-1');
assert.equal(convertedLegacy.courses[0].contentType, 'sentence');
assert.equal(Catalog.resolveLesson(convertedLegacy.courses[0], 'lesson:story-package:story-1').contentRef.type, 'sentence-deck');
assert.equal(Catalog.getCourseForContent(convertedLegacy, 'sentence-deck', 'story-1').id, 'package:story-1');
assert.equal(Catalog.getCourseForContent(convertedLegacy, 'story-package', 'story-1'), null);
assert.equal(Catalog.getEnrollmentAliases(convertedLegacy)['user-deck:story-1'], 'package:story-1');

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
assert.equal(Catalog.getEnrollmentAliases(nceWithLesson)['package:lesson_1_excuse_me'], logicalDefinition.id,
  '导入包从独立课程归入逻辑课程后，旧登记应按稳定包 ID 指向新课程');

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

const protectedCatalog = Catalog.buildCatalog({ manifest: { decks: [] }, protectedCourses: [{
  courseId: 'protected-fixture', title: '私有正文平台课', contentType: 'image-text', accessLevel: 'member',
  units: [{ unitId: 'unit-1', itemCount: 3 }]
}] });
assert.equal(protectedCatalog.courses[0].isProtected, true);
assert.equal(protectedCatalog.courses[0].accessLevel, 'member');
assert.equal(Catalog.resolveLesson(protectedCatalog.courses[0], 'unit-1').contentRef.type, 'protected-course');
assert.doesNotMatch(JSON.stringify(protectedCatalog), /sentence|translation|assetId/);
const collisionCatalog = Catalog.buildCatalog({ manifest, protectedCourses: [{ courseId: 'builtin:oral', title: '不可替换原课程', units: [] }] });
assert.notEqual(collisionCatalog.byCourseId['builtin:oral'].title, '不可替换原课程');
const platformBinding = { courseId: 'builtin:oral', title: '服务端展示名', contentType: 'sentence', accessLevel: 'member', units: [
  { unitId: 'lesson:oral-1', itemCount: 2, contentVersion: 'v1', recordIdentity: { deckId: 'oral-1', generationScope: 'course:oral-1', resumeIdentity: 'oral-1' } },
  { unitId: 'lesson:oral-2', itemCount: 3, contentVersion: 'v1', recordIdentity: { deckId: 'oral-2', generationScope: 'course:oral-2', resumeIdentity: 'oral-2' } }
] };
const boundCatalog = Catalog.buildCatalog({ manifest, protectedCourses: [platformBinding] });
assert.equal(boundCatalog.courses.filter(c => c.id === 'builtin:oral').length, 1);
assert.equal(boundCatalog.byCourseId['builtin:oral'].isProtected, true);
assert.equal(boundCatalog.byCourseId['builtin:oral'].title, catalog.byCourseId['builtin:oral'].title);
assert.equal(Catalog.resolveLesson(boundCatalog.byCourseId['builtin:oral'], 'lesson:oral-1').platformContent.recordIdentity.deckId, 'oral-1');
assert.equal(Catalog.resolveLesson(boundCatalog.byCourseId['builtin:oral'], 'lesson:oral-1').contentRef.type, 'protected-course');
assert.equal(Catalog.getCourseForContent(boundCatalog, 'sentence-deck', 'oral-1').id, 'builtin:oral');
const ownerCollision = Catalog.buildCatalog({ manifest: { decks: [] }, userDecks: [{ id: 'mine', name: '我的原件', items: [{ cid: 'a' }] }],
  protectedCourses: [{ ...platformBinding, courseId: 'user-deck:mine' }] });
assert.equal(ownerCollision.byCourseId['user-deck:mine'].origin, 'user');
assert.equal(ownerCollision.byCourseId['user-deck:mine'].isProtected, undefined);
console.log('course-catalog: legacy identities and protected metadata passed');
