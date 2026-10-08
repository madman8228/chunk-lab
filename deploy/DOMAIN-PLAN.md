# jqka.top 域名与部署方案

> 2026-10-05 实测整理。**本文档只给方案与清单，未执行任何线上改动。**

## 一、现状实测

| 对象 | 实测结果 |
|---|---|
| `jqka.top` 根 | **English MUD**（Vite SPA，`/assets/index-CQ2ggqKN.js`，nginx 1.24.0 Ubuntu）—— 200 |
| `chunklab.jqka.top` | Chunk Lab —— 200，反代 `127.0.0.1:8787` |
| `app / learn / study / words.jqka.top` | **均未解析**（无响应） |
| jqka-top 落地页 | 本地 `index.html`，**未上线** |
| Chunk Lab 后端 | systemd `chunklab`，端口 8787 |
| nginx 站点 | `/etc/nginx/sites-available/chunklab` → `sites-enabled/chunklab` |
| TLS | certbot，`/etc/letsencrypt/live/chunklab.jqka.top/` |

**关键实测结论（搬迁实验得出，非推断）**：Chunk Lab 前端页面级引用与跳转**零绝对路径**；唯一硬编码是 `sw.js` 的 **157 处绝对路径**（`PRECACHE` 清单）。搬到子路径下不改这 157 处 → Service Worker 装不上 → PWA/离线整体失效（实证 registrations=0、缓存 0 条）。

---

## 二、唯一的阻塞决策：English MUD 还要不要？

`jqka.top` 根路径现在被 English MUD 占着。落地页要上线就得占根 —— 所以这件事不定，后面所有方案都排不动。

| English MUD | 结论 |
|---|---|
| **不要了** | 走方案 C，成本最低且一劳永逸 |
| **还要留** | 走方案 B，或先把它挪到 `jqka.top/mud/` 腾出根再走 C |
| 暂不想动 | 走方案 B，落地页暂不上线（不影响 Chunk Lab） |

---

## 三、方案矩阵

| 方案 | 做法 | 前端改动 | 服务器改动 | 判断 |
|---|---|---|---|---|
| **A 维持现状** | 单词硬塞进 `chunklab.jqka.top` | 0 | 0 | ❌ 「意群实验室」里背单词，每加一模块违和重一分 |
| **B 子域改名** | `chunklab.jqka.top` → `app/learn.jqka.top` | **0** | nginx 3 处 + 新证书 + 301 | ✅ **推荐** |
| **C 合并主域** | `jqka.top/study/` + 落地页占根 + MUD 让位 | sw.js 157 处 | nginx 2 location + MUD 处置 | ⚠️ 品牌最优，但一次动三件事 |
| **D 单词单独开域** | `words.jqka.top` | 巨大 | 新站点全套 | ❌ SRS/账号/同步/档案全部重写一遍 |

### 方案 B 的深度理由

1. **名字撑得住三个模块**：`app.jqka.top` 是中性名，意群 / 背单词 / 图文课装进去都不违和。
2. **前端零改动**：B 不动任何路径结构 → 实证出来的 SW 坑完全不触发。
3. **两件事解耦**：改名 和 落地页上线 互不影响，可以分开做、分开发。
4. **现在改名最便宜**：`app/learn/study` 三个子域实测均未解析 = 名字随便挑；服务还没推广，改名的真实代价就是几行配置 + 一张证书。

### 方案 C 的额外收益（值得知道）

走 C 之后，落地页的试玩卡学习记录能通过同域 `localStorage` 直接带进产品 —— 「试玩 → 正式学习」真连上。B 方案下两个域不互通（但只要落地页不存学习数据，就不痛）。

---

## 四、方案 B 改造清单（可直接执行）

### 1. nginx：改 `server_name` + 加旧域 301

