# 统一课程领域模型与目录入口重构（评审修订版）

- Status: complete
- Updated: 2026-09-17
- Revision: 8；逻辑课程改为用户创建，导入包显式绑定
- Branch/worktree: master / D:\06-project\chunk-practice
- Base commit: 127d83e070a23328bf42947af00ae13dd2e67f76
- Planner: Astra 规划阶段（沿用用户指定流程，不据此断言运行模型子型号）
- Executor: GPT-5.6 Luna
- Relevant uncommitted changes: decks.html、main.html、core.js、library 相关依赖、内容清单、统计/同步和发布检查等存在既有改动；执行前按 git status 复核，保留所有无关改动
- Review scope: 方案与现有代码合同核对；本轮按修订方案实现并完成产品回归

## Objective

建立统一的课程模型，使口语3000句、高频短语、自建句子课程和图文课程都有清楚的课程身份、教学目录与内容引用。课程列表按课程计数；口语3000句只显示一张课程卡片，进入后浏览当前 65 个场景课节。学习记录继续关联原内容身份。

一次交付接通课程清单、课程目录、开始学习和首页最近练习的课程归属。保留现有句子/图文筛选，以及两个播放器各自的学习语义。课程目录通过通用模型产生，不依赖页面中的产品名称匹配。

## Review findings and decisions

1. **P1：初版把组织结构与内容形式混在类型中。** collection 用于多单元句子课程，unit 用于单单元句子课程，course 专用于图文包；同一产品增加第二课时就可能换类型。修订为统一 Course，内部 OutlineNode 分 group / lesson，lesson 的 contentRef 决定播放器类型。单课与多课使用同一课程模型。
2. **P1：deck 不完全等于教学课节。** scripts/book-decks.mjs 按题量及连续 topic 装箱切分；把 deck 永久定义成课节会让教学改版与内容身份绑定。修订为 Lesson 引用 ContentUnit，首期 1:1 适配现有 deck，预留概念边界，不实现多对多编排。
3. **P1：初版将课程归属、进度聚合放进 ContentRepo。** 该模块负责静态内容与分片缓存，把账号学习记录和目录揉进去会扩大耦合。修订为纯目录模型、只读学习投影、内容加载三个职责。
4. **P1：聚合统计未定义去重、分母和未知状态。** 按旧 key 前缀直接数可能包含已下架题；图文 seen 节点数也不等于句子掌握。修订为按当前成员集合校验、按指标分别展示；索引未齐不能伪造准确百分比。
5. **P2：初版大范围重写启动协议，但浏览目录却未定义可恢复路由。** 采用 URL 表达课程/课节导航，在现有启动入口增加内容引用解析；复习临时队列和旧协议保持兼容。无需新建持久化 intent 队列。
6. **P2：版本、旧清单回退、生成命令与权限边界不完整。** 固定新增 manifest.catalog 合同和 catalog.version；保留外层 schemaVersion 1。口径变更不影响身份；旧清单适配集中在一处。内置属性与内容类型分开，用户可导出行为继续由现有操作授权决定。

上述问题已在本文件修订。此结论是当前项目约束下的推荐方案，不声称存在适用于所有未来需求的唯一最优模型。

## Current state and evidence

- content/manifest.json 当前 66 个 deck：65 个口语场景合计 3259 条、1 个高频短语单元；口语有章节、section 和 topic 元数据。“3000句”是产品名称，实际条目数单独计算。
- scripts/book-decks.mjs 以题量切分；extra/oral-book/decks.json 为结构输入；scripts/gen-oral-book.mjs 装配内容，scripts/build-content.mjs 实际生成 manifest 和分片。
- ContentRepo.ensureDeck / ensureDeckIndex / ensureDeckBatch 以 deckId 解析内容；索引已含 cid 和详情引用。目录不需要读取所有题目详情。
- core.js:cidKey 为 deckId + '#' + cid；掌握、隐藏句、SRS、答题事件、best 和句子续练都依赖现有身份。目录节点重排不应触发该身份迁移。
- decks.html 目前用课程名前缀区分口语，并把所有 deck 渲染成卡片；开始操作经 sessionStorage._startDeck 传递对象。
- main.html:startDeck 负责内容加载和练习；decideEntry 接受旧对象、复习队列和 direct=1。首页最近练习也按 deck 展示。
- library.js 为图文内容另建 series/volume 目录；readDecks 只读用户 mem.decks，不能直接作为全量课程事实来源。volumeIndex 在导入时可统一为 1，旧 lib 不足以安全推断哪些图文包属于同一门产品课程。
- course-package.js 已有 courses.html?id=<packageId> 入口；现有 courseId 是包身份，进度存在独立 course-progress 中。该包可能包含多场景与分支，首期把完整包适配为一个课节，不能把 story.nodes 自动当独立课节。
- 用户逻辑课程定义保存在当前账号的 `chunklab.logical-courses.v1`，只记录课程 ID、用户填写的名称、用户上传的封面和目录键；系统不预置“新概念英语第一册”等具体逻辑课程。
- 图文课包仍保留自身的教材/系列元数据作为来源信息，但只有导入时明确选择逻辑课程，才会写入 `logicalCourseId` 并进入该课程；没有明确归属的课包保持独立课程，不按标题或教材标识自动合并。

