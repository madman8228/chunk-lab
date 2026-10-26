# 渐进搭句共享画面：PB01 与喜好迁移样例

- Status: complete
- Updated: 2026-10-25
- Branch/worktree: `stabilize/p0-1-20261021` / `D:/06-project/chunk-practice`
- Base commit and relevant uncommitted changes: `ad0057c7f3b30facf30130a06db689f2f6b365fe`；HTML、CSS、foundations-v3.mjs、lessons-v3.mjs、view-v3.mjs 均已有未提交修改，须基于当前内容增量修改。存在其他无关改动，禁止重置或清理。
- Planner: GPT-6 Astra（用户已确认切换）
- Executor: GPT-5.6 Luna

## Objective

交付同一实际预览入口中的两个图文学习样例：PB01 连续人物场景，以及 I like apples / I like coffee / I like tea 的对象迁移。验证每步有合适画面但不为每步另造图片。生成、审图、压缩、共享索引、页面接入和交互验证构成一次有边界的交付。

用户已批准两名成年同事的工作室方向、四宫格生成及本地裁切，且要求 You、rest 先单练再合句。新图的实际教学含义仍需用户看图确认；执行者可先完成可审阅图片与技术接入准备，确认前不宣称资产已批准。无正式发布或账户数据操作。

## Current state and evidence

- 必读 AGENTS.md、docs/curriculum/progressive-sentence-building-rules.md。知识地图是规划参考，不代表实现完成。
- 实际默认 PB01 来自 foundations-v3.mjs，view-v3.mjs 渲染；不是 content/ 下另一路 schemaRunner。旧 full-delivery 交接已 complete，不是本任务交接。
- PB01 已有8步：I、work、I work、You、You work、rest、You rest、I rest识别；sentenceStepIndexes=[2,4,6]。保持该顺序和现有即时升层、撤回、错误反馈。
- renderBlackboard() 提示分支提前 return；图片目前仅在 learningNote.illustration 中、答后显示。新增画面不能仅改 note 导致作答前无图，也不能跟随上一题讲解误显示旧图。
- 黑板桌面201.6px、手机252px，预留空间；现有图 float:right。一级区已自适应高度，勿重新加入内部竖向滚动条。
- 共享目录 output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json。scripts/lib/vocabulary-illustrations.cjs 的 inspect 校验16:9 WebP、严格<20000字节与哈希；plan 按词义、阶段、风格查候选。
- package-vocabulary-atlas.cjs 支持1–4格、显式rect、保留原图、单WebP输出、禁止覆盖；预检与打包绑定同一manifest/catalog哈希，只有generate项目可打包。
- 库有 I、you、work、rest；work旧图偏作业/打扫。完整句 I work / You work / You rest / I rest 未找到表达绑定。另有 apple、coffee、tea、like候选，like含“像”义，不能误用。
- 可先复核对象候选：assets/vocab-u4-apple-wide-v1.webp、assets/vocab-u5-apple-wide-v3.webp、assets/vocab-g7-lower-u4-coffee-wide-v1.webp、assets/vocab-u5-tea-wide-v1.webp、assets/vocab-u5-tea-wide-v2.webp。候选并非自动获准复用。
- server/middleware/vocabulary-image-delivery.js 已支持本地别名到不可变哈希URL；本任务无需改生产配置。
- e2e/progressive-building-v3.test.cjs 有临时浏览器目录+随机端口模式，但包含另一路schema课程及旧数量断言；不能直接照搬为本样例验收。

## Assumptions and decisions

1. 每步绑定表达画面，不把某单词永久等同于主语等句法角色；图辅助表达，不作为时态证明。
2. 本次仅两种显示方式：完整场景 scene；固定人物卡与对象卡并排的 object-pair。卡片保留完整16:9，不抠图、不拼接手口动作、不建立自动语义生成器。
3. PB01先制作一批4格：I work（A工作且明确自指）、You work（A面向工作中的B）、You rest（同一B休息）、I rest（A休息）。I/work/I work复用第一格，You/You work复用第二格，rest/You rest复用第三格。词阶段用外围焦点框强调对应区域，不能裁掉画面；若语义审图认为有歧义再补图，不预先扩成8张。
4. 说话者A和听者B有固定外貌服装，画面通过手势及朝向表达关系；仅人物换色不能表示I/You。
5. 喜好样例以角色自指并表达喜欢的固定人物卡，搭配苹果/咖啡/茶卡。保持人物卡完全相同，只换对象。用复数 apples 表示泛指喜好，咖啡/茶不可数；图不是句法标签。
6. 独立识别阶段先隐藏图与历史，答对后显示解释图；不能把辅助下选对记录为独立掌握。
7. 旧制作草案中的两批8张已被本计划的一批4张优先策略取代；成人方向已批准。用户只需确认具体生成图及有争议复用图，不再询问同一方向。

