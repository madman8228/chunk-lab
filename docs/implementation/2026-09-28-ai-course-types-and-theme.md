# AI 课程类型与制作页主题统一（复核修订）

- Status: complete
- Updated: 2026-09-28
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22
- Planner: Astra-Luna 规划阶段；沿用用户已建立的模型选择，不推断当前主聊天具体型号
- Executor: GPT-5.6 Luna
- Working tree: 大量既有修改；course-create.html、assets/course-create.css、src/course-authoring/、生成 bundle 与本计划未跟踪。CSS 已有上一轮未验收主题覆写。保留当前工作区，不按 HEAD 覆盖。根目录及上层未发现 AGENTS.md，执行前检查新增指令。

## Objective

制作页对齐课程库的暖灰/米白主题；课程类型只显示“句子课程”“图文课程”，两者都可用用户自己的 AI 制作，经过检查、预览、保存、加入后进入正确的既有学习页面，并能下载、分享和重新导入。沿用原生句子学习和现有图文播放器；领域模型、浏览器文件处理、草稿存储和业务存储通过组合与注入解耦。

## Current state and evidence

| 文件/入口 | 核实的事实与影响 |
| --- | --- |
| decks.html / assets/course-create.css | 主站 bg=#f4f2ee、surface=#fffdfa、surface-2=#f9f7f3、border=#dedbd4、text=#202326、muted=#5f5c55、accent=#2c62c9、accent-soft=#e8efff。制作页原有冷色硬编码及重复覆写，需要整理所有三步、错误与拖放状态。 |
| preferences.mjs / draft-spec.mjs | 当前三选项是内容组织 sentences/article/dialogue；它们都属于句子模板，不能简单把 article 改名为图文课程。 |
| service.mjs / ui/controller.mjs / ui/view.mjs | 接收、编译、保存、导出、收据恢复和开始链接均偏向句子课；controller 与 view 都写死 main.html 路由。 |
| scripts/course-schema-validator-entry.js | 只提供通用 validate(schema,data)，没有 validateV2，也没有内置“官方 V2 Schema”。旧规划关于该接口的假设错误。 |
| course-package.js:validateZipPackage / validateCourse | 标准 ZIP 使用包内 Schema，再执行 CoursePackageContract.validateCourseV2；直接 importCourse 只执行运行时结构/引用检查。新的 AI 输入必须使用本站固定 Schema，不能取用户传入的 Schema 自证有效。 |
| course-package.js:importZip / commitCourseImport / rebuildAssets | 业务持久化只保存 course；assets 映射仅本次播放有效。必须把经验证图片转成 assets[]. _dataUri（实际字段名 _dataUri，无空格）才能刷新恢复。 |
| course-package.js:openCourse / legacy-conversion.mjs | 带 format=chunklab-ai-course、formatVersion=1.0 的旧 authorNotes 标记会触发句子转换；新图文来源必须使用独立标记。 |
| js/course-catalog.js:storyCourse | 图文为 contentType=story、catalogId=package:<id>、lessonId=lesson:story-package:<id>；句子为 user-deck:<id>。 |
| capabilities.mjs / course-package.js:v2ModeList | 运行时按能力开放方式；目前未按新图文制作时选择的 modes 过滤。图文输入是整句输入；句子输入是按意群输入。不能混淆文案或虚报同一 SRS/错题统计。 |
| session-repository.mjs / resilient-session-repository.mjs | 账号隔离 IndexedDB v1 只有 sessions；CAS revision 保护在会话事务内。独立图片写入若没有同一事务，可能与草稿版本错配。 |
| core.js:writeCourses / server/index.js | 图文通过 CL.writeCourses 保存并调度同步，服务端 JSON 上限80mb；本地存储仍可能配额不足。不能承诺草稿跨设备或尚未确认的云端保存。 |
| 原实施文档 | 2026-09-27-ai-course-native-learning.md 和 native-entry.md 已完成，替代最早“一律编译为V2”方案。此次必须保留句子原生入口及旧课兼容。 |

