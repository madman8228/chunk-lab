# Chunk Lab 第二轮全项目上线前评审报告

**日期**：2026-10-05
**场景**：上线前检查（全项目，第二轮）
**参与成员**：安全卫士 + 产品官 + 排障手（3 位已回传）；质量门神（QA）测试水位待补
**对比基线**：上一轮 2026-09-30 评审（结论 No-Go，5 条 P0）
**评审范围**：`D:\06-project\chunk-practice` master，工作区 627 项未提交变更（353 files changed, +16369 / -121211）

---

## 📌 TL;DR（执行摘要）

- **整体结论：🟠 条件 Go**（上一轮是 🔴 No-Go，明显好转）
- **上一轮的 5 条 P0 有 4 条已消解**，且是读码核实到执行时机，不是看提交信息
- **但换来了两条全新的硬阻塞**，都与"能不能安全发布/回滚"有关，而非功能缺陷：
  1. 🔴 **`deploy-prod.sh:130` 的 [6/9] 断言必然失败** → 部署脚本根本跑不完
  2. 🟠 **41 个已在部署清单里的文件零 git 基线** → 回滚预案目前不成立
- **上一轮最大的不确定性已排除**：内容 136 个分片全量重生成**不会丢用户进度**（cid 冻结机制起作用）
- **下一步**：清 4 条阻塞（约 1-2 小时），其中"41 个文件先建一个 commit"是零成本但必须先做的

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|---|---|
| **Go / No-Go** | 🟠 **条件 Go**（清 4 条阻塞后 Go） |
| **严重度分布** | 🔴 1 / 🟠 6 / 🟡 7 / 🟢 8 |
| **关键行动项** | 11 条（🔴 1 条、🟠 4 条） |
| **测试水位** | unit **103/103** ✅ ｜ server **75/75** ✅ ｜ checks **26/28** ⚠️ ｜ browser ⏳ 未跑 |
| **建议负责人** | 老板拍板 #1（41 文件入库）+ #5（content-studio 上/摘）；其余为工程项 |

---

## 1. 各成员核心结论

### 🛡️ 安全卫士（OWASP + STRIDE）
- **核心判断**：**条件 Go，本轮安全面无 P0**。唯一"硬阻塞"是部署脚本自身跑不完，不是安全漏洞。
- **F-001 专项：仍然已修 · PASS**（真验，非抄上一轮结论）。三重证据：① 执行时机 `server/index.js:455` 守卫仍在 `:465 express.static` **之前**；② 本地 25 个编码变体直调守卫全 BLOCK + `static-guard.test` **179/179**；③ 线上 11 条路径只读探测**全 403**。
- **新发现 🔴**：`scripts/deploy-prod.sh:130` 的 [6/9] 断言 `grep -q "redirect('/main.html')" server/index.js`，但该 redirect 已删除（`server/index.js:456-458`，合并落地页后 root 改由 `express.static` 托管 `index.html`）→ **`set -euo pipefail` 下部署必在 [6/9] 中止**。好消息：中止点在 [7/9] 落盘之前，**不会半部署**。
- **新增面审计通过**：9 条 `/api/recovery/*`（首次上线）全部 `auth.authenticate`、SQL 按 `user_id=? AND source_id=?` 作用域 → **无 IDOR/越权下载他人备份**；sourceId 白名单；apply 需 sourceHash+previewToken+expectedSeq 三要素。备份链路三模块职责不重叠、无重复鉴权口径；`redactPrivateSettings()` 已把 `settings.apiKey` 置空。
- **关键建议**：确认生产 DB 已建 `user_recovery_sources` / `_uploads` / `_chunks` 三表（否则新 recovery 路由 500）；`/api/feedback` 被全局 80MiB body limit 覆盖，建议前置小 limit。

