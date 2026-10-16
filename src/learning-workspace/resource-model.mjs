const dimensions = ['audiences', 'schoolStages', 'grades', 'levels', 'goals', 'topics', 'exams'];
const scalarFacets = ['seriesId', 'publisherId', 'edition', 'volume'];
const kinds = new Set(['course', 'wordbook', 'textbook']);
const referenceTypes = new Set(['sentence-deck', 'story-package', 'vocabulary-pilot', 'vocabulary-book', 'protected-course']);
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function safeCover(value) {
  const url = text(value, 1000);
  if (!url || /[\\\u0000-\u001f]/.test(url) || url.split('/').includes('..')) return '';
  return /^(?:assets\/|\/assets\/)/.test(url) ? url : '';
}

export function normalizeResource(source = {}) {
  const facets = {};
  for (const key of dimensions) facets[key] = [...new Set((Array.isArray(source.facets?.[key]) ? source.facets[key] : [])
    .map(value => text(value, 60)).filter(Boolean))].slice(0, 20);
  for (const key of scalarFacets) facets[key] = text(source.facets?.[key], 100) || null;
  const sourceRefs = (Array.isArray(source.sourceRefs) ? source.sourceRefs : [])
    .filter(ref => referenceTypes.has(ref?.type) && text(ref.id)).map(ref => ({ type: ref.type, id: text(ref.id) }));
  const available = source.available !== false && sourceRefs.length > 0;
  const activities = available ? [...new Set(sourceRefs.map(ref => ref.type === 'vocabulary-pilot'||ref.type==='vocabulary-book' ? 'vocabulary' : 'chunks'))] : [];
  return {
    resourceId: text(source.resourceId), kind: kinds.has(source.kind) ? source.kind : 'course',
    title: text(source.title), description: text(source.description, 1000), coverUrl: safeCover(source.coverUrl),
    origin: ['builtin', 'imported', 'created'].includes(source.origin) ? source.origin : 'builtin',
    visibility: source.visibility === 'private' ? 'private' : 'public', sourceRefs, facets, activities,
    available, unavailableReason: available ? '' : text(source.unavailableReason) || '内容暂不可用',
    metadataRevision: Number.isSafeInteger(source.metadataRevision) ? source.metadataRevision : 0,
    courseId: text(source.courseId),
    accessLevel: source.accessLevel === 'member' ? 'member' : 'free',
    relatedCourseIds: [...new Set((Array.isArray(source.relatedCourseIds) ? source.relatedCourseIds : [])
      .map(value => text(value, 200)).filter(value => /^course:[a-zA-Z0-9:._-]{1,193}$/.test(value)))].slice(0, 20),
  };
}

export function resourcesFromCatalog(catalog) {
  return (catalog?.courses || []).map(course => normalizeResource({
    resourceId: 'course:' + course.id, courseId: course.id, title: course.title, description: course.description,
    coverUrl: course.coverImage, origin: course.origin === 'user' ? 'imported' : 'builtin',
    accessLevel: course.accessLevel,
    visibility: course.origin === 'user' ? 'private' : 'public', available: course.available,
    sourceRefs: (course.lessons || []).filter(lesson => lesson.available !== false).map(lesson => lesson.contentRef).filter(Boolean),
  }));
}

export function canonicalResourceId(id, aliases = {}) {
  if (!id.startsWith('course:')) return id;
  const courseId = id.slice(7);
  return 'course:' + (aliases[courseId] || courseId);
}

export function collectPersonalResources(resources, preferences, aliases = {}) {
  const byId = new Map(resources.map(resource => [resource.resourceId, resource]));
  return Object.values(preferences || {}).filter(row => row?.itemType === 'resource' && row.selected).map(row => {
    const id = canonicalResourceId(row.targetId, aliases);
    return { ...(byId.get(id) || normalizeResource({ resourceId: row.targetId, title: '暂不可用的内容', available: false })), savedTargetId: row.targetId };
  });
}
