'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const Database = require('better-sqlite3');
const { createOperations } = require('./services/operations');
const { canonicalHash } = require('./canonical-hash');
const { registerOperationRoutes } = require('./routes/operations');
const srs = require('../srs');
const learningEngine = require('../js/learning-engine.cjs');
const { batchHash } = require('./sync-conflict');
const { assertRevisionAccepted } = require('./sync-conflict');
const { createDataWriters } = require('./services/data-writers');
const { reducePracticeEvents } = require('./services/learning-replay');
assert.equal(reducePracticeEvents, learningEngine.reducePracticeEvents,
  'the server imports the same generated practice reducer as the browser');

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,items_json TEXT,builtin INTEGER,is_public INTEGER DEFAULT 0,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,authoring_json TEXT,PRIMARY KEY(user_id,id));
  CREATE TABLE user_courses(user_id INTEGER,course_id TEXT,data_json TEXT,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,PRIMARY KEY(user_id,course_id));
  CREATE TABLE user_course_progress(user_id INTEGER,course_id TEXT,data_json TEXT,rev INTEGER,deleted_at TEXT,updated_at TEXT,seq INTEGER,PRIMARY KEY(user_id,course_id));
  CREATE TABLE user_kv(user_id INTEGER,k TEXT,v_json TEXT,rev INTEGER,deleted_at TEXT,PRIMARY KEY(user_id,k));
  CREATE TABLE user_sentence_stats(user_id INTEGER,sentence_key TEXT,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,sentence_key));
  CREATE TABLE user_events(user_id INTEGER,id TEXT,at INTEGER,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,id));
  CREATE TABLE user_operation_receipts(user_id INTEGER,request_id TEXT,payload_hash TEXT,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,request_id));
  CREATE TABLE user_operation_events(user_id INTEGER,event_id TEXT,payload_hash TEXT,operation_id TEXT,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,event_id));
  CREATE TABLE user_operation_failures(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,code TEXT,status INTEGER,trace_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE user_learning_baselines(user_id INTEGER,sentence_key TEXT,baseline_json TEXT,PRIMARY KEY(user_id,sentence_key));
  CREATE TABLE user_learning_generation_baselines(user_id INTEGER,scope_key TEXT,sentence_key TEXT,generation INTEGER,baseline_json TEXT,PRIMARY KEY(user_id,scope_key,sentence_key,generation));
  CREATE TABLE user_learning_events(user_id INTEGER,sentence_key TEXT,event_id TEXT,generation INTEGER,event_json TEXT,received_at INTEGER,PRIMARY KEY(user_id,sentence_key,event_id));
  CREATE INDEX idx_learning_events_session_order ON user_learning_events(
    user_id,json_extract(event_json,'$.sessionId'),json_extract(event_json,'$.answerOrder'))
    WHERE json_extract(event_json,'$.type')='practice';
  CREATE TABLE user_learning_generations(user_id INTEGER,scope_key TEXT,generation INTEGER,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,scope_key));
  CREATE TABLE user_learning_resumes(user_id INTEGER,session_id TEXT,deck_id TEXT,course_id TEXT,generation INTEGER,idx INTEGER,content_cursor TEXT,practice_mode TEXT,updated_at INTEGER,seq INTEGER,deleted_at INTEGER,PRIMARY KEY(user_id,session_id));
  CREATE TABLE user_assessment_sessions(user_id INTEGER,session_id TEXT,scope_key TEXT,generation INTEGER,revision INTEGER,status TEXT,data_json TEXT,result_json TEXT,created_at INTEGER,updated_at INTEGER,PRIMARY KEY(user_id,session_id));
  CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,deleted_at TEXT,seq INTEGER,PRIMARY KEY(user_id,kind,item_key));
  CREATE TABLE user_change_seq(user_id INTEGER PRIMARY KEY,seq INTEGER NOT NULL);
