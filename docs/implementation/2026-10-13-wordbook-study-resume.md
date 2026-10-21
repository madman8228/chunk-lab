# M2a：真实词书学习与跨设备续学

- Status: complete
- Updated: 2026-10-13
- Branch/worktree: master；D:/06-project/chunk-practice
- Base commit: 8e19498f3bd7a8d9d7776b7e02a074689d0b0f81
- Relevant uncommitted changes: M1 工作台、目录分类、收藏、首页及协议接线未提交；词汇页面、六词素材、phone-auth、课程保存与发布还有其他既有修改。全部保留，禁止重置工作区或重建实际数据目录。
- Planner: Astra 规划角色；不宣称验证过主任务模型选择
- Executor: Luna 执行角色，沿用用户确认的两阶段流程

## Objective

交付第一条真实词书流程：发现实际六词词书 → 收藏 → 打开并练习 → 保存辅助练习记录 → 刷新或第二设备从下一词继续 → 首页提供词书续学入口。

这是 M2 的第一批。内容索引为扩容建立边界，但本次只接已经存在的六个真实词及其练习。教材导入、第三方词书、上万词生产和新题型另行交接。

## Current state and evidence

- M1 交接 `2026-10-13-personal-learning-workspace.md` 已 complete；存在发现/收藏/当前在学/独立目录元数据管理与协议 3 outbox。
- `landing/practice-content.js` 定义六个词及完整声明式 exercise；浏览器与 Node 可共用。`sentence-cloze-engine.js` 提供 validate/evaluate，view 提供现有填空与 Enter/Tab/IME 行为。
- `landing/practice.js` 只从固定六词挑选，暂停保留当前 DOM；没有服务端词书游标，刷新无法恢复轮次。保存资格在客户端通过 me.user.phone 判定。
- `server/routes/vocabulary-practice.js` 的 vocabulary_attempts 按 user_id/event_id 存储，按 word 字符串聚合；白名单固定六词。不能拿它承载任意义项、词书版本或跨设备游标。
- 现有句子填空属于辅助练习；不能积累独立回忆/掌握信用。本次继续这个规则。
- `library-catalog.js` 仅支持 sentence-deck/story-package 与 vocabulary-pilot:six-words；`main.openWorkspaceResource` 对 pilot 只跳旧词汇页面，其他资源按 CourseEnrollment 启动。
- `extra/course-catalog.json` 是空课程数组，没有已经导入的教材/第三方词书可以直接接入。
- phone-auth 的 user_phone_identities 是现有已验证手机号归属表；本次保存资格沿用绑定手机号要求，不改变旧词汇或临时账号政策。

## Assumptions and decisions

1. 使用独立稳定 itemId 表示教学项目/义项，不能用英文拼写、列表序号或标题作学习主键。六词映射为 `pilot-v1:<word>`，以后同拼写不同教学项目可有不同 ID。
2. 新词书 ID `pilot-six-v1`，resourceId `wordbook:pilot-six-v1`，真实名称“六词练习”。不添加年级、CEFR 或考试标签的猜测值。
3. 新入口 `wordbook.html?book=pilot-six-v1`；现有 vocabulary.html 场景体验和 vocabulary-practice.html 保留原用途。旧链接不重定向、不迁移旧尝试记录。
4. 词书开始练习不自动加入 Chunk 课程、不占三门课程名额。收藏、启动和已有课程加入各自保留行为。
5. 跨设备保存完整词的完成/跳过边界，不保存半句输入草稿；同页暂停仍保留输入。完成练习显示“本轮完成”而非“已掌握”。
6. 已绑定账号通过服务端判定可保存；游客/未绑定账号明确体验模式。账号/API 地址/token 的变化使旧回包失效。
7. 页面加载只读取索引页与当前教学项目。图片用已有合格小图、按需加载；每个格式严格 <20,000 字节，绝不回退到原图。

## Scope

- 公共词书/教学项目索引与受限只读 API，六词现有素材适配。
- 复用现有 cloze 组件的新词书运行时、暂停/跳过/完成/续学。
- 协议 3 保存操作、服务端记录、账号作用域确认缓存与自动重试。
- 工作台发现/收藏启动与真实词书续学接线；目录管理可引用已公开词书。

## Out of scope

- 任意词库/教材上传、出版社内容、批量生成插画、第三方抓取与授权。
- 新独立回忆题型、掌握等级、词汇与 Chunk 的总分/总复习合并。
- 重写旧 vocabulary_attempts、旧浏览器队列，迁移历史记录或扩大旧保存资格。
- 全站改版、发布部署、重启 8787、修改实际数据库或实际账号。

## Contracts and data changes

### 1. 内容索引与只读入口

