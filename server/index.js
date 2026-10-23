/**
 * index.js · Chunk Lab 云端后端入口
 *
 * 路由总览（前缀 /api）：
 *   鉴权：POST /auth/register  POST /auth/login  GET /auth/me
 *   数据：GET /data；POST /operations、POST /content-import（确认读取与窄操作写入）
 *   备份：GET /export；显式恢复使用 /recovery（保留归档，禁止覆盖非空账号）
 *   旧版整份写入/冲突处理接口在新协议下只返回升级拒绝，不应用数据。
 *   健康：GET  /health
 *
 * 所有数据接口需 Authorization: Bearer <token>（JWT）。
 * 前后端分离：前端与 API 同源部署无需 CORS；跨域须显式配 CORS_ORIGINS（留空 = 拒绝跨域，fail-closed）。
 */
require('./loadenv');
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
const { createSeoPagesMiddleware, freshnessCheck } = require('./middleware/seo-pages');
const { createChangeSequence } = require('./services/change-seq');
const { createSnapshotReader } = require('./services/data-snapshot');
const { createDataWriters } = require('./services/data-writers');
const { createDataRows } = require('./services/data-rows');
const { createDataMigrations } = require('./services/data-migrations');
const { createAdminOverview } = require('./services/admin-overview');
const usageAnalytics = require('./services/usage-analytics').createUsageAnalytics({ db,
  resourceName(userId, kind, resourceId) {
    try {
      if (kind === 'vocabulary') return '入门单词练习';
      if (kind === 'wordbook') return vocabularyContent.book(resourceId.replace(/^wordbook:/, ''), userId).title;
      const deck = db.prepare('SELECT name FROM user_decks WHERE user_id=? AND id=?').get(userId, resourceId);
      if (deck) return deck.name;
      const course = membershipContentRegistry.course(resourceId);
      if (course) return course.title;
    } catch (_) { /* Historical resources can be unavailable without losing their usage. */ }
    return kind === 'wordbook' ? '单词本练习（历史内容）' : '句子练习（历史内容）';
  }
});
const { registerDeckRoutes } = require('./routes/decks');
const { registerContentShardsRoutes } = require('./routes/content-shards');
const { registerBackupRoutes } = require('./routes/backup');
const { registerFeedbackRoutes } = require('./routes/feedback');
const { registerAiRoutes } = require('./routes/ai');
const { registerAdminRoutes } = require('./routes/admin');
const { registerContentStudioRoutes } = require('./routes/content-studio');
const { registerLibraryRoutes } = require('./routes/library');
const { createLibraryCatalog } = require('./services/library-catalog');
const {createVocabularyContent}=require('./services/vocabulary-content');
const {createVocabularyStudyOperations}=require('./services/vocabulary-study-operations');
const {registerWordbookRoutes}=require('./routes/wordbooks');
const { createContentStudio } = require('./services/content-studio');
const { registerAuthRoutes } = require('./routes/auth');
const { registerMembershipRoutes } = require('./routes/membership');
const { registerAdminMembershipRoutes } = require('./routes/admin-membership');
const { registerSystemRoutes } = require('./routes/system');
const { registerDataRoutes } = require('./routes/data');
const { registerVocabularyPracticeRoutes } = require('./routes/vocabulary-practice');
const { registerLearningArchiveRoutes } = require('./routes/learning-archive');
const { registerOperationRoutes } = require('./routes/operations');
const { createOperations, MAX_CONTENT_IMPORT_BYTES } = require('./services/operations');
const { registerContentImportRoutes } = require('./routes/content-import');
const { registerClientSaveHealthRoutes } = require('./routes/client-save-health');
const { registerRecoveryRoutes } = require('./routes/recovery');
const { createRecoveryIngest } = require('./services/recovery-ingest');
const { reducePracticeEvents } = require('./services/learning-replay');
const { createAssessmentContent } = require('./services/assessment-content');
const serverSrs = require('../srs');

const KV_KEYS = ['best', 'mastered', 'stats', 'settings', 'reinforceBook', 'deletedItems'];
/* 已迁到行表 user_entity_rows 的 kv 键 → kind 映射（客户端键名 → 服务端 kind）。
   放在这里是为了让「上行入口」一眼看出哪些键不再走 user_kv。 */