`);
const allocSeq = userId => db.prepare('INSERT INTO user_change_seq(user_id,seq) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET seq=seq+1 RETURNING seq').get(userId).seq;
const writers = createDataWriters({ db, assertRevisionAccepted });
const readChanges = (_userId, seq) => ({ mem: {}, courses: [], courseProgress: {}, learningResumes: {},
  learningGenerations: {}, revs: { decks: {}, kv: {}, courses: {}, courseProgress: {}, logicalCourses: {} },
  entityGone: {}, seq, delta: true, deleted: { decks: [], kv: [], courses: [], courseProgress: [], learningResumes: [], events: [], sentences: [] } });
function upsertProgress(userId, id, value, rev, deleted, seq, baseRev) {
  const row = db.prepare('SELECT rev FROM user_course_progress WHERE user_id=? AND course_id=?').get(userId, id);
  const currentRev = row && row.rev != null ? row.rev : null;
  if (currentRev !== baseRev) { const error = new Error('stale'); error.status = 409; error.code = 'ENTITY_CHANGED'; throw error; }
  db.prepare('INSERT INTO user_course_progress(user_id,course_id,data_json,rev,deleted_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json,rev=excluded.rev,deleted_at=excluded.deleted_at').run(userId,id,JSON.stringify(value),rev,deleted ? 'deleted' : null);
  void seq;
}
function upsertKv(userId, key, value, rev, _deleted, seq, baseRev) {
  const row = db.prepare('SELECT rev FROM user_kv WHERE user_id=? AND k=?').get(userId,key);
  const currentRev = row && row.rev != null ? row.rev : null;
  if (currentRev !== baseRev) { const error = new Error('stale'); error.status = 409; error.code = 'ENTITY_CHANGED'; throw error; }
  db.prepare('INSERT INTO user_kv(user_id,k,v_json,rev,deleted_at) VALUES(?,?,?,?,NULL) ON CONFLICT(user_id,k) DO UPDATE SET v_json=excluded.v_json,rev=excluded.rev,deleted_at=NULL').run(userId,key,JSON.stringify(value),rev);
  void seq;
}
function upsertSentenceStat(userId, key, value) {
  db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,data_json,deleted_at) VALUES(?,?,?,NULL) ON CONFLICT(user_id,sentence_key) DO UPDATE SET data_json=excluded.data_json,deleted_at=NULL').run(userId,key,JSON.stringify(value));
}
function deleteSentenceStat(userId, key) {
  db.prepare('UPDATE user_sentence_stats SET deleted_at=CURRENT_TIMESTAMP WHERE user_id=? AND sentence_key=?').run(userId,key);
}
function replaceSentenceStat(userId, key, value) { upsertSentenceStat(userId, key, value); }
function upsertEvent(userId, event) {
  db.prepare('INSERT INTO user_events(user_id,id,at,data_json,deleted_at) VALUES(?,?,?,?,NULL) ON CONFLICT(user_id,id) DO UPDATE SET at=excluded.at,data_json=excluded.data_json,deleted_at=NULL').run(userId,event.id,event.at,JSON.stringify(event));
}
function upsertEntityRow(userId, kind, key, value, seq) {
  db.prepare('INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,deleted_at,seq) VALUES(?,?,?,?,NULL,?) ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json,deleted_at=NULL,seq=excluded.seq')
    .run(userId, kind, key, JSON.stringify(value), seq == null ? null : seq);
}
function deleteEntityRow(userId, kind, key, seq) {
  db.prepare('UPDATE user_entity_rows SET deleted_at=CURRENT_TIMESTAMP,seq=? WHERE user_id=? AND kind=? AND item_key=?')
    .run(seq == null ? null : seq, userId, kind, key);
}

const operations = createOperations({ db, allocSeq, readChanges, upsertDeck: writers.upsertDeck, upsertCourse: writers.upsertCourse,
  upsertCourseProgress: upsertProgress, upsertKv, upsertSentenceStat,
  replaceSentenceStat, deleteSentenceStat, reducePracticeEvents, resolveAssessmentItem: (_userId, key) => key.indexOf('lesson-x#sentence-exposed') === 0 || key === 'lesson-x#legacy-stat-target'
    ? { cid: key.slice(key.indexOf('#') + 1), sentence: 'Hello.', translation: '你好。', chunks: ['Hello.'], alts: [[]] } : null,
  upsertEvent, upsertEntityRow, deleteEntityRow, srs, hash: batchHash });
const id = 'operation_request_0001';
const progress = { protocol: 3, requestId: id, type: 'course.progress', payload: {
  courseId: 'lesson-x', nodeId: 'node-1', passed: true, completed: false, currentNodeId: 'node-2'
} };
const first = operations.execute(1, progress);
assert.equal(first.ok, true);
assert.equal(first.seq, 1);
const retry = operations.execute(1, progress);
assert.equal(retry.duplicate, true);
assert.equal(retry.seq, first.seq);
assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=1').get().seq, 1);
assert.equal(canonicalHash(progress), batchHash(progress), 'operation and batch request fingerprints share one canonical implementation');
const operationsWithDefaultHash = createOperations({ db, allocSeq, readChanges, upsertDeck: writers.upsertDeck, upsertCourse: writers.upsertCourse,
  upsertCourseProgress: upsertProgress, upsertKv, upsertSentenceStat, replaceSentenceStat, deleteSentenceStat,
  reducePracticeEvents, resolveAssessmentItem: (_userId, key) => key.indexOf('lesson-x#sentence-exposed') === 0 || key === 'lesson-x#legacy-stat-target'
    ? { cid: key.slice(key.indexOf('#') + 1), sentence: 'Hello.', translation: '你好。', chunks: ['Hello.'], alts: [[]] } : null,
  upsertEvent, upsertEntityRow, deleteEntityRow, srs });
const defaultHashOperation = { protocol: 3, requestId: 'operation_canonical_retry_01', type: 'settings.patch',
  payload: { patch: { sound: false, autoSpeak: true } } };
operationsWithDefaultHash.execute(1, defaultHashOperation);
const reorderedDefaultHashOperation = { payload: { patch: { autoSpeak: true, sound: false } }, type: 'settings.patch',
  requestId: defaultHashOperation.requestId, protocol: 3 };
assert.equal(operationsWithDefaultHash.execute(1, reorderedDefaultHashOperation).duplicate, true,
  'the default operation fingerprint treats reordered JSON object keys as the same durable request');
assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=1').get().seq, 2,
  'canonical retries do not allocate a second server sequence');
const row = JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=1 AND course_id=?').get('lesson-x').data_json);
assert.deepEqual(row.seen, ['node-1']);
assert.deepEqual(row.passed, ['node-1']);
assert.equal(row.currentNodeId, 'node-2');
const restart = { protocol: 3, requestId: 'operation_course_restart_01', type: 'course.restart', payload: {
  eventId: 'course_restart_event_01', courseId: 'lesson-x', currentNodeId: 'node-1'
} };
const restarted = operations.execute(1, restart);
assert.equal(restarted.operation.generation, 1);
assert.equal(operations.execute(1, Object.assign({}, restart, { requestId: 'operation_course_restart_02' })).outcome, 'already-applied');
const restartedProgress = JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=1 AND course_id=?').get('lesson-x').data_json);
assert.deepEqual(restartedProgress.seen, []);
assert.deepEqual(restartedProgress.history[0].seen, ['node-1']);
assert.equal(operations.execute(1, { protocol: 3, requestId: 'operation_stale_progress_01', type: 'course.progress', payload: {
  courseId: 'lesson-x', nodeId: 'stale-node', passed: true, completed: false, generation: 0
} }).outcome, 'retained');
assert.deepEqual(JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=1 AND course_id=?').get('lesson-x').data_json).seen, []);
const otherAccount = operations.execute(2, progress);
assert.equal(otherAccount.ok, true);
assert.equal(otherAccount.seq, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_course_progress WHERE course_id=?').get('lesson-x').n, 2);
assert.throws(() => operations.execute(1, Object.assign({}, progress, { payload: Object.assign({}, progress.payload, { passed: false }) })),
  error => error.code === 'REQUEST_ID_REUSED' && error.status === 409);

const hashOrderOperations = createOperations({ db, allocSeq, readChanges, upsertDeck: writers.upsertDeck, upsertCourse: writers.upsertCourse,
  upsertCourseProgress: upsertProgress, upsertKv, upsertSentenceStat,
  replaceSentenceStat, reducePracticeEvents, resolveAssessmentItem: (_userId, key) => key.indexOf('lesson-x#sentence-exposed') === 0
    ? { cid: key.slice(key.indexOf('#') + 1), sentence: 'Hello.', translation: '你好。', chunks: ['Hello.'], alts: [[]] } : null,
  upsertEvent, upsertEntityRow, deleteEntityRow, srs });
const hashOrder = { protocol: 3, requestId: 'operation_hash_order_001', type: 'settings.patch', payload: { patch: { sound: false, shuffle: true } } };
hashOrderOperations.execute(1, hashOrder);
assert.equal(hashOrderOperations.execute(1, Object.assign({}, hashOrder, { payload: { patch: { shuffle: true, sound: false } } })).duplicate,
  true, 'the default receipt hash ignores object key insertion order');

const enroll = { protocol: 3, requestId: 'operation_request_0002', type: 'course.enrollment', payload: { courseId: 'lesson-x', joined: true } };
operations.execute(1, enroll);
const enrollId = 'enrollment:v1:lesson-x';
const enrolled = JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=1 AND course_id=?').get(enrollId).data_json);
assert.equal(enrolled.kind, 'course-enrollment');
assert.equal(enrolled.joined, true);

function enrollmentOperation(requestId, courseId, joined) {
  return { protocol: 3, requestId, type: 'course.enrollment', payload: { courseId, joined } };
}
operations.execute(1, enrollmentOperation('operation_enroll_course_02', 'course-two', true));
operations.execute(1, enrollmentOperation('operation_enroll_course_03', 'course-three', true));
assert.throws(() => operations.execute(1, enrollmentOperation('operation_enroll_course_04', 'course-four', true)),
  error => error.code === 'COURSE_LIMIT_REACHED' && error.status === 409);
assert.equal(operations.execute(1, enrollmentOperation('operation_enroll_remove_02', 'course-two', false)).ok, true);
assert.equal(operations.execute(1, enrollmentOperation('operation_enroll_course_05', 'course-four', true)).ok, true);
operations.execute(2, enrollmentOperation('operation_enroll_other_01', 'other-one', true));
operations.execute(2, enrollmentOperation('operation_enroll_other_02', 'other-two', true));
operations.execute(2, enrollmentOperation('operation_enroll_other_03', 'other-three', true));
assert.equal(JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=2 AND course_id=?').get('enrollment:v1:other-three').data_json).joined, true);

const settings = { protocol: 3, requestId: 'operation_request_0003', type: 'settings.patch', payload: { patch: { sound: false, batchSize: 12 } } };
assert.equal(operations.execute(1, settings).ok, true);
const concurrentSetting = { protocol: 3, requestId: 'operation_request_0004', type: 'settings.patch', payload: { patch: { batchSize: 15 } } };
assert.equal(operations.execute(1, concurrentSetting).ok, true);
const settingsValue = JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='settings'").get().v_json);
assert.equal(settingsValue.sound, false);
assert.equal(settingsValue.batchSize, 15);
const independentSetting = { protocol: 3, requestId: 'operation_request_0006', type: 'settings.patch', payload: { patch: { sound: true } } };
assert.equal(operations.execute(1, independentSetting).ok, true, 'settings follow server acceptance order instead of entity conflict');
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='settings'").get().v_json).sound, true);

const deckOne = { protocol: 3, requestId: 'operation_deck_put_create_01', type: 'deck.put', expectedRev: null,
  payload: { deck: { id: 'managed-deck', name: 'Managed', items: [{ sentence: 'Hello.' }] } } };
const deckOneReceipt = operations.execute(1, deckOne);
assert.equal(deckOneReceipt.operation.rev, 1);
assert.equal(operations.execute(1, deckOne).duplicate, true, 'deck creation retry is idempotent');
const deckTwo = { protocol: 3, requestId: 'operation_deck_put_update_01', type: 'deck.put', expectedRev: 1,
  payload: { deck: { id: 'managed-deck', name: 'Managed v2', items: [{ sentence: 'Hello again.' }] } } };
assert.equal(operations.execute(1, deckTwo).operation.rev, 2);
const deckPublish = { protocol: 3, requestId: 'operation_deck_publish_01', type: 'deck.publish', expectedRev: 2,
  payload: { deckId: 'managed-deck', publish: true } };
assert.deepEqual(operations.execute(1, deckPublish).operation,
  { entity: 'decks', id: 'managed-deck', rev: 3, isPublic: true });
assert.equal(operations.execute(1, deckPublish).duplicate, true, 'publication retry reuses the original receipt');
assert.equal(db.prepare('SELECT is_public FROM user_decks WHERE user_id=1 AND id=?').get('managed-deck').is_public, 1);
const sequenceBeforeStaleDeck = db.prepare('SELECT seq FROM user_change_seq WHERE user_id=1').get().seq;
assert.throws(() => operations.execute(1, { ...deckTwo, requestId: 'operation_deck_put_stale_01', expectedRev: 1 }),
  error => error.code === 'ENTITY_CHANGED' && error.status === 409,
  'stale content edits preserve the current entity');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_deck_publish_stale_01',
  type: 'deck.publish', expectedRev: 2, payload: { deckId: 'managed-deck', publish: false } }),
error => error.code === 'ENTITY_CHANGED' && error.status === 409,
'stale publication cannot overwrite the current publication state');
assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=1').get().seq, sequenceBeforeStaleDeck,
  'a rejected stale edit rolls back its allocated sequence');
upsertSentenceStat(1, 'managed-deck#sentence-1', { times: 2 });
upsertEntityRow(1, 'mastered', 'managed-deck#sentence-1', { key: 'managed-deck#sentence-1' });
upsertEntityRow(1, 'reinforce', 'managed-deck::sentence-1', { _key: 'managed-deck::sentence-1' });
upsertKv(1, 'best', { 'managed-deck': { perfect: 1 }, other: { perfect: 3 } }, 1, false, 1, null);
upsertProgress(1, 'enrollment:v1:managed-deck', { kind: 'course-enrollment', courseId: 'managed-deck', joined: true }, 1, false, 1, null);
db.prepare("INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(1,'course:managed-deck',0)").run();
assert.equal(operations.execute(1, { protocol: 3, requestId: 'operation_deck_delete_01', type: 'deck.delete',
  expectedRev: 3, payload: { deckId: 'managed-deck' } }).operation.deleted, true);
assert.ok(db.prepare('SELECT deleted_at FROM user_decks WHERE user_id=1 AND id=?').get('managed-deck').deleted_at,
  'deck deletion remains a tombstone');
assert.ok(db.prepare('SELECT deleted_at FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('managed-deck#sentence-1').deleted_at,
  'deck deletion tombstones its learning statistics');
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=1 AND deleted_at IS NULL AND item_key LIKE 'managed-deck%'").get().n, 0,
  'deck deletion tombstones its mastery and mistake references');
assert.ok(db.prepare('SELECT deleted_at FROM user_course_progress WHERE user_id=1 AND course_id=?').get('enrollment:v1:managed-deck').deleted_at,
  'deck deletion tombstones its enrollment reference');
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='best'").get().v_json)['managed-deck'], undefined,
  'deck deletion removes only its best-score reference');
assert.equal(db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=1 AND scope_key=?').get('course:managed-deck').generation, 1,
  'deck deletion fences late learning operations');
const lateDeletedDeckAnswer=operations.execute(1,{protocol:3,requestId:'operation_deleted_deck_answer_01',type:'learning.answer',payload:{
  eventId:'deleted_deck_answer_01',key:'managed-deck#sentence-1',deckId:'managed-deck',generation:0,ok:true,
  sessionId:'deleted-deck-session-01',answerOrder:0,chunkRight:1,chunkTotal:1}});
assert.equal(lateDeletedDeckAnswer.outcome,'retained','late answers from a deleted deck cannot recreate its learning state');

const coursePut = { protocol: 3, requestId: 'operation_course_put_create_01', type: 'course.put', expectedRev: null,
  payload: { course: { courseId: 'managed-course', version: 'v1', title: 'Managed course', nodes: [] } } };
assert.equal(operations.execute(1, coursePut).operation.rev, 1);
const recoveryCoursePut = { protocol: 3, requestId: 'operation_course_restore_seed_01', type: 'course.put', expectedRev: null,
  payload: { course: { courseId: 'recovery-progress-course', version: 'v1', title: 'Recovery progress course', nodes: [] } } };
operations.execute(1, recoveryCoursePut);
const restoreProgress = { protocol: 3, requestId: 'operation_course_progress_restore_01', type: 'course.progress.restore', expectedRev: null,
  payload: { courseId: 'recovery-progress-course', expectedGeneration: 0,
    progress: { seen: ['node-a'], passed: [], completed: false, courseVersion: 'v1' } } };
assert.equal(operations.execute(1, restoreProgress).operation.restored, true,
  'recovery restores progress only into a previously empty course-progress row');
assert.equal(JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=1 AND course_id=?')
  .get('recovery-progress-course').data_json).generation, 0);
assert.equal(operations.execute(1, restoreProgress).duplicate, true, 'a retried scoped progress restore reuses its receipt');
const restoreProgressSeq = db.prepare('SELECT seq FROM user_change_seq WHERE user_id=1').get().seq;
assert.throws(() => operations.execute(1, { ...restoreProgress, requestId: 'operation_course_progress_restore_overwrite_01' }),
  error => error.code === 'ENTITY_CHANGED' && error.status === 409,
  'scoped recovery cannot replace an existing course-progress row');
assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=1').get().seq, restoreProgressSeq,
  'rejected progress restore does not allocate a sequence');
upsertSentenceStat(1, 'managed-course#sentence-1', { times: 4 });
upsertEntityRow(1, 'mastered', 'managed-course#sentence-1', { key: 'managed-course#sentence-1' });
upsertEntityRow(1, 'reinforce', 'managed-course::sentence-1', { _key: 'managed-course::sentence-1' });
upsertProgress(1, 'managed-course', { seen: ['node-1'], completed: true }, 1, false, 1, null);
upsertProgress(1, 'enrollment:v1:managed-course', { kind: 'course-enrollment', courseId: 'managed-course', joined: true }, 1, false, 1, null);
db.prepare(`INSERT INTO user_learning_resumes(user_id,session_id,deck_id,course_id,generation,idx,updated_at)
  VALUES(1,'managed-course-session','managed-course','managed-course',0,2,1)`).run();
db.prepare("INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(1,'course:managed-course',0)").run();
const replacedCourse = operations.execute(1, { protocol: 3, requestId: 'operation_course_put_replace_01', type: 'course.put', expectedRev: 1,
  payload: { course: { courseId: 'managed-course', version: 'v2', title: 'Managed course revised', nodes: [] } } });
assert.equal(replacedCourse.operation.rev, 2);
assert.equal(db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=1 AND scope_key=?').get('course:managed-course').generation, 1,
  'replacing a course version advances its learning generation atomically');
const replacedProgress = JSON.parse(db.prepare('SELECT data_json FROM user_course_progress WHERE user_id=1 AND course_id=?').get('managed-course').data_json);
assert.deepEqual(replacedProgress.seen, []);
assert.equal(replacedProgress.completed, false);
assert.equal(replacedProgress.courseVersion, 'v2');
assert.deepEqual(replacedProgress.history[0].seen, ['node-1']);
assert.equal(operations.execute(1, { protocol: 3, requestId: 'operation_old_version_progress_01', type: 'course.progress', payload: {
  courseId: 'managed-course', nodeId: 'late-node', passed: true, completed: true, generation: 0, courseVersion: 'v1'
} }).outcome, 'retained', 'old queued progress cannot restore completion after a version replacement');
operations.execute(1, { protocol: 3, requestId: 'operation_course_put_same_version_01', type: 'course.put', expectedRev: 2,
  payload: { course: { courseId: 'managed-course', version: 'v2', title: 'Managed course copy edit', nodes: [] } } });
assert.equal(db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=1 AND scope_key=?').get('course:managed-course').generation, 1,
  'a metadata edit that keeps the content version does not reset progress');
operations.execute(1, { protocol: 3, requestId: 'operation_course_put_atomic_seed_01', type: 'course.put', expectedRev: null,
  payload: { course: { courseId: 'atomic-course', version: 'v1', title: 'Atomic course', nodes: [] } } });
const failingCourseVersionUpdate = createOperations({ db, allocSeq, readChanges, upsertDeck: writers.upsertDeck, upsertCourse: writers.upsertCourse,
  upsertCourseProgress() { throw new Error('injected course progress reset failure'); }, upsertKv, upsertSentenceStat,
  replaceSentenceStat, reducePracticeEvents, resolveAssessmentItem: () => null,
  upsertEvent, upsertEntityRow, deleteEntityRow, srs, hash: batchHash });
assert.throws(() => failingCourseVersionUpdate.execute(1, { protocol: 3, requestId: 'operation_course_put_atomic_fail_01', type: 'course.put', expectedRev: 1,
  payload: { course: { courseId: 'atomic-course', version: 'v2', title: 'Atomic course revised', nodes: [] } } }));
assert.equal(JSON.parse(db.prepare('SELECT data_json FROM user_courses WHERE user_id=1 AND course_id=?').get('atomic-course').data_json).version, 'v1',
  'course content rolls back when atomic progress reset fails');
assert.equal(db.prepare('SELECT rev FROM user_courses WHERE user_id=1 AND course_id=?').get('atomic-course').rev, 1,
  'failed version replacement does not advance the content revision');
assert.equal(db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=1 AND scope_key=?').get('course:atomic-course'), undefined,
  'failed version replacement does not leave a partially advanced generation');
assert.equal(operations.execute(1, { protocol: 3, requestId: 'operation_course_delete_01', type: 'course.delete',
  expectedRev: 3, payload: { courseId: 'managed-course' } }).operation.deleted, true);
assert.ok(db.prepare('SELECT deleted_at FROM user_courses WHERE user_id=1 AND course_id=?').get('managed-course').deleted_at,
  'course deletion remains a tombstone');
assert.equal(db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=1 AND scope_key=?').get('course:managed-course').generation, 2,
  'deleting a course advances its learning generation to fence late writes');
assert.ok(db.prepare('SELECT deleted_at FROM user_course_progress WHERE user_id=1 AND course_id=?').get('managed-course').deleted_at,
  'course deletion tombstones its progress in the same operation');
assert.ok(db.prepare('SELECT deleted_at FROM user_course_progress WHERE user_id=1 AND course_id=?').get('enrollment:v1:managed-course').deleted_at,
  'course deletion tombstones its enrollment reference');
assert.ok(db.prepare('SELECT deleted_at FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('managed-course#sentence-1').deleted_at,
  'course deletion tombstones its sentence statistics');
assert.ok(db.prepare('SELECT deleted_at FROM user_learning_resumes WHERE user_id=1 AND session_id=?').get('managed-course-session').deleted_at,
  'course deletion tombstones its saved learning resume');
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=1 AND deleted_at IS NULL AND item_key LIKE 'managed-course%'").get().n, 0,
  'course deletion removes live mastery and mistake references');
const lateCourseProgress = operations.execute(1, { protocol: 3, requestId: 'operation_late_course_progress_01', type: 'course.progress',
  payload: { courseId: 'managed-course', nodeId: 'late-node', passed: true, completed: true, generation: 0 } });
assert.equal(lateCourseProgress.outcome, 'retained', 'late progress from a deleted course cannot recreate its state');

upsertEntityRow(1, 'deletedItem', 'ai-course-retired:managed-ai-course', true);
const recreateAiCourse = { protocol: 3, requestId: 'operation_ai_course_recreate_01', type: 'deck.put', expectedRev: null,
  payload: { deck: { id: 'managed-ai-course', name: 'Recreated AI course', items: [{ sentence: 'We are ready.' }] }, clearRetiredMarker: true } };
assert.equal(operations.execute(1, recreateAiCourse).operation.retiredMarkerCleared, true);
assert.ok(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='deletedItem' AND item_key=?").get('ai-course-retired:managed-ai-course').deleted_at,
  'recreating a retired AI course tombstones its marker atomically with deck.put');

operations.execute(1, { protocol: 3, requestId: 'operation_converted_deck_seed', type: 'deck.put', expectedRev: null,
  payload: { deck: { id: 'converted-delete-test', name: 'Converted test', items: [{ sentence: 'Hello.' }],
    authoring: { legacySource: { courseId: 'converted-delete-test' } } } } });
operations.execute(1, { protocol: 3, requestId: 'operation_converted_deck_delete', type: 'deck.delete', expectedRev: 1,
  payload: { deckId: 'converted-delete-test' } });
const retiredConverted = db.prepare("SELECT data_json,deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='deletedItem' AND item_key=?")
  .get('ai-course-retired:converted-delete-test');
assert.ok(retiredConverted && !retiredConverted.deleted_at && JSON.parse(retiredConverted.data_json) === true,
  'deleting a converted deck atomically retains a marker to prevent automatic recreation from its original source');

const logicalDirectory = { id: 'logical-course:travel-a1-test', title: 'Travel A1', coverImage: '',
  catalogKey: 'logical:logical-course:travel-a1-test', origin: 'user', contentType: 'story',
  createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z' };
const logicalCreate = { protocol: 3, requestId: 'operation_logical_course_put_01', type: 'logicalCourse.put',
  payload: { course: logicalDirectory, expectedSeq: null } };
assert.equal(operations.execute(1, logicalCreate).operation.entity, 'logicalCourses');
let logicalSeq = db.prepare("SELECT seq FROM user_entity_rows WHERE user_id=1 AND kind='logicalCourse' AND item_key=?").get(logicalDirectory.id).seq;
assert.equal(operations.execute(1, logicalCreate).duplicate, true, 'logical directory creation retry is idempotent');
const staleLogicalEdit = { protocol: 3, requestId: 'operation_logical_course_put_stale', type: 'logicalCourse.put',
  payload: { course: { ...logicalDirectory, title: 'stale title' }, expectedSeq: null } };
assert.throws(() => operations.execute(1, staleLogicalEdit), error => error.code === 'ENTITY_CHANGED' && error.status === 409);
const logicalEdit = { protocol: 3, requestId: 'operation_logical_course_put_02', type: 'logicalCourse.put',
  payload: { course: { ...logicalDirectory, title: 'Travel A1 updated' }, expectedSeq: logicalSeq } };
operations.execute(1, logicalEdit);
logicalSeq = db.prepare("SELECT seq FROM user_entity_rows WHERE user_id=1 AND kind='logicalCourse' AND item_key=?").get(logicalDirectory.id).seq;
const logicalDelete = { protocol: 3, requestId: 'operation_logical_course_delete_01', type: 'logicalCourse.delete',
  payload: { courseId: logicalDirectory.id, expectedSeq: logicalSeq } };
operations.execute(1, logicalDelete);
assert.ok(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='logicalCourse' AND item_key=?").get(logicalDirectory.id).deleted_at,
  'logical directory deletion preserves a server tombstone');
assert.throws(() => operations.execute(1, { ...logicalDelete, requestId: 'operation_logical_course_delete_stale' }),
  error => error.code === 'ENTITY_CHANGED' && error.status === 409);

assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'bad', type: 'settings.patch', payload: { patch: { sound: false } } }),
  error => error.code === 'INVALID_OPERATION');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_settings_secret_01', type: 'settings.patch', payload: { patch: { apiKey: 'secret' } } }),
  error => error.code === 'INVALID_OPERATION');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_request_0005', type: 'course.progress', payload: {
  courseId: 'lesson-x', nodeId: 'node-2', passed: true, completed: false, arbitrary: 'ignored data must be rejected'
} }), error => error.code === 'INVALID_OPERATION');

const answer = { protocol: 3, requestId: 'operation_request_answer_01', type: 'learning.answer', payload: {
  eventId: 'answer_event_000001', key: 'lesson-x#sentence-1', deckId: 'lesson-x', courseId: 'lesson-x', generation: 1, ok: true,
  sessionId: 'session-answer-0001', answerOrder: 0, chunkRight: 2, chunkTotal: 2,
  mistake: { key: 'lesson-x::sentence-1', row: { _key: 'lesson-x::sentence-1', history: [{ eventId: 'wrong-event-000001' }], needsReview: true } }
} };
const answerReceipt = operations.execute(1, answer);
assert.equal(answerReceipt.operation.stat.times, 1);
assert.equal(answerReceipt.operation.stat.repetition, 1);
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalAnswered, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_events WHERE user_id=1 AND id=?').get('answer_event_000001').n, 1);
assert.equal(operations.execute(1, answer).duplicate, true);
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalAnswered, 1);
upsertSentenceStat(1, 'reset-course#sentence-1', { times: 3, wrongTimes: 1, repetition: 2, learningV1: { evidence: [] } });
const reset = operations.execute(1, { protocol: 3, requestId: 'operation_learning_reset_01', type: 'learning.reset',
  payload: { eventId: 'learning_reset_event_01', courseId: 'reset-course', expectedGeneration: 0 } });
assert.equal(reset.operation.generation, 1);
assert.equal(reset.operation.resetSentenceCount, 1);
assert.equal(operations.execute(1, { protocol: 3, requestId: 'operation_learning_reset_01', type: 'learning.reset',
  payload: { eventId: 'learning_reset_event_01', courseId: 'reset-course', expectedGeneration: 0 } }).duplicate, true,
  'retrying the same reset receipt does not advance the generation again');
const resetStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('reset-course#sentence-1').data_json);
assert.equal(resetStat.times, 0, 'reset replaces the current projection with a clean baseline');
const staleAfterReset = operations.execute(1, { protocol: 3, requestId: 'operation_learning_late_01', type: 'learning.answer',
  payload: { ...answer.payload, eventId: 'answer_event_late_01', key: 'reset-course#sentence-1', deckId: 'reset-course', courseId: 'reset-course', generation: 0, mistake: undefined } });
assert.equal(staleAfterReset.outcome, 'retained', 'an old offline answer cannot resurrect pre-reset learning');
const afterResetAnswer = operations.execute(1, { protocol: 3, requestId: 'operation_learning_after_reset_01', type: 'learning.answer',
  payload: { ...answer.payload, eventId: 'answer_event_after_reset_01', key: 'reset-course#sentence-1', deckId: 'reset-course', courseId: 'reset-course', generation: 1, mistake: undefined } });
assert.equal(afterResetAnswer.operation.stat.times, 1, 'new-generation answers start from the reset baseline');
assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM user_learning_generation_baselines
  WHERE user_id=1 AND scope_key='course:reset-course' AND generation=1`).get().n, 1);
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_learning_reset_stale_01', type: 'learning.reset',
  payload: { eventId: 'learning_reset_event_stale_01', courseId: 'reset-course', expectedGeneration: 0 } }),
  error => error.code === 'GENERATION_CHANGED' && error.status === 409,
  'a stale reset cannot replace a newer learning generation');
