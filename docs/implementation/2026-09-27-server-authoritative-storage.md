# 服务端唯一权威存储：保存路径收敛与存量迁移

> Status: superseded. 2026-10-02 起由 [全站自动保存：操作提交、静默恢复与旧同步退役](2026-10-02-transparent-learning-persistence.md) 承接；本文保留为历史实现记录，不再单独执行，避免协议与迁移规则分叉。

- Status: in-progress
- Updated: 2026-09-27
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22。当前为大量已有修改的工作区；core.js、main.html、api 消费页面、course-package.js、server/db.js、server/index.js、data-migrations/data-rows/data-snapshot、内容及测试已有修改；js/course-enrollment.js、退出性能测试、内容工作台等为未跟踪成果。以执行时工作区为基线，不用 HEAD 覆盖。规划仅新增本文。
- Planner: Astra-Luna planning workflow（不推断界面当前模型）
- Executor: GPT-5.6 Luna

## Objective

交付一个完整结果：HTTP 部署下，SQLite 为学习数据唯一权威来源；浏览器保存服务端缓存和未确认的操作，不再维护可整份覆盖服务端的独立学习快照。首页、练习、课程包、我的课程、统计、导入导出实际接入。保留现有学习算法和课程内容；正常退出到首页小于 1 秒，提交失败可见、刷新后可恢复，重复提交不重复计数。

本计划替代旧计划中“日常双向快照同步”的方向，不重新打开所有历史待办。分阶段开发，全部验收后才结束；不把仅新增服务接口视为完成。

## Current state and evidence

- 仓库及已检查的上层路径未发现 AGENTS.md，执行前复核。
- core.js：saveAndNotify → saveMem 先本地持久化，再调度同步；ensureCloud/finishCloudStartup 在开放模式启用同步。api.js、js/batch-sync.js、js/sync-outbox.js 配合处理整账号基线。
- server/routes/data.js 的 PUT /api/data → services/data-save.js：事务内先去重，再 assertBatchVersion(baseSeq,currentSeq)，之后写实体、行级统计和事件。因此无关数据变化也可能使整批被拒。不是“后端每次删除整个数据库”，也不能把序号不同直接等同于业务内容冲突。
- 数据已按 user_courses、user_course_progress、user_sentence_stats、user_events、user_entity_rows 拆表。复用这些表及 change-seq、data-snapshot，不重建数据库。
- services/data-writers.js 接受客户端 revision；新路径必须由服务端从当前行生成下一 revision，不能直接沿用客户端增 rev。
- server/routes/courses.js 在正式模式拒绝旧单课程写入并引导至条件批次；必须提供真正的新操作入口，不能简单恢复无条件写接口。
- main.html/decks.html/stats.html 用 CL.saveAndNotify；course-package.js 用 CL.writeCourses/writeProgress，缺少 CL 时还有 localStorage 回退；js/course-enrollment.js 把加入状态存为 enrollment:v1: 进度行。都要纳入迁移。
- js/sync-resolution-ui.js 的整账号比较主要是计数加折叠 JSON，不能支持用户理解实际差异。
- 前次只读调查确认开放模式默认账号有 lesson_1_excuse_me 的课程及进度。这里只证明两份状态存在；当前冲突的历史触发操作尚未确定，不能在迁移时假设浏览器空值是删除指令。
- e2e/exit-performance.test.js 已有慢同步下退出用例，但夹具直接写 localStorage；新模式需改为服务端种子数据并验证真实提交链。

## Assumptions and decisions

1. 用户已选择服务端权威方案；本轮 HTTP 使用需要服务可达，不建设持续离线答题能力。服务失联时可浏览缓存、退出，暂停接受新答题/修改；失联前已接受的操作持久保存并重试。
2. 采用一个保存协议，不增加用户切换多种同步模式的设置。file:// 旧数据只提供只读查看/导出及启动服务指引，不在新版本继续独立写学习数据。README 明确此兼容性变化。
3. 保留默认本机账号及已登录用户隔离；不把认证重写纳入本轮。同一个服务的开放模式共享默认账号须明确展示；不同来源、账号、会话不可混用待提交操作。
4. 复用现有学习规则，抽取必要纯函数供服务端使用，不新增事件溯源平台、消息队列、ORM 或通用状态管理框架。
5. 日常学习的计数/熟练度/复习时间由服务端读取最新数据后按操作更新；客户端可以预览反馈，但确认值以响应为准。

