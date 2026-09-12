# Chunk Lab 架构评估与演进规划

> 当前状态核实：2026-09-12。§0、§1.1、§9～§12 为当前执行依据；§1.2～§8 保留历史分析与决策，不能把其中“现状”直接当作今天的代码状态。§10～§12 更新了 §9 的后续事项。

---

## 0. 执行摘要（TL;DR）

**总体方向**：保留原生前端 + Express/SQLite，按内容、学习记录、同步三个边界渐进收敛，不为 8000 句引入微服务或全量框架重写。

**已实现**：内容 manifest、详情/轻量索引分片、按批练习与独立内容 IDB 缓存；学习档案/事件 IDB 分层；服务端事务内实体 UPSERT、软删除、行级增量接口；生产环境鉴权约束、服务端校验与自动测试。前端仍保留较大的页面编排层，模块化并未全部完成。

**当前优先级**（不是历史问题清单）：

| 级别 | 问题 | 影响 |
|------|------|------|
| P0 | 完整同步冲突协议与持久待发队列 | 代码侧已接入条件批次、持久请求、冲突比较/解决、恢复保护和发布重试；仍需真实生产实例完成配置与演练 |
| P1 | 多页面/多存储写入一致性 | 关键业务写入已有 generation、IDB 持久化和多标签页护栏；跨存储完全统一事务仍是架构取舍，不作为首发新增范围 |
| P1 | 移除大库隐式全量加载与全量渲染 | 内容分片、按批详情、统计分页和有界写队列已实现；8000 句专项模拟通过，真实移动设备仍待验收 |
| P1 | 8000 句内容及性能验收 | 当前架构支持 8000 句规模，已完成 8000 条模拟和慢写入回归；完整内容生产及真机验收延期 |
| P2 | 提取页面服务边界、同步下行接入 | 当前页面仍有集中编排，但已评审为非首发阻断项；不因架构洁癖继续扩大改造 |

---

## 1. 现状评估（代码核实，非文档）

### 1.1 已验证事实

| 维度 | 核实结论 | 证据位置 |
|------|----------|----------|
| 同步实现 | 事务内 UPSERT + rev + 软删除；同/旧 rev 不同值返回 409 并整批回滚；相同值重试可确认成功 | `server/index.js`, `server/sync-conflict.js` |
| 鉴权默认 | 本地开放模式仍存在；生产禁止开放模式，多用户模式拒绝缺失/占位/过短 JWT 密钥 | `server/auth.js`, `server/index.js` |
| 前端形态 | 已提取练习引擎、格式化、备份与内容仓库；页面状态编排仍较集中 | `js/`, `main.html`, `core.js` |
| 存储 | 课程/进度与学习大对象使用 IDB；内容缓存独立；小配置仍在 localStorage；后端学习行表与内容实体分离 | `js/idb.js`, `core.js`, `server/db.js` |
| 测试 | 前后端单测、内容校验、部署护栏和独立浏览器回归均存在 | `package.json`, `e2e/` |
| 版本管理 | 已有 Git 仓库；本轮基线 `4208ebd` | Git 历史 |
| AI | 后端代理与缓存容量/TTL 已实现；AI 详解默认停用；并非“无限缓存+必须前端直连”的旧状态 | `server/ai.js`, `server/index.js` |

### 1.2 领域边界（沿用 v1 划分，补两个上下文）

| 上下文 | 聚合根 | 关键不变量 | 当前实现位置 |
|--------|--------|-----------|-------------|
| **Practice** | Session | 每句状态机 pending→ok/bad/revealed；chunk 拼接=原句 | `main.html`（需抽离） |
| **Deck** | Deck | 句子去重；chunks 拼接=原句 | `library.js` / `builtins.js` |
| **SRS** | SentenceCard | interval 1→3→7→14→30→60→120→180→365；答错重置 | `srs.js`（纯函数，✅ 已隔离） |
| **Review** | DueQueue | 到期队列、错题本 | `main.html` / `core.js` |
| **Explain** | Explanation | 维度 grammar/syntax/collocation/pattern/oral/words | 前端直连（⚠ 待代理） |
| **Identity** | User | 密码哈希、JWT | `server/auth.js`（✅ 已有） |
| **Sync** ⭐新增 | ChangeSet | **实体级版本、冲突可处理、崩溃可恢复** | `js/batch-sync.js` / `server/sync-resolution.js`（✅ 代码侧已接入） |

> ⭐ 上述“Sync 缺失/整块 LWW”是历史评估结论。当前代码已完成首发所需的条件批次、持久待发请求、冲突处理和恢复保护；仍保留的取舍是首发不做智能自动合并。

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

**状态更新（2026-09-08，见 §8.8）**：ADR-007 四模块抽净后，剩余编排层经域聚类量化勘探，**决策维持单体**（40% 状态编排 + 60% DOM/流程胶水，拆分 ROI 为负）；本 P1 从「待办债」降为「已评审决策」。残余熵在事件绑定区与全局 var，属重构对象而非拆分对象。

### 2.4 后端健壮性（P1）

- **服务端校验**：`PUT /api/data` 当前接受任意 `mem` 结构，应做轻量 schema 校验（防止坏数据入库/前端崩溃）。
- **后端冒烟测试**：脚本启动服务 → `/health` → register/login → put/get 往返 → assert 一致。零依赖、Node 直跑。
- **结构化错误日志**：当前 only `console.error`。

### 2.5 AI 与缓存（P2，对应 ADR-004）

