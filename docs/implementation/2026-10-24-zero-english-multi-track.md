# 零基础多路线课程：开发、内容生产与实施交接

- Status: complete (实现与私有审核候选交付；教学内容、音频与系统发布仍待审批)
- Updated: 2026-10-24
- Branch/worktree: `stabilize/p0-1-20261021` / `D:/06-project/chunk-practice`
- Base commit: `a927fd46835abc73ce7f695e286507e4873649fe`
- Relevant uncommitted changes: 规划时有12个已跟踪文件改动、3223个未跟踪assets、21个其他未跟踪文件。重叠文件为 `assets/learning-workspace.css`、`js/learning-workspace-view.js`、`main.html`、`sw.js`；此外有内容清单、音频脚本、审阅文档等并行工作，必须保留。四项旧删除也不属于本任务。执行前重新核对差异，禁止整文件回退或全量暂存。
- Planner: GPT-6 Astra（工作流角色；用户已确认模型切换）
- Executor: GPT-5.6 Luna

## Objective

保留原有情景表达课程，新增“逐步搭句、音标与发音、自然拼读”三条独立学习路线。用明确的阶段知识目录关联它们，而不是让每门课重复承担全部零基础教学。

本交接的有界交付是：**四路线共存的正式运行能力 + 五阶段知识拆解目录 + 三类各两课的私有审核草稿 + 隔离环境端到端验收**。从发现页进入、学习、续学、复习、返回我的学习必须连通。不是只交Schema或独立演示页，也不是一次生成全部课程。

实现完成与内容批准、音频批准、真实发布是不同状态。本轮允许开发、合成测试及私有候选内容生产；不允许将新课自动发布到真实目录。后续批量生产以首批审核为门槛。

## Current state and evidence

### 现状与根因

原来12单元60课蓝图见 `docs/plans/zero-english-curriculum-20261023.md`；第二单元及第3–12单元状态见 `docs/implementation/2026-10-24-zero-english-units02-12.md`。后者曾记录第二单元发布受管理员会话限制，不能据文档假定现在已发布。本规划不操作真实库，也不改变已有批准。

内容薄的问题属于课程覆盖与生产流程；专项课套用表达课规则的问题属于协议/服务端；分类、教学呈现属于客户端。不能靠前端改标签、复制页面或重复题目掩盖这些差异。

### 已核对的实现边界

| 层 | 现有实现与限制 | 本次处理 |
|---|---|---|
| 协议 | `src/expression-course/expression-package.schema.json` 和 `lesson.schema.json` 为1.0；成人、en-US；每课至少7活动、至少2词汇 | 保留1.0原约束，新增显式1.1分派 |
| 题型 | 已有meaning_intro、micro_explanation、sentence_build、substitution、listening_choice、independent_output、transfer_test | 搭句复用；补声音示范、字母组合组装、口头自练 |
| 校验 | `validate.mjs` 只认可包内先修；每技能至少2复习引用；发布检查音频 | 跨路线先修放独立知识目录，不能强行塞入旧字段 |
| 判题/状态 | `evaluate.mjs`、`runtime.mjs`；服务端隐藏答案、首次无提示证据、三错前进；掌握依赖independent/transfer/listening | 1.0保持；1.1只输出具体练习证据，不自动宣称综合掌握 |
| 播放器 | `ui/renderers.mjs`、`ui/entry.mjs`；共用 `src/shared/chunk-selection.mjs` | 复用选择组件；补micro_explanation真实ruleText/contrasts渲染（当前渲染器未读这两个字段） |
| 输出 | 原独立输出按答案词数生成输入格；schema声明record_self_check但没有真正录音实现 | 新课独立文本用自由输入框；口头自练诚实标记，不假装有评分 |
| 会话/发布 | `server/services/expression-course/{repository,session-service,schema}.js`、`server/routes/expression-courses.js` | 复用鉴权、幂等、审核哈希、不可变release和用户隔离；本期不迁移数据库 |
| 目录 | `registry-adapter.js` 的publicCourses及 `membership/course-access-service.js` 的catalogResources丢弃扩展元数据 | 将路线/阶段沿服务端目录链路传递，不能只修改播放器 |
| 发现/学习 | `src/learning-workspace/{resource-model,facets}.mjs`、`js/learning-workspace-{view,runtime}.js` | 增加零基础筛选；沿用expression入口与现有加入/收藏行为 |
| 构建 | `scripts/build-expression-course.mjs` 同时生成浏览器和服务端；`build-learning-workspace.mjs`生成两个workspace产物 | 修改源再生成，不能只改生成文件 |

