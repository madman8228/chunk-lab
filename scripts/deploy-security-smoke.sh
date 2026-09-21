#!/usr/bin/env bash
# Chunk Lab · 部署安全自检（30 秒定性）
#
# 用法：
#   bash scripts/deploy-security-smoke.sh                                  # 默认 https://chunklab.jqka.top
#   bash scripts/deploy-security-smoke.sh https://your-domain.example
#
# 判读：
#   全 ✓           → **本脚本覆盖的**路径与变体均被拒。这只是必要条件，不是充分证明。
#   任何 ✗（200）  → 立刻处理，存在真实信息泄露
#   ! 连接失败     → 网络/DNS 不可达，本机换网络重试（不要当成"安全"）
#
# ⚠️ 能力边界（2026-09-21 P0 之后写死，别再把它当成「代码侧无洞」的证明）：
#    本脚本是**黑名单抽样**，只能证明「已列的路径与已生成的变体没漏」。
#    2026-09-21 实测：朴素路径 34 条全 403，而 `//server/index.js`、`/%73erver/index.js`
#    在线上返回 200 —— 可下载后端源码与 SQLite 整库（含 WAL）。旧版本只测朴素写法，
#    因此**结构上不可能发现该洞**，却报告「48 通过 / 0 失败」，被当成已验证。
#    所以：① 敏感路径一律连**变体族**一起测；② curl 必须 `--path-as-is`
#    （否则 curl 自己会规范化 `//`，测不到真实行为）；③ 换域名/换反代后必须重跑。
#
# 对应防护：server/middleware/static-guard.js（先规范化再判定；**是黑名单**）
#           + server/auth.js assertSecure()（REQUIRE_AUTH=true 时强制 JWT_SECRET 非占位且 ≥32 字符）
#
# 回归测试：server/static-guard.test.js（变体族 + 负向自证，离线可跑）

set -u

BASE="${1:-https://chunklab.jqka.top}"
BASE="${BASE%/}"

PASS=0; FAIL=0; WARN=0

c_ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
c_bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
c_warn() { printf "  \033[33m!\033[0m %s\n" "$1"; WARN=$((WARN+1)); }

code_of() {
  local out
  # --path-as-is 是必需的：不加的话 curl 会把 `//` 规范化掉，变体族就永远测不出真实行为。
  out=$(curl -s --path-as-is -o /dev/null -w '%{http_code}' --max-time 12 "$1" 2>/dev/null)
  if [ -z "$out" ] || [ "$out" = "000" ]; then echo "000"; else echo "$out"; fi
}

# 敏感路径的**变体族**：每一种都是历史上真实可用（或理论上可构造）的绕过写法。
# 原理：守卫若把正则打在未解码的 req.path 上，而 express.static 会解码，则全部可绕过。
enc_first() { printf '%%%02X' "'${1:0:1}"; }
variants_of() {
  local p="$1" rest first
  rest="${p#/}"
  first="${rest%%/*}"
  printf '%s\n' "/$p"                                # 双斜杠
  printf '%s\n' "/$(enc_first "$first")${p:2}"       # 首段首字符百分号编码
  printf '%s\n' "/%2F$rest"                          # 前导斜杠编码
  printf '%s\n' "/..%2F$rest"                        # 编码穿越
  case "$p" in *.*) printf '%s\n' "$(printf '%s' "$p" | sed 's/\./%2E/g')" ;; esac   # 点编码
}

echo ""
echo "=============================================="
echo " Chunk Lab 部署安全自检"
echo " 目标: $BASE"
echo " 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# ---------- 1. 敏感路径必须被拒 ----------
echo ""
echo "[1/5] 敏感路径必须被拒（朴素写法 + 变体族）"
DENY_PATHS="
/server/index.js
/server/auth.js
/server/ai.js
/server/validate.js
/server/data/chunklab.db
/server/data/chunklab.db-wal
/server/.env
/.env
/.env.local
/.git/config
/.git/HEAD
/.workbuddy/MEMORY.md
/output/e2e/e2e.js
/scripts/check-sw.js
/scripts/deploy-security-smoke.sh
/e2e/e2e.js
/deploy/nginx-chunklab.conf
/deploy/deploy-tencent.md
/deploy/chunklab.service
/ref/anything.html
/node_modules/express/package.json
/package.json
/package-lock.json
/make-icons.py
/validate_builtins.js
/validate_oral_book.js
/validate_distractors.js
/validate_freq_idioms.js
/diagnose.html
/README.md
/architecture-plan.md
/store.test.js
/rev.test.js
"
VARIANT_OK=0
for p in $DENY_PATHS; do
  c=$(code_of "$BASE$p")
  case "$c" in
    403|404|401|400) c_ok   "$(printf '%-48s %s' "$p" "$c")" ;;
    000)         c_warn "$(printf '%-48s 连接失败（网络/DNS 不可达）' "$p")" ;;
    *)           c_bad  "$(printf '%-48s %s  ← 应被拒，实际可访问！' "$p" "$c")" ;;
  esac
  # —— 变体族：任一可访问即 FAIL。2026-09-21 P0 的回归点，不要删。——
  #    该洞的特征是「朴素 403、变体 200」，只测朴素写法必然报假绿。
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    cv=$(code_of "$BASE$v")
    case "$cv" in
      403|404|401|400) VARIANT_OK=$((VARIANT_OK+1)) ;;
      000)             c_warn "$(printf '%-52s 连接失败（变体）' "$v")" ;;
      *)               c_bad  "$(printf '%-52s %s  ← 变体绕过！应被拒（检查 static-guard 的规范化）' "$v" "$cv")" ;;
    esac
  done <<VARIANTS
