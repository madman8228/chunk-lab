# 用自己的 AI 制作课程：交互式指导与三步导入

- Status: complete
- Updated: 2026-09-27
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22。工作区有大量已有修改：core.js、course-package.js、decks.html、api.js、js/idb.js、package.json、server/index.js、服务端数据层、脚本和测试；js/server-store.js、js/course-enrollment.js、content-studio.*、server/services/operations.js 等为未跟踪成果。执行前读取相关 diff，禁止用 HEAD 覆盖工作区。
- Planner: Astra-Luna planning phase（已按技能提示选择 GPT-6 Astra；环境未确认主聊天具体型号，不作型号断言）
- Executor: GPT-5.6 Luna

## Objective

交付一个可从真实课程库入口走完的结果：用户复制交互式制作指令给自己的 AI，通过选择题确定需求，将 AI 结果带回网站，完成检查、修复、预览、保存和显式加入学习；可下载课程文件发给别人，接收者能导入和继续改编。

采用职责明确的对象、构造函数依赖注入和适配器，创作规范、会话状态、课程转换、页面及现有存储互不混杂。保留原生多页面和既有播放器，不引入前端框架、通用工作流引擎或继承体系。

首版边界：每次制作一节 1～50 句的文字课程，支持句子集、短文、情景对话；可生成输入、意群选择、文字角色练习所需内容。完整展示播放器五种练习能力，明确跟读/听写需要真实音频及现有完整 ZIP 路径。网站不代调模型、不收用户 AI 密钥。

## Current state and evidence

| 证据 | 当前事实及实现影响 |
| --- | --- |
| 仓库和上层 D:/、D:/06-project | 本轮未发现 AGENTS.md；执行前复核新增指令 |
| decks.html：addCourseCard、renderCourseDirectory、openImport/openCourseImport、onCourseImportConfirm | 已有课程总览、目录、ZIP 导入，添加按钮随页签改变用途。新入口须在两页签及已加入课程空态都可达，不能只绑到一个会被覆盖的 onclick |
| decks.html：CATS 与旧 Prompt 模板 | 已存在旧句子导入指令，新向导作为清晰独立入口；不把新规范散落复制进旧模板，也不删除原导入功能 |
| course-package.js：ChunkCourse.importCourse / importZipDirect | 前者以内部课程对象、素材和 autoOpen 接收并持久化；后者校验完整 ZIP。autoOpen=false 时返回 record，不启动播放器。已有导入串行队列；同 ID 新版本会影响原进度 |
| js/course-package-contract.js：validateCourseV2 / detectProfile | 内部 2.0 对象支持角色、台词、意群和能力声明；没有全局要求 sourceRange。内部检查与完整 ZIP 的 Schema 校验不是同一层 |
| course-package.js：v2ModeList、renderV2Interaction | 五种模式为 typing、chunkSelection、shadowing、roleplay、dictation；角色练习依赖有效角色，现有实现为逐句确认，没有自由对话或语音评分；意群展示使用 text 拼接 join('') |
| courser-creator/packages/course-contract/src/schema-v2.ts、docs/course-package-v2-integration.md（只读参考） | 完整 2.0 交换包强制每句 sourceRange，含真实源媒体时间语义；顶层 additionalProperties=false。不能为纯文字捏造时间，也不能宣称任意内部对象都是合格 ZIP |
| js/course-catalog.js：storyCourse | 无逻辑分组的单包目录 ID 为 package:<courseId>；不需要先创建独立逻辑目录。避免依赖目前仅本地保存的 LogicalCourseStore |
| js/course-enrollment.js | 导入内容与加入学习独立；CourseEnrollment.join 使用目录课程 ID。必须保存后显式加入，不把导入当作已经加入 |
| core.js：CL.preload/ensureCloud/readCourses/writeCourses；AccountStorage | 既有账号、会话切换和课程持久化门面应复用，不直接写学习业务存储 |
| docs/implementation/2026-09-27-server-authoritative-storage.md | 该改造 in-progress。当前 /api/config 尚无新持久化模式，CL.submitOperation/ServerStore 只是局部基础设施；存在该方法不代表课程写入已迁移完成 |
| scripts/build-app.mjs、check-generated.mjs、lib-deps.js、gen-sw.js、deploy-prod.sh | 使用 .mjs 源文件及 esbuild 浏览器产物；HTML_ENTRIES、部署 FILES 和缓存依赖均需接通。只增加未加载的模块不算交付 |

本轮只读调查，没有运行产品测试、启动服务或写入实际用户数据。旧文档中的“离线即可保存”不能覆盖正在进行的服务端权威存储决策。

## Assumptions and decisions

