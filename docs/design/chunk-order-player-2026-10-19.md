# 词序拼块播放器接入收尾

日期：2026-10-19。性质：现有词书学习页的普通局部扩展，Operate。结论：独立 fresh reviewer 的处置为 **ship（仅本次集成范围）**，无 required runtime fix；要求的文档收尾由本文落实。此结论不构成真实课程审核、生产发布或服务启用批准。

## Overview

用户已授权继续实现独立学习方式接入，并未将整体需求限定为“只写文档”。本次 documenter 子任务的写入边界才是仅新增本文：不修改运行时代码、CSS、全局 `DESIGN.md`、`.impeccable/design.json`、表面简报或计划。实现与测试由主流程完成；本文只读核对指定源码和已有报告，不重跑测试、不进行实际数据写入或服务重启。

采用 Impeccable document 的源码提取原则，记录真实继承，不重新选择视觉方向或生成全站 token。`docs/design/chunk-order-component-2026-10-19.md` 是组件阶段的历史合同，其中“尚未正式接入播放器”的描述属于当时状态；本文补充当前控制器、详情入口和保存链路证据，不覆盖旧文档。

| 依据 | 当前集成的实际继承 |
| --- | --- |
| `PRODUCT.md`、`docs/design/system-context-2026-10-13.md` | 从具体词书进入学习；同内容支持多种方式；进度反映真实确认；复用保存链路；辅助完成不等于掌握。 |
| `DESIGN.md` 的 landing/词汇适用范围 | 继承暖纸、棕字、蜂蜜色确认与真实 HTML 控件，不把首页装饰或木质阴影套进答题区，也不声称全站已改版。 |
| `.impeccable/surfaces/wordbook-html.md` | 共用播放器、方式独立位置、详情真实覆盖入口、答前不额外展示答案原句或答案音频；保持现有页面层级。 |
| `landing/wordbook-study.js` | 共用加载、场景、中文含义/翻译、保存、暂停、跳过、下一词与错误恢复；按方式绑定组件和素材。 |
| `landing/chunk-order-view.js`、组件阶段文档 | 复用已评审的原生按钮双区排列组件，保留选择、撤回、重排、显式确认、错误保留和生命周期接口。 |
| `landing/wordbook-details.js`、`js/vocabulary-course-contract.js` | 方式、实现状态、素材覆盖与服务开放分别判断，整书及单元入口不虚报全量可练。 |

## Colors

本次接入没有新增 CSS 或调色板。继续使用 `assets/wordbook-study.css` 的棕色文字、暖纸按钮、蜂蜜色 `.guided-confirm`、蓝色焦点与中文错误反馈。已选块沿用浅纸色，错误同时呈现文字和 `aria-invalid`，不能只以红色表示。

## Typography

字体、中文界面和英文教学文本均由现有宿主/组件提供。词块保持可选择的真实文本与 `lang="en"`；原生按钮的中文可访问名称包含选择、当前位置和撤回含义。无新字体、文字栅格或全局字号调整。

## Layout

复用词书场景图与答题区：宽屏左右排列，现有 600px 及以下规则转为上下排列；图片完整显示，底部控制与方式链接自然换行。拼块的已选区、待选区和操作区继续换行，不新增导航层、嵌套卡或移动专用布局。

详情页复用原生 `details/summary` 的“其他学习方式”，分别放在整书工具区和现有单元行内。主入口仍是原有“开始 / 继续练习”和“练习本单元”。

## Elevation & Depth

继续使用宿主答题纸面及无阴影按钮。接入不新增外框、装饰背景、立体效果或动画。

## Shapes

沿用词书按钮的 9px 圆角、最小 44×44px 操作尺寸和现有焦点外轮廓；这些是局部词书实现事实，不提升为全站按钮标准。

## Components

### 共用渲染与独立学习绑定

`landing/wordbook-study.js` 的 `views` 映射统一接入听写、选词和拼块；`requestedPractice` 经 `Object.hasOwn` 检查后，从契约取得独立 `learningKey`。`chunk-order` 对应 `VocabularyChunkOrderView` 与 `item.learning.chunkOrder`，不复制播放器，也不通过拼块页面绕回选词素材。

