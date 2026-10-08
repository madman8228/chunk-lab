# 错题证据与用户自有 AI：分析、针对性练习及回导

- Status: completed (no commit or deployment)
- Updated: 2026-09-28
- Branch/worktree: master；D:\06-project\chunk-practice，沿用当前工作区
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22。工作区大量未提交修改；相关文件 main.html、stats.html、core.js、src/core/sync-delta.mjs、src/main/practice-state.mjs 的周边模块、构建脚本和测试已有修改；src/course-authoring/、course-create.html、assets/course-create.css、js/course-authoring.js 及多份实施文档尚未跟踪。实施前重新检查相关差异，保留全部现有工作，不重置、不整文件覆盖。
- Planner: GPT-6 Astra（用户已确认选择）
- Executor: GPT-5.6 Luna

## Objective

交付一个可实际使用的闭环：在错题本选择有价值的错误证据，复制数据和指令到用户自己的 AI，获得解释或生成针对性句子练习；生成练习可经现有制作工作台校验、预览、保存、加入学习，并保留原错题来源。英语讲解主要发生在外部 AI 对话中。

本方案已完成实施与针对性验收。本次沿用当前工作区，未提交或部署；全部工作区改动均保留。

## Current state and evidence

- 仓库及 D:\、D:\06-project 父级未发现 AGENTS.md；现有 PRODUCT.md 描述中文英语学习者、少干扰界面、桌面和手机使用场景。
- stats.html 的 renderWrongBook 展示原句、翻译和 mistakes 的错误表达→目标表达；按数组逆序显示，支持“全部/需巩固”。尚无选择、复制 AI 指令或练习制作入口。
- main.html 的 saveReinforceList 以 deck.id + sentence 去重，仅首次插入；后续错误被忽略。完成句子时和结算时均调用，新增历史记录必须幂等。临时复习队列必须通过 statDeckId(it) 取得真实源课程，不能以 book-/srs-/#wrong 等临时 deck.id 作为来源。
- src/main/practice-state.mjs 的 buildSentenceOutcome 输出 wrongEntry，包含 wrongAnswers、needsReview，但未持久化逐次模式/时间/提示证据；shouldRecord 目前还按 item 对象去重。main.html 已有 S.wrongAttempts、S.wrongAnswers、S.hinted、S._hintedChunks、effectivePracticeMode() 等可用事实。
- mem.stats.bySentence 按 deckId#cid 记录 times/okTimes/wrongTimes/streak/lastAt/dueAt 等。现代记录已移除 sentence；stats.html 的 reinforceNeedsReview 仍按 st.sentence 匹配且优先返回历史 needsReview，会出现匹配不到新统计或历史状态长期不更新的问题。
- src/core/entity-delta.mjs 的 sigReinforceRow 仅使用 addedAt 和 sentence，不能识别新增历史。src/core/sync-learning-marks.mjs 及 core.js 的合并/兜底路径对重复 _key 保留单侧条目；src/core/merge.mjs 三路合并也需支持同一错题的历史合并。server/services/data-rows.js 的 reinforce 行直接覆盖 JSON。
- src/course-authoring/service.mjs 已提供 open/createPrompt/copyPrompt/acceptText/save/join；账号隔离会话存于 BrowserAuthoringSessionRepository，并有 ResilientSessionRepository 内存降级。controller.mjs 从 URL session 打开会话。
- draft-spec.mjs 的 AiCourseDraft 1.1 支持 1–50 条句子、chunks/hints、typing/chunkSelection 及 item.explanation。sentence-adapter.mjs 把 explanation 映射为原生 explain。Schema 禁止额外字段；不能让 AI 自行添加错题关联字段。
- ExistingCourseGateway.saveSentenceCourse 复用 CL.saveAndNotify；现有课程已能原生练习。server/services/data-writers.js 的课程行明确保存 items_json，因此来源关联要有 item.authoring 层的持久化载体，不能只依赖本地草稿或未经验证的顶层课程附加字段。

## Assumptions and decisions

