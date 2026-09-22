# 重复实现清理清单（小范围 · 可验收）

- Status: **executed（D-1 + D-2 已实施，回归已跑）**
- Updated: 2026-09-22
- Branch/worktree: master / `D:/06-project/chunk-practice`
- 基线：`92e810d`（候选版本收口）之后、`f5219ef`（WebP + 部署修复）之上
- 依据：本轮读码核实（行号为当前工作区实测）+ 外部评价两轮对账（结论与更正已存 `.workbuddy/memory/eng-rules.md`）
- 执行边界：**不做**同步协议/数据模型改造、**不做**部署与任何生产动作、**不做** `PRECACHE_SOFT` 自动化

## Objective

把「同一判据的手写重复实现」收敛到**唯一实现**，并让「重复已消失、且缺失时会明确报错」这件事**由行为级测试证明**，而不是由文件数量或估算证明。

## 一、范围：三层分类（附读码证据）

| 编号 | 位置 | 重复性质 | 会漂移吗 | 本轮是否清 |
|---|---|---|---|---|
| **D-1** | `core.js:1275` `statSig` 内联体 / `core.js:1297` `evSnapOf` 内联体 ↔ `src/core/stats-signature.mjs` | **手写逐字重复**（常量 `0x01000193`/`0x811c9dc5`、字段序与源一致；但写法独立） | **会**（手写、两边各自演进） | ✅ 清（低风险） |
| **D-2** | `core.js:1405-1413`（businessMeta 投影）+ `:1444-1452`（签名/脏句/消失句）+ `:1458-1466`（三锚点追加判定），全包在 `if(!plan)` 里 | **手写同构分支** —— 是**判据重复，不是函数重复**（`buildStatsPersistencePlan` 全库只有一份：`js/core-storage-state.js:96`，`core.js:1393` 只调用） | **会** + **零测试覆盖** + fail-open | ✅ 清（高风险，最后做） |
| **D-3** | `js/core-stats-signature.js:3-41` ↔ `js/core-sync-delta.js:3-41` | **构建产物重复**：同一次 `npm run build` 从**同一源**生成（实测两段**逐字相同 = true**，各 39 行） | **不会**（同源同次构建，一起重生成） | ❌ **移出清单**（仅体积成本） |

### ⚠️ 本表的更正记录（保留原话，避免下次再抄旧判断）

| 我先前说过 | 核实结果 |
|---|---|
| 「删 `core.js` 里**内联的第二份 `buildStatsPersistencePlan`**」 | 措辞不准：函数只有一份，`core.js` 留的是 **`if(!plan)` 同构分支**（D-2）。实质（重复判据）成立 |
| 把 D-3 与 D-1 并成一类「同一事实多份实现」 | 严重度定高：D-3 是**产物**重复、**不可能漂移**；D-1 是**手写**重复、**会漂移**。两者修法不同 |
| 「`PRECACHE_SOFT` 改由 `gen-sw` 生成」 | 表述像陈述现状，实际是提案。现状 = **手写**在 `sw.js:139`；`gen-sw.js:29/32/44` 只读取 + 参与哈希 |
| 「chunk 段数判据 fan-out 12」 | 错：`js/chunk-shape.js` 是**唯一实现**且有跨仓库散落检查（`chunk-shape.test.js:115-150`）。「曾散落 7 处」是 09-15 的**历史**，已修 |

**为什么不该把 D-3 塞进本轮**：esbuild 全部是独立 `format:'iife'` 构建（`scripts/build-app.mjs`，19 个 entry，**无 `splitting`**）⇒ "共享 chunk" 这条路在 IIFE 下不存在；而它又不漂移。**留作待办，只记体积成本。**

## 二、前置：先补两条行为级用例（不做完这步，不许动 D-2）

新建 `e2e/core-module-contract.test.js`（`scripts/test-manifest.cjs` 的 `walk()` 按 glob **自动纳入 browser 组**，无需手工登记）。

**先例（照抄形态）**：`e2e/chunk-intro.test.js:101-102` / `e2e/daily-goal.test.js:136-137` 已有
`await page.route('**/api/**', r => r.abort('failed'))` 这种按 URL 阻断的写法。

