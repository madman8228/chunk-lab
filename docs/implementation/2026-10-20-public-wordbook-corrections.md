# 已发布单词教材安全纠错：实施交接

- Status: implementation-deployed-locally; no real course revision was submitted
- Updated: 2026-10-20
- Branch/worktree: 当前 checkout，`D:/06-project/chunk-practice`
- Base commit: `7dc9bd0e738d5734c3adba2a54a72ef10f9c525d`
- Relevant uncommitted changes: 发布器、公共内容服务、管理员导入服务、课程统计及其测试目前均为已有未跟踪产品文件；不得重建或丢弃。整本教材、图片母版、8 张新 WebP、发布回执同样为用户资产。实施前仅对本文件列出的入口复核差异，不重置工作区。
- Planner: Astra 阶段；用户此前确认过模型选择，工具不能独立核实当前主任务型号
- Executor: GPT-5.6 Luna

## Objective

管理员可通过现有“系统单词课程”入口，导入同一本已发布教材的修正版，查看变更摘要并确认更新。教材链接、bookId、unitId 和 itemId 不变；旧内容和历史学习事实保留；其他共享词条的课程不被更新。初始实施阶段不自动给真实教材发布第二版；本文件末尾另记录用户随后明确要求的本机 8787 部署。部署没有提交任何课程修正版。

本次只完成固定目录的内容纠错闭环，不同时实现扩课、撤课、批量审查或在线例句编辑器。

## Current state and evidence

1. 本地教材已上架：`textbook-wordbook:pep-junior-grade9-full-2013`，14 单元、628 条。依据 `output/textbook-extractions/people-grade9-full-2013-20261015/whole-book-launch-v1/live-publication-receipt.json`。旧 Unit 1 试点保留，二者共用 Unit 1 的 itemId 和现有内容摘要。
2. `wordbook-publisher.js` 只支持新 bookId，所有同名更新均 409。删除此冲突检查不是版本实现。
3. `vocabulary-content.js` 按 itemId 记录首个文件路径；`item()` 只对首个当前 ref 比较 revision。不同教材共享同 itemId 后，不能靠覆盖文件正确读取各自版本。
4. `src/vocabulary-study/content-model.mjs` 的 `validateIndex()` 默认拒绝跨书同 itemId 不同 contentRevision。`js/vocabulary-study.cjs` 为生成文件，不直接手改。
5. `landing/wordbook-study.js`、`landing/wordbook-details.js` 已在单词读取中发送 contentRevision，可用精确 `(itemId,contentRevision)` 读取，不必重定义词条编号。
6. 公共 `vocabulary-course-progress.js` 只认识当前版本；个人版本才有历史。原公共版本被替换后，旧事件会被列为无法核实，不能保留完成事实。
7. 公共 `vocabulary-study-operations.js` 不投影旧游标；版本更新后旧游标会持续 409。学习页启动又被未保存队列阻挡，仅修发布 API 会形成用户无法继续学习的半成品。
8. `vocabulary-material-backup.js`、`vocabulary-image-delivery.js`、`vocabulary-teaching-content.js` 目前读取平铺发布目录；版本化必须接通备份及图片交付，不得只让详情读取成功。
9. 上一轮已完成整本包的隔离发布/628 项读取/重启保留测试，但没有覆盖更新，不能复用为本次验收证据。8787 已运行并存在真实用户数据。

## Assumptions and decisions

- 用户的“继续”授权实现更新功能，不授权对真实课程发布修正版、迁移账号或替换任何真实文件。
- 稳定身份：书、单元、词条 ID 都保留。现有源词义纠正使用原 itemId；不能自动给所有词换 ID 规避共享冲突。
- V1 严格固定目录：同一 bookId，单元身份/名称/顺序及各单元 itemIds 必须完全一致。允许例句、译文、释义、图片及已有练习配置等内容纠错；拒绝增删/换序/移单元和不同教材版次。新增单元另做明确交付，不冒充本次能力。
- 版权确认沿用现有发布门槛；不增加四项重复勾选。人工只需要预览变更内容、检查感官效果并确认更新。
- 无变化不能产生一个新版本。并发、审核和幂等均以完整 releaseId 为准，不能只用 book.revision：目前 book.revision 只散列词条引用，书名/目录元信息的变更未必改变它。
- 首版遗留文件不移动、不覆盖、不删除。新版本追加保存，激活记录追加保存；回退也追加激活记录，而非覆盖新版本。
- 修过的词默认需要重新练习；未变词的覆盖证据继承。所有旧版完成记录保留，绝不把旧版完成改写成新版已完成。图片修正也按 contentRevision 改变处理，先用保守规则，不另造“等价学习版本”协议。
- 历史事件只读。无需改现有 SQLite 学习表或给用户回填事件。不能通过清零 vocabulary_item_progress 修复统计。
- 已附带 materialRelease 或 teachingRelease 的课程暂不支持内容修订：服务端明确 422 并保留原稿，不能悄悄去掉这些部分。其现有首次发布/读取/备份仍须回归通过。九年级整本当前不带这两种发布包，属于本轮支持对象。

