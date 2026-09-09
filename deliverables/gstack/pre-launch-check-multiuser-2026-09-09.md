# Chunk Lab 上线前全检 · 多人使用就绪度评审

**日期**：2026-09-09
**场景**：上线前检查（多人使用 / 公网部署就绪度）
**参与成员**：产品评审员（gstack-product-reviewer）+ 安全官（gstack-security-officer）+ 质量门神（gstack-qa-lead）
**被测 HEAD**：9524707（工作树干净）

---

## 📌 TL;DR（执行摘要）

- 整体结论：🟡 **条件通过** —— 「小圈子自用（朋友/同事，几十人内）」配置到位即可上线；「公网公开运营」No-Go，需先清 2 项 P0 阻塞 + 认证面加固。
- 阻塞项数量：**2 项 🔴 P0**（开放模式公网裸奔、`.git` 经 HTTP 全量泄露）—— 均为**配置/3 行代码**级修复，非架构问题。
- 代码质量侧：回归基线 **380✓/0✗**（npm test）、e2e **69✓/0✗**；多用户模式 API 层实测（注册/登录/数据隔离/401/export 鉴权）**全 PASS**。
- 下一步：按行动清单清 P0 → 小圈子先行上线；公开运营另需账号生命周期 + 隐私合规。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🟡 **条件 Go**（受控小圈子）/ 🔴 公开运营 No-Go |
| 严重度分布 | 🔴 2 / 🟠 5 / 🟡 7 |
| 关键行动项 | 7 条（P0×2 → P1×5） |
| 建议负责人 | 后端加固：项目 Owner；部署：自行托管（Nginx/systemd）；迁移：Owner + 备份脚本 |

---

## 1. 各成员核心结论

### 🎨 产品评审员（产品模型）
- 核心判断：**条件性 Go，仅限小圈子自用；公开运营 No-Go**。现状开放模式多人使用 = 致命（全体共享 `__default__` 单用户，学习进度互相整键覆盖，个人资产被污染即价值归零）。
- 关键建议：多用户代码/登录 UI 后端已就绪（P0 前置纯配置）；但缺「退出/切换账号」入口（`auth-ui.js:125` logout 无任何调用）；开放→多用户切换有存量数据锁死盲区，需「备份→建号→import」迁移流程。

### 🛡️ 安全官（OWASP + STRIDE 审计，实测起临时实例验证）
- 核心判断：多用户代码路径本身**设计正确**（user_id 全程取自已验 token、SQL 全参数化、越权隔离实测通过）；但 **2 项 P0 必须阻塞**：① 开放模式公网裸奔（免 token 任意读写/import/export/注册）；② `.git` 经 HTTP 全量泄露（静态拦截漏配，攻击者可重建全部源码与历史）。
- 关键建议：上线前置 = `REQUIRE_AUTH=true` + 强 `JWT_SECRET`（fail-fast 已有✓）+ 封 `.git` 静态泄露 + CORS 白名单 + 登录注册限速锁定。

### ✅ 质量门神（QA 实测回归 + 多用户实测 + 发布清单）
- 核心判断：**条件 Go**。代码/数据/鉴权质量达标、回归与多用户实测全绿；但公网直接上线前须补发布缺口（静态托管防护、登录限流、进程守护、备份 token 运维）。**受控内网可先行**。
- 关键建议：发布目录白名单（Express Forbidden 规则在 Nginx 直托管下失效）、登录暴力破解限流、备份 token 生命周期管理、补 `REQUIRE_AUTH=true` 浏览器级 e2e。

---

## 2. 上线判定 · 阻塞项清单 + 回滚预案

### 🔴 阻塞项（上线前必须清）

| # | 阻塞项 | 证据 | 修复 |
|---|--------|------|------|
| B1 | 开放模式公网裸奔 | 实测免 token GET/PUT `/api/data`、POST `/api/import\|export`、注册任意账号均 200；公网 = 任何人可一键清空/伪造全部用户数据 | 生产强制 `REQUIRE_AUTH=true`（启动断言）+ 强 JWT_SECRET + 禁开放模式 |
| B2 | `.git` 经 HTTP 全量泄露 | `server/index.js:434` 静态拦截漏配；实测 `/.git/config`、`/.git/logs/HEAD`、`/.git/objects/*` 均 200 | 黑名单补 `.git`、`e2e`、`.env*`（约 3 行） |

