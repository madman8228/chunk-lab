# Chunk Lab 上线前全检报告（代码审查 · 安全审计 · QA 测试 · 缺陷根因）

**日期**：2026-09-21
**场景**：上线前全检（Pre-launch Check）
**候选版本**：**当前未提交脏工作区**（`D:/06-project/chunk-practice`，HEAD = `a88c690`）
**参与成员**：产品评审员（代码审查）+ 安全官（OWASP/STRIDE）+ 排障手（根因/护栏有效性）+ 主理人独立复核
**QA 状态**：✅ 已回报 —— 静态 / 产物 / 发布专项**全绿**；⚠️ 但 **严格全量 `npm test` 未跑完**（会话中断于 ~28/121，partial = `25 通过 / 3 失败 / 0 flaky`）⇒ **当前候选仍无一次记录在案的绿色全量**，见第 1 节与第 5 节。

---

## 📌 TL;DR（执行摘要）

- **整体结论：🔴 不通过（No-Go）**。
- **最重的一条不是新代码引入的缺陷，而是线上已经存在的未鉴权整库下载（已于 2026-09-21 只读实测确认）**：静态资源敏感路径黑名单可被 URL 编码 / 双斜杠绕过（`//server/...`、`/%73erver/...`），而 SQLite 活库就落在静态服务根内。
  - 线上实测：`/%73erver/index.js` → **200**（57,156B，真后端源码）；`/%73erver/data/chunklab%2Edb` → **206**，`bytes 0-15/4096`，魔数 `SQLite format 3\0` ✅；`/%73erver/data/chunklab%2Edb-wal` → **206**，`bytes 0-15/2257792`，WAL 魔数 `0x377f0682` ✅ —— **且支持 Range，可分块下载**。
- 该洞自 **2026-09-09** 的 P0 补丁起就存在（HEAD `1119-1124` 与工作区逐字相同），**本轮既未引入也未修复**；且被自家安全冒烟脚本的**假绿**（`48 通过 / 0 失败`）掩盖至今。
- 另有 **1 个本轮新增**的发布流程缺陷：CI 的 `build:check` 因「先生成再检查」而**恒绿**，`browser` job 在干净环境**必失败**。
- **本轮声明的交付项 A1（统计异步提交一致性）、A3（部署失败检测）未实施** —— 代码与文档事实一致，但验收不满足。
- **QA 侧：静态 / 产物 / 发布专项全绿，严格全量已跑完 115 通过 / 6 失败 / 0 flaky（EXIT=1）** —— 6 个红**全部同一条根因、经测定为假红**：本机宿主**普通 node 冷启动就要 5.4s**，而测试窗口只有 1.5–5s ⇒ 必然超时。**唯一未达标项 = 本机拿不到绿色全量（宿主问题，非候选缺陷）**。
- **又一条护栏盲区**：`npm test` 的 checks 组跑的是 `check-sw.js`（**非 `--strict`**），该模式下「有未提交业务改动」**恒返回 0** ⇒ 对脏工作区候选**结构性不可能失败**。
- **🛠️【09-21 晚 · 处置结果】F-001 已按「不过度开发」原则就地修复并自证**：**只动 2 处**（新增 `server/middleware/static-guard.js` 作唯一实现；`server/index.js` 删除内联黑名单改为调用它），护栏补 1 处（`deploy-security-smoke.sh` 加变体族 + `--path-as-is`）。**单元 179/179 · 本地端到端 129/129（含变体族 100/100 全拒、合法资源 6/6 放行）**，负向自证通过。**⚠️ 线上仍是修复前状态 —— 修复只在本地，需部署才生效（部署未获授权，未执行）。**
- **明确没做（避免过度开发）**：未做白名单化重构、未迁移 `server/data` 出静态根、未动 A1 竞态 / CI 编排 / 部署失败传播 / `ready()` 窗口 —— 那些是**独立缺陷**，混进来会把一次安全止血变成大改造（见第 7 节「有意不做的部分」）。
- **✅【09-21 晚 · 线上已关门】nginx 层止血已上线并复验（第 8 节）**：新增 4 条 location deny + 插入 1 行 include，**公网 29 条敏感路径及变体族泄露 = 0、前端 8 条资源误杀 = 0**；备份 `/root/chunklab-nginx-20260921-175215.conf.bak`。⇒ **线上 `/server/`（源码 + 活库 + 15 份备份）、`/deploy/`、`package.json`、`diagnose.html` 现已全部关闭**，不必再等部署。
- **🔴【09-21 晚 · 部署未执行】`deploy-prod.sh` 有两个会让它必然中止的硬阻塞（第 9 节）**：① `[0/9]` 本地回归在本机**必红**（宿主慢导致的 6 个确定性假红，`set -euo pipefail` 直接终止）；② `[1/9]` env 预检要求 `ADMIN_JWT_SECRET`/`ADMIN_PASSWORD`，而生产 env **只有 8 个键、两个都没有**（本轮新增的预检 vs 09-09 的旧 env，属「检查先于配置」）。
- **⚠️【09-21 晚 · 关键事实】这次部署 ≠ 推一个安全补丁**：线上实测仍是 **09-11 的旧版本**（`sw.js` cache `chunklab-3d0b14d6`、`main.html` 250,205 B、`content/` 不存在、`js/` 仅 15 个旧文件）⇒ 本次上线 = **架构换血 + 内容 21.7×** 一次性发出，且启动迁移**有损**、回滚不能只回代码。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🔴 **No-Go** |
| 严重度分布 | 🔴 2 / 🟠 4 / 🟡 10 / 🟢 0（🟢 为反向确认项，见 2.3） |
| **本轮新增风险** | **3 条**（CI 编排缺陷 · `check-sw` 非 strict 恒绿 · 候选指纹/pretest 改写盲区） |
| **既有高危（须上线前修，非本轮引入）** | **1 条决定性**：F-001 未鉴权整库下载 |
| 关键行动项 | 5 条（见第 4 节） |
| **F-001 修复状态** | 代码侧：✅ 已本地修复并自证（单元 179/179 · 本地端到端 129/129）｜**线上：✅ 已用 nginx 层关门并公网复验（泄露 0 / 误杀 0）** ｜Express 侧修复仍待部署 |
| **部署状态** | 🔴 **未执行** —— 两个硬阻塞（本地回归必红 · env 预检缺 `ADMIN_*`），见第 9 节 |
| **F-001 修复代价** | 新增 1 文件 + 改 1 文件 ≈ 60 行；**无架构变更、无数据迁移、无前端改动** |
| 决定性问题 | **今天上线不会「引入」这个洞，但会把一个 2026-09-09 起就存在、且被自家自检判为「代码侧无洞」的洞继续带上线** |
| 是否需要老板出条件 | 需要（3 项外部动作授权 + 2 项服务器侧核对） |

---

## 1. 各成员核心结论

### 🔍 产品评审员（代码审查）
- **核心判断**：结构收敛方向是对的 —— `core.js` 已改为调用唯一模块 `CoreStorageState.buildStatsPersistencePlan`，保存入口唯一（仅 `core.js:803 saveMem` / `:884 saveAndNotify`）；课程包契约单一来源；本轮**未引入新的发布级代码回归**。
- **关键问题**：本轮声明的 P1 交付 **A1 未实现** —— 统计异步提交竞态仍在，会静默丢事件（学习记录）；`src/core/storage-state.mjs:151` 的 `nextEventSnapshot` 造而不用。
- `scripts/check-generated.mjs` **实测有效**（源 vs 产物不一致时 exit 1），能拦 `src/` → `js/` 的陈旧产物。
- **未取证边界**：未跑 `npm test`/e2e；`main.html` 170 处 emoji 为抽样判定（已查列表均为注释/文案，非按钮）。

### 🛡️ 安全官（OWASP Top 10 + STRIDE）
- **核心判断**：存在 **2 个发布级阻塞**，其中 F-001 为最高危（未鉴权全量数据泄露）。
- **关键反向结论（可放心）**：**对象级授权（BOLA）服务端是干净的** —— 全部路由从 JWT 派生 `req.userId`，无一处信任请求体 `owner/userId`；`services/*` 的 SQL 全部 `WHERE user_id=?` 参数化。**`admin.html`/admin 接口鉴权正确**（独立 `ADMIN_JWT_SECRET` + `role`/`adminId`/`token_version` 三重校验），不存在「admin 未鉴权」。
- **假绿确认**：`scripts/deploy-security-smoke.sh:43-77` 的 34 条敏感路径**全是规范化字面路径**，取码函数 `code_of():27-31` 的 curl **未加 `--path-as-is`**（curl 自己还会把 `//` 规范化掉）→ **结构上不可能发现 F-001**。
- **好消息**：`git ls-files server/.env` 为空、`git log --all -- server/.env` 为空、全历史无 `*.db` 入库 → **仓库内无真实凭据**；`.gitignore` 覆盖到位。
- **未取证边界**：未做真实渗透；未向 8787/线上发送任何流量；未远程核对 `/etc/chunklab/env`。

### 🔧 排障手（根因 + 护栏有效性）
- **课题 1 结论**：统计竞态**真实可复现**（`.workbuddy/repro-race.mjs`，`Race reproduced=true`），但**是老缺陷** —— `git show HEAD:core.js` 的 `1230`/`1238-1239` 行与工作区**逐字一致**，本轮仅把内联逻辑搬进 `buildStatsPersistencePlan`，**既未引入也未修复**。
- **关键补充（测试盲区）**：`e2e/mobile-8000.test.js:104-118` 的 100 次保存是**同步 for 循环** → 100 条事件在首次 plan 前已全部 push，**不存在「固定首批→追加」的交错**，断言恒真；缺门闩式回归。
- **课题 2 结论**：三个 checker 脚本**本身是真护栏**（实测 exit 1 ✅），但 **CI 编排让它变成装饰品** —— `ci.yml:24 prepare:ci → :25 npm run build → :26 build:check`，`build` 重写全部 `js/core-*.js`，**陈旧产物在 CI 里永远报不出来**（实测：改源不 build = 1，build 之后 = 0）。另 `browser` job（`:80-94`）只装根依赖，而 `e2e/sync-recovery.test.js:12` 要 `require(server/node_modules/better-sqlite3)` → **干净文件系统必失败**。这两条属**本轮新增 CI 配置**自带缺陷。
- **课题 3 结论**：部署失败传播三处缺口**仍成立**（老缺口）—— `:103-106` 的 `cp && chown; chown; restart` 分号链（实证同形 `false && A; B; true` → **exit 0**）、`:109` 的 curl 无 `-f`（HTTP 500 也 exit 0）、`:90-91` 固定 `/tmp` 复用。**脚本确会在失败时打印成功并返回 0**。
- **拓扑判定（决定性） = (a)**：`$APP=/opt/chunklab`（`deploy-prod.sh:18`）＝ `WorkingDirectory`（`chunklab.service:19`）＝ Express 静态根 `path.join(__dirname,'..')`（`server/index.js:370`）→ 活库 `/opt/chunklab/server/data/chunklab.db` 与备份目录**都在静态根内**。

### ✅ QA 与发布（测试与发布门槛验证）
- **核心判断**：🟡 **有条件通过** —— 静态 / 产物 / 发布专项全绿；**严格全量已跑完（115 通过 / 6 失败 / 0 flaky / EXIT=1）**，6 个红**全部同一条根因、经测定为假红**。**唯一实质未达标项 = 本机宿主进程启动延迟导致拿不到一次绿色全量**，而非候选缺陷。
- **逐项结果**（证据目录 `output/qa-audit-20260921/`）：

| 步骤 | 退出码 | 结果 |
|------|--------|------|
| `lint` / `typecheck` | 0 / 0 | 绿 |
| `build:check` / `content:check-generated` / `check-sw --strict` / `git diff --check` | 0/0/0/0 | 绿（仅 CRLF 警告） |
| `e2e/release-check.js` | 0（需 `CHROMIUM_PATH`；裸跑=2） | **24/24**，含负向自证 E1–E4 |
| **`TEST_RETRIES=0 npm test`** | **1** | 已跑完：**115 通过 / 6 失败 / 0 flaky**；runId `qa-audit-20260921-full2`，`worktreeChanged=false`（717 文件，指纹 `d64200a9` 前后一致）。**unit / checks / server 全绿**，浏览器组除下列 5 项外全绿 |
| 单跑 `stats-idb` / `sync-recovery` | 0 / 0 | 绿（历史 flaky 项本次稳） |
| 单跑 `main-startup` / `deck-progress-diagnostic` / `mobile-8000` | 1/1/1 | **仍红**（均为 server 启动超时，单跑也红 ⇒ 属宿主而非「批跑才红」） |
| `e2e/upgrade-check.js`（`sw-upgrade-e2e`） | 0 | **PASS**（G5 代码侧升级覆盖已确认） |

**6 个失败 = 同一条根因（假红）**：`deck-progress-diagnostic` / `main-startup` / `progress-coverage` / `stats-back` → `server 启动超时`；`mobile-8000` → `temporary server did not start`；`scripts:run-tests.test` → `124 !== 0`（runner 自测的「pass 夹具」在 `TEST_TIMEOUT_MS=1500` 下超时）。
**直接测定的根因**（`output/qa-audit-20260921/diag-perf.txt`）：本机**普通 `node -e "console.log(1)"` 冷启动就要 5.3–5.8 秒**（6 次实测），服务器 `listening` 需 ~5.9s；而这些测试的窗口只有 **1.5s**（runner 自测）/ **4–5s**（`ready()` 40×100ms、50×100ms）⇒ **必然超时**。佐证：`server` 能正常启动并返回 health；`free-port` 读 netstat 仅 9128 被占；`server/index.js` mtime 09-19 ⇒ **排除端口冲突与产品回归**。

