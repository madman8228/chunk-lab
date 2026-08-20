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
  const deckRows = db.prepare('SELECT id,name,items_json,builtin FROM user_decks WHERE user_id=?').all(userId);
  const decks = deckRows.map(function (r) {
    return { id: r.id, name: r.name, items: JSON.parse(r.items_json), builtin: !!r.builtin };
  });

  const kvRows = db.prepare('SELECT k,v_json FROM user_kv WHERE user_id=?').all(userId);
  const kv = {};
  kvRows.forEach(function (r) { kv[r.k] = JSON.parse(r.v_json); });

  const mem = {
    decks: decks,
    best: kv.best || {},
    mastered: kv.mastered || {},
    stats: kv.stats || { totalRounds: 0, totalAnswered: 0, bySentence: {} },
    settings: kv.settings || {},
    reinforceBook: kv.reinforceBook || [],
    deletedItems: kv.deletedItems || []
  };

  const courseRows = db.prepare('SELECT data_json FROM user_courses WHERE user_id=?').all(userId);
  const courses = courseRows.map(function (r) { return JSON.parse(r.data_json); });

  const progRows = db.prepare('SELECT course_id,data_json FROM user_course_progress WHERE user_id=?').all(userId);
  const courseProgress = {};
  progRows.forEach(function (r) { courseProgress[r.course_id] = JSON.parse(r.data_json); });

  return { mem: mem, courses: courses, courseProgress: courseProgress };
}

function saveData(userId, body) {
  const mem = body.mem || {};
  const courses = Array.isArray(body.courses) ? body.courses : [];
  const courseProgress = body.courseProgress || {};
  const tx = db.transaction(function () {
    db.prepare('DELETE FROM user_decks WHERE user_id=?').run(userId);
    const insDeck = db.prepare('INSERT OR REPLACE INTO user_decks (user_id,id,name,items_json,builtin,updated_at) VALUES (?,?,?,?,?,datetime(\'now\'))');
    (mem.decks || []).forEach(function (d) {
      insDeck.run(userId, d.id, d.name, JSON.stringify(d.items || []), d.builtin ? 1 : 0);
    });

    db.prepare('DELETE FROM user_kv WHERE user_id=?').run(userId);
    const insKv = db.prepare('INSERT OR REPLACE INTO user_kv (user_id,k,v_json) VALUES (?,?,?)');
    KV_KEYS.forEach(function (k) { if (k in mem) insKv.run(userId, k, JSON.stringify(mem[k])); });

    db.prepare('DELETE FROM user_courses WHERE user_id=?').run(userId);
    const insCourse = db.prepare('INSERT OR REPLACE INTO user_courses (user_id,course_id,data_json,updated_at) VALUES (?,?,?,datetime(\'now\'))');
    courses.forEach(function (c) { insCourse.run(userId, c.courseId, JSON.stringify(c)); });

    db.prepare('DELETE FROM user_course_progress WHERE user_id=?').run(userId);
    const insProg = db.prepare('INSERT OR REPLACE INTO user_course_progress (user_id,course_id,data_json,updated_at) VALUES (?,?,?,datetime(\'now\'))');
    Object.keys(courseProgress).forEach(function (cid) { insProg.run(userId, cid, JSON.stringify(courseProgress[cid])); });
  });
  tx();
}

app.get('/api/data', auth.authenticate, function (req, res) {
  try { res.json(buildMem(req.userId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/data', auth.authenticate, function (req, res) {
  try { saveData(req.userId, req.body || {}); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courses', auth.authenticate, function (req, res) {
  const course = req.body && req.body.course;
  if (!course || !course.courseId) return res.status(400).json({ error: 'course 或 courseId 缺失' });
  try {
    db.prepare('INSERT OR REPLACE INTO user_courses (user_id,course_id,data_json,updated_at) VALUES (?,?,?,datetime(\'now\'))')
      .run(req.userId, course.courseId, JSON.stringify(course));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/courses/:courseId', auth.authenticate, function (req, res) {
  try {
    db.prepare('DELETE FROM user_courses WHERE user_id=? AND course_id=?').run(req.userId, req.params.courseId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ===================== 备份导入导出 ===================== */
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
    if (!body.mem || typeof body.mem !== 'object') return res.status(400).json({ error: '备份数据格式不正确' });
    saveData(req.userId, body);
    if (body.aiCache && typeof body.aiCache === 'object') {
      const ins = db.prepare('INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES (?,?,datetime(\'now\'))');
      const tx = db.transaction(function () {
        Object.keys(body.aiCache).forEach(function (k) { ins.run(k, JSON.stringify(body.aiCache[k])); });
      });
      tx();
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
app.listen(PORT, function () {
  console.log('[chunklab-server] listening on http://0.0.0.0:' + PORT +
    (auth.REQUIRE_AUTH ? ' (多用户模式)' : ' (开放模式·免登录)'));
});