```nginx
# /etc/nginx/sites-available/chunklab
server {
    server_name app.jqka.top;          # ← 只改这一行
    server_tokens off;
    client_max_body_size 100m;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
    # TLS 由 certbot 注入
}

# 新增：旧域 301 到新域（保住已有的书签/分享链接）
server {
    listen 443 ssl;
    server_name chunklab.jqka.top;
    # 复用旧证书，certbot 续期时保留
    ssl_certificate     /etc/letsencrypt/live/chunklab.jqka.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chunklab.jqka.top/privkey.pem;
    return 301 https://app.jqka.top$request_uri;
}
```

### 2. 证书

```bash
# DNS 先加 A 记录：app.jqka.top → 服务器 IP，生效后：
sudo certbot --nginx -d app.jqka.top --redirect
```

### 3. 后端

**零改动**。`chunklab.service` 监听 8787，与域名无关。

### 4. 前端

**零改动**（实证：无任何绝对路径引用，SW scope 相对路径不受影响）。

### 5. 生效

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 6. 验收判据（部署后 10 秒内可验）

```js
// 浏览器控制台执行
const regs = await navigator.serviceWorker.getRegistrations();
const ks = await caches.keys();
// ✅ 期望：regs.length === 1，regs[0].active.state === 'activated'
// ✅ 期望：某个 cache 的 keys().length > 100
// ❌ 若 regCount=0 或缓存 0 条 → 有问题，别收工
```

---

## 五、方案 C 改造清单（若 English MUD 让位）

### 1. nginx：两个 location，关键在 `/api/` 留在根

```nginx
server {
    server_name jqka.top;

    location /study/ {                      # Chunk Lab 页面
        proxy_pass http://127.0.0.1:8787/;  # 末尾斜杠：剥掉 /study/ 前缀
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {                        # 留在根 → api.js 零改动
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /mud/ { ... }                  # English MUD 挪这里（若要留）
    location / { ... }                      # 落地页 index.html
}
```

### 2. sw.js：157 处绝对路径 —— 建议做根因修复，不要批量替换

批量替换是「改一次搬一次」，将来再动还得再来一遍。**根因是路径写死**，改成按运行时位置自动算：

```js
// sw.js 顶部加一行
const BASE = new URL('./', location).pathname;   // '/study/' 或 '/'
const P = x => BASE + String(x).replace(/^\//, '');

// PRECACHE 用法改为：
const PRECACHE = ['/main.html', '/core.js', /* ...157 项原样不动... */].map(P);
```

这样根路径部署、子路径部署、将来再换路径，**一行都不用改**。其余 157 处之外的绝对路径（navigation fallback 等）同样套 `P()`。

### 3. 验收判据：同方案 B 第 6 条（SW 必须 activated + 缓存 > 100）

---

## 六、产品命名落地（推荐）

```
JQKA（品牌）
└── jqka.top            落地页（分发入口）
    └── app.jqka.top    产品域
        ├── main.html     意群练习（Chunk Lab 模块，现有）
        ├── words.html    背单词（待建，复用 SRS/账号/同步）
        ├── decks.html    题库
        ├── stats.html    学习档案
        └── courses.html  图文课
```

**背单词的实现要点**：把「单词牌组」建模成 `deckType: 'flashcard'` 的 course —— 复用现有 `courses` + `progress` 两类同步实体，**不新增同步实体类型**（动同步协议代价大）。JQKA 段位（J=A1-A2 / Q=B1 / K=B2 / A=C1-C2）直接当难度轴，落地页叙事与产品信息架构天然对齐。

**两个必须防的坑**：

1. Chunk Lab 单体已很重（main 409KB / decks 189KB / core 236KB）—— 背单词必须独立页面 + 独立模块，**禁止塞进 main.html**。
2. 单词卡是 receptive（认不认得出），意群是 productive（拼不拼得出）—— **SRS 可共用引擎，但两种 grade 别混进同一复习队列**。

---

## 七、落地页的时机：现在上线是半成品

### 核心判断

**落地页的功能价值与可分发模块数量正相关。**