### 用例 A（修复前必须红 → 修复后必须绿）
- 手法：`page.route('**/js/core-stats-signature.js', r => r.abort('failed'))`（再同样阻断 `**/js/core-storage-state.js`），进 `main.html`。
- **断言的是"真实运行行为"，不是"文件在不在"**（静态断言 ≠ 行为断言 —— 这是 `course-catalog` 只断言 `src` 属性、图片 404 仍绿的同一类错）：
  1. 页面出现**用户可见**的错误提示（复用项目现有 `emit('persistError')` → 界面提示通道）；
  2. **不得**出现「答题被静默接受、界面一切正常」的降级行为；
  3. 明确不接受「只有 `console.error`」作为通过判据（用户看不到的失败 = 静默失败）。

### 用例 B（必须始终绿 —— 防误杀）
- 手法：**不**阻断模块，改用 **IDB 不可用**条件（`_statsStore === 'local'` 路径，`core.js:1391` 会提前 `return false`）。
- 断言：**仍然正常工作**（localStorage 托管、无错误提示、答题记录不丢）。
- ⚠️ **A 与 B 必须是两条判据**：两者的条件在 `core.js:1391` 就分流；若共用判据，B 会把「隐私模式可用」这条**受支持降级**一起测红。

### 负向自证（证明 A 不是恒红）
去掉 A 的 `route` 阻断 → A 必须**变绿**；恢复阻断 → **变红**。

### 落地细节（否则"明确报错"会被吞掉）
`saveMem` 整段包在 `try/catch`（`core.js:804-840`）里，catch 只做 `console.error + emit('persistError') + return false`。
⇒ 若只在调用点断言，异常会被吞成"一次保存失败"，**不构成用户可见失败**。
⇒ 断言必须放在**页面加载期**（建议 `core.js` IIFE 初始化段，与 `_statsStore`/`_bsSig` 声明同区，约 `:925-930`）：模块缺失即**立刻**进入可见失败态，而不是等第一次保存。

## 三、D-1 执行步骤（低风险，先做）

1. `core.js:1275-1290` 改为单行委派：`function statSig(v){ return CoreStatsSignature.statSig(v); }` —— **删除内联体**（不保留后备）。
2. `core.js:1297-1305` 同法：`function evSnapOf(ev){ return CoreStatsSignature.eventSnapshot(ev); }`。
3. 影响面（调用点，改完必须逐一自查）：
   - `statSig`：`:1081`（迁移建基线）、`:1421`（全量重写）、`:1447`（无 plan 分支）、`:1395`（作为参数传给 `buildStatsPersistencePlan`）；
   - `evSnapOf`：`:1082`（迁移建基线）、`:1422`、`:1477`（`plannedEventSnapshot`）。
4. 验证：`node scripts/run-tests.cjs unit server checks`（87 项）＋ 新 e2e 绿。
5. 回退：`core.js` 是**手写文件、非构建产物**（`scripts/build-app.mjs` 不生成它；`pretest` 只重写 `sw.js`/`builtins.js`/schema validator）⇒ 单提交 `git revert` 即可。

## 四、D-2 执行步骤（高风险，最后做）

1. 前置：A/B 两条用例已绿（第二节）。
2. 删三条内联分支：`:1405-1413`、`:1444-1452`、`:1458-1466`；`plan` 缺失时改为**与 A 同一口径的可见失败**。
3. **保留** `:1391` 的 `if(_statsStore !== 'idb' || !global.IDBStore) return Promise.resolve(false);` —— 这是**受支持降级**，不在清理范围。
4. 验证：非浏览器 87 项 ＋ `e2e/mobile-8000.test.js` ＋ 新 e2e ＋ `build:check` ＋ `check-deploy-files.js`。

## 五、顺带补的真缺口（A1 遗留护栏）

`e2e/mobile-8000.test.js:104-118` 的 100 次保存是**同步 for 循环** ⇒ 100 条事件在首次 plan 前就 push 完，
**造不出「固定首批 → 再追加」的交错**，A1 再被改坏也不会报红。
**补一条门闩式回归**：固定首批 → 等 IDB 在飞 → 再追加一条 → 断言第二批 `eventRows` 非空 **且** IDB 事件数 == 内存事件数。
（判据可直接取自 `.workbuddy/_audit/a1-head-vs-old.mjs` 的模型：旧序丢 `[e3]`、HEAD 序丢 `[]`。）

