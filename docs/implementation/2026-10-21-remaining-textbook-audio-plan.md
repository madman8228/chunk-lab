# 剩余教材单词与例句音频制作规划

日期：2026-10-21。状态：执行中；19 册单词 Opus 已完成并核验；3,642 条句子原创文本草稿已齐备，全部待用户审阅，尚未据此生成句子音频。

## 执行记录（2026-10-21）

- 新增通用任务队列与 Kokoro WAV 续跑生成入口：`scripts/prepare-textbook-audio-queue.cjs`、`scripts/generate-textbook-audio-masters.py`；另新增 `scripts/package-textbook-audio-delivery.cjs` 生成并核验 Ogg/Opus。
- 已为人教版七上、七下、八上、八下建立独立本地任务批次，源文件摘要与书目 ID 记录在每册队列中。四册共 1,874 条 word 任务、1,874 条 sentence 任务。单词 WAV 母版每项都有独立输入摘要和文件哈希；生成中断可按批次恢复。
- 四册全部生成 24 kHz 单声道 WAV 母版，并打包为 32 kbps VBR 单声道 Ogg/Opus：七上 311、七下 464、八上 507、八下 592 条绑定；合计 1,874 个唯一交付文件、6,514,026 bytes。所有交付 Ogg 均由打包程序核验 Opus 编码、单声道、Ogg/Opus 标记；随后逐文件复核交付清单中的 SHA-256 和字节数，未发现缺件或不匹配。
- 资产位于 `E:/chunk-practice-asset-sources/textbooks/pep-junior-grade{7,8}-{upper,lower}-2024/audio-batches/20261021-audio-queue-v2/`，包括任务队列、逐条生成清单、WAV `masters/`、整理 WAV `prepared/`、Opus `delivery/` 与交付清单。原始音频未进入 Git，也未上传远端。
- 试跑第一版 `20261021-audio-queue-v1` 的 40 条 WAV 保留在原目录作为生成排查记录；检查发现默认 G2P 会将缩写 PLA 读成普通单词，故未对 v1 生成 Opus。第二版对全大写缩写按字母名朗读，试跑中的 PRC、PLA、VR、WHO、UN 音素转写已核实符合逐字母读法。历史 v1 未覆盖或删除。
- 七上目前全部 311 个词条都有原创英文例句和中文译文草稿，标记为新写而非教材原句、等待用户审阅：Unit 1 的 40 条在 `20261021-sentence-drafts-v1/unit-1-sentences.json`；三个 Starter Unit 与 Unit 2–7 的 271 条在 `20261021-sentence-drafts-v2/`。逐条与词表核对后，来源摘要、单元、词头、词条 ID 和总数均匹配，无漏项/重复项；Unit 3 “rise” 的词义疑点单独标注待确认。所有文本仍未定稿，未据此生成句子音频。
- 七下全册 Unit 1–8 共 464 条原创例句和中文译文已起草，分别绑定 47、59、55、60、64、62、52、65 个来源词条；来源摘要与词条 ID/词头/单元/数量均核对通过，均为待用户审阅，未生成音频。`voice`、`mount`、`genie` 的词义/常见用法留有审阅提示。审阅索引：`E:/chunk-practice-asset-sources/textbooks/pep-junior-grade7-lower-2024/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 八上全册 Unit 1–8 已有 507 条原创例句和中文译文草稿，全部绑定到来源词条且映射校验通过，尚待审阅。发现的来源释义问题均留有复核提示，没有更改原词表。审阅索引：`E:/chunk-practice-asset-sources/textbooks/pep-junior-grade8-upper-2024/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 八下全册 Unit 1–8 新增 592 条原创例句和中文译文，逐条映射校验通过，尚待审阅。来源释义或用法疑点均留有复核项，没有修改原词表。审阅索引：`E:/chunk-practice-asset-sources/textbooks/pep-junior-grade8-lower-2024/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 小学人教版 PEP 三年级下册 Unit 1–6 的 115 条原创例句和中文译文草稿全部完成，映射校验通过，尚待审阅。该批教材版权页具体版次/印次仍待确认；例句来源范围是已核对的单元词表。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade3-lower-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 小学人教版 PEP 三年级上册 Unit 1–6 全册 108 条原创例句和中文译文草稿已完成，映射校验通过，尚待审阅；本批封面审定年份为 2024，具体出版版次仍待版权页确认。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade3-upper-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 小学人教版 PEP 四年级下册 Unit 1–6 的 111 条原创例句和中文译文草稿现已全部完成；逐单元按来源 SHA-256、词条 ID、词头、数量和待审状态核验通过。具体版次/印次待版权页确认。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade4-lower-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 小学人教版 PEP 四年级上册 Unit 1–6 的 108 条原创例句和中文译文草稿现已全部完成；逐单元按来源 SHA-256、词条 ID、词头、数量和待审状态核验通过。具体版次/印次待版权页确认。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade4-upper-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 小学人教版 PEP 五年级下册 Unit 1–6 的 96 条原创例句和中文译文草稿现已全部完成；逐单元按来源 SHA-256、词条 ID、词头、数量和待审状态核验通过。具体版次/印次待版权页确认。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade5-lower-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 小学人教版 PEP 五年级上册 Unit 1–6 的 119 条原创例句和中文译文草稿现已全部完成；逐单元按来源 SHA-256、词条 ID、词头、数量和待审状态核验通过。具体版次/印次待版权页确认；来源 `visit` 的释义疑点单独标注。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade5-upper-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教版 PEP 六年级下册（2013）Unit 1–4 的 90 条原创例句和中文译文草稿现已全部完成；逐单元绑定至 v2 队列来源摘要、词条 ID、词头和数量均通过，全部待用户审阅。范围只含单元词表，不含附录词汇与 Useful expressions。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade6-lower-2013-20261015/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教版 PEP 五年级下册（2013）Unit 1–6 的 187 条原创例句和中文译文草稿现已全部完成；逐单元按来源 SHA-256、词条 ID、词头和数量核验通过，全部待用户审阅；与 2024 版分开。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade5-lower-2013-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教版 PEP 六年级上册（2024 审定标识）Unit 1–6 的 143 条原创例句和中文译文草稿现已全部完成；来源身份的用户标注 PEP 与精通版目录分开，逐单元 SHA-256、词条 ID、词头和数量校验通过，均待用户审阅。来源文件含个人学习用途提示，正式发布前需另核授权范围。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-pep-grade6-upper-2024-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教精通版小学英语三年级上册 Unit 1–6 的 136 条原创例句和中文译文草稿现已全部完成；逐单元按来源 SHA-256、词条 ID、词头和数量核验通过，全部待用户审阅。正式单元标题、出版版次/印次仍待目录/版权页核实。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-jingtong-grade3-upper-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教精通版小学英语三年级下册 Unit 1–6 的 113 条原创例句和中文译文草稿现已全部完成；逐单元 SHA-256、词条 ID、词头和数量核验通过，全部待用户审阅。Revision 与歌曲目录不在结构化词表范围内。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-jingtong-grade3-lower-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教精通版小学英语五年级下册 Unit 1–6 的 143 条原创例句和中文译文草稿已完成；逐单元 SHA-256、词条 ID、词头、状态和数量核验通过，全部待用户审阅。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-jingtong-grade5-lower-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教精通版小学英语五年级上册 Unit 1–6 的 96 条原创例句和中文译文草稿已完成；逐单元 SHA-256、词条 ID、词头、状态和数量核验通过，全部待用户审阅。来源注明仅供个人学习，正式发布前须先核实授权。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-jingtong-grade5-upper-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 人教精通版小学英语六年级下册（2013）Unit 1–3 的 86 条原创例句和中文译文草稿已完成；逐单元 SHA-256、词条 ID、词头、状态和数量核验通过，全部待用户审阅。审阅索引：`E:/chunk-practice-asset-sources/textbooks/primary-jingtong-grade6-lower-2013-20261014/audio-batches/20261021-sentence-drafts-v1/REVIEW-INDEX.md`。
- 单词音频全册复核：19 个教材队列中 3,642 条 word 任务均为 generated；19 份交付清单绑定 3,642 个文件，实际 `.ogg` 文件数为 3,642，无数量不一致。
- 句子任务在音频队列中仍为 `pending-final-text`，这是等待用户审定文本的门控状态。全量 3,642 条任务现均有对应的新写英文句子和中文译文草稿；19 册逐条核对来源摘要、词条 ID、词头、唯一性和非空文本通过，全部保持 `pending-user-review`/`pending-review`。目前没有一条标记为用户已审定，也没有生成这 3,642 条句子音频。
- 已建立总审阅入口 `E:/chunk-practice-asset-sources/textbooks/SENTENCE-REVIEW-INDEX.md`，列出 19 册审阅索引；19 个链接目标均已验证存在。每册索引引导查看各单元 JSON 和对应的来源/审阅注意项。
- 为集中审阅新增本地入口 `scripts/textbook-sentence-review.html` 与服务 `scripts/serve-textbook-sentence-review.cjs`，地址 `http://127.0.0.1:4199/`。页面提供逐条“通过／需修改／撤销结论”控件；决定以源文件和句子指纹绑定，追加保存到独立审核记录，不改草稿、音频队列或发布状态。2026-10-22 发现端口仍由旧只读进程服务（POST 返回 405）；确认审核记录文件不存在后，已将同一地址切换到当前服务版本。新进程只读加载仍为 19 册、3,642 条；页面包含三个审核按钮。空效验请求返回 400 且没有创建审核文件，未替用户标记任何词条。
- 新增 `scripts/prepare-approved-textbook-sentence-queue.cjs`：收到用户明确的教材/单元通过确认后，可把对应待审 JSON 转换为单独的派生队列，生成含确认语句、教材/单元、来源与草稿摘要及词条 ID 的批准记录；只有选定单元变为 `ready`，原始队列和草稿不回写，未审单元继续 `pending-final-text`，产物仍标记不可发布。临时目录测试覆盖通过范围、原队列不可变、其他单元保持待审，以及缺确认、来源摘要不匹配、条数不符、重复词条和非待审输入均失败关闭。真实 3,642 条尚未套用批准状态。
- 扩展 `scripts/package-textbook-audio-delivery.cjs`：默认单词打包行为不变，增加 `--kind sentence`；句子模式要求所有本批已生成的任务都有队列中的匹配用户批准记录，且不允许仍有 `ready` 任务，产出 `textbook-sentence-audio-delivery`、32 kbps VBR Ogg/Opus 文件和逐文件校验清单，保持 `publishable: false`。隔离临时目录已用 WAV 技术音调夹具端到端验证 Opus 编码、Ogg/Opus 标记、SHA-256 和清单数量；这只验证技术打包，不代表听感或课程内容获批。现有 19 个当前单词批次（3,642 条绑定）通过新增打包前队列/生成清单一致性检查；七上旧试跑 v1 因只生成 40/311 条而明确保留并排除在当前批次之外。
- 小学阶段 16 册清单中，14 册有结构化 `extracted-vocabulary.json`；PEP 六下 2013 版从已存在的四个单元词表数组适配为 90 条任务，额外 34 条 Useful expressions 未纳入。15 册合计 1,768 条单词任务已生成并打包。人教精通六上 2024 的 112 条暂缓，因为原始教材记录明确写着系列归属“待核”；不把它并入精通正式音频目录。
- 当前已完成 19 册、3,642 条单词 WAV 母版与 3,642 个 Ogg/Opus 文件（含前述七、八年级四册和小学 15 册）。WAV 合计 250,704,168 bytes；Opus 合计 12,217,509 bytes。逐母版核对 24 kHz、单声道、SHA-256 与字节数均通过；所有交付文件的 Ogg/Opus 编码检查通过，逐文件摘要复核未发现缺件或不匹配。每册任务队列里的 3,642 条 sentence 仍为 `pending-final-text`。
- 已把九年级 v20 的 628 条单词与 628 条句子音频一并纳入只读索引；19 册新词音频加九年级既有内容共校验 4,898 个交付文件，SHA-256 均与清单一致。索引含 4,464 个严格复用键，其中 373 组出现重复朗读候选；但候选文件哈希均不相同，当前没有把重复文本当成已复用文件，也没有回写任何课程包。索引路径：`E:/chunk-practice-asset-sources/textbooks/audio-reuse-index/20261021-v3/reuse-index.json`。
- 3,642 条新课程句子均已有待审草稿，尚待用户审定文本后才可批量合成。覆盖七上、七下、八上、八下四册全册，以及所有已建立结构化队列的小学 PEP 和精通版教材版本；按册审阅，确认后再批量合成。
- 补充盘点（只读）纳入当前 19 册之外的候选范围。人教版九年级上册（2024）源稿 `docs/source-materials/people-grade9-upper-2024.json` 身份为人民教育出版社《义务教育教科书 英语 九年级上册》（2024），转录 Unit 1–8 共 477 行，明确标记 review-only，并要求逐页核对拼写和释义，未建音频队列。清单登记了 27 张扫描图的文件名和 SHA-256，但本次在原登记的 `C:/Users/Administrator/AppData/Local/Temp` 与 `E:/chunk-practice-asset-sources` 中均未找到这些文件；因此当前无法完成源页对照，不能把这 477 行当成已核定词表，也不能入音频队列。出版社官网公开配套资源目录 `https://www.pep.com.cn/zslth/yyptzy/czyy/9s/` 可在浏览器访问，列出与该书相符的 Unit 1–8 和分单元词汇音频，但没有原词表扫描页，不能替代 27 张源图。下一步应先从用户保留的教材原始资料恢复/重新提供这 27 张图，或确认一个可访问的原始扫描目录，再逐页核对后建队列。
- 人教版高中英语必修第一、二、三册（2019）各有独立内部预览 JSON，分别为 332、350、395 条，共 1,077 条，且没有对应音频批次或原创例句审阅稿。预览报告的图像状态分别为：通过 292/325/377，待修改 33/20/15，待审 7/5/3；三册合计 83 条尚未通过配图检查。状态字段来自配图审查，不证明词表来源/释义核定、句子审核或音频授权已完成，因此只能作为盘点快照，不能直接生产或发布音频。先核实教材词表来源与版本，再独立完成词目核对；配图问题另行处理，之后按单元审阅原创例句。两类候选均不得与当前 19 册混批。
- 原始教材素材跨盘备份已执行并核验：把 `E:/chunk-practice-asset-sources/textbooks/` 完整复制到 `D:/chunk-practice-backups/textbooks-20261021/`。源与备份各 15,925 个文件、1,439,531,673 bytes；逐文件 SHA-256 比对结果为缺失 0、多余 0、内容不匹配 0。逐文件校验清单在 `D:/chunk-practice-backups/textbooks-20261021/BACKUP-MANIFEST.json`。D 盘是 500 GB SSD，E 盘是 1 TB HDD，属于不同物理磁盘。复制未移动或覆盖源文件。现存 `E:/chunk-practice-backups/` 中既有备份不包含这些教材源资产；资产仓库 `E:/chunk-practice-assets/` 配有 GitHub 远端，但当前无教材目录下的 WAV/Opus 被 Git 跟踪，原始教材源资产仍留在本地素材树与这份 D 盘备份中。
- 九上（2024）源页再次定位（2026-10-21）：清单具体登记的教材印刷页 107–116 共 10 张词汇表扫描图，另有封面和 Units 1–4、5–8 两页目录图；这些图的 13 个登记文件名在用户 Temp、Downloads、D 盘项目、D 盘教材备份及 E 盘素材树均未找到。该 JSON 另记“27 张原图已找到”，与当前可访问文件状态不一致；在恢复原图前不得据此核定 477 条转录或建立音频任务。向用户索取时优先要 p.107–116，封面/目录用于版本确认。
- 随后用户补充提供了词汇表 p.107–116 的 10 张图。每张均以 SHA-256 绑定并存入 `E:/chunk-practice-asset-sources/textbooks/pep-junior-grade9-upper-2024/source-scans/20261021-v1/`，另复制到独立备份 `D:/chunk-practice-backups/pep-grade9-upper-2024-source-pages-20261021/`；两处各 10 张、总计各 3,401,638 bytes，20 份副本均与附件原件逐张哈希相同。没有收到封面和目录页；这不影响 p.107–116 词表逐项核对。登记映射见 `docs/source-materials/people-grade9-upper-2024-scan-recovery-20261021.json`。477 条转录仍待逐页核对，暂未建立音频队列。
- 逐页对照已开始：p.107–108 的 102 条可见词目与释义、次序均匹配；p.109 发现转录遗漏 `dictionary`（“词典；字典”，教材页 p.23），原扫描可见但 477 条 JSON 中不存在。当前源文件行数可能需要随全册核对上调；只登记差异，尚未修改 review-only 转录，p.110–116 继续待核。快速 OCR 漏识 22 个词头，人工确认其中包括实际清晰可见项（如 `dynasty`），因此 OCR 阴性仅作为复查提示，不作为删改依据。
- 继续视觉核对 p.110，发现 5 处需修订/补录的词目文本：`mix up` 被转录成 `mix`；`case` 释义把“实情”录为“事实”；漏录 `in sb's case`；`click` 漏掉“（用鼠标或在触摸板上）”这一释义范围说明；`pardon` 漏掉感叹词义“请再说一遍；抱歉”。均只写入差异清单，原 477 行转录保持不变。当前累计对照 p.107–110，发现至少 6 个词头/释义差异，需完成全册后再生成修订稿或入队。
- p.111 继续核对发现：`divide` 下方另列用法 `divide sth into 把某物分为`，原转录只保留“分成”，未录该用法。p.111 的差异一并记入审计清单。
- p.112 再发现 4 处释义差异：`officer` 转录多出“警官”；`ideal` 漏掉名词义“理想；完美的人（或事物）”；`certain` 漏掉代词义“（不提及人或事物的名称时用）某些”；`gradually` 第二义重复写成“逐渐地”，原页为“逐步地”。全册差异继续只登记，不回写待审原稿。
- p.113 发现 `crowded` 被误录为 `crowd`，`survey` 释义把“调查”误为“测绘”；`on board` 在原页作为独立用法列出，目前并入 `board` 释义，需按词目结构补全。其它 OCR 阴性候选（含 `mysterious`）在扫描页可见，不能据 OCR 未识别判定缺词。
- p.114 对照发现 Unit 7 有多处遗漏/错录：`folk` 漏名词义和 folks 用法；`classical` 漏名词义；`pop` 的动词义误录；`rap` 释义与原页措辞不同；原页是 `policewoman`，转录为 `policeman`，同时 `electronic` 暂未在词汇页找到；`outdo` 多录“超过”且变形词需保留；`soul`、`tape` 释义不一致；`characteristic` 漏“独特的”。已标为差异，待复核后统一修订。
- p.115 发现 `tap` 漏名词义；`champion` 用字疑似误录；`flowing` 把“松散的”误成“松懈的”；漏录独立词组 `figure skating`；`figure` 多录“认为”；`make up ground on sb/sth` 漏“向”；`smooth` 第二义重复“顺利的”，原页为“光滑的”。差异仍只登记。
- p.116 发现 `worldwide` 漏“世界各地”；`Roman` 漏“罗马字体”；漏录 Unit 8 的 `drown`、`cheer` 和 `crowd`。其中 `crowd` 被误写成 Unit 6 的 `crowd`，该处原词为 `crowded`。10 页逐图初审已覆盖，转录存在多处漏项/释义差异；下一步需二次校对差异与数量，之后生成独立修订稿供用户审定，不能直接合成音频。
- 并行保护高中必修一至三原始词汇扫描（2026-10-21）：D 盘项目的三个 `source-images/` 目录共 51 张 PNG、20,375,889 bytes，未被 Git 跟踪；此前未发现 E 盘副本。已复制至 `E:/chunk-practice-backups/highschool-source-pages-20261021/`，逐文件 SHA-256 复核缺失 0、差异 0、多余 0。D 盘原图未改动。高中词表核定、83 条未通过插图问题、例句审阅与音频仍未完成。
- 依据逐页差异生成独立候选稿 `docs/source-materials/people-grade9-upper-2024-review-v2.json`：从原始 477 行转录做 27 个精确替换、补 8 行、移除 1 行，得到 484 行；原文件不变。脚本 `scripts/build-grade9-upper-2024-review-v2.cjs` 以精确匹配保护源行、拒绝覆盖旧产物、检查重复单元/词头，并记录原文件 SHA-256 与源页清单。验证确认原稿哈希绑定、484 行、8 个已识别缺项都在候选稿内；状态仍是 `pending-user-review` / `not approved`。该数字是修订候选数，不代表教材词表全量最终核定；IPA/变形等未纳入四列词目转录的源信息仍需另行审视。未建立音频队列。
- 已生成便于逐条审阅的差异表 `docs/source-materials/people-grade9-upper-2024-review-v2.md`，列明 35 条核对发现、原页/教材页、原稿差异及 v2 提议；有一处 `champion` 字形仍需以原图确认。此轮只完成了词表转录核验，尚未撰写本册原创例句、转录 IPA/读音例外、生成单词/句子音频或发布。
- 这些音频批次目前是按教材归档的本地生产资产，尚未合并进各教材的完整 `revisions/<version>` 课程包，也没有接入学习页播放或发布。课程包和句子音频播放接入仍待后续完成。

