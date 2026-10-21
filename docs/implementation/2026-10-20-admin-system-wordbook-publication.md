# 管理员导入系统单词课程：单课程发布与学习闭环

- Status: complete
- Updated: 2026-10-20
- Branch/worktree: master；D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: `7dc9bd0e738d5734c3adba2a54a72ef10f9c525d`。已核查 `content-studio.html`、`content-studio.js`、`server/index.js`、`scripts/deploy-prod.sh`、`scripts/check-deploy-files.js`、`scripts/gen-sw.js` 有现存修改；`js/wordbook-draft.js`、`server/routes/wordbook-publishing.js`、`server/services/wordbook-publisher.js`、`server/services/vocabulary-content.js` 尚未跟踪。它们是当前实现基础，禁止整文件回退或清理工作区。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

管理员从真实管理后台导入一门系统单词课程及所需交付素材，检查、试学、确认后追加发布；普通用户从发现页选课、学习，产生正确且按账号隔离的课程进度与学习记录。以独立测试环境完成一次完整浏览器流程，形成可复查的结果。

本任务纠正此前把“用户个人导入”当作系统课程主线的偏差。完成标准是后台入口和用户端真实接通，不是只新增发布接口、脚本或辅助验收页面。代码交付和隔离验收完成后，正式发布哪一门真实课程由管理员在已交付页面操作。

## Current state and evidence

1. `admin.html` 已有“课程内容”链接进入 `content-studio.html`；后者具有管理员登录、编辑正文、目录分类、新建发布、配图审核、教材草稿。`content-studio.js` 的 `showView` 与 `request` 可复用。现有“新建发布”接的是会员课程发布，不能把单词课程硬塞入该协议。
2. `wordbook-create.html` 是个人 AI 单词本工作台，保存到个人课程；当前未挂载 `landing/wordbook-publish.js` 所依赖的 `validateServer/publishConfirmed/publishDraft`。不能把个人页改成管理员发布页，也不能以个人导入 E2E 代替此次验收。
3. `server/routes/wordbook-publishing.js` 已注册管理员 `/api/admin/wordbooks/validate` 和 `/publish`；`wordbook-publisher.js` 校验课程结构、版本、素材和编号冲突，并采用暂存目录 + 原子目录改名追加发布。每次只发布一个 book；同名课程不覆盖。当前简单图片检查不足以独立证明真实 WebP 与 16:9，应复用现有图片检查器。
4. `server/index.js` 将 `vocabularyContent.publicationDirectory` 设置为实际数据库目录下的 `wordbook-publications`；公共课程目录由 `vocabulary-content.js` 合并基础索引与已发布目录。用户学习复用 `wordbook-details.html`、`wordbook.html`、现有操作写入与统计逻辑，不需要复制课程到个人账户。
5. 发布器读取 `appRoot/assets` 下的稳定本地引用，未提供素材上传。`vocabulary-dictation-assets.js` 校验音频 SHA-256、字节数和文件签名；每个音频现有上限为 10,000,000 bytes。`scripts/lib/vocabulary-illustrations.cjs` 的 `inspect` 已验证真实 16:9 WebP、摘要和严格小于 20,000 bytes。
6. `vocabulary-material-release.js` 已有材料来源/课程编排/人工审核版本绑定协议；`vocabulary-teaching-content.js` 已有教学发布验证。导入已准备好的包时必须保留并执行这些现有验证，不能降格成丢失来源的普通草稿。
7. `js/textbook-drafts.js` 当前明确标注教材仅预览、例句和正式发布包待补；配图通过不能自动等同于教材课程可发布。
8. `scripts/serve-wordbook-acceptance.cjs` 已能建立临时 appRoot、dataDir、测试账号和真实 server 子进程，但目前提前通过 API 发布并重点验证个人导入；新测试必须从管理员页面开始发布，不能沿用“已预先发布”的成功前提。
9. `server/wordbook-publishing.test.js`、`server/vocabulary-material-release.test.js`、`server/vocabulary-material-backup.test.js` 提供现有追加发布、来源审核和恢复回归。`vocabulary-image-delivery.js` 当前只在启动时加载配置图目录；新发布图片若要进入共享摘要 URL，需要追加发布目录的动态来源。

