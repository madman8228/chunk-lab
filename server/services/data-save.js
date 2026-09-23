'use strict';

/* Batch data write coordinator. All persistence and conflict dependencies are
 * injected so routes can call one stable service without owning storage logic. */
function createDataSave(options) {
  const db = options.db;
  const batchHash = options.batchHash;
  const assertBatchVersion = options.assertBatchVersion;
  const currentSeq = options.currentSeq;
  const allocSeq = options.allocSeq;
  const KV_KEYS = options.KV_KEYS;
  const ROW_KV_KINDS = options.ROW_KV_KINDS;
  const upsertDeck = options.upsertDeck;
  const updateDeckPublication = options.updateDeckPublication;
  const upsertKv = options.upsertKv;
  const upsertCourse = options.upsertCourse;
  const upsertCourseProgress = options.upsertCourseProgress;
  const upsertSentenceStat = options.upsertSentenceStat;
  const deleteSentenceStat = options.deleteSentenceStat;
  const upsertEvent = options.upsertEvent;
  const deleteEvent = options.deleteEvent;
  const putEntityBlob = options.putEntityBlob;
  const upsertEntityRow = options.upsertEntityRow;
  const deleteEntityRow = options.deleteEntityRow;

  function saveData(userId, body, withinTransaction) {
    const payloadHash=body.requestId === undefined ? null : batchHash(body);
    const mem = body.mem || {};
    const courses = Array.isArray(body.courses) ? body.courses : [];
    const courseProgress = body.courseProgress || {};
    const revs = body.revs || {};
    const deleted = body.deleted || {};
    const base = (entity, id) => body.baseRevs === undefined ? undefined : body.baseRevs[entity][id];
    const delta = (body.statsDelta && typeof body.statsDelta === 'object') ? body.statsDelta : null;
    const entDelta = (body.entityDelta && typeof body.entityDelta === 'object') ? body.entityDelta : null;
    const publications = Array.isArray(body.publications) ? body.publications : [];
  
    /* stats 大对象走行表：先把 bySentence / events 从「待写 kv 的 stats」里剥出来，
       否则它们会被原样塞回 blob，体积又回到 7MB（拆表等于白做）。
       旧客户端仍会发这两个字段 → 按「全量 UPSERT」处理，向后兼容且不丢数据
       （不能用整表 DELETE+INSERT：旧客户端发的是本地合并后的副本，
         不含「其他设备有而本地没有」的条目，整替会静默删掉）。 */
    let statsKv = null;
    let sbsFull = null, evFull = null;
    if (mem.stats && typeof mem.stats === 'object') {
      if (mem.stats.bySentence && typeof mem.stats.bySentence === 'object') sbsFull = mem.stats.bySentence;
      if (Array.isArray(mem.stats.events)) evFull = mem.stats.events;
      if (sbsFull || evFull) {
        statsKv = {};
        Object.keys(mem.stats).forEach(function (k) {
          if (k !== 'bySentence' && k !== 'events') statsKv[k] = mem.stats[k];
        });
      } else {
        statsKv = mem.stats;
      }
    }
  
    const apply = function () {
      /* 本次写入共用一个变更序号（行级增量下行的水位单位）。
         放在事务内：事务回滚时序号一起回滚，不会留下「凭空推进的水位」。
         若本次请求什么都没写，序号也确实被推进了 —— 无害：
         客户端的语义是「≤N 的都收到了」，多一次空推进只是让它多问一次。 */
      if(payloadHash){
        const receipt=db.prepare('SELECT payload_hash,seq FROM user_batch_receipts WHERE user_id=? AND request_id=?').get(userId,body.requestId);
        if(receipt){
          if(receipt.payload_hash===payloadHash)return receipt.seq;
          /** @type {Error & {status?: number, code?: string, conflicts?: Array<unknown>}} */
          const error=new Error('同一请求编号不能用于不同内容，本次数据未写入');
          /* Same conflict class as assertRevisionAccepted: the batch was built on a
             request identity the cloud already used for different content. routes/data.js
             and routes/backup.js already answer 409 for every SYNC_CONFLICT, and the sync
             resolution route (routes/sync.js -> resolutionResponse) maps conflict errors by
             `e.status`; carrying 409 here keeps it from surfacing as a misleading 500. */
          error.status=409;
          error.code='SYNC_CONFLICT';error.conflicts=[{entity:'batch',id:body.requestId,reason:'REQUEST_ID_REUSED'}];throw error;
        }
      }
      assertBatchVersion(body.baseSeq, currentSeq(userId));
      const seq = allocSeq(userId);
  
      // decks：实体级 rev upsert（不再整块 DELETE，崩溃可恢复、多设备不互覆盖）
      (mem.decks || []).forEach(function (d) {
        upsertDeck(userId, d, (revs.decks && revs.decks[d.id]) == null ? null : revs.decks[d.id], false, seq, base('decks', d.id));
      });
      (deleted.decks || []).forEach(function (d) {
        upsertDeck(userId, { id: d.id }, d.rev, true, seq, base('decks', d.id));
      });
  
      // kv：实体级 rev upsert（per-key：best / stats / settings）
      KV_KEYS.forEach(function (k) {
        /* mastered / reinforceBook / deletedItems 已迁到 user_entity_rows（见 db.js 表注释）。
           ⚠️ 必须在这里挡掉：否则旧客户端发整份 blob 时又会被写回 user_kv，
              blob 体积回到拆表前，拆表等于白做。 */
        if (ROW_KV_KINDS[k]) return;
        if (k === 'stats') {
          if (statsKv !== null) {
            upsertKv(userId, 'stats', statsKv, (revs.kv && revs.kv.stats) == null ? null : revs.kv.stats, false, seq, base('kv', 'stats'));
          }
          return;
        }
        if (k in mem) upsertKv(userId, k, mem[k], (revs.kv && revs.kv[k]) == null ? null : revs.kv[k], false, seq, base('kv', k));
      });
      (deleted.kv || []).forEach(function (d) {
        upsertKv(userId, d.k, null, d.rev, true, seq, base('kv', d.k));
      });
  
      // courses / courseProgress：per-entity rev upsert + 软删除（ADR-005 step 2）
      courses.forEach(function (c) {
        upsertCourse(userId, c, (revs.courses && revs.courses[c.courseId]) == null ? null : revs.courses[c.courseId], false, seq, base('courses', c.courseId));
      });
      (deleted.courses || []).forEach(function (c) {
        upsertCourse(userId, { courseId: c.id }, c.rev, true, seq, base('courses', c.id));
      });
      Object.keys(courseProgress).forEach(function (cid) {
        upsertCourseProgress(userId, cid, courseProgress[cid], (revs.courseProgress && revs.courseProgress[cid]) == null ? null : revs.courseProgress[cid], false, seq, base('courseProgress', cid));
      });
      (deleted.courseProgress || []).forEach(function (c) {
        upsertCourseProgress(userId, c.id, null, c.rev, true, seq, base('courseProgress', c.id));
      });
      publications.forEach(function (publication) {
        updateDeckPublication(userId, publication.deckId, publication.publish, seq);
      });
  
      // 句子档案 / 事件日志：行级写入（新协议的增量路径 + 旧客户端的全量兼容路径）
      if (sbsFull) Object.keys(sbsFull).forEach(function (k) { upsertSentenceStat(userId, k, sbsFull[k], seq); });
      if (evFull) evFull.forEach(function (ev) { upsertEvent(userId, ev, seq); });
      if (delta) {
        const sbs = delta.sbs || {};
        Object.keys(sbs).forEach(function (k) { upsertSentenceStat(userId, k, sbs[k], seq); });
        (delta.sbsGone || []).forEach(function (k) { deleteSentenceStat(userId, k, seq); });
        (delta.evs || []).forEach(function (ev) { upsertEvent(userId, ev, seq); });
        (delta.evsGone || []).forEach(function (id) { deleteEvent(userId, id, seq); });
      }
  
      /* mastered / reinforceBook / deletedItems：旧客户端的整份 blob（兼容路径）+ 新协议的 entityDelta。
         两者都只做逐行 UPSERT / 软删，绝不做整表替换（理由同 stats：整替会静默删掉他机数据）。 */
      Object.keys(ROW_KV_KINDS).forEach(function (k) {
        if (k in mem) putEntityBlob(userId, ROW_KV_KINDS[k], mem[k], seq);
      });
      if (entDelta) {
        Object.keys(ROW_KV_KINDS).forEach(function (k) {
          const part = entDelta[k];
          if (!part || typeof part !== 'object') return;
          const kind = ROW_KV_KINDS[k];
          const up = part.up || {};
          if (kind === 'reinforce') {
            Object.keys(up).forEach(function (key) { upsertEntityRow(userId, kind, key, up[key], seq); });
          } else {
            Object.keys(up).forEach(function (key) { upsertEntityRow(userId, kind, key, up[key] === undefined ? 1 : up[key], seq); });
          }
          (part.gone || []).forEach(function (key) { deleteEntityRow(userId, kind, key, seq); });
        });
      }
      if(payloadHash){
        db.prepare('INSERT INTO user_batch_receipts (user_id,request_id,payload_hash,seq) VALUES (?,?,?,?)').run(userId,body.requestId,payloadHash,seq);
        // Bounded receipt history. Older retries still fail their stale baseSeq;
        // eviction never makes an old snapshot eligible to overwrite new data.
        db.prepare('DELETE FROM user_batch_receipts WHERE user_id=? AND request_id NOT IN (SELECT request_id FROM user_batch_receipts WHERE user_id=? ORDER BY seq DESC LIMIT 256)').run(userId,userId);
      }
      return seq;
    };
    return (withinTransaction ? apply : db.transaction(apply))();
  }
  

  return saveData;
}

module.exports = { createDataSave };
