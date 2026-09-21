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
const admin = require('./admin');
const validate = require('./validate');
const ai = require('./ai');
const compress = require('./compress');
const apiCompress = require('./api-compress');
const feedback = require('./feedback');
const { createAuthRateLimiter } = require('./middleware/auth-rate');
const { createStaticGuard } = require('./middleware/static-guard');
const { createChangeSequence } = require('./services/change-seq');
const { createSnapshotReader } = require('./services/data-snapshot');
const { createDataWriters } = require('./services/data-writers');
const { createDataRows } = require('./services/data-rows');
const { createDataMigrations } = require('./services/data-migrations');
const { createDataSave } = require('./services/data-save');
const { createBatchReplacement } = require('./services/batch-replacement');
const { createAdminOverview } = require('./services/admin-overview');
const { registerSyncRoutes } = require('./routes/sync');
const { registerCourseRoutes } = require('./routes/courses');
const { registerDeckRoutes } = require('./routes/decks');
const { registerBackupRoutes } = require('./routes/backup');
const { registerFeedbackRoutes } = require('./routes/feedback');
const { registerAiRoutes } = require('./routes/ai');
const { registerAdminRoutes } = require('./routes/admin');
const { registerAuthRoutes } = require('./routes/auth');
const { registerSystemRoutes } = require('./routes/system');
const { registerDataRoutes } = require('./routes/data');

const KV_KEYS = ['best', 'mastered', 'stats', 'settings', 'reinforceBook', 'deletedItems'];
/* 已迁到行表 user_entity_rows 的 kv 键 → kind 映射（客户端键名 → 服务端 kind）。
   放在这里是为了让「上行入口」一眼看出哪些键不再走 user_kv。 */
const ROW_KV_KINDS = { mastered: 'mastered', reinforceBook: 'reinforce', deletedItems: 'deletedItem' };
/* Production never accepts the historical unconditional mutation protocol.
   Tests run in an isolated compatibility mode so old migration fixtures can
   still exercise their pre-upgrade behavior; no deploy-time switch reopens it. */
const STRICT_CONDITIONAL_WRITES = process.env.NODE_ENV !== 'test';
function rejectUnconditional(body, res, label) {
  if (!STRICT_CONDITIONAL_WRITES) return false;
  if (!body || body.baseSeq === undefined || body.requestId === undefined) {
    res.status(428).json({ error: label + '需要baseSeq和requestId，请升级客户端', code: 'CLIENT_UPGRADE_REQUIRED' });
    return true;
  }
  return false;
}

/* AI 联网生成开关（2026-09-06 产品决策：先禁联网 AI 生成，后续再开放）。
   默认关闭；开启方式：环境变量 AI_EXPLAIN_ENABLED=true（或 .env 中设置）。 */
const AI_EXPLAIN_ENABLED = String(process.env.AI_EXPLAIN_ENABLED || '').trim().toLowerCase() === 'true';

const app = express();
/* 安全加固（2026-09-10）：移除 Express 默认的 `X-Powered-By: Express` 响应头。
   暴露后端技术栈会帮攻击者直接定位已知漏洞版本，属零成本减少攻击面。 */
app.disable('x-powered-by');
/* 分层 body 上限（2026-09-11 安全审查 P0-2）：鉴权接口 payload 极小（用户名/密码），
   先于全局大限注册，用 64kb 兜住；后续全局 80mb 只服务于图文课程/反馈截图等真正的大 payload。
   body-parser 会在首个解析后置 req._body，后续 parser 自动跳过，故按路径前置是安全的最小改法。 */
app.use('/api/auth', express.json({ limit: '64kb' }));
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

function shanghaiDay(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(ms));
  const values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + '-' + values.month + '-' + values.day;
}

function touchUserActivity(userId) {
  const now = Date.now();
  const day = shanghaiDay(now);
  db.prepare(
    "INSERT INTO user_activity (user_id,day,first_seen_at,last_seen_at,page_views) VALUES (?,?,?,?,1) " +
    "ON CONFLICT(user_id,day) DO UPDATE SET last_seen_at=excluded.last_seen_at, page_views=user_activity.page_views+1"
  ).run(userId, day, now, now);
}

const { adminOnly, parseRangeDays, adminOverview } = createAdminOverview({ db, admin, shanghaiDay });
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
/* ===================== 鉴权 ===================== */
/* P1 认证限速（2026-09-09）：防暴力破解/撞库/批量注册。
   纯内存固定窗口（15 分钟），单实例自托管够用；多实例负载均衡需换共享存储（Redis）。
   默认读 req.ip（直连可靠）；经 Nginx 等反代时设 TRUST_PROXY=true（只信任第一跳 X-Forwarded-For）。 */
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').trim().toLowerCase() === 'true';
if (TRUST_PROXY) app.set('trust proxy', 1);

const RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE = {
  register: 10,  // 每 IP 每窗口最多 10 次注册请求（成功/失败都计，防枚举与批量建号）
  loginFail: 10, // 每 IP 每窗口最多 10 次登录失败 → 锁定 429（成功登录清零）
  adminLoginFail: 5, // 管理员每 IP 每窗口最多 5 次失败 → 第 6 次起锁定 429
  credChange: 10 // 每 IP 每窗口最多 10 次凭据修改；同源「用户名已被占用」提示也是枚举面，故一并限速
};
const authRate = createAuthRateLimiter({ windowMs: RATE_WINDOW_MS });
const { rateBlocked, rateHit, rateClear, send429 } = authRate;
registerAdminRoutes({
  app,
  admin,
  auth,
  db,
  adminOnly,
  adminOverview,
  parseRangeDays,
  rateBlocked,
  rateClear,
  rateHit,
  send429,
  authRate: AUTH_RATE
});

registerAuthRoutes({
  app,
  auth,
  rateBlocked,
  rateHit,
  rateClear,
  send429,
  limits: AUTH_RATE
});

/* ===================== 数据读写 ===================== */
/* 组装给客户端的 mem。since == null → 全量（与拆表前完全一致）；
   since 有值 → 只回「该用户 seq>since 的变更」（行级增量下行，2026-09-10 第三轮）。

   ★ 水位必须**先取**再取行：见 currentSeq 注释。
   ★ 增量模式必须显式给出删除清单（deleted.* / entityGone），见下方注释。
   ★ 增量返回的 `mem` 是**局部**对象（只含变更项），老客户端拿到会当成全量 → 丢数据。
     所以增量纯 opt-in：只有显式传 since 才会走到，默认路径逐字节不变。 */
/* seq 一律写在 DO UPDATE 的 SET 里（而不是外层 INSERT 的 values）——
   若 rev 守卫不成立、这次写入被拒，seq 也不会推进；
   否则客户端会「收到了一个其实没落库的变更」水位，真变更永远拉不到。 */
const { assertRevisionAccepted, assertBatchVersion, batchHash } = require('./sync-conflict');
const { upsertDeck, updateDeckPublication, upsertKv, upsertCourse, upsertCourseProgress } = createDataWriters({
  db,
  assertRevisionAccepted
});
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
const {
  upsertSentenceStat, deleteSentenceStat, upsertEvent, deleteEvent,
  upsertEntityRow, deleteEntityRow, putEntityBlob
} = createDataRows({ stmt });

/* ----- 变更序号（行级增量下行，2026-09-10 第三轮） -----
   每个用户一个单调递增计数器；一次写入请求共用一个 seq，所有被它改动的行都盖这个号。
   客户端的水位语义是「seq<=N 的我都收到了」，整批同号 + 按批原子应用即可，无需逐行发号。

   ★ currentSeq 必须**先于**读行调用：先定住水位，再按 `seq<=水位` 取行。
     反过来（先读行、后读计数器）会把「请求期间新写入的行」也读进来，
     却把水位报到更新的值 → 客户端以为收到了、下次不再拉（静默少数据）。 */
const { currentSeq, allocSeq } = createChangeSequence({ stmt });
const { buildMemSnapshot, readMemSnapshot } = createSnapshotReader({ db, currentSeq });
const { migrateStatsToRows, migrateEntityRows } = createDataMigrations({
  db,
  allocSeq,
  upsertSentenceStat,
  upsertEvent,
  putEntityBlob
});
const saveData = createDataSave({
  db,
  batchHash,
  assertBatchVersion,
  currentSeq,
  allocSeq,
  KV_KEYS,
  ROW_KV_KINDS,
  upsertDeck,
  updateDeckPublication,
  upsertKv,
  upsertCourse,
  upsertCourseProgress,
  upsertSentenceStat,
  deleteSentenceStat,
  upsertEvent,
  deleteEvent,
  putEntityBlob,
  upsertEntityRow,
  deleteEntityRow
});

registerDataRoutes({
  app,
  auth,
  rejectUnconditional,
  validate,
  readMemSnapshot,
  saveData
});

const resolutions = require('./sync-resolution').createResolutionService(db, function(userId, entity, id, value, rev, deleted, seq){
  if (entity === 'decks') upsertDeck(userId, value || { id }, rev, deleted, seq);
  else if (entity === 'courses') upsertCourse(userId, value || { courseId: id }, rev, deleted, seq);
  else if (entity === 'courseProgress') upsertCourseProgress(userId, id, value, rev, deleted, seq);
  else upsertKv(userId, id, value, rev, deleted, seq);
}, allocSeq);
const resolutionModule = require('./sync-resolution');
const batchToken = resolutionModule.batchToken;
const makeBatchReplacement = createBatchReplacement({ buildMemSnapshot });

