import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
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
        assert.ok(mode === undefined || mode === 'local');
        if (failProjection) return false;
        Object.assign(mem, structuredClone(value));
        return true;
      }
    },
    ChunkCourse: {},
    crypto: webcrypto,
    TextEncoder,
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
  return { gateway, mem, commits, scope, retiredKey, win, get confirmed() { return structuredClone(snapshot); }, setReadHook(fn) { readHook = fn; }, setFail(value) { failSubmit = value; } };
}

test('protocol 3 saves new sentence courses to the independent library, not the learning snapshot', async () => {
  const f = setup(), requests = [];
  f.win.ChunkAPI = { isLoggedIn: () => true, async request(path, options) {
    requests.push({ path, options: structuredClone(options) });
    return requests.length === 1
      ? { courseId: 'private-course-1', releaseId: 'a'.repeat(64) }
      : { courseId: 'private-course-1', releaseId: 'b'.repeat(64), changed: true };
  } };
  const deck = { id: 'ai-123456789012345678901234', name: 'Independent', items: [{ id: 'line-1', sentence: 'A sentence.' }], authoring: {} };
  const receipt = await f.gateway.saveSentenceCourse(deck, f.scope);
  assert.equal(receipt.storageKind, 'personal-course');
  assert.equal(receipt.contentId, 'private-course-1');
  assert.equal(deck.id, 'private-course-1');
  assert.equal(requests[0].path, '/api/course-library/import');
  assert.equal(JSON.parse(requests[0].options.body).kind, 'deck');
  assert.equal(f.commits.length, 0);
  assert.equal(f.mem.decks.length, 0, 'course text is not copied into account learning data');

  const updated = { ...deck, name: 'Independent v2' };
  const next = await f.gateway.saveSentenceCourse(updated, f.scope);
  const releaseRequest = JSON.parse(requests[1].options.body);
  assert.equal(requests[1].path, '/api/course-library/private-course-1/release');
  assert.equal(releaseRequest.expectedRelease, 'a'.repeat(64));
  assert.equal(next.releaseId, 'b'.repeat(64));
  assert.equal(f.mem.decks.length, 0);
});

test('legacy AI course conversion carries its old learning identity as an explicit source mapping', async () => {
  const f = setup(), requests = [];
  f.win.ChunkAPI = { isLoggedIn: () => true, async request(path, options) {
    requests.push({ path, options }); return { courseId: 'private-converted-course', releaseId: 'c'.repeat(64) };
  } };
  const deck = { id: 'old-course-id', name: 'Converted legacy', items: [{ cid: 'line-a', sentence: 'We are ready.' }],
    authoring: { legacySource: { courseId: 'old-course-id', formatVersion: '2.0' } } };
  const receipt = await f.gateway.saveSentenceCourse(deck, f.scope);
  assert.equal(receipt.contentId, 'private-converted-course');
  const payload = JSON.parse(requests[0].options.body);
  assert.deepEqual(payload.sourceMapping, { kind: 'course', sourceId: 'old-course-id' });
  assert.equal(f.commits.length, 0, 'the mapping and course body do not enter personal learning writes');
});

test('protocol 3 imports image course content and binary assets outside account learning data', async () => {
  const f = setup();
  const requests = [], sourceCourseId = 'ai-media-123456789012';
  f.win.atob = globalThis.atob; f.win.TextEncoder = TextEncoder;
  f.win.ChunkAPI = { isLoggedIn: () => true, async request(path, options) {
    requests.push({ path, options }); return { courseId: 'private-server-id', releaseId: 'a'.repeat(64) };
  } };
  const compiled = { courseId: sourceCourseId, schemaVersion: '2.0', assets: [{ id: sourceCourseId + ':image:one', path: 'images/one.webp', mimeType: 'image/webp', _dataUri: 'data:image/webp;base64,AQID' }],
    utterances: [{ id: sourceCourseId + ':line:001', text: { en: 'A sentence.', 'zh-CN': '一句话。' }, imageAssetId: sourceCourseId + ':image:one' }], sequence: [sourceCourseId + ':line:001'] };
  const receipt = await f.gateway.saveCompiledCourse(compiled, { 'images/one.webp': 'data:image/webp;base64,AQID' }, f.scope);
  assert.equal(receipt.storageKind, 'personal-course');assert.equal(receipt.sourceCourseId, sourceCourseId);
  assert.equal(requests[0].path, '/api/course-library/import');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.kind, 'course');assert.equal(body.assets[0].assetId, sourceCourseId + ':image:one');
  assert.equal(body.assets[0].bytes, 3);assert.equal(body.assets[0].base64, 'AQID');assert.equal(body.content.assets[0]._dataUri, undefined);
  assert.equal(f.commits.length, 0);
  assert.equal(f.mem.decks.length, 0);
});

