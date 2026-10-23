'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const imageDimensions = require('./membership/image-dimensions').imageDimensions;
const { wordbookImageDelivery } = require('./wordbook-image-delivery');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const defaultAssetRoot = path.resolve(__dirname, '../..');
const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/wav']);

function detectAssetMime(bytes) {
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224) return 'audio/mpeg';
  if (bytes.subarray(0, 4).toString() === 'OggS') return 'audio/ogg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE') return 'audio/wav';
  return null;
}

function embeddedAsset(asset, referenceKinds = new Set()) {
  const dataUri = typeof asset?._dataUri === 'string' ? asset._dataUri : typeof asset?.dataUri === 'string' ? asset.dataUri : '';
  const match = /^data:([\w.+*-]+\/[\w.+*-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri);
  if (!match) return null;
  const [, uriMimeType, base64] = match, bytes = Buffer.from(base64, 'base64'), mimeType = detectAssetMime(bytes);
  const declaredMimeType = typeof asset?.mimeType === 'string' ? asset.mimeType.toLowerCase() : '';
  const legacyAudioType = asset?.type === 'line_audio' && mimeType?.startsWith('audio/') && referenceKinds.size > 0 &&
    [...referenceKinds].every(kind => kind === 'audioAssetId');
  const uriMatchesBytes = uriMimeType === mimeType || uriMimeType === 'image/*' && mimeType?.startsWith('image/') ||
    uriMimeType === 'image/*' && legacyAudioType;
  const descriptorMatchesBytes = !declaredMimeType || declaredMimeType === mimeType ||
    declaredMimeType === 'image/*' && mimeType?.startsWith('image/');
  if (!mimeType || !allowedMime.has(mimeType) || !bytes.length || bytes.toString('base64') !== base64 || !uriMatchesBytes || !descriptorMatchesBytes) {
    return { invalid: true };
  }
  return { mimeType, base64, bytes, sha256: digest(bytes) };
}

function prepareLegacyAssets(content, courseId) {
  const descriptors = Array.isArray(content.assets) ? content.assets : [];
  const references = new Set();
  const referenceKinds = new Map();
  (function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'imageAssetId' || key === 'audioAssetId') && typeof child === 'string' && child) {
        references.add(child);
        if (!referenceKinds.has(child)) referenceKinds.set(child, new Set());
        referenceKinds.get(child).add(key);
      }
      else visit(child);
    }
  })(content);
  if (references.size && !descriptors.length) throw Object.assign(new Error('课程引用了未声明素材，迁移已停止'), { code: 'MIGRATION_ASSETS_UNDECLARED' });
  const prepared = descriptors.map(asset => {
    const payload = embeddedAsset(asset, referenceKinds.get(asset?.id));
    if (!asset || typeof asset.id !== 'string' || !/^[A-Za-z0-9:._-]{1,200}$/.test(asset.id) || !payload || payload.invalid) {
      throw Object.assign(new Error(`素材“${asset?.id || 'unknown'}”缺少可验证的内嵌文件；迁移已停止`), { code: 'MIGRATION_ASSET_BYTES_UNAVAILABLE' });
    }
    const image = payload.mimeType.startsWith('image/');
    if (image) {
      const dimensions = imageDimensions(payload.bytes, payload.mimeType);
      if (payload.bytes.length > 2 * 1024 * 1024 || !dimensions || dimensions.some(n => n < 1 || n > 4096) || dimensions[0] * dimensions[1] > 12000000) {
        throw Object.assign(new Error(`图片素材“${asset.id}”大小或尺寸超限；迁移已停止`), { code: 'MIGRATION_ASSET_INVALID' });
      }
    } else {
      const bytes = payload.bytes, validAudio = payload.mimeType === 'audio/mpeg' && (bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224) ||
        payload.mimeType === 'audio/ogg' && bytes.toString('ascii', 0, 4) === 'OggS' ||
        payload.mimeType === 'audio/wav' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
      if (!validAudio || bytes.length > 10 * 1024 * 1024) throw Object.assign(new Error(`音频素材“${asset.id}”格式或大小无效；迁移已停止`), { code: 'MIGRATION_ASSET_INVALID' });
    }
    return { assetId: asset.id, mimeType: payload.mimeType, sha256: payload.sha256, byteLength: payload.bytes.length, bytes: payload.bytes };
  });
  if (new Set(prepared.map(asset => asset.assetId)).size !== prepared.length || prepared.some(asset => !references.has(asset.assetId))) {
    throw Object.assign(new Error('素材 ID 重复或未被课程引用；迁移已停止'), { code: 'MIGRATION_ASSET_INVENTORY_INVALID' });
  }
  const preparedIds = new Set(prepared.map(asset => asset.assetId));
  for (const reference of references) if (!preparedIds.has(reference)) {
    throw Object.assign(new Error(`素材“${reference}”文件不可用；迁移已停止`), { code: 'MIGRATION_ASSET_BYTES_UNAVAILABLE' });
  }
  if (prepared.reduce((sum, asset) => sum + asset.byteLength, 0) > 24 * 1024 * 1024) {
    throw Object.assign(new Error('课程素材总量超限；迁移已停止'), { code: 'MIGRATION_ASSET_INVALID' });
  }
  return prepared;
}

