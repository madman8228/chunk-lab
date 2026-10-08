# 同步冲突徽标：运行时根因核验

- Status: complete
- Updated: 2026-10-05
- Branch/worktree: `master`, `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `09553df`; 工作区已有大量未提交改动，包含 `main.html`、服务端配置、E2E 和两份持久化 handoff。执行前后均不得清理、重置或覆盖这些改动；本 handoff 仅允许在已核实的故障边界内增量修改。
- Planner: Astra-Luna planning phase (user confirmed model switch; active selection is not exposed to the agent)
- Executor: GPT-5.6 Luna

## Objective

修复“服务离线/配置未知时仍把旧冲突徽标暴露给学习者”的运行时缺口。对旧协议、协议 3、离线/配置未知明确区分：学习界面不再展示内部同步冲突处理 UI；状态文案只陈述可证明的本机耐久保存/云端确认事实；旧冲突原件继续安全保留，并在后台恢复路径处理。此窄 handoff 不提前切换真实服务协议，也不替代全站持久化主 handoff。

## Current state and evidence

- `main.html` 的 `refreshSyncBadge()` 仅在 `serverPersistenceEnabled()` 为真时隐藏旧徽标；该谓词要求配置同时为 `persistenceMode: 'server-authoritative'`、`writeProtocol: 3`，且 `ServerStore` 与 `IDBStore` 已加载（`main.html` 约 6741、6950 行）。否则保留旧协议状态 UI。
- `server/index.js` 生产启动默认请求 protocol 2；只有持久化运行配置已记录 protocol 3 才报告 server-authoritative。仅测试环境可用 `CHUNKLAB_WRITE_PROTOCOL=3` 请求协议（约 64–68 行）。因此“徽标还在”本身不能证明徽标代码失效。
- `e2e/main-persistence.test.js` 已在隔离 protocol 3 服务验证旧徽标隐藏且 legacy journal 保留；它不能证明用户当前浏览器连接的实例、配置或资源版本。
- `docs/implementation/2026-10-04-sync-conflict-cutover.md` 与 `docs/implementation/2026-10-02-transparent-learning-persistence.md` 均为 `in-progress`。主 handoff 的全站业务写入口、恢复和默认协议切换验收仍未完成，禁止仅为消徽标启用全局 protocol 3。
- 之前只读探测时 `127.0.0.1:8787` 拒绝连接；浏览器截图不能单独提供 `/api/config`、实际 HTML/JS 版本或 Service Worker 控制状态。当前真实运行时原因仍未证实。
- 源码核验确认离线/未知配置是独立运行分支：`core.js::ensureCloud()` 将配置请求失败设为 `_cloudConfig=null` 并让页面继续本地启动；`main.html` 随后因 `serverPersistenceEnabled()===false` 加载 legacy resolution UI 并依据旧 journal 展示徽标。它解释了“服务不可达且页面仍显示同步冲突”的可能路径，但无法证明用户截图的唯一根因。
- 当前 `js/save-status.js` 只在 protocol 3 时工作；未知/离线状态不会诚实表达“本机保存、云端未确认”。旧冲突原件有恢复保全能力，但普通页面的 badge/modal 加载逻辑还把“未知”与“需要用户选择旧版本”耦合。

## Assumptions and decisions

- 用户已明确要求全站不要向普通学习者暴露同步内部冲突；这不授权伪称云端已保存、丢弃冲突材料或对无法证明安全的版本自动选边。
- 只在目标本地服务已由用户启动且可读时，执行不带认证秘密、不触发写入的 GET/浏览器状态检查；服务未运行时不得启动它，改用隔离服务验证并把真实实例原因标为未核实。
- 普通学习入口在 protocol 2、protocol 3、离线/未知配置下均不显示整账号“同步冲突”badge/modal；内部错误进入可恢复、非学习流程的后台状态/恢复中心。旧版本 UI 不作为普通学习入口的兼容要求，相关 pending/journal 必须保全。
- 运行状态至少区分 `unknown/offline`、显式 legacy protocol、protocol 3（初始化中/ready）。配置缺失/过期/请求失败绝不能被推断为 protocol 3；协议升级/旧客户端刷新必要提示仍可单独保留。
- “本机已保存，云端未确认”只可在本机耐久写已成功后显示；若本机耐久写失败，应阻止接受该条新学习结果并显示简短、可行动的保存失败提示。不能只因调用了 localStorage/IDB API 或隐藏冲突徽标就宣称已耐久。
- 同一请求自动重试沿用原 `requestId`/正文；不确定回执不重复计数；无法无损合并的旧冲突保留双方原件并隔离，不要求学习者选择本机/云端版本。
- 产品决策已按用户“整个网页都不要把同步问题暴露给用户”的明确要求收敛：采用后台隔离路线，不做普通页面中的人工版本选择。协议 2 的整包冲突只有在领域合并规则证明无损时才自动合并；否则先持久归档本机快照、云端快照、冲突元数据和待办标识，再暂停该旧协议 scope 的云端整包覆盖。用户仍可继续本机耐久学习，但必须如实显示“此设备已保存，云端尚未确认”；后台安全重试/升级协议，无法自动解决时只进入受权限保护的运维诊断，不弹出用户冲突/容量/选边 UI。此决策不允许丢弃任一方或伪称已同步。
- 若双份归档无法耐久完成，禁止继续可能覆盖任一方的云端写入；本机已成功耐久的学习可继续，状态仍不得称云端已保存。设备本地耐久失败才给出简短、可操作的保存失败提示。

## Scope

- 调整 `core.js` 的运行状态表达与 `main.html` 普通入口启动/徽标挂载，避免配置未知被当成“应显示冲突选择 UI”；按需复用/扩展 `js/save-status.js`，让本机耐久与云端确认状态语义可验证。
- 对首页、课程学习、题库、统计、作者入口检查旧 conflict UI 的挂载/共享保存提示，移除普通学习流中的内部冲突呈现，不扩大到无关 UI 重设计。
- 将协议 2 冲突从“要求用户选版本”改为后台安全分流：复用 `SyncResolution.preview()` 的只读双方快照，不调用 `resolve()` 代替用户选边；无损批次按现有领域规则自动合并，其他冲突先通过恢复归档链路保存双方快照及待办信息，再隔离旧整包上传。复用 `server/services/recovery-ingest.js` / `user_recovery_sources` 时必须证明归档能保存并校验两侧原件；否则在该链路内新增带 source hash、scope、状态和唯一来源 ID 的隔离记录，不另建一套冲突裁决协议。只有隔离归档确认后才能停止旧 scope 的破坏性重试。
- 在隔离 SQLite + HTTP + Chromium 中测试 protocol 2 / protocol 3 / 配置 GET 失败 / 学习中断网 / 本机存储失败 / 恢复联网 / 刷新与新标签；检查实际 DOM、操作回执、耐久恢复材料及重试去重。
- 只在隔离环境验证 Service Worker 更新一致性；若无证据证明资源版本问题，不修改缓存版本或无关页面资源。
- 把最终证据和剩余的全站写入口/部署门槛记回主 handoff。真实 8787 不可读时保留运行实例配置未核实的事实。

## Out of scope

- 不修改真实 `127.0.0.1:8787` 服务状态、真实 SQLite/账号数据、持久协议配置或部署。
- 不把 production protocol 默认改为 3；不清理 journal、待办、备份、浏览器存储或 Service Worker 缓存来“解决”问题。
- 不重复实施主 handoff 的全站写入口迁移，也不把本诊断结果计作全站持久化完成。

## Contracts and data changes

- `/api/config` 与页面运行时配置必须一致；未知/缺失配置是独立状态，不可推断成 protocol 3，也不可触发普通学习者的整账号冲突选择界面。
- 所有协议分支的普通学习页面均不显示 `syncBadge`/`SyncResolutionUI`。必要旧协议恢复能力转到不打断学习的恢复/运维路径；本 handoff 不允许删掉或自动覆盖旧恢复材料。
- 协议 2 未解决冲突必须同时保存冲突前后的完整本机/云端原件、服务 scope、冲突实体/水位及关联 pending 身份；归档使用内容 hash 与稳定来源 ID 幂等校验。归档未确认前不能解除暂停或对同一旧整包 scope 发可能覆盖数据的请求。协议 3 不得回退到旧整包。
- `unknown/offline`：页面可继续的前提是该条操作已被本机耐久接受；提示“已保存在此设备，云端尚未确认”或等价诚实文案。云端确认前不得标“已同步/已保存到云端”。重连后自动恢复配置并按原幂等请求收敛。
- 本机耐久失败：该条学习写入不得被当作已接受；提供简洁明确的保存失败提示与重试，不把故障详情/版本比较/备份容量内部概念抛给学习者。
- protocol 3：业务写仍走窄操作队列；legacy journal/恢复来源/未知回执材料继续保留。
- 所有运行时诊断输出须剔除令牌、API key、学习正文和用户数据。测试仅使用合成账号与隔离数据目录。

## Implementation steps

- [x] 1. 在 `core.js` 增加可测试的显式运行态分类（配置未知/离线、已确认旧协议、protocol 3 初始化、protocol 3 就绪），覆盖 `ensureCloud()` 失败、重试及协议切换；保留服务端旧写 gate，不把未知态推断为 protocol 3。
- [x] 2. 在 `js/sync-resolution.js`、`js/legacy-recovery.js` 与 `server/services/recovery-ingest.js` 建立旧协议冲突隔离路径：用只读 preview 获取双方原件；为冲突来源生成稳定 ID/hash；将双方完整快照和 scope/水位/pending 元数据耐久归档并回读校验；冲突无法无损合并时暂停该 scope 的旧整包上传，但不暂停已耐久的本机学习。归档失败时保持暂停并保留本机原件。不得调用现有 `resolve()` 偷选 local/remote。
- [x] 3. 更新 `main.html` 与共享保存状态；从普通入口移除 `syncBadge`/`SyncResolutionUI` 加载依赖，并让 `courses.html`、`decks.html`、`stats.html`、`course-create.html` 使用同一状态合同。旧冲突不再要求用户在恢复中心手工二选一；仅受权限保护的运维路径可查询隔离状态，用户页面不出现冲突或容量提示。已增加 admin-only 只读索引，只返回验证归档的 ID/hash/冲突种类和双方快照摘要，不返回学习内容。
- [x] 4. 让提示由“本机耐久接受/云端确认/耐久失败”事实驱动，覆盖 `js/save-status.js`、`js/server-store.js` 与旧协议写路径；未知/离线只有本机耐久提交成功才能继续并显示未确认状态，本机耐久失败不得吞掉业务结果或虚报保存。
- [x] 5. 新增/扩展隔离 Chromium + SQLite E2E：协议 2 整包冲突及其双份归档、协议 3、配置接口失败、在线学习断网/恢复、刷新/新标签、归档空间失败与本机耐久写失败；验证用户 DOM 无 conflict badge/modal/capacity 信息、已保存本机学习可继续、冲突原件完整可校验、同一操作只入库一次、归档失败时云端覆盖仍被禁止。
- [x] 6. 只有出现可复现的 SW/资源版本错配证据才修对应依赖/生成逻辑；否则保持资源不变。运行指定测试，并把证据、真实 8787 未核实边界与全站迁移剩余工作回记到 10/02 与 10/04 主 handoff。

## Validation

- [x] `node e2e/main-persistence.test.js` 及新增/扩展的 targeted sync-badge E2E；使用临时服务与隔离 SQLite；失败诊断不含令牌或学习正文。
- [x] `npm run test:browser`（59/59；元数据 E2E 首轮波动、重试通过）、`npm run test:unit`（72/72）、`npm run test:server`（27/27）、`npm run test:checks`（17/17）、`npm run lint`、`npm run typecheck`、`npm run build:check`、SW 与部署检查均通过。
- [x] 目标文件 `git diff --check`；没有顺手清理工作区其他既有改动。
- [x] 用户实例只读 GET 不可达；没有 POST/PUT/DELETE、服务重启、数据库变更。真实页面运行态/SW 原因保留为未核实，隔离 E2E 只证明代码合同。

## Acceptance criteria

- [x] Protocol 2、protocol 3 和配置未知/离线都能在隔离真实运行时明确区分；普通页面不显示整账号同步冲突 badge/modal/备份容量细节。
- [x] 离线普通学习只在本机耐久成功后被接受；提示不谎报云端确认。断网操作在刷新后以同一幂等身份收敛，SQLite 不重复计数。
- [x] 本机耐久失败时拒绝接受该次新写并显示短提示；旧冲突双方快照、pending 源和恢复副本保留。不可无损合并的冲突归档后隔离，不阻断本机耐久学习，也不继续可能覆盖数据的旧整包上传。
- [x] 协议状态初始化/离线/恢复重试、刷新、新标签与 SW 更新合同有真实浏览器测试；用户实例的活动页原因诚实标为未核实。
- [x] 没有提前切换真实协议、假报“已同步”、删除用户数据或修改真实服务；全站写入口迁移与 production 默认协议仍按 10/02 主 handoff 管理。

## Risks and rollback

- Service Worker 缓存可能令当前页面显示旧行为；只允许用隔离浏览器验证自然更新，不清理用户真实存储。
- 若协议字段、页面依赖和实际服务地址不一致，原因可能属于启动/部署配置而非代码。此时停止产品代码猜修，提供精确差异与需要用户授权的操作；不得写入真实实例。
- 资源版本改动必须可通过原文件回退；保留用户既有 dirty worktree，不使用 reset/checkout 清理。

## Execution notes

- 2026-10-05 planning：根据当前源码、两份 in-progress handoff 和隔离 E2E 证据形成此窄诊断交接。仅新增本 handoff；未改产品代码、启动服务、触碰真实数据或部署。真实 8787 有效配置与浏览器 SW 版本尚未核实。
- 2026-10-05 execution：只读 GET `http://127.0.0.1:8787/api/config` 被拒绝；没有启动/重启服务。当前 Codex 浏览器仍打开 `http://127.0.0.1:8787/main.html`，可见 `#syncBadge` 的“同步冲突”，但该页可能是此前加载的活动文档，不能据此读取当下服务配置或 SW 版本。
- 新发现的合同缺口：`core.js::ensureCloud()` 在网络失败时把 `_cloudConfig` 设为 `null` 并继续本地启动；`main.html` 随后 `loadLegacySyncResolutionUi()`，且 `serverPersistenceEnabled()` 为 false，`refreshSyncBadge()` 会按旧冲突状态展示徽标。因此“配置未知/离线”是独立于 protocol 2 与 protocol 3 的第四种可见运行状态。它能解释当前“页面仍开着、服务端口拒绝连接、徽标仍显示”的组合，但由于不能只读取得活动页的 JS 状态，尚不能断言它就是截图的唯一根因。
- 隔离验证：protocol 2 冲突页面 `node e2e/sync.test.js` 27/27（含真实 conflict badge）；protocol 3 主页面 `node e2e/main-persistence.test.js` 最终通过并在浏览器全组通过；SW 升级 `node e2e/upgrade-check.js` 28/28；`npm run test:browser` 59/59（`deck-progress-diagnostic` 首轮失败、重试通过）。主持久化 E2E 本轮曾出现一次未复现的 19/20 统计偏差，随后新增仅失败时输出合成请求 generation/receipt 的诊断，后续两次独立运行和完整浏览器组均为 20/20；因此仍保留为需监控的时序风险，不宣称已解释。
- 需要规划裁决：当 `/api/config` 暂不可用或页面离线时，是否按用户既定目标隐藏“同步冲突/整账号处理”技术界面，同时只在本机写入已耐久确认时显示“已保存在本机，云端尚未确认”这类不误导状态；还是继续暴露旧冲突 UI。推荐前者，但必须明确本机耐久失败时的行为、旧 pending/journal 的保全和恢复入口，再补离线冷启动/刷新 E2E。不得把未知模式当作 protocol 3，也不得显示“已同步”。
- 因未知/离线状态不在原协议矩阵内，且以上决定会改变用户可见行为及保存保证，按 Astra-Luna 规则将 handoff 置为 `needs-planning`；当前没有针对产品运行时代码的改动。测试文件只增加了初始化失败与离线答题异常的诊断输出。
- 2026-10-05 replanning：用户此前明确要求全站不向普通用户暴露同步冲突，故将产品政策收敛为“隐藏内部冲突 UI，但不隐藏数据安全事实”：明确区分离线/未知与 protocol 3、只在本机耐久成功后说本机已保存、云端未确认前不谎报同步、耐久失败时拒绝确认该条操作，并保留所有待办/原件供后台恢复。此决策不提前切换真实协议或删改数据。实施边界、真实浏览器/SQLite 验收和主 handoff 依赖已补齐；状态恢复为 `ready-for-luna`。本次只更新本 handoff，无产品代码/真实服务/用户数据变更。
- 2026-10-05 execution resumed：开始按本 handoff 检查入口和测试；当前工作区已有相关页面与测试的未提交修改，所有重叠文件按当前内容增量修改，不以 `09553df` 覆盖。
- 2026-10-05 execution resumed after model switch：已实现运行态显式分类、旧协议冲突双方归档并验证、隔离 scope 暂停、普通首页移除冲突 badge/UI、共享保存状态提示；`npm run build`、`npm run build:check`、核心运行态/恢复归档/服务端归档单测及 `node e2e/sync.test.js` 通过。正在适配原先依赖人工冲突弹窗的 null-revision E2E，并补跑离线/未知配置与主浏览器套件；主 handoff 全站持久化迁移仍未完成。
- 2026-10-05 execution verification：离线配置真实浏览器场景发现旧状态总线未在本机提交后发出未确认提示；现在仅在本机 durable commit 成功且配置为 unknown/checking/offline 时发送 safe-save 事件，页面显示“已保存在此设备，联网后会继续尝试”。`e2e/sync.test.js` 扩展至 33/33，覆盖配置失败、冲突 UI 缺席、本机提交和在线恢复后重新读取配置；`e2e/main-persistence.test.js` 断网 20 个答案刷新后准确收敛且本机提示可见。恢复来源 manifest 只保留冲突双方哈希摘要，新增 `/api/admin/sync-quarantines` admin-only 查询并验证匿名 401、管理员可查、接口不会返回学习快照。`npm run test:browser` 59/59、unit 72/72、server 28/28、checks 17/17、lint、typecheck、build:check、gen-sw/check-sw/check-deploy-files 均通过；浏览器组的 `imported-course-learning-metadata` 首次失败后重试通过，作为一次 flaky 保留。服务端恢复归档与冲突容量故障、ServerStore 本机 enqueue 失败也由相关 server/browser 用例覆盖。此窄 handoff 的实施和隔离验收完成；主 handoff 的恢复中心后续处置、其余业务入口接线与协议默认切换仍未完成。只读探测 8787 仍不可达；没有重启真实服务、接触真实数据库或部署。
- 2026-10-05 execution gate：实现前发现一项与新合同直接相关的能力缺失。`js/sync-resolution-ui.js` 的旧协议冲突 UI 提供预览 local/remote 并由用户选边；`js/recovery-center.js` 的 `legacy-conflict-journal` 规则明确不恢复冲突项，仅允许恢复无冲突新增内容；服务端 `routes/sync.js` 与 `user_sync_resolutions` 也仅提供显式 resolve/receipt，并无自动/后台裁决服务。因此直接隐藏旧协议 UI 会把冲突留在原件但没有普通用户可触达的恢复路径；直接搬入现有 Recovery Center 也不满足计划合同。按执行规则置为 `needs-planning` 并暂停本 handoff 的产品改动。待裁决的具体设计问题：真实冲突应 (A) 后台隔离并持续允许本机学习，直到安全自动合并/版本升级，还是 (B) 转入低打扰、非学习流程的人工恢复入口；两者决定冲突期保存/恢复产品合同。已确认用户不应看到首页即时冲突徽标/容量弹窗，但尚未批准对不可自动合并旧整包冲突的恢复方式。本轮未改产品代码。
- 2026-10-05 replanning：用户已明确要求整个网页不向普通用户暴露同步问题；据此裁定采用 A：冲突可证明无损时后台合并，否则先校验并保全双方原件，再把旧协议 scope 隔离，学习继续以本机耐久成功为前提，云端未确认时不宣称已同步。隔离归档失败则继续阻止可能覆盖的云写入；不可自动合并的记录只留在受权限保护的运维路径，不向用户呈现二选一/容量告警。该决策不授权切换真实协议、触碰 8787 或删除历史记录。交接状态恢复为 `ready-for-luna`；本次仅更新本 handoff，未修改产品代码或真实数据。
