# 项目待办总表与可靠性、简化收尾交接

- Status: complete
- Updated: 2026-09-21
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca；实施基线为当前脏工作区。core.js、main.html、api.js、server/index.js、package*.json、部署脚本、内容与测试已有修改；src/、.github/、多个 js 产物及实施文档未跟踪。不得从 HEAD 重建或覆盖这些成果。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

交付一轮有明确终点的可靠性收尾：统计事件提交不遗漏、失败不误报成功，CI 能在干净环境运行且发现陈旧产物，部署脚本能拒绝失败，统计保存规则具有唯一实现并接入实际页面。用最终候选版本的学习与同步流程证明兼容性。

本文同时登记所有已知后续工作。只有 A1—A6 属于本次执行范围；B/C/D 为后续或外部门槛，不因为它们尚未执行而无限延长本轮，也不把它们标成已完成。本表覆盖当前证据与历史计划中的已知事项，不代表全项目不存在未知问题。

## Current state and evidence

- 本次未发现 D:/、D:/06-project/、仓库根及仓库内的 AGENTS.md。执行前重新检查。
- core.js 的 persistStatsSnapshot() 以可变 stats.events 生成提交计划，增量提交使用 eventRows 切片，事务成功后却重新 evSnapOf(ev)。规划前审查用现有纯函数复现：本批 eventRows=[e2]，等待期间追加 e3，成功标记变为 count=3，下一批 eventRows=[]。这是可触发的逻辑缺陷，尚未证明真实历史用户数据已丢失。
- src/core/storage-state.mjs 已提供 nextEventSnapshot；core.js 未用它推进标记。_bsSig 也在成功前修改。js/idb.js 的 writeStatsBatch() 在 open() 后建立事务，put() 时结构化克隆，tx.oncomplete 后 resolve。仅改成功回调的一个字段不足以证明提交内容、签名和轻量元数据一致。
- core.js 已有 saveAndNotify()、saveMem()、lastSave() 与 createLatestWriteLane()；不能再新增平行的全局保存入口。saveMem() 的历史同步返回表示接收，实际持久化结果由 Promise 给出。saveAndNotify() 等提交成功才调度同步。
- e2e/mobile-8000.test.js 已有 100 次保存与慢 IDB 用例，但循环可在第一批计划生成前就结束，不能替代“第一批已捕获后再追加”的受控交错回归。
- .github/workflows/ci.yml 的 browser job 只安装根依赖，e2e/sync-recovery.test.js 直接 require server/node_modules/better-sqlite3。各 job 文件系统独立。
- checks job 先 prepare:ci 再 build 再 build:check；prepare:ci 本身会生成 schema validator。build:check 已支持临时目录只读比较，应在任何受跟踪产物生成之前执行。
- scripts/deploy-prod.sh 的远端复制/权限/重启段有分号，前步失败可能被后步成功掩盖；curl 未严格断言 HTTP 状态；上传目录固定且复用；清单未包含 server/package*.json。脚本已有备份及生产配置保护，必须保留。
- 工程维护计划 2026-09-19-engineering-maintainability.md 仍是 in-progress，core runtime、首页主源码接入等未完成。main.html 目前通过事件等待 FormatTools，就绪等待不是轮询；不得重复宣称存在已删除的轮询。
- 2026-09-20-project-acceptance-report.md 记录历史严格 101/101 与平台范围，release-readiness 仍引用更早的 100/100。历史通过不代表当前工作区通过；规划本轮未跑全套测试。
- 2026-09-12-prelaunch-data-safety.md 有大量未勾选及重复演进方案，一部分已被后续实现覆盖。必须以当前代码与测试映射核对，不直接把旧勾选状态当成缺陷或完成证据。

## Assumptions and decisions

1. 保留多页面、esbuild、现有静态 URL、CL 公共方法、课程身份、SRS 规则、账号归属与现有同步协议。当前不需要换框架。
2. 本轮统一统计提交实现；现有 courses/progress 队列、云端冲突流程仍沿用。暂不把所有业务字段迁入 IndexedDB，也不宣称 localStorage 已全部变为可重建缓存。
3. 长期目标为按数据类别确定唯一持久化权威来源，内存负责交互、云端负责跨设备同步。此目标需要逐类迁移契约，不能在本轮以删掉 localStorage 兜底实现。
4. 使用实际浏览器、隔离服务、临时数据库与测试账号验证。不得使用当前 8787 个人学习记录作为写入夹具。模拟移动视口不等于真机验收。
5. 已通过的现有功能只作回归，不重新开发；后续方案按收益与触发条件启动。停止继续追加没有用户验收终点的纯函数拆分。
6. 本文件是下一次“继续执行”的唯一交接入口。旧工程计划的未完成条目按 B 表重新排序，并保留历史，不追溯伪造完成勾选。

