import { CourseCapabilityCatalog } from './capabilities.mjs';

export const SENTENCE_TEMPLATE = Object.freeze({
  id: 'sentence-practice', version: 1,
  modes: Object.freeze(['typing', 'chunkSelection']),
  ordering: Object.freeze(['sentences:adaptive', 'article:source', 'dialogue:source'])
});

export function inspectLearning(draft, preferences = null) {
  const issues = [];
  const learning = draft && draft.learning;
  const modes = learning && Array.isArray(learning.modes) ? learning.modes : [];
  const available = new Set(SENTENCE_TEMPLATE.modes);
  const capabilities = CourseCapabilityCatalog.fromDraft(draft || {});
  const usable = new Set(modes.filter((mode) => available.has(mode)
    && (mode === 'typing' ? capabilities.text : capabilities.chunkSelection)));

  if (!learning || learning.template !== SENTENCE_TEMPLATE.id || learning.version !== SENTENCE_TEMPLATE.version) {
    issues.push({ code: 'UNKNOWN_TEMPLATE', path: 'learning.template', severity: 'error', message: '这个学习模板暂不支持。', suggestion: '让 AI 使用 sentence-practice 模板重新生成课程。' });
  }
  if (!modes.length) issues.push({ code: 'NO_LEARNING_MODE', path: 'learning.modes', severity: 'error', message: '课程没有声明可用的练习方式。', suggestion: '至少选择输入或意群选择，并提供对应内容。' });
  modes.forEach((mode, index) => {
    if (!available.has(mode)) issues.push({ code: 'UNSUPPORTED_MODE', path: `learning.modes[${index}]`, severity: 'error', message: `当前学习模板不支持“${mode}”。`, suggestion: '请选择输入或意群选择。' });
    else if (mode === 'chunkSelection' && !capabilities.chunkSelection) issues.push({ code: 'MODE_DATA_MISSING', path: 'learning.modes', severity: 'error', message: '课程声明了意群选择，但并非每句话都提供完整意群。', suggestion: '补齐每句话的意群，或移除该练习方式。' });
    else if (mode === 'typing' && !capabilities.text) issues.push({ code: 'MODE_DATA_MISSING', path: 'learning.modes', severity: 'error', message: '课程声明了输入练习，但缺少英文内容。', suggestion: '补齐英文句子。' });
  });
  if (!usable.has(learning && learning.defaultMode)) issues.push({ code: 'INVALID_DEFAULT_MODE', path: 'learning.defaultMode', severity: 'error', message: '默认练习方式必须是本课程实际支持的方式。', suggestion: '将默认方式改为 learning.modes 中可用的一项。' });

  if (preferences && Array.isArray(preferences.exerciseModes)) {
    const chosen = [...new Set(preferences.exerciseModes.filter((mode) => available.has(mode)))].sort();
    const returned = [...usable].sort();
    if (JSON.stringify(chosen) !== JSON.stringify(returned)) issues.push({ code: 'PREFERENCE_MISMATCH', path: 'learning.modes', severity: 'warning', message: 'AI 返回的练习方式与制作时选择的方式不同。', suggestion: '检查预览后确认使用 AI 返回的方式，或复制修复指令让 AI 按原选择修改。' });
  }
  return { issues, supportedModes: SENTENCE_TEMPLATE.modes.map((id) => ({ id, enabled: usable.has(id), default: learning && learning.defaultMode === id })) };
}
