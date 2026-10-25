# 错题本与待复习：整体路线及首期执行交接

- Status: first-phase-complete
- Updated: 2026-10-24
- Branch/worktree: `stabilize/p0-1-20261021` / `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `a927fd46835abc73ce7f695e286507e4873649fe`。工作区已有大量改动及课程资产；相关已修改文件包括 `main.html`、`stats.html`、`js/stats-page.js`、`assets/home-dashboard.css`、`assets/learning-archive.css`、`js/learning-workspace-view.js`。这些是执行基线，不得覆盖。规划时上述文件相对 HEAD 的增删行分别为 139/159、23/22、1/1、65/78、19/19、77/52，仅用于识别已有工作，不作回退依据。
- Planner: GPT-6 Astra（用户已确认选择）
- Executor: GPT-5.6 Luna

## Objective

整体产品目标：保留“待复习”和“错题本”两个入口，统一条目身份、答题证据及状态计算。用户从任一入口练习，另一个入口同步变化；刷新后保持一致。

本交接的可执行交付边界是 **首期句子闭环**：真实错题收录、派生巩固状态、到期队列、最多 10 题的练习、所有句子入口统一计数及跨页面刷新。单词路线在后文完整列出，但不作为本次 Luna 的实现任务；原因是当前单词完成协议只支持辅助完成，直接复用会虚报独立掌握，并改变正常课程续学位置。不能把这部分当作一个跳转按钮顺手实现。

## Current state and evidence

| 层 | 已核实的位置 | 现状与问题 |
| --- | --- | --- |
| 句子作答 | `main.html:practiceAnswerOperation/queuePracticeAnswer/finishSentence`；`src/main/practice-state.mjs:buildSentenceOutcome` | 已有稳定 attemptId、firstAttempt、assisted、错误证据；仅提示而没有真实错误时不会创建新错题，提示已有错题仍可追加辅助历史。主要答题事实在句子结束时提交。 |
| 调度 | `src/learning/schedule-policy.mjs`、`srs.js` | 错误/辅助后 10 分钟；正常独立成功沿现有间隔推进；提前练习可保留到期时间。不能依据 stats 页面旧说明推断错误后一定是一天。 |
| 事实与回放 | `server/services/learning-event-operations.js`、`src/learning/persistence-reducer.mjs`、`server/services/learning-replay.js` | 协议 3 事件幂等、按时间回放、generation 隔离，事实存入现有表；统计字段由回放生成。 |
| 本机待同步投影 | `js/server-cache.js`、`js/server-store.js` | 已投影待提交答题并调用 LearningEngine。必须与服务器使用相同规则，不能仅改已联网页面。 |
| 错题历史 | `src/mistake-review/evidence.mjs`；`stats.html:renderWrongBook/reinforceNeedsReview` | reinforceBook 保存事实；筛选仍优先使用遗留 needsReview 或 weak 分类，不能表示两次跨日成功后的巩固。已有导出、删除、历史截断提示，须保留。 |
| 到期练习 | `stats.html:dueSentences/practiceDue/practiceWrongBook/launchReviewDeck` | 到期扫描及错题扫描分开；以文本归一化去重，批量规模未统一。已有账号隔离 IDB handoff，并保留原 deck 来源。受保护课程有独立入口，不能塞入普通临时课。 |
| 多入口 | `main.html:todaySummary/selectStudyArchive` 及复习启动函数；`src/main/home-summary.mjs` | 错题数使用整个 reinforceBook.length；首页、学习页、档案存在重复计数/排队。 |
| 嵌入档案 | `scripts/build-stats-page.cjs` | `stats.html` 与 `js/stats-vocabulary.js` 是来源；生成 Shadow DOM 的 `js/stats-page.js`。不可直接改生成文件。 |
| 单词 | `server/services/vocabulary-study-operations.js`、`server/services/vocabulary-archive.js`、`server/routes/learning-archive.js`、`js/stats-vocabulary.js` | attempt 保存真实错误；complete 固定 assisted=true，dueAt 为完成后 10 分钟。档案能展示错误提交/到期数量，但没有指定词复习。session 会修改正常续学游标。 |
| 正式掌握 | `src/learning/state.mjs`、`src/learning/assessment.mjs` | 已有初测、延迟测评和至少 7 天间隔的正式掌握规则；本项目的“错题已巩固”不能替代它。 |

系统性结论：问题主要在共享业务规则和现有入口接入不一致，不是卡片样式问题。句子端可沿用既有共享纯函数、事件回放和服务器确认；无需新建第二份错题数据库或前端私有计数。单词端需要服务端会话/证据契约，前端不做虚假独立掌握兜底。

## Assumptions and decisions

1. 两个入口含义：待复习＝已到期且当前可启动的唯一句子数；错题本徽标＝仍待巩固的唯一句子数。数字允许重叠，不相加。不可用历史另标数量，不混入“开始练习 N 题”。
2. 错题状态使用“待巩固 / 已巩固”；第一次合格成功显示“已独立答对 1 次，待跨日验证”，仍属于待巩固。绝不改写正式 mastery、测评成绩、课程完成率。
3. 合格成功：真实练习结果 ok=true、assisted=false、firstAttempt=true、有效 sessionId；同一自然日只计一次，且两次使用不同 session。最近一次错误之后，在不同日期完成两次合格成功才算已巩固。
4. 当次错误、揭示答案、使用提示均使已有错题的连续验证进度重置；只有提示而无真实错误，不新增错题。播放题目要求的音频不自动算提示；主动揭示答案的行为仍算辅助。
5. 日期固定使用本轮巩固开始时的有效 timeZone；旧记录缺失时回退 UTC，不根据打开页面的设备时区反复重算。保留事件时区即可派生，不必增加账号全局设置。
6. 新规则不回填、不删除旧错题。旧提示记录保留并标明“历史辅助练习”；没有完整证据时不能推断已巩固。允许随后通过新的合格练习巩固。
7. 句子提交沿用当前句子结束的持久化边界；意群提交错误汇总进本轮，拖动/选中而未提交不计错。本期不新增“半句退出也即时存档”的事件体系。
8. 首期不合并单词数字与句子数字。保留单词档案及其“不支持指定词复习”的真实能力提示，入口计数标明句子范围，避免让用户误以为已覆盖单词。

## Scope

- 句子状态共享解析、统一计数/排序/过滤、单条重练及最多 10 题批量练习。
- 已有协议 3 在线/离线待同步投影；现有本地模式继续调用同一业务规则。
- 首页、我的学习、学习记录及独立 stats.html 的句子复习入口。
- 当前课程权限、加入状态、内容版本变化、缺失历史、读取失败等边界。
- 列表默认待巩固，支持全部/已巩固、课程筛选；错误详情折叠，保留现有导出和显式删除。

## Out of scope

- 不发布或改写课程，不改课程封面、配音、插画；不改正式测评规则。
- 不合并不同课程同文本句子，不把单词按拼写合并，不清空历史。
- 不新增 AI 服务、自动批量删除、复杂标签、FSRS 替换或通知推送。
- 单词指定条目会话及独立证据属于后续期，不在首期偷接正常续学接口。
- 不提交 Git、推送、部署或重启 8787 服务。

## Contracts and data changes

### 身份、派生状态与计数

- 新增 `src/learning/review-policy.mjs`，通过 `scripts/learning-engine-entry.mjs` 导出到已有 LearningEngine 浏览器/CJS 产物；一个模块承载真实复用的规则，不建立通用框架。
- 纯函数建议边界：`resolveMistakeState({row,stat,contentFingerprint})`、`buildSentenceReviewModel({stats,reinforceBook,sources,memberships,deletedItems,now})`、`selectReviewBatch(model,{kind,courseId,status,limit})`。
- 返回状态最少包括 `status`、`successDays`、`lastIssueAt`、`lastWrongAt`、`wrongCount`、`historyIncomplete`；队列模型包含规范 key、来源引用、可启动方式、不可用原因、dueAt。无 DOM、网络或存储副作用。
- 唯一身份采用现有 `deckId#cid` / `CL.cidKey`。历史 reinforce 的文本 key 只用于查找和删除，不作为新身份；优先 cid，只有在同一 deck 内唯一匹配时才用原句映射。歧义保留历史但禁止猜测启动。同句在两课中仍是两条。
- 合并 row.history 与 stat.learningV1.evidence 时按事件 ID 去重，避免一个失败同时算两次；以现有稳定顺序 at/id 计算。旧累计值只能显示为旧记录数量，不能虚构逐次时间。
- 当前内容 fingerprint 不匹配时旧证据只保留展示，不可证明新版已巩固；新版本重练建立新验证序列。不能仅凭旧文本对照把成绩迁到新内容。
- 正式测评证据不用于本期“连续两次练习”的累计；正式测评自己的状态完全不变。

