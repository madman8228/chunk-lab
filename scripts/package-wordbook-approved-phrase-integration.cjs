'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const study = require('../js/vocabulary-study.cjs');
const contract = require('../js/vocabulary-course-contract');
const sentenceEngine = require('../landing/sentence-cloze-engine');

const root = path.resolve(__dirname, '..');
const britishRoot = path.join(root, 'output/wordbook-phonetics-en-gb-audio-20261026-v1');
const britishCandidates = path.join(britishRoot, 'draft-candidates');
const phraseRoot = path.join(root, 'output/wordbook-us-phrases-20261026-v1');
const phrasePackagePath = path.join(phraseRoot, 'candidate.json');
const phraseReportPath = path.join(phraseRoot, 'report.json');
const outRoot = path.join(root, 'output/wordbook-bilingual-phrase-integration-20261026-v1');
const sourceManifestSha = '3eb7b9ebd52978c0340c5bca05603a95c734517209c28f4eaa1aa9143a91d0c6';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => hash(Buffer.from(JSON.stringify(value)));

function main() {
  const gbManifestBytes = fs.readFileSync(path.join(britishCandidates, 'manifest.json'));
  if (hash(gbManifestBytes) !== sourceManifestSha) throw Error('Approved British-audio candidate manifest changed');
  const gbManifest = JSON.parse(gbManifestBytes.toString('utf8'));
  const phraseBytes = fs.readFileSync(phrasePackagePath), phraseReportBytes = fs.readFileSync(phraseReportPath);
  const phraseCandidate = JSON.parse(phraseBytes.toString('utf8'));
  const phraseReport = JSON.parse(phraseReportBytes.toString('utf8'));
  if (phraseCandidate.published !== false || phraseReport.published !== false || phraseReport.changes.length !== 5) throw Error('Phrase review package is invalid');
  if (phraseReport.candidateSha256 !== hash(Buffer.from(JSON.stringify(phraseCandidate, null, 2) + '\n'))) throw Error('Phrase review package does not match its report');
  if (gbManifest.books.length !== 20 || gbManifest.items !== 4214) throw Error('British-audio source package inventory changed');
  if (fs.existsSync(outRoot) || fs.existsSync(outRoot + '.staging')) throw Error('Output or staging folder already exists; refusing to overwrite');

  const phraseChanges = new Map(phraseReport.changes.map(row => [row.itemId, row]));
  if (phraseChanges.size !== 5) throw Error('Approved phrase set contains duplicate items');
  const staged = [], approvalRows = [], assetRoots = [path.join(root, 'assets'), path.join(britishRoot, 'assets')];
  let totalItems = 0, verifiedAudioFiles = 0;
  const resolveAudio = clip => {
    const filename = path.basename(clip.url);
    const file = assetRoots.map(dir => path.join(dir, filename)).find(candidate => fs.existsSync(candidate));
    if (!file) throw Error(`Missing referenced audio: ${clip.url}`);
    const bytes = fs.readFileSync(file);
    if (bytes.byteLength !== clip.bytes || hash(bytes) !== clip.sha256) throw Error(`Audio content mismatch: ${clip.url}`);
    verifiedAudioFiles++;
  };

  for (const entry of gbManifest.books) {
    const relative = entry.path.replace(/^draft-candidates[\\/]/, '');
    const inputPath = path.join(britishCandidates, relative), inputBytes = fs.readFileSync(inputPath);
    const candidate = JSON.parse(inputBytes.toString('utf8'));
    const book = candidate.index?.books?.[0];
    if (!book || book.bookId !== entry.bookId || candidate.published !== false || candidate.items.length !== entry.items) throw Error(`British candidate identity mismatch: ${entry.bookId}`);
    let count = 0;
    for (const item of candidate.items) {
      const approval = phraseChanges.get(item.itemId);
      if (approval) {
        const approvedItem = phraseCandidate.items.find(value => value.itemId === item.itemId);
        if (!approvedItem || approvedItem.word !== item.word || approvedItem.meaning !== item.meaning || approvedItem.phonetics?.['en-US'] !== approval.displayIPA) throw Error(`Approved phrase does not match source item: ${item.itemId}`);
        item.phonetics = { ...(item.phonetics || {}), 'en-US': approval.displayIPA };
        const { contentRevision, ...body } = item;
        item.contentRevision = jsonHash(body);
        const ref = book.items.find(value => value.itemId === item.itemId);
        if (!ref) throw Error(`Missing package ref for ${item.itemId}`);
        ref.contentRevision = item.contentRevision;
        approvalRows.push({ ...approval, userApproval: 'approved-in-chat-2026-10-26' });
        phraseChanges.delete(item.itemId);
      }
      const { contentRevision, ...body } = item;
      if (jsonHash(body) !== contentRevision) throw Error(`Invalid item content revision: ${item.itemId}`);
      const ref = book.items.find(value => value.itemId === item.itemId);
      if (!ref || ref.contentRevision !== contentRevision) throw Error(`Index ref mismatch: ${item.itemId}`);
      if (item.learning?.sentenceAudio) {
        resolveAudio(item.learning.sentenceAudio.audio);
        for (const clip of Object.values(item.learning.sentenceAudio.audioByAccent || {})) resolveAudio(clip);
      }
      count++;
    }
    if (count !== entry.items) throw Error(`Item count mismatch: ${entry.bookId}`);
    book.revision = jsonHash(book.items);
    study.validateIndex(candidate.index);
    for (const item of candidate.items) contract.validateLearning(item, sentenceEngine);
    candidate.published = false;
    totalItems += count;
    staged.push({ bookId: book.bookId, title: book.title, package: candidate, sourcePath: path.relative(root, inputPath).replace(/\\/g, '/'), sourceSha256: hash(inputBytes) });
  }
  if (phraseChanges.size || approvalRows.length !== 5 || totalItems !== 4214) throw Error('Not all approved phrases were integrated exactly once');

  const gbSourceBooks = gbManifest.sourceBooks || [];
  const outputManifest = {
    format: 'wordbook-bilingual-ipa-review-draft', schemaVersion: 1, published: false,
    stage: 'approved-phrase-data-integrated-pending-release-review', accents: ['en-US', 'en-GB'],
    britishListeningApproved: true, approvedPhraseSource: path.relative(root, phraseReportPath).replace(/\\/g, '/'),
    approvedPhraseReportSha256: hash(phraseReportBytes), sourceBritishManifestSha256: sourceManifestSha,
    sourceBooks: staged.map(row => ({ bookId: row.bookId, path: row.sourcePath, sha256: row.sourceSha256 })),
    items: totalItems, americanPhraseIpaItems: approvalRows.length,
    remainingAmericanIpa: 'Not changed by this integration; unresolved or pending entries remain as they were in the British-audio candidates.',
    excludedBooks: gbManifest.excludedBooks,
    assetSources: [
      { path: 'assets/', description: 'Existing stable local assets, including the original American sentence audio.' },
      { path: 'output/wordbook-phonetics-en-gb-audio-20261026-v1/assets/', description: 'Reviewed British sentence audio clips.' }
    ],
    books: staged.map(row => ({ bookId: row.bookId, title: row.title, path: `candidate-packages/${crypto.createHash('sha256').update(row.bookId).digest('hex')}/candidate.json`, items: row.package.items.length, revision: row.package.index.books[0].revision }))
  };
  const approval = { format: 'wordbook-phrase-content-approval', schemaVersion: 1, published: false, approvedAt: '2026-10-26', approvalEvidence: 'User replied “可以，继续” to the five-entry phrase IPA review package.', items: approvalRows };
  const stagingPath = outRoot + '.staging';
  fs.mkdirSync(stagingPath);
  try {
    for (let index = 0; index < staged.length; index++) {
      const row = staged[index], manifestRow = outputManifest.books[index];
      const file = path.join(stagingPath, manifestRow.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(row.package, null, 2) + '\n', { flag: 'wx' });
    }
    fs.writeFileSync(path.join(stagingPath, 'manifest.json'), JSON.stringify(outputManifest, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(path.join(stagingPath, 'phrase-approval.json'), JSON.stringify(approval, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(stagingPath, outRoot);
  } catch (error) {
    throw error;
  }
  console.log(JSON.stringify({ output: path.relative(root, outRoot), books: outputManifest.books.length, items: totalItems, approvedAmericanPhraseItems: approvalRows.length, verifiedSentenceAudioFiles: verifiedAudioFiles, published: false }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { main };