### ↩️ 回滚预案
- 代码：git 回滚发布 tag / revert（基线干净 HEAD=9524707）。
- 数据：数据库文件（`CHUNKLAB_DATA_DIR`）+ `/api/export` 全量备份双保险（backup-cli 每日已备）；回滚时整体替换数据目录即可。
- 模式：若生产事故需降级，开放模式**仅限受控内网**使用，公网一律回滚而非降级。

---

## 3. 综合审查发现（去重合并后按严重度排序）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源 |
|---|--------|------|------|---------|------|------|
| 1 | 🔴 | 认证/数据 | server/index.js（开放模式默认） | 开放模式 = 全体共享 `__default__`，免 token 任意读写/导入导出/注册；多人使用互相整键覆盖进度 | 上线强制 REQUIRE_AUTH=true + 启动断言禁开放 | 产品+安全+QA |
| 2 | 🔴 | 信息泄露 | server/index.js:434 | `.git` 目录经 HTTP 全量可下载，源码与 113 条历史泄露 | 静态黑名单补 `.git`/`e2e`/`.env*` | 安全 |
| 3 | 🟠 | 认证爆破 | server/auth.js:47,61 | 登录/注册无限速无锁定（实测 12 次连续 401 无 429）；注册重复名可枚举账号 | IP 级限速 + 失败锁定 + 开放模式禁 register | 安全+QA |
| 4 | 🟠 | CORS | server/index.js:31-40 | `CORS_ORIGINS` 留空时回显任意 Origin 且 credentials:true，恶意网页可驱动数据破坏 | 上线配显式白名单，空则拒绝跨域 | 安全 |
| 5 | 🟠 | 账号 UX | auth-ui.js:125 | 「退出/切换账号」函数已定义但无任何调用，共用电脑锁死单账号 | 补 ~5 行 UI 入口 | 产品 |
| 6 | 🟠 | 存量迁移 | __default__ 用户 | 切 REQUIRE_AUTH=true 后 `__default__` 密码为随机值（auth.js:41），存量共享数据被锁死无法认领 | 备份 → 建号 → /api/import 迁移 + README 步骤 | 产品 |
| 7 | 🟠 | 部署暴露 | Nginx 直托管 | Express Forbidden 规则在纯静态托管下失效，`server/`、`node_modules`、`*.md` 会被直接伺服 | 发布目录白名单或复刻禁访规则 | QA |
| 8 | 🟡 | 数据正确性 | core.js:355-368 | mastered/best 等仍整键 LWW，双设备离线并发会静默覆盖（单设备无碍） | 深度合并或 UI 明示多设备冲突 | 产品 |
| 9 | 🟡 | 运维 | 备份 cron | 备份依赖 TOKEN 但 TTL 30d，过期后每日备份静默失败 | 服务账号 + 自动换 token | QA |
| 10 | 🟡 | 部署 | — | 无 systemd/Docker 守护、无 Nginx 反代 + TLS 样例、README 未写 Node≥18 | 补发布模板 | QA |
| 11 | 🟡 | 测试覆盖 | e2e | e2e 只在开放模式跑，auth-ui 登录 UI 无浏览器级回归（本次仅 API 层验证） | 补 REQUIRE_AUTH=true + 登录 UI 用例 | QA |
| 12 | 🟡 | 数据隔离 | ai_cache（全局表） | export 返回全表、import 可任意写入缓存 key（AI 恢复启用后 = 跨用户泄露/投毒） | AI 恢复前按用户隔离 | 安全 |
| 13 | 🟡 | 加固 | — | 无 CSP/HSTS 安全头 + JWT 存 localStorage（残余 XSS 放大为盗号）；token 30d 无撤销/登出/改密 | 安全头 + 会话管理 | 安全 |
| 14 | 🟡 | 文档 | README / .env.example | smoke 63→实为 65；e2e 路径 output/e2e→实为 e2e/e2e.js；SW 缓存机制已改内容哈希；.env.example 缺 AI_EXPLAIN_ENABLED | 同步文档 | QA |

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | 生产配置：`REQUIRE_AUTH=true` + 强 `JWT_SECRET`（env）+ `CORS_ORIGINS` 白名单 + 启动断言禁开放模式 | Owner | P0 | 上线前 |
| 2 | `server/index.js` 静态黑名单补 `.git` / `e2e` / `.env*`（实测封堵 200） | Owner | P0 | 上线前 |
| 3 | `server/auth.js` 登录/注册加 IP 限速 + 失败锁定；开放模式禁 register | Owner | P1 | 小圈子上线前 |
| 4 | 存量 `__default__` 数据：/api/export 备份 → 建号 → /api/import；README 补模式切换步骤 + 「退出账号」UI 入口 | Owner | P1 | 小圈子上线前 |
| 5 | 发布：Nginx 目录白名单/反代 + systemd/Docker 守护 + TLS；备份 token 生命周期管理 | Owner | P1 | 小圈子上线前 |
| 6 | e2e 补 `REQUIRE_AUTH=true` 实例 + auth-ui 登录/退出浏览器回归 | QA | P1 | 小圈子上线前 |
| 7 | 恢复 AI 功能前：ai_cache 按用户隔离 + export/import 排除缓存表 | Owner | P2 | AI 重启前 |