## 目标与已核查事实

每条正式单元词目绑定一条单词/词组音频和一条原创英文例句音频，按教材版本形成独立、可校验的资产包。开发代码与生产工具继续位于 `D:/06-project/chunk-practice`；教材资产沿用现有 E 盘布局。

- 九年级基准包是 `E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v20`。清单中的 `packageVersion` 为 v20，包含 627 张图片、628 条单词音频和 628 条例句音频。它的 README 仍混有旧版文字，版本判断应以核实后的清单为准。
- 七、八年级四册词表共 1,874 条，已建立单元、词目 ID 和图片映射；已核查的提取记录、配图清单缺少标准化的定稿英文例句字段。配图完成不证明例句已定稿，应先搜集现有句子再补缺。
- 小学当前配图目标清单包含 16 个教材版本、1,880 条单元词目。六下 2013 版的 90 条单元词目尚无统一 `extracted-vocabulary.json`，需从既有来源与单元映射补适配；34 条 Useful expressions 不自动并入。
- 现有 `generate-textbook-sentence-audio.py` 写死 628 条；`textbook-asset-package.cjs` 的 inventory/pack 适配九年级。生产多个教材前要消除这些教材专用限制，不能直接改数字反复运行。

## 范围与顺序

以下是已知制作目标的音频绑定数，复用后实际新增文件数会减少。每册版本和词目数在冻结输入时再次核对。

