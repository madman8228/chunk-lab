# Chunk Lab · 英语句型意群练习

> 本地优先（Local-first）的英语意群学习工具 —— 把句子拆成语块，拼出真正的语感。
> 前端纯静态 + 后端 Node/SQLite 云端持久化，可纯本地离线运行，也可一键开启云端同步。

## 项目简介

Chunk Lab 的核心玩法是**意群（chunk）拆解练习**：每个英语句子被拆成 2~5 个语义完整、带语法角色标注的意群，学习者通过选词、填空、打字的方式把整句还原。相比背单词，这种练习直接作用于"句子结构"和"语块记忆"，配合 SRS 间隔重复与逐句讲解（课程打包的结构化数据），是面向口语和阅读的轻量训练方案。

**技术特征**
- 前端：零构建、零运行时依赖的静态页（`main.html` 等），双击或起服务即可运行
- 后端（可选）：Node + Express + SQLite（`better-sqlite3`）+ JWT，提供云端持久化与多用户
- 同步：浏览器 `localStorage` 仍作离线优先缓存，云端在后台异步同步
- 两种运行模式：`REQUIRE_AUTH` 切换开放模式 / 多用户模式，无需改表

## 功能特性

| 能力 | 说明 |
|------|------|
| 🧩 意群练习 | 拼句 / 选词 / 填空 / 打字 4 种作答模式，逐语块即时判定 |
| 📚 内置题库 | 2 套：日常对话 · Daily Talk（238 句，含口语种子 150 句）+ 高频短语 · English Idioms（201 句） |
| 📖 图文课程 | ZIP 课程包导入 + 图推理对话练习 + 课前预习 / 主课程 / 课后测试三段式 |
| 🔁 SRS 间隔重复 | 艾宾浩斯节奏 `1→3→7→14→30→60→120→180→365` 天，答错重置（纯函数，可单测） |
| 📝 句子详解 | 课程自带结构化讲解（语法 / 搭配 / 句型，随句渲染）；AI 联网生成为**可选后端能力**（服务端代理 + 限流 + 缓存，`AI_EXPLAIN_ENABLED=true` 开启，默认停用） |
| 📊 学习档案 | 熟练度分布、需巩固句子、错题本、到期复习队列 |
| 💾 整库备份 | 一键导出/导入 JSON（含题库、统计、设置、错题本、图文课程、课程进度） |

## 架构概览

```
UI 层        main.html（练习入口）· decks.html（题库管理）· stats.html（学习档案）· courses.html（图文课程）
             页面间为整页跳转（location.href），数据经 localStorage / 云端共享；无 iframe 依赖
共享核心层   core.js（CL 单例）· srs.js（纯函数）· library.js · course-package.js · api.js · auth-ui.js
云端后端     server/（Express + SQLite + JWT）：鉴权 / 数据 / 单条课程 / 备份 / 健康 / AI 代理
数据层       浏览器 localStorage / IndexedDB（离线优先·版本化）+ 云端 SQLite（权威数据，按 user_id 隔离）
```

关键决策（ADR，详见 [`architecture-plan.md`](./architecture-plan.md)）：
- **ADR-002** 全局命名空间收敛为 `CL` 单例，消灭全局函数污染
- **ADR-003** SRS 调度纯函数化，可单测、可替换算法
- **ADR-004** AI 调用走后端代理（已落地：Key 服务端化 + 限流 + 缓存 TTL；联网生成当前默认停用，env 开启）
- **ADR-005** 实体级 rev 同步 + 软删除（已落地：四类实体 per-entity，多设备不丢数据）
- **ADR-006** 鉴权安全（已落地：REQUIRE_AUTH 多用户模式 + env 密钥，上云必开）
- **ADR-007** 前端 ESM 模块化（已落地：chunk-engine / format / ai-prompts / backup 四模块 + bridge 桥接；main.html 当时 5.1k→4.3k 行，后续增补至 ~5.0k，剩余 DOM/流程层仍为单体）
- **ADR-008** 后端校验测试（已落地：服务端 schema 校验 400 + 冒烟测试 63 用例）
- **ADR-001（已作废）** 早期 iframe + postMessage 页面隔离方案已随独立页面迁移移除（见 2026-09-08 死代码清理），保留编号仅为追溯

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
> 📦 **完整腾讯云落地手册**（systemd + Nginx TLS + 每日全库快照 + 上线复核清单）：见 [`deploy/deploy-tencent.md`](./deploy/deploy-tencent.md)。配套 systemd 单元 / Nginx 站点模板 / env 生成器 / 全库备份脚本 `server/backup-db.js` 均在 `deploy/` 与 `server/` 下。

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

**浏览器（离线优先，版本化；云端开启后仅作即时缓存）**

