# 教材生产推进：图片复用与课程进度

执行日期：2026-10-22。依据负责人“按照这个建议，开始执行”推进图片复用、清单汇总和下一批例句审阅准备。

## 已生成的版本

- 共享目录：`output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json`。
- 来源目录 SHA-256：`807f7435d344a7f4645650ad1992763eb0d43ea4b6009b36e781f1c5dc994b17`。
- 消费审核记录 revision 482：477 组批准共用、1,027 条课程绑定；唯一图片由 4,374 个减少为 3,829 个。课程本地图片键保留，目录别名映射到所选图片的不可变哈希。
- 课程进度：`output/textbook-production-status/20261022-v2/STATUS.md` 和 `status.json`。19 册共 3,642 条原创例句，逐条按来源与句子摘要匹配实际审核事件；音频按每册交付清单统计，并列出最新课程包、本地激活发布版本、待核定教材与高中预览快照。
- 九年级全一册最新课程包由清单识别为 `20261021-v20`，包含 1,256 条音频。历史 README 的版本及音频说明不作为状态来源。

## 重建与验证

    node scripts/build-textbook-production-status.cjs --catalog output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json --out output/textbook-production-status/<新版本>
    node scripts/verify-reviewed-vocabulary-delivery.cjs output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json output/vocabulary-illustrations/reuse-reviews/<新的核验报告>.json

核验覆盖所有实际图片的哈希、尺寸及严格小于 20,000 bytes 限制；所有获批分组别名；与本地已有发布回执兼容；隔离 HTTP 重定向、内容哈希、immutable 缓存、HEAD 和 ETag/304。

实际核验报告：`output/vocabulary-illustrations/reuse-reviews/delivery-verification-20261022-v1.json`，3,829 张交付图和 477 组全部通过。目录 SHA-256：`ee9e60e0760ead7451d6c5b557e0bcac1eb83241d79f5f85d6dee0ccd1148850`。相关现有图片与例句审核测试 17/17 通过；进度表数量及版本核对通过。

实际启用该图片目录时，主服务启动配置使用：

    VOCAB_IMAGE_CATALOG=D:/06-project/chunk-practice/output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json

本次生成与隔离验证不代表运行中的 8787 已加载此目录；该配置在服务启动时读取。远端图片上传和远端服务配置应按部署目标单独执行。

## 下一批例句

[七年级上册 Starter Unit 1，21 条](http://127.0.0.1:4199/?bookId=textbook-wordbook%3Apep-junior-grade7-upper-2024&unitId=starter-unit-1)。审核页支持教材/单元直达链接。审核确认后才进入派生句子队列，按每册原目录生成 WAV 母版和 Opus 交付，不将图片复用审批当成例句批准。

## 课程库现场切换准备

已对默认本地 `server/data/chunklab.db` 执行只读迁移预检，生成 `output/textbook-production-status/20261022-v1/course-library-migration-preview.json`，含 17 条内容映射。该文件是预检清单，不是数据库备份。真实应用前应重新验证目标进程的数据目录和源摘要，再按既定一致性备份及迁移流程执行；源内容变化会使预检清单失效。

已用 SQLite backup API 创建一致性备份 `D:/chunk-practice-backups/20261022-course-library-rehearsal-v1/chunklab-consistent-backup.db`，在新分配的临时目录恢复副本后运行迁移演练。恢复副本 `quick_check=ok`；迁移被素材检查阻止，真实数据库未应用迁移。报告同备份目录的 `rehearsal-report.json`。

阻塞来源为 `lesson_1_excuse_me` 的 4 个历史账号副本，每份 15 个素材描述符缺少内嵌文件，共 60 个阻塞引用。相同课程在另一个历史副本中保留 15 份内嵌素材，且原课程 ZIP `extra/lesson_1_excuse_me-1.0.0.course-package.zip` 仍包含 15 个素材文件，因此该结果不能解释为原资产已删除。恢复前还需逐副本比对课程内容和素材身份，形成明确的恢复映射；不能仅凭相同素材 ID 回填真实记录。`scripts/rehearse-course-library-migration.cjs` 可在新的备份目录重做演练，默认只应用到新分配的临时副本。

本轮未执行真实迁移、账号记录写入、远端发布或 live 服务重启。原课程包、图片、WAV 和既有备份保留。
