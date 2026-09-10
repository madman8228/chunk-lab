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
const compress = require('./compress');
const apiCompress = require('./api-compress');

const KV_KEYS = ['best', 'mastered', 'stats', 'settings', 'reinforceBook', 'deletedItems'];
/* 已迁到行表 user_entity_rows 的 kv 键 → kind 映射（客户端键名 → 服务端 kind）。
   放在这里是为了让「上行入口」一眼看出哪些键不再走 user_kv。 */
const ROW_KV_KINDS = { mastered: 'mastered', reinforceBook: 'reinforce', deletedItems: 'deletedItem' };

/* AI 联网生成开关（2026-09-06 产品决策：先禁联网 AI 生成，后续再开放）。
   默认关闭；开启方式：环境变量 AI_EXPLAIN_ENABLED=true（或 .env 中设置）。 */
const AI_EXPLAIN_ENABLED = String(process.env.AI_EXPLAIN_ENABLED || '').trim().toLowerCase() === 'true';

const app = express();
/* 安全加固（2026-09-10）：移除 Express 默认的 `X-Powered-By: Express` 响应头。
   暴露后端技术栈会帮攻击者直接定位已知漏洞版本，属零成本减少攻击面。 */
app.disable('x-powered-by');
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
/* API 响应压缩（异步 brotli，冷路径）：GET /api/data 8000 句时 7191KB → 648KB。
   必须挂在所有 /api 路由之前；只接管 res.json，静态资源走下面的 staticCompress。 */
app.use('/api', apiCompress());
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
/* 组装给客户端的 mem。since == null → 全量（与拆表前完全一致）；
   since 有值 → 只回「该用户 seq>since 的变更」（行级增量下行，2026-09-10 第三轮）。

   ★ 水位必须**先取**再取行：见 currentSeq 注释。
   ★ 增量模式必须显式给出删除清单（deleted.* / entityGone），见下方注释。
   ★ 增量返回的 `mem` 是**局部**对象（只含变更项），老客户端拿到会当成全量 → 丢数据。
     所以增量纯 opt-in：只有显式传 since 才会走到，默认路径逐字节不变。 */
