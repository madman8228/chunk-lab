# 统一课程读取、静态分片与短期授权

- Status: in-progress
- Updated: 2026-10-15
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit: 8e19498f3bd7a8d9d7776b7e02a074689d0b0f81；工作区大量既有修改，基于当前文件续做，禁止整文件还原。
- Planner: Astra–Luna planning workflow；不推断当前模型。
- Executor: GPT-5.6 Luna（用户切换后执行）。
- Supersedes: `2026-10-14-membership-entitlements-and-trial.md` 中内容交付与独立学习页架构；保留该文的会员账本、月历续期、试用规则、数据保护和已完成实现。

## Objective

全部平台句子/图文课统一采用“构建时静态小分片、服务器短期授权、学习中少量心跳、原学习引擎”。发布时间不参与运行时分流；免费/会员只影响授权结果。复用原练习/复习/测评和 ServerStore，保留全部现有能力、课程/条目身份及历史记录。交付隔离环境下全部现有平台课及两类新发布课程的真实闭环和性能证据，不只交付授权工具或第二套页面。

## Current state and evidence

- `main.html:startDeck` 已有原练习引擎、有界批次/复习 hydration、生命周期及学习保存；`src/main/entry.mjs`、`main.html:decideEntry` 的 protected-course 分支却挂 `study-view.mjs`，另有 `assessment-view.mjs`。这是要收敛的重复运行流程。
- `js/content-repository.js` 的 ensureDeck/ensureDeckBatch/ensureDeckIndex/hydrateItems 当前读取静态大分片，可能写 IndexedDB/走旧内存；会员正文必须接新统一 gateway，不能凭旧缓存直接进入。
- `CoursePublisher` 目前每课写整份 content.json，`ContentRegistry.load` 每次解析整份再抽条目；应在发布/转换时生成受保护小分片及元数据。
- 原构建 `scripts/build-content.mjs` 有 SOURCE_ROOT/OUTPUT_ROOT 隔离支持，public manifest 仅元数据，私有 shard map 包含旧大分片引用。
- 现有 30 秒租约/15 秒心跳、幂等 start、账号 scope、月/季/年、兑换/撤销、管理发布和 pure learning writes 已测试，不重写这些领域规则。
- `js/course-catalog.js` 遇到相同课程 ID 会跳过 protected metadata，需改为同一平台实体的明确绑定；保持私人与平台来源隔离，不能让 arbitrary collision 覆盖个人内容。
- LegacyCourseInventory 只有字面证据，candidate.activationReady=false；此前只读结果 66 节/3677 项，不能把扫描当完整认证。真实库、live 服务和原 profile 均未操作。
- 当前部署 nginx 全量反代 Express；首期在现有 Node 服务完成，不引入 CDN、Nginx 模块或托管平台依赖。

## Assumptions and decisions

1. 用户已授权实现统一架构；所有平台免费/会员课经相同 gateway。用户个人课程按所有权接同一读取接口，保持免费且无需会员网络授权；不收取词汇书/教材费用，不扩大会员产品范围。
2. 一套学习引擎指同一活动复用既有 renderer/练习状态机/评分/记录。句子和图文可按教学格式使用不同适配器，免费与会员不能各复制一套练习实现。独立 protected renderer 必须退出运行路径。
3. 服务器存储静态不可变内容；用户不能直接绕过授权读取私有物理文件。服务端文件缓存可以跨账号复用，浏览器受保护正文只保留有界内存，默认 no-store；不把“公开缓存命中”当成已授权。
4. 授权按账号、canonical course/unit、明确 fragment/asset IDs、内容版本、策略版本、用途和到期时间绑定。首期签名凭证放请求头，不放 URL、localStorage、日志或用户快照；同时要求现有账号认证，不能靠泄漏的凭证跨账号用。使用独立部署密钥，缺失时会员内容拒绝授权，不复用兑换码密钥。
5. 凭证最长 30 秒，trial 不超过服务端租约/额度窗口/总期限，member 不超过会员到期；heartbeat 仍 15 秒。验证签名后还检查当前策略/会员 revision 或活跃 trial session（SQLite 小查询），实现撤销/暂停/接管及时失效；不做每次整课解析。初期这个查询成本优先于新增分布式撤销系统。
6. 首批句子最多 10 项、图文 1 项，凭证仅当前批次及对应素材；运行中最多预取一批，剩余授权时间不足不预取。授权后重复读相同文件不续租、不重复扣时、不授予其他批次。内容抓取不等于学习证明，不宣称能阻止获准用户抄录。
7. 首次成功交付仍启动体验；开始入口预检静态内容/素材，事务内沿用已有租约及收据，回首批预计算内容与首个凭证，合并首批网络请求。可从服务端有界缓存读取预构建 JSON；禁止每请求扫描/解析整课。后续静态 GET 交付原文件字节。响应丢失仍同 requestId 恢复，延续原合同。
8. 页面和目录不等待会员接口才显示；浏览目录/档案/静态预构建不启动体验。额度结束后 UI 停止新题并保留未提交答案；纯学习/测评保存保持原队列。已下载字节无法收回，测试不能声称 DRM。