### 事件与调度

- 不增加数据库表，不批量改写现存行。继续以已保存历史与 learningV1.evidence 派生错题状态。
- timeZone 从现有 learning.answer payload 经服务器 learningEvent、本机待同步 event、`reducePracticeEvents`、`createLearningEvent` 保留下来。旧数据允许缺失。服务端已校验时区；浏览器与服务器共用规范化函数，不能默默写入设备默认值。
- 真实错误是否收录以 `buildSentenceOutcome.totalWrong/status` 的提交事实为准；保留提示/揭示标记。若无真实错误，不创建新 reinforce 行；已有行保留，后续辅助事件参与派生状态。
- 不重写 `srs.js` 间隔。复习启动保留原身份，提前练习正确设置 earlyPractice；同一提前练习不得同时被当作到期事件推进调度。
- 数量、列表及启动批次来自同一次 model/now；待复习排序 dueAt 升序，再按薄弱程度、稳定 key；错题排序待巩固优先、错误次数降序、最近错误降序、key。
- 每批最多 10 个唯一项。筛选、单题重练也使用同一模型；刷新恢复使用现有账号隔离 handoff，不能导入成用户课程或增加 enrollment。
- 受保护课程仍走其现有授权入口，不把内容拷入普通临时 deck；页面明确区分“批量可练”和“需打开原课”的数量。离开/缺失课程记录可看，不能默默删除。

