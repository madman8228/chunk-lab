# Chunk Lab 架构评估与演进规划 (v2)

> 版本：v2.0 ｜ 日期：2026-08-20 ｜ 角色：Software Architect (via WorkBuddy)
> 本文**基于代码核实**重写，取代 2026-08-07 的 v1 规划（v1 描述的是"后端化之前"的愿景，部分已落地、部分未落地，见 §1 与 §4 状态更新）。

---

## 0. 执行摘要（TL;DR）

**已落地的好设计**：SRS 纯函数化（可单测）、存储版本化迁移、CL 单例收敛命名空间、iframe 物理隔离、云端同步雏形、AI 详解缓存。

**当前真实状态**：前端 `main.html` 仍是 **4781 行单体**（v1 规划的"P1 模块化"未落地，只是把上帝对象从 `chunk-practice.html` 搬到了 `main.html`）；后端是 Express + SQLite，但**同步是整块 last-write-wins + DELETE/INSERT**，**开放模式默认共享单用户且 JWT 密钥硬编码默认值**。

**必须优先解决的 5 件事（按严重度）**：

| 级别 | 问题 | 影响 |
|------|------|------|
| 🔴 P0 | 同步整块 LWW + 全量 DELETE/INSERT | 多设备/并发写入相互覆盖，且写入中途崩溃会丢全部该用户数据 |
| 🔴 P0 | 开放模式默认单用户 + 默认 JWT 密钥 | 任何公网部署 = 数据裸奔、可被任意覆盖 |
| 🟠 P1 | `main.html` 4781 行单体 | 熵增回潮，改一处风险全局 |
| 🟠 P1 | 后端零校验、零测试 | 坏数据/崩溃无防护，回归无保障 |
| 🟡 P2 | AI Key 前端直连、ai_cache 无上限、localStorage 5MB | 资损风险、缓存膨胀、离线课程撞天花板 |

---

## 1. 现状评估（代码核实，非文档）

### 1.1 已验证事实

| 维度 | 核实结论 | 证据位置 |
|------|----------|----------|
| 同步实现 | `saveData()` 每次 PUT 对 `user_decks/user_kv/user_courses/user_course_progress` 做**整表 DELETE + 全量 INSERT**；无版本/冲突检测 | `server/index.js:95-119` |
| 鉴权默认 | `REQUIRE_AUTH` 默认 `false`，落到 `__default__` 单用户；`JWT_SECRET` 默认硬编码 `'chunklab-dev-secret-change-me'` | `server/auth.js:15,19` |
| 前端形态 | `main.html` 4781 行单体；`core.js`(CL 单例) 274 行；`srs.js` 纯函数 78 行 | 文件行数 |
| 存储 | 浏览器 5 键 + 版本迁移 v2；云端 6 表（users/user_decks/user_kv/user_courses/user_course_progress/ai_cache） | `core.js`, `server/db.js` |
| 测试 | 仅前端单测：`srs.test.js` / `store.test.js` / `course-resume.test.js` / `validate_oral8000.js`；**后端无测试** | 目录 |
| 版本管理 | **无 git 仓库**（与既有 memory 记录不符，需以实际为准） | `git status` |
| AI | 前端直连 `api.deepseek.com`，Key 存浏览器 `chunklab.v1.settings.apiKey` | `core.js:defaultMem` |

### 1.2 领域边界（沿用 v1 划分，补两个上下文）

| 上下文 | 聚合根 | 关键不变量 | 当前实现位置 |
|--------|--------|-----------|-------------|
| **Practice** | Session | 每句状态机 pending→ok/bad/revealed；chunk 拼接=原句 | `main.html`（需抽离） |
| **Deck** | Deck | 句子去重；chunks 拼接=原句 | `library.js` / `builtins.js` |
| **SRS** | SentenceCard | interval 1→3→7→14→30→60→120→180→365；答错重置 | `srs.js`（纯函数，✅ 已隔离） |
| **Review** | DueQueue | 到期队列、错题本 | `main.html` / `core.js` |
| **Explain** | Explanation | 维度 grammar/syntax/collocation/pattern/oral/words | 前端直连（⚠ 待代理） |
| **Identity** | User | 密码哈希、JWT | `server/auth.js`（✅ 已有） |
| **Sync** ⭐新增 | ChangeSet | **实体级版本、冲突可合并、崩溃可恢复** | 缺失（当前是整块 LWW） |