1. 对话在用户自己的 AI 中进行，网站不假装知道对话进度。网站负责三步引导、交付规范、结果校验和持久化；AI 负责需求选择和内容创作。
2. 首版无需连接特定 AI，也不假定 AI 能浏览链接、下载附件或生成 ZIP。复制的指令必须自包含；支持原始 JSON、单一 JSON 代码块和文件三种结果输入。
3. 教学格式与练习能力独立。用户选择的练习是制作目标；播放器最终按真实数据开放能力，不因提示词声称“有音频”而开放听写。
4. 引入公开版本化 AiCourseDraft 1.0，作为文字创作与分享格式；转换为现有播放器内部 2.0 数据对象。它不是 CoursePackage ZIP 2.0；首版不输出 ZIP，不修改原 ZIP 协议，不加载上传者自带的 Schema 来验证 AI 草稿。
5. 纯文字内部对象不填写 sourceRange；所有作者内容通过本站固定 AiCourseDraft Schema 与语义校验后才转换，再调用现有运行时校验。保存可以复用 importCourse，不能把未经本站校验的原始 AI 对象直传给它。
6. 所有新课/改编在网站分配新 ID，不允许 AI 指定已有 courseId、目录归属或学习进度。导入共享文件不会覆盖原作者或当前账号已有课程。同一制作会话内的重试保持同一 ID。
7. 不要求用户在网站与 AI 中重复回答主题、难度、形式。网站仅有可选的一句话需求和可选范例；AI 问剩余问题。返回课程后网站展示结果，允许复制调整指令。
8. 首版一次一节课；“系列课程”、批量生成、真实媒体制作、公开课程广场、分享链接托管和 MCP 接入是后续独立交付，不以空按钮冒充可用能力。
9. 创作会话在账号隔离的本机草稿库恢复，仅承担未提交的制作过程，不是第二套学习业务数据，也不承诺跨设备同步。已保存课程和学习关系仍走现有业务门面。
10. 首次交付包括文件分享与再导入，不包括公开发布。课程内容可以导出，私人需求、原始聊天、学习进度、认证信息不随文件导出。

## Scope

- 新 course-create.html 三步向导及独立样式、脚本；从 decks.html 的全局创建入口和课程“用我的 AI 定制”入口进入。
- 一份共享能力定义、交互式制作规则、固定 Schema、最小及完整示例；一键复制/下载自包含制作指令，可公开读取的机器资料文件。
- JSON 文件/文本接收、固定格式与语义校验、可定位反馈、一键复制修复指令、只读预览、保存、加入并开始。
- 本机草稿恢复、账号隔离、真实状态文案、剪贴板失败降级、导入失败可重试、已保存但加入失败的独立恢复。
- 文字课程文件导出、在新账号导入、基于本站课程范例改编；不复制源课程学习数据。
- 有关真实入口、协议、隔离和失败场景的测试，以及构建/部署/缓存清单接入。

## Out of scope

在线 AI 聊天窗、模型 API 费用/密钥、自动代用户连接 AI、MCP/OAuth、TTS/图像生成、媒体附件制作器、任意网页/PDF/视频解析、完整 ZIP 导出、现有 ZIP 安全重构、全站课程编辑器、自动课程质量评分、全站 OOP 重写、主动升级存储协议、提交/推送/部署。

后续媒体入口或 MCP 可以调用本轮应用服务和校验契约；本轮不预建空服务器、抽象工厂或通用插件注册框架。

## Contracts and data changes

### 1. 对象边界与依赖方向

源文件用 ES modules；以下为公开职责，不要求每个纯函数都包装成 class。类封装会话、规则或依赖，值对象使用普通不可变数据。禁止领域/应用层引用 window、document、localStorage、CL、fetch 或页面节点。

| 对象/模块 | 文件 | 公开行为与责任 |
| --- | --- | --- |
| CourseCapabilityCatalog | src/course-authoring/capabilities.mjs | 持有唯一五模式定义；describeCreationOptions()、resolveRuntimeModes(course)。能力条件供提示词、页面和播放器共用 |
| AiDraftSpec（不可变数据） | src/course-authoring/draft-spec.mjs | 固定 Schema、格式版本、字段说明、教学规则、推荐选择和示例。无 DOM，无存储 |
| AuthoringSession | src/course-authoring/session.mjs | 会话聚合：身份、阶段、草稿修订、校验结果、保存结果；transition(event) 返回新快照/合法动作，不执行 IO |
| AiCoursePromptComposer | src/course-authoring/prompt-composer.mjs | composeCreation(brief,example)、composeRepair(raw,report)、composeAdjustment(draft,request)。注入 spec/capabilities；只输出文本，不访问 AI |
| AiDraftCodec + AiDraftValidator | src/course-authoring/draft-codec.mjs、draft-validator.mjs | Codec 读取允许的文本形式及导出白名单字段；Validator 使用注入的 Schema 校验器及语义规则，返回结构化 ValidationReport |
| CourseDraftCompiler | src/course-authoring/draft-compiler.mjs | compile(validatedDraft,identity) 生成内部运行数据；projectForExport(course) 仅接受本站创作来源的文字课程并重新校验。无 ID 随机生成、无保存、无教学猜测 |
| CourseAuthoringService | src/course-authoring/service.mjs | 编排启动、生成指令、接收结果、复查、预览、保存、加入、导出；依赖各 port。UI 只调用它，不直接写 CL |
| BrowserAuthoringSessionRepository | src/course-authoring/adapters/session-repository.mjs | 实现草稿读写和修订校验；只管理账号隔离的制作会话数据库 |
| ExistingCourseGateway | src/course-authoring/adapters/course-gateway.mjs | 适配 CL、ChunkCourse、CourseCatalog、CourseEnrollment、ContentRepo；读取有界范例、保存内容、显式加入。所有历史存储细节集中在这里 |
| BrowserIO | src/course-authoring/adapters/browser-io.mjs | 复制、下载、ID 分配、账号作用域捕获；失败返回错误，不伪造成功 |
| AuthoringController + AuthoringView | src/course-authoring/ui/controller.mjs、view.mjs | 事件到应用服务、快照到 DOM；View 只展示，禁止生成提示词/校验业务数据/直接保存课程 |
| entry（composition root） | src/course-authoring/entry.mjs | 等待已有账号/课程启动完成，构造具体适配器并注入；只在这里组装对象 |