## Scope

启动读取、学习/复习提交、课程包节点进度、课程加入退出、题库与课程 CRUD、设置/熟练标记/错题操作、发布状态、统计及重置、备份导入导出、旧数据迁移、保存状态提示、账号切换、旧客户端写入拦截。

## Out of scope

改学习算法、内容审校、重写页面框架、持续离线编辑、多数据库、远程部署、自动合并所有历史差异、清理真实数据库或备份。不得擅自替用户选择截图中的任一版本。代码实施不包含执行真实数据的覆盖迁移。

## Contracts and data changes

### 读取与启动

- /api/config 增加 persistenceMode:'server-authoritative'、writeProtocol:2；保留原字段。HTTP 客户端只在配置及账号确认后初始化数据层，不以网络失败降级为独立本地写入。
- 复用 GET /api/data 与 since 增量读取。缓存只加速首屏；加载完成前禁用修改，不闪进课程。服务端空快照也有效，缓存中的多余行不能自动上传或复活。
- account + API origin + protocol 隔离缓存/待提交记录；会话切换后的旧响应不得污染新页面。页面重新激活时增量读取；发现水位失效时全量替换缓存，不自动合并旧缓存。

### 写入

- 新增 POST /api/operations，单请求为 {protocol:2,requestId,type,payload,expectedRev?}。服务端白名单分发；不接受任意 SQL、任意整账号 mem、客户端自定 rev 或 userId。
- 同一用户/requestId 唯一；新增 user_operation_receipts(user_id,request_id,payload_hash,result_json,created_at)，复合主键。操作、seq、结果收据在同一 SQLite 事务提交。相同 ID/内容返回原结果；不同内容返回 REQUEST_ID_REUSED。正常重试不能生成新 ID。不自动删除收据导致旧操作再次应用。
- 响应 {ok:true,requestId,seq,changes}，changes 使用既有增量读取的实体形状。较旧响应不能回退已应用水位；不确定时增量拉取。允许收据命中后读取最新数据补齐。
- 固定业务类型：learning.answer、learning.roundComplete、learning.mark、learning.reset；course.progress、course.enrollment；course.put/delete、deck.put/delete/publish；settings.patch。备份恢复与旧数据迁移另走受控入口，不伪装成普通答题。实施时给每种类型定义窄 schema，覆盖现有用户操作，不保留任意 snapshot.set 后门。
- learning.answer 传事件 ID、稳定句子/课程标识、答题结果和规则所需输入；不传全量历史统计。服务端复用现有计分/复习规则，更新事件、句子档案、相关计数/标记/进度，全部原子提交。保留现有日期/时区规则，不按请求重试时间重复产生练习。
- course.progress 对 seen/passed 做集合新增，completed 单调变为 true；重置为独立显式操作。当前节点按服务端接受顺序更新。加入状态维持现有 enrollment:v1: 存储兼容，不把它计作普通课节进度。
- 编辑、删除、重置及发布使用实体 expectedRev，陈旧版本返回 409 ENTITY_CHANGED，附标题、当前版本和实际差异；无关实体修改不拒绝。服务端 revision 和账户 seq 仅由服务端递增。可合并的答题和集合新增不要求账户 baseSeq。
- 设置按实际变更字段提交，防止陈旧整对象覆盖其他设置。多字段 destructive reset 应明确作用范围与相关 revision，不能抹去并发新答题。

### 浏览器与失败语义