### 🔍 产品官（范围与成熟度）
- **核心判断**：**条件 Go，在收口但没彻底收口**。`main.html` +2092 的大头是把单体拆成 ~20 个具名模块（ADR-007 单体拆解），测试 +8876/-6001 是健康增量，**没有开恶线**。09-30 后新增 4 篇文档是"持久化失败 → 冲突切换 → badge 运行时诊断 → badge 真机复检"一条往下钻根因的链路。
- **新发现 🟠**：**41 个已部署文件零 git 基线**（FILES 156 条目 / 去重 155 / untracked 唯一文件 **41** 个）。`git log --all --oneline -- <file>` 对这些文件**全部返回空** ⇒ 不是"没合进 master"，是**在任何分支/标签/reflog 里都不存在**。
- **🔴 发布判定入口脱节**：`RELEASE_CHECKLIST.md` 头部仍写「候选 = `master@41cff00`」「工作树无已跟踪文件的未提交修改」，而实际 HEAD=`09553df` + 627 项变更。本次 +46/−20 行改动里**没有任何 09-23 之后的日期**。
- **🔴 死产物未处置**：`js/main-lifecycle.js`（498 行）上轮已判死产物，**仍在 FILES**，且有个隐蔽陷阱 —— `scripts/main-lifecycle.test.mjs` 测的是 `src/main/*.mjs` 源码、**不是这个产物** ⇒ 测试全绿给的是假安全感。
- **备份/恢复线澄清**：`js/backup.mjs`（全量导出导入）、`js/legacy-backup.js`（无归属旧数据只读打包下载）、`js/legacy-restore.js`（合并预览与应用）是**一条流水线的三段，不是三份重复实现**，调用关系单向。用户侧**只有 1 个入口**（`main.html:1791-1811` 的"数据备份"折叠区），不冲突。

### 🔧 排障手（健康检查）
- **🟢 最重要的一条：内容重生成不会让老用户进度失配。** 66 个 deckId **全不变**、3677 句 cid 集合**逐 deck 完全一致** ⇒ `deckId#cid` 进度 key 全部命中，**无迁移需要**。
  - 根因：`cid` 是生成时**冻结写入**的字段，`cidOf()` 只在 `item.cid` 缺失时才回落 `fnv8(sentence)`。
  - 文件名 hash 全变是因为 `scripts/build-content.mjs:37` 用**纯内容 sha256**（无时间戳）⇒ 内容确实改了。抽样 94 句中 26 句有改动，多为译文/提示修订，**英文正文只改 6 句**（3 个 typo 修复 + 3 个标点规范化）。
  - **SW 无风险**：`content/` 分片**不在**硬预缓存（PRECACHE 里 `oral-001-` 出现 0 次），157 条预缓存**本地逐条存在、0 缺失** ⇒ 重命名不会导致 `addAll` 失败。
- **P0 回归（读码核实）**：`e2e/multitab-stale` **已修**（置信 9）—— `core.js:465-489` 三路合并 + `:918-943` 每次写 localStorage 前比对 `diskRaw !== baseRaw`；合并失败会 `emit('persistError')` 并**跳过落盘**，绝不拿旧内存态覆盖。`check-generated.mjs` 的 `mismatches` **已消解**（全仓零命中）。
- **新发现 🟠**：`js/logical-course-store.js:23` `catch (error) { return []; }` 静默吞异常（本次新增文件）；且 `read()` 的 `filter(item => item.id && item.title)` 会**静默丢弃**不合法条目 ⇒ 读失败/字段变化都会在下次 `write()` 时把残缺结果写回，**用户自建逻辑课程静默全丢**。
- **🟠 `lib-deps.js:45 HTML_ENTRIES` 仍是 6 个**，实际根目录有 9 个 html ⇒ 漏 `content-studio.html` / `diagnose.html` / `index.html` ⇒ 这些入口的资源**既不进 SW 预缓存、也不被部署校验覆盖**（`content-studio.html` 是本次新增，属本次加剧）。
- **敏感扫描干净** 🟢：627 个文件全量扫，39 处命中全是字段名或测试夹具（唯一 `sk-` 是 `e2e/e2e.js:1540` 的假值夹具），无真实密钥。内容孤儿 **0**（136 引用 / 136 实际 / 断链 0）。

---

## 2. 综合审查发现（去重合并，按严重度排序）

