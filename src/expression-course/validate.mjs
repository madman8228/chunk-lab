import Ajv2020 from 'ajv/dist/2020.js';
import packageSchema from './expression-package.schema.json' with { type: 'json' };
import lessonSchema from './lesson.schema.json' with { type: 'json' };
import { createExpressionV11Schemas } from './schema-v1.1.mjs';
import { validateKnowledgeMap } from '../beginner-curriculum/validate.mjs';
import knowledgeMap from '../beginner-curriculum/knowledge-map.json' with { type: 'json' };

const validatePackageShape = new Ajv2020({ allErrors: true, strict: false }).compile(packageSchema);
const validateLessonShape = new Ajv2020({ allErrors: true, strict: false }).compile(lessonSchema);
const v11 = createExpressionV11Schemas();
const validatePackageV11Shape = new Ajv2020({ allErrors: true, strict: false }).compile(v11.packageSchema);
const validateLessonV11Shape = new Ajv2020({ allErrors: true, strict: false }).compile(v11.lessonSchema);
const types = new Set(['meaning_intro', 'micro_explanation', 'sentence_build', 'substitution', 'listening_choice', 'independent_output', 'transfer_test', 'sound_demo', 'grapheme_build', 'speaking_practice']);
const reviewTypes = new Set(['independent_output', 'transfer_test', 'listening_choice', 'grapheme_build']);
const trackTypes = Object.freeze({ pronunciation: new Set(['sound_demo', 'listening_choice', 'meaning_intro', 'micro_explanation', 'independent_output', 'transfer_test']),
  phonics: new Set(['sound_demo', 'grapheme_build', 'listening_choice', 'meaning_intro', 'micro_explanation', 'independent_output', 'transfer_test']),
  'sentence-building': new Set(['meaning_intro', 'micro_explanation', 'sentence_build', 'substitution', 'listening_choice', 'independent_output', 'transfer_test', 'speaking_practice']),
  scenario: new Set(['meaning_intro', 'micro_explanation', 'sentence_build', 'substitution', 'listening_choice', 'independent_output', 'transfer_test', 'speaking_practice']) });

