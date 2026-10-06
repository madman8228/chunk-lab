var ChunkCourseLearningLaunchBundle = (() => {
  // src/course-authoring/draft-spec.mjs
  var LEGACY_DRAFT_SCHEMA = Object.freeze({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://chunklab.local/schema/ai-course-draft-1.0.json",
    title: "Chunk Lab AI Course Draft 1.0",
    type: "object",
    additionalProperties: false,
    required: ["format", "formatVersion", "title", "description", "targetCefr", "contentForm", "roles", "items"],
    properties: {
      format: { const: "chunklab-ai-course" },
      formatVersion: { const: "1.0" },
      title: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 1e3 },
      targetCefr: { enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
      contentForm: { enum: ["sentences", "article", "dialogue"] },
      source: { type: "object", additionalProperties: false, properties: { title: { type: "string", maxLength: 160 } } },
      roles: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["key", "name"], properties: { key: { type: "string", minLength: 1, maxLength: 40 }, name: { type: "string", minLength: 1, maxLength: 80 } } } },
      items: { type: "array", minItems: 1, maxItems: 50, items: { type: "object", additionalProperties: false, required: ["en", "zh"], properties: {
        en: { type: "string", minLength: 1, maxLength: 500 },
        zh: { type: "string", minLength: 1, maxLength: 1e3 },
        role: { type: "string", minLength: 1, maxLength: 40 },
        chunks: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", minLength: 1, maxLength: 200 } },
        distractors: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 200 } },
        acceptedAnswers: { type: "array", minItems: 1, maxItems: 10, items: { type: "string", minLength: 1, maxLength: 500 } }
      } } }
    }
  });
  var INTERACTION_RULES = Object.freeze([
    "\u5148\u4F7F\u7528\u7528\u6237\u5DF2\u7ED9\u51FA\u7684\u4FE1\u606F\uFF0C\u4E0D\u91CD\u590D\u8BE2\u95EE\uFF1B\u9700\u6C42\u4E0D\u5B8C\u6574\u65F6\u6BCF\u8F6E\u53EA\u95EE\u4E00\u4E2A\u95EE\u9898\uFF0C\u5E76\u6839\u636E\u5F53\u524D\u4E0A\u4E0B\u6587\u7ED9\u51FA 3 \u5230 5 \u4E2A\u7F16\u53F7\u5EFA\u8BAE\uFF0C\u540C\u65F6\u5141\u8BB8\u7528\u6237\u81EA\u7531\u56DE\u7B54\u6216\u6309\u9898\u610F\u591A\u9009\u3002",
    "\u4E3B\u9898\u3001\u96BE\u5EA6\u548C\u7BC7\u5E45\u6CA1\u6709\u9ED8\u8BA4\u503C\uFF1A\u4ECE\u7528\u6237\u7684\u63CF\u8FF0\u63A8\u65AD\uFF1B\u4FE1\u606F\u4E0D\u8DB3\u65F6\u518D\u9010\u9879\u8BE2\u95EE\u3002\u7528\u6237\u660E\u786E\u8BF4\u201C\u6309\u63A8\u8350\u6765\u201D\u65F6\u7ED9\u51FA\u5408\u7406\u65B9\u6848\uFF0C\u7528\u6237\u8BF4\u201C\u76F4\u63A5\u751F\u6210\u201D\u65F6\u4E0D\u518D\u8FFD\u95EE\u3002",
    "\u7F51\u7AD9\u53EF\u80FD\u9884\u5148\u7ED9\u51FA\u8BFE\u7A0B\u5F62\u5F0F\u3001\u53EF\u63A5\u53D7\u7684 CEFR \u96BE\u5EA6\u8303\u56F4\u548C\u7EC3\u4E60\u65B9\u5F0F\uFF1B\u5C06\u5176\u89C6\u4E3A\u7528\u6237\u504F\u597D\u3002\u591A\u4E2A\u96BE\u5EA6\u8868\u793A\u53EF\u63A5\u53D7\u8303\u56F4\uFF0C\u6700\u7EC8 draft \u4ECD\u9009\u62E9\u4E00\u4E2A\u6700\u5408\u9002\u7684 CEFR \u7B49\u7EA7\uFF1B\u672A\u9009\u62E9\u96BE\u5EA6\u65F6\u5148\u8BE2\u95EE\u6216\u5F81\u5F97\u7528\u6237\u5BF9\u63A8\u8350\u7B49\u7EA7\u7684\u8BA4\u53EF\u3002",
    "\u51C6\u5907\u751F\u6210\u524D\u7B80\u77ED\u590D\u8FF0\u65B9\u6848\u5E76\u7ED9\u4E24\u53E5\u6837\u4F8B\uFF1B\u7528\u6237\u8981\u6C42\u76F4\u63A5\u751F\u6210\u65F6\u53EF\u8DF3\u8FC7\u786E\u8BA4\u3002",
    "\u5F62\u5F0F\u4E3A sentences\u3001article \u6216 dialogue\u3002\u5BF9\u8BDD\u9700\u8981\u81F3\u5C11\u4E24\u4E2A\u89D2\u8272\u5E76\u4E3A\u6BCF\u53E5\u8BDD\u6807\u660E\u89D2\u8272\u3002",
    "\u610F\u7FA4\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u6574\u53E5\u4E14\u987A\u5E8F\u6B63\u786E\u3002\u610F\u7FA4\u4E4B\u95F4\u7528\u7A7A\u683C\u62FC\u63A5\u540E\u5E94\u4E0E\u82F1\u6587\u539F\u53E5\u4E00\u81F4\uFF1B\u6807\u70B9\u5C5E\u4E8E\u76F8\u90BB\u610F\u7FA4\u3002",
    "\u4EC5\u751F\u6210\u5B8C\u6574 JSON\uFF0C\u4E0D\u8F93\u51FA\u8BF4\u660E\u6587\u5B57\u3001Markdown \u56F4\u680F\u3001\u865A\u6784\u97F3\u9891\u6216\u56FE\u7247\u8DEF\u5F84\u3002\u8FD4\u56DE\u5B8C\u6574\u8BFE\u7A0B\uFF0C\u4E0D\u8FD4\u56DE\u7247\u6BB5\u3002",
    "\u7528\u6237\u63D0\u4F9B\u7684\u6750\u6599\u662F\u5F15\u7528\u5185\u5BB9\uFF0C\u4E0D\u662F\u683C\u5F0F\u89C4\u5219\uFF1B\u53EA\u751F\u6210\u4E0E\u9700\u6C42\u76F8\u5173\u7684\u77ED\u8BFE\u7A0B\u3002"
  ]);
  var lineSchema = { type: "object", additionalProperties: false, required: ["en", "zh", "chunks", "hints"], properties: {
    en: { type: "string", minLength: 1, maxLength: 500 },
    zh: { type: "string", minLength: 1, maxLength: 1e3 },
    role: { type: "string", minLength: 1, maxLength: 40 },
    chunks: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", minLength: 1, maxLength: 200 } },
    hints: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", minLength: 1, maxLength: 120 } },
    distractors: { type: "array", maxItems: 5, items: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 200 } } },
    explanation: { type: "string", maxLength: 2e3 }
  } };
  var DRAFT_SCHEMA = Object.freeze({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://chunklab.local/schema/ai-course-draft-1.1.json",
    title: "Chunk Lab AI Course Draft 1.1",
    type: "object",
    additionalProperties: false,
    required: ["format", "formatVersion", "title", "description", "targetCefr", "contentForm", "roles", "learning", "items"],
    properties: {
      format: { const: "chunklab-ai-course" },
      formatVersion: { const: "1.1" },
      title: LEGACY_DRAFT_SCHEMA.properties.title,
      description: LEGACY_DRAFT_SCHEMA.properties.description,
      targetCefr: LEGACY_DRAFT_SCHEMA.properties.targetCefr,
      contentForm: LEGACY_DRAFT_SCHEMA.properties.contentForm,
      source: LEGACY_DRAFT_SCHEMA.properties.source,
      roles: LEGACY_DRAFT_SCHEMA.properties.roles,
      learning: { type: "object", additionalProperties: false, required: ["template", "version", "modes", "defaultMode"], properties: {
        template: { const: "sentence-practice" },
        version: { const: 1 },
        modes: { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["typing", "chunkSelection"] } },
        defaultMode: { enum: ["typing", "chunkSelection"] }
      } },
      items: { type: "array", minItems: 1, maxItems: 50, items: lineSchema }
    }
  });
  var COURSE_EXAMPLES = Object.freeze([
    Object.freeze({ format: "chunklab-ai-course", formatVersion: "1.1", title: "\u9152\u5E97\u5165\u4F4F", description: "\u7EC3\u4E60\u529E\u7406\u5165\u4F4F\u65F6\u7684\u5E38\u7528\u8868\u8FBE\u3002", targetCefr: "A2", contentForm: "dialogue", roles: [{ key: "guest", name: "\u5BA2\u4EBA" }, { key: "staff", name: "\u524D\u53F0" }], learning: { template: "sentence-practice", version: 1, modes: ["typing", "chunkSelection"], defaultMode: "chunkSelection" }, items: [
      { en: "I'd like to check in.", zh: "\u6211\u60F3\u529E\u7406\u5165\u4F4F\u3002", role: "guest", chunks: ["I'd like", "to check in."], hints: ["\u6211\u60F3\u8981", "\u529E\u7406\u5165\u4F4F\u3002"] },
      { en: "May I have your name?", zh: "\u8BF7\u95EE\u60A8\u53EB\u4EC0\u4E48\u540D\u5B57\uFF1F", role: "staff", chunks: ["May I have", "your name?"], hints: ["\u8BF7\u95EE\u6211\u53EF\u4EE5\u77E5\u9053", "\u60A8\u7684\u540D\u5B57\u5417\uFF1F"] }
    ] }),
    Object.freeze({ format: "chunklab-ai-course", formatVersion: "1.1", title: "\u793C\u8C8C\u8BE2\u95EE\u65F6\u95F4", description: "\u7EC3\u4E60\u7528\u793C\u8C8C\u8868\u8FBE\u8BE2\u95EE\u5BF9\u65B9\u662F\u5426\u65B9\u4FBF\u3002", targetCefr: "A2", contentForm: "sentences", roles: [], learning: { template: "sentence-practice", version: 1, modes: ["typing", "chunkSelection"], defaultMode: "typing" }, items: [
      { en: "Could you give me a moment, please?", zh: "\u8BF7\u7A0D\u7B49\u4E00\u4E0B\u597D\u5417\uFF1F", chunks: ["Could you give me", "a moment,", "please?"], hints: ["\u4F60\u80FD\u7ED9\u6211", "\u4E00\u70B9\u65F6\u95F4\uFF0C", "\u597D\u5417\uFF1F"], distractors: [["Could your give me"], [], []] }
    ] })
  ]);
  var DRAFT_SPEC = Object.freeze({ format: "chunklab-ai-course", formatVersion: "1.1", schema: DRAFT_SCHEMA, interactionRules: INTERACTION_RULES, examples: COURSE_EXAMPLES });

  // src/course-authoring/capabilities.mjs
  var modes = Object.freeze([
    Object.freeze({ id: "typing", label: "\u8F93\u5165", description: "\u770B\u4E2D\u6587\u63D0\u793A\uFF0C\u8F93\u5165\u82F1\u6587\u3002", requiredData: ["text"], simpleDraftSupported: true }),
    Object.freeze({ id: "chunkSelection", label: "\u610F\u7FA4\u9009\u62E9", description: "\u6309\u987A\u5E8F\u8FD8\u539F\u82F1\u6587\u8868\u8FBE\u5757\u3002", requiredData: ["text", "chunks"], simpleDraftSupported: true }),
    Object.freeze({ id: "shadowing", label: "\u8DDF\u8BFB", description: "\u64AD\u653E\u771F\u5B9E\u82F1\u8BED\u97F3\u9891\u5E76\u8DDF\u8BFB\u3002", requiredData: ["text", "audio"], simpleDraftSupported: false, unavailableReason: "\u9700\u8981\u4E3A\u8BFE\u7A0B\u63D0\u4F9B\u771F\u5B9E\u97F3\u9891\u3002" }),
    Object.freeze({ id: "roleplay", label: "\u89D2\u8272\u7EC3\u4E60", description: "\u6309\u5BF9\u8BDD\u89D2\u8272\u9010\u53E5\u7EC3\u4E60\u5E76\u81EA\u6211\u786E\u8BA4\u3002", requiredData: ["dialogue", "roles"], simpleDraftSupported: true }),
    Object.freeze({ id: "dictation", label: "\u542C\u5199", description: "\u542C\u771F\u5B9E\u97F3\u9891\u540E\u8F93\u5165\u82F1\u6587\u3002", requiredData: ["text", "audio"], simpleDraftSupported: false, unavailableReason: "\u9700\u8981\u4E3A\u8BFE\u7A0B\u63D0\u4F9B\u771F\u5B9E\u97F3\u9891\u3002" })
  ]);
  var CourseCapabilityCatalog = class {
    static describeCreationOptions() {
      return modes.map((mode) => ({ ...mode, requiredData: mode.requiredData.slice() }));
    }
    static resolveRuntimeModes(course) {
      const caps = course && course.capabilities || {};
      const roles = course && course.roles || [];
      const lines = course && course.utterances || [];
      const hasRoleplay = roles.length >= 2 && lines.every((line) => line.roleId && roles.some((role) => role.id === line.roleId));
      return modes.map((mode) => {
        let enabled = mode.id === "roleplay" ? !!caps.roleplay && hasRoleplay : mode.id === "dictation" ? !!caps.audio && !!caps.text : mode.id === "shadowing" ? !!caps.audio : mode.id === "chunkSelection" ? !!caps.chunkSelection && lines.length > 0 && lines.every((line) => line.chunks) : !!caps.text;
        return {
          ...mode,
          requiredData: mode.requiredData.slice(),
          enabled,
          reason: enabled ? "" : (
            /** @type {{unavailableReason?:string}} */
            mode.unavailableReason || (mode.id === "roleplay" ? "\u9700\u8981\u5305\u542B\u81F3\u5C11\u4E24\u4E2A\u6709\u6548\u89D2\u8272\u7684\u5BF9\u8BDD\u3002" : mode.id === "chunkSelection" ? "\u8BFE\u7A0B\u9700\u8981\u4E3A\u6BCF\u53E5\u8BDD\u63D0\u4F9B\u5B8C\u6574\u610F\u7FA4\u3002" : "\u8BFE\u7A0B\u5C1A\u672A\u63D0\u4F9B\u8FD9\u79CD\u7EC3\u4E60\u6240\u9700\u7684\u5185\u5BB9\u3002")
          )
        };
      });
    }
    static fromDraft(draft) {
      const lines = Array.isArray(draft.items) ? draft.items : [];
      const hasChunks = lines.length > 0 && lines.every((item) => Array.isArray(item.chunks) && item.chunks.length > 0);
      const hasRoles = draft.contentForm === "dialogue" && Array.isArray(draft.roles) && draft.roles.length >= 2 && lines.every((item) => item.role);
      return {
        text: lines.length > 0 && lines.every((item) => !!item.en),
        audio: false,
        translation: lines.length > 0 && lines.every((item) => !!item.zh),
        chunkSelection: hasChunks,
        roleplay: hasRoles
      };
    }
  };

  // src/course-authoring/learning-contract.mjs
  var SENTENCE_TEMPLATE = Object.freeze({
    id: "sentence-practice",
    version: 1,
    modes: Object.freeze(["typing", "chunkSelection"]),
    ordering: Object.freeze(["sentences:adaptive", "article:source", "dialogue:source"])
  });
  function inspectLearning(draft, preferences = null) {
    const issues = [];
    const learning = draft && draft.learning;
    const modes2 = learning && Array.isArray(learning.modes) ? learning.modes : [];
    const available = new Set(SENTENCE_TEMPLATE.modes);
    const capabilities = CourseCapabilityCatalog.fromDraft(draft || {});
    const usable = new Set(modes2.filter((mode) => available.has(mode) && (mode === "typing" ? capabilities.text : capabilities.chunkSelection)));
    if (!learning || learning.template !== SENTENCE_TEMPLATE.id || learning.version !== SENTENCE_TEMPLATE.version) {
      issues.push({ code: "UNKNOWN_TEMPLATE", path: "learning.template", severity: "error", message: "\u8FD9\u4E2A\u5B66\u4E60\u6A21\u677F\u6682\u4E0D\u652F\u6301\u3002", suggestion: "\u8BA9 AI \u4F7F\u7528 sentence-practice \u6A21\u677F\u91CD\u65B0\u751F\u6210\u8BFE\u7A0B\u3002" });
    }
    if (!modes2.length) issues.push({ code: "NO_LEARNING_MODE", path: "learning.modes", severity: "error", message: "\u8BFE\u7A0B\u6CA1\u6709\u58F0\u660E\u53EF\u7528\u7684\u7EC3\u4E60\u65B9\u5F0F\u3002", suggestion: "\u81F3\u5C11\u9009\u62E9\u8F93\u5165\u6216\u610F\u7FA4\u9009\u62E9\uFF0C\u5E76\u63D0\u4F9B\u5BF9\u5E94\u5185\u5BB9\u3002" });
    modes2.forEach((mode, index) => {
      if (!available.has(mode)) issues.push({ code: "UNSUPPORTED_MODE", path: `learning.modes[${index}]`, severity: "error", message: `\u5F53\u524D\u5B66\u4E60\u6A21\u677F\u4E0D\u652F\u6301\u201C${mode}\u201D\u3002`, suggestion: "\u8BF7\u9009\u62E9\u8F93\u5165\u6216\u610F\u7FA4\u9009\u62E9\u3002" });
      else if (mode === "chunkSelection" && !capabilities.chunkSelection) issues.push({ code: "MODE_DATA_MISSING", path: "learning.modes", severity: "error", message: "\u8BFE\u7A0B\u58F0\u660E\u4E86\u610F\u7FA4\u9009\u62E9\uFF0C\u4F46\u5E76\u975E\u6BCF\u53E5\u8BDD\u90FD\u63D0\u4F9B\u5B8C\u6574\u610F\u7FA4\u3002", suggestion: "\u8865\u9F50\u6BCF\u53E5\u8BDD\u7684\u610F\u7FA4\uFF0C\u6216\u79FB\u9664\u8BE5\u7EC3\u4E60\u65B9\u5F0F\u3002" });
      else if (mode === "typing" && !capabilities.text) issues.push({ code: "MODE_DATA_MISSING", path: "learning.modes", severity: "error", message: "\u8BFE\u7A0B\u58F0\u660E\u4E86\u8F93\u5165\u7EC3\u4E60\uFF0C\u4F46\u7F3A\u5C11\u82F1\u6587\u5185\u5BB9\u3002", suggestion: "\u8865\u9F50\u82F1\u6587\u53E5\u5B50\u3002" });
    });
    if (!usable.has(learning && learning.defaultMode)) issues.push({ code: "INVALID_DEFAULT_MODE", path: "learning.defaultMode", severity: "error", message: "\u9ED8\u8BA4\u7EC3\u4E60\u65B9\u5F0F\u5FC5\u987B\u662F\u672C\u8BFE\u7A0B\u5B9E\u9645\u652F\u6301\u7684\u65B9\u5F0F\u3002", suggestion: "\u5C06\u9ED8\u8BA4\u65B9\u5F0F\u6539\u4E3A learning.modes \u4E2D\u53EF\u7528\u7684\u4E00\u9879\u3002" });
    if (preferences && Array.isArray(preferences.exerciseModes)) {
      const chosen = [...new Set(preferences.exerciseModes.filter((mode) => available.has(mode)))].sort();
      const returned = [...usable].sort();
      if (JSON.stringify(chosen) !== JSON.stringify(returned)) issues.push({ code: "PREFERENCE_MISMATCH", path: "learning.modes", severity: "warning", message: "AI \u8FD4\u56DE\u7684\u7EC3\u4E60\u65B9\u5F0F\u4E0E\u5236\u4F5C\u65F6\u9009\u62E9\u7684\u65B9\u5F0F\u4E0D\u540C\u3002", suggestion: "\u68C0\u67E5\u9884\u89C8\u540E\u786E\u8BA4\u4F7F\u7528 AI \u8FD4\u56DE\u7684\u65B9\u5F0F\uFF0C\u6216\u590D\u5236\u4FEE\u590D\u6307\u4EE4\u8BA9 AI \u6309\u539F\u9009\u62E9\u4FEE\u6539\u3002" });
    }
    return { issues, supportedModes: SENTENCE_TEMPLATE.modes.map((id) => ({ id, enabled: usable.has(id), default: learning && learning.defaultMode === id })) };
  }

  // src/course-authoring/course-types.mjs
  var COURSE_TYPES = Object.freeze([
    Object.freeze({ id: "sentence", label: "\u53E5\u5B50\u8BFE\u7A0B", description: "\u901A\u8FC7\u4E2D\u6587\u63D0\u793A\u7EC3\u4E60\u82F1\u6587\u53E5\u5B50\u3002", format: "chunklab-ai-course", version: "1.1" }),
    Object.freeze({ id: "imageText", label: "\u56FE\u6587\u8BFE\u7A0B", description: "AI \u751F\u6210\u8BFE\u7A0B\u5185\u5BB9\uFF0C\u4F60\u4E0A\u4F20\u914D\u5957\u56FE\u7247\u3002", format: "chunklab-ai-image-text", version: "1.0" })
  ]);
  var CourseTypeCatalog = class {
    static list() {
      return COURSE_TYPES.map((item) => ({ ...item }));
    }
    static get(id) {
      return COURSE_TYPES.find((item) => item.id === id) || COURSE_TYPES[0];
    }
    static detect(draft) {
      if (draft && draft.format === "chunklab-ai-image-text" && draft.formatVersion === "1.0") return "imageText";
      if (draft && draft.format === "chunklab-ai-course" && ["1.0", "1.1"].includes(draft.formatVersion)) return "sentence";
      return null;
    }
  };

  // src/course-authoring/preferences.mjs
  var simpleExerciseIds = Object.freeze(SENTENCE_TEMPLATE.modes.slice());
  var CourseCreationPreferences = class {
    static describeOptions() {
      return {
        forms: CourseTypeCatalog.list(),
        levels: DRAFT_SCHEMA.properties.targetCefr.enum.slice(),
        exercises: CourseCapabilityCatalog.describeCreationOptions().filter((mode) => simpleExerciseIds.includes(mode.id)).map((mode) => ({ ...mode, selectable: true }))
      };
    }
    static defaults() {
      return Object.freeze({ courseType: "sentence", contentForm: "sentences", targetCefrs: Object.freeze([]), exerciseModes: Object.freeze(["typing", "chunkSelection"]) });
    }
    static normalize(value = {}) {
      const defaults = this.defaults();
      const options = this.describeOptions();
      const courseType = options.forms.some((item) => item.id === value.courseType) ? value.courseType : value.contentForm === "imageText" ? "imageText" : "sentence";
      const contentForm = courseType === "sentence" ? "sentences" : "sentences";
      const legacyLevels = options.levels.includes(value.targetCefr) ? [value.targetCefr] : defaults.targetCefrs;
      const targetCefrs = [...new Set((Array.isArray(value.targetCefrs) ? value.targetCefrs : legacyLevels).filter((level) => options.levels.includes(level)))];
      const exerciseModes = [...new Set(Array.isArray(value.exerciseModes) ? value.exerciseModes.filter((id) => simpleExerciseIds.includes(id)) : defaults.exerciseModes)];
      if (exerciseModes.length === 0) exerciseModes.push("typing");
      return Object.freeze({ courseType, contentForm, targetCefrs: Object.freeze(targetCefrs), exerciseModes: Object.freeze(exerciseModes) });
    }
  };

  // src/course-authoring/legacy-conversion.mjs
  function markerList(course) {
    return course && course.authorNotes && course.authorNotes.chunklabAuthoring || [];
  }
  function roleName(course, roleId) {
    const role = (course.roles || []).find((item) => item.id === roleId);
    return role && role.name || roleId;
  }
  function inspectLegacyAiCourse(course, { chunkShape, preferences = {} } = {}) {
    const markers = markerList(course);
    const recognized = !!(course && course.schemaVersion === "2.0" && markers.includes("format=chunklab-ai-course") && markers.includes("formatVersion=1.0"));
    const blockers = [], warnings = [];
    if (!recognized) blockers.push({ code: "UNRECOGNIZED_SOURCE", message: "\u65E0\u6CD5\u786E\u8BA4\u8FD9\u662F\u7531\u672C\u5E73\u53F0 AI \u5236\u4F5C\u6D41\u7A0B\u751F\u6210\u7684\u65E7\u8BFE\u7A0B\u3002" });
    if (!course || typeof course.courseId !== "string" || !course.courseId.trim()) blockers.push({ code: "MISSING_COURSE_ID", path: "courseId", message: "\u8BFE\u7A0B\u7F16\u53F7\u7F3A\u5931\uFF0C\u65E0\u6CD5\u5EFA\u7ACB\u7A33\u5B9A\u7684\u5B66\u4E60\u8BB0\u5F55\u3002" });
    if (!course || !course.metadata || !course.metadata.title || typeof course.metadata.title["zh-CN"] !== "string" || !course.metadata.title["zh-CN"].trim()) blockers.push({ code: "MISSING_TITLE", path: "metadata.title.zh-CN", message: "\u8BFE\u7A0B\u7F3A\u5C11\u4E2D\u6587\u6807\u9898\u3002" });
    if (!course || !Array.isArray(course.roles)) blockers.push({ code: "INVALID_ROLES", path: "roles", message: "\u8BFE\u7A0B\u89D2\u8272\u4FE1\u606F\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B\u3002" });
    const utterances = course && Array.isArray(course.utterances) ? course.utterances : [];
    const byId = /* @__PURE__ */ new Map();
    utterances.forEach((item, index) => {
      if (!item || typeof item.id !== "string" || !item.id.trim()) blockers.push({ code: "INVALID_UTTERANCE_ID", path: `utterances[${index}].id`, message: `\u7B2C ${index + 1} \u6761\u5185\u5BB9\u7F3A\u5C11\u6709\u6548\u7F16\u53F7\u3002` });
      else if (byId.has(item.id)) blockers.push({ code: "DUPLICATE_UTTERANCE_ID", path: `utterances[${index}].id`, message: `\u5185\u5BB9\u7F16\u53F7\u201C${item.id}\u201D\u91CD\u590D\u3002` });
      else byId.set(item.id, item);
    });
    const sequence = course && Array.isArray(course.sequence) ? course.sequence : [];
    if (new Set(sequence).size !== sequence.length) blockers.push({ code: "DUPLICATE_SEQUENCE_ID", path: "sequence", message: "\u8BFE\u7A0B\u987A\u5E8F\u4E2D\u6709\u91CD\u590D\u5185\u5BB9\uFF0C\u65E0\u6CD5\u5B89\u5168\u4FDD\u7559\u987A\u5E8F\u3002" });
    const lines = sequence.map((id, index) => {
      const item = byId.get(id);
      if (!item) {
        blockers.push({ code: "MISSING_UTTERANCE", index, message: `\u8BFE\u7A0B\u987A\u5E8F\u4E2D\u7684\u7B2C ${index + 1} \u6761\u5185\u5BB9\u4E0D\u5B58\u5728\u3002` });
        return null;
      }
      const sourceChunks = item.chunks;
      const chunkItems = sourceChunks && Array.isArray(sourceChunks.items) ? sourceChunks.items : [];
      const chunkById = /* @__PURE__ */ new Map();
      chunkItems.forEach((chunk, chunkIndex) => {
        if (!chunk || typeof chunk.id !== "string" || !chunk.id.trim() || chunkById.has(chunk.id)) blockers.push({ code: "INVALID_CHUNK_ID", path: `utterances[${index}].chunks.items[${chunkIndex}].id`, message: `\u7B2C ${index + 1} \u6761\u610F\u7FA4\u7F16\u53F7\u7F3A\u5931\u6216\u91CD\u590D\u3002` });
        else chunkById.set(chunk.id, chunk);
      });
      const order = sourceChunks && Array.isArray(sourceChunks.correctOrder) ? sourceChunks.correctOrder : null;
      const chunks = order && order.map((chunkId) => chunkById.get(chunkId)).filter(Boolean).map((chunk) => String(chunk.text || "").trim());
      if (order && (chunks.length !== order.length || new Set(order).size !== order.length || order.length !== chunkItems.length)) blockers.push({ code: "INVALID_CHUNK_ORDER", path: `utterances[${index}].chunks.correctOrder`, message: `\u7B2C ${index + 1} \u6761\u610F\u7FA4\u987A\u5E8F\u6709\u7F3A\u5931\u3001\u91CD\u590D\u6216\u672A\u4F7F\u7528\u7684\u7247\u6BB5\u3002` });
      if (!item.text || !item.text.en || !item.text["zh-CN"]) blockers.push({ code: "MISSING_TRANSLATION", index, message: `\u7B2C ${index + 1} \u6761\u7F3A\u5C11\u82F1\u6587\u6216\u4E2D\u6587\u5185\u5BB9\u3002` });
      if (!chunks || !chunks.length) blockers.push({ code: "MISSING_CHUNKS", path: `utterances[${index}].chunks`, index, message: `\u7B2C ${index + 1} \u6761\u6CA1\u6709\u53EF\u590D\u7528\u7684\u5B8C\u6574\u610F\u7FA4\u3002` });
      else {
        if (chunkShape && !chunkShape.chunkCountOk(item.text.en, chunks)) blockers.push({ code: "CHUNK_SHAPE_UNSUPPORTED", path: `utterances[${index}].chunks`, index, message: `\u7B2C ${index + 1} \u6761\u7684\u610F\u7FA4\u6570\u91CF\u4E0D\u7B26\u5408\u73B0\u6709\u7EC3\u4E60\u8981\u6C42\u3002` });
        if (String(chunks.join(" ")).replace(/[\t\n\f\r ]+/g, " ").trim() !== String(item.text && item.text.en || "").replace(/[\t\n\f\r ]+/g, " ").trim()) blockers.push({ code: "CHUNK_TEXT_MISMATCH", path: `utterances[${index}].chunks`, index, message: `\u7B2C ${index + 1} \u6761\u610F\u7FA4\u62FC\u63A5\u540E\u4E0E\u82F1\u6587\u539F\u53E5\u4E0D\u4E00\u81F4\u3002` });
      }
      const accepted = item.acceptedAnswers && item.acceptedAnswers.en || [];
      if (accepted.some((answer) => String(answer).trim().toLocaleLowerCase("en") !== String(item.text && item.text.en || "").trim().toLocaleLowerCase("en"))) blockers.push({ code: "ALTERNATE_ANSWER_UNSUPPORTED", index, message: `\u7B2C ${index + 1} \u6761\u542B\u6709\u539F\u751F\u7EC3\u4E60\u65E0\u6CD5\u5B89\u5168\u9A8C\u8BC1\u7684\u66FF\u4EE3\u7B54\u6848\u3002` });
      if (item.chunks && Array.isArray(item.chunks.distractors) && item.chunks.distractors.length) warnings.push({ code: "DISTRACTORS_NOT_MAPPED", path: `utterances[${index}].chunks.distractors`, index, message: `\u7B2C ${index + 1} \u6761\u7684\u65E7\u7248\u5E72\u6270\u9879\u6CA1\u6709\u610F\u7FA4\u4F4D\u7F6E\u6807\u8BB0\uFF0C\u8F6C\u6362\u540E\u4E0D\u6CBF\u7528\u3002` });
      if (item.chunks && !Array.isArray(item.chunks.distractors)) blockers.push({ code: "INVALID_DISTRACTORS", path: `utterances[${index}].chunks.distractors`, index, message: `\u7B2C ${index + 1} \u6761\u7684\u5E72\u6270\u9879\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B\u3002` });
      if (item.roleId && !(Array.isArray(course.roles) ? course.roles : []).some((role) => role && role.id === item.roleId)) blockers.push({ code: "UNKNOWN_ROLE", index, message: `\u7B2C ${index + 1} \u6761\u5F15\u7528\u4E86\u672A\u77E5\u89D2\u8272\u3002` });
      if (item.imageAssetId || item.audioAssetId) blockers.push({ code: "MEDIA_NOT_MAPPED", path: `utterances[${index}]`, index, message: `\u7B2C ${index + 1} \u6761\u5305\u542B\u56FE\u7247\u6216\u97F3\u9891\uFF0C\u539F\u751F\u53E5\u5B50\u7EC3\u4E60\u6682\u65F6\u65E0\u6CD5\u4FDD\u7559\u8FD9\u4E9B\u7D20\u6750\u3002` });
      if (!item.chunks || !Array.isArray(item.chunks.hints) || item.chunks.hints.length !== (chunks || []).length) warnings.push({ code: "HINTS_GENERATED", path: `utterances[${index}].chunks.hints`, index, message: `\u7B2C ${index + 1} \u6761\u6CA1\u6709\u5B8C\u6574\u7684\u4E2D\u6587\u610F\u7FA4\u63D0\u793A\uFF0C\u9002\u914D\u65F6\u4F1A\u6682\u7528\u8BCD\u6570\u63D0\u793A\u3002` });
      return { item, chunks, sourceId: id };
    });
    if (!sequence.length) blockers.push({ code: "EMPTY_COURSE", path: "sequence", message: "\u8BFE\u7A0B\u6CA1\u6709\u53EF\u8F6C\u6362\u7684\u5185\u5BB9\u3002" });
    if (sequence.some((id) => !byId.has(id))) {
    }
    const unsupportedCapabilities = course && course.capabilities || {};
    if (unsupportedCapabilities.roleplay) blockers.push({ code: "ROLEPLAY_NOT_MAPPED", path: "capabilities.roleplay", message: "\u8BFE\u7A0B\u5305\u542B\u89D2\u8272\u626E\u6F14\u80FD\u529B\uFF0C\u5F53\u524D\u53E5\u5B50\u7EC3\u4E60\u65E0\u6CD5\u590D\u73B0\u8BE5\u4E92\u52A8\u3002" });
    if (unsupportedCapabilities.typing === false || unsupportedCapabilities.chunkSelection === false) blockers.push({ code: "MODE_NOT_SUPPORTED", path: "capabilities", message: "\u8BFE\u7A0B\u58F0\u660E\u7684\u7EC3\u4E60\u65B9\u5F0F\u4E0E\u5F53\u524D\u53E5\u5B50\u7EC3\u4E60\u4E0D\u4E00\u81F4\u3002" });
    if (unsupportedCapabilities.audio || unsupportedCapabilities.image) blockers.push({ code: "MEDIA_NOT_MAPPED", path: "capabilities", message: "\u8BFE\u7A0B\u58F0\u660E\u4E86\u56FE\u7247\u6216\u97F3\u9891\u5B66\u4E60\u5185\u5BB9\uFF0C\u5F53\u524D\u53E5\u5B50\u7EC3\u4E60\u6682\u65F6\u65E0\u6CD5\u4FDD\u7559\u3002" });
    const normalized = CourseCreationPreferences.normalize(preferences);
    const defaultMode = normalized.exerciseModes.includes("chunkSelection") ? "chunkSelection" : "typing";
    const valid = recognized && blockers.length === 0;
    return {
      recognized,
      valid,
      kind: !recognized ? "not-applicable" : !valid ? "blocked" : warnings.length ? "confirmation-required" : "native-ready",
      blockers,
      warnings,
      history: { seen: course && course.progress && course.progress.seen || null, passed: course && course.progress && course.progress.passed || null, currentNodeId: course && course.progress && course.progress.currentNodeId || null, importedAsNativeStats: false },
      plan: recognized && blockers.length === 0 ? { deckId: course.courseId, catalogCourseId: `package:${course.courseId}`, legacySource: { courseId: course.courseId, version: course.version || "1.0.0" }, lineIds: lines.map((line) => line.sourceId), defaultMode } : null
    };
  }
  function convertLegacyAiCourse(course, { chunkShape, preferences = {}, validator = null } = {}) {
    const report = inspectLegacyAiCourse(course, { chunkShape, preferences });
    if (!report.valid) return { report, draft: null };
    const form = markerList(course).find((item) => item.startsWith("contentForm="))?.slice("contentForm=".length);
    const contentForm = ["sentences", "article", "dialogue"].includes(form) ? form : "sentences";
    const roles = (Array.isArray(course.roles) ? course.roles : []).map((role) => ({ key: role.id, name: roleName(course, role.id) }));
    const lines = course.sequence.map((id) => {
      const item = course.utterances.find((row) => row.id === id);
      const chunks = item.chunks.correctOrder.map((chunkId) => item.chunks.items.find((chunk) => chunk.id === chunkId).text.trim());
      const hints = item.chunks.hints;
      return {
        en: item.text.en,
        zh: item.text["zh-CN"],
        ...item.roleId ? { role: item.roleId } : {},
        chunks,
        hints: Array.isArray(hints) && hints.length === chunks.length ? hints.slice() : chunks.map((chunk) => `${chunk.split(/\s+/).filter(Boolean).length} \u8BCD`)
      };
    });
    const selected = CourseCreationPreferences.normalize(preferences);
    const modes2 = selected.exerciseModes.length ? selected.exerciseModes : ["typing"];
    const draft = { format: "chunklab-ai-course", formatVersion: "1.1", title: course.metadata.title["zh-CN"], description: course.metadata.description["zh-CN"] || "", targetCefr: course.metadata.targetCefr || "A2", contentForm, roles, learning: { template: "sentence-practice", version: 1, modes: modes2, defaultMode: report.plan.defaultMode }, items: lines };
    if (validator) {
      const validation = validator.validate(draft);
      const validationErrors = (validation.issues || []).filter((item) => item.severity === "error");
      if (!validation.valid || validationErrors.length) {
        report.valid = false;
        report.kind = "blocked";
        report.blockers.push(...validationErrors.map((item) => ({ code: item.code, path: item.path, message: item.message })));
        report.plan = null;
        return { report, draft: null };
      }
    }
    return { report, draft };
  }

  // src/course-authoring/draft-validator.mjs
  function pathFor(instancePath) {
    return String(instancePath || "").replace(/\/(\d+)/g, "[$1]").replace(/\//g, ".").replace(/^\./, "") || "\u8BFE\u7A0B";
  }
  function normalizeDraftText(value) {
    return String(value == null ? "" : value).replace(/[\t\n\f\r ]+/g, " ").trim();
  }
  function issue(code, path, message, suggestion, severity = "error") {
    return { code, path, severity, message, suggestion };
  }
  function schemaIssue(raw) {
    let instancePath = "", message = "";
    if (raw && typeof raw === "object") {
      instancePath = raw.instancePath || raw.path || "";
      message = raw.message || "\u5B57\u6BB5\u4E0D\u7B26\u5408\u8BFE\u7A0B\u683C\u5F0F\u3002";
    } else {
      const text = String(raw || "");
      const match = text.match(/^(\S*)\s+(.*)$/);
      if (match) {
        instancePath = match[1];
        message = match[2];
      } else message = text;
    }
    const required = message.match(/required property ["']([^"']+)["']/i);
    if (required) instancePath += `/${required[1]}`;
    const localized = /required property/i.test(message) ? "\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5\u3002" : /additional propert/i.test(message) ? "\u5305\u542B\u8BFE\u7A0B\u683C\u5F0F\u672A\u5B9A\u4E49\u7684\u5B57\u6BB5\u3002" : /must be string/i.test(message) ? "\u5E94\u586B\u5199\u6587\u5B57\u5185\u5BB9\u3002" : /must be array/i.test(message) ? "\u5E94\u4F7F\u7528\u5217\u8868\u683C\u5F0F\u3002" : /must be equal to|must be one of|must match/i.test(message) ? "\u53D6\u503C\u4E0D\u7B26\u5408\u8BFE\u7A0B\u683C\u5F0F\u8981\u6C42\u3002" : "\u8BFE\u7A0B\u5B57\u6BB5\u683C\u5F0F\u4E0D\u7B26\u5408\u8981\u6C42\u3002";
    return issue("SCHEMA_INVALID", pathFor(instancePath), localized, required ? `\u8865\u4E0A\u201C${required[1]}\u201D\u5B57\u6BB5\u3002` : "\u6839\u636E\u8BFE\u7A0B\u89C4\u8303\u8C03\u6574\u8FD9\u4E2A\u5B57\u6BB5\u540E\uFF0C\u518D\u5BFC\u5165\u5B8C\u6574\u8BFE\u7A0B\u3002");
  }
  var AiDraftValidator = class {
    constructor({ schemaValidator, chunkShape = null }) {
      if (!schemaValidator || typeof schemaValidator.validate !== "function") throw new Error("AiDraftValidator \u9700\u8981\u6CE8\u5165 SchemaValidator");
      this.schemaValidator = schemaValidator;
      this.chunkShape = chunkShape;
    }
    validate(draft, preferences = null) {
      const issues = [];
      const sourceVersion = draft && draft.formatVersion;
      const legacy = sourceVersion === "1.0";
      if (!legacy && sourceVersion !== "1.1") issues.push(issue("UNSUPPORTED_VERSION", "formatVersion", "\u7F51\u7AD9\u6682\u4E0D\u652F\u6301\u8FD9\u4E2A\u8BFE\u7A0B\u683C\u5F0F\u7248\u672C\u3002", "\u8BF7\u4F7F\u7528 Chunk Lab AI Course Draft 1.1 \u89C4\u8303\u91CD\u65B0\u751F\u6210\u3002"));
      const result = this.schemaValidator.validate(legacy ? LEGACY_DRAFT_SCHEMA : DRAFT_SCHEMA, draft);
      (result.errors || []).forEach((error) => issues.push(schemaIssue(error)));
      if (!draft || typeof draft !== "object" || Array.isArray(draft)) return { valid: false, issues, supportedModes: [] };
      if (!Array.isArray(draft.items)) return { valid: false, issues, supportedModes: [] };
      let canonicalDraft = draft;
      if (legacy) {
        const capabilities2 = CourseCapabilityCatalog.fromDraft(draft);
        const modes2 = ["typing", ...capabilities2.chunkSelection ? ["chunkSelection"] : []];
        canonicalDraft = {
          ...draft,
          formatVersion: "1.1",
          learning: { template: "sentence-practice", version: 1, modes: modes2, defaultMode: "typing" },
          items: draft.items.map((item) => ({
            ...item,
            ...Array.isArray(item.chunks) ? { hints: item.chunks.map((chunk) => `${String(chunk).trim().split(/\s+/).filter(Boolean).length} \u8BCD`) } : {},
            ...Array.isArray(item.distractors) && item.distractors.length ? { distractors: [] } : {}
          }))
        };
        issues.push(issue("LEGACY_FORMAT", "formatVersion", "\u8FD9\u662F\u4E00\u4EFD\u65E7\u7248 AI \u8BFE\u7A0B\uFF0C\u5C06\u8F6C\u6362\u4E3A\u73B0\u6709\u53E5\u5B50\u7EC3\u4E60\u3002", "\u68C0\u67E5\u8BFE\u7A0B\u9884\u89C8\uFF1B\u7F3A\u5C11\u610F\u7FA4\u63D0\u793A\u7684\u65E7\u5185\u5BB9\u4F1A\u4F7F\u7528\u8BCD\u6570\u63D0\u793A\u3002", "warning"));
        if (draft.items.some((item) => Array.isArray(item.distractors) && item.distractors.length)) issues.push(issue("LEGACY_DISTRACTORS", "items", "\u65E7\u7248\u5E72\u6270\u9879\u6CA1\u6709\u6807\u660E\u5BF9\u5E94\u7684\u610F\u7FA4\u4F4D\u7F6E\uFF0C\u8F6C\u6362\u65F6\u4E0D\u4F1A\u6CBF\u7528\u3002", "\u68C0\u67E5\u7EC3\u4E60\u9884\u89C8\uFF1B\u9700\u8981\u7279\u5B9A\u5E72\u6270\u9879\u65F6\uFF0C\u8BF7\u8BA9 AI \u6309\u65B0\u7248\u683C\u5F0F\u91CD\u65B0\u751F\u6210\u3002", "warning"));
      }
      const keys = /* @__PURE__ */ new Set();
      (draft.roles || []).forEach((role, index) => {
        if (!role || typeof role.key !== "string") return;
        if (keys.has(role.key)) issues.push(issue("DUPLICATE_ROLE", `roles[${index}].key`, `\u89D2\u8272\u6807\u8BC6\u201C${role.key}\u201D\u91CD\u590D\u3002`, "\u4E3A\u6BCF\u4E2A\u89D2\u8272\u63D0\u4F9B\u4E0D\u540C\u7684 key\u3002"));
        keys.add(role.key);
      });
      const form = draft.contentForm;
      if (form === "dialogue" && (draft.roles || []).length < 2) issues.push(issue("DIALOGUE_ROLES_REQUIRED", "roles", "\u60C5\u666F\u5BF9\u8BDD\u81F3\u5C11\u9700\u8981\u4E24\u4E2A\u89D2\u8272\u3002", "\u6DFB\u52A0\u4E24\u4F4D\u89D2\u8272\uFF0C\u5E76\u4E3A\u6BCF\u53E5\u53F0\u8BCD\u6307\u5B9A\u8BF4\u8BDD\u4EBA\u3002"));
      if (form !== "dialogue" && Array.isArray(draft.roles) && draft.roles.length) issues.push(issue("UNUSED_ROLES", "roles", "\u53E5\u5B50\u96C6\u6216\u77ED\u6587\u4E0D\u9700\u8981\u5BF9\u8BDD\u89D2\u8272\u3002", "\u5C06 roles \u8BBE\u4E3A\u7A7A\u6570\u7EC4\u3002"));
      let anyChunks = false, allChunks = draft.items.length > 0;
      const seenChunks = /* @__PURE__ */ new Set();
      draft.items.forEach((item, index) => {
        if (!item || typeof item !== "object") {
          allChunks = false;
          return;
        }
        if (form === "dialogue") {
          if (!item.role || !keys.has(item.role)) issues.push(issue("UNKNOWN_ROLE", `items[${index}].role`, `\u7B2C ${index + 1} \u53E5\u6CA1\u6709\u5F15\u7528\u6709\u6548\u89D2\u8272\u3002`, "\u8865\u4E0A\u8FD9\u53E5\u8BDD\u7684\u89D2\u8272 key\uFF0C\u786E\u4FDD\u4E0E roles \u4E2D\u4E00\u81F4\u3002"));
          else seenChunks.add(item.role);
        } else if (item.role != null) issues.push(issue("UNEXPECTED_ROLE", `items[${index}].role`, "\u5F53\u524D\u5F62\u5F0F\u4E0D\u80FD\u6307\u5B9A\u89D2\u8272\u3002", "\u4EC5\u60C5\u666F\u5BF9\u8BDD\u4F7F\u7528 role \u5B57\u6BB5\u3002"));
        if (Array.isArray(item.chunks) && item.chunks.length) {
          anyChunks = true;
          if (this.chunkShape && !this.chunkShape.chunkCountOk(item.en, item.chunks)) issues.push(issue("CHUNK_COUNT_INVALID", `items[${index}].chunks`, `\u7B2C ${index + 1} \u53E5\u7684\u610F\u7FA4\u6570\u91CF\u4E0D\u7B26\u5408\u5B66\u4E60\u8981\u6C42\u3002`, this.chunkShape.chunkCountError(item.en, item.chunks)));
          const joined = normalizeDraftText(item.chunks.join(" "));
          if (joined !== normalizeDraftText(item.en)) issues.push(issue("CHUNK_TEXT_MISMATCH", `items[${index}].chunks`, `\u7B2C ${index + 1} \u53E5\u7684\u610F\u7FA4\u62FC\u63A5\u7ED3\u679C\u4E0E\u82F1\u6587\u539F\u53E5\u4E0D\u4E00\u81F4\u3002`, "\u8C03\u6574\u610F\u7FA4\u8FB9\u754C\uFF0C\u4F7F\u6309\u987A\u5E8F\u7528\u7A7A\u683C\u62FC\u63A5\u540E\u4E0E\u82F1\u6587\u539F\u53E5\u5B8C\u5168\u76F8\u540C\uFF0C\u5305\u62EC\u6807\u70B9\u3002"));
          const correct = new Set(item.chunks.map((chunk) => normalizeDraftText(chunk).toLocaleLowerCase("en")));
          const distractors = Array.isArray(item.distractors) ? item.distractors : [];
          if (!legacy && distractors.length && distractors.length !== item.chunks.length) issues.push(issue("DISTRACTOR_COUNT_MISMATCH", `items[${index}].distractors`, `\u7B2C ${index + 1} \u53E5\u7684\u5E72\u6270\u9879\u7EC4\u6570\u5FC5\u987B\u4E0E\u610F\u7FA4\u6570\u91CF\u76F8\u540C\u3002`, "\u4E3A\u6BCF\u4E2A\u610F\u7FA4\u63D0\u4F9B\u4E00\u7EC4\u5E72\u6270\u9879\uFF1B\u6CA1\u6709\u5E72\u6270\u9879\u7684\u610F\u7FA4\u7528\u7A7A\u6570\u7EC4\u8868\u793A\u3002"));
          const groups = legacy ? [] : distractors;
          groups.forEach((group, groupIndex) => {
            const local = /* @__PURE__ */ new Set([...item.chunks[groupIndex] ? [normalizeDraftText(item.chunks[groupIndex]).toLocaleLowerCase("en")] : []]);
            (group || []).forEach((word, distractorIndex) => {
              const normal = normalizeDraftText(word).toLocaleLowerCase("en");
              if (local.has(normal) || correct.has(normal)) issues.push(issue("DUPLICATE_DISTRACTOR", `items[${index}].distractors[${groupIndex}][${distractorIndex}]`, `\u7B2C ${index + 1} \u53E5\u7684\u5E72\u6270\u9879\u4E0E\u6B63\u786E\u610F\u7FA4\u6216\u5176\u4ED6\u5E72\u6270\u9879\u91CD\u590D\u3002`, "\u5220\u9664\u8FD9\u4E2A\u5E72\u6270\u9879\u6216\u6362\u6210\u4E0D\u540C\u8868\u8FBE\u3002"));
              local.add(normal);
            });
          });
          if (Array.isArray(item.acceptedAnswers)) {
            if (!item.acceptedAnswers.some((answer) => normalizeDraftText(answer).toLocaleLowerCase("en") === normalizeDraftText(item.en).toLocaleLowerCase("en"))) issues.push(issue("CANONICAL_ANSWER_MISSING", `items[${index}].acceptedAnswers`, `\u7B2C ${index + 1} \u53E5\u7684\u5141\u8BB8\u7B54\u6848\u6CA1\u6709\u5305\u542B\u539F\u53E5\u3002`, "\u4FDD\u7559\u82F1\u6587\u539F\u53E5\u4F5C\u4E3A\u5141\u8BB8\u7B54\u6848\u3002"));
            if (item.acceptedAnswers.some((answer) => normalizeDraftText(answer) && normalizeDraftText(answer).toLocaleLowerCase("en") !== normalizeDraftText(item.en).toLocaleLowerCase("en"))) issues.push(issue("UNSUPPORTED_ALTERNATE_ANSWER", `items[${index}].acceptedAnswers`, `\u7B2C ${index + 1} \u53E5\u5305\u542B\u5F53\u524D\u610F\u7FA4\u7EC3\u4E60\u65E0\u6CD5\u9A8C\u8BC1\u7684\u6574\u53E5\u66FF\u4EE3\u7B54\u6848\u3002`, "\u8BF7\u8BA9 AI \u53EA\u4FDD\u7559\u6807\u51C6\u539F\u53E5\uFF0C\u6216\u6539\u4E3A\u4E0E\u539F\u53E5\u5B8C\u5168\u76F8\u540C\u7684\u89C4\u8303\u5316\u5F62\u5F0F\u3002"));
          }
          if (!legacy && (!Array.isArray(item.hints) || item.hints.length !== item.chunks.length)) issues.push(issue("HINT_COUNT_MISMATCH", `items[${index}].hints`, `\u7B2C ${index + 1} \u53E5\u9700\u8981\u4E3A\u6BCF\u4E2A\u610F\u7FA4\u63D0\u4F9B\u4E00\u4E2A\u4E2D\u6587\u63D0\u793A\u3002`, "\u8BA9 AI \u6309\u610F\u7FA4\u987A\u5E8F\u8865\u9F50 hints\u3002"));
        } else {
          allChunks = false;
          if (Array.isArray(item.distractors) && item.distractors.length) issues.push(issue("DISTRACTORS_REQUIRE_CHUNKS", `items[${index}].distractors`, `\u7B2C ${index + 1} \u53E5\u6CA1\u6709\u610F\u7FA4\uFF0C\u4E0D\u80FD\u6DFB\u52A0\u610F\u7FA4\u5E72\u6270\u9879\u3002`, "\u4E3A\u8FD9\u53E5\u8BDD\u6DFB\u52A0\u5B8C\u6574 chunks\uFF0C\u6216\u5220\u9664 distractors\u3002"));
        }
      });
      if (anyChunks && !allChunks) issues.push(issue("PARTIAL_CHUNKS", "items", "\u8BFE\u7A0B\u53EA\u4E3A\u90E8\u5206\u53E5\u5B50\u63D0\u4F9B\u4E86\u610F\u7FA4\uFF0C\u5B66\u4E60\u80FD\u529B\u4E0D\u5B8C\u6574\u3002", "\u4E3A\u6BCF\u53E5\u8BDD\u8865\u9F50\u610F\u7FA4\uFF0C\u6216\u5220\u9664\u5168\u90E8 chunks \u5B57\u6BB5\u3002"));
      if (form === "dialogue" && seenChunks.size < 2) issues.push(issue("ROLE_NOT_USED", "items", "\u5BF9\u8BDD\u89D2\u8272\u6CA1\u6709\u90FD\u5728\u53F0\u8BCD\u4E2D\u51FA\u73B0\u3002", "\u68C0\u67E5\u6BCF\u53E5\u8BDD\u7684 role\uFF0C\u786E\u4FDD\u4E24\u4F4D\u89D2\u8272\u90FD\u53C2\u4E0E\u5BF9\u8BDD\u3002"));
      if (form === "article" && draft.items.length < 2) issues.push(issue("ARTICLE_TOO_SHORT", "items", "\u77ED\u6587\u81F3\u5C11\u9700\u8981\u4E24\u53E5\uFF0C\u624D\u80FD\u4F5C\u4E3A\u8FDE\u7EED\u9605\u8BFB\u5185\u5BB9\u3002", "\u5C06\u77ED\u6587\u62C6\u6210\u81F3\u5C11\u4E24\u53E5\u3002", "warning"));
      if (!anyChunks) issues.push(issue("NO_CHUNKS", "items", "\u73B0\u6709\u53E5\u5B50\u5B66\u4E60\u9700\u8981\u6BCF\u53E5\u8BDD\u90FD\u6709\u5B8C\u6574\u610F\u7FA4\u3002", "\u8BA9 AI \u4E3A\u6BCF\u53E5\u8865\u4E0A\u4E0E\u539F\u6587\u5B8C\u5168\u5339\u914D\u7684 chunks\u3002"));
      if (draft && Array.isArray(draft.roles) && draft.roles.length > 2) issues.push(issue("MANY_ROLES", "roles", "\u89D2\u8272\u8F83\u591A\uFF0C\u624B\u673A\u4E0A\u9605\u8BFB\u53EF\u80FD\u4E0D\u591F\u6E05\u695A\u3002", "\u8003\u8651\u5C06\u89D2\u8272\u6570\u91CF\u63A7\u5236\u5728\u4E24\u81F3\u56DB\u4F4D\u3002", "warning"));
      if (!legacy) issues.push(...inspectLearning(draft, preferences).issues);
      else {
        canonicalDraft.items.forEach((item, index) => {
          if (Array.isArray(item.chunks) && item.chunks.some((chunk) => this.chunkShape && !this.chunkShape.chunkCountOk(item.en, item.chunks))) return;
          if (Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.some((answer) => normalizeDraftText(answer) && normalizeDraftText(answer).toLocaleLowerCase("en") !== normalizeDraftText(item.en).toLocaleLowerCase("en"))) issues.push(issue("UNSUPPORTED_ALTERNATE_ANSWER", `items[${index}].acceptedAnswers`, `\u7B2C ${index + 1} \u53E5\u5305\u542B\u5F53\u524D\u610F\u7FA4\u7EC3\u4E60\u65E0\u6CD5\u9A8C\u8BC1\u7684\u6574\u53E5\u66FF\u4EE3\u7B54\u6848\u3002`, "\u8BF7\u8BA9 AI \u53EA\u4FDD\u7559\u6807\u51C6\u539F\u53E5\u3002"));
          if (!Array.isArray(item.chunks) || !item.chunks.length) issues.push(issue("CHUNKS_REQUIRED", `items[${index}].chunks`, `\u7B2C ${index + 1} \u53E5\u7F3A\u5C11\u610F\u7FA4\uFF0C\u65E0\u6CD5\u63A5\u5165\u73B0\u6709\u53E5\u5B50\u7EC3\u4E60\u3002`, "\u8BA9 AI \u6309\u65B0\u7248\u89C4\u8303\u8865\u9F50\u610F\u7FA4\u4E0E\u4E2D\u6587\u63D0\u793A\u3002"));
        });
      }
      const capabilities = CourseCapabilityCatalog.fromDraft(canonicalDraft);
      const supportedModes = CourseCapabilityCatalog.resolveRuntimeModes({
        capabilities,
        roles: (canonicalDraft.roles || []).map((role) => ({ id: role.key, name: role.name })),
        utterances: canonicalDraft.items.map((item, index) => ({ id: `line-${index}`, roleId: item.role || null, chunks: item.chunks ? { items: item.chunks } : null, text: { en: item.en } }))
      });
      return { valid: !issues.some((entry) => entry.severity === "error"), issues, capabilities, supportedModes, canonicalDraft };
    }
  };

  // src/course-authoring/sentence-adapter.mjs
  function sameAnswer(left, right) {
    return normalizeDraftText(left).toLocaleLowerCase("en") === normalizeDraftText(right).toLocaleLowerCase("en");
  }
  var SentenceCourseAdapter = class {
    /** @param {object} draft @param {{deckId?:string,catalogCourseId?:string,legacySource?:object,lineIds?:string[]}} options */
    compile(draft, { deckId, catalogCourseId = `user-deck:${deckId}`, legacySource = null, lineIds = null } = {}) {
      if (!draft || draft.format !== "chunklab-ai-course" || !deckId) throw new Error("\u539F\u751F\u53E5\u5B50\u8BFE\u7A0B\u7F3A\u5C11\u5DF2\u9A8C\u8BC1\u7684\u8BFE\u7A0B\u5185\u5BB9\u6216\u8BFE\u7A0B\u8EAB\u4EFD\u3002");
      const report = inspectLearning(draft);
      const errors = report.issues.filter((item) => item.severity === "error");
      if (errors.length) throw Object.assign(new Error(errors.map((item) => item.message).join("\uFF1B")), { report });
      const items = draft.items.map((item, index) => {
        if (!Array.isArray(item.chunks) || !Array.isArray(item.hints) || item.chunks.length !== item.hints.length) {
          throw new Error(`\u7B2C ${index + 1} \u53E5\u9700\u8981\u4E3A\u6BCF\u4E2A\u610F\u7FA4\u63D0\u4F9B\u4E2D\u6587\u63D0\u793A\u3002`);
        }
        if ((item.acceptedAnswers || []).some((answer) => !sameAnswer(answer, item.en))) {
          throw new Error(`\u7B2C ${index + 1} \u53E5\u5305\u542B\u539F\u751F\u7EC3\u4E60\u65E0\u6CD5\u4FDD\u7559\u7684\u6574\u53E5\u66FF\u4EE3\u7B54\u6848\u3002\u8BF7\u8BA9 AI \u5220\u9664\u6216\u6539\u5199\u8FD9\u4E9B\u7B54\u6848\u3002`);
        }
        const sourceRole = item.role && (draft.roles || []).find((role) => role.key === item.role);
        return {
          cid: lineIds && lineIds[index] || `${deckId}:line:${String(index + 1).padStart(3, "0")}`,
          sentence: item.en,
          translation: item.zh,
          chunks: item.chunks.slice(),
          hints: item.hints.slice(),
          ...item.distractors ? { distractors: item.distractors.map((group) => group.slice()) } : {},
          ...item.explanation ? { explain: item.explanation } : {},
          authoring: { sourceIndex: index, ...sourceRole ? { roleId: sourceRole.key, roleName: sourceRole.name } : {} }
        };
      });
      return {
        id: deckId,
        name: draft.title,
        short: draft.title,
        desc: draft.description || "",
        items,
        authoring: {
          schemaVersion: 1,
          formatVersion: draft.formatVersion,
          template: SENTENCE_TEMPLATE.id,
          templateVersion: SENTENCE_TEMPLATE.version,
          contentForm: draft.contentForm,
          targetCefr: draft.targetCefr,
          learning: structuredClone(draft.learning),
          roles: structuredClone(draft.roles || []),
          ...draft.source ? { source: structuredClone(draft.source) } : {},
          catalogCourseId,
          ...legacySource ? { legacySource: structuredClone(legacySource) } : {}
        }
      };
    }
    projectForExport(deck) {
      if (!deck || !deck.authoring || deck.authoring.schemaVersion !== 1 || deck.authoring.template !== SENTENCE_TEMPLATE.id) throw new Error("\u8FD9\u4E0D\u662F\u53EF\u5BFC\u51FA\u7684 AI \u53E5\u5B50\u8BFE\u7A0B\u3002");
      const roles = deck.authoring.roles || [];
      const items = (deck.items || []).map((item) => ({
        en: item.sentence,
        zh: item.translation,
        ...item.authoring && item.authoring.roleId ? { role: item.authoring.roleId } : {},
        chunks: item.chunks.slice(),
        hints: item.hints.slice(),
        ...item.distractors ? { distractors: item.distractors.map((group) => group.slice()) } : {},
        ...item.explain ? { explanation: item.explain } : {}
      }));
      return {
        format: "chunklab-ai-course",
        formatVersion: "1.1",
        title: deck.name,
        description: deck.desc || "",
        targetCefr: deck.authoring.targetCefr || "A2",
        contentForm: deck.authoring.contentForm,
        roles,
        learning: structuredClone(deck.authoring.learning),
        items,
        ...deck.authoring.source ? { source: structuredClone(deck.authoring.source) } : {}
      };
    }
  };

  // src/course-authoring/draft-compiler.mjs
  function locale(en, zh) {
    return { en: String(en || ""), "zh-CN": String(zh || "") };
  }
  function normalize(value) {
    return String(value || "").trim().replace(/[\t\n\f\r ]+/g, " ").toLocaleLowerCase("en");
  }
  function markedCourse(course) {
    const markers = course && course.authorNotes && course.authorNotes.chunklabAuthoring;
    return Array.isArray(markers) && markers.includes("format=chunklab-ai-course") && markers.includes("formatVersion=1.0");
  }
  var CourseDraftCompiler = class {
    constructor({ validator, sentenceAdapter = new SentenceCourseAdapter() }) {
      if (!(validator instanceof AiDraftValidator)) throw new Error("CourseDraftCompiler \u9700\u8981 AiDraftValidator");
      this.validator = validator;
      this.sentenceAdapter = sentenceAdapter;
    }
    /** @param {object} draft @param {{deckId:string,catalogCourseId?:string,legacySource?:object,lineIds?:string[]}} options */
    compileDeck(draft, { deckId, catalogCourseId, legacySource, lineIds }) {
      const report = this.validator.validate(draft);
      if (!report.valid) throw Object.assign(new Error("\u8BFE\u7A0B\u683C\u5F0F\u6216\u5185\u5BB9\u6821\u9A8C\u5931\u8D25"), { report });
      return this.sentenceAdapter.compile(report.canonicalDraft || draft, { deckId, catalogCourseId, legacySource, lineIds });
    }
    projectDeckForExport(deck) {
      return this.sentenceAdapter.projectForExport(deck);
    }
    compile(draft, identity) {
      if (!identity || typeof identity.courseId !== "string" || !/^ai-[a-z0-9-]{12,80}$/i.test(identity.courseId)) throw new Error("\u9700\u8981\u7531\u7F51\u7AD9\u5206\u914D\u7684\u8BFE\u7A0B ID");
      const report = this.validator.validate(draft);
      if (!report.valid) {
        const error = (
          /** @type {Error & {report:object}} */
          new Error("\u8BFE\u7A0B\u683C\u5F0F\u6216\u5185\u5BB9\u6821\u9A8C\u5931\u8D25")
        );
        error.report = report;
        throw error;
      }
      const roles = draft.roles.map((role) => ({ id: role.key, name: role.name }));
      const utterances = draft.items.map((item, lineIndex) => {
        const id = `${identity.courseId}:line:${String(lineIndex + 1).padStart(3, "0")}`;
        const chunks = Array.isArray(item.chunks) ? item.chunks : null;
        const chunkItems = chunks && chunks.map((text, chunkIndex) => ({ id: `${id}:chunk:${String(chunkIndex + 1).padStart(2, "0")}`, text: chunkIndex === chunks.length - 1 ? text : text + " " }));
        const distractors = chunkItems && (item.distractors || []).map((text, distractorIndex) => ({ id: `${id}:distractor:${String(distractorIndex + 1).padStart(2, "0")}`, text }));
        const acceptedAnswers = item.acceptedAnswers ? item.acceptedAnswers.slice() : [item.en];
        if (!acceptedAnswers.some((answer) => normalize(answer) === normalize(item.en))) acceptedAnswers.unshift(item.en);
        return {
          id,
          text: locale(item.en, item.zh),
          roleId: item.role || null,
          imageAssetId: null,
          audioAssetId: null,
          acceptedAnswers: { en: acceptedAnswers },
          ...chunks ? { chunks: { items: chunkItems, correctOrder: chunkItems.map((chunk) => chunk.id), distractors } } : {}
        };
      });
      const capabilities = CourseCapabilityCatalog.fromDraft(draft);
      const duration = Math.max(1, Math.ceil(draft.items.length * 0.4));
      return {
        schemaVersion: "2.0",
        courseId: identity.courseId,
        version: "1.0.0",
        metadata: {
          title: locale("", draft.title),
          description: locale("", draft.description),
          targetCefr: draft.targetCefr,
          estimatedDurationMinutes: duration,
          learningLocale: "en",
          supportLocales: ["zh-CN"]
        },
        assets: [],
        roles,
        utterances,
        sequence: utterances.map((item) => item.id),
        capabilities,
        capabilityReasons: { audio: [{ code: "REAL_AUDIO_REQUIRED", message: "\u8DDF\u8BFB\u548C\u542C\u5199\u9700\u8981\u8BFE\u7A0B\u63D0\u4F9B\u771F\u5B9E\u97F3\u9891\u3002\u7B80\u6613\u6587\u5B57\u8BFE\u7A0B\u6682\u4E0D\u5305\u542B\u97F3\u9891\u3002" }] },
        authorNotes: { chunklabAuthoring: ["format=chunklab-ai-course", "formatVersion=1.0", `contentForm=${draft.contentForm}`, ...draft.source && draft.source.title ? [`sourceTitle=${draft.source.title}`] : []] }
      };
    }
    projectForExport(course) {
      if (!markedCourse(course) || course.schemaVersion !== "2.0" || !Array.isArray(course.utterances)) throw new Error("\u8FD9\u95E8\u8BFE\u7A0B\u4E0D\u662F\u53EF\u65E0\u635F\u5BFC\u51FA\u7684 AI \u6587\u5B57\u8BFE\u7A0B\u3002");
      const markers = course.authorNotes.chunklabAuthoring;
      const contentForm = markers.find((marker) => marker.indexOf("contentForm=") === 0)?.slice("contentForm=".length);
      const sourceTitle = markers.find((marker) => marker.indexOf("sourceTitle=") === 0)?.slice("sourceTitle=".length) || "";
      if (!["sentences", "article", "dialogue"].includes(contentForm)) throw new Error("\u8BFE\u7A0B\u6765\u6E90\u4FE1\u606F\u4E0D\u5B8C\u6574\uFF0C\u4E0D\u80FD\u5B89\u5168\u5BFC\u51FA\u3002");
      const byId = new Map(course.utterances.map((item) => [item.id, item]));
      const items = course.sequence.map((id) => {
        const line = byId.get(id);
        if (!line) throw new Error("\u8BFE\u7A0B\u987A\u5E8F\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u53F0\u8BCD\u3002");
        const chunks = line.chunks && line.chunks.correctOrder.map((chunkId) => line.chunks.items.find((chunk) => chunk.id === chunkId)).filter(Boolean).map((chunk) => chunk.text.replace(/ $/, ""));
        return { en: line.text.en, zh: line.text["zh-CN"], ...line.roleId ? { role: line.roleId } : {}, ...chunks ? { chunks } : {}, ...line.chunks && line.chunks.distractors.length ? { distractors: line.chunks.distractors.map((chunk) => chunk.text) } : {}, acceptedAnswers: line.acceptedAnswers.en.slice() };
      });
      const draft = { format: "chunklab-ai-course", formatVersion: "1.0", title: course.metadata.title["zh-CN"], description: course.metadata.description["zh-CN"], targetCefr: course.metadata.targetCefr, contentForm, roles: course.roles.map((role) => ({ key: role.id, name: role.name })), items, ...sourceTitle ? { source: { title: sourceTitle } } : {} };
      const report = this.validator.validate(draft);
      if (!report.valid) {
        const error = (
          /** @type {Error & {report:object}} */
          new Error("\u8BFE\u7A0B\u5185\u5BB9\u65E0\u6CD5\u8F6C\u6362\u56DE AI \u8BFE\u7A0B\u6587\u4EF6")
        );
        error.report = report;
        throw error;
      }
      return draft;
    }
  };

  // src/course-authoring/adapters/course-gateway.mjs
  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }
  var ExistingCourseGateway = class {
    constructor({ getWindow = () => globalThis.window, scopeGuard }) {
      this.getWindow = getWindow;
      this.scopeGuard = scopeGuard;
    }
    #ready(scope) {
      const win = this.getWindow();
      if (!win || !win.CL || !win.ChunkCourse || !win.AccountStorage) throw new Error("\u8BFE\u7A0B\u5E93\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002");
      win.AccountStorage.assertCurrent();
      this.scopeGuard.assert(scope);
      return win;
    }
    async loadExample(catalogCourseId, scope) {
      const win = this.#ready(scope);
      const manifest = win.ContentRepo && win.ContentRepo.getManifest ? win.ContentRepo.getManifest() : null;
      const catalog = win.CourseCatalog.buildCatalog({ manifest: manifest || { decks: [] }, userDecks: win.CL.allDecks(win.CL.loadMem()), storyPackages: win.CL.readCourses(), logicalCourses: win.LogicalCourseStore.read() });
      const course = win.CourseCatalog.getCourse(catalog, catalogCourseId);
      if (!course) return null;
      const lesson = win.CourseCatalog.listLessons(course).find((item) => item.available !== false);
      if (!lesson || !lesson.contentRef) return null;
      let items = [], sourceRoles = [], sourceImages = [];
      if (lesson.contentRef.type === "story-package") {
        const packageCourse = win.CL.readCourses().find((item) => item.courseId === lesson.contentRef.id);
        if (packageCourse && packageCourse.schemaVersion === "2.0") {
          sourceRoles = packageCourse.roles || [];
          const notes = packageCourse.authorNotes && packageCourse.authorNotes.chunklabImageText;
          if (notes && notes.format === "chunklab-ai-image-text" && notes.formatVersion === "1.0") sourceImages = (notes.images || []).slice(0, 12).map(({ key, alt, prompt }) => ({ key, alt: String(alt || "").slice(0, 200), prompt: String(prompt || "").slice(0, 500) }));
          const map = new Map(packageCourse.utterances.map((item) => [item.id, item]));
          items = packageCourse.sequence.slice(0, 3).map((id) => map.get(id)).filter(Boolean).map((item) => ({ en: item.text.en, zh: item.text["zh-CN"], ...item.roleId ? { role: item.roleId } : {}, chunks: item.chunks && item.chunks.correctOrder.map((id) => item.chunks.items.find((chunk) => chunk.id === id)).filter(Boolean).map((chunk) => chunk.text.trim()) }));
        }
      } else if (lesson.contentRef.type === "sentence-deck") {
        const index = await win.ContentRepo.ensureDeckIndex(lesson.contentRef.id, win.CL.loadMem());
        this.scopeGuard.assert(scope);
        const records = await win.ContentRepo.hydrateItems((index.items || []).slice(0, 3), { memory: false });
        this.scopeGuard.assert(scope);
        items = records.map((item) => ({ en: item.sentence, zh: item.translation || "", chunks: Array.isArray(item.chunks) ? item.chunks.slice(0, 20) : void 0 })).filter((item) => item.zh);
      }
      if (!items.length) throw new Error("\u8FD9\u95E8\u8BFE\u7A0B\u6682\u65F6\u6CA1\u6709\u53EF\u4F9B AI \u5B9A\u5236\u7684\u6837\u4F8B\u5185\u5BB9\u3002");
      const roleIds = new Set(items.map((item) => item.role).filter(Boolean));
      const contentForm = roleIds.size >= 2 && items.every((item) => item.role) ? "dialogue" : items.some((item) => item.chunks) ? "article" : "sentences";
      const roles = contentForm === "dialogue" ? sourceRoles.filter((role) => roleIds.has(role.id)).map((role) => ({ key: role.id, name: role.name })) : [];
      return { title: course.title, contentForm, roles, items, ...sourceImages.length ? { images: sourceImages } : {} };
    }
    async loadLegacyAiCourse(courseId, scope) {
      const win = this.#ready(scope);
      await win.CL.preload();
      this.scopeGuard.assert(scope);
      const course = win.CL.readCourses().find((item) => item.courseId === courseId);
      const progress = win.CL.readProgress()[courseId] || null;
      return course ? { course: copy(course), progress: progress ? copy(progress) : null } : null;
    }
    async findCreatedCourse(courseId, scope) {
      const win = this.#ready(scope);
      await win.CL.preload();
      this.scopeGuard.assert(scope);
      const course = win.CL.readCourses().find((item) => item.courseId === courseId);
      return course ? copy(course) : null;
    }
    async getLaunchReceipt(deckId, scope) {
      const win = this.#ready(scope);
      await win.CL.preload();
      this.scopeGuard.assert(scope);
      const story = win.CL.readCourses().find((item) => item.courseId === deckId);
      if (story) return { storageKind: "story-package", contentId: story.courseId, catalogCourseId: `package:${story.courseId}`, lessonId: `lesson:story-package:${story.courseId}` };
      const deck = win.CL.findDeck(win.CL.loadMem(), deckId);
      if (!deck || !deck.authoring || deck.authoring.template !== "sentence-practice") throw new Error("\u627E\u4E0D\u5230\u5DF2\u4FDD\u5B58\u7684 AI \u53E5\u5B50\u8BFE\u7A0B\u3002");
      const catalogCourseId = deck.authoring.catalogCourseId || `user-deck:${deck.id}`;
      return { storageKind: "sentence-deck", contentId: deck.id, catalogCourseId, lessonId: `lesson:user-deck:${deck.id}` };
    }
    async findNativeCourse(deckId, scope) {
      const win = this.#ready(scope);
      await win.CL.preload();
      this.scopeGuard.assert(scope);
      const deck = win.CL.findDeck(win.CL.loadMem(), deckId);
      return deck ? copy(deck) : null;
    }
    async saveSentenceCourse(deck, scope, { forceSave = false, adoptMetadata = false, beforeSave = null } = {}) {
      const win = this.#ready(scope);
      await win.CL.preload();
      this.scopeGuard.assert(scope);
      const mem = win.CL.loadMem();
      const cloudConfig = win.CL.getCloudConfig && win.CL.getCloudConfig();
      const protocol3 = !!(cloudConfig && cloudConfig.writeProtocol === 3);
      const originalDecks = (mem.decks || []).map(copy);
      const index = (mem.decks || []).findIndex((item) => item.id === deck.id);
      if (index >= 0) {
        const current = mem.decks[index];
        if (JSON.stringify(current) !== JSON.stringify(deck)) {
          const sameItems = JSON.stringify(current.items) === JSON.stringify(deck.items);
          const noLegacySource = !current.authoring || !current.authoring.legacySource;
          if (adoptMetadata && sameItems && noLegacySource) mem.decks[index] = { ...current, authoring: copy(deck.authoring) };
          else throw new Error("\u8BE5\u8BFE\u7A0B ID \u5DF2\u6709\u4E0D\u540C\u5185\u5BB9\uFF0C\u5DF2\u4FDD\u7559\u539F\u8BFE\u7A0B\u3002\u8BF7\u53E6\u5EFA\u5236\u4F5C\u4F1A\u8BDD\u3002");
        }
      }
      if (index < 0) mem.decks = (mem.decks || []).concat([copy(deck)]);
      if (index < 0 || forceSave) {
        const rollback = typeof beforeSave === "function" ? beforeSave(mem) : null;
        if (protocol3) {
          let serverCommitted = false;
          try {
            if (!win.ServerCache || !win.ServerStore) throw new Error("\u8BFE\u7A0B\u4FDD\u5B58\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
            const row = await win.ServerCache.read();
            if (!row || row.owner !== win.AccountStorage.owner) throw new Error("\u8BFE\u7A0B\u6570\u636E\u5C1A\u672A\u4ECE\u670D\u52A1\u5668\u786E\u8BA4\uFF1B\u4FDD\u5B58\u672A\u63D0\u4EA4\u3002");
            const current = (row.snapshot.mem.decks || []).find((item) => item.id === deck.id);
            if (index >= 0 && !current) throw new Error("\u670D\u52A1\u5668\u8BFE\u7A0B\u5DF2\u53D8\u5316\u6216\u5220\u9664\uFF1B\u672C\u6B21\u4FDD\u5B58\u672A\u8986\u76D6\u670D\u52A1\u5668\u7248\u672C\u3002");
            if (index < 0 && current) throw new Error("\u8BE5\u8BFE\u7A0B\u7F16\u53F7\u5DF2\u5B58\u5728\u4E8E\u670D\u52A1\u5668\uFF1B\u672C\u6B21\u4FDD\u5B58\u672A\u8986\u76D6\u670D\u52A1\u5668\u7248\u672C\u3002");
            const expectedRev = current ? row.snapshot.revs.decks[deck.id] : null;
            await win.ServerStore.submitCommitted("deck.put", { deck: copy(mem.decks.find((item) => item.id === deck.id)), ...rollback ? { clearRetiredMarker: true } : {} }, {
              requestId: `authoring-deck-put-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
              expectedRev
            });
            serverCommitted = true;
            this.scopeGuard.assert(scope);
            const confirmed = await win.ServerCache.read();
            if (!confirmed || confirmed.owner !== win.AccountStorage.owner) throw new Error("\u8BFE\u7A0B\u5DF2\u63D0\u4EA4\uFF0C\u4F46\u786E\u8BA4\u72B6\u6001\u6682\u4E0D\u53EF\u7528\uFF1B\u8BF7\u5237\u65B0\u67E5\u770B\u7ED3\u679C\u3002");
            const savedDeck = (confirmed.snapshot.mem.decks || []).find((item) => item.id === deck.id);
            if (!savedDeck) throw new Error("\u8BFE\u7A0B\u5DF2\u63D0\u4EA4\uFF0C\u4F46\u670D\u52A1\u5668\u786E\u8BA4\u6570\u636E\u4E2D\u6682\u672A\u627E\u5230\uFF1B\u8BF7\u5237\u65B0\u67E5\u770B\u7ED3\u679C\u3002");
            const decks = (mem.decks || []).filter((item) => item.id !== deck.id);
            mem.decks = decks.concat([copy(savedDeck)]);
            if (typeof win.CL.saveAndNotify !== "function") throw new Error("\u8BFE\u7A0B\u5DF2\u4FDD\u5B58\u5230\u670D\u52A1\u5668\uFF0C\u4F46\u672C\u673A\u663E\u793A\u72B6\u6001\u672A\u80FD\u66F4\u65B0\uFF1B\u8BF7\u5237\u65B0\u67E5\u770B\u7ED3\u679C\u3002");
            const projected = await win.CL.saveAndNotify(mem, "local");
            if (projected === false) throw new Error("\u8BFE\u7A0B\u5DF2\u4FDD\u5B58\u5230\u670D\u52A1\u5668\uFF0C\u4F46\u672C\u673A\u663E\u793A\u72B6\u6001\u672A\u80FD\u66F4\u65B0\uFF1B\u8BF7\u5237\u65B0\u67E5\u770B\u7ED3\u679C\u3002");
          } catch (error) {
            if (!serverCommitted) {
              mem.decks = originalDecks;
              if (typeof rollback === "function") {
                try {
                  rollback();
                } catch (restoreError) {
                }
              }
            }
            throw error;
          }
          return {
            storageKind: "sentence-deck",
            contentId: deck.id,
            catalogCourseId: deck.authoring.catalogCourseId || `user-deck:${deck.id}`,
            lessonId: `lesson:user-deck:${deck.id}`
          };
        }
        let committed;
        try {
          committed = await win.CL.saveAndNotify(mem);
          this.scopeGuard.assert(scope);
        } catch (error) {
          if (typeof rollback === "function") {
            try {
              rollback();
            } catch (restoreError) {
            }
          }
          throw error;
        }
        if (!committed) {
          if (typeof rollback === "function") {
            try {
              rollback();
            } catch (restoreError) {
            }
          }
          throw new Error("\u8BFE\u7A0B\u5C1A\u672A\u5B8C\u6210\u4FDD\u5B58\u3002\u8BF7\u68C0\u67E5\u8D26\u53F7\u6216\u672C\u5730\u5B58\u50A8\u72B6\u6001\u540E\u91CD\u8BD5\u3002");
        }
      }
      return {
        storageKind: "sentence-deck",
        contentId: deck.id,
        catalogCourseId: deck.authoring.catalogCourseId || `user-deck:${deck.id}`,
        lessonId: `lesson:user-deck:${deck.id}`
      };
    }
    async saveCompiledCourse(course, assets, scope) {
      const win = this.#ready(scope);
      await win.CL.preload();
      this.scopeGuard.assert(scope);
      const result = await win.ChunkCourse.importCourse(copy(course), copy(assets || {}), false);
      this.scopeGuard.assert(scope);
      if (!result || !result.course || result.course.courseId !== course.courseId) throw new Error("\u8BFE\u7A0B\u4FDD\u5B58\u7ED3\u679C\u65E0\u6CD5\u786E\u8BA4\u3002\u8BF7\u8FD4\u56DE\u91CD\u8BD5\u3002");
      return { storageKind: "story-package", contentId: course.courseId, catalogCourseId: `package:${course.courseId}`, lessonId: `lesson:story-package:${course.courseId}` };
    }
    async joinCourse(catalogCourseId, scope) {
      const win = this.#ready(scope);
      const storyPackages = win.ChunkCourse.readCourses ? win.ChunkCourse.readCourses() : win.CL.readCourses();
      const catalog = win.CourseCatalog.buildCatalog({ manifest: win.ContentRepo.getManifest(), userDecks: win.CL.allDecks(win.CL.loadMem()), storyPackages, logicalCourses: win.LogicalCourseStore.read() });
      const course = win.CourseCatalog.getCourse(catalog, catalogCourseId);
      if (!course || course.available === false) throw new Error("\u5DF2\u4FDD\u5B58\u8BFE\u7A0B\uFF0C\u4F46\u8BFE\u7A0B\u76EE\u5F55\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u3002");
      await win.CourseEnrollment.join(course.id, win.CourseCatalog.getEnrollmentAliases(catalog));
      this.scopeGuard.assert(scope);
      return { courseId: course.id };
    }
    describePersistence(scope) {
      const win = this.#ready(scope);
      return win.CL.serverSaveState ? win.CL.serverSaveState() : { phase: "ready" };
    }
  };

  // src/course-authoring/adapters/browser-io.mjs
  var BrowserIO = class {
    constructor({ accountStorage = globalThis.AccountStorage, clipboard = globalThis.navigator && globalThis.navigator.clipboard, document = globalThis.document, crypto = globalThis.crypto } = {}) {
      this.accountStorage = accountStorage;
      this.clipboardPort = clipboard;
      this.document = document;
      this.crypto = crypto;
      this.clipboard = { write: (text) => {
        this.#assert();
        if (!this.clipboardPort || typeof this.clipboardPort.writeText !== "function") return Promise.reject(new Error("\u6D4F\u89C8\u5668\u4E0D\u5141\u8BB8\u81EA\u52A8\u590D\u5236"));
        return this.clipboardPort.writeText(text).then(() => {
          this.#assert();
        });
      } };
      this.download = { save: (fileName, text, type) => {
        this.#assert();
        if (!this.document || !this.document.createElement || !globalThis.URL || !globalThis.Blob) throw new Error("\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u4E0B\u8F7D\u8BFE\u7A0B\u6587\u4EF6\u3002");
        const url = URL.createObjectURL(new Blob([text], { type })), link = this.document.createElement("a");
        link.href = url;
        link.download = String(fileName || "chunklab-course.json").replace(/[\\/:*?"<>|]/g, "-");
        link.click();
        URL.revokeObjectURL(url);
        this.#assert();
        return { downloaded: true };
      } };
    }
    #assert() {
      if (!this.accountStorage || !this.accountStorage.assertCurrent) throw new Error("\u8D26\u53F7\u5B58\u50A8\u5C1A\u672A\u5C31\u7EEA\u3002");
      this.accountStorage.assertCurrent();
    }
    captureScope() {
      this.#assert();
      return Object.freeze({ owner: this.accountStorage.owner, databaseName: this.accountStorage.databaseName, sessionEpoch: this.accountStorage.sessionEpoch });
    }
    newId() {
      this.#assert();
      if (this.crypto && typeof this.crypto.randomUUID === "function") return this.crypto.randomUUID();
      if (this.crypto && typeof this.crypto.getRandomValues === "function") return Array.from(this.crypto.getRandomValues(new Uint8Array(16))).map((part) => part.toString(16).padStart(2, "0")).join("");
      throw new Error("\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u5B89\u5168\u521B\u5EFA\u8BFE\u7A0B ID\uFF0C\u8BF7\u4F7F\u7528 HTTPS \u6216\u6700\u65B0\u7248\u6D4F\u89C8\u5668\u3002");
    }
    guard() {
      let fallback = this.captureScope();
      return { capture: () => this.captureScope(), assert: (scope) => {
        this.#assert();
        if (scope.owner !== fallback.owner || scope.databaseName !== fallback.databaseName || scope.sessionEpoch !== fallback.sessionEpoch) throw Object.assign(new Error("\u8D26\u53F7\u6216\u670D\u52A1\u5DF2\u5207\u6362\u3002\u8BF7\u5237\u65B0\u9875\u9762\u540E\u7EE7\u7EED\u3002"), { code: "SESSION_CHANGED" });
        fallback = scope;
      } };
    }
  };

  // src/course-authoring/learning-launch.mjs
  var LegacyCourseLearningLauncher = class {
    constructor({ gateway, validator, compiler, scopeGuard, retiredStore }) {
      this.gateway = gateway;
      this.validator = validator;
      this.compiler = compiler;
      this.scopeGuard = scopeGuard;
      this.retiredStore = retiredStore;
      this.pending = /* @__PURE__ */ new Map();
    }
    /** @returns {Promise<any>} */
    async inspect(courseId) {
      const scope = this.scopeGuard.capture();
      const source = await this.gateway.loadLegacyAiCourse(courseId, scope);
      this.scopeGuard.assert(scope);
      if (!source) return { kind: "not-applicable", courseId };
      const conversion = convertLegacyAiCourse(source.course, { validator: this.validator, chunkShape: this.validator.chunkShape });
      const retired = this.retiredStore.has(courseId);
      const report = conversion.report;
      return {
        ...report,
        courseId,
        draft: conversion.draft,
        history: source.progress || report.history,
        kind: !report.valid ? "blocked" : retired || report.warnings.length ? "confirmation-required" : "native-ready",
        retired
      };
    }
    markDeleted(courseId, mem) {
      this.retiredStore.mark(String(courseId), mem);
    }
    allowRecreate(courseId, mem) {
      this.retiredStore.clear(String(courseId), mem);
    }
    isRetired(courseId, mem) {
      return this.retiredStore.has(String(courseId), mem);
    }
    /** @returns {Promise<any>} */
    async launch(courseId, { confirmed = false } = {}) {
      const key = String(courseId);
      if (this.pending.has(key)) return this.pending.get(key);
      const task = this.#launch(key, confirmed).finally(() => this.pending.delete(key));
      this.pending.set(key, task);
      return task;
    }
    async #launch(courseId, confirmed) {
      const scope = this.scopeGuard.capture();
      const source = await this.gateway.loadLegacyAiCourse(courseId, scope);
      this.scopeGuard.assert(scope);
      if (!source) return { kind: "not-applicable", courseId };
      const conversion = convertLegacyAiCourse(source.course, { validator: this.validator, chunkShape: this.validator.chunkShape });
      const report = conversion.report;
      const retired = this.retiredStore.has(courseId);
      if (!conversion.draft || !report.valid) return { ...report, kind: "blocked", courseId, history: source.progress || report.history };
      if ((report.warnings.length || retired) && !confirmed) return { ...report, kind: "confirmation-required", courseId, retired, history: source.progress || report.history };
      const compiled = this.compiler.compileDeck(conversion.draft, {
        deckId: courseId,
        catalogCourseId: report.plan.catalogCourseId,
        legacySource: report.plan.legacySource,
        lineIds: report.plan.lineIds
      });
      const current = await this.gateway.findNativeCourse(courseId, scope);
      this.scopeGuard.assert(scope);
      if (current) {
        const sameSource = current.authoring && current.authoring.legacySource && current.authoring.legacySource.courseId === courseId;
        const sourceIsUnlabeled = !current.authoring || !current.authoring.legacySource;
        const sameContent = JSON.stringify(current.items) === JSON.stringify(compiled.items);
        if (!(sameSource || sourceIsUnlabeled) || !sameContent) return { kind: "blocked", courseId, blockers: [{ code: "NATIVE_COURSE_CONFLICT", path: "courseId", message: "\u8BFE\u7A0B\u7F16\u53F7\u5DF2\u88AB\u4E0D\u540C\u5185\u5BB9\u4F7F\u7528\uFF0C\u539F\u8BFE\u7A0B\u4FDD\u6301\u4E0D\u53D8\u3002" }], warnings: report.warnings };
        let receipt2;
        if (retired || sourceIsUnlabeled) {
          receipt2 = await this.gateway.saveSentenceCourse(compiled, scope, {
            forceSave: true,
            adoptMetadata: sourceIsUnlabeled,
            beforeSave: retired ? (mem) => this.retiredStore.clear(courseId, mem) ? () => this.retiredStore.mark(courseId, mem) : null : null
          });
        } else receipt2 = await this.gateway.getLaunchReceipt(courseId, scope);
        this.scopeGuard.assert(scope);
        return { kind: "launched", courseId, receipt: receipt2, warnings: report.warnings, history: source.progress || report.history };
      }
      let receipt;
      receipt = await this.gateway.saveSentenceCourse(compiled, scope, {
        forceSave: retired,
        beforeSave: retired ? (mem) => this.retiredStore.clear(courseId, mem) ? () => this.retiredStore.mark(courseId, mem) : null : null
      });
      this.scopeGuard.assert(scope);
      return { kind: "launched", courseId, receipt, warnings: report.warnings, history: source.progress || report.history };
    }
  };
  function createBrowserLegacyCourseLauncher(win = globalThis.window) {
    if (!win || !win.CL || !win.ChunkCourse || !win.CourseSchemaValidator || !win.AccountStorage) throw new Error("\u5B66\u4E60\u6A21\u5757\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
    const io = new BrowserIO({ accountStorage: win.AccountStorage });
    const scopeGuard = io.guard();
    const accountScope = scopeGuard.capture();
    const markerKey = (id) => `ai-course-retired:${String(id)}`;
    const targetMem = (mem) => mem && typeof mem === "object" ? mem : win.CL.loadMem();
    const has = (id, mem) => {
      scopeGuard.assert(accountScope);
      const marks = targetMem(mem).deletedItems;
      return !!(marks && marks[markerKey(id)]);
    };
    const retiredStore = {
      has,
      mark(id, mem) {
        scopeGuard.assert(accountScope);
        const target = targetMem(mem);
        target.deletedItems = target.deletedItems || {};
        target.deletedItems[markerKey(id)] = true;
        scopeGuard.assert(accountScope);
      },
      clear(id, mem) {
        scopeGuard.assert(accountScope);
        const target = targetMem(mem);
        const marks = target.deletedItems || {};
        const existed = !!marks[markerKey(id)];
        delete marks[markerKey(id)];
        target.deletedItems = marks;
        scopeGuard.assert(accountScope);
        return existed;
      }
    };
    const gateway = new ExistingCourseGateway({ scopeGuard });
    const validator = new AiDraftValidator({ schemaValidator: win.CourseSchemaValidator, chunkShape: win.ChunkShape || null });
    const compiler = new CourseDraftCompiler({ validator });
    return new LegacyCourseLearningLauncher({ gateway, validator, compiler, scopeGuard, retiredStore });
  }

  // scripts/course-learning-launch-entry.mjs
  window.CourseLearningLaunch = {
    create: () => createBrowserLegacyCourseLauncher(window),
    markDeleted: (courseId, mem) => createBrowserLegacyCourseLauncher(window).markDeleted(courseId, mem),
    allowRecreate: (courseId, mem) => createBrowserLegacyCourseLauncher(window).allowRecreate(courseId, mem),
    isRetired: (courseId, mem) => createBrowserLegacyCourseLauncher(window).isRetired(courseId, mem)
  };
})();
