/* Pure home summary calculation. Deck lookup and SRS/deletion policies are injected. */
export function computeTodaySummary(options = {}) {
  const stats = options.stats && typeof options.stats === 'object' ? options.stats : {};
  const bySentence = stats.bySentence && typeof stats.bySentence === 'object' ? stats.bySentence : {};
  const knownDeckIds = new Set(Array.isArray(options.knownDeckIds) ? options.knownDeckIds : []);
  const now = options.now;
  const isDue = typeof options.isDue === 'function' ? options.isDue : () => false;
  const isDeleted = typeof options.isDeleted === 'function' ? options.isDeleted : () => false;
  let due = 0;

  Object.keys(bySentence).forEach((key) => {
    const stat = bySentence[key];
    if (!stat || !stat.times || !stat.deckId || !knownDeckIds.has(stat.deckId)) return;
    const separator = key.indexOf('#');
    const cid = separator >= 0 ? key.slice(separator + 1) : '';
    if (isDeleted(stat.deckId, cid)) return;
    if (isDue(stat, now)) due += 1;
  });

  return {
    due,
    book: Array.isArray(options.reinforceBook) ? options.reinforceBook.length : 0,
  };
}
