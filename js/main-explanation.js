var MainExplanation = (() => {
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

  // scripts/main-explanation-entry.mjs
  var main_explanation_entry_exports = {};
  __export(main_explanation_entry_exports, {
    buildAnalysisSections: () => buildAnalysisSections,
    buildFallbackExplanation: () => buildFallbackExplanation,
    escapeHtml: () => escapeHtml,
    miniMd: () => miniMd
  });

  // src/main/explanation.mjs
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>\"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    })[char]);
  }
  function miniMd(value) {
    return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*\s][^*]*)\*/g, "<i>$1</i>");
  }
  function buildFallbackExplanation(item) {
    const raw = item && (item.explanation || item.explain);
    const custom = typeof raw === "string" ? { meaning: raw } : raw && typeof raw === "object" ? raw : {};
    if (!raw && item && typeof item.note === "string" && item.note.trim()) custom.note = item.note;
    const sections = [];
    const meaning = String(custom.meaning || custom.core || "").trim();
    if (meaning) {
      sections.push({ tag: "\u6838\u5FC3\u542B\u4E49", html: '<div class="explain-overview"><strong>' + miniMd(meaning) + "</strong></div>", variant: "info" });
    }
    const equivalents = Array.isArray(custom.equivalents) ? custom.equivalents : [];
    if (equivalents.length) {
      let html = '<div class="explain-overview"><ul class="explain-bullets">';
      equivalents.forEach((entry) => {
        const text = entry && typeof entry === "object" ? entry.text || entry.value || "" : entry;
        const note2 = entry && typeof entry === "object" ? entry.note || "" : "";
        if (!String(text).trim()) return;
        html += "<li>" + miniMd(String(text)) + (note2 ? '<span class="explain-example-zh">\uFF08' + miniMd(String(note2)) + "\uFF09</span>" : "") + "</li>";
      });
      html += "</ul></div>";
      sections.push({ tag: "\u4E2D\u6587\u5BF9\u5E94\u8868\u8FBE", html, variant: "info" });
    }
    const usage = String(custom.usage || custom.scene || custom.context || "").trim();
    if (usage) sections.push({ tag: "\u5E38\u89C1\u4F7F\u7528\u573A\u666F", html: '<div class="explain-overview">' + miniMd(usage) + "</div>", variant: "info" });
    const note = String(custom.note || custom.tip || "").trim();
    if (note) sections.push({ tag: "\u4F7F\u7528\u63D0\u9192", html: '<div class="explain-overview">' + miniMd(note) + "</div>", variant: "warn" });
    const examples = custom.examples || custom.exampleSentences || item.examples || item.exampleSentences || item.usageExamples;
    const list = Array.isArray(examples) ? examples : examples ? [examples] : [];
    const exampleHtml = list.map((example) => {
      if (example && typeof example === "object") {
        const en = example.en || example.sentence || example.text || "";
        const zh = example.zh || example.translation || example.cn || "";
        return '<div class="explain-example"><div class="explain-example-en">' + escapeHtml(en) + "</div>" + (zh ? '<div class="explain-example-zh">' + escapeHtml(zh) + "</div>" : "") + "</div>";
      }
      return '<div class="explain-example-en">' + miniMd(String(example)) + "</div>";
    });
    if (exampleHtml.length) sections.push({ tag: list.length ? "\u7ECF\u5178\u4F8B\u53E5" : "\u672C\u53E5\u4F8B\u53E5", html: exampleHtml.join(""), variant: "info" });
    if (!sections.length) sections.push({ tag: "\u8BF4\u660E", html: '<div class="explain-overview">\u672C\u53E5\u6682\u65E0\u8865\u5145\u8BB2\u89E3\u3002</div>', variant: "info" });
    return sections;
  }
  function buildAnalysisSections(item) {
    const sections = [];
    const explanations = item && item.explanations || [];
    let hasAny = false;
    explanations.forEach((raw, index) => {
      if (!raw || !String(typeof raw === "object" ? JSON.stringify(raw) : raw).trim()) return;
      hasAny = true;
      const tag = "\u8BB2\u89E3 " + (index + 1);
      if (raw && typeof raw === "object") {
        const dimensions = [
          ["\u8BED\u6CD5", "grammar", "#e74c7a"],
          ["\u53E5\u6CD5", "syntax", "#3358e0"],
          ["\u56FA\u5B9A\u642D\u914D", "collocation", "#c87033"],
          ["\u56FA\u5B9A\u53E5\u578B", "pattern", "#7c5cbf"],
          ["\u53E3\u8BED/\u4FDA\u8BED", "oral", "#2d9d78"]
        ];
        let body = "";
        dimensions.forEach(([label, key, color]) => {
          const value = raw[key];
          if (value && String(value).trim()) {
            body += '<div style="padding:2px 0"><span style="font-size:11px;font-weight:700;color:' + color + '">' + label + "\uFF1A</span>" + miniMd(String(value)) + "</div>";
          }
        });
        if (Array.isArray(raw.words) && raw.words.length) {
          body += '<div style="padding:2px 0">' + raw.words.map((word) => '<span style="display:inline-block;margin:1px 4px 1px 0;padding:1px 7px;border:1px solid var(--border-strong);border-radius:5px;font-size:11.5px;color:var(--accent)"><b>' + escapeHtml(word.w || word.word || "") + "</b>" + (word.p ? ' <span style="color:var(--faint)">(' + escapeHtml(word.p) + ")</span>" : "") + (word.m ? " " + escapeHtml(word.m) : "") + "</span>").join("") + "</div>";
        }
        if (body) sections.push({ tag, html: body, variant: "info" });
      } else {
        sections.push({ tag, html: miniMd(String(raw)), variant: "info" });
      }
    });
    return hasAny ? sections : sections.concat(buildFallbackExplanation(item));
  }
  return __toCommonJS(main_explanation_entry_exports);
})();
