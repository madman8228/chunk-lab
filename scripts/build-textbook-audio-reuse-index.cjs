'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const processingProfile = 'kokoro-24k-mono-opus32k-vbr-voip-trim-80ms-160ms-peak-minus3db-v1';

function findBatches(root) {
  const batches = [];
  for (const book of fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const audioRoot = path.join(root, book.name, 'audio-batches');
    if (!fs.existsSync(audioRoot)) continue;
    for (const batch of fs.readdirSync(audioRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
      const dir = path.join(audioRoot, batch.name);
      if (fs.existsSync(path.join(dir, 'delivery-manifest.json')) || fs.existsSync(path.join(dir, 'manifest.json'))) batches.push({ book: book.name, name: batch.name, dir });
    }
  }
  return batches;
}

function main() {
  const root = fs.realpathSync(option('--root'));
  const output = path.resolve(option('--out'));
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite reuse index: ${output}`);
  const candidates = [];
  const sources = [];
  for (const batch of findBatches(root)) {
    const deliveryFile = path.join(batch.dir, 'delivery-manifest.json');
    const archiveFile = path.join(batch.dir, 'manifest.json');
    let rows, metadata, format;
    if (fs.existsSync(deliveryFile)) {
      const manifest = JSON.parse(fs.readFileSync(deliveryFile, 'utf8'));
      if (!['textbook-audio-delivery', 'textbook-sentence-audio-delivery'].includes(manifest.format) || manifest.publishable !== false) continue;
      rows = manifest.records;
      metadata = manifest;
      format = manifest.format;
    } else {
      const manifest = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
      if (manifest.format !== 'textbook-audio-originals-archive') continue;
      rows = manifest.records;
      metadata = manifest;
      format = manifest.format;
    }
    const queuePath = path.join(batch.dir, 'audio-task-queue.json');
    const generationPath = path.join(batch.dir, 'generation-manifest.json');
    const queue = fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, 'utf8')) : null;
    const generation = fs.existsSync(generationPath) ? JSON.parse(fs.readFileSync(generationPath, 'utf8')) : null;
    const tasks = new Map((queue?.tasks || []).flatMap(task => [[task.taskId, task], [task.itemId, task]]));
    const masters = new Map((generation?.records || []).flatMap(row => [[row.taskId, row], [row.itemId, row]]));
    for (const row of rows || []) {
      const kind = row.kind || (format === 'textbook-sentence-audio-delivery' ? 'sentence' : '');
      const spokenText = row.spokenText ?? row.text;
      if (!['word', 'sentence'].includes(kind) || typeof spokenText !== 'string' || !spokenText.trim()) continue;
      const sourceTask = tasks.get(row.taskId) || tasks.get(row.itemId) || null;
      const sourceMaster = masters.get(row.taskId) || masters.get(row.itemId) || null;
      const meaning = sourceTask?.meaning ?? row.meaning ?? '';
      const phonemes = sourceMaster?.phonemes ?? row.phonemes ?? row.phonetic ?? '';
      const voice = row.voice || metadata.voice || 'af_heart';
      const language = row.language || metadata.language || 'en-US';
      const speed = Number(row.speed ?? metadata.speed ?? 1);
      const modelSha256 = metadata.model?.sha256 || generation?.model?.sha256 || '';
      const voicesSha256 = metadata.voices?.sha256 || generation?.voices?.sha256 || '';
      const profile = row.encoding || metadata.encoding || processingProfile;
      const keyParts = [kind, spokenText, meaning, phonemes, language, voice, speed, modelSha256, voicesSha256, profile];
      const reuseKey = sha256(Buffer.from(JSON.stringify(keyParts), 'utf8'));
      const relativePath = row.deliveryPath || row.path;
      if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) continue;
      const relativeParts = relativePath.split(/[\\/]/);
      const bookRoot = path.dirname(path.dirname(batch.dir));
      const file = [path.resolve(batch.dir, ...relativeParts), path.resolve(bookRoot, ...relativeParts)]
        .find(candidate => fs.existsSync(candidate) && (candidate.startsWith(batch.dir + path.sep) || candidate.startsWith(bookRoot + path.sep)));
      if (!file) continue;
      const fileHash = row.deliverySha256 || row.sha256;
      if (!/^[a-f0-9]{64}$/.test(fileHash || '') || sha256(fs.readFileSync(file)) !== fileHash) continue;
      candidates.push({
        reuseKey, kind, spokenText, meaning, phonemes, language, voice, speed,
        modelSha256, voicesSha256, processingProfile: profile,
        bookId: metadata.bookId || metadata.book?.bookId || metadata.book || null,
        batch: `${batch.book}/${batch.name}`, taskId: row.taskId || row.itemId || null,
        path: file, sha256: fileHash, bytes: fs.statSync(file).size,
      });
    }
    sources.push({ batch: `${batch.book}/${batch.name}`, format, entries: (rows || []).length, indexed: candidates.filter(row => row.batch === `${batch.book}/${batch.name}`).length });
  }
  const groups = new Map();
  for (const candidate of candidates) {
    if (!groups.has(candidate.reuseKey)) groups.set(candidate.reuseKey, []);
    groups.get(candidate.reuseKey).push(candidate);
  }
  const records = [...groups.entries()].map(([reuseKey, group]) => ({
    reuseKey,
    kind: group[0].kind,
    spokenText: group[0].spokenText,
    meaning: group[0].meaning,
    phonemes: group[0].phonemes,
    language: group[0].language,
    voice: group[0].voice,
    speed: group[0].speed,
    modelSha256: group[0].modelSha256,
    voicesSha256: group[0].voicesSha256,
    processingProfile: group[0].processingProfile,
    candidates: group,
  }));
  const index = {
    format: 'textbook-audio-reuse-index', schemaVersion: 1,
    stage: 'local-only-read-only-catalog', publishable: false,
    createdAt: new Date().toISOString(),
    keyPolicy: ['kind', 'exact spokenText', 'source meaning for words', 'phoneme trace', 'language', 'voice', 'speed', 'model/voices SHA-256', 'encoding/processing profile'],
    counts: {
      sourceBatches: sources.length, candidates: candidates.length, reuseKeys: records.length,
      keysWithMultipleCandidates: records.filter(row => row.candidates.length > 1).length,
      verifiedCandidateFiles: candidates.length,
    },
    sources, records,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(index, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ index: output, ...index.counts }, null, 2));
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
