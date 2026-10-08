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
    const events2 = [...normalizedLeft.history, ...normalizedRight.history];
    const merged = normalizeEvidenceRow({ ...preferred, history: events2, historyTruncated: normalizedLeft.historyTruncated || normalizedRight.historyTruncated });
    if (normalizedLeft.addedAt && normalizedRight.addedAt) merged.addedAt = String(normalizedLeft.addedAt) <= String(normalizedRight.addedAt) ? normalizedLeft.addedAt : normalizedRight.addedAt;
    return merged;
  }
  function recordEvidence(row, event) {
    const normalized = normalizeEvidenceRow(row);
    const next = normalizeEvent(event);
    return mergeEvidenceRows(normalized, { ...normalized, history: [...normalized.history, next], updatedAt: next.at });
  }
  var MistakeEvidence = Object.freeze({ normalizeEvidenceRow, mergeEvidenceRows, recordEvidence, normalizeEvent });

  // src/learning/state.mjs
  var stableOrder = (left, right) => left.at - right.at || String(left.id).localeCompare(String(right.id));
  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
    const encoded = JSON.stringify(value);
    return encoded === void 0 ? String(value) : encoded;
  }
  function mergeLearningEvidence(...sources) {
    const byId = /* @__PURE__ */ new Map();
    sources.flat().forEach((event) => {
      if (!event || typeof event !== "object" || !event.id || !Number.isFinite(event.at)) return;
      const id = String(event.id);
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, { ...event, id });
        return;
      }
      const existingFailed = existing.ok === false || existing.assisted === true;
      const eventFailed = event.ok === false || event.assisted === true;
      const winner = existingFailed !== eventFailed ? existingFailed ? existing : event : stableJson(existing) <= stableJson(event) ? existing : event;
      byId.set(id, { ...winner, id });
    });
    return [...byId.values()].sort(stableOrder);
  }

  // src/core/merge.mjs
  var has = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
  var equalJson = (left, right) => {
    if (left === right) return true;
    try {
      return JSON.stringify(left === void 0 ? null : left) === JSON.stringify(right === void 0 ? null : right);
    } catch (_) {
      return false;
    }
  };
  function keyedMap(base, ours, theirs) {
    base = base || {};
    ours = ours || {};
    theirs = theirs || {};
    const result = {};
    for (const key in ours) if (has(ours, key)) result[key] = ours[key];
    for (const key in theirs) {
      if (!has(theirs, key)) continue;
      const baseHas = has(base, key);
      if (baseHas && equalJson(theirs[key], base[key])) continue;
      const oursHas = has(ours, key);
      const oursChanged = baseHas ? !oursHas || !equalJson(ours[key], base[key]) : oursHas;
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
        const rounds = source[key] && Number(source[key].rounds) || 0;
        if (rounds > 0) result[key] = { rounds: Math.max(result[key] && result[key].rounds || 0, rounds) };
      }
    }
    return result;
  }
  function bySentence(base, ours, theirs) {
    if (!theirs || !Object.keys(theirs).length) return ours || {};
    const merged = keyedMap(base, ours, theirs);
    for (const key of Object.keys(merged)) {
      const left = ours && ours[key];
      const right = theirs && theirs[key];
      if (!left || !right || !left.learningV1 && !right.learningV1) continue;
      const a = left.learningV1 || {}, b = right.learningV1 || {};
      const latest = (Number(a.lastExposureAt) || 0) >= (Number(b.lastExposureAt) || 0) ? a : b;
      merged[key] = { ...merged[key], learningV1: {
        ...latest,
        version: 1,
        lastExposureAt: Math.max(Number(a.lastExposureAt) || 0, Number(b.lastExposureAt) || 0),
        evidence: mergeLearningEvidence(a.evidence, b.evidence)
      } };
    }
    return merged;
  }
  function best(ours, theirs) {
    ours = ours && typeof ours === "object" ? ours : {};
    theirs = theirs && typeof theirs === "object" ? theirs : {};
    const result = {}, keys = {};
    Object.keys(ours).forEach((key) => {
      keys[key] = 1;
    });
    Object.keys(theirs).forEach((key) => {
      keys[key] = 1;
    });
    Object.keys(keys).forEach((key) => {
      const left = ours[key], right = theirs[key];
      if (left && typeof left === "object" && !Array.isArray(left) && right && typeof right === "object" && !Array.isArray(right)) {
        const latest = (Number(left.lastPlayed) || 0) >= (Number(right.lastPlayed) || 0) ? left : right;
        const merged = { ...latest };
        ["acc", "perfect", "combo"].forEach((field) => {
          if (typeof left[field] === "number" || typeof right[field] === "number") merged[field] = Math.max(Number(left[field]) || 0, Number(right[field]) || 0);
        });
        merged.lastPlayed = Math.max(Number(left.lastPlayed) || 0, Number(right.lastPlayed) || 0);
        if (has(latest, "lastAcc")) merged.lastAcc = latest.lastAcc;
        result[key] = merged;
      } else if (left === void 0) result[key] = right;
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
        if (event.id) {
          if (!seen[event.id]) {
            seen[event.id] = 1;
            result.push(event);
          }
        } else result.push(event);
      }
    }
    return result;
  }
  function stats(base, ours, theirs) {
    base = base || {};
    ours = ours || {};
    theirs = theirs || {};
    const result = {}, keys = {};
    [ours, theirs, base].forEach((source) => {
      for (const key in source) if (has(source, key)) keys[key] = 1;
    });
    for (const key in keys) {
      if (key === "bySentence" || key === "events") continue;
      if (key === "totalRounds" || key === "totalAnswered") {
        result[key] = Math.max(Number(ours[key]) || 0, Number(theirs[key]) || 0, Number(base[key]) || 0);
        continue;
      }
      if (key === "daysLog") {
        result[key] = daysLog(base[key], ours[key], theirs[key]);
        continue;
      }
      if (has(ours, key) && !equalJson(ours[key], base[key])) result[key] = ours[key];
      else if (has(theirs, key)) result[key] = theirs[key];
      else if (has(ours, key)) result[key] = ours[key];
    }
    result.bySentence = bySentence(base.bySentence, ours.bySentence, theirs.bySentence);
    result.events = events(base.events, ours.events, theirs.events);
    return result;
  }
  var toMap = (list, keyOf) => {
    const result = {};
    (Array.isArray(list) ? list : []).forEach((item) => {
      const key = keyOf(item);
      if (key != null && key !== "") result[key] = item;
    });
    return result;
  };
  var listFromKeyed = (primaryList, result, keyOf) => {
    const output = [], seen = {};
    (Array.isArray(primaryList) ? primaryList : []).forEach((item) => {
      const key = keyOf(item);
      if (key != null && key !== "" && has(result, key) && !seen[key]) {
        seen[key] = 1;
        output.push(result[key]);
      }
    });
    Object.keys(result).forEach((key) => {
      if (!seen[key]) {
        seen[key] = 1;
        output.push(result[key]);
      }
    });
    return output;
  };
  function memInto(target, disk, base) {
    if (!target || typeof target !== "object") return target;
    disk = disk || {};
    base = base || {};
    const deckKey = (item) => item && item.id;
    const bookKey = (item) => item && (item._key || item.id || item.sentence);
    target.decks = listFromKeyed(target.decks, keyedMap(toMap(base.decks, deckKey), toMap(target.decks, deckKey), toMap(disk.decks, deckKey)), deckKey);
    const allowedReinforce = keyedMap(toMap(base.reinforceBook, bookKey), toMap(target.reinforceBook, bookKey), toMap(disk.reinforceBook, bookKey));
    const reinforce = /* @__PURE__ */ new Map();
    [...Array.isArray(target.reinforceBook) ? target.reinforceBook : [], ...Array.isArray(disk.reinforceBook) ? disk.reinforceBook : []].forEach((item) => {
      const key = bookKey(item);
      if (!key || !has(allowedReinforce, key)) return;
      reinforce.set(key, reinforce.has(key) ? MistakeEvidence.mergeEvidenceRows(reinforce.get(key), item) : MistakeEvidence.normalizeEvidenceRow(item));
    });
    target.reinforceBook = [...reinforce.values()];
    target.mastered = keyedMap(base.mastered, target.mastered, disk.mastered);
    target.deletedItems = keyedMap(base.deletedItems, target.deletedItems, disk.deletedItems);
    target.best = keyedMap(base.best, target.best, disk.best);
    target.progress = keyedMap(base.progress, target.progress, disk.progress);
    target.settings = keyedMap(base.settings, target.settings, disk.settings);
    target.stats = stats(base.stats, target.stats, disk.stats);
    return target;
  }
  var CoreMerge = Object.freeze({ keyedMap, daysLog, bySentence, best, events, stats, memInto });

  // scripts/core-merge-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreMerge = CoreMerge;
})();