function buildMem(userId, since) {
  const seqNow = currentSeq(userId);
  /* 水位超前于服务端（库被回滚/重置/换过库）→ 本地水位与这份数据不同源，增量无从算起，
     退回全量。这是协议规则而非兜底：不退的话客户端会永远只拉增量、静默少数据。 */
  const isDelta = (since != null) && (since <= seqNow);

  const W = function (aliveOnly) {
    return 'user_id=?' + (aliveOnly ? ' AND deleted_at IS NULL' : '') +
      (isDelta ? ' AND seq>? AND seq<=?' : '');
  };
  const A = isDelta ? [userId, since, seqNow] : [userId];
  /* ⚠️ 必须用展开调用（stmt.all(...args)）：写成 stmt.all.apply(null, args) 会丢掉 this，
     better-sqlite3 的语句方法绑在语句对象上，丢 this 直接抛错。 */
  const rows = function (sql, aliveOnly, extra) {
    const s = db.prepare(sql.replace('{W}', W(aliveOnly)));
    return s.all(...A.concat(extra || []));
  };

  const deckRows = rows('SELECT id,name,items_json,builtin,is_public,rev FROM user_decks WHERE {W}', true);
  const decks = deckRows.map(function (r) {
    return { id: r.id, name: r.name, items: JSON.parse(r.items_json), builtin: !!r.builtin, isPublic: !!r.is_public };
  });
  // revs 需含软删行：让其他设备能判断本地副本是否已过期（软删也是版本演进）
  const deckRevs = {};
  rows('SELECT id,rev FROM user_decks WHERE {W}', false).forEach(function (r) { deckRevs[r.id] = r.rev; });

  const kvRows = rows('SELECT k,v_json,rev FROM user_kv WHERE {W}', true);
  const kv = {};
  kvRows.forEach(function (r) { kv[r.k] = JSON.parse(r.v_json); });
  const kvRevs = {};
  rows('SELECT k,rev FROM user_kv WHERE {W}', false).forEach(function (r) { kvRevs[r.k] = r.rev; });

  /* stats 的两个大对象从行表组装（2026-09-10 拆表，见 db.js 表注释）。
     对外协议形状**完全不变** —— 客户端仍旧拿到 stats.bySentence / stats.events，
     变的只是服务端存储方式与上行增量。blob 里残留的旧值由启动迁移清掉（migrateStatsToRows）。 */
  const sbsRows = rows('SELECT sentence_key,data_json FROM user_sentence_stats WHERE {W}', true);
  const bySentence = {};
  sbsRows.forEach(function (r) {
    var st = JSON.parse(r.data_json);
    /* 去冗余（2026-09-10）：deckName / translation 是「展示冗余」——
       客户端对 translation 从不读原始值（统计页恒用题库 item 重算，见 stats.html
       renderSentenceList 的 Object.assign({}, st, {translation: it.translation})）；
       deckName 只在旧 key 迁移时读（新条目 deckId 命中 known 直接跳过）。
       两者都能从 deckId + 题库 item 重建，组装时剥离让下行 GET 立省 ~25%，
       且不改任何客户端行为（statSig 只 hash SRS 计数，不含这俩字段，剥离不触发误重传）。 */
    if (st && typeof st === 'object') { delete st.deckName; delete st.translation; }
    bySentence[r.sentence_key] = st;
  });
  const evRows = rows('SELECT data_json FROM user_events WHERE {W} ORDER BY at,id', false);
  const events = evRows.map(function (r) {
    var ev = JSON.parse(r.data_json);
    /* 去冗余（2026-09-10）：answer 事件的 deckId / sentence 与 key（=deckId#cid）重复，
       且全链路从未被读取 —— mergeStats 只用 id/kind/ok/key，backfillDaysLog 只用 kind/at。
       round 事件本就只有 id/kind/at。剥掉让下行 events 立省 ~18.7%（占总量）。 */
    if (ev && typeof ev === 'object') { delete ev.deckId; delete ev.sentence; }
    return ev;
  });

  /* ★ 增量模式下 stats 基座（totalRounds / totalAnswered / daysLog…）**一律完整下发**。
     它体积很小，但「基座缺失或用 0 兜底」会让客户端的重建式合并（mergeStats 按
     `总数 - 事件侧计数` 反推历史基线）彻底算错。走增量的只有 bySentence / events 这两个大对象。 */
  const statsBase = isDelta
    ? (function () {
        const r = db.prepare("SELECT v_json FROM user_kv WHERE user_id=? AND k='stats' AND deleted_at IS NULL").get(userId);
        return r ? JSON.parse(r.v_json) : { totalRounds: 0, totalAnswered: 0 };
      })()
    : (kv.stats || { totalRounds: 0, totalAnswered: 0 });

  /* mastered / reinforceBook / deletedItems 从行表组装（2026-09-10 第二轮，见 db.js 表注释）。
     对外形状与拆表前完全一致，变的是存储与上行增量方式。

     ★ 为什么要额外下发 entityGone（删除墓碑）：
       客户端对这三者的合并语义是「并集 + 墓碑」（与 stats 一致，靠并集重建/求并，幂等）。
       只给存活行是不够的 —— 设备 A 取消标熟某句后，若 B 拿不到墓碑，
       B 的本地副本仍持有该 key，下次上行会把它重新写活（复活）。
       重新标熟/恢复删除都是低频操作，墓碑总量很小（每条约 25 字节），随全量响应下发即可。 */
  const entityMastered = {};
  rows('SELECT item_key,data_json FROM user_entity_rows WHERE {W} AND kind=? ORDER BY rowid', true, ['mastered'])
    .forEach(function (r) { entityMastered[r.item_key] = JSON.parse(r.data_json); });
  const entityReinforce = rows('SELECT item_key,data_json FROM user_entity_rows WHERE {W} AND kind=? ORDER BY rowid', true, ['reinforce'])
    .map(function (r) { return JSON.parse(r.data_json); });
  const entityDeletedItems = {};
  rows('SELECT item_key FROM user_entity_rows WHERE {W} AND kind=?', true, ['deletedItem'])
    .forEach(function (r) { entityDeletedItems[r.item_key] = true; });
  const entityGone = {};
  ['mastered', 'reinforce', 'deletedItem'].forEach(function (kind) {
    entityGone[kind] = rows('SELECT item_key FROM user_entity_rows WHERE {W} AND kind=? AND deleted_at IS NOT NULL ORDER BY item_key', false, [kind])
      .map(function (r) { return r.item_key; });
  });

  const mem = {
    decks: decks,
    best: kv.best || {},
    mastered: entityMastered,
    stats: Object.assign({}, statsBase, { bySentence: bySentence, events: events }),
    settings: kv.settings || {},
    reinforceBook: entityReinforce,
    deletedItems: entityDeletedItems
  };

  const courseRows = rows('SELECT data_json FROM user_courses WHERE {W}', true);
  const courses = courseRows.map(function (r) { return JSON.parse(r.data_json); });
  // revs 需含软删行：让其他设备能判断本地副本是否已过期
  const courseRevs = {};
  rows('SELECT course_id,rev FROM user_courses WHERE {W}', false).forEach(function (r) { courseRevs[r.course_id] = r.rev; });

  const progRows = rows('SELECT course_id,data_json FROM user_course_progress WHERE {W}', true);
  const courseProgress = {};
  progRows.forEach(function (r) { courseProgress[r.course_id] = JSON.parse(r.data_json); });
  const progRevs = {};
  rows('SELECT course_id,rev FROM user_course_progress WHERE {W}', false).forEach(function (r) { progRevs[r.course_id] = r.rev; });

  /* ★ 增量模式必须**显式**给出删除清单。
     全量下的客户端可以靠「远端 revs 有、远端 mem 没有 → 已删」推断缺失实体，因为全量响应
     就是全集；但增量的 mem 只含**变更**项，未变更的实体本来就不在响应里 ——
     若客户端沿用存在性推断，会把「没变更」误判成「已删除」，整批删掉用户数据。
     所以增量下删除一律落成显式列表，客户端不做任何存在性推断。 */
  const deleted = { decks: [], kv: [], courses: [], courseProgress: [] };
  if (isDelta) {
    rows('SELECT id FROM user_decks WHERE {W} AND deleted_at IS NOT NULL', false)
      .forEach(function (r) { deleted.decks.push(r.id); });
    rows('SELECT k FROM user_kv WHERE {W} AND deleted_at IS NOT NULL', false)
      .forEach(function (r) { deleted.kv.push(r.k); });
    rows('SELECT course_id FROM user_courses WHERE {W} AND deleted_at IS NOT NULL', false)
      .forEach(function (r) { deleted.courses.push(r.course_id); });
    rows('SELECT course_id FROM user_course_progress WHERE {W} AND deleted_at IS NOT NULL', false)
      .forEach(function (r) { deleted.courseProgress.push(r.course_id); });
    /* bySentence 的软删行：与 entityGone 同性质，客户端据此从本地档案里摘掉 */
    deleted.sentences = rows('SELECT sentence_key FROM user_sentence_stats WHERE {W} AND deleted_at IS NOT NULL', false)
      .map(function (r) { return r.sentence_key; });
  }

  return {
    mem: mem, courses: courses, courseProgress: courseProgress,
    revs: { decks: deckRevs, kv: kvRevs, courses: courseRevs, courseProgress: progRevs },
    entityGone: entityGone,
    /* 客户端据此记录下行水位：「seq 及之前的变更我都已收到」。
       必须与数据同层存储（清数据就得清水位），否则「数据被清、水位残留」会永久少数据。 */
    seq: seqNow,
    delta: isDelta,
    deleted: deleted
  };
}

