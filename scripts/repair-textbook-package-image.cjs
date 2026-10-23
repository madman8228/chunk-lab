'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const packageApi = require('./lib/textbook-asset-package.cjs');
const { imageDimensions } = require('../server/services/membership/image-dimensions');

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function main() {
  const source = fs.realpathSync(arg('--package'));
  const output = path.resolve(arg('--out'));
  const itemId = arg('--item-id');
  const newKey = arg('--asset-key');
  const master = fs.realpathSync(arg('--master'));
  const delivery = fs.realpathSync(arg('--delivery'));
  const verified = packageApi.verifyPackage(source);
  const sourceManifest = verified.manifest;
  if (sourceManifest.book.bookId !== 'textbook-wordbook:pep-junior-grade9-full-2013') throw new Error('Unsupported textbook package');
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing package: ${output}`);
  const binding = sourceManifest.bindings.find(row => row.itemId === itemId);
  if (!binding || binding.imageAssetIds.length !== 1) throw new Error(`Expected exactly one image binding for ${itemId}`);

  const imageBytes = fs.readFileSync(delivery), dimensions = imageDimensions(imageBytes, 'image/webp');
  if (!dimensions || dimensions[0] * 9 !== dimensions[1] * 16 || imageBytes.length >= 20000) throw new Error('Delivery image must be 16:9 WebP and strictly below 20,000 bytes');
  const imageHash = hash(imageBytes), assetId = 'sha256:' + imageHash;
  const imagePath = `images/delivery/${imageHash}.webp`;
  if (sourceManifest.assets.some(asset => asset.assetId === assetId)) throw new Error('The replacement image already exists in the source package');

  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.textbook-image-repair-'));
  try {
    fs.cpSync(source, staging, { recursive: true, force: false, errorOnExist: true });
    const oldId = binding.imageAssetIds[0];
    const stillUsed = sourceManifest.bindings.some(row => row.itemId !== itemId && row.imageAssetIds.includes(oldId));
    const previousAsset = sourceManifest.assets.find(asset => asset.assetId === oldId);
    if (!previousAsset) throw new Error(`Previous image asset missing: ${oldId}`);
    const manifest = JSON.parse(JSON.stringify(sourceManifest));
    const nextBinding = manifest.bindings.find(row => row.itemId === itemId);
    nextBinding.imageAssetIds = [assetId];
    const asset = { assetId, path: imagePath, sha256: imageHash, bytes: imageBytes.length, width: dimensions[0], height: dimensions[1] };
    manifest.assets.push(asset);
    if (!stillUsed) manifest.assets = manifest.assets.filter(row => row.assetId !== oldId);
    manifest.counts.uniqueImages = manifest.assets.length;

    const snapshotPath = packageApi.inside(staging, manifest.content.courseSnapshot);
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const item = snapshot.drafts.flatMap(draft => draft.items).find(row => row.itemId === itemId);
    if (!item) throw new Error(`Course snapshot item missing: ${itemId}`);
    item.images = { wide: [newKey], mobile: [newKey] };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');

    fs.mkdirSync(path.dirname(path.join(staging, imagePath)), { recursive: true });
    fs.copyFileSync(delivery, path.join(staging, imagePath), fs.constants.COPYFILE_EXCL);
    if (!stillUsed) fs.rmSync(packageApi.inside(staging, previousAsset.path));

    const release = path.basename(output);
    manifest.packageVersion = release;
    manifest.createdAt = new Date().toISOString();
    manifest.repairs = [...(manifest.repairs || []), {
      itemId, word: nextBinding.word, previousAssetId: oldId, replacementAssetId: assetId,
      sourceMaster: master, sourceMasterSha256: packageApi.hashFile(master),
      sourceDelivery: delivery, sourceDeliverySha256: imageHash,
      repairDescription: 'Replaced the illustration with a corrected version of the reported visual defect; prior package revision and source master remain preserved.',
      humanAudition: 'visual-review-required'
    }];
    const repairRecordPath = path.join(path.dirname(master), 'repair-record.json');
    if (fs.existsSync(repairRecordPath)) throw new Error(`Refusing to overwrite repair record: ${repairRecordPath}`);
    fs.writeFileSync(repairRecordPath, JSON.stringify(manifest.repairs.at(-1), null, 2) + '\n', { flag: 'wx' });
    const readmePath = path.join(staging, 'README.md');
    let readme = fs.readFileSync(readmePath, 'utf8').replace(/版本：[^。]+。/, `版本：${release}。`);
    readme += `\n## 定点图片修复\n\n${itemId}（${nextBinding.word}）新增修正版；原资产包版本及原始母图均保留。修复图仍待负责人目视确认。\n`;
    fs.writeFileSync(readmePath, readme);

    const fileByPath = new Map(manifest.files.map(file => [file.path, file]));
    const snapshotBytes = fs.readFileSync(snapshotPath), readmeBytes = fs.readFileSync(readmePath);
    fileByPath.set(manifest.content.courseSnapshot, { ...fileByPath.get(manifest.content.courseSnapshot), sha256: hash(snapshotBytes), bytes: snapshotBytes.length });
    fileByPath.set('README.md', { ...fileByPath.get('README.md'), sha256: hash(readmeBytes), bytes: readmeBytes.length });
    fileByPath.set(imagePath, { path: imagePath, sha256: imageHash, bytes: imageBytes.length, role: 'vocabulary-illustration', mediaType: 'image/webp' });
    if (!stillUsed) fileByPath.delete(previousAsset.path);
    manifest.files = [...fileByPath.values()].sort((a, b) => a.path.localeCompare(b.path));

    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(staging, 'manifest.json'), manifestBytes);
    const checksumRows = [{ path: 'manifest.json', sha256: hash(manifestBytes), bytes: manifestBytes.length }, ...manifest.files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }))].sort((a, b) => a.path.localeCompare(b.path));
    fs.writeFileSync(path.join(staging, 'checksums.json'), JSON.stringify({ format: 'textbook-asset-checksums', schemaVersion: 1, files: checksumRows }, null, 2) + '\n');
    packageApi.verifyPackage(staging);
    fs.renameSync(staging, output);
    console.log(JSON.stringify({ package: output, itemId, previousAssetId: oldId, replacementAssetId: assetId, width: dimensions[0], height: dimensions[1], bytes: imageBytes.length, stillUsed, verification: 'passed' }, null, 2));
  } catch (error) {
    try { fs.writeFileSync(path.join(staging, 'REPAIR-FAILED.md'), `# Image repair staging failed\n\n${error.message}\n`, { flag: 'wx' }); } catch {}
    throw new Error(`${error.message}\nRepair staging retained for inspection: ${staging}`);
  }
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
