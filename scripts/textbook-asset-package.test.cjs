'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const api = require('./lib/textbook-asset-package.cjs');
const { imageDimensions } = require('../server/services/membership/image-dimensions');

const root = path.resolve(__dirname, '..');
const sampleImage = fs.readFileSync(path.join(root, 'assets/vocab-u1-textbook-wide-v2.webp'));
const imageHash = crypto.createHash('sha256').update(sampleImage).digest('hex');
const ids = ['pep-g9-2013-u1:01', 'pep-g9-2013-u1:02'];

function buildFixture(directory, { tamperImage = false, duplicateId = false, audioText = null, symlink = false } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(directory, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'phonetics'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'images/delivery'), { recursive: true });
  const secondId = duplicateId ? ids[0] : ids[1];
  const snapshot = {
    format: 'textbook-wordbook-package',
    drafts: [{ items: [
      { itemId: ids[0], unitId: 'pep-g9-2013-unit-1', word: 'textbook', meaning: '课本', exercise: { parts: [{ text: 'I keep my ' }, { answers: ['textbook'] }, { text: '.' }] } },
      { itemId: secondId, unitId: 'pep-g9-2013-unit-1', word: 'notebook', meaning: '笔记本', exercise: { parts: [{ text: 'Hello ' }, { answers: ['friend'] }, { text: '.' }] } }
    ] }]
  };
  const phonetics = { items: [
    { itemId: ids[0], word: 'textbook', phonetic: '', status: 'needs-source-check' },
    { itemId: secondId, word: 'notebook', phonetic: '/ˈnəʊtbʊk/', status: 'transcribed' }
  ] };
  fs.writeFileSync(path.join(directory, 'sources/course.json'), JSON.stringify(snapshot));
  fs.writeFileSync(path.join(directory, 'phonetics/unit1.json'), JSON.stringify(phonetics));
  const imagePath = path.join(directory, 'images/delivery', imageHash + '.webp');
  fs.writeFileSync(imagePath, tamperImage ? Buffer.from('bad image') : sampleImage);
  const dimensions = imageDimensions(sampleImage, 'image/webp');
  const assets = [{ assetId: 'sha256:' + imageHash, path: 'images/delivery/' + imageHash + '.webp', sha256: imageHash, bytes: sampleImage.length, width: dimensions[0], height: dimensions[1] }];
  const sentenceBytes = Buffer.from('test-audio');
  const sentenceHash = crypto.createHash('sha256').update(sentenceBytes).digest('hex');
  const audioAssets = audioText === null ? [] : [{ itemId: secondId, kind: 'sentence', text: audioText, path: 'audio/sentence.mp3', sha256: sentenceHash, assetId: 'sha256:' + sentenceHash }];
  const files = [
    { path: 'sources/course.json', sha256: api.sha256(fs.readFileSync(path.join(directory, 'sources/course.json'))), bytes: fs.statSync(path.join(directory, 'sources/course.json')).size, mediaType: 'application/json' },
    { path: 'phonetics/unit1.json', sha256: api.sha256(fs.readFileSync(path.join(directory, 'phonetics/unit1.json'))), bytes: fs.statSync(path.join(directory, 'phonetics/unit1.json')).size, mediaType: 'application/json' },
    { path: assets[0].path, sha256: assets[0].sha256, bytes: assets[0].bytes, mediaType: 'image/webp' }
  ];
  const bindings = [ids[0], secondId].map(itemId => ({ itemId, unitId: 'pep-g9-2013-unit-1', word: itemId === ids[0] ? 'textbook' : 'notebook', imageAssetIds: ['sha256:' + imageHash], audioAssetIds: [], audio: [], phonetics: { path: 'phonetics/unit1.json', itemId } }));
  if (audioAssets.length) {
    fs.mkdirSync(path.join(directory, 'audio'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'audio/sentence.mp3'), sentenceBytes);
    files.push({ path: 'audio/sentence.mp3', sha256: sentenceHash, bytes: sentenceBytes.length, mediaType: 'audio/mpeg' });
    bindings[1].audioAssetIds.push('sha256:' + sentenceHash);
    bindings[1].audio.push({ kind: 'sentence', assetId: 'sha256:' + sentenceHash, text: audioText });
  }
  const manifest = {
    format: 'textbook-asset-package', schemaVersion: 1,
    book: { bookId: 'textbook-wordbook:sample', title: 'sample' },
    content: { courseSnapshot: 'sources/course.json' },
    counts: { items: 2, units: 1, uniqueImages: 1, nonemptyPhonetics: 1, pendingPhonetics: 1, approvedPhonetics: 1, pendingReviewPhonetics: 0 },
    units: [{ unitId: 'pep-g9-2013-unit-1', title: 'Unit 1', itemIds: [ids[0], secondId] }],
    bindings, phonetics: phonetics.items.map((item, index) => ({ ...item, approval: index ? 'user-confirmed' : 'deferred-by-owner', path: 'phonetics/unit1.json' })),
    phoneticFiles: [{ path: 'phonetics/unit1.json' }], assets, audioAssets, files,
    reviews: { phonetics: { confirmedItemIds: [ids[1]], pendingReviewItemIds: [], deferredItemIds: [ids[0]] } }
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(directory, 'manifest.json'), manifestBytes);
  const checksumRows = [{ path: 'manifest.json', sha256: api.sha256(manifestBytes), bytes: manifestBytes.length }, ...files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }))];
  fs.writeFileSync(path.join(directory, 'checksums.json'), JSON.stringify({ format: 'textbook-asset-checksums', schemaVersion: 1, files: checksumRows }));
  if (symlink) fs.symlinkSync(path.join(directory, 'sources'), path.join(directory, 'linked-source'), 'junction');
  return { manifest, imagePath, directory };
}

test('asset package verifies shared images and allows intentionally pending phonetics', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-assets-valid-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixture = buildFixture(directory);
  const verified = api.verifyPackage(directory);
  assert.equal(verified.items, 2);
  assert.equal(verified.uniqueImages, 1);
  assert.equal(verified.pendingPhonetics, 1);
  assert.equal(fixture.manifest.bindings[0].imageAssetIds[0], fixture.manifest.bindings[1].imageAssetIds[0]);
});

test('asset package rejects altered payload, duplicate identities, bad audio text and symlinks', t => {
  for (const [name, options, message] of [
    ['bad-image', { tamperImage: true }, /invalid delivery image bytes/],
    ['duplicate-id', { duplicateId: true }, /duplicate itemId/],
    ['wrong-audio-text', { audioText: 'Wrong sentence.' }, /audio text does not match/],
    ['symlink', { symlink: true }, /symlink in package/]
  ]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-assets-' + name + '-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    buildFixture(directory, options);
    assert.throws(() => api.verifyPackage(directory), message, name);
  }
});

test('package paths reject traversal, drive paths, UNC paths and backslashes', () => {
  for (const value of ['../escape', 'C:/escape', '//server/share', 'sources\\file.json']) assert.throws(() => api.packagePath(value));
});

test('tampering with an image after manifest creation is detected', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-assets-tamper-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixture = buildFixture(directory);
  fs.writeFileSync(fixture.imagePath, 'changed');
  assert.throws(() => api.verifyPackage(directory), /file mismatch|invalid delivery image bytes/);
});