### 🔴 P0 —— 本次新增，必须清零

| # | 类别 | 位置 | 问题 | 建议 | 来源 |
|---|------|------|------|------|------|
| 1 | **部署/可用性** | `scripts/deploy-prod.sh:130` | [6/9] 断言 `grep -q "redirect('/main.html')" server/index.js`，该 redirect 已被删除 ⇒ **部署必然在 [6/9] 中止**（主理人实测该 grep exit=1） | 改断言（断言 `express.static` 存在或 landing 契约），**不要改 index.js** | 安全卫士 + 主理人复核 |
| **1b** | **部署/可用性** | `deploy-prod.sh:151-153` + FILES | **根路由改造后部署脚本两处未同步**：`server/index.js:456-465` 已删除 `/ → /main.html` 的 302、改由 `express.static` 托管 `index.html`，但 ① FILES **未含 `index.html`**，也未含其 3 个真实脚本依赖 `landing/deck.js` / `landing/phrases.js` / `landing/store.js`（三个文件磁盘上确实存在）；② 部署后冒烟仍**硬断言 `test "$ROOT_CODE" = 302`**，而根路由现在会返回 200 ⇒ **即便补传 index.html，部署仍会在最后一步失败** | 补 FILES 三条 + 把冒烟断言改成接受 200 或断言 landing 契约（与 #1 一起改） | 质量门神 + 主理人复核 |

### 🟠 P1 —— 本次新增，应本轮清

| # | 类别 | 位置 | 问题 | 建议 | 来源 |
|---|------|------|------|------|------|
| 2 | **可回滚性** | 41 个 FILES 文件 | 零 git 基线（任何分支/标签/reflog 都不存在）⇒ **`git revert` 回不了任何版本**；且 [7/9] 是 `sudo cp -r "$STAGE"/. "$APP"/` **原地覆盖、不留旧版**。数据层有 [3/9] 快照兜底 ✅，代码层 27% 的 FILES（含全部新增服务端路由/服务）**没有可回的已知版本** ❌ | 上线前 `git add` 并单独立一个 commit（零成本） | 产品官 + 安全卫士 + 主理人复核 |
| 3 | **数据丢失** | `js/logical-course-store.js:23` + `:22` filter | `catch { return [] }` 无日志 + filter 静默丢弃缺 id/title 条目 ⇒ 读失败/字段变化后 `write()` 把残缺结果写回，**逻辑课程静默全丢**（主理人已读码确认属实） | 改 fail-closed：读失败抛错或提示用户，不要用 `[]` 兜底 | 排障手 + 主理人复核 |
| 4 | **护栏盲区** | `scripts/lib-deps.js:45` | `HTML_ENTRIES` 仍 6 个（实际 9 个 html）⇒ 漏 `content-studio.html`/`diagnose.html`/`index.html` ⇒ 不进 SW 预缓存、不被部署校验覆盖。`content-studio.html` 是本次新增 ⇒ **本次加剧** | 补 3 个入口 | 排障手 |
| 5 | **发布入口** | `RELEASE_CHECKLIST.md` | 仍写「候选 = `master@41cff00`」「工作树无未提交修改」，与实际（HEAD=`09553df`、627 项变更）矛盾；本次改动无任何 09-23 后日期 | 重写头部：真实 commit + `git status` 实测口径 + 登记备份线与单体拆解 | 产品官 |

### 🟡 P2 —— 需决策或建议同批

