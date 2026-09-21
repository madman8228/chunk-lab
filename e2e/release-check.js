'use strict';
/**
 * release-check.js · 发布前专项验收（新内容架构：manifest + 按需分片）
 *
 * 为什么需要它：现有 e2e（149 项）是 2026-09-08 对齐旧架构写的，覆盖「流程不坏」，
 * 但不覆盖本次发布的真实风险 —— 内容从「单文件全量加载」切成「manifest + 136 分片按需加载」。
 * 那类回归在流程测试里看不出来：页面照样能答题，但首屏可能悄悄把 2.85MB 全拉下来。
 *
 * 四个问题（都拿实测数据，不靠推断）：
 *   A 首屏会不会全量拉分片？（CDP encodedDataLength = 真实网络字节）
 *   B manifest 里的 deck 是否齐全？（ContentRepo API）
 *   C 分片是否真按需 —— 只拉当前 deck 那个目录？
 *   D 375px 窄屏是否横向溢出？
 *
 * 安全：自动拉起临时 server + 临时 DB（CHUNKLAB_DATA_DIR），不碰 server/data/chunklab.db。
 * 用法：npm run e2e:release    （或 node e2e/release-check.js）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(8931, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-rel-'));
const CHROMIUM = process.env.CHROMIUM_PATH || chromium.executablePath();

let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    const env = Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) });
    delete env.NODE_OPTIONS;
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'), env: env, stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
const kb = function (n) { return (n / 1024).toFixed(1) + ' KB'; };

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });
  console.log('验收 server: ' + BASE + '\n');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });

  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  const reqMeta = {}, hits = [];
  cdp.on('Network.requestWillBeSent', function (e) {
    reqMeta[e.requestId] = { url: e.request.url };
  });
  cdp.on('Network.responseReceived', function (e) {
    const info = reqMeta[e.requestId];
    if (!info) return;
    const hs = e.response.headers || {};
    const k = Object.keys(hs).find(function (x) { return x.toLowerCase() === 'content-encoding'; });
    const rec = { url: info.url, status: e.response.status, enc: k ? hs[k] : null, encoded: -1 };
    hits.push(rec);
    info.rec = rec;
  });
  cdp.on('Network.loadingFinished', function (e) {
    const info = reqMeta[e.requestId];
    if (info && info.rec) info.rec.encoded = e.encodedDataLength;
  });

  await p.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#stageChoices, #track', { timeout: 15000 }).catch(function () { });
  await p.waitForTimeout(1200);
  /* 陷阱 2：异步回填必须轮询等待，固定 sleep 会读到空数组 */
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(250);
    if (hits.filter(function (h) { return h.encoded > 0; }).length >= 8) break;
  }

  const done = hits.filter(function (h) { return h.encoded > 0; });
  const totalEnc = done.reduce(function (s, h) { return s + h.encoded; }, 0);
  const contentReqs = done.filter(function (h) { return /\/content\//.test(h.url); });
  const manifestReq = contentReqs.find(function (h) { return /manifest\.json/.test(h.url); });
  const shardReqs = contentReqs.filter(function (h) { return !/manifest\.json/.test(h.url); });

  const dirMap = {};
  shardReqs.forEach(function (h) {
    const m = /\/content\/([^/]+)\//.exec(h.url);
    if (m) dirMap[m[1]] = (dirMap[m[1]] || 0) + 1;
  });
  const dirs = Object.keys(dirMap);

  console.log('== A 首屏网络（CDP encodedDataLength，权威字节）==');
  console.log('   已完成请求 = ' + done.length + ' 个｜总传输 = ' + kb(totalEnc));
  console.log('   manifest = ' + (manifestReq ? 'HTTP ' + manifestReq.status + ' / ' + kb(manifestReq.encoded) : '未请求'));
  console.log('   分片请求 = ' + shardReqs.length + ' 个（全库共 136 个）｜涉及 deck 目录 = ' + dirs.length + ' 个');
  dirs.forEach(function (d) { console.log('     · ' + d + ' → ' + dirMap[d] + ' 个分片'); });
  console.log('   —— 传输量 top 6 ——');
  done.slice().sort(function (a, b) { return b.encoded - a.encoded; }).slice(0, 6).forEach(function (h) {
    console.log('     ' + kb(h.encoded).padStart(10) + '  ' + (h.enc || 'identity').padEnd(8) + '  ' + h.url.replace(BASE, ''));
  });
  console.log('');

  check('A1 首屏请求了 content/manifest.json 且 200', !!manifestReq && manifestReq.status === 200,
    manifestReq ? 'HTTP ' + manifestReq.status : '未请求');
  check('A2 首屏未全量拉取分片（< 20 个 / 共 136）', shardReqs.length < 20, '实拉 ' + shardReqs.length + ' 个');
  check('A3 分片集中在 ≤2 个 deck 目录（证明按需）', dirs.length <= 2, '涉及 ' + dirs.length + ' 个目录');
  check('A4 首屏总传输 < 1.5 MB', totalEnc < 1.5 * 1024 * 1024, kb(totalEnc));
  check('A5 首屏零 pageerror', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('\n== B deck 完整性（ContentRepo API）==');
  const info = await p.evaluate(function () {
    if (!window.ContentRepo || !ContentRepo.ready) return null;
    return ContentRepo.ready.then(function () {
      const m = ContentRepo.getManifest && ContentRepo.getManifest();
      if (!m || !Array.isArray(m.decks)) return null;
      const ids = m.decks.map(function (d) { return d.id; });
      const oral = ids.filter(function (i) { return /^oral-/.test(i); });
      let shards = 0;
      m.decks.forEach(function (d) { shards += (d.shards || []).length + (d.indexShards || []).length; });
      return { count: ids.length, oral: oral.length, shards: shards, cv: m.contentVersion };
    });
  }).catch(function (e) { return { err: e.message }; });

  console.log('   ' + JSON.stringify(info));
  check('B1 ContentRepo.ready 可解析 manifest', !!info && !info.err, info && info.err ? info.err : 'null');
  check('B2 deck 总数 = 66', !!(info && info.count === 66), info ? String(info.count) : 'null');
  check('B3 oral-* deck = 65', !!(info && info.oral === 65), info ? String(info.oral) : 'null');
  check('B4 分片总数 = 136', !!(info && info.shards === 136), info ? String(info.shards) : 'null');
  check('B5 contentVersion 非空', !!(info && typeof info.cv === 'string' && info.cv.length > 10), info ? String(info.cv) : 'null');

  console.log('\n== C 分片装配正确（首屏已拉的分片被用上 + ensureDeck 再取）==');
  /* 断言对象必须是「已加载注册表 window.BUILTIN」，不是 manifest entry ——
     byId() 查 BUILTIN，_contentReady 只设在注册表那份对象上（两个不同对象，曾误判成实现缺陷）；
     内容字段名是 items（copyDeck: out.items = deck.items.slice()），不是 sentences。 */
  const boot = await p.evaluate(function () {
    const reg = (window.BUILTIN || []).filter(function (d) { return d._contentReady; });
    return {
      readyDecks: reg.length,
      sample: reg.slice(0, 3).map(function (d) { return { id: d.id, items: (d.items || []).length }; })
    };
  }).catch(function (e) { return { err: e.message }; });

  console.log('   首屏就绪 deck = ' + JSON.stringify(boot));
  check('C1 首屏拉下的分片已装配进 deck（≥1 个 ready）', !!(boot && boot.readyDecks >= 1),
    boot ? String(boot.readyDecks) : 'null');
  check('C2 就绪 deck 含真实句子（items > 0）',
    !!(boot && boot.sample.length && boot.sample[0].items > 0),
    boot && boot.sample[0] ? ('items=' + boot.sample[0].items) : 'null');

  const load = await p.evaluate(function () {
    const m = ContentRepo.getManifest();
    const d = m.decks.find(function (x) { return /^oral-/.test(x.id); });
    const before = Date.now();
    return ContentRepo.ensureDeck(d, {}).then(function (full) {
      const reg = (window.BUILTIN || []).find(function (x) { return x.id === d.id; }) || {};
      const declared = (d.shards || []).reduce(function (s, x) { return s + (x.count || 0); }, 0);
      return {
        id: d.id, ms: Date.now() - before,
        items: full && full.items ? full.items.length : -1,
        itemCount: full ? full.itemCount : null,
        ready: !!reg._contentReady,
        declared: declared
      };
    }).catch(function (e) { return { id: d.id, err: e.message }; });
  }).catch(function (e) { return { err: e.message }; });

  console.log('   ensureDeck = ' + JSON.stringify(load));
  check('C3 ensureDeck 返回内容（items > 0）', !!(load && !load.err && load.items > 0),
    load ? (load.err || ('items=' + load.items)) : 'null');
  check('C4 注册表 _contentReady = true', !!(load && load.ready === true), load ? String(load.ready) : 'null');
  check('C5 items 数与声明的 shard count 一致', !!(load && load.items === load.declared),
    load ? ('实得 ' + load.items + ' / 声明 ' + load.declared) : 'null');
  check('C6 重复取用走缓存（< 3s）', !!(load && typeof load.ms === 'number' && load.ms < 3000), load ? load.ms + 'ms' : 'null');

  console.log('\n== D 375px 窄屏（部分替代 G4 真机）==');
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  const merrs = [];
  mp.on('pageerror', function (e) { merrs.push(e.message); });
  await mp.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await mp.waitForSelector('#stageChoices, #track', { timeout: 15000 }).catch(function () { });
  await mp.waitForTimeout(1200);
  const m = await mp.evaluate(function () {
    const de = document.documentElement;
    const over = [];
    document.querySelectorAll('body *').forEach(function (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) over.push(el.tagName + '.' + (el.className || '').toString().slice(0, 24));
    });
    return {
      scrollW: de.scrollWidth, innerW: window.innerWidth,
      overflow: over.slice(0, 5), overflowCount: over.length,
      choices: document.querySelectorAll('#stageChoices .choice, #stageChoices button').length,
      trackChunks: document.querySelectorAll('#track .chunk').length
    };
  }).catch(function (e) { return { err: e.message }; });

  console.log('   ' + JSON.stringify(m));
  check('D1 无横向溢出', !!(m && m.scrollW <= m.innerW + 1), m ? (m.scrollW + ' > ' + m.innerW) : 'null');
  check('D2 溢出元素数 = 0', !!(m && m.overflowCount === 0), m ? (m.overflowCount + ' 个: ' + m.overflow.join(', ')) : 'null');
  check('D3 窄屏候选区已渲染', !!(m && m.choices > 0), m ? String(m.choices) : 'null');
  check('D4 窄屏零 pageerror', merrs.length === 0, merrs.slice(0, 2).join(' | '));

  console.log('\n== E 负向自证：强制全量加载后，A2/A3 判据必须能报红 ==');
  /* 闸若恒真就没有价值。主动把全部 deck 的分片拉下来，再套用 A2（<20）/A3（≤2）同一判据 ——
     它们此刻必须失败；这两条通过 = 判据有区分度，A 段全绿不是假绿。
     ⚠️ 必须 bypass Service Worker：SW 接管后由缓存返回的响应不产生网络事件
        （encodedDataLength 为 0 或缺失），CDP 一条都记不到 —— 那看起来像「驱动没生效」，
        实际是「量错了对象」。这和「判据失效」是两回事，不能混为一谈。 */
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  const eAll = await p.evaluate(function () {
    const m = ContentRepo.getManifest();
    const urls = [];
    m.decks.forEach(function (d) {
      (d.shards || []).forEach(function (s) { urls.push(s.url); });
      (d.indexShards || []).forEach(function (s) { urls.push(s.url); });
    });
    const viaRepo = Promise.all(m.decks.map(function (d) {
      return ContentRepo.ensureDeck(d, {});
    })).then(function () { return 'ok'; }).catch(function (e) { return 'err:' + (e && e.message); });
    return viaRepo.then(function (repoRes) {
      return Promise.all(urls.map(function (u) {
        return fetch(u, { cache: 'no-store' }).then(function (r) { return r.status; }).catch(function () { return -1; });
      })).then(function (codes) {
        return {
          repo: repoRes,
          urls: urls.length,
          fetched200: codes.filter(function (c) { return c === 200; }).length,
          readyDecks: (window.BUILTIN || []).filter(function (x) { return x._contentReady; }).length
        };
      });
    });
  }).catch(function (e) { return { outerErr: String(e && e.message || e) }; });
  console.log('   驱动结果 = ' + JSON.stringify(eAll));

  let allShards = 0, allDirs = 0;
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(400);
    const sh = hits.filter(function (h) {
      return h.encoded > 0 && /\/content\//.test(h.url) && !/manifest\.json/.test(h.url);
    });
    allShards = sh.length;
    const dd = {};
    sh.forEach(function (h) { const mm = /\/content\/([^/]+)\//.exec(h.url); if (mm) dd[mm[1]] = 1; });
    allDirs = Object.keys(dd).length;
    if (allShards >= 130) break;
  }
  /* 诊断：把「记录数」和「已回填字节数」分开打印 —— 只看 encoded>0 会把
     「记录到了但字节为 0/未回填」误读成「没发生请求」（本 skill 陷阱 1）。 */
  const allC = hits.filter(function (h) { return /\/content\//.test(h.url); });
  const shardAll = allC.filter(function (h) { return !/manifest\.json/.test(h.url); });
  console.log('   CDP 原始记录：hits=' + hits.length + '｜content 记录=' + allC.length +
    '（分片 ' + shardAll.length + '）｜其中 encoded>0 的分片=' +
    shardAll.filter(function (h) { return h.encoded > 0; }).length);

  const grand = hits.filter(function (h) { return h.encoded > 0; })
    .reduce(function (s, h) { return s + h.encoded; }, 0);

  console.log('   全量加载后：分片请求 = ' + allShards + ' 个｜涉及 deck 目录 = ' + allDirs + ' 个');
  console.log('   首屏 ' + kb(totalEnc) + ' → 全量累计 ' + kb(grand) +
    '（按需模式省下 ' + (100 - totalEnc / grand * 100).toFixed(1) + '%）');
  check('E1 全量加载拉满分片（>20 → A2 判据会报红）', allShards > 20, '实拉 ' + allShards);
  check('E2 全量加载跨多个目录（>2 → A3 判据会报红）', allDirs > 2, '涉及 ' + allDirs);
  check('E3 按需模式确实省下传输（首屏 < 全量 80%）', totalEnc < grand * 0.8,
    kb(totalEnc) + ' / ' + kb(grand));
  check('E4 全量加载后 66 个 deck 全部就绪（首屏仅 1 个）',
    !!(eAll && eAll.readyDecks === 66), eAll ? String(eAll.readyDecks) : 'null');

  console.log('\n[release-check] passed=' + passed + ' failed=' + failed);
  await browser.close();
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('验收脚本异常：' + (e && e.stack || e));
  stopServer();
  process.exit(2);
});