## Assumptions and decisions

### 统一的产品语义

- Course：用户选择的一门课程，包含稳定 id、名称、封面、来源、教学目标（可选）与有序目录。
- Group：目录中的章、主题或单元分组，可嵌套，只负责组织；没有独立学习成绩。
- Lesson：目录中的可学习课节，具有稳定 id、标题和内容引用。
- ContentUnit：实际加载的内容及身份，例如句子 deck 或图文包。其 ID 和题目 ID 决定现有记录归属。
- 学习记录：一次答题、掌握状态或播放器断点；课程概览由这些事实推导。
- 系列/标签：跨课程的发现分类，属于导航元数据。未来确有“课程合集”需求再新增，当前无需用 collection 取代 Course。
- 逻辑课程创建：由用户明确创建 Course 身份并提供名称、封面；导入流程只负责把一个 ContentUnit 绑定为一个实际 Lesson。逻辑课程不预生成计划中的空 Lesson。

课程设计决定目标、课节组织、顺序和内容；课程模型提供承载这些决定的共同合同。渲染器负责具体练习交互。课程可以只有一课，也可以有多课，数量变化不改变 Course 类型。

### 身份与兼容策略

- 本轮创建稳定的内置课程 ID：builtin:oral 与 builtin:idioms；名称及数量变更不改 ID。
- 首期一个句子课节引用一个完整 deck，一个图文课节引用一个完整包。不合并、复制或切割题目数组。
- 现有 oral-*、builtin-freq-idioms、用户 deck.id 和图文包 courseId 全部保持。
- 单课自建课程的目录 ID 为 user-deck: + 原 deck.id；图文课程为 package: + 原 package.courseId。均为当前账号视图中的确定性映射，不写回旧存储。
- 课节 ID 首期以内容引用确定性生成；group ID 从显式章节/section 标识生成，不用标题、显示序号或数组位置作为主键。
- 首期同一内容引用只属于一门课程且只出现一次。跨课程复用的记录共享/隔离规则留待独立设计，不隐式启用。

## Scope and boundaries

包含：静态课程声明、纯目录适配、课程目录页、轻量内容引用启动、课程归属展示、只读统计投影、回退/缓存校验和必要回归。

本轮无新增服务端表或同步实体；新增的 `chunklab.logical-courses.v1` 只保存当前账号的逻辑课程展示定义，不参与答题同步。不变更题目身份、历史事件、SRS 算法和图文播放合同。不实现课程编排编辑器、跨课节连续批次、课程级云端断点、跨类型综合成绩、课程市场或多对多内容复用。

用户以后创建多课课程时，编辑器可写同一 Course/Outline 合同；届时需单独交付版本化持久化、所有权与同步冲突合同，本次不借用现有图文 courses 存储塞入异构课程对象。

## Contracts and data changes

### 1. 声明与适配

外层 manifest.schemaVersion 保持 1，新增可选 catalog 区域。旧代码可忽略该字段；新代码必须支持缺少该字段的旧清单。

示例（仅展示局部目录，不是完整产物）：