- 新 `scripts/build-vocabulary-content.mjs` 只读取现有 practice-content 与现有小图引用，生成新增目录 `content/vocabulary/`；不改 content/manifest.json、原六词定义或原图。
- 索引 schemaVersion=1：books[{bookId,revision,title,itemCount,items:[{itemId,contentRevision}]}]；每个项目 JSON 含 itemId/contentRevision、word、meaning、scene、example、translation、exercise 和显式小图 URL。revision 为内容哈希，metadataRevision 不作为练习版本。
- `server/services/vocabulary-content.js` 验证 ID 唯一、引用存在、cloze schema、安全路径、每个实际图片格式字节数；只读索引，不扫描所有图片或加载所有项目正文。
- `GET /api/wordbooks/:bookId/items?offset=0&limit=20`：固定上限 50，返回书元数据与项目引用页，不返回全书题目/图片。`GET /api/vocabulary-items/:itemId?revision=...` 返回单项目，未知/版本失效明确 404/409，不换题冒充旧项目。
- 公共 library 的 baseResources 合并真实词书索引；新增 sourceRef `{type:'vocabulary-book',id:bookId}`。资源能力只从此受验证引用判定，旧 pilot 引用保持不变。目录管理的引用列表增加公开词书，发布仍仅追加目录修订。

### 2. 学习记录与游标

- 新增专用 `vocabulary_study_events(user_id,event_id,item_id,resource_id,content_revision,data_json,occurred_at,seq)`，user_id/event_id 唯一；append-only。新 `vocabulary_item_progress(user_id,item_id,data_json,seq)` 是派生投影。不要把词汇事件塞进 user_events 或句子 stats，避免改变旧成绩统计。
- user_entity_rows 增加 `vocabularyStudySummary`、`vocabularyResume`。概要仅保存每词书实际辅助完成数量/lastAt；游标保存 bookId/bookRevision、当前 itemId、sessionId、状态 active/completed、serverTime。不提供掌握百分比。
- 新 `server/services/vocabulary-study-operations.js` 接 operations.apply，操作沿用请求哈希、事务、seq、回执和 outbox：
  - `vocabulary.session`：payload {bookId,bookRevision,action:'start'|'pause'|'skip',sessionId,itemId,expectedResumeRev}；start 读取真实游标，不默认跳第一个。skip 只推进到目录中下一项目，不生成成功记录。
  - `vocabulary.complete`：payload {bookId,bookRevision,itemId,contentRevision,sessionId,answers}。服务端用共享 evaluate 验证字段与正确答案，限定字段数量/每值 200 字符/请求体 16KB；不信任客户端的 correct/mastered/independent/time。
  - 完成事件 ID 使用操作 requestId，重复请求无第二次记录；服务端时间为准。所有完成均 assisted，dueAt=serverTime+10分钟，独立回忆和掌握信用保持零。
  - 完成记录与项目进度/书概要/下一项目游标在同一事务确认。旧 session 的合法完成可以保留为辅助活动，但不得覆盖后来设备的游标；回执明确 resume-stale，客户端重新读取当前游标。start/skip 的旧 expectedResumeRev 返回409，不能覆盖新位置。
- 两个概要/游标实体接通 data-rows、data-snapshot 全量/增量、revs/entityGone、readChanges、ServerCache。每词进度通过 `GET /api/wordbooks/:bookId/state?offset=&limit=` 按页读取，不把全词库项目状态放进 main 的整份 mem。
- state 返回 canPersist、确认游标及当页进度；资格只读查询现有 user_phone_identities（缺表或无归属均 false），不返回原手机号。两类写操作在服务端执行同一资格检查，未绑定返回明确业务错误；不发送短信。
- 旧 vocabulary_attempts 与旧 pending/cache 原样保留。新词书首次进度为未开始；界面明确“旧六词体验记录保留，词书学习从本次开始”，不悄悄合并为新的掌握记录。

### 3. 前端与工作台