- **假红判定（5 个 e2e + 1 个 runner 自测）**：全部是 `server 启动超时 / temporary server did not start` / runner 夹具超时，**非断言失败**。根因已实测：**宿主进程创建极慢**（普通 node 冷启动 5.4s），而窗口只有 1.5–5s。⇒ **测试窗口过紧 + 宿主延迟的假红，非产品回归**。**但本机至今未复现出绿，故不能报绿。** 建议：**在空闲/正常宿主上复跑一次全量**即可闭合该唯一未达标项。
- **假绿自查**：`release-check` 带**负向自证**（强制全量后断言 A2/A3 会变红）→ 非恒真，可信。⚠️ 但发现 `npm test` 的 checks 组跑的是 `check-sw.js`（非 `--strict`），该脚本「有未提交业务改动」时**恒返回 0** ⇒ **对脏工作区候选结构性不可能失败**。
- **证据完整性盲区**：`pretest` 会把 `sw.js` 的 CACHE 由 `b107687b` 改写为 `9b717009`，而 runner 的 `worktreeChanged` **在 pretest 之后**才取指纹 ⇒ **pretest 对候选的改写不被记录**，交出件的 `sw.js` 不是全新 `gen-sw` 的字节。这正是 `2026-09-21` 交接单警告的「**不把两个不同版本的结果拼成一次通过**」风险。
- **未取证边界**：未跑完严格全量；未跑真机；未跑远端 CI；未跑 `upgrade-check`（时间盒）；浏览器用的是系统 Chrome 153 而非项目自带 chromium（`ms-playwright` 不存在）。

### 🎨 未上场成员
设计师未参与本次任务（UI 相关发现由产品评审员代为提出）。

### ⚔️ 成员结论冲突及裁断（主理人）
- **QA 称「`core.js` 已引用 `nextEventSnapshot`，A1–A6 代码似已落地」** ↔ **产品评审员与排障手均称「`nextEventSnapshot` 造而不用」**。
- **主理人裁断：QA 为误报。** `grep -n nextEventSnapshot` 全库命中仅 5 处：`src/core/storage-state.mjs:120/151`、`js/core-storage-state.js:120/156`（**生产者**），以及 **`core.js:1469` —— 那是注释，不是代码**。直接读 `core.js:1477`：`var plannedEventSnapshot = evSnapOf(ev);`，`:1487` `_evSnap = plannedEventSnapshot;` ⇒ **仍取活数组**。
  ⚠️ 更要紧的是：`core.js:1468-1469` 的注释**自己写明**了「后续答题可能在 IDB open 或事务排队期间修改同一对象，导致提交内容与 nextEventSnapshot 不一致」—— **风险已被知晓并注释，但代码没改**。⇒ **A1 未修复。**

---

## 2. 综合审查发现（去重合并后按严重度排序）

### 2.1 阻塞项（上线前必须处理）

| # | 严重度 | 类别 | 位置 | 问题描述 | 触发/影响 | 新/老 | 来源 |
|---|--------|------|------|---------|-----------|-------|------|
| **F-001** | 🔴 | 安全·信息泄露（A01/A05） | `server/index.js:354-359`（HEAD `1119-1124` 同款） | 敏感路径黑名单正则打在**未解码**的 `req.path` 上，而静态根 = 项目根 | `//server/index.js`→**200**（真源码 22,527B）；`/%73erver/index.js`→**200**；`/%73erver/data/chunklab%2Edb`→**HEAD 200，`Content-Length=107,020,288`（真实库直出）**；`//package.json`→**200**（依赖清单）。**零凭据**。文件名硬编码 `chunklab.db`（`db.js:28`），备份 `chunklab_db_YYYYMMDD_HHMMSS.db` 秒级时间戳可爆破 | **老**（2026-09-09 起，本轮延续） | 安全官 + 排障手 + 主理人复核 |
| **F-001-a** | 🟡 | 安全·**定级修正**（追加核实） | `git ls-files server/` / `gh repo view` | **必须下调「源码泄露」的定级，并上调另一侧**：① 本仓库 `github.com/madman8228/chunk-lab` 为 **PUBLIC**，且 `server/*.js`（含 `index.js`/`auth.js`/`db.js` 共 30 个文件）**早已入库** ⇒ 「后端源码可下载」的**增量影响 ≈ 0**（任何人本来就能在 GitHub 读到）。② **但 `server/data/chunklab.db` 与 `-wal`/`-shm` 从未入库**（`git ls-files \| grep -i '\.db'` **零命中**）⇒ 那 2.26MB WAL + 整库的泄露**仍是真实、且是本次唯一不可接受的后果**（用户数据 + bcrypt 哈希）。③ **反向风险（加剧）**：源码既已公开，攻击者**可直接读到这段有缺陷的守卫正则**，主动发现该绕过的门槛显著降低 | 定级结论：F-001 的**严重度不变（仍为 🔴）**，但**归因要改** —— 不是「源码泄露」，而是「**未入库的活库泄露**」；报告 2.5 节「真源码」措辞已在 §2.6 更正 | **新**（本轮追加核实） | 主理人 |
| **CI-1** | 🔴 | 发布流程·护栏失效 | `.github/workflows/ci.yml:24-26`、`:80-94` | ① `build:check` 在 `prepare:ci`+`build` **之后**执行 → 陈旧产物被重新生成覆盖，**恒绿**；② `browser` job 不自足（缺 `server/node_modules`） | ① 实测：改源不 build = exit 1，build 后 = exit 0（**被掩盖**）；② 干净 Linux 上 browser 组**必失败** | **新**（`.github/` 为未跟踪新文件） | 排障手 |
| **SW-2** | 🔴 | 发布流程·护栏失效 | `package.json` 的 `test:checks` → `scripts/check-sw.js`（**非 `--strict`**） | 该脚本在「工作区有未提交业务改动」时**恒返回 0**；而本候选正是**脏工作区** ⇒ **这道 SW 护栏在本轮路径下结构性不可能失败** | 只有 QA 单独跑的 `--strict` 才有约束力；`npm test` 中的那一环等于没跑 | **新**（本轮引入的检查编排） | QA |
| **FINGER-1** | 🔴 | 发布流程·证据完整性 | `npm test` 的 `pretest` → `scripts/gen-sw.js`；runner 的 `worktreeChanged` 取指纹时机 | `pretest` 会把 `sw.js` CACHE 由 `b107687b` 改写为 `9b717009`，但**指纹在 pretest 之后才取** ⇒ **pretest 对候选的改写不被记录**，交出件的 `sw.js` 并非全新 `gen-sw` 字节 | 存在「两个不同版本的产物拼成一次通过」的风险，正是 `2026-09-21` 交接单明令禁止的 | **新** | QA |

### 2.2 非阻塞但高风险（须决策 / 待生产核对）

| # | 严重度 | 类别 | 位置 | 问题描述 | 新/老 | 备注 |
|---|--------|------|------|---------|-------|------|
| **F-002** | 🟠 | 安全·认证（A02/A07） | `auth.js:26-30`、`deploy-prod.sh:51`、`check-deploy-files.js:87` | `assertSecure()` **只校验「长度 ≥32」**，而公开占位串 `change-me-to-a-long-random-string` 恰为 **33 字符** → **占位与真随机无法区分**，全部放行 | **老** | ⚠️ **主理人更正**：生产工艺 `ExecStart=/usr/bin/node server/index.js`（`chunklab.service:21`，**无 `-r ./loadenv.js`**）＋ `EnvironmentFile=/etc/chunklab/env`，`loadenv.js:31` 又只在 `undefined` 时注入 → **生产不读 `server/.env`**。故本机占位串**不影响线上**；剩余风险 = 无法自证 + `/etc/chunklab/env` 待一条 `grep` |
| **SMOKE-1** | 🟠 | 流程·假绿 | `scripts/deploy-security-smoke.sh:18, 27-31, 43-77, 78-85` | 34 条 DENY 路径**零覆盖**编码/双斜杠/大小写/规范化变体；`curl` 未加 `--path-as-is`；但脚本话术（`:9`）宣称「全 ✓ → 代码侧无洞」 | **老** | 团队对该脚本信任度很高（`index.js:351-353` 注释记载它曾抓出 `/deploy` 泄露）→ 假绿会被当成「已验证」。**修 F-001 必须同步修这里，否则下次还是假绿** |
| **SMOKE-2** | 🟠 | 流程·对错域名 | `deploy-security-smoke.sh:18` vs `deploy-prod.sh:131` | 默认 `BASE=https://chunk-lab.jaas.app`，而部署域名是 `chunklab.jqka.top` | **老** | 存在「对错域名跑出全绿」隐患 |
| **DEP-1** | 🟠 | 流程·部署误报成功 | `deploy-prod.sh:103-106`、`:109-110`、`:90-91` | 分号链掩盖 `cp` 失败（实测 exit 0）；curl 无 `-f`（HTTP 500 → exit 0）；固定 `/tmp` 复用 | **老**（A3 未实施） | 现有 `deploy-safety.test.js`（11/11）只审**静态结构**，不覆盖这 4 项；`doc A3` 要求的假远端夹具 `scripts/deploy-transaction.test.js` **不存在** |
| **F-004** | 🟠 | 安全·DoS（A04/A05） | `index.js:74`、`:146` | 全局 `express.json({limit:'80mb'})`；`/api/data` 对 `decks`/`statsDelta` **无条数与总量上限**；开放游客注册；**全码库无任何 `DELETE FROM users`/回收任务**（已 grep 确认） | **老** | 匿名者可持续注册 + 80MB/次写入 → `users` 单调膨胀 |
| **F-005** | 🟠 | 安全·弱口令（A07） | 本机 `server/.env` `ADMIN_PASSWORD`；生产取 `/etc/chunklab/env` | 本机值 11 位、疑似真实但弱（按规则不贴值） | **老** | 生产待核对；与 F-002 同场景放大 |
| **TOPO-1** | 🟠 | 部署清单漏项 | `deploy-prod.sh:26-38`、`scripts/check-deploy-files.js` | 清单与检查器**均不覆盖** `server/data`、`server/backups`、`server/.env`，**没有任何「敏感路径必须留在静态根之外」的断言** | **老** | 比已知的 `server/package*.json` 漏项更严重：漏的是「**应排除**」而非「应包含」 |

### 2.3 明确延后项（既有缺口，本轮既不修也不加剧）

| # | 严重度 | 位置 | 问题 | 说明 |
|---|--------|------|------|------|
| **A1-RACE** | 🟡 | `core.js:1457`、**`:1477`**、`:1487`（回退路径 `:1460-1466`） | 统计提交竞态：写入用的是冻结切片（`plan.eventRows`），但成功后被采纳的标记 `plannedEventSnapshot = evSnapOf(ev)` **读的是活数组** → 标记超前 → 下批 `eventRows=[]`，事件永不落库 | **老缺陷**（`HEAD:core.js:1230/1238` 逐字相同，本轮仅搬进 `buildStatsPersistencePlan`）。修法材料已备（`storage-state.mjs:151 nextEventSnapshot`），但 `core.js` **只在一句注释里提到它、代码零消费**（见 1 节「结论冲突裁断」）。后果：丢**统计事件/学习日志**；**是否也丢云端【待验证】**。触发面：仅「提交 in-flight 期间又答题」 |
| **TEST-1** | 🟡 | `e2e/mobile-8000.test.js:104-118, 131-158` | 100 次保存是同步 for 循环，无「固定首批→追加」交错 → 断言恒真，**结构上拦不住 A1-RACE** | 需补门闩式回归（捕获首批→追加→释放→排空） |
| **TEST-2** | 🟡 | `e2e/main-startup.test.js`、`e2e/deck-progress-diagnostic.test.js`、`e2e/mobile-8000.test.js` 的 `ready()` 轮询 | `ready()` 窗口仅 **4–5s**（`40×100ms`/`50×100ms`），而本机服务器到 `listening` 需 **5.8–8.5s** ⇒ **稳定假红** | **假红，非产品回归**（已排除端口冲突、`server/index.js` mtime 09-19）。属**测试就绪窗口过紧** —— 它是「本机跑不出绿」的直接原因，也让「候选无绿色全量」这个事实长期被误读成产品问题 |
| **A4-1** | 🟡 | `core.js:1435-1456`（及 `:1405-1413`） | 内联第二份 `buildStatsPersistencePlan` 同构实现仍在（生产已加载模块 → 死码路径） | 违反「同一事实唯一实现」宪法；当前语义等价未漂移 |
| **F-003** | 🟡 | `core.js:2686-2690` | 游客密码用 `Math.random()` 而非 CSPRNG（`guest_<10位>`+24 位） | 用户已登记隐患②，属实 |
| **F-006** | 🟡 | `core.js:2704` | 游客凭据**明文**存 `localStorage` | 任一 XSS 即可静默接管账号；隐患①属实 |
| **F-008** | 🟡 | `auth.js:72-75` | 无 session/epoch 服务端机制；`TOKEN_TTL` 默认 **30d**，改密**不吊销**在途 token | 隐患④属实 |
| **F-007** | 🟡 | `auth.js:58`、`:110` | 账号枚举 oracle（「用户名已存在/已被占用」） | 有限流（10 次/15 分钟/IP）故降级 |
| **F-009** | 🟡 | `/api/feedback`、`/api/stats`、`/api/config` | 匿名端点走 80MB 解析器（超限在**解析后**才拒，内存已放大）；匿名暴露运行时长/缓存命中/开关 | — |
| **F-010** | 🟡 | `sw.js:103` | `admin.html` 公开且被**预缓存进每个用户设备** | 服务端 `adminOnly` 保护正确，泄露的是管理面存在与路由结构 |
| **F-011** | 🟡 | `deploy-prod.sh:90-91` | 固定 `/tmp/chunklab-deploy` 复用，宿主机本地用户可预置文件被复制进 `$APP` | 需本机权限，故 🟡 |
| **UI-1** | 🟡 | `js/sync-resolution-ui.js:21` | 用 `×` 字符当关闭按钮，违反「UI 禁用字符 icon」宪法 | **不在本轮 diff 内** → HEAD 既有 |
| **UI-2** | 🟡 | `main.html`（56 处 `innerHTML`）、`decks.html`（48 处） | 既有模板渲染用法；**未发现**可利用的存储型 XSS（安全官已逐点核对含 `esc()` 的云控字段） | 可维护性视角未见本轮新增未转义插值 |

### 2.4 🟢 反向确认（明确「没有问题」的关键面，避免只报坏消息导致风险边界误判）

