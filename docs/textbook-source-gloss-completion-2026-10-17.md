# 高中三册词汇释义补全

教材：人民教育出版社《普通高中教科书 英语》，2019年版，必修第一、二、三册。词性和中文释义依据用户提供的各单元词汇扫描页转录，保留源图、原配图清单与旧审核记录。当前状态为转录完成、待用户审核；不代表课程发布或逐图语义审核通过。

## 数量与来源

| 册次 | 原有配图词条释义 | 新补录待配图词条 | 审核页词条数 |
|---|---:|---:|---:|
| 必修第一册 | 326 | 6 | 332 |
| 必修第二册 | 349 | 1 | 350 |
| 必修第三册 | 393 | 2 | 395 |
| 合计 | 1068 | 9 | 1077 |

各册 `output/textbook-extractions/highschool-pep-requiredN-2019-20261016/` 保存：

- `source-glosses-v1.txt`：按源单元、扫描文件、教材页码或复合页位置记录词头和教材词性释义。
- `source-glosses-v3.json`：逐项绑定已有词条 ID 的当前释义来源。包含扫描与转录文本 SHA-256、来源行和单元。v1/v2 JSON 为本轮中间版本，保留追溯；应用读取 v3。
- `source-missing-entries-v1.json`：9个补录普通词条的独立待配图草稿，不编造图片。
- `source-gloss-reconciliation-v2.json`：唯一对应数量、源单元修正、词头修正和未对应源词条。

## 纠错与待处理

第一册原清单有24项把Unit 1词条放入Welcome Unit；第三册有31项跨页归属错误。审核视图改用源单元，原词条ID与文件位置保持不变。

词头修正：`absorbed` → `absorbed in sth/sb`、`in spite` → `in spite of`、`consult` → `consulate`。三项均在审核页标出图义复核问题，不能凭新释义自动通过旧配图。

9个待配图词：第一册 responsibility、amazed、helicopter、revival、reference、based；第二册 equipment；第三册 earn、china。均已保存教材释义与来源并显示在审核页。

第三册 Christmas carol、Merry Christmas! 保存在源页转录及 deferredScope 中，沿用先前不新增节庆文化名称配图的范围，未新增图片或虚报配图完成。

部分第三册源图是复合页，对尚未核定的印刷页码保持空值，使用扫描文件及左右页位置追溯，不猜测教材页码。审核弹窗可直接打开相应原页。

## 状态与保护

当前审核上下文指纹包含教材词头及释义，补入来源文本后先前的通过状态不会自动套用到新上下文；旧审核记录及意见仍在历史中。新增字段只影响审核草稿，不改真实账户课程和学习记录。

`node scripts/build-textbook-source-glosses.mjs` 生成新的派生数据；目标已存在且内容不一致时拒绝覆盖，需显式制作新版本。`node scripts/textbook-source-glosses.test.mjs` 检查数量、ID、来源文件、哈希及关键纠错。服务端测试与浏览器测试使用临时数据库和独立端口。
