'use strict';

const srs = require('../../srs.js');
const RELEARN_DELAY_MS = 10 * 60 * 1000;
const REVIEWABLE_PRACTICES = new Set(['sentence-cloze', 'guided-expression', 'word-choice', 'chunk-order', 'word-dictation']);
const IDENTITY_FIELDS = ['owner', 'resourceId', 'itemId', 'contentRevision', 'practiceType', 'practiceRevision'];

function identityForAttempt(value = {}) {
  if (!REVIEWABLE_PRACTICES.has(value.practiceType)) return null;
  if (IDENTITY_FIELDS.some(key => value[key] === undefined || value[key] === null || value[key] === '')) return null;
  if (!String(value.resourceId).startsWith('wordbook:')) return null;
  return JSON.stringify(IDENTITY_FIELDS.map(key => String(value[key])));
}

function eventTime(event) { return Number(event?.at) || Number(event?.occurredAt) || 0; }
function eventId(event) { return String(event?.id || event?.eventId || ''); }
function eventOrder(left, right) { return eventTime(left) - eventTime(right) || eventId(left).localeCompare(eventId(right)); }
function eventDay(event) {
  const at = eventTime(event);
  if (!at) return '';
  const zone = typeof event.timeZone === 'string' && event.timeZone ? event.timeZone : 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
    const part = type => parts.find(value => value.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch (_) { return ''; }
}

function deriveAbilityState(input = [], { now = Date.now() } = {}) {
  const rows = (Array.isArray(input) ? input : []).filter(event => identityForAttempt(event)).slice().sort(eventOrder);
  if (!rows.length) return null;
  const issues = rows.filter(event => event.correct === false || event.assisted === true);
  const lastIssue = issues.at(-1);
  const afterIssue = lastIssue ? rows.filter(event => eventTime(event) > eventTime(lastIssue)) : [];
  const successfulDays = new Map();
  const successfulSessions = new Set();
  afterIssue.forEach(event => {
    if (event.correct !== true || event.assisted === true || event.firstAttempt !== true || !event.reviewSessionId) return;
    const day = eventDay(event), sessionId = String(event.reviewSessionId);
    if (day && !successfulDays.has(day) && !successfulSessions.has(sessionId)) {
      successfulDays.set(day, event);
      successfulSessions.add(sessionId);
    }
  });

  let schedule = null;
  if (lastIssue) {
    schedule = { interval: 1, repetition: 0, ease: 2.5, dueAt: eventTime(lastIssue) + RELEARN_DELAY_MS };
    [...successfulDays.values()].sort(eventOrder).forEach(event => {
      schedule = srs.recordResult(schedule, true, eventTime(event));
    });
  }
  const dueAt = Number(schedule?.dueAt) || 0;
  return {
    status: successfulDays.size >= 2 ? 'reinforced' : 'needs-reinforcement',
    successDays: successfulDays.size,
    dueAt,
    due: dueAt > 0 && dueAt <= now,
    wrongCount: issues.filter(event => event.correct === false).length,
    lastIssueAt: lastIssue ? eventTime(lastIssue) : 0,
    historyIncomplete: rows.some(event => !event.reviewSessionId && event.correct === true),
  };
}

module.exports = { RELEARN_DELAY_MS, REVIEWABLE_PRACTICES, identityForAttempt, deriveAbilityState };
