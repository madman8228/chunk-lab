'use strict';

const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');

const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_CHUNKS = 32;
const MAX_SOURCE_ID_LENGTH = 128;
const SCOPED_MERGE_REASONS = new Set([
  'server-not-empty', 'legacy-receipt-unknown', 'legacy-receipt-present', 'legacy-conflict-journal'
]);

function recoveryError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function syncConflictManifest(source) {
  const resolution = source && source.syncResolution;
  const pair = resolution && resolution.kind === 'background-conflict-quarantine' && resolution.pair;
  if (!isObject(pair) || !isObject(pair.local) || !isObject(pair.remote)) return null;
  return {
    kind: 'background-conflict-quarantine',
    version: 1,
    entity: typeof pair.entity === 'string' ? pair.entity : 'unknown',
    batch: pair.batch === true,
    capturedAt: typeof pair.capturedAt === 'string' ? pair.capturedAt : null,
    localHash: sha256(Buffer.from(JSON.stringify(pair.local), 'utf8')),
    remoteHash: sha256(Buffer.from(JSON.stringify(pair.remote), 'utf8'))
  };
}

function parseStoredJson(value, fallback, label) {
  if (value == null || value === '') return fallback;
  try { return JSON.parse(value); }
  catch (_) { throw recoveryError('旧数据' + label + '格式异常，原件已保留', 'INVALID_RECOVERY_BASELINE', 400); }
}

function rowsToMap(rows, keyField, valueField) {
  const result = {};
  (Array.isArray(rows) ? rows : []).forEach(row => {
    if (!isObject(row) || typeof row[keyField] !== 'string' || !row[keyField]) return;
    result[row[keyField]] = valueField ? row[valueField] : row;
  });
  return result;
}