## 六、验收标准（不用任何数字）

1. **单一实现**：`grep -n "function statSig\|function eventSnapshot"` 只命中唯一实现处；`core.js` 只剩委派与断言。
2. **负向自证**：A 用例修复前红、修复后绿；去掉 `route` 阻断后 A 仍绿（证明非恒红）；B 用例始终绿。
3. **线上行为验证**：部署后按既有 5 条判据复核（`CACHE` / 资源 200+webp+字节数 / SW 装得上 140 条 / 封面破图 0 / 旧缓存不遮蔽），本条不改资源，重点看 `pageerror = 0`。
4. **回归**：非浏览器 87 项 + 新 e2e 全绿；`build:check` 绿；`check-deploy-files.js` 绿。

## 七、明确不在范围内（本轮不做）

- 同步协议、数据模型、SQLite/IndexedDB schema；
- `PRECACHE_SOFT` 自动化（**先定唯一来源**：课程包 manifest / 课程目录 / 资源目录；否则只是把"手工重复"换成"生成逻辑重复"）；
- **D-3**（产物体积，不漂移）；
- 服务端权威 + 幂等 upsert 架构改造（上线后另立项）；
- 部署、推送、任何生产动作。

## 八、执行顺序

1. 先完成**当前部署修复与线上验收**（未获授权则不动）；
2. 补 A/B 两条行为级用例 + 负向自证；
3. 做 D-1（低风险）并全量回归；
4. 做 D-2（高风险）并全量回归；
5. 补 A1 门闩式回归；
6. 按第六节验收。

## 九、执行记录（2026-09-22 晚）+ **计划自身的更正**

### 9.1 计划里两条**不成立的前提**（动手前读码推翻）

| 计划原文 | 核实结果 |
|---|---|
| 「复用项目现有 `emit('persistError')` → **界面提示通道**」 | ❌ **该通道不存在**。全库只有 1 处订阅（`course-storage.test.js:38`，测试）；四个页面**没有任何** `persistError` 监听 ⇒ 它只是诊断事件，**用户看不到**（`grep` 全库 17 处全是 `emit`，0 处 `on`） |
| 断言「用户可见的错误提示」可直接复用现有页面元素 | ❌ 只有 `main.html` 有 `#bootScreen` / `window.onerror`；`#zh` 在 `#pagePractice` **内部**（首页隐藏）；`decks/stats/courses` **三者都没有任何可见错误面**（grep 0 命中） |

⇒ 计划里「复用现有可见通道」**不可能实现**，必须新建一个**页面无关**的可见失败面。按最小代价在 `core.js` 实现：

- `coreFatalSurface(text)`：向 `document.body` 注入**单层** `<div id="coreFatal" role="alert">`（浅底红字横幅，无图标、无依赖、内部异常静默）；只在致命时出现。
- **受约束**：只用单层节点 + 直接属性赋值（`el.id` / `el.textContent` / `el.style.cssText` + `document.body.appendChild`）。
  原因：单测 harness 的 `document` 桩只实现了 `getElementById/createElement/body.appendChild`；
  用 `setAttribute` 或嵌套 `appendChild` 会让 `book-deck-migration.test.js` / `stats-idb.test.js` 直接抛错。
- 同时在加载期写 `window.__coreModuleFatal = { missing, at }`，供行为级断言定位「缺的是哪个模块」。

### 9.2 另一条更正：A1 门闩回归**本来就有**，我先前说「要补」是没读码

本计划 §五 写「需补一条门闩式回归」，暗示现有测试覆盖不到 A1 交错。**读码后推翻**：
`e2e/stats-idb.test.js:189-234` **已存在**「受控交错」用例 —— 劫持 `IDBStore.writeStatsBatch` 把**第一次**调用挂在
gate 上 → `await firstStarted` → 再 push 一条事件 → 第二次 `saveMem` → 放行 → 断言两条事件都在 IDB。
它正好覆盖旧实现（`a2de8e2`）的失效形态（水位虚高 → 下一批切片为空 → 静默丢事件），**不是空转**。
⇒ 本轮**只增强、不新建重复用例**：补一条 `count === memCount`（IDB 事件数 == 内存事件数），把水位不变量写成显式等式。

