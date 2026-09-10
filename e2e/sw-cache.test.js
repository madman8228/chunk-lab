/**
 * sw-cache.test.js · SW 预缓存策略的端到端验证（真浏览器）
 *
 * 为什么必须真浏览器：sw-policy.test.js 只能证明 sw.js 的「文本契约」还在，
 * 证明不了 install 在真实 ServiceWorker 容器里跑得通、cache API 真的写进去了、离线真的还能打开。
 *
 * 背景（2026-09-10 扩容 8000 句时发现的真 P0）：
 *   install 用 caches.addAll(PRECACHE)，PRECACHE 含三个题库文件（8000 句时 8.25MB）。
 *   addAll 全有全无 → 移动网络下极易整体失败 → SW 一个都装不上、离线能力全丢。
 *
 * 覆盖：
 *   1. 首次在线访问：SW 安装成功，硬/软清单都进了 cache
 *   2. ★ 首次访问后**立即离线**（只访问过一次）→ 页面仍能完整启动
 *      为什么是这个场景：实测发现 Cache API 的匹配对「请求形状」敏感 ——
 *      install 的 addAll() 存储条目时请求不带 Origin，而 <script type="module"> 带 Origin（CORS 请求）
 *      → .mjs 永远取不到预缓存 → 落到 HTML 兜底 → FormatTools 缺失 → 启动段 TypeError。
 *      只在「在线访问过第二次」之后才会被运行时的 cache.put 修正，所以必须锁住「只访问一次」这个前提。
 *   3. ★ 回归检测：软清单资产不可达时 SW 仍能安装成功
 *      （旧 addAll(含题库) 设计下这里必然装不上 —— 这是预缓存拆分要锁住的行为）
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
const PORT = 9500 + Math.floor(Math.random() * 100);
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
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

  /* ---------- 1. 首次在线访问 ---------- */
  console.log('【1. 首次在线访问：SW 安装 + 硬/软清单入缓存】');
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
    if (urls.indexOf('/builtins.js') >= 0 && urls.indexOf('/main.html') >= 0) break;
    await page.waitForTimeout(400);
  }
  check('硬清单已缓存（/main.html、/core.js）',
    urls.indexOf('/main.html') >= 0 && urls.indexOf('/core.js') >= 0, urls.join(','));
  check('软清单已缓存（题库三件套——首次在线安装时 fillSoft 应取到）',
    urls.indexOf('/builtins.js') >= 0 && urls.indexOf('/oral8000.js') >= 0 && urls.indexOf('/freq-idioms.js') >= 0,
    urls.filter(function (u) { return /builtins|oral8000|freq-idioms/.test(u); }).join(','));
  check('页面无 JS 错误', errs.length === 0, errs.slice(0, 3).join(' | '));

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
            items: (window.BUILTIN || []).reduce(function (s, d) { return s + (d.items || []).length; }, 0),
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
  check('离线题库完整（BUILTIN 句数 > 0）', off.items > 0, String(off.items));
  check('离线无 JS 错误（尤其不得出现 MIME/esc 类级联报错）', errs2.length === 0, errs2.slice(0, 3).join(' | '));
  await ctx.close();

  /* ---------- 3. 软清单不可达时 SW 仍应装上（核心回归检测） ---------- */
  console.log('');
  console.log('【3. 回归检测：软清单资产不可达 → SW 仍必须安装成功】');
  const ctx2 = await browser.newContext();
  await ctx2.route('**/oral8000.js', function (r) { r.abort('failed'); });
  const page3 = await ctx2.newPage();
  await page3.goto(BASE + '/main.html', { waitUntil: 'load' }).catch(function () { /* 缺题库不影响本项断言 */ });
  const state2 = await waitSwActive(page3, 30000);
  check('soft 资产失败时 SW 仍激活（旧 addAll(含题库) 设计下此处必然失败）', state2 === 'active', String(state2));
  const urls2 = (await cacheUrls(page3)).urls;
  check('硬清单照常缓存（安装没被拖垮）', urls2.indexOf('/main.html') >= 0 && urls2.indexOf('/core.js') >= 0, urls2.join(','));
  check('缺失的 soft 资产确实没被缓存（如实反映失败，不做假成功）',
    urls2.indexOf('/oral8000.js') < 0, urls2.join(','));
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