const ROW_KV_KINDS = { mastered: 'mastered', reinforceBook: 'reinforce', deletedItems: 'deletedItem' };
/* Production never accepts the historical unconditional mutation protocol.
   Tests run in an isolated compatibility mode so old migration fixtures can
   still exercise their pre-upgrade behavior; no deploy-time switch reopens it. */
const STRICT_CONDITIONAL_WRITES = process.env.NODE_ENV !== 'test';
/* Only the explicit isolated historical launcher can select protocol 2.
   Normal startup uses protocol 3 even under NODE_ENV=test. */
const requestedWriteProtocol = process.env.NODE_ENV === 'test' &&
  typeof global.__chunklabHistoricalRouteRegistrar === 'function' ? 2 : 3;
const storedWriteProtocolRow = db.prepare("SELECT setting_value FROM app_runtime_settings WHERE setting_key='write_protocol'").get();
let WRITE_PROTOCOL = Number(storedWriteProtocolRow && storedWriteProtocolRow.setting_value) >= 3 ? 3 : requestedWriteProtocol;
if (WRITE_PROTOCOL >= 3 && !(Number(storedWriteProtocolRow && storedWriteProtocolRow.setting_value) >= 3)) {
  db.prepare("INSERT INTO app_runtime_settings(setting_key,setting_value) VALUES('write_protocol','3') ON CONFLICT(setting_key) DO UPDATE SET setting_value='3',updated_at=datetime('now')").run();
}
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
/* 分层 body 上限：鉴权接口 payload 极小（用户名/密码），先于全局大限注册，用 64kb 兜住；
   全局上限与协议 3 单实体 content-import 的 80 MiB 服务端合同保持一致。
   body-parser 会在首个解析后置 req._body，后续 parser 自动跳过，故按路径前置是安全的最小改法。 */
app.use('/api/auth', express.json({ limit: '64kb' }));
app.use('/api/usage', express.json({ limit: '4kb' }));
app.use(express.json({ limit: MAX_CONTENT_IMPORT_BYTES })); // 数值字节，避免 80mb 被解释成十进制 80,000,000

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
  credentials: true,
  exposedHeaders: ['X-ChunkLab-Account-Id']
}));

/* ===== 可观测性（上线前）：请求日志 + 全局指标 =====
   日志：方法 路径 状态码 耗时(ms) 用户id（轻量解析 token，不阻塞鉴权）
   指标：ai_cache 命中/未命中计数 + /api/stats 查询接口（匿名只读，无用户数据） */
const metrics = { aiCacheHits: 0, aiCacheMisses: 0, startedAt: new Date().toISOString() };

const shanghaiDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});
function shanghaiDay(ms) {
  const parts = shanghaiDayFormatter.formatToParts(new Date(ms));
  const values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + '-' + values.month + '-' + values.day;
}

const touchUserActivityStatement = db.prepare(
  "INSERT INTO user_activity (user_id,day,first_seen_at,last_seen_at,page_views) VALUES (?,?,?,?,1) " +
  "ON CONFLICT(user_id,day) DO UPDATE SET last_seen_at=excluded.last_seen_at, page_views=user_activity.page_views+1"
);
function touchUserActivity(userId) {
  const now = Date.now();
  const day = shanghaiDay(now);
  touchUserActivityStatement.run(userId, day, now, now);
}

const { adminOnly, parseRangeDays, adminOverview, adminSyncQuarantines, adminSaveFailures, adminSaveHealth } = createAdminOverview({ db, admin, shanghaiDay });
function recordSaveFailure(userId, code, status, traceId) {
  db.prepare('INSERT INTO user_operation_failures(user_id,code,status,trace_id) VALUES(?,?,?,?)')
    .run(userId, code, status, traceId);
  db.prepare("DELETE FROM user_operation_failures WHERE created_at < datetime('now', '-30 days')").run();
  db.prepare('DELETE FROM user_operation_failures WHERE user_id=? AND id NOT IN ' +
    '(SELECT id FROM user_operation_failures WHERE user_id=? ORDER BY id DESC LIMIT 500)').run(userId, userId);
}
function userIdFromReq(req) {
  // The authentication middleware already verified this request. Reuse its
  // result only for logging; this does not grant access or cache credentials.
  if (auth.REQUIRE_AUTH && Number.isSafeInteger(req.userId) && req.userId > 0 &&
      (req.headers.authorization || '').startsWith('Bearer ')) return String(req.userId);
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
  adminSyncQuarantines,
  adminSaveFailures,
  adminSaveHealth,
  usageAnalytics,
  parseRangeDays,
  rateBlocked,
  rateClear,
  rateHit,
  send429,
  authRate: AUTH_RATE
});

