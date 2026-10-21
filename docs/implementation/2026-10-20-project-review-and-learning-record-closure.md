# 项目系统审查与下一阶段：学习记录闭环

- Status: complete
- Updated: 2026-10-20
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: 7dc9bd0e738d5734c3adba2a54a72ef10f9c525d；审查时 git status 共 5782 条记录，包含大量未跟踪代码、课程和素材。HEAD 不能代表完整交付状态。执行前重新核对相关文件，禁止清理工作区。
- Planner: GPT-6 Astra（用户已确认选择；工具不能独立读取主模型）
- Executor: GPT-5.6 Luna

## Objective

系统审查的结论：材料、课程编排、学习方式、学习事实分层的方向正确，不需要推倒重建。当前主要问题是各层能力已有，但用户可见闭环、版本交付和验收证据未完全收口。

下一次只交付一个有界成果：用户从实际产品学习后，进入学习记录，能看到及时、可追溯到正确课程的进度与完成历史；同名课程不混淆，超过一页不漏显示，失败不显示成零。由自动化完成数据核对，不要求用户反复答题对账。

本文件包含整体路线图，但 ready-for-luna 只授权执行下文 M1，不代表所有后续阶段已批准实施或课程已批准发布。

## Current state and evidence

### 审查范围与证据等级

本轮为产品边界、关键实现路径、测试组织和历史交付文档的静态系统审查，不是逐行审完全部源码、全仓测试通过或生产安全认证。没有启动测试服务、操作真实账号、重启 6979、清理浏览器或重跑完整测试。历史测试通过记录不能替代新版本验收。

| 层级 | 已有基础与证据 | 结论/剩余边界 |
| --- | --- | --- |
| 产品入口 | PRODUCT.md、docs/design/system-context-2026-10-13.md；main、learning-workspace、个人创作模块 | 单词和句子是并列工具，首页/我的内容/发现/记录有分工；保持首页不变，不新造平行系统 |
| 材料与课程 | vocabulary-material-library、personal-wordbooks、vocabulary-content 服务 | 复用材料的方向成立；教学编排是选词、单元顺序和活动引用，不是第三套单词数据；“合同”仅指开发数据约束，不应成为普通用户操作 |
| 个人创作保存 | server/services/personal-wordbooks.js | 账号隔离、追加版本、历史校验与旧内容前缀保护已有；不能把个人保存等同公共发布 |
| 学习与统计 | server/services/vocabulary-course-progress.js、vocabulary-archive.js、landing/wordbook-details.js、js/stats-vocabulary.js | 课程覆盖证据、同课版本历史、认证 API 已有；展示与刷新仍缺闭环，见下表 |
| 同步与恢复 | src/core/sync-replay.mjs；server/services/recovery-ingest.js；server/backup-db.js | 有账号作用域检查、确认后清队列、冲突停止、事务空账号恢复和一致性快照；本轮未验证全部异常组合或真实备份可恢复性 |
| 公共发布 | server/services/wordbook-publisher.js、server/routes/wordbook-publishing.js | 管理员校验/指纹确认/独占锁/新目录发布已有；同 bookId 已存在拒绝覆盖。公共课程追加版本不能靠删除冲突检查实现 |
| 教材资产 | docs/architecture/grade9-unit1-unit2-preservation-2026-10-15.md | 历史调查记录 Unit1 40词、Unit2 59词、原账号与一致性备份及公共候选；这是已存在资产，不能再次当成从零选题，也不能据旧文断言今天已上架 |
| 教材生产 | docs/textbook-admin-drafts-2026-10-17.md | 高中三册草稿入口已有，文档明确教学例句/练习审核、正式编译和学习预览未闭环；配图审核不等于内容发布审批 |
| 零基础教学 | server/services/vocabulary-teaching-content.js | personal-book 预学习显式拒绝 422；基础三词演示不等于正式零基础课程产品 |
| 会员/统一内容交付 | docs/implementation/2026-10-14-membership-entitlements-and-trial.md、2026-10-15-unified-static-course-delivery.md | 有大量局部实现和隔离验证，仍有来源完整认证、启用/异常/性能交付边界；前者头部 needs-planning 与续记 in-progress 不一致，需按后续证据核对，不能仅看状态头 |
| 构建与测试 | package.json、scripts/test-manifest.cjs、scripts/run-tests.cjs | npm test 的前置步骤会生成内容；测试发现递归扫描仓库，分组依赖名称。不能未经隔离审查就把全量命令当成安全只读检查 |

### 明确发现

