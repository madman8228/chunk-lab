'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { createPublicWordbookVersions } = require('../server/services/public-wordbook-versions');
const file = process.argv[2], report = JSON.parse(fs.readFileSync(file));
const temp = fs.realpathSync(report.temporaryDataDirectory), tempRoot = fs.realpathSync(os.tmpdir());
assert.equal(path.dirname(temp), tempRoot);
assert(path.basename(temp).startsWith('phonetics-release-check-'));
assert.equal(report.productionChanged, false);
const versions = createPublicWordbookVersions({ publishedRoot: path.join(temp, 'publications') });
for (const book of report.books) {
  assert.equal(versions.current(book.bookId).releaseId, book.temporaryUpdatedRelease);
  versions.activate({ bookId: book.bookId, expectedBaseReleaseId: book.temporaryUpdatedRelease, releaseId: book.temporaryBaseRelease, action: 'rollback', reviewId: 'isolated-rehearsal-only' });
  assert.equal(versions.current(book.bookId).releaseId, book.temporaryBaseRelease);
  versions.activate({ bookId: book.bookId, expectedBaseReleaseId: book.temporaryBaseRelease, releaseId: book.temporaryUpdatedRelease, reviewId: 'isolated-rehearsal-only' });
  assert.equal(versions.current(book.bookId).releaseId, book.temporaryUpdatedRelease);
}
const output = path.join(path.dirname(file), 'rollback.json');
fs.writeFileSync(output, JSON.stringify({ productionChanged: false, temporaryDataDirectory: temp, books: report.books.length, rollbackAndReapply: 'passed' }, null, 2) + '\n', { flag: 'wx' });
console.log('PASS: temporary rollback and reapply for ' + report.books.length + ' books; no production writes.');
