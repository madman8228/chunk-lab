# 单词课程完成统计与教材上线准备：规划执行交接

- Status: implementation-complete; broader acceptance pending
- Status authority: M1 technical acceptance is tracked in `2026-10-20-project-review-and-learning-record-closure.md`; visual/content review and the separately scoped release work remain pending. The unchecked criteria below are intentionally not treated as user acceptance.
- Updated: 2026-10-20
- Branch/worktree: `master` / `D:/06-project/chunk-practice`
- Base commit: `7dc9bd0e738d5734c3adba2a54a72ef10f9c525d`
- Relevant uncommitted changes: 本地已有大量产品实现与素材。`server/services/vocabulary-study-operations.js`、`server/services/vocabulary-archive.js`、`js/stats-vocabulary.js`、`src/vocabulary-study/`目前为未跟踪内容，不能将其当作可丢弃临时文件；已有 implementation 文档也须保留。执行前重新核对相关差异，不重置工作区。
- Planner: GPT-6 Astra（用户已确认在主任务中选择；工具未独立读取型号）
- Executor: GPT-5.6 Luna
- 执行授权：用户于 2026-10-20 回复“继续执行”，开始实施本文件 Scope；不包含公开发布、真实账号导入或部署。

## Objective

交付一个有明确终点的结果：用户在真实 Web 产品入口中完成单词课程练习后，能在课程详情和学习记录中看到可信的课程级进展；跳过、重复作答、离线补交、账号切换和个人课程追加单元都不导致误报。用成人六词及隔离的教材型双单元夹具验证，不以制作更多素材代替产品验收。

这次不是“完成所有历史规划”。本交付完成后，下一阶段才处理公开教材同课程追加发布；个人零基础教学编排继续暂缓。历史 goal 是否恢复由用户控制，本文件不改变其状态，也不宣称旧总目标完成。

## Current state and evidence

| 已核对位置 | 当前事实 | 对实施的影响 |
| --- | --- | --- |
| `server/services/vocabulary-study-operations.js` | skip 和 complete 都推进游标；末尾状态均可为 completed | 游标只表示位置，绝不能作为课程完成依据 |
| 同文件的完成事件写入 | 有 item/content/practice 等信息；缺少明确的 bookRevision、sessionId；structureRevision 使用当前目标值 | 新完成事件需保留实际提交版本；不得用最新版本冒充离线旧版 |
| 同文件的 vocabularyStudySummary | 按 resource_id 去重 item_id，混合版本与练习方式 | 保留兼容，不把它直接改名为已完成课程数 |
| `server/services/vocabulary-archive.js`、`server/routes/learning-archive.js` | 已有认证后的概览、完成事件、错误提交查询 | 在此边界增加只读课程汇总，不在前端重新推算事实 |
| `js/stats-vocabulary.js` | 已有 owner/generation 请求隔离、失败状态、分页；嵌入统计页 | 必须保持账号隔离，接入真正的 `main.html?view=stats` |
| `server/services/personal-wordbooks.js` | 保存各版本 package；历史版本仅允许完整前缀式追加；续学有投影 | 可验证旧版完成与新版剩余，不需要复制或重写学习事件 |
| `server/services/wordbook-publisher.js`、`vocabulary-content.js` | 公开发布重复 bookId 被拒绝；发布目录按 bookId 固定；读取器无公开历史版本选择 | 不能只放开 409 就声称支持教材追加；本阶段不改公开版本机制 |
| `js/wordbook-draft.js`、`js/vocabulary-course-contract.js` | 素材、项目、单元与练习方式已有合同；book revision 由项目引用生成，structureRevision 独立 | 不添加任意必修任务配置，不扩展课程包 schema 来解决本阶段统计 |
| `server/services/personal-wordbooks.js`、`vocabulary-teaching-content.js` | 个人教学计划 v2 保存/预学习链仍有明确拒绝 | 普通单词课程不应被这条未完链路绑住 |
| `src/wordbook-authoring/textbook-profile.mjs` | 教材身份辅助逻辑存在 | 辅助测试通过不等于真实教材制作、添加、发布已经验收 |

