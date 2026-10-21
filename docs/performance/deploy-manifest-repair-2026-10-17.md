# 部署漏文件修复

日期：2026-10-17。本轮只修改部署清单一处、新增一个负向测试及本记录；保留原有工作区改动。未运行部署脚本、未重启8787服务，未修改真实课程或学习记录。

## 根因与方案

`content-studio.html` 真实引用 `js/textbook-drafts.js?v=1`，但 `scripts/deploy-prod.sh` 手写 FILES 未包含对应文件，也没有目录项覆盖。既有依赖闭包检查准确发现了漏项，问题在部署清单而不是前端或检查器。

修复仅把 `js/textbook-drafts.js` 加到现有相关脚本旁。没有改成整个 js 目录打包，也没有添加缺文件前端兼容。现有自动依赖检查已能系统性阻断此类漏项，无需另建清单生成框架。

在 `scripts/deploy-safety.test.js` 的临时部署脚本副本篡改案例中新增一项：移除该文件必须被检查器拒绝，并明确报出此路径。测试不修改真实部署脚本；备份验证使用既有隔离临时库和备份目录。

## 验证

修复前 `node scripts/check-deploy-files.js` 稳定失败，报告唯一遗漏 `js/textbook-drafts.js`；新增测试后运行部署安全套件仍因基线漏项失败。

修复后：

- `node scripts/check-deploy-files.js`：通过；246个清单项覆盖478个运行时必需项（目录覆盖计入）。
- `node scripts/deploy-safety.test.js`：37/37通过，包括新增删除依赖案例，以及快照保护、配置、固定版本/依赖验证和失败即中止等原有断言。
- `git diff --check -- scripts/deploy-prod.sh scripts/deploy-safety.test.js`：通过，仅有既有Windows换行转换提示。

调度器仅复跑上述两个入口，记录目录：`output/test-results/deploy-manifest-repair-20261017-112651/`。未重新跑367项全量，不能按这次局部结果改写历史全量通过数。

后续应单独核对首次离线安装体积与出题/登录剩余失败；不通过放宽缓存预算或教学校验换取绿色结果。
