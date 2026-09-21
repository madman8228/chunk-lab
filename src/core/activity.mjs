/* Pure activity and streak calculations. No storage, DOM, or global state. */
export function normalizedAnsweredTotal(input) {
  const stats = (input && typeof input === 'object') ? input : {};
  const by = (stats.bySentence && typeof stats.bySentence === 'object') ? stats.bySentence : {};
  const events = Array.isArray(stats.events) ? stats.events : [];
  let sentenceAnswered = 0, eventAnswered = 0;
  const seen = {};
  Object.keys(by).forEach((key) => {
    const count = Number(by[key] && by[key].times);
    if (Number.isFinite(count) && count > 0) sentenceAnswered += count;
  });
  events.forEach((event) => {
    if (!event || event.kind !== 'answer') return;
    if (event.id) { if (seen[event.id]) return; seen[event.id] = true; }
    eventAnswered += 1;
  });
  const stored = Math.max(0, Number(stats.totalAnswered) || 0);
  const detail = Math.max(sentenceAnswered, eventAnswered);
  if (detail <= 0) return stored;
  const legacyWindow = Math.max(32, Math.ceil(Math.max(stored, detail) * 0.25));
  if (sentenceAnswered > stored + legacyWindow && eventAnswered <= stored + legacyWindow) return Math.max(stored, eventAnswered);
  if (stored > detail + legacyWindow) return detail;
  return Math.max(stored, detail);
}

export function ymd(value) {
  const date = value instanceof Date ? value : new Date();
  const pad = (number) => number < 10 ? '0' + number : '' + number;
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

export function answerStatsAudit(mem) {
  const stats = (mem && mem.stats) || {}, by = stats.bySentence || {};
  const events = Array.isArray(stats.events) ? stats.events : [], seen = new Set();
  let sentenceAnswered = 0, eventAnswered = 0, datedAnswered = 0;
  Object.keys(by).forEach((key) => {
    const count = Number(by[key] && by[key].times);
    if (Number.isFinite(count) && count > 0) sentenceAnswered += count;
  });
  events.forEach((event) => {
    if (!event || event.kind !== 'answer') return;
    if (event.id && seen.has(event.id)) return;
    if (event.id) seen.add(event.id);
    eventAnswered += 1;
    if (event.at && !Number.isNaN(new Date(event.at).getTime())) datedAnswered += 1;
  });
  const storedAnswered = Math.max(0, Number(stats.totalAnswered) || 0);
  const totalAnswered = normalizedAnsweredTotal(stats);
  return {
    totalAnswered, storedAnswered, sentenceAnswered, eventAnswered, datedAnswered,
    undatedAnswered: Math.max(0, totalAnswered - datedAnswered),
    legacyAnswered: Math.max(0, totalAnswered - eventAnswered),
    hasMismatch: storedAnswered !== sentenceAnswered || datedAnswered !== totalAnswered,
  };
}

export function dailyActivity(mem) {
  const stats = (mem && mem.stats) || {}, days = {}, seen = new Set();
  Object.keys(stats.daysLog || {}).forEach((key) => {
    days[key] = { answered: 0, rounds: Math.max(0, Number((stats.daysLog[key] || {}).rounds) || 0) };
  });
  const rounds = {};
  (Array.isArray(stats.events) ? stats.events : []).forEach((event) => {
    if (!event || !event.at || (event.kind !== 'answer' && event.kind !== 'round')) return;
    if (event.id && seen.has(event.id)) return;
    const date = new Date(event.at);
    if (Number.isNaN(date.getTime())) return;
    if (event.id) seen.add(event.id);
    const key = ymd(date), day = days[key] || (days[key] = { answered: 0, rounds: 0 });
    if (event.kind === 'answer') day.answered += 1;
    else rounds[key] = (rounds[key] || 0) + 1;
  });
  Object.keys(rounds).forEach((key) => { days[key].rounds = Math.max(days[key].rounds, rounds[key]); });
  return days;
}

export function streakDays(mem, now) {
  const log = dailyActivity(mem);
  const date = now instanceof Date ? new Date(now.getTime()) : new Date();
  let count = 0;
  const today = ymd(date);
  if (log[today] && (log[today].answered || log[today].rounds)) count += 1;
  date.setDate(date.getDate() - 1);
  for (let index = 0; index < 3650; index += 1) {
    const key = ymd(date), value = log[key] && (log[key].answered || log[key].rounds) || 0;
    if (!value) break;
    count += 1;
    date.setDate(date.getDate() - 1);
  }
  return count;
}

export function todayRounds(mem, now) {
  const log = (mem && mem.stats && mem.stats.daysLog) || {};
  const date = now instanceof Date ? now : new Date();
  return (log[ymd(date)] && log[ymd(date)].rounds) || 0;
}

export function bumpDaysLog(mem, now) {
  if (!mem.stats) mem.stats = { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [], daysLog: {} };
  if (!mem.stats.daysLog) mem.stats.daysLog = {};
  const key = ymd(now instanceof Date ? now : new Date());
  const slot = mem.stats.daysLog[key] || { rounds: 0 };
  slot.rounds = (Number(slot.rounds) || 0) + 1;
  mem.stats.daysLog[key] = slot;
  return slot.rounds;
}

export function backfillDaysLog(mem) {
  if (!mem || !mem.stats) return 0;
  const events = Array.isArray(mem.stats.events) ? mem.stats.events : [];
  if (!events.length) return 0;
  if (!mem.stats.daysLog || typeof mem.stats.daysLog !== 'object') mem.stats.daysLog = {};
  if (Object.keys(mem.stats.daysLog).length > 0) return 0;
  const counts = {};
  events.forEach((event) => {
    if (!event || event.kind !== 'round' || !event.at) return;
    const date = new Date(event.at);
    if (Number.isNaN(date.getTime())) return;
    const key = ymd(date);
    counts[key] = (counts[key] || 0) + 1;
  });
  Object.keys(counts).forEach((key) => { mem.stats.daysLog[key] = { rounds: counts[key] }; });
  return Object.keys(counts).length;
}

export const CoreActivity = Object.freeze({ normalizedAnsweredTotal, ymd, answerStatsAudit, dailyActivity, streakDays, todayRounds, bumpDaysLog, backfillDaysLog });
