# 会员权益、兑换码与免费体验

- Status: needs-planning
- Superseded execution architecture: 用户已明确要求所有平台课程统一受控、保留静态正文并使用短期授权；后续执行使用 `2026-10-15-unified-static-course-delivery.md`。本文件保留已完成会员账本、体验规则和验证记录；不得再沿本文件扩展独立 protected 学习页面。
- Updated / reviewed: 2026-10-14；规划复核版 2
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit: 8e19498f3bd7a8d9d7776b7e02a074689d0b0f81；工作区有大量既有修改/新增文件。只更新本文，保留所有不相关工作。
- 相关既有改动包括 server/db.js、server/index.js、operations、ContentRepo、main 入口、制课模块、构建文件、账号 UI 和多个 HTML/SW；library 路由为既有未追踪文件。执行从这些当前内容继续，不按 base commit 整文件还原。
- Planner: Astra–Luna planning workflow；不推断当前会话模型。
- Executor: GPT-5.6 Luna（执行阶段按用户流程切换）。

## Objective

交付一个能实际使用的会员闭环：管理员配置体验规则和课程访问级别，生成兑换码并导出给外部平台销售；用户在自己的账号兑换，获得月/季/年会员权益；会员课程根据服务端权益或体验额度放行，到期/超限后停止新学习，续期后从原位置继续。免费课程、个人创作/导入课程和个人学习记录按原有规则保留。发布前通过隔离环境验证实际页面、内容读取和账号持久化。

## Current state and evidence

- 账号入口在 `server/auth.js`、`server/routes/auth.js`、`auth-ui.js`；开放模式所有请求可落到 `__default__`，真实会员不能使用这个共享身份。手机号身份在 `server/services/phone-auth.js` 的 `user_phone_identities`；不能仅凭浏览器里有 token 就认定用户有可恢复的账号。
- `server/services/operations.js` 已有 protocol 3 事务、请求/事件去重收据；`course-enrollment` 表示加入课程，和付费权益无关。续期不改课程加入关系。
- `js/course-catalog.js`、`server/services/library-catalog.js`、`server/routes/library.js` 提供目录/引用，公开目录当前使用共享缓存和 ETag，不能往这个公开响应混入某个用户的会员信息。
- `server/routes/content-shards.js` 只保护分片路径表。`js/content-repository.js` 的详情和索引直接请求静态 URL，并读内存/IndexedDB 缓存。索引也含中英文正文，必须纳入保护。
- `scripts/build-content.mjs` 从 `oral-book.js`、`freq-idioms.js` 等源生成不可变 hash 分片；提供 `CONTENT_SOURCE_ROOT` / `CONTENT_OUTPUT_ROOT` 以便隔离构建。不可删除/覆写原内容来做权限改造。
- `server/index.js` 依次挂载静态守卫、`server/compress.js` 和仓库根目录静态服务。保护接口之外，还必须拦截源题库、旧分片、压缩副本和其他正文出口。仓库的 `deploy/nginx-chunklab.conf` 当前把请求反代到 Express；其他生产 CDN/对象存储配置不能据此推定已安全。
- `server/routes/decks.js` 的 `/api/deck/public/:id` 返回完整 items；`server/routes/data.js` / `backup.js` 返回用户自己的快照。必须区分公开平台正文出口和用户已经拥有的资料/历史，不能统一加付费墙。
- 图文课程通过 `src/course-authoring/adapters/image-text-package-adapter.mjs` 处理素材，个人包可能含完整正文/data URI。平台会员图文课程需要服务端内容与素材入口；不能先把整包复制到个人快照再声称可随时收回。
- 学习记录写入包括 `server/services/learning-event-operations.js`、`course-learning-operations.js`、`assessment-operations.js`；已有 `learning.exposure` 是曝光，不是学习秒数。晚到的记录保存不能因为会员到期而堵住整个同步队列。
- 前端实际入口包括 `src/main/entry.mjs`、课程导航/练习模块、`js/learning-workspace-runtime.js` / view、`courses.html`、`decks.html`、`stats.html` 和 `main.html` 账号设置区；管理入口为 `admin.html`、`content-studio.html`。
- 服务端是 CommonJS、最低 Node 18；新增纯策略若写为 `.mjs`，必须经现有 esbuild 流程生成服务端 CommonJS 产物，不能直接由 Node 18 `require(.mjs)`。
- `package.json` 的 `npm test` 有会重建生成物的 pretest。执行时先用本文列出的定向命令；本轮规划复核没有运行测试或启动服务。
- `AGENTS.md` 要求保护真实课程/账号/备份；持久化/迁移测试只用新临时目录与隔离端口，不能重启 live service。词汇插图 20,000 bytes 限制继续有效，本任务不改它。

## Review findings resolved

| 优先级 | 原规划的问题 | 本版处理 |
| --- | --- | --- |
| P1 | 只存摘要，却把生成和以后导出拆开，无法恢复原码 | 合并成一次“生成并下载”，生成后提交摘要，明文仅保留本次响应内存；批次先暂停，失败批次不激活 |
| P1 | 未定义配置实体，且把试用规则硬编码成 3/1800 | 版本化体验配置、用户启动时快照、窗口用量；配置变更只作用于未开始的新体验 |
| P1 | 原始 JS/公开题库/图文素材可绕过分片接口 | 内容来源注册表、统一授权、压缩/静态前守卫；会员开关发布前必须通过完整来源检查 |
| P1 | 连续兑换后撤销前一码，会留下后续权益空档或重复赠时 | 不可变兑换账本 + 可重算期限投影，明确月末锚点及撤销规则 |
| P1 | 每次答题都重新拒绝过期权益，可能丢失待同步学习记录 | 新内容/下一任务受控，纯历史写入保留既有协议；保存不授予继续访问权 |
| P2 | 稀疏心跳可能只计很少时间；跨窗口/多标签语义不足 | 有界租约、额度预留/结算、持久单活跃会话、窗口边界和幂等序号 |
| P2 | 承诺切换账号也不能重置体验，超出了账号级方案能力 | 明确每账号一次；多账号滥用通过已有注册/短信限速降低，不承诺每自然人一次 |
| P2 | 回滚“全开免费”会意外公开会员内容 | 回滚保留权益/访问策略及保护入口，保护能力不可用时返回服务暂不可用 |

## Assumptions and decisions

**用户已经确认：** 会员分月/季/年；课程可设免费/会员；体验天数和每天时长可配置，初始 3 天、30 分钟；免费课不限时，体验额度只用于会员课；外部平台销售兑换码，首期网站批量生成并导出 CSV。

以下为本次规划选定的首期默认规则，属于设计建议，不能表述为用户此前已经确认：