契约中该方式为 `implemented:true`、`independent:true`、`inputs:['chunks']`、`learningKey:'chunkOrder'`。读状态、查询待保存操作、暂停、跳过和完成都携带同一 `practiceType:'chunk-order'`；单元范围额外绑定 `unitId`、`structureRevision`。整书与各单元、不同方式的续学位置分别管理，内容身份仍复用原 item/book 引用。

组件只回传 `{chunkIds:[...]}`、`inputMode:'chunks'`、活动版本与既有引擎原句；词块 ID 是身份，不是排列下标。保存仍由宿主通过 `VocabularyStudyStore`、既有耐久队列及服务端回执处理，不新增平行成绩、统计或保存系统。界面已排列正确不等于云端已确认。

### 原生排列与宿主生命周期

待选块初始化打乱；选择追加到已选末尾，点击已选块撤回；“重新排列”清空当前顺序；“确认”才提交。未用完或顺序错误时保留输入并就地说明；正确后组件锁定，宿主显示下一词。

词块使用原生按钮，确认使用表单提交；保留 Tab/Shift+Tab、Enter/Space 与移动后的焦点，不要求拖拽，不新增方向键协议。两区有具名 group，反馈使用 polite status；源码语义不等于实际辅助技术验证。

暂停由宿主隐藏练习区并调用 `stop()`，继续调用 `focus()`；当前内存排列保留。在线事件在仍有活动表单或暂停时不重建页面，避免重连清掉当前排列。刷新/第二设备的证据是已确认位置恢复，不能扩大为未提交排列跨刷新或跨设备同步。

缺少 `learning.chunkOrder` 时显示“当前词条没有拼块素材，可跳过或返回原练习；不会记为完成。”不自动生成词块，不记成功。跳过使用 session 操作，不伪造成 complete。保存等待期间禁用下一词，离线显示“待保存，连接恢复后会自动重试。”，确认后才显示已保存；访客明确为体验且不向账号写入。

### 入口与三个独立条件

| 条件 | 已核对事实 | 不代表什么 |
| --- | --- | --- |
| 实现 | 契约 `implemented:true`，播放器已绑定组件 | 不表示服务默认开放。 |
| 素材 | 当前条目有明确编写且经契约校验的 `learning.chunkOrder`；详情使用服务返回的 `practiceOptions` 覆盖数 | 不表示全书都有素材或真实课程已获审核。 |
| 服务 | `server/index.js` 仅在 `CHUNKLAB_CHUNK_ORDER === 'true'` 时启用，默认关闭 | 不表示已调整生产配置或 live enabled。 |

详情入口只接受已知方式、服务 feature 为真、且为安全整数并满足 `0 < itemCount <= total` 的覆盖数；单元入口还要求 `features.unitSessions`。文案为“有素材数 / 当前范围总数 项有素材”。隔离 fixture 的整书 **5 / 6**、首单元 **2 / 3** 是部分覆盖，不写成完整可练或成功数。

单元链接携带 `book`、`unit`、`structureRevision` 与 `practice=chunk-order`；播放器方式切换保留当前 URL 的书/单元范围。服务关闭时详情不展示该入口，直接访问也被播放器拒绝，不渲染拼块表单；播放器内切换入口还要求当前条目实际有该素材。

### 答前与答后音频

拼块答前保留场景、中文含义/翻译和词块任务，不额外展示答案原句，也不显示“听句子”或“听单词”答案音频按钮。组件回调携带原句供宿主使用，不在答前追加整句答案。

答对后宿主显示“听句子”：有 `learning.sentenceAudio` 时使用既有课程编写的例句音频，通过现有 `VocabularyCourseAudio` 播放，不生产新音频、不拼读词块。宿主通用代码对缺少该音频的内容仍保留 `speak(result.sentence)` 分支，不能概括为所有内容已强制课程音频；本次 E2E 以禁用 speech synthesis 的方式确认测试课程实际请求了既有 `.ogg`。播放能力不等于完整跟读、听力训练或发音评分。

### 验证与审查收尾

以下是已存在报告的只读核对结果，本文未重新执行测试。

