import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { CourseImageCache } from './course-image-cache.mjs';
import { PlatformCourseSource } from './platform-course-source.mjs';
const stores = new Map();
const caches = {
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return { async match(key) { return map.get(key)?.clone(); }, async put(key, value) { map.set(key, value.clone()); },
      async matchAll() { return [...map.values()].map(value => value.clone()); } };
  }
};
const win = { caches, crypto: webcrypto, location: { origin: 'https://synthetic.invalid' } };
let downloads = 0, allowed = true;
const cache = new CourseImageCache(win), guard = () => { if (!allowed) throw Error('DENIED'); };
const input = { scope: 'owner-a', courseId: 'course', contentVersion: 'v1', assetId: 'image', guard,
  download: async () => { downloads++; return new Blob(['image-data'], { type: 'image/webp' }); } };
await Promise.all([cache.load(input), cache.load(input)]);
assert.equal(downloads, 1, 'concurrent consumers share one download');
await new CourseImageCache(win).load(input);assert.equal(downloads, 1, 'new session reuses durable data');
assert.deepEqual(await cache.usage('owner-a'), { count: 1, bytes: 10 });
allowed = false; await assert.rejects(() => cache.load(input), /DENIED/);allowed = true;
await cache.load({ ...input, scope: 'owner-b' });assert.equal(downloads, 2);
await cache.load({ ...input, contentVersion: 'v2' });assert.equal(downloads, 3);
await cache.clear('owner-a');assert.equal((await cache.usage('owner-a')).count, 0);
assert.equal((await cache.usage('owner-b')).count, 1, 'clear preserves other accounts');
await cache.load(input);assert.equal(downloads, 4, 'manual clear permits a fresh download');
let release;
const running = cache.load({ ...input, assetId: 'slow', download: () => new Promise(resolve => { release = () => resolve(new Blob(['slow'], { type: 'image/png' })); }) });
while (!release) await new Promise(resolve => setImmediate(resolve));
await cache.clear('owner-a');release();await running;
assert.equal((await cache.usage('owner-a')).count, 0, 'in-flight download cannot refill a cleared cache');
let failures = 0;
const retry = { ...input, download: async () => { if (!failures++) throw Error('NETWORK');return input.download(); } };
await assert.rejects(() => cache.load(retry), /NETWORK/);await cache.load(retry);
const blocked = new CourseImageCache({ ...win, caches: { async open() { throw Error('QUOTA'); } } });
assert.equal(await (await blocked.load(input)).text(), 'image-data', 'blocked storage falls back without breaking learning');
let grants = 0, now = 0;
const grant = () => ({ grant: 'synthetic', headerName: 'X-Course-Grant', expiresAt: now + 30000, serverNow: now,
  contentVersion: 'v1', fragments: [{ cursor: 0, assetIds: ['image'] }], unit: { cursor: 0 } });
const source = new PlatformCourseSource({ controller: { canAdvance: () => allowed, start: async () => grant() },
  client: { contentGrant: async () => { grants++;return grant(); } }, newRequestId: () => 'id', monotonicNow: () => now,
  imageCache: cache, captureImageScope: () => 'owner-a', fetchResource: input.download });
await source.open({ courseId: 'course', unitId: 'unit' });
const before = downloads;await source.loadAssets('image', 0);assert.equal(downloads, before);
now = 86400000;await source.loadAssets('image', 0);assert.equal(grants, 1);assert.equal(downloads, before, 'next day renews permission but not image bytes');
await assert.rejects(() => source.loadAssets('not-granted', 0), /ASSET_NOT_AUTHORIZED/);
allowed = false;await assert.rejects(() => source.loadAssets('image', 0), /AUTHORIZATION_EXPIRED/);
const sw = fs.readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
assert.ok(sw.includes("k !== CACHE && /^chunklab-/.test(k)"), 'SW retires only versioned application caches, preserving separate image caches');
console.log('course image cache: durable reuse, deduplication, next-day authorization, owner/version isolation, clear races, retries and storage fallback passed');
