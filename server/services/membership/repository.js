'use strict';

const { initializeMembershipSchema, DEFAULT_SETTINGS } = require('./schema');

/** @param {import('better-sqlite3').Database} db @param {{now:()=>number}} [clock] */
function createMembershipRepository(db, clock = Date) {
  initializeMembershipSchema(db, clock);
  const now = () => clock.now();
  const readSettings = db.prepare('SELECT revision,settings_json,created_at FROM membership_settings_revisions ORDER BY revision DESC LIMIT 1');
  const insertSettings = db.prepare('INSERT INTO membership_settings_revisions(revision,settings_json,changed_by,created_at) VALUES(?,?,?,?)');

  function getSettings() {
    const row = readSettings.get();
    if (!row) return { ...DEFAULT_SETTINGS, revision: 1 };
    return { ...JSON.parse(row.settings_json), revision: row.revision, updatedAt: row.created_at };
  }

  const saveSettingsTransaction = db.transaction((baseRevision, settings, adminId) => {
    const current = readSettings.get();
    const revision = current ? current.revision : 1;
    if (!Number.isSafeInteger(baseRevision) || baseRevision !== revision) return { status: 409, currentRevision: revision };
    const nextRevision = revision + 1;
    const value = { enabled: settings.enabled, trialDays: settings.trialDays,
      dailyLimitSeconds: settings.dailyLimitSeconds, salesUrl: settings.salesUrl || '' };
    insertSettings.run(nextRevision, JSON.stringify(value), adminId, now());
    return { status: 200, settings: { ...value, revision: nextRevision } };
  });

  function listPlans() {
    return db.prepare('SELECT plan_key AS key,display_name AS displayName,term_months AS termMonths,enabled,revision FROM membership_plans ORDER BY term_months')
      .all().map(row => ({ ...row, enabled: !!row.enabled }));
  }

  return Object.freeze({ getSettings, saveSettings: saveSettingsTransaction, listPlans,
    db, now });
}

module.exports = { createMembershipRepository };