/* seq 一律写在 DO UPDATE 的 SET 里（而不是外层 INSERT 的 values）——
   若 rev 守卫不成立、这次写入被拒，seq 也不会推进；
   否则客户端会「收到了一个其实没落库的变更」水位，真变更永远拉不到。 */
function upsertDeck(userId, d, rev, deleted, seq) {
  if (deleted) {
    db.prepare("INSERT INTO user_decks (user_id,id,name,items_json,builtin,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_decks.rev, 0)")
      .run(userId, d.id, '', '[]', 0, rev == null ? null : rev, seq);
  } else {
    db.prepare("INSERT INTO user_decks (user_id,id,name,items_json,builtin,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name, items_json=excluded.items_json, builtin=excluded.builtin, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_decks.rev, 0)")
      .run(userId, d.id, d.name, JSON.stringify(d.items || []), d.builtin ? 1 : 0, rev == null ? null : rev, null, seq);
  }
}

function upsertKv(userId, k, v, rev, deleted, seq) {
  if (deleted) {
    db.prepare("INSERT INTO user_kv (user_id,k,v_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,k) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_kv.rev, 0)")
      .run(userId, k, 'null', rev == null ? null : rev, seq);
  } else {
    db.prepare("INSERT INTO user_kv (user_id,k,v_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,k) DO UPDATE SET v_json=excluded.v_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_kv.rev, 0)")
      .run(userId, k, JSON.stringify(v), rev == null ? null : rev, null, seq);
  }
}

function upsertCourse(userId, c, rev, deleted, seq) {
  if (deleted) {
    db.prepare("INSERT INTO user_courses (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_courses.rev, 0)")
      .run(userId, c.courseId, '{}', rev == null ? null : rev, seq);
  } else {
    db.prepare("INSERT INTO user_courses (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_courses.rev, 0)")
      .run(userId, c.courseId, JSON.stringify(c), rev == null ? null : rev, null, seq);
  }
}

function upsertCourseProgress(userId, cid, data, rev, deleted, seq) {
  if (deleted) {
    db.prepare("INSERT INTO user_course_progress (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,datetime('now'),datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET deleted_at=datetime('now'), rev=excluded.rev, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_course_progress.rev, 0)")
      .run(userId, cid, 'null', rev == null ? null : rev, seq);
  } else {
    db.prepare("INSERT INTO user_course_progress (user_id,course_id,data_json,rev,deleted_at,updated_at,seq) VALUES (?,?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,course_id) DO UPDATE SET data_json=excluded.data_json, rev=excluded.rev, deleted_at=excluded.deleted_at, updated_at=datetime('now'), seq=excluded.seq WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(user_course_progress.rev, 0)")
      .run(userId, cid, JSON.stringify(data), rev == null ? null : rev, null, seq);
  }
}

