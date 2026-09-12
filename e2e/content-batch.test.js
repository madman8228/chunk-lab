/* content-batch.test.js · 内置题库分批读取 + IndexedDB 内容缓存端到端验证 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9600, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-content-batch-'));
let server = null;
let browser = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    var tries = 0;
    var iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function check(name, ok, detail) {
  if (!ok) throw new Error(name + (detail ? ' → ' + detail : ''));
  console.log('  ✓ ' + name);
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', function (e) { errors.push(e.message); });
    await page.goto(BASE + '/main.html', { waitUntil: 'load' });
    await page.waitForFunction(function () { return window.ContentRepo && window.ContentRepo.ready; });
    await page.waitForFunction(function () {
      var home = document.getElementById('pageHome');
      return window.ContentRepo && window.ContentRepo.getManifest() && window.S && home && !home.classList.contains('hidden');
    });

    const first = await page.evaluate(function () {
      var mem = window.CL.loadMem();
      mem.settings.skipMastered = false;
      return window.ContentRepo.ensureDeckBatch('builtin-daily', mem, {
        force: true,
        limit: 3,
        cursor: { baseOffset: 88, shardIndex: 0, shardOffset: 0 }
      });
    });
    check('分批接口只返回请求数量', first.loadedCount === 3 && first.deck.items.length === 3, JSON.stringify(first));
    check('第一批游标推进到首个分片', first.nextCursor.shardIndex === 0 && first.nextCursor.shardOffset === 3, JSON.stringify(first.nextCursor));

    const second = await page.evaluate(function (cursor) {
      var mem = window.CL.loadMem();
      mem.settings.skipMastered = false;
      return window.ContentRepo.ensureDeckBatch('builtin-daily', mem, {
        force: true,
        limit: 3,
        cursor: cursor
      });
    }, first.nextCursor);
    const cids1 = first.deck.items.map(function (it) { return it.cid; });
    const cids2 = second.deck.items.map(function (it) { return it.cid; });
    check('下一批继续游标且不重复', second.loadedCount === 3 && !cids1.some(function (cid) { return cids2.indexOf(cid) >= 0; }), JSON.stringify({ first: cids1, second: cids2 }));

    await page.waitForTimeout(150);
    const cached = await page.evaluate(function () {
      return new Promise(function (resolve) {
        var req = indexedDB.open('chunklab-content-v1');
        req.onsuccess = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('shards')) { db.close(); resolve({ count: 0 }); return; }
          var count = db.transaction('shards', 'readonly').objectStore('shards').count();
          count.onsuccess = function () { var n = count.result; db.close(); resolve({ count: n }); };
          count.onerror = function () { db.close(); resolve({ count: 0 }); };
        };
        req.onerror = function () { resolve({ count: 0 }); };
      });
    });
    check('分片已写入独立内容缓存', cached.count >= 1, JSON.stringify(cached));

    /* 删除 SW/Cache Storage 后离线再取同一分片；batch loader 的 memory=false
       会强制验证 IndexedDB 路径，证明不是只依赖 Service Worker 运行时缓存。 */
    await page.evaluate(function () {
      return caches.keys().then(function (names) { return Promise.all(names.map(function (name) { return caches.delete(name); })); });
    });
    await page.context().setOffline(true);
    const offline = await page.evaluate(function () {
      var mem = window.CL.loadMem();
      mem.settings.skipMastered = false;
      return window.ContentRepo.ensureDeckBatch('builtin-daily', mem, {
        force: true,
        limit: 3,
        cursor: { baseOffset: 88, shardIndex: 0, shardOffset: 0 }
      });
    });
    check('离线可从 IndexedDB 命中分片', offline.loadedCount === 3 && offline.deck.items.length === 3, JSON.stringify(offline));

    check('批次流程无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

    await browser.close();
    browser = null;
    stopServer();
    console.log('[content-batch e2e] passed');
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
    console.error('[content-batch e2e] failed:', err && err.stack || err);
    process.exitCode = 1;
  }
})();
