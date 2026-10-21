# 跟读播放器局部扩展与继承记录

日期：2026-10-19。性质：现有词书学习页的普通局部扩展，Operate。继承结论：保留既有学习花园、纸面、导航和播放器；没有建立新视觉世界，没有新增交付 raster。根据主流程提供的最终审查记录，fresh finish reviewer 在唯一必改的回听覆盖缺口修复后将该项评为 resolved，给出 **ship，仅本次局部扩展范围**。这不是全站验收、真实课程审核或生产授权。

## Overview

本 documenter 子任务只新增本文。依据 Impeccable document 的源码提取与继承记录方法，完整读取 `PRODUCT.md`、`DESIGN.md`、`.impeccable/design.json`、`.impeccable/surfaces/wordbook-html.md` 及技能 `reference/document.md`，并结合 `docs/design/system-context-2026-10-13.md`、源码、既有测试报告与截图核对。不覆盖全局设计，不重选方向，不重跑会产生文件或数据的测试，不启动、重启或切换服务。

普通扩展沿用已有合同：从具体词书和真实素材覆盖进入学习；同一内容可以有独立练习方式；学习事实通过已有队列与回执保存。跟读新增的是明确的听示范、显式录音、完整回听和确认流程，不能用一个播放按钮推导出发音测评能力。

| 核对对象 | 继承与局部边界 |
| --- | --- |
| `DESIGN.md`、sidecar、现有宿主样式 | 暖纸、棕字、蜂蜜色主操作、真实 HTML 控件及既有花园装饰；首页木质阴影不是答题区必须复制的样式。 |
| `wordbook.html`、`landing/wordbook-study.js` | 原播放器继续负责书/单元范围、分页、场景、翻译、位置、暂停、跳过、错误恢复及保存状态；增加方式绑定而非另造播放器。 |
| `landing/read-aloud-view.js` | 局部表单负责示范、录音、原生回放、确认与即时反馈；暴露既有 `element/values/focus/stop/destroy` 生命周期。 |
| `landing/read-aloud-recorder.js`、`landing/vocabulary-course-audio.js` | 分别承担临时录音资源与既有课程音频播放；声音与持久学习事实分层。 |
| `js/vocabulary-read-aloud.js`、`js/vocabulary-course-contract.js` | 校验明确的 word/sentence 目标、固定课程音频和独立方式契约；不做语音识别、发音评分或正确性推断。 |
| `landing/wordbook-details.js` | 共用整书和单元的原生“其他学习方式”菜单、覆盖数及链接结构；保留原主入口。 |
| `assets/wordbook-study.css` | 复用原纸面、按钮和焦点规则，仅补充跟读文本、隐私、换行操作区和原生音频宽度规则。 |

## Colors

继承局部词书的棕色正文（`--workspace-ink`，回退 `#523019`）、次要说明（`--workspace-muted`，回退 `#745333`）与纸面（`--v4-card`）。确认复用既有蜂蜜色（背景 `#ffe08a`，边框 `#ccad62`）；按钮边框沿用 `#d8c7a9`，焦点沿用蓝色 `#3768b4`。这些是当前实现事实，不新增全站色板或 sidecar token。

跟读状态通过中文反馈表达，不以颜色替代听完、录音就绪、尚有未回听片段或保存回执。隐私说明和未验证性质持续可读。

## Typography

沿用宿主字体，无新字体资产。英文目标为可选择的真实文本，带 `lang="en"`，局部字号（22px）、行高（1.5），允许长内容换行。隐私和反馈采用现有辅助文字尺度（14px、行高 1.5）。中文按钮明确区分“听示范”“开始录音 / 重新录音”“结束录音”“取消录音”和“确认已练习”。

## Layout

继续使用现有词书纸面：宽屏场景与答题区左右排列，600px 及以下转为上下排列；场景完整显示，不为跟读裁新图。答题区依次放明确目标、隐私说明、录音动作、原生回放、确认和即时反馈，不新增嵌套卡片或导航层。

跟读操作区采用可换行 flex（8px 间距）；原生音频宽度为可用空间的 100%，最大宽度不超容器。底部暂停、跳过、方式切换与返回链接继续自然换行。现有首页 / 我的内容 / 发现 / 学习记录导航在窄屏保留，320px 截图中换行显示。

详情入口复用原生 `details/summary`。隔离截图显示整书跟读覆盖 **5 / 6**、首单元 **2 / 3 项有素材**；这是素材覆盖数，不是完成数或全书可练承诺。整书和单元的原有开始操作保留。

