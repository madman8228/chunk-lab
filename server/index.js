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
 * 前后端分离：CORS 默认宽松（开发期），生产用 CORS_ORIGINS 收紧或交给 Nginx。
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const validate = require('./validate');
const ai = require('./ai');

const KV_KEYS = ['best', 'mastered', 'stats', 'settings', 'reinforceBook', 'deletedItems'];

const app = express();
app.use(express.json({ limit: '80mb' })); // 图文课程含 base64 图片，可能很大

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);          // 允许 file:// 或无 Origin 的请求
    if (allowedOrigins.length === 0) return cb(null, true); // 未配置则全允许（开发期）
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

/* 公开配置：前端据此决定是否弹登录框。无需鉴权。 */
app.get('/api/config', function (req, res) {
  res.json({ requireAuth: auth.REQUIRE_AUTH, serverVersion: 1, authAvailable: true });
});

/* ===================== 鉴权 ===================== */
app.post('/api/auth/register', function (req, res) {
  try {
    const u = auth.register(req.body.username, req.body.password);
    const token = auth.signToken(u.id, u.username);
    res.json({ token: token, user: { id: u.id, username: u.username } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth/login', function (req, res) {
  try {
    const u = auth.login(req.body.username, req.body.password);
    const token = auth.signToken(u.id, u.username);
    res.json({ token: token, user: { id: u.id, username: u.username } });
  } catch (e) { res.status(401).json({ error: e.message }); }
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
    const body = req.body || {};
    const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
    if (!sentence) return res.status(400).json({ error: 'sentence 缺失' });
    if (sentence.length > 2000) return res.status(400).json({ error: 'sentence 过长' });
    const model = (typeof body.model === 'string' && body.model.trim()) ? body.model.trim() : 'deepseek-v4-flash';
    const cacheKey = model + '::' + ai.norm(sentence);

    /* 1) 服务端缓存命中（不占限流额度；AI_CACHE_TTL 内有效，过期视为 miss） */
    const hit = AI_CACHE_TTL > 0
      ? db.prepare("SELECT value_json FROM ai_cache WHERE key=? AND updated_at >= datetime('now', ?)").get(cacheKey, '-' + AI_CACHE_TTL + ' days')
      : db.prepare('SELECT value_json FROM ai_cache WHERE key=?').get(cacheKey);
    if (hit) { metrics.aiCacheHits++; res.json({ ok: true, cached: true, data: JSON.parse(hit.value_json) }); return; }
    metrics.aiCacheMisses++;

    /* 2) 每用户滑动窗口限流 */
    if (!ai.rateLimit(req.userId)) return res.status(429).json({ error: 'AI 请求过于频繁，请稍后再试' });

    /* 3) Key 解析：服务端 env 优先；自托管允许前端传（仅服务端未配置时被接受） */
    const apiKey = ai.DEEPSEEK_API_KEY || (typeof body.apiKey === 'string' ? body.apiKey.trim() : '');
    if (!apiKey) return res.status(400).json({ error: '服务端未配置 DEEPSEEK_API_KEY（且未提供 apiKey）' });

    /* 4) 构建提示词（与前端原版一致）并调用 DeepSeek */
    const prompt = '请用中文讲解以下英语句子，面向英语学习者。输出纯 JSON，不要代码块标记，字段：orig(原句英文)、zh(中文意思)、chunks(意群数组，每项含 text 和 role 语法角色)、grammar(核心语法要点数组)、collocations(固定搭配/短语数组)、scenario(使用场景说明)。\n句子：' + sentence + '\n中文：' + (typeof body.zh === 'string' ? body.zh : '');
    ai.callDeepSeek({
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
      db.prepare("INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES (?,?,datetime('now'))").run(cacheKey, JSON.stringify(obj));
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
  // 防止误部署时通过静态服务泄露后端源码与依赖
  if (/^\/(server|node_modules)\b/i.test(req.path)) return res.status(403).end('Forbidden');
  next();
});
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 8787;
auth.ensureDefaultUser(); // 开放模式：确保默认用户存在

/* 启动安全审计（ADR-006）：模式 + 密钥状态一启动就可见，防"以为开了鉴权实际裸奔" */
const securityWarnings = [];
if (!auth.REQUIRE_AUTH) {
  securityWarnings.push('[security] ⚠️ 开放模式：任何人可读写数据（落到默认用户 __default__）。公网部署必须设 REQUIRE_AUTH=true');
} else if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'chunklab-dev-secret-change-me') {
  securityWarnings.push('[security] ⚠️ REQUIRE_AUTH=true 但 JWT_SECRET 为默认值/未设置——令牌可被伪造！生产必须设置随机密钥（openssl rand -hex 32）');
}
if (!process.env.DEEPSEEK_API_KEY) {
  securityWarnings.push('[security] ⚠️ 未配置 DEEPSEEK_API_KEY：前端可自托管传入自己的 Key（降级模式，生产建议配置）');
}

app.listen(PORT, function () {
  console.log('[chunklab-server] listening on http://0.0.0.0:' + PORT +
    (auth.REQUIRE_AUTH ? ' (多用户模式)' : ' (开放模式·免登录)'));
  securityWarnings.forEach(function (w) { console.warn(w); });
});