## Assumptions and decisions

1. 用户已明确要求两类型实际可制作。本轮继续使用外部 AI，网站不接模型 API。图文需要真实图片文件；纯聊天模型可生成内容与逐图提示词，用户再用具备生图能力的 AI 生成图片。页面说明这个交付条件，不保证任何 AI 一次生成完整素材。
2. UI 偏好新增 courseType=sentence|imageText。旧会话默认为 sentence；旧 contentForm 保留为内部内容组织/兼容字段，句子 prompt 可按需求推断其值，但不再把短文、对话列为顶层课程形式。
3. 句子保持 AiCourseDraft 1.0/1.1 兼容。图文使用独立 format=chunklab-ai-image-text、formatVersion=1.0；不向旧 strict Schema 注入 courseType。路由只识别固定 format/version，禁止猜格式或执行导入内容。
4. 一个图片可关联多句。使用 images 清单和 items[].imageKey；避免旧规划“一页一张独立图片”的强限制。建议 AI 生成少量场景图片并复用；每句必须引用已定义图片，所有图片定义至少被一句引用。
5. 自动按安全文件名匹配；AI 下载文件名经常不同，必须提供图片缩略图与每个图片槽的选择/替换控件。用户不必改 JSON 或重命名。歧义禁止按上传顺序猜配。
6. 分享采用一个自包含 JSON 文件，图片编码为 base64；明确仅在网站导出时生成。无需新 ZIP 解析器/写入器，不让 AI 在对话里编造 base64。以有界文件大小换取实现、导入和分享的简单性。
7. 新图文草稿及编译产物用本站固定 Schema + 语义规则 + 既有 validateCourseV2 校验。后者是内部播放器合同，不宣称达到标准 ZIP 2.0；不伪造 sourceRange，不改变既有 ZIP 导入验证。

## Scope

主题统一、两个课程类型、各自提示词与固定合同、图片选择/匹配/校验、草稿图片原子存储、预览、正确编译与保存/加入/启动、携图分享与回导、图文来源改编、原有句子与 ZIP 行为回归。实现是一个完整交付，以下项目全部验收后才 complete。

## Out of scope

在线 AI/生图 API、音频/TTS/视频、远程图片抓取、公共发布/课程广场、标准 ZIP 导出、压缩包导入新协议、任意网页/PDF解析、全站编辑器、全站存储迁移或换肤、提交/推送/部署。图文仍使用现有图文学习记录，不扩展为句子 SRS。

## Contracts and data changes

### 1. 数据合同、限制与提示词

新增 image-text-draft-spec.mjs；Schema 全层 additionalProperties=false，必填字段固定：

- format='chunklab-ai-image-text'、formatVersion='1.0'；title 1–120字符、description 0–1000字符、targetCefr 为 A1–C2。
- learning={template:'image-text-practice',version:1,modes:[typing|chunkSelection],defaultMode}；modes 不空且唯一、defaultMode 在其中。本期两种模式，不引入角色确认、语音评分或音频要求。
- images：1–12项，{key,fileName,alt,prompt}。key 匹配 ^[a-z][a-z0-9_-]{0,39}$；alt 必填1–200字符；prompt 可选、最长2000字符，属于可分享教学素材说明。
- fileName 1–120字符，只允许字母/数字/下划线/连字符组成文件基名，扩展名 png/jpg/jpeg/webp；不含路径、URL、控制字符；清单内按小写唯一。实际上传文件可保留下载名称，通过配对后使用清单规范名。
- items：1–50项，{imageKey,en,zh,chunks?}，en 1–500字符、zh 1–1000字符；chunks 存在时为1–20个非空文本块，各最多200字符；空格拼接必须等于标准化 en。选择 chunkSelection 时每句必须有 chunks。不接受 hints、干扰项、替代答案、角色和任意渲染字段，防止接收后静默丢弃尚未接线的内容。
- 单份纯 JSON/TXT 最大256KiB，沿用旧上限；png/jpeg/webp 每张最大2MiB、独立图片总计最大8MiB、最多12张；每张长宽不超过4096且像素乘积不超过1200万。文件尺寸是硬限制，不暗中压缩改变图片。
- 新 image-media-policy.mjs 持有共享限制，UI、codec、validator、kit 共用；不得散落不同常量。