## Scope

统一 gateway 与身份合同、静态分片构建/发布、短期凭证/文件入口、所有平台课绑定、原引擎接入、复习/测评/档案收敛、隔离转换验收、性能测量和构建/部署清单。

## Out of scope

真实数据迁移/覆盖/删除、清浏览器缓存、live 重启/部署、commit/push、CDN 接入、站内支付、离线 DRM、学习算法改造。实现并验证转换/启用工具，但不自动运行到真实库或修改实际课程收费策略。真实上线前必须给出目标清单、验证过的一致性备份与明确转换授权。

## Contracts and data changes

### 职责边界（组合与依赖注入）

- 新增 `src/learning/course-content-gateway.mjs`：统一 resolve/open/loadBatch/loadAssets/checkAdvance/pause/dispose；来源适配器注入；只管理读取/授权与账号 scope，不保存评分或 SRS。
- `src/membership/learning-session-controller.mjs` 继续管理租约与心跳；新增 grant client/有界内存缓存适配，失败不调用另一套 renderer。
- 新增 `server/services/membership/static-fragment-builder.js`：纯编译，输入已验证 canonical items/utterances/assets 和身份映射，输出 fragment 文件及 manifest；句子 <=10/图文1，包含原英文/翻译/意群/提示/解释/替代答案/教学顺序等必要字段，不静默删教学字段。单批 JSON 目标 <=128 KiB，超限明确拒绝并报告，不切断一个教学项。
- 新增 `content-grant-service.js`：签名/验证、时钟、密钥 provider；授权仍委托 CourseAccessService 和 trial meter。fragment ID 必须出自服务器 manifest，禁止接客户端文件路径或任意 URL。
- 新增 `static-content-store.js`：固定根白名单、真实路径限制、不可变 hash 文件索引，最多 16 MiB 服务端 LRU；只缓存文件字节/解析的静态小分片，不缓存账号权益或长期 isMember。
- 新增 `server/routes/course-fragments.js`，在 static/compress 之前挂；GET/HEAD 均认证/鉴权，拒绝 Range 和自行追加 .br/.gz 的旁路。素材 MIME 白名单/no-sniff；授权成功后 sendFile/Buffer 交付预计算字节，禁止 next 落回公开静态。
- `course-publisher.js` 与 legacy prepare/activation 工具都调用同一 builder，先写全新私有目录、验证文件 hash、再原子激活 registry/policy；失败无公开指针，保留文件便于恢复；原文件留存。
- `main.html`/`src/main`、`course-learning-launch`、ContentRepo、CourseCatalog、story adapter、stats/mistake-review 通过 gateway 使用既有引擎。提取必要的学习壳授权提示，不复制练习函数。

### 身份与持久化

