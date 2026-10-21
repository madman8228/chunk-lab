# Unit 1 / Unit 2 保存位置调查（2026-10-15）

两套课程完整存在：Unit 1 为40词、160个当前配图文件；Unit 2 为59词、236个当前配图文件。共396个文件全部存在，每个严格小于20,000 bytes，最大分别为19,964和19,954 bytes。

原因：此前代理把开发者的“新增网站课程”误走为“保存到我的内容”。`js/wordbook-authoring.js:702` 的保存按钮调用个人 API；`server/services/personal-wordbooks.js:54` 用账户和草稿编号派生个人编号。因此 Unit 1 目前在 user 29，Unit 2 在 user 27。两条原记录均保留。公共入口实际为管理员 `/api/admin/wordbooks/validate` 与 `/api/admin/wordbooks/publish`，使用稳定教材编号及独立发布目录。当前公共目录只有六词练习，两套教材尚未上架。

原教材草稿位于 `output/textbook-extractions/people-grade9-full-2013-20261015/unit1-pilot/wordbook-draft.json` 和相邻 `unit2-pilot/wordbook-draft.json`。草稿、原图目录被 Git 忽略，代码提交不能代替课程资产备份。此前 README 的“未导入账号”已落后于数据库实际状态。

独立完整备份目录：`D:/06-project/course-asset-backups/grade9-unit1-unit2-2026-10-15T09-18-57-247Z`。

备份含588个项目资产文件，共222,244,635 bytes，每个复制后核对 SHA-256。覆盖两套草稿、来源与审阅资料、批次映射、预览、当前配图、全部 ref/words-pic 原图及原公共词书目录。另存两份原教材编号的公共候选包 prepared-unit1.json / prepared-unit2.json、个人词书原始记录和完整数据库在线一致性快照。manifest.json 记录文件大小与哈希。

数据库快照通过 VACUUM INTO 创建，integrity_check=ok，含两条个人词书。快照 SHA-256：`9d9a0f7f7c061103b9add4a39ff4d93464e994322b12e9827e8c6e14f604c352`。

两份公共候选包已通过现有发布器只读校验，素材、数量及编号均通过；未执行发布。下一步应以原教材编号进入网站公共课程库，保留个人副本。发布目录及 assets 必须和数据库一起备份。

这是同盘项目外副本，可保护项目内误清理，尚不能覆盖磁盘损坏。备份含账户数据库，应私下保管。建议另存异盘或私有远端。

本次调查仅新增备份、审计脚本和本记录，没有修改账户、学习记录或原课程，没有重启服务。
