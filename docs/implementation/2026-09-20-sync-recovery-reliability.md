# 同步恢复可靠性与归档诊断：第一阶段交付

- Status: complete
- Updated: 2026-09-20
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca。当前工作树大量未提交；core.js、api.js、main.html、server/db.js、server/index.js、e2e/sync.test.js 已修改，server/services、server/routes、src、部分测试与构建脚本未跟踪。以上均作为既有工作保留，不重置、不覆盖。
- Planner: Astra planning phase（不据此断言界面当前选中的模型）
- Executor: GPT-5.6 Luna

## Objective

交付一条实际接入启动同步的、可持久恢复的冲突处理链路：网络重试/刷新不会反复创建新恢复请求及归档；容量不足时明确暂停；提供只读诊断以验证归档增长原因。保留现有本机离线能力及服务端条件写入保护。

这是整体优化的第一阶段，不承诺本阶段消除所有业务冲突。后续阶段是按项目冲突处理，再是答题事件驱动的统计统一；不得在本交付中顺带切换这两类协议。

## Current state and evidence

- 未发现仓库及 D:/、D:/06-project 的 AGENTS.md；执行前再次检查新增指令。
- server/services/data-save.js 在事务内调用 assertBatchVersion；server/sync-conflict.js 按账号 baseSeq 拒绝过期批次。因此不同项目的并发写入也可能产生账号冲突。
- core.js: autoRecoverBatchConflict 每次生成新 auto-reconcile 请求编号，直接调用 resolveSyncBatch；没有使用 js/sync-resolution.js 的持久 journal。函数中“下一次同编号恢复”的注释与实现不符。
- js/sync-resolution.js 已有按服务地址及账号隔离的 IndexedDB journal，人工处理支持先持久化、再发请求、回执重试。应复用而非另建第三套队列。
- core.js: applySyncBatchResolution 对 choice=local 默认本机已经是选中数据；自动合并不能直接复用这个假设，因为本机 original 与提交的 merged 不同。
- core.js: mergeBatchSnapshots 部分集合取并集、同 rev 偏本机；没有证明所有删除/取消操作可安全自动合并。名称中的“安全”不是验收证据。
- server/sync-resolution.js 共用 user_sync_resolutions，达到 100 条或备份内容超过 64MiB 时拒绝；同 requestId+请求指纹返回已有回执，事务确保备份与替换一并提交。
- 之前浏览器曾返回容量满；本轮未读取真实数据库，实际条数、字节数、增长原因仍待诊断，不能标成已查明。
- scripts/run-tests.cjs 按项 await，非并发执行；两次全量各 95/96，失败分别为 stats-idb 事件写入与课程导入等待，单独复跑通过。不能宣称环境抖动或无业务回归。

## Assumptions and decisions

- 本机与云端双副本保留；保留现有账号版本检查，不能靠去掉 baseSeq 检查消除报错。
- 第一阶段优先保证可恢复、可解释；不能证明可合并的差异进入现有人工比较入口。
- 不以答题总次数大小决定保留哪一端。
- 自动处理采用保守条件：双方学习数据/课程/设置内容相同（排除 seq、revs、generation、运行版本等协议元数据），才允许自动确认/恢复。不同内容暂交人工处理；后续按领域合并另行规划。这样不继续依赖未经证明的集合合并。
- 不清理真实归档、不选择真实账号版本、不改变学习统计口径；真实数据处理应在只读报告之后单独授权。

## Scope

core.js 自动恢复入口；js/sync-resolution.js 恢复 journal；js/batch-sync.js 必要的精确 pending 确认；server/sync-resolution.js 错误契约；js/sync-resolution-ui.js 状态文案；诊断 CLI 与对应测试；SW 构建产物。

## Out of scope

整账号协议替换、CRDT、事件重放/SRS 重算、覆盖率改写、数据库归档删除/扩容、生产部署、真实账号数据覆盖、全项目测试稳定性改造。

## Contracts and data changes

- 扩展现有 journal record，保留旧记录兼容：mode=manual|auto、original 本机快照、request 固定请求内容、关联普通 pending 请求编号、state、lastError。新增字段缺失视作旧人工记录。
- 同一逻辑恢复操作在发送前持久化唯一 requestId 与请求；响应丢失、刷新、重复点击必须复用，不生成新编号。
- 状态：prepared → awaiting-receipt → applying → complete；网络不确定保持原记录；容量错误置 blocked-capacity；LOCAL_CHANGED 置 blocked-local-change。这些阻塞不自动轮询提交。
- RESOLUTION_STALE 是明确未提交，可退出旧预览并要求重新比较；服务器成功但本地应用失败必须保留回执关联，不能当作从未提交。
- 账号切换后不得应用上一账号结果；恢复锁以账号和服务地址隔离，多标签页串行，避免与普通同步锁相互等待。
- 本地有新修改时，不覆盖、不清空 pending、不标记 clean。先返回明确阻塞状态并保留两份数据；本阶段不实现通用三方合并。
- 服务端保持原端点和请求指纹幂等语义。容量拒绝增加稳定 code=RESOLUTION_ARCHIVE_FULL；无数据库 schema 强制迁移。
- 诊断 CLI 显式 --db 和 --user-id，只读连接；输出归档条数、backup_json 字节、剩余额度、日期分布、auto-reconcile/manual 数量、重复快照指纹数量。不输出快照、账号凭据或学习原文。区分“相同内容重复归档”与“已证明原因”；只查不足以证明循环。