⚠️ 这是本轮**第二次**犯「没读码就断言某测试不存在」——与上一轮我批评旧记录时犯的是同一个错，已记入教训。

### 9.3 D-1 等价性自证（不靠"看着一样"）

`.workbuddy/_audit/d1-delegate-equivalence.cjs`：把**已删除的内联体逐字重抄**为历史基准，与唯一实现比对
**20014 条 statSig + 2009 条 eventSnapshot**（含 20000/2000 随机 + 5000 元素大数组）⇒ **不一致 = 0**。
意义：签名格式未变 ⇒ 上线**不会**因 `_bsSig` 全面失配而触发一次性全量重写（8000 句 ≈ 数 MB）。

### 9.4 闸的判据从「模块在不在」升级为「用到的函数在不在」

只判对象存在会漏掉 **SW 缓存半更新**（新 `core.js` + 旧模块）：模块在、函数缺 ⇒ 调用点 TypeError 被
`saveMem` 的 try/catch 吞成「一次保存失败」，还是静默失败。现按**实际用到的函数名**判定：
`CoreStatsSignature.{statSig,eventSnapshot}`、`CoreStorageState.{buildStatsPersistencePlan,buildStatsBusinessMeta}`，
版本错配与整文件缺失走**同一条**可见失败路径。

### 9.5 连带修掉 3 处 harness 不忠实（同一根因）

core.js 新增必需依赖后，**只加载 core.js 的合成测试页面**会（正确地）被判为加载失败。三处补齐依赖：

- `stats-idb.test.js`（根目录单测）：注入**真实构建产物**（`new Function('window','globalThis', src)(window, window)`），不用手写 stub —— stub 会与源漂移，正是本次清理要消除的问题；
- `e2e/account-isolation.test.js`、`e2e/sync-outbox.test.js`：改走新增的 **`e2e/lib/core-deps.js`**（单一来源，避免这份清单一处处漂移）。

### 9.6 验收结果（本轮自定门槛 + 逐条达标）

| 判据 | 状态 |
|---|---|
| 单一实现 | ✅ `core.js` 只剩 `statSig`/`evSnapOf` 两行委派 + 加载期闸；`grep 'if(!plan)'` 仅命中注释；`_mix` 已删 |
| 负向自证 | ✅ A0（不阻断 → 无信号）绿；A1/A2 **修复前红**（含「阻断真的生效」正向对照）→ **修复后绿**；B 始终绿 |
| A/B 判据分离 | ✅ `e2e/core-module-contract.test.js` **12/12**；B 以 `statsStoreMode()==='local'` 区分受支持降级，未被误杀 |
| 回归 | ✅ 非浏览器 **87/87**；浏览器 **36/36**（共 **123/123**） |
| 构建/部署一致性 | ✅ `build:check`「generated output matches source」；`check-deploy-files` 全绿；`check-sw` CACHE 一致 |
| 线上行为验证 | ⏸ **未做** —— 需部署（外部动作，等明确指令） |

### 9.7 附带发现（**登记为待办，本轮未动**）

同一个 `CoreStorageState` 里还有**两处同形 fail-open 分支**（`plan ? … : …`），性质与 D-2 完全相同：
`core.js` 的 `buildCourseProgressWritePlan` 调用点（3 处）与 `buildBusinessProjection` 调用点（1 处 + 1 处反向回退）。
本轮范围只声明了 stats 这一条，故**不改**，但必须登记 —— 否则下次又会有人以为「已经清干净了」。

### 9.8 `sw.js` 必须重生成（已做）

`core.js` 在原子 PRECACHE 里、其内容计入 `CACHE` 版本 ⇒ 改 `core.js` 后必须重跑 `gen-sw.js`（本次结果 `chunklab-6066d9f0`）。
**没重跑时 `sw-policy.test.js` 会红**，别误判成回归（本次实测踩到：`chunklab-5b6fbce9` vs 期望 `chunklab-8622be91`）。

