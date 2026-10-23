'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { ensureExpressionCourseSchema } = require('./schema');
const { createExpressionCourseRepository } = require('./repository');
const runtime = require('./runtime.cjs');

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expression-session-'));
  const db = new Database(path.join(dir, 'isolated.sqlite'));
  ensureExpressionCourseSchema(db);
  const repository = createExpressionCourseRepository({ db, validatePackage: require('./validate.cjs').validateExpressionPackage });
  const lesson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../src/expression-course/fixtures/L001-like.reference.json'), 'utf8'));
  const audio = repository.uploadAsset({ assetId: 'l001_tea', mimeType: 'audio/mpeg', base64: Buffer.from('ID3sound').toString('base64') });
  const coffee = repository.uploadAsset({ assetId: 'l001_coffee', mimeType: 'audio/mpeg', base64: Buffer.from('ID3other').toString('base64') });
  lesson.audioAssets.forEach(item => { item.status = 'ready'; item.path = item.assetId + '.mp3'; });
  const pkg = { format: 'chunklab-expression-course', formatVersion: '1.0', courseId: 'expression-like', title: '表达喜欢', description: '测试', audience: 'adult_beginner', lessons: [lesson],
    assets: [{ ...audio, localFile: 'l001_tea.mp3' }, { ...coffee, localFile: 'l001_coffee.mp3' }],
    reviewActivities: [{ lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A08' }, { lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A09' }] };
  const draft = repository.createDraft(pkg, 9, 'draft-create-request-1');
  const checked = repository.validate(draft.draftId); repository.review(draft.draftId, checked.contentHash);
  const release = repository.publish(draft.draftId, { expectedRevision: 1, contentHash: checked.contentHash, requestId: 'release-request-001' }, 9);
  let clock = Date.UTC(2026, 0, 1);
  let access = { allowed: true };
  const sessions = require('./session-service').createExpressionSessionService({ db, repository, runtime, authorize: () => access, now: () => clock });
  t.after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { db, repository, sessions, release, setNow: value => { clock = value; }, setAccess: value => { access = value; } };
}

test('review starts the selected independent activity, records account-scoped result, and schedules next review', t => {
  const f = setup(t);
  f.db.prepare(`INSERT INTO expression_skill_states(user_id,course_id,release_id,skill_id,status,due_at,review_step,evidence_json)
    VALUES(7,'expression-like',?,'express_like','mastered',?,0,'{}')`).run(f.release.releaseId, Date.UTC(2025, 11, 31));
  const due = f.sessions.due(7);
  assert.equal(due.length, 1); assert.equal(due[0].activityId, 'L001_A08');
  const session = f.sessions.start({ courseId: 'expression-like', lessonId: 'L001', releaseId: f.release.releaseId, mode: 'review',
    reviewSkillId: 'express_like', reviewActivityId: 'L001_A08', requestId: 'review-start-request-1' }, 7);
  assert.equal(session.state.activity.type, 'independent_output');
  const result = f.sessions.act(session.sessionId, 7, { requestId: 'review-answer-request-1', expectedRevision: 0,
    action: { type: 'submit', response: { text: 'I like tea.' } } });
  assert.equal(result.result.independent, true);
  const retried = f.sessions.act(session.sessionId, 7, { requestId: 'review-answer-request-1', expectedRevision: 0,
    action: { type: 'submit', response: { text: 'I like tea.' } } });
  assert.equal(retried.revision, result.revision);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM expression_attempts WHERE user_id=7 AND request_id=?').get('review-answer-request-1').count, 1);
  assert.equal(f.db.prepare('SELECT due_at FROM expression_skill_states WHERE user_id=7 AND skill_id=?').get('express_like').due_at, Date.UTC(2026, 0, 4));
  assert.equal(f.db.prepare('SELECT status FROM expression_skill_states WHERE user_id=7 AND skill_id=?').get('express_like').status, 'mastered');
  f.setNow(Date.UTC(2026, 0, 4));
  assert.equal(f.sessions.due(7).length, 1, 'the injected clock makes the scheduled review due without waiting a real day');
  const nextReview = f.sessions.start({ courseId: 'expression-like', lessonId: 'L001', releaseId: f.release.releaseId, mode: 'review',
    reviewSkillId: 'express_like', reviewActivityId: 'L001_A08', requestId: 'review-start-request-2' }, 7);
  const failedReview = f.sessions.act(nextReview.sessionId, 7, { requestId: 'review-answer-request-2', expectedRevision: 0,
    action: { type: 'submit', response: { text: 'I hate tea.' } } });
  assert.equal(failedReview.result.correct, false);
  assert.equal(f.db.prepare('SELECT due_at FROM expression_skill_states WHERE user_id=7 AND skill_id=?').get('express_like').due_at, Date.UTC(2026, 0, 5));
  assert.equal(f.db.prepare('SELECT status FROM expression_skill_states WHERE user_id=7 AND skill_id=?').get('express_like').status, 'needs_practice');
  assert.throws(() => f.sessions.get(session.sessionId, 8), error => error.code === 'EXPRESSION_SESSION_NOT_FOUND');
  assert.throws(() => f.sessions.start({ courseId: 'expression-like', lessonId: 'L001', mode: 'review', requestId: 'review-start-request-1',
    reviewSkillId: 'express_like', reviewActivityId: 'L001_A09' }, 7), error => error.code === 'IDEMPOTENCY_CONFLICT');
});