- **后端代理（已落地 2026-08-20，见 §8.3）**：`POST /api/ai/explain` 服务端持 Key（env `DEEPSEEK_API_KEY` 优先），非流式返回 JSON；自托管未配置 Key 时保留前端 Key 降级通道。
- **限流（已落地）**：每用户滑动窗口（`AI_RATE_LIMIT` 默认 10 次/分，内存 Map，多实例需外置）。
- **ai_cache 治理（已落地）**：全局共享 + 容量上限（`AI_CACHE_MAX` 默认 2000，写入后 LRU 淘汰）；前端 localStorage 缓存本就有 200 条 LRU。剩余可选：TTL 过期。

### 2.6 客户端存储上限（P2 · 已落地 2026-08-20，见 §8.4）

- `localStorage` 单键 5MB 天花板；图文课程含 base64 图片会很快撞墙。
- **已落地**：courses / courseProgress 迁 **IndexedDB**（内存桥 + 启动迁移，删除 localStorage 大键释放配额）；设置、统计、revs 等小结构留 `localStorage`。
- **取舍**：IndexedDB 异步 API 通过内存缓存桥保持同步 API 形态，调用方零改动；离线能力不变。

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
| **ADR-007** | **前端 ESM 模块化（无打包器）** | **Accepted（2026-08-20 全部落地：chunk-engine / format / ai-prompts / backup 四模块）** | 已落地 |
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

### ADR-009: 下行增量同步 —— 行级单调 seq
- **Status**: Accepted（2026-09-10 服务端落地；客户端接入待下一轮）
- **Context**: `GET /api/data` 一直是全量组装：8000 句实测 7191KB（brotli 后 648KB），
  且服务端 `buildMem` 要 **206ms 同步阻塞**（拆表后逐行取值 + parse 的开销与数据量无关，
  是固定成本；压缩发生在组装之后，救不了组装）。客户端每次开页/刷新都重拉一遍。
- **Decision**: 给每张用户数据表加**单调变更序号 `seq`**，支持 `GET /api/data?since=N`
  只回「该用户 seq 大于 N 的变更」；每用户一个计数器 `user_change_seq`，
  **一次写入请求共用一个 seq**。
- **为什么不建独立变更日志表**: 日志表要额外解决去重、压实、以及「水位低于压实线就得
  全量重来」的判定；把 seq 直接打在行上则没有增长问题，且「某用户 seq>N 的行」天然
  就是变更集。代价是每条 upsert 多写一个字段，用「整批共用一个 seq」抵消。
- **为什么不能用 `updated_at`**: 它是 TEXT 秒精度，同一秒内多次写入会撞在一起 —— 客户端
  把水位推到该秒之后就永远拉不到那一秒里的其他变更。
- **Consequences**:
  - 下行从「全量 7191KB」降到「只回变更行」；组装只读变更行，206ms 阻塞随之消失。
  - **协议要求水位必须与数据同层存储**：清数据就得清水位。否则「数据被清、水位残留」会让
    客户端永远只拉增量、静默少数据（这是本设计最危险的一条）。
  - **增量响应里必须显式给出删除清单**（`deleted.*` / `entityGone`）：增量的 `mem` 只含
    变更项，客户端若沿用全量下的「远端没给 = 已删」存在性推断，会把**未变更**当成**已删除**，
    整批删掉用户数据。
  - 增量是**纯 opt-in**（只有显式传 `since` 才走），默认路径逐字节不变 → 灰度/回滚都无需协调。
- **实现要点**: `seq` 写在 `DO UPDATE ... SET` 里而非外层 `VALUES` —— rev 守卫拒绝更新时
  seq 不得推进，否则客户端会「收到一个其实没落库的变更」水位。
  回填存量行必须与计数器初始化**配套**（都设为 1），只做一半会让新分配的序号与回填值撞号。

#### 客户端接入的关键耦合（2026-09-10 探索发现，客户端暂缓的根因）

客户端接入增量下行时暴露一个**深层耦合**，必须与上行水位一起设计，否则净亏损：

- 上行水位 `_cloudBsSig`（档案签名集）/`_cloudEvIds`（事件 id 集）是**内存变量**，刷新后置 null。
  现有**全量下行**靠 `_cloudBsSig = remoteBsSig`（远端全量）重建水位，所以刷新后第一次上行仍是增量。
- **增量下行只给「变更子集」，无法重建完整水位** → 刷新后上行退化为全量：
  下行省 640KB（brotli），上行却多花 ~1058KB（gzip，浏览器只能 gzip 压，5.9×）→ **净亏损**。
- 根因：`_cloudEvIds` 的事件 id 是随机字符串（非时间序），无法用「前缀锚点」紧凑持久化，
  只能存完整集合（8000 句 ≈ 24000 事件 ≈ 400KB）。
- **正确方案**：上行水位（`_cloudBsSig`/`_cloudEvIds`/三个实体水位）**持久化到 IDB meta**（无 5MB 配额压力），
  刷新后恢复、增量下行后累积 union，上行才保持精确增量。代价是每次上行成功写 ~640KB IDB（异步，可控）。
- 另两点已探明的实现要点：
  - stats 增量合并**不能复用 mergeStats**（它是「反推基线」重建式，假设两侧 events 完整；
    增量 events 子集 + 完整 totalAnswered 会把总数算重，如 5 算成 8）。需独立 `mergeStatsDelta`：
    events 按 id 去重并集、totalAnswered=本地完整+增量独有、bySentence 远端覆盖但「本地 lastAt 更晚」保留。
  - 增量下 decks/kv/courses/progress 的**软删传播必须读显式 `deleted.*` 清单**，不能用「revs 有但 mem 无」的存在性推断。

