'use strict';
const crypto = require('node:crypto');
const ID = /^[A-Za-z0-9:._-]{1,160}$/;
const MAX_FRAGMENT_BYTES = 128 * 1024;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => Object.assign(new Error(code), { code, status: 422 });

// The compiler owns structure, never storage or publication. Preserve every teaching field.
class StaticFragmentBuilder {
  build({ courseId, unitId, contentType, content, itemIds, assets = [], recordIdentity }) {
    if (!ID.test(courseId || '') || !ID.test(unitId || '') || !['sentence', 'image-text'].includes(contentType)) throw fail('INVALID_FRAGMENT_IDENTITY');
    if (!recordIdentity || !ID.test(recordIdentity.deckId || '') || typeof recordIdentity.generationScope !== 'string' || !recordIdentity.generationScope ||
        typeof recordIdentity.resumeIdentity !== 'string' || !recordIdentity.resumeIdentity) throw fail('INVALID_RECORD_IDENTITY');
    const source = contentType === 'sentence' ? content?.items : content?.utterances;
    if (!Array.isArray(source) || !source.length || !Array.isArray(itemIds) || !itemIds.length || !Array.isArray(assets)) throw fail('CONTENT_INVALID');
    const key = contentType === 'sentence' ? 'cid' : 'id';
    const map = new Map(source.map(item => [item?.[key], item]));
    if (map.size !== source.length || map.size !== itemIds.length || new Set(itemIds).size !== itemIds.length || itemIds.some(id => !ID.test(id) || !map.has(id))) throw fail('CONTENT_ID_MISMATCH');
    const assetMap = new Map(assets.map(asset => [asset.assetId, asset]));
    if (assetMap.size !== assets.length || assets.some(asset => !ID.test(asset.assetId || ''))) throw fail('ASSET_REFERENCE_INVALID');
    const batchSize = contentType === 'sentence' ? 10 : 1;
    const context = Object.fromEntries(['authoring', 'roles', 'metadata', 'capabilities', 'capabilityReasons', 'schemaVersion', 'version']
      .filter(field => content[field] !== undefined).map(field => [field, structuredClone(content[field])]));
    const fragments = [], files = [];
    for (let cursor = 0; cursor < itemIds.length; cursor += batchSize) {
      const selected = itemIds.slice(cursor, cursor + batchSize);
      const items = selected.map(id => structuredClone(map.get(id)));
      if (items.some(item => {
        const en = contentType === 'sentence' ? item.sentence : typeof item.text === 'string' ? item.text : item.text?.en;
        return typeof en !== 'string' || !en.trim();
      })) throw fail('CONTENT_INVALID');
      const assetIds = [...new Set(items.flatMap(item => [item.imageAssetId, item.audioAssetId].filter(Boolean)))];
      if (assetIds.some(id => !assetMap.has(id))) throw fail('ASSET_REFERENCE_INVALID');
      const payload = { courseId, unitId, contentType, cursor, items,
        ...(content.learning ? { learning: structuredClone(content.learning) } : {}),
        ...(Object.keys(context).length ? { context } : {}),
        nextCursor: cursor + selected.length < itemIds.length ? cursor + selected.length : null, assetIds, recordIdentity: structuredClone(recordIdentity) };
      const bytes = Buffer.from(JSON.stringify(payload));
      if (bytes.length > MAX_FRAGMENT_BYTES) throw Object.assign(fail('FRAGMENT_TOO_LARGE'), { cursor, bytes: bytes.length, limit: MAX_FRAGMENT_BYTES });
      const sha256 = hash(bytes), fragmentId = 'f-' + sha256;
      fragments.push({ fragmentId, cursor, itemIds: selected, assetIds, sha256, size: bytes.length, file: fragmentId + '.json' });
      files.push({ name: fragmentId + '.json', bytes });
    }
    const contentVersion = hash(JSON.stringify({ fragments, assets, recordIdentity }));
    return { contentVersion, fragments, files, recordIdentity: structuredClone(recordIdentity) };
  }
}
module.exports = { StaticFragmentBuilder, MAX_FRAGMENT_BYTES };
