# 口语3000句：全课程句子音频

用户授权：沿用高频短语的声线与 Opus 格式，为整个口语课程补齐音频并执行相同发布流程。

核对当前内置目录：`builtin:oral`，65 个课节、3259 句。包括 `oral-basic` 和其余 `oral-*` 课节；按实际目录范围执行，不将品牌名当作句数。

## 可恢复生产流程

1. `node scripts/release-oral-sentence-audio.cjs --prepare`：只读当前发布清单及课节分片，保存完整源码快照，精确匹配可复用的同声线文本。
2. 使用项目已有 Python 环境运行 `scripts/generate-course-sentence-audio.py --batch output/audio-production/oral-3000-sentences-v1 --workers 4`。Kokoro ONNX、`af_heart`、en-US、1.0 倍速。每个进程两个 ONNX 推理线程。
3. WAV 原件保留在批次 `masters/`；Ogg 封装的 24 kbps Opus 放在 `delivery/`。复用文件保留来源，原 WAV 仍在先前批次。逐个运行 FFmpeg 解码检查。
4. `audio-manifest.json` 原子保存已完成记录，绑定源快照、模型和声线文件 SHA-256。中断后重新运行同一命令校验并跳过已完成项。
5. `node scripts/release-oral-sentence-audio.cjs`：核对覆盖率、文本、时长、大小和摘要，按原课节构建音频覆盖源及新内容 hash 分片到隔离输出目录；验证真实课程在生成期间未变化、全部教学字段与顺序保留、非目标课节分片不变。
6. `node scripts/release-oral-sentence-audio.cjs --publish`：先备份清单和已有覆盖源，再追加不可变素材与分片并切换清单；保留所有旧文件。回执记录新内容版本及备份目录。不操作账号数据或学习记录。
7. 更新 SW，检查内容可重建性、音频播放专项、线上清单及媒体响应。

## 学习行为

口语和高频短语的固定句子音频在组装完成后自动播放。采用 `statDeckId` 原课程身份，因此从复习列表进入也适用。完成函数保留防重入和只读预览保护。其它课程的朗读设置保留原逻辑。当前句子按需加载音频，不预加载整库。

验证命令：`node scripts/idioms-completion-audio.test.cjs`、`node scripts/practice-footer-actions.test.cjs --audio-only`、`node scripts/check-content-generated.mjs`、`node scripts/check-sw.js`。前两项为隔离测试，不连接真实账户。