1. 用户自有 AI 是分析和内容生成执行方；网站负责证据整理、指令、数据校验及练习。复制/下载由用户点击触发，无模型 API 调用、无自动外发。
2. 首版覆盖句子课程错题，含输入和意群选择；图文故事答题证据、多模态材料以后扩展。
3. 先交付证据记录和外部 AI 流程，不扩大为自动诊断系统、排行榜或完整效果仪表盘。
4. 两种任务：“帮我理解”产出自然语言对话；“帮我练会”先依据证据分析、确认缺失的难度/篇幅，再输出 AiCourseDraft 1.1。可有针对性解释和新场景迁移句子，练习玩法仍是已支持的两种。
5. 不把系统目标答案视为绝对正确。提示词须检查合理替代表达、语境和意群拆分；区分输入失误、选项误点、提示揭示、知识混淆，证据不足须标明假设。
6. 旧错误记录只能作为历史快照，不伪造次数、时间、模式或重复错误轨迹；累计答题统计与保留的错误样本是两种口径。
7. 来源关联首版为练习课程级的一组原错题引用，不声称逐个新句子对应单个弱点，不更改现有 AI JSON Schema。新练习成绩不写入原题统计；原题复测才更新原题掌握状态。

## Scope

- 新错误持续采集、兼容旧错题、幂等与有界历史、必要的同步合并修复。
- 错题本单句/多句/当前筛选范围选取，证据预览、两种指令、复制与下载回退。
- 与现有 AI 制作工作台共享会话与服务，在该会话内导入、校验、保存、启动针对性练习。
- 来源关联和原错题复测入口；只显示确实发生的原题复测表现。
- 必要的单元、同步、浏览器端到端验证与构建接线。

## Out of scope

- 站内大模型调用、API Key、自动打开或控制外部 AI、自动发送内容。
- 自动修正原课程答案、自动接受 AI 诊断、自动标熟或清空错题。
- 新练习引擎、图文针对性课程、AI 自定义任意 JSON 格式、跨账号材料共享。
- 精确语言能力评分、因果效果结论、推断用户人格/认知特征、全站 UI 改版。
- Git 提交、推送、部署及新建独立任务。

## Contracts and data changes

### 1. 错题证据行：兼容扩展 reinforceBook

保留原有 _key、deckId、sentence、translation、chunks、hints、grammar、addedAt、mistakes、needsReview，新增 evidenceVersion:1、cid（能解析时）、updatedAt、history[]、historyTruncated。现有 _key 不强制迁移；新条目继续以真实 deckId::sentence 建立兼容键。

每个 history 事件：eventId、at（毫秒或旧记录 null）、mode（typing/chunkSelection/unknown）、hinted（boolean/null）、revealed（boolean/null）、needsReview、mistakes[]。每个 mistake 保存 chunkIdx、目标 chunk、wrongAnswers:string[]、wrongAttemptCount:number|null、hintUsed:boolean|null。计数是此意群本次提交中的错误尝试数，不是整句练习次数。

- 在开始一次题目作答时生成稳定的 attemptId；同一次完成/结算重复保存携带同一 eventId，再次正式作答才生成新 ID。buildSentenceOutcome 和调用方按该 ID 判断，不再因同一 item 对象阻止另一轮记录。
- 旧行转换为一个确定性的 legacy 事件（ID 从旧键及原始快照稳定产生）。userAnswer 中的 ` / ` 不拆成多次事件；原串保留为一个旧快照字符串，模式/提示/精确时间未知。合法可解析时间才使用；没有时为 null。
- 每句保留最近 20 个事件；单事件最多 20 个意群、每意群最多 10 个错误表达、每个表达最多 500 字符；被截断须带标记。仍最多 200 条错题，按最近真实错误时间保留；未知时间最后。不能将保留数当成累计错误次数。
- 顶层 mistakes/needsReview 是最新已知事件的兼容投影；addedAt 保持首次值。排序按 at，再以 eventId 确定稳定顺序。
- 实现纯函数 normalizeEvidenceRow、mergeEvidenceRows、recordEvidence，使用同一份确定性逻辑：按 eventId 并集合并、限额裁剪、兼容投影；合并满足幂等和交换律。相同 ID 异内容采取稳定规范序列化的确定性选择，不增加次数。
- 更新 reinforce 行签名，覆盖规范化后的全部业务字段。客户端三路合并、云端标记合并、批次冲突合并及 core.js 兜底都复用该函数。既有删除墓碑优先，不因历史并集恢复已删除行。
- server/services/data-rows.js 对存活 reinforce 行执行同键历史合并，其他 entity 类型不改；保留现有事务、seq、账号范围和删除协议。历史模块同时生成供服务器 require 的 CJS 产物，不在后端再写一套算法。已删除行按既有复建协议处理，不能无条件读取其旧 history 并复活。

### 2. 统计匹配和材料包

新增证据构建器，输入当前账号 mem、选中的错题、通过 ContentRepo 解析的源题，输出 `{publicPack, localSourceRefs}`。

