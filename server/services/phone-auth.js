'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { aliyunProvider } = require('./sms-verification');

function fail(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}
function phoneNumber(value) {
  if (typeof value !== 'string' || !/^1[3-9]\d{9}$/.test(value.trim())) {
    throw fail('INVALID_PHONE', '请输入正确的中国大陆手机号');
  }
  return value.trim();
}

function createPhoneAuth({ db, provider = undefined, now = Date.now, env = process.env }) {
  // Additive tables: never rename or replace existing users or learning records.
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_phone_identities (
      phone TEXT PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      verified_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phone_auth_challenges (
      id TEXT PRIMARY KEY, phone TEXT NOT NULL, ip_hash TEXT NOT NULL,
      purpose TEXT NOT NULL, owner_id INTEGER, created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS phone_auth_phone_time ON phone_auth_challenges(phone, created_at);
    CREATE INDEX IF NOT EXISTS phone_auth_ip_time ON phone_auth_challenges(ip_hash, created_at);
  `);
  const sms = () => provider || aliyunProvider(env);
  function ownerPhone(id) {
    const row = db.prepare('SELECT phone FROM user_phone_identities WHERE user_id=?').get(id);
    return row ? row.phone.slice(0, 3) + '****' + row.phone.slice(7) : null;
  }
  async function send({ phone: raw, ip, purpose = 'login', ownerId = null }) {
    const phone = phoneNumber(raw);
    if (!['login', 'bind', 'register', 'reset'].includes(purpose) || (purpose === 'bind' && !ownerId)) {
      throw fail('INVALID_PURPOSE', '请重新登录后绑定手机号', 401);
    }
    const registered = db.prepare('SELECT user_id FROM user_phone_identities WHERE phone=?').get(phone);
    if (purpose === 'register' && registered) throw fail('PHONE_REGISTERED', '手机号已注册，请直接登录', 409);
    if (purpose === 'reset' && !registered) throw fail('PHONE_NOT_FOUND', '手机号尚未注册，请先注册');
    const providerInstance = sms(); // Misconfiguration must not reserve a challenge.
    const time = now();
    const hash = crypto.createHash('sha256').update(String(ip)).digest('hex');
    const reserve = db.transaction(() => {
      // Bounded retention contains only authentication challenges, never learning data.
      db.prepare('DELETE FROM phone_auth_challenges WHERE created_at < ?').run(time - 2 * 86400000);
      const latest = db.prepare('SELECT created_at FROM phone_auth_challenges WHERE phone=? ORDER BY created_at DESC LIMIT 1').get(phone);
      const phoneCount = db.prepare('SELECT count(*) n FROM phone_auth_challenges WHERE phone=? AND created_at>?').get(phone, time - 86400000).n;
      const ipCount = db.prepare('SELECT count(*) n FROM phone_auth_challenges WHERE ip_hash=? AND created_at>?').get(hash, time - 3600000).n;
      const globalCount = db.prepare('SELECT count(*) n FROM phone_auth_challenges WHERE created_at>?').get(time - 86400000).n;
      const budget = /^\d+$/.test(env.SMS_DAILY_SEND_LIMIT || '') ? Number(env.SMS_DAILY_SEND_LIMIT) : 1000;
      if ((latest && time - latest.created_at < 60000) || phoneCount >= 10 || ipCount >= 20 || globalCount >= budget) {
        throw fail('SMS_RATE_LIMIT', '请稍后再获取验证码', 429);
      }
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO phone_auth_challenges(id,phone,ip_hash,purpose,owner_id,created_at,expires_at,state) VALUES(?,?,?,?,?,?,?,?)')
        .run(id, phone, hash, purpose, ownerId, time, time + 300000, 'sending');
      return id;
    });
    const id = reserve.immediate();
    try {
      await providerInstance.send(phone, id);
      db.prepare("UPDATE phone_auth_challenges SET state='ready' WHERE id=? AND state='sending'").run(id);
      return { challengeId: id, expiresIn: 300, retryAfter: 60 };
    } catch (_) {
      db.prepare("UPDATE phone_auth_challenges SET state='failed' WHERE id=?").run(id);
      throw fail('SMS_UNAVAILABLE', '验证码暂未发送成功，请稍后再试', 503);
    }
  }
  async function verify({ phone: raw, code, challengeId, purpose = 'login', ownerId = null, password }) {
    const phone = phoneNumber(raw);
    let passwordHash = null;
    if (password !== undefined && password !== '') {
      if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
        throw fail('INVALID_PASSWORD', '密码至少6位，最长72字节');
      }
      passwordHash = await bcrypt.hash(password, 10);
    }
    if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof challengeId !== 'string') {
      throw fail('INVALID_CODE', '请输入六位短信验证码');
    }
    const row = db.prepare('SELECT * FROM phone_auth_challenges WHERE id=?').get(challengeId);
    if (!row || row.phone !== phone || row.purpose !== purpose || row.owner_id !== ownerId ||
        row.state !== 'ready' || row.expires_at <= now() || row.attempts >= 5) {
      throw fail('INVALID_CODE', '验证码已失效，请重新获取');
    }
    const registered = db.prepare('SELECT user_id FROM user_phone_identities WHERE phone=?').get(phone);
    if ((purpose === 'register' || purpose === 'reset' || purpose === 'login' && !registered) && !passwordHash) {
      throw fail('INVALID_PASSWORD', '请设置密码：至少6位，最长72字节');
    }
    const claimed = db.prepare("UPDATE phone_auth_challenges SET state='checking', attempts=attempts+1 WHERE id=? AND state='ready' AND attempts<5").run(challengeId);
    if (!claimed.changes) throw fail('INVALID_CODE', '验证码正在核验或已失效');
    let passed;
    try { passed = await sms().verify(phone, code, challengeId); }
    catch (_) {
      // Cloud may already have consumed the code: never silently retry verification.
      db.prepare("UPDATE phone_auth_challenges SET state='failed' WHERE id=?").run(challengeId);
      throw fail('SMS_UNAVAILABLE', '暂时无法确认验证码，请稍后重新获取', 503);
    }
    if (!passed) {
      db.prepare("UPDATE phone_auth_challenges SET state='ready' WHERE id=?").run(challengeId);
      throw fail('INVALID_CODE', '验证码不正确，请重新输入');
    }
    return db.transaction(() => {
      db.prepare("UPDATE phone_auth_challenges SET state='consumed' WHERE id=?").run(challengeId);
      const existing = db.prepare('SELECT user_id FROM user_phone_identities WHERE phone=?').get(phone);
      if (purpose === 'bind') {
        const already = db.prepare('SELECT phone FROM user_phone_identities WHERE user_id=?').get(ownerId);
        if ((existing && existing.user_id !== ownerId) || (already && already.phone !== phone)) {
          return { error: fail('PHONE_ALREADY_BOUND', '手机号已绑定账号，不能自动合并学习记录', 409) };
        }
        if (!db.prepare('SELECT id FROM users WHERE id=?').get(ownerId)) return { error: fail('NOT_AUTH', '请重新登录', 401) };
        if (!existing) db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run(phone, ownerId, now());
        if (passwordHash) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, ownerId);
        return { id: ownerId };
      }
      if (existing) {
        if (purpose === 'register') return { error: fail('PHONE_REGISTERED', '手机号已注册，请直接登录', 409) };
        if (passwordHash) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, existing.user_id);
        return { id: existing.user_id };
      }
      if (purpose === 'reset') return { error: fail('PHONE_NOT_FOUND', '手机号尚未注册，请先注册') };
      if (!passwordHash) return { error: fail('INVALID_PASSWORD', '注册必须设置密码') };
      const id = Number(db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)')
        .run('phone_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24), passwordHash).lastInsertRowid);
      db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run(phone, id, now());
      return { id };
    }).immediate();
  }
  const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
  async function passwordLogin(raw, password) {
    const phone = phoneNumber(raw);
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) throw fail('INVALID_LOGIN', '手机号或密码不正确', 401);
    const row = db.prepare('SELECT u.id,u.password_hash FROM user_phone_identities p JOIN users u ON u.id=p.user_id WHERE p.phone=?').get(phone);
    const hash = row && /^\$2[aby]\$/.test(row.password_hash) ? row.password_hash : dummyHash;
    const passed = await bcrypt.compare(password, hash);
    if (!row || hash === dummyHash || !passed) throw fail('INVALID_LOGIN', '手机号或密码不正确', 401);
    return { id: row.id };
  }
  return { send, verify, ownerPhone, passwordLogin };
}
module.exports = { createPhoneAuth, aliyunProvider, phoneNumber };