| 证据 | 实际结果与范围 |
| --- | --- |
| `output/test-results/chunk-order-1792394714545/summary.json`；`e2e/chunk-order.test.cjs` | 7 次拼块辅助完成（整书 5、单元 2），缺素材跳过 2 次；整书/单元入口与部分覆盖、关闭入口及直接路由拒绝、独立单元、其他三种方式位置不变、暂停/重连保序、离线重试、回执重放、第二设备、访客不写入、既有例句音频、备份恢复、源文件不变均通过；`productionPublished:false`。 |
| `output/test-results/word-choice-1792394741954/summary.json` | 原选词链路回归：7 次辅助完成（整书 5、单元 2）、缺素材跳过 2 次，入口/部分覆盖、独立单元、原练习与听写位置不变、离线/回执/第二设备/访客/音频/恢复/源文件保留均为真；未生产发布。 |
| `output/test-results/borrow-pilot-1792394751031/summary.json` | 原六词试点回归：引导完成 6（输入 3、选块 3），听写完成 6；引用 12 个既有 OGG 和 6 张图；刷新续学、离线重试、回执重放、账号隔离、备份哈希及新目录/端口恢复通过。`actualPilot:true` 指复用试点素材；审核回执仍是 synthetic，源文件不变、未生产发布。 |
| `output/test-results/20261019072635570-2200/summary.json` | 本轮服务器完整 **92/92 passed**，0失败／跳过／自动重试，运行前后工作区指纹不变。主代理读回报告核对；文档子任务未重跑。 |

`e2e/chunk-order.test.cjs` 将测试课程副本与合成账号放在新分配的临时目录和隔离端口，在副本中添加拼块配置并隔离发布；源草稿和引用素材均核对不变。恢复使用一致性备份、材料清单哈希和全新恢复目录/端口，并比较恢复后的事件；未将测试指向 `server/data` 或真实账号。测试结束只清理自身验证过的临时根。

截图来自实际隔离控制器路由，非静态模型：

| 宽度 | 集成答题页 | 详情入口 |
| --- | --- | --- |
| 1440 | `output/playwright/chunk-order-integrated/1440.png` | `output/playwright/chunk-order-entry/1440.png` |
| 774 | `output/playwright/chunk-order-integrated/774.png` | `output/playwright/chunk-order-entry/774.png` |
| 390 | `output/playwright/chunk-order-integrated/390.png` | `output/playwright/chunk-order-entry/390.png` |
| 320 | `output/playwright/chunk-order-integrated/320.png` | `output/playwright/chunk-order-entry/320.png` |

测试在四宽分别断言无横向溢出；集成截图记录错误排列保留，入口截图展开整书与首单元方式菜单，显示真实部分覆盖。根据主流程提供的审查记录，主代理与 fresh reviewer **各自亲自查看全部八张截图**。fresh reviewer 给出 **ship scoped integration**，无运行时必改项，要求完成文档收尾；本文落实该要求。documenter 本身只核对文件存在、报告与源码，不冒充上述人工视觉审查者。

这些结果限于隔离 Chromium 与所列测试场景；没有 Safari、真实 iOS、触屏设备或 AT 实测结论，也没有真实课程质量验收、生产启用或独立掌握结论。事件为 assisted，能力范围为 `authored-sentence-ordering`；报告和断言不将其写成 mastered。

## Do's and Don'ts

- 保留既有课程、导入资产、原画、草稿、学习记录、浏览器数据和备份；本次文档不触发迁移、覆盖、清空、生产写入或重启。整体工程没有重启／切换正式服务或更改其运行开关；源文件变更不意味着已完成正式部署或启用。
- 本次集成无新增 CSS 或浏览器交付 raster；引用既有场景素材，截图仅为验证产物，无新增栅格生产或 provenance 待补。未来新增词汇交付图仍遵守单词共用一份 16:9 WebP、每文件严格小于 20,000 字节、按需加载和保留原画规则。
- 保留实际继承与漂移的区别：全局 `DESIGN.md` 中历史 10KB、4:3 和多格式文字已由所有者后续规则取代；词书局部 9px 无阴影按钮也不等同首页木质按钮。本次记录差异，不修复无关漂移、不改全局设计或 sidecar。
- 文档子任务仅新增本文，保留工作区其他已有改动；用户授权的是继续实现，子任务写入范围不应被改写为用户只要求文档，也不扩展为全局重设计或生产发布授权。