```json
{
  "schemaVersion": 1,
  "catalog": {
    "schemaVersion": 1,
    "version": "<catalog 内容的确定性 hash>",
    "courses": [{
      "id": "builtin:oral",
      "title": "口语3000句",
      "origin": "builtin",
      "coverKey": "oral",
      "outline": [{
        "id": "chapter:1",
        "kind": "group",
        "title": "日常生活中使用的短句",
        "children": [{
          "id": "lesson:oral-1-1-1",
          "kind": "lesson",
          "title": "从起床到出门",
          "contentRef": {"type": "sentence-deck", "id": "oral-1-1-1"}
        }]
      }]
    }]
  },
  "decks": ["<现有完整 deck 元数据保持原结构>"]
}
```

- 正式构建输出完整“章—主题—课节”目录，顺序沿用源结构，不以最近学习时间打乱目录。
- 若未来需要声明式课程规划，`lessonRange` 只能作为可选规划信息，展示目录中的 lesson 必须对应已存在的内容包，不能用空占位课节冒充可用内容；当前用户逻辑课程不使用预置课节范围。
- 使用 children 数组作为排序事实，不再同时维护 parentId、unitIds 等重复关系。
- Course 本身不含 items；只有 lesson 可带 contentRef，group 只能带 children。叶子支持 sentence-deck / story-package 两类引用。
- 高频短语声明为一门单课课程；用户 deck 和图文包通过相同合同生成单课课程视图。
- 图文 `lib.series/volume` 和包内 `metadata.catalog` 仅作来源/筛选标签，不能单独决定课程归属；显式绑定使用 `logicalCourseId`，同名课程或同册序号不能自动合并。
- 实际可见课程数按 Course 计算，课节数按 lesson 计算，章/主题不计入。空 Course 可呈现空态但不能开始；未知类型显示“暂不支持”，不能当句子课程启动。

### 2. 模块职责与接口

新增 js/course-catalog.js（纯函数，浏览器与 Node 测试均可调用）：
- buildCatalog({manifest, userDecks, storyPackages, logicalCourses}) -> {courses, byCourseId, ownerByContentRef, diagnostics}；逻辑课程定义与实际导入包分开输入。
- getCourse(catalog, courseId)、listLessons(course)、resolveLesson(course, lessonId)。
- validateCatalog：引用存在、节点 ID 唯一、合法节点形状、重复引用、循环对象防护；构建期异常使构建失败，运行期隔离错误课程并给出诊断，其余课程可用。
- 实际数据由页面经 ContentRepo.getManifest / CL.allDecks / CL.readCourses 提供；模型不读浏览器存储、不加载分片、不写账号数据。
- 旧清单转换函数集中在这里。已知内置口语成员以生成的兼容 ID 表识别；未知旧 deck 显示为独立单课课程，不根据中文标题猜归属。兼容映射必须覆盖装配后 oral-basic 等全部成员。

新增 js/course-progress.js（只读投影）：
- summarizeCourse(course, {mem, storyProgress, indexesByRef, now})。
- 按不同内容类型返回独立指标和 ready / loading / unavailable 状态；课程目录加载后按需获取本课程轻量索引，期间标题、目录和返回可操作。
- 输入依赖显式注入；不得调用保存或同步。一次构建内容 key 集合，一次扫描学习记录，不对每张卡片重复全量遍历。

保留 js/content-repository.js 为静态 manifest、索引、详情分片加载/缓存的拥有者。这里仅做新增 catalog 的兼容保留及同源生成回退接线，不新增课程统计业务。

library.js 作为旧 UI 与新模型的适配门面，停止另行定义句子/图文课程身份；现有外部调用可保留兼容包装。图文播放器继续接收包 ID。

身份与返回值细节：contentRef 的索引键使用 JSON.stringify([type,id])，避免不同内容类型或分隔符发生碰撞；courseId 全目录唯一、outline 节点 ID 在所属课程内唯一，lesson 查找必须带 courseId。纯模块采用浏览器全局 CourseCatalog / CourseProgress 与 CommonJS 导出兼容方式，单元测试直接调用生产实现。进度投影提供 prepareProgressInputs(...) 一次建立 key/归属索引供 summarizeCourse 重用；摘要至少含 status、publishedCount、effectiveCount、practicedCount、masteredCount、dueCount、coverage，其中未就绪指标为 null，不用 0 占位；story 状态单独返回。

### 3. 进度口径