## Assumptions and decisions

- 系统内置指“管理员发布、进入公共课程目录”；本轮默认免费课程。会员、付费、兑换码不纳入这条发布流程。
- 审核人为当前管理员本人，不增加第二角色或多人审批。机器检查负责文件和结构，管理员确认内容、难度、素材对应及使用授权。刷新保留服务端草稿和审核进度；修改内容/素材后旧确认失效。
- 第一期接受两种现有 JSON：完整 `WordbookDraft`（`schemaVersion/book/items`，服务端调用 `js/wordbook-draft.js` compile），或 `wordbook-prepared-package`。单纯教材词表、配图报告、个人账号备份和未经编译的材料库不能冒充课程包；明确说明缺少何种内容，不静默猜测或转换。
- 原始上传文件独立保留；服务端得到规范化待发布包后，仍使用原 publisher 验证和写入。保留可选 `materialRelease`、`teachingRelease`，不修改其审批声明或伪造通过状态。
- 素材选择采用浏览器多文件选择，不新增 ZIP 解压器。服务器枚举包里实际引用的图片、封面及音频；已有文件验证成功即可复用，缺失项由管理员补选。仅接受引用中的文件，禁止上传无关目录/原画/脚本。
- 不对真实课程生成新内容或新插画。成人六词只作为隔离测试输入，测试通过不等于其真实内容审核通过。
- 此任务是主线优先的单课程闭环；既有 M2 文档的全库发布准备与历史库存不是本任务前置条件。此次不部署、不更新现行服务、不导入真实账号。

## Scope

- 管理后台新增“系统单词课程”独立面板：导入、草稿列表、缺失素材补选、校验结果、按单元预览/试学、审核确认、发布结果。
- 服务端可恢复的单课程导入草稿、受管理员权限保护的交付素材上传、预览、审核和追加发布。
- 发布后新课程进入现有公共目录；素材正常按需加载；用户学习记录与课程进度不串课、不串账号。
- 真实服务 + 浏览器隔离验收，以及发布/素材失败路径的定向回归。

## Out of scope

- 全库上架、真实教材内容制作或补齐、自动标记配图/教材已审核。
- 个人导入页面改造、首页改版、学习界面重设计、新答题方式、麦克风/跟读识别质量验收。
- 已发布课程覆盖更新、删除/下架、历史数据迁移、通用文件管理器、批量 ZIP 导入。
- OSS 上传、CDN 配置、生产部署、真实备份恢复操作、Git 提交/推送。

## Contracts and data changes

### 1. 管理页面和用户流程

入口：`admin.html → 课程内容 → 系统单词课程`。在 `content-studio.html` 增加导航和 panel，由新的 `js/admin-wordbooks.js` 管理局部状态，样式放 `assets/admin-wordbooks.css`；只对 `content-studio.js` 做面板切换和认证请求复用所需的小改动。

页面按阶段逐步呈现：选择课程 JSON → 课程标题/单元/词数及素材检查 → 补齐缺失素材 → 内容预览/试学 → 审核确认 → 发布。保留一个当前主操作；错误定位到单元、词条或具体素材。没有错误时不展示内部版本和协议术语。

管理员预览按需取当前词条；试学复用 `landing/sentence-cloze-view.js`、`landing/guided-sentence-view.js` 及现有词汇练习组件，回调仅更新预览 UI，不实例化用户学习写入服务、不提交 `/api/operations`。图片/音频从需认证的预览接口拉取 Blob 并撤销对象 URL；不把令牌放 URL。

发布成功显示“查看课程”“去发现页查看”；普通用户由公共入口进入，不要求导入 JSON 或保存为个人课程。沿用现有“我的内容”加入/续学语义，不另外建立自动复制或自动报名机制。

### 2. 草稿存储及接口

新增 `server/services/admin-wordbook-imports.js`、`server/routes/admin-wordbook-imports.js`，由 `server/index.js` 注入 `appRoot`、数据库同级 `wordbook-imports` 目录、现有 publisher/content。保存位置与真实服务数据目录同源配置；测试必须是新临时目录。

