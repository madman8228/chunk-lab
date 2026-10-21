# 登录必需与账号缓存边界收敛

- Status: complete
- Updated: 2026-10-21
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: 7dc9bd0e738d5734c3adba2a54a72ef10f9c525d；本次检查时 core.js、api.js、api.test.js、main.html、js/account-storage.js、js/server-cache.js、js/server-cache.test.js、js/server-store.js、server/index.js、server/routes/operations.js 已有修改；js/learning-session-bootstrap.js、src/learning/native-course-session.mjs、js/server-cache-receipt.test.js、docs/offline-scope.md 为未跟踪文件。执行前逐文件复查，以上现状不是可覆盖的基线。
- Planner: GPT-6 Astra（用户已回复继续规划；环境不提供模型名称校验）
- Executor: GPT-5.6 Luna

## Objective

交付一个完整但有限的结果：正式运行仅支持登录账号学习；同步响应必须证明其账号与发起请求的账号一致，才能进入确认缓存或确认待保存操作。游客只显示介绍及登录入口；离线仅使用同账号已有缓存及原有待保存队列，不扩大课程离线授权。

这能消除匿名/登录双轨带来的身份歧义，但不能消除断网、数据回滚、跨设备并发和缓存回收。保留现有必要序号，不增加第二套同步框架。此次不自动修复真实历史异常数据，也不承诺登录改造后旧异常自然消失。

## Current state and evidence

本轮只读核查代码，没有读取真实数据库或浏览器存储，没有重启服务或验证当前在线状态。

1. `server/auth.js`：只有 REQUIRE_AUTH=true 才鉴权，其他值走 ensureDefaultUser()。`server/index.js` 仅在 production 禁止开放模式。默认模式可使请求实际归属默认用户，即使浏览器带有另一个账号 token。
2. `js/account-storage.js`：owner 来自服务器地址与 token 中 uid；无 token 时使用 local。已有会话 epoch、切换重载和旧数据保留机制，应沿用。解析 token 仅用于本地命名空间，不等于服务器认证。
3. `server/routes/data.js` 返回 readMemSnapshot(req.userId, since)，没有单独声明响应账号；`js/server-cache.js` 的 apply() 直接使用请求端 owner 为结果归属。全量 seq 小于 appliedSeq 时抛 SERVER_SEQ_ROLLBACK，保护当前缓存。
4. `api.js` 已捕获 token/base/sessionGeneration 并拒绝过期会话响应，适合在同一个响应入口加身份校验。`js/server-store.js` 在收到成功操作结果后先 markPendingAcknowledged，再应用回执/下拉；身份校验必须发生在 ACK 之前。
5. `js/learning-session-bootstrap.js` 的 ready() 只在有 token 时检查服务端就绪，无 token 时仍可返回。`core.js` 的 ensureCloud() 接受开放模式，获取配置失败时会读取本账号缓存配置。
6. `src/learning/native-course-session.mjs` 在读取课程目录前调用 ready()；SERVER_SEQ_ROLLBACK 没有对应文案，会落入通用网络错误。`main.html` 的 bootMain/launchNativeCourse 与显式 workspace 路由是运行时接入点。
7. `docs/offline-scope.md` 已明确：新开正式课程需在线授权；目录/封面缓存不是完整离线课程；原有待保存队列不能清除。
8. 历史对话记录过序号回退告警，但“默认账号污染了某账号”“261 与 2 哪份正确”尚未通过数据归属核查证明。不能当作已确认根因，更不能据此覆盖缓存。

## Assumptions and decisions

- 用户的“必须登录”解释为首次使用须在线登录，退出后不能查看个人缓存；已经登录且未退出的设备可以离线查看既有个人缓存。离线无法即时获知服务端撤销登录，接受此只读限制；联网 401 后锁住个人入口，不借用 local 数据。
- 正式服务不再提供免登录学习。保留隔离测试中的显式开放夹具，不删除默认用户及历史课程，不迁移其所有权。
- 最简单的“只隐藏游客按钮”不能约束直达网址与 API；“清缓存重拉”可能丢失独有记录；“删除所有序号”会破坏重试去重及回退保护。均不采用。
- 修复重心在服务端鉴权边界与 API 响应确认边界；前端只处理登录状态和准确提示，不用兼容逻辑掩盖错误。
- 不新增数据库实例号、缓存世代号、全量迁移机制或离线许可系统。账号 ID、已有 seq、requestId、session epoch 分工不同，不相互替换。