## Scope

1. 不可变公共内容版本、可校验的激活链、精确词条历史读取。
2. 管理员同书修正版导入/差异预览/技术校验/确认更新，以及有并发基线的回退。
3. 固定目录修订下的续学、历史完成及未变词继承。
4. 过期浏览器待保存队列的保留与显式处置，不能卡死新版入口。
5. 新旧内容、旧媒体、激活状态的备份与隔离恢复。

## Out of scope

真实教材第二版发布、部署、账号密码变更、数据清理；词条增删和目录重排；个人单词本协议变化；语音生产；UI 整体翻新；模型评测；公开素材删除；收费或权限重构。

## Contracts and data changes

### A. 不可变版本与激活

在现有 `wordbook-publications/<hash(bookId)>/` 中保留全部平铺首版文件。增加：

- `releases/<releaseId>/`：新版本的 manifest、items、practices、publication 回执；结构复用现有完整包目录。releaseId 为完整规范化候选包的 SHA-256；必须验证实际文件摘要及候选包指纹。
- `activations/<12位递增序号>-<recordHash>.json`：`{schemaVersion,sequence,previousActivation,releaseId,baseReleaseId,action,createdAt,reviewId}`。action 为 update/rollback。recordHash 绑定完整记录；第一条 previousActivation 为 null，baseReleaseId 对应保留的平铺首版。
- 单独小服务 `server/services/public-wordbook-versions.js` 管理路径/历史/当前激活解析和提交；不是泛化存储框架。

无激活记录时仍读平铺首版；有记录时按唯一连续有效链读取末尾激活目标。末尾存在多个分支、已提交记录校验失败、引用版本不存在时明确 503，不随意选时间最大者，也不偷偷回落到旧版。`.pending-*` 不可见。

提交复用 `.publish.lock`：锁内重读 baseReleaseId，验证候选/审核/素材，写完整暂存版本并 fsync，原子改名到新 releaseId，然后暂存/fsync/原子提交一条唯一激活记录。激活是可见边界；写版本后激活前崩溃留下未激活文件可供幂等重试，不删除或显示为当前版本。激活后 HTTP 响应丢失凭 importId+指纹+激活记录返回相同结果。目录名不能接受请求提供的路径。

rollback 只允许激活已核验、属于同书的旧版本；同样需要 expectedBaseReleaseId、管理员确认及独占锁。历史数据不倒退、不删除。真实环境回退是单独管理操作，不在实施阶段自动执行。

### B. 内容读取

`vocabulary-content` 增加 `currentRelease(bookId)`、`versions(bookId)`、`historicalBook(bookId,bookRevision)` 及内部已校验包目录解析。`versions` 按发布历史列出可核实 bookRevision，重复内容/不同激活记录不重复制造完成记录；rollback 后的当前版本不必是发布时间最后一版，不能继续假设 `history.at(-1)===current`。

索引只列每本书当前版本；词条查找按 `(itemId,contentRevision)`，同时包含仍有效的旧版及其他书。重复键内容字节必须完全相同，否则报损坏；不得按目录排序选首个。无 revision 的旧调用：若当前各书对此 itemId 只有一个内容版本，保持兼容；存在歧义则 409，禁止静默拿另一门课版本。历史事件精确 revision 仍能读取旧文字。

`validateIndex(index,{allowItemVersions:false})` 保持现有默认严检查；仅聚合公共版本索引处显式开启跨书版本选项。单书内部重复 itemId、非法摘要、文件名碰撞检查保留。publisher 不再以“任意旧书有同 ID”为全局否决条件；必须先核实更新身份、旧版归属、不可变存储及精确键一致性，不能仅放松验证器。

摘要、材料和预学习读取统一通过当前包目录解析；未支持的复杂课程修订被拒绝，所以不制造多套教学版本投影。图片交付注册所有保留发布版本的审核过的引用，保证旧图 hash URL 持续可读；同路径不同摘要仍拒绝，修图使用新文件名。缓存标识含当前 releaseId/激活序号，不能只比较首版目录名。

