# Chunk Lab · 英语句型意群练习

> 本地优先（Local-first）的英语意群学习工具 —— 把句子拆成语块，拼出真正的语感。
> 前端纯静态 + 后端 Node/SQLite 云端持久化，可纯本地离线运行，也可一键开启云端同步。

## 项目简介

Chunk Lab 的核心玩法是**意群（chunk）拆解练习**：每个英语句子被拆成 2~5 个语义完整、带语法角色标注的意群，学习者通过选词、填空、打字的方式把整句还原。相比背单词，这种练习直接作用于"句子结构"和"语块记忆"，配合 SRS 间隔重复与 AI 详解，是面向口语和阅读的轻量训练方案。

**技术特征**
- 前端：零构建、零运行时依赖的静态页（`main.html` 等），双击或起服务即可运行
- 后端（可选）：Node + Express + SQLite（`better-sqlite3`）+ JWT，提供云端持久化与多用户
- 同步：浏览器 `localStorage` 仍作离线优先缓存，云端在后台异步同步
- 两种运行模式：`REQUIRE_AUTH` 切换开放模式 / 多用户模式，无需改表

## 功能特性

| 能力 | 说明 |
|------|------|
| 🧩 意群练习 | 拼句 / 选词 / 填空 / 打字 4 种作答模式，逐语块即时判定 |
| 📚 内置题库 | 日常对话、购物英语、高频口语、日常口语 8000 句（种子 30 句）4 个内置课程 |
| 📖 图文课程 | ZIP 课程包导入 + 图推理对话练习 + 课前预习 / 主课程 / 课后测试三段式 |
| 🔁 SRS 间隔重复 | 艾宾浩斯节奏 `1→3→7→14→30→60→120→180→365` 天，答错重置（纯函数，可单测） |
| ✨ AI 详解 | 接入 DeepSeek 生成多维讲解，本地缓存命中免重复计费（⚠️ 当前前端直连，见"已知限制"） |
| 📊 学习档案 | 熟练度分布、需巩固句子、错题本、到期复习队列 |
| 💾 整库备份 | 一键导出/导入 JSON（含题库、统计、设置、错题本、图文课程、课程进度、AI 缓存） |

## 架构概览

```
UI 层        main.html（入口）· decks.html · stats.html · courses.html（iframe + postMessage 隔离）
共享核心层   core.js（CL 单例）· srs.js（纯函数）· library.js · course-package.js · api.js · auth-ui.js
云端后端     server/（Express + SQLite + JWT）：鉴权 / 数据 / 单条课程 / 备份 / 健康
数据层       浏览器 localStorage（离线优先·版本化）+ 云端 SQLite（权威数据，按 user_id 隔离）
```

关键决策（ADR，详见 [`architecture-plan.md`](./architecture-plan.md)）：
- **ADR-001** 页面物理隔离：iframe + postMessage，子页崩溃不影响主页
- **ADR-002** 全局命名空间收敛为 `CL` 单例，消灭全局函数污染
- **ADR-003** SRS 调度纯函数化，可单测、可替换算法
- **ADR-004** AI 调用走后端代理（已落地：Key 服务端化 + 限流 + 缓存 TTL）
- **ADR-005** 实体级 rev 同步 + 软删除（已落地：四类实体 per-entity，多设备不丢数据）
- **ADR-006** 鉴权安全（已落地：REQUIRE_AUTH 多用户模式 + env 密钥，上云必开）
- **ADR-007** 前端 ESM 模块化（已落地：chunk-engine / format / ai-prompts / backup 四模块 + bridge 桥接，main.html 4781→4444 行）
- **ADR-008** 后端校验测试（已落地：服务端 schema 校验 400 + 冒烟测试 49 用例）

## 快速开始

### 方式一：纯本地（无云端，最简单）
双击 `main.html`，`file://` 协议下即可完整运行，数据只存在本机浏览器。

