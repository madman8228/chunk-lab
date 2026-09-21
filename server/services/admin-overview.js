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

  return { adminOnly, parseRangeDays, adminOverview };
}

module.exports = { createAdminOverview };
