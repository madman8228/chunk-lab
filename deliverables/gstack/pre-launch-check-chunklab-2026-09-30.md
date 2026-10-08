# Chunk Lab 全项目上线前评审报告

**日期**：2026-09-30
**场景**：上线前检查（全项目，非单 PR）
**参与成员**：产品官 + 安全卫士 + 质量门神 + 排障手（4 位全员）
**评审范围**：`D:\06-project\chunk-practice` master 分支，188 项未提交变更（99 modified +4676/-2976 行、135 untracked），对比线上 `41cff00`

---

## 📌 TL;DR（执行摘要）

- **整体结论：🔴 No-Go**（4 位成员一致；安全官给「条件 Go」，但其列出的 B1/B2 同样是硬阻塞）
- **不是"代码没写完"，而是"发了会挂"**：3 位成员独立确认同一条 P0 —— `deploy-prod.sh` 的 FILES 漏了 6 个运行时必需文件，其中 2 个是服务端**顶层 require** 的 `.cjs`，部署后 Express 启动即 `MODULE_NOT_FOUND`，**全站 500**
- **比漏文件更严重的一条**：`e2e/multitab-stale` **6/12 失败** —— 多标签页互相覆盖，A 用旧快照写入后 B 的 deck / 标熟 / 答题计数 / 打卡全部被抹成 0，且负向自证通过 ⇒ 漏洞真实存在，属用户数据静默丢失
- **F-001（静态库泄露）已真正修复**：29 个编码变体 + 线上 8 条路径实测全 403，不是"看提交信息以为修了"
- **下一步**：先清 5 条 P0（约半天），其余按「本次新增 / 上线前既有」分栏处置 —— 后者不当本轮阻塞

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|---|---|
| **Go / No-Go** | 🔴 **No-Go**（阻塞项清零后转条件 Go） |
| **严重度分布** | 🔴 5 / 🟠 11 / 🟡 8 / 🟢 6 |
| **关键行动项** | 12 条（P0 5 条） |
| **测试真实水位** | **154 套件 / 138 通过 / 16 失败**（不再是清单里的 125/125） |
| **建议负责人** | 老板拍板处置顺序；P0 全为工程项，一轮可清 |

### 测试水位明细（实测，非估算）

| 组 | 通过/总数 | 关键失败 |
|---|---|---|
| unit | 64 / 66 | `chunk-shape`（main.html 少 1 处段数闸）、`store.test` 直跑 **13 项失败** |
| server | 22 / 23 | `downstream-delta` B4：`bySentence` 缺 sentence/deckId 反查锚点 |
| checks | 12 / 16 | deploy-safety、check-deploy-files、**SW 硬清单 2092KB**、内容产物缺 4 个 |
| browser | 40 / 49 | **`multitab-stale` 6/12**、stats-idb 3 项、home-today G1、4 个 selector 超时 |

> browser 组在本机可跑，但必须显式设 `CHUNKLAB_CHROME_PATH=/c/Program Files/Google/Chrome/Application/chrome.exe`（`CHROMIUM_PATH` 默认为空，不设则失败）。

---

## 1. 各成员核心结论

### 🔍 产品官（范围与成熟度评审）
- **核心判断**：**No-Go，但约 30 分钟可修完** —— 理由不是"没写完"，而是部署清单漏文件会把线上打挂。
- **范围判定**：**多条并行未收敛的工作线**，不是一个可发布版本。判据：9 份 implementation 文档跨 09-25→09-30 六个日期六个主题，每天开一条新线，**没有一天在收口**；`RELEASE_CHECKLIST.md` 仍写「候选 = `41cff00`／工作树无未提交修改」，与当前 98 个 modified 直接矛盾 ⇒ 这批改动根本还没进发布清单。
- **关键建议**：`content-studio` 的 publish 链路（直写生产课程目录，爆炸半径大）**应拆到下个版本**；删掉 `js/main-lifecycle.js` 死产物（出自同一 entry 但无任何页面加载）。
- **重要澄清**：`learning-engine.js/.cjs`、`mistake-evidence.js/.cjs` **不是双份实现**，是同一 entry 的两种 format 输出（iife 浏览器 / cjs Node），被 build:check 双向 hash 校验 ⇒ **符合「同一事实一份实现」铁律**。真正的治理缺口是 `js/course-enrollment.js` 与 `js/server-store.js` 在 `src/` 下无对应目录、既不生成也不校验。