PromptComposer 选择对应 spec，只交付当前类型规范；句子保留旧生成规则。图文指令先确认需求、给图文样例，再生成 JSON 和具名图片/逐图提示词；说明用户可在网站手动配对不同文件名。AI 不生成 base64、不编造素材 URL。素材缺失给“上传/重新配对”操作；JSON 内容问题才复制给 AI 修复，修复指令不携带图片二进制。

公开 kit 保留原 draftSchema/examples 等句子键以兼容，增加 courseTypes 与 imageTextDraftSpec/mediaLimits；kitVersion 升为1.1。不让已用公开文件的句子流程突然失效。

### 2. 组合与对象边界

| 对象/文件 | 责任 |
| --- | --- |
| course-types.mjs / CourseTypeCatalog | 两类型唯一标签、模板说明、合同标识；偏好、UI、prompt共用，无可变注册器。 |
| image-text-draft-validator.mjs | 固定 JSON Schema、引用/意群/方式语义检查；纯数据，不解码图片或访问DOM。 |
| adapters/image-file-reader.mjs | 扩展名/MIME/真实签名校验、读取PNG/JPEG/WebP头部尺寸、再实际解码确认；逐文件处理并释放位图/URL；空MIME允许由签名推断，非空MIME与签名冲突拒绝；拒绝SVG/GIF等。 |
| image-text-compiler.mjs | 纯编译与白名单反投影；输入草稿、站点身份与已验证图片描述，无Blob/DOM/编码操作。输出无二进制的course模型。 |
| adapters/image-text-package-adapter.mjs | 从图片仓库物化data URI，先验证无_dataUri的编译模型，再附上可信图片内容并调用网关。 |
| image-text-runtime-spec.mjs | 本站生成的内部V2子集Schema；验证metadata/资源/utterances/sequence/capabilities/制作元数据，复用通用validate(schema,data)，不是不存在的validateV2接口。 |
| image-text-bundle-codec.mjs | 有界分享文件编码/解码，白名单导出；解码图片后仍交由同一图片验证器。 |
| service.mjs / entry.mjs | 注入两个具体类型处理器，按固定格式路由；统一会话、修复、保存和收据；controller只负责用户事件，view只接收预览模型。禁止通用插件引擎/继承体系。 |

领域层不依赖window、document、IndexedDB、Blob、全局CL；浏览器IO只在adapter。已有句子编译/校验器不塞入图文条件树；可用两个注入的处理器映射，不为单次调用再造抽象工厂。

### 3. 图片与会话事务

在现有账号隔离的 authoring-v1 数据库升级版本2，增加 assets store（复合键 sessionId,assetId）。复用同一连接管理；领域 port 分离，但适配器必须以 sessions+assets 同一 readwrite 事务提交会话revision和新增/替换/移除图片绑定。

- 扩展 SessionRepository.save(snapshot,scope,expectedRevision,assetDelta?)，旧调用保持有效；增加资产读取port供service/IO注入。会话只保留assetId、imageKey、规范名、大小、类型、尺寸和摘要，不写Blob/base64/dataURL。
- 图片读取、签名/尺寸/解码、SHA256在事务前完成；事务内只检查revision、当前scope并提交，不能await解码。失败不替换既有有效绑定。
- ResilientSessionRepository 同时支持会话与图片的内存事务降级；同一会话不能JSON降级而图片留在另一套状态。IDB失败时保留当前页数据并明确“关闭页面会丢失未下载素材”；无法承诺刷新不丢。
- 文件结果绑定开始时的scope和revision。切类型、修改JSON或另一个标签页更新后，过时读图结果不得提交。选择类型改变清除验证/编译结果；材料按引用重新协调，禁止自动删仍被当前草稿使用的图片。
- 不在页面打开时做全库垃圾回收；只有成功提交显式替换/移除才删除本session不再引用的Blob。存储quota失败保留旧成功事务与本次页内待保存内容。
- 已保存课程不依赖authoring数据库或blob URL；预览URL在替换、rerender及页面卸载时释放。

