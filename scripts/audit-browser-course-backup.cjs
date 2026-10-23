'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  throw new Error('备份包含不能安全核验的数据类型');
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function collectReferences(backup) {
  const refs = [];
  const add = (value, path) => {
    if (typeof value === 'string' && value) refs.push({ id: value, path });
  };
  const stores = backup.partition.stores || {};
  for (const [index, row] of (stores.courses || []).entries()) add(row && row.courseId, `stores.courses[${index}].courseId`);
  for (const [index, row] of (stores.progress || []).entries()) {
    add(row && row.cid, `stores.progress[${index}].cid`);
    add(row && row.courseId, `stores.progress[${index}].courseId`);
    add(row && row.deckId, `stores.progress[${index}].deckId`);
  }
  for (const [index, row] of (stores.syncMeta || []).entries()) {
    const mem = row && row.snapshot && row.snapshot.mem;
    for (const [i, deck] of ((mem && mem.decks) || []).entries()) add(deck && deck.id, `stores.syncMeta[${index}].snapshot.mem.decks[${i}].id`);
    for (const [i, course] of ((mem && mem.courses) || []).entries()) add(course && course.courseId, `stores.syncMeta[${index}].snapshot.mem.courses[${i}].courseId`);
    for (const [id, course] of Object.entries((mem && mem.logicalCourses) || {})) add(course && course.courseId || id, `stores.syncMeta[${index}].snapshot.mem.logicalCourses.${id}`);
    for (const [id, progress] of Object.entries((mem && mem.courseProgress) || {})) {
      add(progress && progress.courseId || id, `stores.syncMeta[${index}].snapshot.mem.courseProgress.${id}`);
    }
    for (const [id, relation] of Object.entries((mem && mem.learningWorkspace) || {})) {
      add(relation && (relation.resourceId || relation.courseId || relation.targetId) || id, `stores.syncMeta[${index}].snapshot.mem.learningWorkspace.${id}`);
    }
  }
  const local = backup.partition.local || {};
  for (const [key, raw] of Object.entries(local)) {
    let value;
    try { value = JSON.parse(raw); } catch { continue; }
    const mem = value && value.mem || value;
    for (const [i, deck] of ((mem && mem.decks) || []).entries()) add(deck && deck.id, `local.${key}.decks[${i}].id`);
    for (const [i, course] of ((mem && mem.courses) || []).entries()) add(course && course.courseId, `local.${key}.courses[${i}].courseId`);
    for (const [id, course] of Object.entries((mem && mem.logicalCourses) || {})) add(course && course.courseId || id, `local.${key}.logicalCourses.${id}`);
    for (const [id, relation] of Object.entries((mem && mem.learningWorkspace) || {})) {
      add(relation && (relation.resourceId || relation.courseId || relation.targetId) || id, `local.${key}.learningWorkspace.${id}`);
    }
  }
  return refs;
}

