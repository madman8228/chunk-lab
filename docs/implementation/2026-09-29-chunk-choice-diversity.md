# Chunk 选项多样性：均衡取样与合法答案保护

- Status: complete
- Updated: 2026-09-29
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22；main.html、js/chunk-engine.mjs、js/chunk-engine.test.mjs、js/ai-prompts.mjs、scripts/test-manifest.cjs 已有未提交修改，必须在现状上增量修改，不恢复到 HEAD。
- Planner: Astra 规划阶段；当前模型选择无法从工具确认，不宣称已验证模型身份。
- Executor: GPT-5.6 Luna

## Objective

减少整句选项池中围绕同一 chunk 堆积的近似干扰项，同时保留有教学价值的语法辨析；另按用户本轮追加要求，修复退出后重进课程仍重复推荐尚未到期句子的行为。首版交付运行时均衡选择、合法替代答案排除、生成提示约束及真实页面回归；并依据已保存 SRS dueAt 在课程重进时暂缓未到期句子、到期后重新纳入。

## Current state and evidence

- main.html 的 renderActiveChoices → buildDistractors → window.ChunkEngine.buildDistractors 是实际整句入口。buildChoices 是另一兼容入口，单独改它不会改变截图中的选项池。
- js/bridge.mjs 动态 import js/chunk-engine.mjs；无需另建一套生成引擎。
- buildDistractors 按位置顺序展平 it.distractors，再取满 max(4, chunks.length * 2)。前一个位置可以连续占用多个名额。后续回退仅与 chunks[0] 匹配词性模式，并最终任意补满。
- norm 只做文本归一，judgeChunk 还接受 alts；生成候选目前没有完整排除 alts，存在判对表达混入干扰池的风险。
- js/distractor-validate.mjs 的 cleanDistractors 为离线写入守门员，每槽最多存三条。presetSentenceCoverage 调用真实引擎，但 need 单独写死旧配额。
- buildDistractorPrompt 已要求语义偏离、禁止同义改写；仅补充“语义去重”字样不能解决已有数据及运行时偏置。
- 截图展示 My alarm、My alarms is、My alarm is of、My alarm's、set./sets.。未在本次限定范围的内容源搜索中找到原题，不能断言这些词的精确来源或正确切分；将截图作为拥挤形态证据，回归使用明示的合成题。
- 规划基线已运行：node js/chunk-engine.test.mjs（50/50）、node js/distractor-validate.test.mjs（31/31）、node js/ai-prompts.test.mjs（27/27）。未修改产品代码。
- 本次检查的工作目录及父级未发现 AGENTS.md；执行时重新检查新增指令。

## Assumptions and decisions

1. 用户要求评估与规划；本文件是唯一规划写入。原目标改善普通意群学习中的候选质量，不改变考试或熟悉/掌握状态。执行阶段用户明确追加“已答句按科学记忆周期到期后再推荐”，因此本次额外限定为课程队列消费已有 SRS dueAt；不改变 SRS 算法、考试判定或熟悉/掌握状态。
2. 原方案需要修正：set/sets、alarm/alarm's 并非必然同义。词干化或模糊匹配不得进入 judgeChunk，也不得抹去否定、时态、数量、人称差异。
3. 第一版采用明确的数量与位置规则，不承诺通用语义理解：整句每个位置最多选一条干扰项，整句上限 min(4, chunk 数)。两个 chunk 最多两条干扰，加两个正确项，共四个按钮。仅对干扰限额，正确项全部保留，包括重复文本但不同位置的正确项。
4. 保留整句共用选项池和每题仅混洗一次的交互。正确项、干扰项采用相同初始外观，不展示位置归属或类型标签。
5. 有效语法近失项可以保留，例如 set 对应 sets；避免把所有“不合语法”的干扰统一删除。毫无教学意图的残缺片段主要靠命题约束与后续内容审查解决，首版规则不冒充语法分析器。
6. 不足配额允许少显示，甚至仅有正确项。此时仍属拼装练习，不增加“考试掌握”认定。维持已有答题统计，不在本任务重新设计评分。

## Scope

js/chunk-engine.mjs 与单测、js/distractor-validate.mjs 与单测、js/ai-prompts.mjs（仅干扰项提示及版本）与相关单测；新建 e2e/chunk-choice-diversity.test.js；最后通过项目脚本更新 sw.js。main.html 仅在集成验证发现确有必要时作最小接口适配。

## Out of scope

语义向量、在线模型调用、新模型依赖、通用词形还原、改判分规则、课程 schema 迁移、全库内容重写、逐 chunk 动态替换按钮交互、改变 SRS 间隔算法、考试/掌握闭环、批量生成付费请求。课程重进过滤只读取现有 bySentence dueAt，不扩展存储协议。后续可针对内容审查结果另立任务。

## Contracts and data changes

