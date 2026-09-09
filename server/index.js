/**
 * index.js · Chunk Lab 云端后端入口
 *
 * 路由总览（前缀 /api）：
 *   鉴权：POST /auth/register  POST /auth/login  GET /auth/me
 *   数据：GET  /data          PUT /data            （整份 mem + courses + courseProgress）
 *         POST /courses       DELETE /courses/:id  （单条课程导入/删除）
 *   备份：GET  /export        POST /import          （完整备份 JSON 导入导出）
 *   健康：GET  /health
 *
 * 所有数据接口需 Authorization: Bearer <token>（JWT）。
 * 前后端分离：前端与 API 同源部署无需 CORS；跨域须显式配 CORS_ORIGINS（留空 = 拒绝跨域，fail-closed）。
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const validate = require('./validate');
const ai = require('./ai');

const KV_KEYS = ['best', 'mastered', 'stats', 'settings', 'reinforceBook', 'deletedItems'];

/* AI 联网生成开关（2026-09-06 产品决策：先禁联网 AI 生成，后续再开放）。
   默认关闭；开启方式：环境变量 AI_EXPLAIN_ENABLED=true（或 .env 中设置）。 */
const AI_EXPLAIN_ENABLED = String(process.env.AI_EXPLAIN_ENABLED || '').trim().toLowerCase() === 'true';

const app = express();
app.use(express.json({ limit: '80mb' })); // 图文课程含 base64 图片，可能很大

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // 同源/无 Origin 的请求（curl、同页 fetch、file://）不受 CORS 约束
    /* P0 fail-closed（2026-09-09）：未显式配置 CORS_ORIGINS 白名单 → 一律不授予跨域。
       浏览器读不到 Access-Control-Allow-Origin 即拦截，杜绝"回显任意 Origin + credentials"被恶意网页驱动。
       前端与 API 同源部署（本服务静态托管或 Nginx 反代 /api）无需 CORS，配置了白名单才放行对应域名。 */
    if (allowedOrigins.length === 0) return cb(null, false);
    if (allowedOrigins.indexOf(origin) >= 0) return cb(null, true);
    cb(new Error('CORS 不允许的来源: ' + origin));
  },
  credentials: true
}));

/* ===== 可观测性（上线前）：请求日志 + 全局指标 =====
   日志：方法 路径 状态码 耗时(ms) 用户id（轻量解析 token，不阻塞鉴权）
   指标：ai_cache 命中/未命中计数 + /api/stats 查询接口（匿名只读，无用户数据） */
