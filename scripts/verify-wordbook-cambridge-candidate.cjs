'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const contract = require('../js/vocabulary-course-contract');
const study = require('../js/vocabulary-study.cjs');
const engine = require('../landing/sentence-cloze-engine');

function verify(directory, approvalFile, output) {
  if (fs.existsSync(output)) throw Error('Verification output must be new');
  const root = path.resolve(__dirname, '..');
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const approval = read(approvalFile), report = read(path.join(directory, 'report.json'));
  for (const row of [...approval.artifacts, ...approval.books]) assert.equal(hash(fs.readFileSync(row.path)), row.sha256, row.path);
  const changes = read(path.join(directory, 'changes.json'));
  const unresolved = read(path.join(directory, 'unresolved.json'));
  const byId = new Map(changes.map(row => [row.bookId + '\n' + row.itemId, row]));
  assert.equal(byId.size, changes.length);
  const assets = new Map(), issues = [];
  let items = 0, us = 0, gb = 0, changed = 0;
  function asset(ref, kind, expected) {
    if (!ref) return;
    if (!/^assets\/[A-Za-z0-9._-]+\.[A-Za-z0-9]+$/.test(ref)) { issues.push({ type: 'unsafe-asset-reference', ref }); return; }
    const options = [path.join(root, ref), path.join(root, 'output/wordbook-phonetics-en-gb-audio-20261026-v1', ref)];
    const file = options.find(file => fs.existsSync(file));
    if (!file) { issues.push({ type: 'missing-asset', ref, kind }); return; }
    let value = assets.get(ref);
    if (!value) {
      const bytes = fs.readFileSync(file);
      value = { ref, path: file, bytes: bytes.length, sha256: hash(bytes), kind };
      assets.set(ref, value);
      const nameHash = path.basename(ref).match(/^([a-f0-9]{64})\./)?.[1];
      if (nameHash && nameHash !== value.sha256) issues.push({ type: 'asset-filename-hash', ref });
      if (kind === 'image' && value.bytes >= 20000) issues.push({ type: 'image-size', ref, bytes: value.bytes });
    }
    if (expected?.sha256 && expected.sha256 !== value.sha256) issues.push({ type: 'asset-content-hash', ref });
    if (expected?.bytes && expected.bytes !== value.bytes) issues.push({ type: 'asset-byte-count', ref });
  }
  for (const book of report.books) {
    const file = path.join(directory, book.path), candidate = read(file);
    assert.equal(hash(fs.readFileSync(file)), book.candidateSha256);
    assert.equal(candidate.published, false);
    study.validateIndex(candidate.index);
    const refs = new Map(candidate.index.books[0].items.map(ref => [ref.itemId, ref.contentRevision]));
    assert.equal(refs.size, candidate.items.length);
    for (const item of candidate.items) {
      const { contentRevision, ...body } = item;
      assert.equal(hash(JSON.stringify(body)), contentRevision, item.itemId);
      assert.equal(refs.get(item.itemId), contentRevision);
      contract.validateLearning(item, engine);
      items++; if (item.phonetics?.['en-US']) us++; if (item.phonetics?.['en-GB']) gb++;
      const change = byId.get(book.bookId + '\n' + item.itemId);
      if (change) {
        assert.equal(item.word, change.word);
        assert.equal(item.phonetics['en-US'], change.cambridgeUsDisplay);
        assert.equal(change.cambridgeUsRaw.replace(/\./g, ''), change.cambridgeUsDisplay);
        assert.equal(new URL(change.sourceURL).hostname, 'dictionary.cambridge.org');
        if (change.sourceHtml) assert.equal(hash(fs.readFileSync(change.sourceHtml)), change.sourceSha256);
        changed++;
      }
      for (const ref of new Set([...(item.images?.wide || []), ...(item.images?.mobile || [])])) asset(ref, 'image');
      const audio = item.learning?.sentenceAudio;
      if (audio) for (const clip of [audio.audio, ...Object.values(audio.audioByAccent || {})].filter(Boolean)) asset(clip.url, 'audio', clip);
    }
    asset(candidate.index.books[0].catalog?.coverUrl, 'cover');
  }
  assert.equal(changed, changes.length);
  assert.equal(items, 4214); assert.equal(report.books.length, 20);
  const result = { status: issues.length ? 'blocked-by-checks' : 'checks-passed', books: report.books.length, items, usPhonetics: us, gbPhonetics: gb, reviewedNewUsEntries: changed, unresolvedItems: unresolved.length, uniqueAssets: assets.size, issues, approvalSha256: hash(fs.readFileSync(approvalFile)), liveServiceChanged: false, accountDataAccessed: false, published: false };
  fs.mkdirSync(output, { recursive: false });
  fs.writeFileSync(path.join(output, 'readiness.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'assets.json'), JSON.stringify([...assets.values()], null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
  if (issues.length) process.exitCode = 1;
  return result;
}
if (require.main === module) verify(...process.argv.slice(2));
module.exports = { verify };
