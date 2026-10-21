'use strict';
// Read-only source audit; build outputs are allocated outside real course/data directories.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const originalMap = JSON.parse(fs.readFileSync(path.join(root, 'server/content/shards.json')));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-revision-20261013-'));
const approved = new Set(['f701e5ce', '4d62bdfa', 'f74e2382']);
const hashes = new Map();
for (const deck of originalMap.decks) for (const shard of [...deck.shards, ...deck.indexShards]) {
  hashes.set(shard.url, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, shard.url))).digest('hex'));
}
cp.execFileSync(process.execPath, ['scripts/build-content.mjs'], {
  cwd: root, env: {...process.env, CONTENT_OUTPUT_ROOT: temp}, stdio: 'pipe'
});
const nextMap = JSON.parse(fs.readFileSync(path.join(temp, 'server/content/shards.json')));
assert.deepEqual(nextMap.decks.map(d => d.id), originalMap.decks.map(d => d.id));
const changed = [];
for (const deck of originalMap.decks) {
  const next = nextMap.decks.find(d => d.id === deck.id);
  const load = (base, d) => d.shards.flatMap(sh => JSON.parse(fs.readFileSync(path.join(base, sh.url))).items);
  const before = deck.id === 'oral-2-8-4'
    ? JSON.parse(fs.readFileSync(path.join(root, 'content/oral-2-8-4/oral-001-233c0f02aa32.json'))).items
    : load(root, deck);
  const after = load(temp, next);
  assert.deepEqual(after.map(i => i.cid), before.map(i => i.cid));
  before.forEach((item, i) => {
    const revised = after[i];
    if (JSON.stringify(item) === JSON.stringify(revised)) return;
    assert.equal(deck.id, 'oral-2-8-4');
    assert(approved.has(item.cid), 'Unapproved course change: ' + item.cid);
    assert.equal(revised.sentence, item.sentence);
    assert.equal(revised.translation, item.translation);
    assert.equal(revised.chunks.join(' '), item.sentence);
    assert.equal(revised.chunks.length, 2);
    assert.equal(revised.hints.length, 2);
    for (const key of ['grammar', 'distractors', 'alts']) if (revised[key]) assert.equal(revised[key].length, 2);
    assert.deepEqual(revised.explanations, item.explanations);
    changed.push(item.cid);
  });
}
assert.deepEqual(changed.sort(), [...approved].sort());
for (const [file, hash] of hashes) assert.equal(
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash,
  'Original asset changed: ' + file
);
console.log(JSON.stringify({changed, oldAssetsVerified: hashes.size, isolatedOutput: temp}));