> ⭐ **Sync 是 v1 规划里最大的空白**——它本应是独立上下文，如今却被"整块覆盖"实现偷偷塞进了存储层。

---

## 2. 待完善项与架构权衡（核心）

每条都给出：问题 → 影响 → 选项 → 推荐 → 取舍。

### 2.1 同步正确性（P0，最高优先）

**问题**：`saveData()` 整表 DELETE + 全量 INSERT。
- 多设备：设备 A 改 deck1、设备 B 改 deck2，B 的同步会把 A 的 deck1 改动整块覆盖掉 → **静默数据丢失**。
- 并发：两次 PUT 交错，后到者整块覆盖先到者。
- 崩溃：DELETE 之后、INSERT 之前进程挂掉 → **该用户数据全空**。

**选项**：

| 方案 | 优点 | 缺点 | 适用 |
|------|------|------|------|
| A 整块 LWW（现状） | 实现 0 成本 | 多设备丢数据、非原子、不可恢复 | 仅单设备 + 纯本地 |
| B 实体级 upsert + rev/updatedAt | 互不覆盖无关改动；崩溃局部；可加软删除 | 需加版本字段与合并逻辑 | **当前推荐** |
| C CRDT (Yjs/Automerge) | 最强最终一致、自动合并 | 复杂度高、需重写数据模型、bundle 体积 | P3 超大规模 |

**推荐：B**。学习类数据天然按实体（deck / sentence / 每个 kv）分片，冲突概率低，且"取较新版本"即可安全合并；删除用**软删除标记**（deleted_at）而非物理删，便于跨设备传播"已删除"。SQLite 加 `rev INTEGER` 或 `updated_at`，服务端 `INSERT ... ON CONFLICT(user_id,id) DO UPDATE WHERE excluded.rev > rev`。

**取舍**：B 比 A 多写版本字段与合并代码，但换来多设备安全 + 崩溃可恢复——这对"学习进度"是用户资产，丢不起。

### 2.2 鉴权与安全（P0，上云前置）

**问题**：开放模式 = 所有人共享 `__default__`，且 `JWT_SECRET` 默认写死。一旦公网暴露，任何人可读/覆盖全站数据。

**选项**：
- A 维持开放模式默认（仅限本地/内网/VPN/allowlist）
- B 任何公网部署强制 `REQUIRE_AUTH=true` + 环境变量注入密钥 + HTTPS
- C 引入速率限制/配额防滥用（尤其 AI 代理）

**推荐**：A 仅限隔离网络；**公网一律走 B + C**。折中方案——"匿名一次性账号"：首次打开自动建匿名 `user_id`（仍按 user_id 隔离），既保留"免注册即学"的零摩擦，又不再共享单用户。

**取舍**：B 牺牲一点"零摩擦"，但这是数据安全底线；匿名账号可把摩擦降到接近零。

### 2.3 前端单体（P1）

**问题**：4781 行 `main.html` 是新的上帝对象，v1 规划的模块化没有落地。

**推荐**：用**原生 ES Module（`<script type="module">`）**把 `main.html` 拆成 `practice 引擎` + `UI shell` + 各上下文模块，**不引入打包器**，保留"零安装"承诺；iframe 隔离继续保留。

**取舍**：ESM 在 `file://` 下无法 import（需 http(s)）。但后端已托管前端（`server/index.js` 静态托管），本地起服务即可，可接受；若必须 `file://` 直开，则退回"构建期内联"或要求用户起服务。**这比引入 Vite/Webpack 更贴合项目"轻量零依赖"的 DNA。**

### 2.4 后端健壮性（P1）

- **服务端校验**：`PUT /api/data` 当前接受任意 `mem` 结构，应做轻量 schema 校验（防止坏数据入库/前端崩溃）。
- **后端冒烟测试**：脚本启动服务 → `/health` → register/login → put/get 往返 → assert 一致。零依赖、Node 直跑。
- **结构化错误日志**：当前 only `console.error`。

