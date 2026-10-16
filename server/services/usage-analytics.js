'use strict';

const DAY = 86400000;
const dayOf = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
const dayStart = day => Date.parse(day + 'T00:00:00+08:00');

function initializeUsageSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS user_study_pulses (
    user_id INTEGER NOT NULL REFERENCES users(id), session_id TEXT NOT NULL,
    sequence INTEGER NOT NULL, last_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,session_id));
    CREATE TABLE IF NOT EXISTS user_study_clock (
      user_id INTEGER PRIMARY KEY REFERENCES users(id), covered_until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_study_daily (
      user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL,
      kind TEXT NOT NULL, resource_id TEXT NOT NULL, active_ms INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(user_id,day,kind,resource_id));
    CREATE INDEX IF NOT EXISTS idx_study_daily_day ON user_study_daily(day,user_id);`);
}

// Read the existing durable learning records; do not copy or migrate them.
function learningEventsSql(db) {
  const has = name => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const parts = ["SELECT user_id, at, 'sentence' AS kind, COALESCE(json_extract(data_json,'$.key'),'unknown') AS resource_id FROM user_events WHERE deleted_at IS NULL AND json_extract(data_json,'$.kind')='answer'"];
  if (has('vocabulary_study_events')) parts.push("SELECT user_id,occurred_at,'wordbook',resource_id FROM vocabulary_study_events");
  if (has('vocabulary_attempts')) parts.push("SELECT user_id,occurred_at,'vocabulary','vocabulary-pilot' FROM vocabulary_attempts");
  return parts.join(' UNION ALL ');
}

function createUsageAnalytics({ db, now = Date.now, resourceName = (_userId, kind) => ({ sentence: '句子练习', wordbook: '单词本练习', vocabulary: '入门单词练习' }[kind]) }) {
  const pulseTx = db.transaction((userId, body) => {
    const time = now();
    const previous = db.prepare('SELECT sequence,last_at FROM user_study_pulses WHERE user_id=? AND session_id=?').get(userId, body.sessionId);
    if (previous && body.sequence <= previous.sequence) return { ok: true, creditedMs: 0, replay: true };
    const clock = db.prepare('SELECT covered_until FROM user_study_clock WHERE user_id=?').get(userId);
    // Both elapsed wall time and the client foreground sample bound each pulse.
    // A global account clock takes the union across tabs and devices.
    let start = Math.max(time - body.elapsedMs, previous ? previous.last_at : time, clock ? clock.covered_until : 0);
    const creditedMs = Math.max(0, time - start);
    const put = db.prepare(`INSERT INTO user_study_daily(user_id,day,kind,resource_id,active_ms) VALUES(?,?,?,?,?)
      ON CONFLICT(user_id,day,kind,resource_id) DO UPDATE SET active_ms=active_ms+excluded.active_ms`);
    while (start < time) {
      const day = dayOf(start), end = Math.min(time, dayStart(day) + DAY);
      put.run(userId, day, body.kind, body.resourceId, end - start);
      start = end;
    }
    db.prepare(`INSERT INTO user_study_pulses VALUES(?,?,?,?) ON CONFLICT(user_id,session_id)
      DO UPDATE SET sequence=excluded.sequence,last_at=MAX(last_at,excluded.last_at)`)
      .run(userId, body.sessionId, body.sequence, time);
    if (creditedMs) db.prepare(`INSERT INTO user_study_clock VALUES(?,?) ON CONFLICT(user_id)
      DO UPDATE SET covered_until=MAX(covered_until,excluded.covered_until)`).run(userId, time);
    return { ok: true, creditedMs };
  });
  function pulse(userId, body) {
    if (!body || typeof body.sessionId !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(body.sessionId) ||
      !Number.isSafeInteger(body.sequence) || body.sequence < 1 ||
      !Number.isSafeInteger(body.elapsedMs) || body.elapsedMs < 0 || body.elapsedMs > 30000 ||
      !['sentence', 'wordbook', 'vocabulary'].includes(body.kind) ||
      typeof body.resourceId !== 'string' || !/^[A-Za-z0-9:._#/-]{1,200}$/.test(body.resourceId)) {
      throw Object.assign(new Error('学习计时格式不正确'), { status: 400 });
    }
    return pulseTx.immediate(userId, body);
  }
  function userTime(userId, details = true) {
    const today = dayOf(now());
    const summary = db.prepare(`SELECT COALESCE(SUM(active_ms),0) AS totalMs,
      COALESCE(SUM(CASE WHEN day=? THEN active_ms ELSE 0 END),0) AS todayMs FROM user_study_daily WHERE user_id=?`).get(today, userId);
    if (!details) return summary;
    const daily = db.prepare('SELECT day,SUM(active_ms) AS activeMs FROM user_study_daily WHERE user_id=? GROUP BY day ORDER BY day DESC LIMIT 30').all(userId);
    const courses = db.prepare('SELECT kind,resource_id AS resourceId,SUM(active_ms) AS activeMs FROM user_study_daily WHERE user_id=? GROUP BY kind,resource_id ORDER BY activeMs DESC LIMIT 50').all(userId);
    return { ...summary, daily, courses: courses.map(row => ({ ...row, name: resourceName(userId, row.kind, row.resourceId) })) };
  }
  return { pulse, userTime };
}

module.exports = { initializeUsageSchema, createUsageAnalytics, learningEventsSql, dayOf, dayStart, DAY };
