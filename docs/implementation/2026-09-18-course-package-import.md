# 新版课程包导入与输入练习适配

- Status: complete
- Updated: 2026-09-18
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: a88c690cf588d951c98d9d812ea1be907735adca。decks.html、core.js、main.html、api.js、server/*、统计、内容、部署清单、e2e/course-catalog.test.js 等已有未提交修改；admin.html 等未跟踪。执行前重新核对 git status，逐块保留。course-package.js 本次检查时干净。
- Planner: GPT-6 Astra workflow（环境未暴露具体子型号，不据此断言模型选择）
- Executor: GPT-5.6 Luna

## Objective

让用户通过现有课程页导入 1.1 标准 ZIP，保留课程归属，在图文播放器完成七句听音输入练习，正确判分、续练和完成。课程生产方负责修正协议及课程内容，本项目只做 1.1 消费端适配。

## Current state and evidence

- 新样本 ref/0.1.0-1789739161756.zip，ZIP SHA256 为 1f6ae914d5a8fee7e1cd0033a47fc663ed465973ba82b4da04db3a9b83673eef，包内 contentHash 为 27a5fb1ad14c4d9097a54aee019c5ee00b3a9b42369385b73634bd93816323be。courseId=course_fde7e455，version=0.1.0，packageFormatVersion/schemaVersion=1.1，article/typing_only，image_article，7 interaction + 1 end，13 媒体文件。17 个 manifest 条目的字节数、SHA256 均正确，包内 Draft2020-12 Schema 校验通过，所有节点可达。
- 1.1 协议明确要求 manifest.entries 按 path 的 unsigned UTF-8 字节排序，contentHash 按该顺序计算；答案策略为 english-typing-v1：NFKC、ASCII 空白折叠、ASCII 大小写不敏感、标点精确。COURSE_PROTOCOL_TEST_VECTORS.json 的 5 个答案向量已纳入契约单测与真实导入验收。
- 包内新版 COURSE_PROTOCOL.md 是本次合同，ref/COURSE_PROTOCOL.md 是旧副本。npcMessage/sourceText 相同是合法数据；答题前不展示台词，sourceText 仅用于判分。speaker 映射统一为 npcId。
- 1.1 contentHash 按 manifest.entries 的 UTF-8 排序顺序、UTF-8 的 path+NUL+sha256+NUL+byteSize+LF 计算匹配；按普通路径字典序重排不作为实现依据。生产方正在完善规范，不修改包来迎合播放器。
- 旧样本 extra/lesson_1_excuse_me-1.0.0.course-package.zip 仅保留作历史参考，不属于当前运行时支持范围。
- renderInteraction 将 sourceText 再输出到学习者气泡；按 input.prompt 存在推断 typing；autoAdvance 提前返回“继续”，绕过练习。renderTyping 从 difficultyLevels 或 expressions 推断答案而非 sourceText。当前表达列表包含中文目标描述，不能当答案。
- importZip 未校验 manifest/Schema；mimeFor 只识别图片，把 mp3 当 image/*；未发现 audioAssetId 播放路径。advance 在无匹配时随意使用最后一个 transition。
- 入口：decks.html 导入弹窗 -> ChunkCourse.importZipDirect -> importZip -> commitCourseImport -> CL.writeCourses；courses.html 播放。存储为账号隔离的 CL/IndexedDB 桥，course assets 含 _dataUri，已有 courseImportTail 和 progressSaveTail。
- renderNode 在浏览节点时写 seen；旧 seen 表示访问，不能直接改成“已答对”。

## Assumptions and decisions

1. 只支持 1.1 sourceText typing。课程包版本、course.json schemaVersion 与运行能力必须一致；1.0 或未知版本明确拒绝，不做降级伪装。
2. 1.1 typing 以 acceptedAnswers.en 为允许答案集合，sourceText.en 是 canonical target。严格采用包内 english-typing-v1：NFKC、ASCII 空白折叠、ASCII A-Z 大小写不敏感、标点精确；不把弯引号转直引号，不忽略句末标点。
3. autoAdvance=true 表示答对后前进；false 表示答对后显示继续；未答或答错均不能跳过本练习。错误时保留输入及焦点，使用包内 retryFeedback。
4. 新版只展示一份台词，输入框独立呈现用户作答；不得把 sourceText 自动填入“你”的气泡。使用既有布局，不做全站改版。
5. 1.1 hash profile 按 manifest.entries 的 unsigned UTF-8 排序顺序计算总哈希，逐文件哈希必须通过。不要尝试多个算法直到通过；以后生产方调整算法时显式增加有版本/能力标识的 profile。总哈希只证明包内一致性，不表示可信发布者。
6. 1.1 不要求 practiceRoles、gaps、clozeTemplate；不迁移 1.0 已存课程数据。

## Scope

ZIP 校验与错误提示、1.1 展示/输入判分/音频/进度、现有归类入口接线、离线依赖和缓存更新。

## Out of scope

修改生产方包/协议/Schema；新建课程标准；生成翻译或意群；后台/用户统计改造；批量迁移既有完成记录；全站布局重做；发布、提交、推送。

## Contracts and data changes

- 新增 js/course-package-contract.js（浏览器 global + Node 可测试的纯函数模块）：profile 检测、规范化输入/判分、图引用及 manifest 规则；不把任意语义路径当可执行表达式。
- 完整 JSON Schema 使用 Ajv2020，本地随页面交付，禁止 CDN/远程 $ref。实施时 npm install --save-dev --save-exact ajv esbuild，提交 lockfile；添加 scripts/build-course-schema-validator.js，打包小入口到 js/vendor/course-schema-validator.js（浏览器 IIFE，编译选项 code.source=true、allErrors=true、strict=false）。运行时不联网，限制 Schema 大小/深度、拒绝外部引用；未知可选字段按包内 additionalProperties 处理。不要自写部分 JSON Schema 冒充完整校验。
- ZIP 校验先于 _dataUri/lib 等本地字段添加。检查 1.1 manifest 版本/课程身份一致性，唯一且安全的路径、ZIP/manifest 重复项、资源存在、byteSize、SHA256、contentHash、Schema，再检查唯一实体 ID、scene/npc/asset/目标/ending/transition 引用、起点与结束可达及 fallback 唯一性。不支持的版本或练习能力明确报错；1.0 和未知版本均拒绝。
- readZip 只接受 store/deflate，拒绝加密、不支持压缩、越界、路径穿越、绝对路径、URL 和可执行文件。明确上限：ZIP 100MiB、解压累计300MiB、单项50MiB、2000项、Schema1MiB；读取中执行累计上限，不能仅信任目录大小。
- 导入失败不得替换已有课程或显示成功；仍走现有账号隔离持久化，不引入第二套课程存储。异步解析前捕获归类元数据，传参到提交，避免全局 _pendingLib 串包。
- 同 courseId 导入视作更新：保留既有归属（除非本次显式选择）、同版本合法 nodeId 的进度；版本改变保留旧进度副本并重置该课程运行进度，提示一次。错误包完全不触发更新。
- 新版进度在既有对象增加 runtimeProfile、courseVersion、currentNodeId、passedNodeIds；seen 继续表示访问。正确答案才记录 passed；七句通过到 end 后才 completed。历史无这些字段的记录沿用原续练语义，不批量重置。
- 音频通过 assets ID 找 data URI，MIME audio/mpeg 等显式支持；一个受控 audio 实例，切节点/退出停止，提供播放/重播按钮。自动播放被浏览器拦截则保留手动按钮，不伪报资源坏。图片仍使用现有渲染。

## Implementation steps

- [x] 使用 ref/0.1.0-1789739161756.zip 作为真实回归样本；旧 1.0 ZIP 仅保留历史参考，不复制外部包进仓库。
- [x] 新增 contract/Schema validator 模块与构建脚本，在 decks.html、courses.html 的 course-package.js 前加载；package scripts 接入构建和专项测试。
- [x] 改造 importZip/readZip：完整校验后才转换资源/提交，修正 MIME、失败反馈和归类元数据消费；commitCourseImport 支持同课更新和版本变更进度隔离。
- [x] validateCourse/validateCourseSemantics/readStoredCourses 统一使用 1.1 合同；1.0 课程包不再进入运行时。
- [x] renderInteraction/renderTyping/绑定事件/advance 接入新版完整答题路径；删除新版重复目标气泡，修正 autoAdvance；条件不匹配时仅使用明确 fallback。
- [x] 接入 audioAssetId、播放按钮、切换清理及刷新后媒体恢复；保留既有桌面布局。
- [x] 接通新版 current/passed/completed 进度字段与更新规则，保留旧 seen 行为及账号隔离；增加单元及真实浏览器回归。
- [x] 更新离线/部署依赖清单并重新生成 SW；部署清单通过。

## Validation

- [x] node scripts/build-course-schema-validator.js；node course-package-contract.test.js
- [x] node e2e/course-package-import.test.js：1.1 包真实导入、台词不重复、答错停留、正确推进、七句到 end、音频达到 canplay。
- [x] node js/course-cloze.test.js；node course-storage.test.js；node course-progress.test.js；node course-resume.test.js；node course-catalog.test.js；node scripts/check-sw.js；node scripts/sw-hash.test.js；node scripts/check-deploy-files.js
- [x] `TEST_RETRIES=0 npm test`：当前标准清单 101/101 通过；课程包专项与相关内容、存储、进度、目录回归均通过。

## Acceptance criteria

- [x] 最新样本在课程页真实导入成功，归属正确，课程和媒体可读取。
- [x] 新版只显示一份源台词；必须输入正确答案才能前进，autoAdvance 不再绕过练习。
- [x] 音频按钮实际达到 canplay；节点切换前停止上一段音频。
- [x] 1.0 包被明确拒绝；1.1 包导入、答题和完成流程通过。
- [x] 损坏/不支持包的校验在提交前执行，失败不写入；专项测试覆盖真实成功路径。
- [x] 同课更新不重复课程卡片，版本变更建立旧进度副本并重置运行进度，账号存储路径保持不变。
- [x] 页面脚本、部署清单、离线缓存及端到端入口已接通。

## Risks and rollback

生产方下一版可能改变 hash/profile，不能静默猜测兼容；若出现实质合同冲突记录具体字段并标 needs-planning。未来协议变化必须增加显式版本分支，不修改 1.1 语义来兼容。新增进度只增加字段，不破坏当前 1.1 数据；回滚仅撤销本次代码块，保留用户数据及既有工作区修改。媒体测试不验证录音内容与台词的教学准确性。

## Execution notes

已新增 js/course-package-contract.js、scripts/build-course-schema-validator.js、scripts/course-schema-validator-entry.js、js/vendor/course-schema-validator.js、course-package-contract.test.js、e2e/course-package-import.test.js，并修改 course-package.js、course-storage.test.js、courses.html、decks.html、package.json、package-lock.json、scripts/deploy-prod.sh、sw.js。1.1 适配增加了明确的 package profile、manifest UTF-8 排序校验、1.1 answerPolicy、acceptedAnswers、协议测试向量文件要求、1.1 严格资源路径以及答题前隐藏 npcMessage；本轮移除了 1.0 运行时分支、旧字段映射和旧交互渲染路径。
`npm test` 在已有的 courses.html 对比度护栏失败，未进入后续测试；课程适配专项测试和相关存储/进度/目录测试均通过。未执行发布、提交或推送。
真实 1.1 新包 e2e 已通过：默认 `node e2e/course-package-import.test.js` 使用 `ref/0.1.0-1789739161756.zip`，七个 interaction 节点全部到达 end。1.0 包不再作为回归目标。`npm test` 仍在既有 courses.html 对比度护栏处停止，未修改无关的颜色问题。
后续复核已以当前代码重跑严格全量：`TEST_RETRIES=0 npm test` 为 101/101；原先对比度护栏导致的中断记录保留为历史事实，不再作为当前未完成项。
