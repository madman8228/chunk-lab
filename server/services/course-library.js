'use strict';

const crypto = require('node:crypto');
const imageDimensions = require('./membership/image-dimensions').imageDimensions;

function createCourseLibrary({ db, now = () => new Date().toISOString() }) {
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const fail = (message, code, status) => Object.assign(new Error(message), { code, status });

  function requestHash(kind, content, assets, sourceMapping) {
    const inventory = (assets || []).map(({ assetId, mimeType, base64, sha256, bytes }) => ({ assetId, mimeType, base64, sha256, bytes }))
      .sort((a, b) => String(a.assetId).localeCompare(String(b.assetId)));
    return hash(JSON.stringify({ kind, content, assets: inventory, ...(sourceMapping ? { sourceMapping } : {}) }));
  }
  function rebase(value, sourceId, targetId) {
    if (typeof value === 'string') return sourceId && (value === sourceId || value.startsWith(sourceId + ':')) ? targetId + value.slice(sourceId.length) : value;
    if (Array.isArray(value)) return value.map(item => rebase(item, sourceId, targetId));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebase(item, sourceId, targetId)]));
  }
  function prepareAssets(original, stored, input, sourceId) {
    if (!Array.isArray(input)) throw fail('课程素材清单无效', 'INVALID_COURSE_ASSETS', 400);
    const descriptors = Array.isArray(original.assets) ? original.assets : [];
    const references = new Set();
    (function walk(value) { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) return value.forEach(walk);
      for (const [key, child] of Object.entries(value)) { if ((key === 'imageAssetId' || key === 'audioAssetId') && typeof child === 'string') references.add(child); else walk(child); }
    })(original);
    if (references.size && !descriptors.length) throw fail('课程引用了未声明的素材', 'COURSE_ASSET_REFERENCE_MISSING', 422);
    const ids = descriptors.map(row => row && row.id);
    if (ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9:._-]{1,200}$/.test(id)) || new Set(ids).size !== ids.length ||
        [...references].some(id => !ids.includes(id)) || input.length !== descriptors.length) throw fail('课程素材清单与内容引用不一致', 'COURSE_ASSET_REFERENCE_MISSING', 422);
    const supplied = new Map(input.map(row => [row && row.assetId, row]));
    if (supplied.size !== input.length || input.some(row => !row || typeof row.assetId !== 'string')) throw fail('课程素材清单重复或无效', 'INVALID_COURSE_ASSETS', 400);
    let total = 0;
    return descriptors.map(descriptor => {
      const row = supplied.get(descriptor.id);
      if (!row || row.mimeType !== descriptor.mimeType || !/^[A-Za-z0-9+/]+={0,2}$/.test(row.base64 || '') ||
          !/^[a-f0-9]{64}$/.test(row.sha256 || '') || !Number.isSafeInteger(row.bytes)) throw fail('课程素材数据缺失或格式无效', 'INVALID_COURSE_ASSET', 422);
      const bytes = Buffer.from(row.base64, 'base64');
      if (!bytes.length || bytes.length !== row.bytes || bytes.toString('base64') !== row.base64 || hash(bytes) !== row.sha256) throw fail('课程素材长度或摘要校验失败', 'COURSE_ASSET_INTEGRITY_FAILURE', 422);
      const type = row.mimeType;
      const image = type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
        type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
        type === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      const audio = type === 'audio/mpeg' && (bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224) ||
        type === 'audio/ogg' && bytes.toString('ascii', 0, 4) === 'OggS' ||
        type === 'audio/wav' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
      if (!image && !audio) throw fail('课程素材真实格式与声明不一致', 'COURSE_ASSET_MIME_MISMATCH', 422);
      if (image) {
        const dimensions = imageDimensions(bytes, type);
        if (bytes.length > 2 * 1024 * 1024 || !dimensions || dimensions.some(n => n < 1 || n > 4096) || dimensions[0] * dimensions[1] > 12000000) throw fail('课程图片尺寸或大小超出限制', 'COURSE_IMAGE_LIMIT_EXCEEDED', 413);
      } else if (bytes.length > 10 * 1024 * 1024) throw fail('课程音频超过 10 MiB', 'COURSE_AUDIO_LIMIT_EXCEEDED', 413);
      total += bytes.length;
      if (total > 24 * 1024 * 1024) throw fail('课程素材总大小超过 24 MiB', 'COURSE_ASSETS_TOO_LARGE', 413);
      const targetId = sourceId && stored.courseId ? rebase(descriptor.id, sourceId, stored.courseId) : descriptor.id;
      return { assetId: targetId, sha256: row.sha256, mimeType: type, byteLength: bytes.length, bytes };
    });
  }
  function saveAssets(courseId, releaseId, assets) {
    const putBlob = db.prepare(`INSERT INTO course_asset_blobs(sha256,mime_type,byte_length,content)
      VALUES(?,?,?,?) ON CONFLICT(sha256) DO NOTHING`);
    const verifyBlob = db.prepare('SELECT mime_type,byte_length FROM course_asset_blobs WHERE sha256=?');
    const link = db.prepare('INSERT INTO course_content_release_assets(course_id,release_id,asset_id,sha256) VALUES(?,?,?,?)');
    for (const asset of assets) {
      putBlob.run(asset.sha256, asset.mimeType, asset.byteLength, asset.bytes);
      const existing = verifyBlob.get(asset.sha256);
      if (!existing || existing.mime_type !== asset.mimeType || existing.byte_length !== asset.byteLength) throw fail('素材摘要冲突，未覆盖已有课程素材', 'COURSE_ASSET_HASH_CONFLICT', 409);
      link.run(courseId, releaseId, asset.assetId, asset.sha256);
    }
  }

  function importContent(userId, { requestId, kind, content, assets = [], sourceMapping }) {
    if (!Number.isSafeInteger(userId) || userId < 1 || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId || '') ||
        !['deck', 'course'].includes(kind) || !content || typeof content !== 'object' || Array.isArray(content)) {
      throw fail('独立课程导入请求无效', 'INVALID_COURSE_IMPORT', 400);
    }
    if (sourceMapping && (typeof sourceMapping !== 'object' || Array.isArray(sourceMapping) ||
        Object.keys(sourceMapping).some(key => !['kind', 'sourceId'].includes(key)) ||
        !['deck', 'course'].includes(sourceMapping.kind) || typeof sourceMapping.sourceId !== 'string' ||
        !sourceMapping.sourceId.trim() || sourceMapping.sourceId.length > 200)) {
      throw fail('课程来源映射无效', 'INVALID_COURSE_SOURCE_MAPPING', 400);
    }
    const requestHashValue = requestHash(kind, content, assets, sourceMapping);
    const inputJson = JSON.stringify(content);
    if (Buffer.byteLength(inputJson) > 80 * 1024 * 1024) throw fail('课程内容超过 80 MiB', 'COURSE_TOO_LARGE', 413);
    const prior = db.prepare('SELECT payload_hash,result_json FROM course_content_import_receipts WHERE user_id=? AND request_id=?')
      .get(userId, requestId);
    if (prior) {
      if (prior.payload_hash !== requestHashValue) throw fail('同一请求编号不能用于不同内容', 'IDEMPOTENCY_CONFLICT', 409);
      return { ...JSON.parse(prior.result_json), replay: true };
    }
    const courseId = 'private-' + crypto.randomUUID();
    const sourceId = kind === 'course' && typeof content.courseId === 'string' ? content.courseId : '';
    const storedContent = kind === 'deck' ? { ...content, id: courseId } : { ...rebase(content, sourceId, courseId), courseId };
    const preparedAssets = prepareAssets(content, storedContent, assets, sourceId);
    const json = JSON.stringify(storedContent);
    const contentHash = hash(JSON.stringify({ content: json, assets: preparedAssets.map(({ assetId, sha256, mimeType }) => ({ assetId, sha256, mimeType })) }));
    const releaseId = contentHash;
    const title = String(content.title || content.name || content.package?.index?.books?.[0]?.title || '').trim().slice(0, 240) || '未命名课程';
    const result = { courseId, kind, title, releaseId, contentHash };
    return db.transaction(() => {
      const raced = db.prepare('SELECT payload_hash,result_json FROM course_content_import_receipts WHERE user_id=? AND request_id=?')
        .get(userId, requestId);
      if (raced) {
        if (raced.payload_hash !== requestHashValue) throw fail('同一请求编号不能用于不同内容', 'IDEMPOTENCY_CONFLICT', 409);
        return { ...JSON.parse(raced.result_json), replay: true };
      }
      if (sourceMapping) {
        const mapping = db.prepare(`SELECT course_id FROM course_content_legacy_mappings
          WHERE source_user_id=? AND source_kind=? AND source_id=?`).get(userId, sourceMapping.kind, sourceMapping.sourceId);
        if (mapping) throw fail('此账号的旧课程来源已映射到另一份独立课程，原内容保持不变。', 'COURSE_SOURCE_MAPPING_CONFLICT', 409);
      }
      db.prepare(`INSERT INTO course_contents(course_id,kind,title,active_release,status,visibility,created_by,created_at)
        VALUES(?,?,?,?,'active','private',?,?)`).run(courseId, kind, title, releaseId, userId, now());
      db.prepare(`INSERT INTO course_content_releases(course_id,release_id,content_hash,content_json,created_at)
        VALUES(?,?,?,?,?)`).run(courseId, releaseId, contentHash, json, now());
      saveAssets(courseId, releaseId, preparedAssets);
      db.prepare(`INSERT INTO course_content_access(course_id,subject_user_id,role,created_at)
        VALUES(?,?,'owner',?)`).run(courseId, userId, now());
      if (sourceMapping) db.prepare(`INSERT INTO course_content_legacy_mappings(source_user_id,source_kind,source_id,course_id,source_hash,created_at)
        VALUES(?,?,?,?,?,?)`).run(userId, sourceMapping.kind, sourceMapping.sourceId, courseId, hash(inputJson), now());
      db.prepare(`INSERT INTO course_content_import_receipts(user_id,request_id,payload_hash,result_json,created_at)
        VALUES(?,?,?,?,?)`).run(userId, requestId, requestHashValue, JSON.stringify(result), now());
      return result;
    }).immediate();
  }

  function catalog(userId) {
    const courses = db.prepare(`SELECT c.course_id AS courseId,c.kind,c.title,c.visibility,c.active_release AS releaseId,r.content_hash AS contentHash,r.content_json AS contentJson
      FROM course_contents c LEFT JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
      JOIN course_content_releases r ON r.course_id=c.course_id AND r.release_id=c.active_release
      WHERE c.status='active' AND (c.visibility='public' OR a.subject_user_id IS NOT NULL) ORDER BY c.created_at DESC,c.course_id`).all(userId);
    const aliases = db.prepare(`SELECT course_id AS courseId,source_kind AS sourceKind,source_id AS sourceId
      FROM course_content_legacy_mappings WHERE source_user_id=? ORDER BY source_kind,source_id`).all(userId);
    const vocabularyCourses = new Set(db.prepare("SELECT course_id FROM course_content_legacy_mappings WHERE source_kind='course' AND source_id LIKE 'wordbook:%'")
      .all().map(row => row.course_id));
    const byCourse = new Map();
    for (const alias of aliases) {
      if (!byCourse.has(alias.courseId)) byCourse.set(alias.courseId, []);
      byCourse.get(alias.courseId).push(alias.sourceId.startsWith('wordbook:')
        ? alias.sourceId
        : alias.sourceKind === 'deck' ? 'course:user-deck:' + alias.sourceId : 'course:' + alias.sourceId);
    }
    return courses.flatMap(course => {
      if (vocabularyCourses.has(course.courseId)) return [];
      const { contentJson, ...metadata } = course;
      return [{ ...metadata, legacyResourceIds: byCourse.get(course.courseId) || [] }];
    });
  }

  function canRead(userId, courseId) {
    return !!db.prepare(`SELECT 1 FROM course_contents c LEFT JOIN course_content_access a
      ON a.course_id=c.course_id AND a.subject_user_id=?
      WHERE c.course_id=? AND c.status='active' AND (c.visibility='public' OR a.subject_user_id IS NOT NULL) LIMIT 1`).get(userId, courseId);
  }

  function resolveLegacy(userId, sourceKind, sourceId) {
    const row = db.prepare(`SELECT m.course_id AS courseId FROM course_content_legacy_mappings m
      JOIN course_contents c ON c.course_id=m.course_id
      LEFT JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
      WHERE m.source_user_id=? AND m.source_kind=? AND m.source_id=? AND c.status='active'
        AND (c.visibility='public' OR a.subject_user_id IS NOT NULL)`).get(userId, userId, sourceKind, sourceId);
    return row?.courseId || null;
  }

  function legacyMappings(userId, sourceKind, prefix = '') {
    return db.prepare(`SELECT m.source_id AS sourceId,m.course_id AS courseId FROM course_content_legacy_mappings m
      JOIN course_contents c ON c.course_id=m.course_id
      LEFT JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
      WHERE m.source_user_id=? AND m.source_kind=? AND m.source_id LIKE ? AND c.status='active'
        AND (c.visibility='public' OR a.subject_user_id IS NOT NULL) ORDER BY m.source_id`).all(userId, userId, sourceKind, prefix + '%');
  }

  function history(userId, courseId) {
    if (!canRead(userId, courseId)) throw fail('课程不存在或无权访问', 'COURSE_NOT_AVAILABLE', 404);
    return db.prepare(`SELECT r.release_id AS releaseId,r.content_hash AS contentHash,r.content_json AS contentJson,r.created_at AS createdAt
      FROM course_content_releases r WHERE r.course_id=? ORDER BY r.rowid`).all(courseId)
      .map(row => ({ releaseId: row.releaseId, contentHash: row.contentHash, createdAt: row.createdAt, content: JSON.parse(row.contentJson) }));
  }

  function restoreVocabularyHistory(userId, bookId, rows) {
    if (!Number.isSafeInteger(userId) || userId < 1 || !/^personal-book:[a-f0-9]{32}$/.test(bookId || '') || !Array.isArray(rows) || !rows.length) {
      throw fail('词书恢复内容无效', 'INVALID_WORDBOOK_RESTORE', 400);
    }
    const prepared = rows.map(row => {
      const book = row?.package?.index?.books?.[0];
      if (!book || row.package.index.books.length !== 1 || book.bookId !== bookId || book.revision !== row.revision ||
          typeof row.createdAt !== 'string' || !row.createdAt || !Array.isArray(row.package.items)) {
        throw fail('词书恢复版本或时间字段无法核对', 'INVALID_WORDBOOK_RESTORE', 422);
      }
      const content = { contentFamily: 'vocabulary-book', contentFamilyVersion: 1, package: row.package,
        ...(row.imageDelivery ? { imageDelivery: row.imageDelivery } : {}) };
      const contentJson = JSON.stringify(content), contentHash = hash(JSON.stringify({ content: contentJson, assets: [] }));
      return { contentJson, contentHash, releaseId: contentHash, createdAt: row.createdAt };
    });
    if (new Set(prepared.map(row => row.releaseId)).size !== prepared.length) throw fail('词书恢复包含重复版本', 'INVALID_WORDBOOK_RESTORE', 422);
    const sourceId = 'wordbook:' + bookId, courseId = 'private-' + crypto.randomUUID(), latest = rows.at(-1).package.index.books[0];
    return db.transaction(() => {
      if (db.prepare(`SELECT 1 FROM course_content_legacy_mappings WHERE source_user_id=? AND source_kind='course' AND source_id=?`).get(userId, sourceId)) {
        throw fail('此词书已存在独立内容，恢复未覆盖任何内容', 'COURSE_SOURCE_MAPPING_CONFLICT', 409);
      }
      const activeRelease = prepared.at(-1).releaseId;
      db.prepare(`INSERT INTO course_contents(course_id,kind,title,active_release,status,visibility,created_by,created_at)
        VALUES(?,'course',?,?,'active','private',?,?)`).run(courseId, latest.title || '未命名单词本', activeRelease, userId, prepared[0].createdAt);
      const insert = db.prepare('INSERT INTO course_content_releases(course_id,release_id,content_hash,content_json,created_at) VALUES(?,?,?,?,?)');
      for (const release of prepared) insert.run(courseId, release.releaseId, release.contentHash, release.contentJson, release.createdAt);
      db.prepare("INSERT INTO course_content_access(course_id,subject_user_id,role,created_at) VALUES(?,?,'owner',?)").run(courseId, userId, prepared[0].createdAt);
      db.prepare(`INSERT INTO course_content_legacy_mappings(source_user_id,source_kind,source_id,course_id,source_hash,created_at)
        VALUES(?,'course',?,?,?,?)`).run(userId, sourceId, courseId, hash(JSON.stringify(rows)), prepared[0].createdAt);
      return { courseId };
    }).immediate();
  }

  function updateContent(userId, { courseId, requestId, expectedRelease, kind, content, assets = [] }) {
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof courseId !== 'string' || !courseId ||
        !/^[A-Za-z0-9_-]{16,100}$/.test(requestId || '') || !/^[a-f0-9]{64}$/.test(expectedRelease || '') ||
        !['deck', 'course'].includes(kind) || !content || typeof content !== 'object' || Array.isArray(content)) {
      throw fail('课程版本更新请求无效', 'INVALID_COURSE_UPDATE', 400);
    }
    const inputJson = JSON.stringify(content);
    if (Buffer.byteLength(inputJson) > 80 * 1024 * 1024) throw fail('课程内容超过 80 MiB', 'COURSE_TOO_LARGE', 413);
    const requestHashValue = hash(JSON.stringify({ operation: 'release', courseId, expectedRelease, payload: requestHash(kind, content, assets) }));
    const prior = db.prepare('SELECT payload_hash,result_json FROM course_content_import_receipts WHERE user_id=? AND request_id=?')
      .get(userId, requestId);
    if (prior) {
      if (prior.payload_hash !== requestHashValue) throw fail('同一请求编号不能用于不同操作', 'IDEMPOTENCY_CONFLICT', 409);
      return { ...JSON.parse(prior.result_json), replay: true };
    }
    const sourceId = kind === 'course' && typeof content.courseId === 'string' ? content.courseId : '';
    const storedContent = kind === 'deck' ? { ...content, id: courseId } : { ...rebase(content, sourceId, courseId), courseId };
    const preparedAssets = prepareAssets(content, storedContent, assets, sourceId);
    const json = JSON.stringify(storedContent);
    const contentHash = hash(JSON.stringify({ content: json, assets: preparedAssets.map(({ assetId, sha256, mimeType }) => ({ assetId, sha256, mimeType })) }));
    const title = String(content.title || content.name || content.package?.index?.books?.[0]?.title || '').trim().slice(0, 240) || '未命名课程';
    return db.transaction(() => {
      const raced = db.prepare('SELECT payload_hash,result_json FROM course_content_import_receipts WHERE user_id=? AND request_id=?')
        .get(userId, requestId);
      if (raced) {
        if (raced.payload_hash !== requestHashValue) throw fail('同一请求编号不能用于不同操作', 'IDEMPOTENCY_CONFLICT', 409);
        return { ...JSON.parse(raced.result_json), replay: true };
      }
      const row = db.prepare(`SELECT c.kind,c.active_release,c.title,a.role FROM course_contents c
        JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
        WHERE c.course_id=? AND c.status='active'`).get(userId, courseId);
      if (!row || !['owner', 'editor'].includes(row.role)) throw fail('课程不存在或无编辑权限', 'COURSE_NOT_EDITABLE', 404);
      if (row.kind !== kind) throw fail('课程类型不能在版本更新时改变', 'COURSE_KIND_IMMUTABLE', 409);
      if (row.active_release !== expectedRelease) throw fail('课程已被其他编辑更新，请先重新读取', 'COURSE_RELEASE_CONFLICT', 409);

      let releaseId = contentHash;
      if (contentHash === expectedRelease) releaseId = expectedRelease;
      else {
        const priorRelease = db.prepare('SELECT release_id FROM course_content_releases WHERE course_id=? AND content_hash=?')
          .get(courseId, contentHash);
        if (priorRelease) releaseId = priorRelease.release_id;
        else {
          db.prepare(`INSERT INTO course_content_releases(course_id,release_id,content_hash,content_json,created_at)
            VALUES(?,?,?,?,?)`).run(courseId, releaseId, contentHash, json, now());
          saveAssets(courseId, releaseId, preparedAssets);
        }
      }

      if (releaseId !== expectedRelease) {
        const updated = db.prepare(`UPDATE course_contents SET active_release=?,title=?
          WHERE course_id=? AND active_release=?`).run(releaseId, title, courseId, expectedRelease);
        if (updated.changes !== 1) throw fail('课程已被其他编辑更新，请先重新读取', 'COURSE_RELEASE_CONFLICT', 409);
      }
      const result = { courseId, kind, title, releaseId, contentHash, changed: releaseId !== expectedRelease };
      db.prepare(`INSERT INTO course_content_import_receipts(user_id,request_id,payload_hash,result_json,created_at)
        VALUES(?,?,?,?,?)`).run(userId, requestId, requestHashValue, JSON.stringify(result), now());
      return result;
    }).immediate();
  }

  function read(userId, courseId, releaseId) {
    const row = db.prepare(`SELECT c.kind,c.title,r.release_id AS releaseId,r.content_hash AS contentHash,r.content_json AS contentJson
      FROM course_contents c LEFT JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
      JOIN course_content_releases r ON r.course_id=c.course_id AND r.release_id=COALESCE(?,c.active_release)
      WHERE c.course_id=? AND c.status='active' AND (c.visibility='public' OR a.subject_user_id IS NOT NULL)`)
      .get(userId, releaseId || null, courseId);
    if (!row) throw fail('课程不存在或无权访问', 'COURSE_NOT_AVAILABLE', 404);
    return { courseId, kind: row.kind, title: row.title, releaseId: row.releaseId,
      contentHash: row.contentHash, content: JSON.parse(row.contentJson) };
  }

  function readAsset(userId, courseId, assetId, releaseId) {
    const row = db.prepare(`SELECT b.mime_type AS mimeType,b.byte_length AS byteLength,b.content,x.sha256
      FROM course_contents c LEFT JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
      JOIN course_content_releases r ON r.course_id=c.course_id AND r.release_id=COALESCE(?,c.active_release)
      JOIN course_content_release_assets x ON x.course_id=r.course_id AND x.release_id=r.release_id
      JOIN course_asset_blobs b ON b.sha256=x.sha256
      WHERE c.course_id=? AND x.asset_id=? AND c.status='active' AND (c.visibility='public' OR a.subject_user_id IS NOT NULL)`)
      .get(userId, releaseId || null, courseId, assetId);
    if (!row) throw fail('课程素材不存在或无权访问', 'COURSE_ASSET_NOT_AVAILABLE', 404);
    const bytes = Buffer.from(row.content);
    if (bytes.length !== row.byteLength || hash(bytes) !== row.sha256) throw fail('课程素材完整性校验失败', 'COURSE_ASSET_INTEGRITY_FAILURE', 503);
    return { mimeType: row.mimeType, bytes };
  }

  function readBatch(userId, courseId, { cursor = 0, releaseId } = {}) {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw fail('课程位置无效', 'INVALID_CURSOR', 400);
    const result = read(userId, courseId, releaseId);
    const { content } = result;
    const packageCourse = Array.isArray(content.sequence) && Array.isArray(content.utterances);
    const utterances = packageCourse ? new Map(content.utterances.map(item => [item.id, item])) : null;
    const items = packageCourse ? content.sequence.map(id => utterances.get(id)).filter(Boolean) : Array.isArray(content.items) ? content.items : null;
    if (!items) throw fail('此课程格式尚不支持分批学习读取', 'COURSE_FORMAT_UNSUPPORTED', 422);
    if (!items.length || cursor >= items.length) throw fail('课程位置超出范围', 'INVALID_CURSOR', 400);
    const recordIdentity = packageCourse ? { deckId: courseId, generationScope: 'course:' + courseId, resumeIdentity: courseId } : (() => {
      const legacy = db.prepare(`SELECT source_id AS sourceId FROM course_content_legacy_mappings
        WHERE source_user_id=? AND source_kind IN ('deck','course') AND course_id=? ORDER BY CASE source_kind WHEN 'deck' THEN 0 ELSE 1 END LIMIT 1`).get(userId, courseId);
      const deckId = legacy?.sourceId || courseId;
      return { deckId, generationScope: 'course:' + deckId, resumeIdentity: deckId };
    })();
    const sourceAuthoring = content.authoring;
    const authoring = sourceAuthoring && sourceAuthoring.template === 'sentence-practice' && sourceAuthoring.templateVersion === 1
      ? { template: sourceAuthoring.template, templateVersion: sourceAuthoring.templateVersion,
        contentForm: sourceAuthoring.contentForm, learning: sourceAuthoring.learning,
        roles: Array.isArray(sourceAuthoring.roles) ? sourceAuthoring.roles : [] }
      : null;
    const contentType = packageCourse && (content.assets || []).some(asset => asset.mimeType && asset.mimeType.startsWith('image/')) ? 'image-text' : 'sentence';
    const batchSize = contentType === 'image-text' ? 1 : 10;
    const selected = [];
    for (const source of items.slice(cursor, cursor + batchSize)) {
      const item = packageCourse ? { ...source, ...(source.text ? { text: source.text } : {}), cid: source.id,
        sentence: source.text && source.text.en || source.en, translation: source.text && source.text['zh-CN'] || source.translation || '' } : source;
      const sentence = item.sentence || item.sent || item.en;
      if (typeof sentence !== 'string' || !sentence.trim()) throw fail('课程句子内容无效', 'COURSE_CONTENT_INVALID', 422);
      const cid = item.cid || item.id;
      if (typeof cid !== 'string' || !cid) throw fail('课程条目缺少稳定 ID', 'COURSE_ITEM_ID_MISSING', 422);
      const projected = { ...item, cid, sentence };
      const attempt = JSON.stringify({ courseId, unitId: 'default', contentType, cursor, items: [...selected, projected],
        nextCursor: null, assetIds: [], recordIdentity });
      if (Buffer.byteLength(attempt) > 128 * 1024) {
        if (!selected.length) throw fail('单条课程内容超过分批读取限制', 'COURSE_ITEM_TOO_LARGE', 422);
        break;
      }
      selected.push(projected);
    }
    const assetIds = [...new Set(selected.flatMap(item => [item.imageAssetId, item.audioAssetId]).filter(Boolean))];
    return {
      courseId, unitId: 'default', kind: result.kind, title: result.title,
      contentVersion: result.releaseId,
      recordIdentity,
      batch: { courseId, unitId: 'default', contentType, cursor, items: selected,
        nextCursor: cursor + selected.length < items.length ? cursor + selected.length : null,
        assetIds, recordIdentity, ...(authoring ? { context: { authoring } } : {}) },
      itemCount: items.length
    };
  }

  return { importContent, updateContent, catalog, canRead, resolveLegacy, legacyMappings, history, restoreVocabularyHistory, read, readAsset, readBatch };
}

module.exports = { createCourseLibrary };
