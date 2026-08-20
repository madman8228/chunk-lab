/**
 * db.js · SQLite 连接与表结构
 *
 * 多用户隔离模型：
 *   users                 — 账号
 *   user_decks            — 用户自定义题库（内置 deck 仍由前端 builtins.js 提供，不入库）
 *   user_kv               — 键值型用户数据（best / mastered / stats / settings / reinforceBook / deletedItems）
 *   user_courses          — 用户图文课程（chunklab.courses.v1 的逐条拆分，便于增量）
 *   user_course_progress  — 课程进度（chunklab.course-progress.v1 的逐条拆分）
 *   ai_cache              — AI 详解缓存（全局共享，key = 模型+归一化句子）
 *
 * ADR-005（实体级 rev upsert + 软删除）：
 *   每个可同步实体带 `rev`（整数版本号，本地每次变更 +1）与 `deleted_at`（软删除标记）。
 *   服务端 upsert 用 `ON CONFLICT ... DO UPDATE ... WHERE excluded.rev IS NULL OR excluded.rev > <table>.rev`
 *   —— 旧版本写入被拒、新版本胜出，互不覆盖无关改动；崩溃不会清空用户数据（不再整块 DELETE）。
 *   旧数据/旧客户端无 rev（rev 默认 0 且写入时传 null）→ 退化为「总是覆盖」，向后兼容。
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.CHUNKLAB_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'chunklab.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_decks (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  items_json TEXT NOT NULL,
  builtin    INTEGER,
  rev        INTEGER,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_kv (
  user_id INTEGER NOT NULL,
  k       TEXT NOT NULL,
  v_json  TEXT NOT NULL,
  rev        INTEGER,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, k),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_courses (
  user_id    INTEGER NOT NULL,
  course_id  TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_course_progress (
  user_id    INTEGER NOT NULL,
  course_id  TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key       TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decks_user ON user_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_kv_user ON user_kv(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user ON user_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_course_progress(user_id);
`);

/* ----- ADR-005 迁移：给已存在的表补 rev / deleted_at 列 -----
   CREATE TABLE IF NOT EXISTS 不会改已有表，故对升级前的库做 ALTER ADD COLUMN。 */
function addColumnIfMissing(table, col, type) {
  const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(function (r) { return r.name; });
  if (cols.indexOf(col) < 0) {
    db.prepare('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + type).run();
  }
}
['user_decks', 'user_kv', 'user_courses', 'user_course_progress'].forEach(function (t) {
  addColumnIfMissing(t, 'rev', 'INTEGER');
  addColumnIfMissing(t, 'deleted_at', 'TEXT');
});
// user_kv 升级前无 updated_at（user_decks 有），补列；旧行 NULL，由 upsert 显式赋值
addColumnIfMissing('user_kv', 'updated_at', 'TEXT');

module.exports = db;
