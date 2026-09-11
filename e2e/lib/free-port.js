/**
 * free-port.js · e2e 脚本选端口（2026-09-11）
 *
 * 背景（根因，实测确认）：
 *   各 e2e 脚本用 `base + Math.floor(Math.random() * span)` 盲选端口，而宿主机上
 *   有些端口是**常驻占用**的 —— 实测 `127.0.0.1:8933` 被 WorkBuddy.exe 自己占着
 *   （`/api/health` 返 401，永远 != 200），另有若干僵尸监听（netstat 显示 LISTENING
 *   但 tasklist 查不到进程）落在 8900~9200 区间。
 *   一旦随机到这些端口：spawn 的 server 起不来 / health 永不返回 200 →
 *   40 次重试全 miss → 假报 `server start timeout`（代码没坏，却红了一片）。
 *   实测同一套件单独重跑就 PASS，属**环境假失败**。
 *
 * 做法：选端口前同步读一次 `netstat`，取出已占端口集合；
 *   从 [base, base+span) 里「随机起点 + 顺序扫描」挑第一个空闲端口
 *   （随机起点是为了与 scripts/e2e-all.js 预起的固定端口错开，顺序扫描保证可复现）。
 *
 * 降级：netstat 不可用（部分 macOS/Linux 无 net-tools）或解析结果为空 →
 *   退回改造前的随机选法，行为与改造前一致。这是**环境探测失败**的降级，
 *   不是掩盖问题：探测成功就一定不会撞已占端口。
 *
 * 用法（单行替换，零结构改动）：
 *   const PORT = require('../../e2e/lib/free-port').freePort(8902, 100);
 */
'use strict';
const { execSync } = require('child_process');

let _used = null;

function usedPorts() {
  if (_used) return _used;
  const set = new Set();
  let raw = '';
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 };
  try { raw = execSync('netstat -ano', opts); }
  catch (e) {
    try { raw = execSync('netstat -an', opts); }
    catch (e2) { raw = ''; }
  }
  String(raw).split(/\r?\n/).forEach(function (line) {
    /* 只收 LISTENING（tcp）与 UDP 行；ESTABLISHED/TIME_WAIT 的对端端口不阻塞 bind，不必避开。
       多收几个空闲端口无副作用——只是少几个候选。 */
    if (!/LISTEN|UDP/i.test(line)) return;
    const m = line.match(/:(\d{2,5})\b/g);
    if (!m) return;
    m.forEach(function (s) { set.add(parseInt(s.slice(1), 10)); });
  });
  _used = set;
  return set;
}

/**
 * @param {number} base 起始端口
 * @param {number} span 区间长度（默认 100）
 * @returns {number} 区间内一个当前未被监听的端口
 */
function freePort(base, span) {
  span = span || 100;
  const start = Math.floor(Math.random() * span);
  const used = usedPorts();
  if (!used.size) return base + start; /* netstat 拿不到 → 保持改造前行为 */
  for (let i = 0; i < span; i++) {
    const p = base + ((start + i) % span);
    if (!used.has(p)) return p;
  }
  return base + start; /* 整段占满（实际不可能） */
}

module.exports = { freePort, usedPorts };
