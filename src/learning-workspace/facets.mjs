export const FACET_LABELS = Object.freeze({ audiences: '适用人群', schoolStages: '学段', grades: '年级', levels: '水平',
  goals: '学习目标', topics: '题材', exams: '考试', seriesId: '系列', publisherId: '版本', edition: '版次', volume: '册次' });

function values(resource, dimension) {
  const value = resource.facets?.[dimension];
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function filterResources(resources, selection = {}, omitDimension = '') {
  const query = String(selection.query || '').trim().toLocaleLowerCase();
  return resources.filter(resource => {
    if (selection.kind && resource.kind !== selection.kind) return false;
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
