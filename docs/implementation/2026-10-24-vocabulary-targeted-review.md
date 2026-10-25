# 单词错题与待复习：第二阶段执行交接

- Status: phase-2-complete; phase-3-in-progress
- Updated: 2026-10-24
- Planner: GPT-6 Astra（用户已确认选择）
- Executor: GPT-5.6 Luna
- Branch/worktree: `stabilize/p0-1-20261021` / `D:\06-project\chunk-practice`
- Base: `a927fd46835abc73ce7f695e286507e4873649fe`。工作区有大量既存改动及未跟踪课程/规划文件；本轮只新增本交接文件。实现时必须先检查状态并保留所有既存改动，不得用 checkout/reset/清理来“整理”工作区。
- 前置交付：[`2026-10-24-mistakes-and-due-review.md`](2026-10-24-mistakes-and-due-review.md)，首期句子闭环已完成。

## 目标与范围

把“学习记录 → 单词错题/待复习 → 指定词复习 → 记录重新进入列表”做成真正闭环，先覆盖单词书中可由服务端核对答案的练习类型。错题与待复习按“账号 × 词书/资源 × 词条 × 内容版本 × 练习能力/类型 × 练习版本”隔离；相同词条在不同词书或能力中的结果不能互相覆盖。

本阶段不做句子功能重构、不改首页课程上限、不接入 `vocabulary-pilot` 旧实验、不生成或迁移课程内容、不发布/导入/加入课程、不改账号记录、不重启或切换 8787 实时服务。阶段三跨类型汇总及额外增强仍在本阶段之外。

## 编码前必须成立的架构约束

1. **普通课程进度与定向复习分离。** 不得复用或推进普通 `vocabularyResume` 光标，不得让专项复习改变课程当前词、课程完成数或正式掌握状态。
2. **不能把全局 dueAt 当成按书、按能力的到期事实。** `vocabulary_item_progress` 的主键为 `(user_id,item_id)`，缺少资源和能力维度；只可继续服务既有普通课程逻辑，不可直接充当本阶段筛选依据。
3. **定向复习是独立会话。** 会话绑定所有者、资源/词书标识、资源内容修订、条目 ID、条目内容修订、练习类型及练习修订、队列、位置、状态和创建/更新时间。服务端每次读取或写入都重新核验用户权限及内容身份；条目或修订不匹配时标记为不可继续并提示重新整理队列，禁止静默换题。
4. **答题必须服务端判分且幂等。** 使用现有 server-side vocabulary attempt evaluator；每次作答有独立 attempt/op ID。重复提交返回同一结果，不重复计数。可沿用 append-only `vocabulary_attempt_events` 保存事实，但需为新证据写入可审计的 `reviewSessionId` 和服务端确认的 `practiceRevision`。除非 `user_entity_rows` 无法满足按用户隔离、并发更新、唯一性或恢复需求，否则优先用该实体行保存专项会话，避免不必要的数据库迁移。
5. **专项记录不能伪装成课程完成。** 不写 `vocabulary_study_events` 的普通完成事件、不更新 `vocabulary_item_progress`、不发完成回执、不改普通续学光标。专项连续答对只更新该能力的巩固状态，不得宣称正式掌握或课程已完成。
6. **练习能力分开判定。** 每种 practice type 独立列表、复习计划和巩固证据。朗读等自我报告型能力不能仅凭点击“认识/读对”累计独立掌握；如没有可验证判分，应明确排除出自动掌握状态，而非借用其他能力成绩。
7. **历史证据不可猜补。** 老 attempt 若缺资源、词条/内容修订、能力修订或专项会话身份，可以用于历史展示，但不得计入新规则的跨日独立成功。存在资源删除、内容修订变化或权限不可用的条目，应安全显示不可用原因，不用标题/同词拼写推断对应内容。

## 状态与调度规则