/* ----- 句子级档案 / 事件日志（8000 句扩容，2026-09-10） -----
   这两个大对象原先塞在 `user_kv` 的 k='stats' 里，使单个 kv 实体占到同步体积的 86.8%
   （8000 句实测 7191KB/次），而 PUT /api/data 是热路径 → 每答一题重传整份档案。
   拆成行表后客户端只上行变更行。表设计理由见 db.js 注释（关键：**不带 rev**，
   跨设备合并由客户端 mergeStats 按事件 id 并集重建，属重建式语义，rev 会误拒合并结果）。

   ⚠️ 全量写入一律用 UPSERT 而非 DELETE+INSERT：
   旧客户端（当前线上版本）每次发的是「本地合并后的完整 bySentence」，并不包含
   「其他设备上存在而本地没有」的条目；整表替换会静默删掉那些条目。 */
const _stmtCache = {};
function stmt(sql) {
  if (!_stmtCache[sql]) _stmtCache[sql] = db.prepare(sql);
  return _stmtCache[sql];
}

/* ----- 变更序号（行级增量下行，2026-09-10 第三轮） -----
   每个用户一个单调递增计数器；一次写入请求共用一个 seq，所有被它改动的行都盖这个号。
   客户端的水位语义是「seq<=N 的我都收到了」，整批同号 + 按批原子应用即可，无需逐行发号。

   ★ currentSeq 必须**先于**读行调用：先定住水位，再按 `seq<=水位` 取行。
     反过来（先读行、后读计数器）会把「请求期间新写入的行」也读进来，
     却把水位报到更新的值 → 客户端以为收到了、下次不再拉（静默少数据）。 */
function currentSeq(userId) {
  const r = stmt('SELECT seq FROM user_change_seq WHERE user_id=?').get(userId);
  return r ? r.seq : 0;
}
function allocSeq(userId) {
  const r = stmt('INSERT INTO user_change_seq (user_id, seq) VALUES (?, 1) ' +
    'ON CONFLICT(user_id) DO UPDATE SET seq = seq + 1 RETURNING seq').get(userId);
  return r ? r.seq : 1;
}

const SBS_UPSERT_SQL = "INSERT INTO user_sentence_stats (user_id,sentence_key,deck_id,data_json,deleted_at,updated_at,seq) VALUES (?,?,?,?,NULL,datetime('now'),?) ON CONFLICT(user_id,sentence_key) DO UPDATE SET data_json=excluded.data_json, deck_id=excluded.deck_id, deleted_at=NULL, updated_at=datetime('now'), seq=excluded.seq";
const SBS_DELETE_SQL = "UPDATE user_sentence_stats SET deleted_at=datetime('now'), updated_at=datetime('now'), seq=? WHERE user_id=? AND sentence_key=?";
const EV_UPSERT_SQL = "INSERT INTO user_events (user_id,id,at,data_json,updated_at,seq) VALUES (?,?,?,?,datetime('now'),?) ON CONFLICT(user_id,id) DO UPDATE SET data_json=excluded.data_json, at=excluded.at, updated_at=datetime('now'), seq=excluded.seq";

function upsertSentenceStat(userId, key, data, seq) {
  if (!key || !data || typeof data !== 'object') return;
  const deckId = typeof data.deckId === 'string' ? data.deckId : null;
  stmt(SBS_UPSERT_SQL).run(userId, String(key), deckId, JSON.stringify(data), seq);
}

function deleteSentenceStat(userId, key, seq) {
  if (!key) return;
  stmt(SBS_DELETE_SQL).run(seq, userId, String(key));
}

function upsertEvent(userId, ev, seq) {
  if (!ev || !ev.id) return;
  stmt(EV_UPSERT_SQL).run(userId, String(ev.id), typeof ev.at === 'number' ? ev.at : null, JSON.stringify(ev), seq);
}

/* ----- 通用行级实体（mastered / reinforce / deletedItem，2026-09-10 第二轮） -----
   与 user_sentence_stats 同理（见 db.js 表注释）：这三个对象也是「随练习量增长」的，
   塞在单个 kv blob 里时每答一题要搬运四次（本地落盘序列化 / maintainRevs 签名 /
   上行 payload / 服务端整块回写）。mastered 8000 条约 227KB、错题本上限 200 条约 176KB。

   kind 白名单：写入口拒绝未知 kind，否则脏 kind 会让这张通用表无界增长。 */
const ENTITY_KINDS = { mastered: 1, reinforce: 1, deletedItem: 1 };

