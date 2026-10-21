# 单词课程最终验收索引

总体目标仍 active，不能把已通过的专项当作主人已审核或已发布。

## 当前可审查入口

- 最新健康检查：`http://127.0.0.1:14602/acceptance`，独立数据目录`C:/Users/ADMINI~1/AppData/Local/Temp/wordbook-acceptance-clV0wT`。原14601已确认无监听且原进程句柄不存在，原数据库仍存在；没有重启、覆盖或搬动旧数据。以下14601为历史入口，不再作为当前可用性证据。
- `http://127.0.0.1:14601/acceptance`：最新源码的独立测试服务；进程由本次任务启动，数据位于 `C:/Users/ADMINI~1/AppData/Local/Temp/wordbook-acceptance-C8jy7W`。可下载含来源的成人完整课程，使用真实添加、详情、学习和记录页。测试账号和草稿审批均不能代表真实审批。
- 原14600在本次健康检查中拒绝连接，未重启或替换；原目录 `wordbook-acceptance-yOeEyQ/data/chunklab.db` 仍存在。本次不恢复或覆盖其中任何内容。

## 逐项证据

| 要求 | 当前证据及结论 |
|---|---|
| 材料、词义、教学任务、课程编排解耦 | 共用材料核心、来源版本校验；`vocabulary-materials.test.cjs`、浏览器材料库合同及制作封装合同通过。不是按拼写自动合并。 |
| 同材料服务不同课程，记录不串 | `output/test-results/borrow-pilot-reuse-1792456442357/summary.json`；两门编排共用项目与媒体，各方式／课程续学隔离，辅助记录不冒充掌握。 |
| 成人六词添加→个人课程→应用材料 | `e2e/personal-material-authoring.test.cjs` 通过：导入、刷新、完整来源导出、保存、对话／短文、完整新版追加、已有记录／位置保持和HTTP账号隔离。 |
| Web学习呈现及操作精简 | `output/playwright/wordbook-product-1792456307432/summary.json`；真实产品添加、学习、记录和多宽度验证。后续最新记录验证见下行。主人未最终批准当前布局。 |
| 所有已实现答题方式记录正确 | `e2e/vocabulary-attempt.test.cjs` 最新实例 `wordbook-acceptance-5e2wLA`：引导、选词、听写、拼块、普通句子五种，错误／改正分别记录，五次错误不混入五条完成；页面与数据库核账，离线补交和刷新去重。真实麦克风按主人要求暂缓。 |
| 备份与新实例恢复 | `server/vocabulary-attempt-http.test.js` 通过：SQLite一致性备份、素材哈希、全新目录与端口重启，过程／完成／进度／续学／历史回执一致。不复制运行中主库、不写真实账号。个人来源归档恢复另有专项。 |
| 零基础方向与短课示例区分 | `output/test-results/zero-foundation-preview-1792456385065/summary.json`：独立三词、三教学阶段、九段实际音频、按需媒体和可选练习；此只读预览没有账号成绩。持久预学习能力另见既有browse专项，不能混称该草稿已上线。 |
| 离线重开与媒体按需 | `output/test-results/vocabulary-browse-ui-1792421275015/summary.json` 已核实存在：九步访问后的实际图片／音频离线可用，独立浏览器重开；范围不含未访问媒体、整库预缓存或Safari真机。 |
| 系统性回归／生成／部署清单 | server统一报告 `output/test-results/20261020002934928-11796/summary.json`：100/100，failed/skipped/flaky=0；生成一致性和部署依赖／安全护栏通过。442项是清单登记数，不代表全量执行。未执行真实部署。 |

## 仍不能宣称完成的事项

个人零基础教学编排尚未贯通：`server/services/vocabulary-teaching-content.js`明确拒绝personal-book预学习，个人材料封装尚未携带教学计划。原零基础契约中的此项仍待实现，不能以对话／短文材料贯通替代。具体实施及验收顺序见`personal-teaching-plan-2026-10-20.md`。

原材料贯通规划第5项的差异确认已补齐：同课新版导入显示单元／词条的新增、变更和移除数量，明确打开制作稿不立即保存；不同课程不显示误导性差异。`src/wordbook-authoring/model.test.mjs`覆盖新增／修改／移除、不同身份和输入不变；完整Web追加验收在`wordbook-acceptance-mdLd2n`通过并核对实际确认文案、旧材料／事件与续学保留。生成一致性和离线安装预算通过。未更新真实服务或替用户保存。

取消路径亦已验收：`e2e/personal-material-authoring.test.cjs`独立实例`wordbook-acceptance-C5vgA9`中，先取消新版导入，导出仍与原完整来源逐字段一致、制作会话URL不变、个人课程版本／事件／进度与取消前一致；随后确认同一新版并保存，追加及续学保护仍通过。没有仅测试自动接受确认框。
1. 主人对成人／零基础内容、图片语义、分级、来源权利、当前学习交互的最终审查仍缺失；`approval.json` 中 level/imageMapping/rights 仍pending，publication仍not-authorized。音频A的已接受范围不自动扩展成所有素材批准。
2. 当前只有快捷键帮助，没有通用答案提示功能；不能虚构提示使用次数，未记录的历史错误也不能补造。
3. 新入口待主人实际走一遍添加与学习；自动测试不能替代用户验收。旧14600数据未搬入新环境。
4. Safari／iOS、实体手机听感和真实麦克风未验证；麦克风目前明确暂缓。
5. 真实服务部署、账号导入、学习记录迁移、公开发布均没有授权，不在自动验收中执行。

已知测试维护：选词改为点选即提交后，零基础与材料复用脚本不再点击已删除的确认按钮；离线用例先等待目标词条真正渲染，再断网。旧用例误在下一词加载前断网导致超时，修正等待条件后通过，没有改产品来迎合测试。

## 扩展回归与构建体积复核

- checks/unit统一运行 `output/test-results/20261020003501651-5384/summary.json` 为200/216，16项失败；不能称全仓测试通过。后续定向修复不追溯改写该报告。
- 与本轮相关的学习存储fixture、重试入口、学习页紧凑布局、独立学习页导航例外已定向复测；首页、封面和已有课程内容相关的其余失败不在本轮擅自改动。
- 统计页生成产物改为压缩脚本与样式，保留既有加载策略和1.5 MiB原子安装上限；没有改变首页布局，也没有把必需资源移出原子清单。`scripts/sw-install-budget.test.cjs`及`sw-policy.test.js`（21项）通过。
- `scripts/stats-page.test.cjs`去除对压缩局部变量名的依赖，同时明确检查Shadow DOM查询转发，3项通过；共享账号存储及无iframe约束仍保留。
- 压缩后的真实Web五方式答题／离线补交／完成与错误分账再次通过，独立实例 `wordbook-acceptance-4GBCOp`；`scripts/check-generated.mjs`通过。此处仍非真实服务部署或主人验收。
- 首页紧凑测试追加诊断：原fixture缺少`js/learning-navigation.js`；临时补齐后，旧`.workspace-nav`断言仍失败（实现为`.learning-global-nav`），记录链接已为`main.html?view=stats`，再继续运行会等待不存在的“系统设置”按钮（静态页为“登录”）。试验性fixture／断言修改已撤回，未改首页实现。该失败包含多处历史契约变化，不可直接认定为本轮单词课程回归，也尚不能标为通过。
- 完整来源制作链再次复测通过：`e2e/personal-material-authoring.test.cjs`，独立实例`wordbook-acceptance-wUBihd`；覆盖导入／刷新／导出、实际保存读取、引导练习记录、来源保留式新增单元、旧材料与事件保留、追加后续学和HTTP账号隔离。
