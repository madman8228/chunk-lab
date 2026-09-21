/* Pure deck coverage calculation. Content loading and storage remain in main.html. */
export function calculateDeckLearningProgress(options = {}) {
  const total = Math.max(0, Number(options.total) || 0);
  const items = Array.isArray(options.items) ? options.items : null;
  if (!items) return { done: null, total, pct: null, ready: false };

  const deckId = String(options.deckId || '');
  const bySentence = options.stats && options.stats.bySentence && typeof options.stats.bySentence === 'object'
    ? options.stats.bySentence : {};
  const cidOf = typeof options.cidOf === 'function'
    ? options.cidOf : (item) => item && item.cid;
  const isDeleted = typeof options.isDeleted === 'function'
    ? options.isDeleted : () => false;
  const currentCids = new Set();
  items.forEach((item) => {
    const cid = cidOf(item);
    if (cid) currentCids.add(cid);
  });

  const seen = new Set();
  const prefix = `${deckId}#`;
  Object.keys(bySentence).forEach((key) => {
    if (!key.startsWith(prefix)) return;
    const stat = bySentence[key];
    if (!stat || !stat.times) return;
    const cid = key.slice(prefix.length);
    if (!currentCids.has(cid) || isDeleted(deckId, cid)) return;
    seen.add(cid);
  });

  const done = Math.min(total, seen.size);
  return { done, total, pct: total ? Math.round(done / total * 100) : 0, ready: true };
}

export function buildDeckProgressMarkup(options = {}) {
  const progress = options.progress || { done: null, total: 0, pct: null, ready: false };
  if (!progress.ready) {
    return '<div class="sub home-deck-progress" aria-label="正在核对课节进度"><span>正在核对进度…</span></div>'
      + '<div class="home-deck-progress-track" aria-hidden="true"><i style="width:0"></i></div>';
  }
  const resumeIdx = Number(options.resumeIdx) || 0;
  const current = resumeIdx > 0
    ? '<span class="current">当前第 ' + Math.min(resumeIdx + 1, progress.total || resumeIdx + 1) + ' 句</span>' : '';
  const best = options.best;
  const last = best && typeof best.lastAcc === 'number' && Number.isFinite(best.lastAcc)
    ? '<span class="last-acc">上次 ' + best.lastAcc + '%</span>' : '';
  const sessionCount = Number(options.sessionCount) || 0;
  const session = sessionCount > 0 ? '<span class="session-answered">本次完成 ' + sessionCount + ' 句</span>' : '';
  const aria = '已覆盖 ' + progress.done + ' / ' + progress.total + ' 句，按句子去重，覆盖 ' + progress.pct + '%'
    + (sessionCount > 0 ? '，本次完成 ' + sessionCount + ' 句' : '');
  return '<div class="sub home-deck-progress" role="progressbar" aria-label="' + aria + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress.pct + '">'
    + '<span title="按不同句子去重，重复练习不会增加">已覆盖 ' + progress.done + ' / ' + progress.total + ' 句</span><span class="pct">覆盖 ' + progress.pct + '%</span>' + current + last + session + '</div>'
    + '<div class="home-deck-progress-track' + (progress.pct >= 100 ? ' done' : '') + '" aria-hidden="true"><i style="width:' + progress.pct + '%"></i></div>';
}
