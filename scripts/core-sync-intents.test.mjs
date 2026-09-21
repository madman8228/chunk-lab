import assert from 'node:assert/strict';
import { CoreSyncIntents } from '../src/core/sync-intents.mjs';

const receipts = CoreSyncIntents.buildReceipts({
  intents: [
    { key: 'course-1', operationId: 'op-course', entity: 'courses', id: 'c1', value: { courseId: 'c1', name: 'A' } },
    { key: 'progress-1', operationId: 'op-progress', entity: 'courseProgress', id: 'c1', value: { done: 2 } },
    { key: 'gone-1', operationId: 'op-gone', entity: 'courses', id: 'c2', deleted: true },
  ],
  deleted: { courses: [{ id: 'c2' }] },
  coursePayload: [{ courseId: 'c1', name: 'A' }],
  progressPayload: { c1: { done: 2 } },
  equalJson: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  learningIntents: [
    { key: 'event-1', operationId: 'op-event', entity: 'events', id: 'e1' },
    { key: 'stat-1', operationId: 'op-stat', entity: 'sentenceStats', id: 's1', value: { ok: 1 } },
    { key: 'stat-gone', operationId: 'op-stat-gone', entity: 'sentenceStats', id: 's2', deleted: true },
  ],
  sentEvents: { e1: { id: 'e1' } },
  statsDelta: { sbs: { s1: { ok: 1 } }, sbsGone: ['s2'] },
  sentGone: new Set(['s2']),
  sameValue: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

assert.deepEqual(receipts, [
  { key: 'course-1', operationId: 'op-course' },
  { key: 'progress-1', operationId: 'op-progress' },
  { key: 'gone-1', operationId: 'op-gone' },
  { key: 'event-1', operationId: 'op-event' },
  { key: 'stat-1', operationId: 'op-stat' },
  { key: 'stat-gone', operationId: 'op-stat-gone' },
]);

assert.deepEqual(CoreSyncIntents.buildReceipts({
  intents: [{ key: 'ambiguous', operationId: 'op', entity: 'courses', id: 'missing', value: { ok: true } }],
  coursePayload: [],
}), []);

console.log('core-sync-intents.test.mjs passed');