## Scope

| 编号 | 优先级 | 本轮交付 | 完成边界 |
| --- | --- | --- | --- |
| A1 | P1 | 统计异步提交一致性 | 故障可受控复现，修后无遗漏、误确认、跨账号写入 |
| A2 | P1 | CI 依赖与产物检查 | 干净环境可执行；陈旧/缺失产物真实失败 |
| A3 | P1 | 部署失败检测 | 复制、校验、重启、健康检查任一失败返回非零，不显示成功 |
| A4 | P2 | 统计保存实现收敛 | 唯一计划计算实现接入 core；兼容公开调用，删除对应重复算法 |
| A5 | P1 | 候选版本端到端验收 | 学习、保存、同步、升级、移动端专项与严格全量有最终证据 |
| A6 | P2 | 待办及发布状态核对 | 旧计划映射准确；待核验与外部门槛明确；本轮不再追加工作 |

### 全部已知后续工作登记

| 编号 | 状态/顺序 | 工作、边界与验收方向 |
| --- | --- | --- |
| B1 | A 完成后按需启动 | core runtime 装配：沿用旧计划允许的 legacy-runtime 保留方式，源码生成 core.js、保持 CL 接口；完成一条调用链就删除对应备用实现，避免再造巨型共享 ctx |
| B2 | B1 后独立交付 | 首页启动与控制器：src/main/app.mjs 持有实际流程，直接导入基础依赖，保留练习按需加载；慢云端不改变当前页面、失败入口可恢复；不把现有事件等待误认成轮询 |
| B3 | 有独立服务测试收益时 | 服务端 createApp 装配与启动分离：复用已抽取 routes/services，保留中间件顺序、鉴权、事务与启动迁移；不重复拆已有路由 |
| B4 | 有迁移设计与恢复证据后 | 逐类统一持久存储：列出字段当前来源、迁移版本、兼容旧页、备份与回退；先小字段后其它实体，每类有失败恢复。全量 schema 迁移另立交接 |
| B5 | A6 核查结果驱动，发布前处理阻断项 | 旧数据安全要求：会话 epoch/ABA、generation 与事务、普通同步与确认、发布意图、恢复激活/冻结、CLI 预览确认、事件删除、旧页升级；逐条映射代码及测试。未证实项为待核验，证实阻断则维持发布阻断并形成独立修复范围 |
| B6 | 有数据差异证据时 | 统计重建及实体版本迁移：先定义事件完备性和历史兼容，再决定是否重建；不能因先前误读“7句”而重算正常数据 |
| B7 | 依赖 B4/实际发布需求 | 原子版本目录切换、依赖安装及代码/数据库协同回退；需要核对服务部署拓扑。A3 先提供严格失败与依赖变化阻断，不在本轮自动改造生产目录 |
| C1 | 发布门槛，隔离环境可先演练 | 备份→隔离恢复→核对课程、统计、版本、未决请求与回执→回退演练；复用 server/backup-db.js、backup-cli.js 和现有恢复测试，真实生产操作另行执行 |
| C2 | 发布门槛 | Android/iOS 目标浏览器真实设备验收：音频、长讲解滚动、候选区、刷新及升级。需要目标设备；模拟不能勾选真机 |
| C3 | 课程包对外互操作门槛 | 外部 course-creator 真实导出样本，运行 e2e/course-package-v2-real-export.test.js；独立报告，不以手写样本代替 |
| C4 | 外部发布动作 | GitHub 实际 CI、生产环境配置核对与部署冒烟；本轮只交付可执行配置/脚本，不能称远端已绿或已上线 |
| C5 | 发布前确定 | 冲突归档容量/保留期限、备份留存、失败可见性与日常检查责任；不擅自删归档或新增定时监控 |
| D1 | 内容批次，非架构阻断 | 补齐真实核心含义、场景、中文对应表达与例句；人工审校后按现有 schema 录入，不用模板填满缺失讲解 |
| D2 | 有复现问题再处理 | 页面字号、对比度、手机布局与性能；复用现有验收，封面/详解按钮/进度栏等历史已改项不无证据重做 |
| D3 | 明确延期 | Vite、全面 TypeScript、换测试框架、全站 CSS 重写、内容源全面转换、统一事件溯源、测试并行化。当前没有足够收益证据 |

## Out of scope

本轮不修改学习内容、不重写同步协议、不修改 SQLite/IndexedDB schema、不清库或重建真实统计、不改课程包版本、不实施 B/C/D 项。允许 A6 做其证据映射及登记。提交、推送、PR、生产部署、真实用户数据恢复、远端 CI 触发不包含在本次执行中。

