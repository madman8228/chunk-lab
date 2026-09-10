#!/usr/bin/env bash
# Chunk Lab · 生产部署（幂等，可重复执行）
# 用法：bash scripts/deploy-prod.sh [目标机]   默认 ubuntu@82.157.125.225
#
# 做四件事：① 重算 SW cache hash ② 传改动文件 ③ 服务端校验内容 ④ 重启并冒烟
# 关键：main.html 等在 SW 预缓存清单里，改动后必须重算 hash，否则客户端拿到旧页面。
set -euo pipefail

HOST="${1:-ubuntu@82.157.125.225}"
APP=/opt/chunklab
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 要部署的文件（前端静态 + 后端服务端）。
# ⚠ 别再手工核对完整性——scripts/check-deploy-files.js 会按「HTML 引用 + ESM import 递归闭包
#   + manifest 图标 + server require 闭包」算出必需项，与本清单比对，缺了就中止部署。
#   本脚本第 [1/5] 步自动跑它；`npm test` 也会跑。（2026-09-10：本清单曾漏掉整个 js/ 目录）
FILES=(
  main.html decks.html stats.html courses.html
  core.js api.js auth-ui.js sw.js manifest.json
  favicon.ico icon-16.png icon-32.png icon-180.png icon-192.png icon-512.png
  builtins.js oral8000.js freq-idioms.js library.js srs.js course-package.js
  js/idb.js js/icons.js js/bridge.mjs js/chunk-engine.mjs js/format.mjs js/ai-prompts.mjs js/backup.mjs js/distractor-cause.mjs
  server/index.js server/validate.js server/auth.js server/ai.js server/db.js server/loadenv.js server/backup-db.js server/compress.js
  package.json
)

echo "[0/5] 校验部署清单覆盖运行时依赖"
node scripts/check-deploy-files.js

echo "[1/5] 重算 SW cache hash"
node scripts/gen-sw.js
CACHE=$(grep -o "chunklab-[0-9a-f]*" sw.js | head -1)
echo "      CACHE=$CACHE"

echo "[2/5] 上传 $((${#FILES[@]})) 个文件 → $HOST:/tmp/chunklab-deploy/"
ssh "$HOST" 'mkdir -p /tmp/chunklab-deploy'
tar czf - "${FILES[@]}" | ssh "$HOST" 'tar xzf - -C /tmp/chunklab-deploy'
echo "      OK"

echo "[3/5] 服务端校验内容特征"
ssh "$HOST" "cd /tmp/chunklab-deploy && \
  test -f main.html && test -f server/index.js && test -f sw.js && \
  test -f js/bridge.mjs && test -f js/chunk-engine.mjs && test -f js/distractor-cause.mjs && \
  grep -q '$CACHE' sw.js && \
  grep -q \"redirect('/main.html')\" server/index.js && \
  echo '      OK: 文件齐（含 js/ 模块）+ sw cache 一致 + 根路由存在'"

echo "[4/5] 落盘 + 重启服务"
ssh "$HOST" "sudo cp -r /tmp/chunklab-deploy/. $APP/ && \
  sudo chown -R chunklab:chunklab $APP/server $APP/js 2>/dev/null; \
  sudo chown chunklab:chunklab $APP/*.html $APP/*.js $APP/*.json $APP/*.ico $APP/*.png 2>/dev/null; \
  sudo systemctl restart chunklab && sleep 2 && systemctl is-active chunklab && rm -rf /tmp/chunklab-deploy"

echo "[5/5] 冒烟 + js/ 落盘一致性"
ssh "$HOST" "curl -s -m 5 http://127.0.0.1:8787/api/health && echo && \
  curl -s -m 5 -o /dev/null -w 'local-/: %{http_code}\n' http://127.0.0.1:8787/ && \
  curl -s -m 5 -o /dev/null -w 'sw.js: %{http_code}\n' http://127.0.0.1:8787/sw.js && \
  curl -s -m 5 -o /dev/null -w 'js/bridge.mjs: %{http_code}\n' http://127.0.0.1:8787/js/bridge.mjs && \
  curl -s -m 5 http://127.0.0.1:8787/sw.js | grep -o 'chunklab-[0-9a-f]*' | head -1"

# js/ 落盘内容比对 —— P0 回归护栏（2026-09-10：FILES 曾漏整个 js/ 目录，
# 部署"看起来成功"但线上仍是旧文件，比缓存问题更隐蔽，必须逐字节确认）。
for f in js/bridge.mjs js/chunk-engine.mjs js/distractor-cause.mjs js/icons.js; do
  L=$(md5sum "$f" | cut -d' ' -f1)
  R=$(ssh "$HOST" "md5sum $APP/$f 2>/dev/null | cut -d' ' -f1")
  if [ "$L" = "$R" ]; then
    echo "      ✓ $f 与本地一致"
  else
    echo "      ✗ $f 不一致（本地 ${L} / 线上 ${R:-缺失}）—— 部署清单或权限有问题"
    exit 1
  fi
done
echo "[done] 生产已更新。跑 bash scripts/deploy-security-smoke.sh https://chunklab.jqka.top 复检"
