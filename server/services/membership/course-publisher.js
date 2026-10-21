'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { compilePublication } = require('./publication-compiler.cjs');
const { imageDimensions } = require('./image-dimensions');
const { StaticFragmentBuilder } = require('./static-fragment-builder');
const { deckIdentity } = require('./assessment-content');
const fail = (message, code = 'INVALID_PUBLICATION', status = 422) => Object.assign(new Error(message), { code, status });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function createCoursePublisher({ db, registry, courseAccess, now = Date.now }) {
  function receipt(adminId, requestId, payloadHash) {
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId || '')) throw fail('请求编号无效');
    const row = db.prepare('SELECT payload_hash,result_json FROM membership_admin_mutation_receipts WHERE admin_id=? AND request_id=?').get(adminId, requestId);
    if (row && row.payload_hash !== payloadHash) throw fail('同一请求不能改换内容', 'IDEMPOTENCY_CONFLICT', 409);
    return row ? { ...JSON.parse(row.result_json), replay: true } : null;
  }
  function saveReceipt(adminId, requestId, payloadHash, result) {
    db.prepare('INSERT INTO membership_admin_mutation_receipts(admin_id,request_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)')
      .run(adminId, requestId, payloadHash, JSON.stringify(result), now());
  }
  function prepare(input, adminId) {
    if (!input || Buffer.byteLength(JSON.stringify(input)) > 12 * 1024 * 1024) throw fail('课程上传超过 12 MiB');
    const payloadHash = hash(JSON.stringify({ operation: 'publication-prepare', draft: input.draft, images: input.images }));
    const prior = receipt(adminId, input.requestId, payloadHash); if (prior) return prior;
    registry.snapshot();
    if (!Array.isArray(input.images) || input.images.length > 12) throw fail('配图最多 12 张');
    let total = 0;
    const names = new Set();
    const images = input.images.map(file => {
      if (!file || typeof file.name !== 'string' || !/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(file.name) || names.has(file.name.toLowerCase()) ||
          typeof file.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw fail('配图文件名或编码无效');
      names.add(file.name.toLowerCase());
      const bytes = Buffer.from(file.base64, 'base64'); total += bytes.length;
      if (!bytes.length || bytes.length > 2 * 1024 * 1024 || total > 8 * 1024 * 1024) throw fail('单图不能超过 2 MiB，总图不能超过 8 MiB');
      const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
      const mimeType = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : '';
      const extension = png ? 'png' : jpeg ? 'jpg' : 'webp';
      if (!mimeType || mimeType !== file.mimeType || !(png ? /\.png$/i : jpeg ? /\.jpe?g$/i : /\.webp$/i).test(file.name)) throw fail('配图实际格式与文件声明不符');
      const dimensions = imageDimensions(bytes, mimeType);
      if (!dimensions || dimensions.some(value => value < 1 || value > 4096) || dimensions[0] * dimensions[1] > 12000000) throw fail('配图尺寸无效或超过限制（最长边 4096，最多 1200 万像素）');
      return { name: file.name, size: bytes.length, mimeType, extension, sha256: hash(bytes), base64: file.base64 };
    });
    const courseId = 'ai-' + crypto.randomUUID();
    const compiled = { ...compilePublication(input.draft, images, courseId), images, courseId };
    const compiledJson = JSON.stringify(compiled), contentHash = hash(compiledJson);
    return db.transaction(() => {
      const replay = receipt(adminId, input.requestId, payloadHash); if (replay) return replay;
      db.prepare("INSERT INTO membership_course_publications(publication_id,admin_id,status,compiled_json,content_hash,created_at) VALUES(?,?,'draft',?,?,?)")
        .run(courseId, adminId, compiledJson, contentHash, now());
      const result = { publicationId: courseId, contentHash, registryVersion: registry.snapshot().version,
        title: compiled.title, contentType: compiled.contentType, itemCount: (compiled.content.items || compiled.content.utterances).length,
        imageCount: images.length, issues: compiled.issues };
      saveReceipt(adminId, input.requestId, payloadHash, result); return result;
    }).immediate();
  }
  function publish(input, adminId) {
    const payloadHash = hash(JSON.stringify({ operation: 'publication-publish', ...input }));
    return db.transaction(() => {
      const replay = receipt(adminId, input.requestId, payloadHash); if (replay) return replay;
      if (!['free', 'member'].includes(input.accessLevel)) throw fail('请选择免费或会员课程');
      const row = db.prepare('SELECT * FROM membership_course_publications WHERE publication_id=?').get(input.publicationId);
      if (!row || row.status !== 'draft' || row.content_hash !== input.contentHash) throw fail('草稿状态已变化，请重新校验', 'REVISION_CONFLICT', 409);
      const snapshot = registry.snapshot();
      if (snapshot.version !== input.registryVersion) throw fail('课程目录已变化，请重新校验', 'REGISTRY_CHANGED', 409);
      const compiled = JSON.parse(row.compiled_json);
      if (compiled.issues.some(issue => issue.severity === 'warning') && input.acceptWarnings !== true) throw fail('请先审阅并确认校验提醒', 'WARNINGS_REQUIRE_REVIEW');
      const root = registry.protectedRoot;
      fs.mkdirSync(root, { recursive: true });
      const manifestFile = path.join(root, 'registry.json');
      if (!fs.existsSync(manifestFile)) fs.writeFileSync(manifestFile, JSON.stringify({ schemaVersion: 1, courses: [] }), { flag: 'wx' });
      registry.file('registry.json');
      const folder = 'published-' + compiled.courseId;
      fs.mkdirSync(path.join(root, folder), { recursive: true });
      if (fs.lstatSync(path.join(root, folder)).isSymbolicLink()) throw fail('私有发布目录无效', 'CONTENT_FILE_CONFLICT', 503);
      function put(name, bytes) {
        const target = path.join(root, folder, name);
        if (fs.existsSync(target)) {
          if (fs.lstatSync(target).isSymbolicLink() || fs.statSync(target).nlink > 1 || hash(fs.readFileSync(registry.file(folder + '/' + name))) !== hash(bytes)) throw fail('私有文件不一致，未覆盖原文件', 'CONTENT_FILE_CONFLICT', 503);
        }
        else fs.writeFileSync(target, bytes, { flag: 'wx' });
        return folder + '/' + name;
      }
      const contentFile = put('content.json', Buffer.from(JSON.stringify(compiled.content)));
      const assets = compiled.assets.map((asset, index) => {
        const image = compiled.images.find(image => image.name === asset.name);
        const bytes = Buffer.from(image.base64, 'base64');
        return { assetId: asset.assetId, mimeType: asset.mimeType, sha256: hash(bytes), size: bytes.length,
          file: put('image-' + index + '.' + image.extension, bytes) };
      });
      const entries = compiled.content.items || compiled.content.utterances;
      const recordId = deckIdentity(compiled.courseId, 'lesson-1');
      const recordIdentity = { deckId: recordId, generationScope: 'course:' + compiled.courseId, resumeIdentity: recordId };
      const built = new StaticFragmentBuilder().build({ courseId: compiled.courseId, unitId: 'lesson-1', contentType: compiled.contentType,
        content: compiled.content, itemIds: entries.map(item => item.cid || item.id), assets, recordIdentity });
      const fragments = built.fragments.map(fragment => ({ ...fragment, file: put(fragment.file, built.files.find(file => file.name === fragment.file).bytes) }));
      const entry = { courseId: compiled.courseId, title: compiled.title, contentType: compiled.contentType, defaultAccess: 'free', sourcePaths: [], legacyDeckIds: [],
        units: [{ unitId: 'lesson-1', file: contentFile, contentRef: { type: compiled.contentType === 'sentence' ? 'sentence-deck' : 'story-package', id: compiled.courseId },
          itemIds: entries.map(item => item.cid || item.id), assets, fragments, contentVersion: built.contentVersion, recordIdentity }] };
      db.prepare(`INSERT INTO membership_content_publication_revisions
        (publication_id,revision,previous_registry_hash,registry_entry_hash,source_manifest_json,files_json,changed_by,created_at)
        VALUES(?,1,?,?,?,?,?,?)`).run(compiled.courseId, snapshot.version, hash(JSON.stringify(entry)),
        JSON.stringify({ kind: 'validated-ai-draft', contentHash: row.content_hash, recordIdentity }),
        JSON.stringify([...fragments, ...assets].map(({ file, sha256, size }) => ({ file, sha256, size }))), adminId, now());
      db.prepare("UPDATE membership_course_publications SET status='published',registry_entry_json=?,published_at=? WHERE publication_id=? AND status='draft'")
        .run(JSON.stringify(entry), now(), compiled.courseId);
      const policyRequestId = hash('publication-policy:' + adminId + ':' + input.requestId);
      courseAccess.publish({ changes: [{ courseId: compiled.courseId, baseRevision: 0, accessLevel: input.accessLevel }],
        registryVersion: registry.snapshot().version, requestId: policyRequestId, reason: '管理员发布新平台课程' }, adminId);
      const result = { published: true, courseId: compiled.courseId, accessLevel: input.accessLevel };
      saveReceipt(adminId, input.requestId, payloadHash, result); return result;
    }).immediate();
  }
  function inspect(publicationId) {
    const row = db.prepare('SELECT * FROM membership_course_publications WHERE publication_id=?').get(publicationId);
    if (!row) throw fail('草稿不存在', 'PUBLICATION_NOT_FOUND', 404);
    const compiled = JSON.parse(row.compiled_json);
    return { publicationId: row.publication_id, status: row.status, contentHash: row.content_hash, registryVersion: registry.snapshot().version,
      title: compiled.title, contentType: compiled.contentType, itemCount: (compiled.content.items || compiled.content.utterances).length,
      imageCount: compiled.images.length, issues: compiled.issues };
  }
  function list() { return db.prepare('SELECT publication_id AS publicationId,status,json_extract(compiled_json,\'$.title\') AS title FROM membership_course_publications ORDER BY created_at DESC LIMIT 50').all(); }
  return { prepare, publish, inspect, list };
}
module.exports = { createCoursePublisher };
