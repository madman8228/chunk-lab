# 首页改版 · 增量架构设计与任务分解

> 文档类型：**增量架构设计 + 任务分解**（只描述相对现状的改动，不重复既有设计）
> 作者：高见远（架构师）
> 日期：2026-09-25
> 上游：`docs/implementation/2026-09-25-home-redesign-prd.md`（许清楚）
> 落点：`main.html` 的 `renderHome()` 与对应 CSS；同步更新 2 个 e2e 文件
> 严格约束：只改首页渲染与对应 CSS，**不改数据层、不改 `core.js` 口径、不改子页面**

---

## 0. 一句话总览

本次是一次**「零新增数据结构、零新增业务逻辑」的纯渲染层重构**：

- **新增** 3 个区块（续学条、`+ 添加课程`、`#homeGoalPill` 目标药丸），**改造** 3 个区块（我的课程行、计数区→药丸行、打卡行**维持现状**）。
- 所有取数**复用既有函数**（`resume` / `recent` / `deckLearningProgress` / `CL.masteredSentenceCount` / `CL.streakDays` / `CL.dailyActivity`），**不新增任何 `mem.*` 字段、不新增第二套实现**。首页课程行新增 `homeCourseProgressMarkup` 仅做**文案替换**（`已学 N 句`），**`deckProgressMarkup` 本体不动**。
- 变更集中在 `main.html` 的 3 处：**`renderHome()`（行 4179–4405）**、**首页 CSS（行 786–896）**、**`js/icons.js` 新增 1 个 `plus` 图标**。
- 因为 `main.html` 与 `js/icons.js` 在 `sw.js` 的 `PRECACHE` 中 ⇒ 改完必须跑 `node scripts/gen-sw.js`。
- **必须同步更新 4 个 e2e 文件**（`home-today-entries.test.js`、`e2e.js`、`progress-coverage.test.js`、`deck-progress-diagnostic.test.js`），否则场景 E/G 与 3 处进度文案断言会变红。
- **三项待明确已全部由老板裁决**（首页专用 `已学 N 句` / 打卡行只留 `本月打卡 M 天` / `#homeGoalPill` 与 `.home-goal` 并存）。

---

## 1. 实现方案（逐区块）

### 目标布局顺序（设计稿）

```
顶部行(现有,不改) → 续学条(新增) → 我的课程(改造) → + 添加课程(新增) → 今天要做药丸行(改造) → 打卡行(改造)
```

### 1.1 顶部行 —— **保留，不改**

`main.html:1216–1226` 的 `.topbar`（`.brand` + `#syncBadge`）已在 `#homeBody` 上方，天然满足 R1。**本任务不碰编译期 HTML**，只确认位置即可（PRD §3.1 R1 已声明「确认项、不新造」）。

### 1.2 续学条 —— **新增**（R2）

- **位置**：取代/紧随 `.home-hero`（行 4245–4247）。设计稿要「续学条」在顶部行下方第一屏，而 `.home-hero`（日期 + 连续天数）当前是 `#homeBody` 第一个元素。
- **决策**：**保留 `.home-hero` 作为 `.home-body` 第一个子元素**（e2e 场景 E 断言 `heroFirst === true` 且 `streakOutsideHero === false`，见 §5 影响面），**在 `.home-hero` 之后插入续学条**。这样布局为：`hero(日期+连续天数) → 续学条 → 我的课程 → …`，仍满足「顶部行 → 续学条 → …」的语义顺序（hero 属于顶部行的一部分）。
- **渲染条件**：仅当 `hasEver && resume` 时渲染（无续学目标时不出空条）。
- **DOM 结构建议**（整行是一个真实 `<button>`，天然可键盘聚焦 + 原生按钮语义，符合 R3 对「可聚焦」的同类要求）：

```html
<button type="button" class="home-resume" id="homeResumeRow"
        data-start="<deckId>" data-idx="<resume.idx>"
        aria-label="继续 <课程名> 第 N 课">
  <span class="hr-play">…Icons.svg('play')…</span>
  <span class="hr-text">
    <span class="hr-k">继续</span>
    <span class="hr-nm">口语 3000 句</span>
    <span class="hr-sub">第 4 课</span>
  </span>
  <span class="chev">…Icons.svg('chevR')…</span>
</button>
```

- **文案**：`继续 · <课程/课节名> · <第 N 课>`；`sub` 段（`第 N 课`）在无课节信息时可省略。
- **取数**：完全复用现有 `resume`（行 4192–4206）与 `contextByDeckId[resume.deck.id].label`，**不新增取数**。
- **点击行为**：复用现有 `[data-start]` / `[data-idx]` 事件委托（行 4372–4380 那套），不新造事件机制。
- **去重（Q5 已确认）**：`recent` 的过滤（行 4212–4216）已排除 `resume.deck.id` 及其同课程的其他 deck ⇒ 续学条那门课**不会在课程列表重复出现**，无需额外处理。

### 1.3 我的课程 —— **改造**（R3）

标题行改动：
- 左：`Icons.svg('book') + 我的课程`（保留）。
- 右：把当前 `全部课程`（仅课程数超上限时才渲染，行 4270）**替换为常驻 `管理 ›`**，文案 `管理` + `Icons.svg('chevR')`，跳转 `decks.html`。命名沿用 `.hc-more` 语义位置，新增 `.hc-manage`。

课程行改动（`_courseRows`，行 4252–4266）：
- **去掉行尾 `<button class="btn ghost" data-start…>`**（`继续/复习/开始` 按钮整块删除）。
- **整行 `.hd-row` 变为可点**：把 `.hd-row` 由 `<div>` 改为内层真实可聚焦元素承载点击。**两种落地方案**：

  | 方案 | 结构 | 评价 |
  |---|---|---|
  | **A（推荐）** | `<button type="button" class="hd-row" data-start data-idx aria-label="继续 <课程名>">` 内部放 `<span class="grow">`（课程名 + 进度条） | 原生按钮 = 天然可聚焦 / Enter 触发 / `:disabled` 语义；只需重置 UA 样式（已有 `.htc` 的同类重置写法可抄） |
  | B | `<div class="hd-row" tabindex="0" role="button" data-start…>` + keydown 处理 Enter/Space | 要手写键盘桩；不如 A |

  **取 A**。`.hd-row` 当前已有 `display:flex;align-items:center;gap:12px`（行 851），按钮化后需补 `appearance/text-align/font/color/cursor` 重置（与 `.htc` 行 826–829 同款）。