## Scope

1. 默认强制鉴权，并禁止常规运行以显式 false 恢复开放模式。
2. 同步数据/操作回执返回实际账号，客户端在持久化前校验。
3. 首页与所有正式学习入口统一拒绝未登录状态，不进入匿名练习或借用旧 local 缓存。
4. 回退/账号不匹配/协议缺失分别报错，停止该会话自动保存与无效重试，保留数据。
5. 隔离实例中的登录、切换、断网、旧客户端兼容与真实页面闭环测试；更新离线范围说明。

## Out of scope

- 不修改真实数据库、浏览器缓存、课程资产、学习记录和备份，不自动清理或重建。
- 不上线、不重启 live 8787、不提交、不推送。
- 不重写同步引擎，不移除 seq/revision/requestId，不重新设计会员。
- 不交付整课下载、长期离线授权、全库图片预缓存或游客数据合并。
- 不扩散重构旧测试；只调整直接受新契约影响的夹具。

## Contracts and data changes

### A. 服务端登录策略

- `server/auth.js`：默认 REQUIRE_AUTH=true；正式启动显式 false 应 fail-fast，不能悄悄忽略配置。强密钥校验继续使用 assertSecure()，不得生成随机临时密钥掩盖配置错误。
- 开放模式只允许 NODE_ENV=test 且显式 REQUIRE_AUTH=false，并要求绝对路径 CHUNKLAB_DATA_DIR、独立显式 PORT、数据路径不在 server/data 下。测试调用者必须 mkdtemp 分配全新目录，不将“配置了任意目录”视为隔离证明。复用现有 `server/testing/legacy-protocol.js` 的路径检查原则，不把历史协议路由带进正式服务。
- auth.authenticate 成功后声明实际账号；身份仍只取验签后结果。检查 verifyToken/readUser 现状，确保已删除/不存在用户不能仅凭旧 token 获得个人数据访问。

### B. 响应身份：一个 HTTP 头，不再增加业务序号

- 在 auth.authenticate 后设置 `X-ChunkLab-Account-Id: <十进制用户ID>`；隔离开放测试使用 `local`，正式服务永远不返回 local。只从已认证 req.userId 推导，不接受客户端传入归属。
- `server/index.js` 的现有 CORS 白名单保持不变，仅增加该头到 exposedHeaders，验证允许的跨域客户端能读取。个人数据与回执响应使用 private, no-store；不让 Service Worker 缓存它们。
- `api.js` 为 getData、submitOperation、getOperationReceipt、importCourseContent 四条确认通道启用强制响应身份校验。核查这些封装的实际路径（含 query），不要靠容易漏匹配的字符串拼接推测。
- 捕获请求 token 的 uid；成功响应在返回解析结果之前，校验响应头与捕获 uid 相同，并保留原有 checkSession()。缺头报 `SERVER_IDENTITY_REQUIRED`；不匹配报 `SERVER_IDENTITY_MISMATCH`。失败响应先按既有 HTTP 错误处理，401 仍为 NOT_AUTH。
- 缺头/错账号结果不得到达 mergeSnapshot、markPendingAcknowledged、队列退休逻辑；请求可能已在服务端成功，原 requestId 必须保留以便正确身份恢复后的幂等查询/重试。
- 首选在传输入口一次校验，不在每页重复解析身份。单元测试若直接调用 ServerCache 合并函数仍测试其原有纯合并契约，不能据此宣称真实网络入口安全。
- `/api/config` 增加 `responseIdentityVersion: 1`，新客户端在启动同步前要求此能力和 requireAuth=true。旧服务端不满足时明确提示升级/配置问题，不能自动退回匿名模式。隔离开放夹具只有 local 请求可接受 local 响应；持有 uid 的请求永远不可接受 local。
- 无数据库表结构变更、无缓存键迁移、无历史回执批量改写。旧客户端忽略新增响应头；新客户端遇到旧服务器暂停保存，保留队列。服务端先升级再发布客户端，之后才考虑恢复业务。

### C. 页面与缓存状态

