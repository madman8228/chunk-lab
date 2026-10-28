# 精通五年级上册恢复制作

本册6单元96条，现有哈希绑定审核事件显示全部例句通过；96张配图通过，最大19,854字节；96条原单词音频已校验。旧规范队列仍将96条句子记为pending-final-text，导致没有进入句子音频制作与发布阶段。

2026-10-28依据原有逐条审核事件派生新的句子队列，保留旧文件；完成96条美式af_heart句子母带和Opus交付，共817,906字节。审批来源及逐条句子指纹记录于新批次 `prior-review-evidence.json`，不伪造新的用户审核。

音频目录：`E:/chunk-practice-asset-sources/textbooks/primary-jingtong-grade5-upper-20261014/audio-batches/20261028-sentence-audio-v1/`。

只读抽听页位于 `output/textbook-extractions/primary-jingtong-grade5-upper-20261014/audio-review-20261028-v1/`，本轮地址http://127.0.0.1:11080/。已检查16个优先项、96个完整条目和192个音频播放器；单词和句子交付哈希均在启动时复核。

## 打包阻塞及内容疑点

首次打包预检95/96就绪。`unit-6:entry:009 more` 原配图释义简写为“（构成比较级）更”，来源完整释义为“（与两个或两个以上音节的形容词或副词连用，构成比较级）更”，严格意义匹配未绑定图片。这不是多个候选图片；此前进度口述的“多个候选”不准确，实际是同一条目的释义长短差异。

进一步核对发现更重要的例句义项问题：当前已审核旧句为 `This book has more pictures than that one.`，其中more修饰名词pictures，表示“更多”，未示范教材要求的形容词／副词比较级“更”。应先修订成如 `This story is more interesting than that one.`（这个故事比那个故事更有趣。），重新确认该单项文本，并重新制作其句子音频和核对配图。不能只放宽意义匹配来绕过此问题。

旧例句、旧审核记录、已生成音频和图像均保留。本册尚未发布；其他95条例句审核无需重复。

## 用户授权处理后的进度

用户回复“处理，然后继续下一个 你建议的工作”，据此采用已提出的more修订句并制作单条新版音频，旧版保留。修订授权及新音频位于来源目录 `audio-batches/20261028-more-repair-v1/`。原96项音频抽听通过不扩展为新音频已抽听通过。11080抽听页已更新more并将其加入优先项。

完成84条匹配剑桥美式音标，12项未取得匹配完整词头原标并保留缺项。查询及来源快照位于 `phonetics-20261028-v1/`。

96词条、96图、192音频共288个媒体文件已组成新版本草稿 `E:/chunk-practice-assets/textbooks/primary-jingtong-grade5-upper-20261014/revisions/20261028-repaired-draft-v1/`，课程结构及引用验证通过，状态为blocked-more-image-needs-repair。more采用明确itemId绑定，原始长释义与配图短释义均保留证据；未放宽共享匹配规则。

实际查看more旧图：两摞数量不同的书，图义偏向“更多”，与新句“更有趣”不匹配。执行了精确批次共享图库预检，结果为review-existing-candidates，0个已批准候选。按共享图库规则，已有候选未处理前不允许生成新图；没有伪造候选不适用决定或绕过预检。待解决此配图门槛及单条新音频抽听，再完成发布候选和最终授权。

## more配图修复已完成，待单项确认

继续核查后发现当前 `vocabulary-illustrations.cjs` 已实现按assetId记录候选不适用于目标的机制，旧共享图库说明尚称未实现，故此前等待机制补齐的判断已过时。实际查看3个候选（两篮苹果、两摞书、两摞书）均为数量比较；按图片哈希在新manifest中记录具体不适用理由，重新预检返回generate，未更改原图库或旧图审核。

使用原始 `connect-with-v2.png` 为风格参考单独生成两本故事书的兴趣对比，保留完整母版，包装时使用同一catalog和包含完整裁切区域的新manifest重新绑定preflight。新交付 `assets/vocab-u6-jingtong-g5-more-comparative-wide-v3.webp`，512×288，14,436字节。生成原文件和包装master均保留。

新草稿 `E:/chunk-practice-assets/textbooks/primary-jingtong-grade5-upper-20261014/revisions/20261028-image-repaired-draft-v2/` 包含96词条、288个媒体，结构和素材校验通过。more新图和新句子音频在11080页面同一条目展示，浏览器已确认图片加载和实际音频播放。新图尚待用户确认，新音频亦未将“继续”误记为抽听通过；未发布。

## more修复通过，发布候选就绪

用户随后明确确认“more 图和新音频通过 继续”。已将more新图文件哈希、新句音频哈希及原候选清单摘要绑定保存于来源目录 `approvals/20261028-more-repair-approved-v1.json`。原96项抽听确认及本次单项确认共同覆盖当前音频版本。

新发布候选：`E:/chunk-practice-assets/textbooks/primary-jingtong-grade5-upper-20261014/revisions/20261028-release-candidate-v1/`。6单元96词、96张图、192条音频，288个媒体共2,497,201字节；配图最大19,854字节。84条剑桥美式音标，12项按仅用原标规则保留缺项。所有词条均已限定教材全局编号；结构及素材版本、哈希、大小校验通过，复制到新临时目录后的独立核验通过。

prepared-package SHA-256：`c5f9adef7bb43a3754ecc54d7910cbc72d148d0093f9088d0bae24ed152c6bd4`。
manifest SHA-256：`ce15f4ab66537ae6c9cbe4063eebd64e2d8b2f3d86b1c3af790a5a707f856558`。

目前尚未发布，等待本册系统内置课程发布的明确授权。此前六年级上册发布授权不扩展到本册。

## 已发布并核验

用户明确授权“批准发布精通五年级上册到系统内置课程，保留12项音标缺项”。先核对批准包哈希、目标编号未发布，保存正式目录快照与恢复材料，并在新临时目录完成相同发布流程演练。

- 正式系统内置目录：`D:/06-project/chunk-practice/server/data/wordbook-publications`；发布过程无账号目标及数据库访问。
- 回执、授权、恢复记录和核验：`output/textbook-publication-20261028-jingtong-grade5-upper-v1/`。
- release：`ddb7debcebd12e8c7dc853a288423daf050ea6375151f64b8a7b0632705ce5d2`。
- 正式8787目录已显示精通英语五年级上册（2024），6单元96词；96个HTTP词条与批准候选逐项一致。
- more已采用更有趣的新句、新图和新句子音频，媒体样本读取200；84条剑桥美式音标、12项缺项按授权保留。
- 发布前已有课程manifest摘要在发布后全部保持一致。未重启服务、未改变个人学习记录。
