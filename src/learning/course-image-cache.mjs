// Separate from versioned application caches: upgrades must not evict learned images.
export const IMAGE_CACHE_PREFIX = 'course-images-v1-';
const pending = new Map(), revisions = new Map();
export function imageCacheScope(win) {
  return JSON.stringify([win.ChunkAPI.getBase(), win.AccountStorage.owner]);
}
export class CourseImageCache {
  constructor(win = globalThis) { this.win = win; }
  async name(scope) {
    const bytes = new TextEncoder().encode(scope);
    const digest = await this.win.crypto.subtle.digest('SHA-256', bytes);
    return IMAGE_CACHE_PREFIX + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  async load({ scope, courseId, contentVersion, assetId, download, guard }) {
    guard();
    if (!this.win.caches || !this.win.crypto?.subtle) { const blob = await download(); guard(); return blob; }
    let name, cache;
    try { name = await this.name(scope); cache = await this.win.caches.open(name); }
    catch (_) { const blob = await download(); guard(); return blob; }
    guard();
    const key = new URL('/__course_image_cache__/' + encodeURIComponent(JSON.stringify([courseId, contentVersion, assetId])), this.win.location.origin).href;
    const revision = revisions.get(name) || 0, flightKey = name + ':' + revision + ':' + key;
    if (!pending.has(flightKey)) {
      const task = (async () => {
        let response;
        try { response = await cache.match(key); } catch (_) { /* Storage may be disabled. */ }
        guard();
        if (response) {
          try {
            const blob = await response.blob();
            if (blob.size && /^image\//.test(blob.type) && Number(response.headers.get('X-Image-Bytes')) === blob.size) return blob;
          } catch (_) { /* A damaged entry is recovered by fetching only this image. */ }
        }
        const blob = await download(); guard();
        if (blob.size && /^image\//.test(blob.type) && revision === (revisions.get(name) || 0)) {
          try { await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type, 'X-Image-Bytes': String(blob.size) } })); }
          catch (_) { /* Full/blocked storage must not break learning. No other data is evicted. */ }
        }
        return blob;
      })();
      pending.set(flightKey, task);
    }
    const task = pending.get(flightKey);
    try { const blob = await task; guard(); return blob; }
    finally { if (pending.get(flightKey) === task) pending.delete(flightKey); }
  }
  async usage(scope) {
    if (!this.win.caches || !this.win.crypto?.subtle) return null;
    const name = await this.name(scope);
    if (!(await this.win.caches.keys()).includes(name)) return { count: 0, bytes: 0 };
    const cache = await this.win.caches.open(name), entries = await cache.matchAll();
    return { count: entries.length, bytes: entries.reduce((total, entry) => total + (Number(entry.headers.get('X-Image-Bytes')) || 0), 0) };
  }
  async clear(scope) {
    if (!this.win.caches || !this.win.crypto?.subtle) throw new Error('IMAGE_CACHE_UNAVAILABLE');
    const name = await this.name(scope);
    revisions.set(name, (revisions.get(name) || 0) + 1);
    await this.win.caches.delete(name);
  }
}
