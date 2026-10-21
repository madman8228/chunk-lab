# jqka 手机号登录实现与启用边界

## 已实现

- 参考 WSL `/home/rookie/work/share_server/utils/smsProvider.js`；其 `.env`、开发、生产配置的 provider 均为 `aliyun_pnvs`，不是普通 SendSms。
- 使用官方 Node SDK 调用 SendSmsVerifyCode / CheckSmsVerifyCode。短信验证码不返回给浏览器、不写入日志、不保存明文。
- 中国大陆手机号，六位验证码，五分钟有效期；同手机号 60 秒冷却、每日最多 10 次，同 IP 每小时最多 20 次。发送配额持久化，服务重启不会清空。
- 全站滚动 24 小时发送上限默认 1000，SMS_DAILY_SEND_LIMIT 可调整，用于限制短信滥用的费用风险。
- 核验最多五次；核验前原子占用，防止同时消费；验证码通过后单次消费。
- 手机号首次核验通过后自动创建账号，后续使用唯一手机号映射定位相同 user_id。
- 登录和绑定分别绑定 challenge 的 purpose、owner_id；绑定只能使用当前已认证账号，同手机号属于另一账号时禁止自动合并。
- 不修改既有 users、课程、学习记录、浏览器存储或备份；仅新增手机号映射和短期验证码挑战表。
- 主站 index.html 登录入口与 main.html 共用现有会话。此实现针对同源部署；若未来主站和子功能分属不同域，必须另行设计统一登录交换，不能假设 localStorage 跨域共享。
- 手机模式启用后禁止用户名注册；默认禁止密码登录和新游客创建。现有有效登录继续可用，可在设置中绑定手机号，绑定不切换缓存代次。
- 表单有发送倒计时、按钮防重复点击、20 秒请求超时、标签、自动填充和键盘焦点约束。

## 接口

`POST /api/auth/phone/code`: `{phone, purpose:"login"|"bind"}`；绑定要求已有 Bearer token。成功返回 challengeId、expiresIn、retryAfter，不返回验证码。

`POST /api/auth/phone/login`: `{phone, code, challengeId, purpose:"login"|"bind"}`；成功返回现有会话格式 `{token,user}`，user.phone 仅含脱敏号码。绑定成功保持原 user.id。

`GET /api/config` 新增 authMode（phone/password）；`GET /api/auth/me` 在手机模式增加脱敏 phone。

## 配置与启用记录

首次实现时未配置短信，也未重启服务。随后用户明确回复“允许复用”，已将 WSL share_server 的阿里云 PNVS 必要配置安全复用到本项目 server/.env，源项目未修改，值未显示、未写入文档；server/.env 经 git check-ignore 确认不会提交。

本地 PHONE_AUTH_ENABLED=true、ALLOW_LEGACY_PASSWORD_LOGIN=false。临时数据库与随机端口的完整服务启动检查通过，SDK 可构造，未调用短信发送。之后更新本地 8787 服务，当前进程 PID 34508，/api/config 确认 authMode=phone，main.html 返回 200。未改动线上服务。

启用前通过 SQLite backup API 创建一致性快照 server/backups/phone-login-enable-tWG8PN/before-phone-login.db，integrity_check=ok。目标库为 D:/06-project/chunk-practice/server/data/chunklab.db，保护范围为全部 36 个账号。服务停止后记录 26 张原有账号及学习表的行数和内容 SHA256，启动后复核全部一致；没有替换、清空、迁移课程或学习记录。仅新增手机号身份及验证码挑战表，发送记录为 0。

真实短信投递及验证码核验尚未实测，需用户在登录页操作。原有有效账号建议先在账号设置中绑定手机号，避免退出后用尚未绑定的手机号创建另一个账号。原有未上传队列/历史缓存冲突不会因手机号启用而自动修复，本次未重放或覆盖这些记录。

配置示例仅存于 server/.env.example，真实值不得提交 Git：

