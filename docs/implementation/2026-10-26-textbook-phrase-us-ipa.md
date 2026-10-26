# 教材常用短语美式音标首批交付

- Status: complete
- Updated: 2026-10-26
- Branch/worktree: `stabilize/p0-1-20261021` / `D:/06-project/chunk-practice`
- Base commit and relevant uncommitted changes: `95a79631bdd1686ddfe75d6c025697a142e0cb59`。规划时 3477 条工作区状态记录，含课程资料、图片、渐进搭句代码及已删除资源；全部保留，不 reset/clean，不批量提交。相关双口音运行时代码无未提交修改。
- Planner: GPT-6 Astra
- Executor: GPT-5.6 Luna

## Objective

交付一批可在真实学习组件中查看、切换口音的五条教材常用表达美式音标审核稿，并固定后续新增音标的记音规范。完成边界是独立候选包、可操作预览和针对性验证；不包含发布、全量补齐或自动音标生成。

## Current state and evidence

- 英式音频已获用户审听通过。`output/wordbook-phonetics-en-gb-audio-20261026-v1/draft-candidates/manifest.json` 包含20本4214条；SHA256 `3eb7b9ebd52978c0340c5bca05603a95c734517209c28f4eaa1aa9143a91d0c6`。原 manifest 仍写 pending-listening-review，另在本轮记录用户批准事实，不覆盖原文件。
- 美式 v1 在 `output/wordbook-phonetics-en-us-ipa-20261026-v1/`：2814条唯一读音候选（含222条大小写疑点），540条多读音，860条无精确单词匹配；其中813条为空格分隔的多词条目，不能把860都称作短语。该候选来源IPA-DICT，未统一成教材式记音，不是已发布数据。
- 用户明确不做多读音、大小写及专名专项审查。本轮不要求用户再审这些内容，不把免审理解成随意挑选读音，也不删除v1已有候选。
- `landing/listen-word-view.js`：`phoneticFor` 读取 `phonetics[accent]`，英式才允许旧 `phonetic`；缺失显示对应口音“音标待补充”。`audioFor` 读取 `learning.sentenceAudio.audioByAccent[accent]`，仅美式可回到基础 `audio`。无需新增前端猜测或转换逻辑。
- `wordbook.html` → `landing/wordbook-study.js` → `VocabularyListenWordView.create` 是运行入口。内容请求为 `/api/wordbooks/:bookId[/units/:unitId]/items` 和 `/api/vocabulary-items/:itemId?revision=...`。
- `js/vocabulary-course-contract.js` 限制 `phonetics` 为 en-US/en-GB 非空字符串（≤200字符）；`js/wordbook-draft.js` 已支持该字段。`scripts/listen-word-ui.test.cjs` 已有独立浏览器、请求替身和口音切换测试，可沿用方式。
- 不使用已禁用的 `scripts/prepare-wordbook-phonetics-supplement.cjs` 批量拼接入口。`scripts/review-wordbook-phonetics.cjs` 里的历史 proposal 只是建议，不能当作用户批准。

## Assumptions and decisions

1. 根因在内容来源与记音规则，修复放在离线内容加工层；当前前端不需兜底。好处是来源可追溯且不影响运行时；代价是首批范围小，其他短语仍缺美式音标。
2. 新增美式采用 Cambridge Advanced Learner's Dictionary 的 US 整条转写（不混用同页 American/Intermediate Dictionary 段落）。保留原始引用值；显示值仅去除音节分隔点 `.`，与现有教材显示习惯接近。保留长音、主次重音及美式卷舌符号；不全局替换 ɹ/r、ɝ/ɜː、ɛ/e，不根据字符猜词义。英式现值原样保留。
3. 本轮只处理下列已核对存在且有完整词典条目的五项，不扩大到813条，也不迁移2814条旧候选。所有五项来自 `textbook-wordbook:primary-jingtong-grade3-upper-20261014`，标题“精通英语 三年级上册（2024）”以源包准确标题为准。
4. 词典式音标说明表达的一种规范读法，不声称逐音素对应已有合成语音。复用已存在双口音整句音频；不生成新声音，不做音频强制对齐。

首批绑定（itemId前缀均为 `textbook-item:primary-jingtong-grade3-upper-20261014:`）：

