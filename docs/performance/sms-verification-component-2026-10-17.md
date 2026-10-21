# 短信验证码组件与本地重载

日期：2026-10-17。用户授权重载本地服务，并要求将短信功能抽象为组件。本轮按后端组件解释，不改变前端布局、短信供应商、API契约或数据库结构。

## 组件边界

`server/services/sms-verification.js` 导出 `aliyunProvider(env)`，返回 `send(phone, challengeId)` 和 `verify(phone, code, challengeId)`。它仅封装现有阿里云PNVS SDK调用，不访问数据库、创建账号、绑定手机号或调度重试。发送仍为六位验证码、五分钟有效、六十秒间隔，不返回验证码；连接/读取超时和禁止自动重试等参数保持原样。

`server/services/phone-auth.js` 调用该组件，继续负责手机号格式、发送额度、挑战状态、并发防重放、到期及错误次数、账号归属与绑定事务。保留原 `aliyunProvider` 导出以兼容现有调用方。部署清单显式加入新文件，运行时依赖闭包检查通过。

应用的登录/绑定入口仍应使用phone-auth业务服务，不能将底层send直接暴露给浏览器或绕过现有限流。组件只在可信后端使用，凭据仍来自服务端环境变量；没有把密钥写入代码或前端。没有添加模拟短信生产分支、多供应商框架、自动重试或人机验证功能。

错误语义保持不变：账号层对外仍返回安全的SMS_UNAVAILABLE等既有错误，不返回供应商原始敏感响应。这次是结构抽取，不声称已完成后台脱敏日志功能。

## 测试

先新增 `server/sms-verification.test.js` 在原导出接口锁定行为，然后抽取并将测试目标切换至独立模块。测试通过模块边界注入SDK，使用合成凭据和手机号，不加载.env、不联网、不发送短信、不操作真实数据库。覆盖配置缺失、默认/备用凭据名、签名/模板参数、六位/300秒/60秒、超时、禁止自动重试、云端核验通过/失败及错误语义和旧导出兼容。

通过：组件合同测试、server/phone-auth.test.js（独立临时SQLite，保护旧课程标记、绑定归属、并发核验、有效期/次数/重启后限流）、server/phone-auth-http.test.js非浏览器部分（独立端口和临时数据库，注入短信）、scripts/check-deploy-files.js、部署安全37/37、服务端已安装依赖加载校验、语法和定向diff检查。

浏览器综合测试 `PHONE_UI_TEST=true node server/phone-auth-http.test.js` 中，原绑定取消按钮已退役，测试改点现有“关闭登录窗口”。复跑通过前面的手机号/密码登录和绑定保护段，但随后在第214行的落地页卡片stage-link可见性断言失败。整个浏览器入口仍记失败，未放宽断言或修改无关落地页；不宣称全量或完整UI通过。

## 重载与数据保护

重载前通过SQLite在线backup API创建一致性备份，不直接复制活动WAL主文件：

`output/backups/sms-component-2026-10-17T13-20-35-860Z/chunklab.db`

备份quick_check=ok，来源为 `server/data/chunklab.db`。确认8787监听进程为之前启动的Node 41304及其命令行后，仅停止该进程，使用相同server工作目录和 `node -r ./loadenv.js index.js` 隐藏启动新进程34724；没有切换数据目录或运行课程迁移工具。

重载后健康检查正常、首页HTTP200、requireAuth=true、authMode=phone、writeProtocol=3。真实数据库quick_check=ok；备份与重载后只读计数对比：users 36→36，user_kv 54→54，user_entity_rows 58→58，user_recovery_sources 1→1。计数一致不等于逐字段数据审计，本轮未改变数据处理代码。

本地服务已加载修正后的短信签名和新组件。未再次发送真实短信、创建/绑定真实账号或清理浏览器数据。未全量回归、未部署公网服务器。
