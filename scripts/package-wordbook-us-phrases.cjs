'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const contract = require('../js/vocabulary-course-contract');
const study = require('../js/vocabulary-study.cjs');
const sentenceEngine = require('../landing/sentence-cloze-engine');

const root = path.resolve(__dirname, '..');
const defaultSource = path.join(root, 'output/wordbook-phonetics-en-gb-audio-20261026-v1/draft-candidates/4b3f99fdf9e0da95bcd561f6491075958e634f910136da6e921e696c3525899a/candidate.json');
const defaultBatch = path.join(root, 'docs/source-materials/wordbook-us-phrase-batch-20261026.json');
const defaultOutput = path.join(root, 'output/wordbook-us-phrases-20261026-v1');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => hash(Buffer.from(JSON.stringify(value)));
const sourceListSha = 'd52a55373cb7ef7f30bc545fea33d9fb05cef6ece60b54000843c9c37d8a14cb';
const expected = new Map([
  ['textbook-item:primary-jingtong-grade3-upper-20261014:unit-1:entry:019', { word: 'Good morning!', meaning: '早上好！上午好！', ipa: '/ˌɡʊd ˈmɔːrnɪŋ/' }],
  ['textbook-item:primary-jingtong-grade3-upper-20261014:unit-1:entry:020', { word: 'Good afternoon!', meaning: '下午好！', ipa: '/ˌɡʊd ˌæftɚˈnuːn/' }],
  ['textbook-item:primary-jingtong-grade3-upper-20261014:unit-1:entry:021', { word: 'Good evening!', meaning: '晚上好！', ipa: '/ˌɡʊd ˈiːvnɪŋ/' }],
  ['textbook-item:primary-jingtong-grade3-upper-20261014:unit-1:entry:023', { word: 'Good night!', meaning: '晚安！', ipa: '/ˌɡʊd ˈnaɪt/' }],
  ['textbook-item:primary-jingtong-grade3-upper-20261014:unit-2:entry:025', { word: 'Thank you!', meaning: '谢谢你！', ipa: '/ˈθæŋk ˌjuː/' }]
]);

function buildCandidate(sourceBytes, batch) {
  const sourceSha256 = hash(sourceBytes);
  if (sourceSha256 !== sourceListSha || batch.sourceSha256 !== sourceSha256) throw Error('Source candidate hash differs from the approved batch manifest');
  if (batch.bookId !== 'textbook-wordbook:primary-jingtong-grade3-upper-20261014' || batch.published !== false || batch.status !== 'source-checked-pending-user-review') throw Error('Batch identity or review status is invalid');
  const source = JSON.parse(sourceBytes.toString('utf8'));
  if (source.published !== false || source.index?.books?.length !== 1 || source.index.books[0].bookId !== batch.bookId) throw Error('Source package identity or publication state is invalid');
  if (!Array.isArray(source.items) || source.items.length !== 136 || batch.items.length !== expected.size) throw Error('Source item count or batch size differs from the reviewed plan');
  const requested = new Map(batch.items.map(row => [row.itemId, row]));
  if (requested.size !== expected.size || [...expected.keys()].some(id => !requested.has(id))) throw Error('Batch item IDs do not match the reviewed set');
  const candidate = structuredClone(source);
  const changes = [];
  for (const [itemId, rule] of expected) {
    const row = requested.get(itemId);
    const item = candidate.items.find(value => value.itemId === itemId);
    if (!item || row.word !== rule.word || row.meaning !== rule.meaning || item.word !== rule.word || item.meaning !== rule.meaning || row.displayIPA !== rule.ipa) throw Error(`Reviewed item identity mismatch: ${itemId}`);
    if (item.phonetics?.['en-US']) throw Error(`American IPA already exists: ${itemId}`);
    const sourceRevision = item.contentRevision;
    item.phonetics = { ...(item.phonetics || {}), 'en-US': row.displayIPA };
    const { contentRevision, ...body } = item;
    item.contentRevision = jsonHash(body);
    const ref = candidate.index.books[0].items.find(value => value.itemId === itemId);
    if (!ref) throw Error(`Missing package index reference: ${itemId}`);
    ref.contentRevision = item.contentRevision;
    changes.push({ itemId, word: item.word, meaning: item.meaning, sourceIPA: row.sourceIPA, displayIPA: row.displayIPA, sourceURL: row.sourceURL, sourceSection: batch.sourceSection, conventionId: batch.conventionId, status: batch.status, sourceContentRevision: sourceRevision, contentRevision: item.contentRevision });
  }
  candidate.index.books[0].revision = jsonHash(candidate.index.books[0].items);
  study.validateIndex(candidate.index);
  for (const item of candidate.items) contract.validateLearning(item, sentenceEngine);
  candidate.published = false;
  return { candidate, changes, sourceSha256, outputSha256: hash(Buffer.from(JSON.stringify(candidate, null, 2) + '\n')) };
}

function packageBatch({ sourcePath = defaultSource, batchPath = defaultBatch, outputPath = defaultOutput } = {}) {
  const sourceBytes = fs.readFileSync(sourcePath);
  const batchBytes = fs.readFileSync(batchPath);
  const batch = JSON.parse(batchBytes.toString('utf8'));
  const built = buildCandidate(sourceBytes, batch);
  const output = path.resolve(outputPath);
  const staging = output + '.staging';
  if (fs.existsSync(output) || fs.existsSync(staging)) throw Error('Output or staging directory already exists; refusing to overwrite');
  const report = {
    format: 'wordbook-us-phrase-ipa-review-report', schemaVersion: 1, published: false,
    stage: 'pending-user-review', bookId: batch.bookId, title: batch.bookTitle,
    sourcePath: path.resolve(sourcePath), sourceSha256: built.sourceSha256,
    sourceManifestPath: path.resolve(batchPath), sourceManifestSha256: hash(batchBytes),
    candidatePath: 'candidate.json', candidateSha256: built.outputSha256,
    conventionId: batch.conventionId, britishAudioListeningApproved: true,
    summary: { totalItems: built.candidate.items.length, americanPhraseIPAAdded: built.changes.length, otherItemsChanged: 0, processedPhraseBacklog: 'five selected entries only' },
    changes: built.changes,
    excluded: { multiplePronunciationAndProperNameReview: 'not requested', otherPhraseEntries: 'not processed', legacyAmericanDraft: 'preserved without migration' }
  };
  fs.mkdirSync(staging, { recursive: false });
  try {
    fs.writeFileSync(path.join(staging, 'candidate.json'), JSON.stringify(built.candidate, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(path.join(staging, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(staging, output);
  } catch (error) {
    throw error;
  }
  return { output, report };
}

if (require.main === module) {
  try { const result = packageBatch(); console.log(JSON.stringify({ output: result.output, ...result.report.summary, published: false }, null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildCandidate, packageBatch, defaultSource, defaultBatch, defaultOutput, expected };
