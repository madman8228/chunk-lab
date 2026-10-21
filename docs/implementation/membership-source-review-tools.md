# 存量课程来源检查与候选包

这组工具用于准备转换材料。它不会安装注册表、修改课程访问级别、写账号数据库或转换真实学习记录。后台“检查课程来源”也是只读操作，检查后会员选项仍保持禁用。

## 使用方式

在项目目录运行，显式指定网站静态根和课程编号：

```powershell
node scripts/prepare-protected-courses.cjs --app-root D:/06-project/chunk-practice --course builtin:idioms
```

需要生成候选包时，增加一个尚不存在的新目录；推荐放在禁止公开静态读取的 `output` 下：

```powershell
node scripts/prepare-protected-courses.cjs --app-root D:/06-project/chunk-practice --course builtin:idioms --output D:/06-project/chunk-practice/output/idioms-candidate-new
```

重复指定 `--course` 可准备多个课程。重复使用已有输出目录会报错，不覆盖其中任何文件。工具不会执行课程 JavaScript。当前转换器支持本站 manifest/shard-map 对应的完整句子课节；不支持的课程格式会明确拒绝，不会跳过部分内容后输出残缺课程。

## 核对材料

- `review.json`：分片哈希与数量检查、历史/压缩副本的本地文本证据、共享课程、已检查的公开分享冲突，以及尚未检查的压缩包/文档。命令行不连接账号数据库，因此 `publicSharesChecked` 为 false；后台接口会检查当前服务器的公开题库。
- `candidate.json`：原课程与课节编号、正文来源、旧题库别名、原学习统计键和 generation scope 的映射。`activationReady` 始终为 false。
- `course-*-unit-*.json`：新的私有正文候选文件。原始条目编号和教学字段完整保留，逐文件哈希列入报告；原文件不删除、不改名、不覆盖。

本地字面文本扫描不能证明动态拼接、其他编码、外部 CDN 或已下载副本都已覆盖。报告明确标注 `local-literal-evidence-only`，不能作为自动收费认证。

## 启用前的边界

候选包不能直接改名为在线 `registry.json` 使用。启用还需完成旧学习键/断点与受保护运行入口的适配，重新检查当前公开分享、所有正文出口及正式服务器/CDN配置，并在隔离实例验证。涉及真实课程、数据库或账号的转换，须由所有者明确授权具体课程和目标，再按 AGENTS.md 创建并验证一致性备份。当前工具不执行这个步骤。