每个导入分配服务端随机 UUID；目录含原始 JSON、规范化包、草稿状态、私有素材和审核记录。文件写入使用独立暂存后原子替换本草稿状态；原始 JSON 不覆盖。首版不提供编辑 JSON，重导入创建新草稿；可复用已上传同摘要素材。已发布草稿可读，不再修改。

所有接口 `adminOnly`，响应 `Cache-Control: private, no-store`：

| 接口（统一前缀 `/api/admin/wordbook-imports`） | 输入/结果 |
| --- | --- |
| `POST /` | `{source}`；识别上述两种格式，10,000,000-byte JSON 上限；返回 importId、revision、课程摘要、素材清单及缺失/冲突项 |
| `GET /`、`GET /:id` | 分页列表及单个草稿的状态、审核与发布结果；列表不返回全部词条 |
| `PUT /:id/assets/:filename` | `application/octet-stream` 原始文件；文件名必须属于该包引用白名单，正文有界；成功返回新的 revision |
| `GET /:id/items?offset=&limit=` | 受限分页的预览内容，最多 20 项 |
| `GET /:id/assets/:filename` | 需管理员认证的素材预览，固定 MIME、nosniff；可读取私有暂存或已验证现存文件 |
| `POST /:id/validate` | `{revision}`；重新验证包及全部引用素材，返回 fingerprint、摘要和阻断项 |
| `POST /:id/review` | `{revision,fingerprint,content,level,assets,rights,note}`；四项均由管理员明确确认，保存服务端审核时间/身份标识，返回 reviewId |
| `POST /:id/publish` | `{revision,fingerprint,reviewId,confirmed:true}`；复核内容、素材和审核后追加发布，返回 bookId、详情链接和回执 |

上传路由在管理员鉴权后使用有界 raw parser；不把二进制发送为 JSON/base64。现有后台 request 默认把 body 标为 JSON，要单独提供 raw 上传方法，正确继承 API base 和管理员 token；401 走现有登录处理。普通用户和未登录用户不能创建草稿、上传或预览。

建议明确限制：每包最多 10,000 项（沿用现有）、交付素材累计最多 250,000,000 bytes，每个音频沿用 10,000,000 bytes，插画严格 <20,000 bytes；首版封面仅收真实 PNG/JPEG/WebP 且 <=2,000,000 bytes。拒绝超限并保留既有草稿。计数按唯一引用路径；正文流中也执行大小限制。

revision 绑定规范化包、所引用素材的实际摘要与缺失状态；fingerprint 在此基础上绑定校验结果。任何实际素材变化使审核失效，包括上传后、校验后由外部修改现存文件；发布前必须重新读实际字节核对。旧 revision 返回 409，不能静默覆盖其他窗口状态。

### 3. 素材验证和发布事务边界

