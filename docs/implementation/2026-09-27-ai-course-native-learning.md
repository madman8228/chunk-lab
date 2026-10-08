# AI 创作平台：接入现有学习体验与可扩展课程合同

- Status: complete
- Updated: 2026-09-27
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22。core.js、main.html、decks.html、courses.html、course-package.js、构建脚本、服务端存储层及多份测试有未提交修改；src/course-authoring/、course-create.html、js/course-authoring.js、AI 制作计划与测试等尚未跟踪。不得按 HEAD 覆盖现有成果。
- Planner: Astra planning phase；用户已在模型切换后明确调用 Astra–Luna 规划，未另行断言环境未暴露的模型子型号。
- Executor: GPT-5.6 Luna

## Objective

交付一个完整结果：用户用自己的 AI 制作文字课程，经过检查和预览后保存到句子课程，使用现有 main.html 输入/意群选择、讲解入口、错题和间隔复习；首页、课程库、继续学习和统计能找到同一课程。已导入的 AI 文字课程提供可预览、可重试的兼容转换，保留原内容、加入关系和旧学习记录。

长期产品定位是 AI 创作平台：用户决定内容、教学组织和可支持的呈现方式，平台提供内容合同、官方学习组件、学习记录与能力检查。当前句子/图文体验是第一批官方模板，不是永久的内容类型上限。本轮完成实际接入，不实现通用页面编辑器。

本文接替 `2026-09-27-ai-course-authoring.md` 中“新 AI 草稿一律编译成内部 V2 包并进入 V2 专用交互”的决策；旧计划保持历史记录。服务端权威存储计划仍独立，本轮不切换同步协议。

## Current state and evidence

- 当前仓库根及 D:/、D:/06-project 未发现 AGENTS.md；执行前复核各修改路径新增的指令。
- `src/course-authoring/draft-compiler.mjs` 将所有 AiCourseDraft 1.0 编译为 schemaVersion=2.0、assets=[] 的内部课程；没有传递站内 exerciseModes。
- `adapters/course-gateway.mjs` 调用 ChunkCourse.importCourse；`service.mjs.join` 固定 package:<id>；`ui/controller.mjs` 固定跳 courses.html。因此分类、保存和跳转与包播放器耦合。
- `js/course-catalog.js:storyCourse` 将课程包标为 contentType=story；`decks.html` 将该分类显示为图文课程。存储位置错误地决定了用户所见分类。
- `course-package.js:renderV2Interaction` 有独立方式选择与答题分支，意群练习提前显示整句答案、候选项按源顺序出现；`renderV2Node` 无图时加 no-image；courses.html 的该类隐藏左栏。这解释了用户截图，不能靠更改桌面断点解决。
- `main.html:startDeck/renderQ` 已有输入(type)/选择(choose)两种按意群答题；依赖 chunks，hints 缺失会显示词数。长期题库开始时有到期优先、熟练度排序和随机排序，直接用于短文/对话会破坏顺序。
- `js/chunk-shape.js` 是唯一意群数量规则：多词句至少两段，最多五段；旧 AI 格式允许无 chunks 或 1～20 段。`js/chunk-engine.mjs` 消费按意群索引分组的 distractors，旧 AI 格式是平面字符串数组。不能直接赋值或猜测切分。
- `src/core/identity.mjs` 优先显式 cid，统计键为 deckId#cid。旧 V2 seen/passed/completed 无答题次数、时间和 SRS 质量，不能伪造原生答题历史。
- `CL.allDecks/allDecksView/findDeck` 消费 mem.decks；`CL.saveAndNotify` 是已有页面保存门面；`CL.readCourses/writeCourses` 管课程包。新 ServerStore 操作队列存在不代表 deck 写入协议已切换。
- `js/course-catalog.js` 原生用户课程 ID=user-deck:<deckId>，内容引用 sentence-deck；`main.html` 支持 ?course=<catalogId>&lesson=<lessonId>。首页、decks、stats 都依赖此原生题库体系。
- 现有 tests 覆盖作者流程、目录、课程加入、进度、统计和旧 ZIP。旧作者 E2E 只证明 V2 可以答题，不能证明复用原生学习体验。

## Assumptions and decisions