| 键 / 位置 | 内容 |
|----|------|
| `chunklab.v1` | 主数据：题库、纪录（best）、掌握标记、统计、设置、断点进度、**错题本（reinforceBook）** |
| IndexedDB · store `courses` | 图文课程包（原 `chunklab.courses.v1` 键已迁移，`CL.preload` 启动迁移） |
| IndexedDB · store `progress` | 课程已学节点 / 完成状态（原 `chunklab.course-progress.v1` 同上） |
| `chunklab_revs_v1` | 实体级 rev 版本号（ADR-005，core.js 维护） |
| `chunklab_reinforce` | **已废弃**：错题本曾用的独立键（从不云同步，2026-09-08 起收敛到 `chunklab.v1.reinforceBook`，旧存量加载时一次性迁移后删除） |

> **句子档案 key 与原文解耦（cid）**：`mastered` / `deletedItems` / `stats.bySentence` / 事件记录的键统一为 `deckId#cid`（cid = 句子数据的稳定内容 ID，见 `core.js` 的 `cidOf`）。内容修订时保留原 cid 即可不丢学习进度；旧数据（`deckId#原文`）在 `loadMem` 时自动一次性迁移。内置句子 cid 由 `scripts/add-cids.js` 维护（幂等），`validate_builtins.js` / `validate_oral8000.js` 回归校验。

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
| `main.html` | 项目入口 | 练习主页 + 逐句详解弹窗 + 系统设置 + 导入 |
| `decks.html` | 主页右上「题库」 | 题库管理：句子课程 / 图文课程双 tab（导入、导出、批量生成、分类） |
| `stats.html` | 主页右上「档案」 | 学习档案：KPI 卡片、熟练度分布、句子记录、错题本、到期复习 |
| `courses.html` | 题库页·图文课程 | 图文课程播放器（支持 `?id=<courseId>` 深链直达；无 id 时跳回 decks.html） |

> 页面间为**整页跳转**（`location.href`），非 iframe 嵌入；错题/复习等跨页操作通过 `localStorage`（`chunklab_pending_review_deck`）+ 主页启动时读取完成接力。
> 重构前的单体遗留 `chunk-practice.html` 已被 `main.html` 取代并从仓库移除。

## 开发与测试

前端单测（Node 直跑，零依赖）：
```bash
node scripts/check-sw.js     # SW 护栏：CACHE 与 PRECACHE 内容哈希一致（防忘跑 gen-sw）
node srs.test.js            # SRS 间隔序列 / 答错重置 / 旧数据兼容 / 到期判定
node store.test.js          # 存储键统一 / 版本迁移 / 句子 key cid 迁移 / 默认结构
node rev.test.js            # ADR-005 实体级 rev 同步 + 离线 change-log（dirty/重连补传）
node validate_builtins.js   # 内置题库数据规范（cid 唯一、chunk 拼接=原句、句子不重复）
node validate_oral8000.js   # 口语种子数据规范（chunk 拼接=原句、标点规则、alts、cid）
node validate_freq_idioms.js# 高频短语数据规范（同上，另有 idiom 不可拆分校验）
node course-resume.test.js  # 图文课程进度恢复
```
> 内置句子增改后跑 `node scripts/add-cids.js` 补/重算 cid（幂等；`--force` 全量重算）再跑对应的 validate_*.js。

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

浏览器端到端回归（Playwright，一键跑，自动拉起临时 server）：
```bash
npm run e2e:all    # 一键跑全部 26 个套件（e2e/ 6 + output/e2e/ 20），按需拉起临时 server，汇总通过率
npm run e2e        # 主 UI 回归 97 项
npm run e2e-sync   # 双设备同步对抗 7 项（ADR-005 端到端：per-entity 隔离 / LWW / 软删传播 / 删除重建 / stale 拒写）
# 覆盖：main 正常路径（顶栏 SVG/真实句子/候选区/零 pageerror）、
#       全 module 拦截降级（safeCall 兜底不白屏）、decks/stats SVG 渲染、
#       错题本收敛闭环（写入→mem.reinforceBook 落盘/旧键迁移/stats 可见）、
#       结算卡「换个题库」跳 decks.html（死代码清理回归）
# 套件位置：e2e/（主套件）+ output/e2e/（各专项验证，如月历 popover / topbar 拆分 / 图标审计，
#           均已随版本入库）；一次性脚本 debug-*.js / shot-*.js 不纳入自动跑
# 截图输出 e2e/shots/ 与 output/e2e/shots/（均不入库）；找不到浏览器时设 CHROMIUM_PATH
```

> **e2e 入口约定**：`main.html` 裸链默认落**今日首页**（`decideEntry()` → `showHomePage()`，会隐藏练习区）。
> 任何需要练习区的脚本 / 书签 / 深链必须带 **`?direct=1`**，否则拿到的是首页（表现为 `#track` / `#ringWrap` / `#zh` 取不到）。
> `e2e-all.js` 按脚本内端口字面量自动分流三种模式：自带服务器 / 硬编码外部端口 / `E2E_BASE`，无需手工起服务。

