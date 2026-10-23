'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const pagePath = path.join(__dirname, 'textbook-audio-review.html');
const DEFAULT_ASSET_ROOT = 'E:/chunk-practice-asset-sources/textbooks';
const BOOKS = {
  'pep-junior-grade7-upper-2024': {
    title: '人教版英语七年级上册（2024）',
    wordBatch: '20261021-audio-queue-v2',
    sentenceBatch: '20261022-sentence-audio-v1',
  },
  'pep-junior-grade7-lower-2024': {
    title: '人教版英语七年级下册（2024）',
    wordBatch: '20261021-audio-queue-v2',
    sentenceBatch: '20261022-sentence-audio-v1',
  },
};

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function loadBook(assetRoot, slug) {
  const config = BOOKS[slug];
  if (!config) throw new Error(`Unsupported book: ${slug}`);
  const bookRoot = path.join(assetRoot, slug, 'audio-batches');
  const wordRoot = path.join(bookRoot, config.wordBatch);
  const sentenceRoot = path.join(bookRoot, config.sentenceBatch);
  const wordQueue = readJson(path.join(wordRoot, 'audio-task-queue.json'));
  const sentenceQueue = readJson(path.join(sentenceRoot, 'audio-task-queue.json'));
  const wordManifest = readJson(path.join(wordRoot, 'delivery-manifest.json'));
  const sentenceManifest = readJson(path.join(sentenceRoot, 'delivery-manifest.json'));
  if (wordQueue.book.bookId !== sentenceQueue.book.bookId
      || wordQueue.source.sha256 !== sentenceQueue.source.sha256
      || wordManifest.bookId !== wordQueue.book.bookId
      || sentenceManifest.bookId !== wordQueue.book.bookId
      || wordManifest.format !== 'textbook-audio-delivery'
      || sentenceManifest.format !== 'textbook-sentence-audio-delivery'
      || wordManifest.publishable !== false
      || sentenceManifest.publishable !== false) {
    throw new Error(`Audio batch identity or review stage mismatch: ${slug}`);
  }

  const translations = new Map();
  for (const entry of fs.readdirSync(bookRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.includes('sentence-drafts')) continue;
    const draftRoot = path.join(bookRoot, entry.name);
    for (const file of fs.readdirSync(draftRoot).filter(name => name.endsWith('.json'))) {
      const draft = readJson(path.join(draftRoot, file));
      for (const row of draft.sentences || []) translations.set(row.itemId, row);
    }
  }

  const words = new Map(wordQueue.tasks.filter(task => task.kind === 'word').map(task => [task.itemId, task]));
  const sentences = new Map(sentenceQueue.tasks.filter(task => task.kind === 'sentence').map(task => [task.itemId, task]));
  const wordAudio = new Map(wordManifest.records.map(record => [record.itemId, record]));
  const sentenceAudio = new Map(sentenceManifest.records.map(record => [record.itemId, record]));
  const wordFiles = new Map(wordManifest.files.map(file => [path.posix.basename(file.path, '.ogg'), { ...file, root: wordRoot }]));
  const sentenceFiles = new Map(sentenceManifest.files.map(file => [path.posix.basename(file.path, '.ogg'), { ...file, root: sentenceRoot }]));
  if (!words.size || words.size !== sentences.size || words.size !== wordAudio.size || words.size !== sentenceAudio.size) {
    throw new Error(`Word/sentence item counts do not agree: ${slug}`);
  }

  const units = new Map();
  for (const word of words.values()) {
    const sentence = sentences.get(word.itemId);
    const sentenceRow = translations.get(word.itemId);
    const wordRecord = wordAudio.get(word.itemId);
    const sentenceRecord = sentenceAudio.get(word.itemId);
    if (!sentence || !sentenceRow || !wordRecord || !sentenceRecord
        || word.status !== 'generated' || sentence.status !== 'generated'
        || sentence.spokenText !== sentenceRecord.spokenText) {
      throw new Error(`Missing or mismatched item audio/text: ${slug} ${word.itemId}`);
    }
    const unitId = word.unitId;
    if (!units.has(unitId)) units.set(unitId, { id: unitId, title: word.unit, items: [] });
    units.get(unitId).items.push({
      itemId: word.itemId,
      word: word.displayText,
      meaning: word.meaning || '',
      sentence: sentence.spokenText,
      chinese: sentenceRow.chinese || '',
      wordAudioUrl: `/audio/${slug}/word/${wordRecord.deliverySha256}.ogg`,
      sentenceAudioUrl: `/audio/${slug}/sentence/${sentenceRecord.deliverySha256}.ogg`,
    });
  }

  for (const [kind, manifest, fileMap] of [
    ['word', wordManifest, wordFiles],
    ['sentence', sentenceManifest, sentenceFiles],
  ]) {
    for (const record of manifest.records) {
      const asset = fileMap.get(record.deliverySha256);
      if (!asset || asset.bytes !== record.deliveryBytes || asset.sha256 !== record.deliverySha256) {
        throw new Error(`Delivery manifest/file mismatch: ${slug} ${kind} ${record.itemId}`);
      }
    }
  }

  return {
    slug,
    title: config.title,
    totalItems: words.size,
    wordAudioCount: wordAudio.size,
    sentenceAudioCount: sentenceAudio.size,
    units: [...units.values()],
    files: new Map([
      ...[...wordFiles].map(([hash, file]) => [`${slug}/word/${hash}`, file]),
      ...[...sentenceFiles].map(([hash, file]) => [`${slug}/sentence/${hash}`, file]),
    ]),
  };
}