| 模块数 | 落地页价值 |
|---|---|
| 1 个（只有意群练习） | ≈ 0 —— 用户直接去 `app.jqka.top` 就行，落地页是多余的一次跳转 |
| 2 个（+ 背单词） | 开始有价值 —— 用户需要「选一种练法」 |
| 3 个（+ 图文课） | 成立 —— 落地页成为导航中枢，品牌叙事与产品信息架构合一 |

所以「选 B 之后落地页没用了」这句话**对一半**：

- **对的部分**：选 B 且 English MUD 不让位 → 落地页确实无处可放，暂时上不了线。
- **错的部分**：根因不是 B，是根被占。B（改名）与落地页上线是**两件独立的事**，互不阻塞。
- **更准确的结论**：就算现在腾出根，落地页也只有品牌/SEO 价值，**功能价值要等第二个模块就绪才成立**。

### English MUD 腾根方案（实测）

| 项 | 实测 |
|---|---|
| `mud / english-mud / english / game / lab / admin / api.jqka.top` | **全部未解析（000）** —— English MUD **没有独立子域，就占着根** |
| `www.jqka.top` | 200（与根同站，同一份 MUD） |
| MUD 源码 | `/d/06-project/english-mud`（另有 worktrees 与 tar.gz 备份） |

→ 腾根路径清晰：`mud.jqka.top` 空闲，随时可把 MUD 挪过去，签一张证书即可。

```nginx
server {
    server_name mud.jqka.top;
    root /var/www/english-mud/dist;   # Vite SPA 静态产物
    try_files $uri $uri/ /index.html;
    # certbot --nginx -d mud.jqka.top
}
```

### 三个选项

| 选项 | 做法 | 判断 |
|---|---|---|
| **① MVP（推荐）** | 先做 B 改名 + 建背单词模块；**落地页暂不上线**。等第二模块就绪，一次性腾根上线 | ✅ 不做半成品；落地页代码保留，将来直接用 |
| ② 现在上线 | 先腾根（MUD → `mud.jqka.top`），落地页上线 | ⚠️ 可接受，但要认清它现在是「一页纸引到一个按钮」 |
| ③ 不建独立落地页 | 把 JQKA 品牌叙事 + 段位体系做成 `app.jqka.top` 内的首页/关于页 | ✅ 零腾根成本，品牌资产不丢；代价是失去独立品牌入口 |

### 长期判断

`jqka.top` 是品牌域名（JQKA），根上却挂着 English MUD —— 另一个独立英语学习产品。这个状态**不可能长期成立**（品牌根域挂别的产品），**MUD 迟早要腾位**，只是早晚问题。趁现在没推广，挪走的成本就是一张证书 + 一个 server 块。

---

## 八、合并方案：落地页并入 Chunk Lab（老板已定：移除 MUD + 落地页占根）

> 结论：**应该合并，且方向是「落地页并入 chunk-practice」，不是反过来。**

反向合并（把 Chunk Lab 搬进 jqka-top）等于重新搭一遍后端（Express + SQLite + JWT + 同步协议 + systemd + nginx），零收益。

### 合并后的最终形态

```
jqka.top/                    ← 单一项目（= chunk-practice），单部署单元
├── index.html               ← 落地页（原 jqka-top/index.html）
├── main.html                ← 意群练习
├── decks.html  stats.html  courses.html  admin.html
├── sw.js   js/   assets/   content/
└── landing/                 ← 落地页私有资源（隔离，避免与产品资源混淆）
    ├── site.css
    ├── store.js
    ├── deck.js              ← 40 词
    └── phrases.js           ← 50 词组
```

### 三个好消息（实测，非推断）

| # | 实测 | 含义 |
|---|---|---|
| 1 | chunk-practice 仓库**没有 index.html**（`server/index.js` 注释明写「仓库无 index.html，入口是 main.html」） | 落地页放进去当 index.html，**零文件名冲突** |
| 2 | `jqka.top` **已有 Let's Encrypt 有效证书**（CN=jqka.top，SAN 含 jqka.top + www.jqka.top，有效期至 2026-12-28） | 换站**不用重签证书**，nginx 直接复用 `/etc/letsencrypt/live/jqka.top/` |
| 3 | 根路径部署下 SW 实测 activated、缓存 157 条 | **根路径部署 = Chunk Lab 前端零改动**，157 处绝对路径一行不用改 |

