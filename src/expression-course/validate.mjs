import Ajv2020 from 'ajv/dist/2020.js';
import packageSchema from './expression-package.schema.json' with { type: 'json' };
import lessonSchema from './lesson.schema.json' with { type: 'json' };

const validatePackageShape = new Ajv2020({ allErrors: true, strict: false }).compile(packageSchema);
const validateLessonShape = new Ajv2020({ allErrors: true, strict: false }).compile(lessonSchema);
const types = new Set(['meaning_intro', 'micro_explanation', 'sentence_build', 'substitution', 'listening_choice', 'independent_output', 'transfer_test']);

export function validateExpressionPackage(value, { forPublish = false, availableAssets = [] } = {}) {
  const errors = [];
  if (!validatePackageShape(value)) errors.push(...(validatePackageShape.errors || []).map(error => `${error.instancePath || '/'} ${error.message}`));
  if (!value || typeof value !== 'object' || !Array.isArray(value.lessons)) return { valid: false, errors };
  const assetIds = new Set((Array.isArray(value.assets) ? value.assets : []).map(asset => asset?.assetId));
  if (assetIds.size !== (Array.isArray(value.assets) ? value.assets.length : 0)) errors.push('/assets 包含重复 assetId');
  const available = new Set(availableAssets);
  const lessonIds = new Set();
  const activityById = new Map();
  const prerequisites = new Map();
  const taught = new Set(value.lessons.flatMap(lesson => Array.isArray(lesson?.taughtSkillIds) ? lesson.taughtSkillIds : []));
  for (const [lessonIndex, lesson] of value.lessons.entries()) {
    const prefix = `/lessons/${lessonIndex}`;
    if (!validateLessonShape(lesson)) errors.push(...(validateLessonShape.errors || []).map(error => `${prefix}${error.instancePath || '/'} ${error.message}`));
    if (lesson && typeof lesson.lessonId === 'string') {
      if (lessonIds.has(lesson.lessonId)) errors.push(`${prefix}/lessonId 重复`);
      lessonIds.add(lesson.lessonId);
    }
    const localIds = new Set();
    for (const [activityIndex, activity] of (Array.isArray(lesson?.activities) ? lesson.activities : []).entries()) {
      const activityPath = `${prefix}/activities/${activityIndex}`;
      if (!types.has(activity?.type)) errors.push(`${activityPath}/type 活动类型不支持`);
      if (localIds.has(activity?.id)) errors.push(`${activityPath}/id 重复`);
      localIds.add(activity?.id);
      activityById.set(`${lesson?.lessonId}:${activity?.id}`, activity);
      const payload = activity?.payload || {};
      if (activity?.type === 'listening_choice') {
        const audio = (Array.isArray(lesson?.audioAssets) ? lesson.audioAssets : []).find(item => item.assetId === payload.audioAssetId);
        if (!audio) errors.push(`${activityPath}/payload/audioAssetId 未在本课音频清单中声明`);
        if (forPublish && audio?.status !== 'ready') errors.push(`${activityPath}/payload/audioAssetId 音频尚未标记为已准备`);
      }
      if (activity?.type === 'transfer_test' && Array.isArray(activity.evaluation?.acceptedAnswers)) {
        const accepted = activity.evaluation.acceptedAnswers.map(answer => String(answer).normalize('NFKC').toLocaleLowerCase('en-US').replace(/[.!?。！？]+$/g, '').trim());
        const shownText = (Array.isArray(lesson.activities) ? lesson.activities : []).slice(0, activityIndex).flatMap(item => Object.values(item?.payload || {}).filter(value => typeof value === 'string'))
          .map(text => text.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[.!?。！？]+$/g, '').trim());
        if (accepted.some(answer => answer.length >= 6 && shownText.some(text => text === answer || text.includes(answer)))) {
          errors.push(`${activityPath} 迁移题答案可能已在前序活动中出现`);
        }
      }
      if (activity?.type === 'listening_choice' && (!assetIds.has(payload.audioAssetId) || forPublish && !available.has(payload.audioAssetId))) {
        errors.push(`${activityPath}/payload/audioAssetId 音频资源缺失`);
      }
      if (activity?.type === 'listening_choice' && !(Array.isArray(payload.options) ? payload.options : []).some(option => option.id === activity.evaluation?.correctOptionId)) {
        errors.push(`${activityPath}/evaluation/correctOptionId 正确选项不存在`);
      }
      if (forPublish && activity?.type === 'listening_choice' && !available.has(payload.audioAssetId)) errors.push(`${activityPath} 缺少已核验的可播放音频`);
    }
    for (const prerequisite of lesson?.prerequisiteSkillIds || []) {
      if (!taught.has(prerequisite)) errors.push(`${prefix}/prerequisiteSkillIds 引用了本包不存在的能力 ${prerequisite}`);
      for (const skill of lesson?.taughtSkillIds || []) {
        if (!prerequisites.has(skill)) prerequisites.set(skill, new Set());
        prerequisites.get(skill).add(prerequisite);
      }
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(skill) {
    if (visiting.has(skill)) { errors.push('/lessons 先修能力存在循环'); return; }
    if (visited.has(skill)) return;
    visiting.add(skill); for (const prerequisite of prerequisites.get(skill) || []) visit(prerequisite);
    visiting.delete(skill); visited.add(skill);
  }
  for (const skill of prerequisites.keys()) visit(skill);
  for (const [assetIndex, asset] of (Array.isArray(value.assets) ? value.assets : []).entries()) {
    const localFile = asset?.localFile;
    if (typeof localFile === 'string' && (localFile.startsWith('/') || localFile.includes('\\') || localFile.split('/').includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(localFile))) {
      errors.push(`/assets/${assetIndex}/localFile 只能填写本地文件名或相对路径`);
    }
  }
  const reviewRefs = new Set();
  const reviewCounts = new Map();
  for (const ref of value.reviewActivities || []) {
    const key = `${ref.lessonId}:${ref.skillId}:${ref.activityId}`;
    if (reviewRefs.has(key)) errors.push('/reviewActivities 存在重复的复习组合');
    reviewRefs.add(key);
    reviewCounts.set(ref.skillId, (reviewCounts.get(ref.skillId) || 0) + 1);
    if (!lessonIds.has(ref.lessonId)) errors.push(`/reviewActivities 引用了不存在的课程 ${ref.lessonId}`);
    if (!activityById.has(`${ref.lessonId}:${ref.activityId}`)) errors.push(`/reviewActivities 引用了不存在的活动 ${ref.activityId}`);
    if (!taught.has(ref.skillId)) errors.push(`/reviewActivities 引用了本包不存在的能力 ${ref.skillId}`);
    const activity = activityById.get(`${ref.lessonId}:${ref.activityId}`);
    if (activity && !['independent_output', 'transfer_test', 'listening_choice'].includes(activity.type)) errors.push(`/reviewActivities 活动 ${ref.activityId} 不是独立练习`);
    if (activity && !(activity.skillIds || []).includes(ref.skillId)) errors.push(`/reviewActivities 活动 ${ref.activityId} 未测量 ${ref.skillId}`);
  }
  for (const skill of taught) if ((reviewCounts.get(skill) || 0) < 2) errors.push(`/reviewActivities 能力 ${skill} 至少需要两个不同复习组合`);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
