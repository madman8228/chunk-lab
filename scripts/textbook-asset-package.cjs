'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const packageApi = require('./lib/textbook-asset-package.cjs');
const { inventory: grade9Inventory } = require('./lib/grade9-asset-inventory.cjs');
const { splitPackage, verifyLocalOriginals } = require('./lib/textbook-asset-split.cjs');

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error('Missing required option ' + name);
  return args[index + 1];
}

function writeNew(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { flag: 'wx' });
}

function inventoryCommand(args) {
  const root = path.resolve(option(args, '--root'));
  const out = path.resolve(option(args, '--out'));
  const book = option(args, '--book');
  if (book !== 'pep-junior-grade9-full-2013') throw new Error('This inventory adapter supports pep-junior-grade9-full-2013');
  const inventory = grade9Inventory(root);
  writeNew(out, JSON.stringify(inventory, null, 2) + '\n');
  console.log(JSON.stringify({ inventory: out, ...inventory.counts, sourceFingerprint: inventory.sourceFingerprint, gaps: inventory.gaps.length, bytesToCopy: inventory.files.reduce((sum, file) => sum + file.bytes, 0) }, null, 2));
}

function packCommand(args) {
  const root = fs.realpathSync(path.resolve(option(args, '--root')));
  const inventoryPath = path.resolve(option(args, '--inventory'));
  const output = path.resolve(option(args, '--out'));
  const packageVersion = path.basename(output);
  if (!output.startsWith(path.parse(output).root)) throw new Error('Invalid output directory');
  const plan = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  if (plan.format !== 'textbook-asset-inventory' || plan.schemaVersion !== 1 || plan.bookId !== 'textbook-wordbook:pep-junior-grade9-full-2013') throw new Error('Unsupported inventory');
  const current = grade9Inventory(root);
  if (current.sourceFingerprint !== plan.sourceFingerprint) throw new Error('Course source changed since inventory; regenerate and review the inventory');
  if (current.files.length !== plan.files.length || current.files.some((file, index) => file.archivePath !== plan.files[index].archivePath || file.sha256 !== plan.files[index].sha256 || file.bytes !== plan.files[index].bytes)) throw new Error('Inventory source files changed; regenerate inventory');
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  if (fs.existsSync(output)) throw new Error('Refusing to overwrite existing package: ' + output);
  const staging = fs.mkdtempSync(path.join(parent, '.textbook-package-stage-'));
  try {
    const files = [];
    for (const source of plan.files) {
      let selected = null;
      for (const candidate of source.sourcePaths || [source.sourcePath]) {
        const full = packageApi.inside(root, candidate);
        if (packageApi.hashFile(full) !== source.sha256 || fs.statSync(full).size !== source.bytes) throw new Error('Source changed during pack: ' + candidate);
        if (!selected) selected = full;
      }
      if (!selected) throw new Error('No source path for ' + source.archivePath);
      const destination = path.join(staging, ...packageApi.packagePath(source.archivePath).split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(selected, destination, fs.constants.COPYFILE_EXCL);
      if (packageApi.hashFile(destination) !== source.sha256 || fs.statSync(destination).size !== source.bytes) throw new Error('Copied file failed verification: ' + source.archivePath);
      files.push({ path: source.archivePath, sha256: source.sha256, bytes: source.bytes, role: source.role, mediaType: source.mediaType });
    }
    const textFiles = [
      ['README.md', 'textbook-asset-package-readme', '# ' + plan.bookId + '\n\n版本：' + packageVersion + '。\n\n本包包含14个单元、628个词条、' + plan.counts.uniqueImages + '张交付图片及' + plan.counts.sourceOriginals + '个可追溯图集/母版文件。音标审核状态：' + plan.counts.approvedPhonetics + '条已确认，' + plan.counts.pendingReviewPhonetics + '条新增待审，9条按教材所有者决定暂不补充。课程音频尚未制作。\n\n目录包括教材来源、词条快照、音标、原始插图、网页交付图、审核记录和音频预留。\n\n只读审核命令：`node scripts/serve-textbook-phonetics-review.cjs --package "<本资产包路径>"`（需在chunk-practice项目目录运行）。资产包只读校验：`node scripts/textbook-asset-package.cjs verify --package "<本资产包路径>"`。\n\n本地包需单独验证；此包尚未上传到远端资产仓库或OSS。\n'],
      ['audio/originals/README.md', 'audio-originals-placeholder', '# 原始音频\n本教材暂未配置课程音频。\n'],
      ['audio/delivery/README.md', 'audio-delivery-placeholder', '# 播放音频\n本教材暂未配置课程音频。\n'],
      ['releases/README.md', 'release-history-placeholder', '# 发布记录\n本资产包是本地归档版本，不代表正式课程已更新。\n']
    ];
    for (const [relative, role, content] of textFiles) {
      const destination = path.join(staging, ...relative.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content, { flag: 'wx' });
      const bytes = Buffer.from(content, 'utf8');
      files.push({ path: relative, sha256: packageApi.sha256(bytes), bytes: bytes.length, role, mediaType: 'text/markdown' });
    }
    const manifest = {
      format: 'textbook-asset-package', schemaVersion: 1, packageVersion, createdAt: new Date().toISOString(),
      book: plan.book, sourceFingerprint: plan.sourceFingerprint, units: plan.units,
      content: { courseSnapshot: 'sources/archive/whole-book-launch-v1/textbook-ready-v1.json', phonetics: plan.phoneticFiles.map(file => file.path), units: plan.units },
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      bindings: plan.bindings, phonetics: plan.phonetics.map(item => ({
        ...item,
        approval: plan.approval.confirmedItemIds.includes(item.itemId) ? 'user-confirmed' : plan.approval.pendingReviewItemIds.includes(item.itemId) ? 'pending-review' : 'deferred-by-owner'
      })),
      phoneticFiles: plan.phoneticFiles, assets: plan.assets, sourceOriginals: plan.sourceOriginals,
      audioAssets: plan.audioAssets, audioStatus: plan.audioStatus, reviews: { phonetics: plan.approval, audit: plan.audit },
      provenance: { sourceRoot: plan.sourceRoot, workspaceId: plan.workspaceId, files: plan.files.map(file => ({ sourcePaths: file.sourcePaths, archivePath: file.archivePath, sha256: file.sha256, bytes: file.bytes, role: file.roles })) },
      counts: plan.counts,
      completeness: { status: plan.gaps.length ? 'archived-with-gaps' : 'complete', gaps: plan.gaps, nonemptyPhonetics: plan.counts.nonemptyPhonetics, pendingPhonetics: plan.counts.pendingPhonetics, audioStatus: plan.audioStatus }
    };
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(staging, 'manifest.json'), manifestBytes, { flag: 'wx' });
    const checksumRows = [{ path: 'manifest.json', sha256: packageApi.sha256(manifestBytes), bytes: manifestBytes.length }, ...files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }))].sort((a, b) => a.path.localeCompare(b.path));
    const checksums = { format: 'textbook-asset-checksums', schemaVersion: 1, files: checksumRows };
    fs.writeFileSync(path.join(staging, 'checksums.json'), JSON.stringify(checksums, null, 2) + '\n', { flag: 'wx' });
    packageApi.verifyPackage(staging);
    fs.renameSync(staging, output);
    console.log(JSON.stringify({ package: output, ...plan.counts, completeness: manifest.completeness.status, gaps: plan.gaps.length }, null, 2));
  } catch (error) {
    try { fs.writeFileSync(path.join(staging, 'PACK-FAILED.md'), '# Asset package staging failed\n\n' + error.message + '\n', { flag: 'wx' }); } catch {}
    throw new Error(error.message + '\nFailed staging retained for inspection: ' + staging);
  }
}

function verifyCommand(args) {
  const result = packageApi.verifyPackage(path.resolve(option(args, '--package')));
  const { manifest, ...summary } = result;
  console.log(JSON.stringify(summary, null, 2));
}

function splitCommand(args) {
  const result = splitPackage({
    sourcePackage: path.resolve(option(args, '--source-package')),
    packageOut: path.resolve(option(args, '--package-out')),
    originalsOut: path.resolve(option(args, '--originals-out'))
  });
  console.log(JSON.stringify(result, null, 2));
}

function verifyLocalCommand(args) {
  const result = verifyLocalOriginals(
    path.resolve(option(args, '--package')),
    path.resolve(option(args, '--originals'))
  );
  console.log(JSON.stringify(result, null, 2));
}

try {
  const args = process.argv.slice(2), command = args.shift();
  if (command === 'inventory') inventoryCommand(args);
  else if (command === 'pack') packCommand(args);
  else if (command === 'split') splitCommand(args);
  else if (command === 'verify') verifyCommand(args);
  else if (command === 'verify-local') verifyLocalCommand(args);
  else throw new Error('Usage: textbook-asset-package.cjs inventory|pack|verify [options]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