规划时运行以下只读/隔离基线，22项全部通过：

```powershell
node --test src/expression-course/core.test.mjs server/services/expression-course/session.test.cjs src/learning-workspace/workspace.test.mjs src/learning-workspace/discovery-categories.test.mjs
```

没有执行全套测试或真实发布。`e2e/expression-unit02.test.cjs`依赖私有草稿且通过字符串改写旧测试，不应成为本期新验收的唯一基础；新套件使用自包含合成fixture。

## Assumptions and decisions

1. 面向中文母语成人；不是儿童识字课程。既有en-US口音保持一致；不同时铺开英美双轨。课程阶段是内部教学分层，不承诺完成即达到CEFR认证。
2. 情景表达线保留身份、内容、进度和入口。搭句线不是旧课的替换版，必须新courseId；同一知识点跨课出现不自动共享掌握状态。
3. 音标与拼读可并行或按需进入，不作为所有表达课的强制前置。前置推荐不阻断用户选择。
4. 简化每课任务，不削减整个课程的知识覆盖。每课一个主要目标；新词负荷可审计，不以页面数、题量或替换次数充当知识点数。
5. 用现有表达引擎承载四类课程，内部 `contentType: expression` 和URL不改名。再建三套播放器/进度表成本高、容易分叉；反过来，把声音辨识冒充句子掌握也不可接受。使用版本化协议和少量真实新题型解决差异。
6. 先交技术闭环和内容候选，后审核再扩量。尚无可靠孤立音音频时保留needs_generation，阻断真实发布；不得用蜂鸣测试音或读音标字符串的TTS冒充教材音频。
7. 本轮不建智能推荐、全局掌握引擎、自动语音评分、复杂剧情系统或泛化插件框架。

## Scope

### 课程分工与阶段知识目录

执行者新增 `docs/curriculum/zero-english-map-v1.md` 与 `src/beginner-curriculum/knowledge-map.json`，同一目录分别供审阅和校验。覆盖下列领域，并细拆成可独立检验的目标；不能只抄五行阶段标题。

| 阶段 | 逐步搭句与情景运用 | 音标/发音 | 自然拼读 |
|---|---|---|---|
| S0 起步 | 学习指令、问候、求重复、姓名词块；认识句子表达完整意思 | 听音模仿、字母名与声音不同、认识音标用途 | 字母识别、字母名与常见字母音、口头合成/拆分准备 |
| S1 短句 | I/you/he/she/it、am/is/are、身份/状态、this/that、my/your、a/an、基础复数、基本肯否 | 常用辅音和元音的逐项认识、易混音对比、词尾音 | 常见单字母音、短元音、CVC拼合/拆分，已教规则内读新词 |
| S2 基础交流 | 喜好/需要/拥有、do问句、can、疑问词、数量价格、数字时间日期、there be与位置 | 单词重音、可理解度、词尾-s/-es等相关读音 | sh/ch/th等常见组合、辅音连缀、常见末尾e模式、例外高频词单列 |
| S3 扩展 | 日常习惯/第三人称、频率、正在发生、过去基本表达、近期计划、比较和and/but/because | 弱读/句重音/基础语调，词尾-ed按需学习 | 常见元音组合、r相关拼写模式、多音节初步、常见词缀与例外 |
| S4 综合运用 | 点单购物问路约时间，简短留言、表格、标识、跨场景听说读写 | 在真实短句中运用，问题回到专项补练 | 受控短文解码到理解；查词/音标辅助处理不熟悉拼写 |

