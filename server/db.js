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
  builtin    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_kv (
  user_id INTEGER NOT NULL,
  k       TEXT NOT NULL,
  v_json  TEXT NOT NULL,
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

module.exports = db;