- **行内保留**：`课程名`（`.nm`）+ `进度条` + 进度文案。
- **`已学 N 句` 文案（★ Q6 —— 老板已裁决：首页专用文案）**：
  - **裁决**：首页课程行显示设计稿的 **`已学 N 句`**；其它页面文案不动。
  - ⚠ **关键事实（已核实）**：`已覆盖 x / y 句` 由 **`deckProgressMarkup`（`main.html:4073–4091`）** 产出，纯逻辑版在 **`src/main/deck-progress.mjs:35–54`（`buildDeckProgressMarkup`）**。**但 `deckProgressMarkup` 的调用方只有 `main.html` 内的两处（行 4256、4263，均在 `renderHome`）**——`stats.html` / `decks.html` 并不调它。依赖其 `已覆盖` 文案的测试：
    - `e2e/deck-progress-diagnostic.test.js:96`（断言 `已覆盖 4 / 5 句` + `本次完成 2 句` + `title` 含「重复练习不会增加」）
    - `e2e/progress-coverage.test.js:89`（断言 `#pageHome .home-deck-progress` 含 `41 / 43` + `本次完成 2 句`）
    - `scripts/main-deck-progress.test.mjs:26`（断言 `buildDeckProgressMarkup` 产出 `/已覆盖 1 \/ 2 句/`）
  - **✅ 正确实现方式（本设计定稿，替换原 A/B/C 三选一表述）**：
    1. **`deckProgressMarkup` 函数本体与 `buildDeckProgressMarkup` 都不动** —— 保持 `已覆盖 x / y 句` 文案与全站唯一实现不变 ⇒ **`scripts/main-deck-progress.test.mjs` 必然仍绿**（它测的是函数本体）。（注意：`deck-progress-diagnostic.test.js` 读的是**首页 DOM**，不受「本体不动」保护，见下。）
    2. 首页课程行**不再直接调用 `deckProgressMarkup`**，改为渲染**只属于首页**的进度行（在本设计里即新增 `homeCourseProgressMarkup(deck, resumeIdx, best)` 局部函数，见下）。
    3. **进度条 DOM 结构与 `deckProgressMarkup` 产出的保持逐字一致**：必须有 `.home-deck-progress`（`role="progressbar"` + `aria-*`）+ `.home-deck-progress-track`（`<i style="width:P%">`）+ `.pct`；**不新造第二份进度条实现/样式**（守宪法④）。
    4. **只换文案**：把 `<span title="…">已覆盖 N / M 句</span>` 改为 `<span class="learned">已学 N 句</span>`（N = `deckLearningProgress(deck).done`）。
  - **首页专用进度行 DOM（定稿）**：
    ```html
    <div class="sub home-deck-progress" role="progressbar"
         aria-label="已学 N 句，按句子去重，覆盖 P%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="P">
      <span class="learned">已学 N 句</span>
      <span class="pct">覆盖 P%</span>
      <!-- current / last-acc / session-answered 保持与 deckProgressMarkup 同结构（可选，取值同源） -->
    </div>
    <div class="home-deck-progress-track[ done]"><i style="width:P%"></i></div>
    ```
    - 实现建议：把这段拼装抽成 `renderHome` 内的局部函数 `homeCourseProgressMarkup(deck, resumeIdx, best)`，**内部复用 `deckLearningProgress(deck)`**（不重算口径），仅覆盖文案字段。**禁止**复制 `deckProgressMarkup` 的取数逻辑；口径仍只有 `deckLearningProgress` 一份。
  - **测试影响（已定稿）= 3 个首页断言文件需同步**：`e2e/progress-coverage.test.js:89`、`e2e/deck-progress-diagnostic.test.js:96`（二者都读 `#pageHome .home-deck-progress`）、`e2e/e2e.js:669/696`（读首页 `.home-decks .sub`）。`scripts/main-deck-progress.test.mjs` **不受影响**（函数本体未动）。
  - **「文案分叉」说明**：首页 `已学 N 句` 与其它页 `已覆盖 x / y 句` 会不同，但二者**口径同源**（均 `done`）；老板已明确选择「首页专用文案」，故本设计不再视为风险，仅记录为已裁决事项。
- **交互态**：`.hd-row` 需 `cursor:pointer` + `:hover` 背景反馈 + `:focus-visible` 焦点环 + `:active`。

### 1.4 `+ 添加课程` —— **新增**（R4）

- **位置**：`.home-courses` 卡片内，`.home-decks` 之后（列表底部）。
- **DOM**：

```html
<button type="button" class="home-add-course" id="homeAddCourse">
  <span class="hac-ico">…Icons.svg('plus')…</span>添加课程
</button>
```

- **图标（★ 宪法约束）**：`Icons` **当前无 `plus`**（已核实 `js/icons.js` defs）。两条路：
  - **推荐**：在 `js/icons.js` 的 `defs` 新增 `plus: '<path d="M12 5v14"/><path d="M5 12h14"/>'`（24×24 stroke 风格，与 `close` 同源，天然合规）。调用方 `Icons.svg('plus')`。**1 行改动，风险最低，语义最准。**
  - 备选：复用现有 `import`（下箭头入盒）或 `puzzle`——语义略偏（`import` 表「导入」而非「添加」）。
  - **禁止**：直接写字符 `+` 或 emoji（宪法明令）。
- **点击行为**：**复用现有导入入口**（跳 `decks.html`，与 `#homeGoDecks` / `.brand` 同一落点）。若导入有专用入口，则复用之；本设计取「跳 `decks.html`（课程管理页做导入）」，与 `管理 ›` 一致，避免在首页内联导入 UI（超范围）。
- **样式**：整行、居中、`border:1px dashed var(--border)`、文字 `var(--accent)`。

### 1.5 今天要做 → 药丸行 —— **改造**（R5/R6，★ 核心）

- **保留** `.home-today-card` 容器与 `#homeBody` 内的位置（e2e 场景 F 断言「课程卡在今日卡之前」用 `.home-today-card` 定位，行 576；场景 E 也用它定位，行 466）。**容器 class 与 id 全部保留**。
- **分区标题**：在卡内加一行 `今天要做`（`<div class="hc-title">`），与 `我的课程` 同层级（R13）。
  - ⚠ e2e 场景 E 断言 `hasTitleInCard === false`（卡内不能有 `.hc-title`，行 496/540）。**此断言必须随形态更新**（见 §5.2）。新契约应为「今日卡标题文案 == 今天要做」。
- **药丸行 DOM**（**四枚并列**，老板已裁决）：

```html
<div class="home-today-counts">
  <button class="home-pill due" type="button" id="homeBtnDue" [disabled] aria-label="开始到期复习，N 句">
    <span class="pill-n">12</span><span class="pill-k">待复习</span>…chev…
  </button>
  <button class="home-pill book" type="button" id="homeBtnBook" [disabled] aria-label="复习错题本，N 句">
    <span class="pill-n">3</span><span class="pill-k">错题本</span>…chev…
  </button>
  <div class="home-pill mastered" id="homeMastered">
    <span class="pill-n">5</span><span class="pill-k">已熟练</span>
  </div>
  <div class="home-pill goal" id="homeGoalPill">
    <span class="pill-n">3/20</span><span class="pill-k">目标</span>
  </div>
</div>
```