该表为制作范围，不是声称全部项目都属于A1。被动、完成时、复杂从句不塞进首期，也不为了截图变形链强行提前；列入后续扩展而非当前缺漏。

每条知识记录至少包含：`knowledgeId`、`stage`、`domain`（sound/decoding/vocabulary/structure/function/literacy）、`goalZh`、`prerequisiteIds`、`recommendedTracks`、`demonstration`、`independentCheck`、`status`（planned/draft/reviewed）。词汇用“词形+义项”而非仅拼写识别；音标目标与字母组合规则分别有ID。映射教材覆盖、当前已制、缺口和样板归属，不自动认定旧课已覆盖或用户已学会。

### 首批六节候选课

三包各2课，全部新ID，私有保存于 `drafts/zero-english/multi-track-v1/`，禁止覆盖既有草稿：

- `expression-beginner-build-pilot-v1`：L21001表达需要（need water→I need water→替换对象）；L21002礼貌补充（I need…→…, please），复用上一课，不顺便教过去/被动。首课先教完整可用句，不把不自然中间串当作独立示范句。每课含未示范过的同规则迁移。
- `expression-beginner-sounds-pilot-v1`：L22001认识 /iː/ 的声音与符号，L22002对比 /iː/ 与 /ɪ/。解释不是单纯“拉长/缩短”，词义先供中文；听辨与自己发音明确分开。
- `expression-beginner-phonics-pilot-v1`：L23001建立m/s/a/t常见音形联系及口头拼合，L23002在这些已教映射内拼合/拆分mat/sat等；音素、字母和单词音频独立声明。此为一个教学片段，不代表完成全部字母课程。

交付总审阅稿、知识覆盖表、每课完整活动与答案、音频脚本及状态、课程包JSON、机器校验报告和哈希清单。没有实音时内容仍可审阅，但必须醒目标识“待音频核验，不能发布”。词汇introducedHere必须依据前序内容填写，不得全设false规避新词负荷。

### 后续生产路线（不属于本轮编码完成条件）

样板审核后，以知识依赖顺序生产S0/S1；每批按内容审阅→音频审阅→技术校验→独立授权发布。再扩S2/S3，最后S4综合任务。旧50课是可审阅素材，不自动迁入新体系，也不一键重新生成覆盖。试教记录撤提示表现、新材料表现、次日/数日后的表现，区分打字困难和语言困难；不预设虚假的“最佳方案”或精确学习时长。

教学原则参考：[IES学习与记忆实践指南](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)支持间隔学习、示例与独立练习结合及提取练习；它不是对本产品成人英语课程的直接效果验证。[CEFR Companion Volume](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions)用于后续能力对照，不替代具体教学顺序与试教。

## Out of scope

- 不发布新草稿到真实系统、不加入真实账号、不迁移/重置学习记录、不删除旧内容/素材/备份。
- 不顺手处理第二单元既有发布任务、未提交音频工作、其他UI或旧删除；原发布授权仅限原批准包。
- 不要求本轮完成所有阶段音频与插图；不自动付费购买素材；不做TTS服务替换。普通词句可继续既有Edge流程，孤立音必须人工试听核验。
- 不实现ASR分数、口音排名、录音上传。首期口头练习是自练确认，不声称真实录音或发音通过。
- 不解决旧课程跨release进度继承政策：该问题见 `docs/expression-progress-revision-policy.md`；新样板用新ID避开覆盖，旧会话仍固定原release。
- 不提交、推送、部署或重启8787服务；不自动创建其他聊天。

## Contracts and data changes

### 1. 版本与元数据