| itemId后缀 | 教材原词项 | 美式来源原值 | 显示值 | 来源 |
|---|---|---|---|---|
| unit-1:entry:019 | Good morning! | /ˌɡʊd ˈmɔːr.nɪŋ/ | /ˌɡʊd ˈmɔːrnɪŋ/ | https://dictionary.cambridge.org/pronunciation/english/good-morning |
| unit-1:entry:020 | Good afternoon! | /ˌɡʊd ˌæf.tɚˈnuːn/ | /ˌɡʊd ˌæftɚˈnuːn/ | https://dictionary.cambridge.org/pronunciation/english/good-afternoon |
| unit-1:entry:021 | Good evening! | /ˌɡʊd ˈiːv.nɪŋ/ | /ˌɡʊd ˈiːvnɪŋ/ | https://dictionary.cambridge.org/us/pronunciation/english/good-evening |
| unit-1:entry:023 | Good night! | /ˌɡʊd ˈnaɪt/ | /ˌɡʊd ˈnaɪt/ | https://dictionary.cambridge.org/dictionary/english/good-night |
| unit-2:entry:025 | Thank you! | /ˈθæŋk ˌjuː/ | /ˈθæŋk ˌjuː/ | https://dictionary.cambridge.org/dictionary/english/thank-you |

以上来源在2026-10-26通过官方页面搜索结果核对。部分直接打开返回403；不绕过访问限制，不声称保存了网页完整快照。Luna可直接用此已核对表，不需重新检索整批。

## Scope

- 新增规范文档 `docs/curriculum/wordbook-phonetic-conventions.md`，限定为新增内容规则，明确旧v1未全量转换。
- 新增五项来源清单 `docs/source-materials/wordbook-us-phrase-batch-20261026.json`。
- 新增最小补丁生成器 `scripts/package-wordbook-us-phrases.cjs` 及针对性测试。
- 新增可运行的隔离预览脚本 `scripts/preview-wordbook-us-phrases.cjs`，复用现有学习页面/组件；配套浏览器验证脚本。
- 新输出 `output/wordbook-us-phrases-20261026-v1/`，已有时拒绝覆盖。

## Out of scope

发布、账号导入/报名、修改学习记录、直播服务重启、提交推送、词典全量抓取、机械拼接、AI批量推测音标、原英式音标修订、全库统一转换、其他练习模式音频改造、多读音/专名审查、图片生成。

## Contracts and data changes

- 唯一源包：`output/wordbook-phonetics-en-gb-audio-20261026-v1/draft-candidates/4b3f99fdf9e0da95bcd561f6491075958e634f910136da6e921e696c3525899a/candidate.json`，SHA256 `d52a55373cb7ef7f30bc545fea33d9fb05cef6ece60b54000843c9c37d8a14cb`；136项。以英式包为基底，避免把未统一规范的美式v1一并带入。
- 清单含 schemaVersion、bookId、sourceSha256、conventionId、五项 itemId/原word/原meaning/sourceIPA/displayIPA/sourceURL/accessDate/sourceSection、status=`source-checked-pending-user-review`、published=false。来源信息保存在旁车清单，不扩展运行时item字段。
- 每项仅添加 `phonetics['en-US']`；其余内容深比较不变。item revision = SHA256(JSON.stringify(item去掉contentRevision))，更新对应索引ref；book revision = SHA256(JSON.stringify(book.items))。结构revision/单位/ID/排序/所有learning音频和图片引用不变。
- 输出完整136项candidate.json与report.json，报告精确列出5项差异、源/输出哈希、未处理范围、未发布状态和英式审听批准记录。不是可独立部署的资源包；现有资源引用保持稳定，预览按限定资源表解析。
- 失败行为：源哈希、ID/词项/释义、五项数量不匹配或现有en-US冲突即失败；预检全部完成后才写入新目录；输出存在则拒绝。不得顺手覆盖源包或回退旧稿。

## Implementation steps

- [x] 写规范和五项来源清单，保留表中原值与显示值，不用笼统的“剑桥式转换”覆盖旧词条。
- [x] 实现生成器，默认上述固定源和新输出；支持测试传入临时输入/输出。使用 `js/vocabulary-study.cjs.validateIndex`、`js/vocabulary-course-contract.js.validateLearning` 与 `landing/sentence-cloze-engine` 验证完整候选。采用复制原对象再精确补字段，避免重新compile丢失未知原字段。
- [x] 生成五项补全的136项审核包。记录源哈希与输出差异，不修改旧manifest批准状态。
- [x] 完成隔离预览：Node本地只读服务绑定127.0.0.1随机端口（port=0），提供真实wordbook.html及其现有视图依赖；仅以预览适配器注入五项内容、fixture身份与禁用持久化的store，不接真实账号/API。脚本打印URL并保持运行供用户查看；默认不自动播放。浏览器使用隔离上下文与独立端口，不读取真实localStorage/IndexedDB。
- [x] 预览复用 `landing/wordbook-study.js` 的recognition路径以及真实 `landing/listen-word-view.js`。提供五项上一词/下一词、英美切换与整句播放；显著标注“未发布审核预览”。没有新增生产页面审核入口。
- [x] 仅提供白名单静态依赖和当前五项需要的资源。英式文件从英式候选 assets 查找，其他资源按原key从仓库assets查找并校验摘要。没有挂载server/data或任意目录。插图点击后加载，十条英美音频和五张插图均通过hash/大小核验。
- [x] 完成定向验证并保存桌面/手机截图、报告和可重复的预览启动命令。

