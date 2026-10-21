# 全量回归复验（2026-10-17）

## 结果

本轮直接运行测试调度器的四个分组，没有运行 npm pretest/build，没有在回归期间修改业务代码或测试断言。浏览器组于北京时间 18:19—18:44 运行。367 个测试入口：316 通过、51 失败、0 跳过；自动重试关闭，保留首轮失败。测试入口数不等于独立业务问题数，组合测试会重复执行部分场景。

| 分组 | 总数 | 通过 | 失败 |
| --- | ---: | ---: | ---: |
| 基础 | 173 | 163 | 10 |
| 后端 | 78 | 78 | 0 |
| 静态检查 | 17 | 12 | 5 |
| 浏览器 | 99 | 63 | 36 |
| 合计 | 367 | 316 | 51 |

默认单项超时 180 秒，transparent-save 组合测试沿用调度器已有独立预算，未临时扩大超时。membership-content-performance 本次约 174 秒通过，接近默认预算，不应称为稳定容量验收。

## 与上一轮相比

上一轮 363 项，302 通过、61 失败。本轮新增 4 个浏览器入口，全部通过：content-card-rerender、lib/prepare-ui-root、stats-initialization、stats-two-columns。

原清单中 15 项由失败转通过：

- 基础 7 项：content-studio、build-vocabulary-content、content-card-consistency、learning-workspace-home-ui、stats-auto-confirmation、stats-confirmed-cross-tab、wordbook-create-ui。
- 浏览器 8 项：explicit-recovery、learning-workspace、main-persistence、membership-content-performance、personal-wordbooks、sync-recovery、wordbook-study、wordbook-ai-authoring-ui。

原来通过、本次失败的 5 个入口：deploy-safety、check-deploy-files、sw-policy、content-studio-ui、illustration-review。前两个共用同一个部署漏文件问题，不是两个根因。

## 优先处理的问题

1. **部署完整性（构建/部署侧）**：运行时依赖 `js/textbook-drafts.js` 没有出现在部署 FILES 清单中，check-deploy-files 和 deploy-safety 同时失败。应修正部署清单，不应给前端加缺文件兜底。
2. **首次离线安装体积（资源策略侧）**：sw-policy 的硬清单 <1.5MB 断言失败，日志为 1541KB。应先核对首屏必需依赖，不能直接放宽预算或盲目移除离线依赖。独立 sw-install-budget 通过并不抵消这条失败，不同门槛需要统一理解。
3. **内容工作台布局（界面侧）**：content-studio-ui 在多宽度循环的 document.scrollWidth <= innerWidth 断言失败（第126行）。现有日志未标出具体宽度，需隔离复现，不能声称已确认是哪种屏幕。
4. **插图审核保存状态（测试等待/业务状态侧待判定）**：预期“暂不能通过”，立即读到“保存中…”。日志有隔离审核接口 PUT 成功记录；需要先确认保存完成后的状态再判断根因，不直接改前端规则或放宽断言。
5. **学习关键路径**：空账号首次出题、升级后 items=0、部分登录/会员展示/统计测试仍失败。既有旧控件等待，也有题目与进度断言；不能整体归为过期测试。优先逐项复现首次出题、登录恢复与统计，再处理纯布局/文案夹具。
6. **教学内容规则**：chunk-hint-alignment 仍期望 What's your major? 单意群，运行内容为两个意群；book-content-check 又将源文件该句、How old are you?、How tall are you? 单意群判为3处错误。先确定权威教学规则；不自动修改真实课程、重新发布或迁移学习版本。

## 已通过的关键流程

后端 78 项全过，包含持久化、增量同步、账号隔离、回执和备份恢复。浏览器主页面持久化完整通过：20 次离线答题重连后确认，总数从3到23，待同步答题归零；阻塞HTTP 5秒时退出返回约36毫秒（组合复跑约34毫秒）。这只是隔离本机结果，不是万人日活或2核2G/3M容量结论。

学习工作台、个人词书创建/保存/不可变版本/备份保护、词书离线与跨设备恢复、显式恢复和同步恢复通过。图片持久缓存、统计请求预算、新增统计初始化和卡片菜单重绘测试通过。

transparent-save 组合测试仍失败：前两段主页面保存和测评确认通过，第三段 course-package-v2-import 报“课程页面脚本缓存版本未随 course-package.js 内容更新”。不能因前段通过而把组合入口标绿。

SW升级测试35个断言通过、1个失败（升级后出题 items=0）；旧来源gzip保全、拒绝旧整包写入、新答题恰好一次落库与刷新不重复均通过，但整项仍失败。

## 原始记录与边界

- 基础：`output/test-results/followup-20261017-unit-101901/summary.json`
- 后端：`output/test-results/followup-20261017-server-101912/summary.json`
- 静态：`output/test-results/followup-20261017-checks-101922/summary.json`
- 浏览器：`output/test-results/followup-20261017-browser-101932/summary.json`

各目录保留 attempt-1.json，包含具体失败输出。不要用会被后续运行覆盖的 unit.json/browser.json 代替上述唯一运行目录。

基础和浏览器分组指纹显示工作区变化，后端和静态组未变化。基础组状态差异含并行新增的词汇插图；因此本次不是冻结发布包验收，也不能把与历史结果的差异直接归因于单个补丁。既有 sw-policy 测试会调用 gen-sw.js；本轮没有额外手动生成缓存清单，不能将整个测试套件描述为完全只读。

本轮未重启8787在线服务，未清理真实浏览器数据，未迁移或修改真实课程/学习记录。持久性与审核写入由独立测试服务使用临时数据目录；使用新浏览器上下文。外部真实课程导出测试仍由原清单显式排除，不在367项自包含回归内。本报告不宣称全部优化完成或生产可发布。

下一步先解决部署漏文件，再分别复现缓存体积与学习关键路径。修复后用固定版本重新回归，最后才进入匹配目标服务器的容量测试。