保留包格式 `chunklab-expression-course`；新增 `formatVersion: "1.1"` / 课 `schemaVersion: "1.1"`。1.0继续使用原schema和行为，不能全局放宽旧规则。新增 `package-v1.1.schema.json`、`lesson-v1.1.schema.json`；可引用旧定义，需覆盖字段用清晰新定义，不用allOf试图撤销旧minItems/const。版本不识别时返回可读验证错误，不降级吞字段。

1.1包必需 `curriculum: { track, stage, knowledgeMapVersion: "1.0" }`；track枚举 `scenario | sentence-building | pronunciation | phonics`，stage枚举S0–S4。1.1每课必需 `knowledgeIds`（目标引用）、`recommendedKnowledgeIds`（跨包推荐前置，可为空）。保留旧 prerequisiteSkillIds 专指包内能力；不把全局知识状态写进个人skill表。

1.1每课4–20活动、vocabulary允许为空（纯声音教学），每课至少1个新目标、至少一个讲解/示范及一个独立检查；每技能仍需2条不同的可评估复习引用。包内音频上限100、每包20课沿用，小包生产，不提高限制掩盖批量问题。

知识目录只存教学设计，不存用户、答案库、音频二进制或个人进度。增加纯函数校验：ID重复、悬空依赖、循环、目标为空、stage非法、课程知识引用不存在、推荐前置与教学目标混淆；先修通常不能指向更晚阶段。跨阶段例外必须有显式reason字段供人工审核。

旧包没有curriculum时展示“情景表达”，stage保持null，不据名字猜分级；零基础专栏仅纳入显式1.1元数据或确切旧ID白名单（unit01、unit02、旧饮品课只在核对ID后列出）。白名单存在新 `src/beginner-curriculum/legacy-map.json`，只做展示映射，不改旧包与hash。

### 2. 最小题型扩展

搭句使用连续活动表达“逐步加一块”，一小步一个活动和一次保存，不另建嵌套步骤引擎。sentence_build允许完整词块，不把I'd like机械拆碎。1.1组装题允许单个完整词块；必须检验正确token序列是可选token多重集的子集，防重复词块取用错误。

新增三个明确题型，schema对payload设additionalProperties:false：

| type | payload | 操作和评估 |
|---|---|---|
| sound_demo | `instructionZh`, `segments:[{label, audioAssetId}]`，1–12段 | 逐段主动播放，可按顺序播；guided、countsTowardMastery:false；continue完成 |
| grapheme_build | `targetMeaning`, `audioAssetId`, `availableTokens`, `correctTokens`，token为字母或组合 | 复用选择组件和tokens响应；判题按序严格相等；结果显示拼合字符串而非空格连接；不能当作实际朗读证据 |
| speaking_practice | `scenario`, `referenceText`, `audioAssetId` | 先不显示范文；用户点击“显示示范”后才能看/听，随后“已尝试开口”或“暂时跳过”；只记自练，不判correct |

speaking_practice的referenceText仅经服务端reveal返回；payload公开过滤时移除。使用现有reveal动作，新增 `self_practiced` 和 `skip_practice`，仅该题型可用，结果 `kind: practice`、`correct:null`、`evidenceRecorded:false`、`selfReported:true/false`。不放进reviewActivities。界面清楚提示“自练，不评估发音”。

listening_choice沿用选项label字段textZh（可以显示IPA/字母/词），1.1增加可选 `questionKind: meaning | sound | decoding`（默认meaning），只影响提示语及证据标签。正确选项、correctTokens及acceptedAnswers永不随普通公开状态返回；grapheme_build也必须在registry-adapter.load中剥离答案。

1.1 independent_output/transfer_test使用自由文本，不泄露expectedWordCount；不能要求口头自练用户打字才能完成路线，可明确skip且不产生正确证据。1.0逐词输入行为不变。

### 3. 证据、复习与兼容

1.1会话state新增 `schemaVersion:"1.1"`；旧saved state缺字段按1.0处理。新课状态可在state_json中记录题级证据 `{activityId,type,questionKind,firstCorrect,usedHint,revealed,selfReported}`，不增加数据库列。

