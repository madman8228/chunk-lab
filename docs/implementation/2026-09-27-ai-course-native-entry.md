# AI 旧课程统一进入原生学习流程

- Status: in-progress
- Updated: 2026-09-28
- Branch/worktree: master / D:/06-project/chunk-practice
- Base commit and relevant uncommitted changes: 09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22。工作区大量未提交修改；main.html、decks.html、courses.html、course-package.js、js/course-catalog.js 已修改；src/course-authoring/、作者构建产物与 AI E2E 尚未跟踪。全部作为当前基线保留，不按 HEAD 重建。
- Planner: Astra planning phase（不推断界面选择的模型子型号）
- Executor: GPT-5.6 Luna

## Objective

用户从首页、课程库或旧链接打开平台生成的旧文字课程时，通过同一适配决策进入现有 main.html 学习。无损兼容内容直接准备并启动；确有内容变化才显示一次必要说明；不兼容内容明确列出修复项。新 AI 课程继续使用已经完成的原生路径。交付包括真实入口、存储与目录一致性、故障处理和端到端验收。

## Current state and evidence

- 未发现根目录及上级 AGENTS.md；执行前复核修改目录内指令。
- `2026-09-27-ai-course-native-learning.md` 已为 complete，原生模板、适配器、旧课转换、目录别名和测试已存在。本计划是入口体验补齐，不重建上一轮。
- 原入口确实让带 AI 标记的旧包继续走 `renderV2Node/renderV2Interaction`，并留下“先预览转换”旁路，因而同一课程会出现独立答题体验。
- 转换器原有基本结构检查，但缺少素材、完整 chunk 引用和完整草稿校验；已补齐。
- 保存沿用 `ExistingCourseGateway` 和 `CL.saveAndNotify`；目录沿用既有 `CourseCatalog` 的来源合并、`package:<id>` 身份和旧 lesson 别名。
- 同步实测发现旧云端快照可能重新带回删除的 deck，且服务端 deck 快照不保留 `authoring` 元数据。删除标记因此使用现有行级同步集合 `deletedItems`，并以无 `#` 的 `ai-course-retired:<courseId>` 键避免被句子 CID 迁移改写；`CL.allDecks` 和课程目录隐藏带该标记的 ID。用户从旧链接确认恢复时，仅在内容逐项完全一致且无冲突来源元数据时复用，并与清除标记一并保存。
- 本轮规划未读取用户浏览器持久化的实际课程 JSON；不得宣称该具体课程已被证明可无损自动适配。执行时先只读检查目标 ID；若无法读取，用同结构隔离样本验证并如实记录限制。

## Assumptions and decisions

1. 复用 main.html 的实际答题、候选池、讲解、错题与 SRS；不复制 UI 或再造判分。AI 来源仅用于旧格式识别，不作为长期学习模板。
2. 新格式保持 AiCourseDraft 1.1 和 sentence-practice 合同，不扩展任意 HTML/JS 或新增模板。
3. 本文替代上一计划“所有旧课必须手动进入制作向导”的入口决策：仅无内容损失且通过完整校验的旧文字课可在用户主动打开时准备原生 deck；扫描列表只读。
4. 缺中文意群提示使用词数、丢弃平面干扰项、改变模式等均需明确列出，不归类无损；提供一个“使用句子练习”确认动作后沿用既有转换保存。未知学习能力、真实图片/音频需求、不能保留的答案或字段不得静默丢弃。
5. 保留旧包与旧进度。旧 seen/passed 不能生成原生答题成绩、熟练度、打卡或 SRS。只读展示旧记录，新统计来自真实答题。
6. 删除已转换 deck 后不得打开旧链接就自动复活：由删除流程在同一 mem 保存中写入现有行级同步集合的禁止自动重建标记；统一目录据此隐藏暂时被旧云快照恢复的原始记录。用户主动确认再次适配可清除标记；失败时保留标记。

## Scope

旧平台 AI 文字包的统一适配报告、启动协调器、学习入口接线、必要说明与修复反馈、稳定身份与删除语义、缓存构建及隔离测试。普通内置句子、图文与外部 V2 保持原播放器能力。

## Out of scope

自定义学习页面、万能插件/模板注册系统、全站存储重构、批量迁移全部课程、实际用户记录的测试写入、提交推送部署。后续路线为章节/图文官方模板，再声明式布局；本轮不铺设其实现。

## Contracts and data changes

- 扩展 legacy-conversion 的纯报告为 `kind: native-ready | confirmation-required | blocked | not-applicable`，包含有字段路径的 issues、来源身份、目标 receipt 与适配草稿。native-ready 必须经过现有完整 draft validator，而非只有 chunkCountOk。
- 检查 sequence 唯一性/引用、utterance/chunk ID 唯一性、correctOrder 完整引用、拼接一致性、中英文、替代答案、角色、素材和能力。错误报告不得抛出原始 TypeError；未知有意义字段不可当作无损。
- 新 `src/course-authoring/learning-launch.mjs` 协调只读解析、必要确认、已存在目标检查、保存和启动；依赖注入 scopeGuard、已有 gateway/validator/compiler。导出浏览器门面通过独立小入口构建，避免在学习页挂载作者 UI。
- 启动结果只返回受控 receipt 或 report，不接受上传内容提供的 URL。句子目标使用 main.html?course=<catalogCourseId>&lesson=<lessonId>；旧 story lesson 仍可作为别名解析。
- 同 ID 已有 deck：匹配来源、版本及内容才复用；冲突明确停止，禁止覆盖。异步保存后再次检查账号与来源一致性；相同点击/多标签重试必须幂等。
- 原子保存完整 deck 和 legacySource；保存未确认不得跳转、去重或伪造成功。复用现有 CL.saveAndNotify，不直接落另一套数据库。
- 保留 package:<id> 加入身份和旧行 cid。未加入课的启动不额外自动加入；继续遵守既有入口的加入动作。
- 禁止自动重建标记按旧 courseId 存储于现有账号作用域，删除流程写入；缺标记的旧安装首次主动启动才可能自动适配。标记保存失败应阻止产生不一致删除结果并显示错误。

