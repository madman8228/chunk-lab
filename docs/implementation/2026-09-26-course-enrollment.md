# 我的课程：显式加入学习

- Status: complete
- Updated: 2026-09-26
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22；main.html、core.js、decks.html 相关依赖、服务端同步与多份测试涉及现有工作；git status 显示大量未提交修改，执行前核对 diff 并保留。首页性能方案已完成，本方案不得恢复逐课节复制课程包的旧路径。
- Planner: Astra planning phase（不声称工具已确认当前型号）
- Executor: GPT-5.6 Luna

## Objective

用户明确选择加入后，整门课程才进入首页“我的课程”。交付加入、加入并开始、移出、首页课程级展示、离线保存、多设备同步、账号隔离及浏览器闭环测试。

## Current state and evidence

- main.html renderHome 以 activeDeckId、best.lastPlayed 或 !deck.builtin 推导首页归属；startDeck 打开即写 lastPlayed，导入也写 lastPlayed。因此浏览/导入被误作加入学习。
- decks.html 旧列表将非 builtin 题库叫“我的课程”，与首页口径不同；课程目录已有 CourseCatalog 建模。
- js/course-catalog.js：内置目录可使用 manifest.catalog 的 course.id；legacy 内置 ID 为 builtin:oral / builtin:idioms；用户句子课为 user-deck:<deck.id>；图文逻辑课程取 definition.id，否则 package-course:<catalogKey> 或包级课程。ownerByContentRef 可解析课节所属课程，不得使用展示名称作为新身份。
- core.js readProgress/writeProgress 已接入课程状态内存桥及 IDB，独立于 mem.progress（句子游标）。js/idb.js 的 progress store 和服务端 user_course_progress 按行同步，支持 rev、baseRev、删除标记和账号归属；server/services/data-writers.js 的 upsertCourseProgress 使用 assertRevisionAccepted。
- 当前 SYNC_KV_KEYS 只有 best/stats/settings；直接往 mem 添加 enrolledCourses 会遗漏保存/同步边界。

## Assumptions and decisions

1. 加入单位为 CourseCatalog 的整门课程 ID；课节只表示当前学习位置。内置与导入、句子与图文适用相同规则。
2. 浏览和试学不自动加入。主动作“加入并开始”表示明确加入；提供独立“加入学习”。已加入时显示“开始/继续”和“移出学习”。移出只改变关系，不删除题目、进度或统计。
3. 导入成功先入内容库，提供“加入并开始”，不默认勾选自动加入。导入不再写 lastPlayed；真正开始练习仍可记录 lastPlayed，但不能改变加入状态。
4. 无加入记录就是未加入。旧答题、activeDeckId、导入信息均不自动迁移成加入。历史进度原样保留，再加入后可继续。
5. 不新增数据库表/同步实体；复用 courseProgress 的版本化行传输，新增独立类型和保留键空间表示学习关系。这是存储复用，不将关系嵌入练习进度，也不复用 settings 整块覆盖。
6. 新关系行键：enrollment:v1:<encodeURIComponent(catalogCourseId)>。值仅为 { kind:'course-enrollment', schemaVersion:1, courseId, joined:boolean, joinedAt:number, changedAt:number }；不存标题、课程正文、资源和课节列表。时间用于展示/排序，冲突裁决使用现有版本规则。
7. 移出写 joined:false（保留取消记录），不删除行；再次加入明确写 true 并更新 joinedAt。正常下行不能让低版本旧 true 复活。baseRev 冲突沿用现有冲突处理，不用设备时钟做静默胜负裁决。
8. 前端新增单一 CourseEnrollment 模块，封装读取、课程 ID 映射、加入/移出。所有页面调用它。读取只解析合法 kind/schemaVersion，排除异常记录；写入读取最新 progress map 后只改目标键，进入 CL.writeProgress 既有持久化路径；同页操作串行防覆盖，跨页沿用已有合并/版本保护。
9. 首版不重设计课程 ID。采用目录已产生的 course.id，改标题不改变登记的 ID；同 ID 更新内容保留关系。现有图文 fallback 若因目录元数据变化生成新 ID，不猜测合并：原关系作为暂不可用课程保留，提示重新选择。把这个限制记录进验收。

## Scope