- 新建一个小型 server-store 负责 bootstrap/submit/refresh/pending 状态；CL 作为现有页面适配入口，不增加第二套可写 store。迁完写入调用后，saveMem 只作为内部缓存落盘，禁止产品页面借它提交服务端修改。
- 操作先按账号写 IndexedDB pending，再发送；这是传输日志，不是第二份权威业务状态。一个页面串行发送，跨页重复发送依赖服务端去重。提交结果为 Promise；已写 pending 不能显示为“已保存”，只有服务端确认才能显示已保存。
- 发送失败保留相同操作，显示“尚未保存，重试”；暂停新修改，允许退出。刷新后先读取服务端，再重试当前账号 pending。401 暂停并要求恢复同账号；409 保留对应操作并提供结构化处理；不进入整账号二选一。
- pending 本地写入失败则不接受本次操作，不能显示答题已记录。退出不等待网络；页面刷新/关闭不能靠 sendBeacon 作为唯一保证。慢 IndexedDB 时不可虚报持久化成功，以现有题目保存先行减少退出路径工作。

### 迁移及旧客户端

- 新协议首次启动先识别旧缓存、BatchSync/outbox 状态。归档旧 namespace 和未提交内容，不直接发旧队列，不覆盖本地独有内容。
- 服务端已有数据且浏览器为空/仅相同缓存：直接读取服务端，不显示冲突。浏览器独有数据或有差异：进入一次性“发现旧学习数据”预览，可导出双方备份；逐课程/句子/字段显示新增、不同、删除，不只计数或 JSON。
- 新增迁移 preview/apply 接口；preview 绑定账号、服务端 seq 和来源 hash；apply 在事务中重新检查 token/seq，变化则重新预览。新增内容可明确导入，同键不同值要求选择，统计聚合不直接相加；已存在事件按稳定 ID 去重，无可靠 ID 的历史统计保留原件并要求明确选择，不猜测合并。
- apply 前用现有备份服务生成可恢复快照；成功才标记该来源已迁移。实际用户 apply 由用户在页面选择；自动测试使用临时数据。
- 新版服务运行时旧 PUT /api/data、旧 sync resolve 等能覆盖学习数据的入口拒绝旧协议写入（428），导出/读取仍可用。备份导入须升级受控 restore 合同，禁止绕过新写入策略。管理员内容工作台独立领域不改。
- 服务端新增表为增量 schema；不删旧表。旧客户端不能继续写，新客户端也不能回退批次上传。Service Worker 缓存升级同时处理，旧页面提示刷新。

## Implementation steps

- [ ] 1. 固定写入口清单与基线：检查 core.js 导出及 main.html、decks.html、stats.html、library.js、course-package.js、js/course-enrollment.js、api.js 的实际调用；在本文记录每个操作映射。复核现有学习算法与 src/core、src/main 纯函数，补现有答题结果固定样本以证明抽取不改变行为。
- [ ] 2. 实现服务端 operations：server/routes/operations.js、server/services/operations.js、db.js、index.js；复用 data-writers/data-rows/change-seq/data-snapshot，增加事务内去重与服务端 revision。学习函数必要时抽入共享纯模块并通过既有构建方式加载。保留实际课程/题库校验。
- [ ] 3. 实现迁移 preview/apply、备份及协议闸门：修改 server/routes/system.js、data.js、sync.js、backup.js，新增小型 migration 服务；给当前真实数据生成预览能力，不自动调用 apply。此阶段只在隔离测试实例启用新协议，避免半成品服务影响现有用户。
- [ ] 4. 实现浏览器 server-store、api.js 操作方法、js/idb.js pending 表升级；接入 AccountStorage。修改 core.js 启动及保存适配，取消新路径 ensureCloud 的双向恢复/快照比较。server-store 不依赖旧 BatchSync/outbox。
- [ ] 5. 接通全部实际写入口：练习/复习/轮次、课程包、加入课程、题库/课程编辑导入删除、设置、统计重置与备份；改掉写 localStorage 的业务回退。服务端 ACK 驱动最终显示，页面切换不触发全量保存。更新所有涉及的 HTML 依赖加载。
- [ ] 6. 迁移与失败 UI：改 js/sync-resolution-ui.js 等现有入口，区分旧数据迁移和实体修改冲突；显示实际名称/字段及数据来源。首页展示服务连接和未保存状态；移除正常路径“使用本机/使用云端”整账号选择。默认账号共享行为有简洁说明。
- [ ] 7. 切换并收尾：完成运行路径后再令正式 HTTP 默认协议 2；删除生产页面对旧同步队列/自动合并模块的依赖及无调用的分支，不为旧测试保留产品回退。旧备份解析可留迁移模块。更新 README、构建清单、sw.js 生成源、测试清单。不能仅将新系统叠加在旧同步之上。
- [ ] 8. 完成下面验收并记录结果；失败继续处理，全部通过才标记 complete。不扩展到旧规划中的无关事项。

