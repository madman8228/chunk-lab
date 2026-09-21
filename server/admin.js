/**
 * admin.js · 固定管理员账号与后台鉴权
 *
 * 管理员用户名固定为 admin。首次启动时若提供 ADMIN_PASSWORD，自动创建账号；
 * 之后只使用数据库中的 bcrypt 哈希。管理员令牌使用 ADMIN_JWT_SECRET，未配置
 * 强随机密钥时拒绝登录，避免开放模式的开发占位密钥被用于后台。
 */
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const ADMIN_USERNAME = 'admin';
const DEV_FALLBACK_SECRET = 'chunklab-dev-secret-change-me';
const TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '12h';

function secret() {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '';
}

function assertSecureSecret() {
  const value = secret();
  if (!value || value === DEV_FALLBACK_SECRET || value.length < 32) {
    throw new Error('管理员后台需要配置 ADMIN_JWT_SECRET（至少 32 位随机字符串）');
  }
  return value;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('管理员密码至少 8 位');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('管理员密码最长 72 字节');
  }
}

function ensureAdminUser() {
  const existing = db.prepare('SELECT id, username FROM admin_users WHERE id=1').get();
  if (existing) return { configured: true, username: existing.username };

  const password = process.env.ADMIN_PASSWORD;
  if (!password) return { configured: false, username: ADMIN_USERNAME };
  validatePassword(password);
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (1, ?, ?)')
    .run(ADMIN_USERNAME, hash);
  return { configured: true, username: ADMIN_USERNAME, initialized: true };
}

function signToken() {
  const row = db.prepare('SELECT token_version FROM admin_users WHERE id=1').get();
  return jwt.sign({ role: 'admin', adminId: 1, uname: ADMIN_USERNAME, ver: row ? row.token_version : 1 }, assertSecureSecret(), {
    expiresIn: TOKEN_TTL
  });
}

function login(password) {
  ensureAdminUser();
  assertSecureSecret();
  const row = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE id=1').get();
  if (!row || !bcrypt.compareSync(typeof password === 'string' ? password : '', row.password_hash)) {
    throw new Error('管理员密码错误');
  }
  return { token: signToken(), admin: { id: row.id, username: row.username } };
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, assertSecureSecret());
    if (payload.role !== 'admin' || Number(payload.adminId) !== 1) return null;
    const row = db.prepare('SELECT id, username, token_version FROM admin_users WHERE id=1').get();
    if (!row || Number(payload.ver || 1) !== Number(row.token_version || 1)) return null;
    return row ? { id: row.id, username: row.username } : null;
  } catch (e) {
    return null;
  }
}

function changePassword(password) {
  validatePassword(password);
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE admin_users SET password_hash=?, token_version=token_version+1, updated_at=datetime('now') WHERE id=1").run(hash);
}

module.exports = {
  ADMIN_USERNAME,
  ensureAdminUser,
  login,
  verifyToken,
  changePassword,
};
