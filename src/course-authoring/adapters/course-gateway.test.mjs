import test from 'node:test';
import assert from 'node:assert/strict';
import { ExistingCourseGateway } from './course-gateway.mjs';

function setup({ failSubmit = false, failProjection = false } = {}) {
  const owner = 'account-test';
  const scope = { owner };
  const retiredKey = 'ai-course-retired:ai-course-test';
  const mem = { decks: [], deletedItems: { [retiredKey]: true } };
  let snapshot = { mem: { decks: [], deletedItems: { [retiredKey]: true } }, revs: { decks: {} } };
  const commits = [];
  let readHook = null;
  const win = {
    CL: {
      getCloudConfig: () => ({ writeProtocol: 3 }),
      async preload() {},
      loadMem: () => mem,
      async saveAndNotify(value, mode) {
        assert.equal(mode, 'local');
        if (failProjection) return false;
        Object.assign(mem, structuredClone(value));
        return true;
      }
    },
    ChunkCourse: {},
    AccountStorage: { owner, assertCurrent() {} },
    ServerCache: { async read() { if (readHook) readHook(snapshot); return { owner, snapshot: structuredClone(snapshot) }; } },
    ServerStore: {
      async submitCommitted(type, payload, options) {
        commits.push({ type, payload: structuredClone(payload), options: structuredClone(options) });
        if (failSubmit) throw new Error('simulated durable submission failure');
        const nextRev = (options.expectedRev == null ? 0 : options.expectedRev) + 1;
        snapshot = { mem: { decks: snapshot.mem.decks.filter((row) => row.id !== payload.deck.id).concat([structuredClone(payload.deck)]), deletedItems: { ...snapshot.mem.deletedItems } }, revs: { decks: { ...snapshot.revs.decks, [payload.deck.id]: nextRev } } };
        if (payload.clearRetiredMarker) delete snapshot.mem.deletedItems[retiredKey];
      }
    }
  };
  const gateway = new ExistingCourseGateway({ getWindow: () => /** @type {Window & typeof globalThis} */ (/** @type {unknown} */ (win)), scopeGuard: { assert(value) { assert.equal(value, scope); } } });
  return { gateway, mem, commits, scope, retiredKey, get confirmed() { return structuredClone(snapshot); }, setReadHook(fn) { readHook = fn; }, setFail(value) { failSubmit = value; } };
}

test('protocol 3 saves created and updated authoring decks through deck.put only', async () => {
  const f = setup();
  const deck = { id: 'ai-course-test', name: 'AI course', items: [{ sentence: 'We are ready.' }], authoring: { catalogCourseId: 'user-deck:ai-course-test' } };
  const receipt = await f.gateway.saveSentenceCourse(deck, f.scope, {
    forceSave: true,
    beforeSave(mem) {
      delete mem.deletedItems[f.retiredKey];
      return () => { mem.deletedItems[f.retiredKey] = true; };
    }
  });
  assert.equal(receipt.contentId, deck.id);
  assert.equal(f.commits.length, 1);
  assert.equal(f.commits[0].type, 'deck.put');
  assert.equal(f.commits[0].options.expectedRev, null);
  assert.equal(f.commits[0].payload.clearRetiredMarker, true);
  assert.equal(f.mem.decks[0].name, deck.name);
  assert.equal(f.mem.deletedItems[f.retiredKey], undefined);

  const edited = { ...deck, name: 'AI course edited' };
  f.mem.decks[0].name = edited.name;
  await f.gateway.saveSentenceCourse(edited, f.scope, { forceSave: true });
  assert.equal(f.commits[1].type, 'deck.put');
  assert.equal(f.commits[1].options.expectedRev, 1);
  assert.equal(f.mem.decks[0].name, edited.name);
  await assert.rejects(f.gateway.saveSentenceCourse({ ...edited, items: [{ sentence: 'Different content.' }] },
    f.scope, { forceSave: true }), /已有不同内容/);
  assert.equal(f.commits.length, 2, 'forceSave cannot silently replace existing course content');
  assert.deepEqual(f.confirmed.mem.decks[0].items, deck.items);
});

test('protocol 3 authoring failure restores the local draft and retired marker', async () => {
  const f = setup({ failSubmit: true });
  const deck = { id: 'ai-course-test', name: 'AI course', items: [], authoring: {} };
  await assert.rejects(f.gateway.saveSentenceCourse(deck, f.scope, {
    forceSave: true,
    beforeSave(mem) {
      delete mem.deletedItems[f.retiredKey];
      return () => { mem.deletedItems[f.retiredKey] = true; };
    }
  }), /simulated durable submission failure/);
  assert.deepEqual(f.mem.decks, []);
  assert.equal(f.mem.deletedItems[f.retiredKey], true);
  assert.equal(f.commits.length, 1);
  assert.equal(f.commits[0].type, 'deck.put');
});

test('protocol 3 refuses an authoring save when confirmed content changes between reads', async () => {
  const f = setup();
  const deck = { id: 'ai-course-test', name: 'Original', items: [{ sentence: 'Hello.' }], authoring: {} };
  await f.gateway.saveSentenceCourse(deck, f.scope);
  let reads = 0;
  f.setReadHook(snapshot => {
    if (++reads === 2) {
      snapshot.mem.decks[0].name = 'Other page edit';
      snapshot.revs.decks[deck.id]++;
    }
  });
  await assert.rejects(f.gateway.saveSentenceCourse({ ...deck, name: 'Stale edit' }, f.scope, { forceSave: true }), /保存期间变化/);
  assert.equal(f.commits.length, 1);
  assert.equal(f.confirmed.mem.decks[0].name, 'Other page edit');
});

test('protocol 3 projection failure does not pretend a confirmed server save was rolled back', async () => {
  const f = setup({ failProjection: true });
  const deck = { id: 'ai-course-test', name: 'AI course', items: [], authoring: {} };
  await assert.rejects(f.gateway.saveSentenceCourse(deck, f.scope, { forceSave: true }), /课程已保存到服务器，但本机显示状态未能更新/);
  assert.equal(f.commits.length, 1);
  assert.equal(f.commits[0].type, 'deck.put');
  assert.equal(f.confirmed.mem.decks[0].id, deck.id, 'confirmed server save survives projection failure');
  assert.deepEqual(f.mem.decks, [], 'failed projection does not mutate historical local originals');
});
