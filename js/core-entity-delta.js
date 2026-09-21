(() => {
  // src/core/entity-delta.mjs
  function strHash(value) {
    let hash = 2166136261;
    const text = String(value == null ? "" : value);
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    return hash;
  }
  function sigMasteredRow(value) {
    return `${value && value.markedAt ? value.markedAt : 0}:${strHash(value && value.deckId || "")}`;
  }
  function sigReinforceRow(value) {
    return `${value && value.addedAt || ""}:${strHash(value && value.sentence || "")}`;
  }
  function sigDeletedRow() {
    return "1";
  }
  function rowDelta(map, mark, rowSig) {
    const source = map && typeof map === "object" ? map : {};
    const up = {};
    const gone = [];
    if (mark === null) {
      Object.keys(source).forEach((key) => {
        up[key] = source[key];
      });
    } else {
      Object.keys(source).forEach((key) => {
        if (mark[key] !== rowSig(source[key])) up[key] = source[key];
      });
      Object.keys(mark || {}).forEach((key) => {
        if (!(key in source)) gone.push(key);
      });
    }
    const next = {};
    if (mark) Object.keys(mark).forEach((key) => {
      next[key] = mark[key];
    });
    Object.keys(up).forEach((key) => {
      next[key] = rowSig(source[key]);
    });
    gone.forEach((key) => {
      delete next[key];
    });
    return { up, gone, next };
  }
  function buildEntityDelta(mem, marks) {
    const source = mem || {};
    const mastered = source.mastered && typeof source.mastered === "object" ? source.mastered : {};
    const deletedItems = source.deletedItems && typeof source.deletedItems === "object" ? source.deletedItems : {};
    const reinforceBook = Array.isArray(source.reinforceBook) ? source.reinforceBook : [];
    const reinforceMap = {};
    reinforceBook.forEach((item) => {
      if (item && item._key) reinforceMap[item._key] = item;
    });
    const current = marks || {};
    return {
      mastered: rowDelta(mastered, current.mastered == null ? null : current.mastered, sigMasteredRow),
      reinforceBook: rowDelta(reinforceMap, current.reinforceBook == null ? null : current.reinforceBook, sigReinforceRow),
      deletedItems: rowDelta(deletedItems, current.deletedItems == null ? null : current.deletedItems, sigDeletedRow)
    };
  }
  function alignEntityMarks(mem) {
    const source = mem || {};
    const mastered = source.mastered && typeof source.mastered === "object" ? source.mastered : {};
    const deletedItems = source.deletedItems && typeof source.deletedItems === "object" ? source.deletedItems : {};
    const reinforceBook = Array.isArray(source.reinforceBook) ? source.reinforceBook : [];
    const out = { mastered: {}, reinforceBook: {}, deletedItems: {} };
    Object.keys(mastered).forEach((key) => {
      out.mastered[key] = sigMasteredRow(mastered[key]);
    });
    Object.keys(deletedItems).forEach((key) => {
      out.deletedItems[key] = sigDeletedRow();
    });
    reinforceBook.forEach((item) => {
      if (item && item._key) out.reinforceBook[item._key] = sigReinforceRow(item);
    });
    return out;
  }
  var CoreEntityDelta = Object.freeze({
    strHash,
    sigMasteredRow,
    sigReinforceRow,
    sigDeletedRow,
    rowDelta,
    buildEntityDelta,
    alignEntityMarks
  });

  // scripts/core-entity-delta-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreEntityDelta = CoreEntityDelta;
})();