| 阶段 | 教材 | 词目 | 单词音频绑定 | 例句音频绑定 |
|---|---|---:|---:|---:|
| A1 | 人教版七年级上册，2024 | 311 | 311 | 311 |
| A2 | 人教版七年级下册，2024 | 464 | 464 | 464 |
| A3 | 人教版八年级上册，2024 | 507 | 507 | 507 |
| A4 | 人教版八年级下册，2024 | 592 | 592 | 592 |
| B | 当前小学 PEP / 人教精通 16 个版本 | 1,880 | 1,880 | 1,880 |
| 合计 | 20 个教材版本 | 3,754 | 3,754 | 3,754 |

七、八年级共 3,748 个绑定；上述 20 册合计 7,508 个绑定。高中必修一至三与九年级上册 2024 已完成只读初盘，但未达到入音频队列条件；按上方门槛补齐扫描源页/词表核定和逐册内容审核后，再作为独立书目版本排期。历史重复抽取与已替代目录保留，不重复制作。

先用七上完成一册端到端流程，再依次推进七下、八上、八下及小学各册。单词任务可以跨册集中去重；句子任务跟随各册文本定稿进度。

## 输入冻结

1. 为每册选择唯一的来源快照，核对出版社、书名、审定年份、册别、单元顺序及词目身份。
2. 搜索既有原创例句、翻译与场景；保留已确认版本，只补缺项。新写句子按年级控制难度，使用词表所列目标词义，并核对与已完成配图的关系。分别标记教材原始词头/释义和原创例句/翻译。
3. 每条生产任务记录 `bookKey + unitId + itemId + kind`、显示文本、实际朗读文本、词义/词性或发音提示、来源快照摘要。现有局部 `itemId` 会跨册重复，不能独自作为全局任务键。
4. 对人名、地名、缩写、数字、多音词、含省略号的词组和括号内容建立例外清单。显示文本与朗读文本分别保存；朗读展开和发音选择必须可追溯。
5. 单词文本及读音明确即可入队；例句需有确定的英文原句和对应内容版本。已审核文本沿用已有记录，新写/改写的句子形成一次集中审阅材料。
6. 冻结后计算输入摘要。仅标点、大小写也可能影响朗读；变更时重新判断对应任务，不用笼统的小写化或去标点匹配。