首期1.1 **不产生综合masteredSkills**，只记录具体检查结果。听辨通过不等于发音正确，拼合选择通过不等于能读新词，文本通过不等于开口。目录仍有流程完成度，标签“已完成/待复习”，不标“已掌握音标/达到A1”。这不是放弃评估，而是避免在尚无可靠能力聚合规则时制造结论。

1.1延续完成课后进入复习队列；复习正确且首次无提示时延长间隔，状态用 `practiced`，失败/跳过用needs_practice，不写mastered；1.0规则不变。新增grapheme_build可作phonics复习，review引用白名单在validate与session-service的learn/review分支同步修改。speaking_practice永不单独推进skill间隔。

复习返回新题型的实际lessonId、releaseId；原sessionService的用户隔离、requestId幂等、expectedRevision冲突、旧release恢复全部保持。不得用前端localStorage创建平行进度系统。

### 4. 目录、入口和失效行为

正式入口为 `main.html?view=discover&category=beginner`，增加零基础tab与路线/阶段筛选，URL参数 `track`、`stage`；未知值清空，切换其他category清除这两个条件，搜索/刷新/前进后退保持一致。新增项不改变原practical、school等结果规则；零基础可与实用英语分类交叉展示，但同列表按resourceId去重。

数据链路必须贯通：repository.registryCourses → registry-adapter.publicCourses → course-access-service.catalogResources → normalizeResource → facets/view。传 `curriculum` 受限对象；旧资源默认null。repository.catalog及详情API也返回安全课程元数据，不泄露课程答案。展示映射优先新包字段，旧白名单兜底，不修改发布哈希。

发现卡片显示路线、阶段与课数；点击复用现有actions.open与 `expression-learn.html?course=...`，返回参数沿用CourseReturn。“我的学习”仅显示用户已加入的课程，保留四类标签和续学，不自动给真实账号加课。目录显示本课目标与推荐前置文字，不做先修锁。没有已发布课的方向显示“内容准备中”，不渲染可点击假课程，不把草稿计入课数。

音频失败支持重试/明确跳过，不能把skip当听辨正确；网络失败不前进、不伪造保存，恢复沿用幂等请求；知识目录引用失败阻断新包发布，旧包不受影响。媒体只按当前活动按需加载，离开停止播放，不能全库预缓存。

### 5. 生产与审核合同

新增 `scripts/validate-beginner-course.mjs`，CLI `--package <path> --map <path> [--for-publish]`，仅校验、不写真实服务；输出结构错误、音频状态、词汇首次引入、知识覆盖和未确认项。draft允许needs_generation，for-publish必须核验实际文件size/hash、可解码及所有引用；并要求私有review-manifest对当前内容和音频SHA绑定的审核记录。结构通过不自动生成批准。

服务端仍用现有上传→draft→validate→review(contentHash)→publish(expectedRevision,contentHash,requestId)。扩展validate覆盖sound_demo各段、speaking_practice及所有audioAssetId，不能只查listening_choice。元数据属于审核哈希，任何改变都让审核失效。更改schema与authoring prompt同步，旧1.0提示词仍可生成旧包。

审核文件分别记录content、audio、publication的pending/approved与绑定hash；批准旧Edge Jenny不等于批准新单音；自动化测试生成的音频仅用于解码/传输测试，禁止出现在教学交付中。六节候选先交内容审核，不擅自代用户确认。版本目录存在时创建新revision目录，不覆盖。

## Implementation steps