### 🛡️ 安全卫士（OWASP + STRIDE）
- **核心判断**：**🟠 条件 Go，无 P0 可利用漏洞**。整站鉴权/隔离/注入面做得扎实：全参数化 SQL、`adminOnly` 实名化、条件写强制、未发现鉴权可绕过的路由。
- **F-001 专项结论：已修（9.5/10）**。验证方式不是 grep —— 而是确认执行时机（`server/index.js:376` 守卫排在 `express.static` **之前**）+ 本地跑 29 个变体族全 BLOCK + 线上 8 条路径实测全 403。关键论证：Express 只解码 1 次、守卫解码 4 次到不动点 ⇒ 守卫看到的形式总"等于或更接近磁盘真名"，不可能绕过。
- **关键建议**：`SENSITIVE_PREFIX` 漏了 `/src/` 和根目录 `.json` —— 今天线上全是 404 **仅因它们不在部署清单里**，一旦有人把 `src/` 加进 FILES 立刻变成公网可读源码。这是「清单即 ACL」的脆弱耦合。
- **短板集中在三块**：部署清单完整性、HTTP 安全响应头（**无 CSP / nosniff / X-Frame-Options**，而整站是大量内联脚本的 SPA）、客户端凭据存储（游客账号**明文 `{u,p,base}`** 存 localStorage）。

### ✅ 质量门神（QA 与发布）
- **核心判断**：**No-Go**，3 个硬阻塞：(A) 漏 6 文件致全站挂 (B) SW 硬清单 2092KB (C) 内容产物缺 4 个致 store.test 13 项失败。
- **关键发现**：`check-generated.mjs` **没有 WIP / 脏工作区豁免**（grep 零命中，全程 sha256 逐字节比对）✅ —— 但 `:450` 用了**未声明变量** `mismatches.push(...)`，tsc 佐证 `TS2304`。后果：若 `learning-engine.cjs` 真漂移，该分支既设不上 `exitCode` 也直接抛 ReferenceError ⇒ **这条比对实际没生效，护栏恒绿**。
- **门槛判断**：`node scripts/check-deploy-files.js` **EXIT=1**，而 `deploy-prod.sh` 在 [2/9] 会因它中止 —— 这是 fail-closed 生效（好事），但意味着**现在根本无法完成部署**。
- **关键建议**：回滚目标只能是 `41cff00`（已确认线上跑的就是它，CACHE `chunklab-036175d2`）；**服务端启动迁移是有损的**（mastered/reinforceBook/deletedItems 从 `user_kv` 搬进 `user_entity_rows` 并删原行）⇒ **只回代码会让这三个对象整体消失**，必须靠部署前快照。

### 🔧 排障手（健康检查与代码质量）
- **核心判断**：敏感内容扫描**干净**（无密钥/token/私钥/数据库文件，3 处命中全是测试夹具）；`js/` 产物与 `src/` **当前同步**（build:check exit 0）。
- **关键发现**：**掌握状态有两套并存判定** —— `core.js:3430 isMastered` vs `LearningEngine.resolveLearningState`，而 `main.html` 里 **3457 行用旧判定、4136 行用新判定** ⇒ 同一用户同一句可能给出矛盾结论。`fnv8` 全仓 **17 处定义**，`core.js:3132` 是"找不到就本地兜底"的第二实现。
- **关键建议**：`server/services/data-migrations.js:28/69` 迁移时 blob 解析失败**整行静默跳过**，不计数不告警 → 用户数据搬不走且运维看不见。另建议 `.gitignore` 补 `.impeccable/`、`deliverables/*.mp4`、`mobile-*.png`。
- **提交分组**：给了一套 9 批（C0–C8）的提交顺序，**C0（.gitignore + FILES + check-generated:450）必须先做**，否则后续批次提交后 test 仍红。

---

## 2. 综合审查发现（去重合并，按严重度排序）

### 🔴 P0 —— 本次新增风险，必须清零

