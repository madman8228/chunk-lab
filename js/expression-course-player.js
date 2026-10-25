// src/shared/chunk-selection.mjs
var make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
};
function createChunkSelection({
  mode = "sequence",
  tokens = [],
  targetCount = tokens.length,
  onSelect,
  onSubmit,
  className = "",
  selectedClass = "chunk-selection-selected",
  poolClass = "chunk-selection-pool",
  buttonClass = "chunk-selection-button",
  selectedButtonClass = "",
  selectedLabel = "\u5DF2\u9009\u8BCD\u5757\uFF0C\u70B9\u51FB\u53EF\u64A4\u56DE",
  poolLabel = "\u53EF\u9009\u8BCD\u5757",
  submitOnTarget = true
} = {}) {
  if (!["sequence", "immediate"].includes(mode)) throw new TypeError("Unsupported chunk selection mode");
  const element = make("div", `chunk-selection ${className}`.trim());
  const buttons = /* @__PURE__ */ new Map();
  const textCounts = /* @__PURE__ */ new Map();
  const tokenIndexes = new Map(tokens.map((token, index) => [String(token.id), index]));
  for (const token of tokens) textCounts.set(token.text, (textCounts.get(token.text) || 0) + 1);
  const labelFor = (token, index) => token.ariaLabel || (textCounts.get(token.text) > 1 ? `\u9009\u62E9\u8BCD\u5757\uFF1A${token.text}\uFF08\u7B2C${index + 1}\u5757\uFF09` : `\u9009\u62E9\u8BCD\u5757\uFF1A${token.text}`);
  let selected = [], state = "ready", active = true, destroyed = false, retryButton = null;
  if (mode === "immediate") {
    for (const token of tokens) {
      const button = make("button", `${buttonClass} ${token.className || ""}`.trim(), token.text);
      button.type = "button";
      button.dataset.v = token.value ?? token.text;
      button.dataset.chunkId = String(token.id);
      if (textCounts.get(token.text) > 1 || token.ariaLabel) button.setAttribute("aria-label", labelFor(token, tokenIndexes.get(String(token.id))));
      button.addEventListener("click", () => {
        if (destroyed || !active || button.disabled) return;
        onSelect?.(token, button);
      });
      buttons.set(String(token.id), button);
      element.append(button);
    }
  } else {
    let render2 = function() {
      selectedNode.replaceChildren();
      poolNode.replaceChildren();
      selectedNode.removeAttribute("aria-invalid");
      selected.forEach((id, index) => {
        const button = buttons.get(id);
        button.className = `${buttonClass} ${selectedButtonClass}`.trim();
        button.setAttribute("aria-label", `\u7B2C${index + 1}\u5757\uFF1A${button.textContent}\uFF0C\u70B9\u6B64\u64A4\u56DE`);
        selectedNode.append(button);
      });
      for (const token of tokens) {
        const id = String(token.id);
        if (selected.includes(id)) continue;
        const button = buttons.get(id);
        button.className = buttonClass;
        button.setAttribute("aria-label", labelFor(token, tokenIndexes.get(id)));
        poolNode.append(button);
      }
    };
    const selectedNode = make("div", `${selectedClass} chunk-selection-selected`.trim());
    const poolNode = make("div", poolClass);
    const feedback = make("span", "chunk-selection-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    selectedNode.setAttribute("role", "group");
    selectedNode.setAttribute("aria-label", selectedLabel);
    poolNode.setAttribute("role", "group");
    poolNode.setAttribute("aria-label", poolLabel);
    for (const token of tokens) {
      const button = make("button", buttonClass, token.text);
      button.type = "button";
      button.lang = token.lang || "en";
      button.setAttribute("aria-label", labelFor(token, tokenIndexes.get(String(token.id))));
      button.dataset.chunkId = String(token.id);
      button.addEventListener("click", () => {
        if (destroyed || !active || state === "pending" || state === "success") return;
        const id = String(token.id), index = selected.indexOf(id);
        if (index >= 0) selected.splice(index, 1);
        else if (selected.length < targetCount) selected.push(id);
        feedback.textContent = "";
        render2();
        button.focus();
        if (submitOnTarget && selected.length === targetCount) submit();
      });
      buttons.set(String(token.id), button);
      poolNode.append(button);
    }
    async function submit() {
      if (destroyed || !active || state !== "ready" || selected.length !== targetCount) return;
      const snapshot = selected.map((id) => id);
      state = "pending";
      render2();
      buttons.forEach((button) => {
        button.disabled = true;
      });
      try {
        const result = await onSubmit?.(snapshot.map((id) => tokens.find((token) => String(token.id) === id)));
        if (destroyed) return;
        if (result === "success" || result?.status === "success") {
          state = "success";
          feedback.textContent = result?.message || "";
          buttons.forEach((button) => {
            button.disabled = true;
          });
        } else if (result === "blocked" || result?.status === "blocked") {
          state = "blocked";
          feedback.textContent = result?.message || "\u5F53\u524D\u65E0\u6CD5\u63D0\u4EA4\uFF0C\u8BF7\u68C0\u67E5\u5B66\u4E60\u6743\u9650\u3002";
          buttons.forEach((button) => {
            button.disabled = true;
          });
        } else if (result === "retryable-error" || result?.status === "retryable-error") {
          state = "retryable-error";
          feedback.textContent = result?.message || "\u63D0\u4EA4\u6682\u65F6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
          retryButton = make("button", "chunk-selection-retry", "\u91CD\u8BD5\u63D0\u4EA4");
          retryButton.type = "button";
          retryButton.onclick = () => {
            retryButton.remove();
            retryButton = null;
            state = "ready";
            submit();
          };
          selectedNode.append(retryButton);
        } else {
          state = "ready";
          feedback.textContent = result?.message || "\u8BCD\u5757\u987A\u5E8F\u8FD8\u4E0D\u5BF9\uFF0C\u70B9\u5DF2\u9009\u8BCD\u5757\u64A4\u56DE\u540E\u91CD\u6392\u3002";
          selectedNode.setAttribute("aria-invalid", "true");
          buttons.forEach((button) => {
            button.disabled = false;
          });
          selectedNode.querySelector("button")?.focus();
        }
      } catch (error) {
        if (destroyed) return;
        state = "retryable-error";
        feedback.textContent = error?.message || "\u63D0\u4EA4\u6682\u65F6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
        buttons.forEach((button) => {
          button.disabled = true;
        });
        retryButton = make("button", "chunk-selection-retry", "\u91CD\u8BD5\u63D0\u4EA4");
        retryButton.type = "button";
        retryButton.onclick = () => {
          retryButton.remove();
          retryButton = null;
          state = "ready";
          submit();
        };
        selectedNode.append(retryButton);
      }
    }
    element.append(selectedNode, poolNode, feedback);
    render2();
    element.getSelection = () => selected.map((id) => tokens.find((token) => String(token.id) === id));
    element.reset = () => {
      if (state === "pending") return;
      state = "ready";
      selected = [];
      feedback.textContent = "";
      selectedNode.removeAttribute("aria-invalid");
      render2();
    };
    element.setState = (next) => {
      state = next;
      buttons.forEach((button) => {
        button.disabled = next === "pending" || next === "success" || next === "blocked";
      });
    };
  }
  element.getButton = (id) => buttons.get(String(id)) || null;
  element.setActive = (value) => {
    active = Boolean(value);
  };
  element.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    active = false;
    buttons.forEach((button) => {
      button.disabled = true;
    });
    retryButton?.remove();
  };
  return element;
}

