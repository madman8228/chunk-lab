# 发布准备说明：项目收尾验收

- Status: external-gates-pending
- Updated: 2026-09-20
- Worktree: `D:/06-project/chunk-practice`
- Strict test run: `output/test-results/20260920052306078-29148/summary.json`

## 当前可以确认

- 严格 `TEST_RETRIES=0 npm test`：100/100，通过且无 flaky。
- 学习连续流程：完成课节后进入下一未完成课节；首页刷新不自动切入课程。
- 讲解兜底：不再伪造惯用表达分类、重复译文或复制原题为例句；已有结构化讲解保留。
- 构建、内容生成物、Service Worker 严格校验、部署依赖清单和发布专项均通过。
- 发布专项：24/24；首屏 255.5 KB，按需加载 1/136 分片，375px 无横向溢出。

## 发布前仍需外部确认

- 真实设备和目标浏览器矩阵，尤其移动端长讲解滚动、音频和刷新恢复。
- 外部 course-creator 导出与 CoursePackage 2.0 的互操作验收。
- 首发数据安全、真实账号数据备份/恢复、生产环境变量与部署演练。
- 真实用户同步冲突归档容量、保留期限和发布后监控。

## 边界

本说明不代表已经部署、提交或推送，也不代表所有历史 Astra 计划完成。上述外部门槛完成前，发布状态保持 `external-gates-pending`。
