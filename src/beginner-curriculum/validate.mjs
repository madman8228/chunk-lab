import map from './knowledge-map.json' with { type: 'json' };

const stageIndex = new Map(map.stages.map((stage, index) => [stage, index]));
const allowedTracks = new Set(map.tracks);

export function validateKnowledgeMap(value = map) {
  const errors = [];
  if (!value || value.version !== '1.0' || !Array.isArray(value.items) || !Array.isArray(value.stages) || !Array.isArray(value.tracks)) {
    return { valid: false, errors: ['知识目录头部或版本无效'] };
  }
  const items = new Map();
  for (const [index, item] of value.items.entries()) {
    const prefix = `/items/${index}`;
    if (!item || typeof item.knowledgeId !== 'string' || !item.knowledgeId.trim()) { errors.push(`${prefix}/knowledgeId 缺失`); continue; }
    if (items.has(item.knowledgeId)) errors.push(`${prefix}/knowledgeId 重复：${item.knowledgeId}`);
    items.set(item.knowledgeId, item);
    if (!stageIndex.has(item.stage)) errors.push(`${prefix}/stage 无效`);
    if (!['sound', 'decoding', 'vocabulary', 'structure', 'function', 'literacy'].includes(item.domain)) errors.push(`${prefix}/domain 无效`);
    if (!item.goalZh || !item.demonstration || !item.independentCheck) errors.push(`${prefix} 缺少目标、示范或独立检查`);
    if (!['planned', 'draft', 'reviewed'].includes(item.status)) errors.push(`${prefix}/status 无效`);
    if (!Array.isArray(item.prerequisiteIds) || !Array.isArray(item.recommendedTracks) || item.recommendedTracks.some(track => !allowedTracks.has(track))) errors.push(`${prefix} 前置或路线格式无效`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    const item = items.get(id);
    if (!item) return;
    if (visiting.has(id)) { errors.push(`知识前置存在循环：${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisiteId of item.prerequisiteIds) {
      const prerequisite = items.get(prerequisiteId);
      if (!prerequisite) errors.push(`${id} 引用不存在的前置 ${prerequisiteId}`);
      else {
        if (stageIndex.has(item.stage) && stageIndex.has(prerequisite.stage) && stageIndex.get(prerequisite.stage) > stageIndex.get(item.stage)) errors.push(`${id} 的前置 ${prerequisiteId} 位于更晚阶段`);
        visit(prerequisiteId);
      }
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of items.keys()) visit(id);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateLegacyMap(value, knowledgeIds = new Set(map.items.map(item => item.knowledgeId))) {
  const errors = [], courseIds = new Set();
  if (!value || value.version !== '1.0' || !Array.isArray(value.courses)) return { valid: false, errors: ['旧课程映射版本或courses无效'] };
  for (const [index, course] of value.courses.entries()) {
    if (courseIds.has(course.courseId)) errors.push(`/courses/${index}/courseId 重复`);
    courseIds.add(course.courseId);
    if (!allowedTracks.has(course.track) || !stageIndex.has(course.stage) || !Array.isArray(course.knowledgeIds)) errors.push(`/courses/${index} 路线、阶段或知识引用无效`);
    for (const id of course.knowledgeIds || []) if (!knowledgeIds.has(id)) errors.push(`/courses/${index} 引用不存在的知识 ${id}`);
    if (!['candidate', 'reviewed'].includes(course.mappingStatus)) errors.push(`/courses/${index}/mappingStatus无效`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export { map as KNOWLEDGE_MAP };
