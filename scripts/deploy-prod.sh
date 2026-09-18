#!/usr/bin/env bash
# Chunk Lab · 生产部署（幂等，可重复执行）
# 用法：bash scripts/deploy-prod.sh <目标机>
#
# 做九件事：① 本地全套回归 ② 远端生产配置预检 ③ 校验部署清单 ④ 迁移前全库快照
#            ⑤ 重算 SW cache hash ⑥ 传改动文件 ⑦ 服务端校验内容 ⑧ 重启 ⑨ 冒烟
# 关键 1：main.html 等在 SW 预缓存清单里，改动后必须重算 hash，否则客户端拿到旧页面。
# 关键 2：服务端启动迁移是**有损**的（把 kv blob 搬进行表并删掉原行），回滚不能只回代码，
#        所以 [3/9] 强制先打一次全库快照，拿不到快照就中止部署。详见该步注释。
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "用法：bash scripts/deploy-prod.sh <目标机>"
  echo "为避免误部署，必须显式传入目标机，例如 ubuntu@your-server"
  exit 2
fi
HOST="$1"
APP=/opt/chunklab
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 要部署的文件（前端静态 + 后端服务端）。
# ⚠ 别再手工核对完整性——scripts/check-deploy-files.js 会按「HTML 引用 + ESM import 递归闭包
#   + manifest 图标 + server require 闭包」算出必需项，与本清单比对，缺了就中止部署。
#   本脚本第 [2/9] 步自动跑它；`npm test` 也会跑。（2026-09-10：本清单曾漏掉整个 js/ 目录）
FILES=(
  main.html decks.html stats.html courses.html
  core.js api.js auth-ui.js sw.js manifest.json content
  js/account-storage.js
  js/legacy-backup.js
  js/legacy-restore.js
  favicon.ico icon-16.png icon-32.png icon-180.png icon-192.png icon-512.png
  builtins.js oral8000.js freq-idioms.js library.js srs.js course-package.js server/backup-cli.js
  js/idb.js js/batch-sync.js js/icons.js js/chunk-shape.js js/course-catalog.js js/course-progress.js js/content-repository.js js/sync-resolution.js js/sync-resolution-ui.js js/bridge.mjs js/chunk-engine.mjs js/format.mjs js/ai-prompts.mjs js/backup.mjs js/distractor-cause.mjs
  server/index.js server/validate.js server/auth.js server/ai.js server/db.js server/loadenv.js server/backup-db.js server/compress.js server/api-compress.js server/feedback.js server/sync-conflict.js server/sync-resolution.js
  package.json
)

echo "[0/9] 本地候选全套回归"
npm test
npm run test:accounts
npm run test:batch-sync
node e2e/mobile-8000.test.js

echo "[1/9] 远端生产配置预检"
# 不能让缺失 env 文件时的 backup-db 静默回落到开发默认值；
# 生产安全配置不满足时，在快照和上传前 fail-closed。
ssh "$HOST" "sudo test -r /etc/chunklab/env && \
  sudo grep -Eq '^NODE_ENV=production([[:space:]]|$)' /etc/chunklab/env && \
  sudo grep -Eq '^REQUIRE_AUTH=true([[:space:]]|$)' /etc/chunklab/env && \
  sudo awk -F= '/^JWT_SECRET=/{if(length(\$2)>=32) ok=1} END{exit !ok}' /etc/chunklab/env && \
  echo '      OK: production + auth + strong JWT_SECRET'"

echo "[2/9] 校验部署清单覆盖运行时依赖"
node scripts/check-deploy-files.js

