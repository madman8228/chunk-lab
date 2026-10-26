// Both display levels share the same explicitly authored round boundary.
export function displayBoundary(sequence, index, solved) {
  const completedIndex = solved ? index : index - 1;
  return sequence.findLastIndex((step, position) =>
    (position <= index && step.clearSentenceResultOnStart) ||
    (position <= completedIndex && step.clearSentenceResultOnComplete));
}

export function isBuildHistory(step) {
  return !step.type || step.type === 'compose';
}
