'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./test-manifest.cjs');
const root = path.resolve(__dirname, '..');
const seen = new Set();
for (const entry of manifest) {
  const absolute = path.resolve(root, entry.cwd, entry.file);
  assert.ok(absolute.startsWith(root + path.sep), 'test target must remain in repository');
  assert.ok(fs.existsSync(absolute), 'missing test target: ' + entry.cwd + '/' + entry.file);
  assert.ok(!seen.has(absolute), 'test target must run once: ' + absolute);
  seen.add(absolute);
}
for (const file of ['scripts/content-file-inventory.test.mjs', 'js/logical-course-store.test.mjs',
  'server/services/admin-overview.test.js']) {
  assert.ok(seen.has(path.resolve(root, file)), 'required release regression omitted: ' + file);
}
console.log('test manifest: ' + seen.size + ' existing, unique targets; asset/store/admin regressions included');