1. 首次成功打开可学习的会员课内容才启动体验；目录浏览、点击后加载失败、注册/登录均不启动。采用从起点算起的连续 24 小时周期，默认 3 个周期，每周期 30 分钟；不是 3 次登录/3 个学习日。界面明确显示“本周期剩余时长、下次恢复时间、体验结束时间”。
2. 用完当天额度只锁到下个窗口，体验总期限届满则停止体验；未用额度不结转。用户不学习的时间仍消耗 3 天的总期限，不消耗每日学习秒数。修改配置不重置/追溯修改已经开始的体验。
3. 月/季/年为一次性预付权益，分别 1/3/12 个 UTC 日历月，不自动续费，不按 30/90/365 天换算。时间戳为 UTC 毫秒，界面用明确的当地日期时间显示。
4. 连续续期保留首个周期的日历锚点，避免 Jan 31 → Feb 28 → Mar 28 的月底漂移；间隔过期后重新兑换则以本次兑换时间建新锚点。所有计划授予同一 `member_access`。
5. 成功购买权益不重置/暂停已启动的体验；第一次兑换时若尚未试用，则将体验标记为已关闭，避免会员到期再赠新体验。核销失败不改变体验。
6. 体验按服务端 user ID 每账号一次；切到已有账号读取该账号自己的账本，新注册账号在本规则下是另一账号。首期不新增设备指纹或“每自然人一次”识别系统。
7. 核销前显示当前账号；共享默认账号不能核销。不可恢复的游客账号先通过现有凭据/手机号流程绑定可再次登录的身份，保持同一个 user ID，防止兑换后丢账号。正式账号可直接兑换，不重复增加确认弹窗。
8. 首期付费范围是管理员发布的**平台课程**（句子、图文两类）。个人创作/导入内容按所有权学习，会员到期不锁自己的课程；词汇书/教材收费和 AI 制作次数收费不在本次范围。用户公开分享默认免费，只有管理员明确接纳为平台课程并完成受保护发布，才能设置会员级别。

## Scope / Out of scope

首期交付管理端体验配置、课程访问策略、一次生成/CSV 下载/批次激活与停用、三档核销/续期/撤销、账号会员中心、体验计时、句子与图文课程的实际访问保护和隔离验证。页面复用网站既有主题、账号入口和管理界面，不另起一套风格。

不包含站内收款、自动续费、外部平台 API/回调、自动退款、离线会员 DRM、设备指纹、修改学习算法、收费词汇书、删除/覆写课程/缓存/备份、真实数据迁移操作或部署/提交/推送。未来外部平台集成只接入发码交付端口，不能直接绕过本站核销账本。

## Contracts and data changes

### OOP 边界与文件

采用组合和依赖注入；纯策略不依赖浏览器/Express/SQLite。只为有独立职责的服务建类/对象，不为每个字段增建继承体系。

| 职责 | 文件边界与依赖 |
| --- | --- |
| 套餐、试用策略、月历期限计算 | `src/membership/plan-catalog.mjs`、`trial-policy.mjs`、`entitlement-timeline.mjs`；注入时钟，返回不可变结果 |
| 权益与课程授权 | `src/membership/entitlement-resolver.mjs`、`course-access-policy.mjs`；已知课程策略 + 权益投影 + 体验租约 |
| 数据/事务 | 新增 `server/services/membership/repository.js`、`schema.js`；在 `server/db.js` 仅挂接新 schema；不可覆盖学习表 |
| 发码/核销/撤销 | 同目录 `code-issuer.js`、`redemption-service.js`、`entitlement-service.js`；依赖 repository、随机源、HMAC 密钥提供者、时钟 |
| 计时 | 同目录 `trial-usage-meter.js`；依赖策略、时钟、repository；事务控制单活跃会话/预留额度 |
| 内容绑定/保护 | 同目录 `content-registry.js`、`course-access-service.js`、`server/middleware/course-content-guard.js`；服务器解析课程实际引用，不信客户端自报课程归属或文件路径 |
| CSV 交付 | 同目录 `csv-code-delivery.js`；首期一个交付端口实现，不新增尚无用途的平台 SDK |
| HTTP 编排 | `server/routes/membership.js`、`admin-membership.js`、`protected-course-content.js`；在 `server/index.js` 注入共享服务 |
| 浏览器 | `src/membership/client.mjs`、`status-view.mjs`、`learning-session-controller.mjs`；消费服务器结果，复用既有 ChunkAPI / 账号作用域 |
| 构建/主题 | `scripts/build-membership.mjs` / policy 与 client entry；产出 `server/services/membership/policies.cjs`、`js/membership.js`；挂接 `build-app.mjs`、`check-generated.mjs`、部署清单/SW；只复用/补充原主题 token |

### 配置、账本与约束

- `membership_settings_revisions`：enabled、`trialDays`、`dailyLimitSeconds`、销售链接、revision、修改者/时间。默认 3/1800，天数为 1..365 整数，秒数为 1..86400 整数；关闭体验用独立 enabled，不混用 0/负数。用 baseRevision 乐观写入，非法配置拒绝发布。
- `membership_plans`：monthly/quarterly/yearly、名称、termMonths、启用发码标记、可选展示价格/币种、revision。每批次保存不可变 planSnapshot；之后改名称/停售不改变已发行码的期限或核销资格。
- `redemption_batches`：ID、planSnapshot、数量、redeemBy（可空）、渠道引用、paused/active/revoked、创建/激活者时间、revision。新批次 paused；激活前管理员确认外部平台已导入。导出网络响应成功不能代表平台已入库。
- `redemption_codes`：随机公开 codeId、batchId、HMAC 摘要与 keyVersion、unused/redeemed/revoked、redeemedBy/At、grantId；摘要唯一索引。明文不入普通数据库、日志、URL、错误上报或用户快照。
- `admin_issue_receipts` / `redemption_receipts`：操作者/用户 + requestId 唯一、规范化输入 hash、batchId/codeId/grantId、结果。同一个 requestId 换 payload 为 409；保留收据，不能只靠前端按钮禁用去重。
- `user_entitlement_grants`：不可变核销事实（userId、用户内递增序号、source codeId 唯一、redeemedAt、termMonthsSnapshot）；撤销记录另带操作者、原因、时间。首期只有有限期兑换权益，不加入无限期赠送/复杂会员等级。
- `user_entitlement_periods`：根据仍有效的 grant 账本重算的 startsAt/endsAt/anchorAt/cumulativeMonths；投影更新与发放/撤销同一事务，并提升 membershipRevision。历史投影变化进入管理审计，核销事实不被改写。
- `user_trial_state`：userId 唯一、未开始/运行/结束/购买关闭、startedAt、endsAt、policyRevision、trialDays/dailyLimitSeconds 快照。没有体验起点时不创建伪使用记录。
- `user_trial_windows`：userId + dayIndex 唯一、usedMs、reservedMs、revision；`user_trial_sessions`：随机 sessionId、账号/课程/窗口、lastSettledAt、leaseEndsAt、状态、心跳序号。时间累计用毫秒，不能反复开始/暂停后按秒向下取整省掉额度。数据库部分唯一索引确保每账号只有一个 active 试用会话。
- `course_access_revisions`：canonical courseId、free/member、revision、操作者/时间、内容注册表版本。识别出的存量平台课程初始 free；未来新发布课程需明确策略。未知课程/损坏注册表/权限服务失败不能回退 free。个人内容另走现有所有权规则。
- 管理审计与核销限速状态单独存储；记录失败核销时不能跟着业务 rollback 一起消失。首期 SQLite 持久化限制适合共享此数据库的进程，后续分库/多节点替换限速端口。