1. 用户创作自主权是产品目标；本轮以可信能力清单明确当前支持项。AI 来源不决定分类或 UI，不引入“AI 专属播放器”。
2. 第一交付模板为 sentence-practice：输入与意群选择共用 main.html。图文课程继续使用既有 courses.html 左右布局及原包合同。纯文本不为凑左右布局生成空图片区域。
3. sentences/article/dialogue 表示内容组织。三者均可用原生句子练习；短文/对话按源顺序教学、保留角色与上下文。角色扮演的自我确认不能冒充原生客观答题，首轮新模板不开放 roleplay；预览解释不支持的要求并允许用户调整。
4. 输入明确指“按中文提示输入英文意群”；旧整句 acceptedAnswers 中的非等价答案不能静默丢弃或拆成意群别名，必须列为适配问题交给 AI 修复。
5. 新课程保存为普通用户 deck，包含版本化作者元数据；学习直接使用既有 deck 数据与统计。避免保存一份包、另存一份独立可编辑 deck 后双向同步。
6. 旧包只在用户确认转换后生成原生 deck；原包和旧 progress 保留。通过目标 deck 的来源记录决定目录去重/旧链接转向，因此失败不需要跨存储“回滚删除”。
7. 课程选择的默认练习方式只影响当前学习会话，不修改用户全局 mode。恢复会话使用同一设置；临时复习队列继续遵循已有全局模式。
8. 本轮不拆出万能播放器、通用插件框架或所有判分规则。抽取纯适配与学习策略边界，复用已有渲染和记录调用；后续按实际教学需求增加受控组件。

## Scope

- AiCourseDraft 1.1 原生句子模板合同、提示词、示例、校验与分享；继续识别 1.0。
- 纯 adapter、学习能力检查、保存/加入/导航 gateway 解耦；原生学习入口贯通。
- 句子会话级模式、短文/对话顺序及最小角色/上下文呈现；使用现有样式和答题组件。
- 旧 AI 课程转换预览、重试、旧链接和已保存作者会话恢复、目录去重、历史说明。
- 隔离测试与构建/缓存/部署资源接线。

## Out of scope

任意 HTML/JS/CSS 上传执行、页面可视化编辑器、第三套学习页面、TTS/图片生成、自动模型调用、多课节批量生成、分支剧情执行器、自由对话评分、原地课程版本更新与进度合并、全站学习数据重构、服务端权威切换、提交/推送/部署。

允许导出后用 AI 改编并作为新课程导入。原地更新和修订映射是后续交付，不在本轮暗中覆盖旧课程。

## Contracts and data changes

### A. 长期扩展边界与本轮文件

依赖：作者 UI → 应用服务 → 固定格式校验/能力协商/模板 adapter → 现有保存与学习门面。课程内容不得携带调用学习存储的可执行代码。

| 文件 | 责任 |
| --- | --- |
| 新 `src/course-authoring/learning-contract.mjs` | 官方模板 ID、版本、练习能力和适配报告；纯数据与函数，不读取浏览器 |
| 新 `src/course-authoring/sentence-adapter.mjs` | 经验证草稿 → 原生 deck；稳定身份、字段映射、顺序策略、白名单导出 |
| 现有 draft-spec/codec/validator/compiler | 按显式格式版本分派；保留旧编译器用于读取与导出旧 V2，新增课程走原生 adapter |
| 现有 capabilities/preferences/prompt-composer | 区分导入包能力与当前创作模板能力；提示词仅承诺选中模板可执行的能力 |
| service/session/adapters/course-gateway | 保存结果使用统一 receipt，查重、加入、恢复不再推导固定包路由 |
| 新 `src/course-authoring/legacy-conversion.mjs` | 旧 AI 包的只读适配报告、确定性来源身份与转换计划；IO 留给 gateway |
| 新 `src/main/course-learning-policy.mjs` | 计算 effectiveMode、顺序策略、可用模式；接 main.html 的既有流程 |
| main.html、decks.html、js/course-catalog.js | 官方模板启动、课程分类、原生目录与旧来源去重；复用现有列表和学习界面 |
| courses.html/course-package.js | 已转换旧 AI 链接转向；未转换保留访问并提供转用现有练习入口；普通 ZIP 不变 |

不建立远程动态注册表。模板合同为版本化数据：templateId、templateVersion、supportedModes、ordering。未知模板返回可定位“不支持”，不能猜测降级。未来可加入章节、条件分支和允许的展示组件，但当前 Schema 不接受尚未实现的字段。