## Scope

- PB01图文全流程；增加一个独立下拉选项“喜好迁移 · 配图样例”，不改写现有PB02课程。
- 新样例局部/合并：I like → apples → I like apples → coffee → I like coffee → tea → I like tea。学习Note解释like是态度、对象变化；单独I like说明是待补对象的片段。
- 最小可复用场景清单、资产审核记录、按需渲染器及针对性验证。

## Out of scope

PB01–50全面配图、自动句子生成图片、拖拽编辑器、通用骨骼/透明人物系统、时态与空间关系自动组合、CDN部署、正式发布、账户/数据库变更。

## Contracts and data changes

新增 src/progressive-building/visual-scenes.mjs：只包含本样例实际用到的资产小表和场景表，浏览器不导入整个共享目录。

- asset: id、src（稳定assets/*.webp）、sha256、width、height、alt；构建/验收时校验实际文件，运行时不为哈希额外下载。
- scene: id、kind=scene|object-pair、assetIds（分别1或2）、alt；object-pair 顺序为人物、对象，不接受任意层或用户HTML。
- step.visual: sceneId、focus 可选归一化矩形[x,y,w,h]、show=practice|after-correct；矩形在完整图实际显示框内计算，禁止越界。focus不是隐藏未来对象或泄露目标词的位置。
- 场景复用关系显式写在课程步骤，不根据英文字符串猜图。不用动态查询参数或按课程复制相同文件。
- 没有visual的旧课保留现有行为；已迁移PB01不重复显示旧learningNote.illustration。图片404时保留中文与讲解及占位，不回退大型原图，不阻断作答。
- 共享资产以内容哈希身份登记，生成新的增量目录 output/vocabulary-illustrations/progressive-scenes-20261025-v1.json，采用现有assets/aliases/bindings格式并通过validateCatalog；复用记录保留源sourceKey/哈希及目标场景review证据。不得覆盖旧目录或将新增文件声称为已上线全局服务配置。

## Implementation steps

- [x] 复核候选实际图片，记录到 output/progressive-building/visuals-20261025/review.md；记录源哈希、目标、可复用/不适用及原因。先复用对象素材，人物卡有不合适候选时不得强用。
- [x] 使用imagegen技能。创建 batch-01.json（batchId=pb01-office-scenes-20261025-v2、unit=1、version=2、assetPrefix=pb01-office-；四格word为四个完整表达，itemId与slug唯一，meaning精确中文，明确styleReference）。风格沿用已审核原风格参考，人物为批准的成年人，首次生成图片本身不是批准的新风格权威。
- [x] 对确切manifest运行预检再生成；完整表达为实际生成目标，保留局部词复用意图及旧候选审查记录，不能伪造拼写/词义绕过匹配。任何候选阻塞都需真实审核，禁止修改plan的action。若现有工具无法表示合法决定，记录具体证据设needs-planning，不扩展审核协议绕过保护。
- [x] 生成PB01一张四宫格并视觉核对，保留母图与裁切原图；You rest按用户反馈另存v4全幅修订。用户于2026-10-25确认四张当前图均合适，记录于output/progressive-building/visuals-20261025/pb01-scene-user-approval.json。
- [x] 喜好固定人物卡已按精确manifest预检并生成；首轮局部裁切保留为v1，完整rect另存v2。苹果、咖啡、茶作为混合风格候选由用户确认接入，仅批准用于本成人喜好迁移样例，不扩大为跨课程自动复用授权。
- [x] PB01及喜好样例均登记在独立增量catalog `output/vocabulary-illustrations/catalog-progressive-scenes-20261025-v1.json`，八个资产均通过hash/尺寸校验；PB01审批SHA-256为`3a969ffa67ba979f635f03548f63c3b41c366615a80bb8ac3d31b5a5220b675a`，喜好样例审批SHA-256为`d1ff9dbf77eecff36fbda4cb1dd572753b10ddc7feb10ef3b64e9036efcbbaec`。
- [x] 新增 `visual-scenes.mjs` 资产/场景表和 `scene-view.mjs` 纯DOM渲染scene/object-pair；只为当前场景设置img.src，不预取整库。
- [x] foundations-v3.mjs绑定PB01画面；新增 `like-transfer-v3.mjs` 样例并在lessons-v3.mjs接入。view-v3.mjs按当前步骤显示画面；独立识别作答前不泄题，答对后显示解释图。
- [x] CSS在黑板内设置固定图文区，桌面预留201.6px、移动端252px；手机360px检查无横向溢出。保持句子拼接和一级显示行为。
- [x] 更新HTML→view→lessons→foundations相关缓存版本。课程规则本身保持不变；本次“新对象先单练、固定人物卡与对象图组合”的实现与边界记在本交接，不泛化成所有课程的新规则。

## Validation

- [x] `node --check` 通过 view-v3.mjs、like-transfer-v3.mjs、scene-view.mjs、visual-scenes.mjs；`lessons.forEach(validatePreviewLesson)` 通过（10课）。
- [x] 两个新生成批次均按各自精确manifest完成预检和打包；复用对象图由只读共享目录检查来源和实际文件哈希/尺寸。旧目录及母图未覆盖。
- [x] 新增 `scripts/progressive-visual-scenes.test.cjs`，`node --test`通过：逐文件inspect、审批哈希、大小/比例、样例绑定与人物卡复用。
- [x] 使用独立静态预览及临时浏览器实际点击真实HTML流程；未连接8787用户数据，也未重启服务。该验证作为本次交互验收，不另造重复的浏览器测试框架。
- [x] 隔离静态预览（随机端口9122、只读工作区文件、不访问用户数据）检查喜好样例：人物和对象组合完整、句子显示正确；移动端360px无横向溢出、黑板高度252px。
- [x] 实际点击完成PB01到独立识别；确认You/rest练习后保留当前画面，identify初始无图，答对rest后显示I rest解释图。
- [x] 实际点击完整走完喜好样例九步，三句I like apples/coffee/tea均完成；三次人物文件路径相同、对象文件按题切换，没有对每个整句另制图片。
- [x] 隔离预览中检查桌面与手机布局（360px无横向溢出）、PB01完整作答到独立识别及答后讲解图、喜好样例九步和三句对象迁移。另验证PB01选错时原地反馈、Backspace撤回，以及图片404时隐藏坏图但保留提示和作答区。原8787服务不可连接，未重启，服务是否拉取未提交源码需由后续部署确认。

## Acceptance criteria

- [x] 默认PB01所有练习阶段有准确当前图，独立识别按上述例外处理；You/rest仍先单练。
- [x] 实际下拉入口能完成三句喜好迁移，固定人物卡+对象卡呈现，单词目标使用apples。
- [x] 当前页面使用的新增人物卡和PB01四图均逐张<20000字节且完整16:9；对象卡候选已验证原文件满足大小/比例；一图多步复用；原图保留，无账户内容修改。
- [x] 新人物卡及当前对象组合已由用户确认；审批仅限当前喜好样例，未给其它课程自动复用授权。
- [x] 真实HTML入口先在隔离静态预览验证，再按用户明确要求启动 `server/index.js`；`/api/health` 返回正常，8787页面返回200，喜好迁移入口显示1/9且人物图实际加载。
- [x] 交付边界为两个预览样例，不宣称全课程覆盖或正式部署。

## Risks and rollback

图可能表达“现在正在做”而非习惯，讲解不要据此教授一般现在时/进行时区别。like人物表情不应被误认为eat/drink。I/You必须有说话视角。复用节省数量但语义不准确时必须补图。

20KB是单文件预算，object-pair同时两图最多接近40KB，验收报告分别记录单图与当前场景总量，不把场景总量说成20KB。

只回退本交付新增引用及代码差异；保留母图、审核记录和已有用户修改。未清空存储、删除旧资产或改动生产配置。按用户要求重新启动服务前，以只读方式确认无待执行的stats/entity迁移、无缺失变更序号且管理员记录存在。

## Execution notes

执行阶段用户已确认四张PB01当前版可用，并同意喜好迁移样例接受混合风格、接入当前人物/苹果/咖啡/茶候选。八张文件均登记到增量catalog，逐项哈希及<20,000字节、16:9约束通过；两份审批记录按哈希绑定。喜好样例人物卡 `assets/vocab-pb-like-i-like-person-wide-v2.webp` 为7,174 B、512×288；对象素材沿用已审核源目录文件，审批仅限定本样例。通过独立只读静态服务和Playwright实际点击验证九步样例、三句迁移及固定人物卡复用；Node针对性测试2项通过，10课数据校验通过。随后依用户要求重启正式本地服务；启动前只读数据库检查显示待迁移stats/entity均为0、缺少变更序号为0、管理员记录为1；服务以多用户模式成功监听127.0.0.1:8787，health返回ok，预览页面返回200，喜好样例第1步人物图加载成功。未改动账户学习数据或清空存储。