| # | 类别 | 位置 | 问题 | 建议 | 来源 |
|---|------|------|------|------|------|
| 1 | **部署/可用性** | `scripts/deploy-prod.sh:33-45` | FILES 漏 `js/learning-engine.js`、`.cjs`、`js/mistake-evidence.js`、`.cjs`、`js/mistake-review.js`。`server/services/data-rows.js:3-4` 是**顶层 require 两个 .cjs 且无 try/catch** ⇒ 服务端启动即 `MODULE_NOT_FOUND`，**全站 500**（不是功能缺失） | 补进 FILES；线上实测这 6 个文件当前全 404 | 产品/安全/QA 三方独立确认 |
| 2 | **部署/可用性** | 根 `content-studio.js` | `content-studio.html:31` 唯一 script，不在 FILES，**且 checker 没扫到它**（`lib-deps.js:45 HTML_ENTRIES` 缺 `content-studio.html`）⇒ 护栏盲区，页面线上白屏 | 补 FILES + 补 HTML_ENTRIES | 产品/安全/QA |
| 3 | **数据安全** | `e2e/multitab-stale` 6/12 失败 | 多标签页互相覆盖：A 用旧快照写入后，B 的新 deck / 标熟档案 / `totalAnswered` / 打卡记录**全部被抹**（实测 `{"deckIds":[],"totalAnswered":0}`），负向自证通过 ⇒ 漏洞真实存在 | 定位 `core-merge.js` / `core-sync-*` 的快照合并语义，先根因再改 | QA |
| 4 | **内容完整性** | `content/oral-basic/` | 缺 4 个产物（`0e39f19054e1`、`78728e26a5d1`、`727282a495ab`、`e8872e7eb41d`）⇒ `check-content-generated` 失败，连带 `store.test` 直跑 **13 项失败** | 重跑 `content:build` 或确认是作废草稿则删除并同步 manifest | QA/排障 |
| 5 | **门禁可信度** | `scripts/check-generated.mjs:450` | 引用**未声明变量** `mismatches`（tsc `TS2304` 佐证）。漂移时不报错而是抛 ReferenceError、且不设 `exitCode` ⇒ **护栏恒绿**，正踩"禁兜底掩盖问题"铁律 | 改 `console.error` + `process.exitCode = 1`（与同文件其他分支一致） | 产品/QA/排障 |
| 6 | **门禁可信度** | `scripts/check-deploy-files.js` | **假阳性**：把 `main.html:4620` 内联 JS 的字符串拼接 `'+ escX(src) +'` 当成 script src。红门里混噪音 ⇒ 团队会学会忽略这道门，且当前 exit 1 会卡死部署 | 修解析器（只解析真实 `<script src="...">` 标签） | 产品/QA |

> 注：1/2 被 `check-deploy-files.js` 在 [2/9] 拦下，属 fail-closed 生效 —— 是好事，但意味着**现在无法完成部署**。

### 🟠 P1 —— 本次新增 / 需本轮决策

| # | 类别 | 位置 | 问题 | 建议 | 来源 |
|---|------|------|------|------|------|
| 7 | 性能/可用性 | `sw.js` PRECACHE | 硬清单 **2092KB > 1.5MB 预算**，`sw-policy.test` 实测失败。SW 是**原子 addAll**，任一 404 整批失败 ⇒ 与 #1 叠加是双杀 | 把 `js/course-authoring.js`（2264 行）等低频资产移入 `PRECACHE_SOFT`，或上调预算并说明理由 | QA/排障 |
| 8 | 一致性 | `core.js:3430` vs `LearningEngine` | **掌握状态两套并存判定**，`main.html` 同页 3457 行用旧、4136 行用新 ⇒ 同一句可能两个结论 | 收口为一套，另一套改为显式委托 | 排障 |
| 9 | 一致性 | `core.js:3132` + 16 处 | `fnv8` 全仓 **17 处定义**，`core.js` 是"找不到就本地兜底"的第二实现 ⇒ cid 一旦漂移，学习进度静默对不上 | 删本地副本，CoreIdentity 缺失即 fail-closed；脚本与测试统一 import 单一源 | 排障 |
| 10 | 数据安全 | `server/services/data-migrations.js:28/69` | 迁移时 stats blob 解析失败**整行静默跳过**，不计数不告警 ⇒ 用户数据搬不走且运维看不见 | 记 `skipped` 计数 + `console.error` | 排障 |
| 11 | 兜底陷阱 | `js/server-store.js:26` | `getBase() \|\| location.origin` —— API 基址没配就退回当前 origin，跨源部署时静默把数据写到错的地方 | fail-closed：取不到就抛 | 排障 |
| 12 | 兜底陷阱 | `core.js:145 saveRevs` | rev 落盘失败静默 ⇒ **冲突检测悄悄退化成 LWW**，用户数据被覆盖且无痕 | 至少 warn + `emit('persistError')` | 排障 |
| 13 | 安全 A08 | `services/content-studio.js:225-247` | `publish()` 原子改写线上 `manifest.json` + `sw.js`，失败回滚**不覆盖已写出的 shard/index**，且**无发布审计日志** | 补 shard 回滚 + 审计日志（actor/revision/courseId/result） | 安全 |
| 14 | 内容/部署 | `content/oral-basic/` 4 个孤儿分片 | deploy 第 35 行整目录 rsync ⇒ **4 个死文件照样上生产** | 确认是作废草稿还是漏登记，提交前清理 | 排障 |
| 15 | 质量 | `main.html` | 少 1 处 `ChunkShape.chunkCountOk` 段数闸（decks.html 有 2 处） | 补回 | QA |
| 16 | 质量 | `npx tsc -p tsconfig.check.json` | **exit 2，16 个错**（`js/learning-engine.cjs` 8、`src/learning/state.mjs` 5、`data-save.js` 2、`check-generated.mjs` 1） | 至少清掉 check-generated 那条 | QA |
| 17 | 治理 | `js/course-enrollment.js`、`js/server-store.js` | 手写源码放在产物目录，`src/` 无对应、不生成不校验 ⇒ 无机制阻止第二份实现出现 | 迁到 `src/` 走 entry 管线 | 产品/排障 |

