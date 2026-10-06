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
const PORT = require('./lib/free-port').freePort(8942, 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-apicompress-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test', REQUIRE_AUTH:'false', CHUNKLAB_WRITE_PROTOCOL:'3' }),
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
    executablePath: process.env.CHROMIUM_PATH || chromium.executablePath()
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const legacyWrites=[];
  p.on('request',request=>{
    const pathname=new URL(request.url()).pathname;
    if(request.method()!=='GET'&&['/api/data','/api/import','/api/sync/resolve','/api/sync/batch/resolve'].includes(pathname))
      legacyWrites.push({method:request.method(),path:pathname});
  });

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

  function waitForDataGet() {
    return p.waitForResponse(function (response) {
      return response.url().indexOf('/api/data') >= 0 &&
        response.request().method() === 'GET' && response.status() === 200;
    }, { timeout: 15000 });
  }

  const initialDataResponse = waitForDataGet();
  /* 这里验证 API 压缩与页面启动，不需要自动进入练习。
     direct=1 会在刷新后写入“最近练习”记录，和云同步启动交叉，
     把练习入口的写入竞态混入本测试，降低故障定位价值。 */
  await p.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await initialDataResponse;
  await p.waitForFunction(function () {
    return !!(window.CL && window.ServerCache && window.ServerStore);
  }, null, { timeout: 15000 });
  await p.waitForFunction(function () {
    return !!(window.CL && window.CL.getCloudConfig && window.CL.getCloudConfig() !== null);
  }, null, { timeout: 15000 });
  /* 配置完成不等于首轮确认缓存已就绪。 */
  await p.evaluate(function () { return window.CL.ensureCloud(); });
  await p.waitForFunction(()=>CL.serverPersistenceReady());

  /* Compression fixture only: write the isolated database, not a retired API.
     Real operation submission is verified below, independently of sample size. */
  const db=new (require('../server/node_modules/better-sqlite3'))(path.join(TMP_DB,'chunklab.db'));
  try {
    db.transaction(()=>{
      const seq=db.prepare('UPDATE user_change_seq SET seq=seq+1 WHERE user_id=1 RETURNING seq').get().seq;
      const stat=db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,deck_id,data_json,seq) VALUES(?,?,?,?,?)');
      const event=db.prepare('INSERT INTO user_events(user_id,id,at,data_json,seq) VALUES(?,?,?,?,?)');
      for(let i=0;i<1200;i++)stat.run(1,'compression#'+i,'compression',JSON.stringify({times:3,okTimes:2,wrongTimes:1,lastAt:1700000000000+i,interval:4,ease:2.5,dueAt:1700003600000+i}),seq);
      for(let i=0;i<2400;i++)event.run(1,'compression-event-'+i,1700000000000+i,JSON.stringify({id:'compression-event-'+i,kind:'answer',key:'compression#'+(i%1200),ok:true,at:1700000000000+i}),seq);
    })();
  } finally {db.close();}
  const pushed=await p.evaluate(()=>ChunkAPI.getData().then(data=>({sbs:Object.keys(data.mem.stats.bySentence).length,events:data.mem.stats.events.length})));
  check('1.1 隔离服务器大样本已确认',pushed.sbs===1200&&pushed.events===2400,JSON.stringify(pushed));

  /* ---------- 2. 不带 Accept-Encoding 的对照（证明压缩确实由协商驱动） ---------- */
  const plain = await getRaw('/api/data', null);
  const plainLen = plain.raw.length;
  check('2.1 无 Accept-Encoding → 未压缩', !plain.headers['content-encoding'], String(plain.headers['content-encoding']));
  check('2.2 未压缩响应大于阈值（确实该压）', plainLen > 1024, kb(plainLen));

  /* ---------- 3. 刷新页面 → 真实浏览器发起 GET /api/data ---------- */
  const reloadGetStart = gets.length;
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(function () {
    return !!(window.CL && window.ServerCache);
  }, null, { timeout: 15000 });
  await p.waitForFunction(function () {
    return !!(window.CL && window.CL.getCloudConfig && window.CL.getCloudConfig() !== null);
  }, null, { timeout: 15000 });
  await p.evaluate(function () { return window.CL.ensureCloud(); });
  await p.waitForFunction(()=>CL.serverPersistenceReady());
  /* 轮询等待「数据齐全后的那次 GET」出现（云握手是异步的，固定 sleep 会假失败）。
     判据：encoded > 0（网络字节已知）且 enc 已确定。 */
  let g = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(250);
    /* 只看本次刷新之后的请求，并等到它确实完成了大响应。
       否则首轮空账号的 0.7KB GET 可能先完成，被误当成压缩验证对象。 */
    const cand = gets.slice(reloadGetStart).filter(function (x) {
      return x.encoded > apiCompressMinBytes;
    }).sort(function (a, b) { return b.encoded - a.encoded; })[0];
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
  const after = await p.evaluate(async function () {
    var m = (await ServerCache.read()).snapshot.mem;
    var st = (m && m.stats) || {};
    return {
      sbs: st.bySentence ? Object.keys(st.bySentence).length : 0,
      events: Array.isArray(st.events) ? st.events.length : 0,
      hasEngine: !!(window.ServerStore && typeof window.ServerStore.submitCommitted === 'function')
    };
  });
  check('4.1 前端解析出全部 1200 条档案', after.sbs === 1200, 'sbs=' + after.sbs);
  check('4.2 前端解析出 2400 条事件', after.events === 2400, 'events=' + after.events);
  check('4.3 应用主体仍可工作', after.hasEngine === true);

  /* ---------- 5. 增量上行没被这次改动破坏 ---------- */
  const inc = await p.evaluate(async function () {
    await ServerStore.submitCommitted('learning.answer',{
      eventId:'compression-real-answer',deckId:'compression',key:'compression#0',ok:true,mode:'chunkSelection'
    },{requestId:'compression-real-request'});
    var data=await ChunkAPI.getData();
    return {ok:data.mem.stats.events.some(event=>event.id==='compression-real-answer')};
  });
  check('5.1 新版答题获服务器确认且下行可读', inc.ok === true, JSON.stringify(inc));
  check('5.2 未调用旧整份写入或冲突处理接口',legacyWrites.length===0,JSON.stringify(legacyWrites));

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