### C. 管理员 API 和 UI

沿用 `/api/admin/system-wordbooks`。首次导入仍使用现有直接 source JSON，不改变旧客户端协议。

新增 `POST /revisions`：`{bookId,baseReleaseId,source}`；只接收支持类型且相同 bookId 的完整教材包。返回普通 importId 摘要并带 `operation:'update'`、baseReleaseId、变更数量和 `changedItems:[{itemId,unitId,word,fields}]`。diff 服务端生成；没有差异 422。导入时不激活、不改真实学习数据。

现有 `/:id/validate`、review、publish 复用，状态内保存 operation/baseReleaseId；review 和发布指纹绑定它们。锁内若当前版本已变 409，旧审核失效，用户须重新基于最新版本导入；不能“最后保存者胜”。已发布首版草稿保持只读，不能把 update 写回原 importId。新增 `GET /published` 给管理员选择已发布课程，避免从草稿列表猜当前版本。

新增 `POST /published/rollback`，body 为 `{bookId,targetReleaseId,expectedBaseReleaseId,confirmed:true}`；路由须在 `/:id` 之前注册。校验 target 已审核、属于同书、与当前不同；记录管理员与前后激活身份。不要复用草稿 id 表示回退目标。

`js/admin-wordbooks.js` 和 `content-studio.html`：已发布课程显示“导入修正版”，选完整包后展示增量摘要，默认只浏览有变化词条（标识单元及前/后内容），主操作“确认更新整本教材”。后端不支持的目录变化以具体单元/词条定位；不展示全部资产路径/内部散列。无技术问题自动校验，复用现有一次确认审核与授权流程。提供简短版本历史和“恢复此版本”确认，不默认展开技术记录。无需另建管理页面或全功能编辑器。

### D. 学习、统计与过期操作

1. 公共 `course-progress` 使用已核验历史版本；统计每版的原始证据。当前覆盖仅继承同 resourceId 下，已核验历史版中 itemId、contentRevision 与当前相同的证据，不要求整书为前缀。改过的词不继承；其他书的共享词事件不算本书完成。个人既有规则不变。
2. 旧版完成保留在 completedVersions；当前修正词待练时 state=updated。回退到完成过版本仍可计算完成；历史版按内容摘要去重，不能把回退当新增完成课。
3. 公共 `state()` 只读投影游标：未变结构下原 itemId 仍存在则保留位置；原 completed 而当前存在待练词时定位首个待练词；全部已覆盖才继续 completed。原游标及事件不批量迁移，返回 resumeProjected 标识。用户在当前版本 start 成功才按既有协议写入新游标。
4. 老版提交不得按新答案评判或改写成新版事件。本轮统一返回 `CONTENT_VERSION_CHANGED`，不自动接收旧版离线 start/complete，也不扩大个人历史提交策略。已经成功提交的旧版事件仍可读取、统计。
5. `landing/wordbook-study.js` 必须专门处理队列内旧版 `CONTENT_VERSION_CHANGED`：展示数量及“保留旧版待保存记录，开始新版”；默认不删除、不重写、不伪装已保存。显式操作后将这些记录改为 `deferred-version`（新增本地队列状态，保留完整 operation/requestId/owner/错误/原状态/时间）。仅旧版 vocabulary 操作可进入此状态；不能延伸到其他数据或跨账号。
6. `js/server-store.js` 的队列遍历/blockedTargets/保存健康统计与 `VocabularyStudyStore.pending()` 区分 deferred：不自动发送、不作为新版 vocabulary 的阻断目标，保存健康仍列为“旧版待处理”而非 saved。提供导出这些原始操作的入口，用户可继续保留；不自动丢弃。read-only pending 默认仍可查询全部记录，启动过滤须显式排除 deferred。新版本操作继续原顺序与幂等规则；账号切换和重启后 deferred 仍属于原账号且不会被提交给另一账号。
7. 不将 `vocabulary_item_progress` 的旧累计计数当新版已完成证据。当前覆盖由版本匹配事件计算；累计练习次数仍是历史事实。无需新增服务器学习表，不回写历史。

### E. 备份

`vocabulary-material-backup` 枚举平铺首版、完整 releases、activations 及所有其引用的媒体，核实摘要后写新增备份。备份期间激活发生变化则重试/明确失败，不输出混合状态的成功清单。SQLite 仍走一致性 backup/VACUUM INTO；不能复制活动 WAL 主文件。隔离恢复用备份文件重建独立临时目录，证明当前激活、旧版内容及旧媒体均可读。保留原备份格式读取能力，不删除历史归档。

