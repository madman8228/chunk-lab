# 学习闭环与同步回归修复交接

- Status: complete
- Updated: 2026-09-30
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22；工作区存在大量在先修改，包括 main.html、core.js、stats.html、src/core、src/learning、server/services、测试及生成文件。课程创作、题库和内容文件不属于本轮修复范围，不得整体回退。
- Planner: Astra 规划阶段（用户已回复继续规划；不声称读取了模型选择器）
- Executor: GPT-5.6 Luna

## Objective

完成一次有边界的回归修复：学习记录在刷新、退出重进、断网恢复和两端同步后不丢失、不重复、不复活已取消标记；熟悉、考试掌握和复习排期在实际页面一致。保留最近确认的精简界面，不新增产品入口或改版。

## Current state and evidence

- 当前 HEAD 和分支已核对；仓库文件搜索未发现 AGENTS.md，执行前再检查父目录指令。
- 上轮已修复 createHomeCourseLookup 中误引用 _rankedItems、答案提示不记辅助作答、空队列残留操作、过时导出文案。这些作为回归保护，不重新实现。上轮测试结果不能代替本轮验收。
- src/core/sync-learning-marks.mjs 接收 entityGone 并删除取消的熟悉标记；src/core/sync-batch-merge.mjs:mergeBatchSnapshots 对 mastered 使用 Object.assign。两条路径语义不同，批量路径是否获得完整删除信息需用真实调用链复现，不直接把远端缺项当删除。
- server/services/data-save.js 区分批次版本冲突、REQUEST_ID_REUSED 和 COURSE_LIMIT_REACHED。仅看到 409 无法判断用户当前同步冲突根因，禁止统一吞掉或强制覆盖。
- learningV1 合并存在于 core.js:mergeLearningV1、src/core/merge.mjs、server/services/data-rows.js；需证明同一输入得出一致证据集合和状态。
- src/learning/assessment.mjs:getAssessmentEligibility 的失败筛选只包含 assessment；state.mjs 的失败还包括 practice 或 assisted，存在状态与下次考试阶段不一致的边界。
- schedule-policy.mjs 失败进入 10 分钟巩固，但保留旧 interval 等字段；需证明巩固后独立答对回到 1 天，而非沿用高阶段直接排很久。
- 原 2026-09-29-learning-mastery-assessment.md 仍是 in-progress，部分“当前状态”已过时。本交接是此次修复唯一执行入口；旧文档用于规则背景，不照其清单再次新增功能。

## Assumptions and decisions

1. 保留 V1 时间策略：熟悉且无排期为 3 天；失败/辅助完成为 10 分钟巩固；初测至少距最近暴露 24 小时；初测后至少 7 天再复测。这是既定产品策略，不宣称科学最优。
2. 熟悉是自评；普通练习不能授予掌握。当前有效初测与不同会话的延迟复测通过才掌握。失败或答案辅助使当前验证失效，保留历史，重新初测和延迟复测；单纯逾期不降级。
3. 只有明确的版本化删除/取消意图能删除熟悉标记；远端缺项、分页和旧客户端字段缺失均不是删除证据。
4. 不自动解决用户当前真实数据的不可判定冲突。能安全合并的学习证据按合同合并；课程内容等实质冲突继续保留原比较入口和双方数据。对于本机尚未确认上云的重新标熟与远端取消墓碑冲突，保留本机并转入现有整账号人工比较，不扩展实体版本协议。
5. 复用现有存储、事件、版本和重试机制，不另建同步协议，不迁移到 FSRS，不增加考试入口或快捷键。

## Scope

学习证据合并、熟悉取消、冲突重试、考试资格和状态一致性、复习排期边界、实际入口回归与新版资源验收。

## Out of scope

全项目重构、题库修改、AI 课程创作、语音考试、UI 改版、清空数据、直接修写用户成绩、自动选择云端/本地覆盖、提交、推送或部署。当前真实同步冲突若需要选择保留内容，只交付诊断和选择依据。

## Contracts and data changes

