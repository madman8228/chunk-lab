# 课程内容资产仓库（私有）

日期：2026-10-21。本文说明为什么课程图片/音频不进入公开主仓库，以及它们现在存在哪里、如何校验和恢复。

## 背景

主仓库 `chunk-lab` 是 **public**。教材词书插图、教材目录图、场景音频和词书草稿属于课程内容资产，既不应公开分发，也不适合用普通 Git 对象长期保存：

- 当前待入库资产为 6,353 个文件 / 约 105 MB（6,172 张图、116 个音频、154 个草稿文件）。
- 加上已跟踪的站点视觉素材后，完整 `assets/` 为 6,315 个文件 / 102.7 MB。
- 这些文件是 P0-1 备份中的核心不可再生资产，不能只留在工作区。

因此建立私有仓库 **`madman8228/chunk-lab-assets`**（Git LFS），作为内容资产的版本化主副本。主仓库只保留代码、文档、清单和小体积站点素材。

## 私有仓库内容

| 目录 | 文件数 | 大小 | 说明 |
|---|---:|---:|---|
| `assets/` | 6,315 | 102.7 MB | 词书插图、教材图包、场景音频、站点视觉 |
| `drafts/` | 154 | 14.0 MB | 词书草稿与审阅版本 |
| `content/` | 285 | 6.3 MB | 已发布/草稿内容分片、词汇 pilot 数据 |
| `extra/` | 122 | 13.9 MB | 口语书输入源与批次输入 |
| **合计** | **6,876** | **130.5 MB** | |

二进制媒体由 Git LFS 跟踪：`*.webp *.avif *.png *.jpg *.jpeg *.ico *.mp3 *.ogg *.wav *.mp4 *.woff2 *.ttf`。JSON、HTML、CSS、Markdown 和清单仍为普通 Git 对象。

仓库根目录的 `content-assets-manifest.jsonl` 记录每个文件的 SHA-256、字节数和相对路径；`content-assets-summary.json` 记录汇总；`verify-manifest.cjs` 可重新校验：

```powershell
git clone https://github.com/madman8228/chunk-lab-assets.git
cd chunk-lab-assets
git lfs pull
node verify-manifest.cjs
# 期望：OK 6876 files
```

## 主仓库的边界

以下路径已被 `.gitignore` 排除，不会误提交到公开仓库：

```
/assets/vocab-*
/assets/highschool-*/
/assets/scene-*
/assets/vocabulary-*.png
/assets/*.mp3
/assets/*.ogg
/drafts/
```

主仓库仍保留并跟踪：`assets/` 下的 CSS、品牌图、默认封面、站点背景图，以及 `content/` 中的小型内容分片。

## 同步流程（新增或修改资产后）

1. 在正常工作区生成/修改资产。
2. 将变更同步到私有仓库工作区（当前为 `E:\chunk-practice-assets`）：
   `robocopy <主仓库>\assets <私有仓库>\assets /E`
   （`drafts/`、`content/`、`extra/` 同理）
3. 重新生成清单并校验：
   ```powershell
   node make-asset-manifest.cjs <私有仓库> <私有仓库>
   node verify-manifest.cjs
   ```
4. 在私有仓库提交并推送；LFS 会自动上传媒体对象。
5. 每月至少执行一次 `git lfs pull` + `verify-manifest.cjs` 恢复演练。

## 不可忽略的限制

- **不要把这个仓库改成 public**，除非完成版权审查。
- GitHub LFS 免费额度为 1 GB 存储 / 1 GB 月流量；当前约 130 MB，新增批次前先看用量。
- 私有仓库是第二份副本，不是完整灾备：`ref/`（约 7 GB 外部书源）仍不在其中，需要独立的离线/对象存储备份。
- 主仓库的 CI 不访问私有仓库；内容校验依赖本地 `verify-manifest.cjs` 和发布前检查，不会在公开 CI 中拉取课程素材。