| # | 类别 | 位置 | 问题 | 建议 | 来源 |
|---|------|------|------|------|------|
| 6 | 部署意图 | `index.html`（71KB，untracked） | 落地页**不在 FILES**，且线上 nginx 实测 `/` → 302 `/main.html` ⇒ **上线也不可达** | 二选一：入 FILES + 改 nginx，或明确不上线 | 安全卫士 |
| 7 | 可用性 | `server/routes/recovery.js` 等 | 全新的 9 条 `/api/recovery/*` 首次上线，需 prod DB 已建 `user_recovery_sources`/`_uploads`/`_chunks` 三表 | 上线前确认建表，否则 500 | 安全卫士 |
| 8 | 死代码 | `js/main-lifecycle.js`（498 行） | 上轮已判死产物**未处置**，仍在 FILES；且 `scripts/main-lifecycle.test.mjs` 测的是 `src/main/*.mjs` **不是这个产物** ⇒ 假绿 | 删文件 + 删 FILES 条目，或补真实入口 | 产品官 |
| 9 | 一致性 | 6 句文本 + e2e 内联 fnv8 | 6 句在冻结 cid 下文本漂移（3 typo 修复 + 3 标点）；e2e 有 ≥8 份内联 `fnv8` 副本 ⇒ 测试自证而非守护 | 测试改用单一 `cidOf()` | 排障手 |
| 10 | DoS 面 | `server/index.js:91` | 全局 `express.json({limit: 80MiB})` 也覆盖**未鉴权**的 `POST /api/feedback` ⇒ body-parser 会先完整解析 80MB | `/api/feedback` 前置小 limit（如 8MB） | 安全卫士 |
| 11 | blast radius | `js/legacy-restore.js` | 会 `location.reload()` + pointer 切换整个命名空间，并按 CLOUD-HOLD 主动暂停同步 ⇒ 用户看到"同步暂未启用"黄条 | 建议灰度或保留开关；老板确认文案与"核对云端版本"出口可接受 | 产品官 |
| 12 | 治理 | `js/core-sync-batch-merge.js:180` | 合并后 `revs: cloneJSON(lr)` **整体取本地 rev 表**，远端独有 rev 条目会丢 | 登记，非阻塞 | 排障手 |
| 13 | 卫生 | `.gitignore` | 未覆盖 `.impeccable/`（17K）、`deliverables/*.mp4`（1.1MB）、`deliverables/promo/` | 补 .gitignore | 排障手 |
| 14 | 缓存 | `courses.html:466` | 硬编码 cache-bust `?v=013575e0efc3`，改文件不换 hash 有陈旧缓存风险 | 延后 | 产品官 |
| 15 | **可用性** | `server/services/content-studio.js:28-31` + FILES | publish 前会校验 `scripts/sw-hash.js` 存在，不存在即 `throw`。但 `scripts/` **整体不部署**（`grep -c "sw-hash" deploy-prod.sh` = 0）⇒ **若上线单元 B，点"发布"就抛错** | 上线 B 则必须把 `scripts/sw-hash.js` 加进 FILES 并确认目标机有该目录；否则推迟 B | 安全卫士（B-11） |
| 16 | 安全（延后） | `content-studio.js:44` / `:236` | publish 会原子重写线上 `sw.js` 与 `content/manifest.json` ⇒ **admin 凭据失守 = 可向全体用户持久化投递任意前端代码**（前端供应链投毒）。但需 admin 权限，而"admin 单因素"是上一轮已延后项 ⇒ 本条是那个延后项的**放大器**，不是新漏洞；服务端侧已核：全 `adminOnly`、shardUrl 无穿越、`writeAtomic`、manifest 失败回滚、`MAX_COURSE_ITEMS=10000` | 与 admin 单因素一起延后（建议将来给 admin 加二次校验，或把 sw.js 发布改成只写 DB 不落盘） | 安全卫士（B-12） |

### ✅ 已裁定的取舍：本轮新增入口拆成**两个独立单元**，A 必上、B 可选

产品官与安全官一度把 `course-create.html` + `ai-course-kit.json` + `content-studio.html` 当成同一个原子包（"一起上，不摘"）。**该判断已更正** —— 二者是**两条独立链路**，不存在运行时依赖：

| 单元 | 组成 | 判定 |
|---|---|---|
| **A · 课程作者页闭环** | `course-create.html`、`ai-course-kit.json`、`js/course-authoring.js`、`js/course-capabilities.js`、`js/course-learning-launch.js` | 🔴 **必须整体上线，缺一即坏** |
| **B · AI 内容工作台** | `content-studio.html`、`content-studio.js`、`server/routes/content-studio.js`、`server/services/content-studio.js`、`admin.html:42` 链接 | 🟡 **可整体推迟**（与 A 无运行时依赖） |