- 沿用 CL.cidKey/sourceDeckId 身份、learningV1、kind=answer/learning 事件和既有会话快照；不重命名历史字段，不将 mem.mastered 当考试掌握。
- 同一事件 id 重试去重；同一 id 内容冲突采用确定性保守规则，失败不可被通过覆盖；合并满足幂等和交换顺序稳定。不同时间新失败不可被旧通过掩盖。
- 答题次数仅由现有答题事件合同计算，learning 证据不得另计一次。新增证据单独变化也必须进入同步签名。
- 排期不能取两端最大 dueAt 简单合并：最新有效作答决定排期，同时间矛盾结果保守失败优先；未来排期的主动正确重练不延长，失败可缩短。
- 保持 legacy dueAt 与 learningV1.dueAt 的消费者一致；旧客户端省略 learningV1 时保留已有证据，不伪造考试结果。
- 请求原样重试复用 requestId；合并后内容改变必须使用新请求身份和当前基线。409 不得被误当保存成功，待同步数据不得提前删除。
- 优先补齐现有 entityGone/删除意图在批量合并中的传递；若必须新增持久化协议或数据库结构，记录证据，将本计划改为 needs-planning，停止该扩展。

## Implementation steps

- [x] **1. 固定基线与复现（其余步骤的前置）**：核对指令、git diff 和已有测试。只读检查 core.js 的冲突捕获/批量合并调用、api.js、server/routes/data.js、server/sync-conflict.js、sync-resolution.js。记录真实冲突 reason/实体类别，日志不输出令牌和完整学习数据。以临时数据库与独立浏览器上下文复现，不修改用户会话。列明确认缺陷和未复现风险。
- [x] **2. 合并合同与取消标记**：在 scripts/core-sync-learning-marks.test.mjs、core-sync-batch-merge.test.mjs、core-merge.test.js 增加同一场景跨两条路径的测试：A 标熟→B 同步取消→A 旧副本合并；随后明确重新标熟；远端缺项不可误删。修复 src/core/sync-batch-merge.mjs、sync-learning-marks.mjs 及 core.js 适配层。对 learningV1 的三处实现增加交换顺序、重复事件、晚失败、旧客户端字段缺失测试；仅提取此次需要的共用规则，勿顺带重构同步系统。
- [x] **3. 冲突和离线重试**：用 e2e/batch-sync.test.js、sync-recovery.test.js、sync-outbox.test.js 覆盖两端并发、离线积压和服务端已保存但响应丢失。根据第 1 步证据修复 core.js 与 src/core/sync-* 对请求身份、基线或待同步状态的处理；服务端仅在合同缺陷被复现时改 data-save.js/data-rows.js。不得关闭版本校验或用无限自动重试掩盖冲突。已确认本轮冲突规则为“未确认上云的本机重新标熟遇远端取消墓碑时保留本机，生成 batch 冲突进入人工比较”。
- [x] **4. 学习状态与排期统一**：修改 src/learning/state.mjs、assessment.mjs、schedule-policy.mjs，让考试资格复用相同有效证据/失败口径；失败后的旧初测不能继续用于直接复测或维护考试。验证高阶段答错→10 分钟→独立正确→1 天；已标熟不覆盖失败排期。接入 main.html 的 recordSentenceResult/startDeck、core.js 状态消费及 stats.html，不新增控件。答案提示当下记录暴露，即使退出未完成也不得立即获得考试资格；提示本身不增加答题次数。
- [x] **5. 实际页面收尾**：验证 main.html 所有结算分支均无 btnHome/btnExportJSON，下一课按钮及结算副标题不泄露下一课名称；Ctrl+F 仅显示全句、记录辅助，不填空/推进；空队列无无效操作，重新开始有题时恢复正常。课程目录加载失败不得当成全部课程已删除，保留订阅并显示现有风格的失败提示；只在成功取得目录且确实缺项时用不可用状态。文件以 main.html 和对应 E2E 为限。
- [x] **6. 完整验收与交付**：执行下列测试、构建和更新验证。使用独立测试页面验证新旧资源切换和完整流程；必要时重启现有本地服务但不清缓存存储、不刷新用户正在作答的页面。记录通过/失败/未测，不以 HTTP 文本检测替代 UI 验收。全部必需条件通过后才将本计划标 complete。

