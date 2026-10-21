// Current release files only. Historical immutable shards may coexist on disk.
import fs from 'node:fs';
import path from 'node:path';

export function currentContentFiles(manifest) {
  if (!manifest || !Array.isArray(manifest.decks)) throw new Error('Invalid content manifest');
  const files = new Set(['manifest.json']);
  for (const deck of manifest.decks) {
    for (const shard of [...(deck.shards || []), ...(deck.indexShards || [])]) {
      const url = shard && shard.url;
      if (typeof url !== 'string' || !url.startsWith('content/') ||
          url.includes('\\') || url.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('Unsafe content shard URL: ' + url);
      }
      files.add(url.slice('content/'.length));
    }
  }
  return [...files].sort();
}

/**
 * T5（manifest 收紧）后的统一读取入口：
 * 公开的 `content/manifest.json` 只含元数据，分片路径存于鉴权产物 `server/content/shards.json`。
 * 本函数把二者合并回「完整 manifest」（decks 带 shards / indexShards），供仓库内构建/校验工具使用。
 * 若 shard map 不存在（旧版/兼容场景），原样返回 manifest（自带分片）。
 * @param {string} root 仓库根
 * @returns {object} 完整 manifest
 */
export function readFullManifest(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content', 'manifest.json'), 'utf8'));
  const shardMapPath = path.join(root, 'server', 'content', 'shards.json');
  if (!fs.existsSync(shardMapPath)) return manifest;
  const map = JSON.parse(fs.readFileSync(shardMapPath, 'utf8'));
  if (!map || map.schemaVersion !== 1 || !Array.isArray(map.decks)) return manifest;
  const byId = new Map(map.decks.map((d) => [d.id, d]));
  const decks = (manifest.decks || []).map((deck) => {
    const shardInfo = byId.get(deck.id);
    return shardInfo
      ? Object.assign({}, deck, { shards: shardInfo.shards || [], indexShards: shardInfo.indexShards || [] })
      : deck;
  });
  return Object.assign({}, manifest, { decks, contentVersion: manifest.contentVersion || map.contentVersion });
}
