'use strict';
const crypto = require('node:crypto');
const validate = require('./validate');
const entities = {
  decks: { table: 'user_decks', key: 'id' },
  courses: { table: 'user_courses', key: 'course_id' },
  courseProgress: { table: 'user_course_progress', key: 'course_id' },
  kv: { table: 'user_kv', key: 'k' }
};
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function batchToken(userId, snapshot) { return hash({ kind: 'account-batch-v1', userId, seq: snapshot.seq, snapshot }); }
function fail(status, message, code) { const e = new Error(message); e.status = status; e.code = code; throw e; }
function checkTarget(entity, id) {
  if (!Object.hasOwn(entities, entity) || typeof id !== 'string' || !id || id.length > 256) fail(400, '无效的冲突项目');
  if (entity === 'kv' && !['best', 'settings', 'stats'].includes(id)) fail(400, '此项目不支持版本选择');
}
function validateLocal(entity, id, local) {
  if (!local || !Number.isSafeInteger(local.rev) || local.rev < 0 || local.rev >= Number.MAX_SAFE_INTEGER || typeof local.deleted !== 'boolean') fail(400, '本机版本格式不正确');
  if (local.deleted) {
    if (local.value !== null) fail(400, '删除状态不能同时携带内容');
    return;
  }
  if (!local.value || typeof local.value !== 'object' || Array.isArray(local.value)) fail(400, '本机内容必须是对象');
  let error;
  if (entity === 'decks') {
    if (local.value.id !== id) fail(400, '题库 ID 不匹配');
    error = validate.validateMem({ decks: [local.value] });
  } else if (entity === 'courses') {
    if (local.value.courseId !== id) fail(400, '课程 ID 不匹配');
    error = validate.validateCourse(local.value);
  } else if (entity === 'kv') {
    if (id === 'stats' && ('bySentence' in local.value || 'events' in local.value)) fail(400, '学习明细不能通过汇总冲突接口覆盖');
    error = validate.validateMem({ [id]: local.value });
  }
  if (error) fail(400, error);
}

function createResolutionService(db, write, allocSeq) {
  function read(userId, entity, id) {
    checkTarget(entity, id);
    const spec = entities[entity];
    const row = db.prepare(`SELECT * FROM ${spec.table} WHERE user_id=? AND ${spec.key}=?`).get(userId, id);
    const deleted = !row || !!row.deleted_at;
    let value = null;
    if (!deleted) value = entity === 'decks'
      ? { id: row.id, name: row.name, items: JSON.parse(row.items_json), builtin: !!row.builtin, isPublic: !!row.is_public }
      : JSON.parse(entity === 'kv' ? row.v_json : row.data_json);
    const state = { rev: (row && row.rev) || 0, deleted, value };
    return { entity, id, ...state, exists: !!row, token: hash({ entity, id, ...state }) };
  }
  function backup(userId, requestId) {
    const row = db.prepare('SELECT backup_json, result_json FROM user_sync_resolutions WHERE user_id=? AND request_id=?').get(userId, requestId);
    if (!row) fail(404, '未找到这次处理记录');
    return { backup: JSON.parse(row.backup_json), result: JSON.parse(row.result_json) };
  }
  const resolve = db.transaction(function(userId, body) {
    if (!body || !['local', 'remote'].includes(body.choice)) fail(400, '请选择保留本机或使用云端');
    const { entity, id, local, requestId, expectedToken } = body;
    checkTarget(entity, id);
    validateLocal(entity, id, local);
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{12,80}$/.test(requestId) || !/^[a-f0-9]{64}$/.test(expectedToken || '')) fail(400, '处理请求标识不正确');
    const fingerprint = hash(body);
    const previous = db.prepare('SELECT request_hash,result_json FROM user_sync_resolutions WHERE user_id=? AND request_id=?').get(userId, requestId);
    if (previous) {
      if (previous.request_hash !== fingerprint) fail(409, '同一请求不能更改选择', 'RESOLUTION_REQUEST_CHANGED');
      return JSON.parse(previous.result_json); // Lost HTTP response: return the original receipt, never reapply.
    }
    const remote = read(userId, entity, id);
    if (remote.token !== expectedToken) fail(409, '云端刚有新的修改，请重新查看双方版本', 'RESOLUTION_STALE');
    const archive = { entity, id, choice: body.choice, local, remote, at: new Date().toISOString() };
    const backupJSON = JSON.stringify(archive);
    const usage = db.prepare('SELECT count(*) AS n, coalesce(sum(length(CAST(backup_json AS BLOB))),0) AS bytes FROM user_sync_resolutions WHERE user_id=?').get(userId);
    // No automatic deletion of recovery data. Stop rather than discard the user's backups.
    if (usage.n >= 100 || usage.bytes + Buffer.byteLength(backupJSON) > 64 * 1024 * 1024) fail(507, '冲突备份空间已满，请联系管理员导出归档后再处理', 'RESOLUTION_ARCHIVE_FULL');
    const selected = body.choice === 'local' ? local : remote;
    const rev = Math.max(local.rev, remote.rev) + 1;
    if (!Number.isSafeInteger(rev)) fail(400, '版本号超出范围');
    write(userId, entity, id, selected.value, rev, selected.deleted, allocSeq(userId));
    const result = { ok: true, requestId, entity, id, state: read(userId, entity, id) };
    db.prepare('INSERT INTO user_sync_resolutions (user_id,request_id,request_hash,backup_json,result_json) VALUES (?,?,?,?,?)')
      .run(userId, requestId, fingerprint, backupJSON, JSON.stringify(result));
    return result;
  });
  return { read, resolve, backup };
}

