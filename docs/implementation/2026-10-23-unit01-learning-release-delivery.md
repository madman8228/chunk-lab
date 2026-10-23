# 零基础首单元：正式学习验收、试点发布与五课内容补齐

- Status: in-progress
- Updated: 2026-10-23
- Branch/worktree: `stabilize/p0-1-20261021` / `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `a5e9e8831315377743dc232bcb5789412e367ce0`；工作区有大量既有修改与未跟踪课程资产，不得整体还原、清理或提交。相关表达课程文件见下文，需以当前工作区为起点，不能仅以 HEAD 为基线。
- Planner: GPT-6 Astra（流程角色；工具未暴露主任务实际模型选择）
- Executor: GPT-5.6 Luna

## Objective

交付一个有实际运行证据的首单元学习闭环：验收现有两课正式播放器；补齐并验收五课候选包；得到用户对具体摘要的明确发布批准后，将五课包作为系统内置课程发布。发布后允许通过修订单条课节/活动生成新release，旧版本和进行中会话保持不变。不要继续创建相似演示页面，也不要默认上线未获摘要绑定批准的版本。

本文件的“继续执行”授权实施与隔离测试，不等于授权真实目录发布。步骤 2 有明确人工门槛；等待批准时可先完成步骤 3 的草稿制作。没有发布批准时保持 `in-progress`，列明唯一待决项，不反复要求重看已审阅内容。

## Current state and evidence

### 现有入口与文件

- 课程蓝图：`docs/plans/zero-english-curriculum-20261023.md`，12 单元60小课；本次只做首单元五课，不扩展后续11单元。
- 两课内容来源：`assets/expression-unit01-draft-lessons.json`。
- 两课正式包：`output/expression-course-drafts/unit01-formal-v1/course-package.json`，保留该目录及 v2；课程 ID `expression-unit01-tools`，课节 `L101`、`L103`，共16活动、14条音频。实际执行时校验文件及摘要，不能依赖本文件中的数量替代检查。
- 浏览器草稿：`expression-unit01-draft.html`；共享渲染器审核页：`expression-unit01-player-review.html` + `js/expression-unit01-player-review.js`。后者本地 localStorage 预览，不是服务端验收。
- 正式入口：`expression-learn.html?course=expression-unit01-tools&lesson=L101`；目录入口 `main.html?view=discover`，个人内容 `main.html?view=my-learning`，首页 `main.html?view=home`。
- 正式 UI：`src/expression-course/ui/entry.mjs`、`renderers.mjs`；运行时 `src/expression-course/runtime.mjs`；验证器 `src/expression-course/validate.mjs`。
- 服务端：`server/routes/expression-courses.js`、`server/services/expression-course/{repository.js,session-service.js,schema.js}`；权限复用 `/api/learning-sessions/start`。
- 生成工具：`scripts/build-expression-course.mjs`、`scripts/package-unit01-pilot.mjs`、`scripts/generate-unit01-draft-audio.ps1`。打包脚本目前硬编码两课，不能直接喂五课；TTS 脚本禁止覆盖旧 WAV。

### 已完成但仍需实际运行验证

- `session-service.js` 已补：课程完成但尚无掌握证据时，为 taughtSkillIds 建立 needs_practice 到期复习；冲突不覆盖已有技能状态。
- `entry.mjs` 已补：讲解音频播放、完成后的下一课链接，末课/复习模式不跳课，保留 return。
- 单元测试：`src/expression-course/ui/entry.test.mjs` 是模拟 DOM 控制器测试，不是浏览器视觉/实播验收。
- `server/services/expression-course/unit01.test.cjs` 用实际包、临时 SQLite 测试两课完成、续学、幂等、隔离、次日复习、数据库重开。
- 上轮16测试通过；本轮只规划，未重跑，不将历史通过作为本轮验收。
- 旧 `e2e/expression-course.test.cjs` 有隔离服务、临时账号和发现页进入正式播放器的可复用骨架，但音频是正弦波，只验证解码，不证明教学语音有效。
- 旧已发布课 `expression-l001-like` 是“表达喜欢：饮品”；不得改 ID、改归属、替换或重发它来代表首单元。

## Assumptions and decisions

1. 中文母语成人；无配图、无录音、无 ASR、无发音评分。听辨/文本能力与口语能力分开，不把打字完成称为口语达标。
2. 保留现有播放器与 schema，不新建学习引擎、保存体系、复习表或平行课程管理页。优先复用现有管理员导入发布能力。
3. 两课试点尚未获得本次正式发布授权。既往饮品课的批准不能沿用到新课。
4. 五课 ID 顺序固定 `L101,L102,L103,L104,L105`；已有 L101/L103 的活动 ID、音频 ID、内容语义保持不变；扩课采用同 courseId 的新候选 release，不新造重复课程卡片。
5. 不强制补齐 transfer_test 以换取“掌握”：当前验证器禁止将已经曝光的同一答案冒充迁移测验。保留学习完成与 needs_practice，准确注明证据范围。
6. 复习到期通过服务端注入时钟/临时数据库控制，不改操作系统时间、不改真实账号 due_at。
7. TTS 用现有 Microsoft Zira 真实语音方式，可用性先检查；新增内容使用自然清晰语速，慢速可作为示范，但不作为全部验收音频。不可用时报告具体阻塞，不用蜂鸣音、静音或浏览器声音缺失的伪成功替代。

## Scope

- 修复本次验收证实的播放器/服务端阻断问题；为实际两课新增隔离端到端测试。
- 两课候选包审核清单与发布回执；真实发布仅在批准后执行。
- 三课内容、实际 TTS、五课整合草稿、资源摘要与验证报告；只要求用户审核新增内容及音频。

## Out of scope

- 全站改版、账号数据恢复/清理、缓存重置、历史261→2调查。
- 其余11单元、完整字母学习引擎、多轮开放对话、个性姓名动态语音、口语评分。
- 擅自发布、自动给真实账号加入学习、代答写入真实账号；提交、推送、部署到外部生产环境。
- 删除任何旧包、音频、备份、浏览器数据；不要清理当前工作树已有删除/修改。

## Contracts and data changes

### 复用 HTTP 与身份边界

- 管理员：`POST /api/admin/expression-assets` `{assetId,mimeType,base64}`；返回摘要及大小。上传结果必须与包内 sha256/size 一致。
- `POST /api/admin/expression-drafts` `{package,requestId}` → `{draftId,revision}`。
- `POST .../:draftId/validate` → `{valid,errors,contentHash,revision}`；必须 valid。
- `POST .../:draftId/review` `{contentHash}` → hash-bound 审核；`POST .../:draftId/publish` `{expectedRevision,contentHash,requestId}` → `{courseId,releaseId,contentHash,previousReleaseId}`。持久化 requestId，重试不生成另一笔发布。
- 学员元数据：`GET /api/expression-courses/:courseId`；学习权限：`POST /api/learning-sessions/start`，unitId 为 `lesson-<lessonId>`。
- 学习会话：`POST /api/expression-sessions`，动作 `POST /api/expression-sessions/:sessionId/actions` 带 requestId、expectedRevision、action 以及 X-Learning-Session；服务端回执才表示已保存。复习：`GET /api/expression-reviews/due`，按返回的 lessonId/skillId/activityId/releaseId 启动。
- 素材：`GET /api/expression-courses/:courseId/releases/:releaseId/assets/:assetId`；鉴权并绑定发布版本，不绕过到公开大文件或 speechSynthesis 降级。

无预期 schema migration。只写隔离测试数据及批准后表达课目录/发布表；不写真实账号课程/学习表。

### 隔离运行

沿用 `e2e/expression-course.test.cjs` 的启动模式：新 mkdtemp、独立端口、独立 CHUNKLAB_DATA_DIR、独立 CHUNKLAB_APP_ROOT（`e2e/lib/prepare-ui-root.js`）、NODE_ENV=test、EXPRESSION_COURSES_ENABLED=true、REQUIRE_AUTH=true、PHONE_AUTH_ENABLED=false、随机测试密钥。测试账号只注册在隔离实例。不得读取真实 .env 密钥到报告或把测试指向8787/server/data。

## Implementation steps

### 1. 验收正式学习全流程，不再验收相似草稿页

- [x] 读取本文件、AGENTS.md；核对上述文件和针对性 diff。不要重做全项目架构调查。
- [x] 基线构建及17项自动化单测/服务测试/既有合成课程 e2e 已通过；新增 `e2e/expression-unit01.test.cjs`，复用既有 e2e 骨架加载实际两课 package 和14个 WAV，通过现有 API 发布到隔离目录。
- [x] 从隔离发现页找到实际课程卡进入 **expression-learn.html**，无需先加入即可打开；测试账号通过课程菜单加入后个人内容仅出现一次。没有在真实账号操作加入。
- [ ] L101/L103实际音频请求、浏览器解码/播放、作答与答案隐藏均已通过自动测试；仍需人工确认发音、节奏和教学效果，自动播放不等于人工音质认可。
- [x] L103完成一步后刷新并恢复到第2步；L101 → “下一课” → L103；末课完成不显示下一课。实际包服务测试覆盖续学及固定release；浏览器级跨刷新未记录sessionId/releaseId断言。
- [x] 实际包完整完成两课；隔离地将两课复习到期后，从L103页面进入L101复习并完成，复习不跳到下一教学课。服务端测试覆盖到期调度与服务重开；实际包服务测试断言保存和隔离。
- [x] `entry.mjs::loadDueReviews` 已修复并以隔离真实包验证：从L103页选择L101到期复习时，权限单元、复习会话和页面标题均绑定L101；完成复习不跳下一课。下一课仅按服务器current.lessonId显示。
- [x] 实际包403与真实音频网络中断均验证可恢复、不推进且不记为已听；恢复后可正常播放。合成课浏览器测试覆盖权限到期、丢响应及保留答案；播放回执期间的按钮静默丢点击问题已修复并通过真实包E2E。
- [x] 桌面938×932与手机360×844无横向溢出；没有完成键盘路径、下一课换行和持久化截图验收。
- [x] 已输出 `output/expression-course-drafts/unit01-acceptance-v1/acceptance.md`，记录包摘要、隔离范围、通过项和剩余项。报告标明“部分验收”，不宣称正式播放器整体验收通过。

浏览器工具：若可用现有 Playwright 测试环境可直接运行新增 e2e；若本轮工具要求使用 CUA 控制实际浏览器，则遵守工具约束，使用 CUA 对隔离实例操作，后端断言仍用测试脚本。不能绕过工具限制，也不能将模拟DOM测试当实际浏览器验收。

### 2. 明确批准后发布到系统内置目录

- [x] 步骤1通过后整理五课待发布清单：courseId `expression-unit01-tools`，L101–L105，42个活动、34条音频；package SHA-256 `5476c3dd712cb1af88505f865a68507a28203fe5c24f905a7da93f5bb640029a`；验证报告 `output/expression-course-drafts/unit01-complete-v2/validation.json`。管理员页面已导入并检查通过；只读读取最新草稿确认courseId、标题、五课顺序、34个资源和当前package JSON均与获批文件完全一致；server contentHash `9483cbf619f77374d46a56c559a7b80cbcd0d0ffc895de457f7228d6936af1a3`。
- [x] 用户于2026-10-23明确批准将以上摘要绑定的五课候选包发布至系统内置目录；不会自动加入个人账号。
- [x] 批准后只读检查：服务地址 `127.0.0.1:8787` 健康；DB `D:\06-project\chunk-practice\server\data\chunklab.db`（由活动进程空 `CHUNKLAB_DATA_DIR` 与 `server/db.js` 默认路径确认）；表达课路由已启用（管理员目录路由返回401而非404，证明已注册；命令行探测未携带会话，且无法通过当前失效的浏览器自动化接口检查现有浏览器会话）；同courseId当前唯一发布为旧课程 `expression-l001-like` / release `r-d64091887a4d1bc7207b`，尚无五课课程。若已有相同hash则验证并记录，不重复发布；不同hash不得盲目覆盖活动版本，报告差异与批准目标。
- [x] 写入前已为目标数据库创建 SQLite 在线一致性备份并通过 `PRAGMA integrity_check`：`D:\06-project\chunk-practice\server\backups\chunklab_before_expression_publish_20261023T070658Z.db`（108,064,768 bytes，`ok`）。记录目标DB及现存旧release；未直接复制活动WAL主库文件。禁止恢复快照覆盖非空账号。
- [ ] 如果需要让新服务端代码生效，只有隔离验收完成且得到更新本地服务许可后重启；此前用户历史重启授权不等于本轮任意重启授权。说明是否更新8787，不触碰其他监听进程。
- [ ] 当前阻塞：命令行管理员目录请求未携带管理员会话（HTTP 401）；当前无法检查或复用用户浏览器会话。不得读取/提取浏览器token或密码、绕过鉴权或直接改SQLite。取得可用管理员会话后，经管理员API上传/保存/校验/审核/发布；不得直接手改 expression_courses、账户归属或manifest模拟发布。将回执存入新版本发布目录 `system-publication-receipt.json`，不含token/密码，记录批准证据、hash、releaseId、previousReleaseId与时间。
- [ ] 发布后只读确认目录API及发现页面出现准确卡片、课节元数据正确、旧饮品课仍存在。不代真实账号答题；需要生产学习冒烟时先取得明确账号操作授权，否则用隔离全流程报告加生产只读确认。

### 3. 补齐首单元其余三课并形成五课候选包

- [x] 新建 `output/expression-course-drafts/unit01-complete-v2/`，写入 `content-review.md`、结构化源稿、能力/活动映射与审核边界；v1保留未覆盖。复用正式隔离播放器，没有另建审核HTML页。
- [x] L102“打招呼与告别”：`greet_and_say_goodbye`，Hello/Hi/Bye；情境与听辨区分见面问候/离开告别；文本接受Hello/Hi作为回应、Bye只作告别；文字题支持提示、看答案或跳过，跳过不计独立掌握。
- [x] L104“请说慢一点”：`request_slower_speech`；先理解Please speak slowly.，再与Again, please.区分放慢与重复；提供自然语速及清晰慢速TTS，没有故意加速。
- [x] L105“听辨姓名拼写”：`recognize_name_spelling`；L/I/N/B/E逐个听辨，辨认Lin/Ben及字母序列，解释字母名与词中发音不同；只覆盖固定姓名听辨和文字拼写，不声称支持任意姓名口语拼读。
- [x] 三课各10步以内（L102 8、L104 8、L105 10），仅用已支持活动；每课两个复习引用，听力题未在答题前展示答案。
- [x] 新增20条真实TTS WAV，使用Microsoft Zira Desktop；清单记录原文、声线、rate、字节数、SHA-256、时长。文件带v2版本名，旧脚本、旧音频与v1候选均保留。
- [x] 新增窄用途 `scripts/package-unit01-complete.mjs`，按明确lessonId组合五课，未改写两课试点打包器或预览固定文件。
- [x] 五课候选包 `course-package.json` 使用courseId `expression-unit01-tools`，顺序L101–L105；L101/L103 lesson JSON与已验收包一致，新增前置关系只落在新课，标题为“零基础入门：学习指令、问候与求助”。
- [x] `validateExpressionPackage({forPublish:true})`通过；34条包内音频逐条校验size/SHA/WAV头，20条新音频逐条记录时长，原14条音频核验后原样复用。隔离正式播放器E2E覆盖五课完整学习、真实WAV播放、L103刷新续学、L102复习归属、跳过文字题不记独立证据、桌面/手机宽度。
- [x] 用户审核新增三课内容/音频与五课顺序通过（2026-10-23）；结果写入内容清单，不要求重看旧两课。五课进入系统目录仍需该摘要绑定的明确发布批准。
- [x] 已核实表达课支持单条修订：管理员从当前已发布课程“复制为新草稿”，可只改一个活动条目，经校验、审核后发布新release；旧release不可变，已有学习会话固定原版本。`e2e/expression-course.test.cjs` 使用正式管理员UI完成单活动修改并断言其它包内容未变、旧release保留。此承诺限定本计划的表达课程，不默认代表全站所有历史课程类型均已有同一修订UI。

## Validation

从仓库根目录执行，命令失败需记录原因并定点修复：

```powershell
node scripts/build-expression-course.mjs
node --test src/expression-course/ui/entry.test.mjs src/expression-course/core.test.mjs server/services/expression-course/session.test.cjs server/services/expression-course/unit01.test.cjs
node --test e2e/expression-course.test.cjs
node --test e2e/expression-unit01.test.cjs
```

- [x] 当前六文件针对性组合19/19通过。旧合成E2E的两个问题分别是课程交互已改为句块自动提交但测试仍手动点击，以及测试注入每次导航覆盖回第一账号token；已对齐测试契约并改为仅首次注入。最新完整命令通过。
- [x] 五课由 `scripts/package-unit01-complete.mjs` 直接调用 validateExpressionPackage `{forPublish:true,availableAssets}`；逐文件重算SHA/size、检查RIFF/WAVE及音频时长；`node --test e2e/expression-unit01-complete.test.cjs` 在隔离服务完成五课正式播放器测试。
- [x] 最新完整回归包含五课E2E：`node scripts/build-expression-course.mjs` 成功；七文件组合 `node --test ...` 21/21 通过（2026-10-23，隔离临时数据目录/端口）。
- [x] UI源码改动后通过 `node scripts/build-expression-course.mjs` 重新生成 `js/expression-course-player.js`；未手改bundle。SW更新提示不在本次范围。
- [ ] 真实发布前后只读目录对照、发布回执及一致备份检查（仅批准后）。

## Acceptance criteria

- [ ] 真实两课包在隔离正式入口完成“目录→加入→开始→真实音频→答题→退出续学→下一课→完成→到期复习”，不是预览localStorage闭环。
- [x] 错误/断网/权限失败不伪完成；完成与掌握分开；复习准确绑定课节（隔离播放器与服务端测试）。
- [ ] 桌面/手机主要操作可用，有运行截图和请求/数据库断言；不得声称自动播放验证等于人工发音认可。
- [ ] 五课真实发布仅在摘要绑定批准后进行；完成时有系统内置目录回执、旧课程保留及服务只读验证。
- [x] L102/L104/L105有内容、真实音频、技能/活动/复习引用；五课候选包可从正式隔离入口学习，稳定ID及旧资产保留。
- [x] 已完成新增三课审核记录，并标明L105能力边界；没有重复要求审核旧内容。
- [x] 所有本次写入真实目录的动作已有明确批准；发布尚未完成前，整个交接仍保持 in-progress。

## Risks and rollback

- 大量既有工作区修改：只碰表达课必要文件与新版本输出。不要 git reset/checkout、清理untracked或删除旧课程。
- 两课→五课版本升级：保留旧release；服务端续学已固定旧release，回归测试不能删除。新会话用新release，不搬迁旧账号记录。
- live服务更新与课程发布是两件事，分别记录；不以重启证明发布成功。
- 发布失败默认保留草稿/旧活动版本，按幂等requestId检查回执；不得自动恢复整个数据库。若需撤回/切换release，先给出具体影响与操作目标并获授权。
- 新声线/自然语速质量、L105个人姓名能力未覆盖，须如实记录，不能用“CEFR已达标”包装。
- 如果实际schema无法表达本文件选定的有限课型，或正式目录接入需要新架构/迁移，标记 needs-planning 并记录具体矛盾；不要前端兜底造假能力。

## Execution notes

- 规划轮：只读检查并新增本交接文档；没有改产品代码、没有运行新验收、没有重启或发布。
- Luna开始时改为in-progress；每完成一条才打勾并补命令/日期/结果、隔离路径与证据路径。
- 2026-10-23执行：Status改为in-progress。运行 `node scripts/build-expression-course.mjs` 成功；`node --test src/expression-course/ui/entry.test.mjs src/expression-course/core.test.mjs server/services/expression-course/session.test.cjs server/services/expression-course/unit01.test.cjs e2e/expression-course.test.cjs` 17/17通过（含旧合成课程e2e）。此结果未验证真实两课音频的浏览器播放、页面流转/响应式、实际两课 HTTP 发布/学习；验收产物尚未生成。
- 2026-10-23继续执行：新增 `e2e/expression-unit01.test.cjs`，通过独立随机端口/temp数据目录上传实际包内音频、建立隔离草稿、hash校验并发布到隔离服务；学员从正式 expression-learn 页面启动L101，点击示范，Playwright Chromium 解码并播放实际 WAV（duration>0、currentTime>0）；完成引导步；检查桌面及360px窄屏无横向溢出。`node --test e2e/expression-unit01.test.cjs` 1/1通过。临时DB/应用目录在测试完成后只清理所分配的temp根。
- 2026-10-23 排查并修复实际播放器缺陷：`playAudio()` 在 audio.play() 返回后提交 audio_played，通用 `act()` 曾重建题目DOM。用户紧接着选项时会出现按下状态与提交回调交错，浏览器实测服务器收到 `{}`，因此一直停留“再试一次”。现对 audio_played 仅更新状态提示，不重建题目；e2e逐题断言 aria-pressed 对应 optionId 已到服务端，并完成L101后跳转L103。`node --test e2e/expression-unit01.test.cjs` 1/1通过。
- 2026-10-23继续执行：测试暴露“音频播放回执保存期间仍可点击继续，但点击因 busy 被静默忽略”的交互缺陷。`entry.mjs` 现于保存期间禁用所有页脚按钮，并在保存结束后恢复；e2e等待音频回执后才操作下一步。
- 2026-10-23继续执行：复习卡从L103页点击时，`beginSession` 曾使用页面闭包内的L103启动权限和会话，而复习数据指向L101。现将目标lessonId显式传入权限/会话请求，并将标题切换至被复习课节。隔离真实包e2e先把仅临时测试账号的到期时间置为到期，验证L101复习从L103入口进入且完成后不跳课。
- 2026-10-23继续执行：实际包E2E加入实际音频403模拟，确认可恢复提示、未推进且未发送已听动作，重试成功；持久化保存938px/360px完成页截图至验收目录。
- 2026-10-23继续执行并闭环回归：实际音频403验证不推进，答案键由服务端状态断言不暴露；桌面/手机截图已保存。修正合成E2E的自动提交旧断言；确认账号切换失败仅由测试init脚本反复覆写第一账号token导致，改为只初始化一次。`node scripts/build-expression-course.mjs`通过；六文件组合19/19通过。步骤1仍待人工音频/教学内容确认、实际音频网络中断场景，及键盘可达/下一课换行复核。
- 2026-10-23完整回归：`node scripts/build-expression-course.mjs` 成功；`node --test src/expression-course/ui/entry.test.mjs src/expression-course/core.test.mjs server/services/expression-course/session.test.cjs server/services/expression-course/unit01.test.cjs e2e/expression-course.test.cjs e2e/expression-unit01.test.cjs e2e/expression-unit01-complete.test.cjs` 21/21通过。包含管理员UI单活动修订、旧release不变、真实音频403/网络中断恢复和五课正式播放器。五课包v2共42个活动（L101–L105分别9、8、7、8、10步）、34条音频；包SHA-256 `5476c3dd712cb1af88505f865a68507a28203fe5c24f905a7da93f5bb640029a`，原14条音频与已验收包逐项相同，新增20条TTS使用Microsoft Zira Desktop。`validateExpressionPackage({forPublish:true})`通过。所有发布/学习测试只在独立临时数据目录与隔离端口运行；没有重启8787或发布到真实目录。
- 2026-10-23用户审核通过：新增L102/L104/L105内容、音频和五课顺序；同时要求所有本计划上线课程支持后续逐条修订。核查发现管理员界面已能复制已发布课程为私有草稿，修订JSON中的单个条目，重新校验/审核并创建新release；既有release不可变、未完成会话固定原release。将合成课程E2E改为真实管理员UI完成只修改L001_A04一个活动的版本修订，并断言其余课程内容未变、旧release内容保留；`node --test e2e/expression-course.test.cjs` 1/1通过。此能力确认范围是表达课程；未推断所有其他历史课程类型均支持同样流程。
- 2026-10-23补齐实际音频断网恢复验收：在独立正式播放器对真实L101 WAV请求先模拟403、再中断网络，断言课程停在当前步骤且没有发送“已听”回执；重试后浏览器成功解码并播放。`node --test e2e/expression-unit01.test.cjs` 1/1通过；只改隔离测试，无真实账号或目录写入。
- 2026-10-23发布前检查：复核批准的五课包SHA-256与验证报告；只读检查8787健康、管理员表达课路由和目标SQLite现状（旧release `r-d64091887a4d1bc7207b`仍在，未见五课发布）。使用SQLite在线备份API创建 `server/backups/chunklab_before_expression_publish_20261023T070658Z.db`，`PRAGMA integrity_check`为`ok`。用户随后打开 `/admin.html`，但 `@oai/sky` 与浏览器控制运行时均报 `failed to write kernel assets: 系统找不到指定的路径`，因此无法检查该页面的登录状态或通过UI操作。命令行请求未携带管理员会话（HTTP 401）。发布请求尚未提交：未重启服务、未写真实目录、未改变个人账号或学习记录。恢复条件是浏览器控制恢复且管理员界面可用；不得以读取/提取token或密码替代。
- 用户确认管理员页面已登录后重试：浏览器控制运行时再次以 `failed to write kernel assets: 系统找不到指定的路径` 失败；Playwright CLI只能启动独立会话，无法复用当前已登录标签，故没有通过新会话重复登录或索取密码。管理员API发布尚未调用，其他安全边界保持不变。
- 用户在表达课程制作页导入课程JSON、上传音频并检查通过。只读核对最新服务端草稿与获批文件完全一致：`expression-unit01-tools`、标题“零基础入门：学习指令、问候与求助”、课节L101–L105、34个资源，package JSON SHA-256对应批准候选包；校验摘要为 `9483cbf619f77374d46a56c559a7b80cbcd0d0ffc895de457f7228d6936af1a3`。页面下方旧草稿“表达喜欢：饮品”是另一条L001草稿，不是本次新草稿。此刻只待对已批准摘要执行“确认审核”并“发布到课程目录”；发布尚未发生。
- 执行顺序：1验收 → 2申请发布批准；等待时可做3 → 获批后2发布 → 交付三课待审包。除发布/新增内容审核/实质架构阻塞外连续推进，不以每个小补丁为一轮结束点。
- 不要另建聊天、自动切换模型、调用其他模型冒充Luna；用户切换后回复“继续执行”即开始实施，无需再次确认模型。
