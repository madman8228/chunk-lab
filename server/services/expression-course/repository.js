'use strict';
const crypto = require('node:crypto');

function createExpressionCourseRepository({ db, validatePackage, now = () => new Date().toISOString(), id = () => crypto.randomUUID() }) {
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  const fail = (message, code = 'INVALID_EXPRESSION_COURSE', status = 422) => Object.assign(new Error(message), { code, status });
  const parse = value => JSON.parse(value);
  function draftRow(draftId) { return db.prepare('SELECT * FROM expression_drafts WHERE draft_id=?').get(draftId); }
  function listDrafts() { return db.prepare('SELECT draft_id AS draftId, revision, updated_at AS updatedAt, json_extract(payload_json,\'$.title\') AS title FROM expression_drafts ORDER BY updated_at DESC').all(); }
  function getDraft(draftId) { const row = draftRow(draftId); if (!row) throw fail('制作草稿不存在', 'DRAFT_NOT_FOUND', 404); return { draftId: row.draft_id, revision: row.revision, package: parse(row.payload_json), reviewHash: row.review_hash }; }
  function receipt(adminId, requestId, payloadHash) {
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '')) throw fail('请求编号无效', 'INVALID_REQUEST', 400);
    const prior = db.prepare('SELECT payload_hash,result_json FROM expression_admin_receipts WHERE admin_id=? AND request_id=?').get(adminId, requestId);
    if (!prior) return null;
    if (prior.payload_hash !== payloadHash) throw fail('请求编号已用于其他操作', 'IDEMPOTENCY_CONFLICT', 409);
    return parse(prior.result_json);
  }
  function saveReceipt(adminId, requestId, payloadHash, result) {
    db.prepare('INSERT INTO expression_admin_receipts(admin_id,request_id,payload_hash,result_json) VALUES(?,?,?,?)')
      .run(adminId, requestId, payloadHash, JSON.stringify(result));
    return result;
  }
  function createDraft(payload, adminId, requestId) {
    if (!payload || Buffer.byteLength(JSON.stringify(payload)) > 2 * 1024 * 1024) throw fail('单词课文件不能超过 2 MiB', 'PACKAGE_TOO_LARGE', 413);
    const payloadHash = digest(JSON.stringify({ operation: 'create-draft', payload }));
    return db.transaction(() => {
      const prior = receipt(adminId, requestId, payloadHash); if (prior) return prior;
      const draftId = id();
      db.prepare('INSERT INTO expression_drafts(draft_id,revision,payload_json,updated_by) VALUES(?,1,?,?)').run(draftId, JSON.stringify(payload), adminId);
      return saveReceipt(adminId, requestId, payloadHash, { draftId, revision: 1, requestId });
    }).immediate();
  }
  function updateDraft(draftId, expectedRevision, payload, adminId, requestId) {
    if (!payload || Buffer.byteLength(JSON.stringify(payload)) > 2 * 1024 * 1024) throw fail('单词课文件不能超过 2 MiB', 'PACKAGE_TOO_LARGE', 413);
    const tx = db.transaction(() => {
      const payloadHash = digest(JSON.stringify({ operation: 'update-draft', draftId, expectedRevision, payload }));
      const prior = receipt(adminId, requestId, payloadHash); if (prior) return prior;
      const row = draftRow(draftId); if (!row) throw fail('制作草稿不存在', 'DRAFT_NOT_FOUND', 404);
      if (row.revision !== expectedRevision) throw fail('草稿已在其他窗口修改，请重新载入', 'REVISION_CONFLICT', 409);
      db.prepare("UPDATE expression_drafts SET payload_json=?, revision=revision+1, review_hash=NULL, updated_by=?, updated_at=? WHERE draft_id=? AND revision=?")
        .run(JSON.stringify(payload), adminId, now(), draftId, expectedRevision);
      return saveReceipt(adminId, requestId, payloadHash, getDraft(draftId));
    });
    return tx.immediate();
  }
  function deleteDraft(draftId, expectedRevision, adminId, requestId) {
    const tx = db.transaction(() => {
      const payloadHash = digest(JSON.stringify({ operation: 'delete-draft', draftId, expectedRevision }));
      const prior = receipt(adminId, requestId, payloadHash); if (prior) return prior;
      const row = draftRow(draftId); if (!row) throw fail('制作草稿不存在', 'DRAFT_NOT_FOUND', 404);
      if (row.revision !== expectedRevision) throw fail('草稿版本已变化，请重新载入', 'REVISION_CONFLICT', 409);
      db.prepare('DELETE FROM expression_drafts WHERE draft_id=?').run(draftId);
      return saveReceipt(adminId, requestId, payloadHash, { deleted: true, draftId });
    });
    return tx.immediate();
  }
  function uploadAsset({ assetId, mimeType, base64 }) {
    if (!/^[A-Za-z0-9:._-]{1,120}$/.test(assetId || '') || !['audio/mpeg','audio/ogg','audio/wav'].includes(mimeType) ||
        typeof base64 !== 'string' || base64.length > 7 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw fail('音频文件格式无效', 'INVALID_ASSET', 400);
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== base64) throw fail('音频文件为空或超过 5 MiB', 'ASSET_SIZE_LIMIT', 413);
    const valid = mimeType === 'audio/mpeg' ? bytes.subarray(0,3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224
      : mimeType === 'audio/ogg' ? bytes.subarray(0,4).toString() === 'OggS' : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WAVE';
    if (!valid) throw fail('文件实际音频格式与声明不一致', 'ASSET_MIME_MISMATCH', 422);
    const sha256 = digest(bytes);
    db.prepare('INSERT INTO expression_assets(sha256,mime_type,byte_length,content) VALUES(?,?,?,?) ON CONFLICT(sha256) DO NOTHING').run(sha256, mimeType, bytes.length, bytes);
    const saved = db.prepare('SELECT mime_type,byte_length FROM expression_assets WHERE sha256=?').get(sha256);
    if (saved.mime_type !== mimeType || saved.byte_length !== bytes.length) throw fail('同一摘要对应的素材信息不一致', 'ASSET_INTEGRITY_FAILURE', 503);
    return { assetId, sha256, mimeType, size: bytes.length };
  }
  function asset(assetId, expectedHash) {
    const row = db.prepare('SELECT sha256,mime_type AS mimeType,byte_length AS size,content FROM expression_assets WHERE sha256=?').get(expectedHash);
    if (!row || digest(row.content) !== expectedHash) throw fail('音频素材不存在或校验失败', 'ASSET_NOT_FOUND', 404);
    return { ...row, bytes: row.content };
  }
  function validate(draftId, { forPublish = true } = {}) {
    const draft = getDraft(draftId), pkg = draft.package;
    const uploaded = new Set((pkg.assets || []).filter(item => {
      const row = db.prepare('SELECT sha256,mime_type,byte_length FROM expression_assets WHERE sha256=?').get(item.sha256);
      return row && row.mime_type === item.mimeType && row.byte_length === item.size;
    }).map(item => item.assetId));
    const report = validatePackage(pkg, { forPublish, availableAssets: [...uploaded] });
    if (forPublish && Array.isArray(pkg.assets)) {
      for (const item of pkg.assets) if (!uploaded.has(item?.assetId)) report.errors.push(`/assets 缺少已上传并核验的音频 ${item?.assetId || ''}`);
      report.valid = report.errors.length === 0;
    }
    const contentHash = digest(JSON.stringify(pkg));
    return { draftId, revision: draft.revision, contentHash, valid: report.valid, errors: report.errors, uploadedAssetIds: [...uploaded] };
  }
  function review(draftId, contentHash) {
    const result = validate(draftId);
    if (!result.valid || result.contentHash !== contentHash) throw fail('内容已变化或校验未通过，请重新检查', 'REVIEW_HASH_MISMATCH', 409);
    db.prepare('UPDATE expression_drafts SET review_hash=? WHERE draft_id=? AND revision=?').run(contentHash, draftId, result.revision);
    return { draftId, reviewHash: contentHash, approved: true };
  }
  function publish(draftId, { expectedRevision, contentHash, requestId }, adminId) {
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId || '')) throw fail('发布请求编号无效', 'INVALID_REQUEST', 400);
    const payloadHash = digest(JSON.stringify({ draftId, expectedRevision, contentHash }));
    const tx = db.transaction(() => {
      const prior = db.prepare('SELECT payload_hash,result_json FROM expression_admin_receipts WHERE admin_id=? AND request_id=?').get(adminId, requestId);
      if (prior) { if (prior.payload_hash !== payloadHash) throw fail('请求编号已用于其他发布', 'IDEMPOTENCY_CONFLICT', 409); return parse(prior.result_json); }
      const draft = getDraft(draftId);
      if (draft.revision !== expectedRevision || draft.reviewHash !== contentHash) throw fail('草稿版本未审核或已经变化', 'REVIEW_REQUIRED', 409);
      const report = validate(draftId, { forPublish: true });
      if (!report.valid || report.contentHash !== contentHash) throw fail('已审核内容校验不通过', 'CONTENT_CHANGED', 409);
      const pkg = draft.package, releaseId = 'r-' + contentHash.slice(0, 20);
      const previous = db.prepare('SELECT active_release AS releaseId FROM expression_courses WHERE course_id=?').get(pkg.courseId);
      if (!previous) db.prepare("INSERT INTO expression_courses(course_id,title,description,status) VALUES(?,?,?,'active')").run(pkg.courseId, pkg.title, pkg.description || '');
      db.prepare('INSERT INTO expression_releases(course_id,release_id,content_hash,content_json,review_hash,created_by) VALUES(?,?,?,?,?,?) ON CONFLICT(course_id,release_id) DO NOTHING')
        .run(pkg.courseId, releaseId, contentHash, JSON.stringify(pkg), contentHash, adminId);
      for (const item of pkg.assets) db.prepare('INSERT INTO expression_release_assets(course_id,release_id,asset_id,sha256) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').run(pkg.courseId, releaseId, item.assetId, item.sha256);
      db.prepare("UPDATE expression_courses SET title=?,description=?,active_release=?,status='active' WHERE course_id=?").run(pkg.title, pkg.description || '', releaseId, pkg.courseId);
      const result = { courseId: pkg.courseId, releaseId, contentHash, previousReleaseId: previous?.releaseId || null };
      db.prepare('INSERT INTO expression_admin_receipts(admin_id,request_id,payload_hash,result_json) VALUES(?,?,?,?)').run(adminId, requestId, payloadHash, JSON.stringify(result));
      return result;
    });
    return tx.immediate();
  }
  function unlist(courseId, { requestId }, adminId) {
    const tx = db.transaction(() => {
      const payloadHash = digest(JSON.stringify({ courseId, operation: 'unlist' }));
      const prior = receipt(adminId, requestId, payloadHash); if (prior) return prior;
      const course = db.prepare('SELECT course_id FROM expression_courses WHERE course_id=?').get(courseId);
      if (!course) throw fail('课程不存在', 'EXPRESSION_COURSE_NOT_FOUND', 404);
      db.prepare("UPDATE expression_courses SET status='unlisted' WHERE course_id=?").run(courseId);
      return saveReceipt(adminId, requestId, payloadHash, { courseId, unlisted: true });
    }); return tx.immediate();
  }
  function catalog() { return db.prepare("SELECT course_id AS courseId,title,description,active_release AS releaseId FROM expression_courses WHERE status='active' ORDER BY created_at DESC").all(); }
  function adminCatalog() {
    return db.prepare('SELECT course_id AS courseId,title,description,active_release AS releaseId,status FROM expression_courses ORDER BY created_at DESC').all().map(course => {
      if (!course.releaseId) return { ...course, contentHash: null, package: null };
      const current = release(course.courseId, course.releaseId);
      return { ...course, contentHash: current.contentHash, package: current.package };
    });
  }
  function release(courseId, releaseId) {
    const row = db.prepare(`SELECT r.content_json AS contentJson,r.content_hash AS contentHash,c.status
      FROM expression_releases r JOIN expression_courses c USING(course_id) WHERE r.course_id=? AND r.release_id=?`).get(courseId, releaseId);
    if (!row) throw fail('课程版本不存在', 'RELEASE_NOT_FOUND', 404);
    return { ...row, package: parse(row.contentJson) };
  }
  function assetForRelease(courseId, releaseId, assetId) {
    const row = db.prepare(`SELECT a.sha256 FROM expression_release_assets a JOIN expression_courses c USING(course_id)
      WHERE a.course_id=? AND a.release_id=? AND a.asset_id=?`).get(courseId, releaseId, assetId);
    if (!row) throw fail('当前课程版本未引用此素材', 'ASSET_NOT_AUTHORIZED', 403);
    return asset(assetId, row.sha256);
  }
  function registryCourses({ includeUnlisted = false } = {}) {
    const courses = includeUnlisted ? db.prepare('SELECT course_id AS courseId,title,description,active_release AS releaseId,status FROM expression_courses ORDER BY created_at DESC').all() : catalog();
    return courses.filter(course => course.releaseId).map(course => {
      const pkg = release(course.courseId, course.releaseId).package;
      return { courseId: course.courseId, title: course.title, contentType: 'expression', releaseId: course.releaseId, defaultAccess: 'free', sourcePaths: [], legacyDeckIds: [],
        units: pkg.lessons.map(lesson => ({ unitId: 'lesson-' + lesson.lessonId, contentRef: { type: 'expression-lesson', id: lesson.lessonId },
          itemIds: lesson.activities.map(activity => activity.id), assets: pkg.assets.map(asset => ({ assetId: asset.assetId, mimeType: asset.mimeType })) })) };
    });
  }
  function findCourse(courseId) { return db.prepare('SELECT course_id AS courseId,title,description,active_release AS releaseId,status FROM expression_courses WHERE course_id=?').get(courseId) || null; }
  return { listDrafts, getDraft, createDraft, updateDraft, deleteDraft, uploadAsset, validate, review, publish, unlist, catalog, adminCatalog, release, assetForRelease, registryCourses, findCourse, fail };
}

module.exports = { createExpressionCourseRepository };
