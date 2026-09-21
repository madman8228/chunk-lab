'use strict';

/* Startup migrations for legacy blob rows. Transactions and ordering are
 * preserved while dependencies are explicit for isolated tests. */
function createDataMigrations(options) {
  const db = options.db;
  const allocSeq = options.allocSeq;
  const upsertSentenceStat = options.upsertSentenceStat;
  const upsertEvent = options.upsertEvent;
  const putEntityBlob = options.putEntityBlob;

  /* 把 stats blob 里的两个大对象搬到行表，并从 blob 删掉它们（否则体积永远降不下来）。
     幂等：blob 里已无 bySentence/events 时直接跳过 —— 可在每次启动安全重复执行。
  
     ★ 先用廉价字符串探测筛出「真的待迁移」的行：正常库里 blob 早已不含大对象，
       若为每个用户都 JSON.parse 一次，用户量上来后这会变成启动时的隐性成本。 */
  function migrateStatsToRows() {
    const rows = db.prepare("SELECT user_id,v_json FROM user_kv WHERE k='stats'").all();
    const pending = rows.filter(function (r) {
      return r.v_json.indexOf('"bySentence"') >= 0 || r.v_json.indexOf('"events"') >= 0;
    });
    if (!pending.length) return { migrated: 0, sentences: 0, events: 0 };
  
    let migrated = 0, sentenceCount = 0, eventCount = 0;
    const tx = db.transaction(function () {
      pending.forEach(function (r) {
        let st;
        try { st = JSON.parse(r.v_json); } catch (e) { return; }
        if (!st || typeof st !== 'object') return;
        const hasBS = st.bySentence && typeof st.bySentence === 'object';
        const hasEv = Array.isArray(st.events);
        if (!hasBS && !hasEv) return;
        /* 迁移落下的行也要带变更号：否则增量客户端（水位已存在）永远收不到这批存量数据。 */
        const seq = allocSeq(r.user_id);
        if (hasBS) {
          Object.keys(st.bySentence).forEach(function (k) { upsertSentenceStat(r.user_id, k, st.bySentence[k], seq); sentenceCount++; });
        }
        if (hasEv) {
          st.events.forEach(function (ev) { upsertEvent(r.user_id, ev, seq); eventCount++; });
        }
        delete st.bySentence;
        delete st.events;
        db.prepare("UPDATE user_kv SET v_json=?, updated_at=datetime('now'), seq=? WHERE user_id=? AND k='stats'")
          .run(JSON.stringify(st), seq, r.user_id);
        migrated++;
      });
    });
    tx();
    return { migrated: migrated, sentences: sentenceCount, events: eventCount };
  }
  
  /* 把 mastered / reinforceBook / deletedItems 从 kv blob 搬进行表，并从 blob 删掉
     （不删的话 blob 体积永远降不下来，拆表等于白做）。
     幂等：blob 里已无这三个键时直接跳过 —— 可在每次启动安全重复执行。
     与 stats 迁移一样先做廉价字符串预筛，避免用户量上来后每次启动 parse 全库。 */
  function migrateEntityRows() {
    const rows = db.prepare('SELECT user_id,k,v_json FROM user_kv WHERE k IN (?,?,?)')
      .all('mastered', 'reinforceBook', 'deletedItems');
    if (!rows.length) return { migrated: 0, mastered: 0, reinforce: 0, deletedItems: 0 };
  
    let migrated = 0, nMastered = 0, nReinforce = 0, nDeleted = 0;
    const tx = db.transaction(function () {
      rows.forEach(function (r) {
        const kind = r.k === 'reinforceBook' ? 'reinforce' : (r.k === 'mastered' ? 'mastered' : 'deletedItem');
        /* 空值没有可搬的内容，不必 parse —— 但 kv 行**仍然要删**，
           否则这对空 blob 会永远留在库里（拆表不彻底）。 */
        const empty = !r.v_json || r.v_json === 'null' || r.v_json === '{}' || r.v_json === '[]';
        if (!empty) {
          let blob;
          try { blob = JSON.parse(r.v_json); } catch (e) { return; } /* parse 失败就不动它，绝不"删了但没搬" */
          /* 迁移落下的行也要带变更号，否则增量客户端收不到这批存量数据（同 stats 迁移）。 */
          const seq = allocSeq(r.user_id);
          const before = countEntityRows(r.user_id, kind);
          putEntityBlob(r.user_id, kind, blob, seq);
          const after = countEntityRows(r.user_id, kind);
          if (kind === 'mastered') nMastered += after - before;
          else if (kind === 'reinforce') nReinforce += after - before;
          else nDeleted += after - before;
        }
        db.prepare('DELETE FROM user_kv WHERE user_id=? AND k=?').run(r.user_id, r.k);
        migrated++;
      });
    });
    tx();
    return { migrated: migrated, mastered: nMastered, reinforce: nReinforce, deletedItems: nDeleted };
  }
  
  function countEntityRows(userId, kind) {
    const r = db.prepare('SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=? AND kind=? AND deleted_at IS NULL').get(userId, kind);
    return r ? r.n : 0;
  }
  

  return { migrateStatsToRows, migrateEntityRows };
}

module.exports = { createDataMigrations };
