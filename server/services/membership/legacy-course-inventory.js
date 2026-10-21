'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const Catalog = require('../../../js/course-catalog');
const { normalizeRequestPath, isSensitivePath } = require('../../middleware/static-guard');
const { inside } = require('./content-registry');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (code, status = 422) => Object.assign(new Error(code), { code, status });
const MAX_FILE = 20 * 1024 * 1024, MAX_SCAN = 256 * 1024 * 1024;

/** Read-only inventory. It never executes course scripts or opens account databases. */
class LegacyCourseInventory {
  constructor({ appRoot, publicDecks = null, now = Date.now }) {
    this.root = fs.realpathSync(appRoot);
    this.publicDecks = publicDecks;
    this.now=now;
  }
  read(relative, expected = null) {
    const url = '/' + relative;
    if (typeof relative !== 'string' || normalizeRequestPath(url) !== url || /[\\%?#]/.test(relative)) throw fail('INVALID_SOURCE_PATH');
    const file = fs.realpathSync(path.join(this.root, relative));
    if (!inside(this.root, file) || !fs.statSync(file).isFile() || fs.statSync(file).size > MAX_FILE) throw fail('INVALID_SOURCE_FILE');
    const bytes = fs.readFileSync(file);
    if (expected && (expected.sha256 !== digest(bytes) || expected.bytes !== undefined && expected.bytes !== bytes.length)) throw fail('SOURCE_HASH_MISMATCH');
    return bytes;
  }
  catalog() {
    const manifestBytes=this.read('content/manifest.json'),shardBytes=this.read('server/content/shards.json');
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const shards = JSON.parse(shardBytes.toString('utf8'));
    if (manifest.schemaVersion !== 1 || shards.schemaVersion !== 1 || !Array.isArray(manifest.decks) || !Array.isArray(shards.decks) ||
        !manifest.contentVersion || manifest.contentVersion !== shards.contentVersion) throw fail('SOURCE_MANIFEST_MISMATCH');
    const catalog = Catalog.buildCatalog({ manifest, protectedCourses: [] });
    return { manifest, shards, courses: catalog.courses,
      controls:[{path:'/content/manifest.json',sha256:digest(manifestBytes)},{path:'/server/content/shards.json',sha256:digest(shardBytes)}] };
  }
  loadDeck(deckId, source) {
    const deck = source.manifest.decks.find(deck => deck.id === deckId);
    const map = source.shards.decks.find(deck => deck.id === deckId);
    if (!deck || !map || !Array.isArray(map.shards) || !map.shards.length || !Array.isArray(map.indexShards) || !map.indexShards.length) throw fail('SOURCE_DECK_INCOMPLETE');
    const files = [], parts = new Map();
    for (const shard of [...map.shards, ...map.indexShards]) {
      if (!shard.url?.startsWith('content/') || !/^[a-f0-9]{64}$/.test(shard.sha256 || '')) throw fail('SOURCE_DECK_INCOMPLETE');
      const bytes = this.read(shard.url, shard), doc = JSON.parse(bytes.toString('utf8'));
      if (!Array.isArray(doc.items) || doc.items.length !== shard.count) throw fail('SOURCE_COUNT_MISMATCH');
      parts.set(shard.url, doc.items); files.push('/' + shard.url);
    }
    const items = map.shards.flatMap(shard => parts.get(shard.url));
    if (map.shards.some(shard=>shard.mode!=='replace') || deck.totalCount!==items.length || !items.length || new Set(items.map(item => item.cid)).size !== items.length || items.some(item =>
      !/^[A-Za-z0-9:._-]{1,160}$/.test(item.cid || '') || typeof item.sentence !== 'string' || !item.sentence.trim())) throw fail('SOURCE_ITEMS_INVALID');
    const indexes = map.indexShards.flatMap(shard => parts.get(shard.url));
    if (indexes.length !== items.length || new Set(indexes.map(item => item.cid)).size !== items.length) throw fail('SOURCE_INDEX_MISMATCH');
    const byId = new Map(items.map(item => [item.cid, item]));
    for (const reference of indexes) {
      const target = parts.get(reference.sourceUrl)?.[reference.sourceOffset];
      if (!Number.isSafeInteger(reference.sourceOffset) || reference.sourceOffset < 0 || !map.shards.some(shard => shard.url === reference.sourceUrl) ||
          !target || target.cid !== reference.cid || !byId.has(reference.cid) || reference.sentence !== target.sentence) throw fail('SOURCE_INDEX_MISMATCH');
    }
    return { items, files };
  }
  publicTextFiles() {
    const files = [], archives=[];
    const visit = relative => {
      for (const entry of fs.readdirSync(path.join(this.root, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
        const rel = relative ? relative + '/' + entry.name : entry.name;
        if (isSensitivePath('/' + rel)) continue;
        if (entry.isSymbolicLink()) throw fail('PUBLIC_SOURCE_LINK_REQUIRES_REVIEW');
        if (entry.isDirectory()) visit(rel);
        else if (/\.(?:js|mjs|cjs|json|html|txt)(?:\.(?:br|gz))*$/i.test(rel)) files.push(rel);
        else if(/\.(?:zip|tar|tgz|7z|pdf|epub)(?:\.(?:gz|br))*$/i.test(rel))archives.push({path:'/'+rel,bytes:fs.statSync(path.join(this.root,rel)).size});
        if (files.length+archives.length > 10000) throw fail('SOURCE_SCAN_LIMIT');
      }
    };
    visit(''); return {files,archives};
  }
  build(courseIds) {
    if (!Array.isArray(courseIds) || !courseIds.length || courseIds.length > 100 || new Set(courseIds).size !== courseIds.length) throw fail('INVALID_COURSE_SELECTION');
    const source = this.catalog(), chosen = courseIds.map(id => source.courses.find(course => course.id === id));
    if (chosen.some(course => !course)) throw fail('COURSE_NOT_FOUND', 404);
    const deckCache = new Map(), packages = [], allItems = [];
    const required = new Set();
    for (const course of chosen) {
      const units = Catalog.listLessons(course).map(lesson => {
        if (lesson.contentRef?.type !== 'sentence-deck' || Object.keys(lesson.contentRef).some(key=>!['id','type'].includes(key)) || lesson.itemIds || lesson.range) throw fail('UNSUPPORTED_LEGACY_COURSE');
        const deckId = lesson.contentRef.id;
        if (!deckCache.has(deckId)) deckCache.set(deckId, this.loadDeck(deckId, source));
        const deck = deckCache.get(deckId);
        deck.files.forEach(file => required.add(file)); allItems.push(...deck.items);
        return { unitId: lesson.id, contentRef: lesson.contentRef, itemIds: deck.items.map(item => item.cid),
          legacyLearningIdentity: { deckId, generationScope: 'course:' + deckId }, content: { items: deck.items }, assets: [] };
      });
      if (!units.length) throw fail('SOURCE_DECK_INCOMPLETE');
      packages.push({ courseId: course.id, title: course.title, contentType: 'sentence', units });
    }
    // Historical copies and old raw-script fallbacks are included, not just the active shard map.
    const tokens = [...new Set(allItems.flatMap(item => [JSON.stringify(item.cid), JSON.stringify(item.sentence)]))];
    const tokenPattern=tokens.map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    if(tokenPattern.length>1024*1024)throw fail('SOURCE_SCAN_LIMIT');
    const containsSource=new RegExp(tokenPattern);
    const evidence = [], fingerprints = [], controls = ['content/manifest.json', 'server/content/shards.json'];
    let scannedBytes = 0;
    const publicFiles=this.publicTextFiles();
    for (const relative of publicFiles.files) {
      const bytes = this.read(relative); scannedBytes += bytes.length;
      if (scannedBytes > MAX_SCAN) throw fail('SOURCE_SCAN_LIMIT');
      let decoded = bytes, base = relative;
      for (let depth=0; /\.(?:gz|br)$/i.test(base); depth++) {
        if (depth >= 4) throw fail('SOURCE_COMPRESSION_REQUIRES_REVIEW');
        decoded = /\.gz$/i.test(base) ? zlib.gunzipSync(decoded,{ maxOutputLength:MAX_FILE }) : zlib.brotliDecompressSync(decoded,{ maxOutputLength:MAX_FILE });
        scannedBytes += decoded.length; if(scannedBytes > MAX_SCAN)throw fail('SOURCE_SCAN_LIMIT');
        base = base.replace(/\.(?:gz|br)$/i, '');
      }
      const hash = digest(bytes); fingerprints.push({ path:'/' + relative, sha256:hash, bytes:bytes.length });
      // Metadata manifests contain no standard answers and must stay readable.
      if (controls.includes(base)) continue;
      const text = decoded.toString('utf8');
      if (required.has('/' + base) || containsSource.test(text)) {
        required.add('/' + base); evidence.push({ path:'/' + relative, sourcePath:'/' + base, sha256:hash, bytes:bytes.length });
      }
    }
    const selectedRefs = new Set([...deckCache.keys()]);
    const sharedCourses = source.courses.filter(course => !courseIds.includes(course.id) && Catalog.listLessons(course).some(lesson => selectedRefs.has(lesson.contentRef?.id)))
      .map(course => ({ courseId:course.id, title:course.title }));
    const sentences = new Set(allItems.map(item => item.sentence));
    const publicShareConflicts = this.publicDecks ? this.publicDecks().filter(deck => (deck.items || []).some(item => sentences.has(item.sentence || item.en)))
      .map(deck => ({ deckId:deck.id })) : [];
    const inputFingerprints=source.controls;
    for(const input of inputFingerprints)if(digest(this.read(input.path.slice(1)))!==input.sha256)throw fail('SOURCE_CHANGED_DURING_REVIEW');
    for(const deckId of deckCache.keys()){
      const map=source.shards.decks.find(deck=>deck.id===deckId);
      for(const shard of [...map.shards,...map.indexShards])this.read(shard.url,shard);
    }
    const report = { schemaVersion:1, kind:'legacy-course-source-review', activationReady:false,inspectedAt:this.now(),
      coverage:'local-literal-evidence-only',
      courseIds, contentVersion:source.manifest.contentVersion, courseCount:packages.length, unitCount:packages.reduce((sum,course)=>sum+course.units.length,0),
      itemCount:allItems.length, sourcePaths:[...required].sort(), evidence, sharedCourses, publicShareConflicts,
      publicSharesChecked:!!this.publicDecks, scannedFiles:fingerprints.length, scannedBytes,
      uninspectedArtifacts:publicFiles.archives,
      reviewRequired:['inspect-computed-and-encoded-content','inspect-public-package-archives','preserve-legacy-learning-identities','connect-protected-runtime-entry','recheck-runtime-public-shares','verify-production-static-routes'],
      sourceVersion:digest(JSON.stringify({inputFingerprints,fingerprints,courseIds,sharedCourses,publicShareConflicts,archives:publicFiles.archives})) };
    return { report, packages };
  }
  inspect(courseIds) { return this.build(courseIds).report; }
}

/** Create a new, review-only artifact. No registry installation, policy changes, or account writes. */
function prepareLegacyCourseBundle({ inventory, courseIds, output }) {
  const resolved = path.resolve(output);
  if (fs.existsSync(resolved)) throw fail('OUTPUT_ALREADY_EXISTS');
  const parent = fs.realpathSync(path.dirname(resolved));
  const target = path.join(parent, path.basename(resolved));
  if (inside(inventory.root,target) && !isSensitivePath('/' + path.relative(inventory.root,target).replace(/\\/g,'/'))) throw fail('PUBLIC_OUTPUT_FORBIDDEN');
  const { report,packages } = inventory.build(courseIds);
  fs.mkdirSync(target);
  const candidates = packages.map((course,index) => ({ courseId:course.courseId,title:course.title,contentType:course.contentType,defaultAccess:'free',
    sourcePaths:report.sourcePaths,legacyDeckIds:[...new Set(course.units.map(unit=>unit.contentRef.id))],
    units:course.units.map((unit,unitIndex)=>{
      const file='course-'+index+'-unit-'+unitIndex+'.json';
      fs.writeFileSync(path.join(target,file),JSON.stringify(unit.content),{flag:'wx'});
      const recordIdentity={...unit.legacyLearningIdentity,resumeIdentity:unit.legacyLearningIdentity.deckId};
      const built=new (require('./static-fragment-builder').StaticFragmentBuilder)().build({courseId:course.courseId,unitId:unit.unitId,contentType:course.contentType,
        content:unit.content,itemIds:unit.itemIds,assets:unit.assets,recordIdentity});
      for(const part of built.files)fs.writeFileSync(path.join(target,part.name),part.bytes,{flag:'wx'});
      const {content,...metadata}=unit;void content;return {...metadata,file,recordIdentity,fragments:built.fragments,contentVersion:built.contentVersion};
    }) }));
  const files=fs.readdirSync(target).sort().map(file=>({file,sha256:digest(fs.readFileSync(path.join(target,file)))}));
  fs.writeFileSync(path.join(target,'candidate.json'),JSON.stringify({schemaVersion:2,activationReady:false,courses:candidates},null,2),{flag:'wx'});
  fs.writeFileSync(path.join(target,'review.json'),JSON.stringify({...report,files},null,2),{flag:'wx'});
  for(const file of files)if(digest(fs.readFileSync(path.join(target,file.file)))!==file.sha256)throw fail('OUTPUT_VERIFICATION_FAILED');
  return {...report,output:target};
}
module.exports={LegacyCourseInventory,prepareLegacyCourseBundle};
