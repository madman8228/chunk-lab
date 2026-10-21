# 旧试用课程索引与构建一致性核查

日期：2026-10-17。

## 原因

`check-generated.mjs`报告的`content/vocabulary/index.json`过期不是文件丢失。六词旧试用课程现有词条使用v2宽屏/移动端AVIF与WebP引用，而`build-vocabulary-content.mjs`改为强制生成v3共享WebP引用。图片字段参与contentRevision计算，因此六个词条及课程revision全部不同。

只读对比确认：将已有images字段与当前文本源一起计算哈希，六个词条均与现有contentRevision一致。24个实际旧图片文件全部存在且严格小于20,000字节，最大19,998字节。没有理由以修复检查为名迁移既有课程。

## 修正

构建脚本为这六个既有试用词显式保留v2交付引用。新词默认仍使用同一个16:9 v3 WebP作为wide/mobile引用。每个实际引用文件（包括旧备用格式）均逐个验证20,000字节硬上限。

没有从生成输出反向推断输入，也没有跳过索引比较；生成一致性检查保持原样。没有改写索引、词条、图片、学习记录或数据库，没有删除v2或v3资产。修正的是构建规则，而不是覆盖课程来迁就规则。

## 自动验证

- 新增`vocabulary-generated-preservation.test.mjs`：只在新分配的临时目录生成，索引和六个词条均与现有文件逐字节一致；检查每个交付图的实际大小。
- `check-generated.mjs`：全量生成一致性检查通过，不再报告该索引过期。
- vocabulary-course-contract、workspace-background-retry、api-read-coalescing、test-manifest-contract、check-sw通过。
- 新测试由现有测试清单自动发现，无需手动登记；未修改前端资源，无需重新生成SW。

## 请求优化复核结论

工作区个人目录当前只有一个直接读取入口，`LearningWorkspaceRuntime.refresh()`已有进行中任务合并。本轮没有为了统一接口额外增加一个没有确认收益的合并层。

已完成后的连续focus/server-cache-applied刷新仍可能读取目录，但它们也承担导入、恢复、跨设备更新的可见性；本轮没有引入长期缓存或忽略更新通知。跨标签页选主、历史分页与统计字段协议减量仍未实施。

本轮收益是消除误导性的构建失败并保护旧课程版本稳定性，不是新增网络流量降幅。未重启或切换真实服务，没有操作用户浏览器数据。
