# 八年级上下册后台待审核

2026-10-22，负责人授权继续制作课程包并导入系统内置课程后台待审核。本次没有上架。

| 教材 | 词条 | 唯一交付素材 | 后台草稿 | 状态 |
| --- | ---: | ---: | --- | --- |
| 人教版英语 八年级上册（2024） | 507 | 1521 | 57bf0d3a-b50f-40d0-b356-abfcb4f7fcfc | validated，待后台审核 |
| 人教版英语 八年级下册（2024） | 592 | 1775 | ed9f49b9-1bd1-4228-9c6e-75ff8299f10a | validated，待后台审核 |

交付包分别位于 `E:/chunk-practice-assets/textbooks/pep-junior-grade8-upper-2024/revisions/20261022-system-import-v1` 和 `E:/chunk-practice-assets/textbooks/pep-junior-grade8-lower-2024/revisions/20261022-system-import-v1`。源母版仍保存在原始资产目录，未加入 Git。图片同一 WebP 供桌面与移动端使用，每张严格小于 20000 bytes；发布音频为 Opus。

打包器从当前生产核验结果读取逐条审核、图片及两类音频绑定，目标词在句中的变形/搭配由 `scripts/grade8-import-target-bindings.json` 明确记录，拒绝只截取单词子串作为填空答案。当前适配范围明确限制为八年级上下册 PEP 2024。两册分别完成包内摘要核验、全局词条身份限定、临时目录搬迁复核和后台素材/课程校验。单元练习的最终后台审核仍待负责人操作。

八上 Unit 8 `unit-8:entry:025` 的 detail 原句没有目标词。负责人明确批准改为：

> Please include the meeting details, such as the place and time, in your message.
>
> 请在消息中写明会面详情，例如地点和时间。

修订对应审核记录 revision 3645；旧单元源稿及审核状态保留于 `E:/chunk-practice-asset-sources/textbooks/pep-junior-grade8-upper-2024/revisions/20261022-detail-v1`。只生成这一条新句子音频，批次为 `E:/chunk-practice-asset-sources/textbooks/production-plans/20261022-grade8-detail-v1`。新音频为 mono Opus，18348 bytes，4.629083 秒，SHA-256 `b926032f45a5487a25f6e8d7a511589ffd617b6c4b4b9cf0a28782398a32033f`。已做文件核验，尚待抽听；旧音频未删除。

导入前通过 SQLite backup API 创建并复核备份 `D:/chunk-practice-backups/20261022-grade8-lower-staging-v1`，含两个数据库及现有课程目录，共6012个文件，manifest记录源目录和摘要。真实目标数据目录为 `D:/06-project/chunk-practice/server/data`。两次操作均为新增系统课程后台草稿，没有写个人账号课程或学习记录。