echo "[3/9] 迁移前全库快照"
# 为什么必须有这一步：服务端启动迁移把 mastered / reinforceBook / deletedItems 从 user_kv
# 的 blob 搬进 user_entity_rows 并**删掉原 blob 行**（否则老客户端会把整块写回来）。
# 代价是回滚不再可能只回代码 —— 旧代码只认 kv blob，回滚后这三个对象会整个消失。
# 备份 cron 在每天 3:20，晚间部署最长有 17h 空窗，不能依赖它。
# VACUUM INTO 是 SQLite 在线一致性快照，服务运行中执行安全，不锁主库。
# 环境变量从服务端 env 文件读，保证 CHUNKLAB_DATA_DIR 与服务进程一致（默认 server/data）。
#
# 两个坑：
#   ① 不能只看最后一行 —— backup-db.js 超出保留份数时会再打印「清理旧备份」，
#      备份满 14 份后那才是最后一行，用 tail -1 会稳定误判成功为失败。
#      所以按成功标记定位。
#   ② ssh 失败不能让 set -e 直接吞掉（否则只剩一句无声退出），先兜住再自己报错。
SNAP_OUT=$(ssh "$HOST" "sudo bash -c 'set -a; . /etc/chunklab/env 2>/dev/null || true; set +a; cd $APP && node server/backup-db.js backup'" 2>&1 || true)
SNAP=$(printf '%s\n' "$SNAP_OUT" | grep 'backup-db\] OK:' | tail -1 || true)
if [ -z "$SNAP" ]; then
  echo "      ✗ 快照失败，中止部署（本次迁移无快照不可回滚）"
  echo "        ssh 原始输出："
  printf '%s\n' "$SNAP_OUT" | sed 's/^/          /'
  echo "        排查：ssh $HOST \"sudo bash -c 'cd $APP && node server/backup-db.js list'\""
  exit 1
fi
echo "      $SNAP"

echo "[4/9] 重算 SW cache hash"
node scripts/gen-sw.js
CACHE=$(grep -o "chunklab-[0-9a-f]*" sw.js | head -1)
echo "      CACHE=$CACHE"

echo "[5/9] 上传 $((${#FILES[@]})) 个文件 → $HOST:/tmp/chunklab-deploy/"
ssh "$HOST" 'mkdir -p /tmp/chunklab-deploy'
tar czf - "${FILES[@]}" | ssh "$HOST" 'tar xzf - -C /tmp/chunklab-deploy'
echo "      OK"

echo "[6/9] 服务端校验内容特征"
ssh "$HOST" "cd /tmp/chunklab-deploy && \
  test -f main.html && test -f server/index.js && test -f sw.js && \
  test -f js/bridge.mjs && test -f js/chunk-engine.mjs && test -f js/distractor-cause.mjs && \
  grep -q '$CACHE' sw.js && \
  grep -q \"redirect('/main.html')\" server/index.js && \
  echo '      OK: 文件齐（含 js/ 模块）+ sw cache 一致 + 根路由存在'"

echo "[7/9] 落盘 + 重启服务"
ssh "$HOST" "sudo cp -r /tmp/chunklab-deploy/. $APP/ && \
  sudo chown -R chunklab:chunklab $APP/server $APP/js 2>/dev/null; \
  sudo chown chunklab:chunklab $APP/*.html $APP/*.js $APP/*.json $APP/*.ico $APP/*.png 2>/dev/null; \
  sudo systemctl restart chunklab && sleep 2 && systemctl is-active chunklab && rm -rf /tmp/chunklab-deploy"

echo "[8/9] 冒烟 + 迁移确认 + js/ 落盘一致性"
ssh "$HOST" "curl -s -m 5 http://127.0.0.1:8787/api/health && echo && \
  curl -s -m 5 -o /dev/null -w 'local-/: %{http_code}\n' http://127.0.0.1:8787/ && \
  curl -s -m 5 -o /dev/null -w 'sw.js: %{http_code}\n' http://127.0.0.1:8787/sw.js && \
  curl -s -m 5 -o /dev/null -w 'js/bridge.mjs: %{http_code}\n' http://127.0.0.1:8787/js/bridge.mjs && \
  curl -s -m 5 http://127.0.0.1:8787/sw.js | grep -o 'chunklab-[0-9a-f]*' | head -1"

# 启动迁移是静默的（只在真有东西可搬时才打日志），所以这里不是「必须看到」而是「看到了要核对」。
# 首次上线会打印「行级实体迁移完成：N 条 kv → ...」；核对 N 与用户数/标熟量级是否合理。
ssh "$HOST" "sudo journalctl -u chunklab --since '-3 min' --no-pager | grep '迁移完成' || echo '      （本窗口无迁移日志 = 已迁移过或无需迁移）'"

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
# 回滚提示：本次部署前快照已打好，行级实体迁移不可只回代码。
echo "[rollback] 若需回滚：git revert 代码 + 用本次快照替换主库"
echo "           $SNAP"