- 新 `js/vocabulary-study-store.js` 封装 ServerStore.submitCommitted 与确认缓存；不新建 localStorage 账号列表/outbox，不调用整账户快照保存。明确 pending/confirmed。
- `wordbook.html` 加载现有 AccountStorage/ServerCache/ServerStore 初始化依赖，抽取 main 中必要的确认启动接线为小共享模块，不加载第二个 CL 或复制整个主应用。
- 新 `landing/wordbook-study.js` 使用现有 sentence-cloze-engine/view；初次读书页+state 后才开始。只有当前项目正文与图片请求；暂停保持 DOM；跳过无成绩；完成后保留完整英文/中文和朗读，再进入下一词。
- 成功提交才推进确认游标。离线可保存已检查答案到现有 outbox，显示待保存并保持当前词，恢复后自动完成确认与推进；刷新重开仍能发现待提交，不宣称跨设备已经保存。错误保持所有输入并聚焦首个错误。
- 书/项目不可用、账号切换、未绑定、网络失败、已经完成为不同状态；禁止清存储修复显示。目录变版时暂停旧游标并说明版本已变化，M2a 不做自动旧版→新版位置迁移。
- 新共享启动模块命名 `js/learning-session-bootstrap.js`，只抽取账号作用域与确认缓存/outbox就绪步骤；main与wordbook共用。保留现有 AccountStorage/ChunkAPI/ServerCache/ServerStore 依赖次序和原 main 启动结果；不在共享模块打开页面、启动课程或重建账号。
- main.openWorkspaceResource 优先处理 vocabulary-book；wordbook 卡按钮为“开始练习/继续练习”，不调用 CourseEnrollment.join/leave。首页在词书确认游标与 Chunk 确认续学之间按实际 serverTime 选择一个主入口，通过 toolId 分派，保留 Chunk 原有课程/课节身份和模式。
- 工具 vocabulary 的续学能力只针对新词书；现有体验仍准确标注。词汇待复习量不混入 Chunk 到期按钮。导航返回首页/我的学习/发现。

主要文件边界：新增 `src/vocabulary-study/{content-model,session-model,home-resume}.mjs`、`scripts/{build-vocabulary-content,build-vocabulary-study,vocabulary-study-entry}.mjs`、`server/services/{vocabulary-content,vocabulary-study-operations}.js`、`server/routes/wordbooks.js`、`js/{learning-session-bootstrap,vocabulary-study-store}.js`、`landing/wordbook-study.js`、`wordbook.html`。定向修改 server 的 db/index/operations/data-rows/data-snapshot、js/server-cache/server-store、main.html、learning-workspace 的 resource-model/home-model/tools/view、独立 library 管理引用列表及构建/SW/deploy/test 清单。新纯模块按现有构建产出浏览器 IIFE/服务端 CJS，共享规则不得手抄两份。

## Implementation steps

- [x] 1. 新内容索引/单项适配、构建及图片预算验证；新增纯词书模型，保存六词原教材内容。
- [x] 2. 只读分页/单项/state 服务与 library 新引用适配、独立管理端引用选择。
- [x] 3. 专用事件/进度表、协议操作、摘要/游标实体与全量/增量缓存接线。
- [x] 4. 词书页面/共享确认启动/store/练习运行时，明确体验/待保存/已保存及异常行为。
- [x] 5. 发现/收藏启动、首页真实词书续学，与原 Chunk 续学并存；沿用现有暖纸界面。
- [x] 6. 构建产物、SW/deploy/test 清单登记；只预缓存界面脚本，不预缓存词书正文/图片全库；验收并更新本交接状态。

## Validation

规划仅只读检查源码；未运行测试或打开真实数据库。执行时新增以下有意义的隔离验证：

- [x] 纯模型/内容：稳定 ID、同拼写不同项目、分页边界、版本失效、未知项目、六词 exercise 一致、每个实际 served 格式 <20,000 字节。10,000 项索引夹具只在临时目录，证明单页不会返回全部正文或请求全库图片。
- [x] 服务/协议：临时 DB 和临时内容根；手机号资格、A/B 隔离、非法引用/答案、重复 requestId/内容冲突、事务失败回滚、旧 session 不覆盖新设备位置、正确辅助练习不产生掌握信用。全量/增量/回执实体一致。
- [x] 数据保护：在临时 DB 预置旧 vocabulary_attempts、旧课程/成绩与其他用户记录；新操作前后原行/原 JSON/hash 一致。full DB 备份覆盖新表；不改旧恢复/导出格式、不声称旧 JSON 导出包含新事件。
- [x] 浏览器 E2E：新临时目录/独立端口，使用临时 verified-phone 归属夹具（不发短信）；发现词书→收藏→开始→正确填空→确认→退出→刷新→第二context首页继续；跳过无成功信用、旧设备回包、离线pending/恢复、账号切换/游客体验。1440/946/390/360 无溢出，Enter/Tab/IME与图片按需加载。
- [x] 旧词汇引擎/六词 API、M1 learning-workspace E2E、课程 catalog/progress/resume/三门上限/账号隔离相关回归；变更前核对每个用例的隔离目录/端口配置。
- [x] build-app/check-generated/gen-sw/check-sw/check-deploy-files/test-manifest 契约通过；截图 output/playwright/wordbook-study。禁止为测试重启/切换8787。

## Acceptance criteria