- **顺序（硬约束）**：`待复习(蓝) · 错题本(粉) · 已熟练(绿) · 目标(灰)`。**已熟练紧邻错题本右侧**（历史要求）。
- **可点性**：
  - `待复习` → `#homeBtnDue`，`t.due>0` 可点，`===0` 时 `disabled` + 置灰（**保留现有 disabled 语义与 `--surface` 去底色写法**）。
  - `错题本` → `#homeBtnBook`，`t.book>0` 可点，同上。
  - `已熟练` → `#homeMastered`，**`<div>` 仅报数**，非 `a/button`、无 `.chev`（沿用现有 G2 契约）。
  - `目标` → **仅报数** `<div>`。数据 = `_goal>0 ? _todayAnswered + '/' + _goal : '—'`（复用行 4310–4312 已算的 `_goal` / `_todayAnswered`）。**未设目标时的降级**见 R12：不设目标 → 该药丸显示 `今日 N 句` 或直接不渲染（建议：`_goal>0` 才渲染，否则不渲染，与 `.home-goal` 存在性契约解耦）。
- **已熟练数字（★ 宪法 R6）**：**必须** `CL.masteredSentenceCount(mem)`（core.js 行 3431），**不得自算**。现有代码行 4292 已在算，直接复用。
- **`#homeMastered` 内部选择器变更**：从 `.v/.k` 改为 `.pill-n/.pill-k`（或**保留 `.v/.k` 别名**以降低 e2e 改动面，见 §5.2 决策）。
- **`#homeMastered` 必须是 `.home-today-counts` 的前倒数/末位元素**：现有 G1 断言 `isLastChild === true`（行 672）。四枚并列后「已熟练」**不再是最后一个**（`目标` 在其右）⇒ **G1 断言必须更新**为「已熟练排在错题本右侧 + 目标在其右」或改为「按 class 定位 `.home-pill.mastered`」。
- **原 `.home-today-mark` 与 `.htc` 大卡 CSS 全部废弃**（行 786–796、826–844），由 `.home-pill` 取代。

### 1.6 打卡行 —— **改造**（R7，★ 老板已裁决：只留月打卡）

- `.home-cal` / `.cal-sum` / `.cal-panel` / `.cal-grid` 结构**全部保留**（唯一一份日历实现）。
- **裁决**：打卡行文案定为 **`本月打卡 M 天`**（**不含**连续天数）；`展开 ›` 保留。
  - 即：`.cal-sum` 文案**保持现状语义**（`本月打卡 N 天`），**不做「连续 · 本月打卡」合并**（该合并方案作废）。
  - `本月打卡 N 天` 复用已算的 `_monthDays`（行 4351–4355），**无新增取数**。
  - 保留 `#homeCalToggle`、`aria-expanded`、`#homeCalPanel`、`aria-controls`（场景 F 契约，行 586/599/614）。
- **连续天数只保留一处**：`.home-hero` 的 `cal-streak`（行 4244）**保持不动** —— 它是 e2e 场景 E `streakOutsideHero` 与 E2 的核心锚点，不可删、不可移动。
- **净效果**：本区块相对现状**几乎零改动**（文案维持 `本月打卡 N 天`），仅需确认未被其它改动误伤。

---

## 2. CSS 方案

### 2.1 药丸行 `.home-pill`（取代 `.home-today-counts` 的 3 列大卡）

**容器**（改造行 791）：
```css
.home-today-counts{display:flex;flex-wrap:wrap;gap:8px;margin:0;align-items:center}
```
- 由 `grid` 3 列 → `flex` 横排、`flex-wrap:wrap`（满足 R10 移动端可换行、不溢出）。**不再 `1fr` 等分**，宽度随内容。

**药丸基类（含触控目标的几何方案，见下）**：
```css
.home-pill{
  appearance:none;-webkit-appearance:none;font-family:inherit;color:inherit;line-height:1;
  display:inline-flex;align-items:center;gap:6px;
  /* 视觉高度由 padding 决定（约 30px）；命中区靠 ::after 扩大，不撑高药丸本体 */
  position:relative;min-height:30px;padding:0 12px;border-radius:999px;
  border:1px solid var(--border);background:var(--surface-2);
  font-size:13px;font-weight:600;white-space:nowrap;cursor:default;
}
/* 命中区扩展：不改变药丸视觉高度与字形居中，仅把可点区域扩到 ≥44px 高。
   仅对「可点」药丸生效（.due/.book）；纯报数药丸不需要命中区。 */
.home-pill.due::after,.home-pill.book::after{content:'';position:absolute;inset:-7px;border-radius:999px}
```
- **★ 触控目标方案（team-lead 已指出「给元素加 padding 会改变字形居中」的坑，故不用 padding 撑高）**：
  - **不用 `min-height:44px`**：44px 空心药丸在 13px 字号下留白偏多、显得发胖（team-lead 核实）。
  - **改用 `.home-pill{min-height:30px}`（视觉小药丸）+ 可点药丸 `::after{position:absolute;inset:-7px}`** 扩大命中区：`30 + 7 + 7 = 44px` 高，`inset` 负值只外扩命中区、**不动内部字形居中**、不影响 `border-radius` 外观。
  - ⚠ **几何断言的注意点**：`::after` 的 `inset:-7px` **不会**改变 `.home-pill` 自身的 `getBoundingClientRect()`（伪元素不改变宿主盒模型）⇒ e2e 若直接量 `.home-pill` 的 `height` 会得到 ~30px、**不足以证明 44×44**。故 **e2e 场景 C 的 44×44 断言必须以「宿主 rect ∪ ::after 扩展区」为口径**：
    ```js
    // 命中区高度 = 宿主高度 + 2×7（伪元素外扩）；仅对 .due/.book 断言
    var r = el.getBoundingClientRect();
    var hitH = r.height + 14;      // 7px × 2
    var hitW = r.width + 14;
    check('可用药丸命中区 ≥ 44×44', hitH >= 44 && hitW >= 44, JSON.stringify({hitW:hitW, hitH:hitH}));
    ```
  - **最终决策（team-lead 要求二选一，本设计定稿）**：**采用 `min-height:30px` + `::after{inset:-7px}` 扩命中区**。理由：① 视觉贴设计稿（小药丸），避免 44px 空心药丸在 13px 字号下的留白/发胖；② 不动内部字形居中（避开实测的 padding 坑）；③ 命中区 44×44 达标。**不使用 `min-height:44px`**。
  - ⚠ **代价与配套**：伪元素不改变宿主盒模型 ⇒ e2e 必须按「宿主 rect + 2×7」断言（上方片段），且需在 e2e 注释里说明「命中区 = 宿主 + ::after 外扩」。