function createAudioReviewServer({ assetRoot = DEFAULT_ASSET_ROOT, books = Object.keys(BOOKS) } = {}) {
  const root = fs.realpathSync(assetRoot);
  const loaded = books.map(slug => loadBook(root, slug));
  const bySlug = new Map(loaded.map(book => [book.slug, book]));
  const files = new Map(loaded.flatMap(book => [...book.files]));

  return http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      return response.end();
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    let body;
    let type;
    if (pathname === '/' || pathname === '/textbook-audio-review.html') {
      body = fs.readFileSync(pagePath);
      type = 'text/html; charset=utf-8';
    } else if (pathname === '/api/books') {
      body = Buffer.from(JSON.stringify(loaded.map(({ slug, title, totalItems, wordAudioCount, sentenceAudioCount, units }) => ({
        slug, title, totalItems, wordAudioCount, sentenceAudioCount,
        units: units.map(({ id, title: unitTitle }) => ({ id, title: unitTitle })),
      }))));
      type = 'application/json; charset=utf-8';
    } else if (pathname.startsWith('/api/course/')) {
      const slug = pathname.slice('/api/course/'.length);
      const book = bySlug.get(slug);
      if (!book) {
        response.writeHead(404);
        return response.end();
      }
      body = Buffer.from(JSON.stringify({
        title: book.title,
        totalItems: book.totalItems,
        wordAudioCount: book.wordAudioCount,
        sentenceAudioCount: book.sentenceAudioCount,
        units: book.units,
      }));
      type = 'application/json; charset=utf-8';
    } else {
      const match = pathname.match(/^\/audio\/([^/]+)\/(word|sentence)\/([a-f0-9]{64})\.ogg$/);
      const asset = match && files.get(`${match[1]}/${match[2]}/${match[3]}`);
      if (!asset) {
        response.writeHead(404);
        return response.end();
      }
      body = fs.readFileSync(path.join(asset.root, 'delivery', `${match[3]}.ogg`));
      if (body.length !== asset.bytes || sha256(body) !== asset.sha256) {
        response.writeHead(500, { 'Cache-Control': 'no-store' });
        return response.end('Audio integrity check failed');
      }
      type = 'audio/ogg';
    }
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const value = name => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const root = value('--assets-root') || DEFAULT_ASSET_ROOT;
  const port = Number(value('--port') || process.env.TEXTBOOK_AUDIO_REVIEW_PORT || 4210);
  const books = args.flatMap((arg, index) => arg === '--book' && args[index + 1] ? [args[index + 1]] : []);
  createAudioReviewServer({ assetRoot: root, books: books.length ? books : Object.keys(BOOKS) })
    .listen(port, '127.0.0.1', () => console.log(`Read-only textbook audio sample review: http://127.0.0.1:${port}/`));
}

module.exports = { createAudioReviewServer, loadBook };