- manifest 每 unit 明确 `recordIdentity:{deckId,generationScope,resumeIdentity}`；来源由服务端注册，不信客户端自报。原课程沿用原 deckId#cid、generation scope、现存 resume/session 规则，禁止改成 protected_hash 造成历史断链。
- 已经发布的 ai-UUID 私有课程保持其现有 protected_hash 记录键，作为既有身份元数据保留；这是同一个身份解析器的配置，不是第二条运行流程，不重写已存记录。
- 新发布课程直接确定稳定 recordIdentity；同一 gateway 返回该身份。个人课沿用原 owner/deck/course 键；不复制平台正文到个人快照。
- registry additive schemaVersion 2 支持 fragment/asset manifest 与 identity map；保留版本1读取转换器作为发布/启动预备步骤，运行期只走 v2 gateway；不能长期维持两套内容读取。新建 additive publish revision 表记录旧/新 registry hash、源清单、文件 hash、启用审计；不更新学习表。
- `legacy-course-inventory` 文本扫描仅证据。必须核对所有公开原始源、当前与历史 shards/index、压缩副本、包/素材/分享出口；未核对的来源阻断会员启用。源文件保留，服务器原 URL 被 guard 拦截；同源免费课由受控 gateway 继续可读，不能为保护一课让另一免费课失效。

### HTTP 和缓存

- 延续 `/api/learning-sessions/start` 幂等键与错误码，返回 decision/session/首批内容、fragment 描述和当前有界 grant；不再返回整课或隐含整课 URL。该响应 private/no-store。
- heartbeat 成功时可带当前批次续期 grant；批次切换 `POST /api/learning-sessions/content-grant` 指定 canonical unit/cursor/purpose/requestId，服务器只从 manifest 解析资源。授权元数据的字段为 grant/headerName/expiresAt/serverNow/contentVersion/policyRevision/membershipRevision/fragment descriptors。
- `GET /api/course-fragments/:fragmentId` 和素材同类受控入口：Authorization 现有 token + `X-Course-Grant`。没有 grant、错误账号/课程/文件/用途/版本、过期、接管后旧会话全部拒绝。先授权后缓存访问/304，不能304绕过到期；禁止任意 public alias。
- 前端每次消费已预取的下一题也检查单调时钟和账号 scope。内容缓存按 owner+API base+epoch+course+unit+contentVersion，最多当前/下一批，切账号丢弃该组件内存引用，不删除原浏览器数据。
- SW 对 `/api/*` 保持 network-only；禁把 grant/付费文件加入 CacheStorage/IDB；首页/目录静态资源仍现有缓存。服务端缓存优化不能改变客户端 no-store。
- free 同一授权入口直接放行、不启动 trial。个人 owner adapter 不受会员到期影响。未知课程/损坏 manifest 为 503/404，不能回退公开或显示已删除。
- 正式测评沿既有 assessment engine/operations 单项交付和周期，纯 answer/finalize 保留；统一测评 renderer、统计事实和审计，移除第二个 ProtectedAssessmentView 挂载。恢复本人历史不额外取新标准正文，开始新测评仍授权。

## Implementation steps

- [x] 1. 记录当前隔离浏览器基线耗时/请求数和所有入口/教学能力清单，补 recordIdentity 合同测试；不先删除旧实现。
- [ ] 2. 完成 builder/store/grant 及路由纯/隔离服务测试，验证私有静态字节与范围授权、文件完整性、回放/时钟/失联边界。
- [ ] 3. 发布两种格式改用统一 builder；构建和 legacy 工具输出完整 v2 manifest 与 identity；实现可审计、乐观版本/幂等的私有启用事务，冲突时拒绝，原文件/学习记录不变。
- [ ] 4. gateway 接 ContentRepo/原句子和图文 adapter。所有 platform entry（目录/decks/首页/复习/测评/老深链/protectedCourse）归一为 canonical course/unit/activity；旧 URL 只做解析映射，调用同一 renderer。修复 catalog 同 ID 绑定和 metadata 去重。
- [ ] 5. 在原引擎题目推进/素材获取边界检查租约；预取最多一批。复用完整 typing/chunkSelection、提示/解释、图文、原模式、复习和测评；不改评分/间隔策略。free/personal 同一学习调用路径，授权适配器处理差异。
- [ ] 6. 去掉 study-view/assessment-view 的产品挂载和重复记录/评分代码，仅在回归全通过后移除已无人调用的源码；保留数据、文件、备份和身份映射。不把“保留兼容”作为继续运行双引擎的理由。
- [ ] 7. 用新临时根构建全部当前平台课程，并运行临时 activation（新临时 DB/私有目录）；真实HTTP+浏览器验证所有平台课均能设置访问级别、新旧身份记录/断点保持、免费与个人不扣时、各旁路被挡。完整来源无法验证时不能报 complete。
- [ ] 8. 完成性能/异常验收、更新生成物/部署清单/SW 与本文。只报告隔离运行结果，真实环境保持未更新。

