# 首页返回卡顿：每轮共享课程快照

- Status: complete
- Updated: 2026-09-26
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22
- Relevant uncommitted changes: main.html、core.js、sw.js、多个首页/进度测试已有修改；还有未跟踪 e2e/exit-performance.test.js。全部保留，执行前查看当前差异，不能回退到 HEAD 覆盖现有工作。
- Planner: Astra planning phase（当前主任务型号未由工具确认）
- Executor: GPT-5.6 Luna

## Objective

修复返回首页时因重复复制完整课程包造成的多秒主线程冻结。一次首页渲染共享一份课程快照与目录，保持课程归属、继续学习、进度与更新可见性。

## Current state and evidence

真实本地页面 main.html 的 showHomePage → renderHome → 对 66 个 deck 调用 courseContextForDeck；继续学习路径再次调用，共 67 次 CL.readCourses。
core.js 的 readCourses 为 cloneJSON(readCoursesRaw())，防御性复制完整课程内容。计时发现 134 次读取合计约 6179ms，134 次 buildCatalog 合计约 109ms。目录构建自身不是主要瓶颈；只缓存 buildCatalog 无效。
临时浏览器内 A/B（未修改产品代码）：原始返回首页 3542/3376/3101ms、读取各 67 次；仅在该轮共享课程快照后 87/91/83ms、读取各 1 次。用 performance.now 包围真实 showHomePage 测量，200ms 预算原始三轮均失败、实验三轮均通过。初始加载曾出现连续两段约 3 秒停顿。
现有 e2e/main-startup.test.js 通过，但没有覆盖大课程快照复制与返回首页性能。实验是独立浏览器上下文，不代表用户账号的全部线上耗时。

## Assumptions and decisions

- 选择显式传递本轮上下文；不引入全局长期缓存及复杂失效协议。
- CL.readCourses 对外仍返回深拷贝，保留现有数据隔离契约。
- 每轮 renderHome 创建上下文，懒加载课程快照和目录并复用；即使构建失败，也记录本轮失败状态，避免逐个课节重试读取。
- courseContextForDeck、courseNavigationForDeck、preferredCourseResume 接收可选上下文；旧调用者不传时创建独立上下文，保持兼容。
- 上下文只覆盖同步计算，不能被点击回调长期持有。新一轮渲染重新取数据。

## Scope

main.html 中本轮数据上下文及上述函数调用链；新增 e2e/home-render-performance.test.js；按项目方式更新 sw.js。

## Out of scope

退出等待云同步、全局刷新调度、跨轮缓存、课程摘要存储协议、首页外观重做、登录与同步冲突处理、线上部署。退出等待是另一独立问题，不与本次混改。

## Contracts and data changes

无数据库、存储格式、网络接口修改。目录输入仍为 getManifest、mem.decks、readCourses 的当前快照。保持既有 courseContext 返回字段以及找不到课程时的 fallback。目录失败应走现有降级，不使首页空白；修正涉及的空 deck 分支不得访问空对象属性。

## Implementation steps

- [x] 查看当前 git diff 与本目录其他首页方案，保留已有 UI 和数据行为。核对所有 courseContextForDeck/courseNavigationForDeck/preferredCourseResume 调用点。
- [x] 先建立真实浏览器回归测试：独立临时服务、临时数据库和浏览器上下文，使用现有 free-port，绝不修改本地正式账号课程。
- [x] 构造具有较大正文/资源字符串的课程快照，保留真实 CL.readCourses 深拷贝实现。通过测试夹具的正常存储入口装载数据；不要用桩直接返回共享数组来伪造优化效果。
- [x] 在真实 showHomePage/renderHome 边界包裹计数，记录 CL.readCourses 和 CourseCatalog.buildCatalog 次数及耗时；原代码应因重复读取断言失败。
- [x] 在 main.html 实现每轮懒加载上下文；renderHome 的课节归属循环、继续学习计算及同轮其他目录查询全部传入同一上下文。独立课程导航保持现有接口可用。
- [x] 加入新轮更新可见性检查与失败降级检查，验证一次失败不会在一轮内重复尝试几十次。
- [x] 运行下列限定测试与真实页面返回测量，更新 Service Worker，记录验收结果。

## Validation

PowerShell 浏览器路径：$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'。默认 Playwright Chromium 缺失；已安装 Chrome 可用，不必重新下载浏览器。

- [x] node e2e/home-render-performance.test.js：通过；连续返回、跨轮刷新、目录失败降级和恢复均覆盖。
- [x] node e2e/main-startup.test.js：通过。
- [x] node e2e/home-today-entries.test.js：通过。
- [x] node e2e/learning-journey.test.js：通过。
- [x] node course-catalog.test.js：28 passed / 0 failed。
- [x] node scripts/gen-sw.js 然后 node scripts/check-sw.js：通过，74 个原子预缓存和 67 个软预缓存一致。
- [x] 真实 8787 页面三轮测量：66 个 deck，每轮读取 1 次，首页同步渲染 2ms，首页内容可见。

## Acceptance criteria

- [x] 每轮首页读取课程快照和构建目录均最多一次，包括继续学习分支。
- [x] 原有复现条件下三轮本地同步渲染目标均 <200ms；同时报告实际结果，不把这个本机值承诺为所有设备/线上端到端时延。
- [x] 首页可见且可操作，课程归属、继续学习课节及进度正确。
- [x] 下一轮渲染能看到已更新的课程数据；不因缓存跨账号/跨轮残留。
- [x] 目录失败仍可显示首页降级内容，且下一轮允许重新读取恢复。
- [x] 实际运行入口已接入；不是只添加未使用的独立 helper。
- [x] 未修改正式课程、同步/存储契约与现有 UI；规定测试通过，sw 检查通过。

## Risks and rollback

重点防止漏传上下文导致继续学习分支再次复制；防止将上下文保存在全局或事件闭包导致数据过期。测试计时易受机器负载影响，所以读取次数作为稳定硬门槛，实测耗时作为性能证据。其他未提交工作持续变化，行号不稳定，按函数定位。
回退仅撤销本次新增上下文及传参修改，再重新生成 sw.js；不得覆盖用户已有 main.html/core.js 改动。不能以去掉 readCourses 的深拷贝代替修复。

## Execution notes

2026-09-26：实现完成。main.html 新增本轮 createHomeCourseLookup，上下文在 renderHome 内创建并传入课程归属与继续学习路径；CL.readCourses 的公共深拷贝契约未改变。新增 e2e/home-render-performance.test.js，使用临时服务和大课程夹具验证读取/构建次数、跨轮课程更新、目录失败降级与恢复。验证结果：新测试复跑通过（首次 3ms、第二轮 2ms）；main-startup、home-today-entries、learning-journey、course-catalog（28/28）通过；gen-sw/check-sw 通过。真实 8787 页面 66 deck 连测三轮均为 2ms、每轮读取 1 次。未修改数据库、同步协议、正式课程或退出等待云同步路径。