- 错题：来自可验证、未辅助的服务端错误结果；错误历史保留，复习成功不抹掉曾经答错的事实。
- 待复习：由精确能力身份下的答题事实和调度规则派生，不复制句子全局计数。错误或有提示/答案辅助的结果不能作为独立成功；不正确或辅助作答重置该能力的连续巩固证据。
- 巩固成功：沿用句子路线“跨不同学习日、不同会话、首次作答、无辅助”的原则，按单词能力身份单独实现纯策略函数并覆盖边界测试。具体门槛应沿用首期已落地的规则/产品文案；不得另造与句子规则冲突的门槛。朗读不进入此计数。
- 到期计算：先核对 `src/learning/schedule-policy.mjs` 与现有 `srs.js` 的纯策略。错误/辅助后使用项目既有 relearn delay（当前代码为 10 分钟）；独立成功仅推进本能力自己的计划。不能从全局 `dueAt` 推断另一词书、另一能力的 due 时间。
- 每次专项会话最多 10 项；队列为空、过期或所有条目已不再可访问时，返回明确空态/不可用状态，不回退到普通课程队列。

## 现状核验（实现前再检查一遍）

- `server/services/vocabulary-study-operations.js`：普通 `vocabulary.attempt` 需普通 resume cursor 和普通 session receipt；目前会写 `vocabulary_attempt_events`，但不推进 cursor/progress。`vocabulary.complete` 会写 assisted 的普通学习事件并更新全局 `vocabulary_item_progress` 与普通 resume。
- `server/db.js`：`vocabulary_attempt_events` 已有 `user_id, attempt_id, scope_key, session_id, item_id, resource_id, content_revision, data_json, occurred_at, seq`，并按用户/范围/条目建索引；`vocabulary_item_progress` 缺少资源与能力维度。
- `server/services/vocabulary-archive.js` / `server/routes/learning-archive.js`：已有登录用户隔离的只读汇总、课程、事件、attempt 查询；汇总的 `dueItems` 来自全局进度，不能原样用于新列表。
- `js/stats-vocabulary.js`：当前仍提示指定词复习入口未接入；需由运行时真实数据驱动。
- `js/vocabulary-study-store.js`：离线队列目前过滤/投影普通 session/complete/rehearse/attempt 并与普通 resume 绑定。专项操作不得被误投影为普通学习；账号及 API origin 隔离必须保留。
- `src/vocabulary-study/session-model.mjs`：目前只包含普通 cursor helper，可在有必要时新增纯专项会话状态 helper，不要把两种 cursor 合并。
- 现有基线通过：`node server/vocabulary-attempt-http.test.js`；首期的 `server/services/vocabulary-archive.test.js` 覆盖登录用户隔离和归档只读行为。该通过仅证明既有普通链路，不代表专项复习已实现。

## Luna 实施步骤

### 1. 专项状态策略与身份

新增最小纯函数模块（复用现有模块组织风格），明确生成/比较能力身份键，涵盖 owner、resource、item、内容修订、practice type 与 practice revision。策略函数由显式事件输入产生错题、待复习、dueAt、连续独立成功与 stale 状态；禁止读写 DOM 或数据库。

先写测试覆盖：跨书同名/同 ID 不串；同一条目不同练习能力不串；内容修订后旧证据不混算；两天且两会话才算独立成功；同日重复、非首次、辅助及错误不算并重置；朗读不算；缺字段旧记录不提升掌握；10 项上限。

### 2. 归档只读查询

扩展现有 authenticated archive API，以明确词书/resource + practice type 请求 due 与错误条目。校验用户权限和资源发布/可访问状态，结果需包含稳定身份、due/错误原因、最近有效练习时间及能否复习。分页/上限和排序确定性；摘要数量与列表使用同一策略。端点只读，不能为了构造列表写入、修补或迁移用户记录。

### 3. 独立会话及提交协议

新增最小专项操作（创建/恢复、作答、暂停/结束），会话及答案严格验证 owner、scope、资源和练习修订、条目仍存在及可访问。对重复 operation ID 返回原结果；并发更新不可让位置倒退或重复答题。将 review session 和服务端判分身份写入 attempt 事实，新增字段应向后兼容旧 `data_json`。不得走普通 `vocabulary.complete`，不得改普通 cursor、课程完成/掌握、全局 progress 或原 course receipt。

### 4. 学习界面与离线安全