## Validation

所有持久化/迁移测试新分配 temp 数据根、端口和浏览器 profile；不得指向 server/data、用户档案或 live。只运行定向命令，不跑带全量生成副作用的 npm test/pretest。

- [ ] 新增 `static-fragment-builder.test.js`、`content-grant-service.test.js`、`static-content-store.test.js`、`course-content-gateway.test.mjs`，直接 node 运行；Node18 target，记录实际测试Node版本。
- [ ] 扩展 `server/membership-content.test.js`：免费课ID不能读会员文件、原URL/HEAD/Range/多层编码/压缩/源/索引/包/素材/公开deck/内部assessment均不能旁路；hash变更/路径越界/共享来源/策略更新/旧grant/过期/暂停/接管/密钥缺失/其他账号；失败不得提前启动体验，late answers/history/export仍可用。
- [ ] 新增 `server/membership-unified-activation.test.js`：用 CONTENT_SOURCE_ROOT/OUTPUT_ROOT 的合成源及全新临时库验证全部课程覆盖、原course/deck/item/generation/resume不变、文件保留、乐观冲突、故障回滚、同请求重试、旧已发布记录键；不伪装文本扫描已认证。
- [ ] 扩展 `e2e/membership-learning.test.js`，断言进入原引擎、`__protectedCourseView` 不存在；两种格式的免费/会员/个人，同ID历史/断点，发现/首页/目录/复习/测评/旧深链；兑换/到期/续期、离线/重连、响应丢失/迟到、跨账号/多标签、手机/键盘、当前窗口与3天边界。
- [ ] `node e2e/membership-admin.test.js`、`node e2e/ai-course-native-learning.test.js`、`node server/operations.test.js`、`node course-catalog.test.js`、`node src/membership/policies.test.mjs`、`node src/membership/learning-session-controller.test.mjs`、`node server/membership-api.test.js`、`node server/services/membership/legacy-course-inventory.test.js`。
- [ ] `npm run typecheck`、新增修改文件定向eslint、`node scripts/check-generated.mjs`、`node scripts/check-deploy-files.js`、`node scripts/check-sw.js`、`node sw-policy.test.js`；不得提高缓存/词汇图片预算。

### 性能证据

- 新增隔离浏览器脚本 `e2e/membership-content-performance.test.js`，新profile冷启动和同context暖启动各10次，输出 JSON 记录实测中位/p95、字节、请求数；同机器/fixture，先保存现状基线再改动。普通本地及 RTT150ms/1.6Mbps 网络各一组，不能只以localhost证明生产性能。
- 首页/目录第一屏不等待membership/session/grant；开始学习首批接口总共1次HTTP请求（图片除外）；批内切题正文请求0。预取场景最多当前+下一批，禁止整课下载。
- 同fixture冷启动首题中位相对原同功能基线增加不超过1个模拟RTT+100ms；如果不可比则只报告绝对值/请求证据，不捏造提升百分比。暖批内下一题可操作p95目标100ms，无意群/提示/解释功能回退。超过目标先定位，不承诺未测的生产SLA。
- 文件路由重复读取相同版本命中服务端有界缓存，测试证明不再每次全课JSON解析；并发账号缓存正文可复用、授权不复用。

## Acceptance criteria