### 2.5 AI 与缓存（P2，对应 ADR-004）

- **后端代理（已落地 2026-08-20，见 §8.3）**：`POST /api/ai/explain` 服务端持 Key（env `DEEPSEEK_API_KEY` 优先），非流式返回 JSON；自托管未配置 Key 时保留前端 Key 降级通道。
- **限流（已落地）**：每用户滑动窗口（`AI_RATE_LIMIT` 默认 10 次/分，内存 Map，多实例需外置）。
- **ai_cache 治理（已落地）**：全局共享 + 容量上限（`AI_CACHE_MAX` 默认 2000，写入后 LRU 淘汰）；前端 localStorage 缓存本就有 200 条 LRU。剩余可选：TTL 过期。

### 2.6 客户端存储上限（P2）

- `localStorage` 单键 5MB 天花板；图文课程含 base64 图片会很快撞墙。
- **推荐**：大对象（courses / 课程图片）迁 **IndexedDB**；设置、统计等小结构留 `localStorage`。
- **取舍**：IndexedDB 异步 API 更繁琐，但破 5MB 上限、支撑离线课程。

---

## 3. 目标架构（Target）

### 3.1 分层（更新自 v1）

```
UI 层        ESM 模块化的页面（practice / decks / stats / courses）+ iframe 隔离
领域层        Practice · Deck · SRS · Review · Explain · Identity · Sync（bounded contexts）
服务层        Express routers 按上下文拆分 + validation 中间件 + SyncService + AI Proxy
数据层        本地（localStorage + IndexedDB）+ 云端（SQLite → 可选 Postgres）
```

### 3.2 SyncService 设计（重点，替代整块 LWW）

```
 客户端                                  服务端
 ┌──────────┐   change-log(带 rev)    ┌──────────────────────┐
 │ 本地改动  │ ──── PUT /api/sync ───▶ │ upsert WHERE rev 冲突 │
 │ 标 rev    │                         │ 取 max(rev)，软删除    │
 └──────────┘ ◀── 合并后状态 ──────── │ 返回服务端权威 rev     │
       ▲          GET /api/sync(since) └──────────────────────┘
       │              拉取他人改动
   reconcile（按 rev 合并，不丢无关改动）
```

- 每个可同步实体带 `rev`（自增或时间戳）。
- 服务端 `ON CONFLICT DO UPDATE WHERE excluded.rev > rev` —— 旧版本写入被拒，新版本胜出。
- 删除用 `deleted_at` 软标记，跨设备传播。
- 离线时本地排 change-log 队列，恢复后批量同步。

### 3.3 部署拓扑

| 场景 | 拓扑 | 鉴权 |
|------|------|------|
| 本地 | 双击 / `node server` + 静态托管 | 开放模式（内网） |
| 自托管 | Nginx(前端+TLS) → Node+SQLite | REQUIRE_AUTH=true |
| 云 | Nginx → Node(多实例, 无状态) → Postgres；课程图片放对象存储 | REQUIRE_AUTH + 限流 |

> Node 服务无状态（状态全在 DB），可水平扩展；SQLite 单写者，多实例需换 Postgres 或加写入锁。

---

## 4. ADR 更新

| ADR | 标题 | 状态 | 变化 |
|-----|------|------|------|
| ADR-001 | 页面物理隔离（iframe + postMessage） | Accepted | 保留 |
| ADR-002 | 全局命名空间收敛为 `CL` 单例 | Accepted | 保留，前端继续收敛 |
| ADR-003 | SRS 调度纯函数 | Accepted | 保留 ✅ |
| ADR-004 | AI 调用走后端代理 | **Accepted（2026-08-20 落地：`server/ai.js` + `/api/ai/explain`，见 §8.3）** | 已落地 |
| **ADR-005** | **Sync 策略：实体级 rev upsert + 软删除** | **Proposed → Accepted（2026-08-20 落地，见 §8）** | 本文新增 |
| **ADR-006** | **鉴权默认与密钥管理（上云强制 REQUIRE_AUTH + env 密钥）** | Proposed | 本文新增 |
| **ADR-007** | **前端 ESM 模块化（无打包器）** | **Proposed → Accepted（2026-08-20 Step 1 落地：`js/chunk-engine.mjs`）** | 本文新增 |
| **ADR-008** | **服务端校验与冒烟测试** | **Proposed → Accepted（2026-08-20 校验中间件 + 冒烟测试全部落地）** | 本文新增 |