从归档错题/待复习入口启动专项复习，复用现有词条呈现和可判分交互；通过显式 review session 参数区分流程。刷新可恢复会话，结束后返回原词书/筛选上下文。store 的离线队列须独立识别专项操作，保证账号/API origin 隔离；若暂不支持离线专项答题，应清晰告知并保持作答不被误存为普通课程事件。普通路线回归验证确保行为不变。

### 5. 接入统计页

将“错题本/待复习”列表、筛选、空态和计数连接至新只读 API 及专项启动路径。条目按词书、练习能力展示；解释“错因/到期/内容已更新或不可用”；结果文案区分练习巩固与正式课程掌握。移除“入口未接入”的占位，但不能无数据时伪造条目或数字。

### 6. 隔离 E2E 与回归

在全新临时数据目录和独立端口运行真实 HTTP + SQLite 测试，使用隔离测试身份和临时课程 fixture，不得连接 `server/data`、在线 8787 实例、账号 18221012567 的存储或课程归档。至少验证：

- 普通 cursor、普通 progress、课程完成与掌握值在专项开始、答题、结束前后完全不变。
- 不同用户、词书、能力、资源修订均隔离；用户无权访问的资源拒绝且无副作用。
- 答案由服务端核验；正确/错误、辅助、重复提交、乱序/并发位置与 attempt/op 重放正确。
- 两个不同日/会话的独立成功才推进对应能力；旧证据及朗读不推进；错误和辅助重置。
- 刷新恢复、返回上下文、内容更新失效、最多 10 项、空队列、离线行为正确。
- 归档查询无写副作用，普通课程相关测试不回归。

### 7. 生成产物与交付

只在源页面/源脚本确认完成后运行本项目规定的 stats 生成器，再运行 `check-generated`；查看生成差异仅限目标页面。运行 `git diff --check`。复核全工作区已有改动未被覆盖，报告测试命令和逐项结果、触碰文件、未完成项；不要提交、发布、导入、改真实数据或重启服务。

## 验收标准

- 从真实错题/待复习条目可以启动、刷新恢复、完成不超过 10 项专项练习；列表数量与所选词书及能力吻合。
- 错误与待复习按精确能力身份派生；重复、跨书、跨能力、跨修订都不会错误合并。
- 专项成绩不会改变普通续学光标、普通课程完成数、正式掌握状态或全局 item progress。
- 仅服务端核验、首次、未辅助、按策略达成的有效证据能推进对应能力巩固；朗读不被虚报为掌握。
- 鉴权、幂等、刷新恢复、离线边界、更新失效和只读查询均有隔离自动化验证。
- 生成文件检查通过，普通单词学习和首期句子错题/待复习测试回归通过。
- 无真实数据修改、无实时服务重启、无发布/导入/加入课程。

## 建议验证命令

先检查各命令仍对应当前基线，再逐项执行；新增专项测试文件名由实现者采用现有命名习惯并在交付中列出：

```powershell
node server/vocabulary-attempt-http.test.js
node server/services/vocabulary-archive.test.js
node server/vocabulary-study.test.js
node server/vocabulary-word-choice-study.test.js
node server/vocabulary-dictation-study.test.js
node server/vocabulary-chunk-order-http.test.js
node scripts/learning-archive-ui.test.cjs
node scripts/build-stats-page.cjs
node scripts/check-generated.mjs
git diff --check
```

持久化测试必须遵守根 `AGENTS.md` 的临时数据目录及隔离端口要求。不得把 `server/backups`、用户数据库、课程素材或正在运行实例复制到测试工作目录。

## 风险及处理

- **单词 progress 键维度不足：** 不做静默复用或全库迁移，专项状态用独立身份及 append-only 证据派生。
- **旧 attempt 证据不完整：** 保留展示但不纳入跨日巩固；不根据相同拼写自动映射。
- **课程更新导致队列过期：** 明确提示刷新列表，不悄悄替换题目。
- **离线与重复提交：** 独立操作 ID/receipt，避免投影到普通学习；未完成服务端确认前展示待同步/未计入，而非成功掌握。
- **工作区有大量既存改动：** 改动前后检查目标文件及全局状态，严禁清理或还原用户更改。