审查边界：这是关键链路评估，不是全仓每行代码、安全性、所有设备和真实线上服务的完整审计。前轮三个定向测试通过不能替代本次实现后的复测；历史 checks/unit 报告曾为 200/216，不得宣传全仓全绿。

### 名词解释与方向校正

- 原始材料：单词词义、例句、图片、音频、对话等可复用内容。
- 课程编排：把材料选入哪门课、哪个单元、按什么顺序学习；保留这一层是必要的。
- 教学编排：认识词→短语→句子等教学步骤；这是可选教学能力，不是每门单词课上线前必须建设的平台。
- 草稿合同：程序对草稿格式、引用和版本的校验规则，不是面向用户的“合同”或新的功能入口。用户界面使用“制作稿”“内容检查”等正常语言。
- 学习方式：听写、选词、拼块、句子练习等；不把每种方式再复制成一套材料库。
- 学习记录：由服务器确认的事实；课程完成是这些事实的汇总，不能由界面翻页产生。

## Assumptions and decisions

### 1. 本次完成口径：课程练习覆盖，不是独立掌握

当前课程尚无经过审批的必修任务清单，因此采用最小、明确且不改课程包的口径，命名为 `practice-coverage-v1`：

1. 一个课程版本中的每个项目，至少有一次服务器校验成功的 `vocabulary.complete`，才算该项目已完成练习。
2. 有效方式包括 sentence-cloze、guided-expression、word-choice、chunk-order、word-dictation；任一有效方式可满足该项目，不要求用户把五种方式全部练一遍。
3. 同一项目用多个方式练习，课程进度仍只增加一个项目；各方式的完成次数仍保留在现有记录中。
4. start/pause/skip、浏览教学卡、播放音频、错误 attempt、仅正确的中间 attempt、read-aloud 自报，都不满足课程完成条件。
5. 课程所有项目满足条件，显示“已完成练习”，不显示“已掌握”。空课程不能自动判为完成。
6. 完成数按账号、bookId 去重。课程版本历史可有多条，但不重复算作多门课程。

这是本方案建议的产品默认值，而非声称用户此前已经批准了必修规则。用户若要求“必须做完指定方式才算完成”，应先修订本文件及课程合同方案，不能由 Luna 临场添加必修任务系统。

### 2. 旧记录诚实保留

- 缺少明确课程版本的旧事件仍展示为历史练习，保留原始数据；本次不回填、删除或猜测其 bookRevision。
- 严格课程完成汇总只使用可以核对归属、版本及项目引用的证据。不足时显示“旧记录未完整纳入”，不能把“无法核实”显示成“从未学过”。
- 旧记录可以单独报告数量，但不能被当前版本完成率暗中吸收。新版本记录可靠后，也不篡改旧记录。
- 完成次数是练习次数，课程数是去重课程数，两者分别显示。

### 3. 同课追加与旧版历史

- 个人课程沿用现有严格追加能力，不改变 bookId，也不修改旧项目或旧单元。
- 同一 bookId 的旧版证据仅在历史包存在、属于同一账号、并被现有 `historicalBook` 校验为当前完整前缀时，允许计入当前版未变化项目的覆盖。
- 新版增加项目后，旧版仍“已完成练习”；当前版显示“新增内容待学”，进度为旧覆盖数/新总数。
- 不把其他课程的同一单词、同一图片、甚至同一 itemId 的事件借来完成当前课；resourceId 必须先匹配。
- 当前版的新事件不反向补记为旧版完成。旧版完成时间仅由该版或其已证实前缀版本的有效事件推导。
- 同 book revision 但结构版本不同的历史包不能无条件混用单元归属；以 `(bookRevision, structureRevision)` 核对。不能唯一解析则标记不可核实，保留记录。

### 4. 教材与成人课共用现有机制

教材型课程只是有明确教材身份和单元结构的单词课程，不另建学习引擎。此次使用人工构造且明确标识“测试夹具”的两单元内容，验证相同链路；不把它冒充真实教材，不要求用户先批准一套真实教材才能完成软件测试。

### 5. 更简单方案与取舍