### 🟡 P2 —— 上线前既有 / 建议同批或延后

| # | 类别 | 位置 | 问题 | 处置建议 | 来源 |
|---|------|------|------|------|------|
| 18 | 安全 A05 | nginx/Express | **无 CSP / X-Content-Type-Options / X-Frame-Options / Referrer-Policy**，整站大量内联脚本 ⇒ 一处 DOM XSS 即可读 localStorage 凭据 | ⚠️ **上线前既有，本次未加剧** → 归入「明确延后」，建议下轮专项；若本轮修，CSP 需从 `script-src 'self'` + nonce 起步，别直接 `unsafe-inline` | 安全 |
| 19 | 安全 A07 | `api.js:44`、`core.js:2771` | JWT 存 localStorage；**静默游客明文 `{u,p,base}`** 存 localStorage | 同上，建议同批修（成本极低）：改存 token 即可重建会话 | 安全/排障 |
| 20 | 安全 A07 | `server/admin.js:59-67` | 管理员单因素口令，仅 5 次/15min/IP 限速，无全局锁定/MFA；bcrypt cost=10、口令下限 8 位 | 下限提 12 位 + cost 12 | 安全 |
| 21 | 安全 A01 | `sw.js:133` | `/admin.html`、`/content-studio.html` 进**硬预缓存** ⇒ 每个访客都下载后台前端源码 | 移出硬清单（`/api/*` 已明确不缓存 ✅） | 安全 |
| 22 | 安全 A07 | `server/auth.js:21` | 用户 JWT TTL 默认 **30 天**，无刷新/吊销 | 缩短 TTL 或加吊销 | 安全 |
| 23 | 安全 A02 | `server/admin.js:19` | `ADMIN_JWT_SECRET` 缺省回落 `JWT_SECRET`，两个信任域共用签名密钥 | 强制互异 | 安全 |
| 24 | 安全 | `static-guard.js:44` | `SENSITIVE_PREFIX` 漏 `/src/` 和根目录 `.json`（含 `ai-course-kit.json` 完整 prompt 资产） | 补进 prefix，或把 kit 改由 `/api` 下发 | 安全 |
| 25 | 一致性 | `srs.js:49` vs `learning-engine.js:161` | 到期判定两套；`home-summary`/`practice-classification` 还有 `() => false` 恒假兜底 ⇒ 注入缺失时今日条目静默变 0 | fail-closed 抛错 | 排障 |
| 26 | 卫生 | 全仓 | CRLF：80+ 文件报 `LF will be replaced by CRLF`；`.gitignore` 缺 `.impeccable/`、`deliverables/*.mp4`、`mobile-*.png` | 补 .gitignore + 确认 .gitattributes | 排障 |
| 27 | 死代码 | `js/main-lifecycle.js` | 出自同一 entry 但**无任何页面加载**，只在旧文档里被描述 | 删除 | 产品 |

### 🟢 已确认 OK（别回退）

