# 首版上线数据安全收口：Astra → Luna 实施交接

- Status: in-progress
- Updated: 2026-09-12
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: 4208ebd947b41dba9c2a18ea8d9b58ef09395ad8；账户隔离、恢复、条件批量同步及其测试均有未提交改动，必须基于当前工作区续作，不能退回 HEAD 重做。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

**最新执行入口：本文末尾“上线必要工作最终收口计划”。该节基于最新代码复核，优先于旧 R1—R5 和历史执行记录；已完成能力保留，不按旧清单重复建设。**

交付可以进入小范围试用验收的版本：保存结果可信、跨设备不静默覆盖、迁移可恢复、失败可重试。接通真实页面，不以独立模块测试通过代替功能完成。

发布判定仍以 RELEASE_CHECKLIST.md 的 G1—G5 为准。本计划代码实施范围固定为 D1—D4，以及发布检查/演练说明补齐；生产操作和真机验收单独等待实际证据，不假称自动完成。

## Current state and evidence

2026-09-12续规划：下表为首轮规划时的基线。当前四页已加载 BatchSync，普通发送已部分接通，备份导入已换入口；但安全合同尚未实现完整。**下一次执行必须先完成文末“剩余工作执行顺序（修订版）”，其具体决策优先于历史执行记录。** 本轮仅更新交接文件，没有改产品代码或重跑测试。

已核对工作区、发布清单、项目记忆、核心发送路径、服务端写接口、BatchSync 实现和测试入口。本轮是规划，未重跑测试；下列通过记录来自现有项目记录。

| 工作包 | 已有基础 | 上线阻断缺口 |
| --- | --- | --- |
| D1 账户、迁移、恢复 | 四页账户分区；旧数据导出；新空间恢复及激活指针；专项记录通过 | 跨标签页会话 ABA、过期处理、旧页升级；旧覆盖导入旁路；恢复后云同步永久暂停 |
| D2 并发一致性 | 服务端可选 baseSeq/requestId；事务回执；BatchSync 持久固定请求；服务端26项/浏览器12项记录通过 | core.js 普通请求没有使用该协议；HTML/部署未加载模块；课程直写等旁路；批量冲突无完整处理 |
| D3 队列收敛 | 课程、学习记录部分持久操作日志 | 多套发送者并存、确认与新编辑交错、删除/重建协议及恢复收敛 |
| D4 保存可信与容量 | IDB 大数据、分批内容、统计分页 | saveMem 同步成功不等于落盘；连续整份 stats 拷贝排队；立即刷新、失败和峰值缺证据 |

关键定位：core.js 的 saveMem、sendCloudData、syncFromCloud；js/idb.js；js/account-storage.js；js/batch-sync.js；js/legacy-restore.js；js/sync-resolution*.js；server/index.js 的 saveData 与写接口；server/db.js、server/validate.js。

保留全部既有工作，尤其不改无关的 deliverables/promo-video-chunklab.md。PROJECT_MEMORY.md 部分描述已落后，不能据此否定新模块；优先实际代码和 RELEASE_CHECKLIST.md 最新小节。

## Assumptions and decisions

1. 首发是小批量内容、小范围试用，8000句是后续容量方向，不要求本轮生产完整8000句。
2. 采用账号级条件版本，允许不同设备无关修改也产生冲突；首发不做智能合并。
3. 所有学习数据写入统一经过持久批量发送者。课程旧重放路径不再独立上云；保留其日志，转换并确认后才能淘汰。
4. 已有本地数据但无可信云基线时，不能先读取最新 seq 再上传旧数据。进入首次同步核对，用户明确选择后才建立关系。
5. 冲突首发提供“保留本机，暂不同步”“使用云端”“使用本机”三个明确动作。后两者先展示双方差异数量和影响，备份双方并显式确认；绝不默认覆盖或后台合并。
6. 正常本地编辑可继续；冲突期间暂停上云。恢复激活、采纳云端及其他全量替换期间冻结编辑，完成后重新加载。
7. Web Locks 不可用时禁止安全同步/恢复操作并解释原因，不退回不安全并发写入；真机验收确认首发浏览器满足要求。
8. 不引入框架、微服务或另一套独立未接入的同步基础设施。对保存接口的异步改造只覆盖真实业务调用链。

## Scope

四个入口 main.html / decks.html / stats.html / courses.html，相关业务保存调用者、账户/API层、IDB日志、同步与恢复前后端、部署/SW清单及对应测试。补齐独立测试和演练入口，复用现有工具，不为“工具齐全”另建后台。

## Out of scope

完整8000句内容生产、全面拆分 core.js、新框架、逐字段智能合并、完整历史管理界面、全面增量下行、视觉优化、宣传视频。未经授权不提交、不推送、不部署、不触碰真实用户数据库。

## Contracts and data changes

### A. 持久状态与本地保存

- 沿用账号分区 IDB，在版本升级中增加本地提交元数据记录；可使用独立 metadata store，避免与按实体枚举的 syncIntents 混淆。迁移事务保留全部旧 store 和记录。
- 元数据至少包含 schemaVersion、owner、localGeneration、acceptedSeq、acceptedGeneration、固定 pending、同步状态。acceptedSeq 只能对应已经接受并落盘的云端状态，不能单独由网络响应推进。
- 每次业务提交在同一 IDB 事务写入变更数据、相应操作日志及递增 generation。仍留在 localStorage 的同步业务小字段，需在该事务保存其权威值/提交记录；localStorage 只作可重建投影。不能以跨两次存储写入冒充原子提交。
- 小字段首次迁入时保留原件并标记完成，启动优先使用已提交的 IDB 版本。分类列明临时UI状态、凭据和业务状态，凭据不能入业务备份。不要每答一题存整库快照。
- 保存承诺在 transaction.oncomplete 后成功；失败保留错误/重试状态，不能显示“已保存”，不能推进同步签名。
- 多标签页提交必须核对读取时的 generation；对旧整份快照拒绝并重读，不覆盖较新的其他标签页数据。行级变更从事务内最新值计算。

### B. 条件同步与固定请求

- PUT /api/data 对学习数据强制合法 baseSeq + requestId。缺少条件返回明确升级错误（HTTP 428、CLIENT_UPGRADE_REQUIRED）；不得保留生产无条件写开关。
- stage 原子保存 payload、requestId、baseSeq、capturedGeneration 和纳入的 operationId。落盘后才发请求；后续编辑生成新操作，不修改固定请求。
- 启动先重试已有 pending，完成前不拉取合并、不推进基线。成功回执只表示该请求的提交 seq，不是当前云最新版本。
- 回执确认、更新已接受状态、清理匹配操作 ID 在同一 IDB 事务完成。当前 BatchSync.retry 单独清 pending 的行为需要与业务确认整合，避免其后崩溃丢失确认信息。
- pending 期间的新编辑只在确认其来自该本地提交链后形成下一批；清队列不能按实体 ID 粗暴清掉较新操作。无本地待发且无编辑时才接受新云快照，并在提交时复核 generation。
- GET 全量快照与 seq 必须来自同一数据库读事务。现有客户端 LWW 拉取合并不得继续为条件写建立新基线。
- POST /api/courses、DELETE /api/courses/:courseId、POST /api/import 的业务调用迁到统一队列；遗留写接口返回升级错误或调用同一条件事务，禁止无条件直写。核对 /api/deck/publish 的数据版本副作用并纳入条件保护；不把鉴权、反馈、AI调用误当同步实体写入。