### API / 返回值

| 入口 | 核心合同 |
| --- | --- |
| `GET /api/membership` | 当前账号权益、连续到期时间、体验状态/nextResetAt/endsAt/remainingSeconds、策略版本、套餐/销售入口；private, no-store |
| `POST /api/membership/redeem` | code + requestId；userId 只取真实认证身份；成功回核销事实和**当前**权益快照 |
| `GET/PUT /api/admin/membership/settings` | adminOnly；配置预览/乐观写入；不回任何密钥 |
| `POST /api/admin/membership/code-batches/issue-export` | plan/quantity/redeemBy/channel/requestId；一次生成并返回 CSV，响应标注 batchId；纯内存明文 |
| `GET /api/admin/membership/code-batches` | 分页批次/核销统计/公开 codeId；不可查询明文或摘要 |
| 批次 activate/pause/revoke；grant revoke | adminOnly + revision/requestId + 理由；批次撤销只影响未兑换码，已兑换权益撤销走单独预览/操作 |
| `GET/PUT /api/admin/membership/course-access` | PUT 接显式 changes 数组和每课 baseRevision，预览完整内容/共享引用影响，整个变更原子提交 |
| `POST /api/learning-sessions/start` | canonical courseId + requestId；准备初始内容，成功提交体验/租约后在同一响应返回首个课节/练习批次；前置失败不启动体验 |
| session heartbeat/pause/end | sessionId + sequence/requestId；绑定账号/课程，重复请求不重复记时或延长租约 |
| `GET /api/course-content/:courseId/...` | 服务器允许的课节/题目/素材引用，重新判权限；任何拒绝不能 next() 落到静态读取 |

访问结果统一带 `allowed/reasonCode/serverNow/membershipRevision/policyRevision`。拒绝细分 AUTH_REQUIRED、ACCOUNT_BINDING_REQUIRED、TRIAL_DISABLED、TRIAL_DAILY_LIMIT（含 nextResetAt）、TRIAL_EXPIRED、MEMBERSHIP_REQUIRED、SESSION_IN_USE、SERVICE_UNAVAILABLE；未知码/其他账号已用码/过期码/停用码对外统一 CODE_UNAVAILABLE，不暴露兑换人。503 不是会员到期，也不能显示为“课程已删除”。

公开 `/api/library` 只加可共享的 free/member 标记、公开元数据和策略版本，并把策略版本计入 ETag；个人可访问/剩余时长通过独立会员接口获取。会员/核销/管理响应一律 no-store。

学习 start 若已提交而网络响应丢失，不能承诺事务自动回退；客户端以同 requestId 查询/重试恢复既有会话，不重新启动体验或扣第二份额度。恢复返回服务器当前租约和状态，已过期租约重新授权后才能继续，不重放过期正文。会员模式由每次请求的当前权益直接授权，不创建试用用量；可以多设备学习，单活跃限制仅用于试用。

### 发码、导出与核销

- 管理员选择计划、1..10000 个码、截止时间和渠道，预览后点击“生成并下载”。本次请求生成 128-bit 以上 CSPRNG 码，规范 Base32 分组、非敏感产品/keyVersion 前缀。规范化只允许明确的大小写/空格/连字符变换，拒绝任意 Unicode 混淆输入。
- 先在事务内写 paused 批次、摘要、管理收据并提交，再发送内存中的 CSV；失败不自动激活。不能实现“只有摘要的批次，过几分钟再第一次导出”。同 requestId 重试回既有批次状态，不生成新批次，也不假装可恢复原 CSV。
- 下载中断/文件丢失：管理员若没有完整原文件，则撤销仍暂停的批次并生成新批次，旧记录保留；已经激活/销售的批次先做明确影响核查，不自动换码。若以后要求可重新下载，需要另行规划独立密钥加密保存，不在首期偷偷保存明文。
- CSV UTF-8，固定列 `batch_id,code_id,plan_key,term_months,redeem_by,code`；标准转义，禁止渠道等自由文本形成公式单元格。平台需要一列码时可从这个文件提取 code，不据未知平台格式新增多种导出。
- HMAC 密钥在数据库外配置，至少 32 随机字节；keyVersion 指向密钥环。缺少密钥拒绝发码/核销，不临时生成密钥导致旧码失效。轮换保留尚有可兑换码的旧验证密钥；独立备份密钥，不把密钥打进前端/日志。
- 核销用同步 `BEGIN IMMEDIATE` / better-sqlite3 immediate 事务，无事务内 await；原子检查、消费 code、写 grant/期限投影、关闭未开始的体验、写回执。SQL 条件更新/唯一约束兜底并发；数据库忙或提交失败返回可重试错误，不先回“成功”。
- 同账号重复核销同一码可返回原核销事实，绝不重复续期；回执重试也返回实时权益状态，避免撤销/到期后被旧“成功”快照重新开权限。其他账号仍统一不可用。
- 限速首期明确为账号 5 次失败/分钟 + 20 次/小时、IP 30 次失败/10 分钟，另设合理入口总吞吐上限；返回 429/Retry-After。阈值可配置、成功请求不清空整个 IP 的失败记录；可信代理配置与现有部署匹配。验证码挑战接口暂不作为首期依赖。
- 外部平台负责销售/退款。本网站管理员只能按真实核销引用处理权益，不把销售退款状态自动当成已核销码撤销。批次停用/撤销不撤掉已有买家的会员。

### 续期、月底及撤销

按 userId 的核销序号遍历未撤销的 grants。新连续块以首个 grant.redeemedAt 为锚点；若下一笔兑换时间不晚于上个 endsAt，则延续锚点、累计 termMonths；否则新建连续块。结束时间用 `addUtcCalendarMonths(anchorAt, cumulativeMonths)`，保留锚点日期/UTC 时间，目标月无该日期才取月末。半开区间 `startsAt <= now < endsAt` 判有效，不依赖定时任务是否跑过。

撤销排除相应 grant 后按上述规则重算，不保留“前一笔被撤销、后一笔还要等一个月才能开始”的依赖空档，也不把被撤销期限永久烘焙进后一笔。示例：10/14 月码 + 10/15 季码，原到期 2/14；撤销月码后季码按 10/15 起算，到期 1/15。该规则会改变后续投影，管理端先显示旧/新到期、影响代码与原因，再按 revision 原子提交；用户中心显示调整记录。不能删除其他仍有效的核销事实。

### 学习计时