## Implementation steps

- [x] 1. 版本存储/读取测试覆盖共享 itemId、固定目录纠错约束、版本和激活合同。
- [x] 2. 新增 `public-wordbook-versions.js` 并接入 publisher、content、content-model；重建生成输出，接通当前摘要和历史项读取。
- [x] 3. 管理员 API/UI 支持同书修订、变化预览、并发冲突、回退及幂等；首次发布协议保持。
- [x] 4. 公共课程统计与续学按版本投影；个人课程规则保持原样。
- [x] 5. 实现旧版离线队列 `deferred-version` 的显式保留、导出、禁止自动重放；保存状态角标明确告知记录尚未上传且已保留。
- [x] 6. 接通历史图片回执、材料备份/隔离恢复和部署清单；生成文件检查通过。
- [x] 7. 隔离浏览器验收覆盖整本首次发布、同链接修订、变化预览与一次确认；服务/学习统计/队列/回退/备份的其余流程由隔离自动化测试分别覆盖，不冒称为单条端到端浏览器路径。
- [x] 8. 最终回归及差异检查通过，完成代码交付；线上服务和真实教材不在本次操作范围内。

## Validation

执行前核对以下现存入口；测试只能使用新 temp 数据目录和自动分配端口，不能使用 server/data 的副本作为可变测试目标。

- [x] `node server/wordbook-publishing.test.js`：共享 itemId、修订/旧版本读取、孤儿 release、并发基线、追加回退、服务重建、损坏激活 fail-closed 和初次发布故障注入。
- [x] `node server/admin-wordbook-imports.test.js`：初次导入/发布、同书修订、差异和历史素材、更新/回退 HTTP、备份及隔离恢复。
- [x] `node server/services/vocabulary-course-progress.test.js`、`node server/vocabulary-study.test.js`、`node server/vocabulary-attempt-http.test.js`。
- [x] `node server/vocabulary-material-backup.test.js`、`node scripts/vocabulary-illustrations.test.cjs`。
- [x] `node js/server-store.test.js`、`node js/save-status.test.js`、`node scripts/vocabulary-study-store.test.cjs`、`node scripts/wordbook-details-ui.test.cjs`。
- [x] `node e2e/admin-textbook-publication.test.cjs`：隔离浏览器跑通整本发布、同一本修订、单词变化预览、图像前后对照及确认后原链接仍为一本课程。
- [x] `node server/routes/client-save-health.test.js`、`node server/services/admin-overview.test.js`、`node scripts/check-generated.mjs`、`node scripts/check-deploy-files.js`。
- [x] 回归测试均使用临时数据目录/隔离端口；没有运行会写入真实课程内容的全仓 pretest。

测试报告必须区分：故障注入验证、重启验证、备份/恢复验证、浏览器操作验证；仅“628 条可读”不等于修订闭环通过。

## Acceptance criteria

- [x] 同一公开链接更新后返回新内容，目录不多出一本课；旧版可按精确 contentRevision 读取。
- [x] 整本与 Unit 1 试点共享词条的隔离测试只更新目标书，另一本内容/统计不受影响。
- [x] 修订基线冲突、重复提交/激活和追加回退有服务端测试覆盖。
- [x] 未激活完整 release 保持不可见；激活链损坏时 fail-closed；发布写入故障注入保持原内容可见。
- [x] 旧版完成、新版仅修订词待练、完成新版及回退后历史保留均有进度服务测试覆盖。
- [~] 旧版离线记录原文与 requestId 被保留、显式导出、禁止自动重放并允许新版继续；队列单测覆盖账号/服务 scope 隔离。未单独做浏览器关闭重开后的 IndexedDB 持久化 E2E。
- [x] 初次发布及现有单词本、学习统计和图片交付回归通过；带不支持材料/教学发布包的修订明确拒绝。
- [x] 旧/新图片大小和 hash 交付有检查；材料备份隔离恢复覆盖当前版本、历史版本及媒体。
- [x] 管理员页面可导入整本修正版、查看差异和确认更新；回退 API 与版本历史可用，页面路径由同一管理入口提供。
- [x] 实施/隔离验收未写真实课程、账号或浏览器数据；用户随后明确要求部署到本机 8787，部署记录见下文。

## Risks and rollback