---

## ✅ P0 修复落地记录（2026-09-09，同日下午）

| 阻塞项 | 修复 | 文件 | 验证 |
|--------|------|------|------|
| B1 开放模式公网裸奔 | ① `NODE_ENV=production` 且非 `REQUIRE_AUTH=true` → 拒绝启动（exit 1）；② JWT_SECRET 强度下限 32 字符（assertSecure 升级）；③ CORS fail-closed：未配 `CORS_ORIGINS` 白名单一律不回显 ACAO（原为回显任意 Origin + credentials） | server/index.js、server/auth.js、server/.env.example | smoke 新增 3 断言全过；8787 实测 evil Origin 无 ACAO |
| B2 `.git` 经 HTTP 全量泄露 | 静态黑名单补 `.git`/`.env*`/任意 dotfile/dotdir + `e2e`/`deliverables` + `bak/tmp/log/db/sqlite*` 后缀 | server/index.js | smoke 新增 5 断言全过；8787 实测 `/.git/config`/`/.env`/`/e2e/e2e.js` → 403，`main.html` 仍 200 |

- smoke：**63 → 73**（+8 条 P0 回归：静态黑名单×5、CORS×1、静态白名单×1、生产断言×1）
- 本地 dev 不受影响：未设 NODE_ENV 时仍开放模式免登录（8787 已用新代码重启，main=200）
- 后续上线只需：部署侧注入 `NODE_ENV=production` + `REQUIRE_AUTH=true` + `JWT_SECRET`(≥32) + `CORS_ORIGINS`（跨域前端才需要）

## ✅ P1 修复落地记录（2026-09-09，续）

| 发现 # | 修复 | 文件 | 验证 |
|--------|------|------|------|
| #3 认证爆破 | 纯内存固定窗口限速（15 分钟/IP）：登录失败 10 次 → 锁定 429（成功清零，防误锁）；注册成功/失败都计数 10 次/IP → 429；响应带 Retry-After。**开放模式（REQUIRE_AUTH=false）下 register/login 一律 403**（无意义且有滥用面）；反代场景 `TRUST_PROXY=true` 信任第一跳 XFF | server/index.js、server/.env.example | smoke 新增 6 断言全过；8787 开放模式实测 register/login → 403 |
| #5 账号 UX（部分） | —（退出/切换账号 UI 仍待做，函数已有） | — | — |

- smoke：**73 → 79**（+6 条 P1 回归：登录锁定×2、注册超限×1、/me 不误伤×1、开放模式禁注册/登录×2）
- 已知边界：限速为单实例内存实现，多实例负载均衡部署需换 Redis（代码内已留注释）；`__default__` 存量数据迁移与「退出账号」UI 仍未做（P1 剩余项）
- npm test 全量 0 失败（chunk-engine 45 / format 16 / ai-prompts 24 / backup 24 / rev 35 / smoke 79 / backup-cli 9）

---

## ⚠️ 待完善 / 已知局限

- 公开运营（面向陌生用户）还差：账号注销/改密/找回、注册限流或邀请码、隐私政策、deck 市场审核下架——本次按「小圈子自用」口径评估，未深究合规。
- AI 详解为已知停用决策（503），报告中的 ai_cache 风险为「AI 恢复前必修」潜伏项，不阻塞当前上线。
- mastered/best 整键 LWW 仅在双设备离线并发时暴露，本次无浏览器级多端并发实测，属残余风险。
- 本次安全/QA 实测均在本地临时实例完成（已清理），未在真实公网拓扑（Nginx/CDN）下复验。

---

## 📚 成员产出索引

- gstack-product-reviewer（产品评审员）原始产出：产品模型判定 + 产品侧前置清单（条件性 Go，仅小圈子）
- gstack-security-officer（安全官）原始产出：OWASP/STRIDE 审计（2 P0 + 3 P1 + 4 P2，附实测证据与端口）
- gstack-qa-lead（质量门神）原始产出：回归基线实测表 + 多用户 API 实测（5 项全 PASS）+ 发布缺口清单

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