- [ ] 平台旧课/新课、免费/会员，均走同一gateway和已有活动引擎；不存在新旧/付费两套renderer；所有原能力实际可用。
- [ ] 全部当前平台课在隔离实例完成静态受控发布与管理设置，canonical身份和原学习记录/断点对应；个人导入内容仍可学/备份。
- [ ] 请求正文需有效授权；短期凭证只含明确范围且服务端验权，心跳只交换小型元数据；过期/撤销/接管阻止新内容，完成答案不丢。
- [ ] 正文构建为不可变静态小分片，服务器有界缓存；目录/页面缓存不受阻，性能脚本提供冷/暖/受限网络的实际证据。
- [ ] 所有指定验证通过，发布/来源不完整时保持拒绝；无覆盖/删除真实内容、原profile、备份或账号历史。
- [ ] 实现完成后另行报告真实启用目标和备份步骤；本交付未执行真实转换、收费切换、live重启、部署/提交/推送。

## Risks and rollback

已下载副本无法收回；短期凭证/有界预取只是后续在线获取的控制，不能声称删除旧缓存即保护。免费改会员后旧浏览器缓存仍可能有已下载字节，统一gateway必须避免新会话拿旧持久缓存跳过授权，但不得清空用户资料。

回滚只退新版本/新指针，不回删资产/账本；保护服务失败保持503，不恢复会员原文件公开访问。保存兼容读取不应回滚成双学习引擎。首次密钥部署是上线配置项，运行前要有明确失败提示。

## Execution notes

2026-10-15：用户明确否定新旧两套流程，并授权按“静态小分片+短期授权+少量心跳+统一学习引擎”实现。规划只读核查当前发布器、registry、controller、主引擎入口/批次加载、ContentRepo、课程目录、测评服务及nginx反代配置，确认当前分叉需整体收敛。本轮仅写交接文档，未修改产品代码、运行测试、访问真实数据库或启用课程。下一轮按本文执行。

### 2026-10-15 执行进度（仍为 in-progress）

已实现：

- `static-fragment-builder` 保留教学条目字段、角色/编写信息等上下文和 recordIdentity；句子最多10项、图文1项、单片128KiB，确定性hash。
- `static-content-store` 私有根、真实路径、hash/size校验、16MiB字节LRU；账号鉴权不缓存。v2 registry读取走分片，不解析整课原件。
- `content-grant-service` 独立密钥、账号/课程/单元/用途/资源/版本绑定、最长30秒、单调前端期限及服务端当前权益复核；真实HTTP路由已挂载。原始正文分片接口拒绝正式assessment用途，正式测评仍须经过既有eligibility/operations入口，统一renderer接入尚待完成。
- 两格式新发布生成分片、保留私有content.json原件；additive `membership_content_publication_revisions` 记录文件hash、来源、旧目录版本和审计；失败回滚指针/审计，保留文件。
- legacy准备工具输出v2候选；新增 `prepare-static-course-registry` 可在全新目录准备现有私有v1条目，保留原件和既有protected记录键。两类候选均 activationReady=false，**没有安装到真实registry或改变收费策略**。
- `CourseContentGateway`、platform/personal来源适配器已实现并通过合同测试，最多当前+下一批、账号/API/epoch隔离、到期阻止消费、迟到响应隔离、缓存批次只续授权元数据。**尚未接ContentRepo/main/courses产品运行入口。**
- CourseCatalog对身份映射完整的同ID内置课程绑定服务端metadata，保留原课程标题、课节和旧内容身份索引；个人ID碰撞不覆盖。映射不完整拒绝绑定。

改造前浏览器基线：`output/membership-performance/baseline-1792031397879.json`，脚本 `e2e/membership-content-performance.test.js`；4组各10次，新临时数据根/端口/Chromium context。测量导航到首题可见（包含页面与点击），不代表生产SLA，也还没有批内切题耗时。

| 网络 | context | 首题中位ms | p95ms |
|---|---|---:|---:|
| 本地 | 冷 | 1187 | 1313 |
| 本地 | 暖 | 1159 | 1208 |
| 150ms / 1.6Mbps | 冷 | 3449 | 3827 |
| 150ms / 1.6Mbps | 暖 | 3034 | 3784 |

原引擎能力/入口核对清单（统一接入验收不得遗漏）：

