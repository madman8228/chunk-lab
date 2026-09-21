# 补齐验收证据与同步竞态诊断

- Status: complete
- Updated: 2026-09-20
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca。工作区包含 main.html、core.js、同步、课程包、服务端及内容生成物的大量既有修改；scripts/run-tests.cjs、相关测试、CI 和实施文档多为未跟踪文件。保留当前文件，不从 HEAD 重建。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

修正上一轮过早完成的验收结论，交付可复现的同步回归、可靠的超时清理、桌面/手机学习流程证据，以及能关联实际代码的测试记录。完成边界为本文件全部验收；不扩展为全项目重构或发布。

## Current state and evidence

- 根目录及 D:/06-project、D:/ 未发现 AGENTS.md；执行前再检查目标目录内的适用指令。
- 严格运行 20260920051133629-7044 有 account-set-credentials、sync-recovery、run-tests 三项失败；20260920052306078-29148 为上一轮 100/100 基线。本轮 Windows 严格零重试运行 `20260920062725593-18824` 为 101/101，且 `worktreeChanged=false`、无 flaky。
- 上轮 sync-recovery 的临时修改最终撤回，失败分别涉及丢回执启动恢复和第 368 行 parallel-local 准备；本轮保留同一夹具并完成受控复现。
- 已确认测试启动竞态：`e2e/sync-recovery.test.js` 的 boot 原先只等 `CL.waitForSync()`，它不覆盖 `ensureCloud()` 的 `_cloudStartupPromise`；账号专项的 `CL.preload()` 也可能在启动会话尚未 settle 时继续。修复为显式 `ensureCloud()` 完成后再等待 `waitForSync()`，不改变产品同步协议。
- `SYNC_TRACE=1 node e2e/sync-recovery.test.js` 已输出并验证脱敏有序轨迹：`runtime-ready → ensureCloud:start → ensureCloud:done → waitForSync:start → waitForSync:done`；该轨迹在丢回执重载、并行标签、容量阻塞和账号切换场景均成立。
- `scripts/run-tests.cjs` 现已在 POSIX 使用 detached 进程组并按负 PID 清理，Windows 使用 taskkill 进程树；每次 attempt 即时落盘，summary 带时间、平台、Node、重试配置、manifest/工作区指纹并做常见认证字段脱敏。
- `run-tests.test.js` 现覆盖 pass/fail/timeout、父子进程树、spawn error、持续失败、默认 retry、零 retry 与脱敏；Windows 运行器专项三次串行通过，WSL Ubuntu unit 组 34/34（含 POSIX 进程组夹具）通过。
- 新增 `e2e/mobile-learning-explanation.test.js` 覆盖 390×844 的真实答题、长详解内部滚动、顶部/底部截图、关闭和下一题；原有 `learning-journey` 保留 1440×900 换课证据。
- 原 closeout 标 complete，手机详解及清理验收已勾选；report 写“不再存在未定位的必需失败”，超出了证据。

## Assumptions and decisions

1. 先保留失败日志并建立确定的复现，再按证据选择修测试或修产品。不可把偶尔通过当作修复，也不可放宽冲突保护换取通过。
2. 分清页面启动完成、当前队列清空、持久基线已确认三个条件；不全局把 waitForSync 改成等待 ensureCloud，以免启动恢复反向等待自身造成死锁。
3. 同账号多标签共用一个 context；不同设备使用独立 context。准备冲突必须保留独立设备，不能改为同 context 写入来消除失败。
4. 学习流程采用隔离服务、临时数据库和测试账号；不操作当前 8787 用户数据。Playwright 控制实际浏览器并输出截图；不声称运行了 computer use 或真实手机。
5. 本轮只修已证实的启动/恢复次序问题。若必须改变数据合并、请求身份或持久协议，记录矛盾并设 needs-planning。

## Scope

- scripts/run-tests.cjs、scripts/run-tests.test.js、必要的小型测试 helper、.github/workflows/ci.yml。
- e2e/sync-recovery.test.js、e2e/account-set-credentials.test.js，以及必要的 core.js 启动入口、js/sync-resolution.js 局部修复。
- e2e/learning-journey.test.js、e2e/content-explanation-refresh.test.js；可新增聚焦手机流程测试，复用现有 main-startup、progress-coverage、stats-back。
- 仅在布局问题复现时修改 main.html 对应布局；产品资源改变时更新 sw.js。
- 上轮 closeout、acceptance-report、release-readiness、sync-recovery-acceptance 文档及 output 下证据。

## Out of scope

实体同步协议迁移、SRS 算法、统计重建、批量讲解编写、全仓模块拆分、课程生成器集成实现、生产数据取舍、提交/推送/部署。本轮结束后课程包真实互操作与备份恢复演练进入后续独立交付，不自动加入本轮。

## Contracts and data changes

### 同步诊断及修复

先为页面生命周期、启动同步、普通请求、恢复请求和持久状态添加测试侧有序事件记录，失败时保留脱敏轨迹。记录 requestId、baseline、generation、pending phase、文档导航与测试阶段，不输出完整业务快照或凭据。

用请求门闩控制 config/data/resolve 的实际次序，复现启动未完成时开始编辑、丢回执后重载和账号变更时 preload。不要用固定睡眠代替完成条件。boot 可在测试侧等待现有 ensureCloud 的完成，再检查目标状态；实施前核实无循环等待。若是真实入口竞态，修复实际入口并保留故障注入测试；若仅测试抢跑，修测试并解释为何真实页面不受影响。