### 4. 编译、保存与真正学习入口

- 编译ID由网站提供，同session重试稳定。items顺序对应utterances/sequence；多句共图使用同一asset。每个asset type=story_image、安全站点路径images/<key>.<规范扩展名>、fileName与mime明确；每句imageAssetId、text.en/text.zh-CN、acceptedAnswers.en=[en]，角色为空、音频为空。
- chunks映射到现有items/correctOrder并在非末块补空格，保证播放器join('')还原英文；没有图文干扰项或hints传递承诺。
- capabilities.text/translation按真实数据，audio=false、roleplay=false；chunkSelection按内容。新增authorNotes.chunklabImageText制作元数据，包含format/version、learning与可逆图片key/说明；禁止复用旧chunklabAuthoring 1.0标记或legacySource。
- capabilities.mjs对精确识别的新图文元数据，将可用模式与声明learning.modes求交，并提供未选择原因；旧外部V2保持原有模式行为。默认方式通过这份可信制作元数据在course-package.js中初始化一次，不改全局偏好。元数据本身须通过固定校验，拒绝未知模式。
- 图片适配器将已验证Blob编码data URI，同时填入course.assets[]._dataUri和运行assets映射；之后调用gateway。旧saveCompiledCourse当前传空assets，必须扩展参数并按当前门面保存。保存重试发现同ID同内容复用，异内容拒绝；遵循既有scope与写入队列，不增加旁路HTTP。
- 统一receipt={storageKind,contentId,catalogCourseId,lessonId}。图文为story-package、package:<id>、lesson:story-package:<id>，句子为sentence-deck。按receipt构造受控路由：句子main.html?course=…&lesson=…，图文courses.html?id=…；controller跳转、complete状态链接、刷新后getLaunchReceipt三处共用一个路由函数，不接受输入携带的URL。
- 保存和加入继续独立；保存成功但写回session失败时，可通过稳定ID+内容检查恢复收据，不能因重试重复导入或覆盖异内容。图文加入只写既有CourseEnrollment身份。
- preview依据类型生成统一展示模型：图文图片+句子+翻译；句子现有预览。图文不显示“接入错题/SRS”的句子专属承诺。AI返回类型与制作所选不同必须明确确认或修复，不静默改变保存类型。
- loadExample返回正确courseType。图文改编只引用有界文本与素材说明（旧包可无说明），不把原图base64塞入prompt，也不自动复用未授权外部素材；用户重新生成/带回图片。

### 5. 分享文件（固定决定，执行无需再选协议）

文件名 <标题>.chunklab-image-course.json，最大12MiB UTF-8；与小JSON入口分开判别和限制，不能全局放宽句子输入。结构如下，所有层固定白名单：

    {format:'chunklab-ai-image-bundle',formatVersion:'1.0',
     draft:<ImageTextCourseDraft 1.0>,
     images:[{key,mimeType,byteLength,sha256,base64}]}

- images仅包含draft实际引用的清单，不含文件系统路径、数据库ID、课程ID、身份、学习记录、私人brief或聊天。sha256为小写64位hex、base64严格校验，解码前按编码长度预算，解码后核对大小/摘要/签名/尺寸及完整引用。
- 原始图片总量仍8MiB，单张2MiB/数量12，限制与独立图片上传相同；base64的体积开销计入12MiB外层限制。
- 用户粘贴框仅接受小草稿；大分享文件从文件选择入口读取，不将整个base64串写进rawResult、修复prompt或会话。
- 导入成功将分享文件拆成小draft+Blob，调用同一验证/原子存储流程并使用新session课程ID。课程保存后仍能从已持久化course反投影和_dataUri导出，不依赖原草稿库。
- 导出只投影明确的新图文格式；不能把任意外部V2当可无损导出格式。JSON下载复用BrowserIO Blob下载端口。既有标准ZIP仍走课程库原入口。