const ENTITY_UPSERT_SQL = "INSERT INTO user_entity_rows (user_id,kind,item_key,data_json,deleted_at,updated_at,seq) VALUES (?,?,?,?,NULL,datetime('now'),?) ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json, deleted_at=NULL, updated_at=datetime('now'), seq=excluded.seq";
const ENTITY_DELETE_SQL = "UPDATE user_entity_rows SET deleted_at=datetime('now'), updated_at=datetime('now'), seq=? WHERE user_id=? AND kind=? AND item_key=?";

function upsertEntityRow(userId, kind, key, data, seq) {
  if (!ENTITY_KINDS[kind] || !key) return;
  stmt(ENTITY_UPSERT_SQL).run(userId, kind, String(key), JSON.stringify(data === undefined ? 1 : data), seq);
}
function deleteEntityRow(userId, kind, key, seq) {
  if (!ENTITY_KINDS[kind] || !key) return;
  stmt(ENTITY_DELETE_SQL).run(seq, userId, kind, String(key));
}
/* 注：读行一律走 buildMem 里带 seq 区间的统一查询（增量/全量共用一套 WHERE 片段），
   所以这里不再单独提供「读某个 kind 全部存活行」的 helper —— 避免出现第二处
   不参与增量过滤的读路径（那是「客户端收到全量、却以为拿到增量」的隐患）。 */
/* 旧客户端（及迁移前的库）把三者放在 kv blob 里；这里负责把它们按行落库。
   ⚠️ 只做逐行 UPSERT、绝不做整表替换 —— 旧客户端发的是「本地合并后的副本」，
      不含「其他设备有而本地没有」的条目，整替会静默删掉那些数据（与 stats 同一个坑）。 */
function putEntityBlob(userId, kind, blob, seq) {
  if (!blob) return;
  if (kind === 'reinforce') {
    if (!Array.isArray(blob)) return;
    blob.forEach(function (it) { if (it && it._key) upsertEntityRow(userId, 'reinforce', it._key, it, seq); });
    return;
  }
  // mastered / deletedItem：{key: value} 映射（deletedItems 历史上有数组形态，一并兼容）
  if (Array.isArray(blob)) {
    blob.forEach(function (k) { if (k) upsertEntityRow(userId, kind, k, 1, seq); });
    return;
  }
  if (typeof blob !== 'object') return;
  Object.keys(blob).forEach(function (k) { upsertEntityRow(userId, kind, k, blob[k], seq); });
}

/* 把 stats blob 里的两个大对象搬到行表，并从 blob 删掉它们（否则体积永远降不下来）。
   幂等：blob 里已无 bySentence/events 时直接跳过 —— 可在每次启动安全重复执行。

   ★ 先用廉价字符串探测筛出「真的待迁移」的行：正常库里 blob 早已不含大对象，
     若为每个用户都 JSON.parse 一次，用户量上来后这会变成启动时的隐性成本。 */
function migrateStatsToRows() {
  const rows = db.prepare("SELECT user_id,v_json FROM user_kv WHERE k='stats'").all();
  const pending = rows.filter(function (r) {
    return r.v_json.indexOf('"bySentence"') >= 0 || r.v_json.indexOf('"events"') >= 0;
  });
  if (!pending.length) return { migrated: 0, sentences: 0, events: 0 };

  let migrated = 0, sentenceCount = 0, eventCount = 0;
  const tx = db.transaction(function () {
    pending.forEach(function (r) {
      let st;
      try { st = JSON.parse(r.v_json); } catch (e) { return; }
      if (!st || typeof st !== 'object') return;
      const hasBS = st.bySentence && typeof st.bySentence === 'object';
      const hasEv = Array.isArray(st.events);
      if (!hasBS && !hasEv) return;
      /* 迁移落下的行也要带变更号：否则增量客户端（水位已存在）永远收不到这批存量数据。 */
      const seq = allocSeq(r.user_id);
      if (hasBS) {
        Object.keys(st.bySentence).forEach(function (k) { upsertSentenceStat(r.user_id, k, st.bySentence[k], seq); sentenceCount++; });
      }
      if (hasEv) {
        st.events.forEach(function (ev) { upsertEvent(r.user_id, ev, seq); eventCount++; });
      }
      delete st.bySentence;
      delete st.events;
      db.prepare("UPDATE user_kv SET v_json=?, updated_at=datetime('now'), seq=? WHERE user_id=? AND k='stats'")
        .run(JSON.stringify(st), seq, r.user_id);
      migrated++;
    });
  });
  tx();
  return { migrated: migrated, sentences: sentenceCount, events: eventCount };
}

/* 把 mastered / reinforceBook / deletedItems 从 kv blob 搬进行表，并从 blob 删掉
   （不删的话 blob 体积永远降不下来，拆表等于白做）。
   幂等：blob 里已无这三个键时直接跳过 —— 可在每次启动安全重复执行。
   与 stats 迁移一样先做廉价字符串预筛，避免用户量上来后每次启动 parse 全库。 */
