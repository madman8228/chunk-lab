# 个人学习工作台与分面内容库：Astra → Luna 执行交接

- Status: complete
- Updated: 2026-10-13
- Branch/worktree: master；D:/06-project/chunk-practice（复用当前工作区，不新建工作树）
- Base commit: 8e19498f3bd7a8d9d7776b7e02a074689d0b0f81
- Relevant uncommitted changes: index.html、main.html、api.js、auth-ui.js、core.js、js/account-storage.js、js/content-repository.js、js/course-enrollment.js、js/course-learning-launch.js、js/server-store.js、server/index.js、server/services/content-studio.js、课程/保存/首页测试已有修改；landing/*、vocabulary*.html、DESIGN.md、多份课程与插画相关文件未跟踪。它们均是现有工作，不得还原、覆盖或批量整理。
- Planner: GPT-6 Astra（技能指定的规划角色；已请求用户选择，工具未暴露当前主任务模型，未验证实际选择）
- Executor: GPT-5.6 Luna（用户手动切换；不自动派遣其他模型代替）

## Objective

交付一个可运行的个人学习工作台 M1：用户通过「发现」找到真实内容，收藏到「我的学习」，按现有加入机制启动课程，保存学习记录后从首页继续。背单词和 Chunk 是平等的学习工具；内容来源、适用人群、难度、目标、题材与练习方式分开管理。

M1 同时交付最小的内容分类维护入口，证明新增分类内容无需增加一级导航。它不是所有学习工具、教材授权内容和上万词内容库的一次性建设。以下 Implementation steps 和 Acceptance criteria 全部属于本次执行边界；后续路线不自动执行。

## Current state and evidence

| 已核对的位置 | 事实及实施含义 |
|---|---|
| AGENTS.md | 真实课程、账户记录、浏览器原始数据和备份不可擅自删除/覆盖；测试必须临时目录、独立端口；不得为测试重启真实服务。词汇插画每个格式严格小于 20,000 字节、按需加载。 |
| index.html；landing/home-learning.js；docs/home-learning-preview-2026-10-12.md | 根首页目前是单词/句子并列示例，新增示例无账户记录持久化，不能当个人首页数据源。 |
| main.html：refreshServerHomeProjection、createHomeCourseLookup、renderHome、decideEntry、showPage | 真实主应用已有账户确认投影、课程目录、显式加入课程、真实复习和课节续学。应在同一运行时增加个人工作台视图，不在 landing 页面重建保存体系。 |
| js/course-catalog.js；js/course-progress.js；src/main/home-summary.mjs | 已有课程/课节只读适配、稳定 contentRef、课程进度和今日聚合。目录包含内置句子、用户题库、导入故事与逻辑课程；复用身份及别名。 |
| js/course-enrollment.js；server/services/course-enrollment-operations.js | 客户端和服务端都限制最多三门已加入课程；前端改数字无法改变服务器规则。收藏必须独立于加入，M1 保留三门上限。 |
| server/services/settings-operations.js | settings.patch 仅接受白名单标量字段，不能直接塞入收藏数组或复杂工作台配置。 |
| server/services/operations.js；data-rows.js；data-snapshot.js；js/server-cache.js | 协议 3 已有事务、请求幂等、实体行及全量/增量确认。工作台偏好作为独立实体接入这条链路；不能绕过它写整个账户快照。 |
| content-studio.html/js；server/routes/content-studio.js；server/services/content-studio.js | 已有管理员课程编辑，但当前发布会修改原 manifest/分片及 SW。M1 新增独立目录元数据维护，不能调用正文发布来改分类。 |
| vocabulary.html；landing/action-game-*；vocabulary-practice.html；landing/practice.js；server/routes/vocabulary-practice.js | 场景关卡是体验；六词练习另有 vocabulary_attempts 和账号范围队列，只为绑定手机号的用户提交，服务端白名单来自 practice-content.lessons。不能宣称它支持任意词书或持久化场景关卡位置。 |
| extra/course-catalog.json | 当前 schemaVersion=1、courses=[]；不能凭文件名假设已有完整教材/年级目录。 |
| PRODUCT.md | 仍将 Chunk 描述为唯一核心，与用户最新“单词与 Chunk 同等核心”不一致；执行时只定向修正文案，不据此改变已确认方向。 |

规划过程仅做源码/工作树只读核对；没有读取真实数据库、操作账号、启动测试、改产品代码或重启服务。

## Assumptions and decisions

1. 一级导航固定「首页 / 我的学习 / 发现」，账号与设置归现有账号菜单。年级、题材、教材版本、考试等不是一级导航。
2. 主工作台只有一个真实账户运行时：main.html。新增稳定入口 `main.html?view=home|my-learning|discover`；未携带学习意图的 main.html 默认 home。
3. 根 index.html 成为轻量入口：有 token 时复用 ChunkAPI 验证 /api/auth/me；有效会话（包含已有临时学习账户）进入 main.html?view=home，无 token 或鉴权明确失效时提供开始学习/发现内容入口。网络错误显示重试，不伪装为空账户，不循环跳转，不重建匿名账号。登录成功走同一入口。旧示例移出主内容区，不删除原脚本/素材/SEO内容资产。带学习、测评、课节参数的旧链接不经过根首页重定向。
4. 收藏=保留内容引用；加入=当前在学；试学=打开内容。三者独立，收藏不上三门限制；取消收藏不退出课程、不删正文、不重置历史；退出学习沿用 CourseEnrollment.leave。
5. 我创建/导入的内容默认仅当前账号可见。公共发现只含内置内容和明确公开的目录元数据；不能从某个用户账户借数据构造公共目录。新发布只管理已经可公开引用的素材，不把私有素材改为公开。
6. M1 只启用现有 Chunk/句子课程入口与现有词汇入口。体验场景标为体验；六词练习准确标为当前六词范围，不包装成完整词书。语法、句型、听力、跟读、发音、音标只有扩展契约，不展示失效按钮。
7. 公共实际没有词书/教材时，该视图显示可操作空状态。所有年级、出版社、考试案例只用于临时测试夹具；不向真实目录注入虚构资源。题库标题不用于猜测 CEFR、年级、版本或掌握度。
8. 桌面沿用现有暖纸/学习花园体系，压低背景竞争、紧凑内容；手机单栏并保留三个导航文字。M1 不另换品牌、插画或色彩体系。

## Scope

- 三个工作台视图、根入口衔接与相关页面返回导航。
- 统一资源只读模型、分面筛选、最小目录元数据管理。
- 收藏与最多三个固定工具，账户隔离、真实确认、刷新恢复。
- 个人首页：一个课程续学主入口；有真实待复习才出现复习条；最多三个固定工具；最多三门活跃课程；完整集合到「我的学习」。
- 「我的学习」区分当前在学、收藏、我创建/导入；导入和创建复用现有入口，学习档案复用 stats.html。
- 通过真实浏览器证明 Chunk 的找内容 → 收藏 → 加入 → 作答保存 → 刷新/第二浏览器上下文 → 首页续学链路；验证词汇工具准确进入既有页面，不宣称其具有尚未实现的统一续学。

## Out of scope

- 不解除三门当前在学限制，不迁移或重写已有课程 ID、学习记录、SRS/测评规则。
- 不实现任意规模词书学习引擎、不统一或迁移 vocabulary_attempts、不把体验关卡升级成掌握记录。
- 不制作教材、考试、行业课程，不抓取第三方内容，不授权使用截图所示课程。
- 不实现新增语法/听力/跟读等引擎、内容推荐算法、年龄推断、自动水平分级和强制学习路线。
- 不建设新 CMS 全套正文编辑/批量导入/商业发布；不自动调用现有正文 publish；不整体改写 DESIGN.md。
- 不提交、推送、部署、切换真实服务；不发送短信；不清理历史兼容代码、资产或备份。

## Contracts and data changes

### 1. 公共目录与个人资源只读模型

新增 `src/learning-workspace/resource-model.mjs`，规范化结构：

```js
{
  resourceId,                         // 稳定引用；课程采用 "course:" + canonical CourseCatalog id
  kind: "course" | "wordbook" | "textbook",
  title, description, coverUrl,
  origin: "builtin" | "imported" | "created",
  visibility: "public" | "private",
  sourceRefs: [{ type, id }],         // 只引用既有内容；不复制正文
  facets: {
    audiences: [], schoolStages: [], grades: [], levels: [],
    goals: [], topics: [], exams: [],
    seriesId: null, publisherId: null, edition: null, volume: null
  },
  activities: [],                    // 由实际 contentRef/现有能力判定；不是随便勾选的承诺
  available, unavailableReason,
  metadataRevision
}
```

- 元数据可缺省；数组去重、枚举/字典 ID 验证、长度限额；使用标题文本安全渲染，拒绝脚本 URL、路径逃逸。版本必须明确版次，不使用“最新”作为稳定 ID。
- `resourceId` 与 CourseCatalog courseId 的关系存为引用；保存时使用现有 enrollment aliases 的 canonical ID，读旧引用时只做别名解析，不重写历史。收藏引用失效时保留“暂不可用”条目，不自动移除。
- sourceRefs 白名单是当前真实支持的 sentence-deck/story-package，以及显式适配的现有六词练习；wordbook/textbook 是集合类型，不直接改变练习正文格式。不要把集合标题误当作真实可启动内容。
- 课程沿用 CourseCatalog 完整课节顺序，教材系列聚合只影响列表，不改课节身份。资源卡展示 available + 实际 activities；不支持的活动不出现。
- 发现的分面仅从已公开目录构建；我的学习额外合并当前账号资源。私有数据不进入公共接口或公共搜索缓存。

新增纯函数 `src/learning-workspace/facets.mjs`：维度之间 AND，同一维度多个值 OR；关键词匹配标题/简介/明确标签；返回筛选结果与当前可选值/计数。默认不静默套用年级，筛选状态在 URL 中可恢复、可清除。

发现内使用「课程 / 词书 / 教材」三种视图。课程默认水平+目标，词书默认目标+学段，教材默认学段+版本；其余在“更多筛选”。版本选项依赖学段；冲突时清除不适用条件并明确告知，避免空筛选陷阱。手机筛选用抽屉、已选条件仍可见。教材列表按 seriesId/publisherId/edition 聚合后选册次；词书紧凑行、课程小封面；不显示“暂无介绍”。

### 2. 独立的目录元数据修订，不覆盖课程正文

新增 `server/services/library-catalog.js`、`server/routes/library.js`。复用 CourseCatalog 的公开内容适配；GET `/api/library` 无需登录，只返回 metadata，不取全库正文/图片；使用 ETag/版本，并限制响应字段。旧内置课程无分类仍可出现于课程视图，未知分类留空。

目录维护沿用 content-studio 管理员身份，新增独立的元数据面板与接口：

- GET `/api/admin/library/resources`；GET `/api/admin/library/resources/:id`。
- PUT `.../:id/draft`，传 `baseRevision` + resource metadata；同版本冲突 409；sourceRefs 必须指向允许公开的真实内容，否则拒绝。
- POST `.../:id/publish`，传 draft revision；再次检查引用、可用能力和版本，只发布该目录修订，禁止调用 studio.publish。
- 缺标题、非法字段/引用返回 422；普通用户 401/403。草稿不进入公共 GET。

在 server/db.js 只增加 `library_resource_revisions(resource_id,revision,status,metadata_json,created_at)`，复合主键；事务追加修订，发布选择最新已发布版本。不要更新/删除旧修订或既有课程表。新增资源仅是有真实 sourceRefs 的集合；M1 不增加正文上传格式。现有 manifest 文件、课程包、原图与 user_courses 原文必须保持原样。

面板至少能新增引用集合、编辑适用学段/年级/水平/目标/题材/版本信息、预览和发布。能力只读显示。批量编辑留下一期。

### 3. 个人收藏/固定工具：协议 3 独立实体

新增实体 kind `learningWorkspace`，复用 `user_entity_rows`，不新建个人学习快照：

```js
// item_key: "resource:" + resourceId 或 "tool:" + toolId
{ schemaVersion: 1, itemType: "resource" | "tool", targetId, selected: true|false,
  position: 0, updatedAt: serverTime }
```

操作 type `workspace.select`，payload `{itemType,targetId,selected,position?}`，一个操作只改一个引用；服务端验证 resource 当前归属/公开可引用性以及 tool 注册表；取消选择允许处理已失效的本人旧引用。最多三个固定工具，收藏不限三门；每字段限制、每条记录体积上限、选择工具上限在服务器验证。false 保留为该偏好记录，不触发学习实体删除。位置为 0..2，仅用于工具；并发同一条记录按服务端操作顺序，冲突请求 ID 由既有协议拒绝。

- `server/services/workspace-operations.js` 注册到 operations.apply；事务内 upsertEntityRow 返回 `{entity:'learningWorkspace',id,rev:seq}`，沿用请求回执。
- 定向扩展 data-rows 的 ENTITY_KINDS、data-snapshot 的 `mem.learningWorkspace`/`revs.learningWorkspace`/`entityGone.learningWorkspace`，并接通操作回执的 entity-delta 读取。沿用现有实体增量 envelope，不新建返回协议。
- 定向扩展 js/server-cache.js：该 map 的全量/增量合并、rev、水位、确认及待提交投影；新增 `js/learning-workspace-store.js` 封装 `ServerStore.submitCommitted` 和当前 AccountStorage.owner 确认读。视图可显示待保存，但收到有效账号的事务回执前不能显示“已保存”。
- 收藏/工具以确认缓存和独立偏好投影读取，不要求塞入 core.loadMem 默认结构，也不加入整份 settings 保存。必须证明已有学习的 pending 操作不受影响。
- 账号切换/退出立即清除界面个人投影并取消旧请求结果应用；同账号另一标签页及第二上下文通过既有缓存刷新/数据拉取读取一致状态；不能清空任何原始浏览器分区。

### 4. 运行时视图与工具边界

- 新增 `src/learning-workspace/home-model.mjs`、`tools.mjs` 纯模型与 `js/learning-workspace-view.js` DOM 渲染。依赖由 main 注入：CourseCatalog、memberships、已确认课程进度/resume、当前账户、ContentRepo、prefs、实际 due 计算；不让新模块读取数据库或创建第二个 CL。
- 新页面容器 `pageMyLearning`、`pageDiscover` 使用现有 `.page`/showPage；保留 `pageHome` 和 homeBody。在 main.html 中只做薄接线、导航、视图调用；不再堆一个大型平行 renderHome。
- tools 注册 vocabulary 与 chunks，显式 readiness/resumeSupport。词汇去 vocabulary.html 或 vocabulary-practice.html 的既有入口；Chunk 去已有课程选择/启动流程。默认未固定时显示两个同等大小的小工具入口，明确“选择练习”，不伪称个人常用；固定后按本人选择最多三个显示。
- 根首页验证 token 的请求带 generation/API base 作用域；鉴权处理中不得闪现别人的首页。index 只负责入口，不拉个人课程全量。
- `view` 由 src/main/entry.mjs 解析并在 main.decideEntry 消费；已有 assessmentKey、course+lesson、direct、review handoff 等明确练习意图优先级高于 view，必须防止 boot 的第二次 home 渲染覆盖所选视图。history/back 和刷新保留选定视图；不要吞旧 URL 的学习参数。
- main renderHome 的续学、课程进度、真实到期统计来源不变。个人首页默认不展示全量日历、排行榜或公共推荐；保留档案入口。没有 due 时不出现死的“0 待复习”主卡。
- 空账户可直接去发现/既有体验；加载失败、未登录、无个人内容和引用不可用是四种不同状态。网络失败保留本人最近确认数据并标注状态，不显示“无课程”。
- 返回导航在 index、main、vocabulary、vocabulary-practice、courses 的当前相关入口保持一致；stats/course-create/content-studio 保留既有职责及链接，不全站视觉翻新。

## Implementation steps

- [x] **1. 固定边界和入口。** 比较当前工作树与本计划列出的证据；若已有并行任务改了保存协议/加入上限/资源身份，按 Execution notes 阻断处理。新增 workspace 纯模块、tools 注册表和 URL entry 单元测试，修正 PRODUCT.md 唯一核心文案；不改 SRS 或既有数据。
- [x] **2. 打通真实内容目录。** resource-model/facets 只读适配既有公共 catalog 与个人 catalog；新增 library 服务/路由和目录修订表；注册 server/index.js。生产目录仅复用真实已存在内容，教材/词书可为空。
- [x] **3. 最小管理端闭环。** 在 content-studio 增加独立的目录元数据管理区（新脚本 `js/library-metadata-editor.js`），完成 draft→校验→预览→publish；失败保留未保存表单，409 不覆盖他人草稿；正文编辑保存/发布保持原样。
- [x] **4. 打通个人偏好保存。** workspace-operations、entity 白名单/下行 delta、ServerCache、workspace-store、确认保存反馈；实现收藏与取消收藏、固定与取消工具。新操作纳入现有 outbox 自动重试，不新建 localStorage 账户列表或手动“同步”。
- [x] **5. 实现三个视图。** `js/learning-workspace-view.js` + `assets/learning-workspace.css` 按 existing identity 渲染首页、我的学习、发现；接 main 真实投影与入口；旧 renderHome 可复用计算/事件，但重复公共推荐和示例不在个人首页出现。我的学习完整展示已加入/收藏/本人导入创建，状态标签准确；收藏按钮与“加入学习”按钮区分。
- [x] **6. 接根首页与学习返回。** index/landing/account.js 使用同一 auth 请求入口决定去 main；main 处理 view、旧学习意图及后退；相关词汇/故事页面增加统一返回链接。完成一次真实课程启动、答题确认、刷新、续学的全过程；词汇入口保留其当前真实能力边界。
- [x] **7. 构建与交付验证。** 新源模块由 entry 文件产出 IIFE（新增 scripts/learning-workspace-entry.mjs），接 scripts/build-app.mjs/check-generated.mjs；为新页面脚本登记 SW 和 deploy 文件清单，不预缓存目录正文/词汇整库。注册测试清单；通过下面验收后将本文件改为 complete，记录结果和风险，不自动部署。

主要文件边界：

- 核心新文件：src/learning-workspace/{resource-model,facets,home-model,tools}.mjs；js/learning-workspace-{store,view}.js；js/library-metadata-editor.js；assets/learning-workspace.css；server/services/{library-catalog,workspace-operations}.js；server/routes/library.js。
- 定向修改：index.html、landing/account.js、main.html、src/main/entry.mjs；server/{db,index}.js、server/services/{operations,data-rows,data-snapshot}.js、js/server-cache.js；content-studio.html/js；scripts/{build-app,check-generated,gen-sw,check-deploy-files,test-manifest}.相关文件；PRODUCT.md。
- 不直接改生成产物的源逻辑：新增 bundle 与关联生成 JS/SW 由对应构建生成；现有 course-learning-launch/course-authoring 等只有运行接线需要时定向改源文件，不整体重构。
- 不改课程 packages/content 正文、extra 原始课程、server/data、备份、原图。只读资源引用和目录元数据修订与正文严格分开。

## Validation

规划未运行以下测试。执行时先审查每个测试启动代码，确保临时目录/端口/内容根；不以既有文件名为安全保证。

### 新增必需测试及命令（在仓库根目录）

- [x] `node --test src/learning-workspace/*.test.mjs`：身份/别名、分面 AND/OR、未知标签、零内容、系列册次、能力不越权、个人首页各状态/排序、旧 URL 学习优先级。
- [x] `node server/library-catalog.test.js`：临时 DB + 临时 APP root；普通用户拒绝写；私有源拒绝公开；分类草稿与发布区分；409 无覆盖；正文/manifest/原图 hash 不变。
- [x] `node server/workspace-operations.test.js`：临时 DB；幂等/重用 ID、账户隔离、tool 上限、无效引用、保存超过三条收藏而 enrolled 仍上限三、取消收藏不改课程/成绩；全量/增量/回执 entity 数据一致。
- [x] `node js/learning-workspace-store.test.js`：已确认/待提交分离、失败重试、切账号丢弃旧结果、两条不同收藏并发不相互覆盖、引用失效不删除收藏。
- [x] `node e2e/learning-workspace.test.js`：临时目录与独立端口；桌面/手机四宽度。覆盖真实入口、筛选 OR 多选/抽屉/键盘/历史恢复、管理发布、收藏/固定工具、加入/答题/确认/跨 context 续学、断线保留及自动重试、A/B 账户隔离。
- [x] 新 E2E 截图位于 output/playwright/learning-workspace；测试仅使用临时数据目录和独立动态端口，退出后清理本次临时目录。

### 现有定向回归及构建

- [x] `node course-catalog.test.js`；`node course-progress.test.js`；`node course-resume.test.js`；`node scripts/course-enrollment.test.js`。
- [x] `node scripts/main-home-summary.test.mjs`；`node scripts/main-course-navigation.test.mjs`；`node scripts/main-lifecycle.test.mjs`。
- [x] `node e2e/course-enrollment-protocol3.test.js`；`node e2e/course-membership-review.test.js`；`node e2e/account-isolation.test.js`；`node e2e/course-catalog.test.js`，均使用隔离配置。
- [x] 旧 homepage-update/home-learning-ui/home-today-entries 已迁移到新首页契约，保留待复习启动、在学/导入归属、学习档案统计、课程打开、响应式与目录断线恢复断言。
- [x] `node scripts/build-app.mjs`；`node scripts/check-generated.mjs`；`node scripts/gen-sw.js`；`node scripts/check-sw.js`；`node scripts/check-deploy-files.js`。
- [x] 新测试已纳入测试清单并通过定向契约验证；未运行全量内容生成/发布链路。

## Acceptance criteria

- [x] 真实入口可见「首页 / 我的学习 / 发现」，刷新/后退可恢复；根入口进入同一个个人运行时，鉴权失败无循环。
- [x] 首页不再显示固定示例冒充个人学习；未固定工具默认显示两个平等入口，不编造使用历史。
- [x] “发现”提供课程/词书/教材视图；抽屉筛选支持已选展示、移除、多值 OR 和历史恢复；零词书如实显示空状态。
- [x] 管理员元数据草稿、冲突校验和发布已由隔离浏览器验证；发布不更改正文与原始文件。
- [x] 收藏与在学分离；四项以上收藏、三门在学限制及退出后保留历史通过隔离 E2E/回归验证。
- [x] 我的学习显示在学与导入/创建内容；A/B 账户收藏及续学隔离。
- [x] 真实 Chunk 课程完成发现、收藏、加入、答题、回执、刷新和第二上下文首页续学。
- [x] 单词工具进入现有入口，练习能力范围说明及入口验证通过。
- [x] 断线保留最近目录、待保存状态和恢复重试通过；主生命周期测试覆盖旧异步回包与显式学习意图优先级。
- [x] 1440/946/390/360 无横向溢出；筛选抽屉支持 Esc 与焦点返回；课程/发现导航可用。没有新增词汇插画或整库预缓存。
- [x] 所有本交接范围测试通过；实际 8787 服务未重启/部署，真实数据库、课程、记录、原图和备份未被触碰。

## Risks and rollback

- 最大风险是个人实体增量漏接而“保存成功但刷新丢失”：必须同时验证 POST 回执、GET 全量、GET 增量、ServerCache 合并及跨 context；只测按钮变色不合格。
- 现有 master 未提交改动很多；执行前保存任务边界清单，重叠文件定向编辑。不得用 git reset/checkout 清理；若保存协议正被另一任务修改，记录具体差异并回到 needs-planning。
- 目录 metadata 的 availability 不能替代权限；服务端发布验证 sourceRefs 公开性，私有内容在本人视图适配，不通过公开接口返回。
- 当前三门限制是既有业务规则，M1 只新增收藏。若需要无限当前在学，需要另一个已批准方案同时改客户端、服务端和回归，不能顺手解除。
- 服务端只新增元数据表/实体 kind；不迁移真实数据。执行只能测试隔离实例，若上线需真实数据库变更，另行确认目标、账户与一致性备份后才允许部署。
- 回滚只撤销本次源代码接线/资源注册，隐藏新视图与元数据接口；不 DROP 表、不删偏好或目录修订、不清浏览器，不恢复整个账户快照。回退前检查并行工作，保留一切原始资产。
- 历史保存/发布计划（尤其 2026-10-12-single-save-path）尚有未完成工作：本任务不得宣称解决全部发布可靠性；遇到材料级矛盾停止本任务并指出具体问题。

## Execution notes

### 2026-10-13 实施中检查记录

#### 三视图与真实学习链路已接通（本次继续执行）

- main.html 已注入三个容器和单一工作台运行时，首页只读取当前账户的真实在学、到期和续学信息。根入口验证已有会话后转到同一 main 运行时，游客只显示开始/发现入口。词汇返回链接已统一。
- content-studio 增加独立目录分类面板；浏览器验收已完成新建集合、保存草稿、预览、发布、发现筛选。发布没有调用正文发布。
- `node e2e/learning-workspace.test.js`：通过；最后通过端口 11259，临时数据与目录根 `chunk-workspace-e2e-*`，退出后已清理。覆盖四个发布分类夹具、五条收藏、回执幂等/重用 ID 拒绝/增量实体、真实公开课程收藏→加入→作答→下一题续学确认→退出→第二 context 首页继续、根入口跳转、账号 B 空集合、管理员权限拒绝、目录断网状态。
- 续学从确认投影的 mem.progress/sessionId/time 读取，不依赖另一设备的本机 lastPlayed。作答验收通过真实候选按钮，续学验收通过真实下一题按钮，未直接伪造学习事件。
- `node e2e/course-enrollment-protocol3.test.js` 通过（三门在学上限）；`node e2e/course-membership-review.test.js` 通过（退出在学不改原成绩/错题）；`node e2e/course-catalog.test.js` 通过（65 课节旧 URL 启动）；`node e2e/account-isolation.test.js` 25/25 通过。
- 目录、收藏、store、新纯模型测试通过；课程 catalog/progress/resume/enrollment、main home-summary/course-navigation/lifecycle 回归通过。
- `node scripts/home-learning-ui.test.cjs` 已按游客轻量入口新契约改写并通过，原示例资产/脚本保留；`node scripts/homepage-update.test.cjs` 通过。test-manifest 自动发现新增测试，238 项目标契约检查通过。
- build-app、check-generated、gen-sw、check-sw、check-deploy-files 均通过。新脚本/样式已登记，目录接口不纳入正文预缓存。
- 桌面/手机截图见 output/playwright/learning-workspace/home-{1440,946,390,360}.png；四宽度无横向溢出。界面检查采用两批，检测器只有设计文档色彩/圆角等 advisory；未改既有 DESIGN.md。新增布局延续暖纸/花园风格。
- 当时仍待收尾的旧首页断言、移动筛选和离线恢复已在下方最终记录中完成并验证。
- 实际运行中的 8787 服务未重启/未部署。新目录能力不可读时收藏不会提交未支持的操作。未触碰真实数据库、原始课程正文、图片或备份。

#### 2026-10-13 最终验收

- 手机发现筛选改为原生对话抽屉；维度间 AND、同一维度多值 OR；已选标签可逐项移除，筛选支持应用、清空、Esc 关闭、焦点返回、刷新和浏览器后退恢复。
- 主浏览器 E2E：`node e2e/learning-workspace.test.js` 通过；最后隔离端口 11294。包含手机筛选与历史、工具固定、四项收藏、断线收藏待保存/恢复自动重试、目录错误保留结果、管理员分类发布、作答回执、第二上下文续学和账号 B 看不到 A 的收藏/固定工具。
- 旧首页 E2E：`node e2e/home-today-entries.test.js` 19/19 通过。保留真实到期复习启动、空待复习状态、导入/在学分区、图文课程打开、档案计算、目录连接失败恢复；替换旧计数药丸和首页月历布局断言。截图：`output/playwright/learning-workspace/home-today-migration.png`。
- 关键回归通过：course catalog/progress/resume/enrollment、main home-summary/course-navigation/lifecycle、course-enrollment-protocol3（三门上限）、course-membership-review、account-isolation（25 项）、course-catalog（65 课节）。
- 目录、偏好实体、缓存投影、确认存储与纯模型测试通过。主页访客、首页更新及 test-manifest 契约通过。
- 构建与交付检查通过：`build-app`、`check-generated`、`gen-sw`（CACHE `chunklab-2041c69a`）、`check-sw`、`check-deploy-files`；运行时部署依赖覆盖完整。新页面筛选与内容目录不触发词汇插画整库预缓存。
- 截图保存在 `output/playwright/learning-workspace/`，宽度 1440/946/390/360 均无横向溢出。仅工作台四个入口宽度为 946/390/360/1440 的已存截图以及迁移截图。未新增词汇插画。
- 没有部署或重启 8787 实例；没有读写真实账号数据库、课程原文、记录、原始插画或备份。工作区中其他未提交更改保持原状；没有提交、推送或发布。

- 已新增工作台纯模型、目录服务与追加修订表、协议 3 收藏实体接线、独立偏好投影及三个视图的 DOM/CSS 模块。视图尚未接入 main 实际入口，不能算交付完成。
- `node --test src/learning-workspace/workspace.test.mjs`：5/5 通过。
- `node server/library-catalog.test.js`：临时目录、独立动态端口 4575；草稿不公开、版本冲突无覆盖、发布与普通用户拒绝写、ETag、manifest/原始文件 hash 不变通过。测试目录已清理，仅清理本次新建临时目录。
- `node server/workspace-operations.test.js`：内存数据库；五条收藏、工具与载荷校验、失效引用取消、账户隔离通过。尚未验证协议完整幂等/回执与加入上限联合链路。
- `node js/learning-workspace-store.test.js`：确认/待提交分离、两条收藏投影、失败不宣称已保存、切账号丢弃结果、回执去重通过。
- `node --check js/learning-workspace-view.js` 通过；浏览器实测尚未完成。
- 下一步：main 三视图接线、管理端元数据编辑面板、根入口与返回导航、完整协议/跨上下文续学 E2E、生成产物/SW/deploy 验证。保持 in-progress，不提前勾选完整验收。
- 真实服务更新：否。未启动真实数据库、未清浏览器数据、未修改课程正文或原图。

- 本轮只创建本交接文档。Status ready-for-luna 表示本次 M1 范围、入口、文件边界和验收已确定，不代表功能已实现或当前测试通过。
- 开始实施改为 in-progress；只有全部本次验收通过才 complete。任何 material identity/persistence/permission contradiction 改为 needs-planning，记录证据和必须决定的单点，不自行扩大范围。
- 每个验证项只在真实成功后勾选；记录所用临时端口/目录、命令结果、截图、受影响文件和是否更新真实服务（本范围应为“否”）。

### 后续路线（不属于本次执行）

1. **M2：规模化词书与同步教材。** 扩展词汇内容索引、wordbook/textbook 学习适配、真实出版版次/授权素材、分页检索；把六词试点扩展为按内容 ID 的词汇能力记录与真实续学，需要单独规划旧记录保留和接入策略。新增/批量导入只在内容管理，不增加一级导航。
2. **M3：专项学习工具。** 分批接语法、句型、听力、跟读、发音、音标；每个工具具备内容约束、实际题型、失败状态及独立能力记录，验收一条纵向学习链路再开放按钮。同词跨工具关联使用稳定知识点引用，禁止合并成虚假总掌握百分比。
3. **M4：个人计划与关联推荐。** 在已有真实活动数据上增加可选计划、跨工具下一步建议和用户可调整排序；不强制“先背完词再练 Chunk”。推荐只影响展示、不改变所有权和进度。

后续每批使用独立 Astra→Luna 交接；不要求本次 Luna 执行到所有未来功能完成。