---

## 5. 长期演进路线图

| 阶段 | 目标 | 关键动作 | 退出条件 |
|------|------|----------|----------|
| **Phase A 加固**（2-3 周） | 止血 | ADR-006 上云检查清单 + env 模板；ADR-008 服务端校验 + 冒烟测试；ai_cache 上限；README 对齐真实架构 | 公网部署不再裸奔；后端有回归测试 |
| **Phase B 同步正确性**（3-4 周） | 多设备安全 | ADR-005 实体级 rev sync；软删除；离线 change-log 队列；冲突合并 | 双设备互改不丢数据；崩溃可恢复 |
| **Phase C AI 与离线**（3-4 周） | 能力扩展 | ~~ADR-004 后端 AI 代理~~（**已提前落地**）；~~IndexedDB 存课程~~（**已落地**）；~~PWA 离线~~（**已落地 2026-08-21**）；~~ai_cache TTL~~（**已落地 2026-08-21**：AI_CACHE_TTL 命中过期判定 + 懒清理）；~~离线 change-log~~（**已落地 2026-08-21**：轻量版 = dirty 标志 + 重连补传 + 顶栏徽标）；~~移动端适配~~（**已落地 2026-08-21**） | Key 不外泄（已达成）；大课程可离线 |
| **Phase D 平台化**（按需） | 规模化 | 多租户加固；Postgres 选项；~~公共题库市场 `GET /api/deck/public`~~（**已落地 2026-08-21**：内置 + 用户发布 + 跨题库导入 + smoke 8 用例 + 浏览器验收）；学习分析 | 出现真实多用户/多设备需求 |

---

## 6. 风险登记（更新）

| 风险 | 概率 | 影响 | 缓解 | 阶段 |
|------|------|------|------|------|
| 多设备同步丢数据 | 高（已有） | 高 | ADR-005 实体级 rev（**已完整落地**：decks/kv/courses/courseProgress 全部 per-entity） | B |
| 开放模式数据裸奔 | 中 | 高 | ADR-006 + 网络收口 | A |
| 前端单体熵增 | 高（已有） | 中 | ADR-007 已抽净纯逻辑（全可单测）；剩余编排层 2026-09-08 勘探决策维持单体（§8.8），降 P3 监测 | A/B |
| 后端坏数据/无回归 | 中 | 中 | ADR-008 校验+测试（**已落地**：validate.js 中间件 + smoke 40/40） | A |
| AI Key 资损 | 中 | 中 | ADR-004 代理+限流（**已落地**：Key 服务端化，前端不再直连） | C |
| ai_cache 无限膨胀 | 中 | 低 | 容量上限+LRU（**已落地**：AI_CACHE_MAX 默认 2000，导入后 LRU 裁剪） | A |
| localStorage 5MB 撞顶 | 中 | 中 | IndexedDB（**已落地**：courses/progress 迁 IDB，见 §8.4） | C |
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

**后续 Step（增量，每次单测锁定）**：~~Step 2 `js/format.mjs`~~（**已落地**）→ ~~Step 3 `js/ai-prompts.mjs`~~（**已落地**：5 个 prompt + extractJSON 并入）→ ~~Step 4 `js/backup.mjs`~~（**已落地 2026-08-20**：buildReinforceJson/Txt、buildExportPayload、parseExport + `window.BackupTools` 桥接 + backup.test.mjs 24/24）。**ADR-007 计划全部完成**：main.html 4781 → 4444 行，核心纯逻辑全部模块化并单测锁定；剩余 DOM/流程层留在 main.html 编排（合理终点）。

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

### §8.4 IndexedDB 迁移实现笔记（2026-08-20，Phase C 存储项）

**背景**：localStorage 单键 5MB 撞顶；图文课程（含 base64 图片）是最现实的上线阻塞项。云端已是权威存储（ADR-005），localStorage 仅离线缓存，但撞顶仍会导致课程缓存写失败。

**方案：内存桥 + IndexedDB 主存储（调用方零改动）**
- `js/idb.js`（window.IDBStore）：db `chunklab-idb` v1，stores `courses`(keyPath courseId) / `progress`(keyPath cid)；`loadAll`（全量载入）/ `putCourses` / `putProgress`（clear+批量，单事务）。
- `core.js`：
  - `_coursesCache` / `_progressCache` 内存缓存；`readCoursesRaw`/`readProgressRaw` **内存优先**（null = 未预载，兜底读 localStorage 旧值，保持同步 API 形态）。
  - `CL.preload()`：启动时 IDB → 内存；IDB 空则从 localStorage **迁移**（首次），随后 `removeItem` 删除大键**释放配额**；幂等（main + iframe 子页同源共享 IDB，并发迁移安全）。
  - `CL.writeCourses`/`writeProgress`（内存 + 异步 IDB + 触发云同步，不再写 localStorage）；`CL.readCourses`/`readProgress`（读内存）。
  - `ensureCloud` 前置 `preload`；`syncFromCloud` 合并写回改内存 + IDB。
- 消费方改造（全部走 CL 接口，回退分支仅兼容 CL 不可用）：`library.js` readCourses/writeCourses；`course-package.js` storedCourses/persistCourses/storedProgress/persistProgress/progressFor/saveProgress + **boot 前先 `CL.preload()`**（iframe 子页独立 CL 实例）；`main.html` readAllCourses/writeAllCourses/readAllCourseProgress/writeAllCourseProgress。
- 4 个页面（main/courses/decks/stats）在 core.js 前引入 `js/idb.js`。