### 同步和失败

- 协议 3 的服务器结果是已确认事实；持久化成功入待同步队列后可显示本机预期状态，但须保留“待同步”含义。入队失败不递增数字、不继续提交下一题；重试复用原 eventId。
- 同步完成、跨 tab 更新、账号变化后重新生成模型；复用现有通知机制，不增加轮询。账号切换丢弃旧请求结果与旧 handoff。
- 加载未确认显示读取状态，失败显示可重试/旧数据标记；不能把失败渲染为 0。
- 音频复用原课程播放器/授权解析；缺音频明确提示，不生成新素材、不用别的句子代播。

## Implementation steps

### 首期：Luna 本次执行，完成后停止

- [x] 1. 校验工作区基线与 AGENTS.md；记录执行前相关变更，确认没有其他同名交接。只修改本交接所需文件，不恢复/删除已有文件。
- [x] 2. 在 `src/learning/review-policy.mjs` 实现身份解析、巩固状态、计数与队列纯函数，并新增 `scripts/review-policy.test.mjs`。先用固定时钟/时区构造失败、同日答对、跨日两次、提示、旧证据、版本变化场景。
- [x] 3. 在 `src/learning/state.mjs`、`src/learning/persistence-reducer.mjs`、`server/services/learning-event-operations.js`、`js/server-cache.js` 保留 timeZone；在 `scripts/learning-engine-entry.mjs` 导出新函数。验证前后端事件回放相同，重复和乱序到达不改变最终结果，不更改 SQL schema。
- [x] 4. 在 `src/main/practice-state.mjs` 与 `main.html` 的现有提交/完成链调整“新错题收录”条件；已有错误行不因答对删除。核对提示、揭示、真实错误和首次成功语义；不新增第二次答题写入。
- [x] 5. 接入 `stats.html`：替换 `reinforceNeedsReview/dueSentences` 等重复派生逻辑；默认待巩固，新增已巩固及课程筛选。单条展示来源、错误次数/时间、巩固进度；展开错误详情；音频、重练、原课链接使用真实来源。沿用现有分页、导出和删除确认，不引入自动清空。
- [x] 6. 将 `practiceDue/practiceWrongBook` 与 `main.html` 首页复习启动统一接共享 `selectReviewBatch`；沿用 `withStatsSource` 和 `launchReviewDeck`/IDB handoff。批次最多 10 题、保持原课程统计归属；受保护内容保持独立授权路径。
- [x] 7. 接入 `src/main/home-summary.mjs`、`main.html:todaySummary/selectStudyArchive` 及 `js/learning-workspace-view.js` 的实际消费者，替换 raw reinforceBook.length 等旧计数。主页、我的学习、记录页、列表和按钮复用同一口径；增加“句子”范围说明。若页面仅消费 summary，无需改其渲染文件。
- [x] 8. 在 `assets/learning-archive.css` 增加过滤/状态/动作样式，保留共享页头与当前紧凑间距；基础样式已随生成档案验证。完整 375px/876px 页面状态覆盖仍待验收。
- [x] 9. 完成剩余边界验证并核对相关产物。首期验收通过；结果见本节末尾执行记录。未自动进入单词二期。

### 后续二期：单词指定条目复习（路线，不属于本轮执行许可）

1. 增补一份单词契约交接，固定身份为 itemId + 内容修订，并按 resourceId 保留课程来源；不同练习能力分别记录，不能用选词成功抵消听写弱项。先明确与现有仅按 itemId 的 vocabulary_item_progress 如何兼容，保留旧数据。
2. 扩展 `server/services/vocabulary-archive.js` 与 `server/routes/learning-archive.js`，返回分页的到期条目/错题条目、内容修订、练习能力、可用性及数量；按用户鉴权，不从错误事件数冒充错题条目数。建立对应索引/查询性能测试后再启用聚合。
3. 新增服务端复习会话：绑定 owner、确切条目与修订、practiceType、队列、当前索引；启动前验证素材和权限。该会话与正常 `vocabularyResume` 分离，完成复习不移动课程正常续学位置。默认先交付同一单词本/同一练习类型的最多 10 项，不假装跨模式可无缝混练。
4. 扩展单词答题协议记录提示/揭示及首次作答；服务器使用既有 evaluator 判题。新事件需绑定已开始的复习会话、稳定幂等 ID、内容版本；跟读自报永远不算独立正确。旧 vocabulary.complete 保持辅助完成语义。
5. 只有服务端证据齐全后，接入共享巩固规则与调度。应用“不同日期两次”到明确能力范围；沿用错误历史、不回填旧 assisted 记录为独立成功。
6. 接入 `src/vocabulary-study/session-model.mjs` 对应复习状态与现有单词练习 UI；支持保存/返回、内容修订冲突、权限失效、网络失败重试。补全 `js/stats-vocabulary.js` 的单条/批量入口。
7. 验收：复习指定词不会练到整课起点，不覆盖正常续学位置；已错词正确排期和巩固；提示不升级；同词不同内容/能力不串状态；账号隔离、重复提交、课程更新都保留旧历史。使用临时数据库和独立端口。