- 内容统计唯一键仍为 deckId#cid；目录 lessonId/courseId 不替代它。不因目录操作写入新答题、best 或学习日。
- 句子数：发布总条目数来自 manifest.totalCount（用户课程来自实际 items）；有效条目数需与当前成员索引核对隐藏标记。
- 已练数：当前有效 key 中 times > 0 的唯一条目数；多次答同一道只计一个已练条目。
- 已熟数：当前有效 key 中手动标熟或已有熟练判定为真，按集合并集去重。
- 待复习数：当前有效 key 按现有 CL.srs.isDue 判定；不能因为已熟而排除到期项。
- 覆盖率 = 已练条目数 / 有效条目数，按条目数加权，不平均各课节百分比；分母为 0 显示“暂无可练内容”，不显示 100%。
- 索引未齐时可展示发布总条目数，其他依赖成员校验的准确数字先不显示；失败后保留目录并给出重试，不将未知显示成 0。全局历史答题次数不因目录移除内容而减少。
- 图文按既有包进度显示“未开始/学习中/已完成”；seen 节点比例不充当通用完成率，不与句子覆盖率相加。
- 不将“全部答过/已熟”推导成课程完成；当前不新增通用 completionPolicy。
- 内容移出目录后历史记录保留，课程当前聚合按新目录计算；目录改名/重排不改变学习 key 和内容游标。

### 4. 导航与播放器

- 课程卡片：标题、封面、课节数与可用摘要；多课课程主操作“查看课程”，进入 decks.html?course=<courseId>。
- 目录路由可刷新、可分享该入口、支持浏览器前进/后退；课程不存在显示可返回的缺失态。
- 目录采用章/主题下紧凑课节行，不再把 65 个场景画成 65 张大封面卡。延续已有克制字号和封面灰色蒙层；PC hover 恢复色彩。
- 单课课程列表可提供“开始”；多课目录的每一课节提供“开始”，点击后解析 contentRef。
- 句子入口为 main.html?course=<courseId>&lesson=<lessonId>；由 main 的实际入口解析当前账号目录并找到完整单元身份，再交给现有 startDeck/ContentRepo 加载。不通过 URL 接受题目数组或任意资源 URL。
- 图文启动沿用 courses.html?id=<packageId>，附加可选 catalogCourse / catalogLesson 供返回目录；courses.html 与 course-package.js 只接入受限目录返回链接，播放流程不变。
- 新显式 URL 入口优先于旧 _startDeck、pending review 和 direct。依照现有启动锁定机制只消费一次；成功认领时清理同标签页过时 _startDeck，异步启动使用现有代次/账号作用域防止迟到结果覆盖新操作。
- main 按 URL 找不到课程/课节/源内容时显示错误和返回，不默默开始另一门课程。返回导航仅允许本应用目录路径。
- 旧 _startDeck、复习临时队列、direct 和原图文 ?id= 保持现有语义；单独测试兼容，不批量替换复习协议。
- 当前首页最近练习由 ownerByContentRef 显示“课程名称 · 课节”，按课程合并入口；选最近的真实单元作为目标。该时间表示最近打开/练习入口，不冒充已完成学习。保留已有断点行为，不承诺新建跨设备课程断点。
- 单元内容管理入口仍按源类型/权限执行；退出管理后恢复所在课程目录与课节位置。

### 5. 来源、权限与版本

- origin（builtin/user/其他已验证来源）、contentRef.type 和课程层级相互独立。不能根据标题、卡片分组或导入时间推断内置/所有权。
- 内置 Course 与其源内容继续禁导出、禁改写发布内容；个人隐藏覆盖继续允许。
- 现有可编辑、可导出的用户 deck 保持已有授权语义；公开课 isPublic 不意味着内置。遇到无法确认来源的外部包，不扩大其编辑/导出权限。图文导出能力本轮不新增。
- catalog.version 根据目录内容生成；用于目录视图/聚合缓存失效。contentVersion 与现有内容游标校验语义保持，目录改名、排序不额外使内容游标归零。
- 生成静态回退 catalog 和兼容成员表时使用相同装配输入；禁止再手写一份课程清单。网络失败且无可用完整回退元数据时展示可用部分并标明目录未完整，不伪装为当前完整版本。
- 内容按需缓存策略保持；禁止课程卡片渲染调用 ensureAll，禁止为目录预载所有详情分片。