| 入口/能力 | 当前实现 | 接入时要保持 |
|---|---|---|
| 首页/发现/课程库/目录/旧deck深链 | main entry、CourseCatalog、ContentRepo | canonical unit映射、原deck身份、登记、断点 |
| 输入/意群选择/提示/解释/角色上下文/TTS/原学习模式 | main startDeck/renderQ、MainCourseLearningPolicy、answer-evaluation | 原状态机、提示与判分、教学字段 |
| 图文/图片素材/移动布局 | courses活动引擎、image-text adapter | 逐项素材授权、Blob生命周期、原活动UI |
| 错题/SRS/手动复习/档案 | ContentRepo hydration、stats/mistake-review | 原统计键、generation、只读历史无需新正文 |
| 正式测评 | 原assessment renderer与operations | eligibility、答案/完成队列、本人历史、单项交付 |
| protectedCourse/reviewItem/assessmentItem旧链接 | 当前仍挂独立view | 最终必须映射进原活动引擎并去掉独立view挂载 |

已运行通过（实际 Node v22.12.0；未声称已在Node18执行）：

- 新增builder/store/grant/gateway/preparation合同测试、`server/course-fragments.test.js`。
- `server/membership-content.test.js` 已扩展v2真实服务，验证首批单次响应、启动收据重试、授权错误回滚trial/receipt、数值账号、下一片范围、元数据续发、暂停立即失效。
- publisher、legacy inventory、membership controller/API/regressions/policies/history、server operations、course-catalog。
- 真实Chromium：`e2e/membership-learning.test.js`（含测评流程）、`e2e/membership-admin.test.js`、`e2e/ai-course-native-learning.test.js`、learning-archive UI。
- typecheck、定向ESLint、check-generated、check-deploy-files、check-sw、SW22/22；定向build-membership/gen-sw。部署白名单补齐4个服务端模块；环境示例新增独立grant密钥。未跑全量生成或npm test。

下一项必须继续：原活动引擎/ContentRepo/图文/复习/测评的运行时接入和身份合同收敛；移除产品独立view挂载；可审计启用工具与全部平台课程临时转换闭环；改造后相同fixture性能及批内切题/异常验收。当前registry仍暂留v1动态读取以承接尚未转换的既有运行入口，这不是最终允许保留的第二条流程，完成前必须收敛。尚未完成整体步骤2–8，不得报告全部实现。

全程没有修改真实课程/用户记录/原浏览器profile，未重启live、部署、提交或推送。

### 后续执行：原引擎运行时接入

- 新增 `src/learning/native-course-session.mjs`：授权壳与静态batch投影，挂入 `main.html:startDeck/renderQ/nextQuestion`；输入、意群选择、提示、解释、学习写入均复用原函数。句子/图文共享原练习引擎，图文按需获取Blob图片/音频。`courses.html?protectedCourse`入口转到同一native入口。
- 正式测评的开始/历史恢复授权壳调用原 `renderAssessmentSession` / `renderServerAssessmentResult`，答案与交卷保留ServerStore；未提交输入按账号存原assessmentDrafts，并通过刷新检查。源身份解析和generationScope接通，保留已发布protected身份与原deck身份。
- 原 `study-view.mjs`、`assessment-view.mjs` 已从browser bundle退出并移除未被调用源码；产品不再挂独立renderer。
- v2已转换课程旧无grant正文/素材HTTP入口返回410；静态fragment/asset入口仍需授权头。v1服务器预备读取尚待全部转换工具收敛，不代表最终双运行流程。
- ContentRepo对已注册平台课程提供不含标准正文的metadata index，档案不启动trial、不获取正文；历史服务可识别原deck记录键。个人课程碰撞不覆盖。尚未注册的内置课程在学习入口显示暂不可用/可重试，不回落公开旧缓存；**在全部平台课程转换验收完成前不可部署这份候选版本**。
- 单项复习用临时review身份+原statsDeckId，保留主课断点；原教学顺序、chunk顺序、source indices、隐藏条目保留。授权期满后保留当前答案，推进新题前/异步保存后再次检查；本轮保存仍不受权限影响。
- 控制器/grant metadata不保留首批正文，gateway最多当前+下一批，素材URL切批/退出回收。学习壳显示剩余体验时间、会员到期/免费状态，沿用页面主题变量。