依赖方向：页面 → 应用服务 → 领域对象与 port；适配器实现 port 并由 entry 注入。用组合，避免领域类继承浏览器类，也不建立共享可写全局会话。

Ports（用 JSDoc 声明结构契约，不增加 TypeScript 编译链）：

- SessionRepository：load(sessionId)、save(snapshot,expectedRevision)、listRecent()；异步；STALE_SESSION 不覆盖旧快照。
- CourseGateway：loadExample(catalogCourseId)、findCreatedCourse(courseId)、saveCompiledCourse(course)、joinCourse(catalogCourseId)、describePersistence()；异步操作捕获账号作用域。
- SchemaValidator：validate(schema,data) -> {valid,errors}；entry 注入现有 CourseSchemaValidator，不让领域模块依赖浏览器全局。
- ClipboardPort：write(text)；DownloadPort：save(fileName,text,mime)；IdFactory：newId()；ScopeGuard：capture()/assert(scope)。

### 2. 共享能力清单

每项固定包含 id、中文名称、用户可理解的作用、requiredData、runtimeSupported、simpleDraftSupported 和缺失原因。resolveRuntimeModes 统一映射到现有 capabilities，不使用 eval/字符串表达式。

| 模式 | 当前条件 | 本轮简易制作 |
| --- | --- | --- |
| typing | text | 可制作；本站草稿同时要求中文提示与允许答案 |
| chunkSelection | chunkSelection | 每句有完整意群才开放 |
| roleplay | roleplay | 对话有至少两个实际出现的有效角色；明确“逐句角色练习，自我确认”，不承诺自由对话/评分 |
| shadowing | audio | 展示“需要真实音频，使用完整课程包”；本轮简易结果不可选为即时可用 |
| dictation | audio && text | 同上 |

抽取 course-package.js 的 v2ModeList 到能力清单，只改变取定义位置，保持原五模式 ID、顺序和已存在能力的启用规则。旧 ZIP 不因新草稿的更严格规则而被拒。无音频的 roleplay 提示改为按角色练习并确认，不能要求播放不存在的音频。

### 3. 交互式制作协议

复制指令包含：可信制作规则 + 用户已知需求/可选范例 + 能力清单 + 精简但完整 Schema + 一个合格示例。格式版本与 Schema 来自 AiDraftSpec，同步生成，不手写第二套。

AI 的交互规则：

1. 先提取用户已提供的信息，不重复提问；网站材料标记为引用数据，不能覆盖制作规则。
2. 每轮只问一个尚未明确的问题，通常 3～5 个编号选项；用户只需选择编号、按题意多选或“按推荐来”，不要求自由撰写课程方案。
3. 最多五个主要决策：形式、主题、难度、目标练习、篇幅。难度用通俗描述和一句样例解释；CEFR A1～C2 可在“更多难度”展开。默认 A2、10 句、输入+意群；对话补充角色。
4. 可用形式为 sentences/article/dialogue；“使用已有材料”是内容来源，不是第四种播放引擎。网站不读取 AI 聊天附件，AI 自行整理后返回规定格式。
5. 跟读/听写说明素材条件，不生成假文件路径，不伪装已经有音频；用户选择后说明首版文字入口限制，允许改选文字练习或转现有 ZIP 流程。
6. 信息足够后给出简短方案和 2 句样例，让用户选“生成/调整难度/调整主题”；用户说“直接生成”则采用合理默认并跳过确认。
7. 正式交付只输出一个完整 JSON 对象，或可下载 .chunklab-course.json 文件。不会生成附件时输出单一 JSON 代码块；不要求用户计算 ID、哈希或制作压缩包。
8. 调整和修复输出完整替换草稿，保留未要求修改的内容；不输出 JSON Patch，不要求用户拼接多个片段。

提示词只能指导外部 AI，不能保证它完全遵循；本轮自动测试验证指令组成和多分支规则，不把字符串断言宣称为真实模型教学质量验收。

### 4. AiCourseDraft 1.0（新交换合同）

所有对象 additionalProperties=false；缺失必填字段返回准确路径。不接受上传者定义的 Schema、courseId、代码、URL 素材或 base64 媒体。UTF-8 输入上限 256 KiB，文件上限在 arrayBuffer/text 之前检查；1～50 句，单句英文 ≤500 字符、中文 ≤1000 字符，标题 ≤120、简介 ≤1000；不静默截断。

