# 浏览器发布验收（2026-10-07）

## 首轮完整结果

隔离暂存副本测试运行 `20261006124258088-17016`：48 组，33 通过、15 失败，关闭自动重试。运行完成于 2026-10-06；本记录于次日读取完整结果。副本不含 Git 元数据，报告中的空文件指纹不能作为源码身份验证证据。

失败项：content-explanation-refresh、course-package-import、course-package-v2-import、deck-progress-diagnostic、explicit-recovery、home-today-entries、main-persistence、main-startup、mobile-8000、progress-coverage、stats-index、stats-mastered、sync-recovery、tab-content-consistency、transparent-save。

## 已定位

- explicit-recovery/main-persistence 引用的两个恢复测试辅助文件未提交；补齐后独立恢复验收通过，覆盖原归档完整性、拒绝覆盖非空账号、选择恢复、分页和未知操作保留。
- 主学习验收把随机排列的第一个选项当作当前句子，还用它完成预期正确的答题。新增其他题库后该选项可能是干扰项，导致续学比较错误及等待答题提交超时。改为比较 `cur().sentence`，按当前正确意群定位按钮；保留刷新、服务器索引、会话及计数断言。
- 两个课程包导入测试依赖仓库外/未提交的 ZIP；开发机存在样本，但干净导出无法自行运行。需提供可重复生成的测试样本或明确的集成样本准备过程。
- 讲解测试期待已经取消的占位内容；mobile-8000 期待不带 reviewHandoff 的旧跳转地址。相关测试待独立调整及复验。
- 其他页面/统计/旧恢复超时仍待定位，不能一概认定为测试过时。

## 课程分类保存缺口

主学习验收修正随机选项断言后，通过刷新续学及 20 条离线答题补交，随后在课程分类保存处失败：已提交的 library.js 仍使用旧本地课程写入，而工作区已有协议 3 实现。将该实现及 library.test.js 纳入本次候选，按服务器确认版本提交 course.put，确认后更新本地课程读取视图。服务不可用时不得降级为本地整份课程写入。

分类保存单元检查通过；隔离副本生成缓存版本 `chunklab-f7f73a55` 并通过严格缓存校验。主学习流程完整复验通过：在线答题、刷新续学、轮次提交、20 条离线答题补交、课程分类服务器确认、第二设备读取与答题、服务器确认导出。网络响应被阻塞 5 秒时，已耐久保存的 20 条操作不阻碍退出回主页（该次测量 43ms）。

首轮失败的 explicit-recovery 和 main-persistence 已分别复验通过；其余 13 项尚未全部关闭，未重跑完整 48 组，也不把组合测试 transparent-save 自动视为通过。

## 边界

## 学习档案统计验收

### 启动接口复验

- 已定位 main-startup 的实际接口不一致：页面调用 buildChoiceMarkup(pool, status, esc)，已提交引擎仍接收四参数，导致旧提示重新插入且转义函数错位。只对齐该接口及其断言，未纳入工作区其他干扰项算法改动。
- 隔离暂存副本引擎单测 50/50 通过；main-startup 通过，覆盖配置延迟时首屏、按需加载练习引擎、答题后的稳定会话编号及 IndexedDB 续学断点。该测试故意阻断配置，不作为云端保存验收。
- 缓存指纹更新为 chunklab-c739b685。未更新运行中的 8787。
- 首轮失败剩余六项：两个课程包样本依赖、home-today-entries、sync-recovery、tab-content-consistency、transparent-save；mobile-8000 偶发超时仍待查。完整组尚未复跑，不能宣布可发布。

- stats-index 更新日历入口：首页已取消日历，学习档案使用 month-calendar-grid/day。保留索引加载、分页、搜索、按需详情、单句答题入今日统计及未结算不虚增轮次的检查；隔离副本通过。
- stats-mastered 使用当前“已熟悉/已掌握”两类指标，验证手动自评只进入熟悉，不能伪造考试掌握；补充紧凑统计行的课程原句解析及到期复习，隔离副本通过。
- main-startup 的入口缺少加入关系且选择器陈旧；更新后可进入练习并写入会话断点，但首次提示消退断言仍失败。工作区意群引擎与已提交引擎的提示行为也不一致，需要进一步核对，未将该测试暂存修正算作通过。
- 首轮失败目前剩余：两个课程包样本依赖、home-today-entries、main-startup、sync-recovery、tab-content-consistency、transparent-save；另有 mobile-8000 首次加载偶发超时待查。未重跑完整组。

## 课程覆盖进度验收

- deck-progress-diagnostic 和 progress-coverage 的测试样本补齐明确的加入课程关系。首页只展示已加入课程，未加入样本无法作为首页进度检查对象。
- 断言使用当前“已学 X / Y 句”文案及课程入口辅助说明；保留答题统计和去重口径检查。新句答题后验证 4/5、80% 及累计答题 4 条；重复两次答题后累计 43 条，已学句数保持 41/43。
- 两项在隔离暂存副本分别通过。它们阻断 API 验证本地进度计算，不替代协议 3 云端保存验收；云端流程由已通过的 main-persistence 等检查覆盖。
- 首轮失败新增关闭上述两项。剩余首轮失败包括两个课程包样本依赖、home-today-entries、main-startup、stats-index、stats-mastered、sync-recovery、tab-content-consistency、transparent-save；mobile-8000 已有通过证据但首次超时仍待查。未再次执行完整 48 组。

## 讲解与移动端断言修正

- 讲解刷新验收更新为当前空讲解不显示占位卡的合同，同时保留结构化讲解、转义检查和课程原始拆解数据保留检查。独立暂存副本通过。
- mobile-8000 的复习跳转断言允许必需的 reviewHandoff 参数，增加一次性交接消费、账号/服务范围不匹配时原件保留及交接写入失败时停留原页的检查。
- 移动端首次并行复验在首批题目加载等待处超时，尚未定位；随后单独复验 22 项通过，不能把首次失败抹去或宣称稳定性已解决。该次 393×852、四倍 CPU 减速下 8,000 句连续保存 p95 34ms，跨分片和断网续练通过，页面无异常。
- 当前新增通过证据为 content-explanation-refresh 与 mobile-8000；后者保留偶发超时待查。其余首轮失败仍需逐项定位，未再次完成全组验收。

本次不修改真实课程、账号记录或浏览器原件，不更新 8787。测试恢复及删除均只作用于测试自身新建的临时数据库。完整浏览器验收仍未通过，不能宣布可发布。
