import { applyLearningEvent, createLearningEvent } from './state.mjs';
import { scheduleLearningResult } from './schedule-policy.mjs';

const ordered = (events) => events.slice().sort((left, right) => left.at - right.at || String(left.id).localeCompare(String(right.id)));

/* Rebuild one sentence's projection from its immutable legacy baseline and
 * accepted learning events. Stable ordering makes late/offline arrivals
 * converge to the same SRS state on every server replay. */
export function reducePracticeEvents(baseline = {}, events = [], options = {}) {
  const stat = { ...(baseline && typeof baseline === 'object' ? baseline : {}) };
  delete stat.sentence;
  const baseLearning = stat.learningV1 && typeof stat.learningV1 === 'object' ? stat.learningV1 : {};
  let learning = {
    version: 1, evidence: [], baselineAt: Number(stat.lastAt) || 0,
    lastExposureAt: Number(stat.lastAt) || 0,
    interval: Number(stat.interval) || 1, ease: Number(stat.ease) || 2.5,
    repetition: Number(stat.repetition) || 0, ...baseLearning
  };
  let streak = Number(stat.streak) || 0;
  let maxStreak = Number(stat.maxStreak) || 0;
  let times = Number(stat.times) || 0;
  let okTimes = Number(stat.okTimes) || 0;
  let wrongTimes = Number(stat.wrongTimes) || 0;
  let lastAt = Number(stat.lastAt) || 0;
  const accepted = ordered(events);

  accepted.forEach((source) => {
    const event = createLearningEvent({
      makeId: () => source.id,
      key: source.key,
      sessionId: source.sessionId || source.id,
      at: source.at,
      type: ['exposure', 'assessment'].includes(source.type) ? source.type : 'practice',
      mode: source.mode || 'unknown',
      contentFingerprint: source.contentFingerprint || '',
      policyVersion: source.policyVersion || 1,
      ok: source.ok === true,
      assisted: source.assisted === true,
      firstAttempt: source.firstAttempt === true,
      eligibleAt: source.eligibleAt,
      stage: source.stage
    });
    const before = learning;
    learning = applyLearningEvent(learning, event);
    if (event.type === 'exposure') return;
    if (event.type === 'assessment') {
      const schedule = event.ok ? {} : scheduleLearningResult(before, { ok: false, assisted: false }, { now: source.at, srs: options.srs });
      learning = { ...learning, ...schedule, evidence: learning.evidence,
        lastExposureAt: Math.max(Number(learning.lastExposureAt) || 0, source.at) };
      return;
    }
    const schedule = scheduleLearningResult(before, {
      ok: event.ok, assisted: event.assisted, earlyPractice: source.earlyPractice === true
    }, { now: source.at, srs: options.srs });
    learning = { ...learning, ...schedule, evidence: learning.evidence, lastExposureAt: Math.max(Number(learning.lastExposureAt) || 0, source.at) };
    times += 1;
    if (event.ok) {
      okTimes += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      wrongTimes += 1;
      streak = 0;
    }
    lastAt = Math.max(lastAt, source.at);
  });

  return {
    stat: {
      ...stat,
      times, okTimes, wrongTimes, streak, maxStreak, lastAt,
      interval: Number(learning.interval) || Number(stat.interval) || 1,
      ease: Number(learning.ease) || Number(stat.ease) || 2.5,
      repetition: Number(learning.repetition) || 0,
      dueAt: Number(learning.dueAt) || 0,
      learningV1: learning
    },
    eventCount: accepted.length
  };
}
