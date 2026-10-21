'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Catalog = require('../../js/course-catalog');
const Model = require('../../js/learning-workspace.cjs');
const allowedFields = new Set(['resourceId', 'kind', 'title', 'description', 'coverUrl', 'sourceRefs', 'facets', 'relatedCourseIds']);
const refKey = ref => JSON.stringify({ type: ref.type, id: ref.id });

function createLibraryCatalog({ db, appRoot, vocabularyContent }) {
  let platformResources = () => [];
  function baseResources() {
    const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'content/manifest.json'), 'utf8'));
    return Model.resourcesFromCatalog(Catalog.buildCatalog({ manifest })).filter(resource => resource.visibility === 'public')
      .concat((vocabularyContent?vocabularyContent.resources():[]).map(Model.normalizeResource));
  }
  function latest(id) {
    return db.prepare('SELECT * FROM library_resource_revisions WHERE resource_id=? ORDER BY revision DESC LIMIT 1').get(id);
  }
  function published() {
    return db.prepare("SELECT a.* FROM library_resource_revisions a WHERE a.status='published' AND a.revision=(SELECT MAX(b.revision) FROM library_resource_revisions b WHERE b.resource_id=a.resource_id AND b.status='published')").all();
  }
  function legacyResources() {
    const base = baseResources();
    const map = new Map(base.map(resource => [resource.resourceId, resource]));
    const allowed = new Set(base.flatMap(resource => resource.sourceRefs.map(ref => JSON.stringify(ref))));
    for (const row of published()) {
      const metadata = JSON.parse(row.metadata_json);
      const available = metadata.sourceRefs.every(ref => allowed.has(refKey(ref)) || ref.type === 'vocabulary-pilot' && ref.id === 'six-words');
      const prior = map.get(row.resource_id);
      map.set(row.resource_id, Model.normalizeResource({ ...metadata, courseId: prior?.courseId,
        metadataRevision: row.revision, available }));
    }
    return [...map.values()];
  }
  function resources() { return legacyResources().concat(platformResources()); }
  function setPlatformResources(provider) { platformResources = provider; }
  function validate(id, metadata) {
    const errors = [];
    if (typeof id !== 'string' || !/^[a-zA-Z0-9:._-]{1,200}$/.test(id)) errors.push('内容编号无效');
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ['目录信息无效'];
    if (Object.keys(metadata).some(key => !allowedFields.has(key))) errors.push('包含不支持的目录字段');
    if (metadata.resourceId !== id || !['course', 'wordbook', 'textbook'].includes(metadata.kind)) errors.push('内容类型或编号不匹配');
    if (metadata.relatedCourseIds !== undefined && (!Array.isArray(metadata.relatedCourseIds) || metadata.relatedCourseIds.length > 20 ||
      metadata.relatedCourseIds.some(courseId => typeof courseId !== 'string' || !/^course:[a-zA-Z0-9:._-]{1,193}$/.test(courseId)) ||
      new Set(metadata.relatedCourseIds).size !== metadata.relatedCourseIds.length)) errors.push('关联课程编号无效');
    if (typeof metadata.title !== 'string' || !metadata.title.trim() || metadata.title.length > 200) errors.push('请填写有效标题');
    if (metadata.description != null && (typeof metadata.description !== 'string' || metadata.description.length > 1000)) errors.push('简介过长');
    if (metadata.coverUrl && (Model.safeCover(metadata.coverUrl) !== metadata.coverUrl ||
      !fs.existsSync(path.join(appRoot, metadata.coverUrl.replace(/^\//, ''))))) errors.push('封面只能引用安全的现有资源');
    const base = baseResources();
    const allowed = new Set(base.flatMap(resource => resource.sourceRefs.map(ref => JSON.stringify(ref))));
    if (!Array.isArray(metadata.sourceRefs) || !metadata.sourceRefs.length || metadata.sourceRefs.length > 10000) errors.push('请选择公开内容引用');
    else for (const ref of metadata.sourceRefs) {
      if (!ref || Object.keys(ref).some(key => !['type', 'id'].includes(key)) ||
        !(allowed.has(JSON.stringify({ type: ref.type, id: ref.id })) || ref.type === 'vocabulary-pilot' && ref.id === 'six-words')) {
        errors.push('内容引用不是已公开的素材'); break;
      }
    }
    if(Array.isArray(metadata.sourceRefs)&&metadata.sourceRefs.some(ref=>ref?.type==='vocabulary-book')&&
      (metadata.kind!=='wordbook'||metadata.sourceRefs.length!==1))errors.push('单词本需引用单个公开单词本索引');
    if (Buffer.byteLength(JSON.stringify(metadata), 'utf8') > 100000) errors.push('目录信息超过大小限制');
    const facets = metadata.facets || {};
    if (typeof facets !== 'object' || Array.isArray(facets) || Object.keys(facets).some(key => !Object.hasOwn(Model.FACET_LABELS, key))) errors.push('分类字段无效');
    for (const [key, value] of Object.entries(facets)) {
      if (['seriesId', 'publisherId', 'edition', 'volume'].includes(key)) {
        if (value != null && (typeof value !== 'string' || value.length > 100 || /[<>\u0000-\u001f]/.test(value))) errors.push('版本信息无效');
      } else if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 60 || /[<>\u0000-\u001f]/.test(item))) errors.push('分类值无效');
    }
    return errors;
  }
  function read(id) {
    const row = latest(id);
    return { revision: row?.revision || 0, status: row?.status || 'new', resource: row ? JSON.parse(row.metadata_json) : resources().find(resource => resource.resourceId === id) || null };
  }
  const saveDraft = db.transaction((id, baseRevision, metadata) => {
    const current = latest(id);
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) return { status: 400, error: '草稿版本无效' };
    if ((current?.revision || 0) !== baseRevision) return { status: 409, error: '目录已被修改，请刷新后合并', currentRevision: current.revision };
    const errors = validate(id, metadata);
    if (errors.length) return { status: 422, error: errors.join('；') };
    const revision = baseRevision + 1;
    db.prepare("INSERT INTO library_resource_revisions(resource_id,revision,status,metadata_json) VALUES(?,?,'draft',?)").run(id, revision, JSON.stringify(metadata));
    return { status: 200, revision };
  });
  const publish = db.transaction((id, revision) => {
    const row = latest(id);
    if (!row || row.revision !== revision || row.status !== 'draft') return { status: 409, error: '草稿版本已变化，请重新读取' };
    const errors = validate(id, JSON.parse(row.metadata_json));
    if (errors.length) return { status: 422, error: errors.join('；') };
    db.prepare("INSERT INTO library_resource_revisions(resource_id,revision,status,metadata_json) VALUES(?,?,'published',?)").run(id, revision + 1, row.metadata_json);
    return { status: 200, revision: revision + 1 };
  });
  function version(list) { return crypto.createHash('sha256').update(JSON.stringify(list)).digest('hex'); }
  function ownsPersonal(userId,id){return !!vocabularyContent?.personal?.resources(userId).some(row=>row.resourceId===id);}
  return { resources, legacyResources, setPlatformResources, read, saveDraft, publish, version, ownsPersonal };
}
module.exports = { createLibraryCatalog };