### C. 冲突、首次连接和恢复后重新联网

- 新增账号级比较/解决能力，可扩展 server/sync-resolution.js，但不能把 batch 传给仅支持四类单实体的现有接口。
- 比较取得一致快照、seq、绑定账号和内容摘要的预览 token。客户端预览记录同时绑定 localGeneration、owner 和恢复活动版本；任何一方变化须重新比较。
- “使用本机”：服务器事务检查 token/seq，验证完整替换载荷，持久保存双方备份，再执行完整账号学习数据替换、推进版本并保存幂等回执。完整替换明确表达缺失项删除，不借用普通增量 payload 推断。保留账号、凭据、公共资源归属等非学习数据。
- “使用云端”：先固定双方备份，通过已有新命名空间激活方案采纳云快照；若云端随后改变，后续同步仍由旧 seq 拒绝，不静默重置到新 seq。
- 请求丢回执继续原编号查询/重试；未确认状态不能取消后直接生成新替换请求。用户可离线保留数据，但必须先澄清可能已提交的远端结果。
- 备份失败/容量超限则阻止解决，不先覆盖再补备份。复用现有归档上限，超限提示导出处理，首发不自动删档。
- 恢复后的 cloud-hold 只在上述核对流程成功、已接受状态和活动空间正确落盘后解除。中断保持暂停，可再次进入；不得提供无条件“继续上传”。

### D. 会话与旧版本

- 持久会话代次独立于 token 内容，登录、退出、切换服务均递增；请求发送和提交结果都校验，覆盖跨页 A→B→A 同token往返。
- 会话代次不改变业务 owner（服务地址+uid），正常续期不能丢失原待发队列。所有队列/恢复 scope 统一使用规范化 owner。
- 过期鉴权暂停并要求重新登录；网络失败不清账户、不自动创建游客替代旧账号。
- 服务端条件写强制后旧客户端只能收到升级提示；新端验证 SW/IDB 升级、旧页晚到写入以及不丢原始本地空间。无法证明归属的旧数据继续人工确认，不能猜测。

## Implementation steps

按以下依赖执行，D1的云恢复闭环依赖D2，不能为遵守表面顺序而提前解除保护。

- [ ] **1 / D1 边界补齐。** js/account-storage.js、api.js、auth-ui.js：持久会话代次、规范 owner、过期/离线处理。main.html 的旧覆盖式备份导入改走预览恢复；不支持的格式明确拒绝，保留导出。验证四页都不能绕过。
- [ ] **2 / D4+D3 本地提交底座。** js/idb.js、core.js 及实际保存调用者：落实 A 合同，原子数据+日志+generation，传播异步成功/失败。迁移既有日志，不丢在途固定请求。先写刷新/事务失败/跨页覆盖测试，再接业务入口。
- [ ] **3 / D2 接通普通同步。** 改 js/batch-sync.js、core.js、api.js，实现 B；移除旧课程独立发送竞争但保留未确认记录。四页加载顺序 AccountStorage→IDB→BatchSync→core；更新实际依赖、部署清单和 SW 生成规则。验证点击真实答题/导入产生条件请求，不再手工注入模块证明接入。
- [ ] **4 / D2 服务端封闭旁路。** server/index.js、validate.js、db.js、sync-conflict.js：强制协议、完整读快照、写入口保护；同步更新旧测试夹具，保留“旧客户端被拒绝”的断言。原子回执保留策略不变，增加重启和迟到重试测试。
- [ ] **5 / D2+D1 冲突及恢复闭环。** server/sync-resolution.js、js/sync-resolution*.js、js/legacy-restore.js 和真实入口：落实 C；统一首次同步、409、本机恢复后的核对。提供可导出双方备份入口。针对激活前后崩溃、恢复取消及采纳云端失败做故障测试。
- [ ] **6 / D3 队列与删除收敛。** 明确每类实体删除/重建，缺失项删除与事件删除要么实现并测试，要么在调用前显式拒绝。确认旧日志转换、回执清理和后继操作原子性。连续编辑→断网→刷新→重连后队列归零且数据一致；冲突队列允许保留但界面原因可见。
- [ ] **7 / D4 热路径验收。** 去掉每次答题完整 stats 深拷贝队列；行级提交+有界待写集合，不能覆盖未落盘操作。以首发容量和8000句模拟分别记录连续答题耗时、内存峰值/采样方法、队列最大量；模拟测试不得称真机通过。建议基准100次连续保存、最后一次提交后立即刷新，内存无随次数线性增长；固定环境记录数值再判断，不虚构毫秒承诺。
- [ ] **8 / G2—G5 准备验收包。** 复用 scripts/deploy-security-smoke.sh、server 备份工具、scripts/deploy-prod.sh 和现有测试，补齐可重复的候选版本检查命令与隔离恢复演练说明。更新 RELEASE_CHECKLIST.md 最新状态和证据，明确哪些需要用户环境/真机，不执行生产部署。

## Validation

测试使用独立临时数据库、账号和端口；不要依赖或修改用户正在使用的8787实例。新专项加入明确的 npm 脚本，不能只散落为未执行测试文件。

- [ ] npm test（上轮曾通过；本次实施完成后重新验收）
- [ ] npm run test:accounts（上轮23项隔离/恢复 + 登录流程通过；新增边界后重新验收）
- [ ] npm run test:batch-sync（上轮服务端26项 + 浏览器15项通过；新增边界后重新验收）
- [ ] node e2e/sync.test.js
- [ ] node e2e/sync-outbox.test.js
- [ ] node e2e/stats-idb.test.js
- [ ] node e2e/mobile-8000.test.js
- [ ] 新增真实页面端到端专项：答题、题库导入、课程进度、删除均经固定条件队列；两设备同基线最多一个成功；失败一方本地不丢。
- [ ] 回执丢失→服务端重启→客户端刷新→原请求重试；后继编辑保留；回执淘汰后旧请求拒绝而不重复写入。
- [ ] 拉取期间本地编辑、旧标签页快照、同token跨页ABA、不同服务同uid、过期后重新登录均不串号/覆盖。
- [ ] 恢复每个提交边界故障注入：备份失败、IDB失败、LS配额、激活前后刷新；原件可取回，当前版本完整，云暂停不会提前解除。
- [ ] 冲突比较后远端或本地再变化必须拒绝旧确认；使用本机/云端均可取回双方备份，取消不覆盖。
- [ ] 保存失败不得显示成功；最新一笔确认落盘后立即刷新仍在；未完成保存明确显示等待，不能声称关闭浏览器时一定可保存。
- [ ] 缺少baseSeq的所有旧业务写入口被拒绝；升级后的四页面正常可用；SW不继续供应遗漏的新模块。

## Acceptance criteria

### 本轮自动实施完成条件

- [ ] D1—D4所有上述合同有真实业务接入和回归证据；无永久不可解除的恢复同步暂停。
- [ ] 断网可本地保存；重连正常队列收敛；发生冲突可明确解决，不能仅显示409。
- [ ] 导入、迁移、恢复不以清空原数据解决问题；旧覆盖入口关闭或安全替换。
- [ ] 测试/部署文件清单同步更新，已有测试未通过削弱断言“修绿”。
- [ ] RELEASE_CHECKLIST.md 区分已验证、待环境验证、阻断；不再追加非阻断重构。

### 发布门槛（不属于未经授权自动执行）