- trial 窗口 `dayIndex=floor((now-startedAt)/24h)`，以快照 trialDays 判断是否结束。当前窗 usedMs/reservedMs 原子更新，上一窗用量不带入下一窗。
- 试用只准一个有效会话；第二标签/设备显示“另一个页面正在试学”，可显式接管，先结算旧会话再开始新会话。旧页面的迟到心跳不能恢复或重复累计。
- start、heartbeat、pause/end、受保护读取和会员状态查询统一调用结算入口；发现租约已到期时只结算到 leaseEndsAt，释放预留并关闭会话。无需等待后台任务才能回收唯一 active 槽位。跨窗口先结束旧窗口会话，按新窗口额度重新授权；重试不能把旧窗口租约写入新窗口。
- 租约默认最多 30 秒，心跳约 15 秒。开始/续租先结算此前授权且尚未结算的区间、释放上一预留，再预留新租约额度；leaseEndsAt 不超过每日剩余额度、窗口结束或体验结束。usedMs + reservedMs 不得超过窗口上限。
- UI 的剩余时长扣已结算和当前已流逝时间，不提前把整个未流逝预留都显示成已用；新会话是否可分配额度则必须考虑全部 reservedMs，不能让其他页面抢用预留。
- pause/end 根据服务器收到请求的时间结算并释放未用预留；请求丢失时剩余授权租约最多计 30 秒，超出不计。不能仅在收到稀疏心跳时加固定 15 秒，也不能容许租约到期后继续依赖缓存推进学习。
- 用 Page Visibility 判断隐藏/最小化后暂停；不把 blur 等同隐藏。可见地阅读图文仍计时，不要求不停点击。客户端隐藏状态只改善体验，不能证明真实注意力；首期不承诺绝对反作弊。
- 前端显示服务端剩余时间，用单调计时更新展示，设备时间改动不授权。重开页面先问服务器，网络断开到租约截止暂停新学习，恢复时重新授权；错误/跨窗/服务器时间回退均不增加已用额度或无限延长租约。
- 会员学习不扣试用额度；服务器每次受保护读取仍查最新会员状态，租约不能延伸到会员 endsAt 之后。试用中兑换成功先结算当前试用租约，再转会员；旧心跳不能继续扣试用。
- 发放与结算共用同一数据库事务边界；核销成功先结算到兑换时刻并关闭旧试用会话，再写权益快照，不能在成功响应后异步补扣。数据库事务失败时上述状态一并回滚。
- 首页、制课/上传、永久免费课和个人课不计时。已用当期额度可到下一窗口恢复；体验总期限不因暂停/购买重置。

### 内容分发、记录与策略发布

- `ContentRegistry` 建立 canonical course → lesson/item/contentRef → 内容/素材的允许映射，同时枚举 legacy deck/课程别名、独立练习、索引、原始 JS、公开 deck API、包下载、图片/音频、.br/.gz 等正文出口。传一个免费 courseId 不能读取其他会员课的 contentRef。
- 在现有静态守卫之后、压缩与 express.static 之前挂课程内容守卫，使用现有规范化函数判定所有变体；受保护内容只由课程接口按授权映射读。未知文件/ref 不依赖“URL 难猜”来放行。源题库中含会员正文时，其完整源文件不能继续匿名静态服务；原文件仍保存在原位置。
- 同一物理 shard 包含免费/会员题目时，不能把整个 shard 发给免费路径；从服务器分片抽取该免费课程实际允许的条目，并保护整份原 shard。详情和中英文索引同样处理。
- 新会员图文课的正文/素材保存在 server 受保护发布目录或静态根之外，浏览器经认证 fetch/Blob 展示素材；个人导入包仍照原方式处理。平台会员课不得完整复制进个人 user_courses/user_decks/快照用于离线学习或导出。
- 试用按当前课节/有界练习批次交付，默认最多 10 道句子题或当前一个图文课节，不批量下载整套会员课程。会员也经在线受控入口读取，首期不提供会员课程包导出。学习页和统一复习/测评入口都解析真实来源。
- 受保护正文/素材响应 private, no-store；SW 对这些路由 network-only，不写 IndexedDB 持久内容缓存，不把它们加入预加载。新会话先检查当前账号和权限，会员旧内存缓存不能绕过授权；账号切换/迟到响应按现有 owner generation 丢弃，不清理任何真实浏览器资料。
- 若同一教学 item/contentRef 仍可由免费课程、公开分享或独立 deck 正文入口完整读取，会员策略发布须阻断，列出冲突。管理员可显式联合修改冲突课程的策略并一次提交，或另行提供独立受保护版本；不能自动改别的课程收费，也不能用无限制复制默认解决。
- free→member 发布前必须证明注册表完整、静态/公开旁路已封堵、受保护正文和图文素材可读；否则拒绝发布，原策略继续生效。旧已公开/下载副本无法追溯收回，此限制展示给管理员。该限制不等于允许今后的原 URL 继续返回会员正文。
- 未登录用户可看公开目录/会员标记，但不启动体验。有效性随服务器时间在下一读取检查，不靠凌晨清理任务。正在打开的页面收到租约/权益到期事件后停止获取下一步并显示续期入口。
- **历史保存和新内容获取分开**：已完成答题/进度的纯写入继续走既有账号/内容校验及幂等队列；会员到期不能拒绝整个同步批次、丢弃本地待保存项或扣历史进度。若某操作响应包含新标准题目/答案，需要在返回新内容之前走授权门，不能因保存成功顺便发下一题。
- 用户拥有的个人课程、历史/错题记录、统计和备份可读可保存；复习时若需要服务器再取会员标准正文，则锁定该项并可继续免费项。已存在的历史正文不删除，不能以权限改造为由滤掉/重写非空账号快照。
- 公共目录始终无个人权益数据，个人会员中心和学习会话不共享缓存；所有续期/撤销/策略修改提升对应版本，服务端不缓存长期 isMember。

### 用户与管理界面

用户账号区提供兑换入口、当前账号、会员期限/续期、核销历史（不显示原码）、体验余量；复制粘贴支持分组码。请求待处理禁用重复按钮，网络失败可用同 requestId 重试；成功显示本次产品和最新到期。明确区分“今日额度用完”“体验结束”“会员到期”“连接失败”，相应提供下次恢复时间、免费课入口或外部购买链接。提醒在剩 5 分钟/1 分钟时显示，结束保留当前位置和答题。

管理端同一入口提供试用配置、计划与外部销售链接、批次统计/生成下载/激活停用、单码公开 ID 查询和已核销权益撤销预览、课程策略编辑。所有写入用现有 adminOnly、审计和乐观版本。暂停批次与撤销已核销权益使用不同控件，避免误伤已售用户。响应/CSV 都不暴露用户 token/HMAC 密钥。

## Implementation steps

