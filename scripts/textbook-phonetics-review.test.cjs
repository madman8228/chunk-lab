'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createReviewServer, readReviewData } = require('./serve-textbook-phonetics-review.cjs');
const packageApi = require('./lib/textbook-asset-package.cjs');

const root = path.resolve(__dirname, '..');
function makePackage(directory) {
  fs.mkdirSync(path.join(directory, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'phonetics'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'images/delivery'), { recursive: true });
  const image = fs.readFileSync(path.join(root, 'assets/vocab-u1-textbook-wide-v2.webp'));
  const digest = crypto.createHash('sha256').update(image).digest('hex');
  const item = { itemId: 'pep-g9-2013-u1:01', unitId: 'pep-g9-2013-unit-1', word: 'textbook', meaning: '课本', images: {}, exercise: { parts: [{ text: 'I keep my textbook.' }] } };
  const snapshot = { book: { title: '教材包预览测试' }, drafts: [{ items: [item] }] };
  const phonetic = { itemId: item.itemId, word: item.word, phonetic: '', status: 'needs-source-check', note: '暂不补充' };
  fs.writeFileSync(path.join(directory, 'sources/course.json'), JSON.stringify(snapshot));
  fs.writeFileSync(path.join(directory, 'phonetics/unit1.json'), JSON.stringify({ items: [phonetic] }));
  const imageRelative = 'images/delivery/' + digest + '.webp';
  fs.writeFileSync(path.join(directory, ...imageRelative.split('/')), image);
  const stat = fs.statSync(path.join(directory, ...imageRelative.split('/')));
  const imageFile = { path: imageRelative, sha256: digest, bytes: stat.size, mediaType: 'image/webp' };
  const files = [
    { path: 'sources/course.json', sha256: packageApi.hashFile(path.join(directory, 'sources/course.json')), bytes: fs.statSync(path.join(directory, 'sources/course.json')).size, mediaType: 'application/json' },
    { path: 'phonetics/unit1.json', sha256: packageApi.hashFile(path.join(directory, 'phonetics/unit1.json')), bytes: fs.statSync(path.join(directory, 'phonetics/unit1.json')).size, mediaType: 'application/json' },
    imageFile
  ];
  const manifest = {
    format: 'textbook-asset-package', schemaVersion: 1,
    book: { bookId: 'textbook-wordbook:sample', title: '教材包预览测试' },
    content: { courseSnapshot: 'sources/course.json' },
    units: [{ unitId: item.unitId, title: 'Unit 1', itemIds: [item.itemId] }],
    bindings: [{ itemId: item.itemId, unitId: item.unitId, word: item.word, imageAssetIds: ['sha256:' + digest], audioAssetIds: [], audio: [], phonetics: { path: 'phonetics/unit1.json', itemId: item.itemId } }],
    phonetics: [{ ...phonetic, approval: 'deferred-by-owner', path: 'phonetics/unit1.json' }], phoneticFiles: [{ path: 'phonetics/unit1.json' }],
    reviews: { phonetics: { confirmedItemIds: [], pendingReviewItemIds: [], deferredItemIds: [item.itemId] } },
    assets: [{ assetId: 'sha256:' + digest, path: imageRelative, sha256: digest, bytes: stat.size }], audioAssets: [], audioStatus: 'not-produced',
    counts: { units: 1, items: 1, uniqueImages: 1, nonemptyPhonetics: 0, pendingPhonetics: 1, approvedPhonetics: 0, pendingReviewPhonetics: 0 },
    completeness: { status: 'complete' }, files
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, 'manifest.json'), manifestBytes);
  const checks = [{ path: 'manifest.json', sha256: packageApi.sha256(manifestBytes), bytes: manifestBytes.length }, ...files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }))];
  fs.writeFileSync(path.join(directory, 'checksums.json'), JSON.stringify({ format: 'textbook-asset-checksums', schemaVersion: 1, files: checks }));
}

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}

test('package review server reads the archived draft, serves verified images, and stays read-only', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phonetics-package-review-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  makePackage(directory);
  const server = createReviewServer({ packageDir: directory });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = await listen(server);
  const dataResponse = await fetch(base + '/phonetics-data.json');
  assert.equal(dataResponse.status, 200);
  const data = await dataResponse.json();
  assert.equal(data.bookTitle, '教材包预览测试');
  assert.equal(data.units[0].items[0].approval, 'deferred-by-owner');
  assert.equal(data.units[0].items[0].imageUrl.startsWith('/package-images/'), true);
  const image = await fetch(base + data.units[0].items[0].imageUrl);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/webp');
  assert.equal(packageApi.sha256(Buffer.from(await image.arrayBuffer())), data.units[0].items[0].imageUrl.split('/').at(-1).slice(0, 64));
  const head = await fetch(base + data.units[0].items[0].imageUrl, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await fetch(base + '/package-images/' + '0'.repeat(64) + '.webp')).status, 404);
  assert.equal((await fetch(base + '/phonetics-data.json', { method: 'POST' })).status, 405);
  assert.match(await (await fetch(base + '/')).text(), /教材音标审查/);
});

test('legacy review mode remains available and invalid packages fail closed', t => {
  const legacy = readReviewData();
  assert.equal(legacy.units.length, 14);
  assert.equal(legacy.units.reduce((sum, unit) => sum + unit.items.length, 0), 628);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phonetics-invalid-package-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.throws(() => createReviewServer({ packageDir: directory }));
});