// src/expression-course/ui/renderers.mjs
var el = (tag, attrs = {}, text = "") => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== void 0 && value !== null) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
};
function renderActivity(root, activity, { onAction, playAudio: playAudio2, preview = false } = {}) {
  root.replaceChildren();
  root.append(el("p", { class: "activity-prompt" }, activity.prompt || "\u5B8C\u6210\u8FD9\u4E00\u5C0F\u6B65"));
  const payload = activity.payload || {};
  let response = {};
  let submitting = false;
  if (activity.type === "meaning_intro" || activity.type === "micro_explanation") {
    const example = payload.exampleEnglish || payload.example || payload.explanation || "";
    const zh = payload.exampleZh || payload.meaning || payload.explanationZh || "";
    if (payload.ruleText) root.append(el("p", { class: "activity-meaning" }, payload.ruleText));
    if (example) root.append(el("p", { class: "activity-example", lang: "en" }, example));
    if (zh) root.append(el("p", { class: "activity-meaning" }, zh));
    for (const contrast of payload.contrasts || []) {
      const item = el("p", { class: "activity-meaning" }, `${contrast.label || "\u5BF9\u6BD4"}\uFF1A${contrast.en || contrast.left || ""} \xB7 ${contrast.zh || contrast.right || ""}`);
      root.append(item);
    }
  } else if (activity.type === "sound_demo") {
    if (payload.instructionZh) root.append(el("p", { class: "activity-meaning" }, payload.instructionZh));
    for (const segment of payload.segments || []) {
      const row = el("div", { class: "sound-demo-segment" });
      if (segment.symbol) row.append(el("span", { class: "sound-symbol", lang: "en" }, segment.symbol));
      if (segment.label) row.append(el("span", { class: "activity-meaning" }, segment.label));
      const play = el("button", { type: "button", class: "button button-secondary" }, segment.buttonLabel || "\u64AD\u653E\u793A\u8303");
      play.addEventListener("click", () => playAudio2?.(segment.audioAssetId, play));
      row.append(play);
      root.append(row);
    }
  } else if (activity.type === "sentence_build" || activity.type === "grapheme_build") {
    const isGrapheme = activity.type === "grapheme_build";
    root.append(el("p", { class: "activity-meaning" }, payload.targetMeaning || (isGrapheme ? "\u6309\u58F0\u97F3\u987A\u5E8F\u62FC\u5408\u5B57\u6BCD\u5757" : "\u6309\u6B63\u786E\u987A\u5E8F\u6392\u5217\u8BCD\u5757")));
    if (isGrapheme && payload.audioAssetId) {
      const play = el("button", { type: "button", class: "button button-secondary" }, "\u518D\u542C\u4E00\u6B21");
      play.addEventListener("click", () => playAudio2?.(payload.audioAssetId, play));
      root.append(play);
    }
    const targetCount = payload.expectedTokenCount || payload.availableTokens?.length || 0;
    const selection = createChunkSelection({
      mode: "sequence",
      className: "expression-chunk-selection",
      selectedClass: "token-row token-row-selected",
      poolClass: "token-row",
      buttonClass: "token-button",
      selectedButtonClass: "token-chip",
      targetCount,
      submitOnTarget: !preview && Boolean(onAction && payload.expectedTokenCount > 0),
      tokens: (payload.availableTokens || []).map((text, index) => ({
        id: `${activity.id || "activity"}:${index}`,
        text
      })),
      onSubmit: onAction && payload.expectedTokenCount > 0 ? (chosen) => {
        submitting = true;
        return Promise.resolve(onAction({ type: "submit", response: { tokens: chosen.map((token) => token.text) } })).finally(() => {
          submitting = false;
        });
      } : void 0
    });
    root.append(selection);
    response = { get tokens() {
      return selection.getSelection().map((token) => token.text);
    } };
  } else if (activity.type === "listening_choice") {
    const play = el("button", { type: "button", class: "button button-secondary" }, "\u64AD\u653E\u97F3\u9891");
    play.addEventListener("click", () => playAudio2?.(payload.audioAssetId, play));
    root.append(play);
    if (!preview && onAction) {
      const skip = el("button", { type: "button", class: "text-button" }, "\u97F3\u9891\u65E0\u6CD5\u64AD\u653E\uFF1F\u8DF3\u8FC7\u672C\u9898");
      skip.addEventListener("click", () => onAction({ type: "skip_audio" }));
      root.append(skip);
    }
    const choices = el("div", { class: "choice-list", role: "group", "aria-label": "\u9009\u62E9\u542C\u5230\u7684\u610F\u601D" });
    for (const option of payload.options || []) {
      const button = el("button", { type: "button", class: "choice-button" }, option.textZh || option.text || "\u9009\u9879");
      button.addEventListener("click", () => {
        response.optionId = option.id;
        choices.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      });
      choices.append(button);
    }
    root.append(choices);
  } else if (activity.type === "speaking_practice") {
    if (payload.scenario) root.append(el("p", { class: "activity-meaning" }, payload.scenario));
    root.append(el("p", { class: "activity-meaning" }, payload.instruction || "\u5148\u542C\u793A\u8303\uFF0C\u518D\u81EA\u5DF1\u5F00\u53E3\u8BF4\u4E00\u904D\u3002"));
    root.append(el("p", { class: "activity-meaning" }, "\u8FD9\u662F\u81EA\u6211\u7EC3\u4E60\uFF0C\u4E0D\u8BC4\u4F30\u6216\u8BB0\u5F55\u53D1\u97F3\u6B63\u786E\u7387\u3002"));
    if (payload.referenceText && payload.audioAssetId) {
      const play = el("button", { type: "button", class: "button button-secondary" }, "\u64AD\u653E\u793A\u8303");
      play.addEventListener("click", () => playAudio2?.(payload.audioAssetId, play));
      root.append(play);
    } else if (!preview && onAction) {
      const reveal = el("button", { type: "button", class: "button button-secondary" }, "\u663E\u793A\u793A\u8303");
      reveal.addEventListener("click", () => onAction({ type: "reveal" }));
      root.append(reveal);
    }
  } else {
    if (payload.scenario) root.append(el("p", { class: "activity-meaning" }, payload.scenario));
    if (payload.targetMeaning) root.append(el("p", { class: "activity-meaning" }, payload.targetMeaning));
    if (["substitution", "independent_output", "transfer_test"].includes(activity.type) && Number.isInteger(payload.expectedWordCount) && payload.expectedWordCount > 0) {
      const slots = el("div", { class: "word-slots", role: "group", "aria-label": "\u9010\u8BCD\u8F93\u5165\u82F1\u6587\u8868\u8FBE" });
      const inputs = Array.from({ length: payload.expectedWordCount }, (_, index) => {
        const input = el("input", {
          class: "word-slot",
          type: "text",
          maxlength: 32,
          autocomplete: "off",
          autocapitalize: "none",
          spellcheck: "false",
          "aria-label": `\u7B2C ${index + 1} \u4E2A\u5355\u8BCD`,
          "aria-posinset": String(index + 1),
          "aria-setsize": String(payload.expectedWordCount)
        });
        input.lang = "en";
        input.addEventListener("keydown", (event) => {
          if (event.key === " " && index < inputs.length - 1) {
            event.preventDefault();
            inputs[index + 1].focus();
          }
        });
        slots.append(input);
        return input;
      });
      response = { get text() {
        return inputs.map((input) => input.value.trim()).filter(Boolean).join(" ");
      } };
      root.append(slots);
    } else {
      const input = el("textarea", { class: "answer-input", rows: 2, maxlength: 500, placeholder: "\u5728\u8FD9\u91CC\u8F93\u5165\u4F60\u7684\u8868\u8FBE", "aria-label": "\u8F93\u5165\u82F1\u6587\u8868\u8FBE" });
      input.addEventListener("input", () => {
        response.text = input.value;
      });
      root.append(input);
    }
  }
  if (!preview && onAction) {
    const controls = el("div", { class: "activity-tools" });
    const hint = el("button", { type: "button", class: "text-button" }, "\u7ED9\u6211\u63D0\u793A");
    hint.addEventListener("click", () => {
      if (!submitting) onAction({ type: "hint" });
    });
    const reveal = el("button", { type: "button", class: "text-button" }, "\u663E\u793A\u7B54\u6848");
    reveal.addEventListener("click", () => {
      if (!submitting) onAction({ type: "reveal" });
    });
    if (!["meaning_intro", "micro_explanation", "sound_demo", "speaking_practice"].includes(activity.type)) controls.append(hint, reveal);
    if (activity.type === "independent_output") {
      const skip = el("button", { type: "button", class: "text-button" }, "\u6682\u65F6\u8DF3\u8FC7");
      skip.addEventListener("click", () => onAction({ type: "skip_output" }));
      controls.append(skip);
    }
    root.append(controls);
  }
  return {
    response: () => response,
    informational: ["meaning_intro", "micro_explanation", "sound_demo"].includes(activity.type),
    speakingPractice: activity.type === "speaking_practice",
    autoSubmit: ["sentence_build", "grapheme_build"].includes(activity.type) && payload.expectedTokenCount > 0
  };
}