- 新 js/course-enrollment.js：单一领域 API，join(courseId)、leave(courseId)、readMemberships()、isJoined(courseId)，异步写入返回本地持久化结果；依赖注入便于单测。
- main.html：首页根据 joined:true 的课程集合渲染，继续目标限定所属已加入课程；复用每轮目录快照，避免逐课程复制大数据。
- decks.html：整门课程目录/卡片动作，加入、移出、加入并开始；“管理”到课程库；用户导入区标注“已导入”而非自动称“我的课程”。
- course-package.js：检查 readProgress/writeProgress 的往返保留其他键，导入成功操作和图文入口接入。包删除只删除包对应进度，不能清除登记关系或其他课程状态。
- core.js/js/idb.js 仅在复用通道存在实际缺口时做窄修；服务端数据快照、备份、恢复、条件写应通过现有通道承载关系。发现必须增加新同步实体才能成立时停止并记 needs-planning，不自行扩架构。
- 必要测试、静态部署白名单/缓存清单及 sw.js。

## Out of scope

收藏、暂停、归档、计划推荐、独立最近学习列表、强制历史确认弹窗、成绩重算、删除旧课程数据、退出等待云同步、线上部署和课程包协议重写。

## Contracts and data changes

- 新前端模块只能写自己保留键，不能全量重建课程进度。CL.readProgress 返回拷贝的契约不变。
- 检查课程包导入 ID：拒绝以 enrollment:v1: 为前缀的包 ID，保留该空间；旧数据若已存在同名非 enrollment 行，拒绝覆盖并显示可操作错误，不静默转换。
- 加入并开始必须等本地事务成功后导航；离线可加入，云端未完成通过现有同步状态展示。本地写失败不显示成功、不跳页。
- 移出成功后首页立即刷新；若本地失败保持原状态。异步操作结束前发生账号切换，不得将旧账号结果绘入新账号页面。
- 不存在/不可用课程的 joined 关系保留为不可启动条目，可移出；不吞掉用户关系，也不自动绑定同名课程。
- 首页每门课程一行：课程名、当前课节副标题、课程级进度、开始/继续。句子课程聚合沿用 js/course-progress.js；图文用已有包状态计算，不能伪造句子计数。没有可靠总量时显示学习状态。无 joined 课程时显示添加课程入口，即使有历史统计也不补默认课程。
- 首页按已加入课程中最近学习排序，未学过按 joinedAt 排序。上次试学的未加入课程不能抢占继续入口。不新增全局“最近学习”区块。
- 已有 progress 备份恢复应保留登记行；跨设备整库恢复属于用户显式恢复历史，和普通同步不等同，沿用现有预览确认机制。

## Implementation steps

- [x] 核对工作区差异和现有课程库入口；保留 2026-09-26 首页性能改动及工作区其他未提交更改。
- [x] 新增单一 CourseEnrollment 模块及单测：合法关系解析、保留键、幂等加入/移出、写入失败和保留既有 map；真实 IndexedDB 写入与同步通过浏览器/服务端集成验证。
- [x] 验证既有 courseProgress 通道：真实服务端收到了登记行；跨标签页刷新、离线刷新、账号隔离和条件版本并发/旧版本删除防复活均有测试证据。课程包进度按原始课程 ID 保留，包的删除只清理对应原始键。
- [x] decks.html 提供课程级加入、加入并开始、开始/继续、移出；导入区明确标记“已导入”；main.html 导入不再写 lastPlayed，并提供“加入并开始”。
- [x] main.html 首页仅按 joined 关系展示课程，一门目录课程一行；继续目标限定在已加入课程；句子和图文分别用有效进度语义，未知课程关系可见且可移出。
- [x] 账号/跨标签页变更触发刷新；首页每轮仍只读取并构建一次大课程目录，索引批次聚合为一次回绘。
- [x] 更新首页测试为“已加入零练习可见、仅导入不可见”；恢复启动夹具的显式登记，覆盖重新加入保留课程进度。
- [x] 将模块注册到运行页面、部署文件白名单与 Service Worker；生成并校验缓存版本，完成浏览器闭环。

## Validation

浏览器测试用独立临时服务、free-port、临时数据库和浏览器上下文；不要修改正式账号。Windows 可设置 CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe。