function stripEmbeddedAssetData(value, inAssets = false) {
  if (Array.isArray(value)) return value.map(child => stripEmbeddedAssetData(child, inAssets));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !inAssets || key !== '_dataUri' && key !== 'dataUri')
    .map(([key, child]) => [key, stripEmbeddedAssetData(child, inAssets || key === 'assets')]));
}

function inventoryContent(content) {
  const items = Array.isArray(content.items) ? content.items : Array.isArray(content.utterances) ? content.utterances : [];
  const itemIds = items.map((item, index) => ({ index, id: String(item?.cid || item?.id || '') }));
  const seen = new Set(), duplicateItemIds = [];
  for (const item of itemIds) {
    if (!item.id) continue;
    if (seen.has(item.id)) duplicateItemIds.push(item.id);
    seen.add(item.id);
  }
  const declared = new Set((Array.isArray(content.assets) ? content.assets : [])
    .map(asset => asset && (asset.assetId || asset.id)).filter(value => typeof value === 'string' && value));
  const mediaReferences = [];
  const referenceKinds = new Map();
  function visit(value, path) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'imageAssetId' || key === 'audioAssetId') && typeof child === 'string' && child) {
        mediaReferences.push({ path: `${path}.${key}`, assetId: child, kind: key === 'imageAssetId' ? 'image' : 'audio' });
        if (!referenceKinds.has(child)) referenceKinds.set(child, new Set());
        referenceKinds.get(child).add(key);
      } else visit(child, `${path}.${key}`);
    }
  }
  visit(content, '$');
  const assets = (Array.isArray(content.assets) ? content.assets : []).map(asset => {
    const assetId = String(asset?.assetId || asset?.id || ''), payload = embeddedAsset(asset, referenceKinds.get(assetId));
    return { assetId, mimeType: payload && !payload.invalid ? payload.mimeType : String(asset?.mimeType || ''),
      embedded: !!payload && !payload.invalid, ...(payload && !payload.invalid ? { bytes: payload.bytes.length, sha256: payload.sha256 } : {}) };
  });
  const assetIds = assets.map(asset => asset.assetId).filter(Boolean);
  const duplicateAssetIds = assetIds.filter((assetId, index) => assetIds.indexOf(assetId) !== index);
  const unavailableAssetIds = [...new Set([
    ...mediaReferences.map(reference => reference.assetId),
    ...(Array.isArray(content.assets) ? content.assets.map(asset => asset.assetId || asset.id) : [])
  ])].filter(assetId => {
    const descriptor = (Array.isArray(content.assets) ? content.assets : []).find(asset => (asset.assetId || asset.id) === assetId);
    const payload = embeddedAsset(descriptor, referenceKinds.get(assetId));
    return !descriptor || !payload || payload.invalid;
  });
  return { itemCount: items.length, itemIds, duplicateItemIds, mediaReferenceCount: mediaReferences.length, assets,
    mediaAssetIds: [...new Set(mediaReferences.map(reference => reference.assetId))].sort(),
    undeclaredMediaReferences: mediaReferences.filter(reference => !declared.has(reference.assetId)),
    unavailableAssetIds, duplicateAssetIds, migrationBlockers: [
      ...mediaReferences.filter(reference => !declared.has(reference.assetId)).map(reference => ({ code: 'UNDECLARED_ASSET', path: reference.path, assetId: reference.assetId })),
      ...unavailableAssetIds.map(assetId => ({ code: 'ASSET_BYTES_UNAVAILABLE', assetId })),
      ...duplicateAssetIds.map(assetId => ({ code: 'DUPLICATE_ASSET_ID', assetId }))
    ] };
}