### 方式二：本地调试 + 云端同步（推荐开发）
```bash
cd server
npm install                 # 安装后端依赖（express/better-sqlite3/jsonwebtoken/bcryptjs/cors）
cp .env.example .env        # 按需修改；.env 已被 .gitignore 忽略
node -r ./loadenv.js index.js
# 浏览器打开 http://localhost:8787/main.html （同源、免 CORS）
```
> 本地调试可用开放模式（`REQUIRE_AUTH=false`，免登录即学）；UI 与 API 同源，零配置。

### 方式三：生产部署（多用户 + 安全）
必须开启多用户模式并收口网络，详见下方「安全部署清单」：
```bash
cd server
npm install --production
REQUIRE_AUTH=true JWT_SECRET=$(openssl rand -hex 32) PORT=8787 node index.js
# 前面用 Nginx 反代 /api 并终结 TLS，前端静态也由 Nginx 托管
```

## 运行模式

| 模式 | 配置 | 行为 |
|------|------|------|
| 开放模式（默认） | `REQUIRE_AUTH=false` | 所有请求落到单一默认用户 `__default__`，免登录即可学习；前端不弹登录框 |
| 多用户模式 | `REQUIRE_AUTH=true` | 注册/登录签发 JWT，按 `user_id` 数据隔离；前端未登录才弹登录框 |

> 切换模式无需改表——schema 始终按 `user_id` 隔离。详见 [`architecture-plan.md`](./architecture-plan.md) 的 ADR-006。

## 安全部署清单（⚠️ 上云前必读 · ADR-006）

开放模式默认共享单用户且 `JWT_SECRET` 有硬编码默认值，**任何公网部署 = 数据裸奔、可被任意覆盖**。公网部署必须满足：
1. `REQUIRE_AUTH=true`（强制多用户、JWT 鉴权）
2. `JWT_SECRET` 用强随机值（如 `openssl rand -hex 32`），**绝不能**用默认值
3. 全程 HTTPS（TLS 在 Nginx / 反向代理层终结）
4. `CORS_ORIGINS` 填真实前端域名，不要用开发期全允许
5. 网络收口：防火墙 / VPN / allowlist；不要裸暴露 8787 端口
6. 开放模式仅限本机、内网或已收口的网络

## 数据存储

**浏览器（离线优先，版本化 v2）**

| 键 | 内容 |
|----|------|
| `chunklab.v1` | 主数据：题库、纪录、掌握标记、统计、设置、断点进度、错题本 |
| `chunklab.courses.v1` | 图文课程包（含 base64 图片，可能较大） |
| `chunklab.course-progress.v1` | 各课程的已学节点 / 完成状态 |
| `chunklab_reinforce` | 错题本（部分路径） |
| `chunklab_ai_cache_v1` | AI 详解缓存（按「模型 + 句子」命中，前端 LRU 淘汰） |

**云端（SQLite，按 user_id 隔离）**

| 表 | 内容 |
|----|------|
| `users` | 账号（bcrypt 哈希） |
| `user_decks` | 用户自定义题库 |
| `user_kv` | best / mastered / stats / settings / reinforceBook / deletedItems |
| `user_courses` | 图文课程（逐条拆分，便于增量） |
| `user_course_progress` | 课程进度 |
| `ai_cache` | AI 详解缓存（全局共享，省成本） |

> 数据库位置：`CHUNKLAB_DATA_DIR` 或 `server/data/chunklab.db`；备份用 `GET /api/export`、恢复用 `POST /api/import`。

## 页面导航

| 文件 | 入口 | 职责 |
|------|------|------|
| `main.html` | 项目入口 | 练习主页 + 题库管理 + 系统设置 + AI 解读 |
| `decks.html` | 主页「题库」 | 句子课程 / 图文课程双 tab：导入、导出、AI 批量生成、分类 |
| `stats.html` | 主页「📊」 | 学习档案：KPI 卡片、熟练度圆环、错题本、到期复习 |
| `courses.html` | 题库页·图文课程 | 图文课程播放器（支持 `?id=<courseId>` 深链直达） |

> 旧版 `chunk-practice.html` 为重构前的单体遗留，已被 `main.html` 取代，不再维护。

## 开发与测试