- 保持课程 `assets/<稳定文件名>` 引用。规范化路径白名单沿用现有平铺格式；拒绝 `..`、绝对路径、编码分隔符、符号链接、Windows 保留名和大小写碰撞。
- 提取一个小型 `server/services/vocabulary-publication-assets.js` 负责枚举引用、真实文件校验和素材指纹；复用现有图片尺寸检查和音频合同，不复制出不同的宽高/大小标准。供 admin import 与 publisher 使用。
- 为 publisher 验证和音频验证增加可选、内部注入的素材解析函数，默认仍读取 appRoot/assets。导入草稿校验使用“本草稿暂存文件优先，现存素材其次”，禁止客户端提供任意文件根目录。材料/教学发布检查涉及素材时同样沿用该解析入口；默认行为必须保持。
- 新图宽窄端必须引用同一张真实 16:9 WebP；封面不是词汇插画，不套用 20 KB 限制。音频需要与声明的字节数、SHA-256、MIME/签名一致；未声明音频的课程不强制补音频，且不能开放不存在的听写方式。
- 发布时沿用 publisher 全局锁，将审核后的缺失素材追加到 appRoot/assets。原路径已存在且摘要相同则复用，摘要不同则 409；禁止重命名课程引用来掩盖冲突。
- 追加文件采用同目录临时文件、写完校验并 fsync 后原子排他建最终路径（例如 hard link，EEXIST 后核对摘要），不得直接覆盖或暴露半写入文件。跨文件系统时先复制到目标目录临时文件。无写权限明确报错，不另造“部分发布成功”分支。
- 素材全部可用后再调用现有课程暂存目录提交。课程 manifest 提交是公共目录可见的边界；失败时既有课程和学习记录不动，保留草稿。已追加但尚未被课程引用的素材允许保留供重试，不自动清理可能共享的素材。
- 在最终课程目录中同时保存 `publication.json`：importId、packageFingerprint、素材清单摘要、审核时间/标识及四项审核结论。此记录与 manifest 一同进入暂存/提交，不事后补写。普通课程详情不泄露管理员身份或审核备注。
- 按 importId + fingerprint 幂等恢复发布结果：提交后回执丢失、服务重启、重复点击返回同一 bookId。不同导入占用同一 bookId 仍明确冲突，不擅自改编号。必要时发布器增加内部可选 metadata/提交钩子，避免第二套课程写入逻辑。
- 现有 materialRelease 审核仍由原验证器检查；页面确认不能绕过来源包内待审状态。旧管理员发布 API 和材料发布 API 保留既有调用协议；本轮新导入入口必须执行其服务端 reviewId 检查，不把浏览器勾选本身作为已保存审核记录。

### 4. 共享图片、缓存与恢复

新发布图片仍需经过不可变摘要 URL：扩展 `vocabulary-image-delivery.js`，合并现有配置目录和已提交发布记录中的图片清单；不能改写原配置目录。由 publication 目录签名刷新增量索引，服务重启可重建。相同 alias 对应不同 hash 必须在发布前拒绝；已有 CDN 配置只适用于已在原目录登记的对象，新本地图片先走本地 `/_vocab-images/<hash>.webp`，不得指向尚未上传的 OSS 对象。

复用现有 alias 重定向和校验服务；新词条按当前内容加载，不把所有新增图加入 SW precache。新增草稿/审核接口均不缓存。

`vocabulary-material-backup.js` 对新 `publication.json` 按可选文件随已发布课程备份和验证；原有无此文件的课程继续可恢复。未发布导入草稿仍保留在服务数据目录，本轮不新增自动清理/灾难恢复系统，不宣称现有备份已包含这些草稿。只对临时测试数据验证备份。

## Implementation steps

- [x] 1. 复核上述相关工作区差异；本文件改为 in-progress。新增素材枚举/校验模块及有界私有导入服务，复用现有 compile/publisher，不创建个人课程。
- [x] 2. 接通 adminOnly 路由、可恢复草稿、raw 素材补传、分页预览；验证 revision 和内容指纹，完成草稿审核存储。
- [x] 3. 在 publisher 原有锁/暂存提交内接入素材排他追加、审核回执和幂等读回；补上真实图片格式/比例检查，保持旧课程/材料发布兼容。
- [x] 4. 接通动态共享图片摘要交付及发布记录备份；证明新发布图片无需重启即可访问、刷新后仍可访问。
- [x] 5. 接通课程工作台“系统单词课程”面板，完成导入—补素材—预览/试学—审核—发布的可操作界面。只复用当前页面登录；文案明确“系统课程”，不要暴露实现术语。
- [x] 6. 更新 `scripts/deploy-prod.sh` 必要文件、依赖检查及 SW 生成产物（只运行必要生成器）；不手改生成 JS，不全量处理课程资产。
- [x] 7. 新增 `e2e/admin-wordbook-publication.test.cjs` 及最小隔离 fixture。使用真实后端与管理员登录、真实页面导入和发布，再用独立普通用户完成公共课程学习；保存截图及机器结果。
- [x] 8. 运行下列定向回归，记录通过/失败和残余限制；全部必需标准通过才将本文件置 complete。

## Validation

