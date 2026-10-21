(() => {
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

  // src/vocabulary-material-library/core.cjs
  var require_core = __commonJS({
    "src/vocabulary-material-library/core.cjs"(exports, module) {
      "use strict";
      function createModel({ hash, draftModel: draftModel2, engine: engine2, contract: contract2, applicationModel: applicationModel2 }) {
        const validId = (value) => typeof value === "string" && /^[A-Za-z0-9:._-]{1,160}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
        const text = (value) => typeof value === "string" && !!value.trim() && value.length <= 4e3;
        function check(ok, message) {
          if (!ok) throw Error(message);
        }
        function fields(value, allowed, label) {
          check(value && typeof value === "object" && !Array.isArray(value), label + "\u5FC5\u987B\u4E3A\u5BF9\u8C61");
          check(Object.keys(value).every((key) => allowed.includes(key)), label + "\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
        }
        function canonical2(value) {
          if (Array.isArray(value)) return value.map(canonical2);
          if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical2(value[key])]));
          return value;
        }
        function revisionOf(value) {
          const { revision, ...body } = value;
          return hash(JSON.stringify(canonical2(body)));
        }
        function versioned(value) {
          return { ...structuredClone(value), revision: revisionOf(value) };
        }
        function rows(values, idKey, allowed, label) {
          check(Array.isArray(values) && values.length <= 1e4, label + "\u5217\u8868\u65E0\u6548");
          const index = /* @__PURE__ */ new Map();
          for (const value of values) {
            fields(value, allowed, label);
            check(validId(value[idKey]) && !index.has(value[idKey]), label + "\u7F16\u53F7\u65E0\u6548\u6216\u91CD\u590D");
            check(value.revision === revisionOf(value), label + "\u5185\u5BB9\u7248\u672C\u4E0D\u5339\u914D\uFF1A" + value[idKey]);
            index.set(value[idKey], value);
          }
          return index;
        }
        function resolve(index, ref, idKey, label) {
          fields(ref, [idKey, "revision"], label);
          const row = index.get(ref[idKey]);
          check(row && row.revision === ref.revision, label + "\u4E0D\u5B58\u5728\u6216\u7248\u672C\u4E0D\u5339\u914D");
          return row;
        }
        function sourceRef(sources, ref) {
          fields(ref, ["sourceId", "revision", "entryId"], "\u6765\u6E90\u5F15\u7528");
          const source = sources.get(ref.sourceId);
          check(source && source.revision === ref.revision, "\u6765\u6E90\u4E0D\u5B58\u5728\u6216\u7248\u672C\u4E0D\u5339\u914D");
          const entry = source.entries.find((row) => row.entryId === ref.entryId);
          check(entry, "\u539F\u59CB\u8BCD\u6761\u4E0D\u5B58\u5728");
          return { source, entry };
        }
        function validate(library) {
          fields(library, ["format", "schemaVersion", "stage", "sources", "senses", "activities", "applications", "courses"], "\u6750\u6599\u5E93");
          check(library.format === "vocabulary-material-library" && library.schemaVersion === 1 && library.stage === "draft", "\u53EA\u63A5\u53D7\u7B2C\u4E00\u7248\u5236\u4F5C\u8349\u7A3F\uFF0C\u4E0D\u63A5\u53D7\u53D1\u5E03\u6216\u5B66\u4E60\u8BB0\u5F55");
          const sources = rows(library.sources, "sourceId", ["sourceId", "revision", "kind", "title", "metadata", "entries"], "\u6765\u6E90");
          const senses = rows(library.senses, "senseId", ["senseId", "revision", "word", "meaning", "partOfSpeech", "definition", "sourceRefs"], "\u8BCD\u4E49");
          const activities = rows(library.activities, "itemId", ["itemId", "revision", "senseRef", "authorship", "scene", "translation", "exercise", "guidedSteps", "dictation", "sentenceAudio", "wordChoice", "chunkOrder", "readAloud", "images"], "\u6559\u5B66\u4EFB\u52A1");
          const applications = rows(library.applications, "materialId", ["materialId", "revision", "kind", "authorship", "title", "lines"], "\u5E94\u7528\u6750\u6599");
          const courses = rows(library.courses, "courseId", ["courseId", "revision", "title", "module", "audience", "levelProposal", "units"], "\u8BFE\u7A0B\u7F16\u6392");
          check(sources.size && senses.size && activities.size && courses.size, "\u6765\u6E90\u3001\u8BCD\u4E49\u3001\u6559\u5B66\u4EFB\u52A1\u548C\u8BFE\u7A0B\u4E0D\u80FD\u662F\u7A7A\u5E93");
          for (const source of sources.values()) {
            check(["original", "wordlist", "textbook"].includes(source.kind) && text(source.title), "\u6765\u6E90\u7C7B\u578B\u6216\u540D\u79F0\u65E0\u6548");
            fields(source.metadata, source.kind === "textbook" ? ["publisher", "title", "edition", "volume", "unit", "requestedPages"] : ["originNote"], "\u6765\u6E90\u4FE1\u606F");
            if (source.kind === "textbook") {
              check(["publisher", "title", "edition", "volume", "unit"].every((key) => text(source.metadata[key])) && Array.isArray(source.metadata.requestedPages) && source.metadata.requestedPages.length && source.metadata.requestedPages.every(text), "\u6559\u6750\u987B\u660E\u786E\u51FA\u7248\u793E\u3001\u4E66\u540D\u3001\u7248\u6B21\u3001\u518C\u6B21\u3001\u5355\u5143\u53CA\u8BF7\u6C42\u9875");
            } else check(text(source.metadata.originNote), "\u975E\u6559\u6750\u6765\u6E90\u9700\u8981\u6765\u6E90\u8BF4\u660E");
            check(Array.isArray(source.entries) && source.entries.length > 0 && source.entries.length <= 1e4, "\u6765\u6E90\u8BCD\u6761\u65E0\u6548");
            const ids = /* @__PURE__ */ new Set();
            for (const entry of source.entries) {
              fields(entry, ["entryId", "headword", "gloss", "rawText", "location"], "\u539F\u59CB\u8BCD\u6761");
              check(validId(entry.entryId) && !ids.has(entry.entryId) && text(entry.headword) && text(entry.gloss) && text(entry.rawText), "\u539F\u59CB\u8BCD\u6761\u7F16\u53F7\u6216\u539F\u6587\u65E0\u6548");
              ids.add(entry.entryId);
              fields(entry.location, ["unit", "textbookPage", "scanPage"], "\u6765\u6E90\u4F4D\u7F6E");
              check(text(entry.location.unit), "\u9700\u8981\u660E\u786E\u6765\u6E90\u5355\u5143\u6216\u8BCD\u8868\u5206\u7EC4");
              for (const key of ["textbookPage", "scanPage"]) if (entry.location[key] !== void 0) check(text(entry.location[key]), "\u6559\u6750\u9875\u4E0E\u626B\u63CF\u9875\u5FC5\u987B\u5206\u522B\u8BB0\u5F55");
              if (source.kind === "textbook") check(text(entry.location.textbookPage), "\u6559\u6750\u8BCD\u6761\u987B\u8BB0\u5F55\u6559\u6750\u9875\uFF0C\u4E0D\u5F97\u7528\u626B\u63CF\u9875\u4EE3\u66FF");
            }
          }
          for (const sense of senses.values()) {
            check(["word", "meaning", "partOfSpeech", "definition"].every((key) => text(sense[key])) && Array.isArray(sense.sourceRefs) && sense.sourceRefs.length > 0, "\u8BCD\u4E49\u5185\u5BB9\u6216\u6765\u6E90\u65E0\u6548");
            const seen = /* @__PURE__ */ new Set();
            for (const ref of sense.sourceRefs) {
              const { entry } = sourceRef(sources, ref), key = JSON.stringify([ref.sourceId, ref.entryId]);
              check(!seen.has(key), "\u6765\u6E90\u5F15\u7528\u91CD\u590D");
              seen.add(key);
              check(engine2.normalize(entry.headword) === engine2.normalize(sense.word), "\u8BCD\u4E49\u4E0E\u6765\u6E90\u8BCD\u5934\u4E0D\u4E00\u81F4");
            }
          }
          for (const activity of activities.values()) {
            const sense = resolve(senses, activity.senseRef, "senseId", "\u8BCD\u4E49\u5F15\u7528");
            check(activity.authorship === "original", "\u5F53\u524D\u4F8B\u53E5\uFF0F\u7EC3\u4E60\u5FC5\u987B\u6807\u4E3A\u65B0\u5199\u5185\u5BB9\uFF0C\u4E0D\u80FD\u5192\u5145\u6559\u6750\u539F\u6587");
            check(text(activity.scene) && text(activity.translation), "\u6559\u5B66\u4EFB\u52A1\u7F3A\u5C11\u573A\u666F\u6216\u7FFB\u8BD1");
            engine2.validate(activity.exercise);
            check(engine2.blanks(activity.exercise).some((blank) => blank.answers.some((answer) => engine2.normalize(answer) === engine2.normalize(sense.word))), "\u6559\u5B66\u4EFB\u52A1\u672A\u7EC3\u4E60\u6240\u5F15\u7528\u8BCD\u4E49\u7684\u8BCD\u5934");
            if (activity.guidedSteps !== void 0) contract2.validateGuidedActivity(activity, { schemaVersion: 1, revision: hash(JSON.stringify(activity.guidedSteps)), steps: activity.guidedSteps }, engine2);
            if (activity.dictation !== void 0) {
              fields(activity.dictation, ["audio", "answers"], "\u542C\u5199\u8349\u7A3F");
              contract2.validateLearning({ word: sense.word, learning: { schemaVersion: 1, wordDictation: { ...activity.dictation, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2);
            }
            if (activity.sentenceAudio !== void 0) {
              fields(activity.sentenceAudio, ["audio", "text"], "\u4F8B\u53E5\u97F3\u9891\u8349\u7A3F");
              contract2.validateLearning({ exercise: activity.exercise, learning: { schemaVersion: 1, sentenceAudio: { ...activity.sentenceAudio, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2);
            }
            if (activity.wordChoice !== void 0) {
              fields(activity.wordChoice, ["field", "options", "correctOptionId"], "\u9009\u8BCD\u8349\u7A3F");
              contract2.validateLearning({ word: sense.word, exercise: activity.exercise, learning: { schemaVersion: 1, wordChoice: { ...activity.wordChoice, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2);
            }
            if (activity.chunkOrder !== void 0) {
              fields(activity.chunkOrder, ["chunks", "correctOrder"], "\u62FC\u5757\u8349\u7A3F");
              contract2.validateLearning({ word: sense.word, exercise: activity.exercise, learning: { schemaVersion: 1, chunkOrder: { ...activity.chunkOrder, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2);
            }
            if (activity.readAloud !== void 0) {
              fields(activity.readAloud, ["target", "text", "audio"], "\u8DDF\u8BFB\u8349\u7A3F");
              contract2.validateLearning({ word: sense.word, exercise: activity.exercise, learning: { schemaVersion: 1, readAloud: { ...activity.readAloud, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2);
            }
            fields(activity.images, ["wide", "mobile"], "\u56FE\u7247");
            check(Array.isArray(activity.images.wide) && Array.isArray(activity.images.mobile), "\u56FE\u7247\u914D\u7F6E\u65E0\u6548");
            const wide = activity.images.wide, mobile = activity.images.mobile;
            check(wide.length === mobile.length && wide.length <= 1 && wide.every((url, index) => /^assets\/[A-Za-z0-9._-]+\.webp$/.test(url) && url === mobile[index]), "\u65B0\u5185\u5BB9\u53EA\u80FD\u5F15\u7528\u4E00\u4E2A\u5171\u4EAB WebP\uFF0C\u4E0D\u63A5\u53D7 AVIF \u6216\u72EC\u7ACB\u624B\u673A\u88C1\u56FE");
            check(wide.length === 0, "\u672C\u9636\u6BB5\u4EC5\u63A5\u53D7\u6587\u5B57\u8349\u7A3F\uFF1B\u4EA4\u4ED8\u56FE\u987B\u53E6\u8D70\u771F\u5B9E\u6587\u4EF6\u5927\u5C0F\u53CA\u8BED\u4E49\u6838\u9A8C\uFF0C\u4E0D\u80FD\u53EA\u51ED\u8DEF\u5F84\u63A5\u53D7");
          }
          for (const material of applications.values()) applicationModel2.validate(material, (ref) => resolve(senses, ref, "senseId", "\u5E94\u7528\u8BCD\u4E49\u5F15\u7528"));
          for (const course of courses.values()) {
            check(text(course.title) && course.module === "vocabulary" && ["beginner", "adult", "textbook", "general"].includes(course.audience) && ["A1", "A2", "B1", "B2", "C1", "C2"].includes(course.levelProposal), "\u8BFE\u7A0B\u7F16\u6392\u5C5E\u6027\u65E0\u6548");
            check(Array.isArray(course.units) && course.units.length > 0, "\u8BFE\u7A0B\u9700\u8981\u660E\u786E\u5355\u5143");
            const units = /* @__PURE__ */ new Set(), items = /* @__PURE__ */ new Set();
            for (const unit of course.units) {
              fields(unit, ["unitId", "title", "activityRefs", "materialRefs"], "\u5355\u5143");
              check(validId(unit.unitId) && !units.has(unit.unitId) && text(unit.title), "\u5355\u5143\u8EAB\u4EFD\u65E0\u6548\u6216\u91CD\u590D");
              units.add(unit.unitId);
              check(Array.isArray(unit.activityRefs) && unit.activityRefs.length > 0 && Array.isArray(unit.materialRefs), "\u5355\u5143\u5F15\u7528\u65E0\u6548");
              const unitSenses = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set();
              for (const ref of unit.activityRefs) {
                const activity = resolve(activities, ref, "itemId", "\u6559\u5B66\u4EFB\u52A1\u5F15\u7528");
                check(!items.has(activity.itemId), "\u540C\u4E00\u8BFE\u7A0B\u91CD\u590D\u7F16\u6392\u6559\u5B66\u4EFB\u52A1");
                items.add(activity.itemId);
                unitSenses.add(activity.senseRef.senseId);
              }
              for (const ref of unit.materialRefs) {
                const material = resolve(applications, ref, "materialId", "\u5E94\u7528\u6750\u6599\u5F15\u7528");
                check(!materials.has(material.materialId), "\u5355\u5143\u6750\u6599\u5F15\u7528\u91CD\u590D");
                materials.add(material.materialId);
                check(material.lines.every((line) => line.senseRefs.every((target) => unitSenses.has(target.senseId))), "\u6750\u6599\u76EE\u6807\u4E0D\u5C5E\u4E8E\u672C\u5355\u5143\uFF0C\u4E0D\u80FD\u81EA\u52A8\u4E32\u5165\u5176\u4ED6\u5185\u5BB9");
              }
            }
            const errors = draftModel2.validate(projectUnchecked(course, senses, activities), { requireImages: false });
            check(!errors.length, errors.join("\uFF1B"));
          }
          return { sources, senses, activities, applications, courses };
        }
        function projectUnchecked(course, senses, activities) {
          return { schemaVersion: 1, book: { bookId: course.courseId, title: course.title, catalog: { facets: { levels: [course.levelProposal] } }, units: course.units.map((unit) => ({ unitId: unit.unitId, title: unit.title })) }, items: course.units.flatMap((unit) => unit.activityRefs.map((ref) => {
            const activity = activities.get(ref.itemId), sense = senses.get(activity.senseRef.senseId);
            const item = { itemId: activity.itemId, unitId: unit.unitId, word: sense.word, meaning: sense.meaning, scene: activity.scene, translation: activity.translation, exercise: structuredClone(activity.exercise), images: structuredClone(activity.images) };
            if (activity.guidedSteps !== void 0) item.guidedSteps = structuredClone(activity.guidedSteps);
            if (activity.dictation !== void 0) item.dictation = structuredClone(activity.dictation);
            if (activity.sentenceAudio !== void 0) item.sentenceAudio = structuredClone(activity.sentenceAudio);
            if (activity.wordChoice !== void 0) item.wordChoice = structuredClone(activity.wordChoice);
            if (activity.chunkOrder !== void 0) item.chunkOrder = structuredClone(activity.chunkOrder);
            if (activity.readAloud !== void 0) item.readAloud = structuredClone(activity.readAloud);
            return item;
          })) };
        }
        async function previewCourse(library, courseId) {
          const indexes = validate(library), course = indexes.courses.get(courseId);
          check(course, "\u8BFE\u7A0B\u7F16\u6392\u4E0D\u5B58\u5728");
          const draft = projectUnchecked(course, indexes.senses, indexes.activities), wordbookPackage = await draftModel2.compile(draft, { requireImages: false });
          const bindings = draft.items.map((item) => {
            const activity = indexes.activities.get(item.itemId), sense = indexes.senses.get(activity.senseRef.senseId);
            return { itemId: item.itemId, activityRevision: activity.revision, senseRef: structuredClone(activity.senseRef), sourceRefs: structuredClone(sense.sourceRefs) };
          });
          return {
            format: "vocabulary-course-review-preview",
            stage: "draft",
            publishable: false,
            courseRef: { courseId, revision: course.revision },
            wordbookPackage,
            bindings,
            applications: course.units.map((unit) => ({ unitId: unit.unitId, materials: unit.materialRefs.map((ref) => structuredClone(indexes.applications.get(ref.materialId))) }))
          };
        }
        function validateTeachingPlans(library, courseId, plans) {
          const indexes = validate(library), course = indexes.courses.get(courseId);
          check(course, "\u8BFE\u7A0B\u7F16\u6392\u4E0D\u5B58\u5728");
          check(Array.isArray(plans) && plans.length > 0 && plans.length <= course.units.length + 1, "\u6559\u5B66\u8349\u7A3F\u7F16\u6392\u6570\u91CF\u65E0\u6548");
          const scopes = /* @__PURE__ */ new Set();
          for (const plan of plans) {
            fields(plan, ["unitId", "steps", "revision"], "\u6559\u5B66\u8349\u7A3F\u7F16\u6392");
            check(plan.unitId === null || course.units.some((unit) => unit.unitId === plan.unitId), "\u6559\u5B66\u7F16\u6392\u5355\u5143\u4E0D\u5B58\u5728");
            check(!scopes.has(plan.unitId), "\u6559\u5B66\u7F16\u6392\u5355\u5143\u91CD\u590D");
            scopes.add(plan.unitId);
            check(plan.revision === revisionOf(plan), "\u6559\u5B66\u7F16\u6392\u7248\u672C\u4E0D\u5339\u914D");
            check(Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.length <= 1e5, "\u6559\u5B66\u6B65\u9AA4\u6570\u91CF\u65E0\u6548");
            const allowed = new Map(course.units.filter((unit) => plan.unitId === null || unit.unitId === plan.unitId).flatMap((unit) => unit.activityRefs.map((ref) => [ref.itemId, ref.revision]))), ids = /* @__PURE__ */ new Set();
            for (const step of plan.steps) {
              fields(step, ["stepId", "itemId", "activityRevision", "stage", "presentation"], "\u6559\u5B66\u8349\u7A3F\u6B65\u9AA4");
              check(validId(step.stepId) && !ids.has(step.stepId), "\u6559\u5B66\u6B65\u9AA4\u8EAB\u4EFD\u91CD\u590D\u6216\u65E0\u6548");
              ids.add(step.stepId);
              check(allowed.get(step.itemId) === step.activityRevision, "\u6559\u5B66\u6B65\u9AA4\u4EFB\u52A1\u4E0D\u5C5E\u4E8E\u672C\u5355\u5143\u6216\u7248\u672C\u4E0D\u5339\u914D");
              check(["recognition", "phrase", "sentence"].includes(step.stage), "\u6559\u5B66\u9636\u6BB5\u65E0\u6548");
              const p = step.presentation;
              fields(p, ["title", "text", "meaning", "explanation", "audio"], "\u6559\u5B66\u5448\u73B0");
              check(["title", "text", "meaning", "explanation"].every((key) => typeof p[key] === "string" && p[key].trim() && p[key].length <= 1e3), "\u6559\u5B66\u6587\u5B57\u7F3A\u5931\u6216\u8FC7\u957F");
              const activity = indexes.activities.get(step.itemId), sense = indexes.senses.get(activity.senseRef.senseId);
              check(step.stage !== "recognition" || p.text === sense.word, "\u8BA4\u8BCD\u6587\u5B57\u4E0E\u76EE\u6807\u8BCD\u4E0D\u4E00\u81F4");
              check(step.stage !== "sentence" || p.text === engine2.sentence(activity.exercise), "\u6559\u5B66\u4F8B\u53E5\u4E0E\u4EFB\u52A1\u4E0D\u4E00\u81F4");
              fields(p.audio, ["url", "sha256", "bytes", "mimeType"], "\u6559\u5B66\u793A\u8303\u97F3\u9891");
              const extensions = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" }, audio = p.audio;
              check(extensions[audio.mimeType] && new RegExp("^assets/[A-Za-z0-9._-]+\\." + extensions[audio.mimeType] + "$").test(audio.url) && typeof audio.sha256 === "string" && /^[a-f0-9]{64}$/.test(audio.sha256) && Number.isSafeInteger(audio.bytes) && audio.bytes > 0 && audio.bytes <= 1e7, "\u6559\u5B66\u97F3\u9891\u5F15\u7528\u65E0\u6548");
            }
          }
          return structuredClone(plans);
        }
        function prepareDraft(input) {
          const source = structuredClone(input);
          fields(source, ["format", "schemaVersion", "libraryRef", "courseRef", "library", "deliveries", ...source.schemaVersion === 2 ? ["teachingPlans"] : []], "\u6750\u6599\u8BFE\u7A0B\u5236\u4F5C\u6587\u4EF6");
          check(source.format === "vocabulary-material-course-draft" && [1, 2].includes(source.schemaVersion), "\u6750\u6599\u8BFE\u7A0B\u5236\u4F5C\u683C\u5F0F\u65E0\u6548");
          fields(source.libraryRef, ["libraryId", "revision"], "\u6750\u6599\u5E93\u5F15\u7528");
          check(validId(source.libraryRef.libraryId) && source.libraryRef.revision === revisionOf(source.library), "\u6750\u6599\u5E93\u5F15\u7528\u7248\u672C\u4E0D\u5339\u914D");
          const indexes = validate(source.library), course = resolve(indexes.courses, source.courseRef, "courseId", "\u8BFE\u7A0B\u5F15\u7528"), draft = projectUnchecked(course, indexes.senses, indexes.activities);
          check(Array.isArray(source.deliveries) && source.deliveries.length === draft.items.length, "\u4EA4\u4ED8\u56FE\u4E0E\u4EFB\u52A1\u6570\u91CF\u4E0D\u4E00\u81F4");
          const deliveries = /* @__PURE__ */ new Map();
          for (const delivery of source.deliveries) {
            fields(delivery, ["itemId", "url", "bytes", "sha256"], "\u4EA4\u4ED8\u56FE");
            check(validId(delivery.itemId) && !deliveries.has(delivery.itemId) && /^assets\/[A-Za-z0-9._-]+\.webp$/.test(delivery.url) && Number.isSafeInteger(delivery.bytes) && delivery.bytes > 0 && delivery.bytes < 2e4 && typeof delivery.sha256 === "string" && /^[a-f0-9]{64}$/.test(delivery.sha256), "\u4EA4\u4ED8\u56FE\u5F15\u7528\u3001\u5927\u5C0F\u6216\u7248\u672C\u65E0\u6548");
            deliveries.set(delivery.itemId, delivery);
          }
          for (const item of draft.items) {
            const delivery = deliveries.get(item.itemId);
            check(delivery, "\u4EFB\u52A1\u7F3A\u5C11\u5BF9\u5E94\u4EA4\u4ED8\u56FE");
            item.images = { wide: [delivery.url], mobile: [delivery.url] };
          }
          const errors = draftModel2.validate(draft);
          check(!errors.length, errors.join("\uFF1B"));
          const bindings = draft.items.map((item) => {
            const activity = indexes.activities.get(item.itemId), sense = indexes.senses.get(activity.senseRef.senseId);
            return { itemId: item.itemId, activityRevision: activity.revision, senseRef: structuredClone(activity.senseRef), sourceRefs: structuredClone(sense.sourceRefs) };
          });
          const teachingPlans = source.schemaVersion === 2 ? validateTeachingPlans(source.library, course.courseId, source.teachingPlans) : null;
          return { draft, source, bindings, applications: course.units.map((unit) => ({ unitId: unit.unitId, materials: unit.materialRefs.map((ref) => structuredClone(indexes.applications.get(ref.materialId))) })), ...teachingPlans ? { teachingPlans } : {}, assetVerification: "pending", published: false };
        }
        return { revisionOf, versioned, validate, previewCourse, prepareDraft, validateTeachingPlans };
      }
      module.exports = { createModel };
    }
  });

  // landing/sentence-cloze-engine.js
  var require_sentence_cloze_engine = __commonJS({
    "landing/sentence-cloze-engine.js"(exports, module) {
      (function(root) {
        "use strict";
        function normalize(value) {
          return String(value ?? "").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").replace(/[.!?。！？]+$/, "").trim();
        }
        function blanks(exercise) {
          return exercise.parts.filter((part) => !Object.hasOwn(part, "text"));
        }
        function validate(exercise) {
          if (!exercise || exercise.version !== 1 || !Array.isArray(exercise.parts)) throw new Error("Invalid cloze exercise version or parts");
          const ids = /* @__PURE__ */ new Set();
          for (const part of exercise.parts) {
            if (!part || typeof part !== "object") throw new Error("Invalid sentence part");
            if (Object.hasOwn(part, "text")) {
              if (typeof part.text !== "string" || Object.hasOwn(part, "id")) throw new Error("Text parts cannot be blanks");
              continue;
            }
            if (typeof part.id !== "string" || !part.id || ids.has(part.id)) throw new Error("Blank IDs must be unique");
            ids.add(part.id);
            if (typeof part.label !== "string" || !part.label || !Array.isArray(part.answers) || !part.answers.length || part.answers.some((answer) => typeof answer !== "string" || !normalize(answer))) throw new Error("Blank needs a label and accepted answers");
            if (part.feedback !== void 0 && (!Array.isArray(part.feedback) || part.feedback.some((rule) => !Array.isArray(rule.values) || rule.values.some((value) => typeof value !== "string") || typeof rule.message !== "string"))) throw new Error("Invalid blank feedback");
          }
          if (!ids.size) throw new Error("Exercise must have at least one blank");
          if (exercise.annotations !== void 0 && (!Array.isArray(exercise.annotations) || exercise.annotations.length !== exercise.parts.length || exercise.annotations.some((value) => typeof value !== "string" || !value.trim()))) throw new Error("Annotations must match every sentence group");
          if (exercise.glosses !== void 0) {
            const count = exercise.parts.reduce((n, part) => n + (Object.hasOwn(part, "text") ? (part.text.match(/\S+/g) || []).length : 1), 0);
            if (!Array.isArray(exercise.glosses) || exercise.glosses.length !== count || exercise.glosses.some((gloss) => typeof gloss !== "string" || !gloss.trim())) throw new Error("Glosses must match every sentence token");
          }
          return exercise;
        }
        function evaluate(exercise, values = {}) {
          validate(exercise);
          const fields = blanks(exercise).map((part) => {
            const value = normalize(values[part.id]);
            if (!value) return { id: part.id, state: "empty", message: "\u8BF7\u8865\u4E0A\u201C" + part.label + "\u201D\u3002" };
            if (part.answers.some((answer) => normalize(answer) === value)) return { id: part.id, state: "correct", message: "" };
            const rule = (part.feedback || []).find((rule2) => rule2.values.some((answer) => normalize(answer) === value));
            return { id: part.id, state: "incorrect", message: rule ? rule.message : "\u68C0\u67E5\u201C" + part.label + "\u201D\u7684\u62FC\u5199\u6216\u5F62\u5F0F\uFF0C\u518D\u8BD5\u4E00\u6B21\u3002" };
          });
          return { correct: fields.every((field) => field.state === "correct"), fields, firstInvalid: fields.find((field) => field.state !== "correct")?.id || null };
        }
        function sentence(exercise, values) {
          return exercise.parts.map((part) => Object.hasOwn(part, "text") ? part.text : values ? String(values[part.id] ?? "") : part.answers[0]).join("");
        }
        const api = { normalize, blanks, validate, evaluate, sentence };
        root.JQKAClozeEngine = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-read-aloud.js
  var require_vocabulary_read_aloud = __commonJS({
    "js/vocabulary-read-aloud.js"(exports, module) {
      (function(root) {
        "use strict";
        const check = (ok, message) => {
          if (!ok) throw Error(message);
        };
        function validate(item, activity, engine2) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u8DDF\u8BFB\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "target", "text", "audio"].includes(key)), "\u8DDF\u8BFB\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          engine2.validate(item.exercise);
          check(typeof item.word === "string" && item.word.trim(), "\u8DDF\u8BFB\u8BCD\u5934\u65E0\u6548");
          check(["word", "sentence"].includes(activity.target), "\u8DDF\u8BFB\u9700\u8981\u660E\u786E\u5355\u8BCD\u6216\u4F8B\u53E5\u76EE\u6807");
          check(typeof activity.text === "string" && activity.text.trim() && activity.text.length <= 1e3 && activity.text === (activity.target === "word" ? item.word : engine2.sentence(item.exercise)), "\u8DDF\u8BFB\u6587\u672C\u4E0E\u76EE\u6807\u4E0D\u4E00\u81F4");
          const audio = activity.audio, formats = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav" };
          check(audio && Object.keys(audio).every((key) => ["url", "sha256", "bytes", "mimeType"].includes(key)), "\u8DDF\u8BFB\u793A\u8303\u97F3\u9891\u914D\u7F6E\u65E0\u6548");
          check(formats[audio.mimeType] && typeof audio.url === "string" && new RegExp("^assets/[A-Za-z0-9._-]+\\." + formats[audio.mimeType] + "$").test(audio.url), "\u8DDF\u8BFB\u793A\u8303\u987B\u4F7F\u7528\u56FA\u5B9A\u672C\u5730\u8BFE\u7A0B\u97F3\u9891");
          check(/^[a-f0-9]{64}$/.test(audio.sha256 || "") && Number.isSafeInteger(audio.bytes) && audio.bytes > 0 && audio.bytes <= 1e7, "\u8DDF\u8BFB\u97F3\u9891\u6458\u8981\u6216\u5927\u5C0F\u65E0\u6548");
          return activity;
        }
        function report(item, activity, value, engine2) {
          validate(item, activity, engine2);
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
        function validate(item, activity, engine2) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u62FC\u5757\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "chunks", "correctOrder"].includes(key)), "\u62FC\u5757\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          engine2.validate(item.exercise);
          check(typeof item.word === "string" && item.word.trim() && engine2.blanks(item.exercise).some((blank) => blank.answers.some((answer) => engine2.normalize(answer) === engine2.normalize(item.word))), "\u62FC\u5757\u987B\u7EC3\u4E60\u5F53\u524D\u8BCD\u4E49\u7684\u8BCD\u5934");
          check(Array.isArray(activity.chunks) && activity.chunks.length >= 2 && activity.chunks.length <= 24, "\u62FC\u5757\u9700\u89812\u81F324\u4E2A\u660E\u786E\u7F16\u5199\u7684\u8BCD\u5757");
          const chunks = /* @__PURE__ */ new Map();
          for (const chunk of activity.chunks) {
            check(chunk && Object.keys(chunk).every((key) => ["id", "text"].includes(key)) && id(chunk.id) && !chunks.has(chunk.id) && typeof chunk.text === "string" && chunk.text.trim() && chunk.text.length <= 1e3, "\u8BCD\u5757\u7F16\u53F7\u91CD\u590D\u6216\u6587\u672C\u65E0\u6548");
            chunks.set(chunk.id, chunk.text);
          }
          check(Array.isArray(activity.correctOrder) && activity.correctOrder.length === chunks.size && new Set(activity.correctOrder).size === chunks.size && Array.from(activity.correctOrder).every((key) => typeof key === "string" && chunks.has(key)), "\u62FC\u5757\u6807\u51C6\u987A\u5E8F\u987B\u5B8C\u6574\u4F7F\u7528\u6BCF\u4E2A\u7F16\u53F7\u4E00\u6B21");
          const sentence = activity.correctOrder.map((key) => chunks.get(key)).join(" ");
          check(sentence.length <= 1e3 && normalize(sentence) === normalize(engine2.sentence(item.exercise)), "\u62FC\u5757\u987A\u5E8F\u3001\u8BCD\u5757\u6216\u6807\u70B9\u6539\u53D8\u4E86\u539F\u53E5");
          return activity;
        }
        function evaluate(item, activity, values, engine2) {
          validate(item, activity, engine2);
          const chunks = new Map(activity.chunks.map((chunk) => [chunk.id, chunk.text]));
          const ids = values && typeof values === "object" && !Array.isArray(values) && Object.keys(values).length === 1 && Object.hasOwn(values, "chunkIds") ? values.chunkIds : null;
          const complete = Array.isArray(ids) && ids.length === chunks.size && new Set(ids).size === chunks.size && Array.from(ids).every((key) => typeof key === "string" && chunks.has(key));
          const correct = !!complete && normalize(ids.map((key) => chunks.get(key)).join(" ")) === normalize(engine2.sentence(item.exercise));
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
        function validate(item, activity, engine2) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision || ""), "\u9009\u8BCD\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((key) => ["schemaVersion", "revision", "field", "options", "correctOptionId"].includes(key)), "\u9009\u8BCD\u914D\u7F6E\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          engine2.validate(item.exercise);
          const blanks = engine2.blanks(item.exercise), field = blanks.find((blank) => blank.id === activity.field);
          check(blanks.length === 1 && field, "\u9009\u8BCD\u7EC3\u4E60\u987B\u660E\u786E\u7ED1\u5B9A\u552F\u4E00\u76EE\u6807\u586B\u7A7A");
          check(text(item.word) && field.answers.some((answer) => engine2.normalize(answer) === engine2.normalize(item.word)), "\u9009\u8BCD\u76EE\u6807\u987B\u5BF9\u5E94\u5F53\u524D\u8BCD\u4E49\u7684\u8BCD\u5934");
          check(Array.isArray(activity.options) && activity.options.length >= 2 && activity.options.length <= 6, "\u9009\u8BCD\u9700\u89812\u81F36\u4E2A\u660E\u786E\u7F16\u5199\u7684\u9009\u9879");
          const ids = /* @__PURE__ */ new Set(), labels = /* @__PURE__ */ new Set();
          for (const option of activity.options) {
            check(option && Object.keys(option).every((key) => ["id", "text", "feedback"].includes(key)) && id(option.id) && text(option.text) && text(option.feedback), "\u9009\u9879\u9700\u8981\u72EC\u7ACB\u7F16\u53F7\u3001\u6587\u672C\u53CA\u6559\u5B66\u89E3\u91CA");
            const normalized = engine2.normalize(option.text);
            check(normalized && !ids.has(option.id) && !labels.has(normalized), "\u9009\u8BCD\u7F16\u53F7\u6216\u5F52\u4E00\u5316\u6587\u672C\u91CD\u590D");
            ids.add(option.id);
            labels.add(normalized);
            const accepted = field.answers.some((answer) => engine2.normalize(answer) === normalized);
            check(accepted === (option.id === activity.correctOptionId), "\u9009\u8BCD\u6B63\u786E\u9879\u6216\u5E72\u6270\u9879\u4E0E\u539F\u9898\u7B54\u6848\u4E0D\u4E00\u81F4");
          }
          check(ids.has(activity.correctOptionId), "\u9009\u8BCD\u7F3A\u5C11\u6B63\u786E\u9009\u9879");
          return activity;
        }
        function evaluate(item, activity, values, engine2) {
          validate(item, activity, engine2);
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
        function validate(item, activity, engine2) {
          check(activity && activity.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(activity.revision), "\u4F8B\u53E5\u97F3\u9891\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((k) => ["schemaVersion", "revision", "text", "audio"].includes(k)), "\u4F8B\u53E5\u97F3\u9891\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          check(typeof activity.text === "string" && activity.text.length <= 4e3 && activity.text === engine2.sentence(item.exercise), "\u4F8B\u53E5\u97F3\u9891\u6587\u672C\u4E0E\u5F53\u524D\u4F8B\u53E5\u4E0D\u4E00\u81F4");
          const audio = activity.audio, formats = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav" };
          check(audio && Object.keys(audio).every((k) => ["url", "sha256", "bytes", "mimeType"].includes(k)), "\u4F8B\u53E5\u97F3\u9891\u914D\u7F6E\u65E0\u6548");
          check(formats[audio.mimeType] && typeof audio.url === "string" && new RegExp("^assets/[A-Za-z0-9._-]+\\." + formats[audio.mimeType] + "$").test(audio.url), "\u4F8B\u53E5\u97F3\u9891\u5FC5\u987B\u4F7F\u7528\u56FA\u5B9A\u672C\u5730\u7D20\u6750\u5F15\u7528");
          check(/^[a-f0-9]{64}$/.test(audio.sha256 || "") && Number.isSafeInteger(audio.bytes) && audio.bytes > 0 && audio.bytes <= 1e7, "\u4F8B\u53E5\u97F3\u9891\u6458\u8981\u6216\u5927\u5C0F\u65E0\u6548");
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
        const validId = (v) => typeof v === "string" && !["__proto__", "constructor", "prototype"].includes(v) && /^[A-Za-z0-9:._-]{1,160}$/.test(v);
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
        const dimensions = ["audiences", "schoolStages", "grades", "levels", "goals", "topics", "exams"], scalars = ["seriesId", "publisherId", "edition", "volume"];
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
            check(u && validId(u.unitId) && !seen.has(u.unitId) && text(u.title), "\u5355\u5143\u8EAB\u4EFD\u6216\u6807\u9898\u65E0\u6548");
            seen.add(u.unitId);
            check(Object.keys(u).every((k) => ["unitId", "title", "itemIds"].includes(k)), "\u5355\u5143\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
            check(Array.isArray(u.itemIds) && u.itemIds.length > 0 && u.itemIds.every(validId), "\u5355\u5143\u5F15\u7528\u65E0\u6548");
            assigned.push(...u.itemIds);
          }
          check(assigned.length === book.items.length && assigned.every((v, i) => v === book.items[i].itemId), "\u5355\u5143\u5FC5\u987B\u6309\u987A\u5E8F\u5B8C\u6574\u5206\u914D\u9879\u76EE\uFF0C\u4E0D\u5F97\u91CD\u590D\u3001\u9057\u6F0F\u6216\u8DE8\u4E66\u5F15\u7528");
          return book;
        }
        function validateGuidedActivity(item, activity, engine2) {
          check(activity && activity.schemaVersion === 1 && revision(activity.revision), "\u5F15\u5BFC\u7EC3\u4E60\u7248\u672C\u65E0\u6548");
          check(Object.keys(activity).every((k) => ["schemaVersion", "revision", "steps"].includes(k)), "\u5F15\u5BFC\u7EC3\u4E60\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
          const steps = activity.steps;
          check(Array.isArray(steps) && steps.length > 0 && steps.length <= 100, "\u5F15\u5BFC\u6B65\u9AA4\u65E0\u6548");
          engine2.validate(item.exercise);
          const fields = engine2.blanks(item.exercise), assigned = /* @__PURE__ */ new Set();
          for (const s of steps) {
            check(s && Object.keys(s).every((k) => ["prompt", "answer", "choices", "field"].includes(k)) && text(s.prompt) && text(s.answer), "\u5F15\u5BFC\u63D0\u793A\u6216\u7B54\u6848\u65E0\u6548");
            check(Array.isArray(s.choices) && s.choices.length >= 2 && s.choices.length <= 8 && s.choices.every(text), "\u5F15\u5BFC\u9009\u9879\u65E0\u6548");
            const choices = s.choices.map(engine2.normalize);
            check(new Set(choices).size === choices.length && choices.includes(engine2.normalize(s.answer)), "\u9009\u9879\u91CD\u590D\u6216\u7F3A\u5C11\u6B63\u786E\u7B54\u6848");
            if (s.field !== void 0) {
              const f = fields.find((f2) => f2.id === s.field);
              check(f && !assigned.has(s.field) && f.answers.some((a) => engine2.normalize(a) === engine2.normalize(s.answer)), "\u7B54\u6848\u5B57\u6BB5\u4E0D\u5339\u914D");
              assigned.add(s.field);
            }
          }
          check(assigned.size === fields.length, "\u5F15\u5BFC\u7EC3\u4E60\u9057\u6F0F\u539F\u9898\u5B57\u6BB5");
          check(engine2.normalize(steps.map((s) => s.answer).join(" ")) === engine2.normalize(engine2.sentence(item.exercise)), "\u5F15\u5BFC\u6B65\u9AA4\u6539\u53D8\u4E86\u539F\u53E5");
          return activity;
        }
        function validateLearning(item, engine2) {
          if (item.learning === void 0) return item;
          check(item.learning && item.learning.schemaVersion === 1, "\u6559\u5B66\u914D\u7F6E\u7248\u672C\u65E0\u6548");
          check(Object.keys(item.learning).every((k) => ["schemaVersion", "guidedExpression", "wordDictation", "sentenceAudio", "wordChoice", "chunkOrder", "readAloud"].includes(k)), "\u5305\u542B\u672A\u652F\u6301\u7684\u7EC3\u4E60\u914D\u7F6E");
          if (item.learning.readAloud !== void 0) {
            const model = root.VocabularyReadAloud || (typeof __require === "function" ? require_vocabulary_read_aloud() : null);
            check(model, "\u8DDF\u8BFB\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.readAloud, engine2);
          }
          if (item.learning.chunkOrder !== void 0) {
            const model = root.VocabularyChunkOrder || (typeof __require === "function" ? require_vocabulary_chunk_order() : null);
            check(model, "\u62FC\u5757\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.chunkOrder, engine2);
          }
          if (item.learning.wordChoice !== void 0) {
            const model = root.VocabularyWordChoice || (typeof __require === "function" ? require_vocabulary_word_choice() : null);
            check(model, "\u9009\u8BCD\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.wordChoice, engine2);
          }
          if (item.learning.sentenceAudio !== void 0) {
            const model = root.VocabularySentenceAudio || (typeof __require === "function" ? require_vocabulary_sentence_audio() : null);
            check(model, "\u4F8B\u53E5\u97F3\u9891\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            model.validate(item, item.learning.sentenceAudio, engine2);
          }
          if (item.learning.guidedExpression !== void 0) validateGuidedActivity(item, item.learning.guidedExpression, engine2);
          if (item.learning.wordDictation !== void 0) {
            const dictation = root.VocabularyWordDictation || (typeof __require === "function" ? require_vocabulary_word_dictation() : null);
            check(dictation, "\u542C\u5199\u5185\u5BB9\u6821\u9A8C\u5668\u5C1A\u672A\u52A0\u8F7D");
            dictation.validate(item, item.learning.wordDictation);
          }
          return item;
        }
        function capabilities(item, engine2) {
          validateLearning(item, engine2);
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

  // js/wordbook-draft.js
  var require_wordbook_draft = __commonJS({
    "js/wordbook-draft.js"(exports, module) {
      (function(g) {
        "use strict";
        const id = (v) => typeof v === "string" && !["__proto__", "constructor", "prototype"].includes(v) && /^[A-Za-z0-9:._-]{1,160}$/.test(v);
        const engine2 = () => g.JQKAClozeEngine || (typeof __require === "function" ? require_sentence_cloze_engine() : null);
        const contract2 = () => g.VocabularyCourseContract || (typeof __require === "function" ? require_vocabulary_course_contract() : null);
        function exercise(sentence) {
          const parts = [];
          let at = 0, n = 0;
          const regex = /\[([^\[\]]+)\]/g;
          let match;
          while (match = regex.exec(sentence)) {
            if (match.index > at) parts.push({ text: sentence.slice(at, match.index) });
            parts.push({ id: "blank" + ++n, label: match[1].trim(), answers: [match[1].trim()] });
            at = regex.lastIndex;
          }
          if (at < sentence.length) parts.push({ text: sentence.slice(at) });
          if (!n || parts.some((p) => p.text && /[\[\]]/.test(p.text))) throw Error("\u8BF7\u7528 [\u6B63\u786E\u7B54\u6848] \u660E\u786E\u6807\u51FA\u586B\u7A7A\uFF0C\u62EC\u53F7\u5FC5\u987B\u6210\u5BF9\u3002");
          return engine2().validate({ version: 1, parts });
        }
        function guidedSteps(source, exercise2) {
          if (!source.trim()) return void 0;
          const used = /* @__PURE__ */ new Set();
          return source.split(/\r?\n/).filter((x) => x.trim()).map((line, index) => {
            const [prompt, answer, ...wrong] = line.split("|").map((x) => x.trim());
            if (!prompt || !answer || wrong.length < 1 || wrong.some((x) => !x)) throw Error("\u5F15\u5BFC\u7B2C " + (index + 1) + " \u884C\u9700\u8981\uFF1A\u4E2D\u6587\u63D0\u793A | \u82F1\u6587\u7B54\u6848 | \u5E72\u6270\u9009\u9879");
            const step = { prompt, answer, choices: [answer, ...wrong] }, fields = engine2().blanks(exercise2).filter((p) => p.answers.some((a) => engine2().normalize(a) === engine2().normalize(answer)) && !used.has(p.id));
            if (fields.length > 1) throw Error("\u540C\u4E00\u7B54\u6848\u5BF9\u5E94\u591A\u4E2A\u586B\u7A7A\uFF0C\u8BF7\u901A\u8FC7\u8349\u7A3F\u6587\u4EF6\u660E\u786E\u6B65\u9AA4\u7684 field");
            if (fields.length === 1) {
              step.field = fields[0].id;
              used.add(step.field);
            }
            return step;
          });
        }
        function validate(draft, { requireImages = true } = {}) {
          const errors = [];
          if (!draft || draft.schemaVersion !== 1 || !draft.book || !Array.isArray(draft.items)) return ["\u8349\u7A3F\u683C\u5F0F\u65E0\u6548"];
          const b = draft.book, sourceUnits = Array.isArray(b.units) ? b.units : [];
          if (!id(b.bookId) || b.bookId === "pilot-six-v1") errors.push("\u8BF7\u4F7F\u7528\u72EC\u7ACB\u7684\u65B0\u5355\u8BCD\u672C\u7F16\u53F7\uFF0C\u4E0D\u80FD\u66FF\u6362\u516D\u8BCD\u793A\u8303");
          if (Object.keys(draft).some((k) => !["schemaVersion", "book", "items"].includes(k)) || Object.keys(b).some((k) => !["bookId", "title", "catalog", "units", "relatedCourseIds"].includes(k))) errors.push("\u8349\u7A3F\u5305\u542B\u672A\u652F\u6301\u5B57\u6BB5\uFF0C\u4E0D\u80FD\u9759\u9ED8\u4E22\u5F03");
          if (b.relatedCourseIds !== void 0 && (!Array.isArray(b.relatedCourseIds) || b.relatedCourseIds.length > 20 || b.relatedCourseIds.some((value) => typeof value !== "string" || !/^course:[A-Za-z0-9:._-]{1,193}$/.test(value)) || new Set(b.relatedCourseIds).size !== b.relatedCourseIds.length)) errors.push("\u5173\u8054\u8BFE\u7A0B\u7F16\u53F7\u65E0\u6548\u6216\u91CD\u590D");
          if (sourceUnits.some((u) => !u || Object.keys(u).some((k) => !["unitId", "title"].includes(k)))) errors.push("\u5355\u5143\u5B57\u6BB5\u65E0\u6548");
          if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 200) errors.push("\u8BF7\u586B\u5199\u5355\u8BCD\u672C\u540D\u79F0");
          if (!Array.isArray(b.units) || !b.units.length) errors.push("\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u660E\u786E\u7684\u5185\u5BB9\u5355\u5143");
          if (draft.items.length === 0 || draft.items.length > 1e4) errors.push("\u9879\u76EE\u6570\u91CF\u9700\u4E3A 1\u201310000");
          const ids = /* @__PURE__ */ new Set(), unitIds = new Set(sourceUnits.map((u) => u?.unitId));
          draft.items.forEach((item, index) => {
            const prefix = "\u7B2C " + (index + 1) + " \u9879\uFF1A";
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              errors.push(prefix + "\u6559\u5B66\u9879\u76EE\u683C\u5F0F\u65E0\u6548");
              return;
            }
            if (Object.keys(item).some((k) => !["itemId", "unitId", "word", "meaning", "scene", "translation", "exercise", "images", "guidedSteps", "dictation", "sentenceAudio", "wordChoice", "chunkOrder", "readAloud"].includes(k))) errors.push(prefix + "\u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF0C\u4E0D\u80FD\u9759\u9ED8\u4E22\u5F03");
            if (item.readAloud !== void 0) try {
              if (!item.readAloud || Object.keys(item.readAloud).some((k) => !["target", "text", "audio"].includes(k))) throw Error("\u8DDF\u8BFB\u8349\u7A3F\u5B57\u6BB5\u65E0\u6548");
              contract2().validateLearning({ ...item, learning: { schemaVersion: 1, readAloud: { ...item.readAloud, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2());
            } catch (error) {
              errors.push(prefix + error.message);
            }
            if (item.chunkOrder !== void 0) try {
              if (!item.chunkOrder || Object.keys(item.chunkOrder).some((k) => !["chunks", "correctOrder"].includes(k))) throw Error("\u62FC\u5757\u8349\u7A3F\u5B57\u6BB5\u65E0\u6548");
              contract2().validateLearning({ ...item, learning: { schemaVersion: 1, chunkOrder: { ...item.chunkOrder, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2());
            } catch (error) {
              errors.push(prefix + error.message);
            }
            if (item.wordChoice !== void 0) try {
              if (!item.wordChoice || Object.keys(item.wordChoice).some((k) => !["field", "options", "correctOptionId"].includes(k))) throw Error("\u9009\u8BCD\u8349\u7A3F\u5B57\u6BB5\u65E0\u6548");
              contract2().validateLearning({ ...item, learning: { schemaVersion: 1, wordChoice: { ...item.wordChoice, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2());
            } catch (error) {
              errors.push(prefix + error.message);
            }
            if (item.sentenceAudio !== void 0) try {
              if (!item.sentenceAudio || Object.keys(item.sentenceAudio).some((k) => !["audio", "text"].includes(k))) throw Error("\u4F8B\u53E5\u97F3\u9891\u8349\u7A3F\u5B57\u6BB5\u65E0\u6548");
              contract2().validateLearning({ ...item, learning: { schemaVersion: 1, sentenceAudio: { ...item.sentenceAudio, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2());
            } catch (error) {
              errors.push(prefix + error.message);
            }
            if (!id(item.itemId) || ids.has(item.itemId)) errors.push(prefix + "\u9879\u76EE\u7F16\u53F7\u65E0\u6548\u6216\u91CD\u590D");
            ids.add(item.itemId);
            if (!unitIds.has(item.unitId)) errors.push(prefix + "\u672A\u5206\u914D\u5230\u6709\u6548\u5355\u5143");
            for (const key of ["word", "meaning", "scene", "translation"]) if (typeof item[key] !== "string" || !item[key].trim() || item[key].length > 1e3) errors.push(prefix + "\u7F3A\u5C11\u6216\u8FC7\u957F\u7684 " + key);
            try {
              engine2().validate(item.exercise);
            } catch (e) {
              errors.push(prefix + e.message);
            }
            for (const profile of ["wide", "mobile"]) if (!Array.isArray(item.images?.[profile]) || requireImages && !item.images[profile].length || item.images[profile].some((url) => typeof url !== "string" || !/^assets\/[A-Za-z0-9._-]+\.(avif|webp)$/.test(url))) errors.push(prefix + "\u7F3A\u5C11\u6709\u6548 " + profile + " \u63D2\u753B\u5F15\u7528");
            if (item.guidedSteps) try {
              contract2().validateGuidedActivity(item, { schemaVersion: 1, revision: "a".repeat(64), steps: item.guidedSteps }, engine2());
            } catch (e) {
              errors.push(prefix + e.message);
            }
            if (item.dictation !== void 0) try {
              if (!item.dictation || Object.keys(item.dictation).some((key) => !["audio", "answers"].includes(key))) throw Error("\u542C\u5199\u8349\u7A3F\u5B57\u6BB5\u65E0\u6548");
              contract2().validateLearning({ ...item, learning: { schemaVersion: 1, wordDictation: { ...item.dictation, schemaVersion: 1, revision: "a".repeat(64) } } }, engine2());
            } catch (e) {
              errors.push(prefix + e.message);
            }
          });
          try {
            const units = sourceUnits.map((u) => ({ ...u, itemIds: draft.items.filter((item) => item?.unitId === u?.unitId).map((item) => item.itemId) }));
            contract2().validateBookStructure({ catalog: b.catalog, units, structureRevision: "a".repeat(64), items: units.flatMap((u) => u.itemIds.map((itemId) => ({ itemId }))) });
          } catch (e) {
            errors.push(e.message);
          }
          return errors;
        }
        async function compile(draft, { requireImages = true } = {}) {
          const errors = validate(draft, { requireImages });
          if (errors.length) throw Error(errors.join("\uFF1B"));
          const hash = async (value) => Array.from(new Uint8Array(await g.crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))).map((x) => x.toString(16).padStart(2, "0")).join("");
          const items = [], grouped = new Map(draft.book.units.map((u) => [u.unitId, []]));
          draft.items.forEach((item) => grouped.get(item.unitId).push(item));
          for (const unit of draft.book.units) for (const source of grouped.get(unit.unitId)) {
            const item = { itemId: source.itemId, word: source.word, meaning: source.meaning, scene: source.scene, example: engine2().sentence(source.exercise), translation: source.translation, exercise: source.exercise, images: source.images };
            if (source.guidedSteps) item.learning = { schemaVersion: 1, guidedExpression: { schemaVersion: 1, revision: await hash(source.guidedSteps), steps: source.guidedSteps } };
            if (source.dictation) item.learning = { ...item.learning, schemaVersion: 1, wordDictation: { schemaVersion: 1, audio: structuredClone(source.dictation.audio), answers: [...source.dictation.answers], revision: await hash({ audio: source.dictation.audio, answers: source.dictation.answers }) } };
            if (source.sentenceAudio) item.learning = { ...item.learning, schemaVersion: 1, sentenceAudio: { schemaVersion: 1, audio: structuredClone(source.sentenceAudio.audio), text: source.sentenceAudio.text, revision: await hash({ audio: source.sentenceAudio.audio, text: source.sentenceAudio.text }) } };
            if (source.wordChoice) {
              const body = { field: source.wordChoice.field, options: structuredClone(source.wordChoice.options), correctOptionId: source.wordChoice.correctOptionId };
              item.learning = { ...item.learning, schemaVersion: 1, wordChoice: { schemaVersion: 1, ...body, revision: await hash(body) } };
            }
            if (source.chunkOrder) {
              const body = { chunks: structuredClone(source.chunkOrder.chunks), correctOrder: [...source.chunkOrder.correctOrder] };
              item.learning = { ...item.learning, schemaVersion: 1, chunkOrder: { schemaVersion: 1, ...body, revision: await hash(body) } };
            }
            if (source.readAloud) {
              const body = { target: source.readAloud.target, text: source.readAloud.text, audio: structuredClone(source.readAloud.audio) };
              item.learning = { ...item.learning, schemaVersion: 1, readAloud: { schemaVersion: 1, ...body, revision: await hash(body) } };
            }
            items.push({ ...item, contentRevision: await hash(item) });
          }
          const refs = items.map(({ itemId, contentRevision }) => ({ itemId, contentRevision })), units = draft.book.units.map((u) => ({ ...u, itemIds: grouped.get(u.unitId).map((item) => item.itemId) }));
          const book = { bookId: draft.book.bookId, title: draft.book.title, revision: await hash(refs), itemCount: items.length, items: refs, units, structureRevision: await hash(units), catalog: draft.book.catalog };
          if (draft.book.relatedCourseIds !== void 0) book.relatedCourseIds = [...draft.book.relatedCourseIds];
          return { format: "wordbook-prepared-package", schemaVersion: 1, index: { schemaVersion: 1, books: [book] }, items, assetVerification: "pending", published: false };
        }
        const api = { exercise, guidedSteps, validate, compile };
        g.WordbookDraft = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // js/vocabulary-application-material.js
  var require_vocabulary_application_material = __commonJS({
    "js/vocabulary-application-material.js"(exports, module) {
      (function(root) {
        "use strict";
        const text = (value) => typeof value === "string" && !!value.trim() && value.length <= 4e3;
        const check = (ok, message) => {
          if (!ok) throw Error(message);
        };
        function fields(value, allowed, label) {
          check(value && typeof value === "object" && !Array.isArray(value), label + "\u5FC5\u987B\u4E3A\u5BF9\u8C61");
          check(Object.keys(value).every((key) => allowed.includes(key)), label + "\u5305\u542B\u672A\u77E5\u5B57\u6BB5");
        }
        function validate(material, resolveSense) {
          fields(material, ["materialId", "revision", "kind", "authorship", "title", "lines"], "\u5E94\u7528\u6750\u6599");
          check(typeof resolveSense === "function", "\u5E94\u7528\u6750\u6599\u9700\u8981\u8BCD\u4E49\u7248\u672C\u89E3\u6790\u5668");
          check(["dialogue", "reading"].includes(material.kind) && material.authorship === "original" && text(material.title) && Array.isArray(material.lines) && material.lines.length > 0 && material.lines.length <= 100, "\u5E94\u7528\u6750\u6599\u7C7B\u578B\u3001\u6765\u6E90\u6216\u5185\u5BB9\u65E0\u6548");
          for (const line of material.lines) {
            fields(line, ["speaker", "en", "zh", "senseRefs"], "\u5E94\u7528\u53E5\u5B50");
            check(text(line.en) && text(line.zh), "\u5E94\u7528\u53E5\u5B50\u9700\u8981\u53CC\u8BED\u6B63\u6587");
            if (material.kind === "dialogue") check(text(line.speaker), "\u5BF9\u8BDD\u7F3A\u5C11\u8BF4\u8BDD\u4EBA");
            else check(line.speaker === void 0, "\u77ED\u6587\u4E0D\u80FD\u6DF7\u5165\u8BF4\u8BDD\u4EBA\u5B57\u6BB5");
            check(Array.isArray(line.senseRefs), "\u5E94\u7528\u76EE\u6807\u5F15\u7528\u65E0\u6548");
            const seen = /* @__PURE__ */ new Set();
            for (const ref of line.senseRefs) {
              fields(ref, ["senseId", "revision"], "\u5E94\u7528\u8BCD\u4E49\u5F15\u7528");
              check(typeof ref.senseId === "string" && typeof ref.revision === "string" && /^[a-f0-9]{64}$/.test(ref.revision), "\u5E94\u7528\u8BCD\u4E49\u5F15\u7528\u65E0\u6548");
              const sense = resolveSense(ref);
              check(sense && sense.senseId === ref.senseId && sense.revision === ref.revision && text(sense.word), "\u5E94\u7528\u8BCD\u4E49\u5F15\u7528\u4E0D\u5B58\u5728\u6216\u7248\u672C\u4E0D\u5339\u914D");
              check(!seen.has(sense.senseId), "\u5E94\u7528\u8BCD\u4E49\u91CD\u590D");
              seen.add(sense.senseId);
              const escaped = sense.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              check(new RegExp("(^|[^A-Za-z])" + escaped + "(?=$|[^A-Za-z])", "i").test(line.en), "\u5E94\u7528\u6B63\u6587\u672A\u51FA\u73B0\u76EE\u6807\u8BCD");
            }
          }
          return material;
        }
        const api = { validate };
        root.VocabularyApplicationMaterial = api;
        if (typeof module !== "undefined") module.exports = api;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // src/vocabulary-material-library/browser.mjs
  var import_core = __toESM(require_core(), 1);
  var import_wordbook_draft = __toESM(require_wordbook_draft(), 1);
  var import_sentence_cloze_engine = __toESM(require_sentence_cloze_engine(), 1);
  var import_vocabulary_course_contract = __toESM(require_vocabulary_course_contract(), 1);
  var import_vocabulary_application_material = __toESM(require_vocabulary_application_material(), 1);
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
  }
  async function prepare(library, teachingPlans = []) {
    const snapshot = structuredClone(library), cache = /* @__PURE__ */ new Map(), strings = /* @__PURE__ */ new Set();
    if (snapshot && typeof snapshot === "object") {
      const { revision, ...body } = snapshot;
      strings.add(JSON.stringify(canonical(body)));
    }
    for (const key of ["sources", "senses", "activities", "applications", "courses"]) if (Array.isArray(snapshot?.[key])) for (const row of snapshot[key]) {
      if (row && typeof row === "object") {
        const { revision, ...body } = row;
        strings.add(JSON.stringify(canonical(body)));
        if (key === "activities" && row.guidedSteps !== void 0) strings.add(JSON.stringify(row.guidedSteps));
      }
    }
    for (const plan of Array.isArray(teachingPlans) ? teachingPlans : []) if (plan && typeof plan === "object") {
      const { revision, ...body } = plan;
      strings.add(JSON.stringify(canonical(body)));
    }
    for (const text of strings) {
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      cache.set(text, Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join(""));
    }
    const model = import_core.default.createModel({ hash: (text) => {
      if (!cache.has(text)) throw Error("\u6750\u6599\u6821\u9A8C\u5FEB\u7167\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6");
      return cache.get(text);
    }, draftModel: import_wordbook_draft.default, engine: import_sentence_cloze_engine.default, contract: import_vocabulary_course_contract.default, applicationModel: import_vocabulary_application_material.default });
    return { snapshot, model };
  }
  window.VocabularyMaterialLibrary = {
    async validate(library) {
      const { snapshot, model } = await prepare(library);
      model.validate(snapshot);
      return snapshot;
    },
    async previewCourse(library, courseId) {
      const { snapshot, model } = await prepare(library);
      return model.previewCourse(snapshot, courseId);
    },
    async prepareDraft(input) {
      const source = structuredClone(input), { snapshot, model } = await prepare(source.library, source.teachingPlans);
      source.library = snapshot;
      return model.prepareDraft(source);
    }
  };
})();
