# 原词书听写扩展

Operative task: 用户在已有单词本主动听课程音频并填写词形，不新增页面／一级模块。使用既有天空花园、暖纸面、棕色正文和下划线输入。只有有效课程音频且服务端显式允许时出现入口；不改真实内容或记录。

## Direction contract

THESIS: 把课程音频作为听写任务的明确材料，不以浏览器临时朗读和普通打字混充听写。

OWN-WORLD: 原词书纸面与按钮，单层表单，无套框、无新图片、无新增装饰动画。

STORY: 主动播放→输入→确认→正确后才出现词形／释义→原有保存与下一词；失败保留输入、可重试；辅助结果不等于掌握。

FIRST VIEWPORT: 原导航及课程标题不变，紧凑听写标题、播放按钮、明确的答案标签与输入／确认，底部复用暂停／跳过／返回，不展示泄露答案的词形／例句／图片alt。

FORM: 既有页面局部 code-first 扩展，不触发新视觉方向。原生按钮、label／input、aria-live、16px以上输入及44px按钮，手机自然换行。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 验证边界

- `scripts/word-dictation-ui.test.cjs` 使用真实 Chromium 和可解码 WAV 音调，验证主动按需读取／摘要核验、网络失败重试、答错保留、键盘单次完成、重复播放复用、stop／pagehide／destroy。不是发音自然度／教学内容审阅，不是真机或屏幕阅读器验收。
- `e2e/word-dictation.test.cjs` 临时完整服务／账号／数据库／端口、真实 API／音频／原操作队列回执，验证原入口进入听写、输入暂停恢复、错答不保存、正确保存／幂等重放、缺音频刷新跳过和两种屏宽，原句子断点不变。
- 本轮 detector 仅返回与旧全局 DESIGN 文档的字号／圆角／颜色 advisory；新增样式复用原词书，仅增加label排版。没有新图，也不调整全站设计文件。
- 服务端 `CHUNKLAB_WORD_DICTATION=true` 是显式试点开关，默认关闭；真实服务未配置／重启。内容契约已标记听写引擎 implemented:true，但内容有音频不等于服务开放。读取状态与保存操作由同一开关控制；不把隔离入口称为正式上线。

## 收尾复核

独立 finish reviewer 直接核对 `output/playwright/word-dictation/study-1440.png`、`study-390.png` 两张完整页面图及组件源码，返回 scoped ship，无范围内实质修复项。独立 documenter 确认新增label／间距属于既有词书局部扩展，保持 DESIGN.md／sidecar 不变；FINISH 中 DESIGN.md 的要求按此既有体系证据完成，不代表全站设计更新。截图由临时服务／测试账号／WAV音调夹具生成，不含真实学习资料。

隔离联调补测断网待确认→联网自动保存、第二设备读取完成及体验模式无账号写入均通过。发现并修正读取／操作服务两处开关接线不一致（统一服务配置），以及已完成会话原来返回 resumePosition=-1 导致负分页（改在服务端返回项目总数）。这是根因层修复，不依赖前端吞错；旧词书端到端回归继续通过。