### ⚠️ 最大的坑：后端把根路径硬重定向走了

`server/index.js:457`：

```js
/* 根路径 → 入口页。仓库无 index.html（入口是 main.html），express.static 对 / 会 404 */
app.get('/', function (req, res) { res.redirect('/main.html'); });
```

**不改这行，落地页永远看不到** —— 访问 `https://jqka.top/` 会 302 跳到 `/main.html`。

改法：

```js
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
```

### 执行状态（2026-10-05）

**本地合并：已完成并验证通过**（详见下方「本地验证结果」）。
**线上：未执行 —— 卡在服务器身份无法确认**（见「⚠️ 服务器身份核实失败」）。

### 改动清单

**本地（已完成 ✅）**

1. 落地页 4 个私有文件移入 `chunk-practice/landing/`：`assets/site.css`、`assets/store.js`、`data/deck.js`、`data/phrases.js`
2. `index.html` 移入 `chunk-practice/` 根，引用路径改 4 处：`assets/site.css`→`landing/site.css`、`data/deck.js`→`landing/deck.js`、`data/phrases.js`→`landing/phrases.js`、`assets/store.js`→`landing/store.js`
3. **`server/index.js:457` 根路径改为返回 index.html**（上面那行）
4. `library.html` **直接删除** —— jqka-top 从未上线，不存在任何真实用户的旧记录，迁移提示页是给不存在的用户看的
5. SW 离线兜底 `caches.match('/main.html')` 是否改为 index.html（次要，可后议）

### 本地验证结果（起真实后端 + Playwright 实测，2026-10-05）

| 检查项 | 结果 |
|---|---|
| `GET /` | 200，返回落地页（69KB），**无重定向**（location=null） |
| `GET /main.html` | 200（Chunk Lab 练习页） |
| `GET /landing/*.js`（deck / phrases / store） | 全部 200 |
| 落地页渲染 | 卡片 6 张、段位 tab 4 个、类型筛选「全部/单词/词组」 |
| 词组筛选 | 点「词组」→ 显示 take a break / get up / look for，无音标 |
| 标熟 | 写入 `localStorage`，note 计数更新，卡不翻面 |
| 点「开始练习」 | 站内跳 `/main.html`（Chunk Lab 标题）✅ 不再跳子域 |
| 返回落地页 | 标熟状态持久化 |
| 三档宽度（390/900/1440）横向溢出 | 全部 0 |
| 页面报错 | 0 |

### ⚠️ 服务器身份核实失败（线上操作被此阻塞）

按「远端/破坏性操作先核实对象身份」的规矩，SSH 只读核实了 `~/.ssh/config` 里唯一的主机 `139.224.101.82`：

| 检查项 | 实测 | 期望（jqka 服务器） |
|---|---|---|
| hostname | `iZuf66q1hzxjmecb0vqk06Z`（阿里云命名） | — |
| nginx 站点 | `livenote.yolotech.top` / `pwa_admin` / `yolotech.top` | 应有 `chunklab`、jqka.top |
| chunklab 服务 | inactive（本机根本没有这个服务） | active |
| `/var/www` | `pwa_admin` / `pwa_user` / `html` | 应有 english-mud 产物 |
| 证书 | `livenote.yolotech.top` / `yolotech.top` | 应有 `jqka.top`、`chunklab.jqka.top` |

→ **这台是跑 yolotech 项目的服务器，与 jqka.top 无关。**

**结论：jqka.top / chunklab.jqka.top 所在服务器未知，本机无任何可用连接凭据。** 在拿到正确服务器前，线上操作（改 nginx、移除 MUD、部署）一律不进行 —— 在未确认身份的机器上执行删除是不可接受的。

