'use strict';

const { isDeepStrictEqual } = require('node:util');

/* A skipped UPSERT is only an acknowledgement if the desired value already exists.
 * Run inside the caller's transaction so a conflict rolls back the entire batch.
 * baseRev undefined keeps the legacy protocol; null requires an absent entity. */
function assertRevisionAccepted(entity, id, incomingRev, deleted, value, current, baseRev) {
  const currentRev = current && current.rev != null ? current.rev : 0;
  const same = !!current && deleted === current.deleted && (deleted || isDeepStrictEqual(value, current.value));
  if (baseRev !== undefined) {
    const matches = baseRev === null ? !current : !!current && baseRev === currentRev;
    // Exact retries can be acknowledged after the first response was lost.
    // A larger proposed revision never bypasses a different base version.
    if (!matches && !same) {
      const error = new Error('云端已更新，请先比较双方版本，本次同步未写入');
      error.code = 'SYNC_CONFLICT';
      error.conflicts = [{ entity, id, baseRev, incomingRev, currentRev,
        deleted: !current || current.deleted, reason: 'BASE_REV_MISMATCH' }];
      throw error;
    }
  }
  if (incomingRev == null || !current) return; // Legacy unversioned writes.
  if (incomingRev > currentRev) return;
  if (same) return; // Idempotent retry; key ordering is immaterial.
  const error = new Error('本机与云端数据版本冲突，本次同步未写入');
  error.code = 'SYNC_CONFLICT';
  error.conflicts = [{ entity, id, incomingRev, currentRev, deleted: current.deleted }];
  throw error;
}

function assertBatchVersion(baseSeq, currentSeq) {
  if(baseSeq === undefined) return; // Compatibility: migrate clients before requiring it.
  if(baseSeq === currentSeq) return;
  const error=new Error('云端在本次修改期间发生变化，本批数据未写入，请先核对双方数据');
  error.code='SYNC_CONFLICT';
  error.conflicts=[{entity:'batch',id:'data',baseSeq,currentSeq,reason:'BASE_SEQ_MISMATCH'}];
  throw error;
}

// Canonical object order permits an exact logical retry after serialization.
function batchHash(value) {
  function canonical(v){
    if(Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
    if(v && typeof v==='object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
    return JSON.stringify(v);
  }
  return require('node:crypto').createHash('sha256').update(canonical(value)).digest('hex');
}

module.exports = { assertRevisionAccepted, assertBatchVersion, batchHash };