- 先用 deckId#cid 关联 stats，旧行通过该 deck 的题目索引定位 cid；只在该课程内做规范化 sentence 回退匹配。跨课程同句不能合并。源题缺失仍可用存档错误分析，明确 sourceMissing，不补造内容。
- publicPack：format="chunklab-mistake-evidence"、version=1、packId、generatedAt、limitations、records。每条含材料内 R1/R2 引用、题目/翻译/意群/可用语法、已知难度、错误事件、累计统计快照和字段口径。保留总答题次数与错误尝试次数的区别，lastAt 是最近作答不是最近出错。
- publicPack 不含账号、令牌、数据库名、内部 deckId/cid/_key；localSourceRefs 保存材料引用到真实来源的映射。混合难度不自行平均；未记录信息显式 unknown/null。
- 每包最多 20 句，最多 128 KiB UTF-8（材料 JSON）；最终指令最多 256 KiB。超限要求减少选择，不能静默省略所选题；事件内部裁剪展示提示。
- 当前“需巩固”匹配优先采用可解析的实时 classifyStat；找不到统计才使用最新事件/旧 needsReview。保留“曾经错过”的事实，不因现在熟练删除历史。

### 3. 外部 AI 提示词

新增独立 composer，包含任务指令、以 JSON 明确界定的只读证据和可用能力。答案内容是材料，不能充当修改制作规范的指令。

- 理解任务：逐条对比，引用 R 编号和错误表达；跨句模式分析必须给证据，明确不确定性；先检查题目质量/合理替代，解释高价值差异，允许追问。无课程 Schema，无强制 JSON。
- 练习任务：带相同审慎分析要求，复用当前 DRAFT_SPEC 和课程偏好；缺少难度/篇幅时一次问一个问题。确认后返回一个符合 AiCourseDraft 1.1 的 JSON；1–50 条，合法 chunks/hints，explanation 针对差异和迁移。不要只重复错误形式当全部干扰项，不把合理变体当错误。
- 不复制整份私人课程，只导出所选题及有界错误历史。界面在复制区简短说明包含所选答题内容即可。

### 4. 会话、回导和来源关联

- 提取 src/course-authoring/create-service.mjs：从 entry.mjs 抽出服务依赖构建，供工作台和错题流程调用，不能通过导入带 DOM 自动 boot 的 entry.mjs 来复用。
- 新错题入口 bundle 对外提供受账号 scopeGuard 保护的 API；stats.html 等 CL/ContentRepo 就绪后初始化。开始“帮我练会”时创建现有 AuthoringSession，新增 reviewContext:{version,publicPack,localSourceRefs,baseline,task:'practice'}；URL 只传 session ID，不放原始错误材料。
- 工作台以“根据 N 道错题制作练习”的简短来源摘要打开。课程形式限制句子课程，偏好、复制/下载、粘贴 JSON、修复指令、预览、保存、加入学习沿用现有流程。createPrompt 根据 reviewContext 分派 composer，brief 不承载大段材料（其上限仅 1200 字）。
- 保存会话成功后才导航；内存降级不能跨页面传失效 ID：留在 stats 页展示/下载指令并明确草稿未保存，持久化恢复后可重试。
- 保存课程时由本地会话注入可信 reviewSource:{version:1,packId,createdAt,sourceRefs,baseline}，AI 返回字段不能覆盖。course.authoring 可投影同一关联；每条 item.authoring.reviewSource 必须保留最小 packId/sourceRefs/createdAt，使现有 items_json 持久化及备份恢复能保留关联。证据全文和账号标识不复制进课程。
- 普通导出课程 JSON 继续满足原 Schema；不把私人错误证据加入分享文件。通过原会话导入时具有关联，脱离会话普通导入则明确为普通课程，不猜测来源。
- 错题页的内联 AI 面板可展示当前范围关联的已保存练习及“开始练习”“复测原句”。按 sourceRefs 从真实课程解析复测队列，沿用 launchReviewItems/withStatsSource；找不到的源题列明跳过数，全部缺失时不能启动空队列。练习关联从当前账号课程 items 中派生，不能要求本地制作草稿永远存在。
- 新课程答题只增加新课程自己的 stats。baseline 与当前原题统计可显示“原题新增练习次数/当前状态”，不渲染尚未实现的改善率或归因结论。

## Implementation steps

