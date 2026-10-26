'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { uniqueSources, identity } = require('./complete-textbook-phonetics.cjs');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
assert.notEqual(identity({ word: 'read', meaning: '读' }), identity({ word: 'read', meaning: '读的过去式' }));
assert.equal(uniqueSources([{ word: 'x', meaning: 'x', phonetic: '/a/' }, { word: 'x', meaning: 'x', phonetic: '/b/' }]).size, 0);
assert.equal(uniqueSources([{ word: 'x', meaning: 'x', phonetic: '/a/' }, { word: 'x', meaning: 'x', phonetic: '/a/' }]).size, 1);
if (process.argv[2]) {
  const root = process.argv[2], report = JSON.parse(fs.readFileSync(path.join(root, 'report.json')));
  let added = 0;
  for (const book of report.books) {
    assert.equal(hash(fs.readFileSync(book.basePath)), book.baseSha256);
    const before = JSON.parse(fs.readFileSync(book.basePath));
    const after = JSON.parse(fs.readFileSync(path.join(root, hash(JSON.stringify(book.bookId)), 'candidate.json')));
    const changes = new Map(book.changes.map(row => [row.itemId, row]));
    assert.equal(after.items.length, before.items.length);
    assert.equal(after.index.books[0].structureRevision, before.index.books[0].structureRevision);
    for (let i = 0; i < after.items.length; i++) {
      const item = after.items[i], original = before.items[i];
      if (!changes.has(item.itemId)) assert.deepEqual(item, original);
      else {
        assert.equal(original.phonetic, undefined);
        const { phonetic, contentRevision, ...body } = item;
        const { contentRevision: previous, ...previousBody } = original;
        assert.deepEqual(body, previousBody);
        assert.equal(phonetic, changes.get(item.itemId).phonetic);
        added++;
      }
      const { contentRevision, ...body } = item;
      assert.equal(hash(JSON.stringify(body)), contentRevision);
      assert.equal(after.index.books[0].items.find(ref => ref.itemId === item.itemId).contentRevision, contentRevision);
    }
    assert.equal(after.index.books[0].revision, hash(JSON.stringify(after.index.books[0].items)));
    assert.equal(after.published, false);
  }
  assert.equal(added, report.totals.approvedMerged + report.totals.reused);
}
console.log('PASS: conflicts rejected; exact identity required; source hashes, immutable originals, non-phonetic content and revisions verified.');
