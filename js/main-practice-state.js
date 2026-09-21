var MainPracticeState = (() => {
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

  // scripts/main-practice-state-entry.mjs
  var main_practice_state_entry_exports = {};
  __export(main_practice_state_entry_exports, {
    buildRevealPlan: () => buildRevealPlan,
    buildSentenceOutcome: () => buildSentenceOutcome,
    createPracticeState: () => createPracticeState
  });

  // src/main/practice-state.mjs
  function createPracticeState(overrides = {}) {
    return Object.assign({
      deck: null,
      items: [],
      idx: 0,
      chunkIdx: 0,
      status: [],
      answers: [],
      wrongAttempts: [],
      wrongAnswers: [],
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      chunkTotal: 0,
      chunkRight: 0,
      wrong: [],
      sessionByDeck: {},
      finished: false,
      _finishing: false,
      perfectThis: true,
      hinted: false,
      _hintedChunks: [],
      contentBatch: null,
      tempTotal: 0,
      tempStart: 0,
      tempEnd: 0
    }, overrides);
  }
  function buildSentenceOutcome(options = {}) {
    const wrongAttempts = Array.isArray(options.wrongAttempts) ? options.wrongAttempts : [];
    const status = Array.isArray(options.status) ? options.status : [];
    const hinted = options.hinted === true;
    const answers = Array.isArray(options.answers) ? options.answers : [];
    const wrongAnswers = Array.isArray(options.wrongAnswers) ? options.wrongAnswers : [];
    const totalWrong = wrongAttempts.reduce((sum, count) => sum + (count || 0), 0);
    const needsReview = totalWrong >= 2 || hinted;
    const hadIssue = totalWrong > 0 || hinted || status.some((value) => value === "bad" || value === "revealed");
    const wrongIdx = [];
    wrongAttempts.forEach((count, index) => {
      if ((count || 0) > 0 || status[index] === "bad" || status[index] === "revealed") wrongIdx.push(index);
    });
    const existingWrong = Array.isArray(options.existingWrong) ? options.existingWrong : [];
    const shouldRecord = hadIssue && !existingWrong.some((entry) => entry && entry.it === options.item);
    const wrongEntry = shouldRecord ? {
      it: options.item,
      idx: wrongIdx,
      answers: answers.slice(),
      wrongAnswers: wrongAnswers.map((list) => Array.isArray(list) ? list.slice() : []),
      needsReview
    } : null;
    return { totalWrong, needsReview, hadIssue, wrongIdx, shouldRecord, wrongEntry };
  }
  function buildRevealPlan(status, chunkIdx, revealAll = false) {
    const states = Array.isArray(status) ? status : [];
    const isUnanswered = (value) => value !== "ok" && value !== "bad" && value !== "revealed";
    if (revealAll) {
      return { indices: states.map((value, index) => isUnanswered(value) ? index : -1).filter((index) => index >= 0) };
    }
    const current = Number.isInteger(chunkIdx) ? chunkIdx : 0;
    if (current >= 0 && current < states.length && isUnanswered(states[current])) return { indices: [current] };
    const next = states.findIndex(isUnanswered);
    return { indices: next >= 0 ? [next] : [] };
  }
  return __toCommonJS(main_practice_state_entry_exports);
})();
