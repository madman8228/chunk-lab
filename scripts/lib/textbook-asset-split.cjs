'use strict';

const fs = require('node:fs');
const path = require('node:path');
const packageApi = require('./textbook-asset-package.cjs');

function copyVerified(sourceRoot, sourceRelative, targetRoot, targetRelative, expected) {
  const source = packageApi.inside(sourceRoot, sourceRelative);
  if (packageApi.hashFile(source) !== expected.sha256 || fs.statSync(source).size !== expected.bytes) throw new Error('Source asset mismatch: ' + sourceRelative);
  const target = path.join(targetRoot, ...packageApi.packagePath(targetRelative).split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  if (packageApi.hashFile(target) !== expected.sha256 || fs.statSync(target).size !== expected.bytes) throw new Error('Copied asset mismatch: ' + targetRelative);
}

function writeNew(root, relative, content) {
  const target = path.join(root, ...packageApi.packagePath(relative).split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { flag: 'wx' });
  return Buffer.byteLength(content, 'utf8');
}

function writeChecksums(root, rows) {
  const checks = { format: 'textbook-asset-checksums', schemaVersion: 1, files: rows.sort((a, b) => a.path.localeCompare(b.path)) };
  fs.writeFileSync(path.join(root, 'checksums.json'), JSON.stringify(checks, null, 2) + '\n', { flag: 'wx' });
}

function verifyLocalOriginals(packageRoot, originalsRoot) {
  const packaged = packageApi.verifyPackage(packageRoot);
  const expectation = packaged.manifest.localOriginals;
  if (!expectation || expectation.policy !== 'local-only') throw new Error('Package does not declare local-only originals');
  const root = fs.realpathSync(originalsRoot);
  const manifestBytes = fs.readFileSync(path.join(root, 'manifest.json'));
  if (packageApi.sha256(manifestBytes) !== expectation.manifestSha256) throw new Error('Local originals manifest hash does not match package');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.format !== 'textbook-local-original-assets' || manifest.schemaVersion !== 1 || manifest.bookId !== packaged.manifest.book.bookId || manifest.sourceFingerprint !== packaged.manifest.sourceFingerprint) throw new Error('Local originals belong to another textbook/source revision');
  const checks = JSON.parse(fs.readFileSync(path.join(root, 'checksums.json'), 'utf8'));
  if (checks.format !== 'textbook-asset-checksums' || checks.schemaVersion !== 1) throw new Error('Invalid local originals checksums');
  const expectedFiles = new Map(checks.files.map(row => [packageApi.packagePath(row.path), row]));
  if (new Set(expectedFiles.keys()).size !== checks.files.length) throw new Error('Duplicate local originals checksum path');
  if (checks.files.length !== manifest.files.length + 1) throw new Error('Local originals checksum file count mismatch');
  for (const row of manifest.files) {
    const checksum = expectedFiles.get(row.path);
    if (!checksum || checksum.sha256 !== row.sha256 || checksum.bytes !== row.bytes) throw new Error('Local originals manifest/checksum mismatch: ' + row.path);
  }
  for (const row of checks.files) {
    const full = packageApi.inside(root, row.path);
    if (packageApi.hashFile(full) !== row.sha256 || fs.statSync(full).size !== row.bytes) throw new Error('Local original hash mismatch: ' + row.path);
  }
  const listed = new Set(['checksums.json', ...checks.files.map(row => row.path)]);
  for (const entry of packageApi.walk(root)) {
    if (entry.kind === 'symlink') throw new Error('Symlink in local originals: ' + entry.path);
    if (entry.kind === 'file' && !listed.has(entry.path)) throw new Error('Unlisted local original: ' + entry.path);
  }
  const pngRows = manifest.files.filter(row => row.path.toLowerCase().endsWith('.png'));
  if (pngRows.length !== expectation.files || pngRows.reduce((sum, row) => sum + row.bytes, 0) !== expectation.bytes) throw new Error('Local originals count/size mismatch');
  for (const row of pngRows) {
    const checksum = expectedFiles.get(row.path);
    if (!checksum || checksum.sha256 !== row.sha256 || checksum.bytes !== row.bytes) throw new Error('Local originals manifest/checksum mismatch: ' + row.path);
  }
  return { ok: true, bookId: manifest.bookId, files: pngRows.length, bytes: expectation.bytes, manifestSha256: expectation.manifestSha256 };
}