**为什么 A 不能摘**：`ai-course-kit.json` **本就设计为公开下载** —— `js/course-authoring.js:547` 有 `<a href="ai-course-kit.json" download>`，是作者页的**功能按钮**，不是"误放上网的内幕资产"（安全官据此把 B-10 由 🟠 降 🟢，移入延后栏）。摘 A 会让「新建课程」页永久缺功能。

**为什么 B 当前状态必须二选一**：`content-studio.html` **已在 FILES** 但 `content-studio.js` **不在**（主理人实测）⇒ 现状是"半上"，上线即**白屏**。所以 B 只有两种合法形态：
- **补齐**：把 `content-studio.js` 加进 FILES（另三个 server 文件已在 FILES，无需动）
- **摘除**：同时摘 `content-studio.html` + `admin.html:42` 链接 + 服务端两个文件

⚠️ **不要留"上了页面、没上脚本"或"摘了页面、留着链接"的中间态。**

🟢 **线上目前无死链**：`41cff00` 里这 10 个文件全部不存在，线上 `admin.html` 也没有该链接 ⇒ 推迟 B **不会**在线上产生死链。推迟 B 的代价只是「AI 生成课包后无法从管理台入库」，属功能缺失而非故障。

### 🟢 已确认 OK（别回退）

| 项 | 结论 |
|---|---|
| **F-001 静态库泄露** | ✅ **仍然已修**：守卫位置正确 + 25 变体全 BLOCK + `static-guard.test` 179/179 + 线上 11 条路径全 403 |
| **内容重生成的进度兼容性** | ✅ **无失配**：66 deckId 全不变、3677 句 cid 集合逐 deck 一致、无需迁移 |
| **`e2e/multitab-stale`** | ✅ **已修**：三路合并 + 写前比对 + 失败 `emit('persistError')` 跳过落盘（符合禁兜底铁律） |
| **`check-generated.mjs` mismatches** | ✅ **已消解**（全仓零命中） |
| **content 孤儿/断链** | ✅ 136 引用 / 136 实际 / 断链 0 / 孤儿 0 |
| **敏感内容** | ✅ 627 文件全扫，39 处命中全是字段名或测试夹具，无真实密钥 |
| **备份/恢复三模块** | ✅ 职责不重叠（一条流水线三段），用户侧只有 1 个入口，无冲突 |
| **SW 预缓存完整性** | ✅ 157 条本地逐条存在、0 缺失；`content/` 分片不在硬预缓存 ⇒ 重命名不影响 `addAll` |
| **SQL 注入 / IDOR** | ✅ 全参数化；recovery 全按 `user_id + source_id` 作用域；公开 deck 有 `is_public=1 AND deleted_at IS NULL` 过滤 |
| **course-package 导入** | ✅ manifest + JSON Schema 双校验、`isSafePath` 挡穿越、100MiB/300MiB/50MiB 分层上限、渲染全经 `esc()` |
| **sync 条件写** | ✅ `STRICT_CONDITIONAL_WRITES` 未被绕过，强制 `baseSeq`+`requestId` |
| **备份链路鉴权** | ✅ `/api/export`、`/api/import` 均鉴权且按 token 取自己数据；`backup-cli.js` 文件名程序生成无穿越；restore 强制归属校验 |

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 说明 |
|---|------|--------|--------|------|
| 1 | 修 `scripts/deploy-prod.sh:130` 的 `redirect('/main.html')` 断言（改断言，不改 index.js） | 工程 | **🔴 P0** | 不修则部署在 [6/9] 中止，根本发不出去 |
| 2 | 41 个零基线文件 `git add` + 单独立一个 commit | 工程 | **🟠 P0** | 零成本，但**没有它回滚预案不成立** |
| 3 | 修 `js/logical-course-store.js:23` + `:22` filter 的静默兜底（改 fail-closed） | 工程 | **🟠 P0** | 否则用户自建逻辑课程可能静默全丢 |
| 4 | `scripts/lib-deps.js:45 HTML_ENTRIES` 补 `content-studio.html` / `diagnose.html` / `index.html` | 工程 | **🟠 P0** | 消除护栏盲区（本次加剧项） |
| 5 | 重写 `RELEASE_CHECKLIST.md` 头部：真实 commit + `git status` 实测口径 | 工程 | **🟠 P0** | 发布判定入口不能描述另一个世界 |
| 6 | 确认 prod DB 已建 `user_recovery_sources` / `_uploads` / `_chunks` 三表 | 运维 | 🟡 P1 | 否则 9 条新 recovery 路由 500 |
| 7 | 处置 `js/main-lifecycle.js`（删文件 + 删 FILES 条目，或补真实入口） | 工程 | 🟡 P1 | 死产物 + 测试假绿 |
| 8 | `.gitignore` 补 `.impeccable/`、`deliverables/*.mp4`、`deliverables/promo/` | 工程 | 🟡 P1 | |
| 9 | `/api/feedback` 前置小 body limit（如 8MB） | 工程 | 🟡 P1 | 匿名 80MiB 内存放大面 |
| 10 | **老板拍板**：`js/legacy-restore.js` 是否灰度/加开关（它会 reload + 切换命名空间 + 暂停同步，用户会看到"同步暂未启用"黄条） | 老板 | 🟡 P1 | blast radius 是整个学习档案 |
| 11 | 提交按排障手建议分 6 批：**内容重生成 → 新增 js 模块 + sw.js → 入口 HTML → server services → 测试 → 文档** | 工程 | 🟡 P1 | 内容先行，便于出问题单独 revert |

