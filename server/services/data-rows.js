'use strict';

/* Row-level stat/event/entity writers shared by migrations and saveData. */
function createDataRows(options) {
  const stmt = options.stmt;

  const SBS_UPSERT_SQL = "INSERT INTO user_sentence_stats (user_id,sentence_key,deck_id,data_json,deleted_at,updated_at,seq) VALUES (?,?,?,?,NULL,datetime('now'),?) ON CONFLICT(user_id,sentence_key) DO UPDATE SET data_json=excluded.data_json, deck_id=excluded.deck_id, deleted_at=NULL, updated_at=datetime('now'), seq=excluded.seq";
  const SBS_DELETE_SQL = "UPDATE user_sentence_stats SET deleted_at=datetime('now'), updated_at=datetime('now'), seq=? WHERE user_id=? AND sentence_key=?";
  const EV_UPSERT_SQL = "INSERT INTO user_events (user_id,id,at,data_json,deleted_at,updated_at,seq) VALUES (?,?,?,?,NULL,datetime('now'),?) ON CONFLICT(user_id,id) DO UPDATE SET data_json=excluded.data_json, at=excluded.at, deleted_at=NULL, updated_at=datetime('now'), seq=excluded.seq";
  const EV_DELETE_SQL = "UPDATE user_events SET deleted_at=datetime('now'), updated_at=datetime('now'), seq=? WHERE user_id=? AND id=?";
  
  function upsertSentenceStat(userId, key, data, seq) {
    if (!key || !data || typeof data !== 'object') return;
    const deckId = typeof data.deckId === 'string' ? data.deckId : null;
    stmt(SBS_UPSERT_SQL).run(userId, String(key), deckId, JSON.stringify(data), seq);
  }
  
  function deleteSentenceStat(userId, key, seq) {
    if (!key) return;
    stmt(SBS_DELETE_SQL).run(seq, userId, String(key));
  }
  
  function upsertEvent(userId, ev, seq) {
    if (!ev || !ev.id) return;
    stmt(EV_UPSERT_SQL).run(userId, String(ev.id), typeof ev.at === 'number' ? ev.at : null, JSON.stringify(ev), seq);
  }
  
  function deleteEvent(userId, id, seq) {
    if (!id) return;
    stmt(EV_DELETE_SQL).run(seq, userId, String(id));
  }
  
  /* ----- 通用行级实体（mastered / reinforce / deletedItem，2026-09-10 第二轮） -----
     与 user_sentence_stats 同理（见 db.js 表注释）：这三个对象也是「随练习量增长」的，
     塞在单个 kv blob 里时每答一题要搬运四次（本地落盘序列化 / maintainRevs 签名 /
     上行 payload / 服务端整块回写）。mastered 8000 条约 227KB、错题本上限 200 条约 176KB。
  
     kind 白名单：写入口拒绝未知 kind，否则脏 kind 会让这张通用表无界增长。 */
  const ENTITY_KINDS = { mastered: 1, reinforce: 1, deletedItem: 1 };
  
  const ENTITY_UPSERT_SQL = "INSERT INTO user_entity_rows (user_id,kind,item_key,data_json,deleted_at,updated_at,seq) VALUES (?,?,?,?,NULL,datetime('now'),?) ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json, deleted_at=NULL, updated_at=datetime('now'), seq=excluded.seq";
  const ENTITY_DELETE_SQL = "UPDATE user_entity_rows SET deleted_at=datetime('now'), updated_at=datetime('now'), seq=? WHERE user_id=? AND kind=? AND item_key=?";
  
  function upsertEntityRow(userId, kind, key, data, seq) {
    if (!ENTITY_KINDS[kind] || !key) return;
    stmt(ENTITY_UPSERT_SQL).run(userId, kind, String(key), JSON.stringify(data === undefined ? 1 : data), seq);
  }
  function deleteEntityRow(userId, kind, key, seq) {
    if (!ENTITY_KINDS[kind] || !key) return;
    stmt(ENTITY_DELETE_SQL).run(seq, userId, kind, String(key));
  }
  /* 注：读行一律走 buildMem 里带 seq 区间的统一查询（增量/全量共用一套 WHERE 片段），
     所以这里不再单独提供「读某个 kind 全部存活行」的 helper —— 避免出现第二处
     不参与增量过滤的读路径（那是「客户端收到全量、却以为拿到增量」的隐患）。 */
  /* 旧客户端（及迁移前的库）把三者放在 kv blob 里；这里负责把它们按行落库。
     ⚠️ 只做逐行 UPSERT、绝不做整表替换 —— 旧客户端发的是「本地合并后的副本」，
        不含「其他设备有而本地没有」的条目，整替会静默删掉那些数据（与 stats 同一个坑）。 */
  function putEntityBlob(userId, kind, blob, seq) {
    if (!blob) return;
    if (kind === 'reinforce') {
      if (!Array.isArray(blob)) return;
      blob.forEach(function (it) { if (it && it._key) upsertEntityRow(userId, 'reinforce', it._key, it, seq); });
      return;
    }
    // mastered / deletedItem：{key: value} 映射（deletedItems 历史上有数组形态，一并兼容）
    if (Array.isArray(blob)) {
      blob.forEach(function (k) { if (k) upsertEntityRow(userId, kind, k, 1, seq); });
      return;
    }
    if (typeof blob !== 'object') return;
    Object.keys(blob).forEach(function (k) { upsertEntityRow(userId, kind, k, blob[k], seq); });
  }
  

  return {
    upsertSentenceStat,
    deleteSentenceStat,
    upsertEvent,
    deleteEvent,
    upsertEntityRow,
    deleteEntityRow,
    putEntityBlob
  };
}

module.exports = { createDataRows };
