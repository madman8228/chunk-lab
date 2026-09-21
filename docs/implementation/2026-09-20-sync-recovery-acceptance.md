# 下一阶段：补齐恢复链路，建立项目级同步的交付前提

- Status: complete
- Updated: 2026-09-20
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca；core.js、js/sync-resolution.js、js/sync-resolution-ui.js、server/sync-resolution.js、sw.js 已修改，e2e/sync-recovery.test.js 和诊断工具未跟踪。保留全部既有工作。
- Planner: Astra planning phase
- Executor: GPT-5.6 Luna

## Objective

完成上一轮未被实际验证的恢复契约：同账号多标签串行；丢回执刷新继续；本机新增修改不被吞；容量阻塞有真实可用的出口。交付一个可执行、可复现的恢复闭环，作为项目级协议改造的前提。

总体顺序：本计划补齐恢复 → 单独规划项目级条件写入和局部冲突 → 核实历史事件完整性后规划统计投影。后两项仅为路线，不是本计划的执行范围。

## Current state and evidence

- 上轮 npm test 报告 99/99 通过，但不能证明未覆盖的验收项。上一交接被标记 complete，验收条目曾被删减；以本文件列明的证据为准。
- js/sync-resolution.js 的 single 仅使用页面内 active Promise，没有 navigator.locks；并非跨标签锁。
- core.js syncFromCloud 调用 restorePause 后直接因 _resolutionPaused 返回，已有自动恢复 journal 不会在刷新时自动继续。
- execute 保存了 receipt，却每次重试仍 POST；saveFailure 将已有回执的普通应用错误重新标成 awaiting-receipt。
- applySyncBatchResolution 先比较整个 original（含页面代次），远端选择会分别写 mem、courses、progress；中途失败可能导致下次不再等于 original。adoptConfirmedBatchSnapshot 在 finishResolution 之前清理本地标记，失败时存在部分确认问题。
- blocked-local-change 的“重新查看”仍返回旧 journal 的 preview，不能让用户处理最新差异；不能宣称重新查看可解除。
- e2e/sync-recovery.test.js 仅测试相同内容成功路径；其中 b.evaluate 回调引用 Node 侧 result 却未传参，需消除全局变量碰巧同名的可能。waitForFunction 的 options 放在第二参数，实际应放第三参数。
- 归档容量工具已实现，但自动操作常复用 UUID 普通请求号，按 auto-reconcile 前缀分类不能代表全部自动操作；诊断应标注历史模式不可判定。

## Assumptions and decisions

- 保留整账号条件写入，不移除 baseSeq；本轮不引入项目级新协议，不合并不同业务内容。
- 新增答题与处理中账号切换属于正常情况，必须保留数据并给出可解释状态。
- 自动重试每次启动最多一次；容量不足和本机有新修改不自动提交。
- 使用已存回执恢复本机；不重新选择本机/云端，不变更既有 request 内容。
- 改动仅发生于隔离测试账号。真实归档数量仍待显式账号定位，不能按第一个数据库用户猜测。

## Scope

js/sync-resolution.js、js/batch-sync.js、core.js 的恢复相关入口、js/sync-resolution-ui.js、e2e/sync-recovery.test.js、必要的存储接口、server/sync-diagnostics.js 的分类说明和测试，以及 sw.js 生成产物。

## Out of scope

按项目同步协议、事件统计重建、SRS 修改、归档删除/扩容、真实账号数据取舍、部署、泛化重构。不要把既有 99 项测试全绿作为本计划完成依据。

## Contracts and data changes

### 恢复状态及身份

- journal 新增 schemaVersion、operationId、linkedPendingId、ownerScope、phase 和 receipt；旧 mode 缺失视作 manual，不丢弃未知版本记录。
- operationId 是恢复请求身份，linkedPendingId 是普通批次身份；旧记录允许二者相同。finishResolution 以显式 linkedPendingId 验证，不允许省略编号清理任意 pending。
- prepared/awaiting-receipt 可重发同请求；有 receipt 则只继续本机应用；blocked-capacity 仅人工重试；blocked-local-change 保持最新本机数据，不反复发送旧选择。
- 服务端明确 RESOLUTION_STALE 才允许撤销未提交预览；网络错误不是未提交证明。

### 锁与启动

