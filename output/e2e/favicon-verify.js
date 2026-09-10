/**
 * favicon-verify.js · favicon 修复验证
 *
 * 背景（2026-09-10）：用户反馈浏览器 tab 显示完整 URL 而非页面标题。
 *   根因：此前仅声明 512×512 PNG，浏览器 tab 默认请求 /favicon.ico 与 32×32 均 404，
 *        Chrome/Edge/Firefox 在 favicon 加载失败时回退为「用 URL 字符串当 tab 标识」。
 *   修复：生成 favicon.ico(16/32/48) + icon-32/16.png，四个页面统一声明。
 *
 * 验证：
 *   1. 静态资源可达：/favicon.ico、/icon-32.png、/icon-192.png 均 200 且 content-type 正确
 *   2. 四个页面（main/decks/stats/courses）都有 <link rel="icon">
 *   3. 页面 <title> 正确渲染（非 URL）
 *   4. 零 pageerror
 *
 * 跑法：node output/e2e/favicon-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'output', 'e2e', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 9020 + Math.floor(Math.random() * 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-fav-'));
const CHROMIUM = process.env.CHROMIUM_PATH ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';

let server = null, passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}
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
      const req = require('http').get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function head(url) {
  return new Promise(function (resolve) {
    const req = require('http').get(url, function (r) {
      r.resume();
      resolve({ status: r.statusCode, type: r.headers['content-type'] || '', len: r.headers['content-length'] || '' });
    });
    req.on('error', function (e) { resolve({ status: 0, err: e.message }); });
    req.setTimeout(5000, function () { req.destroy(); resolve({ status: 0, err: 'timeout' }); });
  });
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();

  /* ===== 1. 静态资源可达性（真实 HTTP，非 file 读取） ===== */
  console.log('\n=== 1. favicon 静态资源可达性 ===');
  const assets = [
    ['/favicon.ico', 'image'],
    ['/icon-32.png', 'image/png'],
    ['/icon-16.png', 'image/png'],
    ['/icon-192.png', 'image/png']
  ];
  for (const [p, expectType] of assets) {
    const r = await head(BASE + p);
    console.log('  ' + p.padEnd(16) + ' status=' + r.status + ' type=' + r.type + ' len=' + r.len);
    check('GET ' + p + ' → 200', r.status === 200, r);
    check('  content-type 含 "' + expectType + '"', r.type.indexOf(expectType) !== -1, r.type);
  }

  /* ===== 2. 四个页面 <link rel="icon"> 声明 + title ===== */
  console.log('\n=== 2. 四页面 head 声明 ===');
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });
  /* courses.html 是「纯播放器」：无 ?id= 时 course-package.js:819-820 会主动 location.href='decks.html'
     （设计行为，非 bug）→ 运行时断言会被重定向干扰，改用静态文件检查其 head 声明。 */
  const pages = [
    ['main.html', 'Chunk Lab · 英语句型意群练习'],
    ['decks.html', '题库管理 · Chunk Lab'],
    ['stats.html', '学习档案 · Chunk Lab']
  ];
  const errsAll = [];
  for (const [file, expectTitle] of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/api/**', function (r) { r.abort('failed'); });
    const p = await ctx.newPage();
    p.on('pageerror', function (e) { errsAll.push(file + ': ' + e.message); });
    const iconRequests = [];
    p.on('response', function (r) {
      const u = r.url();
      if (/favicon\.ico|icon-\d+\.png/.test(u)) iconRequests.push({ url: u.split('/').pop(), status: r.status() });
    });
    await p.goto(BASE + '/' + file, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(900);
    const info = await p.evaluate(function () {
      return {
        title: document.title,
        icons: Array.prototype.map.call(document.querySelectorAll('link[rel~="icon"]'), function (l) {
          return { href: l.getAttribute('href'), sizes: l.getAttribute('sizes'), type: l.getAttribute('type') };
        }),
        apple: !!document.querySelector('link[rel="apple-touch-icon"]')
      };
    });
    console.log('  ' + file + '  title="' + info.title + '"  icons=' + info.icons.length + '  apple=' + info.apple);
    console.log('        requests: ' + JSON.stringify(iconRequests));
    check(file + ': <link rel="icon"> 数量 ≥ 3', info.icons.length >= 3, info.icons);
    check(file + ': 声明含 favicon.ico', info.icons.some(function (i) { return /favicon\.ico/.test(i.href || ''); }), info.icons);
    check(file + ': 声明含 32x32', info.icons.some(function (i) { return i.sizes === '32x32'; }), info.icons);
    check(file + ': title 正确（非 URL）', info.title === expectTitle, info.title);
    check(file + ': apple-touch-icon 保留', info.apple, info.apple);
    /* 浏览器实际拉取的 favicon 不能有 4xx */
    const bad = iconRequests.filter(function (r) { return r.status >= 400; });
    check(file + ': 实际拉取的 favicon 无 4xx/5xx', bad.length === 0, bad);
    if (file === 'main.html') await p.screenshot({ path: path.join(SHOTS, 'favicon-main.png') });
    await ctx.close();
  }
  check('零 pageerror', errsAll.length === 0, errsAll);

  /* ===== 3. courses.html 静态 head 检查（绕过运行时重定向） ===== */
  console.log('\n=== 3. courses.html 静态 head 检查 ===');
  const coursesSrc = fs.readFileSync(path.join(ROOT, 'courses.html'), 'utf8');
  check('courses.html: 声明含 favicon.ico', /<link[^>]+rel="icon"[^>]+favicon\.ico/.test(coursesSrc), null);
  check('courses.html: 声明含 32x32', /sizes="32x32"/.test(coursesSrc), null);
  check('courses.html: 声明含 192x192', /sizes="192x192"/.test(coursesSrc), null);
  check('courses.html: apple-touch-icon 保留', /rel="apple-touch-icon"/.test(coursesSrc), null);
  check('courses.html: title 为「图文课程 · Chunk Lab」', /<title>图文课程 · Chunk Lab<\/title>/.test(coursesSrc), (coursesSrc.match(/<title>[^<]*<\/title>/) || [])[0]);
  /* 运行时：无 ?id= 时应跳到 decks.html（设计行为，防回潮断言） */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/api/**', function (r) { r.abort('failed'); });
    const p = await ctx.newPage();
    await p.goto(BASE + '/courses.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const u = p.url();
    console.log('  courses.html 运行时最终 URL: ' + u);
    check('courses.html 无 ?id= 时跳 decks.html（纯播放器设计）', /decks\.html/.test(u), u);
    await ctx.close();
  }

  await browser.close();
  try { server.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[favicon] passed=' + passed + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); try { server && server.kill('SIGKILL'); } catch (_) {} process.exit(1); });