/* Account-level resolution. Unlike createResolutionService above, this never
 * narrows a conflict to one entity: preview and confirmation are bound to the
 * same full snapshot token. applyLocal is called inside this service's
 * transaction so the archive and the replacement cannot commit separately. */
function createBatchResolutionService(db, readSnapshot, applyLocal) {
  function compare(userId) {
    const snapshot = readSnapshot(userId);
    return { ok: true, kind: 'batch', seq: snapshot.seq, snapshot, token: batchToken(userId, snapshot) };
  }
  function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) fail(400, '整账号快照格式不正确');
    if (!snapshot.mem || typeof snapshot.mem !== 'object' || Array.isArray(snapshot.mem)) fail(400, '整账号快照缺少mem');
    if (!Array.isArray(snapshot.mem.decks) || !Array.isArray(snapshot.mem.reinforceBook) ||
        !snapshot.mem.best || typeof snapshot.mem.best !== 'object' || Array.isArray(snapshot.mem.best) ||
        !snapshot.mem.mastered || typeof snapshot.mem.mastered !== 'object' || Array.isArray(snapshot.mem.mastered) ||
        !snapshot.mem.settings || typeof snapshot.mem.settings !== 'object' || Array.isArray(snapshot.mem.settings) ||
        !snapshot.mem.stats || typeof snapshot.mem.stats !== 'object' || Array.isArray(snapshot.mem.stats) ||
        !snapshot.mem.stats.bySentence || typeof snapshot.mem.stats.bySentence !== 'object' || Array.isArray(snapshot.mem.stats.bySentence) ||
        !Array.isArray(snapshot.mem.stats.events) || !snapshot.mem.deletedItems || typeof snapshot.mem.deletedItems !== 'object' || Array.isArray(snapshot.mem.deletedItems) ||
        !Array.isArray(snapshot.courses) || !snapshot.courseProgress || typeof snapshot.courseProgress !== 'object' || Array.isArray(snapshot.courseProgress)) {
      fail(400, '整账号快照必须完整包含题库、课程、进度和学习数据');
    }
    const error = validate.validatePutPayload({ mem: snapshot.mem, courses: snapshot.courses, courseProgress: snapshot.courseProgress });
    if (error) fail(400, error);
  }
  function resolve(userId, body) {
    if (!body || !['local', 'remote'].includes(body.choice)) fail(400, '请选择使用本机或云端');
    if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.requestId) ||
        !/^[a-f0-9]{64}$/.test(body.expectedToken || '')) fail(400, '整账号处理请求标识不正确');
    validateSnapshot(body.local);
    const fingerprint = hash({ kind: 'account-batch-v1', requestId: body.requestId, choice: body.choice, expectedToken: body.expectedToken, local: body.local || null });
    return db.transaction(function () {
      const previous = db.prepare('SELECT request_hash,result_json FROM user_sync_resolutions WHERE user_id=? AND request_id=?').get(userId, body.requestId);
      if (previous) {
        if (previous.request_hash !== fingerprint) fail(409, '同一整账号请求不能更改选择', 'RESOLUTION_REQUEST_CHANGED');
        return JSON.parse(previous.result_json);
      }
      const remote = compare(userId);
      if (remote.token !== body.expectedToken) fail(409, '云端刚有新的修改，请重新查看双方版本', 'RESOLUTION_STALE');
      const local = body.local;
      const archive = { kind: 'batch', choice: body.choice, local, remote: remote.snapshot, at: new Date().toISOString() };
      const backupJSON = JSON.stringify(archive);
      const usage = db.prepare('SELECT count(*) AS n, coalesce(sum(length(CAST(backup_json AS BLOB))),0) AS bytes FROM user_sync_resolutions WHERE user_id=?').get(userId);
      if (usage.n >= 100 || usage.bytes + Buffer.byteLength(backupJSON) > 64 * 1024 * 1024) fail(507, '冲突备份空间已满，请先导出归档后再处理', 'RESOLUTION_ARCHIVE_FULL');
      if (body.choice === 'local') applyLocal(userId, local, remote.snapshot, body.requestId);
      const result = { ok: true, kind: 'batch', requestId: body.requestId, choice: body.choice,
        seq: currentSeqForSnapshot(body.choice === 'local' ? readSnapshot(userId) : remote.snapshot), snapshot: body.choice === 'local' ? readSnapshot(userId) : remote.snapshot };
      db.prepare('INSERT INTO user_sync_resolutions (user_id,request_id,request_hash,backup_json,result_json) VALUES (?,?,?,?,?)')
        .run(userId, body.requestId, fingerprint, backupJSON, JSON.stringify(result));
      return result;
    })();
  }
  function currentSeqForSnapshot(snapshot) { return Number.isSafeInteger(snapshot && snapshot.seq) ? snapshot.seq : 0; }
  function backup(userId, requestId) {
    const row = db.prepare('SELECT backup_json, result_json FROM user_sync_resolutions WHERE user_id=? AND request_id=?').get(userId, requestId);
    if (!row) fail(404, '未找到这次整账号处理记录');
    return { backup: JSON.parse(row.backup_json), result: JSON.parse(row.result_json) };
  }
  return { compare, resolve, backup };
}
module.exports = { createResolutionService, createBatchResolutionService, batchToken };