> **PWA 缓存约定（开发必读）**：`sw.js` 对静态资源 cache-first。CACHE 版本 = `chunklab-<sha1前8位>`，由 `node scripts/gen-sw.js` 依 PRECACHE 清单文件内容自动生成 —— **改业务代码后重跑 `node scripts/gen-sw.js`**（或手动 bump），否则浏览器继续 serve 旧缓存（修复不生效）。已加护栏 `node scripts/check-sw.js`（挂在 `npm test` 首位）：CACHE 与资源内容哈希不一致且工作区干净时直接报红拦截。刷新一次即完成新 SW 激活与旧缓存清理；页面顶部会自动出现"发现新版本"toast，点刷新即可。

## 自动备份（上线准备 · 推荐配置）

零依赖 CLI（`server/backup-cli.js`），备份走应用级 `/api/export`（可移植 JSON，恢复即 `/api/import`，链路对称）：

```bash
node server/backup-cli.js backup              # 备份 → server/backups/chunklab_backup_*.json
node server/backup-cli.js restore <file>      # 恢复（覆盖式，恢复语义）
node server/backup-cli.js list                # 列出备份
```

环境变量：`BASE_URL`（默认 http://127.0.0.1:8787）/ `TOKEN`（鉴权模式需要）/ `BACKUP_DIR`（默认 server/backups，生产指向持久盘）/ `BACKUP_KEEP`（默认 14 份，超出自动删最旧）。

调度：
- **Linux**：`0 3 * * *  cd /path/to/chunk-practice && BASE_URL=http://localhost:8787 TOKEN=xxx node server/backup-cli.js backup`
- **Windows**：任务计划程序 → 每日 03:00 → 程序 `node`，参数 `server/backup-cli.js backup`，起始于项目目录，环境变量 `BASE_URL`/`TOKEN`/`BACKUP_DIR`

> **恢复演练（建议每月一次）**：`node server/backup-cli.js list` → 选一份 → `restore 文件` → 浏览器确认题库/错题本/统计回来。备份没有验证过等于没有备份。

## 环境变量（server/.env.example）

| 变量 | 默认 | 说明 |
|------|------|------|
| `REQUIRE_AUTH` | `false` | `true`=多用户（公网必开） |
| `JWT_SECRET` | 硬编码 dev 值 | JWT 签名密钥，**生产必须改** |
| `TOKEN_TTL` | `30d` | 登录令牌有效期 |
| `CORS_ORIGINS` | 空（开发期全允许） | 允许的前端来源（逗号分隔） |
| `PORT` | `8787` | 服务端口 |
| `CHUNKLAB_DATA_DIR` | `server/data` | 数据库目录 |
| `AI_EXPLAIN_ENABLED` | `false` | 联网 AI 详解开关（2026-09-06 起默认停用 → `/api/ai/explain` 503） |
| `DEEPSEEK_API_KEY` | 空 | DeepSeek Key（ADR-004：仅存服务端，前端不再直连） |
| `AI_RATE_LIMIT` | `10` | AI 代理每用户每分钟限流次数 |
| `AI_CACHE_MAX` | `2000` | 服务端 ai_cache 容量（LRU 淘汰） |
| `AI_CACHE_TTL` | `30` | AI 缓存有效期（天；0=永不过期） |

## 架构与长期规划

整体架构设计、目标模型（含 SyncService 实体级 rev upsert）、ADR 全文、分阶段路线图（Phase A 加固 → B 同步正确 → C AI/离线 → D 平台化）与风险登记，见 **[`architecture-plan.md`](./architecture-plan.md)**。

## 当前已知限制

- 🔴 **开放模式公网 = 数据裸奔**：默认共享单用户 + 默认 JWT 密钥。任何公网 / 可访问网络部署必须先 `REQUIRE_AUTH=true` + 强随机 `JWT_SECRET`（详见上「安全部署清单 · ADR-006」）
- 🟡 `main.html` 仍是 ~5.0k 行单体：ADR-007 已抽出 4 个纯逻辑 ESM（chunk-engine / format / ai-prompts / backup），剩余 DOM/流程层待二次拆分（2026-09-08 已清 ~800 行绞杀者死代码）
- 🟡 联网 AI 详解默认停用（产品决策）：需要时置 `AI_EXPLAIN_ENABLED=true` + `DEEPSEEK_API_KEY`；课程自带讲解不受影响
- 🟡 `oral8000.js` 现为 150 句口语种子（并入 builtin-daily，共 238 句），分批扩展直接在文件内追加
- 🟡 主流程改动后记得跑 `npm run e2e:all`（26 套件 / 含主 UI 回归 97 项，自动按需拉起临时 server）确认无回归；`e2e/` 与 `output/e2e/` 套件均已随版本入库（`.gitignore` 对 `output/` 开白名单，仅忽略运行产物）

> 早期迭代中的问题（同步整块覆盖、AI Key 前端直连、后端零校验、移动端适配弱、核心逻辑无单测等）均已按 architecture-plan 的 Phase A→C 闭环，ADR 清单见上。
