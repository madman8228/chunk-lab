/**
 * auth.js · 注册 / 登录 / 鉴权
 *
 * v1 默认关闭注册鉴权（REQUIRE_AUTH=false）：
 *   - 所有请求自动落到单一「默认用户」，无需登录即可学习
 *   - 前端不弹登录框，直接云端同步
 * 部署时设 REQUIRE_AUTH=true 即切换为完整多用户：
 *   - 密码 bcrypt 哈希，登录签发 JWT，请求带 Authorization: Bearer <token>
 *   - schema 已按 user_id 隔离，无需改表
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// v1 默认关闭注册鉴权（REQUIRE_AUTH=true 才启用多用户）
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';
/** 占位密钥：仅开放模式下的兜底值。多用户模式（REQUIRE_AUTH=true）下禁止落到该值——
 *  任何签发/验签路径都会先过 assertSecure()，配置不安全直接抛错，杜绝用公开占位密钥签 JWT。 */
const DEV_FALLBACK_SECRET = 'chunklab-dev-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
const TOKEN_TTL = process.env.TOKEN_TTL || '30d';

/** 安全断言：多用户模式必须有真实随机密钥。任一入口（主服务/工具/脚本）签发或验签
 *  token 前都必须通过，否则抛错（fail-fast，不静默降级）。生成：openssl rand -hex 32
 *  P0（2026-09-09）：强度下限 32 字符，杜绝弱密钥上线（smoke 用的 36 字符测试密钥可过）。 */
function assertSecure() {
  if (REQUIRE_AUTH && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_FALLBACK_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('REQUIRE_AUTH=true 但 JWT_SECRET 缺失/占位/短于 32 字符，拒绝签发/验签令牌（生成：openssl rand -hex 32）');
  }
}
function isSecure() {
  try { assertSecure(); return true; } catch (e) { return false; }
}

let DEFAULT_USER_ID = null;

/** 确保默认用户存在，返回其 id（开放模式所有请求都落到这个用户） */
function ensureDefaultUser() {
  if (DEFAULT_USER_ID != null) return DEFAULT_USER_ID;
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get('__default__');
  if (row) { DEFAULT_USER_ID = row.id; return DEFAULT_USER_ID; }
  const hash = bcrypt.hashSync(Math.random().toString(36), 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('__default__', hash);
  DEFAULT_USER_ID = Number(info.lastInsertRowid);
  return DEFAULT_USER_ID;
}

function register(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') throw new Error('用户名与密码必须是字符串');
  username = username.trim();
  if (username.length < 2) throw new Error('用户名至少 2 个字符');
  if (username.length > 32) throw new Error('用户名最长 32 个字符');
  if (password.length < 6) throw new Error('密码至少 6 位');
  if (password.length > 128) throw new Error('密码最长 128 位'); /* bcrypt 只取前 72 字节，超长静默截断是隐患 */
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) throw new Error('用户名已存在');
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  return { id: info.lastInsertRowid, username };
}

function login(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') throw new Error('用户名与密码必须是字符串');
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!row) throw new Error('用户名或密码错误');
  if (!bcrypt.compareSync(password || '', row.password_hash)) throw new Error('用户名或密码错误');
  return { id: row.id, username: row.username };
}

function signToken(userId, username) {
  assertSecure(); // 密钥不安全时任何入口都签不出 token
  return jwt.sign({ uid: userId, uname: username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  if (!isSecure()) return null; // 配置不安全一律视为未登录（401），绝不用占位密钥验签
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { userId: payload.uid, username: payload.uname };
  } catch (e) {
    return null;
  }
}

/**
 * 通用鉴权中间件：
 *   - REQUIRE_AUTH=true  → 校验 JWT，挂 req.userId / req.username
 *   - REQUIRE_AUTH=false → 落到默认用户（免登录）
 */
function authenticate(req, res, next) {
  if (REQUIRE_AUTH) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const auth = token ? verifyToken(token) : null;
    if (!auth) return res.status(401).json({ error: '未登录或登录已过期' });
    req.userId = auth.userId;
    req.username = auth.username;
  } else {
    req.userId = ensureDefaultUser();
    req.username = 'default';
  }
  next();
}

module.exports = { register, login, signToken, verifyToken, authenticate, ensureDefaultUser, REQUIRE_AUTH, assertSecure };
