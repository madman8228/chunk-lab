'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const packageApi = require('./lib/textbook-asset-package.cjs');
const textbookModel = require('../server/services/textbook-wordbook-package');
const wordbookDraft = require('../js/wordbook-draft');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => hash(Buffer.from(JSON.stringify(value)));
const safeItemFilename = itemId => itemId.replace(/[^A-Za-z0-9._-]/g, '-');
const sentenceText = item => (item.exercise?.parts || []).map(part => part.text ?? part.answers?.[0] ?? '').join('').trim();

async function main() {
  const [sourcePackage, archiveOutput, importOutput] = process.argv.slice(2);
  if (!sourcePackage || !archiveOutput || !importOutput) throw Error('Usage: node scripts/prepare-grade9-sentence-audio-release.cjs <source-v19> <new-v20-archive> <new-publication-candidate>');
  const sourceRoot = fs.realpathSync(sourcePackage);
  const archiveTarget = path.resolve(archiveOutput);
  const importTarget = path.resolve(importOutput);
  if (fs.existsSync(archiveTarget) || fs.existsSync(importTarget)) throw Error('Refusing to overwrite an existing release artifact');
  const verifiedSource = packageApi.verifyPackage(sourceRoot);
  const sourceManifest = verifiedSource.manifest;
  const snapshotRelative = sourceManifest.content.courseSnapshot;
  const sourceSnapshotFile = packageApi.inside(sourceRoot, snapshotRelative);
  const sourceSnapshot = JSON.parse(fs.readFileSync(sourceSnapshotFile, 'utf8'));
  const sourceItems = sourceSnapshot.drafts.flatMap(draft => draft.items);
  const audioByItem = new Map(sourceManifest.audioAssets.filter(asset => asset.kind === 'sentence').map(asset => [asset.itemId, asset]));
  if (sourceItems.length !== 628 || audioByItem.size !== sourceItems.length) throw Error('Expected exactly one sentence audio per Grade 9 item');

  const root = path.resolve(__dirname, '..');
  const publishedRoot = path.join(root, 'server', 'data', 'wordbook-publications');
  const versions = require('../server/services/public-wordbook-versions').createPublicWordbookVersions({ publishedRoot });
  const bookId = sourceSnapshot.book.bookId;
  const base = versions.current(bookId);
  if (base.book.itemCount !== sourceItems.length) throw Error('Active built-in course item count differs from the reviewed package');
  const appRoot = root;
  const candidateParent = path.dirname(importTarget);
  fs.mkdirSync(path.dirname(archiveTarget), { recursive: true });
  fs.mkdirSync(candidateParent, { recursive: true });
  const archiveStage = path.join(path.dirname(archiveTarget), `.grade9-v20-stage-${crypto.randomUUID()}`);
  const importStage = path.join(candidateParent, `.grade9-import-stage-${crypto.randomUUID()}`);
  fs.cpSync(sourceRoot, archiveStage, { recursive: true, errorOnExist: true, force: false });

  try {
    const stagedSnapshotFile = packageApi.inside(archiveStage, snapshotRelative);
    const stagedSnapshot = JSON.parse(fs.readFileSync(stagedSnapshotFile, 'utf8'));
    const stagedItems = stagedSnapshot.drafts.flatMap(draft => draft.items);
    const importSnapshot = structuredClone(stagedSnapshot);
    const importItems = importSnapshot.drafts.flatMap(draft => draft.items);
    const deliveryRows = [];
    const audioFiles = new Map();
    const imageFiles = new Map();

    for (const item of stagedItems) {
      const asset = audioByItem.get(item.itemId);
      if (!asset || asset.text !== sentenceText(item) || !asset.path.startsWith('audio/delivery/')) throw Error(`Audio/text binding mismatch: ${item.itemId}`);
      const audioPath = packageApi.inside(archiveStage, asset.path);
      const bytes = fs.readFileSync(audioPath);
      if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256 || bytes.toString('ascii', 0, 4) !== 'OggS' || !bytes.includes(Buffer.from('OpusHead'))) throw Error(`Invalid Opus payload: ${item.itemId}`);
      item.sentenceAudio = { text: asset.text, audio: { url: asset.path, mimeType: 'audio/ogg', bytes: asset.bytes, sha256: asset.sha256 } };
      const importItem = importItems.find(candidate => candidate.itemId === item.itemId);
      if (!importItem) throw Error(`Missing import item: ${item.itemId}`);
      const filename = `sentence-${safeItemFilename(item.itemId)}-${asset.sha256.slice(0, 12)}.ogg`;
      const importUrl = `assets/${filename}`;
      importItem.sentenceAudio = { text: asset.text, audio: { url: importUrl, mimeType: 'audio/ogg', bytes: asset.bytes, sha256: asset.sha256 } };
      if (!audioFiles.has(filename)) audioFiles.set(filename, { source: audioPath, bytes: asset.bytes, sha256: asset.sha256, url: importUrl });
      deliveryRows.push({ itemId: item.itemId, text: asset.text, url: importUrl, bytes: asset.bytes, sha256: asset.sha256 });
      asset.listeningReview = 'approved-sample';
    }

    fs.writeFileSync(stagedSnapshotFile, JSON.stringify(stagedSnapshot, null, 2) + '\n');
    const approvedAt = '2026-10-21';
    const repairIds = [
      'pep-g9-2013-u2:29', 'pep-g9-2013-u2:41', 'pep-g9-2013-u3:08', 'pep-g9-2013-u3:39',
      'pep-g9-2013-u6:11', 'pep-g9-2013-u6:21', 'pep-g9-2013-u7:05', 'pep-g9-2013-u8:47',
      'pep-g9-2013-u9:01', 'pep-g9-2013-u9:08', 'pep-g9-2013-u9:38', 'pep-g9-2013-u10:22',
    ];
    const approval = {
      format: 'textbook-review-approval', schemaVersion: 1, reviewedAt: approvedAt,
      sentenceAudio: { status: 'approved-sample', items: 628, voice: 'af_heart', language: 'en-US', individuallyListened: false, note: 'Owner confirmed review in the local preview; this records sample approval, not individual listening to every clip.' },
      imageRepairs: { status: 'approved', itemIds: repairIds, note: 'Owner confirmed the textbook course review was complete after the reported illustration fixes.' },
      phonetics: { status: 'accepted-with-owner-deferred-gaps', intentionallyUnfilled: 9 },
    };
    const approvalRelative = 'reviews/20261021-release-review-approval.json';
    fs.writeFileSync(path.join(archiveStage, ...approvalRelative.split('/')), JSON.stringify(approval, null, 2) + '\n', { flag: 'wx' });
    sourceManifest.audioStatus = 'sentence-audio-sample-approved';
    sourceManifest.reviews.sentenceAudio = { ...approval.sentenceAudio, automatedIntegrity: 'passed' };
    sourceManifest.reviews.imageRepairs = approval.imageRepairs;
    sourceManifest.packageVersion = path.basename(archiveTarget);
    sourceManifest.createdAt = new Date().toISOString();

    const readmePath = path.join(archiveStage, 'README.md');
    let readme = fs.readFileSync(readmePath, 'utf8')
      .replaceAll('修复图仍待负责人目视确认。', '修复图已于2026-10-21由负责人审查通过。')
      .replace('听感抽样审核待完成。', '例句音频抽样已于2026-10-21由负责人审查通过。');
    readme += '\n## 发布修订审批记录\n\n负责人于2026-10-21确认本课程审核完成。本版本包含628条逐字绑定的例句 Opus；审听状态为抽样通过，不声称628条逐一人工听审。12项已修复配图通过审查；9条未补音标按负责人决定保留为空。WAV 母版和整理稿保存在 Git 工作区外的本机音频归档中，课程交付包仅带 Opus。\n';
    fs.writeFileSync(readmePath, readme);

    const fileRows = new Map(sourceManifest.files.map(file => [file.path, file]));
    for (const relative of [snapshotRelative, 'README.md', approvalRelative]) {
      const bytes = fs.readFileSync(path.join(archiveStage, ...relative.split('/')));
      fileRows.set(relative, { path: relative, sha256: hash(bytes), bytes: bytes.length, role: relative === approvalRelative ? 'review-approval' : fileRows.get(relative)?.role });
    }
    sourceManifest.files = [...fileRows.values()].sort((a, b) => a.path.localeCompare(b.path));
    const manifestBytes = Buffer.from(JSON.stringify(sourceManifest, null, 2) + '\n');
    fs.writeFileSync(path.join(archiveStage, 'manifest.json'), manifestBytes);
    const checksumRows = [
      { path: 'manifest.json', sha256: hash(manifestBytes), bytes: manifestBytes.length },
      ...sourceManifest.files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
    ].sort((a, b) => a.path.localeCompare(b.path));
    fs.writeFileSync(path.join(archiveStage, 'checksums.json'), JSON.stringify({ format: 'textbook-asset-checksums', schemaVersion: 1, files: checksumRows }, null, 2) + '\n');
    const verified = packageApi.verifyPackage(archiveStage);
    if (!verified.ok) throw Error('New immutable archive did not pass package verification');

    fs.mkdirSync(path.join(importStage, 'assets'), { recursive: true });
    for (const [filename, row] of audioFiles) fs.copyFileSync(row.source, path.join(importStage, 'assets', filename), fs.constants.COPYFILE_EXCL);
    const sourceJson = JSON.stringify(importSnapshot, null, 2) + '\n';
    fs.writeFileSync(path.join(importStage, 'textbook-wordbook-package.json'), sourceJson, { flag: 'wx' });

    const assembled = textbookModel.assemble(importSnapshot);
    const candidate = await wordbookDraft.compile(assembled);
    if (candidate.items.length !== 628 || candidate.items.filter(item => item.learning?.sentenceAudio).length !== 628) throw Error('Compiled course does not contain all 628 sentence audio activities');
    const legacyDir = versions.directory(bookId);
    const legacyItemsDir = path.join(legacyDir, 'items');
    const changedItems = [];
    for (const item of candidate.items) {
      const previous = JSON.parse(fs.readFileSync(path.join(legacyItemsDir, item.itemId.replace(/:/g, '_') + '.json'), 'utf8'));
      const changed = [...new Set([...Object.keys(previous), ...Object.keys(item)])].filter(key => key !== 'contentRevision' && key !== 'learning' && JSON.stringify(previous[key]) !== JSON.stringify(item[key]));
      const isRepair = repairIds.includes(item.itemId);
      if (changed.some(key => key !== 'images') || (!!changed.length !== isRepair)) throw Error(`Unexpected non-audio revision change: ${item.itemId} (${changed.join(',')})`);
      if (changed.length) changedItems.push(item.itemId);
      for (const profile of ['wide', 'mobile']) {
        const url = item.images?.[profile]?.[0];
        if (!url || !url.startsWith('assets/')) throw Error(`Invalid course image reference: ${item.itemId}`);
        const imagePath = path.resolve(appRoot, url);
        const relative = path.relative(path.join(appRoot, 'assets'), imagePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error(`Image escaped built-in app assets: ${item.itemId}`);
        if (!fs.existsSync(imagePath) && !imageFiles.has(url)) {
          const binding = sourceManifest.bindings.find(row => row.itemId === item.itemId);
          const assetId = binding?.imageAssetIds?.[0];
          const asset = sourceManifest.assets.find(row => row.assetId === assetId);
          if (!asset) throw Error(`No archived delivery image for ${item.itemId}`);
          const sourceImage = packageApi.inside(archiveStage, asset.path);
          const imageBytes = fs.readFileSync(sourceImage);
          if (hash(imageBytes) !== asset.sha256 || imageBytes.length !== asset.bytes || !url.endsWith('.webp') || imageBytes.length >= 20000 || asset.width !== 576 && asset.width !== 512 || asset.height * 16 !== asset.width * 9) throw Error(`Invalid revised WebP delivery asset: ${item.itemId}`);
          imageFiles.set(url, { source: sourceImage, bytes: imageBytes.length, sha256: asset.sha256 });
        }
      }
    }
    if (changedItems.length !== repairIds.length) throw Error('Expected approved image repair set does not match compiled changes');
    for (const [url, row] of imageFiles) fs.copyFileSync(row.source, path.resolve(importStage, url), fs.constants.COPYFILE_EXCL);

    const readAsset = url => {
      const candidateFile = path.resolve(importStage, url);
      const relative = path.relative(importStage, candidateFile);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Asset path escaped import candidate');
      if (fs.existsSync(candidateFile)) return fs.readFileSync(candidateFile);
      const installed = path.resolve(appRoot, url);
      const installedRelative = path.relative(path.join(appRoot, 'assets'), installed);
      if (installedRelative.startsWith('..') || path.isAbsolute(installedRelative)) throw Error('Asset path escaped app assets');
      return fs.readFileSync(installed);
    };
    const publisher = require('../server/services/wordbook-publisher').createWordbookPublisher({
      appRoot,
      versions,
      content: require('../server/services/vocabulary-content').createVocabularyContent({ appRoot, publishedRoot, versions }),
    });
    const ready = publisher.validate(candidate, { readAsset, updateBaseReleaseId: base.releaseId });
    if (!ready.ready || ready.itemCount !== 628) throw Error('Built-in publisher preflight did not accept the revision');

    const importManifest = {
      format: 'system-wordbook-revision-candidate', schemaVersion: 1, createdAt: new Date().toISOString(),
      bookId, baseReleaseId: base.releaseId, candidateFingerprint: ready.fingerprint,
      itemCount: candidate.items.length, unitCount: candidate.index.books[0].units.length,
      sentenceAudio: { count: deliveryRows.length, uniqueOpusFiles: audioFiles.size, totalBytes: deliveryRows.reduce((sum, row) => sum + row.bytes, 0), sampleReview: 'approved-by-owner' },
      approvedImageRepairs: changedItems, intentionallyUnfilledPhonetics: 9,
      deliveryAssets: [
        ...[...audioFiles].map(([filename, row]) => ({ path: `assets/${filename}`, kind: 'sentence-audio', bytes: row.bytes, sha256: row.sha256 })),
        ...[...imageFiles].map(([url, row]) => ({ path: url, kind: 'reviewed-image-revision', bytes: row.bytes, sha256: row.sha256 })),
      ],
      publisherPreflight: ready,
      accountWrites: false,
    };
    fs.writeFileSync(path.join(importStage, 'publication-candidate.json'), JSON.stringify(importManifest, null, 2) + '\n', { flag: 'wx' });

    fs.renameSync(archiveStage, archiveTarget);
    fs.renameSync(importStage, importTarget);
    console.log(JSON.stringify({ archive: archiveTarget, publicationCandidate: importTarget, packageVerification: { ok: verified.ok, files: verified.files, items: verified.items, audio: verified.audio }, publisherPreflight: ready, sampleApproval: 'approved-by-owner', imageRepairs: changedItems.length, newlyPackagedImages: imageFiles.size, intentionalPhoneticGaps: 9, opusFiles: audioFiles.size, originalMastersCopiedIntoGit: false }, null, 2));
  } catch (error) {
    throw Error(`${error.message}\nPreserved staging for inspection: archive=${archiveStage}; import=${importStage}`);
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
