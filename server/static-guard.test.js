#!/usr/bin/env node
'use strict';
/**
 * static-guard.test.js · 静态托管敏感路径守卫的回归测试
 *
 * 为什么需要它（2026-09-21 P0）：
 *   静态根是项目根，`server/middleware/static-guard.js` 是唯一防线。
 *   但旧实现把正则打在**未解码**的 `req.path` 上，被 `//server/…`、`/%73erver/…`
 *   绕过 —— 线上实测 200，可下载 SQLite 整库与后端源码；而**朴素路径全是 403**，
 *   所以历次自检都报绿。这类洞的可怕之处在于「自检绿 + 护栏恒真」同时成立。
 *
 * 本测试要防的两件事：
 *   [A] 变体族重新变成可访问（回归）
 *   [B] 守卫过度收紧，把前端必需资源也拦掉（另一种事故）
 *
 * 负向自证（关键，否则测试可能只是「文件不存在所以 403」的假绿）：
 *   同时起一个**不挂守卫**的对照实例，断言 `/%73erver/index.js` 在那里是 200。
 *   ⇒ 证明 canary 文件确实存在且确实可被静态服务命中，403 是守卫的功劳。
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { createStaticGuard, normalizeRequestPath, isSensitivePath } = require('./middleware/static-guard');

let pass = 0;
let total = 0;
const failures = [];

function check(name, condition, detail) {
  total++;
  if (condition) { pass++; return; }
  failures.push(name + (detail ? '  → ' + detail : ''));
}

/* ---------- canary 目录：只造文件，不碰真实仓库 ---------- */
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-static-guard-'));
const FILES = [
  /* 前端必需（必须仍可访问） */
  'main.html', 'core.js', 'js/app.js', 'content/a.json', 'assets/icons/x.svg',
  /* 敏感（必须被拒） */
  'server/index.js', 'server/data/chunklab.db', 'server/data/chunklab.db-wal',
  'server/.env', '.env', 'package.json', 'package-lock.json',
  'scripts/deploy-security-smoke.sh', 'deploy/nginx-chunklab.conf',
  'README.md', 'diagnose.html', 'validate_oral_book.js', 'e2e/e2e.js',
  'node_modules/express/package.json', 'output/e2e/e2e.js', 'extra/x.json',
  'deliverables/x.md', 'ref/x.html', 'store.test.js',
];
FILES.forEach(function (rel) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, 'canary:' + rel + '\n', 'utf8');
});

/* ---------- 组装守卫实例 + 无守卫对照实例 ---------- */
function makeServer(useGuard) {
  const app = express();
  if (useGuard) app.use(createStaticGuard());
  app.use(express.static(ROOT));
  return app;
}