### ADR-005: Sync 策略 — 实体级 rev upsert + 软删除
- **Status**: Accepted（2026-08-20 落地，见 §8）
- **Context**: 当前整块 LWW + DELETE/INSERT 导致多设备静默丢数据、崩溃可清空用户数据。
- **Decision**: 每个可同步实体带 `rev`；服务端 upsert 按 `rev` 冲突检测取新版本；删除走软删除标记。
- **Consequences**: 多设备安全、崩溃局部可恢复；代价是 Schema 加版本字段 + 合并逻辑代码量。CRDT 留作 P3。
- **实现要点**: `rev` 列可空（旧数据 NULL），比较统一用 `COALESCE(rev,0)` 避免 NULL 比较失效；`revs` 返回须含软删行，否则其他设备无法判断本地副本是否过期；旧客户端（无 revs）退化为「总是覆盖」保兼容。

### ADR-006: 鉴权默认与密钥管理
- **Status**: Proposed
- **Context**: 开放模式默认共享单用户 + 硬编码 JWT 密钥，公网即裸奔。
- **Decision**: 公网部署强制 `REQUIRE_AUTH=true` + 环境变量注入 `JWT_SECRET` + HTTPS；隔离网络可保留开放模式；引入匿名一次性账号折中。
- **Consequences**: 数据安全达标；牺牲少量零摩擦（匿名账号缓解）。

### ADR-007: 前端 ESM 模块化
- **Status**: Accepted（2026-08-20 Step 1 落地，见 §8.2）
- **Context**: `main.html` 4781 行单体，熵增回潮。
- **Decision**: 用原生 `<script type="module">` 拆分，不引入打包器；保留 iframe 隔离。
- **Consequences**: 模块清晰、可单测；代价是需 http(s) 服务（file:// 不支持 module import）——后端已托管前端，可接受。
- **实现要点**: 内联脚本是普通 script（onclick 依赖全局函数，不能直接转 module），用 `js/bridge.mjs` 把 ESM 模块挂 `window` 供包装器调用；module 是 defer 的，但业务调用都在交互/异步初始化（`CL.ensureCloud().then`）之后，无时序风险。`.mjs` 扩展名让 Node 原生 ESM 单测与浏览器双兼容（勿改根 package.json 的 type，会破坏既有 CJS 测试）。

### ADR-008: 服务端校验与冒烟测试
- **Status**: Accepted（2026-08-20 校验中间件 + 冒烟测试全部落地）
- **Context**: `PUT /api/data` 接受任意结构，后端无测试。
- **Decision**: 加轻量 schema 校验中间件 + 零依赖 Node 冒烟测试脚本。
- **Consequences**: 坏数据/回归有防护；少量代码成本。
- **实现要点**: `server/validate.js` 零依赖校验（浅层类型检查防崩溃，不深绑以免误伤旧客户端）；`PUT /api/data` / `POST /api/courses` / `POST /api/import` 坏数据返回 400；`auth.js` 补类型 + 长度上限（用户名 ≤32、密码 ≤128——bcrypt 只取前 72 字节，超长静默截断是隐患）。

---

## 5. 长期演进路线图

| 阶段 | 目标 | 关键动作 | 退出条件 |
|------|------|----------|----------|
| **Phase A 加固**（2-3 周） | 止血 | ADR-006 上云检查清单 + env 模板；ADR-008 服务端校验 + 冒烟测试；ai_cache 上限；README 对齐真实架构 | 公网部署不再裸奔；后端有回归测试 |
| **Phase B 同步正确性**（3-4 周） | 多设备安全 | ADR-005 实体级 rev sync；软删除；离线 change-log 队列；冲突合并 | 双设备互改不丢数据；崩溃可恢复 |
| **Phase C AI 与离线**（3-4 周） | 能力扩展 | ~~ADR-004 后端 AI 代理~~（**已提前落地**）；IndexedDB 存课程；PWA 离线；ai_cache TTL | Key 不外泄（已达成）；大课程可离线 |
| **Phase D 平台化**（按需） | 规模化 | 多租户加固；Postgres 选项；公共题库市场 `GET /api/deck/public`；学习分析 | 出现真实多用户/多设备需求 |

