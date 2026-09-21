import { fnv8, moveKeyToCid } from './identity.mjs';

function migrateCidKeys(value) {
  const target = value && typeof value === 'object' ? value : {};
  let changed = false;
  function moveMap(map) {
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach((key) => {
      const next = moveKeyToCid(key);
      if (next === key) return;
      if (!(next in map)) map[next] = map[key];
      delete map[key];
      changed = true;
    });
  }
  moveMap(target.mastered);
  moveMap(target.deletedItems);
  if (target.stats && typeof target.stats === 'object') {
    moveMap(target.stats.bySentence);
    if (Array.isArray(target.stats.events)) {
      target.stats.events.forEach((event) => {
        if (event && event.key) event.key = moveKeyToCid(event.key);
      });
    }
  }
  return changed;
}

function migrateToBookDecks(value, migrationMap) {
  const target = value && typeof value === 'object' ? value : {};
  const map = migrationMap;
  if (!map || typeof map !== 'object') return false;
  const oldDecks = {
    'builtin-daily': true,
    'daily-home': true,
    'daily-social': true,
    'daily-chat': true,
    'daily-basic': true,
    'daily-emotion': true,
    'daily-work': true,
    'builtin-oral-8000': true,
  };
  let changed = false;
  const cidToDeck = {};
  Object.keys(map).forEach((deckId) => {
    (Array.isArray(map[deckId]) ? map[deckId] : []).forEach((cid) => { cidToDeck[cid] = deckId; });
  });
  function remapKey(key) {
    if (typeof key !== 'string') return key;
    const sep = key.indexOf('#');
    if (sep <= 0) return key;
    const oldDeck = key.slice(0, sep);
    const cid = key.slice(sep + 1);
    if (!oldDecks[oldDeck] || !/^[0-9a-f]{8}$/.test(cid)) return key;
    const deck = cidToDeck[cid];
    return deck ? deck + '#' + cid : key;
  }
  function moveMap(mapValue) {
    if (!mapValue || typeof mapValue !== 'object') return;
    Object.keys(mapValue).forEach((key) => {
      const next = remapKey(key);
      if (next === key) return;
      if (!(next in mapValue)) mapValue[next] = mapValue[key];
      delete mapValue[key];
      changed = true;
    });
  }
  moveMap(target.mastered);
  moveMap(target.deletedItems);
  if (target.stats && typeof target.stats === 'object') {
    moveMap(target.stats.bySentence);
    Object.keys(target.stats.bySentence || {}).forEach((key) => {
      const sep = key.indexOf('#');
      const keyDeck = sep > 0 ? key.slice(0, sep) : '';
      const row = target.stats.bySentence[key];
      if (!row || !keyDeck || !/^oral-/.test(keyDeck) || !oldDecks[row.deckId]) return;
      row.deckId = keyDeck;
      changed = true;
    });
    if (Array.isArray(target.stats.events)) {
      target.stats.events.forEach((event) => {
        if (event && event.key) event.key = remapKey(event.key);
      });
    }
  }
  if (Array.isArray(target.reinforceBook)) {
    target.reinforceBook.forEach((item) => {
      if (!item || !oldDecks[item.deckId]) return;
      const deck = cidToDeck[fnv8(item.sentence || '')];
      if (!deck) return;
      item.deckId = deck;
      item._key = deck + '::' + (item.sentence || '');
      changed = true;
    });
  }
  return changed;
}

export const CoreMigrations = Object.freeze({ migrateCidKeys, migrateToBookDecks });
