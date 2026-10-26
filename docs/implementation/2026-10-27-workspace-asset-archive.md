# 工作区素材归档 — 2026-10-27

已完成私有资产归档，未删除或移动源文件，未修改课程引用、账号数据、学习记录或备份。

- 私有仓库：madman8228/chunk-lab-assets，已通过 GitHub API 确认 PRIVATE。
- 本地批次：E:/chunk-practice-assets/deliverables/workspace-archive-20261027-v1/。
- 私有提交：228d4a100553076c07d599ac3f4d3716534c887d。
- 远端分支：codex/archive-workspace-20261027；远端引用已核对。
- 3207 张哈希命名 WebP：内容已在私有仓库跟踪；逐一读取实际文件校验 SHA-256，与本地源文件一致。inventory.json 保存源路径至已有资产路径的映射，不重复保存媒体。
- 新增归档：16 个 WAV，以及 --manifest/assets/ 下 4 张来源待确认的图片。这 4 张图仅作证据归档，不代表通过教学配图审核。
- 历史恢复：从主仓库 HEAD 另存 default-bubble-v2.webp、default-butterfly-v2.webp、default-dragonfly-v2.webp 和 vocabulary-scenes-v1.prompt.md。原工作区删除记录保持不变，未提交删除。
- 全部 3231 条归档映射均校验实际字节及 SHA-256。23 个本批次二进制文件由 Git LFS 跟踪；新上传 12 个去重对象、约 999 KB。另用全新 LFS 存储目录从远端回读全部 23 个二进制文件，并按批次清单逐一核验大小与 SHA-256。
- 私有仓库已有大量其他未跟踪内容，本批仅提交 26 个文件，不混入其他工作。采用独立 inventory.json，未重写全库 content-assets-manifest.jsonl；本批需按独立清单恢复。
- 公开主仓库 .git/info/exclude 增加 3227 个精确源路径的本地排除项，防止误提交媒体；源文件仍原地存在，不影响运行。其他机器需按私有批次清单同步资产，这些本地排除项不会随代码传播。
- output/asset-archive-remote-verify-20261027-v1/lfs/ 保存本次独立远端回读证据，不进入公开仓库。

恢复时先读取私有批次 inventory.json，按 source 定位原目标、archivePath 读取私有副本，并校验 bytes/sha256。只恢复缺失目标；非空且哈希不同的目标不得覆盖，必须另行获得明确授权。历史删除项需单独决定是否恢复，归档不代表恢复授权。

本次仅公开提交本说明；其他会话新出现的渐进搭句改动未暂存或修改。原始素材、数据库、已发布包和备份保持原状。