- 不采用“前端把游标 6/6 显示为完成”：它会把跳过当完成，是数据口径错误。
- 不新增完整课程完成事件表或迁移旧库：当前可利用已有不可变事件和个人版本包，按需只读汇总，减少双写和恢复成本。
- 不合并句子练习与单词学习的底层记录表；本次只增加单词课程统计，现有句子统计不变。
- 不同时做公开更新、个人教学 v2、课程编辑器改版：这些不是本次统计正确性的必要依赖。

## Scope

- 新完成事件补齐版本、会话证据。
- 服务器课程级只读汇总及认证 API。
- 单词课程详情显示该课进展；学习记录显示课程完成概览、列表及历史版本。
- 新旧记录区分、同账号同课追加兼容、离线与重试去重、账号隔离。
- 成人六词和双单元教材型夹具的真实 Web 集成验收。
- 输出后续公开教材上线的依赖清单，不执行真实发布。

## Out of scope

- 不修改首页布局、首页导航、已有课程内容或整站风格。
- 不生成新图片、音频或真实教材内容；不审定教材来源权利。
- 不实现公开同课升级、修改已发布项目、跨课程知识掌握迁移。
- 不实现个人教学计划 v2、零基础正式教学播放器、通用答案提示。
- 不增加麦克风评分、独立掌握算法、连续打卡、学时估算或排行榜。
- 不清理历史数据、不迁移真实账号、不重启/切换真实服务、不部署、提交或推送。

## Contracts and data changes

### A. 完成事件（只增字段，不改表）

在 `server/services/vocabulary-study-operations.js` 现有完成校验和事务内，为新写入的 data_json 增加：

```text
evidenceVersion: 2
bookRevision: p.bookRevision
sessionId: p.sessionId
structureRevision: submittedBook.structureRevision || null
unitId: p.unitId || null
```

保留现有 practiceType、practiceRevision、inputMode、answers、assisted、音频哈希。这里 structureRevision 指提交课程的结构，即使整课练习没有携带 unitId，也从已校验的 submittedBook 获取；不能使用已经追加后的 latest。

resource_id 与 content_revision 继续使用现有列。requestId 幂等规则、事务、旧回执、同步序列、备份恢复不变。失败校验不得留下半条事件；无需客户端新增可伪造的 completed 标志。

### B. 服务边界

新增 `server/services/vocabulary-course-progress.js`，仅负责查询和纯聚合，由 archive 服务调用。

- 提供 `course(userId, bookId)` 与 `courses(userId, {offset,limit})`。
- 查询始终带 user_id；resource_id 精确匹配 `wordbook:` + bookId。
- 候选课程来自本账号完成事件、attempt 事件、跟读自报和 vocabularyResume 中出现的 bookId，不扫描公共目录把所有未学课程都加进统计。没有记录的已添加课程可由详情单课查询返回零进展。
- 候选列表去重，排序按最近服务端学习时间降序、bookId 升序；分页 limit 1–100、offset 非负整数。
- 对每门课一次读取其事件集合，按项目及版本建立内存映射，不按每个词查询数据库；只加载课程清单/版本引用，不读取或预缓存所有图片、音频、完整教学项目。
- 公共课程使用 content.book 当前不可变版本；个人版本通过 personal 服务新增只读 `versions(id,owner)` 返回去重的课程清单，禁止把 package_json、材料源、审核回执直接返回浏览器。
- 个人版本解析、追加前缀校验集中在 personal 服务，复用原校验，不在统计模块复制一套放宽规则。
- 单课不可读取或版本不匹配不使全部课程列表崩溃；该行标记 unavailable，进度为 null，不算零分，也不计入已核实完成总数。

### C. 聚合算法