function readLegacyContent(db, { assetRoot = defaultAssetRoot } = {}) {
  const decks = db.prepare(`SELECT user_id,id,name,items_json,builtin,is_public,authoring_json FROM user_decks
    WHERE deleted_at IS NULL ORDER BY user_id,id`).all().map(row => ({
    userId: Number(row.user_id), kind: 'deck', legacyId: row.id, visibility: row.is_public ? 'public' : 'private',
    content: { id: row.id, name: row.name, items: JSON.parse(row.items_json || '[]'), builtin: !!row.builtin,
      ...(row.authoring_json ? { authoring: JSON.parse(row.authoring_json) } : {}) }
  }));
  const courses = db.prepare(`SELECT user_id,course_id,data_json FROM user_courses
    WHERE deleted_at IS NULL ORDER BY user_id,course_id`).all().map(row => ({
    userId: Number(row.user_id), kind: 'course', legacyId: row.course_id, visibility: 'private', content: JSON.parse(row.data_json)
  }));
  const hasWordbooks = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='personal_wordbook_versions'").get();
  const wordbooks = hasWordbooks ? db.prepare(`SELECT user_id,book_id,version,revision,package_json,created_at
    FROM personal_wordbook_versions ORDER BY user_id,book_id,version`).all() : [];
  const wordbookGroups = new Map();
  for (const row of wordbooks) {
    const key = `${row.user_id}:${row.book_id}`;
    if (!wordbookGroups.has(key)) wordbookGroups.set(key, []);
    wordbookGroups.get(key).push(row);
  }
  const authoredWordbooks = [...wordbookGroups.values()].map(rows => {
    const latest = rows.at(-1);
    const packages = rows.map((row, index) => {
      const pkg = JSON.parse(row.package_json), book = pkg?.index?.books?.[0];
      if (Number(row.version) !== index + 1 || !book || pkg.index.books.length !== 1 || book.bookId !== row.book_id ||
          book.revision !== row.revision || !Array.isArray(pkg.items) || !Array.isArray(book.units) || pkg.items.length !== book.itemCount) {
        throw Object.assign(new Error(`个人词书“${row.book_id}”的第 ${row.version} 版无法核对；迁移停止`), { code: 'MIGRATION_WORDBOOK_INVALID' });
      }
      return pkg;
    });
    const pkg = packages.at(-1), book = pkg.index.books[0];
    for (let index = 1; index < packages.length; index++) {
      const previous = packages[index - 1], priorBook = previous.index.books[0], nextBook = packages[index].index.books[0];
      if (previous.items.length > packages[index].items.length ||
          previous.items.some((item, itemIndex) => digest(JSON.stringify(item)) !== digest(JSON.stringify(packages[index].items[itemIndex]))) ||
          priorBook.units.length > nextBook.units.length ||
          priorBook.units.some((unit, unitIndex) => digest(JSON.stringify(unit)) !== digest(JSON.stringify(nextBook.units[unitIndex]))) ||
          digest(JSON.stringify(priorBook.relatedCourseIds || [])) !== digest(JSON.stringify(nextBook.relatedCourseIds || []))) {
        throw Object.assign(new Error(`个人词书“${latest.book_id}”的历史版本不是安全追加关系；迁移停止`), { code: 'MIGRATION_WORDBOOK_HISTORY_CONFLICT' });
      }
    }
    const legacyId = `wordbook:${latest.book_id}`;
    const history = rows.map(row => ({ version: Number(row.version), revision: row.revision, createdAt: row.created_at,
      sourceHash: digest(JSON.stringify([row.version, row.revision, row.package_json, row.created_at])) }));
    const deliveryOverrides = packages.flatMap((pkg, index) => wordbookImageDelivery(pkg, assetRoot)
      .map(override => ({ version: Number(rows[index].version), ...override })));
    const imagePaths = [...new Set(packages.flatMap((pkg, index) => pkg.items.map(item => {
      const override = deliveryOverrides.find(value => value.version === Number(rows[index].version) && value.itemId === item.itemId);
      return override ? { ...item, images: override.images } : item;
    })).flatMap(item => [...(item?.images?.wide || []), ...(item?.images?.mobile || [])])
      .filter(value => typeof value === 'string'))].sort();
    const assets = [], migrationBlockers = [];
    for (const assetPath of imagePaths) {
      const rootPath = path.resolve(assetRoot), absolutePath = path.resolve(rootPath, assetPath);
      if (!absolutePath.startsWith(rootPath + path.sep)) {
        migrationBlockers.push({ code: 'WORD_BOOK_ASSET_PATH_INVALID', path: assetPath });
        continue;
      }
      try {
        const realRoot = fs.realpathSync(rootPath), realPath = fs.realpathSync(absolutePath);
        if (!realPath.startsWith(realRoot + path.sep)) {
          migrationBlockers.push({ code: 'WORD_BOOK_ASSET_PATH_INVALID', path: assetPath });
          continue;
        }
        const bytes = fs.readFileSync(realPath);
        if (!bytes.length || bytes.length >= 20000) migrationBlockers.push({ code: 'WORD_BOOK_ASSET_SIZE_INVALID', path: assetPath, bytes: bytes.length });
        assets.push({ path: assetPath, bytes: bytes.length, sha256: digest(bytes) });
      } catch {
        migrationBlockers.push({ code: 'WORD_BOOK_ASSET_MISSING', path: assetPath });
      }
    }
    return { userId: Number(latest.user_id), kind: 'course', family: 'vocabulary-book', legacyId, visibility: 'private',
      content: { contentFamily: 'vocabulary-book', contentFamilyVersion: 1, package: pkg },
      sourceVersions: history,
      inventory: { itemCount: pkg.items.length, itemIds: pkg.items.map((item, index) => ({ index, id: String(item?.itemId || '') })),
        duplicateItemIds: pkg.items.map(item => item?.itemId).filter((id, index, all) => id && all.indexOf(id) !== index),
        mediaReferenceCount: imagePaths.length, assets, undeclaredMediaReferences: [], unavailableAssetIds: [], duplicateAssetIds: [], migrationBlockers,
        ...(deliveryOverrides.length ? { deliveryOverrides } : {}) } };
  });
  return decks.concat(courses, authoredWordbooks).map(source => {
    const sourceHash = digest(JSON.stringify({ kind: source.kind, legacyId: source.legacyId, visibility: source.visibility, content: source.content }));
    const courseId = 'legacy-' + (source.family || source.kind) + '-' + source.userId + '-' + digest(source.legacyId).slice(0, 24);
    return { userId: source.userId, kind: source.kind, legacyId: source.legacyId, courseId,
      visibility: source.visibility, sourceHash, title: String(source.content.title || source.content.name || '').slice(0, 240) || '未命名课程',
      ...(source.family ? { family: source.family, sourceVersions: source.sourceVersions, inventory: source.inventory,
        title: String(source.content.package.index.books[0].title || '').slice(0, 240) || '未命名单词本' }
        : { inventory: inventoryContent(source.content) }) };
  });
}