## Contracts and data changes

### 统计提交合同（A1/A4）

- 继续使用 persistStats() → persistStatsSnapshot() → IDBStore.writeStatsBatch()，公开 saveMem/saveAndNotify/lastSave/waitForSync 签名及既有等待语义保持。lastSave 不能改为等待启动云端任务，避免循环等待。
- 在批次开始时固定本次 eventRows、changed 行、gone、nextEventSnapshot、nextSignatures、businessMem 的小字段投影、owner 与 generation。仅复制本批实际写入的行/事件及小字段；普通答题禁止完整复制全部历史 stats/events。
- 传给 IDB 的内容不能在 open() 等待期间被后续答题改动。nextEventSnapshot 与本次固定写入集合对应；全量替换属于低频路径，可固定全量集合。
- 只在事务成功后采纳该批签名及事件标记。失败时不采纳计划、不标记已同步；保留现有完整本地兜底与 persistError，现有“失败本次返回 false、禁止本次上传”的行为不放宽。
- 活动批次结束后，待提交批次重新依据最新内存和上一成功标记生成计划，保留后继事件。不以限制队列为由丢事件。数组替换/删除强制全量的现有语义保留。
- 账号变化后旧任务不得写入新账号；提交成功回调不得把旧批次标记应用到新账号状态。复用现有 owner/作用域机制，测试该边界；若修复必须改变会话或同步协议，记录精确矛盾并 needs-planning。
- A4 仅删除与 buildStatsPersistencePlan 相同的内联算法，以及已确认重复的本批准备逻辑。保留必要公开包装器、受支持的无 IDB 降级。确保所有生产页面加载依赖后才调用；孤立测试夹具相应加载真实依赖，不能重新引入产品备用算法来迎合夹具。
- 使用既有 src/core/storage-state.mjs；只有业务边界确需独立且减少重复时才新增模块，不新增 facade 框架或通用状态容器。

### CI 与产物（A2）

- browser job 安装两个 lockfile 对应依赖；审查其余组实际依赖，保持每个 job 自足。
- checks 在 build/prepare:ci 写入受跟踪产物之前执行只读 build:check；必要的忽略产物准备单列。content:check-generated 和严格 SW 检查不得被提前生成受跟踪资源掩盖。
- 用临时副本注入陈旧/缺失产物验证非零退出，检查真实脚本而非只匹配 workflow 文本。生产产物生成完成后再启动最终验证，不在验证过程中修复被检查的候选版本。
- 本地干净依赖验证使用当前工作区的隔离副本，包含未跟踪源码，排除凭据、数据库、依赖和 output；不能直接 git worktree HEAD 丢失当前功能。Linux 原生依赖在 Linux 安装，不能复用 Windows better-sqlite3。

### 部署（A3）

- 复用 deploy-prod.sh、check-deploy-files.js、deploy-safety.test.js；远端使用明确 bash 失败传播，检查关键命令返回值；所有关键失败使整体非零，不继续重启或打印成功。
- 每次上传使用唯一临时目录，只清理本次创建且已校验路径的目录。备份与生产配置检查继续在修改运行文件之前；不加入自动删除生产文件行为。
- 冒烟精确校验 health 成功与响应、根路径预期重定向、页面/关键资源 200，以及当前候选 SW/文件摘要。curl 成功但 HTTP 404/500 不算成功；重定向不能被随意 200 校验误判。
- 后端依赖若与候选 server/package.json/package-lock.json 不一致，必须在覆盖运行文件前明确阻断，提示按后续依赖升级流程处理。本轮不在运行中的生产目录临时 npm ci。将依赖清单纳入候选身份与预检，更新部署检查器相应规则。
- 增加 Bash 本地假远端夹具：SSH/sudo/systemctl/curl 等只在临时目录模拟，执行真实命令块；测试复制失败、权限失败、重启失败、HTTP 错误、摘要错误与成功路径。禁止测试调用真实 SSH 或 systemctl。可在 scripts/deploy-transaction.test.js 中实现并纳入清单。
- 原地复制仍可能部分更新，A3 不能宣称原子发布；保留失败现场与恢复提示，将该残余风险明确关联 B7。

## Implementation steps