- 恢复操作采用 navigator.locks，锁名由 API base 与账号组成；锁内重新读取 journal，不能依赖加锁前读到的记录。
- 锁顺序固定为恢复锁 → 普通批次锁；普通批次代码不得反向申请恢复锁。waitForSync 在持有可能导致循环等待的锁之前完成。补测试证明无死锁。
- core.syncFromCloud 最外层接入 resumeOnStartup：先检查 journal，自动且可恢复状态尝试一次，阻塞状态直接展示，不进入普通发送。人工未确认选择不自动生成新选择。

### 本机应用与失败

- 将检查、数据写入、基线确认分阶段记录；每一步只能在原账号执行，落盘失败保留原始快照和 receipt。
- 同一已确认结果可以重复激活；original 比较必须区分刷新导致的运行元数据变化和业务内容变化，不能忽略真实统计/删除字段。
- 优先使用现有账号 IDB 的事务边界保存数据与应用标记，再更新内存/localStorage 投影；先检查 IDB 接口，若现有跨存储边界不能原子完成，采用持久分阶段记录，每个阶段比较“原值或本次目标值”，不以覆盖新数据来完成恢复。
- 最后确认时再核对持久本地代次/对应 pending。只有全部步骤成功才清 journal、清 conflict、标 clean；新修改保留 dirty。
- 本机有新业务修改时不实现自动三方合并。本阶段明确显示“云端已确认旧请求，本机新修改仍待处理”，允许下载 original、receipt、current 三份备份；旧记录保留且普通同步暂停，不显示无效的“重新查看即可解决”。最终取舍属于后续显式操作，不伪装完成。

## Implementation steps

- [x] 1. 先为当前缺口添加复现用例，记录失败点。修复专项测试跨执行环境 result 引用和 options 参数位置；不用固定睡眠替代完成条件。
- [x] 2. 在 SyncResolution.single 及创建/重试入口加入账号服务域跨标签锁；锁内判断持久 journal、mode 和阶段；不允许第二标签覆盖第一个记录。
- [x] 3. 新增 resumeOnStartup，并接入 core.syncFromCloud。自动 pending 丢回执刷新使用同一编号恢复；blocked 状态不循环请求，旧人工 journal 可显式继续。
- [x] 4. execute 优先使用持久 receipt，保存 applying 阶段；重构 applySyncBatchResolution 的分阶段幂等激活与精确 pending 确认，检查并保留在途新增修改。不得提前清内存标记或把最新代次整体确认。
- [x] 5. UI 按状态提供正确动作：容量不足可下载、检查、显式重试，并注明下载不释放服务端容量；本机变化展示待处理状态及三份备份；已确认待激活只继续本机恢复。
- [x] 6. 诊断前缀分类改为“已知自动前缀/其他历史来源未知”，不将所有 UUID 归成人工操作。保留只读契约。
- [x] 7. 补齐下列浏览器故障注入，完成后运行指定验证、生成 sw、记录每项证据。任何验收未完成保持 in-progress，禁止删减条目后标完成。

## Validation

- [x] node e2e/sync-recovery.test.js：同一 browser context 两标签测试共享存储；两 context 测试独立设备，不能互相代替。
- [x] 服务端已提交而响应丢失后真正 page.reload；直接查询临时数据库确认归档只增加一条、requestId 不变、最后 clean。
- [x] 同账号双标签同时触发恢复，记录 HTTP 次数、归档数量、pending；不得仅 assert 页面文字。
- [x] 已注入 mem、courses、progress 落盘失败及基线确认失败并重载，验证已提交回执只激活、不重复 POST；四类场景均保留 applying receipt，刷新后复用同一回执完成且 resolve POST 次数保持 1。
- [x] 在 resolve HTTP 期间新增答题；验证本机事件 ID、journal 阻塞状态和 pending 保留。
- [x] 请求期间切换账号，旧回执不进入新账号；切回旧账号仍可看到 journal。
- [x] 服务端容量满返回 507 后刷新两次，没有新恢复 POST；显式重试才允许 POST，归档和业务数据不变。
- [x] 自动确认唯一业务比较函数已抽出并专项验证：取消 mastered、增加 deletedItems 均判定为业务差异，不进入自动确认；仅 generation/revs 元数据变化仍判定为相同业务内容。旧人工 S7/S8/S9 继续通过。
- [x] node e2e/sync.test.js；node e2e/batch-sync.test.js；node e2e/account-isolation.test.js；node e2e/main-startup.test.js
- [x] node server/sync-diagnostics.test.js；node server/sync-resolution.test.js
- [x] node scripts/gen-sw.js；node scripts/check-sw.js；git diff --check（仅有既有 LF/CRLF 提示）
- [x] 严格验收：`TEST_RETRIES=0 npm test` 串行通过 100/100，runId=`20260920052306078-29148`，所有 attempt 均为首次通过、无 flaky、无最终失败。默认运行器仍保留 browser 组单次重试与完整 attempt 留痕；本条不宣称并行稳定性。