1. **P1：课程进度缓存不随已确认变更失效。** js/stats-vocabulary.js 的 invalidate 只标记 summary/events；coursesPhase ready 后不再自动请求。focus、server-cache-applied 可刷新概览数字却留下旧课程进度。根因在前端读取生命周期，不应改后端事实或要求用户清缓存。
2. **P2：课程列表最多显示首 100 条。** loadCourses 固定 limit=100，渲染不消费课程 nextOffset；后端已提供分页。应补列表续读，不改成无限量接口。
3. **P2：记录缺少课程关联展示。** events/attempts 返回 resourceId，但界面仅显示练习、词条、结果和时间。同名草稿/个人副本的练习无法在界面定位来源。课程身份必须按 resourceId/bookId，不可按标题猜或合并。
4. **P2：历史完成事实未接入用户界面。** 服务端返回 completedVersions 和 currentCompletedCourses/everCompletedCourses；js/src 中没有对应消费。详情只显示当前进度/新增待学。用户无法同时看到“旧版本完成”和“新增仍待学”。
5. **交付治理缺口（本轮已修正文档状态）：** 2026-10-20-course-completion-and-textbook-delivery.md 原标 complete，但 Acceptance criteria 仍全部未勾选。M2 已将其状态澄清为“implementation-complete; broader acceptance pending”，保留未勾选项；本文件的 M1 验收为学习记录技术闭环的权威状态，不能据此宣称教材上线或全体路线图完成。

### 风险而非已证实故障

- courses() 为所有相关课程聚合后再分页，且逐课查询历史。现有单课万词测试不能证明多课程、多版本、大量事件的延迟可接受；后续容量阶段测量后再决定索引或聚合优化，当前不凭猜测建缓存表。
- 当前 6979 验收实例与最新工作区不是同一版本交付承诺；源码修改不等于该页面已升级。
- 大量未提交文件及被忽略的课程原件意味着“有 Git”不等于“可恢复”。需代码清单与课程/数据库备份各自验证。

## Assumptions and decisions

- 继续保持服务端已确认事实为依据，进度含义是练习覆盖而非掌握；浏览、跳过、跟读自报不擅自纳入完成。
- 不改变课程身份，不按同名合并个人副本与公共/草稿课程；不追溯补写旧事件。
- 本次采用已有归档 API + 现有界面的小范围补齐。比建立新统计系统、迁移学习表或重做首页简单且风险低。
- 记录所属课程元数据由服务端按当前账号解析；前端不逐行额外请求所有课程、不用标题猜归属。
- 保留原文档历史状态，本文件是后续收口计划，不改写过去的验收事实。

## Scope

M1：学习记录刷新、课程分页、事件课程归属、旧版本完成事实展示，以及真实 main.html?view=stats 到详情的自动验收。

允许修改文件：js/stats-vocabulary.js、landing/wordbook-details.js、server/services/vocabulary-archive.js；对应的 server/services/vocabulary-archive.test.js、server/learning-archive-http.test.js、scripts/learning-archive-ui.test.cjs、scripts/archive-refresh-stability.test.cjs、e2e/vocabulary-course-progress.test.cjs。必要时仅局部修改 assets/learning-archive.css；js/stats-page.js 只经 scripts/build-stats-page.cjs 生成。更新本文件执行证据。

## Out of scope

首页改版、练习引擎重写、掌握测评、指定词复习、语音质量验收、批量课程素材制作、教材正式上架、公共课程版本迁移、会员策略启用、全仓重构。不得改真实数据库/课程/备份，不部署、不提交推送、不切换当前服务。后续路线图不是本次自动续做清单。

## Contracts and data changes

### 读取生命周期

- 为课程列表引入与 summary/events 一致的 dirty/请求世代和账号作用域保护。确认变更、focus、显式刷新后使课程数据失效；可见 overview 才发请求，其他标签延迟读取。
- 失效发生在请求中时，旧响应不能清除新失效状态；需要取消采纳旧世代并安排一次新请求，不能丢刷新，也不能形成渲染请求循环。
- 账号/base/sessionEpoch 变化立即清除旧账号结果；同账号刷新失败可保留旧结果并标记未更新，首读失败显示重试，均不得替换为零。
- whenReady 包含课程在途请求，测试等待明确状态，不依赖随意延时。

### 分页

- 继续消费 /api/learning-archive/vocabulary/courses 的 offset/limit/nextOffset。首次20条；“加载更多课程”显式读取下一页，按 bookId 去重。
- 刷新重新从第一页开始，不拼接旧排序下的页。失败保留已有结果和可重试位置；账号切换拒绝旧页响应。动态排序不承诺事务快照，完整刷新取得最新顺序。

### 记录课程归属（只读、兼容扩展）

