# 同步冲突徽标：当前浏览器页面复核

- Status: needs-planning
- Updated: 2026-10-05
- Branch/worktree: `master`, `D:\06-project\chunk-practice`
- Base commit and relevant uncommitted changes: `09553dfeeef6a7aadcfe4eb71e2a372a99f6ad22`; 当前工作区包含大量用户未提交内容，尤其 `main.html`、`core.js`、`sw.js`、测试及多个 handoff。不得清理、重置或覆盖。当前仅写入本 handoff。
- Planner: GPT-6 Astra (user confirmed model switch)
- Executor: GPT-5.6 Luna

## Objective

确认并解决用户当前打开的 `127.0.0.1:8787/main.html` 仍显示“同步冲突”徽标的问题。首先让当前浏览器重新取得正在工作区中的页面与配置；仅当新载入页面仍显示徽标时，继续定位服务响应、页面资源和 Service Worker 的实际不一致。不得为消除徽标切换真实持久化协议、清除浏览器存储或丢弃冲突原件。

## Current state and evidence

- 当前 in-app browser 的 `main.html` 可访问性树明确包含 `button#syncBadge`，名称为“同步冲突，点击查看处理状态”。这是当前标签页的直接证据。
- 同一时刻对 `http://127.0.0.1:8787/api/config`、`/main.html`、`/sw.js` 的只读 GET 均返回连接拒绝。因而无法从服务端取得当前资源，也不能断言用户看到的是 Service Worker 缓存、旧的已加载文档，还是旧服务版本。
- 工作区 `main.html` 当前不含 `#syncBadge`、`sync-resolution-ui` 文本；此前完成的隔离 E2E 证明更新后的页面合同，但不能证明当前标签页已加载该版本。
- `docs/implementation/2026-10-05-sync-badge-runtime-diagnosis.md` 状态为 `complete`，其真实实例结论仍是未核实；`2026-10-02-transparent-learning-persistence.md` 和 `2026-10-04-sync-conflict-cutover.md` 仍为 `in-progress`。不得把本次运行时复核视为全站迁移完成。
- README 的本地开发启动方式是在 `server` 目录运行 `node -r ./loadenv.js index.js`；端口默认 8787。不要安装依赖、改 `.env`、改数据库或执行部署。

## Assumptions and decisions

- 用户要求普通学习流程不暴露同步冲突；这一产品决定已记录在 10/05 sync diagnosis handoff。
- 当前标签页仍打开且服务不可达时，优先保留标签页，不先刷新，以免丢失尚未确认的页面状态。启动服务后先探测只读 `/api/health`、`/api/config`、`/main.html`、`/sw.js`，再决定是否在该标签页刷新。
- 若现行本地服务启动会读取或迁移真实本地数据库，应先检查配置/路径；无法确认是开发隔离数据时停止并向用户说明，不自行更换 DB 路径或创建覆盖性配置。
- 如果新鲜页面加载后徽标消失，根因归类为旧标签页/旧资源仍在显示；不改产品代码。若仍出现，则用新鲜 DOM、config、资源版本和 SW 控制状态找出具体旧代码入口，再只改有证据支持的最小范围，并回归 protocol 2、protocol 3、配置未知三个隔离场景。

## Scope

- 按 README 约定恢复用户之前指定的本地开发服务（仅在确认其数据目录与现有设置后）；记录健康状态及配置中的持久化协议，不输出密钥或账号数据。
- 对当前页面与服务器返回内容进行对照；安全刷新用户已打开的页面，检查真实 DOM 是否仍含 `#syncBadge` 或同步冲突处理 UI。
- 如仍复现，基于证据修正工作区内对应的 HTML/脚本/SW 版本加载路径，并增加最小隔离 Chromium 回归，验证普通学习页面不暴露徽标、旧冲突材料仍保全。
- 将运行时结论追加到本 handoff、10/05 diagnosis handoff 与主 handoff；不得勾选与此无关的全站验收项。

## Out of scope

- 不修改生产服务、生产协议默认值、用户数据库、冲突归档或浏览器本地数据。
- 不清理/注销 Service Worker、不清空缓存或 storage 来规避现象；如必须验证新旧 SW 生命周期，使用隔离 Chromium profile。
- 不把缺少同步徽标等同于云端已确认；不继续实施主 handoff 其余业务迁移。

## Contracts and data changes

