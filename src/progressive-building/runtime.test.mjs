import test from 'node:test';
import assert from 'node:assert/strict';
import { lesson } from './content/pb01.mjs';
import { createRun, recordAttempt, exposeSupport, completeStep, serializeRun, restoreRun } from './runtime.mjs';

test('attempts distinguish unassisted first answers and deduplicate repeated submit events', () => {
  let run = createRun(lesson, 10, 'run-1');
  run = recordAttempt(run, { eventId: 'submit-1', response: 'I', now: 11, outcome: 'correct' });
  run = recordAttempt(run, { eventId: 'submit-1', response: 'I', now: 12, outcome: 'correct' });
  run = exposeSupport(run, 'example');
  run = recordAttempt(run, { eventId: 'submit-2', response: 'She rests.', now: 13, outcome: 'correct' });
  assert.equal(run.attempts.length, 2);
  assert.equal(run.attempts[0].independent, true);
  assert.equal(run.attempts[1].independent, false);
  assert.equal(run.attempts[1].exposure.example, true);
});

test('completion honors step dependencies and restoration is version aware', () => {
  let run = createRun(lesson, 10, 'run-2');
  assert.throws(() => completeStep(run, lesson, 'pb01-merge'), /Incomplete prerequisite/);
  run = completeStep(run, lesson, 'pb01-local-subject');
  assert.equal(run.currentStepId, 'pb01-local-predicate');
  const restored = restoreRun(serializeRun(run), lesson);
  assert.equal(restored.currentStepId, 'pb01-local-predicate');
  assert.equal(restoreRun({ ...serializeRun(run), lessonVersion: 0 }, lesson).priorEvidence.length, 0);
});
