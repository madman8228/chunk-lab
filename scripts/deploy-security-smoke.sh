#!/usr/bin/env bash
# Chunk Lab · 部署安全自检（30 秒定性）
#
# 用法：
#   bash scripts/deploy-security-smoke.sh                                  # 默认 https://chunk-lab.jaas.app
#   bash scripts/deploy-security-smoke.sh https://your-domain.example
#
# 判读：
#   全 ✓           → 代码侧无洞，问题只在平台选型
#   任何 ✗（200）  → 立刻处理，存在真实信息泄露
#   ! 连接失败     → 网络/DNS 不可达，本机换网络重试（不要当成"安全"）
#
# 对应防护：server/index.js:500-510 静态白名单中间件 + :519-522 生产断言

set -u

BASE="${1:-https://chunk-lab.jaas.app}"
BASE="${BASE%/}"

PASS=0; FAIL=0; WARN=0

c_ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
c_bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
c_warn() { printf "  \033[33m!\033[0m %s\n" "$1"; WARN=$((WARN+1)); }

code_of() {
  local out
  out=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$1" 2>/dev/null)
  if [ -z "$out" ] || [ "$out" = "000" ]; then echo "000"; else echo "$out"; fi
}

echo ""
echo "=============================================="
echo " Chunk Lab 部署安全自检"
echo " 目标: $BASE"
echo " 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# ---------- 1. 敏感路径必须被拒 ----------
echo ""
echo "[1/4] 敏感路径必须被拒（403 / 404 / 401）"
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
/validate_oral8000.js
/validate_distractors.js
/validate_freq_idioms.js
/diagnose.html
/README.md
/architecture-plan.md
/store.test.js
/rev.test.js
"
for p in $DENY_PATHS; do
  c=$(code_of "$BASE$p")
  case "$c" in
    403|404|401|400) c_ok   "$(printf '%-48s %s' "$p" "$c")" ;;
    000)         c_warn "$(printf '%-48s 连接失败（网络/DNS 不可达）' "$p")" ;;
    *)           c_bad  "$(printf '%-48s %s  ← 应被拒，实际可访问！' "$p" "$c")" ;;
  esac
done

# ---------- 2. 前端必需资源必须可达 ----------
echo ""
echo "[2/4] 前端必需资源必须可达（200）"
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

# ---------- 4. 响应头指纹 ----------
echo ""
echo "[3/4] 响应头指纹"
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
echo "[4/4] TLS 证书"
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
printf " 通过 %d · 失败 %d · 待人工判断 %d\n" "$PASS" "$FAIL" "$WARN"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "结论：存在真实泄露，立刻处理（勿上线）。"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo ""
  echo "结论：无致命泄露；WARN 项按需加固（package.json 拦截 / HSTS）。"
  exit 0
else
  echo ""
  echo "结论：代码侧无洞，剩余风险只在托管平台本身。"
  exit 0
fi