## 统一音频规范

- 继承九年级已采用的 Kokoro `af_heart`、美音 `en-US`、默认 speed 1.0；模型、音色文件及依赖版本记录摘要。
- WAV 母版为 24 kHz 单声道；保留原始输出和首尾静音/音量整理后的版本。
- 课程交付使用 Ogg 容器中的 Opus，32 kbps VBR、单声道、`audio/ogg`，文件扩展名 `.ogg`。核验实际编码；Opus 解码器报告的时钟采样率可与 24 kHz 母版不同。
- 沿用已确认的整理参数，保留自然起音和尾音；用输入长度和音频类型判断异常时长，避免给所有课程套固定句长上限。
- 首个小批覆盖普通词、词组、缩写、专名及长短句，并测量真实速度与资源占用，再估算全量耗时。

## 复用、队列与续作

先索引九年级 v20 和既有已确认音频清单，再规划缺口。

复用键包含实际朗读文本、发音选择、语言、声音、模型/音色摘要、语速及音频处理配置。相同拼写存在不同词性或读音时需要分别判断；未经确认的发音不自动升级为已审核。文件存在且摘要、解码和文本绑定均匹配才算命中。

每个词目的绑定保持独立，多条绑定可以指向同一内容哈希音频。原文与朗读规范不一致的条目进入例外列表，避免仅按拼写误用。