---

## 3. 上一轮 5 条 P0 的回归结果（关键，避免旧账重复计数）

| # | 上轮 P0 | 本轮状态 | 验证方式 |
|---|---|---|---|
| 1 | FILES 漏 6 个文件（`learning-engine.js/.cjs`、`mistake-evidence.js/.cjs`、`mistake-review.js`、`content-studio.js`） | ⚠️ **部分修（5/6）**：前 5 个已进 FILES（`deploy-prod.sh:48-49`）；**`content-studio.js` 仍未进**，而 `content-studio.html` 已进 ⇒ 页面上线、脚本 404 = **白屏** | 主理人解析 FILES 全文实测确认（推翻本报告初稿"已全部补齐"的结论） |
| 2 | `lib-deps.js:45 HTML_ENTRIES` 不含 `content-studio.html` | ❌ **未修**，且现在漏 3 个（`content-studio.html`/`diagnose.html`/`index.html`） | 排障手读码确认仍是 6 个 |
| 3 | `e2e/multitab-stale` 6/12 失败（多标签页互相覆盖） | ✅ **已修**（置信 9） | 排障手读码到执行时机：`core.js:918-943` 写前比对 + 失败跳过落盘 |
| 4 | `content/oral-basic/` 缺 4 个产物 | ✅ **已消解**（随 136 分片整体重生成） | 排障手确认内容 136/136 自洽、孤儿 0 |
| 5 | `check-generated.mjs:450` 引用未声明 `mismatches` | ✅ **已消解**（全仓零命中） | 排障手 grep 确认 |

> 另有两条上轮项：SW 硬清单 2092KB > 1.5MB、check-deploy-files 假阳性 —— **待 QA 实测确认**。

---

## 4. 本轮测试水位（QA 实测）

| 组 | 本轮 | 上一轮（09-30） | 变化 |
|---|---|---|---|
| **unit** | **103 / 103 全绿** | 64 / 66 | ✅ +39 项，失败清零 |
| **server** | **75 / 75 全绿** | 22 / 23 | ✅ +53 项，失败清零 |
| **checks** | **26 / 28**（2 失败） | 12 / 16 | ⚠️ 改善但仍有 2 项失败 |
| **browser (e2e)** | ⏳ **未跑**（本机缺 `CHROME_PATH`） | 40 / 49 | ❓ 未验证 |

**checks 组 2 项失败（原始错误行）**：

