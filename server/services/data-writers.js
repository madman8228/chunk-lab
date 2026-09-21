'use strict';

/* Versioned row writers for sync entities. The service receives the database
 * and conflict guard so the HTTP entry point only coordinates requests. */
function createDataWriters(options) {
  const db = options.db;
  const assertRevisionAccepted = options.assertRevisionAccepted;

  function upsertDeck(userId, d, rev, deleted, seq, baseRev) {
    const row = db.prepare('SELECT name, items_json, builtin, rev, deleted_at FROM user_decks WHERE user_id=? AND id=?').get(userId, d.id);
    assertRevisionAccepted('decks', d.id, rev, deleted,
      { name: d.name, items: d.items || [], builtin: !!d.builtin }, row && {
        rev: row.rev, deleted: !!row.deleted_at,
        value: { name: row.name, items: JSON.parse(row.items_json), builtin: !!row.builtin }
      }, baseRev);
    if (deleted) {
      db.prepare("INSERT INTO user_decks (user_id,id,name,items_json,builtin,is_public,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,0,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,id) DO UPDATE SET deleted_at=datetime('now'), is_public=0, rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_decks.rev, 0)")
        .run(userId, d.id, '', '[]', 0, rev == null ? null : rev, seq);
    } else {
      db.prepare("INSERT INTO user_decks (user_id,id,name,items_json,builtin,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name, items_json=excluded.items_json, builtin=excluded.builtin, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_decks.rev, 0)")
        .run(userId, d.id, d.name, JSON.stringify(d.items || []), d.builtin ? 1 : 0, rev == null ? null : rev, null, seq);
    }
  }
  
  function updateDeckPublication(userId, deckId, publish, seq) {
    const row = db.prepare('SELECT rev FROM user_decks WHERE user_id=? AND id=? AND deleted_at IS NULL').get(userId, deckId);
    if (!row) {
      /** @type {Error & {status?: number}} */
      const error = new Error('题库不存在');
      error.status = 404;
      throw error;
    }
    const rev = (row.rev == null ? 0 : row.rev) + 1;
    db.prepare("UPDATE user_decks SET is_public=?, rev=?, updated_at=datetime('now'), seq=? WHERE user_id=? AND id=? AND deleted_at IS NULL")
      .run(publish ? 1 : 0, rev, seq, userId, deckId);
    return !!publish;
  }
  
  function upsertKv(userId, k, v, rev, deleted, seq, baseRev) {
    const row = db.prepare('SELECT v_json, rev, deleted_at FROM user_kv WHERE user_id=? AND k=?').get(userId, k);
    assertRevisionAccepted('kv', k, rev, deleted, v, row && {
      rev: row.rev, deleted: !!row.deleted_at, value: JSON.parse(row.v_json)
    }, baseRev);
    if (deleted) {
      db.prepare("INSERT INTO user_kv (user_id,k,v_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,k) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_kv.rev, 0)")
        .run(userId, k, 'null', rev == null ? null : rev, seq);
    } else {
      db.prepare("INSERT INTO user_kv (user_id,k,v_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,k) DO UPDATE SET v_json=excluded.v_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_kv.rev, 0)")
        .run(userId, k, JSON.stringify(v), rev == null ? null : rev, null, seq);
    }
  }
  
  function upsertCourse(userId, c, rev, deleted, seq, baseRev) {
    const row = db.prepare('SELECT data_json, rev, deleted_at FROM user_courses WHERE user_id=? AND course_id=?').get(userId, c.courseId);
    assertRevisionAccepted('courses', c.courseId, rev, deleted, c, row && {
      rev: row.rev, deleted: !!row.deleted_at, value: JSON.parse(row.data_json)
    }, baseRev);
    if (deleted) {
      db.prepare("INSERT INTO user_courses (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_courses.rev, 0)")
        .run(userId, c.courseId, '{}', rev == null ? null : rev, seq);
    } else {
      db.prepare("INSERT INTO user_courses (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_courses.rev, 0)")
        .run(userId, c.courseId, JSON.stringify(c), rev == null ? null : rev, null, seq);
    }
  }
  
  function upsertCourseProgress(userId, cid, data, rev, deleted, seq, baseRev) {
    const row = db.prepare('SELECT data_json, rev, deleted_at FROM user_course_progress WHERE user_id=? AND course_id=?').get(userId, cid);
    assertRevisionAccepted('courseProgress', cid, rev, deleted, data, row && {
      rev: row.rev, deleted: !!row.deleted_at, value: JSON.parse(row.data_json)
    }, baseRev);
    if (deleted) {
      db.prepare("INSERT INTO user_course_progress (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_course_progress.rev, 0)")
        .run(userId, cid, 'null', rev == null ? null : rev, seq);
    } else {
      db.prepare("INSERT INTO user_course_progress (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_course_progress.rev, 0)")
        .run(userId, cid, JSON.stringify(data), rev == null ? null : rev, null, seq);
    }
  }
  

  return { upsertDeck, updateDeckPublication, upsertKv, upsertCourse, upsertCourseProgress };
}

module.exports = { createDataWriters };
