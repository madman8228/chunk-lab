'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
async function main() {
  require('../server/loadenv');
  const output = path.join(root, 'output/wordbook-us-ipa-publication-20261026-v2');
  const result = JSON.parse(fs.readFileSync(path.join(output, 'result.json')));
  assert.equal(result.status, 'published-and-verified');
  const publishedRoot = path.join(path.resolve(process.env.CHUNKLAB_DATA_DIR || path.join(root, 'server/data')), 'wordbook-publications');
  const versions = require('../server/services/public-wordbook-versions').createPublicWordbookVersions({ publishedRoot });
  const content = require('../server/services/vocabulary-content').createVocabularyContent({ appRoot: root, publishedRoot, versions });
  const express = require('../server/node_modules/express'), app = express();
  require('../server/routes/wordbooks').registerWordbookRoutes({ app, content, auth: { authenticate: (req, res) => res.status(401).json({ error: 'No account access in read-only verification' }) }, study: {} });
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const checks = [];
  try {
    for (const row of result.books) {
      const book = content.book(row.bookId);
      const expected = JSON.parse(fs.readFileSync(path.join(versions.directory(row.bookId), 'releases', row.releaseId, 'package.json')));
      assert.deepEqual(book, expected.index.books[0]);
      const samples = [expected.items[0], expected.items.find(item => item.phonetics?.['en-US'] && item.learning?.sentenceAudio?.audioByAccent?.['en-GB'])].filter(Boolean);
      for (const item of samples) {
        const response = await fetch(url + '/api/vocabulary-items/' + encodeURIComponent(item.itemId) + '?revision=' + item.contentRevision);
        assert.equal(response.status, 200);
        const actual = await response.json();
        assert.deepEqual(actual.phonetics, item.phonetics);
        assert.deepEqual(actual.learning?.sentenceAudio, item.learning?.sentenceAudio);
        for (const clip of [actual.learning?.sentenceAudio?.audio, actual.learning?.sentenceAudio?.audioByAccent?.['en-GB']].filter(Boolean)) assert.ok(fs.existsSync(path.join(root, clip.url)));
      }
      checks.push({ bookId: row.bookId, samples: samples.length, publicRoute: 'passed', revision: book.revision });
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
  let liveStatus;
  try { const response = await fetch('http://127.0.0.1:8787/', { signal: AbortSignal.timeout(3000) }); liveStatus = response.status; }
  catch (error) { liveStatus = error.cause?.code || error.message; }
  fs.writeFileSync(path.join(output, 'public-read-verification.json'), JSON.stringify({ status: 'passed', books: checks, readOnlyVerificationPort: new URL(url).port, verificationServerClosed: true, live8787: liveStatus, accountAccess: false }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'passed', books: checks.length, live8787: liveStatus, accountAccess: false }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