$(variants_of "$p")
VARIANTS
done
echo "      （变体族被拒 $VARIANT_OK 条 —— 只统计通过项，避免刷屏）"

# ---------- 2. 前端必需资源必须可达 ----------
echo ""
echo "[2/5] 前端必需资源必须可达（200）"
for p in /main.html /decks.html /stats.html /courses.html /manifest.json /sw.js /favicon.ico /icon-32.png /api/health; do
  c=$(code_of "$BASE$p")
  if [ "$c" = "200" ]; then
    c_ok "$(printf '%-48s %s' "$p" "$c")"
  elif [ "$c" = "000" ]; then
    c_warn "$(printf '%-48s 连接失败' "$p")"
  else
    c_bad "$(printf '%-48s %s  ← 前端资源不可达' "$p" "$c")"
  fi
done

# ---------- 3. 未认证 API 必须拒绝 ----------
echo ""
echo "[3/5] 未认证 API 必须拒绝"
c=$(code_of "$BASE/api/data")
case "$c" in
  401|403) c_ok "$(printf '%-48s %s' '/api/data（无 Authorization）' "$c")" ;;
  000)     c_warn "$(printf '%-48s 连接失败' '/api/data（无 Authorization）')" ;;
  *)       c_bad "$(printf '%-48s %s  ← 未登录仍可读取数据！' '/api/data（无 Authorization）' "$c")" ;;
esac

CONFIG_CODE=$(code_of "$BASE/api/config")
if [ "$CONFIG_CODE" = "200" ]; then
  CONFIG_BODY=$(curl -s --max-time 12 "$BASE/api/config" 2>/dev/null || true)
  if printf '%s' "$CONFIG_BODY" | grep -Eq '"requireAuth"[[:space:]]*:[[:space:]]*true'; then
    c_ok '/api/config 明确报告 requireAuth=true'
  else
    c_bad '/api/config 未报告 requireAuth=true  ← 可能仍是开放模式！'
  fi
elif [ "$CONFIG_CODE" = "000" ]; then
  c_warn '/api/config 连接失败'
else
  c_bad "/api/config 返回 $CONFIG_CODE  ← 无法确认生产鉴权配置"
fi

# ---------- 4. 响应头指纹 ----------
echo ""
echo "[4/5] 响应头指纹"
HDR=$(curl -sI --max-time 12 "$BASE/api/health" 2>/dev/null || true)
if [ -z "$HDR" ]; then
  c_warn "拿不到响应头（连接失败）"
else
  if printf '%s' "$HDR" | grep -qi '^x-powered-by:'; then
    c_bad "存在 X-Powered-By 头（暴露后端技术栈）→ 应 app.disable('x-powered-by')"
  else
    c_ok "无 X-Powered-By（技术栈指纹已隐藏）"
  fi
  SRV=$(printf '%s' "$HDR" | grep -i '^server:' || true)
  if [ -n "$SRV" ]; then
    c_warn "Server 头: $(printf '%s' "$SRV" | tr -d '\r')"
  else
    c_ok "无 Server 头"
  fi
  if printf '%s' "$HDR" | grep -qi 'strict-transport-security'; then
    c_ok "有 HSTS 头"
  else
    c_warn "无 HSTS 头（可考虑加 Strict-Transport-Security）"
  fi
fi

# ---------- 5. TLS ----------
echo ""
echo "[5/5] TLS 证书"
case "$BASE" in
  https://*)
    HOST=$(printf '%s' "$BASE" | sed -E 's#^https://##; s#/.*$##')
    if curl -sI --max-time 12 "$BASE" >/dev/null 2>&1; then
      c_ok "HTTPS 握手成功（$HOST）"
      EXP=$(echo | timeout 12 openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null \
            | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)
      if [ -n "$EXP" ]; then
        c_ok "证书到期: $EXP"
      else
        c_warn "拿不到证书到期时间（openssl 不可用？）"
      fi
    else
      c_bad "HTTPS 握手失败"
    fi
    ;;
  *)
    c_bad "非 HTTPS 部署（$BASE）→ 明文传输，必须上 TLS"
    ;;
esac

# ---------- 汇总 ----------
echo ""
echo "=============================================="
printf " 通过 %d · 失败 %d · 待人工判断 %d · 变体族被拒 %d\n" "$PASS" "$FAIL" "$WARN" "$VARIANT_OK"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "结论：存在真实泄露，立刻处理（勿上线）。"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo ""
  echo "结论：本轮覆盖项未见泄露；WARN 项按需加固（package.json 拦截 / HSTS）。"
  exit 0
else
  echo ""
  echo "结论：本轮覆盖的路径与变体均被拒。"
  echo "⚠️ 这是必要条件，不是「代码侧无洞」的证明 —— 黑名单抽样只能证明「已列的没漏」。"
  echo "   新增敏感目录、更换反向代理或域名后必须重跑本脚本。"
  exit 0
fi