const staleMark = operations.execute(1, { protocol: 3, requestId: 'operation_learning_mark_stale_01', type: 'learning.mark',
  payload: { eventId: 'learning_mark_event_stale_01', key: 'reset-course#sentence-1', deckId: 'reset-course',
    courseId: 'reset-course', generation: 0, active: true, markedAt: Date.now(), sentence: 'Old mark' } });
assert.equal(staleMark.operation.outcome, 'retained', 'a stale offline familiarity mark is retained after reset');
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=1 AND kind='mastered' AND item_key=? AND deleted_at IS NULL")
  .get('reset-course#sentence-1').n, 0, 'stale familiarity marks cannot resurrect after learning reset');
const sameAnswerNewRequest = Object.assign({}, answer, { requestId: 'operation_request_answer_02' });
const duplicateAnswerReceipt = operations.execute(1, sameAnswerNewRequest);
assert.equal(duplicateAnswerReceipt.outcome, 'already-applied');
assert.equal(duplicateAnswerReceipt.seq, answerReceipt.seq, 'event retries reuse the original accepted sequence');
assert.deepEqual(duplicateAnswerReceipt.changes, answerReceipt.changes,
  'event retries return the exact original canonical delta instead of generating a new projection');
assert.deepEqual(duplicateAnswerReceipt.operation, answerReceipt.operation,
  'event retries preserve the original compact domain result');
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalAnswered, 2);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_operation_events WHERE user_id=1 AND event_id=?').get('answer_event_000001').n, 1);
const answerStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-1').data_json);
assert.equal(answerStat.learningV1.evidence[0].id, 'answer_event_000001');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_learning_events WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-1').n, 1);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=1 AND kind='reinforce' AND item_key=?").get('lesson-x::sentence-1').n, 1,
  'answer and mistake evidence commit within the same operation');
