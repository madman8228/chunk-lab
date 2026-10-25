'use strict';

const crypto = require('node:crypto');
const contract = require('../../js/vocabulary-course-contract');
const cloze = require('../../landing/sentence-cloze-engine');
const guidedContent = require('../../landing/guided-sentence-content');
const attemptEvaluator = require('../../js/vocabulary-attempt');
const { identityForAttempt, deriveAbilityState, REVIEWABLE_PRACTICES } = require('./vocabulary-review-model');

const learningKeys = {
  'word-choice': ['wordChoice', require('../../js/vocabulary-word-choice')],
  'chunk-order': ['chunkOrder', require('../../js/vocabulary-chunk-order')],
  'word-dictation': ['wordDictation', require('../../js/vocabulary-word-dictation')],
};

function createVocabularyReviewOperations({ db, content, upsertEntityRow, operationError, now = Date.now,
  enableWordDictation = false, enableWordChoice = false, enableChunkOrder = false } = {}) {
  const fail = (message, code, status) => { throw operationError(message, code, status); };
  const enabled = { 'sentence-cloze': true, 'guided-expression': true,
    'word-choice': enableWordChoice, 'chunk-order': enableChunkOrder, 'word-dictation': enableWordDictation };

  function canPersist(userId) {
    return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_phone_identities'").get()
      && !!db.prepare('SELECT 1 FROM user_phone_identities WHERE user_id=?').get(userId);
  }
  function practiceRevision(item, practiceType) {
    if (practiceType === 'sentence-cloze') return item?.exercise ? item.contentRevision : null;
    if (practiceType === 'guided-expression') {
      const activity = item?.learning?.guidedExpression;
      const steps = guidedContent.forItem(item);
      if (!steps) return null;
      return activity?.revision || crypto.createHash('sha256').update(JSON.stringify(steps)).digest('hex');
    }
    const [key, model] = learningKeys[practiceType] || [];
    const activity = key && item?.learning?.[key];
    if (!activity) return null;
    model.validate(item, activity, cloze);
    return activity.revision;
  }
  function validatePractice(practiceType) {
    if (!REVIEWABLE_PRACTICES.has(practiceType) || !enabled[practiceType]) {
      fail(practiceType === 'read-aloud' ? '跟读尚不能自动核验，不进入错题/待复习' : '该练习类型暂不可专项复习', 'PRACTICE_UNAVAILABLE', 422);
    }
  }
  function identityFor(userId, bookId, item, practiceType) {
    const revision = practiceRevision(item, practiceType);
    return revision ? { owner: userId, resourceId: 'wordbook:' + bookId, itemId: item.itemId,
      contentRevision: item.contentRevision, practiceType, practiceRevision: revision } : null;
  }
  function pageArgs(options = {}) {
    const offset = Number(options.offset ?? 0), limit = Number(options.limit ?? 50);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      fail('分页参数无效', 'INVALID_REVIEW_QUERY', 400);
    }
    return { offset, limit };
  }

  function list(userId, options = {}) {
    const { offset, limit } = pageArgs(options);
    const { bookId, practiceType, kind = 'wrong' } = options;
    if (typeof bookId !== 'string' || !bookId || practiceType !== undefined && typeof practiceType !== 'string'
      || !['wrong', 'due', 'all'].includes(kind)) fail('专项复习筛选条件无效', 'INVALID_REVIEW_QUERY', 400);
    if (practiceType) validatePractice(practiceType);
    const allowedTypes = practiceType ? [practiceType] : [...REVIEWABLE_PRACTICES].filter(type => enabled[type]);
    const book = content.book(bookId, userId);
    const currentRefs = new Map(book.items.map(ref => [ref.itemId, ref]));
    const resourceId = 'wordbook:' + bookId;
    const grouped = new Map();
    const rows = db.prepare(`SELECT attempt_id AS id,item_id,resource_id,content_revision,data_json,occurred_at
      FROM vocabulary_attempt_events WHERE user_id=? AND resource_id=?
      UNION ALL
      SELECT event_id AS id,item_id,resource_id,content_revision,data_json,occurred_at
      FROM vocabulary_study_events WHERE user_id=? AND resource_id=?
      ORDER BY occurred_at,id`).all(userId, resourceId, userId, resourceId);
    const itemCache = new Map();
    function itemAtRevision(itemId, revision) {
      const key = itemId + '\n' + revision;
      if (itemCache.has(key)) return itemCache.get(key);
      let value = null;
      try { value = content.item(itemId, revision, userId); } catch (_) { /* Preserve unavailable history without remapping it. */ }
      itemCache.set(key, value);
      return value;
    }
    for (const row of rows) {
      let data;
      try { data = JSON.parse(row.data_json); } catch (_) { continue; }
      if (!allowedTypes.includes(data.practiceType)) continue;
      const item = itemAtRevision(row.item_id, row.content_revision);
      if (!item) continue;
      const rowPracticeType = data.practiceType;
      let identity = identityFor(userId, bookId, item, rowPracticeType);
      if (!identity || identity.contentRevision !== row.content_revision) continue;
      if (data.practiceRevision && data.practiceRevision !== identity.practiceRevision) {
        identity = { ...identity, practiceRevision: data.practiceRevision };
      }
      const key = identityForAttempt(identity);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, { identity, events: [], item });
      grouped.get(key).events.push({ ...identity, id: row.id, at: row.occurred_at,
        correct: typeof data.correct === 'boolean' ? data.correct : undefined,
        assisted: data.assisted === true, reviewSessionId: data.reviewSessionId || null,
        firstAttempt: data.firstAttempt === true, sessionId: data.reviewSessionId || data.sessionId || null,
        timeZone: data.timeZone });
    }

    const output = [];
    for (const [key, group] of grouped) {
      const state = deriveAbilityState(group.events, { now: now() });
      if (!state) continue;
      const current = currentRefs.get(group.identity.itemId);
      const available = !!current && current.contentRevision === group.identity.contentRevision
        && group.identity.practiceRevision === practiceRevision(group.item, group.identity.practiceType) && enabled[group.identity.practiceType];
      if (kind === 'wrong' && (state.wrongCount < 1 || state.status === 'reinforced')) continue;
      if (kind === 'due' && !state.due) continue;
      if (kind === 'all' && state.wrongCount < 1 && !state.dueAt) continue;
      output.push({ key: crypto.createHash('sha256').update(key).digest('hex'), bookId, bookTitle: book.title,
        resourceId, itemId: group.identity.itemId, contentRevision: group.identity.contentRevision,
        practiceType: group.identity.practiceType, practiceRevision: group.identity.practiceRevision,
        title: group.item.word || group.identity.itemId, meaning: group.item.meaning || '', state,
        canReview: available, stale: !current || current.contentRevision !== group.identity.contentRevision,
        reason: available ? null : '课程内容或练习版本已更新；请从当前课程重新产生记录。' });
    }
    output.sort((left, right) => (left.state.dueAt || Number.MAX_SAFE_INTEGER) - (right.state.dueAt || Number.MAX_SAFE_INTEGER)
      || right.state.wrongCount - left.state.wrongCount || left.itemId.localeCompare(right.itemId));
    return { confirmed: true, bookId, bookRevision: book.revision, practiceType: practiceType || null, kind, total: output.length,
      items: output.slice(offset, offset + limit), nextOffset: offset + limit < output.length ? offset + limit : null };
  }

  function readSession(userId, sessionId) {
    const row = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='vocabularyReviewSession' AND item_key=? AND deleted_at IS NULL").get(userId, sessionId);
    if (!row) fail('专项复习会话不存在', 'REVIEW_SESSION_NOT_FOUND', 404);
    let session;
    try { session = JSON.parse(row.data_json); } catch (_) { fail('专项复习会话记录无效', 'REVIEW_SESSION_INVALID', 500); }
    return session;
  }

  function session(userId, sessionId) {
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9:._-]{12,100}$/.test(sessionId)) fail('专项复习会话编号无效', 'INVALID_REVIEW_SESSION_ID', 400);
    const value = readSession(userId, sessionId);
    if (value.status === 'in-progress') {
      let book;
      try { book = content.book(value.bookId, userId); } catch (_) { return { confirmed: true, ...value, status: 'stale', staleReason: 'resource-unavailable' }; }
      const entry = value.queue[value.index], current = entry && book.items.find(ref => ref.itemId === entry.itemId);
      if (book.revision !== value.bookRevision || !current || current.contentRevision !== entry.contentRevision) {
        return { confirmed: true, ...value, status: 'stale', staleReason: 'content-updated' };
      }
      const item = content.item(current.itemId, current.contentRevision, userId);
      if (practiceRevision(item, value.practiceType) !== entry.practiceRevision) {
        return { confirmed: true, ...value, status: 'stale', staleReason: 'practice-updated' };
      }
    }
    return { confirmed: true, ...value };
  }

  function apply(userId, body, seq) {
    if (!['vocabulary.review.session', 'vocabulary.review.attempt'].includes(body.type)) return null;
    const p = body.payload || {};
    if (!canPersist(userId)) fail('绑定手机号后可保存专项复习；当前账号尚未绑定', 'PHONE_IDENTITY_REQUIRED', 403);
    if (body.type === 'vocabulary.review.session') {
      const allowed = ['action', 'sessionId', 'bookId', 'bookRevision', 'practiceType', 'kind', 'expectedSessionRev', 'itemIds'];
      if (Object.keys(p).some(key => !allowed.includes(key)) || !['start', 'pause', 'resume', 'finish'].includes(p.action)
        || typeof p.sessionId !== 'string' || !/^[A-Za-z0-9:._-]{12,100}$/.test(p.sessionId)
        || typeof p.bookId !== 'string' || !p.bookId || typeof p.bookRevision !== 'string'
        || !Number.isSafeInteger(p.expectedSessionRev) || p.expectedSessionRev < 0) fail('专项会话操作格式无效', 'INVALID_REVIEW_SESSION', 400);
      const existing = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='vocabularyReviewSession' AND item_key=? AND deleted_at IS NULL").get(userId, p.sessionId);
      if (p.action === 'start') {
        if (existing || p.expectedSessionRev !== 0 || !['wrong', 'due'].includes(p.kind)) fail('专项复习启动信息无效或会话已存在', 'REVIEW_SESSION_CONFLICT', 409);
        if (p.itemIds !== undefined && (!Array.isArray(p.itemIds) || p.itemIds.length < 1 || p.itemIds.length > 10
          || p.itemIds.some(itemId => typeof itemId !== 'string' || !itemId)
          || new Set(p.itemIds).size !== p.itemIds.length)) fail('专项复习条目范围无效', 'INVALID_REVIEW_SESSION', 400);
        validatePractice(p.practiceType);
        const book = content.book(p.bookId, userId);
        if (book.revision !== p.bookRevision) fail('课程已更新，请重新读取待复习列表', 'CONTENT_VERSION_CHANGED', 409);
        const rows = list(userId, { bookId: p.bookId, practiceType: p.practiceType, kind: p.kind, limit: 100 }).items;
        const selected = p.itemIds ? rows.filter(row => row.canReview && p.itemIds.includes(row.itemId)) : rows.filter(row => row.canReview).slice(0, 10);
        if (p.itemIds && selected.length !== p.itemIds.length) fail('复习内容已变化或不再到期，请重新读取队列', 'REVIEW_QUEUE_CHANGED', 409);
        const queue = selected.map(row => ({ itemId: row.itemId,
          contentRevision: row.contentRevision, practiceRevision: row.practiceRevision }));
        if (!queue.length) fail('当前筛选没有可用复习内容', 'REVIEW_QUEUE_EMPTY', 409);
        const value = { sessionId: p.sessionId, owner: userId, bookId: p.bookId, bookRevision: book.revision,
          practiceType: p.practiceType, kind: p.kind, queue, index: 0, stepIndex: 0,
          itemHadMistake: false, status: 'in-progress', revision: 1, startedAt: now(), updatedAt: now() };
        upsertEntityRow(userId, 'vocabularyReviewSession', p.sessionId, value, seq);
        return { entity: 'vocabularyReviewSession', id: p.sessionId, action: 'start', status: value.status,
          count: queue.length, completion: false, outcome: 'applied' };
      }
      if (!existing) fail('专项复习会话不存在', 'REVIEW_SESSION_NOT_FOUND', 404);
      const value = JSON.parse(existing.data_json);
      if (value.owner !== userId || value.bookId !== p.bookId || value.practiceType !== p.practiceType
        || value.bookRevision !== p.bookRevision) fail('专项复习会话身份不匹配', 'REVIEW_SESSION_CONFLICT', 409);
      if (value.revision !== p.expectedSessionRev) fail('专项复习位置已变化，请重新读取', 'REVIEW_SESSION_CONFLICT', 409);
      const nextStatus = p.action === 'pause' ? 'paused' : p.action === 'resume' ? 'in-progress' : 'completed';
      if (p.action === 'resume' && value.status !== 'paused' || p.action === 'pause' && value.status !== 'in-progress') fail('专项会话状态已变化', 'REVIEW_SESSION_CONFLICT', 409);
      const next = { ...value, status: nextStatus, revision: value.revision + 1, updatedAt: now() };
      upsertEntityRow(userId, 'vocabularyReviewSession', p.sessionId, next, seq);
      return { entity: 'vocabularyReviewSession', id: p.sessionId, action: p.action, status: next.status,
        completion: false, outcome: 'applied' };
    }

    const allowed = ['sessionId', 'bookId', 'bookRevision', 'itemId', 'contentRevision', 'practiceType', 'inputMode', 'answers', 'stepIndex', 'expectedIndex', 'timeZone'];
    if (Object.keys(p).some(key => !allowed.includes(key)) || typeof p.sessionId !== 'string'
      || !Number.isSafeInteger(p.expectedIndex) || p.expectedIndex < 0) fail('专项作答格式无效', 'INVALID_REVIEW_ATTEMPT', 400);
    if (p.timeZone !== undefined) {
      if (typeof p.timeZone !== 'string' || !p.timeZone || p.timeZone.length > 80) fail('时区无效', 'INVALID_REVIEW_ATTEMPT', 400);
      try { new Intl.DateTimeFormat('en', { timeZone: p.timeZone }); } catch (_) { fail('时区无效', 'INVALID_REVIEW_ATTEMPT', 400); }
    }
    const value = readSession(userId, p.sessionId);
    if (value.status !== 'in-progress' || value.index !== p.expectedIndex) fail('专项复习位置已变化，请重新读取', 'REVIEW_SESSION_CONFLICT', 409);
    if (value.bookId !== p.bookId || value.bookRevision !== p.bookRevision || value.practiceType !== p.practiceType) fail('专项复习身份不匹配', 'REVIEW_SESSION_CONFLICT', 409);
    const book = content.book(value.bookId, userId);
    if (book.revision !== value.bookRevision) {
      const stale = { ...value, status: 'stale', revision: value.revision + 1, updatedAt: now() };
      upsertEntityRow(userId, 'vocabularyReviewSession', value.sessionId, stale, seq);
      return { entity: 'vocabularyReviewSession', id: value.sessionId, action: 'stale', status: 'stale', completion: false, outcome: 'content-stale' };
    }
    const entry = value.queue[value.index];
    if (!entry || entry.itemId !== p.itemId || entry.contentRevision !== p.contentRevision) fail('当前词条不属于专项复习队列', 'REVIEW_SESSION_CONFLICT', 409);
    const currentRef = book.items.find(ref => ref.itemId === entry.itemId);
    if (!currentRef || currentRef.contentRevision !== entry.contentRevision) {
      const stale = { ...value, status: 'stale', revision: value.revision + 1, updatedAt: now() };
      upsertEntityRow(userId, 'vocabularyReviewSession', value.sessionId, stale, seq);
      return { entity: 'vocabularyReviewSession', id: value.sessionId, action: 'stale', status: 'stale', completion: false, outcome: 'content-stale' };
    }
    validatePractice(value.practiceType);
    const item = content.item(entry.itemId, entry.contentRevision, userId);
    const revision = practiceRevision(item, value.practiceType);
    if (!revision || revision !== entry.practiceRevision) {
      const stale = { ...value, status: 'stale', revision: value.revision + 1, updatedAt: now() };
      upsertEntityRow(userId, 'vocabularyReviewSession', value.sessionId, stale, seq);
      return { entity: 'vocabularyReviewSession', id: value.sessionId, action: 'stale', status: 'stale', completion: false, outcome: 'content-stale' };
    }
    if (value.practiceType === 'guided-expression') {
      const steps = guidedContent.forItem(item);
      if (!Number.isSafeInteger(p.stepIndex) || p.stepIndex !== value.stepIndex || !steps || p.stepIndex >= steps.length) fail('引导步骤已变化，请重新开始该词条', 'REVIEW_SESSION_CONFLICT', 409);
    } else if (p.stepIndex !== undefined) fail('当前练习不支持步骤编号', 'INVALID_REVIEW_ATTEMPT', 400);
    let evaluated;
    try { evaluated = attemptEvaluator.evaluate(item, p, { engine: cloze, guidedContent }); }
    catch (error) { fail(error.message, 'INVALID_ATTEMPT', 422); }
    const time = now();
    const isGuided = value.practiceType === 'guided-expression';
    const guidedLength = isGuided ? guidedContent.forItem(item).length : 1;
    const itemFinished = evaluated.correct && (!isGuided || p.stepIndex === guidedLength - 1);
    const firstAttempt = itemFinished && !value.itemHadMistake;
    const identity = identityFor(userId, value.bookId, item, value.practiceType);
    const identityKey = identityForAttempt(identity);
    const scopeKey = 'review:' + crypto.createHash('sha256').update(identityKey).digest('hex');
    const evidence = { ...evaluated, practiceType: value.practiceType, practiceRevision: revision,
      reviewSessionId: value.sessionId, firstAttempt, assisted: false, inputMode: p.inputMode,
      ...(p.stepIndex === undefined ? {} : { stepIndex: p.stepIndex }), answers: p.answers,
      bookRevision: value.bookRevision, ...(p.timeZone ? { timeZone: p.timeZone } : {}) };
    db.prepare(`INSERT INTO vocabulary_attempt_events(user_id,attempt_id,scope_key,session_id,item_id,resource_id,content_revision,data_json,occurred_at,seq)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(userId, body.requestId, scopeKey, value.sessionId, entry.itemId,
      'wordbook:' + value.bookId, entry.contentRevision, JSON.stringify(evidence), time, seq);
    let nextIndex = value.index, nextStepIndex = value.stepIndex;
    let itemHadMistake = value.itemHadMistake || !evaluated.correct;
    if (itemFinished) { nextIndex++; nextStepIndex = 0; itemHadMistake = false; }
    else if (isGuided && evaluated.correct) nextStepIndex++;
    const status = nextIndex >= value.queue.length ? 'completed' : 'in-progress';
    const next = { ...value, index: nextIndex, stepIndex: nextStepIndex, itemHadMistake, status,
      revision: value.revision + 1, updatedAt: time };
    upsertEntityRow(userId, 'vocabularyReviewSession', value.sessionId, next, seq);
    return { entity: 'vocabularyReviewSession', id: value.sessionId, action: 'attempt', correct: evaluated.correct,
      firstAttempt, index: nextIndex, stepIndex: nextStepIndex, status, completion: false, assessment: false, outcome: 'recorded' };
  }

  return { apply, list, session, canPersist };
}

module.exports = { createVocabularyReviewOperations };
