/**
 * acct-copy-verify.js · 账号区块「点击复制账号名 + 同行布局」验证（2026-09-10 重写）
 *
 * ── 为什么重写（根因）──
 * 旧版用 addInitScript 里 mock window.fetch，只桩 /api/config(requireAuth:true) 与 /api/auth/me，
 * 但页面真实启动链还需要 /api/auth/register（静默游客注册）。mock 打不通真实链路后
 * bootMain 中途失败 → #pageHome 永远保持 hidden → 脚本卡在 waitForSelector('#pageHome')
 * 12s 超时。用"半个 mock"骗过前端，测的是不存在环境。
 * → 改为：起一台真实 REQUIRE_AUTH=true 服务器，走应用自带的静默游客注册，
 *   在真实登录态下验证账号区块（chip 复制 / 同行 / 退出分支 / 窄屏）。
 *
 * 验证点：
 *   1. 账号区块可见 + 账号 chip 显示真实 guest_ 用户名（chip 含 SVG copy 图标 / aria-label）
 *   2. chip 与「退出登录」按钮同行（中线 y 差 < 8px）
 *   3. 点击 chip → tip「已复制 xxx」+ .copied 绿框 + 剪贴板真实写入
 *   4. 1.6s 后 tip/.copied 自动消失
 *   5. 未登录分支（clearToken 后 refreshAccountUi）：chip 隐藏、登录按钮显示
 *   6. 凭据（chunklab_guest）保留 → 重载后仍为同一账号
 *   7. 360px 窄屏：chip / 退出按钮 / 账号文本仍在
 *   8. 零 pageerror
 *
 * 运行：node output/e2e/acct-copy-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 9420 + Math.floor(Math.random() * 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-acct-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, {
        CHUNKLAB_DATA_DIR: TMP_DB,
        PORT: String(PORT),
        REQUIRE_AUTH: 'true',
        JWT_SECRET: 'test-secret-acct-copy-0123456789abcdef',
        TOKEN_TTL: '30d'
      }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = require('http').get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* retry */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server start timeout')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}

/* 打开设置面板（账号区块在设置弹窗内） */
async function openSettings(page) {
  await page.evaluate(function () { document.getElementById('btnSettingsTop').click(); });
  await page.waitForFunction(function () {
    var s = document.getElementById('accountSection');
    return s && !s.hidden;
  }, { timeout: 8000 });
}