| 门槛 | 必须提交的实际证据 | 参与方 |
| --- | --- | --- |
| G2 | 生产鉴权/HTTPS/独立密钥、双账号隔离、静态白名单和限流验证；不打印密钥 | 用户提供目标环境，获授权后执行 |
| G3 | 定时备份、保留/失败告警、独立实例恢复，核对课程/学习记录/版本/回执；明确恢复点与服务暂停步骤 | 在隔离演练环境执行，真实库不做破坏测试 |
| G4 | Android及iOS真实核心流程、弱网/后台恢复、首发内容抽检 | 用户或可用真机 |
| G5 | 候选提交/版本、旧端升级和数据保留、试用名单及最终发布确认 | 用户明确授权提交/部署 |

本交接 complete 仅表示自动实施条件及发布验收材料完成，绝不表示 G2—G5 已通过。缺少环境或真机时报告准确剩余门槛；不无限等待或继续造功能。

## Risks and rollback

- 账号级冲突偏保守，可能增加提示频率；这是首发可接受取舍，不以临时换最新seq减少冲突。
- 权威小字段迁移有风险：版本化元数据、幂等升级、原件保留，迁移失败关闭写入并给出恢复入口。
- 恢复副本需要额外磁盘空间，空间不足拒绝激活；不能先删除原件腾空间。
- 发布必须先有独立备份。回退代码不能回到无条件写入服务；若旧代码不兼容新协议，暂停写入并恢复兼容版本，不能关闭保护“恢复服务”。数据库回退须考虑上线后新写入，不能盲目用旧备份覆盖。
- 真实浏览器强制关闭可能发生在保存承诺前；UI要诚实区分保存中与已保存，测试证明已承诺的数据持久，不承诺无法保证的时刻。

## Execution notes

- Luna执行前通读本文，检查工作区漂移，将状态改为 in-progress。保留未提交改动，不重新全项目review。
- 每步记录修改文件、命令、实际结果和剩余阻断；完成才勾选。同一工作包持续做到验收边界，不要求用户为每个小补丁反复回复继续。
- 架构/合同出现实质矛盾时设 needs-planning，只提交证据及需要决策的一点；普通实现困难和测试修复不需要重新让Astra全量规划。
- 不自动切模型、不创建其他任务、不自动安排Astra复审；不提交、推送或部署。
- 收口后停止：只剩生产环境、真机或发布授权时明确列出，不把可选工作重新包装为上线必做。

### 2026-09-12 Luna执行记录

- 已将 `js/batch-sync.js` 接入四个 HTML 入口，并加入部署清单；`node scripts/gen-sw.js` 已重新生成缓存版本，`check-sw` 与 `check-deploy-files` 通过。
- `core.js` 普通云同步现在从已接受的 GET `seq` 建立基线，使用持久化固定请求发送 `baseSeq/requestId`，丢回执先重试原请求；旧课程独立 HTTP drain 在该模式下停用，课程日志并入统一批次。
- `main.html` 的备份导入已移除原先的逐项覆盖写入，改为 `LegacyRestore.previewImported` 的安全预览、冲突阻止、新命名空间激活和原件保留。账号专项验证通过。
- 恢复激活时会清掉恢复副本里旧的 `conditional-batch-v1` 请求并将基线置空；恢复后不能沿用恢复前账号的云端水位，仍保持 cloud-hold，必须经过后续核对才能联网。
- 已通过：`npm test`、`npm run test:accounts`、`npm run test:batch-sync`。新增真实入口断言确认 main.html 发出的 PUT 含安全条件字段且成功后队列已确认。
- 未宣称 D1—D4 完成：旧 `e2e/sync.test.js` 仍按“不同设备独立 deck 自动合并/LWW”旧语义编写，在账号级条件批次下会按设计进入冲突；批次冲突的整账号比较/双方归档/选择 UI、服务端旁路强制、保存 generation 与 D4 有界热路径仍待继续实施。

### 2026-09-12 后续执行记录（当前状态）

- `IDB v4` 已建立 `syncMeta`，旧 `conditional-batch-v1` 会先迁入持久同步元数据；批次请求保留 owner、固定 payload、capturedGeneration、acceptedSeq 和 operationReceipts。`saveAndNotify` 现在返回并等待本次统计/事件 IndexedDB 提交 Promise，主页面、题库页、统计页统一使用该入口。
- 服务端生产模式已拒绝无条件的数据、导入、课程和发布写入；发布状态纳入条件事务。删除题库会同时清除 `is_public`，并由生产专项回归验证公开接口返回 404。测试兼容开关仅由隔离测试设置 `NODE_ENV=test`，不是生产降级开关。
- 已接入整账号 `GET /api/sync/batch`、`POST /api/sync/batch/resolve` 和回执查询。比较结果带绑定账号的 token；本机/云端选择会归档双方，丢回执可复用原 requestId，过期预览会被拒绝；真实双设备同步回归通过 21 项。
- 恢复预览/激活会检查当前空间和归档中的未决批次；导出保留 legacyArchive；恢复后仍保持 cloud-hold，不能绕过核对直接上传。账号恢复专项 23 项通过。
- 本次最终验证：`npm test`、`npm run test:accounts`、`npm run test:batch-sync`、`node e2e/sync.test.js`、`node e2e/sync-outbox.test.js`、`node e2e/stats-idb.test.js`、`node e2e/mobile-8000.test.js` 均通过；缓存清单已重生成为 `chunklab-3328e71c`，Service Worker/部署清单检查通过。
- 仍保持 `in-progress`：R1 的全业务原子 generation/accepted 状态、全量 GET 同事务快照、R4 会话 epoch/旧页面升级/D4 热路径，以及 R3 的显式“暂不同步”和完整事件替换语义尚未全部完成。因此不能标记本交接完成，也不能宣称 G1 已放行。

### 剩余工作执行顺序（修订版，2026-09-12）

本节纠正上轮实现与合同的偏差，不增加发布工作包。保留已经完成的页面引用、部署引用和安全导入入口，不重复重建。继续使用同一交接文件；完成条件仍是 D1—D4 + 发布验收材料，真实环境与真机仍分别记录。

### 2026-09-12 Luna继续执行记录

- `core.js` 的统计保存排队不再先深拷贝整份 `stats`；正常路径只在 IDB 事务建立时复制将要写入的变更行，事件整体替换仍由 `_statsFullRewrite` 显式触发。这样避免 8000 句时每次答题都产生完整历史快照，但尚未等同于“业务 mem、日志、generation 已同一事务提交”。
- `main.html` 的新建/追加题库导入与 `decks.html` 的内置/公共题库导入均等待 `saveStore()` 的提交 Promise；提交未确认时不刷新列表、不关闭入口、不跳转，并显示失败提示。
- 重新验证：`node e2e/stats-idb.test.js` 21/0、`node e2e/mobile-8000.test.js` 15/0、`npm test` 通过；`node scripts/gen-sw.js` 后 `check-sw` 通过，当前缓存为 `chunklab-fed9929f`。
- 仍保持 `in-progress`。本记录只关闭“全量深拷贝队列”和“导入入口提前刷新/跳转”两个窄缺口；R1 的 IDB 权威 business-mem/generation、R2 全量 GET 一致快照、R3 冲突恢复闭环、R4 会话 epoch/100 次保存与真机验收仍需继续。

#### R1 / P0：先补本地提交，再修正运行时基线与确认

代码证据：core.js `syncFromCloud` 在 GET 后、业务落盘前调用 `BatchSync.observe`；baseline 为 null 时无条件采纳；且先 GET 才 retry pending。`putConditionalCloud` 先收旧请求回执，再将调用前生成的 payload 配上新 baseline。`BatchSync.retry` 清 pending 与 core 清业务日志分两次事务。这些不是仅靠 UI 或改测试可解决的问题。

