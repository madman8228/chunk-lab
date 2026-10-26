'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function apply(input, manifestFile, output) {
  if (fs.existsSync(output)) throw Error('Output must be new');
  const report = JSON.parse(fs.readFileSync(path.join(input, 'report.json')));
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  if (hash(fs.readFileSync(manifest.source)) !== manifest.sourceSha256) throw Error('Source image changed');
  const book = report.books ? report.books.find(book => book.bookId === manifest.bookId) : { bookId: report.bookId, title: report.title || JSON.parse(fs.readFileSync(report.manifest)).title };
  if (!book || book.title !== manifest.title) throw Error('Book identity mismatch');
  const directory = hash(JSON.stringify(book.bookId));
  const candidatePath = report.books ? path.join(input, directory, 'candidate.json') : path.join(input, 'candidate.json');
  const candidate = JSON.parse(fs.readFileSync(candidatePath));
  if (candidate.index.books[0].bookId !== manifest.bookId || candidate.index.books[0].title !== manifest.title) throw Error('Candidate identity mismatch');
  const changes = [], seen = new Set();
  for (const [word, phonetic] of manifest.entries) {
    if (seen.has(word)) throw Error('Duplicate transcription');
    seen.add(word);
    const matches = candidate.items.filter(item => item.word === word && item.itemId.includes(':' + manifest.unit + ':'));
    if (matches.length !== 1) throw Error('Ambiguous/missing item: ' + word);
    const item = matches[0];
    if (item.phonetic) throw Error('Refusing to overwrite existing source: ' + word);
    if (typeof phonetic !== 'string' || phonetic.length > 200 || !/^\/.+\/$/u.test(phonetic)) throw Error('Invalid phonetic');
    item.phonetic = phonetic;
    const { contentRevision, ...body } = item;
    item.contentRevision = hash(JSON.stringify(body));
    candidate.index.books[0].items.find(ref => ref.itemId === item.itemId).contentRevision = item.contentRevision;
    changes.push({ itemId: item.itemId, word, meaning: item.meaning, phonetic, status: manifest.status });
  }
  candidate.index.books[0].revision = hash(JSON.stringify(candidate.index.books[0].items));
  candidate.published = false;
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'candidate.json'), JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ published: false, title: book.title, input: path.resolve(input), inputCandidateSha256: hash(fs.readFileSync(candidatePath)), manifest: path.resolve(manifestFile), manifestSha256: hash(fs.readFileSync(manifestFile)), source: manifest.source, sourceSha256: manifest.sourceSha256, printedPage: manifest.printedPage, bookId: book.bookId, changes }, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'review.md'), '# 七下第' + manifest.printedPage + '页音标恢复草稿\n\n目视转录，待用户审核，未发布。未给音标的短语不拼接。\n\n| 词项 | 释义 | 教材音标 |\n|---|---|---|\n' + changes.map(row => '| ' + [row.word, row.meaning, row.phonetic].join(' | ') + ' |').join('\n') + '\n', { flag: 'wx' });
  return changes.length;
}
if (require.main === module) console.log('Transcribed source entries: ' + apply(...process.argv.slice(2)));
module.exports = { apply };