- events 与 attempts 的每行增加 course 对象或 null：{bookId,title,available}。仅精确解析 wordbook: 前缀的 resourceId，使用 content.book(bookId,userId)；每次请求内按 bookId 缓存，避免同页重复解析。
- 无法读取课程时保留记录，course={bookId,title:null,available:false}；旧 pilot/null resourceId 返回 null。不返回其他账号的标题或内容，不因一条不可用课程使整页丢失。
- 界面显示课程来源短标签与可点击标题，链接使用编码后的精确 bookId。不可用课程显示“课程暂不可用”并保留词条/时间；不能猜标题。来源标签仅指技术来源，不代表审核状态。标题相同时不合并；课程同名仍可通过链接和来源识别。
- 无表结构变化、无写请求、无历史记录回填。

### 完成历史

- 概览用已有 totals 展示“当前已完成练习 N 门”；历史完成是另一个指标，不能相加。缺字段显示不可用而非零。
- 详情当前进度旁增加默认折叠的“已完成版本”列表，读取 completedVersions，显示完成时间、当时词数及简短版本标识；当前仍显示新增待学数量/进度。无历史时不显示空区块。
- 不推导公共历史：公共内容服务只提供当前版本，按已有接口事实显示，不捏造已删除或未保存版本。

## Implementation steps

- [x] 1. 核对本文件、AGENTS 与相关文件变更；记录执行基线，不重置任何已有修改。执行开始时确认 HEAD 为 `7dc9bd0e738d5734c3adba2a54a72ef10f9c525d`；本次涉及文件均为已有 untracked 文件，未发现 staged/tracked diff；保留全部文件原样后在其上按本计划作增量修改。
- [x] 2. 为课程失效/迟到响应/分页补失败测试，再修改 stats-vocabulary 的读取生命周期。覆盖同账号更新、切账号、失效发生在请求中、失败重试；页面返回刷新复用可见性恢复及同一生命周期检查。
- [x] 3. 为 archive events/attempts 补 course 兼容字段及服务/HTTP 测试；覆盖同标题不同ID、账号不可读/缺失课程、旧 pilot、同页重复课程只解析一次。
- [x] 4. 接入记录课程链接、课程列表分页、概览完成数、详情历史折叠区；未改首页或添加长说明。
- [x] 5. 生成 stats-page；扩展真实产品 E2E，从隔离产品入口进入学习/统计/详情，核对课程身份、进度及完成历史。
- [x] 6. 在新临时数据目录及隔离端口执行下列定向检查，记录结果及实例位置。没有使用真实数据库/6979 服务。

## Validation

所有持久化测试先检查 harness 使用新临时目录；禁止指向 server/data、6979 的数据目录或课程归档。不得通过清库解决测试失败。以下为执行阶段命令，不是本轮已通过的结果。

- [x] `node server/services/vocabulary-archive.test.js` — passed; owner/read-only contract, exact course IDs, duplicate lookup cache, unavailable history.
- [x] `node server/services/vocabulary-course-progress.test.js` — passed; append history and 10,000-item projection.
- [x] `node server/learning-archive-http.test.js` — passed; auth, owner visibility, unavailable course retained, pagination bounds.
- [x] `node scripts/build-stats-page.cjs` — passed; generated archive module.
- [x] `node scripts/learning-archive-ui.test.cjs` — passed; synthetic 101-course pagination, source distinction, refresh and totals, responsive layout.
- [x] `node scripts/archive-refresh-stability.test.cjs` — passed; stale request cannot replace refreshed progress; prior confirmed records and account isolation retained.
- [x] `node scripts/stats-page.test.cjs` — 3/3 passed.
- [x] `node e2e/vocabulary-course-progress.test.cjs` — passed from isolated product flow; temporary instance `C:\Users\Administrator\AppData\Local\Temp\wordbook-acceptance-F2H4Ic`.
- [x] `node e2e/wordbook-product-acceptance.test.cjs` — passed; report `output/playwright/wordbook-product-1792473970148`.
- [x] `node scripts/check-generated.mjs` — generated output matches source.

新增场景必须包含：101门合成课程分页；同标题课程独立链接/事件；3/3完成后合法追加成3/6，旧版完成仍可见；重复同词/多方式不重复覆盖；跳过不完成；当前账号请求迟到后切账号；读取失败保留已确认数据；925/390宽度不溢出。使用合成数据，不读取真实学习记录作测试夹具。测试若触发其他生成器，先限定影响；不得借机重建真实课程。

## Acceptance criteria

