/**
 * api-compress.test.js · API 响应压缩端到端验证（Playwright，真实浏览器）
 *
 * 目的（2026-09-10，8000 句扩容）：下行 `GET /api/data` 是全量响应，
 * 8000 句时 7191KB。服务端加了异步 brotli 压缩（q=5，实测 11.1×）。
 *
 * 为什么必须用真浏览器验，而不是只信服务端单测：
 *   1. 压缩生效的前提是**浏览器真的发 `Accept-Encoding: br`** —— 这是 forbidden header，
 *      JS 改不了，只能由浏览器决定（https/本地 http 行为不同）。猜不得。
 *   2. 浏览器要能**自动解压**并让 `response.json()` 拿到正确数据 —— 若中间件
 *      声明了 Content-Encoding 但 body 没压（或反过来），前端会直接拿不到数据。
 *   3. 刷新页面时请求会经过 Service Worker，要确认 SW 没把 API 请求当成静态资源拦截。
 *
 * 跑法：node e2e/api-compress.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
/* 直接读中间件的阈值，避免测试里写死一个会和实现漂移的常量 */
const apiCompressMinBytes = require(path.join(ROOT, 'server', 'api-compress'))._internal.MIN_BYTES;
const PORT = 8942 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-apicompress-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
}

/* 直连请求，模拟「不支持压缩的客户端」作对照（不带 Accept-Encoding）。
   注意：e2e 环境未设 REQUIRE_AUTH → 不带 token 也会走 ensureDefaultUser() 返回真实数据，
   所以这里不能靠「不带 token」来制造小响应，要制造小响应得换端点（见第 6 节）。 */
