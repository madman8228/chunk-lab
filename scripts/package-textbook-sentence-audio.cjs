'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const packageApi = require('./lib/textbook-asset-package.cjs');

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) throw Error(`Missing ${name}`); return args[i + 1]; };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (command, parameters, maxBuffer = 1024 * 1024) => {
  const result = spawnSync(command, parameters, { encoding: 'utf8', windowsHide: true, maxBuffer });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} failed: ${result.stderr}`);
  return result;
};
const ffmpeg = parameters => run('ffmpeg', ['-hide_banner', '-nostdin', ...parameters], 3 * 1024 * 1024).stderr;
const probe = file => JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file]).stdout);
const sentence = item => (item.exercise?.parts || []).map(part => part.text ?? part.answers?.[0] ?? '').join('').trim();
const safeRelative = (base, file) => path.relative(base, file).split(path.sep).join('/');

function main() {
  const sourcePackage = fs.realpathSync(arg('--package'));
  const generationDir = fs.realpathSync(arg('--generation'));
  const archiveRoot = fs.realpathSync(arg('--archive-root'));
  const output = path.resolve(arg('--out'));
  if (fs.existsSync(output)) throw Error(`Refusing to overwrite package revision: ${output}`);
  const source = packageApi.verifyPackage(sourcePackage).manifest;
  const generated = JSON.parse(fs.readFileSync(path.join(generationDir, 'generation-manifest.json'), 'utf8'));
  if (generated.itemCount !== source.counts.items || generated.records.length !== source.counts.items || generated.publishable !== false) throw Error('Sentence generation manifest is incomplete or unexpectedly publishable');
  const snapshotFile = packageApi.inside(sourcePackage, source.content.courseSnapshot);
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  const items = snapshot.drafts.flatMap(draft => draft.items);
  const itemById = new Map(items.map(item => [item.itemId, item]));
  const bindingById = new Map(source.bindings.map(binding => [binding.itemId, binding]));
  const generatedById = new Map(generated.records.map(record => [record.itemId, record]));
  if (generatedById.size !== source.counts.items) throw Error('Duplicate sentence IDs in generation manifest');
  for (const item of items) {
    const row = generatedById.get(item.itemId);
    if (!row || row.kind !== 'sentence' || row.text !== sentence(item) || !row.path.startsWith('masters/')) throw Error(`Sentence text/identity mismatch: ${item.itemId}`);
    const binding = bindingById.get(item.itemId);
    if (!binding || source.audioAssets.some(audio => audio.itemId === item.itemId && audio.kind === 'sentence')) throw Error(`Invalid/duplicate sentence audio binding: ${item.itemId}`);
  }

  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.sentence-audio-package-'));
  try {
    fs.cpSync(sourcePackage, staging, { recursive: true, force: false, errorOnExist: true });
    const manifest = JSON.parse(JSON.stringify(source));
    const stagedSnapshotFile = packageApi.inside(staging, manifest.content.courseSnapshot);
    const stagedSnapshot = JSON.parse(fs.readFileSync(stagedSnapshotFile, 'utf8'));
    const stagedItems = new Map(stagedSnapshot.drafts.flatMap(draft => draft.items).map(item => [item.itemId, item]));
    const manifestFiles = new Map(manifest.files.map(file => [file.path, file]));
    const uniqueFiles = new Map();
    const preparedDir = path.join(generationDir, 'masters', 'prepared');
    const workDir = path.join(generationDir, 'work');
    const deliveryDir = path.join(generationDir, 'delivery');
    fs.mkdirSync(preparedDir, { recursive: true });
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(deliveryDir, { recursive: true });
    const deliveryRows = [];

    for (const [index, item] of items.entries()) {
      const row = generatedById.get(item.itemId);
      const rawPath = path.resolve(generationDir, row.path);
      const rawBytes = fs.readFileSync(rawPath);
      if (hash(rawBytes) !== row.sha256 || rawBytes.length !== row.bytes) throw Error(`Raw master hash mismatch: ${item.itemId}`);
      const silenceLog = ffmpeg(['-i', rawPath, '-af', 'silencedetect=noise=-50dB:d=0.12', '-f', 'null', 'NUL']);
      const segments = [...silenceLog.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration:/g)].map(match => ({ start: Number(match[1]), end: Number(match[2]) }));
      const head = segments.find(segment => segment.start < 0.02);
      const tail = segments.findLast(segment => Math.abs(segment.end - row.durationSeconds) < 0.025);
      const start = head ? Math.max(0, head.end - 0.08) : 0;
      const end = tail ? Math.min(row.durationSeconds, tail.start + 0.16) : row.durationSeconds;
      if (end - start < 0.25) throw Error(`Trimmed sentence too short: ${item.itemId}`);
      const levels = ffmpeg(['-i', rawPath, '-af', `atrim=start=${start}:end=${end},volumedetect`, '-f', 'null', 'NUL']);
      const peakMatch = levels.match(/max_volume: (-?[\d.]+) dB/);
      if (!peakMatch) throw Error(`Peak level unavailable: ${item.itemId}`);
      const gain = -3 - Number(peakMatch[1]);
      const preparedName = path.basename(row.path).replace(/\.wav$/, '-prepared.wav');
      const preparedPath = path.join(preparedDir, preparedName);
      ffmpeg(['-loglevel', 'error', '-n', '-i', rawPath, '-af', `atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,volume=${gain}dB`, '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', preparedPath]);
      const preparedHash = packageApi.hashFile(preparedPath);
      const stagedItem = stagedItems.get(item.itemId);
      const binding = manifest.bindings.find(candidate => candidate.itemId === item.itemId);
      const temporaryOgg = path.join(workDir, `${path.basename(row.path, '.wav')}.ogg`);
      ffmpeg(['-loglevel', 'error', '-n', '-i', preparedPath, '-map_metadata', '-1', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', '-vbr', 'on', '-compression_level', '10', temporaryOgg]);
      const bytes = fs.readFileSync(temporaryOgg);
      const metadata = probe(temporaryOgg);
      if (metadata.streams[0]?.codec_name !== 'opus' || metadata.streams[0]?.channels !== 1 || bytes.toString('ascii', 0, 4) !== 'OggS' || !bytes.includes(Buffer.from('OpusHead'))) throw Error(`Invalid Ogg/Opus output: ${item.itemId}`);
      const durationSeconds = Number(metadata.format.duration);
      if (!(durationSeconds > 0.25 && durationSeconds < 15)) throw Error(`Unexpected sentence duration ${durationSeconds}: ${item.itemId}`);
      const sha256 = hash(bytes), assetId = `sha256:${sha256}`, relative = `audio/delivery/${sha256}.ogg`;
      const localDeliveryPath = path.join(deliveryDir, `${sha256}.ogg`);
      if (!fs.existsSync(localDeliveryPath)) fs.copyFileSync(temporaryOgg, localDeliveryPath, fs.constants.COPYFILE_EXCL);
      deliveryRows.push({ itemId: item.itemId, text: row.text, path: safeRelative(archiveRoot, localDeliveryPath), sha256, bytes: bytes.length, durationSeconds });
      if (manifest.audioAssets.some(audio => audio.assetId === assetId) && !manifest.audioAssets.some(audio => audio.assetId === assetId && audio.kind === 'sentence' && audio.text === row.text)) throw Error(`Audio hash collision across text: ${item.itemId}`);
      if (!uniqueFiles.has(relative)) {
        const target = path.join(staging, ...relative.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(localDeliveryPath, target, fs.constants.COPYFILE_EXCL);
        uniqueFiles.set(relative, { path: relative, sha256, bytes: bytes.length, role: 'sentence-audio', mediaType: 'audio/ogg' });
      }
      fs.rmSync(temporaryOgg);
      const audio = {
        itemId: item.itemId, unitId: item.unitId, kind: 'sentence', text: row.text, assetId, path: relative,
        sha256, bytes: bytes.length, mediaType: 'audio/ogg', sampleRateHz: 24000, channels: 1,
        encoding: 'opus-32kbps-vbr', language: 'en-US', voice: 'af_heart', speed: 1,
        durationSeconds, listeningReview: 'pending-sample',
        localMasterPath: safeRelative(archiveRoot, rawPath), localMasterSha256: row.sha256,
        localPreparedPath: safeRelative(archiveRoot, preparedPath), localPreparedSha256: preparedHash,
      };
      manifest.audioAssets.push(audio);
      binding.audioAssetIds.push(assetId);
      binding.audio.push({ kind: 'sentence', text: row.text, assetId });
      stagedItem.sentenceAudio = { text: row.text, audio: { url: relative, mimeType: 'audio/ogg', bytes: bytes.length, sha256 } };
      if (index % 50 === 49 || index === items.length - 1) console.log(`Packaged ${index + 1}/${items.length} sentence clips`);
    }

    manifest.audioStatus = 'sentence-audio-generated-sample-review-pending';
    manifest.reviews.sentenceAudio = { status: 'pending-sample', items: items.length, voice: 'af_heart', language: 'en-US', automatedIntegrity: 'passed' };
    manifest.packageVersion = path.basename(output);
    manifest.createdAt = new Date().toISOString();
    fs.writeFileSync(stagedSnapshotFile, JSON.stringify(stagedSnapshot, null, 2) + '\n');
    const priorFiles = new Map(manifest.files.map(file => [file.path, file]));
    for (const [relative, file] of uniqueFiles) priorFiles.set(relative, file);
    const snapshotBytes = fs.readFileSync(stagedSnapshotFile);
    const readmePath = path.join(staging, 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8') + `\n## 例句音频\n\n本版为628条已审核英文例句新增独立的美音例句音频（Kokoro af_heart，24 kHz 单声道 Opus 32 kbps）。词目文本逐字绑定，自动文件/哈希/时长校验通过；听感抽样审核待完成。单词音频未更改；本包仅供本地预览，不代表正式发布。\n`;
    fs.writeFileSync(readmePath, readme);
    priorFiles.set(manifest.content.courseSnapshot, { ...priorFiles.get(manifest.content.courseSnapshot), sha256: hash(snapshotBytes), bytes: snapshotBytes.length });
    priorFiles.set('README.md', { ...priorFiles.get('README.md'), sha256: hash(Buffer.from(readme)), bytes: Buffer.byteLength(readme) });
    manifest.files = [...priorFiles.values()].sort((a, b) => a.path.localeCompare(b.path));
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(staging, 'manifest.json'), manifestBytes);
    const checksumRows = [
      { path: 'manifest.json', sha256: hash(manifestBytes), bytes: manifestBytes.length },
      ...manifest.files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
    ].sort((a, b) => a.path.localeCompare(b.path));
    fs.writeFileSync(path.join(staging, 'checksums.json'), JSON.stringify({ format: 'textbook-asset-checksums', schemaVersion: 1, files: checksumRows }, null, 2) + '\n');
    const verified = packageApi.verifyPackage(staging);
    fs.renameSync(staging, output);
    fs.writeFileSync(path.join(generationDir, 'delivery-manifest.json'), JSON.stringify({ format: 'textbook-sentence-audio-delivery', schemaVersion: 1, stage: 'draft', publishable: false, encoding: 'ogg-opus-32kbps-vbr', records: deliveryRows }, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(path.join(generationDir, 'README.md'), '# 九年级全一册 · 例句音频批次\n\n本地 Kokoro af_heart 批次。原始 WAV 与首尾静音整理后的 WAV 保留在 `masters/`；32 kbps Ogg/Opus 文件按内容哈希保存在 `delivery/`。对应文本、模型与文件摘要见 `generation-manifest.json` 和 `delivery-manifest.json`。\n\n当前仅为本地待审草稿；资产包的自动结构与解码检查通过，例句听感抽样审核仍待完成。\n', { flag: 'wx' });
    const totalBytes = manifest.audioAssets.filter(audio => audio.kind === 'sentence').reduce((sum, audio) => sum + audio.bytes, 0);
    console.log(JSON.stringify({ package: output, sentences: items.length, uniqueSentenceFiles: uniqueFiles.size, sentenceAudioBytes: totalBytes, verification: { ok: verified.ok, items: verified.items, audio: verified.audio, files: verified.files }, listeningReview: 'pending-sample', publishable: false }, null, 2));
  } catch (error) {
    throw Error(`${error.message}\nStaging retained for inspection: ${staging}`);
  }
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