- **共享词条风险最高**：不能仅改 publisher 的同名拒绝或 validateIndex 的全局约束。精确版本读取和旧书回归必须先完成。
- **版本并发/Windows 文件语义**：不依赖覆盖非空目录或覆盖 current.json；追加激活和独占锁在隔离 Windows 实例实测。路径、symlink 和文件名检查沿用原安全边界。
- **失效队列**：静默放行旧练习或自动清理都不合格。deferred 只能由用户明确操作产生；不能改 requestId/owner/operation 来伪装迁移。
- **备份遗漏历史**：未完成版本级备份和恢复测试前不交付实服部署；原备份仍保留。
- **运行代码回退边界**：旧程序不认识激活文件，新版本一旦真实激活，不能简单启动旧程序并宣称回退成功。本轮先隔离验收；将来部署需先备份，运行版本回退应使用认识版本协议的程序读取已回退激活，或另作明确维护方案。
- 真实环境新增、回退或迁移前须再次核实准确目标，创建一致性数据库和课程/素材备份并验证。当前已有备份不能自动替代未来更新时的备份。

## Execution notes

- 2026-10-20：修订实现和隔离验证已完成。关键测试覆盖不可变版本/激活链、旧版读取、共享词条隔离、回退、内容历史统计、续学投影、旧版离线队列保留与角标提示、整本教材修订 UI、历史媒体备份和隔离恢复。
- 最新完整回归：`server/wordbook-publishing.test.js`、`server/admin-wordbook-imports.test.js`、`server/services/vocabulary-course-progress.test.js`、`server/vocabulary-study.test.js`、`server/vocabulary-attempt-http.test.js`、`server/vocabulary-material-backup.test.js`、`scripts/vocabulary-illustrations.test.cjs`、`js/server-store.test.js`、`js/save-status.test.js`、`scripts/vocabulary-study-store.test.cjs`、`scripts/wordbook-details-ui.test.cjs`、`e2e/admin-textbook-publication.test.cjs`、`server/routes/client-save-health.test.js`、`server/services/admin-overview.test.js`、`scripts/check-generated.mjs`、`scripts/check-deploy-files.js` 均通过。
- 浏览器验收是隔离服务中的管理员整本发布及修订 UI 路径；版本统计、离线队列、备份/恢复和回退由各自隔离测试覆盖。未做真实账号的跨浏览器/跨设备人工操作。
- 唯一保留的专项验证缺口：未添加独立的真实浏览器重启场景来观察 deferred IndexedDB 记录跨页面关闭/重开；数据状态和 scope 隔离由队列测试覆盖。该项不阻断修订功能交付，但应在扩大用户使用前补做。
- 测试数据和临时图片仅位于自动生成的系统临时目录与隔离端口；未触碰 `server/data`、真实课程包或账号学习记录。
- 用户随后明确要求部署到 `8787`。部署前使用 SQLite 一致性备份工具备份数据库，并独立验证 1,301 个课程素材文件的大小与 hash；数据库 `server/backups/chunklab_db_20261020_215432.db` 完整性检查为 `ok`，素材备份目录为 `server/backups/vocabulary_materials_07338b56-ac77-4c7c-ad5c-7a8a3568c180`。此前另有一组已验证备份 `server/backups/chunklab_db_20261020_214547.db` 与对应素材目录，均予保留。
- 部署后本机服务 `http://127.0.0.1:8787` 健康检查返回 `ok:true`。管理员“系统单词课程”页面在浏览器中已加载最新静态资源，刷新后旧错误提示清除；页面显示两本已上架教材：人教版英语九年级全一册（628 词）与既有 Unit 1 试点（40 词），并提供修正版导入和版本记录入口。曾导致列表误报的根因是静态示例索引里有一条并非真实发布包的记录；现在列表仅从已验证的实际发布版本枚举。重试成功时也会清除旧错误状态。
- 本轮只部署应用代码和静态资源，没有导入修正版、发布新版本、回退教材、删除草稿、改账号或学习记录。14 单元/628 条首版及旧 Unit 1 试点内容均保持原样。该地址是本机开发/验收服务，不代表公网生产部署。
- 本轮代码与服务工作区缓存版本为 `chunklab-46b24b66`；`server/wordbook-publishing.test.js`、`server/admin-wordbook-imports.test.js`、`e2e/admin-textbook-publication.test.cjs` 以及 Service Worker / 部署文件检查通过。
- 上一阶段的实际上线记录保持独立：14 单元/628 条首版已发布，旧 Unit 1 保留。不要把首版发布状态替代本轮修订实现验收。
