/* stats-back.test.js · 统计页初始化阻塞时，返回按钮仍必须可用 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9650, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-stats-back-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;

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
      /* 就绪窗口 300×100ms=30s。原为 40×100ms=4s，小于宿主普通 node 冷启动实测 5.4s ⇒ 必然假红。
         health 一旦 200 立即 resolve，放大窗口在成功路径上不增加任何耗时。 */
      if (++tries > 300) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 100);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    /* 云端配置请求迟到，模拟真实网络卡顿；返回按钮不应依赖它完成。 */
    await page.route('**/api/config', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 900); });
      await route.continue();
    });
    await page.goto(BASE + '/stats.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#statsBack', { timeout: 300 });
    await page.waitForSelector('.stats-loading', { timeout: 300 });
    await page.locator('#statsBack').click();
    await page.waitForURL(/\/main\.html(?:\?|$)/, { timeout: 300 });
    console.log('[stats-back] 返回按钮在初始化阻塞时仍可用');
  } catch (error) {
    console.error('[stats-back] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