- [ ] 先落实合同 A：IDB v4 增加 metadata（keyPath:key），统一定义版本和 stores；同步小字段权威值放 metadata 的 business-mem，提交状态放 sync-state。课程/进度/统计行保持既有 stores。恢复建库也共用定义，不能继续硬编码v3、漏拷metadata。
- [ ] sync-state 固定字段：schemaVersion、owner、localGeneration、acceptedSeq、acceptedGeneration、pending、status；pending 附 immutable payload、requestId、baseSeq、capturedGeneration、operationReceipts。不得用页面内 `_dirty` 或 `_syncGeneration` 作为持久基线的替代品。
- [ ] `saveMem`/`saveAndNotify` 及 main/decks/stats 的 saveStore 等真实调用者传递提交 Promise；主页面更新“已保存”、跳转/导入成功提示、上云调度均在提交完成后。显式暴露保存中/失败；不能仅新增一个没被使用的 async 接口。
- [ ] 每次业务更改在一个 IDB 事务中提交值、日志和 generation。small mem 不含统计大行/事件；不对8000行每次深拷贝。LS投影失败不得否定已经成功的IDB事务，启动能从权威值重建投影。IDB失败不降级为无日志的上传。
- [ ] 跨页提交读取预期 generation，旧整份快照拒绝并要求重新载入；课程/进度现有事务内按项目合并可保留，但不得把过时的整个mem提交进来。统计签名仅在事务成功后更新。
- [ ] 先将旧 conditional-batch-v1 原样迁入 sync-state，不生成新编号、不改载荷；迁移成功才移除旧位置。缺少可信 acceptedGeneration 的旧数据标记 needs-reconcile，不猜测旧基线已正确。
- [ ] 启动顺序固定：preload提交状态 → 恢复原pending → 原子确认匹配日志 → 再考虑GET。已有pending时只能retry；成功后回到调度入口从已提交数据重新生成下一批，不能复用调用前的payload。
- [ ] stage必须在同一事务检查预期generation和acceptedSeq并固定对应数据/日志；不能先读取当前最新baseline再替旧编辑作保证。ack在同一事务推进acceptedSeq、确认capturedGeneration、清理匹配operationId并清pending；失败可重试原请求。
- [ ] 有新本地操作时不接受远端新基线；用原基线发出条件写，版本不同进入冲突。没有本地操作时GET，落盘事务复核请求前generation及无pending，整体采纳后才推进acceptedSeq。禁止旧LWW路径参与该分支。
- [ ] 首次进入：仅确认本地没有用户业务数据/日志/恢复记录的全新空间可自动接受云端；其他 baseline=null 的空间统一进入R3核对。本地默认偏好和内置静态题库不算用户编辑，导入课程、统计、标熟、删除及旧日志算。

R1验收：GET期间编辑不被覆盖；GET后写盘失败基线不动；旧请求已提交但回执丢失、随后本地又编辑，刷新只能原样retry并保留后继；ack事务中断不产生半确认；同账号两标签页旧快照不能套用新seq。真实页面首次接入包含这些负向场景，不能仅断言请求含两个字段。

#### R2 / P0：统一服务器写入合同并关闭旁路

- [ ] PUT /api/data、POST /api/import强制条件和幂等编号；旧课程POST/DELETE调用已迁出时返回428，仍有必要调用者则转换为同一 saveData 条件事务。扫描 CLI、测试和非HTML调用者，特别是 server/backup-cli.js 的 restore，不能留下已失效但仍报告成功的恢复工具。
- [ ] 发布题库的 is_public 更改进入条件批次（可新增 publications数组，逐项 deckId/布尔值严格校验），使用同一事务/回执/seq；不可在普通同步旁边另建未记录的发送者。现有单实体resolve保留已发请求的查询/幂等重试，但新客户端统一走R3；它引起的seq变化必须被其他设备看到。
- [ ] 全量 GET 的 seq+数据同事务读取。删除/重建按条件版本序列验证；未知删除目标也要保存墓碑，避免已确认删除没有实际状态。
- [ ] 备份CLI的restore转为显式比较/确认协议：先preview报告影响，执行时校验固定预览与用户确认参数；原始备份只读。不自动GET最新seq后覆盖。数据库级恢复继续走独立实例演练，不替代在线冲突合同。
- [ ] 缺条件428、坏载荷400、过期版本409分别测试；原子回执跨重启、256条淘汰、部分SQL失败均保留。服务端升级不能提供恢复无条件写的生产降级开关。

R2验收：每个可更改学习数据或题库发布状态的HTTP入口有明确保护；旧端、旧CLI不能绕过。不要提前部署只改服务端导致现有客户端全断的中间版本。

#### R3 / P0：批量冲突与恢复闭环

- [ ] 新接口约定：GET /api/sync/batch 返回一致快照+seq+绑定uid的token；POST /api/sync/batch/resolve 接受 requestId、expectedToken、choice、完整本地快照；GET /api/sync/batch/resolutions/:id 返回账号隔离的回执与双方备份。复用归档表，但以协议类型参与请求hash，避免与单实体编号碰撞。
- [ ] local选择：在服务器一个事务中校验预览、保存双方备份、应用完整学习快照、推进seq及保存回执。remote选择：归档双方并返回被选择的完整快照，不重写云端；客户端用新空间激活。完整快照必须显式包含每个受支持集合，缺失不能当空；服务端逐集合验证后才允许替换。
- [ ] 完整替换排除认证、其他账号、AI缓存和发布权限字段；同ID题库保留服务端发布状态，恢复文件不能提升公开权限。删除本账号题库时停止其公开可见性，不能删除其他账号内容。
- [ ] 客户端核对UI同时支持unknown baseline、batch409和restore hold；差异预览按集合显示增加/变化/删除数量，按钮写“使用本机”“使用云端”“暂不同步”，二次确认明确作用于整份学习数据。所有文字可读，不直接暴露IP原生alert。
- [ ] 固定解决请求前校验localGeneration、owner、活动revision；发出到本地激活之间冻结全账号写入，持久日志支持刷新恢复。远端提交后本地失败时重试同一解决请求，不重新选择、不丢回执。
- [ ] api.js 对 cloud-hold 保持普通写禁用，仅允许上面核对/固定解决/回执读取接口；恢复锁禁止普通提交，但提供严格限定的恢复协调内部方法。不能简单解除 AccountStorage.assertCurrent 来让恢复操作通过。
- [ ] 修复恢复处理未确认请求：当前 apply 会在新副本滤掉conditional-batch-v1。必须在预览发现pending时阻止激活，提示先确认原请求；或用户仍可仅导出。原数据库和archive里有副本不等于可继续处理，因此不得仅靠归档视为请求已解决。确实确认完成后才在新空间置空旧基线并保持hold。
- [ ] 修复导入信息丢失：parseExport和previewImported必须保留并检查legacyArchive与原始版本信息；当前previewImported硬编码legacyArchive:{}，会绕过旧待发操作冲突检查。未知版本/畸形集合拒绝，不把错误字段静默转为空数组。预览计数从rows.sentenceStats读取，不能从已剥离的mem.stats读取成0。
- [ ] 为已完成的恢复归档提供下载双方备份入口；备份导出也从已提交的一致快照读取，不能拼接内存和不同时间的课程状态。恢复后仅在核对结果和acceptedSeq同批落盘、活动空间切换成功后解除hold。