function migrateEntityRows() {
  const rows = db.prepare('SELECT user_id,k,v_json FROM user_kv WHERE k IN (?,?,?)')
    .all('mastered', 'reinforceBook', 'deletedItems');
  if (!rows.length) return { migrated: 0, mastered: 0, reinforce: 0, deletedItems: 0 };

  let migrated = 0, nMastered = 0, nReinforce = 0, nDeleted = 0;
  const tx = db.transaction(function () {
    rows.forEach(function (r) {
      const kind = r.k === 'reinforceBook' ? 'reinforce' : (r.k === 'mastered' ? 'mastered' : 'deletedItem');
      /* 空值没有可搬的内容，不必 parse —— 但 kv 行**仍然要删**，
         否则这对空 blob 会永远留在库里（拆表不彻底）。 */
      const empty = !r.v_json || r.v_json === 'null' || r.v_json === '{}' || r.v_json === '[]';
      if (!empty) {
        let blob;
        try { blob = JSON.parse(r.v_json); } catch (e) { return; } /* parse 失败就不动它，绝不"删了但没搬" */
        /* 迁移落下的行也要带变更号，否则增量客户端收不到这批存量数据（同 stats 迁移）。 */
        const seq = allocSeq(r.user_id);
        const before = countEntityRows(r.user_id, kind);
        putEntityBlob(r.user_id, kind, blob, seq);
        const after = countEntityRows(r.user_id, kind);
        if (kind === 'mastered') nMastered += after - before;
        else if (kind === 'reinforce') nReinforce += after - before;
        else nDeleted += after - before;
      }
      db.prepare('DELETE FROM user_kv WHERE user_id=? AND k=?').run(r.user_id, r.k);
      migrated++;
    });
  });
  tx();
  return { migrated: migrated, mastered: nMastered, reinforce: nReinforce, deletedItems: nDeleted };
}

function countEntityRows(userId, kind) {
  const r = db.prepare('SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=? AND kind=? AND deleted_at IS NULL').get(userId, kind);
  return r ? r.n : 0;
}

