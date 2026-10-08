# 学习状态、熟悉与考试掌握闭环 V1

- Status: in-progress
- Updated: 2026-09-29
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22
- Relevant uncommitted changes: core.js、main.html、stats.html、srs.js、src/core/*、src/main/*、服务端存储与课程创作均有在先修改；上轮 chunk 多样性及 SRS 重进修复也未提交。只增量编辑，不整文件回退。
- Planner: Astra 规划阶段（不另行声称验证了模型选择器）
- Executor: GPT-5.6 Luna

## Objective

交付句子练习的一个完整闭环：学习／自评熟悉 → 到期复习 → 独立输入测评 → 延迟复测 → 已掌握 → 遗忘后巩固和再验证。所有页面共享判定，考试证据可持久化、刷新恢复和同步。掌握仅表示本句的独立文字回忆能力，不代表口语、听力或所有场景迁移能力。

## Current state and evidence

- core.js:isMastered 读取 mem.mastered（实际为手动标熟）；isFluencyByDeck 以 okTimes≥3 且 streak≥3 判定；classifyStat 又以 times≥3、准确率≥80% 判定 master。src/main/practice-classification.mjs 复制这两套标准。
- main.html:updateMasterBtn/标熟逻辑将普通练习计数称为考试通过，撤销时可能重置统计；finishSentence 的标熟分支甚至在答错后显示已掌握。当前检查范围内未发现独立考试会话和考试证据合同。
- core.js:masteredSentenceKeys 将手动标熟和统计推定掌握并集计数；stats.html 复用该口径，无法区分自评和测评。
- main.html:recordSentenceResult 写 kind=answer 事件，但缺少 mode、hint/reveal、考试来源与题目版本。不能拿历史连续正确记录补造考试证明。
- srs.js 固定间隔为 1/3/7/14/30/60/120/180/365 天；ease 被保存却不参与间隔计算。这是简化排期，不能称为个体化最优记忆曲线。
- 上轮 startDeck 已过滤未来 dueAt，并以 reviewSourceIndices 保存课程断点；本轮必须保留这项行为。
- src/core/stats-signature.mjs 只签名现有数值字段；新增证据若不接入签名会漏传。core.js:mergeStats 重建统计且选择 latest 行；src/core/merge.mjs 的 bySentence 按整行合并，均需保护新证据。
- server/services/data-rows.js 将 stats 和 events 保存为 JSON 行，现有事件按 id 去重；js/idb.js 已支持学习统计和事件的事务写入及同步意图。复用这些通道，不增加独立云端考试系统。
- 当前未找到仓库及已检查父级 AGENTS.md。执行前再次确认。PRODUCT.md 定义产品为中文用户的句型／意群学习工具。

## Assumptions and decisions

### 设计依据与适用边界

成熟做法是分别记录自我评价、实际提取表现和下次复习时间。间隔提取和反馈有研究支持，但不存在适用于所有人的固定最优天数或统一掌握分数。

- Anki 官方调度文档：https://docs.ankiweb.net/deck-options 。FSRS 用目标保持率平衡记忆与负担；这不等于考试分数或掌握门槛。
- 提取与间隔学习：https://www.retrievalpractice.org/spacing 、https://www.retrievalpractice.org/feedback 。用于支持间隔检验、及时反馈原则。
- 掌握学习综述：https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/mastery-learning 。支持明确目标、测评、补救再测的组织方式；证据强度有限且多为学校场景，不能直接证明本产品阈值。
- 下文 24 小时、7 天、80% 均为 V1 可调整产品策略，不宣称研究证明它们最优。首版保留现有长期 SRS 序列，先纠正证据质量；FSRS 后续另评估，避免同时迁移算法和学习状态。

### 状态模型：三个独立维度

| 维度 | 值与含义 | 来源 |
| --- | --- | --- |
| 自评 | 未标记／我已熟悉 | 用户主动设置，可撤销 |
| 验证 | 未验证／初测通过／已掌握／待再验证 | 独立考试及后续遗忘证据 |
| 排期 | 未学习／学习中／复习中／重新巩固，加 dueAt | 学习结果与调度 |

熟悉不是掌握的必经阶段；不点熟悉也可参加考试。到期只是时间条件，不自动取消掌握。单句主标签优先：需巩固 > 已掌握 > 初测通过 > 已熟悉 > 学习中 > 未学习；详情另显示自评、测评记录和下次时间。

### 明确流转规则

1. 新句：正常学习入口可出题。独立答对后按 SRS 排期；未到期退出重进不再次推荐。
2. 标记熟悉：仅设置自评，不增加答题数、连对或考试成绩。不永久排除。没有排期时安排 3 天后复习；已有排期（特别是到期和答错后的短期排期）保持。反复取消重标不顺延已有日期。撤销熟悉不重置任何练习／考试记录。
3. 普通练习：记录首答、错误次数、提示、揭示答案、模式。正确且无提示／揭示才推进长期 SRS；答错或借助答案完成进入重新巩固，10 分钟后到期，之后独立答对排 1 天。输入纠错完成不变成首答正确。
4. 显式提前重练：允许完整练习；未到期时答对不推进 SRS 阶段、不增加考试证据。答错可以缩短排期并进入巩固。一次会话内不给同句自动追加无限重试；到期后再次进入即可练，用户也可主动重练。
5. 自评熟悉但答错：保留用户标记，主状态显示需巩固，绝不继续显示绿色已掌握。原已掌握句独立首答错误或揭示答案后进入待再验证；保留原考试日期，完成巩固后按下述延迟复测恢复。
6. 初测独立通过后显示初测通过；至少 7×24 小时后独立复测通过才显示已掌握。中间答错使验证失效，需要再次初测和延迟复测。普通练习正确不能直接升级／恢复掌握。
7. 已掌握仍参加到期复习；无失败证据不因逾期自动降级。到期答对沿 SRS 继续延长，遗忘按第 3、5 条处理。

### 考试合同

- 首版界面名为“掌握测评”，定位个人学习自测，不作为防作弊证书或外部资格认证。
- 入口：课程结算页和学习档案增加“掌握测评”；选当前课或已加入课程的符合条件句子。默认 10 句，不足照实际数量显示，不放大为全课掌握。
- 初测资格：已学习或已标熟，且距最近一次该句学习／答案暴露至少 24 小时。历史只有 lastAt 的句子用其保守初始化；只有熟悉标记的用 markedAt；均无可信时间则首次观察记录当前时间，24 小时后可测，不伪造历史通过。
- 复测资格：初测通过满 7 天，同时距最近练习／答案暴露至少 24 小时。二者取较晚时间；普通到期复习同句时，优先提示可复测，避免刚展示答案后立即考试。用户仍可选择普通复习。
- 固定为逐意群输入模式，保留中文场景与目标意群中文提示，隐藏英文候选、英文原句、详解、提示、英文朗读和所有相关快捷键；一格一次正式提交，不显示逐格正误，整轮交卷后统一反馈。用户可“不会／跳过”；跳过计失败。
- 沿用现有 norm/judgeChunk 和显式 alts，不增加模糊判对。一个句子每个 chunk 首答全对才算该句通过。测的是限定目标表达；合法同义表达未收录可反馈并在之后重测，不能直接手动标掌握。
- 内容缺英文答案、中文提示或稳定 cid 不进入考试，显示原因和实际可测数；课程未完整加载时不把加载失败当成没有可测题。图文故事原生 courses.html 流程本期只保持不误报掌握，测评首期覆盖 main.html 句子练习入口支持的课程。
- 整轮完成率 100% 且句子通过率≥80%显示本次达标；只更新逐句实际通过结果，整轮达标不替失败句授予掌握。1/1 通过也只证明这一句。
- 初测、复测、已掌握维护测评统一使用同一题目级证据。测评失败进入巩固；复测通过但有更晚失败证据仍显示待再验证。同句同一 session 只能生成一条结果。
- 保存题目顺序、题目内容指纹、规则版本、进度与提交状态。刷新续考，已经提交的输入锁定。中途退出保存未完成会话，不颁发通过；交卷后按实际已答题记结果，未答题记跳过失败。可放弃未完成会话而不算失败，但不产生通过资格。
- 考试过程中课程内容更改：该句作废不计通过、不计答错，解释内容已更新；重新生成测评。图片／封面变更不失效；英文标准答案、alts 或中文题意变化才失效。已掌握记录保留历史，当前新版本需再验证。

### 页面与统计

- 练习按钮统一“熟悉／已熟悉”，title 不再写掌握；取消自动标熟倒计时。练习表现可提示“可参加测评”，不能自动替用户自评。
- 首页保留现有紧凑布局，将“已熟练”卡片改为“已掌握”，仅计有效测评掌握；熟悉数放学习档案，提供一次性口径变更说明，解释旧成绩没有丢失。
- 档案可筛选已熟悉、待测评、已掌握、需巩固；这些是可重叠维度，不能把筛选计数相加称总数。详情显示掌握依据和失效原因。
- 课程“已学 N/总数”是内容覆盖，掌握是另一指标。本轮练习进度分母为入场冻结题数，标熟显示已跳过，不删除导致分母跳动；下次入场重新按到期过滤。保留原始 source index 映射。
- 设置中去除“跳过已掌握”的永久跳过含义：正常推荐统一按到期；主动重练可查看全部。旧 skipMastered 设置兼容读取，但不能使无 dueAt 的熟悉句永久消失。

## Scope

一个可用 V1：统一派生状态、熟悉操作、复习队列和提示、可恢复的文字测评、延迟复测、历史数据兼容、档案统计、持久化同步与端到端验收。分步实现但不以“只有模块没有入口”交付。

## Out of scope

FSRS 引入、付费 AI 判分、语音考试、通用英语水平认证、跨课程词汇知识图谱、全库同义答案重写、全站视觉重做、外部证书及强防作弊。词／chunk 的错误仍用于讲解和错题证据，本期不由一句掌握推导出该词在所有语境掌握。

## Contracts and data changes

1. 新建 src/learning/state.mjs、assessment.mjs、schedule-policy.mjs：纯函数导出 resolveLearningState、applyLearningEvent、mergeLearningEvidence、getAssessmentEligibility、createAssessmentSession、submitAssessmentAnswer、finalizeAssessment、scheduleLearningResult。时间、id 生成器注入；只返回新数据，DOM 和落盘在适配层。
2. identity 始终采用 CL.cidKey(sourceDeckId,item)；临时复习队列回写原课程。题目指纹由规范化中文题意、chunks、alts 计算，稳定排序并版本化，不含封面。沿用现有原始 key 迁移，新增 evidence.key 和会话题目 key 也须迁移。
3. mem.mastered 暂保留旧字段名，语义明确为 familiarity；旧 auto:true 标记显示“历史熟悉标记”，不授予掌握。对外新 API 为 isFamiliar/isVerifiedMastered；CL.isMastered 仅作为有注释的遗留自评别名，业务消费者不得继续使用它推定考试掌握。
4. stats.bySentence[key].learningV1 = {version:1, baselineAt, lastExposureAt, phase, evidence:[], assessmentVersion:1}。evidence 为小型不可变事件记录：{id,key,sessionId,at,type,mode,contentFingerprint,policyVersion,ok,assisted,firstAttempt,eligibleAt}；type 为 practice/assessment/familiaritySchedule，assessment 另含 stage=initial/delayed/maintenance。不含整份课程。熟悉布尔仍以现有实体及墓碑为准，evidence 不复活取消的标记。
5. evidence 同时写入现有 stats.events（kind=learning，避免重复计入 kind=answer）；练习 answer 事件继续用于既有次数统计，附加共享 attemptId 关联。测评每句只计一次 answer；不得在逐 chunk 和交卷同时计数。会话事件 kind=assessmentSession，带 session 快照，使用 revision 对应的新不可变 id。
6. 当前活动会话先保存在按账号＋sessionId 隔离的 IndexedDB syncMeta 条目，并将版本化会话事件走现有 events 同步；另设备按最高 revision、再按稳定 id 选择快照，同一题冲突保留首个正式提交且显示会话冲突需重开，不拼出虚假全对卷。退出账号、切换账号绝不恢复别人的会话。
7. 合并逐句 evidence 按 id 并集，按 at/id 稳定排序重算验证状态。失败优先于同时间通过；初测与复测必须 sessionId 不同并满足间隔，不能信任 UI 传入的 mastered 布尔。内容版本不符的证明仅历史显示。本期不裁剪证据，未来压缩须独立定义快照水位。
8. 更新 core.js:mergeStats 和 src/core/merge.mjs 的 bySentence，以及 src/core/sync-batch-merge.mjs 的消费路径：练习计数继续旧规则，新 learningV1 单独合并，不能被 lastAt 较大的旧行覆盖。服务端 data-rows.js 的 upsertSentenceStat 同样合并已有与新 learningV1，旧客户端未带字段时保留证据。新增字段纳入 stats-signature.mjs 及 core.js 后备签名。无证据的旧客户端最多改变旧统计，不能授予／删除测评掌握。
9. 旧数据懒迁移：times/streak/dueAt、历史答案和自评原样保留；旧 master 推断降为“学习中／待验证”，不删除累计成绩。旧熟悉且无 dueAt 的排期按 markedAt+3 天（缺可信时间则当前+3 天），到期历史标记立即可复习；存储迁移幂等，不每次打开重新顺延。
10. SRS 学习短步 10 分钟须独立于长期 normalize(interval≥1) 处理，可用 learningV1.phase=relearning 与 dueAt；不把小数 interval 硬塞旧 normalize。成功／失败事件只调度一次。考试提前通过不人为拉长尚未到期的长期排期；到期通过调用一次现有 SRS。复测到期资格与复习 dueAt 独立。
11. 服务端写入失败保留本地待同步和已提交输入；存储不可用时显示“成绩尚未保存”，不能宣称已保存／已授予持久掌握。重复交卷与网络重试使用相同事件 id。优先复用 js/idb.js 现有学习事务和 pending intent 通道。

## Implementation steps

- [ ] 新建纯状态／测评／排期模块及 scripts/learning-state.test.mjs、learning-assessment.test.mjs；固化上文边界和时间规则。
- [ ] scripts/build-app.mjs、check-generated.mjs 增加 browser/CJS 产物，main.html/stats.html/core.js 加载共享规则；不手工编辑生成文件。服务端复用同一证据合并实现。
- [ ] core.js、src/core/stats-signature.mjs、merge.mjs、同步路径和 server/services/data-rows.js 接入证据合并与签名；完成幂等迁移、备份导出／导入和账号隔离验证。
- [ ] main.html 的标熟、updateMasterBtn、finishSentence、recordSentenceResult、startDeck、补题和结算分支接新状态；普通输入／选择／提示／朗读暴露都记录真实结果。替换 src/main/practice-classification.mjs 判定并更新所有 CL.classifyStat/isFluencyByDeck/masteredSentenceCount 消费者与后备逻辑。
- [ ] main.html 接入独立 assessment session 模式和输入界面，使用现有输入判分；入口从课程结算及 stats.html 可达，快捷键在测评模式不能泄露答案。恢复、放弃、交卷、结果页及下一步均可操作。
- [ ] main.html/stats.html/decks.html 统一数量和文案；courses.html 不把普通故事完成当考试掌握，未接入测评的内容明确显示支持范围。固定会话分母并保留课程覆盖分母。
- [ ] 增加 server/learning-evidence.test.js 和 e2e/learning-mastery-loop.test.js，覆盖实际存储、两账号、两端合并、刷新续考、复习重进；维护被语义变更影响的旧测试。
- [ ] 生成构建产物与 sw.js，完成下列检查；记录真实结果再标 complete。不提交、推送或部署。

## Validation

以下是执行阶段验收命令，本次规划没有声称这些新功能已经通过测试。

- [ ] node scripts/learning-state.test.mjs；node scripts/learning-assessment.test.mjs
- [ ] node scripts/core-stats-signature.test.js；node scripts/core-merge.test.js；node scripts/core-sync-batch-merge.test.mjs
- [ ] node scripts/main-practice-classification.test.mjs；node scripts/main-practice-state.test.mjs；node srs.test.js
- [ ] node server/learning-evidence.test.js；node server/sync-delta.test.js；node account-storage.test.js
- [ ] node e2e/learning-mastery-loop.test.js；node e2e/srs-course-reentry.test.js；node e2e/srs-surface.test.js；node e2e/stats-mastered.test.js；node e2e/account-isolation.test.js
- [ ] npm run build；npm run build:check；node scripts/gen-sw.js；node scripts/check-sw.js；git diff --check
- [ ] 375px 和桌面查看实际测评入口、输入、错误反馈、成绩详情及档案；使用独立测试账号／临时数据库，不能修改用户当前学习数据。

## Acceptance criteria

- [ ] 普通练习连续全对十次也不产生“考试通过／已掌握”；所有页面判定一致。
- [ ] 自评熟悉仅改变标记及首次缺失排期；取消不清空练习或考试证据；刷新／另一设备取消后不复活。
- [ ] 初测前不到 24 小时不推荐；初测通过只显示初测通过；到 7 天且最近暴露间隔足够后复测通过，才显示已掌握。用注入时钟测边界，不实际等待数天。
- [ ] 提示、揭示答案、错后改对、连续立即重考均不能贡献掌握；考试失败后可由错题／巩固入口完成学习并按间隔再测。
- [ ] 掌握句复习失败转需巩固／待再验证，历史考试仍可查；只逾期不降级。
- [ ] 退出重进未来 dueAt 句不出现；熟悉但无旧排期的句子不永久消失；主动完整重练正常且不刷排期。
- [ ] 初测／复测内容版本变化不误授予掌握；封面修改不失效；答案合法 alts 判分一致。
- [ ] 一轮 8/10 达标只为实际通过句产生证据；分母和原始课程进度一致，中途退出不算交卷通过。
- [ ] 刷新续考、重复交卷、离线恢复／网络重试不重复计数；两设备相反结果合并不丢失败；账号隔离、备份往返均保留证据。
- [ ] 旧数据和旧客户端不能通过普通 streak 恢复假掌握；新增证据单独变化能触发增量同步，服务器不被旧行覆盖。
- [ ] 学习档案显示熟悉与掌握各自数量，首页已掌握只包含当前有效测评，提供旧口径变更说明。

## Risks and rollback

- 完整闭环包含同步和考试恢复，是中等范围功能，不能简化成替换文案。若数据协议出现与此规划冲突，记录具体冲突后改为 needs-planning。
- 24 小时／7 天会增加等待，但可继续学其他句子；空状态必须给出下次可测时间。收集到期首答正确率、实际复习量、延迟复测通过率、放弃率，后续据此调整，不以熟悉点击数优化掌握率。
- 单句逐意群输入受拼写、内容答案覆盖影响；必须明确测评范围，未来再补整句、听辨和情境迁移测试，不把初版成绩夸大为语言能力。
- 提交结果是个人自测数据，客户端可见答案，不能承诺强防作弊。未来若用于认证需独立服务端考试产品。
- 回滚保留 learningV1 和事件；旧界面只是不显示新证据，不清库、不删除成绩。仅回退本次修改段并重生成缓存，禁止覆盖既有用户工作。

## Execution notes

执行阶段已开始。当前先实现纯规则和证据合同，再接入产品状态、会话保存和页面入口；尚未完成验收。
