# 词书预学习：本机冲突归档历史

日期：2026-10-19。范围：`wordbook-intro.html` 的既有 Operate 表面局部扩展，按现有代码记录交付，不另建一套设计系统。

## 继承与范围

继承 `PRODUCT.md`、`DESIGN.md` 与 `.impeccable/surfaces/wordbook-intro.md` 最新“历史归档局部扩展”契约：学习花园背景、暖纸、棕色文字、既有字体层级与蜂蜜色主操作继续使用。浏览位置不等于答题成绩或掌握；历史入口位于保存状态与本次归档提示之后。

本次仅补充历史摘要与下载入口。全局 `DESIGN.md`、`.impeccable/design.json`、`PRODUCT.md` 不更新；既有课程、记录和素材不迁移、不清理。本文依据 shipped impeccable-documenter 角色及其 `reference/document.md` 的代码取证原则编写，普通扩展保留原系统。

## 列表与交互

“本机冲突归档”使用原生 `details/summary`，默认折叠；展开才读取当前账号、服务、课程及单元范围的浏览器本地摘要，包含不同编排版本。页面明确说明“仅保存在此浏览器，不会同步到其他设备”，其他编排版本另作文字标记。

每页至多 10 条，按稳定键游标翻页，日期仅供核对，不承诺时间排序。每行显示日期、所选位置、原记录数量及下载按钮；翻页替换当前页，可回上一页或刷新。过滤后为空但仍有续页时，保留继续查询入口。列表不读取完整归档；只有点击某条“下载归档”才按精确键读取该条 JSON。无删除、导入或自动恢复操作。

原生摘要支持键盘展开，焦点样式沿用页面规则；下载按钮通过 `aria-describedby` 关联对应摘要，按钮最小高度为 44px。加载使用状态提示，列表与下载失败显示内联错误并允许重试，原归档保留。页面身份代次与历史请求票据共同约束异步回写，关闭后忽略迟到列表响应；账号或服务切换立即折叠、隐藏并清空历史显示，不清除存储记录。展开、翻页和重试只更新历史区域，不重挂载教学或未提交练习。

## 局部视觉与图片约束

展开区补上既有暖纸底色与 12px 内边距，使花园花卉退到文字背景之外。列表用轻分隔线与自动换行组织，说明文字 14px、行高 1.6；窄屏允许摘要与按钮换行。此处没有新增卡片体系、全局样式或栅格图片。

教学继续按当前内容加载图片，不预取整库；图片失败提供文字提示，不回退到大原图。原画另存、每词共享一张完整 16:9 WebP、每个浏览器交付文件严格小于 20,000 字节的既有约束继续有效，不新增 AVIF 或专用手机裁剪。本次未编辑任何素材，也未重新核验整库编码。

## 验证与独立审查

直接核对的实现为 `landing/wordbook-intro.js`、`assets/wordbook-intro.css`、`wordbook-intro.html`，历史专项辅助脚本为 `e2e/lib/vocabulary-browse-history.cjs`。最终报告 `output/test-results/vocabulary-browse-ui-1792414347359/summary.json` 已实际读取：`history.afterReload`、`collapsedLazyRead`、`keyboardExpand`、`pagination`、`errorRetry`、`exactDownload`、`noLearningWrites`、`teachingDomPreserved`、`lateReadIgnored` 均为 `true`。脚本覆盖重载后折叠零读取、键盘展开、10/3 条往返分页、列表与下载失败重试、下载 JSON 精确一致、教学节点保留、无浏览写入与关闭后迟到响应忽略。

同一最终报告保留原有冲突归档、失败回滚、不覆盖云端、离线待保存链、联网及暂停保留表单、当前图片按需加载、无测评写入等通过项；`syntheticReviewOnly` 为 `true`，`productionPublished` 为 `false`。较早报告 `output/test-results/vocabulary-browse-ui-1792414288592/summary.json` 未单列历史标记；最终报告补齐证据字段，未改变 UI。

父任务已在两轮批量检查中打开 `.impeccable/review/wordbook-intro-history/history-{1440,925,390,320}.png`，本次文档核对了四份文件存在；四宽无横向溢出亦有辅助脚本断言。独立新审查者 Boole（`01a15436-ea1a-7cf1-9cdf-b8eee18ed5c8`）完成五节终审，结论为 `ship`，无实质修复项，建议显式记录历史专项标记，已由最终报告落实。父任务报告严格 Service Worker 生成与部署检查通过，版本仍为 `chunklab-2c7a603b`；此结论不代表生产已部署。

## 限制与未纳入规范项

检测器曾报告继承的奶油色导航横带及旧 token 漂移；本次不把这些现状提升为新设计规则，也不越界修复全局系统。键盘与浏览器自动化证据不等于辅助技术、Safari、真实设备或完整离线重新打开验收。所有测试使用可丢弃的隔离数据；真实课程与在线服务未改动。本次文档工作未运行测试、启动或切换服务。