**药丸内部与状态样式**：
```css
.home-pill .pill-n{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}
.home-pill .pill-k{color:var(--muted)}
/* 可点态 */
.home-pill.due,.home-pill.book{cursor:pointer;transition:border-color .15s,background .15s,transform .08s}
.home-pill.due:hover:not(:disabled),.home-pill.book:hover:not(:disabled){border-color:var(--border-strong)}
.home-pill:active:not(:disabled){transform:scale(.97)}
.home-pill:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
/* 配色语义 */
.home-pill.due{border-color:#cfd9f5;background:var(--accent-soft)}
.home-pill.due .pill-n{color:var(--accent)}
.home-pill.book{border-color:#f3d4d0;background:var(--bad-soft)}
.home-pill.book .pill-n{color:var(--bad)}
.home-pill.mastered{border-color:#c3ead4;background:var(--ok-soft)}
.home-pill.mastered .pill-n{color:var(--ok)}
.home-pill.goal{background:var(--surface-2);border-color:var(--border)}
.home-pill.goal .pill-n{color:var(--muted)}
/* 0 值：去底色、去箭头、默认光标（沿用旧 .htc:disabled 语义） */
.home-pill:disabled{cursor:default;background:var(--surface);border-color:var(--border)}
.home-pill:disabled .chev{display:none}
.home-pill .chev{line-height:0}
.home-pill .chev .icon{width:12px;height:12px;color:var(--faint)}
```

**≥44×44 触控目标说明（R11）**：如上 —— **视觉高度由 `min-height:30px` + `padding` 决定（约 30px，贴设计稿）**；可点药丸（`.due/.book`）用 `::after{inset:-7px}` 把**命中区**扩到 `30+14=44px`。**不用 `min-height:44px`**（会撑出过多留白、显胖），也**不用加 padding 撑高**（会改变字形垂直居中位置，team-lead 已实测此坑）。e2e 断言命中区时按「宿主 rect + 2×7」口径（见上）。

**移动端覆盖**（改行 889–894 的 `@media(max-width:640px)`）：删除旧的 `.htc` / `.home-today-mark` 覆盖，改为：
```css
@media (max-width:640px){
  .home-today-counts{gap:6px}
  .home-pill{padding:0 10px;font-size:12.5px}
}
```

### 2.2 课程行整行可点 `.hd-row`（改造行 851）

```css
.hd-row{
  appearance:none;-webkit-appearance:none;font-family:inherit;font-size:inherit;font-weight:inherit;
  color:inherit;text-align:left;width:100%;box-sizing:border-box;
  display:flex;align-items:center;gap:12px;padding:8px 10px;margin:0 -10px; /* 负 margin 让 hover 底色外扩 */
  border:0;border-radius:10px;background:transparent;
  cursor:pointer;transition:background .15s}
.hd-row:hover{background:var(--surface-2)}
.hd-row:active{background:var(--border)}
.hd-row:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hd-row .nm{font-weight:700;font-size:14px}
.hd-row .grow{flex:1;min-width:0;text-align:left}   /* 内层要重置按钮的 text-align */
```
- `已学 N 句` 文案样式：`.home-deck-progress .learned{font-size:12px;color:var(--faint)}`。
- **删除**行 862–863 的 `.hd-row .btn` / `.hd-row .btn.ghost`（行尾按钮已移除）。

### 2.3 `+ 添加课程` `.home-add-course`（新增）

```css
.home-add-course{
  appearance:none;-webkit-appearance:none;font-family:inherit;font-size:13px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:6px;width:100%;box-sizing:border-box;
  min-height:44px;margin-top:10px;padding:0 12px;
  border:1px dashed var(--border);border-radius:12px;background:transparent;
  color:var(--accent);cursor:pointer;transition:border-color .15s,background .15s}
.home-add-course:hover{border-color:var(--accent);background:var(--accent-soft)}
.home-add-course:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.home-add-course .hac-ico svg{width:16px;height:16px;stroke-width:2}
```

### 2.4 续学条 `.home-resume`（新增）

```css
.home-resume{
  appearance:none;-webkit-appearance:none;font-family:inherit;color:inherit;text-align:left;
  display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;
  min-height:52px;padding:10px 14px;margin:0;
  border:1px solid var(--border);border-radius:12px;background:var(--surface-2);
  cursor:pointer;transition:border-color .15s,background .15s,transform .08s}
.home-resume:hover{border-color:var(--border-strong)}
.home-resume:active{transform:scale(.99)}
.home-resume:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.home-resume .hr-play svg{width:18px;height:18px;color:var(--accent)}
.home-resume .hr-text{flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.home-resume .hr-k{font-size:12px;color:var(--muted)}
.home-resume .hr-nm{font-size:14px;font-weight:700}
.home-resume .hr-sub{font-size:12.5px;color:var(--faint)}
.home-resume .chev svg{width:13px;height:13px;color:var(--faint)}
```

### 2.5 打卡行文案（`.cal-sum`，★ 裁决：维持现状文案）

打卡行**文案维持 `本月打卡 M 天`**（不做「连续 · 本月打卡」合并）⇒ **`.cal-sum` 无需改样式**，本节 CSS 改动为 **0**（保留原有 `.cal-sum` 规则即可，无需新增 `.cal-sum-sep`）。

---

## 3. 文件列表（相对路径）

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `main.html` | **修改** | ① `renderHome()` 行 4179–4405 内：新增续学条、改造课程行（含**首页专用进度行** `homeCourseProgressMarkup`）、新增添加课程、改造计数区→药丸行、新增 `#homeGoalPill`；打卡行**维持现状文案**；② 首页 CSS 行 786–896：新增 `.home-pill`/`.home-resume`/`.home-add-course`/`.learned`，改造 `.home-today-counts`/`.hd-row`，删除 `.htc`/`.home-today-mark`/`.hd-row .btn` 旧规则 |
| `js/icons.js` | **修改（1 行）** | `defs` 新增 `plus` 图标（`+ 添加课程` 用，宪法禁字符 icon） |
| `sw.js` | **重新生成（勿手改）** | `node scripts/gen-sw.js`（`main.html` 在 `PRECACHE`，内容变 → CACHE 版本自动 bump） |
| `e2e/home-today-entries.test.js` | **修改** | 场景 A/B/C（含场景 C 命中区口径）保留/微调；场景 E/G 与新形态同步；场景 F 保留 |
| `e2e/e2e.js` | **修改** | 行 ~588–633 的 `todayCard` 探针随药丸形态更新；**行 669/696 的「最近练习摘要」断言**因首页文案改为 `已学 N 句` **需同步** |
| `e2e/progress-coverage.test.js` | **修改** | **行 89 断言 `#pageHome .home-deck-progress` 含 `41 / 43`** —— 因首页课程行改用 `已学 N 句` 文案，**需同步为新文案**（`已学 41 句` + `本次完成 2 句`） |

