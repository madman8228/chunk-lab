#!/usr/bin/env bash
# Chunk Lab 生产环境文件生成器（在服务器上执行一次）
# 生成：/etc/chunklab/env（强随机 JWT_SECRET + REQUIRE_AUTH=true 等）
# 用法：sudo bash deploy/setup-env.sh   （提示输入域名；不输入=不写 CORS，同源反代用不到）
set -euo pipefail

ENV_FILE=/etc/chunklab/env
if [ -f "$ENV_FILE" ]; then
  echo "⚠️  $ENV_FILE 已存在，跳过（如需重置请先手动删除）"
  exit 0
fi

sudo mkdir -p /etc/chunklab
read -rp "前端域名（Nginx 反代同源场景直接回车跳过）: " DOMAIN
CORS=""
if [ -n "$DOMAIN" ]; then CORS="https://$DOMAIN"; fi

SECRET=$(openssl rand -hex 32)

sudo tee "$ENV_FILE" > /dev/null <<EOF
# Chunk Lab 生产环境（由 setup-env.sh 生成，勿提交仓库）
NODE_ENV=production
REQUIRE_AUTH=true
JWT_SECRET=$SECRET
TOKEN_TTL=30d
CORS_ORIGINS=$CORS
TRUST_PROXY=true
PORT=8787
# 数据库与备份默认落在 /opt/chunklab/server/{data,backups}，如挂云盘可改：
# CHUNKLAB_DATA_DIR=/data/chunklab
# BACKUP_DIR（供备份 cron 使用）默认 server/backups
AI_EXPLAIN_ENABLED=false
# DEEPSEEK_API_KEY=sk-xxx   # 如启用 AI 详解再填
EOF

sudo chmod 600 "$ENV_FILE"
echo "✅ 已生成 $ENV_FILE（JWT_SECRET 强随机 64 hex）"
echo "   下一步：sudo systemctl daemon-reload && sudo systemctl restart chunklab"