- **对象级授权（BOLA）干净**：全部路由从 JWT 派生 `req.userId`，无一处信任请求体 `owner/userId`。
- **admin 鉴权正确**：独立 `ADMIN_JWT_SECRET` + `role`/`adminId`/`token_version` 三重校验（`admin-overview.js:8-15`、`admin.js:69-80`）；未见普通用户 → 管理员的提权路径。
- **SQL 全参数化**：`data-writers`/`data-rows`/`db.js` 无拼接用户输入的查询。
- **CORS fail-closed**（`index.js:76-88`）；生产强制鉴权 fail-fast（`index.js:383-386`）；图片 magic-number 校验；`sw.js` 明确不缓存 `/api/*`。
- **无凭据入库**：`git ls-files server/.env` 空、`git log --all -- server/.env` 空、全历史无 `*.db`；`.gitignore` 覆盖 `.env`/`data/`/`*.db*`。
- **保存入口唯一**（`saveMem` / `saveAndNotify`），无平行全局保存入口。
- **课程包契约单一来源**（`js/course-package-contract.js` → 生成物 `js/vendor/course-schema-validator.js`）。
- **产物护栏有效**：`check-generated.mjs` / `content:check-generated` / `check-sw --strict` 三者**脚本层**实测均能在陈旧或缺失时 exit 1。
- **未发现静默 `catch-continue` 吞句**（产品代码内）。

---

### 2.5 🔴 线上只读核实（2026-09-21 实测，host `chunklab.jqka.top`）

> 授权后执行的**只读**核实：仅 HEAD 与 16 字节 Range，**未下载库体、未读取 `.env` 内容、未做任何写操作**。原始输出见 `.workbuddy/_audit/live-probe.txt`、`live-magic.txt`。

| 路径 | 状态 | 证据 / 判定 |
|------|------|------------|
| `/` | 302 → `/main.html` | 站点存活 |
| `/main.html` | 200，`250,205B` | 入口页正常 |
| `/api/health` | 200 | 后端存活 |
| `/api/config` | 200 | `{"requireAuth":true,...,"authAvailable":true}` ⇒ 鉴权已启用，**但绕过的正是非 `/api` 的静态路径** |
| `/server/index.js` | 403 | 【对照】朴素路径**确实被拦住** |
| `/server/data/chunklab.db` | 403 | 【对照】凭据栏被拦住 |
| `/package.json` | 403 | 【对照】 |
| `/.env` | 403 | 【对照】 |
| `//server/index.js` | **200** · `57,156B` · `application/javascript` | ★ **绕过成立**。正文首行即真实源码头：`/** * index.js · Chunk Lab 云端后端入口 * * 路由总览（前缀 /api）：` |
| `/%73erver/index.js` | **200** · `57,156B` | ★ 绕过成立（编码 `s`） |
| `/%2Fserver/index.js` | **200** · `57,156B` | ★ 绕过成立（编码斜杠） |
| `/%73erver/data/chunklab%2Edb` | **206** · `bytes 0-15/4096` · `application/octet-stream` | ★★ **整库可下载**。16 字节魔数 = `53514c69746520666f726d6174203300` → `SQLite format 3\0` ✅ |
| `/%73erver/data/chunklab%2Edb-wal` | **206** · `bytes 0-15/2257792` · `application/octet-stream` | ★★ **WAL 可下载（2.26 MB）**。魔数 `0x377f0682` ✅ |
| `/%73erver/data/chunklab.db` | 403 | 未编码的 `.db` 被扩展名规则拦住（**只有 `%2E` 变体能过**） |
| `//server/data/chunklab.db` | 403 | 同上（双斜杠能过前缀检查，但过不了扩展名检查） |
| `/%73erver/%2Eenv` | 404 | 靠 `express.static` 的 `dotfiles:'ignore'` 兜住，**不是守卫功劳** |
| `/%73erver/data/` | 404 | 无目录列举 |

**判定**：
1. **Nginx 原样透传百分号编码与双斜杠**（`deploy/nginx-chunklab.conf:20` 的 `proxy_pass` 无 URI 部分）⇒ **Express 是唯一防线，且已被绕过**。
2. **`Accept-Ranges: bytes` 且 Range 正常返回 206** ⇒ 攻击者**可分块下载**，不必一次拉完整库，普通限流与体积监控都难以察觉。
3. **主库 4,096B 而 WAL 2.26MB** ⇒ 近期写入几乎都在 WAL 里。**WAL 的泄露价值不低于主库**（它含未 checkpoint 的最新提交）。
4. **备份目录无需爆破**：`/%73erver/data/` 无目录列举，但活库与 WAL 已经够用，无需枚举 `chunklab_db_YYYYMMDD_HHMMSS.db`。
5. `chunk-lab.jaas.app` → **`ECONNRESET`（不可达）** ⇒ 坐实 SMOKE-2：`deploy-security-smoke.sh:18` 的默认 BASE 是**死域名**，按默认跑什么都测不到。

> ⚠️ **性质：这是线上现状，不是「上线后才有的风险」。** 本候选部署与否都不改变它；但它也说明——**再部署一次只会延续这个状态**。

### 2.6 🟡 对 §2.5 的一处定级更正（追加核实，依新证据）

§2.5 把绕过后果笼统写成「真源码 + 活库」。**追加核实后必须拆开定级**：

| 事实 | 核实方式 | 结论 |
|---|---|---|
| 本仓库是 **PUBLIC** | `gh repo view madman8228/chunk-lab --json visibility` → `"visibility":"PUBLIC"` | — |
| `server/*.js` **早已入库** | `git ls-files server/` → **30 个文件**，含 `index.js` / `auth.js` / `db.js` | **「源码泄露」的增量影响 ≈ 0**（任何人本来就能在 GitHub 读到） |
| `.db` / `-wal` / `-shm` **从未入库** | `git ls-files \| grep -i '\.db'` → **零命中** | **活库泄露是本次唯一不可接受的后果**（用户数据 + bcrypt 哈希 + 2.26MB 未 checkpoint 的 WAL） |
| `.env` **未入库** | `git ls-files \| grep -i '\.env'` → 仅 `.env.example` | 凭据未通过这条路泄露（与 §2.5 的「零凭据」一致） |

**更正后的定级（三条，都重要）**：

1. **F-001 严重度不变（仍为 🔴），但归因要改**：它不是「后端源码泄露」，而是「**未入库的 SQLite 活库（+ WAL）无鉴权可下载**」。把归因写错的代价是——修的人和审的人都会盯着「源码」这个其实无所谓的面，而放过真正要紧的数据面。
2. **反向风险加剧（这条抵消了「源码本就公开」的宽慰）**：源码既已在公网可读，**任何人早就能读到 `server/index.js:354-359` 这段有缺陷的守卫正则**（正则打在未解码的 `req.path` 上）⇒ **主动发现该绕过的门槛远低于「私有源码」情形**。「源码本来就公开」**不能**用来下调紧急度。
3. **§8 的 nginx 层止血优先级不变**（已完成）——它挡的正是「活库」这个真正要紧的面。

> 📌 **给回滚点的直接推论**：本次 commit **排除** `deliverables/`（含本报告：服务器 IP、探测路径、nginx 规则 —— 合起来是一份「哪里有过洞、现在怎么防」的说明书）与 `.impeccable/`（外来工具产物）。它们**都不在部署白名单**（`deploy-prod.sh:32-44`），排除**不影响回滚点的完整性**。

---

## 3. 本轮自定门槛与达标状态

> 依据 `RELEASE_CHECKLIST.md:7-9` 放行规则 + 项目发布纪律（分栏登记、清单须收敛）。

| # | 门槛 | 状态 | 未达成的具体项 | 该谁做 |
|---|------|------|---------------|--------|
| 1 | 无**本轮新增**的发布级缺陷 | ❌ **未达标** | CI-1（`build:check` 恒绿 + `browser` job 不自足） | 我做（本地改 `ci.yml`，无需外部条件） |
| 2 | 无未鉴权数据暴露 | ❌ **未达标** | F-001（决定性） | 我做（代码修复）+ **你授权**（线上只读核实） |
| 3 | 发布过程护栏真实有效（非装饰品） | ❌ **未达标** | SMOKE-1（冒烟假绿）、DEP-1（部署误报成功）、TOPO-1（清单漏「应排除」项） | 我做（本地改脚本与断言） |
| 4 | 本轮声明交付项 A1–A6 验收通过 | ❌ **未达标** | A1（统计提交一致性）、A3（部署失败检测）**未实施**；A2 部分未达标 | 我做（需你确认是否纳入本轮） |
| 5 | 外部门槛 G2–G5 | ⏸ **待外部条件** | G3 备份恢复演练（需 SSH 独立实例）、G4 真机验收、G5 发布授权；C3 外部 course-creator 互操作样本 | **你出条件** |
| 6 | 当前候选有一次**记录在案**的绿色严格全量 | ⚠️ **未达标但已定性** | 全量已跑完：`115 通过 / 6 失败 / 0 flaky / EXIT=1`（runId `qa-audit-20260921-full2`）。6 红**根因同一**：宿主普通 node 冷启动 **5.4s** vs 测试窗口 1.5–5s ⇒ **假红，非产品回归**。**本机无法取得绿** | 在**空闲/正常宿主**复跑一次（我可执行）即可闭合 |
| 6b | 候选产物指纹覆盖 `pretest` 对 `sw.js` 的改写 | ❌ **未达标** | 指纹在 `pretest` **之后**才取 ⇒ `sw.js` 的 `b107687b → 9b717009` 改写不被记录 | 我（改 runner 取指纹时机） |
| 6c | 审计产物不污染候选指纹 | ⚠️ **需注意** | 本轮报告、记忆、取证脚本写入工作区 ⇒ 指纹由 `bcc0656a`/719 文件漂移到 `d64200a9`/717 文件。**复跑基线须显式排除 `.workbuddy/` 与 `deliverables/`**，否则会出现「审着审着候选变了」 | 我 |
| 7 | 历史通过记录可信 | ❌ **不可引用** | 09-20 的 `100/100` 与 09-21 交接单中 `101/101` 数字不一致，且**不是当前候选**跑出来的 | 我做（用最终候选复跑一次） |

**唯一决定性未达标项 = 门槛 2 的 F-001。** 它不解决，讨论其它都没有意义。

---

## 4. 行动清单

| # | 行动 | 负责方 | 紧急度 | 备注 |
|---|------|--------|--------|------|
| 1 | **只读核实线上 F-001 可达性**：对线上域名发 2 条 GET（`/%73erver/index.js`、`/%73erver/data/chunklab%2Edb`），只看状态码 | ⚠️ **需你授权，我可立刻执行** | **P0** | 不改任何东西；这决定线上是否正在裸奔 |
| 2 | **核实生产密钥**：服务器上执行 `grep CHUNKLAB_DATA_DIR /etc/chunklab/env` 与 `awk -F= '/^JWT_SECRET/{print "len="length($2)}' /etc/chunklab/env`（只看长度与是否设置） | ⚠️ **需你授权** | **P0** | 一条命令，决定 F-002 与 F-001 的实际影响面 |
| 3 | **修 F-001（根因修，不做黑名单补丁）**：在**判定前**把请求路径解码到不动点 → 折叠斜杠 → 解 `.`/`..` → 非法即 fail-closed，再走原有拒绝规则 | ✅ **已完成**（本地代码，见第 7 节） | ~~P0~~ | 原方案里的「白名单化 / 迁移 data 目录」**有意未做**（过度开发，见 7.3） |
| 4 | **修冒烟脚本的假绿**：DENY 路径扩展为**变体族**（首段逐字符 `%XX`、`//`、`%2F`、编码穿越、点编码）、curl 加 `--path-as-is`、默认 BASE 与部署域名对齐 | ✅ **已完成**（本地脚本，见第 7 节） | ~~P0~~ | 不修这条，第 3 条的修复无法自证 |
| 5 | **修 CI 编排**：`build:check` 提到 `build`/`prepare:ci` **之前**只读执行；`browser` job 安装 `server/package.json` 依赖 | 我做（本地配置） | P1 | CI-1 |
| 6 | **修部署失败传播**：分号链改为严格 `&&` 或显式检查返回值；curl 加 `-f`；`/tmp` 目录加唯一后缀 | 我做（本地脚本） | P1 | DEP-1；顺带补 `scripts/deploy-transaction.test.js` 假远端夹具 |
| 7 | **决策：A1 是否纳入本轮** | **你决策** | P1 | A1 是老缺陷，但属「可复现的数据丢失」，与放行规则的例外条款相关 |
| 8 | 修 A1 竞态（若批准）：提交成功后采纳 `plan.nextEventSnapshot` + 本批冻结的 `changed/eventRows`；失败不采纳标记；补门闩式回归 | 我做 | P1 | 修法材料已备，`core.js` 零引用 `nextEventSnapshot` |
| 9 | 补 `check-deploy-files.js` 的「敏感路径必须留在静态根之外」断言 | 我做 | P2 | TOPO-1 |
| 10 | 轮换密钥（若第 2 条核实命中弱值） | 你 | 条件 P0 | 不改代码无法解决 |
| 11 | **空载重跑一次严格全量** `TEST_RETRIES=0 npm test`，把 `runId` + 指纹落档 | 我（约 25min） | P1 | 门槛 6；应把 `ready()` 窗口调宽（或等 `listening` 事件）后再跑，否则仍是 3 个假红 |
| 12 | **修 `ready()` 就绪窗口过紧**：改为等待 `listening` 事件或放宽到 ≥10s；并顺带记录服务器冷启动耗时基线 | 我 | P1 | TEST-2；这是「本机长期跑不出绿」的根因，不修则每次全量都假红 |
| 13 | **修 `test:checks` 用 `check-sw.js --strict`**；修 runner 取指纹时机（移到 `pretest` **之前**或记录 pretest 改写） | 我 | P1 | SW-2 + FINGER-1 |

---

## 5. ⚠️ 待完善 / 已知局限

