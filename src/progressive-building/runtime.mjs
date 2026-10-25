export const PREVIEW_STORAGE_KEY = 'chunk-practice:progressive-preview:v1';

export function createRun(lesson, now = Date.now(), runId = crypto.randomUUID()) {
  return {
    lessonId: lesson.id,
    lessonVersion: lesson.version,
    runId,
    currentStepId: lesson.steps[0].id,
    completedStepIds: [],
    attempts: [],
    exposure: { hint: false, example: false, reference: false },
    startedAt: now,
  };
}

export function recordAttempt(run, { eventId, stepId = run.currentStepId, response, now = Date.now(), outcome, feedback = null }) {
  if (!eventId || run.attempts.some(attempt => attempt.eventId === eventId)) return run;
  const hasResponse = typeof response === 'string' ? response.trim().length > 0 : response != null;
  const independent = hasResponse && !run.exposure.hint && !run.exposure.example && !run.exposure.reference;
  return {
    ...run,
    attempts: [...run.attempts, {
      eventId, lessonId: run.lessonId, lessonVersion: run.lessonVersion,
      stepId, runId: run.runId, attemptNumber: run.attempts.filter(item => item.stepId === stepId).length + 1,
      response, occurredAt: now, outcome, feedback, exposure: { ...run.exposure }, independent,
    }],
    exposure: { hint: false, example: false, reference: false },
  };
}

export function exposeSupport(run, kind) {
  if (!['hint', 'example', 'reference'].includes(kind)) throw new TypeError(`Unsupported support exposure: ${kind}`);
  return { ...run, exposure: { ...run.exposure, [kind]: true } };
}

export function completeStep(run, lesson, stepId = run.currentStepId) {
  const stepIndex = lesson.steps.findIndex(step => step.id === stepId);
  if (stepIndex < 0) throw new RangeError(`Unknown step: ${stepId}`);
  const step = lesson.steps[stepIndex];
  if (step.dependsOn?.some(dependency => !run.completedStepIds.includes(dependency))) throw new Error(`Incomplete prerequisite for ${stepId}`);
  const completedStepIds = run.completedStepIds.includes(stepId) ? run.completedStepIds : [...run.completedStepIds, stepId];
  const next = lesson.steps[stepIndex + 1];
  return { ...run, completedStepIds, currentStepId: next?.id ?? stepId };
}

export function serializeRun(run) {
  return { version: 1, lessonId: run.lessonId, lessonVersion: run.lessonVersion, run };
}

export function restoreRun(saved, lesson) {
  if (!saved || saved.version !== 1 || saved.lessonId !== lesson.id || !saved.run) return null;
  const stepIds = new Set(lesson.steps.map(step => step.id));
  if (saved.lessonVersion !== lesson.version) return { ...createRun(lesson), priorEvidence: saved.run.attempts ?? [] };
  if (!stepIds.has(saved.run.currentStepId)) return null;
  return { ...saved.run, completedStepIds: (saved.run.completedStepIds ?? []).filter(id => stepIds.has(id)) };
}