## Validation

- [x] `node scripts/package-wordbook-us-phrases.test.cjs`：临时目录验证五项更新、非目标/英式/音频不变、源哈希错误、错ID/词项与已有输出拒绝；期望音标取自独立清单。
- [x] `node scripts/package-wordbook-us-phrases.cjs`：成功生成新审核目录，136项、五项美式短语音标，未发布。
- [x] `node scripts/wordbook-us-phrases-ui.test.cjs`：Playwright浏览五项，真实运行入口显示美式值并切回英式原值；十次音频请求均匹配选择口音；缺少美式值/音频提示正确；无持久化请求；1024和390宽度无横向溢出；插图只在点击后加载。桌面与手机截图已保存。
- [x] `node scripts/listen-word-ui.test.cjs`：既有口音回归通过。测试输出重定向到新建系统临时目录，原有`output/playwright/listen-word`截图未覆盖。
- [x] 只读核验：源SHA256仍为`d52a5537…d8a14cb`；136项中仅五项内容版本更新；英式音标、十个音频和图片引用均相同；10个音频文件和5张图片摘要/大小通过，错误0。未运行有生成副作用的全量prepare/test。

## Acceptance criteria

- [x] 五条常用表达具备可追溯的美式整条音标，转写风格一致；原英式读音完全保留。
- [x] 用户可打开隔离预览、前后切换五条并切换英美显示/播放；使用真实wordbook运行入口。
- [x] 缺失口音不会误用另一口音；没有真实账号写入，未重启8787服务。
- [x] 数据/索引版本正确，未变内容逐项深比较通过，插图按需加载。
- [x] 报告写明首批五条及未处理范围；旧美式v1保留，多读音和专名疑点不再安排审查。
- [x] 所有产物仍published=false。交付审核稿；未发布。

## Risks and rollback

- 记音规则只统一新批次；不能宣传全库已统一。词典音标与TTS语流不一定逐音素一致。
- 旧资源如果无法在安全位置找到，会阻止完整播放验收；记录确切缺失key，不能拿其他音频顶替。聚焦定位仍无法解决时标needs-planning并说明具体缺口。
- 源文件发生变化则停止生成，保留全部数据，记录实际与期望哈希。不得为了匹配旧计划回滚用户新改动。
- 撤回只需停止隔离预览；本轮不影响正式课程。保留新增审核产物，不自动删除任何旧资产。

## Execution notes

已按用户“继续”开始执行并完成验收范围。

- 新增规则：`docs/curriculum/wordbook-phonetic-conventions.md`。
- 新增来源清单：`docs/source-materials/wordbook-us-phrase-batch-20261026.json`。
- 新增生成器/测试：`scripts/package-wordbook-us-phrases.cjs`、`scripts/package-wordbook-us-phrases.test.cjs`。
- 新增隔离预览/浏览器测试：`scripts/preview-wordbook-us-phrases.cjs`、`scripts/wordbook-us-phrases-ui.test.cjs`。
- 产物：`output/wordbook-us-phrases-20261026-v1/candidate.json` 与 `report.json`，共136项，仅五项增加美式音标，published=false。
- 验证命令均通过：`node scripts/package-wordbook-us-phrases.test.cjs`、`node scripts/package-wordbook-us-phrases.cjs`（首次生成）、`node scripts/wordbook-us-phrases-ui.test.cjs`、`node scripts/listen-word-ui.test.cjs`。对既有回归测试的截图输出做了临时目录重定向，未覆盖原截图。
- 截图：`output/playwright/wordbook-us-phrases-20261026-v3/desktop-1.png`至`desktop-5.png`及`mobile.png`。
- 预览服务绑定127.0.0.1随机端口，当前本地会话URL为`http://127.0.0.1:2456/wordbook.html?book=textbook-wordbook%3Aprimary-jingtong-grade3-upper-20261014`；已请求在Codex面板打开。关闭承载预览服务的终端会话即停止。
- 正式课程、用户账户、学习记录及8787服务未修改或重启。工作区其他改动均保留；未提交代码。
- 残余边界：其余短语、多读音和专名未处理。候选中的英美音频是整条例句音频，音标依据是短语的词典读音；TTS语流不保证逐音素对齐。
- 后续用户批准五条短语并要求继续后，运行 `scripts/package-wordbook-approved-phrase-integration.cjs` 生成 `output/wordbook-bilingual-phrase-integration-20261026-v1/`：20本4214条，英式音标4214条，美式本批五条；核验8348条原英美句子音频文件；全包版本与资源引用审计错误0，仍未发布。旧五条审核稿和原英式候选包保留。
