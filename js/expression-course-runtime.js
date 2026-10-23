var ExpressionCourseRuntime = (() => {
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

  // scripts/expression-course-runtime-entry.mjs
  var expression_course_runtime_entry_exports = {};
  __export(expression_course_runtime_entry_exports, {
    createExpressionState: () => createExpressionState,
    evaluateActivity: () => evaluateActivity,
    nextReview: () => nextReview,
    normalizeAnswer: () => normalizeAnswer,
    publicExpressionState: () => publicExpressionState,
    transitionExpression: () => transitionExpression
  });

  // src/expression-course/evaluate.mjs
  function normalizeAnswer(value, { caseSensitive = false, punctuationSensitive = false } = {}) {
    let result = String(value ?? "").normalize("NFKC").replace(/[’‘`]/g, "'").trim().replace(/\s+/g, " ");
    if (!caseSensitive) result = result.toLocaleLowerCase("en-US");
    if (!punctuationSensitive) result = result.replace(/[.!?。！？]+$/g, "").trim();
    return result;
  }
  function evaluateActivity(activity, response) {
    if (activity.type === "sentence_build") {
      const tokens = Array.isArray(response?.tokens) ? response.tokens : [];
      const expected = activity.payload.correctTokens || [];
      return { correct: tokens.length === expected.length && tokens.every((token, index) => token === expected[index]), kind: "tokens" };
    }
    if (activity.type === "listening_choice") {
      return { correct: response?.optionId === activity.evaluation.correctOptionId, kind: "choice" };
    }
    if (["substitution", "independent_output", "transfer_test"].includes(activity.type)) {
      const accepted = activity.evaluation.acceptedAnswers || [];
      const options = { caseSensitive: activity.evaluation.caseSensitive, punctuationSensitive: activity.evaluation.punctuationSensitive };
      const answer = normalizeAnswer(response?.text, options);
      return { correct: !!answer && accepted.some((value) => normalizeAnswer(value, options) === answer), kind: "text" };
    }
    return { correct: false, kind: "unsupported" };
  }

  // src/expression-course/runtime.mjs
  var copy = (value) => structuredClone(value);
  var activityAnswer = (activity) => activity?.evaluation?.acceptedAnswers?.[0] || activity?.payload?.correctTokens?.join(" ") || activity?.evaluation?.correctOptionId || "";
  var safeActivity = (activity) => {
    if (!activity) return null;
    const { evaluation, ...visible } = copy(activity);
    const { correctTokens, ...payload } = visible.payload || {};
    if (visible.type === "sentence_build") payload.expectedTokenCount = Array.isArray(correctTokens) ? correctTokens.length : 0;
    if (["substitution", "independent_output", "transfer_test"].includes(visible.type)) {
      const answer = evaluation?.acceptedAnswers?.[0]?.trim();
      if (answer) payload.expectedWordCount = answer.split(/\s+/).length;
    }
    return { ...visible, payload };
  };
  var expose = (state) => ({
    index: state.index,
    completed: state.index >= state.activities.length,
    activity: safeActivity(state.activities[state.index]),
    attempts: state.attempts,
    hints: state.hints,
    revealed: state.revealed,
    revealedAnswer: state.revealed ? state.revealedAnswer || activityAnswer(state.activities[state.index]) : null,
    evidence: copy(state.evidence),
    firstResults: copy(state.firstResults)
  });
  function createExpressionState(lesson, saved = null) {
    if (saved) {
      if (saved.lessonId !== lesson.lessonId || !Array.isArray(saved.activities) || saved.activities.length !== lesson.activities.length) throw new Error("\u5B66\u4E60\u8BB0\u5F55\u4E0E\u8BFE\u7A0B\u7248\u672C\u4E0D\u5339\u914D");
      return copy(saved);
    }
    return {
      lessonId: lesson.lessonId,
      activities: lesson.activities,
      index: 0,
      attempts: 0,
      hints: false,
      revealed: false,
      revealedAnswer: null,
      firstResults: {},
      evidence: {},
      completed: false
    };
  }
  function publicExpressionState(state) {
    return expose(state);
  }
  function transitionExpression(state, action, { now = Date.now() } = {}) {
    const next = copy(state);
    const activity = next.activities[next.index];
    if (!activity) return { state: next, result: { kind: "completed" } };
    if (!action || typeof action.type !== "string") throw new Error("\u5B66\u4E60\u64CD\u4F5C\u65E0\u6548");
    if (action.type === "hint") {
      next.hints = true;
      return { state: next, result: { kind: "hint", hint: activity.payload.hint || activity.prompt } };
    }
    if (action.type === "reveal") {
      next.revealed = true;
      next.revealedAnswer = activityAnswer(activity);
      return { state: next, result: { kind: "revealed", answer: next.revealedAnswer } };
    }
    if (action.type === "audio_played") return { state: next, result: { kind: "audio_played", verified: false } };
    if (action.type === "skip_audio") {
      if (activity.type !== "listening_choice") throw new Error("\u5F53\u524D\u7EC3\u4E60\u4E0D\u80FD\u8DF3\u8FC7\u97F3\u9891");
      advance(next);
      return { state: next, result: { kind: "skipped", correct: false } };
    }
    if (action.type === "skip_output") {
      if (!["independent_output", "transfer_test"].includes(activity.type)) throw new Error("\u5F53\u524D\u7EC3\u4E60\u4E0D\u80FD\u8DF3\u8FC7\u6587\u5B57\u8F93\u51FA");
      advance(next);
      return { state: next, result: { kind: "skipped", correct: false, evidenceRecorded: false } };
    }
    if (action.type === "continue") {
      if (!["meaning_intro", "micro_explanation"].includes(activity.type)) throw new Error("\u5F53\u524D\u7EC3\u4E60\u9700\u8981\u4F5C\u7B54");
      advance(next);
      return { state: next, result: { kind: "continued", correct: null } };
    }
    if (action.type !== "submit") throw new Error("\u5B66\u4E60\u64CD\u4F5C\u4E0D\u652F\u6301");
    const evaluated = evaluateActivity(activity, action.response);
    const key = activity.id;
    const first = next.firstResults[key] === void 0;
    if (first) next.firstResults[key] = { correct: evaluated.correct, exposed: next.hints || next.revealed, stage: activity.stage };
    next.attempts += 1;
    const independent = first && evaluated.correct && !next.hints && !next.revealed && activity.stage === "independent";
    if (independent) for (const id of activity.skillIds) (next.evidence[id] ||= { independent: false, transfer: false, listening: false })[activity.type === "transfer_test" ? "transfer" : activity.type === "listening_choice" ? "listening" : "independent"] = true;
    const feedback = evaluated.correct ? "\u7B54\u5BF9\u4E86" : next.attempts >= 3 ? "\u53EF\u4EE5\u770B\u63D0\u793A\uFF0C\u518D\u7EE7\u7EED\u7EC3\u4E60" : "\u518D\u8BD5\u4E00\u6B21";
    if (evaluated.correct || next.attempts >= 3) advance(next);
    const masteredSkills = Object.entries(next.evidence).filter(([, evidence]) => evidence.independent && evidence.transfer && evidence.listening).map(([id]) => id);
    next.completed = next.index >= next.activities.length;
    return { state: next, result: { kind: "answer", correct: evaluated.correct, first, independent, feedback, masteredSkills, now } };
  }
  function advance(state) {
    state.index += 1;
    state.attempts = 0;
    state.hints = false;
    state.revealed = false;
    state.revealedAnswer = null;
    state.completed = state.index >= state.activities.length;
  }

  // src/expression-course/schedule.mjs
  function nextReview({ success, step = 0, now = Date.now(), intervals = [1, 3, 7, 14, 30] }) {
    const nextStep = success ? Math.min(step + 1, intervals.length - 1) : 0;
    const days = success ? intervals[nextStep] : intervals[0];
    return { step: nextStep, dueAt: now + days * 864e5, intervalDays: days };
  }
  return __toCommonJS(expression_course_runtime_entry_exports);
})();