新增/更新隔离浏览器验收 `e2e/lib/native-membership-browser.js` 已走通：首批1次正文HTTP、原renderer存在且`__protectedCourseView`不存在、原published记录/断点、体验到期保存当前答案并阻止推进、兑换续学、刷新、图文375px、免费课不计时、意群选择、单项复习不改主断点、档案无正文请求、原测评刷新输入/提交/交卷/到期后历史结果。后续加测原legacy generation/会话身份，测试fixture独立于真实数据。

已通过：native投影/脚本语法、gateway/controller、真实membership-content HTTP、membership API/regressions、server operations、catalog/policies/history、main lifecycle；Chromium native membership、AI个人native learning、archive UI、admin；typecheck、定向eslint、check-generated、deploy清单、SW22/22。检查应在最终批量转换后再完整重跑。

性能第二次证据 `output/membership-performance/after-1792035039570.json`，每组10次：本地冷/暖首个native输入中位1383/1380ms，150ms/1.6Mbps冷/暖4893/4189ms；批内下一题p95分别15.8/16.7/24.1/19.4ms，正文请求0；开始首批正文HTTP=1。已让练习模块与授权壳并行准备。原baseline测到简化示例屏，本次测到完整原引擎输入，功能不等价，**不宣称整体性能改善或达到冷启动相对目标**。仍需定位完整原引擎首开成本、全量转换及异常多标签验收。

剩余交付边界保持in-progress：可审计全量启用事务/工具、所有当前平台课程隔离转换与来源覆盖认证、跨课程批量复习hydration的统一授权、全部旧深链和多标签异常回归、最终性能验收。没有真实转换/收费切换、live重启、部署、提交或推送。

### 启用事务进度

新增 `static-registry-activation.js` 与 additive `membership_static_activations`：校验指定候选hash、人工来源/运行验证证据、当前目录版本及原有课程/unit/item/recordIdentity覆盖；只写全新hash私有目录，事务内切换DB manifest指针并审计，不覆盖registry.json、课程原件或学习表。当前服务读取最后成功激活指针，已发布新增课程仍合并。未通过证据检查的候选保持拒绝，没有HTTP自动启用或真实迁移。

`node server/membership-unified-activation.test.js` 已在新临时目录/DB通过：review缺失、乐观版本冲突、插入故障回滚、失败私有文件保留、同请求重试/改载荷冲突、原recordIdentity/内容/合成记录保持、旧公开alias guard。真实 `server/membership-content.test.js` 回归通过。此测试只证明合成fixture的事务，**不代表全量平台来源已认证**；生产备份/精确目标审批、全量转换、运维CLI及批量复习仍未完成。

运维CLI现已实现：`scripts/static-course-registry.cjs` 提供inspect/prepare/activate；检查和准备只读打开现存DB，不导入db.js，不自动初始化/迁移；启用要求精确目标审阅与新备份路径，SQLite backup API一致性备份+integrity_check+hash后才执行事务。新测试 `scripts/static-course-registry.test.cjs` 通过只读前后DB字节不变、准备不写DB、备份含启用前指针、激活及同请求重试、备份覆盖拒绝。使用说明见 `static-course-registry-cli.md`。此进度替代上段“运维CLI未完成”；全平台来源认证/转换、批量复习及最终异常性能验收仍未完成，状态保持in-progress。未执行真实迁移/启用或重启服务。

### 全量本地候选转换与扫描修正

