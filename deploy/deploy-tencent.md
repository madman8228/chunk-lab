# Chunk Lab · 腾讯云轻量服务器部署手册（多用户 · systemd + Nginx TLS）

> 决策（2026-09-09 老板拍板）：腾讯云轻量 + 多用户账号（REQUIRE_AUTH=true）+ systemd/node + Nginx 反代 TLS。
> 目标读者：本仓库 owner。全部命令在服务器上以 root 或 sudo 执行。
> 配套文件：`deploy/chunklab.service` / `deploy/nginx-chunklab.conf` / `deploy/setup-env.sh` / `server/backup-db.js`。

---

## 0. 全景

```
浏览器 ──HTTPS──> Nginx(443, TLS终结, 全量反代) ──http──> node index.js(:8787, 同源托管前端静态 + /api)
                                                          └── SQLite: server/data/chunklab.db
                                                          └── 备份:   server/backups/*.db (每日 cron)
```

- 前端静态 + API 同源由 Express 托管，**无跨域**，`CORS_ORIGINS` 留空即 fail-closed。
- 多用户：注册/登录签发 JWT，数据按 user_id 隔离；未登录前端自动弹登录框。
- `NODE_ENV=production` 时若 `REQUIRE_AUTH` 非 true，服务**拒绝启动**（P0 断言，防裸奔）。

---

## 1. 前置准备

| 项 | 操作 |
|----|------|
| 域名 | 已解析 A 记录 → 轻量服务器公网 IP（DNS 生效可用 `ping <域名>` 确认） |
| 安全组 | 腾讯云控制台放行 **80 / 443**（**不要**放行 8787——只走本机回环） |
| 系统 | Ubuntu 22.04/24.04（或 Debian 12） |
| Node | `sudo apt install -y nodejs npm` 后装 LTS：见下方 nvm 或 nodesource ≥ v18（建议 v20+） |
| Nginx | `sudo apt install -y nginx` |
| Certbot | `sudo apt install -y certbot python3-certbot-nginx` |

Node ≥18 建议装 NodeSource LTS：
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
```

---

## 2. 上传代码 + 装依赖

```bash
sudo useradd -r -s /usr/sbin/nologin -d /opt/chunklab chunklab 2>/dev/null || true
sudo mkdir -p /opt/chunklab && sudo chown chunklab:chunklab /opt/chunklab
# 从 git 拉或 rsync 上传（含 server/、前端 html/js、deploy/；node_modules 不要传）
sudo -u chunklab git clone <你的仓库> /opt/chunklab   # 或 rsync -av --exclude node_modules --exclude server/data . chunklab@<host>:/opt/chunklab/
```

装后端依赖（better-sqlite3 有 Linux x64 预编译，正常免编译）：
```bash
cd /opt/chunklab/server
sudo -u chunklab npm install --omit=dev
# 若 better-sqlite3 预编译下载失败才需要：sudo apt install -y build-essential python3
```

验证能启动（前台试跑 10 秒）：
```bash
cd /opt/chunklab
sudo -u chunklab env NODE_ENV=production REQUIRE_AUTH=true JWT_SECRET=$(openssl rand -hex 32) node server/index.js
# 看到 listening + 无 FATAL 即 Ctrl+C
```

---

## 3. 环境文件 + systemd 服务

```bash
sudo bash /opt/chunklab/deploy/setup-env.sh        # 生成 /etc/chunklab/env（强随机密钥）
sudo cp /opt/chunklab/deploy/chunklab.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chunklab
systemctl status chunklab                           # active (running)
journalctl -u chunklab -n 30 --no-pager             # 看启动日志（应见 listening 提示）
```

> 若 DB 目录想放云盘/持久卷：编辑 `/etc/chunklab/env` 加 `CHUNKLAB_DATA_DIR=/data/chunklab`，
> 并在 service 的 `ReadWritePaths` 追加该目录后 restart。

---

## 4. Nginx + HTTPS

```bash
sudo sed "s/<你的域名>/你的域名/g" /opt/chunklab/deploy/nginx-chunklab.conf \
  | sudo tee /etc/nginx/sites-available/chunklab