- [x] 真实六词词书在发现中可找到、收藏，并从我的学习实际打开；没有教材/等级虚构内容。
- [x] 已绑定账号的完成/游标得到事务回执；刷新及第二上下文从确认的下一词继续；首页能准确选择词书/Chunk 续学。
- [x] 体验/错误/跳过/辅助成功均不会显示客观掌握；旧六词记录、课程和成绩完整保留。
- [x] 同账号跨设备冲突不覆盖新游标；账号切换不应用旧回包；断线不变成空账户或云端保存成功。
- [x] 扩容内容使用索引分页/当前项目请求，图片逐文件预算与按需加载经验证。
- [x] 指定验证通过并记录；实际服务、真实账号、原始内容/图片和备份保持原状。未提交、推送或部署。

## Risks and rollback

- 旧六词是 word 字符串身份，新体系是教学项目身份。禁止自动合并；以后迁移必须另行批准映射和一致性备份。
- main 首页续学接线可能覆盖旧课节/review入口；依赖带toolId的分派和原入口优先级回归。
- phone 身份表在部分测试/服务配置下不存在；只读资格失败时体验模式，写操作明确拒绝，不能创建虚构绑定。
- 元数据 revision 与教学内容 revision 分开，避免修改题目后给旧答案计信用。
- 回退只隐藏新入口/撤销代码接线，保留新增表/记录和全部原始文件，不 DROP/reset 数据。

## Execution notes

### 2026-10-13 执行完成

- 实际索引为已有六词，生成七个新 JSON 文件；稳定项目 ID 与内容哈希已接通。原练习定义、content/manifest.json 与全部原图均未改写。每个实际浏览器图片及替代格式均 <20,000 字节，没有新增词汇插画。
- 词书分页、项目和状态 API、协议 3 两类操作、专用事件/进度表、摘要与游标缓存已接入实际 server/index.js。目录维护可发布公开词书引用，拒绝混合课程/词书的含糊引用。
- wordbook.html 与发现/收藏启动、首页按确认时间选择词书或 Chunk 续学接通；共享 bootstrap 保留原 main 启动顺序。页面复用填空组件，保持暖纸风格、实线下划线和明确焦点。
- 位置冲突需要用户点击“使用已保存位置”，只撤销服务端已明确拒绝的 vocabulary.session 队列项，保留所有已保存练习。该功能不自动清理队列、学习记录或账号数据。旧 session 的合法完成依据该账号此前的 start 回执验证，不能用任意伪造 sessionId 获得活动记录。
- `node e2e/wordbook-study.test.js` 通过，最终隔离端口 11318；真实 DOM 完成发现→收藏→开始→填写→回执→刷新/第二 context 首页续学。另含暂停输入保留、请求幂等/重用 ID 拒绝、全量/增量、旧设备回包、离线自动重试、跳过无成功信用、位置冲突恢复、游客体验及 A/B 保存资格隔离。
- 在测试数据库预置旧 vocabulary_attempts、A 的 stats JSON、B 的课程原文；全部原行保持一致。使用 SQLite 一致性 backup 验证旧记录与新辅助事件均保留；没有只复制 WAL 活跃时的主文件。新事件仍不包含在旧学习 JSON 导出中。
- `node server/vocabulary-study.test.js`、`node js/vocabulary-study-store.test.js`、`node --test src/vocabulary-study/vocabulary-study.test.mjs` 通过：资格、正确答案、版本、辅助信用、事务回滚、位置并发、伪造轮次拒绝、旧回包丢弃与索引身份/分页。
- `node server/vocabulary-content-scale.test.js` 通过：临时目录的 10,000 项索引加虚拟正文存在性夹具，分页返回 20 项，重复分页仅读一次索引，零正文读取；夹具已清理。
- 旧六词 API 与 cloze 引擎（含实际 Enter/Tab/IME）、M1 工作台 E2E、目录管理、课程 catalog/progress/resume、三门课程限制、账号隔离 25 项及 main 生命周期/首页摘要相关回归通过。
- build-app、check-generated、gen-sw、check-sw、check-deploy-files 与 test-manifest 契约通过；测试清单现有 243 项。SW CACHE=chunklab-2a796e66，只新增页面/脚本/样式预缓存，不含词书项目正文或词汇图片整库。
- 桌面/手机截图位于 output/playwright/wordbook-study/study-{1440,946,390,360}.png，四宽度无横向溢出。完成两批视觉检查，无额外品牌改版。
- 实际服务更新：否。没有重启/部署 8787，没有打开或修改真实数据库，没有清理原浏览器数据、课程、记录、插画或备份；未提交或推送代码。

### 规划阶段记录（历史）

- 规划阶段只新增交接文档。现有 M1 保持 complete；该阶段未改产品代码、未运行测试、未重启服务。
- 开始实施改 in-progress，全部本批验收完成后才 complete。内容源、保存资格或跨设备契约若出现材料矛盾，记录具体问题并改 needs-planning。
- M2b 教材/真实额外词库管理与导入、M3专项工具、M4个人计划不属于本批；每批单独交接。