- [x] 1. 核对相关未提交改动并记录基线；新增 evidence、材料包、提示词模块及纯函数测试，沿用删除协议与 scopeGuard。
- [ ] 2. 接通 main.html 与 src/main/practice-state.mjs：真实来源、作答 ID、提示/揭示/模式证据、再次作答更新、完成与结算幂等。只持久化原来应记录的错误/提示事件，正常作答累计仍由现有统计负责。
- [ ] 3. 接通 src/core/entity-delta.mjs、sync-learning-marks.mjs、merge.mjs、core.js 对应及兜底路径，server/services/data-rows.js 的存活行合并。新增专门测试覆盖签名更新、同键双端事件、墓碑及旧客户端旧快照上传不抹掉新 history。
- [ ] 4. stats.html 加复选框和每行轻量“用我的 AI”入口；工具栏显示已选数及“选择当前筛选结果”（跨页但最多 20 句，超限不擅自选前 20）。切换筛选清除选择并通知；同筛选翻页保留选择，外部刷新移除失效键。AI 操作区在列表上方内联展开，提供“帮我理解/帮我练会”、材料预览、复制/下载、折叠。删除按钮与复选框独立，键盘可操作；空选择禁用批量入口。
- [ ] 5. 新增 src/mistake-review/ui-controller.mjs、entry.mjs 及浏览器入口/构建产物；与 stats.html 实际接线。复用 BrowserIO，复制失败展示可手动复制的文本，下载不自动导航；长材料面板手机可滚动，不遮住页签或列表。
- [ ] 6. 抽取 course-authoring/create-service.mjs，扩展 session/service/prompt/controller/view；reviewContext 用已有版本控制和账号隔离持久化，普通创作流程照常运行。修复 JSON、返回设置、再次预览都保留来源，不允许切成图文课程。
- [ ] 7. 课程保存注入 reviewSource，新增材料范围的已生成练习展示及原题复测入口。通过现有 ContentRepo 定位并按需 hydrate 来源，不能依赖 CL.allDecks 中一定已载入全部原句。
- [ ] 8. 更新 scripts/build-app.mjs、build-course-authoring.mjs、check-generated.mjs 接入新 bundle 与后端 CJS 合并产物，使用 scripts/gen-sw.js 更新缓存清单。测试命名遵守 *.test.mjs/*.test.js，scripts/test-manifest.cjs 会自动发现。不手工修改生成 JS。
- [ ] 9. 完成下列验收，将结果和实际文件写入 Execution notes，达到边界后停止。

## Validation

在独立测试数据库和浏览器上下文验证，不修改用户现有题目、统计或发布课程。

- [ ] 新增并运行 `node --test src/mistake-review/mistake-review.test.mjs`：旧快照、事件幂等/并集/裁剪、真实来源、统计匹配、unknown、选包限额、提示词证据与 Schema、文本中含指令/XSS 样本作为纯数据处理。
- [ ] `node scripts/main-practice-state.test.mjs`；`node scripts/core-entity-delta.test.js`；`node scripts/core-sync-learning-marks.test.mjs`；`node scripts/core-merge.test.js`。
- [ ] 新增并运行 `node server/mistake-evidence.test.js`：同账号同键并发事件并集、旧快照兼容、删除不复活、不同账号隔离，快照读回一致。
- [ ] `node src/course-authoring/course-authoring.test.mjs`，补充 reviewContext 全生命周期、复制失败、重复保存、回退修复、账号切换用例。
- [ ] `npm run build`、`npm run build:check`；若生成器因基线其他模块失败，定位记录原有失败与本次影响，不为过检查修改无关功能。
- [ ] 新增并运行 `node e2e/mistake-review-own-ai.test.js`，测试支持 CHROMIUM_PATH；Windows 可用 `$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'`。用两个独立错题及重复错误驱动真实答题→stats 选择→复制文本→制作会话→粘贴合格 AI fixture→校验保存→原生启动→新课程统计→复测原句。外部 AI 本身用 fixture 模拟，无网络调用模型。
- [ ] `node e2e/ai-course-authoring.test.js`、`node e2e/stats-mastered.test.js`。仅在本次新增失败/相关风险未关闭时扩展回归。
- [ ] 一次合并视觉核验：818px 和 390px；单句、多选、跨页、空列表、材料超限、源题缺失、剪贴板拒绝、JSON 错误、存储失败；检查焦点/展开/滚动/选择范围说明和实际页面入口。
- [ ] `git diff --check`，仅修复本次引入的差异问题；核对无用户数据、账号令牌或测试产物写入交付文件。

## Acceptance criteria

- [ ] 同一句不同次答错均可保留证据；同一次完成及结算不会重复；旧错题仍能看和复习，未知数据有明确口径。
- [ ] 新证据修改能触发行级同步；双端不同事件不会按同键去重丢失；删除及账号隔离保持原语义。
- [ ] 错题页实际支持单句、选择几句、当前筛选结果生成指令，所选集合与导出的材料完全一致；复制失败有可用回退。
- [ ] 提示词含真实错误及相关上下文，允许合理替代答案/题目有误，分析必须引用证据；绝不把片段累计尝试数当成整句失败次数。
- [ ] “帮我理解”能直接用于外部 AI 对话；“帮我练会”有带材料的制作会话及规范，合格返回可在页面真实导入、保存、启动，不止独立模块测试。
- [ ] 练习保存幂等，解释进入现有 explain 显示路径，真实来源可在刷新及服务端读回后定位；导出分享不包含原始错误证据。
- [ ] 练习成绩和原题成绩各归其源；有明确的原题复测入口，未复测不宣称原错题已掌握。
- [ ] 普通 AI 制作、现有错题练习、SRS、列表删除/筛选和移动端展开不退化。

## Risks and rollback

- 最大风险为同步：签名、客户端合并和服务器存活行写入必须同时交付。删除墓碑/账号范围不能被新并集合并绕过；若与现有协议存在实质矛盾，记录确切路径并改为 needs-planning，不自行更换同步架构。
- 历史有界且旧数据不完整，AI 指令和预览要展示这一限制。错误答案可能是正确变体，不能据此自动更改用户掌握状态。
- 并发编辑范围大；依赖已有未提交的 authoring 代码，不要求先提交。回退只撤销本任务差异，严禁 git reset/整文件还原。
- 如需停用新入口，隐藏 stats AI 区即可保留已有阅读/复习；新增字段保持兼容，回退 UI 不删除已保存证据。同步增强不应与 UI 一并盲目回退，以免旧写入抹掉新历史。
- 现有服务端来源元数据通道需用往返测试证明；以 item.authoring.reviewSource 为最低持久化保证，缺失时不得显示虚假来源关联。

## Execution notes

- 2026-09-28：规划完成。代码检查为只读，唯一新增文件为本交接文档。用户已确认规划阶段选择 GPT-6 Astra。
- 2026-09-28：按用户“继续执行”进入实施。先保留现存改动；本阶段仍未提交或部署。
- 2026-09-28：完成事件证据采集、旧行兼容、幂等合并、同步签名和客户端/服务器端历史并集；补充按真实错误时间保留最近 200 条的裁剪规则。主练习仍只在正式答错时记录错误事件，同次结算重复保存不会重复计数。
- 2026-09-28：完成错题页跨页多选（最多 20 题）、材料预览、外部 AI“帮我理解/帮我练会”提示词复制/下载、账号隔离制作会话、Schema 校验与普通制作工作台复用；保存后按可信来源元数据展示关联练习，并可启动关联练习或原题复测。题目答案和用户材料均不自动发送到 AI。
- 2026-09-28：UI 控件继续放在 stats.html，与错题列表筛选/选择/刷新状态共用；制作服务复用独立 `create-service.mjs`。未额外拆单独 UI-controller 文件，以免重复引入一层 DOM 状态同步。
- 2026-09-28：纠正主构建脚本仍生成 AI kit 1.0、而校验要求 1.1 的不一致；构建和生成物校验现一致通过。更新普通 AI 制作浏览器回归夹具至当前 Schema，并同步检查自定义练习方式下拉框和异步课程启动。
- 2026-09-28 验收通过：`node --test src/mistake-review/evidence.test.mjs src/mistake-review/evidence-pack.test.mjs scripts/main-practice-state.test.mjs scripts/core-entity-delta.test.js scripts/core-sync-learning-marks.test.mjs scripts/core-sync-batch-merge.test.mjs scripts/core-merge.test.js src/course-authoring/course-authoring.test.mjs server/mistake-evidence.test.js`（23 项）；`node e2e/mistake-review-own-ai.test.js`（真实答错→材料选择/复制→制作/校验/保存→来源回查→原题复测，另检查 390px 布局和 200 条裁剪）；`node e2e/ai-course-authoring.test.js`；`node e2e/stats-mastered.test.js`；`npm run lint:course-authoring`；`npm run typecheck`；`npm run build`；`node scripts/gen-sw.js`；`npm run build:check`；`git diff --check`。
- 2026-09-28 验收限制：`gen-sw` 保留仓库已有动态 HTML 资源拼接静态扫描提示（字面量 `' + escX(src) + '`），脚本仍完成生成且 `build:check` 通过。无全量 `npm test`，本次执行的是直接相关的 23 项单测与 3 条浏览器流程；没有部署或触碰真实用户数据。