### B. AiCourseDraft 1.1

保留 1.0 的 format、title、description、targetCefr、contentForm、roles、items 和 source 限额。新输出 formatVersion='1.1'；固定 additionalProperties=false，各版本独立 Schema，不能让 1.0 在同名版本下改变语义。

- 新必填 learning={template:'sentence-practice',version:1,modes:['typing'|'chunkSelection',…],defaultMode:'typing'|'chunkSelection'}。modes 非空去重，defaultMode 必须属于 modes。AI 不可指定 ID、存储键、成绩、模板脚本。
- 站内选择进入提示词；返回 learning 不符选择时预览显示差异，要求显式接受或交回 AI 修改，不能静默覆盖任意一方。文件直接导入以文件 learning 为准。
- 新 items 必须具备 chunks 与同长度 hints（中文意群提示）；复用 ChunkShape 的最少/最多规则与现有拼接一致性检查。允许可选、限长的纯文字 explanation，显示于现有详解入口；缺失不生成假讲解。
- distractors 在 1.1 为与 chunks 等长的 string[][]，每组最多 10 个、单项最多 200 字符；可省略。逐组拒绝与正确答案规范化冲突及重复。教学质量仍由预览/AI 自检，不宣称语义验证保证唯一答案。
- 整句 acceptedAnswers 在新模板中不支持替代措辞；原句等价值可规范化为省略，非等价值报告需调整。暂不新增意群多答案协议。
- 其余 UTF-8 256 KiB、1～50 句、长度和角色约束继续生效。未来扩大篇幅应单独设计分课节与按需加载，不悄悄删除限制。
- 分享带内容、学习设置和角色，不含内部 ID、迁移来源账号、进度、私有 brief 或原始对话。

### C. 原生 deck 与保存门面

adapter 输入经过验证的草稿及站点 identity；输出 {id,name,desc,items,authoring}，不是 course-package 对象。

- 新 deck.id 使用会话已有 ai-UUID；items 的 cid 使用稳定站点生成行 ID（沿用 `<courseId>:line:NNN`），相同英文重复行仍有不同身份。
- sentence=en、translation=zh、chunks/hints/distractors 按合同显式映射；explanation 映射到现有详解可消费结构，不在 UI 再解释一遍协议。角色 ID/名称和源序号留在 item 的作者元数据，渲染时转义。
- authoring={schemaVersion:1,formatVersion:'1.1',contentForm,learning,roles,source?,catalogCourseId,legacySource?}；网站字段不得从上传者原样采纳。原生 items 是内容事实来源，导出从当前 items 与必要作者元数据生成，禁止保留第二份独立可编辑的完整 draft。
- 新课 catalogCourseId=user-deck:<deckId>；转换旧课 catalogCourseId=package:<旧courseId>，保留原加入键。catalog 必须支持作者 deck 的显式站点分配 catalogCourseId，普通 deck 保持既有规则。
- gateway 新增 saveSentenceCourse/findLearningCourse/getLaunchTarget 等明确行为，内部只使用 CL.preload/loadMem/saveAndNotify 与账号守卫。每次保存基于最新内存，按 ID 比较内容；相同重试不重复，内容不同报冲突。保存成功以门面确认提交为准，不因对象已写入页面内存就标记成功。
- receipt={storageKind:'sentence-deck'|'story-package',contentId,catalogCourseId,lessonId}。service.join 与 controller 导航消费 receipt，不再硬编码 package: 与 courses.html。receipt 不含任意可执行 URL。
- 保留保存与加入分离、失败重试、跨标签 revision、账号切换保护和真实保存状态。已保存旧会话根据持久层重新解析 receipt，转换完成后也能开始原生学习。
- 作者课程普通编辑入口转到作者预览/导出改编；本轮不允许旧编辑器丢失学习设置与角色元数据。普通非作者 deck 编辑保持原功能；删除作者 deck 使用现有删除流程。

### D. 现有学习页接线