function auditLearningReferences(db, entries) {
  const mappings = new Map();
  for (const entry of entries) {
    const add = sourceId => {
      const key = `${entry.userId}:${sourceId}`;
      if (!mappings.has(key)) mappings.set(key, new Set());
      mappings.get(key).add(entry.courseId);
    };
    add(entry.legacyId);
    if (entry.family === 'vocabulary-book') add(entry.legacyId.slice('wordbook:'.length));
    if (entry.kind === 'deck') add('user-deck:' + entry.legacyId);
  }
  const resolve = (userId, sourceId) => {
    const targets = mappings.get(`${userId}:${sourceId}`);
    return targets && targets.size === 1 ? [...targets][0] : null;
  };
  const courseProgress = db.prepare(`SELECT user_id AS userId,course_id AS sourceKey,data_json AS dataJson
    FROM user_course_progress ORDER BY user_id,course_id`).all().flatMap(row => {
    let value;
    try { value = JSON.parse(row.dataJson); } catch { return []; }
    const enrollment = value && value.kind === 'course-enrollment' && value.schemaVersion === 1 && typeof value.courseId === 'string';
    const sourceId = enrollment ? value.courseId : row.sourceKey;
    const targetId = resolve(Number(row.userId), sourceId);
    return targetId ? [{ userId: Number(row.userId), sourceKey: row.sourceKey, sourceId, targetId,
      kind: enrollment ? 'enrollment' : 'course-progress', keyMatchesValue: !enrollment || row.sourceKey === 'enrollment:v1:' + encodeURIComponent(sourceId) }] : [];
  });
  const learningResumes = db.prepare(`SELECT user_id AS userId,session_id AS sessionId,course_id AS sourceId
    FROM user_learning_resumes WHERE course_id IS NOT NULL ORDER BY user_id,session_id`).all().flatMap(row => {
    const targetId = resolve(Number(row.userId), row.sourceId);
    return targetId ? [{ userId: Number(row.userId), sessionId: row.sessionId, sourceId: row.sourceId, targetId }] : [];
  });
  const vocabularyReferences = new Map();
  const addVocabularyReference = (userId, sourceId, origin) => {
    if (typeof sourceId !== 'string' || !sourceId) return;
    const bookId = sourceId.startsWith('wordbook:') ? sourceId.slice('wordbook:'.length) : sourceId;
    const key = `${Number(userId)}:${bookId}`;
    const entry = entries.find(row => row.userId === Number(userId) && row.family === 'vocabulary-book' && row.legacyId === `wordbook:${bookId}`);
    const current = vocabularyReferences.get(key) || { userId: Number(userId), sourceId: bookId, targetId: entry?.courseId || null, origins: [] };
    if (!current.origins.includes(origin)) current.origins.push(origin);
    vocabularyReferences.set(key, current);
  };
  const tableExists = name => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if (tableExists('user_entity_rows')) {
    for (const row of db.prepare("SELECT user_id,item_key,data_json,kind FROM user_entity_rows WHERE kind IN ('vocabularyResume','vocabularyBrowseResume','vocabularyStudySummary')").all()) {
      let value; try { value = JSON.parse(row.data_json); } catch { value = null; }
      addVocabularyReference(row.user_id, value?.bookId || row.item_key, row.kind);
    }
  }
  for (const table of ['vocabulary_study_events', 'vocabulary_attempt_events', 'vocabulary_practice_reports']) {
    if (!tableExists(table)) continue;
    for (const row of db.prepare(`SELECT DISTINCT user_id,resource_id FROM ${table} WHERE resource_id LIKE 'wordbook:%'`).all()) {
      addVocabularyReference(row.user_id, row.resource_id, table);
    }
  }
  return { courseProgress, learningResumes, vocabularyReferences: [...vocabularyReferences.values()]
    .sort((a, b) => a.userId - b.userId || a.sourceId.localeCompare(b.sourceId)) };
}