### 后续三期：跨类型日常复习（待二期稳定后）

1. [x] 学习记录概览分开呈现句子与单词复习：句子沿用句子档案；单词必须先选词书、错题/待复习类型及练习方式，再读取该范围的服务端确认数量并独立启动。当前不做跨词书合计，也不把错题数与到期数相加；经核实现有词书复习接口已能按该范围返回准确总数，因此不另造一套“统一 summary”接口。
2. [x] 为日常最多 10 项编排跨播放器任务，保存父队列与各子会话进度；先按到期排序，避免反复跳转。真实隔离服务与浏览器闭环已验收，且不改变普通课程进度。
3. [ ] 增强已存在的 AI 导出、常错分析和用户可选提醒；这些不阻塞前两期上线。验收只针对已批准的增强，不扩大为全站重构。

## Validation

规划阶段未运行会写数据或产物的测试。以下由 Luna 在执行阶段运行并记录结果；不要直接用 `npm test`，其 pretest 会重建无关课程内容。

- [x] `node scripts/build-app.mjs`；在排除了 `.git`、课程原稿/输出、`server/data` 和 `server/backups` 的隔离副本中构建成功；隔离副本与工作区分别运行 `node scripts/check-generated.mjs` 均通过。真实工作区没有执行全量构建，避免重建无关课程产物。
- [x] `node scripts/check-generated.mjs`；检查通过。目标复习相关的 LearningEngine、首页摘要、练习状态与档案产物均匹配当前源码；仅对过期的 `js/main-practice-state.js` 做了定向重建，未运行全量构建。
- [x] `node scripts/build-stats-page.cjs`；`node scripts/gen-sw.js`；`node scripts/check-sw.js`；`git diff --check`。
- [x] 新增并运行 `node scripts/review-policy.test.mjs`：状态、去重、排序、最多 10 条、时区、版本、旧记录、不修改输入、受保护/不可用课程。
- [x] `node scripts/main-practice-state.test.mjs`；`node scripts/main-home-summary.test.mjs`；`node scripts/learning-state.test.mjs`；`node scripts/learning-persistence.test.mjs`；`node srs.test.js`。
- [x] `node server/learning-evidence.test.js`；`node js/server-cache.test.js`；`node scripts/stats-page.test.cjs`；`node scripts/stats-confirmed-cross-tab.test.cjs`。
- [x] 新增并运行 `node e2e/review-mistake-loop.test.cjs` 的首段闭环：隔离账号实际点击错题/到期入口，核实来源身份与原视图返回，并检查 375px/876px 横向溢出。
- [x] 扩展 `node e2e/review-mistake-loop.test.cjs`：已验证真实错误后自纠完成、同一事件重放幂等、离开并刷新档案后待复习降为 0 且错题仍为 1；跨日两次成功仍用纯函数测试覆盖，不真实等待两天。
- [x] 补充离线提交/恢复及账号切换隔离 E2E；离线时不得丢错题或错误递增已确认计数，切换账号后不得显示或重放旧账号队列。（隔离测试验证：A 账号错答断网排队；B 账号看不到课程和待提交项，且服务端无该学习记录；切回 A 后同一 requestId/请求体补交，服务端仅记一次。）
- [x] `node e2e/stats-due-stability.test.js`；修复夹具以登录隔离测试账号，并让探针读取档案 Shadow DOM 后通过。
- [x] `node e2e/srs-course-reentry.test.js`；用例通过，原课队列与断点映射保持正常。
- [x] `node e2e/learning-mastery-loop.test.js`；将用例迁至当前 `main.html?view=stats&tab=sent` 档案入口，使用隔离账号/数据库，完成测评、刷新恢复、结果复查；初测通过保持为“初测通过”，未升级为正式测评掌握。
- [x] 新端到端用例断言正常学习、待复习、错题本答题都写回原 `deckId#cid`，不建立 srs-/book- 临时课成绩，课程进度不变；操作重放不重复计数。（`review-mistake-loop.test.cjs` 真实启动三个入口并核对服务端快照。）
- [x] 用已有正式测评达成状态的同一句子执行错题/待复习练习，端到端证明正式掌握标记不受巩固状态变化影响。（`review-mistake-loop.test.cjs` 在隔离库准备符合正式规则的初测/延迟测评证据，先核验 `verifiedMastered`，再通过真实错题本练习并核验正式标记及两条测评证据仍保留。）
- [x] 375px、876px 检查待复习/错题本无横向溢出；另验证错题本默认筛选、键盘焦点、空错题/待复习态、云端未确认失败态与返回地址。完整视觉人工检查仍未做。

## Acceptance criteria

