'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { ensureExpressionCourseSchema } = require('./schema');
const { createExpressionCourseRepository } = require('./repository');
const { createExpressionSessionService } = require('./session-service');
const runtime = require('./runtime.cjs');

test('actual unit01 package resumes, completes both lessons, and schedules unmastered skills for review', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expression-unit01-'));
  const filename = path.join(dir, 'isolated.sqlite');
  let db = new Database(filename);
  t.after(() => { db.close(); });
  ensureExpressionCourseSchema(db);
  const packageDir = path.resolve(__dirname, '../../../output/expression-course-drafts/unit01-formal-v1');
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'course-package.json'), 'utf8'));
  const repository = createExpressionCourseRepository({ db, validatePackage: require('./validate.cjs').validateExpressionPackage });
  for (const asset of pkg.assets) repository.uploadAsset({ assetId: asset.assetId, mimeType: asset.mimeType,
    base64: fs.readFileSync(path.join(packageDir, asset.localFile)).toString('base64') });
  const draft = repository.createDraft(pkg, 9, 'unit01-draft-create-001');
  const checked = repository.validate(draft.draftId);
  repository.review(draft.draftId, checked.contentHash);
  repository.publish(draft.draftId, { expectedRevision: draft.revision, contentHash: checked.contentHash, requestId: 'unit01-publish-001' }, 9);
  let clock = Date.UTC(2026, 9, 23), counter = 0;
  const sessions = createExpressionSessionService({ db, repository, runtime, authorize: () => ({ allowed: true }), now: () => clock });
  for (const lesson of pkg.lessons) {
    let current = sessions.start({ courseId: pkg.courseId, lessonId: lesson.lessonId, requestId: 'unit01-start-' + lesson.lessonId }, 7);
    while (!current.state.completed) {
      const activity = lesson.activities[current.state.index];
      const action = ['meaning_intro', 'micro_explanation'].includes(activity.type) ? { type: 'continue' } :
        { type: 'submit', response: activity.type === 'listening_choice' ? { optionId: activity.evaluation.correctOptionId } : { text: activity.evaluation.acceptedAnswers[0] } };
      const request = { requestId: 'unit01-action-' + (++counter), expectedRevision: current.revision, action };
      current = sessions.act(current.sessionId, 7, request);
      assert.equal(sessions.act(current.sessionId, 7, request).revision, current.revision);
      if (current.state.index === 1) {
        const resumed = sessions.start({ courseId: pkg.courseId, lessonId: lesson.lessonId, requestId: 'unit01-resume-' + lesson.lessonId }, 7);
        assert.equal(resumed.sessionId, current.sessionId);
        assert.equal(resumed.state.index, 1);
      }
      assert.throws(() => sessions.get(current.sessionId, 8), error => error.code === 'EXPRESSION_SESSION_NOT_FOUND');
    }
  }
  assert.equal(sessions.due(7).length, 0);
  clock += 86400000;
  assert.equal(sessions.due(7).length, 2, 'both completed lessons must enter review even without transfer mastery evidence');
  assert.equal(sessions.due(8).length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expression_skill_states WHERE status='mastered'").get().count, 0);
  const due = sessions.due(7)[0];
  const review = sessions.start({ courseId: pkg.courseId, lessonId: due.lessonId, releaseId: due.releaseId,
    mode: 'review', reviewSkillId: due.skillId, reviewActivityId: due.activityId, requestId: 'unit01-review-start-001' }, 7);
  const reviewActivity = pkg.lessons.find(item => item.lessonId === due.lessonId).activities.find(item => item.id === due.activityId);
  const reviewed = sessions.act(review.sessionId, 7, { requestId: 'unit01-review-answer-001', expectedRevision: review.revision,
    action: { type: 'submit', response: reviewActivity.type === 'listening_choice' ?
      { optionId: reviewActivity.evaluation.correctOptionId } : { text: reviewActivity.evaluation.acceptedAnswers[0] } } });
  assert.equal(reviewed.result.correct, true);
  assert.equal(reviewed.state.completed, true);
  assert.equal(sessions.due(7).length, 1, 'a successful review leaves the due list and schedules its next interval');
  db.close(); db = new Database(filename);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM expression_sessions').get().count, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM expression_attempts').get().count, counter + 1);
});