## Implementation steps

- [x] 1. 新建 server/sync-diagnostics.js 与 server/sync-diagnostics.test.js，提供上述只读诊断。用临时数据库验证 100 条/64MiB 两类边界；诊断只输出元数据和哈希，不输出快照内容。
- [x] 2. 在 js/sync-resolution.js 为自动入口提供与人工入口共用的恢复执行方法；发送之前 journal 持久化，使用账号级跨标签锁。保留人工 resolve/retry/preview API 行为与旧 journal 兼容。
- [x] 3. core.js 的 autoRecoverBatchConflict 改为只在同步业务内容完全一致时自动确认。不同内容保留冲突；不再使用未经证明的整账号并集合并作为启动自动覆盖。
- [x] 4. 明确 original、提交快照、返回快照三个角色。普通待发请求的 requestId 被自动恢复复用；只有对应回执完成本机激活后才清理 pending。新增本地修改、网络错误、容量不足均保留 journal 状态。
- [x] 5. server/sync-resolution.js 返回稳定容量错误码；UI 区分容量不足、处理中和本机新增修改。容量错误不会在启动时生成新请求。
- [x] 6. 实现专项真实浏览器测试 e2e/sync-recovery.test.js，并由 scripts/test-manifest.cjs 自动纳入测试发现；使用独立临时库，未操作用户 8787 账号。
- [x] 7. 完成专项与全量验证，刷新 sw.js 并通过 service worker 校验，未重置无关工作树修改。

## Validation

- [x] node server/sync-diagnostics.test.js；node server/sync-resolution.test.js
- [x] node server/batch-version.test.js；node server/conditional-required.test.js
- [x] node e2e/batch-sync.test.js；node e2e/sync.test.js；node e2e/sync-recovery.test.js
- [x] node e2e/main-startup.test.js；node e2e/progress-coverage.test.js
- [x] node scripts/gen-sw.js；node scripts/check-sw.js
- [x] npm test：99/99 通过
- [x] npm run lint；npm run typecheck；git diff --check

## Acceptance criteria

- [x] 自动恢复接入真实 syncFromCloud 调用链；相同业务内容可恢复，不同内容不会被整账号并集合并静默覆盖。
- [x] 服务端提交后丢失响应，刷新再试会复用同一 requestId；原 S9 回归通过。
- [x] 普通待发请求与自动恢复关联；完成后只清理对应 pending。
- [x] 100 条/64MiB 容量测试：拒绝后数据和归档均无改变，返回 RESOLUTION_ARCHIVE_FULL。
- [x] 删除/取消掌握等双方差异继续进入人工比较；原 S2b/S3/S4 回归通过。
- [x] 旧人工恢复记录仍能继续，原 S7/S8/S9 选择与回执测试通过。
- [x] 只读诊断不改变数据库；报告只提供确定的归档元数据，并标明原因未被证明的边界。
- [x] 未操作真实账号，未选择本机/云端、清理归档或重写统计。

## Risks and rollback

- 保守门控会增加真实冲突的人工处理，这是阶段性取舍；不能宣传为最终低冲突方案。
- 本地多存储写入可能部分完成；journal 必须保留可识别阶段及原始比较依据，不能仅设置内存标志。失败要可恢复且不丢后续写入。
- 不自动升级/删除旧 journal。回滚代码前先确认无处理中记录；保留旧客户端可读字段，未知 mode 应阻塞并提示升级，不能删除。
- 本次不改服务端版本保护与统计 schema，回滚范围限新增恢复编排及错误展示；禁止 git reset --hard。

## Execution notes

2026-09-20：完成第一阶段。主要变更位于 core.js、js/sync-resolution.js、js/sync-resolution-ui.js、server/sync-resolution.js；新增 server/sync-diagnostics.js、server/sync-diagnostics.test.js、server/sync-resolution.test.js、e2e/sync-recovery.test.js。全量 npm test 99/99、lint、typecheck、service worker 校验通过。

剩余风险：真实账号的历史归档数量和增长原因尚未读取，因为本阶段只实现诊断、不直接操作真实账号；需要管理员使用显式数据库路径和账号 ID 运行诊断。不同业务内容仍需人工选择。第二阶段另行规划按项目条件写入和删除语义；第三阶段核实事件完整性后设计统计投影与历史迁移，不能假设现有 events 覆盖所有历史答题。
