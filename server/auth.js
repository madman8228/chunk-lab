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
  /* P0-3（2026-09-11 安全审查）：bcrypt 只取前 72 字节，超出部分静默截断。
     故按「字节数」（非字符数）限制到 72，超长明确拒绝而非让用户误以为整串密码都生效。 */
  if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('密码最长 72 字节');
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

/** 读取账号当前状态。username 的唯一真相是 users 表——token 里的 uname 只是签发时的副本，
 *  改名后即过期，任何「当前账号名」的展示都必须走这里，不能读 token。 */
function readUser(userId) {
  const row = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  return row ? { id: row.id, username: row.username } : null;
}

/**
 * 修改「自己的」账号凭据（用户名 / 密码，二者可只给其一）。
 *
 * 为什么需要：首次访问会自动注册静默游客账号（guest_<随机>，密码随机且用户不知晓），
 * 用户无法在另一台设备登回同一份数据。本函数让用户就地把自己这个账号
 * 设成「用户名 + 自己记得住的密码」——user_id 不变 ⇒ 数据零迁移。
 *
 * 越权防护：userId 只由调用方从 token 取（server/index.js 的 auth.authenticate），
 * 本函数不接受来自请求体的 userId，因此无法改到别人的账号。
 */
function setCredentials(userId, changes) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('账号无效');
  changes = changes || {};
  const wantsUser = changes.username != null;
  const wantsPass = changes.password != null;
  if (!wantsUser && !wantsPass) throw new Error('没有需要修改的内容');

  let nextUsername = null, nextHash = null;
  if (wantsUser) {
    if (typeof changes.username !== 'string') throw new Error('用户名必须是字符串');
    const username = changes.username.trim();
    if (username.length < 2) throw new Error('用户名至少 2 个字符');
    if (username.length > 32) throw new Error('用户名最长 32 个字符');
    /* 预检只为给出友好提示；真正的唯一性由 users.username UNIQUE 约束保证
       （预检与 UPDATE 之间存在竞态，故 UPDATE 仍需捕获约束错误，见下）。 */
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id <> ?').get(username, userId);
    if (taken) throw new Error('用户名已被占用');
    nextUsername = username;
  }
  if (wantsPass) {
    if (typeof changes.password !== 'string') throw new Error('密码必须是字符串');
    if (changes.password.length < 6) throw new Error('密码至少 6 位');
    /* 与 register 同口径：bcrypt 只取前 72 字节，超长明确拒绝而非静默截断 */
    if (Buffer.byteLength(changes.password, 'utf8') > 72) throw new Error('密码最长 72 字节');
    nextHash = bcrypt.hashSync(changes.password, 10);
  }

  try {
    if (nextUsername !== null && nextHash !== null) {
      db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(nextUsername, nextHash, userId);
    } else if (nextUsername !== null) {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(nextUsername, userId);
    } else {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, userId);
    }
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.code) + String(e && e.message))) throw new Error('用户名已被占用');
    throw e;
  }

  const updated = readUser(userId);
  if (!updated) throw new Error('账号不存在');
  return updated;
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

module.exports = { register, login, signToken, verifyToken, authenticate, ensureDefaultUser, readUser, setCredentials, REQUIRE_AUTH, assertSecure };