生成器由教材清单驱动，支持 `word` 与 `sentence` 两类任务。模型常驻，小批队列运行；首批测量后再确定并发数。每条成功任务立即记录输出摘要与状态，支持中断恢复和失败重试，不等整册结束才写总清单。重启后跳过已核验任务，修订输出使用新文件，不覆盖原资产。

状态至少区分：待定稿、可生成、可复用、已生成、自动检查通过、听感待确认/已抽样确认、异常需处理。审核记录绑定实际文件摘要与声音配置。

## 存储与每册交付

沿用已经存在的两个素材根目录：

```text
E:/chunk-practice-assets/textbooks/<book-key>/
  revisions/<新版本>/
    manifest.json
    checksums.json
    README.md
    sources/                 # 词目、英文例句、翻译及来源快照
    phonetics/
    images/delivery/
    audio/delivery/           # 两类 Opus，按内容哈希引用
    reviews/
    releases/

E:/chunk-practice-asset-sources/textbooks/<book-key>/
  audio-batches/<新批次>/
    generation-manifest.json
    masters/
    prepared/
    delivery-manifest.json
```

课程包内完整保存该版需要的交付素材，便于单包校验和搬运；共享音频索引用于减少重复生产。原始 PNG 与 WAV 在本机原始素材目录保存，课程包用清单摘要关联。沿用每册新增 revision 的方式，不修改九年级 v20 或其他历史包。