- 使用 main.html 既有 course/lesson 地址，不依赖仅当前标签可见的临时变量。进入课程时应用纯 policy：typing→type、chunkSelection→choose；支持会话内切换文件声明且实际可用的方式，不再展示不可用的五模式大按钮。
- 替换当前页面对 mem.settings.mode 的相关直接判断，统一通过 effectivePracticeMode() 读取；不临时覆写全局设置后再“还原”。从普通课切入、退出、刷新、恢复、复习队列都验证。
- sentences 保留现有学习排序；article/dialogue 的首次课程学习维持原序，分批续学保持游标、不随机重排、不因 skipMastered 打断上下文；离开课程进入独立 SRS 复习仍用原队列规则。
- 对话当前角色及短文/对话已完成上下文使用已有文字区域的小型呈现；答题前不显示当前英文标准答案。没有图片不造图，不套图文布局。
- 选择项继续使用现有随机候选池；输入走现有按意群判定；结果只走原有 SRS/统计/错题写入口一次。默认无 explanation 时不承诺已生成讲解。
- 为作者课程提供稳定来源身份，完成一组后的继续学习/首页进度/统计复习都回到同一 deckId#cid，不创建临时伪造课程统计。

### E. 已有 AI 课程的兼容转换

识别条件必须同时包含 schemaVersion=2.0、现有 chunklabAuthoring 格式/版本标记和可反投影的字段；不能只凭 ai- 前缀迁移外部包。

1. 旧课程页与作者已保存页提供“使用现有句子练习”，先展示适配报告。扫描只读，不改变用户数据。
2. 旧 1.0 草稿：可映射 chunks 按 correctOrder 严格还原；hints 缺失允许旧课兼容词数提示并显示质量提醒，新 AI 指令要求补齐。缺 chunks、超 ChunkShape 限额、无中文、非等价 acceptedAnswers 属于阻断问题，提供带原内容的修复指令，不自动切句。
3. 旧平面 distractors 没有可靠位置关系：保留原包，在转换预览明确说明原生练习使用自身候选池、原干扰项未带入；只有用户确认才继续。角色自我确认历史不能映射为输入/选择成绩，说明可保留角色文字并选择当前支持的练习。
4. 转换目标 deckId=旧courseId，cid=旧utterance.id；已有同 ID 原生 deck 必须验证来源和内容，冲突时停止，不覆盖。确认选择的默认模式写入 learning。
5. 单次确认只提交一个完整原生 deck；authoring.legacySource={courseId,version} 与保留 catalogCourseId 随 deck 同次保存。原包及 CL.readProgress()[courseId] 保留，不删除、不归零。
6. 当且仅当目标 deck 已提交且匹配 legacySource，catalog 隐藏原包独立重复卡片、使用原 catalog ID 展示句子课程；新 lesson ID 可用原生规则。旧 lesson:story-package:<id> 作为该课程解析别名。旧 courses.html 地址在读取完成后转至原生学习页。
7. 旧 passed/seen 仅作为“旧版学习记录”只读显示，不转成 times、okTimes、mastered、due 或补发打卡。转换预览明确：新练习的复习统计从实际答题开始；旧版学习记录仍保留。续学可用旧 currentNodeId 映射源序号作为首次建议起点，但不能将旧覆盖率伪装成新 SRS 结果。
8. 新统计优先，旧历史单独可查；无需等待旧进度“迁移完”才开始。转换前中断保持旧入口；提交成功但页面跳转失败，重试发现已有目标直接继续。账号切换立即终止旧作用域操作。
9. 删除已转换 deck 后不得悄悄再次自动转换；原包重新可见并保留其旧记录。转换是用户动作，启动时只读解析，不自动写入。

### F. 后续平台路线（本轮仅保留边界）

- 下一交付：章节/多课节、素材引用与图文官方模板，基于既有 ZIP 素材合同，预览能力按模板准确说明。
- 再下一交付：教学流程与分支；引入明确的条件/动作白名单和版本，不让课程自行提交掌握程度。
- 有真实需求后开放声明式页面配置：由官方组件与布局规则组成，页面发出答题意图，平台验证状态并记录结果。兼容接口还需验证生命周期、重复提交、恢复、移动端和可访问性。
- 任意脚本插件需要独立隔离与权限设计，不是增加一个 script 字段。当前合同不宣称支持未来能力。
- 持续提供 AI 可读的能力清单、示例、错误路径和修复指令，完成创作—预览—修改—分享闭环。“完美创作”作为体验目标，不承诺任意 AI 输出都可执行。

## Implementation steps