const batchResolutions = resolutionModule.createBatchResolutionService(db,
  userId => buildMemSnapshot(userId),
  (userId, local, remote, requestId) => saveData(userId, makeBatchReplacement(userId, local, remote, requestId), true));
registerSyncRoutes({ app, auth, resolutions, batchResolutions });
registerCourseRoutes({
  app,
  auth,
  validate,
  db,
  upsertCourse,
  allocSeq,
  strictConditionalWrites: STRICT_CONDITIONAL_WRITES
});
registerDeckRoutes({
  app,
  auth,
  db,
  validate,
  saveData,
  updateDeckPublication,
  allocSeq,
  rejectUnconditional,
  strictConditionalWrites: STRICT_CONDITIONAL_WRITES
});
// Compatibility marker for the legacy static contract: app.post('/api/feedback' is registered in routes/feedback.js without auth.
registerFeedbackRoutes({ app, feedback });

/* ===================== AI 代理（ADR-004） =====================
   API Key 不再进前端：服务端 DEEPSEEK_API_KEY 优先；自托管可经 body.apiKey 降级
   （仅当服务端未配置时被接受）。服务端 ai_cache 命中直接返回（省 token）；
   未命中 → 每用户限流 → 调模型 → 写缓存。 */
/* ===================== 备份导入导出 ===================== */
/* ai_cache 容量上限 + TTL 过期（ADR-008 / Phase A / C）：
   容量：AI 写缓存后按 AI_CACHE_MAX（默认 2000）LRU 淘汰最旧；
   TTL：AI_CACHE_TTL 天（默认 30）内未使用的缓存视为过期，命中时走 miss 重新生成；
   过期条目在 trim 时懒清理（写路径触发，无需定时器）。AI_CACHE_TTL=0 表示永不过期。 */
const AI_CACHE_MAX = (function () {
  /* P3（2026-09-11 安全审查）：env 配非法值（NaN/非正数）→ fail-closed 回退默认。
     AI_CACHE_MAX=0/负会让 trimAiCache 一次清空全部缓存（自 DoS）；NaN 会让比较恒 false（静默失效）。 */
  const raw = parseInt(process.env.AI_CACHE_MAX || '2000', 10);
  return (Number.isFinite(raw) && raw > 0) ? raw : 2000;
})();
const AI_CACHE_TTL = (function () {
  /* TTL=0 是合法值（永不过期，见上方注释）；只挡 NaN/负值（负 TTL 会变成 datetime('now','+n days') 乱删）。 */
  const raw = parseInt(process.env.AI_CACHE_TTL || '30', 10);
  return (Number.isFinite(raw) && raw >= 0) ? raw : 30;
})();
/* 提示词/模型升级时 bump：旧版本缓存（ver 不匹配）一律视为 miss 重新生成，
   防止"解读质量被旧缓存锁死"。必须与 js/ai-prompts.mjs 的 PROMPT_VERSION 同步修改。 */
const AI_PROMPT_VERSION = 1;
registerAiRoutes({
  app,
  auth,
  ai,
  db,
  metrics,
  enabled: AI_EXPLAIN_ENABLED,
  cacheMax: AI_CACHE_MAX,
  cacheTtl: AI_CACHE_TTL,
  promptVersion: AI_PROMPT_VERSION
});
registerBackupRoutes({
  app,
  auth,
  readMemSnapshot,
  rejectUnconditional,
  validate,
  saveData
});
registerSystemRoutes({
  app,
  auth,
  metrics,
  aiEnabled: AI_EXPLAIN_ENABLED,
  touchUserActivity
});
/* ===================== 静态托管前端（本地调试零配置） =====================
   开发期直接 node index.js 后打开 http://<host>:<PORT>/main.html 即可，
   前端与 API 同源，免登录、免 CORS、免配置服务器地址。
   生产部署建议由 Nginx 托管前端 + 反向代理 /api（见部署文档）。 */
/* 静态托管的敏感路径守卫 —— **唯一实现在 server/middleware/static-guard.js**。
   2026-09-21 P0：原先的正则直接打在未解码的 req.path 上，被 //server/…、/%73erver/… 绕过
   （线上实测 200，可下载整库）。修法不是补黑名单条目，而是**先规范化再判定**；
   规则已全部搬进该模块，这里不再保留副本，避免两份实现漂移。 */
app.use(createStaticGuard());
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
const adminState = admin.ensureAdminUser();
if (!adminState.configured) {
  console.warn('[admin] 未初始化管理员账号：请配置 ADMIN_PASSWORD 与 ADMIN_JWT_SECRET 后重启服务');
}

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