- PHONE_AUTH_ENABLED=true，REQUIRE_AUTH=true，原 JWT_SECRET 保持不变。
- ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET。
- SMS_SIGN_NAME / SMS_TEMPLATE_CODE（须确认该签名、模板适用于 jqka；模板需接受 code 与 min）。
- 可选 SMS_PNVS_SCHEME_NAME / SMS_ALIYUN_PNVS_REGION_ID。

开启前必须确认旧账号访问方案：已有有效会话可直接绑定；若旧会话已过期但知道旧密码，可短期设 ALLOW_LEGACY_PASSWORD_LOGIN=true，用受控过渡入口完成旧账号验证后绑定。不要仅凭手机号自动认领旧账号，也不要自动把学习数据移到新账号。旧密码接口不会创建账号，过渡完成关闭开关；目前手机表单不暴露密码入口。

后续如果涉及旧账号身份认领、课程迁移或记录合并，仍需针对具体目标授权并制作一致性、可恢复备份，不能直接替换数据。

## 验证

- node server/phone-auth.test.js：隔离临时 SQLite，验证新账号、同手机号复登、过期、错误五次、并发消费、绑定保留原 ID、冲突禁止合并、限流重启保留、供应商失败不泄漏。
- node server/phone-auth-http.test.js：独立临时目录及随机端口，真实 Express/JWT 接口，注入短信替身；用户名注册禁用、手机号核验、绑定鉴权、旧账号保持、脱敏 me。
- PHONE_UI_TEST=true 时该测试另开独立 Chromium 上下文，1440 / 390 宽度截图、无横向溢出、获取短信、验证码登录、遮罩关闭与会话写入。
- api.test.js 现有会话切换/迟到 401 回归通过；check-sw 校验通过。
- SDK 使用 dummy 配置构造成功，无网络请求。

上述测试不等于阿里云真实投递验收。短信供应商真实回执、主站生产域路由、旧账号绑定上线验证仍需配置与启用后检查。

## 界面审查范围
 
## 主站个人信息入口

首页导航支持手机号登录/自动注册，成功后留在首页并展开个人信息，显示脱敏手机号和账号编号。已有未绑定账号可绑定手机号；已绑定账号提供进入学习与退出登录。刷新恢复会话，其他标签页退出会清除当前页个人信息显示，不删除课程或学习记录。首页登录可取消，学习页原有强制登录行为不变。

隔离 HTTP/浏览器测试覆盖首页取消后重新登录、登录不跳转、个人信息脱敏、刷新恢复、跨标签页退出、1440/390 宽度面板边界。修正既有手机导航整体隐藏导致账号入口不可见的问题。短信服务、API 会话一致性和 SW 校验均通过。部署清单补充手机号服务及既有服务引用的缺失模块。

本次仅修改本地代码并完成隔离验证，未部署 jqka.top，未发送真实短信，未重启线上服务。线上启用仍需生产手机号配置及发布验证，不能把本地测试结果视为线上已生效。

## 界面审查记录

沿用 auth-ui.js 原有暖白表单、蓝色主按钮与圆角，不改整站视觉系统。桌面、手机独立截图已检查。Impeccable 检测器报告 index.html 既有对比度、标题层级、插画等问题；未将这些问题扩大为本次整站重设计。

独立界面审查指出忙碌状态焦点及原生校验绕过行内提示两项问题，已改为焦点留在对话框、显式行内校验，并提前标明六位验证码。审查建议恢复 Chunk Lab 标题，但用户已明确 jqka.top 是主站、Chunk Lab 是子功能，因此统一登录保留“登录 jqka”，不视为学习模块改名。

复核 verdict 为 ship，仅覆盖上述焦点、校验提示和品牌标题三项修正。文档审查确认普通扩展未建立或重写全局 DESIGN.md；保留既有视觉差异。新增主站登录按钮沿用原导航的字重、间距、边框、圆角并提供焦点和忙碌状态。
