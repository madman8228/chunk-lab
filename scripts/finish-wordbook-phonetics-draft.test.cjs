'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { authored, modernize, choose } = require('./finish-wordbook-phonetics-draft.cjs');
const { csv } = require('./collect-ecdict-phonetics.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(csv('word,phonetic\n"a,b","x"\n'), [['word', 'phonetic'], ['a,b', 'x']]);
assert.throws(() => authored('hello\tx\nhello\ty'), /duplicate/);
assert.equal(modernize("'gɑ:dn", 'garden'), 'ˈɡɑːdn');
assert.equal(modernize("'sku:lbæ^", 'schoolbag'), 'ˈskuːlbæɡ');
assert.equal(modernize("'sєәri", 'scary'), 'ˈseəri');
assert.equal(modernize("'bædmintәn", 'badminton'), 'ˈbædmɪntən');
assert.equal(modernize("ə'baʊt", 'about'), 'əˈbaʊt');
assert.equal(modernize('mai', 'my'), 'maɪ');
assert.equal(modernize('dei', 'day'), 'deɪ');
assert.equal(modernize('bɔi', 'boy'), 'bɔɪ');
assert.equal(modernize("'dʒiɡsɒ:", 'jigsaw'), 'ˈdʒɪɡsɔː');
assert.equal(modernize("'ɒ:fn", 'often'), 'ˈɔːfn');
const manual = authored(fs.readFileSync('docs/source-materials/phonetics-british-supplement-20261025.txt', 'utf8'));
const get = (word, meaning = '') => choose({ word, meaning }, new Map(), manual);
assert.equal(get('in a hurry').phonetic, '/ɪn ə ˈhʌri/');
assert.equal(get('Good afternoon!').phonetic, '/ˌɡʊd ˌɑːftəˈnuːn/');
assert.equal(get('whenever').phonetic, '/wenˈevə(r)/');
assert.equal(get('use', '用；使用').phonetic, '/juːz/');
assert.equal(get('read', '读的过去式').phonetic, '/red/');
assert.equal(get('lead', '铅').phonetic, '/led/');
assert.equal(get('Unknown Name').pending, true);
assert.equal(get('Timo').releaseEligible, false);
assert.equal(get('Timo').status, 'provisional-name-candidate-not-verified');
if (process.argv[2]) {
  const root = process.argv[2], report = JSON.parse(fs.readFileSync(path.join(root, 'report.json')));
  assert.equal(hash(fs.readFileSync(path.join(report.input, 'report.json'))), report.inputSha256);
  assert.equal(hash(fs.readFileSync(report.editorial)), report.editorialSha256);
  let added = 0, filled = 0;
  for (const book of report.books) {
    assert.equal(hash(fs.readFileSync(book.basePath)), book.baseSha256);
    const before = JSON.parse(fs.readFileSync(book.basePath));
    const after = JSON.parse(fs.readFileSync(path.join(root, hash(JSON.stringify(book.bookId)), 'candidate.json')));
    const changes = new Map(book.changes.map(row => [row.itemId, row]));
    assert.equal(after.items.length, before.items.length);
    const { items: refs, revision, ...bookBody } = after.index.books[0];
    const { items: oldRefs, revision: oldRevision, ...oldBookBody } = before.index.books[0];
    assert.deepEqual(bookBody, oldBookBody);
    for (let i = 0; i < after.items.length; i++) {
      const item = after.items[i], original = before.items[i];
      if (!changes.has(item.itemId)) assert.deepEqual(item, original);
      else {
        assert.equal(original.phonetic, undefined);
        const { phonetic, contentRevision, ...body } = item;
        const { contentRevision: previous, ...previousBody } = original;
        assert.deepEqual(body, previousBody);
        assert.equal(phonetic, changes.get(item.itemId).phonetic);
        assert.equal(changes.get(item.itemId).releaseEligible, false);
        assert(phonetic.length <= 200);
        assert(!/[ɝɚɐ^әє]|oʊ/.test(phonetic));
        added++;
      }
      if (item.phonetic) filled++;
      const { contentRevision, ...body } = item;
      assert.equal(hash(JSON.stringify(body)), contentRevision);
      assert.equal(after.index.books[0].items.find(ref => ref.itemId === item.itemId).contentRevision, contentRevision);
    }
    assert.equal(after.index.books[0].revision, hash(JSON.stringify(after.index.books[0].items)));
    assert.equal(after.published, false);
  }
  assert.equal(added, report.totals.supplemented);
  assert.equal(filled, report.totals.filledTotal);
  assert.equal(report.totals.pendingContentReview, added);
}
console.log('PASS: CSV/notation regressions, weak forms and sense selection, immutable originals, source hashes, complete inventory, all non-phonetic fields and revisions; new supplements blocked from automatic release.');
