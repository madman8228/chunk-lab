# Chunk Lab · G3 备份恢复演练报告（独立实例）

日期：2026-09-22 · 角色：SoftwareWorkshop（gstack-lead 口径）
纪律：**先读码/实测再下结论**；推断与已确认分开列；因果必须用受控实验证，不靠推理

---

## TL;DR

1. **G3 已完成演练，两道恢复机制的结果是「一好一坏」**：
   - **全库快照 → 换库恢复：✅ 通过**。快照 `integrity_check=ok`、16/16 表齐全、**15 张内容表与生产逐表行数一致**，
     在独立实例上用当前服务端代码启动成功（`/api/health 200`），**启动迁移没有吃掉任何内容数据**。
   - **账号级恢复（`backup-cli preview→apply`）：❌ 条件性失败** —— 已定位根因并用**受控 A/B 证明因果**（见 §三）。
2. **本次演练唯一的负面结论是一条真实缺陷（新登记 `F-002`）**：
   任何 `user_kv` 行 `rev = NULL` 且其值与待恢复内容不同时，**整个账号级恢复/冲突解决批次被拒**（`SYNC_CONFLICT`，事务回滚）。
   **生产库当前已有 7 行命中该条件**（8 个有 kv 数据的账号中，7 个的 `settings` 是 `rev=NULL`）。
3. **不受影响的部分**：无静默丢数据（写入是 fail-closed 地**拒绝**，不是悄悄写坏）；全库换库回滚路径完好。
4. **建议**：`F-002` 现在修成本最低（**线上真实学习数据≈0**：42/43 是自动生成的游客账号，仅 1 套题库、`user_courses=0`）。
   若等真实用户积累后再修，受影响的正是「冲突时想保留本机数据」的用户。

---

## 一、结论卡

| 项 | 状态 | 实测证据 | 判据文件 |
| --- | --- | --- | --- |
| 生产快照存在且可用 | ✅ | 14 份快照（=KEEP 上限），最新 `chunklab_db_20260922_175205.db`，471,040 B，`sha256 ff6431f6…` | `output/_g3-prod.json` |
| 快照完整性 | ✅ | `PRAGMA integrity_check = ok`；16/16 表齐全 | `output/_g3-inspect.txt` |
| 快照忠实性（vs 生产） | ✅ | 15/16 表行数**完全一致**；唯一差异 `user_change_seq 39→43` 为**每用户计数器**（启动按有数据用户回填，只增不减），非内容表 | 同上 |
| 独立实例可用快照启动 | ✅ | 换库后启动 `/api/health 200`；无有损迁移日志 | `output/_g3-drill.txt` |
| 启动迁移不丢数据 | ✅ | 启动前后 **15 张内容表行数全部不变** | 同上 |
| 恢复库鉴权面正常 | ✅ | `/api/config → requireAuth=true`；未认证 `/api/data → 401`；随机口令登录 admin 被拒 ⇒ **管理员凭据哈希随库恢复** | 同上 |
| **账号级恢复（应用级）** | ❌ **条件性失败** | 不带 `revs` 时 `apply --confirm` 退出码 1、数据**未**恢复；显式带 `revs` 时**成功恢复**（见 §三 A/B） | `output/_g3-nullrev-ab.txt` |

---

## 二、已确认 · 有数据（可直接当事实用）

**部署与线上复检（本轮先做的一步）**
- 推送 `f5219ef..9e98353`（3 笔）→ 部署 `DEPLOY_EXIT=0`，九步全绿；上传 114 文件；`js/` 四个模块 md5 与本地逐一相符。
- 线上安全复检（**在生产机上执行**，避开本机沙箱把 `curl -o /dev/null` 判成假 `000`）：
  **48 通过 / 0 失败 / 1 待人工（仅 `Server: nginx`）/ 变体族 165 条全被拒**；HSTS 有；证书有效至 2026-12-08。

