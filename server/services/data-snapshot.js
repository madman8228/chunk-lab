'use strict';

/* Snapshot assembly for full and delta sync responses. The entry point injects
 * the database and sequence reader so this module owns no process globals. */
function createSnapshotReader(options) {
  const db = options.db;
  const currentSeq = options.currentSeq;

  function buildMemSnapshot(userId, since) {
    const seqNow = currentSeq(userId);
    /* 水位超前于服务端（库被回滚/重置/换过库）→ 本地水位与这份数据不同源，增量无从算起，
       退回全量。这是协议规则而非兜底：不退的话客户端会永远只拉增量、静默少数据。 */
    const isDelta = (since != null) && (since <= seqNow);
  
    const W = function (aliveOnly) {
      return 'user_id=?' + (aliveOnly ? ' AND deleted_at IS NULL' : '') +
        (isDelta ? ' AND seq>? AND seq<=?' : '');
    };
    const A = isDelta ? [userId, since, seqNow] : [userId];
    /* ⚠️ 必须用展开调用（stmt.all(...args)）：写成 stmt.all.apply(null, args) 会丢掉 this，
       better-sqlite3 的语句方法绑在语句对象上，丢 this 直接抛错。 */
    const rows = function (sql, aliveOnly, extra) {
      const s = db.prepare(sql.replace('{W}', W(aliveOnly)));
      return s.all(...A.concat(extra || []));
    };
  
    const deckRows = rows('SELECT id,name,items_json,builtin,is_public,rev FROM user_decks WHERE {W}', true);
    const decks = deckRows.map(function (r) {
      return { id: r.id, name: r.name, items: JSON.parse(r.items_json), builtin: !!r.builtin, isPublic: !!r.is_public };
    });
    // revs 需含软删行：让其他设备能判断本地副本是否已过期（软删也是版本演进）
    const deckRevs = {};
    rows('SELECT id,rev FROM user_decks WHERE {W}', false).forEach(function (r) { deckRevs[r.id] = r.rev; });
  
    const kvRows = rows('SELECT k,v_json,rev FROM user_kv WHERE {W}', true);
    const kv = {};
    kvRows.forEach(function (r) { kv[r.k] = JSON.parse(r.v_json); });
    const kvRevs = {};
    rows('SELECT k,rev FROM user_kv WHERE {W}', false).forEach(function (r) { kvRevs[r.k] = r.rev; });
  
    /* stats 的两个大对象从行表组装（2026-09-10 拆表，见 db.js 表注释）。
       对外协议形状**完全不变** —— 客户端仍旧拿到 stats.bySentence / stats.events，
       变的只是服务端存储方式与上行增量。blob 里残留的旧值由启动迁移清掉（migrateStatsToRows）。 */
    const sbsRows = rows('SELECT sentence_key,data_json FROM user_sentence_stats WHERE {W}', true);
    const bySentence = {};
    sbsRows.forEach(function (r) {
      var st = JSON.parse(r.data_json);
      /* 去冗余（2026-09-10）：deckName / translation 是「展示冗余」——
         客户端对 translation 从不读原始值（统计页恒用题库 item 重算，见 stats.html
         renderSentenceList 的 Object.assign({}, st, {translation: it.translation})）；
         deckName 只在旧 key 迁移时读（新条目 deckId 命中 known 直接跳过）。
         两者都能从 deckId + 题库 item 重建，组装时剥离让下行 GET 立省 ~25%，
         且不改任何客户端行为（statSig 只 hash SRS 计数，不含这俩字段，剥离不触发误重传）。 */
      if (st && typeof st === 'object') { delete st.deckName; delete st.translation; }
      bySentence[r.sentence_key] = st;
    });
    const evRows = rows('SELECT data_json FROM user_events WHERE {W} ORDER BY at,id', true);
    const events = evRows.map(function (r) {
      var ev = JSON.parse(r.data_json);
      /* 去冗余（2026-09-10）：answer 事件的 deckId / sentence 与 key（=deckId#cid）重复，
         且全链路从未被读取 —— mergeStats 只用 id/kind/ok/key，backfillDaysLog 只用 kind/at。
         round 事件本就只有 id/kind/at。剥掉让下行 events 立省 ~18.7%（占总量）。 */
      if (ev && typeof ev === 'object') { delete ev.deckId; delete ev.sentence; }
      return ev;
    });
  
    /* ★ 增量模式下 stats 基座（totalRounds / totalAnswered / daysLog…）**一律完整下发**。
       它体积很小，但「基座缺失或用 0 兜底」会让客户端的重建式合并（mergeStats 按
       `总数 - 事件侧计数` 反推历史基线）彻底算错。走增量的只有 bySentence / events 这两个大对象。 */
    const statsBase = isDelta
      ? (function () {
          const r = db.prepare("SELECT v_json FROM user_kv WHERE user_id=? AND k='stats' AND deleted_at IS NULL").get(userId);
          return r ? JSON.parse(r.v_json) : { totalRounds: 0, totalAnswered: 0 };
        })()
      : (kv.stats || { totalRounds: 0, totalAnswered: 0 });
  
    /* mastered / reinforceBook / deletedItems 从行表组装（2026-09-10 第二轮，见 db.js 表注释）。
       对外形状与拆表前完全一致，变的是存储与上行增量方式。
  
       ★ 为什么要额外下发 entityGone（删除墓碑）：
         客户端对这三者的合并语义是「并集 + 墓碑」（与 stats 一致，靠并集重建/求并，幂等）。
         只给存活行是不够的 —— 设备 A 取消标熟某句后，若 B 拿不到墓碑，
         B 的本地副本仍持有该 key，下次上行会把它重新写活（复活）。
         重新标熟/恢复删除都是低频操作，墓碑总量很小（每条约 25 字节），随全量响应下发即可。 */
    const entityMastered = {};
    rows('SELECT item_key,data_json FROM user_entity_rows WHERE {W} AND kind=? ORDER BY rowid', true, ['mastered'])
      .forEach(function (r) { entityMastered[r.item_key] = JSON.parse(r.data_json); });
    const entityReinforce = rows('SELECT item_key,data_json FROM user_entity_rows WHERE {W} AND kind=? ORDER BY rowid', true, ['reinforce'])
      .map(function (r) { return JSON.parse(r.data_json); });
    const entityDeletedItems = {};
    rows('SELECT item_key FROM user_entity_rows WHERE {W} AND kind=?', true, ['deletedItem'])
      .forEach(function (r) { entityDeletedItems[r.item_key] = true; });
    const entityGone = {};
    ['mastered', 'reinforce', 'deletedItem'].forEach(function (kind) {
      entityGone[kind] = rows('SELECT item_key FROM user_entity_rows WHERE {W} AND kind=? AND deleted_at IS NOT NULL ORDER BY item_key', false, [kind])
        .map(function (r) { return r.item_key; });
    });
  
    const mem = {
      decks: decks,
      best: kv.best || {},
      mastered: entityMastered,
      stats: Object.assign({}, statsBase, { bySentence: bySentence, events: events }),
      settings: kv.settings || {},
      reinforceBook: entityReinforce,
      deletedItems: entityDeletedItems
    };
  
    const courseRows = rows('SELECT data_json FROM user_courses WHERE {W}', true);
    const courses = courseRows.map(function (r) { return JSON.parse(r.data_json); });
    // revs 需含软删行：让其他设备能判断本地副本是否已过期
    const courseRevs = {};
    rows('SELECT course_id,rev FROM user_courses WHERE {W}', false).forEach(function (r) { courseRevs[r.course_id] = r.rev; });
  
    const progRows = rows('SELECT course_id,data_json FROM user_course_progress WHERE {W}', true);
    const courseProgress = {};
    progRows.forEach(function (r) { courseProgress[r.course_id] = JSON.parse(r.data_json); });
    const progRevs = {};
    rows('SELECT course_id,rev FROM user_course_progress WHERE {W}', false).forEach(function (r) { progRevs[r.course_id] = r.rev; });
  
    /* ★ 增量模式必须**显式**给出删除清单。
       全量下的客户端可以靠「远端 revs 有、远端 mem 没有 → 已删」推断缺失实体，因为全量响应
       就是全集；但增量的 mem 只含**变更**项，未变更的实体本来就不在响应里 ——
       若客户端沿用存在性推断，会把「没变更」误判成「已删除」，整批删掉用户数据。
       所以增量下删除一律落成显式列表，客户端不做任何存在性推断。 */
    const deleted = { decks: [], kv: [], courses: [], courseProgress: [] };
    /* 事件是追加日志，客户端不能仅凭全量响应里“没有某事件”推断删除：
       旧设备可能仍保留被整账号选择清掉的事件。全量也返回墓碑，体积很小，
       让设备首次/重新拉取时能够摘掉本地旧事件；增量路径仍按 seq 限定范围。 */
    deleted.events = rows('SELECT id FROM user_events WHERE {W} AND deleted_at IS NOT NULL', false)
      .map(function (r) { return r.id; });
    if (isDelta) {
      rows('SELECT id FROM user_decks WHERE {W} AND deleted_at IS NOT NULL', false)
        .forEach(function (r) { deleted.decks.push(r.id); });
      rows('SELECT k FROM user_kv WHERE {W} AND deleted_at IS NOT NULL', false)
        .forEach(function (r) { deleted.kv.push(r.k); });
      rows('SELECT course_id FROM user_courses WHERE {W} AND deleted_at IS NOT NULL', false)
        .forEach(function (r) { deleted.courses.push(r.course_id); });
      rows('SELECT course_id FROM user_course_progress WHERE {W} AND deleted_at IS NOT NULL', false)
        .forEach(function (r) { deleted.courseProgress.push(r.course_id); });
      /* bySentence 的软删行：与 entityGone 同性质，客户端据此从本地档案里摘掉 */
      deleted.sentences = rows('SELECT sentence_key FROM user_sentence_stats WHERE {W} AND deleted_at IS NOT NULL', false)
        .map(function (r) { return r.sentence_key; });
    }
  
    return {
      mem: mem, courses: courses, courseProgress: courseProgress,
      revs: { decks: deckRevs, kv: kvRevs, courses: courseRevs, courseProgress: progRevs },
      entityGone: entityGone,
      /* 客户端据此记录下行水位：「seq 及之前的变更我都已收到」。
         必须与数据同层存储（清数据就得清水位），否则「数据被清、水位残留」会永久少数据。 */
      seq: seqNow,
      delta: isDelta,
      deleted: deleted
    };
  }
  
  /*
   * Read the complete server-side view from one SQLite transaction snapshot.
   *
   * currentSeq() intentionally runs before the row queries, but that ordering
   * alone is not enough: without a transaction, a concurrent writer can commit
   * between the sequence read and one of the later table reads.  The response
   * could then contain rows from two different eras while advertising only one
   * seq watermark.  Keep the assembler pure so callers already inside a write
   * transaction (for example conflict resolution) do not attempt a nested
   * transaction; HTTP/export reads use this wrapper.
   */
  function readMemSnapshot(userId, since) {
    return db.transaction(function () { return buildMemSnapshot(userId, since); })();
  }
  

  return { buildMemSnapshot, readMemSnapshot };
}

module.exports = { createSnapshotReader };