const metrics = { aiCacheHits: 0, aiCacheMisses: 0, startedAt: new Date().toISOString() };
function userIdFromReq(req) {
  try {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return '-';
    const a = auth.verifyToken(t);
    return a ? String(a.userId) : '?';
  } catch (e) { return '?'; }
}
app.use(function (req, res, next) {
  const t0 = Date.now();
  res.on('finish', function () {
    const dur = Date.now() - t0;
    console.log('[req] ' + new Date().toISOString() + ' ' + req.method + ' ' + req.originalUrl + ' ' +
      res.statusCode + ' ' + dur + 'ms u:' + userIdFromReq(req));
  });
  next();
});
app.get('/api/stats', function (req, res) {
  const total = metrics.aiCacheHits + metrics.aiCacheMisses;
  res.json({
    ok: true,
    uptimeSec: Math.round((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
    aiCache: {
      hits: metrics.aiCacheHits,
      misses: metrics.aiCacheMisses,
      hitRate: total > 0 ? Math.round(metrics.aiCacheHits / total * 1000) / 1000 : null
    }
  });
});

app.get('/api/health', function (req, res) { res.json({ ok: true, ts: Date.now() }); });

/* 公开配置：前端据此决定是否弹登录框 / 是否启用联网 AI。无需鉴权。
   aiEnabled = AI_EXPLAIN_ENABLED：前端拿到 false（或拿不到 config）时收敛 AI 数据面
   （清存量 settings.apiKey，防明文 Key 随 mem 上云；删本地 ai_cache 残留），
   拿到 true 时保留 Key（自托管降级通道，仅服务端未配置 DEEPSEEK_API_KEY 时被接受）。 */
app.get('/api/config', function (req, res) {
  res.json({ requireAuth: auth.REQUIRE_AUTH, serverVersion: 1, authAvailable: true, aiEnabled: AI_EXPLAIN_ENABLED });
});

/* ===================== 鉴权 ===================== */
/* P1 认证限速（2026-09-09）：防暴力破解/撞库/批量注册。
   纯内存固定窗口（15 分钟），单实例自托管够用；多实例负载均衡需换共享存储（Redis）。
   默认读 req.ip（直连可靠）；经 Nginx 等反代时设 TRUST_PROXY=true（只信任第一跳 X-Forwarded-For）。 */
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').trim().toLowerCase() === 'true';
if (TRUST_PROXY) app.set('trust proxy', 1);

const RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE = {
  register: 10,  // 每 IP 每窗口最多 10 次注册请求（成功/失败都计，防枚举与批量建号）
  loginFail: 10  // 每 IP 每窗口最多 10 次登录失败 → 锁定 429（成功登录清零）
};
const rateBuckets = new Map(); // ip -> { register:number[], loginFail:number[] } 时间戳数组

function rateBlocked(ip, kind, max) {
  const now = Date.now();
  const b = rateBuckets.get(ip);
  const arr = b && b[kind];
  if (!arr) return false;
  while (arr.length && arr[0] <= now - RATE_WINDOW_MS) arr.shift();
  return arr.length >= max;
}
function rateHit(ip, kind, max) { // 记一次；已达上限返回 false（调用方回 429）
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b) { b = {}; rateBuckets.set(ip, b); }
  let arr = b[kind];
  if (!arr) { arr = []; b[kind] = arr; }
  while (arr.length && arr[0] <= now - RATE_WINDOW_MS) arr.shift();
  if (arr.length >= max) return false;
  arr.push(now);
  return true;
}
function rateClear(ip, kind) {
  const b = rateBuckets.get(ip);
  if (b) delete b[kind];
}
/* 定时清空过期桶，防 Map 无限膨胀（unref：不阻塞进程退出） */
setInterval(function () {
  const now = Date.now();
  for (const [ip, b] of rateBuckets) {
    for (const k of Object.keys(b)) {
      const arr = b[k];
      while (arr.length && arr[0] <= now - RATE_WINDOW_MS) arr.shift();
      if (!arr.length) delete b[k];
    }
    if (!Object.keys(b).length) rateBuckets.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

function send429(res) {
  res.set('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
  res.status(429).json({ error: '操作过于频繁，请 15 分钟后再试' });
}

app.post('/api/auth/register', function (req, res) {
  if (!auth.REQUIRE_AUTH) return res.status(403).json({ error: '开放模式无需注册' }); // P1：开放模式注册无意义且有滥用面
  if (!rateHit(req.ip, 'register', AUTH_RATE.register)) return send429(res); // 成功/失败都计数
  try {
    const u = auth.register(req.body.username, req.body.password);
    const token = auth.signToken(u.id, u.username);
    res.json({ token: token, user: { id: u.id, username: u.username } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth/login', function (req, res) {
  if (!auth.REQUIRE_AUTH) return res.status(403).json({ error: '开放模式无需登录' }); // P1：开放模式登录取缔
  const ip = req.ip;
  if (rateBlocked(ip, 'loginFail', AUTH_RATE.loginFail)) return send429(res);
  try {
    const u = auth.login(req.body.username, req.body.password);
    rateClear(ip, 'loginFail'); // 成功登录清零失败计数（防误锁）
    const token = auth.signToken(u.id, u.username);
    res.json({ token: token, user: { id: u.id, username: u.username } });
  } catch (e) {
    rateHit(ip, 'loginFail', AUTH_RATE.loginFail); // 仅失败计数
    res.status(401).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth.authenticate, function (req, res) {
  res.json({ user: { id: req.userId, username: req.username } });
});

/* ===================== 数据读写 ===================== */
function buildMem(userId) {
  const deckRows = db.prepare('SELECT id,name,items_json,builtin,is_public,rev FROM user_decks WHERE user_id=? AND deleted_at IS NULL').all(userId);
  const decks = deckRows.map(function (r) {
    return { id: r.id, name: r.name, items: JSON.parse(r.items_json), builtin: !!r.builtin, isPublic: !!r.is_public };
  });
  // revs 需含软删行：让其他设备能判断本地副本是否已过期（软删也是版本演进）
  const deckRevs = {};
  db.prepare('SELECT id,rev FROM user_decks WHERE user_id=?').all(userId)
    .forEach(function (r) { deckRevs[r.id] = r.rev; });

  const kvRows = db.prepare('SELECT k,v_json,rev FROM user_kv WHERE user_id=? AND deleted_at IS NULL').all(userId);
  const kv = {};
  kvRows.forEach(function (r) { kv[r.k] = JSON.parse(r.v_json); });
  const kvRevs = {};
  db.prepare('SELECT k,rev FROM user_kv WHERE user_id=?').all(userId)
    .forEach(function (r) { kvRevs[r.k] = r.rev; });

  const mem = {
    decks: decks,
    best: kv.best || {},
    mastered: kv.mastered || {},
    stats: kv.stats || { totalRounds: 0, totalAnswered: 0, bySentence: {} },
    settings: kv.settings || {},
    reinforceBook: kv.reinforceBook || [],
    deletedItems: kv.deletedItems || []
  };

  const courseRows = db.prepare('SELECT data_json FROM user_courses WHERE user_id=? AND deleted_at IS NULL').all(userId);
  const courses = courseRows.map(function (r) { return JSON.parse(r.data_json); });
  // revs 需含软删行：让其他设备能判断本地副本是否已过期
  const courseRevs = {};
  db.prepare('SELECT course_id,rev FROM user_courses WHERE user_id=?').all(userId)
    .forEach(function (r) { courseRevs[r.course_id] = r.rev; });

  const progRows = db.prepare('SELECT course_id,data_json FROM user_course_progress WHERE user_id=? AND deleted_at IS NULL').all(userId);
  const courseProgress = {};
  progRows.forEach(function (r) { courseProgress[r.course_id] = JSON.parse(r.data_json); });
  const progRevs = {};
  db.prepare('SELECT course_id,rev FROM user_course_progress WHERE user_id=?').all(userId)
    .forEach(function (r) { progRevs[r.course_id] = r.rev; });

  return {
    mem: mem, courses: courses, courseProgress: courseProgress,
    revs: { decks: deckRevs, kv: kvRevs, courses: courseRevs, courseProgress: progRevs }
  };
}

function upsertDeck(userId, d, rev, deleted) {
  if (deleted) {
    db.prepare("INSERT INTO user_decks (user_id,id,name,items_json,builtin,rev,deleted_at,updated_at) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(user_id,id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_decks.rev, 0)")
      .run(userId, d.id, '', '[]', 0, rev == null ? null : rev);
  } else {
    db.prepare("INSERT INTO user_decks (user_id,id,name,items_json,builtin,rev,deleted_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name, items_json=excluded.items_json, builtin=excluded.builtin, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_decks.rev, 0)")
      .run(userId, d.id, d.name, JSON.stringify(d.items || []), d.builtin ? 1 : 0, rev == null ? null : rev, null);
  }
}

function upsertKv(userId, k, v, rev, deleted) {
  if (deleted) {
    db.prepare("INSERT INTO user_kv (user_id,k,v_json,rev,deleted_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(user_id,k) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_kv.rev, 0)")
      .run(userId, k, 'null', rev == null ? null : rev);
  } else {
    db.prepare("INSERT INTO user_kv (user_id,k,v_json,rev,deleted_at,updated_at) VALUES (?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,k) DO UPDATE SET v_json=excluded.v_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_kv.rev, 0)")
      .run(userId, k, JSON.stringify(v), rev == null ? null : rev, null);
  }
}

function upsertCourse(userId, c, rev, deleted) {
  if (deleted) {
    db.prepare("INSERT INTO user_courses (user_id,course_id,data_json,rev,deleted_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(user_id,course_id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_courses.rev, 0)")
      .run(userId, c.courseId, '{}', rev == null ? null : rev);
  } else {
    db.prepare("INSERT INTO user_courses (user_id,course_id,data_json,rev,deleted_at,updated_at) VALUES (?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_courses.rev, 0)")
      .run(userId, c.courseId, JSON.stringify(c), rev == null ? null : rev, null);
  }
}

function upsertCourseProgress(userId, cid, data, rev, deleted) {
  if (deleted) {
    db.prepare("INSERT INTO user_course_progress (user_id,course_id,data_json,rev,deleted_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(user_id,course_id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_course_progress.rev, 0)")
      .run(userId, cid, 'null', rev == null ? null : rev);
  } else {
    db.prepare("INSERT INTO user_course_progress (user_id,course_id,data_json,rev,deleted_at,updated_at) VALUES (?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now') WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_course_progress.rev, 0)")
      .run(userId, cid, JSON.stringify(data), rev == null ? null : rev, null);
  }
}

function saveData(userId, body) {
  const mem = body.mem || {};
  const courses = Array.isArray(body.courses) ? body.courses : [];
  const courseProgress = body.courseProgress || {};
  const revs = body.revs || {};
  const deleted = body.deleted || {};
  const tx = db.transaction(function () {
    // decks：实体级 rev upsert（不再整块 DELETE，崩溃可恢复、多设备不互覆盖）
    (mem.decks || []).forEach(function (d) {
      upsertDeck(userId, d, (revs.decks && revs.decks[d.id]) == null ? null : revs.decks[d.id], false);
    });
    (deleted.decks || []).forEach(function (d) {
      upsertDeck(userId, { id: d.id }, d.rev, true);
    });

    // kv：实体级 rev upsert（per-key：best / mastered / stats / ...）
    KV_KEYS.forEach(function (k) {
      if (k in mem) upsertKv(userId, k, mem[k], (revs.kv && revs.kv[k]) == null ? null : revs.kv[k], false);
    });
    (deleted.kv || []).forEach(function (d) {
      upsertKv(userId, d.k, null, d.rev, true);
    });

    // courses / courseProgress：per-entity rev upsert + 软删除（ADR-005 step 2）
    courses.forEach(function (c) {
      upsertCourse(userId, c, (revs.courses && revs.courses[c.courseId]) == null ? null : revs.courses[c.courseId], false);
    });
    (deleted.courses || []).forEach(function (c) {
      upsertCourse(userId, { courseId: c.id }, c.rev, true);
    });
    Object.keys(courseProgress).forEach(function (cid) {
      upsertCourseProgress(userId, cid, courseProgress[cid], (revs.courseProgress && revs.courseProgress[cid]) == null ? null : revs.courseProgress[cid], false);
    });
    (deleted.courseProgress || []).forEach(function (c) {
      upsertCourseProgress(userId, c.id, null, c.rev, true);
    });
  });
  tx();
}

app.get('/api/data', auth.authenticate, function (req, res) {
  try { res.json(buildMem(req.userId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/data', auth.authenticate, function (req, res) {
  try {
    const verr = validate.validatePutPayload(req.body);
    if (verr) return res.status(400).json({ error: '数据校验失败：' + verr });
    saveData(req.userId, req.body || {});
    res.json({ ok: true });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courses', auth.authenticate, function (req, res) {
  const course = req.body && req.body.course;
  const verr = validate.validateCourse(course);
  if (verr) return res.status(400).json({ error: '数据校验失败：' + verr });
  try {
    // 无 rev → 总是覆盖（与旧客户端语义一致，向后兼容）
    upsertCourse(req.userId, course, null, false);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/courses/:courseId', auth.authenticate, function (req, res) {
  try {
    const cid = req.params.courseId;
    // 软删除（ADR-005）：跨设备传播，删除也是版本演进
    const row = db.prepare('SELECT rev FROM user_courses WHERE user_id=? AND course_id=?').get(req.userId, cid);
    const rev = ((row && row.rev != null) ? row.rev : 0) + 1;
    upsertCourse(req.userId, { courseId: cid }, rev, true);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ===================== 公共题库市场（Phase D） =====================
   设计：is_public 标记在 user_decks 表；内置题库（builtins.js）由前端 BUILTIN 提供，
   市场列表 = 前端 BUILTIN 元数据 + 本接口返回的用户公开题库。公开资源无需登录（市场语义）。 */
app.get('/api/deck/public', function (req, res) {
  try {
    const rows = db.prepare(
      "SELECT d.id,d.name,d.items_json,d.created_at,u.username AS author FROM user_decks d JOIN users u ON u.id=d.user_id WHERE d.is_public=1 AND d.deleted_at IS NULL ORDER BY d.updated_at DESC"
    ).all();
    const decks = rows.map(function (r) {
      let items = [];
      try { items = JSON.parse(r.items_json); } catch (e) { /* items 非法则计数 0 */ }
      return { id: r.id, name: r.name, itemCount: items.length, author: r.author, publishedAt: r.created_at };
    });
    res.json({ ok: true, decks: decks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 单个公开题库完整内容（仅 is_public=1 可读） */
app.get('/api/deck/public/:id', function (req, res) {
  try {
    const r = db.prepare(
      "SELECT d.id,d.name,d.items_json,d.created_at,u.username AS author FROM user_decks d JOIN users u ON u.id=d.user_id WHERE d.id=? AND d.is_public=1 AND d.deleted_at IS NULL"
    ).get(req.params.id);
    if (!r) return res.status(404).json({ error: '公开题库不存在或已下架' });
    res.json({ ok: true, deck: { id: r.id, name: r.name, author: r.username, publishedAt: r.created_at, items: JSON.parse(r.items_json) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 发布 / 下架我的题库（仅本人题库可操作） */
app.post('/api/deck/publish', auth.authenticate, function (req, res) {
  try {
    const deckId = (typeof (req.body && req.body.deckId) === 'string') ? req.body.deckId.trim() : '';
    const publish = req.body && req.body.publish ? 1 : 0;
    if (!deckId || deckId.length > 64) return res.status(400).json({ error: 'deckId 非法' });
    const own = db.prepare('SELECT id FROM user_decks WHERE user_id=? AND id=? AND deleted_at IS NULL').get(req.userId, deckId);
    if (!own) return res.status(404).json({ error: '题库不存在' });
    db.prepare("UPDATE user_decks SET is_public=?, updated_at=datetime('now') WHERE user_id=? AND id=?").run(publish, req.userId, deckId);
    res.json({ ok: true, isPublic: !!publish });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ===================== AI 代理（ADR-004） =====================
   API Key 不再进前端：服务端 DEEPSEEK_API_KEY 优先；自托管可经 body.apiKey 降级
   （仅当服务端未配置时被接受）。服务端 ai_cache 命中直接返回（省 token）；
   未命中 → 每用户限流 → 调模型 → 写缓存。 */
app.post('/api/ai/explain', auth.authenticate, function (req, res) {
  try {
    /* 2026-09-06：联网 AI 生成已停用（AI_EXPLAIN_ENABLED 默认 false）。
       关闭 = 一律 503，不产生任何上游调用/缓存写入；开放 = 置 env true 即可。 */
    if (!AI_EXPLAIN_ENABLED) return res.status(503).json({ ok: false, error: 'AI 解读已停用' });
    const body = req.body || {};
    const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
    if (!sentence) return res.status(400).json({ error: 'sentence 缺失' });
    if (sentence.length > 2000) return res.status(400).json({ error: 'sentence 过长' });
    const model = (typeof body.model === 'string' && body.model.trim()) ? body.model.trim() : 'deepseek-v4-flash';
    const cacheKey = model + '::' + ai.norm(sentence);

    /* 1) 服务端缓存命中（不占限流额度；AI_CACHE_TTL 内有效，过期视为 miss）
       命中判定含 AI_PROMPT_VERSION：ver 不匹配（旧版缓存/提示词升级）→ miss 重新生成 */
    const hit = AI_CACHE_TTL > 0
      ? db.prepare("SELECT value_json FROM ai_cache WHERE key=? AND updated_at >= datetime('now', ?)").get(cacheKey, '-' + AI_CACHE_TTL + ' days')
      : db.prepare('SELECT value_json FROM ai_cache WHERE key=?').get(cacheKey);
    if (hit) {
      let c = null;
      try { c = JSON.parse(hit.value_json); } catch (e) { /* 损坏视为 miss */ }
      if (c && c.ver === AI_PROMPT_VERSION) {
        metrics.aiCacheHits++;
        res.json({ ok: true, cached: true, data: c.data });
        return;
      }
      /* ver 不匹配：旧缓存作废，落到下方 miss 重新生成（重新生成后覆盖） */
    }
    metrics.aiCacheMisses++;

    /* 2) 每用户滑动窗口限流 */
    if (!ai.rateLimit(req.userId)) return res.status(429).json({ error: 'AI 请求过于频繁，请稍后再试' });

    /* 3) Key 解析：服务端 env 优先；自托管允许前端传（仅服务端未配置时被接受） */
    const apiKey = ai.DEEPSEEK_API_KEY || (typeof body.apiKey === 'string' ? body.apiKey.trim() : '');
    if (!apiKey) return res.status(400).json({ error: '服务端未配置 DEEPSEEK_API_KEY（且未提供 apiKey）' });

    /* 4) 构建提示词（与前端原版一致）并调用 DeepSeek（5xx/网络错误自动重试一次） */
    const prompt = '请用中文讲解以下英语句子，面向英语学习者。输出纯 JSON，不要代码块标记，字段：orig(原句英文)、zh(中文意思)、chunks(意群数组，每项含 text 和 role 语法角色)、grammar(核心语法要点数组)、collocations(固定搭配/短语数组)、scenario(使用场景说明)。\n句子：' + sentence + '\n中文：' + (typeof body.zh === 'string' ? body.zh : '');
    ai.callDeepSeekRetry({
      model: model,
      messages: [
        { role: 'system', content: '你是专业的英语老师，只返回 JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    }, apiKey).then(function (r) {
      if (r.status !== 200) { res.status(502).json({ error: '上游模型返回 ' + r.status + '：' + String(r.raw).slice(0, 300) }); return; }
      const data = JSON.parse(r.raw);
      const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      const clean = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
      const obj = JSON.parse(clean);
      db.prepare("INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES (?,?,datetime('now'))")
        .run(cacheKey, JSON.stringify({ data: obj, ver: AI_PROMPT_VERSION }));
      trimAiCache(AI_CACHE_MAX);
      res.json({ ok: true, cached: false, data: obj });
    }).catch(function (e) {
      res.status(502).json({ error: 'AI 调用失败：' + (e && e.message) });
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ===================== 备份导入导出 ===================== */
/* ai_cache 容量上限 + TTL 过期（ADR-008 / Phase A / C）：
   容量：备份导入可能一次性写入海量缓存，按 AI_CACHE_MAX（默认 2000）LRU 淘汰最旧；
   TTL：AI_CACHE_TTL 天（默认 30）内未使用的缓存视为过期，命中时走 miss 重新生成；
   过期条目在 trim 时懒清理（写路径触发，无需定时器）。AI_CACHE_TTL=0 表示永不过期。 */
const AI_CACHE_MAX = parseInt(process.env.AI_CACHE_MAX || '2000', 10);
const AI_CACHE_TTL = parseInt(process.env.AI_CACHE_TTL || '30', 10);
/* 提示词/模型升级时 bump：旧版本缓存（ver 不匹配）一律视为 miss 重新生成，
   防止"解读质量被旧缓存锁死"。必须与 js/ai-prompts.mjs 的 PROMPT_VERSION 同步修改。 */
const AI_PROMPT_VERSION = 1;
function trimAiCache(max) {
  if (AI_CACHE_TTL > 0) {
    db.prepare("DELETE FROM ai_cache WHERE updated_at < datetime('now', ?)").run('-' + AI_CACHE_TTL + ' days');
  }
  const row = db.prepare('SELECT COUNT(*) AS n FROM ai_cache').get();
  if (!row || row.n <= max) return;
  const excess = row.n - max;
  db.prepare('DELETE FROM ai_cache WHERE key IN (SELECT key FROM ai_cache ORDER BY updated_at ASC, rowid ASC LIMIT ?)').run(excess);
}
app.get('/api/export', auth.authenticate, function (req, res) {
  try {
    const data = buildMem(req.userId);
    const aiRows = db.prepare('SELECT key,value_json FROM ai_cache').all();
    const aiCache = {};
    aiRows.forEach(function (r) { aiCache[r.key] = JSON.parse(r.value_json); });
    res.json({
      __app: 'chunklab', __version: 2, exportedAt: new Date().toISOString(),
      mem: data.mem, courses: data.courses, courseProgress: data.courseProgress,
      reinforceBook: data.mem.reinforceBook, aiCache: aiCache
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import', auth.authenticate, function (req, res) {
  try {
    const body = req.body || {};
    const verr = validate.validatePutPayload(body);
    if (verr) return res.status(400).json({ error: '备份数据校验失败：' + verr });
    saveData(req.userId, body);
    if (body.aiCache && typeof body.aiCache === 'object') {
      const ins = db.prepare('INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES (?,?,datetime(\'now\'))');
      const tx = db.transaction(function () {
        Object.keys(body.aiCache).forEach(function (k) { ins.run(k, JSON.stringify(body.aiCache[k])); });
      });
      tx();
      trimAiCache(AI_CACHE_MAX); /* 导入后按 LRU 收敛到容量上限 */
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ===================== 静态托管前端（本地调试零配置） =====================
   开发期直接 node index.js 后打开 http://<host>:<PORT>/main.html 即可，
   前端与 API 同源，免登录、免 CORS、免配置服务器地址。
   生产部署建议由 Nginx 托管前端 + 反向代理 /api（见部署文档）。 */
app.use(function (req, res, next) {
  // 防止误部署时通过静态服务泄露后端源码、依赖、本地开发/截图产物、架构文档与测试脚本
  // P0（2026-09-09）：补 .git（实测 /\.git/config 等 200，可重建全部源码与提交历史）、e2e、deliverables、dotfiles(.env*/.workbuddy)
  if (/^\/(server|node_modules|output|scripts|extra|e2e|deliverables)\b/i.test(req.path)) return res.status(403).end('Forbidden');
  if (/\/\./.test(req.path)) return res.status(403).end('Forbidden'); // 任意层级 dotfile/dotdir：/.git、/.env、/.workbuddy、/server/.env…
  if (/\.(md|markdown|bak|tmp|log|db|sqlite|sqlite3)$/i.test(req.path) || /\.test\.js$/i.test(req.path)) return res.status(403).end('Forbidden');
  next();
});
/* 根路径 → 入口页。仓库无 index.html（入口是 main.html），express.static 对 / 会 404 "Cannot GET /" */
app.get('/', function (req, res) { res.redirect('/main.html'); });
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 8787;
auth.ensureDefaultUser(); // 开放模式：确保默认用户存在

/* P0 上线断言（2026-09-09）：生产环境禁止开放模式裸奔。
   开放模式 = 所有人共享 __default__ 单用户、免 token 可读写/导入导出，公网多人使用绝不允许。
   NODE_ENV=production 时必须 REQUIRE_AUTH=true，否则拒绝启动（fail-fast，不静默降级）。
   本地开发（未设 NODE_ENV）不受影响，仍默认开放模式免登录。 */
if (process.env.NODE_ENV === 'production' && !auth.REQUIRE_AUTH) {
  console.error('[security] FATAL: NODE_ENV=production 禁止开放模式 —— 多人使用必须 REQUIRE_AUTH=true（并配强 JWT_SECRET），已拒绝启动');
  process.exit(1);
}

/* 启动安全审计（ADR-006）：模式 + 密钥状态一启动就可见，防"以为开了鉴权实际裸奔" */
const securityWarnings = [];
if (!auth.REQUIRE_AUTH) {
  securityWarnings.push('[security] !! 开放模式：任何人可读写数据（落到默认用户 __default__）。公网部署必须设 REQUIRE_AUTH=true');
} else {
  try {
    auth.assertSecure(); // fail-fast 在 auth.js（签名/验签前同样会断言），启动时先行提示
  } catch (e) {
    console.error('[security] FATAL: ' + e.message);
    process.exit(1);
  }
}
if (!process.env.DEEPSEEK_API_KEY) {
  securityWarnings.push('[security] !! 未配置 DEEPSEEK_API_KEY：前端可自托管传入自己的 Key（降级模式，生产建议配置）');
}

app.listen(PORT, function () {
  console.log('[chunklab-server] listening on http://0.0.0.0:' + PORT +
    (auth.REQUIRE_AUTH ? ' (多用户模式)' : ' (开放模式·免登录)'));
  securityWarnings.forEach(function (w) { console.warn(w); });
});