- [x] 1. 执行者重读AGENTS和本文件，核对dirty diff，状态改in-progress。复跑基线；未处理无关改动。
- [x] 2. 建立知识目录、旧课候选映射、校验器与审阅文档，覆盖五阶段目标、前置、检查与待补缺口；保留旧规划并添加测试。
- [x] 3. 完成1.1协议校验、路线/知识/媒体/复习合同与authoring版本选择；旧版兼容测试通过。
- [x] 4. 完成新版三题型、逐步搭句、讲解对比、自由输出与答案保护；新增运行时/UI测试。
- [x] 5. 完成会话状态与目录元数据链路；未做SQL迁移。
- [x] 6. 完成发现页零基础分类、路线/阶段筛选和卡片展示；沿用现有学习入口，不自动加入真实账号。
- [x] 7. 新增自包含合成夹具和隔离端到端测试。测试只使用临时数据目录、隔离端口和合成用户/媒体。
- [x] 8. 新增课程机器校验器及三条路线六节私有候选；真实音频、内容批准和发布状态均保持pending。
- [x] 9. 生成受影响产物并完成本报告、桌面/移动截图与测试记录；未重启真实服务、发布到真实目录或变更真实学习数据。

### 多agent协作边界

仅在执行阶段使用可用且获准的协作方式；本规划不启动agent。主执行者负责协议冻结、共享文件、生成产物和最终验收。

- 内容agent：仅knowledge-map、课程设计文档与私有multi-track草稿。不能改播放器、生成bundle或发布。
- 引擎agent：src/expression-course协议、运行时、渲染器及对应单测；不动workspace。新增题型合同先交主执行者确认一致性，不能自行扩种类。
- 集成agent：主执行者完成协议后，负责服务端元数据链路、发现入口、E2E；若与引擎共改session-service，由主执行者单独拥有该文件。
- 顺序：合同先行 → 内容与引擎可并行 → 目录集成 → 主执行者统一构建验收。共享工作区禁止多人同时改同文件或运行生成器；不得用“各自完成”替代端到端结果。

## Validation

以下新测试文件在实施时创建；规划阶段没有声称它们已通过。

```powershell
node --test src/beginner-curriculum/knowledge-map.test.mjs src/expression-course/beginner-contract.test.mjs src/expression-course/beginner-runtime.test.mjs
node --test src/expression-course/core.test.mjs src/expression-course/ui/entry.test.mjs
node scripts/build-expression-course.mjs
node scripts/build-learning-workspace.mjs
node --test server/services/expression-course/repository.test.cjs server/services/expression-course/session.test.cjs server/services/expression-course/registry-adapter.test.cjs server/services/expression-course/beginner.test.cjs
node --test src/learning-workspace/workspace.test.mjs src/learning-workspace/discovery-categories.test.mjs
node --test e2e/expression-course.test.cjs e2e/beginner-multi-track.test.cjs
npm run build:check
node scripts/gen-sw.js
node scripts/check-sw.js
```

先看相关测试是否严格临时目录/独立端口；新E2E用e2e/expression-course.test.cjs的隔离模式，不照搬真实草稿依赖。前端测试若已有无关失败，记录基线与当前相同证据；本任务造成的失败不得豁免。避免运行会重装配无关课程清单的全量prepare:test。

专项验证清单：

- [ ] 1.0旧fixture原样通过；1.1包/课版本不匹配、未知track、悬空knowledge、循环前置、缺音/伪hash、重复不可用token等都拒绝。
- [ ] 公开目录/当前状态不含答案键；sound_demo允许可见示范；speaking_practice显示示范前没有referenceText；独立新课不泄露答案词数。
- [ ] micro_explanation实际显示ruleText和两条对比，而不是只显示继续按钮。
- [ ] 新增三题型有成功、失败、重复点击、刷新恢复、跳过与网络失败用例；图形与音素token不混淆。
- [ ] 1.1自练/三错前进/答案暴露/跳音不能写mastered；复习到期用注入时钟，不修改系统日期、不等待真实一天。
- [ ] 两个合成用户的会话/复习/加入状态隔离；发布新revision后未完成会话仍读原release；未授权资源403/404不泄露。
- [ ] 发现→筛选→目录→每类课播放→刷新续学→完成→我的学习→到期复习→返回，全程走正式路由。断网不伪保存，恢复不会重复提交。
- [ ] 360px与桌面宽度无横向溢出，键盘可选/撤回/提交，IPA字符显示正常；未发布方向显示准备中。
- [ ] 六课私有内容逐条对照知识目录，明确introducedHere与完整答案；所有待配音状态可见，机器检查不伪造审核。

