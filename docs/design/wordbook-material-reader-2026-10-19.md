# 单词本材料阅读扩展

范围：wordbook-details.html、landing/wordbook-details.js、assets/wordbook-details.css。Read 模式；在既有详情页内扩展，不新增一级入口。用户已批准方案 P2：有材料才显示分类，逐轮阅读，中文按需，阅读不记答题成绩。

## Direction contract

THESIS: 让用户在已选单词主题内读到具体语境，不把词表、材料形式和练习方式混成分类。保留原单元目录和续学链接。

OWN-WORLD: 继承当前天空花园背景、暖纸面与棕色文字；仅一层阅读纸面，正文不套气泡或多层边框。

STORY: 打开主题先见原有单元。只有服务端声明有材料时出现对话／短文入口；选择后按需读取，逐句突出明确引用的词义，中文原生展开。练习仍走原词书入口。

FIRST VIEWPORT: 紧凑导航、原标题和续学入口、内容类别按钮、当前单元或阅读正文。阅读文本限制行宽，手机自然换行，按钮至少44px，不增加顶部装饰高度。

FORM: 既有页面局部扩展，无新视觉方向或概念抽签。code-first。标志交互为逐句展开中文；不加装饰动画，遵循原生details的可访问行为。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

验收：桌面／手机／键盘、目标高亮、长内容、中文展开、无材料入口隐藏、请求失败重试与版本不一致、账号变化取消旧响应。只读请求且不预加载插图。无新增图片；原课程内容、图片、学习记录和服务均不改。

## 本轮验证与复核

- `node scripts/wordbook-materials-ui.test.cjs`：材料按需读取、失败重试、v1→v2 持续升级后显式刷新恢复、已确认版本缓存、目标高亮、逐句中文键盘展开、账号变动取消展示；所有材料请求只读。
- `node scripts/wordbook-details-ui.test.cjs`：无材料入口隐藏、原单元预览／返回、旧版目录与 1440／918／390／360 宽度回归。
- `output/playwright/wordbook-materials/reading-1440.png` 与 `reading-390.png` 已打开核对。独立 finish reviewer 首轮提出版本变化后的重试死路；修复并重拍后，verdict pass 对这一项评为 resolved、disposition:ship。该结论只覆盖此修复，不宣称全站无问题。
- 独立 documenter 对照源码、PRODUCT.md／DESIGN.md、方向合同与两种截图，确认是既有视觉体系的局部扩展；不改 DESIGN.md／sidecar，不修复无关的旧文档漂移。没有新增交付图片。
- detector 仅给出与全局文档比对的字号／圆角／颜色 advisory；局部新增项沿用原页面字号和暖黄色。认知负荷：材料分类仅有内容时出现；中文默认收起；不增加一级入口或成绩统计。
