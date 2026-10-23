'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const draftDir = path.join(root, 'output/textbook-extractions/people-grade9-full-2013-20261015/whole-book-launch-v1');
const htmlPath = path.join(__dirname, 'textbook-phonetics-review.html');
const packageApi = require('./lib/textbook-asset-package.cjs');

function readReviewData() {
  const book = JSON.parse(fs.readFileSync(path.join(draftDir, 'textbook-ready-v1.json'), 'utf8'));
  const units = [];
  for (let number = 1; number <= 14; number += 1) {
    const phonetics = JSON.parse(fs.readFileSync(path.join(draftDir, `unit${number}-phonetics-draft-v1.json`), 'utf8'));
    const source = book.drafts[number - 1];
    if (!source || source.items.length !== phonetics.items.length) throw new Error(`Unit ${number} item count mismatch`);
    const items = phonetics.items.map((entry, index) => {
      const original = source.items[index];
      if (!original || original.itemId !== entry.itemId || original.word !== entry.word) throw new Error(`Unit ${number} identity mismatch at row ${index + 1}`);
      return {
        itemId: entry.itemId,
        word: entry.word,
        meaning: original.meaning,
        phonetic: entry.phonetic,
        status: entry.status,
        sourcePage: entry.sourcePage ?? null,
        sourceUrl: entry.sourceUrl ?? null,
        note: entry.note ?? ''
      };
    });
    units.push({ id: phonetics.items[0]?.itemId.split(':')[0].replace(/-\d+$/, '') || `unit-${number}`, title: `Unit ${number}`, items });
  }
  return { bookTitle: book.book.title, units };
}

function readPackageReviewData(packageDir, checked = packageApi.verifyPackage(packageDir)) {
  const manifest = checked.manifest;
  const snapshot = JSON.parse(fs.readFileSync(packageApi.inside(packageDir, manifest.content.courseSnapshot), 'utf8'));
  const source = new Map(snapshot.drafts.flatMap(draft => draft.items).map(item => [item.itemId, item]));
  const phonetics = new Map(manifest.phonetics.map(item => [item.itemId, item]));
  const bindings = new Map(manifest.bindings.map(item => [item.itemId, item]));
  const units = manifest.units.map(unit => ({
    id: unit.unitId,
    title: unit.title,
    items: unit.itemIds.map(itemId => {
      const item = source.get(itemId), phonetic = phonetics.get(itemId), binding = bindings.get(itemId);
      return {
        itemId, word: item.word, meaning: item.meaning, phonetic: phonetic.phonetic || '',
        status: phonetic.status, sourcePage: phonetic.sourcePage ?? null,
        sourceUrl: phonetic.sourceUrl ?? null, note: phonetic.note || '',
        approval: phonetic.approval, imageUrl: binding.imageAssetIds[0] ? '/package-images/' + binding.imageAssetIds[0].slice('sha256:'.length) + '.webp' : null
      };
    })
  }));
  return {
    bookTitle: manifest.book.title, units,
    packageInfo: {
      packageVersion: manifest.packageVersion, uniqueImages: manifest.counts.uniqueImages,
      nonemptyPhonetics: manifest.counts.nonemptyPhonetics, pendingPhonetics: manifest.counts.pendingPhonetics,
      approvedPhonetics: manifest.counts.approvedPhonetics, pendingReviewPhonetics: manifest.counts.pendingReviewPhonetics,
      audioStatus: manifest.audioStatus, pendingLabel: '暂不补充', completeness: manifest.completeness.status
    }
  };
}

function createReviewServer({ packageDir = null } = {}) {
const packageRoot = packageDir ? fs.realpathSync(packageDir) : null;
const packageCheck = packageRoot ? packageApi.verifyPackage(packageRoot) : null;
const reviewData = packageRoot ? readPackageReviewData(packageRoot, packageCheck) : null;
const imageByHash = new Map(packageCheck ? packageCheck.manifest.assets.map(asset => [asset.sha256, asset]) : []);
return http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end();
  }
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  let body;
  let contentType;
  try {
    if (pathname === '/' || pathname === '/textbook-phonetics-review.html') {
      body = fs.readFileSync(htmlPath);
      contentType = 'text/html; charset=utf-8';
    } else if (pathname === '/phonetics-data.json') {
      body = JSON.stringify(reviewData || readReviewData());
      contentType = 'application/json; charset=utf-8';
    } else if (packageRoot && /^\/package-images\/[a-f0-9]{64}\.webp$/.test(pathname)) {
      const digest = pathname.slice('/package-images/'.length, -'.webp'.length), asset = imageByHash.get(digest);
      if (!asset) { response.writeHead(404); return response.end('Not found'); }
      body = fs.readFileSync(packageApi.inside(packageRoot, asset.path));
      if (packageApi.sha256(body) !== asset.sha256 || body.length !== asset.bytes) { response.writeHead(500, { 'Cache-Control': 'no-store' }); return response.end('Asset integrity check failed'); }
      contentType = 'image/webp';
    } else {
      response.writeHead(404);
      return response.end('Not found');
    }
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return response.end(`Review data unavailable: ${error.message}`);
  }
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'"
  });
  response.end(request.method === 'HEAD' ? undefined : body);
});
}

if (require.main === module) {
  const packageIndex = process.argv.indexOf('--package');
  const packageDir = packageIndex >= 0 ? path.resolve(process.argv[packageIndex + 1] || '') : null;
  const port = Number(process.env.PHONETICS_REVIEW_PORT || 4189);
  const server = createReviewServer({ packageDir });
  server.listen(port, '127.0.0.1', () => console.log(`Textbook phonetics review: http://127.0.0.1:${port}/textbook-phonetics-review.html`));
}

module.exports = { createReviewServer, readPackageReviewData, readReviewData };