function buildManifest(db, { createdAt = new Date().toISOString(), assetRoot = defaultAssetRoot } = {}) {
  const entries = readLegacyContent(db, { assetRoot });
  const learningReferences = auditLearningReferences(db, entries);
  const duplicates = new Map();
  for (const entry of entries) {
    const key = entry.kind + ':' + entry.legacyId;
    if (!duplicates.has(key)) duplicates.set(key, []);
    duplicates.get(key).push({ userId: entry.userId, sourceHash: entry.sourceHash, targetId: entry.courseId });
  }
  const idCollisions = [...duplicates.entries()].filter(([, owners]) => owners.length > 1)
    .map(([legacyKey, owners]) => ({ legacyKey, owners }));
  const payload = { schemaVersion: 1, createdAt, entries, learningReferences,
    sourceDigest: digest(JSON.stringify({ entries, learningReferences })), idCollisions,
    totals: { decks: entries.filter(row => row.kind === 'deck').length,
      courses: entries.filter(row => row.kind === 'course').length,
      items: entries.reduce((sum, row) => sum + row.inventory.itemCount, 0),
      mediaReferences: entries.reduce((sum, row) => sum + row.inventory.mediaReferenceCount, 0),
      undeclaredMediaReferences: entries.reduce((sum, row) => sum + row.inventory.undeclaredMediaReferences.length, 0),
      unavailableAssetBytes: entries.reduce((sum, row) => sum + row.inventory.unavailableAssetIds.length, 0),
      migrationBlockers: entries.reduce((sum, row) => sum + row.inventory.migrationBlockers.length, 0),
      duplicateItemIds: entries.reduce((sum, row) => sum + row.inventory.duplicateItemIds.length, 0),
      mappedLearningReferences: learningReferences.courseProgress.length + learningReferences.learningResumes.length,
      mappedVocabularyReferences: learningReferences.vocabularyReferences.filter(row => row.targetId).length,
      unresolvedVocabularyReferences: learningReferences.vocabularyReferences.filter(row => !row.targetId).length } };
  return payload;
}

