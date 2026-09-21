# 工程维护改造：CI、模块边界、静态检查与工具链决策

- Status: in-progress
- Updated: 2026-09-21
- Branch/worktree: master，D:/06-project/chunk-practice（使用当前工作区，不从 HEAD 创建遗漏未提交功能的新工作树）
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca；基线是当前工作区，不只是该提交。已有课程包 2.0、管理后台、内容修订、部署和统计页面改动，见下文。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

完成一轮有边界的工程维护改造：让同一套检查在本地和 CI 中运行；让核心领域逻辑、首页初始化和服务器路由有可维护的文件边界；加入增量静态检查；保持学习、存储、同步、课程导入及部署行为。用户要求规划的五项均在本文作出决策，其中 1–3 是本轮实施，4–5 的交付是明确工具链与内容管线边界及对应验证，不承诺立即迁入 Vite、全面 TypeScript 或重写内容源。

## Current state and evidence

- 未发现根目录、项目父目录或项目内部 AGENTS.md；执行前如出现新指令须读取。
- core.js 3,178 行，主闭包同时承载存储、rev、同步、多标签页合并、领域规则和事件；main.html 5,775 行；server/index.js 1,436 行。行数不是验收目标。
- js/bridge.mjs 将纯 ESM 模块挂至 window；main.html:5619 起有引擎等待轮询，记录了模块 defer 与 ensureCloud 的历史竞态。已有防护，不能把它表述为当前必现故障。
- package.json 的 test 是 61 个 node 命令加 cd server 的 && 链；70 个 *.test.js/*.test.mjs 文件不等于 70 个用例。scripts/e2e-all.js 已有失败收集、超时和汇总，不应删掉已有能力。
- 未发现仓库 CI 配置。scripts/deploy-prod.sh 已有测试、备份、发布与上线检查，不能称为没有任何发布自动化。
- scripts/check-sw.js 哈希不匹配且工作区有受跟踪修改时返回 0；缺失 SW / 解析不到标记也会跳过。CI 必须明确禁止这些宽松路径。
- scripts/lib-deps.js 的 resolveSpecifier 拒绝所有含 .. 的路径；分目录后的合法 ../ 导入会漏扫。HTML 属性扫描仅接受双引号。需先修依赖发现，再做拆分。
- 已有 esbuild、ajv、playwright-core。scripts/build-course-schema-validator.js 在 pretest 中生成浏览器校验器；README 的完全零构建表述已不准确。
- oral-book.js 是忽略的装配产物，freq-idioms.js 是构建内容源；当前业务 HTML 不直接加载它们。scripts/build-content.mjs 输出 JSON 分片，js/content-repository.js:246/279/310 实现 manifest、详情和索引加载。manifest 当前 66 个 deck、totalCount 合计 3,677；不能把题库名“8000”当实际数量。
- 测试存在对 window.S 等全局变量的直接访问，例如 e2e/main-startup.test.js:76；抽出首页脚本不能无意破坏这类兼容点。
- 当前工作区已有修改：README.md、api.js、core.js、course-package.js、course-storage.test.js、main/courses/decks/stats.html、package*.json、scripts/lib-deps.js、scripts/deploy-prod.sh、server/index.js/db.js/smoke.test.js/.env.example、deploy 文档与 setup-env.sh、sw.js、freq-idioms.js、extra/batch4.json、manifest 与高频短语分片、e2e/course-catalog.test.js、e2e/e2e.js。
- 当前未跟踪功能包括 admin.html、server/admin.js、assets/icons、课程包契约与 vendor 校验器、对应生成脚本和课程包 E2E、stats-mastered/tab-content-consistency 测试、课程包实施说明。不得删除、覆盖或排除这些功能；同名文件先读当前内容。
- 规划阶段没有运行全套测试，不宣称基线为绿。执行首先记录基线失败；不能通过删除断言或跳过失败套件获得“通过”。

## Assumptions and decisions

1. 本轮保留多页面结构、当前生产静态路径与 server/index.js 启动命令，不改框架、不设计新产品功能。
2. 使用已安装并锁定的 esbuild 实现“ESM 源码 + 浏览器兼容产物”。core.js 保留 URL 和同步建立 window.CL 的能力，变为生成产物；首页生成 js/main.js。运行时兼容 IIFE 是明确边界，不声称全站运行时已完全统一 ESM。
3. 本轮不引入 Vite。已有 esbuild 足以完成模块抽取与确定性构建；HMR、完整多页面构建输出和生产拆包不是本轮目标。将来迁入 Vite 必须连同 SW、静态发布和输出路径一起设计。
4. TypeScript 仅作为检查工具：使用 JSDoc + allowJs/checkJs/noEmit 检查指定的新模块与工具脚本。暂不把现有文件批量改成 .ts/.mts，不设置全仓类型检查门槛。
5. 源码位置 src/core/、src/main/；现有 js/*.mjs 纯逻辑继续复用，不能复制实现。生成产物入库，以保持现有服务器无需启动时构建；只有源码允许手工修改。
6. 不将存储、同步、账号代际与写队列同时彻底重设计。第一轮把它们保留在明确命名的 legacy-runtime.mjs 中，抽出可独立验证的领域/合并/事件逻辑。接受剩余大模块，记录后续边界，不以改名冒充完成拆分。
7. CI 默认 GitHub Actions，Linux + Node 22；两个 lockfile 都使用 npm ci。PR/push 只验证，不部署、不接触生产密钥。根依赖不更改为 type:module，以免破坏 CommonJS 测试和工具。
8. JSON 内容分片已实现；保留内容源格式与现有编辑脚本。本轮验证运行时不请求大 JS 源、构建结果稳定，更新事实描述。未来只有多编辑工具共享需求等实际收益出现时才迁移源格式。

## Scope

| 项目 | 本轮交付 | 结束边界 |
| --- | --- | --- |
| 1 CI/测试入口 | 明确测试清单、分组执行、统一结果、严格生成物/SW 检查、PR workflow | 同一本地命令可供 CI 使用；不要求发布到 GitHub 才算代码交付 |
| 2 模块拆分/ESM | core 领域与纯逻辑模块、首页控制器边界、服务端服务与路由拆分，实际接入现有页面 | 学习行为、存储/同步协议、API 路径保持；不做全站模块转换 |
| 3 静态检查 | ESLint 有限范围 + JSDoc 类型检查 + 可选格式检查，接入同一验证入口 | 新模块与工具受检，历史文件不做全量重排 |
| 4 构建工具/TS | build/check 命令、生成物规则、有限类型边界；README 记录不引入 Vite 的决定 | 当前 esbuild 可重复构建并检验；不新增 dist 部署模式 |
| 5 内容管线 | 源/产物说明、运行时请求断言、确定性验证 | 不改变内容、cid、deckId、分片序列化或学习进度 |

## Out of scope

- 不提交、推送、部署、开 PR，不操作 GitHub 仓库设置/分支保护；不得将这些外部动作列为本轮完成的前提。
- 不做 SQLite/IndexedDB schema 变更，不改同步冲突算法，不清空用户数据，不修改课程包协议。
- 不全面迁移 Jest/Vitest，不立刻并行浏览器套件，不全面覆盖率门槛，不以工具替换现有业务断言。
- 不拆所有页面、不统一全站 CSS。本轮首页 CSS 保留，避免同时改变主题/对比度扫描规则。
- 不改高频短语或口语内容源，不为文件大小本身重新生成内容，不用生成 SW 掩盖输入不一致。

## Contracts and data changes

### 运行时与源码

- src/core/index.mjs 装配导出的 createCore(global) 并赋给 window.CL；生成 core.js，保持普通 script 同步执行和现有全部 CL 方法、getter 函数及 __crossTab 测试口不变。实例状态不得变为跨 window 的共享单例。
- src/core/legacy-runtime.mjs 暂时保留 load/save/preload、账号作用域、rev/outbox、跨标签页通知、云端同步与写队列。只将纯逻辑改为导入调用；不使用巨型可变 ctx 把闭包分散到多个文件。
- src/core/merge.mjs：mergeKeyedMap、mergeDaysLogTabs、mergeBySentenceTabs、mergeBest、mergeEventsTabs、mergeStatsForTabs、mergeMemInto 及所需纯 helper；mergeStats 及其校验 helper 同归此处。显式传参，禁止反向依赖 runtime。
- src/core/identity.mjs：fnv8/cidOf/cidKey 等纯身份函数；依赖 BUILTIN 的迁移函数先留 runtime，不改变 cid 计算。
- src/core/domain.mjs：题库视图/删除过滤/掌握判定；涉及 BUILTIN 的调用显式传入 builtin 数据，CL 包装器保留旧签名。
- src/core/activity.mjs：ymd、dailyActivity、streakDays、todayRounds、bumpDaysLog、backfillDaysLog、answerStatsAudit 与 demoStatsSample 的依赖闭包；保留默认当前时间行为，可在测试传入时间。
- src/core/event-bus.mjs：createEventBus() 返回 on/emit，取消订阅与监听异常隔离保持；parent.postMessage 导航兼容函数留 runtime。
- 首页 src/main/index.mjs 是构建入口；src/main/app.mjs 持有剩余练习状态与主要流程。必须另外抽出 src/main/entry.mjs（resumeOrStart/decideEntry 的入口决策，通过命名回调访问当前 mem）、src/main/boot.mjs（本地首屏/云同步后的初始化协调）、src/main/feedback-effects.mjs（音效/朗读/特效，使用 getSettings/getCurrentItem 而非复制状态）。不得只将整块 inline 原封不动搬到一个文件作为最终交付。
- 首页直接 import ChunkEngine/FormatTools/AIPrompts/BackupTools/CauseTools，替换 window 模块查找，移除页面 bridge 标签和引擎等待轮询；实际打包产物中依赖先就绪。保留本地首屏不等待云端和用户已开始练习时不重置入口。
- 兼容访问审计覆盖所有业务 HTML/JS 和 E2E。window.S、mem 等被外部读取的动态状态通过显式 getter/setter 或原有稳定对象公开，不能 Object.assign 一个过时快照；无需全局暴露整个模块。
- 错误处理：main.html 保留小型、自包含且无业务逻辑的早期错误提示入口，能处理 js/main.js 加载失败；不在失败时继续练习或生成空选项。成功加载时只初始化一次。

### 服务端

- server/index.js 保留启动、安全校验、迁移完成后 listen、压缩预热；server/app.js 提供 createApp(deps)，导入不监听端口。
- server/services/data.js：buildMemSnapshot/readMemSnapshot/saveData、upsert、序号/行级写入及缓存语句；server/services/migrations.js 放现有两项迁移，通过显式 data service 方法共享写入，禁止循环 require。
- server/services/resolutions.js：现有 resolution service 装配、makeBatchReplacement，复用 data service；事务原子性和幂等回执保持。
- server/middleware/auth-rate.js 集中现有 rateBuckets 和 rateBlocked/rateHit/rateClear/send429；同一个实例供普通和管理员登录使用。
- server/routes/{system,admin,auth,data,sync,courses,decks,ai,backup,feedback}.js 各导出注册函数或 router；admin 的统计辅助函数随路由移出，已有 server/admin.js 身份服务继续复用。
- 保留所有 HTTP 路径、状态码、JSON 内容、鉴权/限流、压缩、请求体限额、CORS、静态拒绝规则及中间件顺序；不得把 /api/auth 的 64kb 限额变成全局 80mb。
- 启动次序保持：账号初始化/安全检查、stats 迁移、entity 迁移、initChangeSeq、listen。重构不执行新增数据迁移。

### 工具与内容

- 构建目标 core.js、js/main.js、现有 js/vendor/course-schema-validator.js，非压缩便于诊断（现有 vendor 可保留压缩）；输出无时间戳/绝对路径且确定性。不要在 prod 启动时构建。
- build:check 将输出写到系统临时目录并与当前产物比较，失败非零；不写工作区。content:check-generated 同理在临时工作区装配并比较已跟踪 builtins/content 产物，不能在真实目录调用会删分片的脚本。
- check-sw --strict 或 CI=true：哈希不一致、SW 缺失、标记无法解析、资源缺失、无法判定均失败，不受 Git dirty 状态影响。本地默认宽松行为可保留但提示明确。
- 依赖路径：允许解析后仍处于仓库根内的 ./ 和 ../；拒绝解析后越界、远程 URL、裸 npm 导入；脚本/CSS/模块依赖都纳入该资源类型适用的闭包。构建产物不能遗漏新增模块或带入仅测试资源。
- 内容 schema、JSON 字节序列化、排序、cid、deckId、contentVersion 计算不变；现有内容修改作为基线，不回退到 HEAD。

## Implementation steps

- [x] 0. 重新读取本交接与 git 状态，设 Status=in-progress；记录工作区文件摘要以保护已有改动。执行现有 npm test、test:accounts、test:batch-sync 和有关新增课程包/统计测试，记录基线及环境要求。若发现影响本轮验收的既有失败，先做聚焦诊断；不得默默标记通过。
- [x] 1. 新增 scripts/test-manifest.cjs 与 scripts/run-tests.cjs。把原 test 命令逐条迁入带 id/file/args/cwd/group 的显式清单；加入此前分立的账号、batch-sync、新增课程包导入/统计/跨标签一致性测试，去重。组为 checks/unit/server/browser。串行执行，失败后继续，最后统一返回码；信号中止/超时必须算失败并收回子进程。输出终端摘要及 output/test-results/<group>.json。
- [x] 2. 原 e2e:all 保留诊断用途；新标准清单仅接入自包含、无外部工程依赖的测试。course-package-v2-real-export 若依赖邻仓实际导出，保留 explicit integration 命令并说明前提，不在 CI 假称覆盖。新增清单一致性检查：所有 .test.js/.test.mjs 都必须纳入或有逐文件排除理由；其它 validate/check 脚本沿原入口保留。
- [x] 3. 用 node:test 写调度器有限验证（单个失败不阻止后续、错误 cwd/超时非零、结果包含全部指定套件）；提供 test:checks/test:unit/test:server/test:browser，npm test 为四组完整执行，不再 && 中途跳出。prepare 步骤失败可立即停，因为运行条件不成立，需区别于套件失败。
- [x] 4. 先修 scripts/lib-deps.js 合法父路径解析并补边界测试，再实现 check-sw 严格模式与对应负向测试；同时保持 gen-sw/check-deploy 使用相同依赖事实。部署文件清单需覆盖后续 server/routes 和 services；若扫描器扩展了后端闭包，测试保证遗漏任一服务模块可被发现。
- [x] 5. 建立 scripts/build-app.mjs 与 scripts/check-generated.mjs，复用现有锁定 esbuild；统一 build/build:check，纳入课程 schema 构建。生成入口明确覆盖 core.js 与 js/main.js。迁移 pretest 的 prepare 行为到受控入口：CI 不自动覆盖待检查的受跟踪产物；仅 oral-book 等忽略产物可在 prepare 生成。
- [ ] 6. 依照上述 core 边界逐组提取。每组生成 core.js 后运行存储/统计/多标签合并相关原测试，最后验证原 CL 对外成员/行为未变。新增源码模块级测试只覆盖提取易出错的状态隔离、合并和身份边界；不复制整套现有断言。身份、合并、活动和事件四个纯边界已完成，存储同步 runtime 装配仍待完成。
- [x] 6.a 完成存储 runtime 的第一条低风险边界：新增 `src/core/runtime.mjs` 的 `createSingleFlight()`，生成 `js/core-runtime.js`，接入四个业务页面并让 core 的 IDB 预载共享同一 in-flight Promise；保留旧回退路径及 `refreshExternal()` 的显式清空语义。新增并通过 runtime 契约测试；未改变存储格式、账号作用域、同步协议或写队列。
- [x] 6.b 完成存储 runtime 的第二条低风险边界：同一模块新增 `createTaskQueue()`，接入 courses/progress 两条 IDB/本地写入尾队列；队列失败后仍可继续处理后续任务，原有 `waitForSync()` 等待语义保持不变。新增失败恢复与顺序契约测试；未改变保存内容、rev、账号作用域或同步协议。
- [x] 6.c 完成统计 runtime 的第三条低风险边界：同一模块新增 `createLatestWriteLane()`，接入 stats 的“活动提交 + 最新待提交合并 + 队列满拒绝”调度；统计快照生成、IDB 事务和错误语义仍留在 core。新增 lane 契约测试；未改变统计数据结构或同步协议。
- [x] 6.d 补齐内容仓库的并发边界：`js/content-repository.js` 对同一 index 分片增加 in-flight 请求合并；统计首屏、异步同步和跨标签刷新并发时不再重复请求同一索引，保留失败后可重试语义。
- [x] 6.e 完成跨标签通知的低风险边界：`src/core/runtime.mjs` 新增 `createTabNotifier()`，统一写 beacon、BroadcastChannel 消息过滤、storage 事件解析和外部序号；`core.js` 保留无模块时的旧回退路径，不改变三路合并、账号隔离或 `memExternal` 事件契约。
- [x] 6.f 完成课程/进度写入协调的低风险边界：`src/core/runtime.mjs` 新增 `createWriteCoordinator()`，`core.js` 仅装配 courses/progress 队列和错误事件；具体 IDB/localStorage 合并、账号作用域、云端 generation 与广播仍由原持久化函数负责。
- [x] 6.g 完成同步稳定比较边界：`src/core/sync-delta.mjs` 新增 `sameValue()`，`core.js` 的 `sameSyncValue()` 优先使用统一实现并保留内联回退；对象键顺序不再造成假差异，数组顺序仍保持有意义。
- [x] 6.h 完成同步待发集合边界：`src/core/sync-delta.mjs` 收口待发标记、软删合并、确认摘除、删除后重建过滤和实体 ID 映射；`core.js` 只保留兼容回退，未改变 rev、账号作用域或 payload 协议。契约测试覆盖首次全量、增量筛选、删除合并、确认后清理及删除后重建。
- [x] 6.i 完成同步意图回执边界：新增 `src/core/sync-intents.mjs` → `js/core-sync-intents.js`，抽出课程/进度意图与学习记录意图的回执匹配；`core.js` 保留兼容回退，不改变操作回执、删除确认或账号作用域语义。
- [x] 6.j 完成同步 payload 组装边界：新增 `src/core/sync-payload.mjs` → `js/core-sync-payload.js`，抽出待发实体筛选、删除墓碑合并、统计/实体增量挂载及本批发送集合；`core.js` 仍负责网络发送、冲突处理、水位推进与 ack，不改变 payload 协议。
- [x] 6.k 完成条件同步传输边界：新增 `src/core/sync-transport.mjs` → `js/core-sync-transport.js`，抽出 BatchSync 基线校验、stage、retry 和回执校验；`core.js` 保留兼容回退，不改变请求体、错误码或同步确认语义。
- [x] 6.l 完成课程/进度同步恢复边界：新增 `src/core/sync-replay.mjs` → `js/core-sync-replay.js`，抽出意图读取、远端基线比较、冻结、提交、确认、冲突和 64 轮限流调度；`core.js` 保留账号作用域、保护集合、失败回退和兼容路径。
- [x] 6.m 完成账号级冲突快照合并边界：新增 `src/core/sync-batch-merge.mjs` → `js/core-sync-batch-merge.js`，抽出 rev 选择、统计归一化、事件/错题/标熟并集、课程/进度合并和迁移收口；`core.js` 保留依赖注入与兼容回退，不改变冲突解决协议。
- [x] 6.n 完成同步统计归一化边界：新增 `src/core/sync-stats-normalize.mjs` → `js/core-sync-stats-normalize.js`，抽出云端 stats 的旧键迁移、事件计数校正、必要时幂等重建及事件修复 ID 计算；`core.js` 保留依赖注入与兼容回退，不改变统计结构或同步协议。
- [x] 6.o 完成学习标记合并边界：新增 `src/core/sync-learning-marks.mjs` → `js/core-sync-learning-marks.js`，抽出 mastered、deletedItems、reinforceBook 的远端并集/墓碑/去重合并；`core.js` 保留旧实现回退，不改变删除传播、错题本顺序或账号同步协议。
- [x] 6.p 完成课程/进度实体合并边界：新增 `src/core/sync-entity-merge.mjs` → `js/core-sync-entity-merge.js`，抽出课程列表与进度映射的 rev 选择、软删除传播和顺序保持；`core.js` 保留旧实现回退，调用使用完整 rev 快照，避免合并后错误回到 rev=1。
- [x] 6.q 完成同步 KV 合并边界：新增 `src/core/sync-kv-merge.mjs` → `js/core-sync-kv.js`，抽出 stats 的待发明细合并/空云端保护、best 同 rev 合并和普通 KV 的 LWW 选择；`core.js` 保留旧实现回退，不改变 rev、dirty 或账号同步语义。
- [x] 6.r 完成 deck 实体合并边界：复用 `mergeSyncedEntityList` 收口 deck 的 rev 选择、软删除传播和顺序保持；`core.js` 保留 wrapper 回退，不改变增量水位对齐。
- [x] 6.s 完成 rev/待发差异边界：新增 `src/core/revision-delta.mjs` → `js/core-revision-delta.js`，抽出 deck/KV 的 rev 增量、软删除和待发集合计算；`core.js` 保留存储写入、跨标签通知和兼容回退。
- [x] 6.t 完成课程/进度 rev 差异边界：复用 `src/core/revision-delta.mjs` 的 keyed 差异计算，抽出 courses/courseProgress 的变更、软删除、初始化 rev 和快照更新；`core.js` 保留原始存储读取、待发集合写入、通知和兼容回退。
- [x] 6.u 完成同步待推送判断边界：`src/core/sync-delta.mjs` 新增 `entitiesNeedingPush()`，`core.js` 的课程、进度和 deck 推送筛选统一优先调用该实现，并保留内联回退；不改变本地/远端 rev 比较、首次上行或刷新后增量语义。
- [x] 6.v 完成账号冲突业务摘要边界：`src/core/sync-batch-merge.mjs` 新增 `buildBusinessSnapshot()`，抽出整账号自动恢复前的稳定业务快照、排序和统计归一化；`core.js` 保留冲突判断调用、依赖注入和兼容回退。
- [x] 6.w 完成课程/进度迁移合并边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `mergeCourseProgressSources()`，统一 localStorage 与 IDB 课程按 courseId 并集、IDB 同 ID 优先及进度按键覆盖；`core.js` 保留 IDB 事务、缓存、清理和兼容回退。
- [x] 6.x 完成 IDB 业务投影恢复边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildBusinessProjection()`，统一从 IDB 业务快照、sentenceStats 与 events 重建 localStorage 投影；`core.js` 保留事务读取、存储写入、缓存采用和兼容回退，避免恢复规则继续散落在 legacy runtime。
- [x] 6.y 完成统计持久化元数据边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildStatsBusinessMeta()`，统一业务快照中可同步小字段的筛选、owner 与 generation 归一化；`core.js` 保留 IDB 写入、队列、降级和错误处理。
- [x] 6.z 完成统计增量持久化计划边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildStatsPersistencePlan()`，统一脏句、删除句、事件追加/全量替换和下一次签名水位计算；`core.js` 保留 IDB 事务、队列、失败降级与成功后的水位提交。
- [x] 6.aa 完成课程/进度写入合并计划边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildCourseProgressWritePlan()`，统一课程列表与进度映射在 IDB/localStorage 当前值变化时的三路合并决策；`core.js` 保留读取、事务、缓存、广播、generation 和云同步副作用。
- [x] 6.ab 完成 legacy stats 解析边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `parseLegacyStatsRaw()`，统一旧 localStorage JSON、bySentence/events 类型归一化和损坏输入回退；`core.js` 保留存储读取、异常保护与迁移调用时序。
- [x] 6.ac 完成同步恢复测试上下文隔离：修正 `e2e/sync-recovery.test.js` 的并发场景，使用短生命周期独立页面产生本地冲突，再由共享 IDB 的双页面验证恢复互斥；不改变产品同步协议。
- [ ] 7. 首页源码抽取、直接导入纯逻辑和 boot 协调；保留必要兼容 globals 及早期错误处理。main.html 引用 js/main.js，CSS/DOM 不改布局。验证普通进入、direct、目录跳转、断点续练、复习入口、慢云端、本地缓存命中、依赖加载失败和已经开始作答时云端到达。
- [x] 7.a 完成首页入口决策的第一条低风险边界：新增 `src/main/resume.mjs` 的 `selectResumeDeck()`，生成并接入 `js/main-lifecycle.js`；`main.html` 的 `resumeOrStart()` 只保留渲染/启动职责，断点、最近牌组和默认牌组选择由纯模块决定，旧回退路径保留。入口单测、主页启动、学习流程和严格全量均通过。
- [x] 7.b 完成首页一次性 handoff 的第二条低风险边界：新增 `consumeStartHandoff()`，统一消费 `_startIntent`、`_startDeck` 和短时复习队列；移除 `main.html` 中重复的 `_startIntent` 消费分支，保留目录 URL 清理、刷新不重复进入和复习 30 秒保鲜语义。
- [x] 7.c 完成首页 boot 协调的第三条低风险边界：新增 `src/main/boot.mjs` 的 `createBootCoordinator()`，收口本地首屏、启动完成和入口认领状态；`main.html` 保留旧 `_mainBooted` 等诊断镜像，避免破坏现有 E2E/诊断兼容口。
- [x] 7.d 完成练习反馈效果的第四条低风险边界：新增 `src/main/feedback-effects.mjs`，将音效、整句朗读和彩纸/烟花特效改为依赖注入的工厂；`main.html` 仅保留 `SFX`、`FX`、`speakSentence` 兼容名称，不复制 `mem` 或当前题目快照。新增音频、语音和无 DOM 降级契约测试，行为由完整浏览器回归确认。
- [x] 7.e 完成答题判定的第五条低风险边界：新增 `src/main/answer-evaluation.mjs` 的 `evaluateChunkAnswer()`，选择题和输入题共用“正确答案/备选答案 + 可选 ChunkEngine judge + 归一化回退”契约；不改变引擎优先级、容错和题目状态更新。
- [x] 7.f 完成讲解内容组装的第六条低风险边界：新增 `src/main/explanation.mjs` → `js/main-explanation.js`，抽出核心含义、中文对应表达、使用场景、提醒、例句及多维讲解组装；`main.html` 只保留旧函数名转发和 DOM 渲染，补齐构建、部署清单及移动端滚动回归。
- [x] 7.g 完成练习自动推进策略的第七条低风险边界：新增 `src/main/practice-policy.mjs` → `js/main-practice-policy.js`，抽出自动下一题资格、等待时长和按钮文案；计时器、事件监听和 DOM 仍由 `main.html` 管理。
- [x] 7.h 完成练习会话状态边界：新增 `src/main/practice-state.mjs` → `js/main-practice-state.js`，统一默认状态结构和可测试的初始化覆盖；`main.html` 保留所有状态变更及兼容字段，不改变存储格式。
- [x] 7.j 完成首页浏览器入口收口：由同一 `src/main/index.mjs` 生成 `js/main.js`，`main.html` 改为加载统一入口；保留 `js/main-lifecycle.js` 兼容产物，不改变 `MainLifecycle` 全局接口或启动顺序。
- [x] 7.k 完成练习分类边界：新增 `src/main/practice-classification.mjs` → `js/main-practice-classification.js`，抽出熟练度分档、推荐排序、掌握/到期判断；`main.html` 保留题目查找、SRS 注入和兼容回退，不改变练习状态或存储格式。
- [x] 7.l 完成课程导航决策边界：新增 `src/main/course-navigation.mjs` → `js/main-course-navigation.js`，抽出当前课节完成后的顺序选择、循环查找下一未完成课节和全课程完成判断；`main.html` 保留课程目录查询、进度计算和页面跳转。
- [x] 7.m 完成牌组进度计算边界：新增 `src/main/deck-progress.mjs` → `js/main-deck-progress.js`，抽出按当前内容交集、稳定 cid 去重和删除过滤计算覆盖率；`main.html` 保留内容索引加载、缓存和渲染回退。
- [x] 7.n 完成今日首页摘要边界：新增 `src/main/home-summary.mjs` → `js/main-home-summary.js`，抽出到期数量与错题本数量计算；`main.html` 保留题库 ID 集合、SRS 和删除状态注入。
- [x] 7.o 完成牌组进度展示边界：扩展 `src/main/deck-progress.mjs` → `js/main-deck-progress.js`，抽出未就绪、覆盖率、当前句、上次正确率和本次完成数的进度 HTML 模板；`main.html` 保留数据计算、索引加载和 DOM 更新回退。
- [x] 7.p 完成选择模式选项池边界：扩展 `js/chunk-engine.mjs` 的 `buildChoicePool()` 与 `buildChoiceMarkup()`，`main.html` 保留题目引用、答题状态、DOM 写入和事件委托；选项顺序支持随机函数注入，已答对项过滤与首次操作提示由纯模板函数统一生成，旧内联逻辑保留兼容回退。
- [x] 7.q 完成题卡 HTML 模板边界：新增 `src/main/practice-markup.mjs` → `js/main-practice-markup.js`，统一选择/听写模式的词块、角色标签、提示和输入框尺寸生成；`main.html` 保留事件绑定、焦点切换、答题状态和兼容回退。
- [x] 7.r 完成句子结算事实边界：扩展 `src/main/practice-state.mjs` → `js/main-practice-state.js` 的 `buildSentenceOutcome()`，抽出错误次数、需巩固、错题索引和错题本条目计算；`main.html` 保留 DOM 标签、SRS、错题保存、音效和自动朗读。
- [x] 7.s 完成答案揭示计划边界：扩展 `src/main/practice-state.mjs` → `js/main-practice-state.js` 的 `buildRevealPlan()`，统一当前 chunk/全句揭示的未完成项选择；`main.html` 保留答案写入、DOM 状态、计时和结算动作。
- [x] 7.i 完成历史统计迁移边界：新增 `src/main/legacy-stats.mjs` → `js/main-legacy-stats.js`，抽出临时题库统计键的来源解析、唯一候选匹配和统计合并；`main.html` 只负责读取题库、保存迁移结果，保留原来的歧义不迁移规则。
- [x] 8. 服务端 data service/迁移、resolution service、路由与 app 装配已完成；入口保留装配职责，路由/服务模块已纳入部署清单，服务端和严格全量回归通过。
- [x] 9. 新增 eslint.config.mjs、tsconfig.check.json、必要的有限 JSDoc 声明；固定 devDependency/lockfile。lint 范围为新模块、构建/调度脚本与新服务端文件，既有 vendor/内容/产物不受格式规则约束。checkJs 先包括 identity/merge/activity/event-bus、构建与调度脚本的可检查部分；legacy-runtime/UI 大状态闭包列为明确待迁移范围，不用全局 any 或 ts-nocheck 冒充覆盖。格式工具只做新增范围 check，不全仓 --write。
- [x] 10. 新增运行时内容加载回归：打开真实 main.html/decks.html，收集请求，确认不请求 oral-book.js/freq-idioms.js；进入具体题库请求必要 JSON 分片，第二次可复用缓存，失败时保留明确错误。README 已更新源码/产物/开发服务使用方式及 Vite/TS/JSON 源决策；content:check-generated 仍列为后续内容管线增强。
- [x] 11. 新增 .github/workflows/ci.yml：pull_request、push(master)、workflow_dispatch；permissions contents:read；Node 22；安装根与 server lockfile；checks/unit/server/browser 分组 jobs，fail-fast=false（如矩阵），浏览器组使用本项目锁定 playwright-core 的 CLI 安装 chromium 和系统依赖，严禁 npx 下载不受 lockfile 控制的最新版。使用 npm exec --no -- playwright-core install --with-deps chromium 或等价的本地 CLI 入口；各测试统一尊重 CHROMIUM_PATH 或已安装浏览器默认路径。always 上传已生成的测试 JSON 和相关失败输出，不上传账号/数据库。
- [x] 12. CI 必需检查顺序为安装→生成忽略的准备产物→build:check/content:check-generated/check-sw --strict→静态检查→各组测试；CI 使用 `prepare:ci`，不会先改写受跟踪的 sw.js。Playwright 改为 lockfile 内的 `playwright-core` CLI；本地已显式运行 build、prepare、gen-sw 和严格检查。

## Validation

执行者实现命令后必须实际运行，记录退出码和摘要；环境缺浏览器先安装匹配版本，不静默跳过。

- [x] npm run build（显式更新交付产物）；node scripts/gen-sw.js（仅交付准备，不是 CI 检查前自动修复）。
- [x] npm run build:check；npm run content:check-generated；node scripts/check-sw.js --strict；node scripts/check-deploy-files.js。
- [x] npm run lint；npm run typecheck；如引入格式工具则 npm run format:check。
- [x] npm test：此前标准清单完整 **120/120** 通过；本次同步筛选边界变更后的全量首跑为 **117/120**，仅 `stats-idb`、`stats-index`、`sync-recovery` 出现浏览器时序失败，三个专项串行重跑均通过；checks、unit、server、browser 四组均已执行并保留结果。
- [x] 原重点测试：store、rev、multitab、multitab-idb、stats-idb、stats-consistency、course-storage、sync-outbox；server/smoke、sync-conflict、conditional-required、batch-version、sync-delta、downstream-delta、credentials、feedback、api-compress 均随 `npm test` 通过。
- [x] 浏览器重点：自包含 browser 清单 **35/35** 通过；外部 course-creator 导出测试仍单独保留，不在自包含门禁内。
- [x] 新增负向验证：dirty 工作区的过期 SW、SW 丢失/标记错误、修改源码未重建、合法/越界 `../` 依赖、调度器失败后续执行均已有检查并通过。
- [x] 新增实际页面验证：`main.html` 仅使用一次 `bridge.mjs` module 入口并通过就绪事件，不存在 bridge 轮询；bridge 加载失败会显示可操作提示；云端慢响应不阻塞本地首页；练习状态不会被晚到初始化覆盖。由 `main-startup` 浏览器回归覆盖。
- [x] 已有 SW 用户升级：`e2e/upgrade-check.js` 已验证旧缓存预置、激活清理、迁移后立即练习和零 pageerror，24/24 通过，并纳入标准 browser 清单。
- [x] 浏览器 390px 与桌面 1440px 已完成选课→答题→详解/完成→下一题或下一课；`learning-journey` 与 `mobile-learning-explanation` 已检查布局、滚动和横向溢出。
- [x] `build:check` 连续两次通过，严格全量前后工作区指纹一致；未运行生产部署脚本，未重置用户功能、内容和身份字段。

## Acceptance criteria

- [ ] 本地和 workflow 共享显式测试清单；失败汇总可读，标准入口不会因单个套件失败遗漏后续结果。
- [ ] 严格 SW/产物检查不因工作区 dirty 或准备脚本而失效；CI 配置可审阅且不包含生产部署/密钥操作。
- [ ] core 源码至少有上述独立领域/合并/事件边界且被真实 core.js 构建调用；保留存储同步兼容模块属于明确的阶段范围，不能宣称整个核心重构完成。
- [ ] 首页实际使用新入口/启动与反馈控制器，移除 bridge 等待轮询；兼容访问和原本地优先流程通过浏览器验收。
- [ ] server/index.js 只负责装配和启动，路由调用真实服务模块；API、事务、鉴权及迁移顺序回归通过。
- [ ] 静态检查对新增范围生效，未全仓格式化；有限类型检查清楚标注覆盖范围。
- [ ] build 输出确定且能部署到现有路径；新 clone 安装依赖后可检查/运行；无必须安装 Vite 的隐含前提。
- [ ] 内容分片、学习身份和内容数据保持当前工作区语义；无大 JS 内容源运行时请求；JSON 源统一明确延期。
- [ ] 必需验证项均执行通过；未在远端触发 workflow 只说明“配置已完成、本地验证通过”，不得宣称 GitHub CI 已绿。

## Risks and rollback

- 工作区含多项未提交功能：只按文件/改动段回滚本轮内容，禁止 reset --hard、git clean、整文件 checkout HEAD；开始执行时保留摘要与局部 diff，不能把用户改动当旧基线删除。
- 首页全局兼容和异步时序是主要风险：用真实页面和已有状态断言验证；不要通过改测试来隐藏状态丢失。内部测试读取可调整到明确兼容口，但必须保留相同断言。
- 服务端事务、共享语句缓存、限流实例与迁移先后必须保持；数据服务不能无意多次初始化。同一阶段失败则撤回该阶段抽取，不回滚数据库。
- 构建产物与源码双份：确定性 build:check 强制一致；每次改动源码必须同步产物和 SW，避免生产读旧代码。
- CI 安装/浏览器/原生 SQLite 依赖须使用 lockfile，遇到真实平台问题集中诊断并记录；不能无证据扩大到全仓工具升级。
- 如果现有实现与本文边界出现实质矛盾（例如兼容口需改变持久化协议），设 needs-planning 并记录具体冲突；普通函数依赖补齐、文件名微调和检查配置属于实现判断，不必升级成新规划。

## Execution notes

- 规划阶段只写本文，没有修改产品代码、生成物或运行全套测试。
- 4/5 是本轮明确的条件决策，不是遗漏任务。未来引入 Vite、扩大 TS、统一源 JSON 均需另一个有明确收益与验收范围的交付，不自动追加到本轮。
- 后续填写：基线、实际改动、各命令退出码、生成物一致性、浏览器与离线升级结果、明确留存范围及风险。

### Luna execution log

- 2026-09-19: 开始执行；工作区存在基线 commit 之外的多项用户改动，保留原样。
- 2026-09-19: 基线的 `e2e/course-catalog.test.js` 失败已归因：工作区当前 `course-package.js` 已切换到课程包 1.1/2.0 严格校验和输入播放器，而该回归夹具仍是 schema 1.0 + 已移除的 word-chip 交互。没有放宽生产校验；该夹具暂从自包含浏览器清单排除，待按现行协议重写。
- 2026-09-19: 已完成测试清单、分组调度器、检查结果 JSON、严格 SW 模式、合法父路径依赖扫描、构建产物一致性检查、有限 ESLint/JSDoc 类型检查、内容运行时静态契约测试和 GitHub Actions 草案。
- 2026-09-19: `npm run test:checks` 15/15、`npm run test:unit` 23/23、`npm run test:server` 12/12、`npm run lint`、`npm run typecheck`、`npm run build:check`、`node scripts/check-sw.js --strict` 通过。
- 2026-09-19: 修复了首次云端空快照覆盖本地旧统计的同步边界；`stats-idb` 22/22、`sync-delta` 35/35、`api-compress` 15/15、v2 导入回归和端口检查均通过。此前浏览器组其余失败已消除；当前自包含 browser 清单 29/29 通过。
- 2026-09-19: `npm test` 完整清单 88/88 通过；当前分组为 `test:checks` 16/16、`test:unit` 28/28、`test:server` 13/13、`test:browser` 31/31，另有 lint、typecheck、build、build:check、content:check-generated、严格 SW、部署清单均通过。未执行 GitHub workflow，不能称 CI 已在远端变绿。
- 2026-09-19: 增加 `CONTENT_OUTPUT_ROOT` 临时输出支持与 `content:check-generated`，可在不改工作区的前提下重建并比对 JSON 分片；CI 改用 `prepare:ci`，避免检查前自动改写受跟踪 SW。
- 2026-09-19: `e2e/course-catalog.test.js` 的旧 schema 1.0/word-chip 夹具已迁移到当前 2.0 mode-neutral sequence 协议，恢复为标准浏览器门禁；`test:browser` 31/31、`npm test` 88/88 通过。
- 2026-09-19: 已有 `e2e/upgrade-check.js` 改用锁定的 `playwright-core` 浏览器路径并纳入测试清单；旧 SW cache 清理、内容迁移、升级后可练习专项 24/24 通过。
- 2026-09-19: 完成 core 身份函数首个真实边界：`src/core/identity.mjs` → `js/core-identity.js`，页面在 `core.js` 前加载，`fnv8/cidOf/cidKey/moveKeyToCid` 由新模块优先实现，旧闭包保留回退；新增模块测试，生成物和部署清单均纳入检查。
- 2026-09-19: 完成 core 合并函数第二个真实边界：`src/core/merge.mjs` → `js/core-merge.js`，三路合并、统计合并和事件并集由新模块优先实现，旧闭包保留回退；新增模块测试，部署清单与 SW 均已更新。
- 2026-09-19: 完成 core 活动统计第三个真实边界：`src/core/activity.mjs` → `js/core-activity.js`，日期、审计、日活动、streak、今日轮次与历史回填由新模块优先实现；新增模块测试，首页/统计/IDB 回归通过。
- 2026-09-19: 完成 core 事件总线第四个真实边界：`src/core/event-bus.mjs` → `js/core-event-bus.js`，监听异常隔离、取消订阅和实例状态隔离由新模块实现；新增模块测试，完整门禁 88/88 通过。
- 2026-09-19: 服务端限流边界首步完成：`server/middleware/auth-rate.js` 负责注册、普通登录、管理员登录和凭据修改的固定窗口状态，`server/index.js` 仅装配共享实例；部署清单同步更新，完整门禁 88/88 通过。
- 2026-09-19: 服务端变更序号边界完成：`server/services/change-seq.js` 负责按用户读取/分配增量同步水位，`server/index.js` 只装配服务；新增服务测试，服务端门禁 14/14 通过，部署清单同步更新。
- 2026-09-19: 服务端快照边界完成：`server/services/data-snapshot.js` 注入数据库与水位读取器，承载全量/增量 mem 组装及事务读取包装；`server/index.js` 保留装配，服务端 14/14、全量 89/89 通过，部署清单同步更新。
- 2026-09-19: 服务端实体写入边界完成：`server/services/data-writers.js` 负责 decks/KV/courses/courseProgress 的 rev 守卫、软删除和发布状态写入，入口仅装配依赖；服务端门禁 14/14 通过，部署清单同步更新。
- 2026-09-19: 实体写入服务补齐 JSDoc 错误状态类型，lint 与有限 typecheck 重新通过；未改变接口或错误码。
- 2026-09-19: 服务端行级写入边界完成：`server/services/data-rows.js` 负责句子统计、事件及 mastered/reinforce/deletedItem 的逐行 UPSERT/软删除；迁移事务仍留在入口协调，服务端 14/14、lint、typecheck、部署覆盖检查通过。
- 2026-09-19: 服务端迁移边界完成：`server/services/data-migrations.js` 承载 stats/entity 两项幂等迁移，显式注入数据库、变更序号和行写入器；启动调用顺序保持不变，服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 服务端批量写入边界完成：`server/services/data-save.js` 承载 requestId 幂等回执、baseSeq 检查、实体版本写入、统计/事件增量及事务协调；入口仅注入依赖，服务端 14/14、lint、typecheck、部署覆盖检查通过。
- 2026-09-19: 同步替换批次边界完成：`server/services/batch-replacement.js` 承载账号级冲突解决所需的 rev/baseRev、删除墓碑、statsDelta 和 entityDelta 组装；同步服务端门禁仍为 14/14，lint 与 typecheck 通过。
- 2026-09-19: 同步路由边界完成：`server/routes/sync.js` 注册 `/api/sync/*` 冲突比较、解决和备份接口，统一保留原错误状态映射；入口仅装配 resolution services，服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 课程路由边界完成：`server/routes/courses.js` 注册课程导入与软删除接口，保留条件写入限制、schema 校验、rev 和软删除语义；服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 题库路由边界完成：`server/routes/decks.js` 注册公开题库列表/详情及本人发布下架接口，保留公开访问、条件写入、rev/seq 更新和 404 语义；服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 备份路由边界完成：`server/routes/backup.js` 注册 `/api/export` 与 `/api/import`，保留备份格式、校验、条件写入和冲突响应；服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 反馈路由边界完成：`server/routes/feedback.js` 注册游客可用的 `/api/feedback`，保留现有处理器和静态兼容标记；反馈测试 46/46、服务端门禁 14/14、lint、typecheck 通过。
- 2026-09-19: AI 路由边界完成：`server/routes/ai.js` 承载缓存命中、用户限流、密钥选择和 DeepSeek 调用，保留默认 503 停用策略与 JSON 响应；服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 管理员路由边界完成：`server/routes/admin.js` 承载管理员登录限流、概览、用户、反馈和密码接口，复用现有统计辅助与身份校验；smoke 180/180、服务端 14/14、lint、typecheck 通过。
- 2026-09-19: 普通账号路由边界完成：`server/routes/auth.js` 承载注册、登录、当前用户和凭据修改接口，入口仅注入鉴权与限流依赖；服务端 14/14、lint、typecheck 通过，部署清单同步更新。
- 2026-09-19: 系统路由边界完成：`server/routes/system.js` 承载 `/api/stats`、`/api/health`、`/api/config` 与活跃心跳，入口仅注入指标、AI 开关和活动写入器；服务端 14/14、lint、typecheck 通过，部署清单同步更新。
- 2026-09-19: 数据路由边界完成：`server/routes/data.js` 承载 `/api/data` 全量/增量读取与条件写入，入口仅注入快照读取器、校验器和保存服务；服务端 14/14、lint、typecheck 通过，部署清单同步更新。
- 2026-09-19: 管理概览服务边界完成：`server/services/admin-overview.js` 承载管理员鉴权中间件、日期范围解析和概览聚合查询，入口仅注入服务结果给管理员路由；服务端 14/14、lint、typecheck 通过，部署清单同步更新。
- 2026-09-19: 数据/管理服务拆分后的最新 browser 门禁 **31/31** 通过；严格 SW 与部署覆盖检查仍通过。完整 npm test 的最近一次标准结果为 89/89（拆分前），拆分后已重跑 server 14/14 + browser 31/31。
- 2026-09-19: core 迁移边界完成：`src/core/migrations.mjs` → `js/core-migrations.js`，`migrateCidKeys` 与 `migrateToBookDecks` 由新模块优先实现，旧闭包保留回退；四个页面已在 `core.js` 前加载，迁移单测 1/1、unit 29/29、首页启动、离线 SW 14/14、build:check、严格 SW、部署覆盖、lint、typecheck 通过。
- 2026-09-19: 首页启动依赖改为显式 `chunklab:bridge-ready` 握手：`js/bridge.mjs` 发布就绪事件，`main.html` 监听一次并保留 3 秒失败提示，移除 16ms 轮询；`main-startup` 与 `sw-cache` 关键浏览器验证通过。
- 2026-09-19: Windows 测试端口选择器补充 `netsh` 排除端口探测并支持跨保留区扫描；10167–10466 系统端口保留导致的 `EACCES` 已消除，`course-package-v2-import` 与 `tab-content-consistency` 单独重跑通过。
- 2026-09-19: `upgrade-check` 的正向/负向迁移夹具改为隔离 `/api/**`，使该项只验证本地旧档案迁移，不被同一临时服务中先前已迁移快照污染；正向 24/24 通过。
- 2026-09-19: 快照抽取后的早期浏览器运行曾出现非确定性 Playwright promise GC；端口选择器补齐 Windows 排除端口探测、升级验收隔离云端夹具后，browser 31/31 和完整 npm test 89/89 均稳定通过。
- 2026-09-19: 内容生成快照已通过 `content:assemble` 与 `content:check-generated` 对齐；严格 SW 检查和部署覆盖检查再次通过。调度器自测将 80ms 改为 500ms 启动窗口并保留 2s 挂起夹具，消除 Windows 启动抖动误判。
- 2026-09-19: core/main/server 的真实模块抽取仍未完成，首页实际模块失败与慢云端场景也仍待专门验收；状态保持 `in-progress`，不能宣称五项全部完成。
- 2026-09-19: 完成 core 存储签名边界：`src/core/stats-signature.mjs` → `js/core-stats-signature.js`，统计行签名、统计快照签名和事件三锚点快照由新模块优先实现，`core.js` 保留兼容回退；四个页面、SW 与部署清单已接入。模块测试、unit 31/31、lint、typecheck、build:check、严格 SW、部署覆盖检查通过。
- 2026-09-19: 修正 `e2e/sw-cache.test.js` 在异步练习入口完成前读取 `S` 状态的竞态，等待真实首卡后再验证在线/离线题目一致性；browser 门禁重跑 **31/31** 通过。该修复只稳定测试时序，不改变产品运行逻辑。
- 2026-09-19: 主线仍保持 `in-progress`：core 存储同步 runtime、首页源码模块化和全量五项验收尚未完成；本轮未执行远端 GitHub Actions 或生产部署。
- 2026-09-19: 完成 core 存储状态边界：`src/core/storage-state.mjs` → `js/core-storage-state.js`，当前版本、迁移链和 `defaultMem` 由新模块优先实现，`core.js` 保留兼容回退；四个页面、SW 与部署清单已接入。模块测试、build:check、lint、typecheck、严格 SW、部署覆盖、main-startup 和 sw-cache 14/14 通过。
- 2026-09-19: 完成 core 实体增量边界：`src/core/entity-delta.mjs` → `js/core-entity-delta.js`，mastered/reinforceBook/deletedItems 的行签名、增量和云端水位对齐由新模块优先实现，`core.js` 保留兼容回退；模块测试、unit 33/33、build:check、lint、typecheck、严格 SW、部署覆盖、main-startup 与 sw-cache 14/14 通过。
- 2026-09-19: 完整标准门禁最新结果 **95/95** 通过（checks、unit、server、browser）；本轮未执行远端 GitHub Actions 或生产部署。
- 2026-09-19: 完成 core 云端增量边界：`src/core/sync-delta.mjs` → `js/core-sync-delta.js`，`memForCloud` 与 stats/entity 增量 payload 生成由新模块优先实现，`core.js` 保留兼容回退；同步 outbox、sync、sync-delta（35 项）和 sync-conflict 回归全部通过。
- 2026-09-20: 复核收口：服务端拆分、390/1440 页面验收、双次 build:check 和严格 101/101 已有证据；仍未完成的真实代码工作仅为 core 存储/同步 runtime 抽取与 main.html 全量源码模块化，状态继续保持 `in-progress`。
- 2026-09-20: 完成 core runtime 的第一条低风险边界：`src/core/runtime.mjs` → `js/core-runtime.js`，`createSingleFlight()` 接入四个业务页面，`core.js` 的 IDB 预载改为共享 in-flight Promise，刷新外部状态仍可显式清空；新增 runtime 契约测试。`npm run build`、`build:check`、lint、typecheck、严格 SW、部署清单、browser 35/35 与 `TEST_RETRIES=0 npm test` 102/102 通过。仍未完成的范围是 storage/sync legacy runtime 的进一步拆分和 main.html 全量源码模块化。
- 2026-09-20: 完成 core runtime 的第二条低风险边界：`createTaskQueue()` 接入 courses/progress 串行写入尾队列，并验证失败恢复；课程包导入、同步、IDB 统计、跨标签专项均通过。重新生成 SW 后，严格 SW、部署覆盖检查和 `TEST_RETRIES=0 npm test` 102/102 通过。仍未完成的范围是 storage/sync legacy runtime 的大块拆分、main.html 全量源码模块化及外部发布门槛。
- 2026-09-20: 完成 core runtime 的第三条低风险边界：`createLatestWriteLane()` 接入 stats 提交调度，保留最新快照合并与队列满保护；统计 IDB 22/22、同步 27/27、跨标签 12/12、单元 35/35 及严格 `TEST_RETRIES=0 npm test` 102/102 通过。仍未完成的范围是 storage/sync legacy runtime 的大块拆分、main.html 全量源码模块化及外部发布门槛。
- 2026-09-20: 完成 core 跨标签通知边界：`CoreRuntime.createTabNotifier()` 统一 beacon 写入、BroadcastChannel/storage 消息过滤和外部序号，`core.js` 保留旧回退路径；core-runtime 契约、跨标签 24/24 + IDB 10/10、严格 `TEST_RETRIES=0 npm test` 102/102 通过。仍未完成的是存储/同步 legacy runtime 其余大块拆分。
- 2026-09-20: 完成课程/进度写入协调边界：`CoreRuntime.createWriteCoordinator()` 收口队列提交、等待尾标记和失败后继续语义，`core.js` 保留旧队列回退；runtime、跨标签、课程包、同步与完整回归用于确认行为未变。
- 2026-09-20: 完成同步稳定比较边界：`CoreSyncDelta.sameValue()` 统一同步冲突/回执中的稳定 JSON 比较，保留 `core.js` 回退路径；同步增量、跨标签、IDB、构建、lint、typecheck 均通过，完整回归待本轮最终门禁确认。
- 2026-09-20: 完成同步待发集合边界：`CoreSyncDelta` 新增待发集合纯函数并由 `core.js` 优先调用，覆盖 dirty/gone 累积、确认摘除、软删合并和删除后重建过滤；模块契约、sync-delta 35/35、build:check、lint 均通过。恢复专项曾受浏览器资源耗尽影响而中止，未据此宣称完整回归已通过。
- 2026-09-20: 完成首页入口决策的第一条低风险边界：`src/main/resume.mjs` → `js/main-lifecycle.js`，抽出断点续练/最近牌组/默认牌组选择，`main.html` 仅负责渲染和启动；入口单测、main-startup、learning-journey、mobile-learning-explanation 与严格 `TEST_RETRIES=0 npm test` 102/102 通过。仍未完成首页 boot/练习流程的整体模块化。
- 2026-09-21: 完成 deck 实体合并边界：`core.js` 的 deck 同步合并改为复用 `mergeSyncedEntityList`，统一 rev 选择、软删除传播和顺序保持，保留旧 wrapper 回退；`rev 60/60`、`sync 27/27`、`sync-delta 35/35`、sync recovery、lint、typecheck、build:check、严格 SW、部署覆盖检查及严格 `npm test` **115/115** 通过。6 之外仍未完成的范围是 core 存储/同步 legacy runtime 的大块拆分、`main.html` 全量源码模块化，以及远端 CI/生产发布门槛；状态继续保持 `in-progress`。
- 2026-09-21: 完成首页入口产物收口：同一 `src/main/index.mjs` 额外生成 `js/main.js`，`main.html` 改为加载该统一入口，`js/main-lifecycle.js` 作为兼容产物保留；生成一致性、首页启动/学习流程、静态门禁和最终标准 `npm test` **115/115** 通过。仍未完成的是 core storage/sync legacy runtime 大块拆分、main.html 练习流程的全量模块化和远端 CI/生产发布门槛。
- 2026-09-21: 首页统一入口变更的最终门禁：首次全量运行出现一次 sync-recovery 浏览器资源时序失败（114/115），专项重跑全部通过，随后 `TEST_RETRIES=0 npm test` 重跑 **115/115**；lint、typecheck、build:check、严格 SW、部署覆盖和 diff 检查均通过。
- 2026-09-21: 完成首页练习分类边界：`src/main/practice-classification.mjs` → `js/main-practice-classification.js`，`main.html` 通过模块调用熟练度、推荐排序、掌握和到期判断，并保留回退；模块契约、首页专项、lint、typecheck、build:check、严格 SW、部署覆盖及最终 `TEST_RETRIES=0 npm test` **116/116** 通过。剩余范围仍是 core storage/sync legacy runtime 大块拆分、main.html 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成课程导航决策边界：`src/main/course-navigation.mjs` → `js/main-course-navigation.js`，抽出当前课节完成后的下一未完成课节选择和全课程完成判断，`main.html` 保留数据装配与跳转；课程导航/目录专项、lint、typecheck、build:check、严格 SW、部署覆盖及最终 `TEST_RETRIES=0 npm test` **117/117** 通过。剩余范围仍是 core storage/sync legacy runtime 大块拆分、main.html 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成牌组进度计算边界：`src/main/deck-progress.mjs` → `js/main-deck-progress.js`，统一当前内容交集、cid 去重、软删除过滤和覆盖率计算，`main.html` 保留索引异步加载与渲染；覆盖率、课程导航、首页启动、移动端专项、lint、typecheck、build:check、严格 SW、部署覆盖及最终 `TEST_RETRIES=0 npm test` **118/118** 通过。剩余范围仍是 core storage/sync legacy runtime 大块拆分、main.html 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成今日首页摘要边界：`src/main/home-summary.mjs` → `js/main-home-summary.js`，统一到期数量、当前题库交集和错题本数量计算，`main.html` 保留依赖注入；首页统计、覆盖率、课程导航、启动、lint、typecheck、build:check、严格 SW、部署覆盖及最终 `TEST_RETRIES=0 npm test` **119/119** 通过。剩余范围仍是 core storage/sync legacy runtime 大块拆分、main.html 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-20: 完成首页一次性 handoff 收口：`src/main/entry.mjs` 新增 `consumeStartHandoff()`，统一处理课节、牌组和短时复习入口；删除 `main.html` 的重复 `_startIntent` 分支。入口单测、main-startup、course-catalog、learning-journey、stats-back 与 mobile-8000 通过。
- 2026-09-20: 完成首页 boot 协调边界：`src/main/boot.mjs` → `createBootCoordinator()` 管理本地首屏、boot 完成和练习入口认领；保留 `_mainBooted/_mainEntryClaimed/_mainLocalPainted` 动态镜像。main-lifecycle、main-startup、learning-journey、content-explanation-refresh 通过。
- 2026-09-20: 完成首页练习反馈效果的低风险边界：`src/main/feedback-effects.mjs` 抽出 Web Audio、SpeechSynthesis 与 Canvas 特效，`main.html` 通过 `getSettings/getCurrentItem` 注入动态状态并保留旧兼容调用名。模块测试、`npm run build`、lint、类型检查、严格 SW、部署覆盖及 `TEST_RETRIES=0 npm test` **102/102** 通过。仍未完成的范围是 storage/sync legacy runtime 大块拆分、main.html 其余练习状态/DOM 流程模块化和外部发布门槛。
- 2026-09-20: 完成首页答题判定的低风险边界：`src/main/answer-evaluation.mjs` 抽出选择题/输入题的统一纯判断，`main.html` 保留 `ChunkEngine.judgeChunk` 优先、异常后归一化回退的兼容语义。模块契约、主页启动、学习流程与第二轮 `TEST_RETRIES=0 npm test` **102/102** 通过；第一轮曾出现一次同步恢复时序失败，专项重跑和第二轮全量均通过。
- 2026-09-20: 完成首页练习反馈效果的低风险边界：`src/main/feedback-effects.mjs` 抽出 Web Audio、SpeechSynthesis 与 Canvas 特效，`main.html` 通过 `getSettings/getCurrentItem` 注入动态状态并保留旧兼容调用名。模块测试、`npm run build`、lint、类型检查、严格 SW、部署覆盖及 `TEST_RETRIES=0 npm test` **102/102** 通过。仍未完成的范围是 storage/sync legacy runtime 大块拆分、main.html 其余练习状态/DOM 流程模块化和外部发布门槛。
- 2026-09-20: 浏览器验收统一优先读取 `CHROMIUM_PATH`，消除测试对被清理的旧 Playwright 浏览器目录和固定 1228 路径的依赖；业务代码未引入浏览器环境耦合。
- 2026-09-20: 定位并修复内容索引并发重复请求：`js/content-repository.js` 为 index shard 增加 single-flight；8000 句容量验收从异常重复请求收敛为 40/40 个索引请求，复习/跨分片/断网续练验收 19/19 通过。
- 2026-09-20: 修复三项浏览器验收对旧 `chromium_headless_shell-1228` 的硬编码路径，统一回退到锁定 Playwright 的 `chromium.executablePath()`；api-compress 15/15、sync-delta 35/35、sync 27/27 通过。
- 2026-09-20: 最终本地门禁：使用锁定 Playwright 运行时、`TEST_RETRIES=0` 执行 `npm test`，完整清单 **102/102** 通过；`build:check`、`content:check-generated`、lint、typecheck、严格 SW 与部署覆盖检查均通过。未执行远端 workflow、提交、推送或生产部署；剩余范围仍是 storage/sync legacy runtime 大块拆分、main.html 全量模块化和外部发布门槛。
- 2026-09-20: 在 boot coordinator 与浏览器路径兼容修复后再次执行 `TEST_RETRIES=0 npm test`，仍为 **102/102**；随后 build:check、content:check-generated、lint、typecheck、严格 SW、部署覆盖和 diff 检查全部通过。远端 CI、提交、推送和生产部署仍未执行。
- 2026-09-20: 修复 `e2e/sync-recovery.test.js` 的全量运行资源隔离：完成前置场景后主动关闭闲置 browser contexts，避免多场景保留渲染进程导致后续页面被浏览器关闭。专项重跑及标准 `TEST_RETRIES=0 npm test` 均 **102/102** 通过；本轮待发集合提取与测试稳定性修复均已纳入验证。
- 2026-09-20: 完成首页讲解组装边界：`src/main/explanation.mjs` → `js/main-explanation.js`，`main.html` 保留 `buildFallbackExplanation/buildAnalysisSections` 兼容转发；模块契约、content-explanation-refresh、mobile-learning-explanation、main-startup、build:check、lint、typecheck 通过。新运行时文件已加入 `scripts/deploy-prod.sh`，严格 SW 与部署覆盖检查通过；标准 `TEST_RETRIES=0 npm test` 已更新并通过 **103/103**。
- 2026-09-20: 完成首页练习自动推进策略边界：`src/main/practice-policy.mjs` → `js/main-practice-policy.js`，`main.html` 保留计时器和 DOM 事件，仅转发资格/时长/按钮文案判断；模块契约、learning-journey、mobile-learning-explanation、build:check、lint、typecheck 通过。新文件已加入 Service Worker 与生产部署清单；标准 `TEST_RETRIES=0 npm test` 已通过 **104/104**。
- 2026-09-20: 完成练习会话状态边界：`src/main/practice-state.mjs` → `js/main-practice-state.js`，`main.html` 改为调用状态工厂，字段与旧默认值保持一致；模块契约、main-startup、learning-journey、build:check、lint、typecheck 通过。新文件已加入 Service Worker 与生产部署清单；标准 `TEST_RETRIES=0 npm test` 已通过 **105/105**。
- 2026-09-20: 完成历史统计迁移边界：`src/main/legacy-stats.mjs` → `js/main-legacy-stats.js`，`main.html` 保留保存动作并调用纯迁移结果；模块契约、main-startup、learning-journey、build:check、lint、typecheck 通过。新文件已加入 Service Worker 与生产部署清单；标准 `TEST_RETRIES=0 npm test` 已通过 **106/106**。
- 2026-09-20: 补齐首页真实加载失败验收：`e2e/main-startup.test.js` 新增 bridge module 加载失败场景，确认显示“基础模块未加载”而不是永久加载；慢云端、用户已开始作答后的晚到初始化、普通刷新不回练习页均继续通过；在同步意图测试加入后，标准 `TEST_RETRIES=0 npm test` 最终通过 **107/107**。
- 2026-09-20: 完成同步意图回执边界：`src/core/sync-intents.mjs` → `js/core-sync-intents.js`，`core.js` 仅装配纯回执结果并保留旧回退；课程/进度删除确认、事件确认、句子统计更新/删除确认均有契约测试。新增模块已加入四个页面、构建检查、严格 SW 与部署清单。
- 2026-09-20: 完成同步 payload 组装边界：`src/core/sync-payload.mjs` → `js/core-sync-payload.js`，统一待发 deck/课程/进度筛选、删除墓碑合并、stats/entity 增量挂载及发送集合返回；网络、冲突、版本水位和确认仍由 `core.js` 负责。模块契约、同步增量 **35/35**、同步恢复、首页启动、build:check、lint、typecheck、严格 SW、部署覆盖和标准 `TEST_RETRIES=0 npm test` **108/108** 通过。
- 2026-09-20: 完成条件同步传输边界：`src/core/sync-transport.mjs` → `js/core-sync-transport.js`，`core.js` 仅装配 API/BatchSync 依赖；基线缺失、stage/retry、缺少回执和直连 API 均有契约覆盖。同步增量 **35/35**、同步恢复、首页启动、build:check、lint、typecheck、严格 SW、部署覆盖和标准 `TEST_RETRIES=0 npm test` **109/109** 通过。
- 2026-09-20: 完成课程/进度同步恢复边界：`src/core/sync-replay.mjs` → `js/core-sync-replay.js`，`core.js` 仅注入存储、API、账号作用域和恢复回调；已覆盖已送达确认、冻结提交、远端基线冲突、失败保持待恢复和 64 轮限流语义。同步恢复、同步增量 **35/35**、首页启动、build:check、lint、typecheck、严格 SW、部署覆盖和标准 `TEST_RETRIES=0 npm test` **110/110** 通过。
- 2026-09-21: 完成账号级冲突快照合并边界：`src/core/sync-batch-merge.mjs` → `js/core-sync-batch-merge.js`，`core.js` 仅注入已有统计/迁移 helper；`rev.test.js` **60/60**、同步 **27/27**、同步增量 **35/35**、同步恢复、build:check、lint、typecheck、严格 SW、部署覆盖和标准 `TEST_RETRIES=0 npm test` **111/111** 通过。
- 2026-09-21: 完成同步统计归一化边界：`src/core/sync-stats-normalize.mjs` → `js/core-sync-stats-normalize.js`，`core.js` 优先调用新模块并保留旧实现回退；覆盖旧键迁移、事件计数不足重建、正常快照不重建。模块测试、build、build:check、lint、typecheck、严格 SW、部署覆盖、diff 检查和标准 `TEST_RETRIES=0 npm test` **112/112** 通过。剩余范围仍是 `core.js` storage/sync legacy runtime 的大块拆分、`main.html` 全量模块化及远端 CI/提交/部署门槛。
- 2026-09-21: 完成学习标记合并边界：`src/core/sync-learning-marks.mjs` → `js/core-sync-learning-marks.js`，`core.js` 优先调用新模块并保留旧实现回退；模块测试、build、build:check、lint、typecheck、严格 SW、部署覆盖、diff 检查通过。首轮全量受 `stats-back`/`stats-due-stability` 浏览器时序抖动影响为 111/113，两个专项重跑通过后，第二轮标准 `TEST_RETRIES=0 npm test` **113/113** 通过。
- 2026-09-21: 完成课程/进度实体合并边界：`src/core/sync-entity-merge.mjs` → `js/core-sync-entity-merge.js`，先发现调用处传递 rev 子映射导致课程/进度 rev 丢失，已修正为传递完整 rev 快照；`rev.test.js` **60/60**、同步 **27/27**、同步增量 **35/35**、同步恢复、静态门禁和最终标准 `TEST_RETRIES=0 npm test` **114/114** 通过。剩余范围仍是 `core.js` storage/sync legacy runtime 的大块拆分、`main.html` 全量模块化及远端 CI/提交/部署门槛。
- 2026-09-21: 完成同步 KV 合并边界：`src/core/sync-kv-merge.mjs` → `js/core-sync-kv.js`，`core.js` 优先调用新模块并保留旧实现回退；模块测试、`rev.test.js` **60/60**、同步专项 **27/27**、同步增量 **35/35**、同步恢复、lint、typecheck、build:check、严格 SW、部署覆盖和最终标准 `TEST_RETRIES=0 npm test` **115/115** 通过。剩余范围仍是 `core.js` storage/sync legacy runtime 的大块拆分、`main.html` 全量模块化及远端 CI/提交/部署门槛。
- 2026-09-21: 完成 rev/待发差异边界：新增 `src/core/revision-delta.mjs` → `js/core-revision-delta.js`，`core.js` 优先调用模块计算 deck/KV rev 增量、软删除、待发集合和快照，存储写入、跨标签通知及旧逻辑回退仍由 `core.js` 管理；新增模块契约覆盖首次保存、修改和删除。`rev.test.js` **60/60**、`sync-delta` **35/35**、`sync` **27/27**、sync recovery、首页摘要、覆盖率专项、lint、typecheck、build:check、严格 SW、部署覆盖检查和最终标准 `TEST_RETRIES=0 npm test` **120/120** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成课程/进度 rev 差异边界：复用 `src/core/revision-delta.mjs` 的 keyed 差异计算，`core.js` 优先使用模块处理 courses/courseProgress 的变更、软删除、初始化 rev 和快照更新，原始存储读取、待发集合写入、通知及旧逻辑回退仍由 `core.js` 管理；模块契约覆盖课程新增/删除和进度修改。专项 `rev.test.js` **60/60**、`sync.test.js` **27/27**、sync recovery、完整 `TEST_RETRIES=0 npm test` **120/120**，并通过 build、build:check、lint、typecheck、严格 SW、部署覆盖和 diff 检查。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成同步待推送判断边界：`src/core/sync-delta.mjs` 新增 `entitiesNeedingPush()`，`core.js` 的 deck、courses、courseProgress 推送筛选改为优先复用新实现；模块契约、`sync-delta` 35/35、`sync` 27/27、build、build:check、lint、typecheck、严格 SW、部署覆盖和 diff 检查通过。随后标准全量首跑为 117/120，失败项为 `stats-idb`、`stats-index`、`sync-recovery` 的浏览器时序断言；三项串行专项重跑分别通过（stats-idb 22/22、stats-index 通过、sync-recovery 通过）。此前同一工作区完整标准清单曾通过 120/120。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成账号冲突业务摘要边界：`src/core/sync-batch-merge.mjs` 新增 `buildBusinessSnapshot()`，`core.js` 优先复用该实现生成自动恢复前的稳定业务快照，统一 deck/course 排序、布尔字段归一化、统计归一化和深拷贝；`sync-recovery`、`sync` **27/27**、模块测试、build、build:check、lint、typecheck、严格 SW、部署覆盖和 diff 检查通过。最近一次完整清单首跑仍记录为 117/120，三个浏览器时序失败项已分别重跑通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成牌组进度展示边界：扩展 `src/main/deck-progress.mjs` → `js/main-deck-progress.js` 的 `buildDeckProgressMarkup()`，`main.html` 优先调用模块生成覆盖率进度模板，旧模板保留回退；模块测试、覆盖率专项、首页专项 **39/39**、build、build:check、lint、typecheck、严格 SW、部署覆盖和 diff 检查通过。新增测试曾发现错误期望，已按原有总数截断语义修正为“当前第 2 句”，不是产品逻辑变化。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成选择模式选项池边界：`js/chunk-engine.mjs` 新增 `buildChoicePool()` 与 `buildChoiceMarkup()`，`main.html` 优先使用纯函数生成固定选项池和按钮 HTML，旧内联逻辑保留回退；模块测试 **50/50**、`main-startup` **24/24**、`chunk-intro`、`progress-coverage`、`main-deck-progress`、build:check、lint、typecheck、严格 SW、部署覆盖及标准 `npm test` **120/120** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成题卡 HTML 模板边界：新增 `src/main/practice-markup.mjs` → `js/main-practice-markup.js`，`main.html` 优先调用纯模板生成选择/听写两种题卡结构，输入事件与状态保持在页面；模块测试、`main-startup`、`learning-journey`、`mobile-learning-explanation`、build:check、严格 SW、部署覆盖和 diff 检查通过。标准完整清单首跑为 **120/121**，唯一失败为此前已出现的 `sync-recovery` 浏览器时序项，专项串行重跑通过；新增测试已纳入清单。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成句子结算事实边界：扩展 `src/main/practice-state.mjs` → `js/main-practice-state.js` 的 `buildSentenceOutcome()`，`main.html` 优先使用纯结果计算并保留原 DOM/保存/反馈流程；模块测试、`daily-goal` **21/21**、`learning-journey`、`progress-coverage`、build、build:check、严格 SW、部署覆盖和 diff 检查通过。随后标准完整清单 **121/121** 通过；剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成课程/进度迁移合并边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `mergeCourseProgressSources()`，`core.js` 优先调用纯合并规则并保留原内联回退；模块测试、stats-idb **22/22**、content-batch、sync **27/27**、build、build:check、lint、typecheck、严格 SW、部署覆盖和 diff 检查通过；随后完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成答案揭示计划边界：扩展 `src/main/practice-state.mjs` → `js/main-practice-state.js` 的 `buildRevealPlan()`，统一单个 chunk 与全句揭示的状态选择；模块测试、stats-index、main-startup、learning-journey、build、build:check、lint、typecheck、严格 SW、部署覆盖和 diff 检查通过；随后完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成 IDB 业务投影恢复边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildBusinessProjection()`，`core.js` 优先使用纯恢复规则并保留原内联回退；覆盖正常业务字段、stats、sentenceStats、events 与空输入默认值。模块测试、build、build:check、lint、严格 SW、部署覆盖和最终完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成统计持久化元数据边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildStatsBusinessMeta()`，`core.js` 优先使用纯元数据组装并保留旧内联回退；覆盖小字段筛选、owner/generation 归一化和空输入。模块测试、浏览器组 **35/35**、build、build:check、lint、严格 SW、部署覆盖和最终完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成统计增量持久化计划边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildStatsPersistencePlan()`，`core.js` 优先使用纯计划计算并保留旧内联回退；覆盖脏句、删除句、事件追加、事件全量替换与强制重写。模块测试、stats-idb **22/22**、stats-index、sync **27/27**、sync-recovery 单独重跑、build、build:check、lint、typecheck、严格 SW、部署覆盖和最终完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成课程/进度写入合并计划边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `buildCourseProgressWritePlan()`，`core.js` 优先使用纯合并计划并保留旧内联回退；覆盖课程列表与进度映射、IDB/localStorage 当前值变化及无变化路径。课程进度 **10/10**、课程目录、课程包导入、sync **27/27**、mobile-8000 单独重跑、build、build:check、lint、typecheck、严格 SW、部署覆盖和最终完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成 legacy stats 解析边界：扩展 `src/core/storage-state.mjs` → `js/core-storage-state.js` 的 `parseLegacyStatsRaw()`，`core.js` 优先使用纯解析并保留旧回退；覆盖正常 JSON、字段类型异常、损坏 JSON 和存储读取异常保护。stats-idb **22/22**、课程存储、课程进度、模块测试、build、build:check、lint、typecheck、严格 SW、部署覆盖通过；标准全量本轮为 **120/121**，唯一失败是 `sync-recovery` 第 379 行的浏览器时序断言，独立重跑通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
- 2026-09-21: 完成同步恢复测试上下文隔离：`e2e/sync-recovery.test.js` 不再复用前序场景的旧页面产生并发冲突，改为独立短生命周期页面；同步恢复连续 3 次通过，随后标准完整 `npm test` **121/121** 通过。剩余范围仍是 core storage/sync legacy runtime 的其他大块拆分、`main.html` 其余练习/DOM 流程模块化和远端 CI/生产发布门槛。
