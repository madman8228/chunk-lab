'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { dictionary } = require('./prepare-wordbook-phonetics-supplement.cjs');
const { key } = require('./supplement-wordbook-phonetics.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function sourceProfile(rows) {
  const originals = rows.filter(row => row.status === 'previously-source-verified');
  const evidence = originals.filter(row => /əʊ|ɒ|\(r\)|ɜː|ɑːft/.test(row.phonetic));
  return { status: evidence.length ? 'british-features-observed-pending-textbook-confirmation' : 'unconfirmed',
    originalCount: originals.length, evidence: evidence.map(row => ({ itemId: row.itemId, word: row.word, phonetic: row.phonetic })),
    rule: 'Preserve source verbatim, including explicitly labelled British/American alternatives. Features do not authorize wholesale conversion.' };
}
function repair(input, output) {
  if (fs.existsSync(output)) throw Error('Use a new output directory');
  const bytes = fs.readFileSync(input), prior = JSON.parse(bytes), root = path.dirname(input);
  const plan = JSON.parse(fs.readFileSync(prior.sourcePlan));
  const dictionaryBytes = fs.readFileSync(path.join(path.dirname(prior.sourcePlan), 'en_UK.txt'));
  if (hash(dictionaryBytes) !== plan.dictionary.sha256) throw Error('Dictionary hash mismatch');
  const gb = dictionary(dictionaryBytes), books = [], packages = [];
  for (const book of prior.books) {
    const directory = hash(JSON.stringify(book.bookId)), candidate = JSON.parse(fs.readFileSync(path.join(root, directory, 'candidate.json')));
    const profile = sourceProfile(book.changes), changes = new Map(book.changes.map(row => [row.itemId, row]));
    const rows = [];
    for (const item of candidate.items) {
      const previous = changes.get(item.itemId);
      if (!previous || item.phonetic !== previous.phonetic) throw Error('Draft item does not match review source');
      if (previous.status === 'previously-source-verified') {
        rows.push({ itemId: item.itemId, word: item.word, original: item.phonetic, status: 'source-preserved-not-reverified' });
        continue;
      }
      // Quarantine only generated supplement fields in a NEW draft; never touch source packages.
      const withdrawn = item.phonetic;
      delete item.phonetic;
      const { contentRevision, ...body } = item;
      item.contentRevision = hash(JSON.stringify(body));
      const ref = candidate.index.books[0].items.find(ref => ref.itemId === item.itemId);
      ref.contentRevision = item.contentRevision;
      const variants = profile.evidence.length ? gb.get(key(item.word)) : undefined;
      rows.push({ itemId: item.itemId, word: item.word, meaning: item.meaning, withdrawn,
        suggestion: variants?.length ? variants.map(ipa => '/' + ipa + '/') : null,
        suggestionSource: variants?.length ? plan.dictionary : null,
        status: variants?.length ? 'british-dictionary-candidate-pending-source-and-sense-review' : 'pending-textbook-evidence',
        note: 'No token concatenation, global IPA substitution, invented pronunciation, or unverified US fallback.' });
    }
    candidate.index.books[0].revision = hash(JSON.stringify(candidate.index.books[0].items));
    candidate.published = false;
    packages.push({ directory, candidate });
    books.push({ bookId: book.bookId, title: book.title, profile, rows });
  }
  const rows = books.flatMap(book => book.rows);
  if (rows.length !== prior.totals.items) throw Error('Incomplete inventory');
  const report = { format: 'textbook-standard-phonetics-repair-draft', published: false,
    input: path.resolve(input), inputSha256: hash(bytes),
    note: '安全修订草稿，不可作为完成稿发布。原标保留；撤下旧草稿中未经核准的自动补充，旧稿和原件均保留。英式词典候选尚未写入课程字段，不冒充教材转录。',
    totals: { books: books.length, items: rows.length, preserved: rows.filter(row => row.status === 'source-preserved-not-reverified').length,
      withdrawnUnverified: rows.filter(row => row.withdrawn).length, dictionaryCandidates: rows.filter(row => row.suggestion).length,
      pendingEvidence: rows.filter(row => row.status === 'pending-textbook-evidence').length }, books };
  fs.mkdirSync(output, { recursive: true });
  for (const entry of packages) {
    fs.mkdirSync(path.join(output, entry.directory));
    fs.writeFileSync(path.join(output, entry.directory, 'candidate.json'), JSON.stringify(entry.candidate, null, 2) + '\n', { flag: 'wx' });
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  fs.writeFileSync(path.join(output, 'review.md'), '# 教材标准修复草稿\n\n' + report.note + '\n\n' + JSON.stringify(report.totals) + '\n\n| 课程 | 词项 | 原标/撤下的自动补充 | 候选（未采用） | 状态 |\n|---|---|---|---|---|\n' + books.flatMap(book => book.rows.map(row => '| ' + [book.title, row.word, row.original || row.withdrawn, row.suggestion?.join('；') || '—', row.status].map(escape).join(' | ') + ' |')).join('\n') + '\n', { flag: 'wx' });
  return report;
}
if (require.main === module) console.log(JSON.stringify(repair(process.argv[2], process.argv[3]).totals, null, 2));
module.exports = { repair, sourceProfile };
