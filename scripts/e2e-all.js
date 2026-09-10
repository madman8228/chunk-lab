#!/usr/bin/env node
/**
 * e2e-all.js · 一键跑全部 e2e 验证脚本（2026-09-10）
 *
 * 解决的问题（根因）：output/e2e/ 下 20+ 个专项验证脚本此前只能手动一个个跑，
 * 且端口约定不统一——三种模式混在一起：
 *   ① 自带服务器：脚本内 spawn(index.js) + 随机 PORT（如 9400+rand），完全自包含；
 *   ② 硬编码外部端口：goto('http://localhost:8896/...')，需要有人先把服务器起起来；
 *   ③ E2E_BASE 环境变量：`process.env.E2E_BASE || 'http://127.0.0.1:8890'`。
 * 手动跑时漏跑、跑错端口、"改了像没测"都发生过。
 *
 * 做法：
 *   1. 扫描 output/e2e/*.js，跳过一次性脚本（debug-*.js / shot-*.js，它们是调试与截图工具，无断言）；
 *   2. 自动识别每个脚本的端口需求：含 `spawn(` → 自带服务器（port=null）；
 *      否则从 `127.0.0.1:NNNN` / `localhost:NNNN` 提取外部端口；
 *   3. 为所有需要的外部端口各起一个临时服务器（独立 CHUNKLAB_DATA_DIR，跑完即停）；
 *   4. 依次 spawn 每个脚本（串行，避免并发抢端口），收集退出码与耗时，最后汇总。
 *
 * 用法：
 *   npm run e2e:all
 *   CHROMIUM_PATH=/path/to/chrome npm run e2e:all     # 无系统 chrome 时必须指定
 *
 * 退出码：全部通过 → 0；任一失败 → 1。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
/* 两个目录都扫：e2e/ 是主套件（e2e.js 69 项基线、sync.test.js），
   output/e2e/ 是各专项验证脚本 */
const E2E_DIRS = [path.join(ROOT, 'e2e'), path.join(ROOT, 'output', 'e2e')];
const SERVER_DIR = path.join(ROOT, 'server');
const SKIP = /^(debug-|shot-|visual-round)/;  /* 一次性调试 / 截图工具，无断言，不纳入套件 */
const PER_SUITE_TIMEOUT = 180000;        /* 单脚本上限 3 分钟 */

/* ---------- 端口探测 ---------- */
function detectPort(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (/spawn\(/.test(src)) return null;  /* 自带服务器，外部无需准备 */
  const m = src.match(/127\.0\.0\.1:(\d{4})/) || src.match(/localhost:(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/* ---------- 等服务器就绪 ---------- */
function waitHealth(port, maxTries) {
  return new Promise(function (resolve) {
    let n = 0;
    (function probe() {
      const req = http.get({ host: '127.0.0.1', port: port, path: '/api/health', timeout: 800 }, function (r) {
        r.resume();
        if (r.statusCode === 200) return resolve(true);
        if (++n >= maxTries) return resolve(false);
        setTimeout(probe, 250);
      });
      req.on('error', function () {
        if (++n >= maxTries) return resolve(false);
        setTimeout(probe, 250);
      });
      req.on('timeout', function () { req.destroy(); });
    })();
  });
}

function startServer(port) {
  const dataDir = path.join(os.tmpdir(), 'chunklab_e2eall_' + port + '_' + Date.now());
  const proc = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: Object.assign({}, process.env, { PORT: String(port), CHUNKLAB_DATA_DIR: dataDir }),
    stdio: 'ignore',
  });
  return { proc: proc, port: port, dataDir: dataDir };
}

/* ---------- 跑单个脚本 ---------- */
function runSuite(suite) {
  return new Promise(function (resolve) {
    const t0 = Date.now();
    const child = spawn(process.execPath, [suite.file], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', function (d) { out += d; });
    child.stderr.on('data', function (d) { out += d; });
    const timer = setTimeout(function () {
      try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
    }, PER_SUITE_TIMEOUT);
    child.on('close', function (code) {
      clearTimeout(timer);
      resolve({ name: suite.name, code: code, ms: Date.now() - t0, out: out });
    });
  });
}

/* ---------- 主流程 ---------- */
(async function main() {
  const suites = [];
  E2E_DIRS.forEach(function (dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter(function (f) { return f.endsWith('.js') && !SKIP.test(f); })
      .sort()
      .forEach(function (f) {
        const full = path.join(dir, f);
        suites.push({
          name: path.relative(ROOT, full).replace(/\\/g, '/').replace(/\.js$/, ''),
          file: full,
          port: detectPort(full),
        });
      });
  });
  if (!suites.length) {
    console.error('[e2e:all] 未找到任何套件脚本');
    process.exit(1);
  }

  const ports = Array.from(new Set(
    suites.map(function (s) { return s.port; }).filter(function (p) { return p; })
  ));
  const servers = [];

  console.log('[e2e:all] 套件 ' + suites.length + ' 个（跳过一次性脚本 ' + SKIP.source + '）');
  console.log('[e2e:all] 需外部服务器的端口: ' + (ports.length ? ports.join(', ') : '无（全部自带）'));
  console.log('');

  /* 按需起服务器（根因：一次性预起 6 个 node 服务器会与「自带服务器」的套件抢资源——
     e2e/e2e.js 起服务器有 40×400ms=16s 上限，实测被拖到超时 15.8s 就 reject）。
     改成：跑到哪个套件才起它需要的端口，自带服务器的套件先跑完全不受干扰。 */
  const running = new Map();
  async function ensureServer(port) {
    if (running.has(port)) return;
    const s = startServer(port);
    servers.push(s);
    running.set(port, s);
    const ok = await waitHealth(port, 40);
    console.log('[e2e:all] 服务器 :' + port + (ok ? ' ✓ 就绪' : ' ✗ 未就绪（相关套件将失败）'));
  }

  try {
    /* 串行跑 */
    const results = [];
    for (const s of suites) {
      if (s.port) await ensureServer(s.port);
      process.stdout.write('[e2e:all] → ' + s.name + ' ... ');
      const r = await runSuite(s);
      results.push(r);
      console.log((r.code === 0 ? 'PASS' : 'FAIL(exit ' + r.code + ')') + '  ' + (r.ms / 1000).toFixed(1) + 's');
      if (r.code !== 0) {
        /* 失败时打印尾部输出，便于当场定位 */
        const tail = r.out.split('\n').filter(function (l) { return l.trim(); }).slice(-12).join('\n');
        console.log('    ┌─ 尾部输出 ────────────────');
        tail.split('\n').forEach(function (l) { console.log('    │ ' + l); });
        console.log('    └───────────────────────────');
      }
    }

    /* 汇总 */
    const failed = results.filter(function (r) { return r.code !== 0; });
    console.log('');
    console.log('══════════════════════════════════════');
    console.log('[e2e:all] 通过 ' + (results.length - failed.length) + ' / ' + results.length);
    if (failed.length) {
      console.log('[e2e:all] 失败: ' + failed.map(function (r) { return r.name; }).join(', '));
    }
    console.log('══════════════════════════════════════');
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    servers.forEach(function (s) {
      try { s.proc.kill('SIGKILL'); } catch (e) { /* noop */ }
    });
  }
})();
