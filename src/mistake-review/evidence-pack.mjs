const MAX_RECORDS = 20;
const MAX_BYTES = 128 * 1024;
const normalizeSentence = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const byteLength = (value) => new TextEncoder().encode(value).byteLength;

function buildEvidencePack({ rows = [], stats = {}, decks = [], maxRecords = MAX_RECORDS, now = Date.now() } = {}) {
  if (rows.length > maxRecords || rows.length > MAX_RECORDS) throw new Error(`一次最多选择 ${Math.min(maxRecords, MAX_RECORDS)} 道错题。`);
  const publicRecords = [], localSourceRefs = {};
  const sourceDecks = new Map((Array.isArray(decks) ? decks : []).map((deck) => [deck.id, deck]));
  rows.forEach((row, index) => {
    const ref = `R${index + 1}`;
    const deck = sourceDecks.get(row.deckId);
    let sourceItem = null;
    if (deck && Array.isArray(deck.items)) {
      sourceItem = row.cid ? deck.items.find((item) => item.cid === row.cid) : null;
      if (!sourceItem) sourceItem = deck.items.find((item) => normalizeSentence(item.sentence) === normalizeSentence(row.sentence));
    }
    const statKey = sourceItem && sourceItem.cid ? `${row.deckId}#${sourceItem.cid}` : '';
    const stat = statKey ? stats[statKey] : null;
    const events = (Array.isArray(row.history) ? row.history : []).map((event) => ({
      at: event.at == null ? null : event.at,
      mode: event.mode || 'unknown', hinted: event.hinted, revealed: event.revealed,
      needsReview: event.needsReview === true,
      mistakes: (event.mistakes || []).map((mistake) => ({
        chunkIdx: mistake.chunkIdx, target: mistake.chunk || '', wrongAnswers: mistake.wrongAnswers || [],
        wrongAttemptCount: mistake.wrongAttemptCount == null ? null : mistake.wrongAttemptCount,
        hintUsed: mistake.hintUsed,
      })),
      ...(event.truncated ? { truncated: true } : {}),
    }));
    const legacyMistakes = events.length ? [] : (row.mistakes || []).map((mistake) => ({ chunkIdx: mistake.chunkIdx, target: mistake.chunk || '', wrongAnswers: mistake.userAnswer ? [mistake.userAnswer] : [], wrongAttemptCount: null, hintUsed: null }));
    publicRecords.push({
      ref, sentence: sourceItem && sourceItem.sentence || row.sentence || '',
      translation: sourceItem && sourceItem.translation || row.translation || '',
      chunks: sourceItem && sourceItem.chunks || row.chunks || [],
      hints: sourceItem && sourceItem.hints || row.hints || [],
      grammar: sourceItem && sourceItem.grammar || row.grammar || null,
      sourceMissing: !sourceItem,
      difficulty: sourceItem && (sourceItem.difficulty || sourceItem.level) || null,
      history: events.length ? events : (legacyMistakes.length ? [{ at: null, mode: 'unknown', hinted: null, revealed: null, needsReview: row.needsReview === true, mistakes: legacyMistakes, legacy: true }] : []),
      historyTruncated: row.historyTruncated === true,
      stats: stat ? { totalAnswers: Number(stat.times) || 0, correct: Number(stat.okTimes) || 0, incorrect: Number(stat.wrongTimes) || 0, lastAt: Number.isFinite(stat.lastAt) ? stat.lastAt : null, currentState: stat.state || null } : null,
      statsUnknown: !stat,
    });
    localSourceRefs[ref] = { deckId: row.deckId || '', cid: sourceItem && sourceItem.cid || row.cid || '', sentence: row.sentence || '' };
  });
  const publicPack = {
    format: 'chunklab-mistake-evidence', version: 1,
    packId: `pack-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: now,
    limitations: ['答题次数与单次意群错误尝试次数是不同口径。', 'lastAt 表示最近作答时间，不代表最近一次答错。', '历史材料可能不完整；unknown/null 表示未记录，不作推断。', '错误表达可能是合理变体，需先核查题目与答案。'],
    records: publicRecords,
  };
  if (byteLength(JSON.stringify(publicPack)) > MAX_BYTES) throw new Error('所选材料超过 128 KiB，请减少题目或清理过长错误记录。');
  return { publicPack, localSourceRefs };
}

export { buildEvidencePack, MAX_RECORDS, MAX_BYTES };