| 项 | 结论 |
|---|---|
| **F-001 静态库泄露** | ✅ **已真正修复**：29 变体全 BLOCK + `static-guard.test` 179/179 + 线上 8 条路径全 403 |
| SQL 注入 / IDOR | ✅ 全参数化 SQL；`operations.js` 全链路 `userId` 过滤 + 字段白名单 + 256KB 限额 + requestId 幂等 |
| 未鉴权端点 | ✅ 仅 7 个设计内匿名端点（config/health/stats、注册登录、admin login、feedback、公开题库），其余全过 `authenticate` 或 `adminOnly` |
| 权限提升 | ✅ 未发现。admin token 无 `uid` 不能当用户 token，用户 token 无 `role` 不能当 admin token |
| XSS 转义 | ✅ 新增的 `content-studio.js`、`js/course-authoring.js` 统一用 `esc()` 完整转义 `& < > " '` |
| 敏感内容 | ✅ 135 个 untracked 文件扫描干净，3 处命中全是测试夹具 |
| 构建产物同步 | ✅ `build:check` exit 0，`src/` 与 `js/` 一致，无 WIP 豁免 |
| SW hash 幂等 | ✅ 连跑 3 次 `gen-sw` 均得 `chunklab-884fd127` |
| 测试登记 | ✅ `test-manifest.cjs` 自动 walk 发现，新增 23 个测试全纳入，无"写了没跑" |
| 已有正确做法 | ✅ `core.js:897` 配额失败用户可见、`core.js:1452` 缺失即拒写（fail-closed）、`core.js:74` 加载期可见失败态 |

---

## 3. 门槛与达标表（按项目发布纪律）

**门槛**：`check-deploy-files` exit 0 + `npm test` 四组全绿 + `build:check` exit 0 + `check-content-generated` exit 0 + 线上 6 个新文件全 200 + `/api/health` 200。

| 门槛项 | 当前 | 达标值 | 未达标原因 |
|---|---|---|---|
| `check-deploy-files` | **exit 1** | exit 0 | FILES 漏 6 文件（#1/#2） |
| `npm test` unit | **64/66** | 66/66 | chunk-shape 段数闸、store.test 13 项（#15/#4） |
| `npm test` server | **22/23** | 23/23 | downstream-delta B4 反查锚点 |
| `npm test` checks | **12/16** | 16/16 | deploy-safety / check-deploy / SW 2092KB / 内容缺 4 个（#7/#4） |
| `npm test` browser | **40/49** | 49/49 | **multitab-stale 6 项**（#3）+ stats-idb 3 项 + 4 个 selector 超时 |
| `build:check` | exit 0 ✅ | exit 0 | —（但护栏 #450 是坏的，#5） |
| `check-content-generated` | **失败** | exit 0 | 缺 4 个 oral-basic 产物（#4） |
| `typecheck` | **exit 2 / 16 错** | exit 0 | `learning-engine.cjs` 8 + `state.mjs` 5 + `data-save` 2 + `check-generated` 1 |

**唯一最严重的未达标项**：#3 `multitab-stale`（用户数据静默丢失）—— 因为 #1 只是"发不出去"，而 #3 是"发出去会丢用户数据"。