前端单测（Node 直跑，零依赖）：
```bash
node srs.test.js           # SRS 间隔序列 / 答错重置 / 旧数据兼容 / 到期判定
node store.test.js         # 存储键统一 / 版本迁移 / 默认结构
node validate_oral8000.js  # 口语种子数据规范（chunk 拼接=原句、标点规则、alts）
node course-resume.test.js # 图文课程进度恢复
```

后端冒烟测试（零依赖，启动服务跑关键接口往返）：
```bash
cd server
node -r ./loadenv.js index.js &   # 或另开终端先起服务
node smoke.test.js                # 健康检查 / 注册登录 / 数据读写 / 课程增删 / 导出 / 401 拦截 / AI 缓存 TTL
```
> 冒烟测试会自己拉起一个临时 DB 的多用户模式服务，跑完自动清理。

ESM 模块单测（ADR-007 拆分出的纯逻辑模块）：
```bash
node js/chunk-engine.test.mjs     # 练习核心：chunk 判定 / 干扰项（语义过滤 + 跨题库）/ 评分
node js/format.test.mjs           # 工具函数：esc / norm / wordCount / timeAgo
node js/ai-prompts.test.mjs       # AI prompt 构建 + extractJSON
node js/backup.test.mjs           # 备份组装 / 导入解析
node rev.test.js                  # ADR-005 实体级 rev 同步 + 离线 change-log（dirty/重连补传）
```

浏览器端到端验收（Playwright 截图：桌面/移动端练习页、AI 弹窗、题库页）：
```bash
# 起服务后：
NODE_PATH=<playwright-core 所在 node_modules> node output/e2e/verify.js
# 截图输出到 output/e2e/shots/（output/ 已被 gitignore）
```

> **PWA 缓存约定（开发必读）**：`sw.js` 对静态资源 cache-first，改业务代码后必须 **bump `CACHE` 版本号**（如 `chunklab-v3` → `v4`），否则浏览器会继续 serve 旧缓存（修复不生效）。刷新页面一次即完成新 SW 激活与旧缓存清理。

## 环境变量（server/.env.example）

| 变量 | 默认 | 说明 |
|------|------|------|
| `REQUIRE_AUTH` | `false` | `true`=多用户（公网必开） |
| `JWT_SECRET` | 硬编码 dev 值 | JWT 签名密钥，**生产必须改** |
| `TOKEN_TTL` | `30d` | 登录令牌有效期 |
| `CORS_ORIGINS` | 空（开发期全允许） | 允许的前端来源（逗号分隔） |
| `PORT` | `8787` | 服务端口 |
| `CHUNKLAB_DATA_DIR` | `server/data` | 数据库目录 |

## 架构与长期规划

整体架构设计、目标模型（含 SyncService 实体级 rev upsert）、ADR 全文、分阶段路线图（Phase A 加固 → B 同步正确 → C AI/离线 → D 平台化）与风险登记，见 **[`architecture-plan.md`](./architecture-plan.md)**。

## 已知限制与上线待办

- 🔴 **同步整块覆盖**：当前 `PUT /api/data` 是全量 DELETE+INSERT，多设备/并发会相互覆盖、写入中途崩溃可丢数据 → ADR-005 实体级 rev upsert（Phase B）
- 🔴 **开放模式安全**：默认共享单用户 + 默认 JWT 密钥，公网裸奔 → ADR-006 + 上云安全清单
- 🟡 **AI Key 前端直连** DeepSeek，明文存浏览器 → ADR-004 后端代理 + 限流（Phase C）
- 🟡 `main.html` 4781 行单体，前端模块化未落地 → ADR-007 原生 ESM 拆分（Phase A/B）
- 🟡 后端校验 / 单测覆盖有限 → ADR-008（本 README 的 `smoke.test.js` 已补端到端冒烟）
- 🟡 移动端适配弱（少量媒体查询）；无 PWA / manifest / favicon
- 🟡 核心练习逻辑（chunk 判定、干扰项、评分）尚无单测
- 🟡 口语 8000 句当前仅 30 句种子数据（`oral8000.js` 追加即可扩展）