R3验收：预览后双方任一变化拒绝旧选择；备份容量满和写失败均不覆盖；提交丢回执/刷新/本地激活失败可继续；带未决请求的备份或当前空间不能绕过检查；可从实际UI下载完整双方备份。同步正常、待同步、需核对、保存失败四种状态不能混为同一“已完成”。

#### R4 / P0—P1：会话、删除收敛和容量验收

- [ ] 完成原步骤1的持久会话epoch与guest续期；epoch使用不可复用随机值，每次会话变化换值，存储不可用则停止会话变更；凭据写入与epoch检查覆盖跨页ABA。业务owner仍为规范服务地址+uid，不随epoch变化迁库。请求与本地提交都检查epoch。
- [ ] 学习事件保留追加语义；若产品存在清空/删除事件入口，纳入显式删除协议或在修改任何关联统计前整项拒绝。不能先改汇总后悄悄保留事件。墓碑、课程旧日志、统计后继操作确认后可收敛。
- [ ] R1行级保存基础上进行100次连续保存、慢IDB、配额失败、关闭/刷新测试。限制待处理批次/队列大小并施加等待，不能丢操作以控制内存。记录627句当前内容与8000条模拟数据的保存耗时和采样内存趋势，清楚说明采样不是真实峰值。
- [ ] 重算SW缓存；真实旧页打开→新资源升级→IDB版本变更→重新登录→未确认操作继续验证，检查四个页面。浏览器缺Web Locks清晰禁用相关功能。

#### R5 / P1：回归收口及发布验收包

- [ ] `e2e/sync.test.js`分开验证：同一基线并发写允许冲突；先拉取并完成保存再编辑的串行流程必须正常；显式选择后双方数据一致；删除及重建传播继续成立。不得把所有失败归因于新语义后删掉这些用例。
- [ ] 上轮失败停在S6之前，因此后续冲突处理没有执行，不算已验证。确保所有测试finally关闭临时服务/浏览器，失败不能跳过清理或被后续命令成功退出码掩盖。
- [ ] 检查 e2e/sync-outbox、stats-idb 等是否使用手工注入旧脚本；组件用例保留，同时加入真实四页协议入口。npm test本身不包含全部浏览器用例，不能称其通过代表端到端全绿。
- [ ] 运行本文件Validation命令及新增R1—R4回归，按最后一次相关改动记录结果；后续改源码后旧测试勾选不再代表最终候选版本。
- [ ] 发布材料明确：首发内容范围、候选版本、环境安全检查、隔离实例恢复命令与核对结果、回退兼容边界、Android/iOS待验项。复用已有脚本，只有缺失的可重复步骤才加工具。

本轮执行完成时：R1—R5全部自动项有证据，发布清单按实更新。若只剩用户环境、真机或发布授权，交接可结束自动实施并清楚列出外部门槛。若仍有代码测试失败、仅组件接通或恢复永久暂停，继续实施并保持in-progress。

## 上线必要工作最终收口计划（2026-09-12，优先执行）

### 范围和实际状态

目标固定为现有内容的小范围联网试用。剩余 **4个代码交付包 + 3项外部验收**，不是4个小补丁；不以完成8000句内容、全面重构或逐字段合并为前提。保持当前 master 工作区和基准4208ebd，保留所有未提交成果及无关宣传文档。本节最初用于规划；后续执行记录以本节末尾的最新记录为准，前文通过数量仍只是对应当时候选版本的证据。

已具备：账号分区、旧数据保留和恢复副本、IDB v4、固定批次和服务端回执、生产428保护、批次比较与双方归档、题库删除撤下公开状态、分片加载和统计分页。以下缺口由当前代码复核，不能以组件通过代替解决：

| 包 | 优先级 | 当前缺口与定位 | 交付结果 |
| --- | --- | --- | --- |
| A 保存与同步一致性 | P0 | core.saveMem先写LS；persistStats仍完整克隆并失败降级；saveAndNotify提交前调度；页面保存后直接跳转。BatchSync.operationReceipts为空，retry清pending与业务日志确认分离；generation来自页面内计数。 | 已保存的数据可靠落盘；刷新不丢后继操作；旧页不能给旧编辑套新基线。 |
| B 冲突与恢复闭环 | P0 | applySyncBatchResolution逐项覆盖活动空间；SyncResolution只识别现有409；api.js的hold拦截全部sync接口；服务端完整替换复用追加事件语义。 | 首次核对、冲突、恢复后重新联网共用安全选择；中断后可继续，同步能恢复。 |
| C 会话与旧版升级 | P0 | api.sessionGeneration仅内存；AccountStorage只比较owner/revision；相同token跨页往返缺持久代次。 | 旧会话晚到操作失效，重新登录后仍保留原账号队列，四页升级保留数据。 |
| D 发布验收收口 | P1 | 连续保存和失败测试不足；部分端到端用NODE_ENV=test；发布材料存在过时状态。 | 同一候选代码有保存、同步、迁移、性能及生产协议证据，外部门槛明确。 |

### A / 保存与同步一致性：先完成一个端到端提交边界

- [ ] 文件：js/idb.js、js/batch-sync.js、core.js、main/decks/stats.html，课程调用者library.js/course-package.js。沿用现有syncMeta store，不为命名再建metadata store；在现有conditional-batch-v1记录补schemaVersion，在syncMeta增加business-mem权威小字段记录。共享DB定义供恢复建库使用。首次迁移保留LS原件，已有v4也要幂等补记录；旧基线没有可信acceptedGeneration时标记需核对，保留原pending编号与内容。
- [ ] 一个IDB事务提交业务变更、操作日志、localGeneration；小字段与统计/事件同批成功。课程/进度沿用事务内逐项合并，但同批推进generation。LS仅作可重建投影；IDB失败禁止降级上传。统计签名只在事务成功后推进。异步保存入口返回提交Promise，失败统一呈现；所有保存后跳转、导入成功、通知和显式cloudSyncNow调用先await，不能只改接口或把测试的true改为Promise检查。
- [ ] 对整份旧快照校验其读取时generation，冲突保留编辑并要求重读；不沿用三路后写者覆盖作为新协议保障。答题采用变更行命令/补丁，排队只保留有界变更集合，队列满等待，不能丢操作。停止每次完整clone stats排队；这一改动和提交底座一次完成。
- [ ] stage在同一事务绑定预期generation、acceptedSeq、已提交数据和匹配operationReceipts；ack同事务推进acceptedSeq/acceptedGeneration、清匹配operationId、清pending。后继编辑保留；不得从页面当前计数猜测已确认代次。同步调度等待业务提交，启动先恢复原请求再考虑GET；更新立即保存再同步的真实调用者和e2e辅助函数以await提交，不能靠提前schedule修复测试。
- [ ] 条件分支停用旧LWW采纳：有本地操作用原基线提交，无操作才GET，落盘事务复核generation和pending后整体接受。未知基线且有用户数据进入B；只有无用户编辑/日志/恢复记录的新空间自动接受云端。静态内置题库不算用户编辑。
- [ ] server/index.js为数据GET、比较和导出统一读事务快照（seq及所有集合）；已有解决事务复用当前事务。上轮撤销读事务后双设备仍失败、改保存调度后才通过，不能把失败归因于SQLite事务。独立验证读取与调度，保留所有串行同步断言。
- [ ] 发布入口api.publishDeck/decks.html改为持久publications意图并入同一发送者，保留现有服务端事务；不继续临时GET后独立发请求。未知删除目标保留墓碑，删除/重建及撤下公开状态继续验证。