assert.throws(() => operations.execute(1, Object.assign({}, answer, {
  requestId: 'operation_request_answer_03', payload: Object.assign({}, answer.payload, { ok: false })
})), error => error.code === 'EVENT_ID_REUSED' && error.status === 409);

/* 答题、学习统计、错题证据必须处于同一事务；局部写失败时不留下半条已计分答案。 */
const answersBeforeFault = JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalAnswered;
const failingOperations = createOperations({ db, allocSeq, readChanges, upsertCourseProgress: upsertProgress, upsertKv, upsertSentenceStat,
  replaceSentenceStat, reducePracticeEvents, resolveAssessmentItem: (_userId, key) => key.indexOf('lesson-x#sentence-') === 0
    ? { cid: key.slice(key.indexOf('#') + 1), sentence: 'Rollback test.', translation: '事务回滚测试。', chunks: ['Rollback test.'], alts: [[]] } : null,
  upsertEvent, upsertEntityRow() { throw new Error('injected reinforce write failure'); }, deleteEntityRow, srs, hash: batchHash });
const answerWithFailedMistake = { protocol: 3, requestId: 'operation_answer_rollback_01', type: 'learning.answer', payload: {
  eventId: 'answer_event_rollback_01', key: 'lesson-x#sentence-rollback', deckId: 'lesson-x', courseId: 'lesson-x', generation: 1, ok: false,
  sessionId: 'session-rollback-0001', answerOrder: 0, chunkRight: 0, chunkTotal: 1,
  mistake: { key: 'lesson-x::sentence-rollback', row: { _key: 'lesson-x::sentence-rollback', history: [] } }
} };
assert.throws(() => failingOperations.execute(1, answerWithFailedMistake), /injected reinforce write failure/);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_learning_events WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-rollback').n, 0,
  'a failed atomic mistake write rolls back the immutable answer event');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-rollback').n, 0,
  'a failed atomic mistake write rolls back sentence statistics');
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalAnswered, answersBeforeFault,
  'a failed atomic mistake write does not increment account answer totals');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_operation_receipts WHERE user_id=1 AND request_id=?').get('operation_answer_rollback_01').n, 0,
  'a failed atomic answer has no success receipt and can be retried');