- [x] 1. 阅读本文及相关工作区 diff，核对存储门面与 ChunkShape；本文改 in-progress。旧作者计划仅作为证据，不再执行其中固定 V2 路由决策。
- [x] 2. 建立 learning-contract、sentence-adapter 与 1.1 schema/validator；保留 1.0 解析；完成纯映射/导出/能力报告。未知能力失败可定位。
- [x] 3. 改 preferences/prompt/公开 kit 与向导预览，准确显示课程归属、原生模式和不支持项；导入方式仍支持文件点击、拖入和文本。
- [x] 4. gateway/service/session 使用 receipt，原生 deck 提交、查重、恢复、保存后加入；站内选择与返回文件差异显式确认。接通新课 main.html 路由。
- [x] 5. 接入 course-learning-policy，统一有效模式、原序学习/恢复与角色上下文；复用现有答题和结果写入口。首页、目录、统计、复习可达。
- [x] 6. 实现旧转换报告与确认，确定性身份、保留加入 ID、目录去重、旧链接别名、旧记录只读展示；作者会话恢复与重试贯通。
- [x] 7. 构建入口、HTML 依赖、check-generated、部署清单、Service Worker 与测试清单接入。新纯模块走现有 esbuild 方式，生成文件不手改。
- [x] 8. 完成下列有限验收并记录结果/剩余风险。

## Validation

使用 free-port、临时 CHUNKLAB_DATA_DIR 和隔离浏览器账号。真实用户当前课程只作来源问题背景，不替用户确认转换或修改其学习记录。

- [x] `node --test src/course-authoring/course-authoring.test.mjs`：1.0/1.1 兼容、模式协商、缺失字段、数量限制、按位干扰项、重复英文不同 cid、导出脱敏往返、保存失败/账号隔离。
- [x] 新 `node --test src/course-authoring/legacy-conversion.test.mjs`：来源识别、阻断与提醒、同 ID 冲突、旧进度不伪造、重试计划稳定。
- [x] 新 `node --test scripts/main-course-learning-policy.test.mjs`：默认模式/用户切换/普通课回退、原序与复习策略。
- [x] `node course-catalog.test.js`、`node course-progress.test.js`、`node course-resume.test.js`、`node scripts/course-enrollment.test.js`：原生新课程、转换课程唯一条目、旧 catalog ID/lesson 别名、加入关系保留。
- [x] 更新 `node e2e/ai-course-authoring.test.js`：真实创建→文件/拖放导入→预览→保存→加入→main.html 原生答题→首页/档案可见→刷新继续→下载后新账号导入。断言实际路由和原生答题组件，不能用能答题代替复用验收。
- [x] 新 `node e2e/ai-course-native-learning.test.js` 与 `node e2e/ai-course-authoring.test.js`：输入/选择均覆盖正确与错误、每句只记一次且建立 SRS 排期、答题前不显示整句答案；短文/对话按源序并呈现角色/前句；课程 mode 不污染全局设置；跨标签与账号隔离。
- [x] 同上旧转换场景：已加入且有旧学习记录、缺 chunks 阻断、保存失败重试、旧地址/旧作者会话恢复、原包与旧历史保留、catalog 去重、不同账号隔离。显式加入后进入原生学习。
- [x] `node e2e/course-package-import.test.js`、`node e2e/course-package-v2-import.test.js`：真实图文包导入及 V2 模式能力通过；图文播放器仍使用原有布局。
- [x] 浏览器检查 1200px、846px 与 375px：原生课程、旧图文播放器、转换预览均无横向溢出；E2E 中实际完成原生输入/选择与旧播放器答题。
- [x] `npm run build`、`npm run build:check`、`npm run lint:course-authoring`、`npm run typecheck`；新增纯模块与测试已纳入构建、类型检查和 lint。
- [x] `node scripts/gen-sw.js`、`node scripts/check-sw.js`、`node scripts/check-deploy-files.js`、目标文件 `git diff --check`。部署检查通过，但已有动态 HTML 字面量 `' + escX(src) + '` 被静态扫描误报为缺失路径；Service Worker 已重生成并与工作区哈希一致。

## Acceptance criteria

