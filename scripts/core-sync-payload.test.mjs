import assert from 'node:assert/strict';
import { CoreSyncPayload } from '../src/core/sync-payload.mjs';

function pending(all, dirty = {}, gone = {}) {
  return { all, dirty, gone };
}

function pendingList(state, list, keyOf) {
  return state.all ? list : list.filter((item) => state.dirty[keyOf(item)]);
}

function pendingMap(state, map) {
  if (state.all) return map;
  return Object.fromEntries(Object.entries(map).filter(([id]) => state.dirty[id]));
}

function pendingGone(state, diff) {
  const sent = {};
  const list = [];
  Object.entries(state.gone).forEach(([id, rev]) => {
    sent[id] = 1;
    list.push({ id, rev });
  });
  (diff || []).forEach((item) => {
    if (!sent[item.id]) {
      sent[item.id] = 1;
      list.push(item);
    }
  });
  return { list, sent };
}

function discardSupersededDeletes(state, batch, sentUp, revs) {
  batch.list = batch.list.filter((item) => {
    if (sentUp[item.id] && (revs[item.id] || 0) > item.rev) {
      delete state.gone[item.id];
      delete batch.sent[item.id];
      return false;
    }
    return true;
  });
}

const decks = pending(false, { d1: 1 }, { d2: 2 });
const courses = pending(false, { c1: 1 });
const progress = pending(false, { c1: 1 });
const result = CoreSyncPayload.buildSyncPayload({
  memObj: {
    decks: [{ id: 'd1' }, { id: 'd3' }],
    stats: { bySentence: { s1: { ok: 1 } }, events: [{ id: 'e1' }] },
  },
  courses: [{ courseId: 'c1', name: 'A' }, { courseId: 'c2', name: 'B' }],
  progress: { c1: { done: 1 }, c2: { done: 2 } },
  pendingDecks: decks,
  pendingCourses: courses,
  pendingProgress: progress,
  meta: { revs: { decks: { d2: 1 }, kv: {} }, deleted: { decks: [], kv: [] } },
  cmeta: {
    revs: { courses: {}, courseProgress: {} },
    deleted: { courses: [], courseProgress: [] },
  },
  rejectedDeletesKv: [{ k: 'old', rev: 1 }],
  delta: { sbs: { s1: { ok: 1 } }, sbsGone: ['gone'], evs: [{ id: 'e1' }] },
  entityDelta: {
    mastered: { up: { m1: { markedAt: 1 } }, gone: [] },
    reinforceBook: { up: {}, gone: ['r1'] },
    deletedItems: { up: {}, gone: [] },
  },
  memForCloud: (mem) => ({ stats: { events: [] }, decks: mem.decks }),
  pendingList,
  pendingMap,
  pendingGone,
  discardSupersededDeletes,
});

assert.deepEqual(result.deckPayload, [{ id: 'd1' }]);
assert.deepEqual(result.coursePayload, [{ courseId: 'c1', name: 'A' }]);
assert.deepEqual(result.progPayload, { c1: { done: 1 } });
assert.deepEqual(result.payload.deleted.decks, [{ id: 'd2', rev: 2 }]);
assert.deepEqual(result.payload.deleted.kv, [{ k: 'old', rev: 1 }]);
assert.deepEqual(result.payload.statsDelta, {
  sbs: { s1: { ok: 1 } },
  sbsGone: ['gone'],
  evs: [{ id: 'e1' }],
});
assert.deepEqual(result.payload.entityDelta, {
  mastered: { up: { m1: { markedAt: 1 } }, gone: [] },
  reinforceBook: { up: {}, gone: ['r1'] },
});
assert.deepEqual({ ...result.sentEvents }, { e1: { id: 'e1' } });
assert.deepEqual([...result.sentGone], ['gone']);

const protectedCourses = Object.create(null);
const protectedProgress = Object.create(null);
const replay = CoreSyncPayload.buildSyncPayload({
  memObj: { decks: [] },
  courses: [{ courseId: 'c1' }],
  progress: { c1: { done: 1 } },
  pendingDecks: pending(true),
  pendingCourses: pending(true),
  pendingProgress: pending(true),
  meta: { revs: { decks: {}, kv: {} }, deleted: { decks: [], kv: [] } },
  cmeta: {
    revs: { courses: {}, courseProgress: {} },
    deleted: { courses: [{ id: 'c1', rev: 3 }], courseProgress: [{ id: 'c1', rev: 2 }] },
  },
  intents: [{ entity: 'courses', id: 'c1' }, { entity: 'courseProgress', id: 'c1' }],
  canReplayCourses: true,
  protectedCourses,
  protectedProgress,
  memForCloud: (mem) => ({ decks: mem.decks }),
  pendingList,
  pendingMap,
  pendingGone,
  discardSupersededDeletes,
});
assert.deepEqual(replay.coursePayload, []);
assert.deepEqual(replay.progPayload, {});
assert.deepEqual(replay.courseGone.list, []);
assert.deepEqual(replay.progGone.list, []);
assert.equal(protectedCourses.c1, true);
assert.equal(protectedProgress.c1, true);

console.log('core-sync-payload.test.mjs passed');
