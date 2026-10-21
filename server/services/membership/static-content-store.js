'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fail = code => Object.assign(new Error(code), { code, status: 503 });
const inside = (root, file) => { const rel = path.relative(root, file); return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };

// Bytes are shared; authorization decisions are deliberately not accepted by this cache.
class StaticContentStore {
  constructor({ root, maxBytes = 16 * 1024 * 1024, readFile = file => fs.readFileSync(file) }) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16 * 1024 * 1024) throw fail('INVALID_CACHE_BUDGET');
    this.root = path.resolve(root); this.maxBytes = maxBytes; this.readFile = readFile;
    this.cache = new Map(); this.cachedBytes = 0;
    this.metrics = { reads: 0, hits: 0, parses: 0, evictions: 0 };
  }
  resolve(relative) {
    if (typeof relative !== 'string' || !relative || /[\\%\u0000]/.test(relative) || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..')) throw fail('INVALID_CONTENT_PATH');
    const root = fs.realpathSync(this.root), file = fs.realpathSync(path.join(root, relative));
    if (!inside(root, file) || !fs.statSync(file).isFile()) throw fail('INVALID_CONTENT_PATH');
    return file;
  }
  read(descriptor, { json = false } = {}) {
    if (!descriptor || !/^[a-f0-9]{64}$/.test(descriptor.sha256 || '') || !Number.isSafeInteger(descriptor.size) || descriptor.size < 1) throw fail('INVALID_STATIC_DESCRIPTOR');
    const file = this.resolve(descriptor.file), stat = fs.statSync(file);
    if (stat.size !== descriptor.size) throw fail('CONTENT_INTEGRITY_FAILURE');
    const key = JSON.stringify([file, descriptor.sha256, descriptor.size]);
    const stamp = [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
    let entry = this.cache.get(key);
    if (entry && entry.stamp === stamp) {
      this.metrics.hits++; this.cache.delete(key); this.cache.set(key, entry);
    } else {
      if (entry) { this.cachedBytes -= entry.bytes.length; this.cache.delete(key); }
      const bytes = this.readFile(file); this.metrics.reads++;
      if (bytes.length !== descriptor.size || crypto.createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) throw fail('CONTENT_INTEGRITY_FAILURE');
      entry = { bytes, stamp };
      if (bytes.length <= this.maxBytes) {
        while (this.cachedBytes + bytes.length > this.maxBytes) {
          const oldest = this.cache.keys().next().value, removed = this.cache.get(oldest);
          this.cache.delete(oldest); this.cachedBytes -= removed.bytes.length; this.metrics.evictions++;
        }
        this.cache.set(key, entry); this.cachedBytes += bytes.length;
      }
    }
    // Parsed objects are returned as clones; a caller cannot mutate the shared cache.
    if (json) { this.metrics.parses++; return JSON.parse(entry.bytes.toString('utf8')); }
    return Buffer.from(entry.bytes);
  }
  clear() { this.cache.clear(); this.cachedBytes = 0; }
}
module.exports = { StaticContentStore };
