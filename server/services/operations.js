'use strict';

const { canonicalHash } = require('../canonical-hash');
const { createLogicalCourseOperations } = require('./logical-course-operations');
const { createCourseLearningOperations } = require('./course-learning-operations');
const { createSettingsOperations } = require('./settings-operations');
const { createLearningMaintenanceOperations } = require('./learning-maintenance-operations');
const { createCourseEnrollmentOperations } = require('./course-enrollment-operations');
const { createLearningMarkOperations } = require('./learning-mark-operations');
const { createContentOperations } = require('./content-operations');
const { createStatKeyMigrationOperations } = require('./stat-key-migration-operations');
const { createAssessmentOperations } = require('./assessment-operations');
const { createLearningExposureOperations } = require('./learning-exposure-operations');
const { createLearningEventOperations } = require('./learning-event-operations');
const MAX_OPERATION_BYTES = 256 * 1024;
const MAX_CONTENT_IMPORT_BYTES = 80 * 1024 * 1024;

function operationError(message, code, status, conflicts) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (conflicts) error.conflicts = conflicts;
  return error;
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createOperations(options) {
  const db = options.db;
  const allocSeq = options.allocSeq;
  const upsertCourseProgress = options.upsertCourseProgress;
  const upsertDeck = options.upsertDeck;
  const upsertCourse = options.upsertCourse;
  const upsertKv = options.upsertKv;
  const upsertSentenceStat = options.upsertSentenceStat;
  const replaceSentenceStat = options.replaceSentenceStat;
  const deleteSentenceStat = options.deleteSentenceStat;
  const upsertEvent = options.upsertEvent;
  const upsertEntityRow = options.upsertEntityRow;
  const deleteEntityRow = options.deleteEntityRow;
  const reducePracticeEvents = options.reducePracticeEvents;
  const resolveAssessmentItem = options.resolveAssessmentItem;
  const readChanges = options.readChanges;
  const srs = options.srs;
  const hash = options.hash || canonicalHash;
  if (typeof readChanges !== 'function') throw new TypeError('operations require a canonical entity-delta reader');
  const logicalCourseOperations = createLogicalCourseOperations({ db, upsertEntityRow, deleteEntityRow, operationError });
  const courseLearningOperations = createCourseLearningOperations({ db, upsertCourseProgress, upsertEvent,
    replaceSentenceStat, currentGeneration, operationError });
  const settingsOperations = createSettingsOperations({ db, upsertKv, operationError });
  const learningMaintenanceOperations = createLearningMaintenanceOperations({ db, upsertEntityRow, deleteEntityRow,
    upsertEvent, operationError });
  const courseEnrollmentOperations = createCourseEnrollmentOperations({ db, upsertCourseProgress, operationError });
  const learningMarkOperations = createLearningMarkOperations({ db, currentGeneration, upsertSentenceStat,
    upsertEntityRow, deleteEntityRow, upsertEvent, operationError });
  const contentOperations = createContentOperations({ db, upsertCourseProgress, upsertDeck, upsertCourse, upsertKv,
    deleteSentenceStat, upsertEntityRow, deleteEntityRow, currentGeneration, operationError });
  const statKeyMigrationOperations = createStatKeyMigrationOperations({ db, upsertSentenceStat, replaceSentenceStat,
    deleteSentenceStat, resolveAssessmentItem, operationError });
  const assessmentOperations = createAssessmentOperations({ db, currentGeneration, assessmentSession,
    resolveAssessmentItem, replaceSentenceStat, reducePracticeEvents, upsertEvent, srs, operationError });
  const learningExposureOperations = createLearningExposureOperations({ db, currentGeneration,
    replaceSentenceStat, reducePracticeEvents, upsertEvent, srs, operationError });
  const learningEventOperations = createLearningEventOperations({ db, currentGeneration, srs,
    upsertSentenceStat, replaceSentenceStat, reducePracticeEvents, upsertEntityRow, upsertEvent, upsertKv, operationError });

  function validateRequest(body, maxBytes) {
    if (!object(body) || ![2, 3].includes(body.protocol) || !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestId || '') ||
        typeof body.type !== 'string' || !object(body.payload)) {
      throw operationError('操作格式无效', 'INVALID_OPERATION', 400);
    }
    if (!hasOnlyKeys(body, ['protocol', 'requestId', 'type', 'payload', 'expectedRev', 'expected'])) {
      throw operationError('操作包含不支持的字段', 'INVALID_OPERATION', 400);
    }
    if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) {
      throw operationError('内容超过该操作允许的大小', 'OPERATION_TOO_LARGE', 413);
    }
  }

  function currentGeneration(userId, scopeKey) {
    const row = db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=? AND scope_key=?').get(userId, scopeKey);
    return row ? Number(row.generation) || 0 : 0;
  }

  function assessmentSession(userId, sessionId) {
    const row = db.prepare('SELECT scope_key,generation,revision,status,data_json,result_json FROM user_assessment_sessions WHERE user_id=? AND session_id=?')
      .get(userId, sessionId);
    return row ? { row, session: JSON.parse(row.data_json) } : null;
  }

  function apply(userId, body, seq) {
    const p = body.payload;
    const logicalCourseChange = logicalCourseOperations.apply(userId, body, seq);
    if (logicalCourseChange) return logicalCourseChange;
    const courseLearningChange = courseLearningOperations.apply(userId, body, seq);
    if (courseLearningChange) return courseLearningChange;
    const settingsChange = settingsOperations.apply(userId, body, seq);
    if (settingsChange) return settingsChange;
    const learningMaintenanceChange = learningMaintenanceOperations.apply(userId, body, seq);
    if (learningMaintenanceChange) return learningMaintenanceChange;
    const courseEnrollmentChange = courseEnrollmentOperations.apply(userId, body, seq);
    if (courseEnrollmentChange) return courseEnrollmentChange;
    const learningMarkChange = learningMarkOperations.apply(userId, body, seq);
    if (learningMarkChange) return learningMarkChange;
    const contentChange = contentOperations.apply(userId, body, seq);
    if (contentChange) return contentChange;
    const statKeyMigrationChange = statKeyMigrationOperations.apply(userId, body, seq);
    if (statKeyMigrationChange) return statKeyMigrationChange;
    const assessmentChange = assessmentOperations.apply(userId, body, seq);
    if (assessmentChange) return assessmentChange;
    const learningExposureChange = learningExposureOperations.apply(userId, body, seq);
    if (learningExposureChange) return learningExposureChange;
    const learningEventChange = learningEventOperations.apply(userId, body, seq);
    if (learningEventChange) return learningEventChange;
    throw operationError('此操作类型尚未迁移到新保存协议', 'OPERATION_NOT_SUPPORTED', 428);
  }

  const save = db.transaction(function (userId, body, maxBytes) {
    validateRequest(body, maxBytes);
    const payloadHash = hash(body);
    const prior = db.prepare('SELECT payload_hash,result_json FROM user_operation_receipts WHERE user_id=? AND request_id=?').get(userId, body.requestId);
    if (prior) {
      if (prior.payload_hash !== payloadHash) {
        throw operationError('同一请求编号不能用于不同内容', 'REQUEST_ID_REUSED', 409);
      }
      return Object.assign(JSON.parse(prior.result_json), { duplicate: true });
    }
    const eventId = body.payload && typeof body.payload.eventId === 'string' &&
      ['learning.answer', 'learning.roundComplete', 'learning.mark', 'learning.statKeyMigrate', 'mistake.remove', 'deck.itemsVisibility', 'learning.exposure',
        'assessment.start', 'assessment.answer', 'assessment.finalize', 'course.restart', 'learning.reset'].includes(body.type)
      ? body.payload.eventId : null;
    const eventHash = eventId ? hash({ type: body.type, payload: body.payload }) : null;
    if (eventId) {
      const priorEvent = db.prepare('SELECT payload_hash,result_json FROM user_operation_events WHERE user_id=? AND event_id=?').get(userId, eventId);
      if (priorEvent) {
        if (priorEvent.payload_hash !== eventHash) {
          throw operationError('学习记录编号已用于其他内容', 'EVENT_ID_REUSED', 409);
        }
        const eventResult = JSON.parse(priorEvent.result_json);
        const result = { ok: true, requestId: body.requestId, seq: eventResult.seq,
          outcome: 'already-applied', operation: eventResult.operation, changes: eventResult.changes };
        db.prepare('INSERT INTO user_operation_receipts(user_id,request_id,payload_hash,result_json) VALUES(?,?,?,?)')
          .run(userId, body.requestId, payloadHash, JSON.stringify(result));
        return result;
      }
    }
    const seq = allocSeq(userId);
    const change = apply(userId, body, seq);
    const result = { ok: true, requestId: body.requestId, seq, outcome: change.outcome || 'applied',
      operation: change, changes: readChanges(userId, seq) };
    db.prepare('INSERT INTO user_operation_receipts(user_id,request_id,payload_hash,result_json) VALUES(?,?,?,?)')
      .run(userId, body.requestId, payloadHash, JSON.stringify(result));
    if (eventId) {
      db.prepare('INSERT INTO user_operation_events(user_id,event_id,payload_hash,operation_id,result_json) VALUES(?,?,?,?,?)')
        .run(userId, eventId, eventHash, body.requestId, JSON.stringify(result));
    }
    return result;
  });

  function receipt(userId, requestId) {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
      throw operationError('操作编号无效', 'INVALID_OPERATION_ID', 400);
    }
    const row = db.prepare('SELECT result_json FROM user_operation_receipts WHERE user_id=? AND request_id=?').get(userId, requestId);
    if (!row) throw operationError('未找到操作记录', 'OPERATION_NOT_FOUND', 404);
    return JSON.parse(row.result_json);
  }

  function getAssessmentSession(userId, sessionId) {
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(sessionId)) {
      throw operationError('测评会话编号无效', 'INVALID_ASSESSMENT_SESSION_ID', 400);
    }
    const stored = assessmentSession(userId, sessionId);
    if (!stored) throw operationError('测评会话不存在', 'ASSESSMENT_SESSION_NOT_FOUND', 404);
    return { ok: true, session: stored.session, result: stored.row.result_json ? JSON.parse(stored.row.result_json) : null };
  }

  return Object.freeze({
    execute(userId, body) { return save(userId, body, MAX_OPERATION_BYTES); },
    executeContentImport(userId, body) {
      const key = body && body.type === 'course.put' ? 'course' : body && body.type === 'deck.put' ? 'deck' : '';
      if (!object(body) || !key || !object(body.payload) || !object(body.payload[key])) {
        throw operationError('大内容导入只接受一个课程或题库实体', 'INVALID_CONTENT_IMPORT', 400);
      }
      return save(userId, body, MAX_CONTENT_IMPORT_BYTES);
    },
    receipt,
    getAssessmentSession
  });
}

module.exports = { createOperations, operationError, MAX_OPERATION_BYTES, MAX_CONTENT_IMPORT_BYTES };
