# 教材提交推送与远端恢复核验

所有者同意继续执行“推送并核验远端备份，再盘点尚未进入制作流程的教材资料”。

- 代码远端：`madman8228/chunk-lab`，分支 `stabilize/p0-1-20261021`，已推送并核对 `b2b328f1db36d6d9e536d2a850295a5dd0872a54`。
- 私有资产远端：`madman8228/chunk-lab-assets`，分支 `master`。五年级上册归档 `4c935833e949dfa31a7c1c1e8a2274e2e19ea35c` 已推送。
- 进一步发现六年级上册完整候选包尚未入私有版本库，已核验原包后，仅归档其 `20261028-release-candidate-v1`，提交并推送 `6d1202ded2f969756128b674a2d5e94931e14404`。未修改或删除旧课程内容。
- 新建临时Git检出与空LFS存储，从GitHub读取分支及清单，下载媒体后按manifest记录的SHA-256和字节数复核。未复用本机私有资产仓库的LFS对象缓存。
- 五年级上册全部288个媒体对象远端下载、校验通过。日志见 `output/textbook-publication-20261028-jingtong-grade5-upper-v1/remote-recovery-verification.json`。
- 六年级上册全部336个媒体对象远端下载、校验通过。日志见 `output/textbook-publication-20261028-jingtong-grade6-upper-v1/remote-recovery-verification.json`。两册共624个媒体绑定完成远端恢复核验。

## 来源资料盘点边界

已有规范音频队列的教材bookId均已在公开目录找到，共22门公开词汇课程。对只有提取目录但没有同名队列目录的资料进一步区分：

- 七／八年级上下册 `people-grade*` 提取目录，在制作目录及公开目录使用 `pep-junior-grade*` 身份；属于命名映射，不是漏课。
- `primary-grade3-upper-20261014` 对应已发布精通三年级上册136条；不是新教材。
- 四年级上册r2、五年级下册first-pass和明确superseded/misclassified资料是历史候选，保留而不自动发布。
- 一年级起点五年级下册2013的96条资料仍需核定具体系列及教材身份；未进入自动制作或发布。

当前没有证据支持自动启动新的教材生产。后续扩充应先核定待制作来源身份与范围。已批准保留的音标缺项继续保留。
