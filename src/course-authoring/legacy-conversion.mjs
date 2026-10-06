import { CourseCreationPreferences } from './preferences.mjs';

function markerList(course) { return course && course.authorNotes && course.authorNotes.chunklabAuthoring || []; }
function roleName(course, roleId) { const role = (course.roles || []).find((item) => item.id === roleId); return role && role.name || roleId; }

/** @param {object} course @param {{chunkShape?:any,preferences?:object}} options */
export function inspectLegacyAiCourse(course, { chunkShape, preferences = {} } = {}) {
  const markers = markerList(course);
  const recognized = !!(course && course.schemaVersion === '2.0' && markers.includes('format=chunklab-ai-course') && markers.includes('formatVersion=1.0'));
  const blockers = [], warnings = [];
  if (!recognized) blockers.push({ code: 'UNRECOGNIZED_SOURCE', message: '无法确认这是由本平台 AI 制作流程生成的旧课程。' });
  if (!course || typeof course.courseId !== 'string' || !course.courseId.trim()) blockers.push({ code: 'MISSING_COURSE_ID', path: 'courseId', message: '课程编号缺失，无法建立稳定的学习记录。' });
  if (!course || !course.metadata || !course.metadata.title || typeof course.metadata.title['zh-CN'] !== 'string' || !course.metadata.title['zh-CN'].trim()) blockers.push({ code: 'MISSING_TITLE', path: 'metadata.title.zh-CN', message: '课程缺少中文标题。' });
  if (!course || !Array.isArray(course.roles)) blockers.push({ code: 'INVALID_ROLES', path: 'roles', message: '课程角色信息格式无法识别。' });
  const utterances = course && Array.isArray(course.utterances) ? course.utterances : [];
  const byId = new Map();
  utterances.forEach((item, index) => {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) blockers.push({ code: 'INVALID_UTTERANCE_ID', path: `utterances[${index}].id`, message: `第 ${index + 1} 条内容缺少有效编号。` });
    else if (byId.has(item.id)) blockers.push({ code: 'DUPLICATE_UTTERANCE_ID', path: `utterances[${index}].id`, message: `内容编号“${item.id}”重复。` });
    else byId.set(item.id, item);
  });
  const sequence = course && Array.isArray(course.sequence) ? course.sequence : [];
  if (new Set(sequence).size !== sequence.length) blockers.push({ code: 'DUPLICATE_SEQUENCE_ID', path: 'sequence', message: '课程顺序中有重复内容，无法安全保留顺序。' });
  const lines = sequence.map((id, index) => {
    const item = byId.get(id);
    if (!item) { blockers.push({ code: 'MISSING_UTTERANCE', index, message: `课程顺序中的第 ${index + 1} 条内容不存在。` }); return null; }
    const sourceChunks = item.chunks;
    const chunkItems = sourceChunks && Array.isArray(sourceChunks.items) ? sourceChunks.items : [];
    const chunkById = new Map();
    chunkItems.forEach((chunk, chunkIndex) => {
      if (!chunk || typeof chunk.id !== 'string' || !chunk.id.trim() || chunkById.has(chunk.id)) blockers.push({ code: 'INVALID_CHUNK_ID', path: `utterances[${index}].chunks.items[${chunkIndex}].id`, message: `第 ${index + 1} 条意群编号缺失或重复。` });
      else chunkById.set(chunk.id, chunk);
    });
    const order = sourceChunks && Array.isArray(sourceChunks.correctOrder) ? sourceChunks.correctOrder : null;
    const chunks = order && order.map((chunkId) => chunkById.get(chunkId)).filter(Boolean).map((chunk) => String(chunk.text || '').trim());
    if (order && (chunks.length !== order.length || new Set(order).size !== order.length || order.length !== chunkItems.length)) blockers.push({ code: 'INVALID_CHUNK_ORDER', path: `utterances[${index}].chunks.correctOrder`, message: `第 ${index + 1} 条意群顺序有缺失、重复或未使用的片段。` });
    if (!item.text || !item.text.en || !item.text['zh-CN']) blockers.push({ code: 'MISSING_TRANSLATION', index, message: `第 ${index + 1} 条缺少英文或中文内容。` });
    if (!chunks || !chunks.length) blockers.push({ code: 'MISSING_CHUNKS', path: `utterances[${index}].chunks`, index, message: `第 ${index + 1} 条没有可复用的完整意群。` });
    else {
      if (chunkShape && !chunkShape.chunkCountOk(item.text.en, chunks)) blockers.push({ code: 'CHUNK_SHAPE_UNSUPPORTED', path: `utterances[${index}].chunks`, index, message: `第 ${index + 1} 条的意群数量不符合现有练习要求。` });
      if (String(chunks.join(' ')).replace(/[\t\n\f\r ]+/g, ' ').trim() !== String(item.text && item.text.en || '').replace(/[\t\n\f\r ]+/g, ' ').trim()) blockers.push({ code: 'CHUNK_TEXT_MISMATCH', path: `utterances[${index}].chunks`, index, message: `第 ${index + 1} 条意群拼接后与英文原句不一致。` });
    }
    const accepted = item.acceptedAnswers && item.acceptedAnswers.en || [];
    if (accepted.some((answer) => String(answer).trim().toLocaleLowerCase('en') !== String(item.text && item.text.en || '').trim().toLocaleLowerCase('en'))) blockers.push({ code: 'ALTERNATE_ANSWER_UNSUPPORTED', index, message: `第 ${index + 1} 条含有原生练习无法安全验证的替代答案。` });
    if (item.chunks && Array.isArray(item.chunks.distractors) && item.chunks.distractors.length) warnings.push({ code: 'DISTRACTORS_NOT_MAPPED', path: `utterances[${index}].chunks.distractors`, index, message: `第 ${index + 1} 条的旧版干扰项没有意群位置标记，转换后不沿用。` });
    if (item.chunks && !Array.isArray(item.chunks.distractors)) blockers.push({ code: 'INVALID_DISTRACTORS', path: `utterances[${index}].chunks.distractors`, index, message: `第 ${index + 1} 条的干扰项格式无法识别。` });
    if (item.roleId && !(Array.isArray(course.roles) ? course.roles : []).some((role) => role && role.id === item.roleId)) blockers.push({ code: 'UNKNOWN_ROLE', index, message: `第 ${index + 1} 条引用了未知角色。` });
    if (item.imageAssetId || item.audioAssetId) blockers.push({ code: 'MEDIA_NOT_MAPPED', path: `utterances[${index}]`, index, message: `第 ${index + 1} 条包含图片或音频，原生句子练习暂时无法保留这些素材。` });
    if (!item.chunks || !Array.isArray(item.chunks.hints) || item.chunks.hints.length !== (chunks || []).length) warnings.push({ code: 'HINTS_GENERATED', path: `utterances[${index}].chunks.hints`, index, message: `第 ${index + 1} 条没有完整的中文意群提示，适配时会暂用词数提示。` });
    return { item, chunks, sourceId: id };
  });
  if (!sequence.length) blockers.push({ code: 'EMPTY_COURSE', path: 'sequence', message: '课程没有可转换的内容。' });
  if (sequence.some((id) => !byId.has(id))) { /* Missing rows already carry a field path above. */ }
  const unsupportedCapabilities = course && course.capabilities || {};
  if (unsupportedCapabilities.roleplay) blockers.push({ code: 'ROLEPLAY_NOT_MAPPED', path: 'capabilities.roleplay', message: '课程包含角色扮演能力，当前句子练习无法复现该互动。' });
  if (unsupportedCapabilities.typing === false || unsupportedCapabilities.chunkSelection === false) blockers.push({ code: 'MODE_NOT_SUPPORTED', path: 'capabilities', message: '课程声明的练习方式与当前句子练习不一致。' });
  if (unsupportedCapabilities.audio || unsupportedCapabilities.image) blockers.push({ code: 'MEDIA_NOT_MAPPED', path: 'capabilities', message: '课程声明了图片或音频学习内容，当前句子练习暂时无法保留。' });
  const normalized = CourseCreationPreferences.normalize(preferences);
  const defaultMode = normalized.exerciseModes.includes('chunkSelection') ? 'chunkSelection' : 'typing';
  const valid = recognized && blockers.length === 0;
  return { recognized, valid, kind: !recognized ? 'not-applicable' : !valid ? 'blocked' : warnings.length ? 'confirmation-required' : 'native-ready', blockers, warnings,
    history: { seen: course && course.progress && course.progress.seen || null, passed: course && course.progress && course.progress.passed || null, currentNodeId: course && course.progress && course.progress.currentNodeId || null, importedAsNativeStats: false },
    plan: recognized && blockers.length === 0 ? { deckId: course.courseId, catalogCourseId: `package:${course.courseId}`, legacySource: { courseId: course.courseId, version: course.version || '1.0.0' }, lineIds: lines.map((line) => line.sourceId), defaultMode } : null };
}