验收：真实页面保存承诺后立即刷新数据在；慢IDB/事务失败不广播成功、不发旧载荷；GET期间编辑、旧页提交、丢回执后继续编辑再刷新、ack中断均不覆盖或丢日志；成功后队列收敛。旧pending缺operationReceipts不能臆造确认，应先原样retry，再按旧日志实际内容核对或进入B。

### B / 冲突与恢复闭环：在已有能力上补激活边界

- [ ] 文件：js/sync-resolution*.js、js/legacy-restore.js、core.js、api.js、server/sync-resolution.js、server/index.js、server/backup-cli.js、server/migrate-open-to-user.js、js/backup.mjs。复用已有batch接口、归档表和新空间激活，不另建协议。
- [ ] UI入口同时覆盖409、未知基线、restore hold；显示每集合增加/变化/删除数量，提供使用本机、使用云端、暂不同步。暂不同步持久保留暂停及重新核对入口。选择前明确整份影响；请求可能已提交时只允许继续原请求/查看归档，不生成新选择。
- [ ] owner统一用AccountStorage规范值；预览绑定owner、活动revision、generation。固定解决请求到激活期间用持久协调锁冻结全账号业务提交，所有标签页检查；普通setResolutionPaused只暂停上传不足以冻结写入。保留严格限定的内部恢复读写路径，不全局关闭assertCurrent。
- [ ] api在hold下只放行比较、固定解决和对应回执读取；普通上传继续禁止。先归档双方并收到确定回执，再写完整新空间（业务、revs、日志与已接受seq），完成后切换活动指针。使用云端不再逐项改活动库；使用本机也依据服务端返回的规范快照/版本确认，避免保留过时本地revs。hold解除与新空间激活关联，中断前后都能恢复原请求，旧空间保留。
- [ ] 完整解决采用显式快照替换，逐集合验证ID/类型/重复键，拒绝缺失或畸形集合；排除凭据、AI缓存、外账号和发布权限。保留同ID服务端公开状态，删除则撤下。**决策：普通同步事件追加；整账号显式选择以所选事件集合为准**，缺失事件在该解决事务中删除，汇总/档案与事件一起替换并归档；普通清空事件入口若无删除协议则在任何数据修改前明确拒绝。不能称完整替换却合并云端事件。
- [ ] CLI恢复改为preview FILE → 固定预览文件 → apply PREVIEW --confirm；预览绑定服务/账号、输入摘要、token、完整快照和请求ID，不保存凭据。执行复用batch resolve，过期拒绝，丢回执复用请求。旧restore FILE给出新用法且不写入；迁移工具同样明确预览确认，不临时获取最新seq覆盖。复用已有CLI不另做管理后台。
- [ ] 保留当前/备份未决批次拦截，补未知备份版本拒绝；双方备份从一致已提交快照导出。服务端备份满/失败不覆盖，备份下载真实UI可用。

验收：本机/云端选择分别跨设备一致；预览期间任一方编辑被拒绝；归档失败、服务端成功客户端断线、客户端新空间写失败/指针切换前后刷新可继续；恢复后完成核对可正常答题并同步。CLI旧命令不写、过期预览不写、原请求重复执行不重复替换。

### C / 会话与升级

- [ ] 文件：api.js、auth-ui.js、js/account-storage.js、js/idb.js及四页启动链。用一个持久会话记录保存规范服务地址、token及随机epoch；统一登录/退出/换服务入口原子替换该记录，旧凭据只读迁移。epoch变化不改变业务owner、不迁移业务库。存储失败不能显示登录成功；请求发出、响应解析、本地事务提交和恢复激活核对epoch。
- [ ] 过期后保留原owner待发数据并要求原账号登录；网络失败不清身份、不另建游客。已有游客按原凭据恢复身份，不能自动换成另一个uid。测试跨标签页同token A→B→A与响应体晚到、退出/续期/服务切换。
- [ ] IDB升级关闭旧连接、阻止旧页继续写；SW升级四入口验证，不删除旧数据解决问题。缺Web Locks显示可理解的功能限制。旧无归属数据继续确认归属再恢复。

### D / 一次收口验收与材料

- [ ] 改动期间跑对应专项；A—C完成后统一运行一次最终回归：npm test、npm run test:accounts、npm run test:batch-sync、node e2e/sync.test.js、node e2e/sync-outbox.test.js、node e2e/stats-idb.test.js、node e2e/mobile-8000.test.js。新增A—C负向用例纳入明确npm脚本；正式链路至少一套用生产模式+真实鉴权+四页入口，不能只在允许旧协议的NODE_ENV=test通过。
- [ ] 两种容量（实际首发数量与8000条模拟）连续100次保存、慢IDB/配额失败、最后确认后刷新，记录提交p50/p95、最大待写数、采样内存趋势；无增长型全量快照排队。8000是回归容量探针，不要求完整内容或额外苛刻速度指标；四倍减速沿用现有渲染门槛。模拟不等于真机。
- [ ] 测试finally释放临时服务和浏览器；以每条命令真实退出码判定，不能用分号后成功命令掩盖前一失败。最终改动后重生SW并检查部署依赖；通过后不无故重复全套。
- [ ] 更新RELEASE_CHECKLIST当前摘要，归档过时表述；记录候选文件/提交标识、首发内容范围和残余外部门槛。复用deploy-security-smoke.sh、backup-db.js、deploy-prod.sh准备隔离恢复与回退步骤，包含课程、统计、版本和回执核对。新增工具仅限缺失的重复验收步骤。

### 外部验收和停止条件

1. 目标环境：生产鉴权、HTTPS、独立密钥、双账号隔离及限流；已有脚本运行证据，不能以本地通过替代。
2. 备份恢复：自动备份实际运行、保留和失败可见；独立实例恢复并核对业务数据与回执；回退不能恢复无条件写入或盲目覆盖上线后数据。
3. 真机与发布：Android/iOS各验证答题→刷新→复习→导入→统计、弱网/后台恢复；首发内容抽检；形成固定候选并取得实际发布授权。

执行顺序：A → B → C → D；C可在文件无冲突时提前，不能把B的永久暂停留到发布后。完成A—D自动项和验收材料后结束自动实施，明确外部未验项；不再追加非阻断工作。保持现有提交/部署授权边界，实际生产操作另行明确授权。

可延期：8000句内容生产、全量文件拆分、框架迁移、智能冲突合并、增量下行全面接入、完整历史管理UI、AI功能、非阻断视觉调整。必要工作依据可复现数据丢失/串号/安全暴露/核心流程中断确定。

## 执行记录（2026-09-12，继续执行）

- [x] `js/idb.js` 的学习记录写入现在可把 `sentenceStats`、`events`、学习同步日志和 `conditional-batch-v1` 的 `localGeneration` 放在同一个 IDB readwrite 事务中；元数据写失败会回滚同批学习记录。
- [x] `core.js` 的统一 `saveAndNotify` 现在先等待本地 IDB 提交，再广播 `memUpdated` 和调度云同步；IDB 失败只保留完整 localStorage 兜底，不继续上传未确认状态。
- [x] 统计增量落盘不恢复整份 stats 克隆；新增真实 IndexedDB 回归覆盖原子提交与回滚。
- [x] 验证：`node e2e/sync-outbox.test.js` 36/0、`node e2e/batch-sync.test.js` 16/0、`node stats-idb.test.js` 28/0、`npm test` 通过；Service Worker 已重生成，当前缓存版本为 `chunklab-4dc58829`。
- [ ] A 包仍未整体完成：业务小字段权威记录、课程/进度与 generation 同批、完整 GET 的 seq+数据事务快照、旧页/GET 期间编辑和 ack 中断等负向场景仍需继续；随后进入 B/C/D。

