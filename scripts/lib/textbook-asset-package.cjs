'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { imageDimensions } = require('../../server/services/membership/image-dimensions');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mimeFor = file => ({ '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }[path.extname(file).toLowerCase()] || 'application/octet-stream');

function packagePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/') || /^[a-z]:/i.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe package path: ${value}`);
  return value;
}

function inside(root, relative) {
  const safe = packagePath(relative);
  const base = fs.realpathSync(root);
  const file = path.resolve(base, ...safe.split('/'));
  if (!file.startsWith(base + path.sep)) throw new Error(`Path escapes root: ${relative}`);
  const real = fs.realpathSync(file);
  if (!real.startsWith(base + path.sep)) throw new Error(`Symlink leaves root: ${relative}`);
  return real;
}

function hashFile(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.allocUnsafe(1024 * 1024);
  try { let count; while ((count = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

function walk(root, relative = '', output = []) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(root, ...rel.split('/'));
    if (entry.isSymbolicLink()) { output.push({ path: rel, kind: 'symlink' }); continue; }
    if (entry.isDirectory()) walk(root, rel, output);
    else if (entry.isFile()) output.push({ path: rel, bytes: entry.size, sha256: hashFile(full), kind: 'file' });
  }
  return output;
}

function verifyPackage(root) {
  const realRoot = fs.realpathSync(root);
  const manifestFile = path.join(realRoot, 'manifest.json');
  const checksFile = path.join(realRoot, 'checksums.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const checks = JSON.parse(fs.readFileSync(checksFile, 'utf8'));
  if (manifest.format !== 'textbook-asset-package' || ![1, 2].includes(manifest.schemaVersion) || checks.format !== 'textbook-asset-checksums' || checks.schemaVersion !== 1) throw new Error('Unsupported textbook asset package');
  const problems = [];
  const recorded = new Map();
  const seen = new Set();
  for (const entry of checks.files) {
    const relative = packagePath(entry.path);
    if (seen.has(relative)) { problems.push(`duplicate checksum path ${relative}`); continue; }
    seen.add(relative);
    recorded.set(relative, entry);
    let full;
    try { full = inside(realRoot, relative); } catch (error) { problems.push(error.message); continue; }
    const stat = fs.statSync(full);
    const actualHash = hashFile(full);
    if (actualHash !== entry.sha256 || stat.size !== entry.bytes) problems.push(`file mismatch ${relative}`);
  }
  const entries = walk(realRoot);
  for (const entry of entries) if (entry.kind === 'symlink') problems.push(`symlink in package ${entry.path}`);
  const all = entries.filter(item => item.kind === 'file').map(item => item.path);
  for (const relative of all) if (!['checksums.json'].includes(relative) && relative !== 'manifest.json' && !recorded.has(relative)) problems.push(`unlisted file ${relative}`);
  const files = new Map(manifest.files.map(entry => [entry.path, entry]));
  for (const relative of recorded.keys()) if (relative !== 'manifest.json' && relative !== 'checksums.json' && !files.has(relative)) problems.push(`checksum file absent from manifest ${relative}`);
  for (const entry of manifest.files) {
    const checksum = recorded.get(entry.path);
    if (!checksum || checksum.sha256 !== entry.sha256 || checksum.bytes !== entry.bytes) problems.push(`manifest/checksum mismatch ${entry.path}`);
    try { packagePath(entry.path); } catch (error) { problems.push(error.message); }
  }
  if (manifest.schemaVersion === 2) {
    const local = manifest.localOriginals;
    if (!local || local.policy !== 'local-only' || !/^[a-f0-9]{64}$/.test(local.manifestSha256 || '') || !Number.isSafeInteger(local.files) || !Number.isSafeInteger(local.bytes)) problems.push('invalid local-only originals declaration');
    if (manifest.files.some(entry => entry.path.toLowerCase().endsWith('.png'))) problems.push('local-only PNG included in delivery package');
    if (manifest.counts.localOnlyPngFiles !== local?.files || manifest.counts.localOnlyPngBytes !== local?.bytes) problems.push('local-only PNG totals mismatch');
    for (const original of manifest.sourceOriginals || []) {
      if (original.storage !== 'local-only' || original.localPath !== 'files/' + original.path) problems.push('invalid local-only original reference ' + original.path);
    }
    for (const row of manifest.provenance?.files || []) {
      const isPng = row.archivePath.toLowerCase().endsWith('.png');
      if (isPng ? row.storage !== 'local-only' || row.localPath !== 'files/' + row.archivePath : row.storage !== 'package') problems.push('invalid provenance storage declaration ' + row.archivePath);
    }
  }
  const itemIds = new Set();
  for (const binding of manifest.bindings) {
    if (itemIds.has(binding.itemId)) problems.push(`duplicate itemId ${binding.itemId}`);
    itemIds.add(binding.itemId);
    if (!binding.phonetics || !manifest.phonetics.some(item => item.path === binding.phonetics.path && item.itemId === binding.itemId)) problems.push(`missing phonetics binding ${binding.itemId}`);
    for (const id of binding.imageAssetIds) if (!manifest.assets.some(asset => asset.assetId === id)) problems.push(`missing image asset ${binding.itemId} ${id}`);
    for (const id of binding.audioAssetIds) if (!manifest.audioAssets.some(asset => asset.assetId === id)) problems.push(`missing audio asset ${binding.itemId} ${id}`);
  }
  if (manifest.bindings.length !== manifest.counts.items) problems.push('binding count mismatch');
  if (manifest.units.reduce((sum, unit) => sum + unit.itemIds.length, 0) !== manifest.counts.items) problems.push('unit item count mismatch');
  for (const asset of manifest.assets) {
    const file = files.get(asset.path);
    if (!file || asset.path !== 'images/delivery/' + asset.sha256 + '.webp' || file.sha256 !== asset.sha256 || file.bytes >= 20000 || file.mediaType !== 'image/webp') { problems.push('invalid delivery image ' + asset.assetId); continue; }
    try {
      const imagePath = inside(realRoot, asset.path), bytes = fs.readFileSync(imagePath), dimensions = imageDimensions(bytes, 'image/webp');
      if (sha256(bytes) !== asset.sha256 || !dimensions || dimensions[0] * 9 !== dimensions[1] * 16) problems.push('invalid delivery image bytes ' + asset.assetId);
    } catch (error) { problems.push(error.message); }
  }
  for (const phonetics of manifest.phonetics) if (!files.has(phonetics.path)) problems.push(`missing phonetics file ${phonetics.path}`);
  const approval = manifest.reviews?.phonetics;
  if (!approval || !Array.isArray(approval.confirmedItemIds) || !Array.isArray(approval.pendingReviewItemIds) || !Array.isArray(approval.deferredItemIds)) problems.push('missing item-level phonetics approval record');
  else {
    const confirmed = new Set(approval.confirmedItemIds), pending = new Set(approval.pendingReviewItemIds), deferred = new Set(approval.deferredItemIds);
    const classified = manifest.phonetics.filter(item => ['user-confirmed', 'pending-review', 'deferred-by-owner'].includes(item.approval));
    if (confirmed.size + pending.size + deferred.size !== manifest.phonetics.length || new Set([...confirmed, ...pending, ...deferred]).size !== manifest.phonetics.length) problems.push('phonetics approval groups do not cover each item exactly once');
    for (const item of manifest.phonetics) {
      const expected = confirmed.has(item.itemId) ? 'user-confirmed' : pending.has(item.itemId) ? 'pending-review' : deferred.has(item.itemId) ? 'deferred-by-owner' : null;
      if (!expected || item.approval !== expected || (expected === 'deferred-by-owner') === Boolean(item.phonetic) || (expected === 'pending-review' && !item.phonetic)) problems.push('phonetics approval mismatch ' + item.itemId);
    }
    if (manifest.counts.approvedPhonetics !== confirmed.size || manifest.counts.pendingReviewPhonetics !== pending.size || manifest.counts.pendingPhonetics !== deferred.size) problems.push('phonetics approval totals mismatch');
    if (manifest.phonetics.filter(item => Boolean(item.phonetic)).length !== manifest.counts.nonemptyPhonetics) problems.push('phonetics value total mismatch');
    if (classified.length !== manifest.phonetics.length) problems.push('unknown phonetics approval state');
  }
  try {
    const snapshotFile = inside(realRoot, manifest.content.courseSnapshot);
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const snapshotItems = new Map(snapshot.drafts.flatMap(unit => unit.items).map(item => [item.itemId, item]));
    for (const binding of manifest.bindings) {
      const item = snapshotItems.get(binding.itemId);
      if (!item || item.unitId !== binding.unitId || item.word !== binding.word) problems.push('course snapshot identity mismatch ' + binding.itemId);
    }
    for (const unit of manifest.units) for (const itemId of unit.itemIds) if (snapshotItems.get(itemId)?.unitId !== unit.unitId) problems.push('unit identity mismatch ' + itemId);
    for (const audio of manifest.audioAssets) {
      const file = files.get(audio.path), binding = manifest.bindings.find(row => row.itemId === audio.itemId);
      if (!file || file.sha256 !== audio.sha256 || audio.assetId !== 'sha256:' + audio.sha256 || !binding || !binding.audioAssetIds.includes(audio.assetId) || !binding.audio.some(row => row.kind === audio.kind && row.assetId === audio.assetId && row.text === audio.text)) problems.push('invalid audio binding ' + audio.assetId);
      else {
        const item = snapshotItems.get(audio.itemId);
        const expected = audio.kind === 'word' ? item.word : audio.kind === 'sentence' ? (item.exercise?.parts || []).map(part => part.text ?? part.answers?.[0] ?? '').join('') : null;
        if (!expected || audio.text !== expected) problems.push('audio text does not match course item ' + audio.itemId);
      }
    }
  } catch (error) { problems.push('invalid course snapshot: ' + error.message); }
  if (problems.length) throw new Error(`Package verification failed (${problems.length}): ${problems.slice(0, 12).join('; ')}`);
  return { ok: true, bookId: manifest.book.bookId, items: manifest.counts.items, units: manifest.counts.units, uniqueImages: manifest.assets.length, nonemptyPhonetics: manifest.counts.nonemptyPhonetics, pendingPhonetics: manifest.counts.pendingPhonetics, audio: manifest.audioAssets.length, files: recorded.size, bytes: checks.files.reduce((sum, entry) => sum + entry.bytes, 0), manifest };
}

module.exports = { hashFile, inside, mimeFor, packagePath, sha256, verifyPackage, walk };
