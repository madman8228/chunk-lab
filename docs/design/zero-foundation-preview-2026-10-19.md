# 零基础教学预览：局部设计继承记录

日期：2026-10-19。结论：**SHIP，仅限本地只读预览**。本文件记录 ordinary extension 的现有实现、继承依据和验收边界，不建立新的全站设计体系，也不构成公开发布批准。

## Overview

本预览采用 Operate 模式，服务中文母语零基础学习者理解身边物品。pen、book、bag 各有“认识词 → 理解短语 → 看懂句子”三步；同一实物图贯穿词形、a＋物品词和 This is a…，先理解再自行选择辅助练习。三步可自由切换，换词不要求答题，浏览不产生完成成绩或掌握记录。

视觉权威继续是既有词书构图与“课程封面的学习花园”：完整场景、暖纸、棕字、蜂蜜色操作和移动端上下布局。本次属于代码驱动的局部扩展，不需要全局重设计。依据为根目录 PRODUCT.md、DESIGN.md、.impeccable/design.json、.impeccable/surfaces/zero-foundation-preview.md，以及 docs/design/system-context-2026-10-13.md。遵循 impeccable/reference/document.md 的现状提取方式；按本次明确范围，仅新增此局部记录，不刷新根 DESIGN.md 或 sidecar，不复制一套规范性 token。

实现范围为 scripts/preview/zero-foundation.html、scripts/preview/zero-foundation.js、scripts/preview/zero-foundation.css 和 scripts/serve-zero-foundation-preview.cjs。它们全部属于预览设施，不是生产入口。

## Colors

沿用 landing/theme.css、assets/learning-workspace.css、assets/learning-sky.css 与 assets/wordbook-study.css。暖纸承载文字，棕色用于正文和边界，蜂蜜黄指示当前教学步骤与下一步操作。局部样式明确覆盖既有“第一个按钮高亮”规则，避免非当前步骤也呈黄色；辅助练习方式使用粗体和下划线表达选中状态。没有创建新的品牌配色。

## Typography

保留现有字体栈与可选择的 HTML 文本。页标题继承词书紧凑标题；教学目标英文为 26px、1.5 行高，说明为 1.6 行高并限制至 65ch。英文目标标记 lang="en"；中文含义、解释和辅助练习声明与英文分层呈现，不烘焙进图片。长内容允许换行。

## Layout

沿用最大宽度 1040px 的词书工作区；桌面纸面为图文两列，比例 .9:1.1、间距 24px、内边距 18px。600px 以下改为单列，间距 16px、内边距 14px；控件可换行，最小触控尺寸沿用 44px。图片使用完整比例、height:auto 与 object-fit:contain，桌面及手机共用同一幅 16:9 WebP，不另裁移动版。

紧凑标题和词序之后是只读草稿声明、三步导航、图文纸面和前后步骤／换词／暂停控件。句子阶段才出现可选的选词或拼块练习。1440、774、390、320px 已有截图与无横向溢出测试证据；这不是所有设备的适配保证。

## Elevation & Depth

复用学习天空与花园背景的景深和暖纸表面。词书工作区本身透明、无外框和阴影，纸面使用细边界，不新增卡片阴影体系或装饰动效。全站木质导航的深度规则继续由原设计文档和共享样式负责。

## Shapes

沿用词书纸面 16px 圆角、图片 10px 圆角和按钮 9px 圆角。保留原生按钮、单选项和词块形态；不引入新的组件家族。

## Components

- 教学步骤：原生按钮，当前项使用 aria-current="step"。切换后焦点移到教学标题；步骤导航可键盘操作，不冒充 tab 组件。
- 练习：复用 landing/word-choice-view.js、landing/chunk-order-view.js 及原有题目引擎。选词和拼块都标注为有提示的辅助练习，完成不等于独立掌握。
- 暂停：停止音频并隐藏练习，保留当前尚未提交的选择；继续恢复当前界面与焦点，不自动播放。换词或重新切换教学步骤会销毁旧表单，不承诺跨步骤、刷新或跨设备恢复。
- 音频：三词各有词、短语、句子片段，共九份实际 Ogg/Opus。点击才加载当前片段，重复播放复用已验证缓存；摘要不一致时拒绝播放，可重试，不退回浏览器 TTS。不录音、不调用麦克风，不提供发音评分。
- 图片：仅加载当前词的交付图；失败时保留文字并说明可刷新重试，不请求 master 或 atlas 作为回退。
- 读取失败：素材接口失败显示重试按钮；状态与练习反馈使用 polite live region。

### 素材来源与预算

本轮文档工作没有生成或编辑 raster。三幅图片来自先前素材阶段，原稿、提示与格位／itemId／文件映射保留在 drafts/scene-wordbooks/zero-foundation-objects-v1/ASSETS.md、images-batch-v1.report.json 和 image-prompt-v1.txt；音频来源与摘要另见 audio-v1/manifest.json。ASSETS.md 的“教学呈现待实现”是该素材阶段的历史状态，不是本次预览的实现结论。

