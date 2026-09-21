var MainHomeSummary = (() => {
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

  // scripts/main-home-summary-entry.mjs
  var main_home_summary_entry_exports = {};
  __export(main_home_summary_entry_exports, {
    computeTodaySummary: () => computeTodaySummary
  });

  // src/main/home-summary.mjs
  function computeTodaySummary(options = {}) {
    const stats = options.stats && typeof options.stats === "object" ? options.stats : {};
    const bySentence = stats.bySentence && typeof stats.bySentence === "object" ? stats.bySentence : {};
    const knownDeckIds = new Set(Array.isArray(options.knownDeckIds) ? options.knownDeckIds : []);
    const now = options.now;
    const isDue = typeof options.isDue === "function" ? options.isDue : () => false;
    const isDeleted = typeof options.isDeleted === "function" ? options.isDeleted : () => false;
    let due = 0;
    Object.keys(bySentence).forEach((key) => {
      const stat = bySentence[key];
      if (!stat || !stat.times || !stat.deckId || !knownDeckIds.has(stat.deckId)) return;
      const separator = key.indexOf("#");
      const cid = separator >= 0 ? key.slice(separator + 1) : "";
      if (isDeleted(stat.deckId, cid)) return;
      if (isDue(stat, now)) due += 1;
    });
    return {
      due,
      book: Array.isArray(options.reinforceBook) ? options.reinforceBook.length : 0
    };
  }
  return __toCommonJS(main_home_summary_entry_exports);
})();
