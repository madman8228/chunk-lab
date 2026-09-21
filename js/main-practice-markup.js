var MainPracticeMarkup = (() => {
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

  // scripts/main-practice-markup-entry.mjs
  var main_practice_markup_entry_exports = {};
  __export(main_practice_markup_entry_exports, {
    buildChunkMarkup: () => buildChunkMarkup
  });

  // src/main/practice-markup.mjs
  function buildChunkMarkup(options = {}) {
    const chunk = String(options.chunk == null ? "" : options.chunk);
    const index = Number.isInteger(options.index) ? options.index : 0;
    const words = chunk.trim().split(/\s+/);
    const hint = options.hint || `${words.length} \u8BCD`;
    const grammar = options.grammar && typeof options.grammar === "object" ? options.grammar : null;
    const mode = options.mode === "choose" ? "choose" : "type";
    const esc = typeof options.escapeHtml === "function" ? options.escapeHtml : (value) => String(value == null ? "" : value);
    const roleHtml = grammar ? '<span class="chunk-role" style="background:' + String(grammar.color || "#ccc") + '22">' + esc(grammar.role) + "</span>" : "";
    if (mode === "choose") {
      return '<div class="chunk-answer" data-i="' + index + '" style="--answer-chars:' + Math.max(1, chunk.trim().length) + '"></div>' + (roleHtml ? '<div class="chunk-role-wrap">' + roleHtml + "</div>" : "") + (hint ? '<div class="chunk-hint">' + esc(hint) + "</div>" : "");
    }
    const wordBoxes = words.map((word, wordIndex) => {
      const width = Math.max(28, word.length * 11 + 16);
      return '<div class="word-box"><input class="word-input chunk-input" type="text" data-ci="' + index + '" data-wi="' + wordIndex + '" style="width:' + width + 'px" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" disabled><div class="word-ul ul-seg" style="width:' + (width - 10) + 'px"></div></div>';
    }).join("");
    return (roleHtml ? '<div class="chunk-role-wrap">' + roleHtml + "</div>" : "") + '<div class="chunk-words">' + wordBoxes + '</div><div class="chunk-hint">' + esc(hint) + "</div>";
  }
  return __toCommonJS(main_practice_markup_entry_exports);
})();