function splitPackage({ sourcePackage, packageOut, originalsOut }) {
  const sourceRoot = fs.realpathSync(sourcePackage);
  const source = packageApi.verifyPackage(sourceRoot);
  const output = path.resolve(packageOut), originals = path.resolve(originalsOut);
  if (fs.existsSync(output) || fs.existsSync(originals)) throw new Error('Refusing to overwrite package or local originals output');
  if (output === originals || output.startsWith(originals + path.sep) || originals.startsWith(output + path.sep)) throw new Error('Outputs must be separate directories');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(path.dirname(originals), { recursive: true });
  const packageStage = fs.mkdtempSync(path.join(path.dirname(output), '.textbook-lean-stage-'));
  const originalsStage = fs.mkdtempSync(path.join(path.dirname(originals), '.textbook-originals-stage-'));
  try {
    const pngs = source.manifest.files.filter(file => file.path.toLowerCase().endsWith('.png'));
    const provenanceByPath = new Map((source.manifest.provenance?.files || []).map(row => [row.archivePath, row]));
    const localFiles = [];
    for (const file of pngs) {
      const provenance = provenanceByPath.get(file.path);
      const localPath = 'files/' + file.path;
      copyVerified(sourceRoot, file.path, originalsStage, localPath, file);
      localFiles.push({ path: localPath, sourcePackagePath: file.path, sha256: file.sha256, bytes: file.bytes, mediaType: file.mediaType, role: file.role, sourcePaths: provenance?.sourcePaths || [] });
    }
    const localReadme = '# 本机原始 PNG 素材\n\n这里保存教材扫描图、图集与母版 PNG，仅用于本地溯源、重新裁剪和重新提取结构化数据。\n\n用主项目命令校验：node scripts/textbook-asset-package.cjs verify-local --package <精简课程包> --originals <本目录>。\n';
    const readmeBytes = writeNew(originalsStage, 'README.md', localReadme);
    localFiles.push({ path: 'README.md', sourcePackagePath: null, sha256: packageApi.sha256(Buffer.from(localReadme)), bytes: readmeBytes, mediaType: 'text/markdown', role: 'local-originals-readme', sourcePaths: [] });
    const localManifest = {
      format: 'textbook-local-original-assets', schemaVersion: 1, bookId: source.manifest.book.bookId,
      bookTitle: source.manifest.book.title, sourcePackageVersion: source.manifest.packageVersion,
      sourceFingerprint: source.manifest.sourceFingerprint, createdAt: new Date().toISOString(), files: localFiles,
      counts: { pngFiles: pngs.length, bytes: pngs.reduce((sum, row) => sum + row.bytes, 0) }
    };
    const localManifestBytes = Buffer.from(JSON.stringify(localManifest, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(originalsStage, 'manifest.json'), localManifestBytes, { flag: 'wx' });
    const localChecks = [{ path: 'manifest.json', sha256: packageApi.sha256(localManifestBytes), bytes: localManifestBytes.length }, ...localFiles.map(({ path: filePath, sha256, bytes }) => ({ path: filePath, sha256, bytes }))];
    writeChecksums(originalsStage, localChecks);

    const included = source.manifest.files.filter(file => !file.path.toLowerCase().endsWith('.png'));
    for (const file of included) copyVerified(sourceRoot, file.path, packageStage, file.path, file);
    const lean = { ...source.manifest, schemaVersion: 2, packageVersion: path.basename(output), files: included.map(file => ({ ...file })) };
    lean.localOriginals = { policy: 'local-only', storeKey: path.basename(path.dirname(originals)) + '/' + path.basename(originals), manifestSha256: packageApi.sha256(localManifestBytes), files: pngs.length, bytes: pngs.reduce((sum, row) => sum + row.bytes, 0) };
    lean.counts = { ...lean.counts, localOnlyPngFiles: pngs.length, localOnlyPngBytes: lean.localOriginals.bytes };
    const pngSet = new Set(pngs.map(row => row.path));
    lean.sourceOriginals = lean.sourceOriginals.map(row => ({ ...row, storage: 'local-only', localPath: 'files/' + row.path }));
    lean.provenance = { ...lean.provenance, files: lean.provenance.files.map(row => row.archivePath.toLowerCase().endsWith('.png') ? { ...row, storage: 'local-only', localPath: 'files/' + row.archivePath } : { ...row, storage: 'package' }) };
    lean.completeness = { ...lean.completeness, sourceOriginals: 'local-only', deliveryPackage: 'self-contained' };
    if (lean.provenance.files.filter(row => row.storage === 'local-only').length !== pngs.length) throw new Error('PNG provenance coverage mismatch');
    for (const row of lean.sourceOriginals) if (!pngSet.has(row.path)) throw new Error('Traceable original missing from local PNG set: ' + row.path);
    const readme = '# ' + lean.book.title + '\n\n版本：' + lean.packageVersion + '。这是可独立审核和运行的精简课程资产包。\n\n包含14个单元、628条词目、627张交付WebP、音标和审核记录。审核状态：597条已确认，22条新增待审，9条暂不补充。网页交付图片在本包内并按需加载。\n\n原始PNG素材保存在本机独立目录，不属于本课程包。清单保留原文件名、来源路径和SHA-256，可用verify-local命令核对本机素材库。\n\n只读审核：node scripts/serve-textbook-phonetics-review.cjs --package <本资产包路径>。课程包校验：node scripts/textbook-asset-package.cjs verify --package <本资产包路径>。\n';
    const readmeRow = lean.files.find(row => row.path === 'README.md');
    if (!readmeRow) throw new Error('Source package README missing');
    const readmeBytes2 = Buffer.from(readme, 'utf8');
    fs.writeFileSync(path.join(packageStage, 'README.md'), readmeBytes2);
    readmeRow.sha256 = packageApi.sha256(readmeBytes2); readmeRow.bytes = readmeBytes2.length;
    const manifestBytes = Buffer.from(JSON.stringify(lean, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(packageStage, 'manifest.json'), manifestBytes, { flag: 'wx' });
    const packageChecks = [{ path: 'manifest.json', sha256: packageApi.sha256(manifestBytes), bytes: manifestBytes.length }, ...lean.files.map(({ path: filePath, sha256, bytes }) => ({ path: filePath, sha256, bytes }))];
    writeChecksums(packageStage, packageChecks);
    packageApi.verifyPackage(packageStage);
    verifyLocalOriginals(packageStage, originalsStage);
    fs.renameSync(originalsStage, originals);
    fs.renameSync(packageStage, output);
    return { package: output, localOriginals: originals, packageBytes: packageChecks.reduce((sum, row) => sum + row.bytes, 0), ...lean.counts, localOriginalsSha256: lean.localOriginals.manifestSha256 };
  } catch (error) {
    for (const [root, label] of [[packageStage, 'lean'], [originalsStage, 'originals']]) {
      try { fs.writeFileSync(path.join(root, 'SPLIT-FAILED.md'), '# Split failed\n\n' + error.message + '\n', { flag: 'wx' }); } catch {}
    }
    throw new Error(error.message + '\nStaging preserved: ' + packageStage + ' ; ' + originalsStage);
  }
}

module.exports = { splitPackage, verifyLocalOriginals };
