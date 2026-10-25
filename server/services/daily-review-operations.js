'use strict';

const MAX_DAILY_ITEMS = 10;
const MAX_INPUT_ITEMS = 500;
const PRACTICE_TYPES = new Set(['sentence-cloze', 'guided-expression', 'word-choice', 'chunk-order', 'word-dictation']);

function createDailyReviewOperations({ db, upsertEntityRow, operationError, now = Date.now }) {
  function fail(message, code, status) { throw operationError(message, code, status); }
  function session(userId, sessionId) {
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9:._-]{12,100}$/.test(sessionId)) {
      fail('今日复习队列编号无效', 'INVALID_DAILY_REVIEW', 400);
    }
    const row = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='dailyReviewSession' AND item_key=? AND deleted_at IS NULL")
      .get(userId, sessionId);
    if (!row) fail('今日复习队列不存在', 'DAILY_REVIEW_NOT_FOUND', 404);
    const value = JSON.parse(row.data_json);
    if (value.owner !== userId) fail('今日复习队列不存在', 'DAILY_REVIEW_NOT_FOUND', 404);
    return value;
  }
  function normalizeItem(item, currentTime) {
    if (!item || !['sentence', 'vocabulary'].includes(item.type) || typeof item.key !== 'string'
      || !item.key || item.key.length > 300 || !Number.isSafeInteger(item.dueAt) || item.dueAt <= 0
      || !item.reference || typeof item.reference !== 'object' || Array.isArray(item.reference)) {
      fail('今日复习项目格式无效', 'INVALID_DAILY_REVIEW', 400);
    }
    const ref = item.reference;
    if (item.type === 'sentence') {
      if (Object.keys(ref).some(key => !['deckId', 'cid'].includes(key))
        || typeof ref.deckId !== 'string' || !ref.deckId || typeof ref.cid !== 'string' || !ref.cid
        || item.key !== ref.deckId + '#' + ref.cid) {
        fail('句子复习来源无效', 'INVALID_DAILY_REVIEW', 400);
      }
    } else if (Object.keys(ref).some(key => !['bookId', 'bookRevision', 'itemId', 'contentRevision', 'practiceType'].includes(key))
      || ['bookId', 'bookRevision', 'itemId', 'contentRevision'].some(key => typeof ref[key] !== 'string' || !ref[key])
      || !PRACTICE_TYPES.has(ref.practiceType)
      || item.key !== ref.bookId + '#' + ref.itemId + '#' + ref.practiceType) {
      fail('单词复习来源无效', 'INVALID_DAILY_REVIEW', 400);
    }
    return { type: item.type, key: item.key, dueAt: item.dueAt, reference: { ...ref }, eligible: item.dueAt <= currentTime };
  }
  function apply(userId, body, seq) {
    if (body.type !== 'daily-review.session') return null;
    const p = body.payload || {};
    if (typeof p.sessionId !== 'string' || !/^[A-Za-z0-9:._-]{12,100}$/.test(p.sessionId)
      || !['start', 'progress', 'finish'].includes(p.action) || !Number.isSafeInteger(p.expectedRevision)
      || p.expectedRevision < 0) fail('今日复习队列操作格式无效', 'INVALID_DAILY_REVIEW', 400);
    const existing = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='dailyReviewSession' AND item_key=? AND deleted_at IS NULL")
      .get(userId, p.sessionId);
    if (p.action === 'start') {
      if (existing || p.expectedRevision !== 0 || !Array.isArray(p.items) || p.items.length > MAX_INPUT_ITEMS
        || Object.keys(p).some(key => !['action', 'sessionId', 'expectedRevision', 'items'].includes(key))) {
        fail('今日复习队列启动信息无效或队列已存在', 'DAILY_REVIEW_CONFLICT', 409);
      }
      const currentTime = now();
      const unique = new Map();
      p.items.map(item => normalizeItem(item, currentTime)).filter(item => item.eligible).forEach(item => {
        const existingItem = unique.get(item.key);
        if (existingItem && JSON.stringify(existingItem) !== JSON.stringify(item)) {
          fail('今日复习队列包含身份冲突的重复项目', 'INVALID_DAILY_REVIEW', 400);
        }
        if (!existingItem) unique.set(item.key, item);
      });
      const items = [...unique.values()].sort((left, right) => left.dueAt - right.dueAt
        || left.type.localeCompare(right.type) || left.key.localeCompare(right.key)).slice(0, MAX_DAILY_ITEMS)
        .map(({ eligible, ...item }) => item);
      if (!items.length) fail('当前没有已到期的复习内容', 'DAILY_REVIEW_EMPTY', 409);
      const value = { sessionId: p.sessionId, owner: userId, items, index: 0, childSession: null,
        status: 'in-progress', revision: 1, createdAt: currentTime, updatedAt: currentTime };
      upsertEntityRow(userId, 'dailyReviewSession', p.sessionId, value, seq);
      return { entity: 'dailyReviewSession', id: p.sessionId, action: 'start', status: value.status,
        count: items.length, completion: false, outcome: 'applied' };
    }
    if (!existing) fail('今日复习队列不存在', 'DAILY_REVIEW_NOT_FOUND', 404);
    const value = JSON.parse(existing.data_json);
    if (value.owner !== userId) fail('今日复习队列不存在', 'DAILY_REVIEW_NOT_FOUND', 404);
    if (value.revision !== p.expectedRevision || value.status !== 'in-progress') fail('今日复习进度已变化，请重新读取', 'DAILY_REVIEW_CONFLICT', 409);
    let next;
    if (p.action === 'progress') {
      if (Object.keys(p).some(key => !['action', 'sessionId', 'expectedRevision', 'index', 'childSession'].includes(key))
        || !Number.isSafeInteger(p.index) || p.index < value.index || p.index > value.items.length) {
        fail('今日复习进度无效', 'INVALID_DAILY_REVIEW', 400);
      }
      let childSession = value.childSession;
      if (p.childSession !== undefined && p.childSession !== null) {
        const child = p.childSession;
        if (!child || typeof child.sessionId !== 'string' || child.sessionId.length > 120
          || !['sentence', 'vocabulary'].includes(child.type) || !Number.isSafeInteger(child.index)
          || child.index < 0 || !Number.isSafeInteger(child.total) || child.total < 1 || child.index > child.total
        || !Number.isSafeInteger(child.endIndex) || child.endIndex < 1 || child.endIndex > value.items.length
          || !['in-progress', 'completed'].includes(child.status)) fail('子复习会话进度无效', 'INVALID_DAILY_REVIEW', 400);
        const activeAtCursor = child.status === 'in-progress' && child.endIndex > p.index
          && p.index < value.items.length && value.items[p.index].type === child.type
          && child.index < child.total;
        const completedAtBoundary = child.status === 'completed' && child.index === child.total
          && child.endIndex === p.index && value.items[child.endIndex - 1].type === child.type;
        if (!activeAtCursor && !completedAtBoundary) fail('子复习会话与当前队列项目不匹配', 'INVALID_DAILY_REVIEW', 400);
        childSession = { ...child };
      }
      next = { ...value, index: p.index, childSession, updatedAt: now(), revision: value.revision + 1 };
    } else {
      if (Object.keys(p).some(key => !['action', 'sessionId', 'expectedRevision'].includes(key))) fail('今日复习结束信息无效', 'INVALID_DAILY_REVIEW', 400);
      next = { ...value, status: 'completed', index: value.items.length, childSession: null,
        updatedAt: now(), revision: value.revision + 1 };
    }
    upsertEntityRow(userId, 'dailyReviewSession', p.sessionId, next, seq);
    return { entity: 'dailyReviewSession', id: p.sessionId, action: p.action, status: next.status,
      completion: next.status === 'completed', outcome: 'applied' };
  }
  return { apply, session, MAX_DAILY_ITEMS };
}

module.exports = { createDailyReviewOperations, MAX_DAILY_ITEMS };