## Acceptance criteria

- [x] 上述跨标签、丢回执刷新、容量刷新、账号切换、在途答题和局部落盘失败都有直接证据。
- [x] Runtime entry point connected：启动调用可恢复状态机，非仅直接调用测试辅助函数。
- [x] 原始数据、在途新增记录及服务端回执均可追溯，不出现“清 pending 后仍失败”的半确认。
- [x] UI 不承诺尚未实现的解除路径；阻塞仍存在时明确报告而非显示同步完成。
- [x] 真实用户数据及归档未修改；计划状态仅在全部验收通过后 complete。

## Risks and rollback

多存储激活和多标签锁是主要风险。新 journal 字段需兼容旧格式；回滚必须保留处理中记录，不允许清库解决。避免锁内等待自身同步 Promise。因真实数据不同而阻塞属于保守行为，不能放宽比较条件让测试通过。发现存储契约需重大变更则记录具体矛盾并标 needs-planning，不暗中扩大为全套同步重写。

## Evidence correction

本文件早期执行记录中的“并行资源/清理稳定性”“连续两轮 99/99”表述已被本轮验收更正：`scripts/run-tests.cjs` 实际按 manifest 串行调度；最终严格 `TEST_RETRIES=0 npm test` 按实际 manifest 通过 100/100，runId=`20260920052306078-29148`。默认 browser 重试、首次输出和 attempt 留痕另有专项契约测试，不将重试结果表述为并行稳定性。

## Execution notes

已进入执行阶段。保留既有脏工作树和第一阶段文档；本轮已完成状态机、跨标签锁、刷新续接、回执幂等激活、UI 阻塞出口和诊断分类。专项测试已加入两独立设备 context、同 context 双标签、真实 reload 和 SQLite 归档计数。

`node e2e/sync-recovery.test.js`、`node e2e/sync.test.js`、`node e2e/batch-sync.test.js`、`node e2e/account-isolation.test.js`、`node e2e/main-startup.test.js`、`node server/sync-diagnostics.test.js`、`node server/sync-resolution.test.js` 均通过。新增专项直接验证了 resolve HTTP 期间答题、本机 stats 落盘失败后刷新复用回执、账号切换隔离；测试运行器现对浏览器组首次失败自动重跑一次、记录 flaky，并在超时时清理完整进程树。最终严格 `TEST_RETRIES=0 npm test` 通过 100/100，完整结果与每次 attempt 保存在 `output/test-results/20260920052306078-29148/`。

第 7 项专项已补齐：容量 507、在途新增答题、账号切换隔离、mem/courses/progress 落盘失败和基线确认失败均有故障注入证据；每种已提交回执都在刷新后复用，未重复 POST。自动确认的业务比较已集中为 `CL.sameBatchBusiness`，直接覆盖取消掌握、删除条目与元数据-only 三种判定。另修正了批次启动测试的基线等待方式：启动后显式完成一次 syncFromCloud，再等待已确认 baseline，避免把 needs-reconcile 当成可提交基线。专项 `sync-recovery` 通过；`main-startup`、`stats-back`、`stats-index`、`stats-mastered`、`sync-delta`、`sync.test` 逐项重跑均通过（其中 `sync.test` 27/27、`sync-delta` 35/35）。测试运行器的并行资源/清理稳定性已治理并验证：连续两轮全量均为 99/99；首次失败后重跑通过的项目均保留 flaky 记录。

后续项目级同步规划的必要输入：恢复验收证据、实体 baseRev 与删除墓碑契约、学习 stats/events 无行版本的处理策略、旧客户端协议兼容和服务端回执保留期限。项目级同步必须单独制定完整计划，不能仅取消账号 baseSeq 检查；事件统计重建继续独立为第三阶段。