const lateAnswer = { protocol: 3, requestId: 'operation_request_answer_04', type: 'learning.answer', payload: {
  eventId: 'answer_event_000002', key: 'lesson-x#sentence-1', deckId: 'lesson-x', courseId: 'lesson-x', generation: 1, ok: false,
  occurredAt: Date.now() - 60_000, timeZone: 'Asia/Shanghai', mode: 'chunk', sessionId: 'round-1', firstAttempt: true,
  answerOrder: 0, chunkRight: 1, chunkTotal: 2
} };
operations.execute(1, lateAnswer);
const replayedStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-1').data_json);
assert.equal(replayedStat.times, 2);
assert.equal(replayedStat.wrongTimes, 1);
assert.equal(replayedStat.learningV1.evidence[0].id, 'answer_event_000002', 'late events replay by occurrence time, not arrival order');
assert.equal(replayedStat.learningV1.evidence[1].id, 'answer_event_000001');
operations.execute(1, { protocol: 3, requestId: 'operation_relearn_restart_01', type: 'course.restart',
  payload: { eventId: 'relearn_restart_event_01', courseId: 'relearn-course' } });
const answerAfterRestart = operations.execute(1, { protocol: 3, requestId: 'operation_relearn_answer_01', type: 'learning.answer',
  payload: { eventId: 'relearn_answer_event_01', key: 'relearn-course#sentence-1', deckId: 'relearn-course',
    courseId: 'relearn-course', generation: 1, ok: true, sessionId: 'relearn-session-0001', answerOrder: 0,
    chunkRight: 1, chunkTotal: 1 } });
