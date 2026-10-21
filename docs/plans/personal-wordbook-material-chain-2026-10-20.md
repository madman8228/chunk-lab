# 个人课程材料来源贯通

状态：共用协议、制作页导入／导出、个人保存／读取、来源保留追加及真实 Web 验收已实现。正式部署与主人内容审查未完成。下文“断点”和早期未实现描述是实施历史，最新证据见“完成证据”。

## 已落地的共用规则

`js/vocabulary-application-material.js` 提供浏览器与服务端同一份无依赖校验。已有材料库模型已调用它，不保留平行的对话内容校验。它检查双语句子、说话人、对话／短文区分、新写内容标注、固定版本词义引用、目标词实际出现和引用去重；不保存或发布数据，不自行断言材料已审核。材料身份及内容哈希继续由原材料库版本层核对。

自测：`node scripts/vocabulary-application-material.test.cjs`、`node scripts/vocabulary-materials.test.cjs`、`node --test server/vocabulary-material-library.test.js`、`node --test server/vocabulary-material-release.test.js` 均通过。第一项同时在 Node 和无 require 的浏览器全局上下文运行同一组合同；后三项覆盖既有投影、隔离存储重开及发布门禁回归。尚未把此文件接入真实制作页，因此不声称个人制作链路可用。

完整材料库核心现位于 `src/vocabulary-material-library/core.cjs`，原 Node 入口保留为适配器，哈希和教学协议通过依赖注入复用。浏览器入口 `src/vocabulary-material-library/browser.mjs` 使用 WebCrypto 预核对当前快照所需的哈希，随后调用同一核心；调用期间外部修改不影响待核验快照。`node scripts/build-vocabulary-material-library.mjs` 生成独立浏览器文件，尚未加入产品页面。

新增 `node scripts/vocabulary-material-library-browser.test.cjs` 通过：在真实 Chromium 安全来源环境，完整来源／词义／任务／应用／课程库校验成功；两门课程的编译预览与 Node 逐字段完全一致；内容篡改、断裂的固定版本引用均拒绝；异步校验期间调用者改动不会污染结果。原材料库、服务与发布门禁测试再次通过。下一步是制作封装和产品页面接入，不是再建立校验模型。

## 已确认的断点

1. `js/wordbook-draft.js` 严格限定制作文件为 schemaVersion/book/items，没有来源库、课程材料引用或词义绑定。现有未知字段拒绝必须保留，不能改成接受后丢弃。
2. `server/services/personal-wordbooks.js` 保存时重命名 bookId/itemId 并重新 compile；只能追加新单元。新增材料引用必须同时处理身份映射，不能打断历史内容前缀与旧版本续学证明。
3. `server/services/vocabulary-content.js` 的 materials 对 personal-book 显式返回空 units；details 对个人课程提前返回，未提供 materialKinds。
4. `scripts/lib/vocabulary-materials.cjs` 已有来源、词义、任务、应用材料、编排的严格版本模型；不应另建一套无版本对话数据结构。
5. `server/services/vocabulary-material-library.js` 是管理端草稿库，不是账号私有材料读取服务。不能让普通账号通过任意 libraryId 读取管理材料库。

## 实施顺序及边界

制作封装协议已落地为 `vocabulary-material-course-draft` v1：固定 libraryRef/courseRef，携带原材料库快照及逐任务 WebP 交付清单。共用核心 `prepareDraft` 同时返回现有单词制作草稿、未经改写的来源封装、活动／词义／原始词条绑定及单元应用材料；图像真实文件核验明确保持 pending，published=false。严格拒绝附带审批字段，不把个人导入当作发布。`node scripts/vocabulary-material-course-draft.test.cjs` 验证来源往返、浏览器／Node 完全一致、异步不可变快照、失效课程／库版本、图像映射、20000 bytes 边界和未知审批字段。现有材料库和发布门禁回归通过。仍待工作台保存完整封装并由账号服务核验真实图像，不能只保存返回的 draft 而丢弃 source。

