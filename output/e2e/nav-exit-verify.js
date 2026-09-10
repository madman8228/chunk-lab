/**
 * nav-exit-verify.js · 练习页「退出/返回」入口审计
 *
 * 目的：把练习态所有"能离开当前页"的入口列全 —— 谁可见、谁可达、点了去哪。
 *   1. brand 面包屑（本轮新增）→ decks.html
 *   2. btnDecks（顶栏 book 图标）→ decks.html
 *   3. btnBack（stage-head 右侧 arrowL）→ main 自己的 pageHome
 *   4. 浏览器后退键行为
 *
 * 输出：output/e2e/shots/nav-exit-*.png
 * 跑法：node output/e2e/nav-exit-verify.js
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

const PORT = 8960 + Math.floor(Math.random() * 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-nav-'));
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

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });

  /* ---------- 桌面 ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#stage', { timeout: 12000 });
  await p.waitForTimeout(1200);

  const probe = await p.evaluate(function () {
    function info(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 30),
        href: el.getAttribute && el.getAttribute('href'),
        title: el.getAttribute('title'),
        w: Math.round(r.width), h: Math.round(r.height),
        x: Math.round(r.x), y: Math.round(r.y),
        display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
        overflowHidden: cs.overflow,
        visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden',
        svgInside: !!el.querySelector('svg'),
        dataIconLeft: el.querySelectorAll('[data-icon]').length
      };
    }
    const brand = document.querySelector('a.brand');
    const btnBack = document.getElementById('btnBack');
    const btnDecks = document.getElementById('btnDecks');
    const stageHeadRight = document.querySelector('.stage-head-right');
    const stageHead = document.querySelector('.stage-head');
    const stage = document.getElementById('stage');
    return {
      brand: info(brand),
      crumbSep: info(document.querySelector('.crumb-sep')),
      deckName: info(document.getElementById('deckName')),
      btnBack: info(btnBack),
      btnBackParent: btnBack ? btnBack.parentElement.className : null,
      btnDecks: info(btnDecks),
      stageHeadRight: info(stageHeadRight),
      stageHeadRect: stageHead ? { w: Math.round(stageHead.getBoundingClientRect().width), h: Math.round(stageHead.getBoundingClientRect().height) } : null,
      stageOverflow: stage ? getComputedStyle(stage).overflow : null,
      // 全站 data-icon 残留（install 静默跳过的痕迹）
      leftoverIcons: document.querySelectorAll('[data-icon]').length,
      allDataIcons: Array.prototype.map.call(document.querySelectorAll('[data-icon]'), function (e) { return e.getAttribute('data-icon'); }),
      pageHomeHidden: (document.getElementById('pageHome') || {}).className,
      pagePracticeHidden: (document.getElementById('pagePractice') || {}).className
    };
  });

  console.log('\n=== 桌面 1280x800 ===');
  console.log(JSON.stringify(probe, null, 2));

  check('brand 是 <a> 且 href=decks.html', probe.brand && probe.brand.tag === 'A' && probe.brand.href === 'decks.html', probe.brand);
  check('brand 可见且有尺寸', !!(probe.brand && probe.brand.visible), probe.brand);
  check('面包屑分隔符 › 存在且可见', !!(probe.crumbSep && probe.crumbSep.visible && probe.crumbSep.text === '›'), probe.crumbSep);
  check('btnBack 存在', !!probe.btnBack, probe.btnBack);
  check('btnBack 可见（w>0 && h>0）', !!(probe.btnBack && probe.btnBack.visible), probe.btnBack);
  check('btnBack 内 SVG 已渲染', !!(probe.btnBack && probe.btnBack.svgInside), probe.btnBack);
  check('btnDecks 可见', !!(probe.btnDecks && probe.btnDecks.visible), probe.btnDecks);
  check('全站无 data-icon 残留（图标全渲染）', probe.leftoverIcons === 0, probe.allDataIcons);

  await p.screenshot({ path: path.join(SHOTS, 'nav-exit-desktop-full.png') });
  const topbar = await p.$('.topbar');
  if (topbar) await topbar.screenshot({ path: path.join(SHOTS, 'nav-exit-desktop-topbar.png') });
  const stageHeadEl = await p.$('.stage-head');
  if (stageHeadEl) await stageHeadEl.screenshot({ path: path.join(SHOTS, 'nav-exit-desktop-stagehead.png') });

  /* ---------- 行为验证：点 brand 是否真的跳 decks ---------- */
  console.log('\n=== 行为：点 brand 面包屑 ===');
  await p.click('a.brand');
  await p.waitForTimeout(1500);
  const urlAfterBrand = p.url();
  check('点 brand → 跳到 decks.html', /decks\.html/.test(urlAfterBrand), urlAfterBrand);
  await p.screenshot({ path: path.join(SHOTS, 'nav-exit-after-brand.png') });

  /* ---------- 行为验证：btnBack 去哪 ---------- */
  console.log('\n=== 行为：点 btnBack ===');
  const p2 = await ctx.newPage();
  await p2.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('#stage', { timeout: 12000 });
  await p2.waitForTimeout(1000);
  await p2.click('#btnBack');
  await p2.waitForTimeout(1200);
  const afterBack = await p2.evaluate(function () {
    return {
      url: location.href,
      homeHidden: (document.getElementById('pageHome') || {}).className,
      practiceHidden: (document.getElementById('pagePractice') || {}).className
    };
  });
  console.log(JSON.stringify(afterBack, null, 2));
  check('btnBack → 留在 main.html', /main\.html/.test(afterBack.url), afterBack.url);
  check('btnBack → 切到 pageHome（hidden 被移除）', !/\bhidden\b/.test(afterBack.homeHidden), afterBack.homeHidden);
  check('btnBack → 练习页被隐藏', /\bhidden\b/.test(afterBack.practiceHidden), afterBack.practiceHidden);
  /* ★ 关键：pageHome 的 homeBody 必须有内容（btnBack 切回来要能看到今日首页） */
  const homeBodyContent = await p2.evaluate(function(){
    var hb = document.getElementById('homeBody');
    return { exists: !!hb, htmlLen: hb ? hb.innerHTML.length : 0, childCount: hb ? hb.children.length : 0, firstText: hb && hb.firstElementChild ? (hb.firstElementChild.textContent||'').trim().slice(0,40) : '' };
  });
  console.log('homeBody content:', JSON.stringify(homeBodyContent));
  check('pageHome 的 homeBody 有渲染内容（btnBack 后不能是空白页）',
    homeBodyContent.exists && homeBodyContent.htmlLen > 50, homeBodyContent);
  await p2.screenshot({ path: path.join(SHOTS, 'nav-exit-after-btnback.png') });

  /* ---------- 移动端 ---------- */
  console.log('\n=== 移动端 390x844 ===');
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pm = await mctx.newPage();
  await pm.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await pm.waitForSelector('#stage', { timeout: 12000 });
  await pm.waitForTimeout(1200);
  const mprobe = await pm.evaluate(function () {
    function info(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' };
    }
    return {
      brand: info(document.querySelector('a.brand')),
      crumbSep: info(document.querySelector('.crumb-sep')),
      btnBack: info(document.getElementById('btnBack')),
      btnDecks: info(document.getElementById('btnDecks')),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth
    };
  });
  console.log(JSON.stringify(mprobe, null, 2));
  check('移动端 brand 可见', !!(mprobe.brand && mprobe.brand.visible), mprobe.brand);
  check('移动端 btnBack 可见', !!(mprobe.btnBack && mprobe.btnBack.visible), mprobe.btnBack);
  check('移动端无横向溢出', mprobe.scrollW <= mprobe.clientW + 1, mprobe);
  await pm.screenshot({ path: path.join(SHOTS, 'nav-exit-mobile-full.png') });
  const mtop = await pm.$('.topbar');
  if (mtop) await mtop.screenshot({ path: path.join(SHOTS, 'nav-exit-mobile-topbar.png') });

  check('零 pageerror', errs.length === 0, errs);

  await browser.close();
  try { server.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[nav-exit] passed=' + passed + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); try { server && server.kill('SIGKILL'); } catch (_) {} process.exit(1); });
