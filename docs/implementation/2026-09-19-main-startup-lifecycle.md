# 首页启动与页面生命周期简化

- Status: complete
- Updated: 2026-09-19
- Branch/worktree: master，D:/06-project/chunk-practice，使用当前工作区
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca；以当前未提交工作区为实际基线。main.html 已有入口防误跳、讲解、进度同行等改动；core.js、js/bridge.mjs、构建/检查脚本、package.json、测试清单、课程包及服务器均有用户改动，禁止覆盖。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

完成一次可独立交付的启动生命周期改造：刷新普通 main.html 从未显示练习外壳；首页本地就绪不等待云端或练习引擎；明确课程入口仍能启动；异步旧结果不能覆盖用户的新页面。保留多页面、原生 JS 和现有存储/同步协议，使用小模块而非新增框架或通用路由平台。

## Current state and evidence

- main.html:1183 首页初始 hidden，1190 练习页默认可见，1223 用题卡显示启动加载中。脚本下载期间已经能画出错误页面。
- 5711 起 _mainBooted/_mainEntryClaimed/_mainLocalPainted 与 180ms paintLocalHome、Promise.all(ensureCloud, ContentRepo.ready)、bootApp、bootMain、decideEntry 共同控制启动。消除误跳的补丁没有消除初始练习外壳。
- bootApp 以 bridge-ready 事件和 3s 超时等待整套桥接；首页 esc/norm/wordCount/normSent 也依赖 FormatTools，不能直接延迟整个 bridge 而不拆出格式工具。
- js/bridge.mjs 静态导入 format、chunk-engine、ai-prompts、backup、distractor-cause。首页不应因练习引擎下载失败而失败。
- core.js ensureCloud 包括 preload、配置、游客/账号引导和同步，不能把它误当纯数据请求；保留其鉴权逻辑。CL.preload 仅合并进行中的调用，完成后会清空任务，应用层应缓存本次初始化 Promise。
- ContentRepo.ready 自动加载 manifest；首页可在 manifest 未就绪时使用本地信息，完成后补刷新。已有分片按需加载，不重写。
- startDeck 的临时复习 hydrate 分支已有 _deckLoadGeneration，但普通 ensureDeck 和 beginContentBatch 缺少同等旧请求防护；退出/切页也必须使这些请求失效。
- stats.html launchReviewDeck 写 chunklab_pending_review_deck 后跳 autostart=1；decks.html 仍写 _startIntent 或 _startDeck。目录 URL 成功消费后当前会 replaceState 为 main.html。
- 已有 e2e/main-startup.test.js 验证云配置延迟时首页能启动练习且不被后台覆盖，但未检查脚本执行前首帧、引擎阻塞、旧内容请求覆盖。
- docs/implementation/2026-09-19-engineering-maintainability.md 为 in-progress，覆盖首页抽取；当前 src/main 尚不存在，build-app 仅生成校验器及 core 子模块。本方案负责启动边界，避免同时抽整个 main 内联脚本。执行前若上述文件已被另一任务抽取，沿其真实源码接入相同契约，不修改生成物充当源码；若两任务正在同时修改相同区域，记录冲突再协调。
- 未发现根目录、父目录及项目内 AGENTS.md；执行前复查。规划未跑测试，不宣称当前基线全部通过。

## Assumptions and decisions

1. 保持已明确的刷新语义：普通 main.html 刷新落首页。目录/临时入口是一次性指令，成功进入后清理其 URL 参数；不在本轮改成刷新恢复练习的持久路由。direct=1 保留显式恢复语义。
2. 一次解析入口，一次本地初始化，一个页面控制器；云端完成只通知数据刷新，不调用入口解析或 startDeck。
3. 页面状态仅 loading/home/practice/error，loading 带目标和可取消动作，practice 仅在首题及引擎就绪后发布。失败提供重试、返回首页，错误通过 textContent 显示。
4. 本轮包含引擎按需加载，但不拆全部练习逻辑、不重写主页渲染。首页必要 FormatTools 提前独立就绪；模块加载使用 Promise，不用定时器猜就绪。超时仅是明确失败出口。
5. 保留现有全局函数及 window.S 的兼容入口，避免 inline handler 和 E2E 失效。模块显式接受少量函数适配器，不传巨型可变 mem/S 上下文。

