/* Pure practice classification. Item lookup and SRS wiring stay in main.html. */
export function classifyStat(stat) {
  if (!stat || !stat.times) return 'unseen';
  const accuracy = stat.okTimes / stat.times;
  if (stat.times >= 3 && accuracy >= 0.8) return 'master';
  if (accuracy < 0.6) return 'weak';
  return 'learn';
}

export function rankOfClassify(classification) {
  return classification === 'weak' ? 0
    : classification === 'unseen' ? 1
      : classification === 'learn' ? 2 : 3;
}

export function isFluencyStat(stat) {
  return Boolean(stat && stat.okTimes >= 3 && stat.streak >= 3);
}

export function hasMasteredKey(mastered, key) {
  return Boolean(mastered && key && mastered[key]);
}

export function isDueStat(stat, isDue) {
  return typeof isDue === 'function' && isDue(stat) === true;
}