- `LearningSessionBootstrap.ready()` 在无 token 时直接 AUTH_REQUIRED，先于加载个人内容；preload() 保持其资源预加载职责。
- `core.js`：无 token 不启动个人同步；已知配置是开放模式/缺身份能力时不调用 finishCloudStartup。离线使用现有账号隔离缓存，不把离线缓存配置当作联网授权证据。
- `main.html`：无 token 的 workspace/home 渲染介绍/登录入口；练习深链接显示登录入口，不显示空进度、快捷键和账号会员错误。登录后走现有会话切换重载，返回原内部目标；returnTo 仍遵守现有安全约束。
- 复用现有工作区登录展示，不新增第二套登录弹层。检查教材、复习、直达练习是否都经过 ready()；遗漏入口在其启动边界接入，而非给每页写同步兜底。
- 退出/切换账号不展示上一账号数据；只切断可见性与活动会话，不清除旧账号缓存/待保存队列。
- `SERVER_SEQ_ROLLBACK`：提示“学习数据版本需要核查，原记录已保留”，不宣称网络故障，不提供清缓存按钮。身份错误提示“登录账号与服务端响应不一致，已暂停同步；原记录保留”。升级错误提示更新服务。均在内容区域，沿用现有错误面板。
- 这些确定性错误不进入后台指数重试/焦点触发的循环；用户明确重试或新会话初始化可以重新检查。普通网络断线继续现有恢复重试。ServerStore 同时停止继续发送该会话队列，不清空、不标记已确认。
- 既有历史缓存不因新响应头自动获得“已审核正确”标记；seq 回退保护原样保留。本方案防止新增身份错配，不证明历史缓存归属无误。

## Implementation steps

- [x] 1. 复查 scoped diff 与本计划，保留既有工作区改动；所有服务端/浏览器持久化测试均使用临时目录及隔离端口。
- [x] 2. 完成默认鉴权、隔离测试例外、账号响应头、能力字段及 CORS 暴露；服务端响应边界由新增隔离 E2E 直接验证，未另造重复的 server-only 测试夹具。
- [x] 3. 完成四条确认通道的响应身份验证；API 错误/迟到响应、ACK 前置安全和确定性错误暂停测试通过。
- [x] 4. 完成登录/能力门槛、同账号离线缓存与确定性错误暂停；现有 seq 防护保留。
- [x] 5. 完成首页和课程/单词本直达入口保护、内容区登录提示和错误分类；单词本 visitor gate 已验证不请求课程内容。
- [x] 6. 完成隔离的 `e2e/authenticated-cache-boundary.test.js`；调整受影响的单词本 E2E 断言以匹配登录必需契约，未开放正式游客学习。
- [x] 7. 更新离线范围说明；运行 `node scripts/build-membership.mjs` 与 `node scripts/gen-sw.js`，生成产物已与静态缓存哈希一致。
- [x] 8. 完成本次记录；未读取或修改真实数据库/浏览器数据，未重启 live 8787、未部署、未提交。

## Validation

全部写入/持久化/E2E 测试使用 mkdtemp 临时数据目录与独立端口；未连接真实账号数据库。

- [x] `node e2e/authenticated-cache-boundary.test.js`：默认鉴权、开放模式拒绝、身份头、no-store、CORS、操作回执/导入错误及首页/教材游客门槛通过。
- [x] `node api.test.js`、`node account-storage.test.js`；`node js/server-cache.test.js`、`node js/server-cache-receipt.test.js`、`node js/server-store.test.js`、`node js/learning-session-bootstrap.test.js`。
- [x] `node --test src/learning/native-course-session.test.mjs`、`node scripts/main-lifecycle.test.mjs`、`node scripts/core-storage-state.test.js`、`node scripts/core-sync-transport.test.mjs`。
- [x] `node e2e/account-login.test.js`、`node e2e/account-isolation.test.js`、`node e2e/server-authoritative-startup.test.js`、`node e2e/wordbook-study.test.js`。
- [x] `node scripts/workspace-offline-directory.test.cjs`、`node scripts/offline-covers.test.cjs`、`node scripts/sw-install-budget.test.cjs`、`node sw-policy.test.js`；生成 Service Worker 后版本哈希和清单检查通过。
- [x] 新旧协议风险使用隔离服务/客户端夹具核查；无真实老账号数据库连接。