- [x] 从真实 main 学习记录入口返回后，课程读取在确认刷新/页面恢复时重取；迟到旧响应不能覆盖新数据。
- [x] 第101门课程通过续读可找到；续读按 bookId 去重且失败保留续读位置与重试入口。
- [x] 完成记录显示精确课程链接；相同标题使用不同身份，账号不能读取的课程保留为不可用历史行。
- [x] 概览显示后端当前/曾完成门数；详情展示可核实的完成版本，当前新增待学状态仍独立。
- [x] 切账号清除旧内容；课程请求竞态测试通过。
- [x] 产品主入口 E2E、服务端合同、UI、生成一致性均有本轮证据。
- [x] 首页、原学习记录和真实课程未被改动；本次仅隔离验证，6979 在线服务未更新或重启。
- [x] 无须用户重复作答核账；仅仍可自愿检查统计标签是否易懂。

## 后续路线图（M1完成后逐阶段确认）

| 顺序 | 交付目标 | 完成门槛与边界 |
| --- | --- | --- |
| M2 发布与恢复基线 | 固定实际候选版本、构建文件和安全测试清单；梳理重复/过期状态文档；隔离验证升级、离线重放、重启与恢复 | 代码版本+静态资产+数据库/素材备份清单可对应，隔离恢复成功；明确历史失败、未测内容和运行版本。不清理5782条修改，不擅自部署 |
| M3 已有教材首批上线准备 | 优先核对已有九年级Unit1/2当前草稿、原身份、来源、内容与图片审核；走实际公开目录→详情→学习→记录 | 只读重新确认现状，保留个人副本和原资产；课程内容/权利/交付校验明确通过，用户批准具体课程和发布目标后才实际上架。高中三册单独列内容制作缺口，不混作已完成 |
| M4 公共课程追加更新 | 在有明确教材追加需求时设计不可变公共版本和稳定课程身份，保留旧学习事实 | 独立计划版本读取、原词不可变/追加规则、失败回滚、旧学习链接与历史进度；不能覆盖现有发布目录或将追加伪装成另一门课 |
| M5 正式零基础课程 | 明确认识词→理解短语→句子教学的内容与活动边界，补个人教学v2完整保存/学习/记录 | 三词示例继续作为示例；正式课程需内容审查和独立端到端验收，不因演示可点就宣布上线 |
| M6 规模与上线门槛 | 多课程/多版本/大事件量压测，统一静态交付剩余认证与会员异常验证，随后集中页面打磨 | 按实测定位后端聚合/资源读取成本；不先建新缓存层。会员/收费启用独立授权，不必阻塞免费教材内容准备 |

指定词复习、应用掌握测评、逐日趋势是独立功能需求；目前存在未接入提示，不能靠隐藏提示冒充实现。音频质量/录音验证按用户此前要求暂缓，恢复时单列验收。视觉问题若阻止学习或造成误解在对应阶段修，否则集中打磨，不无限插入主线。

## Risks and rollback

- 最大风险是同一文件已有他人/用户变更和多个运行快照。只修改允许范围；发现合同冲突标 needs-planning，记录具体证据，不重新扩展全项目审查。
- 本次无迁移。回退仅撤销执行者新增代码块并重新生成对应统计产物，不能 git reset/checkout 整文件，不得回退数据库或课程包。
- 已有备份记录只证明当时备份存在；M2需验证恢复，真实迁移前仍需针对确切数据库/账号制作新一致性备份并取得授权。
- M1解决读取和可追溯性，不保证大规模聚合延迟或所有既有模块无缺陷；这些保留为明确后续门槛。

## Execution notes

- 2026-10-20 规划阶段：只新增本文件，没有修改产品代码，没有运行验证清单，没有动真实数据、在线服务或课程素材。
- 2026-10-20 执行阶段：修改 `js/stats-vocabulary.js`、`landing/wordbook-details.js`、`server/services/vocabulary-archive.js` 及其服务/HTTP/UI/E2E测试；由 `scripts/build-stats-page.cjs` 生成 `js/stats-page.js`。明细记录由服务端按账号解析精确 `wordbook:` 身份；不可读来源保留原事件；统计页加入课程分页、当前/历史总数、课程关联链接和刷新竞态保护；详情展示完成版本。无数据库结构变化、没有写入或回填学习事件。
- 本轮检查：上列命令均通过；`scripts/learning-archive-ui.test.cjs` 与 `scripts/archive-refresh-stability.test.cjs` 最终版本均通过，后者涵盖从明细标签切回概览、页面隐藏再恢复、请求竞态和失败保留。课程专项E2E使用新临时数据目录及自动分配端口，隔离实例路径已列出。产品综合验收生成独立报告目录 `output/playwright/wordbook-product-1792473970148`。测试输出和临时数据按项目规则保留。
- 限制：未跑全仓 `npm test`（其 pretest 会生成项目内容），未做生产部署/重启；当前 6979 页面仍是原运行版本。多课程高事件量性能、指定词复习、应用掌握测评、零基础正式课程、教材发布及公共课程追加更新属于路线图后续项，不在 M1 验收范围。