const membershipRepository = require('./services/membership/repository').createMembershipRepository(db);
const membershipKeyring = require('./services/membership/code-keyring').createEnvironmentCodeKeyring();
const membershipIssuer = require('./services/membership/code-issuer').createMembershipCodeIssuer({
  repository: membershipRepository, keyProvider: membershipKeyring
});
const membershipEntitlements = require('./services/membership/entitlement-service').createEntitlementService({ db });
const membershipTrialMeter = require('./services/membership/trial-usage-meter').createTrialUsageMeter({
  db, repository: membershipRepository, entitlements: membershipEntitlements
});
const membershipAdmin = require('./services/membership/admin-service').createMembershipAdminService({
  db, repository: membershipRepository, issuer: membershipIssuer
});
const membership = require('./services/membership/membership-service').createMembershipService({
  db, repository: membershipRepository, entitlements: membershipEntitlements, usageMeter: membershipTrialMeter
});
const membershipRedemption = require('./services/membership/redemption-service').createRedemptionService({
  db, repository: membershipRepository, issuer: membershipIssuer, entitlements: membershipEntitlements, trialMeter: membershipTrialMeter
});
registerAdminMembershipRoutes({ app, adminOnly, membershipAdmin, repository: membershipRepository, entitlements: membershipEntitlements });
registerMembershipRoutes({ app, auth, membership, redemption: membershipRedemption });

