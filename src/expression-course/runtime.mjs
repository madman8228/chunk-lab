import { evaluateActivity } from './evaluate.mjs';

const copy = value => structuredClone(value);
const activityAnswer = activity => activity?.evaluation?.acceptedAnswers?.[0] || activity?.payload?.correctTokens?.join(activity.type === 'grapheme_build' ? '' : ' ') || activity?.evaluation?.correctOptionId || '';
const safeActivity = (activity, revealed = false, isV11 = false) => {
  if (!activity) return null;
  const { evaluation, ...visible } = copy(activity);
  const { correctTokens, referenceText, ...payload } = visible.payload || {};
  if (visible.type === 'sentence_build' || visible.type === 'grapheme_build') payload.expectedTokenCount = Array.isArray(correctTokens) ? correctTokens.length : 0;
  if (visible.type === 'speaking_practice' && revealed) payload.referenceText = referenceText;
  if (['substitution', 'independent_output', 'transfer_test'].includes(visible.type) && !isV11) {
    const answer = evaluation?.acceptedAnswers?.[0]?.trim();
    if (answer) payload.expectedWordCount = answer.split(/\s+/).length;
  }
  return { ...visible, payload };
};
const expose = state => ({
  index: state.index, completed: state.index >= state.activities.length,
  activity: safeActivity(state.activities[state.index], state.revealed, state.schemaVersion === '1.1'),
  attempts: state.attempts, hints: state.hints, revealed: state.revealed,
  revealedAnswer: state.revealed ? state.revealedAnswer || activityAnswer(state.activities[state.index]) : null,
  evidence: copy(state.evidence), firstResults: copy(state.firstResults)
});

export function createExpressionState(lesson, saved = null) {
  if (saved) {
    if (saved.lessonId !== lesson.lessonId || !Array.isArray(saved.activities) || saved.activities.length !== lesson.activities.length) throw new Error('学习记录与课程版本不匹配');
    return copy(saved);
  }
  return { lessonId: lesson.lessonId, schemaVersion: lesson.schemaVersion || '1.0', activities: lesson.activities, index: 0, attempts: 0, hints: false, revealed: false,
    revealedAnswer: null, firstResults: {}, evidence: {}, practiceEvidence: {}, activityEvidence: {}, completed: false };
}

export function publicExpressionState(state) { return expose(state); }

export function transitionExpression(state, action, { now = Date.now() } = {}) {
  const next = copy(state);
  const activity = next.activities[next.index];
  if (!activity) return { state: next, result: { kind: 'completed' } };
  if (!action || typeof action.type !== 'string') throw new Error('学习操作无效');
  if (action.type === 'hint') { next.hints = true; return { state: next, result: { kind: 'hint', hint: activity.payload.hint || activity.prompt } }; }
  if (action.type === 'reveal') { next.revealed = true; next.revealedAnswer = activity.type === 'speaking_practice' ? activity.payload.referenceText : activityAnswer(activity); return { state: next, result: { kind: 'revealed', answer: next.revealedAnswer } }; }
  if (action.type === 'self_practiced' || action.type === 'skip_practice') {
    if (activity.type !== 'speaking_practice' || next.schemaVersion !== '1.1') throw new Error('当前练习不支持口头自练操作');
    const selfReported = action.type === 'self_practiced';
    next.practiceEvidence[activity.id] = { selfReported, evidenceRecorded: false };
    next.activityEvidence[activity.id] = { activityId: activity.id, type: activity.type, firstCorrect: null,
      usedHint: false, revealed: next.revealed, selfReported };
    advance(next);
    return { state: next, result: { kind: 'practice', correct: null, evidenceRecorded: false, selfReported, completed: next.completed } };
  }
  if (action.type === 'audio_played') return { state: next, result: { kind: 'audio_played', verified: false } };
  if (action.type === 'skip_audio') {
    if (activity.type !== 'listening_choice') throw new Error('当前练习不能跳过音频');
    advance(next); return { state: next, result: { kind: 'skipped', correct: false } };
  }
  if (action.type === 'skip_output') {
    if (!['independent_output', 'transfer_test'].includes(activity.type)) throw new Error('当前练习不能跳过文字输出');
    advance(next); return { state: next, result: { kind: 'skipped', correct: false, evidenceRecorded: false } };
  }
  if (action.type === 'continue') {
    if (!['meaning_intro', 'micro_explanation', 'sound_demo'].includes(activity.type)) throw new Error('当前练习需要作答');
    advance(next); return { state: next, result: { kind: 'continued', correct: null } };
  }
  if (action.type !== 'submit') throw new Error('学习操作不支持');
  const evaluated = evaluateActivity(activity, action.response);
  const key = activity.id;
  const first = next.firstResults[key] === undefined;
  if (first) next.firstResults[key] = { correct: evaluated.correct, exposed: next.hints || next.revealed, stage: activity.stage };
  next.attempts += 1;
  if (next.schemaVersion === '1.1') next.activityEvidence[key] = { activityId: key, type: activity.type,
    questionKind: activity.payload.questionKind || null, firstCorrect: first ? evaluated.correct : next.activityEvidence[key]?.firstCorrect ?? null,
    usedHint: Boolean(next.hints), revealed: Boolean(next.revealed), selfReported: false };
  const independent = first && evaluated.correct && !next.hints && !next.revealed && activity.stage === 'independent';
  if (independent && next.schemaVersion !== '1.1') for (const id of activity.skillIds) (next.evidence[id] ||= { independent: false, transfer: false, listening: false })[
    activity.type === 'transfer_test' ? 'transfer' : activity.type === 'listening_choice' ? 'listening' : 'independent'] = true;
  const feedback = evaluated.correct ? '答对了' : next.attempts >= 3 ? '可以看提示，再继续练习' : '再试一次';
  if (evaluated.correct || next.attempts >= 3) advance(next);
  const masteredSkills = next.schemaVersion === '1.1' ? [] : Object.entries(next.evidence).filter(([, evidence]) => evidence.independent && evidence.transfer && evidence.listening).map(([id]) => id);
  next.completed = next.index >= next.activities.length;
  return { state: next, result: { kind: 'answer', correct: evaluated.correct, first, independent, feedback, masteredSkills, now } };
}

function advance(state) {
  state.index += 1; state.attempts = 0; state.hints = false; state.revealed = false; state.revealedAnswer = null;
  state.completed = state.index >= state.activities.length;
}