1. **严格全量已跑完，但本机拿不到绿**：`115 通过 / 6 失败 / 0 flaky / EXIT=1`（runId `qa-audit-20260921-full2`，`worktreeChanged=false`）。6 个红**根因同一且已实测** —— 宿主进程创建极慢（普通 node 冷启动 **5.4s**），而窗口 1.5–5s ⇒ **必然超时**。⇒ **不是候选缺陷，但也不构成「测试全绿」的证据**。闭合方式 = 空闲宿主复跑。历史文档中 `100/100`（09-20）与 `101/101` 两个数字互不一致，且均非当前候选所跑，**不得引用为通过证据**。
2. **审计自身扰动了候选指纹**：本轮报告、记忆文件、取证脚本都写入工作区 ⇒ 指纹从 `bcc0656a`/719 文件漂移到 `d64200a9`/717 文件。后续复跑验证时**必须显式排除 `.workbuddy/` 与 `deliverables/`**，否则会出现「审着审着候选变了」的假象。
3. **外部动作范围（已获授权，严格限制）**：本次只对 `chunklab.jqka.top` 发出**只读** HEAD 与 16 字节 Range 请求；**未连接生产 shell、未登录服务器、未提交/推送/部署、未执行任何写操作、未读取任何用户数据内容**。
4. **F-001 的线上可达性：已实测确认**（见 2.5）——② Nginx 透传编码 **已实证**（`/%73erver/index.js` 等 200）；① `/etc/chunklab/env` 是否覆盖 `CHUNKLAB_DATA_DIR` **仍待**（但已实测库文件就在静态根内，该覆盖只会改变影响面，不改变「规则可绕过」这一事实）；③ 生产与工作区的版本行号差异已用 HEAD 同源比对消除逻辑差异。
5. **未做侵入性验证**（有意为之）：**未尝试用占位密钥伪造令牌**、**未读取任何用户数据内容**、未下载库体（只取 16 字节魔数）、未枚举备份文件名。因此「F-002 在生产是否命中」仍只能由服务器侧一条 `grep` 回答，**不可由本次线上探测推断**。
6. **未跑依赖 CVE 比对**（本机不联网查库）：静态核对 express 4.22.2 / path-to-regexp 0.1.13 / body-parser 1.20.6 / jsonwebtoken 9.0.3 等未见明显已知高危，**标注待联网复核**。
7. **`main.html` 170 处 emoji 为抽样判定**（已查列表全为注释与说明文案），非逐字符穷举。
8. **A1 是否也丢云端事件【待验证】**：delta 由 live `memObj` 构建（`core.js:1985`/`:1668`），事件可能仍随 delta 上传；未跑云路径，不臆断。
9. **平台限制（影响取证方式，不影响结论）**：本机 `bash` 工具环境损坏（coreutils 不可用）；PowerShell 工具不回传 stdout（须让程序自己写 UTF-8 文件再读）；安全官无法在本机启动第二个 node 进程（`spawn` 失败），故 F-001 的复现采用「**从候选文件原样抽取 6 行守卫**（非手抄，断言内容一致）挂到真实 express 4.22.2 + 真实项目根」的方式，唯一未参与的是守卫之后的 `apiCompress`/`staticCompress`（它们必然放行，不改变结论）。
10. **本次线上核实未做时间跨度观测**：只做了一次快照，**无法回答「这个洞存在了多久、是否已被利用」**。日志侧的取证（`[req]` 日志、`user_activity`）需要服务器权限，未做。

---

## 6. 证据文件索引

| 主题 | 文件 |
|------|------|
| 统计竞态复现 | `.workbuddy/repro-race.mjs`、`.workbuddy/repro-race.out.txt` |
| HEAD 同源比对（竞态） | `.workbuddy/_git2.txt`、`.workbuddy/_git3.txt` |
| CI 护栏审计 | `.workbuddy/ci-guard-audit.mjs`、`.workbuddy/_audit/ci-guard-audit.out.txt`、`.workbuddy/_audit/content-guard.out.txt` |
| 部署护栏 / 失败传播 | `.workbuddy/_audit/{deploy-safety,check-deploy-files,shell-propagation,curl-status,deploy-head}.out.txt` |
| 部署拓扑判定 | `.workbuddy/_audit/topology-1.txt`、`.workbuddy/_audit/topology-2.txt` |
| HEAD 版静态根与黑名单复核（主理人） | `.workbuddy/_head_verify.txt`、`.workbuddy/_head_blacklist.txt` |
| **线上只读核实（主理人，已授权）** | `.workbuddy/_audit/live-probe.cjs`、`.workbuddy/_audit/live-probe.txt`、`.workbuddy/_audit/live-magic.cjs`、`.workbuddy/_audit/live-magic.txt` |
| QA 测试与假红诊断 | `output/qa-audit-20260921/`（含 `diag-boot.txt`、`diag-health2.txt`、`diag-perf.txt`、`diag-mtimes.txt`、`09-full-test2.txt`、`v3-exits.txt`） |
| QA 严格全量（**已跑完**） | `output/test-results/qa-audit-20260921-full2/summary.json`｜`115 通过 / 6 失败 / 0 flaky`、`worktreeChanged=false`（指纹 `d64200a9` / 717 文件） |
| QA 首次全量（被中断） | `output/test-results/qa-audit-20260921-full/`（partial，`summary.json` 未生成） |
| **F-001 修复的单元测试** | `server/static-guard.test.js`（exit 0） |
| **F-001 修复的本地端到端** | `.workbuddy/_audit/run-local-guard-e2e.cjs`（自包含起服务→探针→关服务）→ `.workbuddy/_audit/local-guard-e2e.txt`、`local-guard-e2e-server.log` |
| 修复前线上对照（同路径 200） | `.workbuddy/_audit/live-probe.txt`、`live-magic.txt` |

---

## 7. 修复落地与验证（09-21 晚，实际改动）

> 授权原话：「不过度开发，不做可有可无的开发，不过度把项目复杂化的原则下，你建议如何处理，就按照你的建议做」
> 因此本节只做**止血**：把「判定对象没有规范化」这一个根因修掉，其余一律不碰。

### 7.1 改了什么（共 2 个改动 + 1 个护栏）

| 文件 | 类型 | 改动 |
|------|------|------|
| `server/middleware/static-guard.js` | **新增** 116 行 | 唯一守卫实现：`normalizeRequestPath()`（反复解码到不动点 → 反斜杠归一 → 折叠空段 → 解析 `.`/`..` → 失败/NUL 即 `null`）+ `isSensitivePath()`（沿用 09-09/09-10 原规则的**语义等价**版本）+ `createStaticGuard()` 中间件 |
| `server/index.js` | 改 | 删掉约 12 行内联黑名单中间件，改为 `const { createStaticGuard } = require('./middleware/static-guard')` + `app.use(createStaticGuard())`。**挂载位置不变**（仍在压缩中间件之后、`express.static` 之前） |
| `scripts/deploy-security-smoke.sh` | 改 | ① 默认 BASE 由**死域名** `chunk-lab.jaas.app` 改为 `chunklab.jqka.top`；② `code_of()` 加 `--path-as-is`（**关键**：不加则 curl 自己就把 `//` 规范化掉，永远测不出这个洞）；③ 新增 `variants_of()`，每条 DENY 路径**连带测变体族**，任一变体返回 200 即 FAIL；④ 删掉假绿话术「代码侧无洞」，改为「本轮覆盖的路径与变体均被拒」+ 明示黑名单抽样的局限 |
| `scripts/deploy-prod.sh` | 改 | `FILES=(...)` 加入 `server/middleware/static-guard.js`，使 `check-deploy-files.js` 按 require 闭包强制校验（漏文件会中止部署，不会静默漏发） |

**没有新依赖、没有新中间件顺序、没有数据库/数据目录变更、前端零改动。**

### 7.2 怎么自证的（三层，且每层都验了「它真的会红」）

| 层 | 手段 | 结果 |
|----|------|------|
| **单元** | `server/static-guard.test.js`：用真实 canary 目录（含真 `server/data/chunklab.db`、`.env`、`package.json`）+ 双 express 实例（**带守卫 / 不带守卫**）对照 | ✅ **exit 0**（文件级 1 test，内含 179 条断言全通过）。含 **[C] 负向自证**：同一条路径在不带守卫的实例上必须 200 —— 证明 canary 文件真实存在，不是「因为文件不在所以 404」的假绿 |
| **负向自证（反向）** | 临时把解码循环改成 `i < 0`（等于关掉解码），重跑 | ✅ 立刻 **125/179 失败、exit 1**（变体族与 `normalizeRequestPath` 断言集体崩）⇒ **证明这组测试真的在测解码**，不是恒绿；随后已还原 |
| **端到端** | `.workbuddy/_audit/run-local-guard-e2e.cjs`：**同一个进程内**起 `NODE_ENV=production REQUIRE_AUTH=true` 的服务 → 打 129 条请求 → 关服务（绕开本机「spawn 一次 curl 要 ~50s」的坑） | ✅ **129/129 全部通过**（见下表） |
| 部署清单一致性 | `scripts/check-deploy-files.js` | ✅ exit 0 |

**端到端 129/129 明细**（原始输出 `.workbuddy/_audit/local-guard-e2e.txt`）：

| 组 | 内容 | 结果 |
|----|------|------|
| [A] 合法资源必须 **200**（防误杀） | `/main.html` `/core.js` `/js/idb.js` `/manifest.json` `/favicon.ico` `/sw.js` | **6/6 OK** |
| [B] 朴素敏感路径必须 **403** | `server/*`、`server/data/chunklab.db`、`chunklab.db-wal`、`server/.env`、`/.env`、`/.git/config`、`package.json`、`package-lock.json`、`scripts/*.sh`、`deploy/*.conf`、`e2e/`、`*.md`、`diagnose.html`、`validate_*.js`、`output/`、`ref/`、`make-icons.py`、`*.test.js` | **20/20 OK** |
| **[C] 变体族必须 403**（修复前线上实测 200 + 真源码字节） | 每条敏感路径 × 5 变体：`//path`、`/%73erver/...`（首段首字符编码）、`/%2Fserver/...`（前导斜杠编码）、`/..%2Fserver/...`（编码穿越）、`%2E`（点编码） | **★ 100/100 被拒** |
| [D] 不可信输入必须 403（fail-closed） | `/%ZZ`（非法转义）、`/%E4%B8`（截断 UTF-8）、`/%00`（NUL） | **3/3 OK** |

服务端日志逐条留痕（`.workbuddy/_audit/local-guard-e2e-server.log`），例如：
`GET //server/index.js 403 1ms`、`GET /%73erver/index.js 403 0ms`、`GET /..%2Fserver/data/chunklab.db-wal 403 0ms` —— **正是线上实测返回 200 + 真字节的那几条**。

### 7.3 有意**没有**做的部分（避免过度开发 —— 但请知道它们仍开着）

| 未做 | 为什么不做 | 它仍在哪登记 |
|------|-----------|-------------|
| 静态服务**白名单化**重构 | 会改 `express.static` 挂载结构、影响全部前端资源路径，回归面远超一次止血 | 第 4 节 #3 备注（原方案含此项，本次**有意保留**） |
| 把 `server/data`、`server/backups` **移出静态根** | 需动部署脚本 + `CHUNKLAB_DATA_DIR` + systemd + 备份路径，属**架构变更**，且线上已有数据在跑 | **TOPO-1**（🟠，未消） |
| A1 统计提交竞态 | 独立缺陷（可复现数据丢失），与本次绕过无关；混进来会让一次安全修复变成两件事 | **A1-RACE**（🟡，未消）+ 第 4 节 #7/#8 待你决策 |
| CI 编排（`build:check` 恒绿、`browser` job 不自足） | 独立缺陷，改 `.github/workflows/ci.yml` | **CI-1**（🔴，未消） |
| 部署失败传播（分号链 / `curl` 无 `-f` / 固定 `/tmp`） | 独立缺陷，改 `deploy-prod.sh` 执行链 | **DEP-1**（🟠，未消） |
| `ready()` 就绪窗口过紧（本机假红根因） | 属**测试基础设施**，非产品缺陷；且改它会让「历史红」失去可比性 | **TEST-2**（🟡，未消） |
| `test:checks` 未加 `--strict`、runner 取指纹时机 | 独立缺陷，改 `package.json` / runner | **SW-2 / FINGER-1**（🔴，未消） |
| F-002 的服务器侧 `grep`、`/etc/chunklab/env` 核对 | **需要服务器权限**，属外部动作 | 第 4 节 #2，**待你授权** |

> ⚠️ **诚实边界**：本次修复**只关掉了「黑名单被编码绕过」这一条路**。TOPO-1（敏感目录仍在静态根内）**没消** —— 也就是说，如果将来守卫本身被写出新漏洞，数据还是会直接暴露。上表这些是**独立缺陷**，各自需要单独拍板，我没有顺手改。

### 7.4 线上处置结果（本节结论已被第 8 节更新）

- ⚠️ **本节原先的「线上仍未修复」结论，已于 09-21 晚被第 8 节取代**：nginx 层止血已上线生效，线上 `/%73erver/index.js`、`/%73erver/data/chunklab%2Edb`、`chunklab.db-wal` 等**现已全部 403**（公网复验：泄露 0 / 误杀 0）。
- **但代码侧修复仍未上线** —— Express 的 `static-guard.js` 要等部署（第 9 节，当前被两个硬阻塞挡住）。**nginx 只有 4 条前缀规则，作用是收爆炸半径，不是根治。**
- ⚠️ 若日后要移除 nginx 规则，**必须先确认 Express 修复已部署且生效**，否则会退回裸奔状态。
- 修复部署后，**必须立刻跑一次 `scripts/deploy-security-smoke.sh`**（现已含变体族），确认线上变体族全拒；否则等于没验。
- 若判断线上已可能被读取过：应**轮换 `JWT_SECRET` / `ADMIN_PASSWORD`**（数据库里是 bcrypt 哈希，泄漏不等于明文，但令牌签发密钥泄漏意味着可伪造身份）。
  - ✅ **09-21 晚已核实：F-002 在生产不命中** —— `/etc/chunklab/env` 的 `JWT_SECRET` 长度 = **64**（真随机，非占位串）⇒ 无需轮换。

---

## 8. 线上 nginx 层止血（09-21 晚，已获授权并已生效）

