export function nextReview({ success, step = 0, now = Date.now(), intervals = [1, 3, 7, 14, 30] }) {
  const nextStep = success ? Math.min(step + 1, intervals.length - 1) : 0;
  const days = success ? intervals[nextStep] : intervals[0];
  return { step: nextStep, dueAt: now + days * 86400000, intervalDays: days };
}