> **✅ 受影响测试文件 = 4 个（最终定稿）**：
> - `e2e/home-today-entries.test.js`（场景 E/G 形态更新 + 场景 C 命中区口径）
> - `e2e/e2e.js`（`todayCard` 探针 + 行 669/696 首页摘要文案 `已覆盖 1 / 1 句` → `已学 1 句`）
> - `e2e/progress-coverage.test.js:89`（读 `#pageHome .home-deck-progress`，断言 `41 / 43` → 新文案 `已学 41 句`）
> - `e2e/deck-progress-diagnostic.test.js:96`（**★ 该文件也读首页** `#pageHome .home-deck-progress`，断言 `已覆盖 4 / 5 句` → `已学 4 句`）
>
> **⚠ 对 team-lead 判断的细化**：`deck-progress-diagnostic.test.js:96` 断言的是 **`#pageHome .home-deck-progress`（首页课程行 DOM）**，**不是** `deckProgressMarkup` 函数本体的直接单测 —— 所以**它并不受「本体不动」的保护，首页改文案后它也会红**，必须纳入 T05。
>
> **✅ 不受影响（明确列出，防工程师误改）**：
> - `scripts/main-deck-progress.test.mjs:26`（断言 `buildDeckProgressMarkup` **本体**产出 `/已覆盖 1 \/ 2 句/`；本设计**不动函数本体** ⇒ 必然仍绿）。它是「函数本体是否被误动」的红线。
> - `e2e/daily-goal.test.js`（`.home-goal` 保留 ⇒ 存在性契约不变）。

> **不改**：`core.js`、任何子页面 HTML、数据层、`server/`、`src/`（`deckProgressMarkup` 与 `buildDeckProgressMarkup` 本体均不动）。

---

## 4. 数据结构与接口

**不新增任何数据结构、不新增任何 `mem.*` 字段。** 全部复用：

| 用途 | 复用函数 / 变量 | 位置 |
|---|---|---|
| 续学目标 | `resume`（含 `{deck, idx, mode}`）、`preferredCourseResume(deck)` | `main.html:4174–4206` |
| 课程列表取数 | `recent`（在学 ∪ 导入未开始，已排除 resume 那门课）、`contextByDeckId` | `main.html:4212–4229` |
| 课程名标签 | `context.label` / `displayDeckName(d.name)` | — |
| 进度条结构 class | `.home-deck-progress` / `.home-deck-progress-track` / `.pct`（**与 `deckProgressMarkup` 产出逐字一致**） | `main.html:4088–4090` |
| 进度口径 | `deckLearningProgress(deck)` → `{done,total,pct,ready}`（**唯一口径**） | `main.html:4040–4072` |
| 首页专用进度行 | 新增局部函数 `homeCourseProgressMarkup(deck, resumeIdx, best)`（**仅换文案为 `已学 N 句`**） | 新增于 `renderHome` 内 |
| 已学句数 | `deckLearningProgress(deck).done` | `main.html:4040` |
| 已熟练 | `CL.masteredSentenceCount(mem)` | `core.js:3431` |
| 连续天数 | `CL.streakDays(mem)`（已算 `_streakN`） | `main.html:4240` |
| 本月打卡 | `CL.dailyActivity(mem)` → `_monthDays` | `main.html:4341/4351` |
| 今日已练 / 目标 | `_goal`、`_todayAnswered`（已算） | `main.html:4310–4312` |
| 到期 / 错题本计数 | `t.due` / `t.book`（`computeToday()`） | `main.html:4180` |
| 图标 | `Icons.svg(name)` | `js/icons.js:72` |
| 事件委托 | `[data-start]`/`[data-idx]` → `startDeck` | `main.html:4372–4380` |
| 日历 popover | `bindCalPop()` | `main.html:2667` |

**接口不变**：`renderHome()` 签名与副作用（写 `#homeBody`、绑事件、`ensureHomeProgressIndexes`）不变。

**Mermaid classDiagram（复用关系，非新增类）**：

```mermaid
classDiagram
  class renderHome {
    +renderHome() void
    -resume: {deck, idx, mode}
    -recent: Array~{deck, context}~
    -_courseRows: string[]
    -_masteredN: number
    -_streakN: number
    -_goal: number
    -_todayAnswered: number
    +_resumeRow(resume, context) string
    +_courseRow(entry, resumeIdx) string
    +homeCourseProgressMarkup(deck, resumeIdx, best) string
    +_pillRow(t, masteredN, goal) string
  }
  class DeckProgress {
    +deckProgressMarkup(deck, resumeIdx, best) string
    +deckLearningProgress(deck) {done,total,pct,ready}
  }
  class CoreCL {
    +masteredSentenceCount(mem) number
    +streakDays(mem) number
    +dailyActivity(mem) object
  }
  class Icons {
    +svg(name) string
  }
  class TodayCounts {
    +homeBtnDue: button
    +homeBtnBook: button
    +homeMastered: div
    +homeGoalPill: div
  }
  renderHome --> DeckProgress : deckLearningProgress 取口径
  renderHome ..> DeckProgress : homeCourseProgressMarkup 仅换文案（本体不动）
  renderHome --> CoreCL : 复用口径
  renderHome --> Icons : 复用图标
  renderHome --> TodayCounts : 渲染
```

**Mermaid sequenceDiagram（关键操作：首页渲染 + 续学点击 + 计数点击 + 打卡展开）**：

```mermaid
sequenceDiagram
  participant U as User
  participant H as renderHome()
  participant CL as CoreCL
  participant DP as deckLearningProgress
  participant Home as #homeBody DOM

  U->>H: 打开首页
  H->>CL: streakDays(mem) / dailyActivity(mem)
  H->>H: doc

  H->>DP: deckLearningProgress(d)  (每个课程行)
  DP-->>H: {done,total,pct,ready}
  Note over H: homeCourseProgressMarkup 用 done 拼「已学 N 句」<br/>结构 class 与 deckProgressMarkup 一致，仅换文案（本体不动）
  H->>CL: masteredSentenceCount(mem)
  CL-->>H: masteredN
  H->>Home: innerHTML = hero + 续学条 + 我的课程 + 添加课程 + 药丸行 + 打卡行
  H->>Home: 绑定 [data-start] / #homeBtnDue / #homeBtnBook / #homeCalToggle
  H->>H: ensureHomeProgressIndexes([...decks])

  U->>Home: 点续学条 (#homeResumeRow, data-start)
  Home->>H: startDeck(deck, idx) -> showPracticePage()

  U->>Home: 点 #homeBtnDue
  Home->>H: showPracticePage(); startTodayDue()

  U->>Home: 点 #homeCalToggle
  Home->>Home: 切 _homeCalOpen / panel.hidden / aria-expanded (文案仍「本月打卡 M 天」)
```