1. 按账号和 resourceId 获取完成事件，解析可用的新证据；缺少证据字段的事件累计为 legacyEventCount。
2. 对目标版本构建 `(itemId, contentRevision)` 集合。
3. 只接受版本精确匹配，或已验证的同课前缀版本；检查事件中的 item/content 引用确实属于提交版本。
4. 仅认可上述五种有效完成方式。中间 attempt、自报等用于“有活动”判断，不用于覆盖。
5. 每个目标项目取最早有效服务端时间；覆盖数等于去重项目数。
6. 全部覆盖时 completedAt 为各项目最早有效时间的最大值；否则为 null。
7. 单元覆盖由目标版本的 unit.itemIds 切分，无论证据来自整课还是单元练习，均只计对应项目。
8. 当前进展允许继承旧版前缀；历史版本汇总不能使用后继版本事件。
9. 有可核实旧版完成、当前版未完成时，state 为 updated；未核实历史不伪造已完成旧版。
10. 汇总课程数按 bookId 去重，不按 session、mode、unit 或 revision 相加。

状态：`not-started | in-progress | completed | updated | unverified | unavailable`。
有旧证据但无可核实新覆盖时用 unverified；既有可靠部分覆盖又有旧证据时用 in-progress，并通过 evidence 字段提示旧记录缺口。

### D. HTTP 接口

在 `server/routes/learning-archive.js` 增加认证 GET：

```text
/api/learning-archive/vocabulary/courses?offset=0&limit=20
/api/learning-archive/vocabulary/courses?bookId=<encoded id>
```

bookId 单课查询不与分页参数混用；参数异常 400，未登录 401，无权访问个人课程与不存在均 404。服务器内部错误 500，不暴露存储路径。错误处理保持现有风格，但新增单课 404 不包装成成功零进度。

列表响应：

```text
confirmed: true
policy: "practice-coverage-v1"
totals:
  currentCompletedCourses  // 当前版已完成的去重课程数
  everCompletedCourses    // 任一可核实版本曾完成的去重课程数
  updatedCourses
  unverifiedCourses
  unavailableCourses
items: CourseProgress[]
nextOffset: number | null
```

单课响应 `{confirmed:true, policy, course:CourseProgress}`。

```text
CourseProgress:
  bookId, title, bookRevision, structureRevision
  state, totalItems, completedItems, completedAt, lastActivityAt
  evidence: "verified" | "partial-history" | "unavailable"
  legacyEventCount
  units: [{unitId,title,totalItems,completedItems,state}]
  completedVersions: [{bookRevision,structureRevision,totalItems,completedAt}]
```

缺失内容的相关数值返回 null，不能返回误导性 0。completedVersions 只含可核实完成版本；同一版本包重复保存不生成重复历史项。列表 totals 对该账号全部候选课程计算，不只统计当前页。历史旧记录不全时，UI用“已核实”限定计数。

### E. Web 呈现

- `landing/wordbook-details.js`：在标题/操作附近增加一行紧凑进展，“已完成练习 4 / 6 词”；完整覆盖显示“已完成练习”。追加后显示“新增内容待学 · 6 / 8 词”。历史版本在可展开区域中显示，不挤占学习区。
- 无登录保留原有内容浏览；统计认证失败不能破坏课程详情。草稿只读预览不请求不存在的正式账号进度，不暗中保存课程。
- `js/stats-vocabulary.js`：在 overview 单词区域增加“课程练习”汇总与课程列表，当前完成和历史完成分开表述；每行链接课程详情。统计解释放折叠说明，不在答题卡添加长提示。
- 请求维持 account owner、sessionEpoch、API base 和 generation 隔离。详情页也必须在退出/换账号时清掉旧统计，丢弃迟到响应。
- 首次请求失败显示“暂无法读取”及重试；同账号刷新失败可以显示注明“上次记录”的缓存；不能用缓存冒充本次确认或跨账号复用。
- 离线待上传不增加服务器完成课程数；显示现有待同步状态，补交成功后刷新统计。
- 通过 `scripts/build-stats-page.cjs` 更新生成文件 `js/stats-page.js`，不手改生成文件、不改 main 首页结构。

## Implementation steps