sudo ln -sf /etc/nginx/sites-available/chunklab /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# 签发证书（自动改写 443 块的 ssl 指令）
sudo certbot --nginx -d <你的域名>
sudo systemctl reload nginx
```

浏览器打开 `https://<你的域名>/main.html`：
1. 出现**注册/登录框**（说明 REQUIRE_AUTH=true 生效）
2. 注册第一个账号 → 建/导入一套题库 → 练一句 → 刷新数据还在
3. 关掉 `#btnAIExplain` 相关不显示属正常（AI 生成默认停用）

---

## 5. 备份（每日 03:00 全库快照）

多用户完整备份 = SQLite 文件级快照（`/api/export` 只导单用户，不适用）：

```bash
sudo crontab -e    # 追加：
0 3 * * *  cd /opt/chunklab && /usr/bin/node server/backup-db.js backup >> /var/log/chunklab-backup.log 2>&1
```

- 产物：`/opt/chunklab/server/backups/chunklab_db_YYYYMMDD_HHMMSS.db`，保留最近 14 份自动清理
- `sudo -u chunklab node server/backup-db.js list` 手动查看
- **恢复演练（建议每月一次）**：
  ```bash
  sudo systemctl stop chunklab
  sudo cp /opt/chunklab/server/backups/chunklab_db_最新.db /opt/chunklab/server/data/chunklab.db
  sudo chown chunklab:chunklab /opt/chunklab/server/data/chunklab.db
  sudo systemctl start chunklab
  ```
- 备份文件建议再同步一份到对象存储/另一台机器（如 `rclone` / `ossutil`），防磁盘故障。

---

## 6. 开放模式存量迁移（仅当之前跑过开放模式且有学习数据）

全新部署**跳过本节**。若 v1 开放模式在别处积累过数据（落在默认用户 `__default__`），
切多用户后无法登录 `__default__`，需迁移到真实账号：
```bash
# 在还跑着开放模式的旧实例上：node server/migrate-open-to-user.js <旧实例Base> <新实例Base> boss '密码'
# 详细语义见 server/migrate-open-to-user.js 头注释（幂等保护 + 落盘回滚 + 抽样校验）
```

---

## 7. 上线复核清单（逐项打勾）

- [ ] 安全组只放行 80/443；公网无法直连 8787（`curl http://<IP>:8787` 应超时）
- [ ] `NODE_ENV=production` + `REQUIRE_AUTH=true`；服务日志无 security FATAL
- [ ] `JWT_SECRET` ≥32 位强随机（`grep JWT_SECRET /etc/chunklab/env`，与仓库默认值不同）
- [ ] HTTPS 生效（`https://<域名>` 绿锁；`http://` 301 跳转）
- [ ] 注册新号 → 数据隔离验证（A 账号建的题库 B 账号看不到）
- [ ] 设置页「导出/导入备份」走一遍（应用级单用户备份 + 恢复）
- [ ] 每日备份 cron 已挂；`list` 能看到备份文件
- [ ] `CORS_ORIGINS` 留空（同源反代）或已填真实域名；`TRUST_PROXY=true`
- [ ] `AI_EXPLAIN_ENABLED=false`（联网 AI 默认停用；启用需配 `DEEPSEEK_API_KEY`）

---

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| 启动即 `[security] FATAL ... 开放模式` | env 里 REQUIRE_AUTH 非 true / NODE_ENV 未设 production |
| `JWT_SECRET too short` 拒绝启动 | 重新生成 ≥32 字符密钥后 restart |
| 前端一直弹登录框 | 确认 REQUIRE_AUTH=true；注册后 Token 存 localStorage |
| better-sqlite3 编译失败 | 装 build-essential + python3 后重跑 npm install |
| 登录后数据空白（旧开放数据） | 走第 6 节 migrate 脚本认领 `__default__` 存量 |
| certbot 失败「域名未解析」 | 先 ping 域名确认 A 记录生效再签发 |
| 修改代码后不生效 | `sudo systemctl restart chunklab`（静态由 node 托管，无缓存目录） |

> 前端 Service Worker 会缓存静态资源：**发版后让用户硬刷新两次（Ctrl+Shift+R）**，cache 名随内容 hash 变化自动切换（gen-sw.js 已把 sw.js 自身纳入 hash 源）。
