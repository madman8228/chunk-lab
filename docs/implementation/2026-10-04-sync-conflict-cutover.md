# 安全完成同步冲突后台化与全站写入切换

- Status: in-progress
- Updated: 2026-10-05
- Branch/worktree: `master`，`D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `09553df`；工作区已有大量无关改动和未跟踪文件，必须保留。相关持久化 handoff 为 `docs/implementation/2026-10-02-transparent-learning-persistence.md`（in-progress）；本计划收束其全站切换与同步 UI 退役，不另造一套协议。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

普通学习者在全站正常学习时，不再看到“同步冲突”、备份容量、选择本机/云端版本等内部同步故障界面。可靠提交、重试、恢复和冲突保全在后台自动完成；确实不能无损自动合并的内容同时保留并进入非学习者可见的恢复/运维路径，不静默丢弃或擅自覆盖。

## Current state and evidence

- `main.html` 的 `refreshSyncBadge()` 仅当 `serverPersistenceEnabled()` 为真时隐藏旧徽标；该条件要求云配置同时声明 `persistenceMode=server-authoritative`、`writeProtocol=3`，并且 ServerStore/IDBStore 已加载。否则旧 `CL.syncStatus` 仍会展示“待同步/同步冲突”。因此截图中的徽标不能单靠 CSS 调整解决；当前运行实例究竟报告何种配置，须在执行时先做只读核验。
- 同一页面的 `loadLegacySyncResolutionUi()` 也只在 protocol 3 外载入旧冲突弹窗。
- `e2e/sync.test.js` 明确验证旧整包协议发生并发冲突时仍显示冲突入口；`e2e/main-persistence.test.js` 验证 protocol 3 隐藏旧 UI，同时保留本机 legacy 冲突 journal。代码因此已支持“新协议不暴露旧同步 UI”，但旧协议仍会按设计暴露它。
- 主实施交接记录：生产协议切换须等待所有业务写入口迁入、旧写闸门/恢复链/缓存切换验收；不能为了消失徽标提前启用 protocol 3 或删除冲突档案。
- 规划阶段只做静态代码与工作区检查，没有读取或修改 8787 服务、真实数据库或账户数据。随后按实际源码和隔离 E2E 补充下列入口清点；这仍不能代替真实部署配置核验（真实运行实例不在本次授权范围内）。

### 产品写入口清点（2026-10-04 静态调用链复核）

| 产品入口 | protocol 3 领域写操作/旁路约束 | 当前隔离验证证据 | 未据此宣称完成的部分 |
|---|---|---|---|
| `main.html` 首页、普通答题、练习设置、测评、导入 | `learning.answer/exposure/roundComplete/resume/mark`、`settings.patch`、`assessment.*`、导入用 `deck.put`；`saveAndNotify(...,'local')` 只更新本机投影，core 在服务端权威模式下禁止它重新调度整包同步 | `e2e/main-persistence.test.js` 覆盖答题/重试、断网 20 条、设置、测评、导入/导出、退出和旧冲突 journal 保留；`e2e/protocol-persistence.test.js` 覆盖旧协议拒绝 | 仍需完整故障矩阵及 protocol 3 页面状态/保存提示验收 |
| `courses.html` / `course-package.js` 课包播放、重学、导入删除 | `course.progress/restart/put/delete`；只有非 protocol 3 分支才调用 `CL.writeCourses/writeProgress`，protocol 3 需 server catalog/cache 和 readiness | `e2e/course-package-v2-import.test.js`、`e2e/course-enrollment.test.js`、`e2e/imported-course-learning-metadata.test.js` | 仍需证明不同课程版本并发、离线恢复、删课与历史进度组合不会漏写 |
| `decks.html` / `library.js` 题库与图文课管理 | `deck.put/delete/publish/itemsVisibility`、`logicalCourse.put/delete`、`course.put/delete`、`learning.reset`；源码保留旧分支，但由 protocol 3 明确分支到窄操作，目录未加载时拒绝本次写，不回退整包 | 主持久化 E2E 验证题库/可见性/课程分类与统计重置，课包导入及服务端队列 E2E 覆盖内容提交；`server/write-protocol-persistence.test.js` 覆盖 legacy routes 428 | 每种 UI 变体仍非逐按钮端到端覆盖；遗留兼容代码仍须持续受服务端 fence 保护 |
| `stats.html` 统计与错题复习 | 统计迁移使用 `learning.statKeyMigrate`；删除必须收到 `mistake.remove` 回执后才更新投影；`saveStore('local')` 不产生账号级旧快照同步 | `e2e/main-persistence.test.js` 真实进入统计页、删除错题并断言 SQLite/回执，另测跨设备确认投影 | 仍需覆盖容量、请求已提交但响应丢失与所有过滤视图交互 |
| `course-create.html` AI 课程制作 | `course.put` 经 ServerStore 耐久排队/回执；共享 `save-status.js` 显示本地安全保存状态 | `e2e/course-authoring-persistence.test.js` 真实按钮、断网队列、同 requestId 重试与确认缓存 | 尚未覆盖每种草稿恢复/大媒体边界；不能据一页通过宣称全站保存状态完成 |
| 管理/内容运营入口 | `admin.html`、`content-studio.html` 的受管理员认证内容发布/运维操作，不是学习者账号同步写入口 | 服务端 content-studio/管理员认证隔离测试 | 单独的管理员权限/发布验收不属于本轮同步 UI 隐藏证明 |

- 上表是代码调用链及现有测试的静态索引，不等同于所有分支均已实际点击验收；如右列有缺项，主方案仍保持 `in-progress`。

## Assumptions and decisions

- “不暴露”指学习流程不显示内部同步冲突 UI，而不是假装未确认数据已经同步。离线或网络慢时可继续学习；状态按既有低干扰保存提示表达，只有设备无法安全落盘等会影响学习的数据安全问题才给出必要提示。
- 对同一请求的网络重试、已确认回执后的增量拉取和可证明不冲突的操作可自动继续；不同正文/墓碑等无法无损判定的冲突不能自动选本机或云端。双方原件和回执均须保留，转到恢复中心/管理员诊断，不阻塞其他学习。
- 以 `2026-10-02-transparent-learning-persistence.md` 的协议与验收为权威；若它与本计划冲突，先停下并将证据记为 `needs-planning`，不可自行更改协议或缩小范围。
- 禁止通过隐藏一个 badge、扩大归档上限、清空 journal 或强制选边来声称问题已解决。

## Scope

- 完成主 handoff 中剩余的持久协议安全切换前置项：全站窄写操作覆盖、稳定回执与增量应用、启动接管/恢复、旧写路由闸门、legacy pending 安全归档与迁移。
- 在持久协议已被服务端确认且页面依赖/持久存储已就绪后，统一停用普通页面的旧 `syncBadge`、`SyncResolutionUI` 及用户侧冲突流程；保留只读回执和受保护的恢复/诊断能力。
- 验证从实际产品入口（首页练习、课程学习/重学、题库、统计、设置、编辑/发布/导入、错题复习）触发的写入都进入对应窄操作，不再有业务整包保存旁路。
- 所有测试使用隔离 SQLite、临时服务和测试浏览器上下文；发布/生产切换不在本 handoff 授权范围内。

## Out of scope

- 真实 8787 服务重启、生产部署、真实账户数据清理/恢复、协议开关、压缩/删除历史冲突备份。
- 未经用户确认，自动替用户在互相冲突的正文、删除墓碑或课程进度历史之间选边。
- 只改徽标文案/颜色或隐藏服务器错误，却没有证据证明所有业务写入口可靠持久化。

## Contracts and data changes

- 继续使用现有 protocol 3、稳定 `requestId`/`eventId`、SQLite 原子回执、canonical `changes` entity-delta、`since` 水位及 generation CAS；不要引入第二套队列、回执或版本合同。
- 每个已确认操作先提交本地耐久队列，再异步发送；超时/断网复用同一请求编号和正文。收到回执后，增量实体与水位必须在本地原子应用，预测态由确认状态和剩余队列重建。
- 旧整包写在 protocol 3 激活后须被服务端拒绝并返回可识别的升级/协议错误；不能被静默接受。尚未映射的旧 pending 原件与冲突日志须先在独立恢复源中校验并保全。
- UI 退役不能清除 `chunklab.sync-conflict.v1`、服务端恢复档案或回执。相同内容冲突和未知旧回执只能保留/待恢复；不得自动重放未知操作。
- 状态提示使用现有 `js/save-status.js` 语义；内部错误分类、重试和诊断不得包含学习正文、令牌或密钥。

## Implementation steps

- [ ] 1. 只读核对服务配置/构建版本/页面能力，复现旧协议与 protocol 3 下徽标差异；给每个产品页面列出现存写入口，和主 handoff 清单对齐，不触碰 8787 或真实数据。
- [ ] 2. 完成并验证主 handoff 步骤 2、4、5、6、7 中阻止安全全站启用的剩余项：写路由 fencing、所有业务窄操作、缓存增量原子应用、pending 接管/恢复、各入口迁移。沿用原文件边界与合同，逐个记录实际调用链。
- [ ] 3. 为可安全自动处理的情形补端到端合同：断网重试同一 requestId、服务端已提交但客户端未收回执、重复回执、并发跨标签/设备、旧协议客户端、冲突恢复期间本机新写、容量/崩溃故障；证明不可自动选择的内容被保留，且不阻塞无关学习。
- [ ] 4. 只有全部业务写入口和恢复链验收通过后，才按主 handoff 启用持久 protocol 3 默认与服务端旧写闸门；升级提示仅用于旧客户端必要刷新，不显示同步冲突处理界面。
- [ ] 5. 移除普通入口对 `syncBadge`/`SyncResolutionUI` 的挂载和同步冲突提示依赖；保留可恢复原件、只读 receipt 查询及受权限保护的运维诊断。确认恢复中心仍能查找并继续安全处理归档。
- [ ] 6. 更新主 handoff 和必要产品/架构说明，列出每页真实运行入口、协议状态、剩余风险与执行命令；不得仅以模块单测或隐藏控件勾选完成。

## Validation

- [ ] `npm run test:server`：操作事务、路由 fencing、恢复 ingest、protocol 持久状态与增量回执全绿。
- [ ] `npm run test:unit`、`npm run test:browser`、`npm run test:checks`、`npm run lint`、`npm run typecheck`、`npm run build:check` 全绿；若项目脚本已演进，先核实等价命令并记录。
- [ ] 真实隔离 SQLite + HTTP + Chromium 测试覆盖每个产品入口及双账号/双设备/断网重试；断言用户页面没有 sync conflict badge、弹窗或容量提示，同时 SQLite、回执、水位、本地恢复原件均符合合同。
- [ ] 旧协议回归仍验证服务端 428 闸门、升级提示和不丢失 pending 源数据；protocol 3 回归验证旧冲突 journal 被隐藏但保留，不能误删或自动选边。
- [ ] `node scripts/check-deploy-files.js`、SW 一致性检查及 `git diff --check` 通过；部署闭包包括新模块。
- [ ] 验收仅基于隔离实例。未经用户单独授权，不切换真实服务、不执行真实迁移/删除/部署。

## Acceptance criteria

- [ ] 对已启用 protocol 3 的正常账号，全站学习、课程、题库、设置、统计和恢复入口均不显示“同步冲突”徽标/弹窗/备份容量内部细节。
- [ ] 用户学习写入在本地耐久确认后即可继续；网络恢复后同一操作可靠收敛到 SQLite，刷新/新标签/第二设备均得到一致已确认状态。
- [ ] 旧客户端写请求明确被 fencing 并提示刷新，旧 pending 源数据被保全；任何未确认操作不会因为隐藏 UI、未知回执或容量故障而丢失或被重复计数。
- [ ] 无损可判定的修复在后台自动完成；不可判定冲突保留两边并隔离处理，不要求学习者理解同步，不把其中一边伪装成已保存。
- [ ] 产品写路径真实接入并经 HTTP+SQLite+浏览器验收；独立组件测试不作为接入完成证明。

## Risks and rollback

- 主要风险是有页面、旧 Service Worker 或书签入口仍走整包写；须以运行期网络断言和 server fencing 测出，而不是仅查静态依赖。若任一业务路径未覆盖，不启用全局 protocol 3 默认。
- 隐藏冲突 UI 会让未迁移的旧冲突不再由学习者手动解决，因此切换前必须确认归档可恢复、receipt 查询和旧源映射完备。对不能自动合并的冲突保留恢复路径，不能丢弃。
- 若验证发现缓存水位、协议配置、回执合同与 handoff 假设不符，停止切换并将 handoff 改为 `needs-planning`，写明证据和所需决策。
- 回滚只允许通过发布兼容修复版本/暂停新写入并保留已确认快照与本地队列；不得删除数据库标记、重放未知请求或清空备份作为回滚手段。

## Execution notes

- 2026-10-04 verification follow-up：扩展隔离真实浏览器持久化 E2E，使 `user_sync_resolutions` 同时达到 100 行与精确 64 MiB，再在同一 protocol 3 页面验证冲突徽标/弹窗不出现、本机 journal 未删除，普通答题仍获得唯一学习确认并写入 SQLite。容量由 SQLite `zeroblob` 直接构造，测试不触碰真实账户或 8787。`node e2e/main-persistence.test.js`、`npx eslint e2e/main-persistence.test.js` 与目标文件 `git diff --check` 通过。其余产品入口、恢复/旧写 fencing 与全局协议切换仍未闭合，状态保持 in-progress。
- 2026-10-04 verification follow-up：真实浏览器通过兼容旧入口 `ChunkAPI.putData()` 发起整包写，隔离 protocol 3 服务明确返回 428/`CLIENT_UPDATE_REQUIRED` 并触发升级事件；本机旧数据与冲突 journal 保持原样，页面不展示冲突 UI，接着真实练习写入成功。`node e2e/main-persistence.test.js`、定向 ESLint、目标 diff 检查通过。未加载历史 HTML/SW 文件，因此旧版本缓存激活/升级仍需单独验收；全局切换门槛继续开放。
- 2026-10-04 full verification follow-up：`node e2e/upgrade-check.js` 28/28，证明旧内容 key 迁移守恒/幂等、旧 SW cache 在升级激活时删除、当前 cache 可建且升级后能进入学习；完整 browser 58/58、unit 72/72、server 27/27、checks 17/17、lint、typecheck、build:check 全通过。browser 的 `imported-course-learning-metadata` 首轮失败、自动重跑通过，作为时序波动记录。课程包 protocol 3 专项通过；一次首跑有控制台 428“整份数据保存”提示，但重复运行的请求监听未捕获旧整包 endpoint，暂不能说明原因。该专项不是旧 HTML/SW 在 P3 下的端到端升级证明；全站路径和部署切换仍待验收。
- 后续单测 `node e2e/imported-course-learning-metadata.test.js` 通过；`npm run build` 与 `npm run build:check` 通过。全局 `git diff --check` 被既有 `freq-idioms.js` 10 处尾随空格阻断（未编辑该用户内容）；课程包 protocol 3 专项复验成功，测试仍输出两条资源 `ERR_INVALID_URL`，但本次旧整包写响应监听为空。

- 2026-10-04 verification follow-up：在 `e2e/main-persistence.test.js` 中移除对测试包装器捕获 `learning.resume` 请求的依赖，改为等待并断言服务端续学状态已更新且同会话同模式的本地 pending 已退役；原捕获器偶尔漏掉真实提交路径，造成测试误报。首次单跑随后在提示曝光重试断言出现一次未复现失败，紧接单跑通过；修订后完整浏览器组 54/54、unit 72/72、server 27/27、checks 17/17、`npm run lint`、`npm run typecheck`、`npm run build:check` 与相关 ESLint 全通过。首次 checks 16/17 与 `check-sw.js` 一致发现生成的 Service Worker 仍带旧 CACHE；运行项目 `gen-sw` 后复跑 checks 17/17，`check-sw.js` 确认 `chunklab-f9f4593b` 对应 75 个原子和 82 个软预缓存文件。部署闭包确认运行时覆盖完整，但保留动态 HTML 模板误报 `' + escX(src) + '`；全局 `git diff --check` 仍被无关的 `freq-idioms.js` 既有尾随空格挡住。首次浏览器整组 53/54 的唯一失败即测试过度依赖捕获器；修订后完整组 54/54。未触碰真实 8787/数据库/部署。以上只验证本次恢复接管切片，不证明全站写路径、旧写闸门、同步 UI 退役或总体验收完成；计划保持 in-progress。
- 2026-10-04 implementation follow-up：在主 handoff 步骤 5 收敛一个 ACK/增量水位竞态。server-authoritative 模式下，合并中的缓存刷新若未覆盖操作 receipt seq，ServerStore 现在会继续刷新；重试仍未追上时保留 ACK 原件并按原退避机制续跑，不重发已确认写入。`node js/server-store.test.js`、定向 ESLint、两轮隔离 `node e2e/main-persistence.test.js` 与 `npm run test:server`（27/27）通过，离线 20 答题最终各计一次且队列清空。诊断日志已清理。这个局部验收不改变协议激活门槛，不证明全站写入口、恢复/UI 退役或真实服务配置已验收；本计划保持 in-progress。
- 同轮全量验证：`npm run test:unit`（72/72）、`npm run test:checks`（17/17；首次执行识别并生成了工作区已有业务改动所需的 SW 哈希，随后完整重跑通过）、`npm run lint`、`npm run typecheck`、`npm run build:check` 通过。`npm run test:browser` 仍在执行，尚未据此更新浏览器验收状态。
- 2026-10-04 execution follow-up：启动恢复接管改为 fail-closed：已验证来源的待接管列表暂不可读、requestId 正文冲突、durable queue 不可用或无法接纳时，不启用服务端写入；页面仍可把新操作耐久排入本地队列。复核发现同一用户下可能留有其他 API 服务 scope 的旧归档，这些来源保持原件并跳过，不跨 scope 重放，也不阻断当前账号。新增 `e2e/recovery-handover-gate.test.js` 故障注入与恢复模块单测；独立门禁 E2E、主持久化 E2E（离线 20/20、退出 35ms）、unit 72/72、server 27/27、checks 17/17、完整 browser 56/56、lint、typecheck、build:check 均通过。浏览器组 `course-package-import` 首次运行波动、自动重跑通过，保留记录。全站页面写入、恢复 UI、协议切换及整体验收仍未完成；未触碰真实 8787、用户库和部署。
- 2026-10-04 execution follow-up：启动恢复失败后原页面此前缓存了已失败的启动 Promise，直到刷新才会再次尝试。现为启动失败增加 1–30 秒指数退避重试，online/focus/visibility 恢复时立即重试；门禁失败期间仍只本机耐久排队，恢复成功后继续使用原 requestId drain。故障注入 E2E 验证来源从 503 恢复为可读后无需刷新，服务端缓存/水位应用完成且原队列项退役；针对该用例连续 4 次通过。完整 browser 56/56（首次 `ai-course-authoring` 和恢复门禁用例均各有一次自动重跑通过，已记录），unit 72/72、server 27/27、checks 17/17、定向 ESLint、typecheck、build:check 通过。整体验收仍 in-progress。
- 浏览器全组随后完成 `npm run test:browser` 54/54；该组有 1 项主持久化 E2E 首次 flaky，报告为测试观测时序（IDB 已删除 pending 行但内存状态计数尚未刷新），增加双条件等待后独立 `node e2e/main-persistence.test.js` 通过。完整浏览器组是在该测试修订之前跑的，未宣称该组重跑 0 flaky。
- 继续执行主 handoff 步骤 2：`settings.patch` 领域处理器拆到 `server/services/settings-operations.js`，并加入部署闭包；SQLite/HTTP 服务端组 27/27、主页持久化真实浏览器 E2E、针对性 ESLint、部署检查和构建检查通过。全局 `git diff --check` 仅命中无关的既有 `freq-idioms.js` 空格问题；本次改动文件单独检查通过。尚未完成其余内容/答题分派与全站验收。
- 再将错题移除与题库句子隐藏/恢复处理器拆到 `server/services/learning-maintenance-operations.js`，保持统一 SQLite 回执事务，纳入部署清单；server 操作测试与完整服务端组 27/27、针对性 Lint 和部署依赖扫描通过。其余全站目标仍未完成。
- 继续将 `course.enrollment` 的加入上限、加入状态及课程进度投影写入拆到 `server/services/course-enrollment-operations.js`，纳入部署闭包。`node server/operations.test.js`、`npm run test:server`（27/27）、处理器 ESLint、部署依赖扫描及 `node e2e/course-enrollment.test.js` 通过。整体全站切换仍未完成。
- `learning.mark` 领域处理器移至 `server/services/learning-mark-operations.js`，保留代次保护、共享学习引擎和事务边界；`node server/operations.test.js`、完整 server 27/27、学习掌握循环 E2E、定向 ESLint、部署扫描通过。
- 2026-10-04 execution follow-up：服务端内容实体操作已从中央 `operations.js` 拆到 `server/services/content-operations.js`，涵盖 deck/course put、publish、delete，并沿用原 SQLite 事务、revision CAS 和依赖清理语义；新模块加入部署文件闭包。通过 server operations、`npm run test:server`（27/27）、protocol 3/兼容课程包导入 E2E、隔离 SQLite + Chromium main persistence E2E（离线 20 答题恰好一次）、相关 ESLint、部署依赖检查及 build:check。它是服务端结构化的一步，不解决浏览器仍调用整表写入的问题；所有页面迁移、旧 pending 自动接管与故障/运行时验收仍未完成。
- 2026-10-04 execution follow-up：旧统计键迁移处理器已移至 `server/services/stat-key-migration-operations.js`，事务/回执由统一入口控制，新文件纳入部署清单；验证 server 27/27、统计键隔离回归、隔离 Chromium + SQLite 持久化 E2E、ESLint、部署依赖检查和 build:check 全通过。代码拆分不等于解决其余页面整表写入或运行时“同步冲突”状态；整体切换门槛继续未满足。
- 当前浏览器组复验为 53/54，单一 `server-store-queue` receipt 查询失败未能单跑复现（单跑连续 5 次、以及相邻恢复 E2E 顺序均通过）；先作为未定位的 suite-level intermittent 记录，不宣称浏览器组全绿，也不触碰真实运行实例。
- 测评 start/answer/finalize 已拆至服务端独立处理器，维持原 SQLite 原子提交；server 27/27、隔离测评与首页持久化 E2E、Lint 和部署依赖闭包通过。仍有学习 answer/resume/round/exposure 集中分支及所有页面实际写入迁移待完成。
- `learning.exposure` 也已独立为服务端领域处理器，保留 reducer 与 generation 事务合同；server 27/27、unit 72/72、首页/队列隔离 E2E、build:check、Lint 和部署依赖检查通过。整组 browser 的 53/54 未复现失败仍单独记录，不视为全绿。
- 2026-10-04 planning: `main.html` 的代码条件足以解释“旧协议仍显示、新协议隐藏”的分支，但截图对应运行实例的实际 `/api/config` 尚未核实。因此第一步必须确认页面/服务版本与持久协议，区分“尚未完成安全切换”与“浏览器加载了旧构建/旧配置”；不得将静态源码推断冒充运行时诊断。
- 本计划与 `docs/implementation/2026-10-02-transparent-learning-persistence.md` 同属一项交付；实施时优先复用该主 handoff 已完成的 SQLite/恢复/缓存合同和测试，完成后同步更新其 checklist/status。无额外授权不运行真实 8787、不部署。
- 2026-10-04 execution follow-up：普通 `learning.answer`、`learning.resume`、`learning.roundComplete` 服务端处理器移至 `server/services/learning-event-operations.js`，并加入部署闭包；全站实际写路径及切换门槛不变。`node e2e/main-persistence.test.js` 连续 5 次、`node e2e/server-store-queue.test.js` 连续 3 次通过；完整串行回归 unit 72/72、server 27/27、checks 17/17、browser 54/54、lint、typecheck、build:check、SW 检查通过。并行运行六组重型验证时 server smoke 单项失败，独立 smoke 和串行 server 组均通过；browser 组的两个用例各在自动重试后通过，记录为调度/时序波动。部署闭包完整，保留既有动态 HTML 扫描误报。尚未核实 8787 的实际 `/api/config`，也未完成所有产品页面写入迁移、pending 接管、恢复 UI 退役与运行期验收；不得据此隐藏或切换用户界面，计划继续 in-progress。
- 2026-10-04 execution follow-up：ServerStore 永久错误现按目标隔离：同课程、题库、句子、学习/测评会话及同一设置字段上的后续操作在前序操作被 4xx 永久拒绝时仍耐久留队；无关目标继续提交。纯队列回归先复现“同课程进度越过被拒绝的 course.put”，然后经 `node js/server-store.test.js`、真实 IndexedDB/SQLite `node e2e/server-store-queue.test.js` 和完整首页持久化 E2E 验证；改动后 unit 72/72、server 27/27、checks 17/17、browser 54/54、目标 ESLint、typecheck、build:check、SW 检查通过（CACHE `chunklab-f42dbbc4`）。部署依赖覆盖完整，扫描器保留同一动态 HTML 误报。该实现不自动裁决/丢弃 blocked 原件，也未完成整个失败恢复操作、全站业务写路径接入或隐藏普通入口冲突 UI 的安全门；整体计划仍 in-progress。
- 2026-10-04 execution follow-up：旧题库 sync intent 加入恢复中心的安全映射：冻结 body/value 与 request fence 证明逐项吻合后才关联恢复回执，未冻结 intent 则按同账号 scope 核验；非空账号仅映射到用户已确认且实际提交的 deck 窄操作。题库删除、未知/冲突项和 server tombstone 仍保留，不自动执行。`node server/recovery-ingest.test.js`、server 全组 27/27、定向 ESLint 与隔离 Chromium + SQLite `node e2e/main-persistence.test.js` 通过。它不是 pending 接管或全站迁移完成证明；页面写入口、运行实例 `/api/config` 核验、恢复 UI 退役及安全激活门仍未完成，未操作真实 8787 或部署。
- 复核后进一步收紧未冻结来源：intent 的课程/课程进度/题库 value 必须与归档中对应当前实体规范 JSON 完全相同；不匹配即不收录、不标记迁移成功。负向回归先验证旧行为会误收不一致值，修复后的恢复服务测试、server 27/27、定向 ESLint 与隔离首页持久化 E2E 通过。全站安全切换门仍关闭。
- 首页真实退出验收新增：练习中挂起首条设置操作响应 5 秒，期间将共 20 条有效操作耐久入队，并点击真实退出按钮；隔离 Chromium 实测 32ms 返回首页，释放网络后 20 条全部收敛，没有取消或丢弃待办。`node e2e/main-persistence.test.js` 通过；E2E 收敛断言改为精确校验本轮请求 ID，避免无关后台操作干扰。默认 protocol 3、所有产品写入口和冲突 UI 安全退役仍未完成。
- 新增延迟退出合同后完整浏览器回归 `node scripts/run-tests.cjs browser` 54/54 通过；包含课程、移动、恢复、跨标签与升级场景。曾在单独重跑的前置声音设置断言观察到一次波动，单测重跑与完整浏览器组均通过，不将其抹成从未发生。
- 2026-10-04 recovery follow-up：归档 manifest 对本机 `account-local` protocol 3 队列新增严格的“捕获时尚未开始发送”证据，要求 authenticated owner、base、完整 scope、requestId/body 及队列格式标记一致且无 `attemptStartedAt`；它仍保留 `receipt: unknown`，因为其他标签页可能在归档后开始发送，并注明之后仅可用原 requestId+原 body 接管。发送过、旧格式、跨账号/错误 scope 与用户导入备份维持未知，不自动执行。通过 `node server/recovery-ingest.test.js`、server 27/27、定向 ESLint、语法与目标 diff 检查。此项仅是安全候选追踪，不是旧 pending 自动转换或全站接入完成。
- 2026-10-04 execution follow-up：发现 `course-create.html`（AI 课程制作实际入口）加载了 `ServerStore` 却漏载 `js/save-status.js`，导致协议 3 下网络暂断时只显示“正在处理”，没有通用的本地耐久/自动重试反馈。补上依赖，并新增自动纳入浏览器组的 `e2e/course-authoring-persistence.test.js`：以隔离 SQLite + protocol 3 服务和真实浏览器点击“保存课程”，拦截操作请求后验证 durable pending、共享提示明确为“已安全保存在此设备”，恢复请求后确认仍使用同一 requestId、receipt 成功、缓存实体出现且队列清空。独立 E2E 连续两次通过，完整浏览器组 `npm run test:browser` 55/55、`npm run test:checks` 17/17、`npm run lint`、`npm run typecheck`、`npm run build:check` 通过；`node scripts/gen-sw.js` 后生成 `chunklab-6256832a`，checks 内 Service Worker 与部署闭包校验均通过。该修复只闭合 AI 制作页的提示接入；其他页面、恢复/旧写安全门、协议默认切换及全站同步冲突 UI 退役仍未验收，主 handoff 保持 `in-progress`。
- 2026-10-04 execution follow-up：课程库补上 protocol 3 下的窗口重新聚焦刷新，5 秒节流并复用 `ServerCache.refresh()` 的账号/路径 fencing、增量水位和原子应用；缓存应用事件随后重建当前课程目录。隔离 SQLite + Chromium 双上下文 E2E 由第二上下文删除逻辑课程目录，再让第一个仍打开的课程库触发 focus，确认目录在不 reload 页面时消失；协议 2 兼容 E2E 也通过。恢复启动失败后在线事件重试门禁用例再连续通过 3 次。`npm run test:browser` 56/56、`npm run test:checks` 17/17、`npm run build:check`、`npm run typecheck`、定向 ESLint、Service Worker 检查通过；部署依赖闭包完整，扫描器仍报告已知动态 HTML 模板误报。此切片只补课程库返回前台后的跨设备可见刷新；全站写入口、恢复接管、协议默认切换与冲突 UI 退役仍未验收，整体保持 `in-progress`，未访问真实 8787/数据库或部署。
- 2026-10-04 execution follow-up：新增隔离 Chromium + HTTP + SQLite 401 恢复 E2E，实证同账号重新登录后，页面启动接管会自动以原 requestId/正文重放 durable pending，最终仅写入一条服务端 receipt；ServerStore 单测同步改为通过 `cloud-config-changed` 事件而非手工调用重试。验证：browser 57/57、unit 72/72、checks 17/17、串行 server 27/27、lint、typecheck、build:check、SW 一致性检查通过。Server 曾在并行执行时有一个进程启动失败，串行整组通过。部署闭包完整但保留动态 HTML 模板误报；全局 diff-check 仍被无关 `freq-idioms.js` 既有尾随空格阻断。本次仅关闭 401 身份恢复合同缺口；所有业务入口、遗留 pending 转换/恢复、全站 sync UI 退役和 protocol 3 切换门槛仍未闭合，因此计划保持 in-progress；未触碰真实 8787、用户数据库或部署。
- 2026-10-04 verification follow-up：将作者课程保存 E2E 从同页手动重试改为断网耐久入队后刷新页面，验证启动接管自动发送同一 requestId/正文，服务端缓存与唯一 receipt 确认后队列退出；随后增加断言确认刷新后原 session 的两个课程句子仍从本机草稿恢复。新增断言后的定向 E2E 和 ESLint 通过；完整 browser 57/57 是在最后断言加入前通过，故不把它计为该断言的整组复验。此轮浏览器组有两项首轮时序失败由测试框架自动重跑通过（导入学习元数据、server-store queue），均保留波动记录。真实 8787 只读探测当时拒绝连接，未启动/改动服务。图片附件/大草稿边界、其他页面写入口、旧 pending 类型接管、sync UI 退役或默认协议激活仍未完成；整体保持 in-progress。
- 2026-10-04 verification follow-up：新增隔离 SQLite + Chromium protocol 3 课程加入上限 E2E，真实服务器有 3 个已确认加入关系时，刷新课程库后第 4 门菜单项显示上限提示且 disabled，服务器侧仍为 3 条且未收到额外 enrollment 操作；作者工作台恢复草稿断言也纳入本次整组。完整 browser 58/58、unit 72/72、checks 17/17、串行 server 27/27、针对新增 E2E 的 ESLint 通过。`home-render-performance`、`recovery-handover-gate`、`server-store-queue` 首轮失败、自动重跑通过，未隐藏波动。剩余全站实际写路径与恢复合同、普通入口冲突 UI 退役、protocol 3 默认激活均未通过验收，计划保持 in-progress；真实 8787 未启动/修改。
- 2026-10-04 verification follow-up：课程包 protocol 3 删除覆盖由内部 API 调用改为真实课程菜单与二次确认 UI；修正测试先前未证明缓存已含目标课程的竞态后，精确等待 `/api/operations` 的 `course.delete`，并核对课程/活动进度删除回执及刷新后列表消失。protocol 3 专项课程包 E2E 连续两次通过，目标 ESLint 通过；默认 browser 58/58、unit 72/72、checks 17/17、串行 server 27/27 均通过（默认浏览器组不设置课程包专用 P3 环境变量，因此 P3 分支以专项命令运行）。此单一路径 UI 接入不等同于各入口全覆盖；全站写路由、恢复、UI 退役与默认激活仍保持开放，真实 8787 未启动/修改。
- 2026-10-05 execution follow-up：真实 protocol 3 图文作者流程曾在保存成功后无法立即加入课程。根因为加入目录从旧本地 `CL.readCourses()` 取课，而本次服务端确认视图位于 `ChunkCourse` owner-fenced cache；增加只读 `ChunkCourse.readCourses()` 并让作者 gateway 用确认视图建目录。新增隔离 SQLite + Chromium E2E 实测图文文件绑定、course.put 唯一回执、SQLite 持久化、立即加入、图片播放器显示及刷新后可播放均通过。`npm run build:check`、定向 ESLint 和作者工作台/图文 P3 E2E 通过；作者 E2E 首轮练习方式恢复断言失败，单独重跑通过，作为波动记录。新增 E2E 已按文件约定自动归入 browser 组，但尚未重跑完整组。仅闭合 AI 图文课程这一入口；其他写入口、恢复矩阵、同步 UI 退役、旧协议 fence 与默认切换验收仍未完成，主计划继续 in-progress；未触碰真实 8787、用户数据或部署。
- 2026-10-05 verification follow-up：修正 `courses.html` 中 `course-package.js` 缓存哈希并重生成 SW（`chunklab-10f2dcbe`）后，完整回归 browser 59/59、unit 72/72、server 27/27、checks 17/17、lint、typecheck、build:check 全通过。首次 browser 轮的 58/59 仅因缓存哈希在课程包测试执行后才更新；更新后的课程包专项与完整组均通过。部署扫描仍保留动态模板 `' + escX(src) + '` 已知误报。新增图文 P3 场景已纳入全组；协议 3 全站默认激活、安全恢复矩阵、其他业务入口实际验收和冲突 UI 退役门槛尚未闭合，计划仍 in-progress。未触碰真实 8787、用户数据或部署。
- 同日继续强化课包升级验收：将课程包 protocol 3 E2E 的网络断言拆分为升级前遗留请求和 protocol 3 页面就绪后的请求；隔离场景确认旧 `/api/data` PUT 收到 428，而新页面业务阶段没有任何旧写调用。该 428 是测试主动制造的旧协议兼容请求，不能解释为普通 P3 用户仍会看到同步冲突；E2E 与定向 ESLint 通过。安全闸保持关闭，协议总体验收未完成。
- 同日补测图文制作草稿恢复：在尚未保存的 image-text 预览阶段真实刷新页面，确认草稿会话、两张图像引用及上传图片字节均恢复，然后继续完成 course.put、入课与刷新播放。定向 P3 E2E 和 ESLint 通过；该最近一次断言尚未进入上一轮完整 browser 59/59，保留为下一轮整组验证项。
- 同日后续整组复验现已包含图文草稿恢复最新断言：`npm run test:browser` 59/59 通过；课程包专用 protocol 3 流程在隔离实例通过，旧页面整包请求被 428、P3 就绪后的产品流程没有旧写。状态仍 in-progress，因为全站全部写入/恢复入口及默认协议激活闸门尚未通过。
- 同日修正部署依赖扫描器将内联脚本拼接 URL `' + escX(src) + '` 误判为不存在文件；静态缺失引用检测仍保留。`node scripts/lib-deps.test.js`、`node scripts/check-deploy-files.js`（无误报错误）、checks 17/17、lint、typecheck、build:check 通过。该修复仅清除误导性诊断，不放宽部署检查或协议安全闸。
- 2026-10-05 sync-conflict suppression slice：普通入口现在不再加载/呈现 `syncBadge` 或 `SyncResolutionUI`，并通过 S6 protocol-2 conflict、protocol-3 `main-persistence` 和 offline-config E2E 验证 DOM；不可自动合并的旧整包冲突双方先被 gzip recovery source 验证归档，隔离 scope 后本机 durable 学习仍可继续，云端未确认状态如实提示。旧 null-revision 测试改为调用内部恢复接口并额外断言普通首页没有冲突控件。为运维侧增加 admin-only `/api/admin/sync-quarantines` 只读索引，只返回 verified source 的账号/来源标识、hash 与冲突分类，不泄露学习快照；匿名 401、管理员读取和摘要脱敏均经测试。browser 59/59、unit 72/72、server 28/28、checks 17/17、lint/typecheck/build:check/SW/deploy 检查均通过（metadata 浏览器用例首轮 flaky、重试通过）。仍缺安全的运维后续恢复工作流，并未完成 10/02 主线中剩余业务入口写接线、旧来源查找/恢复、默认 protocol 3 及全站入口矩阵；因此本 handoff 继续 in-progress。真实 8787 只读不可达，实例根因未核实；没有服务重启、真实数据修改或部署。
