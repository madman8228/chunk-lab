# CoursePackage 2.0 导入方实现说明

## 边界

`courser-creator` 负责生成标准课程包，`chunk-practice` 只负责验证、保存和运行课程包。导入方不会把 2.0 课程改写成 1.1 的 `story.nodes`，也不会根据台词文本猜测角色、意群或答题方式。

旧的 1.1 包继续走原有兼容路径：只有明确声明 `article + typing_only`、`sourceText` 和 `english-typing-v1` 的包才会被接受。1.1 不会被隐式升级成意群选择或角色扮演。

## 2.0 课程模型

- `utterances[]` 是可学习台词；`sequence[]` 是唯一的学习顺序。
- `roles[]` 和 `utterance.roleId` 是角色关系，导入方不使用默认 NPC 猜测。
- `acceptedAnswers.en` 只用于需要文本答案的练习。
- `chunks.items + correctOrder + distractors` 只用于意群选择，不由播放器临时切句。
- `capabilities` 是课程包对内容能力的声明；导入方只允许在能力为 `true` 时开放相应模式。
- `capabilityReasons` 用于解释为什么某个模式不可用。

## 使用方可选模式

打开 2.0 课程后，学习者可以按句选择：

1. 输入：使用 `acceptedAnswers.en` 校验。
2. 意群选择：使用 `chunks.correctOrder` 校验，不生成新的意群。
3. 跟读：播放音频后由学习者确认完成，不强制依赖 ASR。
4. 角色扮演：按当前台词的 `roleId` 显示角色并确认完成，不把所有台词归给同一个 NPC。
5. 听写：播放音频后输入英文，使用 `acceptedAnswers.en` 校验。

不具备条件的模式会禁用并显示原因；不会静默降级为输入模式。模式选择不会修改课程包本身，切换模式也不会改变 `sequence`。

## 导入校验

2.0 导入流程依次检查：

1. ZIP 路径安全、压缩大小、文件数量和解压大小。
2. `package-manifest.json` 的版本、身份、排序、文件大小和 SHA-256。
3. `contentHash` 以及 ZIP 中不存在未声明文件。
4. 包内 `course-package.schema.json` 的 JSON Schema。
5. `assets`、`roles`、`utterances`、`sequence`、chunks、能力声明之间的引用关系。

协议文件是课程包的一部分，`COURSE_PROTOCOL.md` 必须存在。测试向量是 1.1 的必需兼容材料，2.0 不强制使用 1.1 测试向量格式。

## 回归入口

- `node course-package-contract.test.js`
- `node e2e/course-package-import.test.js`：旧 1.1 typing-only 包。
- `node e2e/course-package-v2-import.test.js`：2.0 完整能力包，覆盖导入、意群选择、输入和完成进度。

默认 2.0 回归包来自 `courser-creator/tests/fixtures/course-v2-complete.zip`，也可以通过 `COURSE_ZIP_V2` 指定其他 2.0 包。
