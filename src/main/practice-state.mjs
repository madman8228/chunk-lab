/* Default in-memory practice session shape. Persistence and DOM remain outside this module. */
export function createPracticeState(overrides = {}) {
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
    tempEnd: 0,
  }, overrides);
}

/* Calculate the stable facts needed when one sentence is completed.
   DOM feedback, persistence and the user's existing wrong-book entries stay outside. */
export function buildSentenceOutcome(options = {}) {
  const wrongAttempts = Array.isArray(options.wrongAttempts) ? options.wrongAttempts : [];
  const status = Array.isArray(options.status) ? options.status : [];
  const hinted = options.hinted === true;
  const answers = Array.isArray(options.answers) ? options.answers : [];
  const wrongAnswers = Array.isArray(options.wrongAnswers) ? options.wrongAnswers : [];
  const totalWrong = wrongAttempts.reduce((sum, count) => sum + (count || 0), 0);
  const needsReview = totalWrong >= 2 || hinted;
  const hadIssue = totalWrong > 0 || hinted || status.some((value) => value === 'bad' || value === 'revealed');
  const wrongIdx = [];
  wrongAttempts.forEach((count, index) => {
    if ((count || 0) > 0 || status[index] === 'bad' || status[index] === 'revealed') wrongIdx.push(index);
  });
  const existingWrong = Array.isArray(options.existingWrong) ? options.existingWrong : [];
  const shouldRecord = hadIssue && !existingWrong.some((entry) => entry && entry.it === options.item);
  const wrongEntry = shouldRecord ? {
    it: options.item,
    idx: wrongIdx,
    answers: answers.slice(),
    wrongAnswers: wrongAnswers.map((list) => Array.isArray(list) ? list.slice() : []),
    needsReview,
  } : null;
  return { totalWrong, needsReview, hadIssue, wrongIdx, shouldRecord, wrongEntry };
}

/* Select which chunks a reveal action should affect. The caller performs DOM/state writes. */
export function buildRevealPlan(status, chunkIdx, revealAll = false) {
  const states = Array.isArray(status) ? status : [];
  const isUnanswered = (value) => value !== 'ok' && value !== 'bad' && value !== 'revealed';
  if (revealAll) {
    return { indices: states.map((value, index) => isUnanswered(value) ? index : -1).filter((index) => index >= 0) };
  }
  const current = Number.isInteger(chunkIdx) ? chunkIdx : 0;
  if (current >= 0 && current < states.length && isUnanswered(states[current])) return { indices: [current] };
  const next = states.findIndex(isUnanswered);
  return { indices: next >= 0 ? [next] : [] };
}