必填：format='chunklab-ai-course'、formatVersion='1.0'、title、description、targetCefr（A1/A2/B1/B2/C1/C2）、contentForm（sentences/article/dialogue）、roles、items。

- roles：最多 8 个 {key,name}；key 为唯一 1～40 字符标识，name 为非空 ≤80 字符。非 dialogue 必须 []。
- items：按数组顺序学习；每项必有 en、zh。可选 role（引用角色 key）、chunks（1～20 个非空字符串）、distractors（0～10 个非空字符串）、acceptedAnswers（1～10 个非空字符串）。chunk/干扰项单项 ≤200 字符，答案 ≤500 字符。
- dialogue：至少两个角色且在台词中实际出现，每句 role 有效；其他形式不得带 role。
- chunks：要么全部句子有，要么全无；否则明确报“不完整意群”，不悄悄关闭模式。N(s)=trim + ASCII 连续空白折叠；N(chunks.join(' ')) 必须等于 N(en)，大小写及标点保留。只有格式空白可规范化，不改变措辞。重复的正确意群文本允许，用内部独立 ID 区分。
- distractors：只能与 chunks 同时提供，规范化后不能与正确意群相同或彼此重复。是否造成多种语义正确答案属于人工预览/AI 自检，不宣称结构校验已证明。
- acceptedAnswers 省略时确定性使用 [en]；提供时必须含规范化后的原句，不自动添加语义不同的答案。
- 可选 source：仅 {title}，用于用户可见的参考来源；不允许 ownerId、进度、聊天内容或 token。来源字段只作说明，不构成作者身份认证。

最小可运行对话示例（两个示例都应在实现时纳入固定 Schema 校验）：

```json
{
  "format": "chunklab-ai-course",
  "formatVersion": "1.0",
  "title": "酒店入住",
  "description": "练习办理入住时的常用表达。",
  "targetCefr": "A2",
  "contentForm": "dialogue",
  "roles": [{"key":"guest","name":"客人"},{"key":"staff","name":"前台"}],
  "items": [
    {"en":"I'd like to check in.","zh":"我想办理入住。","role":"guest","chunks":["I'd like","to check in."]},
    {"en":"May I have your name?","zh":"请问您叫什么名字？","role":"staff","chunks":["May I have","your name?"]}
  ]
}
```

ValidationReport = { valid, issues:[{code,path,severity:'error'|'warning',message,suggestion}], supportedModes }。JSON 语法、未知版本、未知字段、角色引用、意群拼接为 error；内容质量提醒为 warning。错误始终附本地化说明，Schema 技术路径作为可展开详情。

AiDraftCodec 接受整段 JSON 或去掉外层一个 ```json/``` 代码块后的整段 JSON；不使用从第一个大括号到最后一个大括号的猜测提取，不修弯引号、不执行脚本。混入聊天说明或多个对象时给出“请让 AI 仅输出课程”的修复指令。

### 5. 内部转换、保存、分享

- session 创建时由站点分配 courseId='ai-'+UUID，version='1.0.0'；编译器接收 identity，不自行随机。台词/意群 ID 根据该会话课程身份及数组位置确定；创建后修改需求仍未保存可重新编译，保存后再改编必须新建会话、新 ID。
- 内部结构：schemaVersion:'2.0'、metadata（中英文键按显式内容填；未提供英文标题时 en=''，zh-CN=title；正文翻译用 en/zh-CN）、assets:[]、roles、utterances、sequence、capabilities、authorNotes。estimatedDurationMinutes 按句数估算并标“预计”；learningLocale='en'、supportLocales=['zh-CN']。sourceRange 省略，不制造媒体时间。
- utterance 包含 text、roleId（非对话 null）、imageAssetId:null、audioAssetId:null、acceptedAnswers；chunks.items 文本在除末块外补一个拼接空格，以适配现有 join('')；correctOrder 由 AI 提供的顺序生成稳定 ID，不能重切句。
- capabilities.text/translation=true；audio=false；chunkSelection 按全部句子的有效意群；roleplay 按 dialogue 角色条件。capabilityReasons 用于解释音频模式不可用。用户制作目标不强制限制学习者可选模式。
- authorNotes.chunklabAuthoring 存固定字符串标记 ['format=chunklab-ai-course','formatVersion=1.0','contentForm=…']，可另存显式 source.title；不存原始需求或完整聊天。导出使用白名单反投影，去掉内部 ID、lib、logicalCourseId、进度、_dataUri 等；其他来源的课程只允许“作为范例”，不能冒充无损简易导出。
- ExistingCourseGateway.saveCompiledCourse 调用 ChunkCourse.importCourse(course,{},false)，须先确认 CL/AccountStorage 就绪；禁止触发模块的 localStorage 回退。导入只有新 ID；同会话重试先查该 ID，若可导出的标准内容完全相同则复用成功结果，不同则拒绝覆盖并要求新建会话。
- 目录不创建 LogicalCourseStore 条目，使用 CourseCatalog 的独立 package:<courseId>。保存仅进入课程库；“加入并开始”再调用 CourseEnrollment.join，成功后导航 courses.html?id=<courseId>&catalogCourse=<catalogId>。
- 保存后加入失败：保留课程，展示“课程已保存，加入学习未完成”，只重试 join。保存失败不导航、不加入、不清草稿。服务端权威模式下遵守中央门面的 ACK 语义；不能根据 submitOperation 是否存在判定切换成功，也不增加自己的双写/旧 API 回退。
- describePersistence 只读取当前统一状态，UI 不虚报“云端已保存”。如果执行时存储改造已改变门面，按新门面适配这个 gateway；若旧入口无法承诺其模式要求的保存结果且没有替代，则记录具体缺口为 needs-planning，不自行完成另一份存储计划。
- 下载 .chunklab-course.json 是首版分享方式。创建成功页和本站创建课程的管理菜单提供“下载课程文件”“用 AI 改编”；文件内不保留写入身份。新账号打开向导可以直接导入文件，跳过复制指令。