---

## 5. 任务列表（有序 · 含依赖 · 按实现顺序）

> 共 **5 个任务**（含 1 个基础设施）。任务 T01 无依赖；T02/T03/T04 依赖 T01；T05 依赖 T02/T03/T04。

### T01：项目基础设施 + 图标 + sw 重生成护栏（P0）
- **Source Files**：`js/icons.js`（新增 `plus`）、`sw.js`（重新生成）、`main.html`（仅**首页 CSS 变量区/骨架注释位**预留，不动渲染逻辑）
- **Dependencies**：无
- **内容**：
  1. `js/icons.js` defs 新增 `plus: '<path d="M12 5v14"/><path d="M5 12h14"/>'`（24×24 stroke，与 `close` 同源）。
  2. 确认 `npm run pretest` 会跑 `gen-sw.js`；手动跑一次 `node scripts/gen-sw.js` 建立基线，`node scripts/check-sw.js` 校验通过。
  3. 在 `main.html` 首页 CSS 区（行 786–896）**新增** `.home-resume` / `.home-pill` / `.home-add-course` 三段新规则，**暂不删除**旧 `.htc`/`.home-today-mark`（避免 T02/T03 未完成时页面半坏）。
- **影响 e2e**：无（新增 CSS 不影响旧断言；`plus` 图标无人引用）。

### T02：续学条 + `+ 添加课程`（P0）
- **Source Files**：`main.html`（`renderHome()` 行 4243–4274 区域）
- **Dependencies**：T01
- **内容**：
  1. 在 `.home-hero` push 之后（行 4245 后）插入续学条渲染：`if(hasEver && resume)` → `<button class="home-resume" id="homeResumeRow" data-start data-idx aria-label>`，文案 `继续 · <context.label> · 第 N 课`。取数复用 `resume` + `contextByDeckId[resume.deck.id].label`。
  2. 在 `.home-courses` 卡内、`.home-decks` 之后插入 `+ 添加课程` 按钮 `#homeAddCourse`；把标题右 `全部课程`（行 4270）改为常驻 `管理 ›`（`.hc-manage`）。
  3. 事件：`#homeResumeRow` 走现有 `[data-start]` 委托（无需新代码）；`#homeAddCourse` 与 `.hc-manage` → `location.href='decks.html'`（在行 4368 附近补 onclisk 绑定）。
- **影响 e2e**：场景 E 的 `heroFirst`（续学条插在 hero **之后** ⇒ `heroFirst` 仍 true，✅ 不受影响）；`streakOutsideHero`（不受影响）。

### T03：我的课程行改造（整行可点 + 管理入口 + 首页专用进度行）（P0）
- **Source Files**：`main.html`（`_courseRows` 行 4252–4266；新增局部函数 `homeCourseProgressMarkup`；CSS `.hd-row` 行 851–863 + 新增 `.learned`）
- **Dependencies**：T01
- **内容**：
  1. `_courseRows` push 的 `<div class="hd-row">…<button class="btn ghost" data-start…>` 改为 **`<button type="button" class="hd-row" data-start data-idx aria-label="继续 <name>">`** 包裹整行；删除行尾 ghost 按钮（行 4257 / 4264 的 `btn ghost` 片段）。
  2. **新增 `renderHome` 内的局部函数 `homeCourseProgressMarkup(deck, resumeIdx, best)`**（★ 老板裁决「首页专用文案」）：
     - **不在** `_courseRows` 里调 `deckProgressMarkup`；改调 `homeCourseProgressMarkup`。
     - 内部**复用 `deckLearningProgress(deck)`** 取 `{done, total, pct, ready}`（口径唯一，不重算）。
     - 输出的 **`.home-deck-progress` / `.home-deck-progress-track` / `.pct` 结构 class 与 `deckProgressMarkup` 产出的逐字一致**（含 `role="progressbar"` + `aria-*`）；**唯一差异 = 文案**：`<span title="…">已覆盖 N / M 句</span>` → `<span class="learned">已学 N 句</span>`。
     - **只做「文本替换级」改写**，不复制定位/取数逻辑；`resumeIdx` / `current` / `last-acc` / `session-answered` 分支按需保留（取值同源）。
  3. **`deckProgressMarkup` 函数本体与 `src/main/deck-progress.mjs` 都不动**（保持 `已覆盖 x / y 句`）。
  4. CSS：`.hd-row` 重置为按钮（§2.2）+ `.home-deck-progress .learned{font-size:12px;color:var(--faint)}`；删除 `.hd-row .btn` 规则。
- **影响 e2e（已定稿）**：首页课程行文案由 `已覆盖 x / y 句` 变为 `已学 N 句` ⇒ **以下 3 个文件会红，均已在 T05 同步**：
  - `e2e/progress-coverage.test.js:89`（`#pageHome .home-deck-progress` 断言 `41 / 43`）
  - `e2e/deck-progress-diagnostic.test.js:96`（**该文件也读首页** `#pageHome .home-deck-progress`，断言 `已覆盖 4 / 5 句`）
  - `e2e/e2e.js:669/696`（首页课程列表 `.sub` 摘要断言 `已覆盖 1 / 1 句`）
  - **唯一不受影响**：`scripts/main-deck-progress.test.mjs`（纯函数单测，函数本体未动）。

### T04：计数区 → 药丸行 + `#homeGoalPill`（P0，★ 核心）
- **Source Files**：`main.html`（计数区行 4276–4303；`.home-goal`/`.home-today-done` 行 4304–4325；打卡行 4356–4363 **仅确认不改**；CSS 行 786–896）
- **Dependencies**：T01
- **内容**：
  1. 计数区：把 `<div class="home-today-counts">` 内的两个 `.htc` 按钮 + `.home-today-mark` 替换为**四枚 `.home-pill`**（§1.5）。保留 `#homeBtnDue` / `#homeBtnBook` / `#homeMastered` id 与 disabled 语义。
  2. 卡内加分区标题 `今天要做`（`.hc-title`）。
  3. **`#homeGoalPill` 与 `.home-goal` 并存（★ 老板裁决）**：**新增**第四枚药丸 `目标 3/20`（灰、仅报数、`#homeGoalPill`，值 = `_todayAnswered + '/' + _goal`），**同时保留** `.home-goal` 独立进度条节点（护住 `daily-goal.test.js` 场景 B 的存在性契约）。`_goal>0` 时才渲染 `#homeGoalPill`（未设目标则不出该药丸，但 `.home-goal` 的渲染条件不变）。
  4. 打卡行：**文案维持 `本月打卡 M 天`，不改**（老板裁决；§1.6）。
  5. CSS：`.home-today-counts` 改 flex-wrap（§2.1）；**删除** `.htc`（826–844）、`.home-today-mark`（792–796）、`@media` 内旧覆盖（889–894）；`.home-pill` 全套新增。
