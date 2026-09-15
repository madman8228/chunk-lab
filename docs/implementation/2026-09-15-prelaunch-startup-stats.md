# 上线前启动竞态与统计口径修复

- Status: complete
- Updated: 2026-09-15
- Branch/worktree: codex/pre-release-thematic-commits / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: 0447b01099e83e2fd94199e1f104879ee7c7ab8b；core.js、main.html、stats.html、sw.js、package.json 及现有 e2e 测试有未提交改动，另有未跟踪的启动、退出、统计稳定性测试与 output/e2e 调试产物。均保留，不做整文件回滚或清理。
- Planner: Astra planning phase（未从环境核实主任务具体型号）
- Executor: GPT-5.6 Luna

## Objective

完成三项有界修复：后台启动不打断已开始的练习；统计同步等待有上限；本月答题只计本月事件。接通真实页面并验证后结束，不部署。

## Current state and evidence

- 未发现仓库及已检查上级目录的 AGENTS.md。发布规则入口为 RELEASE_CHECKLIST.md；其历史完成声明不替代当前验证。
- main.html:5500 附近 paintLocalHome 提前绘制可操作首页；随后 Promise.all 调用 bootApp/bootMain，后者 loadStore、点击 cats 首项、decideEntry，普通 URL 最终调用 showHomePage。用户先开始课程时存在被重置的路径。
- stats.html:417 的 _statsInitialSync 在同步和索引全部完成前阻断全部数据渲染；api.js request 和 content-repository.js fetch 没有请求超时。请求悬挂不触发 catch，本地 180ms 绘制也只能显示同步提示。
- stats.html:402 monthActivitySummary 筛选本月天数和轮次，却把 CL.answerStatsAudit 的全历史 totalAnswered 返回给“本月答题”。
- 现有 e2e/main-startup.test.js 仅验证慢配置请求时首页出现，未点击开始并等待后台启动；stats-due-stability.test.js 验证 700ms 配置和数据延迟时本地 24 不先显示、最终 38；stats-back.test.js 验证同步期间返回可用。
- 上轮缓存/部署文件覆盖校验通过；8787 本地服务连接被拒绝，三项未完成现场运行复现。执行时用独立临时数据目录和空闲端口，不依赖用户服务或真实存档。
- 旧交接 2026-09-12-prelaunch-data-safety.md 是历史发布收口，非本次执行入口，不重做其已完成工作。

## Assumptions and decisions

1. 后台初始化只能完成一次；用户已作出的导航决定优先于默认入口。用显式启动前用户交互标记，不能仅凭 S.deck 或当前页面可见性判断，因为课程还可能正在异步加载、已退出或已结算。
2. 首次统计等待预算为 3000ms，自启动同步开始计时。预算内保持无旧数字的加载态；预算耗尽后展示当前账号可用本地记录，并用简短“本地记录 · 同步中”状态说明来源。后续同步成功允许更新数字并去掉状态。这个超时后有来源说明的变化是预期行为，不承诺数字永不变化。
3. 超时只结束页面等待，不取消底层同步、不把待同步写入当作成功，不改全局 API 超时或鉴权合同。登录取消、索引/网络悬挂也不能让本页永久只剩加载状态。
4. 本月以浏览器本地时区的 CL.ymd 日期键确定。历史无日期记录不分配到本月；累计答题仍使用 answerStatsAudit。

## Scope

main.html 启动及早期交互；stats.html 初始化、同步状态和月度汇总；相关 e2e 测试、package.json（仅新增测试入口确有需要时）、生成的 sw.js。

## Out of scope

不改服务器、同步合并算法、账号隔离、SRS、历史存档，不做 UI 重设计，不处理其它历史评审建议，不提交、推送或部署。生产配置、恢复演练、真机验收与发布授权仍按 RELEASE_CHECKLIST.md 独立验收。

## Contracts and data changes

- 无持久字段、数据迁移或存储键变化；启动标记和统计加载状态均为页面内存。
- main 的用户入口标记应在开始课程的异步加载前设置。外部 _startDeck、pending review、direct=1 仍由首次入口决策各消费一次；没有用户交互时保持现有入口优先级。
- 已有练习或用户已导航时，bootMain 不得重载页面 mem、触发分类首项 click、重置 S、清候选或再次 decideEntry。将可安全执行的一次性初始化与入口决策分开；需要刷新数据时沿用 __chunklabExternalPending 的保守路径，回到首页的安全时机再 loadStore，不推进写入基线。核对 bootMain 的迁移/回填职责，把需要改 mem 的动作留在首次练习前或安全点执行，不因跳过入口而丢失必要初始化。
- stats 状态至少区分等待、显示本地、完成；单一入口管理状态和计时器。超时后不能被迟到的本地 preload 再改回等待。同步完成必须重新 loadMem，然后刷新 _statsDecks 和渲染；不能使用等待前缓存的 24 条。
- 本地 fallback 使用当前账号 CL.loadMem 和已有 _statsDecks/CL.allDecksView；不要等待网络索引才能展示概览。本地索引不完整时不制造“已同步”结论。遵守 AccountStorage 的账号作用域，不从旧账号原始 localStorage 自行取数据。
- 同步或索引异常时保留本地概览并标“本地记录”；取消加载计时器。超时后同步仍在进行，完成后自动刷新；不增加自动写入。
- monthActivitySummary 返回明确的本月 answered 字段（或等价清晰命名），对本月 activity[key].answered 求和；全历史 undated 不放在“本月”摘要里。累计卡片不变。

## Implementation steps

