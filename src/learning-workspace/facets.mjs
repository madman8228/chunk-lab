export const FACET_LABELS = Object.freeze({ audiences: '适用人群', schoolStages: '学段', grades: '年级', levels: '水平',
  goals: '学习目标', topics: '题材', exams: '考试', seriesId: '系列', publisherId: '出版社', textbookVersion: '教材版本', edition: '版次', volume: '册次' });

function values(resource, dimension) {
  const value = resource.facets?.[dimension];
  return Array.isArray(value) ? value : value ? [value] : [];
}

export const PRACTICAL_TOPICS = Object.freeze({daily:'日常口语',travel:'旅游英语',business:'商务职场',classics:'经典教材',stories:'电影与故事'});
export const WORDBOOK_CATEGORIES = Object.freeze({basic:'基础必备',zhongkao:'中考',gaokao:'高考',college:'大学英语',postgraduate:'考研',overseas:'出国商务'});
const wordbookTags = {basic:['基础必备'],zhongkao:['中考'],gaokao:['高考'],college:['大学英语','四级','六级','CET-4','CET-6'],postgraduate:['考研'],overseas:['出国商务','出国','商务英语','雅思','托福','IELTS','TOEFL']};
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
    if (selection.kind === 'wordbook' && Object.hasOwn(WORDBOOK_CATEGORIES, selection.wordbookCategory)) {
      const tags = ['topics','goals','exams','levels'].flatMap(key => values(resource, key));
      if (!wordbookTags[selection.wordbookCategory].some(tag => tags.includes(tag))) return false;
    }
    const newConcept = /新概念|new[\s_-]*concept|\bnce\b/i.test([resource.facets?.seriesId, resource.title].filter(Boolean).join(' '));
    const school = !newConcept && values(resource, 'schoolStages').some(stage => ['小学', '初中', '高中'].includes(stage)) &&
      (resource.kind === 'textbook' || !!resource.facets?.seriesId);
    if (selection.category === 'new-concept' && !newConcept) return false;
    if (selection.category === 'school' && !school) return false;
    if (selection.category === 'beginner' && !resource.curriculum) return false;
    if (selection.category === 'beginner' && selection.track && resource.curriculum?.track !== selection.track) return false;
    if (selection.category === 'beginner' && selection.stage && resource.curriculum?.stage !== selection.stage) return false;
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
  selection.category = ['practical', 'new-concept', 'school', 'beginner'].includes(params.get('category')) ? params.get('category') : '';
  selection.track = selection.category === 'beginner' && ['scenario', 'sentence-building', 'pronunciation', 'phonics'].includes(params.get('track')) ? params.get('track') : '';
  selection.stage = selection.category === 'beginner' && /^S[0-4]$/.test(params.get('stage') || '') ? params.get('stage') : '';
  selection.wordbookCategory = selection.kind === 'wordbook' && !selection.category && Object.hasOwn(WORDBOOK_CATEGORIES, params.get('wordbookCategory')) ? params.get('wordbookCategory') : '';
  selection.practicalTopic = selection.category === 'practical' && Object.hasOwn(PRACTICAL_TOPICS, params.get('practicalTopic')) ? params.get('practicalTopic') : '';
  if (!selection.category && selection.kind === 'textbook') { selection.kind = ''; selection.category = 'school'; }
  for (const key of Object.keys(FACET_LABELS)) selection[key] = params.getAll(key);
  if (selection.category === 'school' && !selection.schoolStages.length) selection.schoolStages = ['小学'];
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
    const key = resource.facets.seriesId ? JSON.stringify([resource.facets.seriesId, resource.facets.publisherId, resource.facets.textbookVersion, resource.facets.edition]) : resource.resourceId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(resource);
  }
  return [...groups.values()];
}