- **影响 e2e**：场景 A（`.chev` svg、disabled 背景）**需保结构**——`#homeBtnDue`/`#homeBtnBook` 内仍需 `.chev`（含 `.icon` svg），故药丸内保留 `…chev…`（见 §1.5 DOM）。场景 E 的 `E4/E4b/E4c/E5/E6/E7` 与规则自证**全部失效**（T05 重写）。场景 G 的 `G1`（`isLastChild`/`outsideBook`）与 `.v/.k` 选择器**需更新**。**`daily-goal.test.js` 零改动**（`.home-goal` 保留）。


### T05：契约测试同步 + sw 重生成（P0）
- **Source Files**：`e2e/home-today-entries.test.js`、`e2e/e2e.js`、`e2e/progress-coverage.test.js`、`e2e/deck-progress-diagnostic.test.js`、`sw.js`
- **Dependencies**：T02、T03、T04
- **内容**：
  1. `home-today-entries.test.js`：
     - **场景 A/B/C 保留原样**（`#homeBtnDue`/`#homeBtnBook` 存在、可点、0 值 disabled、`.chev` svg、键盘 Enter、无横向溢出）。
     - **★ 场景 C 的 44×44 断言更新命中区口径**：药丸本体高 ~30px，需按「宿主 rect + 2×7」验证（见 §2.1 代码片段）；并在注释说明「命中区 = 宿主 + `::after` 外扩」。
     - **场景 E 重写**：`E1/E2` hero 断言保留；`E3`「卡内无 `.hc-title`」改为「今日卡标题文案 == 今天要做」；**删** `E4/E4b/E4c`（等宽大卡契约），**新增** `E4'`「药丸行可换行且不溢出」+ `E4b'`「已熟练是 `.home-pill.mastered` 非 `a/button`、无 `.chev`」；**删** `E5/E5-/E6/E7`（旧占满率/堆叠/居中），**新增** `E6'`「药丸为横向 数字+标签（`inline-flex`）」+ `E7'`「可点药丸命中区 ≥44（含 ::after）」；负向自证改为「把 `.home-pill` 改成旧 3 列 grid → 会出现 32px `.n` ⇒ 断言变红」。
     - **场景 G 更新**：`G1` 由「`isLastChild`」改为「`.home-pill.mastered` 在 `.home-pill.book` 右侧（`left` 更大）+ 值为 5 + 标签 已熟练」；`G2` 保留（非 `a/button`、无 `.chev`）；选择器由 `.home-today-mark .v/.k` 改为 `.home-pill.mastered .pill-n/.pill-k`；`G3`（与 `#masteredCount` 逐字一致）**必保**；`G4-` 负向自证**必保**。
     - **场景 F 保留**（`.home-courses`/`.home-today-card`/`.home-cal`/`.cal-grid` 均未改名；打卡行文案仍 `本月打卡 N 天`）。
  2. `e2e/e2e.js`：更新行 ~588–633 的 `todayCard` 探针——把 `.htc`/`button.htc`/`fillPct≥95`/`equalWidth`/`stacked` 改为药丸形态判据（如 `.home-pill` 存在 + `.home-pill.due/.book` 可点 + 横向排布）。**并更新行 669/696 的「最近练习摘要」断言**：`已覆盖 1 / 1 句` → `已学 1 句`。
  3. **`e2e/progress-coverage.test.js`**：更新行 89 断言 —— `text.indexOf('41 / 43')` 改为新首页文案（建议断言 `已学 41 句`；`本次完成 2 句` 保留）。
  4. **`e2e/deck-progress-diagnostic.test.js`**（★ 该文件也读首页）：更新行 96 —— `result.text.indexOf('已覆盖 4 / 5 句')` 改为 `result.text.indexOf('已学 4 句')`；`本次完成 2 句` 与 `title`「重复练习不会增加」**保留**（若首页专用渲染也带同款 `title`；若不带，则删该子断言并在注释说明）。
  5. `node scripts/gen-sw.js` 重生成 `sw.js`；`node scripts/check-sw.js` 校验。
  6. 全量跑受影响的 4 个 e2e：`home-today-entries.test.js`（≥ 原 50 条有效覆盖）、`e2e.js`、`progress-coverage.test.js`、`deck-progress-diagnostic.test.js` 全绿；并确认 `scripts/main-deck-progress.test.mjs` **不受影响仍绿**（函数本体未动）。
- **影响 e2e**：本任务即「同步更新」的落点。**受影响文件最终 = 4 个**（`home-today-entries.test.js`、`e2e.js`、`progress-coverage.test.js`、`deck-progress-diagnostic.test.js`）；**不受影响 = `scripts/main-deck-progress.test.mjs` 与 `daily-goal.test.js`**（前者函数本体未动，后者 `.home-goal` 保留）。


---

## 6. 共享知识（跨文件约定）

### 6.1 新 class 命名规范
- 新组件一律用 `.home-<区块>` 前缀：`.home-resume`（续学条）、`.home-add-course`（添加课程）。
- 药丸行统一 `.home-pill` + 语义修饰类：`.due` / `.book` / `.mastered` / `.goal`。
- 药丸内部固定 `.pill-n`（数值）/ `.pill-k`（标签），替代旧的 `.htc .n/.l` 与 `.home-today-mark .v/.k`。
- **不建议**保留 `.v/.k` 作为别名（避免两套选择器），直接改 e2e 选择器。

### 6.2 DOM id 保留清单（**不可删/不可改名**）
| id | 契约来源 |
|---|---|
| `#homeBtnDue` | 场景 A/B/C：存在/可点/0 值 disabled/`type=button`/`tabIndex>=0` |
| `#homeBtnBook` | 场景 A/C：存在/可点/键盘 Enter/44×44 |
| `#homeMastered` | 场景 G：已熟练报数、非 `a/button`、无 `.chev` |
| `#homeCalToggle` | 场景 F：`aria-expanded` + 展开切换 |
| `#homeCalPanel` | 场景 F：`hidden` 切换 |
| `#homeBody` | 全场景容器 |
| `#homeGoDecks` / `#homeChunkIntro` | 空档案引导（R9，保留） |
| `#deckName` / `#pagePractice` | 点击/键盘跳转后断言目标（场景 A/C） |

**新增 id**：`#homeResumeRow`（续学条）、`#homeAddCourse`（添加课程）、`#homeGoalPill`（目标药丸）。

