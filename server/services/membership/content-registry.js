'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeRequestPath } = require('../../middleware/static-guard');
const { StaticContentStore } = require('./static-content-store');

const ID = /^[A-Za-z0-9:._-]{1,160}$/;
const MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/wav']);
const failure = (code, status = 503) => Object.assign(new Error(code), { code, status });
function freezeMetadata(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeMetadata); Object.freeze(value); }
  return value;
}
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

class ContentRegistry {
  constructor({ appRoot, protectedRoot, legacyCourses = () => [], requireManifest = () => false, publishedCourses = () => [], activeManifest = () => null }) {
    this.appRoot = path.resolve(appRoot);
    this.protectedRoot = path.resolve(protectedRoot);
    this.legacyCourses = legacyCourses;
    this.requireManifest = requireManifest;
    this.publishedCourses = publishedCourses;
    this.activeManifest = activeManifest;
    this.staticStore = new StaticContentStore({ root: this.protectedRoot });
    this.metadataCache = null;
    const rel = path.relative(this.appRoot, this.protectedRoot).replace(/\\/g, '/');
    if (inside(this.appRoot, this.protectedRoot) && !/^server\//i.test(rel)) throw failure('UNPROTECTED_STORAGE_ROOT');
  }
  file(relative) {
    if (typeof relative !== 'string' || !relative || /[\\%\u0000]/.test(relative) || path.isAbsolute(relative) ||
        relative.split('/').some(part => !part || part === '.' || part === '..')) throw failure('INVALID_CONTENT_PATH');
    const root = fs.realpathSync(this.protectedRoot);
    const publicRoot = fs.realpathSync(this.appRoot);
    const relativeRoot = path.relative(publicRoot, root).replace(/\\/g, '/');
    if (inside(publicRoot, root) && !/^server\//i.test(relativeRoot)) throw failure('UNPROTECTED_STORAGE_ROOT');
    const file = fs.realpathSync(path.join(root, relative));
    if (!inside(root, file) || !fs.statSync(file).isFile()) throw failure('INVALID_CONTENT_PATH');
    return file;
  }
  snapshot() {
    const manifestPath = path.join(this.protectedRoot, 'registry.json');
    const active=this.activeManifest();
    if (!active && !fs.existsSync(manifestPath)) {
      if (this.requireManifest()) throw failure('CONTENT_REGISTRY_UNAVAILABLE');
      return { version: 'empty', courses: [] };
    }
    const body = active ? active.body : fs.readFileSync(this.file('registry.json'), 'utf8');
    if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw failure('CONTENT_REGISTRY_INVALID');
    // Cache only immutable catalog metadata. Account rights are checked by the caller
    // on every operation, and the selected file is still resolved and hash checked.
    const root = fs.realpathSync(this.protectedRoot), publicRoot = fs.realpathSync(this.appRoot);
    if (inside(publicRoot, root) && !/^server\//i.test(path.relative(publicRoot, root).replace(/\\/g, '/'))) throw failure('UNPROTECTED_STORAGE_ROOT');
    const published = JSON.stringify(this.publishedCourses());
    if (Buffer.byteLength(published) > 2 * 1024 * 1024) throw failure('CONTENT_REGISTRY_INVALID');
    const cacheKey = crypto.createHash('sha256').update(JSON.stringify([root, publicRoot, !!active, body, published])).digest('hex');
    if (this.metadataCache?.key === cacheKey) return this.metadataCache.snapshot;
    const manifest = JSON.parse(body);
    const installed=new Set((manifest.courses||[]).map(course=>course.courseId));
    manifest.courses = Array.isArray(manifest.courses) ? manifest.courses.concat(JSON.parse(published).filter(course=>!active||!installed.has(course.courseId))) : manifest.courses;
    if (![1, 2].includes(manifest.schemaVersion) || !Array.isArray(manifest.courses)) throw failure('CONTENT_REGISTRY_INVALID');
    const seen = new Set();
    for (const course of manifest.courses) {
      if (!ID.test(course.courseId || '') || seen.has(course.courseId) || !['sentence', 'image-text'].includes(course.contentType) ||
          typeof course.title !== 'string' || !course.title.trim() || course.defaultAccess !== 'free' ||
          !Array.isArray(course.units) || !course.units.length || !Array.isArray(course.sourcePaths) ||
          !Array.isArray(course.legacyDeckIds)) throw failure('CONTENT_REGISTRY_INVALID');
      seen.add(course.courseId);
      const unitIds = new Set();
      for (const unit of course.units) {
        if (!ID.test(unit.unitId || '') || unitIds.has(unit.unitId) || !unit.contentRef ||
            !['sentence-deck', 'story-package'].includes(unit.contentRef.type) || !ID.test(unit.contentRef.id || '') ||
            !Array.isArray(unit.itemIds) || !unit.itemIds.length || unit.itemIds.some(id => !ID.test(id)) ||
            new Set(unit.itemIds).size !== unit.itemIds.length || !Array.isArray(unit.assets)) throw failure('CONTENT_REGISTRY_INVALID');
        unitIds.add(unit.unitId);
        if (unit.fragments) {
          if (!unit.recordIdentity || !ID.test(unit.recordIdentity.deckId || '') || typeof unit.recordIdentity.generationScope !== 'string' || !unit.recordIdentity.generationScope ||
              typeof unit.recordIdentity.resumeIdentity !== 'string' || !unit.recordIdentity.resumeIdentity ||
              !/^[a-f0-9]{64}$/.test(unit.contentVersion || '') || !Array.isArray(unit.fragments) || !unit.fragments.length) throw failure('CONTENT_REGISTRY_INVALID');
          let cursor = 0;
          const fragmentIds = new Set();
          for (const fragment of unit.fragments) {
            if (!/^f-[a-f0-9]{64}$/.test(fragment.fragmentId || '') || fragment.fragmentId !== 'f-' + fragment.sha256 || fragmentIds.has(fragment.fragmentId) ||
                fragment.cursor !== cursor || !Number.isSafeInteger(fragment.size) || fragment.size < 1 || fragment.size > 128 * 1024 ||
                !Array.isArray(fragment.itemIds) || !fragment.itemIds.length || fragment.itemIds.length > (course.contentType === 'sentence' ? 10 : 1) ||
                JSON.stringify(fragment.itemIds) !== JSON.stringify(unit.itemIds.slice(cursor, cursor + fragment.itemIds.length)) ||
                !Array.isArray(fragment.assetIds) || new Set(fragment.assetIds).size !== fragment.assetIds.length ||
                fragment.assetIds.some(id => !unit.assets.some(asset => asset.assetId === id))) throw failure('CONTENT_REGISTRY_INVALID');
            this.file(fragment.file); fragmentIds.add(fragment.fragmentId); cursor += fragment.itemIds.length;
          }
          if (cursor !== unit.itemIds.length) throw failure('CONTENT_REGISTRY_INVALID');
        } else {
          if (manifest.schemaVersion === 2) throw failure('CONTENT_REGISTRY_INVALID');
          this.file(unit.file);
        }
        const assetIds = new Set();
        for (const asset of unit.assets) {
          if (!ID.test(asset.assetId || '') || assetIds.has(asset.assetId) || !MIME.has(asset.mimeType)) throw failure('CONTENT_REGISTRY_INVALID');
          if (unit.fragments && (!/^[a-f0-9]{64}$/.test(asset.sha256 || '') || !Number.isSafeInteger(asset.size) || asset.size < 1)) throw failure('CONTENT_REGISTRY_INVALID');
          assetIds.add(asset.assetId);
          this.file(asset.file);
        }
      }
      for (const url of course.sourcePaths) {
        if (typeof url !== 'string' || !url.startsWith('/') || /[?#]/.test(url) ||
            normalizeRequestPath(url) !== url || url === '/') throw failure('CONTENT_REGISTRY_INVALID');
      }
      if (course.legacyDeckIds.some(id => !ID.test(id))) throw failure('CONTENT_REGISTRY_INVALID');
    }
    const snapshot = freezeMetadata({ version: crypto.createHash('sha256').update(body + JSON.stringify(manifest.courses)).digest('hex'), courses: manifest.courses });
    this.metadataCache = { key: cacheKey, snapshot };
    return snapshot;
  }
  list() {
    const snapshot = this.snapshot();
    const activatedIds=new Set(this.activeManifest()?snapshot.courses.filter(course=>course.units.every(unit=>unit.fragments&&unit.recordIdentity)).map(course=>course.courseId):[]);
    const protectedIds = new Set(snapshot.courses.map(course => course.courseId));
    const legacyCourses = this.legacyCourses();
    const legacyIds = new Set(legacyCourses.map(course => course.courseId));
    const legacy = legacyCourses.filter(course => !protectedIds.has(course.courseId))
      .map(course => ({ ...course, protectionReady: false }));
    return { version: snapshot.version, courses: snapshot.courses.map(course => ({
      ...course, protectionReady: !legacyIds.has(course.courseId)||activatedIds.has(course.courseId)
    })).concat(legacy) };
  }
  course(courseId) { return this.list().courses.find(course => course.courseId === courseId) || null; }
  publicCourses() {
    return this.snapshot().courses.map(course => ({
      courseId: course.courseId, title: course.title, contentType: course.contentType,
      units: course.units.map(unit => ({ unitId: unit.unitId, itemCount: unit.itemIds.length,
        ...(unit.fragments ? { contentVersion: unit.contentVersion, recordIdentity: unit.recordIdentity, itemIds: unit.itemIds } : {}) }))
    }));
  }
  references(course) {
    return (course.units || []).flatMap(unit => unit.itemIds.map(id => JSON.stringify([unit.contentRef.type, unit.contentRef.id, id])));
  }
  blockedPath(url) {
    const normalized = normalizeRequestPath(url);
    if (!normalized) return true;
    const base = normalized.replace(/(?:\.(?:br|gz))+$/i, '').toLowerCase();
    return this.snapshot().courses.some(course => course.sourcePaths.some(source => source.toLowerCase() === base || source.toLowerCase() === normalized.toLowerCase()));
  }
  blockedDeck(deckId) { return this.snapshot().courses.some(course => course.legacyDeckIds.includes(deckId)); }
  fragmentScope(courseId, unitId, position, purpose = 'practice') {
    // Formal assessments continue through their eligibility/operation boundary, never raw lesson grants.
    if (!['practice', 'review'].includes(purpose)) throw failure('ASSESSMENT_ENTRY_REQUIRED', 403);
    const course = this.snapshot().courses.find(course => course.courseId === courseId);
    if (!course) throw failure('COURSE_NOT_FOUND', 404);
    const unit = course.units.find(unit => unit.unitId === unitId);
    if (!unit) throw failure('UNIT_NOT_FOUND', 404);
    if (!unit.fragments) throw failure('CONTENT_PREPARATION_REQUIRED');
    const fragment = typeof position === 'object' && position
      ? unit.fragments.find(fragment => fragment.fragmentId === position.fragmentId)
      : Number.isSafeInteger(position) && position >= 0 && position < unit.itemIds.length
        ? unit.fragments.find(fragment => position >= fragment.cursor && position < fragment.cursor + fragment.itemIds.length) : null;
    if (!fragment) throw failure('INVALID_CURSOR', 400);
    return { courseId, unitId, contentVersion: unit.contentVersion, recordIdentity: unit.recordIdentity, fragments: [fragment], unit, course };
  }
  load(courseId, unitId, cursor = 0) {
    const course = this.snapshot().courses.find(entry => entry.courseId === courseId);
    if (!course) throw failure('COURSE_NOT_FOUND', 404);
    const unit = course.units.find(entry => entry.unitId === unitId);
    if (!unit) throw failure('UNIT_NOT_FOUND', 404);
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor >= unit.itemIds.length) throw failure('INVALID_CURSOR', 400);
    if (unit.fragments) {
      // snapshot already validated this unit; keep the read on that same snapshot.
      const fragment = unit.fragments.find(part => cursor >= part.cursor && cursor < part.cursor + part.itemIds.length);
      if (!fragment) throw failure('INVALID_CURSOR', 400);
      const payload = this.staticStore.read(fragment, { json: true });
      if (payload.courseId !== courseId || payload.unitId !== unitId || payload.cursor !== fragment.cursor ||
          JSON.stringify(payload.items.map(item => course.contentType === 'sentence' ? item.cid : item.id)) !== JSON.stringify(fragment.itemIds)) throw failure('CONTENT_INVALID');
      payload.items = payload.items.slice(cursor - fragment.cursor); payload.cursor = cursor;
      return { payload: { ...payload, contentVersion: unit.contentVersion, fragmentId: fragment.fragmentId }, unit, course };
    }
    const file = this.file(unit.file);
    if (fs.statSync(file).size > 20 * 1024 * 1024) throw failure('CONTENT_TOO_LARGE');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const source = course.contentType === 'sentence' ? doc.items : doc.utterances;
    if (!Array.isArray(source)) throw failure('CONTENT_INVALID');
    const map = new Map(source.map(item => [course.contentType === 'sentence' ? item.cid : item.id, item]));
    if (map.size !== source.length || unit.itemIds.some(id => !map.has(id))) throw failure('CONTENT_INVALID');
    const selected = unit.itemIds.slice(cursor, cursor + (course.contentType === 'sentence' ? 10 : 1));
    const fields = course.contentType === 'sentence'
      ? ['cid', 'sentence', 'translation', 'chunks', 'hints', 'distractors', 'explain', 'grammar', 'explanations', 'cefr']
      : ['id', 'text', 'roleId', 'imageAssetId', 'audioAssetId', 'acceptedAnswers', 'chunks'];
    const items = selected.map(id => Object.fromEntries(fields.filter(field => map.get(id)[field] !== undefined)
      .map(field => [field, structuredClone(map.get(id)[field])])));
    if (items.some(item => {
      const en = course.contentType === 'sentence' ? item.sentence : typeof item.text === 'string' ? item.text : item.text?.en;
      return typeof en !== 'string' || !en.trim();
    })) throw failure('CONTENT_INVALID');
    const assetIds = [...new Set(items.flatMap(item => [item.imageAssetId, item.audioAssetId].filter(Boolean)))];
    if (assetIds.some(id => !unit.assets.some(asset => asset.assetId === id))) throw failure('ASSET_REFERENCE_INVALID');
    // Only the selected learning items leave the server, never the complete package or index.
    const payload = { courseId, unitId, contentType: course.contentType, cursor, items,
      ...(doc.learning ? { learning: structuredClone(doc.learning) } : {}),
      nextCursor: cursor + selected.length < unit.itemIds.length ? cursor + selected.length : null, assetIds };
    return { payload, unit, course };
  }
  asset(courseId, unitId, assetId) {
    const course = this.snapshot().courses.find(entry => entry.courseId === courseId);
    const unit = course && course.units.find(entry => entry.unitId === unitId);
    const asset = unit && unit.assets.find(entry => entry.assetId === assetId);
    if (!asset) throw failure('ASSET_NOT_FOUND', 404);
    return { file: this.file(asset.file), mimeType: asset.mimeType };
  }
}
module.exports = { ContentRegistry, inside };