---

## 6. 风险登记（更新）

| 风险 | 概率 | 影响 | 缓解 | 阶段 |
|------|------|------|------|------|
| 多设备同步丢数据 | 高（已有） | 高 | ADR-005 实体级 rev（**已完整落地**：decks/kv/courses/courseProgress 全部 per-entity） | B |
| 开放模式数据裸奔 | 中 | 高 | ADR-006 + 网络收口 | A |
| 前端单体熵增 | 高（已有） | 中 | ADR-007 ESM 拆分 | A/B |
| 后端坏数据/无回归 | 中 | 中 | ADR-008 校验+测试（**已落地**：validate.js 中间件 + smoke 40/40） | A |
| AI Key 资损 | 中 | 中 | ADR-004 代理+限流（**已落地**：Key 服务端化，前端不再直连） | C |
| ai_cache 无限膨胀 | 中 | 低 | 容量上限+LRU（**已落地**：AI_CACHE_MAX 默认 2000，导入后 LRU 裁剪） | A |
| localStorage 5MB 撞顶 | 中 | 中 | IndexedDB | C |
| SQLite 单写者瓶颈 | 低 | 中 | 多实例换 Postgres | D |

---

## 7. 立即可做的下一步（Next 5 actions）

1. **上云安全检查清单 + `.env.example`**：`REQUIRE_AUTH=true`、`JWT_SECRET`、`CORS_ORIGINS`、`PORT` 模板，并在 README 标明"开放模式仅限内网"。
2. **后端冒烟测试脚本** `server/smoke.test.js`：启动 → `/health` → register/login → put/get 往返。
3. **`saveData` 改实体级 upsert**：先给 `user_decks/user_kv` 等加 `rev` 列，再改写入逻辑（ADR-005 起步）。
4. **`main.html` ESM 拆分 spike**：抽 `practice 引擎` 为独立 module，验证 file:// 限制与后端托管方案。
5. **README 重写对齐**：当前 README 仍写"纯前端无后端"，必须更新以免误导部署。

---

## 8. 落地进度（2026-08-20）

Phase A 中的低风险快速止血项已落地（纯新增文件，未改现有逻辑）：
- ✅ **Next 1 上云安全清单**：`server/.env.example` + 零依赖 `server/loadenv.js`（`.env` 已被 server/.gitignore 忽略）
- ✅ **Next 2 后端冒烟测试**：`server/smoke.test.js`，10/10 通过（多用户模式 + 临时 DB 端到端验证）
- ✅ **Next 5 README 重写**：已对齐真实架构（去掉"纯前端无后端"过时描述，补后端/双模式/安全部署清单/测试）
- ✅ 既有前端单测 `srs.test.js` / `store.test.js` 无回归
- ✅ **Phase A 剩余项（2026-08-20 落地）**：ai_cache 容量上限（`AI_CACHE_MAX`，服务端 import 后 LRU 裁剪；前端 localStorage 缓存本就有 `AI_CACHE_MAX=200` LRU）+ 服务端 schema 校验（`server/validate.js`，坏数据 400）+ `auth.js` 输入类型/长度上限。Phase A 代码面全部完成。
- ✅ **Next 3 `saveData` 改实体级 rev upsert**（ADR-005，2026-08-20 落地，见下；**step 2 已含 courses/courseProgress**）
- ✅ **Next 4 `main.html` ESM 拆分 Step 1**（ADR-007，2026-08-20 落地，见 §8.2；剩余模块为后续步骤）

### §8.1 Next 3 实现笔记（ADR-005 实体级 rev sync，2026-08-20）