所有持久化测试使用 mkdtemp 新建 appRoot/dataDir、独立随机端口；server 子进程显式设置 `CHUNKLAB_APP_ROOT`、`CHUNKLAB_DATA_DIR`。禁止使用现行 6979 或 server/data；浏览器新上下文，测试账号。关闭/重启只针对自己创建的实例。读取真实源课程只为复制测试输入，原文件摘要前后相同。

- [x] `node server/admin-wordbook-imports.test.js`（新增）：输入格式与限额、鉴权、缺图/音频、错误格式/比例、20,000-byte 边界、路径/大小写冲突、上传失败与断流、审核过期、并发发布、丢响应重试、重启草稿与回执恢复。新文件采用真实图片夹具，不能用全零 Buffer 骗过图片验证。
- [x] `node server/wordbook-publishing.test.js`：调整原全零图片夹具为合法 WebP 后保留原全部合同，扩展素材冲突和提交失败；既有基础索引/项目字节不变。
- [x] `node server/vocabulary-material-release.test.js`：材料来源/审核验证仍生效，暂存解析默认兼容。
- [x] `node server/vocabulary-material-backup.test.js`：新增发布回执随包保存，旧包可恢复；仅合成数据。
- [x] 共享图片交付：`server/admin-wordbook-imports.test.js` 覆盖发布后及索引重建后的 alias/hash、本地新图交付、CDN 未上传对象回退本地；图片按需加载保持既有策略。
- [x] `node e2e/admin-wordbook-publication.test.cjs`：使用现有 Chromium，在 1440px/390px 检查管理员页面无横向溢出，并完成关键操作。
- [x] E2E 通过 UI 导入成人六词测试副本，初始缺少全部 18 个引用素材时阻断校验，再逐项补齐；预览试学期间用户事件数不增长；审核刷新恢复；机器校验不自动勾选人工确认。
- [x] 通过真实管理员页面发布后，以两个独立普通用户上下文检查发现页/详情/学习。选词填空与词序拼块均完成；同词同方式在两个并发会话答对后事件追加、知识词数仍为 1；另一账号进度为零。不通过预先 API 发布替代 UI 测试。
- [x] 刷新、退出再登录及隔离 server 重启后，学习事件、进度和续学位置一致；详情和统计页指向同一公共 bookId；未创建 personal-book 副本。导入服务测试验证丢响应重试不会重复发布。
- [x] `node e2e/content-studio-ui.test.js`、`node e2e/wordbook-product-acceptance.test.cjs`：原后台与个人单词本路径未退化；验收实例和数据目录隔离。
- [x] `node scripts/check-deploy-files.js`、`node scripts/deploy-safety.test.js`、`node scripts/check-generated.mjs`、`git diff --check`。新增 JS 通过语法检查；无需无依据地扩大全量 npm test。

## Acceptance criteria

- [x] 管理员从现有后台进入系统课程功能，全流程不借用个人导入页面、不需要手写 API。
- [x] 一门完整测试课程可导入、补素材、刷新续审、试学、明确确认并发布；阻断状态会显示具体缺失素材。
- [x] 机器校验与管理员确认明确分开；校验不预先勾选审核；素材变更使旧确认失效；试学不产生学习记录。
- [x] 普通用户在公共目录发现课程并直接学习，无需自行导入；发布内容一致，图片/音频按需可用。
- [x] 学习记录、去重后的课程进度、账号隔离与重启恢复由真实后端和浏览器验证。
- [x] 同名不同内容素材/课程冲突阻断；失败、重试和并发不覆盖原课程、不重复发布、不清理共享素材。
- [x] 已发布素材和审核回执随隔离材料备份保留；未发布草稿仍在服务数据目录，未纳入本轮已发布课程备份。
- [x] 交付测试结果与管理员流程截图；真实课程仍须管理员审核；现行服务未更新。

## Risks and rollback

