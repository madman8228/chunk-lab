/**
 * guest-verify.js · 静默游客账号 e2e
 * 场景：REQUIRE_AUTH=true 服务器，浏览器全新 localStorage
 * 断言：
 *  1. 不弹登录框（无 #chunkauth-mask）
 *  2. 自动建游客并持 token（ChunkAPI.isLoggedIn() true，/api/auth/me 可查，用户名 guest_ 前缀）
 *  3. 云端同步开启（CL 内部 _cloudOn；写一条数据能 PUT 上云）
 *  4. 二次访问：凭据静默续期，仍是同一游客账号
 *  5. logout 清凭据后重启：重新静默建新游客（旧行为不残留）
 */
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const ROOT = 'D:/06-project/chunk-practice';
const PORT = 9460 + Math.floor(Math.random() * 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-guest-'));
let server, failed = 0;
function check(name, cond, extra) {
  const tag = cond ? 'PASS' : 'FAIL';
  if (!cond) failed++;
  console.log(`[${tag}] ${name}${extra ? ' | ' + extra : ''}`);
}
function start() {
  return new Promise(function (res, rej) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, {
        CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT),
        REQUIRE_AUTH: 'true', JWT_SECRET: 'test-secret-guest-verify-0123456789abcdef', TOKEN_TTL: '30d'
      }), stdio: 'ignore'
    });
    let t = 0; const iv = setInterval(function () {
      t++;
      if (server.exitCode !== null) { clearInterval(iv); rej(new Error('server exited')); return; }
      const r = require('http').get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (x) {
        if (x.statusCode === 200) { clearInterval(iv); res(); }
      });
      r.on('error', () => {}); r.setTimeout(600, () => r.destroy());
      if (t > 40) { clearInterval(iv); rej(new Error('timeout')); }
    }, 400);
  });
}
(async function () {
  await start();
  const browser = await chromium.launch({ executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const url = 'http://127.0.0.1:' + PORT + '/main.html';

  // —— 第一次访问：全新用户（新 context 存储天然为空，勿用 addInitScript 清 storage——它每次导航都会执行） —— //
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const errors1 = [];
  p1.on('pageerror', e => errors1.push(e.message));
  await p1.goto(url, { waitUntil: 'networkidle' });
  await p1.waitForTimeout(1200);

  const maskVisible = await p1.evaluate(() => { const m = document.getElementById('chunkauth-mask'); return !!m; });
  check('A1 全新访问不弹登录框', !maskVisible);
  const logged1 = await p1.evaluate(() => window.ChunkAPI && ChunkAPI.isLoggedIn());
  check('A2 自动持 token', !!logged1);
  const me1 = await p1.evaluate(() => ChunkAPI.me().then(u => (u.user && u.user.username) || '?').catch(e => 'ERR:' + e.message));
  check('A3 游客名 guest_ 前缀', /^guest_/.test(me1), 'username=' + me1);
  // 云端同步：写一条 deck 并 PUT
  const putOk = await p1.evaluate(() => {
    const m = CL.loadMem();
    m.decks.push({ id: 'gv1', name: '验证牌组', items: [{ sentence: 'hello world.', translation: '你好', chunks: ['hello', 'world.'], hints: ['', ''], cid: 'c1' }] });
    CL.saveMem(m);
    return CL.cloudSyncNow(m).then(r => r === true).catch(e => 'ERR:' + e.message);
  });
  check('A4 游客数据 PUT 上云', !!putOk);

  // —— 第二次访问（同 context）：凭据续期 + 同一账号 —— //
  const p1b = await ctx1.newPage();
  await p1b.goto(url, { waitUntil: 'networkidle' });
  await p1b.waitForTimeout(1200);
  const me1b = await p1b.evaluate(() => ChunkAPI.me().then(u => (u.user && u.user.username) || '?').catch(e => 'ERR:' + e.message));
  check('B1 二次访问同账号', me1b === me1, me1b);
  const deckBack = await p1b.evaluate(() => CL.syncFromCloud().then(() => {
    const m = CL.loadMem();
    return m.decks.some(d => d.id === 'gv1');
  }).catch(() => false));
  check('B2 云端牌组拉回本地', !!deckBack);
  const errs = errors1.filter(e => !/favicon/.test(e));
  check('B3 无页面 JS 错误', errs.length === 0, errs.join(' ; '));

  // —— 退出登录：凭据清掉 —— //
  await p1b.evaluate(() => { localStorage.removeItem('chunklab_guest'); localStorage.removeItem('chunklab_manual'); ChunkAPI.clearToken(); });
  const p1c = await ctx1.newPage();
  await p1c.goto(url, { waitUntil: 'networkidle' });
  await p1c.waitForTimeout(1200);
  const mask3 = await p1c.evaluate(() => !!document.getElementById('chunkauth-mask'));
  const me1c = await p1c.evaluate(() => ChunkAPI.me().then(u => (u.user && u.user.username) || '?').catch(e => 'ERR:' + e.message));
  check('C1 退出后重启静默建新游客（不弹框）', !mask3 && /^guest_/.test(me1c) && me1c !== me1, 'new=' + me1c);

  // —— 手动会话标记：过期后应弹登录框而非偷换游客 —— //
  // 注意：必须等首轮 boot 完全落定再改存储，否则在飞的静默登录完成后会把 token 写回来（race）
  const p1d = await ctx1.newPage();
  await p1d.goto(url, { waitUntil: 'networkidle' });
  await p1d.waitForTimeout(1200);
  await p1d.evaluate(() => { localStorage.setItem('chunklab_manual', '1'); localStorage.removeItem('chunklab_guest'); ChunkAPI.clearToken(); });
  await p1d.reload({ waitUntil: 'networkidle' });
  await p1d.waitForTimeout(1200);
  const mask4 = await p1d.evaluate(() => !!document.getElementById('chunkauth-mask'));
  check('D1 手动会话过期弹登录框（不偷换游客）', mask4);

  await browser.close();
  server.kill('SIGKILL');
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
  console.log(failed === 0 ? '\nALL PASS' : '\nFAILED: ' + failed);
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) { console.error('FATAL', e); try { server && server.kill('SIGKILL'); } catch (_) {} process.exit(1); });
