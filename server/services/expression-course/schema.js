'use strict';

function ensureExpressionCourseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expression_courses (
      course_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      active_release TEXT, status TEXT NOT NULL CHECK(status IN ('active','unlisted')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS expression_drafts (
      draft_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload_json TEXT NOT NULL,
      review_hash TEXT, updated_by INTEGER NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS expression_releases (
      course_id TEXT NOT NULL REFERENCES expression_courses(course_id), release_id TEXT NOT NULL,
      content_hash TEXT NOT NULL, content_json TEXT NOT NULL, review_hash TEXT NOT NULL,
      created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(course_id, release_id), UNIQUE(course_id, content_hash)
    );
    CREATE TABLE IF NOT EXISTS expression_assets (
      sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64), mime_type TEXT NOT NULL,
      byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 5242880), content BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expression_release_assets (
      course_id TEXT NOT NULL, release_id TEXT NOT NULL, asset_id TEXT NOT NULL, sha256 TEXT NOT NULL REFERENCES expression_assets(sha256),
      PRIMARY KEY(course_id, release_id, asset_id),
      FOREIGN KEY(course_id, release_id) REFERENCES expression_releases(course_id, release_id)
    );
    CREATE TABLE IF NOT EXISTS expression_sessions (
      session_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, course_id TEXT NOT NULL,
      release_id TEXT NOT NULL, lesson_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('learn','review')),
      review_skill_id TEXT, review_activity_id TEXT, start_request_id TEXT, start_payload_hash TEXT,
      revision INTEGER NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS expression_attempts (
      user_id INTEGER NOT NULL, request_id TEXT NOT NULL, session_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, request_id)
    );
    CREATE INDEX IF NOT EXISTS idx_expression_session_owner ON expression_sessions(user_id, course_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_expression_due ON expression_sessions(user_id, updated_at);
    CREATE TABLE IF NOT EXISTS expression_skill_states (
      user_id INTEGER NOT NULL, course_id TEXT NOT NULL, release_id TEXT NOT NULL, skill_id TEXT NOT NULL,
      status TEXT NOT NULL, due_at INTEGER, review_step INTEGER NOT NULL DEFAULT 0, evidence_json TEXT NOT NULL,
      PRIMARY KEY(user_id, course_id, release_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS expression_admin_receipts (
      admin_id INTEGER NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, result_json TEXT NOT NULL,
      PRIMARY KEY(admin_id, request_id)
    );
  `);
  const columns = new Set(db.prepare('PRAGMA table_info(expression_sessions)').all().map(column => column.name));
  if (!columns.has('review_skill_id')) db.exec('ALTER TABLE expression_sessions ADD COLUMN review_skill_id TEXT');
  if (!columns.has('review_activity_id')) db.exec('ALTER TABLE expression_sessions ADD COLUMN review_activity_id TEXT');
  if (!columns.has('start_request_id')) db.exec('ALTER TABLE expression_sessions ADD COLUMN start_request_id TEXT');
  if (!columns.has('start_payload_hash')) db.exec('ALTER TABLE expression_sessions ADD COLUMN start_payload_hash TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_expression_start_request ON expression_sessions(user_id,start_request_id) WHERE start_request_id IS NOT NULL');
}

module.exports = { ensureExpressionCourseSchema };