function saveData(userId, body) {
  const mem = body.mem || {};
  const courses = Array.isArray(body.courses) ? body.courses : [];
  const courseProgress = body.courseProgress || {};
  const revs = body.revs || {};
  const deleted = body.deleted || {};
  const delta = (body.statsDelta && typeof body.statsDelta === 'object') ? body.statsDelta : null;
  const entDelta = (body.entityDelta && typeof body.entityDelta === 'object') ? body.entityDelta : null;

  /* stats 大对象走行表：先把 bySentence / events 从「待写 kv 的 stats」里剥出来，
     否则它们会被原样塞回 blob，体积又回到 7MB（拆表等于白做）。
     旧客户端仍会发这两个字段 → 按「全量 UPSERT」处理，向后兼容且不丢数据
     （不能用整表 DELETE+INSERT：旧客户端发的是本地合并后的副本，
       不含「其他设备有而本地没有」的条目，整替会静默删掉）。 */
  let statsKv = null;
  let sbsFull = null, evFull = null;
  if (mem.stats && typeof mem.stats === 'object') {
    if (mem.stats.bySentence && typeof mem.stats.bySentence === 'object') sbsFull = mem.stats.bySentence;
    if (Array.isArray(mem.stats.events)) evFull = mem.stats.events;
    if (sbsFull || evFull) {
      statsKv = {};
      Object.keys(mem.stats).forEach(function (k) {
        if (k !== 'bySentence' && k !== 'events') statsKv[k] = mem.stats[k];
      });
    } else {
      statsKv = mem.stats;
    }
  }

  const tx = db.transaction(function () {
    /* 本次写入共用一个变更序号（行级增量下行的水位单位）。
       放在事务内：事务回滚时序号一起回滚，不会留下「凭空推进的水位」。
       若本次请求什么都没写，序号也确实被推进了 —— 无害：
       客户端的语义是「≤N 的都收到了」，多一次空推进只是让它多问一次。 */
    const seq = allocSeq(userId);

    // decks：实体级 rev upsert（不再整块 DELETE，崩溃可恢复、多设备不互覆盖）
    (mem.decks || []).forEach(function (d) {
      upsertDeck(userId, d, (revs.decks && revs.decks[d.id]) == null ? null : revs.decks[d.id], false, seq);
    });
    (deleted.decks || []).forEach(function (d) {
      upsertDeck(userId, { id: d.id }, d.rev, true, seq);
    });

    // kv：实体级 rev upsert（per-key：best / stats / settings）
    KV_KEYS.forEach(function (k) {
      /* mastered / reinforceBook / deletedItems 已迁到 user_entity_rows（见 db.js 表注释）。
         ⚠️ 必须在这里挡掉：否则旧客户端发整份 blob 时又会被写回 user_kv，
            blob 体积回到拆表前，拆表等于白做。 */
      if (ROW_KV_KINDS[k]) return;
      if (k === 'stats') {
        if (statsKv !== null) {
          upsertKv(userId, 'stats', statsKv, (revs.kv && revs.kv.stats) == null ? null : revs.kv.stats, false, seq);
        }
        return;
      }
      if (k in mem) upsertKv(userId, k, mem[k], (revs.kv && revs.kv[k]) == null ? null : revs.kv[k], false, seq);
    });
    (deleted.kv || []).forEach(function (d) {
      upsertKv(userId, d.k, null, d.rev, true, seq);
    });

    // courses / courseProgress：per-entity rev upsert + 软删除（ADR-005 step 2）
    courses.forEach(function (c) {
      upsertCourse(userId, c, (revs.courses && revs.courses[c.courseId]) == null ? null : revs.courses[c.courseId], false, seq);
    });
    (deleted.courses || []).forEach(function (c) {
      upsertCourse(userId, { courseId: c.id }, c.rev, true, seq);
    });
    Object.keys(courseProgress).forEach(function (cid) {
      upsertCourseProgress(userId, cid, courseProgress[cid], (revs.courseProgress && revs.courseProgress[cid]) == null ? null : revs.courseProgress[cid], false, seq);
    });
    (deleted.courseProgress || []).forEach(function (c) {
      upsertCourseProgress(userId, c.id, null, c.rev, true, seq);
    });

    // 句子档案 / 事件日志：行级写入（新协议的增量路径 + 旧客户端的全量兼容路径）
    if (sbsFull) Object.keys(sbsFull).forEach(function (k) { upsertSentenceStat(userId, k, sbsFull[k], seq); });
    if (evFull) evFull.forEach(function (ev) { upsertEvent(userId, ev, seq); });
    if (delta) {
      const sbs = delta.sbs || {};
      Object.keys(sbs).forEach(function (k) { upsertSentenceStat(userId, k, sbs[k], seq); });
      (delta.sbsGone || []).forEach(function (k) { deleteSentenceStat(userId, k, seq); });
      (delta.evs || []).forEach(function (ev) { upsertEvent(userId, ev, seq); });
    }

    /* mastered / reinforceBook / deletedItems：旧客户端的整份 blob（兼容路径）+ 新协议的 entityDelta。
       两者都只做逐行 UPSERT / 软删，绝不做整表替换（理由同 stats：整替会静默删掉他机数据）。 */
    Object.keys(ROW_KV_KINDS).forEach(function (k) {
      if (k in mem) putEntityBlob(userId, ROW_KV_KINDS[k], mem[k], seq);
    });
    if (entDelta) {
      Object.keys(ROW_KV_KINDS).forEach(function (k) {
        const part = entDelta[k];
        if (!part || typeof part !== 'object') return;
        const kind = ROW_KV_KINDS[k];
        const up = part.up || {};
        if (kind === 'reinforce') {
          Object.keys(up).forEach(function (key) { upsertEntityRow(userId, kind, key, up[key], seq); });
        } else {
          Object.keys(up).forEach(function (key) { upsertEntityRow(userId, kind, key, up[key] === undefined ? 1 : up[key], seq); });
        }
        (part.gone || []).forEach(function (key) { deleteEntityRow(userId, kind, key, seq); });
      });
    }
  });
  tx();
}

