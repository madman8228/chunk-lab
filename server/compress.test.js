/**
 * compress.test.js · 静态响应压缩中间件验证
 *
 * 为什么必须测：压缩一开就是「所有静态资源都换了交付方式」，出错方式全是静默的 ——
 *   Content-Length 对不上、编码协商写错、304 跨编码误命中（浏览器拿到另一个编码的已存 body）、
 *   或者把 403 白名单路径绕过去。这些都不会让页面立刻报错，只会表现为「偶发白屏/加载失败」。
 *
 * 覆盖：
 *   1. negotiate() 纯逻辑：br 优先、q=0 显式拒绝、* 通配、无头
 *   2. ETag 必须含编码（否则 Vary 分桶的 304 会命中错误 body）
 *   3. 端到端：br/gzip/identity 三种协商的内容与头
 *   4. 304：同编码命中、跨编码不命中
 *   5. 放行：png（已压缩）、Range 请求、非压缩扩展名
 *   6. 安全：403 白名单路径不受影响
 *   7. 解压后与原文件逐字节一致（防 Content-Length/截断类静默损坏）
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const compress = require('./compress');
const PORT = 9600 + Math.floor(Math.random() * 200);

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ---------- 1. 协商逻辑 ---------- */
console.log('【1. Accept-Encoding 协商】');
const neg = compress._internal.negotiate;
check('br,gzip → br（体积更小者优先）', neg('br, gzip') === 'br', neg('br, gzip'));
check('仅 gzip → gzip', neg('gzip, deflate') === 'gzip');
check('空头 → null（不压缩，原样返回）', neg('') === null && neg(undefined) === null);
check('br;q=0 显式拒绝 br → 回落 gzip', neg('br;q=0, gzip') === 'gzip', String(neg('br;q=0, gzip')));
check('全部 q=0 → null', neg('br;q=0, gzip;q=0') === null);
check('* 通配 → 可用', neg('*') === 'br', String(neg('*')));
check('gzip;q=0.5,br;q=0.9 → br（按可用性而非 q 值排序，两者都在阈值上）', neg('gzip;q=0.5,br;q=0.9') === 'br');

/* ---------- 2. ETag ---------- */
console.log('');
console.log('【2. ETag 必须区分编码】');
const st = { size: 1234, mtimeMs: 1700000000000 };
const eBr = compress._internal.etagFor(st, 'br');
const eGz = compress._internal.etagFor(st, 'gzip');
check('br / gzip 的 ETag 不同（防 Vary 分桶下 304 命中错误 body）', eBr !== eGz, eBr + ' vs ' + eGz);
check('同编码同 mtime → ETag 稳定', eBr === compress._internal.etagFor(st, 'br'));
check('mtime 变 → ETag 变', eBr !== compress._internal.etagFor({ size: 1234, mtimeMs: 1700000000001 }, 'br'));

/* ---------- 启动服务器 ---------- */
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-compress-'));
let server = null;
function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: __dirname,
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        r.resume();
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}
/** 发请求，返回 { status, headers, raw } */
function get(p, headers) {
  return new Promise(function (resolve, reject) {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p, headers: headers || {} }, function (r) {
      const chunks = [];
      r.on('data', function (c) { chunks.push(c); });
      r.on('end', function () { resolve({ status: r.statusCode, headers: r.headers, raw: Buffer.concat(chunks) }); });
    });
    req.on('error', reject);
    req.setTimeout(20000, function () { req.destroy(new Error('timeout')); });
  });
}

