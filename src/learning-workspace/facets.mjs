export const FACET_LABELS = Object.freeze({ audiences: '适用人群', schoolStages: '学段', grades: '年级', levels: '水平',
  goals: '学习目标', topics: '题材', exams: '考试', seriesId: '系列', publisherId: '版本', edition: '版次', volume: '册次' });

function values(resource, dimension) {
  const value = resource.facets?.[dimension];
  return Array.isArray(value) ? value : value ? [value] : [];
}

export const PRACTICAL_TOPICS = Object.freeze({daily:'日常口语',travel:'旅游英语',business:'商务职场',classics:'经典教材',stories:'电影与故事'});
const practicalPatterns = {daily:/日常|口语|高频短语/,travel:/旅游|旅行|出国|travel/i,business:/商务|职场|business/i,classics:/经典教材/,stories:/电影|故事|影视|movie|story/i};

function matchesPracticalTopic(resource, topic) {
  const tags = values(resource, 'topics');
  const tagged = Object.keys(PRACTICAL_TOPICS).filter(key => tags.includes(PRACTICAL_TOPICS[key]));
  if (tagged.length) return tagged.includes(topic);
  const title = [resource.title, resource.facets?.seriesId].filter(Boolean).join(' ');
  return practicalPatterns[topic].test(title) || topic === 'stories' && (resource.sourceRefs || []).some(ref => ref.type === 'story-package');
}

export function filterResources(resources, selection = {}, omitDimension = '') {
  const query = String(selection.query || '').trim().toLocaleLowerCase();
  return resources.filter(resource => {
    if (selection.kind && resource.kind !== selection.kind) return false;
    const newConcept = /新概念|new[\s_-]*concept|\bnce\b/i.test([resource.facets?.seriesId, resource.title].filter(Boolean).join(' '));
    const school = !newConcept && values(resource, 'schoolStages').some(stage => ['小学', '初中', '高中'].includes(stage)) &&
      (resource.kind === 'textbook' || !!resource.facets?.seriesId);
    if (selection.category === 'new-concept' && !newConcept) return false;
    if (selection.category === 'school' && !school) return false;
    if (selection.category === 'practical' && (resource.kind !== 'course' || newConcept || school)) return false;
    if (selection.category === 'practical' && Object.hasOwn(PRACTICAL_TOPICS, selection.practicalTopic) && !matchesPracticalTopic(resource, selection.practicalTopic)) return false;
    if (query && ![resource.title, resource.description, ...Object.values(resource.facets || {}).flat()]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query)) return false;
    return Object.keys(FACET_LABELS).every(dimension => {
      if (dimension === omitDimension) return true;
      const wanted = selection[dimension];
      return !wanted?.length || wanted.some(value => values(resource, dimension).includes(value));
    });
  });
}

export function facetOptions(resources, selection = {}) {
  return Object.fromEntries(Object.keys(FACET_LABELS).map(dimension => {
    const counts = new Map();
    for (const resource of filterResources(resources, selection, dimension)) {
      for (const value of values(resource, dimension)) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [dimension, [...counts].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')).map(([value, count]) => ({ value, count }))];
  }));
}

export function selectionFromUrl(search) {
  const params = new URLSearchParams(search);
  const selection = { kind: ['course', 'wordbook', 'textbook'].includes(params.get('kind')) ? params.get('kind') : '', query: params.get('q') || '' };
  selection.category = ['practical', 'new-concept', 'school'].includes(params.get('category')) ? params.get('category') : '';
  selection.practicalTopic = selection.category === 'practical' && Object.hasOwn(PRACTICAL_TOPICS, params.get('practicalTopic')) ? params.get('practicalTopic') : '';
  if (!selection.category && selection.kind === 'textbook') { selection.kind = ''; selection.category = 'school'; }
  for (const key of Object.keys(FACET_LABELS)) selection[key] = params.getAll(key);
  return selection;
}

export function resourceKindCounts(resources, selection = {}) {
  const counts = { all: 0, course: 0, wordbook: 0, textbook: 0 };
  const seen = new Set();
  for (const resource of filterResources(resources, { ...selection, kind: '' })) {
    if (seen.has(resource.resourceId)) continue;
    seen.add(resource.resourceId);
    counts.all++;
    if (Object.hasOwn(counts, resource.kind)) counts[resource.kind]++;
  }
  return counts;
}

export function groupTextbooks(resources) {
  const groups = new Map();
  for (const resource of resources) {
    const key = resource.facets.seriesId ? JSON.stringify([resource.facets.seriesId, resource.facets.publisherId, resource.facets.edition]) : resource.resourceId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(resource);
  }
  return [...groups.values()];
}