## Acceptance criteria

- [ ] 原课程与新路线共存，原ID/原内容/原真实记录无变化；没有真实服务重启、发布、账号加入或存储清理。
- [ ] 分阶段知识目录包含明确目标、前置、验收和覆盖缺口，音标与拼读职责不混同；不再靠原12×5格子限制知识量。
- [ ] 新版三条路线在正式页面、正式服务器接口和现有进度/复习系统中可运行，非独立mock页面。
- [ ] 六节教学候选可统一审核；有机器报告及内容/音频/发布三类状态，不因音频缺失伪装可发布。
- [ ] 新协议前后端同一验证与判题来源；1.0回归通过；新增媒体/答案/复习引用完整覆盖。
- [ ] 当前新课只宣称流程完成和具体练习结果，不宣称发音达标、全局掌握或A1毕业。
- [ ] 执行日志列出命令和结果、截图路径、未覆盖项、现网未更新说明；具备可交接的审核入口和下一批生产依据。

## Risks and rollback

1. **内容与工程验收混淆**：技术闭环完成不等于六节音频已批准，更不等于全阶段已制。交付报告分别列状态；真实发布需用户明确批准和管理员授权会话。
2. **脏工作区/并发覆盖**：按文件归属实施，生成器最后单人运行；不要git add -A。回退仅撤销本任务可识别改动，保留其他agent差异。
3. **历史版本兼容**：缺schemaVersion的保存状态按1.0；新旧courseId分开，旧release不重写。执行后回退到不支持1.1的旧服务不能用于已真实发布1.1的库；未来部署先升级读写能力再发布新课。必要时停用新课入口但保留会话与资产，不删库。
4. **音频质量**：单音TTS可能读符号/补元音，须独立试听；没有合格资产就pending。普通词句Edge配音可作为候选，不自动审核通过。
5. **假掌握**：首期不做全局能力推断；后续如需自动掌握须另立细分证据政策，不能把practiced改名即完成。
6. **隐私和资产**：未引入录音上传；未来另做权限与保留期。词汇图片若后续新增，遵守每文件严格小于20,000bytes、单16:9 WebP、按需加载、原图保留；本期不生图。
7. **系统性取舍**：共用引擎减少重复，但需要显式版本分支与回归；不额外做前端兼容未知协议。版本/资源错误在服务端拒绝并给可恢复提示，不用旧题替换新题。

## Execution notes

- 2026-10-24：已完成代码/协议/发布路径/目录路径/dirty状态检查；22项基线通过。规划只新增本文件，未修改产品代码、课程、账号或真实服务；没有执行新功能验收。
- 2026-10-24：进入执行。确认仍为规划记录的基线commit；工作区共3257条状态项，除本任务文件外均按既有改动保留。本轮未启动并行agent：当前协作工具未列出GPT-5.6 Luna，技能不允许用其他模型冒充指定执行者；继续由当前已切换的执行线程处理，按不重叠文件边界单人集成。
- 2026-10-24：技术实现及六节私有审核候选完成。针对性单元/服务测试38项通过；旧版表达课端到端回归通过；三路线隔离端到端测试通过；`npm run build:check` 与 `node scripts/gen-sw.js --check` 通过。命令、边界与未覆盖项详见 `docs/implementation/reports/2026-10-24-zero-english-multi-track-acceptance.md`。
- 2026-10-24：技术交付状态complete；六课内容审核、实际音频制作/试听批准、系统目录发布继续pending。未更新运行中的本地服务；浏览器当前页面不代表已部署新产物。
