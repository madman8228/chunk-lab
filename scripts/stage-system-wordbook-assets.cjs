'use strict';

const fs = require('node:fs');
const path = require('node:path');
require('../server/loadenv');

async function main() {
  const [importId, sourceDirectory] = process.argv.slice(2);
  if (!importId || !sourceDirectory) throw Error('Usage: node scripts/stage-system-wordbook-assets.cjs <draft-id> <assets-directory>');
  const appRoot = process.env.CHUNKLAB_APP_ROOT || path.resolve(__dirname, '..');
  const dataDirectory = process.env.CHUNKLAB_DATA_DIR || path.join(appRoot, 'server', 'data');
  const publicationRoot = path.join(dataDirectory, 'wordbook-publications');
  const versions = require('../server/services/public-wordbook-versions').createPublicWordbookVersions({ publishedRoot: publicationRoot });
  const content = require('../server/services/vocabulary-content').createVocabularyContent({ appRoot, publishedRoot: publicationRoot, versions });
  const imageDelivery = require('../server/middleware/vocabulary-image-delivery').configuredVocabularyImageDelivery(appRoot, process.env, { publishedRoot: content.publicationDirectory });
  const publisher = require('../server/services/wordbook-publisher').createWordbookPublisher({ appRoot, content, versions, checkImageAliases: imageDelivery.checkAliases });
  const service = require('../server/services/admin-wordbook-imports').createAdminWordbookImports({
    appRoot,
    dataDirectory: path.join(dataDirectory, 'system-wordbook-imports'),
    publisher,
    checkAliases: imageDelivery.checkAliases,
  });
  const detail = service.detail(importId);
  if (detail.published || detail.operation !== 'update' || detail.bookId !== 'textbook-wordbook:pep-junior-grade9-full-2013') {
    throw Error('指定草稿不是未发布的人教版英语九年级全一册修正版；未写入任何素材');
  }
  const source = path.resolve(sourceDirectory);
  if (!fs.statSync(source).isDirectory()) throw Error('素材来源必须是目录');
  const files = new Map();
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (files.has(entry.name)) throw Error(`素材目录有重名文件：${entry.name}`);
    files.set(entry.name, path.join(source, entry.name));
  }
  const missing = detail.assets.filter(asset => asset.missing);
  const entries = missing.map(asset => {
    const filename = path.basename(asset.url), file = files.get(filename);
    if (!file) throw Error(`来源目录缺少草稿所需素材：${filename}`);
    return { filename, file };
  });
  let added = 0, alreadyPresent = 0;
  for (let offset = 0; offset < entries.length; offset += 100) {
    const batch = entries.slice(offset, offset + 100).map(entry => ({ filename: entry.filename, bytes: fs.readFileSync(entry.file) }));
    const result = service.uploadBatch(importId, batch);
    added += result.added;
    alreadyPresent += result.alreadyPresent;
    console.log(`素材批次 ${Math.min(offset + batch.length, entries.length)} / ${entries.length}：新增 ${result.added}，已存在 ${result.alreadyPresent}`);
  }
  const final = service.detail(importId);
  console.log(JSON.stringify({ importId, bookId: final.bookId, totalAssets: final.assets.length, missingAssets: final.assets.filter(asset => asset.missing).length, added, alreadyPresent }, null, 2));
  if (final.assets.some(asset => asset.missing)) throw Error('批量暂存后仍有缺失素材');
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
