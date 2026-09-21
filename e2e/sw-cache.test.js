/**
 * sw-cache.test.js · SW 预缓存策略的端到端验证（真浏览器）
 *
 * 为什么必须真浏览器：sw-policy.test.js 只能证明 sw.js 的「文本契约」还在，
 * 证明不了 install 在真实 ServiceWorker 容器里跑得通、cache API 真的写进去了、离线真的还能打开。
 *
 * 背景（2026-09-10 扩容 8000 句时发现的真 P0）：
 *   内置扩展题库改为 manifest + hash 分片，不能再把整包题库放进 install 的预缓存清单。
 *   addAll 全有全无 → 移动网络下极易整体失败 → SW 一个都装不上、离线能力全丢。
 *
 * 覆盖：
 *   1. 首次在线访问：SW 安装成功，小型 manifest 和兼容基础资源进了 cache
 *   2. ★ 首次访问后**立即离线**（只访问过一次）→ 页面仍能完整启动
 *      为什么是这个场景：实测发现 Cache API 的匹配对「请求形状」敏感 ——
 *      install 的 addAll() 存储条目时请求不带 Origin，而 <script type="module"> 带 Origin（CORS 请求）
 *      → .mjs 永远取不到预缓存 → 落到 HTML 兜底 → FormatTools 缺失 → 启动段 TypeError。
 *      只在「在线访问过第二次」之后才会被运行时的 cache.put 修正，所以必须锁住「只访问一次」这个前提。
 *   3. ★ 回归检测：动态内容分片不可达时 SW 仍能安装成功
 *      （内容分片属于按需资源，不得拖垮安装）
 *
 * 自带服务器（spawn index.js），不依赖外部端口。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9500, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-swcache-'));
const BASE = 'http://127.0.0.1:' + PORT;
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

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/** 等 SW 从 install 走到 activate（超时说明安装失败 —— 旧 addAll 设计下的典型表现） */
async function waitSwActive(page, timeout) {
  return page.evaluate(function (ms) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) resolve(null); }, ms);
      navigator.serviceWorker.ready.then(function (reg) {
        done = true; clearTimeout(timer);
        resolve(reg && reg.active ? 'active' : null);
      }).catch(function () { done = true; clearTimeout(timer); resolve(null); });
    });
  }, timeout);
}

/** 读当前 chunklab-* cache 里已缓存的 URL 列表 */
function cacheUrls(page) {
  return page.evaluate(function () {
    return caches.keys().then(function (names) {
      var mine = names.filter(function (n) { return n.indexOf('chunklab-') === 0; });
      if (!mine.length) return { caches: names, urls: [] };
      return caches.open(mine[0]).then(function (c) {
        return c.keys().then(function (reqs) {
          return {
            caches: mine,
            urls: reqs.map(function (r) { return new URL(r.url).pathname; })
          };
        });
      });
    });
  });
}

