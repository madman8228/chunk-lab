'use strict';

const assert = require('assert');
const fs = require('fs');

for (const file of ['main.html', 'decks.html', 'stats.html', 'courses.html']) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!source.includes('oral-book.js'), file + ' must not load build-time oral-book.js');
  assert(!source.includes('freq-idioms.js'), file + ' must not load build-time freq-idioms.js');
}
const repo = fs.readFileSync('js/content-repository.js', 'utf8');
assert(repo.includes("fetch(MANIFEST_URL"), 'content repository must load manifest');
assert(repo.includes("fetch(shard.url"), 'content repository must load detail shards lazily');
assert(fs.existsSync('content/manifest.json'), 'content manifest must be published');

console.log('[content-runtime] build-time sources stay out of page runtime');