- UI 是否显示徽标必须以实际新加载页面的 DOM 为准；服务端 API config、静态 HTML/JS/SW 与浏览器 controller/version 需在证据中分开记录。
- 只读状态探测不打印 token、API key、用户标识、学习正文或冲突快照。
- 若当前用户页面状态可能尚未落盘，刷新前须确认其本机耐久状态；不确定时先停止，不丢页面状态换取视觉验证。
- 产品代码如需修改，旧冲突来源和 pending 均必须保持；普通页面隐藏内部冲突 UI 不得改变 durable queue 或同步协议语义。

## Implementation steps

- [ ] 1. 核实 `server/.env` 及数据库路径是否可安全用于本地开发；只读取状态，不回显秘密，不迁移/删除任何数据。
- [ ] 2. 按 README 恢复本地开发服务；GET 检查 `/api/health`、`/api/config`、`/main.html`、`/sw.js`，记录 status、构建/缓存标识及协议字段，不触发写 API。
- [ ] 3. 确认页面已有本机耐久状态后，刷新当前 in-app browser 标签；记录 DOM 中 `#syncBadge`、旧冲突 modal、活动 Service Worker controller 及加载资源版本。
- [ ] 4. 若刷新后无徽标：不改产品代码，记录“旧标签页/资源与工作区版本不一致”及可重复验证步骤。若仍有徽标：沿实际加载来源追到具体脚本/缓存/服务版本，提交最小代码修复和隔离 Chromium 回归；不做猜测性 SW 清理或全站协议切换。
- [ ] 5. 更新相关 handoff 的证据与剩余限制；主持久化 handoff 继续保持 `in-progress`，除非其全部独立验收已完成。

## Validation

- [ ] 只读 GET `/api/health`、`/api/config`、`/main.html`、`/sw.js` 成功；输出不含敏感配置。
- [ ] 当前已打开页面刷新后可确认真实 HTML/JS/SW 版本；ordinary DOM 中不存在同步冲突徽标与整账号选边弹窗。
- [ ] 若产品代码改动：至少运行对应定向 Chromium 测试，并复验 protocol 2 / protocol 3 / config unknown 的无冲突 UI 行为、离线耐久提示及冲突原件保全；运行目标 lint、`npm run build:check`、`node scripts/check-sw.js`（若改了 SW 输入）。
- [ ] 对本次实际改动执行定向 `git diff --check`；不得因工作区其它既有文件报错而清理它们。

## Acceptance criteria

- [ ] 当前标签页的徽标来源被实证定位，而不是把浏览器截图或隔离测试当作生产/本地运行时结论。
- [ ] 用户重新查看的页面与工作区当前版本一致；普通学习页面不再显示内部同步冲突 UI。
- [ ] 用户已有学习状态、待办和双方冲突归档均未被清理/覆盖；没有把本机保存误报成云端确认。
- [ ] 若服务或数据库路径存在风险，明确停止在只读诊断并记录所需用户决定，不擅自重配环境。

## Risks and rollback

- 本地服务启动可能打开或初始化其配置指向的 SQLite 文件；启动前检查 `.env` 中的 DB 路径与工作区现状，无法证明安全则停止。
- 刷新可能终止旧标签页中未落盘状态；刷新前核对耐久保存事实，失败或未知则保留标签不刷新。
- 仅当证实资源版本错配且代码修复必要时更新 SW 资源清单；保留现有缓存兼容策略，不清除用户缓存。所有产品更改都应可通过窄 diff 逆转。

## Execution notes

- 2026-10-05 planning：用户确认已切换到 GPT-6 Astra。当前 in-app browser 可访问性树含 `button#syncBadge`；同一时刻本地 8787 的三个只读 GET 均连接拒绝，故当前文档/活动 SW/服务配置来源无法再区分。工作区源码已无该按钮。仅新增本 handoff；未启动服务、刷新页面、改产品代码、触碰数据库或部署。
- 2026-10-05 execution gate：按 handoff 检查启动边界时发现 `server/.env` 明确设置 `NODE_ENV=production`，`CHUNKLAB_DATA_DIR` 为空；`server/db.js` 因此会回退到 `server/data/chunklab.db`。该文件当前存在，约 107 MB（最后修改 2026-09-28）。启动服务可能打开/初始化这份现存数据库；它不能按“本地开发数据库”安全处理。依照风险条款停止：没有启动 8787、没有刷新当前页面、没有读写数据库或修改产品代码。需要用户明确选择：A) 提供/指定一个可确认隔离的开发数据目录并允许在非 8787 端口启动；或 B) 明确授权使用现有 `server/data/chunklab.db` 启动当前 production 配置的 8787 服务。未裁定前 handoff 为 `needs-planning`，禁止继续其服务启动步骤。
