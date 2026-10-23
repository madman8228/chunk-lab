# 开发测试账号清理与课程保全执行记录

- Status: complete-for-reviewed-account-batches
- Updated: 2026-10-22
- Workspace: D:\06-project\chunk-practice
- Base commit: 400f67b；保留既有大量未提交更改。

## 范围与授权

用户在审阅账号候选表后授权按建议处理，明确旧账号均为开发测试使用、个人学习记录无需保留，课程不可丢失。本轮执行已盘点的 24 个空账号、4 个重复课程账号，以及 2 个只有学习记录的账号。其余承载课程内容的账号先保留，手机号账号 37 保留。该授权不延伸为删除原始浏览器数据、课程资产、备份或任意未列入清单的账号。

## 在线目标确认

- 8787 监听进程 40616，命令为 `node server/index.js`。
- 只读读取进程的指定路径配置：cwd 为项目根目录，`CHUNKLAB_DATA_DIR` 为空，`NODE_ENV=production`。
- 对照 `server/db.js` 默认路径，确认实际库为 `D:\06-project\chunk-practice\server\data\chunklab.db`。
- 读取过程只输出路径和运行模式，没有输出密钥、手机号或密码散列。

## 一致性备份与恢复演练

- 使用现有 `server/backup-db.js`，以 SQLite `VACUUM INTO` 保存完整库，并验证备份素材 2573 个文件。
- 备份目录：`server/backups/test-account-retirement-20261022-095427/`。
- 数据库：`chunklab_db_20261022_095427.db`，108023808 bytes。
- SHA-256：`850eab2631003040410948a406fc0953a33f61c6a59e16ff3deac1124495d5ca`。
- 恢复到新建临时目录，两批删除均先在该目录的数据库副本执行；没有在在线库运行测试进程或测试服务。
- 完整性检查、外键检查、其他账号和剩余课程保全检查通过。备份原件未被修改或删除。

## 已执行

1. 删除 24 个无课程、无学习记录账号：2–10、13–21、23、28、33–36。序号、访问日志、初始设置同步清理；课程表摘要完全不变。
2. 保全《Lesson 1 — Excuse me!》完整来源：账号 1 的原包与 22/24/25/26 的副本只有素材数据字段和 `logicalCourseId` 差异，教学结构摘要一致。保留两种不同的原始 JSON（四份重复原包去重存储），以及完整原包中的 8 个图片和 7 个音频。
3. 独立来源档案：`server/backups/test-account-retirement-20261022-095427/system-source-lesson1-excuse-me/`。其 manifest 的 SHA-256 为 `e75145ccda192317266865975a517f1d14bf7cfea94e13b4aad5f85eb34cb13c`；教学结构摘要为 `b70fc853842f90c4e5ad8538be878c32e2c85aa6b1fb98250e80e8e0f769b876`。`ownership: system`，原账号 ID 仅作为出处记录。状态明确为 preserved source，不冒充已发布到学习目录。
4. 删除 6 个账号：11、22、24、25、26、31。包括 4 份已有逐字节保全的损坏课程副本和各账号测试学习记录。其他课程原包、词书、题组及当前账号不变。
5. 两批均使用显式数据库路径、明确账号 ID、只读预览清单、来源摘要和已验证备份；应用时在即时事务内重新核验，出现课程/身份/权限/数据变更或外键错误即回滚。

## 当前状态与后续边界

- 37 个账号清理为 7 个：1、12、27、29、30、32、37。
- 1、12、27、29、30、32 暂存独有课程来源、词书或题组；不能在课程迁出前继续删除。账号 37 保留登录身份。
- 正常登录已强制鉴权、手机号启用时拒绝旧注册入口、开放默认账号仅可用于显式隔离测试；当前前端没有静默注册 guest 的调用。只修正 auth 中将历史行为写成现状的注释。
- 系统内置课程应走现有管理员发布目录；没有把旧账号课程设置 public 来伪装内置课程，也没有增加新的旧版播放器。1.1 剧情原包作为完整内容源保留，后续须明确接入既有受支持学习格式的方案，不能静默展开剧情而丢失分支。
- 本轮未重启或切换在线进程；账号清理已经作用于在线库，WebP 交付等工作树代码尚未因此自动部署。

## 验证证据

- `node scripts/retire-test-accounts.test.cjs`：拒绝含课程/身份数据账号、清单变化/篡改拒绝、缺失或变动归档拒绝、一致性备份、事务、其他课程保全通过；自动测试发现器会纳入本测试。
- `output/empty-test-retirement-20261022-v1.json` / `output/empty-test-retirement-rehearsal-20261022-v1.json`。
- `output/preserved-test-retirement-20261022-v1.json` / `output/preserved-test-retirement-rehearsal-20261022-v1.json`。
- 原始审查 `output/account-retention-audit-20261022-v1.json` 和审查说明保持为清理前证据，不能当作清理后的当前状态。
- 收尾检查 `output/test-account-retirement-final-20261022.json`：在线健康 200、未登录个人数据请求 401，前后均为 7 个账号，未自动创建游客；`quick_check=ok`、外键错误 0，仍保留 3 个账号课程原包及 2 个试点词书版本。
- 清理后只读迁移预览：`output/independent-course-post-retirement-20261022-100524.json`，13 项课程/题组来源、素材阻断 0，摘要 `dc792fa41d0721e092292219899fec28873a5a03f259242f4f00a2a44cb9bdce`。这只是来源迁移可行性证据，不代表已将剩余内容发布到系统目录，也不意味着可以直接套用旧私有课程迁移策略。