## Elevation & Depth

保留宿主花园背景、天空、太阳、云与底部花草及其现有层级；纸面与无阴影的局部按钮继续承担学习操作。没有新背景、插画、装饰层、动效或木质浮雕。截图是验证产物，不是浏览器交付图。

## Shapes

按钮继承局部词书的圆角（9px）、最小操作尺寸（44×44px）及焦点外轮廓（2px，偏移 3px）。纸面沿用现有边框和圆角。原生音频控件保留浏览器形态，不另造波形、录音仪表盘或自定义媒体控件。以上不提升为全站统一组件标准。

## Components

### 明确目标、显式录音与释放资源

跟读配置位于 `item.learning.readAloud`；契约为 `implemented:true`、`independent:true`、`inputs:['speech']`、`learningKey:'readAloud'`。目标必须明确为单词或例句，文本须匹配词头或原题句子；示范必须来自带摘要、大小及 MIME 的固定本地课程音频引用，不以 TTS 替代。

表单先要求听完示范；录音必须由用户点击触发，每次最多30秒。示范与录音互斥，播放自己的录音也会停止示范。拒绝权限有就地说明，可重新尝试或通过宿主跳过。等待权限期间取消、晚到授权、重新录音与销毁均需释放相关资源。

暂停、离开、隐藏页面或切题会停止并丢弃当前录音；继续只恢复可操作表单，不自动打开麦克风。重新录音撤销旧对象 URL 并重置回听资格。声音仅在当前页面暂存，不随学习操作上传；队列保存的是确认事实，不是声音。

### 完整回听门槛与唯一审查修复

最初审查发现回听覆盖缺口：仅抵达媒体末尾不足以证明所有片段均被播放。修复在视图层使用原生 `audio.played` 范围，并结合当前录音 URL、真实 ended 状态与当前播放位置判断；当前实现要求单一连续范围从起点覆盖到播放末尾，起止容差为 0.02 秒。伪造过期 ended 通知不能替代当前录音回听。

`e2e/read-aloud-view.test.cjs` 有真实播放与 seek 回归：开始播放后暂停，向前跳至 0.95 秒再播到结束，确认仍禁用并提示存在未回听片段；随后从头完整回放，确认才启用。“seek fails”指绕过门槛失败，是预期通过的回归断言，并非测试失败。完整回听只是浏览器播放覆盖证据，不能证明用户实际听见、发音正确或已掌握。

### 自报事实与正确性分开

确认提交四个显式布尔事实：`listened/recorded/replayed/confirmed`，均须为真。视图完成回调携带 `inputMode:'speech'`、`practiceType:'read-aloud'`；宿主使用 `vocabulary.rehearse`，不走原答题的 `vocabulary.complete`，也不提交 answers 或录音内容。

记录性质为 `unverified-self-report`、`verification:'unverified'`、`assessment:false`。集成断言确认没有 `correct` 或 `score`，旧答题表不变；轮次结束也明确“已记录本轮跟读自报，不代表发音正确或已经掌握”。可记录练习次数与独立续学位置，不得累计为已验证掌握。

保存继续复用 `VocabularyStudyStore`、耐久队列和服务端回执。等待期间下一词禁用；离线显示待保存，收到回执后才显示“练习自报与下一词位置已保存（未验证发音）”。访客显示临时体验，不写账号。整书、单元与不同练习方式保持各自位置，复用原书和条目身份。

### 入口、覆盖与默认关闭

详情菜单只接受已知方式、启用的服务 feature，以及满足 `0 < itemCount <= total` 的安全整数覆盖数；单元入口还依赖单元会话能力。单元链接携带 `book`、`unit`、`structureRevision`、`practice=read-aloud`。播放器内方式切换保留范围，并要求当前条目有跟读素材。

`server/index.js` 仅在 `CHUNKLAB_READ_ALOUD === 'true'` 时启用。实现存在、素材存在和服务开放是独立条件；默认关闭。关闭时详情入口隐藏，直接访问跟读路由也被拒绝。缺少当前条目素材时说明可跳过且不会记为已练习，不自动合成示范或成功记录。

### 测试与人工审查证据

本文只读核对既有证据，没有重新执行测试，也不以并行开发中的构建数量或服务器测试总数作为最新结论。