**后端**
- `server/db.js`：`user_decks` / `user_kv` 新增 `rev`(INTEGER, 可空) + `deleted_at`(TEXT) + 旧库 `ALTER TABLE` 迁移；`user_kv` 补 `updated_at` 列（建表与迁移两处）。
- `server/index.js`：
  - `buildMem` 只返回 `deleted_at IS NULL` 的实体，但 `revs` 单独查全表（**含软删行**，其他设备才能判断本地副本已过期）；
  - `saveData` 改为 per-entity `upsertDeck`/`upsertKv`（`ON CONFLICT ... DO UPDATE ... WHERE excluded.rev IS NULL OR excluded.rev > COALESCE(<table>.rev,0)`）+ `deleted.decks/kv` 软删除；不再整块 DELETE decks/kv，崩溃可恢复、多设备互不覆盖；
  - **step 2 已落地**：新增 `upsertCourse`/`upsertCourseProgress` per-entity rev upsert + 软删除（`deleted.courses`/`deleted.courseProgress`）；`POST /api/courses` 走 upsert（无 rev=总是覆盖），`DELETE /api/courses/:id` 改软删（rev+1，跨设备传播）；至此 decks/kv/courses/courseProgress 全部 per-entity，不再有任何整块 DELETE 写入。
- **兼容性**：旧客户端（无 `revs`/`deleted`）退化为「总是覆盖」；旧数据 rev=NULL 用 COALESCE 兜底。

**前端 `core.js`**（调用方零改动）
- `saveMem` 内做快照 diff（`maintainRevs`）：变更实体 rev+1、删除实体标软删并升 rev、未变实体 rev 不动；
- **step 2**：courses/courseProgress 不经 saveMem（由 library.js/course-package.js 直写 localStorage），故在 `cloudSyncNow` 上行前做**惰性 diff**（`maintainCoursesRevs`：与上次上行快照比较，变更升 rev、消失登记软删、首次上行初始化 rev=1）；
- `cloudSyncNow` 上行 payload 携带 `revs` + `deleted`（decks/kv/courses/courseProgress 四类）；`syncFromCloud` 按 rev per-entity LWW 合并 + 软删传播（四类）；
- **修复潜在 bug**：合并采纳远程实体时同步写回本地 revs——此前不写回，新设备首拉后本地 rev=0/1，第一次本地修改会被服务端按旧 rev 拒绝（需连改 N 次才追上）。

**测试与验证**
- `server/smoke.test.js` 扩展至 **30/30 通过**：多设备互写不丢、软删跨设备传播（revs 含软删）、旧 rev 拒绝、旧客户端兼容、kv/courses/progress per-entity 新旧版本、DELETE /api/courses/:id 软删语义；
- `rev.test.js` 扩展至 **18/18**：courses/progress 惰性 diff 新增/修改/删除/未变不 bump、合并采纳远程 rev 且后续上行不误 bump；
- 回归：`srs.test.js` / `store.test.js` / `course-resume.test.js` / `validate_oral8000.js` 无回归。
- 过程中修复真实 bug：① `user_kv` 缺 `updated_at` 列导致 upsertKv 全 500（Schema 与 SQL 不一致）；② revs 排除软删行导致删后版本号丢失；③ 合并未写回本地 revs 导致首拉后本地修改被拒（step 2 顺带修复）。

### §8.2 Next 4 实现笔记（ADR-007 ESM 模块化 Step 1，2026-08-20）

**动机**：`main.html` 4781 行单体（1 个 3675 行内联脚本），核心练习逻辑（chunk 判定/干扰项/词性 pattern）此前零单测。

**Step 1 已落地（纯逻辑抽取，零行为变化）**
- `js/chunk-engine.mjs`（ESM 纯函数）：`classifyWord` / `patternOf` / `normPattern` / `norm` / `buildChoices` / `buildDistractors` / `judgeChunk`。原 `buildChoices`/`buildDistractors` 依赖全局 `S.items` 与 `allDecks()`，已参数化（`currentItems`/`allItems` 注入），纯函数可单测。
- `js/bridge.mjs`：`import * as ChunkEngine from './chunk-engine.mjs'; window.ChunkEngine = ChunkEngine;`——内联脚本是普通 script（onclick 依赖全局函数），不能直接转 module，故桥接。
- `main.html`：内联的 1681-1801 整段（SMALL_WORDS/classifyWord/patternOf/normPattern/buildChoices/buildDistractors）替换为 3 个包装器（`allItems()` + `buildChoices`/`buildDistractors` 调 `window.ChunkEngine`）；`submitChunk` 判定改调 `judgeChunk`。内联脚本 3675 → 3566 行。
- `js/chunk-engine.test.mjs`：**31/31**（词性分类/pattern/归一化/候选去重与同模式优先/池子不足降级/判定与 alternatives）。

