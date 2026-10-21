'use strict';

function createEnvironmentCodeKeyring(env = process.env) {
  let keys;
  let currentVersion;
  try {
    const parsed = JSON.parse(env.MEMBERSHIP_CODE_HMAC_KEYS || '{}');
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid key map');
    keys = new Map(Object.entries(parsed).map(([version, encoded]) => {
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(version) || typeof encoded !== 'string') throw new Error('invalid key entry');
      const secret = Buffer.from(encoded, 'base64');
      if (secret.length < 32 || secret.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('invalid key value');
      return [version, secret];
    }));
    currentVersion = env.MEMBERSHIP_CODE_HMAC_CURRENT;
  } catch (_) {
    keys = new Map();
  }
  function get(version) {
    const secret = keys.get(version);
    return secret ? { version, secret } : null;
  }
  return Object.freeze({
    current() { return currentVersion ? get(currentVersion) : null; },
    get,
    versions() { return [...keys.keys()]; }
  });
}

module.exports = { createEnvironmentCodeKeyring };