function validateLegacyLogicalCourses(value) {
  if (!Array.isArray(value) || value.length > 1000) {
    throw recoveryError('旧逻辑课程目录结构异常，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
  }
  const seen = new Set();
  value.forEach(course => {
    if (!isObject(course) || Object.keys(course).some(key =>
      !['id', 'title', 'coverImage', 'catalogKey', 'origin', 'contentType', 'createdAt', 'updatedAt'].includes(key)) ||
        typeof course.id !== 'string' || !course.id.startsWith('logical-course:') || course.id.length > 200 ||
        seen.has(course.id) || typeof course.title !== 'string' || !course.title.trim() || course.title.length > 120 ||
        typeof course.coverImage !== 'string' || course.coverImage.length > 2 * 1024 * 1024 ||
        typeof course.catalogKey !== 'string' || course.catalogKey !== 'logical:' + course.id ||
        course.origin !== 'user' || course.contentType !== 'story' ||
        typeof course.createdAt !== 'string' || course.createdAt.length > 50 ||
        typeof course.updatedAt !== 'string' || course.updatedAt.length > 50) {
      throw recoveryError('旧逻辑课程目录内容无效，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
    }
    seen.add(course.id);
  });
  return value;
}

function buildLegacyBaseline(source) {
  const local = source.localStorage || {};
  const stores = source.stores || {};
  const defaultMem = { decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, settings: {} };
  let mem = parseStoredJson(local['chunklab.v1'], null, '主档案');
  if (!isObject(mem)) {
    const businessMeta = (Array.isArray(stores.syncMeta) ? stores.syncMeta : [])
      .find(row => row && row.key === 'business-mem-v1' && isObject(row.data));
    if (!businessMeta) throw recoveryError('找不到完整的旧学习档案，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
    mem = Object.assign({}, businessMeta.data);
  }
  if (Object.prototype.hasOwnProperty.call(mem, 'reinforceBook')) {
    if (!Array.isArray(mem.reinforceBook)) {
      throw recoveryError('旧错题列表结构异常，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
    }
  } else {
    mem.reinforceBook = parseStoredJson(local.chunklab_reinforce, [], '错题列表');
    if (!Array.isArray(mem.reinforceBook)) {
      throw recoveryError('旧错题列表结构异常，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
    }
  }
  mem = Object.assign({}, defaultMem, mem);
  mem.stats = Object.assign({}, defaultMem.stats, isObject(mem.stats) ? mem.stats : {});

  const localCourses = parseStoredJson(local['chunklab.courses.v1'], [], '课程列表');
  const localProgress = parseStoredJson(local['chunklab.course-progress.v1'], {}, '课程进度');
  const logicalCourses = validateLegacyLogicalCourses(parseStoredJson(local['chunklab.logical-courses.v1'], [], '逻辑课程目录'));
  if (!Array.isArray(localCourses) || !isObject(localProgress)) {
    throw recoveryError('旧课程或进度结构异常，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
  }
  const courseMap = rowsToMap(localCourses, 'courseId');
  (Array.isArray(stores.courses) ? stores.courses : []).forEach(row => {
    if (isObject(row) && typeof row.courseId === 'string' && row.courseId) courseMap[row.courseId] = row;
  });
  const progress = Object.assign({}, localProgress);
  (Array.isArray(stores.progress) ? stores.progress : []).forEach(row => {
    if (isObject(row) && typeof row.cid === 'string' && row.cid) progress[row.cid] = row.data;
  });

  const bySentence = Object.assign({}, isObject(mem.stats.bySentence) ? mem.stats.bySentence : {});
  (Array.isArray(stores.sentenceStats) ? stores.sentenceStats : []).forEach(row => {
    if (isObject(row) && typeof row.key === 'string' && row.key && isObject(row.data)) bySentence[row.key] = row.data;
  });
  const eventMap = new Map();
  (Array.isArray(stores.events) ? stores.events : []).forEach(row => {
    if (isObject(row) && typeof row.id === 'string' && row.id) eventMap.set(row.id, row);
  });
  (Array.isArray(mem.stats.events) ? mem.stats.events : []).forEach(row => {
    if (isObject(row) && typeof row.id === 'string' && row.id && !eventMap.has(row.id)) eventMap.set(row.id, row);
  });
  mem.stats.bySentence = bySentence;
  mem.stats.events = Array.from(eventMap.values());
  const revs = parseStoredJson(local.chunklab_revs_v1, {}, '版本信息');
  if (!isObject(revs)) throw recoveryError('旧版本信息结构异常，原件已保留', 'INVALID_RECOVERY_BASELINE', 400);
  return { mem, courses: Object.keys(courseMap).map(id => courseMap[id]), courseProgress: progress, logicalCourses, revs };
}

function collectPendingRequestIds(source) {
  return collectPendingRequests(source).map(row => row.requestId);
}

function collectPendingRequests(source) {
  const requests = new Map();
  const stores = source.stores || source.indexedDB || {};
  (Array.isArray(stores.pendingOperations) ? stores.pendingOperations : []).forEach(row => {
    if (row && typeof row.requestId === 'string' && row.requestId) {
      requests.set(row.requestId, { requestId: row.requestId, kind: 'operation', fenced: false });
    }
  });
  (Array.isArray(stores.syncMeta) ? stores.syncMeta : []).forEach(row => {
    const requestId = row && row.key === 'conditional-batch-v1' && row.pending && row.pending.requestId;
    if (typeof requestId === 'string' && requestId) {
      const prior = requests.get(requestId);
      requests.set(requestId, { requestId, kind: 'legacy-batch', fenced: !prior || prior.fenced });
    }
  });
  (Array.isArray(stores.syncIntents) ? stores.syncIntents : []).forEach(row => {
    const frozen = row && row.frozen;
    const requestId = frozen && frozen.payload && frozen.payload.requestId;
    if (typeof requestId === 'string' && requestId) {
      const prior = requests.get(requestId);
      requests.set(requestId, { requestId, kind: 'legacy-batch', fenced: !prior || prior.fenced });
    }
  });
  const resolutionRequest = source.syncResolution && source.syncResolution.request && source.syncResolution.request.requestId;
  if (typeof resolutionRequest === 'string' && resolutionRequest) {
    const prior = requests.get(resolutionRequest);
    requests.set(resolutionRequest, { requestId: resolutionRequest, kind: 'legacy-resolution', fenced: !prior || prior.fenced });
  }
  return Array.from(requests.values()).sort((a, b) => a.requestId.localeCompare(b.requestId));
}

function isCurrentOperationNotStartedAtCapture(source, requestId, expectedOwnerIdentity) {
  if (!source || source.sourceKind !== 'account-local' || typeof source.owner !== 'string') return false;
  let owner;
  try { owner = JSON.parse(source.owner); } catch (_) { return false; }
  if (!Array.isArray(owner) || owner.length !== 2 || owner.some(value => typeof value !== 'string' || !value) ||
      owner[1] !== String(expectedOwnerIdentity)) return false;
  const stores = source.stores || source.indexedDB || {};
  const rows = Array.isArray(stores.pendingOperations) ? stores.pendingOperations : [];
  const matches = rows.filter(row => row && row.requestId === requestId);
  if (matches.length !== 1) return false;
  const row = matches[0];
  const operation = row.operation;
  const base = owner[0];
  if (!isObject(operation) || operation.protocol !== 3 || operation.requestId !== requestId ||
      row.owner !== source.owner || row.base !== base || row.scope !== JSON.stringify([base, source.owner, 3]) ||
      row.attemptEvidenceVersion !== 1 || row.attemptStartedAt != null || !Number.isSafeInteger(row.ordinal) ||
      row.ordinal < 1 || Number(row.attempts) !== 0) return false;
  return true;
}

function legacyIntentCurrentValue(source, entity, id) {
  const stores = source.stores || source.indexedDB || {};
  const local = source.localStorage || {};
  try {
    if (entity === 'courses') {
      const storedCourse = (Array.isArray(stores.courses) ? stores.courses : [])
        .find(row => row && row.courseId === id);
      if (storedCourse) return storedCourse;
      const localCourses = parseStoredJson(local['chunklab.courses.v1'], [], '课程列表');
      return Array.isArray(localCourses) ? localCourses.find(row => row && row.courseId === id) : undefined;
    }
    if (entity === 'courseProgress') {
      const row = (Array.isArray(stores.progress) ? stores.progress : []).find(item => item && item.cid === id);
      if (row) return row.data;
      const progress = parseStoredJson(local['chunklab.course-progress.v1'], {}, '课程进度');
      return progress && progress[id];
    }
    if (entity === 'decks') {
      const businessMeta = (Array.isArray(stores.syncMeta) ? stores.syncMeta : [])
        .find(row => row && row.key === 'business-mem-v1' && isObject(row.data));
      const mem = parseStoredJson(local['chunklab.v1'], businessMeta && businessMeta.data, '主档案');
      return mem && Array.isArray(mem.decks) ? mem.decks.find(deck => deck && deck.id === id) : undefined;
    }
  } catch (_) { return undefined; }
  return undefined;
}

function collectUnfrozenSyncIntents(source) {
  if (!source || typeof source.owner !== 'string') return [];
  let ownerScope;
  try {
    const owner = JSON.parse(source.owner);
    if (!Array.isArray(owner) || owner.length !== 2 || owner.some(value => typeof value !== 'string' || !value)) return [];
    ownerScope = JSON.stringify(owner);
  } catch (_) { return []; }
  const stores = source.stores || source.indexedDB || {};
  const intents = Array.isArray(stores.syncIntents) ? stores.syncIntents : [];
  const frozenIds = new Set(intents.filter(row => row && row.frozen)
    .map(row => row.frozen.operationId || row.operationId).filter(value => typeof value === 'string'));
  const unique = new Map();
  intents.forEach(row => {
    const frozenOperationId = row && row.frozen && (row.frozen.operationId || row.operationId);
    if (!row || row.scope !== ownerScope || (row.frozen && row.operationId === frozenOperationId) || typeof row.operationId !== 'string' ||
        !row.operationId || row.operationId.length > 200 || frozenIds.has(row.operationId) ||
        !['courses', 'courseProgress', 'decks'].includes(row.entity) || typeof row.id !== 'string' ||
        !row.id || row.id.length > 200) return;
    if (!row.deleted) {
      const currentValue = legacyIntentCurrentValue(source, row.entity, row.id);
      if (currentValue === undefined || stableJson(currentValue) !== stableJson(row.value)) return;
    }
    const intent = { operationId: row.operationId, entity: row.entity, id: row.id,
      status: 'not-committed', proof: 'no-frozen-request' };
    const previous = unique.get(row.operationId);
    if (previous && (previous.entity !== intent.entity || previous.id !== intent.id)) {
      unique.delete(row.operationId);
      frozenIds.add(row.operationId);
      return;
    }
    if (!frozenIds.has(row.operationId)) unique.set(row.operationId, intent);
  });
  return Array.from(unique.values()).sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function collectFencedSyncIntents(source, receipts) {
  if (!source || typeof source.owner !== 'string') return [];
  let ownerScope;
  try {
    const owner = JSON.parse(source.owner);
    if (!Array.isArray(owner) || owner.length !== 2 || owner.some(value => typeof value !== 'string' || !value)) return [];
    ownerScope = JSON.stringify(owner);
  } catch (_) { return []; }
  const safeRequests = new Set((Array.isArray(receipts) ? receipts : [])
    .filter(receipt => receipt && receipt.kind === 'legacy-batch' && receipt.receipt === 'not-committed' &&
      receipt.proof === 'protocol-3-write-fence')
    .map(receipt => receipt.requestId));
  const stores = source.stores || source.indexedDB || {};
  const unique = new Map();
  const conflicted = new Set();
  (Array.isArray(stores.syncIntents) ? stores.syncIntents : []).forEach(row => {
    const frozen = row && row.frozen;
    const payload = frozen && frozen.payload;
    const requestId = payload && payload.requestId;
    const operationId = frozen && (frozen.operationId || row.operationId);
    if (!row || row.scope !== ownerScope || !frozen || typeof requestId !== 'string' || !safeRequests.has(requestId) ||
        typeof operationId !== 'string' || !operationId || operationId.length > 200 ||
        typeof frozen.deleted !== 'boolean' ||
        !['courses', 'courseProgress', 'decks'].includes(row.entity) || typeof row.id !== 'string' || !row.id || row.id.length > 200) return;
    const entityPayload = payload && payload.deleted && payload.deleted[row.entity];
    const deletion = Array.isArray(entityPayload) && entityPayload.some(item => item && item.id === row.id);
    if (frozen.deleted ? !deletion : row.entity === 'decks'
      ? !Array.isArray(payload.decks) || !payload.decks.some(deck => deck && deck.id === row.id &&
        stableJson(deck) === stableJson(frozen.value))
      : row.entity === 'courses'
      ? !Array.isArray(payload.courses) || !payload.courses.some(course => course && course.courseId === row.id &&
        stableJson(course) === stableJson(frozen.value))
      : !payload.courseProgress || !Object.prototype.hasOwnProperty.call(payload.courseProgress, row.id) ||
        stableJson(payload.courseProgress[row.id]) !== stableJson(frozen.value)) return;
    if (conflicted.has(operationId)) return;
    const previous = unique.get(operationId);
    if (previous && (previous.entity !== row.entity || previous.id !== row.id || previous.sourceRequestId !== requestId)) {
      unique.delete(operationId);
      conflicted.add(operationId);
      return;
    }
    unique.set(operationId, { operationId, entity: row.entity, id: row.id, sourceRequestId: requestId,
      status: 'not-committed', proof: 'protocol-3-write-fence', deleted: frozen.deleted });
  });
  return Array.from(unique.values()).sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function mapLegacyIntentsToRecoveryOperations(source, migrationItems, baselineRequestId, legacyReceipts) {
  const intents = collectUnfrozenSyncIntents(source).concat(collectFencedSyncIntents(source, legacyReceipts))
    .sort((a, b) => a.operationId.localeCompare(b.operationId));
  return intents.map(intent => {
    const mapping = Object.assign({}, intent);
    delete mapping.deleted;
    if (baselineRequestId) return Object.assign(mapping, { status: 'applied', requestId: baselineRequestId });
    if (intent.proof === 'protocol-3-write-fence' && intent.deleted) {
      return Object.assign(mapping, { status: 'retained-with-reason', reason: 'legacy-delete-not-auto-replayed' });
    }
    const group = intent.entity === 'courses' ? 'courses' : intent.entity === 'courseProgress' ? 'courseProgress' : 'decks';
    const item = migrationItems[group + '/' + intent.id];
    if (!item) return Object.assign(mapping, { status: 'retained-with-reason', reason: 'legacy-intent-unmapped' });
    if (item.status === 'applied') return Object.assign(mapping, { status: 'applied', requestId: item.requestId });
    if (item.status === 'already-present') return Object.assign(mapping, { status: 'already-present' });
    return Object.assign(mapping, { status: 'retained-with-reason', reason: item.reason || item.status });
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (!isObject(value)) return JSON.stringify(value);
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
}

function equivalentMergeValue(group, current, source, expectedGeneration) {
  if (group === 'decks') {
    const comparableDeck = value => ({ id: value.id, name: value.name, items: value.items || [], builtin: !!value.builtin });
    return stableJson(comparableDeck(current)) === stableJson(comparableDeck(source));
  }
  if (group === 'courseProgress') {
    const comparableProgress = value => Object.assign({}, value, { generation: expectedGeneration });
    return stableJson(comparableProgress(current)) === stableJson(comparableProgress(source));
  }
  return stableJson(current) === stableJson(source);
}

function makeMergePreview(candidate, snapshot) {
  if (!isObject(snapshot) || !isObject(snapshot.mem)) return null;
  const sourceGroups = {
    decks: Array.isArray(candidate.mem.decks) ? candidate.mem.decks : [],
    courses: Array.isArray(candidate.courses) ? candidate.courses : [],
    courseProgress: Object.keys(candidate.courseProgress || {}).map(id => ({ id, value: candidate.courseProgress[id] })),
    logicalCourses: Array.isArray(candidate.logicalCourses) ? candidate.logicalCourses : []
  };
  const currentGroups = {
    decks: new Map((snapshot.mem.decks || []).map(row => [row.id, row])),
    courses: new Map((snapshot.courses || []).map(row => [row.courseId, row])),
    courseProgress: new Map(Object.keys(snapshot.courseProgress || {}).map(id => [id, snapshot.courseProgress[id]])),
    logicalCourses: new Map(Object.keys(snapshot.mem.logicalCourses || {}).map(id => [id, snapshot.mem.logicalCourses[id]]))
  };
  const deleted = snapshot.deleted || {};
  const revisions = snapshot.revs || {};
  const gone = snapshot.entityGone || {};
  const tombstones = {
    decks: new Set([...(deleted.decks || []), ...Object.keys(revisions.decks || {}).filter(id => !currentGroups.decks.has(id))]),
    courses: new Set([...(deleted.courses || []), ...Object.keys(revisions.courses || {}).filter(id => !currentGroups.courses.has(id))]),
    courseProgress: new Set([...(deleted.courseProgress || []), ...Object.keys(revisions.courseProgress || {}).filter(id => !currentGroups.courseProgress.has(id))]),
    logicalCourses: new Set(gone.logicalCourse || [])
  };
  const items = {};
  const counts = {};
  Object.keys(sourceGroups).forEach(group => {
    items[group] = sourceGroups[group].map(sourceRow => {
      const id = group === 'courses' ? sourceRow.courseId : group === 'courseProgress' ? sourceRow.id : sourceRow.id;
      const sourceValue = group === 'courseProgress' ? sourceRow.value : sourceRow;
      const currentValue = currentGroups[group].get(id);
      const expectedGeneration = group === 'courseProgress'
        ? Number(snapshot.learningGenerations && snapshot.learningGenerations['course:' + id]) || 0 : undefined;
      let status = 'add';
      let reason = null;
      if (currentValue !== undefined) {
        if (equivalentMergeValue(group, currentValue, sourceValue, expectedGeneration)) status = 'already-present';
        else { status = 'retained'; reason = 'same-id-different-content'; }
      } else if (tombstones[group].has(id)) {
        status = 'retained'; reason = 'server-deletion-evidence';
      } else if (group === 'decks' && sourceValue.builtin) {
        status = 'retained'; reason = 'builtin-deck-requires-item-scoped-restore';
      }
      const item = { id, label: sourceValue.name || sourceValue.title || id, status, reason };
      if (group === 'courseProgress' && status === 'add') {
        const sourceCourse = sourceGroups.courses.find(course => course.courseId === id);
        const sourceCourseState = (items.courses || []).find(course => course.id === id);
        const activeCourse = currentGroups.courses.get(id);
        if (!isObject(sourceValue)) {
          item.status = 'retained'; item.reason = 'invalid-course-progress';
        } else if (id.indexOf('enrollment:v1:') === 0) {
          item.status = 'retained'; item.reason = 'course-enrollment-not-yet-supported';
        } else if (!sourceCourse) {
          item.status = 'retained'; item.reason = 'course-content-not-in-source';
        } else if (sourceCourseState && sourceCourseState.status === 'retained') {
          item.status = 'retained'; item.reason = 'course-content-conflict-or-deletion';
        } else if (sourceValue.courseVersion && sourceCourse.version && sourceValue.courseVersion !== sourceCourse.version) {
          item.status = 'retained'; item.reason = 'course-version-mismatch';
        } else {
          item.expectedGeneration = expectedGeneration;
          if (!activeCourse && (!sourceCourseState || sourceCourseState.status !== 'add')) {
            item.status = 'retained'; item.reason = 'course-content-not-active';
          }
        }
      }
      return item;
    });
    counts[group] = { add: 0, 'already-present': 0, retained: 0 };
    items[group].forEach(item => { counts[group][item.status] += 1; });
  });
  const stats = candidate.mem.stats || {};
  const hasLearningStatistics = !!(stats.totalAnswered || stats.totalRounds || stats.daysLog && Object.keys(stats.daysLog).length ||
    stats.events && stats.events.length || stats.bySentence && Object.keys(stats.bySentence).length);
  const mem = candidate.mem;
  const hasLearningMarks = !!((mem.mastered && Object.keys(mem.mastered).length) ||
    (mem.deletedItems && Object.keys(mem.deletedItems).length) || (mem.best && Object.keys(mem.best).length) ||
    (Array.isArray(mem.reinforceBook) && mem.reinforceBook.length));
  return { policy: 'disjoint-content-only', items, counts,
    deferred: { learningStatistics: hasLearningStatistics ? 'aggregate-statistics-not-mergeable' : null,
      learningMarks: hasLearningMarks ? 'learning-marks-not-yet-classified' : null } };
}

function normalizeMergeSelection(value) {
  const selection = value === undefined ? {} : value;
  if (!isObject(selection) || Object.keys(selection).some(key => !['decks', 'courses', 'courseProgress', 'logicalCourses'].includes(key))) {
    throw recoveryError('恢复范围无效；当前仅支持题库、课程、课程进度和逻辑课程目录', 'INVALID_RECOVERY_SELECTION', 400);
  }
  let total = 0;
  const normalized = {};
  ['decks', 'courses', 'courseProgress', 'logicalCourses'].forEach(group => {
    const ids = selection[group] === undefined ? [] : selection[group];
    if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => typeof id !== 'string' || !id || id.length > 200) ||
        new Set(ids).size !== ids.length) {
      throw recoveryError('恢复范围中的编号无效或重复', 'INVALID_RECOVERY_SELECTION', 400);
    }
    total += ids.length;
    normalized[group] = ids.slice().sort();
  });
  if (!total || total > 1000) throw recoveryError('请选择 1 至 1000 个无冲突内容再恢复', 'INVALID_RECOVERY_SELECTION', 400);
  return normalized;
}

function createRecoveryIngest(db, options) {
  options = options || {};
  const maxSourceBytes = options.maxSourceBytes || MAX_SOURCE_BYTES;
  const ownerIdentityForUser = options.ownerIdentityForUser || (userId => String(userId));
  const validatePutPayload = options.validatePutPayload;
  const saveLegacyBaseline = options.saveLegacyBaseline;
  const currentSeq = options.currentSeq;
  const readCurrentSnapshot = options.readCurrentSnapshot;
  const executeRecoveryOperation = options.executeRecoveryOperation;
  const legacyWritesFenced = options.legacyWritesFenced === true;
  const isAccountEmpty = options.isAccountEmpty || (typeof currentSeq === 'function'
    ? userId => currentSeq(userId) === 0
    : null);
  const selectById = db.prepare('SELECT source_id,source_hash,codec,payload_blob,manifest_json,created_at FROM user_recovery_sources WHERE user_id=? AND source_id=?');
  const selectByHash = db.prepare('SELECT source_id,source_hash,codec,payload_blob,manifest_json,created_at FROM user_recovery_sources WHERE user_id=? AND source_hash=?');
  const listSourcesPage = db.prepare('SELECT source_id,source_hash,codec,length(payload_blob) AS compressed_bytes,manifest_json,created_at FROM user_recovery_sources WHERE user_id=? AND (? IS NULL OR created_at<? OR (created_at=? AND source_id<?)) ORDER BY created_at DESC,source_id DESC LIMIT ?');
  const insertSource = db.prepare('INSERT INTO user_recovery_sources(user_id,source_id,source_hash,codec,payload_blob,manifest_json) VALUES(?,?,?,?,?,?)');
  const batchReceipt = db.prepare('SELECT seq FROM user_batch_receipts WHERE user_id=? AND request_id=?');
  const operationReceipt = db.prepare('SELECT result_json FROM user_operation_receipts WHERE user_id=? AND request_id=?');
  const legacyResolutionReceipt = db.prepare('SELECT result_json FROM user_sync_resolutions WHERE user_id=? AND request_id=?');
  const selectUpload = db.prepare('SELECT source_hash,chunk_count,uncompressed_bytes FROM user_recovery_source_uploads WHERE user_id=? AND source_id=?');
  const insertUpload = db.prepare('INSERT INTO user_recovery_source_uploads(user_id,source_id,source_hash,chunk_count,uncompressed_bytes) VALUES(?,?,?,?,?)');
  const selectChunk = db.prepare('SELECT chunk_hash,chunk_blob FROM user_recovery_source_chunks WHERE user_id=? AND source_id=? AND chunk_index=?');
  const insertChunk = db.prepare('INSERT INTO user_recovery_source_chunks(user_id,source_id,chunk_index,chunk_hash,chunk_blob) VALUES(?,?,?,?,?)');
  const listChunks = db.prepare('SELECT chunk_index,chunk_hash,chunk_blob FROM user_recovery_source_chunks WHERE user_id=? AND source_id=? ORDER BY chunk_index');
  const deleteChunks = db.prepare('DELETE FROM user_recovery_source_chunks WHERE user_id=? AND source_id=?');
  const deleteUpload = db.prepare('DELETE FROM user_recovery_source_uploads WHERE user_id=? AND source_id=?');

function receiptManifest(userId, source) {
    return collectPendingRequests(source).map(pending => {
      const requestId = pending.requestId;
      const batch = batchReceipt.get(userId, requestId);
      if (batch) return { requestId, receipt: 'found', kind: 'legacy-batch', seq: Number(batch.seq) };
      const operation = operationReceipt.get(userId, requestId);
      if (operation) {
        let result = null;
        try { result = JSON.parse(operation.result_json); } catch (_) { /* receipt presence is still authoritative */ }
        return { requestId, receipt: 'found', kind: 'operation', seq: result && Number.isSafeInteger(result.seq) ? result.seq : null };
      }
      const resolution = legacyResolutionReceipt.get(userId, requestId);
      if (resolution) {
        let result = null;
        try { result = JSON.parse(resolution.result_json); } catch (_) { /* receipt presence is still authoritative */ }
        return { requestId, receipt: 'found', kind: 'legacy-resolution', seq: result && Number.isSafeInteger(result.seq) ? result.seq : null };
      }
      // ServerStore marks attemptEvidenceVersion when the queue row is first
      // persisted, then writes attemptStartedAt in IndexedDB before fetch.
      // For a locally captured source, exact owner/base/scope and the absent
      // send marker prove only that sending had not started at capture time;
      // another tab may send immediately afterwards. Keep the receipt unknown
      // and annotate that any later handover must reuse the same request/body.
      // Imported backups and pre-marker rows do not carry this annotation.
      if (isCurrentOperationNotStartedAtCapture(source, requestId, ownerIdentityForUser(userId))) {
        return { requestId, receipt: 'unknown', kind: pending.kind, seq: null,
          replayProof: 'durable-not-started-at-capture', replayPolicy: 'same-request-id-and-body-only' };
      }
      // A durable current-operation row can still be in flight from another
      // tab, so absence remains unknown. Legacy snapshot/resolution endpoints
      // are fenced by protocol 3; after that persistent fence, no old request
      // can commit later and a missing permanent receipt proves it was not
      // applied. This enables safe empty-account baseline migration only.
      if (legacyWritesFenced && pending.fenced) {
        return { requestId, receipt: 'not-committed', kind: pending.kind, seq: null, proof: 'protocol-3-write-fence' };
      }
      return { requestId, receipt: 'unknown', kind: pending.kind, seq: null };
    });
  }

  function preserveReceiptEvidence(previous, refreshed) {
    const prior = new Map((Array.isArray(previous) ? previous : [])
      .filter(row => row && typeof row.requestId === 'string').map(row => [row.requestId, row]));
    const seen = new Set();
    const merged = (Array.isArray(refreshed) ? refreshed : []).map(row => {
      seen.add(row.requestId);
      const old = prior.get(row.requestId);
      return old && ['found', 'not-committed'].includes(old.receipt) && row.receipt !== old.receipt ? old : row;
    });
    prior.forEach((row, requestId) => {
      if (!seen.has(requestId)) merged.push(row);
    });
    return merged;
  }

  function unpack(payload) {
    if (!Buffer.isBuffer(payload) || payload.length === 0) {
      throw recoveryError('恢复来源为空或格式不正确', 'INVALID_RECOVERY_SOURCE', 400);
    }
    if (payload.length > maxSourceBytes) {
      throw recoveryError('恢复来源超过允许大小', 'RECOVERY_SOURCE_TOO_LARGE', 413);
    }
    let raw;
    try { raw = gunzipSync(payload, { maxOutputLength: maxSourceBytes }); }
    catch (_) { throw recoveryError('恢复来源压缩数据损坏或超过大小限制', 'INVALID_RECOVERY_SOURCE', 400); }
    let source;
    try { source = JSON.parse(raw.toString('utf8')); }
    catch (_) { throw recoveryError('恢复来源不是有效 JSON', 'INVALID_RECOVERY_SOURCE', 400); }
    if (!isObject(source) || source.format !== 'chunklab.recovery-source' || source.version !== 1 ||
        !isObject(source.stores) || !isObject(source.localStorage) ||
        (source.redactedPrivateFields !== undefined && (!Array.isArray(source.redactedPrivateFields) ||
          source.redactedPrivateFields.length > 500 || source.redactedPrivateFields.some(path => typeof path !== 'string' || path.length > 500)))) {
      throw recoveryError('恢复来源版本或内容不受支持', 'INVALID_RECOVERY_SOURCE', 400);
    }
    return { raw, source };
  }

  function ingest(input) {
    if (!input || !Number.isSafeInteger(input.userId) || input.userId < 1) {
      throw recoveryError('恢复来源必须关联有效账号', 'INVALID_RECOVERY_ACCOUNT', 401);
    }
    const sourceId = input.sourceId;
    if (typeof sourceId !== 'string' || !sourceId || sourceId.length > MAX_SOURCE_ID_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(sourceId)) {
      throw recoveryError('恢复来源编号无效', 'INVALID_SOURCE_ID', 400);
    }
    if (input.codec !== 'gzip') throw recoveryError('不支持的恢复来源压缩格式', 'UNSUPPORTED_RECOVERY_CODEC', 415);
    if (typeof input.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceHash)) {
      throw recoveryError('恢复来源校验值无效', 'INVALID_SOURCE_HASH', 400);
    }
    const { raw, source } = unpack(input.payload);
    const actualHash = sha256(raw);
    if (actualHash !== input.sourceHash) throw recoveryError('恢复来源校验失败，原数据未接管', 'SOURCE_HASH_MISMATCH', 400);

    const commit = db.transaction(() => {
      const existingId = selectById.get(input.userId, sourceId);
      if (existingId) {
        if (existingId.source_hash !== actualHash) {
          throw recoveryError('该来源编号已对应其他内容，原记录保持不变', 'SOURCE_ID_REUSED', 409);
        }
        return { created: false, row: existingId };
      }
      const existingHash = selectByHash.get(input.userId, actualHash);
      if (existingHash) return { created: false, row: existingHash };

      const manifest = {
        version: 1,
        state: 'archived-not-merged',
        verified: false,
        sourceId,
        sourceHash: actualHash,
        uncompressedBytes: raw.length,
        compressedBytes: input.payload.length,
        redactedPrivateFields: source.redactedPrivateFields || [],
        legacyReceipts: receiptManifest(input.userId, source),
        legacyIntents: collectUnfrozenSyncIntents(source),
        syncConflict: syncConflictManifest(source)
      };
      insertSource.run(input.userId, sourceId, actualHash, 'gzip', input.payload, JSON.stringify(manifest));

      // Verify the durable row itself before committing its success manifest.
      const saved = selectById.get(input.userId, sourceId);
      let roundTrip;
      try { roundTrip = gunzipSync(saved.payload_blob, { maxOutputLength: maxSourceBytes }); }
      catch (_) { throw recoveryError('服务器归档校验失败，事务已回滚', 'RECOVERY_ARCHIVE_VERIFY_FAILED', 500); }
      if (sha256(roundTrip) !== actualHash || !roundTrip.equals(raw)) {
        throw recoveryError('服务器归档校验失败，事务已回滚', 'RECOVERY_ARCHIVE_VERIFY_FAILED', 500);
      }
      manifest.verified = true;
      db.prepare('UPDATE user_recovery_sources SET manifest_json=? WHERE user_id=? AND source_id=?')
        .run(JSON.stringify(manifest), input.userId, sourceId);
      return { created: true, row: Object.assign({}, saved, { manifest_json: JSON.stringify(manifest) }) };
    });

    const result = commit();
    return {
      ok: true,
      sourceId: result.row.source_id,
      sourceHash: result.row.source_hash,
      state: result.created ? 'archived' : 'already-present',
      manifest: JSON.parse(result.row.manifest_json)
    };
  }

  function refreshManifest(input) {
    if (!input || !Number.isSafeInteger(input.userId) || input.userId < 1) {
      throw recoveryError('恢复来源必须关联有效账号', 'INVALID_RECOVERY_ACCOUNT', 401);
    }
    if (typeof input.sourceId !== 'string' || !input.sourceId || input.sourceId.length > MAX_SOURCE_ID_LENGTH ||
        !/^[A-Za-z0-9._:-]+$/.test(input.sourceId)) {
      throw recoveryError('恢复来源编号无效', 'INVALID_SOURCE_ID', 400);
    }
    const row = selectById.get(input.userId, input.sourceId);
    if (!row) throw recoveryError('恢复来源不存在', 'RECOVERY_SOURCE_NOT_FOUND', 404);
    const { raw, source } = unpack(row.payload_blob);
    if (sha256(raw) !== row.source_hash) {
      throw recoveryError('已归档来源校验失败，未更改恢复清单', 'RECOVERY_ARCHIVE_VERIFY_FAILED', 500);
    }
    const manifest = JSON.parse(row.manifest_json);
    if (manifest.verified !== true || manifest.sourceHash !== row.source_hash) {
      throw recoveryError('恢复来源尚未通过完整性验证', 'RECOVERY_ARCHIVE_UNVERIFIED', 409);
    }
    // Receipt absence is not proof that a request was never submitted. Refresh
    // only moves unknown entries to found; it never authorizes replay or drops
    // the immutable source/pending record.
    const receipts = preserveReceiptEvidence(manifest.legacyReceipts, receiptManifest(input.userId, source));
    const nextManifest = Object.assign({}, manifest, { legacyReceipts: receipts });
    db.prepare('UPDATE user_recovery_sources SET manifest_json=? WHERE user_id=? AND source_id=?')
      .run(JSON.stringify(nextManifest), input.userId, input.sourceId);
    return { ok: true, sourceId: row.source_id, sourceHash: row.source_hash, manifest: nextManifest };
  }

  function listSources(input) {
    if (!input || !Number.isSafeInteger(input.userId) || input.userId < 1) {
      throw recoveryError('恢复来源必须关联有效账号', 'INVALID_RECOVERY_ACCOUNT', 401);
    }
    const limit = input.limit === undefined ? 50 : input.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw recoveryError('恢复来源分页大小无效', 'INVALID_RECOVERY_PAGE', 400);
    }
    let before = null;
    if (input.cursor !== undefined && input.cursor !== null && input.cursor !== '') {
      if (typeof input.cursor !== 'string' || input.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(input.cursor)) {
        throw recoveryError('恢复来源分页标记无效', 'INVALID_RECOVERY_CURSOR', 400);
      }
      try {
        const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
        if (!parsed || typeof parsed.createdAt !== 'string' || !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(parsed.createdAt) ||
            typeof parsed.sourceId !== 'string' || !parsed.sourceId || parsed.sourceId.length > MAX_SOURCE_ID_LENGTH ||
            !/^[A-Za-z0-9._:-]+$/.test(parsed.sourceId)) throw new Error('invalid cursor fields');
        before = parsed;
      } catch (_) {
        throw recoveryError('恢复来源分页标记无效', 'INVALID_RECOVERY_CURSOR', 400);
      }
    }
    const rows = listSourcesPage.all(input.userId, before ? before.createdAt : null,
      before ? before.createdAt : null, before ? before.createdAt : null,
      before ? before.sourceId : null, limit + 1);
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const items = rows.map(row => {
      let manifest;
      try { manifest = JSON.parse(row.manifest_json); }
      catch (_) { throw recoveryError('恢复来源清单损坏；原件仍保留', 'RECOVERY_MANIFEST_CORRUPT', 500); }
      const receipts = Array.isArray(manifest.legacyReceipts) ? manifest.legacyReceipts : [];
      const migration = manifest.migration && typeof manifest.migration === 'object' ? manifest.migration : null;
      return {
        sourceId: row.source_id,
        sourceHash: row.source_hash,
        codec: row.codec,
        compressedBytes: row.compressed_bytes,
        createdAt: row.created_at,
        verified: manifest.verified === true && manifest.sourceHash === row.source_hash,
        state: typeof manifest.state === 'string' ? manifest.state : 'archived-not-merged',
        migrationStatus: migration && typeof migration.status === 'string' ? migration.status : 'not-started',
        legacyIntentCounts: (Array.isArray(manifest.legacyIntents) ? manifest.legacyIntents : []).reduce((counts, intent) => {
          const status = intent && typeof intent.status === 'string' ? intent.status : 'invalid';
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        }, {}),
        receiptCounts: receipts.reduce((counts, receipt) => {
          const status = receipt && ['found', 'unknown', 'not-committed'].includes(receipt.receipt) ? receipt.receipt : 'invalid';
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        }, {})
      };
    });
    const last = rows[rows.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.created_at, sourceId: last.source_id })).toString('base64url')
      : null;
    return { ok: true, items, nextCursor };
  }

  function listHandoverOperations(input) {
    if (!input || !Number.isSafeInteger(input.userId) || input.userId < 1) {
      throw recoveryError('恢复来源必须关联有效账号', 'INVALID_RECOVERY_ACCOUNT', 401);
    }
    if (typeof input.sourceId !== 'string' || !input.sourceId || input.sourceId.length > MAX_SOURCE_ID_LENGTH ||
        !/^[A-Za-z0-9._:-]+$/.test(input.sourceId)) {
      throw recoveryError('恢复来源编号无效', 'INVALID_SOURCE_ID', 400);
    }
    const limit = input.limit === undefined ? 50 : input.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw recoveryError('待接管操作分页大小无效', 'INVALID_RECOVERY_PAGE', 400);
    }
    let after = null;
    if (input.cursor !== undefined && input.cursor !== null && input.cursor !== '') {
      if (typeof input.cursor !== 'string' || input.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(input.cursor)) {
        throw recoveryError('待接管操作分页标记无效', 'INVALID_RECOVERY_CURSOR', 400);
      }
      try {
        const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
        if (!parsed || !Number.isSafeInteger(parsed.ordinal) || parsed.ordinal < 1 ||
            typeof parsed.requestId !== 'string' || parsed.requestId.length > 200) throw new Error('invalid cursor');
        after = parsed;
      } catch (_) {
        throw recoveryError('待接管操作分页标记无效', 'INVALID_RECOVERY_CURSOR', 400);
      }
    }
    if (input.afterRequestId !== undefined) {
      throw recoveryError('待接管操作分页标记无效', 'INVALID_RECOVERY_CURSOR', 400);
    }
    const row = selectById.get(input.userId, input.sourceId);
    if (!row) throw recoveryError('恢复来源不存在', 'RECOVERY_SOURCE_NOT_FOUND', 404);
    const { raw, source } = unpack(row.payload_blob);
    const manifest = JSON.parse(row.manifest_json);
    if (sha256(raw) !== row.source_hash || manifest.verified !== true || manifest.sourceHash !== row.source_hash) {
      throw recoveryError('恢复来源完整性未确认；原件仍保留', 'RECOVERY_ARCHIVE_UNVERIFIED', 409);
    }
    const receipts = new Map(receiptManifest(input.userId, source).map(item => [item.requestId, item]));
    const pending = Array.isArray((source.stores || source.indexedDB || {}).pendingOperations)
      ? (source.stores || source.indexedDB).pendingOperations : [];
    const candidates = pending.filter(operationRow => operationRow && typeof operationRow.requestId === 'string' &&
      (!after || Number(operationRow.ordinal) > after.ordinal ||
        Number(operationRow.ordinal) === after.ordinal && operationRow.requestId > after.requestId) &&
      isCurrentOperationNotStartedAtCapture(source, operationRow.requestId, ownerIdentityForUser(input.userId)) &&
      receipts.get(operationRow.requestId) && receipts.get(operationRow.requestId).receipt === 'unknown')
      .sort((a, b) => Number(a.ordinal) - Number(b.ordinal) || a.requestId.localeCompare(b.requestId));
    const page = candidates.slice(0, limit);
    return { ok: true, sourceId: row.source_id, sourceHash: row.source_hash, owner: source.owner,
      sourceCapturedAt: source.capturedAt,
      items: page.map(operationRow => ({ requestId: operationRow.requestId, operation: operationRow.operation,
        base: operationRow.base, createdAt: operationRow.createdAt, ordinal: operationRow.ordinal })),
      nextCursor: candidates.length > limit && page.length
        ? Buffer.from(JSON.stringify({ ordinal: page[page.length - 1].ordinal,
          requestId: page[page.length - 1].requestId })).toString('base64url') : null };
  }

  function inspectMigration(input) {
    if (!input || !Number.isSafeInteger(input.userId) || input.userId < 1) {
      throw recoveryError('恢复来源必须关联有效账号', 'INVALID_RECOVERY_ACCOUNT', 401);
    }
    if (typeof input.sourceId !== 'string' || !input.sourceId || input.sourceId.length > MAX_SOURCE_ID_LENGTH ||
        !/^[A-Za-z0-9._:-]+$/.test(input.sourceId)) {
      throw recoveryError('恢复来源编号无效', 'INVALID_SOURCE_ID', 400);
    }
    if (typeof validatePutPayload !== 'function' || typeof saveLegacyBaseline !== 'function' ||
        typeof isAccountEmpty !== 'function' || typeof currentSeq !== 'function') {
      throw recoveryError('旧数据自动接管服务尚未就绪', 'RECOVERY_MIGRATION_UNAVAILABLE', 503);
    }
    const row = selectById.get(input.userId, input.sourceId);
    if (!row) throw recoveryError('恢复来源不存在', 'RECOVERY_SOURCE_NOT_FOUND', 404);
    if (input.sourceHash && input.sourceHash !== row.source_hash) {
      throw recoveryError('恢复来源与预览不一致', 'RECOVERY_SOURCE_CHANGED', 409);
    }
    const { raw, source } = unpack(row.payload_blob);
    if (sha256(raw) !== row.source_hash) throw recoveryError('旧数据原件校验失败，未执行迁移', 'RECOVERY_ARCHIVE_VERIFY_FAILED', 500);
    const manifest = JSON.parse(row.manifest_json);
    if (manifest.verified !== true || manifest.sourceHash !== row.source_hash) {
      throw recoveryError('旧数据原件尚未通过完整性验证', 'RECOVERY_ARCHIVE_UNVERIFIED', 409);
    }
    const snapshot = typeof readCurrentSnapshot === 'function' ? readCurrentSnapshot(input.userId) : null;
    const seq = Number(snapshot && snapshot.seq != null ? snapshot.seq : currentSeq(input.userId));
    const hasUnknown = (manifest.legacyReceipts || []).some(receipt => receipt && receipt.receipt === 'unknown');
    const hasFoundReceipt = (manifest.legacyReceipts || []).some(receipt => receipt && receipt.receipt === 'found');
    let reason = null;
    if (manifest.migration && manifest.migration.status === 'applied') reason = 'already-applied';
    else if (hasUnknown) reason = 'legacy-receipt-unknown';
    else if (hasFoundReceipt) reason = 'legacy-receipt-present';
    else if (source.syncResolution) reason = 'legacy-conflict-journal';
    else if (!isAccountEmpty(input.userId, input.sourceId)) reason = 'server-not-empty';
    let candidate;
    try {
      candidate = buildLegacyBaseline(source);
      const validationError = validatePutPayload(candidate);
      if (validationError) throw recoveryError('旧学习档案未通过校验：' + validationError, 'INVALID_RECOVERY_BASELINE', 400);
    } catch (error) {
      if (!error || error.code !== 'INVALID_RECOVERY_BASELINE') throw error;
      const previewToken = sha256(Buffer.from(JSON.stringify({ userId: input.userId, sourceId: row.source_id,
        sourceHash: row.source_hash, seq, eligible: false, reason: 'invalid-baseline' })));
      return { ok: true, sourceId: row.source_id, sourceHash: row.source_hash, expectedSeq: seq,
        previewToken, eligible: false, reason: 'invalid-baseline', counts: null };
    }
    const hasContent = candidate.mem.decks.length || candidate.courses.length || Object.keys(candidate.courseProgress).length ||
      candidate.logicalCourses.length || Object.keys(candidate.mem.stats.bySentence).length || candidate.mem.stats.events.length ||
      candidate.mem.stats.totalAnswered || candidate.mem.stats.totalRounds || candidate.mem.reinforceBook.length ||
      Object.keys(candidate.mem.mastered || {}).length || Object.keys(candidate.mem.deletedItems || {}).length ||
      Object.keys(candidate.mem.best || {}).length;
    if (!hasContent && !reason) reason = 'empty-source';
    const eligible = !reason;
    const merge = snapshot && !isAccountEmpty(input.userId, input.sourceId) ? makeMergePreview(candidate, snapshot) : null;
    const previewToken = sha256(Buffer.from(JSON.stringify({ userId: input.userId, sourceId: row.source_id,
      sourceHash: row.source_hash, seq, eligible, reason, merge })));
    return { ok: true, sourceId: row.source_id, sourceHash: row.source_hash, expectedSeq: seq,
      previewToken, eligible, reason, merge, counts: { decks: candidate.mem.decks.length,
        sentenceStats: Object.keys(candidate.mem.stats.bySentence).length, courses: candidate.courses.length,
        progress: Object.keys(candidate.courseProgress).length, logicalCourses: candidate.logicalCourses.length,
        pendingOperations: collectPendingRequestIds(source).length + collectUnfrozenSyncIntents(source).length } };
  }

  function previewMigration(input) {
    return db.transaction(() => inspectMigration(input))();
  }

  function applyMigration(input) {
    if (!input || typeof input.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceHash) ||
        !Number.isSafeInteger(input.expectedSeq) || typeof input.previewToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.previewToken)) {
      throw recoveryError('恢复确认信息无效，请重新预览', 'INVALID_RECOVERY_CONFIRMATION', 400);
    }
    const transaction = db.transaction(() => {
      const appliedRow = selectById.get(input.userId, input.sourceId);
      if (!appliedRow) throw recoveryError('恢复来源不存在', 'RECOVERY_SOURCE_NOT_FOUND', 404);
      if (appliedRow.source_hash !== input.sourceHash) {
        throw recoveryError('恢复来源与预览不一致', 'RECOVERY_SOURCE_CHANGED', 409);
      }
      const appliedManifest = JSON.parse(appliedRow.manifest_json);
      if (appliedManifest.migration && appliedManifest.migration.status === 'applied') {
        return { ok: true, sourceId: appliedRow.source_id, state: 'already-present',
          seq: appliedManifest.migration.seq, manifest: appliedManifest };
      }
      if (appliedManifest.migration && appliedManifest.migration.status === 'partially-applied' &&
          appliedManifest.migration.previewToken === input.previewToken &&
          appliedManifest.migration.expectedSeq === input.expectedSeq && input.selection) {
        const retrySelection = normalizeMergeSelection(input.selection);
        if (stableJson(retrySelection) === stableJson(appliedManifest.migration.selection)) {
          return { ok: true, sourceId: appliedRow.source_id, state: 'partially-applied', duplicate: true,
            manifest: appliedManifest };
        }
      }
      const preview = inspectMigration(input);
      if (preview.sourceHash !== input.sourceHash || preview.expectedSeq !== input.expectedSeq ||
          preview.previewToken !== input.previewToken) {
        throw recoveryError('账号数据或恢复来源已变化，请重新预览', 'RECOVERY_PREVIEW_STALE', 409);
      }
      if (!preview.eligible) {
        if (preview.reason === 'already-applied') return { ok: true, sourceId: preview.sourceId, state: 'already-present' };
        if (input.selection && SCOPED_MERGE_REASONS.has(preview.reason) && preview.merge &&
            typeof executeRecoveryOperation === 'function') {
          const selection = normalizeMergeSelection(input.selection);
          const selected = new Set();
          Object.keys(selection).forEach(group => selection[group].forEach(id => selected.add(group + '/' + id)));
          const source = unpack(selectById.get(input.userId, input.sourceId).payload_blob).source;
          const baseline = buildLegacyBaseline(source);
          const candidateGroups = {
            decks: new Map(baseline.mem.decks.map(row => [row.id, row])),
            courses: new Map(baseline.courses.map(row => [row.courseId, row])),
            courseProgress: new Map(Object.keys(baseline.courseProgress).map(id => [id, baseline.courseProgress[id]])),
            logicalCourses: new Map(baseline.logicalCourses.map(row => [row.id, row]))
          };
          const requestOperations = [];
          const migrationItems = {};
          Object.keys(preview.merge.items).forEach(group => {
            preview.merge.items[group].forEach(item => {
              const key = group + '/' + item.id;
              if (item.status === 'already-present') {
                migrationItems[key] = { status: 'already-present' };
                return;
              }
              if (item.status === 'retained') {
                migrationItems[key] = { status: 'retained-with-reason', reason: item.reason };
                return;
              }
              if (!selected.has(key)) {
                migrationItems[key] = { status: 'retained-with-reason', reason: 'not-selected' };
                return;
              }
              if (!candidateGroups[group] || !candidateGroups[group].has(item.id)) {
                throw recoveryError('恢复预览项目与归档内容不一致，请重新预览', 'RECOVERY_PREVIEW_STALE', 409);
              }
              if (group === 'courseProgress') {
                const sourceCourseItem = (preview.merge.items.courses || []).find(course => course.id === item.id);
                if (sourceCourseItem && sourceCourseItem.status === 'add' && !selected.has('courses/' + item.id)) {
                  throw recoveryError('恢复课程进度前，请同时选择对应的新课程内容', 'RECOVERY_SELECTION_DEPENDENCY', 409);
                }
              }
              const value = candidateGroups[group].get(item.id);
              const entityHash = sha256(Buffer.from(group + '\n' + item.id)).slice(0, 24);
              const requestId = 'recovery_' + input.sourceHash.slice(0, 24) + '_' + group + '_' + entityHash;
              const operation = group === 'decks'
                ? { protocol: 3, requestId, type: 'deck.put', expectedRev: null, payload: { deck: value } }
                : group === 'courses'
                  ? { protocol: 3, requestId, type: 'course.put', expectedRev: null, payload: { course: value } }
                  : group === 'courseProgress'
                    ? { protocol: 3, requestId, type: 'course.progress.restore', expectedRev: null,
                      payload: { courseId: item.id, progress: value, expectedGeneration: item.expectedGeneration } }
                    : { protocol: 3, requestId, type: 'logicalCourse.put', payload: { course: value, expectedSeq: null } };
              requestOperations.push({ key, requestId, operation });
              migrationItems[key] = { status: 'applied', requestId };
            });
          });
          Object.keys(preview.merge.deferred).forEach(group => {
            const reason = preview.merge.deferred[group];
            if (reason) migrationItems[group] = { status: 'retained-with-reason', reason };
          });
          const unexpected = Array.from(selected).filter(key => {
            const split = key.indexOf('/');
            const group = key.slice(0, split), id = key.slice(split + 1);
            return !preview.merge.items[group] || !preview.merge.items[group].some(item => item.id === id && item.status === 'add');
          });
          if (unexpected.length) throw recoveryError('所选内容已存在、被删除或与当前版本冲突；请重新预览', 'RECOVERY_SELECTION_STALE', 409);
          requestOperations.forEach(row => executeRecoveryOperation(input.userId, row.operation));
          const allResolved = Object.values(migrationItems).every(item => item.status === 'applied' || item.status === 'already-present');
          const applied = requestOperations.length > 0;
          const retained = Object.values(migrationItems).some(item => item.status === 'retained-with-reason');
          const state = allResolved ? 'merged' : applied ? 'partially-merged' : 'archived-not-merged';
          const sourceIntentMappings = mapLegacyIntentsToRecoveryOperations(source, migrationItems, null,
            appliedManifest.legacyReceipts);
          const nextManifest = Object.assign({}, JSON.parse(selectById.get(input.userId, input.sourceId).manifest_json), {
            state,
            legacyIntents: sourceIntentMappings,
            migration: { status: allResolved ? 'applied' : applied ? 'partially-applied' : 'retained-with-reason',
              reason: retained ? 'some-items-retained' : undefined, sourceHash: preview.sourceHash,
              previewToken: preview.previewToken, expectedSeq: preview.expectedSeq, selection,
              items: migrationItems, sourceIntentMappings, appliedAt: Date.now() }
          });
          db.prepare('UPDATE user_recovery_sources SET manifest_json=? WHERE user_id=? AND source_id=?')
            .run(JSON.stringify(nextManifest), input.userId, input.sourceId);
          return { ok: true, sourceId: preview.sourceId, state: allResolved ? 'applied' : applied ? 'partially-applied' : 'retained',
            manifest: nextManifest, counts: preview.merge.counts };
        }
        const retainedRow = selectById.get(input.userId, input.sourceId);
        const retainedManifest = Object.assign({}, JSON.parse(retainedRow.manifest_json), {
          state: 'archived-not-merged',
          migration: { status: 'retained-with-reason', reason: preview.reason,
            sourceHash: preview.sourceHash, previewToken: preview.previewToken, retainedAt: Date.now() }
        });
        db.prepare('UPDATE user_recovery_sources SET manifest_json=? WHERE user_id=? AND source_id=?')
          .run(JSON.stringify(retainedManifest), input.userId, input.sourceId);
        return { ok: true, sourceId: preview.sourceId, state: 'retained', reason: preview.reason,
          manifest: retainedManifest };
      }
      const row = selectById.get(input.userId, input.sourceId);
      const { source } = unpack(row.payload_blob);
      const sourceManifest = JSON.parse(row.manifest_json);
      const candidate = buildLegacyBaseline(source);
      const requestId = 'recovery_' + row.source_hash.slice(0, 40);
      const seq = saveLegacyBaseline(input.userId, Object.assign({}, candidate, { requestId }), input.sourceId);
      const sourceIntentMappings = mapLegacyIntentsToRecoveryOperations(source, {}, requestId, sourceManifest.legacyReceipts);
      const manifest = Object.assign({}, sourceManifest, {
        legacyIntents: sourceIntentMappings,
        state: 'merged', migration: { status: 'applied', requestId, seq,
          sourceIntentMappings, appliedAt: Date.now() }
      });
      db.prepare('UPDATE user_recovery_sources SET manifest_json=? WHERE user_id=? AND source_id=?')
        .run(JSON.stringify(manifest), input.userId, input.sourceId);
      return { ok: true, sourceId: row.source_id, state: 'applied', seq, manifest };
    });
    return transaction();
  }

  function migrateEmptyAccount() {
    throw recoveryError('恢复迁入已改为预览后确认；请重新预览恢复来源', 'RECOVERY_PREVIEW_REQUIRED', 428);
  }

  function validateUploadIdentity(input) {
    if (!input || !Number.isSafeInteger(input.userId) || input.userId < 1) {
      throw recoveryError('恢复来源必须关联有效账号', 'INVALID_RECOVERY_ACCOUNT', 401);
    }
    if (typeof input.sourceId !== 'string' || !input.sourceId || input.sourceId.length > MAX_SOURCE_ID_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(input.sourceId)) {
      throw recoveryError('恢复来源编号无效', 'INVALID_SOURCE_ID', 400);
    }
    if (typeof input.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceHash)) {
      throw recoveryError('恢复来源校验值无效', 'INVALID_SOURCE_HASH', 400);
    }
  }

  function stageChunk(input) {
    validateUploadIdentity(input);
    if (!Buffer.isBuffer(input.payload) || !input.payload.length || input.payload.length > (options.maxChunkBytes || MAX_CHUNK_BYTES)) {
      throw recoveryError('恢复分块为空或超过大小限制', 'INVALID_RECOVERY_CHUNK', 413);
    }
    if (!Number.isSafeInteger(input.chunkIndex) || !Number.isSafeInteger(input.chunkCount) ||
        input.chunkCount < 1 || input.chunkCount > (options.maxChunks || MAX_CHUNKS) ||
        input.chunkIndex < 0 || input.chunkIndex >= input.chunkCount ||
        !Number.isSafeInteger(input.uncompressedBytes) || input.uncompressedBytes < 1 || input.uncompressedBytes > maxSourceBytes ||
        typeof input.chunkHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.chunkHash) || sha256(input.payload) !== input.chunkHash) {
      throw recoveryError('恢复分块清单或校验值无效', 'INVALID_RECOVERY_CHUNK', 400);
    }

    const commit = db.transaction(() => {
      const archived = selectById.get(input.userId, input.sourceId);
      if (archived) {
        if (archived.source_hash !== input.sourceHash) throw recoveryError('该来源编号已对应其他内容', 'SOURCE_ID_REUSED', 409);
        return { state: 'already-present', sourceId: archived.source_id };
      }
      const sameHash = selectByHash.get(input.userId, input.sourceHash);
      if (sameHash) return { state: 'already-present', sourceId: sameHash.source_id };

      let upload = selectUpload.get(input.userId, input.sourceId);
      if (upload && (upload.source_hash !== input.sourceHash || upload.chunk_count !== input.chunkCount ||
          upload.uncompressed_bytes !== input.uncompressedBytes)) {
        throw recoveryError('恢复来源分块清单已固定，不能覆盖', 'SOURCE_ID_REUSED', 409);
      }
      if (!upload) {
        insertUpload.run(input.userId, input.sourceId, input.sourceHash, input.chunkCount, input.uncompressedBytes);
        upload = selectUpload.get(input.userId, input.sourceId);
      }
      const old = selectChunk.get(input.userId, input.sourceId, input.chunkIndex);
      if (old) {
        if (old.chunk_hash !== input.chunkHash || !Buffer.from(old.chunk_blob).equals(input.payload)) {
          throw recoveryError('同一恢复分块编号不能替换内容', 'RECOVERY_CHUNK_REUSED', 409);
        }
        return { state: 'already-present', sourceId: input.sourceId, chunkIndex: input.chunkIndex };
      }
      insertChunk.run(input.userId, input.sourceId, input.chunkIndex, input.chunkHash, input.payload);
      return { state: 'staged', sourceId: input.sourceId, chunkIndex: input.chunkIndex };
    });
    return commit();
  }

  function complete(input) {
    validateUploadIdentity(input);
    if (!Number.isSafeInteger(input.chunkCount) || input.chunkCount < 1 || input.chunkCount > (options.maxChunks || MAX_CHUNKS) ||
        !Number.isSafeInteger(input.uncompressedBytes) || input.uncompressedBytes < 1 || input.uncompressedBytes > maxSourceBytes) {
      throw recoveryError('最终恢复来源清单无效', 'INVALID_RECOVERY_MANIFEST', 400);
    }
    const archived = selectById.get(input.userId, input.sourceId);
    if (archived) {
      if (archived.source_hash !== input.sourceHash) throw recoveryError('该来源编号已对应其他内容', 'SOURCE_ID_REUSED', 409);
      return { ok: true, sourceId: archived.source_id, sourceHash: archived.source_hash,
        state: 'already-present', manifest: JSON.parse(archived.manifest_json) };
    }
    const existingHash = selectByHash.get(input.userId, input.sourceHash);
    if (existingHash) {
      return { ok: true, sourceId: existingHash.source_id, sourceHash: existingHash.source_hash,
        state: 'already-present', manifest: JSON.parse(existingHash.manifest_json) };
    }
    const upload = selectUpload.get(input.userId, input.sourceId);
    if (!upload || upload.source_hash !== input.sourceHash || upload.chunk_count !== input.chunkCount ||
        upload.uncompressed_bytes !== input.uncompressedBytes) {
      throw recoveryError('恢复来源分块尚未完整到达', 'RECOVERY_SOURCE_INCOMPLETE', 409);
    }
    const rows = listChunks.all(input.userId, input.sourceId);
    if (rows.length !== input.chunkCount || rows.some((row, index) => row.chunk_index !== index)) {
      throw recoveryError('恢复来源缺少分块，原数据保留在本机', 'RECOVERY_SOURCE_INCOMPLETE', 409);
    }
    const parts = rows.map(row => {
      const bytes = Buffer.from(row.chunk_blob);
      if (sha256(bytes) !== row.chunk_hash) throw recoveryError('恢复分块校验失败，原数据保留在本机', 'RECOVERY_CHUNK_HASH_MISMATCH', 400);
      return bytes;
    });
    const compressed = Buffer.concat(parts);
    const result = ingest({ userId: input.userId, sourceId: input.sourceId, sourceHash: input.sourceHash,
      codec: 'gzip', payload: compressed });
    db.transaction(() => {
      deleteChunks.run(input.userId, input.sourceId);
      deleteUpload.run(input.userId, input.sourceId);
    })();
    return result;
  }

  return { ingest, refreshManifest, listSources, listHandoverOperations, previewMigration, applyMigration, migrateEmptyAccount,
    stageChunk, complete, MAX_SOURCE_BYTES, MAX_CHUNK_BYTES, MAX_CHUNKS };
}

module.exports = { createRecoveryIngest, buildLegacyBaseline, validateLegacyLogicalCourses, MAX_SOURCE_BYTES, MAX_CHUNK_BYTES, MAX_CHUNKS, collectPendingRequestIds };
