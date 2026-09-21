import assert from 'node:assert/strict';
import { CoreSyncEntities } from '../src/core/sync-entity-merge.mjs';

const list = CoreSyncEntities.mergeEntityList(
  [{ courseId: 'c1', title: 'local' }, { courseId: 'gone', title: 'old' }],
  [{ courseId: 'c1', title: 'remote-old' }, { courseId: 'c2', title: 'remote' }],
  { courses: { c1: 3, gone: 1 } },
  { courses: { c1: 2, c2: 4, gone: 2 } },
  'courses',
  (course) => course.courseId,
);
assert.deepEqual(list.value, [
  { courseId: 'c1', title: 'local' },
  { courseId: 'c2', title: 'remote' },
]);
assert.equal(list.revisions.courses.c2, 4);
assert.equal(list.revisions.courses.gone, 2);

const map = CoreSyncEntities.mergeEntityMap(
  { c1: { done: 1 }, gone: { done: 1 } },
  { c1: { done: 2 }, c2: { done: 1 } },
  { courseProgress: { c1: 1, gone: 1 } },
  { courseProgress: { c1: 2, c2: 3, gone: 2 } },
  'courseProgress',
);
assert.deepEqual(map.value, { c1: { done: 2 }, c2: { done: 1 } });
assert.equal(map.revisions.courseProgress.gone, 2);

console.log('core-sync-entity-merge.test.mjs passed');
