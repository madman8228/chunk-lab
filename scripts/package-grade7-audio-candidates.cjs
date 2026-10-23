'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const workspace = path.resolve(__dirname, '..');
const assetStore = 'E:/chunk-practice-assets';
const sourceStore = 'E:/chunk-practice-asset-sources/textbooks';
const catalogPath = path.join(workspace, 'output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json');
const reviewPath = path.join(workspace, 'output/textbook-sentence-review/review-decisions.json');
const grades = ['upper', 'lower'];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function writeNew(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, { flag: 'wx' });
}
function copyVerified(from, to, expectedHash, expectedBytes) {
  if (hashFile(from) !== expectedHash || fs.statSync(from).size !== expectedBytes) throw new Error('Source hash/size mismatch: ' + from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  if (hashFile(to) !== expectedHash || fs.statSync(to).size !== expectedBytes) throw new Error('Copied file hash/size mismatch: ' + to);
}

const catalog = readJson(catalogPath);
const review = readJson(reviewPath);
const prepared = grades.map(grade => {
  const course = `people-grade7-${grade}-2024-20261015`;
  const bookId = `textbook-wordbook:pep-junior-grade7-${grade}-2024`;
  const shortBook = `pep-junior-grade7-${grade}-2024`;
  const extractionPath = path.join(workspace, 'output/textbook-extractions', course, 'extracted-vocabulary.json');
  const audioRoot = path.join(sourceStore, shortBook, 'audio-batches');
  const wordRoot = path.join(audioRoot, '20261021-audio-queue-v2');
  const sentenceRoot = path.join(audioRoot, '20261022-sentence-audio-v1');
  const wordManifest = readJson(path.join(wordRoot, 'delivery-manifest.json'));
  const sentenceManifest = readJson(path.join(sentenceRoot, 'delivery-manifest.json'));
  const extraction = readJson(extractionPath);
  const out = path.join(assetStore, 'textbooks', shortBook, 'revisions', '20261022-v1');
  if (fs.existsSync(out)) throw new Error('Refusing to overwrite existing candidate: ' + out);
  if (wordManifest.bookId !== bookId || sentenceManifest.bookId !== bookId || extraction.course !== course) throw new Error('Book identity mismatch: ' + bookId);
  if (wordManifest.encoding !== 'mono-opus-32kbps-vbr' || sentenceManifest.encoding !== 'mono-opus-32kbps-vbr') throw new Error('Unexpected audio encoding: ' + bookId);
  const bindings = catalog.bindings.filter(binding => binding.course === course && binding.review === 'pass');
  const assets = new Map(catalog.assets.map(asset => [asset.assetId, asset]));
  const vocabByKey = new Map(extraction.records.map(record => [`${record.term.toLocaleLowerCase()}|${record.meaning}`, record]));
  const bindingByKey = new Map(bindings.map(binding => [`${binding.word.toLocaleLowerCase()}|${binding.meaning}`, binding]));
  const wordAudio = new Map(wordManifest.records.map(record => [record.itemId, record]));
  const sentenceAudio = new Map(sentenceManifest.records.map(record => [record.itemId, record]));
  const approved = new Map();
  for (const event of review.events) if (event.bookId === bookId) approved.set(event.itemId, event);
  const items = wordManifest.records.map(word => {
    if (word.kind !== 'word') throw new Error('Non-word record in word manifest: ' + word.taskId);
    const vocab = extraction.records.find(record => record.entryId === word.itemId);
    if (!vocab || vocab.term.toLocaleLowerCase() !== word.displayText.toLocaleLowerCase()) throw new Error('Word audio does not bind to extracted item: ' + word.itemId);
    const key = `${vocab.term.toLocaleLowerCase()}|${vocab.meaning}`;
    const binding = bindingByKey.get(key);
    if (!binding) throw new Error('No approved illustration binding for ' + vocab.term + ' / ' + vocab.meaning);
    const image = assets.get(binding.assetId);
    if (!image || image.sha256 !== binding.assetId.slice('sha256:'.length) || image.bytes >= 20000 || image.width !== 512 || image.height !== 288) throw new Error('Illustration fails catalog constraints for ' + vocab.term);
    const sentence = sentenceAudio.get(word.itemId);
    const sentenceReview = approved.get(word.itemId);
    if (!sentence || sentence.kind !== 'sentence') throw new Error('Missing sentence audio: ' + word.itemId);
    if (!sentenceReview || sentenceReview.decision !== 'approved' || sentenceReview.text?.english !== sentence.spokenText) throw new Error('Sentence lacks matching approved text: ' + word.itemId);
    for (const record of [word, sentence]) {
      const root = record.kind === 'word' ? wordRoot : sentenceRoot;
      const fullPath = path.join(root, record.deliveryPath);
      if (!fs.existsSync(fullPath) || hashFile(fullPath) !== record.deliverySha256 || fs.statSync(fullPath).size !== record.deliveryBytes) throw new Error('Missing or invalid Opus delivery: ' + fullPath);
    }
    const imageSource = path.join(assetStore, ...image.path.split('/'));
    if (!fs.existsSync(imageSource) || hashFile(imageSource) !== image.sha256 || fs.statSync(imageSource).size !== image.bytes) throw new Error('Missing or invalid approved image: ' + imageSource);
    return { itemId: word.itemId, unitId: word.unitId, word: vocab.term, meaning: vocab.meaning, textbookPage: vocab.textbookPage,
      illustration: { path: `illustrations/${path.basename(image.path)}`, sha256: image.sha256, bytes: image.bytes, width: image.width, height: image.height, catalogAssetId: image.assetId },
      wordAudio: { path: `audio/words/${recordName(word)}`, sha256: word.deliverySha256, bytes: word.deliveryBytes, durationSeconds: word.durationSeconds, text: word.spokenText },
      sentence: { english: sentenceReview.text.english, chinese: sentenceReview.text.chinese },
      sentenceAudio: { path: `audio/sentences/${recordName(sentence)}`, sha256: sentence.deliverySha256, bytes: sentence.deliveryBytes, durationSeconds: sentence.durationSeconds, text: sentence.spokenText },
      audioReview: { status: 'owner-sampled-no-issue-reported', scope: 'sampled items not identified in conversation; not a full-item listening approval' }
    };
  });
  if (items.length !== extraction.records.length || items.length !== bindings.length || items.length !== sentenceManifest.records.length) throw new Error('Item count mismatch for ' + bookId);
  return { grade, course, bookId, shortBook, out, extractionPath, extraction, wordRoot, sentenceRoot, wordManifest, sentenceManifest, items, bindings, assets };
});

function recordName(record) { return `${record.itemId.replaceAll(':', '-')}-${record.deliverySha256.slice(0, 12)}.ogg`; }

for (const book of prepared) {
  const files = [];
  const addFile = (relative, source, hash, bytes, role) => {
    const target = path.join(book.out, ...relative.split('/'));
    copyVerified(source, target, hash, bytes);
    files.push({ path: relative, sha256: hash, bytes, role });
  };
  const content = { format: 'grade7-wordbook-audio-candidate', schemaVersion: 1, bookId: book.bookId, book: book.wordManifest.book, items: book.items };
  const contentBytes = Buffer.from(JSON.stringify(content, null, 2) + '\n', 'utf8');
  writeNew(path.join(book.out, 'course-candidate.json'), contentBytes);
  files.push({ path: 'course-candidate.json', sha256: sha256(contentBytes), bytes: contentBytes.length, role: 'candidate-course-content' });
  const extractionBytes = fs.readFileSync(book.extractionPath);
  writeNew(path.join(book.out, 'sources/extracted-vocabulary.json'), extractionBytes);
  files.push({ path: 'sources/extracted-vocabulary.json', sha256: sha256(extractionBytes), bytes: extractionBytes.length, role: 'source-vocabulary-record' });
  for (const item of book.items) {
    const word = book.wordManifest.records.find(record => record.itemId === item.itemId);
    const sentence = book.sentenceManifest.records.find(record => record.itemId === item.itemId);
    const image = book.assets.get(item.illustration.catalogAssetId);
    addFile(item.wordAudio.path, path.join(book.wordRoot, word.deliveryPath), word.deliverySha256, word.deliveryBytes, 'word-opus');
    addFile(item.sentenceAudio.path, path.join(book.sentenceRoot, sentence.deliveryPath), sentence.deliverySha256, sentence.deliveryBytes, 'sentence-opus');
    addFile(item.illustration.path, path.join(assetStore, ...image.path.split('/')), image.sha256, image.bytes, 'approved-vocabulary-webp');
  }
  const manifest = { format: 'textbook-audio-candidate-package', schemaVersion: 1, packageVersion: '20261022-v1', createdAt: new Date().toISOString(),
    status: 'candidate-awaiting-release-check', publishable: false, bookId: book.bookId, book: book.wordManifest.book,
    audio: { voice: book.wordManifest.voice, language: book.wordManifest.language, encoding: book.wordManifest.encoding, mimeType: 'audio/ogg; codecs=opus', sampleRateHz: book.wordManifest.sampleRateHz,
      wordManifestSha256: hashFile(path.join(book.wordRoot, 'delivery-manifest.json')), sentenceManifestSha256: hashFile(path.join(book.sentenceRoot, 'delivery-manifest.json')) },
    review: { sentenceText: 'all bound sentence texts have approved review records', audio: 'owner reported sampled word and sentence audio had no issues; sample item IDs not supplied; not exhaustive review' },
    counts: { words: book.items.length, sentences: book.items.length, illustrations: book.items.length, uniqueIllustrations: new Set(book.items.map(item => item.illustration.sha256)).size },
    backupReferences: { sourceAudioMasters: 'E:/chunk-practice-asset-sources/textbooks/' + book.shortBook + '/audio-batches/', retainedOutsideGit: true },
    files: files.sort((a, b) => a.path.localeCompare(b.path)) };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  writeNew(path.join(book.out, 'manifest.json'), manifestBytes);
  const checksums = { format: 'textbook-audio-candidate-checksums', schemaVersion: 1,
    files: [{ path: 'manifest.json', sha256: sha256(manifestBytes), bytes: manifestBytes.length }, ...files].sort((a, b) => a.path.localeCompare(b.path)) };
  writeNew(path.join(book.out, 'checksums.json'), JSON.stringify(checksums, null, 2) + '\n');
  writeNew(path.join(book.out, 'README.md'), `# ${book.bookId} audio candidate\n\n此目录是本地待发布候选包，不是已发布课程。包含 ${book.items.length} 条单词 Opus、${book.items.length} 条句子 Opus 与对应共享审核插图。音频试听结论仅记录为抽样无问题，不代表全量逐条听审。\n\n原始 WAV、教材扫描页和生成母版继续保存在 E:\\chunk-practice-asset-sources；它们未复制进此交付包或 Git。发布前仍需执行系统内置课程的最终集成/回归检查并由课程所有者明确批准。\n`);
  for (const entry of checksums.files) {
    const full = path.join(book.out, ...entry.path.split('/'));
    if (!fs.existsSync(full) || fs.statSync(full).size !== entry.bytes || hashFile(full) !== entry.sha256) throw new Error('Final package verification failed: ' + entry.path);
  }
  console.log(JSON.stringify({ package: book.out, bookId: book.bookId, words: book.items.length, sentences: book.items.length,
    illustrations: book.items.length, packageBytes: checksums.files.reduce((total, file) => total + file.bytes, 0), publishable: false }, null, 2));
}
