/* Pure three-way merge helpers for cross-tab and cloud snapshots. */
const has = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
const equalJson = (left, right) => {
  if (left === right) return true;
  try { return JSON.stringify(left === undefined ? null : left) === JSON.stringify(right === undefined ? null : right); } catch (_) { return false; }
};

function keyedMap(base, ours, theirs) {
  base = base || {}; ours = ours || {}; theirs = theirs || {};
  const result = {};
  for (const key in ours) if (has(ours, key)) result[key] = ours[key];
  for (const key in theirs) {
    if (!has(theirs, key)) continue;
    const baseHas = has(base, key);
    if (baseHas && equalJson(theirs[key], base[key])) continue;
    const oursHas = has(ours, key);
    const oursChanged = baseHas ? (!oursHas || !equalJson(ours[key], base[key])) : oursHas;
    if (!oursChanged || !oursHas) result[key] = theirs[key];
  }
  for (const key in base) {
    if (!has(base, key) || has(theirs, key)) continue;
    if (!has(ours, key) || equalJson(ours[key], base[key])) delete result[key];
  }
  return result;
}

function daysLog(base, ours, theirs) {
  const result = {};
  for (const source of [theirs, ours]) {
    if (!source) continue;
    for (const key in source) {
      if (!has(source, key)) continue;
      const rounds = (source[key] && Number(source[key].rounds)) || 0;
      if (rounds > 0) result[key] = { rounds: Math.max((result[key] && result[key].rounds) || 0, rounds) };
    }
  }
  return result;
}

function bySentence(base, ours, theirs) {
  if (!theirs || !Object.keys(theirs).length) return ours || {};
  return keyedMap(base, ours, theirs);
}

function best(ours, theirs) {
  ours = (ours && typeof ours === 'object') ? ours : {};
  theirs = (theirs && typeof theirs === 'object') ? theirs : {};
  const result = {}, keys = {};
  Object.keys(ours).forEach((key) => { keys[key] = 1; });
  Object.keys(theirs).forEach((key) => { keys[key] = 1; });
  Object.keys(keys).forEach((key) => {
    const left = ours[key], right = theirs[key];
    if (left && typeof left === 'object' && !Array.isArray(left) && right && typeof right === 'object' && !Array.isArray(right)) {
      const latest = (Number(left.lastPlayed) || 0) >= (Number(right.lastPlayed) || 0) ? left : right;
      const merged = { ...latest };
      ['acc', 'perfect', 'combo'].forEach((field) => {
        if (typeof left[field] === 'number' || typeof right[field] === 'number') merged[field] = Math.max(Number(left[field]) || 0, Number(right[field]) || 0);
      });
      merged.lastPlayed = Math.max(Number(left.lastPlayed) || 0, Number(right.lastPlayed) || 0);
      if (has(latest, 'lastAcc')) merged.lastAcc = latest.lastAcc;
      result[key] = merged;
    } else if (left === undefined) result[key] = right;
    else result[key] = left;
  });
  return result;
}

function events(base, ours, theirs) {
  const oursList = Array.isArray(ours) ? ours : [];
  const theirsList = Array.isArray(theirs) ? theirs : [];
  const baseList = Array.isArray(base) ? base : [];
  if (!theirsList.length && !baseList.length) return oursList;
  const seen = {}, result = [];
  for (const list of [oursList, theirsList]) {
    for (const event of list) {
      if (!event) continue;
      if (event.id) { if (!seen[event.id]) { seen[event.id] = 1; result.push(event); } }
      else result.push(event);
    }
  }
  return result;
}

function stats(base, ours, theirs) {
  base = base || {}; ours = ours || {}; theirs = theirs || {};
  const result = {}, keys = {};
  [ours, theirs, base].forEach((source) => { for (const key in source) if (has(source, key)) keys[key] = 1; });
  for (const key in keys) {
    if (key === 'bySentence' || key === 'events') continue;
    if (key === 'totalRounds' || key === 'totalAnswered') {
      result[key] = Math.max(Number(ours[key]) || 0, Number(theirs[key]) || 0, Number(base[key]) || 0);
      continue;
    }
    if (key === 'daysLog') { result[key] = daysLog(base[key], ours[key], theirs[key]); continue; }
    if (has(ours, key) && !equalJson(ours[key], base[key])) result[key] = ours[key];
    else if (has(theirs, key)) result[key] = theirs[key];
    else if (has(ours, key)) result[key] = ours[key];
  }
  result.bySentence = bySentence(base.bySentence, ours.bySentence, theirs.bySentence);
  result.events = events(base.events, ours.events, theirs.events);
  return result;
}

const toMap = (list, keyOf) => {
  const result = {};
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = keyOf(item);
    if (key != null && key !== '') result[key] = item;
  });
  return result;
};
const listFromKeyed = (primaryList, result, keyOf) => {
  const output = [], seen = {};
  (Array.isArray(primaryList) ? primaryList : []).forEach((item) => {
    const key = keyOf(item);
    if (key != null && key !== '' && has(result, key) && !seen[key]) { seen[key] = 1; output.push(result[key]); }
  });
  Object.keys(result).forEach((key) => { if (!seen[key]) { seen[key] = 1; output.push(result[key]); } });
  return output;
};

function memInto(target, disk, base) {
  if (!target || typeof target !== 'object') return target;
  disk = disk || {}; base = base || {};
  const deckKey = (item) => item && item.id;
  const bookKey = (item) => item && (item._key || item.id || item.sentence);
  target.decks = listFromKeyed(target.decks, keyedMap(toMap(base.decks, deckKey), toMap(target.decks, deckKey), toMap(disk.decks, deckKey)), deckKey);
  target.reinforceBook = listFromKeyed(target.reinforceBook, keyedMap(toMap(base.reinforceBook, bookKey), toMap(target.reinforceBook, bookKey), toMap(disk.reinforceBook, bookKey)), bookKey);
  target.mastered = keyedMap(base.mastered, target.mastered, disk.mastered);
  target.deletedItems = keyedMap(base.deletedItems, target.deletedItems, disk.deletedItems);
  target.best = keyedMap(base.best, target.best, disk.best);
  target.progress = keyedMap(base.progress, target.progress, disk.progress);
  target.settings = keyedMap(base.settings, target.settings, disk.settings);
  target.stats = stats(base.stats, target.stats, disk.stats);
  return target;
}

export const CoreMerge = Object.freeze({ keyedMap, daysLog, bySentence, best, events, stats, memInto });
