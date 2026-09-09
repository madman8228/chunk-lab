# Chunk Lab 小圈子上线部署清单（2026-09-09）

> 适配"给 5–10 个朋友/同事自用"。目标栈：腾讯云轻量（或任意 VPS） + Nginx 反代 + systemd 守护 + Let's Encrypt TLS。本文档不复用 duoyin 的部署动作细节，结构对齐老板熟悉流程。

---

## 0 · 前置确认（已通过）

- ✅ 代码侧 P0/P1 安全加固（见 `pre-launch-check-multiuser-2026-09-09.md`）
- ✅ `npm test` 79/79；`e2e` 69/69
- ✅ `auth-ui` 登录遮罩永不清除 bug 已修（`796bcec`）
- ✅ `migrate-open-to-user.js` 迁移工具已就绪（commit `<hash>`）
- ✅ 设置弹窗"账号"区块已加（`796bcec`）

---

## 1 · 服务器准备

### 1.1 Node.js（≥18，已验证 22.22.2）

```bash
node -v    # ≥ v18，否则：curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

### 1.2 项目部署（推荐路径 `/opt/chunklab`，数据 `/var/lib/chunklab`）

```bash
sudo useradd -r -m -d /var/lib/chunklab chunklab
sudo mkdir -p /opt/chunklab /var/lib/chunklab/data
sudo chown -R chunklab:chunklab /opt/chunklab /var/lib/chunklab
cd /opt/chunklab && sudo -u chunklab git clone <你的仓库地址> .
cd /opt/chunklab && sudo -u chunklab npm ci --omit=dev   # 仅生产依赖
```

### 1.3 防火墙 / 安全组

- 暴露：22（维护）, 80（HTTP→HTTPS 重定向）, 443（HTTPS）
- **不要** 暴露 8787 给公网——只能 Nginx 127.0.0.1:8787 反代

---

## 2 · 环境变量（`/opt/chunklab/server/.env`，权限 600）

```ini
# === 必填：生产三件套 ===
NODE_ENV=production
REQUIRE_AUTH=true
JWT_SECRET=               # openssl rand -hex 32  ← ≥32 字符；少一位直接拒启

# === 推荐：域名与跨域 ===
PORT=8787
CORS_ORIGINS=https://lab.example.com   # 多个用逗号；前端同源部署可留空（fail-closed）
TRUST_PROXY=true                       # 经 Nginx 反代必须开；否则限速 IP 用 127.0.0.1 误锁

# === 数据与备份 ===
CHUNKLAB_DATA_DIR=/var/lib/chunklab/data
TOKEN_TTL=30d                          # 登录有效期

# === AI 停用（默认；恢复开发时改 true） ===
AI_EXPLAIN_ENABLED=false
```

```bash
sudo chown chunklab:chunklab /opt/chunklab/server/.env
sudo chmod 600 /opt/chunklab/server/.env
```

---

## 3 · systemd 守护（`/etc/systemd/system/chunklab.service`）

```ini
[Unit]
Description=Chunk Lab (Express + SQLite)
After=network.target

