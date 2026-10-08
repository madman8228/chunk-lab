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

  // scripts/mistake-evidence-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.MistakeEvidence = MistakeEvidence;
})();
