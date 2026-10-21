# 可组合问句切分审核

## 已完成的规则调整

姓名、专业、年龄、身高四类精确问句不再因常用而享有一段豁免。缩写仍不逐字拆开，其他既有固定短语规则保留。本次没有修改课程内容、个人数据库或浏览器存储，也没有运行内容重建或发布。

`node chunk-shape.test.js`：修改前回归测试 8 项失败；修改后 622 项通过，0 项失败。

## 只读检查结果

按 server/content/shards.json 中当前引用的课程分片扫描：3,677 条记录，其中 532 条只有一段。按新判据发现以下 3 条需要修订。这个数字不表示其余单段句子已全部通过语言质量审核。

目标课程：oral-2-8-4。原分片：content/oral-2-8-4/oral-001-233c0f02aa32.json。

| cid | 原句 | 建议意群 | 建议提示 |
| --- | --- | --- | --- |
| f701e5ce | What's your major? | What's / your major? | 是什么 / 你的专业 |
| 4d62bdfa | How old are you? | How old / are you? | 多大年龄 / 你（问句） |
| f74e2382 | How tall are you? | How tall / are you? | 多高 / 你（问句） |

提示是结构辅助，不替代整句自然中文。修订还必须同步核对 grammar、alts、干扰项和其他按段索引的元数据，保持英文拼接与原句一致、cid 不变。

## 已批准并完成的新版本

所有者已批准以上三条精确目标。已修订 oral-book.js 中对应三条源码，生成新详情分片 oral-001-3fbfa6f152eb.json 与索引 oral-index-001-ae91ba041ad8.json；当前构建版本为 v1-035b9033e2978c774c257584fed515be0052e086e79b836701ff37c74d5b139a。

年龄问句的 grammar 和 distractors 均按两段对齐，保留原 explanations。另外两句原无这些按段字段，未凭空添加。原句、translation、cid、全部条目顺序与数量不变。新版本生成前后，136 个原分片全部通过逐文件 SHA-256 校验，未删除或覆盖。旧索引另存于临时构建目录 chunk-revision-20261013-2wKKJ7 的 previous-public-manifest.json 与 previous-shards.json；原内容分片仍在仓库原路径。

scripts/chunk-revision-20261013.test.cjs 在新临时输出目录重建，验证全库仅上述三条内容发生差异。规则回归 622 项通过、切分引擎回归 57 项通过、SW 哈希检查通过。未修改个人数据库、浏览器存储，也未重启本机或生产服务。未完成完整发布验收，不能据此宣称已上线或已更新现有个人课程。

## 尚未完成

- 姓名句来源已进一步定位：本机 server/data/chunklab.db 只读查询发现账号 1 和 27 均有课程 ai-cc2f02e4-1f56-484c-b98b-db5ae284c4d2（零基础开口 · 1 第一次见面），记录 ai-cc2f02e4-1f56-484c-b98b-db5ae284c4d2:line:005，原句 What's your name?，chunks 与 hints 均只有一段。此前 18887 隔离数据库中没有命中记录；尚未确认截图当前登录账号及实际服务使用的数据库，不能自动选择一个账号进行更新。需确认准确账号/数据库目标并做一致性备份，再通过带版本检查的课程更新保留所有其他内容及学习记录。
- 当前内置分片另有 46 条至少 6 词的单段表达。这是人工审核候选数量，不是 46 条均错误。明显有可组合结构的例子包括 What are you going to sing?、Are you taking any medication regularly?、How do you spell your name?；不得用词数阈值直接拆分或批量覆盖课程。
- 已导入课程不会因为切分校验改变而自动得到新版内容；更新个人课程必须另行确认目标，不能全库静默覆盖。
- 其他单段表达继续只读审核，区分不可拆短语与可组合句型；不使用逐词切分或词数阈值代替教学判断。