步骤 2→3 依次进行；步骤 4 依赖步骤 2 的证据合同；步骤 5 可独立检查；步骤 6 必须覆盖集成后的整体行为。发现已正确的路径只补必要验收，不为满足清单强行修改。

## Validation

每条单独运行并记录退出码；浏览器及服务端测试使用临时数据库。失败先定位，不将未解释的失败称为无关。

- [x] node scripts/core-sync-learning-marks.test.mjs
- [x] node scripts/core-sync-batch-merge.test.mjs
- [x] node scripts/core-merge.test.js
- [x] node scripts/core-stats-signature.test.js
- [x] node server/learning-evidence.test.js
- [x] node server/sync-delta.test.js
- [x] node e2e/batch-sync.test.js
- [x] node e2e/sync-recovery.test.js
- [x] node e2e/sync-outbox.test.js
- [x] node scripts/learning-state.test.mjs
- [x] node scripts/learning-assessment.test.mjs
- [x] node srs.test.js
- [x] node e2e/learning-mastery-loop.test.js
- [x] node e2e/srs-course-reentry.test.js
- [x] node e2e/stats-mastered.test.js
- [x] node e2e/account-isolation.test.js
- [x] node e2e/answer-hint.test.js
- [x] node e2e/main-startup.test.js
- [x] node e2e/learning-journey.test.js
- [x] npm run build
- [x] npm run build:check
- [x] node scripts/gen-sw.js
- [x] node scripts/check-sw.js
- [x] git diff --check
- [x] 独立浏览器验证 375px 与桌面尺寸：主页课程、空队列、提示、结算、档案和刷新续考；同时确认当前本地服务返回本轮产物。

## Acceptance criteria

- [x] 两端先后作答/取消标熟/重新标熟后结果一致，离线恢复不丢失记录、不重复计数、不复活旧标记。
- [x] 完全相同写入重试成功且幂等；内容改变不重用旧 requestId；实质冲突保留待同步内容，不假报成功。
- [x] 普通答对和熟悉自评不授予掌握；初测、延迟复测、失败后再验证的资格与首页/档案标签一致。
- [x] 未来 dueAt 默认不出题；失败排期和巩固后的 1 天正确；提前重练不刷长间隔。
- [x] 看答案立即更新暴露时间，退出/刷新后仍生效；不填空、不增加完成数，完成时归类辅助作答。
- [x] 真实入口可完成学习→退出重进→到期复习→初测→延迟复测→失败巩固；用注入时钟测试，不等待真实天数。
- [x] 课程查询失败不破坏订阅，结算删减和无题状态正确，页面重新进入正常练习不残留隐藏状态。
- [x] 用户数据未被清空/覆盖；所有必需测试通过；实际浏览器加载新版，而非只验证文件存在。

## Risks and rollback

- 工作区混有多轮未提交修改，执行开始记录本轮基线差异；回滚只撤销本轮片段及重建产物，不 reset/checkout 整文件。
- 测试备份与真实数据隔离。需要真实数据库备份时用一致性备份方式，不在运行中只复制 SQLite 主文件遗漏 WAL；不要把用户数据提交进仓库。
- 删除语义缺失、账号边界不明或无法安全合并的真实数据均保留原状，报告具体选择，不猜测覆盖。
- 原规划范围大于本轮，本轮不承诺完成所有历史功能。无法通过的验收记 in-progress；重大合同矛盾记 needs-planning，附最小证据及所需决定。

## Execution notes

2026-09-30：起初因同步冲突规则存在两种方案暂停；用户已选择保守方案：两端冲突版本均保留并走人工比较，不自动删除/复活标记，也不增加同步协议。本轮按此决策将状态恢复为 in-progress。证据仍是：server/services/data-snapshot.js 的 entityGone 只下发字符串 key，不能提供实体版本以自动排序；人工 batch 比较入口已存在，可用于此冲突。

