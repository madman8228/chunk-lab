export function resolveCourseLearning(authoring) {
  const contract = authoring && authoring.template === 'sentence-practice' && authoring.templateVersion === 1 ? authoring.learning : null;
  const modes = contract && Array.isArray(contract.modes) ? contract.modes.filter((mode) => ['typing', 'chunkSelection'].includes(mode)) : [];
  const form = authoring && ['sentences', 'article', 'dialogue'].includes(authoring.contentForm) ? authoring.contentForm : 'sentences';
  return {
    enabled: !!contract && modes.length > 0,
    modes,
    defaultMode: modes.includes(contract && contract.defaultMode) ? contract.defaultMode : (modes[0] || 'typing'),
    mode: modes.includes(contract && contract.defaultMode) ? contract.defaultMode : (modes[0] || 'typing'),
    preserveOrder: form !== 'sentences',
    contentForm: form,
    roles: Array.isArray(authoring && authoring.roles) ? authoring.roles : []
  };
}

export function resolvePracticeMode(courseLearning, globalMode = 'choose') {
  if (!courseLearning || !courseLearning.enabled) return globalMode === 'type' ? 'type' : 'choose';
  return courseLearning.mode === 'typing' ? 'type' : 'choose';
}

export function shouldPreserveOrder(courseLearning) { return !!(courseLearning && courseLearning.enabled && courseLearning.preserveOrder); }
