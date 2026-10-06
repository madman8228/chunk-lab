'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROJECT_ID = 'chunk-practice';
const MAX_DRAFT_BYTES = 12 * 1024 * 1024;
const MAX_COURSE_ITEMS = 10000;

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createContentStudio(options) {
  const db = options.db;
  const appRoot = path.resolve(options.appRoot);
  const manifestPath = path.join(appRoot, 'content', 'manifest.json');
  const overridesDir = path.join(appRoot, 'extra', 'content-overrides');

  function writeAtomic(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    fs.writeFileSync(temp, value);
    fs.renameSync(temp, file);
  }

  function updateServiceWorkerCache() {
    const swPath = path.join(appRoot, 'sw.js');
    const hashPath = path.join(appRoot, 'scripts', 'sw-hash.js');
    if (!fs.existsSync(swPath) || !fs.existsSync(hashPath)) throw new Error('Service Worker 缓存生成器不可用');
    const { hashFiles } = require(hashPath);
    const source = fs.readFileSync(swPath, 'utf8');
    const matchAssets = (name) => {
      const found = source.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];'));
      return found ? (found[1].match(/'([^']+)'/g) || []).map((item) => item.slice(1, -1)) : [];
    };
    const assets = matchAssets('PRECACHE').concat(matchAssets('PRECACHE_SOFT'));
    const missing = assets.filter((url) => !fs.existsSync(path.join(appRoot, url.replace(/^\//, ''))));
    if (missing.length) throw new Error('缓存资源缺失：' + missing.slice(0, 5).join(', '));
    const version = 'chunklab-' + hashFiles({ root: appRoot, files: assets, swSource: source }).slice(0, 8);
    const updated = source.replace(/^const CACHE = '[^']*';/m, "const CACHE = '" + version + "';");
    if (updated === source && !source.includes("const CACHE = '" + version + "';")) throw new Error('无法更新缓存版本');
    writeAtomic(swPath, updated);
    return version;
  }

  function buildPublishedArtifacts(course, entry, manifest) {
    if (course.items.length > MAX_COURSE_ITEMS) throw new Error('课程条目过多');
    const shardBody = JSON.stringify({ schemaVersion: 1, mode: 'replace', items: course.items }, null, 2) + '\n';
    const shardHash = hash(shardBody);
    const shardId = 'oral-001-' + shardHash.slice(0, 12);
    const shardUrl = 'content/' + course.id + '/' + shardId + '.json';
    const indexItems = course.items.map((item, sourceOffset) => ({ cid: item.cid, sentence: item.sentence, translation: item.translation, sourceUrl: shardUrl, sourceOffset }));
    const indexBody = JSON.stringify({ schemaVersion: 1, mode: 'index', items: indexItems }, null, 2) + '\n';
    const indexHash = hash(indexBody);
    const indexId = 'oral-index-001-' + indexHash.slice(0, 12);
    const indexUrl = 'content/' + course.id + '/' + indexId + '.json';
    const nextEntry = Object.assign({}, entry, {
      name: course.name, short: course.short, desc: course.desc, totalCount: course.items.length,
      shards: [{ id: shardId, url: shardUrl, count: course.items.length, bytes: Buffer.byteLength(shardBody), sha256: shardHash, mode: 'replace' }],
      indexShards: [{ id: indexId, url: indexUrl, count: course.items.length, bytes: Buffer.byteLength(indexBody), sha256: indexHash, mode: 'index' }],
    });
    const nextManifest = Object.assign({}, manifest, { decks: manifest.decks.map((item) => item.id === course.id ? nextEntry : item) });
    nextManifest.contentVersion = 'v1-' + hash(JSON.stringify({ decks: nextManifest.decks }));
    return { shardBody, shardUrl, indexBody, indexUrl, nextManifest };
  }

  function readManifest() {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.decks)) {
      throw new Error('课程清单格式无效');
    }
    return manifest;
  }

  function sourceCourse(courseId) {
    const manifest = readManifest();
    const entry = manifest.decks.find((item) => item.id === courseId);
    if (!entry) return null;
    const items = [];
    (entry.shards || []).forEach((shard) => {
      const file = path.resolve(appRoot, shard.url);
      if (!file.startsWith(path.resolve(appRoot, 'content') + path.sep)) throw new Error('课程分片路径越界');
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items)) throw new Error('课程分片格式无效');
      items.push.apply(items, data.items);
    });
    return {
      id: entry.id,
      name: entry.name,
      short: entry.short || '',
      desc: entry.desc || '',
      chapter: entry.chapter,
      section: entry.section || '',
      profile: 'sentence-deck/1',
      items,
    };
  }

  function latestRevision(courseId) {
    return db.prepare(
      'SELECT revision,status,content_json,content_hash,created_at FROM admin_content_revisions WHERE project_id=? AND course_id=? ORDER BY revision DESC LIMIT 1'
    ).get(PROJECT_ID, courseId) || null;
  }

  function validateCourse(courseId, course) {
    const errors = [];
    // 先只校验可证明的结构约束。关键词式“常见错误/也可以”语义检测会把
    // 合法的替代表达说明误判成矛盾（现有课程已实测），不用于阻断发布。
    const source = sourceCourse(courseId);
    if (!source) return { valid: false, errors: ['课程不存在：' + courseId], warnings: [] };
    if (!course || typeof course !== 'object' || Array.isArray(course)) {
      return { valid: false, errors: ['course 必须是对象'], warnings: [] };
    }
    if (course.id !== courseId) errors.push('课程 ID 不可更改：' + courseId);
    if (!Array.isArray(course.items)) errors.push('items 必须是数组');
    const items = Array.isArray(course.items) ? course.items : [];
    if (items.length !== source.items.length) errors.push('首版暂不支持增删句子，条目数量必须保持 ' + source.items.length);
    const seen = new Set();
    items.forEach((item, index) => {
      const expected = source.items[index];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push('items[' + index + '] 必须是对象');
        return;
      }
      if (!item.cid || seen.has(item.cid)) errors.push('句子 ID 缺失或重复：items[' + index + ']');
      seen.add(item.cid);
      if (!expected || item.cid !== expected.cid) errors.push('句子顺序或稳定 ID 被修改：items[' + index + ']');
      if (typeof item.sentence !== 'string' || !item.sentence.trim()) errors.push('英文原句不能为空：' + item.cid);
      if (typeof item.translation !== 'string' || !item.translation.trim()) errors.push('中文翻译不能为空：' + item.cid);
      if (!Array.isArray(item.chunks) || !item.chunks.length || item.chunks.some((chunk) => typeof chunk !== 'string' || !chunk.trim())) {
        errors.push('意群必须是非空文本数组：' + item.cid);
      } else if (item.chunks.join(' ').replace(/\s+/g, ' ').trim().toLowerCase() !== String(item.sentence || '').replace(/\s+/g, ' ').trim().toLowerCase()) {
        errors.push('意群拼接与英文原句不一致：' + item.cid);
      }
      if (!Array.isArray(item.hints) || !Array.isArray(item.chunks) || item.hints.length !== item.chunks.length
        || item.hints.some((hint) => typeof hint !== 'string' || !hint.trim())) {
        errors.push('提示数量必须与意群数量一致且不能为空：' + item.cid);
      }
      if (item.explanations != null && (!Array.isArray(item.explanations)
        || item.explanations.some((exp) => typeof exp !== 'string')
        || item.explanations.length > (Array.isArray(item.chunks) ? item.chunks.length : 0))) {
        errors.push('讲解必须是文本数组，且数量不能超过意群：' + item.cid);
      }
    });
    const bytes = Buffer.byteLength(JSON.stringify(course), 'utf8');
    if (bytes > MAX_DRAFT_BYTES) errors.push('课程草稿超过大小限制');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  function catalog() {
    const manifest = readManifest();
    return manifest.decks.map((entry) => ({
      id: entry.id,
      name: entry.name,
      short: entry.short || '',
      desc: entry.desc || '',
      itemCount: Number(entry.totalCount) || 0,
      profile: 'sentence-deck/1',
      contentVersion: manifest.contentVersion,
    }));
  }

  function getCourse(courseId) {
    const course = sourceCourse(courseId);
    if (!course) return null;
    const latest = latestRevision(courseId);
    return {
      projectId: PROJECT_ID,
      profile: course.profile,
      course,
      contentVersion: readManifest().contentVersion,
      revision: latest ? latest.revision : 0,
      draft: latest && latest.status === 'draft'
        ? { revision: latest.revision, course: JSON.parse(latest.content_json), updatedAt: latest.created_at }
        : null,
      publishedRevision: latest && latest.status === 'published' ? latest.revision : 0,
    };
  }

  function saveDraft(courseId, baseRevision, course) {
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
      return { status: 400, error: 'baseRevision 必须是非负整数' };
    }
    if (Buffer.byteLength(JSON.stringify(course), 'utf8') > MAX_DRAFT_BYTES) {
      return { status: 413, error: '课程草稿超过大小限制' };
    }
    return db.transaction(() => {
      const current = latestRevision(courseId);
      const revision = current ? current.revision : 0;
      if (baseRevision !== revision) return { status: 409, error: '草稿已有新版本，请刷新后合并', currentRevision: revision };
      const contentJson = JSON.stringify(course);
      const nextRevision = revision + 1;
      db.prepare(
        "INSERT INTO admin_content_revisions (project_id,course_id,revision,status,content_json,content_hash) VALUES (?,?,?,'draft',?,?)"
      ).run(PROJECT_ID, courseId, nextRevision, contentJson, hash(contentJson));
      return { status: 200, revision: nextRevision, contentHash: hash(contentJson) };
    })();
  }

  function readDraft(courseId) {
    const latest = latestRevision(courseId);
    return {
      revision: latest ? latest.revision : 0,
      draft: latest && latest.status === 'draft'
        ? { revision: latest.revision, course: JSON.parse(latest.content_json), contentHash: latest.content_hash, updatedAt: latest.created_at }
        : null,
      publishedRevision: latest && latest.status === 'published' ? latest.revision : 0,
    };
  }

  function publish(courseId, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return { status: 400, error: 'revision 必须是正整数' };
    const latest = latestRevision(courseId);
    if (!latest || latest.revision !== expectedRevision || latest.status !== 'draft') {
      return { status: 409, error: '草稿版本已变化，请刷新后再发布', currentRevision: latest ? latest.revision : 0 };
    }
    const course = JSON.parse(latest.content_json);
    const validation = validateCourse(courseId, course);
    if (!validation.valid || validation.warnings.length) return { status: 422, error: '课程未通过发布校验', validation };
    const manifest = readManifest();
    const entry = manifest.decks.find((item) => item.id === courseId);
    const artifacts = buildPublishedArtifacts(course, entry, manifest);
    const overridePath = path.join(overridesDir, courseId + '.json');
    const oldOverride = fs.existsSync(overridePath) ? fs.readFileSync(overridePath) : null;
    const oldManifest = fs.readFileSync(manifestPath);
    const swPath = path.join(appRoot, 'sw.js');
    const oldSw = fs.existsSync(swPath) ? fs.readFileSync(swPath) : null;
    const nextRevision = latest.revision + 1;
    const contentJson = JSON.stringify(course);
    try {
      writeAtomic(overridePath, JSON.stringify({ schemaVersion: 1, profile: 'sentence-deck/1', course }, null, 2) + '\n');
      writeAtomic(path.join(appRoot, artifacts.shardUrl), artifacts.shardBody);
      writeAtomic(path.join(appRoot, artifacts.indexUrl), artifacts.indexBody);
      writeAtomic(manifestPath, JSON.stringify(artifacts.nextManifest, null, 2) + '\n');
      const cacheVersion = updateServiceWorkerCache();
      db.prepare("INSERT INTO admin_content_revisions (project_id,course_id,revision,status,content_json,content_hash) VALUES (?,?,?,'published',?,?)")
        .run(PROJECT_ID, courseId, nextRevision, contentJson, hash(contentJson));
      return { status: 200, revision: nextRevision, contentVersion: artifacts.nextManifest.contentVersion, cacheVersion };
    } catch (error) {
      if (oldOverride) writeAtomic(overridePath, oldOverride);
      else if (fs.existsSync(overridePath)) fs.unlinkSync(overridePath);
      writeAtomic(manifestPath, oldManifest);
      if (oldSw) writeAtomic(swPath, oldSw);
      throw error;
    }
  }

  return { catalog, getCourse, readDraft, saveDraft, validateCourse, publish };
}

module.exports = { PROJECT_ID, createContentStudio };