| 证据 | 结果及限制 |
| --- | --- |
| `e2e/read-aloud-view.test.cjs`；`output/test-results/read-aloud-view-1792399357809/summary.json` | 合成麦克风输入，实际示范音频、录音流程与原生回放；显式确认、过期回放拒绝、权限拒绝/晚到授权、暂停丢弃、继续不收音、重新录音撤销 URL、pagehide/销毁释放、无上传或账号写入。seek 缺口回归见测试断言，summary 没有独立 seek 字段。`realDeviceVerified:false`、`integratedOfflineVerified:false`，后者不否定下行独立集成证据。 |
| `e2e/read-aloud.test.cjs`；`output/test-results/read-aloud-1792399414332/summary.json` | 合成麦克风；整书3次、单元1次，共4次未验证自报。四种旧方式游标及旧答题表不变；暂停释放、重连保留表单、离线队列跨文档关闭恢复、第二浏览器上下文续学、访客不写入、部分覆盖、独立单元、关闭入口/路由拒绝、回执重放、一致性备份恢复和源文件保留均通过。`productionPublished:false`、`realDeviceVerified:false`。 |

离线场景的实际顺序是：已加载页面中断网确认 → 待保存且下一词禁用 → pagehide 丢弃声音并关闭文档 → 恢复网络 → 新开页面恢复队列和确认位置。它证明事实队列耐久性，不证明离线新开、离线刷新或离线页面导航。第二设备字段对应第二个浏览器上下文，不是真实另一台硬件设备。

集成测试用新分配的临时数据目录及隔离端口，复制测试素材并使用合成账号；一致性备份经材料清单摘要/字节核对后，恢复到全新目录和端口并比较结果。测试没有以真实非空账号进行快照覆盖。本文不执行这些操作，不访问或修改实际课程、学习记录、浏览器原始数据、备份或 `server/data`。

| 宽度 | 实际播放器截图 | 实际详情入口截图 |
| --- | --- | --- |
| 1440 | `.impeccable/review/read-aloud/player-1440.png` | `.impeccable/review/read-aloud/entry-1440.png` |
| 774 | `.impeccable/review/read-aloud/player-774.png` | `.impeccable/review/read-aloud/entry-774.png` |
| 390 | `.impeccable/review/read-aloud/player-390.png` | `.impeccable/review/read-aloud/entry-390.png` |
| 320 | `.impeccable/review/read-aloud/player-320.png` | `.impeccable/review/read-aloud/entry-320.png` |

截图来自实际隔离播放器/详情路由。测试在这些宽度检查无横向溢出；本文也逐张查看八张现有截图，确认相同的导航、纸面、完整场景、原生媒体控件与窄屏换行。根据主流程提供的最终记录，parent 与 fresh reviewer 各自亲自检查全部八张；fresh reviewer 的唯一必改回听覆盖问题已修复并评为 resolved，最终 ship 限于此普通局部扩展。人工审查处置来自主流程交接，不冒称本文重新运行了 finish review。

真实麦克风设备、真实 Safari/iOS、实际屏幕阅读器及其他 AT 尚未验证。源码具备具名原生回放、表单按钮、polite status 与焦点规则，但这些语义和 Chromium 截图不替代辅助技术实测，也不构成真实课程内容质量验收。

## Do's and Don'ts

- 保留原课程、账号、学习记录、草稿、原画与备份；本次仅新增本文，不迁移、不覆盖、不清空、不发布、不修改运行开关，不授权生产启用或部署。
- Impeccable detector 在主流程已运行一次；继承的 cream、navigation stripe 与 token advisories 属于既有宿主表现和维护提示，不判为新视觉世界失败。本文不重跑 detector，也不修复全局样式。
- 记录漂移而不维修：documenter读取时表面简报写“verdict pass pending”，与主流程随后提供的最终 scoped ship 有时间差；父流程现已同步该简报。sidecar仍保留旧导航示例及较早范围描述；全局设计中历史10KB、4:3、多格式文字由后续所有者规则取代。以上不授权改写全局文件。
- 无新增交付 raster，无新图来源待补。复用现有场景并按当前内容懒加载；后续新词汇图仍遵守共用一份16:9 WebP、每文件严格小于20,000字节、保留原画及按需缓存，不在此迁移旧资产。
- 父流程正在并行处理安装缓存分类；该工作不属于本文的实现或验收范围。本文不声明最新 build count、服务器95项测试结论、离线页面导航或生产已更新。
- 全局 `DESIGN.md`、sidecar、surface brief、源码、样式和资产的现有变化不属于本 documenter 写入；唯一新增文件为 `docs/design/read-aloud-player-2026-10-19.md`。