**关键决策与坑**
- 内存缓存桥把 IndexedDB 的异步 API 转成同步读取形态，避免波及大量同步调用方；写入仍异步（内存即时 + IDB 后台），UI 无感知。
- 测试环境无 IndexedDB：`preload` 以 `if(!global.IDBStore)` 守卫；rev.test.js 用 mock IDBStore 验证迁移（冷启动重载 core.js 获得干净实例）。
- 无 IDB 的旧浏览器：preload 失败 → 不删 localStorage 键，回退原路径。

**验证**：rev.test.js 20/20（+2：preload 迁移删键、合并后 progress 采纳）；chunk-engine/srs/store/course-resume/validate 无回归；server smoke 46/46；4 页面 + js/idb.js 静态 200。

**遗留**：aiCache 仍留 localStorage（200 条 LRU 已控容量）；PWA 离线未做。

### §8.5 PWA 离线 + 移动端适配（2026-08-21）

**PWA（与 IndexedDB 形成完整离线闭环）**
- `manifest.json`：name/short_name/display=standalone/theme_color=#2c62c9/start_url=/main.html（避免改 server 配 / 路由）+ 192/512 icon（purpose any maskable）。
- `sw.js`：版本化 cache `chunklab-v2`，预缓存 22 个核心资源（main.html + 6 外部 JS + chunk-practice/courses/decks/stats + 5 个 .mjs + manifest + 2 图标）；策略：静态资源 cache-first / `/api/*` network-only（不缓存用户数据）/ 导航 miss 回退 `/main.html`；activate 清理旧版本 + skipWaiting/clients.claim。
- `main.html`：引 manifest + icon-512（apple-touch-icon）+ theme-color，SW 注册（`navigator.serviceWorker.register` + `reg.update`）；viewport 补 `viewport-fit=cover`（iPhone 安全区）。
- 图标：PIL 生成 512/192 PNG（品牌蓝 #2c62c9 圆角底 + 白色 CL + 三行意群条，可读性 + 离线启动体验）。
- **开发注意**：SW 缓存会"冻结"旧文件，改代码后需 DevTools → Application → Service Workers → Update / Unregister；或临时改 CACHE 版本号强制刷新。

**移动端适配（只追加 @media 不修改现有，避免破坏桌面端）**
- 640px 块扩展：弹窗贴边（`.mask{padding:8px}` + `.modal` 去 max-width/圆角收窄）、chunk-input/choice 字号收缩、顶栏次要元素隐藏（`.topbar-reveal,.topbar-status-text`）、iframe 顶栏说明隐藏、AI body 字号 14.5px。
- 新增 ≤420px 极窄屏块：弹窗边到边（`.mask{padding:0}` + `.modal` 100vw/100vh + border-radius:0 + 满屏）、按钮加大触区（`.choice` min-height 40px、`.btn` padding 8/12）、chunk-input 16px、zh-wrap 宽度收窄至 calc(100% - 120px)、圆环/标熟按钮略缩（28px）、顶栏 gap 4px。

**验证**：内联语法 OK；全量单测 + server smoke 46/46 无回归；PWA + 子页资源全 200，sw.js/manifest.json MIME 正确（application/javascript / application/json）。

### §8.6 ai_cache TTL + 离线 change-log（2026-08-21）

**ai_cache TTL**
- 服务端 `AI_CACHE_TTL`（env 默认 30 天，0=永不过期）：命中时 `updated_at >= datetime('now','-N days')` 判定过期 → 视为 miss 重新生成；`trimAiCache` 写入路径顺带懒清理全表过期条目（无定时器）。
- 前端 localStorage ai_cache：`aiCacheGet` 检查 `at` 超过 30 天即清除（对齐服务端）。
- smoke 49/49（+3：TTL 内命中、直改 DB 造过期 → cached:false、重新生成后再次命中）。

**离线 change-log 队列（轻量版；架构决策：不做重放式）**
- **论证**：per-entity rev 已保证合并正确性，重放日志无增益；真实缺口是"离线变更后重连不触发新变更就不补传"+"无待同步可见性"。
- **顺带修复根因级 bug**：`main.html` `saveStore`（25 处调用）此前只裸 `CL.saveMem`——mem 变更（练习/统计/设置）从不上传云端（子页面 decks/stats 用 `CL.saveAndNotify` 正确）。已修：saveStore 补 `CL.scheduleCloudSync(mem)`。
- core.js：`_dirty`（scheduleCloudSync 置位 / cloudSyncNow 成功清位）；`syncFromCloud` 拉取成功后若 dirty 立即补传 push（重连自动补传）；`CL.isDirty()` + `syncStatus` 事件。
- main.html：顶栏"⏳ 未同步"徽标（监听 syncStatus + 初始化检查）。
- rev.test.js 27/27（+2：dirty 生命周期 + syncStatus 事件、重连拉取后自动补传）。

_附：v1（2026-08-07）规划中的 P1 模块化、P2 后端化已部分落地（后端存在、SRS 纯函数、存储版本化），但"前端模块化"与"Sync 正确性"仍是缺口，本文即针对此缺口给出设计。_

### §8.7 句子内容 ID 化（cid）+ 题库数据文件解耦（2026-09-06）

**背景**：句子级学习档案 key 原为 `deckId#原文`——内容修订（typo/标点/大小写）= key 变 = 已掌握/统计/删除标记静默孤儿化；且 oral-8000"空壳+注入"依赖加载顺序，stats.html 漏引导致该 deck 恒空。

