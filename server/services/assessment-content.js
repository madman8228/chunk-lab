'use strict';

const fs = require('node:fs');
const path = require('node:path');

function createAssessmentContent(options) {
  const db = options.db;
  const root = options.contentRoot || path.resolve(__dirname, '../../content');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const indexes = new Map();
  const shards = new Map();

  function readJson(relativePath) {
    const relative = relativePath.replace(/^content[\\/]/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid content path');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function resolve(userId, key) {
    const separator = key.indexOf('#');
    if (separator < 1) return null;
    const deckId = key.slice(0, separator);
    const cid = key.slice(separator + 1);
    const userDeck = db.prepare('SELECT items_json FROM user_decks WHERE user_id=? AND id=? AND deleted_at IS NULL').get(userId, deckId);
    if (userDeck) {
      const items = JSON.parse(userDeck.items_json);
      return items.find(item => String(item.cid || '') === cid) || null;
    }
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
    let data = shards.get(reference.sourceUrl);
    if (!data) { data = readJson(reference.sourceUrl); shards.set(reference.sourceUrl, data); }
    const item = data.items && data.items[reference.sourceOffset];
    return item && String(item.cid || '') === cid ? item : null;
  }

  return Object.freeze({ resolve });
}

module.exports = { createAssessmentContent };
