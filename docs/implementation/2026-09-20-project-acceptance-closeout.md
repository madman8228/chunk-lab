# 项目收尾：可信验收、学习流程与讲解质量

- Status: complete
- Updated: 2026-09-20
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca；以当前工作区为功能基线。main.html、core.js、同步模块、内容分片、server、package.json 等已有修改；src、测试运行器、CI、实施文档等有未跟踪文件。不得从 HEAD 重建并丢弃这些功能。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

交付一份可追溯的项目验收报告，并修正已经确认的讲解兜底与测试证据缺口，使当前版本的学习主流程和剩余工作可核实。完成边界是本计划全部验收，不等于全部历史计划或上线完成。

## Current state and evidence

- 根目录未发现 AGENTS.md；执行前重新检查适用的仓库指令。
- docs/implementation/2026-09-19-engineering-maintainability.md 仍 in-progress，core runtime、首页源码接入、服务端装配及浏览器验收有未勾选项。src/main 目前只有 entry、index、lifecycle；不能把模块文件存在当作全部接入完成。
- 2026-09-18-course-package-import.md 仍 in-progress；状态与逐项证据需要核实。真实课程生成器导出测试被 test-manifest 排除，不能用全量通过证明外部互操作已验证。
- 同步恢复验收文档已补充证据更正：运行器实际串行调度；启动竞态已定位为测试未等待 `ensureCloud()`，同步/账号专项各连续 3 次通过；严格 `TEST_RETRIES=0 npm test` 按实际 manifest 通过 101/101，不再声称并行稳定。
- `output/test-results/20260920052306078-29148/summary.json` 保存了本轮 100 项结果、runId、完整 stdout/stderr 和每次 attempt；严格运行无 flaky、无最终失败。
- `run-tests.test.js` 已覆盖 pass/fail/timeout、默认/零重试、spawn error、脱敏和父子进程树；Windows 与 WSL Ubuntu unit 均通过，生命周期清理专项已完成 Windows 服务退出等待与失败日志证据。
- `e2e/exit-clears-choices.test.js` 已改为等待 health、捕获服务输出、等待服务退出后再清理临时目录。
- `main.html` 的讲解兜底已按合同修正：不再将 translation 冒充核心含义、不再按课程名补惯用表达模板、不再复制原题为例句；结构化讲解和 HTML 转义保留。
- main.html 已有下一课决策、进度说明、详解面板；新增 `e2e/mobile-learning-explanation.test.js` 覆盖 390×844 的答题、长讲解滚动、关闭、下一题和无横向溢出；桌面换课由 learning-journey 覆盖。
- 本轮已完成隔离浏览器验收、严格全量回归、构建/内容/SW/部署清单检查和发布专项；仍未执行真实设备、外部 course-creator 互操作、生产部署与真实账号发布演练。

## Assumptions and decisions

1. 顺序：核实历史交付 → 学习流程验收 → 讲解兜底修正 → 测试与发布证据收尾 → 同步升级决策记录。
2. 保留当前多页面结构、学习身份和同步协议。现有功能正确则仅记录，不为收尾实施全仓重构。
3. 将历史计划的证据不足与产品缺陷分开记录；完成本轮不要求补完所有历史重构。已确认但超出本计划的工作必须列出具体入口和验收缺口。
4. 浏览器验收使用临时数据库和独立浏览器上下文；本轮使用隔离 Playwright 实例完成桌面/手机验证，未操作当前用户标签，避免答题污染当前进度。
5. 测试重试通过标为 flaky，首次通过、重试通过、最终失败分别统计。严格验收使用 TEST_RETRIES=0，保留默认重试功能但不能以它证明根因消除。

## Scope

- docs/implementation 下历史计划的证据与状态更正，以及新增项目验收报告。
- main.html 的讲解构建与空态；e2e/content-explanation-refresh.test.js 的相关断言。若抽纯 helper，必须接回实际页面。
- scripts/run-tests.cjs、scripts/run-tests.test.js；必要时新增 e2e/lib/server-lifecycle.js，仅迁移已观测失败的启动链路（exit-clears-choices、sync-recovery 等）。
- 新增 e2e/learning-journey.test.js 或扩展现有对应测试；仅针对复现问题修改 main.html、src/main/lifecycle.mjs、js/course-resume.js 等实际存在的入口，执行前核实文件名。
- 必要的 sw 生成物、部署资源清单；新增 output 下隔离测试证据。

## Out of scope

整套同步协议重写、实体版本迁移、事件统计重建、SRS 算法更改、批量编写全部课程讲解、补完历史模块拆分、删除真实归档、真实账号冲突取舍、提交/推送/部署。没有外部测试条件的事项明确未验证，不虚构通过。

## Contracts and data changes

### 验收事实

报告每项记录：历史计划条目、实际入口、对应测试或操作、结果、证据路径、剩余事项。状态允许已验证/已实现未验证/部分完成/未实施/外部条件待满足。保留历史记录并追加更正；同步恢复文档应明确专项实现与稳定性验收分别如何，未通过原必需条件不得继续声称全计划 complete。其他计划不得根据文件存在批量勾选。

### 学习流程

以1440×900及390×844视口验证：普通首页刷新及延迟同步后仍在首页；选课、答题、详解、退出、刷新、继续、完成课节、下一未完成课节、复习、统计返回。用受控小课程固定总句数，分别核对覆盖句数去重、当前题序、课程和课节范围；练完课节不能把全课程标完。保留现有学习业务规则，不通过修改统计数据使断言通过。手机详解可滚动到末尾，下一题和关闭可点击，无横向溢出。