- it.chunks、it.alts、it.distractors 的二维数组协议及持久化内容均保持兼容。
- buildDistractors(it,currentItems,allItems) 和 buildChoices(it,i,currentItems,allItems) 仍返回字符串数组；输入数据不可修改。
- 在引擎提供共享纯函数 getDistractorBudget(chunkCount)：非正整数输入防御性返回 0，有效 n 返回 min(4,n)。presetSentenceCoverage.need 使用它；available 仍调实际 buildDistractors，shortfall 仅表示与上限的差额，不表示题目无效、不承诺自动补满。
- 两个候选入口与 cleanDistractors 共享“合法答案集合”：所有正确 chunks 与所有合法字符串 alts 的 norm。命中即不能作为干扰；不自动增加 alts，不更改 norm/judgeChunk 语义。畸形候选、非字符串、空白均跳过。
- 离线 cleanDistractors 仍每槽最多存三条，供选择与未来变化；运行时只选一条。不得为运行时预算永久删掉其他合法内容。

## Implementation steps

- [x] 在 chunk-engine 单测补截图型双 chunk alarm 合成输入，锁定每槽最多一条及全句预算。
- [x] 实现共享合法答案集合、候选校验与预算函数；判分、归一化及 choice-pool 索引协议不变。
- [x] buildDistractors 按槽取样：预置每槽最多一条，回退只补空槽且匹配本槽结构、需要句境关联，稳定排序，不任意兜底。
- [x] buildChoices 使用同一合法答案排除，最多一个干扰项；无有效候选时只返回正确项。
- [x] cleanDistractors 共享合法答案集合（含 alts），保留每槽最多三条；coverage 与入库校验预算对齐。
- [x] 更新干扰项提示词约束及版本号至 2；未批量生成或改写题库。
- [x] 添加隔离浏览器选项回归，使用真实 startDeck/renderActiveChoices，完成 chunk 后候选顺序稳定，覆盖 740px 与 375px。
- [x] 增加课程重进 SRS 回归：实际调用 recordSentenceResult，验证未到期句过滤、到期/新句保留、断点映射、完整重练与空队列提示；覆盖 preserveOrder 对话课。
- [x] 更新旧测试和批次/全库校验器，并生成服务工作线程缓存版本。

## Validation

- [x] node js/chunk-engine.test.mjs — 57 passed
- [x] node js/distractor-validate.test.mjs — 33 passed
- [x] node js/ai-prompts.test.mjs — 27 passed
- [x] node js/distractor-cause.test.mjs — 76 passed
- [x] node e2e/chunk-choice-diversity.test.js — passed
- [x] node e2e/srs-course-reentry.test.js — passed
- [x] node srs.test.js — 36 passed
- [x] node e2e/srs-surface.test.js — 9 passed
- [x] node e2e/content-explanation-refresh.test.js — passed
- [x] node scripts/main-course-learning-policy.test.mjs — 2 passed
- [x] node validate_distractors.js — all content passed
- [x] node scripts/gen-sw.js; node scripts/check-sw.js; node scripts/sw-hash.test.js — passed
- [x] git diff --check — no whitespace errors; repository-wide line-ending notices only
- [x] node e2e/main-startup.test.js — unrelated existing mismatch: it expects an unjoined user deck in the redesigned home-course list. No home changes were made in this task.

## Acceptance criteria

- [x] alarm 题正确项完整，干扰至多两个、每槽一条；槽内变体不再挤满整池。
- [x] alts 中合法表达不进入干扰项；词形差异不改变判分规则。
- [x] 回退候选匹配自身 chunk 结构与语境；不足时不任意补满。
- [x] 真实页面答完一个 chunk 后顺序不变，已答正确项消失。
- [x] 重进课程时未来 dueAt 句暂缓，到期/新句保留；显式重练绕过过滤。
- [x] 740px / 375px 页面选择项正常渲染，无额外标签或弹窗。
- [x] 离线清洗与运行时共享正确答案保护，coverage 符合新预算。

## Risks and rollback

- 每槽一条降低选择题难度，但减少机械识别词尾和视觉拥挤；这是首版明确取舍。后续若需要考试难度，另定义考试候选策略。
- 结构+词汇相关回退可能不给某些短语提供干扰，接受少量候选；不能因此放开任意兜底。
- 预置第一条可能质量仍差。运行时均衡取样解决数量偏置，不能保证旧库所有候选自然或语义唯一；本轮不伪称完成内容语义审校。
- 项目工作树有大量用户变更；只回退本次变更段与新测试，不整文件 checkout/reset。缓存回退通过重新生成 sw.js 完成。

## Execution notes

执行完成：干扰项按 min(4, chunk 数) 预算逐槽均衡取样，chunks/alts 合法答案统一排除；提示词版本升至 2，离线校验预算同步更新。普通课程重进时依据已有 SRS dueAt 暂缓未来到期句、优先覆盖到期复习并保存原始课内断点；显式重练可完整重练。未改变 SRS 间隔算法或考试/掌握语义。定向测试和全库干扰校验通过；唯一未通过项是原有首页测试与当前未提交首页改版不一致，未扩展修复。service worker 哈希已重生成。无提交、推送或部署。