// src/expression-course/ui/entry.mjs
var $ = (id) => document.getElementById(id);
var params = new URLSearchParams(location.search);
var returnHref = window.CourseReturn.destination();
window.CourseReturn.bind(document.querySelector(".back-link"), { href: returnHref });
var courseId = params.get("course") || "";
var lessonId = params.get("lesson") || "";
var courseLessons = [];
var courseProgress = null;
var status = $("courseStatus");
var body = $("activityBody");
var footer = $("activityActions");
var current = null;
var accessSessionId = null;
var heartbeat = null;
var sequence = 0;
var audio = null;
var busy = false;
var pendingActionRequest = null;
var requestId = () => crypto.randomUUID();
var setStatus = (value) => {
  status.textContent = value;
};
var accessMessages = {
  AUTHORIZATION_EXPIRED: "\u5B66\u4E60\u6743\u9650\u5DF2\u5230\u671F\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u4F1A\u4FDD\u7559\uFF1B\u5F53\u524D\u7B54\u6848\u5C1A\u672A\u63D0\u4EA4\uFF0C\u8BF7\u6062\u590D\u6743\u9650\u540E\u7EE7\u7EED\u3002",
  SESSION_EXPIRED: "\u672C\u6B21\u5B66\u4E60\u65F6\u6BB5\u5DF2\u7ED3\u675F\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u4F1A\u4FDD\u7559\uFF1B\u5F53\u524D\u7B54\u6848\u5C1A\u672A\u63D0\u4EA4\uFF0C\u8BF7\u91CD\u65B0\u8FDB\u5165\u8BFE\u7A0B\u3002",
  TRIAL_EXPIRED: "\u4F53\u9A8C\u5DF2\u7ED3\u675F\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u4F1A\u4FDD\u7559\uFF1B\u6062\u590D\u5B66\u4E60\u6743\u9650\u540E\u53EF\u7EE7\u7EED\u3002",
  TRIAL_DAILY_LIMIT: "\u4ECA\u65E5\u5B66\u4E60\u65F6\u957F\u5DF2\u7528\u5B8C\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u4F1A\u4FDD\u7559\uFF0C\u4E4B\u540E\u53EF\u7EE7\u7EED\u3002",
  MEMBERSHIP_REQUIRED: "\u5F53\u524D\u8BFE\u7A0B\u9700\u8981\u6709\u6548\u5B66\u4E60\u6743\u9650\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u4F1A\u4FDD\u7559\uFF0C\u83B7\u5F97\u6743\u9650\u540E\u53EF\u7EE7\u7EED\u3002"
};
var failureMessage = (error) => {
  if (error?.code === "SESSION_CHANGED") return "\u767B\u5F55\u8D26\u53F7\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BFE\u7A0B\u3002";
  if (accessMessages[error?.code]) return accessMessages[error.code];
  if (/^(Failed to fetch|Load failed)$|NetworkError when attempting to fetch resource/i.test(error?.message || "")) {
    return "\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5\u7F51\u7EDC\u3002\u5F53\u524D\u8F93\u5165\u4F1A\u4FDD\u7559\uFF0C\u8BF7\u6062\u590D\u8FDE\u63A5\u540E\u91CD\u8BD5\u3002";
  }
  return error?.message || "\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002";
};
var fail = (error) => {
  setStatus(failureMessage(error));
};
async function start() {
  $("retryCourse").hidden = true;
  $("retryCourse").onclick = start;
  if (!window.ChunkAPI?.isLoggedIn()) {
    $("courseIntro").textContent = "\u8BF7\u5148\u767B\u5F55\uFF0C\u518D\u5F00\u59CB\u5B66\u4E60\u3002";
    setStatus("\u53EF\u4EE5\u8FD4\u56DE\u9996\u9875\u767B\u5F55\u540E\u91CD\u65B0\u8FDB\u5165\u8BFE\u7A0B\u3002");
    return;
  }
  $("courseIntro").textContent = "\u6B63\u5728\u8BFB\u53D6\u8BFE\u7A0B\u2026";
  $("courseTitle").setAttribute("aria-busy", "true");
  try {
    const meta = await ChunkAPI.request("/api/expression-courses/" + encodeURIComponent(courseId), { timeoutMs: 15e3 });
    $("lessonCards").replaceChildren();
    courseLessons = meta.lessons;
    courseProgress = meta.progress;
    const lesson = meta.lessons.find((item) => item.lessonId === lessonId) || (!lessonId ? meta.lessons.find((item) => item.lessonId === courseProgress?.nextLessonId) || meta.lessons[0] : null);
    if (!lesson) throw new Error("\u627E\u4E0D\u5230\u8FD9\u8282\u8BFE\u7A0B\u3002");
    lessonId = lesson.lessonId;
    $("courseTitle").textContent = params.has("lesson") ? meta.title + " \xB7 " + lesson.title : meta.title;
    $("courseIntro").textContent = params.has("lesson") ? lesson.communicationGoal : meta.description || "\u6309\u5355\u5143\u9010\u6B65\u7EC3\u4E60\uFF0C\u5B8C\u6210\u6BCF\u4E00\u6B65\u540E\u81EA\u52A8\u4FDD\u5B58\u5B66\u4E60\u8FDB\u5EA6\u3002";
    if (!params.has("lesson") && !params.has("mode")) {
      $("expressionLearning").classList.add("course-overview");
      $("overviewProgress").hidden = false;
      $("overviewProgressText").textContent = `${courseProgress?.percent || 0}% \xB7 \u5DF2\u5B8C\u6210 ${courseProgress?.completed || 0} / ${meta.lessons.length} \u5355\u5143`;
      $("overviewProgressBar").value = courseProgress?.percent || 0;
      $("courseDirectory").hidden = false;
      $("courseLabels").hidden = false;
      const minutes = meta.lessons.reduce((sum, unit) => sum + unit.activityCount, 0);
      $("courseDuration").textContent = `\u9884\u8BA1 ${Math.round(minutes * 0.7)}\u2013${Math.round(minutes * 1.3)} \u5206\u949F\uFF08\u6309\u7EC3\u4E60\u91CF\u4F30\u7B97\uFF09`;
      const wrongIds = new Set(courseProgress?.wrongLessonIds || []);
      $("reviewWrongUnits").hidden = false;
      $("reviewWrongUnits").textContent = `\u590D\u4E60\u9519\u9898\u5355\u5143\uFF08${wrongIds.size}\uFF09`;
      $("reviewWrongUnits").disabled = wrongIds.size === 0;
      $("wrongReviewHelp").hidden = false;
      let indexedUnit = null;
      let wrongOnly = false;
      const indexPanel = document.createElement("nav");
      indexPanel.className = "unit-quick-index";
      indexPanel.setAttribute("aria-label", "\u7AE0\u8282\u5FEB\u901F\u7D22\u5F15");
      const indexHeading = document.createElement("h2");
      indexHeading.textContent = "\u7AE0\u8282\u5FEB\u901F\u7D22\u5F15";
      indexPanel.append(indexHeading);
      $("courseDirectory").querySelector(".unit-quick-index")?.remove();
      $("courseDirectory").prepend(indexPanel);
      const indexButtons = [];
      $("directorySummary").textContent = `\u5171 ${meta.lessons.length} \u4E2A\u5355\u5143\uFF0C\u5DF2\u5B8C\u6210 ${courseProgress?.completed || 0} \u4E2A \xB7 \u603B\u8FDB\u5EA6 ${courseProgress?.percent || 0}%\u3002\u9009\u62E9\u5355\u5143\u5F00\u59CB\u6216\u7EE7\u7EED\u5B66\u4E60\u3002`;
      for (const [index, unit] of meta.lessons.entries()) {
        const unitProgress = courseProgress?.lessons.find((item) => item.lessonId === unit.lessonId);
        const stateLabel = unitProgress?.status === "completed" ? "\u5DF2\u5B8C\u6210" : unitProgress?.status === "in_progress" ? `\u5B66\u4E60\u4E2D ${unitProgress.percent}%` : "\u672A\u5F00\u59CB";
        const shared = window.LessonCard.create({
          title: unit.title,
          index: index + 1,
          image: window.CourseCovers.fallback({ id: courseId + ":" + unit.lessonId }),
          meta: `${unit.activityCount} \u4E2A\u7EC3\u4E60 \xB7 ${stateLabel}`
        });
        const card = document.createElement("a");
        card.className = shared.card.className;
        card.dataset.status = unitProgress?.status || "not_started";
        card.dataset.lessonId = unit.lessonId;
        card.dataset.search = (unit.title + " " + (unit.communicationGoal || "")).toLowerCase();
        card.append(...shared.card.childNodes);
        window.LessonCard.setStatus(card, unitProgress?.status || "not_started", unitProgress?.percent || 0);
        const goal = document.createElement("p");
        goal.className = "unit-goal";
        goal.textContent = unit.communicationGoal || "";
        card.insertBefore(goal, shared.footer);
        card.setAttribute("aria-label", `\u7B2C ${index + 1} \u5355\u5143\uFF1A${unit.title}\u3002${unit.communicationGoal || ""}`);
        card.title = unit.communicationGoal || unit.title;
        const query = new URLSearchParams({ course: courseId, lesson: unit.lessonId });
        const directory = "expression-learn.html?" + new URLSearchParams({ course: courseId, returnTo: returnHref });
        card.href = window.CourseReturn.forward("expression-learn.html?" + query, directory);
        $("lessonCards").append(card);
        const indexButton = document.createElement("button");
        indexButton.type = "button";
        indexButton.textContent = `${index + 1}. ${unit.title}`;
        const indexState = document.createElement("small");
        indexState.textContent = stateLabel;
        indexButton.append(indexState);
        indexButton.setAttribute("aria-pressed", "false");
        indexButton.onclick = () => {
          indexedUnit = indexedUnit === unit.lessonId ? null : unit.lessonId;
          indexButtons.forEach((item) => item.button.setAttribute("aria-pressed", String(item.id === indexedUnit)));
          filterUnits();
        };
        indexButtons.push({ button: indexButton, id: unit.lessonId });
        indexPanel.append(indexButton);
      }
      const total = meta.lessons.length, done = courseProgress?.completed || 0;
      $("unitFilters").querySelector("[data-filter=all]").textContent = `\u5168\u90E8\uFF08${total}\uFF09`;
      $("unitFilters").querySelector("[data-filter=unfinished]").textContent = `\u672A\u5B8C\u6210\uFF08${total - done}\uFF09`;
      $("unitFilters").querySelector("[data-filter=completed]").textContent = `\u5DF2\u5B8C\u6210\uFF08${done}\uFF09`;
      let activeFilter = "all";
      const filterUnits = () => {
        const query = $("unitSearch").value.trim().toLowerCase();
        let visible = 0;
        for (const card of $("lessonCards").children) {
          const matches = (!indexedUnit || card.dataset.lessonId === indexedUnit) && (!wrongOnly || wrongIds.has(card.dataset.lessonId)) && card.dataset.search.includes(query) && (activeFilter === "all" || (activeFilter === "completed" ? card.dataset.status === "completed" : card.dataset.status !== "completed"));
          card.hidden = !matches;
          if (matches) visible++;
        }
        $("unitEmpty").hidden = visible > 0;
      };
      $("unitSearch").oninput = filterUnits;
      $("reviewWrongUnits").onclick = () => {
        wrongOnly = !wrongOnly;
        indexedUnit = null;
        activeFilter = "all";
        $("unitSearch").value = "";
        indexButtons.forEach((item) => item.button.setAttribute("aria-pressed", "false"));
        $("reviewWrongUnits").textContent = wrongOnly ? "\u663E\u793A\u5168\u90E8\u5355\u5143" : `\u590D\u4E60\u9519\u9898\u5355\u5143\uFF08${wrongIds.size}\uFF09`;
        filterUnits();
        $("courseDirectory").scrollIntoView({ block: "start" });
      };
      $("unitFilters").querySelectorAll("button").forEach((button) => {
        button.onclick = () => {
          activeFilter = button.dataset.filter;
          $("unitFilters").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
          filterUnits();
        };
      });
    }
    $("startButton").hidden = false;
    if (!params.has("lesson") && courseProgress?.lessons.some((item) => item.status === "in_progress")) $("startButton").textContent = "\u7EE7\u7EED\u5B66\u4E60";
    const requestedMode = params.get("mode") === "review" ? "review" : "learn";
    const requested = {
      mode: requestedMode,
      reviewSkillId: params.get("skill") || void 0,
      reviewActivityId: params.get("activity") || void 0,
      releaseId: params.get("release") || void 0
    };
    if (requestedMode === "review") $("startButton").textContent = "\u5F00\u59CB\u590D\u4E60";
    $("startButton").onclick = () => beginSession(requested);
    if (!params.has("mode")) await loadDueReviews();
    setStatus("\u51C6\u5907\u597D\u4E86\u5C31\u70B9\u201C\u5F00\u59CB\u5B66\u4E60\u201D\u3002");
  } catch (error) {
    $("courseIntro").textContent = "\u8BFE\u7A0B\u6682\u65F6\u672A\u80FD\u52A0\u8F7D\u3002";
    $("retryCourse").hidden = false;
    fail(error);
  } finally {
    $("courseTitle").removeAttribute("aria-busy");
  }
}
async function beginSession({ mode, reviewSkillId, reviewActivityId, releaseId, lessonId: targetLessonId = lessonId } = {}) {
  $("startButton").disabled = true;
  try {
    const unitId = "lesson-" + targetLessonId;
    const access = await ChunkAPI.request("/api/learning-sessions/start", { method: "POST", body: JSON.stringify({
      courseId,
      unitId,
      requestId: requestId(),
      cursor: 0
    }) });
    if (!access.allowed) throw Object.assign(new Error(access.reasonCode || "\u5F53\u524D\u6682\u65F6\u65E0\u6CD5\u8FDB\u5165\u8FD9\u95E8\u8BFE"), { code: access.reasonCode });
    accessSessionId = access.sessionId || null;
    current = await ChunkAPI.request("/api/expression-sessions", { method: "POST", body: JSON.stringify({
      courseId,
      lessonId: targetLessonId,
      mode,
      accessSessionId,
      requestId: requestId(),
      reviewSkillId,
      reviewActivityId,
      releaseId
    }) });
    const selectedLesson = courseLessons.find((item) => item.lessonId === targetLessonId);
    $("courseDirectory").hidden = true;
    $("overviewProgress").hidden = true;
    if (selectedLesson) $("courseTitle").textContent = selectedLesson.title;
    render();
    if (accessSessionId) heartbeat = setInterval(ping, 3e4);
  } catch (error) {
    fail(error);
    $("startButton").disabled = false;
  }
}
async function loadDueReviews() {
  try {
    const { items } = await ChunkAPI.request("/api/expression-reviews/due");
    const due = items.filter((item) => item.courseId === courseId);
    if (!due.length) return;
    const list = $("dueReviewList");
    $("dueReviews").hidden = false;
    for (const item of due) {
      const button = document.createElement("button");
      button.className = "button button-secondary";
      button.type = "button";
      button.textContent = "\u590D\u4E60\uFF1A" + item.title;
      button.onclick = () => {
        history.replaceState(null, "", `?course=${encodeURIComponent(item.courseId)}&lesson=${encodeURIComponent(item.lessonId)}&mode=review&skill=${encodeURIComponent(item.skillId)}&activity=${encodeURIComponent(item.activityId)}&release=${encodeURIComponent(item.releaseId)}`);
        beginSession({ mode: "review", lessonId: item.lessonId, reviewSkillId: item.skillId, reviewActivityId: item.activityId, releaseId: item.releaseId });
      };
      list.append(button);
    }
  } catch (_) {
  }
}
async function ping() {
  if (!accessSessionId || !current || !ChunkAPI?.isLoggedIn()) return;
  try {
    await ChunkAPI.request("/api/learning-sessions/" + encodeURIComponent(accessSessionId) + "/heartbeat", { method: "POST", body: JSON.stringify({ sequence: ++sequence }) });
  } catch (error) {
    clearInterval(heartbeat);
    heartbeat = null;
    fail(error);
  }
}
function render() {
  if (!current) return;
  const state = current.state;
  $("startButton").hidden = true;
  $("activityCard").hidden = false;
  $("progressLabel").textContent = state.completed ? "\u672C\u8282\u5B8C\u6210" : `\u7B2C ${state.index + 1} \u6B65`;
  $("progressBar").value = state.completed ? 1 : state.index / Math.max(1, current.stepCount || state.index + 1);
  footer.replaceChildren();
  if (state.completed) {
    body.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "\u8FD9\u8282\u5B8C\u6210\u4E86";
    const note = document.createElement("p");
    note.textContent = "\u6D41\u7A0B\u5B8C\u6210\u548C\u638C\u63E1\u60C5\u51B5\u5206\u5F00\u8BB0\u5F55\uFF1B\u5230\u671F\u540E\u53EF\u4EE5\u4ECE\u5B66\u4E60\u8BB0\u5F55\u8FDB\u5165\u590D\u4E60\u3002";
    ChunkAPI.request("/api/expression-courses/" + encodeURIComponent(courseId)).then((meta) => {
      if (!note.isConnected || !meta.progress) return;
      note.textContent = meta.progress.completed === meta.progress.total ? `\u5168\u90E8 ${meta.progress.total} \u4E2A\u5355\u5143\u5DF2\u5B8C\u6210\uFF01\u53EF\u4EE5\u8FD4\u56DE\u8BFE\u7A0B\u76EE\u5F55\u518D\u6B21\u7EC3\u4E60\uFF0C\u6216\u5728\u5230\u671F\u540E\u590D\u4E60\u3002` : `\u5DF2\u5B8C\u6210 ${meta.progress.completed} / ${meta.progress.total} \u4E2A\u5355\u5143\u3002\u53EF\u4EE5\u7EE7\u7EED\u4E0B\u4E00\u5355\u5143\uFF0C\u6216\u8FD4\u56DE\u8BFE\u7A0B\u76EE\u5F55\u3002`;
    }).catch(() => {
    });
    body.append(heading, note);
    const lessonIndex = courseLessons.findIndex((item) => item.lessonId === current.lessonId);
    const nextLesson = current.mode !== "review" && lessonIndex >= 0 ? courseLessons[lessonIndex + 1] : null;
    if (nextLesson) {
      const next = document.createElement("a");
      next.className = "button button-primary";
      const query = new URLSearchParams({ course: courseId, lesson: nextLesson.lessonId });
      query.set("returnTo", returnHref);
      next.href = "?" + query;
      next.textContent = "\u4E0B\u4E00\u8BFE\uFF1A" + nextLesson.title;
      body.append(next);
    }
    const back = document.createElement("a");
    back.className = "button " + (nextLesson ? "button-secondary" : "button-primary");
    window.CourseReturn.bind(back, { href: returnHref });
    body.append(back);
    setStatus("\u5B66\u4E60\u8FDB\u5EA6\u5DF2\u4FDD\u5B58\u3002");
    return;
  }
  const rendered = renderActivity(body, state.activity, { onAction: (action) => act(action), playAudio });
  if (rendered.informational && state.activity.payload?.audioAssetId) {
    const listen = document.createElement("button");
    listen.className = "button button-secondary";
    listen.type = "button";
    listen.textContent = "\u64AD\u653E\u793A\u8303";
    listen.onclick = () => playAudio(state.activity.payload.audioAssetId, listen);
    footer.append(listen);
  }
  if (state.revealed && state.revealedAnswer) {
    const answer = document.createElement("p");
    answer.className = "activity-answer";
    answer.textContent = "\u53C2\u8003\u7B54\u6848\uFF1A" + state.revealedAnswer;
    body.append(answer);
  }
  if (!rendered.speakingPractice && (rendered.informational || !rendered.autoSubmit)) {
    const primary = document.createElement("button");
    primary.className = "button button-primary";
    primary.type = "button";
    primary.textContent = rendered.informational ? "\u7EE7\u7EED" : "\u68C0\u67E5\u7B54\u6848";
    primary.onclick = () => act(rendered.informational ? { type: "continue" } : { type: "submit", response: rendered.response() });
    footer.append(primary);
  }
  if (rendered.speakingPractice) {
    const tried = document.createElement("button");
    tried.className = "button button-primary";
    tried.type = "button";
    tried.textContent = "\u6211\u5DF2\u5F00\u53E3\u7EC3\u4E60";
    tried.onclick = () => act({ type: "self_practiced" });
    footer.append(tried);
    const skip = document.createElement("button");
    skip.className = "button button-secondary";
    skip.type = "button";
    skip.textContent = "\u7A0D\u540E\u518D\u7EC3";
    skip.onclick = () => act({ type: "skip_practice" });
    footer.append(skip);
  }
  setStatus(current.result?.feedback || "\u5B8C\u6210\u5F53\u524D\u8FD9\u4E00\u6B65\u5373\u53EF\u81EA\u52A8\u4FDD\u5B58\u3002");
}
async function act(action) {
  if (busy || !current) return;
  const actionKey = JSON.stringify([current.sessionId, current.revision, action]);
  if (pendingActionRequest?.key !== actionKey) pendingActionRequest = { key: actionKey, requestId: requestId() };
  busy = true;
  footer.querySelectorAll("button").forEach((button) => button.setAttribute("disabled", ""));
  try {
    current = await ChunkAPI.request("/api/expression-sessions/" + encodeURIComponent(current.sessionId) + "/actions", {
      method: "POST",
      headers: accessSessionId ? { "X-Learning-Session": accessSessionId } : {},
      body: JSON.stringify({ requestId: pendingActionRequest.requestId, expectedRevision: current.revision, action })
    });
    pendingActionRequest = null;
    if (action.type === "audio_played") setStatus("\u97F3\u9891\u64AD\u653E\u5B8C\u6210\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u4F5C\u7B54\u3002");
    else render();
    return { status: "success" };
  } catch (error) {
    if (error.code === "REVISION_CONFLICT") {
      pendingActionRequest = null;
      try {
        current = await ChunkAPI.request("/api/expression-sessions/" + encodeURIComponent(current.sessionId), { headers: accessSessionId ? { "X-Learning-Session": accessSessionId } : {} });
        render();
      } catch (reloadError) {
        fail(reloadError);
      }
      return { status: "blocked", message: error.message || "\u5B66\u4E60\u8FDB\u5EA6\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u7EE7\u7EED\u3002" };
    } else {
      fail(error);
      const blocked = ["AUTHORIZATION_EXPIRED", "SESSION_EXPIRED", "TRIAL_EXPIRED", "TRIAL_DAILY_LIMIT", "MEMBERSHIP_REQUIRED", "SESSION_CHANGED"].includes(error?.code);
      return { status: blocked ? "blocked" : "retryable-error", message: failureMessage(error) };
    }
  } finally {
    busy = false;
    footer.querySelectorAll("button").forEach((button) => button.removeAttribute("disabled"));
  }
}
async function playAudio(assetId, button) {
  if (!assetId || !current) return;
  button.disabled = true;
  try {
    const url = `${ChunkAPI.getBase()}/api/expression-courses/${encodeURIComponent(courseId)}/releases/${encodeURIComponent(current.releaseId)}/assets/${encodeURIComponent(assetId)}`;
    const response = await fetch(url, { headers: { Authorization: "Bearer " + ChunkAPI.getToken(), ...accessSessionId ? { "X-Learning-Session": accessSessionId } : {} }, cache: "no-store" });
    if (!response.ok) throw new Error("\u97F3\u9891\u6682\u65F6\u65E0\u6CD5\u64AD\u653E\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    }
    const source = URL.createObjectURL(await response.blob());
    audio = new Audio(source);
    await audio.play();
    await act({ type: "audio_played" });
  } catch (error) {
    fail(error);
  } finally {
    button.disabled = false;
  }
}
window.addEventListener("pagehide", () => {
  if (heartbeat) clearInterval(heartbeat);
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
  }
  if (accessSessionId && ChunkAPI?.isLoggedIn()) ChunkAPI.request("/api/learning-sessions/" + encodeURIComponent(accessSessionId) + "/end", { method: "POST", body: JSON.stringify({ sequence: ++sequence }) }).catch(() => {
  });
});
if (!courseId) setStatus("\u8BFE\u7A0B\u5730\u5740\u65E0\u6548\u3002");
else start();