## Implementation steps

- [x] 1. 将制作页对齐主站暖灰/米白主题；窄屏与三步布局一致。
- [x] 2. 两类型、旧会话兼容、分类型prompt/spec和公开kit 1.1。
- [x] 3. 固定图文schema/语义校验、编译/反投影、分享envelope与边界单测。
- [x] 4. IndexedDB v2会话+图片原子事务、同样支持内存降级；签名/MIME/尺寸/解码校验及手动配对。
- [x] 5. 接通类型分流、预览、保存/加入/路由、练习方式约束；保留句子旧课与外部课程包入口。
- [x] 6. 图文分享导出和文件回导；会话不保存图片二进制；图片本地素材刷新后恢复。
- [x] 7. 在隔离浏览器中完成桌面/手机流程与端到端检查，并修复发现的问题。
- [x] 8. 生成制作bundle/kit/SW并检查生成物、服务工作线程及部署依赖。

## Validation

规划阶段仅只读调查和修改本文件；不运行测试。执行阶段使用临时CHUNKLAB_DATA_DIR/free-port/隔离浏览器上下文，禁止测试写入用户生产库。

- [x] `node --test src/course-authoring/*.test.mjs`：21项通过，覆盖原句子/旧转换与图文校验、签名、编译、分享摘要和回导。
- [x] `node e2e/ai-course-authoring.test.js` 与 `node e2e/ai-course-native-learning.test.js`：句子路径、图文校验/配对/共图/刷新/保存/分享回导/播放器、账号隔离和恢复通过。图文场景并入现有 authoring E2E。
- [x] `node course-package-contract.test.js`、`node course-catalog.test.js`、`node e2e/course-package-v2-import.test.js`、`node e2e/tab-content-consistency.test.js`均通过。
- [x] `npm run build:check`、`npm run lint:course-authoring`、`npm run typecheck`通过；lint与typecheck均递归覆盖course-authoring adapters/ui。
- [x] `node scripts/gen-sw.js`、`node scripts/check-sw.js`、`node scripts/check-deploy-files.js`及`git diff --check`通过。部署检查提示main.html中的动态图片引用字面量无法静态解析，但部署依赖检查仍通过。
- [x] Browser E2E验证主题computed色、375px无横向溢出、两种课程选项、图文预览/素材显示；使用Computer Use目测确认暖灰背景、米白卡片与课程库主题一致。
- [x] 全仓库`npm run build`未运行：脚本会重写多组生成文件，而工作区含大量无关未提交变更；已重建本功能所需bundle/kit/SW，并由`build:check`核对其余生成物。此项是有意保留的验证边界，不把其他功能的产物重写混入本交付。

## Acceptance criteria

- [x] 制作页主题关键色、卡片、错误状态和拖放/上传状态与主站一致；两类型可选，偏好刷新恢复。Browser E2E检查computed色、两类型、文件拖入和375px布局；另有Computer Use目测确认主题。
- [x] 旧1.0/1.1句子草稿按既有能力兼容，不新增阻断；不承诺旧格式缺失的信息无需修复。句子仍走main.html学习入口；旧课/native learning E2E通过。
- [x] 图文JSON与真实AI图片可分别带回；自动匹配失败有缩略图配对，多句能共用图片；缺少素材与字段错误有明确提示。E2E覆盖手动配对、共图和缺图提示。
- [x] 图文保存为story-package并进入courses.html；新浏览器课程库和刷新后图片恢复；不会误入旧AI文字转换。E2E覆盖新浏览器上下文从分享包导入、保存、加入、重载播放器。
- [x] 选择的图文练习方式/defaultMode在实际播放器生效，普通外部V2五种模式不受影响；没有给图文虚报句子SRS能力。播放器与合同回归通过。
- [x] 保存失败后可重试且不会重复建课；加入和草稿写回失败留在可恢复状态；跨标签revision、账号隔离及IDB不可用提示覆盖图片和会话。单测与隔离浏览器E2E通过。
- [x] 分享文件在新浏览器上下文导入后图文完整，新课程身份独立且不携带学习关系或私有制作信息；图片进入保存课程数据，不依赖制作草稿资源。
- [x] 图片签名、真实解码、尺寸/数量/大小、引用、bundle大小/摘要均严格验证；不抓取外部资源，不执行素材或上传Schema。对应模块单测与E2E通过。
- [x] 目标单测/端到端/目标构建、lint、typecheck及主题浏览器检查通过；全仓build因保护无关生成物未运行。未提交、推送或部署。