### 6.3 命名/结构约定（跨文件）
- **图标只走 `Icons.svg(name)`**；禁止 emoji / Unicode 字符（`›`、`+`、`·`）充当**按钮内容**。纯装饰分隔符（`·`）允许。
- **进度条唯一实现** = 结构 class（`.home-deck-progress` / `.home-deck-progress-track` / `.i` / `.pct`）只有一份样式；**口径唯一** = `deckLearningProgress`。首页专用文案行（`homeCourseProgressMarkup`）只做**文案替换**，**不改结构、不复制取数逻辑**。
- **首页专用进度文案** = `已学 N 句`（N = `deckLearningProgress(deck).done`）；其它页面仍 `已覆盖 x / y 句`（`deckProgressMarkup` / `buildDeckProgressMarkup` **本体不动**）。
- **日历唯一实现** = `.cal-grid`（`CL.dailyActivity` 数据源）；打卡行**只保留 `本月打卡 M 天`**（连续天数只在 hero）。
- **已熟练唯一口径** = `CL.masteredSentenceCount(mem)`；首页不得自算（与 `stats.html#masteredCount` 逐字一致）。
- **`sw.js` 必须重生成**：任何 `main.html` / `js/icons.js` 变更后跑 `node scripts/gen-sw.js`；`sw.js` 的 `CACHE` 行**禁止手改**（脚本覆盖）。校验用 `node scripts/check-sw.js`。
- **药丸触控目标**：可点药丸视觉高 ~30px（`min-height:30px`），命中区靠 `::after{inset:-7px}` 扩到 44px；**不用 padding 撑高**（改字形居中），**不用 `min-height:44px`**（显胖）。e2e 断言按「宿主 rect + 2×7」口径。
- **移动端**：`.home-today-counts` 用 `flex-wrap:wrap`，360/390px 不横向溢出（场景 C 契约）。

### 6.4 实现顺序硬约束
`T01 → (T02, T03, T04 可并行) → T05`。**T05 必须在最后**，因为它一次性对齐所有 e2e 契约与 sw 重生成。

---

## 7. 已裁决事项（三项全部由老板拍板，无遗留待明确）

1. **`已学 N 句` 文案（★ 老板已裁决 —— 首页专用文案，已定稿）**：首页课程行显示 `已学 N 句`（N = `deckLearningProgress(deck).done`），**不改其它页面**。实现 = 新增 `homeCourseProgressMarkup`（首页专用），**`deckProgressMarkup` / `buildDeckProgressMarkup` 本体不动**；进度条结构 class 与其产出**逐字一致**，只换文案。**本条已无待确认。**
   - 受影响测试文件（已定稿）= **4 个**：`e2e/home-today-entries.test.js`、`e2e/e2e.js`、`e2e/progress-coverage.test.js`、`e2e/deck-progress-diagnostic.test.js`。
   - **不受影响** = `scripts/main-deck-progress.test.mjs`（纯函数单测）。
2. **打卡行文案（★ 老板已裁决，已定稿）**：打卡行**只显示 `本月打卡 M 天`**，**不含连续天数**；`展开 ›` 保留；`.home-hero` 的 `cal-streak` **保持不动**（e2e 场景 E 锚点）。即「连续 · 本月打卡」合并方案**已作废**，本区块相对现状几乎零改动。
3. **`目标` 药丸与 `.home-goal` 并存（★ 老板已裁决，已定稿）**：药丸行含第四枚 `目标 3/20`（灰、仅报数、`#homeGoalPill`，`_goal>0` 才渲染），**同时保留** `.home-goal` 独立进度条节点（护住 `daily-goal.test.js` 场景 B）。两者都渲染。
4. **药丸触控目标（★ team-lead 要求定稿）**：采用 `min-height:30px` + 可点药丸 `::after{inset:-7px}` 扩命中区（**不用 `min-height:44px`**，避免显胖；**不用加 padding 撑高**，避免改字形居中）⇒ 视觉 30px、命中区 44px。配套：e2e 按「宿主 rect + 2×7」断言。
5. **`管理 ›` 与 `+ 添加课程` 落地目标**：统一跳 `decks.html`（与现 `.brand`、`#homeGoDecks` 一致）。若首页需要内联导入弹层，则超范围，需另行立项。
6. **`#homeMastered` 位置**：四枚并列后「已熟练」在 `.home-pill.book` 右侧、`目标` 在最右。G1 按此更新。
7. **`resume` 为 null 时**（无续学目标的新用户）：续学条不渲染；课程列表 `_courseCap` 回到 5（行 4227 已处理），无需改动。

---

## 8. 影响面与风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| 契约测试大面积变红（场景 E/G + e2e.js + 2 个首页进度断言） | 旧断言针对 3 列大卡 + 旧进度文案 | T05 按 §5 清单同步更新 **4 个文件**；核心契约（A/B/C/F/G3）**必保** |
| 误改 `deckProgressMarkup` 全站共享文案 | `已覆盖 x / y 句` 是该函数本体产出，动它会连带影响结束屏等 | **本体不动**；首页走专用 `homeCourseProgressMarkup`。`scripts/main-deck-progress.test.mjs` 是「本体是否被误动」的红线（须仍绿） |
| 药丸触控目标不足 或 视觉发胖/字形不居中 | `min-height:44px` 显胖；加 padding 改字形居中 | 用 `min-height:30px` + `::after{inset:-7px}` 分离视觉与命中区；e2e 按宿主+2×7 断言 |
| 首页专用进度行「复制」出第二份取数逻辑 | 违宪法④ | `homeCourseProgressMarkup` **只做文案替换**，取数一律走 `deckLearningProgress`；结构 class 与 `deckProgressMarkup` 逐字一致 |
| `+ 添加课程` 用字符 `+` 违规 | 宪法禁字符 icon | T01 新增 `plus` SVG 图标 |
| 忘跑 `gen-sw.js` | cache-first 命中旧页「改了像没改」 | T01/T05 均跑 `gen-sw`；`check-sw.js` 护栏 |
| 误删 `.home-goal` 打破 daily-goal 测试 | 存在性契约 | **保留 `.home-goal`**（与 `#homeGoalPill` 并存） |
| 未获授权变更 | 宪法禁擅自 commit/push/deploy | 本设计仅为方案；**落地后须老板明确指令才可提交** |

> **受影响测试文件数（最终定稿）= 4 个**：`e2e/home-today-entries.test.js`、`e2e/e2e.js`、`e2e/progress-coverage.test.js`、`e2e/deck-progress-diagnostic.test.js`。
> **不受影响**：`scripts/main-deck-progress.test.mjs`（函数本体未动）、`e2e/daily-goal.test.js`（`.home-goal` 保留）。

---

**结论**：本改版是**纯渲染层重构**，零新增数据结构、零新增业务口径（进度条结构、日历、已熟练口径全部复用）。三项待明确已全部由老板裁决：① 首页专用 `已学 N 句`（函数本体不动）；② 打卡行只留 `本月打卡 M 天`；③ `#homeGoalPill` 与 `.home-goal` 并存。风险集中在**契约测试同步（4 文件）**与**药丸触控目标/移动端换行**两处。按 T01→T05 顺序落地，每步可独立验证；T05 完成即恢复全绿。