/** @param {object} course @param {{chunkShape?:any,preferences?:object,validator?:any}} options */
export function convertLegacyAiCourse(course, { chunkShape, preferences = {}, validator = null } = {}) {
  const report = inspectLegacyAiCourse(course, { chunkShape, preferences });
  if (!report.valid) return { report, draft: null };
  const form = markerList(course).find((item) => item.startsWith('contentForm='))?.slice('contentForm='.length);
  const contentForm = ['sentences', 'article', 'dialogue'].includes(form) ? form : 'sentences';
  const roles = (Array.isArray(course.roles) ? course.roles : []).map((role) => ({ key: role.id, name: roleName(course, role.id) }));
  const lines = course.sequence.map((id) => {
    const item = course.utterances.find((row) => row.id === id);
    const chunks = item.chunks.correctOrder.map((chunkId) => item.chunks.items.find((chunk) => chunk.id === chunkId).text.trim());
    const hints = item.chunks.hints;
    return { en: item.text.en, zh: item.text['zh-CN'], ...(item.roleId ? { role: item.roleId } : {}), chunks,
      hints: Array.isArray(hints) && hints.length === chunks.length ? hints.slice() : chunks.map((chunk) => `${chunk.split(/\s+/).filter(Boolean).length} 词`) };
  });
  const selected = CourseCreationPreferences.normalize(preferences);
  const modes = selected.exerciseModes.length ? selected.exerciseModes : ['typing'];
  const draft = { format: 'chunklab-ai-course', formatVersion: '1.1', title: course.metadata.title['zh-CN'], description: course.metadata.description['zh-CN'] || '', targetCefr: course.metadata.targetCefr || 'A2', contentForm, roles, learning: { template: 'sentence-practice', version: 1, modes, defaultMode: report.plan.defaultMode }, items: lines };
  if (validator) {
    const validation = validator.validate(draft);
    const validationErrors = (validation.issues || []).filter((item) => item.severity === 'error');
    if (!validation.valid || validationErrors.length) {
      report.valid = false; report.kind = 'blocked';
      report.blockers.push(...validationErrors.map((item) => ({ code: item.code, path: item.path, message: item.message })));
      report.plan = null;
      return { report, draft: null };
    }
  }
  return { report, draft };
}