**关键决策与坑**
- `.mjs` 扩展名：Node 原生 ESM 单测 + 浏览器 `<script type="module">` 双兼容；**不能**加根 `package.json {"type":"module"}`（会把既有 CJS 测试 `srs.test.js` 等当 ESM 破坏）。
- module 脚本默认 defer（在普通内联脚本后执行），但所有业务调用都在用户交互 / `CL.ensureCloud().then` 异步初始化里，无时序风险；实测启动流程确在 `.then` 内。
- Express 静态服务对 `.mjs` 返回 `application/javascript` ✓（mime-types 已识别）。

**验证**：单测全绿（chunk-engine 31、rev 18、srs/store/course-resume/validate、server smoke 30）；内联脚本语法检查 OK；起 server 冒烟：`/main.html`、`/js/chunk-engine.mjs`、`/js/bridge.mjs` 均 200，`.mjs` MIME 正确。

**后续 Step（增量，每次单测锁定）**：Step 2 `js/format.mjs`（esc/norm/wordCount/normSent/timeAgo/copyText）→ Step 3 `js/ai-prompts.mjs`（buildExplainPrompt/buildBatchExplainPrompt/buildPrompt/buildSplitPrompt/buildAppendPrompt）→ Step 4 存储/备份纯逻辑（exportReinforce/exportDeck/exportAllData/importAllData 解析部分）→ 最后 DOM/流程层留在 main.html 编排。

### §8.3 ADR-004 实现笔记（AI 后端代理，2026-08-20）

**背景**：API Key 明文存 localStorage、前端 XHR 直连 `api.deepseek.com`——资损风险。前端链路：`openAIExplain` → `callDeepseekAPI`（本地 ai_cache 命中跳过 + XHR 直连 + 失败兜底本地 `buildAIExplain`）。

**后端**
- `server/ai.js`：DeepSeek 代理（https + 25s 超时；`AI_MOCK_RESPONSE` 测试钩子短路真实调用）、服务端归一化 `norm`（与前端规则一致，用于缓存 key）、每用户滑动窗口限流（`AI_RATE_LIMIT` 默认 10 次/分，内存 Map，多实例需外置）。
- `POST /api/ai/explain`（authenticate）：校验 sentence（必填、≤2000）→ **服务端 ai_cache 命中直接返回（不占限流、不发模型请求）** → 限流 429 → Key 解析（env `DEEPSEEK_API_KEY` 优先，自托管允许 body.apiKey 降级）→ 调模型 → 解析 JSON → 写缓存 + LRU 收敛 → `{ok, cached, data}`。

**前端（main.html，调用方零改动）**
- `callDeepseekAPI` 改 POST `/api/ai/explain`（ChunkAPI base + JWT；保留本地缓存双保险）；apiKey 仅用户手动填时随请求传（服务端配置了 Key 时被忽略）。
- `openAIExplain` 统一走代理，失败/401 自动兜底本地解读；`refreshAIBtn` 不再依赖前端 Key（始终可用）。

**测试**：smoke.test.js **46/46**（+6：缺 sentence 400、预置缓存命中 cached:true、mock 完整链路 cached:false→写缓存→二次命中、超限 429）；前端单测全过。

**遗留**：非流式（SSE 后续可选）；限流为单实例内存态（多实例需 Redis）。

_附：v1（2026-08-07）规划中的 P1 模块化、P2 后端化已部分落地（后端存在、SRS 纯函数、存储版本化），但"前端模块化"与"Sync 正确性"仍是缺口，本文即针对此缺口给出设计。_