function get(port, rawPath) {
  return new Promise(function (resolve) {
    const req = http.request({ host: '127.0.0.1', port: port, path: rawPath, method: 'GET' }, function (res) {
      res.resume();
      res.on('end', function () { resolve({ status: res.statusCode }); });
    });
    req.setTimeout(8000, function () { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.on('error', function (e) { resolve({ status: 0, error: e.message }); });
    req.end();
  });
}

function listen(app) {
  return new Promise(function (resolve) {
    const server = app.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

/* ---------- 变体族生成：每一种都是历史上真实可用的绕过写法 ---------- */
function hex(c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'); }

function variantsOf(p) {
  const rest = p.slice(1);
  const first = rest.split('/')[0];
  const out = [
    ['双斜杠', '/' + p],
    ['首段首字符编码', '/' + hex(first[0]) + p.slice(2)],
    ['前导斜杠编码', '/%2F' + rest],
    ['二次编码前导斜杠', '/%252F' + rest],
    ['查表穿越', '/js/..' + p],
    ['编码穿越', '/..%2F' + rest],
  ];
  if (p.indexOf('.') !== -1) out.push(['点编码', p.replace(/\./g, '%2E')]);
  return out;
}

(async function main() {
  const guarded = await listen(makeServer(true));
  const openServer = await listen(makeServer(false));
  const GP = guarded.address().port;
  const OP = openServer.address().port;

  /* ============ [A] 前端必需资源仍可访问（防过度收紧）============ */
  for (const p of ['/main.html', '/core.js', '/js/app.js', '/content/a.json', '/assets/icons/x.svg', '/']) {
    const r = await get(GP, p);
    check('A 合法资源可访问 ' + p, r.status === 200 || (p === '/' && r.status === 404), 'status=' + (r.error || r.status));
  }

  /* ============ [B] 朴素敏感路径必须 403（既有行为，不得回退）============ */
  const SENSITIVE = [
    '/server/index.js', '/server/data/chunklab.db', '/server/data/chunklab.db-wal',
    '/server/.env', '/.env', '/package.json', '/package-lock.json',
    '/scripts/deploy-security-smoke.sh', '/deploy/nginx-chunklab.conf',
    '/README.md', '/diagnose.html', '/validate_oral_book.js', '/e2e/e2e.js',
    '/node_modules/express/package.json', '/output/e2e/e2e.js', '/extra/x.json',
    '/deliverables/x.md', '/ref/x.html', '/store.test.js',
  ];
  for (const p of SENSITIVE) {
    const r = await get(GP, p);
    check('B 朴素敏感路径被拒 ' + p, r.status === 403, 'status=' + (r.error || r.status));
  }

  /* ============ [C] 负向自证：同样路径在「无守卫」实例上必须 200 ============ */
  /* 注意：不把 .env / server/.env 放进本组 —— express.static 的 dotfiles:'ignore'
     对点文件一律 404，与守卫无关（线上 /%73erver/%2Eenv 也正是 404）。
     点文件只放进 [B]/[D] 的「必须 403」断言。 */
  for (const p of ['/server/index.js', '/server/data/chunklab.db', '/package.json']) {
    const r = await get(OP, p);
    check('C 负向自证·canary 确实可被静态服务 ' + p, r.status === 200,
      'status=' + (r.error || r.status) + '（若此处非 200，说明 canary 不存在，后面的 403 会变成假绿）');
  }
  {
    const r = await get(OP, '/%73erver/index.js');
    check('C 负向自证·未经规范化时编码变体确实可绕过', r.status === 200,
      'status=' + (r.error || r.status) + '（若此处不是 200，本测试就测不到那个洞）');
  }

  /* ============ [D] 变体族必须全部 403（本次修复的核心）============ */
  for (const p of SENSITIVE) {
    for (const [label, variant] of variantsOf(p)) {
      const r = await get(GP, variant);
      check('D 变体被拒 [' + label + '] ' + variant, r.status === 403, 'status=' + (r.error || r.status));
    }
  }

  /* ============ [E] 不可信输入必须 fail-closed ============ */
  for (const bad of ['/%ZZ', '/%E4%B8', '/server/%00index.js', '/%00']) {
    const r = await get(GP, bad);
    check('E 非法编码/NUL 一律拒绝 ' + bad, r.status === 403, 'status=' + (r.error || r.status));
  }

  /* ============ [F] 规范化纯函数（让「有人删掉规范化」必红）============ */
  const NORM = [
    ['/%73erver/index.js', '/server/index.js'],
    ['//server/index.js', '/server/index.js'],
    ['/%2Fserver/index.js', '/server/index.js'],
    ['/%252Fserver/index.js', '/server/index.js'],
    ['/..%2Fserver/index.js', '/server/index.js'],
    ['/js/../server/index.js', '/server/index.js'],
    ['/%73erver/data/chunklab%2Edb', '/server/data/chunklab.db'],
    ['/main.html', '/main.html'],
    ['/', '/'],
  ];
  for (const [input, want] of NORM) {
    check('F normalize ' + input, normalizeRequestPath(input) === want,
      'got=' + normalizeRequestPath(input) + ' want=' + want);
  }
  check('F 非法编码返回 null', normalizeRequestPath('/%ZZ') === null);
  check('F NUL 返回 null', normalizeRequestPath('/a%00b') === null);
  check('F 规范化后命中判定', isSensitivePath(normalizeRequestPath('/%73erver/index.js')) === true);
  check('F 规范化后合法路径不命中', isSensitivePath(normalizeRequestPath('/main.html')) === false);

  guarded.close();
  openServer.close();
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (e) { /* 临时目录，忽略 */ }

  if (failures.length) {
    console.log('  失败明细：');
    failures.forEach(function (f) { console.log('    ✗ ' + f); });
  }
  console.log('static-guard: ' + pass + '/' + total + ' ' + (failures.length ? '失败' : '通过'));
  if (failures.length) process.exit(1);
})().catch(function (e) {
  console.log('static-guard: 异常 ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