app.get('/api/data', auth.authenticate, function (req, res) {
  try {
    /* ?since=N → 只回该用户 seq>N 的变更（行级增量下行，见 buildMem）。
       不传 = 全量，与旧行为逐字节一致（增量是纯 opt-in）。
       非法 since 明确报 400 而不是「当作 0 或全量」——静默改写水位语义最容易酿成少数据。 */
    const raw = req.query.since;
    let since = null;
    if (raw !== undefined && raw !== '') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'since 必须是 >=0 的数字' });
      since = Math.floor(n);
    }
    res.json(buildMem(req.userId, since));
  }
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
    upsertCourse(req.userId, course, null, false, allocSeq(req.userId));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/courses/:courseId', auth.authenticate, function (req, res) {
  try {
    const cid = req.params.courseId;
    // 软删除（ADR-005）：跨设备传播，删除也是版本演进
    const row = db.prepare('SELECT rev FROM user_courses WHERE user_id=? AND course_id=?').get(req.userId, cid);
    const rev = ((row && row.rev != null) ? row.rev : 0) + 1;
    upsertCourse(req.userId, { courseId: cid }, rev, true, allocSeq(req.userId));
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
    /* is_public 也是 deck 的属性变更 → 必须**同时** bump rev 与 seq。
       旧实现只改 is_public 不动 rev，于是其他设备的 LWW 判定「服务端版本没更新」而忽略，
       发布状态永远传不出去（顺手修掉的既有 bug）。 */
    db.prepare("UPDATE user_decks SET is_public=?, rev=COALESCE(rev,0)+1, updated_at=datetime('now'), seq=? WHERE user_id=? AND id=?")
      .run(publish, allocSeq(req.userId), req.userId, deckId);
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
  // P1（2026-09-10，自检脚本 scripts/deploy-security-smoke.sh 实测抓出）：
  //   /deploy/nginx-chunklab.conf 曾 200 可公开下载（泄露内网端口/域名/反代拓扑）、/ref 未拦、
  //   /package.json 暴露依赖版本与 scripts、*.py/*.conf/*.sh/*.service/*.yml 等运维脚本未拦、/diagnose.html 调试页未拦。
  if (/^\/(server|node_modules|output|scripts|extra|e2e|deliverables|deploy|ref)\b/i.test(req.path)) return res.status(403).end('Forbidden');
  if (/\/\./.test(req.path)) return res.status(403).end('Forbidden'); // 任意层级 dotfile/dotdir：/.git、/.env、/.workbuddy、/server/.env…
  if (/\.(md|markdown|bak|tmp|log|db|sqlite|sqlite3|py|conf|ini|yml|yaml|sh|service)$/i.test(req.path) || /\.test\.js$/i.test(req.path)) return res.status(403).end('Forbidden');
  if (/^\/(package|package-lock)\.json$/i.test(req.path)) return res.status(403).end('Forbidden'); // 依赖清单：泄露版本→可直接查已知 CVE
  if (/^\/validate_[a-z0-9_]+\.js$/i.test(req.path)) return res.status(403).end('Forbidden'); // 根目录数据校验脚本（构建期工具，非前端运行时依赖）
  if (/^\/diagnose\.html$/i.test(req.path)) return res.status(403).end('Forbidden'); // 调试页，不对公网开放
  next();
});
/* 根路径 → 入口页。仓库无 index.html（入口是 main.html），express.static 对 / 会 404 "Cannot GET /" */
app.get('/', function (req, res) { res.redirect('/main.html'); });
/* 静态资源压缩（2026-09-10）：见 server/compress.js 头部「为什么需要」。
   8000 句题库 7.80MB → brotli ~1.8MB，是扩容后唯一真正卡前端的瓶颈。
   必须放在 express.static 之前：命中则直接返回压缩体，未命中（客户端不要压缩 / 含 Range / 非文本）
   自行 next() 放行，不改变原有行为。 */
const staticCompress = compress(path.join(__dirname, '..'));
app.use(staticCompress);
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

/* 启动迁移：把 stats blob 里的 bySentence / events 搬进行表（幂等，可重复执行）。
   必须**在开始接受请求之前**完成 —— 否则新客户端会把「blob 里有、行表里没有」当成已删除。 */
const _migration = migrateStatsToRows();
if (_migration.migrated) {
  console.log('[chunklab-server] stats 大对象迁移完成：' + _migration.migrated + ' 个用户 / ' +
    _migration.sentences + ' 条句子档案 / ' + _migration.events + ' 条事件');
}

/* 启动迁移：把 mastered / reinforceBook / deletedItems 从 kv blob 搬进行表（幂等）。
   同样必须在接受请求之前完成，否则会出现「blob 已被清空、行表还没数据」的窗口。 */
const _entMigration = migrateEntityRows();
if (_entMigration.migrated) {
  console.log('[chunklab-server] 行级实体迁移完成：' + _entMigration.migrated + ' 条 kv → ' +
    _entMigration.mastered + ' 条标熟 / ' + _entMigration.reinforce + ' 条错题 / ' + _entMigration.deletedItems + ' 条删除登记');
}

/* 变更序号初始化：给存量行回填 seq=1 + 给每个用户铺计数器（幂等）。
   ★ 必须在**任何写入之前**跑完：回填与计数器是一对，只做一半会让新分配的序号与回填值撞号
     （见 db.js initChangeSeq 注释）。放在两个迁移之后，让迁移本身分配到的序号保持更大。 */
const _seqBackfill = db.initChangeSeq();
if (_seqBackfill) {
  console.log('[chunklab-server] 变更序号回填完成：' + _seqBackfill + ' 行 → seq=1（计数器同步抬到 1）');
}

app.listen(PORT, function () {
  console.log('[chunklab-server] listening on http://0.0.0.0:' + PORT +
    (auth.REQUIRE_AUTH ? ' (多用户模式)' : ' (开放模式·免登录)'));
  securityWarnings.forEach(function (w) { console.warn(w); });
  /* 后台预热大文件压缩体：让第一个访客不必等现场压缩（见 server/compress.js warm） */
  staticCompress.warm();
});