> ### ✅ 更正（2026-10-07）：本结论**已被推翻**，属伪阻塞
>
> 复核手段（**只读，未连接任何服务器**）：两家独立 DoH（Google / Cloudflare）解析 + 线上响应头比对。
> ⚠️ 本机系统 DNS 被代理劫持（`nslookup` 对**所有**域名一律返回 `198.18.x.x` 假地址），**故不采信系统解析结果**。
>
> | 域名 | 解析结果 | 线上 `Server` |
> |---|---|---|
> | `jqka.top` / `www.jqka.top` / `chunklab.jqka.top` | **`82.157.125.225`**（腾讯云） | `nginx/1.24.0 (Ubuntu)` |
> | `yolotech.top` / `www.yolotech.top` / `livenote.yolotech.top` | **`139.224.101.82`**（阿里云） | `nginx/1.18.0 (Ubuntu)` |
>
> - 上表「期望」列中"应有 chunklab、jqka.top"的推断**方向正确，但核错了机器**：jqka.top 的生产机就是 **`82.157.125.225`**，与《pre-launch-check-chunklab-2026-09-21》记录的三重特征（hostname `VM-0-2-ubuntu` / nginx **1.24.0** / `chunklab` 服务 `active` / `/opt/chunklab`）**逐项吻合**，且线上 `Server: nginx/1.24.0` 独立佐证。
> - **误判根因**：只核了 `~/.ssh/config` 里**第一条**主机（该文件当时仅此一条）就下了"服务器未知"的全称结论 —— **抽样错误**：把"配置里唯一一条"当成"唯一一台机器"。
> - **`139.224.101.82` 定性更正**：它不是"别家"机器，而是**老板自己的另一台**（LiveNote / `yolotech.top` 业务线；`D:/06-project/ECS/` 存有该域阿里云证书）。但"它与 jqka.top **无关**"这个**技术结论仍然成立** —— 关联性在归属（同一老板），不在主机。
> - ⚠️ **风险因这条更正而升高**：在该机执行"移除 English MUD / 清静态目录"**会误伤老板另一条业务线**。任何远端操作前必须显式核明目标机为 `82.157.125.225`，**不得依赖 SSH 默认第一条主机**。
> - **剩余未知（唯一）**：本机是否仍持有 `ubuntu@82.157.125.225` 的可用凭据（既有部署脚本 `scripts/deploy-prod.sh ubuntu@82.157.125.225` 曾成功使用过），需一次**只读握手**确认；该动作属外部动作，须等老板指令。

**需要老板提供**：jqka.top 服务器的 SSH 访问方式（IP + 用户 + 免密已配 / 或密码），确认后按下列清单执行。

**服务器（外部动作，待服务器确认后执行）**

1. nginx：`server_name chunklab.jqka.top` → `jqka.top www.jqka.top`；ssl 证书路径改 `/etc/letsencrypt/live/jqka.top/`
2. **移除 English MUD**：停用其服务 + 删除 nginx 站点 + 清空静态目录

### 移除 MUD 前必须知道的影响面（不可逆）

| 影响 | 说明 |
|---|---|
| `jqka.top` 与 `www.jqka.top` 全部流量 | 从 English MUD 直接切到落地页，MUD 立即不可访问 |
| MUD 用户的书签/分享链接 | 全部失效 |
| 数据 | 若 MUD 有后端数据，一并停用 |

**建议顺序**（不可逆操作必须先备份）：

```bash
# 1. 先整包备份 MUD 静态产物到本地，再动手
sudo tar czf /tmp/english-mud-backup-$(date +%F).tar.gz /var/www/english-mud/
# 2. 若还想要 MUD，先挪到 mud.jqka.top（实测该子域空闲），确认可访问后再清根
# 3. 确认不要了 → 停服务、删 nginx 站点、清目录
```

### 合并后的额外收益

同域之后，`jqka.top` 与 Chunk Lab 的 `localStorage` **互通** —— 落地页试玩卡的标熟记录能直接带进产品，「试玩 → 正式学习」真正连上。这是方案 B（子域）拿不到的。
