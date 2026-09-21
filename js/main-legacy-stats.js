var MainLegacyStats = (() => {
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

  // scripts/main-legacy-stats-entry.mjs
  var main_legacy_stats_entry_exports = {};
  __export(main_legacy_stats_entry_exports, {
    migrateLegacyStatKeys: () => migrateLegacyStatKeys
  });

  // src/main/legacy-stats.mjs
  function defaultHash(value) {
    let hash = 2166136261;
    String(value == null ? "" : value).split("").forEach((char) => {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return (hash >>> 0).toString(16);
  }
  function mergeStats(left, right) {
    const latest = (left.lastAt || 0) >= (right.lastAt || 0) ? left : right;
    const merged = Object.assign({}, latest);
    merged.times = (left.times || 0) + (right.times || 0);
    merged.okTimes = (left.okTimes || 0) + (right.okTimes || 0);
    merged.wrongTimes = (left.wrongTimes || 0) + (right.wrongTimes || 0);
    merged.maxStreak = Math.max(left.maxStreak || 0, right.maxStreak || 0);
    return merged;
  }
  function migrateLegacyStatKeys(bySentence, decks, options = {}) {
    if (!bySentence || typeof bySentence !== "object") return { changed: false, by: bySentence };
    const list = Array.isArray(decks) ? decks : [];
    const normalize = typeof options.normalizeSentence === "function" ? options.normalizeSentence : (value) => String(value == null ? "" : value).trim().toLowerCase();
    const hash = typeof options.hash === "function" ? options.hash : defaultHash;
    const by = Object.assign({}, bySentence);
    const known = {};
    list.forEach((deck) => {
      if (deck && deck.id) known[deck.id] = deck;
    });
    let changed = false;
    Object.keys(bySentence).forEach((oldKey) => {
      const source = bySentence[oldKey];
      if (!source || !source.deckId || known[source.deckId]) return;
      let sourceId = "";
      if (String(source.deckId).indexOf("rev-") === 0) {
        list.forEach((deck) => {
          if (!sourceId && String(source.deckId).indexOf("rev-" + deck.id + "-") === 0) sourceId = deck.id;
        });
      }
      if (!sourceId) {
        const sentence = normalize(source.sentence || "");
        const candidates = list.filter((deck) => (deck.items || []).some((item) => normalize(item.sentence || item.en || "") === sentence));
        if (candidates.length === 1) sourceId = candidates[0].id;
        if (candidates.length > 1) {
          const named = candidates.filter((deck) => deck.name === source.deckName);
          if (named.length === 1) sourceId = named[0].id;
        }
      }
      if (!sourceId || !known[sourceId]) return;
      const newKey = sourceId + "#" + hash(source.sentence || "");
      const migrated = Object.assign({}, source, { deckId: sourceId, deckName: known[sourceId].name });
      by[newKey] = by[newKey] ? mergeStats(by[newKey], migrated) : migrated;
      if (newKey !== oldKey) delete by[oldKey];
      changed = true;
    });
    return { changed, by };
  }
  return __toCommonJS(main_legacy_stats_entry_exports);
})();
