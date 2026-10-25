export function normalizeAnswer(value, { caseSensitive = false, punctuationSensitive = false } = {}) {
  let result = String(value ?? '').normalize('NFKC').replace(/[’‘`]/g, "'").trim().replace(/\s+/g, ' ');
  if (!caseSensitive) result = result.toLocaleLowerCase('en-US');
  if (!punctuationSensitive) result = result.replace(/[.!?。！？]+$/g, '').trim();
  return result;
}

export function evaluateActivity(activity, response) {
  if (activity.type === 'sentence_build' || activity.type === 'grapheme_build') {
    const tokens = Array.isArray(response?.tokens) ? response.tokens : [];
    const expected = activity.payload.correctTokens || [];
    return { correct: tokens.length === expected.length && tokens.every((token, index) => token === expected[index]), kind: activity.type === 'grapheme_build' ? 'graphemes' : 'tokens' };
  }
  if (activity.type === 'listening_choice') {
    return { correct: response?.optionId === activity.evaluation.correctOptionId, kind: 'choice' };
  }
  if (['substitution', 'independent_output', 'transfer_test'].includes(activity.type)) {
    const accepted = activity.evaluation.acceptedAnswers || [];
    const options = { caseSensitive: activity.evaluation.caseSensitive, punctuationSensitive: activity.evaluation.punctuationSensitive };
    const answer = normalizeAnswer(response?.text, options);
    return { correct: !!answer && accepted.some(value => normalizeAnswer(value, options) === answer), kind: 'text' };
  }
  return { correct: false, kind: 'unsupported' };
}