## Scope

- main.html 初始可见性、中性加载/错误区域、统一页面切换与启动接入。
- src/main/entry.mjs：纯入口解析；src/main/lifecycle.mjs：本次启动/导航序号和异步提交控制；src/main/index.mjs：导出浏览器适配门面；esbuild 生成 js/main-lifecycle.js，通过既有 build/check 注册。
- js/bridge.mjs 分离 FormatTools 的基础就绪和 ensurePracticeReady()；引擎及其练习依赖在首次练习时 import，Promise 复用、失败可重试。保留原 bridge-ready 的练习全量就绪含义。AI/备份调用依赖若仍全局同步访问，保留原有可用时序，不顺带改其产品行为。
- 现有 startDeck、beginContentBatch、临时题目加载、首页开始/继续/复习、退出、结算再练等入口接入同一生命周期。
- 相关测试、生成物检查、SW 依赖发现及缓存版本更新。

## Out of scope

- 不更换框架、Vite、数据库、课程包协议；不把所有页面合成 SPA，不提取所有 CSS/内联代码。
- 不修改题目、进度语义、账号隔离、同步合并算法，不删除用户存储，不部署/提交/推送。
- 不承诺固定毫秒加速；用受控依赖阻塞、请求记录和首帧可见性证明改进。

## Contracts and data changes

- resolveEntry({search,navigationType,intent,deck,review,now}) 返回 home/unit/catalog/review/resume 或入口错误；不在纯函数中访问存储或改变页面。
- 优先级：有效 course+lesson URL > 本次普通导航的有效 _startIntent > _startDeck > autostart=1 的有效复习队列 > direct=1 > home。普通 reload/back_forward 不消费遗留存储；显式入口仍按其协议运行。review 保留 30 秒有效期，畸形 JSON/过期入口不能启动随机课程；显式无效入口显示可返回的错误。
- 适配层在启动捕获一次临时载荷，并移除已捕获的一次性键；重试使用捕获值，不重新消费。清理仅限入口键，不清理学习状态。课程 URL 优先时也清除遗留 handoff，避免以后误消费。
- lifecycle.start() 幂等；navigate/enterPractice 返回本次任务；每次导航、退出、账号切换增加 generation。异步成功/失败/进度更新必须验证 generation，失效结果不能写 S、mem、DOM 或提交学习记录。
- 同一次导航的 ensureDeck、分片扫描、hydrate 递归共用 token，不能每次递归都误建新导航。移除或收敛 _deckLoadGeneration 到唯一 token，避免两套判定。
- 数据存储 schema 不变。本地 preload 与 FormatTools ready 完成后 loadStore/renderHome；manifest 和 ensureCloud 并行后台启动，各自捕获失败。依赖本地迁移的写入仍等待 preload，不读取未完成迁移的半份快照。
- 后台刷新首页前重新确认页面和账号代次；练习中沿用现有安全刷新/待采纳策略，不重载正在作答的 S。保留 syncStatus/conflict/登录 UI 及云配置更新职责。
- 错误区独立于 #zh；window.onerror、boot catch、依赖失败须在启动尚未就绪时显示独立错误，运行中的普通错误不强制导航。必要的早期 script error 捕获在外部依赖前安装。

## Implementation steps