function applyManifest(db, manifest, { assetRoot = defaultAssetRoot } = {}) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries) || !/^[a-f0-9]{64}$/.test(manifest.sourceDigest || '')) {
    throw Object.assign(new Error('迁移清单格式无效'), { code: 'INVALID_MIGRATION_MANIFEST' });
  }
  let added = 0, alreadyApplied = 0;
  db.transaction(() => {
    const current = buildManifest(db, { createdAt: manifest.createdAt, assetRoot });
    if (current.sourceDigest !== manifest.sourceDigest || JSON.stringify(current.entries) !== JSON.stringify(manifest.entries)) {
      throw Object.assign(new Error('源数据与预览清单不一致，未迁移任何内容'), { code: 'MIGRATION_SOURCE_CHANGED' });
    }
    const sourceRows = new Map();
    db.prepare(`SELECT user_id,id AS legacy_id,name,items_json,builtin,is_public,authoring_json FROM user_decks
      WHERE deleted_at IS NULL`).all().forEach(row => sourceRows.set(`deck:${row.user_id}:${row.legacy_id}`, {
        id: row.legacy_id, name: row.name, items: JSON.parse(row.items_json || '[]'), builtin: !!row.builtin,
        ...(row.authoring_json ? { authoring: JSON.parse(row.authoring_json) } : {})
      }));
    db.prepare(`SELECT user_id,course_id AS legacy_id,data_json FROM user_courses WHERE deleted_at IS NULL`).all()
      .forEach(row => sourceRows.set(`course:${row.user_id}:${row.legacy_id}`, JSON.parse(row.data_json)));
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='personal_wordbook_versions'").get()) {
      db.prepare('SELECT user_id,book_id,version,revision,package_json,created_at FROM personal_wordbook_versions ORDER BY user_id,book_id,version').all()
        .forEach(row => {
          const key = `wordbook:${row.user_id}:wordbook:${row.book_id}`;
          if (!sourceRows.has(key)) sourceRows.set(key, []);
          sourceRows.get(key).push(row);
        });
    }
    for (const entry of manifest.entries) {
      if (entry.inventory?.migrationBlockers?.length) {
        throw Object.assign(new Error(`课程“${entry.title}”存在无法安全迁移的素材引用`), { code: 'MIGRATION_ASSET_BYTES_UNAVAILABLE', blockers: entry.inventory.migrationBlockers });
      }
      const key = `deck:${entry.userId}:${entry.legacyId}`;
      const sourceKey = entry.family === 'vocabulary-book' ? `wordbook:${entry.userId}:${entry.legacyId}`
        : entry.kind === 'deck' ? key : `course:${entry.userId}:${entry.legacyId}`;
      const original = sourceRows.get(sourceKey);
      if (!original) throw Object.assign(new Error('迁移源行缺失：' + sourceKey), { code: 'MIGRATION_SOURCE_MISSING' });
      const prior = db.prepare(`SELECT course_id,source_hash FROM course_content_legacy_mappings
        WHERE source_user_id=? AND source_kind=? AND source_id=?`).get(entry.userId, entry.kind, entry.legacyId);
      if (prior) {
        if (prior.course_id !== entry.courseId || prior.source_hash !== entry.sourceHash) {
          throw Object.assign(new Error('已有映射与清单冲突：' + sourceKey), { code: 'MIGRATION_MAPPING_CONFLICT' });
        }
        alreadyApplied++;
        continue;
      }
      if (db.prepare('SELECT 1 FROM course_contents WHERE course_id=?').get(entry.courseId)) {
        throw Object.assign(new Error('目标课程 ID 已被占用：' + entry.courseId), { code: 'MIGRATION_TARGET_CONFLICT' });
      }
      const isWordbook = entry.family === 'vocabulary-book';
      const preparedAssets = isWordbook ? [] : prepareLegacyAssets(original, entry.courseId);
      const releases = isWordbook ? original.map(row => {
        const overrides = (entry.inventory.deliveryOverrides || []).filter(value => value.version === Number(row.version));
        return { sourceVersion: row.version,
          content: { contentFamily: 'vocabulary-book', contentFamilyVersion: 1, package: JSON.parse(row.package_json),
            ...(overrides.length ? { imageDelivery: Object.fromEntries(overrides.map(value => [value.itemId, value.images])) } : {}) } };
      })
        : [{ content: entry.kind === 'deck' ? { ...stripEmbeddedAssetData(original), id: entry.courseId }
          : { ...stripEmbeddedAssetData(original), courseId: entry.courseId }, assets: preparedAssets }];
      let activeRelease = '';
      const preparedReleases = releases.map(release => {
        const contentJson = JSON.stringify(release.content);
        const assets = release.assets || [];
        const contentHash = digest(JSON.stringify({ content: contentJson,
          assets: assets.map(({ assetId, sha256, mimeType }) => ({ assetId, sha256, mimeType })) }));
        activeRelease = contentHash;
        return { contentJson, contentHash, releaseId: contentHash, assets };
      });
      db.prepare(`INSERT INTO course_contents(course_id,kind,title,active_release,status,visibility,created_by)
        VALUES(?,?,?,?,'active',?,?)`).run(entry.courseId, entry.kind, entry.title, activeRelease, entry.visibility, entry.userId);
      for (const release of preparedReleases) {
      db.prepare(`INSERT INTO course_content_releases(course_id,release_id,content_hash,content_json)
        VALUES(?,?,?,?)`).run(entry.courseId, release.releaseId, release.contentHash, release.contentJson);
      const insertBlob = db.prepare(`INSERT INTO course_asset_blobs(sha256,mime_type,byte_length,content)
        VALUES(?,?,?,?) ON CONFLICT(sha256) DO NOTHING`);
      const linkAsset = db.prepare(`INSERT INTO course_content_release_assets(course_id,release_id,asset_id,sha256) VALUES(?,?,?,?)`);
      for (const asset of release.assets) {
        insertBlob.run(asset.sha256, asset.mimeType, asset.byteLength, asset.bytes);
        const stored = db.prepare('SELECT mime_type,byte_length,content FROM course_asset_blobs WHERE sha256=?').get(asset.sha256);
        if (!stored || stored.mime_type !== asset.mimeType || stored.byte_length !== asset.byteLength || !Buffer.from(stored.content).equals(asset.bytes)) {
          throw Object.assign(new Error('已有素材摘要对应的二进制不一致，迁移已停止'), { code: 'MIGRATION_ASSET_HASH_CONFLICT' });
        }
        linkAsset.run(entry.courseId, release.releaseId, asset.assetId, asset.sha256);
      }
      }
      db.prepare(`INSERT INTO course_content_access(course_id,subject_user_id,role) VALUES(?,?,'owner')`)
        .run(entry.courseId, entry.userId);
      db.prepare(`INSERT INTO course_content_legacy_mappings(source_user_id,source_kind,source_id,course_id,source_hash)
        VALUES(?,?,?,?,?)`).run(entry.userId, entry.kind, entry.legacyId, entry.courseId, entry.sourceHash);
      added++;
    }
  }).immediate();
  return { sourceDigest: manifest.sourceDigest, added, alreadyApplied, total: manifest.entries.length };
}

module.exports = { readLegacyContent, auditLearningReferences, buildManifest, applyManifest };
