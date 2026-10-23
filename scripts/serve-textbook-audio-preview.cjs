'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const packageApi = require('./lib/textbook-asset-package.cjs');

const previewPath = path.join(__dirname, 'textbook-audio-preview.html');

function createPreviewServer(packageDir) {
  const packageRoot = fs.realpathSync(packageDir);
  const checked = packageApi.verifyPackage(packageRoot);
  const manifest = checked.manifest;
  const snapshot = JSON.parse(fs.readFileSync(packageApi.inside(packageRoot, manifest.content.courseSnapshot), 'utf8'));
  const items = new Map(snapshot.drafts.flatMap(draft => draft.items).map(item => [item.itemId, item]));
  const phonetics = new Map(manifest.phonetics.map(item => [item.itemId, item]));
  const bindings = new Map(manifest.bindings.map(item => [item.itemId, item]));
  const audio = new Map(manifest.audioAssets.map(item => [item.assetId, item]));
  const wordAudioCount = manifest.audioAssets.filter(item => item.kind === 'word').length;
  const sentenceAudioCount = manifest.audioAssets.filter(item => item.kind === 'sentence').length;
  const assets = new Map(manifest.assets.map(item => [item.sha256, item]));
  const course = {
    title: manifest.book.title,
    totalItems: manifest.counts.items,
    wordAudioCount,
    sentenceAudioCount,
    units: manifest.units.map(unit => ({
      id: unit.unitId,
      title: unit.title,
      items: unit.itemIds.map(itemId => {
        const item = items.get(itemId), binding = bindings.get(itemId);
        const audioItem = binding.audioAssetIds.map(id => audio.get(id)).find(entry => entry?.kind === 'word');
        const sentenceAudioItem = binding.audioAssetIds.map(id => audio.get(id)).find(entry => entry?.kind === 'sentence');
        const image = binding.imageAssetIds.map(id => assets.get(id.slice('sha256:'.length))).find(Boolean);
        if (!item) throw new Error(`Course item missing from snapshot: ${itemId}`);
        return {
          itemId, word: item.word, meaning: item.meaning, scene: item.scene || '', translation: item.translation || '',
          example: (item.exercise?.parts || []).map(part => typeof part.text === 'string' ? part.text : (part.label || part.answers?.[0] || '')).join(''),
          phonetic: phonetics.get(itemId)?.phonetic || '',
          imageUrl: image ? `/images/${image.sha256}.webp` : '',
          audioUrl: audioItem ? `/audio/${audioItem.sha256}.ogg` : '',
          sentenceAudioUrl: sentenceAudioItem ? `/audio/${sentenceAudioItem.sha256}.ogg` : ''
        };
      })
    }))
  };
  const byHash = new Map([...manifest.assets.map(asset => [asset.sha256, asset]), ...manifest.audioAssets.map(asset => [asset.sha256, asset])]);

  return http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      return response.end();
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    let body, type;
    if (pathname === '/' || pathname === '/textbook-audio-preview.html') {
      body = fs.readFileSync(previewPath); type = 'text/html; charset=utf-8';
    } else if (pathname === '/api/course') {
      body = Buffer.from(JSON.stringify(course)); type = 'application/json; charset=utf-8';
    } else {
      const match = pathname.match(/^\/(images|audio)\/([a-f0-9]{64})\.(webp|ogg)$/);
      if (!match || (match[1] === 'images' && match[3] !== 'webp') || (match[1] === 'audio' && match[3] !== 'ogg')) {
        response.writeHead(404); return response.end('Not found');
      }
      const asset = byHash.get(match[2]);
      if (!asset || (match[1] === 'images' && !manifest.assets.includes(asset)) || (match[1] === 'audio' && !manifest.audioAssets.includes(asset))) {
        response.writeHead(404); return response.end('Not found');
      }
      body = fs.readFileSync(packageApi.inside(packageRoot, asset.path));
      if (packageApi.sha256(body) !== asset.sha256 || body.length !== asset.bytes) {
        response.writeHead(500, { 'Cache-Control': 'no-store' }); return response.end('Asset integrity check failed');
      }
      type = match[1] === 'images' ? 'image/webp' : 'audio/ogg';
    }
    response.writeHead(200, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
}

if (require.main === module) {
  const packageIndex = process.argv.indexOf('--package');
  const packageDir = packageIndex >= 0 ? path.resolve(process.argv[packageIndex + 1] || '') : '';
  if (!packageDir) throw new Error('Usage: node scripts/serve-textbook-audio-preview.cjs --package <verified-package-directory>');
  const port = Number(process.env.TEXTBOOK_AUDIO_PREVIEW_PORT || 4195);
  createPreviewServer(packageDir).listen(port, '127.0.0.1', () => console.log(`Read-only textbook audio preview: http://127.0.0.1:${port}/`));
}

module.exports = { createPreviewServer };