## Validation

所有服务写测试使用临时 CHUNKLAB_DATA_DIR、独立端口与浏览器上下文，禁止当前 server/data 作为测试库。先记录基线失败；不以本轮未处理的既有失败冒充新代码通过。

- [ ] 新增 server/operations.test.js：重试、提交后响应丢失、ID 复用拒绝、事务中途失败、账号隔离、独立实体并发、同句连续答题不丢计数、reset 与新答题交错、删除不复活、设置字段并发。
- [ ] 新增 server/server-authority-migration.test.js：空本地/非空服务端、独有课程/历史统计、preview 过期、重复 apply、失败回滚、双方备份可恢复；旧协议无法写入。
- [ ] 新增 e2e/server-authoritative.test.js：从真实页面学习→退出→刷新→统计核对；服务端延迟/断开→提示未保存→暂停新答题→刷新→恢复一次提交；账号切换不能串数据；两标签页、陈旧缓存及旧 SW 客户端。
- [ ] 更新 e2e/exit-performance.test.js：本机正常服务连续退出至少 20 次记录 max/P95 均 <1000ms；人工延迟写接口 5 秒，已入 pending 的答题退出仍 <1000ms，恢复后数据库恰好一条。记录设备/样本，不能据此承诺任意设备无条件 <1 秒。
- [ ] 更新 e2e/course-enrollment.test.js、课程包、统计、账号、导入导出测试夹具至真实服务端接口；保留学习结果断言，不仅删除旧同步断言。
- [ ] node server/operations.test.js；node server/server-authority-migration.test.js；node e2e/server-authoritative.test.js；node e2e/exit-performance.test.js。
- [ ] npm run build；npm run build:check；npm run test:checks；npm run test:unit；npm run test:server；npm run test:browser。把新增文件接入 scripts/test-manifest.cjs，移除的旧协议测试由上述真实合同测试替代并在执行记录说明。
- [ ] 使用 computer use 在隔离实例实测首页、开始/继续、一次答题、退出、刷新、迁移差异及故障提示；不可用实际用户记录答题充当测试。

## Acceptance criteria

- [ ] HTTP 下唯一权威业务数据是 SQLite，正常学习不发送整账号快照，不依赖账户 baseSeq 做写冲突判定。
- [ ] 浏览器缓存为空且服务端有课程时直接显示课程，不弹空本地与非空服务端的整账号冲突。
- [ ] 所有实际用户写操作映射到新协议；不存在课程包/localStorage、旧 import 或 sync resolve 的旁路。
- [ ] 重试/刷新/两标签页不丢已接受操作、不重复计数；失联暂停新写，未确认记录明确可见且恢复可重试。
- [ ] 退出达到上述性能标准；服务端未确认时不显示“已保存”。
- [ ] 有意义的实体差异能看到名称及具体字段；旧独有数据不自动抹去，迁移预览及恢复测试通过。
- [ ] 账号隔离、学习规则、统计口径、课程加入状态保持兼容；旧客户端写入被明确阻止。
- [ ] 产品页面不再执行旧双向同步/整账号自动合并链；测试、文档和服务缓存升级与新模式一致。

## Risks and rollback