- [x] 0. 确认用户已有选择，复核原规划，补齐导出/配置/期限/保存/内容边界；本文是执行唯一 handoff。
- [x] 1. 新增纯策略与定向单测、构建入口；把 policy 编译到 CommonJS，在现有 build/check 流程挂接，Node 18 可加载服务端产物。浏览器计时 client 尚未实现。
- [x] 2. 新增 membership schema/repository/事务与设置；通过新临时目录验证升级只建新表、原课程/学习快照不变。没有加载真实用户数据库。
- [ ] 3. 已实现发码/CSV、批次控制、核销/期限投影/撤销、设置 API、账号兑换和管理页面；真实服务器和页面已验证核销/到期/续期。用户可看最近 100 条兑换/撤销记录与原因；仍需完整的调整与断流等异常验收。
- [ ] 4. 保护内容预检、学习会话 HTTP、服务端租约、浏览器组件已接 main/courses，实际页面完成开始/超时/续期/刷新断点、多标签接管与双账号隔离；离线/跨窗等核心规则已有服务测试，完整浏览器边界矩阵仍待补齐。
- [ ] 5. 已实现 ContentRegistry / CourseAccessService、保护路由、压缩前守卫、content-shards/公开 deck 过滤；content-studio 已可校验、恢复草稿、发布两类新平台课程到私有目录，并原子设为免费/会员。存量课程已有只读来源检查和独立候选包工具；尚缺原学习身份/入口适配与完整认证后的启用，暂不允许把存量课设为会员。
- [x] 6. 管理页面已接共享引用联合预览/原子发布；ContentRepo 只读保护目录元数据，CourseCatalog 保留稳定 ID，main/courses 实际学习、decks 课节跳转、workspace 发现/个人内容/首页续学均已接入。stats 显示已有受保护学习记录，逐项复习重新授权且保留课程断点；批量复习只交接免费/个人项。两类课程的正式测评接通既有引擎，按项授权、复测周期、刷新恢复和历史结果已有服务与浏览器验证；纯历史保存没有会员阻断。
- [ ] 7. 账号兑换/历史、管理功能和学习时长/暂停/限制/续期提示已接；学习页沿用现有主题，手机无横向溢出。/api/* 保持 network-only，新样式/bundle 为软缓存；学习内容和素材只放本次内存。完整键盘/离线/跨窗及所有原有练习能力还未验收。
- [ ] 8. 跑本文定向验证；记录实际命令/结果与未解决风险。全套 acceptance 完成才标 complete；不连接/重启 live service，不 commit/push/deploy。课程会员化需管理员后续明确选课，执行不自动改变真实课程策略。

## Validation

规划复核只读，不运行实现测试。下面是执行阶段须实现并运行的定向检查；新测试使用合成内容，新数据库/端口，不依赖用户课程归档：

- [ ] `node src/membership/policies.test.mjs`：配置校验/快照、窗口恢复/结束、disabled、已购关闭体验、连续月份锚点（月末/闰年）、过期后重开周期、撤销前码的后续投影； fake clock 不用等真实 30 分钟。
- [ ] `node server/services/membership/membership.test.js`：临时 SQLite；同/不同码并发顺延、消费/投影/回执提交失败 rollback、缺/旧密钥、同请求不同 payload、过期/撤销后重放回执仍不授权、限速失败计数不被 rollback。
- [ ] `node server/membership-api.test.js`：新临时 CHUNKLAB_DATA_DIR + 隔离端口；REQUIRE_AUTH=true、独立临时测试用户/管理员/密钥；开放默认账号拒绝核销、不可恢复游客流程、账号隔离、计划快照、CSV 断流后批次仍 paused、旧批次重复请求不重复发码。
- [ ] `node server/membership-content.test.js`：隔离 CHUNKLAB_APP_ROOT/CONTENT_SOURCE_ROOT/CONTENT_OUTPUT_ROOT 合成 fixture；无权限的详情/索引/源 JS/旧 URL/公开 deck/图片音频/HEAD/Range/编码变体/.br/.gz 都不返回会员正文；伪造 free courseId/ref 拒绝；免费 shard 不受误锁。
- [ ] `node e2e/membership-learning.test.js`：测试脚本自行分配临时数据/空闲端口并证明启动的是其子进程；两个账号、多标签接管、跨额度窗口、重复/迟到/丢失心跳、离线/重新授权、两类课程、会员到期/续期与进度保留、免费课不限时。
- [ ] `node e2e/membership-admin.test.js`：配置 revision 冲突、发布前旁路/免费重叠阻断、显式联合变更、试用变更不重置原账号、批次暂停不撤销买家、grant 撤销预览/审计、账号重新登录。
- [ ] 回归：隔离 fixture 的账号导入课程/图文 data URI、快照/export/历史记录在到期前后语义一致；已完成答案到期后仍入账且队列可继续保存免费内容，新会员正文不再下发。
- [ ] `node node_modules/eslint/bin/eslint.js "src/membership/**/*.mjs" "server/services/membership/**/*.js" server/routes/membership.js server/routes/admin-membership.js server/routes/protected-course-content.js`；并对修改过的既有文件定向 lint。
- [ ] `npm run typecheck`、`npm run build:check`、`node scripts/check-deploy-files.js`、`node scripts/check-sw.js`、`node sw-policy.test.js`；修改后的构建检查须支持新产物并在临时输出验证，不运行广域自动重建覆盖无关生成物。
- [ ] 隔离构建检查受保护产物不在 public/SW 清单，Node 18 服务可用；记录真实 Node 版本。检查父进程/测试子进程和临时路径，清理仅限本次创建的临时目标，不碰 live 端口/原浏览器 profile。
- [ ] 既有未修改基线可能失败；单独记明原因和影响，不能掩盖新增功能失败或为了绿灯改写无关内容。若失败使 acceptance 无法证明，保持 in-progress。

## Acceptance criteria

- [ ] 网站实际页面能完成管理员生成 CSV/激活 → 正式账号核销 → 会员句子与图文课学习 → 到期限制 → 新码续期回原位置。
- [ ] 三档期限与配置均来自服务端；重复/并发不会重复发放或覆盖期限；月底连续续期不漂移，撤销只按明确的投影规则扣除被撤销购买。
- [ ] 默认首次实际学习启动 3 个 24h 窗口，每窗最多 30 分钟；用完当窗可等 nextResetAt，整体 endsAt 以后无新体验；后台可修改新体验规则，已有体验不重置。
- [ ] 免费/个人课程不消耗体验且可在会员到期后学习；保留所有学习/加入/原导入资料及未完成同步数据，没有清空账号/缓存来实现权限。
- [ ] 课程开关发布前的完整来源验证成功；全部受控正文/素材出口服务端检查一致，不靠 UI/不明 URL/前端 isMember；共享免费正文不得被错误宣称为已保护。
- [ ] 用量预留/结算、窗口边界、单活跃租约和失联退出经隔离测试证明；新账号被当成新账号的产品限制明确，不宣称每自然人一次。
- [ ] 管理权限、明文只出本次 CSV、批次断流恢复流程、密钥配置/轮换、核销限速、回执实时状态及审计可用。
- [ ] 公开目录不泄漏个人会员状态；两类课程页、账号区、手机页面与现有网站主题一致；503/断网与到期状态分开。
- [ ] OOP 职责、CommonJS/browser 构建、实际运行入口、SW 和部署清单连通；所有指定验证完成。
- [ ] 只在临时实例验证；真实课程/数据库/备份/live 服务未迁移/重启/部署，也未提交/推送。后续正式上线另行报告与执行。

## Risks and rollback