## Acceptance criteria

- [ ] 未登录首页只显示公共介绍/登录；直接进入口语课程、教材练习、复习不能读取个人内容、入队答题或显示空练习控件。
- [ ] 登录后真实页面能读取本人课程、开始一题、保存并刷新后保留；不是只通过身份帮助函数的单元测试。
- [ ] A 请求收到 B/local 身份响应时，缓存内容/appliedSeq 不变，队列不被 ACK 或退休。服务端已执行但响应被拒的操作用同一 requestId 恢复，不重复计分。
- [ ] 切换到 B 后到达的 A 响应被丢弃，A 缓存/队列保留，B 不见 A 的目录和学习记录。
- [ ] 断网重开只展示已有同账号缓存；首次离线/退出状态要求联网登录。新正式课程仍不能越过授权；恢复联网不丢失、不重复提交原有答题。
- [ ] seq 回退时原缓存及待保存操作不变，明确提示需要核查，不再冒充网络错误或自动重试风暴。
- [ ] 新客户端对无身份能力的旧服务器不写缓存；旧客户端可正常读取增加头字段的新服务器。正式免登录配置无法启动。
- [ ] 封面保留、按需图片策略和首次缓存体积预算不退化。没有任何真实数据修复/清理、服务重启或上线操作。

## Risks and rollback

- 强制登录降低首次体验便利；离线只读无法即时发现服务端撤销 token，联网后必须重新认证。这是明确的产品取舍，不承诺完全离线。
- 配置缺失会从“开放可用”变为启动失败；部署前需核对强密钥和账号入口。不得为启动方便恢复默认账号回退。
- 响应头可能被代理丢弃；测试 CORS 与代理配置，缺失时暂停而非继续写入。不能把安全检查改成警告后放行。
- 只靠账号头无法区分同地址同 uid 的数据库历史回滚；现有 seq 防护继续负责，进一步服务器实例身份需另案证明必要性。
- 回滚仅回退本批代码及匹配静态产物，不动数据库、队列或缓存。线上回滚/重启仍需用户授权，且不能用开放模式作为回滚方案。
- 若确认历史数据需要修复：先读取账号归属、服务地址/实际数据目录、seq、课程/记录数量及待保存操作摘要；不输出 token/密钥。取得对具体数据库/账号/浏览器目标的授权，建立一致性 SQLite 备份及可验证浏览器导出，再提出逐项修复。不得直接复制正在 WAL 写入的主库；不得用整个快照覆盖非空账号。此恢复工作不属于本次执行验收。

## Execution notes

- 2026-10-21：执行中发现教材单词本的 recognition 分支在 `ready()` 前读内容，且普通分支把未登录用户放入体验模式。将 token 门槛前移到 wordbook 启动入口，复用现有 `ChunkAuthUI`，根据服务端 `authMode` 选择登录方式；访客仅看到内容区登录卡片，不读取课程内容。E2E 验证请求数为 0、无作答控件、登录弹窗可打开。
- `e2e/wordbook-study.test.js` 中少量选择器已与当前界面结构不同（旧的详情页“开始 / 继续练习”和 `.study-more`）；仅将测试导航/断言改为当前可达的单词本练习页与真实“跳过”入口。完整的登录用户保存、回执重放、刷新续学、断网恢复、跨设备和四种视口回归通过。
- `sw-policy.test.js` 首次发现 `sw.js` 哈希落后于当前硬/软清单；按项目流程运行 `node scripts/gen-sw.js` 后，21 项策略检查通过，生成操作幂等。
- 验证通过：API 身份契约、账号存储、缓存合并/回执、待发队列、学习会话启动、native course session、main lifecycle/storage/transport、账号登录/隔离、server authoritative startup、wordbook study、隔离登录边界，以及离线目录/封面/安装预算/Service Worker 策略测试。
- 独立 `server/authenticated-sync-boundary.test.js` 未单独创建：同一服务端 HTTP 契约已由 `e2e/authenticated-cache-boundary.test.js` 在隔离真实服务中覆盖，避免重复测试夹具。
- live 8787 未重启或更新；没有读取、迁移、删除或覆盖任何真实课程、账号记录、浏览器存储或备份；未部署、未提交。
