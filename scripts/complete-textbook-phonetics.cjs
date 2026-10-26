'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const norm = value => String(value).normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const identity = row => norm(row.word) + '\0' + norm(row.meaning);
function uniqueSources(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = identity(row);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return new Map([...map].filter(([, values]) => new Set(values.map(row => row.phonetic)).size === 1));
}
function complete(input, output) {
  if (fs.existsSync(output)) throw Error('Output must be new');
  const report = JSON.parse(fs.readFileSync(path.join(input, 'report.json')));
  const legacyBytes = fs.readFileSync(report.input), legacy = JSON.parse(legacyBytes);
  if (hash(legacyBytes) !== report.inputSha256) throw Error('Input source hash mismatch');
  const approvals = [99, 100, 101].map(page => JSON.parse(fs.readFileSync('docs/source-materials/phonetics-pep7-lower-p' + page + '-approval-20261025.json')));
  const approvedRows = [];
  for (const approval of approvals) {
    const bytes = fs.readFileSync(approval.report);
    if (hash(bytes) !== approval.reportSha256) throw Error('Approved report changed');
    const batch = JSON.parse(bytes);
    if (batch.changes.length !== approval.approvedEntries) throw Error('Approval count mismatch');
    for (const row of batch.changes) approvedRows.push({ ...row, bookId: batch.bookId, source: approval.report, sourceSha256: approval.reportSha256 });
  }
  const sourceRows = legacy.books.flatMap(book => book.changes.filter(row => row.status === 'previously-source-verified').map(row => ({ ...row, bookId: book.bookId, source: report.input, sourceSha256: report.inputSha256 })));
  // Reuse only identical spelling AND meaning, with one unambiguous original transcription.
  const lexicon = uniqueSources([...sourceRows, ...approvedRows]);
  const books = [], packages = [];
  for (const book of report.books) {
    const dir = hash(JSON.stringify(book.bookId));
    const basePath = path.join(input, dir, 'candidate.json');
    const candidate = JSON.parse(fs.readFileSync(basePath));
    const approved = new Map(approvedRows.filter(row => row.bookId === book.bookId).map(row => [row.itemId, row]));
    const changes = [], pending = [];
    for (const item of candidate.items) {
      if (item.phonetic) continue;
      const exact = approved.get(item.itemId);
      if (exact && (exact.word !== item.word || exact.meaning !== item.meaning)) throw Error('Approved identity mismatch');
      const matches = exact ? [exact] : lexicon.get(identity(item));
      // Cross-course reuse excludes explicitly American/mixed notations and proper names.
      const acceptable = exact || matches && !/美|AmE|ɝ|ɚ|oʊ|BrE/.test(matches[0].phonetic) && !/^[A-Z]/.test(item.word);
      if (!acceptable) { pending.push({ itemId: item.itemId, word: item.word, meaning: item.meaning, reason: matches ? 'dialect-or-proper-name-review' : 'needs-authored-or-dictionary-transcription' }); continue; }
      item.phonetic = matches[0].phonetic;
      const { contentRevision, ...body } = item;
      item.contentRevision = hash(JSON.stringify(body));
      candidate.index.books[0].items.find(ref => ref.itemId === item.itemId).contentRevision = item.contentRevision;
      changes.push({ itemId: item.itemId, word: item.word, meaning: item.meaning, phonetic: item.phonetic,
        method: exact ? 'owner-approved-source-restoration' : 'exact-word-and-gloss-source-reuse',
        status: exact ? 'owner-reviewed' : 'pending-owner-review', sources: matches.map(row => ({ bookId: row.bookId, itemId: row.itemId, source: row.source, sourceSha256: row.sourceSha256 })) });
    }
    candidate.index.books[0].revision = hash(JSON.stringify(candidate.index.books[0].items));
    candidate.published = false;
    packages.push({ dir, candidate });
    books.push({ bookId: book.bookId, title: book.title, basePath, baseSha256: hash(fs.readFileSync(basePath)), changes, pending });
  }
  const totals = { books: books.length, items: report.totals.items, preserved: report.totals.preserved, approvedMerged: books.flatMap(b => b.changes).filter(r => r.status === 'owner-reviewed').length, reused: books.flatMap(b => b.changes).filter(r => r.status !== 'owner-reviewed').length, pending: books.reduce((sum, b) => sum + b.pending.length, 0) };
  if (totals.preserved + totals.approvedMerged + totals.reused + totals.pending !== totals.items) throw Error('Inventory mismatch');
  fs.mkdirSync(output, { recursive: true });
  for (const { dir, candidate } of packages) { fs.mkdirSync(path.join(output, dir)); fs.writeFileSync(path.join(output, dir, 'candidate.json'), JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx' }); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ published: false, convention: '教材式IPA；原标保留，精确同词同义复用，不机械拼接，不自动覆盖原标。复用不等于教材逐条引文。', totals, books }, null, 2) + '\n', { flag: 'wx' });
  const escape = x => String(x).replaceAll('|', '\\|');
  fs.writeFileSync(path.join(output, 'review.md'), '# 批量音标补回草稿\n\n未发布；复用项待审核。\n\n' + JSON.stringify(totals) + '\n\n| 课程 | 词项 | 释义 | 音标 | 方法 |\n|---|---|---|---|---|\n' + books.flatMap(b => b.changes.map(r => '| ' + [b.title, r.word, r.meaning, r.phonetic, r.method].map(escape).join(' | ') + ' |')).join('\n') + '\n', { flag: 'wx' });
  return totals;
}
if (require.main === module) console.log(JSON.stringify(complete(...process.argv.slice(2)), null, 2));
module.exports = { identity, uniqueSources, complete };
