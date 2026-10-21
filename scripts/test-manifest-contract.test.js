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
  'js/vocabulary-browse-store.test.js', 'e2e/vocabulary-browse-archive-read.test.cjs',
  'js/learning-session-bootstrap.test.js',
  'server/services/admin-overview.test.js',
  'scripts/homepage-update.test.cjs', 'scripts/practice-page-update.test.cjs',
  'scripts/session-identity-consistency.test.cjs', 'scripts/stats-auto-confirmation.test.cjs',
  'scripts/stats-confirmed-cross-tab.test.cjs', 'scripts/sw-navigation-coherence.test.cjs']) {
  assert.ok(seen.has(path.resolve(root, file)), 'required release regression omitted: ' + file);
}
console.log('test manifest: ' + seen.size + ' existing, unique targets; asset/store/admin regressions included');