- 最大风险是遗漏写入口和答题规则迁移；入口清单与端到端数据库断言为完成门槛，不能只检查 UI。
- 不把“服务端权威”宣传为永不冲突：并发编辑同一课程仍需实体级保护；本轮消除无关修改引发的整账号冲突。
- 新协议写入后不能直接部署旧客户端继续同步。回滚时先停止写入，备份当前库及 pending，恢复匹配的代码和升级前数据库；升级后新增操作须另行导出/重放，不能承诺回滚到旧库且零数据损失。执行时在临时库做一次恢复演练。
- 本轮不清理历史备份，不实施真实数据选择。迁移 UI 交付后用户自行决定导入哪些差异。

## Execution notes

2026-09-27：执行已开始。执行前确认 HEAD 为 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22，master 分支；工作区存在计划记录的广泛既有修改，执行中逐文件保留。关键接口现状与计划相符：/api/data 仍走整批 baseSeq，批次回执有 256 条清理上限；新操作回执需长期幂等，不能复用该清理策略。

2026-09-27 执行进展：新增 user_operation_receipts（按用户与请求 ID 唯一，不复用旧批次回执的限量清理）；注册 POST /api/operations 并加入前端 API 方法。当前服务端实现并测试的窄操作有 learning.answer（复用 srs.js 更新句子档案、事件和已答计数；额外按 eventId 防止换 requestId 再次计数）、learning.roundComplete（服务端按客户端时区归档完成轮次）、course.progress（节点集合合并）、course.enrollment（兼容 enrollment:v1: 键）和 settings.patch（字段白名单 + 按字段原值校验并发）。HTTP 路由已连接至正式 server/index.js，但尚未宣告 writeProtocol 2，也未接通产品页面，故现有学习流程仍使用旧路径。学习标熟、重置、课程/题库编辑删除、pending outbox、迁移预览与旧协议闸门均未完成。

验证：在 server 目录运行 `node operations.test.js` 通过；测试覆盖事务幂等、相同 ID 不同内容拒绝、请求账号隔离、课程进度集合合并、课程加入键兼容、同一 settings 对象内不相交字段的并发更新、同字段冲突、答题 SRS 更新、requestId 变化时按 eventId 去重、事件编号复用保护、轮次及按日计数去重和实际 HTTP 路由响应。`npm run lint:operations` 与 `eslint srs.js server/index.js` 通过；`node --check` 对 service、route、server entry、api、srs 通过；`git diff --check` 对本轮相关文件通过。未运行现有运行服务、未触碰真实 SQLite 数据库。一次额外的 `npx eslint` 命令无输出并被中断；项目本地 ESLint 可执行文件的对应检查随后通过。

2026-09-27 执行进展：完成第 4 阶段中“耐久待提交队列/操作传输适配”的第一块基础设施：IndexedDB 升至 v6，新建账号隔离的 `pendingOperations` store；新增 `js/server-store.js`，操作先落队列、网络失败保留同一 requestId、仅服务端 ACK 后删除；遇到未确认请求会阻止继续新增操作；提供状态/重试 API，并从 CL 暴露操作入口。main/decks/stats 加载该适配器，Service Worker 预缓存与部署清单已更新。新增 Node 队列合同测试和真实浏览器 + 临时 SQLite 的集成测试；更新 v4→v6 数据库升级测试注释。

本次边界：页面业务写入口尚未切换到新协议，ServerStore 不会在启动时自动重放（仍需完成服务端权威 bootstrap，避免先回放后读快照）；服务端操作白名单不完整；旧数据迁移 preview/apply、故障状态 UI、旧协议闸门都未做。旧整份同步保持现状且未关闭，因此现在不会把半迁移状态暴露给用户。不得据此宣称已完成“接入实际页面”或该计划阶段。

本次验证：`node js/server-store.test.js`、`node server/operations.test.js`、目标文件 `eslint`、`node --check`、`node scripts/check-deploy-files.js`、`node scripts/check-sw.js`、`git diff --check` 通过；部署检查保留仓库已有的动态脚本引用告警（`' + escX(src) + '`），但运行时覆盖完整。新增真实浏览器集成测试 `node e2e/server-store-queue.test.js` 未能启动：当前环境缺少 Playwright 安装的 Chromium 可执行文件；测试使用临时数据库并会清理，不触碰正在运行的本机服务或真实数据。完整构建/回归尚未执行。
