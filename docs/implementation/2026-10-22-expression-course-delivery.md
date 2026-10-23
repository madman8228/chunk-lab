# 零基础表达课程与场景课程：解耦接入及内容生产实施方案

- Status: in-progress
- Updated: 2026-10-22
- Branch/worktree: `stabilize/p0-1-20261021` / `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `400f67b4270ed29ee42f1cdf6a6806c82dce0cfb`；下文记录已核实的相关改动。
- Planner: GPT-6 Astra（工作流规划角色；环境没有提供主任务模型选择的确认，已提示用户选择）
- Executor: GPT-5.6 Luna

## Objective

在现有系统中增加独立的“表达课程”类型，交付一个可从现有课程目录进入的完整纵向切片：制作指令 → 导入 AI 结果 → 校验与预览 → 管理员审核发布 → 学习 L001“表达喜欢” → 中断恢复 → 独立表达结果 → 到期复习。

本次执行完成下述 P1 全部验收后停止。P2/P3 为后续路线，不随“继续执行”自动扩大范围。产品接入和生产能力必须完成；真实课程上线需要负责人另行明确批准，不以实现发布按钮代替该批准。

## Current state and evidence

### 参考资料和性质

- `ref/零基础开发方案/v1.0/zero_english_course_agent_pack/`：总方案、任务书、验收清单、`contracts/lesson.schema.json`、L001/L002/L003 样例及 Python 校验器。
- v1.0 是开发规格，不是本仓库已存在的教学运行器。课程有七种活动；样例音频为 `needs_generation`，不能原样发布。
- `ref/零基础开发方案/v1.1/01_场景英语课程扩展设计.md` 与 `02_示例场景数据草案.json`：场景课程增量设计。后者 `schemaVersion=scenario-proposal-0.1`，只是草案，不能当作正式导入规范。
- v1.1 所谓“复用旧引擎”指它设想的 v1.0；项目仍需实现对应表达教学能力。

### 已核实的代码边界

| 当前文件 | 已有行为 | 实施结论 |
|---|---|---|
| `src/course-authoring/course-types.mjs` | 制作类型为 sentence / imageText | 不让新课程伪装成旧 sentence 草稿 |
| `src/course-authoring/learning-contract.mjs` | sentence-practice v1，只支持 typing / chunkSelection | 不在旧模板中塞七种新活动 |
| `src/main/course-learning-policy.mjs` | 句子、文章、对话的顺序和输入策略 | 保留旧行为 |
| `landing/guided-sentence-view.js`、`js/vocabulary-course-contract.js` | 已有中文引导表达及单词练习 | 借鉴交互，不复用其单词统计副作用 |
| `src/learning/native-course-session.mjs` | 受控课程会话、分批加载、只读预览 | 不把表达课程投影为旧 deck |
| `src/membership/learning-session-controller.mjs` | 开始、心跳、暂停等权限会话生命周期 | 复用权限会话，教学会话单独保存 |
| `server/services/membership/course-access-service.js` | 目录、权限、免费/会员/试用、start/read/asset | 复用授权判定，不新增平行计费规则 |
| `server/services/membership/content-registry.js` | 限定 sentence / image-text、特定 contentRef、静态分片格式 | 通过组合适配器接入新类型，不放宽旧校验器 |
| `server/services/membership/static-fragment-builder.js` | 固定句子/图文投影和批大小 | 表达课程不能直接使用这个编译器 |
| `server/routes/course-publishing.js`、`course-publisher.js` | 已有管理员制作和发布，但编译输出依赖 items / utterances | 新发布服务独立，复用 adminOnly 和现有权限配置 |
| `server/services/course-library-schema.js`、`server/routes/course-library.js` | 账号角色、deck/course 导入、不可变版本 | 不借账号导入路径发布系统内置表达课 |
| `src/learning-workspace/resource-model.mjs` | 资源类型与 sourceRefs 白名单，默认活动映射为 chunks | 增加明确的 expression-course 引用与标签 |
| `main.html` | 约 5355 行按 protected-course 分发且加入在学；约 7946 行处理原生学习入口 | 新增专用分发，不落入句子启动流程 |
| `scripts/build-app.mjs`、`scripts/build-learning-workspace.mjs` | esbuild 生成浏览器包 | 新模块加入生成链，不手改生成 JS |

### 工作树保护

工作树有大量用户改动和课程资产。相关已修改文件包括 `main.html`、`server/index.js`、`server/services/membership/content-registry.js`、`server/services/library-catalog.js`、`src/learning-workspace/resource-model.mjs`、`src/learning-workspace/facets.mjs`、`src/main/entry.mjs`、`src/learning/native-course-session.mjs`、`src/learning/platform-course-source.mjs`、`scripts/gen-sw.js`。独立课程库 routes/services/schema 等仍是未跟踪文件，必须视为现有用户成果。

执行前只比较上述集成点和本方案新文件的变化，不回退、不覆盖、不整理其他修改。上述行号仅为定位提示。不得用整文件替换把已有改动抹掉。

## Assumptions and decisions

1. 学习对象先限定中文母语成人零基础；幼儿直接学习、实时 AI 对话、自动口语评分不进入 P1。
2. 使用当前 Node/Express/SQLite、原生页面与 esbuild，不增加框架、不创建平行项目。
3. 采用组合适配：独立课程格式、运行器、学习表；共用账号、权限服务、目录和主题。新增模块出错时只让新课不可用，旧课仍能使用。
4. 首期正式课程仅为 L001。七种活动均实现并以合成用例验证；L002/L003 作为格式兼容性草稿，不在本轮补全发布内容。
5. 管理端导入和编辑为“粘贴/选文件 → 自动校验 → 预览 → 修订后重导入”。不做逐字段大型表单，不做回收站，不把草稿自动发布。
6. 已发布课程版本不可变。下架只移出发现列表，已有学习者仍可按权限访问历史版本；永久删除已发布内容不在本轮。
7. 首期允许录音自检入口延期：标准输入为词块和文字；Schema 中已有 `record_self_check` 可以提示当前仅支持文字，不能显示虚假的口语通过。
8. 权限过期时不能继续新题；已提交结果保留。首期不承诺完整离线学习，不引入新的离线同步队列。
9. 计划不执行真实发布、加入账号、修改学习记录、重启当前服务、部署、提交或推送。开发验证全部在新临时目录和独立端口。

### 为什么不直接转成句子列表

转换可快速展示句子，却会丢掉活动阶段、提示暴露、听力题和独立迁移，后续场景回合也无处存放。根因是课程契约与学习状态不足，应由新课程领域模块及后端判定解决，不以主页面补丁模拟。代价是新增专用状态和测试；收益是旧课程不用迁移，新课程可通过数据持续生产。

## Scope

### P1：本交接唯一执行范围

- L001 教学流程、七种活动渲染器、服务端判定、提示与答案暴露、中断恢复、复习。
- 独立表达课程管理页：制作指令、JSON 导入、草稿 CRUD、真实播放器预览、按哈希审核、版本发布、下架。
- 系统目录、课程详情、加入在学、继续学习、返回来源、到期复习入口。
- 管理发布使用合成课程和合法测试音频在隔离实例验证；真实 L001 保持可审阅草稿。
- 不修改旧课程格式；原有句子、单词本、图文、账号切换、权限和保存路径回归。

## Out of scope

- P2：完善 L002/L003，自录自检，批量生产，更多能力课程。
- P3：v1.1 场景 Schema/运行器、三个洗漱事件、微课返回、多轮任务、速查；后续机场/餐厅迁移验证。
- P4：幼儿 listen_act、ASR、实时自由对话、复杂动画。
- 全站课程格式统一重写、账号课程迁移、清理历史资产、实际付费音频调用、正式发布课程。

## Contracts and data changes

### 1. 内容契约

新增 `src/expression-course/lesson.schema.json`，从参考 v1.0 Schema 复制并保留原 1.0 语义，使用 Ajv 2020 校验。参考目录只读。新增规范以本目录为权威；不使用通用“接受任何 JSON”兜底。

新增外层 `expression-package.schema.json`：

```text
format: chunklab-expression-course
formatVersion: 1.0
courseId: stable string, expression- 前缀
title / description / audience: adult_beginner
lessons: v1.0 Lesson[]
assets: [{assetId, mimeType, sha256, size, localFile}]
reviewActivities: [{lessonId, skillId, activity: independent_output|transfer_test|listening_choice}]
```

- Lesson 保留 lessonId/contentVersion/activities/audioAssets/reviewPlan。嵌套 ID 用 `(courseId, lessonId, activityId)` 命名空间，不能依赖全站 L001 唯一。
- 外层生产版本由服务器生成 `releaseId`，正文内容哈希 `contentHash` 包括资源哈希。导入的 reviewed/published 字段不授予发布权。
- 初期限制：单 JSON 2 MiB、每包最多 20 课、每课最多 100 活动、每字段长度受 Schema 约束；音频单资源 5 MiB、每包 50 MiB。超限明确反馈，不截断。
- 导入素材仅允许文件上传到受控存储；拒绝绝对路径、目录穿越、脚本、任意远程 URL 和供应商密钥。哈希由服务器重算，不相信客户端声明。
- reviewActivities 至少提供两个独立的新组合供轮换；不要反复复用刚展示答案的题来宣称再次独立掌握。首期 L001 复习只使用已介绍词汇。
- 七种 type：meaning_intro、micro_explanation、sentence_build、substitution、listening_choice、independent_output、transfer_test。未知类型阻断，不当普通句子降级。

语义校验：ID 唯一、引用存在、先修无环；听力含正确选项和音频；迁移至少一题；用于迁移的标准句不得已在前置示范完整出现；独立阶段无英文答案/首字母提示；接受答案归一化后不冲突。自动泄露检查只能覆盖明确文本，语义歧义仍须人审。

### 2. 新表与版本

在现有配置的 SQLite 中仅追加表，文件 `server/services/expression-course/schema.js`。不得在真实数据库做实施验证。

| 表 | 主键/关键字段 | 规则 |
|---|---|---|
| expression_courses | course_id, title, active_release, status | 系统内置；status=active/unlisted，无个人 owner |
| expression_drafts | draft_id, revision, payload_json, updated_by, updated_at | 仅管理员写，乐观锁 |
| expression_releases | course_id+release_id, content_hash, content_json, review_hash, created_at | 不可变；活动答案保留在服务端 |
| expression_assets | sha256, mime_type, byte_length, bytes | 服务端 DB/BLOB 保存，首期无需文件系统和 DB 双写事务 |
| expression_release_assets | course_id+release_id+asset_id, sha256 | 绑定固定版本 |
| expression_sessions | session_id, user_id, course_id, release_id, lesson_id, mode, revision, state_json | mode=learn/review；记录首次尝试和提示暴露 |
| expression_attempts | user_id+request_id, session_id, payload_hash, result_json, created_at | 幂等；同 ID 异内容返回 409 |
| expression_skill_states | user_id+course_id+release_id+skill_id, status, due_at, review_step, evidence_json | 首期不跨版本继承掌握 |
| expression_admin_receipts | admin_id+request_id, payload_hash, result_json | 草稿/发布/下架请求幂等 |

事务内完成 attempt、session revision、skill state 更新和 receipt；失败全部回滚。响应丢失后重试原 requestId，不能跳过未确认步骤。版本号冲突返回当前 revision 和恢复入口，不覆写另一标签页状态。

发布同一哈希重试返回原 receipt；修订发布新 release，老 session 固定原 release；新学员默认 active_release。首期只在“从新版本重新开始”明确操作后建立新会话，不自动迁移旧进度。下架不删除 release、assets、attempts。

### 3. 目录与权限组合适配

新增 `server/services/expression-course/registry-adapter.js`，组合原 `ContentRegistry`，不修改原句子/图文 Schema 和编译器。

- 原 registry 负责旧内容。表达 provider 从 expression 表提供 metadata、当前 release 和资产。
- 组合对象实现实际消费的方法：snapshot/list/course/publicCourses/references/load/asset/blockedPath/blockedDeck/fragmentScope/file。旧类型完整委托；file 和旧片段操作仍只由旧 registry 处理。
- expression 类型不声明旧 fragments，`contentRef.type=expression-lesson`，`contentType=expression`；load 返回可显示的当前活动数据和 assetIds，不含 evaluation/正确选项/未来答案。
- `snapshot().version` 对旧版本摘要和表达活动发布摘要共同取哈希。新课发布使元数据缓存失效。publicCourses 隐藏下架课；course(id) 仍能解析下架课以恢复已学会话。
- `fragmentScope` 对 expression 返回明确“不支持该入口”，不得颁发旧静态片段授权。表达内容与音频经专用路由检查现有 courseAccess.authorize。
- `courseAccess.start` 保留现有免费/会员/试用规则和心跳计时，表达学习页面复用 LearningSessionController。其权限 sessionId 与表达教学 sessionId 分开，禁止混用。
- `server/index.js` 只在注入处组装新 registry、服务与 routes；保留旧 publisher 对原 registry 的文件操作。不要把表达元数据写回旧 registry.json。
- `catalogResources` 为 expression 输出 sourceRefs=[{type:'expression-course',id:courseId}]、activities=['expression']，其余旧类型不变。
- `resource-model.mjs` 接纳新引用与标签；main.html 的资源点击先检查 expression-course，经现有加入在学动作进入新学习页。用户启动时加入在学，不由管理员发布自动加入任何账号。
- 审核现有会员管理、旧测评、source review 对 registry 的遍历：新课必须按 contentType 分发或明确不支持，不能落入 image-text 的默认 else。旧测评不接受 expression 教学会话。

### 4. API

新增 `server/routes/expression-courses.js`，沿用 auth.authenticate/adminOnly/统一错误响应与 no-store。以下均为待实现接口。

| 接口 | 输入/输出与约束 |
|---|---|
| GET /api/expression-courses/:id | 元数据、当前版本、课纲；不返回答案 |
| POST /api/expression-sessions | courseId, lessonId, releaseId?, mode, requestId, accessSessionId；恢复已有未完成会话或创建，返回 session revision/current activity |
| GET /api/expression-sessions/:id | 本账号会话快照；按固定版本恢复 |
| POST /api/expression-sessions/:id/actions | requestId, expectedRevision, action, payload；服务端推进并返回确认状态 |
| GET /api/expression-reviews/due | 仅本人到期能力和对应学习入口 |
| GET /api/expression-courses/:id/releases/:release/assets/:assetId | 验证账号、课程权限、会话及活动资源范围后返回音频 |
| GET/POST /api/admin/expression-drafts | 列表/创建；创建返回 draftId/revision |
| GET/PUT/DELETE /api/admin/expression-drafts/:id | 读取/更新/删除草稿；更新和删除带 expectedRevision 与 requestId |
| POST /api/admin/expression-drafts/:id/validate | 结构、语义、资源问题及 contentHash；不批准发布 |
| POST /api/admin/expression-drafts/:id/review | 审核者对具体 contentHash 确认；重改自动失效 |
| POST /api/admin/expression-drafts/:id/publish | expectedRevision/contentHash/requestId；事务创建 release 和切换 active_release |
| POST /api/admin/expression-courses/:id/unlist | 仅下架，幂等；历史记录可读取 |
| POST /api/admin/expression-assets | 文件上传/受限编码载荷，实际 MIME/大小/hash 校验 |

actions 白名单：continue、submit、hint、reveal、skip_audio、audio_played。客户端不提交 correct/mastery/dueAt；服务端从版本正文判定。校验当前活动、允许动作、所属账号、revision、权限和请求长度。伪造未来活动请求拒绝。

预览使用相同纯 runtime 和 renderer、独立内存仓储，管理员草稿内容才可全量读取；不调用学习写 API，不计会员试用，也不写真实成绩。

### 5. 教学状态、判定与复习

- runtime 纯函数 `transition(state, action, lesson, now)`；统一渲染器接口 render/activity/onAction/dispose。audio、network、storage 通过少量注入接口，避免框架化。
- 阅读页 continue 仅计流程。submit 保留首次答案；提示/答案暴露一旦发生，本题后续正确只算指导练习。
- 不正确最多三次后提供指导重试/继续，安排待练习，不能无限困住学习者。
- 归一化仅含 Unicode、空白、大小写、句末标点、弯撇号；don't 与 do not 由 acceptedAnswers 显式允许；不做全局语义等价猜测。
- 听力隐藏英文字幕和正确选项标记；播放失败提供重试或 skip_audio，跳过不计正确。audio_played 只表示客户端报告播放，不能宣称验证真实听到。
- 独立掌握必须结合未暴露答案的首次独立输出与迁移，听力结果单列。流程完成可以存在未掌握项。
- reviewPlan 默认 1/3/7/14/30 天；首次独立成功安排 +1 天，到期独立成功推进间隔；失败/揭示答案回到 +1 天，可提供一次补救但不覆盖首次失败。
- 服务端 now 决定 dueAt；测试注入 clock。页面按用户时区展示。跨版本/跨课共享能力留至 P3，不把同名 skillId 自动合并。
- 网络失败保留输入并提示重试；确认响应前不自动进入下一题。刷新以服务端已确认进度恢复；未提交输入不承诺跨设备恢复。

### 6. 页面与内容生产

新增 `expression-learn.html`：复用现有主题与导航，URL `?course=<id>&lesson=L001`，恢复可带 `session=<id>`。返回保留来源参数。桌面和 360px 手机均可触控操作，IME 不误提交。

页面：简洁顶部返回/标题/步骤进度，中央一个活动，底部一个主要操作及必要的提示/播放。结果页分别展示完成流程、独立表达、听辨、待复习。不要大面积卡片嵌套、自动播放或夸大的分数。

新增 `expression-create.html`（管理员制作入口）：复制指令、粘贴/导入、错误定位、实际播放器预览、保存草稿。列表提供编辑/删除草稿和查看已发布版本；只有校验与审核完成显示可用发布动作。登录不具备 admin 权限时清楚显示不可维护，不泄露草稿。

新增 `src/expression-course/authoring/prompt.mjs`：指令包含当前 Schema、教学流程、先修限制、中文母语定位、自然度、答案泄露规则、音频占位规则及修复输出要求；用户上传资料给外部 AI。工具仅输出指令，不调用外部付费模型。

生产步骤固定：确定能力和已知词汇 → 外部 AI 生成候选 → 本地校验 → 人工试学修订 → 补音频 → 哈希绑定审核 → 管理员发布。编辑已发布内容先复制为新草稿，不原地改正文。

L001 原样例为 9 活动；保留其迁移思路，同时补充复习池和验证覆盖七类型的合成例子。真实音频待负责人确认来源后补齐；缺音频草稿可预览并标记缺失，发布必须阻断。浏览器 TTS 可作非评分试听，但不能冒充可验证的生产音频。

首期不生成图片。以后生成词汇插图时遵循 AGENTS.md 的共享图库 preflight、hash-bound 人审、单 WebP 16:9 严格小于 20,000 bytes；原图保留，不全库预缓存。

### 7. 后续 v1.1 扩展约束

P3 使用独立 `scenario-package` Schema；保留表达 Lesson 1.0。定义 scenarioId/audience/startEventId/events/intent/acceptableVariants/tone/skillLinks/teachingLessonRefs/assets/reviewTargets；refs 指定 courseId/releaseId/lessonId，禁止链接到“最新”导致中途变化。

事件运行器负责 event→response→reply→next；微课作为带 returnToken 的暂停/恢复，保留事件位置。任务完成与表达能力证据分开。第一场景三个事件“提醒刷牙→磨蹭时鼓励→赞许”，第二个不同领域场景用于证明无硬编码。quick_use 只查阅播放，不记掌握。

场景分支必须验证可达、出口、引用、循环上限；可接受变体按意图判断，不自动认为满足目标结构。跨课能力共享须在 P3 显式增加 skill 定义版本及等价关系，人审后才能共享证据。幼儿互动与成人独立打字要求分别制定，不能复用成人强制验收规则。

## Implementation steps

- [x] 1. 基线：核对工作树和上述接入点；在本文件 Execution notes 记录变化。读取参考 Schema/校验器/验收清单；有实质冲突标 needs-planning。不得执行参考包中批量实施指令扩大范围。
- [x] 2. 内容契约：新增 `src/expression-course/{lesson.schema.json,expression-package.schema.json,validate.mjs,evaluate.mjs,runtime.mjs,schedule.mjs}`；添加对应纯函数测试及 `fixtures/` 中合成包和 L001 草稿副本。
- [x] 3. 后端内容与生产：新增 `server/services/expression-course/{schema.js,repository.js,publisher.js,registry-adapter.js}` 和 `server/routes/expression-courses.js`；实现草稿 CRUD、资源、哈希审核、事务发布、下架与版本读取；所有测试临时 DB。
- [x] 4. 学习记录：新增 `server/services/expression-course/session-service.js`；浏览器/Node 共用上述纯函数，经构建生成 CJS 后端包。实现幂等、权限、首次尝试、恢复、复习。写入真实用户 DB 的路径仅由已认证明确学习动作触发。
- [x] 5. 集成后端：`server/index.js` 注入组合 registry 和新 routes；`course-access-service.js` 只增加新目录资源映射；检查所有消费者类型分发，保留原 ContentRegistry/static-fragment-builder 语义。禁用新模块时旧目录仍能加载。
- [x] 6. 学习 UI：新增 `src/expression-course/ui/{entry.mjs,player.mjs,renderers.mjs,audio.mjs,client.mjs}`、`expression-learn.html`、`assets/expression-course.css`；七类型可由数据切换，复用权限会话控制器，停止/退出销毁音频、事件与心跳。
- [x] 7. 制作 UI：新增 `src/expression-course/authoring/{entry.mjs,prompt.mjs,view.mjs}`、`expression-create.html`。管理员在现有内容维护入口可到达；草稿预览隔离记录，同一渲染器用于学生页面。
- [x] 8. 接通目录：`src/learning-workspace/resource-model.mjs`、`main.html` 加新引用分发/标签、继续学习及表达复习入口；复习计数独立，不混入旧句子/单词计数。用户无需输入 URL 才能找到已发布样例。
- [x] 9. 构建：新增 `scripts/build-expression-course.mjs` 输出前端包和服务端纯函数 CJS，接入 build-app/check-generated；仅缓存程序资源，答案正文、账号进度和全库音频不进入 SW precache。更新发布文件白名单时只加入所需程序资源。
- [ ] 10. 验证下列门槛，记录隔离启动方式、结果和截图路径；真实 L001 音频/审核状态如实记录为待发布内容，不阻断已完成的工程功能验收，不得称已上线。

## Validation

规划阶段没有运行测试。以下新增测试由执行者实现；不要把命令列表当作已通过证据。

- [x] `node --test src/expression-course/*.test.mjs server/services/expression-course/*.test.cjs`：Schema、重复/无效引用、泄露、七活动、答案归一化、首次表现、时钟和间隔、草稿/发布与复习服务测试通过（13 项）。
- [x] `node --test server/services/expression-course/session.test.cjs server/services/expression-course/repository.test.cjs server/services/expression-course/registry-adapter.test.cjs`：隔离临时 SQLite；草稿 revision、审核失效、音频缺失发布阻断、发布/下架、会话权限、复习和请求幂等通过（4 项）。另加相同 requestId 重放断言，确认只写入一条 attempt。
- [x] `node --test e2e/expression-course.test.cjs`：测试内部 mkdtemp、隔离端口和独立 Playwright context；临时生成 PCM WAV 音调用于验证浏览器解码/播放启动，不能代表真实教学录音。另验证答案揭示后刷新恢复。
- [x] 浏览器路径一：管理员 UI 导入→校验失败→修订→上传音频→预览→审核→发布合成课；普通账号读取草稿返回 401。预览渲染器为信息型活动，本用例未断言预览中的音频播放。
- [x] 浏览器路径二：普通测试账号发现→加入→开始→拼句→播放 WAV→独立输出→迁移→完成；刷新后恢复并继续；模拟服务端处理后丢弃响应，重试复用同一 requestId，数据库仅一条 attempt。额外验证“显示答案”后刷新仍显示答案。
- [x] 浏览器路径三：揭示答案→刷新恢复→正确作答；运行时确认揭示后正确作答不算独立掌握。隔离浏览器实际进入到期复习并作答；服务端注入时钟测试到期和失败后次日重排，不依赖浏览器改时钟。
- [x] 服务端版本路径：发布新版本后，未完成会话按固定旧 release 恢复；原 release 和学习状态保持不变（隔离 SQLite 回归测试）。
- [x] 浏览器版本路径：学习中发布新版并刷新，旧会话仍回到原步骤，且实际显示旧版本提示文案。
- [x] 浏览器账号/窄屏路径：学习页加载全站 `account-storage.js`；两个隔离账号间切换后旧账号未提交输入不可见，新账号页面重新初始化；360px 无横向滚动。
- [x] 权限过期服务端路径：到期后拒绝读取/提交，最后一次确认的 revision 与 attempt 保留；学习页对常见权限过期码显示“已完成步骤保留、当前答案尚未提交”的明确提示。
- [x] 浏览器路径余项：学习输入框可键盘聚焦；模拟 compositionstart/input/compositionend 事件后答案正常提交；权限到期提示明确且未提交答案保留，模拟权限恢复后可重试。模拟 IME 事件不等同真实操作系统输入法测试；下架后旧 release 与记录保留已有 repository 隔离测试。
- [x] 回归 `node --test src/learning-workspace/workspace.test.mjs src/learning/native-course-session.test.mjs src/membership/learning-session-controller.test.mjs`（8 项通过）。
- [x] 回归 `node --test server/services/membership/static-fragment-builder.test.js server/services/membership/content-registry-cache.test.js server/services/membership/course-publisher.test.js`（3 项通过）。
- [x] 回归 `node --test server/membership-content.test.js e2e/membership-platform-fragments.test.js`；分别执行且通过。后者隔离临时目录/端口，验证真实 fragment HTTP routes，不代表整站浏览器或生产激活。
- [x] `node scripts/build-expression-course.mjs`、`node scripts/build-app.mjs`、`node scripts/check-generated.mjs`、`node scripts/gen-sw.js`、`node scripts/check-sw.js` 均通过；`node scripts/check-deploy-files.js` 未通过，发现 textbook-production 部署白名单/运行时文件不一致，作为既有无关问题保留，未改动。

## Acceptance criteria

- [x] 从现有发现页和我的内容实际进入新学习页；旧三类课程照常启动，不能只交付孤立 demo。（隔离浏览器确认发现/在学导航、明确加入和 360px 页面宽度；旧流程有回归覆盖。）
- [ ] 同一播放器通过 JSON 处理七类活动；L001 闭环包括有效听力行为、独立迁移和可恢复状态。（七类服务端/运行时测试和播放器路径通过；合成 WAV 是音调而非英语语音，真实听力教学尚未验证。）
- [x] 新课程生产无需改播放器代码：外部 AI 指令、导入、校验、预览、修订、审核、发布完整可用。（浏览器端以临时合成课程完成导入→校验错误→修正→预览→审核→发布；真实教材内容不在测试范围。）
- [x] 草稿可增删改查；发布版本不可变；下架保留学习证据；无回收站实现。（仓储测试通过。）
- [x] 系统课程目录为发布目标，不写入管理员个人课程，不自动替任意账号报名。（使用合成包在隔离系统目录验证；显式开始后才加入测试账号。）
- [x] 成绩来自服务端固定版本判定；暴露答案、重复提交、阅读继续、音频跳过不能伪造掌握。（纯 runtime 与服务端幂等/评估测试通过；答案揭示通过测试覆盖。）
- [x] 版本冲突、网络失败、账号切换、权限过期、非法资源都有明确结果，不丢已确认记录。（请求丢失重试、账号切换、非法资源、服务端权限过期不改已确认进度已有隔离覆盖；浏览器权限过期提示/答案保留/重试与旧版本继续会话均通过隔离浏览器验证。）
- [x] 复习实际可进入和作答，非只有 dueAt 字段；课程完成、能力掌握分开展示。（隔离测试库中创建到期项并实际作答。）
- [x] 真实课程/数据库/浏览器资料零测试写入；原 live service 未重启；正式内容仍待明确发布批准。
- [ ] 上述必要验证有结果，未完成项不能用截图或文案掩盖。完成全部 P1 后标 complete，P2/P3 不影响本轮完成判定。

## Risks and rollback

- 最大风险为旧 registry 消费者默认把非 sentence 当 image-text；组合适配必须逐个覆盖已列集成点并测试，禁止只改枚举。
- 新课程目录出错不能使整个旧目录失败：表达 provider 捕获自己的不可用状态，返回明确不可用项/管理错误；旧 registry 原有错误仍按原逻辑暴露，不吞掉所有异常。
- 后端权限 session 与教学 session 是两种记录；免费课程可能无计费 sessionId，不能因此拒绝其教学持久化，会员课程仍必须授权。
- 新数据库表属于新领域状态，不塞入旧 mem 快照；账号导出/删除等跨账号生命周期代码需纳入检查，在实现中给新表加入对应导出和经授权删除处理，禁止让旧 snapshot restore 覆盖新记录。
- 课程目录及新表可能引起备份/恢复覆盖缺口：现有完整 SQLite 备份保留新表；旧账户快照恢复不清新表。新增记录导出只读，不借本任务执行真实恢复。
- 功能开关 `EXPRESSION_COURSES_ENABLED` 默认关闭；隔离验证开启。关闭只隐藏新入口并拒绝新会话，保留表和资源；不执行 DROP，不删除数据库和课程。正式启用为后续明确部署动作。
- 回滚使用关闭功能入口/恢复本次接线代码，保留新增数据供后续恢复；不对脏工作树使用 reset/checkout。若将来需要真实迁移，先使用 SQLite 一致性备份并记录目标。
- 若发现核心权限接口无法保持兼容，或现有并行改动改变上述契约，标 needs-planning，记录具体文件与冲突，不暗自重构全站。

## Execution notes

- 2026-10-22：执行完成步骤 1–9；工作树包含大量并行用户改动，未清理或覆盖。表达课程使用独立类型、组合 registry、独立草稿/发布/学习表，功能开关默认关闭。
- 2026-10-22：前端同一会话/版本/动作的网络重试复用 requestId；网络失败后重新启用主操作按钮。服务端隔离测试补充相同 requestId 重放只产生一条 attempt 的断言。
- 2026-10-22：播放器此前未发送已定义的 `audio_played` 客户端事件；现于浏览器 `Audio.play()` 成功后上报。该事件只代表播放启动，不代表验证用户听到或理解。
- 2026-10-22：`node --test e2e/expression-course.test.cjs` 通过。临时目录/隔离端口中完整跑过管理员制作 UI（含校验失败修订、WAV 上传、预览、审核、发布）、普通用户权限拒绝、发现加入、9 步学习、播放启动上报、刷新恢复和服务端提交后响应丢失的同 requestId 重试；数据库只记录一次该作答。
- 2026-10-22：纯函数/表达服务共 17 项、工作区/学习会话 8 项、旧 registry/publisher 3 项及 membership-content 隔离服务 1 项通过；表达包/整站构建、生成物检查及 Service Worker 检查通过。
- 2026-10-22：隔离浏览器完成发现→显式加入→表达播放器导航与 390px 无横向滚动检查；合成 PCM 音调可被浏览器解码并触发播放启动事件，但不是英语语音，也不能证明真实听辨教学有效。
- 2026-10-23：答案揭示状态由服务端持久化后，播放器现显示参考答案并在刷新恢复；继续到下一题时清除。新增运行时断言确认未揭示前不泄露、揭示后可恢复。`node --test src/expression-course/*.test.mjs server/services/expression-course/*.test.cjs` 共 14 项通过；`node scripts/build-expression-course.mjs` 与 `node scripts/check-generated.mjs` 通过；更新后的隔离浏览器端到端测试通过，且到期复习通过第二个账号之外的同一合成账号实测。
- 2026-10-23：账号切换用例尝试在两个浏览器页间改写认证态，观察到登录记录兼容镜像字段短暂不一致，无法稳定验证播放器重载后的初始化；未保留未经验证的播放器监听代码。账号切换与发布新版本后的旧会话恢复仍列为待验，不据此声称已通过。
- 2026-10-23：进一步定位发现表达学习页未加载全站账号存储隔离模块；加入共享 `account-storage.js` 后，隔离浏览器双标签账号切换确认旧输入不再显示，新账号页面可重新初始化。将端到端视口收窄到 360px 并通过无横向滚动检查。
- 2026-10-23：新增服务端版本回归：发布新 release 后，同账号再次进入会恢复原未完成 session、原 releaseId 和当前位置。隔离测试通过。
- 2026-10-23：本轮相关验证 `node --test src/expression-course/*.test.mjs server/services/expression-course/*.test.cjs` 共 16 项、`node --test e2e/expression-course.test.cjs` 1 项通过；`node scripts/build-app.mjs`、`node scripts/check-generated.mjs`、`node scripts/gen-sw.js`、`node scripts/check-sw.js` 通过。构建/Service Worker 生成仍报告既有 `textbook-production.html` 缺失；此前部署清单也有 textbook-production 文件不一致，未在本任务范围内修复。
- 2026-10-23：补充权限到期回归，确认授权失效时读取和新提交均被拒绝，已确认 session revision/attempt 不变；播放器增加试用结束、每日额度、会员权限及授权到期的用户提示，明确区分已保存步骤与尚未提交答案。
- 2026-10-23：隔离浏览器补齐版本发布流程：学习者停在旧版第 4 步时，管理员通过草稿→校验→审核→发布接口发布新版；学习者刷新后仍回到旧 release 的旧提示文本。E2E 通过。
- 2026-10-23：隔离浏览器补齐权限与输入交互路径：输入框键盘聚焦正常；合成 composition 事件可更新答案；注入一次 `AUTHORIZATION_EXPIRED` 后显示保留进度/答案未提交提示，输入仍保留，随后重试成功。`node --test e2e/expression-course.test.cjs` 与 `node --test src/expression-course/*.test.mjs server/services/expression-course/*.test.cjs` 通过（16 项核心/服务测试）。真实 OS 输入法未实测。
- 2026-10-23：`node scripts/build-expression-course.mjs`、`node scripts/build-app.mjs`、`node scripts/check-generated.mjs`、`node scripts/gen-sw.js`、`node scripts/check-sw.js` 均通过；生成 Service Worker 时仍提示仓库已有 `textbook-production.html` 缺失，本次未扩大到教材生产改动。隔离测试始终使用临时数据目录/端口，live 8787 未重启、未更新；真实英语教学音频和课程内容仍待内容审核。
- 2026-10-23：按 P1 方案复核既有系统回归：学习工作区/原生课程/权限会话 8 项，旧目录注册与发布 3 项，membership 隔离 HTTP/权限流程 2 项均通过。P1 工程接入和隔离验证已完成；唯一未完成的验收是由负责人确认真实英语听力内容有效。不得用合成音调替代该审核，也未扩大到 P2/P3。
- 2026-10-23：负责人要求由助手直接生成课程及 TTS。基于现有 L001「表达喜欢」参考样例，创建独立待审包 `output/expression-course-drafts/L001-like-review-v1/`，保留原 9 活动内容并在副本中绑定本机 Windows `Microsoft Zira Desktop`（en-US）合成的两条 WAV（I like tea / I like coffee）。课程包校验通过，音频大小与 SHA-256 一致；不代表发音或教学审核通过。无外部服务/费用，未导入账户或发布。当前 live 8787 的表达管理 API 仍为 404；待负责人试听并审核后再决定接入/发布。
- 2026-10-22：`check-deploy-files.js` 仍失败：`textbook-production.html` 与 `scripts/serve-textbook-production.cjs`、`server/routes/textbook-production.js`、`server/services/textbook-production.js` 的部署白名单/运行时依赖不一致；这是工作树中并行的教材生产变更，本任务未修改。
- 2026-10-22：当日所有服务器/数据库测试使用新临时目录及隔离端口；真实课程、账户记录、原浏览器资料零测试写入。live 8787 未重启、未更新。未发布真实 L001；当日尚有英语听力、账号切换、授权过期等验收待办，后续状态见 2026-10-23 记录。
- 模型选择由用户操作；本文件的 Planner/Executor 描述工作流职责，不证明主任务模型已切换。
- 执行者填写：开始时间、实际基线偏差、已完成步骤、验证命令/结果、隔离预览 URL、剩余内容审核项、是否更新 live service。未真实执行的项保持未勾选。
