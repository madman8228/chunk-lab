'use strict';

const assert = require('node:assert/strict');

(async function () {
  const { CoreStorageState } = await import('../src/core/storage-state.mjs');
  const migrated = CoreStorageState.migrate({ decks: [] });
  assert.equal(migrated.version, CoreStorageState.CURRENT_VERSION);
  assert.equal(CoreStorageState.migrate(migrated), migrated);
  assert.equal(CoreStorageState.migrate(null).version, CoreStorageState.CURRENT_VERSION);
  const defaults = CoreStorageState.defaultMem();
  assert.deepEqual(defaults.decks, []);
  assert.deepEqual(defaults.stats, { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] });
  assert.equal(defaults.settings.mode, 'choose');
  defaults.settings.mode = 'spell';
  assert.equal(CoreStorageState.defaultMem().settings.mode, 'choose');
  const merged = CoreStorageState.mergeCourseProgressSources(
    [{ courseId: 'local', name: 'local' }, { courseId: 'same', name: 'old' }],
    [{ courseId: 'same', name: 'idb' }, { courseId: 'idb', name: 'idb' }],
    { local: { done: 1 }, same: { done: 1 } },
    { same: { done: 2 }, idb: { done: 3 } },
  );
  assert.deepEqual(merged.courses, [
    { courseId: 'local', name: 'local' },
    { courseId: 'same', name: 'idb' },
    { courseId: 'idb', name: 'idb' },
  ]);
  assert.deepEqual(merged.progress, {
    local: { done: 1 }, same: { done: 2 }, idb: { done: 3 },
  });
  const projection = CoreStorageState.buildBusinessProjection(
    CoreStorageState.defaultMem(),
    { decks: [{ id: 'd1' }], stats: { totalAnswered: 9 } },
    { 'd1#c1': { times: 2 } },
    [{ id: 'e1', kind: 'answer' }],
  );
  assert.deepEqual(projection.decks, [{ id: 'd1' }]);
  assert.equal(projection.stats.totalAnswered, 9);
  assert.deepEqual(projection.stats.bySentence, { 'd1#c1': { times: 2 } });
  assert.deepEqual(projection.stats.events, [{ id: 'e1', kind: 'answer' }]);
  assert.deepEqual(CoreStorageState.buildBusinessProjection(null, null, null, null).stats.events, []);
  assert.deepEqual(CoreStorageState.buildStatsBusinessMeta({
    best: { d1: { acc: 1 } },
    settings: { sound: true },
    stats: { totalAnswered: 9, bySentence: { hidden: true }, events: [{ id: 'hidden' }] },
  }, 'owner-1', 4), {
    owner: 'owner-1',
    localGeneration: 4,
    data: { best: { d1: { acc: 1 } }, settings: { sound: true }, stats: { totalAnswered: 9 } },
  });
  assert.equal(CoreStorageState.buildStatsBusinessMeta(null, 'owner-1', 4), null);
  const signature = (value) => Number(value && value.times) || 0;
  const snapshot = (items) => ({
    count: items.length,
    firstId: items.length ? items[0].id : null,
    lastId: items.length ? items[items.length - 1].id : null,
  });
  const statsPlan = CoreStorageState.buildStatsPersistencePlan(
    { bySentence: { a: { times: 2 }, b: { times: 1 } }, events: [{ id: 'e1' }, { id: 'e2' }] },
    { a: 1, stale: 3 },
    snapshot([{ id: 'e1' }]),
    false,
    signature,
    snapshot,
  );
  assert.deepEqual(statsPlan.dirty, ['a', 'b']);
  assert.deepEqual(statsPlan.gone, ['stale']);
  assert.equal(statsPlan.eventFull, false);
  assert.deepEqual(statsPlan.eventRows, [{ id: 'e2' }]);
  assert.deepEqual(statsPlan.nextSignatures, { a: 2, b: 1 });
  const fullStatsPlan = CoreStorageState.buildStatsPersistencePlan(
    { bySentence: { a: { times: 2 } }, events: [{ id: 'e1' }] },
    { old: 1 },
    snapshot([{ id: 'old' }]),
    true,
    signature,
    snapshot,
  );
  assert.equal(fullStatsPlan.replaceStats, true);
  assert.equal(fullStatsPlan.eventFull, true);
  assert.deepEqual(fullStatsPlan.changed, { a: { times: 2 } });
  const mergeMap = (base, ours, theirs) => ({ base, ours, theirs });
  assert.deepEqual(CoreStorageState.buildCourseProgressWritePlan(
    'progress', { local: 1 }, { base: 1 }, { remote: 2 }, null, mergeMap),
    { snapshot: { base: { base: 1 }, ours: { local: 1 }, theirs: { remote: 2 } }, merged: true });
  assert.deepEqual(CoreStorageState.buildCourseProgressWritePlan(
    'courses', [{ courseId: 'local' }], null, [{ courseId: 'remote' }], null, null),
    { snapshot: [{ courseId: 'local' }], merged: false });
  assert.deepEqual(CoreStorageState.parseLegacyStatsRaw(JSON.stringify({
    stats: { bySentence: { a: { times: 1 } }, events: [{ id: 'e1' }] },
  })), {
    bySentence: { a: { times: 1 } }, events: [{ id: 'e1' }],
  });
  assert.deepEqual(CoreStorageState.parseLegacyStatsRaw('{"stats":{"bySentence":[]}}'), {
    bySentence: [], events: [],
  });
  assert.deepEqual(CoreStorageState.parseLegacyStatsRaw('{broken'), { bySentence: {}, events: [] });
  console.log('core-storage-state.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
