import assert from 'node:assert/strict';
import { currentContentFiles } from './content-file-inventory.mjs';

const manifest = { decks: [{ shards: [{ url: 'content/decks/current.json' }],
  indexShards: [{ url: 'content/index/current.json' }] }] };
assert.deepEqual(currentContentFiles(manifest), ['decks/current.json', 'index/current.json', 'manifest.json']);
// Historical paths are intentionally not inputs: retaining them cannot change the gate.
assert.deepEqual(currentContentFiles({ decks: [{ shards: [{ url: 'content/a.json' }, { url: 'content/a.json' }] }] }), ['a.json', 'manifest.json']);
for (const url of ['../a.json', 'content/../a.json', 'content//a.json', 'content/./a.json', 'content/a\\b.json', null]) {
  assert.throws(() => currentContentFiles({ decks: [{ shards: [{ url }] }] }), /Unsafe/);
}
assert.throws(() => currentContentFiles({}), /Invalid/);
console.log('content inventory: current detail/index files and unsafe path guards passed');
