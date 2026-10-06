'use strict';

const SETTINGS_FIELDS = new Set([
  'sound', 'shuffle', 'fxStack', 'celebrate', 'mode', 'skipMastered', 'batchSize',
  'autoSpeak', 'darkMode', 'provider', 'model', 'dailyGoal', 'voice',
  'speechRate', 'showTranslation', 'autoNext', 'keyboardShortcuts'
]);

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

function createSettingsOperations(options) {
  const db = options.db;
  const upsertKv = options.upsertKv;
  const operationError = options.operationError;

  function apply(userId, body, seq) {
    if (body.type !== 'settings.patch') return null;
    const payload = body.payload;
    if (!hasOnlyKeys(payload, ['patch']) || body.expected !== undefined || body.expectedRev !== undefined) {
      throw operationError('设置操作只接受需要更新的字段', 'INVALID_OPERATION', 400);
    }
    if (!object(payload.patch) || Object.keys(payload.patch).length < 1 ||
        Object.keys(payload.patch).length > SETTINGS_FIELDS.size ||
        Object.keys(payload.patch).some(key => !SETTINGS_FIELDS.has(key))) {
      throw operationError('设置字段无效', 'INVALID_OPERATION', 400);
    }

    const row = db.prepare("SELECT v_json,rev,deleted_at FROM user_kv WHERE user_id=? AND k='settings'").get(userId);
    const current = row && !row.deleted_at ? JSON.parse(row.v_json) : {};
    const currentRev = row && row.rev != null ? row.rev : null;
    Object.keys(payload.patch).forEach(key => {
      const value = payload.patch[key];
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
        throw operationError('设置值必须是文本、数字或开关', 'INVALID_OPERATION', 400);
      }
      if (typeof value === 'string' && value.length > 200) throw operationError('设置文本过长', 'INVALID_OPERATION', 400);
      current[key] = value;
    });
    const rev = (currentRev == null ? 0 : currentRev) + 1;
    upsertKv(userId, 'settings', current, rev, false, seq, currentRev);
    return { entity: 'kv', id: 'settings', rev, changedFields: Object.keys(payload.patch) };
  }

  return Object.freeze({ apply });
}

module.exports = { createSettingsOperations };