(async function () {
  await startServer();
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 760, height: 620 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });

  try {
    /* 全新 context：存储天然为空 → 触发应用自带的静默游客注册 */
    await page.goto(BASE + '/main.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(function () {
      return !!(window.ChunkAPI && ChunkAPI.isLoggedIn());
    }, { timeout: 15000 });

    const USER = await page.evaluate(function () {
      return ChunkAPI.me().then(function (u) { return (u && u.user && u.user.username) || ''; }).catch(function () { return ''; });
    });
    check('静默游客账号已建立（guest_ 前缀）', /^guest_/.test(USER || ''), USER);

    await openSettings(page);
    await page.waitForFunction(function () {
      var b = document.getElementById('acctNameBtn');
      return b && !b.hidden && b.dataset.username;
    }, { timeout: 8000 });

    /* ===== 断言 1：账号区块 + chip 布局 ===== */
    const layout = await page.evaluate(function () {
      var sec = document.getElementById('accountSection');
      var chip = document.getElementById('acctNameBtn');
      var txt = document.getElementById('acctNameText');
      var logout = document.getElementById('btnAccountLogout');
      if (!sec || !chip || !txt || !logout) return { missing: { sec: !sec, chip: !chip, txt: !txt, logout: !logout } };
      var r1 = chip.getBoundingClientRect();
      var r2 = logout.getBoundingClientRect();
      return {
        secVisible: !sec.hidden,
        chipVisible: !chip.hidden,
        chipText: txt.textContent.trim(),
        chipTitle: txt.title,
        datasetUsername: chip.dataset.username || '',
        hasIcon: !!chip.querySelector('svg.icon'),
        ariaLabel: chip.getAttribute('aria-label'),
        logoutVisible: !logout.hidden,
        sameRow: Math.abs((r1.top + r1.height / 2) - (r2.top + r2.height / 2)) < 8,
        chipRect: { y: Math.round(r1.top), h: Math.round(r1.height), x: Math.round(r1.left), w: Math.round(r1.width) },
        logoutRect: { y: Math.round(r2.top), h: Math.round(r2.height), x: Math.round(r2.left), w: Math.round(r2.width) }
      };
    });
    check('账号区块可见', layout.secVisible, layout);
    check('账号名 chip 可见', layout.chipVisible, layout);
    check('chip 显示账号文本 = 当前账号', layout.chipText === USER, { chipText: layout.chipText, USER: USER });
    check('chip 含 SVG copy 图标', layout.hasIcon, layout);
    check('chip 有 aria-label 标识可点击', /复制|点击/.test(layout.ariaLabel || ''), layout.ariaLabel);
    check('chip 与退出按钮同行（y 中线差 < 8px）', layout.sameRow, { chip: layout.chipRect, logout: layout.logoutRect });
    check('退出登录按钮可见（已登录态）', layout.logoutVisible, layout);

    await page.screenshot({ path: path.join(SHOTS, 'acct-copy-idle.png') });

    /* ===== 断言 2：点击 chip → 复制反馈 ===== */
    await page.click('#acctNameBtn');
    await page.waitForTimeout(200);
    const feedback = await page.evaluate(function () {
      var tip = document.getElementById('acctTip');
      var btn = document.getElementById('acctNameBtn');
      return {
        tipText: tip ? tip.textContent.trim() : null,
        tipShown: tip ? tip.classList.contains('show') : false,
        btnCopied: btn ? btn.classList.contains('copied') : false
      };
    });
    check('点击后出现「已复制 xxx」提示', feedback.tipText === '已复制 ' + USER, feedback);
    check('tip 加了 .show class（视觉可见）', feedback.tipShown, feedback);
    check('chip 加了 .copied class（绿框反馈）', feedback.btnCopied, feedback);
    await page.screenshot({ path: path.join(SHOTS, 'acct-copy-clicked.png') });

    /* ===== 断言 3：剪贴板真实写入 ===== */
    const clip = await page.evaluate(async function () {
      try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR: ' + e.message; }
    });
    check('剪贴板真实内容 = 账号名', clip === USER, { actual: clip, expect: USER });

    /* ===== 断言 4：1.6s 后反馈自动消失 ===== */
    await page.waitForTimeout(1800);
    const faded = await page.evaluate(function () {
      var tip = document.getElementById('acctTip');
      var btn = document.getElementById('acctNameBtn');
      return {
        tipShown: tip ? tip.classList.contains('show') : null,
        btnCopied: btn ? btn.classList.contains('copied') : null
      };
    });
    check('1.6s 后 .show 移除', !faded.tipShown, faded);
    check('1.6s 后 .copied 移除', !faded.btnCopied, faded);
    await page.screenshot({ path: path.join(SHOTS, 'acct-copy-after-fade.png') });

    /* ===== 断言 5：未登录分支 =====
       注意：这里不能靠点击「退出登录」按钮 —— 它会 location.reload()，
       而本项目 2026-09-09 的设计是「REQUIRE_AUTH 下无凭据即静默建新游客」，
       重载后必然又变成已登录态（该行为由 guest-verify C1 覆盖）。
       所以直接驱动 DOM 分支：清 token → refreshAccountUi()，验证 else 分支渲染。 */
    const guestCred = await page.evaluate(function () { return localStorage.getItem('chunklab_guest'); });
    check('静默凭据已落盘（chunklab_guest）', !!guestCred);
    await page.evaluate(function () {
      localStorage.removeItem('chunklab_guest');
      localStorage.removeItem('chunklab_manual');
      ChunkAPI.clearToken();
      refreshAccountUi();
    });
    await page.waitForFunction(function () {
      var b = document.getElementById('acctNameBtn');
      return b && b.hidden;
    }, { timeout: 5000 });
    const loggedOut = await page.evaluate(function () {
      var chip = document.getElementById('acctNameBtn');
      var login = document.getElementById('btnAccountLogin');
      var logout = document.getElementById('btnAccountLogout');
      return { chipHidden: chip.hidden, loginHidden: login.hidden, logoutHidden: logout.hidden };
    });
    check('未登录分支：账号 chip 隐藏', loggedOut.chipHidden, loggedOut);
    check('未登录分支：登录按钮显示', !loggedOut.loginHidden, loggedOut);
    check('未登录分支：退出按钮隐藏', loggedOut.logoutHidden, loggedOut);
    await page.screenshot({ path: path.join(SHOTS, 'acct-copy-loggedout.png') });

    /* ===== 断言 6：凭据保留 → 重载后仍是同一账号 ===== */
    await page.evaluate(function (c) { localStorage.setItem('chunklab_guest', c); }, guestCred);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(function () { return !!(window.ChunkAPI && ChunkAPI.isLoggedIn()); }, { timeout: 15000 });
    const me2 = await page.evaluate(function () {
      return ChunkAPI.me().then(function (u) { return (u && u.user && u.user.username) || ''; }).catch(function () { return ''; });
    });
    check('凭据续期：重载后仍是同一账号', me2 === USER, { before: USER, after: me2 });

    /* ===== 断言 7：360px 窄屏 ===== */
    /* 先 resize 再开设置：openSettings 内部只调一次 refreshAccountUi，
       避免"额外再调一次"与它自己的异步链竞态（refreshAccountUi 会同步把文本
       打回占位「…」，真实用户名要等 ChunkAPI.me() 回来才写入）。 */
    await page.setViewportSize({ width: 360, height: 600 });
    await openSettings(page);
    await page.waitForFunction(function () {
      var b = document.getElementById('acctNameBtn');
      var t = document.getElementById('acctNameText');
      return !!(b && !b.hidden && t && t.title);
    }, { timeout: 8000 });
    const mob = await page.evaluate(function () {
      var chip = document.getElementById('acctNameBtn');
      var logout = document.getElementById('btnAccountLogout');
      var login = document.getElementById('btnAccountLogin');
      var txt = document.getElementById('acctNameText');
      var r = chip.getBoundingClientRect();
      return {
        chipVisible: !chip.hidden,
        logoutVisible: !logout.hidden,
        loginHidden: login.hidden,
        chipTitle: txt.title,
        inViewport: r.left >= 0 && r.right <= window.innerWidth + 1
      };
    });
    check('360px viewport：账号 chip 仍可见', mob.chipVisible, mob);
    check('360px viewport：退出登录按钮仍可见', mob.logoutVisible, mob);
    check('360px viewport：账号文本仍存在', mob.chipTitle === USER, mob);
    check('360px viewport：chip 未溢出 viewport', mob.inViewport, mob);
    await page.screenshot({ path: path.join(SHOTS, 'acct-copy-mobile.png') });

    check('零 pageerror', errs.length === 0, errs.join(' | '));
  } finally {
    await browser.close();
    stopServer();
  }

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) { console.error('FATAL', e); stopServer(); process.exit(1); });