- [x] 先补有行为意义的失败复现：延迟云配置，在提前首页通过真实按钮开始课程，后台恢复后练习仍在；跨月 fixture 验证月度与累计分离；长于 3 秒的配置/索引请求验证本地降级。复现使用隔离浏览器和临时测试服务器。
- [x] main.html：检查 startDeck 的异步分片与 hydrate 分支，以及首页开始/到期/错题入口；在用户意图发生时锁定入口决定。拆分 bootMain 初始化与入口操作，避免后到启动覆盖练习及用户退出后的状态。保留既有加载代次保护。
- [x] stats.html：实现 3 秒等待预算和本地来源状态；将 180ms preload、云端完成、索引完成、异常与超时统一收口。统计 tab 与返回全程可用。晚到成功更新数据并清理来源提示；失败不抹数据。
- [x] stats.html：本月天数、轮次、答题均由同一日期范围计算；删除本月区域的全历史无日期计数，累计卡保留原口径。
- [x] 扩展 e2e/main-startup.test.js、e2e/stats-due-stability.test.js 与 e2e/stats-index.test.js，按下面验收场景补测试。保留已有小延迟稳定性和返回测试。必要时调整 e2e/e2e.js 的月度断言以验证正确语义，不能只放宽数字条件。
- [x] 生成 sw.js 并完成规定验证，将证据写到 Execution notes。只更新本交接状态和完成项，不追加泛化重构。

## Validation

所有测试使用独立临时数据库；禁止对用户当前会话清存储或生成答题记录。长延迟用可释放的路由 gate，finally 关闭测试资源。先确认新增回归在旧代码上失败，再验证修复。

- [x] node e2e/main-startup.test.js
- [x] node e2e/stats-due-stability.test.js
- [x] node e2e/stats-back.test.js
- [x] node e2e/stats-index.test.js
- [x] node e2e/exit-clears-choices.test.js
- [x] node stats-consistency.test.js
- [x] node scripts/gen-sw.js，然后 node scripts/check-sw.js（产品代码最终修改后执行）
- [x] node e2e/e2e.js
- [x] npm test（最终候选一次；失败修复后重跑相关失败与必要检查）
- [x] git diff --check；确认未引入测试调试日志及用户数据变化。

## Acceptance criteria

- [x] 慢启动期间真实点击首页课程入口，至少完成一个 chunk；释放后台请求后页面、课程、题号、已选内容均保持，答题记录不重复、不减少。
- [x] 课程异步加载尚未完成时后台启动返回也不切走；用户主动退出后后台不重新拉起课程。普通首页和 _startDeck/direct/pending review 正常启动一次。
- [x] 配置或索引请求超过 3 秒，统计页显示可用本地概览及来源状态，四个 tab 和返回可操作；不能依赖请求 reject 才恢复。
- [x] 正常短延迟的本地 24/远端 38 场景仍先显示加载态，随后显示 38；超时场景先显示带来源提示的 24，释放同步后自动变成 38 并清除提示。
- [x] 网络直接失败、本地空档案均可用；没有残留计时器把已经完成的数据变回加载态。
- [x] 上月 100 次、本月 2 次显示本月 2、累计 102；补充无日期历史记录后本月仍为 2。覆盖月初/跨年边界；本月天数和轮次仍准确。
- [x] 修复接入实际 HTML 入口，不能仅通过单独辅助函数测试宣告完成；原返回、退出及统计索引回归仍通过。

## Risks and rollback

- 最大风险是早期练习 mem 被后到云端初始化替换：验证需包含真实答题和持久记录，不能只检查页面可见性。
- 本地模式数字与云端最终值可能不同；来源提示用于解释超时降级，不把本地数包装为最终数。
- 如发现账号切换与启动合同存在冲突，记录具体复现与需要决策的范围，将状态设为 needs-planning；不要改全局账号或同步算法。
- 回滚只撤销本次增量改动并重新生成缓存，保留现有未提交修改，无存储回滚或历史数据改写。
- 代码验收完成不代表生产放行；发布清单中的外部验收证据仍需另行确认。

## Execution notes

Luna 执行完成。按“先红灯复现、再修复、最后全量验证”完成本交接；未部署。

- `main.html` 增加用户入口锁定：用户点击课程、待复习或错题入口后，后台初始化不会重载 mem、清候选或把练习切回首页；慢配置场景真实点击并完成一个 chunk 的回归通过。
- `stats.html` 增加 3000ms 等待预算和“本地记录 · 正在同步，完成后自动更新”来源状态；超时先展示本地数据，迟到同步成功后刷新远端数据并隐藏状态。
- `stats.html` 的本月答题改为汇总本月有日期 activity 的 `answered`；累计答题仍使用全历史审计值，跨月 fixture 验证为本月 2、累计 102。
- 旧实现的三个关键回归均先失败：慢启动被覆盖、统计悬挂无法恢复、月度答题误用累计值；修复后对应测试全部通过。
- 专项验证：`main-startup`、`stats-due-stability`、`stats-back`、`stats-index`、`exit-clears-choices`、`stats-consistency` 全部通过；`stats-consistency` 为 9 passed / 0 failed。
- 主流程 `node e2e/e2e.js`：149 passed / 0 failed。
- `npm test`：退出码 0；服务端、同步、备份、压缩、反馈等全套测试通过。
- `node scripts/gen-sw.js` 生成 `CACHE = chunklab-31898f82`；随后 `node scripts/check-sw.js` 通过。
- `git diff --check` 通过；未发现 `[DEBUG-...]` 调试日志，也未对用户当前会话或存档写入测试数据。Git 输出的 LF/CRLF 提示仅为工作区换行规范提醒。
- 生产配置、恢复演练、真机验收、旧页面升级/关闭操作和发布授权仍属于 `RELEASE_CHECKLIST.md` 的独立放行门槛，本次没有部署或代为放行。