- [x] **1. 固定执行基线。** 核对 AGENTS、交接全文、HEAD 与相关文件；保留了已有大量 dirty / untracked 工作区内容，不重置或覆盖课程数据。
- [x] **2. 统计合同测试。** 新增 `server/services/vocabulary-course-progress.test.js`，验证游标/跳过不计完成、个人同课追加、版本覆盖、多方式去重、单元聚合、旧版缺少证据不误计、账号隔离、只读性及 10,000 项规模。
- [x] **3. 新事件证据。** 新完成事件附加 evidenceVersion、课程/结构版本与 sessionId；既有记录不回写，单测断言新字段。
- [x] **4. 只读聚合及接口。** 新增 course-progress 服务与认证 API；为避免重复 HTTP harness，认证、参数、分页、归属隔离扩展在现有 `server/learning-archive-http.test.js`，没有另建计划中的 `vocabulary-course-progress-http.test.js`。
- [x] **5. 课程详情与统计页。** 详情显示已核实进度及失败重试；统计列表链接到课程详情并标示完成/新增/分数。统计页由现有构建器生成，首页结构未改。
- [x] **6. 真实 Web 验收。** 新增 `e2e/vocabulary-course-progress.test.cjs`，用隔离账号与实例走课程导入保存、详情进度、单元学习、统计页、全跳过排除、详情接口失败后重试；已有产品 E2E 另验请求重放和账号切换。
- [x] **7. 教材兼容验收。** 双单元夹具实际保存后逐单元练习；3/6 不误报全课完成，6/6 才完成，所有测试课程均为临时夹具。
- [x] **8. 构建与回归。** 统计 UI、归档路由、学习事件、恢复/重放、教材资料链路、生成一致性和离线预算均通过定向检查；完整 npm 全量测试未运行，避免触发项目内容重建及受污染的全仓基线。
- [x] **9. 交付与停止。** 执行记录、隔离报告目录、未部署状态和人工审查清单已写入本文件；未推进公开发布或个人教学 v2。

## Validation

### 安全前提

所有持久化、备份、恢复、浏览器测试均分配新的临时数据目录和独立空闲端口。浏览器使用测试 profile，不操作用户原页面的真实记录。读取测试脚本确认目标隔离后再运行。禁止用 `server/data` 或用户课程归档目录。

### 定向命令

以下从仓库根执行；新增测试需按上文建立。每条记录退出码、实际测试数量及报告位置，跳过不是通过。

```powershell
node --test server/services/vocabulary-course-progress.test.js server/services/vocabulary-archive.test.js
node --test server/vocabulary-course-progress-http.test.js server/vocabulary-study.test.js server/vocabulary-attempt-http.test.js
node --test server/personal-wordbook-materials.test.js server/wordbook-publishing.test.js src/wordbook-authoring/textbook-profile.test.mjs
node scripts/build-stats-page.cjs
node scripts/check-generated.mjs
node scripts/stats-page.test.cjs
node scripts/sw-install-budget.test.cjs
node e2e/vocabulary-course-progress.test.cjs
node e2e/personal-material-authoring.test.cjs
node e2e/vocabulary-attempt.test.cjs
node e2e/wordbook-product-acceptance.test.cjs
```

若生成一致性报告需要更新静态资产清单，只运行对应生成器并核对差异，不执行会重建真实课程的全量 pretest。不要直接 `npm test`：当前 pretest 包含内容生成步骤。新增测试命名遵循 `scripts/test-manifest.cjs` 自动发现规则；核对已登记而非重复登记。

### 必须具备的测试矩阵

| 场景 | 必须证明 |
| --- | --- |
| 6词全部跳过 | 游标可到末尾，但课程覆盖0，不产生完成版本 |
| 5词完成+1词跳过 | 5/6，补齐缺词后6/6 |
| 各种方式交替 | 任一有效完成覆盖对应项目；同词多方式不多计 |
| 错误、提示、中间正确、跟读自报 | 不误增课程完成数；现有错误历史仍完整 |
| 重发同requestId、离线重放、并发 | 已确认事件不重复计数；重放不污染最新续学位置 |
| 旧记录缺bookRevision | 原记录仍能看；严格统计不猜归属，明确缺口 |
| 6词完成后追加2词 | 旧版完成保留，当前6/8；补齐后当前完成，仍只是一门课 |
| 新版事件与旧版历史 | 不反向伪造旧版完成；旧版延迟补交不越权推进新版游标 |
| 两课共享材料/词义 | A的完成不计入B；共享媒体不变 |
| 教材两单元 | 单元进展相加为整课去重覆盖，局部完成不算整课完成 |
| 账号切换与迟到请求 | 不出现另一账号课程、标题、进度及完成时间 |
| 内容丢失/版本无法核对 | 有明确不可用状态，其他课程仍可查询 |
| 重启/恢复到新空环境 | 只靠原事件与版本包重建相同统计，无临时内存依赖 |
| 页面与数据库核账 | Web当前完成数、历史完成数、单位、时间和原始事件一致 |
| 窄屏/桌面 | 375px及925px下可读无横向溢出，无散乱新增按钮 |
| 10000项目规模夹具 | 不逐词发HTTP/SQL，不加载媒体库；记录耗时和查询次数，保留现有资源预算 |