- [x] node scripts/course-enrollment.test.js
- [x] node e2e/course-enrollment.test.js（课程卡片、加入/加入并开始、跨标签页、离线刷新、移出/重加、内容进度共存）
- [x] node course-catalog.test.js、node course-progress.test.js
- [x] node e2e/home-today-entries.test.js（53/53）和 node e2e/main-startup.test.js
- [x] node e2e/learning-journey.test.js、node e2e/course-package-import.test.js
- [x] node e2e/home-render-performance.test.js（加入课程夹具；4–5ms，同步目录仍各一次）
- [x] node e2e/account-isolation.test.js（25 项）和 node e2e/batch-sync.test.js（真实登记行上传，22 项）；服务端 batch-version / conditional-required 测试通过
- [x] node scripts/gen-sw.js、node scripts/check-sw.js；新模块已出现在部署白名单。`node scripts/check-deploy-files.js` 仍因本工作区原有的 `content-studio.html`、`server/routes/content-studio.js`、`server/services/content-studio.js` 未列入 FILES 而失败；未将这些无关文件加入本次部署范围。
- [x] 浏览器闭环：句子课、图文课及导入课加入后显示；未加入课程不显示；加入并开始可导航；移出、刷新、重新加入后关系恢复且原课程包进度保留。

## Acceptance criteria

- [x] 首页只显示明确 joined:true 的整门课程；历史进度、activeDeckId、lastPlayed 和导入本身均不自动加入。
- [x] 零答题的已加入课程立即可见；仅导入或试学课程不可见。
- [x] 移出只写 tombstone，不删除题目/练习历史；重复加入不复制内容；重新加入恢复原进度。
- [x] 每门课只有一个关系；句子、图文课程都可加入、开始/继续及移出。
- [x] 离线、刷新、跨标签、账号隔离及版本化同步有测试；通用版本测试确认旧版本不能复活已删除行。
- [x] 运行时模块已注册；本地保存失败不跳转，账户切换由现有持久化通道拒绝旧账号写入。
- [x] 首页每轮最多一次 readCourses/buildCatalog；性能夹具同步渲染约 4–5ms，继续入口包含已登记课程。
- [x] 本轮目标测试均有结果记录；部署清单全量检查的三个失败项属于已有内容工作室变更，已如实记录且不扩展本次范围。

## Risks and rollback

复用 courseProgress 的代价是保留键空间及消费者过滤要求；不能把登记行当作包进度。新增独立实体虽语义更纯，但会扩展所有同步/备份协议，本轮选复用已有按行版本通道并用单独模块封装。主要风险为旧整图写入漏保留登记、课程 ID 变化、账号切换时未决写、课程级进度聚合变慢，测试须覆盖。
回退只撤销本轮界面和模块改动，不删除已写登记行；旧客户端可能重新按旧规则展示课程，不能承诺旧客户端与新产品规则一致。未提交的性能和课程编辑改动必须保留；不提交、不推送、不部署。

## Execution notes

2026-09-26：实现完成。新增 `js/course-enrollment.js`，以 `enrollment:v1:<encoded courseId>` 保存最小关系对象，并复用 `CL.readProgress/writeProgress` 的 IndexedDB + 课程进度版本化同步。加入与退出均只修改对应保留键；句子/故事正文和标题不复制到关系行。`courseId` 保留该前缀的课程包会在导入校验拒绝。

首页从显式登记关系生成课程行，按已加入课程排序；试学和导入不会自动加入。故事进度读取当前课程包的 `seen/completed`，句子课按课程课节汇总；如果目录中找不到已加入 ID，保留为不可用条目供用户移出。大目录读取仍是一轮一次；索引加载聚合为一轮回绘。

验证摘要：CourseEnrollment 单测通过；目录 28/28、进度 12/12、首页 53/53、专用课程加入浏览器闭环通过；课程目录同步页真实上传加入行通过；账号隔离 25 项、batch sync 22 项及服务端版本测试通过；首页性能约 4–5ms，`readCourses/buildCatalog` 每轮一次；SW hash 校验通过。部署全量闭包检查仍报告工作区既有 content-studio 三文件未进入 `scripts/deploy-prod.sh`，本轮不纳入它们。

工作区原有修改均予以保留。本轮没有 commit、push 或 deploy。