每册登记明确的当前包路径和摘要；README、统计表和最新版本索引从最终清单生成并交叉核对，避免再次出现 README 与实际版本、音频数量不一致。旧包的摘要约束不因修正文档而被静默破坏。

## 验收与课程播放绑定

自动检查覆盖全部文件：

- 词目身份、两类音频绑定、输入文本与快照摘要一致；无串册、漏项、重复任务或悬空引用。
- 每个交付文件均能解码为 Opus 单声道；摘要和字节数一致，音量、静音、异常时长纳入报告。
- 音频文本来自最终英文原句；人名、缩写与多音词的选择进入例外记录。
- 包清单分别统计单词条数、句子条数、逻辑绑定数、唯一交付文件数及复用数。
- 全部原图片引用保持可用，已有 WebP 仍符合小于 20,000 bytes 要求。
- 一个新目录中的课程包可以独立校验；真实学习预览中单词发音与句子音频两路均可读取正确资源。

文件已归档与学习页已接入播放应分别验收。先核对单词发音的既有字段和读取方式，不为挂载发音文件而自动启用额外的听写练习。听感复核集中在首批代表样本、发音例外和自动检查异常；准确记录抽样范围，不标记为全部逐条人工审听。

## 实施阶段与交付物

1. **清单适配与缺口盘点**：输出每册来源快照、身份/例句/读音缺口、已有音频复用候选及预计新增任务数。
2. **通用生产入口**：移除九年级硬编码，统一单词和句子任务清单、检查点、复用查询与按册打包。用隔离临时目录检查跨册相同局部 ID、断点恢复、文本修改、损坏文件以及重复提交等有意义的情况。
3. **七上文本与首批**：完成来源和例句清单，先生成代表性小批并形成可播放预览、质量报告、实测速度。已有音色确认继续适用；新句子审核范围单独清楚列出。
4. **第一批四册生产**：逐册形成包含两类音频的全量新资产版本，异常条目单列，其他可完成任务继续推进。
5. **扩展小学及其他教材**：复用同一生产入口，按确认的教材登记表入队。小学 2013 六下先补结构化来源适配；高中必修一至三先核实词表来源并处理 83 条配图未通过项；九年级上册 2024 先恢复 27 张登记扫描图并逐页核对 477 行转录。词表和文本审核完成后，各书目独立建队列。
6. **每册交付**：完整资产包、音频绑定/复用报告、检查报告、例外处理表、听感审核记录及本地预览入口。课程发布在资产生产完成后按单独发布任务执行，目标始终为系统内置课程。