### 2026-09-12 Luna继续执行记录（快照与代次防旧请求）

- `server/index.js` 将 `/api/data` 全量/增量读取与导出读取切换到 SQLite 单事务快照；数据行与返回的 `seq` 不再可能来自两个提交时代。冲突比较内部仍使用纯快照组装函数，避免在既有写事务中嵌套事务。
- `js/batch-sync.js` 的 `stage` 增加可选 `expectedGeneration` 校验；`core.js` 普通发送将组装请求时的代次传入。若本地在等待 IDB 写入期间发生新编辑，旧 payload 不入队、不发送，并由当前数据重新安排下一批。
- 验证：`node server/downstream-delta.test.js` 59/0；`node e2e/batch-sync.test.js` 17/0；语法检查通过；最终 `npm test` 通过，SW 已重生为 `chunklab-b80a5045`。
- D4 补充：`node e2e/mobile-8000.test.js` 17/0；连续100次保存 p50约10ms、p95约13ms、最大约16ms，8000条句档案与100条事件均落盘。该数据来自 393×852、CPU×4 的模拟浏览器，不替代真机验收。
- `server/backup-cli.js` 已关闭旧的 `restore FILE` 覆盖式旁路，改为 `preview FILE` 生成绑定账号/服务、远端 token、请求编号和原文件摘要的固定预览，再用 `apply PREVIEW --confirm` 调用账号级解决接口；备份原文件只读。CLI 回归 12/0，旧命令拒绝执行。
- `server/migrate-open-to-user.js` 同步关闭临时读取 `seq` 后调用 `/api/import` 的迁移旁路，改为必须显式 `--confirm`，并以目标账号级 batch token 执行恢复；同时修正迁移摘要读取 `stats.bySentence`。部署手册已同步用法。该脚本暂无隔离双实例自动回归，发布前需在隔离环境演练。
- A 包仍未整体完成：业务小字段权威记录、课程/进度与 generation 同批、ack 与业务日志同事务、旧页/GET 期间编辑及完整失败注入仍需继续；本记录不代表 G1 放行。

### 2026-09-12 Luna继续执行记录（迁移隔离回归与提交投影）

- `e2e/migrate-open-to-user.test.js` 新增真实双实例演练：源实例开放模式写入存量快照，目标实例多用户模式注册/登录并恢复；中间代理明确拒绝旧 `POST /api/import`，迁移全程未触发该旁路。
- 回归覆盖缺少 `--confirm` 不写入、显式确认成功、迁移前备份落入独立目录、题库/学习记录完整、同一迁移重复执行业务快照稳定；9/0 通过。`MIGRATION_BACKUP_DIR` 用于隔离演练备份，避免测试写入真实 `server/data`。
- 该测试已纳入 `npm test`；最新全套 `npm test` 0 失败，`node e2e/mobile-8000.test.js` 17/0，Service Worker 当前为 `chunklab-f6a268dc`。
- `business-mem-v1` 轻量投影已和句子档案、事件、学习意图、同步代次加入同一 IDB 写事务，并有失败回滚证据；它目前只是写入投影，尚未切换为完整业务权威读源，课程/进度/generation 同批与 ack 同事务仍不能宣称完成。
- 当前剩余上线阻断仍是 G1 的完整数据边界、C 会话/旧页升级、D4 失败注入与有界队列，以及 G2—G5 的生产配置、隔离恢复演练和 Android/iOS 真机验收；本记录不代表可发布。

### 2026-09-12 Luna继续执行记录（持久会话 epoch）

- `api.js` 新增 `chunklab.session.v1`，以持久记录保存规范化服务地址、token 和每次会话变化生成的随机 epoch；`getBase/getToken` 优先读取记录，旧键作为兼容镜像。
- `js/account-storage.js` 启动时及跨标签页 storage 事件校验同一 epoch；相同 uid 的退出→重新登录也会失效旧请求，但业务 owner 仍只由服务地址+uid决定，原账号队列不迁移。
- 会话记录与旧镜像不一致时不信任旧记录，使旧页面直接写兼容键也能触发会话失效；API 现有请求代次检查继续覆盖响应头和响应体阶段。
- 验证：`node api.test.js`、`node e2e/account-login.test.js`、`npm run test:accounts` 通过；随后 `node scripts/gen-sw.js` 生成 `chunklab-5d6f0c2b`，`check-sw` 通过。
- 当前仍未关闭：完整业务 authoritative mem/课程/进度/generation/ack 原子边界、旧页面升级本身、D4 慢存储/配额失败与有界队列，以及 G2—G5 外部验收；本记录不代表 G1 或发布放行。

### 2026-09-12 Luna继续执行记录（条件回执原子边界）

- `js/idb.js` 新增条件批次确认事务：同一 `readwrite` 事务校验 requestId，推进 `baseline/acceptedSeq/acceptedGeneration`、清除 pending，并按 `operationId` 比较删除匹配的课程/学习意图；任一失败都不提交部分状态。
- `js/batch-sync.js` 将固定请求中的 `operationReceipts` 持久化，重试成功后只能调用该原子确认；`core.js` 在 BatchSync 模式不再另起一笔日志确认事务，避免“基线已确认、日志未清理”的中间态。
- 新增真实浏览器回归：条件回执同时推进基线并清理学习日志；`node e2e/batch-sync.test.js` 18/0，既有 `node e2e/sync-outbox.test.js` 36/0 继续通过。
- 由于修改了 `core.js/js/idb.js/js/batch-sync.js`，已以最终代码重生成 Service Worker：`chunklab-58e020c0`；本记录之后的候选版本不得沿用旧缓存哈希。

### 2026-09-12 Luna最终专项复跑记录

- `npm test`：0 失败；迁移隔离 9/0、服务端下游 59/0、备份 CLI 12/0、生产条件写入 smoke 178/0 均包含在全套回归中。
- `node e2e/batch-sync.test.js`：18/0；`npm run test:accounts` 通过；`node e2e/stats-idb.test.js`：21/0。
- `node e2e/mobile-8000.test.js`：17/0。393×852、CPU×4 模拟中，8000句连续100次保存 p50 12ms、p95 19ms、最大21ms，8000条句档案与100条事件可读回；上述不替代 Android/iOS 真机。
- 当前自动实现不再追加非阻断功能。仍不能标记交接完成：完整业务 authoritative mem/课程/进度与 generation 同批、旧页面升级和慢存储/配额失败的有界队列验收尚未全部收口；G2—G5 生产鉴权/HTTPS、隔离恢复演练、真机和发布授权仍需外部证据。

### 2026-09-12 Luna最终收口补记