**cid（内容 ID）机制**
- 每句分配稳定 `cid = fnv8(sentence)`（8 位 hex，`Math.imul` 实现，与 python 精确 32 位结果一致——普通 `h*0x01000193` 双精度溢出 2^53 会丢精度，曾致数据文件 cid 与运行时计算不一致）。
- key 统一 `deckId#cid`（`CL.cidOf/cidKey/itemKey/masteredKey`，core.js）；`loadMem` 自动把旧 `deckId#原文` 档案迁移到 cid key（bySentence/mastered/deletedItems/events）+ 回写 + rev bump。
- 内置 389 句 cid 已注入（`scripts/add-cids.js` 幂等，`--force` 全量重算）；编辑导入句首改时固化 cid=fnv8(原文本)，此后文本修订不丢进度。
- 校验：`validate_builtins.js` / `validate_oral8000.js` 增 cid=fnv8(sentence) 规则，纳入 npm test。

**题库数据文件解耦（P0，修 stats 空 deck bug 根因）**
- builtins.js 删 `builtin-oral-8000` 空壳与注入 IIFE → oral8000.js 文件尾自注册完整 deck（id/name/desc/items）。
- 加载顺序统一 `builtins.js → oral8000.js`（main/decks/stats），stats.html 补引；加载缺 BUILTIN 显式 console.error（不再静默空 deck）。
- allDecks 组装（内置 deletedItems 过滤 + concat mem.decks）从 main/stats/decks 三处复制 → `CL.allDecksView/builtinDecks` 单一实现。

**best 纪录残壳 bug（decks 列表显示"最佳 undefined%"）**
- 根因：startDeck/importDeck 建 `{lastPlayed}` 残壳 → 渲染 `b.acc` undefined；且 finishSession `acc > b.acc` = acc>undefined 恒 false，残壳永久阻塞纪录写入；finish 覆盖写入又丢 lastPlayed。
- 修复：`touchDeckBest/saveDeckBest` 统一四字段形 `{acc,perfect,combo,lastPlayed}`（读归一、写保留 lastPlayed）；渲染仅 `acc>0`（真实纪录）时显示"最佳 X% / 连击 Y"。

**startDeck 到期复习失效**
- 根因：isDue/isFluency 单参（依赖隐式 S.deck），startDeck 却传两参 `isDue(deck.id,it)` → it=deck.id 字符串 → key 查空恒 false；missing 回拉段又自相矛盾排除 isMastered → 已掌握且到期的句子被 skipMastered 永久滤除。
- 修复：过滤改"`isDue(it)` 必回拉，未到期才按 mastered/fluency 跳过"；sort 将 dueRank 提到 sentenceClassify 前（到期句不被 batchSize 截断切掉）；卡片 revCnt 用显式 `isMarkedForDeck(d.id,…)`。

**内容资产（freq-idioms.js 第一批 30 句）**
- 高频短语 · English Idioms 种子库 v1：30 句，源数据 `D:/tmp/el-build/data/high_freq_600.json`（394 条纯短语待分批扩写），Schema 与 oral8000 一致，自注册 + `validate_freq_idioms.js` 校验。

**验证**：store 31 / rev 27+ / builtins+oral8000 校验通过 / e2e 50/50；npm test 全链路绿。

### §8.8 main.html 拆分勘探 —— 决策：剩余编排层刻意维持单体（2026-09-08）

**触发**：ADR-007 把四个纯逻辑模块抽净后（chunk-engine/format/ai-prompts/backup，全可单测），风险登记表唯一未划掉的 P1「前端单体」悬置。本次做域聚类 + 耦合量化，产出「拆 or 不拆」决策，替代盲目续拆。

**现状核实（C1 删除 AI 死链后实测）**：main.html 4111 行 = CSS ~812 + HTML ~370 + 内联 JS ~2900（**123 顶层函数 + 37 全局 var + 41 处 onclick 绑定** + ~700 行绑定/init 区）。

**域聚类量化**（按函数体内 DOM/状态引用密度标注归属）：

| 域 | 函数 | 行数 | 占比 | 耦合特征 |
|---|---|---|---|---|
| 练习主流程 | 29 | 885 | 40% | S 单例 37+ / DOM id 密集 / 与全局 var 交织 |
| 讲解面板/反馈 | 15 | 308 | 14% | 弹窗 DOM + prompt/校验纯函数混合 |
| 导入/校验/追加 | 15 | 278 | 13% | validateDeck 等纯校验可抽，openImport 等 DOM 深 |
| 数据/状态层 | 24 | 273 | 12% | 已薄（CL 单例已吸收 core），多为 mem 读写 |
| 页面/设置/boot | 14 | 185 | 8% | closeMasks 180 行 dom 62 最重 |
| 圆环/popover | 7 | 174 | 8% | 自洽域（记忆统一模式），API 面 = updateRing |
| 分类/SRS/判定 | 9 | 39 | 2% | 近纯逻辑（mem/S/CL 读），最易抽 |
| 工具/桥/audio | 8 | 51 | 2% | esc/norm/wordCount 双实现兜底（见下） |
| 遗留包装器 | 2 | ~11 | — | buildChoices/buildDistractors 仅剩就绪探测用途 |