export function validateExpressionPackage(value, { forPublish = false, availableAssets = [], curriculumMap = knowledgeMap } = {}) {
  const errors = [];
  const isV11 = value?.formatVersion === '1.1';
  const packageValidator = isV11 ? validatePackageV11Shape : validatePackageShape;
  if (!packageValidator(value)) errors.push(...(packageValidator.errors || []).map(error => `${error.instancePath || '/'} ${error.message}`));
  if (!value || typeof value !== 'object' || !Array.isArray(value.lessons)) return { valid: false, errors };
  if (!['1.0', '1.1'].includes(value.formatVersion)) errors.push('/formatVersion 不支持');
  if (!isV11 && Array.isArray(value.lessons) && value.lessons.some(lesson => lesson?.schemaVersion === '1.1')) errors.push('/lessons 课程包与课节协议版本必须一致');
  if (isV11 && !validateKnowledgeMap(curriculumMap).valid) errors.push('/curriculum 知识目录无效');
  const knowledgeIds = new Set(curriculumMap.items.map(item => item.knowledgeId));
  const lessonsInPackage = value.lessons;
  if (isV11 && lessonsInPackage.some(lesson => lesson?.schemaVersion !== '1.1')) errors.push('/lessons 课程包与课节协议版本必须一致');
  const assetIds = new Set((Array.isArray(value.assets) ? value.assets : []).map(asset => asset?.assetId));
  if (assetIds.size !== (Array.isArray(value.assets) ? value.assets.length : 0)) errors.push('/assets 包含重复 assetId');
  const available = new Set(availableAssets);
  const lessonIds = new Set();
  const activityById = new Map();
  const prerequisites = new Map();
  const taught = new Set(value.lessons.flatMap(lesson => Array.isArray(lesson?.taughtSkillIds) ? lesson.taughtSkillIds : []));
  const taughtKnowledge = new Set(value.lessons.flatMap(lesson => Array.isArray(lesson?.knowledgeIds) ? lesson.knowledgeIds : []));
  for (const [lessonIndex, lesson] of value.lessons.entries()) {
    const prefix = `/lessons/${lessonIndex}`;
    const lessonValidator = isV11 ? validateLessonV11Shape : validateLessonShape;
    if (!lessonValidator(lesson)) errors.push(...(lessonValidator.errors || []).map(error => `${prefix}${error.instancePath || '/'} ${error.message}`));
    if (isV11) {
      const mapResult = validateKnowledgeMap(curriculumMap);
      if (!mapResult.valid) errors.push(...mapResult.errors.map(message => `/curriculum ${message}`));
      const objectives = Array.isArray(lesson?.knowledgeIds) ? lesson.knowledgeIds : [];
      const recommended = Array.isArray(lesson?.recommendedKnowledgeIds) ? lesson.recommendedKnowledgeIds : [];
      if (!objectives.length) errors.push(`${prefix}/knowledgeIds 至少引用一个目标`);
      for (const id of [...objectives, ...recommended]) if (!knowledgeIds.has(id)) errors.push(`${prefix} 引用了知识目录中不存在的项目 ${id}`);
      if (objectives.some(id => recommended.includes(id))) errors.push(`${prefix} 目标知识不能同时标作推荐前置`);
      const mapItems = new Map(curriculumMap.items.map(item => [item.knowledgeId, item]));
      for (const id of objectives) if (mapItems.has(id)) {
        if (mapItems.get(id).stage !== value.curriculum?.stage) errors.push(`${prefix}/knowledgeIds ${id} 与课程阶段不一致`);
        if (!mapItems.get(id).recommendedTracks.includes(value.curriculum?.track)) errors.push(`${prefix}/knowledgeIds ${id} 未规划用于${value.curriculum?.track || '该路线'}`);
      }
      if (!Array.isArray(lesson?.activities) || lesson.activities.length < 4) errors.push(`${prefix}/activities 至少需要4项`);
      const activityTypes = new Set((lesson?.activities || []).map(item => item?.type));
      if (!activityTypes.has('meaning_intro') && !activityTypes.has('micro_explanation')) errors.push(`${prefix}/activities 缺少意思或规则示范`);
      if (!['independent_output', 'transfer_test', 'listening_choice', 'grapheme_build'].some(type => activityTypes.has(type))) errors.push(`${prefix}/activities 缺少可独立检查的练习`);
      if (lesson?.taughtSkillIds?.length && lesson.taughtSkillIds.some(skill => (lesson.reviewPlan?.intervalDays || []).length < 2)) errors.push(`${prefix}/reviewPlan 间隔无效`);
    }
    if (lesson && typeof lesson.lessonId === 'string') {
      if (lessonIds.has(lesson.lessonId)) errors.push(`${prefix}/lessonId 重复`);
      lessonIds.add(lesson.lessonId);
    }
    const localIds = new Set();
    for (const [activityIndex, activity] of (Array.isArray(lesson?.activities) ? lesson.activities : []).entries()) {
      const activityPath = `${prefix}/activities/${activityIndex}`;
      if (!types.has(activity?.type)) errors.push(`${activityPath}/type 活动类型不支持`);
      if (isV11 && !trackTypes[value.curriculum?.track]?.has(activity?.type)) errors.push(`${activityPath}/type 不适用于${value.curriculum?.track || '未知'}路线`);
      if (localIds.has(activity?.id)) errors.push(`${activityPath}/id 重复`);
      localIds.add(activity?.id);
      activityById.set(`${lesson?.lessonId}:${activity?.id}`, activity);
      const payload = activity?.payload || {};
      const referencedAudioIds = activity?.type === 'sound_demo' ? (payload.segments || []).map(segment => segment.audioAssetId)
        : ['listening_choice', 'grapheme_build', 'speaking_practice'].includes(activity?.type) ? [payload.audioAssetId] : [];
      for (const audioAssetId of referencedAudioIds) {
        const audio = (Array.isArray(lesson?.audioAssets) ? lesson.audioAssets : []).find(item => item.assetId === audioAssetId);
        if (!audio) errors.push(`${activityPath} 音频 ${audioAssetId || ''} 未在本课清单中声明`);
        if (forPublish && audio?.status !== 'ready') errors.push(`${activityPath} 音频 ${audioAssetId || ''} 尚未标记为已准备`);
      }
      if (activity?.type === 'transfer_test' && Array.isArray(activity.evaluation?.acceptedAnswers)) {
        const accepted = activity.evaluation.acceptedAnswers.map(answer => String(answer).normalize('NFKC').toLocaleLowerCase('en-US').replace(/[.!?。！？]+$/g, '').trim());
        const shownText = (Array.isArray(lesson.activities) ? lesson.activities : []).slice(0, activityIndex).flatMap(item => Object.values(item?.payload || {}).filter(value => typeof value === 'string'))
          .map(text => text.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[.!?。！？]+$/g, '').trim());
        if (accepted.some(answer => answer.length >= 6 && shownText.some(text => text === answer || text.includes(answer)))) {
          errors.push(`${activityPath} 迁移题答案可能已在前序活动中出现`);
        }
      }
      if (isV11 && activity?.type === 'grapheme_build') {
        const availableTokens = payload.availableTokens || [], correctTokens = payload.correctTokens || [];
        const remaining = new Map();
        for (const token of availableTokens) remaining.set(token, (remaining.get(token) || 0) + 1);
        for (const token of correctTokens) { const count = remaining.get(token) || 0; if (!count) errors.push(`${activityPath}/payload/correctTokens 包含未提供或重复取用的字母块 ${token}`); else remaining.set(token, count - 1); }
        if (activity.stage === 'guided' && activity.evaluation?.countsTowardMastery !== false) errors.push(`${activityPath} 引导拼读不能计为掌握`);
      }
      if (isV11 && activity?.type === 'sound_demo' && (activity.stage !== 'guided' || activity.evaluation?.countsTowardMastery !== false)) errors.push(`${activityPath} 音素示范必须是引导练习，不计掌握`);
      if (isV11 && activity?.type === 'speaking_practice' && activity.evaluation?.countsTowardMastery !== false) errors.push(`${activityPath} 自主跟读不能计为掌握`);
      if (['listening_choice', 'grapheme_build', 'speaking_practice', 'sound_demo'].includes(activity?.type)) {
        for (const audioAssetId of referencedAudioIds) if (!assetIds.has(audioAssetId) || forPublish && !available.has(audioAssetId)) errors.push(`${activityPath} 音频资源 ${audioAssetId || ''} 缺失`);
      }
      if (activity?.type === 'listening_choice' && !(Array.isArray(payload.options) ? payload.options : []).some(option => option.id === activity.evaluation?.correctOptionId)) {
        errors.push(`${activityPath}/evaluation/correctOptionId 正确选项不存在`);
      }
      if (isV11 && activity?.type === 'listening_choice' && activity.evaluation?.countsTowardMastery === true && activity.stage !== 'independent' && activity.stage !== 'retention') errors.push(`${activityPath} 引导听辨不能产生独立掌握证据`);
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
    if (activity && !reviewTypes.has(activity.type)) errors.push(`/reviewActivities 活动 ${ref.activityId} 不是独立练习`);
    if (activity && isV11 && !['independent', 'retention'].includes(activity.stage)) errors.push(`/reviewActivities 活动 ${ref.activityId} 不是独立检查`);
    if (activity && !(activity.skillIds || []).includes(ref.skillId)) errors.push(`/reviewActivities 活动 ${ref.activityId} 未测量 ${ref.skillId}`);
  }
  for (const id of taughtKnowledge) {
    const item = curriculumMap.items.find(candidate => candidate.knowledgeId === id);
    if (!item) errors.push(`/lessons/knowledgeIds 引用了知识目录中不存在的项目 ${id}`);
  }
  for (const skill of taught) if ((reviewCounts.get(skill) || 0) < 2) errors.push(`/reviewActivities 能力 ${skill} 至少需要两个不同复习组合`);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