## 主线进度

- 阶段一：句子错题与待复习闭环——已完成并通过其隔离回归。
- 阶段二：单词错题与待复习专项闭环——已完成。策略、服务端列表与独立会话、统计页入口/专项页及隔离 HTTP/UI 验收均落地并通过；已知 `vocabulary-study.test.js` 的公开引用夹具失败已单独记录，不属于专项闭环，也未改发布规则来绕过。
- 阶段三：已启动。首个最小交付是概览分开呈现句子/单词复习，单词数量按明确词书与练习范围读取并独立启动；跨类型父队列及 AI/提醒仍未做。

当前仍在原定“错题本与待复习”主线上，没有把首页课程容量或视觉统一等旁支混入本阶段。完成本阶段后再核验总路线中剩余阶段三项目。

## 执行进展（2026-10-24）

- 已完成：精确能力身份纯策略、10 分钟重学间隔、跨日/跨会话独立巩固与错误/辅助证据规则；服务端登录隔离错题/到期列表；独立会话、服务端判分、重复请求幂等、内容修订核验，以及普通课程 cursor/progress/完成记录隔离。
- 已完成：记录页按词书、错题/待复习和练习方式筛选并启动最多 10 项专项会话；专项页刷新可由服务端状态恢复，离线明确拒绝；错题重答保持当前词条，完成或手动结束返回原筛选地址。统计摘要不再展示无能力维度的全局 `dueAt` 数字。
- 已通过：`server/vocabulary-review-model.test.js`、`server/vocabulary-targeted-review-http.test.js`、`server/services/vocabulary-archive.test.js`、`scripts/learning-archive-ui.test.cjs`、`scripts/build-stats-page.cjs`、`scripts/check-generated.mjs`。
- 已通过普通路线：`server/vocabulary-attempt-http.test.js`、`server/vocabulary-word-choice-study.test.js`、`server/vocabulary-dictation-study.test.js`、`server/vocabulary-chunk-order-http.test.js`。
- 本轮新增验证：HTTP 端到端证明同一词条分别以 `word-choice` 和 `sentence-cloze` 答错后，会出现在两个独立能力队列；专项 UI 断网时明确拒绝写入。刷新、错题重试、幂等重放、归档返回地址及普通进度隔离的专项 HTTP/UI 回归均通过。
- 已补齐上一轮列出的两项端到端验证：通过临时账号的公开单词本保存接口追加词条，词书实际修订变化后旧专项会话读取为 stale；第二本独立词书通过标准课程作答形成错误记录后，其错题和专项队列只包含该词书自己的词条。原词书队列仍保持隔离。HTTP 样例不直接改数据库构造这两项行为。
- 阶段二复核：纯身份策略覆盖账号/词书/能力/内容与练习修订；只读列表及专项会话通过隔离 HTTP；UI 覆盖刷新恢复、统计页返回与离线拒绝；10 项上限由专项边界测试覆盖；普通课程 attempt、word-choice、dictation、chunk-order 与课程 cursor/progress 隔离回归通过。阶段二范围内的验收项已完成，阶段三跨内容类型统一复习视图仍属于后续规划而非本阶段遗漏。
- 已知既有测试夹具不兼容：`server/vocabulary-study.test.js` 在原有课程目录 `library.saveDraft(...).status` 处期望 200、实际 422。只读复现确认拒绝原因为“内容引用不是已公开的素材”：该测试把 `pilot-six-v1` 作为公开词书引用，但它不在公开素材目录中。此失败发生在专项功能之前，未修改目录规则、夹具或发布状态。
- 本轮通过：专项策略、归档、专项操作边界、专项 HTTP（含双词书隔离与真实追加修订后失效）、普通 attempt HTTP、word-choice、dictation、chunk-order、专项 UI、归档 UI、stats 生成与 `check-generated`；`git diff --check` 退出码为 0（Git 对大量既存 LF 文件给出 CRLF 转换提示）。
- 本轮没有连接或重启实时服务，没有访问/修改真实账号或课程数据，也没有发布、导入或加入课程。
