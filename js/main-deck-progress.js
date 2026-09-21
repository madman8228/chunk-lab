var MainDeckProgress = (() => {
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

  // scripts/main-deck-progress-entry.mjs
  var main_deck_progress_entry_exports = {};
  __export(main_deck_progress_entry_exports, {
    buildDeckProgressMarkup: () => buildDeckProgressMarkup,
    calculateDeckLearningProgress: () => calculateDeckLearningProgress
  });

  // src/main/deck-progress.mjs
  function calculateDeckLearningProgress(options = {}) {
    const total = Math.max(0, Number(options.total) || 0);
    const items = Array.isArray(options.items) ? options.items : null;
    if (!items) return { done: null, total, pct: null, ready: false };
    const deckId = String(options.deckId || "");
    const bySentence = options.stats && options.stats.bySentence && typeof options.stats.bySentence === "object" ? options.stats.bySentence : {};
    const cidOf = typeof options.cidOf === "function" ? options.cidOf : (item) => item && item.cid;
    const isDeleted = typeof options.isDeleted === "function" ? options.isDeleted : () => false;
    const currentCids = /* @__PURE__ */ new Set();
    items.forEach((item) => {
      const cid = cidOf(item);
      if (cid) currentCids.add(cid);
    });
    const seen = /* @__PURE__ */ new Set();
    const prefix = `${deckId}#`;
    Object.keys(bySentence).forEach((key) => {
      if (!key.startsWith(prefix)) return;
      const stat = bySentence[key];
      if (!stat || !stat.times) return;
      const cid = key.slice(prefix.length);
      if (!currentCids.has(cid) || isDeleted(deckId, cid)) return;
      seen.add(cid);
    });
    const done = Math.min(total, seen.size);
    return { done, total, pct: total ? Math.round(done / total * 100) : 0, ready: true };
  }
  function buildDeckProgressMarkup(options = {}) {
    const progress = options.progress || { done: null, total: 0, pct: null, ready: false };
    if (!progress.ready) {
      return '<div class="sub home-deck-progress" aria-label="\u6B63\u5728\u6838\u5BF9\u8BFE\u8282\u8FDB\u5EA6"><span>\u6B63\u5728\u6838\u5BF9\u8FDB\u5EA6\u2026</span></div><div class="home-deck-progress-track" aria-hidden="true"><i style="width:0"></i></div>';
    }
    const resumeIdx = Number(options.resumeIdx) || 0;
    const current = resumeIdx > 0 ? '<span class="current">\u5F53\u524D\u7B2C ' + Math.min(resumeIdx + 1, progress.total || resumeIdx + 1) + " \u53E5</span>" : "";
    const best = options.best;
    const last = best && typeof best.lastAcc === "number" && Number.isFinite(best.lastAcc) ? '<span class="last-acc">\u4E0A\u6B21 ' + best.lastAcc + "%</span>" : "";
    const sessionCount = Number(options.sessionCount) || 0;
    const session = sessionCount > 0 ? '<span class="session-answered">\u672C\u6B21\u5B8C\u6210 ' + sessionCount + " \u53E5</span>" : "";
    const aria = "\u5DF2\u8986\u76D6 " + progress.done + " / " + progress.total + " \u53E5\uFF0C\u6309\u53E5\u5B50\u53BB\u91CD\uFF0C\u8986\u76D6 " + progress.pct + "%" + (sessionCount > 0 ? "\uFF0C\u672C\u6B21\u5B8C\u6210 " + sessionCount + " \u53E5" : "");
    return '<div class="sub home-deck-progress" role="progressbar" aria-label="' + aria + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress.pct + '"><span title="\u6309\u4E0D\u540C\u53E5\u5B50\u53BB\u91CD\uFF0C\u91CD\u590D\u7EC3\u4E60\u4E0D\u4F1A\u589E\u52A0">\u5DF2\u8986\u76D6 ' + progress.done + " / " + progress.total + ' \u53E5</span><span class="pct">\u8986\u76D6 ' + progress.pct + "%</span>" + current + last + session + '</div><div class="home-deck-progress-track' + (progress.pct >= 100 ? " done" : "") + '" aria-hidden="true"><i style="width:' + progress.pct + '%"></i></div>';
  }
  return __toCommonJS(main_deck_progress_entry_exports);
})();
