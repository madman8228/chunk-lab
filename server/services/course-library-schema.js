'use strict';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS course_contents (
  course_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('deck', 'course')),
  title TEXT NOT NULL,
  active_release TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS course_content_releases (
  course_id TEXT NOT NULL REFERENCES course_contents(course_id),
  release_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (course_id, release_id),
  UNIQUE (course_id, content_hash)
);
CREATE TABLE IF NOT EXISTS course_asset_blobs (
  sha256 TEXT PRIMARY KEY CHECK (length(sha256)=64),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','audio/mpeg','audio/ogg','audio/wav')),
  byte_length INTEGER NOT NULL CHECK (byte_length > 0),
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS course_content_release_assets (
  course_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  sha256 TEXT NOT NULL REFERENCES course_asset_blobs(sha256),
  PRIMARY KEY (course_id, release_id, asset_id),
  FOREIGN KEY (course_id, release_id) REFERENCES course_content_releases(course_id, release_id)
);
CREATE TABLE IF NOT EXISTS course_content_access (
  course_id TEXT NOT NULL REFERENCES course_contents(course_id),
  subject_user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'reader')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (course_id, subject_user_id)
);
CREATE TABLE IF NOT EXISTS course_content_import_receipts (
  user_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, request_id)
);
CREATE TABLE IF NOT EXISTS course_content_legacy_mappings (
  source_user_id INTEGER NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('deck', 'course')),
  source_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES course_contents(course_id),
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_user_id, source_kind, source_id),
  UNIQUE (course_id)
);
CREATE INDEX IF NOT EXISTS idx_course_content_access_subject
  ON course_content_access(subject_user_id, course_id);
`;

function ensureCourseLibrarySchema(db) {
  db.exec(SCHEMA);
  const columns = new Set(db.pragma('table_info(course_contents)').map(column => column.name));
  if (!columns.has('visibility')) {
    db.exec("ALTER TABLE course_contents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'))");
  }
}

module.exports = { ensureCourseLibrarySchema };
