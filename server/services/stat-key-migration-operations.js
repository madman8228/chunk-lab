'use strict';

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function mergeLegacySentenceStats(left, right) {
  const latest = (Number(left.lastAt) || 0) >= (Number(right.lastAt) || 0) ? left : right;
  return Object.assign({}, latest, {
    times: (Number(left.times) || 0) + (Number(right.times) || 0),
    okTimes: (Number(left.okTimes) || 0) + (Number(right.okTimes) || 0),
    wrongTimes: (Number(left.wrongTimes) || 0) + (Number(right.wrongTimes) || 0),
    maxStreak: Math.max(Number(left.maxStreak) || 0, Number(right.maxStreak) || 0)
  });
}

function createStatKeyMigrationOperations(options) {
  const db = options.db;
  const upsertSentenceStat = options.upsertSentenceStat;
  const replaceSentenceStat = options.replaceSentenceStat;
  const deleteSentenceStat = options.deleteSentenceStat;
  const resolveAssessmentItem = options.resolveAssessmentItem;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    if (body.type !== 'learning.statKeyMigrate') return null;
    const p = body.payload;
    const separator = typeof p.oldKey === 'string' ? p.oldKey.indexOf('#') : -1;
    const destinationSeparator = typeof p.newKey === 'string' ? p.newKey.indexOf('#') : -1;
    const sourceDeckId = separator > 0 ? p.oldKey.slice(0, separator) : '';
    if (!hasOnlyKeys(p, ['eventId', 'oldKey', 'newKey', 'deckId']) ||
        typeof p.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(p.eventId) ||
        !sourceDeckId || sourceDeckId.length > 200 || typeof p.newKey !== 'string' ||
        destinationSeparator < 1 || typeof p.deckId !== 'string' || !p.deckId || p.deckId.length > 200 ||
        p.newKey.slice(0, destinationSeparator) !== p.deckId || p.oldKey === p.newKey ||
        p.oldKey.length > 500 || p.newKey.length > 500 || !upsertSentenceStat || !deleteSentenceStat ||
        typeof resolveAssessmentItem !== 'function') {
      throw operationError('旧统计键迁移操作无效', 'INVALID_OPERATION', 400);
    }
    const sourceRow = db.prepare('SELECT data_json,deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?')
      .get(userId, p.oldKey);
    if (!sourceRow || sourceRow.deleted_at) {
      return { entity: 'sentenceStat', id: p.oldKey, migratedTo: p.newKey, outcome: 'already-applied' };
    }
    let source;
    try { source = JSON.parse(sourceRow.data_json); } catch (_) { source = null; }
    if (!object(source) || source.deckId !== sourceDeckId || sourceDeckId === p.deckId ||
        resolveAssessmentItem(userId, p.oldKey)) {
      throw operationError('旧统计键与迁移目标不匹配', 'INVALID_STAT_KEY_MIGRATION', 400);
    }
    if (!resolveAssessmentItem(userId, p.newKey)) {
      throw operationError('统计迁移目标句子不存在', 'INVALID_STAT_KEY_MIGRATION', 400);
    }

    const hasModernEvidence = db.prepare(`SELECT 1 AS present FROM user_learning_events
      WHERE user_id=? AND sentence_key IN (?,?) LIMIT 1`).get(userId, p.oldKey, p.newKey) ||
      db.prepare(`SELECT 1 AS present FROM user_learning_baselines
        WHERE user_id=? AND sentence_key IN (?,?) LIMIT 1`).get(userId, p.oldKey, p.newKey) ||
      db.prepare(`SELECT 1 AS present FROM user_learning_generation_baselines
        WHERE user_id=? AND sentence_key IN (?,?) LIMIT 1`).get(userId, p.oldKey, p.newKey);
    if (hasModernEvidence) {
      return { entity: 'sentenceStat', id: p.oldKey, migratedTo: p.newKey,
        outcome: 'retained', reason: 'modern-learning-evidence' };
    }

    const destinationRow = db.prepare('SELECT data_json,deleted_at FROM user_sentence_stats WHERE user_id=? AND sentence_key=?')
      .get(userId, p.newKey);
    let merged = source;
    if (destinationRow && !destinationRow.deleted_at) {
      let destination;
      try { destination = JSON.parse(destinationRow.data_json); } catch (_) { destination = null; }
      if (!object(destination)) {
        return { entity: 'sentenceStat', id: p.oldKey, migratedTo: p.newKey,
          outcome: 'retained', reason: 'invalid-destination-stat' };
      }
      merged = mergeLegacySentenceStats(destination, source);
    }
    merged = Object.assign({}, merged, { deckId: p.deckId });
    const replace = replaceSentenceStat || upsertSentenceStat;
    replace(userId, p.newKey, merged, seq);
    deleteSentenceStat(userId, p.oldKey, seq);
    return { entity: 'sentenceStat', id: p.newKey, migratedFrom: p.oldKey };
  }

  return Object.freeze({ apply });
}

module.exports = { createStatKeyMigrationOperations };