## Risks and rollback

- 真实图片生成依赖用户的AI能力；页面须提供逐图提示词与分文件回传引导，不能承诺纯聊天AI生图或真正无人工交接的一键全自动。
- 8MiB图片经base64约增大1/3，业务存储可能仍配额不足或同步失败。允许本页保留/下载，状态按门面实际承诺显示；不扩大本轮为服务器素材服务。
- 草稿图片是本机资源；IDB不可用时仅当前页恢复，不能同时承诺刷新不丢。已保存课程通过现有业务数据持久化，不依赖草稿资源。
- IDB升级要处理blocked/versionchange，旧标签不能静默丢写。失败提示关闭旧制作页后重试，不清空数据库。
- 回退只撤销新增制作入口接线/策略；保留已保存图文V2及句子数据。旧播放器可展示新图文，但回退后未必保留新模式限制；文档如实说明，不自动转换/删除课程。

## Execution notes

2026-09-28 初版：用户要求主题一致、课程类型两项，并明确两种都实际可制作；已生成初版handoff，产品CSS有此前未验收覆写。

2026-09-28 用户要求复核后修订：原计划不满足“执行无需重新发现架构”条件。本次仅改本文，未改产品代码、未运行测试。已修正：虚构V2 Schema接口；未确定的分享载体/大小上限；一图一页和强制重命名；图片与session跨事务；刷新后图片丢失；写死句子路由；新课误触发旧AI转换；未落实所选练习方式；不可兑现的IDB失败刷新恢复承诺。现已固定有限JSON分享合同和具体模块/事务/收据/验证方案。原三份已完成计划保留历史，本文只替代本扩展的初版。

2026-09-28 Luna执行完成：UI仅显示句子课程/图文课程；制作页主题色与decks一致。图文课程采用固定`chunklab-ai-image-text` JSON、真实PNG/JPEG/WebP文件、按文件名自动配对并提供手动配对；图片Blob独立存于账号作用域IndexedDB v2，与会话CAS在同一事务写入，预览用临时Object URL，课程保存时经package adapter物化，避免二进制进入会话JSON。图文保存为现有2.0 story package，使用`courses.html`正确入口和声明的默认练习方式。自包含bundle携图片、严格字节数及SHA-256，可在新会话回导；公开kit升为1.1。

验证：course-authoring单测21项、course authoring/native learning端到端、课程包合同/目录/ZIP导入/页签一致性、build:check、lint、typecheck、SW和部署闭包检查均通过；完整`npm run build`未运行，原因如验证清单所述。Impeccable `polish`审查命令在当前安装启动器中不可用（返回`Unknown command: "polish"`）；已用浏览器视觉检查及隔离E2E响应式/主题断言完成替代验证。未提交、推送或部署。

2026-09-28 继续验收：复核发现“Status: complete”与未勾选的验收清单互相矛盾。增加图文分享包在全新浏览器上下文导入、保存、加入后重载学习页的验证，确认图片和作者默认练习方式仍可恢复；更新验收矩阵及全仓构建的明确边界。新增E2E通过。没有运行会批量重写多组既有生成文件的全仓`npm run build`，也没有触碰其他未提交改动。