(async function () {
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });

  /* ---------- 1. 首次在线访问 ---------- */
  console.log('【1. 首次在线访问：SW 安装 + manifest 入缓存】');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(BASE + '/main.html', { waitUntil: 'load' });
  const state = await waitSwActive(page, 30000);
  check('SW 安装并激活成功', state === 'active', String(state));

  /* install 的 waitUntil 覆盖 addAll + carryOver + fillSoft，active 时应已写完 */
  let urls = [];
  for (let i = 0; i < 20; i++) {
    const r = await cacheUrls(page);
    urls = r.urls;
    if (urls.indexOf('/content/manifest.json') >= 0 && urls.indexOf('/main.html') >= 0) break;
    await page.waitForTimeout(400);
  }
  check('硬清单已缓存（/main.html、/core.js、manifest）',
    urls.indexOf('/main.html') >= 0 && urls.indexOf('/core.js') >= 0 && urls.indexOf('/content/manifest.json') >= 0,
    urls.join(','));
  check('整包题库未进入安装预缓存',
    urls.indexOf('/oral-book.js') < 0 && urls.indexOf('/freq-idioms.js') < 0,
    urls.filter(function (u) { return /oral-book|freq-idioms/.test(u); }).join(','));
  check('页面无 JS 错误', errs.length === 0, errs.slice(0, 3).join(' | '));

  /* 首次真正使用日常题库时，才会拉取并缓存对应内容分片。主页本身不应隐式加载整库。
     ★ 必须走「真实入口」startDeck：它既拉分片，又登记 mem.activeDeckId / lastPlayed。
     只调 ContentRepo.ensureDeck 会漏掉后者 —— 之前正是漏了，导致离线页在
     resumeOrStart() 里回落到 allDecks()[0]（一个从没访问过、分片也没缓存的 deck），
     于是「离线出不了首卡」被误报成离线缺陷（2026-09-16 判明：是测试没铺垫，不是离线坏）。 */
  const ONLINE_DECK = 'oral-6-31';
  await page.evaluate(function (deckId) {
    return window.ContentRepo.ensureDeck(deckId).then(function (deck) {
      window.startDeck(deck, 0);
    });
  }, ONLINE_DECK);
  /* startDeck may wait for the lazily loaded practice modules or a content
     batch; sample its state only after the real entry has rendered a deck. */
  await page.waitForFunction(function (deckId) {
    return window.S && S.deck && S.deck.id === deckId && S.items && S.items.length > 0;
  }, ONLINE_DECK, { timeout: 30000 });
  const online = await page.evaluate(function () {
    return {
      deckId: window.S && S.deck ? S.deck.id : null,
      items: window.S && S.items ? S.items.length : 0
    };
  });
  let contentUrls = [];
  for (let i = 0; i < 30; i++) {
    contentUrls = (await cacheUrls(page)).urls;
    if (contentUrls.some(function (u) { return u.indexOf('/content/oral-6-31/') === 0; })) break;
    await page.waitForTimeout(400);
  }
  check('进入练习后才缓存日常题库分片',
    contentUrls.some(function (u) { return u.indexOf('/content/oral-6-31/') === 0; }),
    contentUrls.filter(function (u) { return u.indexOf('/content/') === 0; }).join(','));
  check('在线进入练习：已登记活跃题库（离线恢复的依据）',
    online.deckId === ONLINE_DECK && online.items > 0, JSON.stringify(online));

  /* ---------- 2. 首次访问后立即离线（只访问过一次） ---------- */
  console.log('');
  console.log('【2. 只访问过一次就离线：页面仍须完整启动（含 .mjs 引擎模块）】');
  await ctx.setOffline(true);
  const page2 = await ctx.newPage();
  const errs2 = [];
  page2.on('pageerror', function (e) { errs2.push(e.message); });
  await page2.goto(BASE + '/main.html?direct=1', { waitUntil: 'load' }).catch(function () { /* 离线导航回落 SW 缓存 */ });
  const off = await page2.evaluate(function () {
    return new Promise(function (resolve) {
      var t = 0;
      var iv = setInterval(function () {
        t += 100;
        var ok = window.S && S.items && S.items.length > 0;
        if (ok || t > 20000) {
          clearInterval(iv);
          resolve({
            ok: !!ok,
            engine: typeof window.ChunkEngine,
            format: typeof window.FormatTools,
            /* 旧指标读 window.BUILTIN，而 builtins.js 自 2026-09-15 起是空壳
               （window.BUILTIN = []，句子全走 content/ 分片）→ 该指标恒为 0、断言必红。
               改为量「离线真正加载到的题目」，再与在线数对比（在线 == 离线才叫完整）。 */
            deckId: window.S && S.deck ? S.deck.id : null,
            items: window.S && S.items ? S.items.length : 0,
            session: window.S ? S.items.length : -1,
            qno: (document.getElementById('qno') || {}).textContent || ''
          });
        }
      }, 100);
    });
  });
  check('离线启动后引擎模块已就绪（ChunkEngine / FormatTools）',
    off.engine === 'object' && off.format === 'object',
    'ChunkEngine=' + off.engine + ' FormatTools=' + off.format);
  check('离线也能启动并出练习首卡', off.ok && !!off.qno, JSON.stringify(off));
  check('离线恢复到「已缓存的活跃题库」，而非回落到没收过的 deck',
    off.deckId === ONLINE_DECK, '实际 ' + off.deckId);
  check('离线题目数与在线一致（分片确实从 SW/IDB 缓存取回）',
    off.items === online.items && off.items > 0,
    '在线 ' + online.items + ' / 离线 ' + off.items);
  check('离线无 JS 错误（尤其不得出现 MIME/esc 类级联报错）', errs2.length === 0, errs2.slice(0, 3).join(' | '));
  await ctx.close();

  /* ---------- 3. 动态内容分片不可达时 SW 仍应装上（核心回归检测） ---------- */
  console.log('');
  console.log('【3. 回归检测：动态内容分片不可达 → SW 仍必须安装成功】');
  const ctx2 = await browser.newContext();
  await ctx2.route('**/content/builtin-freq-idioms/**', function (r) { r.abort('failed'); });
  const page3 = await ctx2.newPage();
  await page3.goto(BASE + '/main.html', { waitUntil: 'load' }).catch(function () { /* 缺题库不影响本项断言 */ });
  const state2 = await waitSwActive(page3, 30000);
  check('动态内容分片失败时 SW 仍激活', state2 === 'active', String(state2));
  const urls2 = (await cacheUrls(page3)).urls;
  check('硬清单照常缓存（安装没被拖垮）', urls2.indexOf('/main.html') >= 0 && urls2.indexOf('/core.js') >= 0, urls2.join(','));
  check('失败的动态分片确实没被缓存（如实反映失败，不做假成功）',
    !urls2.some(function (u) { return u.indexOf('/content/builtin-freq-idioms/') === 0; }), urls2.join(','));
  await ctx2.close();

  await browser.close();
  stopServer();
  console.log('');
  console.log(failed === 0 ? '通过 ' + passed + ' / 0 失败' : '通过 ' + passed + ' / ' + failed + ' 失败');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error(e);
  stopServer();
  process.exit(1);
});
