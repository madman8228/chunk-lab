# 全站共享词块选择组件交付计划

- Status: complete
- Updated: 2026-10-23
- Branch/worktree: `stabilize/p0-1-20261021` / `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `a5e9e8831315377743dc232bcb5789412e367ce0`。工作区存在大量其他任务改动；`main.html`、`sw.js` 已修改；`src/expression-course/`、`assets/expression-course.css`、`e2e/expression-course.test.cjs` 为现有未跟踪文件。不能用 HEAD 覆盖这些文件，不能整仓暂存或清理。
- Planner: GPT-6 Astra（工作流角色；环境未确认主任务模型选择，已提醒用户选择）
- Executor: GPT-5.6 Luna

## Objective

交付一套真实接入表达课程、主学习页选择模式、单词课程组句题的共享词块 UI 与交互组件。统一视觉、可访问性、重复词块身份和提交状态；保留各课程原有判题与学习记录规则。执行到三个入口的隔离浏览器验收完成，不停在仅有组件演示的阶段。

## Current state and evidence

1. `src/expression-course/ui/renderers.mjs` 独立生成 token-button/token-chip；`assets/expression-course.css` 约 109–111 行独立定义按钮和选中块样式。当前已追加选满自动提交，但本地 submitted 标记与按钮锁定在请求失败后没有恢复路径。
2. `src/expression-course/runtime.mjs` 的 safeActivity 已增加 expectedTokenCount，同时移除 correctTokens/evaluation。`ui/entry.mjs` 的 act 保存 requestId 与 expectedRevision，失败时只恢复 footer 的按钮。必须保留幂等机制并让共享组件接收提交结果。
3. `main.html` 的 stageChoices、约 3743–3850 行选项池/chooseSubmit、6547 行 resetPracticeSelection 维护现有句子选择状态；每选一块立即判定，正确/错误/提示样式由 .choice 定义。`src/main/practice-markup.mjs` 管答案槽和输入框，不是独立的候选词块组件。
4. `landing/chunk-order-view.js` 已实现稳定 chunk.id、选满自动判定、点击已选块撤回、焦点保持、stop/focus/destroy。它调用 `js/vocabulary-chunk-order.js` 的 validate/evaluate，返回 values={chunkIds}，由外层保存学习事件。`wordbook.html` 直接加载这两个脚本。
5. 表达课程构建入口：`scripts/build-expression-course.mjs`，输出 js 下浏览器包和 server/services/expression-course/runtime.cjs。Service Worker 版本必须经 `scripts/gen-sw.js` 生成。
6. 本轮只读 `node --check e2e/expression-course.test.cjs` 已成功；上一轮所报语法错误当前已不存在，不应沿用旧结论。该测试的句子组块步骤仍手动点击检查答案，需要更新对应步骤。
7. 既有 `scripts/chunk-order-ui.test.cjs` 使用私有 drafts 夹具；新验收不能依赖这些资产。已有整合测试 `e2e/chunk-order.test.cjs`、主学习页相关 e2e 可作为行为参考。

## Assumptions and decisions

- 用户要统一相同交互的表现，不授权改写教学规则。保留两种明确模式：sequence（选满目标数后整句提交）和 immediate（每次选择交给现有判题器）。不用配置语言或通用题型框架。
- 表达课程与单词组句使用 sequence；主学习页选择模式使用 immediate。主学习页输入模式保持原样。
- 使用原生 DOM、原生 button 和项目现有构建工具，不引入 UI 框架、拖拽库或状态库。
- 共享代码不请求 API、不读取账户、不直接判题、不保存记录。适配层保留这些职责。
- 视觉以主学习页现有 .choice 的色彩/反馈为基准，统一最小 44px 点击高度、间距、圆角、换行及 focus-visible；各页面只设置容器布局。
- 用户当前可能正在作答；实现期间不操作真实答题，不刷新其活动页面，不清理浏览器存储。验收使用新临时目录、隔离端口、合成课程及测试账户。

## Scope

- 新增 `src/shared/chunk-selection.mjs`、`assets/chunk-selection.css` 和独立小构建入口 `scripts/build-chunk-selection.mjs`，输出 `js/chunk-selection.js`（IIFE，全局 ChunkSelection）。三种入口共享同一实现。
- 接入 `main.html`、`expression-learn.html`、`expression-create.html`（共享 renderer 的预览依赖）、`wordbook.html`；修改 `src/expression-course/ui/renderers.mjs`、`ui/entry.mjs`、`landing/chunk-order-view.js` 的适配层。
- 收敛对应候选块/已选块样式：main.html、assets/expression-course.css、assets/wordbook-study.css 中相关规则；保留非词块 choice-button 等规则。检查 landing 目录的组句相关样式，避免重复覆盖。
- 必要的构建、生成物、离线清单和隔离验收变更。

## Out of scope

- 课程文本/素材/发布、数据库迁移、账户数据、授权和离线许可策略。
- 听力选项、填空输入、整页布局重设计；不把所有按钮强行改成词块组件。
- 更改错误次数、掌握度、计分、主学习页逐块教学顺序、单词组句成功事件格式。
- 自动提交 Git、推送、部署或重启现有 8787 服务。本次完成标准为实际页面在隔离实例接通；现场部署另列必要步骤。

## Contracts and data changes

组件入口 `ChunkSelection.create({mode, tokens, targetCount, onSelect, onSubmit})`，返回 `element / focus / getSelection / reset / setState / stop / destroy`。方法名可随现有风格微调，语义不可扩张。

- tokens 是 `{id, text}` 数组；同文本不同 id 是不同词块。表达课程以题目 id+原数组下标生成稳定 UI id，提交时仍转换为原协议 tokens 字符串数组；单词课程保留原始 chunkIds；主学习页保留现有 data-v 和选择判定语义。
- sequence 使用服务端目标数；无干扰项的单词组句使用 chunks.length。不得用候选项数量推断含干扰项题目的答案长度。表达课程沿用 expectedTokenCount，旧服务器缺少此字段时保留原手动提交路径，不能隐藏按钮造成死路。
- 未满时可撤回已选块；满额只产生一次 onSubmit，立即进入 pending，提交 payload 是不可变快照。pending 禁止选择/撤回/重置/提示引发竞态。
- 提交结果由适配层明确设置：success（完成/交由课程推进）、incorrect（允许撤回重排，或沿用表达课程既有重绘重试）、retryable-error（保留选择，显示“重试提交”）、blocked（权限失效提示并禁止自动重试）。正常状态无检查答案按钮；故障重试按钮仅在故障后出现。
- 网络响应丢失时，重试相同答案必须沿用 entry.mjs 的 requestId 和 expectedRevision；在结果不确定时先重试原动作或读取服务端状态，不允许直接改答案并生成第二次计分。
- immediate 模式不维护另一份主学习页答案状态；宿主提供候选按钮状态并接收 onSelect，原 chooseSubmit 仍负责推进/错误/提示。组件仅统一候选项呈现、锁定和事件绑定。
- stop/destroy 后不能继续派发事件；换题后的迟到响应不得影响新题。使用实例销毁/题目身份校验，避免引入新的全局会话层。
- Tab、Enter/Space 使用原生按钮语义；撤回后焦点合理保留，aria-label 区分重复词块；反馈用 aria-live。文本用 textContent，不能拼接未转义课程文本。
- 无持久数据结构变更；expectedTokenCount 已在现有未提交代码中，执行时核对而非重复造字段。

## Implementation steps

- [x] 1. 固定范围并核对现有入口、生成链与工作区；保留既有表达课程与并行改动。
- [x] 2. 抽取 sequence/immediate 两种选择模式、重复词身份、pending/错误/重试反馈、键盘焦点与共享按钮 CSS。
- [x] 3. 表达课程接入共享组件；保留服务器判题、requestId/expectedRevision 重试；预览和旧服务器手动提交路径不自动提交。
- [x] 4. 单词组句接入共享选取；判题、音频、学习记录继续留在原适配器；认证练习主路径和布局已覆盖。
- [x] 5. 主学习页改由共享组件渲染 immediate 选项；保留 `.choice`/`data-v` 与 `chooseSubmit` 语义，去除重复点击代理。
- [x] 6. 构建接线完成；共享资源已被 SW 资源依赖扫描纳入并更新哈希。
- [x] 7. 隔离验收通过：表达课、主学习页、单词组句和 SW 升级流程均通过。修正了升级测试的持久化等待时序，以及单词本测试中已过期的匿名/详情页/禁用功能假设；未改产品认证或课程权限逻辑。
- [x] 8. 定向单测、真实页面 E2E、构建产物检查、SW 哈希检查和 diff whitespace 检查通过。8787 未重启、未部署。

## Validation

- [x] 三个真实入口由现有隔离浏览器测试分别覆盖，无需另造一套重复测试框架：`e2e/expression-course.test.cjs`、`e2e/ai-course-native-learning.test.js`、`e2e/chunk-order.test.cjs` 均通过。
- [x] 表达：正确目标数自动提交（核心测试 + 浏览器 E2E）；保留旧服务器/预览手动提交；既有 E2E 覆盖服务端拒绝后保留答案、丢响应后同 requestId 重试且只记一次。非组块题目的检查按钮行为不变。
- [x] 单词：自动提交、错序不记成功、撤回重排、成功事件一次、听句子不新增完成记录、断网本地回执/重连同步、第二设备恢复和隔离备份恢复通过。
- [x] 主学习页：真实页面逐块正确/错误、提示/重置和选择模式 E2E 通过；输入/测评路径未改，现有 state/markup 回归测试通过。
- [x] 桌面和 390/320px 截图无横向溢出；共享词块按钮最小高度 44px。截图保存在 `output/playwright/chunk-order-integrated/` 与 `output/playwright/chunk-order-entry/`。
- [x] `node --test src/expression-course/core.test.mjs scripts/main-practice-state.test.mjs scripts/main-practice-markup.test.mjs`（14 项）及 `node scripts/vocabulary-chunk-order.test.cjs` 通过；`node --test e2e/expression-course.test.cjs` 通过。
- [x] `node scripts/build-app.mjs` 已生成应用资源；`node scripts/check-generated.mjs`、`node scripts/gen-sw.js --check`、`git diff --check` 通过。SW 缓存哈希为 `chunklab-d1ce33b5`。
- [x] SW 升级浏览器验收 36 项全部通过，涵盖旧缓存淘汰、新缓存建立、P3 页面受控、旧写入拒绝、学习数据单次写入和刷新后不重复计数。生成检查仍提示预置文件 `textbook-production.html` 缺失引用，与本次功能无关。

## Acceptance criteria

- [x] 三个真实课程入口使用同一组件实现和 CSS，选择逻辑保留在各自适配器。
- [x] 两种教学模式保持各自语义；sequence 的正常流程没有检查答案按钮，选满自动提交。
- [x] 提交失败可恢复，不会锁死所有词块；响应丢失不重复计分。
- [x] 重复词身份、干扰项、撤回/重排、键盘原生行为和小屏显示通过定向验收。
- [x] 学习记录、权限、课程资源仍由原适配器管理；所有浏览器测试使用临时数据与隔离端口，没有使用真实账户。
- [x] 三个运行时入口连接已由隔离页面验收；构建与 SW 缓存版本一致。
- [x] 现场部署状态已记录：未重启 8787、未部署、未提交。

## Risks and rollback

- 主学习页与组句语义不同：只共用 UI 和选择原语，判题状态保持宿主权威，避免引入第二套成绩状态。
- 现有工作区大量并行修改：按片段修改，执行前后核对；回退只撤销本次片段及对应生成物，禁止 reset/checkout 整文件、清存储或删除课程。
- 表达后端 runtime.cjs 更新需要服务进程重新加载，静态文件更新不能代替后端更新。独立实例测试会加载新包；正式本地服务更新列为单独操作，不能沿用旧 PID 或绕过上轮进程操作拒绝。
- 回退须保持服务端和浏览器版本匹配，并重新生成 SW 版本；旧服务端缺少目标数量时保留可用的手动提交兼容行为。

## Execution notes

执行记录（2026-10-23）：

- 新增共享组件源码/CSS/构建入口；表达课程、wordbook 词序和 main immediate 选择已接入。`scripts/build-app.mjs` 与 `scripts/check-generated.mjs` 均已接线。
- 通过：`node --test src/expression-course/core.test.mjs`（12 项）；`node --test scripts/main-practice-state.test.mjs scripts/main-practice-markup.test.mjs`；`node scripts/vocabulary-chunk-order.test.cjs`；`node scripts/check-generated.mjs`；`node scripts/gen-sw.js --check`。
- 浏览器通过：`node --test e2e/expression-course.test.cjs`；`node e2e/ai-course-native-learning.test.js`；`node e2e/chunk-choice-diversity.test.js`。单词本 `e2e/chunk-order.test.cjs` 覆盖撤回/重排、错误反馈、完成、音频、移动端尺寸和离线本地保存同步；最终在匿名体验分支未呈现候选按钮而失败。测试的离线提示断言已更新为产品实际提示“练习已保存在本机，联网后自动同步”。
- `e2e/upgrade-check.js` 根因已定位为继承了机器级 `REQUIRE_AUTH=true`，但测试没有提供必要的 JWT/admin secrets；已给两个旧测试 harness 明确配置隔离身份参数。升级流程的 SW 旧缓存淘汰、新缓存建立、新页面受控检查通过；最后在旧课程练习等待 `#btnNext` 时超时，需单独判断该旧测试与当前课程行为的差异。
- 最终回归：`e2e/upgrade-check.js` 36 项通过。测试顺序改为等待服务端 `learning.answer` 确认；迁移夹具的最后一道题会进入结果倒计时，不再等待不存在的下一题。
- 最终回归：`e2e/chunk-order.test.cjs` 完整通过。测试更新为验证实际匿名登录门槛、按单元呈现练习入口，并在隔离服务关闭练习能力时以认证测试账号验证不能渲染词块。
- 定向单测最后复跑通过（14 项 + 词序课程契约测试）。`check-generated`、`gen-sw --check`、`git diff --check` 均通过。测试数据在新临时目录；未访问或修改真实课程、账户记录和原浏览器数据。
- 仍有大量此前已存在的并行工作区改动；本次只修改共享词块相关源码/生成物、验收测试和本计划，没有尝试整理或提交整个工作区。
- `gen-sw` 仍报告 HTML 引用但缺失 `textbook-production.html`；此次生成物检查本身通过。
- E2E 数据使用临时目录，未触碰真实账户/课程记录；未重启或切换 8787 服务、未部署。截图输出在 `output/playwright/chunk-order-integrated/`。
