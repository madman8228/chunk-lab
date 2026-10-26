'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { buildCandidate, packageBatch, defaultSource, defaultBatch, expected } = require('./package-wordbook-us-phrases.cjs');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-us-phrases-'));
try {
  const sourceBytes = fs.readFileSync(defaultSource);
  const original = JSON.parse(sourceBytes.toString('utf8'));
  const batch = JSON.parse(fs.readFileSync(defaultBatch, 'utf8'));
  const { candidate, changes } = buildCandidate(sourceBytes, batch);
  assert.equal(changes.length, 5);
  assert.equal(candidate.items.length, original.items.length);
  assert.equal(candidate.published, false);
  for (const [id, rule] of expected) {
    const before = original.items.find(item => item.itemId === id);
    const after = candidate.items.find(item => item.itemId === id);
    assert.equal(after.phonetics['en-US'], rule.ipa, `${rule.word} has the approved Cambridge US whole-phrase transcription`);
    assert.equal(after.phonetics['en-GB'], before.phonetics['en-GB']);
    assert.deepEqual(after.learning, before.learning);
    const beforeBody = { ...before }; delete beforeBody.contentRevision;
    const afterBody = { ...after }; delete afterBody.contentRevision; delete afterBody.phonetics;
    delete beforeBody.phonetics;
    assert.deepEqual(afterBody, beforeBody);
    assert.equal(candidate.index.books[0].items.find(ref => ref.itemId === id).contentRevision, after.contentRevision);
  }
  const untouchedId = original.items.find(item => !expected.has(item.itemId)).itemId;
  assert.deepEqual(candidate.items.find(item => item.itemId === untouchedId), original.items.find(item => item.itemId === untouchedId));
  assert.equal(candidate.index.books[0].revision, require('node:crypto').createHash('sha256').update(JSON.stringify(candidate.index.books[0].items)).digest('hex'));

  assert.throws(() => buildCandidate(Buffer.from(sourceBytes.toString('utf8') + ' '), batch), /hash/);
  const wrongItem = structuredClone(batch); wrongItem.items[0].word = 'Good morning';
  assert.throws(() => buildCandidate(sourceBytes, wrongItem), /identity mismatch/);
  const wrongId = structuredClone(batch); wrongId.items[0].itemId = 'textbook-item:wrong';
  assert.throws(() => buildCandidate(sourceBytes, wrongId), /IDs/);

  const output = path.join(temp, 'review-package');
  const written = packageBatch({ outputPath: output });
  assert.equal(written.report.summary.americanPhraseIPAAdded, 5);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'candidate.json'))).items.length, 136);
  assert.throws(() => packageBatch({ outputPath: output }), /refusing to overwrite/);
  console.log('US phrase IPA candidate: five exact entries, British IPA/audio and untouched items preserved; revisions, contract, bad inputs and no-overwrite behavior passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
