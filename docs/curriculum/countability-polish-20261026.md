# 可数与不可数 · 2026-10-26

状态：16步预览已实现、通过验证，待用户验收，未正式发布。

## 范围与路径

two books → water → some water → I need some water → 可数性概念辨析 → milk → some milk → some也接可数名词复数 → a glass → of water局部 → a glass of water → two glasses of water联动 → 数的是单位辨析 → two glasses of milk → You need some milk → 独立输入You need two glasses of milk。

本课按教学义项记录可数性：book为一本本的书、water/milk为物质、glass为容器。不可数不是现实中无法测量；精确表达引入单位。some不是不可数专用；water在点单指份数等其他义项不作绝对禁止。of water为计量短语中的内容片段，不作为完整句子或动作“装”教学。整个计量短语作宾语，单位glasses加es、物质milk保持原形。

## 可复用数据与边界

countability-lexicon.mjs按词义记录count/mass及审核过的单位复数；massQuantity组合some+物质或数量+单位+of+物质。未审核义项拒绝，直接指定物质精确数量却无单位拒绝。未进课堂的rice与bottle通过some rice、two bottles of water测试；这是内容生成复用证据，不是学习者掌握证据。当前仅一/二数量、a冠词；不推广到任意单位、an、复合单位或所有名词义项。

## 图片

复用现有单杯水图。内置imagegen新生成四宫格：空杯、两杯水、倒入杯中的牛奶、两杯牛奶。四个WebP分别3742/5438/3704/3418字节，512×288，完整图适配不裁物体，原图/母图保留。目录output/progressive-building/countability-20261026。

原始生成前batch.json+plan.json记录初始预检；生成图横向分界偏移，按实际分界423重新记录精确裁切batch-crops.json，经相同catalog重新预检为plan-crops.json，包装使用该清单/计划。报告batch-crops.report.json包含路径/大小/哈希与rect。原图ref/words-pic/atlases/pb05-countability-20261026-v1.png。新图待用户视觉验收，未修改旧课程引用。

## 验证

全预览数据校验通过；可数性义项/单位约束/留出词/图片大小哈希/合理答案测试通过，复数/the/a-an/数量课回归通过。浏览器走通16步，三种概念误选不通过，单位单数错误纠正，局部单槽、整句二级空白、独立题历史隐藏，错误glass/milks/漏of拒绝，正确表达接受。937px与390px截图已检查。手机长词行保持横向滚动，页面无横向溢出。未操作正式服务或账号数据。

显示层级修订：一级合成区也承载本课显式合成的计量短语，第11/12/14步（一杯水/两杯水/两杯牛奶）纳入一级显示编排。它们仍标注名词短语，不当作完整句子教学。局部a glass和of water留在二级，合成时二级清空。

2026-10-26 用户确认打磨完成。当前子课标记已打磨，未正式发布。后续遵循渐进组句主线，不逐词扩展零散知识。
