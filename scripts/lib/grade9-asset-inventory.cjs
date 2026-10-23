'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const packageApi = require('./textbook-asset-package.cjs');
const { imageDimensions } = require('../../server/services/membership/image-dimensions');

const EXTRACTION = 'output/textbook-extractions/people-grade9-full-2013-20261015';
const LAUNCH = EXTRACTION + '/whole-book-launch-v1';
const SOURCE_FILES = ['docs/source-materials/people-grade9-full-2013.json', 'docs/source-materials/people-grade9-full-2013-supplement.json'];
const PRIOR_SUPPLEMENTS = ['Auld Lang Syne', 'Macau', 'San Francisco', 'Marcus', 'NBA', 'CBA', 'Carla', 'Kevin', 'Orson Welles', 'World War II', 'Titanic', 'Spider-Man', 'Carmen', 'Cali', 'Lausanne', 'Maria', 'Marie', 'New Zealand', 'Italy', 'Mars', 'Jessica', 'Luke'];
const CONFIRMED_BATCH = ['Katie', 'Holly', 'Matt', 'Carl', 'Jason', 'Hayes', 'Brian', 'Griffin', 'Trent', 'Bert', 'Thomas Watson', 'James Naismith', 'Paul Stoker', 'WildAid', 'WWF', 'Men in Black', 'Kung Fu Panda', 'March of the Penguins'];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function inventory(root) {
  const realRoot = fs.realpathSync(root);
  const extractionRoot = path.join(realRoot, EXTRACTION);
  const launchRoot = path.join(realRoot, LAUNCH);
  const course = readJson(path.join(launchRoot, 'textbook-ready-v1.json'));
  if (course.format !== 'textbook-wordbook-package' || course.book.bookId !== 'textbook-wordbook:pep-junior-grade9-full-2013' || course.drafts.length !== 14) throw new Error('Unexpected textbook identity');
  const fileMap = new Map();
  const gaps = [];
  const add = (sourcePath, archivePath, role) => {
    const safeSource = packageApi.packagePath(sourcePath);
    const safeArchive = packageApi.packagePath(archivePath);
    const full = path.resolve(realRoot, ...safeSource.split('/'));
    if (!full.startsWith(realRoot + path.sep)) throw new Error('Source path escapes workspace: ' + sourcePath);
    if (!fs.existsSync(full)) { gaps.push({ kind: 'missing-source-file', sourcePath }); return null; }
    const resolved = fs.realpathSync(full);
    if (!resolved.startsWith(realRoot + path.sep)) throw new Error('Source symlink escapes workspace: ' + sourcePath);
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink()) { gaps.push({ kind: 'non-regular-source-file', sourcePath }); return null; }
    const row = { sourcePath: safeSource, archivePath: safeArchive, sha256: packageApi.hashFile(full), bytes: stat.size, role, mediaType: packageApi.mimeFor(full) };
    const previous = fileMap.get(safeArchive);
    if (previous) {
      if (previous.sha256 !== row.sha256 || previous.bytes !== row.bytes) throw new Error('Archive content collision: ' + safeArchive);
      previous.sourcePaths.push(safeSource);
      previous.roles.push(role);
      return previous;
    }
    row.sourcePaths = [safeSource];
    row.roles = [role];
    fileMap.set(safeArchive, row);
    return row;
  };
  for (const entry of packageApi.walk(extractionRoot)) {
    if (entry.kind === 'symlink') { gaps.push({ kind: 'source-symlink-skipped', sourcePath: EXTRACTION + '/' + entry.path }); continue; }
    add(EXTRACTION + '/' + entry.path, 'sources/archive/' + entry.path, 'textbook-source-archive');
  }
  for (const file of SOURCE_FILES) add(file, 'sources/' + path.basename(file), 'textbook-transcription-source');
  const phonetics = [];
  const phoneticById = new Map();
  const phoneticByWord = new Map();
  const phoneticFileRows = [];
  let nonemptyPhonetics = 0;
  let pendingPhonetics = 0;
  for (let unit = 1; unit <= 14; unit += 1) {
    const sourcePath = LAUNCH + '/unit' + unit + '-phonetics-draft-v1.json';
    const draft = readJson(path.join(realRoot, ...sourcePath.split('/')));
    const archivePath = 'phonetics/unit' + unit + '-phonetics-draft-v1.json';
    const copied = add(sourcePath, archivePath, 'phonetics-draft');
    if (copied) phoneticFileRows.push({ path: archivePath, sha256: copied.sha256 });
    for (const entry of draft.items) {
      if (phoneticById.has(entry.itemId)) throw new Error('Duplicate phonetics itemId: ' + entry.itemId);
      if (entry.phonetic) nonemptyPhonetics += 1;
      else pendingPhonetics += 1;
      const item = { ...entry, path: archivePath };
      phonetics.push(item);
      phoneticById.set(entry.itemId, item);
      phoneticByWord.set(entry.word, item);
    }
  }
  const auditCopy = add(LAUNCH + '/phonetics-audit-v1.md', 'reviews/phonetics-audit-v1.md', 'phonetics-review-record');
  const deliveryByPath = new Map();
  const bindings = [];
  const units = [];
  const itemIds = new Set();
  for (const draft of course.drafts) {
    const unitId = draft.items[0] && draft.items[0].unitId;
    const unit = draft.book.units.find(row => row.unitId === unitId);
    if (!unit) throw new Error('Missing unit metadata ' + unitId);
    units.push({ unitId, title: unit.title, itemIds: draft.items.map(item => item.itemId) });
    for (const item of draft.items) {
      if (itemIds.has(item.itemId)) throw new Error('Duplicate course itemId: ' + item.itemId);
      itemIds.add(item.itemId);
      const phonetic = phoneticById.get(item.itemId);
      if (!phonetic || phonetic.word !== item.word) throw new Error('Course/phonetics identity mismatch: ' + item.itemId);
      const imageAssetIds = [];
      const originalAssetKeys = [...new Set([].concat(item.images && item.images.wide || [], item.images && item.images.mobile || []))];
      for (const key of originalAssetKeys) {
        if (!/^assets\/[A-Za-z0-9._-]+\.webp$/.test(key)) { gaps.push({ kind: 'invalid-delivery-key', itemId: item.itemId, key }); continue; }
        const full = path.resolve(realRoot, ...key.split('/'));
        if (!full.startsWith(path.join(realRoot, 'assets') + path.sep) || !fs.existsSync(full)) { gaps.push({ kind: 'missing-delivery-image', itemId: item.itemId, key }); continue; }
        if (!fs.realpathSync(full).startsWith(path.join(realRoot, 'assets') + path.sep)) throw new Error('Delivery symlink escapes assets: ' + key);
        const bytes = fs.readFileSync(full);
        const dimensions = imageDimensions(bytes, 'image/webp');
        if (bytes.length >= 20000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || !dimensions || dimensions[0] * 9 !== dimensions[1] * 16) throw new Error('Invalid delivery image: ' + key);
        const digest = crypto.createHash('sha256').update(bytes).digest('hex');
        const archivePath = 'images/delivery/' + digest + '.webp';
        add(key, archivePath, 'vocabulary-image-delivery');
        const assetId = 'sha256:' + digest;
        deliveryByPath.set(key, { assetId, path: archivePath, sha256: digest, bytes: bytes.length, width: dimensions[0], height: dimensions[1] });
        if (!imageAssetIds.includes(assetId)) imageAssetIds.push(assetId);
      }
      const match = item.itemId.match(/-u(\d+):/);
      const unitNumber = match ? Number(match[1]) : 0;
      bindings.push({
        itemId: item.itemId,
        unitId: item.unitId,
        word: item.word,
        imageAssetIds,
        originalAssetKeys,
        phonetics: { path: 'phonetics/unit' + unitNumber + '-phonetics-draft-v1.json', itemId: item.itemId },
        audioAssetIds: [],
        audio: []
      });
    }
  }
  if (bindings.length !== 628 || phonetics.length !== 628 || nonemptyPhonetics !== 619 || pendingPhonetics !== 9) throw new Error('Unexpected textbook totals');
  const priorSupplementIds = PRIOR_SUPPLEMENTS.map(word => phoneticByWord.get(word)?.itemId);
  const confirmedBatchIds = CONFIRMED_BATCH.map(word => phoneticByWord.get(word)?.itemId);
  if (priorSupplementIds.some(id => !id) || confirmedBatchIds.some(id => !id) || new Set([...priorSupplementIds, ...confirmedBatchIds]).size !== 40) throw new Error('Pronunciation review batch identity mismatch');
  const deferredItemIds = phonetics.filter(item => !item.phonetic).map(item => item.itemId);
  const confirmedItemIds = phonetics.filter(item => item.phonetic && !priorSupplementIds.includes(item.itemId)).map(item => item.itemId);
  const referenced = new Set(['ref/words-pic/split/masters/connect-with-v2.png']);
  const scan = value => {
    if (Array.isArray(value)) { value.forEach(scan); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && ['atlas', 'master', 'styleReference'].includes(key) && child.startsWith('ref/words-pic/')) referenced.add(child);
      else scan(child);
    }
  };
  for (const entry of packageApi.walk(extractionRoot).filter(file => file.kind === 'file' && file.path.endsWith('.json'))) {
    try { scan(readJson(path.join(extractionRoot, ...entry.path.split('/')))); } catch {}
  }
  const sourceOriginals = [];
  for (const sourcePath of [...referenced].sort()) {
    const role = sourcePath.includes('/atlases/') ? 'illustration-atlas' : sourcePath.includes('/masters/') ? 'illustration-master' : 'approved-style-reference';
    const full = path.resolve(realRoot, ...packageApi.packagePath(sourcePath).split('/'));
    if (!full.startsWith(realRoot + path.sep) || !fs.existsSync(full)) { gaps.push({ kind: 'unresolved-original-reference', sourcePath }); continue; }
    const digest = packageApi.hashFile(full);
    const extension = path.extname(sourcePath).toLowerCase() || '.bin';
    const archivePath = 'images/originals/' + digest + extension;
    const row = add(sourcePath, archivePath, role);
    if (row) sourceOriginals.push({ sourcePath, path: archivePath, sha256: row.sha256, bytes: row.bytes, role });
  }
  const assets = [...new Map([...deliveryByPath.values()].map(asset => [asset.assetId, asset])).values()];
  const sourceFingerprint = crypto.createHash('sha256').update(fs.readFileSync(path.join(launchRoot, 'textbook-ready-v1.json'))).digest('hex');
  return {
    format: 'textbook-asset-inventory', schemaVersion: 1, generatedAt: new Date().toISOString(), workspaceId: 'chunk-practice',
    bookId: course.book.bookId, book: course.book, sourceFingerprint, sourceRoot: EXTRACTION,
    units, bindings, phonetics, phoneticFiles: phoneticFileRows, sourceOriginals, assets,
    audit: auditCopy ? { path: auditCopy.archivePath, sha256: auditCopy.sha256 } : null,
    approval: { status: 'mixed', confirmedDate: '2026-10-21', phonetics: phoneticFileRows, audit: auditCopy && auditCopy.sha256, confirmedItemIds, pendingReviewItemIds: priorSupplementIds, deferredItemIds },
    audioAssets: [], audioStatus: 'not-produced',
    counts: { units: units.length, items: bindings.length, sourceImagePaths: new Set(bindings.flatMap(binding => binding.originalAssetKeys)).size,
      uniqueImages: assets.length, nonemptyPhonetics, pendingPhonetics, approvedPhonetics: confirmedItemIds.length,
      pendingReviewPhonetics: priorSupplementIds.length, sourceOriginals: sourceOriginals.length, audio: 0 },
    files: [...fileMap.values()].sort((a, b) => a.archivePath.localeCompare(b.archivePath)),
    gaps: gaps.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  };
}

module.exports = { inventory };