function getRaw(p, acceptEncoding) {
  return new Promise(function (resolve, reject) {
    const headers = {};
    if (acceptEncoding) headers['Accept-Encoding'] = acceptEncoding;
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p, headers: headers }, function (r) {
      const chunks = [];
      r.on('data', function (c) { chunks.push(c); });
      r.on('end', function () {
        resolve({ status: r.statusCode, headers: r.headers, raw: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
  });
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

(async function () {
  await startServer();
  console.log('[api-compress e2e] server on ' + BASE + '  temp DB ' + TMP_DB);

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();

  /* 捕获 GET /api/data 的「原始响应头 + 真实网络字节数」。
     ⚠️ 不能用 playwright 的 response.body()：大响应被页面消费后 body 不可用，
     会静默抛错（第一版就因此只抓到首轮空数据的 307B 响应，误判为「没压缩」）。
     改用 CDP：responseReceived 给原始头（含 content-encoding），
     loadingFinished 给 encodedDataLength（= 压缩后真实传输字节，含响应头开销）。 */
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  const reqMeta = {};
  const gets = [];
  cdp.on('Network.requestWillBeSent', function (e) {
    reqMeta[e.requestId] = { url: e.request.url, method: e.request.method };
  });
  cdp.on('Network.responseReceived', function (e) {
    const info = reqMeta[e.requestId];
    if (!info || info.url.indexOf('/api/data') < 0 || info.method !== 'GET') return;
    const hs = e.response.headers || {};
    const key = Object.keys(hs).find(function (k) { return k.toLowerCase() === 'content-encoding'; });
    const vk = Object.keys(hs).find(function (k) { return k.toLowerCase() === 'vary'; });
    const rec = {
      status: e.response.status,
      enc: key ? hs[key] : null,
      vary: vk ? hs[vk] : '',
      encoded: -1,               /* 由 loadingFinished 回填 */
      declaredLen: e.response.encodedDataLength || -1
    };
    gets.push(rec);
    reqMeta[e.requestId].rec = rec;
  });
  cdp.on('Network.loadingFinished', function (e) {
    const info = reqMeta[e.requestId];
    if (info && info.rec) info.rec.encoded = e.encodedDataLength;
  });

  await p.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(function () {
    return !!(window.CL && window.CL.cloudSyncNow && window.CL.loadMem);
  }, { timeout: 15000 });
  await p.waitForTimeout(1800); /* 等 ensureCloud 首轮握手 */

  /* ---------- 1. 造足够大的档案并上传（<1KB 不会触发压缩） ---------- */
  const pushed = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    if (!m.stats) m.stats = { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] };
    if (!m.stats.bySentence) m.stats.bySentence = {};
    if (!Array.isArray(m.stats.events)) m.stats.events = [];
    for (var i = 0; i < 1200; i++) {
      m.stats.bySentence['freq-idioms#' + ('0000000' + i).slice(-8)] = {
        deckId: 'freq-idioms', deckName: '高频短语 · English Idioms',
        sentence: 'This is a longer sample sentence used to measure downstream payload number ' + i + '.',
        translation: '这是一个用来测量下行体积的较长示例句子，序号 ' + i + '。',
        times: 3 + (i % 5), okTimes: 2 + (i % 3), wrongTimes: 1, streak: 1, maxStreak: 2,
        lastAt: 1700000000000 + i * 4000, interval: 4, ease: 2.5,
        dueAt: 1700003600000 + i * 4000, repetition: 2
      };
    }
    for (var j = 0; j < 2400; j++) {
      m.stats.events.push({
        id: 'ev' + j, kind: 'answer', key: 'freq-idioms#00000000', deckId: 'freq-idioms',
        sentence: 'This is a longer sample sentence used to measure downstream payload number ' + (j % 1200) + '.',
        ok: true, at: 1700000000000 + j
      });
    }
    var ok = await window.CL.cloudSyncNow(m);
    return { ok: ok, sbs: Object.keys(m.stats.bySentence).length, events: m.stats.events.length };
  });
  check('1.1 档案已上传（1200 条 / 2400 事件）', pushed.ok === true && pushed.sbs === 1200, JSON.stringify(pushed));
  await p.waitForTimeout(400);

  /* ---------- 2. 不带 Accept-Encoding 的对照（证明压缩确实由协商驱动） ---------- */
  const plain = await getRaw('/api/data', null);
  const plainLen = plain.raw.length;
  check('2.1 无 Accept-Encoding → 未压缩', !plain.headers['content-encoding'], String(plain.headers['content-encoding']));
  check('2.2 未压缩响应大于阈值（确实该压）', plainLen > 1024, kb(plainLen));

  /* ---------- 3. 刷新页面 → 真实浏览器发起 GET /api/data ---------- */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(function () {
    return !!(window.CL && window.CL.loadMem);
  }, { timeout: 15000 });
  /* 轮询等待「数据齐全后的那次 GET」出现（云握手是异步的，固定 sleep 会假失败）。
     判据：encoded > 0（网络字节已知）且 enc 已确定。 */
  let g = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(250);
    const cand = gets.filter(function (x) { return x.encoded > 0; }).sort(function (a, b) { return b.encoded - a.encoded; })[0];
    if (cand) { g = cand; break; }
  }

  check('3.1 捕获到 GET /api/data 响应', !!g, '捕获 ' + gets.length + ' 次');
  if (g) {
    console.log('      · 编码=' + g.enc + ' 网络字节=' + kb(g.encoded) + ' 未压缩对照=' + kb(plainLen));
    check('3.2 浏览器协商到 brotli（br）', g.enc === 'br', String(g.enc));
    check('3.3 响应声明 Vary: Accept-Encoding', String(g.vary).toLowerCase().indexOf('accept-encoding') >= 0, g.vary);
    check('3.4 传输量 ≥5× 小于未压缩（' + kb(plainLen) + ' → ' + kb(g.encoded) + '）', plainLen / g.encoded >= 5,
      (plainLen / g.encoded).toFixed(1) + '×');
    check('3.5 传输量为 KB 级（< 200KB）', g.encoded < 200 * 1024, kb(g.encoded));
  }

  /* ---------- 4. 页面实际拿到了数据（压缩没有把前端弄坏） ---------- */
  const after = await p.evaluate(function () {
    var m = window.CL.loadMem();
    var st = (m && m.stats) || {};
    return {
      sbs: st.bySentence ? Object.keys(st.bySentence).length : 0,
      events: Array.isArray(st.events) ? st.events.length : 0,
      hasEngine: !!(window.CL && typeof window.CL.cloudSyncNow === 'function')
    };
  });
  check('4.1 前端解析出全部 1200 条档案', after.sbs === 1200, 'sbs=' + after.sbs);
  check('4.2 前端解析出 2400 条事件', after.events === 2400, 'events=' + after.events);
  check('4.3 应用主体仍可工作', after.hasEngine === true);

  /* ---------- 5. 增量上行没被这次改动破坏 ---------- */
  const inc = await p.evaluate(async function () {
    var m = window.CL.loadMem();
    m.stats.totalAnswered = (m.stats.totalAnswered || 0) + 1;
    window.CL.saveMem(m);
    return await window.CL.cloudSyncNow(m);
  });
  check('5.1 增量上行仍成功', inc === true, 'ok=' + inc);

  /* ---------- 6. 小响应不该被压（阈值以下压了反而更大） ---------- */
  const small = await getRaw('/api/health', 'br');
  const smallLen = small.raw.length;
  check('6.1 小响应（' + smallLen + 'B）未被压缩', !small.headers['content-encoding'], String(small.headers['content-encoding']));
  let smallJson = null;
  try { smallJson = JSON.parse(small.raw.toString('utf8')); } catch (e) { smallJson = null; }
  check('6.2 小响应是合法 JSON', smallJson !== null, small.raw.toString('utf8').slice(0, 60));
  check('6.3 小响应小于阈值（' + apiCompressMinBytes + 'B）→ 走原路径', smallLen < apiCompressMinBytes, kb(smallLen));

  console.log('\n' + '='.repeat(70));
  console.log('通过 ' + passed + ' / 失败 ' + failed);
  if (g && g.encoded > 0) {
    console.log('★ 下行实测：' + kb(plainLen) + ' → br ' + kb(g.encoded) + '（' + (plainLen / g.encoded).toFixed(1) + '×）');
  }
  console.log('='.repeat(70));

  await browser.close();
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('e2e 异常：', e && e.stack || e);
  stopServer();
  process.exit(1);
});