- `core.js` 统计写入队列已改为有界尾合并：慢 IndexedDB 时最多保留一个活动提交和一个最新尾提交；同一内存快照的后续答题并入尾提交，不同快照在队列已满时明确失败并保留 localStorage 安全副本，不静默丢弃。
- `node e2e/mobile-8000.test.js`：18/0。393×852、CPU×4 模拟下，8000句连续100次保存 p50约12ms、p95约15ms、最大约17ms；40ms 慢写入注入下最多2个提交，8000条句档案与200条事件可读回；不替代真机。
- 最终 `npm test` 退出码 0；`npm run test:accounts`、`npm run test:batch-sync`、`node e2e/stats-idb.test.js`（22/0）均通过。Service Worker 已按最终代码重生为 `chunklab-6c4b054b`。
- 自动代码工作到此停止，不再追加低优先级功能。仍未达到发布条件的代码/验收边界：完整业务 authoritative mem/课程/进度与 generation 的统一事务、旧页面升级阻断、完整事件替换删除语义；外部还需生产鉴权/HTTPS、隔离恢复演练、Android/iOS 真机和发布授权。交接继续保持 `in-progress`，不代表 G1 或发布放行。

### 2026-09-12 Luna最终代次补记

- 课程/进度保存现在把实体写入、待发意图和 `conditional-batch-v1.localGeneration` 放在同一 IndexedDB 事务内；课程同步作用域统一复用 AccountStorage 的规范 owner，旧页面直接写 token 时不会再产生地址作用域分裂。
- `node e2e/batch-sync.test.js`：19/0，新增真实课程保存与同步代次同一持久边界回归；`npm run test:accounts`：通过。最终 Service Worker 已按最终代码重生为 `chunklab-34bc9941`。
- 该项关闭后仍不扩大自动工作范围：完整业务 authoritative mem/课程/进度与 generation 的统一更大事务、旧页面升级阻断和完整事件替换删除语义仍是发布前代码边界；其余生产、恢复、真机和授权门槛仍需外部证据。

### 2026-09-12 Luna最终同步收口补记

- 事件删除协议已闭环：服务端对全量/增量响应都返回事件墓碑；整账号选择按所选事件集合产生 `evsGone`，其他设备拉取后会摘除本地旧事件。普通事件仍保持追加语义。
- 事件学习日志回执按不可变事件 ID 匹配，兼容 cid key 迁移；云同步遇到在途请求时会等待并继续发送最新本地代次，避免新操作长期留在旧 pending 中。`applySyncBatchResolution` 成功后重建本地 deck/course/stats 水位，后续删除与重建可继续传播。
- 验证：`node e2e/sync.test.js` 24/0；`node server/sync-delta.test.js` 65/0；`node e2e/batch-sync.test.js` 19/0；`node e2e/sync-outbox.test.js` 36/0；`node e2e/stats-idb.test.js` 22/0；`node e2e/mobile-8000.test.js` 18/0；`npm test` 退出码 0。Service Worker 按最终候选重生成，当前为 `chunklab-b8968286`。
- 该记录关闭本轮自动代码范围：完整业务统一权威事务、旧页面强制升级、8000 句内容生产及智能合并不再作为本轮新增改造；生产鉴权/HTTPS、独立备份恢复演练、Android/iOS 真机和发布授权仍是上线前外部门槛。当前不部署、不提交。

### 2026-09-12 Luna收口审计补记

- 修复 `core.js` 刷新后的同步代次恢复：启动时读取并校验持久化的 `conditional-batch-v1` 元数据，恢复 `_syncGeneration`，避免旧页面从 0 开始后持续提交过期 `expectedGeneration`。
- 修复连续快速保存的代次竞争：保存入口立即预留单调递增代次，但只有本地持久化成功后才广播和调度同步；连续两次保存均可完成，最新状态不会因同代次覆盖而停留在待发队列。
- 迁移专项代理端口改用系统分配的临时端口，避免宿主机偶发保留端口导致假失败；连续运行两次均为 9/0。
- 最终验证：`npm test` 退出码 0；同步 24/0、待发队列 36/0、批次同步 21/0、修订同步 53/0、统计 IDB 22/0、8000 句移动模拟 18/0、账号隔离/登录回归通过。Service Worker 已按最终运行时代码重生成，当前为 `chunklab-2bdca60f`。
- 自动代码范围继续保持收口：目前没有新的 P0/P1 本地阻断项。仍需外部完成生产安全配置、独立备份恢复演练、Android/iOS 真机、旧页面关闭旧页操作和发布授权；不提交、不部署。

### 2026-09-12 Luna恢复阻断修复补记

- `api.js` 的恢复 cloud-hold 判断改为白名单：允许 `/api/sync/batch`、固定解决、解决回执/双方备份读取及单实体冲突比较；普通 `/api/data`、导入、课程、发布和未知同步写入口仍被阻断。
- `api.test.js` 新增“恢复中允许比较/固定解决、阻止普通写入”回归；恢复专项新增真实“核对云端→使用本机→解除暂停”流程，账号隔离回归 24/0；`npm run test:accounts`、`npm run test:batch-sync`、`npm test` 均通过。
- 账号隔离回归进一步覆盖同一账号第二次恢复核对，25/0，通过新的请求编号避免服务端幂等记录误判。
- 因恢复运行时代码变更，Service Worker 已重生成，当前为 `chunklab-2bdca60f`。本地自动实施仍不提交、不部署；外部生产、恢复演练、真机和发布授权门槛保持不变。

### 2026-09-12 Luna旧页面升级提示补记

- `api.js` 收到 `428 CLIENT_UPGRADE_REQUIRED` 时保留启动期信号，并向运行中的页面派发升级事件；`main.html` 显示“页面版本已过期，请刷新后继续”。
- `api.test.js` 覆盖 428 状态、错误码、启动期信号和运行中事件；`npm test` 退出码 0。
- 因主页面运行时代码变更，Service Worker 已重生成，当前为 `chunklab-2bdca60f`。旧标签页仍需用户按提示刷新，不能在后台强制中断正在进行的答题。
### 2026-09-12 Luna题库发布持久队列补记

- 题库发布/下架改为复用 `BatchSync` 条件队列，以已确认的云端基线和本地代次固定请求；服务端成功但浏览器丢失回执时，原请求仍保留并可安全重试，避免发布状态与本地页面显示分叉。
- 新增 `api.test.js` 的固定载荷/基线断言，并在真实 `main.html` 页面回归中注入丢回执场景：发布请求进入待发队列，重试后题库保持目标状态且队列清空。批次同步专项现为 22/0。
- `npm test`、`npm run test:accounts`、`node e2e/mobile-8000.test.js` 和部署清单检查均通过；Service Worker 已按最终运行时代码重生为 `chunklab-55565a14`。本地不提交、不部署；生产配置、隔离恢复演练、Android/iOS 真机和发布授权仍需外部完成。

### 2026-09-12 Luna部署前置护栏补记

- `scripts/deploy-prod.sh` 在远端快照前先运行本地 `npm test`，并 fail-closed 检查远端 `/etc/chunklab/env` 已启用生产模式、鉴权且配置了不少于 32 字符的 JWT 密钥；不满足时不会快照、上传或重启服务。
- 部署前置回归进一步包含 `npm run test:accounts`、`npm run test:batch-sync` 和 `node e2e/mobile-8000.test.js`，确保账号隔离、条件同步及 8000 句移动专项未被遗漏。
- `scripts/deploy-safety.test.js` 已同步步骤标题并通过 11/11，覆盖删除本地回归、远端生产预检和危险默认部署目标；`scripts/check-deploy-files.js` 仍确认运行时清单完整、快照先于重启。

### 2026-09-12 Luna公网安全冒烟补记

- `scripts/deploy-security-smoke.sh` 新增未登录访问 `/api/data` 必须返回 401/403 的检查，并读取 `/api/config` 确认 `requireAuth=true`；网络不可达仍记为 WARN，不能被误判为通过。