- 已公开/下载的字节、用户原备份不能追溯收回；守卫能阻止未来在线请求，无法消除旧公开缓存副本。实施不能以此为由删除原资产或宣称完整 DRM。
- 账号级体验不能阻止同一人另开账号；首期复用注册/短信限速，是否升级为每验证手机号一次须另定身份与解绑政策。
- 在线计时是授权可见学习时段，崩溃/丢失 pause 最多计一段 30 秒租约；阈值、窗口时间和失联提示必须可理解。
- CSV 是可先兑先用的凭证；一次性导出意味着丢失后无法恢复原码。管理操作先暂停、确认外部平台导入再激活；不把网络成功标成平台交付成功。
- HMAC 旧密钥丢失会使尚未核销的码无法验证；独立密钥备份/轮换属于上线配置的必要项，不能把任意新密钥当作恢复方式。
- 程序回滚保留新账本、配置/课程策略、内容守卫及必要兼容读取；缺少保护能力时会员内容返回 503，不能自动全开免费或回删会员账本。显式改课为 free 才可改变公开策略。
- 真正的上线/迁移前按 AGENTS.md 给目标数据库和账号做一致性可恢复备份，并记录验证；不能只复制正在写 WAL 的主文件，不能 whole-snapshot restore 覆盖非空账号。本轮不执行这些操作。

## Online patterns referenced