const wordbookPublicationRoot=path.join(path.dirname(path.resolve(db.name)),'wordbook-publications');
const publicWordbookVersions=require('./services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot:wordbookPublicationRoot});
const vocabularyContent=createVocabularyContent({appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),publishedRoot:wordbookPublicationRoot,versions:publicWordbookVersions,personal:require('./services/personal-wordbooks').createPersonalWordbooks({db,appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..')})});
const wordDictationEnabled=process.env.CHUNKLAB_WORD_DICTATION==='true';
const wordChoiceEnabled=process.env.CHUNKLAB_WORD_CHOICE==='true';
const chunkOrderEnabled=process.env.CHUNKLAB_CHUNK_ORDER==='true';
const readAloudEnabled=process.env.CHUNKLAB_READ_ALOUD==='true';
const vocabularyBrowseEnabled=process.env.CHUNKLAB_VOCABULARY_BROWSE==='true';
const vocabularyImageDelivery=require('./middleware/vocabulary-image-delivery').configuredVocabularyImageDelivery(process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),process.env,{publishedRoot:vocabularyContent.publicationDirectory});
const vocabularyTeachingContent=require('./services/vocabulary-teaching-content').createVocabularyTeachingContent({content:vocabularyContent,appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),resolveImage:vocabularyImageDelivery.resolveImage});
const library = createLibraryCatalog({ db, vocabularyContent, appRoot: process.env.CHUNKLAB_APP_ROOT || path.resolve(__dirname, '..') });
const membershipContentRegistry = new (require('./services/membership/content-registry').ContentRegistry)({
  activeManifest:()=>{const row=db.prepare('SELECT manifest_json AS body FROM membership_static_activations ORDER BY rowid DESC LIMIT 1').get();return row||null;},
  appRoot: process.env.CHUNKLAB_APP_ROOT || path.resolve(__dirname, '..'),
  protectedRoot: path.join(path.dirname(path.resolve(db.name)), 'membership-content'),
  requireManifest: () => !!db.prepare("SELECT 1 FROM course_access_revisions WHERE access_level='member' UNION ALL SELECT 1 FROM membership_course_publications WHERE status='published' LIMIT 1").get(),
  publishedCourses: () => db.prepare("SELECT registry_entry_json FROM membership_course_publications WHERE status='published' ORDER BY publication_id").all().map(row => JSON.parse(row.registry_entry_json)),
  legacyCourses: () => library.legacyResources().filter(resource => resource.kind === 'course' && resource.courseId).map(resource => ({
    courseId: resource.courseId, title: resource.title, contentType: 'sentence',
    units: resource.sourceRefs.map((contentRef, index) => ({ unitId: 'legacy-' + index, contentRef, itemIds: ['*'] }))
  }))
});
const membershipCourseAccess = require('./services/membership/course-access-service').createCourseAccessService({
  db, registry: membershipContentRegistry, entitlements: membershipEntitlements,
  usageMeter: membershipTrialMeter, membership,
  isAuthenticatedAccount: userId => auth.REQUIRE_AUTH && !!userId && !!auth.readUser(userId) && auth.readUser(userId).username !== '__default__',
  hasPublicDeck: id => !!db.prepare('SELECT 1 FROM user_decks WHERE id=? AND is_public=1 AND deleted_at IS NULL LIMIT 1').get(id)
});
const membershipContentGrants = new (require('./services/membership/content-grant-service').ContentGrantService)({
  keyProvider: () => {
    const key = process.env.MEMBERSHIP_CONTENT_GRANT_KEY || '';
    return /^[A-Za-z0-9+/]+={0,2}$/.test(key) ? Buffer.from(key, 'base64') : null;
  },
  resolveScope: (...args) => membershipContentRegistry.fragmentScope(...args),
  authorize: (...args) => membershipCourseAccess.authorize(...args)
});
require('./routes/course-fragments').registerCourseFragmentRoutes({ app, auth, registry: membershipContentRegistry, grants: membershipContentGrants });
require('./routes/protected-course-content').registerProtectedCourseContentRoutes({
  app, auth, courseAccess: membershipCourseAccess, registry: membershipContentRegistry, grants: membershipContentGrants, usageMeter: membershipTrialMeter, adminOnly
});
library.setPlatformResources(() => membershipCourseAccess.catalogResources());
require('./routes/course-publishing').registerCoursePublishingRoutes({ app, adminOnly,
  publisher: require('./services/membership/course-publisher').createCoursePublisher({ db, registry: membershipContentRegistry, courseAccess: membershipCourseAccess }) });
require('./routes/course-source-review').registerCourseSourceReviewRoutes({app,adminOnly,
  inventory:new (require('./services/membership/legacy-course-inventory').LegacyCourseInventory)({appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),
    publicDecks:()=>db.prepare('SELECT id,items_json FROM user_decks WHERE is_public=1 AND deleted_at IS NULL').all().map(row=>({id:row.id,items:JSON.parse(row.items_json)}))})});
registerLibraryRoutes({ app, adminOnly, library });
require('./routes/illustration-review').registerIllustrationReviewRoutes({app,adminOnly,service:require('./services/illustration-review').createIllustrationReview({appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),storePath:path.join(path.dirname(path.resolve(db.name)),'illustration-review.sqlite')})});
const wordbookPublisher=require('./services/wordbook-publisher').createWordbookPublisher({appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),content:vocabularyContent,versions:publicWordbookVersions,checkImageAliases:vocabularyImageDelivery.checkAliases});
require('./routes/wordbook-publishing').registerWordbookPublishingRoutes({app,adminOnly,publisher:wordbookPublisher});
const adminWordbookImports=require('./services/admin-wordbook-imports').createAdminWordbookImports({appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),dataDirectory:path.join(path.dirname(path.resolve(db.name)),'system-wordbook-imports'),publisher:wordbookPublisher,checkAliases:vocabularyImageDelivery.checkAliases});
require('./routes/admin-wordbook-imports').registerAdminWordbookImportRoutes({app,adminOnly,service:adminWordbookImports});
const materialLibrary=require('./services/vocabulary-material-library').createVocabularyMaterialLibrary({storePath:path.join(path.dirname(path.resolve(db.name)),'vocabulary-material-library.sqlite')});
require('./routes/vocabulary-material-library').registerVocabularyMaterialLibraryRoutes({app,adminOnly,service:materialLibrary,releases:require('./services/vocabulary-material-release').createVocabularyMaterialRelease({service:materialLibrary,publisher:wordbookPublisher,appRoot:process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..')})});
registerContentStudioRoutes({
  app,
  adminOnly,
  writeProtocol: WRITE_PROTOCOL,
  studio: createContentStudio({ db, appRoot: process.env.CHUNKLAB_APP_ROOT || path.resolve(__dirname, '..') }),
});

registerAuthRoutes({
  app,
  auth,
  db,
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
  upsertSentenceStat, replaceSentenceStat, deleteSentenceStat, upsertEvent, deleteEvent,
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
let legacyDataWriter;
function getLegacyDataWriter() {
  if (legacyDataWriter) return legacyDataWriter;
  legacyDataWriter = require('./services/data-save').createDataSave({
    db, batchHash, assertBatchVersion, currentSeq, allocSeq, KV_KEYS, ROW_KV_KINDS,
    upsertDeck, updateDeckPublication, upsertKv, upsertCourse, upsertCourseProgress,
    upsertSentenceStat, deleteSentenceStat, upsertEvent, deleteEvent,
    putEntityBlob, upsertEntityRow, deleteEntityRow
  });
  return legacyDataWriter;
}
const hasAccountPersistenceState = db.prepare(`SELECT EXISTS(
  SELECT 1 FROM user_batch_receipts WHERE user_id=?
  UNION ALL SELECT 1 FROM user_operation_receipts WHERE user_id=?
  UNION ALL SELECT 1 FROM user_operation_events WHERE user_id=?
  UNION ALL SELECT 1 FROM user_learning_baselines WHERE user_id=?
  UNION ALL SELECT 1 FROM user_learning_generation_baselines WHERE user_id=?
  UNION ALL SELECT 1 FROM user_learning_events WHERE user_id=?
  UNION ALL SELECT 1 FROM user_learning_generations WHERE user_id=?
  UNION ALL SELECT 1 FROM user_learning_resumes WHERE user_id=?
  UNION ALL SELECT 1 FROM user_assessment_sessions WHERE user_id=?
  UNION ALL SELECT 1 FROM user_decks WHERE user_id=?
  UNION ALL SELECT 1 FROM user_kv WHERE user_id=?
  UNION ALL SELECT 1 FROM user_courses WHERE user_id=?
  UNION ALL SELECT 1 FROM user_course_progress WHERE user_id=?
  UNION ALL SELECT 1 FROM user_sentence_stats WHERE user_id=?
  UNION ALL SELECT 1 FROM user_events WHERE user_id=?
  UNION ALL SELECT 1 FROM user_entity_rows WHERE user_id=?
  UNION ALL SELECT 1 FROM user_sync_resolutions WHERE user_id=?
  UNION ALL SELECT 1 FROM user_recovery_sources WHERE user_id=? AND source_id<>?
  UNION ALL SELECT 1 FROM user_recovery_source_uploads WHERE user_id=?
  UNION ALL SELECT 1 FROM user_recovery_source_chunks WHERE user_id=?
) AS has_state`);
function isAccountPersistenceEmpty(userId, sourceId) {
  // initChangeSeq seeds new accounts at 1. A later sequence is evidence of a
  // prior server write even if its business row was subsequently removed.
  if (currentSeq(userId) > 1) return false;
  const params = Array(17).fill(userId);
  params.push(userId, sourceId, userId, userId);
  return hasAccountPersistenceState.get(...params).has_state === 0;
}

const protectedAssessmentContent = require('./services/membership/assessment-content').createProtectedAssessmentContent({registry: membershipContentRegistry, courseAccess: membershipCourseAccess});
const operations = createOperations({
  db,
  library,
  vocabularyContent,
  enableWordDictation:wordDictationEnabled,
  enableWordChoice:wordChoiceEnabled,
  enableChunkOrder:chunkOrderEnabled,
  enableReadAloud:readAloudEnabled,
  enableVocabularyBrowse:vocabularyBrowseEnabled,
  vocabularyTeachingContent,
  allocSeq,
  readChanges: (userId, seq) => buildMemSnapshot(userId, Math.max(0, seq - 1)),
  upsertDeck,
  upsertCourse,
  upsertCourseProgress,
  upsertKv,
  upsertSentenceStat,
  replaceSentenceStat,
  deleteSentenceStat,
  upsertEvent,
  upsertEntityRow,
  deleteEntityRow,
  srs: serverSrs,
  reducePracticeEvents,
  assessmentScopeKey: protectedAssessmentContent.scopeKey,
  resolveAssessmentItem: createAssessmentContent({ db,
    resolveProtectedItem: protectedAssessmentContent.resolve,
    assertPublicDeck: deckId => {
      if (deckId.startsWith('protected_') || membershipContentRegistry.snapshot().courses.some(course => course.legacyDeckIds.includes(deckId) ||
          course.units.some(unit => unit.contentRef.type === 'sentence-deck' && unit.contentRef.id === deckId))) {
        throw Object.assign(new Error('请从课程入口复习，重新检查当前学习权限；学习记录仍然保留。'), { code: 'PROTECTED_COURSE_ENTRY_REQUIRED', status: 403 });
      }
    },
    assertPublicPath: url => {
      if (membershipContentRegistry.blockedPath(url)) throw Object.assign(new Error('请从课程入口读取受保护的测评题目。'), { code: 'PROTECTED_COURSE_ENTRY_REQUIRED', status: 403 });
    }
  }).resolve,
  hash: batchHash
});
registerOperationRoutes({ app, auth, operations, writeProtocol: WRITE_PROTOCOL, recordSaveFailure });
const protectedAssessments = require('./services/membership/assessment-service').createProtectedAssessmentService({ db, courseAccess: membershipCourseAccess, operations });
require('./routes/protected-assessments').registerProtectedAssessmentRoutes({app,auth,assessments:protectedAssessments,writeProtocol:WRITE_PROTOCOL});
registerContentImportRoutes({ app, auth, operations, validate, writeProtocol: WRITE_PROTOCOL, recordSaveFailure });
registerClientSaveHealthRoutes({ app, auth, db, writeProtocol: WRITE_PROTOCOL });
registerRecoveryRoutes({
  app,
  auth,
  express,
  recovery: createRecoveryIngest(db, {
    ownerIdentityForUser: userId => auth.REQUIRE_AUTH ? String(userId) : 'local',
    legacyWritesFenced: WRITE_PROTOCOL >= 3,
    validatePutPayload: validate.validatePutPayload,
    currentSeq,
    readCurrentSnapshot: buildMemSnapshot,
    isAccountEmpty: isAccountPersistenceEmpty,
    executeRecoveryOperation: function (userId, operation) { return operations.execute(userId, operation); },
    saveLegacyBaseline: require('./services/recovery-baseline').createRecoveryBaselineWriter({
      db, isAccountEmpty: isAccountPersistenceEmpty, getWriter: getLegacyDataWriter, upsertEntityRow
    })
  })
});

registerVocabularyPracticeRoutes({app,auth,db});
registerLearningArchiveRoutes({app,auth,db,content:vocabularyContent});
const vocabularyBrowse=require('./services/vocabulary-browse-operations').createVocabularyBrowseOperations({db,resolvePlan:vocabularyTeachingContent.resolvePlan,upsertEntityRow,enabled:vocabularyBrowseEnabled,operationError:(message,code,status)=>Object.assign(Error(message),{code,status})});
registerWordbookRoutes({app,auth,content:vocabularyContent,browse:vocabularyBrowse,teaching:vocabularyTeachingContent,study:createVocabularyStudyOperations({db,content:vocabularyContent,upsertEntityRow,enableWordDictation:wordDictationEnabled,enableWordChoice:wordChoiceEnabled,enableChunkOrder:chunkOrderEnabled,enableReadAloud:readAloudEnabled,operationError:(message,code,status)=>Object.assign(new Error(message),{code,status})})});
registerDataRoutes({
  app,
  auth,
  readMemSnapshot
});

if (WRITE_PROTOCOL === 3) {
  require('./routes/retired-sync').registerRetiredSyncRoutes({ app, auth, db });
} else {
  const historicalRegistrar = global.__chunklabHistoricalRouteRegistrar;
  if (typeof historicalRegistrar !== 'function') throw new Error('Historical protocol requires the dedicated test launcher');
  historicalRegistrar({
    app, auth, db, getLegacyDataWriter, rejectUnconditional, validate, upsertDeck, upsertCourse, upsertCourseProgress, upsertKv, allocSeq, buildMemSnapshot, updateDeckPublication, STRICT_CONDITIONAL_WRITES, WRITE_PROTOCOL
  });
}
registerDeckRoutes({ app, db, contentRegistry: membershipContentRegistry });
/* T5：鉴权分片表（GET /api/content/shards）。公开 manifest 收敛为元数据后，
   客户端分片路径改由本接口提供；源文件在 server/content/（static-guard 已 403 保护）。 */
registerContentShardsRoutes({ app, auth, contentRegistry: membershipContentRegistry });
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
  personalWordbooks:vocabularyContent.personal
});
registerSystemRoutes({
  app,
  auth,
  metrics,
  aiEnabled: AI_EXPLAIN_ENABLED,
  writeProtocol: WRITE_PROTOCOL,
  touchUserActivity,
  usageAnalytics
});
/* ===================== 静态托管前端（本地调试零配置） =====================
   开发期直接 node index.js 后打开 http://<host>:<PORT>/main.html 即可，
   前端与 API 同源，免登录、免 CORS、免配置服务器地址。
   生产部署建议由 Nginx 托管前端 + 反向代理 /api（见部署文档）。 */
/* 静态托管的敏感路径守卫 —— **唯一实现在 server/middleware/static-guard.js**。
   2026-09-21 P0：原先的正则直接打在未解码的 req.path 上，被 //server/…、/%73erver/… 绕过
   （线上实测 200，可下载整库）。修法不是补黑名单条目，而是**先规范化再判定**；
   规则已全部搬进该模块，这里不再保留副本，避免两份实现漂移。 */
const staticAppRoot = process.env.CHUNKLAB_APP_ROOT || path.join(__dirname, '..');
app.use(createSeoPagesMiddleware({ rootDir: staticAppRoot }));
app.use(createStaticGuard());
app.use(require('./middleware/course-content-guard').createCourseContentGuard({ registry: membershipContentRegistry }));
app.use(vocabularyImageDelivery);
/* 根路径 → 落地页 index.html。2026-10-05 合并落地页进本仓库后，
   仓库已有 index.html，由下方 express.static 自动托管（默认 index: 'index.html'）。
   原先「仓库无 index.html → 重定向 /main.html」的那一行已删除 —— 保留它会让落地页永远看不到。 */
/* 静态资源压缩（2026-09-10）：见 server/compress.js 头部「为什么需要」。
   8000 句题库 7.80MB → brotli ~1.8MB，是扩容后唯一真正卡前端的瓶颈。
   必须放在 express.static 之前：命中则直接返回压缩体，未命中（客户端不要压缩 / 含 Range / 非文本）
   自行 next() 放行，不改变原有行为。 */
const staticCompress = compress(staticAppRoot);
app.use(staticCompress);
app.use(express.static(staticAppRoot, {setHeaders:function(res,file){
  if(path.basename(file)==='sw.js') res.setHeader('Cache-Control','no-cache');
}}));

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
if (!auth.REQUIRE_AUTH) auth.ensureDefaultUser(); // 仅隔离开放测试夹具使用
const adminState = admin.ensureAdminUser();
if (!adminState.configured) {
  console.warn('[admin] 未初始化管理员账号：请配置 ADMIN_PASSWORD 与 ADMIN_JWT_SECRET 后重启服务');
}

/* 个人数据始终要求账号验证；仅显式隔离测试配置可以开放默认账号。 */
if (!auth.REQUIRE_AUTH) {
  const configuredData = process.env.CHUNKLAB_DATA_DIR && path.resolve(process.env.CHUNKLAB_DATA_DIR);
  const liveData = path.resolve(__dirname, 'data');
  const tempRoot = path.resolve(require('os').tmpdir());
  const relativeData = configuredData && path.relative(liveData, configuredData);
  const relativeTemp = configuredData && path.relative(tempRoot, configuredData);
  const outsideLiveData = !!relativeData && (relativeData === '..' || relativeData.startsWith('..' + path.sep) || path.isAbsolute(relativeData));
  const insideTemp = !!relativeTemp && relativeTemp !== '..' && !relativeTemp.startsWith('..' + path.sep) && !path.isAbsolute(relativeTemp);
  const isolatedData = !!configuredData && path.isAbsolute(process.env.CHUNKLAB_DATA_DIR) &&
    outsideLiveData && insideTemp;
  if (process.env.NODE_ENV !== 'test' || process.env.REQUIRE_AUTH !== 'false' || !isolatedData || !process.env.PORT) {
    console.error('[security] FATAL: 免登录仅可用于显式配置独立数据目录和端口的隔离测试；正式服务必须登录');
    process.exit(1);
  }
}
if (process.env.REQUIRE_AUTH === 'false' && process.env.NODE_ENV !== 'test') {
  console.error('[security] FATAL: 正常服务不能关闭登录鉴权');
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

app.listen(PORT, HOST, function () {
  console.log('[chunklab-server] listening on http://' + HOST + ':' + PORT +
    (auth.REQUIRE_AUTH ? ' (多用户模式)' : ' (开放模式·免登录)'));
  securityWarnings.forEach(function (w) { console.warn(w); });
  /* 后台预热大文件压缩体：让第一个访客不必等现场压缩（见 server/compress.js warm） */
  staticCompress.warm();
});
