/* Pure persistence signatures used by the core storage runtime. */

function mix(hash, value) {
  return Math.imul(hash ^ (value | 0), 0x01000193) >>> 0;
}
function mixText(hash, value) {
  const text = String(value == null ? '' : value);
  for (let index = 0; index < text.length; index += 1) hash = mix(hash, text.charCodeAt(index));
  return mix(hash, 0xff);
}

function statSig(value) {
  if (!value) return 0;
  let hash = 0x811c9dc5;
  hash = mix(hash, value.times || 0);
  hash = mix(hash, value.okTimes || 0);
  hash = mix(hash, value.wrongTimes || 0);
  hash = mix(hash, value.streak || 0);
  hash = mix(hash, value.maxStreak || 0);
  hash = mix(hash, value.interval || 0);
  hash = mix(hash, value.repetition || 0);
  hash = mix(hash, (value.ease || 0) * 1000);
  hash = mix(hash, value.dueAt || 0);
  hash = mix(hash, value.lastAt || 0);
  const learning = value.learningV1 && typeof value.learningV1 === 'object' ? value.learningV1 : {};
  hash = mix(hash, learning.version || 0);
  hash = mix(hash, learning.baselineAt || 0);
  hash = mix(hash, learning.lastExposureAt || 0);
  hash = mix(hash, learning.dueAt || 0);
  hash = mixText(hash, learning.phase || '');
  hash = mix(hash, learning.interval || 0);
  hash = mix(hash, learning.repetition || 0);
  hash = mix(hash, (learning.ease || 0) * 1000);
  (Array.isArray(learning.evidence) ? learning.evidence : []).forEach((event) => {
    hash = mixText(hash, event && event.id || '');
    hash = mixText(hash, event && event.key || '');
    hash = mixText(hash, event && event.sessionId || '');
    hash = mixText(hash, event && event.type || '');
    hash = mixText(hash, event && event.mode || '');
    hash = mixText(hash, event && event.contentFingerprint || '');
    hash = mixText(hash, event && event.stage || '');
    hash = mix(hash, event && event.policyVersion || 0);
    hash = mix(hash, event && event.at || 0);
    hash = mix(hash, event && event.ok ? 1 : 0);
    hash = mix(hash, event && event.assisted ? 1 : 0);
    hash = mix(hash, event && event.firstAttempt ? 1 : 0);
    hash = mix(hash, event && event.eligibleAt || 0);
  });
  return hash >>> 0;
}

function statsSig(stats) {
  if (!stats || typeof stats !== 'object') return '';
  const bySentence = stats.bySentence || {};
  let count = 0;
  let xor = 0;
  Object.keys(bySentence).forEach((key) => {
    count += 1;
    xor = (xor ^ statSig(bySentence[key])) >>> 0;
  });
  const events = Array.isArray(stats.events) ? stats.events : [];
  const last = events.length ? (events[events.length - 1] && events[events.length - 1].id) : '';
  return `${stats.totalRounds || 0}:${stats.totalAnswered || 0}:${count}:${xor}:${events.length}:${last}:${stats.daysLog ? Object.keys(stats.daysLog).length : 0}`;
}

function eventSnapshot(events) {
  const list = Array.isArray(events) ? events : [];
  return {
    count: list.length,
    firstId: list.length ? (list[0] && list[0].id) : null,
    lastId: list.length ? (list[list.length - 1] && list[list.length - 1].id) : null,
  };
}

export const CoreStatsSignature = Object.freeze({ statSig, statsSig, eventSnapshot });
