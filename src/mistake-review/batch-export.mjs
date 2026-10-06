const BATCH_SIZE = 200;

function createExportSnapshot({ rows = [], scopeLabel = '全部错题', snapshotId, now = Date.now() } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('错题材料必须是数组。');
  const id = String(snapshotId || `S${Number(now).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const width = Math.max(6, String(rows.length).length);
  const records = rows.slice().reverse().map((row, index) => Object.freeze({
    ref: `R${String(index + 1).padStart(width, '0')}`,
    row: Object.freeze(Object.assign({}, row)),
  }));
  return Object.freeze({
    id, createdAt: Number(now), scopeLabel: String(scopeLabel), totalQuestions: records.length,
    batchSize: BATCH_SIZE, batchCount: Math.ceil(records.length / BATCH_SIZE), records: Object.freeze(records),
  });
}

async function createExportSnapshotAsync(options = {}, { yieldEvery = 1000, shouldContinue = () => true } = {}) {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const id = String(options.snapshotId || `S${Number(options.now || Date.now()).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const width = Math.max(6, String(rows.length).length);
  const reversed = rows.slice().reverse(), records = [];
  for (let start = 0; start < reversed.length; start += yieldEvery) {
    if (!shouldContinue()) throw new Error('错题数据范围已变化，请重新生成快照。');
    const end = Math.min(reversed.length, start + yieldEvery);
    for (let index = start; index < end; index += 1) {
      records.push(Object.freeze({ ref: `R${String(index + 1).padStart(width, '0')}`, row: Object.freeze(Object.assign({}, reversed[index])) }));
    }
    if (end < reversed.length) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!shouldContinue()) throw new Error('错题数据范围已变化，请重新生成快照。');
  return Object.freeze({ id, createdAt: Number(options.now || Date.now()), scopeLabel: String(options.scopeLabel || '全部错题'),
    totalQuestions: records.length, batchSize: BATCH_SIZE, batchCount: Math.ceil(records.length / BATCH_SIZE), records: Object.freeze(records) });
}

function describeBatch(snapshot, index) {
  if (!Number.isInteger(index) || index < 0 || index >= snapshot.batchCount) throw new RangeError('错题包序号超出范围。');
  const start = index * BATCH_SIZE;
  const count = Math.min(BATCH_SIZE, snapshot.totalQuestions - start);
  const width = Math.max(3, String(snapshot.batchCount).length);
  return Object.freeze({ index, number: index + 1, label: `B${String(index + 1).padStart(width, '0')}`, startRef: start + 1, endRef: start + count, count });
}

function serializeRecord(entry, resolveSource) {
  const row = entry.row || {};
  let source = null;
  if (typeof resolveSource === 'function' && (!row.sentence || !row.translation)) {
    try { source = resolveSource(row) || null; } catch (_) { source = null; }
  }
  const events = Array.isArray(row.history) && row.history.length ? row.history :
    (Array.isArray(row.mistakes) && row.mistakes.length ? [{ mistakes: row.mistakes.map((mistake) => ({
      chunkIdx: mistake.chunkIdx, chunk: mistake.chunk, wrongAnswers: mistake.userAnswer ? [mistake.userAnswer] : [],
    })) }] : []);
  const grouped = new Map();
  for (const event of events) {
    for (const mistake of Array.isArray(event.mistakes) ? event.mistakes : []) {
      const part = Number.isInteger(mistake.chunkIdx) && mistake.chunkIdx >= 0 ? mistake.chunkIdx + 1 : null;
      const expected = mistake.chunk == null || mistake.chunk === '' ? null : String(mistake.chunk);
      const key = JSON.stringify([part, expected]);
      let group = grouped.get(key);
      if (!group) {
        group = { part, expected, answers: new Map(), attempts: 0, attemptsComplete: true, occurrences: 0 };
        grouped.set(key, group);
      }
      group.occurrences += 1;
      const wrongAnswers = Array.isArray(mistake.wrongAnswers) ? mistake.wrongAnswers : (mistake.userAnswer ? [mistake.userAnswer] : []);
      for (const answer of new Set(wrongAnswers.map((value) => value == null ? '' : String(value)).filter((value) => value.trim()))) {
        group.answers.set(answer, (group.answers.get(answer) || 0) + 1);
      }
      if (typeof mistake.wrongAttemptCount === 'number' && Number.isFinite(mistake.wrongAttemptCount)) group.attempts += mistake.wrongAttemptCount;
      else group.attemptsComplete = false;
    }
  }
  const sentence = row.sentence || (source && source.sentence) || '';
  const translation = row.translation || (source && source.translation) || '';
  const courseContentRecovered = !!source && ((!row.sentence && !!source.sentence) || (!row.translation && !!source.translation));
  const errors = Array.from(grouped.values(), (group) => ({
    ...(group.part == null ? {} : { part: group.part }),
    ...(group.expected == null ? {} : { expected: group.expected }),
    wrongAnswers: Array.from(group.answers, ([text, sessions]) => ({ text, sessions })),
    ...(group.attemptsComplete && group.occurrences ? { wrongAttempts: group.attempts } : {}),
  }));
  return {
    ref: entry.ref,
    ...(sentence ? { sentence } : {}),
    ...(translation ? { translation } : {}),
    errors,
    ...(row.historyTruncated === true || events.some((event) => event.truncated === true) ? { historyIncomplete: true } : {}),
    ...(courseContentRecovered ? { courseContentRecovered: true } : {}),
  };
}

function buildBatchExport(snapshot, index, resolveSource) {
  const batch = describeBatch(snapshot, index);
  const selected = snapshot.records.slice(index * BATCH_SIZE, index * BATCH_SIZE + batch.count);
  const data = {
    snapshotId: snapshot.id, batchNumber: batch.number, batchCount: snapshot.batchCount,
    records: selected.map((entry) => serializeRecord(entry, resolveSource)),
  };
  return Object.freeze({ batch, data, json: JSON.stringify(data) });
}

function byteLength(text) {
  return new TextEncoder().encode(String(text)).byteLength;
}

export { BATCH_SIZE, buildBatchExport, byteLength, createExportSnapshot, createExportSnapshotAsync, describeBatch };
