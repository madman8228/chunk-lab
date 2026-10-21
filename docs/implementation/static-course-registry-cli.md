# 静态课程目录运维工具

入口：`node scripts/static-course-registry.cjs`。无默认数据库或私有目录，所有路径显式使用绝对路径。工具不导入应用数据库初始化模块、不自动迁移表、不重启服务。

## 检查与准备

`inspect --app-root <应用根> --database <数据库文件> --private-root <私有内容根>`：只读打开现有数据库，输出目录版本、课程数及分片准备状态。

`prepare` 使用同样参数，再加 `--output <全新私有候选目录>`：只读原数据库/内容，生成独立v2候选与来源hash，保留原件。此步骤只转换已有私有目录；公开旧平台课程先由来源准备工具产生候选，不能把文本扫描当作完整来源认证。

## 启用前

真实环境须先得到所有者对精确数据库与目标目录的启用授权。逐项核对公开原始源、压缩/历史副本、素材/课程包、分享出口；在隔离实例验证原课程身份、记录、断点及全部入口。未完成时不得填写验证为true。

人工审阅JSON包含：`candidateHash`（candidate.json的SHA256）、`targetDatabase`（解析后的精确数据库绝对路径）、`targetPrivateRoot`（私有根绝对路径）、`publicSourcesVerified:true`、`runtimeVerified:true`、`evidence`（审查记录/证据说明）。此文件不是自动审批；工具不会自行认证来源。

## 启用

`activate` 使用上述根路径参数，再提供：

- `--candidate-root <候选目录>`、`--review-file <审阅JSON>`。
- `--expected-version <inspect输出版本>`、`--request-id <稳定唯一请求编号>`、`--admin-id <管理员编号>`。
- `--backup-file <全新备份文件路径>`。

工具先通过SQLite backup API生成一致性备份并运行integrity_check，记录备份hash；之后校验目录乐观版本、候选hash及原课程身份覆盖，只新增私有文件并事务写入启用指针/审计。原registry.json、课程文件、学习表不覆盖。失败保留备份及新私有文件，指针回滚。重试沿用相同请求/版本/审阅内容，提供另一全新备份文件；改变操作内容会拒绝。不要用覆盖原库的方式恢复已非空账号。

## 已验证范围

`node scripts/static-course-registry.test.cjs` 在新临时目录/数据库验证只读检查与准备、精确目标、备份、启用、幂等重试和拒绝覆盖备份。`node server/membership-unified-activation.test.js` 验证事务故障回滚、原文件/身份/合成记录保留。

尚未执行真实启用。全平台来源认证、跨课批量复习和最终性能仍是整体交付的未完成项。