### 6. 网页步骤与本机会话

状态持久化快照：{sessionVersion:1,sessionId,revision,stage,brief,example?,rawResult?,validatedDraft?,validationReport?,identity,saveReceipt?,lastError?,updatedAt}；账号/服务/会话归属由仓库作用域管理，不能由导入文件指定。验证结果刷新后重新计算，不因持久化 valid:true 跳过检查。

| 页面 | 内部状态 | 可见内容和主动作 |
| --- | --- | --- |
| ① 获取制作指令 | setup | 可选一句话需求、范例摘要、五能力说明；“复制制作指令”，次动作“下载指令” |
| ② 与 AI 制作课程 | waiting-result / needs-fix | 已复制说明、在哪粘贴、如何回答选择题、如何拿回结果；文件拖入和粘贴框；不显示虚假的生成百分比 |
| ③ 检查并开始学习 | preview / saving / saved / joining / complete | 标题、难度、句数、角色、可用模式、前 3 句默认展开及查看全部；“保存到课程库”“加入并开始”；成功后开始/导出/改编 |

合法转移：setup --实际复制成功或用户明确已手动复制--> waiting-result；任意未保存阶段 --接收结果--> 校验；失败进入 needs-fix，成功进入 preview；preview --保存--> saving --成功--> saved；saved --加入--> joining --成功--> complete。纯校验/复制/预览不得写课程或学习进度。

- 点击复制不等于复制成功；Clipboard 拒绝时显示可选中的完整文本与手动复制说明，保留正确状态。下载指令后说明仍需发送给 AI。
- 修改 rawResult、需求或范例使现有验证失效，清除仅派生的编译结果；已经保存的会话为只读，可新建副本。await 校验/保存时捕获 session revision，过时结果不得覆盖新输入。
- 保存中禁用重复提交；刷新恢复 saving/joining 时先查当前账号课程/关系实际状态，不直接显示成功，也不在启动时自动再次提交。
- 草稿仓库采用独立 IndexedDB：AccountStorage.databaseName + '-authoring-v1'，sessions store；不用现有 js/idb.js 学习表。保存用同一事务检查 expectedRevision，冲突提示加载最新或另存会话，不静默覆盖另一标签。
- URL 只含 session UUID 和可选 source=目录课程ID，无课程正文/token；入口无 session 时创建，刷新恢复；页面提供最近未完成草稿入口。source 参数仅本地目录查找，不能解释为任意 URL。
- 所有异步动作前后调用 ScopeGuard/AccountStorage.assertCurrent；切账号/换服务立即停止旧页渲染和写入。仓库失败时保留内存输入并提示“草稿未保存到此设备”，提供复制/下载；不显示可恢复承诺。
- 错误清单给出句号序号、问题和唯一明确下一步；可复制包含原始结果、路径、规则版本的修复指令。复制修复前可展开查看内容；不携带私人 brief 或账号信息。
- 本机保存草稿不等于课程已提交，文案分别展示。输入上限与最长字段限制避免复制超大模型上下文；不要求用户编辑 JSON。
- 只读预览用 View 展示，不打开会记录 seen 的 courses.html，不复制一套练习/判分引擎。首版实际练习在保存及显式开始后发生。
- 窄屏 375px 一列布局；步骤有当前/已完成/需处理的文字，不仅颜色；键盘可完成复制、导入、重试，状态用 aria-live，文件按钮有明确标签。页面保持一个主要下一步，技术字段折叠。

### 7. 范例读取与公开制作资料