**生产数据画像（决定 G3 的证明力）**
- `users = 43`，其中 **42 个是 `guest_*` 游客账号**；`user_decks = 1`；`user_courses = 0`；`user_course_progress = 0`；
  `user_entity_rows = 3`（全为 `mastered`）；`user_sentence_stats = 16`；`user_kv = 24`（仅 8 个账号有，值最大 266 B）。
  ⇒ **线上实质没有真实学习数据**，因此 G3 不能靠「核对既有课程/学习记录」取证，只能靠**快照忠实性 + 启动可读 + 自造数据端到端往返**。

**`F-002` 缺陷四要素（均已核实到行号）**
| 项 | 内容 |
| --- | --- |
| 现象 | 账号级恢复 / 冲突解决被拒：`{"error":"云端已更新，请先比较双方版本，本次同步未写入","code":"SYNC_CONFLICT"}`，整批回滚、数据未写入 |
| 触发条件 | 该账号存在 `user_kv` 行且 `rev IS NULL`，且该键的值与待恢复内容**不同** |
| 根因 | **读侧与写侧对 `rev = NULL` 的语义不一致**：读侧 `server/services/data-snapshot.js:39` 把 `null` **原样**放进 `revs`；写侧 `server/sync-conflict.js:9` 却把 `null` **归一为 0**。`server/services/batch-replacement.js:16` 据此推出 `baseRevs = null`，而 `sync-conflict.js:12` 中 `baseRev === null` 的语义是**「该实体必须不存在」** —— 实体明明存在 ⇒ 必然 `BASE_REV_MISMATCH` |
| `rev = NULL` 从哪来 | `server/services/data-save.js:95`：`(revs.kv && revs.kv[k]) == null ? null : revs.kv[k]` —— 载荷不带 `revs` 的写入（legacy/无版本写入）**明确落 NULL** |
| 影响面 | ① 文档化的账号级恢复 `backup-cli preview → apply`（`README.md:255`、`deploy/deploy-tencent.md:115`）；② 客户端冲突对话框的「使用本机」（`api.js:134 resolveSyncBatch` → 同一端点同一代码路径） |
| 不受影响 | 全库快照换库（§一已证）；无静默数据损坏（fail-closed 拒绝） |
| 生产命中面 | `user_kv.rev`：**NULL=7 / 非 NULL=17**；8 个有 kv 数据的账号中 **7 个的 `settings` 是 `rev=NULL`**（仅 `u36` 为整数） |
| 为何 123/123 没抓到 | e2e 的 `route.fetch()` 确实打到真实服务端，但**全部由版本化客户端路径写入**（`rev` 为整数）；`server/sync-resolution.test.js` 用合成快照；**无「`rev=NULL` + 值不同」用例** ⇒ 结构性测不到 |

---

## 三、因果证明（受控 A/B，不是推理）

同一个独立实例、同一份生产快照，两组**仅一点不同**：PUT 是否显式携带 `revs`。

| 组 | PUT 载荷 | 库内 `settings.rev` | `backup → preview → apply` | 恢复结果 |
| --- | --- | --- | --- | --- |
| A | 不带 `revs` | `null` | **exit=1**（`SYNC_CONFLICT`） | ❌ 未恢复（`q1=0 / total=0`） |
| B | 显式 `revs` | 整数（`4`） | **exit=0**（`[apply] OK`） | ✅ 已恢复（`q1=3 / total=42`） |

⇒ **因果成立**；同时说明**恢复机制本身是好的**，缺陷是条件性的（只卡在 `rev=NULL`）。
原始输出：`output/_g3-nullrev-ab.txt`。

---

## 四、仍是推断 · 未验证

1. **客户端冲突解决「使用本机」是否在这些账号上实际失败** —— 代码路径相同（`api.js:134` → `/api/sync/batch/resolve` → `applyLocal` → `makeBatchReplacement`），
   但**未在浏览器里跑通一次真实冲突**去复现；因此「用户可见失败」属**推断**。