### 讲解显示

保留 explanation/explain/note 字段兼容及已有 meaning/core、usage/scene/context、equivalents、note/tip、examples 等内容。仅真正提供的含义显示“核心含义”；只有译文时不复制到讲解。无场景不生成模板，不按课程名推断句子类别，不把原题充当新增例句。没有有效讲解时保留“详解”入口，面板简短显示“本句暂无补充讲解”。结构化语法/已有解释优先级保持，HTML 转义保持。测试覆盖普通算术句、无解释惯用语、完整结构化解释、空字段以及恶意文本转义。不得更改 cid、deckId 或进度映射。

### 测试证据与生命周期

每次运行生成独立 runId 目录和汇总，包含时间、组、配置、套件数、每次 attempt 完整 stdout/stderr/退出码/耗时/超时标记。保留兼容的最新分组 JSON，但历史运行不可覆盖；保存工作区摘要或内容指纹，不能仅用 HEAD 标识脏工作区。失败输出不得包含凭据，使用测试账号。

进程启动等待 health 就绪，区分 spawn error、提前退出、health 超时，失败输出相关服务端日志。停止服务等待退出再删除本次临时目录；清理仅限自己创建的进程。POSIX 如使用进程组须显式建立，Windows 清理自身进程树；不扫描杀死所有 node。合理截止时间可配置，不用无条件延长或增加重试代替诊断。新 helper 仅迁移受影响测试，不扩大成全仓测试框架重写。

## Implementation steps

- [x] 1. 保存当前工作区摘要，设本计划 in-progress。逐条核查全部实施文档，生成 docs/implementation/2026-09-20-project-acceptance-report.md；列明工程维护、课程导入、同步恢复及上线外部门槛的真实进展，更正无证据的稳定性说法。
- [x] 2. 验证学习主流程，补齐完整课节到下一课的连续操作测试；桌面与手机通过隔离浏览器自动化验证，未触碰用户当前浏览器数据。
- [x] 3. 按讲解合同修正实际页面兜底，保留已有人工讲解；空态、普通句、结构化解释、HTML 转义和手机详解滚动均有断言或专项回归。
- [x] 4. 补齐运行历史与每次失败日志、首次通过/flaky/最终失败汇总；重试契约、spawn/health 启动诊断、超时进程树清理已覆盖，测试数量按当前 manifest 实际为 101。
- [x] 5. 执行验证并生成最终验收报告：已记录实际覆盖、已知风险、未验证外部门槛、改动文件组和回退边界。同步升级仅形成证据结论，没有实施迁移。

## Validation

- [x] `node scripts/run-tests.test.js`；`npm run lint`；`npm run typecheck`。
- [x] `node e2e/learning-journey.test.js`；`node e2e/content-explanation-refresh.test.js`；`node e2e/main-startup.test.js`；`node e2e/progress-coverage.test.js`；`node e2e/exit-clears-choices.test.js`；`node e2e/sync-recovery.test.js`。
- [x] 桌面与手机布局使用隔离 Playwright 浏览器实例验证，替代 computer use 直接操作当前用户标签：手机视口 393×852，release 窄屏 375px；记录在专项输出中，未修改用户进度。
- [x] `npm run build:check`；`npm run content:check-generated`；生成物检查通过。
- [x] `node scripts/gen-sw.js`；`node scripts/check-sw.js --strict`；`node scripts/check-deploy-files.js`；`git diff --check`。
- [x] PowerShell 设置 `TEST_RETRIES=0` 后 `npm test`；runId=`20260920062725593-18824`，101/101、无 flaky、无最终失败，工作区前后内容指纹一致。
- [x] `npm run e2e:release`：首屏 255.5 KB、1 个分片请求/136 个分片、375px 无横向溢出，发布专项 24/24。

## Acceptance criteria

- [x] 验收报告逐项可追溯，历史未完成工作明确保留；本轮完成不误称全部 Astra 计划完成。
- [x] 学习连续流程在桌面和手机通过，统计范围清楚，刷新不自动切入课程；Runtime entry point connected。
- [x] 讲解不再伪造惯用表达分类、不重复原题凑内容，已有有效解释仍显示。
- [x] 首次失败原始日志可查，严格运行通过；重试通过仅作为运行器能力记录，不声称有限运行证明永不抖动。
- [x] 本轮必需检查有真实结果；未完成的是历史计划和外部发布门槛，已在报告中保留并未伪装成完成。发布准备记录明确外部条件，未执行部署。

## Risks and rollback

工作区包含大量既有改动，只回退本轮明确修改的片段，不用 reset 或清库。测试准备命令会生成文件，前后比较并记录。讲解空态是有意减少误导信息，不自动补造教学事实。历史模块拆分缺口单列，不在本轮强行补完。同步升级需以真实冲突类型和频率为依据；无证据时记待评估。

## Execution notes

本轮已执行完成：讲解兜底、连续学习验收、测试运行器证据与生命周期清理均已落地；严格全量 101/101，发布专项 24/24，WSL unit 34/34、checks 16/16。历史工程维护、课程包外部互操作、首发数据安全和生产部署仍按原计划保留，不能以本轮收尾报告替代。