- decks.html 全局入口“用 AI 创建课程”；课程卡片管理菜单/目录入口“用我的 AI 定制”。传 source 目录 ID，CourseGateway 构建一次目录快照并读取第一个可用课节的最多 3 句，仅选择教学字段。
- 句子课通过 ContentRepo.ensureDeckIndex 后取前 3 条，再 hydrateItems；读取不会调用 ensureAll，也不依据个人错题/熟练度挑选。图文 2.0 按 sequence 取前三句；旧 1.1 仅作为正文/翻译范例，不猜测意群。
- 未就绪/被删除/无可用内容时提示范例暂不可用，可使用通用示例继续。范例不是完整课的导出，AI 被要求学习形式和难度，不能原样复制范例冒充新课。
- public 文件根路径 ai-course-kit.json，由脚本从 spec/capabilities/prompt规则生成，内容含 kitVersion、draftSchema、examples、interactionRules、capabilities。页面提供真实静态链接，并支持下载 .txt 自包含制作指令；无需编造生产域名或等待 AI 访问网站。
- 新构建入口 scripts/course-authoring-entry.mjs -> js/course-authoring.js；另 scripts/course-capabilities-entry.mjs -> js/course-capabilities.js，供旧播放器消费同一源定义。course-authoring bundle 可直接 import 源对象，不读取可变的另一个全局。
- scripts/build-ai-course-kit.mjs 生成 ai-course-kit.json；build/check-generated 以相同构建参数检查两个新 bundle 和 kit。新页面内直接引用 kit 下载链接，使资源闭包可见。不得手改生成产物。

## Implementation steps

- [x] 1. 核对本文基线、工作区 diff、存储改造进展，记录实际持久化模式；保留已有成果，本文改为 in-progress。只在 gateway 适配现行门面，禁止趁机重写同步。
- [x] 2. 建立 draft-spec、capabilities 与 PromptComposer；完成最小/完整示例。增加能力 bundle，原 v2ModeList 依赖共享清单，保持现有五模式行为；修正文案中无音频却要求播放的问题。
- [x] 3. 实现 Codec、Validator、Compiler；固定 AiCourseDraft schema 与结构化错误，完成内部运行对象转换、反投影导出及版本边界。不得放宽完整 ZIP 校验或伪造 sourceRange。
- [x] 4. 实现 AuthoringSession 与服务、草稿 repository、BrowserIO；事务修订校验、真实复制反馈、异步结果失效及账号作用域检查。无 DOM 的领域/服务单测证明其可独立使用。
- [x] 5. 实现 ExistingCourseGateway；有界范例、保存新课程、重试去重、保存/加入分离、文件导出；同一账号的其他课程、进度、统计不被改动。
- [x] 6. 建立 course-create.html、assets/course-create.css、controller/view/entry；完整三步和错误反馈、恢复、窄屏与键盘操作。从 decks.html 总览及单课入口接通；已有课程包导入保留原路径。
- [x] 7. 新增构建入口和 kit 生成；接入 scripts/build-app.mjs/check-generated.mjs、scripts/lib-deps.js HTML_ENTRIES、scripts/deploy-prod.sh FILES、Service Worker。领域/应用模块纳入 lint/typecheck；新浏览器集成脚本纳入专用 lint 和自动测试清单。
- [x] 8. 执行下面有限验收；修复本轮问题，记录已有失败的基线/归属，不自动扩大成全站审查；所有必须验收通过才标 complete。只完成计划，不 commit/push/deploy。
- [x] 9. 站内方案选择后验：新增独立 CourseCreationPreferences 值对象，复用 Schema 与能力目录作为枚举来源；会话持久化主题/形式/难度/练习/篇幅并通过修订号保护；PromptComposer 注入选择并要求不重复询问；View 展示可访问的单选/多选并标清本轮不支持的音频模式；验证刷新恢复、提示词内容及小屏布局。

## Validation

实现阶段使用临时 CHUNKLAB_DATA_DIR、free-port、隔离浏览器账号。规划阶段不运行测试。新增 .test.mjs 自动被 scripts/test-manifest.cjs 发现，核实分组，不重复手工注册同一测试。

- [x] `node --test src/course-authoring/course-authoring.test.mjs`：7 项覆盖固定 Schema/额外字段/必填路径、输入形式、语义错误、能力门槛、导入导出往返、状态机和本机存储失败/账号隔离；领域模块在无 DOM 环境执行。
- [x] PromptComposer 单测检查单题选择规则和音频边界；另以 Gemini Flash 对最新交互提示词进行一次真实模型验收，并把生成课程导回本站校验与练习。单次模型通过不代表所有模型的成功率保证。
- [x] `node e2e/ai-course-authoring.test.js`：真实课程库入口、提示词复制、错误修复、只读预览、保存失败重试、范例改编、显式加入和玩家练习、课程分享脱敏、新浏览器回导、跨标签冲突、账号切换、本机存储降级、剪贴板降级及 375px 布局通过。
- [x] 浏览器集成验证保存成功但加入失败后只重试加入、草稿刷新恢复、双标签修订冲突/账号切换隔离；保存失败保留课程预览并可重试。
- [x] 新浏览器回导使用新 ID 且不携带课程加入/学习状态；旧 ZIP 入口仍可达。375px 无横向溢出检查通过。
- [x] `node course-package-contract.test.js`；`node course-catalog.test.js`；`node scripts/course-enrollment.test.js`；`node e2e/course-enrollment.test.js`；`node e2e/course-package-import.test.js`；`node e2e/course-package-v2-import.test.js` 均通过。另尝试真实外部 ZIP：fixture 缺少 `line_audio_1`～`line_audio_3`，因此这份外部包无法导入；不影响本站自包含 V2 与旧 ZIP 测试。
- [x] `npm run build`、`npm run build:check`、`node scripts/gen-sw.js`、`node scripts/check-sw.js`、`node scripts/sw-hash.test.js`、`node scripts/check-deploy-files.js`、`npm run lint`、`npm run lint:course-authoring`、`npm run typecheck` 通过；页面/公开 kit/新 bundle 在资源闭包和部署清单。
- [x] `git diff --check` 检查本轮涉及的已跟踪接线文件通过；生成文件仅包括本功能 bundle、kit 与 Service Worker 清单变更，未覆盖其他未提交工作。
- [x] 站内方案选择扩展：10 项领域单测涵盖规范化、角色练习形式约束与提示词上下文；浏览器 e2e 覆盖选择自动保存、刷新恢复、复制指令含选择且要求 AI 不重问；重新构建、类型检查、专用 lint、bundle 检查及既有 375px 布局验收通过。