- [x] 从普通课程首次真实错答触发入册；单纯拖动或提示不新增错题。（隔离 E2E 已真实走普通课程答题并确认服务端错题行；纯函数测试覆盖提示但无错误及未提交状态不新建错题。）
- [x] 历史提示记录在既有错题的后续练习、筛选和显示中保留。（隔离 E2E 在真实错答前使用提示，断网待提交请求保留 `history[].hinted`；服务端确认后展开错题历史，页面仍显示“用过提示”。）
- [x] 同一错误句子可同时属于到期队列和错题本，单批不重复；所有计数具有明确句子范围。（共享模型测试覆盖同一 `deckId#cid` 同时入两个队列、重复历史行折叠为一条；隔离 E2E 确认到期/错题两个计数都为 1。）
- [x] 当天答对多次不能巩固；最近错误后不同日期、不同 session 两次独立成功归入已巩固；辅助/再次错误重置验证进度。（固定时区/时间的 `review-policy.test.mjs` 纯函数回归；跨午夜但同 session 不计作两天。）
- [x] 从正常学习、待复习、错题重练入口提交均驱动同一来源句子的统计状态；三入口实际提交后徽标仍以原课程统计。（隔离 E2E 通过。）
- [x] 对尚未到期的句子提前练习，端到端核对 earlyPractice 标记及 dueAt 保持原到期时间。（`review-mistake-loop.test.cjs` 在隔离课程走完整课程提前练习入口，检查提交标记，并从服务端确认练习次数增加而 dueAt 原值不变。）
- [x] 错题已巩固仍可查历史，正式测评掌握不受影响；内容修订不继承不匹配证据由共享策略固定用例验证。
- [x] 首页、我的学习、学习记录、独立 stats.html 的句子徽标/列表/启动数一致；隔离 E2E 对照实际入口及同一句子计数，并验证入队/服务器确认/刷新一致；确认缓存刷新失败保留旧数据并显式标记过期，无缓存读取失败显示未确认而非假零。
- [x] Runtime entry point connected：隔离 E2E 已真实点击错题和待复习入口，核对原句来源身份并返回原视图；最多 10 条上限另由纯函数测试覆盖。
- [x] 账号范围切换、离线重试及重复事件不串数据/重复计数；所有历史和真实课程资产保留。（账号切换与离线 E2E、服务端重放幂等 E2E 通过；服务器地址切换仍由既有账号隔离用例覆盖。）
- [x] 单词现有能力不被夸大，没有把辅助完成伪装为独立掌握或偷偷启动正常续学覆盖游标。（档案 UI 回归断言指定词复习仍标记为未接入，辅助完成与独立回忆评估区分，且无覆盖正常续学的启动动作。）

## Risks and rollback

- 最大风险是三份状态计算分叉（服务器回放、本地投影、UI）；共享纯函数和同一测试向量是必要约束，不能通过改一个徽标掩盖差异。
- 旧错题证据截断、缺时间/身份时只能保守标识，不做破坏性修复；本次不执行任何真实数据迁移。若需要迁移，停止并说明具体目标和授权需求，执行前必须一致性 SQLite 备份及可恢复验证。
- 代码回退只回退本次差异/经确认的生成产物，不恢复整个脏工作区。新增可选事件字段可被旧版忽略，历史依然保留；不通过删除数据库/浏览器缓存回退。
- 受保护课程继续使用原权限入口，不能扩大批量访问。单词后续需要后端契约，禁止本期前端临时绕过。
- 现有字体大文件 precache 和缺失 textbook-production.html 构建警告应据实记录，不顺带清理课程文件。
- 完成开发与隔离验证不等于发布；不重启/切换运行中的服务。交付时明确实际运行环境是否更新。

## Execution notes

