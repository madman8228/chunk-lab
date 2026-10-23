'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function fixture() {
  const url = 'content/synthetic/details-hash.json';
  const shard = { url, count: 1, sha256: 'synthetic-hash' };
  let downloads = 0, fail = false;
  const window = { location: { href: 'https://example.test/main.html' },
    ChunkAPI: { getBase: () => '', getToken: () => 'synthetic' },
    BUILTIN: [], localStorage: { getItem: () => null } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./content-repository'), 'utf8'), {
    window, URL, console,
    fetch: async input => {
      if (input === 'content/manifest.json') return { ok: true, json: async () => ({
        schemaVersion: 1, contentVersion: 'synthetic-v1', decks: [{ id: 'fixture', totalCount: 1 }] }) };
      if (input === '/api/content/shards') return { ok: true, json: async () => ({ decks: [{ id: 'fixture', shards: [shard] }] }) };
      if (input === '/api/course-content/catalog') return { ok: true, json: async () => ({ courses: [] }) };
      assert.equal(input, url);
      downloads++;
      await new Promise(resolve => setImmediate(resolve));
      if (fail) throw new Error('synthetic offline');
      return { ok: true, json: async () => ({ schemaVersion: 1, items: [{ cid: 'one', sentence: 'Test.', translation: '测试。' }] }) };
    }
  });
  await window.ContentRepo.ready;
  const items = [{ cid: 'one', _contentRef: { url, offset: 0 } }];
  return { repo: window.ContentRepo, items, downloads: () => downloads, fail: value => { fail = value; } };
}

(async () => {
  const url = 'content/fixture/details.json';let token = null, shardReads = 0, catalogReads = 0;
  const window = { location: { href: 'https://example.test/main.html' },
    ChunkAPI: { getBase: () => '', getToken: () => token, isLoggedIn: () => !!token,
      getCourseCatalog: async () => { catalogReads++; return { courses: [] }; } },
    BUILTIN: [], localStorage: { getItem: () => null } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./content-repository'), 'utf8'), {
    window, URL, console,
    fetch: async (input, options = {}) => {
      if (input === 'content/manifest.json') return { ok: true, json: async () => ({
        schemaVersion: 1, contentVersion: 'guest-v1', decks: [{ id: 'guest-fixture', totalCount: 1 }] }) };
      if (input === '/api/content/shards') {
        shardReads++;
        assert.equal(options.headers.Authorization, 'Bearer fixture-token', 'authenticated shard request carries the current token');
        return { ok: true, json: async () => ({ decks: [{ id: 'guest-fixture', shards: [{ url, count: 1 }] }] }) };
      }
      assert.equal(input, url);
      return { ok: true, json: async () => ({ schemaVersion: 1, items: [{ cid: 'one', sentence: 'Ready.', translation: '准备好了。' }] }) };
    }
  });
  await window.ContentRepo.ready;
  assert.equal(shardReads, 0, 'public metadata loads without requesting the authenticated shard map for a visitor');
  assert.equal(catalogReads, 0, 'protected course catalog is not requested without a login token');
  token = 'fixture-token';
  await window.ContentRepo.loadProtectedCatalog();
  assert.equal(catalogReads, 1, 'protected catalog can be read after login');
  const guestDeck = await window.ContentRepo.ensureDeck('guest-fixture');
  assert.equal(shardReads, 1, 'content is loaded on demand after credentials become available');
  assert.equal(guestDeck.items[0].sentence, 'Ready.');

  const f = await fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.repo.hydrateItemBatch(f.items, 0, 1)));
  assert.equal(f.downloads(), 1, 'concurrent practice hydration requests share a single detail download');
  assert.ok(results.every(result => result[0].sentence === 'Test.'));
  assert.notEqual(results[0][0], results[1][0], 'callers still receive independently hydrated items');
  await f.repo.hydrateItemBatch(f.items, 0, 1);
  assert.equal(f.downloads(), 2, 'memory:false does not retain detail shards when durable cache is unavailable');
  const failed = await fixture(); failed.fail(true);
  const rejected = await Promise.allSettled(Array.from({ length: 3 }, () => failed.repo.hydrateItems(failed.items)));
  assert.ok(rejected.every(result => result.status === 'rejected'));
  assert.equal(failed.downloads(), 1, 'concurrent failure is shared');
  failed.fail(false);
  await failed.repo.hydrateItems(failed.items);
  assert.equal(failed.downloads(), 2, 'a failed download is removed and retry can succeed');
  await failed.repo.hydrateItems(failed.items);
  assert.equal(failed.downloads(), 2, 'default callers retain successful memory cache');
  console.log('content repository: concurrent hydration coalescing, bounded memory and failure retry passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
