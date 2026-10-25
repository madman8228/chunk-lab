const DAY = 86_400_000;
const MAX_REVIEW_BATCH = 10;

function eventId(event) { return String(event?.id || event?.eventId || ''); }
function eventTime(event) { return Number(event?.at) || Number(event?.occurredAt) || 0; }
function eventOrder(left, right) { return eventTime(left) - eventTime(right) || eventId(left).localeCompare(eventId(right)); }
function eventDay(event) {
  const at = eventTime(event);
  if (!at) return '';
  const zone = typeof event.timeZone === 'string' && event.timeZone ? event.timeZone : 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
    const value = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  } catch (_) { return ''; }
}

function resolveMistakeState({ row, stat, contentFingerprint } = {}) {
  const learning = stat?.learningV1 && typeof stat.learningV1 === 'object' ? stat.learningV1 : {};
  const fingerprintEvidence = (Array.isArray(learning.evidence) ? learning.evidence : [])
    .filter((event) => event.contentFingerprint).slice().sort(eventOrder);
  const latestFingerprint = fingerprintEvidence.slice(-1)[0]?.contentFingerprint;
  const fingerprintMatches = !contentFingerprint || !latestFingerprint || latestFingerprint === contentFingerprint;
  const events = new Map();
  const history = Array.isArray(row?.history) && row.history.length ? row.history : row ? [{
    eventId: `legacy-${String(row._key || row.deckId || 'mistake')}`,
    at: typeof row.addedAt === 'string' ? Date.parse(`${row.addedAt.replace(' ', 'T')}Z`) : null,
    needsReview: row.needsReview === true, mistakes: Array.isArray(row.mistakes) ? row.mistakes : [], legacy: true,
  }] : [];
  history.forEach((event) => {
    const id = eventId(event);
    if (!id) return;
    const issue = event.needsReview === true || event.hinted === true || event.revealed === true
      || (Array.isArray(event.mistakes) && event.mistakes.length > 0);
    events.set(id, { ...event, id, at: eventTime(event), issue, assisted: event.hinted === true || event.revealed === true, legacy: event.legacy === true || id.startsWith('legacy-') });
  });
  (Array.isArray(learning.evidence) ? learning.evidence : []).forEach((event) => {
    const id = eventId(event);
    if (!id || events.has(id)) return;
    if (event.contentFingerprint && contentFingerprint && event.contentFingerprint !== contentFingerprint) return;
    events.set(id, { ...event, id, at: eventTime(event), issue: event.ok === false || event.assisted === true,
      assisted: event.assisted === true, legacy: false });
  });
  const ordered = [...events.values()].sort(eventOrder);
  const lastIssue = ordered.filter((event) => event.issue || event.assisted || event.ok === false).slice(-1)[0];
  const recent = lastIssue ? ordered.filter((event) => event.at > lastIssue.at) : ordered;
  const successfulDays = new Map();
  const successfulSessions = new Set();
  recent.forEach((event) => {
    if (event.ok === true && event.assisted !== true && event.firstAttempt === true && event.sessionId && event.at) {
      const day = eventDay(event);
      const sessionId = String(event.sessionId);
      if (day && !successfulDays.has(day) && !successfulSessions.has(sessionId)) {
        successfulDays.set(day, event);
        successfulSessions.add(sessionId);
      }
    }
  });
  const successDays = [...successfulDays.keys()].sort();
  const status = fingerprintMatches && successDays.length >= 2 ? 'mastered' : 'needs-reinforcement';
  const mistakeCount = ordered.filter((event) => event.issue || event.assisted || event.ok === false).length;
  const addedAt = typeof row?.addedAt === 'string' ? Date.parse(`${row.addedAt.replace(' ', 'T')}Z`) : 0;
  return {
    status, successDays: successDays.length, successfulDayKeys: successDays,
    lastIssueAt: lastIssue?.at || (Number.isFinite(addedAt) ? addedAt : 0),
    lastWrongAt: lastIssue?.at || 0, wrongCount: Math.max(mistakeCount, Number(row?.history?.length ? 0 : row?.wrongCount) || 0),
    historyIncomplete: row?.historyTruncated === true || ordered.some((event) => event.legacy || !event.at),
    fingerprintMatches,
  };
}

