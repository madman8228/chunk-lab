'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { sourceProfile } = require('./repair-textbook-phonetics-standard.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(sourceProfile([{ status: 'pending-content-review', phonetic: '/hɒt/' }]).status, 'unconfirmed');
assert.equal(sourceProfile([{ status: 'previously-source-verified', phonetic: '/hɒt/' }]).evidence.length, 1);
assert.throws(() => require('./prepare-wordbook-phonetics-supplement.cjs').prepare({}), /已停用/);
if (process.argv[2]) {
  const root = process.argv[2], report = JSON.parse(fs.readFileSync(path.join(root, 'report.json')));
  const old = JSON.parse(fs.readFileSync(report.input));
  assert.equal(hash(fs.readFileSync(report.input)), report.inputSha256);
  for (const book of report.books) {
    const dir = hash(JSON.stringify(book.bookId));
    const candidate = JSON.parse(fs.readFileSync(path.join(root, dir, 'candidate.json')));
    const previous = JSON.parse(fs.readFileSync(path.join(path.dirname(report.input), dir, 'candidate.json')));
    assert.equal(candidate.published, false);
    assert.equal(candidate.index.books[0].structureRevision, previous.index.books[0].structureRevision);
    assert.equal(candidate.items.length, previous.items.length);
    for (let i = 0; i < candidate.items.length; i++) {
      const item = candidate.items[i], before = previous.items[i], row = book.rows[i];
      const { phonetic, contentRevision, ...body } = item;
      const { phonetic: previousPhonetic, contentRevision: previousRevision, ...previousBody } = before;
      assert.deepEqual(body, previousBody, 'Non-phonetic content must not change');
      const { contentRevision: ignored, ...hashedBody } = item;
      assert.equal(hash(JSON.stringify(hashedBody)), contentRevision);
      assert.equal(candidate.index.books[0].items.find(ref => ref.itemId === item.itemId).contentRevision, contentRevision);
      if (row.status === 'source-preserved-not-reverified') assert.deepEqual(item, before);
      else assert.equal(phonetic, undefined);
    }
    assert.equal(candidate.index.books[0].revision, hash(JSON.stringify(candidate.index.books[0].items)));
  }
  assert.equal(old.totals.items, report.totals.items);
}
console.log('Textbook standard repair tests passed');
