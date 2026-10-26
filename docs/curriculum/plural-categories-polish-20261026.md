# 复数分类教学与复用验证 · 2026-10-26

用户纠正：标题为“规则与不规则复数”，必须教学分类、构成条件与迁移，不能将整课变成child/children的反复操练。本版替代原11步预览，待用户验收；原教学记录保留于plural-forms-polish-20261026.md，不混称已验收。

## 教学范围

17步：六组单复数对照（a book/two books，a box/two boxes，a baby/two babies，a child/two children，a foot/two feet，a sheep/two sheep）→ 判断boxes仍属规则变化 → 选择foot/feet特殊配对 → 判断two sheep中sheep的数 → four数量单练 → 独立输入four sheep。

规则覆盖：常见加s；x/sh等结尾加es；辅音字母加y改ies。不规则覆盖：特殊配对children/feet、同形sheep。明确这些是代表类型，不是名词复数全部规则；不自动推广到所有f/fe、o、外来词或多种可接受词形。复数语义与构成方式分开教学。未知形式查资料，不猜词尾。

## 最小复用实现

- plural-lexicon.mjs：审核词形事实、类别、中文量词、可选图片键；只接受明确条目。规则给出解释并交叉验证事实，不从任意拼写猜复数。
- plural-practice.mjs：从条目生成一组单数/复数组装、条件讲解、标记和可选配图。课程负责显式挑选例词顺序与三个误解判断；不全自动生成教学目标。
- plural-forms-v3.mjs：组装上述类别课程，保留17步稳定预览入口。每步复用当前显示位置，历史不叠成更多层；独立题隐藏答案。

实际泛化检查：dish/dishes、city/cities、mouse/mice、bag/bags作为未进入本课的词，使用同一buildPluralPair，不改前端、不复制专用讲解。每组生成的课均通过数据校验。未知词拒绝生成，boxs与规则矛盾拒绝。该结果是内容结构可复用的证据，不是学生已能独立推导所有不规则复数的证据。

## 素材与验证边界

无新图片生成。book/books和child有已有适配图，缺少准确数量的box/baby/foot/sheep配图时不使用错误图片冒充，当前以文字对照表达；完整视觉素材仍待补齐。旧四人children图不复用为two children。

针对性检查覆盖五类、四组留出词、词形约束、独立迁移。浏览器走通17步，三种错误判断不能通过，four sheeps拒绝、four sheep接受，当前显示最多一项、独立题历史隐藏，390px手机无水平溢出。未发布、未写账号记录。

2026-10-26 用户确认当前分类教学版打磨完成，选择器标记“已打磨”。此为预览验收，不等同正式发布；缺失的部分例词配图仍按上述边界记录。