- [x] 记录相关基线测试、当前 diff；读取现有工程维护计划相关部分与实际构建源码，确认无并行覆盖。只对本方案范围做增量修改。
- [x] 实现 entry 和 lifecycle 小模块与单元测试；注册 esbuild 产物到 build-app/check-generated、测试清单和增量 lint/typecheck（沿现有机制，不另建工具链）。
- [x] HTML 默认隐藏 home/practice，显示公共顶栏和中性状态区，加载阶段不显示退出/空进度/快捷键/熟按钮。统一 showHomePage/showPracticePage/showPage 的可见性职责与 _curPage；保留渲染业务适配器。
- [x] bridge 拆开基础工具与练习就绪；删除首页对 ChunkEngine 的硬依赖。所有进入练习路径经 ensurePracticeReady，模块失败时显示重试/回首页。
- [x] 启动链改为本地首屏优先，manifest/cloud 后台处理；普通刷新不会显示练习外壳或再次消费旧课程入口。
- [x] 将题目异步加载接入 generation；加载中返回首页、快速换课程和重试不会被旧响应覆盖。处理空批次、空课程和明确无效入口的可操作状态。
- [x] 接入目录、临时复习、direct 兼容入口；同步结束不再次决定页面。检查所有 showPracticePage/startDeck 调用点和全局快捷键，加载/首页时不误触练习。
- [x] 更新依赖发现与 SW 资源表，动态练习模块可被缓存和按需加载。

## Validation

- [x] 新增 scripts/main-lifecycle.test.mjs：入口优先级、一次性消费适配、过期/畸形数据、旧成功失效。
- [x] 扩展 e2e/main-startup.test.js，阻塞 bridge 与云配置时确认首屏不显示练习外壳。
- [x] 普通首页阻塞 api/config 与 bridge：本地首页仍能显示；点击课程前未请求 chunk-engine。
- [x] 点击课程后按需加载引擎并进入课程；课程目录、批次内容和账号隔离回归通过。
- [x] 目录 URL、direct/复习入口及普通首页刷新相关回归通过；SW 资源一致性通过。
- [x] 运行生命周期、启动、首页、课程目录、内容批次和账号隔离测试。
- [x] npm run build；npm run build:check；npm run lint；npm run typecheck；内容运行时契约；SW 生成与检查均通过。
- [x] 首页桌面与窄屏入口回归通过；移动端首页无横向溢出。

## Acceptance criteria

- [x] 刷新普通首页从初始 HTML 起没有练习外壳闪现，也没有延迟自动跳课程。
- [x] 首页本地首屏不等待云端或练习引擎；练习引擎首次进入课程时按需加载。
- [x] Runtime entry point connected, not only a standalone component test：main.html 实际使用入口解析和生命周期模块。
- [x] 练习引擎仅在需要时加载；加载失败提供重试和回首页。
- [x] 明确课程入口、课程目录、内容批次和账号隔离回归通过；旧异步题目请求有 generation 保护。
- [x] 独立加载/错误/重试/返回已接入；动态模块已加入 SW 资源清单。
- [x] 未改变学习数据 schema、已有学习进度、云同步协议及用户修改；相关定向测试通过。

## Risks and rollback

- 高风险是 FormatTools 与引擎桥接拆分、startDeck 递归异步以及账号切换，必须以浏览器真实入口验证，不能只隐藏 HTML 当完成。
- 与工程维护计划共享 src/main/build 边界；本文件是本轮启动行为实施依据，整体 main 抽取留给原计划，不同时执行两套 boot。
- 以执行开始时的工作区 diff 为回滚边界，保留原有用户修改；只撤回本轮增量并重新生成对应产物/SW。禁止 git reset --hard 或回退整个 main.html。

## Execution notes

执行结果：完成启动状态隔离、生命周期模块、练习模块按需加载、失败恢复入口及 SW/生成物接入。通过 `npm run build`、`npm run build:check`、`npm run lint`、`npm run typecheck`、`node scripts/check-sw.js`、`node scripts/main-lifecycle.test.mjs`、`node e2e/main-startup.test.js`、`node e2e/home-today-entries.test.js`、`node e2e/course-catalog.test.js`、`node e2e/content-batch.test.js` 和 `node e2e/account-isolation.test.js`。未执行全量 `node e2e/e2e.js`，因此不对其余历史页面断言作额外结论。