> 授权原话：「1，2，要  3不要」= **要部署、要 nginx 止血、不要轮换密钥**。
> 本节记录已执行的**线上变更**（本轮唯一触碰生产的动作）。

### 8.1 改了什么

| 项 | 内容 |
|----|------|
| 新增 | `/etc/nginx/chunklab-deny.conf` —— 4 条 location：`^~ /server/`、`^~ /deploy/`、`= /package.json`、`= /diagnose.html`（含完整根因注释） |
| 修改 | `/etc/nginx/sites-available/chunklab` —— server 块内、`location /` 之前**插入 1 行** `include /etc/nginx/chunklab-deny.conf;`（`diff` 证实**只多这一行**） |
| 备份 | `/root/chunklab-nginx-20260921-175215.conf.bak`（**回滚 = 还原它 + `nginx -t` + `reload`**） |
| 未触碰 | `sites-enabled/default`、`sites-enabled/jqka.top`（同机另有站点）、certbot 注入的全部 TLS 指令、`proxy_pass` 链路 |

**范围原则（避免过度）**：只覆盖线上**实际存在**的敏感项（已逐项 `ls` 核实）。线上**没有**的目录 —— `scripts/` `e2e/` `output/` `extra/` `ref/` `deliverables/` `.git/` `.workbuddy/` `.env` `README.md` —— **一律不写规则**，避免一堆永不命中的装饰性条目。

### 8.2 验收结果

| 面 | 手段 | 结果 |
|----|------|------|
| 公网真实路径 | 本机经 `https://chunklab.jqka.top`（真实 DNS + TLS）打 29 条敏感路径及变体族 | **泄露 = 0**；前端 8 条资源**误杀 = 0** |
| 服务器侧 | `127.0.0.1` + `Host` 直连（绕开本机代理），**连跑两轮** | 两轮**完全一致**；31 条敏感路径全部 403/400 |
| 拦截归属 | 见 8.3 | nginx **27** ／ Express **1** |

覆盖到的关键项（全部被拒）：`/server/{index,auth}.js`、`server/data/chunklab.db`、`chunklab.db-wal`、`chunklab.db-shm`、**`server/backups/`**、`server/.env`、`server/node_modules/`、`server/package-lock.json`、`server/smoke.test.js`、`deploy/nginx-chunklab.conf`、`deploy/chunklab.service`、`package.json`、`diagnose.html` —— 以及它们的 `//`、`%XX`、`%2F`、`%2E` 变体族。
`/..%2Fserver/index.js` → **400**（nginx 直接拒绝非规范化路径，同样是 fail-closed）。

> 那 2 条 404（`/js/batch-sync.js`、`/content/manifest.json`）**不是误杀** —— 已核实这两个文件在线上**不存在**（属"线上还是旧版本"，见第 9 节）。

### 8.3 ⚠️ 本节最重要的一课：我第一版验证**得出了相反的结论**

- 第一版**只看状态码**（`%{http_code}`），量出「`//server/index.js`、`/%73erver/index.js` 仍是 **200**」，于是判定「nginx 的 `^~` 前缀匹配看不见编码后的路径，这层没用」。
- **这是错的。** 真相是 **nginx 确实会解码 `%XX`、合并 `//` 之后再匹配 location**，变体全部被它拦住。
- 之所以第一次量反了：**只看状态码无法区分"谁拦的"** —— Express 的静态守卫也返回 403。加了「看响应体」才发现真相。

**两条可复用的硬规则**：

1. **判"谁拦的"必须看响应体**，不能看状态码：
   - Express 守卫 → **纯文本 `Forbidden`**（`grep -qxF "Forbidden"` 可判）
   - nginx → **HTML 错误页**
   - 两侧都是 403 时，状态码**零区分力**。
2. **`systemctl reload nginx` 是异步的** —— 紧跟其后的请求仍可能被**正在收尾的旧 worker** 处理 ⇒ **拿 reload 后第一发请求做结论 = 假结论**。
   - 本次初始误判的根因**可以确证**：旧配置下 `/server/index.js` 由 Express 拦（403）、而变体 Express 拦不住（200）—— 与第一次观测**逐条吻合**，说明当时确实是旧配置在服务。
   - 附带坑：`systemctl show nginx -p ActiveEnterTimestamp` 在 reload 后**不变**，**不能**用它判断新配置是否已加载。

### 8.4 为什么 nginx 层有效（与 Express 层失效的原因正好互补）

| 层 | 行为 | 结果 |
|----|------|------|
| Express | 拒绝正则打在**未解码的 `req.path`** 上 | ❌ 被 `%73` / `//` 绕过 |
| nginx | **location 匹配前先规范化 URI**（解码 `%XX`、合并重复斜杠） | ✅ `/%73erver/…`、`//server/…` 先还原成 `/server/…` 再匹配 |

⇒ 两层**互补而非重复**。但**根治仍在 Express 侧**（第 7 节的 `static-guard.js`）—— nginx 只是把爆炸半径先收回来，且它只覆盖已列举的 4 个前缀。

---

## 9. 🔴 部署（行动 #1）未执行 —— 两个硬阻塞 + 三项风险

> 已获授权执行部署，但**执行前预检发现两个会让 `deploy-prod.sh` 必然中止的硬阻塞**。按「不兜底掩盖问题」原则**未强行推进**，先报告。

### 9.1 目标机（本次才确证）

`ubuntu@82.157.125.225`（腾讯云轻量；hostname `VM-0-2-ubuntu`；nginx 1.24.0；`chunklab` 服务 `active`；`/opt/chunklab`）。

- ⚠️ `~/.ssh/config` 里那条 **`139.224.101.82`（User root）不是这台机器**（SSH 握手直接被关闭）—— 那是别的项目，**别搞混**。
- ⚠️ 本机 DNS 走 **fake-IP 代理**：`chunklab.jqka.top` 在本机解析到 `198.18.0.76`（RFC 2544 保留段），DNS 服务器 `198.18.0.2` ⇒ **拿不到真实 IP，不能靠 DNS 判断目标机**。

### 9.2 硬阻塞 A —— `[0/9]` 本地回归在本机**必红**

- `deploy-prod.sh` 是 `set -euo pipefail` ⇒ **第 1 步失败即终止**。
- `[0/9]` 依次跑 `npm test`、`npm run test:accounts`、`node e2e/mobile-8000.test.js`。
- 本会话 QA 已实测：`TEST_RETRIES=0 npm test` = **115 通过 / 6 失败**（runId `qa-audit-20260921-full2`），6 红**同一根因**：宿主普通 node 冷启动 **5.4s**，而 `ready()` 窗口只有 **1.5–5s** ⇒ 必然超时。
- **重试救不了**：默认重试 = **仅 browser 组 1 次**，非 browser 组 **0 次**（`scripts/run-tests.cjs:113-115`）⇒ 超时是**确定性**的。
- ⇒ 不处理就**不可能**走完 `[0/9]`。

| 选项 | 说明 |
|------|------|
| **A. 先修 TEST-2（`ready()` 就绪窗口）** | 改为等待 `listening` 或放宽到 ≥10s。**根因修复**、改动小，修完全量在本机可跑通。推荐 |
| **B. 在服务器上跑一次全量替代** | 不动测试代码；但 `[0/9]` 设计上是本地跑，需额外证明口径 |
| **C. 接受跳过本机全量直接部署** | 明确记录"本次未取得本机绿色全量"，风险自担 |

### 9.2.1 阻塞 A 已修复（2026-09-21 晚 · 由你选定方案 A 后执行）

**根因（实测收敛，非推断）**：就绪窗口是**按轮询次数**计数的，于是窗口长度与宿主进程创建速度强耦合。5 个失败文件**恰好就是窗口 < 6s 的全部文件**，而下一个更小的档（8s）就通过了 ⇒ 阈值落在 **5s 与 8s 之间**，与实测冷启动 **5.4s** 完全吻合：

| 就绪窗口 | 文件 | 实测结果 |
|---------|------|---------|
| **4s**（40 × 100ms） | `deck-progress-diagnostic` / `main-startup` / `progress-coverage` / `stats-back` | ❌ `server 启动超时` |
| **5s**（50 × 100ms） | `mobile-8000` | ❌ `temporary server did not start` |
| 8s（40 × 200ms） | `stats-mastered` | ✅ 通过 |
| 10s / 12s / 16s / 24s | 其余 23 个 | ✅ 通过 |

**改动（7 处，只动窗口与预算，不动任何断言）**：

1. 4 个 e2e：`++tries > 40` → `++tries > 300`（4s → 30s）
2. `e2e/mobile-8000.test.js`：`i<50` → `i<300`（5s → 30s）
3. `scripts/run-tests.cjs`：`run(entry, options)` 支持**单次调用的超时预算覆盖**。原实现把预算在**模块加载时一次性固化**，逼得「夹具能否跑完」与「验证超时行为」共用一个常量 —— 这正是它只能在「宿主冷启动 < 1.5s」的机器上成立的根因。
4. `scripts/run-tests.test.js`：默认预算 `1500ms` → `60000ms`（宿主无关）；只有**验超时**的两条显式传 `{timeoutMs: 1500}` / `{timeoutMs: 20000}`；`hang` / `child-tree` 夹具改为**永不自行退出**（`setInterval`）⇒「被杀」成为唯一可能结局，该断言**不再测量宿主速度**；`waitUntilDead` 由 `20×50ms` 放宽到 `100×100ms`（Windows `taskkill /T /F` 收尾可能 > 1s）。

**为什么放大窗口不属「兜底掩盖问题」**：`/api/health` 一旦返回 200 **立即 resolve** ⇒ **成功路径上不增加任何耗时**，放大只改变「真的起不来时愿意等多久」。原实现的问题是**判定量（轮询次数）与被判定的事实（经过的时间）不对应**；修的是这个不对应，而不是把失败藏起来。

**顺带发现（需登记）**：`scripts/run-tests.cjs` 与 `scripts/run-tests.test.js` 在本仓是 **untracked（未提交）** 文件；`scripts/test-manifest.cjs` 是**扫盘生成**测试清单（非枚举），所以这两个文件是「新文件 + 自动收录」，`git diff` 看不到它们 —— 复核改动时**不能只看 `git diff`**。

### 9.2.2 阻塞 A 复验：失败原因是**另一个** —— 本机缺 chromium（与 9.2.1 的修复无关）

**2026-09-21 18:16 按方案 A 复跑 `[0/9]`（忠实复现，runId `20260921101814126-17016`）实测**：browser 组 **30 条全失败**、`timedOut=false`、耗时**高度一致 41.5–44.7s**。读 attempt 原始报错得：

```
browserType.launch: Failed to launch chromium because executable doesn't exist at
C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe
```

⇒ **不是就绪窗口，而是本机没有 Playwright chromium。** 证据链：

