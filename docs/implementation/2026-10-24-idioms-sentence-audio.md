# 高频短语句子音频

范围：系统内置课程 `builtin:idioms`，句库 `builtin-freq-idioms`，418 个原句与原 cid。用户要求补齐所有句子音频、组装完成后播放，并重新上架。

## 素材与构建

- 生成：`scripts/generate-idioms-sentence-audio.py`，使用项目已有 Kokoro ONNX、`af_heart`、美式英语、1.0 倍速。
- 原始 WAV、源课程快照、带 cid/文本/时长/字节数/SHA-256 的音频清单保存在 `output/audio-production/freq-idioms-sentences-v1`。
- 浏览器交付为 24 kbps Opus/Ogg；每句一个不可变文件，放入 `assets/`。保留 WAV 原件。
- `scripts/release-idioms-sentence-audio.cjs` 校验完整的 418 条映射，生成 `sentenceAudio` 课程资料，在独立输出目录重建并确认其它课程分片不变。
- 不带参数先校验；显式 `--publish` 时备份当前清单、保留旧分片，发布覆盖源和新的内容 hash 分片。发布回执记录版本与备份路径。
- 课程身份、句子身份、正文、意群和其它教学字段保持一致。发布不执行账号导入、加入学习或学习记录操作。

## 播放

`speakSentence()` 优先播放课程媒体 URL 或 `sentenceAudio.audio.url`，保留播放失败时原有浏览器朗读降级。高频短语每次完成组装时自动播放；完成函数的防重入保护继续生效。其它课程仍遵循个人朗读设置。只加载当前句子音频。

## 验证

- 每个生成文件均经 FFmpeg 解码检查。
- 隔离 Chromium 抽查 Ogg 解码及有效时长。
- `node scripts/idioms-completion-audio.test.cjs`：完成后播放一次、其他课程设置、只读预览和保存行为。
- `node scripts/practice-footer-actions.test.cjs --audio-only`：课程音频优先、播放结束/暂停状态、旧回调隔离。
- 原完整 footer 检查在重置选择后的状态断言处失败；未计为通过，未扩大本次修改范围。
- 发布完成后检查内容可重建性、SW 版本一致性、在线课程版本和音频响应。