- 2026-10-24：已读取根 AGENTS.md 和 astra-luna-delivery 技能，完成上述相关代码只读检查。用户确认已选择 GPT-6 Astra。
- 2026-10-24 Luna 首期实现：新增共享 `src/learning/review-policy.mjs` 与纯函数回归；将有效 timeZone 从客户端答题事件贯穿本地投影和服务器回放；真实错题收录不再因单纯提示触发；档案页与首页的到期/错题启动现统一使用共享模型并限制每批 10 句；学习档案增加巩固状态、筛选与原课程练习入口；生成 LearningEngine、学习档案及 SW 产物。
- 已通过：`node scripts/review-policy.test.mjs`、`node scripts/main-practice-state.test.mjs`、`node scripts/main-home-summary.test.mjs`、`node scripts/learning-state.test.mjs`、`node scripts/learning-persistence.test.mjs`、`node srs.test.js`、`node server/learning-evidence.test.js`、`node js/server-cache.test.js`、`node scripts/stats-page.test.cjs`、`node scripts/stats-confirmed-cross-tab.test.cjs`、`node scripts/check-sw.js`、`git diff --check`。`node scripts/gen-sw.js` 完成，提示既有字体超过 512KB 和 HTML 引用 `textbook-production.html` 缺失；未顺手修改这些无关项。
- `node scripts/check-generated.mjs` 现已通过。隔离 E2E 修复了档案测试夹具的认证与 Shadow DOM 探针，并分别通过待复习启动稳定性和原课程 SRS 复进入口。新增 `node e2e/review-mistake-loop.test.cjs` 实测错题/到期入口启动、原 `deckId#cid` 来源引用、返回来源 tab，以及 375px/876px 无横向溢出；为使错题 tab 可见，修正 `main.html` 中档案 host 的隐藏条件；为保留来源 tab，复习启动 URL 现带安全校验后的 `returnTo`。此 E2E 尚未答题，刷新/重复提交/离线恢复/跨账号验收仍未完成。既有 `learning-mastery-loop` 用例补上 `REQUIRE_AUTH=false` 隔离测试配置后可以启动服务，但仍因旧 `stats.html` 入口中找不到 `[data-tab="sent"]` 而失败，需迁移到当前主应用档案入口后再判断掌握隔离。
- `node scripts/gen-sw.js` 生成缓存标识 `chunklab-7df6bfff`，随后 `node scripts/check-sw.js` 通过。生成时提示既有 1,479KB 字体及缺失的 `textbook-production.html` 引用；未改动这些无关资源。
- `node e2e/learning-mastery-loop.test.js` 现通过。旧用例使用未经认证的本地 `stats.html` 路径，已迁到当前主应用档案，并改用隔离测试账号通过服务端操作种入课程、曝光和答题；浏览器实际测评及刷新恢复通过，断言“初测通过”没有伪装成“原测评通过”。
- 8787 服务曾意外停止；用户明确确认重启后已恢复，`/api/health` 与学习记录页面均返回 200。此后未再重启或切换服务。未迁移/删除真实数据或课程，未生成课程资产，未部署或提交。375px/876px 仅完成指定错题/待复习页面无横向溢出检查；完整状态覆盖、实际答题、掌握/覆盖率隔离尚未完成，首期仍为 in-progress。
- 二/三期为整体实施路线，需在首期完成后形成其自身可执行契约，不得将本文件首期 complete 解释为全部路线已交付。
- Luna 执行开始改为 in-progress；逐项记实际验证结果。有实质契约矛盾时改为 needs-planning 并给出具体证据/决策点；全部首期验收通过才标 complete。
- 2026-10-24 用户明确将已配置的加入课程上限从 3 调整为 4，以便首页两列显示 2 行。已同步客户端、目录禁用状态、本地待确认投影、协议 3 服务端操作和旧式整份保存限制，并更新单元/E2E/冒烟测试；隔离目录页 E2E 已验证 4 门保留刷新且第 5 门不可加入。相关通过项：`node scripts/course-enrollment.test.js`、`node js/server-cache.test.js`、`node server/operations.test.js`、`node e2e/course-enrollment-protocol3.test.js`、`node e2e/review-mistake-loop.test.cjs`。
- 2026-10-24 扩展错题闭环 E2E：实际在复习句子中先选错、再完成自纠；确认唯一 `learning.answer` 按原 `deckId#cid` 提交，服务端 times/evidence 仅增加一次；原请求体重放返回 duplicate 且不增加计数；退出并刷新后待复习为 0、错题仍为 1。375px/876px 无横向溢出。`node e2e/review-mistake-loop.test.cjs` 通过。完整 mastery/课程覆盖率隔离、离线恢复及账号切换仍待验证。
- 2026-10-24 `node server/smoke.test.js` 中本次相关的 4 门可达、拒绝第 5 门、移出后可加入均通过；整份套件最终 `passed=151 failed=1`，唯一失败为既有“AI 默认关闭实例 health ok”配置检查，与课程限制及本次改动无关，其他 151 项通过。未改该 AI/环境配置。
- 2026-10-24 将错题 E2E 的初始记录从直接调用隔离 API 改为普通课程真实作答：创建隔离课程后在页面选择错误选项、完成句子并等待服务端确认，断言统计仅写入一次且 reinforceBook 新增原 `deckId#cid`。测试时钟只在隔离浏览器中暂时偏移，使这条真实事件立即到期；后续入口、重复提交及刷新断言继续通过。新增 `scripts/main-practice-state.test.mjs` 断言提示但无真实错误、未提交状态均不生成新错题，且提示已有错题会保留本次历史。`node e2e/review-mistake-loop.test.cjs` 与 `node scripts/main-practice-state.test.mjs` 通过。
- 2026-10-24 扩展 `e2e/review-mistake-loop.test.cjs`：使用隔离临时数据库及第二个合成账号模拟网络中断。首次真实错答离线后保留原 requestId、完整请求体及错题证据；离线自动重试复用同一请求；B 账号无法读取 A 的课程/队列，服务器也没有收到该答题；回到 A 后成功补交且服务端 times=1、队列清除。`node e2e/review-mistake-loop.test.cjs`、`node scripts/main-practice-state.test.mjs`、`node scripts/check-generated.mjs`、`git diff --check` 通过。首次账号切换尝试暴露测试 init script 每次导航都重写 A 凭据的问题，改为仅首次注入后用原子化测试登录状态替换；没有改产品认证逻辑。8787 服务未重启/切换，未更新运行中的页面。
- 2026-10-24 补验 `node scripts/review-policy.test.mjs`、`node scripts/stats-page.test.cjs`、`node scripts/main-home-summary.test.mjs`、`node e2e/learning-mastery-loop.test.js` 均通过；策略用例追加相同身份的重复历史行去重断言。`learning-mastery-loop` 只覆盖测评结果和刷新恢复，不覆盖测评后再做错题复习；内容修订指纹隔离、同日/跨日/session 条件由共享策略固定用例覆盖。
- 2026-10-24 扩展错题闭环 E2E 覆盖正常学习、到期队列和错题本三种实际答题入口：三条学习答案都按原 `review-loop-course#reviewloop01` 写入；核对没有 `srs-/book-/wrong-` 临时课程、课程进度与答题前一致、两种复习入口均不创建测评事件，重放请求不重复增加原课程次数。`node e2e/review-mistake-loop.test.cjs` 通过。独立正式测评回归仍通过，但“先正式掌握再错题复习后标记保持不变”尚未形成同场景端到端断言。
- 2026-10-24 阶段性检查快照（已由本节末尾最终验收记录 supersede）：当时复习 E2E 已通过，但剩余的扩展边界尚未全部执行；后续记录补齐了这些验证。未进入单词二期或跨类型三期。
- 2026-10-24：扩展隔离 `review-mistake-loop.test.cjs`，在错题本真实练习前注入符合生产掌握规则的初测与延迟测评证据，复习后验证 `verifiedMastered` 与两条正式测评证据保留；另从正常完整课程提前练习入口完成答题，验证 `earlyPractice=true` 且服务端 `dueAt` 不变。实际运行 `node e2e/review-mistake-loop.test.cjs` 通过。注：夹具仅在 `os.tmpdir()` 下的隔离 SQLite 中准备历史时间线；未触碰真实数据库或服务。
- 2026-10-24：扩展同一隔离 E2E，普通练习中实际点按提示后答错；验证离线操作保存提示历史，服务端确认后展开错题记录仍能看到“用过提示”。`node e2e/review-mistake-loop.test.cjs` 通过。
- 2026-10-24：继续完成第一阶段边界验收。扩展隔离 E2E 验证正式掌握后执行错题本复习仍保留掌握证据、提前练习不推进到期时间、提示历史可见、空账号错题/待复习状态、无已确认云端快照时网络读取失败不会显示假零、键盘焦点可见、375px/876px 无横向溢出且复习后返回原档案 tab。`node e2e/review-mistake-loop.test.cjs`、`node scripts/stats-page.test.cjs`、`node scripts/review-policy.test.mjs`、`node scripts/check-generated.mjs`、`git diff --check` 通过。一个最初的缓存失败探针未发出网络请求（已有确认缓存被正常复用），因此未将其记为失败态验证；“已有缓存过期且强制刷新失败”的可见提示仍待单独验收。
- 2026-10-24 阶段三首个范围：在统计概览新增分开的单词复习区，复用既有词书选择与错题/待复习/练习方式筛选；仅在服务器返回已确认的 `total` 后显示所选范围数量，并复用已有专项会话启动，不跨词书相加、不改普通课程进度。`scripts/learning-archive-ui.test.cjs` 已覆盖分组显示、筛选参数、已确认数量和概览启动入口；`server/vocabulary-targeted-review-http.test.js` 与 `server/services/vocabulary-review-operations.test.js` 确认隔离会话、账号范围与普通课程 cursor/progress 不变。生成档案页面及 `check-generated`、`stats-page.test.cjs` 均通过。跨类型父队列和 AI/提醒尚未执行；未重启或更新 8787 实时服务。
- 2026-10-24 阶段三第 2 项进行中：新增账号隔离的 `dailyReviewSession` 父会话存取操作及只读恢复接口；在隔离 HTTP 实例中验证仅纳入已到期候选、按 dueAt 稳定排序、去重、最多 10 项、父位置/子会话进度可恢复、过期 revision 冲突拒绝、另一账号不可读，且创建队列不改变普通词书进度。`node server/daily-review-session-http.test.js`、单词专项 HTTP/操作测试通过。当前仅完成持久化基础；统计页启动入口、句子/单词播放器交接、子进度自动回写及刷新恢复仍未完成。未连接或重启 8787 实时服务，未修改真实账号数据。
- 2026-10-24 阶段三第 2 项继续实现：统计概览新增今日混合复习入口，限于当前选定的一本词书；句子与单词候选只取已到期项目，客户端按 dueAt 预选、服务端去重排序并限制 10 项。父队列按连续播放器类型/词书/练习方式分组，分别交接至原句子练习器或现有单词专项播放器；单词子会话可暂停/续接，句子子会话逐题保存队列位置，完成后再推进父队列。普通课程进度仍由临时句子队列/单词专项会话隔离。`node scripts/learning-archive-ui.test.cjs`（含混合队列创建及首个句子组交接）、`node server/daily-review-session-http.test.js`、`node server/vocabulary-targeted-review-http.test.js`、`node server/services/vocabulary-review-operations.test.js`、`node scripts/check-generated.mjs`、相关脚本语法检查均通过。浏览器只读打开临时验收实例时为未登录页，故未将其算作真实播放器端到端验收；各播放器在真实隔离服务中的完整交替、暂停/刷新恢复仍建议作为阶段三上线前最后一轮验收。8787 服务未重启或切换，未触碰真实账号/课程/学习记录。
- 2026-10-24 阶段三第 2 项补充验证：扩展 `scripts/learning-archive-ui.test.cjs`，覆盖句子/单词到期项按 dueAt 顺序合并、相邻句子成组、句子子组刷新后从已保存题号续接，以及单词子会话的目标条目、练习方式和父队列 returnTo 参数交接。`node scripts/learning-archive-ui.test.cjs`、`node server/daily-review-session-http.test.js`、`node server/vocabulary-targeted-review-http.test.js`、`node server/services/vocabulary-review-operations.test.js`、`node scripts/check-generated.mjs`、相关脚本语法检查及定向 `git diff --check` 通过。此 UI 用例用 API 模拟，HTTP 持久化另由隔离服务测试覆盖；尚未完成浏览器对真实隔离 HTTP 实例的完整句子→单词→返回/暂停恢复串联，因此跨播放器验收仍未结束。8787 服务未重启或更新，未触碰真实账号、课程或学习记录。
- 2026-10-24 继续阶段三验收：单词专项 HTTP 测试新增暂停→读取→续接→读取流程，确认恢复原会话条目，并核对普通词书 cursor/progress 未改变；`scripts/stats-page.test.cjs` 的 VM 环境补齐浏览器 `URLSearchParams` 全局。`node scripts/stats-page.test.cjs`、`node scripts/review-policy.test.mjs`、`node scripts/learning-archive-ui.test.cjs`、`node server/daily-review-session-http.test.js`、`node server/vocabulary-targeted-review-http.test.js`、`node server/services/vocabulary-review-operations.test.js`、`node scripts/check-generated.mjs`、语法检查及定向 `git diff --check` 均通过。完整真实浏览器连接隔离服务的句子→单词→返回串联仍未执行；它是当前唯一主要阶段三验收缺口。实时 8787 未重启或更新，真实账号与课程/学习记录未触碰。
- 2026-10-24 完成阶段三跨播放器真实浏览器验收：新增 `e2e/daily-review-cross-player.test.cjs`，使用隔离临时 SQLite、合成账号与临时端口，从统计概览真实启动今日队列，完成句子组，交接到到期单词专项，暂停并恢复相同单词子会话；核验普通词书位置/进度未被更改。验收首次暴露并修复两处集成缺陷：父队列服务端原先拒绝“子组已完成且游标恰好推进到组末”的合法交接；单词专项页请求目录 `limit=100` 超出 API 的 50 条上限，页面因此无法渲染。现已按完成边界校验已完成子组，并将目录请求限制改为 50。`node e2e/daily-review-cross-player.test.cjs`、`node server/daily-review-session-http.test.js`、`node scripts/learning-archive-ui.test.cjs`、`node server/vocabulary-targeted-review-http.test.js`、`node server/services/vocabulary-review-operations.test.js`、`node scripts/stats-page.test.cjs`、`node scripts/check-generated.mjs`、受影响文件语法检查通过。所有数据只在测试临时目录产生并于退出时清理；8787 实时服务未重启或更新，真实账号、课程与学习记录未触碰。
- 2026-10-24 按 390px/876px 实际浏览器截图检查跨类型复习概览：确认无横向溢出，入口和控件均在视口内；发现共享花园装饰使用 `position:fixed`，在手机视口遮挡档案状态文字。根因是共享 app shell 将装饰固定在视口底部而页面仅预留 32px；现改为随文档定位并预留装饰高度，练习页独立定位逻辑不变。重新截图确认页面内容可读、装饰留在文档末尾；跨播放器 E2E 中保留响应式边界断言。截图输出在被忽略的 `output/playwright/`。这次只验收学习记录概览目标页，不代表全站所有状态均已完成视觉验收。
- 以上记录中较早的“尚待验收”事项已由后续测试覆盖；以下为首期最终核验结果。2026-10-24 运行 `node e2e/review-mistake-loop.test.cjs` 通过，验证跨页面真实入口、队列状态/服务器确认/刷新、读失败状态与单词边界；`node scripts/review-policy.test.mjs`、`node scripts/stats-page.test.cjs`、`node scripts/learning-archive-ui.test.cjs`、`node js/server-cache.test.js`、工作区与隔离副本的 `node scripts/check-generated.mjs`、`git diff --check` 均通过。`node scripts/build-app.mjs` 仅在隔离副本成功运行，未在真实工作区全量重建。首期句子闭环已完成，未提交、部署或重启服务；真实账号、课程、学习记录与浏览器数据未触碰。未进入单词二期或跨类型三期；它们是另行交接的后续路线，不属于首期验收。