**可抽性三档评估**：
- **A 档（纯逻辑 ~150 行，可安全抽）**：validateDeck 43 + 分类/SRS 判定 39 + buildGrammar/miniMd（HTML 字符串构造）+ prompt 家族。无 DOM 副作用、纯输入输出，符合 ADR-007 可单测标准。
- **B 档（DOM 域，抽装 ROI 低）**：圆环 popover 174 行自洽，但抽成模块需 init(dom,ctx) 注入接口 + 无 E2E 之外回归手段，174 行收益 < 抽装与回归成本。
- **C 档（深耦合编排 885 行 = 40%，维持）**：renderQ/startDeck/submitChunk/finishSession 与 S 单例 + 37 全局 var + DOM id + 事件绑定区（41 onclick + ~700 行 init）深度交织。

**决策**：**main.html 剩余编排层刻意维持单体**（从 P1 待办降为已评审决策）。理由：
1. ADR-007 已抽净全部「纯逻辑高价值」部分——剩 2193 行函数体中 40% 是不可切分的状态编排、60% 是 DOM/流程胶水，两者都不是模块化的受益对象（不能单测、无独立复用面）。
2. 拆 B/C 档需引入「模块 init 注入 DOM+ctx」模式，而项目回归手段仅 e2e（65 用例），抽装任一分片都承担无差别回归风险。
3. 真正的残余熵在**事件绑定区与全局 var**（重构对象），不在函数本身——继续拆函数是打错靶。

**伴随发现（违宪兜底，拆分前置项）**：esc/norm/wordCount 是「模块版优先 + 内联双实现兜底」（FormatTools 未就绪时 console.warn + 本地实现）。属禁兜底宪法反例——若按 a677228 模式把 FormatTools 就绪纳入 bootApp 引擎守卫，兜底即死代码可删，norm 单源化后域拆分才无重复实现漂移。

**可选低优先动作**：A 档 ~150 行纯函数抽入既有模块（如 distractor-validate 旁的 data-judge.mjs）；buildChoices/buildDistractors 遗留包装器标注待删。均非必须。

### §8.9 8000 句内容架构第一阶段（2026-09-11）

**结论**：当前架构可以支持扩展到 8000 句，但不能继续把扩展题库作为页面启动时直接加载的单个 JavaScript 文件。本阶段已把题库内容从页面代码中解耦，保留旧数据回退路径，暂不改学习档案的 `deckId#cid` 键和云端同步协议。

**已落地**
- `scripts/build-content.mjs` 从现有扩展源生成 `content/manifest.json` 与带 SHA-256 的 JSON 分片；每片最多 200 句，当前 150 句口语种子为 1 片，389 条高频短语为 2 片。
- `js/content-repository.js` 只在页面启动时安装题库摘要；进入练习、题库编辑、导入或导出时才加载对应分片。分片加载失败时兼容回退到旧版源文件，避免一次迁移破坏已有用户。
- `main.html` 首页只用摘要和已有学习档案计算数量；`stats.html` 在需要生成完整统计时加载全部内置内容。用户自定义题库仍走原有存储路径。
- Service Worker 只原子预缓存小型 manifest，不再预缓存会持续增长的整包扩展源；动态分片按请求缓存。部署校验会展开 manifest，确保 `content/` 下所有分片都被发布。
- `npm run content:build` 成为内容更新入口；`sw-policy.test.js` 与 `e2e/sw-cache.test.js` 锁定分片、离线和失败降级语义。

**为什么当前方案能支撑 8000 句**
1. 入口页首屏不再承担 8000 句的下载、解析和 SW 原子安装成本。
2. 内容 URL 不可变，文件名带 hash；内容更新通过新 manifest 和新分片自然失效，不依赖浏览器刷新旧脚本缓存。
3. 分片粒度固定，后续增加句子只新增/重算受影响分片；练习档案仍按稳定 cid 对齐，不因物理文件拆分改变。
4. 旧版源仍在兼容回退链路中，便于灰度升级和本地旧缓存恢复。

**第二阶段已落地（2026-09-11）**
- `ContentRepo.ensureDeckBatch()` 已接入练习入口：当内置题库超过 1000 句时，只按“每批数量”取当前批，完成页可继续读取下一批；内容游标写入现有 progress，断点续练不会从头扫描。
- 分批扫描会沿用删除、已掌握、熟练度和到期复习过滤；题库管理与学习档案仍可通过 `ensureDeck()` 按需获取完整视图，未改变 `deckId#cid` 学习档案和同步协议。
- 新增独立 IndexedDB `chunklab-content-v1/shards`：读取顺序为内存 → 内容 IDB → Service Worker/网络，并按 manifest 的内容版本和 hash 清理过期缓存；不升级学习数据 IDB，兼容旧浏览器与旧数据。

**8000 句上线前仍需完成**
- 补齐内容质量流水线：稳定 cid、重复检测、chunk 拼接、干扰项覆盖率、难度分布和人工抽检；建议先用 800～1200 句做真实移动端压力验收，再扩到 8000 句。
- 增加真实 8000 句数据的构建时间、索引体积、首屏请求、内存峰值和断网恢复预算，作为发布门槛，而不是只依赖功能测试。

**第三阶段已落地（2026-09-11）**
- `scripts/build-content.mjs` 同时生成详情分片和轻量 `indexShards`；索引只保存 `cid、sentence、translation、sourceUrl、sourceOffset`，并由 `scripts/validate-content.mjs` 校验 hash、数量、顺序和引用完整性。
- `stats.html` 改为 `ensureIndexAll()`：句子记录、统计分布、到期复习列表和手动复习入口先使用索引，不再进入页面就加载完整题目；真正开始复习时由 `hydrateItems()` 按引用取详情。
- 内容索引与详情共用独立 IDB 缓存和 manifest 版本清理；部署依赖检查会把 index 分片纳入发布闭包，旧 manifest 没有 index 时仍回退到原有全量路径。