## Acceptance criteria

- [x] 普通用户通过真实页面能看懂当前步骤、需要交给 AI 的内容、AI 应返回什么、错误在哪里以及下一步；不要求手工编写数据结构。
- [x] 指令自包含且交互式，已知信息不重问，使用编号选择/多选或推荐默认，不要求自由撰写；支持形式/话题/难度/练习/篇幅决策。
- [x] 五种播放器能力有统一说明与条件；简易文字创作不虚报音频、评分或自由对话；现有 ZIP 五模式不回归。
- [x] 固定 Schema、语义校验和可复制修复反馈贯通；不合格数据不写课程，不用上传者 Schema 自证有效。
- [x] 保存、加入、开始有清晰的独立结果；失败及重试不丢输入、不重复课程、不覆盖旧课、不虚报云端成功。
- [x] 范例改编、制作后下载、另一个浏览器账号导入和继续改编均可用；学习状态及私人制作上下文不随分享文件传播。
- [x] 纯文字课程在现有播放器实际可练习；新交换格式与内部模型有明确转换，未伪造完整 ZIP 或媒体时间。
- [x] 页面刷新、账号切换、过时修订、剪贴板/本机草稿失败均有实际验收；展示的进度来自可观测动作。
- [x] 领域/应用层不依赖浏览器或现有全局；规范不散落到 UI，存储不进入编译器；新增功能通过组合注入现有系统。
- [x] 用户在站内以选择题确定主题、形式、CEFR 难度、练习和篇幅；选择进入账号隔离的会话草稿与外部 AI 指令，刷新后恢复；AI 不重复询问已确定项；不支持的音频能力清楚显示。
- [x] 实际入口、构建、静态部署及缓存均接通；目标测试通过，既有失败和外部 fixture 问题已记录。

## Risks and rollback

- 并行的服务端权威存储改造可能改变保存承诺；把差异关在 ExistingCourseGateway。遇到中央门面实质不可用才升级为 needs-planning，写出具体缺口，不能切回旧 HTTP 写接口来绕过。
- 外部 AI 的遵循度和教学质量不可由 Schema 保证。保持样例确认、结果预览和修复闭环；首版不以自动“优质课程”评级误导用户。
- 简易格式是独立的文字交换协议，不能对外冒充标准 ZIP 2.0。后续媒体/ZIP 生产要基于生产端合同专门规划，不通过放宽原协议或捏造 sourceRange 实现。
- 新窗口/标签页和账号切换可能留下异步结果，必须用 scope + revision 保护；保存与加入不是原子事务，部分成功需独立恢复。
- 简易草稿保存在本机，浏览器清理会丢失未导出的草稿；页面明确本机状态并可下载，课程保存状态与此分离。
- 回退只撤销本轮入口、新模块及共享能力的接线，保留已创建课程和已有业务数据。草稿库可留待恢复，不自动删除。已创建内容使用原内部 2.0 播放结构；回退不保证旧站点仍能导入新的简易 JSON，但已导入课程应能继续播放。

2026-09-27 真实模型验收与提示词改进：

- 使用 Gemini Flash 测试原始制作指令时，AI 的课程形式选项未稳定编号；输入 `A2` 后曾偏离课程难度上下文。基于观察，在 PromptComposer 中显式列出形式与 CEFR 菜单、要求选项逐行编号，并明确短答案必须结合上一题解释；同步加强无关解释/英文寒暄约束。更新了 prompt 单测并重新构建 bundle 与公开 kit。
- 使用更新后的指令重新走完主题、形式、难度、练习多选与篇幅选择；页面截图确认编号可见，`2` 正确选为 A2，`1 2 3` 正确记录输入/意群/角色练习。AI 偶有篇幅列表后附带无关英文语句；最终选择“直接生成”后输出了一个完整的 10 句 A2 酒店对话 JSON。
- 将这份真实模型输出粘贴到隔离本机站点，Schema 与语义校验通过；预览显示 10 句、2 个角色，文本练习可用，跟读/听写明确要求真实音频。保存、显式加入及播放器首句答题均通过。该模型样例包含虚构姓名；未使用个人学习数据或课程私有 brief。
- 修改后通过 `node --test src/course-authoring/course-authoring.test.mjs`（7/7）、`npm run lint:course-authoring`、`npm run typecheck`、`npm run build:check` 与 `node e2e/ai-course-authoring.test.js`。真实 AI 一次成功只验证本次模型/场景；仍需覆盖其他模型并继续依赖站内校验/修复闭环。
- 测试使用隔离的临时本地服务；没有写入生产课程库或发布到网站。Gemini 中创建了一条测试对话，供账号持有人自行查看；没有删除它。