1. `scripts/deploy-prod.sh` 相关：`✗ 游客未登录进首页` —— 期望 `index.html` / 静态首页 / landing 入口，**但 FILES 与 `sw.js` 硬清单都没有 `index.html`**。这与 §2 的 **#1b 根路由阻塞**是同一根因的两处表现。
2. `scripts/sw-policy.test.js`：`expect(received).toBe(expected)` —— rootUrl 期望 `null` 或 `http://127.0.0.1:8787/`，**实际 `http://127.0.0.1:8787/main.html`**。同样是根路由改造未同步。

**⚠️ `check-deploy-files.js` 当前是假绿**：QA 实跑 exit=0，但那是因为 `index.html` 不在 `HTML_ENTRIES`（仍是 6 个），它**根本不检查这个入口**。所以"部署清单校验通过"这个信号现在不可信 —— 真正的漏发（#1b、#15）要靠人工比对 FILES 才能发现。

**⚠️ 另一个假绿**：部署守卫里有一条 `FIREFOX 前提`（`bash scripts/deploy-security-smoke.sh` 与 `firefox` 分支），**在本机恒不命中** ⇒ 根路由契约实际上**无人守护**。QA 建议改成 `FIREFOX || node` 双分支。

**🟡 sw.js 在评审过程中多次漂移**：`073b6281` → `1c73eb41` → 当前 `e3d43105`。原因是 `sw-policy.test.js` 与 `gen-sw.js` 都会**就地改写** `sw.js`。⇒ **发布前必须重跑一次 `gen-sw.js`，并以部署脚本 [4/9] 的输出为准**，不要相信仓库里当前这个值。（线上仍是 `chunklab-036175d2`。）

---

## ⚠️ 待完善 / 已知局限

- **⏳ browser (e2e) 组未跑**：本机缺 `CHROME_PATH`（需 `CHUNKLAB_CHROME_PATH=/c/Program Files/Google/Chrome/Application/chrome.exe`，约 9.5 分钟）。上一轮 40/49 里的 `multitab-stale` 本轮**已单独实测 12/12 通过**，但其余 8 个失败套件**本轮未验证** ⇒ **发布前必须补跑 browser 组**。
- **⚠️ 评审副作用**：`sw.js` 被测试就地改写多次（`073b6281` → `1c73eb41` → 当前 `e3d43105`），**当前值不可信**，发布前重跑 `gen-sw.js`。除此之外未修改任何源码、未 push、未部署。
- **未执行**：真机验收（G4）、生产双账号互不可读写（G2）、发布授权（G5）—— 沿用 `RELEASE_CHECKLIST.md` 已登记的三条生产侧阻塞，本次不重复计入。
- **未验证**：41 个 untracked 文件是否与线上字节完全一致（需比对生产机，本报告只确认"git 里没有"）；`content-studio` publish 链路的实际影响面。
- **口径警告**（安全卫士特别提示）：**`41cff00..HEAD` 之间 `server/` 与 `js/` 只改了 `js/course-progress.js`** —— 本次"大量改动"全是**未提交的工作区变更**，按 commit 比对会得出"几乎没改"的错判。一律用 `git diff 41cff00`（工作区）口径。
- **本次评审严格只读**，未修改源码、未 push、未部署。member 执行 `git ls-files` 等只读命令无副作用。

---

## 📚 成员产出索引

- **gstack-security-officer（安全卫士）**：F-001 三重回归验证、10 条安全发现（B-1~B-10）、STRIDE 六维、未鉴权端点全量清单（8 个匿名端点）
- **gstack-product-reviewer（产品官）**：范围收敛性判定（在收口未彻底）、627 项变更分类统计、8 模块成熟度分级、备份线三模块分工澄清、死产物与孤儿清单
- **gstack-investigator（排障手）**：**内容重生成兼容性结论**（本次最关键）、P0 回归读码核实、静默失败清单、双实现计数、孤儿/敏感扫描、提交分组建议
- **gstack-qa-lead（质量门神）**：⏳ 测试水位与部署护栏回归（进行中）

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