- [x] 用户制作的意群课程进入句子课程并使用现有答题页，未创建第三套学习 UI。
- [x] 新课从制作到答题、错误记录、复习、进度及刷新续学全流程成立；学习方式来自可执行合同。
- [x] 短文/对话保存组织和角色顺序，教学内容不为适配被静默删改。
- [x] 旧 AI 课经明确预览确认后可转用原生练习，旧内容/学习历史/加入关系保留，重试不复制课程。
- [x] 不能适配的课程得到具体修复反馈，未知模板不能执行；没有虚假音频、角色评分或页面定制承诺。
- [x] 新分享文件带必要学习设置且不带私人/学习数据；回导分配新站点身份。
- [x] 原图文课保持原布局和能力；普通句子课排序、全局模式与统计无回归。
- [x] 领域适配不依赖 DOM/CL；UI 不直接解释上传协议或判定成绩；实际入口、构建与缓存已接通。

## Risks and rollback

- 原生 chunk 输入与旧整句输入教学语义不同，必须在预览、制作指令和兼容报告中明确，不能通过丢弃 acceptedAnswers 来掩盖。
- 短文/对话接入随机学习会破坏结构，顺序策略属于必须验收，不留给后续。
- 存储门面可能被并行工作升级；只在 gateway 适配经确认的现有门面。若其不支持本合同，按技能记录 needs-planning 的具体冲突，不自行启用旁路写入。
- 旧包仍保留，目录去重必须由已提交目标来源决定；不得靠名称、AI 前缀、页面临时状态隐藏源课程。
- 回退关闭新作者入口/转换入口，保留所有已保存 deck、元数据与原包。原生 deck 已是可练习数据，不能回退时删除；课程旧历史可回看。旧版本未识别作者目录别名时不保证分类相同，记录发布版本要求。
- 本轮只保证声明的模板与能力。扩展自由度由可执行合同逐步增长，不以万能配置增加未验收的行为。

## Execution notes

2026-09-27 规划：核对当前分支/提交/工作区、作者服务和编译器、原生 startDeck/mode/保存流程、目录 ID、ChunkShape、统计身份和现有测试入口。仅新增本文；未修改产品代码、未运行测试、未写用户课程或学习数据。用户已确认长期 AI 创作平台方向，首轮按原生学习接入及兼容转换收敛；后续页面配置属于记录的路线，不混入首轮验收。

2026-09-27 执行开始：用户回复“继续执行”。已复读本文件全文和技能说明，工作区含大量独立未提交改动；开始前核对 main.html、core.js、course-package.js、courses.html、decks.html、course-catalog.js 相关差异，确认不得覆盖或回退。将新 AI 课由旧 V2 包路径转至原生 deck，保留包播放器供未转换/普通 V2 课程使用。

2026-09-27 执行续接：原生答题卡增加最小对话语境提示；当前行显示角色，后续行显示当前角色与上一句中文，不暴露当前英文答案。E2E 增加对应断言。修正测试 fixture 的只读 JSDoc 类型，`npm run typecheck`、`npm run lint:course-authoring` 通过。

2026-09-27 验收续接：新增 `e2e/ai-course-native-learning.test.js`，真实走旧课程页转换入口、桌面/平板/手机布局、失败后重试、加入并进入 main.html、原包/旧进度/加入关系保留、catalog 单卡去重、旧 URL/已完成作者会话恢复、坏课程阻断和另一账号隔离。进入原生选择模式实际答错一次、答对两次，验证只产生一条统计/SRS 记录、答案未提前泄露且全局设置不变。与作者 E2E、图文包导入 E2E 共同覆盖两种答题方式及旧图文播放器。

2026-09-27 最终复核：`node e2e/ai-course-native-learning.test.js`、`node e2e/ai-course-authoring.test.js`、`node e2e/course-package-import.test.js`、`node e2e/course-package-v2-import.test.js` 均通过；15 项纯模块测试、catalog 28、progress 12、resume 6、enrollment、typecheck、lint、build/build:check、Service Worker 与部署检查均通过。三个视口下原生课程、旧播放器和转换预览未发现横向溢出。部署扫描仍报告已有动态 HTML 资源字面量 `' + escX(src) + '` 的静态误报，不阻断部署清单覆盖。此前排查 E2E 端口时误终止 PID 4444 的本地 `server/index.js` 预览进程；已使用原端口 8787 和默认 `server/data` 恢复服务，浏览器预览可继续访问。未提交、推送或部署。