## Acceptance criteria

- [ ] 用户能从实际课程详情进入学习，再进入真正的学习记录页看到对应课程进展。
- [ ] 全跳过不是完成；重复与多方式不增加完成课程数。
- [ ] 完成练习与掌握、跟读自报、浏览记录分开，不使用“已掌握”误导。
- [ ] 个人同课追加后，旧版本完成事实与新版待学项目同时正确呈现。
- [ ] 旧数据不删、不改、不猜补；无法核实的旧统计有明确限定。
- [ ] 原有句子学习、首页、课程添加和五方式答题没有被此次范围外重设计。
- [ ] 认证隔离、离线重放、服务重启/隔离恢复、分页及失败态都有证据。
- [ ] 成人六词与教材型双单元的实际 Web 验收通过；提供可复现的测试结果。
- [ ] 标明哪些测试没跑、哪些历史失败未解决；不将局部通过描述为全仓通过。
- [ ] 提供用户人工审查清单，但不把自动化通过写成用户已认可视觉或已批准课程发布。

## Risks and rollback

1. **历史不完整：** 严格统计可能少于用户过去实际学习量。优先诚实保留旧记录并解释“已核实”，不伪造版本。精确历史补全需要另行评估证据和授权。
2. **聚合性能：** 首版使用现有 `(user_id,resource_id,item_id)` 索引及一次性分组；不持久化第二份事实。若规模测试证明不可接受，记录具体耗时/查询证据并将状态设 needs-planning，不能悄悄增加新账本或迁移真实库。
3. **版本资料缺失：** 展示 unavailable，不删除历史，不回退猜测最新内容。公开版本升级留待独立阶段设计。
4. **工作区重叠：** 任何相关文件在交接后发生实质变化，先小范围比对。只有合同冲突才 needs-planning，不要求重新审整个项目。
5. **回退：** 产品回退仅撤销本轮明确记录的代码补丁或关闭新增展示，保留新增事件字段、原始课程及全部记录；禁止用 git reset --hard 或整库快照覆盖非空账号。部署回退需另获授权。
6. **真实迁移：** 本计划无真实迁移。未来需要时，必须指定账号与数据库、SQLite一致性备份、验证恢复、独立试演，再经用户授权执行。

## 后续路线：不属于本次 Luna 自动执行范围

| 顺序 | 工作 | 开始条件与完成边界 |
| --- | --- | --- |
| 1 | 用户审查成人课真实Web流程 | 本交付技术验收通过；用户看添加入口、详情、操作和记录，不只审素材图 |
| 2 | 确定第一套教材的发布范围 | 用户指定准确教材身份、已审单元和一次全包/分批追加。未确定不代选，不自动发布 |
| 3 | 若需分批：公开同课程追加版本 | 独立规划不可变版本目录、原子当前指针、旧内容解析、缓存失效、离线兼容、回滚及审核指纹；不简单删除重复ID检查 |
| 4 | 一套真实教材试点 | 使用 textbook-wordbook-course 技能检查源页、词条、素材预算和审批；隔离预览验收后另行取得真实发布授权 |
| 5 | 批量教材上线 | 首套通过后按相同清单生产；不能用多发内容替代质量检查 |
| 6 | 个人零基础正式教学 | 用户明确优先级后再贯通教学计划v2保存、个人预学习、阶段记录；不影响已经可用的普通单词课程 |