丢回执继续同一请求、归档一次、新答题保留、容量阻塞不自动重复提交、跨账号隔离等现有断言不得删除。恢复后不仅检查一次 clean，还应检查启动/在途工作已完成后 journal 不重新出现。

### 运行器与进程生命周期

POSIX 为每个套件建立独立进程组，超时终止自身进程组；Windows 保留指定 PID 的进程树清理。清理不得波及其它任务。测试构造父子孙进程并验证超时后都退出，避免只断言 code=124；spawn error、持续失败、默认重试、零重试分别验证。测试自身使用独立临时目录。

每个 attempt 完成立即落盘；汇总有 ISO startedAt/finishedAt、平台/Node、选择组、timeout、重试配置、首次通过/flaky/失败数量。保存 git HEAD、工作区状态及代码内容指纹（包含未跟踪源码，排除 .git、依赖、output、数据库、凭据和 .env）；保存清单与哈希，不复制秘密内容。运行前后核对指纹，代码途中改变则标明结果不对应单一版本。TEST_RUN_ID 只允许安全目录名并拒绝覆盖既有运行目录。结果中不得写入 token、密码或认证头；覆盖常见 JSON/Authorization 格式的脱敏用例。

### 学习流程证据

1440×900 和 390×844 各跑：首页刷新及延迟加载后仍是首页、进入课程、答题、打开长详解、退出、刷新、继续、完成课节、点击下一未完成课节、复习入口、统计返回。允许复用独立测试覆盖，但报告需逐项映射，不把性能测试替代完整流程。

长详解必须真的溢出；验证面板可滚到最后一段，关闭和下一题能通过可见控件点击、候选区不挡操作、无水平溢出、无页面异常。至少保存桌面完成页、手机长详解顶部/底部和下一课截图，人工查看图片。学习种子只写入隔离夹具；答题及转场使用可见 UI，校验 cid/覆盖去重/课节范围，不能修改统计使断言通过。尊重 CHROMIUM_PATH。

### 文档事实

执行开始将原 closeout 恢复 in-progress，保留历史通过及失败记录；只撤销无证据的勾选。同步专项业务实现与间歇失败诊断分别记录。禁止删去原验收条件再标完成。

## Implementation steps

- [x] 1. 核对适用指令与工作区；本计划已设为 in-progress；原报告的过度结论和已有两轮证据均已保留并列入后续修正范围。
- [x] 2. 为同步/账号启动失败完成受控复现与启动顺序记录：旧路径在启动 Promise 未完成时继续，修复为 `ensureCloud()` → `waitForSync()`；同步、账号专项各连续 3 次通过，未扩大产品同步协议。
- [x] 3. 修运行器的跨平台清理、attempt 即时写入和版本指纹；补真实子进程、spawn error、持续失败、零重试及脱敏契约测试；Ubuntu browser CI 已设置 `TEST_RETRIES=0`，保留失败产物。
- [x] 4. 补桌面/手机实际交互与长详解截图验收：桌面换课、手机 390×844 长讲解滚动/关闭/下一题和无横向溢出均有证据。
- [x] 5. 已完成规定验证并记录平台边界；Windows 严格全量与发布专项通过，WSL Ubuntu 原生依赖临时副本的 unit/checks 也通过。

## Validation

- [x] `node scripts/run-tests.test.js`；`npm run lint`；`npm run typecheck`。
- [x] `account-set-credentials`、`sync-recovery` 各连续 3 次零重试通过；根因是测试启动条件缺失，不是业务同步协议失败。
- [x] `learning-journey`、`content-explanation-refresh`、`mobile-learning-explanation`、`main-startup`、`progress-coverage`、`stats-back` 等专项通过；移动端顶部/底部截图已目视检查。
- [x] Windows 及 WSL Ubuntu 均验证运行器真实进程树清理；WSL unit 34/34，Linux checks 16/16（使用隔离副本重建原生依赖）。
- [x] build/content/SW/deploy/diff 检查通过。
- [x] `TEST_RETRIES=0 npm test`：runId=`20260920062725593-18824`，101/101、0 flaky、工作区前后指纹一致；`npm run e2e:release`：24/24。

## Acceptance criteria

- [x] 两项间歇失败有可解释、可受控复现的根因及修复证据；没有以一次全绿宣称问题消失。
- [x] 超时清理实际子孙进程，Windows/Linux 均有运行证据；产物即时保存并对应实际代码。
- [x] 桌面/手机真实学习流程、长详解滚动及可操作性有断言和已查看截图；Runtime entry point connected。
- [x] 严格全量与发布专项通过，真实失败均保留；历史未完成事项准确列出。
- [x] 文档只按实际通过项更新；历史外部工作明确列为本计划范围外，不阻塞本交接完成。

## Risks and rollback

启动恢复可能与普通同步形成循环等待；避免扩大 waitForSync 含义。不得清库、忽略真实业务差异或换用同设备夹具绕过冲突。只回退本轮明确改动，保留用户工作区和历史证据。平台不可用属于验收未完成，不以静态审查冒充 Linux 执行。

## Execution notes

本轮已完成四项证据缺口的代码/测试修正。Windows 严格全量 101/101、发布专项 24/24；WSL Ubuntu unit 34/34、checks 16/16（临时副本重建 Linux 原生依赖）。历史课程包互操作、备份恢复演练、真实设备和生产发布仍单独安排，但属于本计划明确的外部范围，不阻塞本交接完成。