**验证**：内容构建成功；部署依赖检查通过；SW 专项通过；全量项目单测通过；浏览器回归包含分批、索引、详情按需加载和 IDB 离线命中验证。

## 9. 数据可靠性第一阶段（2026-09-11）

### 本轮实现

- 课程迁移等待 courses/progress 两次 IDB 事务完成后，才清理旧 localStorage 键；中断/失败保留旧数据以便再次迁移。同一页面并发 preload 共用在途任务。
- `CL.writeCourses/writeProgress` 返回保存 Promise，按存储串行提交；读接口返回副本，写失败不发布新内存值、不触发课程上行。IDB 内容读取失败时拒绝盲目覆盖。
- 课程 ZIP 导入、并发导入、学习进度保存和备份恢复等待对应保存结果；失败不报成功。云端课程合并也等待落盘，不再吞掉 IDB 拒绝。
- 版本化题库、课程、课程进度和小字段写入若被 rev 守卫拒绝且内容不同，返回 HTTP 409 / `SYNC_CONFLICT`；该事务所有写入和 seq 回滚。内容相同的重试仍可成功，属性顺序不影响判定。
- 客户端要求明确 `ok:true` 才推进确认水位；PUT 串行，在途新修改保留待发标记。冲突元数据及该批实体删除清单保存到本机，刷新后先重试原版本，避免未处理的本地冲突被启动拉取覆盖。顶栏显示“同步冲突”，不使用浏览器原生警告框。
- 新服务端模块已加入部署清单；静态资源变更由 `gen-sw` 更新缓存版本。

### 明确未完成的边界

1. 这不是完整并发控制：仍由客户端递增 rev；离线旧基础上产生更大的 rev，仍可能覆盖其他设备的新值。下一步引入服务端条件写（baseRev）及每项接收结果。
2. 第一阶段仅提示冲突；第二阶段已补双方备份及“保留本机 / 使用云端”（见 §10）。尚未提供自动合并或“保留两份为两个可编辑题库”，备份不等于合并。
3. 冲突删除清单不是完整持久 outbox；普通网络失败后的删除、行级取消标记、跨账号队列隔离需要统一持久日志。行级档案/标记的并发语义仍需独立完善。
4. 课程/进度为各自独立事务；备份恢复也不是跨 localStorage/IDB 的原子事务。多标签页旧快照覆盖尚未解决，应在后续存储服务中统一事务/锁与版本检查。
5. 8000 句性能入口已推进到按批补详情、列表分页、内容版本绑定游标及模拟容量测试（见 §11）；实际课程质量与真机验收仍未完成。

### 验证与后续

- 新增 `course-storage.test.js`：延迟提交、事务失败、冷启动重试、读取失败保护、写序列/快照隔离、真实课程导入失败及并发导入。
- 新增 `api.test.js`，扩展 `rev.test.js` 与后端 smoke：明确成功回执、冲突、重发、不误清在途修改、四类实体拒写及整批回滚、幂等删除。
- 浏览器 `e2e/sync.test.js` 覆盖双设备同版本冲突与刷新恢复；`e2e/stats-idb.test.js` 覆盖真实 IDB 迁移、答题写入和刷新保留。
- 最新执行结果记录在 `PROJECT_PROGRESS.md`。后续先补完整冲突恢复闭环，再推进剩余大库性能入口。

## 10. 明确的冲突处理流程（2026-09-11）

- 顶栏“同步冲突”可点击，比较本机/云端版本后选择保留本机或使用云端。删除状态明确提示；敏感设置在界面预览中遮蔽；可以下载双方备份。
- `GET /api/sync/entity` 返回具体实体快照及内容令牌；`POST /api/sync/resolve` 在事务内校验令牌、提交选择、保存双方快照与回执、推进 seq。云端有新改动则要求重新比较，备份写失败则整笔回滚。
- `user_sync_resolutions` 按账号隔离；相同 requestId/相同请求只返回原回执，不重复改写或增加版本。备份每账号限制100次或64MiB（仅 backup_json 计量，回执另有空间开销），到限拒绝新处理，不自动删除历史数据。当前归档导出/清理仍需管理员维护，没有完整备份历史管理页。
- 客户端先把已确认请求写入独立 IDB `chunklab-sync-recovery/pending`，再发送。记录按 API 地址及账号分区；未确认期间暂停普通同步，断网/响应丢失/刷新后显示“继续上次处理”。本地内容处理期间又被编辑时保留新改动并要求重新比较。
- 处理成功同步刷新练习页内存，避免下次答题把旧 mem 写回；若当前题库被替换或删除，结束旧题库展示并回今日页。
- **边界**：这是明确选择操作的条件写，不是所有普通同步都已经使用 baseRev；不是完整 outbox、跨标签页锁或跨存储原子恢复。双方备份保全的是冲突项目，不是每次都做整库快照。
- 验证：后端 smoke 共132项通过，覆盖四类实体、删除、鉴权隔离、旧预览、重试及备份失败回滚；双浏览器同步22项通过，包含 IDB 写失败禁止发送、响应丢失/刷新重试及393像素布局。

## 11. 8000句按批加载与容量门槛（2026-09-11）

### 本轮修复