## Implementation steps

- [x] 1. 将本文置 in-progress 并核对工作区。目标课程实际 JSON 尚未从当前浏览器读取；执行先以隔离样本验证，不写入真实课程数据。
- [x] 2. 在 legacy-conversion.mjs 补全纯报告与完整校验；加入 hints、引用、素材、答案、模式和完整草稿校验。
- [x] 3. 实现 learning-launch.mjs 与轻量浏览器入口；复用 gateway 保存和 receipt；覆盖失败、幂等、冲突、确认和重试。
- [x] 4. `course-package.js:openCourse` 统一走启动门面；确认页/阻断页明确，未加载时不静默回到专属答题流程，异步错误可重试，成功使用 replace。
- [x] 5. 旧课程入口和目录使用同一身份与启动决策；目录读取不写数据，转换成功后复用已有 catalog 合并与去重。
- [x] 6. 接通删除标记、旧记录保留和用户主动恢复；标记与 deck 删除同次提交，并在 deck/目录被旧快照恢复时仍隐藏。
- [x] 7. 有损/阻断结果沿用制作修复能力，解释旧历史；移除旧 V2 学习区中的“先预览转换”旁路，不影响普通外部 V2。
- [x] 8. 更新构建入口、HTML 依赖、生成检查、部署文件清单和 SW；重新生成浏览器 bundle 与 SW。

## Validation

使用隔离端口、临时数据目录和测试浏览器账号；不替真实用户答题或写入成绩。

- [x] 作者模块 18 项测试：`node --test src/course-authoring/legacy-conversion.test.mjs src/course-authoring/course-authoring.test.mjs src/course-authoring/learning-launch.test.mjs`（18/18）。
- [x] 目录、加入、进度、恢复测试：`node course-catalog.test.js`（28/28）、`node scripts/course-enrollment.test.js`、`node course-progress.test.js`（12/12）、`node course-resume.test.js`（6/6）。
- [x] `node scripts/build-course-authoring.mjs`、`node scripts/gen-sw.js`、`npm run build:check`、`npm run lint:course-authoring`、`npm run typecheck` 均通过。`gen-sw` 输出一条既有的 HTML 动态引用解析警告（`' + escX(src) + '`），生成仍完成且 build:check 通过。
- [x] 隔离 Edge/Playwright E2E：旧课原生进入/必要确认/阻断、保存失败重试、课程与进度保留、删除及云端旧快照、跨账号隔离和 375/846/1200px 无横向溢出均通过。
- [x] `node e2e/ai-course-authoring.test.js`、`node e2e/course-enrollment.test.js`、`node e2e/tab-content-consistency.test.js`、`node e2e/course-package-v2-import.test.js` 均通过。
- [x] 原生学习 E2E 使用 main 的真实 stage/choices，答错后答对，检查答前答案隔离、错答/正确计数及复习 dueAt；旧完整地址重定向通过。
- [ ] 真实浏览器账号中的目标课程和 AI/内置视觉并排检查未做：本机 `127.0.0.1:8787` 服务当前未运行，未读取或写入真实课程数据。隔离样本验证同一 main 学习 DOM 与交互，不能替代该目标课程最终人工验收。

## Acceptance criteria

- [x] 隔离旧 AI 课程从统一入口和旧完整链接进入 main 原生学习；真实目标页仍待人工确认。
- [x] 有损适配只在用户继续前说明一次；阻断项进入已有修复流程，不静默丢弃。
- [x] AI 与普通课程仍复用 main 学习实现；普通外部 V2 导入回归通过，未发现误迁移。
- [x] 保存成功后原身份、旧加入关系与旧历史保留；答题产生新统计，失败不跳转。
- [x] 删除标记与旧 deck 同步；旧快照不会暴露已删除课程或跳过确认；显式恢复需要精确内容匹配，保存失败保留标记。
- [ ] 所有规定验证完成。实现与隔离测试完成；实际浏览器目标课检查留待本地服务可用后进行，因此计划仍为 in-progress。

## Risks and rollback

主要风险是把有损旧包误认为无损、并发写入覆盖和启动循环。以保守报告、已有存储门面、来源冲突检测及 replace 控制。回退时撤销本轮入口/协调器接线，保留已创建的合法原生 deck 与历史，继续通过旧别名访问；不批量删除用户数据，不回滚无关未提交修改。

## Execution notes

执行中未改真实课程内容或答题数据，所有新增浏览器验证使用临时数据库和独立上下文。目标 AI 课程尚未从实际本地服务读取；本轮完成实现并通过隔离验收，最终人工浏览器检查仍待服务恢复。