**该谁做**：#1/#2/#4/#5/#6/#7/#15 是纯工程项（改 FILES / 重跑 build / 修脚本），任一位工程师一轮可清；#3 需先做根因定位（`core-merge.js` 快照合并语义），建议由熟悉同步链路的人做；#18–#24 的安全项需老板拍板是否本轮带。

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 备注 |
|---|------|--------|--------|------|
| 1 | FILES 补 6 个文件：`js/learning-engine.js/.cjs`、`js/mistake-evidence.js/.cjs`、`js/mistake-review.js`、`content-studio.js` | 工程 | **P0** | 不做则服务端起不来，全站 500 |
| 2 | `lib-deps.js:45 HTML_ENTRIES` 补 `content-studio.html`（消除护栏盲区） | 工程 | **P0** | 否则 #2 下次还会漏 |
| 3 | 定位并修 `multitab-stale` 6 项（多标签页覆盖） | 工程 | **P0** | 用户数据静默丢失，先给根因再改 |
| 4 | 补回 4 个 `content/oral-basic/*` 产物（或确认为废稿则删 + 同步 manifest） | 工程 | **P0** | 连带 store.test 13 项 |
| 5 | 修 `check-generated.mjs:450` 未声明 `mismatches`（护栏恒绿） | 工程 | **P0** | 正踩"禁兜底"铁律 |
| 6 | 修 `check-deploy-files.js` 的 `src="` 假阳性正则 | 工程 | P1 | 否则这道门不可信且卡死部署 |
| 7 | SW 硬清单 2092KB 压回 <1.5MB（低频资产移 `PRECACHE_SOFT`） | 工程 | P1 | SW 原子 addAll，与漏文件叠加是双杀 |
| 8 | `main.html` 补回第 2 处 `ChunkShape.chunkCountOk` | 工程 | P1 | |
| 9 | 掌握状态两套判定收口（`core.js:3430` vs `LearningEngine`） | 工程 | P1 | 治理项，但不能再拖 |
| 10 | `RELEASE_CHECKLIST.md` 重写「最新执行状态」段：候选改为本批，登记 6 个新 e2e + content-studio/operations 两个新服务 | 工程 | P1 | 现状与 98 个 modified 直接矛盾 |
| 11 | **老板拍板**：安全项 #18–#24 是否本轮带（CSP/响应头、游客明文凭据、admin 口令强度、SW 预缓存后台页） | 老板 | P1 | 均非本次新增，按纪律**默认归「明确延后」** |
| 12 | 提交按排障手给的 C0→C8 九批顺序走，**C0 必须先做** | 工程 | P1 | 否则后续批次提交后 test 仍红 |

---

## 📦 发布检查清单（可执行）

**发布前**
```bash
cd /d/06-project/chunk-practice
node scripts/run-tests.cjs unit server checks          # 期望 0 失败（现 6 项）
CHUNKLAB_CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe" \
  node scripts/run-tests.cjs browser                   # ~9.5min，期望 0 失败（现 9 套件失败）
node scripts/check-generated.mjs && echo BUILD_OK      # 现 exit 0，但护栏 #450 是坏的
npx tsc -p tsconfig.check.json; echo "tsc=$?"          # 现 exit 2 / 16 错
node scripts/check-deploy-files.js && echo FILES_OK    # 现 exit 1 ← 硬阻塞
node scripts/gen-sw.js && grep -o 'chunklab-[0-9a-f]*' sw.js | head -1
git status --short                                     # 必须干净后再发
bash scripts/deploy-prod.sh ubuntu@82.157.125.225
```

**发布后**
```bash
curl -s https://chunklab.jqka.top/sw.js | grep -o 'chunklab-[0-9a-f]*' | head -1   # == 本地 CACHE
for f in js/learning-engine.js js/learning-engine.cjs js/mistake-evidence.cjs \
         js/mistake-review.js content-studio.js content-studio.html; do
  printf "%-32s %s\n" "$f" "$(curl -s -o /dev/null -w '%{http_code}' https://chunklab.jqka.top/$f)"
done                                                    # 全部 200，404 即漏发
curl -s https://chunklab.jqka.top/api/health
ssh ubuntu@82.157.125.225 "sudo journalctl -u chunklab --since '-5 min' --no-pager | grep -iE 'MODULE_NOT_FOUND|迁移完成|Error'"
bash scripts/deploy-security-smoke.sh https://chunklab.jqka.top
```

**监控观察项（最早暴露问题）**：① `journalctl -u chunklab` 的 `MODULE_NOT_FOUND`（秒级）；② `/api/health` 与根路由 302；③ 上述 6 个新文件 HTTP 码；④ SW CACHE 是否等于本地值（不等 = 用户拿旧页面）；⑤ 首页 `.home-deck-progress` 与「已掌握」计数（对应 e2e 两个失败）；⑥ nginx access log 5xx 比例。

---

## 🔄 回滚预案

- **回滚目标**：`41cff00` —— 已确认线上跑的就是它（线上 CACHE `chunklab-036175d2` 与提交值吻合）。**不要回滚到 `09553df`**（它带着 `a94c0fec` 的 SW 和本批 188 项变更）。
- **代码**：`git revert` 本批提交 → **必须重跑 `node scripts/gen-sw.js`**（否则客户端 SW 版本不变，回滚的静态文件被旧缓存挡住）→ 再跑 `deploy-prod.sh`。
- **DB（关键）**：服务端启动迁移是**有损**的 —— 把 mastered / reinforceBook / deletedItems 从 `user_kv` blob 搬进 `user_entity_rows` 并**删原行**。⇒ **只回代码会让这三个对象整体消失**。退路只有部署前 [3/9] 打的快照：
  ```bash
  ssh ubuntu@82.157.125.225 "cd /opt/chunklab && node server/backup-db.js list"
  ```
  停服 → 用快照覆盖主库（`CHUNKLAB_DATA_DIR` 下的 `chunklab.db`，连同 `-wal`/`-shm` 一起处理）→ 启服。**不要依赖凌晨 3:20 的 cron 备份（最长 17h 空窗）**。