| 物品 | 唯一交付文件（assets/） | 实际字节 |
| --- | --- | ---: |
| pen | vocab-zero-objects-adult-pen-introduction-wide-v1.webp | 6,838 |
| book | vocab-zero-objects-adult-book-introduction-wide-v1.webp | 8,800 |
| bag | vocab-zero-objects-adult-bag-introduction-wide-v1.webp | 7,072 |

三份均严格小于 20,000 bytes；同一 WebP 供桌面与手机完整显示，没有默认 AVIF 或移动裁图。原 atlas 和分图 master 保留；风格权威仍为 ref/words-pic/split/masters/connect-with-v2.png，后续生成批次不取代它。素材可用于预览不等于成人适配、风格或最终音质已获用户批准。

### 验证证据与继承裁定

主流程 e2e/zero-foundation-preview.test.cjs 的已通过报告为 output/test-results/zero-foundation-preview-1792404905334/summary.json：覆盖三词三阶段、九份音频、当前媒体按需请求、重复音频缓存、暂停停止音频、继续无自动播放、选词／拼块与错选恢复。未提交选择在暂停后保留由测试源码明确断言。

e2e/zero-foundation-preview-errors.test.cjs 另据本轮交接记录已通过：读取 503 后重试、键盘切换步骤与标题焦点、损坏音频摘要拒绝及重试、不使用 TTS、图片失败及不回退大原图。本次仅核对既有源码与报告，不重新运行这些会生成报告／截图的测试。

八张截图位于 .impeccable/review/zero-foundation/：phrase-{1440,774,390,320}.png 和 sentence-{1440,774,390,320}.png。按父任务交接，父任务与 fresh reviewer 均亲自打开全部八张；fresh reviewer 给出的 SHIP 只适用于本地只读预览。本文件作者没有另行宣称重新完成视觉审查。首轮集中修正双黄色高亮和暂停丢失表单，第二轮已确认。

机械 detector 已在父流程运行一次：HTML 的临时 /preview.css 路由映射未解析，但 CSS 已单独扫描。继承的导航条纹／repeating gradient 与 token 提示按 advisory 记录，不据此推翻现有视觉权威，也不追加全局改版。窄屏继承的装饰太阳与草稿声明有重叠，审查结论为非阻断欠账；保留记录，不能描述为无视觉问题。

### 只读与发布边界

预览服务监听 127.0.0.1，默认分配隔离端口，以新建临时目录承载允许的静态文件。素材响应明确 readOnly:true、publishable:false；服务只允许 GET/HEAD，拒绝其他方法，没有账号或学习写入接口。没有为测试切换或重启真实服务。

测试中的 noWritesOrDatabase 是有限断言：检查浏览器请求为 GET、localStorage/sessionStorage 为空、临时预览根没有 chunklab.db，并验证写入请求被拒绝。它不是 IndexedDB、所有数据库位置、服务端持久化链路或真实账号的完整审计，不可据此宣称全站数据零写入已被全面证明。

物理麦克风、Safari、辅助技术、真实设备和人工音质均未验收。存在播放按钮或音频解码通过不能证明跟读、听力训练、识别测量、连读质量或发音评分。生产发布未执行、未验证，也未获本记录授权；用户此前批准教学方向及草稿素材准备，不等于发布批准或最终媒体质量批准。父任务并行补充验收文档与当前运行检查；其尚未回传的结果不在此提前记作通过。

## Do's and Don'ts

- Do：继续继承既有词书组件与花园／暖纸体系；保持词、短语、句子与当前物品图一致。
- Do：保留只读草稿、图音待审与辅助练习声明；按需加载并复用缓存，逐文件遵守小于 20,000 bytes 的预算。
- Do：保留原稿、提示、摘要和映射；后续修改另行版本化，并保留用户课程、学习记录和无关工作区修改。
- Don't：把浏览或辅助练习完成描述为已验证掌握，把本地 SHIP 扩大为生产发布或最终素材批准。
- Don't：借局部扩展修改全局 DESIGN.md、sidecar、真实课程、账号记录或备份；不要用清空存储修复显示问题。
- Don't：自动播放恢复音频、用 TTS 替代已审定片段、预载全词库或将大原图作为失败回退。

## 2026-10-19：UI 精简收尾

已核对当前预览 HTML／JS／CSS 与 `.impeccable/surfaces/zero-foundation-preview.md`。主操作“继续”线性推进三词各三步（3×3），词末为“继续下一词”，最后为“结束本节”；次要跳转放入默认收起的课程目录。“上一步”支持跨词回退。结束页明确仅已浏览、不代表掌握，并可重新浏览。

本次收尾仅追加文档。预览不写入账号或学习记录、不发布；课程、原稿、图片、音频、备份及其他既有资产保留。新预览使用隔离端口 4267，旧 2543 与正式服务未改动或重启；全局 DESIGN 未修改。

流程测试及原有实际媒体／异常测试已通过；媒体报告为 `output/test-results/zero-foundation-preview-1792405586342/summary.json`。据本轮交接，独立 fresh reviewer 裁定 **SHIP，无阻塞项，仅限本地只读预览**。继承的装饰太阳仍与移动端声明重叠，为非阻塞限制；未完成真实麦克风及辅助技术（AT）的全面验证。本次文档收尾未重新运行测试或扩大验收范围。
