import { resolveLearningState } from './state.mjs';

// Read-only compatibility projection. Never promotes legacy evidence into a
// broader application skill, changes SRS, or writes back to the source record.
export function projectArchiveState({ source, progress = {}, stat = {}, familiarity = null,
  selfAssessment = null, contentFingerprint, now = Date.now() } = {}) {
  let legacyVerified = false;
  let learning = false;
  let needsRevalidation = false;
  let dueAt = 0;
  let evidenceScope = 'none';
  if (source === 'sentence') {
    const state = resolveLearningState({ stat, familiarity, contentFingerprint, now });
    legacyVerified = state.verifiedMastered;
    learning = state.lastExposureAt > 0 || state.initialPassed;
    needsRevalidation = state.needsRevalidation || state.phase === 'relearning';
    dueAt = state.dueAt;
    evidenceScope = legacyVerified ? 'sentence-recall' : 'none';
  } else if (source === 'vocabulary-pilot' || source === 'vocabulary-book') {
    learning = Number(progress.lastAt) > 0;
    dueAt = Number(progress.dueAt) || 0;
    // Old pilot mastery means delayed retrieval, not transfer to a new context.
    legacyVerified = source === 'vocabulary-pilot' && progress.mastered === true;
    evidenceScope = legacyVerified ? 'word-recall' : 'none';
  } else {
    return { state: 'unknown', label: '记录未接入', verifiedMastered: null,
      selfMastered: false, evidenceScope: 'unknown', dueAt: null, due: null };
  }
  const selfMastered = selfAssessment?.value === 'mastered' && selfAssessment?.revoked !== true;
  const familiar = !!familiarity || (selfAssessment?.value === 'familiar' && selfAssessment?.revoked !== true);
  const state = needsRevalidation ? 'reinforce' : selfMastered ? 'self-mastered'
    : familiar ? 'familiar' : legacyVerified ? 'legacy-verified' : learning ? 'learning' : 'new';
  const labels = { reinforce: '需巩固', 'self-mastered': '掌握 · 自评未验证',
    familiar: '熟悉', 'legacy-verified': '原测评已通过', learning: '学习中', new: '未学习' };
  return { state, label: labels[state], verifiedMastered: false, selfMastered,
    legacyVerified, evidenceScope, dueAt, due: dueAt > 0 && dueAt <= now };
}

// Explicit metadata only. A story format does not imply a knowledge category;
// a grade, exam or publisher does not imply language ability.
export function projectArchiveClassification(resource = {}) {
  const unique = values => [...new Set((Array.isArray(values) ? values : [])
    .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
  const facets = resource.facets || {};
  const category = unique(resource.knowledgeCategories).filter(value => ['vocabulary', 'expression'].includes(value));
  return { kind: ['course', 'wordbook', 'textbook'].includes(resource.kind) ? resource.kind : null,
    courseFormat: ['sentence', 'illustrated'].includes(resource.courseFormat) ? resource.courseFormat : null,
    knowledgeCategories: category, schoolStages: unique(facets.schoolStages), grades: unique(facets.grades),
    levels: unique(facets.levels), exams: unique(facets.exams), goals: unique(facets.goals), topics: unique(facets.topics),
    publisherId: facets.publisherId || null, edition: facets.edition || null, volume: facets.volume || null };
}

export function masteryConfirmation({ assessmentAvailable = false } = {}) {
  return { title: '标记为掌握？',
    message: '熟悉不等于能独立应用。此操作只记录你的自评，不代表通过掌握测评，也不会删除学习记录或取消到期复习。',
    assessmentAvailable, assessmentLabel: assessmentAvailable ? '去测评' : '应用测评尚未开放',
    confirmLabel: '仍标记为掌握（自评）', cancelLabel: '取消' };
}
