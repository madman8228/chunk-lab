'use strict';

// Keep the legacy API type keys; registration is determined by verified identity,
// including accounts that retain their original guest_ username after binding.
function adminAccountTypeSql(db) {
  const hasPhoneIdentities = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_phone_identities'"
  ).get();
  const verified = hasPhoneIdentities
    ? 'EXISTS (SELECT 1 FROM user_phone_identities p WHERE p.user_id=u.id AND p.verified_at IS NOT NULL)'
    : '0';
  return "CASE WHEN u.username='__default__' THEN 'default' WHEN " + verified +
    " THEN 'registered' ELSE 'guest' END";
}

module.exports = { adminAccountTypeSql };
