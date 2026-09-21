/* Pure persistence signatures used by the core storage runtime. */

function mix(hash, value) {
  return Math.imul(hash ^ (value | 0), 0x01000193) >>> 0;
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
