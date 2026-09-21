var CoreRevisionDelta = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/core-revision-delta-entry.mjs
  var core_revision_delta_entry_exports = {};
  __export(core_revision_delta_entry_exports, {
    calculateKeyedRevisionDelta: () => calculateKeyedRevisionDelta,
    calculateRevisionDelta: () => calculateRevisionDelta
  });

  // src/core/revision-delta.mjs
  function cloneRevisions(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};
    Object.keys(source).forEach((group) => {
      result[group] = source[group] && typeof source[group] === "object" ? { ...source[group] } : {};
    });
    return result;
  }
  function calculateRevisionDelta(options = {}) {
    const mem = options.mem && typeof options.mem === "object" ? options.mem : {};
    const previous = options.previous && typeof options.previous === "object" ? options.previous : null;
    const syncKvKeys = Array.isArray(options.syncKvKeys) ? options.syncKvKeys : [];
    const sigDeck = typeof options.sigDeck === "function" ? options.sigDeck : (deck) => JSON.stringify(deck);
    const kvSig = typeof options.kvSig === "function" ? options.kvSig : (_key, value) => JSON.stringify(value);
    const revisions = cloneRevisions(options.revisions);
    if (!revisions.decks) revisions.decks = {};
    if (!revisions.kv) revisions.kv = {};
    const deletes = { decks: [], kv: [] };
    const pending = { decks: [], gone: [] };
    const decks = Array.isArray(mem.decks) ? mem.decks : [];
    const currentDeckIds = /* @__PURE__ */ new Set();
    decks.forEach((deck) => {
      if (deck && deck.id) currentDeckIds.add(deck.id);
    });
    if (previous) {
      const previousDecks = previous.decks && typeof previous.decks === "object" ? previous.decks : {};
      decks.forEach((deck) => {
        if (!deck || !deck.id) return;
        if (previousDecks[deck.id] === void 0 || sigDeck(deck) !== previousDecks[deck.id]) {
          revisions.decks[deck.id] = (revisions.decks[deck.id] || 0) + 1;
          pending.decks.push(deck.id);
        }
      });
      Object.keys(previousDecks).forEach((id) => {
        if (currentDeckIds.has(id)) return;
        revisions.decks[id] = (revisions.decks[id] || 0) + 1;
        const deletion = { id, rev: revisions.decks[id] };
        deletes.decks.push(deletion);
        pending.gone.push(deletion);
      });
      const previousKv = previous.kv && typeof previous.kv === "object" ? previous.kv : {};
      syncKvKeys.forEach((key) => {
        const current = Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : void 0;
        const before = previousKv[key];
        if (before === void 0) {
          if (current !== void 0) revisions.kv[key] = (revisions.kv[key] || 0) + 1;
        } else if (current !== void 0 && kvSig(key, current) !== before) {
          revisions.kv[key] = (revisions.kv[key] || 0) + 1;
        }
      });
    } else {
      decks.forEach((deck) => {
        if (!deck || !deck.id) return;
        if (!(deck.id in revisions.decks)) {
          revisions.decks[deck.id] = 1;
          pending.decks.push(deck.id);
        }
      });
      syncKvKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(mem, key) && !(key in revisions.kv)) revisions.kv[key] = 1;
      });
    }
    const snapshot = { decks: {}, kv: {} };
    decks.forEach((deck) => {
      if (deck && deck.id) snapshot.decks[deck.id] = sigDeck(deck);
    });
    syncKvKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(mem, key)) snapshot.kv[key] = kvSig(key, mem[key]);
    });
    return { revisions, deletes, pending, snapshot };
  }
  function calculateKeyedRevisionDelta(options = {}) {
    const group = options.group || "entities";
    const previous = options.previous && typeof options.previous === "object" ? options.previous : null;
    const revisions = cloneRevisions(options.revisions);
    if (!revisions[group]) revisions[group] = {};
    const keyOf = typeof options.keyOf === "function" ? options.keyOf : (_value, key) => key;
    const signature = typeof options.signature === "function" ? options.signature : (value) => JSON.stringify(value);
    const current = options.current && typeof options.current === "object" ? options.current : {};
    const values = {};
    if (Array.isArray(current)) {
      current.forEach((value) => {
        const key = keyOf(value);
        if (key !== void 0 && key !== null && key !== "") values[key] = value;
      });
    } else {
      Object.keys(current).forEach((key) => {
        values[key] = current[key];
      });
    }
    const changed = [];
    const deleted = [];
    const snapshot = {};
    if (previous) {
      Object.keys(values).forEach((key) => {
        if (previous[key] === void 0 || signature(values[key], key) !== previous[key]) {
          revisions[group][key] = (revisions[group][key] || 0) + 1;
          changed.push(key);
        }
      });
      Object.keys(previous).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) return;
        revisions[group][key] = (revisions[group][key] || 0) + 1;
        const deletion = { id: key, rev: revisions[group][key] };
        deleted.push(deletion);
      });
    } else {
      Object.keys(values).forEach((key) => {
        if (!(key in revisions[group])) {
          revisions[group][key] = 1;
          changed.push(key);
        }
      });
    }
    Object.keys(values).forEach((key) => {
      snapshot[key] = signature(values[key], key);
    });
    return { revisions, changed, deleted, snapshot };
  }
  return __toCommonJS(core_revision_delta_entry_exports);
})();