- 产品与权益分开，按有效权益判断访问，参考 [Stripe Entitlements](https://docs.stripe.com/billing/entitlements) 与 [RevenueCat Entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)。本站预付码不引入它们的订阅支付/自动续费/付款宽限期。
- 逐请求授权和静态内容授权参考 [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)。隐藏 URL 不能代替授权；本文将原始文件、索引和素材也纳入统一入口。
- 随机码/HMAC 密钥管理参考 [Node.js Crypto](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)；账号/IP 失败限制及统一错误参考 [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)、[OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)。
- SQLite 事务模式参考 [SQLite Transactions](https://sqlite.org/lang_transaction.html)；页面隐藏与 blur 的区别、后台定时器限制参考 [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)。窗口算法、CSV 一次交付和撤销投影为本文选择的本站规则，不冒称这些来源的统一行业标准。

## Execution notes

2026-10-14：此前只读检查账号/目录/协议3保存/内容分片，用户确认免费课不限时、体验只用于会员课、外部平台卖码、网站生成 CSV。没有修改产品代码/数据库/真实课程或账号。

2026-10-14 复核：检查原 handoff 与 auth、library、公开 deck、snapshot/export、operations、静态/压缩、内容构建、图文 adapter、现有构建/测试清单；核对 OWASP、SQLite、Node、MDN 文档。修正摘要与后续导出的矛盾，补配置快照、连续期限/撤销投影、租约额度预留、完整内容出口、历史同步保留和安全回滚；显式区分用户确认与规划默认值。只更新本文件，没有实现或运行测试，未访问/修改真实数据库，未启动/重启服务。

2026-10-14 执行开始：将状态设为 in-progress。先完成领域策略模块与独立测试/build/check 接入，再沿 handoff 逐步接数据库/API/用户端/内容保护；本次验证严格使用临时目录和隔离端口。执行基于包含既有用户改动的工作树。

2026-10-14 执行进度：新增会员领域策略构建、加表 schema/repository、HMAC keyring、兑换码一次生成 CSV、暂停/激活/停用、月历权益投影与撤销重算、限速核销 API、会员状态 API、账号兑换入口和管理页。体验计时服务已实现 24 小时窗口、额度预留/结算、单活跃会话、序号幂等和过期租约懒回收。两个 SQLite/API 测试使用系统临时目录与 loopback 随机端口；固定验证用户的既有课程行和学习事件仍在。没有启动或重启正式服务。

此前阶段的限制（以下续记更新其进度）：当时尚未实现课程内容注册、受保护读取、旁路守卫和学习端计时；因此当时不能发布。

验证记录：`node src/membership/policies.test.mjs`、`node server/services/membership/repository.test.js`、`node server/services/membership/membership.test.js`、`node server/membership-api.test.js`、`node scripts/check-generated.mjs`、`node scripts/check-deploy-files.js`、`node scripts/check-sw.js`、定向 ESLint 均通过。`npm run typecheck` 仍被原有 `scripts/build-learning-workspace.mjs` 与 `scripts/build-vocabulary-study.mjs` 中的 esbuild `legalComments` 类型错误阻断，会员代码没有新增类型错误。`node sw-policy.test.js` 通过 21/22，现有工作树硬预缓存总量为 1683 KB，超过其 1.5 MB 门槛；清单不相交、可幂等生成等检查通过。没有运行会全量重建资源的 `npm test`。

### 2026-10-14 继续执行：内容保护与管理发布闭环

- 修复基础回归：start 收据重放及当前权益检查、暂停动作与心跳序号冲突、时钟回退、最后一段预留额度状态、显式接管、核销 rollback 后失败限速仍记账、总吞吐限制、ASCII 码规范化、CSV 截止时间、旧密钥检查、配置/审计原子事务和 epoch 0 撤销。
- 新增服务器拥有的私有 registry（数据目录 membership-content/registry.json）、真实内容/素材预检、每次读取授权、句子每批最多 10 条、图文每次 1 条和素材白名单。禁止把正文/素材路径或整包通过目录返回；真实存量课程保持原有级别。
- 静态守卫位于压缩/静态服务前；保护声明中的 raw/索引/分片/素材/包/压缩副本/公开 deck 别名。损坏或缺失保护注册表不回退公开，用户历史读取仍可用。私有 ID 与旧公开课程碰撞时，不允许把旧课声明为已保护。
- 课程策略预览检测免费课程/公开题库的共享正文；支持明确联合变更、revision/registry 乐观检查和原子发布。管理页操作期间锁定控件，修改会使旧预览失效。修复空用户编号查询触发的页面异常。新增部署依赖与软缓存 bundle，未执行部署。
- 浏览器 MembershipClient 和 LearningSessionController 采用注入 API/单调时钟/计时器/账号作用域。丢失响应保留 requestId/心跳序号，隐藏或手动暂停与进行中的心跳按序结算，失联最晚租约截止停止推进，切账号拒绝旧响应。API 保留 reasonCode/nextResetAt，超时信息区分认证与一般读取。此组件尚未接入现有学习页面；不是完整学习 UI 验收。

本轮验证（Node v22.12.0；产物 target=node18，不声称运行过 Node 18）：

- 通过：领域策略、membership-regressions、membership.test、membership-api、learning-session-controller、api.test。
- 通过：`node server/membership-content.test.js` 启动真正的 server/index.js 子进程，新临时 appRoot/dataRoot/随机端口/合成账号；验证两类正文、混合免费过滤、素材、原始 URL/HEAD/Range/编码/压缩/公开题库旁路、共享冲突、额度窗口快照、整体到期、核销续期、已完成答案到期后仍写入、注册表损坏后的拒绝与历史保留。还用实际 MembershipClient/Controller 经 HTTP 验证开始/心跳/读取/暂停/重开。
- 通过：`node e2e/membership-admin.test.js` 用独立 Chromium context 和真正的隔离服务器，实际操作管理页面保存配置、生成下载 CSV、激活、预览锁定/失效、策略发布、刷新持久化及 375px 手机宽度；无页面未捕获异常。不是用户学习页面闭环。
- 通过：定向 ESLint（新增/修改会员与构建/运行入口/API文件）、`node scripts/check-generated.mjs`、部署清单检查、SW 哈希检查。
- 既有阻断仍保留：typecheck 的两份非会员 build 脚本 legalComments 类型问题；SW policy 硬缓存 1683 KB 超 1.5 MiB（21/22）。没有提高门槛或重建无关资源以掩盖。

**当前仍 in-progress，不能上线**：还需受保护内容发布/来源清单生成、现有各学习入口与本组件接线、权益历史/调整展示、计时与错误/续期 UI、学习浏览器完整验收。现有真实课程没有会员化，没有访问/覆写真实数据库、原浏览器 profile 或备份，没有重启 live 服务、提交、推送或部署。

### 2026-10-15：实际学习页面闭环

- 增加 `study-view.mjs`，通过依赖注入使用现有答案匹配、CourseEnrollment 和 ServerStore。main/courses 共享有界正文/素材读取与计时组件；当前实现先理解再输入回忆，尚未接齐旧引擎的所有模式。暂停/到期隐藏新学习操作，但保存失败的已完成答案提供独立重试，换课节前不丢弃待保存答案。课节和稳定学习断点使用既有 learning.answer/learning.resume；不复制整套课程进账号资料。
- `/api/library` 加入保护目录和公开访问级别，ETag 包括其变更；不混入个人权益。ContentRepo 仅加载平台元数据并隔离 API 服务地址；CourseCatalog 合入稳定课程身份。发现、我的内容、首页、decks 课节与 main/courses 的链接接通，加入学习和收藏仍分开；复用原有三门在学上限。
- 补齐账号深链、兑换后返回课程链接、最近兑换/撤销历史；增加手机样式、可见暂停、剩余时间及 5/1 分钟提醒文案。修复真实浏览器发现的计时器调用 receiver 错误。服务端重授权响应补当前心跳序号/额度，避免恢复后错误发送旧序号。
- 补共享物理文件的不同逻辑别名冲突检测；压缩守卫支持重复压缩后缀；缺少可学习英文的内容在启动体验前拒绝。保护目录由服务器持有，正式发布与存量来源认证流程仍未完成，因此不转换真实课程。
- `node e2e/membership-learning.test.js` 通过：真正隔离服务器 + 合成私有内容，实际操作发现/开始/答题入队/额度耗尽/账号兑换及历史/原位置恢复/刷新/图文鉴权 Blob/375px/到期停止新正文/免费课继续；验证首页和个人内容链接、多标签显式接管与第二账号记录隔离。静态页面只读使用工作区源码，数据库/私有内容/端口均为本次新临时资源；不使用原浏览器 profile。浏览器关闭、子进程退出后才清理该临时目录。
- 通过：服务端内容测试（新增不可学习内容不启动体验、物理别名冲突）、会员基础/回归/API、计时组件、管理浏览器、`e2e/ai-course-native-learning.test.js`（原个人 AI 课确认/保存重试/进度/删除标记与手机流程）、课程目录/主入口/工作台模型测试及定向 ESLint。`scripts/catalog-practice-entry.test.cjs`、story theme 检查亦通过，前者的旧测试配置仍有服务/SW警告，不据此宣称无控制台告警。
- `npm run typecheck` 现已通过：对两处原有 build 脚本的 legalComments 增加常量类型，运行时选项不变；未全量重建词汇生成物。构建一致性、部署依赖、SW 哈希检查通过。`sw-policy.test.js` 仍 21/22：硬缓存 1689 KB 超 1.5 MiB，未提高门槛。
- 已看手机截图；Impeccable 机械扫描完成，新样式只有 token/字号建议，旧 HTML 存在原有风格/字号等提示；保留已确认主题，不声称全站设计扫描无提示。

**剩余工作**：受保护内容构建与管理员发布/来源认证；受保护学习项进入复习、测评和档案的安全读取/可用性提示；旧练习模式的完整适配；完整异常浏览器矩阵和缓存预算。状态保持 in-progress，未部署/迁移真实资产/重启 live 服务/提交/推送。

### 2026-10-15：私有课程发布、档案与按项复习

- 新增 CoursePublisher，复用现有句子/图文 AI schema、validator 和 compiler。内容工作台上传 JSON/配图 → 校验预览 → 选择免费/会员 → 发布；支持刷新恢复草稿。新增 SQLite publication 表保存不可变草稿/发布指针，原 registry 文件不重写，读取时合并发布条目；新文件保存在数据目录下独立的私有发布文件夹，源正文/素材没有放入公开静态目录。独立编译产物在构建时打包 Ajv，服务端无需另装运行时 Ajv。
- 新课程使用服务器分配的唯一 ID，只创建新平台课程，不覆盖存量课程。准备/发布都有幂等收据，校验 hash/registry 版本；私有文件用排他创建，既有目标须字节一致且不得为符号/硬链接。文件写入后数据库失败时保留私有文件，公开目录/访问策略事务回滚；恢复草稿可安全重试。发布策略和审计同事务提交，成功前没有公开指针。
- 配图只接受匹配实际 PNG/JPEG/WebP 文件头的格式，校验数量/单图/总大小和像素边界；浏览器使用既有图片读取器解码验证。两种课程均通过真正的管理页面上传/恢复/发布验证；图文 PNG/JPEG/WebP 各有实际 canvas 编码的服务器验收。查看手机/桌面截图后修正隐藏提醒与复选框布局，并在新课发布时隐藏原课程编辑的发布按钮。
- ProtectedStudyView 接入既有意群答案匹配和两类课程声明的 typing/chunkSelection 模式；保存仍走既有 learning.answer/learning.resume 队列和统计算法。
- 新增纯 history-index 元数据关联模块。stats 将本账号已有 protected 学习事实与公开课程元数据关联，不获取会员正文、不启动体验；目录失联或课程暂不可用时保留历史行。逐项复习通过原课程保护入口授权，服务端根据注册表解析 itemId 的真实位置；复习不覆盖原课程断点。批量复习不给旧的离线 handoff 塞入受保护项，免费/个人项仍可继续。当前尚未接通受保护项的正式测评 UI。
- assessment-content 内部解析器新增来源检查；平台内容的旧 deck/contentRef/源路径不能绕过 HTTP 守卫直接读出正文。个人已有 deck 历史保留既有读取路径，assessment.answer/finalize 和纯答题保存没有新增会员阻断。
- 原硬缓存预算现已解决：管理/作者/档案和次要首页资源移到已有软缓存，保留主学习页的原子缓存；不提高 1.5 MiB 门槛，软资源继续计入版本 hash。缓存策略 22/22，通过清单不交叉和重新生成幂等性验证。

验证：`course-publisher.test.js`（首次发布/回滚/私有遗留文件/重试）、`image-dimensions.test.js`、`history-index.test.mjs`、会员领域策略/计时组件/regressions/API、`server/membership-content.test.js`（新增内部测评旁路拒绝）、管理浏览器、学习浏览器均已通过。学习浏览器新增档案不请求正文、过期项复习拒绝且保留记录、免费指定项复习及原学习断点保留；所有数据/端口/profile 均为新隔离测试资源。

`npm run typecheck`、会员/发布/测评来源和相关浏览器代码定向 ESLint、`scripts/check-generated.mjs`、部署依赖检查、SW hash/策略检查、课程目录与档案 UI 回归通过。生成的私有编译 bundle 采用与现有 learning-engine 一致的生成文件类型检查豁免，源入口/服务代码均加入检查；未运行全量 pretest 或重建无关课程资源。部署检查仍提示清单内有明确保留的非必需兼容文件，不视为失败。

状态保持 **in-progress**。尚余：存量平台课程的完整来源认证/转换工具、受保护正式测评 UI、剩余原练习能力与完整离线/跨窗/断流/管理异常浏览器矩阵。真实课程没有会员化、迁移或覆盖，真实账号/备份未操作，没有 live 服务更新、提交、推送或部署。

### 2026-10-15：受保护正式测评接线

- 新增 `membership/assessment-content.js`、`assessment-service.js` 与独立 HTTP 路由。来源解析器只按服务器注册表把稳定 protected 学习键映射为 canonical course/unit/item；服务组合已有 CourseAccessService 和 assessment.start/answer/finalize，不另建成绩或 SRS 算法。测评采用既有独立初测/延迟复测周期，每次一项；generation 使用 canonical course scope，和课程学习/重学一致。
- 开始测评先在同一同步事务内授权、校验既有复测资格并创建测评；资格不符或创建失败，体验起点/用量预留/收据一起回滚。重复开始保留原测评，恢复时检查实时权益/租约与目标绑定。正常课程正文批次不随测评响应下发；只返回本次一项的测评会话。个人课和原普通测评继续使用原解析路径；静态来源和缓存命中时的来源守卫继续生效。
- 新增独立的 `ProtectedAssessmentView`，通过组合接入共享学习壳、授权计时与账号作用域。档案“测评这一项”接到 main/courses 的真实入口；提交前隐藏标准英文，提交后读取服务器权威成绩，展示初测/复测结果并保留原课程断点。URL 只保存不含正文的会话 ID，刷新可恢复同一会话。
- 已作答内容与交卷通过既有账号隔离的 ServerStore 队列保存；到期不阻断这两类纯保存操作。断网后自动重试，响应丢失复用既有请求/事件编号，最终确认成绩后停止本次计时。档案展示最近测评事实并明确标为历史记录，不把旧成绩当作已经比对过现行内容的掌握结论。服务端测评历史响应设为 private/no-store。
- 修正真实断网测试发现的英文 fetch 错误泄露，统一显示中文连接失败和重试说明。测评隐藏无关的课节切换，并明确“本次测评 1 项”；沿用原学习主题，检查手机/桌面截图和手机展开详情/表单操作，没有横向溢出。

本阶段隔离验证：

- `node server/membership-content.test.js`：新增未到复测时间不启动体验、注入创建失败后的整事务回滚、canonical generation、开始/交卷去重、目标更换冲突、账号隔离、到期停止新测评但仍可保存答案和成绩、到期后本人历史仍可读。
- `node e2e/membership-learning.test.js`（包含 `e2e/lib/membership-assessment.js`）：两类课真实表单，初测周期提示、暂停/刷新恢复、开始响应丢失后的重试、离线答题/到期后上传、会员续期继续、会员到期后保存已作答内容、交卷响应丢失后的幂等恢复、服务器成绩证据、档案历史展示、手机键盘/布局和课程原断点保留。
- 通过：`node server/operations.test.js`、会员 API、计时组件、history-index、管理浏览器、学习档案 UI 回归；`npm run typecheck`、新增/修改源文件定向 ESLint、构建一致性、部署依赖、SW hash 与缓存策略 22/22。

整体继续 **in-progress**；正式测评 UI 已交付，尚余存量平台课程完整来源认证/转换工具、剩余原练习能力与其余异常浏览器矩阵。所有数据库/私有内容/端口/profile 都属于本次新建的隔离实例；真实数据、课程、原浏览器资料与备份未修改，live 服务未更新，没有提交/推送/部署。

### 2026-10-15：存量课程来源检查与候选材料

- 新增 `LegacyCourseInventory`，组合现有目录和静态路径规则。只读核对 manifest/shard-map 版本、当前分片哈希/数量、条目唯一性和索引指向；扫描本地公开文本中的字面正文证据，包括历史分片、原始脚本和压缩副本。不会执行课程脚本。读取有文件/总量边界，遇到路径越界、公开符号链接、损坏源文件或检查期间来源变更会拒绝继续。
- 报告列出共享课程、公开分享冲突和未检查的公开压缩包/文档。结果明确是 `local-literal-evidence-only`，不把它冒称为动态拼接、其他编码、外部/CDN出口的完整证明；`activationReady` 始终为 false。后台来源检查通过 adminOnly 和 private/no-store，失败或成功都不写课程策略/账号学习数据。
- 会员管理页为未保护的存量课提供“检查课程来源”，展示结果和待核对项。检查后会员选项仍禁用；不允许通过一次文本扫描绕过原有 protectionReady 门槛。手机/桌面截图已核对，手机来源列表可展开且无页面横向溢出，宽表格沿用原本的内部滚动方式。
- 新增 `scripts/prepare-protected-courses.cjs`；必须显式指定静态根与课程 ID，默认只输出报告。可把已验证的句子课节复制为全新私有候选目录，保留 course/unit/item ID、原教学字段与旧学习身份映射；输出内容逐文件校验，拒绝覆盖已有目录或写进公开静态位置。此工具不安装 registry、不切访问策略、不操作账号数据库；候选格式不能直接替换在线注册表。
- 本地静态只读检查两门现有平台课（builtin:oral、builtin:idioms）：66 个课节、3677 项、294 个匹配来源路径。报告保存于 `output/membership-source-review-fufqr6/review.json`；这次命令没有查询真实账号/公开分享数据库，因此报告的 publicSharesChecked 为 false，没有生成真实课程转换包或修改原课程。
- 使用说明及启用边界见 `docs/implementation/membership-source-review-tools.md`。真正启用仍需旧统计键/断点与受保护运行入口适配、公开分享与生产出口复核及隔离验收；真实转换按 AGENTS.md 在具体课程/目标授权与一致性备份后另行执行。

验证：`node server/services/membership/legacy-course-inventory.test.js`（全新临时根；当前/历史/压缩来源、共享引用与公开题库、未知压缩包、源哈希变化、索引身份、CLI、独立候选文件与原文件逐字节不变）通过；管理浏览器真实操作新增只读检查、未授权拒绝、无正文报告、会员选项保持禁用、private/no-store 和手机布局通过。原会员内容服务测试、学习/测评浏览器、typecheck、定向 ESLint、构建一致性、部署依赖、SW hash 和缓存策略 22/22 继续通过。所有有数据库的测试仍使用隔离临时实例；未重启 live 服务、未修改真实资产/记录/备份、未提交/推送/部署。

整体仍 **in-progress**：当前交付的是来源检查和转换候选材料；旧课身份/断点与入口适配、完整认证后的启用、剩余原练习能力和其余异常浏览器验收仍待完成。
