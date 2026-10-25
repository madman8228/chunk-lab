# 渐进搭句交互 V2

## 教学流程

从同一表达逐层扩展：

1. 用「I need」和「water」拼出 `I need water.`
2. 重新拼整句，把对象扩成「some water」：`I need some water.`
3. 重新拼整句，再加礼貌词块「please」：`I need some water, please.`
4. 保持结构，替换对象词块为「some food」，完成迁移：`I need some food, please.`

每一轮都从空白句槽开始；只能用当前目标词块重组，不提供整句选择项，不提前显示英文答案。完成后才把中英整句追加到始终可见的累计列表，并播放已有整句音频。错误时不显示正确顺序；可以点已拼词块撤回。全流程鼠标可完成，键盘焦点可访问。

## 范围与边界

新版入口为 `/progressive-building-preview-v2.html`。原 `/progressive-building-preview.html` 及其数据、代码和报告保持不变。复用现有试教音频；过程仅在当前页面内存中运行，不接入课程播放器、不写账户学习记录，也不发布到课程目录。该原型只验证用户指定的组句交互思路，不作为教学效果或掌握度证明。

## 检查

- `node --check src/progressive-building/view-v2.mjs`：通过。
- 在本地浏览器检查首步、逐步重拼、累计列表及最后的迁移句；该检查不代表正式课程审批。