assert.equal(answerAfterRestart.operation.stat.times, 1,
  'a re-entry with no prior projection starts a new generation cleanly');
operations.execute(1, { protocol: 3, requestId: 'operation_relearn_restart_02', type: 'course.restart',
  payload: { eventId: 'relearn_restart_event_02', courseId: 'relearn-course' } });
const answerAfterSecondRestart = operations.execute(1, { protocol: 3, requestId: 'operation_relearn_answer_02', type: 'learning.answer',
  payload: { eventId: 'relearn_answer_event_02', key: 'relearn-course#sentence-1', deckId: 'relearn-course',
    courseId: 'relearn-course', generation: 2, ok: true, sessionId: 'relearn-session-0002', answerOrder: 0,
    chunkRight: 1, chunkTotal: 1 } });
assert.equal(answerAfterSecondRestart.operation.stat.times, 2,
  're-learning preserves accumulated learning statistics across generations');
const recordedLateEvent = JSON.parse(db.prepare('SELECT data_json FROM user_events WHERE user_id=1 AND id=?').get('answer_event_000002').data_json);
assert.match(recordedLateEvent.day, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(recordedLateEvent.receivedAt > recordedLateEvent.at, true, 'event time and first server receipt time are both preserved');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_request_answer_05', type: 'learning.answer',
  payload: Object.assign({}, answer.payload, { eventId: 'answer_event_000003', assisted: 'yes' }) }), error => error.code === 'INVALID_OPERATION');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_request_answer_06', type: 'learning.answer',
  payload: Object.assign({}, answer.payload, { eventId: 'answer_event_000004', chunkRight: 3 }) }), error => error.code === 'INVALID_OPERATION');

const exposureAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
const exposure = { protocol: 3, requestId: 'operation_exposure_request_01', type: 'learning.exposure', payload: {
  eventId: 'exposure_event_0001', key: 'lesson-x#sentence-exposed', deckId: 'lesson-x', courseId: 'lesson-x',
  generation: 1, occurredAt: exposureAt, contentFingerprint: 'v1-test', sessionId: 'exposure-session-1', mode: 'typing'
} };
const exposureResult = operations.execute(1, exposure);
assert.equal(exposureResult.operation.lastExposureAt, exposureAt);
assert.equal(operations.execute(1, Object.assign({}, exposure, { requestId: 'operation_exposure_request_02' })).outcome, 'already-applied');
const exposureStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-exposed').data_json);
assert.equal(exposureStat.times, 0, 'an exposure is not recorded as an answered question');
assert.equal(exposureStat.learningV1.evidence.filter(event => event.type === 'exposure').length, 1,
  'a retried exposure remains one immutable learning event');
assert.equal(learningEngine.getAssessmentEligibility({ key: 'lesson-x#sentence-exposed', chunks: ['hello'], zh: '你好', stat: exposureStat }, { now: Date.now() }).eligible, true,
  'a durable exposure starts the assessment eligibility clock');
assert.throws(() => operations.execute(1, Object.assign({}, exposure, {
  requestId: 'operation_exposure_request_03', payload: Object.assign({}, exposure.payload, { occurredAt: exposureAt - 1 })
})), error => error.code === 'EVENT_ID_REUSED' && error.status === 409);

const assessmentStart = { protocol: 3, requestId: 'operation_assessment_start_01', type: 'assessment.start', payload: {
  eventId: 'assessment_start_event_01', sessionId: 'assessment_session_01', keys: ['lesson-x#sentence-exposed'], generation: 1
} };
assert.equal(operations.execute(1, assessmentStart).operation.status, 'active');
const assessmentSession = operations.getAssessmentSession(1, 'assessment_session_01').session;
assert.equal(assessmentSession.items[0].chunks[0], 'Hello.', 'assessment prompt and answer are sourced from server-owned content');
assert.equal(operations.execute(1, { protocol: 3, requestId: 'operation_assessment_answer_01', type: 'assessment.answer', payload: {
  eventId: 'assessment_answer_event_01', sessionId: 'assessment_session_01', itemIndex: 0, answers: ['hello']
} }).operation.submitted, true);
const assessmentFinal = { protocol: 3, requestId: 'operation_assessment_final_01', type: 'assessment.finalize', payload: {
  eventId: 'assessment_final_event_01', sessionId: 'assessment_session_01'
} };
assert.equal(operations.execute(1, assessmentFinal).operation.result.passed, true);
assert.equal(operations.getAssessmentSession(1, 'assessment_session_01').session.status, 'completed');
assert.equal(operations.execute(1, Object.assign({}, assessmentFinal, { requestId: 'operation_assessment_final_02' })).outcome, 'already-applied');
const assessedStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-exposed').data_json);
assert.equal(assessedStat.times, 0, 'assessment results do not inflate practice answer counts');
assert.equal(assessedStat.learningV1.evidence.filter(event => event.type === 'assessment').length, 1,
  'assessment finalization records its verified learning event once');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_assessment_start_03', type: 'assessment.start', payload: {
  eventId: 'assessment_start_event_03', sessionId: 'assessment_session_03', keys: ['lesson-x#sentence-exposed'], generation: 1
} }), error => error.code === 'ASSESSMENT_NOT_ELIGIBLE' && error.status === 409,
  'the service rechecks cooldown eligibility before creating another session');
assert.equal(learningEngine.getAssessmentEligibility({ key: 'lesson-x#sentence-exposed', chunks: ['Hello.'], zh: '你好。', alts: [[]], stat: assessedStat }, { now: Date.now() }).eligible, false,
  'a successful initial assessment cannot be immediately repeated');
const delayedEligibility = learningEngine.getAssessmentEligibility({ key: 'lesson-x#sentence-exposed', chunks: ['Hello.'], zh: '你好。', alts: [[]], stat: assessedStat }, { now: Date.now() + 8 * 24 * 60 * 60 * 1000 });
assert.equal(delayedEligibility.eligible, true);
assert.equal(delayedEligibility.stage, 'delayed', 'the persisted initial pass unlocks a delayed retest after seven days');

const failedExposure = { protocol: 3, requestId: 'operation_exposure_request_04', type: 'learning.exposure', payload: {
  eventId: 'exposure_event_0002', key: 'lesson-x#sentence-exposed-fail', deckId: 'lesson-x', courseId: 'lesson-x',
  generation: 1, occurredAt: exposureAt, contentFingerprint: 'v1-test'
} };
operations.execute(1, failedExposure);
operations.execute(1, { protocol: 3, requestId: 'operation_assessment_start_02', type: 'assessment.start', payload: {
  eventId: 'assessment_start_event_02', sessionId: 'assessment_session_02', keys: ['lesson-x#sentence-exposed-fail'], generation: 1
} });
operations.execute(1, { protocol: 3, requestId: 'operation_assessment_answer_02', type: 'assessment.answer', payload: {
  eventId: 'assessment_answer_event_02', sessionId: 'assessment_session_02', itemIndex: 0, answers: ['wrong']
} });
const failedFinal = operations.execute(1, { protocol: 3, requestId: 'operation_assessment_final_02b', type: 'assessment.finalize', payload: {
  eventId: 'assessment_final_event_02', sessionId: 'assessment_session_02'
} });
assert.equal(failedFinal.operation.result.passed, false);
const failedAssessmentStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-exposed-fail').data_json);
assert.equal(failedAssessmentStat.learningV1.phase, 'relearning', 'an assessment failure schedules reinforcement');
assert.ok(failedAssessmentStat.dueAt > Date.now() && failedAssessmentStat.dueAt <= Date.now() + 11 * 60 * 1000);
assert.throws(() => operations.getAssessmentSession(2, 'assessment_session_01'), error => error.code === 'ASSESSMENT_SESSION_NOT_FOUND');