(async function () {
  await startServer();
  console.log('');
  console.log('【3. 端到端：三种协商】');
  const TARGET = '/builtins.js';
  const orig = fs.readFileSync(path.join(ROOT, 'builtins.js'));

  const rBr = await get(TARGET, { 'Accept-Encoding': 'br, gzip' });
  check('br：200 + Content-Encoding: br', rBr.status === 200 && rBr.headers['content-encoding'] === 'br',
    rBr.status + ' / ' + rBr.headers['content-encoding']);
  check('br：带 Vary: Accept-Encoding（缓存分桶的前提）',
    String(rBr.headers['vary'] || '').toLowerCase().indexOf('accept-encoding') >= 0, rBr.headers['vary']);
  check('br：体积显著小于原始', rBr.raw.length < orig.length / 2,
    rBr.raw.length + ' vs ' + orig.length);
  check('br：Content-Length 与实际字节一致',
    Number(rBr.headers['content-length']) === rBr.raw.length,
    rBr.headers['content-length'] + ' vs ' + rBr.raw.length);
  check('br：Content-Type 正确', /javascript/.test(String(rBr.headers['content-type'])), rBr.headers['content-type']);
  check('br：解压后与原文件逐字节一致', zlib.brotliDecompressSync(rBr.raw).equals(orig));

  const rGz = await get(TARGET, { 'Accept-Encoding': 'gzip' });
  check('gzip：200 + Content-Encoding: gzip + 解压一致',
    rGz.status === 200 && rGz.headers['content-encoding'] === 'gzip' && zlib.gunzipSync(rGz.raw).equals(orig),
    rGz.status + ' / ' + rGz.headers['content-encoding']);
  check('gzip 的 ETag 与 br 不同', rGz.headers.etag !== rBr.headers.etag,
    rGz.headers.etag + ' vs ' + rBr.headers.etag);

  const rId = await get(TARGET, {});
  check('无 Accept-Encoding：原样返回（无 Content-Encoding + 与文件一致）',
    rId.status === 200 && !rId.headers['content-encoding'] && rId.raw.equals(orig),
    String(rId.headers['content-encoding']));

  console.log('');
  console.log('【4. 304 协商必须按编码分桶】');
  const r304 = await get(TARGET, { 'Accept-Encoding': 'br', 'If-None-Match': rBr.headers.etag });
  check('br + 同编码 ETag → 304', r304.status === 304, String(r304.status));
  check('304 不携带 Content-Length（避免缓存语义错乱）', r304.headers['content-length'] === undefined,
    String(r304.headers['content-length']));
  check('304 仍带 Vary / ETag', !!r304.headers.vary && !!r304.headers.etag);
  const rCross = await get(TARGET, { 'Accept-Encoding': 'gzip', 'If-None-Match': rBr.headers.etag });
  check('gzip 带 br 的 ETag → 200（绝不能被 304 命中，否则拿到错误编码的 body）',
    rCross.status === 200, String(rCross.status));

  console.log('');
  console.log('【5. 放行路径（不改变原行为）】');
  const rPng = await get('/icon-192.png', { 'Accept-Encoding': 'br' });
  check('png 不压缩（已自带压缩）', rPng.status === 200 && !rPng.headers['content-encoding'],
    String(rPng.headers['content-encoding']));
  const rRange = await get(TARGET, { 'Accept-Encoding': 'br', Range: 'bytes=0-99' });
  check('Range 请求放行给 static（206）', rRange.status === 206 && !rRange.headers['content-encoding'],
    rRange.status + ' / ' + String(rRange.headers['content-encoding']));
  const rHtml = await get('/main.html', { 'Accept-Encoding': 'br' });
  check('HTML 也压缩（首屏收益）', rHtml.headers['content-encoding'] === 'br' &&
    zlib.brotliDecompressSync(rHtml.raw).equals(fs.readFileSync(path.join(ROOT, 'main.html'))));

  console.log('');
  console.log('【6. 安全白名单不受影响】');
  for (const p of ['/package.json', '/server/index.js', '/server/compress.js', '/.git/config']) {
    const r = await get(p, { 'Accept-Encoding': 'br' });
    check('仍 403：' + p, r.status === 403, String(r.status));
  }

  console.log('');
  console.log('【7. 预热：大文件的压缩体被缓存，二次请求不再重压】');
  const t1 = Date.now(); await get(TARGET, { 'Accept-Encoding': 'br' }); const d1 = Date.now() - t1;
  const t2 = Date.now(); await get(TARGET, { 'Accept-Encoding': 'br' }); const d2 = Date.now() - t2;
  check('二次请求不慢于首次（命中内存缓存）', d2 <= d1 + 30, '首次 ' + d1 + 'ms → 二次 ' + d2 + 'ms');

  stopServer();
  console.log('');
  console.log(failed === 0 ? '通过 ' + passed + ' / 0 失败' : '通过 ' + passed + ' / ' + failed + ' 失败');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error(e);
  stopServer();
  process.exit(1);
});