| 判据 | 实测 |
|---|---|
| `%LOCALAPPDATA%\ms-playwright\` 内容 | 仅 `b`(空) / `daemon/<hash>` / `cli-update-check.json` ⇒ **无任何 `chromium-*`** |
| `CHROMIUM_PATH` / `PLAYWRIGHT_BROWSERS_PATH` | **均未设置** |
| 上一轮（15:55–16:37）browser 组 | **pass=30 / fail=5** ⇒ 当时浏览器**存在** |
| `ms-playwright` 目录 mtime | **今天 16:57**；`cli-update-check.json` 的 `lastCheck` 同为 **16:57** |

⇒ **浏览器是在 16:57 被清掉的**（谁跑的 Playwright CLI：**推断，无日志证据，不写死归因**）。

**与 9.2.1 不冲突**：上一轮那 5 条的原始报错是 `server 启动超时` / `temporary server did not start`（已在 `qa-audit-20260921-full2/*.attempt-1.json` 逐条核实）⇒ 确实是窗口太短；**本轮 30 条是另一件事**。

**解法（已实测，零下载）** —— `CHROMIUM_PATH` 指向系统 Chrome：

```
export CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

- 系统 Chrome **153.0.8010.48** 存在；实测 `chromium.launch({headless, executablePath})` **1.6s 起停 + 页面正常取回**。
- 全部 e2e 已统一写 `process.env.CHROMIUM_PATH || chromium.executablePath()`（grep 命中所有 e2e）⇒ **不需要改任何代码**。
- 备选：`npx playwright install chromium`（约 150MB）。

**端到端实证（19:24 起，runId `20260921112459554-19664`）**：带该变量跑 `npm run test:browser` —— **第一条 `e2e:account-isolation` 即 `PASS 45.2s`** ⇒ 浏览器成功启动、套件真在跑。对比**不设该变量**时：30 条统一在 42s 报 `Failed to launch chromium because executable doesn't exist at ...\chromium-1234\...`。
⇒ **零下载解法从「推断」升级为「已实证」。**

**顺带暴露一个机制性隐患（建议登记为独立待办）**：`package.json` 声明 `playwright: ^1.53.0` / `playwright-core: ^1.53.0`，而 `^` 允许装到 **1.62.1** ⇒ 实装 `playwright-core`=**1.62.1**（Sep 13）、`playwright`=**1.53.0**（Sep 19），**同一依赖树两个主版本**；e2e 取 `playwright-core` ⇒ 期望 revision **1234**。**每次 install 都可能换 revision ⇒「A 机器能跑、B 机器不能」**。建议去掉 `^` 锁定版本。

**⇒ 阻塞 A 的定性要改**：它不只是「代码侧就绪窗口」，而是**代码 + 本机环境**的混合闸口。本机 browser 组的通过前提是「有 chromium 或设了 `CHROMIUM_PATH`」。

**`[0/9]` 复现的最终结果（19:17 结束，runId `20260921101814126-17016`）**：

| 组 | 通过 | 失败 |
|---|---|---|
| unit | **49** | **0** |
| checks | **5** | **0** |
| server | **5** | **0** |
| browser | 1 | **33** |

- **非 browser 项 0 失败**；browser 组**唯一那条绿的 `e2e:migrate-open-to-user.test`（57.3s）根本不 launch 浏览器** ⇒ **反证「browser 组 100% 的红 = chromium 缺失」**。
- 本次改动经实测通过：`scripts:run-tests.test` **PASS（74.9s）**、`scripts:deploy-safety.test` **PASS（106.2s）**。
- **候选未被测试污染**：测试前后的 `git status` 快照**完全一致**。
- ⚠️ 本次复现**在第 93/122 条被*我的复现脚本自身*的 1 小时超时 SIGTERM 中断**（截断于 `server:compress.test`），**不是测试失败**；`deploy-prod.sh` 的 `[0/9]` 本身无超时 ⇒ **真实部署不会这样中断**。
- ⏱️ **`npm test` 在本机 > 1 小时**（browser 33 红每条 42s × 2 次重试 ≈ 46 分钟纯浪费）；修好 chromium 后预计 **~25–30 分钟**。

### 9.2.3 阻塞 A 第二轮：首次真实部署在 `[0/9]` 再次撞红 —— **6s 窗口是临界窗口**

**事件**：commit 回滚点 `aa69fa1` 建好后启动 `deploy-prod.sh`，`[0/9]` 的 `npm test` 跑到 browser 组时出现 3 条红：

| 用例 | 结果 | 报错 |
|---|---|---|
| `e2e:account-isolation` | `FAIL(1) 42.5s` | `AssertionError: temporary server ready` |
| `e2e:account-login` | `FAIL(1) 42.5s` | `assert.ok(ready)` |
| `e2e:account-set-credentials` | `FAIL(1) 42.5s` | `AssertionError: server ready` |
| `e2e:batch-sync`（**同一 6s 窗口**） | **PASS 45.3s** | — |
| `e2e:api-compress` | PASS 52.2s | — |

**根因判据（决定性）**：**同一 6s 窗口下 `batch-sync` 本轮通过、另外三条本轮红** ⇒ 这是**临界窗口**，**不是「服务起不来」**（真起不来该整批一起红）。同批里 20s 窗口（`migrate-open-to-user`）与 30s 窗口（9.2.1 修的 4 个）**全部通过**，阈值正落在 6–20s 之间，与宿主冷启动实测 **5.4s** 吻合。

⚠️ **一处必须澄清的误读**：`42.5s` 与 6s 窗口对不上。多出的 ~36s 是**断言失败后 `finally` 里等 server 子进程退出**（`server.kill()` + `await ended`）的耗时 —— **不是启动耗时**，不能拿它当「服务要 42s 才起得来」的证据。

**修复（与 9.2.1 完全同构，不是新方案）**：

| 文件 | 改动 |
|---|---|
| `e2e/account-isolation.test.js` / `account-login` / `account-set-credentials` / `batch-sync` / `sync-outbox` | 就绪窗口 `60×100ms = 6s` → **`300×100ms = 30s`** |
| `e2e/stats-mastered.test.js` | `40×200ms = 8s` → **30s**（全库次薄，1.48× 余量） |
| `e2e/sync-recovery.test.js` | `100×100ms = 10s` → **30s**（1.85× 余量） |

**全库窗口审计（程序化扫描 `e2e/`，唯一判据，不靠肉眼）**：

- 修前最小 **4s**；修后最小 **12s**（`course-catalog` / `course-package-*(3)` / `exit-clears-choices` / `tab-content-consistency`，均 120×100ms）
- 其余分布：16s（40×400ms，14 个）/ 20s（1 个）/ 24s（3 个）/ 30s（12 个）
- ⇒ **零条 < 12s，最小余量 2.22× 冷启动**

⚠️ 放大窗口**不是兜底**：`/api/health` 一旦 200 立即 resolve/break ⇒ **成功路径零额外耗时**，放大只改变「真起不来时愿意等多久」。

⚠️ **同时记一条自污教训**：这一轮我**一边跑测试、一边每 2–3 分钟派 node / git / find / PowerShell 查进度** ⇒ 6s 临界窗口被这份额外负载推过线（同一批用例 19:24 机器空闲时 **35/35 全绿**）。**跑全量期间必须少派进程，否则测的是自己的负载。**

⛔ **本次部署已中止，且未碰生产**：运行 18m40s 时用 `TaskStop` 停掉，**全程停在 `[0/9]`** ⇒ 未上传、未重启、未改远端任何文件。⇒ `aa69fa1` 需在窗口修复后 **amend**，否则**回滚点 ≠ 部署内容**。

### 9.3 硬阻塞 B —— `[1/9]` env 预检**必然失败**

- 预检（`deploy-prod.sh:58-60`）要求 `/etc/chunklab/env` 含 `ADMIN_JWT_SECRET`(≥32) 与 `ADMIN_PASSWORD`(≥8)。
- 生产实际**只有 8 个键**：`AI_EXPLAIN_ENABLED`、`CORS_ORIGINS`、`JWT_SECRET`、`NODE_ENV`、`PORT`、`REQUIRE_AUTH`、`TOKEN_TTL`、`TRUST_PROXY` ⇒ **两个 `ADMIN_*` 都不存在**（已用只读方式列出**键名**，未读取任何值）。
- 已用 `git diff` 确证：这两条预检是**本轮新增**的 `+` 行，`deploy/setup-env.sh` 本轮也同步新增了这两项生成 ⇒ 生产 env 是 **2026-09-09 生成的旧文件**，**从来没有 admin 凭据**（管理后台从未启用）。
- ⇒ 属「**检查先于配置**」。补齐需要**你给一个管理员密码**（≥8 位）—— 我不能替你决定。

### 9.4 ⚠️ 重大信息：**这次部署不是"推一个安全补丁"**

线上当前版本（09-21 实测）与候选的差距：

| 项 | 线上现状 | 含义 |
|----|---------|------|
| `sw.js` cache | `chunklab-3d0b14d6` | 09-16 记录的老值，**9 天未变** |
| `main.html` | **250,205 B** | 与 09-16、09-21 两次实测**完全一致** |
| `content/` | **不存在** | 新内容架构从未上线 |
| `js/` | 仅 **15 个旧文件**（无 `core-*.js`、`main-*.js`、`batch-sync.js`） | 新模块化架构从未上线 |
| `server/index.js` mtime | **2026-09-11** | 后端也是 10 天前的版本 |

⇒ **线上跑的是 09-11 的旧版本**。本次部署 = **架构换血 + 内容 21.7×** 一次性发出，而不是 F-001 的补丁。
⇒ 且服务端启动迁移**有损**（`kv` blob 搬进行表并**删掉原行**）⇒ **回滚不能只回代码**。

### 9.5 三项风险（已核实，需你知悉）

1. **本机曾跑 Codex 运行时** —— 09-21 18:5x 观察到 `codex.exe`(PID 18552)、`codex-windows-sandbox-service.exe`(2444)、`codex-computer-use-swift.exe`(9056)、`codex-code-mode-host.exe`(17584)，与 09-17 记下的「另一个 AI 会话写同一工作区」同类。
   - **19:22 复核：本工作区已无匹配的 node 残留进程**（筛 `chunk-practice|run-tests|playwright|e2e` 零命中）⇒ 上一轮被 SIGTERM 的测试进程已完全退出，不会抢端口。
   - **另有独立旁证**：工作区存在 `.impeccable/`（其他 AI 评审工具的 config + `critique/*.md`，09-19），且 `src/core`（**今天 10:58**）、`src/main`（**今天 12:05**）有当日写入 —— 说明本工作区**同时被不止一个 AI 会话使用**。以上路径**均不在部署白名单**内，对本次上线无直接影响，但解释了「16:57 浏览器被清空」这类事件的可能来源。
   - 关键文件 mtime **静默**（最新 `server/index.js` 16:58 = 我自己的改动）⇒ 无正在写入的迹象。
   - ⚠️ **修正我先前的一处错误陈述**：我曾把部署描述成「`tar` **整个工作区**直接上线」——**不对**。`deploy-prod.sh:104` 是 `tar czf - "${FILES[@]}"`，只打 **FILES 白名单**（`:32-44`，约 100 个显式列出的文件）。⇒ ① 外部进程中途写入的风险**只覆盖这 ~100 个文件**；`scripts/`、`e2e/`、`extra/`、`deploy/`、`.workbuddy/`、`deliverables/` **根本不进部署包**。② 但「未 commit 也能发布」仍然成立（tar 读的是工作区文件，不是 git 对象）——所以回滚点仍然必要。
2. **工作区未提交**（HEAD `a88c690`；70 个已跟踪文件改动 + 大量未跟踪新文件）⇒ **不可审计、不可回滚**（memory 09-12 已记：「未提交 = 可工作不可交付」）。
3. **审计产物与候选的边界**（已核对 `.gitignore`）：
   - `.workbuddy/` **已被忽略**（`.gitignore:2`）⇒ 审计探针、`output/test-results/`、记忆文件**不会**出现在 `git status`，**也不会**进部署包（FILES 白名单里没有它们）。
   - **`deliverables/` 未被忽略** ⇒ ① 用 `git status` 做「候选未被污染」证明时会看到它（噪声，非外部污染）；② **若执行 commit，审计报告会被一并纳入** —— 需你决定是否先把它加进 `.gitignore`。

### 9.6 已确认的好消息

- ✅ **F-002 在生产不命中**：生产 `JWT_SECRET` 长度 = **64**（真随机）⇒ 你的「不轮换密钥」决定正确。
- ✅ 生产 `NODE_ENV=production` 与 `REQUIRE_AUTH=true` **均已设置**（各 1 处命中）。
- ✅ 生产 `/server/`、`/deploy/`、`package.json`、`diagnose.html` 现已**全部关闭**（第 8 节）。
- ✅ 目标机 SSH 免密可用、`ubuntu` 免密 `sudo`、`chunklab` 服务 `active`。

### 9.7 建议的推进顺序

1. **先解决阻塞 A**（推荐方案 A：修 `ready()` 窗口）→ 让 `[0/9]` 能在本机跑通。
2. **再解决阻塞 B**（你给 ≥8 位管理员密码 → 补 `/etc/chunklab/env`，并 `systemctl restart chunklab` 使其生效）。
3. **部署前最后一查**：`mtime` 是否"就在刚才"（防 Codex 半成品）；建议**先 commit** 以获得可回滚点。
4. 跑 `bash scripts/deploy-prod.sh ubuntu@82.157.125.225`。
5. 部署后**立刻跑** `bash scripts/deploy-security-smoke.sh https://chunklab.jqka.top` 复检（现已含变体族）—— 确认两层都生效。

## 10. ✅ 部署已执行并全绿（09-21 22:38 完成）

> 授权链：`1，2，要 3不要`（部署要 / nginx 止血要 / 密钥轮换不要）→ `按照你的建议执行`。

### 10.1 结果总览

| 项 | 值 |
|---|---|
| 起点 → 终点 | 21:39:07 → **22:38:03**（约 59 分钟） |
| `DEPLOY_EXIT` | **0** |
| 回滚点（代码） | **`92e810d`**（`aa69fa1` 已被 amend，作废） |
| 回滚点（数据） | `/opt/chunklab/server/backups/chunklab_db_20260921_223245.db`（417,792 B） |
| 服务 | `active`，`ActiveEnterTimestamp = 22:34:41`，`NRestarts=0` |

九步逐步结果：

| 步 | 结果 |
|---|---|
| `[0/9]` 本地全量 | **`passed 122/122`** ＋ `test:accounts` 全绿 ＋ `test:batch-sync`（26+22）＋ `mobile-8000` 19/19 ⇒ **本机首次取得绿色全量** |
| `[1/9]` env 预检 | OK（production + auth + strong JWT_SECRET + admin credentials）＋ 远端 `server/package-lock.json` sha256 与本地一致 |
| `[2/9]` 清单校验 | OK（FILES 114 项 / 运行时必需 241 项） |
| `[3/9]` 全库快照 | OK → `chunklab_db_20260921_223245.db`（408 KB） |
| `[4/9]` SW hash | `chunklab-9b717009`（与本地一致，**幂等**） |
| `[5/9]` 上传 | 114 个文件 |
| `[6/9]` 服务端校验 | 文件齐 + sw cache 一致 + 根路由存在 |
| `[7/9]` 落盘 + 重启 | OK |
| `[8/9]` 冒烟 | `{"ok":true,...}` + 根路由 302 |
| `[9/9]` 迁移 + `js/` 一致性 | `bridge.mjs` / `chunk-engine.mjs` / `distractor-cause.mjs` / `icons.js` **逐个 md5 与本地一致** |

⚠️ 执行过程中的一个环境噪声：这台腾讯云主机对每条 ssh 都打印「请使用微信扫码安全登录」横幅（云侧登录保护），**纯装饰、不影响命令执行** —— 不要把它误读成鉴权失败。

### 10.2 G3 · Express 侧修复在生产**真生效**（本次最关键的验证）

⚠️ **为什么不能用公网冒烟证明**：nginx deny（第 8 节）**先于** Express 生效，敏感路径在 nginx 层就被拦 ⇒ 公网**分不清是谁拦的**。所以判据是**登上服务器直打 `127.0.0.1:8787`**（绕开 nginx），并读**响应体**：

| 路径 | 码 | 响应体 | 归属 |
|---|---|---|---|
| `/server/index.js` | 403 | `Forbidden` | **Express 守卫** |
| `//server/index.js` | 403 | `Forbidden` | **Express 守卫** |
| `/%73erver/index.js` | 403 | `Forbidden` | **Express 守卫** |
| `/%2Fserver/index.js` | 403 | `Forbidden` | **Express 守卫** |
| `/..%2Fserver/index.js` | 403 | `Forbidden` | **Express 守卫** |
| `/%73erver/data/chunklab%2Edb` | 403 | `Forbidden` | **Express 守卫** ← F-001 的整库泄露路径 |
| `/server/data/chunklab.db-wal` | 403 | `Forbidden` | **Express 守卫** |
| `/package.json` · `/.env` · `/scripts/check-sw.js` · `/deploy/chunklab.service` · `/diagnose.html` | 403 | `Forbidden` | **Express 守卫** |
| 正控制：`/main.html` `/sw.js` `/api/health` `/manifest.json` | **200** | 正常内容 | **无误杀** |

**`403 + body="Forbidden"` 是 Express 守卫的签名**（nginx 返回 HTML 错误页）⇒ 这些 403 **确实来自代码侧修复，不是 nginx 遮蔽**。服务端逐条留痕（`journalctl`）：`GET //server/index.js 403`、`GET /%73erver/index.js 403`、`GET /%73erver/data/chunklab%2Edb 403` …

**最强的同一性证据**：`server/middleware/static-guard.js` 本地与线上 **md5 均为 `3866f12a7571d045cdc5639372b28a2b`** ⇒ **线上跑的就是被审查过的那一份代码**。

### 10.3 公网冒烟（在服务器上跑项目自带脚本，含变体族）

`bash scripts/deploy-security-smoke.sh https://chunklab.jqka.top` → **通过 48 · 失败 0 · 待人工判断 1 · 变体族被拒 165**

- 32 条敏感路径全 403 · **165 条变体全部被拒** · 前端 9 项资源全 200 · `/api/data` 401 · `/api/config` `requireAuth=true`
- 无 `X-Powered-By` · 有 HSTS · TLS 证书有效期至 **2026-12-08**
- 唯一 WARN = `Server: nginx`（信息性，非漏洞）
- ⚠️ **脚本一处误导话术（建议 1 行修复）**：WARN 分支（`deploy-security-smoke.sh:225`）硬编码印「按需加固（**package.json 拦截 / HSTS**）」，但本轮 **`package.json` 已被 403 拦住、HSTS 已存在** ⇒ 这句话会把未来读者引向两个**已经不存在**的问题。**正是本项目 200 天里反复吃亏的「误导话术」同类**，建议顺手改掉。

### 10.4 G4 · 迁移与数据完整性（只读核对）

- **启动日志无迁移行**（22:34:41–42）：`listening on ... (多用户模式)` / `[security] !! 未配置 DEEPSEEK_API_KEY` / `[compress] 预热 core.js 202KB · freq-idioms.js 412KB · main.html 302KB`
- **全历史日志搜「迁移」**：只有 **09-10 23:01:42** 两条（`stats 大对象迁移完成：5 用户 / 10 条句子档案 / 13 条事件`、`行级实体迁移完成：15 条 kv → 0/0/0`）⇒ **行级迁移 09-10 就已跑过** ⇒ 本次**无可迁移内容，故无日志**（与部署脚本自带提示一致，**不是「迁移被跳过」**）
- **快照（部署前）vs 现库 行数对比**（两侧 READ-ONLY 打开）：

| 表 | 部署前 | 现 |
|---|---|---|
| `users` | 33 | 33 |
| `user_kv` | 21 | **21** |
| `user_entity_rows` | 2 | **2** |
| `user_events` | 20 | **20** |
| `user_sentence_stats` | 15 | **15** |
| `user_decks` | 1 | 1 |
| `user_course_progress` / `user_courses` | 0 | 0 |
| `admin_users` | *（表不存在）* | **1** |
| `user_activity` / `user_batch_receipts` / `user_sync_resolutions` | *（表不存在）* | 0 |
| `user_change_seq` | 17 | 33 |

⇒ **无任何既有表的数据减少**。变化只有两类：① 新代码建了 4 张新表；② `user_change_seq` 17→33。

- `admin_users` 那 1 行 `created_at = 2026-09-21 14:34:42 UTC` = **服务启动那一刻**，用户名 `admin`（哈希已脱敏）⇒ **阻塞 B 补的 `ADMIN_PASSWORD` 真正生效了**，管理后台首次可用。
- `user_change_seq` 已查实：列为 `(user_id, seq)`，**33 行 / 33 用户 / 0 个用户缺行** ⇒ 是**每用户单调版本号**，补齐属**幂等初始化**，不丢数据。⚠️ 但「这 16 行是新代码启动时补齐、还是真实流量产生」**我没有任何证据区分** ⇒ 登记为**已观察 · 机制未确证**，**不作为阻塞**。

### 10.5 公网只读端到端（新内容管线真的能用）

| 检查 | 结果 |
|---|---|
| `/main.html` | 200 / 308,909 B / 48 个 `<script src>` / 含 `js/main.js`·`js/core-runtime.js`·`js/batch-sync.js` |
| `/content/manifest.json` | 200 / 101,932 B / 键 `schemaVersion,contentVersion,series,chapters,decks,catalog` / **66 个 deck** |
| 内容分片（内容寻址 `content/<deck>/<id>-<sha12>.json`） | **4/4 → 200**，`items` 数与 manifest `count` 一致（94 / 94 / 125 / 125），`has_chunks=true` |
| **sha256 完整性** | 抽样 4 个 deck / **12 个分片全部字节级一致**（实收 bytes = 声明 bytes，实算 sha256 = 声明 sha256） |
| 全库自洽 | 66 deck / **136 分片** / 2.8 MB / **136 个唯一 sha256（无重复）** / 0 个 count=0 分片 / 句数合计 **3677**（= 口语 3259 + 习语 418，与本地内容源口径吻合） |
| `/js/core-runtime.js`·`batch-sync.js`·`main-practice-state.js`·`chunk-shape.js` | 全 200 |
| `/sw.js` | 200 / 18,130 B / `CACHE=chunklab-9b717009` / 预缓存含 `content/`·`core-`·`batch-sync` |
| `/api/config` | `{"requireAuth":true,"serverVersion":1,"authAvailable":true,"aiEnabled":false}` |

⚠️ **能力边界（别夸大）**：以上是**只读**端到端。**没有**注册账号、**没有**提交任何练习、**没有**写入任何用户数据 ⇒ **「登录 → 练习 → 保存 → 同步 → 统计」这条写路径本轮未在线上实跑**（本地 `122/122` 已覆盖同逻辑）。若要补，会**在生产新建一个游客账号**（本项目游客账号**无清理机制**，会永久留在 `users` 表）⇒ **需你点头**。

### 10.6 门槛结算

| 门槛 | 状态 |
|---|---|
| **G1** `[0/9]` 本地全量绿 | ✅ `passed 122/122` |
| **G2** `[1/9]`–`[9/9]` 全绿 + 工作区 = `92e810d` | ✅ 全绿；部署前后 `git status` **完全一致**（仅 5 项刻意排除的 untracked）⇒ **宿主机上活着的 `codex.exe` 未在部署期间写入工作区**（风险未兑现） |
| **G3** Express 守卫在生产生效 | ✅ 服务器本地 12 条 `403 Forbidden` + 本地/线上 md5 同一 |
| **G4** 迁移 + 数据完整性 | ✅ 无既有表数据减少；本次无迁移必要（09-10 已迁） |

⇒ **4 条门槛全部达标；唯一未达标项：无。**

### 10.7 遗留（分栏登记，**均不阻塞本轮**）

| # | 事项 | 为什么不算本轮阻塞 |
|---|---|---|
| 1 | 写路径线上实跑（会新建游客账号） | 需你点头；本地 122/122 已覆盖同逻辑 |
| 2 | `deploy-security-smoke.sh:225` WARN 话术误导 | 提示层，1 行可修 |
| 3 | A1-RACE 统计提交竞态 | 上线前就存在，本次未修也未加剧 |
| 4 | CI-1（`build:check` 恒绿 / `browser` job 不自足） | 同上 |
| 5 | DEP-1（分号链不传播失败 / `curl` 无 `-f` / 固定 `/tmp`） | 本次 `DEPLOY_EXIT=0` 且九步均返回 OK，**未触发** |
| 6 | TOPO-1（`server/data` 仍在静态根内） | 已被 `static-guard` + nginx **双重覆盖** |
| 7 | `playwright` / `playwright-core` 版本分裂（`^`） | 环境侧，建议锁版本 |
| 8 | 密钥轮换 | **你已明确「不要」** |

### 10.8 ⚠️ 回滚预案（需你知情确认）

**只回代码不够。** 启动迁移是**有损**的（把 `mastered` / `reinforceBook` / `deletedItems` 从 `user_kv` blob 搬进 `user_entity_rows` 并**删掉原行**）⇒ **只回代码 = 标熟数据整块消失**。正确回滚 = **`git revert`（回 `92e810d` 之前）+ 用 `[3/9]` 快照 `/opt/chunklab/server/backups/chunklab_db_20260921_223245.db` 替换主库**。

> 本次实际**未发生**迁移（10.4 已证）⇒ 当前状态回滚只需回代码；但**下次**若真触发迁移，此条即生效。

## 11. 上线后：写路径验收（P0）＋ 两个新发现（09-21 23:0x–23:26）

> 授权链：`下一步什么建议？` → 我提出 P0（线上写路径实跑）→ **`做`**。

### 11.1 P0 线上写路径验收 —— ✅ **达标**

**方法**：真实浏览器 + 公网真实站点 + **真实 UI 手势**（点 `#stageChoices .choice` 选正确意群、点 `#btnMaster` 标记已掌握），**不注入任何 mock 脚本**（注入会绕开被验对象，等于没验）；**保留 Service Worker**（生产独有面）。

| 环节 | 观测 |
|---|---|
| 游客静默注册 | `POST /api/auth/register` **200** |
| 首页渲染 | 有内容（`9 月 21 日` / `从课程开始练习`） |
| 直达练习 `?direct=1` | 进入成功，练到**真实内容句** `Yeah, I slept in.` |
| **真实作答** | 排期行出现，文案 **`下次复习:1天后`** ⇒ SRS 真的算出来了 |
| 标记已掌握 | `#btnMaster` → `clicked` |
| 上行同步 | `CL.cloudSyncNow` → **3 次 `PUT /api/data` 全 200** |
| 服务端 seq | **0 → 3** |
| 服务端 bySentence | 出现 `oral-1-1-1#a941aad4` |
| **刷新后** | seq=3、条数=1 ⇒ **真·服务端往返，不是只写了本地 IndexedDB** |
| 统计页 | `待复习(0) 今日答题 1 已熟练 1 累计答题 1 答题 1 句` ⇒ **新行表读回 UI** |

**服务端行级差分（只读前后对比，可精确归因）**：

| 表 | 探针前 | 探针后 |
|---|---|---|
| `users` | 33 | **34** |
| `user_sentence_stats` | 15（4 用户） | **16（5 用户）** |
| `user_entity_rows` | 2（1 用户） | **3（2 用户）** |
| `user_events` | 20 | **21** |
| `user_kv` | 21 | **24** |
| `user_change_seq` | 33 | **34**，且该用户 **seq=3**（与浏览器观测 `0→3` 吻合） |

⇒ **新架构三张写入表（`user_sentence_stats` / `user_entity_rows` / `user_change_seq`）在生产第一次承接了真实新写入，且路径正确。** 在此之前，库里那些行**全部来自 09-10 的迁移**，不是新代码写的。
⇒ **部署后零真实访客**（最新真实用户仍是 09-21 10:03）⇒ 这条路径**除了主动验收没人会替你测**。

⚠️ **代价如实报数（修正我先前的说法）**：我先说"会留 1 个游客账号"，**实际留了 4 个**（id 36/37/38/39）—— 因为每个探针都是全新 profile，各触发一次静默注册。其中**只有 id=36 `guest_js7f65etnw` 有数据写入**；另 3 个（id 37/38/39）**零行、零 `user_kv`、连 `user_change_seq` 行都没有**，是纯探针副作用。管理后台**无删除端点**，清理只能直连 SQL（**属生产写操作，等你授权**）。
顺带确证：`user_change_seq` 行是**首次写入时才建**，注册不建（id 37/38/39 无该行）。

### 11.2 新发现：线上 SW 从未安装成功 ＋ 课程封面破图 —— **同一根因、用户可见**

**全部为直接证据，非推断。**

**① SW 安装错误原文**（CDP `ServiceWorker.workerErrorReported`，**3 次尝试全部复现**）：

```
Uncaught (in promise) TypeError: Failed to execute 'addAll' on 'Cache': Request failed
  sourceURL: https://chunklab.jqka.top/sw.js
→ Failed to register a ServiceWorker for scope('https://chunklab.jqka.top/'): ServiceWorker failed to install
→ status = redundant
```

**② `sw.js` 自身声明的安装语义**（`sw.js:57-58`）：`PRECACHE` 用 `caches.addAll` **一次性装好，任一失败即安装失败**（原话："不做『部分成功』的兜底"）⇒ 这就是**正确的失败语义**，问题在清单数据。

**③ 逐条核对线上 73 条 `PRECACHE`**：**72 条 200，唯一 404 = `/assets/catalog/lesson-placeholder.svg`**。

**④ 观察指纹全部吻合**：`registrations = 0` ＋ 缓存 `chunklab-9b717009` **存在但条目数 0** ＋ 每次导航都报同一个错。

⇒ **SW 装不上 ⇒ 预缓存 / 离线 / SW 更新全部失效**，且**对用户完全静默**（`main.html:5643` 只 `console.warn('[sw] 注册失败：')`）。

**同一根因的第二个后果 —— 用户可见破图**（真实浏览器 + `img.complete && naturalWidth===0` 判据）：

| 页面 | 结果 |
|---|---|
| `courses.html` | img **2 个 → 正常 0 / 破图 2**，且两个都 `visible=true`：`assets/covers/oral-3000.png`、`assets/covers/idioms.png`（各 404） |
| `main.html` | 无 img（不涉及） |

课程目录是用户点「去课程」后**第一眼**看到的页面，两张主封面就是**破图**。此外 `assets/catalog/oral-3000/` 下 **64 张课节封面**同样 404（展开课程时可见）。

**根因（单一、可定位到行）**：`scripts/deploy-prod.sh:41` 的 FILES 白名单里，`assets/` 下**只有一行** `assets/icons/teacher-explain.svg` ⇒ **`assets/covers/` 与 `assets/catalog/` 从来没进过部署包**。服务端实测佐证：`/opt/chunklab/assets/` **只有 1 个文件**（就是那个 icons）。

### 11.3 为什么这道闸没拦住它（**真正的根因**）

`[2/9]` 有 `node scripts/check-deploy-files.js`，但它的「运行时必需文件」来源**只有两个**：① 前端引用（`missingRefs`）② 后端 `require` 闭包。
⇒ **SW 的 `PRECACHE` / `PRECACHE_SOFT` 是第三个来源，从未被纳入校验** ⇒ 白名单与预缓存清单**长期漂移无人发现**。

**定性（按第 9 节框架，避免"清单永不收敛"）**：`git show a88c690:sw.js` 第 73 行**就已经列了这个 placeholder** ⇒ **上一版线上 `sw.js` 同样列它、同样 404、同样装不上** ⇒ 属「**上线前就存在、本次既不修也不加剧**」⇒ **不阻塞本轮**，**登记待办**。
⚠️ 但它**值得立刻修** —— 因为后果是**用户可见**的（破图）＋ **PWA 功能整体失效**。

### 11.4 修复建议（每条都指向根因，不做兜底）

| # | 改动 | 位置 | 性质 |
|---|---|---|---|
| **F1** | `assets/icons/teacher-explain.svg` → **`assets`**（目录形式；脚本已支持目录，如 `content`） | `scripts/deploy-prod.sh:41` | 数据修复，1 行 |
| **F2** | **给 `check-deploy-files.js` 增加第三个必需来源：解析 `sw.js` 的 `PRECACHE`/`PRECACHE_SOFT`，逐条要求被 FILES 覆盖** | `scripts/check-deploy-files.js` | **根因修复 —— 加上它，这次的 bug 会被当场抓住** |
| **F3** | `[1/9]` 预检补 `TRUST_PROXY=true`（本次已实测为真，但预检未查） | `scripts/deploy-prod.sh:55-61` | 1 行，防"反代部署忘开"回归 |
| **F4** | `deploy-security-smoke.sh:225` WARN 误导话术（见 10.3） | 同上 | 1 行 |

**代价与风险**：F1–F4 全部落在**部署/校验脚本**，**不碰任何运行时业务代码** ⇒ 风险极低（可 `bash -n` ＋ 本地跑 `check-deploy-files.js` 验证）。
⚠️ **但生效必须重跑一次部署**（`assets/` 与 SW 都要重新上传），且这会让**工作区 ≠ `92e810d`** ⇒ 需你授权后与其它改动**攒成一次**发出。

**明确不建议做的**：不要给 SW 安装失败加「用户可见提示」—— 离线是**增强能力、不是主流程**，加提示反而打扰用户；正确做法是让它**在部署期就红**（= F2）。

### 11.5 门槛结算（P0 后更新）

| 门槛 | 状态 |
|---|---|
| G1–G4（见 10.6） | ✅ 全部保持 |
| **G5** 线上写路径实跑 | ✅ **达标**（11.1：含服务端行级差分 ＋ 刷新后仍在） |
| **G6** SW / 离线线上可用 | ❌ **不达标 —— 但属"上线前已存在"，按纪律不计入本轮阻塞**，已登记待办（11.2 / 11.3） |

⇒ **本轮发布阻塞项：0。** 新增待办 2 条：**① SW 预缓存清单 ↔ 部署白名单漂移（含 F2 根因修复）② 课程封面未部署**。

### 11.6 ⚠️ 重新评估「这些操作是否必须」（09-22 晨，老板追问「仔细评估」）

**先补一条决定性证据 —— 破图规模实测**（真实浏览器，判据 `img.complete && naturalWidth === 0`）：

| 页面 | img 总数 | 正常 | 破图 |
|---|---|---|---|
| `courses.html`（首页 →「去课程」） | 2（组封面） | 0 | **2** |
| **`decks.html?course=builtin%3Aoral`（点「口语3000句」之后）** | **65** | **0** | **65** |

⇒ 用户走「去课程 → 口语3000句」这条**主浏览路径**，看到的是「**65 个课节**」标题下 **65 张封面 100% 破图**。这**不是两张装饰图，是核心浏览界面的视觉整体崩坏**。

**规模**：`assets/` = **68 文件 / 37 MB**（catalog 65 件 34MB · covers 2 件 3MB · icons 1 件 4KB）；**线上只有 1 个**（icons）；全库引用 `assets/*` 去重 **73 处**，覆盖全部 68 个文件 ⇒ **缺 67 个文件**。

**逐条重新定级**（我之前把 F1–F4 一律称作"建议"，**这是不诚实的**，现按必须性分级）：

| 项 | 必须？ | 依据 |
|---|---|---|
| **部署 `assets`（67 文件 / 37MB）** | ✅ **必须** | ① 主浏览路径 **65/65 破图**；② `PRECACHE` 里的 placeholder 404 ⇒ **SW 安装整体失败**（离线/预缓存全废）。两条都用户可见。 |
| **F1**（`deploy-prod.sh:41` 的 `assets/icons/teacher-explain.svg` → `assets`） | ✅ **必须改，但不必马上发** | 不改它，**任何一次全新部署 / 换机 / 重装环境都会重现**此缺陷。1 行。 |
| **F2**（让 `check-deploy-files.js` 校验 `PRECACHE`） | 🟡 **强烈建议（防"第三次"）** | **有本项目自己的历史证据**：`deploy-prod.sh:145-146` 注释原话「**2026-09-10：FILES 曾漏整个 js/ 目录**，部署"看起来成功"但线上仍是旧文件」。⇒ **同一根因这是第 2 次**；且 09-10 那次只补了「4 个 js 文件 md5 比对」这种**窄护栏**，所以 `assets` 又漏了。F2 是把护栏**泛化**为"任何 `PRECACHE` 条目都必须被 FILES 覆盖"。 |
| **F3**（`[1/9]` 补 `TRUST_PROXY` 预检） | ⭕ **可选** | 实测已为 `true`；只防"将来重装服务器忘配"。近期不重装 ⇒ **不做也没有任何现存影响**。 |
| **F4**（smoke 脚本 WARN 文案） | ⭕ **可选（甚至可不算）** | 纯话术，**零行为影响**。 |
| **清理探针账号** | ❌ **不必做，撤回提议** | 见下方修正后的代价。 |

**代价修正（我先前说了两次数，都不对，这是第三次、也是准的）**：探针累计新建游客账号 **6 个**（`users` **33 → 39**）。其中**只有 `guest_js7f65etnw`(id36) 有练习数据**，其余 5 个零行、零 `user_kv`、连 `user_change_seq` 行都没有 —— 纯探针副作用。清理它们需要**一次生产 SQL 写**（不可逆、绕过全部护栏）⇒ **性价比为负，撤回该提议**。
（教训：每个 `newContext()` 都会静默注册一个账号，**报代价前必须数，不能估**。我先后估成 1、4，实际 6。）

**关于「要不要重跑整条 9 步部署」—— 有一个风险低得多的替代，判据来自代码本身**：

- `deploy-prod.sh:120` 落盘是 `sudo cp -r "$STAGE"/. "$APP"/`，**没有 `--delete`** ⇒ **手工补进去的静态文件不会被下次部署冲掉**。
- 静态资源**不需要重启**（`[7/9]` 的 restart 是为 `server/` 代码）。
- **SW 会自愈**：`sw.js` 响应头 `Cache-Control: public, max-age=0` ⇒ 每次导航都做更新检查；且线上 SW **从未安装成功**（无 active worker）⇒ **不存在"旧版占位"**，补上文件后**下一次访问即安装成功**，**不需要升 CACHE 版本、不需要用户清缓存**。

⇒ 两条路，**我建议 A**：

| 路线 | 动作 | 时间 | 风险 | 代价 |
|---|---|---|---|---|
| **A（建议）** | 只把 **67 个静态文件**补到 `/opt/chunklab/assets/`（**不重启、不跑回归**）＋ F1/F2 **只提交不部署** | 分钟级 | **极低**：纯新增静态文件、可逆（删掉即回原状）、不碰代码/DB/服务 | 绕过正式部署流程**一次**（需你知情） |
| B | 改 F1/F2 → **重跑整条部署** | ~59 分钟 | 122 条全量回归 ＋ 服务重启（有中断窗口） | 破坏「工作区 == `92e810d`」 |

⚠️ **A 与 B 都是"外部动作"，我会等你明确指令再动手。**

**明确不做**（撤回我先前"建议"的口吻）：给 SW 安装失败加用户提示（离线是增强能力，加提示是打扰，且问题仍未修）；轮换密钥（你已定：不要）。

### 11.7 对「另一份建议」的评估（09-22 晨，老板转来 4 条建议）

**总评：方向对，4 条我都同意；其中第 2、3 条比我自己写得更准确，我认。** 但它有**一个结构性缺口**（见下「缺第 0 条」）。

**先给第 2 条补一条决定性证据 —— 我实测了 `PRECACHE` / `PRECACHE_SOFT` 与 `FILES` 的覆盖关系**：

| 清单 | 条数 | 未被 FILES 覆盖 |
|---|---|---|
| `PRECACHE`（原子 addAll） | 73 | **1** —— `/assets/catalog/lesson-placeholder.svg` |
| `PRECACHE_SOFT`（失败不拖垮安装） | 67 | **66** —— `builtins.js` 已覆盖；缺失的是 **2 张组封面 + 64 张课节封面** |
| 合计 | 140 | **67**（与「线上 `assets/` 只有 1 个文件、缺 67 个」逐一对上） |

⇒ **只校验 `PRECACHE` 只能抓到 1 条，破图那半边（66 条）会整个漏过去。** 所以第 2 条"同时解析 `PRECACHE_SOFT`"**不是加分项，是必要条件** —— 这是它比我原表述更准的地方。
⇒ 并且验算过：F1 落地后 **67 条全部被覆盖，护栏可达绿** ⇒ **不会造出一个恒红的护栏**（那会变成另一种"清单永不收敛"）。这一点必须先验，否则就是把 bug 换成噪音。
⇒ 顺带解释了这个缺陷为何发生：`/assets/icons/teacher-explain.svg` **同时出现在 `PRECACHE` 和 `FILES` 里** ⇒ 说明 `FILES` 一直是**手工"看到 PRECACHE 加了什么就补什么"**在维护；placeholder 与 66 张封面加进清单时，没人同步 FILES。
⇒ 副作用：**每次部署都会重传 37MB**（`[5/9]` 全量 `tar` 上传，PNG 几乎不可压缩）。可接受，但要知道这是 item 1 的持续成本。

**对 4 条的逐条意见**：

| 条 | 我的意见 |
|---|---|
| **1** `assets/icons/teacher-explain.svg` → `assets` | ✅ 同意。**建议写成 `assets/catalog assets/covers assets/icons` 三个子目录**更稳妥：同为 37MB，但避免将来有人往 `assets/` 扔非运行时大文件被无条件带上。若更看重"将来新增子目录不会再漏"，用父目录 `assets` 也成立 —— **这是个取舍，不是对错**。 |
| **2** 校验 `PRECACHE` **和** `PRECACHE_SOFT` | ✅ 同意，且**我把它的优先级上调**：见上表，它是唯一能同时抓住「SW 装不上」和「65 张破图」两半的检查。 |
| **3** 加 `TRUST_PROXY=true` 预检，**但不对直连部署强制开启** | ✅ 同意，**而且这条写得比我准**。我原先只说"补个预检"，没意识到：**直连部署若被强制设成 `true`，反而让客户端可以伪造 `X-Forwarded-For` 绕过限速** ⇒ 无条件强制是**负优化**。它的"按拓扑区分"是对的。⚠️ 但仍属**可选**：实测线上已是 `true`，不做无现存影响；要加就得按它这个条件式来加。 |
| **4** 探针账号先别删，若清理先单独确认 + 备份 | ✅ 同意，且**比我稳**。我先前只说"撤回提议"，它给了正确程序（确认身份 → 备份 → 再清）。**再补一层**：真正的缺口不是"这 5 行"，而是**管理后台没有删除端点** —— 手工 SQL 清理永远需要"单独确认+备份"，说明缺的是产品能力。 |

**❗ 最重要的缺口：这 4 条没有一条修"现在"**

4 条全部是**改脚本 / 改护栏**，即"**下次部署才生效**"。而线上此刻的状态是：**65 个课节封面 100% 破图 ＋ SW 装不上（离线全废）**。若只做这 4 条，用户还要盯着破图直到下一次部署（而本项目上一次部署间隔是 **9 天**）。

**应补第 0 条（止血，且已被代码级判据证明很便宜）**：只把 67 个静态文件补到 `/opt/chunklab/assets/`。
- `deploy-prod.sh:120` 是 `sudo cp -r`（**无 `--delete`**）⇒ 手工补的文件**不会被下次部署冲掉**，与第 1 条不冲突。
- 静态资源**不需要重启**；**SW 会自愈**（`max-age=0` 每导航做更新检查 ＋ 线上从无 active worker ⇒ 无旧版占位）⇒ **不升 CACHE、不让用户清缓存、下次访问即好**。
- 并需**明确判据**（本项目最看重的一条）：补完立刻重跑 ①`precache-probe`（应 73/73 全 200）②`broken-images`（应破图 0）③CDP 看 SW 是否 `activated`。**没有判据就等于"看起来修好了"。**

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
> **生产环境变更记录**（按时间）：① 09-21 17:52 nginx 层 deny 规则（第 8 节，已生效并复验，备份 `/root/chunklab-nginx-20260921-175215.conf.bak`）；② 09-21 18:31 往 `/etc/chunklab/env` 追加 `ADMIN_JWT_SECRET` / `ADMIN_PASSWORD`（备份 `/root/chunklab-env-20260921-183139.bak`，**零停机**）；③ 其余线上动作仅限只读探测；④ **09-21 21:39–22:38 生产部署已执行成功**（第 10 节，`DEPLOY_EXIT=0`；代码回滚点 `92e810d`；数据快照 `/opt/chunklab/server/backups/chunklab_db_20260921_223245.db`）；⑤ **09-21 23:11 – 09-22 00:57 写路径验收 + 只读探测**（第 11 节，经授权）—— 期间在线上**真实注册并写入**，**累计新建 6 个游客账号**（`users` **33 → 39**；仅 `guest_js7f65etnw` 有练习数据，其余 5 个为零数据探针副作用），**未删除（后台无删除端点）**。
> **未做**：未下载库体、未读取任何**真实用户**的数据内容（只核对了行数；第 11 节涉及的账号均为本次探针新建）、未读取任何密钥值、未轮换凭据、未修改任何线上文件。