### 6. 固定文件边界与运行时接线

本轮保留 `js/content-repository.js` 内已有回退清单，没有再生成第二份 `js/content-fallback.js`。原因是该回退清单已经承担内容摘要与兼容缓存合同，新增独立生成文件会形成两份可漂移的回退源；目录部分统一由 `CourseCatalog.legacyCatalog` 从回退 manifest 派生，构建产物则直接写入 manifest.catalog。

| 文件 | 本次职责 |
| --- | --- |
| js/course-catalog.js | 从装配后的 manifest deck 元数据和高频短语构建静态目录；口语成员来自明确的源集合，并适配用户 deck / 图文包 |
| scripts/build-content.mjs | 调用目录构建器并输出 manifest.catalog 与确定性 catalog.version |
| js/content-repository.js | 优先现有 manifest 获取流程，旧 inline fallback 经 CourseCatalog 派生兼容目录；不改变既有 ensureDeck 等内容接口 |
| js/course-catalog.js、js/course-progress.js | 纯目录模型与只读统计；没有存储和网络副作用 |
| library.js | 保留旧图文筛选、导入与元数据接口；统一目录由 CourseCatalog 消费其 CL.readCourses 结果 |
| decks.html | 课程列表、目录路由、索引加载/重试、具体单元管理和入口 |
| main.html | 新 URL 启动解析、早期首屏竞争处理、最近练习按课程归属展示、返回目录 |
| courses.html、course-package.js | 旧图文包入口接入目录返回，保留播放器行为 |
| stats.html | 仅补上生成回退脚本的引用顺序；不改统计业务 |
| scripts/validate-content.mjs、package.json、sw.js | 新目录/回退一致性校验、测试接入与生成缓存 |

main.html、decks.html、stats.html 均在 content-repository.js 之前加载生成的 content-fallback.js；目录模块在需要它的 library.js/页面业务脚本之前加载。courses.html 的目录返回可验证当前包对应的确定性 package: 身份，不必为返回链接额外加载全部句子 manifest。

旧清单只缺 catalog：用生成回退的显式 ID 归属适配，并与旧清单实际可用 deck 取交集，不能捏造缺失子课。未知 catalog.schemaVersion：保留可识别的源内容为单课课程，提示目录版本暂不支持，不解析未知结构。新 catalog 存在但有坏引用：隔离相关课程并提示，不擅自套用旧目录改变其归属。

catalog.version 的 hash 输入仅为标准化课程声明，不包含 version 字段本身；回退与 manifest 使用相同结果。保持现有 contentVersion 计算和旧游标比较逻辑，保证仅改 catalog 的测试不改变 contentVersion；不为本次重构修正所有历史内容版本策略。

### 7. 页面状态与竞态

- decks 路由统一为列表态或 course 目录态；内部切换用 URLSearchParams / history.pushState，popstate 只渲染而不再次 push。退出管理/详解保留父课程和选中课节；不删除已有无关 query 参数。
- 根列表先显示 manifest 摘要和已有可用投影，不主动取全部课程索引；课程目录才取该课程索引，并发上限 4。离开目录、切账号或接收更新后，以加载代次及账号作用域丢弃迟到结果；索引失败只影响摘要。
- main.paintLocalHome 当前在 180ms 或 CL.preload 完成后可显示默认首页。检测到新 course/lesson URL 时先显示“正在打开课程”及返回按钮，不暴露一个可抢走显式入口的默认首页；只在依赖就绪且用户未取消时解析并启动。
- pending / resolved / cancelled 是页面内入口状态，不写账号数据。显式返回或导航使 pending 失效。缺参数、未知课程、源加载失败均显示可退出状态；失败不回落到第一门课。
- 启动复用现有 bootMain/decideEntry 和 _mainEntryClaimed，认领新入口前完成其所需初始化；不能在初始化开始就置 _mainEntryClaimed 导致整个必要初始化被跳过，也不能启动后再次决定默认入口。不新增第二条并行启动流程。
- 加载长时间未完成时返回按钮一直可用；超过 10 秒呈现“加载时间较长”及重试操作。重试使上次请求结果失效，不清理用户存储。此局部等待状态不改变全局云同步协议。
- 新 URL 一次加载内只认领一次；浏览器刷新是新的显式进入，可沿用单元既有断点语义。退出到首页时清理当前练习 route，避免刷新首页又自动拉回练习；课程返回操作恢复原目录。
- 目录视图内“已练/已熟/到期”来自同一时刻和同一 mem 快照。CL.memExternal 更新时重新取得当前账号视图，重建投影；目录更名或排序无学习写入。