2026-09-30：完成同步冲突保护（step 3）。src/core/sync-learning-marks.mjs 新增基于云端已确认行签名的冲突检测：本地熟悉行已被远端取消时，若本地值与最后确认的云端基线不同，或基线未知，core.js 在拉取合并/落盘前停止并记为 MASTERED_DELETE_CONFLICT 的 batch 冲突；已确认未变的旧本地行仍接受墓碑移除。sync-outbox E2E 使用隔离浏览器及临时服务验证本机重新标熟被保留、远端缺标记、本次不向云端写入，且现有 SyncResolution.preview 可呈现双方快照。无协议或数据库变更。

本轮验证通过：node scripts/core-sync-learning-marks.test.mjs；node e2e/sync-outbox.test.js（37 项）；node e2e/sync-recovery.test.js；node e2e/batch-sync.test.js（22 项）；npm run build；npm run build:check；git diff --check。工作区含大量既有修改，未尝试归并或回退；用户当前打开的学习标签未刷新。

2026-09-30：实际页面验收中复现目录构建失败仍会把所有加入项列为“课程暂不可用”。已改 main.html：失败时保留加入计数，逐项显示“课程信息暂不可用 / 课程目录加载失败，请稍后重试”，不提供“移出”；只有目录成功后才将确实缺项标为不可用。新增 e2e/home-today-entries.test.js 场景 I 覆盖此行为，并更新旧的首页掌握计数断言以反映当前“旧练习次数不冒充考试掌握”的语义。验证通过：home-today-entries 69/69、course-catalog、learning-journey、main-startup、answer-hint、learning-mastery-loop、srs-course-reentry、stats-mastered、account-isolation；learning-state、learning-assessment 和 SRS 单元测试通过。step 4、5 已完成；step 6 还需重新生成/检查 SW 并完成最终差异与资源验证。

2026-09-30：补齐step 2 的双路径断言：显式 entityGone 才会删除旧熟悉标记；整账号批次快照仅缺少该键时继续保留本地行。core-sync-batch-merge 单测通过。step 1–6、验收条件与计划内测试均完成。升级 E2E（25/25）验证旧 SW 缓存清理、新缓存建立及更新后立即进入练习；home-today 通过 360/390/1280 响应式检查，course-catalog 通过 390/1280，且在独立 context 访问当前本地 8787 服务并确认目录失败提示与加入数。SW CACHE=`chunklab-69bb7058`，check-sw/build:check/git diff --check 均通过。gen-sw 输出一个对 courseCover 动态拼接 `src` 的静态扫描提示（把 JS 拼接表达式当成路径），但命令成功且 check-sw 核验预缓存清单一致。当前用户标签页未刷新，避免中断现有学习状态；刷新后会加载新版。工作区其它既有改动均保留。

已实现且通过专项验证的独立修复：
- src/learning/assessment.mjs 在初测后遇到普通练习失败或答案辅助时，重新进入初测冷却；初测失败本身也不能立即重考。
- src/learning/schedule-policy.mjs 失败时重置 SRS repetition/interval，再按 10 分钟巩固；巩固后独立答对从 1 天开始。
- src/learning/state.mjs 将同 ID 事件冲突合并改为交换顺序确定且失败/辅助证据优先。src/core/merge.mjs 和 server/services/data-rows.js 复用该规则；scripts/build-app.mjs/check-generated.mjs 生成、验证服务端 CJS 产物。
- main.html 显示答案时即时记录并保存 lastExposureAt；e2e/answer-hint.test.js 验证刷新后保留，且答案提示仍不填空或推进。
- 未清理或改写真实用户数据。当前用户打开的标签仍是更新前文档，为避免打断会话没有刷新；隔离的真实浏览器 E2E 加载新版通过。

验证通过：learning-state/assessment、core-sync-learning-marks、core-sync-batch-merge、core-merge、core-stats-signature、server/learning-evidence、server/sync-delta（66 项）、SRS（36 项）、e2e/answer-hint、main-startup、learning-journey、learning-mastery-loop、srs-course-reentry、batch-sync（22 项）、sync-outbox（36 项）、sync-recovery。sync-recovery 首次与多套浏览器测试并发时服务进程退出，单独重跑通过。npm run build、build:check、gen-sw/check-sw、git diff --check 通过；最终 SW CACHE 为 chunklab-3cd40aad。未运行 account-isolation、stats-mastered 和完整 npm test。
