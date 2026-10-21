'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { StaticFragmentBuilder } = require('./static-fragment-builder');
const { deckIdentity } = require('./assessment-content');
const { inside } = require('./content-registry');
const { isSensitivePath } = require('../../middleware/static-guard');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = code => Object.assign(new Error(code), { code, status: 422 });

// Explicit, additive preparation only. This never installs a registry or changes a policy/learning row.
function prepareStaticCourseRegistry({ registry, output }) {
  const requested = path.resolve(output);
  if (fs.existsSync(requested)) throw fail('OUTPUT_ALREADY_EXISTS');
  const target = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
  const appRoot = fs.realpathSync(registry.appRoot);
  if (inside(appRoot, target) && !isSensitivePath('/' + path.relative(appRoot, target).replace(/\\/g, '/'))) throw fail('PUBLIC_OUTPUT_FORBIDDEN');
  const source = registry.snapshot(), sources = [], files = new Map();
  fs.mkdirSync(target);
  function put(name, bytes) {
    if (files.has(name)) {
      if (files.get(name).sha256 !== hash(bytes)) throw fail('OUTPUT_FILE_CONFLICT');
      return name;
    }
    fs.writeFileSync(path.join(target, name), bytes, { flag: 'wx' });
    files.set(name, { file: name, sha256: hash(bytes), size: bytes.length }); return name;
  }
  function read(relative) {
    const file = registry.file(relative);
    if (fs.statSync(file).size > 20 * 1024 * 1024) throw fail('CONTENT_TOO_LARGE');
    const bytes = fs.readFileSync(file); sources.push({ file: relative, sha256: hash(bytes), size: bytes.length }); return bytes;
  }
  const courses = source.courses.map(course => ({ ...structuredClone(course), units: course.units.map(unit => {
    let content;
    let originalFile;
    if (unit.file) {
      const bytes = read(unit.file); originalFile = put('original-' + hash(bytes) + '.json', bytes); content = JSON.parse(bytes.toString('utf8'));
    } else {
      const items = unit.fragments.flatMap(fragment => JSON.parse(read(fragment.file).toString('utf8')).items);
      const first = JSON.parse(read(unit.fragments[0].file).toString('utf8'));
      content = { ...first.context, [course.contentType === 'sentence' ? 'items' : 'utterances']: items, ...(first.learning ? { learning: first.learning } : {}) };
    }
    const key = course.contentType === 'sentence' ? 'items' : 'utterances', idKey = course.contentType === 'sentence' ? 'cid' : 'id';
    if (!Array.isArray(content[key])) throw fail('CONTENT_INVALID');
    const map = new Map(content[key].map(item => [item[idKey], item]));
    if (map.size !== content[key].length || unit.itemIds.some(id => !map.has(id))) throw fail('CONTENT_ID_MISMATCH');
    const selected = { ...content, [key]: unit.itemIds.map(id => map.get(id)) };
    const identity = unit.recordIdentity || (unit.legacyLearningIdentity ? { ...unit.legacyLearningIdentity, resumeIdentity: unit.legacyLearningIdentity.deckId } :
      { deckId: deckIdentity(course.courseId, unit.unitId), generationScope: 'course:' + course.courseId, resumeIdentity: deckIdentity(course.courseId, unit.unitId) });
    const assets = unit.assets.map(asset => {
      const bytes = read(asset.file), sha256 = hash(bytes), extension = path.extname(asset.file);
      return { ...asset, file: put('asset-' + sha256 + extension, bytes), sha256, size: bytes.length };
    });
    const built = new StaticFragmentBuilder().build({ courseId: course.courseId, unitId: unit.unitId, contentType: course.contentType, content: selected, itemIds: unit.itemIds, assets, recordIdentity: identity });
    for (const file of built.files) put(file.name, file.bytes);
    return { ...unit, file: originalFile, assets, fragments: built.fragments, contentVersion: built.contentVersion, recordIdentity: identity };
  }) }));
  // Verify both sides before calling the artifact usable. Preserve partial private output on failure.
  if (registry.snapshot().version !== source.version || sources.some(source => hash(fs.readFileSync(registry.file(source.file))) !== source.sha256)) throw fail('SOURCE_CHANGED_DURING_PREPARATION');
  for (const file of files.values()) if (hash(fs.readFileSync(path.join(target, file.file))) !== file.sha256) throw fail('OUTPUT_VERIFICATION_FAILED');
  const candidate = { schemaVersion: 2, activationReady: false, sourceRegistryVersion: source.version, courses };
  put('candidate.json', Buffer.from(JSON.stringify(candidate, null, 2)));
  const report = { schemaVersion: 2, kind: 'private-static-registry-preparation', activationReady: false, sourceRegistryVersion: source.version,
    sources, files: [...files.values()], reviewRequired: ['verify-public-source-coverage', 'verify-runtime-entry-and-record-identity', 'approve-exact-activation-target'] };
  put('review.json', Buffer.from(JSON.stringify(report, null, 2)));
  return { output: target, courseCount: courses.length, unitCount: courses.reduce((sum, course) => sum + course.units.length, 0), activationReady: false };
}
module.exports = { prepareStaticCourseRegistry };