## Implementation steps

- [x] 1. 新增 js/course-catalog.js 与 course-catalog.test.js，验证统一 Course、嵌套目录、源引用、单课/多课、图文包和旧格式适配；生产列表不再依赖中文名称正则归类。
- [x] 2. scripts/build-content.mjs 接入课程声明生成；输出 manifest.catalog / catalog.version；scripts/validate-content.mjs 增加目录引用、覆盖与版本校验。未改变原 deck 拆分。
- [x] 3. js/content-repository.js 接入新增清单字段和兼容回退；目录模型消费现有 CL 来源 API。library.js 原始图文数据保持不变，图文包通过统一模型建立单课视图。
- [x] 4. 新增 js/course-progress.js、course-progress.test.js，落实成员校验、隐藏、去重、内容类型分离与未知状态；首页按同一归属模型合并最近练习。
- [x] 5. decks.html 接通课程卡片和 ?course= 目录；数量区分课程/课节/条目；内置课程不显示导出，用户 deck 的管理与导出保持可用。
- [x] 6. main.html 接通 URL 引用启动、最近练习课程归属；course-package.js 接通带 catalogCourse 的返回目录。保留旧协议和现有启动锁，不引入新的持久化状态。
- [x] 7. 新增 e2e/course-catalog.test.js 验证真实 UI 导航/练习；接入 package.json，生成 sw.js 并完成回归。
- [x] 8. 已记录生成结果、残余限制与验证结论；本轮未提交、未部署。
- [x] 9. 课程卡片接入 CourseProgress：无学习记录显示未开始；有记录时按轻量索引计算覆盖率和待复习数；图文课程不显示句子进度。
- [x] 10. e2e 增加真实图文课程 fixture，验证统一课程卡 → courses.html 播放器 → 统一课节目录返回；同时覆盖按需加载后的句子课程启动等待。
- [x] 11. 图文课程标签改为消费统一 CourseCatalog 卡片列表；句子课程标签不再重复显示图文课程，保留图文包导入入口与旧删除兼容刷新。
- [x] 12. 将逻辑课程身份移入用户账号域：新增 `LogicalCourseStore`，用户创建时填写名称并上传封面；系统不再预置“新概念英语第一册”或 143 个计划课节。
- [x] 13. 导入图文 ZIP 时显式选择“新建逻辑课程 / 导入到已有逻辑课程 / 独立课节”，以 `logicalCourseId` 建立关系；未绑定包保持独立，不按 `metadata.catalog` 自动归并，目录只显示实际已导入课节。

## Validation

规划评审只做读取和文档检查。以下命令在实现后执行；浏览器回归使用隔离账号/临时数据库，不能往用户会话写测试答题。

生成链路：需要装配缺失产物或全链验证时运行 npm run content:assemble（顺序为 gen-oral-book、gen-builtins-stub、build-content、gen-sw）；仅重建 manifest 用 npm run content:build。重建前检查生成脚本删除目标仅在指定 content 产物目录，变更后核对现有 deck/cid/分片 hash 未意外改变。