[Service]
Type=simple
User=chunklab
Group=chunklab
WorkingDirectory=/opt/chunklab
ExecStart=/usr/bin/node server/index.js
EnvironmentFile=/opt/chunklab/server/.env
Restart=on-failure
RestartSec=5
# 安全加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/chunklab/data
ProtectHome=true
# 资源
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chunklab
sudo systemctl status chunklab    # 应显示 active (running)
curl -s http://127.0.0.1:8787/api/config | head -c 200   # 本机探活
```

> 探活看到 `requireAuth:true` 即就绪。

---

## 4 · Nginx 反代 + TLS（站点 `/etc/nginx/sites-available/chunklab.conf`）

```nginx
# HTTP → HTTPS
server { listen 80; server_name lab.example.com; return 301 https://$host$request_uri; }

server {
  listen 443 ssl http2;
  server_name lab.example.com;

  ssl_certificate     /etc/letsencrypt/live/lab.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/lab.example.com/privkey.pem;
  ssl_protocols       TLSv1.2 TLSv1.3;
  ssl_ciphers         HIGH:!aNULL:!MD5;

  # 安全头（与 chunklab 的 fail-fast 互为补强）
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # ★ 关键：白名单目录托管前端。Nginx 直挂仓库根会暴露 server/node_modules/*.md
  # 这里只给前端入口 + 可对外的资源。
  root /opt/chunklab;
  index main.html;

  location / {
    try_files $uri $uri/ /main.html;   # SPA 友好：未知路径回主入口
  }

  # Express API 反代（带 XFF 给 trust proxy 1）
  location /api/ {
    proxy_pass         http://127.0.0.1:8787;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_read_timeout 60s;
  }

  # SW 不缓存（保证升级即时）
  location = /sw.js { add_header Cache-Control "no-cache"; types {} default_type application/javascript; }
  location = /manifest.json { add_header Cache-Control "no-cache"; }

  # ★ 严禁：/server /node_modules /output /scripts /e2e /deliverables
  # （Express 端已 403，Nginx 这层用 return 抢先）
  location ~ ^/(server|node_modules|output|scripts|e2e|deliverables)/ { return 404; }
  location ~ /\.(git|env|workbuddy) { return 404; }

  # 大小限制（api/import 上限放宽到 100mb 留备份空间；其余 8mb）
  client_max_body_size 100m;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chunklab.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS 证书（首次）
sudo certbot --nginx -d lab.example.com
```

---

## 5 · DNS

- A 记录：`lab.example.com → <服务器 IP>`
- 等待 DNS 传播（dig lab.example.com）

---

## 6 · 存量数据迁移（开放模式 → 多用户）

如果你之前在开放模式（8787 直接 `node server/index.js`）跑过且有数据，按下面迁：

```bash
# 1) 关闭旧服务
sudo systemctl stop chunklab

# 2) 用旧启动命令临时拉起开放模式，确认数据可导出
cd /opt/chunklab && sudo -u chunklab \
  CHUNKLAB_DATA_DIR=/var/lib/chunklab/data \
  node server/index.js &
# 等待启动后 Ctrl-Z 挂起（或另开窗口运行第 3 步）

# 3) 迁移：src=开放模式  dst=已切 REQUIRE_AUTH=true 的实例
# 注意：迁移前先按本清单的 2/3/4/5 步完成部署，再开第二个端口临时跑多用户实例
sudo -u chunklab PORT=8788 REQUIRE_AUTH=true JWT_SECRET='临时迁移用密钥至少32字符' \
  CHUNKLAB_DATA_DIR=/var/lib/chunklab/data-8788 \
  node server/index.js &

sudo -u chunklab node server/migrate-open-to-user.js \
  http://127.0.0.1:8787 http://127.0.0.1:8788 <你的用户名> '<你的密码>'

# 输出应看到 [OK] 关键计数全部一致

# 4) 清理临时实例，保留备份 migrate-*.json
sudo kill <PID_8788>
sudo rm -rf /var/lib/chunklab/data-8788

# 5) 启动 systemd 服务（已切 REQUIRE_AUTH）
sudo systemctl start chunklab
```

---

## 7 · 每日备份 cron

```bash
sudo tee /etc/cron.d/chunklab-backup <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 凌晨 3 点对每个用户导出（遍历数据库 + /api/export）
0 3 * * * chunklab /opt/chunklab/scripts/backup-cli.js daily >> /var/log/chunklab/backup.log 2>&1
EOF
sudo mkdir -p /var/log/chunklab && sudo chown chunklab:chunklab /var/log/chunklab
```

> `scripts/backup-cli.js` 已存在（本地 node_modules 验证 9/9 通过）。`/api/export` 需要 token——见 backup-cli 文档用服务账号 token（TOKEN_TTL 内有效；30d 后需手工换 token，否则备份静默失败，QA 报告已提醒）。

---

## 8 · 验收清单（部署后浏览器走一遍）

- [ ] `https://lab.example.com/main.html` 打开 → 弹出登录遮罩
- [ ] 注册第一个用户 → 遮罩关闭 → 顶栏右上角无"待同步"徽标
- [ ] 答 5 题 → 关闭页面 → 另一台设备登录 → 数据已同步
- [ ] 设置 → 账号区块显示当前用户名 → 退出登录 → 回到登录遮罩
- [ ] `https://lab.example.com/server/index.js` → 404（Nginx 黑名单生效）
- [ ] `https://lab.example.com/.git/config` → 404（dotfile 黑名单生效）
- [ ] `curl -H "Origin: https://evil.com" https://lab.example.com/api/config -I` → 无 `Access-Control-Allow-Origin` 头（fail-closed 生效）

---

## 9 · 监控与日志

```bash
# 实时看服务日志
sudo journalctl -u chunklab -f

# 异常告警（可选：fail2ban / 阿里云 SLS）
sudo journalctl -u chunklab --since "1 hour ago" | grep -E "401|429|500" | tail -50
```

---

## 10 · 回滚预案

- **服务挂**：systemd 自动重启（Restart=on-failure）；若数据库坏，`sudo systemctl stop chunklab && cp /var/lib/chunklab/data.bak/*.db /var/lib/chunklab/data/`
- **错改配置**：`git checkout server/.env && sudo systemctl restart chunklab`
- **数据回滚**：从备份 `var/m/chunklab/data.bak/<日期>/<用户>.json` 用 `/api/import` 恢复（需对应用户 token）
- **代码回滚**：`git checkout <稳定 tag/commit> && sudo systemctl restart chunklab`

---

## 11 · 不做的事（公开运营前再做）

- 账号生命周期（改密 / 注销 / 邀请码）
- 注册限流策略公开
- 隐私政策页面 + Cookie 声明
- deck 公共市场审核下架流程

---

## 自检脚本

部署完成后跑一遍：

```bash
sudo -u chunklab bash -c '
  set -e
  echo "== 1) env 健壮性 =="
  test -f /opt/chunklab/server/.env
  test "$(stat -c %a /opt/chunklab/server/.env)" = "600"
  grep -q "JWT_SECRET=.\{32,\}" /opt/chunklab/server/.env
  grep -q "REQUIRE_AUTH=true" /opt/chunklab/server/.env

  echo "== 2) 静态黑名单 =="
  for p in /server /node_modules /.git /e2e /deliverables /.env; do
    code=$(curl -sk -o /dev/null -w "%{http_code}" "https://lab.example.com${p}/README.md" 2>/dev/null || curl -sk -o /dev/null -w "%{http_code}" "https://lab.example.com${p}")
    echo "  $p -> $code (期望 404 或 403)"
  done

  echo "== 3) API 鉴权 =="
  curl -s -o /dev/null -w "  GET /api/data (no token) -> %{http_code} (期望 401)\n" https://lab.example.com/api/data
'
```

期望：env 通过 + 黑名单全部非 200 + API 无 token 401。