'use strict';

const DEFAULT_SETTINGS = Object.freeze({ enabled: true, trialDays: 3, dailyLimitSeconds: 1800, salesUrl: '' });
const DEFAULT_PLANS = Object.freeze([
  ['monthly', '包月会员', 1], ['quarterly', '包季会员', 3], ['yearly', '包年会员', 12]
]);

/** @param {import('better-sqlite3').Database} db @param {{now:()=>number}} [clock] */
function initializeMembershipSchema(db, clock = Date) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS membership_course_publications (
      publication_id TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','published')),
      compiled_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      registry_entry_json TEXT,
      created_at INTEGER NOT NULL,
      published_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS membership_static_activations (
      request_id TEXT PRIMARY KEY,
      payload_hash TEXT NOT NULL,
      previous_registry_hash TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      changed_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS membership_settings_revisions (
      revision INTEGER PRIMARY KEY,
      settings_json TEXT NOT NULL,
      changed_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS membership_content_publication_revisions (
      publication_id TEXT NOT NULL REFERENCES membership_course_publications(publication_id),
      revision INTEGER NOT NULL,
      previous_registry_hash TEXT NOT NULL,
      registry_entry_hash TEXT NOT NULL,
      source_manifest_json TEXT NOT NULL,
      files_json TEXT NOT NULL,
      changed_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(publication_id,revision)
    );
    CREATE TABLE IF NOT EXISTS membership_plans (
      plan_key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      term_months INTEGER NOT NULL CHECK(term_months BETWEEN 1 AND 120),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS redemption_batches (
      batch_id TEXT PRIMARY KEY,
      plan_snapshot_json TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10000),
      redeem_by INTEGER,
      channel_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('paused','active','revoked')),
      revision INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      activated_by INTEGER,
      activated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS redemption_codes (
      code_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES redemption_batches(batch_id),
      code_digest TEXT NOT NULL UNIQUE,
      key_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unused','redeemed','revoked')),
      created_at INTEGER NOT NULL,
      redeemed_by INTEGER REFERENCES users(id),
      redeemed_at INTEGER,
      grant_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_redemption_codes_batch ON redemption_codes(batch_id,status);
    CREATE TABLE IF NOT EXISTS user_entitlement_grants (
      grant_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      sequence INTEGER NOT NULL,
      source_code_id TEXT NOT NULL UNIQUE REFERENCES redemption_codes(code_id),
      plan_key TEXT NOT NULL,
      term_months INTEGER NOT NULL CHECK(term_months BETWEEN 1 AND 120),
      display_name TEXT NOT NULL,
      redeemed_at INTEGER NOT NULL,
      revoked_at INTEGER,
      revoked_by INTEGER,
      revoke_reason TEXT,
      UNIQUE(user_id,sequence)
    );
    CREATE INDEX IF NOT EXISTS idx_entitlement_grants_user ON user_entitlement_grants(user_id,sequence);
    CREATE TABLE IF NOT EXISTS user_membership_revisions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_entitlement_periods (
      user_id INTEGER NOT NULL REFERENCES users(id),
      period_index INTEGER NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      anchor_at INTEGER NOT NULL,
      cumulative_months INTEGER NOT NULL,
      grant_ids_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      PRIMARY KEY(user_id,period_index)
    );
    CREATE TABLE IF NOT EXISTS redemption_receipts (
      user_id INTEGER NOT NULL REFERENCES users(id),
      request_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      code_id TEXT,
      grant_id TEXT,
      outcome TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS admin_issue_receipts (
      admin_id INTEGER NOT NULL,
      request_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      batch_id TEXT NOT NULL REFERENCES redemption_batches(batch_id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY(admin_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS membership_admin_mutation_receipts (
      admin_id INTEGER NOT NULL,
      request_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(admin_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS membership_admin_audit (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS redemption_attempts (
      attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_key TEXT NOT NULL,
      ip_key TEXT NOT NULL,
      succeeded INTEGER NOT NULL CHECK(succeeded IN (0,1)),
      attempted_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_redemption_attempts_account_time ON redemption_attempts(account_key,attempted_at);
    CREATE INDEX IF NOT EXISTS idx_redemption_attempts_ip_time ON redemption_attempts(ip_key,attempted_at);
    CREATE TABLE IF NOT EXISTS user_trial_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('active','expired','closed_by_redemption')),
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
      trial_days INTEGER NOT NULL,
      daily_limit_seconds INTEGER NOT NULL,
      policy_revision INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS user_trial_windows (
      user_id INTEGER NOT NULL REFERENCES users(id),
      day_index INTEGER NOT NULL,
      used_ms INTEGER NOT NULL DEFAULT 0 CHECK(used_ms >= 0),
      reserved_ms INTEGER NOT NULL DEFAULT 0 CHECK(reserved_ms >= 0),
      revision INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(user_id,day_index)
    );
    CREATE TABLE IF NOT EXISTS user_trial_sessions (
      session_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      course_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','paused','ended','expired','superseded')),
      started_at INTEGER NOT NULL,
      last_settled_at INTEGER NOT NULL,
      lease_ends_at INTEGER NOT NULL,
      heartbeat_sequence INTEGER NOT NULL DEFAULT 0,
      request_id TEXT NOT NULL,
      UNIQUE(user_id,request_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_one_active_session ON user_trial_sessions(user_id) WHERE status='active';
    CREATE TABLE IF NOT EXISTS user_trial_session_receipts (
      session_id TEXT NOT NULL REFERENCES user_trial_sessions(session_id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      sequence INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('heartbeat','pause')),
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(session_id,sequence)
    );
    CREATE TABLE IF NOT EXISTS course_access_revisions (
      course_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      access_level TEXT NOT NULL CHECK(access_level IN ('free','member')),
      registry_version TEXT NOT NULL,
      changed_by INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      PRIMARY KEY(course_id,revision)
    );
    CREATE TABLE IF NOT EXISTS course_learning_start_receipts (
      user_id INTEGER NOT NULL REFERENCES users(id),
      request_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      session_id TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS course_learning_session_scopes (
      session_id TEXT PRIMARY KEY REFERENCES user_trial_sessions(session_id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      course_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      asset_ids_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const seed = db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM membership_settings_revisions LIMIT 1').get()) {
      db.prepare('INSERT INTO membership_settings_revisions(revision,settings_json,changed_by,created_at) VALUES(1,?,0,?)')
        .run(JSON.stringify(DEFAULT_SETTINGS), clock.now());
    }
    const putPlan = db.prepare(`INSERT OR IGNORE INTO membership_plans
      (plan_key,display_name,term_months,enabled,revision,updated_at) VALUES(?,?,?,1,1,?)`);
    for (const [key, name, months] of DEFAULT_PLANS) putPlan.run(key, name, months, clock.now());
  });
  seed();
}

module.exports = { initializeMembershipSchema, DEFAULT_SETTINGS, DEFAULT_PLANS };