const mark = { protocol: 3, requestId: 'operation_request_mark_0001', type: 'learning.mark', payload: {
  eventId: 'mark_event_000001', key: 'lesson-x#sentence-2', deckId: 'lesson-x', courseId: 'lesson-x', generation: 1, active: true,
  markedAt: Date.now(), sentence: 'Excuse me.'
} };
assert.equal(operations.execute(1, mark).operation.active, true);
assert.equal(operations.execute(1, Object.assign({}, mark, { requestId: 'operation_request_mark_0002' })).outcome, 'already-applied');
const markedStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get('lesson-x#sentence-2').data_json);
assert.equal(markedStat.learningV1.phase, 'review');
assert.equal(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='mastered' AND item_key=?").get('lesson-x#sentence-2').deleted_at, null);
const legacyMark = { protocol: 3, requestId: 'operation_request_mark_legacy_01', type: 'learning.mark', payload: {
  eventId: 'legacy_familiarity_0001', key: 'lesson-x#legacy-sentence', deckId: 'lesson-x', courseId: 'lesson-x',
  generation: 1, active: true, markedAt: Date.now(), sentence: 'A legacy sentence.', legacyMigration: true
} };
assert.equal(operations.execute(1, legacyMark).operation.active, true);
const migratedStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?')
  .get('lesson-x#legacy-sentence').data_json);
assert.equal(migratedStat.learningV1.legacyFamiliarityMigrated, true,
  'legacy familiarity migration is recorded with the server-computed schedule');
const migratedEvent = JSON.parse(db.prepare('SELECT data_json FROM user_events WHERE user_id=1 AND id=?').get('legacy_familiarity_0001').data_json);
assert.equal(migratedEvent.legacyMigration, true, 'the migration provenance is durable and auditable');
assert.throws(() => operations.execute(1, { protocol:3, requestId:'operation_request_mark_legacy_bad', type:'learning.mark',
  payload:{eventId:'legacy_familiarity_bad1',key:'lesson-x#legacy-sentence-2',deckId:'lesson-x',active:false,legacyMigration:true} }),
  error => error.code === 'INVALID_OPERATION', 'legacy migration metadata cannot be used to unmark a sentence');
const unmark = { protocol: 3, requestId: 'operation_request_mark_0003', type: 'learning.mark', payload: {
  eventId: 'mark_event_000002', key: 'lesson-x#sentence-2', deckId: 'lesson-x', courseId: 'lesson-x', generation: 1, active: false
} };
operations.execute(1, unmark);
assert.notEqual(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='mastered' AND item_key=?").get('lesson-x#sentence-2').deleted_at, null);
const legacyStatKey = 'rev-lesson-x-old#old-cid';
const canonicalStatKey = 'lesson-x#legacy-stat-target';
db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,data_json,deleted_at) VALUES(?,?,?,NULL)').run(1, legacyStatKey,
  JSON.stringify({ deckId: 'rev-lesson-x-old', sentence: 'Hello.', times: 2, okTimes: 1, wrongTimes: 1, maxStreak: 2, lastAt: 10, interval: 3 }));
db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,data_json,deleted_at) VALUES(?,?,?,NULL)').run(1, canonicalStatKey,
  JSON.stringify({ deckId: 'lesson-x', times: 3, okTimes: 2, wrongTimes: 1, maxStreak: 1, lastAt: 20, interval: 8 }));
const migrateStatKey = { protocol: 3, requestId: 'operation_stat_migrate_001', type: 'learning.statKeyMigrate', payload: {
  eventId: 'legacy_stat_key_migration_01', oldKey: legacyStatKey, newKey: canonicalStatKey, deckId: 'lesson-x'
} };
assert.equal(operations.execute(1, migrateStatKey).outcome, 'applied');
assert.notEqual(db.prepare('SELECT deleted_at FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get(legacyStatKey).deleted_at, null);
const mergedLegacyStat = JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get(canonicalStatKey).data_json);
assert.deepEqual({ times: mergedLegacyStat.times, okTimes: mergedLegacyStat.okTimes, wrongTimes: mergedLegacyStat.wrongTimes,
  maxStreak: mergedLegacyStat.maxStreak, lastAt: mergedLegacyStat.lastAt, interval: mergedLegacyStat.interval },
{ times: 5, okTimes: 3, wrongTimes: 2, maxStreak: 2, lastAt: 20, interval: 8 });
assert.equal(operations.execute(1, Object.assign({}, migrateStatKey, { requestId: 'operation_stat_migrate_retry' })).outcome,
  'already-applied', 'the stable migration event is deduplicated when a new request ID is used');
const retainedStatKey = 'rev-lesson-x-old#retained-cid';
db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,data_json,deleted_at) VALUES(?,?,?,NULL)').run(1, retainedStatKey,
  JSON.stringify({ deckId: 'rev-lesson-x-old', sentence: 'Hello.', times: 4 }));
db.prepare('INSERT INTO user_learning_events(user_id,sentence_key,event_id,generation,event_json,received_at) VALUES(?,?,?,?,?,?)')
  .run(1, canonicalStatKey, 'existing_modern_stat_event', 0, '{}', Date.now());
const retainedMigration = operations.execute(1, { protocol: 3, requestId: 'operation_stat_retain_001', type: 'learning.statKeyMigrate', payload: {
  eventId: 'legacy_stat_key_retained_01', oldKey: retainedStatKey, newKey: canonicalStatKey, deckId: 'lesson-x'
} });
assert.equal(retainedMigration.outcome, 'retained');
assert.equal(db.prepare('SELECT deleted_at FROM user_sentence_stats WHERE user_id=1 AND sentence_key=?').get(retainedStatKey).deleted_at, null,
  'legacy source data remains untouched when modern learning evidence prevents a safe merge');
assert.throws(() => operations.execute(1, { protocol: 3, requestId: 'operation_stat_invalid_001', type: 'learning.statKeyMigrate',
  payload: { eventId: 'legacy_stat_key_invalid_01', oldKey: retainedStatKey, newKey: 'lesson-x#not-real', deckId: 'lesson-x' } }),
  error => error.code === 'INVALID_STAT_KEY_MIGRATION');