开发工具和审阅页面位于 D 盘项目；教材草稿、音频生产批次和审阅索引位于 E 盘本机素材目录，教材源资产另有 D 盘跨物理磁盘备份。未修改九年级 v20，未上传原始 WAV/PNG 到 Git 或远端，未迁移课程包，未改动主学习服务，未发布或写入账号。

## 2026-10-22 跨课程图片与音频目录续核

- 只读校验 `output/vocabulary-illustrations/catalog-20261022-grade9-v20-v2.json`：21 个课程目录，4,382 个词条绑定，4,374 个唯一 WebP；逐文件实际内容哈希校验不匹配 0。该 catalog 当前已覆盖小学三至六年级 PEP/精通版和初中七至九年级目录。内容相同的图按 SHA-256 共用身份，但不同图片的同词同义候选仍需人工决定。
- 本地图片复用审核服务 4205 返回 477 组待审；当前 477 组均未决定，未运行 `resolve-reviewed`，也没有改课内图片引用。
- 重新枚举 E 盘教材音频树：20 个按书目区分的素材根、21 个交付批次、4,898 个 `.ogg` 文件。九年级单词与句子音频分批保存；其他教材也各在自己的书目目录内。此次数量核验不移动文件、不推 Git、不上传远端。
- 新配图批次必须经内容目录预检，预检输入哈希不变、所有待做项均为 `generate` 才能打包；已审核同词同义候选会阻止重复生成。现行工具暂未支持对单个目标显式记录“候选不适用，因此允许生成”，此类项应保持阻断而不可绕过。缺图批次仍按 2×2 四词切图；最后余数批次可少于四项。
- 本次没有生成或迁移图片、音频，没有发布课程或改主学习服务。4199 仅更新本地例句审核辅助进程；审核状态仍待用户填写。
