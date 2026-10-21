'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { StaticContentStore } = require('./static-content-store');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-static-store-'));
function put(file, value) { const bytes = Buffer.from(JSON.stringify(value)); fs.writeFileSync(path.join(root, file), bytes, { flag: 'wx' }); return { file, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; }
const a = put('a.json', { value: 'a' }), b = put('b.json', { value: 'b' });
const store = new StaticContentStore({ root, maxBytes: a.size });
assert.deepEqual(store.read(a, { json: true }), { value: 'a' });
const bytes = store.read(a); bytes.fill(0);
assert.deepEqual(store.read(a, { json: true }), { value: 'a' });
assert.equal(store.metrics.reads, 1); assert.equal(store.metrics.hits, 2);
store.read(b); assert.equal(store.metrics.evictions, 1); assert.ok(store.cachedBytes <= a.size);
store.read(a); assert.equal(store.metrics.reads, 3);
for (const file of ['../a.json', '/a.json', 'a%2ejson', 'sub/../a.json', 'sub\\a.json']) assert.throws(() => store.read({ ...a, file }), /INVALID_CONTENT_PATH/);
assert.throws(() => store.read({ ...a, sha256: '0'.repeat(64) }), /CONTENT_INTEGRITY_FAILURE/);
// Tamper only this test's newly allocated file, never a user course.
fs.writeFileSync(path.join(root, 'a.json'), '{"value":"tampered"}');
assert.throws(() => store.read(a), /CONTENT_INTEGRITY_FAILURE/);
assert.throws(() => new StaticContentStore({ root, maxBytes: 16 * 1024 * 1024 + 1 }), /INVALID_CACHE_BUDGET/);
console.log('static-content-store: bounded LRU, shared bytes isolation, path and integrity checks passed');