2. **`settings` 为什么独独是 `rev=NULL`** —— 观测到 7/8 命中，但未追到是哪一代客户端/哪条写入路径造成的（`/api/import`？旧版开放模式客户端？）。
   不影响根因判定，但影响「是否还会持续产生新的 NULL 行」。
3. **修复方案中的语义选择** —— 见 §五，需要产品语义拍板。
4. **G3 未覆盖**：真实弱网/断电下的半写状态、快照与恢复之间的并发写入、备份异地副本（`rclone`/`ossutil` 尚未配置）。

---

## 五、行动清单

| # | 动作 | 性质 | 建议 |
| --- | --- | --- | --- |
| 1 | **拍板 `F-002` 的修复语义** | 决策 | `baseRev === null` 到底该表示「必须不存在」还是「不存在**或**未版本化」？改 `sync-conflict.js:12` 为 `!current \|\| current.rev == null` 是最小改动（把写侧已有的 null→0 归一推到读侧一致）；改 `batch-replacement.js:16` 对存在实体传 `undefined`（放弃该实体基线约束）是另一种取向。**两种都要补「`rev=NULL` + 值不同」的回归用例** |
| 2 | 在生产上重跑一次快照恢复演练（换库式） | 外部门槛 | 生产库无真实数据，可在维护窗口做真机演练：停服→换库→启服；判据按 §一 |
| 3 | 配置备份异地副本 | 延后 | `deploy/deploy-tencent.md:122` 已写建议，未做；磁盘故障下 14 份本地快照会一起没 |
| 4 | 把本次演练脚本沉淀为常规演练 | 延后 | 现放在 `output/`（一次性）；若要「每月一次」制度化，建议提升到 `scripts/restore-drill.sh` + 纳入 `RELEASE_CHECKLIST` |

---

## 六、诚实边界

- 本报告**确认为事实**的：快照完整性/忠实性、独立实例启动、启动迁移不丢内容表、鉴权面、`F-002` 的存在与因果、生产 rev 分布。
- 本报告**属推断**的：客户端「使用本机」的真实失败、`settings` 为 NULL 的来源、修复方案的取舍。
- 演练在**本机**做（生产侧全程只读）。未在生产上停服换库 —— 那是有停机与回滚风险的动作，须单独授权。
- 本机演练副本（含生产用户表/哈希）在报告产出后**已删除**，只保留文本证据；需要复现按 §七 命令重新取。

---

## 七、复现命令（证据文件与步骤）

```bash
# 生产侧只读探针（打印快照清单 + 库内行数基准）
ssh ubuntu@<prod> "sudo env CHUNKLAB_DATA_DIR=/opt/chunklab/server/data /usr/bin/node -" < output/_g3-probe-prod.cjs

# 取最新快照副本（生产临时文件用完即删）
ssh ubuntu@<prod> "sudo cp /opt/chunklab/server/backups/<最新>.db /tmp/g3.db && sudo chmod 644 /tmp/g3.db"
scp ubuntu@<prod>:/tmp/g3.db output/g3-drill/prod-snapshot.db
ssh ubuntu@<prod> "sudo rm -f /tmp/g3.db"

# 快照校验（完整性 + 与生产逐表比对）
node output/_g3-inspect.cjs output/g3-drill/prod-snapshot.db output/_g3-prod.json output/_g3-inspect.txt

# 独立实例恢复演练（换库 + 启动 + 鉴权面 + 应用级往返）
node output/_g3-drill.cjs output/g3-drill/prod-snapshot.db output/_g3-drill.txt

# 受控 A/B：证明 rev=NULL 与恢复被拒的因果关系
node output/_g3-nullrev-ab.cjs output/g3-drill/prod-snapshot.db output/_g3-nullrev-ab.txt
```

---

## 免责声明

本报告基于本机只读探测与独立实例演练，**未在生产上执行停服/换库**，也未部署或改动任何生产配置。
`F-002` 的修复方案属建议，实施前需确认语义取舍并补回归；代码改动应在获得明确指令后进行。
