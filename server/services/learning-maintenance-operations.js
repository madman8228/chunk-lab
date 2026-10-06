'use strict';

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createLearningMaintenanceOperations(options) {
  const db = options.db;
  const upsertEntityRow = options.upsertEntityRow;
  const deleteEntityRow = options.deleteEntityRow;
  const upsertEvent = options.upsertEvent;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    const payload = body.payload;
    if (body.type === 'mistake.remove') {
      if (!hasOnlyKeys(payload, ['eventId', 'key']) || typeof payload.eventId !== 'string' ||
          !/^[A-Za-z0-9_-]{12,100}$/.test(payload.eventId) || typeof payload.key !== 'string' || !payload.key ||
          payload.key.length > 600 || !deleteEntityRow) {
        throw operationError('错题删除操作无效', 'INVALID_OPERATION', 400);
      }
      deleteEntityRow(userId, 'reinforce', payload.key, seq);
      upsertEvent(userId, { id: payload.eventId, kind: 'mistakeRemoved', key: payload.key, at: Date.now() }, seq);
      return { entity: 'reinforce', id: payload.key, deleted: true };
    }

    if (body.type === 'deck.itemsVisibility') {
      if (!hasOnlyKeys(payload, ['eventId', 'deckId', 'keys', 'hidden', 'expectedHidden']) ||
          typeof payload.eventId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(payload.eventId) ||
          typeof payload.deckId !== 'string' || !payload.deckId || payload.deckId.length > 200 ||
          !Array.isArray(payload.keys) || !payload.keys.length || payload.keys.length > 2000 ||
          typeof payload.hidden !== 'boolean' || typeof payload.expectedHidden !== 'boolean' ||
          payload.keys.some(key => typeof key !== 'string' || !key.startsWith(payload.deckId + '#') || key.length > 500) ||
          new Set(payload.keys).size !== payload.keys.length || !upsertEntityRow || !deleteEntityRow) {
        throw operationError('题库句子显示状态无效', 'INVALID_OPERATION', 400);
      }
      const readHidden = db.prepare(`SELECT deleted_at FROM user_entity_rows
        WHERE user_id=? AND kind='deletedItem' AND item_key=?`);
      for (const key of payload.keys) {
        const row = readHidden.get(userId, key);
        const currentHidden = !!row && !row.deleted_at;
        if (currentHidden !== payload.expectedHidden) {
          throw operationError('题库句子状态已在其他页面更新，本次修改未覆盖', 'ENTITY_CHANGED', 409,
            [{ entity: 'deletedItems', id: key, expectedHidden: payload.expectedHidden, currentHidden }]);
        }
      }
      payload.keys.forEach(key => {
        if (payload.hidden) upsertEntityRow(userId, 'deletedItem', key, 1, seq);
        else deleteEntityRow(userId, 'deletedItem', key, seq);
      });
      upsertEvent(userId, { id: payload.eventId, kind: 'deckItemsVisibility', deckId: payload.deckId,
        keys: payload.keys.slice(), hidden: payload.hidden, at: Date.now() }, seq);
      return { entity: 'deletedItems', id: payload.deckId, hidden: payload.hidden, count: payload.keys.length };
    }

    return null;
  }

  return Object.freeze({ apply });
}

module.exports = { createLearningMaintenanceOperations };
