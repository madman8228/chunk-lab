(() => {
  // src/mistake-review/evidence.mjs
  var MAX_EVENTS = 20;
  var MAX_MISTAKES = 20;
  var MAX_ANSWERS = 10;
  var MAX_ANSWER_LENGTH = 500;
  var text = (value, limit = MAX_ANSWER_LENGTH) => String(value == null ? "" : value).slice(0, limit);
  var stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  };
  function hash(value) {
    let result = 2166136261;
    for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
    return result.toString(16).padStart(8, "0");
  }
  var compareEvents = (left, right) => (left.at == null ? -1 : left.at) - (right.at == null ? -1 : right.at) || left.eventId.localeCompare(right.eventId);
  function normalizeMistake(item = {}) {
    const answers = Array.isArray(item.wrongAnswers) ? item.wrongAnswers : item.userAnswer ? [item.userAnswer] : [];
    return {
      chunkIdx: Number.isInteger(item.chunkIdx) && item.chunkIdx >= 0 ? item.chunkIdx : 0,
      chunk: text(item.chunk),
      wrongAnswers: [...new Set(answers.map((answer) => text(answer)).filter(Boolean))].sort().slice(0, MAX_ANSWERS),
      wrongAttemptCount: typeof item.wrongAttemptCount === "number" && Number.isFinite(item.wrongAttemptCount) && item.wrongAttemptCount >= 0 ? Math.floor(item.wrongAttemptCount) : null,
      hintUsed: typeof item.hintUsed === "boolean" ? item.hintUsed : null
    };
  }
  function normalizeEvent(event = {}) {
    const mistakes = Array.isArray(event.mistakes) ? event.mistakes : [];
    return {
      eventId: text(event.eventId || `legacy-${hash(stable(event))}`, 120),
      at: Number.isFinite(event.at) && event.at > 0 ? Math.floor(event.at) : null,
      mode: ["typing", "chunkSelection"].includes(event.mode) ? event.mode : "unknown",
      hinted: typeof event.hinted === "boolean" ? event.hinted : null,
      revealed: typeof event.revealed === "boolean" ? event.revealed : null,
      needsReview: event.needsReview === true,
      mistakes: mistakes.slice(0, MAX_MISTAKES).map(normalizeMistake),
      ...mistakes.length > MAX_MISTAKES || event.truncated ? { truncated: true } : {}
    };
  }
  function legacyEvent(row) {
    const mistakes = (Array.isArray(row.mistakes) ? row.mistakes : []).map((item) => ({
      chunkIdx: item.chunkIdx,
      chunk: item.chunk,
      wrongAnswers: item.userAnswer ? [item.userAnswer] : [],
      wrongAttemptCount: null,
      hintUsed: null
    }));
    const parsed = row.addedAt ? Date.parse(String(row.addedAt).replace(" ", "T") + (String(row.addedAt).includes("Z") ? "" : "Z")) : NaN;
    return normalizeEvent({ eventId: `legacy-${hash(`${row._key || ""}|${stable(row)}`)}`, at: Number.isFinite(parsed) ? parsed : null, mode: "unknown", hinted: null, revealed: null, needsReview: row.needsReview, mistakes });
  }
  function normalizeEvidenceRow(row = {}) {
    const copy = { ...row };
    const history = Array.isArray(row.history) && row.history.length ? row.history.map(normalizeEvent) : [legacyEvent(row)];
    const unique = /* @__PURE__ */ new Map();
    history.forEach((event) => {
      const current = unique.get(event.eventId);
      if (!current || stable(event) < stable(current)) unique.set(event.eventId, event);
    });
    const ordered = [...unique.values()].sort(compareEvents);
    const historyTruncated = row.historyTruncated === true || ordered.length > MAX_EVENTS || ordered.some((event) => event.truncated);
    const retained = ordered.slice(-MAX_EVENTS);
    const meaningful = retained.filter((event) => !(event.eventId.startsWith("legacy-") && event.mode === "unknown" && !event.mistakes.length && event.hinted === null && event.revealed === null && !event.needsReview));
    const latest = meaningful[meaningful.length - 1] || retained[retained.length - 1];
    return {
      ...copy,
      addedAt: row.addedAt,
      evidenceVersion: 1,
      updatedAt: Number.isFinite(row.updatedAt) ? Math.floor(row.updatedAt) : latest && latest.at || null,
      history: retained,
      historyTruncated,
      mistakes: latest ? latest.mistakes.map((mistake) => ({ ...mistake, userAnswer: mistake.wrongAnswers.join(" / "), hint: "" })) : [],
      needsReview: latest ? latest.needsReview : row.needsReview === true
    };
  }
  function mergeEvidenceRows(left, right) {
    if (!left) return right ? normalizeEvidenceRow(right) : null;
    if (!right) return normalizeEvidenceRow(left);
    const normalizedLeft = normalizeEvidenceRow(left);
    const normalizedRight = normalizeEvidenceRow(right);
    const preferred = stable(normalizedLeft) <= stable(normalizedRight) ? normalizedLeft : normalizedRight;
    const events = [...normalizedLeft.history, ...normalizedRight.history];
    const merged = normalizeEvidenceRow({ ...preferred, history: events, historyTruncated: normalizedLeft.historyTruncated || normalizedRight.historyTruncated });
    if (normalizedLeft.addedAt && normalizedRight.addedAt) merged.addedAt = String(normalizedLeft.addedAt) <= String(normalizedRight.addedAt) ? normalizedLeft.addedAt : normalizedRight.addedAt;
    return merged;
  }
  function recordEvidence(row, event) {
    const normalized = normalizeEvidenceRow(row);
    const next = normalizeEvent(event);
    return mergeEvidenceRows(normalized, { ...normalized, history: [...normalized.history, next], updatedAt: next.at });
  }
  var MistakeEvidence = Object.freeze({ normalizeEvidenceRow, mergeEvidenceRows, recordEvidence, normalizeEvent });

  // src/core/sync-batch-merge.mjs
  function mergeBatchSnapshots(local, remote, dependencies) {
    const input = dependencies || {};
    const cloneJSON = input.cloneJSON;
    const normalizeSyncedStats = input.normalizeSyncedStats;
    const mergeBest = input.mergeBest;
    const mergeStats = input.mergeStats;
    const migrateCidKeys = input.migrateCidKeys;
    const migrateToBookDecks = input.migrateToBookDecks;
    if ([cloneJSON, normalizeSyncedStats, mergeBest, mergeStats, migrateCidKeys, migrateToBookDecks].some((fn) => typeof fn !== "function")) {
      throw new TypeError("batch merge requires core merge helpers");
    }
    const left = local && typeof local === "object" ? local : {};
    const right = remote && typeof remote === "object" ? remote : {};
    const lm = left.mem && typeof left.mem === "object" ? left.mem : {};
    const rm = right.mem && typeof right.mem === "object" ? right.mem : {};
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
      const a = localMap && typeof localMap === "object" ? localMap : {};
      const b = remoteMap && typeof remoteMap === "object" ? remoteMap : {};
      const keys = {};
      Object.keys(a).forEach((key) => {
        keys[key] = 1;
      });
      Object.keys(b).forEach((key) => {
        keys[key] = 1;
      });
      const out = {};
      Object.keys(keys).sort().forEach((id) => {
        const al = revOf(lr, group, id), br = revOf(rr, group, id);
        if (Object.prototype.hasOwnProperty.call(a, id) && (!Object.prototype.hasOwnProperty.call(b, id) || al >= br)) out[id] = a[id];
        else if (Object.prototype.hasOwnProperty.call(b, id) && (!Object.prototype.hasOwnProperty.call(a, id) || br >= al)) out[id] = b[id];
      });
      return out;
    };
    const mergeBook = (a, b) => {
      const byKey = /* @__PURE__ */ new Map();
      (Array.isArray(b) ? b : []).concat(Array.isArray(a) ? a : []).forEach((item) => {
        if (!item || !item._key) return;
        byKey.set(item._key, byKey.has(item._key) ? MistakeEvidence.mergeEvidenceRows(byKey.get(item._key), item) : MistakeEvidence.normalizeEvidenceRow(item));
      });
      return [...byKey.values()];
    };
    const localStats = normalizeSyncedStats(cloneJSON(lm.stats || {})).stats || {};
    const remoteStats = normalizeSyncedStats(cloneJSON(rm.stats || {})).stats || {};
    const outMem = cloneJSON(rm);
    outMem.version = input.currentVersion;
    outMem.decks = mergeList(lm.decks, rm.decks, "decks", (deck) => deck.id);
    outMem.best = mergeBest(lm.best, rm.best);
    outMem.settings = revOf(lr, "kv", "settings") >= revOf(rr, "kv", "settings") ? cloneJSON(lm.settings || {}) : cloneJSON(rm.settings || {});
    outMem.stats = mergeStats(localStats, remoteStats);
    outMem.mastered = Object.assign({}, rm.mastered || {}, lm.mastered || {});
    outMem.deletedItems = Object.assign({}, rm.deletedItems || {}, lm.deletedItems || {});
    outMem.reinforceBook = mergeBook(lm.reinforceBook, rm.reinforceBook);
    migrateCidKeys(outMem);
    migrateToBookDecks(outMem);
    return {
      mem: outMem,
      courses: mergeList(left.courses, right.courses, "courses", (course) => course.courseId),
      courseProgress: mergeMap(left.courseProgress, right.courseProgress, "courseProgress"),
      revs: cloneJSON(lr),
      generation: left.generation
    };
  }
  function buildBusinessSnapshot(snapshot, dependencies) {
    const input = dependencies || {};
    const cloneJSON = input.cloneJSON;
    const normalizeSyncedStats = input.normalizeSyncedStats;
    if (typeof cloneJSON !== "function" || typeof normalizeSyncedStats !== "function") {
      throw new TypeError("business snapshot requires clone and stats helpers");
    }
    const source = snapshot || {};
    const mem = source.mem || {};
    const sortById = (left, right, key) => {
      const a = String(left && left[key] || "");
      const b = String(right && right[key] || "");
      return a < b ? -1 : a > b ? 1 : 0;
    };
    const decks = (Array.isArray(mem.decks) ? mem.decks : []).map((deck) => {
      const normalized = cloneJSON(deck || {});
      normalized.builtin = !!normalized.builtin;
      normalized.isPublic = !!normalized.isPublic;
      return normalized;
    }).sort((left, right) => sortById(left, right, "id"));
    const courses = (Array.isArray(source.courses) ? source.courses : []).map(cloneJSON).sort((left, right) => sortById(left, right, "courseId"));
    return {
      mem: {
        decks,
        best: cloneJSON(mem.best || {}),
        mastered: cloneJSON(mem.mastered || {}),
        deletedItems: cloneJSON(mem.deletedItems || {}),
        stats: normalizeSyncedStats(cloneJSON(mem.stats || {})).stats || {},
        settings: cloneJSON(mem.settings || {}),
        reinforceBook: cloneJSON(mem.reinforceBook || [])
      },
      courses,
      courseProgress: cloneJSON(source.courseProgress || {})
    };
  }
  var CoreSyncBatchMerge = Object.freeze({ mergeBatchSnapshots, buildBusinessSnapshot });

  // scripts/core-sync-batch-merge-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncBatchMerge = CoreSyncBatchMerge;
})();