- appRoot/assets 写权限是沿用当前素材布局所需的实际部署前提。实现须在上传/发布界面清晰反馈权限错误；不要擅自改服务器权限或迁移素材根目录。该选择避免此次同时重构全站图片/音频寻址。
- 文件系统与数据库无跨资源事务：先准备素材，再原子提交课程；保留未引用素材和可重试草稿，避免补偿删除伤害其他课程。发布回执放入同一课程提交目录解决提交后丢响应。
- 新共享图片来源必须与配置目录同时核对 alias；不能因为文件存在就假定匹配，也不能静默覆盖旧 catalog。发布失败时老目录仍可读取。
- 可通过移除新增后台入口停止新导入，但已发布课程、素材、审核记录和用户学习记录继续保留。回退只撤销本任务代码；不执行 git reset、整目录恢复或删除课程。
- 若真实课程只有词表/插图，没有例句、练习或已审来源，报告具体课程缺口；本轮不自动扩展为课程生产任务。

## Execution notes

- 2026-10-20：依据用户明确的“管理员发布系统内置课程”方向完成规划；检查了后台入口、单词发布器、材料审核、素材合同、共享图片、隔离测试和工作区状态。
- 2026-10-20：开始按本交接实施。确认原工作区差异与规划记录一致；真实服务与账号数据未触碰。
- 2026-10-20：完成管理员系统课程入口、隔离导入草稿、素材校验/补传、试学、审核回执、追加发布、动态图片交付及发布记录备份接线。未改产品首页、真实课程包或真实账号记录。
- 2026-10-20：通过 `node e2e/admin-wordbook-publication.test.cjs`。隔离浏览器流程覆盖 18 个素材、试学不落记录、审核刷新恢复、显式发布、双账号隔离、同词同方式并发会话重复答题的事件追加/完成词去重，以及退出登录、后端重启后的记录和续学恢复。截图/机器结果：`%TEMP%\admin-wordbook-ui-report-dhrkm6`（每轮单独生成报告目录）。
- 2026-10-20：通过 `node server/admin-wordbook-imports.test.js`、`node server/wordbook-publishing.test.js`、`node server/vocabulary-material-release.test.js`、`node server/vocabulary-material-backup.test.js`、`node server/vocabulary-study.test.js`、`node e2e/content-studio-ui.test.js`、`node e2e/wordbook-product-acceptance.test.cjs`、`node scripts/check-deploy-files.js`、`node scripts/deploy-safety.test.js`（38/38）、`node scripts/check-generated.mjs`、`git diff --check`。`node scripts/gen-sw.js` 生成缓存版本 `chunklab-fd6c0205`。
- 2026-10-20：本轮没有更新、重启或切换现行服务。测试中的成人六词是隔离副本，不代表真实课程已审核。要上线真实内置课程，管理员需之后在后台逐课导入并确认内容、难度、素材和授权。学习端目前没有单独的“返回上一词/重做”控件；本轮通过两个并发会话验证同一词同一答题方式的多次服务端记录及进度去重。
- 2026-10-20 后续现场修复：用户要求恢复服务并处理 Unit 1 导入失败。发现历史草稿仍引用 AVIF，导入保存后才在详情阶段拒绝。现将素材路径和已有素材检查提前到保存前，初始 revision 同时计入实际素材扫描结果；新增隔离回归覆盖 AVIF 拒绝且不留草稿、已安装素材首次直接校验通过。保留原稿及旧素材，另存 `output/textbook-extractions/people-grade9-full-2013-20261015/unit1-pilot/wordbook-draft-shared-webp-v1.json` 和对应报告；40 词引用 40 张既有 16:9 WebP，最大 19,964 bytes。已在备份后更新本地 8787 服务，并按用户修复授权新增系统草稿 `04fd0fff-5a0e-4923-abdc-063d62773b62`；实际详情、素材和分页接口读取正常，发布校验 ready=true。旧导入草稿保留，修正版未人工审核、未发布。数据库备份：`server/backups/chunklab_db_20261020_161157.db`。
- 2026-10-20 感官审核调整：按用户批准的简化方向实施，取消重复勾选和必填备注，技术检查自动化、文件明细折叠，补齐基础句子填空试做，音频按需播放，新增可持久化的问题标记。只在最终发布确认后保存人工审批和授权声明。定向服务、完整隔离浏览器和相邻编辑页回归通过，已备份并更新本地 8787；真实 Unit 1 保持未审批、未发布。详细交互和证据见 `docs/design/admin-wordbook-review-2026-10-20.md`。