test('an unfinished learning session resumes on its pinned release after a newer release is published', t => {
  const f = setup(t);
  const first = f.sessions.start({ courseId: 'expression-like', lessonId: 'L001', requestId: 'version-start-request-1' }, 7);
  const advanced = f.sessions.act(first.sessionId, 7, { requestId: 'version-continue-request-1', expectedRevision: 0,
    action: { type: 'continue' } });
  assert.equal(advanced.state.index, 1);
  const original = f.repository.release('expression-like', f.release.releaseId);
  const updatedPackage = { ...original.package, description: '修订版课程内容' };
  const draft = f.repository.createDraft(updatedPackage, 9, 'version-draft-request-2');
  const checked = f.repository.validate(draft.draftId);
  f.repository.review(draft.draftId, checked.contentHash);
  const newer = f.repository.publish(draft.draftId, { expectedRevision: draft.revision, contentHash: checked.contentHash,
    requestId: 'version-publish-request-2' }, 9);
  assert.notEqual(newer.releaseId, f.release.releaseId);

  const resumed = f.sessions.start({ courseId: 'expression-like', lessonId: 'L001', requestId: 'version-resume-request-2' }, 7);
  assert.equal(resumed.sessionId, first.sessionId);
  assert.equal(resumed.releaseId, f.release.releaseId);
  assert.equal(resumed.state.index, 1);
});

test('authorization expiry blocks reads and actions without changing the last confirmed session state', t => {
  const f = setup(t);
  const session = f.sessions.start({ courseId: 'expression-like', lessonId: 'L001', requestId: 'expiry-start-request-1' }, 7);
  f.sessions.act(session.sessionId, 7, { requestId: 'expiry-continue-request-1', expectedRevision: 0, action: { type: 'continue' } });
  f.setAccess({ allowed: false, reasonCode: 'AUTHORIZATION_EXPIRED', status: 403 });
  assert.throws(() => f.sessions.get(session.sessionId, 7), error => error.code === 'AUTHORIZATION_EXPIRED');
  assert.throws(() => f.sessions.act(session.sessionId, 7, { requestId: 'expiry-answer-request-1', expectedRevision: 1,
    action: { type: 'submit', response: { text: 'I like tea.' } } }), error => error.code === 'AUTHORIZATION_EXPIRED');
  assert.equal(f.db.prepare('SELECT revision FROM expression_sessions WHERE session_id=?').get(session.sessionId).revision, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM expression_attempts WHERE session_id=?').get(session.sessionId).count, 1,
    'denied requests do not write an attempt or erase the confirmed progress');
});
