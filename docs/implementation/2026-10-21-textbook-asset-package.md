# 教材资产目录与九年级全一册试点

- Status: complete
- Updated: 2026-10-21
- Branch/worktree: `stabilize/p0-1-20261021` / `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `400f67b4270ed29ee42f1cdf6a6806c82dce0cfb`。当前另有独立课程库工作：修改 `server/db.js`、`server/index.js`、`server/routes/data.js`、`server/services/data-snapshot.js`；新增 `server/independent-course-library.test.cjs`、`server/routes/course-library.js`、`server/services/course-library-schema.js`、`server/services/course-library.js`、`docs/implementation/2026-10-21-independent-course-library.md`。全部保留，本任务不修改这些文件。
- Planner: GPT-6 Astra（用户已确认模型选择）
- Executor: GPT-5.6 Luna

## Objective

为“人教版英语 九年级全一册（2013）”交付一个可复制、可校验、可独立打开审查的教材资产包，统一归档词条、原始来源、图片母版与交付图、音标与审核证据，并支持后续音频清单。以此制定后续教材的目录模板。交付终点是实际试点包和使用它的只读审查服务，不涉及正式课程修订或数据库迁移。

## Current state and evidence

- 权威课程源：`output/textbook-extractions/people-grade9-full-2013-20261015/whole-book-launch-v1/textbook-ready-v1.json`（下称 launch/source）。现场只读确认 `drafts` 共14单元、628条，`images.wide` 有627个不同路径。Jason/Hayes共享图片；不能把627当缺一图，也不能假定路径数等于内容哈希数。
- 音标源：launch 下14个 `unitN-phonetics-draft-v1.json`，509条 transcribed、110条 composed、9条 needs-source-check。审查结论在 `phonetics-audit-v1.md`。用户已经确认本批补充，要求剩余不补；保留证据来源分类和人工确认的区别。
- `illustration-bindings-v1.json` 不是完整图片表：组装器对原已有图片直接 continue，故必须从628个实际词条枚举全部交付图。原课内容保持原字节，音标独立绑定。
- 扫描页及来源清单位于上述教材根的 `source-images/`、`source-image-manifest.json`、`review.md` 及 `supplement-20261015/`。转录材料在 `docs/source-materials/people-grade9-full-2013.json` 与 `people-grade9-full-2013-supplement.json`。
- 教材根的 `unit4-images` 至 `unit14-images` 报告及 launch 的修图报告记录 atlas、atlasSha256、cells[].master/masterSha256/files、itemId、position、rect。相关母版在 `ref/words-pic/atlases/` 和 `ref/words-pic/split/masters/`。Unit1–3另有pilot目录及旧制作记录，盘点应追溯实际交付路径，不能按单词猜母版文件名。
- 风格来源是 `ref/words-pic/split/masters/connect-with-v2.png`。已有共享图片catalog/交付协议使用内容SHA-256；参见 `docs/architecture/shared-vocabulary-illustrations-2026-10-19.md`。归档不重写公开图片引用。
- `scripts/lib/vocabulary-illustrations.cjs` 的 inspect(root,relative)限定 `assets/*.webp`，可用于验证原交付图；包内验证要按包内路径读取字节并复用 image-dimensions，不放宽原公共检查器。
- `scripts/serve-textbook-phonetics-review.cjs` 目前硬编码launch路径，以索引/顺序核对14份音标；提供GET/HEAD页面与 `/phonetics-data.json`，无数据库。`scripts/textbook-phonetics-review.html`已有筛选、统计及来源列，可扩展包模式。
- 私有资产工作区 `E:\chunk-practice-assets` 存在，`textbooks/pep-junior-grade9-full-2013` 尚不存在。其 `make-asset-manifest.cjs`只扫描固定roots，不包含textbooks；不能用旧全仓校验通过来证明新包备份成功。`docs/content-assets-repository.md`列出原仓库说明，远端备份本轮不验证也不推送。
- 当前教材没有配置课程音频。本轮建立音频绑定格式和空清单，不生成音频、不把其他课程音频混入。

## Assumptions and decisions

1. 用户请求的是资产组织规范。默认制作新副本，旧稿、正式课程、学习记录及浏览器数据保持原状。无需修改账号内容架构。
2. 目标新目录：`E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v1/`。CLI必须显式传出目录，不把E盘写死在程序中；目标已存在则拒绝，另选新版本。
3. 采用自包含归档包：一个版本目录包含全部交付依赖，同包内相同字节媒体仅存一份。跨教材线上共享仍由已有hash机制实现。本轮不建设新的全局对象库、符号链接或自动垃圾回收。独立可恢复比节省归档副本空间优先。
4. 包内清单是归档和制作入口，旧课程JSON是被保留的来源快照；不自动替代线上权威来源。后续新增内容使用新revision；不在两处同时编辑同一内容。
5. 空音标与未制作音频是明确允许的状态。缺少已经声明存在的交付图、文件哈希不匹配、身份冲突是硬失败。母版历史追溯不足单列缺口，允许保存不完整盘点，但不得宣称“全部原始资产已归档”。

## Scope

- 一个通用包读写/校验模块，一个CLI及九年级适配盘点入口；具体文件见下。
- 真实试点的新副本、来源追溯表、hash清单、审核记录、空音频清单及恢复说明。
- 原音标审查服务的可选包模式：能从新目录读取词条、音标和按需图片，显示归档/音频情况；旧启动方式继续工作。
- 更新资产文档与教材skill的归档约定，说明私有仓库中新目录需单独校验。

## Out of scope

不生成/补充内容，不合并音标到正式课程，不改courseId/unitId/itemId，不迁移其他教材，不改生产服务、数据库、共享图片中间件、service worker或OSS配置。不执行commit/push/upload，不修改私有仓库原有总清单脚本或覆盖其清单；新包自带清单及校验覆盖即可。不会因此要求全项目服务端回归。

## Contracts and data changes

### 目录与清单

版本目录包含 `manifest.json`、`checksums.json`、`README.md`、`sources/`、`vocabulary/`、`phonetics/`、`images/originals/`、`images/delivery/`、`audio/originals/`、`audio/delivery/`、`reviews/`、`releases/`。源资料/历史制作记录按教材内原相对路径保留在sources，避免同名文件覆盖。空目录以说明文件保留。

manifest格式 `textbook-asset-package`、schemaVersion=1，字段约定：
- book：保留原bookId、标题、出版社、年版、全一册、年级；packageVersion；createdAt。
- content：courseSnapshot（原JSON逐字节副本）、phonetics（14个原稿副本）；units保留unitId和有序itemIds。所有可读取路径为包内POSIX相对路径。
- files：每条含path、sha256、bytes、role、mediaType；媒体assetId=`sha256:<hex>`，相同媒体hash可有多种角色。生成的manifest本身不在files内；checksums记录manifest及全部payload的hash/bytes，不记录自身，避免递归。
- bindings：以原itemId关联unitId、word、图片assetId数组（保留顺序）、originalAssetKeys（原assets路径）、母版/图集引用及panel信息、phonetics文件和条目身份、audio数组。以ID连接，核对词头和单元，不以数组位置或拼写作为身份。重复词头合法，重复itemId失败。
- provenance：源root标识（workspace）、原相对路径→包内文件/hash映射；原材料文本内的历史路径保留不改，由映射解决。运行不依赖原机绝对路径、output或ref目录。原始文本/新写例句仍可区分。
- reviews：保留审查原文；新增approval记录绑定14份音标稿的hash，范围为用户已确认的非空内容，9条 `supplementation: deferred-by-owner`。其原status仍为needs-source-check；组合拟写不改成词典核实。不生成虚构图片人工批准。
- completeness：交付内容是否闭合、原图追溯缺口列表、待补音标9条、音频not-produced。统计从数据计算。

媒体归档文件名使用完整hash+原合法扩展名；人可读名字和原名保存在绑定/清单中。627原图片路径按实际hash去重，原课程JSON不改。所有浏览器词汇图必须16:9 WebP且每张<20000 bytes，wide/mobile原引用指向相同图；遗留备选图只作为来源保留，不新生成AVIF或手机版。

音频预留条目：itemId、kind(word/sentence)、text、locale、voiceId、voiceVersion、assetId、可选originalAssetId、reviewStatus。已有句子结构与sentenceAudio契约仍为权威，不新增练习协议。试点清单为空；测试夹具覆盖合法单词/句子音频绑定、缺文件及文本不匹配，不能按相同拼写自动复用不同语音或例句。

### 盘点、打包、恢复

新增 `scripts/lib/textbook-asset-package.cjs`、`scripts/textbook-asset-package.cjs`、`scripts/lib/grade9-asset-inventory.cjs`。CLI子命令：
1. `inventory --root <workspace> --source <launch/source> --out <new-inventory.json>`：只读源，生成显式输入列表、文件hash、目标映射、统计与缺口。通用打包器不硬编码九年级身份；适配器可由源bookId选择，未知教材要求显式inventory。
2. `pack --inventory <file> --out <new-package-directory>`：校验盘点hash与当前源一致；专属新staging目录复制，源/副本hash均验证，再转成最终目录，最后发布manifest/checksums。目标若出现或冲突必须拒绝，禁止覆盖。失败保留带失败说明的staging，不发布成功包。不用move源文件，不跟随symlink/junction，不抓取远程URL。
3. `verify --package <directory>`：仅凭包本身校验全部文件、manifest、关联、格式、预算和预期缺口；硬失败返回非零。支持显示文字或JSON摘要。

inventory选取范围：整本教材提取根（扫描、pilot、review、历史报告、launch资料）及两个source-materials文件；从课程实际图片键和匹配报告递归追踪到交付文件、母版、atlas、风格来源。可只读搜索其他制作记录以找到Unit1–3精确路径/hash绑定，但仅复制已证明与本书有关的记录。不用扫描整个磁盘，也不整体复制跨教材ref库。扫描清单已有hash必须验证。旧稿都作为历史资料归档；active bindings以launch/source为准，报告不能覆盖已审稿。找不到母版或多候选无法判定时列缺口，不猜测，不生成替代图。

路径读取必须验证相对路径、规范化路径及realpath均在允许根内，拒绝绝对路径、盘符、UNC、`..`、junction/symlink越界、Windows大小写冲突和同名不同内容。校验不要因为存在一个checksum文件就跳过关联检查。

恢复验收使用复制整个新包到mkdtemp目录，verify与预览均只给新包根。禁止恢复到原课程目录。独立包校验命令写入README和 `docs/content-assets-repository.md`，明确本地归档不等于远端备份完成。

### 运行时接入

`scripts/serve-textbook-phonetics-review.cjs`增加 `--package <dir>`；模块暴露可关闭server工厂便于测试，直接运行仍支持PHONETICS_REVIEW_PORT。未传package维持旧行为。包模式只用包模块解析，返回既有bookTitle/units数据并追加图片预览URL及资产/音频摘要。

新增只读 `/package-images/<sha256>.webp` 路由，仅服务manifest中明确为delivery且hash验证通过的图片；不开放整个包目录，不服务扫描、母版或任意文件。GET/HEAD之外405。HTML在包模式增加可展开的图片预览和包统计，用户展开才设置src，无全库下载。源链接限制http/https，所有文本转义。既有全部单元/状态/搜索保留；9条展示“暂不补充”，底层来源状态不变。

包读取失败清楚显示不可用，不回退原工作区资料掩盖缺失。测试/演示用独立临时端口，不重启4189或8787。实际只读预览证明能从私有资产目录读取；不声称正式学习页已使用包。

## Implementation steps

- [x] 1. 复核HEAD和并行改动，设置本计划in-progress。实现盘点适配器，确认真实628条/627路径、音标分类及原图追溯缺口；真实输入只读。
- [x] 2. 实现包模块/CLI及临时夹具测试，约束覆盖、路径、hash、重复身份、缺文件、共享图片、缺音标、音频绑定。
- [x] 3. 在新版本目录生成实际资产包；输入hash前后核验；没有完整原图证据则如实登记缺口，交付不可冒称原图齐全。
- [x] 4. 接入审查server和HTML包模式，原模式兼容。测试两种模式、按需图片、拒绝写入/任意路径、缺包报错。
- [x] 5. 将实际包复制到临时目录，verify和只读服务完成独立恢复验证；打开实际包的独立预览供用户查看。
- [x] 6. 更新 `docs/content-assets-repository.md` 与 `.agents/skills/textbook-wordbook-course/SKILL.md` 和 `references/asset-packages.md`，规定教材包流程、hash/审核/语音绑定与原图保护。记录真实命令、目标、结果和缺口。

## Validation

- [x] `node --test scripts/textbook-asset-package.test.cjs scripts/textbook-phonetics-review.test.cjs`：6/6通过，含路径、hash、共享图、音频绑定、只读服务和旧模式验证。
- [x] `node e2e/textbook-asset-package-review.test.cjs`：使用显式实际包参数；14单元、筛选/状态、按需图像、桌面/窄屏、无pageerror、写入返回405。测试将包复制到新临时目录和端口，结束后删除本次创建的临时副本。
- [x] 用实际新包运行CLI verify：成功；包内1,842个校验对象，628条、619条非空音标、9条deferred、0音频。搬迁HTTP恢复测试随e2e结果记录。
- [x] 复核source fingerprint为 `f7fc4e77211008dec98d48fb86e88230a539f088867b9627aeb8d7c497418ac1`；源输入未被本任务写入。

## Acceptance criteria

- [x] 私有目录中存在可打开的新revision，README说明词条/图片/音标/音频目录和实际预览命令。
- [x] 628词条及原身份完整，619非空音标、9条暂不补充，音频not-produced；597条已确认、22条新增待审，未把待审冒报为批准。
- [x] 所有当前交付图片都在包内，hash/尺寸/大小通过；源627路径映射可追溯，统计区分路径和hash。
- [x] 原扫描、现存可追溯母版、atlas和审核记录已归档；报告缺口数为0（只对已枚举且可追溯的关联，不推断未留档历史）。
- [x] 包外路径不参与恢复读取；独立只读审查入口消费新包且图片按需加载。
- [x] 源数据/服务/账户保持原状；本地包和远端备份状态分别说明，无自动push或OSS部署。
- [x] 通用打包器接受显式inventory契约；下一本教材仍须先新增并核实其专用盘点适配器，不会复制整套打包工具；本次未迁移其他教材。

## Risks and rollback

- 主要风险：旧母版无法唯一追溯、以旧图片报告覆盖已修图、把磁盘路径误当课程身份，以及只备份delivery漏掉来源。用实际课程键、来源hash映射和缺口报告控制，不通过重新生成解决。
- 复制母版增加磁盘/LFS体积；盘点显示预计字节并检查目标磁盘空间，流式复制/hash避免整库载入内存。没有网络上传授权，本轮不产生LFS上传。
- 并行独立课程库任务可能继续改服务端；不触碰其文件、不重置工作树。若本任务入口也被他人改动，先核对差异，仅合并本任务必要改动。
- 回退为停止新只读预览并继续旧模式；原目录与正式课程不变。新包/失败staging保留可核查，不自动删除归档。

## Execution notes

- 2026-10-21 规划：用户确认GPT-6 Astra已选择。只读查看现有源码/清单/私有目录；本轮仅新增本交接文档。
- 2026-10-21 执行开始：按用户“继续执行”，复核当前HEAD和并行独立课程库改动；保留并行文件及工作区全部既有修改。
- 2026-10-21 实施：生成私有本地revision `E:\\chunk-practice-assets\\textbooks\\pep-junior-grade9-full-2013\\revisions\\20261021-v4`。源fingerprint `f7fc4e77211008dec98d48fb86e88230a539f088867b9627aeb8d7c497418ac1`；manifest SHA-256 `c7a27cdcc0f4ca6218aa1d0116d0927f157e69e7c8bd42b78681458b3d9255a5`；目录实际字节748,503,103，manifest列出的payload与manifest共1,842个校验对象、748,111,943 bytes。14单元、628条、627路径/627个唯一交付图、716个来源图集/母版、619个非空音标，其中597已确认、22待审、9暂不补；无课程音频，报告缺口0。音标已确认数量仅597，未把待审条目冒报为通过。
- 2026-10-21 校验：实际包CLI verify成功；资产包和review单元测试6/6通过；真实包Playwright搬迁/桌面窄屏/按需加载/只读测试1/1通过（复跑24.1秒），临时副本已由测试清理。重新盘点当前原始输入得到1,837个来源文件、0个缺口，fingerprint仍与v4一致。审核服务已在独立端口4191从v4包启动，页面已打开并显示14单元、628条及597/22/9审核分类；当前浏览器可预览 `http://127.0.0.1:4191/textbook-phonetics-review.html`。
- 本包仅本地存在于私有资产工作区，尚未提交、推送或上传OSS；仓库总清单工具不扫描textbooks目录。没有变更课程数据库、学习记录或正在使用的8787/4189服务。服务进程仅为当前审核预览新启的4191。
- `20261021-v1`至`v3`及失败staging按保全要求保留并在私有README标记不可用；不要将它们当正式包。下一本教材需增加并核实源盘点适配器，打包契约本身可复用。