- **判定回滚成功的信号**：`/api/health` 200 + 根路由 302 + SW CACHE == `chunklab-036175d2` + 一个老账号的 mastered/打卡数据仍在。

---

## 👤 人工回归 Top5（自动测试替代不了）

1. **多标签页互相覆盖**：开两个窗口，A/B 分别加 deck，A 用旧快照写入后看 B 的数据是否还在（对应 `multitab-stale` 6 项失败）。
2. **IndexedDB 升级路径**：用**真实老版本浏览器 profile** 升级一次（v4→v5 实测得到 version=6，且旧统计行 sentence 被剥离），别只用新 profile。
3. **首页进度口径**：`09553df` 把课程卡进度改成课节口径后，「已掌握」实测为 0（应为 5），且 `.home-deck-progress` 在 2 个 e2e 里 waitForSelector 超时 ⇒ 首页进度块可能根本不渲染。手动打开首页核对。
4. **服务端启动 + 行级迁移**：`.cjs` 漏发会直接起不来；起来后 `迁移完成：N 条 kv → ...` 的 N 必须与用户数/标熟量级对得上，迁移后立刻抽查一个老账号的 mastered/reinforceBook/deletedItems。
5. **课程学习链路**：走一遍「导入图文课程 → 选课节 → 设定练习方式 → 练 → 看错题回顾」（练习方式选择器不显示课程默认值、`.course-manage-trigger` 点不到）。

---

## ⚠️ 待完善 / 已知局限

- **未执行**：真机验收（G4）、生产双账号互不可读写（G2）、发布授权（G5）—— 沿用 `RELEASE_CHECKLIST.md` 里已登记的三条生产侧阻塞，**本次评审不重复计入**。
- **本次评审严格只读**，但成员跑只读命令产生了两处副作用，请知悉：① 工作区 `sw.js` 由 `chunklab-3cd40aad` 重算为 `chunklab-884fd127`（原值本就是过期的，属修正）；② `server/backups/chunklab_db_20260930_104150.db`（103MB）由 `node server/backup-db.js` 生成 —— 已被 `server/.gitignore:3 *.db` 覆盖，**不会误进版本库**。
- **未验证**：`core.js` 兜底 `mergeBest` 与 `CoreMerge.best` 是否有 drift 测试（未逐行对比算法）；`content-studio.publish` 是否有二次确认/回滚（只看路由与挂载）；`multitab-stale` 失败的**根因**尚未定位（只确认现象 + 负向自证通过）。
- **`check-deploy-files.js` 结构盲区**：测试在本地静态服务跑，**不会复现 FILES 漏传** ⇒ 门禁全绿也照样漏（本次正是如此）。建议加一条「解析 FILES ∩ 网页 script」的断言（现成 checker 已有，只是被假阳性噪音淹了）。
- **CRLF**：80+ 文件报 `LF will be replaced by CRLF`，提交时会触发整批行尾归一化，可能污染 diff 审阅 —— 建议提交前确认 `.gitattributes`。

---

## 📚 成员产出索引

- **gstack-product-reviewer（产品官）**：范围收敛性判定（多条未收敛工作线）、13 个新模块成熟度分级表、双实现核查澄清、入口与文档一致性
- **gstack-security-officer（安全卫士）**：STRIDE 六维、14 条安全发现（B1–B14）、F-001 专项双重验证、未鉴权端点完整清单（7 个）
- **gstack-qa-lead（质量门神）**：154 套件实测水位、构建产物一致性、SW hash 幂等性、部署完整性交叉比对、发布检查清单 + 回滚预案 + 回归 Top5
- **gstack-investigator（排障手）**：9 批提交分组建议、敏感内容扫描、构建产物漂移映射表、静默失败清单（15 处）、重复实现计数（fnv8 17 处 / 掌握状态 2 套）、孤儿文件清单

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
