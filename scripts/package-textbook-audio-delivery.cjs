'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) throw Error(`Missing ${name}`); return args[i + 1]; };
const optional = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashFile = file => hash(fs.readFileSync(file));
const run = (tool, parameters) => {
  const result = spawnSync(tool, parameters, { encoding: 'utf8', windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${tool} failed: ${result.stderr}`);
  return result;
};
const ffmpeg = parameters => run('ffmpeg', ['-hide_banner', '-nostdin', ...parameters]).stderr;
const probe = file => JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file]).stdout);

function validateBatch(queue, generation, kind = 'word') {
  if (!['word', 'sentence'].includes(kind)) throw Error(`Unsupported audio kind: ${kind}`);
  if (queue.format !== 'textbook-audio-task-queue' || generation.format !== 'textbook-audio-masters' || queue.publishable !== false || generation.publishable !== false) throw Error('Unsupported or publishable input');
  const tasks = new Map(queue.tasks.map(task => [task.taskId, task]));
  if (tasks.size !== queue.tasks.length) throw Error('Duplicate task IDs in queue');
  const kindTasks = queue.tasks.filter(task => task.kind === kind);
  const readyTasks = kindTasks.filter(task => task.status === 'ready');
  if (readyTasks.length) throw Error(`Generation is incomplete: ${readyTasks.length} ${kind} task(s) remain ready`);
  const generatedTasks = kindTasks.filter(task => task.status === 'generated');
  if (!generatedTasks.length) throw Error(`No generated ${kind} tasks to package`);
  if (kind === 'word' && generatedTasks.length !== queue.counts.wordTasks) throw Error('Word generation is incomplete');
  const records = generation.records;
  const recordById = new Map(records.map(row => [row.taskId, row]));
  if (records.length !== generatedTasks.length || recordById.size !== records.length) throw Error('Generation records are incomplete or duplicated');
  for (const row of records) {
    const task = tasks.get(row.taskId);
    if (!task || row.kind !== kind || task.kind !== kind || task.status !== 'generated' || task.inputFingerprint !== row.inputFingerprint || task.spokenText !== row.text || task.itemId !== row.itemId) throw Error(`Task/text mismatch: ${row.taskId}`);
    if (kind === 'sentence') {
      const approved = (queue.approvals || []).some(approval => approval.status === 'user-approved'
        && approval.bookId === queue.book.bookId
        && approval.sourceVocabularySha256 === queue.source.sha256
        && approval.unitId === task.unitId
        && approval.approvedItemIds.includes(task.itemId));
      if (!approved) throw Error(`Sentence task has no matching user approval record: ${row.taskId}`);
    }
  }
  return { records, taskCount: generatedTasks.length };
}

function main() {
  const batch = fs.realpathSync(option('--batch'));
  const kind = optional('--kind', 'word');
  const queuePath = path.join(batch, 'audio-task-queue.json');
  const generationPath = path.join(batch, 'generation-manifest.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const generation = JSON.parse(fs.readFileSync(generationPath, 'utf8'));
  const { records } = validateBatch(queue, generation, kind);

  const finalNames = ['prepared', 'delivery', 'delivery-manifest.json'];
  for (const name of finalNames) if (fs.existsSync(path.join(batch, name))) throw Error(`Refusing to overwrite existing delivery output: ${name}`);
  const staging = fs.mkdtempSync(path.join(batch, '.audio-delivery-stage-'));
  const preparedDir = path.join(staging, 'prepared');
  const deliveryDir = path.join(staging, 'delivery');
  fs.mkdirSync(preparedDir);
  fs.mkdirSync(deliveryDir);
  const deliveryRecords = [];
  const files = new Map();

  try {
    for (const [index, row] of records.entries()) {
      const raw = path.resolve(batch, row.path);
      if (!raw.startsWith(batch + path.sep) || hashFile(raw) !== row.sha256 || fs.statSync(raw).size !== row.bytes) throw Error(`Master hash/path mismatch: ${row.taskId}`);
      const analysis = ffmpeg(['-i', raw, '-af', 'silencedetect=noise=-50dB:d=0.12,volumedetect', '-f', 'null', 'NUL']);
      const segments = [...analysis.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration:/g)].map(match => ({ start: Number(match[1]), end: Number(match[2]) }));
      const head = segments.find(segment => segment.start < 0.02);
      const tail = segments.findLast(segment => Math.abs(segment.end - row.durationSeconds) < 0.025);
      const trimStartSeconds = head ? Math.max(0, head.end - 0.08) : 0;
      const trimEnd = tail ? Math.min(row.durationSeconds, tail.start + 0.16) : row.durationSeconds;
      const peak = analysis.match(/max_volume: (-?[\d.]+) dB/);
      if (!peak || trimEnd - trimStartSeconds < 0.12) throw Error(`Invalid silence/peak analysis: ${row.taskId}`);
      const gain = -3 - Number(peak[1]);
      const taskKey = crypto.createHash('sha256').update(row.taskId).digest('hex').slice(0, 20);
      const preparedRelative = `prepared/${taskKey}-prepared.wav`;
      const preparedPath = path.join(staging, preparedRelative);
      const temporaryOgg = path.join(staging, 'work-' + taskKey + '.ogg');
      ffmpeg(['-loglevel', 'error', '-n', '-i', raw,
        '-af', `atrim=start=${trimStartSeconds}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${gain}dB,aresample=24000`,
        '-ac', '1', '-map_metadata', '-1', '-c:a', 'pcm_s16le', preparedPath,
        '-af', `atrim=start=${trimStartSeconds}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${gain}dB,aresample=24000`,
        '-ac', '1', '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', '-vbr', 'on', '-compression_level', '10', temporaryOgg]);
      const bytes = fs.readFileSync(temporaryOgg);
      const metadata = probe(temporaryOgg);
      const durationSeconds = Number(metadata.format.duration);
      if (metadata.streams[0]?.codec_name !== 'opus' || metadata.streams[0]?.channels !== 1 || bytes.toString('ascii', 0, 4) !== 'OggS' || !bytes.includes(Buffer.from('OpusHead')) || !(durationSeconds >= 0.12 && durationSeconds < 12)) throw Error(`Invalid Opus delivery: ${row.taskId}`);
      const sha256 = hash(bytes);
      const relative = `delivery/${sha256}.ogg`;
      if (!files.has(relative)) {
        fs.copyFileSync(temporaryOgg, path.join(staging, relative), fs.constants.COPYFILE_EXCL);
        files.set(relative, { sha256, bytes: bytes.length });
      }
      fs.rmSync(temporaryOgg);
      deliveryRecords.push({
        taskId: row.taskId, bookId: row.bookId, unitId: row.unitId, itemId: row.itemId,
        kind, displayText: row.displayText, spokenText: row.text,
        pronunciationRule: row.pronunciationRule, language: row.language, voice: row.voice, speed: row.speed,
        format: 'audio/ogg; codecs=opus', encoding: 'opus-32kbps-vbr',
        deliveryPath: relative, deliverySha256: sha256, deliveryBytes: bytes.length,
        durationSeconds, masterPath: row.path, masterSha256: row.sha256, masterBytes: row.bytes,
        preparedPath: preparedRelative, preparedSha256: hashFile(preparedPath), preparedBytes: fs.statSync(preparedPath).size,
        trimStartSeconds, trimEndSeconds: row.durationSeconds - trimEnd,
        listeningReview: 'pending-sample',
      });
      if ((index + 1) % 50 === 0 || index === records.length - 1) console.log(`Packaged ${index + 1}/${records.length} ${kind} clips`);
    }
    const manifest = {
      format: kind === 'word' ? 'textbook-audio-delivery' : 'textbook-sentence-audio-delivery', schemaVersion: 1, stage: 'draft', publishable: false,
      bookId: queue.book.bookId, book: queue.book, sourceSha256: queue.source.sha256,
      voice: generation.voice, language: generation.language, encoding: 'mono-opus-32kbps-vbr', sampleRateHz: 24000,
      counts: { [`${kind}Bindings`]: deliveryRecords.length, uniqueFiles: files.size, reusedBindings: deliveryRecords.length - files.size },
      records: deliveryRecords, files: [...files.entries()].map(([assetPath, file]) => ({ path: assetPath, ...file })),
    };
    fs.writeFileSync(path.join(staging, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    for (const name of ['prepared', 'delivery']) fs.renameSync(path.join(staging, name), path.join(batch, name));
    fs.renameSync(path.join(staging, 'delivery-manifest.json'), path.join(batch, 'delivery-manifest.json'));
    fs.rmSync(staging, { recursive: true, force: true });
    console.log(JSON.stringify({ batch, bookId: queue.book.bookId, kind, bindings: deliveryRecords.length, uniqueOpusFiles: files.size, bytes: [...files.values()].reduce((sum, file) => sum + file.bytes, 0), encoding: manifest.encoding, publishable: false }, null, 2));
  } catch (error) {
    throw Error(`${error.message}\nStaging retained for inspection: ${staging}`);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { validateBatch };