必须验证：
- [x] node course-catalog.test.js；node course-progress.test.js（新增）。
- [x] node scripts/validate-content.mjs；node scripts/check-deploy-files.js。
- [x] node e2e/course-catalog.test.js（新增真实跨页测试）。
- [x] node book-deck-migration.test.js；node stats-consistency.test.js；node course-storage.test.js（包含于 npm test）。
- [x] node course-resume.test.js；图文返回路径接入并保留原播放器合同（包含于 npm test）。
- [x] node e2e/main-startup.test.js；node e2e/progress-coverage.test.js；node e2e/exit-clears-choices.test.js（包含于 npm test）。
- [x] 生成一致性：连续构建 manifest hash 相同；manifest catalog/version/成员通过校验。
- [x] 新入口在延迟配置/启动条件下保持旧启动锁；显式 URL 课节只启动一次，未新增持久化状态。
- [x] e2e 使用 free-port、CHUNKLAB_DATA_DIR 临时服务及隔离浏览器；目录 UI 检查全量 65 课节，不在真实账号生成测试记录。
- [x] 图文课程 e2e 使用临时课程包和临时数据库，验证 package: 身份、播放器标题、返回课程目录及不误算句子进度。
- [x] 课程卡片进度 e2e 验证无记录为“尚未开始学习”，注入一条真实 cid 记录后显示“已覆盖 1 / 3259 句 · 0%”。
- [x] 句子/图文标签 e2e 验证内容类型隔离：图文课程只在图文标签出现，导入/播放器返回仍可回到统一课程目录。
- [x] e2e 验证系统不预置新概念课程；用户创建逻辑课程并绑定一个图文包后，卡片使用用户封面，目录只显示 1 个实际课节，教材元数据不会绕过显式绑定自动归并。
- [ ] 完整 npm test：已完成针对性课程目录、图文课程和统计页回归；全量运行仍观察到 stats-index 的偶发时序断言抖动，单独重跑通过，需后续独立稳定化。
- [x] 最终资源修改后 node scripts/gen-sw.js；node scripts/check-sw.js；git diff --check。
- [x] 未新增 core 写入、同步或身份迁移逻辑；原 deckId#cid 身份保持。

## Acceptance criteria

- [x] 当前完整内置清单只提供两门句子课程：口语3000句和高频短语；图文逻辑课程由用户创建后才出现。口语目录覆盖当前 65 个课节、3259 条发布内容。数字由输入推导，未硬编码。
- [x] 自建句子课程与用户逻辑图文课程均有稳定 Course 身份；单课/多课使用同一模型，旧 lib 和教材元数据不造成包被误合并。
- [x] 正式 catalog 不通过名称识别口语；目录课节引用原 deckId，历史 cid 继续保持。
- [x] 浏览器打开课程、选择课节、开始、返回、刷新和后退路径通过；旧练习、复习队列和图文播放器合同保持。
- [x] 新练习从 URL 解析并写回原 deckId#cid；首次进入目录不写学习记录，也未新增持久化 intent。
- [x] 课程条目统计口径由 CourseProgress 纯函数测试覆盖：有效成员、重复练习去重、隐藏项、未就绪索引和零分母均有明确结果。
- [x] 课程卡片显示可解释的初始/进度状态；只有句子课程显示覆盖率，图文课程仍由图文播放器自己的节点进度负责。
- [x] 内容详情仍按需加载，课程卡片只读 manifest 摘要；图文课程单独保持 story 类型，不转成句子掌握率。
- [x] 首页最近练习按课程合并并保留具体课节；内置导出禁止，自建课程导出保持；标题与权限解耦。
- [x] 旧 manifest 缺 catalog 可适配；未知 catalog 版本降级到兼容目录；坏句子引用隔离为不可用课程而非白屏。
- [x] 未新增非预期产品文件、用户数据或内容正文变化；没有提交、推送或部署。

## Risks and rollback

- 目录归属与统计身份必须分开：所有练习写入仍由具体源 ID 决定。保留现有存储使目录适配可独立回滚。
- 首期 Lesson 与 ContentUnit 是 1:1 适配。将来按教学目标重新拆课时，需要另行设计稳定题目引用与进度规则；本次模型提供边界，不提前实现多对多。
- 课程跨设备“继续到第几课”未新增持久化；本轮仅沿用既有已同步学习事实/本地断点，不声称解决所有历史同步问题。
- 旧回退清单可能不完整，必须显式暴露可用性，不能显示假总数或给不存在内容的启动入口。
- 仅撤回本轮目录/导航/只读投影及生成产物增量，重新生成缓存；任何时候不删除旧存档或重写历史身份。

## Execution notes

执行已完成。已落地统一 Course / outline / contentRef、口语3000句单卡目录、用户创建逻辑图文课程、图文包显式绑定、无绑定包独立展示、句子/图文标签隔离、URL 课节启动、首页最近练习课程归属、课程卡片进度投影、manifest 目录声明和回退兼容。新增真实逻辑课程跨页回归；针对性目录、存储、内容校验和 e2e 通过。完整 `npm test` 仍保留既有 stats-index 偶发时序断言抖动，单独重跑通过。按用户要求本轮未提交、未部署。
