'use strict';

function createAdminOverview(options) {
  const db = options.db;
  const admin = options.admin;
  const shanghaiDay = options.shanghaiDay;

  function adminOnly(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const current = admin.verifyToken(token);
    if (!current) return res.status(401).json({ error: '管理员未登录或登录已过期' });
    req.admin = current;
    next();
  }

  function parseRangeDays(value) {
    const days = Number(value);
    return Number.isInteger(days) && days >= 1 && days <= 365 ? days : 7;
  }

  function adminRange(days) {
    const now = Date.now();
    const start = now - days * 24 * 60 * 60 * 1000;
    return { start, end: now, startDay: shanghaiDay(start), endDay: shanghaiDay(now) };
  }

  function adminOverview(days) {
    const range = adminRange(days);
    const account = db.prepare(
      "SELECT " +
      "COUNT(*) FILTER (WHERE username <> '__default__') AS total, " +
      "COUNT(*) FILTER (WHERE username LIKE 'guest_%') AS guests, " +
      "COUNT(*) FILTER (WHERE username <> '__default__' AND username NOT LIKE 'guest_%') AS registered, " +
      "COUNT(*) FILTER (WHERE username <> '__default__' AND datetime(created_at) >= datetime(?, 'unixepoch')) AS new_accounts " +
      "FROM users"
    ).get(Math.floor(range.start / 1000));
    const activeVisitors = db.prepare(
      "SELECT COUNT(DISTINCT a.user_id) AS count FROM user_activity a " +
      "JOIN users u ON u.id=a.user_id " +
      "WHERE a.day BETWEEN ? AND ? AND u.username <> '__default__'"
    ).get(range.startDay, range.endDay).count;
    const activeLearners = db.prepare(
      "SELECT COUNT(DISTINCT e.user_id) AS count FROM user_events e " +
      "JOIN users u ON u.id=e.user_id " +
      "WHERE e.deleted_at IS NULL AND e.at >= ? AND e.at < ? AND " +
      "json_extract(e.data_json, '$.kind')='answer' AND u.username <> '__default__'"
    ).get(range.start, range.end).count;
    const answers = db.prepare(
      "SELECT COUNT(*) AS count FROM user_events e JOIN users u ON u.id=e.user_id " +
      "WHERE e.deleted_at IS NULL AND e.at >= ? AND e.at < ? AND " +
      "json_extract(e.data_json, '$.kind')='answer' AND u.username <> '__default__'"
    ).get(range.start, range.end).count;
    const mastered = db.prepare(
      "SELECT COUNT(*) AS count FROM user_entity_rows e JOIN users u ON u.id=e.user_id " +
      "WHERE e.kind='mastered' AND e.deleted_at IS NULL AND u.username <> '__default__'"
    ).get().count;
    const daily = db.prepare(
      "SELECT a.day, COUNT(DISTINCT a.user_id) AS active_users, " +
      "COALESCE(SUM(a.page_views), 0) AS page_views " +
      "FROM user_activity a JOIN users u ON u.id=a.user_id " +
      "WHERE a.day BETWEEN ? AND ? AND u.username <> '__default__' " +
      "GROUP BY a.day ORDER BY a.day"
    ).all(range.startDay, range.endDay);
    const courseRows = db.prepare(
      "SELECT e.user_id, e.data_json FROM user_events e JOIN users u ON u.id=e.user_id " +
      "WHERE e.deleted_at IS NULL AND e.at >= ? AND e.at < ? AND " +
      "json_extract(e.data_json, '$.kind')='answer' AND u.username <> '__default__'"
    ).all(range.start, range.end);
    const courses = {};
    courseRows.forEach(function (row) {
      let event;
      try { event = JSON.parse(row.data_json); } catch (e) { return; }
      const key = typeof event.key === 'string' ? event.key : '';
      const deckId = key.split('#')[0] || 'unknown';
      if (!courses[deckId]) courses[deckId] = { deckId: deckId, answers: 0, users: {} };
      courses[deckId].answers += 1;
      courses[deckId].users[row.user_id] = true;
    });
    const topCourses = Object.keys(courses).map(function (id) {
      const item = courses[id];
      return { deckId: item.deckId, answers: item.answers, users: Object.keys(item.users).length };
    }).sort(function (a, b) { return b.answers - a.answers; }).slice(0, 8);
    return {
      range: { days: days, start: range.start, end: range.end, startDay: range.startDay, endDay: range.endDay },
      accounts: { total: account.total, guests: account.guests, registered: account.registered, newAccounts: account.new_accounts },
      usage: { activeVisitors: activeVisitors, activeLearners: activeLearners, answers: answers, mastered: mastered },
      daily: daily,
      topCourses: topCourses
    };
  }

  function adminSyncQuarantines(limit) {
    const safeLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 200) : 100;
    return db.prepare(
      "SELECT s.user_id, u.username, s.source_id, s.source_hash, s.created_at, s.manifest_json " +
      "FROM user_recovery_sources s JOIN users u ON u.id=s.user_id " +
      "WHERE json_extract(s.manifest_json, '$.verified')=1 " +
      "AND json_extract(s.manifest_json, '$.syncConflict.kind')='background-conflict-quarantine' " +
      "ORDER BY s.created_at DESC, s.source_id DESC LIMIT ?"
    ).all(safeLimit).map(row => {
      let manifest = {};
      try { manifest = JSON.parse(row.manifest_json); } catch (_) {}
      const conflict = manifest.syncConflict || {};
      return {
        userId: row.user_id,
        username: row.username,
        sourceId: row.source_id,
        sourceHash: row.source_hash,
        archivedAt: row.created_at,
        state: 'archived-unresolved',
        conflict: {
          entity: conflict.entity || 'unknown',
          batch: conflict.batch === true,
          capturedAt: conflict.capturedAt || null,
          localHash: conflict.localHash || null,
          remoteHash: conflict.remoteHash || null
        }
      };
    });
  }

  function adminSaveFailures(limit) {
    const safeLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 200) : 100;
    return db.prepare(
      "SELECT code, status, COUNT(*) AS occurrences, MAX(created_at) AS latest_at, " +
      "(SELECT f2.trace_id FROM user_operation_failures f2 WHERE f2.code=f.code AND f2.status=f.status " +
      "AND f2.created_at >= datetime('now', '-7 days') ORDER BY f2.created_at DESC, f2.id DESC LIMIT 1) AS trace_id " +
      "FROM user_operation_failures f WHERE f.created_at >= datetime('now', '-7 days') " +
      "GROUP BY code, status ORDER BY latest_at DESC LIMIT ?"
    ).all(safeLimit).map(row => ({
      code: row.code,
      status: Number(row.status),
      occurrences: Number(row.occurrences),
      latestAt: row.latest_at,
      traceId: row.trace_id
    }));
  }

  function adminSaveHealth() {
    const now = Date.now();
    const row = db.prepare(
      'SELECT COUNT(*) AS clients, COUNT(DISTINCT user_id) AS accounts, ' +
      'COALESCE(SUM(pending),0) AS pending, COALESCE(SUM(blocked),0) AS blocked, ' +
      'COALESCE(SUM(retry_attempts),0) AS retry_attempts, MIN(oldest_pending_at) AS oldest_pending_at, ' +
      'MAX(updated_at) AS latest_at FROM user_client_save_health WHERE updated_at >= ?'
    ).get(now - 30 * 60 * 1000);
    const successfulOperations = Number(db.prepare(
      "SELECT COUNT(*) AS count FROM user_operation_receipts WHERE created_at >= datetime('now', '-7 days')"
    ).get().count);
    const migrationRetainedItems = Number(db.prepare(
      "SELECT COUNT(*) AS count FROM user_recovery_sources s, json_tree(s.manifest_json, '$.migration.items') item " +
      "WHERE json_extract(s.manifest_json, '$.verified')=1 AND item.type='object' " +
      "AND json_extract(item.value, '$.status')='retained-with-reason'"
    ).get().count);
    return {
      windowMinutes: 30,
      activeClients: Number(row.clients),
      activeAccounts: Number(row.accounts),
      pending: Number(row.pending),
      blocked: Number(row.blocked),
      retryAttempts: Number(row.retry_attempts),
      successfulOperations,
      migrationRetainedItems,
      oldestPendingAt: row.oldest_pending_at == null ? null : Number(row.oldest_pending_at),
      latestAt: row.latest_at == null ? null : Number(row.latest_at)
    };
  }

  return { adminOnly, parseRangeDays, adminOverview, adminSyncQuarantines, adminSaveFailures, adminSaveHealth };
}

module.exports = { createAdminOverview };