1. 确定可导入的材料制作封装：复用现有材料库版本模型，固定 courseRef 和 libraryRef；保留原始来源、词义与活动引用。导入个人课程不产生公开发布审批，也不得伪造 review=pass。
2. 在浏览器和服务端复用同一校验协议。校验目标课程、单元材料、目标词义、任务与图音交付映射，拒绝错误版本及跨单元目标。先完成纯模型合同测试，再接编辑器。
3. 账号保存时保存不可变来源快照／引用及本地身份映射；材料与词条同一事务保存。追加仅扩展新单元；原有材料、引用和版本不能被重写。旧版无材料课程继续可读，禁止自动补写历史账号。
4. 个人课程 materials/details 先校验账号所有权，再解析对应版本材料。对学习端投影必要双语内容与词义；不泄露原始扫描、管理审批或其他课程安排。
5. 制作工作台需经过导入→预览→保存→重开→导出→重新导入，来源和材料均保留；追加材料时明确显示差异。不能只接保存接口却让导出丢失新字段。
6. 详情页沿用现有对话／短文呈现，不新增首页入口；阅读不计为词条练习成功，也不改原有辅助掌握口径。

## 完成证据

扩展 Web 验收 `node e2e/personal-material-authoring.test.cjs` 在全新实例 `wordbook-acceptance-71TTyT` 通过：错误作答不产生成功事件，完成引导句子产生一条 assisted=true、mastered=false 的 guided-expression 记录；实际页面导入完整新版并追加新单元／新对话，仍为同一本个人课程、两版内容，原材料投影和已有事件逐字段不变；重新学习从 2/7 继续。新版下载与导入封装完全一致。独立其他账号对 details/materials/items HTTP 请求均404，匿名均401，其他账号事件数为0。并非所有方式或所有记录类型已验收，错误／提示过程持久记录仍是单独缺口。

制作工作台已接入：同一个文件入口识别材料课程文件，核验后打开其课程投影；本机会话保留 materialSource，刷新及导出不丢来源。保存提交完整封装，保存指纹包含材料来源；脱离来源的普通批次追加会拒绝，材料课程可通过完整新版文件追加（服务器验证旧内容前缀）。新增“导出制作文件”沿用制作页已有交互，不调整首页。

`node e2e/personal-material-authoring.test.cjs` 通过，独立实例 `wordbook-acceptance-AyyHVA`：真实文件导入、刷新本机会话、下载文件与原封装逐字段一致、真实账号保存、个人详情两篇对话／一篇短文、读取不产生完成事件、保存后重开仍导出完整来源。`node scripts/wordbook-ai-authoring-ui.test.cjs` 及导入／会话状态单测回归通过。尚未更新用户正在使用的14600实例后端，不应提示刷新即可获得材料保存能力；正式部署仍需明确授权。下一轮需补强跨账号 HTTP 材料访问、材料课程实际学习核账及完整追加往返 Web 验收。

账号服务已接入材料封装：保存时重新验证完整材料库及真实交付图大小／SHA-256，将来源与编译课程写入同一版本行；学习材料读取经过账号归属检查，仅投影双语应用和目标词义。个人详情已提供 materialKinds。原始来源不作为学习端正文返回。

`node --test server/personal-wordbook-materials.test.js server/personal-wordbook-images.test.js server/beginner-wordbook.test.js` 通过。新专项覆盖材料保存幂等、账号隔离、源文件不变、同源新单元追加、旧版本可读取、旧材料改写／来源移除拒绝、交付图哈希拒绝、空账号完整备份恢复与非空账号拒绝覆盖。所有测试使用新临时目录及内存数据库，无真实账号写入。制作封装浏览器一致性测试再次通过。产品工作台导入／导出及实际 HTTP/Web 全流程仍待接入验证；运行实例未部署后端变化。

- 模型：错误词义、版本篡改、跨单元引用、重复身份、未知字段均拒绝；旧制作文件兼容。
- 服务：账号隔离；保存失败事务回滚；新单元追加保留原版本和原材料；重开导出保持引用；读取材料不写学习记录。
- Web：真实导入及保存个人课程后可读对话／短文；文字课程仍无虚假材料入口；移动端可读。
- 恢复：全新临时目录与隔离端口执行一致性备份恢复，复核材料、词条和学习记录；禁止触碰运行实例的数据目录。
- 人工审核：主人确认内容、来源和教学体验后才可讨论真实发布。测试通过不能替代人工内容审批。

此项与错误／提示过程持久记录是两项独立剩余工作。麦克风按主人要求暂缓，不借本项恢复语音验收。