课程材料、教学任务、课程组织、学习方式、学习证据仍分层。后续材料导入可以服务不同课程，但课程完成统计始终留在各自课程身份和版本内。

## Execution notes

- 2026-10-20：规划阶段只写文档，没有触及产品代码、课程内容或账号记录。用户回复“继续执行”后进入实施阶段。
- 用户已两次确认选择 Astra，无需再询问规划模型。
- 执行前由用户切换 Luna 并回复“继续执行”。Luna按本文件到技术验收边界结束，不自动扩展到公开发布或个人教学v2。
- 当前页面14601来自浏览器上下文，不作为服务存活证据。交付预览必须验证实际健康状态并报告真实端口，不覆盖或搬迁原测试账号。
- 人工审批仍待用户：成人内容、图片语义、来源权利、当前UI；不因音频某版本曾认可而扩大审批范围。
- 2026-10-20 实施完成：新完成事件保存 `evidenceVersion=2`、提交的 `bookRevision` / `structureRevision`、`sessionId`；新增只读课程进度聚合与认证接口 `GET /api/learning-archive/vocabulary/courses`。统计口径为 `practice-coverage-v1`：五种经服务器确认的答题完成任一覆盖该词；重复方式不重复计数；skip、attempt 与跟读自报不算完成；已核验新版完成不会被未核实旧行降级，但整体 `evidence` 会标为 `partial-history`。
- 2026-10-20 真实 Web 双单元验收通过：`node e2e/vocabulary-course-progress.test.cjs`，隔离实例 `C:\Users\Administrator\AppData\Local\Temp\wordbook-acceptance-sIxQur`；服务关闭、临时数据保留供复查。实际添加成人六词夹具、查看 3/6、单元二补齐到 6/6、统计页课程链接、全跳过 0/6，以及课程详情统计请求失败后的重试均通过。既有完整成人课程产品验收通过：`node e2e/wordbook-product-acceptance.test.cjs`，报告 `output/playwright/wordbook-product-1792460966294`。
- 人工预览：独立临时验收服务 `http://127.0.0.1:6979/acceptance`，健康响应 HTTP 200；临时数据 `C:\Users\Administrator\AppData\Local\Temp\wordbook-acceptance-Ubvv7C`，仅合成账号/课程。服务保持运行供本次审查，结束后可停止该临时进程；不要把它当真实用户库或生产站点。
- 定向验证通过：`node --test server/services/vocabulary-course-progress.test.js server/services/vocabulary-archive.test.js server/vocabulary-study.test.js server/learning-archive-http.test.js server/vocabulary-attempt-http.test.js`（5/5）；`node --test scripts/stats-page.test.cjs scripts/learning-archive-ui.test.cjs`（4/4）；`node --test server/personal-wordbook-materials.test.js server/wordbook-publishing.test.js src/wordbook-authoring/textbook-profile.test.mjs`（3/3）；`node e2e/personal-material-authoring.test.cjs`、`node e2e/vocabulary-attempt.test.cjs`、`node scripts/check-generated.mjs`、`node scripts/sw-install-budget.test.cjs` 均通过。聚合 10,000 项夹具最近一次用时约 4ms；不触碰媒体文件。所有持久化验收使用独立临时实例/数据库/端口。
- 一处边界修正已回归：课程已具备完整当前版本证据、同时存在无法核对版本的旧事件时，当前课程仍显示“已完成练习”，并标记 `partial-history`；原始历史事件保持不变。
- 交付状态：本轮代码/自动化验收完成；**未部署、未重启或切换 live 服务、未改写真实课程/学习记录**。浏览器里曾打开的 `127.0.0.1:14601` 不作为本轮预览服务证明；验收地址为 harness 临时实例且已关闭。
- 仍需用户人工审核：课程详情/学习记录的视觉与文案是否符合预期、成人六词实际呈现和材料质量、具体教材来源/内容授权。公开教材同课追加发布与个人教学计划 v2 仍是后续独立工作，不在本轮完成范围内。未运行 `npm test`；历史全仓基线 200/216 不在本轮处理，不能据此声称全仓全绿。
