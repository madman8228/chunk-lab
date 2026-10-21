# 预学习离线重开：分层排查与部分交付

## 后续验证（优先于下方历史记录）

最新报告 `output/test-results/vocabulary-browse-ui-1792421275015/summary.json` 已通过全部九步骤：先实际逐步访问并播放，再关闭独立浏览器进程，以同一测试专用配置目录离线启动；九步骤图片逐一实际解码，九段示范逐一实际播放，九条离线请求保留并在重连后确认最后原请求。`fullMediaOfflineVerified`、`fullBrowserRestartVerified` 均为 true，`verifiedVisitedPlanSteps` 为9。范围仅为已明确访问过的试点编排，不包含未访问内容、整库下载、Safari／iOS或实体手机承诺。未缓存步骤仍拒绝跳转且不入队，HTTP明确拒绝仍不放开缓存读取。补验曾因目录已展开而再次点击关闭导致测试超时，修正夹具判断展开状态后通过，未为此修改产品逻辑。

报告 `output/test-results/vocabulary-browse-ui-1792415404231/summary.json` 已证明：独立 Chromium 进程关闭后，以同一测试专用配置目录离线启动，访问过的图片实际解码、访问过的示范音频实际播放成功；启动不自动播放，原待提交请求保留，重连仍确认原请求。该报告尚未覆盖全部九步骤媒体，不能据此宣称整课媒体验收完成。

进一步定位发现，启用图片目录后旧素材别名仍需经过 no-cache 重定向，单纯打开交付配置不足以解决离线读取。现在由服务端在当前步骤响应中提供独立的 `deliveryImages` 内容哈希地址投影；原 item、contentRevision 与课程素材键保持不变。未配置目录时保留旧交付行为，不增加前端整库预缓存或大图兜底。此项属于交付层修正，而非修改课程原材料。

服务端完整回归报告 `output/test-results/20261019131034676-35880/summary.json`：98/98，通过、失败0、跳过0、flaky 0；运行期间工作树有变化，不能声明固定指纹验收。所有测试使用隔离实例，未更新真实服务。

## 现象与可重复证据

`node e2e/vocabulary-browse.test.cjs` 新增真实 Service Worker 场景，使用全新临时应用／数据目录、隔离端口及独立 Chromium 上下文。只复制真实原子页面包，不预取词库；在线访问认词与短语，离线生成一个待保存请求，关闭文档，再创建新文档离线访问同一课程。

修复前稳定失败：`OFFLINE_REOPEN_FAILED`，正文“学习记录尚未确认，请连接后重试”。页面及脚本已经离线读取成功，原待保存请求仍在。`js/learning-session-bootstrap.test.js` 在源码修改前同样先红：显式允许确认缓存读取仍抛尚未确认。

## 根因与系统性处理

公共 `LearningSessionBootstrap.ready` 把 `CL.serverPersistenceReady()` 当成读与写的共同门槛；后者本来是网络发送安全门槛，离线启动必须为 false。确认缓存、已缓存课程步骤和队列均存在时，仍被拒绝读取。

新增明确的 `allowConfirmedOffline` 读取选项，仅预学习入口启用，其他调用默认仍严格要求在线确认。要求实际启动状态为 offline、已有协议3配置、当前账号／服务范围匹配的 ServerCache 和完整有效水位；异步读取后再次核对身份。不使用旧快照、课程缓存或浏览器在线标志代替确认缓存。不会将 serverPersistenceReady 设 true，不放开网络发送，也不新建保存器。

实测新文档 navigator.onLine 仍为 true，但实际网络已失败。因此采用请求结果而非该标志。core 的配置失败分类区分 HTTP 错误与无 HTTP 响应的网络失败：401／403／503 不被当成可读缓存的 offline 许可；401 保留原失效登录退出流程。没有在课程页面绕过鉴权。

## 图片缺口：更适合在交付配置侧解决

追加实际图片解码检查后，离线重开的图片失败。该测试实例没有启用 `VOCAB_IMAGE_CATALOG`，图片仍是需要 HTTP 重校验的旧本地路径；Service Worker 按既定规则跳过词汇图库。文字与位置可恢复，不等于所有图音可以离线使用。

已有 `server/middleware/vocabulary-image-delivery.js` 能把稳定素材键映射至内容哈希地址，并给核验后的文件 immutable 缓存头。后续先在隔离实例验证这条素材交付配置、真实缓存与进程重启，再决定发布配置；不新增前端词库预缓存，不改已发布引用，不自动上传OSS／切换正式配置。当前没有新增前端图片兜底，只验证原有文字提示继续有效，绝不回退大原图。

优点是读写门槛分离且不另建媒体缓存系统；代价是离线只支持已有确认缓存和访问过的内容，未缓存步骤仍需联网，浏览器存储也可能被系统回收。完整图音及浏览器进程关闭重启尚未验收，不能以文档关闭重开代替。

## 当前验收与未完成范围

最终报告 `output/test-results/vocabulary-browse-ui-1792415084524/summary.json`：离线阶段显式列出真实SW、关闭文档重开、原请求保留、未缓存步骤不入队、发送门槛关闭、同请求重连确认和HTTP拒绝检查；同时如实记录 cachedImageDecoded／fullMediaOfflineVerified／fullBrowserRestartVerified 为 false。整个目标未完成，不能把其他 true 标记解释为媒体或进程重启已通过。

接口单测覆盖默认严格、显式缓存读取、空／损坏缓存、协议不符、身份中途切换、明确拒绝，以及读取不打开写入门槛。真实浏览器验证离线重开短语、原请求不变、未缓存步骤不入队、重连后同一请求编号获确认、HTTP 拒绝不绕过。401 测试最初被每次导航重塞测试 token 的夹具干扰，已改为仅首次注入，不改真实失效登录行为。

`js/server-store.test.js`、`js/server-cache.test.js`、`scripts/core-runtime.test.js`、`scripts/core-identity.test.js`、`scripts/session-retry.test.cjs`、新增启动单测、生成文件与严格 SW／部署清单检查通过。自动测试清单432项，不代表全量运行。SW `chunklab-27c2c7a9` 未提高原子安装预算，真实服务未更新。

当前报告 `output/test-results/vocabulary-browse-ui-1792415019810/summary.json` 包含离线阶段及其他完整浏览流程；后续报告以最新实际输出为准。图音离线、浏览器进程重启、个人课程制作贯通、人工审核与真实授权发布仍待完成。没有迁移／清理真实账号、课程、备份、原画或浏览器数据。本轮仅行为逻辑改动，没有新增视觉设计、图片或重新开启视觉润色轮次。
