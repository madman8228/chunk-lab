# 登录过期后的队列恢复验证

日期：2026-10-17。只改 e2e/auth-pending-recovery.test.js 与本记录，无生产代码变更。使用新建临时数据目录、隔离端口和新浏览器上下文；未访问真实账号、清理原浏览器数据或重启8787。

## 根因

原用例注入一次真实协议请求401，随后等待自动出现的chunkauth-mask，稳定超时20秒。现场显示token已清除、账号投影未确认、没有弹窗。不能以未登录上下文ServerStore.pending()为空判断原账号队列被删除：它们属于不同存储scope。

当前main页面明确采用显式登录入口，core.ensureCloud在body.dataset.authEntry=explicit时进入signed-out状态，不自动弹窗。旧测试仍要求自动弹窗及跨重载保留旧弹窗文案，与当前产品契约不符。修复应在测试流程层，不应让前端恢复强制弹窗或静默创建游客。

## 修改

隔离子进程明确PHONE_AUTH_ENABLED=false，本用例只验证用户名登录的协议恢复，不冒充手机号/短信登录覆盖。

401后等待未登录页，断言没有强制弹窗、没有已确认账号投影；仍直接打开原账号已存在的IndexedDB，检查原请求status=pending，保留“数据库不存在不能偷偷创建”的保护。然后真实点击顶部登录入口，以原账号登录。

去掉旧的“必须捕获一次waitForNavigation”假设，该等待曾出现ERR_ABORTED；改为原有登录完成/投影确认/遮罩关闭条件，并新增确认AccountStorage.databaseName回到原scope。

保留请求仅发两次（401一次、成功一次）、两个请求逐字段相同、服务器回执属于原账号且恰好一份等断言。新增刷新后队列不恢复、请求不再重发，随后检查SQLite回执仍恰好一份。未增加超时、绕过鉴权、清除队列或手动发送待恢复操作。

## 结果

最终版本node e2e/auth-pending-recovery.test.js连续两次通过。node scripts/session-retry.test.cjs和node scripts/signed-out-reload.test.cjs通过，保留原课程标记、会话一致性、真实过期和账号切换保护。语法与定向git diff --check通过，仅有Windows换行提示。

通过排障技能先复现、再调整正确层级；通过Playwright既有真实浏览器用例覆盖登录与落库，未另建框架。没有全量复跑，不更新历史367项通过数；手机号恢复、其他账号登录流程及SW升级items=0仍需分别验证。