- [x] A1. 核对当前工作区及指令；扩展 e2e/stats-idb.test.js 的真实慢事务交错回归，修正 core.js 的批次快照和成功水位。
- [x] A2. 修改 .github/workflows/ci.yml：独立 browser job 安装 server 依赖，各测试 job 先生成浏览器产物；build:check 保留构建前后两道边界。
- [x] A3. 修 scripts/deploy-prod.sh：唯一临时目录、退出清理、远端 fail-closed shell、严格 HTTP/SW 校验、服务端 lockfile 变化阻断；部署护栏保持通过。
- [x] A4. 收敛统计计划的实际生产路径：本批变更行、事件、业务小字段、签名与水位均固定后提交，成功后一次性采纳；公开 CL 接口和存储协议保持。
- [x] A5. 完成定向、严格全量和发布专项验证，并记录最终候选结果；没有使用重试掩盖失败。
- [x] A6. 核对旧工程计划、数据安全计划和验收/发布状态；B/C/D 保持待办、延期或外部门槛。

## Validation

- [x] A1/A4：node scripts/core-storage-state.test.js；node scripts/core-runtime.test.js；Chrome 下 node e2e/stats-idb.test.js（23/23）；node e2e/mobile-8000.test.js。
- [x] A3：node scripts/deploy-safety.test.js（16/16）；node scripts/check-deploy-files.js；bash -n scripts/deploy-prod.sh；未连接生产。
- [x] 定向浏览器：同步恢复、课程完成换课、首页启动、进度、移动端详解、账号专项均在严格全量中通过。
- [x] 产物检查：npm run build:check；npm run content:check-generated；node scripts/check-sw.js --strict；npm run lint；npm run typecheck；git diff --check。
- [x] 最终完整运行：TEST_RETRIES=0、CHROMIUM_PATH=Chrome 的 npm test：121/121；npm run e2e:release：24/24。
- [ ] 干净 Linux 隔离副本和真实 GitHub workflow：本机 Windows/Chrome 已验证，远端 workflow 未触发，保持外部验证待办。
- [x] final candidate 在全量前后固定检查；首次全量因默认 Playwright 路径缺失被环境阻塞，指定本机 Chrome 后最终 121/121。

## Acceptance criteria

- [x] 增量与全量保存的受控交错不丢后继事件；保存成功标记与实际提交内容一致，刷新读回仍一致。
- [x] 事务失败路径保留原有不确认行为；本次没有改变账号作用域与云端协议。
- [x] Runtime entry point connected：实际页面通过 CoreStorageState 生成统计计划，公开 CL 行为兼容。
- [x] CI 配置已补齐独立 browser 的 server 依赖，产物检查保留前后两道边界；远端 workflow 未触发。
- [x] 部署安全护栏 16/16 通过，失败传播、HTTP 错误、依赖变化和唯一临时目录均有合同检查；原子发布延期至 B7。
- [x] 最终严格测试 121/121、发布专项 24/24，以及静态/产物检查均通过。
- [x] A6 清单已区分本轮完成、历史完成、待核验、延期、外部门槛。

## Risks and rollback

- 写入冻结过粗会恢复全量复制成本；按本批行复制，低频全量独立处理。漏冻结行对象或 businessMem 小字段也会造成提交标记与内容不一致。
- 缺失模块可能影响旧测试夹具及页面加载顺序；通过实际页面验证后再删对应重复实现。保留兼容 URL，不全站一次转换。
- 本轮无 schema 变更，回退以本轮文件差异为单位，禁止 git reset/checkout 覆盖用户改动。回退保存修复会重新引入已知缺陷，不能当作长期解决方案。
- 实际部署仍可能有部分复制与数据库迁移风险，B7/C1 未完成时不能称生产无风险或自动恢复；本轮不执行部署。
- 若证据要求改变同步协议/会话身份/数据库结构，记录具体冲突与最小需要的决策，状态设 needs-planning；不再发起无边界全项目复审。

## Execution notes

已完成 A1—A6。本轮主要改动：core.js 的统计批次固定与成功水位、e2e/stats-idb.test.js 的真实慢事务交错回归、.github/workflows/ci.yml 的独立依赖/构建、scripts/deploy-prod.sh 的失败传播与严格冒烟、scripts/deploy-safety.test.js 的发布合同护栏。

验证记录：

- Windows/Chrome：TEST_RETRIES=0 npm test，最终 121/121；CHROMIUM_PATH=Chrome npm run e2e:release，24/24。
- npm run build:check、npm run content:check-generated、node scripts/check-sw.js --strict、npm run lint、npm run typecheck、bash -n scripts/deploy-prod.sh、node scripts/check-deploy-files.js、node scripts/deploy-safety.test.js：均通过。
- 真实 GitHub workflow、Linux clean clone、生产部署、真实设备、外部 course-creator 互操作、备份恢复演练未执行；它们仍是发布门槛，不影响本轮代码收尾状态。

A 本轮已完成并停止。B/C/D 不自动转入下一轮实现。