- `prepare-protected-courses.cjs --all true` 显式选择目录全部平台课；不与 `--course` 混用，不自动安装。
- 全量检查发现来源扫描正则特殊字符转义错误，可能误匹配或耗时异常。已修正为字面匹配；补充仅含句子、不含cid的复制文件，以及括号/问号/方括号/加号等测试，验证精确命中与不扩大匹配。
- 当前工作区内置来源已在全新临时目录生成候选：2课（builtin:oral / builtin:idioms）、66单元、3677项、400静态分片。完成一次完整registry校验，再逐片核对实际hash/size、course/unit/cursor/item IDs/recordIdentity。证据：`output/membership-source-review/all-platform-conversion-1792041318181.json`。原文件只读，未连接真实账号DB。
- 来源报告294条路径；coverage仍为local-literal-evidence-only，publicSharesChecked=false、activationReady=false。没有将本地扫描冒充公开分享/计算编码出口认证，也没有启用真实课程。
- 对每片重复调用完整registry.load的压力式检查耗时过长，主动中止，不能计为通过；随后采用上述单次目录+逐文件完整性校验完成离线候选验证。发现读取每次遍历全目录的成本需继续优化并实测；本轮仅先去掉load内部再次调用fragmentScope造成的重复snapshot，保留单次snapshot及实际分片hash/路径校验，新增单次读取snapshot次数和片内cursor切片回归。
- 本轮通过：legacy inventory、prepare-static-course-registry、course-fragments HTTP、membership-unified-activation、static-course-registry CLI、membership-content真实隔离服务、typecheck、上述修改文件定向ESLint。未重新测完整浏览器性能，不报告性能改善百分比。

剩余：全平台临时实例启用和HTTP/浏览器验证、来源完整认证、跨课批量复习、多标签异常、全量目录成本及最终性能；保持in-progress。未操作真实数据、live服务、部署或提交。

### 全量目录复用与真实分片HTTP验证

- ContentRegistry新增单份不可变metadata缓存：key覆盖当前manifest正文、当前published列表、激活来源及真实根路径。每次仍读取当前provider/磁盘manifest，变更/回滚立即换key；无账号/会员/租约缓存。目录改变时完整验证，未改变时复用冻结的元数据对象，避免每个正文/静态路径请求重复遍历400文件。实际分片仍由StaticContentStore逐次真实路径/stat检查及变更后hash验证。
- `content-registry-cache.test.js` 新增验证不重复遍历、禁止调用方修改缓存、激活正文/发布列表/回滚更新、无效/丢失manifest拒绝、磁盘alias更新、热缓存后正文篡改/缺失拒绝。
- 新增 `e2e/membership-platform-fragments.test.js`：只读当前源，在全新临时私有目录转换全部课程，随机端口运行真实grant/fragment HTTP路由；注入测试账号/策略，不连接真实DB或伪造生产启用审批。全部2课/66单元/3677项/400分片HTTP交付和registry.load一致，保持原教学字段、内容与recordIdentity；策略变化、缺凭证、热缓存后权限拒绝/HEAD/到期检查通过，共802次授权检查。
- 证据 `output/membership-source-review/all-platform-http-1792041581862.json`：单次冷目录472.9ms、100次复用目录合计563.8ms、整个400分片交付循环9017.4ms。仅本机测试，不能当浏览器首题或生产SLA。来源coverage仍local-literal-evidence-only、publicSharesChecked=false、activationReady=false，尚不代表完整应用启用/全平台浏览器或来源认证通过。
- 已通过：metadata-cache、publisher、activation、prepare、CLI、course-fragments HTTP、membership-content真实隔离服务、native membership Chromium、typecheck、定向ESLint、部署清单。浏览器回归再次验证原引擎/身份/体验/续学/记录/图文/测评历史；未操作真实数据或live服务。

浏览器性能复测已通过，证据 `output/membership-performance/after-1792041813551.json`（合成30项fixture，4组各10次；并非400分片全平台浏览器实例）：本地冷/暖首题中位1257/1308ms，150ms/1.6Mbps冷/暖4393/3668ms；批内切题p95分别15.1/16.6/39.0/39.6ms，均小于100ms，正文请求0；首批正文接口仍1次。此前简化屏baseline功能不等价，不据此宣称达到相对首开性能目标或生产SLA。全量目录首校验仍约473ms，受限网络首开仍需关注。

当前仍未完成：全平台完整应用启用/浏览器验证、来源完整认证、跨课批量复习、多标签异常补齐；状态保持in-progress，本轮无真实迁移/重启/部署。
