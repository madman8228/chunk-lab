var VocabularyStudy = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // js/vocabulary-read-aloud.js
  var require_vocabulary_read_aloud = __commonJS({
    "js/vocabulary-read-aloud.js"(exports, module) {
      (function(root) {
        "use strict";
        const check = (ok, message) => {
          if (!ok) throw Error(message);
        };
        function validate(item, activity, engine) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u8DDF\u8BFB\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "target", "text", "audio"].includes(key)), "\u8DDF\u8BFB\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          engine.validate(item.exercise);
          check(typeof item.word === "string" && item.word.trim(), "\u8DDF\u8BFB\u8BCD\u5934\u65E0\u6548");
          check(["word", "sentence"].includes(activity.target), "\u8DDF\u8BFB\u9700\u8981\u660E\u786E\u5355\u8BCD\u6216\u4F8B\u53E5\u76EE\u6807");
          check(typeof activity.text === "string" && activity.text.trim() && activity.text.length <= 1e3 && activity.text === (activity.target === "word" ? item.word : engine.sentence(item.exercise)), "\u8DDF\u8BFB\u6587\u672C\u4E0E\u76EE\u6807\u4E0D\u4E00\u81F4");
          const audio = activity.audio, formats = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav" };
          check(audio && Object.keys(audio).every((key) => ["url", "sha256", "bytes", "mimeType"].includes(key)), "\u8DDF\u8BFB\u793A\u8303\u97F3\u9891\u914D\u7F6E\u65E0\u6548");
          check(formats[audio.mimeType] && typeof audio.url === "string" && new RegExp("^assets/[A-Za-z0-9._-]+\\." + formats[audio.mimeType] + "$").test(audio.url), "\u8DDF\u8BFB\u793A\u8303\u987B\u4F7F\u7528\u56FA\u5B9A\u672C\u5730\u8BFE\u7A0B\u97F3\u9891");
          check(/^[a-f0-9]{64}$/.test(audio.sha256 || "") && Number.isSafeInteger(audio.bytes) && audio.bytes > 0 && audio.bytes <= 1e7, "\u8DDF\u8BFB\u97F3\u9891\u6458\u8981\u6216\u5927\u5C0F\u65E0\u6548");
          return activity;
        }
        function report(item, activity, value, engine) {
          validate(item, activity, engine);
          const keys = ["listened", "recorded", "replayed", "confirmed"];
          check(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key) && value[key] === true), "\u8BF7\u660E\u786E\u786E\u8BA4\u542C\u793A\u8303\u3001\u5F55\u97F3\u548C\u56DE\u542C\uFF1B\u4E0D\u63A5\u53D7\u8BC4\u5206\u6216\u5F55\u97F3\u4E0A\u4F20");
          return { practiceType: "read-aloud", practiceRevision: activity.revision, target: activity.target, audioSha256: activity.audio.sha256, evidence: "unverified-self-report", verification: "unverified", assessment: false, reported: { listened: true, recorded: true, replayed: true, confirmed: true } };
        }
        const api = { validate, report };
        root.VocabularyReadAloud = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-chunk-order.js
  var require_vocabulary_chunk_order = __commonJS({
    "js/vocabulary-chunk-order.js"(exports, module) {
      (function(root) {
        "use strict";
        const check = (value, message) => {
          if (!value) throw Error(message);
        };
        const normalize = (value) => String(value).normalize("NFKC").trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLowerCase();
        const id = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
        function validate(item, activity, engine) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u62FC\u5757\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "chunks", "correctOrder"].includes(key)), "\u62FC\u5757\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          engine.validate(item.exercise);
          check(typeof item.word === "string" && item.word.trim() && engine.blanks(item.exercise).some((blank) => blank.answers.some((answer) => engine.normalize(answer) === engine.normalize(item.word))), "\u62FC\u5757\u987B\u7EC3\u4E60\u5F53\u524D\u8BCD\u4E49\u7684\u8BCD\u5934");
          check(Array.isArray(activity.chunks) && activity.chunks.length >= 2 && activity.chunks.length <= 24, "\u62FC\u5757\u9700\u89812\u81F324\u4E2A\u660E\u786E\u7F16\u5199\u7684\u8BCD\u5757");
          const chunks = /* @__PURE__ */ new Map();
          for (const chunk of activity.chunks) {
            check(chunk && Object.keys(chunk).every((key) => ["id", "text"].includes(key)) && id(chunk.id) && !chunks.has(chunk.id) && typeof chunk.text === "string" && chunk.text.trim() && chunk.text.length <= 1e3, "\u8BCD\u5757\u7F16\u53F7\u91CD\u590D\u6216\u6587\u672C\u65E0\u6548");
            chunks.set(chunk.id, chunk.text);
          }
          check(Array.isArray(activity.correctOrder) && activity.correctOrder.length === chunks.size && new Set(activity.correctOrder).size === chunks.size && Array.from(activity.correctOrder).every((key) => typeof key === "string" && chunks.has(key)), "\u62FC\u5757\u6807\u51C6\u987A\u5E8F\u987B\u5B8C\u6574\u4F7F\u7528\u6BCF\u4E2A\u7F16\u53F7\u4E00\u6B21");
          const sentence = activity.correctOrder.map((key) => chunks.get(key)).join(" ");
          check(sentence.length <= 1e3 && normalize(sentence) === normalize(engine.sentence(item.exercise)), "\u62FC\u5757\u987A\u5E8F\u3001\u8BCD\u5757\u6216\u6807\u70B9\u6539\u53D8\u4E86\u539F\u53E5");
          return activity;
        }
        function evaluate(item, activity, values, engine) {
          validate(item, activity, engine);
          const chunks = new Map(activity.chunks.map((chunk) => [chunk.id, chunk.text]));
          const ids = values && typeof values === "object" && !Array.isArray(values) && Object.keys(values).length === 1 && Object.hasOwn(values, "chunkIds") ? values.chunkIds : null;
          const complete = Array.isArray(ids) && ids.length === chunks.size && new Set(ids).size === chunks.size && Array.from(ids).every((key) => typeof key === "string" && chunks.has(key));
          const correct = !!complete && normalize(ids.map((key) => chunks.get(key)).join(" ")) === normalize(engine.sentence(item.exercise));
          return { correct, assisted: true, practiceType: "chunk-order", ability: "authored-sentence-ordering", practiceRevision: activity.revision };
        }
        const api = { normalize, validate, evaluate };
        root.VocabularyChunkOrder = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-word-choice.js
  var require_vocabulary_word_choice = __commonJS({
    "js/vocabulary-word-choice.js"(exports, module) {
      (function(root) {
        "use strict";
        const check = (value, message) => {
          if (!value) throw Error(message);
        };
        const text = (value) => typeof value === "string" && !!value.trim() && value.length <= 1e3;
        const id = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
        function validate(item, activity, engine) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u9009\u8BCD\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "field", "options", "correctOptionId"].includes(key)), "\u9009\u8BCD\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          engine.validate(item.exercise);
          const blanks = engine.blanks(item.exercise), field = blanks.find((blank) => blank.id === activity.field);
          check(blanks.length === 1 && field, "\u9009\u8BCD\u7EC3\u4E60\u987B\u660E\u786E\u7ED1\u5B9A\u552F\u4E00\u76EE\u6807\u586B\u7A7A");
          check(text(item.word) && field.answers.some((answer) => engine.normalize(answer) === engine.normalize(item.word)), "\u9009\u8BCD\u76EE\u6807\u987B\u5BF9\u5E94\u5F53\u524D\u8BCD\u4E49\u7684\u8BCD\u5934");
          check(Array.isArray(activity.options) && activity.options.length >= 2 && activity.options.length <= 6, "\u9009\u8BCD\u9700\u89812\u81F36\u4E2A\u660E\u786E\u7F16\u5199\u7684\u9009\u9879");
          const ids = /* @__PURE__ */ new Set(), labels = /* @__PURE__ */ new Set();
          for (const option of activity.options) {
            check(option && Object.keys(option).every((key) => ["id", "text", "feedback"].includes(key)) && id(option.id) && text(option.text) && text(option.feedback), "\u9009\u9879\u9700\u8981\u72EC\u7ACB\u7F16\u53F7\u3001\u6587\u672C\u53CA\u6559\u5B66\u89E3\u91CA");
            const normalized = engine.normalize(option.text);
            check(normalized && !ids.has(option.id) && !labels.has(normalized), "\u9009\u8BCD\u7F16\u53F7\u6216\u5F52\u4E00\u5316\u6587\u672C\u91CD\u590D");
            ids.add(option.id);
            labels.add(normalized);
            const accepted = field.answers.some((answer) => engine.normalize(answer) === normalized);
            check(accepted === (option.id === activity.correctOptionId), "\u9009\u8BCD\u6B63\u786E\u9879\u6216\u5E72\u6270\u9879\u4E0E\u539F\u9898\u7B54\u6848\u4E0D\u4E00\u81F4");
          }
          check(ids.has(activity.correctOptionId), "\u9009\u8BCD\u7F3A\u5C11\u6B63\u786E\u9009\u9879");
          return activity;
        }
        function evaluate(item, activity, values, engine) {
          validate(item, activity, engine);
          const valid = values && typeof values === "object" && !Array.isArray(values) && Object.keys(values).length === 1 && Object.hasOwn(values, "optionId") && typeof values.optionId === "string";
          const selected = valid ? activity.options.find((option) => option.id === values.optionId) : null;
          return { correct: !!selected && selected.id === activity.correctOptionId, feedback: selected?.feedback || "\u8BF7\u9009\u62E9\u5F53\u524D\u7EC3\u4E60\u4E2D\u7684\u9009\u9879\u3002", assisted: true, practiceType: "word-choice", ability: "word-recognition-in-authored-context", practiceRevision: activity.revision };
        }
        const api = { validate, evaluate };
        root.VocabularyWordChoice = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-sentence-audio.js
  var require_vocabulary_sentence_audio = __commonJS({
    "js/vocabulary-sentence-audio.js"(exports, module) {
      (function(root) {
        "use strict";
        const check = (ok, message) => {
          if (!ok) throw Error(message);
        };
        const formats = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav" };
        function validateClip(audio) {
          check(audio && Object.keys(audio).every((k) => ["url", "sha256", "bytes", "mimeType"].includes(k)), "\u4F8B\u53E5\u97F3\u9891\u914D\u7F6E\u65E0\u6548");
          check(formats[audio.mimeType] && typeof audio.url === "string" && new RegExp("^assets/[A-Za-z0-9._-]+\\." + formats[audio.mimeType] + "$").test(audio.url), "\u4F8B\u53E5\u97F3\u9891\u5FC5\u987B\u4F7F\u7528\u56FA\u5B9A\u672C\u5730\u7D20\u6750\u5F15\u7528");
          check(/^[a-f0-9]{64}$/.test(audio.sha256 || "") && Number.isSafeInteger(audio.bytes) && audio.bytes > 0 && audio.bytes <= 1e7, "\u4F8B\u53E5\u97F3\u9891\u6458\u8981\u6216\u5927\u5C0F\u65E0\u6548");
        }
        function validate(item, activity, engine) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision), "\u4F8B\u53E5\u97F3\u9891\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((k) => ["schemaVersion", "revision", "text", "audio", "audioByAccent"].includes(k)), "\u4F8B\u53E5\u97F3\u9891\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          check(typeof activity.text === "string" && activity.text.length <= 4e3 && activity.text === engine.sentence(item.exercise), "\u4F8B\u53E5\u97F3\u9891\u6587\u672C\u4E0E\u5F53\u524D\u4F8B\u53E5\u4E0D\u4E00\u81F4");
          validateClip(activity.audio);
          if (activity.audioByAccent !== void 0) {
            const variants = activity.audioByAccent;
            check(variants && typeof variants === "object" && !Array.isArray(variants) && Object.keys(variants).length > 0 && Object.keys(variants).every((accent) => ["en-US", "en-GB"].includes(accent)), "\u4F8B\u53E5\u97F3\u9891\u53E3\u97F3\u65E0\u6548");
            for (const clip of Object.values(variants)) validateClip(clip);
          }
          return activity;
        }
        const api = { validate };
        root.VocabularySentenceAudio = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-word-dictation.js
  var require_vocabulary_word_dictation = __commonJS({
    "js/vocabulary-word-dictation.js"(exports, module) {
      (function(root) {
        "use strict";
        const check = (value, message) => {
          if (!value) throw Error(message);
        };
        const normalize = (value) => String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
        function validate(item, activity) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u542C\u5199\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "audio", "answers"].includes(key)), "\u542C\u5199\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          const audio = activity.audio;
          check(audio && Object.keys(audio).every((key) => ["url", "sha256", "bytes", "mimeType"].includes(key)), "\u542C\u5199\u97F3\u9891\u914D\u7F6E\u65E0\u6548");
          const formats = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav" }, extension = formats[audio.mimeType];
          check(extension && typeof audio.url === "string" && new RegExp("^assets/[A-Za-z0-9._-]+\\." + extension + "$").test(audio.url), "\u542C\u5199\u53EA\u63A5\u53D7\u660E\u786E\u7684\u672C\u5730\u97F3\u9891\uFF0C\u4E0D\u4F7F\u7528\u4E34\u65F6\u8BED\u97F3\u5408\u6210\u5192\u5145\u8BFE\u7A0B\u7D20\u6750");
          check(/^[a-f0-9]{64}$/.test(audio.sha256 || "") && Number.isSafeInteger(audio.bytes) && audio.bytes > 0 && audio.bytes <= 1e7, "\u542C\u5199\u97F3\u9891\u6458\u8981\u6216\u5927\u5C0F\u65E0\u6548");
          check(typeof item.word === "string" && item.word.trim() && Array.isArray(activity.answers) && activity.answers.length > 0 && activity.answers.length <= 8, "\u542C\u5199\u7B54\u6848\u65E0\u6548");
          check(activity.answers.every((answer) => typeof answer === "string" && answer.trim() && answer.length <= 200), "\u542C\u5199\u7B54\u6848\u7F3A\u5931\u6216\u8FC7\u957F");
          const answers = activity.answers.map(normalize);
          check(new Set(answers).size === answers.length && answers.includes(normalize(item.word)), "\u542C\u5199\u7B54\u6848\u91CD\u590D\u6216\u9057\u6F0F\u539F\u8BCD");
          return activity;
        }
        function evaluate(item, activity, values) {
          validate(item, activity);
          const valid = values && typeof values === "object" && !Array.isArray(values) && Object.keys(values).length === 1 && Object.hasOwn(values, "word") && typeof values.word === "string" && values.word.length <= 200;
          return { correct: !!valid && activity.answers.some((answer) => normalize(answer) === normalize(values.word)), assisted: true, practiceType: "word-dictation", ability: "word-spelling-from-authored-audio", practiceRevision: activity.revision };
        }
        const api = { normalize, validate, evaluate };
        root.VocabularyWordDictation = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-course-contract.js
  var require_vocabulary_course_contract = __commonJS({
    "js/vocabulary-course-contract.js"(exports, module) {
      (function(root) {
        "use strict";
        const validId2 = (v) => typeof v === "string" && !["__proto__", "constructor", "prototype"].includes(v) && /^[A-Za-z0-9:._-]{1,160}$/.test(v);
        const text = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 1e3;
        const revision = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
        const modes = Object.freeze({
          "sentence-cloze": Object.freeze({ label: "\u53E5\u5B50\u586B\u7A7A", implemented: true, inputs: ["typing"] }),
          "guided-expression": Object.freeze({ label: "\u4E2D\u6587\u5F15\u5BFC\u8868\u8FBE", implemented: true, inputs: ["typing", "chunks"] }),
          "read-aloud": Object.freeze({ label: "\u8DDF\u8BFB", implemented: true, inputs: ["speech"], independent: true, learningKey: "readAloud" }),
          "word-choice": Object.freeze({ label: "\u9009\u8BCD\u586B\u7A7A", implemented: true, inputs: ["choice"], independent: true, learningKey: "wordChoice" }),
          "chunk-order": Object.freeze({ label: "\u8BCD\u5E8F\u62FC\u5757", implemented: true, inputs: ["chunks"], independent: true, learningKey: "chunkOrder" }),
          "word-dictation": Object.freeze({ label: "\u5355\u8BCD\u542C\u5199", implemented: true, inputs: ["typing"], independent: true, learningKey: "wordDictation" })
        });
        const dimensions = ["audiences", "schoolStages", "grades", "levels", "goals", "topics", "exams"], scalars = ["seriesId", "publisherId", "textbookVersion", "edition", "volume"];
        function check(value, message) {
          if (!value) throw Error(message);
        }
        function validateBookStructure(book) {
          if (book.catalog !== void 0) {
            const c = book.catalog;
            check(c && typeof c === "object" && !Array.isArray(c), "\u76EE\u5F55\u4FE1\u606F\u65E0\u6548");
            check(Object.keys(c).every((k) => ["description", "coverUrl", "facets"].includes(k)), "\u76EE\u5F55\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
            if (c.description !== void 0) check(text(c.description), "\u7B80\u4ECB\u65E0\u6548");
            if (c.coverUrl !== void 0) check(typeof c.coverUrl === "string" && /^assets\/[A-Za-z0-9._-]+\.(avif|webp|png|jpg|svg)$/.test(c.coverUrl), "\u5C01\u9762\u8DEF\u5F84\u65E0\u6548");
            const facets = c.facets || {};
            check(facets && typeof facets === "object" && !Array.isArray(facets), "\u5206\u7C7B\u65E0\u6548");
            check(Object.keys(facets).every((k) => dimensions.includes(k) || scalars.includes(k)), "\u672A\u77E5\u5206\u7C7B\u5B57\u6BB5");
            for (const [k, v] of Object.entries(facets)) check(dimensions.includes(k) ? Array.isArray(v) && v.length <= 20 && v.every((x) => text(x) && x.length <= 60) : text(v) && v.length <= 100, "\u5206\u7C7B\u503C\u65E0\u6548\uFF1A" + k);
          }
          if (book.units === void 0) return book;
          check(revision(book.structureRevision), "\u5355\u5143\u7ED3\u6784\u9700\u8981\u72EC\u7ACB\u7248\u672C");
          check(Array.isArray(book.units) && book.units.length > 0, "\u5355\u5143\u5217\u8868\u65E0\u6548");
          const seen = /* @__PURE__ */ new Set(), assigned = [];
          for (const u of book.units) {
            check(u && validId2(u.unitId) && !seen.has(u.unitId) && text(u.title), "\u5355\u5143\u8EAB\u4EFD\u6216\u6807\u9898\u65E0\u6548");
            seen.add(u.unitId);
            check(Object.keys(u).every((k) => ["unitId", "title", "itemIds"].includes(k)), "\u5355\u5143\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
            check(Array.isArray(u.itemIds) && u.itemIds.length > 0 && u.itemIds.every(validId2), "\u5355\u5143\u5F15\u7528\u65E0\u6548");
            assigned.push(...u.itemIds);
          }
          check(assigned.length === book.items.length && assigned.every((v, i) => v === book.items[i].itemId), "\u5355\u5143\u5FC5\u987B\u6309\u987A\u5E8F\u5B8C\u6574\u5206\u914D\u9879\u76EE\uFF0C\u4E0D\u5F97\u91CD\u590D\u3001\u9057\u6F0F\u6216\u8DE8\u4E66\u5F15\u7528");
          return book;
        }
        function validateGuidedActivity(item, activity, engine) {
          check(activity && activity.schemaVersion === 1 && revision(activity.revision), "\u5F15\u5BFC\u7EC3\u4E60\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((k) => ["schemaVersion", "revision", "steps"].includes(k)), "\u5F15\u5BFC\u7EC3\u4E60\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          const steps = activity.steps;
          check(Array.isArray(steps) && steps.length > 0 && steps.length <= 100, "\u5F15\u5BFC\u6B65\u9AA4\u65E0\u6548");
          engine.validate(item.exercise);
          const fields = engine.blanks(item.exercise), assigned = /* @__PURE__ */ new Set();
          for (const s of steps) {
            check(s && Object.keys(s).every((k) => ["prompt", "answer", "choices", "field"].includes(k)) && text(s.prompt) && text(s.answer), "\u5F15\u5BFC\u63D0\u793A\u6216\u7B54\u6848\u65E0\u6548");
            check(Array.isArray(s.choices) && s.choices.length >= 2 && s.choices.length <= 8 && s.choices.every(text), "\u5F15\u5BFC\u9009\u9879\u65E0\u6548");
            const choices = s.choices.map(engine.normalize);
            check(new Set(choices).size === choices.length && choices.includes(engine.normalize(s.answer)), "\u9009\u9879\u91CD\u590D\u6216\u7F3A\u5C11\u6B63\u786E\u7B54\u6848");
            if (s.field !== void 0) {
              const f = fields.find((f2) => f2.id === s.field);
              check(f && !assigned.has(s.field) && f.answers.some((a) => engine.normalize(a) === engine.normalize(s.answer)), "\u7B54\u6848\u5B57\u6BB5\u4E0D\u5339\u914D");
              assigned.add(s.field);
            }
          }
          check(assigned.size === fields.length, "\u5F15\u5BFC\u7EC3\u4E60\u9057\u6F0F\u539F\u9898\u5B57\u6BB5");
          check(engine.normalize(steps.map((s) => s.answer).join(" ")) === engine.normalize(engine.sentence(item.exercise)), "\u5F15\u5BFC\u6B65\u9AA4\u6539\u53D8\u4E86\u539F\u53E5");
          return activity;
        }
        function validateLearning(item, engine) {
          if (item.phonetic !== void 0) check(typeof item.phonetic === "string" && !!item.phonetic.trim() && item.phonetic.length <= 200, "\u97F3\u6807\u65E0\u6548\u6216\u8FC7\u957F");
          if (item.phonetics !== void 0) {
            const variants = item.phonetics;
            check(variants && typeof variants === "object" && !Array.isArray(variants) && Object.keys(variants).length > 0 && Object.keys(variants).every((accent) => ["en-US", "en-GB"].includes(accent)) && Object.values(variants).every((value) => typeof value === "string" && !!value.trim() && value.length <= 200), "\u53E3\u97F3\u97F3\u6807\u65E0\u6548\u6216\u8FC7\u957F");
          }
          if (item.learning === void 0) return item;
          check(item.learning && item.learning.schemaVersion === 1, "\u6559\u5B66\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(item.learning).every((k) => ["schemaVersion", "guidedExpression", "wordDictation", "sentenceAudio", "wordChoice", "chunkOrder", "readAloud"].includes(k)), "\u5305\u542B\u672A\u652F\u6301\u7684\u7EC3\u4E60\u914D\u7F6E");
          if (item.learning.readAloud !== void 0) {
            const model = root.VocabularyReadAloud || (typeof __require === "function" ? require_vocabulary_read_aloud() : null);
            check(model, "\u8DDF\u8BFB\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.readAloud, engine);
          }
          if (item.learning.chunkOrder !== void 0) {
            const model = root.VocabularyChunkOrder || (typeof __require === "function" ? require_vocabulary_chunk_order() : null);
            check(model, "\u62FC\u5757\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.chunkOrder, engine);
          }
          if (item.learning.wordChoice !== void 0) {
            const model = root.VocabularyWordChoice || (typeof __require === "function" ? require_vocabulary_word_choice() : null);
            check(model, "\u9009\u8BCD\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.wordChoice, engine);
          }
          if (item.learning.sentenceAudio !== void 0) {
            const model = root.VocabularySentenceAudio || (typeof __require === "function" ? require_vocabulary_sentence_audio() : null);
            check(model, "\u4F8B\u53E5\u97F3\u9891\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.sentenceAudio, engine);
          }
          if (item.learning.guidedExpression !== void 0) validateGuidedActivity(item, item.learning.guidedExpression, engine);
          if (item.learning.wordDictation !== void 0) {
            const dictation = root.VocabularyWordDictation || (typeof __require === "function" ? require_vocabulary_word_dictation() : null);
            check(dictation, "\u542C\u5199\u5185\u5BB9\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            dictation.validate(item, item.learning.wordDictation);
          }
          return item;
        }
        function capabilities(item, engine) {
          validateLearning(item, engine);
          return Object.entries(modes).map(([practiceType, m]) => {
            const missing = practiceType === "guided-expression" && !item.learning?.guidedExpression ? "\u7F3A\u5C11\u4E2D\u6587\u5F15\u5BFC\u7D20\u6750" : practiceType === "word-dictation" && !item.learning?.wordDictation ? "\u7F3A\u5C11\u8BFE\u7A0B\u542C\u5199\u97F3\u9891" : practiceType === "word-choice" && !item.learning?.wordChoice ? "\u7F3A\u5C11\u8BFE\u7A0B\u9009\u8BCD\u7D20\u6750" : practiceType === "chunk-order" && !item.learning?.chunkOrder ? "\u7F3A\u5C11\u8BFE\u7A0B\u62FC\u5757\u7D20\u6750" : practiceType === "read-aloud" && !item.learning?.readAloud ? "\u7F3A\u5C11\u8BFE\u7A0B\u8DDF\u8BFB\u793A\u8303" : "";
            return { practiceType, label: m.label, available: m.implemented && !missing, inputs: m.inputs.slice(), reason: !m.implemented ? "\u5C1A\u672A\u5B9E\u73B0" : missing };
          });
        }
        function details(book) {
          validateBookStructure(book);
          return {
            bookId: book.bookId,
            revision: book.revision,
            title: book.title,
            itemCount: book.itemCount,
            catalog: book.catalog || null,
            relatedCourseIds: (book.relatedCourseIds || []).slice(),
            structureRevision: book.structureRevision || null,
            features: { unitSessions: true },
            units: (book.units || []).map((u) => ({ unitId: u.unitId, title: u.title, itemCount: u.itemIds.length })),
            organization: book.units ? "units" : "flat"
          };
        }
        const separatePractice = (practiceType) => typeof practiceType === "string" && Object.hasOwn(modes, practiceType) && modes[practiceType].independent === true;
        const api = { modes, separatePractice, validateBookStructure, validateGuidedActivity, validateLearning, capabilities, details };
        root.VocabularyCourseContract = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // scripts/vocabulary-study-entry.mjs
  var vocabulary_study_entry_exports = {};
  __export(vocabulary_study_entry_exports, {
    initialCursor: () => initialCursor,
    nextCursor: () => nextCursor,
    pageBook: () => pageBook,
    pageBounds: () => pageBounds,
    resumeHref: () => resumeHref,
    selectHomeResume: () => selectHomeResume,
    validId: () => validId,
    validateIndex: () => validateIndex
  });

  // src/vocabulary-study/content-model.mjs
  var import_vocabulary_course_contract = __toESM(require_vocabulary_course_contract(), 1);
  function validId(id) {
    return typeof id === "string" && !["__proto__", "constructor", "prototype"].includes(id) && /^[A-Za-z0-9:._-]{1,160}$/.test(id);
  }
  function validateIndex(index, { allowItemVersions = false } = {}) {
    if (index?.schemaVersion !== 1 || !Array.isArray(index.books)) throw new Error("\u5355\u8BCD\u672C\u7D22\u5F15\u683C\u5F0F\u65E0\u6548");
    const books = /* @__PURE__ */ new Set(), revisions = /* @__PURE__ */ new Map(), files = /* @__PURE__ */ new Map();
    for (const book of index.books) {
      if (!validId(book.bookId) || books.has(book.bookId) || !/^[a-f0-9]{64}$/.test(book.revision || "") || typeof book.title !== "string" || !book.title.trim() || !Array.isArray(book.items) || !book.items.length || book.itemCount !== book.items.length) throw new Error("\u5355\u8BCD\u672C\u8EAB\u4EFD\u6216\u7248\u672C\u65E0\u6548");
      import_vocabulary_course_contract.default.validateBookStructure(book);
      books.add(book.bookId);
      const items = /* @__PURE__ */ new Set();
      for (const ref of book.items) {
        if (!validId(ref.itemId) || items.has(ref.itemId) || !/^[a-f0-9]{64}$/.test(ref.contentRevision || "") || !allowItemVersions && revisions.has(ref.itemId) && revisions.get(ref.itemId) !== ref.contentRevision) throw new Error("\u6559\u5B66\u9879\u76EE\u8EAB\u4EFD\u6216\u7248\u672C\u51B2\u7A81");
        items.add(ref.itemId);
        revisions.set(ref.itemId, ref.contentRevision);
        const fileId = ref.itemId.replace(/:/g, "_");
        if (files.has(fileId) && files.get(fileId) !== ref.itemId) throw new Error("\u6559\u5B66\u9879\u76EE\u6587\u4EF6\u8EAB\u4EFD\u51B2\u7A81");
        files.set(fileId, ref.itemId);
      }
    }
    return index;
  }
  function pageBounds(offset = 0, limit = 20) {
    offset = Number(offset);
    limit = Number(limit);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error("\u5206\u9875\u53C2\u6570\u65E0\u6548");
    return { offset, limit };
  }
  function pageBook(book, offset = 0, limit = 20) {
    const page = pageBounds(offset, limit);
    return {
      bookId: book.bookId,
      revision: book.revision,
      title: book.title,
      itemCount: book.itemCount,
      items: book.items.slice(page.offset, page.offset + page.limit),
      nextOffset: page.offset + page.limit < book.itemCount ? page.offset + page.limit : null
    };
  }

  // src/vocabulary-study/session-model.mjs
  function nextCursor(book, itemId) {
    const index = book.items.findIndex((item) => item.itemId === itemId);
    if (index < 0) throw new Error("\u9879\u76EE\u4E0D\u5C5E\u4E8E\u5F53\u524D\u5355\u8BCD\u672C");
    const next = book.items[index + 1];
    return { itemId: next?.itemId || null, status: next ? "active" : "completed" };
  }
  function initialCursor(book) {
    return { itemId: book.items[0]?.itemId || null, status: book.items.length ? "active" : "completed" };
  }

  // src/vocabulary-study/home-resume.mjs
  var import_vocabulary_course_contract2 = __toESM(require_vocabulary_course_contract(), 1);
  function selectHomeResume(chunk, vocabulary = {}) {
    const entries = Object.values(vocabulary).filter((row) => row?.status === "active" && row.itemId && row.bookId).map((row) => ({
      toolId: "vocabulary",
      title: row.title || "\u7EE7\u7EED\u5355\u8BCD\u672C\u7EC3\u4E60",
      resourceId: "wordbook:" + row.bookId,
      serverTime: Number(row.serverTime) || 0,
      bookId: row.bookId,
      unitId: row.unitId,
      structureRevision: row.structureRevision,
      practiceType: row.practiceType
    }));
    if (chunk) entries.push({ ...chunk, toolId: "chunks", serverTime: Number(chunk.serverTime || chunk.updatedAt) || 0 });
    return entries.sort((a, b) => b.serverTime - a.serverTime)[0] || null;
  }
  function resumeHref(resume) {
    return "wordbook.html?book=" + encodeURIComponent(resume.bookId) + (resume.unitId ? "&unit=" + encodeURIComponent(resume.unitId) + "&structureRevision=" + encodeURIComponent(resume.structureRevision) : "") + (import_vocabulary_course_contract2.default.separatePractice(resume.practiceType) ? "&practice=" + encodeURIComponent(resume.practiceType) : "");
  }
  return __toCommonJS(vocabulary_study_entry_exports);
})();
