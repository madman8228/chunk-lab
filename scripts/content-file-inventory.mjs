// Current release files only. Historical immutable shards may coexist on disk.
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