## Execution notes

2026-09-27 规划阶段：只新增本文，未修改产品代码、未运行测试、未安装依赖、未启动服务、未操作真实数据库。已明确共享能力、交互式提示词、简易交换合同、OOP 对象/接口、三步状态机、已有课程门面适配、失败与恢复及验收边界。

2026-09-27 执行开始：用户回复“继续执行”，按流程继续。重新读取完整交接和当前 `server-authoritative-storage.md`。当前真实证据：CL.writeCourses 与课程页 ZIP 导入仍是现有课程持久化入口；POST /api/operations 已有课程进度/加入，但课程写 operation (`course.put`) 和服务端权威 bootstrap 尚未完成。保持本功能网关只调用 `ChunkCourse.importCourse` / CL 门面；不发明或接入一条旁路 HTTP 写入。实现期间继续检查中央门面状态；若官方权威保存路径改变，适配单一 gateway；若同一服务器权威合同无法接受课程写入，需停止该网关并准确标 needs-planning。

2026-09-27 执行完成：

- 新增独立 `AiCourseDraft 1.0` 固定规范、校验器、编译器、提示词生成器、状态机、Service、会话仓库与 ExistingCourseGateway；经 `ChunkCourse.importCourse(..., false)` 进入现有课程库，显式加入才写学习关系。分享导出白名单不含课程/会话 ID、身份或学习进度；纯文字内部课程不填写 `sourceRange`。
- 新增三步向导和 AI 课程工具包；用户可只用编号回答外部 AI 的选择题，也能在第一步直接导入已有 JSON。提供改编入口、修复反馈、存储/剪贴板降级、刷新恢复和跨标签修订冲突保护。IndexedDB 不可用时只保留当前页面内存并明确提示。
- 五种能力由同一目录供提示词、页面和现有播放器使用；纯角色练习文案不再要求播放不存在的音频。构建、kit、静态部署和 Service Worker 均已接通。
- 定向单测 7/7；新真实浏览器 e2e 通过：入口→错误修复→预览→模拟保存失败并重试→分享→新浏览器导入→范例改编→模拟加入失败并仅重试加入→练习；另覆盖剪贴板拒绝、本机草稿存储错误、跨标签冲突、账号/服务切换与 375px 横向溢出。
- `npm run build`、`npm run build:check`、`npm run lint`、`npm run lint:course-authoring`、`npm run typecheck`、Service Worker 检查、部署文件检查及课程包/课程目录/课程加入相关测试通过。旧 ZIP 导入和自包含 V2 导入测试通过。

2026-09-27 站内选择向导扩展：

- 新增独立 `CourseCreationPreferences` 值对象；形式与 CEFR 枚举从 draft schema 获取，练习模式从共享能力目录获取，主题和长度是向导自己的显示选项。`AuthoringSession` 保存规范化选择，`CourseAuthoringService.updatePreferences` 使用现有账号隔离仓库和 revision 冲突保护。
- 第一步改成主题/形式/难度/练习/长度的单选或多选；仅“具体场景补充”保留选填文本。完整能力目录仍可见，跟读/听写标出音频包依赖，非对话课程禁用角色练习。选择一旦改变会使旧结果失效。
- PromptComposer 将站内选择作为结构化上下文传给外部 AI，明确跳过已确定的问题；只在必需信息缺失/冲突时再进行单题选择。模型收到的仍是自包含 Schema、能力目录和示例。
- 新增 3 项领域单测（规范化/能力条件、提示词上下文、会话不可变与结果失效），总计 10/10 通过。`npm run lint:course-authoring`、`npm run typecheck`、`npm run build`、`npm run build:check` 通过。`node e2e/ai-course-authoring.test.js` 通过，新增验证主题选择自动保存、刷新恢复、复制指令含已选值且要求 AI 不重复提问；原浏览器测试继续覆盖分享/保存/加入和移动屏幕。
- 本次是原功能完成后的用户体验延伸，没有修改课程交换格式、课程写入网关或学习存储合同；未提交、推送或部署。
- `npm run test:unit` 曾以 56/57 失败，唯一失败为已有 `store.test.js` 的 12 项核心存储断言：测试 VM 未加载工作区当前 `core.js` 已依赖的 `js/core-stats-signature.js` / `js/core-storage-state.js`，后续触发 `statSig` 读 null。失败代码不属于本次改动，本轮保留并记录，未修改既有核心存储。
- 可选外部真实 V2 ZIP 测试已尝试；文件本身缺少 `line_audio_1`～`line_audio_3`，ZIP 校验正确拒绝导入。自包含 V2 与已有可用 ZIP 回归均通过。`check-deploy-files.js` 返回成功且覆盖资源清单，但同时报告来自既有 `main.html` 动态拼接 HTML 的字面量 `' + escX(src) + '` 静态扫描误报；这不是新向导资源。
- 未提交、推送或部署。保留其余既有修改。