test('legacy protocol saves created and updated authoring decks through deck.put only', async () => {
  const f = setup();
  f.win.CL.getCloudConfig = () => ({ writeProtocol: 2 });
  const deck = { id: 'ai-course-test', name: 'AI course', items: [{ sentence: 'We are ready.' }], authoring: { catalogCourseId: 'user-deck:ai-course-test' } };
  const receipt = await f.gateway.saveSentenceCourse(deck, f.scope, {
    forceSave: true,
    beforeSave(mem) {
      delete mem.deletedItems[f.retiredKey];
      return () => { mem.deletedItems[f.retiredKey] = true; };
    }
  });
  assert.equal(receipt.contentId, deck.id);
  assert.equal(f.commits.length, 0, 'legacy local mode does not submit protocol-3 operations');
  assert.equal(f.mem.decks[0].name, deck.name);
  assert.equal(f.mem.deletedItems[f.retiredKey], undefined);

  const edited = { ...deck, name: 'AI course edited' };
  f.mem.decks[0].name = edited.name;
  await f.gateway.saveSentenceCourse(edited, f.scope, { forceSave: true });
  assert.equal(f.commits.length, 0);
  assert.equal(f.mem.decks[0].name, edited.name);
  await assert.rejects(f.gateway.saveSentenceCourse({ ...edited, items: [{ sentence: 'Different content.' }] },
    f.scope, { forceSave: true }), /已有不同内容/);
  assert.equal(f.commits.length, 0, 'forceSave cannot submit a legacy operation in local mode');
  assert.deepEqual(f.mem.decks[0].items, deck.items);
});

test('protocol 3 never falls back to deck.put when no authenticated session exists', async () => {
  const f = setup(), requests = [];
  f.win.ChunkAPI = { isLoggedIn: () => false, async request(path, options) {
    requests.push({ path, options });
    throw Object.assign(new Error('需要登录'), { status: 401, code: 'AUTH_REQUIRED' });
  } };
  const deck = { id: 'ai-course-signed-out', name: 'Signed out', items: [{ sentence: 'Keep this as a draft.' }], authoring: {} };
  await assert.rejects(f.gateway.saveSentenceCourse(deck, f.scope), /需要登录/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/course-library/import');
  assert.equal(f.commits.length, 0, 'a protocol-3 save must never submit deck.put');
  assert.deepEqual(f.mem.decks, [], 'failed independent import leaves personal learning data untouched');
});

test('protocol 3 import failure preserves the draft and does not fall back to learning writes', async () => {
  const f = setup(), requests = [];
  f.win.ChunkAPI = { isLoggedIn: () => true, async request(path, options) {
    requests.push({ path, options }); throw new Error('simulated independent import failure');
  } };
  const deck = { id: 'ai-course-test', name: 'AI course', items: [], authoring: {} };
  await assert.rejects(f.gateway.saveSentenceCourse(deck, f.scope), /simulated independent import failure/);
  assert.deepEqual(f.mem.decks, []);
  assert.equal(f.mem.deletedItems[f.retiredKey], true);
  assert.equal(requests.length, 1);
  assert.equal(f.commits.length, 0);
});

test('protocol 3 refuses a stale release without writing personal learning data', async () => {
  const f = setup(), requests = [];
  f.win.ChunkAPI = { isLoggedIn: () => true, async request(path, options) {
    requests.push({ path, options });
    if (requests.length === 1) return { courseId: 'private-course-1', releaseId: 'a'.repeat(64) };
    throw Object.assign(new Error('课程版本已变化'), { status: 409, code: 'COURSE_RELEASE_CHANGED' });
  } };
  const deck = { id: 'ai-course-test', name: 'Original', items: [{ sentence: 'Hello.' }], authoring: {} };
  await f.gateway.saveSentenceCourse(deck, f.scope);
  await assert.rejects(f.gateway.saveSentenceCourse({ ...deck, id: 'private-course-1', name: 'Stale edit', authoring: { courseLibrary: { courseId: 'private-course-1', releaseId: 'a'.repeat(64) } } }, f.scope), /课程版本已变化/);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].path, '/api/course-library/private-course-1/release');
  assert.equal(f.commits.length, 0);
  assert.deepEqual(f.mem.decks, []);
});

test('protocol 3 confirmed independent import leaves account learning data empty', async () => {
  const f = setup();
  f.win.ChunkAPI = { isLoggedIn: () => true, async request() { return { courseId: 'private-course-1', releaseId: 'a'.repeat(64) }; } };
  const receipt = await f.gateway.saveSentenceCourse({ id: 'ai-course-test', name: 'AI course', items: [], authoring: {} }, f.scope);
  assert.equal(receipt.contentId, 'private-course-1');
  assert.equal(f.commits.length, 0);
  assert.deepEqual(f.mem.decks, []);
});

test('joining an independent authoring course stores only its learning reference', async () => {
  const f = setup(), joined = [];
  f.win.CourseEnrollment = { async join(courseId) { joined.push(courseId); } };
  const result = await f.gateway.joinCourse('personal-course:private-course-1', f.scope);
  assert.deepEqual(joined, ['personal-course:private-course-1']);
  assert.equal(result.courseId, 'private-course-1');
  assert.deepEqual(f.mem.decks, []);
});
