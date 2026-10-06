import { LEARNING_DAY_MS } from './state.mjs';

export const RELEARN_DELAY_MS = 10 * 60 * 1000;
export const FAMILIAR_DELAY_MS = 3 * LEARNING_DAY_MS;

/** @param {any} previous @param {any} result @param {any} options */
export function scheduleLearningResult(previous = {}, result = {}, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const record = previous && typeof previous === 'object' ? previous : {};
  const dueAt = Number(record.dueAt) || 0;
  const isDue = !dueAt || dueAt <= now;
  if (!result.ok || result.assisted) {
    const reset = options.srs && typeof options.srs.recordResult === 'function'
      ? options.srs.recordResult(record, false, now)
      : { ...record, interval: 1, repetition: 0 };
    return { ...record, ...reset, version: 1, phase: 'relearning', dueAt: now + RELEARN_DELAY_MS, lastExposureAt: now };
  }
  if (result.earlyPractice && !isDue) {
    return { ...record, version: 1, phase: record.phase || 'review', dueAt, lastExposureAt: now };
  }
  const srs = options.srs;
  if (!srs || typeof srs.recordResult !== 'function') throw new TypeError('SRS scheduler is required for a due successful review');
  const next = srs.recordResult(record, true, now);
  return { ...record, ...next, version: 1, phase: 'review', lastExposureAt: now };
}

/** @param {any} previous @param {any} options */
export function scheduleFamiliarity(previous = {}, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const record = previous && typeof previous === 'object' ? previous : {};
  if (Number(record.dueAt)) return { ...record, version: 1 };
  const markedAt = Number(options.markedAt) || now;
  return { ...record, version: 1, phase: 'review', dueAt: markedAt + FAMILIAR_DELAY_MS };
}

export function getExposureAt(stat = {}, learning = {}) {
  return Math.max(Number(learning.lastExposureAt) || 0, Number(learning.baselineAt) || 0, Number(stat.lastAt) || 0);
}