function buildSentenceReviewModel({ stats, reinforceBook, decks, isJoined, isDeleted, now = Date.now(), contentFingerprint, cidForItem } = {}) {
  const bySentence = stats?.bySentence && typeof stats.bySentence === 'object' ? stats.bySentence : {};
  const deckRows = Array.isArray(decks) ? decks : [];
  const sources = new Map();
  deckRows.forEach((deck) => {
    if (!deck?.id || (typeof isJoined === 'function' && !isJoined(deck))) return;
    const items = new Map();
    (Array.isArray(deck.items) ? deck.items : []).forEach((item) => {
      const cid = String(item.cid || (typeof cidForItem === 'function' ? cidForItem(item) : ''));
      if (cid) items.set(cid, item);
    });
    sources.set(deck.id, { deck, items });
  });
  const wrongRows = new Map();
  const deckSentences = new Map();
  sources.forEach(({ deck, items }) => {
    const byText = new Map();
    items.forEach((item) => {
      const sentence = String(item.sentence || item.en || '');
      if (!byText.has(sentence)) byText.set(sentence, []);
      byText.get(sentence).push(item);
    });
    deckSentences.set(deck.id, byText);
  });
  (Array.isArray(reinforceBook) ? reinforceBook : []).forEach((row) => {
    if (!row?.deckId) return;
    const source = sources.get(row.deckId);
    const matched = source && (row.cid ? source.items.get(String(row.cid)) : null);
    const candidates = source && !matched ? deckSentences.get(row.deckId)?.get(String(row.sentence || '')) : null;
    const item = matched || (candidates?.length === 1 ? candidates[0] : null);
    const cid = item && String(item.cid || (typeof cidForItem === 'function' ? cidForItem(item) : ''));
    const key = cid ? `${row.deckId}#${cid}` : `${row.deckId}#history:${String(row._key || row.addedAt || 'unknown')}`;
    if (!source || !item) {
      if (!wrongRows.has(key)) wrongRows.set(key, { key, deck: null, item: null, row, stat: {}, unavailable: true, state: resolveMistakeState({ row }) });
      return;
    }
    if (typeof isDeleted === 'function' && isDeleted(row.deckId, item)) return;
    if (!wrongRows.has(key)) wrongRows.set(key, { key, deck: source.deck, item, row, stat: bySentence[key] || {}, state: null });
  });
  const wrong = [...wrongRows.values()].map((entry) => {
    if (entry.unavailable) return entry;
    const fingerprint = typeof contentFingerprint === 'function' ? contentFingerprint(entry.item) : '';
    entry.state = resolveMistakeState({ row: entry.row, stat: entry.stat, contentFingerprint: fingerprint });
    return entry;
  });
  const dueMap = new Map();
  Object.entries(bySentence).forEach(([key, stat]) => {
    if (!stat || !stat.deckId || !Number(stat.dueAt) || Number(stat.dueAt) > now) return;
    const separator = key.indexOf('#'), cid = separator >= 0 ? key.slice(separator + 1) : '';
    const source = sources.get(stat.deckId), item = source?.items.get(cid);
    if (!item || typeof isDeleted === 'function' && isDeleted(stat.deckId, item)) return;
    const row = wrongRows.get(key)?.row;
    dueMap.set(key, { key, deck: source.deck, item, stat, row, state: row ? wrong.find((entry) => entry.key === key)?.state : null, dueAt: Number(stat.dueAt) });
  });
  const due = [...dueMap.values()].sort((left, right) => left.dueAt - right.dueAt || left.key.localeCompare(right.key));
  wrong.sort((left, right) => (left.state.status === right.state.status ? 0 : left.state.status === 'needs-reinforcement' ? -1 : 1)
    || right.state.wrongCount - left.state.wrongCount || right.state.lastWrongAt - left.state.lastWrongAt || left.key.localeCompare(right.key));
  return { due, wrong, counts: { due: due.length, needsReinforcement: wrong.filter((entry) => entry.state.status === 'needs-reinforcement').length,
    mastered: wrong.filter((entry) => entry.state.status === 'mastered').length } };
}

function selectReviewBatch(model, { kind = 'due', limit = MAX_REVIEW_BATCH, status = 'needs-reinforcement', courseId } = {}) {
  const source = kind === 'wrong' ? (model?.wrong || []).filter((entry) => status === 'all' || entry.state.status === status) : (model?.due || []);
  return source.filter((entry) => !courseId || entry.deck && entry.deck.id === courseId).slice(0, Math.max(1, Math.min(MAX_REVIEW_BATCH, Number(limit) || MAX_REVIEW_BATCH)));
}

export { buildSentenceReviewModel, resolveMistakeState, selectReviewBatch };