const removeMistake = { protocol: 3, requestId: 'operation_request_mistake_01', type: 'mistake.remove', payload: {
  eventId: 'mistake_remove_00001', key: 'lesson-x::sentence-1'
} };
assert.equal(operations.execute(1, removeMistake).operation.deleted, true);
assert.notEqual(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='reinforce' AND item_key=?").get('lesson-x::sentence-1').deleted_at, null);
const hideBuiltinItem = { protocol: 3, requestId: 'operation_visibility_hide_01', type: 'deck.itemsVisibility', payload: {
  eventId: 'visibility_hide_event_01', deckId: 'visibility-deck', keys: ['visibility-deck#item-1'], hidden: true, expectedHidden: false
} };
assert.equal(operations.execute(1, hideBuiltinItem).operation.count, 1);
assert.equal(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='deletedItem' AND item_key=?").get('visibility-deck#item-1').deleted_at, null);
assert.equal(operations.execute(1, hideBuiltinItem).duplicate, true, 'retrying the same request is idempotent');
const staleVisibility = { protocol: 3, requestId: 'operation_visibility_stale_01', type: 'deck.itemsVisibility', payload: {
  eventId: 'visibility_stale_event_01', deckId: 'visibility-deck', keys: ['visibility-deck#item-1'], hidden: false, expectedHidden: false
} };
assert.throws(() => operations.execute(1, staleVisibility), error => error.code === 'ENTITY_CHANGED' && error.status === 409,
  'visibility changes cannot overwrite a newer state');
const restoreBuiltinItem = { protocol: 3, requestId: 'operation_visibility_restore_1', type: 'deck.itemsVisibility', payload: {
  eventId: 'visibility_restore_event_1', deckId: 'visibility-deck', keys: ['visibility-deck#item-1'], hidden: false, expectedHidden: true
} };
operations.execute(1, restoreBuiltinItem);
assert.notEqual(db.prepare("SELECT deleted_at FROM user_entity_rows WHERE user_id=1 AND kind='deletedItem' AND item_key=?").get('visibility-deck#item-1').deleted_at, null);

const round = { protocol: 3, requestId: 'operation_request_round_01', type: 'learning.roundComplete', payload: {
  eventId: 'round_event_000001', timeZone: 'Asia/Shanghai', occurredAt: Date.parse('2026-01-01T16:30:00.000Z'), sessionId: 'session-round-1', answerCount: 2,
  deckId: 'round-deck', recordBest: true
} };
const roundAnswerOne = { protocol: 3, requestId: 'operation_request_round_answer_01', type: 'learning.answer', payload: {
  eventId: 'round_answer_event_0001', key: 'round-deck#sentence-1', deckId: 'round-deck', ok: true,
  sessionId: 'session-round-1', generation: 0, answerOrder: 0, chunkRight: 2, chunkTotal: 2
} };
const roundAnswerTwo = { protocol: 3, requestId: 'operation_request_round_answer_02', type: 'learning.answer', payload: {
  eventId: 'round_answer_event_0002', key: 'round-deck#sentence-2', deckId: 'round-deck', ok: false,
  sessionId: 'session-round-1', generation: 0, answerOrder: 1, chunkRight: 1, chunkTotal: 2
} };
operations.execute(1, roundAnswerOne);
operations.execute(1, roundAnswerTwo);
const sessionEventPlan = db.prepare(`EXPLAIN QUERY PLAN SELECT event_json FROM user_learning_events
  WHERE user_id=? AND json_extract(event_json, '$.type')='practice'
    AND json_extract(event_json, '$.sessionId')=?`).all(1, 'session-round-1');
assert.ok(sessionEventPlan.some(row => row.detail.includes('idx_learning_events_session_order')),
  'round validation looks up only this session through the session-order index');
const resume = { protocol: 3, requestId: 'operation_request_resume_001', type: 'learning.resume', payload: {
  deckId: 'round-deck', sessionId: 'session-round-1', generation: 0, idx: 4, contentCursor: 17, practiceMode: 'chunkSelection'
} };
assert.equal(operations.execute(1, resume).operation.entity, 'learningResume');
assert.equal(db.prepare('SELECT idx FROM user_learning_resumes WHERE user_id=1 AND session_id=?').get('session-round-1').idx, 4);
assert.throws(() => operations.execute(1, Object.assign({}, round, {
  requestId: 'operation_request_round_incomplete',
  payload: Object.assign({}, round.payload, { eventId: 'round_event_incomplete_01', answerCount: 3 })
})), error => error.code === 'ROUND_INCOMPLETE' && error.status === 409);
assert.equal(db.prepare('SELECT deleted_at FROM user_learning_resumes WHERE user_id=1 AND session_id=?').get('session-round-1').deleted_at, null,
  'an incomplete round cannot clear the resumable checkpoint');
const roundResult = operations.execute(1, round).operation;
assert.equal(roundResult.entity, 'round');
assert.equal(roundResult.answerCount, 2);
assert.equal(roundResult.chunkRight, 3);
assert.equal(roundResult.chunkTotal, 4);
assert.equal(roundResult.accuracy, 75, 'the server recomputes round accuracy from accepted per-answer evidence');
assert.equal(roundResult.maxCombo, 1, 'the server recomputes perfect-answer streaks in answer order');
assert.equal(roundResult.perfectCount, 1);
assert.deepEqual(roundResult.best, { acc: 75, perfect: 1, combo: 1, lastPlayed: round.payload.occurredAt, lastAcc: 75 });
assert.notEqual(db.prepare('SELECT deleted_at FROM user_learning_resumes WHERE user_id=1 AND session_id=?').get('session-round-1').deleted_at, null,
  'finishing the same session tombstones its resume checkpoint');
const roundStats = JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json);
assert.equal(roundStats.totalRounds, 1);
assert.equal(roundStats.daysLog['2026-01-02'].rounds, 1, 'round day uses the supplied IANA timezone and stable occurrence time');
const roundEvent = JSON.parse(db.prepare('SELECT data_json FROM user_events WHERE user_id=1 AND id=?').get('round_event_000001').data_json);
assert.equal(roundEvent.sessionId, 'session-round-1');
assert.equal(roundEvent.accuracy, 75);
assert.equal(roundEvent.perfectCount, 1);
const roundBest = JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='best'").get().v_json);
assert.equal(roundBest['round-deck'].acc, 75);
assert.equal(roundBest['round-deck'].combo, 1);
assert.equal(roundBest['round-deck'].lastAcc, 75);
assert.equal(operations.execute(1, round).duplicate, true);
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalRounds, 1);
const roundRetryWithNewRequest = Object.assign({}, round, { requestId: 'operation_request_round_02' });
assert.equal(operations.execute(1, roundRetryWithNewRequest).outcome, 'already-applied');
assert.equal(JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=1 AND k='stats'").get().v_json).totalRounds, 1);

(async function verifyRoute() {
  const app = express();
  app.use(express.json());
  registerOperationRoutes({ app, auth: { authenticate(req, _res, next) { req.userId = 2; next(); } }, operations, writeProtocol: 3,
    recordSaveFailure(userId, code, status, traceId) {
      db.prepare('INSERT INTO user_operation_failures(user_id,code,status,trace_id) VALUES(?,?,?,?)').run(userId, code, status, traceId);
    } });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const gateApp = express();
  gateApp.use(express.json());
  registerOperationRoutes({ app: gateApp, auth: { authenticate(req, _res, next) { req.userId = 2; next(); } }, operations, writeProtocol: 2 });
  const gateServer = http.createServer(gateApp);
  await new Promise(resolve => gateServer.listen(0, '127.0.0.1', resolve));
  const request = (targetServer, body) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: targetServer.address().port, path: '/api/operations', method: 'POST', headers: { 'content-type': 'application/json' } }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
  const getReceipt = id => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/api/operations/' + encodeURIComponent(id) }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
  try {
    const blockedByDefault = await request(gateServer, { protocol: 3, requestId: 'operation_request_gate_01', type: 'course.progress', payload: {
      courseId: 'must-stay-legacy', nodeId: 'must-not-apply', passed: true, completed: false
    } });
    assert.equal(blockedByDefault.status, 428, 'the legacy server mode refuses protocol 3 writes');
    assert.equal(blockedByDefault.body.code, 'CLIENT_UPDATE_REQUIRED');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_course_progress WHERE user_id=2 AND course_id=?').get('must-stay-legacy').n, 0);
    const viaHttp = await request(server, { protocol: 3, requestId: 'operation_request_route_01', type: 'course.progress', payload: {
      courseId: 'route-course', nodeId: 'route-node', passed: true, completed: false
    } });
    assert.equal(viaHttp.status, 200);
    assert.equal(viaHttp.body.ok, true);
    const receipt = await getReceipt(viaHttp.body.requestId);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.body.seq, viaHttp.body.seq);
    assert.equal((await getReceipt('operation_request_unknown')).status, 404);
    const unsupported = await request(server, { protocol: 3, requestId: 'operation_request_route_02', type: 'learning.answer', payload: {} });
    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.body.code, 'INVALID_OPERATION');
    assert.match(unsupported.body.traceId, /^[0-9a-f-]{36}$/);
    const recordedFailure = db.prepare('SELECT user_id,code,status,trace_id FROM user_operation_failures').get();
    assert.deepEqual(recordedFailure, { user_id: 2, code: 'INVALID_OPERATION', status: 400, trace_id: unsupported.body.traceId },
      'a failed operation records only its account, fixed error category, status, and trace identifier');
    assert.equal(Object.hasOwn(recordedFailure, 'request_body'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => gateServer.close(resolve));
    db.close();
  }
  console.log('server operations: idempotency, merge, account scope, revision checks and HTTP route passed');
})().catch(error => { console.error(error); db.close(); process.exitCode = 1; });
