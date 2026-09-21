function mergeBatchSnapshots(local, remote, dependencies) {
  const input = dependencies || {};
  const cloneJSON = input.cloneJSON;
  const normalizeSyncedStats = input.normalizeSyncedStats;
  const mergeBest = input.mergeBest;
  const mergeStats = input.mergeStats;
  const migrateCidKeys = input.migrateCidKeys;
  const migrateToBookDecks = input.migrateToBookDecks;
  if ([cloneJSON, normalizeSyncedStats, mergeBest, mergeStats, migrateCidKeys, migrateToBookDecks]
    .some((fn) => typeof fn !== 'function')) {
    throw new TypeError('batch merge requires core merge helpers');
  }

  const left = local && typeof local === 'object' ? local : {};
  const right = remote && typeof remote === 'object' ? remote : {};
  const lm = left.mem && typeof left.mem === 'object' ? left.mem : {};
  const rm = right.mem && typeof right.mem === 'object' ? right.mem : {};
  const lr = left.revs || {};
  const rr = right.revs || {};
  const revOf = (revisions, group, id) => {
    const value = revisions[group] && revisions[group][id];
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  const mergeList = (localList, remoteList, group, idOf) => {
    const a = {}, b = {}, keys = {};
    (Array.isArray(localList) ? localList : []).forEach((item) => {
      const id = item && idOf(item);
      if (!id) return;
      a[id] = item;
      keys[id] = 1;
    });
    (Array.isArray(remoteList) ? remoteList : []).forEach((item) => {
      const id = item && idOf(item);
      if (!id) return;
      b[id] = item;
      keys[id] = 1;
    });
    return Object.keys(keys).sort().reduce((out, id) => {
      const av = a[id], bv = b[id], al = revOf(lr, group, id), br = revOf(rr, group, id);
      if (av && (!bv || al >= br)) out.push(av);
      else if (bv && (!av || br >= al)) out.push(bv);
      return out;
    }, []);
  };
  const mergeMap = (localMap, remoteMap, group) => {
    const a = localMap && typeof localMap === 'object' ? localMap : {};
    const b = remoteMap && typeof remoteMap === 'object' ? remoteMap : {};
    const keys = {};
    Object.keys(a).forEach((key) => { keys[key] = 1; });
    Object.keys(b).forEach((key) => { keys[key] = 1; });
    const out = {};
    Object.keys(keys).sort().forEach((id) => {
      const al = revOf(lr, group, id), br = revOf(rr, group, id);
      if (Object.prototype.hasOwnProperty.call(a, id)
        && (!Object.prototype.hasOwnProperty.call(b, id) || al >= br)) out[id] = a[id];
      else if (Object.prototype.hasOwnProperty.call(b, id)
        && (!Object.prototype.hasOwnProperty.call(a, id) || br >= al)) out[id] = b[id];
    });
    return out;
  };
  const mergeBook = (a, b) => {
    const seen = {}, out = [];
    (Array.isArray(b) ? b : []).concat(Array.isArray(a) ? a : []).forEach((item) => {
      if (!item || !item._key || seen[item._key]) return;
      seen[item._key] = 1;
      out.push(item);
    });
    return out;
  };

  const localStats = normalizeSyncedStats(cloneJSON(lm.stats || {})).stats || {};
  const remoteStats = normalizeSyncedStats(cloneJSON(rm.stats || {})).stats || {};
  const outMem = cloneJSON(rm);
  outMem.version = input.currentVersion;
  outMem.decks = mergeList(lm.decks, rm.decks, 'decks', (deck) => deck.id);
  outMem.best = mergeBest(lm.best, rm.best);
  outMem.settings = revOf(lr, 'kv', 'settings') >= revOf(rr, 'kv', 'settings')
    ? cloneJSON(lm.settings || {}) : cloneJSON(rm.settings || {});
  outMem.stats = mergeStats(localStats, remoteStats);
  outMem.mastered = Object.assign({}, rm.mastered || {}, lm.mastered || {});
  outMem.deletedItems = Object.assign({}, rm.deletedItems || {}, lm.deletedItems || {});
  outMem.reinforceBook = mergeBook(lm.reinforceBook, rm.reinforceBook);
  migrateCidKeys(outMem);
  migrateToBookDecks(outMem);
  return {
    mem: outMem,
    courses: mergeList(left.courses, right.courses, 'courses', (course) => course.courseId),
    courseProgress: mergeMap(left.courseProgress, right.courseProgress, 'courseProgress'),
    revs: cloneJSON(lr),
    generation: left.generation,
  };
}

function buildBusinessSnapshot(snapshot, dependencies) {
  const input = dependencies || {};
  const cloneJSON = input.cloneJSON;
  const normalizeSyncedStats = input.normalizeSyncedStats;
  if (typeof cloneJSON !== 'function' || typeof normalizeSyncedStats !== 'function') {
    throw new TypeError('business snapshot requires clone and stats helpers');
  }
  const source = snapshot || {};
  const mem = source.mem || {};
  const sortById = (left, right, key) => {
    const a = String(left && left[key] || '');
    const b = String(right && right[key] || '');
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const decks = (Array.isArray(mem.decks) ? mem.decks : []).map((deck) => {
    const normalized = cloneJSON(deck || {});
    normalized.builtin = !!normalized.builtin;
    normalized.isPublic = !!normalized.isPublic;
    return normalized;
  }).sort((left, right) => sortById(left, right, 'id'));
  const courses = (Array.isArray(source.courses) ? source.courses : [])
    .map(cloneJSON)
    .sort((left, right) => sortById(left, right, 'courseId'));
  return {
    mem: {
      decks,
      best: cloneJSON(mem.best || {}),
      mastered: cloneJSON(mem.mastered || {}),
      deletedItems: cloneJSON(mem.deletedItems || {}),
      stats: normalizeSyncedStats(cloneJSON(mem.stats || {})).stats || {},
      settings: cloneJSON(mem.settings || {}),
      reinforceBook: cloneJSON(mem.reinforceBook || []),
    },
    courses,
    courseProgress: cloneJSON(source.courseProgress || {}),
  };
}

export const CoreSyncBatchMerge = Object.freeze({ mergeBatchSnapshots, buildBusinessSnapshot });