1. 修复 `startDeck` 首批加载完成后又误入 `ensureDeck` 整库加载的分支；批次已就绪不再走完整详情路径。
2. 学习档案交接轻量引用队列，练习页先选当前批再调用 `hydrateItemBatch`；跨批补相应分片，完整详情不在队列中逐批累积。完整详情内存缓存对该路径关闭，已加载内容仍可从独立 IDB 离线读取。
3. 句子记录、到期列表、错题列表每页最多50条。到期查找建立 cid/句子映射，不再逐条扫描整库。统计数字及复习队列仍保留全部记录，不因分页截断。
4. 分批游标带 contentVersion，版本变化重新扫描；构建版本改为由分片顺序、内容摘要和内嵌基础句子生成确定性 SHA-256，避免写死日期导致同日更新无法识别。
5. 新增 `e2e/mobile-8000.test.js`：8000条合成句子、40个200句详情分片及40个索引分片，在393×852、CPU四倍减速的 Chromium 下验证。测试数据只通过临时服务/请求拦截注入，不混入正式题库或用户学习记录。
6. 顺带修正 SW 生成器：先补全最终资源清单再算版本，新增脚本后无需执行两次才得到稳定缓存版本；新同步脚本已纳入部署闭包。

### 容量测试结果与限制

本机代表性复跑：15项通过；首页589ms，统计页639ms，8000条到期筛选及渲染141ms，复习跳转634ms。首页未请求详情/索引；跨分片两组只请求2个详情分片（合计865142字节）；统计请求40个索引；断网续读缓存成功。阶段采样最大 JS 堆约20MiB，**不是全程内存峰值**。

结构门槛已锁定：首页零详情请求、普通首批仅一个分片、列表≤50条、到期计算<3秒（CPU×4）、跨片只取相关分片、来源ID/顺序保留、窄屏无横向溢出、离线命中及无页面异常。时间读数用于跟踪，不等于公网冷启动或特定手机速度承诺。

**上线前仍需**：真实8000句内容质检；Android/iOS实机和弱网、多轮内存峰值验收；大复习队列交接由 localStorage 迁至持久 IDB（当前写失败已阻止跳转但容量上限仍在）；索引分页/查询服务及极端掌握过滤优化。普通同步的 baseRev/outbox 仍是优先于扩大正式内容投放的可靠性任务。

## 12. 普通同步基础版本协议：后端先行（2026-09-11）

**2026-09-12 更新**：courses/courseProgress 经业务保存产生的 syncIntents 已在启动拉取前自动恢复。原值与远端值一致才取得其实际 rev 作为条件，否则要求用户比较；请求在业务 IDB 冻结，丢失回执原样重试，后继修改单独保留。不存在/墓碑通过 exists 区分，使用 null/数值基础版本。拉取事务保护并发新意图，冲突选择只确认对应操作。28项浏览器回归覆盖。以下“前端尚未接入”描述是上一阶段状态；目前未接入的是 decks/kv/统计行/事件与历史基础版本的完整迁移，不能宣称全数据安全同步完成。未登录 local 记录不自动归属新账号；内容对账不检测 ABA，需要后续持久远端基线。独立 SyncOutbox 未作为运行时使用，实际采用同一业务数据库的 syncIntents。

- `PUT /api/data`、`POST /api/import` 新增可选 `baseRevs`，覆盖 decks、courses、courseProgress、kv（best/stats/settings）的写入及软删除。
- 一旦携带 `baseRevs`，本批每个版本化写入都必须有基础版本和正安全整数提交版本，不能漏字段后退回旧协议；重复写同一项目、同时写入和删除、无效版本返回400。
- `null` 基础版本表示仅当项目从未存在时创建；数字表示读取时看到的服务端版本。软删除仍是存在的版本，恢复必须基于墓碑版本，不能用 null 把它视为新建。
- 服务端在同一事务内检查基础版本；即使客户端离线累积到更高 rev，基础不符且内容不同仍返回409（`SYNC_CONFLICT`，原因 `BASE_REV_MISMATCH`）。整批实体、行级变更及 seq 一起回滚。目标内容相同的重试可确认，兼容回执丢失后的重发。
- **当前只完成后端和测试，前端尚未发送 baseRevs。** 不带该字段仍走旧协议，保证升级兼容；因此这不是端到端并发保护已经生效，也没有完成普通同步 outbox。旧客户端的无版本写入仍可改变内容而没有可靠的单调版本，混用期间不能宣称全局条件写成立。
- 后端 smoke 已扩展至178项；新增 `server/sync-conflict.test.js` 并纳入 npm test。覆盖四类实体的高rev旧基础拒绝、整批回滚、导入不可绕过、创建冲突、删除重试、墓碑恢复、参数校验及旧协议兼容。

### 客户端下一阶段接入约束

1. 在独立 IDB 中按服务地址/账号保存确认基线和不可变待发请求。基线不是“当前本地rev减1”，也不能在准备发送时临时读取云端来伪造；缺失基线的历史数据需要显式对账。
2. 所有保存入口（课程、普通mem、删除和行级标记）必须先持久化待发意图，才允许网络发送或清理旧数据。仅包装 putData 无法保护“保存后、定时器触发前就关闭页面”的窗口。
3. 启动先恢复未确认请求，不先拉取覆盖本机；成功回执才确认/移除对应请求，在途新改动另行保留。账号切换及旧请求回执不能影响新账号。
4. 409 冻结冲突项目并衔接既有双方备份/选择流程，不能自动提高rev或替换base重发；解决完成后须重新基于已确认版本生成后续请求。
5. 完成跨页面写入入口梳理和兼容迁移后才启用前端条件协议，再验证离线删除立即刷新、回执丢失、断网恢复、跨账号隔离和多标签页并发。服务器何时拒绝旧协议另行安排，不能本轮直接断掉旧客户端。