function collectAssets(backup) {
  const refs = new Set(), embedded = new Map();
  const visit = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`));
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'imageAssetId' || key === 'audioAssetId') && typeof child === 'string' && child) refs.add(child);
      if (key === 'assets' && Array.isArray(child)) {
        for (const asset of child) {
          const assetId = asset && (asset.assetId || asset.id);
          if (typeof assetId !== 'string' || !assetId) continue;
          const uri = asset._dataUri || asset.dataUri;
          if (typeof uri !== 'string') continue;
          const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
          if (!match) { embedded.set(assetId, { invalid: true, path: `${path}.assets` }); continue; }
          const bytes = Buffer.from(match[2], 'base64');
          if (!bytes.length || bytes.toString('base64') !== match[2]) embedded.set(assetId, { invalid: true, path: `${path}.assets` });
          else embedded.set(assetId, { mimeType: match[1], byteLength: bytes.length,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'), path: `${path}.assets` });
        }
      }
      visit(child, `${path}.${key}`);
    }
  };
  const stores = backup.partition.stores || {};
  visit(stores.courses || [], 'stores.courses');
  for (const [index, row] of (stores.syncMeta || []).entries()) visit(row && row.snapshot && row.snapshot.mem || {}, `stores.syncMeta[${index}].snapshot.mem`);
  const opaqueLocalContentKeys = [];
  for (const [key, raw] of Object.entries(backup.partition.local || {})) {
    let value;
    try { value = JSON.parse(raw); } catch {
      if (/(?:^|\.)chunklab\.v1$/.test(key)) opaqueLocalContentKeys.push(key);
      continue;
    }
    visit(value, `local.${key}`);
  }
  return { referencedIds: [...refs].sort(), embedded: [...embedded.entries()].map(([assetId, value]) => ({ assetId, ...value })), opaqueLocalContentKeys };
}

function audit(backup, manifest, { knownCourseIds = [] } = {}) {
  const errors = [];
  if (!backup || backup.format !== 'chunklab-browser-partition-backup' || backup.version !== 1 ||
      !/^\d+$/.test(String(backup.uid || '')) || !backup.owner || !backup.partition || !backup.partition.stores) {
    errors.push('浏览器分区备份结构或身份字段无效');
  }
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries)) errors.push('课程迁移清单结构无效');
  if (errors.length) return { valid: false, errors, blockers: errors };

  let fingerprintValid = false;
  try { fingerprintValid = digest(backup.partition) === backup.fingerprint; } catch (error) { errors.push(error.message); }
  if (!fingerprintValid && !errors.length) errors.push('浏览器分区指纹不匹配，文件可能被修改或截断');

  let owner;
  try { owner = JSON.parse(backup.owner); } catch { owner = null; }
  if (!Array.isArray(owner) || String(owner[1]) !== String(backup.uid)) errors.push('备份 owner 与备份账号不一致');

  const entries = manifest.entries.filter(entry => Number(entry.userId) === Number(backup.uid));
  const manifestDigestValid = /^[a-f0-9]{64}$/.test(manifest.sourceDigest || '') &&
    crypto.createHash('sha256').update(JSON.stringify({ entries: manifest.entries, learningReferences: manifest.learningReferences }), 'utf8').digest('hex') === manifest.sourceDigest;
  if (!manifestDigestValid) errors.push('课程迁移清单摘要不匹配，文件可能被修改或不是受支持版本');
  const aliases = new Map();
  const addAlias = (id, courseId) => {
    if (!id) return;
    if (!aliases.has(id)) aliases.set(id, []);
    aliases.get(id).push(courseId);
  };
  for (const entry of entries) {
    addAlias(entry.legacyId, entry.courseId);
    addAlias(entry.courseId, entry.courseId);
    if (entry.kind === 'deck') addAlias('user-deck:' + entry.legacyId, entry.courseId);
  }
  for (const courseId of knownCourseIds) addAlias(courseId, courseId);

  const storeRows = (backup.partition.stores.syncMeta || []).map((row, index) => ({ row, index })).filter(({ row }) => row && row.snapshot);
  const ownershipConflicts = storeRows.filter(({ row }) => row.owner !== backup.owner).map(({ index, row }) => ({ index, owner: row.owner || null }));
  const confirmedCaches = (backup.partition.stores.syncMeta || []).filter(row => row && row.owner === backup.owner &&
    ['server-cache-v3', 'learning-cache-v1'].includes(row.key));
  const cacheSeqs = confirmedCaches.map(row => ({ key: row.key, appliedSeq: row.appliedSeq }));
  const references = collectReferences(backup);
  const matched = [], unmatched = [], ambiguous = [];
  for (const ref of references) {
    const targets = aliases.get(ref.id) || [];
    if (targets.length === 1) matched.push({ ...ref, courseId: targets[0] });
    else if (targets.length > 1) ambiguous.push(ref);
    else unmatched.push(ref);
  }
  const browserAssets = collectAssets(backup);
  const manifestAssets = new Map();
  for (const entry of entries) for (const asset of entry.inventory?.assets || []) {
    if (!manifestAssets.has(asset.assetId)) manifestAssets.set(asset.assetId, []);
    manifestAssets.get(asset.assetId).push(asset);
  }
  const unlistedAssets = browserAssets.referencedIds.filter(assetId => !manifestAssets.has(assetId));
  const assetConflicts = browserAssets.embedded.filter(asset => {
    const candidates = manifestAssets.get(asset.assetId) || [];
    return asset.invalid || !candidates.some(candidate => candidate.sha256 === asset.sha256 && candidate.mimeType === asset.mimeType && candidate.bytes === asset.byteLength);
  });
  const operations = backup.partition.stores.pendingOperations || [];
  const requestIds = operations.map(row => row && row.requestId).filter(Boolean);
  const duplicateRequestIds = [...new Set(requestIds.filter((id, index) => requestIds.indexOf(id) !== index))];
  const blockers = [];
  if (errors.length) blockers.push(...errors);
  if (ownershipConflicts.length) blockers.push('发现归属其他 owner 的缓存行，不能自动合并');
  if (unmatched.length) blockers.push('有本地课程/学习引用无法与该账号的服务端迁移清单唯一匹配');
  if (ambiguous.length) blockers.push('有旧 ID 对应多个迁移目标');
  if (duplicateRequestIds.length) blockers.push('待提交操作 requestId 重复');
  if (operations.length) blockers.push('存在待提交操作；本审计不会重放或清除');
  if (cacheSeqs.length !== 1 || !Number.isSafeInteger(cacheSeqs[0]?.appliedSeq) || cacheSeqs[0].appliedSeq < 0) blockers.push('没有唯一且有效的账号确认缓存水位');
  if (unlistedAssets.length) blockers.push('浏览器课程引用了迁移清单未登记的媒体素材');
  if (assetConflicts.length) blockers.push('浏览器内嵌媒体与迁移清单中的 MIME/字节数/hash 不一致或无法解析');
  if (browserAssets.opaqueLocalContentKeys.length) blockers.push('浏览器分区含无法解析的旧主数据键，不能证明其课程/素材引用已核对');

  return {
    valid: errors.length === 0 && fingerprintValid,
    accountId: backup.uid,
    fingerprintValid,
    manifestDigestValid,
    manifestEntriesForAccount: entries.length,
    references: { total: references.length, matched, unmatched, ambiguous },
    assets: { referencedIds: browserAssets.referencedIds, unlisted: unlistedAssets, embedded: browserAssets.embedded, conflicts: assetConflicts, opaqueLocalContentKeys: browserAssets.opaqueLocalContentKeys },
    ownershipConflicts,
    confirmedCache: cacheSeqs.length === 1 ? cacheSeqs[0] : null,
    pendingOperations: { count: operations.length, requestIds, duplicateRequestIds },
    blockers,
    action: '只读审计；未导入、改写、重放或删除任何记录'
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const backupPath = args[args.indexOf('--browser-backup') + 1];
  const manifestPath = args[args.indexOf('--course-manifest') + 1];
  if (!backupPath || !manifestPath) {
    console.error('用法: node scripts/audit-browser-course-backup.cjs --browser-backup <JSON> --course-manifest <JSON>');
    process.exitCode = 2;
  } else {
    try {
      const report = audit(JSON.parse(fs.readFileSync(backupPath, 'utf8')), JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      if (!report.valid || report.blockers.length) process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = { audit, canonical, digest };
