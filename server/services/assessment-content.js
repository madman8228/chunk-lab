'use strict';

const fs = require('node:fs');
const path = require('node:path');

function createAssessmentContent(options) {
  const db = options.db;
  const root = options.contentRoot || path.resolve(__dirname, '../../content');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  /* T5（2026-10-07）：公开 manifest 收敛为「仅元数据」，分片路径改存 server/content/shards.json。
     这里把分片路径合并回内存 manifest，保证评测题解析沿用原逻辑（不静默丢内容）。 */
  const shardMapPath = path.resolve(root, '..', 'server', 'content', 'shards.json');
  if (fs.existsSync(shardMapPath)) {
    const map = JSON.parse(fs.readFileSync(shardMapPath, 'utf8'));
    if (map && Array.isArray(map.decks)) {
      const byId = new Map(map.decks.map((deck) => [deck.id, deck]));
      (manifest.decks || []).forEach((deck) => {
        const info = byId.get(deck.id);
        if (info) {
          deck.shards = info.shards || [];
          deck.indexShards = info.indexShards || [];
        }
      });
    }
  }
  const indexes = new Map();
  const shards = new Map();

  function readJson(relativePath) {
    if (options.assertPublicPath) options.assertPublicPath('/' + relativePath.replace(/^\/+/, ''));
    const relative = relativePath.replace(/^content[\\/]/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid content path');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function resolveIndependentItem(userId, deckId, cid) {
    const library = options.courseLibrary;
    if (!library) return undefined;
    const alias = db.prepare(`SELECT course_id AS courseId FROM course_content_legacy_mappings
      WHERE source_user_id=? AND source_kind='deck' AND source_id=?`).get(userId, deckId);
    const courseId = alias?.courseId || (library.canRead(userId, deckId) ? deckId : null);
    if (!courseId) return undefined;
    let course;
    try { course = library.read(userId, courseId); }
    catch (_) { return null; }
    const content = course.content || {};
    const items = Array.isArray(content.items) ? content.items
      : Array.isArray(content.utterances) ? content.utterances : [];
    const item = items.find(value => String(value.cid || value.id || value.itemId || '') === cid);
    if (!item) return null;
    const text = item.text && typeof item.text === 'object' ? item.text : {};
    return { ...item, cid: item.cid || item.id || item.itemId,
      ...(typeof item.sentence === 'string' ? {} : { sentence: item.sent || item.en || text.en }),
      ...(typeof item.translation === 'string' ? {} : { translation: item.zh || text['zh-CN'] || '' }) };
  }

  function resolve(userId, key, learningSessionId) {
    const separator = key.indexOf('#');
    if (separator < 1) return null;
    const deckId = key.slice(0, separator);
    const cid = key.slice(separator + 1);
    if (deckId.startsWith('protected_') && options.resolveProtectedItem) return options.resolveProtectedItem(userId, key, learningSessionId);
    const independentItem = resolveIndependentItem(userId, deckId, cid);
    if (independentItem !== undefined) return independentItem;
    const userDeck = db.prepare('SELECT items_json FROM user_decks WHERE user_id=? AND id=? AND deleted_at IS NULL').get(userId, deckId);
    if (userDeck) {
      const items = JSON.parse(userDeck.items_json);
      return items.find(item => String(item.cid || '') === cid) || null;
    }
    // A server-side resolver must respect the same source inventory as HTTP static reads.
    // User-owned deck history above remains independent from platform membership.
    if (options.assertPublicDeck) options.assertPublicDeck(deckId);
    const entry = (manifest.decks || []).find(deck => deck.id === deckId);
    if (!entry) return null;
    let index = indexes.get(deckId);
    if (!index) {
      index = new Map();
      (entry.indexShards || []).forEach(shard => {
        const data = readJson(shard.url);
        (data.items || []).forEach(item => index.set(String(item.cid), item));
      });
      indexes.set(deckId, index);
    }
    const reference = index.get(cid);
    if (!reference || !reference.sourceUrl || !Number.isSafeInteger(reference.sourceOffset) || reference.sourceOffset < 0) return null;
    if (options.assertPublicPath) options.assertPublicPath('/' + reference.sourceUrl.replace(/^\/+/, ''));
    let data = shards.get(reference.sourceUrl);
    if (!data) { data = readJson(reference.sourceUrl); shards.set(reference.sourceUrl, data); }
    const item = data.items && data.items[reference.sourceOffset];
    return item && String(item.cid || '') === cid ? item : null;
  }

  return Object.freeze({ resolve });
}

module.exports = { createAssessmentContent };
